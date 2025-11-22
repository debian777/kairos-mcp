export type OperationType = 'create' | 'append' | 'replace' | 'insert-before' | 'insert-after';

export interface OperationDetectionResult {
  operation: OperationType;
  confidence: number;
  reasoning: string;
  target?: string;
  requiresExplicit?: boolean;
  candidates?: Array<{
    uri: string;
    type: string;
    confidence: number;
  }>;
}