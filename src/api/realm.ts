import { PUBLIC_ELECTRUMX_BASE_URL, PUBLIC_ELECTRUMX_ENDPOINT1, PUBLIC_ELECTRUMX_ENDPOINT2, PUBLIC_ELECTRUMX_ENDPOINT3 } from '../consts';
import { getAllowedOrigin, packResponse } from '../utils';
import { IRequest } from 'itty-router';
import { base64, hex } from '@scure/base';

interface JsonData {
    [key: string]: any;
}

async function findFirstDKeyValue(dataArray: JsonData[]): Promise<string | null> {
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

async function findObjectWithKey(data: JsonData, targetKey: string): Promise<JsonData | null> {
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

export interface ParsedHexData {
    fileName?: string | null;
    ext?: string | null;
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

async function fetchRealmAtomicalId(request: IRequest, realm: string): Promise<any | null> {
    const baseUrl = PUBLIC_ELECTRUMX_BASE_URL;
    const endpoint = PUBLIC_ELECTRUMX_ENDPOINT1;
    const url: string = `${baseUrl}${endpoint}?params=["${realm}"]`;
    const newRequest = new Request(url, request);

    try {
        const res = await fetch(newRequest);
        if (!res.ok) {
            throw new Error(`Error fetching data: ${res.statusText}`);
        }

        const data: any = await res.json();
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
    const baseUrl = PUBLIC_ELECTRUMX_BASE_URL;
    const endpoint = PUBLIC_ELECTRUMX_ENDPOINT2;
    const url: string = `${baseUrl}${endpoint}?params=["${id}",10,0,"mod"]`;
    const newRequest = new Request(url, request);

    try {
        const res = await fetch(newRequest);
        if (!res.ok) {
            throw new Error(`Error fetching data: ${res.statusText}`);
        }

        const data: any = await res.json();

        if (Array.isArray(data.response?.result) && data.response.result.length > 0) {
            const pid = await findFirstDKeyValue(data.response.result);
            if (pid) {
                return { pid };
            }
        }

        return null;
    } catch (error) {
        console.error('Failed to fetch realm info:', error);
        return null;
    }
}

export async function fetchRealmProfile(request: IRequest, id: string): Promise<any | null> {
    const baseUrl = PUBLIC_ELECTRUMX_BASE_URL;
    const endpoint = PUBLIC_ELECTRUMX_ENDPOINT3;
    const url: string = `${baseUrl}${endpoint}?params=["${id}"]`;
    const newRequest = new Request(url, request);

    try {
        const res = await fetch(newRequest);
        if (!res.ok) {
            throw new Error(`Error fetching data: ${res.statusText}`);
        }

        const data: any = await res.json();
        const profile = await findObjectWithKey(data.response?.result?.mint_data?.fields, 'v');

        return profile ? { profile } : null;
    } catch (error) {
        console.error('Failed to fetch realm info:', error);
        return null;
    }
}

interface ImageData {
    ext?: string | null;
    data?: string | null;
}

export async function fetchHexData(id: string | null | undefined): Promise<ImageData | null> {
    const baseUrl = PUBLIC_ELECTRUMX_BASE_URL;
    const endpoint = PUBLIC_ELECTRUMX_ENDPOINT3;
    const url: string = `${baseUrl}${endpoint}?params=["${id}"]`;

    try {
        const res = await fetch(url);
        if (!res.ok) {
            throw new Error(`Error fetching data: ${res.statusText}`);
        }

        const data: any = await res.json();
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

export async function realmHandler(request: IRequest): Promise<Response> {
    const realm = request.params.realm;
    const _id = await fetchRealmAtomicalId(request, realm);

    if (!_id?.id) {
        if (!_id?.cid) {
            return packResponse({
                meta: { v: '', id: '', cid: '', pid: '', image: '' },
                profile: null,
            });
        }

        return packResponse({
            meta: { v: '', id: '', cid: _id.cid, pid: '', image: '' },
            profile: null,
        });
    }

    const pid = await fetchRealmProfileId(request, _id.id);
    if (!pid?.pid) {
        return packResponse({
            meta: { v: '', id: _id.id, cid: _id.cid, pid: '', image: '' },
            profile: null,
        });
    }

    const _profile = await fetchRealmProfile(request, pid.pid);
    if (!_profile?.profile) {
        return packResponse({
            meta: { v: '', id: _id.id, cid: _id.cid, pid: pid.pid, image: '' },
            profile: null,
        });
    }

    return packResponse({
        meta: {
            v: _profile.profile?.v,
            id: _id.id,
            cid: _id.cid,
            pid: pid.pid,
            image: _profile?.profile?.image ? (_profile?.profile?.image as string) : (_profile?.profile?.i as string),
        },
        profile: _profile?.profile,
    });
}
