#!/usr/bin/env python3
"""KAIROS DCR Stale Client Cleanup.

Periodically removes stale dynamically-registered Keycloak clients.
Uses only Python stdlib — no pip packages needed.
Kubernetes API access via ServiceAccount token + in-cluster CA.
"""

import json
import os
import ssl
import sys
import time
import urllib.error
import urllib.parse
import urllib.request
from datetime import datetime, timedelta, timezone


# ---------------------------------------------------------------------------
# Kubernetes API helpers (in-cluster, no kubectl)
# ---------------------------------------------------------------------------

class K8sClient:
    """Minimal Kubernetes API client using ServiceAccount token."""

    def __init__(self):
        token_path = "/var/run/secrets/kubernetes.io/serviceaccount/token"
        ca_path = "/var/run/secrets/kubernetes.io/serviceaccount/ca.crt"
        ns_path = "/var/run/secrets/kubernetes.io/serviceaccount/namespace"
        with open(token_path) as f:
            self.token = f.read().strip()
        self.api_host = os.environ["KUBERNETES_SERVICE_HOST"]
        self.api_port = os.environ["KUBERNETES_SERVICE_PORT"]
        self.base = f"https://{self.api_host}:{self.api_port}"
        ctx = ssl.create_default_context(cafile=ca_path)
        self.opener = urllib.request.build_opener(urllib.request.HTTPSHandler(context=ctx))

    def _req(self, method, path, body=None):
        url = f"{self.base}{path}"
        data = json.dumps(body).encode() if body else None
        req = urllib.request.Request(
            url, data=data, method=method,
            headers={
                "Authorization": f"Bearer {self.token}",
                "Content-Type": "application/merge-patch+json",
            },
        )
        with self.opener.open(req, timeout=30) as resp:
            return json.loads(resp.read())

    def get_configmap(self, namespace, name):
        try:
            return self._req("GET", f"/api/v1/namespaces/{namespace}/configmaps/{name}")
        except urllib.error.HTTPError as e:
            if e.code == 404:
                return None
            raise

    def patch_configmap(self, namespace, name, data):
        return self._req(
            "PATCH",
            f"/api/v1/namespaces/{namespace}/configmaps/{name}",
            {"data": data},
        )


# ---------------------------------------------------------------------------
# Keycloak helpers
# ---------------------------------------------------------------------------

def http_json(url, method="GET", headers=None, data=None, timeout=15):
    """Make an HTTP request, return parsed JSON (or None on error)."""
    req = urllib.request.Request(url, method=method)
    if headers:
        for k, v in headers.items():
            req.add_header(k, v)
    if data:
        req.data = urllib.parse.urlencode(data).encode()
    try:
        with urllib.request.urlopen(req, timeout=timeout) as resp:
            return json.loads(resp.read())
    except urllib.error.HTTPError as e:
        print(f"HTTP {e.code} from {url}: {e.read().decode(errors='replace')[:200]}")
        return None
    except Exception as e:
        print(f"HTTP error from {url}: {e}")
        return None


def http_status(url, method="GET", headers=None, timeout=10):
    """Return HTTP status code (0 on error)."""
    req = urllib.request.Request(url, method=method)
    if headers:
        for k, v in headers.items():
            req.add_header(k, v)
    try:
        with urllib.request.urlopen(req, timeout=timeout) as resp:
            return resp.status
    except urllib.error.HTTPError as e:
        return e.code
    except Exception:
        return 0


def wait_keycloak(base, max_retries=5, delay=2):
    """Poll Keycloak health endpoint with exponential backoff."""
    print("Waiting for Keycloak...")
    for attempt in range(max_retries):
        status = http_status(f"{base}/health/ready")
        if status == 200:
            print("Keycloak is ready.")
            return True
        print(f"Keycloak not ready (attempt {attempt + 1}/{max_retries}), retrying in {delay}s...")
        time.sleep(delay)
        delay *= 2
    print(f"ERROR: Keycloak not ready after {max_retries} retries.")
    return False


def get_admin_token(base, password):
    """Obtain Keycloak admin access token via password grant."""
    print("Obtaining admin access token...")
    resp = http_json(
        f"{base}/realms/master/protocol/openid-connect/token",
        method="POST",
        headers={"Content-Type": "application/x-www-form-urlencoded"},
        data={
            "grant_type": "password",
            "client_id": "admin-cli",
            "username": "admin",
            "password": password,
        },
    )
    if not resp or not resp.get("access_token"):
        print("ERROR: Failed to obtain access token.")
        return None
    print("Token obtained.")
    return resp["access_token"]


def fetch_all_clients(base, realm, token, page_size=500):
    """Paginated client fetch from Keycloak Admin API."""
    auth = {"Authorization": f"Bearer {token}"}
    all_clients = []
    first = 0
    while True:
        page = http_json(
            f"{base}/admin/realms/{realm}/clients?first={first}&max={page_size}",
            headers=auth,
        )
        if not page:
            break
        all_clients.extend(page)
        if len(page) < page_size:
            break
        first += page_size
    return all_clients


def delete_client(base, realm, client_uuid, token):
    """Delete a Keycloak client by UUID. Returns True on 204."""
    status = http_status(
        f"{base}/admin/realms/{realm}/clients/{client_uuid}",
        method="DELETE",
        headers={"Authorization": f"Bearer {token}"},
    )
    return status == 204


# ---------------------------------------------------------------------------
# Main cleanup logic
# ---------------------------------------------------------------------------

def main():
    keycloak_base = os.environ["KEYCLOAK_BASE"]
    state_cm = os.environ["STATE_CM"]
    namespace = os.environ["NAMESPACE"]
    stale_days = int(os.environ["STALE_DAYS"])
    dry_run = os.environ["DRY_RUN"].lower() == "true"
    protected = json.loads(os.environ["PROTECTED"])
    realms = json.loads(os.environ["REALMS"])

    with open("/var/run/secrets/admin/password") as f:
        admin_pw = f.read().strip()

    k8s = K8sClient()

    # Load state
    cm = k8s.get_configmap(namespace, state_cm)
    seen = {}
    if cm and cm.get("data", {}).get("seen_clients"):
        try:
            seen = json.loads(cm["data"]["seen_clients"])
        except json.JSONDecodeError:
            pass

    now = datetime.now(timezone.utc)
    cutoff = now - timedelta(days=stale_days)

    print("=== KAIROS DCR Stale Client Cleanup ===")
    print(f"Keycloak: {keycloak_base}")
    print(f"Realms: {realms}")
    print(f"Stale after: {stale_days} days (before {cutoff.isoformat()})")
    print(f"Dry run: {dry_run}")
    print()

    if not wait_keycloak(keycloak_base):
        sys.exit(1)

    token = get_admin_token(keycloak_base, admin_pw)
    if not token:
        sys.exit(1)

    total_scanned = 0
    total_stale = 0
    total_deleted = 0
    total_skipped = 0

    for realm in realms:
        print(f"\n--- Realm: {realm} ---")
        clients = fetch_all_clients(keycloak_base, realm, token)
        print(f"Total clients: {len(clients)}")

        live_keys = set()
        for c in clients:
            cid = c["clientId"]
            uuid = c["id"]
            total_scanned += 1
            state_key = f"{realm}/{cid}"
            live_keys.add(state_key)

            # Skip protected
            if cid in protected:
                continue

            # Track first-seen
            if state_key not in seen:
                seen[state_key] = now.isoformat()

            first_seen = datetime.fromisoformat(seen[state_key])
            if first_seen.tzinfo is None:
                first_seen = first_seen.replace(tzinfo=timezone.utc)

            if first_seen < cutoff:
                total_stale += 1
                if dry_run:
                    print(f"[DRY-RUN] Would delete {state_key} (first seen: {first_seen.isoformat()})")
                else:
                    print(f"Deleting {state_key} (first seen: {first_seen.isoformat()})")
                    if delete_client(keycloak_base, realm, uuid, token):
                        total_deleted += 1
                        del seen[state_key]
                    else:
                        print(f"WARNING: DELETE {state_key} failed")
            else:
                total_skipped += 1

        # Prune state entries for clients that no longer exist
        for k in list(seen.keys()):
            if k.startswith(f"{realm}/") and k not in live_keys:
                del seen[k]

    # Save state
    k8s.patch_configmap(namespace, state_cm, {"seen_clients": json.dumps(seen)})

    print()
    print("=== Summary ===")
    print(f"Clients scanned: {total_scanned}")
    print(f"Stale candidates: {total_stale}")
    print(f"Deleted: {total_deleted}")
    print(f"Skipped (not stale): {total_skipped}")
    print("Done.")


if __name__ == "__main__":
    main()

