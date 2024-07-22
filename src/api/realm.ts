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

export async function realmHandler(request: IRequest, env: Env, ctx: ExecutionContext): Promise<Response> {
    const realm = request.params.realm;

    // D1

    const values = await readFromD1(env, realm);
    if (values) {
        console.log(values);
        return packResponse(values);
    }

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
        };

        const success = await saveToD1(env, realm, _meta, null);

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
        };

        const success = await saveToD1(env, realm, _meta, null);

        return packResponse({
            meta: _meta,
            profile: null,
        });
    }

    await sendProfileQueue(pid.pid, profile);

    let image = profile?.profile?.image ? profile?.profile?.image : profile?.profile?.i;
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
        };

        const _profile = profile?.profile;

        const success = await saveToD1(env, realm, _meta, _profile);

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

    let banner = profile?.profile?.banner ? profile?.profile?.banner : profile?.profile?.b;
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
        };

        const _profile = profile?.profile;

        const success = await saveToD1(env, realm, _meta, _profile);

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
    };

    const _profile = profile?.profile;

    const success = await saveToD1(env, realm, _meta, _profile);

    return packResponse({
        meta: _meta,
        profile: _profile,
    });
}
