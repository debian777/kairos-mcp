#!/bin/sh
# Used as GIT_EDITOR during "git rebase -i" reword to fix commit messages to conventional form.
path="$1"
if grep -q "Incite AI" "$path" 2>/dev/null; then
  echo "docs(kairos): incite AI to add challenges when creating workflow docs" > "$path"
elif grep -q "elite:" "$path" 2>/dev/null; then
  echo "chore(kairos): kairos_begin schema, proof chain, no-results fix, CLI chmod, step5 test, docs" > "$path"
fi
