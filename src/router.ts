import { Router } from 'itty-router';

const router = Router();

router.get('/api/realm', () => new Response('Realm ready!'));

router.get('/api/realm/:realm', ({ params }) => new Response(`Realm #${params.realm}`));

router.post('/api/realm', async (request) => {
    const content = await request.json();

    return new Response('Creating Realm: ' + JSON.stringify(content));
});

router.all('*', () => new Response('Not Found.', { status: 404 }));

export default router;
