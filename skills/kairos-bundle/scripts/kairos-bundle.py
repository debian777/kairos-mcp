#!/usr/bin/env python3
"""
Export or import KAIROS protocols via the API (bundle to dir / mint from dir).
Self-manages .venv and requirements.txt in the skill directory.

Requires:
  KAIROS_TOKEN   - Bearer token (e.g. KAIROS_TOKEN=$(kairos token))
  KAIROS_API_URL - Optional; default http://localhost:3000

Usage:
  export  - save all protocols from spaces into --dir
  import  - mint all .md files from --dir into KAIROS (personal space)

Run from repo root:
  KAIROS_TOKEN=$(kairos token) python3 skills/kairos-bundle/scripts/kairos-bundle.py export [--dir DIR]
  KAIROS_TOKEN=$(kairos token) python3 skills/kairos-bundle/scripts/kairos-bundle.py import [--dir DIR] [--force]
"""
from __future__ import annotations

import argparse
import json
import os
import re
import subprocess
import sys
import urllib.error
import urllib.request
import venv
from pathlib import Path

# Skill dir (skills/kairos-bundle); repo root for cwd when re-exec
SCRIPT_DIR = Path(__file__).resolve().parent.parent
REPO_ROOT = SCRIPT_DIR.parent.parent
VENV_DIR = SCRIPT_DIR / ".venv"
REQUIREMENTS = SCRIPT_DIR / "requirements.txt"


def _venv_python() -> Path:
    if os.name == "nt":
        return VENV_DIR / "Scripts" / "python.exe"
    return VENV_DIR / "bin" / "python"


def _in_skill_venv() -> bool:
    try:
        return Path(sys.prefix).resolve() == VENV_DIR.resolve()
    except (AttributeError, OSError):
        return False


def _ensure_venv_and_install() -> bool:
    """Create .venv if missing, pip install -r requirements.txt. Returns True on success."""
    if not VENV_DIR.exists():
        venv.create(VENV_DIR, clear=False, with_pip=True)
    py = _venv_python()
    if not py.exists():
        return False
    if REQUIREMENTS.exists():
        rc = subprocess.run(
            [str(py), "-m", "pip", "install", "--quiet", "-r", str(REQUIREMENTS)],
            cwd=REPO_ROOT,
            capture_output=True,
            timeout=120,
        )
        if rc.returncode != 0:
            return False
    return True


def env(key: str, default: str | None = None) -> str | None:
    v = os.environ.get(key)
    if v is not None and v.strip():
        return v.strip()
    return default


def slug(s: str) -> str:
    """Safe filename slug from title."""
    s = re.sub(r"[^\w\s-]", "", s)
    s = re.sub(r"[-\s]+", "-", s).strip("-")
    return (s[:80] + "-") if len(s) > 80 else s or "unnamed"


# --- Export ---

def run_export(
    base_url: str,
    token: str,
    target_dir: str,
    space_filter: str | None,
    dry_run: bool,
) -> int:
    req = urllib.request.Request(
        f"{base_url}/api/kairos_spaces",
        data=json.dumps({"include_chain_titles": True}).encode(),
        headers={
            "Content-Type": "application/json",
            "Authorization": f"Bearer {token}",
        },
        method="POST",
    )
    try:
        with urllib.request.urlopen(req, timeout=30) as resp:
            spaces_data = json.loads(resp.read().decode())
    except urllib.error.HTTPError as e:
        print(f"kairos_spaces failed: {e.code} {e.reason}", file=sys.stderr)
        if e.fp:
            print(e.fp.read().decode(), file=sys.stderr)
        return 1
    except urllib.error.URLError as e:
        print(f"Request failed: {e.reason}", file=sys.stderr)
        return 1

    spaces = spaces_data.get("spaces") or []
    chains: list[tuple[str, str, str]] = []
    for sp in spaces:
        name = sp.get("name") or "unknown"
        if space_filter and name != space_filter:
            continue
        for ch in sp.get("chains") or []:
            cid = ch.get("chain_id")
            title = ch.get("title") or cid or "unnamed"
            if cid:
                chains.append((cid, title, name))

    if not chains:
        print("No chains found (or none match --space).", file=sys.stderr)
        return 0

    print(f"Found {len(chains)} protocol(s).", file=sys.stderr)
    if dry_run:
        for cid, title, space_name in chains:
            print(f"  {cid}  {title}  ({space_name})")
        return 0

    os.makedirs(target_dir, exist_ok=True)
    failed = 0
    for cid, title, space_name in chains:
        uri = f"kairos://mem/{cid}"
        req = urllib.request.Request(
            f"{base_url}/api/kairos_dump",
            data=json.dumps({"uri": uri, "protocol": True}).encode(),
            headers={
                "Content-Type": "application/json",
                "Authorization": f"Bearer {token}",
            },
            method="POST",
        )
        try:
            with urllib.request.urlopen(req, timeout=30) as resp:
                out = json.loads(resp.read().decode())
        except urllib.error.HTTPError as e:
            print(f"  dump {cid} failed: {e.code}", file=sys.stderr)
            failed += 1
            continue
        except urllib.error.URLError as e:
            print(f"  dump {cid} failed: {e.reason}", file=sys.stderr)
            failed += 1
            continue

        md = out.get("markdown_doc") or ""
        safe_title = slug(title)
        path = os.path.join(target_dir, f"{safe_title}_{cid[:8]}.md")
        with open(path, "w", encoding="utf-8") as f:
            f.write(md)
        print(f"  {path}", file=sys.stderr)

    if failed:
        print(f"Failed: {failed} of {len(chains)}", file=sys.stderr)
        return 1
    print(f"Wrote {len(chains)} file(s) to {target_dir}", file=sys.stderr)
    return 0


# --- Import ---

def run_import(
    base_url: str,
    token: str,
    target_dir: str,
    force: bool,
    dry_run: bool,
) -> int:
    if not os.path.isdir(target_dir):
        print(f"Not a directory: {target_dir}", file=sys.stderr)
        return 1

    files = sorted(f for f in os.listdir(target_dir) if f.endswith(".md") and os.path.isfile(os.path.join(target_dir, f)))
    if not files:
        print(f"No .md files in {target_dir}", file=sys.stderr)
        return 0

    print(f"Found {len(files)} .md file(s) in {target_dir}.", file=sys.stderr)
    if dry_run:
        for f in files:
            print(f"  {f}")
        return 0

    failed = 0
    for name in files:
        path = os.path.join(target_dir, name)
        with open(path, "r", encoding="utf-8") as f:
            markdown = f.read().strip()
        if not markdown:
            print(f"  skip (empty): {name}", file=sys.stderr)
            continue

        url = f"{base_url}/api/kairos_mint/raw"
        if force:
            url += "?force=true"
        req = urllib.request.Request(
            url,
            data=markdown.encode("utf-8"),
            headers={
                "Content-Type": "text/markdown",
                "Authorization": f"Bearer {token}",
            },
            method="POST",
        )
        try:
            with urllib.request.urlopen(req, timeout=60) as resp:
                out = json.loads(resp.read().decode())
        except urllib.error.HTTPError as e:
            body = e.fp.read().decode() if e.fp else ""
            print(f"  mint {name} failed: {e.code} {body[:200]}", file=sys.stderr)
            failed += 1
            continue
        except urllib.error.URLError as e:
            print(f"  mint {name} failed: {e.reason}", file=sys.stderr)
            failed += 1
            continue

        items = out.get("items") or []
        uris = [it.get("uri") for it in items if it.get("uri")]
        print(f"  {name} -> {uris[0] if uris else 'ok'}", file=sys.stderr)

    if failed:
        print(f"Failed: {failed} of {len(files)}", file=sys.stderr)
        return 1
    print(f"Minted {len(files)} file(s) from {target_dir}", file=sys.stderr)
    return 0


def main() -> int:
    parser = argparse.ArgumentParser(
        description="Export or import KAIROS protocols (bundle to dir / mint from dir).",
        epilog="Set KAIROS_TOKEN (e.g. KAIROS_TOKEN=$(kairos token)). Optional: KAIROS_API_URL.",
    )
    sub = parser.add_subparsers(dest="command", required=True, help="export: save all protocols to dir; import: mint all .md files from dir")

    # export
    p_export = sub.add_parser("export", help="Save all protocols from spaces into --dir")
    p_export.add_argument(
        "--dir",
        dest="dir",
        default=".local/cache/dump",
        metavar="DIR",
        help="Target directory to write .md files (default: .local/cache/dump)",
    )
    p_export.add_argument(
        "--space",
        default=None,
        metavar="NAME",
        help="Only export chains from this space (e.g. 'Personal'). Default: all.",
    )
    p_export.add_argument("--dry-run", action="store_true", help="List chains only, do not save")

    # import
    p_import = sub.add_parser("import", help="Mint all .md files from --dir into KAIROS (personal space)")
    p_import.add_argument(
        "--dir",
        dest="dir",
        default=".local/cache/dump",
        metavar="DIR",
        help="Target directory to read .md files from (default: .local/cache/dump)",
    )
    p_import.add_argument("--force", action="store_true", help="Overwrite existing chain with same title (force=true)")
    p_import.add_argument("--dry-run", action="store_true", help="List .md files only, do not mint")

    args = parser.parse_args()

    token = env("KAIROS_TOKEN")
    if not token:
        print("KAIROS_TOKEN is not set. Example: KAIROS_TOKEN=$(kairos token)", file=sys.stderr)
        return 1

    base_url = (env("KAIROS_API_URL") or "http://localhost:3000").rstrip("/")

    if args.command == "export":
        return run_export(
            base_url,
            token,
            args.dir,
            getattr(args, "space", None),
            getattr(args, "dry_run", False),
        )
    if args.command == "import":
        return run_import(
            base_url,
            token,
            args.dir,
            getattr(args, "force", False),
            getattr(args, "dry_run", False),
        )
    return 1


if __name__ == "__main__":
    if not _in_skill_venv():
        if not _ensure_venv_and_install():
            print("kairos-bundle: failed to create .venv or install requirements.", file=sys.stderr)
            sys.exit(1)
        py = _venv_python()
        script_abs = Path(__file__).resolve()
        rc = subprocess.run([str(py), str(script_abs)] + sys.argv[1:], cwd=REPO_ROOT)
        sys.exit(rc.returncode)
    sys.exit(main())
