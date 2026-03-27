import { z } from 'zod';

/**
 * MCP SDK validates tool arguments before the handler runs. To return agent-teaching
 * bodies instead of the SDK generic message, register this union: strict branch accepts
 * valid calls; the record branch accepts any object so the handler can safeParse and reply.
 */
export function mcpLooseToolInput<T extends z.ZodTypeAny>(strict: T) {
  return z.union([strict, z.record(z.string(), z.unknown()), z.undefined(), z.null()]);
}
