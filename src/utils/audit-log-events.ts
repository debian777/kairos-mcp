export interface SafeAuditBindings {
  [key: string]: string | number | boolean | null | SafeAuditBindings;
}

type AuditCategory = 'audit.embedding' | 'audit.anomaly';
type AuditEventName =
  | 'embedding_success'
  | 'embedding_error'
  | 'embedding_provider_success'
  | 'embedding_provider_error'
  | 'embedding_high_latency'
  | 'embedding_unusual_norm'
  | 'embedding_dimension_mismatch'
  | 'search_zero_results'
  | 'search_low_score'
  | 'embedding_other_anomaly';

interface AuditFileRecord {
  time: string;
  level: 'info' | 'warn' | 'error';
  category: AuditCategory;
  event: AuditEventName;
}

function toAuditCategory(value: unknown): AuditCategory | null {
  if (value === 'audit.embedding' || value === 'audit.anomaly') return value;
  return null;
}

function toAuditEvent(category: AuditCategory, bindings: SafeAuditBindings): AuditEventName {
  if (category === 'audit.embedding') {
    const stage = bindings['stage'] === 'provider' ? 'provider' : 'request';
    const status = bindings['status'] === 'error' ? 'error' : 'success';
    if (stage === 'provider') {
      return status === 'error' ? 'embedding_provider_error' : 'embedding_provider_success';
    }
    return status === 'error' ? 'embedding_error' : 'embedding_success';
  }

  switch (bindings['anomaly_type']) {
    case 'embedding_high_latency':
      return 'embedding_high_latency';
    case 'embedding_unusual_norm':
      return 'embedding_unusual_norm';
    case 'embedding_dimension_mismatch':
      return 'embedding_dimension_mismatch';
    case 'search_zero_results':
      return 'search_zero_results';
    case 'search_low_score':
      return 'search_low_score';
    default:
      return 'embedding_other_anomaly';
  }
}

/** Build an audit side-stream line from a coarse allowlisted event only. */
export function buildAuditLine(
  level: 'info' | 'warn' | 'error',
  safeBindings: SafeAuditBindings
): string | null {
  const category = toAuditCategory(safeBindings['category']);
  if (!category) return null;
  const record: AuditFileRecord = {
    time: new Date().toISOString(),
    level,
    category,
    event: toAuditEvent(category, safeBindings)
  };
  return `${JSON.stringify(record)}\n`;
}
