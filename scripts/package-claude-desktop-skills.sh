#!/usr/bin/env bash
# Package Agent Skills folders as one .zip per skill for Claude Desktop import
# (Settings → Skills → import). Usage: scripts/package-claude-desktop-skills.sh <semver>
set -euo pipefail

VERSION="${1:?usage: package-claude-desktop-skills.sh <semver>}"
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
OUT="${ROOT}/dist/claude-desktop-skills"
STAGE="$(mktemp -d)"

cleanup() {
  rm -rf "${STAGE}"
}
trap cleanup EXIT

mkdir -p "${OUT}"

package_skill() {
  local src_rel="$1"
  local zip_base="$2"
  local src="${ROOT}/skills/${src_rel}"
  if [[ ! -d "${src}" ]] || [[ ! -f "${src}/SKILL.md" ]]; then
    echo "package-claude-desktop-skills: missing skill at skills/${src_rel}" >&2
    exit 1
  fi
  rm -rf "${STAGE}/pack"
  mkdir -p "${STAGE}/pack/${zip_base}"
  cp -R "${src}/." "${STAGE}/pack/${zip_base}/"
  (cd "${STAGE}/pack" && zip -qr "${OUT}/${zip_base}-claude-desktop-${VERSION}.zip" "${zip_base}")
}

package_skill kairos kairos
package_skill .system/kairos-bug-report kairos-bug-report
package_skill .system/kairos-install kairos-install

echo "Wrote:"
ls -1 "${OUT}"
