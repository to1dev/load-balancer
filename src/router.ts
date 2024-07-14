import { Router } from 'itty-router';
import { realmHandler } from './api/realm';

const router = Router();

router.get('/api/realm/:realm', async (request, env, ctx) => {
    return await realmHandler(request, env, ctx);
});

router.all('*', () => new Response('Not Found.', { status: 404 }));

export default router;
