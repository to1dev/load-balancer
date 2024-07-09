import punycode from 'punycode/';
import { PUBLIC_ELECTRUMX_ENDPOINT1 } from '../consts';
import { IRequest } from 'itty-router';

async function fetchRealmAtomicalId(realm: string): Promise<{ id: string | null }> {
    const baseUrl = 'https://ep2.to1.dev/proxy/';
    const endpoint = PUBLIC_ELECTRUMX_ENDPOINT1;
    const url: string = `${baseUrl}${endpoint}?params=["${realm}"]`;

    try {
        const res = await fetch(url);
        if (!res.ok) {
            throw new Error(`Error fetching data: ${res.statusText}`);
        }

        const data: any = await res.json();
        const id = data.response?.result?.atomical_id;
        if (!id) {
            return {
                id: null,
            };
        }

        return {
            id,
        };
    } catch (error) {
        console.error('Failed to fetch realm id:', error);
        return {
            id: null,
        };
    }
}

export async function realmHandler(request: IRequest): Promise<Response> {
    const realm = punycode.toASCII(decodeURIComponent(request.params.realm).trim().toLowerCase());

    const _id = await fetchRealmAtomicalId(realm);

    if (!_id.id) {
        return Response.json({
            meta: { realm: realm, v: '', id: '', pid: '', image: '' },
            profile: null,
        });
    }

    return Response.json({
        realm: realm,
        id: _id.id,
    });
}
