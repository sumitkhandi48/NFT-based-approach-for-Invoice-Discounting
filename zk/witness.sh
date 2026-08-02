#!/usr/bin/env bash
# =============================================================================
#  witness.sh — Phase 2 ZK: Generate the witness from input.json
#
#  Reads  : zk/input.json
#  Reads  : zk/build/invoice_js/invoice.wasm  (from compile.sh)
#  Writes : zk/witness/witness.wtns
# =============================================================================

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ZK_DIR="$SCRIPT_DIR"
WASM="$ZK_DIR/build/invoice_js/invoice.wasm"
INPUT="$ZK_DIR/input.json"
WITNESS_DIR="$ZK_DIR/witness"
WITNESS="$WITNESS_DIR/witness.wtns"

echo ""
echo "╔══════════════════════════════════════════════════════╗"
echo "║  Invoice ZK Circuit — Witness Generation              ║"
echo "╚══════════════════════════════════════════════════════╝"
echo ""

# Guard: wasm must exist (run compile.sh first)
if [ ! -f "$WASM" ]; then
    echo "❌  WASM file not found: $WASM"
    echo "    Run  bash zk/compile.sh  first."
    exit 1
fi

# Guard: input.json must exist
if [ ! -f "$INPUT" ]; then
    echo "❌  Input file not found: $INPUT"
    exit 1
fi

mkdir -p "$WITNESS_DIR"

echo "▶  Generating witness from input.json ..."
echo "   Input  : $INPUT"
echo "   WASM   : $WASM"
echo "   Output : $WITNESS"
echo ""

# snarkjs wtns calculate  <wasm>  <input.json>  <witness.wtns>
(cd "$ZK_DIR/.." && npx snarkjs wtns calculate \
    "$WASM" \
    "$INPUT" \
    "$WITNESS")

echo "   ✅  Witness generated successfully"

# Optional: check witness satisfies all r1cs constraints
echo ""
echo "▶  Checking witness against r1cs constraints ..."
(cd "$ZK_DIR/.." && npx snarkjs wtns check \
    "$ZK_DIR/build/invoice.r1cs" \
    "$WITNESS" && echo "   ✅  All constraints satisfied")

echo ""
echo "╔══════════════════════════════════════════════════════╗"
echo "║  Witness generated: witness/witness.wtns             ║"
echo "╚══════════════════════════════════════════════════════╝"
echo ""
echo "Next step:  bash zk/prove.sh"
