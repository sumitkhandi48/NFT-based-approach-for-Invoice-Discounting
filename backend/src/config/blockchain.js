import { ethers } from "ethers";
import { ACTIVE_NETWORK } from "./network.js";

const provider = new ethers.JsonRpcProvider(
    ACTIVE_NETWORK.rpcUrl
);

export default provider;