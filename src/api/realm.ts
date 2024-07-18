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
} from '../utils';
import { IRequest } from 'itty-router';

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
                    banner: null,
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
            },
            profile: null,
        });
    }

    const pid = await fetchRealmProfileIdFastest(request, id.id);
    if (!pid?.pid) {
        return packResponse({
            meta: {
                v: null,
                id: id.id,
                number: pid?.number,
                cid: id.cid,
                pid: null,
                po: null,
                image: null,
                banner: null,
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
                number: pid?.number,
                cid: id.cid,
                pid: pid.pid,
                po: null,
                image: null,
                banner: null,
            },
            profile: null,
        });
    }

    await sendProfileQueue(pid.pid, profile);

    let image = profile?.profile?.image ? profile?.profile?.image : profile?.profile?.i;
    if (!image) {
        return packResponse({
            meta: {
                v: profile.profile?.v,
                id: id.id,
                number: pid?.number,
                cid: id.cid,
                pid: pid.pid,
                po: profile?.owner,
                image: null,
                banner: null,
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
            const hexImage = await fetchHexData(request, iid);
            if (hexImage) {
                imageData = await hexToBase64(env, iid?.id, hexImage.data, hexImage.ext);
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

    let banner = profile?.profile?.banner ? profile?.profile?.banner : profile?.profile?.b;
    if (!banner) {
        return packResponse({
            meta: {
                v: profile.profile?.v,
                id: id.id,
                number: pid?.number,
                cid: id.cid,
                pid: pid.pid,
                po: profile?.owner,
                image: image,
                imageHash: imageHash,
                imageData: imageData,
                banner: null,
            },
            profile: profile?.profile,
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
                bannerData = await hexToBase64(env, bid?.id, hexBanner.data, hexBanner.ext);
            }
        }
    } else {
        if (!banner.includes(PUBLIC_R2_BASE_URL_DOMAIN)) {
            bannerHash = urlToHash(banner);
            const cachedBanner = await env.MY_BUCKET.head(`images/${imageHash}`);
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

    return packResponse({
        meta: {
            v: profile.profile?.v,
            id: id.id,
            number: pid?.number,
            cid: id.cid,
            pid: pid.pid,
            po: profile?.owner,
            image: image,
            imageHash: imageHash,
            imageData: imageData,
            banner: banner,
            bannerHash: bannerHash,
            bannerData: bannerData,
        },
        profile: profile?.profile,
    });
}
