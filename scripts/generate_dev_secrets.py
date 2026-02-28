#!/usr/bin/env python3
"""
Generate .env and .env.dev from templates. Templates use __VAR_NAME__ placeholders
so the script can replace them in one go (env var or generated secret).

Source of truth: bkp/.env and bkp/.env.dev (or scripts/env/.env.template, scripts/env/.env.dev.template).

Usage:
  python scripts/generate_dev_secrets.py                    # generate .env and .env.dev from templates
  python scripts/generate_dev_secrets.py --write-templates    # write scripts/env/.env.template, scripts/env/.env.dev.template from bkp (secrets -> __VAR__)
  python scripts/generate_dev_secrets.py --verify              # only validate existing files
  KEYCLOAK_DB_PASSWORD=xxx python scripts/generate_dev_secrets.py

Templates (for GitHub): scripts/env/.env.template, scripts/env/.env.dev.template with secrets replaced by
  KEY=__KEY__  so replacements are trivial (same name as env var).
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


# Keys that must be secrets; in templates they appear as __KEY__ and get env or generated value.
SECRET_KEYS_INFRA = [
    "KEYCLOAK_ADMIN_PASSWORD",
    "KEYCLOAK_DB_PASSWORD",
    "QDRANT_API_KEY",
]
SECRET_KEYS_DEV = [
    "KEYCLOAK_ADMIN_PASSWORD",
    "KEYCLOAK_DB_PASSWORD",
    "QDRANT_API_KEY",
    "SESSION_SECRET",
    "OPENAI_API_KEY",
]

PLACEHOLDER_RE = re.compile(r"^__([A-Za-z_][A-Za-z0-9_]*)__$")


def is_placeholder(value: str) -> bool:
    return bool(value and PLACEHOLDER_RE.match(value.strip()))


def placeholder_for(key: str) -> str:
    return f"__{key}__"


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


def read_env_lines(path: Path) -> list[str]:
    """Read file as lines (preserve order and comments)."""
    if not path.exists():
        return []
    return path.read_text().splitlines()


def write_template_from_bkp(
    bkp_path: Path,
    out_path: Path,
    secret_keys: set[str],
) -> None:
    """Write template file: same as bkp but secret values replaced by __KEY__."""
    lines = read_env_lines(bkp_path)
    out_lines: list[str] = []
    for line in lines:
        stripped = line.strip()
        m = re.match(r"^([A-Za-z_][A-Za-z0-9_]*)=(.*)$", stripped) if stripped else None
        if m and m.group(1) in secret_keys:
            out_lines.append(f"{m.group(1)}={placeholder_for(m.group(1))}")
        else:
            out_lines.append(line)
    out_path.parent.mkdir(parents=True, exist_ok=True)
    out_path.write_text("\n".join(out_lines) + "\n")


def write_env_file(path: Path, data: dict[str, str], key_order: list[str] | None = None) -> None:
    """Write KEY=value file. If key_order given, output in that order; else sorted."""
    path.parent.mkdir(parents=True, exist_ok=True)
    if key_order:
        items = [(k, data[k]) for k in key_order if k in data]
        # append any keys in data not in key_order
        for k in sorted(data):
            if k not in {x[0] for x in items}:
                items.append((k, data[k]))
    else:
        items = sorted(data.items())
    lines = [f"{k}={v}" for k, v in items]
    path.write_text("\n".join(lines) + "\n")


def resolve_secrets(
    keys: list[str],
    existing: dict[str, str],
    force: bool,
) -> dict[str, str]:
    """For each key, return env or existing or generated secret. Used for .env."""
    resolved: dict[str, str] = {}
    for key in keys:
        val = os.environ.get(key) or existing.get(key)
        if val and not force:
            resolved[key] = val
        else:
            if key == "KEYCLOAK_ADMIN_PASSWORD" or key == "KEYCLOAK_DB_PASSWORD":
                resolved[key] = secrets.token_urlsafe(24)
            elif key == "QDRANT_API_KEY":
                resolved[key] = secrets.token_urlsafe(24)
            elif key == "SESSION_SECRET":
                resolved[key] = os.environ.get(key) or secrets.token_hex(32)
            elif key == "OPENAI_API_KEY":
                resolved[key] = os.environ.get(key) or ""
            else:
                resolved[key] = os.environ.get(key) or ""
    return resolved


def replace_placeholders(
    data: dict[str, str],
    secrets_infra: dict[str, str],
    secrets_dev: dict[str, str],
) -> dict[str, str]:
    """Replace any value __KEY__ with actual value from secrets or env."""
    out: dict[str, str] = {}
    for k, v in data.items():
        v = (v or "").strip()
        if is_placeholder(v):
            var_name = PLACEHOLDER_RE.match(v).group(1)
            val = secrets_dev.get(var_name) or secrets_infra.get(var_name) or os.environ.get(var_name) or ""
            out[k] = val
        else:
            out[k] = v
    return out


def main() -> None:
    ap = argparse.ArgumentParser(description="Generate .env and .env.dev from bkp/templates.")
    ap.add_argument("--write-templates", action="store_true", help="Write scripts/env/.env.template and scripts/env/.env.dev.template from bkp (secrets -> __VAR__)")
    ap.add_argument("--verify", action="store_true", help="Only validate existing .env and .env.dev")
    ap.add_argument("--force", action="store_true", help="Regenerate secrets even if present")
    args = ap.parse_args()

    root = root_dir()
    bkp = root / "bkp"
    env_infra = root / ".env"
    env_dev = root / ".env.dev"
    env_dir = root / "scripts" / "env"
    env_tpl = env_dir / ".env.template"
    env_dev_tpl = env_dir / ".env.dev.template"

    if args.write_templates:
        if not (bkp / ".env").exists() or not (bkp / ".env.dev").exists():
            raise SystemExit("bkp/.env and bkp/.env.dev must exist to write templates.")
        write_template_from_bkp(bkp / ".env", env_tpl, set(SECRET_KEYS_INFRA))
        write_template_from_bkp(bkp / ".env.dev", env_dev_tpl, set(SECRET_KEYS_DEV))
        print("Wrote scripts/env/.env.template and scripts/env/.env.dev.template (secrets replaced by __VAR__).")
        return

    if args.verify:
        for path, name, required in [
            (env_infra, ".env", SECRET_KEYS_INFRA),
            (env_dev, ".env.dev", ["REDIS_URL", "QDRANT_URL", "QDRANT_COLLECTION"]),
        ]:
            if not path.exists():
                raise SystemExit(f"{name}: file not found: {path}")
            data = parse_env_file(path)
            missing = [k for k in required if k not in data or not (data.get(k) or "").strip()]
            if missing:
                raise SystemExit(f"{name}: missing or empty: {', '.join(missing)}")
        print("Verify OK: .env and .env.dev have required keys.")
        return

    # --- Generate .env and .env.dev ---
    # Prefer template files; fallback to bkp
    infra_src = env_tpl if env_tpl.exists() else bkp / ".env"
    dev_src = env_dev_tpl if env_dev_tpl.exists() else bkp / ".env.dev"
    if not infra_src.exists():
        raise SystemExit("Need scripts/env/.env.template or bkp/.env to generate .env")
    if not dev_src.exists():
        raise SystemExit("Need scripts/env/.env.dev.template or bkp/.env.dev to generate .env.dev")

    existing_infra = parse_env_file(env_infra)
    secrets_infra = resolve_secrets(SECRET_KEYS_INFRA, existing_infra, args.force)
    infra_data = parse_env_file(infra_src)
    infra_data = replace_placeholders(infra_data, secrets_infra, secrets_infra)
    # Ensure all infra keys have a value
    for k in SECRET_KEYS_INFRA:
        if k not in infra_data or not (infra_data.get(k) or "").strip():
            infra_data[k] = secrets_infra.get(k, "")
    write_env_file(env_infra, infra_data)
    print("Wrote .env (Keycloak/Postgres/Qdrant).")

    # .env.dev: same secrets as .env for KEYCLOAK_* and QDRANT_API_KEY
    dev_data = parse_env_file(dev_src)
    dev_data = replace_placeholders(dev_data, secrets_infra, {**secrets_infra, **resolve_secrets(SECRET_KEYS_DEV, parse_env_file(env_dev), args.force)})
    # Sync infra credentials into .env.dev
    for key in ["KEYCLOAK_ADMIN_PASSWORD", "KEYCLOAK_DB_PASSWORD", "QDRANT_API_KEY"]:
        if secrets_infra.get(key):
            dev_data[key] = secrets_infra[key]
    # Ensure SESSION_SECRET and OPENAI_API_KEY if still placeholder/empty
    if not (dev_data.get("SESSION_SECRET") or "").strip():
        dev_data["SESSION_SECRET"] = os.environ.get("SESSION_SECRET") or secrets.token_hex(32)
    if not (dev_data.get("OPENAI_API_KEY") or "").strip():
        dev_data["OPENAI_API_KEY"] = os.environ.get("OPENAI_API_KEY") or ""

    # Preserve key order from source (KEY= or #KEY=)
    dev_order: list[str] = []
    for line in read_env_lines(dev_src):
        s = line.strip()
        m = re.match(r"^#?\s*([A-Za-z_][A-Za-z0-9_]*)=", s)
        if m and m.group(1) not in dev_order:
            dev_order.append(m.group(1))
    write_env_file(env_dev, dev_data, key_order=dev_order if dev_order else None)
    print("Wrote .env.dev (synced with .env credentials).")

    # Validation
    for path, name, required in [
        (env_infra, ".env", SECRET_KEYS_INFRA),
        (env_dev, ".env.dev", ["REDIS_URL", "QDRANT_URL", "QDRANT_COLLECTION"]),
    ]:
        data = parse_env_file(path)
        missing = [k for k in required if k not in data or not (data.get(k) or "").strip()]
        if missing:
            raise SystemExit(f"{name}: missing or empty after write: {', '.join(missing)}")

    print("Done. Use: docker compose --env-file .env.dev --profile infra up -d")


if __name__ == "__main__":
    main()
    sys.exit(0)
