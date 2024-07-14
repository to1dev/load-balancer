import { PUBLIC_SEQUENCE_BASE_URL, allowedOrigins } from './consts';

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

export async function sendQueue(realm: string): Promise<any> {
    const baseUrl = PUBLIC_SEQUENCE_BASE_URL;
    const url: string = `${baseUrl}${realm}`;

    try {
        const res = await fetch(url);
        if (!res.ok) {
            throw new Error(`Error sending queue message: ${res.statusText}`);
        }
    } catch (error) {
        console.error('Failed to send queue message:', error);
        return null;
    }

    return null;
}
