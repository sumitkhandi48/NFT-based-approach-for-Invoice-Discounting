import { ethers } from "ethers";
import { readFileSync } from "fs";
import { fileURLToPath } from "url";
import { dirname, join } from "path";
import provider from "./blockchain.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const artifactPath = join(
    __dirname,
    "../../../artifacts/contracts/InvoiceNFT.sol/InvoiceNFT.json"
);
const artifact = JSON.parse(readFileSync(artifactPath, "utf-8"));
const abi = artifact.abi;

const contractAddress = process.env.CONTRACT_ADDRESS;

const contract = new ethers.Contract(contractAddress, abi, provider);

export { contract, abi, contractAddress };