export interface UpsertResourceItem {
  uuid?: string | undefined;
  description_short: string;
  description_full: string;
  domain: string;
  task: string;
  type?: 'context' | 'rule' | 'snippet' | 'pattern';
  tags?: string[];
  protocol?: {
    step: number;
    total: number;
    enforcement: 'sequential' | 'flexible';
    skip_allowed: boolean;
    title?: string;
    memory_uuid?: string;
  };
  ai: {
    model_id: string;
    memory_uuid?: string;
  };
  quality_metadata?: {
    step_quality_score: number;
    step_quality: 'excellent' | 'high' | 'standard' | 'basic';
  };
}

export interface UpsertResourceResult {
  uri: string;
  uuid: string;
  status: 'created' | 'updated';
  version: number;
  protocol_id?: string | undefined;
  protocol_uuid?: string | undefined;
  memory_uuid?: string | undefined;
  quality_metadata?: {
    step_quality_score: number;
    step_quality: 'excellent' | 'high' | 'standard' | 'basic';
  };
}