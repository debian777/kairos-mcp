# Google sign-in (dev)

Enable Google as an Identity Provider in the **kairos-dev** realm so users can sign in with Google. The app continues to use Keycloak only; Keycloak brokers the Google OAuth flow.

## If you see "Error 401: invalid_client" or "The OAuth client was not found"

Keycloak’s Google IdP uses standard Google OAuth (accounts.google.com), which **only** accepts OAuth clients created in the Cloud Console under **APIs & Services → Credentials**. Do this:

1. Open **[Credentials](https://console.cloud.google.com/apis/credentials?project=kairos-mcp)** (project **kairos-mcp**).
2. **Create Credentials** → **OAuth client ID** (configure the OAuth consent screen if asked).
3. Application type: **Web application**. Name: e.g. `Kairos MCP dev (Keycloak)`.
4. **Authorized redirect URIs** → add: `http://localhost:8080/realms/kairos-dev/broker/google/endpoint`
5. Create → copy **Client ID** (like `xxxxx.apps.googleusercontent.com`) and **Client secret**.
6. Put them in `.env` as `GOOGLE_CLIENT_ID` and `GOOGLE_CLIENT_SECRET`, then run: `npm run dev:google-idp`

---

## Working PoC (minimal steps)

1. **GCP:** Create OAuth client in [APIs & Services → Credentials](https://console.cloud.google.com/apis/credentials?project=kairos-mcp) → Create OAuth client ID → **Web application** → redirect URI `http://localhost:8080/realms/kairos-dev/broker/google/endpoint` → copy Client ID and Client secret.

2. **.env:** Add (or uncomment in your `.env`):
   ```
   GOOGLE_CLIENT_ID=<paste Client ID>
   GOOGLE_CLIENT_SECRET=<paste Client secret>
   ```
   Ensure `KEYCLOAK_ADMIN_PASSWORD`, `AUTH_CALLBACK_BASE_URL`, and other fullstack vars are set (see [env.example.fullstack.txt](env.example.fullstack.txt)).

3. **Infra + realms + Google IdP:**
   ```bash
   npm run infra:up
   npm run dev:google-idp
   ```

4. **Start app** (if not already): `npm run dev:start` (or your usual dev command).

5. **Test:** Open the Keycloak login page (replace with your `AUTH_CALLBACK_BASE_URL` if different):
   ```
   http://localhost:8080/realms/kairos-dev/protocol/openid-connect/auth?client_id=kairos-mcp&redirect_uri=http%3A%2F%2Flocalhost%3A3300%2Fauth%2Fcallback&response_type=code&scope=openid
   ```
   Click **Google**, sign in with a Google account. You should be redirected to `http://localhost:3300/auth/success` (or your callback base + `/auth/success`).

---

## 1. Create OAuth 2.0 Client ID in Google Cloud

1. Open [Google Cloud Console](https://console.cloud.google.com/) and select (or create) project **kairos-mcp**.
2. Go to **APIs & Services** → **Credentials** → **Create Credentials** → **OAuth client ID**.
3. If prompted, configure the OAuth consent screen (e.g. Internal for org-only, or External for testing).
4. Application type: **Web application**.
5. Name: e.g. `Kairos MCP dev (Keycloak)`.
6. **Authorized redirect URIs** — add exactly:
   ```
   http://localhost:8080/realms/kairos-dev/broker/google/endpoint
   ```
   (Keycloak uses `{base}/realms/{realm}/broker/{alias}/endpoint`; alias is `google`.)
7. Create. Copy the **Client ID** and **Client secret**; add them to `.env` as `GOOGLE_CLIENT_ID` and `GOOGLE_CLIENT_SECRET`.

## 2. Configure Keycloak (kairos-dev)

1. Start Keycloak and run realm setup if needed: `npm run infra:up` then `python3 scripts/configure-keycloak-realms.py`.
2. Open Keycloak Admin: **http://localhost:8080/admin** → sign in (e.g. admin / your `KEYCLOAK_ADMIN_PASSWORD`).
3. Select realm **kairos-dev** (top-left).
4. Go to **Identity providers** → **Add provider** → **Google**.
5. **Alias:** leave as `google` (must match the path above).
6. Paste **Client ID** and **Client secret** from step 1.
7. Save. Keycloak will show the redirect URI; it must match the URI you added in GCP.

After this, the Keycloak login page for kairos-dev will show a **Google** option.

## 3. Verify

1. Open the app login flow (e.g. go to the auth URL your MCP client uses, or `http://localhost:3300` if the app redirects to Keycloak).
2. On the Keycloak login page, click **Google** and complete the flow.
3. You should be redirected back and receive a session (e.g. success page or return to the client).

## Optional: automate with a script

If you set `GOOGLE_CLIENT_ID` and `GOOGLE_CLIENT_SECRET` in `.env`, you can create or update the Google IdP in Keycloak without using the Admin UI:

```bash
python3 scripts/configure-keycloak-google-idp.py
```

See [scripts/env/.env.template](../../scripts/env/.env.template) for the optional variables. The script uses the same `.env` and `KEYCLOAK_URL` / `KEYCLOAK_ADMIN_PASSWORD` / `KEYCLOAK_REALM` pattern as `configure-keycloak-realms.py`.
