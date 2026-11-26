# Hsiang Resume AI (Ruby)

Data-driven interactive resume assistant built with zero build tools so it deploys directly on **GitHub Pages**.

Live URL: https://arlyan-hsiang.github.io/Hsiang-Resume-AI/

## Architecture

All candidate details, skills, work history, education, projects, FAQs, and assistant branding live in a single JSON file (`data/resume.json`) — there is **no hardcoded resume content** in the HTML or JavaScript.

```text
├── index.html                  # Semantic UI shell
├── css/styles.css              # Styling & animations
├── data/resume.json            # Single source of truth (edit this to update everything)
├── js/
│   ├── config.js               # Runtime settings & optional LLM proxy URL
│   ├── knowledgeBase.js        # Dynamic JSON indexer + BM25 + synonym + fuzzy search
│   ├── memory.js               # Browser localStorage memory & conversation state
│   ├── responseEngine.js       # Local grounded RAG synthesizer + optional LLM proxy client
│   ├── ui.js                   # XSS-safe chat UI + dynamic Resume quick-view modal
│   └── main.js                 # App bootstrap
├── cloudflare-worker/worker.js # Optional free-tier Gemini proxy (keeps API keys private)
├── ruby_cat_avatar.png         # Assistant avatar
└── .nojekyll                   # Clean GitHub Pages static serving
```

## Updating Resume Content

Edit [`data/resume.json`](./data/resume.json). Updating this single file automatically updates:
- The chat knowledge base and BM25 search index
- Suggested quick-prompt chips
- The header branding and welcome message
- The interactive **Resume** drawer modal

## Local Development

Because the app uses native ES modules and `fetch('./data/resume.json')`, serve it over HTTP rather than opening `index.html` via `file://`:

```bash
python -m http.server 8000
```

Then open `http://localhost:8000`.

## Deploying on GitHub Pages

1. Push to `main`.
2. In GitHub repo **Settings → Pages**, set source to **Deploy from a branch** → `main` / `/ (root)`.
3. All asset paths are relative (`./...`), so the site works seamlessly on `https://<username>.github.io/Hsiang-Resume-AI/`.

## Connecting Live Gemini AI (Free Tier, Keeps Frontend on GitHub Pages)

The app works 100% statically out of the box. To enable live **Gemini 2.5 Flash** synthesis while keeping your API key completely private:

1. Get a free Gemini API key from [Google AI Studio](https://aistudio.google.com/apikey).
2. In [Cloudflare Workers](https://dash.cloudflare.com/) → **Workers & Pages** → **Create Worker**:
   - Paste the contents of [`cloudflare-worker/worker.js`](./cloudflare-worker/worker.js) and click **Deploy**.
   - Go to **Settings → Variables and Secrets** and add:
     - **Secret:** `GEMINI_API_KEY` = your Google AI Studio key
     - **Variable:** `ALLOWED_ORIGIN` = `https://arlyan-hsiang.github.io`
3. Copy your Worker URL (e.g. `https://hsiang-resume-ai-proxy.<your-subdomain>.workers.dev`) into `llmProxyUrl` in [`js/config.js`](./js/config.js) and push to `main`.

If the Worker is ever unreachable or rate-limited, the app automatically falls back to the local BM25 RAG engine without breaking.
