const STOP_WORDS = new Set([
    'a', 'an', 'the', 'is', 'are', 'was', 'were', 'be', 'been', 'being',
    'to', 'of', 'in', 'on', 'at', 'for', 'with', 'about', 'by', 'from',
    'as', 'into', 'like', 'through', 'after', 'over', 'between', 'out',
    'against', 'during', 'without', 'before', 'under', 'around', 'among',
    'and', 'or', 'but', 'if', 'then', 'else', 'when', 'where', 'how',
    'what', 'which', 'who', 'whom', 'this', 'that', 'these', 'those',
    'do', 'does', 'did', 'have', 'has', 'had', 'can', 'could', 'would',
    'should', 'will', 'shall', 'may', 'might', 'must', 'me', 'my', 'your',
    'she', 'her', 'hers', 'he', 'him', 'his', 'they', 'them', 'their',
    'it', 'its', 'you', 'we', 'us', 'our', 'tell', 'give', 'show', 'know',
    'please', 'any', 'some', 'all'
]);

/**
 * Tokenizes text while preserving tech identifiers like "c#", ".net", "ci/cd", "asp.net".
 */
export function tokenize(text) {
    if (!text) return [];
    const normalized = String(text)
        .toLowerCase()
        .replace(/c#/g, 'csharp')
        .replace(/\.net/g, 'dotnet')
        .replace(/ci\/cd/g, 'cicd')
        .replace(/asp\.net/g, 'aspnet')
        .replace(/vb\.net/g, 'vbnet')
        .replace(/[^a-z0-9+\-\s]/g, ' ');

    return normalized
        .split(/\s+/)
        .map((t) => t.replace(/^-+|-+$/g, ''))
        .filter((t) => t.length >= 2 && !STOP_WORDS.has(t));
}

function levenshtein(a, b) {
    if (a === b) return 0;
    if (Math.abs(a.length - b.length) > 2) return 3;
    const prev = Array.from({ length: b.length + 1 }, (_, i) => i);
    for (let i = 1; i <= a.length; i++) {
        let diag = prev[0];
        prev[0] = i;
        for (let j = 1; j <= b.length; j++) {
            const temp = prev[j];
            const cost = a[i - 1] === b[j - 1] ? 0 : 1;
            prev[j] = Math.min(prev[j] + 1, prev[j - 1] + 1, diag + cost);
            diag = temp;
        }
    }
    return prev[b.length];
}

/**
 * Data-driven BM25 + Synonym + Fuzzy Search Knowledge Base.
 * Builds its entire index dynamically from `resume.json` with zero hardcoded resume content.
 */
export class ResumeKnowledgeBase {
    constructor(resumeData) {
        this.data = resumeData;
        this.documents = [];
        this.synonymIndex = new Map();
        this.docFreq = new Map();
        this.avgDocLength = 0;

        this._buildSynonymIndex(resumeData.synonyms || []);
        this._indexResumeData(resumeData);
        this._computeStats();
        this.cacheVersion = this._computeContentVersion(resumeData);
    }

    /**
     * Computes a deterministic FNV-1a content hash of resume.json so edge KV caches
     * automatically invalidate whenever resume.json is edited — with zero manual version bumps.
     */
    _computeContentVersion(data) {
        const str = JSON.stringify(data);
        let hash = 0x811c9dc5;
        for (let i = 0; i < str.length; i++) {
            hash ^= str.charCodeAt(i);
            hash = Math.imul(hash, 0x01000193);
        }
        const hex = (hash >>> 0).toString(16).padStart(8, '0');
        return `${data.schemaVersion || '1'}-${hex}`;
    }

    getCacheVersion() {
        return this.cacheVersion;
    }

    _buildSynonymIndex(groups) {
        for (const group of groups) {
            const normalizedTokens = group.flatMap((term) => tokenize(term));
            const unique = [...new Set(normalizedTokens)];
            for (const token of unique) {
                const existing = this.synonymIndex.get(token) || new Set();
                for (const peer of unique) {
                    if (peer !== token) existing.add(peer);
                }
                this.synonymIndex.set(token, existing);
            }
        }
    }

    _addDocument(doc) {
        const titleTokens = tokenize(doc.title);
        const bodyTokens = tokenize(doc.searchText);
        const tagTokens = tokenize((doc.tags || []).join(' '));
        const allTokens = [...titleTokens, ...titleTokens, ...tagTokens, ...tagTokens, ...bodyTokens];

        const termFreq = new Map();
        for (const token of allTokens) {
            termFreq.set(token, (termFreq.get(token) || 0) + 1);
        }

        this.documents.push({
            ...doc,
            tokens: allTokens,
            termFreq,
            length: allTokens.length || 1
        });
    }

    _indexResumeData(data) {
        const c = data.candidate || {};

        if (c.summary) {
            this._addDocument({
                id: 'profile-summary',
                type: 'summary',
                title: `${c.name || 'Candidate'} — Profile Summary`,
                searchText: [c.name, c.shortName, c.alternateName, c.title, c.headline, c.location, c.summary].filter(Boolean).join(' '),
                tags: ['profile', 'summary', 'about', 'bio', 'overview', 'who', 'introduction', 'background', 'name', ...(c.alternateName ? tokenize(c.alternateName) : [])],
                payload: c
            });
        }

        if (c.valueProposition) {
            this._addDocument({
                id: 'profile-value',
                type: 'value',
                title: 'Unique Value Proposition',
                searchText: [c.valueProposition, c.headline, c.yearsExperience].join(' '),
                tags: ['value', 'why', 'hire', 'strengths', 'unique', 'fit', 'advantage', 'benefit', 'special'],
                payload: c
            });
        }

        if (c.links) {
            this._addDocument({
                id: 'profile-contact',
                type: 'contact',
                title: 'Contact & Links',
                searchText: [c.name, c.location, c.links.email, c.links.linkedin, c.links.github, c.references].join(' '),
                tags: ['contact', 'email', 'linkedin', 'github', 'links', 'reach', 'connect', 'location', 'auckland'],
                payload: c
            });
        }

        for (const role of data.experience || []) {
            this._addDocument({
                id: role.id,
                type: 'experience',
                title: `${role.title} at ${role.company}`,
                searchText: [
                    role.title,
                    role.company,
                    role.location,
                    role.period,
                    role.domain,
                    role.summary,
                    ...(role.highlights || []),
                    ...(role.technologies || []),
                    ...(role.clients || [])
                ].join(' '),
                tags: ['experience', 'work', 'career', 'history', 'role', 'job', ...(role.tags || [])],
                payload: role
            });
        }

        for (const project of data.projects || []) {
            this._addDocument({
                id: project.id,
                type: 'project',
                title: project.title,
                searchText: [
                    project.title,
                    project.period,
                    project.summary,
                    ...(project.highlights || []),
                    ...(project.technologies || [])
                ].join(' '),
                tags: ['project', 'projects', 'initiative', 'portfolio', 'built', ...(project.tags || [])],
                payload: project
            });
        }

        for (const edu of data.education || []) {
            this._addDocument({
                id: edu.id,
                type: 'education',
                title: `${edu.degree}${edu.specialization ? ` (${edu.specialization})` : ''}`,
                searchText: [
                    edu.degree,
                    edu.specialization,
                    edu.institution,
                    edu.location,
                    edu.period,
                    ...(edu.notes || [])
                ].join(' '),
                tags: ['education', 'degree', 'university', 'study', 'academic', 'qualification', ...(edu.tags || [])],
                payload: edu
            });
        }

        for (const skillGroup of data.skills || []) {
            this._addDocument({
                id: skillGroup.id,
                type: 'skills',
                title: skillGroup.category,
                searchText: [skillGroup.category, ...(skillGroup.items || [])].join(' '),
                tags: ['skills', 'tech', 'stack', 'tools', 'technologies', ...(skillGroup.tags || [])],
                payload: skillGroup
            });
        }

        for (const item of data.narrative || []) {
            this._addDocument({
                id: item.id,
                type: 'narrative',
                title: item.title,
                searchText: [item.title, item.summary, ...(item.details || [])].join(' '),
                tags: ['story', 'motivation', 'narrative', ...(item.tags || [])],
                payload: item
            });
        }

        for (const faq of data.faqs || []) {
            this._addDocument({
                id: faq.id,
                type: 'faq',
                title: faq.title,
                searchText: [faq.title, ...(faq.keywords || []), faq.answer].join(' '),
                tags: faq.keywords || [],
                payload: faq
            });
        }
    }

    _computeStats() {
        let totalLength = 0;
        for (const doc of this.documents) {
            totalLength += doc.length;
            for (const term of doc.termFreq.keys()) {
                this.docFreq.set(term, (this.docFreq.get(term) || 0) + 1);
            }
        }
        this.avgDocLength = this.documents.length ? totalLength / this.documents.length : 1;
    }

    _idf(term) {
        const n = this.documents.length;
        const df = this.docFreq.get(term) || 0;
        return Math.log(1 + (n - df + 0.5) / (df + 0.5));
    }

    /**
     * Detect if the user is asking broadly for an entire resume section
     * (e.g., "work history", "all education", "tech stack", "projects", "contact").
     */
    detectBroadSection(query) {
        const q = query.toLowerCase();
        const tokens = tokenize(query);

        const sectionMatchers = [
            { type: 'contact', terms: ['contact', 'email', 'linkedin', 'github', 'reach', 'connect'] },
            { type: 'education', terms: ['education', 'degree', 'degrees', 'university', 'academic', 'qualification', 'qualifications', 'study', 'studying'] },
            { type: 'skills', terms: ['stack', 'skills', 'skill', 'technologies', 'tech'] },
            { type: 'experience', terms: ['experience', 'history', 'career', 'roles', 'jobs', 'work'] },
            { type: 'project', terms: ['projects', 'project', 'initiatives', 'portfolio'] }
        ];

        // Dynamically derive specific entities (companies, clients, technologies, institutions, specializations)
        // from resume.json so asking about a specific entity triggers targeted ranked retrieval instead of a broad dump.
        const specificEntities = new Set(
            [
                ...(this.data.experience || []).flatMap((r) => [
                    r.company,
                    r.location,
                    ...(r.clients || []),
                    ...(r.technologies || []),
                    ...(r.tags || [])
                ]),
                ...(this.data.projects || []).flatMap((p) => [
                    ...(p.technologies || []),
                    ...(p.tags || [])
                ]),
                ...(this.data.education || []).flatMap((e) => [
                    e.institution,
                    e.specialization,
                    e.location
                ]),
                ...(this.data.skills || []).flatMap((s) => s.items || [])
            ]
                .filter(Boolean)
                .flatMap((val) => {
                    const lower = String(val).toLowerCase();
                    return [lower, ...lower.split(/[\s(),/]+/)];
                })
                .filter((token) => token.length >= 3 && !sectionMatchers.some((m) => m.terms.includes(token)) && !['current', 'senior', 'project', 'projects', 'education', 'master', 'bachelor', 'university', 'work', 'experience', 'skills', 'stack', 'tech', 'ai', 'new', 'zealand'].includes(token))
        );

        const mentionsSpecific = [...specificEntities].some((entity) => {
            const escaped = entity.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
            return new RegExp(`\\b${escaped}\\b`, 'i').test(q);
        });
        if (mentionsSpecific) return null;

        // If asking an open-ended motivation/vision/leadership question, use ranked BM25 retrieval instead of a broad section dump
        const reasoningTerms = ['why', 'reason', 'motivation', 'goal', 'goals', 'vision', 'future', 'enterprise', 'trend', 'style', 'approach', 'hire', 'value', 'unique', 'strengths', 'fit'];
        if (tokens.some((t) => reasoningTerms.includes(t)) || /\bwhy\b/i.test(q)) {
            return null;
        }

        for (const matcher of sectionMatchers) {
            if (tokens.some((t) => matcher.terms.includes(t))) {
                return matcher.type;
            }
        }
        return null;
    }

    /**
     * Exact phrase match check for conversational FAQs (greetings, how are you, weather).
     */
    matchConversationalFaq(query) {
        const normalized = query.toLowerCase().replace(/[?!.,]/g, '').trim();
        const words = normalized.split(/\s+/);

        for (const faq of this.data.faqs || []) {
            if (faq.category !== 'conversational') continue;
            for (const kw of faq.keywords || []) {
                const kwNorm = kw.toLowerCase();
                if (kwNorm.includes(' ')) {
                    if (normalized.includes(kwNorm)) return faq;
                } else if (words.length <= 4 && words.includes(kwNorm)) {
                    return faq;
                }
            }
        }
        return null;
    }

    /**
     * Searches all indexed documents using BM25 + synonym expansion + fuzzy token fallback.
     */
    search(query, topK = 4) {
        const queryTokens = tokenize(query);
        if (queryTokens.length === 0) return [];

        const k1 = 1.4;
        const b = 0.65;
        const queryLower = query.toLowerCase();

        // Build weighted query terms (original terms = 1.0, synonyms = 0.45)
        const weightedTerms = new Map();
        for (const token of queryTokens) {
            weightedTerms.set(token, Math.max(weightedTerms.get(token) || 0, 1.0));
            const syns = this.synonymIndex.get(token);
            if (syns) {
                for (const syn of syns) {
                    weightedTerms.set(syn, Math.max(weightedTerms.get(syn) || 0, 0.45));
                }
            }
        }

        const scored = [];
        for (const doc of this.documents) {
            if (doc.type === 'faq' && doc.payload?.category === 'conversational') {
                continue;
            }

            let score = 0;
            const docTerms = [...doc.termFreq.keys()];

            for (const [term, weight] of weightedTerms.entries()) {
                let tf = doc.termFreq.get(term) || 0;
                let matchMultiplier = 1.0;

                // Prefix / fuzzy match for typos on original query tokens
                if (tf === 0 && weight >= 1.0 && term.length >= 4) {
                    const fuzzyTerm = docTerms.find(
                        (dt) =>
                            (dt.startsWith(term) && dt.length <= term.length + 2) ||
                            (term.startsWith(dt) && term.length <= dt.length + 2) ||
                            (dt.length >= 4 && levenshtein(term, dt) <= 1)
                    );
                    if (fuzzyTerm) {
                        tf = doc.termFreq.get(fuzzyTerm);
                        matchMultiplier = 0.7;
                    }
                }

                if (tf > 0) {
                    const idf = this._idf(term);
                    const bm25 = (idf * tf * (k1 + 1)) / (tf + k1 * (1 - b + (b * doc.length) / this.avgDocLength));
                    score += bm25 * weight * matchMultiplier;
                }
            }

            // Phrase boost if title or company name appears directly in query
            const titleLower = doc.title.toLowerCase();
            if (titleLower.length > 3 && queryLower.includes(titleLower)) {
                score += 3.0;
            }
            if (doc.payload?.company && queryLower.includes(doc.payload.company.toLowerCase())) {
                score += 2.5;
            }

            if (score > 0.25) {
                scored.push({ doc, score });
            }
        }

        scored.sort((a, b) => b.score - a.score);
        return scored.slice(0, topK);
    }

    getByType(type) {
        return this.documents.filter((d) => d.type === type);
    }

    getNextUndiscussed(discussedChecker) {
        const priorityTypes = ['narrative', 'value', 'project', 'education', 'experience', 'skills'];
        for (const type of priorityTypes) {
            const candidate = this.documents.find((d) => d.type === type && !discussedChecker(d.id));
            if (candidate) return candidate;
        }
        return null;
    }

    /**
     * Produces a compact structured resume digest + focused search hits for the LLM proxy.
     * Keeps all context grounded in resume.json without exceeding ~2,000 tokens.
     */
    buildLlmContext(matchedDocs = []) {
        const d = this.data;
        const c = d.candidate || {};
        const sections = [
            `CANDIDATE: ${c.name || ''}${c.alternateName ? ` (also known as ${c.alternateName})` : ''} | ${c.title || ''} | ${c.location || ''} | ${c.yearsExperience || ''} yrs exp`,
            `HEADLINE: ${c.headline || ''}`,
            `SUMMARY: ${c.summary || ''}`,
            `VALUE PROPOSITION: ${c.valueProposition || ''}`,
            c.links ? `LINKS: Email=${c.links.email || ''}, LinkedIn=${c.links.linkedin || ''}, GitHub=${c.links.github || ''}` : ''
        ];

        if ((d.narrative || []).length) {
            sections.push(
                'MOTIVATION & CAREER VISION:\n' +
                d.narrative.map((n) => `- ${n.title}: ${n.summary} ${(n.details || []).join(' ')}`).join('\n')
            );
        }

        if ((d.experience || []).length) {
            sections.push(
                'EXPERIENCE:\n' +
                d.experience
                    .map((r) => `- ${r.title} at ${r.company} (${r.location}, ${r.period}): ${(r.highlights || []).join(' ')} [Tech: ${(r.technologies || []).join(', ')}]`)
                    .join('\n')
            );
        }

        if ((d.projects || []).length) {
            sections.push(
                'PROJECTS:\n' +
                d.projects
                    .map((p) => `- ${p.title} (${p.period}): ${p.summary} ${(p.highlights || []).join(' ')} [Stack: ${(p.technologies || []).join(', ')}]`)
                    .join('\n')
            );
        }

        if ((d.education || []).length) {
            sections.push(
                'EDUCATION:\n' +
                d.education
                    .map((e) => `- ${e.degree}${e.specialization ? ` (${e.specialization})` : ''} — ${e.institution}, ${e.location} (${e.period}) ${(e.notes || []).join(' ')}`)
                    .join('\n')
            );
        }

        if ((d.skills || []).length) {
            sections.push(
                'SKILLS:\n' +
                d.skills.map((s) => `- ${s.category}: ${(s.items || []).join(', ')}`).join('\n')
            );
        }

        if (matchedDocs.length) {
            sections.push(
                'MOST RELEVANT RETRIEVED TOPICS:\n' +
                matchedDocs.map((item) => `- [${item.doc.type}] ${item.doc.title}`).join('\n')
            );
        }

        return sections.filter(Boolean).join('\n\n');
    }
}
