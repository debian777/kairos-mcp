# Docker Compose — full stack (advanced)

The repository includes an optional `fullstack` Compose profile that adds
supporting services alongside the KAIROS application and Qdrant. Use it when
you need a broader local environment or want to model a more production-like
deployment.

This page is an advanced deployment reference, not a step-by-step
identity-provider guide. If you enable additional auth services, you are
responsible for their
configuration, secrets, networking, and lifecycle.

## 1. Scope

This page documents the advanced Compose profile at a high level:

- where `.env` lives,
- how to start the profile,
- which other pages to use for infrastructure and CLI access.

It does not prescribe Keycloak, realm, client, or TLS configuration.

## 2. When to use this profile

Choose this profile only when the default [simple stack](docker-compose-simple.md)
is no longer enough for your deployment or evaluation.

Typical reasons include:

- validating a broader service topology,
- running additional stateful services alongside the application,
- testing a self-managed authentication architecture.

## 3. Environment file

Create `.env` next to `compose.yaml`. The required variables depend on which
services you enable and how you wire authentication, storage, and networking.

At minimum, keep the embedding variables aligned with your chosen
[embedding backend](prerequisites.md#embedding-backend). For the rest of the
profile, use the repository `compose.yaml`, your secret management approach,
and your infrastructure requirements as the source of truth.

## 4. Start

Start the profile with your chosen project name, environment file, and service
configuration.

```sh
docker compose -p kairos-mcp --profile fullstack up -d
```

After the stack is running, confirm the application health endpoint on the URL
you expose.

## 5. Access

Use the [CLI](../CLI.md) as the primary interface after the application is
healthy. Add MCP only for hosts that require a streamable HTTP endpoint.

## Related

Use these resources when you operate the advanced profile.

- [Install index](README.md)
- [Docker Compose — simple stack](docker-compose-simple.md)
- [CLI](../CLI.md)
- [Infrastructure](https://github.com/debian777/kairos-mcp/blob/main/docs/architecture/infrastructure.md)
- [`compose.yaml`](https://github.com/debian777/kairos-mcp/blob/main/compose.yaml)
