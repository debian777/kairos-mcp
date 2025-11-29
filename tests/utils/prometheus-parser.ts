/**
 * Prometheus metrics parser utility for testing
 * Parses and validates Prometheus text format metrics
 */

/**
 * Parse Prometheus metrics text format and validate structure
 * @param metricsText Prometheus metrics in text format
 * @returns Parsed metrics data structure
 */
export function parsePrometheusMetrics(metricsText: string): {
  helpLines: Map<string, string>;
  typeLines: Map<string, string>;
  metricLines: Array<{
    name: string;
    labels: Record<string, string>;
    value: number;
    raw: string;
  }>;
  errors: string[];
} {
  const helpLines = new Map<string, string>();
  const typeLines = new Map<string, string>();
  const metricLines: Array<{
    name: string;
    labels: Record<string, string>;
    value: number;
    raw: string;
  }> = [];
  const errors: string[] = [];

  const lines = metricsText.split('\n');
  
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i]!;
    const trimmed = line.trim();
    
    // Skip empty lines
    if (!trimmed) continue;
    
    // Parse HELP lines: # HELP metric_name description
    if (trimmed.startsWith('# HELP')) {
      const match = trimmed.match(/# HELP\s+(\S+)\s+(.+)/);
      if (match) {
        helpLines.set(match[1]!, match[2]!);
      } else {
        errors.push(`Invalid HELP line at ${i + 1}: ${line}`);
      }
      continue;
    }
    
    // Parse TYPE lines: # TYPE metric_name type
    if (trimmed.startsWith('# TYPE')) {
      const match = trimmed.match(/# TYPE\s+(\S+)\s+(\w+)/);
      if (match) {
        const type = match[2]!.toLowerCase();
        if (!['counter', 'gauge', 'histogram', 'summary', 'untyped'].includes(type)) {
          errors.push(`Invalid metric type at ${i + 1}: ${type}`);
        }
        typeLines.set(match[1]!, type);
      } else {
        errors.push(`Invalid TYPE line at ${i + 1}: ${line}`);
      }
      continue;
    }
    
    // Skip comment lines
    if (trimmed.startsWith('#')) continue;
    
    // Parse metric lines: metric_name{labels} value
    // Format: name{label1="value1",label2="value2"} value
    const metricMatch = trimmed.match(/^([a-zA-Z_:][a-zA-Z0-9_:]*)(?:\{([^}]*)\})?\s+([\d.eE+-]+|NaN|Inf|\+Inf|-Inf)$/);
    if (metricMatch) {
      const name = metricMatch[1]!;
      const labelsStr = metricMatch[2] || '';
      const valueStr = metricMatch[3]!;
      
      // Parse labels
      const labels: Record<string, string> = {};
      if (labelsStr) {
        const labelPairs = labelsStr.match(/(\w+)="([^"]*)"/g);
        if (labelPairs) {
          for (const pair of labelPairs) {
            const labelMatch = pair.match(/(\w+)="([^"]*)"/);
            if (labelMatch) {
              labels[labelMatch[1]!] = labelMatch[2]!;
            }
          }
        }
      }
      
      // Parse value
      let value: number;
      if (valueStr === 'NaN') {
        value = NaN;
      } else if (valueStr === 'Inf' || valueStr === '+Inf') {
        value = Infinity;
      } else if (valueStr === '-Inf') {
        value = -Infinity;
      } else {
        value = parseFloat(valueStr);
        if (isNaN(value)) {
          errors.push(`Invalid metric value at ${i + 1}: ${valueStr}`);
          continue;
        }
      }
      
      metricLines.push({
        name,
        labels,
        value,
        raw: line
      });
    } else {
      // Not a valid metric line, but might be valid (e.g., histogram buckets)
      // Check if it's a histogram bucket line
      if (trimmed.includes('_bucket') || trimmed.includes('_sum') || trimmed.includes('_count')) {
        // Likely a histogram/summary metric, try to parse
        const histMatch = trimmed.match(/^([a-zA-Z_:][a-zA-Z0-9_:]*)(?:\{([^}]*)\})?\s+([\d.eE+-]+)$/);
        if (histMatch) {
          const name = histMatch[1]!;
          const labelsStr = histMatch[2] || '';
          const valueStr = histMatch[3]!;
          
          const labels: Record<string, string> = {};
          if (labelsStr) {
            const labelPairs = labelsStr.match(/(\w+)="([^"]*)"/g);
            if (labelPairs) {
              for (const pair of labelPairs) {
                const labelMatch = pair.match(/(\w+)="([^"]*)"/);
                if (labelMatch) {
                  labels[labelMatch[1]!] = labelMatch[2]!;
                }
              }
            }
          }
          
          const value = parseFloat(valueStr);
          if (!isNaN(value)) {
            metricLines.push({
              name,
              labels,
              value,
              raw: line
            });
          }
        }
      }
    }
  }
  
  return {
    helpLines,
    typeLines,
    metricLines,
    errors
  };
}

/**
 * Validate Prometheus metrics format
 * @param metricsText Prometheus metrics in text format
 * @returns Validation result
 */
export function validatePrometheusMetrics(metricsText: string): {
  valid: boolean;
  errors: string[];
  warnings: string[];
  metrics: {
    total: number;
    withHelp: number;
    withType: number;
    byType: Record<string, number>;
  };
} {
  const parsed = parsePrometheusMetrics(metricsText);
  const warnings: string[] = [];
  const metricNames = new Set(parsed.metricLines.map(m => m.name));
  
  // Check that metrics have HELP and TYPE
  for (const name of metricNames) {
    if (!parsed.helpLines.has(name)) {
      warnings.push(`Metric ${name} missing HELP declaration`);
    }
    if (!parsed.typeLines.has(name)) {
      warnings.push(`Metric ${name} missing TYPE declaration`);
    }
  }
  
  // Count metrics by type
  const byType: Record<string, number> = {};
  for (const [, type] of parsed.typeLines) {
    byType[type] = (byType[type] || 0) + 1;
  }
  
  return {
    valid: parsed.errors.length === 0,
    errors: parsed.errors,
    warnings,
    metrics: {
      total: parsed.metricLines.length,
      withHelp: Array.from(metricNames).filter(n => parsed.helpLines.has(n)).length,
      withType: Array.from(metricNames).filter(n => parsed.typeLines.has(n)).length,
      byType
    }
  };
}

/**
 * Get metric value by name and optional labels
 * @param metricsText Prometheus metrics in text format
 * @param metricName Metric name to find
 * @param labels Optional labels to match
 * @returns Metric value or null if not found
 */
export function getMetricValue(
  metricsText: string,
  metricName: string,
  labels?: Record<string, string>
): number | null {
  const parsed = parsePrometheusMetrics(metricsText);
  
  for (const metric of parsed.metricLines) {
    if (metric.name === metricName) {
      // If labels specified, check if they match
      if (labels) {
        let matches = true;
        for (const [key, value] of Object.entries(labels)) {
          if (metric.labels[key] !== value) {
            matches = false;
            break;
          }
        }
        if (!matches) continue;
      }
      
      return metric.value;
    }
  }
  
  return null;
}

