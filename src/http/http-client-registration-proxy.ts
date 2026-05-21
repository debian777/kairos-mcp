import type { Express, Request, Response } from 'express';
import { AUTH_CALLBACK_BASE_URL, KEYCLOAK_INTERNAL_URL, KEYCLOAK_REALM, KEYCLOAK_URL } from '../config.js';
import { structuredLogger } from '../utils/structured-logger.js';

function keycloakFetchBase(): string {
  const external = KEYCLOAK_URL ? KEYCLOAK_URL.replace(/\/$/, '') : '';
  if (KEYCLOAK_INTERNAL_URL && external) {
    return KEYCLOAK_INTERNAL_URL.replace(/\/$/, '');
  }
  return external;
}

function getPublicBaseUrl(): string | null {
  const base = AUTH_CALLBACK_BASE_URL?.trim().replace(/\/$/, '');
  return base ? base : null;
}

function setCorsHeaders(req: Request, res: Response): void {
  const origin = req.headers.origin;
  if (origin) {
    res.setHeader('Access-Control-Allow-Origin', origin);
    res.setHeader('Vary', 'Origin');
  }
}

function optionsHandler(req: Request, res: Response): void {
  setCorsHeaders(req, res);
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, DPoP, MCP-Protocol-Version');
  res.setHeader('Access-Control-Max-Age', '86400');
  res.status(204).end();
}

function rewriteRegistrationUrls(json: unknown): unknown {
  if (!json || typeof json !== 'object') return json;
  const value = json as Record<string, unknown>;
  const publicBase = getPublicBaseUrl();
  if (!publicBase) return json;

  const regClientUri = value['registration_client_uri'];
  if (typeof regClientUri === 'string') {
    try {
      const u = new URL(regClientUri);
      const parts = u.pathname.split('/').filter(Boolean);
      const clientId = parts[parts.length - 1];
      if (clientId) {
        value['registration_client_uri'] = `${publicBase}/.well-known/clients-registrations/openid-connect/${clientId}`;
      }
    } catch {
    }
  }

  return value;
}

async function proxyToKeycloak(
  req: Request,
  res: Response,
  upstreamUrl: string,
  method: string
): Promise<void> {
  setCorsHeaders(req, res);

  const headers: Record<string, string> = {
    Accept: 'application/json',
  };

  const auth = req.headers.authorization;
  if (typeof auth === 'string' && auth.trim()) {
    headers['Authorization'] = auth;
  }

  if (method !== 'GET' && method !== 'DELETE') {
    headers['Content-Type'] = 'application/json';
  }

  let body: string | undefined;
  if (method !== 'GET' && method !== 'DELETE') {
    body = JSON.stringify(req.body ?? {});
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 10_000);
  try {
    const init: RequestInit = { method, headers, signal: controller.signal };
    if (body !== undefined) {
      init.body = body;
    }
    const upstream = await fetch(upstreamUrl, init);

    const contentType = upstream.headers.get('content-type');
    if (contentType) {
      res.setHeader('Content-Type', contentType);
    }

    const location = upstream.headers.get('location');
    const publicBase = getPublicBaseUrl();
    if (location && publicBase) {
      try {
        const u = new URL(location);
        const parts = u.pathname.split('/').filter(Boolean);
        const clientId = parts[parts.length - 1];
        if (clientId) {
          res.setHeader(
            'Location',
            `${publicBase}/.well-known/clients-registrations/openid-connect/${clientId}`
          );
        }
      } catch {
      }
    }

    const raw = await upstream.text();
    if (!raw) {
      res.status(upstream.status).end();
      return;
    }

    if (contentType && contentType.includes('application/json')) {
      try {
        const parsed = JSON.parse(raw);
        const rewritten = rewriteRegistrationUrls(parsed);
        res.status(upstream.status).send(JSON.stringify(rewritten));
        return;
      } catch {
      }
    }

    res.status(upstream.status).send(raw);
  } catch (err) {
    structuredLogger.warn(
      `[client-registration-proxy] upstream request failed url=${upstreamUrl} err=${err instanceof Error ? err.message : String(err)}`
    );
    res.status(502).json({ error: 'authorization_server_unavailable' });
  } finally {
    clearTimeout(timeout);
  }
}

export function setupClientRegistrationProxy(app: Express): void {
  const realm = KEYCLOAK_REALM?.trim();
  const base = keycloakFetchBase();
  if (!realm || !base) {
    return;
  }

  const rootPath = '/.well-known/clients-registrations/openid-connect';

  app.options(rootPath, optionsHandler);
  app.options(`${rootPath}/:clientId`, optionsHandler);

  app.post(rootPath, async (req, res) => {
    const upstreamUrl = `${base}/realms/${encodeURIComponent(realm)}/clients-registrations/openid-connect`;
    await proxyToKeycloak(req, res, upstreamUrl, 'POST');
  });

  app.get(`${rootPath}/:clientId`, async (req, res) => {
    const clientId = req.params.clientId;
    const upstreamUrl = `${base}/realms/${encodeURIComponent(realm)}/clients-registrations/openid-connect/${encodeURIComponent(clientId)}`;
    await proxyToKeycloak(req, res, upstreamUrl, 'GET');
  });

  app.put(`${rootPath}/:clientId`, async (req, res) => {
    const clientId = req.params.clientId;
    const upstreamUrl = `${base}/realms/${encodeURIComponent(realm)}/clients-registrations/openid-connect/${encodeURIComponent(clientId)}`;
    await proxyToKeycloak(req, res, upstreamUrl, 'PUT');
  });

  app.delete(`${rootPath}/:clientId`, async (req, res) => {
    const clientId = req.params.clientId;
    const upstreamUrl = `${base}/realms/${encodeURIComponent(realm)}/clients-registrations/openid-connect/${encodeURIComponent(clientId)}`;
    await proxyToKeycloak(req, res, upstreamUrl, 'DELETE');
  });
}
