#!/usr/bin/env python3
"""
Delete KAIROS Keycloak realms (kairos-dev, kairos-qa, kairos-prod) via Admin API.
After running, restart Keycloak so --import-realm re-imports from scripts/keycloak/import (if using Docker import); otherwise run scripts/configure-keycloak-realms.py to re-create realms.

Requires KEYCLOAK_ADMIN_PASSWORD in .env; Keycloak at KEYCLOAK_URL
(default http://localhost:8080).

Usage:
  python scripts/delete-keycloak-realms.py
  docker compose restart keycloak
"""

from __future__ import annotations

import json
import os
import sys
import urllib.error
import urllib.parse
import urllib.request
from pathlib import Path

REALMS_TO_DELETE = ("kairos-dev", "kairos-qa", "kairos-prod")


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
    env = load_env_file(root / ".env")
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


def delete_realm(base_url: str, realm: str, token: str) -> bool:
    url = f"{base_url.rstrip('/')}/admin/realms/{realm}"
    req = urllib.request.Request(url, method="DELETE")
    req.add_header("Authorization", f"Bearer {token}")
    try:
        urllib.request.urlopen(req, timeout=15)
        return True
    except urllib.error.HTTPError as e:
        if e.code == 404:
            return False
        body = e.read().decode() if e.fp else ""
        sys.exit(f"Delete realm {realm} failed: {e.code} {body}")
    return False


def main() -> int:
    root = Path(__file__).resolve().parent.parent
    base_url = os.environ.get("KEYCLOAK_URL", "http://localhost:8080")
    admin_password = get_admin_password(root)
    if not admin_password:
        sys.exit("KEYCLOAK_ADMIN_PASSWORD not set (set in .env.prod or .env)")

    token = get_admin_token(base_url, admin_password)
    for realm in REALMS_TO_DELETE:
        if delete_realm(base_url, realm, token):
            print(f"Deleted realm {realm}.")
        else:
            print(f"Realm {realm} not found (404), skip.")
    print("To re-create realms run: python3 scripts/configure-keycloak-realms.py")
    return 0


if __name__ == "__main__":
    sys.exit(main())
