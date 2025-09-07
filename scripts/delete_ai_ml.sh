#!/usr/bin/env bash
# Safe deletion script for ai_ml folder.
# Usage: bash scripts/delete_ai_ml.sh --confirm
set -euo pipefail
TARGET="ai_ml"
if [ ! -d "$TARGET" ]; then
  echo "Folder '$TARGET' not found in project root. Nothing to do."
  exit 0
fi
if [ "${1-}" != "--confirm" ]; then
  echo "THIS WILL DELETE the folder '$TARGET' permanently from the repository when run with --confirm."
  echo "Dry-run output (listing contents):"
  echo
  ls -la "$TARGET"
  echo
  echo "To actually delete, run:"
  echo "  bash scripts/delete_ai_ml.sh --confirm"
  exit 0
fi
# Confirm again interactively
read -p "Are you 100% sure you want to permanently delete '$TARGET'? Type DELETE to proceed: " ans
if [ "$ans" != "DELETE" ]; then
  echo "Aborted. Type DELETE to confirm permanent deletion."
  exit 1
fi
rm -rf "$TARGET"
echo "Deleted '$TARGET'"
exit 0
