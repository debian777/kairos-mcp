#!/usr/bin/env bash
# kairos Environment Management Script
# USAGE: ENV=dev|qa ./scripts/run-env.sh [build|start|stop|restart|status|test|logs|health]
#
# ENVIRONMENTS:
# - dev: Direct Node.js (PORT=3300, optional deps, unit tests)
# - qa: Docker Compose (PORT=3500, required deps, integration tests)
#
# For AI agents: Use as black box. Reports MCP server URL and service status.

# Dependencies:
# - jq:           sudo apt-get install jq   # For JSON formatting in health checks
# - curl:         sudo apt-get install curl
# - docker-compose: sudo apt-get install docker-compose
# - redis-cli:    sudo apt-get install redis-tools
# - pipx (optional): sudo apt-get install pipx

# Check if this is ensure-coding-rules command (doesn't need ENV)
FIRST_ARG="${1:-}"
if [ "$FIRST_ARG" = "ensure-coding-rules" ] && [ -z "${ENV+x}" ]; then
    # Allow ensure-coding-rules to run without ENV
    ENV="${ENV:-dev}"  # Set a default for variable references, but won't be used
fi

if [ -z "${ENV+x}" ] && [ "$FIRST_ARG" != "ensure-coding-rules" ]; then
    echo "!!! Do NOT run this script directly !!!"
    echo ""
    echo "Use npm scripts instead. Common targets include:"
    echo "  - npm run dev:start    (start development environment)"
    echo "  - npm run dev:test     (run tests in development)"
    echo "  - npm run qa:start     (start QA environment)"
    echo ""
    echo "See package.json for the full list of available npm scripts."
    exit 1
fi

set -euo pipefail

set +a

# set -o xtrace

# Colors
RED='\033[0;31m'; GREEN='\033[0;32m'; YELLOW='\033[1;33m'; BLUE='\033[0;34m'; NC='\033[0m'
print_info() { echo -e "${BLUE}[INFO]${NC} $1"; }
print_success() { echo -e "${GREEN}[SUCCESS]${NC} $1"; }
print_warning() { echo -e "${YELLOW}[WARNING]${NC} $1"; }
print_error() { echo -e "${RED}[ERROR]${NC} $1"; }

# Environment setup
ENV="${ENV:-dev}"
PROJECT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
ENV_FILE="${PROJECT_DIR}/.env.${ENV}"
PID_FILE="${PROJECT_DIR}/.kairos-${ENV}.pid"
LOG_FILE="${PROJECT_DIR}/.kairos-${ENV}.log"

# Load environment (skip if ensure-coding-rules doesn't need it)
if [ "$FIRST_ARG" != "ensure-coding-rules" ]; then
    [ -f "$ENV_FILE" ] && set -a && source "$ENV_FILE" && set +a
fi

# Validate environment (skip for ensure-coding-rules)
if [ "$FIRST_ARG" != "ensure-coding-rules" ]; then
    case "$ENV" in dev|qa) ;; *) print_error "Invalid ENV: $ENV (use dev or qa)"; exit 1 ;; esac
fi

# Environment defaults
METRICS_PORT="${METRICS_PORT:-9390}"

# Health checks
check_qdrant() {
    local url="${QDRANT_URL:-http://localhost:6333}"
    url=${url%/}/healthz
    if [[ -n "${QDRANT_API_KEY:-}" ]]; then
        curl -s -H "api-key: ${QDRANT_API_KEY}" "$url" >/dev/null 2>&1 \
            && print_success "Qdrant OK (auth)" \
            || print_warning "Qdrant DOWN (auth?)"
    else
        curl -s "$url" >/dev/null 2>&1 \
            && print_success "Qdrant OK" \
            || print_warning "Qdrant DOWN (set QDRANT_API_KEY if required)"
    fi
}
check_redis() { redis-cli ping >/dev/null 2>&1 && print_success "Redis OK" || print_warning "Redis DOWN"; }
check_tei() { 
    # Skip TEI check if using OpenAI embeddings
    if [[ "${EMBEDDING_PROVIDER:-}" == "openai" ]] || [[ -n "${OPENAI_API_KEY:-}" && -z "${TEI_BASE_URL:-}" ]]; then
        return 0  # Skip check when using OpenAI
    fi
    curl -s "${TEI_BASE_URL:-http://localhost:8080}/health" >/dev/null 2>&1 && print_success "TEI OK" || print_warning "TEI DOWN"
}
check_metrics() {
    curl -s "http://localhost:${METRICS_PORT}/health" >/dev/null 2>&1 \
        && print_success "Metrics OK (port ${METRICS_PORT})" \
        || print_warning "Metrics DOWN (port ${METRICS_PORT})"
}

# URLs overview per environment
show_urls() {
    local base="http://localhost:${PORT:-0}"
    print_info "Endpoints and dependencies (ENV=$ENV):"

    # App endpoints (grouped)
    echo "- App:"
    echo "  · Root:   ${base}/"
    echo "  · Health: ${base}/health"
    echo "  · MCP:    ${base}/mcp"

    # Dependencies
    local qdrant="${QDRANT_URL:-http://localhost:6333}"
    qdrant=${qdrant%/}
    local tei="${TEI_BASE_URL:-http://localhost:8080}"
    tei=${tei%/}

    # Qdrant (nicely grouped like Redis)
    local qkey_msg="not set"
    if [[ -n "${QDRANT_API_KEY:-}" ]]; then qkey_msg="set"; fi
    echo "- Qdrant:"
    echo "  · URL:       ${qdrant}"
    echo "  · Health:    ${qdrant}/healthz"
    echo "  · Collection: ${QDRANT_COLLECTION:-kb_resources}"
    echo "  · API key:   ${qkey_msg} (env: \$QDRANT_API_KEY)"

    # TEI (only if not using OpenAI embeddings)
    if [[ "${EMBEDDING_PROVIDER:-}" != "openai" ]] && [[ -z "${OPENAI_API_KEY:-}" || -n "${TEI_BASE_URL:-}" ]]; then
        echo "- TEI:"
        echo "  · URL:    ${tei}"
        echo "  · Health: ${tei}/health"
    fi

    # Redis
    echo "- Redis:   via redis-cli (no HTTP)"
    echo "  · URL:        ${REDIS_URL:-redis://localhost:6379}"
    echo "  · Key prefix: ${KAIROS_REDIS_PREFIX:-kb:}"

    # Metrics
    echo "- Metrics:"
    echo "  · URL:    http://localhost:${METRICS_PORT}"
    echo "  · Health: http://localhost:${METRICS_PORT}/health"
    echo "  · Metrics: http://localhost:${METRICS_PORT}/metrics"
}

# Core operations
build() {
    print_info "Building project..."
    cd "$PROJECT_DIR"
    if [ "$ENV" = "qa" ]; then
        print_info "Running prebuild verification (no mocks, no console.log in src)"
        # Docker build will run npm run build which includes prebuild
        docker build -t debian777/kairos-mcp:latest . && print_success "Docker build complete"
    else
        print_info "Running prebuild (embed-docs) and verification..."
        npm run prebuild
        npx tsc && print_success "Build complete"
    fi
}

start() {
    print_info "Starting $ENV environment..."
    cd "$PROJECT_DIR"

    # Logging configuration
    LOG_TARGET="${LOG_TARGET:-file}"
    LOG_LEVEL="${LOG_LEVEL:-info}"
    LOG_FORMAT="${LOG_FORMAT:-text}"

    case "$ENV" in
        dev)
            # Validate LOG_TARGET
            case "$LOG_TARGET" in
                file|stdout|both) ;;
                *) print_error "Invalid LOG_TARGET: $LOG_TARGET (use file, stdout, or both)"; exit 1 ;;
            esac

            # Start the dev server with configured logging
            case "$LOG_TARGET" in
                file)
                    LOG_LEVEL=debug node --loader ts-node/esm src/index.ts > "$LOG_FILE" 2>&1 &
                    ;;
                stdout)
                    LOG_LEVEL=debug node --loader ts-node/esm src/index.ts &
                    ;;
                both)
                    LOG_LEVEL=debug node --loader ts-node/esm src/index.ts > >(tee "$LOG_FILE") 2>&1 &
                    ;;
            esac

            # Resolve actual dev server PID via listening port (like stop target)
            dev_port="${PORT:-3300}"
            if command -v lsof >/dev/null 2>&1; then
                # Give the server a moment to bind to the port
                sleep 1
                dev_pid="$(lsof -ti :"${dev_port}" 2>/dev/null | head -n1 || true)"
                if [ -n "${dev_pid:-}" ]; then
                    echo "$dev_pid" > "$PID_FILE"
                    print_success "Dev server listening on port ${dev_port} (PID: $dev_pid)"
                else
                    print_warning "Dev server started but not yet bound to port ${dev_port}; PID file not created (no listener on ${dev_port} yet)"
                fi
            else
                print_error "lsof not available; cannot determine dev server PID (PID file not created)"
            fi

            show_urls

            ;;
        qa)
            # Check required dependencies (TEI only if not using OpenAI embeddings)
            check_qdrant && check_redis || { print_error "QA requires Qdrant and Redis"; exit 1; }
            if [[ "${EMBEDDING_PROVIDER:-}" != "openai" ]] && [[ -z "${OPENAI_API_KEY:-}" || -n "${TEI_BASE_URL:-}" ]]; then
                check_tei || { print_error "QA requires TEI when not using OpenAI embeddings"; exit 1; }
            fi
            docker-compose -f compose.yaml --env-file ".env.qa" --profile qa up -d
            print_success "QA environment started on http://localhost:$PORT"
            show_urls

            ;;
    esac
    # Health check after server startup with retries
        ATTEMPTS=30
        print_info "Performing post-startup health check with retries..."
        attempt=1
        while [ $attempt -le $ATTEMPTS ]; do
            print_info "Health check attempt $attempt/$ATTEMPTS..."
            if curl -s "http://localhost:$PORT/health" >/dev/null 2>&1; then
                print_success "Server health check passed on attempt $attempt"
                break
            else
                if [ $attempt -eq $ATTEMPTS ]; then
                    print_error "Server health check failed after $ATTEMPTS attempts"
                    exit 1
                fi
                sleep 2
            fi
            attempt=$((attempt + 1))
        done
    
}

stop() {
    print_info "Stopping $ENV environment..."
    cd "$PROJECT_DIR"

    case "$ENV" in
        dev)
            if [ -f "$PID_FILE" ]; then
                dev_pid="$(cat "$PID_FILE")"
                if kill "$dev_pid" 2>/dev/null; then
                    rm -f "$PID_FILE"
                    print_success "Dev server stopped (PID: $dev_pid)"
                    return 0
                else
                    print_warning "PID file found but process $dev_pid is not running"
                    rm -f "$PID_FILE"
                fi
            else
                print_warning "No PID file found for dev server"
            fi

            # Fallback: try to locate and stop process by dev port using lsof
            dev_port="${PORT:-3300}"
            if command -v lsof >/dev/null 2>&1; then
                print_info "Attempting fallback stop via lsof -ni :${dev_port}"
                # Show current listeners for debugging
                lsof -ni :"${dev_port}" 2>/dev/null || true
                # Extract PIDs and terminate them
                dev_pids="$(lsof -ti :"${dev_port}" 2>/dev/null || true)"
                if [ -n "${dev_pids:-}" ]; then
                    echo "$dev_pids" | xargs -r kill 2>/dev/null || true
                    print_success "Stopped process(es) listening on port ${dev_port} via lsof"
                else
                    print_warning "No process found listening on port ${dev_port}"
                fi
            else
                print_error "lsof not available; cannot attempt port-based stop for dev server"
            fi
            ;;
        qa)
            docker-compose -f compose.yaml --env-file ".env.qa" down && print_success "QA environment stopped"
            ;;
    esac
}

restart() {
    stop
    sleep 2
    start
}

deploy() {
    case "$ENV" in
        dev)
            build
            restart
            ;;
        qa)
            build
            start
            ;;
    esac
}

status() {
    print_info "Status for $ENV environment:"
    cd "$PROJECT_DIR"

    case "$ENV" in
        dev)
            [ -f "$PID_FILE" ] && print_success "Process running (PID: $(cat "$PID_FILE"))" || print_warning "No process found"
            ;;
        qa)
            docker-compose -f compose.yaml --env-file ".env.qa" ps -q | grep -q . && print_success "Docker Compose running" || print_warning "Docker Compose not running"
            ;;
    esac

    # Check application health - THE MOST IMPORTANT STEP
    print_info "Checking application health..."
    if curl -s "http://localhost:$PORT/health" >/dev/null 2>&1; then
        print_success "App OK (port $PORT)"
    else
        print_warning "App DOWN (port $PORT)"
    fi

    # Detailed curl health output (HTTP code + body)
    {
        url="http://localhost:$PORT/health"
        tmpfile="$(mktemp 2>/dev/null || echo "/tmp/kb_health_$$")"
        http_code=$(curl -sS -o "$tmpfile" -w "%{http_code}" "$url" 2>/dev/null || true)
        print_info "App health HTTP: $http_code"
        if command -v jq >/dev/null 2>&1; then
            body=$(jq -C . "$tmpfile" 2>/dev/null || cat "$tmpfile")
        else
            body=$(cat "$tmpfile")
        fi
        echo "$body"
        rm -f "$tmpfile" >/dev/null 2>&1 || true
    }
    
    check_qdrant
    check_redis
    check_metrics
    # Only check TEI if not using OpenAI embeddings
    if [[ "${EMBEDDING_PROVIDER:-}" != "openai" ]] && [[ -z "${OPENAI_API_KEY:-}" || -n "${TEI_BASE_URL:-}" ]]; then
        check_tei
    fi

    show_urls

    [ -f "$LOG_FILE" ] && echo "Logs: $LOG_FILE" || print_warning "No log file"
}

test() {
    print_info "Running tests for $ENV..."
    cd "$PROJECT_DIR"

    # Collect extra args passed after the 'test' command (e.g. tests file paths or jest flags)
    args=("$@")
    # If user provided a leading '--', remove it (npm run: 'npm run dev:test -- --flag')
    if [[ "${args[0]:-}" == "--" ]]; then
        args=("${args[@]:1}")
    fi

    LAST_COMMIT="Last commit: $(git rev-parse HEAD)"
    # Use REPORT_LOG_FILE from environment if provided, otherwise generate timestamped filename
    REPORT_LOG_FILE="${REPORT_LOG_FILE:-reports/tests/test-$(date +%Y%m%d-%H%M%S).log}"
    mkdir -p "$(dirname "$REPORT_LOG_FILE")"
    echo "$LAST_COMMIT" > "$REPORT_LOG_FILE"
    echo "--------------------------------" >> "$REPORT_LOG_FILE"

    case "$ENV" in
        dev)
            # deploy - now need to run manually: npm run dev:deploy
            if [ ${#args[@]} -eq 0 ]; then
                MCP_URL="http://localhost:${PORT:-3300}/mcp" NODE_OPTIONS='--experimental-vm-modules' jest --runInBand --detectOpenHandles --testTimeout=30000 --testPathPattern tests/integration/ 2>&1  | tee -a "$REPORT_LOG_FILE" 
            else
                MCP_URL="http://localhost:${PORT:-3300}/mcp" NODE_OPTIONS='--experimental-vm-modules' jest --runInBand --detectOpenHandles --testTimeout=30000 "${args[@]}" 2>&1  | tee -a "$REPORT_LOG_FILE" 
            fi
            ;;
        qa)
            # deploy - now need to run manually: npm run qa:deploy
            if [ ${#args[@]} -eq 0 ]; then
                MCP_URL="http://localhost:${PORT:-3500}/mcp" NODE_OPTIONS='--experimental-vm-modules' jest --silent --runInBand --detectOpenHandles --testTimeout=30000 --testPathPattern tests/integration/ 2>&1  | tee -a "$REPORT_LOG_FILE" 
            else
                MCP_URL="http://localhost:${PORT:-3500}/mcp" NODE_OPTIONS='--experimental-vm-modules' jest --silent --runInBand --detectOpenHandles --testTimeout=30000 "${args[@]}" 2>&1  | tee -a "$REPORT_LOG_FILE" 
            fi
            ;;
    esac
}

logs() {
    case "$ENV" in
        dev)
            [ -f "$LOG_FILE" ] && cat "$LOG_FILE" || print_warning "No log file found"
            ;;
        qa)
            docker-compose -f compose.yaml --env-file ".env.qa" logs
            ;;
    esac
}

health() {
    print_info "Health check for $ENV:"
    check_qdrant
    check_redis
    # Only check TEI if not using OpenAI embeddings
    if [[ "${EMBEDDING_PROVIDER:-}" != "openai" ]] && [[ -z "${OPENAI_API_KEY:-}" || -n "${TEI_BASE_URL:-}" ]]; then
        check_tei
    fi
}

health_qdrant() {
    print_info "Checking Qdrant health..."
    url="${QDRANT_URL:-http://localhost:6333}"
    url=${url%/}/healthz
    
    if [[ -n "${QDRANT_API_KEY:-}" ]]; then
        curl -X GET "$url" --header "api-key: ${QDRANT_API_KEY}"
    else
        curl -X GET "$url"
    fi
}

health_tei() {
    print_info "Checking TEI health..."
    url="${TEI_BASE_URL:-http://localhost:8080}"
    url=${url%/}
    curl -I "$url/health"
}

ensure_coding_rules() {
    
  local branch
  
  branch="$(git rev-parse --abbrev-ref HEAD 2>/dev/null)" || {
    print_error "Not a git repository."
    exit 1
  }

  # Check: on main branch
  if [ "$branch" = "main" ]; then
    print_error "Operation not allowed on 'main' branch (AI coding rules -> CREATE ISOLATED BRANCH)."
    exit 1
  fi
  print_success "Not on 'main' branch (current: $branch)"

  # Check: unstaged changes
  if ! git diff --quiet; then
    print_error "Uncommitted changes detected (unstaged). Commit or stash changes before proceeding (AI coding rules -> CLEAN WORKING TREE REQUIRED)."
    exit 1
  fi
  print_success "No unstaged changes detected"

  # Check: staged changes
  if ! git diff --cached --quiet; then
    print_error "Uncommitted changes detected (staged). Commit or unstage changes before proceeding (AI coding rules -> CLEAN WORKING TREE REQUIRED)."
    exit 1
  fi
  print_success "No staged changes detected"
  
  print_success "Working tree is clean (AI coding rules -> CLEAN WORKING TREE REQUIRED)"

  # Check if test reports exist (simplified check - just verify reports/tests/ directory has recent files)
  latest_test_report=""
  if [ ! -d "reports/tests" ]; then
    print_warning "No reports/tests/ directory found (test reports may not have been generated)"
  else
    commit_hash=$(git rev-parse HEAD)

    mapfile -t all_log_files < <(find reports/tests -type f -name "*.log")
    if [ ${#all_log_files[@]} -eq 0 ]; then
      print_error "No test report files found in reports/tests/ (run tests to generate proof)."
      exit 1
    fi

    mapfile -t report_log_files < <(grep -Fl "$commit_hash" "${all_log_files[@]}" 2>/dev/null || true)
    if [ ${#report_log_files[@]} -eq 0 ]; then
      print_error "No proof-of-work test report references commit $commit_hash (run tests and archive logs)."
      exit 1
    fi
    latest_test_report=$(printf '%s\0' "${report_log_files[@]}" | xargs -0 stat -f "%m:%N" 2>/dev/null | sort -rn | head -n 1 | cut -d':' -f2-)
    if [ -z "$latest_test_report" ]; then
      print_error "Unable to determine latest test report for commit $commit_hash."
      exit 1
    fi
    print_success "Proof-of-work test report found for commit $commit_hash: $latest_test_report"

    # Check the newest proof-of-work report for failures
    if [ -n "$latest_test_report" ]; then
      print_success "Test reports found in reports/tests/ directory"
      # Check if latest report contains "Test Suites:" (indicates test run completed)
      if grep -q "Test Suites:" "$latest_test_report" 2>/dev/null; then
        print_success "Test report contains Test Suites information: $latest_test_report"
        
        # Check for failures in latest report file
        if grep -Eq 'FAIL|failed' "$latest_test_report" 2>/dev/null; then
          print_error "Failures found in latest report file (AI coding rules -> NO FAILURES REQUIRED)."
          exit 1
        fi
        print_success "All tests PASSED (AI coding rules -> NO FAILURES REQUIRED): $latest_test_report"
      else
        print_warning "Latest test report may not be complete: $latest_test_report"
      fi
    else
      print_warning "No test report files found in reports/tests/"
    fi
  fi

  # All good
  print_success "Coding rules enforced successfully."
}

# handoff() {
#   print_info "Running handoff workflow for $ENV environment..."
#   ensure_coding_rules
#   deploy
#   test
#   print_success "Handoff complete: deploy, test, and git safety checks passed."
# }

help() {
    echo "kairos Environment Script"
    echo "USAGE: ENV=dev|qa $0 [build|start|stop|restart|status|test|logs|health|ensure-coding-rules|handoff|redis-cli] [-- <args>]"
    echo ""
    echo "ENVIRONMENTS:"
    echo "  dev  - Direct Node.js (PORT=3300, optional deps)"
    echo "  qa   - Docker Compose (PORT=3500, required deps)"
    echo ""
    echo "ENV VARS:"
    echo "  PORT               - App port (from .env.* files)"
    echo "  QDRANT_URL         - Qdrant base URL (default http://localhost:6333)"
    echo "  \$QDRANT_API_KEY    - Qdrant API key (sent as 'api-key' header)"
    echo "  QDRANT_COLLECTION  - Qdrant collection name (default kb_resources)"
    echo "  TEI_BASE_URL       - TEI base URL (default http://localhost:8080)"
    echo "  REDIS_URL          - Redis connection URL (default redis://localhost:6379)"
    echo "  KAIROS_REDIS_PREFIX    - Redis key prefix for namespacing (default kb:)"
    echo "  LOG_TARGET         - Log output target (file|stdout|both, default: file)"
    echo "  LOG_LEVEL          - Log level filter (info|debug|warn|error, default: info)"
    echo "  LOG_FORMAT         - Log output format (text|json, default: text)"
    echo ""
    echo "COMMANDS:"
    echo "  build    - Build TypeScript"
    echo "  start    - Start services"
    echo "  stop     - Stop services"
    echo "  restart  - Restart services"
    echo "  status   - Show status"
    echo "  test     - Run tests (accepts additional args forwarded to Jest; example: npm run dev:test -- tests/integration/file.test.ts)"
    echo "  logs     - Show logs"
    echo "  health   - Check dependencies"
    echo "  health-qdrant - Check Qdrant health"
    echo "  health-tei - Check TEI health"
    echo "  ensure-coding-rules - Verify git state (not on main, clean working tree) for AI coding rules enforcement"
    # echo "  handoff - Complete workflow: ensure git safe, deploy, test, and verify git safe again"
    echo "  redis-cli [commands...] - Execute Redis CLI commands against QA Redis server"
    
}

# Main - parse command and forward remaining args as parameters to subcommands
cmd="${1:-help}"
shift || true
case "$cmd" in
    build) build ;;
    start) start ;;
    stop) stop ;;
    restart) restart ;;
    deploy) deploy ;;
    status) status ;;
    test) test "$@" ;;
    logs) logs ;;
    health) health ;;
    health-qdrant) health_qdrant ;;
    health-tei) health_tei ;;
    ensure-coding-rules) ensure_coding_rules ;;
    # handoff) handoff ;;
    
    # Context7 Integration: Redis and Qdrant CLI Targets
    redis-cli)
        # Remaining args (if any) are forwarded as Redis CLI commands
        if [[ -z "$@" ]]; then
            print_info "Example: ./scripts/run-env.sh redis-cli PING"
            print_info "Actual Command: redis-cli -u ${REDIS_URL:-redis://localhost:6379} PING"
        else
            redis-cli -u "${REDIS_URL:-redis://localhost:6379}" "$@"
        fi
        ;;
    
    qdrant-curl)
        # Remaining args: <METHOD> <ENDPOINT>
        method="${1:-GET}"
        endpoint="${2:-collections}"
        if [[ -z "${QDRANT_API_KEY:-}" || -z "${QDRANT_URL:-}" ]]; then
            print_error "Missing QDRANT_API_KEY or QDRANT_URL environment variables."
            exit 1
        fi
        curl -s -X "$method" \
            -H "api-key: $QDRANT_API_KEY" \
            "${QDRANT_URL%/}/$endpoint" | jq
        ;;
    help|--help|-h) help ;;
    *) print_error "Unknown command: $1"; help; exit 1 ;;
esac
