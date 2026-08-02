#!/usr/bin/env bash
# =============================================================================
#  verify.sh — Phase 2 ZK: Verify the Groth16 proof locally
#
#  Reads  : zk/keys/verification_key.json  (from compile.sh)
#  Reads  : zk/proofs/public.json          (from prove.sh)
#  Reads  : zk/proofs/proof.json           (from prove.sh)
#
#  Expected output on success:
#    [INFO]  snarkJS: OK!
# =============================================================================

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ZK_DIR="$SCRIPT_DIR"
VKEY="$ZK_DIR/keys/verification_key.json"
PROOF="$ZK_DIR/proofs/proof.json"
PUBLIC="$ZK_DIR/proofs/public.json"

echo ""
echo "╔══════════════════════════════════════════════════════╗"
echo "║  Invoice ZK Circuit — Groth16 Proof Verification     ║"
echo "╚══════════════════════════════════════════════════════╝"
echo ""

# Guards
for f in "$VKEY" "$PROOF" "$PUBLIC"; do
    if [ ! -f "$f" ]; then
        echo "❌  Required file not found: $f"
        echo "    Run the pipeline:  compile.sh → witness.sh → prove.sh → verify.sh"
        exit 1
    fi
done

echo "▶  Verifying proof ..."
echo "   Verification key : $VKEY"
echo "   Public signals   : $PUBLIC"
echo "   Proof            : $PROOF"
echo ""

# snarkjs groth16 verify  <verification_key.json>  <public.json>  <proof.json>
RESULT=$(cd "$ZK_DIR/.." && npx snarkjs groth16 verify \
    "$VKEY" \
    "$PUBLIC" \
    "$PROOF" 2>&1)

echo "$RESULT"
echo ""

if echo "$RESULT" | grep -q "OK"; then
    echo "╔══════════════════════════════════════════════════════╗"
    echo "║  ✅  PROOF VERIFIED — snarkJS: OK!                   ║"
    echo "║                                                      ║"
    echo "║  The prover demonstrated, without revealing          ║"
    echo "║  invoiceAmount or invoiceSecret, that:               ║"
    echo "║    • Poseidon(id,buyer,amount,secret) == commitment  ║"
    echo "║    • invoiceAmount >= minimumThreshold               ║"
    echo "╚══════════════════════════════════════════════════════╝"
    exit 0
else
    echo "╔══════════════════════════════════════════════════════╗"
    echo "║  ❌  PROOF INVALID                                    ║"
    echo "╚══════════════════════════════════════════════════════╝"
    exit 1
fi
