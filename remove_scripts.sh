#!/usr/bin/env bash
# Safe interactive remover for the scripts/ directory.
# Usage: bash remove_scripts.sh --confirm
set -euo pipefail
TARGET="scripts"
if [ ! -d "$TARGET" ]; then
  echo "Directory '$TARGET' does not exist. Nothing to do."
  exit 0
fi
if [ "${1-}" != "--confirm" ]; then
  echo "This will permanently delete the '$TARGET' directory and its contents."
  echo
  echo "Dry-run: listing contents of $TARGET"
  ls -la "$TARGET"
  echo
  echo "To actually delete, run:"
  echo "  bash remove_scripts.sh --confirm"
  exit 0
fi
read -p "Type DELETE to permanently remove '$TARGET': " ans
if [ "$ans" != "DELETE" ]; then
  echo "Aborted. Type DELETE to confirm permanent deletion."
  exit 1
fi
rm -rf "$TARGET"
if [ ! -d "$TARGET" ]; then
  echo "'$TARGET' deleted."
else
  echo "Failed to delete '$TARGET'."
fi
exit 0
