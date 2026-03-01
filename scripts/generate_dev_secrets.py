#!/usr/bin/env python3
"""
Generate .env from template. Template uses __VAR_NAME__ placeholders
so the script can replace them in one go (env var or generated secret).

Source of truth: scripts/env/.env.template (single file: infra + app config).

Usage:
  python scripts/generate_dev_secrets.py                    # generate .env from template
  python scripts/generate_dev_secrets.py --write-templates  # write .env.template from bkp (secrets -> __VAR__)
  python scripts/generate_dev_secrets.py --verify          # only validate existing .env
  KEYCLOAK_DB_PASSWORD=xxx python scripts/generate_dev_secrets.py
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


# Keys that must be secrets; in template they appear as __KEY__ and get env or generated value.
SECRET_KEYS = [
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
    """For each key, return env or existing or generated secret."""
    resolved: dict[str, str] = {}
    for key in keys:
        val = os.environ.get(key) or existing.get(key)
        if val and not force:
            resolved[key] = val
        else:
            if key in ("KEYCLOAK_ADMIN_PASSWORD", "KEYCLOAK_DB_PASSWORD", "QDRANT_API_KEY"):
                resolved[key] = secrets.token_urlsafe(24)
            elif key == "SESSION_SECRET":
                resolved[key] = os.environ.get(key) or secrets.token_hex(32)
            elif key == "OPENAI_API_KEY":
                resolved[key] = os.environ.get(key) or ""
            else:
                resolved[key] = os.environ.get(key) or ""
    return resolved


def replace_placeholders(data: dict[str, str], secrets_resolved: dict[str, str]) -> dict[str, str]:
    """Replace any value __KEY__ with actual value from secrets or env."""
    out: dict[str, str] = {}
    for k, v in data.items():
        v = (v or "").strip()
        if is_placeholder(v):
            var_name = PLACEHOLDER_RE.match(v).group(1)
            out[k] = secrets_resolved.get(var_name) or os.environ.get(var_name) or ""
        else:
            out[k] = v
    return out


def main() -> None:
    ap = argparse.ArgumentParser(description="Generate .env from template.")
    ap.add_argument("--write-templates", action="store_true", help="Write scripts/env/.env.template from bkp (secrets -> __VAR__)")
    ap.add_argument("--verify", action="store_true", help="Only validate existing .env")
    ap.add_argument("--force", action="store_true", help="Regenerate secrets even if present")
    args = ap.parse_args()

    root = root_dir()
    bkp = root / "bkp"
    env_file = root / ".env"
    env_dir = root / "scripts" / "env"
    env_tpl = env_dir / ".env.template"

    if args.write_templates:
        # Require a single bkp file; prefer bkp/.env then merge with bkp/.env.dev if both exist
        if (bkp / ".env").exists() and (bkp / ".env.dev").exists():
            infra = parse_env_file(bkp / ".env")
            dev = parse_env_file(bkp / ".env.dev")
            merged = {**infra, **dev}
            merged_path = env_dir / ".env.merged.bkp"
            write_env_file(merged_path, merged)
            write_template_from_bkp(merged_path, env_tpl, set(SECRET_KEYS))
            merged_path.unlink(missing_ok=True)
        elif (bkp / ".env").exists():
            write_template_from_bkp(bkp / ".env", env_tpl, set(SECRET_KEYS))
        else:
            raise SystemExit("bkp/.env (or bkp/.env + bkp/.env.dev) must exist to write template.")
        print("Wrote scripts/env/.env.template (secrets replaced by __VAR__).")
        return

    if args.verify:
        if not env_file.exists():
            raise SystemExit(".env: file not found")
        data = parse_env_file(env_file)
        required = ["REDIS_URL", "QDRANT_URL", "QDRANT_COLLECTION"] + [k for k in SECRET_KEYS if k in ("KEYCLOAK_ADMIN_PASSWORD", "KEYCLOAK_DB_PASSWORD")]
        missing = [k for k in required if k not in data or not (data.get(k) or "").strip()]
        if missing:
            raise SystemExit(f".env: missing or empty: {', '.join(missing)}")
        print("Verify OK: .env has required keys.")
        return

    # --- Generate .env only ---
    src = env_tpl if env_tpl.exists() else bkp / ".env"
    if not src.exists():
        raise SystemExit("Need scripts/env/.env.template or bkp/.env to generate .env")

    existing = parse_env_file(env_file)
    secrets_resolved = resolve_secrets(SECRET_KEYS, existing, args.force)
    data = parse_env_file(src)
    data = replace_placeholders(data, secrets_resolved)
    for k in SECRET_KEYS:
        if k not in data or not (data.get(k) or "").strip():
            data[k] = secrets_resolved.get(k, "")

    key_order: list[str] = []
    for line in read_env_lines(src):
        s = line.strip()
        if s.startswith("#"):
            continue
        m = re.match(r"^([A-Za-z_][A-Za-z0-9_]*)=", s)
        if m and m.group(1) not in key_order:
            key_order.append(m.group(1))
    write_env_file(env_file, data, key_order=key_order if key_order else None)
    print("Wrote .env (infra + app config).")

    data_after = parse_env_file(env_file)
    missing = [k for k in ["REDIS_URL", "QDRANT_URL", "QDRANT_COLLECTION"] if k not in data_after or not (data_after.get(k) or "").strip()]
    if missing:
        raise SystemExit(f".env: missing or empty after write: {', '.join(missing)}")

    print("Done. Use: docker compose --env-file .env --profile infra up -d")


if __name__ == "__main__":
    main()
    sys.exit(0)
