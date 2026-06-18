import { pinataConfig } from "../config/pinata.js";

export function getPinataHeaders() {
    return {
        Authorization: `Bearer ${pinataConfig.jwt}`,
    };
}

export function buildIpfsUrl(cid) {
    return `${pinataConfig.gateway}/${cid}`;
}