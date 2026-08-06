/**
 * zkRoutes.js — Phase 3: Real Groth16 proof generation and verification.
 *
 * Endpoints
 * ──────────
 *   POST /zk/generate   – generate witness + proof, store files, return commitment + proofHash
 *   POST /zk/verify     – verify proof, return verified boolean + timing
 *   GET  /zk/proof/:id  – retrieve ProofMetadata for an invoice
 *
 * On-chain transactions (storeZKProof, updateProofStatus) are performed by
 * the supplier / financier frontend after receiving the backend response.
 * This backend never holds a private key.
 */

import { Router } from "express";
import { generateProof, verifyProof, getProofMetadata } from "../services/zkService.js";

const router = Router();

// ─────────────────────────────────────────────────────────────────────────────
//  POST /zk/generate
//
//  Body (JSON):
//    invoiceId         string | number   – on-chain token ID
//    buyerAddress      string            – buyer address as decimal field element
//    invoiceAmount     string            – invoice amount in wei
//    invoiceSecret     string            – random blinding factor (keep private)
//    minimumThreshold  string            – financier's minimum amount in wei
//
//  Returns:
//    { success, commitment, proofHash, generationTimeMs, metadata }
// ─────────────────────────────────────────────────────────────────────────────
router.post("/generate", async (req, res) => {
    const { invoiceId, buyerAddress, invoiceAmount, invoiceSecret, minimumThreshold } = req.body;

    // Input validation
    const missing = ["invoiceId","buyerAddress","invoiceAmount","invoiceSecret","minimumThreshold"]
        .filter(k => req.body[k] === undefined || req.body[k] === null || req.body[k] === "");
    if (missing.length > 0) {
        return res.status(400).json({
            success: false,
            message: `Missing required fields: ${missing.join(", ")}`,
        });
    }

    try {
        const result = await generateProof({
            invoiceId:        String(invoiceId),
            buyerAddress:     String(buyerAddress),
            invoiceAmount:    String(invoiceAmount),
            invoiceSecret:    String(invoiceSecret),
            minimumThreshold: String(minimumThreshold),
        });

        return res.status(200).json({
            success:          true,
            invoiceId:        String(invoiceId),
            commitment:       result.commitment,
            proofHash:        result.proofHash,
            generationTimeMs: result.generationTimeMs,
            proofStatus:      "GENERATED",
            metadata:         result.metadata,
        });

    } catch (err) {
        console.error("[ZK generate] Error:", err.message);
        return res.status(500).json({
            success:     false,
            invoiceId:   String(invoiceId),
            proofStatus: "FAILED",
            message:     err.message,
        });
    }
});

// ─────────────────────────────────────────────────────────────────────────────
//  POST /zk/verify
//
//  Body (JSON):
//    invoiceId      string | number  – on-chain token ID
//    proof          object | null    – if null, loaded from stored file
//    publicSignals  array  | null    – if null, loaded from stored file
//
//  Returns:
//    { success, verified, verificationTimeMs, proofStatus }
// ─────────────────────────────────────────────────────────────────────────────
router.post("/verify", async (req, res) => {
    const { invoiceId, proof = null, publicSignals = null } = req.body;

    if (!invoiceId && invoiceId !== 0) {
        return res.status(400).json({ success: false, message: "invoiceId is required" });
    }

    try {
        const result = await verifyProof({
            invoiceId:     String(invoiceId),
            proof,
            publicSignals,
        });

        return res.status(200).json({
            success:            true,
            invoiceId:          String(invoiceId),
            verified:           result.verified,
            verificationTimeMs: result.verificationTimeMs,
            proofStatus:        result.proofStatus,
        });

    } catch (err) {
        console.error("[ZK verify] Error:", err.message);
        return res.status(500).json({
            success:     false,
            invoiceId:   String(invoiceId),
            verified:    false,
            proofStatus: "FAILED",
            message:     err.message,
        });
    }
});

// ─────────────────────────────────────────────────────────────────────────────
//  GET /zk/proof/:invoiceId
//
//  Returns ProofMetadata for the given invoice, or 404 if none exists.
// ─────────────────────────────────────────────────────────────────────────────
router.get("/proof/:invoiceId", async (req, res) => {
    const { invoiceId } = req.params;
    try {
        const meta = await getProofMetadata(invoiceId);
        if (!meta) {
            return res.status(404).json({
                success: false,
                message: `No proof metadata found for invoice ${invoiceId}`,
            });
        }
        return res.status(200).json({ success: true, metadata: meta });
    } catch (err) {
        return res.status(500).json({ success: false, message: err.message });
    }
});


// ─────────────────────────────────────────────────────────────────────────────
//  GET /zk/calldata/:invoiceId
//
//  Returns the proof formatted as ABI-compatible uint256 arrays for the
//  verifyAndFund() on-chain call.  Frontend calls this to get pA, pB, pC,
//  pubSignals without needing snarkjs in the browser.
// ─────────────────────────────────────────────────────────────────────────────
router.get("/calldata/:invoiceId", async (req, res) => {
    const { invoiceId } = req.params;
    try {
        const { promises: fs } = await import("fs");
        const pathMod = await import("path");
        const { fileURLToPath } = await import("url");

        const __dirname  = pathMod.default.dirname(fileURLToPath(import.meta.url));
        const ZK_DIR     = pathMod.default.resolve(__dirname, "../../../zk");
        const proofFile  = pathMod.default.join(ZK_DIR, "proofs", `invoice_${invoiceId}_proof.json`);
        const publicFile = pathMod.default.join(ZK_DIR, "proofs", `invoice_${invoiceId}_public.json`);

        let proof, publicSignals;
        try {
            proof         = JSON.parse(await fs.readFile(proofFile,  "utf8"));
            publicSignals = JSON.parse(await fs.readFile(publicFile, "utf8"));
        } catch {
            return res.status(404).json({
                success: false,
                message: `Proof files not found for invoice ${invoiceId}. Run proof generation first.`,
            });
        }

        // Format proof elements into uint256 arrays for Solidity:
        //   pA  = [pi_a[0], pi_a[1]]
        //   pB  = [[pi_b[0][1], pi_b[0][0]],   <- G2 reversed order
        //          [pi_b[1][1], pi_b[1][0]]]
        //   pC  = [pi_c[0], pi_c[1]]
        const pA = [proof.pi_a[0], proof.pi_a[1]];
        const pB = [
            [proof.pi_b[0][1], proof.pi_b[0][0]],
            [proof.pi_b[1][1], proof.pi_b[1][0]],
        ];
        const pC = [proof.pi_c[0], proof.pi_c[1]];
        const pubSigs = publicSignals.slice(0, 4);

        return res.status(200).json({
            success:    true,
            invoiceId:  String(invoiceId),
            pA,
            pB,
            pC,
            pubSignals: pubSigs,
        });

    } catch (err) {
        console.error("[ZK calldata] Error:", err.message);
        return res.status(500).json({ success: false, message: err.message });
    }
});

export default router;
