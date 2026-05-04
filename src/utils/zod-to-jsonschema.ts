import { normalizeObjectSchema } from '@modelcontextprotocol/sdk/server/zod-compat.js';
import { toJsonSchemaCompat } from '@modelcontextprotocol/sdk/server/zod-json-schema-compat.js';
import type { z } from 'zod';

const EMPTY_OBJECT_JSON_SCHEMA: Record<string, unknown> = {
  type: 'object',
  properties: {}
};

export function zodToInputJsonSchema(schema: z.ZodTypeAny): Record<string, unknown> {
  const obj = normalizeObjectSchema(schema);
  if (!obj) return EMPTY_OBJECT_JSON_SCHEMA;
  return toJsonSchemaCompat(obj, {
    strictUnions: true,
    pipeStrategy: 'input'
  }) as Record<string, unknown>;
}

export function zodToOutputJsonSchema(schema: z.ZodTypeAny): Record<string, unknown> {
  const obj = normalizeObjectSchema(schema);
  if (!obj) return EMPTY_OBJECT_JSON_SCHEMA;
  return toJsonSchemaCompat(obj, {
    strictUnions: true,
    pipeStrategy: 'output'
  }) as Record<string, unknown>;
}
