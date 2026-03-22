---
name: git-terminal-no-gui
description: "Avoid opening Cursor/VS Code when this agent runs Git in the terminal (maintainer may use core.editor = code --wait). Use for git rebase, merge --continue, rebase --continue, interactive rebase todo, or any Git subprocess that would invoke $GIT_EDITOR; also when advising git commit without an editor. Prefix with GIT_EDITOR=true and GIT_SEQUENCE_EDITOR=true as needed."
---

# Git: no GUI editor from agent terminal

The maintainer may use `core.editor = code --wait` globally. **When this agent runs Git in the terminal**, prefix commands that may invoke an editor so Git does not open the IDE:

- **Rebase / merge / anything that might open an editor:**  
  `GIT_EDITOR=true GIT_SEQUENCE_EDITOR=true <git ...>`

Examples:

- `GIT_EDITOR=true GIT_SEQUENCE_EDITOR=true git rebase origin/main`
- `GIT_EDITOR=true git merge --continue`
- `GIT_EDITOR=true git rebase --continue`

Use real messages with `git commit -m '...'` so `core.editor` is not needed for commits.

**Note:** If the host still opens a rebase/merge **UI**, that is Cursor’s Git integration reacting to repo state; the shell cannot disable it. Repo-local `sequence.editor` (below) only affects Git’s subprocess editor.

## Repo-local optional setting (this clone only)

To skip the interactive rebase todo editor without changing global `core.editor`:

`git config sequence.editor true`

(Re-run after a fresh clone if desired; it lives in `.git/config`, not in the remote.)
