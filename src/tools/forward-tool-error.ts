import { KairosError } from '../types/index.js';

export function formatForwardToolError(error: KairosError): Record<string, unknown> {
  return {
    error: error.code,
    error_code: error.code,
    message: error.message,
    ...(error.details && typeof error.details === 'object' ? error.details : {})
  };
}
