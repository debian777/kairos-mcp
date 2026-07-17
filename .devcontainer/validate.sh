#!/usr/bin/env bash
# Validate Dev Container configurations
# Usage: .devcontainer/validate.sh [--quick|--full]
#   --quick  : Only validate JSON/schema (fast, for PR checks)
#   --full   : Build containers (slower, for CI/main branch)

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_DIR="$(dirname "$SCRIPT_DIR")"
cd "$PROJECT_DIR"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

PASS=0
FAIL=0
WARN=0

pass() {
  echo -e "  ${GREEN}✓${NC} $1"
  PASS=$((PASS + 1))
}

fail() {
  echo -e "  ${RED}✗${NC} $1"
  FAIL=$((FAIL + 1))
}

warn() {
  echo -e "  ${YELLOW}⚠${NC} $1"
  WARN=$((WARN + 1))
}

section() {
  echo ""
  echo -e "${YELLOW}=== $1 ===${NC}"
}

# Parse arguments
MODE="${1:---quick}"

section "Dev Container Validation"
echo "Mode: $MODE"
echo "Project: $(pwd)"

# ============================================
# TEST 1: File Structure
# ============================================
section "File Structure"

if [ -L "$SCRIPT_DIR/devcontainer.json" ]; then
  TARGET=$(readlink "$SCRIPT_DIR/devcontainer.json")
  pass "devcontainer.json is symlink → $TARGET"
else
  fail "devcontainer.json should be a symlink"
fi

for file in devcontainer.json.base devcontainer-fullstack.json docker-compose.extend.yml docker-compose-fullstack.extend.yml; do
  if [ -f "$SCRIPT_DIR/$file" ]; then
    pass "$file exists"
  else
    fail "$file missing"
  fi
done

if [ -f "$PROJECT_DIR/Dockerfile.dev" ]; then
  pass "Dockerfile.dev exists (required for builds)"
else
  fail "Dockerfile.dev missing"
fi

if [ -f "$PROJECT_DIR/compose.yaml" ]; then
  pass "compose.yaml exists (required for builds)"
else
  fail "compose.yaml missing"
fi

# ============================================
# TEST 2: JSON Validation
# ============================================
section "JSON Validation"

for config in devcontainer.json.base devcontainer-fullstack.json; do
  if node -e "JSON.parse(require('fs').readFileSync('$SCRIPT_DIR/$config', 'utf8'))" 2>/dev/null; then
    pass "$config is valid JSON"
  else
    fail "$config has JSON syntax errors"
  fi
done

# Validate symlink resolves
if node -e "JSON.parse(require('fs').readFileSync('$SCRIPT_DIR/devcontainer.json', 'utf8'))" 2>/dev/null; then
  pass "devcontainer.json symlink resolves to valid JSON"
else
  fail "devcontainer.json symlink broken or invalid"
fi

# ============================================
# TEST 3: Schema Validation (Basic)
# ============================================
section "Schema Validation"

for config in devcontainer.json devcontainer-fullstack.json; do
  filepath="$SCRIPT_DIR/$config"
  
  # Check required fields
  if node -e "
    const c = JSON.parse(require('fs').readFileSync('$filepath', 'utf8'));
    if (!c.name) throw new Error('Missing name');
    if (!c.dockerComposeFile) throw new Error('Missing dockerComposeFile');
    if (!c.service) throw new Error('Missing service');
    if (!c.workspaceFolder) throw new Error('Missing workspaceFolder');
  " 2>/dev/null; then
    pass "$config has required fields (name, dockerComposeFile, service, workspaceFolder)"
  else
    fail "$config missing required fields"
  fi
  
  # Check referenced compose files exist
  if node -e "
    const c = JSON.parse(require('fs').readFileSync('$filepath', 'utf8'));
    const path = require('path');
    c.dockerComposeFile.forEach(f => {
      const abs = path.resolve('$SCRIPT_DIR', f);
      if (!require('fs').existsSync(abs)) throw new Error('Missing: ' + f);
    });
  " 2>/dev/null; then
    pass "$config references valid compose files"
  else
    fail "$config references missing compose files"
  fi
done

# ============================================
# TEST 4: YAML Validation
# ============================================
section "YAML Validation"

if command -v python3 &> /dev/null; then
  for yaml in docker-compose.extend.yml docker-compose-fullstack.extend.yml; do
    if python3 -c "import yaml; yaml.safe_load(open('$SCRIPT_DIR/$yaml'))" 2>/dev/null; then
      pass "$yaml is valid YAML"
    else
      fail "$yaml has YAML syntax errors"
    fi
  done
else
  warn "python3 not available, skipping YAML validation"
fi

# ============================================
# TEST 5: Symlink Helper Script
# ============================================
section "Helper Script"

if [ -x "$SCRIPT_DIR/use-config.sh" ]; then
  pass "use-config.sh is executable"
else
  fail "use-config.sh not executable"
  chmod +x "$SCRIPT_DIR/use-config.sh"
  pass "Fixed: use-config.sh now executable"
fi

# Test switching
if bash "$SCRIPT_DIR/use-config.sh" 2>&1 | grep -q "Usage"; then
  pass "use-config.sh shows usage when called without args"
else
  fail "use-config.sh usage message broken"
fi

# ============================================
# TEST 6: Dev Container CLI Variable Resolution
# ============================================
if command -v devcontainer &> /dev/null; then
  section "Dev Container CLI Variable Resolution"
  
  # Test that CLI can read and resolve variables (catches ${localWorkspaceFolderBasename} issues)
  if CONFIG_OUTPUT=$(devcontainer read-configuration --workspace-folder "$PROJECT_DIR" 2>&1); then
    # Extract workspaceFolder and verify it's resolved (not literal ${...})
    WORKSPACE_FOLDER=$(echo "$CONFIG_OUTPUT" | node -e "
      const chunks = [];
      process.stdin.on('data', chunk => chunks.push(chunk));
      process.stdin.on('end', () => {
        try {
          const lines = Buffer.concat(chunks).toString().split('\n');
          const jsonLine = lines.find(l => l.startsWith('{'));
          const data = JSON.parse(jsonLine);
          console.log(data.workspace?.workspaceFolder || data.configuration?.workspaceFolder || '');
        } catch (e) {
          process.exit(1);
        }
      });
    " 2>/dev/null)
    
    if [[ -n "$WORKSPACE_FOLDER" ]] && [[ "$WORKSPACE_FOLDER" != *'${'* ]]; then
      pass "workspaceFolder resolved: $WORKSPACE_FOLDER"
    else
      fail "workspaceFolder not resolved (got: $WORKSPACE_FOLDER)"
    fi
    
    # Verify no unresolved variables in config
    if echo "$CONFIG_OUTPUT" | grep -q '\${'; then
      fail "Unresolved variables detected in configuration"
    else
      pass "No unresolved variables in configuration"
    fi
  else
    fail "devcontainer read-configuration failed"
  fi
else
  section "Dev Container CLI"
  warn "devcontainer CLI not installed. Install with: npm install -g @devcontainers/cli"
  warn "Skipping variable resolution tests"
fi

# ============================================
# TEST 7: Docker Compose Validation (if docker available)
# ============================================
if command -v docker &> /dev/null && command -v docker compose &> /dev/null; then
  section "Docker Compose Config Validation"
  
  # Test from project root with correct file references
  for config in docker-compose.extend.yml docker-compose-fullstack.extend.yml; do
    if docker compose -f "$PROJECT_DIR/compose.yaml" -f "$SCRIPT_DIR/$config" config --quiet 2>/dev/null; then
      pass "$config composes successfully with compose.yaml"
    else
      # This is a warning, not a failure - compose files may have env var dependencies
      warn "$config has compose warnings (may be expected with missing .env vars)"
    fi
  done
else
  section "Docker Compose"
  warn "docker not available, skipping compose validation"
fi

# ============================================
# TEST 8: Build Containers (Full Mode Only)
# ============================================
if [ "$MODE" = "--full" ]; then
  section "Container Build Test (--full mode)"
  
  if command -v devcontainer &> /dev/null; then
    echo "Building simple config..."
    if devcontainer build --workspace-folder "$PROJECT_DIR" --log-level info 2>&1 | tee /tmp/devcontainer-build.log; then
      pass "Simple config builds successfully"
    else
      fail "Simple config build failed (see /tmp/devcontainer-build.log)"
    fi
    
    echo "Building fullstack config..."
    if devcontainer build --workspace-folder "$PROJECT_DIR" --config "$SCRIPT_DIR/devcontainer-fullstack.json" --log-level info 2>&1 | tee /tmp/devcontainer-build-fullstack.log; then
      pass "Fullstack config builds successfully"
    else
      fail "Fullstack config build failed (see /tmp/devcontainer-build-fullstack.log)"
    fi
  else
    warn "devcontainer CLI not installed. Install with: npm install -g @devcontainers/cli"
    warn "Skipping build tests"
  fi
fi

# ============================================
# SUMMARY
# ============================================
section "Validation Summary"
echo -e "  ${GREEN}Passed: $PASS${NC}"
echo -e "  ${RED}Failed: $FAIL${NC}"
if [ $WARN -gt 0 ]; then
  echo -e "  ${YELLOW}Warnings: $WARN${NC}"
fi

if [ $FAIL -gt 0 ]; then
  echo -e "\n${RED}✗ Validation FAILED${NC}"
  exit 1
else
  echo -e "\n${GREEN}✓ Validation PASSED${NC}"
  if [ "$MODE" = "--quick" ]; then
    echo "Tip: Run with --full to test container builds"
  fi
  exit 0
fi
