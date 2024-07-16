import {
    PUBLIC_ELECTRUMX_ENDPOINT1,
    PUBLIC_ELECTRUMX_ENDPOINT2,
    PUBLIC_ELECTRUMX_ENDPOINT3,
    PUBLIC_R2_BASE_URL,
    PUBLIC_R2_BASE_URL_DOMAIN,
} from '../consts';
import {
    findFirstDKeyValue,
    findObjectWithKey,
    parseAtomicalIdfromURN,
    hexToBase64,
    urlToHash,
    imageToR2,
    extractHexData,
    fetchApiServer,
    scriptAddress,
    packResponse,
} from '../utils';
import { IRequest } from 'itty-router';

async function fetchRealmAtomicalId(request: IRequest, realm: string): Promise<any | null> {
    const endpoint = PUBLIC_ELECTRUMX_ENDPOINT1;
    const path: string = `${endpoint}?params=["${realm}"]`;

    try {
        const res = await fetchApiServer(request, path);
        if (!res.ok) {
            throw new Error(`Error fetching data: ${res.statusText}`);
        }

        const data: any = await res.json();
        if (!data) {
            return null;
        }

        const id = data.response?.result?.atomical_id;
        const cid = data.response?.result?.candidates[0]?.atomical_id;
        if (!id) {
            if (!cid) {
                return null;
            }
            return {
                id: null,
                cid: cid,
            };
        }

        return {
            id,
            cid,
        };
    } catch (error) {
        console.error('Failed to fetch realm id:', error);
        return null;
    }
}

export async function fetchRealmProfileId(request: IRequest, id: string): Promise<any | null> {
    const endpoint = PUBLIC_ELECTRUMX_ENDPOINT2;
    const path: string = `${endpoint}?params=["${id}",10,0,"mod"]`;

    try {
        const res = await fetchApiServer(request, path);
        if (!res.ok) {
            throw new Error(`Error fetching data: ${res.statusText}`);
        }

        const data: any = await res.json();
        if (!data) {
            return null;
        }

        if (Array.isArray(data.response?.result) && data.response.result.length > 0) {
            const pid = await findFirstDKeyValue(data.response.result);
            if (pid) {
                return { pid };
            }
        }

        return null;
    } catch (error) {
        console.error('Failed to fetch realm profile id:', error);
        return null;
    }
}

export async function fetchRealmProfile(request: IRequest, id: string): Promise<any | null> {
    const endpoint = PUBLIC_ELECTRUMX_ENDPOINT3;
    const path: string = `${endpoint}?params=["${id}"]`;

    try {
        const res = await fetchApiServer(request, path);
        if (!res.ok) {
            throw new Error(`Error fetching data: ${res.statusText}`);
        }

        const data: any = await res.json();
        if (!data) {
            return null;
        }

        const profile = await findObjectWithKey(data.response?.result?.mint_data?.fields, 'v');

        if (!profile) {
            return null;
        }

        let address = scriptAddress(data.response?.result?.mint_info?.reveal_location_script);

        if (!address) {
            return {
                profile: profile,
                owner: null,
            };
        }

        return {
            profile: profile,
            owner: address,
        };
    } catch (error) {
        console.error('Failed to fetch realm profile:', error);
        return null;
    }
}

interface ImageData {
    ext: string | null;
    data: string | null;
}

async function fetchHexData(request: IRequest, id: string | null | undefined): Promise<ImageData | null> {
    const endpoint = PUBLIC_ELECTRUMX_ENDPOINT3;
    const path: string = `${endpoint}?params=["${id}"]`;

    try {
        const res = await fetchApiServer(request, path);
        if (!res.ok) {
            throw new Error(`Error fetching data: ${res.statusText}`);
        }

        const data: any = await res.json();
        if (!data) {
            return null;
        }

        const imageData = extractHexData(data.response?.result?.mint_data);

        if (imageData && imageData.length > 0) {
            const image = imageData[0];
            return {
                ext: image?.ext,
                data: image?.hexData,
            };
        }

        return null;
    } catch (error) {
        console.error('Failed to fetch hex data:', error);
        return null;
    }
}

export async function realmHandler(request: IRequest, env: Env, ctx: ExecutionContext): Promise<Response> {
    const realm = request.params.realm;

    // D1
    // KV

    // Queue
    //await sendQueue(realm);

    // API
    const id = await fetchRealmAtomicalId(request, realm);
    if (!id?.id) {
        if (!id?.cid) {
            return packResponse({
                meta: {
                    v: null,
                    id: null,
                    cid: null,
                    pid: null,
                    po: null,
                    image: null,
                },
                profile: null,
            });
        }

        return packResponse({
            meta: {
                v: null,
                id: null,
                cid: id.cid,
                pid: null,
                po: null,
                image: null,
            },
            profile: null,
        });
    }

    const pid = await fetchRealmProfileId(request, id.id);
    if (!pid?.pid) {
        return packResponse({
            meta: {
                v: null,
                id: id.id,
                cid: id.cid,
                pid: null,
                po: null,
                image: null,
            },
            profile: null,
        });
    }

    const profile = await fetchRealmProfile(request, pid.pid);
    if (!profile?.profile) {
        return packResponse({
            meta: {
                v: null,
                id: id.id,
                cid: id.cid,
                pid: pid.pid,
                po: null,
                image: null,
            },
            profile: null,
        });
    }

    let image = profile?.profile?.image ? profile?.profile?.image : profile?.profile?.i;
    if (!image) {
        return packResponse({
            meta: {
                v: null,
                id: id.id,
                cid: id.cid,
                pid: pid.pid,
                po: profile?.owner,
                image: null,
            },
            profile: profile?.profile,
        });
    }

    const url = PUBLIC_R2_BASE_URL;
    let imageData: string | null = null;
    let imageHash: string | null = null;
    const iid = parseAtomicalIdfromURN(image);
    if (iid?.id) {
        const cachedImage = await env.MY_BUCKET.head(`images/${iid?.id}`);
        if (cachedImage) {
            image = `${url}${iid?.id}`;
        } else {
            const hexImage = await fetchHexData(request, iid?.id);
            if (hexImage) {
                imageData = await hexToBase64(env, iid?.id, hexImage.data, hexImage.ext);
            }
        }
    } else {
        if (!image.includes(PUBLIC_R2_BASE_URL_DOMAIN)) {
            const imageHash = urlToHash(image);
            const cachedImage = await env.MY_BUCKET.head(`images/${imageHash}`);
            if (cachedImage) {
                image = `${url}${imageHash}`;
            } else {
                const imageHash = await imageToR2(env, image);
                if (imageHash) {
                    image = `${url}${imageHash}`;
                }
            }
        }
    }

    return packResponse({
        meta: {
            v: profile.profile?.v,
            id: id.id,
            cid: id.cid,
            pid: pid.pid,
            po: profile?.owner,
            image: image,
            imageHash: imageHash,
            imageData: imageData,
        },
        profile: profile?.profile,
    });
}
