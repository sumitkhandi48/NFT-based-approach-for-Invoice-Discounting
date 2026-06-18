import axios from "axios";
import FormData from "form-data";
import { createReadStream } from "fs";
import { getPinataHeaders, buildIpfsUrl } from "../utils/pinataHelpers.js";

const PINATA_PIN_URL = "https://api.pinata.cloud/pinning/pinFileToIPFS";

export async function uploadToIPFS(filePath, fileName) {
    const formData = new FormData();
    formData.append("file", createReadStream(filePath), fileName);

    const metadata = JSON.stringify({ name: fileName });
    formData.append("pinataMetadata", metadata);

    const options = JSON.stringify({ cidVersion: 1 });
    formData.append("pinataOptions", options);

    const response = await axios.post(PINATA_PIN_URL, formData, {
        headers: {
            ...getPinataHeaders(),
            ...formData.getHeaders(),
        },
    });

    const cid = response.data.IpfsHash;
    const url = buildIpfsUrl(cid);

    return { cid, url };
}