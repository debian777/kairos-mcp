#!/usr/bin/env python3
"""
Create Keycloak realms per env (kairos-dev, kairos-qa, kairos-prod) via Admin API.
Use when --import-realm did not run (e.g. empty import mount) or to sync realm config.

Reads realm JSONs from keycloak/import/*-realm.json. Creates each realm if missing.
Requires KEYCLOAK_ADMIN_PASSWORD in .env.prod or .env; Keycloak at KEYCLOAK_URL (default http://localhost:8080).

Usage:
  python scripts/ensure-keycloak-realms.py
  KEYCLOAK_URL=http://keycloak:8080 python scripts/ensure-keycloak-realms.py
"""

from __future__ import annotations

import json
import os
import sys
import urllib.error
import urllib.parse
import urllib.request
from pathlib import Path


def load_env_file(path: Path) -> dict[str, str]:
    out: dict[str, str] = {}
    if not path.is_file():
        return out
    for line in path.read_text().splitlines():
        line = line.strip()
        if not line or line.startswith("#"):
            continue
        if "=" in line:
            k, _, v = line.partition("=")
            out[k.strip()] = v.strip().strip('"').strip("'")
    return out


def get_admin_password(root: Path) -> str | None:
    if os.environ.get("KEYCLOAK_ADMIN_PASSWORD"):
        return os.environ["KEYCLOAK_ADMIN_PASSWORD"]
    for name in (".env.prod", ".env"):
        env = load_env_file(root / name)
        if env.get("KEYCLOAK_ADMIN_PASSWORD"):
            return env["KEYCLOAK_ADMIN_PASSWORD"]
    return None


def get_admin_token(base_url: str, admin_password: str) -> str:
    url = f"{base_url.rstrip('/')}/realms/master/protocol/openid-connect/token"
    data = urllib.parse.urlencode({
        "grant_type": "password",
        "client_id": "admin-cli",
        "username": "admin",
        "password": admin_password,
    }).encode("utf-8")
    req = urllib.request.Request(url, data=data, method="POST")
    req.add_header("Content-Type", "application/x-www-form-urlencoded")
    try:
        with urllib.request.urlopen(req, timeout=15) as resp:
            body = json.loads(resp.read().decode())
    except urllib.error.HTTPError as e:
        body = e.read().decode() if e.fp else ""
        sys.exit(f"Failed to get admin token: {e.code} {body}")
    token = body.get("access_token")
    if not token:
        sys.exit("No access_token in token response")
    return token


def list_realms(base_url: str, token: str) -> list[str]:
    url = f"{base_url.rstrip('/')}/admin/realms"
    req = urllib.request.Request(url, method="GET")
    req.add_header("Authorization", f"Bearer {token}")
    try:
        with urllib.request.urlopen(req, timeout=15) as resp:
            realms = json.loads(resp.read().decode())
            return [r["realm"] for r in realms]
    except urllib.error.HTTPError as e:
        body = e.read().decode() if e.fp else ""
        sys.exit(f"List realms failed: {e.code} {body}")


def create_realm(base_url: str, token: str, realm_json: dict) -> bool:
    url = f"{base_url.rstrip('/')}/admin/realms"
    payload = json.dumps(realm_json).encode("utf-8")
    req = urllib.request.Request(url, data=payload, method="POST")
    req.add_header("Authorization", f"Bearer {token}")
    req.add_header("Content-Type", "application/json")
    try:
        urllib.request.urlopen(req, timeout=15)
        return True
    except urllib.error.HTTPError as e:
        if e.code == 409:
            return False
        body = e.read().decode() if e.fp else ""
        sys.exit(f"Create realm failed: {e.code} {body}")
    return False


def main() -> int:
    root = Path(__file__).resolve().parent.parent
    base_url = os.environ.get("KEYCLOAK_URL", "http://localhost:8080")
    admin_password = get_admin_password(root)
    if not admin_password:
        sys.exit("KEYCLOAK_ADMIN_PASSWORD not set (set in .env.prod or .env)")

    token = get_admin_token(base_url, admin_password)
    existing = list_realms(base_url, token)

    import_dir = root / "keycloak" / "import"
    realm_files = [
        ("kairos-dev", import_dir / "kairos-dev-realm.json"),
        ("kairos-qa", import_dir / "kairos-qa-realm.json"),
        ("kairos-prod", import_dir / "kairos-prod-realm.json"),
    ]
    for realm_name, path in realm_files:
        if realm_name in existing:
            print(f"Realm {realm_name} already exists, skip.")
            continue
        if not path.is_file():
            print(f"Realm file not found: {path}, skip.", file=sys.stderr)
            continue
        realm_json = json.loads(path.read_text())
        if create_realm(base_url, token, realm_json):
            print(f"Created realm {realm_name}.")
        else:
            print(f"Realm {realm_name} already exists (409), skip.")
    return 0


if __name__ == "__main__":
    sys.exit(main())
