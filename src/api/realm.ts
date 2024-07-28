import { PUBLIC_R2_BASE_URL, PUBLIC_R2_BASE_URL_DOMAIN } from '../consts';
import {
    parseAtomicalIdfromURN,
    hexToBase64,
    urlToHash,
    imageToR2,
    fetchRealmAtomicalId,
    fetchRealmProfileIdFastest,
    fetchRealmProfile,
    fetchHexData,
    packResponse,
    sendProfileQueue,
    saveToD1,
    readFromD1,
} from '../utils';
import { IRequest } from 'itty-router';
import { getAllowedOrigin } from '../utils';

export async function realmHandler(request: IRequest, env: Env, ctx: ExecutionContext): Promise<Response> {
    const realm = request.params.realm;
    const query = request.query;

    let action = query?.action as string;

    if (action !== 'update') {
        // KV
        const cacheKey = `cache:${realm}`;
        const origin = request.headers.get('Origin');
        const allowedOrigin = getAllowedOrigin(origin);
        const cachedData = await env.api.get(cacheKey, { type: 'json' });
        if (cachedData) {
            return new Response(JSON.stringify(cachedData), {
                headers: {
                    'Access-Control-Allow-Origin': allowedOrigin,
                    'Content-Type': 'application/json',
                    //'Cache-Control': 'public, max-age=31536000',
                },
            });
        }

        // D1

        const values = await readFromD1(env, realm);
        if (values) {
            ctx.waitUntil(env.api.put(cacheKey, JSON.stringify(values)));
            return packResponse(values);
        }
    }

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
                    banner: null,
                    background: null,
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
                banner: null,
                background: null,
            },
            profile: null,
        });
    }

    const pid = await fetchRealmProfileIdFastest(request, id.id);
    if (!pid?.pid) {
        const _meta = {
            v: null,
            id: id.id,
            number: pid?.number,
            cid: id.cid,
            mint: pid?.mintAddress,
            owner: pid?.address,
            pid: null,
            po: null,
            image: null,
            banner: null,
            background: null,
        };

        //const success = await saveToD1(env, realm, _meta, null);

        return packResponse({
            meta: _meta,
            profile: null,
        });
    }

    const profile = await fetchRealmProfile(request, pid.pid);
    if (!profile?.profile) {
        const _meta = {
            v: null,
            id: id.id,
            number: pid?.number,
            cid: id.cid,
            mint: pid?.mintAddress,
            owner: pid?.address,
            pid: pid.pid,
            po: null,
            image: null,
            banner: null,
            background: null,
        };

        //const success = await saveToD1(env, realm, _meta, null);

        return packResponse({
            meta: _meta,
            profile: null,
        });
    }

    await sendProfileQueue(pid.pid, profile);

    let image = profile?.profile?.image;
    if (!image) {
        const _meta = {
            v: profile.profile?.v,
            id: id.id,
            number: pid?.number,
            cid: id.cid,
            mint: pid?.mintAddress,
            owner: pid?.address,
            pid: pid.pid,
            po: profile?.owner,
            image: null,
            banner: null,
            background: null,
        };

        const _profile = profile?.profile;

        const success = await saveToD1(env, realm, _meta, _profile, action);

        return packResponse({
            meta: _meta,
            profile: _profile,
        });
    }

    const url = PUBLIC_R2_BASE_URL;
    let imageData: string | null = null;
    let imageHash: string | null = null;
    const iid = parseAtomicalIdfromURN(image);
    if (iid?.id) {
        const cachedImage = await env.MY_BUCKET.head(`images/${iid?.id}`);
        image = `${url}${iid?.id}`;
        if (!cachedImage) {
            const hexImage = await fetchHexData(request, iid);
            if (hexImage) {
                image = `${url}${iid?.id}`;
                imageData = await hexToBase64(env, iid?.id, hexImage?.data, hexImage?.bytes, hexImage.ext);
            }
        }
    } else {
        if (!image.includes(PUBLIC_R2_BASE_URL_DOMAIN)) {
            imageHash = urlToHash(image);
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

    let banner = profile?.profile?.banner;
    if (!banner) {
        const _meta = {
            v: profile.profile?.v,
            id: id.id,
            number: pid?.number,
            cid: id.cid,
            mint: pid?.mintAddress,
            owner: pid?.address,
            pid: pid.pid,
            po: profile?.owner,
            image: image,
            imageHash: imageHash,
            imageData: imageData,
            banner: null,
            background: null,
        };

        const _profile = profile?.profile;

        const success = await saveToD1(env, realm, _meta, _profile, action);

        return packResponse({
            meta: _meta,
            profile: _profile,
        });
    }

    let bannerData: string | null = null;
    let bannerHash: string | null = null;
    const bid = parseAtomicalIdfromURN(banner);
    if (bid?.id) {
        const cachedBanner = await env.MY_BUCKET.head(`images/${bid?.id}`);
        if (cachedBanner) {
            banner = `${url}${bid?.id}`;
        } else {
            const hexBanner = await fetchHexData(request, bid);
            if (hexBanner) {
                bannerData = await hexToBase64(env, bid?.id, hexBanner?.data, hexBanner?.bytes, hexBanner.ext);
            }
        }
    } else {
        if (!banner.includes(PUBLIC_R2_BASE_URL_DOMAIN)) {
            bannerHash = urlToHash(banner);
            const cachedBanner = await env.MY_BUCKET.head(`images/${bannerHash}`);
            if (cachedBanner) {
                banner = `${url}${bannerHash}`;
            } else {
                const bannerHash = await imageToR2(env, banner);
                if (bannerHash) {
                    banner = `${url}${bannerHash}`;
                }
            }
        }
    }

    let background = profile?.profile?.background;
    if (!background) {
        const _meta = {
            v: profile.profile?.v,
            id: id.id,
            number: pid?.number,
            cid: id.cid,
            mint: pid?.mintAddress,
            owner: pid?.address,
            pid: pid.pid,
            po: profile?.owner,
            image: image,
            imageHash: imageHash,
            imageData: imageData,
            banner: banner,
            bannerHash: bannerHash,
            bannerData: bannerData,
            background: null,
        };

        const _profile = profile?.profile;

        const success = await saveToD1(env, realm, _meta, _profile, action);

        return packResponse({
            meta: _meta,
            profile: _profile,
        });
    }

    let backgroundData: string | null = null;
    let backgroundHash: string | null = null;
    const bkid = parseAtomicalIdfromURN(background);
    if (bkid?.id) {
        const cachedBackground = await env.MY_BUCKET.head(`images/${bkid?.id}`);
        if (cachedBackground) {
            background = `${url}${bkid?.id}`;
        } else {
            const hexBackground = await fetchHexData(request, bkid);
            if (hexBackground) {
                backgroundData = await hexToBase64(env, bkid?.id, hexBackground?.data, hexBackground?.bytes, hexBackground.ext);
            }
        }
    } else {
        if (!background.includes(PUBLIC_R2_BASE_URL_DOMAIN)) {
            backgroundHash = urlToHash(background);
            const cachedBackground = await env.MY_BUCKET.head(`images/${backgroundHash}`);
            if (cachedBackground) {
                background = `${url}${backgroundHash}`;
            } else {
                const backgroundHash = await imageToR2(env, background);
                if (backgroundHash) {
                    background = `${url}${backgroundHash}`;
                }
            }
        }
    }

    const _meta = {
        v: profile.profile?.v,
        id: id.id,
        number: pid?.number,
        cid: id.cid,
        mint: pid?.mintAddress,
        owner: pid?.address,
        pid: pid.pid,
        po: profile?.owner,
        image: image,
        imageHash: imageHash,
        imageData: imageData,
        banner: banner,
        bannerHash: bannerHash,
        bannerData: bannerData,
        background: background,
        backgroundHash: backgroundHash,
        backgroundData: backgroundData,
    };

    const _profile = profile?.profile;

    const success = await saveToD1(env, realm, _meta, _profile, action);

    return packResponse({
        meta: _meta,
        profile: _profile,
    });
}
