#!/usr/bin/env bash
# ============================================
# Lang Utils - Quick packaging script
# Installs deps (if missing) and builds the
# distributable Chrome .zip / Firefox .xpi.
#
# Usage:
#   ./package.sh                # both targets
#   ./package.sh chrome         # Chrome only
#   ./package.sh firefox        # Firefox only
# ============================================

set -euo pipefail

TARGET="${1:-all}"

case "$TARGET" in
  chrome|firefox|all) ;;
  *)
    echo "✗ Unknown target '$TARGET'. Use: chrome, firefox, or all."
    exit 1
    ;;
esac

cd "$(dirname "$0")"

if [ ! -d node_modules ]; then
  echo "▶ Installing dependencies..."
  npm install
fi

echo "▶ Packaging (${TARGET})..."
case "$TARGET" in
  chrome)  npm run package:chrome  ;;
  firefox) npm run package:firefox ;;
  all)     npm run package         ;;
esac

echo
echo "✓ Done. Artifacts:"
ls -lh releases/*.zip releases/*.xpi 2>/dev/null | awk '{printf "  %s  %s\n", $5, $NF}'
