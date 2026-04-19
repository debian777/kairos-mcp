# Docker and npm CLI update guide

Use this reference when the user asks to update Docker, Docker Compose, Node.js,
npm, the npm-distributed KAIROS CLI, or installed skills from
`debian777/kairos-mcp`.

## Scope and approvals

Treat package-manager upgrades, Docker Desktop upgrades, daemon restarts, host
reboots, and global npm installs as material changes. Ask for explicit approval
before each one.

Resolve scope first:

1. Docker only
2. npm CLI only
3. skills refresh only
4. Docker + npm CLI + skills refresh

## Baseline checks

Capture current state before updating:

```bash
docker --version
docker compose version
npm --version
node --version
kairos --help
```

If `kairos` is not globally installed, check the one-shot path:

```bash
npx @debian777/kairos-mcp --help
```

## Update sequence

Use this order when Docker/npm updates and skill refresh are requested together.

1. Update Docker and Compose via the official Docker installation channel for
   the user's OS.
2. Re-check `docker --version` and `docker compose version`.
3. Update Node.js/npm via the official Node.js installation channel if needed.
4. Re-check `node --version` and `npm --version`.
5. Update KAIROS CLI:

```bash
npm install -g @debian777/kairos-mcp@latest
kairos --help
```

6. Validate one-shot execution as well:

```bash
npx @debian777/kairos-mcp@latest --help
```

7. Refresh installed repo skills in the same pass:

```bash
npx skills add debian777/kairos-mcp --list
npx skills add debian777/kairos-mcp
```

Use explicit targeting when needed:

```bash
npx skills add debian777/kairos-mcp --skill kairos --skill kairos-bug-report --skill kairos-install
```

For global non-interactive installs, include approved flags such as
`-y -g -a cursor` or `-y -g -a claude-code`.

## Post-update runtime validation

When the local stack is present, run a quick health check after updates:

```bash
docker compose -p kairos-mcp ps
curl -sS "http://localhost:${SERVER_PORT:-3000}/health"
```

If services fail to start after update, inspect app logs:

```bash
docker compose -p kairos-mcp logs app-prod
```

## Known constraints

- If only `docker-compose` works and `docker compose` fails, Compose v2 is not
  available yet.
- If Docker update requires a reboot, pause the workflow until the user
  confirms the host is back.
- If global npm install is disallowed, keep using
  `npx @debian777/kairos-mcp@latest <command>`.
