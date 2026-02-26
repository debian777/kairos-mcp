#!/usr/bin/env python3
"""
Idempotent Keycloak realm setup: import from scripts/keycloak/import, set trusted hosts, create test user (dev/qa).

Runs entirely via Admin API (no Docker import mount). Use when Keycloak is already running.
Reads realm JSONs from scripts/keycloak/import relative to repo root (works regardless of CWD).

1. Realms: create with defaults if missing, then always apply config from scripts/keycloak/import/*.json (idempotent).
2. Trusted hosts: set env-specific IPs (dev: Docker gateway; qa: app-qa; prod: app-prod).
3. Test user: ensure TEST_USERNAME/TEST_PASSWORD exists in dev and qa realms (for tests).

Env: KEYCLOAK_URL (default http://localhost:8080), KEYCLOAK_ADMIN_PASSWORD,
TEST_USERNAME (default kairos-tester), TEST_PASSWORD (default kairos-tester-secret).
Loaded from .env.prod, .env, .env.dev.

Usage:
  python scripts/configure-keycloak-realms.py
  KEYCLOAK_URL=http://keycloak:8080 python scripts/configure-keycloak-realms.py
"""

from __future__ import annotations

import json
import os
import re
import subprocess
import sys
import urllib.error
import urllib.parse
import urllib.request
from pathlib import Path

CLIENT_REGISTRATION_POLICY_TYPE = "org.keycloak.services.clientregistration.policy.ClientRegistrationPolicy"
TRUSTED_HOSTS_PROVIDER_ID = "trusted-hosts"
NETWORK_NAME = "kairos-network"
REALM_FILES = [
    ("kairos-dev", "kairos-dev-realm.json"),
    ("kairos-qa", "kairos-qa-realm.json"),
    ("kairos-prod", "kairos-prod-realm.json"),
]


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


def get_env(root: Path) -> dict[str, str]:
    env: dict[str, str] = {}
    for name in (".env.prod", ".env", ".env.dev"):
        env.update(load_env_file(root / name))
    for k, v in os.environ.items():
        if v is not None:
            env[k] = v
    return env


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
        sys.exit(f"Admin token failed: {e.code} {body}")
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


def create_realm_minimal(base_url: str, token: str, realm_name: str) -> bool:
    """Create realm with Keycloak defaults so we can then apply our config via update (idempotent)."""
    url = f"{base_url.rstrip('/')}/admin/realms"
    payload = json.dumps({"realm": realm_name, "enabled": True}).encode("utf-8")
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
        sys.exit(f"Create realm {realm_name} failed: {e.code} {body}")
    return False


def get_realm_full(base_url: str, realm_name: str, token: str) -> dict:
    """GET full realm representation (for merge before PUT)."""
    url = f"{base_url.rstrip('/')}/admin/realms/{realm_name}"
    req = urllib.request.Request(url, method="GET")
    req.add_header("Authorization", f"Bearer {token}")
    try:
        with urllib.request.urlopen(req, timeout=15) as resp:
            return json.loads(resp.read().decode())
    except urllib.error.HTTPError as e:
        body = e.read().decode() if e.fp else ""
        sys.exit(f"GET realm {realm_name} failed: {e.code} {body}")


def update_realm(base_url: str, realm_name: str, realm_json: dict, token: str) -> None:
    """PUT realm to apply merged configuration (idempotent update)."""
    url = f"{base_url.rstrip('/')}/admin/realms/{realm_name}"
    payload = json.dumps(realm_json).encode("utf-8")
    req = urllib.request.Request(url, data=payload, method="PUT")
    req.add_header("Authorization", f"Bearer {token}")
    req.add_header("Content-Type", "application/json")
    try:
        urllib.request.urlopen(req, timeout=15)
    except urllib.error.HTTPError as e:
        body = e.read().decode() if e.fp else ""
        sys.exit(f"Update realm {realm_name} failed: {e.code} {body}")


def _merge_realm(current: dict, desired: dict) -> dict:
    """
    Merge desired realm JSON into current (from GET). Preserves Keycloak-assigned ids
    for clients and flows so PUT updates instead of duplicating.
    """
    merged = dict(current)

    # Top-level realm attributes: desired overwrites (keep current id)
    merged["id"] = current.get("id") or desired.get("id") or current.get("realm")
    for key in (
        "realm", "enabled", "registrationAllowed", "loginWithEmailAllowed", "duplicateEmailsAllowed",
        "ssoSessionIdleTimeout", "ssoSessionMaxLifespan", "accessCodeLifespan",
        "accessCodeLifespanUserAction", "accessCodeLifespanLogin", "groups",
    ):
        if key in desired:
            merged[key] = desired[key]

    # Clients: by clientId, replace with desired and keep current id
    desired_client_ids = {c.get("clientId") for c in desired.get("clients") or [] if c.get("clientId")}
    current_clients = list(current.get("clients") or [])
    merged_clients = [c for c in current_clients if c.get("clientId") not in desired_client_ids]
    for d_client in desired.get("clients") or []:
        cid = d_client.get("clientId")
        if not cid:
            continue
        existing = next((c for c in current_clients if c.get("clientId") == cid), None)
        new_client = dict(d_client)
        if existing and existing.get("id") is not None:
            new_client["id"] = existing["id"]
        merged_clients.append(new_client)
    merged["clients"] = merged_clients

    # Authentication flows: by alias, replace with desired and keep current id
    desired_flow_aliases = {f.get("alias") for f in desired.get("authenticationFlows") or [] if f.get("alias")}
    current_flows = list(current.get("authenticationFlows") or [])
    merged_flows = [f for f in current_flows if f.get("alias") not in desired_flow_aliases]
    for d_flow in desired.get("authenticationFlows") or []:
        alias = d_flow.get("alias")
        if not alias:
            continue
        existing = next((f for f in current_flows if f.get("alias") == alias), None)
        new_flow = dict(d_flow)
        if existing and existing.get("id") is not None:
            new_flow["id"] = existing["id"]
        merged_flows.append(new_flow)
    merged["authenticationFlows"] = merged_flows

    return merged


def _run_docker(*args: str, timeout: int = 10) -> str | None:
    try:
        out = subprocess.run(
            ["docker", *args],
            capture_output=True,
            text=True,
            timeout=timeout,
        )
        if out.returncode != 0:
            return None
        return (out.stdout or "").strip() or None
    except (subprocess.TimeoutExpired, FileNotFoundError):
        return None


def _docker_network_gateway() -> str | None:
    out = _run_docker(
        "network", "inspect", NETWORK_NAME,
        "--format", "{{(index .IPAM.Config 0).Gateway}}",
    )
    if not out or not re.match(r"^\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}$", out):
        return None
    return out


def _docker_container_ip_on_network(service_name: str) -> str | None:
    out = _run_docker("network", "inspect", NETWORK_NAME, "--format", "{{json .Containers}}")
    if not out:
        return None
    try:
        containers = json.loads(out)
    except json.JSONDecodeError:
        return None
    for _cid, info in containers.items():
        name = info.get("Name") or ""
        if service_name in name:
            addr = (info.get("IPv4Address") or "").split("/")[0]
            if addr and re.match(r"^\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}$", addr):
                return addr
    return None


def get_trusted_hosts_for_env(env: str) -> list[str]:
    """Trusted hosts: IP only (no port/wildcard) plus localhost. Keycloak requires valid IPs.
    Docker gateway (e.g. 172.18.0.1) is added for dev/qa/prod so requests from the host are trusted."""
    base = ["127.0.0.1", "localhost"]
    gateway = _docker_network_gateway()
    if gateway:
        base.append(gateway)
    if env == "dev":
        if not gateway:
            print(
                "WARNING: Docker network gateway not found; only 127.0.0.1 trusted for dev.",
                file=sys.stderr,
            )
    elif env == "qa":
        ip = _docker_container_ip_on_network("app-qa")
        if ip:
            base.append(ip)
        base.append("app-qa")
    elif env == "prod":
        ip = _docker_container_ip_on_network("app-prod")
        if ip:
            base.append(ip)
        base.append("app-prod")
    return base


def get_realm_id(base_url: str, realm: str, token: str) -> str:
    url = f"{base_url.rstrip('/')}/admin/realms/{realm}"
    req = urllib.request.Request(url, method="GET")
    req.add_header("Authorization", f"Bearer {token}")
    try:
        with urllib.request.urlopen(req, timeout=15) as resp:
            data = json.loads(resp.read().decode())
    except urllib.error.HTTPError as e:
        body = e.read().decode() if e.fp else ""
        sys.exit(f"GET realm failed: {e.code} {body}")
    return data.get("id") or realm


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


def ensure_trusted_hosts(
    base_url: str, realm: str, env: str, token: str
) -> None:
    parent_id = get_realm_id(base_url, realm, token)
    components = get_components(
        base_url, realm, token, parent_id, CLIENT_REGISTRATION_POLICY_TYPE
    )
    trusted = next(
        (c for c in components if c.get("providerId") == TRUSTED_HOSTS_PROVIDER_ID),
        None,
    )
    if not trusted or not trusted.get("id"):
        print(f"WARNING: No Trusted Hosts component in {realm}; skip.", file=sys.stderr)
        return
    trusted_hosts = get_trusted_hosts_for_env(env)
    config = dict(trusted.get("config") or {})
    config["host-sending-registration-request-must-match"] = ["true"]
    config["trusted-hosts"] = trusted_hosts
    config["client-uris-must-match"] = ["false"]
    update_component(base_url, realm, trusted["id"], {**trusted, "config": config}, token)
    print(f"  Trusted hosts {realm}: {trusted_hosts}")


def get_user_id(base_url: str, realm: str, username: str, token: str) -> str | None:
    q = urllib.parse.urlencode({"username": username})
    url = f"{base_url.rstrip('/')}/admin/realms/{realm}/users?{q}"
    req = urllib.request.Request(url, method="GET")
    req.add_header("Authorization", f"Bearer {token}")
    try:
        with urllib.request.urlopen(req, timeout=15) as resp:
            users = json.loads(resp.read().decode())
            if users:
                return users[0].get("id")
    except urllib.error.HTTPError as e:
        body = e.read().decode() if e.fp else ""
        sys.exit(f"Get user failed: {e.code} {body}")
    return None


def create_user(base_url: str, realm: str, username: str, token: str) -> str | None:
    url = f"{base_url.rstrip('/')}/admin/realms/{realm}/users"
    payload = json.dumps({"username": username, "enabled": True}).encode("utf-8")
    req = urllib.request.Request(url, data=payload, method="POST")
    req.add_header("Authorization", f"Bearer {token}")
    req.add_header("Content-Type", "application/json")
    try:
        with urllib.request.urlopen(req, timeout=15) as resp:
            location = resp.headers.get("Location")
            if location:
                return location.rstrip("/").split("/")[-1]
            return None
    except urllib.error.HTTPError as e:
        if e.code == 409:
            return None
        body = e.read().decode() if e.fp else ""
        sys.exit(f"Create user failed: {e.code} {body}")


def set_password(
    base_url: str, realm: str, user_id: str, password: str, token: str
) -> None:
    url = f"{base_url.rstrip('/')}/admin/realms/{realm}/users/{user_id}/reset-password"
    payload = json.dumps({
        "type": "password",
        "value": password,
        "temporary": False,
    }).encode("utf-8")
    req = urllib.request.Request(url, data=payload, method="PUT")
    req.add_header("Authorization", f"Bearer {token}")
    req.add_header("Content-Type", "application/json")
    try:
        urllib.request.urlopen(req, timeout=15)
    except urllib.error.HTTPError as e:
        body = e.read().decode() if e.fp else ""
        sys.exit(f"Set password failed: {e.code} {body}")


def ensure_test_user(
    base_url: str, realm: str, username: str, password: str, token: str
) -> None:
    user_id = get_user_id(base_url, realm, username, token)
    if not user_id:
        user_id = create_user(base_url, realm, username, token)
    if not user_id:
        print(f"WARNING: Could not create/find user {username} in {realm}.", file=sys.stderr)
        return
    set_password(base_url, realm, user_id, password, token)
    print(f"  Test user {realm}: {username}")


def main() -> int:
    root = Path(__file__).resolve().parent.parent
    env = get_env(root)
    base_url = env.get("KEYCLOAK_URL", "http://localhost:8080")
    admin_password = env.get("KEYCLOAK_ADMIN_PASSWORD")
    if not admin_password:
        sys.exit("KEYCLOAK_ADMIN_PASSWORD not set. Set in .env.prod, .env, or export.")

    test_username = env.get("TEST_USERNAME", "kairos-tester")
    test_password = env.get("TEST_PASSWORD", "kairos-tester-secret")

    token = get_admin_token(base_url, admin_password)
    import_dir = root / "scripts" / "keycloak" / "import"

    # 1. Ensure realm exists (minimal create), then always apply config from file (idempotent)
    existing = list_realms(base_url, token)
    for realm_name, filename in REALM_FILES:
        path = import_dir / filename
        if not path.is_file():
            print(f"Realm file not found: {path}, skip.", file=sys.stderr)
            continue
        if realm_name not in existing:
            create_realm_minimal(base_url, token, realm_name)
            print(f"Created realm {realm_name} (defaults).")
        current = get_realm_full(base_url, realm_name, token)
        desired = json.loads(path.read_text())
        merged = _merge_realm(current, desired)
        update_realm(base_url, realm_name, merged, token)
        print(f"Updated realm {realm_name}.")

    # 2. Set trusted hosts per realm (dev / qa / prod)
    for realm_name, _ in REALM_FILES:
        env_key = realm_name.replace("kairos-", "")
        ensure_trusted_hosts(base_url, realm_name, env_key, token)

    # 3. Test user in dev and qa only
    for realm_name in ("kairos-dev", "kairos-qa"):
        ensure_test_user(base_url, realm_name, test_username, test_password, token)

    print("Keycloak realms configured.")
    return 0


if __name__ == "__main__":
    sys.exit(main())
