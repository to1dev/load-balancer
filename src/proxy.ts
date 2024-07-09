const allowedOrigins = ['https://arc20.me', 'http://localhost:5173'];
const apiServers = ['https://ep.wizz.cash/proxy', 'https://ep.atomicalmarket.com/proxy'];

function getAllowedOrigin(origin: string | null): string {
    if (origin && allowedOrigins.includes(origin)) {
        return origin;
    }
    return '';
}

export default {
    async fetch(request, env, ctx): Promise<Response> {
        const url = new URL(request.url);
        let path = url.pathname.replace(/^\/proxy/, '');
        if (url.search) {
            path += url.search;
        }
        const cacheKey = `cache:${path}`;
        const origin = request.headers.get('Origin');
        const allowedOrigin = getAllowedOrigin(origin);

        const cachedData = await env.api.get(cacheKey, { type: 'json' });
        if (cachedData) {
            return new Response(JSON.stringify(cachedData), {
                headers: {
                    'Access-Control-Allow-Origin': allowedOrigin,
                    'Content-Type': 'application/json',
                    'Cache-Control': 'public, max-age=600',
                },
            });
        }

        for (let i = 0; i < apiServers.length; i++) {
            const randomIndex = Math.floor(Math.random() * apiServers.length);
            const apiUrl = `${apiServers[randomIndex]}${path}`;
            const newRequest = new Request(apiUrl, request);

            try {
                const response = await fetch(newRequest);
                if (response.ok) {
                    const data = await response.json();

                    ctx.waitUntil(env.api.put(cacheKey, JSON.stringify(data), { expirationTtl: 600 }));

                    return new Response(JSON.stringify(data), {
                        headers: {
                            'Access-Control-Allow-Origin': allowedOrigin,
                            'Content-Type': 'application/json',
                            'X-Indexer': apiServers[randomIndex],
                        },
                    });
                } else {
                    console.warn(`Server ${apiUrl} responded with status ${response.status}`);
                }
            } catch (error) {
                console.error(`Error fetching from ${apiUrl}:`, error);
            }
        }

        return new Response('All API servers are unavailable', { status: 503 });
    },
} satisfies ExportedHandler<Env>;
