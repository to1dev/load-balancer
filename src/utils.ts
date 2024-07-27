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
    PUBLIC_ORD_BASE_URL,
} from './consts';
import { IRequest } from 'itty-router';
import { base64, hex } from '@scure/base';
import * as btc from '@scure/btc-signer';
import { CBOR } from 'micro-ordinals/lib/cbor';
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

function getFileExtension(fileName: string): string {
    const parts = fileName.split('.');
    return parts.length > 1 ? parts[parts.length - 1] : 'png';
}

interface JsonData {
    [key: string]: any;
}

/*export async function findFirstDKeyValue(dataArray: JsonData[]): Promise<string | null> {
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
}*/

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

        const id = idPart.split('/')[0];

        return {
            prefix: prefix,
            protocol: protocol,
            type: type,
            id: id,
        };
    }

    return null;
};

export async function hexToBase64(
    env: Env,
    id: string | null,
    hexString?: string | null,
    data?: Uint8Array | null,
    ext: string | null = 'png'
): Promise<string | null> {
    if (hexString) {
        const bytes = hex.decode(hexString);

        if (bytes) {
            /*await env.MY_BUCKET.put(`images/${id}`, bytes, {
                httpMetadata: {
                    contentType: `image/${ext}`,
                },
            });*/
            await env.MY_BUCKET.put(`images/${id}`, bytes);
        }

        const b64 = base64.encode(bytes);

        return `data:image/${ext};base64,${b64}`;
    }

    if (data) {
        await env.MY_BUCKET.put(`images/${id}`, data);
        const b64 = base64.encode(data);
        return `data:image/${ext};base64,${b64}`;
    }

    return null;
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
                    //const parts = parentKey.split('.');
                    //const ext = parts.length > 1 ? parts[parts.length - 1] : 'png';
                    const ext = getFileExtension(parentKey);
                    result.push({ fileName: parentKey, ext: ext, hexData });
                }
            } else {
                result = result.concat(extractHexData(obj[key], key));
            }
        }
    }

    return result;
}

export function extractHexDataEx(obj: any, parentKey = ''): ParsedHexData[] {
    let result: ParsedHexData[] = [];

    if (obj && typeof obj === 'object') {
        for (const key of Object.keys(obj)) {
            const value = obj[key];

            if (key === '$b' && typeof value === 'string') {
                //const parts = parentKey.split('.');
                //const ext = parts.length > 1 ? parts[parts.length - 1] : 'png';
                const ext = getFileExtension(parentKey);
                result.push({ fileName: parentKey, ext: ext, hexData: value });
            } else if (typeof value === 'object') {
                const newKey = parentKey ? `${parentKey}.${key}` : key;
                result = result.concat(extractHexData(value, newKey));
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

/*export async function fetchRealmProfileId(request: IRequest, id: string): Promise<any | null> {
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
}*/

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
        if (!number) {
            if (!pid) {
                return null;
            }

            return { pid };
        }

        let mintAddress = scriptAddress(data.response?.result?.mint_info?.reveal_location_script);
        let address = scriptAddress(data.response?.result?.location_info[0]?.script);
        if (!mintAddress) {
            if (!address) {
                return {
                    pid,
                    number,
                };
            }

            return {
                pid,
                number,
                mintAddress,
            };
        }

        return { pid, number, mintAddress, address };

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
    data?: string | null;
    bytes?: Uint8Array | null;
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

function concatenateUint8Arrays(data: any[]): Uint8Array {
    let result: Uint8Array[] = [];
    let collecting = false;
    const keywords = ['atom', 'dat', 'mod', 'nft', 'ft', 'evt'];
    const textDecoder = new TextDecoder();

    for (const item of data) {
        if (item === 'IF') {
            collecting = true;
        } else if (item === 'ENDIF') {
            collecting = false;
        } else if (collecting && item instanceof Uint8Array) {
            const partialString = textDecoder.decode(item.subarray(0, 4));
            if (!keywords.some((keyword) => partialString.includes(keyword))) {
                result.push(item);
            }
        }
    }

    const totalLength = result.reduce((acc, arr) => acc + arr.length, 0);

    const concatenatedArray = new Uint8Array(totalLength);

    let offset = 0;
    for (const arr of result) {
        concatenatedArray.set(arr, offset);
        offset += arr.length;
    }

    return concatenatedArray;
}

interface Result {
    fileName: string;
    data: Uint8Array;
    contentType?: string;
}

function findUint8ArrayData(obj: any, parentKey: string = '', result: Result | null = null): Result | null {
    if (!obj || typeof obj !== 'object') {
        return result;
    }

    for (const key in obj) {
        if (obj.hasOwnProperty(key)) {
            const value = obj[key];

            if (value instanceof Uint8Array) {
                return {
                    fileName: parentKey || key,
                    data: value,
                    contentType: result ? result.contentType : undefined,
                };
            } else if (typeof value === 'object') {
                const newResult = result || {
                    fileName: parentKey || key,
                    data: new Uint8Array(),
                };

                if (key === '$ct' && typeof value === 'string') {
                    newResult.contentType = value;
                }

                const found = findUint8ArrayData(value, key, newResult);
                if (found && found.data.length > 0) {
                    return found;
                }
            }
        }
    }

    return result;
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
                                    for (const witnesses of tx.witnesses ?? [[]]) {
                                        for (const witness of witnesses) {
                                            const res = decompile(witness);
                                            if (res) {
                                                const bytes = concatenateUint8Arrays(res);
                                                const decoded = CBOR.decode(bytes);
                                                if (decoded) {
                                                    const result = findUint8ArrayData(decoded);
                                                    if (result) {
                                                        const ext = getFileExtension(result.fileName);
                                                        return {
                                                            ext: ext,
                                                            bytes: result.data,
                                                        };
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
                    if (id.id) {
                        const baseOrdUrl = PUBLIC_ORD_BASE_URL;
                        const imageUrl = `${baseOrdUrl}${id.id}`;
                        const imageResponse = await fetch(imageUrl);
                        if (imageResponse.ok) {
                            const imageBytes = await imageResponse.arrayBuffer();
                            if (imageBytes) {
                                return {
                                    ext: null,
                                    bytes: new Uint8Array(imageBytes),
                                };
                            }
                        }
                    }

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

export async function sendProfileQueueEx(env: Env, id: string, data: any): Promise<void> {
    await env.MY_SERVICE.sendQueue(id, data);
}

async function realmExists(env: Env, realm: string): Promise<boolean> {
    const sql = `SELECT RealmName FROM realms WHERE RealmName = ?1 LIMIT 1`;
    const _realm = await env.MY_DB.prepare(sql).bind(realm).first();
    return _realm !== null;
}

export async function saveToD1(env: Env, realm: string, meta: any, profile: any, action?: string | null | undefined): Promise<boolean> {
    async function _save(): Promise<boolean> {
        const { success } = await env.MY_DB.prepare(
            `insert into realms (RealmName, RealmId, RealmNumber, RealmMinter, RealmOwner, RealmAvatar, RealmBanner, RealmMeta, RealmProfile) values (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9)`
        )
            .bind(
                realm,
                meta?.id,
                meta?.number,
                meta?.mint,
                meta?.owner,
                meta?.image,
                meta?.banner,
                JSON.stringify(meta),
                JSON.stringify(profile)
            )
            .run();

        return success;
    }

    async function _update(): Promise<boolean> {
        const { success } = await env.MY_DB.prepare(
            `update realms set
                RealmOwner = ?1,
                RealmAvatar = ?2,
                RealmBanner = ?3,
                RealmMeta = ?4,
                RealmProfile = ?5
             where RealmName = ?6`
        )
            .bind(meta?.owner, meta?.image, meta?.banner, JSON.stringify(meta), JSON.stringify(profile), realm)
            .run();

        return success;
    }

    const exists = await realmExists(env, realm);
    if (!exists) {
        return await _save();
    } else {
        if (action == 'update') {
            _update();
            const cacheKey = `cache:${realm}`;
            await env.api.delete(cacheKey);
        }
    }

    return false;
}

export async function readFromD1(env: Env, realm: string): Promise<any | null> {
    const sql = `SELECT * FROM realms WHERE RealmName = ?1 LIMIT 1`;
    const values = await env.MY_DB.prepare(sql).bind(realm).first();

    if (values) {
        return {
            realm: {
                name: values?.RealmName,
                id: values?.RealmId,
                number: values?.RealmNumber,
                minter: values?.RealmMinter,
                owner: values?.RealmOwner,
                avatar: values?.RealmAvatar,
                banner: values?.RealmBanner,
            },
            meta: JSON.parse(values?.RealmMeta as string),
            profile: JSON.parse(values?.RealmProfile as string),
        };
    }

    return null;
}
