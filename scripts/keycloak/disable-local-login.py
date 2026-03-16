#!/usr/bin/env python3
"""
Disable the username/password form in Keycloak's browser authentication flow so that
only identity providers (Google, Apple, Okta, etc.) can be used to log in.

Uses the Keycloak Admin API to set the "Username Password Form" execution requirement
to DISABLED in the built-in browser flow. Run after Terraform apply when
disable_local_login is true, or standalone.

Env: KEYCLOAK_URL (default http://localhost:8080), KEYCLOAK_ADMIN_PASSWORD,
KEYCLOAK_REALM (default kairos-prod). Loaded from .env.

Usage:
  python3 scripts/keycloak/disable-local-login.py
  KEYCLOAK_REALM=kairos-prod python3 scripts/keycloak/disable-local-login.py
"""

from __future__ import annotations

import json
import os
import sys
import urllib.error
import urllib.parse
import urllib.request
from pathlib import Path

BROWSER_FLOW_ALIAS = "browser"
USERNAME_PASSWORD_FORM_PROVIDER_ID = "auth-username-password-form"
REQUIREMENT_DISABLED = "DISABLED"


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
    env.update(load_env_file(root / ".env"))
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


def _request(
    base_url: str, method: str, path: str, token: str, data: dict | None = None
) -> dict | list:
    url = f"{base_url.rstrip('/')}{path}"
    req = urllib.request.Request(url, method=method)
    req.add_header("Authorization", f"Bearer {token}")
    if data is not None:
        req.add_header("Content-Type", "application/json")
        req.data = json.dumps(data).encode("utf-8")
    try:
        with urllib.request.urlopen(req, timeout=15) as resp:
            raw = resp.read().decode()
            return json.loads(raw) if raw else {}
    except urllib.error.HTTPError as e:
        body = e.read().decode() if e.fp else ""
        sys.exit(f"{method} {path} failed: {e.code} {body}")


def get_flows(base_url: str, realm: str, token: str) -> list[dict]:
    return _request(
        base_url, "GET",
        f"/admin/realms/{realm}/authentication/flows",
        token,
    )


def get_executions(base_url: str, realm: str, flow_id: str, token: str) -> list[dict]:
    return _request(
        base_url, "GET",
        f"/admin/realms/{realm}/authentication/flows/{flow_id}/executions",
        token,
    )


def put_executions(
    base_url: str, realm: str, flow_id: str, executions: list[dict], token: str
) -> None:
    _request(
        base_url, "PUT",
        f"/admin/realms/{realm}/authentication/flows/{flow_id}/executions",
        token,
        data=executions,
    )


def main() -> int:
    root = Path(__file__).resolve().parent.parent.parent
    env = get_env(root)
    base_url = env.get("KEYCLOAK_URL", "http://localhost:8080").strip()
    admin_password = env.get("KEYCLOAK_ADMIN_PASSWORD", "").strip()
    realm = env.get("KEYCLOAK_REALM", "kairos-prod").strip()

    if not admin_password:
        sys.exit("KEYCLOAK_ADMIN_PASSWORD is required. Set it in .env.")

    token = get_admin_token(base_url, admin_password)
    flows = get_flows(base_url, realm, token)
    browser_flow = next((f for f in flows if f.get("alias") == BROWSER_FLOW_ALIAS), None)
    if not browser_flow:
        sys.exit(f"Browser flow not found in realm {realm}.")

    browser_flow_id = browser_flow.get("id") or browser_flow.get("alias")
    browser_executions = get_executions(base_url, realm, browser_flow_id, token)
    forms_execution = next(
        (e for e in browser_executions
         if e.get("providerId") == "basic-flow" or (e.get("displayName") or "").lower() == "forms"),
        None,
    )
    if not forms_execution:
        sys.exit("Forms subflow not found under browser flow.")

    forms_flow_id = forms_execution.get("id")
    forms_executions = get_executions(base_url, realm, forms_flow_id, token)
    form_exec = next(
        (e for e in forms_executions if e.get("providerId") == USERNAME_PASSWORD_FORM_PROVIDER_ID),
        None,
    )
    if not form_exec:
        sys.exit("Username Password Form execution not found under forms subflow.")

    if form_exec.get("requirement") == REQUIREMENT_DISABLED:
        print(f"Username Password Form already disabled in realm {realm}.")
        return 0

    for e in forms_executions:
        if e.get("id") == form_exec.get("id"):
            e["requirement"] = REQUIREMENT_DISABLED
            break
    put_executions(base_url, realm, forms_flow_id, forms_executions, token)
    print(f"Disabled local login (Username Password Form) in realm {realm}.")
    return 0


if __name__ == "__main__":
    sys.exit(main())
