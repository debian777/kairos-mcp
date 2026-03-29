#!/usr/bin/env python3
"""Copy install docs into skills/.system/kairos-install/references/ and fix
out-of-bundle links. Canonical sources live under docs/install/. Run from repo root."""
from __future__ import annotations

import shutil
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
REF = ROOT / "skills" / ".system" / "kairos-install" / "references"
DOCS = ROOT / "docs"
INST = DOCS / "install"
BASE = "https://github.com/debian777/kairos-mcp/blob/main"

# Flat layout under references/ (Agent Skills progressive disclosure)
COPIES = [
    (INST / "docker-compose-simple.md", REF / "docker-compose-simple.md"),
    (INST / "docker-compose-full-stack.md", REF / "docker-compose-full-stack.md"),
    (INST / "cursor-mcp.md", REF / "cursor-mcp.md"),
    (INST / "env-and-secrets.md", REF / "env-and-secrets.md"),
    (DOCS / "CLI.md", REF / "CLI.md"),
    (INST / "google-auth-dev.md", REF / "install" / "google-auth-dev.md"),
]


def patch_cursor_mcp(text: str) -> str:
    text = text.replace(
        "The repository root [README](../../README.md) summarizes the same paths.",
        f"The repository [README]({BASE}/README.md) summarizes the same paths.",
    )
    text = text.replace(
        "in the root [README](../../README.md).",
        f"in the repository [README]({BASE}/README.md).",
    )
    text = text.replace(
        "when calling MCP from an agent bridge. See [AGENTS.md](../../AGENTS.md).",
        "when calling MCP from an agent bridge. See "
        f"[AGENTS.md]({BASE}/AGENTS.md).",
    )
    text = text.replace(
        "See [CLI auth](../CLI.md#authentication) and\n[authentication overview](../architecture/auth-overview.md).",
        "See [CLI auth](CLI.md#authentication) and\n"
        f"[authentication overview]({BASE}/docs/architecture/auth-overview.md).",
    )
    return text


def patch_docker_full(text: str) -> str:
    return text.replace(
        "[Infrastructure](../architecture/infrastructure.md)",
        f"[Infrastructure]({BASE}/docs/architecture/infrastructure.md)",
    )


def patch_cli(text: str) -> str:
    old = """## Related docs

- [Install index](install/README.md)
- [Environment variables and secrets](install/env-and-secrets.md)
- [Install MCP in Cursor](install/cursor-mcp.md)
- [Architecture](architecture/README.md)
- [Protocol examples](examples/README.md)"""
    new = f"""## Related docs

- [Install index]({BASE}/docs/install/README.md)
- [Environment variables and secrets](env-and-secrets.md)
- [Install MCP in Cursor](cursor-mcp.md)
- [Architecture]({BASE}/docs/architecture/README.md)
- [Protocol examples]({BASE}/docs/examples/README.md)"""
    return text.replace(old, new)


def main() -> None:
    REF.mkdir(parents=True, exist_ok=True)
    (REF / "install").mkdir(parents=True, exist_ok=True)
    for src, dst in COPIES:
        if not src.is_file():
            raise SystemExit(f"missing source: {src}")
        shutil.copy2(src, dst)
        print(f"copied {src.relative_to(ROOT)} -> {dst.relative_to(ROOT)}")

    cm = REF / "cursor-mcp.md"
    cm.write_text(patch_cursor_mcp(cm.read_text(encoding="utf-8")), encoding="utf-8")
    print("patched cursor-mcp.md")

    fs = REF / "docker-compose-full-stack.md"
    fs.write_text(patch_docker_full(fs.read_text(encoding="utf-8")), encoding="utf-8")
    print("patched docker-compose-full-stack.md")

    cli = REF / "CLI.md"
    cli.write_text(patch_cli(cli.read_text(encoding="utf-8")), encoding="utf-8")
    print("patched CLI.md")

    cm_t = cm.read_text(encoding="utf-8")
    if BASE not in cm_t:
        raise SystemExit("cursor-mcp.md patch verification failed")
    if BASE not in fs.read_text(encoding="utf-8"):
        raise SystemExit("docker-compose-full-stack.md patch verification failed")
    if BASE not in cli.read_text(encoding="utf-8"):
        raise SystemExit("CLI.md patch verification failed")

    print("done — REFERENCE-LINKS.md and references/README.md are not overwritten")


if __name__ == "__main__":
    main()
