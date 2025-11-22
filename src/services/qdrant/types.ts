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
  gem_metadata?: {
    step_gem_potential: number;
    step_quality: 'quality' | 'rare' | 'legendary';
    workflow_total_potential?: number;
    workflow_quality?: string;
    motivational_text?: string;
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
  gem_metadata?: {
    step_gem_potential: number;
    step_quality: 'quality' | 'rare' | 'legendary';
    workflow_total_potential?: number;
    workflow_quality?: string;
    motivational_text?: string;
    quality_score?: number;
    relevance_score?: number;
    prompt_metadata?: any;
    workflow_links?: any;
  };
}