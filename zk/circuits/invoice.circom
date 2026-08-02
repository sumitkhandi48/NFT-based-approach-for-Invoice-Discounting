pragma circom 2.0.0;

// ─────────────────────────────────────────────────────────────────────────────
//  Invoice Discounting — Groth16 Privacy Circuit
//  Phase 2 of the ZK architecture (Phase 1 = on-chain metadata stubs)
//
//  Statement proven:
//    "I know an invoiceAmount and an invoiceSecret such that:
//       1.  Poseidon(invoiceId, buyerAddress, invoiceAmount, invoiceSecret)
//             == commitment          (public)
//       2.  invoiceAmount >= minimumThreshold  (public)
//    without revealing invoiceAmount or invoiceSecret."
//
//  Private inputs  : invoiceAmount, invoiceSecret
//  Public  inputs  : invoiceId, buyerAddress, minimumThreshold, commitment
//
//  Hash function   : Poseidon (from circomlib) — ZK-friendly, gas-efficient
//                    Do NOT use Keccak here; it is not efficiently provable.
//
//  Groth16 notes   :
//    • All arithmetic is over BN254 scalar field (≈ 2^254).
//    • invoiceAmount and minimumThreshold are expected in wei (uint256) but
//      must fit inside the BN254 field. Practically this is always satisfied
//      for ETH amounts.
//    • The comparison constraint requires a bit decomposition (LessThan /
//      GreaterEqThan from circomlib) because Circom works over a prime field.
// ─────────────────────────────────────────────────────────────────────────────

include "../../node_modules/circomlib/circuits/poseidon.circom";
include "../../node_modules/circomlib/circuits/comparators.circom";

// ─────────────────────────────────────────────────────────────────────────────
//  Main template
// ─────────────────────────────────────────────────────────────────────────────
template InvoiceDisclosure() {

    // ── Private inputs (known only to the prover / supplier) ─────────────────
    signal input invoiceAmount;   // actual invoice face value (in wei or smallest unit)
    signal input invoiceSecret;   // random blinding factor chosen by the supplier

    // ── Public inputs (visible to everyone, embedded in the proof) ───────────
    signal input invoiceId;         // on-chain token ID
    signal input buyerAddress;      // buyer wallet address (as field element)
    signal input minimumThreshold;  // financier's minimum acceptable invoice amount
    signal input commitment;        // expected Poseidon hash (stored on-chain in Phase 1)

    // ── Output (implicitly 1 if all constraints hold) ─────────────────────────
    // Circom groth16 circuits don't need an explicit output signal —
    // proof validity encodes the satisfiability of all constraints.

    // ─────────────────────────────────────────────────────────────────────────
    //  Constraint 1: invoiceAmount >= minimumThreshold
    //
    //  GreaterEqThan(n) checks:  a >= b  where n = bit width.
    //  We use 64 bits — sufficient for amounts up to ~1.8 × 10^19 wei (18 ETH).
    //  Increase to 128 if very large invoice amounts are expected.
    // ─────────────────────────────────────────────────────────────────────────
    component ge = GreaterEqThan(64);
    ge.in[0] <== invoiceAmount;
    ge.in[1] <== minimumThreshold;

    // Assert the comparison result is 1 (i.e. invoiceAmount >= minimumThreshold)
    ge.out === 1;

    // ─────────────────────────────────────────────────────────────────────────
    //  Constraint 2: Poseidon commitment check
    //
    //  We hash 4 inputs: invoiceId, buyerAddress, invoiceAmount, invoiceSecret
    //  The Poseidon template from circomlib takes an array of nInputs signals.
    // ─────────────────────────────────────────────────────────────────────────
    component poseidon = Poseidon(4);
    poseidon.inputs[0] <== invoiceId;
    poseidon.inputs[1] <== buyerAddress;
    poseidon.inputs[2] <== invoiceAmount;
    poseidon.inputs[3] <== invoiceSecret;

    // Assert the computed hash equals the public commitment
    poseidon.out === commitment;
}

// ─────────────────────────────────────────────────────────────────────────────
//  Instantiate the main component
//  The main component marks which signals are public (listed in the array).
//  All other signals are private by default.
// ─────────────────────────────────────────────────────────────────────────────
component main {public [invoiceId, buyerAddress, minimumThreshold, commitment]}
    = InvoiceDisclosure();
