#!/usr/bin/env bash
# =============================================================================
#  prove.sh — Phase 2 ZK: Generate a Groth16 proof from the witness
#
#  Reads  : zk/witness/witness.wtns  (from witness.sh)
#  Reads  : zk/keys/invoice_final.zkey  (from compile.sh)
#  Writes : zk/proofs/proof.json
#  Writes : zk/proofs/public.json
# =============================================================================

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ZK_DIR="$SCRIPT_DIR"
WITNESS="$ZK_DIR/witness/witness.wtns"
ZKEY="$ZK_DIR/keys/invoice_final.zkey"
PROOFS_DIR="$ZK_DIR/proofs"
PROOF="$PROOFS_DIR/proof.json"
PUBLIC="$PROOFS_DIR/public.json"

echo ""
echo "╔══════════════════════════════════════════════════════╗"
echo "║  Invoice ZK Circuit — Groth16 Proof Generation       ║"
echo "╚══════════════════════════════════════════════════════╝"
echo ""

# Guards
if [ ! -f "$WITNESS" ]; then
    echo "❌  Witness not found: $WITNESS"
    echo "    Run  bash zk/witness.sh  first."
    exit 1
fi

if [ ! -f "$ZKEY" ]; then
    echo "❌  Final zkey not found: $ZKEY"
    echo "    Run  bash zk/compile.sh  first."
    exit 1
fi

mkdir -p "$PROOFS_DIR"

echo "▶  Generating Groth16 proof ..."
echo "   Witness : $WITNESS"
echo "   ZKey    : $ZKEY"
echo "   Proof   : $PROOF"
echo "   Public  : $PUBLIC"
echo ""

# snarkjs groth16 prove  <final.zkey>  <witness.wtns>  <proof.json>  <public.json>
(cd "$ZK_DIR/.." && npx snarkjs groth16 prove \
    "$ZKEY" \
    "$WITNESS" \
    "$PROOF" \
    "$PUBLIC")

echo "   ✅  Proof generated"
echo ""

# Pretty-print the public signals
echo "▶  Public signals (public.json):"
cat "$PUBLIC"
echo ""

echo "▶  Proof structure (proof.json) — first 5 lines:"
head -6 "$PROOF"
echo "   ..."
echo ""

echo "╔══════════════════════════════════════════════════════╗"
echo "║  Proof generated:                                    ║"
echo "║    proofs/proof.json                                 ║"
echo "║    proofs/public.json                                ║"
echo "╚══════════════════════════════════════════════════════╝"
echo ""
echo "Next step:  bash zk/verify.sh"
