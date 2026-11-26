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

## Optional: Connecting a Live LLM (Free Tier)

The app works 100% statically out of the box. If you also want generative LLM phrasing while keeping the frontend on GitHub Pages:

1. Deploy `cloudflare-worker/worker.js` to Cloudflare Workers.
2. Add your `GEMINI_API_KEY` as a Worker secret (and optionally set `ALLOWED_ORIGIN=https://arlyan-hsiang.github.io`).
3. Paste the Worker URL into `llmProxyUrl` in `js/config.js`.

If the Worker is ever unreachable or rate-limited, the app automatically falls back to the local BM25 RAG engine.
