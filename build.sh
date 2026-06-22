#!/bin/bash
set -e

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
cd "${SCRIPT_DIR}"

# Syntax check all JS files
echo "Checking syntax..."
ERRORS=0
for f in *.js popup/*.js options/*.js chatbot/*.js; do
  if ! node --check "$f" 2>/dev/null; then
    echo "  SYNTAX ERROR: $f"
    node --check "$f"
    ERRORS=$((ERRORS + 1))
  fi
done
if [ "$ERRORS" -gt 0 ]; then
  echo "Build aborted: $ERRORS file(s) with syntax errors"
  exit 1
fi
echo "All JS files OK"

# Clean previous build
rm -rf build
mkdir -p build

# Files to include in the extension
INCLUDES=(
  manifest.json
  background.js
  content.js
  utils.js
  i18n.js
  _locales/
  icons/
  popup/
  options/
  chatbot/
)

# Create the .xpi file (just a zip)
XPI_NAME="lang-utils-$(grep '"version"' manifest.json | sed 's/.*"\(.*\)".*/\1/').xpi"

echo "Building ${XPI_NAME}..."
zip -r "${XPI_NAME}" "${INCLUDES[@]}"

echo "Built: ${SCRIPT_DIR}/${XPI_NAME}"
echo "Done."
