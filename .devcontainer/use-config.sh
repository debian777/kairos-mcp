#!/usr/bin/env bash
# Switch between Dev Container configurations (simple vs fullstack)
# Usage: .devcontainer/use-config.sh [simple|fullstack]

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
LINK_PATH="${SCRIPT_DIR}/devcontainer.json"

usage() {
  echo "Usage: $0 [simple|fullstack]"
  echo ""
  echo "Switch between Dev Container configurations:"
  echo "  simple     - Node.js + Qdrant (default)"
  echo "  fullstack  - Node.js + Qdrant + Valkey + Postgres + Keycloak"
  echo ""
  echo "Current configuration:"
  if [ -L "$LINK_PATH" ]; then
    TARGET=$(readlink "$LINK_PATH")
    echo "  → $(basename "$TARGET") (symlink)"
  else
    echo "  → devcontainer.json (regular file)"
  fi
  exit 1
}

if [ $# -ne 1 ]; then
  usage
fi

CONFIG="$1"

case "$CONFIG" in
  simple)
    TARGET="devcontainer.json.base"
    ;;
  fullstack)
    TARGET="devcontainer-fullstack.json"
    ;;
  *)
    echo "Error: Unknown configuration '$CONFIG'"
    usage
    ;;
esac

# Check if target file exists
if [ ! -f "${SCRIPT_DIR}/${TARGET}" ]; then
  echo "Error: Target configuration file not found: ${TARGET}"
  exit 1
fi

# Remove existing symlink or file
if [ -L "$LINK_PATH" ] || [ -f "$LINK_PATH" ]; then
  rm "$LINK_PATH"
fi

# Create new symlink
ln -s "$TARGET" "$LINK_PATH"

echo "✓ Switched to '$CONFIG' configuration"
echo "  → devcontainer.json → $(readlink "$LINK_PATH")"
echo ""
echo "Next steps:"
echo "  1. Reopen in container (VS Code/Cursor will prompt)"
echo "  2. Run: npm run dev:deploy"
if [ "$CONFIG" = "fullstack" ]; then
  echo "  3. Run: npm run infra:up (initialize Keycloak realms)"
fi
