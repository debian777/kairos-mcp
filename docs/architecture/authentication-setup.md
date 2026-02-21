# Authentication Setup Guide

This document provides step-by-step instructions for configuring OIDC/OAuth2 bearer token authentication with Google, Apple, and Okta identity providers.

## Overview

KAIROS MCP supports bearer token authentication using JWT tokens from trusted OIDC/OAuth2 providers. The server validates tokens by:
- Verifying JWT signatures using JWKS (JSON Web Key Set)
- Validating issuer (`iss`), audience (`aud`), expiration (`exp`), and not-before (`nbf`) claims
- Enforcing scope requirements per endpoint

**Protected endpoints:**
- `POST /mcp` - MCP protocol endpoint
- All `/api/*` routes - REST API endpoints

**Public endpoints (no auth required):**
- `GET /health` - Health check
- `GET /` - Service information

## Prerequisites

- KAIROS MCP server running (Node.js >= 24)
- Access to configure environment variables
- Admin access to your chosen identity provider (Google, Apple, or Okta)

## Configuration Variables

All authentication settings are configured via environment variables:

| Variable | Description | Example |
|----------|-------------|---------|
| `AUTH_ENABLED` | Enable/disable authentication | `true` |
| `AUTH_TRUSTED_ISSUERS` | Comma-separated list of issuer URLs | `https://accounts.google.com` |
| `AUTH_ALLOWED_AUDIENCES` | Comma-separated list of allowed audience values | `your-client-id` |
| `AUTH_REQUIRED_SCOPES_MCP` | Required scopes for `/mcp` endpoint | `mcp:access` |
| `AUTH_REQUIRED_SCOPES_API` | Required scopes for `/api/*` endpoints | `api:access` |
| `AUTH_JWKS_CACHE_TTL` | JWKS cache TTL in seconds | `3600` |

---

## Google OAuth2 Setup

### Step 1: Create OAuth 2.0 Credentials

1. Go to the [Google Cloud Console](https://console.cloud.google.com/)
2. Select or create a project
3. Navigate to **APIs & Services** → **Credentials**
4. Click **Create Credentials** → **OAuth client ID**
5. If prompted, configure the OAuth consent screen:
   - Choose **External** (unless you have a Google Workspace)
   - Fill in required fields (App name, User support email, Developer contact)
   - Add scopes if needed (for server-to-server, you may not need user-facing scopes)
   - Save and continue through the steps
6. For **Application type**, select **Web application**
7. Configure:
   - **Name**: `KAIROS MCP Server` (or your preferred name)
   - **Authorized redirect URIs**: Not required for bearer token auth (leave empty or add your callback URL if using authorization code flow)
8. Click **Create**
9. **Save the Client ID** - this is your `AUTH_ALLOWED_AUDIENCES` value

### Step 2: Configure Service Account (Recommended for Server-to-Server)

For server-to-server authentication, use a Service Account:

1. In Google Cloud Console, go to **IAM & Admin** → **Service Accounts**
2. Click **Create Service Account**
3. Fill in:
   - **Service account name**: `kairos-mcp-server`
   - **Service account ID**: (auto-generated)
   - **Description**: `Service account for KAIROS MCP authentication`
4. Click **Create and Continue**
5. Grant roles if needed (for most cases, no roles needed for just authentication)
6. Click **Continue** → **Done**
7. Click on the created service account
8. Go to **Keys** tab → **Add Key** → **Create new key**
9. Choose **JSON** format and download the key file
10. **Note**: For JWT bearer tokens, you'll use the service account email as the issuer audience

### Step 3: Configure KAIROS MCP Server

Add to your `.env` file (or `.env.prod`, `.env.dev`, etc.):

```bash
# Enable authentication
AUTH_ENABLED=true

# Google OAuth2 issuer (standard Google issuer)
AUTH_TRUSTED_ISSUERS=https://accounts.google.com

# Your OAuth client ID from Step 1
AUTH_ALLOWED_AUDIENCES=your-client-id.apps.googleusercontent.com

# Required scopes (customize as needed)
AUTH_REQUIRED_SCOPES_MCP=mcp:access
AUTH_REQUIRED_SCOPES_API=api:access

# JWKS cache TTL (1 hour default)
AUTH_JWKS_CACHE_TTL=3600
```

### Step 4: Obtain Access Token (Client Side)

Clients need to obtain tokens from Google. Example using Google OAuth2:

**Using Google Auth Library (Node.js):**
```javascript
const { GoogleAuth } = require('google-auth-library');

const auth = new GoogleAuth({
  scopes: ['mcp:access', 'api:access'],
  keyFile: 'path/to/service-account-key.json', // For service accounts
  // OR
  // clientId: 'your-client-id.apps.googleusercontent.com', // For OAuth clients
});

const client = await auth.getClient();
const token = await client.getAccessToken();
// Use token in Authorization header: Bearer <token>
```

**Using gcloud CLI:**
```bash
gcloud auth print-access-token --scopes=mcp:access,api:access
```

**Using curl (with service account):**
```bash
# First, create a JWT (requires jose library or similar)
# Then exchange for access token
curl -X POST https://oauth2.googleapis.com/token \
  -H "Content-Type: application/json" \
  -d '{
    "grant_type": "urn:ietf:params:oauth:grant-type:jwt-bearer",
    "assertion": "<your-jwt-assertion>"
  }'
```

### Step 5: Test Authentication

```bash
# Test with a valid token
curl -X POST http://localhost:3000/mcp \
  -H "Authorization: Bearer YOUR_ACCESS_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"jsonrpc":"2.0","method":"tools/list","id":1}'

# Should return 200 (or MCP response), not 401
```

### Google-Specific Notes

- **Issuer URL**: `https://accounts.google.com` (standard)
- **JWKS URL**: Automatically discovered at `https://accounts.google.com/.well-known/jwks.json`
- **Token Format**: Google issues JWT access tokens with standard OIDC claims
- **Service Accounts**: Use service account email as audience when using service account authentication
- **OAuth Clients**: Use the OAuth client ID as audience

---

## Apple Sign In Setup

### Step 1: Create App ID and Service ID

1. Go to [Apple Developer Portal](https://developer.apple.com/account/)
2. Navigate to **Certificates, Identifiers & Profiles**
3. Go to **Identifiers** → Click **+** to create new identifier
4. Select **Services IDs** → **Continue**
5. Fill in:
   - **Description**: `KAIROS MCP Server`
   - **Identifier**: `com.yourcompany.kairos-mcp` (use reverse domain notation)
6. Click **Continue** → **Register**
7. Select your newly created Service ID
8. Check **Sign In with Apple** → **Configure**
9. Configure:
   - **Primary App ID**: Select your app
   - **Website URLs**:
     - **Domains and Subdomains**: `yourdomain.com`
     - **Return URLs**: `https://yourdomain.com/callback` (if using web flow)
10. Click **Save** → **Continue** → **Save**
11. **Note the Service ID** - this is your `AUTH_ALLOWED_AUDIENCES` value

### Step 2: Create Private Key

1. In Apple Developer Portal, go to **Keys**
2. Click **+** to create a new key
3. Fill in:
   - **Key Name**: `KAIROS MCP Sign In Key`
   - Check **Sign In with Apple**
4. Click **Configure** → Select your Primary App ID → **Save**
5. Click **Continue** → **Register**
6. **Download the key file** (`.p8` file) - you can only download once!
7. **Note the Key ID** (shown after creation)

### Step 3: Configure KAIROS MCP Server

Add to your `.env` file:

```bash
# Enable authentication
AUTH_ENABLED=true

# Apple Sign In issuer
AUTH_TRUSTED_ISSUERS=https://appleid.apple.com

# Your Service ID from Step 1
AUTH_ALLOWED_AUDIENCES=com.yourcompany.kairos-mcp

# Required scopes
AUTH_REQUIRED_SCOPES_MCP=mcp:access
AUTH_REQUIRED_SCOPES_API=api:access

# JWKS cache TTL
AUTH_JWKS_CACHE_TTL=3600
```

### Step 4: Obtain Access Token (Client Side)

Apple uses a different flow. Clients typically obtain tokens through:
- **Web**: Authorization code flow with redirect
- **Native apps**: ASAuthorizationController
- **Server-to-server**: Client secret JWT assertion

**Example: Generate client secret (server-side):**
```javascript
const jwt = require('jsonwebtoken');
const fs = require('fs');

const privateKey = fs.readFileSync('path/to/AuthKey_KEYID.p8');
const teamId = 'YOUR_TEAM_ID';
const clientId = 'com.yourcompany.kairos-mcp'; // Service ID
const keyId = 'YOUR_KEY_ID';

const clientSecret = jwt.sign({
  iss: teamId,
  iat: Math.floor(Date.now() / 1000),
  exp: Math.floor(Date.now() / 1000) + 3600, // 1 hour
  aud: 'https://appleid.apple.com',
  sub: clientId
}, privateKey, {
  algorithm: 'ES256',
  keyid: keyId
});
```

**Exchange for access token:**
```bash
curl -X POST https://appleid.apple.com/auth/token \
  -H "Content-Type: application/x-www-form-urlencoded" \
  -d "grant_type=client_credentials&client_id=com.yourcompany.kairos-mcp&client_secret=YOUR_CLIENT_SECRET&scope=mcp:access api:access"
```

### Step 5: Test Authentication

```bash
# Test with Apple access token
curl -X POST http://localhost:3000/mcp \
  -H "Authorization: Bearer YOUR_APPLE_ACCESS_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"jsonrpc":"2.0","method":"tools/list","id":1}'
```

### Apple-Specific Notes

- **Issuer URL**: `https://appleid.apple.com`
- **JWKS URL**: `https://appleid.apple.com/.well-known/jwks.json`
- **Algorithm**: Apple uses ES256 (ECDSA), which is fully supported by KAIROS MCP's JWT verification
- **Service ID**: Use the Service ID (not App ID) as the audience
- **Team ID**: Required for generating client secrets
- **Token Format**: Apple issues JWT access tokens with standard OIDC claims

---

## Okta Setup

### Step 1: Create Okta Application

1. Log in to your [Okta Admin Console](https://admin.okta.com/)
2. Navigate to **Applications** → **Applications**
3. Click **Create App Integration**
4. Choose **OIDC - OpenID Connect** → **Next**
5. Choose **API Services** (for server-to-server) or **Web Application** (for web clients) → **Next**
6. Configure:
   - **App integration name**: `KAIROS MCP Server`
   - **Grant type**: Select **Client Credentials** (for server-to-server) or **Authorization Code** (for web)
   - **Controlled access**: Choose who can use this app
7. Click **Save**
8. **Copy the Client ID** - this is your `AUTH_ALLOWED_AUDIENCES` value
9. If using **Client Credentials**, **copy the Client Secret** (you'll need this for token requests)

### Step 2: Configure Scopes

1. In your Okta application, go to **Assignments** tab
2. Click **Grant** → **Add Grant**
3. Select **Authorization Server** (usually `default`)
4. Go to **Security** → **API** → **Authorization Servers**
5. Select your authorization server (usually `default`)
6. Go to **Scopes** tab
7. Click **Add Scope**:
   - **Name**: `mcp:access`
   - **Description**: `Access to MCP endpoints`
8. Click **Add Scope** again:
   - **Name**: `api:access`
   - **Description**: `Access to API endpoints`
9. Save both scopes

### Step 3: Get Your Okta Domain

1. In Okta Admin Console, note your **Org URL**
   - Example: `https://dev-123456.okta.com` or `https://yourcompany.okta.com`
2. This is your issuer URL

### Step 4: Configure KAIROS MCP Server

Add to your `.env` file:

```bash
# Enable authentication
AUTH_ENABLED=true

# Your Okta issuer URL (replace with your actual domain)
AUTH_TRUSTED_ISSUERS=https://dev-123456.okta.com/oauth2/default

# Your Okta Client ID from Step 1
AUTH_ALLOWED_AUDIENCES=0oa1abc2def3ghi4jkl

# Required scopes (must match Okta scopes from Step 2)
AUTH_REQUIRED_SCOPES_MCP=mcp:access
AUTH_REQUIRED_SCOPES_API=api:access

# JWKS cache TTL
AUTH_JWKS_CACHE_TTL=3600
```

**Note**: The issuer URL format depends on your Okta setup:
- **Default authorization server**: `https://your-domain.okta.com/oauth2/default`
- **Custom authorization server**: `https://your-domain.okta.com/oauth2/custom-server-name`
- **Org-level**: `https://your-domain.okta.com` (less common)

### Step 5: Obtain Access Token (Client Side)

**Using Client Credentials (server-to-server):**
```bash
curl -X POST https://your-domain.okta.com/oauth2/default/v1/token \
  -H "Content-Type: application/x-www-form-urlencoded" \
  -d "grant_type=client_credentials&client_id=YOUR_CLIENT_ID&client_secret=YOUR_CLIENT_SECRET&scope=mcp:access api:access"
```

**Using Authorization Code (web application):**
```javascript
// Step 1: Redirect user to authorization URL
const authUrl = `https://your-domain.okta.com/oauth2/default/v1/authorize?` +
  `client_id=YOUR_CLIENT_ID&` +
  `response_type=code&` +
  `scope=openid mcp:access api:access&` +
  `redirect_uri=${encodeURIComponent('https://your-app.com/callback')}&` +
  `state=random-state-value`;

// Step 2: Exchange authorization code for token
const tokenResponse = await fetch('https://your-domain.okta.com/oauth2/default/v1/token', {
  method: 'POST',
  headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
  body: new URLSearchParams({
    grant_type: 'authorization_code',
    code: authorizationCode,
    redirect_uri: 'https://your-app.com/callback',
    client_id: 'YOUR_CLIENT_ID',
    client_secret: 'YOUR_CLIENT_SECRET'
  })
});

const { access_token } = await tokenResponse.json();
```

**Using Okta SDK (Node.js):**
```javascript
const okta = require('@okta/okta-sdk-nodejs');
const { Client } = require('@okta/okta-sdk-nodejs');

const client = new Client({
  orgUrl: 'https://your-domain.okta.com',
  token: 'YOUR_API_TOKEN' // For admin operations
});

// For client credentials flow
const tokenResponse = await fetch('https://your-domain.okta.com/oauth2/default/v1/token', {
  method: 'POST',
  headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
  body: new URLSearchParams({
    grant_type: 'client_credentials',
    client_id: 'YOUR_CLIENT_ID',
    client_secret: 'YOUR_CLIENT_SECRET',
    scope: 'mcp:access api:access'
  })
});
```

### Step 6: Test Authentication

```bash
# Test with Okta access token
curl -X POST http://localhost:3000/mcp \
  -H "Authorization: Bearer YOUR_OKTA_ACCESS_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"jsonrpc":"2.0","method":"tools/list","id":1}'
```

### Okta-Specific Notes

- **Issuer URL**: Format is `https://your-domain.okta.com/oauth2/default` (or custom server name)
- **JWKS URL**: Automatically discovered at `{issuer}/.well-known/jwks.json`
- **Authorization Servers**: You can use the default server or create custom ones
- **Scopes**: Must be created in Okta and match the `AUTH_REQUIRED_SCOPES_*` values
- **Client Credentials**: Best for server-to-server authentication
- **Authorization Code**: Use for web applications with user interaction

---

## Multi-Issuer Configuration

You can configure multiple trusted issuers to support different identity providers simultaneously:

```bash
AUTH_ENABLED=true
AUTH_TRUSTED_ISSUERS=https://accounts.google.com,https://appleid.apple.com,https://your-domain.okta.com/oauth2/default
AUTH_ALLOWED_AUDIENCES=google-client-id,apple-service-id,okta-client-id
AUTH_REQUIRED_SCOPES_MCP=mcp:access
AUTH_REQUIRED_SCOPES_API=api:access
```

**Notes:**
- Each token's `iss` claim must match one of the trusted issuers
- Each token's `aud` claim must match one of the allowed audiences
- Different clients can use different issuers
- Useful for gradual migration or supporting multiple client types

---

## Troubleshooting

### Common Issues

**401 Unauthorized - Missing or invalid token**
- Verify `AUTH_ENABLED=true`
- Check that token is in `Authorization: Bearer <token>` format
- Ensure token is not expired
- Verify issuer matches `AUTH_TRUSTED_ISSUERS`

**401 Unauthorized - Invalid signature**
- Check that JWKS endpoint is accessible: `{issuer}/.well-known/jwks.json`
- Verify token was issued by the configured issuer
- Check network connectivity to issuer JWKS endpoint

**403 Forbidden - Insufficient permissions**
- Verify token contains required scopes
- Check `AUTH_REQUIRED_SCOPES_MCP` and `AUTH_REQUIRED_SCOPES_API` values
- Ensure token's `scope` claim includes all required scopes

**Token validation fails**
- Verify audience (`aud`) matches `AUTH_ALLOWED_AUDIENCES`
- Check token expiration (`exp`) - tokens expire after their lifetime
- Verify not-before (`nbf`) if present - token may not be valid yet

### Debugging

Enable debug logging:
```bash
LOG_LEVEL=debug
```

Check server logs for authentication details:
- Successful authentication logs: `Authenticated request: ...`
- Failed authentication logs: `JWT verification failed for issuer ...`

### Testing Without Real Tokens

Use the integration test suite which includes a mock OIDC provider:
```bash
npm run dev:deploy && npm run dev:test
```

The test suite (`tests/integration/auth-integration.test.ts`) demonstrates:
- Token generation
- Token validation
- Scope enforcement
- Error handling

---

## Security Best Practices

1. **Token Lifetime**: Configure short token lifetimes at your IdP (recommended: 1 hour)
2. **Scope Granularity**: Use fine-grained scopes (e.g., `mcp:read`, `mcp:write`, `api:read`, `api:write`)
3. **Audience Validation**: Use specific audience values per client application
4. **JWKS Cache**: Balance security (shorter TTL) with performance (longer TTL)
5. **HTTPS Only**: Always use HTTPS in production
6. **Token Storage**: Never log or store raw tokens
7. **Key Rotation**: Coordinate with IdP administrators for regular key rotation

See [SECURITY.md](../../SECURITY.md) for detailed threat mitigations.

---

## Next Steps

- Review [SECURITY.md](../../SECURITY.md) for security considerations
- Check [infrastructure.md](infrastructure.md) for deployment architecture
- See [CONTRIBUTING.md](../../CONTRIBUTING.md) for development guidelines
