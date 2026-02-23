#!/usr/bin/env python3
"""
Configure Keycloak Client Registration → Trusted Hosts so Cursor MCP (DCR) can connect.

Disables both "Host sending request must match" and "Client URIs must match", so any host and
redirect URI (e.g. cursor://anysphere.cursor-mcp/oauth/callback) are allowed. Keycloak does not
support a wildcard in the trusted hosts list; disabling these checks is the way to allow all.

Without this, Cursor may get: "Host not trusted" or "URI doesn't match any trusted host or domain."

Uses Keycloak Admin REST API. Run after realm import (e.g. same env as ensure-keycloak-test-user).

Usage:
  python scripts/ensure_keycloak_trusted_hosts.py --realm kairos-dev
  python scripts/ensure_keycloak_trusted_hosts.py -r kairos-qa --keycloak-url http://localhost:8080
  python scripts/ensure_keycloak_trusted_hosts.py -r kairos-dev --print-config   # dump config (after manual fix) to align script

Requires: KEYCLOAK_ADMIN_PASSWORD in .env or environment.
The script uses the realm's id from GET /admin/realms/{realm} as the component parent (not the realm name).
"""

from __future__ import annotations

import argparse
import json
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
    import os
    if os.environ.get("KEYCLOAK_ADMIN_PASSWORD"):
        return os.environ["KEYCLOAK_ADMIN_PASSWORD"]
    for name in (".env", ".env.dev"):
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
        sys.exit(f"Admin token failed: {e.code}")
    token = body.get("access_token")
    if not token:
        sys.exit("No access_token in token response")
    return token


# Client registration policy type (realm-level component)
CLIENT_REGISTRATION_POLICY_TYPE = "org.keycloak.services.clientregistration.policy.ClientRegistrationPolicy"
TRUSTED_HOSTS_PROVIDER_ID = "trusted-hosts"
# Keycloak uses kebab-case keys (TrustedHostClientRegistrationPolicyFactory).
# Disable both checks so DCR works from any host and with any redirect URI (e.g. cursor://).
CONFIG_DISABLE_STRICT = {
    "host-sending-registration-request-must-match": ["false"],
    "client-uris-must-match": ["false"],
}
# Fallback: also set camelCase in case Admin API normalizes (some Keycloak versions).
CONFIG_DISABLE_STRICT_CAMEL = {
    "hostSendingRegistrationRequestMustMatch": ["false"],
    "clientUrisMustMatch": ["false"],
}


def get_realm_id(base_url: str, realm: str, token: str) -> str:
    """Realm representation uses id (may be UUID); use it as parent for components."""
    url = f"{base_url.rstrip('/')}/admin/realms/{realm}"
    req = urllib.request.Request(url, method="GET")
    req.add_header("Authorization", f"Bearer {token}")
    try:
        with urllib.request.urlopen(req, timeout=15) as resp:
            data = json.loads(resp.read().decode())
    except urllib.error.HTTPError as e:
        body = e.read().decode() if e.fp else ""
        sys.exit(f"GET realm failed: {e.code} {body}")
    rid = data.get("id") or realm
    return rid


def get_components(base_url: str, realm: str, token: str, parent_id: str, typ: str) -> list[dict]:
    q = urllib.parse.urlencode({"parent": parent_id, "type": typ})
    url = f"{base_url.rstrip('/')}/admin/realms/{realm}/components?{q}"
    req = urllib.request.Request(url, method="GET")
    req.add_header("Authorization", f"Bearer {token}")
    try:
        with urllib.request.urlopen(req, timeout=15) as resp:
            return json.loads(resp.read().decode())
    except urllib.error.HTTPError as e:
        body = e.read().decode() if e.fp else ""
        sys.exit(f"GET components failed: {e.code} {body}")


def update_component(
    base_url: str, realm: str, component_id: str, payload: dict, token: str
) -> None:
    url = f"{base_url.rstrip('/')}/admin/realms/{realm}/components/{component_id}"
    data = json.dumps(payload).encode("utf-8")
    req = urllib.request.Request(url, data=data, method="PUT")
    req.add_header("Authorization", f"Bearer {token}")
    req.add_header("Content-Type", "application/json")
    try:
        urllib.request.urlopen(req, timeout=15)
    except urllib.error.HTTPError as e:
        body = e.read().decode() if e.fp else ""
        sys.exit(f"PUT component failed: {e.code} {body}")


def main() -> int:
    parser = argparse.ArgumentParser(
        description="Set Trusted Hosts policy so DCR (e.g. Cursor MCP) can register."
    )
    parser.add_argument("-r", "--realm", required=True, help="Realm (e.g. kairos-dev, kairos-qa)")
    parser.add_argument(
        "--keycloak-url",
        default="http://localhost:8080",
        help="Keycloak base URL",
    )
    parser.add_argument(
        "--print-config",
        action="store_true",
        help="Print Trusted Hosts component config (JSON) and exit (no update).",
    )
    args = parser.parse_args()

    root = Path(__file__).resolve().parent.parent
    admin_password = get_admin_password(root)
    if not admin_password:
        print(
            "ERROR: KEYCLOAK_ADMIN_PASSWORD not set. Set in .env or export.",
            file=sys.stderr,
        )
        return 1

    token = get_admin_token(args.keycloak_url, admin_password)
    parent_id = get_realm_id(args.keycloak_url, args.realm, token)
    components = get_components(
        args.keycloak_url,
        args.realm,
        token,
        parent_id,
        CLIENT_REGISTRATION_POLICY_TYPE,
    )
    trusted = next(
        (c for c in components if c.get("providerId") == TRUSTED_HOSTS_PROVIDER_ID),
        None,
    )
    if not trusted:
        print(
            f"WARNING: No 'Trusted Hosts' component in realm {args.realm}; skipping.",
            file=sys.stderr,
        )
        return 0

    if args.print_config:
        print(json.dumps(trusted.get("config") or {}, indent=2))
        return 0

    comp_id = trusted.get("id")
    if not comp_id:
        print("WARNING: Trusted Hosts component has no id; skipping.", file=sys.stderr)
        return 0

    config = dict(trusted.get("config") or {})
    host_off = (
        config.get("host-sending-registration-request-must-match") == ["false"]
        or config.get("hostSendingRegistrationRequestMustMatch") == ["false"]
    )
    uris_off = (
        config.get("client-uris-must-match") == ["false"]
        or config.get("clientUrisMustMatch") == ["false"]
    )
    if host_off and uris_off:
        print(f"Trusted Hosts already relaxed for realm {args.realm}.")
        return 0

    config.update(CONFIG_DISABLE_STRICT)
    config.update(CONFIG_DISABLE_STRICT_CAMEL)
    payload = {**trusted, "config": config}
    update_component(args.keycloak_url, args.realm, comp_id, payload, token)
    print(f"Trusted Hosts updated for realm {args.realm} (DCR from any host allowed).")
    return 0


if __name__ == "__main__":
    sys.exit(main())
