import { PUBLIC_SEQUENCE_BASE_URL, allowedOrigins, apiServers } from './consts';
import { IRequest } from 'itty-router';
import { base64, hex } from '@scure/base';
import * as btc from '@scure/btc-signer';

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
    prefix?: string | null;
    protocol?: string | null;
    type?: string | null;
    id?: AtomId | null;
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

export const parseAtomicalIdfromURN = (line: string): ParsedId => {
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

    return {
        prefix: null,
        protocol: null,
        type: null,
        id: null,
    };
};

export function hexToBase64(hexString: string | null, ext: string | null = 'png'): string | null {
    if (!hexString) {
        return null;
    }
    const bytes = hex.decode(hexString);
    const b64 = base64.encode(bytes);
    return `data:image/${ext};base64,${b64}`;
}

export function hexToBytes(hexString: string | null, ext: string | null = 'png'): Uint8Array | null {
    if (!hexString) {
        return null;
    }
    const bytes = hex.decode(hexString);
    if (!bytes) {
        return null;
    }

    return bytes;
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

const mainnet = {
    bech32: 'bc',
    pubKeyHash: 0x00,
    scriptHash: 0x05,
    wif: 0x80,
};

export async function fetchApiServer(request: IRequest, path: string): Promise<any> {
    /*const url = new URL(request.url);
    let path = url.pathname.replace(/^\/proxy/, '');
    if (url.search) {
        path += url.search;
    }*/

    /*const url = new URL(request.url);
    const pathname = url.pathname + url.search;
    const path = url.pathname === '/' ? '' : url.pathname + url.search;*/

    for (let i = 0; i < apiServers.length; i++) {
        const randomIndex = Math.floor(Math.random() * apiServers.length);
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
