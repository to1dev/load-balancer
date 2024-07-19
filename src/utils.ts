import {
    PUBLIC_SEQUENCE_BASE_URL,
    PUBLIC_ELECTRUMX_ENDPOINT1,
    PUBLIC_ELECTRUMX_ENDPOINT2,
    PUBLIC_ELECTRUMX_ENDPOINT3,
    PUBLIC_SEQUENCE_ROUTER2,
    allowedOrigins,
    apiServers,
    PUBLIC_ELECTRUMX_ENDPOINT4,
    PUBLIC_ELECTRUMX_ENDPOINT5,
} from './consts';
import { IRequest } from 'itty-router';
import { base64, hex } from '@scure/base';
import * as btc from '@scure/btc-signer';
import { blake3 } from '@noble/hashes/blake3';
import { bytesToHex, randomBytes } from '@noble/hashes/utils';

export function createHeaders(): Headers {
    return new Headers({
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
        Accept: 'application/json, text/plain, */*',
        'Accept-Encoding': 'gzip, deflate, br',
        'Accept-Language': 'en-US,en;q=0.9',
        Connection: 'keep-alive',
    });
}

interface JsonData {
    [key: string]: any;
}

export async function findFirstDKeyValue(dataArray: JsonData[]): Promise<string | null> {
    for (const data of dataArray) {
        const result = await findDKeyValueInObject(data);
        if (result) {
            return result;
        }
    }
    return null;
}

async function findDKeyValueInObject(data: JsonData): Promise<string | null> {
    for (const key in data) {
        if (data.hasOwnProperty(key)) {
            const value = data[key];
            if (key === 'd') {
                return value;
            } else if (typeof value === 'object' && value !== null) {
                const result = await findDKeyValueInObject(value);
                if (result) {
                    return result;
                }
            }
        }
    }
    return null;
}

export async function findObjectWithKey(data: JsonData, targetKey: string): Promise<JsonData | null> {
    if (typeof data !== 'object' || data === null) {
        return null;
    }

    if (targetKey in data) {
        return data;
    }

    for (const key in data) {
        if (data.hasOwnProperty(key)) {
            const result = await findObjectWithKey(data[key], targetKey);
            if (result) {
                return result;
            }
        }
    }

    return null;
}

type AtomId = string;

export interface ParsedId {
    prefix: string | null;
    protocol: string | null;
    type: string | null;
    id: AtomId | null;
}

const removeDuplicatePrefixes = (line: string): string => {
    const parts = line.split(':');
    const seen = new Set<string>();
    const result: string[] = [];

    for (let i = 0; i < parts.length; i++) {
        if (!seen.has(parts[i])) {
            result.push(parts[i]);
            seen.add(parts[i]);
        }
    }

    return result.join(':');
};

export const parseAtomicalIdfromURN = (line: string): ParsedId | null => {
    const correctedLine = removeDuplicatePrefixes(line);
    const parts = correctedLine.split(':');

    if (parts.length >= 4) {
        const prefix = parts[0];
        const protocol = parts[1];
        const type = parts[2];
        const idPart = parts.slice(3).join(':');

        const id = idPart.split('/')[0]; // Remove any file extensions or paths

        return {
            prefix: prefix,
            protocol: protocol,
            type: type,
            id: id,
        };

        /*if (
            protocol === "btc" &&
            (type === "id" || type === "dat") &&
            prefix === "atom"
        ) {
        } else if (protocol === "btc" && type === "id" && prefix === "ord") {
        } else {
        }*/
    }

    return null;
};

export async function hexToBase64(
    env: Env,
    id: string | null,
    hexString: string | null,
    ext: string | null = 'png'
): Promise<string | null> {
    if (!hexString) {
        return null;
    }
    const bytes = hex.decode(hexString);

    if (bytes) {
        await env.MY_BUCKET.put(`images/${id}`, bytes.buffer, {
            httpMetadata: {
                contentType: `image/${ext}`,
            },
        });
    }

    const b64 = base64.encode(bytes);

    return `data:image/${ext};base64,${b64}`;
}

export function urlToHash(url: string): string {
    return bytesToHex(blake3(url));
}

export async function imageToR2(env: Env, image: string): Promise<string | null> {
    let imageHash: string | null = null;
    const imageResponse = await fetch(image);
    if (imageResponse.ok) {
        const imageBytes = await imageResponse.arrayBuffer();
        if (imageBytes) {
            imageHash = urlToHash(image);
            await env.MY_BUCKET.put(`images/${imageHash}`, imageBytes);
        }
    }

    return imageHash;
}

interface ParsedHexData {
    fileName: string | null;
    ext: string | null;
    hexData: string;
}

export function extractHexData(obj: any, parentKey = ''): ParsedHexData[] {
    let result: ParsedHexData[] = [];

    if (obj && typeof obj === 'object') {
        for (const key of Object.keys(obj)) {
            if (key === '$b') {
                const hexData = typeof obj[key] === 'string' ? obj[key] : obj[key].$b;
                if (typeof hexData === 'string') {
                    const parts = parentKey.split('.');
                    const ext = parts.length > 1 ? parts[parts.length - 1] : 'png';
                    result.push({ fileName: parentKey, ext: ext, hexData });
                }
            } else {
                result = result.concat(extractHexData(obj[key], key));
            }
        }
    }

    return result;
}

export function extractImages(data: JsonData, result: string[] = []): string[] {
    for (const key in data) {
        if (data.hasOwnProperty(key)) {
            const value = data[key];
            if (key === 'image' || key === 'img') {
                result.push(value);
            } else if (typeof value === 'object' && value !== null) {
                extractImages(value, result);
            }
        }
    }
    return result;
}

export async function fetchApiServer(request: IRequest, path: string, index: number = -1): Promise<any> {
    /*const url = new URL(request.url);
    let path = url.pathname.replace(/^\/proxy/, '');
    if (url.search) {
        path += url.search;
    }*/

    /*const url = new URL(request.url);
    const pathname = url.pathname + url.search;
    const path = url.pathname === '/' ? '' : url.pathname + url.search;*/

    for (let i = 0; i < apiServers.length; i++) {
        let randomIndex = Math.floor(Math.random() * apiServers.length);
        if (index > -1) {
            randomIndex = index;
        }
        const apiUrl = `${apiServers[randomIndex]}/${path}`;
        const newRequest = new Request(apiUrl, request);

        try {
            const response = await fetch(newRequest);
            if (response.ok) {
                return response;
            } else {
                console.warn(`Server ${apiUrl} responded with status ${response.status}`);
            }
        } catch (error) {
            console.error(`Error fetching from ${apiUrl}:`, error);
        }
    }

    return new Response('All API servers are unavailable', { status: 503 });
}

export async function fetchRealmAtomicalId(request: IRequest, realm: string): Promise<any | null> {
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

export async function fetchRealmProfileIdFastest(request: IRequest, id: string): Promise<any | null> {
    const endpoint = PUBLIC_ELECTRUMX_ENDPOINT5;
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

        const number = data.response?.result?.atomical_number;
        const pid = data.response?.result?.state?.latest?.d;
        if (number) {
            if (pid) {
                return { pid, number };
            }

            return { number };
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

function getTxIdFromAtomicalId(atomicalId: string | null): string | null {
    if (!atomicalId) return null;

    if (atomicalId.length === 64) {
        return atomicalId;
    }
    if (atomicalId.indexOf('i') !== 64) {
        throw new Error('Invalid atomicalId');
    }
    return atomicalId.substring(0, 64);
}

function decompile(witness: Uint8Array): btc.ScriptType | null {
    try {
        return btc.Script.decode(witness);
    } catch (e) {
        return null;
    }

    return null;
}

export async function fetchHexData(request: IRequest, id: ParsedId | null | undefined): Promise<ImageData | null> {
    switch (id?.protocol) {
        case 'btc':
            switch (id?.prefix) {
                case 'atom':
                    switch (id?.type) {
                        case 'id':
                        case 'dat':
                            const endpoint = PUBLIC_ELECTRUMX_ENDPOINT3;
                            const path: string = `${endpoint}?params=["${id?.id}"]`;

                            try {
                                const res = await fetchApiServer(request, path);
                                if (!res.ok) {
                                    throw new Error(`Error fetching data: ${res.statusText}`);
                                }

                                const data: any = await res.json();
                                if (!data) {
                                    return null;
                                }

                                if (!data?.success) {
                                    throw new Error(`Need to try another way: ${res.statusText}`);
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
                                console.log('Try another way...');

                                const txid = getTxIdFromAtomicalId(id?.id);
                                const endpoint = PUBLIC_ELECTRUMX_ENDPOINT4;
                                const path: string = `${endpoint}?params=["${txid}"]`;

                                const res = await fetchApiServer(request, path, 0);
                                if (!res.ok) {
                                    console.error(`Error fetching data: ${res.statusText}`);
                                    return null;
                                }

                                const data: any = await res.json();
                                if (!data) {
                                    console.error(`Error getting json data: ${res.statusText}`);
                                    return null;
                                }

                                if (!data?.success) {
                                    console.error(`Error getting right json result: ${res.statusText}`);
                                    return null;
                                }

                                const tx = btc.RawTx.decode(hex.decode(data?.response));

                                if (tx) {
                                    for (const witnesses of tx.witnesses ?? [][0]) {
                                        for (const witness of witnesses) {
                                            const res = decompile(witness);
                                            if (res) {
                                                for (const line of res) {
                                                    if (line instanceof Uint8Array) {
                                                        console.log('line is a Uint8Array:', line);
                                                    } else if (Object.values(btc.OP).includes(line)) {
                                                        console.log('line is OP:', line);
                                                    } else if (typeof line === 'number') {
                                                        console.log('line is number:', line);
                                                    } else {
                                                        console.log('line is not a Uint8Array:', line);
                                                    }
                                                }
                                            }
                                        }
                                    }
                                }

                                return null;
                            }

                        default:
                            console.log('atom prefix with unknown type');
                            break;
                    }

                case 'ord':
                    break;

                default:
                    console.log('BTC protocol with unknown prefix');
                    break;
            }

        case 'eth':
            console.log('ethereum protocol');
            break;

        case 'solana':
            console.log('Solana protocol');
            break;

        default:
            console.log('Unknown protocol');
            break;
    }

    return null;
}

const mainnet = {
    bech32: 'bc',
    pubKeyHash: 0x00,
    scriptHash: 0x05,
    wif: 0x80,
};

export function scriptAddress(hexScript: string): string | null {
    if (!hexScript) {
        return null;
    }

    const addr = btc.Address(mainnet);
    const script = hex.decode(hexScript);
    const parsedScript = btc.OutScript.decode(script);
    const parsedAddress = addr.encode(parsedScript);

    return parsedAddress;
}

export function addressScript(address: string): string | null {
    if (!address) {
        return null;
    }

    const addr = btc.Address(mainnet);
    const outScript = btc.OutScript.encode(addr.decode(address));
    const hexScript = hex.encode(outScript);

    return hexScript;
}

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

export async function sendProfileQueue(id: string, data: any): Promise<any> {
    const baseUrl = PUBLIC_SEQUENCE_BASE_URL;
    const router = PUBLIC_SEQUENCE_ROUTER2;
    const url: string = `${baseUrl}${router}/${id}`;

    const fetchOptions = {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
        },
        body: JSON.stringify(data),
    };

    try {
        const res = await fetch(url, fetchOptions);
        if (!res.ok) {
            throw new Error(`Error sending queue message: ${res.statusText}`);
        }
    } catch (error) {
        console.error('Failed to send queue message:', error);
        return null;
    }

    return null;
}
