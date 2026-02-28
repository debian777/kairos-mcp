#!/usr/bin/env python3
"""
Generate .env (infra) and .env.dev (application) for compose and dev/CI.
- .env: infra secrets only (Keycloak, Postgres). Compose services use env_file: .env.
- .env.dev: application config. Sourced by run-env.sh and app.

Usage:
  python scripts/generate_dev_secrets.py [--ci] [--force]
  OPENAI_API_KEY=sk-... python scripts/generate_dev_secrets.py --ci

Env (optional): KEYCLOAK_ADMIN_PASSWORD, KEYCLOAK_DB_PASSWORD, SESSION_SECRET,
  OPENAI_API_KEY, QDRANT_API_KEY, QDRANT_COLLECTION, REDIS_URL, QDRANT_URL, etc.
"""
from __future__ import annotations

import argparse
import os
import re
import secrets
import sys
from pathlib import Path


def root_dir() -> Path:
    return Path(__file__).resolve().parent.parent


def parse_env_file(path: Path) -> dict[str, str]:
    """Parse KEY=value lines; skip comments and empty. Returns dict key -> value."""
    out: dict[str, str] = {}
    if not path.exists():
        return out
    for line in path.read_text().splitlines():
        line = line.strip()
        if not line or line.startswith("#"):
            continue
        m = re.match(r"^([A-Za-z_][A-Za-z0-9_]*)=(.*)$", line)
        if m:
            out[m.group(1)] = m.group(2)
    return out


def write_env_file(path: Path, data: dict[str, str]) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    lines = [f"{k}={v}" for k, v in sorted(data.items())]
    path.write_text("\n".join(lines) + "\n")


def set_var(
    data: dict[str, str],
    key: str,
    value: str | None,
    default: str | None = None,
    force: bool = False,
) -> None:
    """Set key from value (env), else default, if non-empty. Skip if empty and not force."""
    v = value if value is not None else os.environ.get(key)
    v = (v or default or "").strip()
    if not v and not force:
        return
    if key in data and not force:
        return
    data[key] = v


# --- Infra: .env (compose postgres/keycloak) ---
INFRA_KEYS = [
    "KEYCLOAK_ADMIN_PASSWORD",
    "KEYCLOAK_DB_PASSWORD",
]

def ensure_infra_env(env_path: Path, force: bool) -> None:
    data = parse_env_file(env_path)
    existing = {k: data[k] for k in INFRA_KEYS if k in data and data[k]} if not force else {}

    admin = os.environ.get("KEYCLOAK_ADMIN_PASSWORD") or existing.get("KEYCLOAK_ADMIN_PASSWORD")
    if not admin:
        admin = secrets.token_urlsafe(24)
    db = os.environ.get("KEYCLOAK_DB_PASSWORD") or existing.get("KEYCLOAK_DB_PASSWORD")
    if not db:
        db = secrets.token_urlsafe(24)

    data["KEYCLOAK_ADMIN_PASSWORD"] = admin
    data["KEYCLOAK_DB_PASSWORD"] = db
    write_env_file(env_path, data)
    print("Ensured infra secrets in .env (Keycloak/Postgres).")


# --- App: .env.dev ---
# All vars we may set. Required for validation when AUTH_ENABLED=true are marked.
DEV_VARS = [
    "KEYCLOAK_ADMIN_PASSWORD",
    "KEYCLOAK_DB_PASSWORD",
    "REDIS_URL",
    "QDRANT_URL",
    "QDRANT_COLLECTION",
    "AUTH_ENABLED",
    "KEYCLOAK_URL",
    "KEYCLOAK_REALM",
    "KEYCLOAK_CLIENT_ID",
    "AUTH_CALLBACK_BASE_URL",
    "SESSION_SECRET",
    "OPENAI_API_KEY",
    "QDRANT_API_KEY",
    "PORT",
]

def ensure_dev_env(env_path: Path, template_path: Path, infra_path: Path, ci: bool, force: bool) -> None:
    if env_path.exists():
        data = parse_env_file(env_path)
    elif template_path.exists():
        data = parse_env_file(template_path)
        print("Created .env.dev from env.example.txt.")
    else:
        data = {}
        print("Created empty .env.dev (env.example.txt not found).")

    # Sync infra secrets into .env.dev for consistency (infra_path already written by ensure_infra_env)
    infra = parse_env_file(infra_path)
    if infra.get("KEYCLOAK_ADMIN_PASSWORD"):
        data["KEYCLOAK_ADMIN_PASSWORD"] = infra["KEYCLOAK_ADMIN_PASSWORD"]
    if infra.get("KEYCLOAK_DB_PASSWORD"):
        data["KEYCLOAK_DB_PASSWORD"] = infra["KEYCLOAK_DB_PASSWORD"]

    if ci:
        session = os.environ.get("SESSION_SECRET") or secrets.token_hex(32)
        set_var(data, "REDIS_URL", None, "redis://127.0.0.1:6379", force=True)
        set_var(data, "QDRANT_URL", None, "http://127.0.0.1:6333", force=True)
        set_var(data, "QDRANT_COLLECTION", os.environ.get("QDRANT_COLLECTION"), "kairos_dev", force=True)
        set_var(data, "AUTH_ENABLED", None, "true", force=True)
        set_var(data, "KEYCLOAK_URL", None, "http://localhost:8080", force=True)
        set_var(data, "KEYCLOAK_REALM", None, "kairos-dev", force=True)
        set_var(data, "KEYCLOAK_CLIENT_ID", None, "kairos-mcp", force=True)
        set_var(data, "AUTH_CALLBACK_BASE_URL", None, "http://localhost:3300", force=True)
        set_var(data, "SESSION_SECRET", session, None, force=True)
        set_var(data, "OPENAI_API_KEY", os.environ.get("OPENAI_API_KEY"), "", force=True)
        set_var(data, "QDRANT_API_KEY", os.environ.get("QDRANT_API_KEY"), "", force=True)
        set_var(data, "PORT", os.environ.get("PORT"), "3300", force=True)
        print("Set CI defaults and env overrides in .env.dev.")

    write_env_file(env_path, data)


# --- Validation ---
def validate_env(path: Path, required: list[str], name: str) -> None:
    if not path.exists():
        raise SystemExit(f"{name}: file not found: {path}")
    data = parse_env_file(path)
    missing = []
    empty = []
    for k in required:
        if k not in data:
            missing.append(k)
        elif not (data[k] or "").strip():
            empty.append(k)
    if missing:
        raise SystemExit(f"{name}: missing keys: {', '.join(missing)}")
    if empty:
        raise SystemExit(f"{name}: empty values for: {', '.join(empty)}")


def main() -> None:
    ap = argparse.ArgumentParser(description="Generate .env and .env.dev for infra and app.")
    ap.add_argument("--ci", action="store_true", help="Set CI defaults in .env.dev")
    ap.add_argument("--force", action="store_true", help="Overwrite existing values")
    args = ap.parse_args()

    root = root_dir()
    env_infra = root / ".env"
    env_dev = root / ".env.dev"
    template = root / "env.example.txt"

    ensure_infra_env(env_infra, args.force)
    ensure_dev_env(env_dev, template, env_infra, args.ci, args.force)

    # Validation: required keys must exist and be non-empty
    validate_env(env_infra, INFRA_KEYS, ".env")

    dev_required = ["REDIS_URL", "QDRANT_URL", "QDRANT_COLLECTION"]
    dev_data = parse_env_file(env_dev)
    if (dev_data.get("AUTH_ENABLED") or "").strip().lower() == "true":
        dev_required.extend([
            "KEYCLOAK_URL", "KEYCLOAK_REALM", "KEYCLOAK_CLIENT_ID",
            "AUTH_CALLBACK_BASE_URL", "SESSION_SECRET",
        ])
    validate_env(env_dev, dev_required, ".env.dev")

    print("Done. Use: docker compose --env-file .env.dev --profile infra up -d")


if __name__ == "__main__":
    main()
    sys.exit(0)
