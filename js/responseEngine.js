import { APP_CONFIG } from './config.js';

const COMMON_NON_NAMES = new Set([
    'a', 'an', 'the', 'how', 'what', 'who', 'where', 'when', 'why',
    'is', 'are', 'not', 'looking', 'hiring', 'interested', 'asking',
    'curious', 'wondering', 'trying', 'here', 'just', 'very', 'good', 'great'
]);

const FOLLOW_UP_PHRASES = [
    'anything else',
    'what else',
    'tell me more',
    'more info',
    'more details',
    'more about',
    'go on',
    'continue'
];

/**
 * Orchestrates memory commands, local grounded RAG synthesis over ResumeKnowledgeBase,
 * and optional serverless LLM proxy synthesis (with automatic local fallback).
 */
export class ResponseEngine {
    constructor(knowledgeBase, memory, config = APP_CONFIG) {
        this.kb = knowledgeBase;
        this.memory = memory;
        this.config = config;
        this.llmCooldownUntil = 0;
    }

    isLlmEnabled() {
        return Boolean(this.config.llmProxyUrl && this.config.llmProxyUrl.trim());
    }

    isLlmInCooldown() {
        return Date.now() < this.llmCooldownUntil;
    }

    async generateReply(rawInput) {
        const input = rawInput.trim();
        if (!input) {
            return { text: this.kb.data.assistant?.fallbackMessage || 'Please ask a question.', mode: 'local', sources: [] };
        }

        const lower = input.toLowerCase();
        const candidateName = this.kb.data.candidate?.shortName || this.kb.data.candidate?.name || 'the candidate';

        // 1. Explicit "remember that X is Y" memory command
        const rememberMatch = input.match(/remember\s+that\s+(.+?)\s+is\s+(.+)/i);
        if (rememberMatch) {
            const subject = rememberMatch[1].trim();
            const fact = rememberMatch[2].replace(/[?.!]+$/, '').trim();
            if (this.memory.rememberNote(subject, fact)) {
                const reply = `Got it! I'll remember that **${subject}** is **${fact}**.`;
                this.memory.addTurn('user', input);
                this.memory.addTurn('assistant', reply);
                return { text: reply, mode: 'memory', sources: [] };
            }
        }

        // 2. Recruiter self-introduction ("My name is Alex", "Call me Sam", "I'm Jordan")
        const introMatch = input.match(/\b(?:my name is|call me|i am|i'm)\s+([a-zA-Z][a-zA-Z'-]{1,24})\b/i);
        if (introMatch) {
            const rawName = introMatch[1];
            if (!COMMON_NON_NAMES.has(rawName.toLowerCase())) {
                const formatted = rawName.charAt(0).toUpperCase() + rawName.slice(1);
                this.memory.setRecruiterName(formatted);
                const reply = `Nice to meet you, **${formatted}**! How can I help you explore ${candidateName}'s experience, skills, or projects?`;
                this.memory.addTurn('user', input);
                this.memory.addTurn('assistant', reply);
                return { text: reply, mode: 'memory', sources: [] };
            }
        }

        // 3. Recall user-stored custom notes
        const note = this.memory.findMatchingNote(input);
        if (note) {
            const reply = `From my notes: **${note.subject}** is **${note.fact}**.`;
            this.memory.addTurn('user', input);
            this.memory.addTurn('assistant', reply);
            return { text: reply, mode: 'memory', sources: [] };
        }

        // 4. Conversational FAQs (greetings, status, weather) defined in resume.json
        const conversationalFaq = this.kb.matchConversationalFaq(input);
        if (conversationalFaq) {
            const reply = this._personalize(conversationalFaq.answer);
            this.memory.addTurn('user', input);
            this.memory.addTurn('assistant', reply, [conversationalFaq.id]);
            return {
                text: reply,
                mode: 'local',
                followUps: this._suggestLocalFollowUps('faq', [conversationalFaq.id])
            };
        }

        // 5. Contextual follow-up ("tell me more", "anything else?")
        const isFollowUp = FOLLOW_UP_PHRASES.some((phrase) => lower === phrase || (lower.includes(phrase) && lower.length <= 36));
        if (isFollowUp) {
            const nextDoc = this.kb.getNextUndiscussed((id) => this.memory.hasDiscussed(id));
            if (nextDoc) {
                const reply = `Here is another highlight from ${candidateName}'s profile:\n\n${this._formatDocument(nextDoc)}`;
                this.memory.addTurn('user', input);
                this.memory.addTurn('assistant', reply, [nextDoc.id]);
                return {
                    text: reply,
                    mode: 'local',
                    followUps: this._suggestLocalFollowUps(nextDoc.type, [nextDoc.id])
                };
            }
            const reply = `We've covered the main highlights of ${candidateName}'s resume! You can ask about a specific company, technology, project, or open the **Resume View** in the top-right corner to browse everything at once.`;
            this.memory.addTurn('user', input);
            this.memory.addTurn('assistant', reply);
            return {
                text: reply,
                mode: 'local',
                followUps: this._suggestLocalFollowUps('summary', [])
            };
        }

        // 6. Retrieve relevant resume documents via BM25/RAG
        const broadSection = this.kb.detectBroadSection(input);
        const searchHits = this.kb.search(input, this.config.topKChunks);

        // 7. Optional live LLM proxy synthesis (falls back seamlessly to local resume.json RAG on quota/error)
        let usedFallback = false;
        if (this.isLlmEnabled() && !this.isLlmInCooldown()) {
            const contextDocs = broadSection
                ? this.kb.getByType(broadSection).map((doc) => ({ doc, score: 1 }))
                : searchHits;
            const llmResult = await this._tryLlmProxy(input, contextDocs);
            if (llmResult && llmResult.reply) {
                const docIds = contextDocs.map((item) => item.doc.id);
                this.memory.addTurn('user', input);
                this.memory.addTurn('assistant', llmResult.reply, docIds);
                const followUps = llmResult.followUps?.length
                    ? llmResult.followUps
                    : this._suggestLocalFollowUps(contextDocs[0]?.doc?.type || 'summary', docIds);
                return {
                    text: llmResult.reply,
                    mode: llmResult.cached ? 'llm-cached' : 'llm',
                    followUps
                };
            }
            usedFallback = true;
        } else if (this.isLlmEnabled() && this.isLlmInCooldown()) {
            usedFallback = true;
        }

        // 8. Local grounded synthesis directly from resume.json
        if (broadSection) {
            const sectionDocs = this.kb.getByType(broadSection);
            if (sectionDocs.length > 0) {
                const reply = this._personalize(this._formatSection(broadSection, sectionDocs));
                const ids = sectionDocs.map((d) => d.id);
                this.memory.addTurn('user', input);
                this.memory.addTurn('assistant', reply, ids);
                return {
                    text: reply,
                    mode: usedFallback ? 'fallback' : 'local',
                    followUps: this._suggestLocalFollowUps(broadSection, ids)
                };
            }
        }

        if (searchHits.length > 0) {
            const topScore = searchHits[0].score;
            const strongHits = searchHits.filter((h, idx) => idx === 0 || h.score >= topScore * 0.58).slice(0, 2);
            const parts = strongHits.map((h) => this._formatDocument(h.doc));
            const reply = this._personalize(parts.join('\n\n'));
            const ids = strongHits.map((h) => h.doc.id);
            this.memory.addTurn('user', input);
            this.memory.addTurn('assistant', reply, ids);
            return {
                text: reply,
                mode: usedFallback ? 'fallback' : 'local',
                followUps: this._suggestLocalFollowUps(strongHits[0].doc.type, ids)
            };
        }

        // 9. Data-driven fallback
        const fallback = this._personalize(
            this.kb.data.assistant?.fallbackMessage ||
            `I couldn't find that in ${candidateName}'s resume data. Try asking about work experience, skills, projects, or education.`
        );
        this.memory.addTurn('user', input);
        this.memory.addTurn('assistant', fallback);
        return {
            text: fallback,
            mode: usedFallback ? 'fallback' : 'local',
            followUps: this._suggestLocalFollowUps('fallback', [])
        };
    }

    async _tryLlmProxy(query, matchedDocs) {
        const controller = new AbortController();
        const timer = setTimeout(() => controller.abort(), this.config.llmTimeoutMs);
        try {
            const response = await fetch(this.config.llmProxyUrl, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                signal: controller.signal,
                body: JSON.stringify({
                    query,
                    cacheVersion: this.kb.getCacheVersion(),
                    recruiterName: this.memory.getRecruiterName(),
                    assistantName: this.kb.data.assistant?.name || 'Assistant',
                    context: this.kb.buildLlmContext(matchedDocs),
                    history: this.memory.getRecentMessages().map((m) => ({ role: m.role, text: m.text }))
                })
            });
            if (response.status === 429) {
                // Quota/rate limit hit: switch cleanly to instant local resume.json answers for 5 minutes
                this.llmCooldownUntil = Date.now() + 5 * 60 * 1000;
                return null;
            }
            if (!response.ok) return null;
            const payload = await response.json();
            if (typeof payload.reply !== 'string' || !payload.reply.trim()) return null;
            return {
                reply: payload.reply.trim(),
                followUps: Array.isArray(payload.followUps) ? payload.followUps : [],
                cached: Boolean(payload.cached)
            };
        } catch {
            return null;
        } finally {
            clearTimeout(timer);
        }
    }

    /**
     * Dynamically derives 2-3 context-aware follow-up questions directly from resume.json
     * when running in local/fallback mode (zero hardcoded candidate facts).
     */
    _suggestLocalFollowUps(currentType, discussedIds = []) {
        const d = this.kb.data;
        const candidates = [];

        if (currentType === 'experience') {
            const firstRole = (d.experience || []).find((r) => !discussedIds.includes(r.id)) || (d.experience || [])[0];
            if (firstRole?.company) {
                candidates.push(`Tell me more about the role at ${firstRole.company}`);
            }
            if ((d.projects || []).length) candidates.push(`Tell me about ${d.projects[0].title}`);
            if ((d.skills || []).length) candidates.push('What is the core technical stack?');
        } else if (currentType === 'narrative') {
            for (const n of d.narrative || []) {
                if (!discussedIds.includes(n.id)) candidates.push(`Tell me about: ${n.title}`);
            }
            if ((d.projects || []).length) candidates.push('What AI and automation projects have been built?');
            if ((d.education || []).length) candidates.push('What is the educational background?');
        } else if (currentType === 'project') {
            if ((d.narrative || []).length) candidates.push(`Tell me about: ${d.narrative[0].title}`);
            if ((d.experience || []).length) candidates.push('Walk me through the work history');
            if ((d.skills || []).length) candidates.push('What is the core technical stack?');
        } else if (currentType === 'education') {
            if ((d.narrative || []).length) candidates.push(`Tell me about: ${d.narrative[0].title}`);
            if ((d.projects || []).length) candidates.push('What technical projects have been built?');
            if ((d.experience || []).length) candidates.push('Tell me about the work experience');
        } else if (currentType === 'skills') {
            if ((d.experience || []).length) candidates.push('How were these skills applied in past roles?');
            if ((d.projects || []).length) candidates.push('What recent technical projects showcase these skills?');
            if (d.candidate?.links) candidates.push('How can I get in touch?');
        }

        // Fill up to 3 from resume.json suggestedPrompts
        for (const p of d.assistant?.suggestedPrompts || []) {
            if (candidates.length >= 3) break;
            if (p.query && !candidates.includes(p.query)) {
                candidates.push(p.query);
            }
        }

        return [...new Set(candidates)].slice(0, 3);
    }

    _personalize(text) {
        const name = this.memory.getRecruiterName();
        if (!name || text.includes(name)) return text;
        // Gently personalize without being repetitive
        if (this.memory.messages.length % 4 === 0) {
            return `${name}, ${text.charAt(0).toLowerCase()}${text.slice(1)}`;
        }
        return text;
    }

    _sectionLabel(type) {
        const labels = {
            experience: 'Work History',
            education: 'Education',
            skills: 'Technical Stack',
            project: 'Projects & Initiatives',
            contact: 'Contact & Links'
        };
        return labels[type] || type;
    }

    _formatSection(type, docs) {
        const c = this.kb.data.candidate || {};
        const name = c.shortName || c.name || 'Candidate';

        if (type === 'experience') {
            const lines = docs.map((d) => {
                const r = d.payload;
                return `- **${r.title}** — ${r.company} (${r.location}, ${r.period})\n  ${r.summary}`;
            });
            const companies = [...new Set(docs.map((d) => d.payload.company).filter(Boolean))].slice(0, 3);
            const hint = companies.length
                ? `\n\nAsk about any specific company (e.g., ${companies.join(', ')}) for full details.`
                : '';
            const expLabel = c.yearsExperience ? ` (${c.yearsExperience} years experience)` : '';
            return `Here is ${name}'s **work history**${expLabel}:\n\n${lines.join('\n')}${hint}`;
        }

        if (type === 'education') {
            const lines = docs.map((d) => {
                const e = d.payload;
                const spec = e.specialization && !e.degree.includes(e.specialization) ? ` — *${e.specialization}*` : '';
                return `- **${e.degree}**${spec}\n  ${e.institution}, ${e.location} (${e.period})`;
            });
            return `Here is ${name}'s **educational background**:\n\n${lines.join('\n')}`;
        }

        if (type === 'skills') {
            const lines = docs.map((d) => `- **${d.payload.category}:** ${d.payload.items.join(', ')}`);
            return `Here is ${name}'s **technical stack**:\n\n${lines.join('\n')}`;
        }

        if (type === 'project') {
            const blocks = docs.map((d) => this._formatDocument(d));
            return `Here are ${name}'s **key technical projects**:\n\n${blocks.join('\n\n')}`;
        }

        if (type === 'contact') {
            return this._formatDocument(docs[0]);
        }

        return docs.map((d) => this._formatDocument(d)).join('\n\n');
    }

    _formatDocument(doc) {
        const p = doc.payload;

        if (doc.type === 'summary') {
            const alt = p.alternateName ? ` (${p.alternateName})` : '';
            return `**${p.name}${alt}** — *${p.title}* (${p.location})\n\n${p.summary}`;
        }

        if (doc.type === 'value') {
            return `**Why ${p.shortName || p.name}?**\n\n${p.valueProposition}`;
        }

        if (doc.type === 'contact') {
            const links = p.links || {};
            const lines = [`**Contact ${p.name}** (${p.location})`];
            if (links.email) lines.push(`- **Email:** ${links.email}`);
            if (links.linkedin) lines.push(`- **LinkedIn:** ${links.linkedin}`);
            if (links.github) lines.push(`- **GitHub:** ${links.github}`);
            if (p.references) lines.push(`- **References:** ${p.references}`);
            return lines.join('\n');
        }

        if (doc.type === 'experience') {
            const bullets = (p.highlights || []).map((h) => `- ${h}`).join('\n');
            const tech = p.technologies?.length ? `\n**Tech:** ${p.technologies.join(', ')}` : '';
            return `**${p.title} — ${p.company}** (${p.location} | ${p.period})\n${bullets}${tech}`;
        }

        if (doc.type === 'project') {
            const bullets = (p.highlights || []).map((h) => `- ${h}`).join('\n');
            const tech = p.technologies?.length ? `\n**Stack:** ${p.technologies.join(', ')}` : '';
            return `**${p.title}** (${p.period})\n${bullets}${tech}`;
        }

        if (doc.type === 'education') {
            const spec = p.specialization && !p.degree.includes(p.specialization) ? ` (${p.specialization})` : '';
            const notes = (p.notes || []).map((n) => `- ${n}`).join('\n');
            return `**${p.degree}${spec}**\n${p.institution}, ${p.location} (${p.period})${notes ? `\n${notes}` : ''}`;
        }

        if (doc.type === 'skills') {
            return `**${p.category}**\n${(p.items || []).join(' • ')}`;
        }

        if (doc.type === 'narrative') {
            const bullets = (p.details || []).map((item) => `- ${item}`).join('\n');
            return `**${p.title}**\n\n${p.summary}${bullets ? `\n\n${bullets}` : ''}`;
        }

        if (doc.type === 'faq') {
            return p.answer;
        }

        return doc.title;
    }
}
