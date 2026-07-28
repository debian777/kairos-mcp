Three mutually exclusive run modes selected by environment:
- `ENV=dev_stdio` + embedding config (`OPENAI_API_KEY` / `TEI_BASE_URL` / `OPENAI_API_URL+OPENAI_EMBEDDING_MODEL`) runs `stdio-simple` which spawns the Kairos bootstrap as a child process;
- `AUTH_ENABLED=true` with a running dev stack runs `http-auth`; otherwise `http-simple` is used;
- The group-scoped test additionally requires `KEYCLOAK_ADMIN_USERNAME`/`KEYCLOAK_ADMIN_PASSWORD` and skips itself when `serverRequiresAuth()` is false or no token is present.