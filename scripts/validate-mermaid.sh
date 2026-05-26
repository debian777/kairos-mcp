#!/usr/bin/env bash
# validate-mermaid.sh - Extract and validate mermaid diagrams from markdown files
# Usage: ./scripts/validate-mermaid.sh [files...]
#
# This script:
# 1. Extracts mermaid code blocks from markdown files
# 2. Validates them using @mermaid-js/mermaid-cli (mmdc)
# 3. Reports any syntax errors

set -euo pipefail

MMDC="./node_modules/.bin/mmdc"
TEMP_DIR=$(mktemp -d)
ERRORS=0
FILES_WITH_MERMAID=0
TOTAL_DIAGRAMS=0

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

cleanup() {
  rm -rf "$TEMP_DIR"
}
trap cleanup EXIT

# Check if mmdc is available
if [ ! -f "$MMDC" ]; then
  echo -e "${RED}Error: mmdc not found. Install with: npm install @mermaid-js/mermaid-cli${NC}"
  exit 1
fi

# If files are provided as arguments, use them; otherwise find all .md files in docs/
if [ $# -gt 0 ]; then
  MD_FILES=("$@")
else
  echo -e "${YELLOW}No files specified. Scanning docs/ directory...${NC}"
  mapfile -t MD_FILES < <(find docs -name "*.md" -type f 2>/dev/null || true)
  
  if [ ${#MD_FILES[@]} -eq 0 ]; then
    echo -e "${GREEN}No markdown files found in docs/${NC}"
    exit 0
  fi
fi

echo -e "${GREEN}Mermaid Diagram Validator${NC}"
echo "========================"
echo "Checking ${#MD_FILES[@]} file(s)..."
echo ""

for md_file in "${MD_FILES[@]}"; do
  if [ ! -f "$md_file" ]; then
    continue
  fi
  
  FILE_HAS_ERRORS=0
  DIAGRAM_COUNT=0
  BASENAME=$(basename "$md_file" .md | sed 's/[^a-zA-Z0-9]/_/g')
  
  # Extract mermaid blocks using awk
  awk -v basename="$BASENAME" -v tempdir="$TEMP_DIR" '
    BEGIN { in_block=0; block_count=0 }
    /^```mermaid$/ { 
      in_block=1; 
      block_count++; 
      filename = tempdir "/" basename "_" block_count ".mmd";
      next 
    }
    /^```$/ && in_block { 
      in_block=0; 
      close(filename);
      next 
    }
    in_block { 
      print > filename 
    }
  ' "$md_file"
  
  # Check if any mermaid blocks were extracted
  MERMAID_FILES=$(find "$TEMP_DIR" -name "${BASENAME}_*.mmd" 2>/dev/null | sort || true)
  
  if [ -z "$MERMAID_FILES" ]; then
    continue
  fi
  
  FILES_WITH_MERMAID=$((FILES_WITH_MERMAID + 1))
  
  for mmd_file in $MERMAID_FILES; do
    DIAGRAM_COUNT=$((DIAGRAM_COUNT + 1))
    TOTAL_DIAGRAMS=$((TOTAL_DIAGRAMS + 1))
    
    # Validate using mmdc - try to render to check syntax
    if ! $MMDC --input "$mmd_file" --output "$TEMP_DIR/output_${DIAGRAM_COUNT}.svg" --puppeteerConfigFile .puppeteer-config.json >/dev/null 2>&1; then
      if [ $FILE_HAS_ERRORS -eq 0 ]; then
        echo -e "${RED}✗ ${md_file}${NC}"
        FILE_HAS_ERRORS=1
        ERRORS=$((ERRORS + 1))
      fi
      
      echo -e "  ${RED}Diagram #${DIAGRAM_COUNT}: Invalid mermaid syntax${NC}"
    fi
  done
  
  if [ $FILE_HAS_ERRORS -eq 0 ] && [ $DIAGRAM_COUNT -gt 0 ]; then
    echo -e "${GREEN}✓ ${md_file}${NC} (${DIAGRAM_COUNT} diagram(s))"
  fi
done

echo ""
echo "========================"
if [ $ERRORS -eq 0 ]; then
  echo -e "${GREEN}All mermaid diagrams are valid!${NC}"
  echo "Checked $TOTAL_DIAGRAMS diagram(s) in $FILES_WITH_MERMAID file(s)"
  exit 0
else
  echo -e "${RED}Found errors in $ERRORS file(s)${NC}"
  exit 1
fi
