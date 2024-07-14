import handleProxy from './proxy';
import apiRouter from './router';

export default {
    async fetch(request, env, ctx): Promise<Response> {
        const url = new URL(request.url);

        if (url.pathname.startsWith('/proxy')) {
            return handleProxy.fetch(request, env, ctx);
        }

        if (url.pathname.startsWith('/api')) {
            return apiRouter.handle(request, env, ctx);
        }

        return new Response('hello world', { headers: { 'Content-Type': 'text/plain' } });
    },
} satisfies ExportedHandler<Env>;
