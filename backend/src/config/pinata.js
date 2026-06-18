export const pinataConfig = {
    apiKey: process.env.PINATA_API_KEY,
    apiSecret: process.env.PINATA_API_SECRET,
    jwt: process.env.PINATA_JWT,
    gateway: process.env.PINATA_GATEWAY || "https://gateway.pinata.cloud/ipfs",
};