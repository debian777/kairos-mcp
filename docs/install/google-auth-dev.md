# Google sign-in (dev)

Use this only for the local `kairos-dev` Keycloak realm. KAIROS itself still
authenticates against Keycloak; Google is configured as an identity provider
inside that realm.

## Prerequisites

- fullstack env configured (see [install README](README.md))
- Keycloak running locally (`npm run infra:up`)
- admin access to the local Keycloak realm
- a Google OAuth client created in Google Cloud

## 1. Create the Google OAuth client

In Google Cloud Console, create an **OAuth client ID** of type
**Web application** and add this redirect URI exactly:

```text
http://localhost:8080/realms/kairos-dev/broker/google/endpoint
```

Copy the resulting client ID and client secret.

## 2. Put the Google credentials in `.env`

Add these values to the repo-root `.env` used for your fullstack setup:

```env
GOOGLE_CLIENT_ID=...
GOOGLE_CLIENT_SECRET=...
```

You also need the usual Keycloak-related values such as
`KEYCLOAK_ADMIN_PASSWORD`.

## 3. Start infra and configure the IdP

Start the full local auth stack and configure realms:

```bash
npm run infra:up
```

Then configure the Google identity provider in Keycloak:

```bash
npm run dev:google-idp
```

That command runs `scripts/configure-keycloak-google-idp.py`.

## 4. Verify the login flow

Start or restart the app if needed, then open a browser login flow that uses
the `kairos-mcp` client. For the default local callback base:

```text
http://localhost:8080/realms/kairos-dev/protocol/openid-connect/auth?client_id=kairos-mcp&redirect_uri=http%3A%2F%2Flocalhost%3A3300%2Fauth%2Fcallback&response_type=code&scope=openid
```

If your local setup uses a different `AUTH_CALLBACK_BASE_URL`, replace the
encoded `redirect_uri` accordingly.

Expected result:

1. Keycloak shows a **Google** login option.
2. After successful Google authentication, Keycloak redirects back to the
   KAIROS callback.
3. The server redirects to `/auth/success` and sets the session cookie.

## Troubleshooting

### `invalid_client` or `The OAuth client was not found`

This usually means the Google OAuth client was created incorrectly or the
redirect URI does not match exactly. Re-check the Google Cloud OAuth client and
make sure it includes:

```text
http://localhost:8080/realms/kairos-dev/broker/google/endpoint
```

### Keycloak does not show the Google button

Re-run:

```bash
npm run dev:google-idp
```

Also verify that:

- `GOOGLE_CLIENT_ID` is set
- `GOOGLE_CLIENT_SECRET` is set
- `KEYCLOAK_ADMIN_PASSWORD` matches the local Keycloak bootstrap admin password

### The app redirects somewhere unexpected

Check:

- `AUTH_CALLBACK_BASE_URL`
- `KEYCLOAK_URL`
- whether the app is running on the host (`http://localhost:3300`) or in
  Docker with a different externally reachable URL
