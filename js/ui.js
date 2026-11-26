/**
 * Escapes raw text to prevent XSS injection before rendering into HTML.
 */
export function escapeHtml(str) {
    return String(str)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');
}

/**
 * Converts safe escaped markdown-lite (**bold**, *italic*, URLs, emails, bullet lines)
 * into clean HTML for assistant messages.
 */
export function renderSafeMarkdown(rawText) {
    const escaped = escapeHtml(rawText);

    const lines = escaped.split('\n');
    const htmlBlocks = [];
    let inList = false;

    const formatInline = (line) =>
        line
            .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
            .replace(/\*(.+?)\*/g, '<em>$1</em>')
            .replace(
                /(https?:\/\/[^\s<]+)/g,
                '<a href="$1" target="_blank" rel="noopener noreferrer" class="text-[#004a99] underline hover:text-[#003366] break-all">$1</a>'
            )
            .replace(
                /\b([a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,})\b/g,
                '<a href="mailto:$1" class="text-[#004a99] underline hover:text-[#003366]">$1</a>'
            );

    for (const rawLine of lines) {
        const line = rawLine.trim();
        const bulletMatch = line.match(/^[-*•]\s+(.*)$/);
        if (bulletMatch) {
            if (!inList) {
                htmlBlocks.push('<ul class="list-disc pl-4 space-y-1 my-1.5">');
                inList = true;
            }
            htmlBlocks.push(`<li>${formatInline(bulletMatch[1])}</li>`);
        } else {
            if (inList) {
                htmlBlocks.push('</ul>');
                inList = false;
            }
            if (line === '') {
                htmlBlocks.push('<div class="h-2"></div>');
            } else {
                htmlBlocks.push(`<p class="leading-relaxed">${formatInline(line)}</p>`);
            }
        }
    }

    if (inList) {
        htmlBlocks.push('</ul>');
    }

    return htmlBlocks.join('');
}

export class ChatUI {
    constructor(resumeData) {
        this.data = resumeData;
        this.els = {
            headerTitle: document.getElementById('header-title'),
            headerSubtitle: document.getElementById('header-subtitle'),
            headerAvatar: document.getElementById('header-avatar'),
            chatWindow: document.getElementById('chat-window'),
            suggestionBar: document.getElementById('suggestion-bar'),
            input: document.getElementById('user-input-field'),
            sendBtn: document.getElementById('send-btn'),
            resetBtn: document.getElementById('reset-btn'),
            engineBadge: document.getElementById('engine-badge'),
            resumeModalBtn: document.getElementById('open-resume-btn'),
            resumeModal: document.getElementById('resume-modal'),
            resumeModalClose: document.getElementById('close-resume-btn'),
            resumeModalContent: document.getElementById('resume-modal-content')
        };
        this.typingNode = null;
    }

    applyBranding(isLlmEnabled) {
        const assistant = this.data.assistant || {};
        const candidate = this.data.candidate || {};
        const theme = assistant.theme || {};

        if (theme.primary) {
            document.documentElement.style.setProperty('--brand-primary', theme.primary);
        }
        if (theme.primaryDark) {
            document.documentElement.style.setProperty('--brand-primary-dark', theme.primaryDark);
        }

        document.title = `${candidate.name || assistant.displayName || 'Resume'} — ${assistant.subtitle || 'AI Resume Assistant'}`;

        if (this.els.headerTitle) {
            this.els.headerTitle.textContent = `${assistant.displayName || candidate.name || 'Resume'} (${assistant.name || 'AI'})`;
        }
        if (this.els.headerSubtitle) {
            this.els.headerSubtitle.textContent = assistant.subtitle || 'Interactive Resume Assistant';
        }
        if (this.els.headerAvatar) {
            this._mountAvatar(this.els.headerAvatar, 'w-11 h-11');
        }
        if (this.els.engineBadge) {
            this.els.engineBadge.textContent = isLlmEnabled
                ? 'LLM + Resume RAG Active'
                : 'Dynamic Resume RAG Active';
        }
        if (this.els.input && assistant.inputPlaceholder) {
            this.els.input.placeholder = assistant.inputPlaceholder;
        }
    }

    _mountAvatar(container, sizeClass = 'w-10 h-10') {
        const assistant = this.data.assistant || {};
        container.innerHTML = '';
        if (assistant.avatar) {
            const img = document.createElement('img');
            img.src = assistant.avatar;
            img.alt = assistant.name || 'Assistant Avatar';
            img.className = `${sizeClass} rounded-full object-cover`;
            img.onerror = () => {
                container.textContent = assistant.fallbackEmoji || '🐱';
            };
            container.appendChild(img);
        } else {
            container.textContent = assistant.fallbackEmoji || '🐱';
        }
    }

    renderWelcome(recruiterName) {
        const assistant = this.data.assistant || {};
        const msg = recruiterName && assistant.returningGreeting
            ? assistant.returningGreeting.replace('{name}', recruiterName)
            : assistant.greeting || 'Hello! Ask me anything about this resume.';
        this.els.chatWindow.innerHTML = '';
        this.addAssistantMessage(msg);
    }

    renderSuggestions(onSelect) {
        const prompts = this.data.assistant?.suggestedPrompts || [];
        this.els.suggestionBar.innerHTML = '';
        for (const item of prompts) {
            const btn = document.createElement('button');
            btn.type = 'button';
            btn.className = 'suggestion-chip shrink-0 text-xs font-medium px-3 py-1.5 rounded-full bg-slate-100 text-slate-700 hover:bg-[#004a99] hover:text-white transition-colors border border-slate-200';
            btn.textContent = item.label;
            btn.addEventListener('click', () => onSelect(item.query));
            this.els.suggestionBar.appendChild(btn);
        }
    }

    addUserMessage(text) {
        const row = document.createElement('div');
        row.className = 'flex justify-end animate-fade-in';

        const bubble = document.createElement('div');
        bubble.className = 'bg-[var(--brand-primary)] text-white px-4 py-3 rounded-2xl rounded-tr-none shadow-sm max-w-[85%] text-sm leading-relaxed break-words';
        bubble.textContent = text;

        row.appendChild(bubble);
        this.els.chatWindow.appendChild(row);
        this.scrollToBottom();
    }

    addAssistantMessage(markdownText) {
        const row = document.createElement('div');
        row.className = 'flex items-start space-x-3 animate-fade-in';

        const avatar = document.createElement('div');
        avatar.className = 'cat-avatar';
        this._mountAvatar(avatar, 'w-full h-full');

        const bubble = document.createElement('div');
        bubble.className = 'bg-white p-4 rounded-2xl rounded-tl-none shadow-sm border border-slate-100 max-w-[85%] text-sm text-slate-700';
        bubble.innerHTML = renderSafeMarkdown(markdownText);

        row.appendChild(avatar);
        row.appendChild(bubble);
        this.els.chatWindow.appendChild(row);
        this.scrollToBottom();
    }

    showTyping() {
        this.hideTyping();
        const row = document.createElement('div');
        row.className = 'flex items-start space-x-3 animate-fade-in';

        const avatar = document.createElement('div');
        avatar.className = 'cat-avatar';
        this._mountAvatar(avatar, 'w-full h-full');

        const bubble = document.createElement('div');
        bubble.className = 'bg-white px-4 py-3 rounded-2xl rounded-tl-none shadow-sm border border-slate-100 flex items-center space-x-1.5';
        bubble.innerHTML = `
            <span class="typing-dot"></span>
            <span class="typing-dot" style="animation-delay: 0.15s"></span>
            <span class="typing-dot" style="animation-delay: 0.3s"></span>
        `;

        row.appendChild(avatar);
        row.appendChild(bubble);
        this.els.chatWindow.appendChild(row);
        this.typingNode = row;
        this.scrollToBottom();
    }

    hideTyping() {
        if (this.typingNode) {
            this.typingNode.remove();
            this.typingNode = null;
        }
    }

    scrollToBottom() {
        this.els.chatWindow.scrollTop = this.els.chatWindow.scrollHeight;
    }

    renderResumeDrawer() {
        const c = this.data.candidate || {};
        const experience = this.data.experience || [];
        const projects = this.data.projects || [];
        const education = this.data.education || [];
        const skills = this.data.skills || [];

        const linksHtml = [
            c.links?.email ? `<a href="mailto:${escapeHtml(c.links.email)}" class="text-xs px-2.5 py-1 rounded-full bg-blue-50 text-[#004a99] hover:underline">${escapeHtml(c.links.email)}</a>` : '',
            c.links?.linkedin ? `<a href="${escapeHtml(c.links.linkedin)}" target="_blank" rel="noopener noreferrer" class="text-xs px-2.5 py-1 rounded-full bg-blue-50 text-[#004a99] hover:underline">LinkedIn</a>` : '',
            c.links?.github ? `<a href="${escapeHtml(c.links.github)}" target="_blank" rel="noopener noreferrer" class="text-xs px-2.5 py-1 rounded-full bg-blue-50 text-[#004a99] hover:underline">GitHub</a>` : ''
        ].filter(Boolean).join('');

        const expHtml = experience.map((r) => `
            <div class="border-l-2 border-[#004a99]/30 pl-3.5 pb-4">
                <div class="flex flex-wrap justify-between items-baseline gap-1">
                    <h4 class="font-semibold text-slate-800 text-sm">${escapeHtml(r.title)}</h4>
                    <span class="text-xs text-slate-400 font-medium">${escapeHtml(r.period)}</span>
                </div>
                <p class="text-xs font-medium text-[#004a99] mb-1.5">${escapeHtml(r.company)} · ${escapeHtml(r.location)}</p>
                <ul class="list-disc pl-4 space-y-1 text-xs text-slate-600">
                    ${(r.highlights || []).map((h) => `<li>${escapeHtml(h)}</li>`).join('')}
                </ul>
            </div>
        `).join('');

        const projHtml = projects.map((p) => `
            <div class="bg-slate-50 rounded-xl p-3 border border-slate-100">
                <div class="flex flex-wrap justify-between items-baseline gap-1">
                    <h4 class="font-semibold text-slate-800 text-sm">${escapeHtml(p.title)}</h4>
                    <span class="text-xs text-slate-400">${escapeHtml(p.period)}</span>
                </div>
                <p class="text-xs text-slate-600 mt-1">${escapeHtml(p.summary)}</p>
                <div class="flex flex-wrap gap-1 mt-2">
                    ${(p.technologies || []).map((t) => `<span class="text-[10px] px-2 py-0.5 rounded-full bg-white border border-slate-200 text-slate-600">${escapeHtml(t)}</span>`).join('')}
                </div>
            </div>
        `).join('');

        const eduHtml = education.map((e) => `
            <div class="flex flex-wrap justify-between items-baseline gap-1 py-1.5 border-b border-slate-100 last:border-0">
                <div>
                    <p class="font-semibold text-slate-800 text-sm">${escapeHtml(e.degree)}${e.specialization && !e.degree.includes(e.specialization) ? ` (${escapeHtml(e.specialization)})` : ''}</p>
                    <p class="text-xs text-slate-500">${escapeHtml(e.institution)} · ${escapeHtml(e.location)}</p>
                </div>
                <span class="text-xs text-slate-400">${escapeHtml(e.period)}</span>
            </div>
        `).join('');

        const skillHtml = skills.map((s) => `
            <div>
                <p class="text-xs font-semibold text-slate-700 mb-1">${escapeHtml(s.category)}</p>
                <div class="flex flex-wrap gap-1.5">
                    ${(s.items || []).map((item) => `<span class="text-[11px] px-2.5 py-0.5 rounded-full bg-slate-100 text-slate-700">${escapeHtml(item)}</span>`).join('')}
                </div>
            </div>
        `).join('');

        this.els.resumeModalContent.innerHTML = `
            <div class="space-y-5">
                <div>
                    <h3 class="text-lg font-bold text-slate-900">${escapeHtml(c.name || '')}${c.alternateName ? ` <span class="text-sm font-normal text-slate-500">(${escapeHtml(c.alternateName)})</span>` : ''}</h3>
                    <p class="text-xs font-semibold text-[#004a99] mt-0.5">${escapeHtml(c.headline || c.title || '')}</p>
                    <p class="text-xs text-slate-500 mt-0.5">${escapeHtml(c.location || '')}</p>
                    <div class="flex flex-wrap gap-2 mt-2.5">${linksHtml}</div>
                    <p class="text-xs text-slate-600 leading-relaxed mt-3">${escapeHtml(c.summary || '')}</p>
                </div>

                <div>
                    <h4 class="text-xs font-bold uppercase tracking-wider text-slate-400 mb-2.5">Work History</h4>
                    <div>${expHtml}</div>
                </div>

                <div>
                    <h4 class="text-xs font-bold uppercase tracking-wider text-slate-400 mb-2.5">Projects & Initiatives</h4>
                    <div class="space-y-2.5">${projHtml}</div>
                </div>

                <div>
                    <h4 class="text-xs font-bold uppercase tracking-wider text-slate-400 mb-2">Education</h4>
                    <div>${eduHtml}</div>
                </div>

                <div>
                    <h4 class="text-xs font-bold uppercase tracking-wider text-slate-400 mb-2.5">Technical Skills</h4>
                    <div class="space-y-2.5">${skillHtml}</div>
                </div>
            </div>
        `;
    }

    bindEvents({ onSend, onReset }) {
        const submit = () => {
            const value = this.els.input.value.trim();
            if (!value) return;
            this.els.input.value = '';
            onSend(value);
        };

        this.els.sendBtn.addEventListener('click', submit);
        this.els.input.addEventListener('keydown', (e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                submit();
            }
        });
        this.els.resetBtn.addEventListener('click', onReset);

        const openModal = () => {
            this.els.resumeModal.classList.remove('hidden');
            this.els.resumeModal.classList.add('flex');
        };
        const closeModal = () => {
            this.els.resumeModal.classList.add('hidden');
            this.els.resumeModal.classList.remove('flex');
        };

        this.els.resumeModalBtn?.addEventListener('click', openModal);
        this.els.resumeModalClose?.addEventListener('click', closeModal);
        this.els.resumeModal?.addEventListener('click', (e) => {
            if (e.target === this.els.resumeModal) closeModal();
        });
        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape' && !this.els.resumeModal.classList.contains('hidden')) {
                closeModal();
            }
        });

        this.els.input.focus();
    }
}
