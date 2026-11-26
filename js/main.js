import { APP_CONFIG } from './config.js';
import { ConversationMemory } from './memory.js';
import { ResumeKnowledgeBase } from './knowledgeBase.js';
import { ResponseEngine } from './responseEngine.js';
import { ChatUI } from './ui.js';

async function bootstrap() {
    try {
        const response = await fetch(APP_CONFIG.resumeDataUrl, { cache: 'no-cache' });
        if (!response.ok) {
            throw new Error(`Failed to load ${APP_CONFIG.resumeDataUrl} (${response.status})`);
        }
        const resumeData = await response.json();

        const memory = new ConversationMemory();
        const kb = new ResumeKnowledgeBase(resumeData);
        const engine = new ResponseEngine(kb, memory, APP_CONFIG);
        const ui = new ChatUI(resumeData);

        ui.applyBranding(engine.isLlmEnabled());
        ui.renderWelcome(memory.getRecruiterName());
        ui.renderResumeDrawer();

        let isBusy = false;

        const handleQuery = async (query) => {
            if (isBusy) return;
            isBusy = true;
            ui.addUserMessage(query);
            ui.showTyping();

            try {
                const start = Date.now();
                const result = await engine.generateReply(query);
                const elapsed = Date.now() - start;
                const remaining = Math.max(0, APP_CONFIG.typingDelayMs - elapsed);
                if (remaining > 0) {
                    await new Promise((resolve) => setTimeout(resolve, remaining));
                }
                ui.hideTyping();
                ui.addAssistantMessage(result.text, result.sources);
            } catch (err) {
                console.error('Reply error:', err);
                ui.hideTyping();
                ui.addAssistantMessage('Something went wrong while generating a reply. Please try again.');
            } finally {
                isBusy = false;
                ui.els.input.focus();
            }
        };

        ui.renderSuggestions(handleQuery);
        ui.bindEvents({
            onSend: handleQuery,
            onReset: () => {
                memory.clear();
                ui.renderWelcome(null);
            }
        });
    } catch (error) {
        console.error('Initialization failed:', error);
        const chatWindow = document.getElementById('chat-window');
        if (chatWindow) {
            chatWindow.innerHTML = `
                <div class="bg-red-50 border border-red-200 text-red-700 p-4 rounded-2xl text-sm">
                    <strong>Unable to load resume data.</strong><br>
                    Make sure this site is served over HTTP/HTTPS (e.g., GitHub Pages or <code>python -m http.server</code>) so <code>./data/resume.json</code> can be fetched.
                </div>
            `;
        }
    }
}

if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', bootstrap);
} else {
    bootstrap();
}
