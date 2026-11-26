/**
 * Optional Cloudflare Worker LLM Proxy (Free Tier Friendly)
 *
 * Keeps your Gemini API key securely out of the public GitHub Pages repo.
 * Deploy this to Cloudflare Workers, set secret `GEMINI_API_KEY`, and paste
 * the worker URL into `js/config.js` (`llmProxyUrl`).
 *
 * Without this worker, the GitHub Pages app still runs 100% statically using
 * its built-in client-side BM25 RAG engine.
 */
export default {
    async fetch(request, env) {
        const origin = request.headers.get('Origin') || '*';
        const allowedOrigin = env.ALLOWED_ORIGIN || origin;
        const corsHeaders = {
            'Access-Control-Allow-Origin': allowedOrigin,
            'Access-Control-Allow-Methods': 'POST, OPTIONS',
            'Access-Control-Allow-Headers': 'Content-Type'
        };

        if (request.method === 'OPTIONS') {
            return new Response(null, { status: 204, headers: corsHeaders });
        }

        if (request.method !== 'POST') {
            return new Response(JSON.stringify({ error: 'Method not allowed' }), {
                status: 405,
                headers: { ...corsHeaders, 'Content-Type': 'application/json' }
            });
        }

        try {
            const { query, recruiterName, assistantName, context, history = [] } = await request.json();
            if (!query || typeof query !== 'string') {
                return new Response(JSON.stringify({ error: 'Missing query' }), {
                    status: 400,
                    headers: { ...corsHeaders, 'Content-Type': 'application/json' }
                });
            }

            const model = env.GEMINI_MODEL || 'gemini-2.5-flash';
            const systemInstruction = [
                `You are ${assistantName || 'Ruby'}, a concise, friendly, professional interactive resume assistant.`,
                'Answer ONLY using the resume facts provided in the context below. Never invent experience, dates, or credentials.',
                'If the answer is not in the context, state that honestly and suggest what topics the recruiter can ask about.',
                recruiterName ? `The recruiter's name is ${recruiterName}.` : '',
                '',
                'RESUME CONTEXT:',
                context || ''
            ].join('\n');

            const contents = [
                ...history.slice(-6).map((m) => ({
                    role: m.role === 'assistant' ? 'model' : 'user',
                    parts: [{ text: m.text }]
                })),
                { role: 'user', parts: [{ text: query }] }
            ];

            const apiRes = await fetch(
                `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${env.GEMINI_API_KEY}`,
                {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        systemInstruction: { parts: [{ text: systemInstruction }] },
                        contents,
                        generationConfig: {
                            temperature: 0.3,
                            maxOutputTokens: 400
                        }
                    })
                }
            );

            if (!apiRes.ok) {
                return new Response(JSON.stringify({ error: 'Upstream LLM error' }), {
                    status: 502,
                    headers: { ...corsHeaders, 'Content-Type': 'application/json' }
                });
            }

            const data = await apiRes.json();
            const reply = data?.candidates?.[0]?.content?.parts?.[0]?.text || '';

            return new Response(JSON.stringify({ reply }), {
                status: 200,
                headers: { ...corsHeaders, 'Content-Type': 'application/json' }
            });
        } catch (err) {
            return new Response(JSON.stringify({ error: 'Invalid request' }), {
                status: 400,
                headers: { ...corsHeaders, 'Content-Type': 'application/json' }
            });
        }
    }
};
