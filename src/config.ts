/**
 * Centralized configuration for environment variables.
 * This file contains all environment variable parsing logic.
 */

import os from 'os';
import path from 'path';

function getEnvString(key: string, defaultValue: string): string {
  return process.env[key] || defaultValue;
}

function getEnvInt(key: string, defaultValue: number): number {
  const val = process.env[key];
  if (val === undefined) return defaultValue;
  const parsed = parseInt(val, 10);
  return isNaN(parsed) ? defaultValue : parsed;
}

function getEnvFloat(key: string, defaultValue: number): number {
  const val = process.env[key];
  if (val === undefined) return defaultValue;
  const parsed = parseFloat(val);
  return isNaN(parsed) ? defaultValue : parsed;
}

function getEnvBoolean(key: string, defaultValue: boolean): boolean {
  const val = process.env[key];
  if (val === undefined) return defaultValue;
  return val !== 'false';
}

// String configurations
export const REDIS_URL = getEnvString('REDIS_URL', 'redis://localhost:6379');
export const KAIROS_REDIS_PREFIX = getEnvString('KAIROS_REDIS_PREFIX', 'kairos:');
export const OPENAI_EMBEDDING_MODEL = getEnvString('OPENAI_EMBEDDING_MODEL', '');
export const OPENAI_API_KEY = getEnvString('OPENAI_API_KEY', '');
export const EMBEDDING_PROVIDER = getEnvString('EMBEDDING_PROVIDER', 'auto');
export const TEI_BASE_URL = getEnvString('TEI_BASE_URL', '');
export const TEI_MODEL = getEnvString('TEI_MODEL', '');
export const TEI_API_KEY = getEnvString('TEI_API_KEY', '');
export const LOG_LEVEL = getEnvString('LOG_LEVEL', 'info');
export const LOG_FORMAT = getEnvString('LOG_FORMAT', 'text');
export const KAIROS_DOCS_PREFIX = getEnvString('KAIROS_DOCS_PREFIX', 'kairos://doc');
export const QDRANT_API_KEY = getEnvString('QDRANT_API_KEY', '');
export const QDRANT_CA_CERT_PATH = getEnvString('QDRANT_CA_CERT_PATH', '');
export const QDRANT_COLLECTION_CURRENT = getEnvString('QDRANT_COLLECTION_CURRENT', '');
export const TEI_URL = getEnvString('TEI_URL', '');
export const TEI_DIMENSION = getEnvString('TEI_DIMENSION', '');
export const KAIROS_SEARCH_OVERFETCH_FACTOR = getEnvString('KAIROS_SEARCH_OVERFETCH_FACTOR', '4');
export const KAIROS_SEARCH_MAX_FETCH = getEnvString('KAIROS_SEARCH_MAX_FETCH', '200');
export const KAIROS_ENABLE_GROUP_COLLAPSE = getEnvString('KAIROS_ENABLE_GROUP_COLLAPSE', 'true');
export const TRUSTED_PROXY_CIDRS_STRING = getEnvString('TRUSTED_PROXY_CIDRS', '');
export const NODE_ENV = getEnvString('NODE_ENV', '');
export const STRICT_COVERAGE = getEnvBoolean('STRICT_COVERAGE', false);
export const MCP_URL = getEnvString('MCP_URL', 'http://localhost:3300/mcp');
export const HEALTH_URL = getEnvString('HEALTH_URL', MCP_URL.replace('/mcp', '/health'));
export const QDRANT_RESCORE_STRING = getEnvString('QDRANT_RESCORE', 'true');
const DEFAULT_SNAPSHOT_DIR = path.resolve(process.cwd(), 'data/qdrant/snapshots');
export const QDRANT_SNAPSHOT_ON_START = getEnvBoolean('QDRANT_SNAPSHOT_ON_START', false);
const QDRANT_SNAPSHOT_DIR_RAW = getEnvString('QDRANT_SNAPSHOT_DIR', DEFAULT_SNAPSHOT_DIR);
export const QDRANT_SNAPSHOT_DIR = path.isAbsolute(QDRANT_SNAPSHOT_DIR_RAW) ? QDRANT_SNAPSHOT_DIR_RAW : path.resolve(QDRANT_SNAPSHOT_DIR_RAW);

// Int configurations
export const PORT = getEnvInt('PORT', 3000);
export const BATCH_SIZE = getEnvInt('BATCH_SIZE', 100);
export const METRICS_PORT = getEnvInt('METRICS_PORT', 9090);

// Float configurations
export const SCORE_THRESHOLD = getEnvFloat('SCORE_THRESHOLD', 0.7);

// Boolean configurations
export const HTTP_ENABLED = true;
export const QDRANT_RESCORE = getEnvBoolean('QDRANT_RESCORE', true);

// Functions for variables with varying defaults
export function getQdrantUrl(defaultValue = 'http://localhost:6333'): string {
  return getEnvString('QDRANT_URL', defaultValue);
}

export function getQdrantCollection(defaultValue = 'kb_resources'): string {
  return getEnvString('QDRANT_COLLECTION', defaultValue);
}

export function getEmbeddingDimension(defaultValue = 1024): number {
  return getEnvInt('EMBEDDING_DIMENSION', defaultValue);
}

export function getTeiDimension(defaultValue = 0): number {
  return getEnvInt('TEI_DIMENSION', defaultValue);
}

// Derived configurations
export const TRUSTED_PROXY_CIDRS = TRUSTED_PROXY_CIDRS_STRING.split(',').filter(Boolean);
export const ENABLE_GROUP_COLLAPSE = KAIROS_ENABLE_GROUP_COLLAPSE !== 'false' && KAIROS_ENABLE_GROUP_COLLAPSE !== '0';
export const INSTANCE_ID = getEnvString('INSTANCE_ID', os.hostname() || 'unknown');
export const DEFAULT_TENANT_ID = getEnvString('DEFAULT_TENANT_ID', 'default');