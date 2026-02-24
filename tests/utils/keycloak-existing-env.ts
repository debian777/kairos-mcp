/**
 * Use existing Keycloak from .env (KEYCLOAK_URL, KEYCLOAK_REALM, KEYCLOAK_CLIENT_ID) for auth tests.
 * Provisions hardcoded test user kairos-tester via Admin API; no container.
 */

import type { KeycloakTestEnv } from './keycloak-container';
import {
  REALM,
  CLIENT_ID,
  TEST_USERNAME,
  TEST_PASSWORD,
  getAdminToken,
  createRealm,
  disableRealmDefaultRequiredActions,
  createClient,
  createUser,
  getUserIdByUsername,
  setUserPassword,
  clearUserRequiredActions,
  getTestUserTokenFromKeycloak
} from './keycloak-container';

async function provisionTestUserOnExistingKeycloak(
  baseUrl: string,
  realm: string = REALM,
  adminUsername: string = process.env.KEYCLOAK_ADMIN_USERNAME ?? 'admin',
  adminPassword: string = process.env.KEYCLOAK_ADMIN_PASSWORD ?? 'admin'
): Promise<void> {
  let token: string;
  try {
    token = await getAdminToken(baseUrl, adminUsername, adminPassword);
  } catch {
    return;
  }
  await createRealm(baseUrl, token, realm);
  await disableRealmDefaultRequiredActions(baseUrl, token, realm);
  await createClient(baseUrl, token, realm);
  let userId = await createUser(baseUrl, token, realm);
  if (!userId) userId = (await getUserIdByUsername(baseUrl, token, realm)) ?? '';
  if (userId) {
    await setUserPassword(baseUrl, token, userId, realm);
    await clearUserRequiredActions(baseUrl, token, userId, realm);
  }
}

/**
 * Use existing Keycloak from .env.dev. Provisions test user (kairos-tester / kairos-tester-secret).
 */
export async function useExistingKeycloakFromEnv(): Promise<KeycloakTestEnv> {
  const keycloakUrl = process.env.KEYCLOAK_URL?.replace(/\/$/, '') ?? '';
  const realm = process.env.KEYCLOAK_REALM ?? REALM;
  const clientId = process.env.KEYCLOAK_CLIENT_ID ?? CLIENT_ID;
  if (!keycloakUrl) {
    throw new Error(
      'useExistingKeycloakFromEnv requires KEYCLOAK_URL in .env.dev (e.g. http://localhost:8080)'
    );
  }
  await provisionTestUserOnExistingKeycloak(keycloakUrl, realm);
  const getTestUserToken = () =>
    getTestUserTokenFromKeycloak(keycloakUrl, realm, clientId, TEST_USERNAME, TEST_PASSWORD);
  return {
    keycloakUrl,
    realm,
    clientId,
    testUsername: TEST_USERNAME,
    testPassword: TEST_PASSWORD,
    getTestUserToken
  };
}

const QA_REALM = 'kairos-qa';

/**
 * Use existing QA Keycloak from .env.qa (KEYCLOAK_URL). Provisions test user on QA realm.
 * No container; no server spawn — tests hit existing QA app on port 3500.
 */
export async function useExistingKeycloakForQa(): Promise<KeycloakTestEnv> {
  const keycloakUrl = process.env.KEYCLOAK_URL?.replace(/\/$/, '') ?? '';
  const realm = process.env.KEYCLOAK_REALM ?? QA_REALM;
  const clientId = process.env.KEYCLOAK_CLIENT_ID ?? CLIENT_ID;
  if (!keycloakUrl) {
    throw new Error(
      'useExistingKeycloakForQa requires KEYCLOAK_URL in .env.qa (e.g. http://localhost:8080)'
    );
  }
  await provisionTestUserOnExistingKeycloak(keycloakUrl, realm);
  const getTestUserToken = () =>
    getTestUserTokenFromKeycloak(keycloakUrl, realm, clientId, TEST_USERNAME, TEST_PASSWORD);
  return {
    keycloakUrl,
    realm,
    clientId,
    testUsername: TEST_USERNAME,
    testPassword: TEST_PASSWORD,
    getTestUserToken
  };
}
