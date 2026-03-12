# Known issues and limitations

## Known issues

None at this time.

When you fix something that was only tracked informally, add a one-line “Fixed in X.Y.Z” note when you release.

## Limitations

- **Single maintainer; no SLA.** This project is maintained by a single person. There is no formal support or uptime guarantee.
- **Embedding provider required.** You must use either OpenAI (embeddings API) or a self-hosted TEI-compatible endpoint. See [Install and environment](install/README.md) and `EMBEDDING_PROVIDER` in [config](../src/config.ts).
- **Keycloak optional but required for multi-tenant auth.** Without Keycloak (or another OIDC provider), the server runs without authentication. Multi-tenant or authenticated access requires Keycloak (or equivalent) configuration.
- **Qdrant and (for production) Redis.** Vector storage (Qdrant) is always required. Redis is required for production use (proof-of-work state); in-memory backend is for dev only.

## Upgrade and breaking changes

Release notes and version history are published on [GitHub Releases](https://github.com/debian777/kairos-mcp/releases).

We follow [semantic versioning](https://semver.org/). **Patch and minor releases are backward-compatible.** **Major releases may introduce breaking changes** to the protocol, configuration, or APIs; check the release notes before upgrading.
