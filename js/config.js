/**
 * Runtime configuration for the Resume Assistant.
 *
 * GitHub Pages deployment works 100% out of the box with `llmProxyUrl: ""`
 * (client-side BM25/RAG engine over `./data/resume.json`).
 *
 * Optional upgrade: deploy `./cloudflare-worker/worker.js` to Cloudflare Workers
 * (free tier) and paste its URL into `llmProxyUrl` to enable live LLM synthesis
 * without exposing any API keys in this public repository.
 */
export const APP_CONFIG = {
    resumeDataUrl: './data/resume.json',
    llmProxyUrl: 'https://hsiang-resume-ai-proxy.htse856.workers.dev',
    llmTimeoutMs: 12000,
    topKChunks: 4,
    typingDelayMs: 320,
    maxHistoryTurns: 10,
    storageKeys: {
        recruiterName: 'ruby_recruiter_name',
        customNotes: 'ruby_custom_notes'
    }
};
