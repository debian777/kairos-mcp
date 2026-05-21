#!/usr/bin/env bash
# sync-wiki.sh - Sync wiki/ directory to GitHub Wiki repository
# Usage: ./scripts/sync-wiki.sh
#
# This script copies content from wiki/ in the main repo to the GitHub Wiki
# repository (kairos-mcp.wiki.git) and pushes it.
#
# Prerequisites:
# - GitHub CLI (gh) authenticated
# - Wiki repository already initialized (visit /wiki tab first time)

set -euo pipefail

REPO_OWNER="debian777"
REPO_NAME="kairos-mcp"
WIKI_DIR="wiki"
TEMP_WIKI="/tmp/${REPO_NAME}.wiki"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

echo -e "${GREEN}GitHub Wiki Sync${NC}"
echo "=================="

# Check if wiki directory exists
if [ ! -d "$WIKI_DIR" ]; then
  echo -e "${RED}Error: ${WIKI_DIR}/ directory not found${NC}"
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
  
  # GitHub Wiki uses 'master' branch by default
  if git rev-parse --verify origin/master >/dev/null 2>&1; then
    git reset --hard origin/master
  else
    git reset --hard origin/main
  fi
else
  echo -e "${YELLOW}Cloning wiki repository...${NC}"
  rm -rf "$TEMP_WIKI"
  git clone "https://github.com/${REPO_OWNER}/${REPO_NAME}.wiki.git" "$TEMP_WIKI"
  cd "$TEMP_WIKI"
fi

# Determine the branch name (GitHub Wiki uses 'master' by default)
WIKI_BRANCH=$(git branch --show-current)
echo -e "${YELLOW}Syncing to branch: ${WIKI_BRANCH}${NC}"

# Clear old content (except .git)
find . -maxdepth 1 -not -name '.git' -not -name '.' -exec rm -rf {} +

# Copy new wiki content
echo "Copying wiki content..."
cp -r "../../${WIKI_DIR}/." .

# Check if there are changes
if git status --porcelain | grep -q .; then
  echo -e "${YELLOW}Changes detected. Committing...${NC}"
  git add -A
  git commit -m "Update wiki from main repository

Auto-synced from ${REPO_NAME} main repository.
Commit: $(cd ../.. && git rev-parse --short HEAD 2>/dev/null || echo 'unknown')
Date: $(date -u '+%Y-%m-%d %H:%M:%S UTC')"
  
  echo "Pushing to GitHub Wiki..."
  git push origin "${WIKI_BRANCH}"
  
  echo -e "${GREEN}✓ Wiki updated successfully!${NC}"
  echo "View at: https://github.com/${REPO_OWNER}/${REPO_NAME}/wiki"
else
  echo -e "${GREEN}✓ Wiki is already up to date${NC}"
fi
