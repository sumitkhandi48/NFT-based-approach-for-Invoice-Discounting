/**
 * zkService.js — Phase 3: Real Groth16 proof generation and verification.
 *
 * Responsibilities
 * ─────────────────
 * 1. Generate a Groth16 witness + proof using snarkjs (off-chain).
 * 2. Verify a Groth16 proof using snarkjs (off-chain).
 * 3. Store proof.json and public.json with deterministic filenames.
 * 4. Write a ProofMetadata record for each invoice.
 * 5. Append every operation to a research metrics log (never affects business logic).
 *
 * On-chain writes (storeZKProof, updateProofStatus) are done by the frontend
 * after receiving the result from this service, so the backend never holds a
 * private key.  The service returns all data the frontend needs.
 */

import { promises as fs } from "fs";
import path from "path";
import { fileURLToPath } from "url";
import crypto from "crypto";

// ── snarkjs (ESM-compatible dynamic import wrapper) ──────────────────────────
let snarkjs;
async function getSnarkjs() {
    if (!snarkjs) snarkjs = await import("snarkjs");
    return snarkjs;
}

// ── Path resolution ───────────────────────────────────────────────────────────
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ZK_DIR    = path.resolve(__dirname, "../../../zk");
const WASM_PATH = path.join(ZK_DIR, "build/invoice_js/invoice.wasm");
const ZKEY_PATH = path.join(ZK_DIR, "keys/invoice_final.zkey");
const VKEY_PATH = path.join(ZK_DIR, "keys/verification_key.json");
const PROOFS_DIR = path.join(ZK_DIR, "proofs");
const METRICS_PATH = path.join(ZK_DIR, "zk_metrics.json");

// ── Proof status enum (mirrors smart contract) ────────────────────────────────
export const ProofStatus = {
    NONE:      "NONE",
    GENERATED: "GENERATED",
    VERIFIED:  "VERIFIED",
    FAILED:    "FAILED",
    EXPIRED:   "EXPIRED",
};

// ─────────────────────────────────────────────────────────────────────────────
//  INTERNAL HELPERS
// ─────────────────────────────────────────────────────────────────────────────

async function ensureDir(dir) {
    await fs.mkdir(dir, { recursive: true });
}

/** Deterministic proof filename for an invoice. */
function proofFilePath(invoiceId)  { return path.join(PROOFS_DIR, `invoice_${invoiceId}_proof.json`); }
function publicFilePath(invoiceId) { return path.join(PROOFS_DIR, `invoice_${invoiceId}_public.json`); }
function metaFilePath(invoiceId)   { return path.join(PROOFS_DIR, `invoice_${invoiceId}_meta.json`); }

/** Load the verification key once and cache it. */
let _vKey;
async function loadVKey() {
    if (!_vKey) _vKey = JSON.parse(await fs.readFile(VKEY_PATH, "utf8"));
    return _vKey;
}

/**
 * Append one metrics record to the research log.
 * Errors here are silently swallowed so they can NEVER affect business logic.
 */
async function appendMetrics(record) {
    try {
        await ensureDir(path.dirname(METRICS_PATH));
        let log = [];
        try { log = JSON.parse(await fs.readFile(METRICS_PATH, "utf8")); } catch {}
        log.push({ ...record, timestamp: new Date().toISOString() });
        await fs.writeFile(METRICS_PATH, JSON.stringify(log, null, 2));
    } catch { /* research log failure must never propagate */ }
}

// ─────────────────────────────────────────────────────────────────────────────
//  generateProof
//  Called by POST /zk/generate
// ─────────────────────────────────────────────────────────────────────────────

/**
 * @param {object} params
 * @param {string} params.invoiceId         – on-chain token ID (string or number)
 * @param {string} params.buyerAddress      – buyer wallet (as decimal field element)
 * @param {string} params.invoiceAmount     – amount in wei (string)
 * @param {string} params.invoiceSecret     – random blinding factor (string)
 * @param {string} params.minimumThreshold  – financier's minimum (wei, string)
 *
 * @returns {{ success, commitment, proofHash, proofFile, publicFile, generationTimeMs, metadata }}
 */
export async function generateProof({
    invoiceId,
    buyerAddress,
    invoiceAmount,
    invoiceSecret,
    minimumThreshold,
}) {
    const t0 = Date.now();

    // ── 1. Build circom input ────────────────────────────────────────────────
    // circomlibjs Poseidon works on BigInt field elements.
    const { buildPoseidon } = await import("circomlibjs");
    const poseidon = await buildPoseidon();

    const idBig        = BigInt(invoiceId);
    const buyerBig     = BigInt(buyerAddress);   // decimal representation of address
    const amountBig    = BigInt(invoiceAmount);
    const secretBig    = BigInt(invoiceSecret);
    const threshBig    = BigInt(minimumThreshold);

    // Compute the Poseidon commitment (same function as in circuit)
    const hashRaw   = poseidon([idBig, buyerBig, amountBig, secretBig]);
    const commitment = poseidon.F.toString(hashRaw); // decimal string

    const circuitInput = {
        invoiceAmount:    amountBig.toString(),
        invoiceSecret:    secretBig.toString(),
        invoiceId:        idBig.toString(),
        buyerAddress:     buyerBig.toString(),
        minimumThreshold: threshBig.toString(),
        commitment,
    };

    // ── 2. Run snarkjs fullProve ─────────────────────────────────────────────
    const { groth16 } = await getSnarkjs();
    const { proof, publicSignals } = await groth16.fullProve(
        circuitInput,
        WASM_PATH,
        ZKEY_PATH
    );

    const generationTimeMs = Date.now() - t0;

    // ── 3. Compute proof hash (integrity anchor for on-chain storage) ─────────
    const proofBlob = JSON.stringify(proof);
    const proofHashHex = "0x" + crypto.createHash("sha256").update(proofBlob).digest("hex");

    // ── 4. Persist proof files ────────────────────────────────────────────────
    await ensureDir(PROOFS_DIR);
    const pFile  = proofFilePath(invoiceId);
    const pubFile = publicFilePath(invoiceId);
    const mFile  = metaFilePath(invoiceId);

    await fs.writeFile(pFile,   JSON.stringify(proof, null, 2));
    await fs.writeFile(pubFile, JSON.stringify(publicSignals, null, 2));

    // ── 5. Build ProofMetadata ────────────────────────────────────────────────
    const metadata = {
        proofId:           `inv-${invoiceId}-${Date.now()}`,
        invoiceId:         String(invoiceId),
        proofHash:         proofHashHex,
        commitment,
        generatedAt:       new Date().toISOString(),
        generationTimeMs,
        verificationTimeMs: null,
        verified:           false,
        proofVersion:       "Groth16-v1",
        zkScheme:           "Groth16",
        proofStatus:        ProofStatus.GENERATED,
    };
    await fs.writeFile(mFile, JSON.stringify(metadata, null, 2));

    // ── 6. Research metrics ───────────────────────────────────────────────────
    await appendMetrics({
        invoiceId:         String(invoiceId),
        zkEnabled:         true,
        generationTimeMs,
        verificationTimeMs: null,
        proofStatus:        ProofStatus.GENERATED,
        proofVersion:       "Groth16-v1",
    });

    return {
        success: true,
        commitment,
        proofHash: proofHashHex,
        proofFile: pFile,
        publicFile: pubFile,
        generationTimeMs,
        metadata,
    };
}

// ─────────────────────────────────────────────────────────────────────────────
//  verifyProof
//  Called by POST /zk/verify
// ─────────────────────────────────────────────────────────────────────────────

/**
 * @param {object} params
 * @param {string|number} params.invoiceId  – on-chain token ID
 * @param {object}        params.proof      – proof object (or null → read from file)
 * @param {string[]}      params.publicSignals – public signals (or null → read from file)
 *
 * @returns {{ success, verified, verificationTimeMs, proofStatus }}
 */
export async function verifyProof({ invoiceId, proof = null, publicSignals = null }) {
    const t0 = Date.now();

    // Load from files if not supplied directly
    if (!proof) {
        const raw = await fs.readFile(proofFilePath(invoiceId), "utf8");
        proof = JSON.parse(raw);
    }
    if (!publicSignals) {
        const raw = await fs.readFile(publicFilePath(invoiceId), "utf8");
        publicSignals = JSON.parse(raw);
    }

    const vKey = await loadVKey();
    const { groth16 } = await getSnarkjs();

    const verified = await groth16.verify(vKey, publicSignals, proof);
    const verificationTimeMs = Date.now() - t0;
    const proofStatus = verified ? ProofStatus.VERIFIED : ProofStatus.FAILED;

    // Update metadata file if it exists
    try {
        const mFile = metaFilePath(invoiceId);
        const meta  = JSON.parse(await fs.readFile(mFile, "utf8"));
        meta.verified            = verified;
        meta.verificationTimeMs  = verificationTimeMs;
        meta.proofStatus         = proofStatus;
        await fs.writeFile(mFile, JSON.stringify(meta, null, 2));
    } catch { /* metadata update is best-effort */ }

    // Research metrics
    await appendMetrics({
        invoiceId:          String(invoiceId),
        zkEnabled:          true,
        generationTimeMs:   null,
        verificationTimeMs,
        proofStatus,
        proofVersion:       "Groth16-v1",
    });

    return { success: true, verified, verificationTimeMs, proofStatus };
}

// ─────────────────────────────────────────────────────────────────────────────
//  getProofMetadata
//  Called by GET /zk/proof/:invoiceId
// ─────────────────────────────────────────────────────────────────────────────

export async function getProofMetadata(invoiceId) {
    const mFile = metaFilePath(invoiceId);
    try {
        return JSON.parse(await fs.readFile(mFile, "utf8"));
    } catch {
        return null;
    }
}
