#!/usr/bin/env bash
# =============================================================================
#  compile.sh — Phase 2 ZK: Compile the Circom circuit and run Groth16 setup
#
#  Produces:
#    build/invoice_js/invoice.wasm   (WebAssembly witness generator)
#    build/invoice.r1cs              (Rank-1 Constraint System)
#    build/invoice.sym               (symbol file for debugging)
#    keys/invoice_0000.zkey          (initial proving key — phase 2 ceremony input)
#    keys/invoice_final.zkey         (final proving key after beacon contribution)
#    keys/verification_key.json      (verification key — shared publicly)
# =============================================================================

set -e  # exit on any error

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ZK_DIR="$SCRIPT_DIR"
CIRCOM_FILE="$ZK_DIR/circuits/invoice.circom"
BUILD_DIR="$ZK_DIR/build"
KEYS_DIR="$ZK_DIR/keys"
PTAU="$ZK_DIR/powersOfTau28_hez_final_12.ptau"

# Resolve snarkjs (local or global)
SNARKJS="$(cd "$SCRIPT_DIR/.." && npx --no-install snarkjs 2>/dev/null || true)"
if [ -z "$SNARKJS" ]; then
    SNARKJS="npx snarkjs"
fi
SNARKJS="npx snarkjs"

echo ""
echo "╔══════════════════════════════════════════════════════╗"
echo "║  Invoice ZK Circuit — Compile + Groth16 Setup        ║"
echo "╚══════════════════════════════════════════════════════╝"
echo ""

# ── Step 1: Compile the Circom circuit ────────────────────────────────────────
echo "▶  [1/5] Compiling circuit: invoice.circom"
mkdir -p "$BUILD_DIR"
circom "$CIRCOM_FILE" \
    --r1cs \
    --wasm \
    --sym \
    --output "$BUILD_DIR"
echo "   ✅  Compilation successful"

# ── Step 2: Print constraint count ────────────────────────────────────────────
echo ""
echo "▶  [2/5] Circuit statistics:"
(cd "$ZK_DIR/.." && $SNARKJS r1cs info "$BUILD_DIR/invoice.r1cs")

# ── Step 3: Groth16 setup — initial zkey (ceremony round 0) ──────────────────
echo ""
echo "▶  [3/5] Groth16 setup — creating initial zkey (phase 2 ceremony)"
mkdir -p "$KEYS_DIR"
(cd "$ZK_DIR/.." && $SNARKJS groth16 setup \
    "$BUILD_DIR/invoice.r1cs" \
    "$PTAU" \
    "$KEYS_DIR/invoice_0000.zkey")
echo "   ✅  Initial zkey created"

# ── Step 4: Add a beacon contribution (deterministic, safe for development) ───
echo ""
echo "▶  [4/5] Contributing beacon to zkey (development beacon)"
(cd "$ZK_DIR/.." && $SNARKJS zkey beacon \
    "$KEYS_DIR/invoice_0000.zkey" \
    "$KEYS_DIR/invoice_final.zkey" \
    "0102030405060708090a0b0c0d0e0f101112131415161718191a1b1c1d1e1f" \
    10)
echo "   ✅  Final zkey created"

# ── Step 5: Export verification key ──────────────────────────────────────────
echo ""
echo "▶  [5/5] Exporting verification key"
(cd "$ZK_DIR/.." && $SNARKJS zkey export verificationkey \
    "$KEYS_DIR/invoice_final.zkey" \
    "$KEYS_DIR/verification_key.json")
echo "   ✅  Verification key exported"

echo ""
echo "╔══════════════════════════════════════════════════════╗"
echo "║  Setup complete. Files created:                       ║"
echo "║    build/invoice_js/invoice.wasm                      ║"
echo "║    build/invoice.r1cs                                 ║"
echo "║    build/invoice.sym                                  ║"
echo "║    keys/invoice_0000.zkey                             ║"
echo "║    keys/invoice_final.zkey                            ║"
echo "║    keys/verification_key.json                         ║"
echo "╚══════════════════════════════════════════════════════╝"
echo ""
echo "Next step:  bash zk/witness.sh"
