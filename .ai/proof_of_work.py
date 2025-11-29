#!/usr/bin/env python3
"""ai_proof.py - Proof-of-work compliance enforcement for AI coding standards.

Implements the 9-step proof-of-work requirements from PROTOCOL: ELITE AI CODING STANDARDS.

Each step corresponds to a section in tmp/updated-ai-coding-standards.md:
1. FEATURE BRANCH ISOLATION
2. LEARN PROJECT TOOLS
3. INTELLIGENCE AUGMENTATION (MCPs)
4. BASELINE TRUTH (Pre-flight Testing)
5. TEST-DRIVEN DOMINANCE (New Features)
6. IMMUTABILITY OF LEGACY (Regression Prevention)
7. THE FEEDBACK LOOP (Iterative Execution)
8. ATOMICITY (Git Commits)
9. PROOF OF WORK (The Handoff)

The script auto-detects project type and adapts to available tools (npm, make, etc.).
"""

import argparse
import json
import re
import subprocess
import sys
from dataclasses import dataclass, field
from pathlib import Path
from typing import Dict, List, Optional, Tuple

try:
    from git import Repo as GitRepo
    from git.exc import InvalidGitRepositoryError, GitCommandError
    HAS_GITPYTHON = True
except ImportError:
    HAS_GITPYTHON = False


@dataclass
class ProjectDetection:
    root: Path
    has_node: bool = False
    has_python: bool = False
    has_terraform: bool = False
    has_terragrunt: bool = False
    has_makefile: bool = False
    details: Dict[str, str] = field(default_factory=dict)
    git: Dict[str, object] = field(default_factory=dict)

    def to_dict(self) -> Dict[str, object]:
        return {
            "root": str(self.root),
            "has_node": self.has_node,
            "has_python": self.has_python,
            "has_terraform": self.has_terraform,
            "has_terragrunt": self.has_terragrunt,
            "has_makefile": self.has_makefile,
            "details": self.details,
            "git": self.git,
        }


def detect_project(root: Path) -> ProjectDetection:
    """Detect project type and available tools."""
    detection = ProjectDetection(root=root)

    # Node.js / TypeScript: package.json
    pkg_json = root / "package.json"
    if pkg_json.is_file():
        detection.has_node = True
        detection.details["node"] = "package.json found"

    # Python
    if (root / "pyproject.toml").is_file() or (root / "requirements.txt").is_file():
        detection.has_python = True
        detection.details["python"] = "pyproject.toml or requirements.txt found"

    # Terraform / Terragrunt
    if list(root.glob("*.tf")):
        detection.has_terraform = True
        detection.details["terraform"] = "*.tf found"
    if (root / "terragrunt.hcl").is_file():
        detection.has_terragrunt = True
        detection.details["terragrunt"] = "terragrunt.hcl found"

    # Makefile
    if (root / "Makefile").is_file():
        detection.has_makefile = True
        detection.details["make"] = "Makefile found"

    # Git state
    detection.git = get_git_state(root)
    return detection


def get_git_state(root: Path) -> Dict[str, object]:
    """Get git state using GitPython if available, otherwise use subprocess."""
    state: Dict[str, object] = {
        "enabled": False,
        "error": None,
        "branch": None,
        "on_main_protected": False,
        "has_unstaged": False,
        "has_staged": False,
        "has_untracked": False,
        "is_dirty": False,
        "commit_summary": None,
        "commit_hash": None,
        "short_hash": None,
    }

    if HAS_GITPYTHON:
        try:
            repo = GitRepo(str(root))
            state["enabled"] = True

            # Branch detection using GitPython
            try:
                active_branch = repo.active_branch
                branch_name = active_branch.name
                state["branch"] = branch_name
                if branch_name in ("main", "master"):
                    state["on_main_protected"] = True
            except (TypeError, AttributeError, GitCommandError) as exc:
                # Fallback to subprocess
                result = subprocess.run(
                    ["git", "rev-parse", "--abbrev-ref", "HEAD"],
                    cwd=root,
                    capture_output=True,
                    text=True,
                    check=False,
                )
                if result.returncode == 0:
                    branch_name = result.stdout.strip()
                    state["branch"] = branch_name
                    if branch_name in ("main", "master"):
                        state["on_main_protected"] = True

            # Status using GitPython
            try:
                # Check if dirty (includes untracked files check)
                state["is_dirty"] = repo.is_dirty()
                
                # Get untracked files
                untracked = repo.untracked_files
                state["has_untracked"] = len(untracked) > 0
                
                # Check staged changes (diff between index and HEAD)
                if repo.head.is_valid():
                    diff_index = repo.head.commit.diff(repo.index)
                    state["has_staged"] = len(list(diff_index)) > 0
                
                # Check unstaged changes (diff between working tree and index)
                diff_worktree = repo.index.diff(None)
                state["has_unstaged"] = len(list(diff_worktree)) > 0
                
                # Update is_dirty if we have more specific info
                if not state["is_dirty"]:
                    state["is_dirty"] = state["has_unstaged"] or state["has_staged"] or state["has_untracked"]
            except Exception as exc:
                state["error"] = f"git status error: {exc}"

            # Commit summary using GitPython
            try:
                commit = repo.head.commit
                commit_hash = commit.hexsha
                short_hash = commit_hash[:7]
                # Use summary (first line) for commit message
                message = commit.summary
                state["commit_hash"] = commit_hash
                state["short_hash"] = short_hash
                state["commit_summary"] = f"{short_hash} {message}"
            except Exception:
                # Fallback to subprocess
                result = subprocess.run(
                    ["git", "log", "-1", "--pretty=%h %s"],
                    cwd=root,
                    capture_output=True,
                    text=True,
                    check=False,
                )
                if result.returncode == 0:
                    state["commit_summary"] = result.stdout.strip()
                    if " " in result.stdout:
                        state["short_hash"] = result.stdout.split()[0]

        except (InvalidGitRepositoryError, Exception) as exc:
            state["error"] = f"not a git repo: {exc}"
            # Fall through to subprocess fallback
    else:
        # Fallback to subprocess if GitPython not available
        pass

    # Subprocess fallback (if GitPython failed or not available)
    if not state["enabled"] or state.get("error"):
        try:
            # Check if git is available
            subprocess.run(["git", "--version"], capture_output=True, check=True)
            state["enabled"] = True
            state["error"] = None

            # Get branch
            result = subprocess.run(
                ["git", "rev-parse", "--abbrev-ref", "HEAD"],
                cwd=root,
                capture_output=True,
                text=True,
                check=False,
            )
            if result.returncode == 0:
                branch = result.stdout.strip()
                state["branch"] = branch
                if branch in ("main", "master"):
                    state["on_main_protected"] = True

            # Get commit hash
            result = subprocess.run(
                ["git", "rev-parse", "HEAD"],
                cwd=root,
                capture_output=True,
                text=True,
                check=False,
            )
            if result.returncode == 0:
                commit_hash = result.stdout.strip()
                state["commit_hash"] = commit_hash
                state["short_hash"] = commit_hash[:7]

            # Get commit message
            result = subprocess.run(
                ["git", "log", "-1", "--pretty=%h %s"],
                cwd=root,
                capture_output=True,
                text=True,
                check=False,
            )
            if result.returncode == 0:
                state["commit_summary"] = result.stdout.strip()

            # Check if dirty (unstaged)
            result = subprocess.run(
                ["git", "diff", "--quiet"],
                cwd=root,
                check=False,
            )
            has_unstaged = result.returncode != 0
            state["has_unstaged"] = has_unstaged

            # Check if dirty (staged)
            result = subprocess.run(
                ["git", "diff", "--cached", "--quiet"],
                cwd=root,
                check=False,
            )
            has_staged = result.returncode != 0
            state["has_staged"] = has_staged

            # Check untracked
            result = subprocess.run(
                ["git", "ls-files", "--others", "--exclude-standard"],
                cwd=root,
                capture_output=True,
                text=True,
                check=False,
            )
            has_untracked = bool(result.stdout.strip())
            state["has_untracked"] = has_untracked

            state["is_dirty"] = has_unstaged or has_staged or has_untracked
        except FileNotFoundError:
            state["error"] = "git command not found"
        except subprocess.CalledProcessError:
            state["error"] = "git not available"

    return state


def step_1_feature_branch_isolation(root: Path) -> Tuple[bool, str]:
    """Step 1: FEATURE BRANCH ISOLATION
    Proof of work: command -v git && git rev-parse --abbrev-ref HEAD | grep -v main
    """
    git_state = get_git_state(root)
    if not git_state.get("enabled"):
        return False, f"Git not available: {git_state.get('error', 'unknown')}"

    branch = git_state.get("branch")
    if not branch:
        return False, "Could not determine git branch"

    if git_state.get("on_main_protected"):
        return False, f"Working on protected branch '{branch}'. Create a feature branch (feat/ or fix/)"

    return True, f"✓ On feature branch: {branch}"


def step_2_learn_project_tools(root: Path) -> Tuple[bool, str]:
    """Step 2: LEARN PROJECT TOOLS
    Proof of work: test -f Makefile && make 2>&1 || test -f package.json && npm run 2>&1
    """
    detection = detect_project(root)
    output_lines = []

    if detection.has_makefile:
        try:
            result = subprocess.run(
                ["make"],
                cwd=root,
                capture_output=True,
                text=True,
                check=False,
                timeout=30,
            )
            output_lines.append(f"Makefile found, make output (exit {result.returncode})")
            if result.stdout:
                output_lines.append(result.stdout[:500])  # Limit output
        except Exception as e:
            output_lines.append(f"make failed: {e}")

    if detection.has_node:
        try:
            result = subprocess.run(
                ["npm", "run"],
                cwd=root,
                capture_output=True,
                text=True,
                check=False,
                timeout=30,
            )
            output_lines.append(f"package.json found, npm run output (exit {result.returncode})")
            if result.stdout:
                output_lines.append(result.stdout[:500])  # Limit output
        except Exception as e:
            output_lines.append(f"npm run failed: {e}")

    if not detection.has_makefile and not detection.has_node:
        return False, "No Makefile or package.json found"

    return True, "\n".join(output_lines) if output_lines else "✓ Project tools discovered"


def step_3_intelligence_augmentation(root: Path) -> Tuple[bool, str]:
    """Step 3: INTELLIGENCE AUGMENTATION (MCPs: Kairos & Context7)
    No direct proof of work - MCP tools are used during execution.
    """
    return True, "MCP tools (KAIROS & Context7) should be used before making assumptions. Verified during execution."


def step_4_baseline_truth(root: Path) -> Tuple[bool, str]:
    """Step 4: BASELINE TRUTH (Pre-flight Testing)
    Proof of work: test -f cache/tests/baseline.log
    """
    baseline_log = root / "cache" / "tests" / "baseline.log"
    if baseline_log.exists():
        return True, f"✓ Baseline log exists: {baseline_log}"
    else:
        return False, f"Baseline log not found: {baseline_log}. Run tests to establish baseline."


def step_5_test_driven_dominance(root: Path) -> Tuple[bool, str]:
    """Step 5: TEST-DRIVEN DOMINANCE (New Features)
    Proof of work: test -f cache/tests/new-feature-tests.log
    """
    test_log = root / "cache" / "tests" / "new-feature-tests.log"
    if test_log.exists():
        return True, f"✓ New feature test log exists: {test_log}"
    else:
        return False, f"New feature test log not found: {test_log}. Write tests first or alongside feature."


def step_6_immutability_of_legacy(root: Path) -> Tuple[bool, str]:
    """Step 6: IMMUTABILITY OF LEGACY (Regression Prevention)
    Proof of work: test -f cache/tests/legacy-approval.log
    """
    legacy_log = root / "cache" / "tests" / "legacy-approval.log"
    if legacy_log.exists():
        return True, f"✓ Legacy approval log exists: {legacy_log}"
    else:
        return False, f"Legacy approval log not found: {legacy_log}. Verify legacy tests before changes."


def step_7_feedback_loop(root: Path) -> Tuple[bool, str]:
    """Step 7: THE FEEDBACK LOOP (Iterative Execution)
    Proof of work: test -f cache/build/feedback-cycle.log
    """
    feedback_log = root / "cache" / "build" / "feedback-cycle.log"
    if feedback_log.exists():
        return True, f"✓ Feedback cycle log exists: {feedback_log}"
    else:
        return False, f"Feedback cycle log not found: {feedback_log}. Code -> Build -> Test cycle required."


def step_8_atomicity(root: Path) -> Tuple[bool, str]:
    """Step 8: ATOMICITY (Git Commits)
    Proof of work: command -v git && git log -1 --pretty="%h %s" | grep -E '^(feat|fix|chore|docs|refactor|test|build|ci|perf|style)(\\(.+\\))?!?:' > cache/proof/handoff.log
    """
    git_state = get_git_state(root)
    if not git_state.get("enabled"):
        return False, f"Git not available: {git_state.get('error', 'unknown')}"

    commit_summary = git_state.get("commit_summary")
    if not commit_summary:
        return False, "Could not get last commit summary"

    # Extract message part (format is "hash message" or just "message")
    # Remove hash if present (first 7-40 chars followed by space)
    message_part = commit_summary
    if " " in commit_summary:
        parts = commit_summary.split(" ", 1)
        if len(parts) == 2 and len(parts[0]) <= 40:
            message_part = parts[1]

    # Check if commit follows conventional commits format
    pattern = r"^(feat|fix|chore|docs|refactor|test|build|ci|perf|style)(\(.+\))?!?:"
    if not re.match(pattern, message_part):
        return False, f"Last commit does not follow conventional commits: {commit_summary}"

    # Write to handoff.log (write the full summary as per proof-of-work requirement)
    handoff_log = root / "cache" / "proof" / "handoff.log"
    handoff_log.parent.mkdir(parents=True, exist_ok=True)
    handoff_log.write_text(commit_summary + "\n", encoding="utf-8")

    return True, f"✓ Commit follows conventional commits: {commit_summary}"


def step_9_proof_of_work(root: Path) -> Tuple[bool, str]:
    """Step 9: PROOF OF WORK (The Handoff)
    Proof of work: command -v git && git diff-index --quiet HEAD -- && egrep "^$(git rev-parse --short HEAD)" cache/proof/handoff.log
    """
    git_state = get_git_state(root)
    if not git_state.get("enabled"):
        return False, f"Git not available: {git_state.get('error', 'unknown')}"

    # Check if working tree is clean
    if git_state.get("is_dirty"):
        return False, "Working tree has uncommitted changes. Commit or stash before handoff."

    short_hash = git_state.get("short_hash")
    if not short_hash:
        return False, "Could not get commit hash"

    # Check if commit is in handoff.log
    handoff_log = root / "cache" / "proof" / "handoff.log"
    if not handoff_log.exists():
        return False, f"Handoff log not found: {handoff_log}. Run step 8 (atomicity) first."

    handoff_content = handoff_log.read_text(encoding="utf-8")
    if short_hash not in handoff_content:
        return False, f"Commit {short_hash} not found in handoff.log. Run step 8 (atomicity) first."

    return True, f"✓ Working tree clean, commit {short_hash} in handoff.log"


STEPS = {
    "1": ("feature-branch-isolation", step_1_feature_branch_isolation),
    "2": ("learn-project-tools", step_2_learn_project_tools),
    "3": ("intelligence-augmentation", step_3_intelligence_augmentation),
    "4": ("baseline-truth", step_4_baseline_truth),
    "5": ("test-driven-dominance", step_5_test_driven_dominance),
    "6": ("immutability-of-legacy", step_6_immutability_of_legacy),
    "7": ("feedback-loop", step_7_feedback_loop),
    "8": ("atomicity", step_8_atomicity),
    "9": ("proof-of-work", step_9_proof_of_work),
}


def run_step(step_num: str, root: Path) -> Tuple[bool, str, str]:
    """Run a specific proof-of-work step."""
    if step_num not in STEPS:
        return False, f"Unknown step: {step_num}", ""

    step_name, step_func = STEPS[step_num]
    success, message = step_func(root)
    return success, message, step_name


def run_all_steps(root: Path, stop_on_failure: bool = True) -> Dict[str, Dict[str, object]]:
    """Run all proof-of-work steps and return results."""
    results = {}
    for step_num, (step_name, _) in STEPS.items():
        success, message, _ = run_step(step_num, root)
        results[step_num] = {
            "name": step_name,
            "success": success,
            "message": message,
        }
        if not success and stop_on_failure:
            break
    return results


def main(argv: Optional[List[str]] = None) -> int:
    parser = argparse.ArgumentParser(
        description="Proof-of-work compliance enforcement for AI coding standards."
    )
    parser.add_argument(
        "--project-root",
        type=str,
        default=".",
        help="Path to project root (default: current directory)",
    )

    subparsers = parser.add_subparsers(dest="command", required=True)

    # detect
    subparsers.add_parser("detect", help="Detect project type and git state (JSON output)")

    # run step
    step_p = subparsers.add_parser("step", help="Run a specific proof-of-work step (1-9)")
    step_p.add_argument("step_num", type=str, choices=list(STEPS.keys()), help="Step number (1-9)")

    # run all
    all_p = subparsers.add_parser("all", help="Run all proof-of-work steps")
    all_p.add_argument(
        "--continue-on-failure",
        action="store_true",
        help="Continue running steps even if one fails",
    )

    args = parser.parse_args(argv)
    root = Path(args.project_root).resolve()

    if args.command == "detect":
        detection = detect_project(root)
        print(json.dumps(detection.to_dict(), indent=2))
        return 0

    if args.command == "step":
        success, message, step_name = run_step(args.step_num, root)
        print(f"[Step {args.step_num}: {step_name}]")
        print(message)
        return 0 if success else 1

    if args.command == "all":
        results = run_all_steps(root, stop_on_failure=not args.continue_on_failure)
        all_success = all(r["success"] for r in results.values())

        # Print summary
        print("Proof-of-Work Compliance Report")
        print("=" * 50)
        for step_num, result in results.items():
            status = "✓" if result["success"] else "✗"
            print(f"{status} Step {step_num}: {result['name']}")
            if not result["success"]:
                print(f"  {result['message']}")

        return 0 if all_success else 1

    return 1


if __name__ == "__main__":
    raise SystemExit(main())
