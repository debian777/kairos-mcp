# Security policy

## Supported versions

KAIROS MCP actively supports the latest release. Security fixes are applied
to the versions listed below.


| Version | Supported |
| ------- | --------- |
| 3.x     | Yes       |


## Reporting a vulnerability

Do not open a public issue for security vulnerabilities. Report privately
by emailing the maintainer at [kuba@xpl.pl](mailto:kuba@xpl.pl).

Include:

- A description of the vulnerability
- Steps to reproduce, if applicable
- Potential impact

We aim to respond within 48 hours and coordinate disclosure before any
public announcement.

## Security best practices

When running KAIROS MCP in production:

- Store all secrets in environment variables. Never commit `.env*` files.
- Use HTTPS for all external endpoints.
- Set a strong `SESSION_SECRET` (32 characters minimum) when
`AUTH_ENABLED=true`.
- Restrict network access to Qdrant (port 6333) and Redis (port 6379) to
trusted hosts only.
- Set a Qdrant API key (`QDRANT_API_KEY`) for any Qdrant instance exposed
beyond localhost.
- Secure Redis with a password for any Redis instance exposed beyond
localhost.
- Keep dependencies up to date to receive security patches.
- Ensure the `data/` directory is not publicly accessible.

## Threat model and incident response

Security operations depend on an up-to-date threat model and repeatable
incident handling procedure.

- Review the [Threat model](docs/security/threat-model.md) before major auth,
  storage, or pipeline changes.
- Use the [Incident response runbook](docs/security/incident-runbook.md) for
  request-level triage, containment, and post-incident actions.

## Release supply-chain controls

The release workflow includes artifact provenance controls for container
deliverables.

- Generate a CycloneDX SBOM for the release container image.
- Sign published container images with Cosign keyless signing.
- Keep Renovate vulnerability alerts enabled and prioritize security updates.

