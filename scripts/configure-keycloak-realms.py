#!/usr/bin/env python3
"""
Idempotent Keycloak realm setup: apply config from scripts/keycloak/import via Admin API.

Configures sub-realms only (e.g. kairos-dev, kairos-prod). Uses master realm only to obtain
an admin token; does not modify master.
Single source of truth for realm config. Use when Keycloak is already running. Do not use
Keycloak startup --import-realm (would conflict with existing realms). Reads realm JSONs
from scripts/keycloak/import relative to repo root (works regardless of CWD).

1. Realms: create minimal if missing, then always merge and PUT config from import/*.json (idempotent).
2. Trusted hosts: set env-specific IPs (dev: Docker gateway; prod: app-prod).
3. OIDC scope `openid` for dynamic registration: ensure a realm Client Scope named `openid`
   exists and is a default optional scope (mcp-remote sends `scope: openid` in registration).
4. Allowed client scopes (policies): whitelist client-scope templates for anonymous/authenticated
   registration (includes `openid` and kairos-cli default templates).
5. Test user: ensure TEST_USERNAME/TEST_PASSWORD exists in dev realm (for tests).

Identity providers (e.g. Google) are not in realm JSON; configure via configure-keycloak-google-idp.py.

Env: KEYCLOAK_URL (default http://localhost:8080), KEYCLOAK_ADMIN_PASSWORD,
TEST_USERNAME (default kairos-tester), TEST_PASSWORD (default kairos-tester-secret).
Loaded from .env.

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
# UI label "Allowed Client Scopes"; providerId is allowed-client-templates (Keycloak Admin API).
ALLOWED_CLIENT_TEMPLATES_PROVIDER_ID = "allowed-client-templates"
# Realm client-scope names permitted for OIDC dynamic registration. `openid` must be a real
# Client Scope in the realm (ensure_openid_client_scope); OAuth scope "openid" maps to that name.
# Other entries align with default scopes on kairos-cli.
DYNAMIC_REGISTRATION_ALLOWED_CLIENT_SCOPES = [
    "openid",
    "basic",
    "acr",
    "web-origins",
    "profile",
    "roles",
    "email",
]
REALM_FILES = [
    ("kairos-dev", "kairos-dev-realm.json"),
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
    for name in (".env",):
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


def list_realm_client_ids(base_url: str, realm_name: str, token: str) -> set[str]:
    """GET realm clients and return set of clientId."""
    clients = get_realm_clients(base_url, realm_name, token)
    return {c.get("clientId") for c in clients if c.get("clientId")}


def get_realm_clients(base_url: str, realm_name: str, token: str) -> list[dict]:
    """GET full list of client representations (for dump/compare)."""
    url = f"{base_url.rstrip('/')}/admin/realms/{realm_name}/clients"
    req = urllib.request.Request(url, method="GET")
    req.add_header("Authorization", f"Bearer {token}")
    try:
        with urllib.request.urlopen(req, timeout=15) as resp:
            return json.loads(resp.read().decode())
    except urllib.error.HTTPError as e:
        body = e.read().decode() if e.fp else ""
        sys.exit(f"List clients {realm_name} failed: {e.code} {body}")


def create_realm_client(base_url: str, realm_name: str, client_payload: dict, token: str) -> None:
    """POST a client into the realm (Keycloak realm PUT does not create new clients)."""
    url = f"{base_url.rstrip('/')}/admin/realms/{realm_name}/clients"
    payload = json.dumps(client_payload).encode("utf-8")
    req = urllib.request.Request(url, data=payload, method="POST")
    req.add_header("Authorization", f"Bearer {token}")
    req.add_header("Content-Type", "application/json")
    try:
        urllib.request.urlopen(req, timeout=15)
    except urllib.error.HTTPError as e:
        body = e.read().decode() if e.fp else ""
        sys.exit(f"Create client {client_payload.get('clientId', '?')} in {realm_name} failed: {e.code} {body}")


def list_realm_client_scopes(base_url: str, realm_name: str, token: str) -> list[dict]:
    """GET realm-defined client scopes (templates)."""
    url = f"{base_url.rstrip('/')}/admin/realms/{realm_name}/client-scopes"
    req = urllib.request.Request(url, method="GET")
    req.add_header("Authorization", f"Bearer {token}")
    try:
        with urllib.request.urlopen(req, timeout=15) as resp:
            return json.loads(resp.read().decode())
    except urllib.error.HTTPError as e:
        body = e.read().decode() if e.fp else ""
        sys.exit(f"List client scopes {realm_name} failed: {e.code} {body}")


def ensure_openid_client_scope(base_url: str, realm_name: str, token: str) -> None:
    """
    Keycloak maps OAuth scope 'openid' in DCR to a Client Scope named 'openid'. If that
    template does not exist, the Allowed Client Scopes registration policy rejects the request
    (mcp-remote, RFC 9728 metadata with scopes_supported containing openid).
    """
    scopes = list_realm_client_scopes(base_url, realm_name, token)
    openid_row = next((s for s in scopes if s.get("name") == "openid"), None)
    if not openid_row:
        url = f"{base_url.rstrip('/')}/admin/realms/{realm_name}/client-scopes"
        payload = json.dumps({
            "name": "openid",
            "protocol": "openid-connect",
            "attributes": {
                "include.in.token.scope": "true",
                "display.on.consent.screen": "false",
            },
        }).encode("utf-8")
        req = urllib.request.Request(url, data=payload, method="POST")
        req.add_header("Authorization", f"Bearer {token}")
        req.add_header("Content-Type", "application/json")
        try:
            urllib.request.urlopen(req, timeout=15)
        except urllib.error.HTTPError as e:
            if e.code != 409:
                body = e.read().decode() if e.fp else ""
                sys.exit(f"Create client scope openid in {realm_name} failed: {e.code} {body}")
        scopes = list_realm_client_scopes(base_url, realm_name, token)
        openid_row = next((s for s in scopes if s.get("name") == "openid"), None)
        if not openid_row:
            sys.exit(f"Client scope openid missing in {realm_name} after create attempt")
        print(f"  Created client scope 'openid' in {realm_name}")
    else:
        print(f"  Client scope 'openid' already present in {realm_name}")

    scope_id = openid_row["id"]
    opt_url = f"{base_url.rstrip('/')}/admin/realms/{realm_name}/default-optional-client-scopes"
    req = urllib.request.Request(opt_url, method="GET")
    req.add_header("Authorization", f"Bearer {token}")
    try:
        with urllib.request.urlopen(req, timeout=15) as resp:
            optional = json.loads(resp.read().decode())
    except urllib.error.HTTPError as e:
        body = e.read().decode() if e.fp else ""
        sys.exit(f"GET default optional client scopes {realm_name} failed: {e.code} {body}")

    if any(s.get("name") == "openid" for s in optional):
        print(f"  'openid' already in default optional client scopes ({realm_name})")
        return

    add_url = f"{opt_url}/{scope_id}"
    put_req = urllib.request.Request(add_url, data=b"", method="PUT")
    put_req.add_header("Authorization", f"Bearer {token}")
    try:
        urllib.request.urlopen(put_req, timeout=15)
    except urllib.error.HTTPError as e:
        body = e.read().decode() if e.fp else ""
        sys.exit(f"Add openid to optional scopes {realm_name} failed: {e.code} {body}")
    print(f"  Linked 'openid' to default optional client scopes ({realm_name})")


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
        "ssoSessionIdleTimeout", "ssoSessionMaxLifespan", "accessTokenLifespan",
        "accessCodeLifespan", "accessCodeLifespanUserAction", "accessCodeLifespanLogin", "groups",
    ):
        if key in desired:
            merged[key] = desired[key]

    # Clients: by clientId, overlay desired onto existing so Keycloak-managed fields (e.g. defaultClientScopes, protocol) are preserved for local/direct grant login
    desired_client_ids = {c.get("clientId") for c in desired.get("clients") or [] if c.get("clientId")}
    current_clients = list(current.get("clients") or [])
    merged_clients = [c for c in current_clients if c.get("clientId") not in desired_client_ids]
    for d_client in desired.get("clients") or []:
        cid = d_client.get("clientId")
        if not cid:
            continue
        existing = next((c for c in current_clients if c.get("clientId") == cid), None)
        if existing:
            new_client = dict(existing)
            for k, v in d_client.items():
                new_client[k] = v
            if existing.get("id") is not None:
                new_client["id"] = existing["id"]
        else:
            new_client = dict(d_client)
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

    # Identity providers: GET /admin/realms/{realm} does not return them; preserve by not sending
    # (IdPs are managed separately via configure-keycloak-google-idp.py). Do not set merged["identityProviders"]
    # so Keycloak PUT does not overwrite/clear them (realm PUT can replace IdP list if we send it).

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


DOCKER_BRIDGE_GATEWAYS = [f"172.{octet}.0.1" for octet in range(16, 32)]


def _docker_container_ip_on_network(service_name: str) -> str | None:
    """Find a container's IP by searching all kairos-related Docker networks."""
    IP_RE = re.compile(r"^\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}$")
    out = _run_docker("network", "ls", "--format", "{{.Name}}")
    if not out:
        return None
    for net_name in out.splitlines():
        if "kairos" not in net_name:
            continue
        cdata = _run_docker("network", "inspect", net_name, "--format", "{{json .Containers}}")
        if not cdata:
            continue
        try:
            containers = json.loads(cdata)
        except json.JSONDecodeError:
            continue
        for _cid, info in containers.items():
            name = info.get("Name") or ""
            if service_name in name:
                addr = (info.get("IPv4Address") or "").split("/")[0]
                if addr and IP_RE.match(addr):
                    return addr
    return None


def get_trusted_hosts_for_env(env: str) -> list[str]:
    """Trusted hosts: localhost + all Docker /16 bridge gateways (172.16–31.0.1) +
    env-specific container IPs and hostnames."""
    base = ["127.0.0.1", "localhost"] + DOCKER_BRIDGE_GATEWAYS
    if env == "dev":
        base.extend(["keycloak", "app-dev", "host.docker.internal"])
        ip = _docker_container_ip_on_network("app-dev")
        if ip:
            base.append(ip)
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


def ensure_allowed_client_templates(
    base_url: str, realm: str, token: str
) -> None:
    """
    Allow named realm client scopes for dynamic OIDC client registration.

    Requires a Client Scope named `openid` (see ensure_openid_client_scope) so mcp-remote
    and similar clients can register with OAuth scope `openid`.
    """
    parent_id = get_realm_id(base_url, realm, token)
    components = get_components(
        base_url, realm, token, parent_id, CLIENT_REGISTRATION_POLICY_TYPE
    )
    targets = [
        c
        for c in components
        if c.get("providerId") == ALLOWED_CLIENT_TEMPLATES_PROVIDER_ID
        and c.get("subType") in ("anonymous", "authenticated")
    ]
    if not targets:
        print(
            f"WARNING: No Allowed Client Scopes (allowed-client-templates) in {realm}; skip.",
            file=sys.stderr,
        )
        return
    allowed = list(DYNAMIC_REGISTRATION_ALLOWED_CLIENT_SCOPES)
    for comp in targets:
        config = dict(comp.get("config") or {})
        config["allow-default-scopes"] = ["true"]
        config["allowed-client-scopes"] = allowed
        update_component(base_url, realm, comp["id"], {**comp, "config": config}, token)
        sub = comp.get("subType") or "?"
        print(f"  Allowed client templates ({sub}) {realm}: {allowed}")


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


# Realm keys we set from import (must match _merge_realm and import JSON)
_REALM_COMPARE_KEYS = (
    "realm", "enabled", "registrationAllowed", "loginWithEmailAllowed", "duplicateEmailsAllowed",
    "ssoSessionIdleTimeout", "ssoSessionMaxLifespan", "accessTokenLifespan",
    "accessCodeLifespan", "accessCodeLifespanUserAction", "accessCodeLifespanLogin", "groups",
)
# Client keys we set from import (subset of ClientRepresentation)
_CLIENT_COMPARE_KEYS = (
    "clientId", "name", "enabled", "publicClient", "standardFlowEnabled", "directAccessGrantsEnabled",
    "redirectUris", "webOrigins", "attributes",
)
# Only verify these clients (kairos-cli is used by CLI login; kairos-mcp is server's client, often env-specific)
_VERIFY_CLIENT_IDS = frozenset({"kairos-cli"})


def get_realm_groups(base_url: str, realm_name: str, token: str) -> list[dict]:
    """GET realm groups (names only for compare). Keycloak realm GET may not include groups."""
    url = f"{base_url.rstrip('/')}/admin/realms/{realm_name}/groups?briefRepresentation=true"
    req = urllib.request.Request(url, method="GET")
    req.add_header("Authorization", f"Bearer {token}")
    try:
        with urllib.request.urlopen(req, timeout=15) as resp:
            groups = json.loads(resp.read().decode())
            return [{"name": g.get("name", "")} for g in groups]
    except urllib.error.HTTPError as e:
        body = e.read().decode() if e.fp else ""
        sys.exit(f"GET groups {realm_name} failed: {e.code} {body}")


def _dump_realm_for_compare(base_url: str, realm_name: str, token: str) -> dict:
    """Dump current Keycloak realm state into same shape as import JSON (for compare)."""
    realm = get_realm_full(base_url, realm_name, token)
    clients_raw = get_realm_clients(base_url, realm_name, token)
    out = {"id": realm.get("id"), "realm": realm.get("realm")}
    for k in _REALM_COMPARE_KEYS:
        if k in realm:
            out[k] = realm[k]
    if out.get("groups") is None:
        out["groups"] = get_realm_groups(base_url, realm_name, token)
    out["clients"] = []
    for c in clients_raw:
        cid = c.get("clientId")
        if not cid:
            continue
        client_subset = {}
        for k in _CLIENT_COMPARE_KEYS:
            if k not in c:
                continue
            v = c[k]
            if k == "attributes" and isinstance(v, dict):
                # only compare attributes we set in import (e.g. pkce)
                v = {kk: vv for kk, vv in v.items() if kk.startswith("pkce.")}
            if v is not None:
                client_subset[k] = v
        out["clients"].append(client_subset)
    return out


def _normalize_for_compare(obj: dict | list) -> dict | list:
    """Sort list values that are unordered (redirectUris, webOrigins) for stable diff."""
    if isinstance(obj, dict):
        return {k: _normalize_for_compare(v) for k, v in obj.items()}
    if isinstance(obj, list):
        if not obj:
            return obj
        if isinstance(obj[0], str):
            return sorted(obj)
        if isinstance(obj[0], dict) and "name" in obj[0]:
            # groups: compare by sorted names only
            return sorted(d.get("name", "") for d in obj)
    return obj


def _compare_expected_actual(realm_name: str, expected: dict, actual_dump: dict) -> list[str]:
    """Compare expected (from import JSON) with actual (dump). Return list of diff messages.
    Only compares keys present in expected. Ignores realm id (Keycloak-assigned).
    """
    diffs: list[str] = []
    # Realm: only keys that exist in expected (exclude id)
    realm_keys_to_compare = [k for k in _REALM_COMPARE_KEYS if k in expected]
    for k in realm_keys_to_compare:
        exp_v = _normalize_for_compare(expected[k])
        act_v = _normalize_for_compare(actual_dump.get(k))
        if k == "groups" and (act_v == [] or act_v is None):
            # Keycloak realm PUT does not create groups; skip when none exist yet (e.g. fresh CI)
            continue
        if exp_v != act_v:
            diffs.append(f"{realm_name} realm.{k}: expected {exp_v!r}, got {act_v!r}")

    exp_clients = {c["clientId"]: c for c in expected.get("clients") or [] if c.get("clientId")}
    act_clients = {c["clientId"]: c for c in actual_dump.get("clients") or [] if c.get("clientId")}

    for cid in _VERIFY_CLIENT_IDS:
        exp_c = exp_clients.get(cid)
        if not exp_c:
            continue
        act_c = act_clients.get(cid)
        if not act_c:
            diffs.append(f"{realm_name} client {cid!r}: missing in Keycloak")
            continue
        for k in exp_c:
            if k not in _CLIENT_COMPARE_KEYS:
                continue
            ev = _normalize_for_compare(exp_c[k])
            av = _normalize_for_compare(act_c.get(k))
            if k == "attributes" and ev in (None, {}) and av in (None, {}):
                continue
            if ev != av:
                diffs.append(f"{realm_name} client {cid!r}.{k}: expected {ev!r}, got {av!r}")

    return diffs


def verify_realms_after_update(base_url: str, token: str, import_dir: Path) -> list[str]:
    """
    Dump each realm from Keycloak after update and compare with import JSON.
    Returns list of diff messages; empty means dump matches expected.
    """
    all_diffs: list[str] = []
    for realm_name, filename in REALM_FILES:
        path = import_dir / filename
        if not path.is_file():
            continue
        expected = json.loads(path.read_text())
        actual_dump = _dump_realm_for_compare(base_url, realm_name, token)
        all_diffs.extend(_compare_expected_actual(realm_name, expected, actual_dump))
    return all_diffs


def main() -> int:
    root = Path(__file__).resolve().parent.parent
    env = get_env(root)
    base_url = env.get("KEYCLOAK_URL", "http://localhost:8080")
    admin_password = env.get("KEYCLOAK_ADMIN_PASSWORD")
    if not admin_password:
        sys.exit("KEYCLOAK_ADMIN_PASSWORD not set. Set in .env or export.")

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
        # Keycloak realm PUT does not create new clients; create any missing via POST
        existing_ids = list_realm_client_ids(base_url, realm_name, token)
        for d_client in desired.get("clients") or []:
            cid = d_client.get("clientId")
            if not cid or cid in existing_ids:
                continue
            create_realm_client(base_url, realm_name, d_client, token)
            print(f"  Created client {cid} in {realm_name}.")
            existing_ids.add(cid)

    # 2. Set trusted hosts per realm (dev / prod)
    for realm_name, _ in REALM_FILES:
        env_key = realm_name.replace("kairos-", "")
        ensure_trusted_hosts(base_url, realm_name, env_key, token)

    # 3. Client Scope `openid` + realm optional defaults (DCR / mcp-remote)
    for realm_name, _ in REALM_FILES:
        ensure_openid_client_scope(base_url, realm_name, token)

    # 4. Dynamic client registration: allowed client-scope templates
    for realm_name, _ in REALM_FILES:
        ensure_allowed_client_templates(base_url, realm_name, token)

    # 5. Test user in dev only
    for realm_name in ("kairos-dev",):
        ensure_test_user(base_url, realm_name, test_username, test_password, token)

    # 6. Verify: dump from Keycloak and compare with import
    verify_errors = verify_realms_after_update(base_url, token, import_dir)
    if verify_errors:
        print("Verification failed (dump vs import):", file=sys.stderr)
        for msg in verify_errors:
            print(f"  - {msg}", file=sys.stderr)
        sys.exit(1)
    print("Verified: dump matches import.")

    print("Keycloak realms configured.")
    return 0


if __name__ == "__main__":
    sys.exit(main())
