/**
 * deploy.js — Phase 4 deployment script.
 *
 * Deployment order:
 *   1.  Groth16Verifier   (standalone, no constructor args)
 *   2.  InvoiceNFT        (receives verifier address in constructor)
 *
 * POST-DEPLOY (automatic):
 *   3.  Patches backend/.env  → GANACHE_CONTRACT_ADDRESS / SEPOLIA_CONTRACT_ADDRESS
 *   4.  Patches frontend/.env → VITE_GANACHE_CONTRACT_ADDRESS / VITE_GANACHE_VERIFIER_ADDRESS
 *   5.  Copies compiled ABI   → frontend/src/InvoiceNFT.json
 *
 * Usage:
 *   NETWORK=ganache npx hardhat run scripts/deploy.js
 *   NETWORK=sepolia  npx hardhat run scripts/deploy.js
 */

import { network } from "hardhat";
import { readFileSync, writeFileSync, copyFileSync } from "fs";
import { resolve, dirname } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, "..");

/** Replace the value of a KEY=value line in an env file. */
function patchEnv(filePath, key, newValue) {
    const content = readFileSync(filePath, "utf8");
    const regex = new RegExp(`^(${key}=).*$`, "m");
    if (regex.test(content)) {
        writeFileSync(filePath, content.replace(regex, `$1${newValue}`));
    } else {
        // Key not present — append it
        writeFileSync(filePath, content.trimEnd() + `\n${key}=${newValue}\n`);
    }
}

async function main() {
    const activeNetwork = process.env.NETWORK || "ganache";

    console.log(`\n╔══════════════════════════════════════════════╗`);
    console.log(`║  Invoice Discounting DApp — Phase 4 Deploy   ║`);
    console.log(`╚══════════════════════════════════════════════╝\n`);
    console.log(`Deploying to: ${activeNetwork}\n`);

    const connection = await network.connect(activeNetwork);
    const ethers = connection.ethers;

    const [deployer] = await ethers.getSigners();
    console.log("Deployer :", deployer.address);

    const balance = await ethers.provider.getBalance(deployer.address);
    console.log("Balance  :", ethers.formatEther(balance), "ETH\n");

    // ── Step 1: Deploy the Groth16 verifier ────────────────────────────────
    console.log("▶  [1/2] Deploying Groth16Verifier...");
    const Groth16Verifier = await ethers.getContractFactory("Groth16Verifier");
    const verifier = await Groth16Verifier.deploy();
    await verifier.waitForDeployment();
    const verifierAddress = await verifier.getAddress();
    console.log("   ✅  Groth16Verifier :", verifierAddress);

    // ── Step 2: Deploy InvoiceNFT (wired to verifier) ──────────────────────
    console.log("\n▶  [2/2] Deploying InvoiceNFT...");
    const InvoiceNFT = await ethers.getContractFactory("InvoiceNFT");
    const invoiceNFT = await InvoiceNFT.deploy(verifierAddress);
    await invoiceNFT.waitForDeployment();
    const invoiceNFTAddress = await invoiceNFT.getAddress();
    console.log("   ✅  InvoiceNFT      :", invoiceNFTAddress);

    // ── Summary ────────────────────────────────────────────────────────────
    console.log(`\n╔══════════════════════════════════════════════╗`);
    console.log(`║  Deployment Summary                          ║`);
    console.log(`╠══════════════════════════════════════════════╣`);
    console.log(`║  Network          : ${activeNetwork.padEnd(22)}║`);
    console.log(`║  Groth16Verifier  : ${verifierAddress.slice(0, 22)}║`);
    console.log(`║  InvoiceNFT       : ${invoiceNFTAddress.slice(0, 22)}║`);
    console.log(`╚══════════════════════════════════════════════╝`);

    // ── Step 3: Auto-patch backend/.env ────────────────────────────────────
    console.log("\n▶  [3/5] Patching backend/.env ...");
    const backendEnv = resolve(ROOT, "backend/.env");
    const networkUpper = activeNetwork.toUpperCase();
    patchEnv(backendEnv, `${networkUpper}_CONTRACT_ADDRESS`, invoiceNFTAddress);
    console.log(`   ✅  ${networkUpper}_CONTRACT_ADDRESS = ${invoiceNFTAddress}`);

    // ── Step 4: Auto-patch frontend/.env ───────────────────────────────────
    console.log("\n▶  [4/5] Patching frontend/.env ...");
    const frontendEnv = resolve(ROOT, "frontend/.env");
    patchEnv(frontendEnv, `VITE_${networkUpper}_CONTRACT_ADDRESS`, invoiceNFTAddress);
    patchEnv(frontendEnv, `VITE_${networkUpper}_VERIFIER_ADDRESS`, verifierAddress);
    console.log(`   ✅  VITE_${networkUpper}_CONTRACT_ADDRESS = ${invoiceNFTAddress}`);
    console.log(`   ✅  VITE_${networkUpper}_VERIFIER_ADDRESS = ${verifierAddress}`);

    // ── Step 5: Sync ABI to frontend/src/InvoiceNFT.json ───────────────────
    console.log("\n▶  [5/5] Syncing ABI to frontend/src/InvoiceNFT.json ...");
    const artifactSrc  = resolve(ROOT, "artifacts/contracts/InvoiceNFT.sol/InvoiceNFT.json");
    const artifactDest = resolve(ROOT, "frontend/src/InvoiceNFT.json");
    copyFileSync(artifactSrc, artifactDest);
    const artifact = JSON.parse(readFileSync(artifactSrc, "utf8"));
    const fnCount = artifact.abi.filter(x => x.type === "function").length;
    console.log(`   ✅  Synced ${fnCount} ABI functions`);

    console.log("\n✨  All configurations updated automatically.");
    console.log("   Restart backend and frontend dev servers to apply.\n");
}

main().catch(console.error);