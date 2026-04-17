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
    (INST / "prerequisites.md", REF / "prerequisites.md"),
    (INST / "docker-compose-simple.md", REF / "docker-compose-simple.md"),
    (INST / "docker-compose-full-stack.md", REF / "docker-compose-full-stack.md"),
    (DOCS / "CLI.md", REF / "CLI.md"),
    (INST / "README.md", REF / "install" / "README.md"),
]


def patch_install_hub(text: str) -> str:
    """Hub README lives under references/install/; fix paths for the flat bundle."""
    text = text.replace("](docker-compose-simple.md", "](../docker-compose-simple.md")
    text = text.replace("](docker-compose-full-stack.md", "](../docker-compose-full-stack.md")
    text = text.replace(
        "](env-and-secrets.md",
        f"]({BASE}/docs/install/docker-compose-simple.md#3-environment-file",
    )
    text = text.replace("](prerequisites.md", "](../prerequisites.md")
    text = text.replace(
        "when calling MCP from an agent bridge. See [AGENTS.md](../../AGENTS.md).",
        "when calling MCP from an agent bridge. See "
        f"[AGENTS.md]({BASE}/AGENTS.md).",
    )
    text = text.replace(
        "[authentication overview](../architecture/auth-overview.md).",
        f"[authentication overview]({BASE}/docs/architecture/auth-overview.md).",
    )
    text = text.replace(
        "- [Documentation map](../README.md)",
        f"- [Documentation map]({BASE}/docs/README.md)",
    )
    text = text.replace(
        "- [Main README](../../README.md)",
        f"- [Main README]({BASE}/README.md)",
    )
    return text


def patch_cursor_links_for_bundle(text: str) -> str:
    """From references/*.md, Cursor section is under install/README.md."""
    return text.replace(
        "[Cursor and MCP](README.md#cursor-and-mcp)",
        "[Cursor and MCP](install/README.md#cursor-and-mcp)",
    )


def patch_docker_full(text: str) -> str:
    return text.replace(
        "[Infrastructure](../architecture/infrastructure.md)",
        f"[Infrastructure]({BASE}/docs/architecture/infrastructure.md)",
    )


def patch_cli(text: str) -> str:
    text = text.replace("[Install index](install/README.md)", f"[Install index]({BASE}/docs/install/README.md)")
    text = text.replace(
        "[Environment variables and secrets](install/env-and-secrets.md)",
        f"[Environment file and required variables]({BASE}/docs/install/docker-compose-simple.md#3-environment-file)",
    )
    text = text.replace(
        "[Cursor and MCP](install/README.md#cursor-and-mcp)",
        f"[Cursor and MCP]({BASE}/docs/install/README.md#cursor-and-mcp)",
    )
    text = text.replace("[Architecture](architecture/README.md)", f"[Architecture]({BASE}/docs/architecture/README.md)")
    text = text.replace("[Protocol examples](examples/README.md)", f"[Adapter examples]({BASE}/docs/examples/README.md)")
    text = text.replace("[Adapter examples](examples/README.md)", f"[Adapter examples]({BASE}/docs/examples/README.md)")
    return text


def main() -> None:
    REF.mkdir(parents=True, exist_ok=True)
    (REF / "install").mkdir(parents=True, exist_ok=True)
    for src, dst in COPIES:
        if not src.is_file():
            raise SystemExit(f"missing source: {src}")
        shutil.copy2(src, dst)
        print(f"copied {src.relative_to(ROOT)} -> {dst.relative_to(ROOT)}")

    hub = REF / "install" / "README.md"
    hub.write_text(patch_install_hub(hub.read_text(encoding="utf-8")), encoding="utf-8")
    print("patched install/README.md")

    simple = REF / "docker-compose-simple.md"
    simple.write_text(patch_cursor_links_for_bundle(simple.read_text(encoding="utf-8")), encoding="utf-8")
    print("patched docker-compose-simple.md (Cursor links)")

    fs = REF / "docker-compose-full-stack.md"
    fs.write_text(
        patch_docker_full(patch_cursor_links_for_bundle(fs.read_text(encoding="utf-8"))),
        encoding="utf-8",
    )
    print("patched docker-compose-full-stack.md")

    cli = REF / "CLI.md"
    cli.write_text(patch_cli(cli.read_text(encoding="utf-8")), encoding="utf-8")
    print("patched CLI.md")

    hub_t = hub.read_text(encoding="utf-8")
    if BASE not in hub_t:
        raise SystemExit("install/README.md patch verification failed")
    if BASE not in fs.read_text(encoding="utf-8"):
        raise SystemExit("docker-compose-full-stack.md patch verification failed")
    cli_t = cli.read_text(encoding="utf-8")
    if f"{BASE}/docs/install/README.md#cursor-and-mcp" not in cli_t:
        raise SystemExit("CLI.md patch verification failed")

    print("done — REFERENCE-LINKS.md and references/README.md are not overwritten")


if __name__ == "__main__":
    main()
