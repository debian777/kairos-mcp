#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
BIN_DIR="${ROOT_DIR}/.local/bin"
STATE_DIR="${ROOT_DIR}/.local/qdrant-binary"
PID_FILE="${STATE_DIR}/qdrant.pid"
LOG_FILE="${STATE_DIR}/qdrant.log"
INSTALLED_TAG_FILE="${STATE_DIR}/INSTALLED_TAG"

QDRANT_REPO="${QDRANT_REPO:-qdrant/qdrant}"
QDRANT_VERSION="${QDRANT_VERSION:-latest}"

usage() {
  cat <<'EOF'
Usage: scripts/qdrant-binary.sh <command>

Commands:
  install   Download/install or update the Qdrant binary into .local/bin
  start     Start Qdrant (installs/updates first when run via npm script)
  stop      Stop Qdrant started by this script
  status    Print whether Qdrant is running (based on pidfile)

Environment:
  QDRANT_VERSION=latest|<version>   Version tag (e.g. 1.14.0 or v1.14.0)
  QDRANT_REPO=qdrant/qdrant         GitHub repo for releases
  QDRANT_HOST=127.0.0.1             Bind host (best-effort; depends on Qdrant env parsing)
  QDRANT_HTTP_PORT=6333             REST API port (best-effort; depends on Qdrant env parsing)
  QDRANT_GRPC_PORT=6334             gRPC port (best-effort; depends on Qdrant env parsing)
EOF
}

die() {
  printf 'error: %s\n' "$*" >&2
  exit 1
}

need_cmd() {
  command -v "$1" >/dev/null 2>&1 || die "missing required command: $1"
}

normalize_tag() {
  local v="$1"
  if [[ "$v" == "latest" ]]; then
    printf '%s\n' "latest"
    return 0
  fi
  v="${v#v}"
  printf 'v%s\n' "$v"
}

get_latest_tag() {
  local url
  url="$(curl -fsSL -o /dev/null -w '%{url_effective}' "https://github.com/${QDRANT_REPO}/releases/latest")"
  printf '%s\n' "${url##*/}"
}

detect_target() {
  local os arch triple
  os="$(uname -s | tr '[:upper:]' '[:lower:]')"
  arch="$(uname -m | tr '[:upper:]' '[:lower:]')"

  case "$os" in
    linux) triple="unknown-linux-gnu" ;;
    darwin) triple="apple-darwin" ;;
    *) die "unsupported operating system: ${os}" ;;
  esac

  case "$arch" in
    x86_64|amd64) arch="x86_64" ;;
    arm64|aarch64) arch="aarch64" ;;
    *) die "unsupported cpu architecture: ${arch}" ;;
  esac

  printf '%s\n' "${arch}-${triple}"
}

is_running() {
  if [[ ! -f "${PID_FILE}" ]]; then
    return 1
  fi

  local pid
  pid="$(cat "${PID_FILE}" 2>/dev/null || true)"
  if [[ -z "${pid}" ]]; then
    rm -f "${PID_FILE}"
    return 1
  fi

  if kill -0 "${pid}" 2>/dev/null; then
    return 0
  fi

  rm -f "${PID_FILE}"
  return 1
}

status_cmd() {
  if is_running; then
    printf 'running (pid %s)\n' "$(cat "${PID_FILE}")"
  else
    printf 'not running\n'
  fi
}

install_cmd() {
  need_cmd curl
  need_cmd tar
  need_cmd uname
  need_cmd mktemp

  mkdir -p "${BIN_DIR}" "${STATE_DIR}"

  local desired_tag target installed_tag
  if [[ "${QDRANT_VERSION}" == "latest" ]]; then
    desired_tag="$(get_latest_tag)"
  else
    desired_tag="$(normalize_tag "${QDRANT_VERSION}")"
  fi

  target="$(detect_target)"

  installed_tag=""
  if [[ -f "${INSTALLED_TAG_FILE}" ]]; then
    installed_tag="$(cat "${INSTALLED_TAG_FILE}" 2>/dev/null || true)"
  fi

  if [[ -x "${BIN_DIR}/qdrant" && "${installed_tag}" == "${desired_tag}" ]]; then
    printf 'qdrant already installed (%s)\n' "${desired_tag}"
    return 0
  fi

  local tmp_dir asset_urls url tarball found
  tmp_dir="$(mktemp -d)"
  trap '[[ -n "${tmp_dir:-}" ]] && rm -rf "${tmp_dir}"' EXIT

  tarball="${tmp_dir}/qdrant.tar.gz"
  found=""
  asset_urls=(
    "https://github.com/${QDRANT_REPO}/releases/download/${desired_tag}/qdrant-${target}.tar.gz"
    "https://github.com/${QDRANT_REPO}/releases/latest/download/qdrant-${target}.tar.gz"
  )

  for url in "${asset_urls[@]}"; do
    if curl -fLsS "${url}" -o "${tarball}"; then
      found="${url}"
      break
    fi
  done

  if [[ -z "${found}" ]]; then
    die "failed to download qdrant binary (tried: ${asset_urls[*]})"
  fi

  tar -xzf "${tarball}" -C "${tmp_dir}"

  local extracted
  extracted="$(find "${tmp_dir}" -type f -name qdrant -perm -u+x -print -quit 2>/dev/null || true)"
  if [[ -z "${extracted}" ]]; then
    extracted="$(find "${tmp_dir}" -type f -name qdrant -print -quit 2>/dev/null || true)"
  fi
  if [[ -z "${extracted}" ]]; then
    die "downloaded archive did not contain a qdrant binary: ${found}"
  fi

  local staged
  staged="${tmp_dir}/qdrant.staged"
  cp "${extracted}" "${staged}"
  chmod 0755 "${staged}"

  mv -f "${staged}" "${BIN_DIR}/qdrant"
  printf '%s\n' "${desired_tag}" > "${INSTALLED_TAG_FILE}"

  printf 'installed qdrant %s to %s (source: %s)\n' "${desired_tag}" "${BIN_DIR}/qdrant" "${found}"
}

start_cmd() {
  need_cmd uname

  mkdir -p "${STATE_DIR}"

  if is_running; then
    printf 'qdrant already running (pid %s)\n' "$(cat "${PID_FILE}")"
    return 0
  fi

  if [[ -f "${PID_FILE}" ]]; then
    rm -f "${PID_FILE}"
  fi

  if [[ ! -x "${BIN_DIR}/qdrant" ]]; then
    die "qdrant binary not found at ${BIN_DIR}/qdrant (run: install)"
  fi

  : > "${LOG_FILE}"

  local host http_port grpc_port
  host="${QDRANT_HOST:-127.0.0.1}"
  http_port="${QDRANT_HTTP_PORT:-6333}"
  grpc_port="${QDRANT_GRPC_PORT:-6334}"

  (
    cd "${STATE_DIR}"
    QDRANT__SERVICE__HOST="${host}" \
      QDRANT__SERVICE__HTTP_PORT="${http_port}" \
      QDRANT__SERVICE__GRPC_PORT="${grpc_port}" \
      QDRANT__STORAGE__STORAGE_PATH="${STATE_DIR}/storage" \
      QDRANT__STORAGE__SNAPSHOTS_PATH="${STATE_DIR}/snapshots" \
      QDRANT__STORAGE__TEMP_PATH="${STATE_DIR}/tmp" \
      nohup "${BIN_DIR}/qdrant" >> "${LOG_FILE}" 2>&1 &
    printf '%s\n' "$!" > "${PID_FILE}"
  )

  local i
  for i in $(seq 1 20); do
    if ! is_running; then
      printf 'qdrant failed to start; last log lines:\n' >&2
      tail -n 40 "${LOG_FILE}" >&2 || true
      return 1
    fi
    sleep 0.25
  done

  printf 'started qdrant (pid %s)\n' "$(cat "${PID_FILE}")"
}

stop_cmd() {
  if [[ ! -f "${PID_FILE}" ]]; then
    printf 'qdrant already stopped\n'
    return 0
  fi

  local pid
  pid="$(cat "${PID_FILE}" 2>/dev/null || true)"
  if [[ -z "${pid}" ]]; then
    rm -f "${PID_FILE}"
    printf 'qdrant already stopped\n'
    return 0
  fi

  if ! kill -0 "${pid}" 2>/dev/null; then
    rm -f "${PID_FILE}"
    printf 'qdrant already stopped\n'
    return 0
  fi

  kill "${pid}" 2>/dev/null || true

  local i
  for i in $(seq 1 40); do
    if ! kill -0 "${pid}" 2>/dev/null; then
      rm -f "${PID_FILE}"
      printf 'stopped qdrant\n'
      return 0
    fi
    sleep 0.25
  done

  kill -9 "${pid}" 2>/dev/null || true
  rm -f "${PID_FILE}"
  printf 'stopped qdrant (forced)\n'
}

main() {
  local cmd="${1:-}"
  case "${cmd}" in
    install) install_cmd ;;
    start) start_cmd ;;
    stop) stop_cmd ;;
    status) status_cmd ;;
    ""|help|-h|--help) usage ;;
    *) die "unknown command: ${cmd}" ;;
  esac
}

main "$@"
