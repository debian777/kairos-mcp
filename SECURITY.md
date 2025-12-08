# Security Policy

## Supported Versions

We actively support the latest version of KAIROS MCP. Security updates will be provided for:

| Version | Supported          |
| ------- | ------------------ |
| 1.0.x   | :white_check_mark: |

## Reporting a Vulnerability

If you discover a security vulnerability, please **do not** open a public issue. Instead, please report it privately:

1. Email the maintainer: kuba@xpl.pl
2. Include a detailed description of the vulnerability
3. Include steps to reproduce (if applicable)
4. Include potential impact assessment

We will respond within 48 hours and work with you to address the issue before making it public.

## Security Best Practices

When using KAIROS MCP:

- **Never commit secrets**: Ensure `.env*` files are in `.gitignore` and never committed
- **Use environment variables**: Store API keys, tokens, and credentials in environment variables, not in code
- **Keep dependencies updated**: Regularly update dependencies to receive security patches
- **Use HTTPS**: Always use HTTPS in production environments
- **Restrict network access**: Limit network access to Qdrant and Redis to trusted sources only
- **Review permissions**: Ensure proper file system permissions for data directories

## Known Security Considerations

- Qdrant API keys are optional but recommended for production
- Redis should be secured with authentication in production
- Environment variables containing secrets should be kept secure
- The `data/` directory contains runtime data and should not be publicly accessible

