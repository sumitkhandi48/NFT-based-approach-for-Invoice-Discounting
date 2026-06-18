import { ethers } from "ethers";

const provider = new ethers.JsonRpcProvider(process.env.GANACHE_URL);

export default provider;