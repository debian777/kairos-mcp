import { REALM } from './keycloak-container.js';

export async function getClientInternalId(
  baseUrl: string,
  token: string,
  clientId: string,
  realm: string = REALM
): Promise<string | null> {
  const url = `${baseUrl.replace(/\/$/, '')}/admin/realms/${realm}/clients?clientId=${encodeURIComponent(clientId)}`;
  const res = await fetch(url, { headers: { Authorization: `Bearer ${token}` } });
  if (!res.ok) throw new Error(`List clients failed: ${res.status} ${await res.text()}`);
  const clients = (await res.json()) as Array<{ id?: string }>;
  return clients[0]?.id ?? null;
}

export async function createPublicClient(
  baseUrl: string,
  token: string,
  clientId: string,
  realm: string = REALM
): Promise<void> {
  const url = `${baseUrl.replace(/\/$/, '')}/admin/realms/${realm}/clients`;
  const body = {
    clientId,
    protocol: 'openid-connect',
    publicClient: true,
    directAccessGrantsEnabled: true,
    standardFlowEnabled: false,
    redirectUris: ['http://localhost/*'],
    enabled: true
  };
  const res = await fetch(url, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(body)
  });
  if (res.status === 201 || res.status === 409) return;
  throw new Error(`Create public client ${clientId} failed: ${res.status} ${await res.text()}`);
}

export async function deleteClientByClientId(
  baseUrl: string,
  token: string,
  clientId: string,
  realm: string = REALM
): Promise<void> {
  const internalId = await getClientInternalId(baseUrl, token, clientId, realm);
  if (!internalId) return;
  const url = `${baseUrl.replace(/\/$/, '')}/admin/realms/${realm}/clients/${internalId}`;
  const res = await fetch(url, { method: 'DELETE', headers: { Authorization: `Bearer ${token}` } });
  if (!res.ok && res.status !== 404) {
    throw new Error(`Delete client ${clientId} failed: ${res.status} ${await res.text()}`);
  }
}
