import { allowedOrigins } from './consts';

export function getAllowedOrigin(origin: string | null): string {
    if (origin && allowedOrigins.includes(origin)) {
        return origin;
    }
    return '';
}

export function packResponse(data: any): Response {
    return new Response(JSON.stringify(data), {
        headers: {
            'Access-Control-Allow-Origin': '*',
            'Content-Type': 'application/json',
        },
    });
}
