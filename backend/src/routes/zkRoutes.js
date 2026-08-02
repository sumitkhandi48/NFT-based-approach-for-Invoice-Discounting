/**
 * zkRoutes.js — Phase 1 placeholder endpoints for Groth16 ZK integration.
 *
 * Phase 2 will replace these stubs with:
 *   POST /zk/generate  → run snarkjs.groth16.fullProve() and record commitment on-chain
 *   POST /zk/verify    → run snarkjs.groth16.verify() and call contract.verifyProof()
 *
 * For now both endpoints return a structured placeholder response so the
 * frontend and contract architecture can be tested end-to-end without a circuit.
 */

import { Router } from "express";

const router = Router();

/**
 * POST /zk/generate
 * Body: { tokenId: number }
 *
 * Phase 1: returns a placeholder indicating proof generation is not yet implemented.
 * Phase 2: will invoke the Circom prover and call enablePrivateInvoice() on-chain.
 */
router.post("/generate", (req, res) => {
    const { tokenId } = req.body;

    if (tokenId === undefined || tokenId === null) {
        return res.status(400).json({
            success: false,
            phase: 1,
            message: "tokenId is required",
        });
    }

    return res.status(200).json({
        success: true,
        phase: 1,
        tokenId: Number(tokenId),
        status: "PLACEHOLDER",
        message:
            "Phase 1 stub: Groth16 proof generation is not yet implemented. " +
            "Circuit and snarkjs integration will be added in Phase 2.",
        commitmentHash: null,
        proof: null,
    });
});

/**
 * POST /zk/verify
 * Body: { tokenId: number, proof: object, publicSignals: array }
 *
 * Phase 1: returns a placeholder indicating on-chain verification is not yet implemented.
 * Phase 2: will call snarkjs.groth16.verify() and emit ProofVerified on-chain.
 */
router.post("/verify", (req, res) => {
    const { tokenId } = req.body;

    if (tokenId === undefined || tokenId === null) {
        return res.status(400).json({
            success: false,
            phase: 1,
            message: "tokenId is required",
        });
    }

    return res.status(200).json({
        success: true,
        phase: 1,
        tokenId: Number(tokenId),
        status: "PLACEHOLDER",
        verified: false,
        message:
            "Phase 1 stub: Groth16 proof verification is not yet implemented. " +
            "Verification key and on-chain verifier contract will be added in Phase 2.",
    });
});

export default router;
