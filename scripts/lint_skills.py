#!/usr/bin/env python3
"""
Validate skills under skills/ using the skills-ref Python API (Agent Skills spec).
If skills_ref is not installed, the script will create/use repo .venv, install
the dependency, and re-run. If auto-install is not possible, exit 0 with a hint.

Usage (from repo root):
  python3 scripts/lint_skills.py

Exit: 0 if all valid or skipped (import error); 1 if any validation errors.
"""
from __future__ import annotations

import os
import subprocess
import sys
import venv
from pathlib import Path

REPO_ROOT = Path(__file__).resolve().parent.parent
SKILLS_DIR = REPO_ROOT / "skills"
VENV_DIR = REPO_ROOT / ".venv"
SKILL_REF_SPEC = "skills-ref @ git+https://github.com/agentskills/agentskills.git#subdirectory=skills-ref"
SKILL_REF_INSTALL = f'pip install "{SKILL_REF_SPEC}"'


def _venv_python() -> Path:
    if os.name == "nt":
        return VENV_DIR / "Scripts" / "python.exe"
    return VENV_DIR / "bin" / "python"


def _in_repo_venv() -> bool:
    try:
        return Path(sys.prefix).resolve() == VENV_DIR.resolve()
    except (AttributeError, OSError):
        return False


def _ensure_venv_and_install() -> bool:
    """Create .venv if missing, install skills-ref into it. Returns True if install succeeded."""
    if not VENV_DIR.exists():
        venv.create(VENV_DIR, clear=False, with_pip=True)
    py = _venv_python()
    if not py.exists():
        return False
    cmd = [str(py), "-m", "pip", "install", "--quiet", SKILL_REF_SPEC]
    result = subprocess.run(cmd, cwd=REPO_ROOT, capture_output=True, timeout=120)
    return result.returncode == 0


def main() -> int:
    try:
        from skills_ref import validate
    except ImportError:
        if _in_repo_venv():
            # We're in repo .venv but package missing — install here and retry
            result = subprocess.run(
                [sys.executable, "-m", "pip", "install", "--quiet", SKILL_REF_SPEC],
                cwd=REPO_ROOT,
                capture_output=True,
                timeout=120,
            )
            if result.returncode != 0:
                print("lint:skills: skills-ref install failed, skipping.")
                print(f"  Install manually: {SKILL_REF_INSTALL}")
                return 0
            try:
                from skills_ref import validate
            except ImportError:
                print("lint:skills: skills-ref not available after install, skipping.")
                return 0
        else:
            # Not in repo .venv — ensure .venv exists and has package, then re-exec
            if not _ensure_venv_and_install():
                print("lint:skills: skills-ref not installed (optional dev dependency), skipping.")
                print(f"  Install: {SKILL_REF_INSTALL}")
                return 0
            py = _venv_python()
            script_abs = Path(__file__).resolve()
            rc = subprocess.run([str(py), str(script_abs)] + sys.argv[1:], cwd=REPO_ROOT)
            return rc.returncode

    if not SKILLS_DIR.is_dir():
        return 0

    failed = False
    for skill_path in sorted(SKILLS_DIR.iterdir()):
        if not skill_path.is_dir():
            continue
        skill_md = skill_path / "SKILL.md"
        if not skill_md.exists():
            continue
        rel = skill_path.relative_to(REPO_ROOT)
        problems = validate(skill_path)
        if problems:
            failed = True
            print(f"{rel} .... FAIL")
            print(f"  {'; '.join(problems)}")
        else:
            print(f"{rel} .... OK")

    return 1 if failed else 0


if __name__ == "__main__":
    sys.exit(main())
