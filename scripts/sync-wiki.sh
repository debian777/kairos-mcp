#!/usr/bin/env bash
# sync-wiki.sh - Sync .qoder/repowiki/en/content/ to GitHub Wiki repository
# Usage: ./scripts/sync-wiki.sh
#
# This script copies content from .qoder/repowiki/en/content/ in the main repo
# to the GitHub Wiki repository (kairos-mcp.wiki.git) and pushes it.
#
# Prerequisites:
# - GitHub CLI (gh) authenticated, or SSH key with push access
# - Wiki repository already initialized (visit /wiki tab first time)

set -euo pipefail

REPO_OWNER="debian777"
REPO_NAME="kairos-mcp"
WIKI_DIR=".qoder/repowiki/en/content"
TEMP_WIKI="/tmp/${REPO_NAME}.wiki"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

echo -e "${GREEN}GitHub Wiki Sync${NC}"
echo "=================="
echo "Source: ${WIKI_DIR}"

# Check if wiki directory exists
if [ ! -d "$WIKI_DIR" ]; then
  echo -e "${RED}Error: ${WIKI_DIR}/ directory not found${NC}"
  echo "Run Qoder Repo Wiki generation first, or check your working directory."
  exit 1
fi

# Check if wiki has content
if [ -z "$(ls -A "$WIKI_DIR")" ]; then
  echo -e "${RED}Error: ${WIKI_DIR}/ directory is empty${NC}"
  exit 1
fi

# Clone or update wiki repo
if [ -d "$TEMP_WIKI/.git" ]; then
  echo -e "${YELLOW}Updating existing wiki clone...${NC}"
  cd "$TEMP_WIKI"
  git fetch origin
  git reset --hard origin/master
else
  echo -e "${YELLOW}Cloning wiki repository...${NC}"
  rm -rf "$TEMP_WIKI"
  git clone "https://github.com/${REPO_OWNER}/${REPO_NAME}.wiki.git" "$TEMP_WIKI"
  cd "$TEMP_WIKI"
fi

echo -e "${YELLOW}Syncing to branch: master${NC}"

# One-way rsync from source to wiki (mirrors the CI workflow)
echo "Running rsync from ${OLDPWD}/${WIKI_DIR}/ ..."
rsync -a --delete --exclude ".git" "${OLDPWD}/${WIKI_DIR}/" .

# Check if there are changes
if git status --porcelain | grep -q .; then
  echo -e "${YELLOW}Changes detected. Committing...${NC}"
  git add -A
  git commit -m "docs: sync Qoder Repo Wiki content

Source commit: $(cd "$OLDPWD" && git rev-parse --short HEAD 2>/dev/null || echo 'unknown')
Date: $(date -u '+%Y-%m-%d %H:%M:%S UTC')"

  echo "Pushing to GitHub Wiki..."
  git push origin master

  echo -e "${GREEN}Wiki updated successfully!${NC}"
  echo "View at: https://github.com/${REPO_OWNER}/${REPO_NAME}/wiki"
else
  echo -e "${GREEN}Wiki is already up to date${NC}"
fi
