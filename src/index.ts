interface Env {
    api: KVNamespace;
}

const apiServers = ['https://ep.wizz.cash/proxy', 'https://ep.atomicalmarket.com/proxy'];

export default {
    async fetch(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
        const url = new URL(request.url);
        const path = url.pathname === '/' ? '' : url.pathname + url.search;
        const cacheKey = `cache:${path}`;

        // 尝试从 KV 获取缓存的数据
        const cachedData = await env.api.get(cacheKey, { type: 'json' });
        if (cachedData) {
            return new Response(JSON.stringify(cachedData), {
                headers: {
                    'Access-Control-Allow-Origin': '*',
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

                    // 异步缓存数据到 KV
                    ctx.waitUntil(env.api.put(cacheKey, JSON.stringify(data), { expirationTtl: 600 }));

                    return new Response(JSON.stringify(data), {
                        headers: {
                            'Access-Control-Allow-Origin': '*',
                            'Content-Type': 'application/json',
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
