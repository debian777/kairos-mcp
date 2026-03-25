import {
  KAIROS_CREATION_PROTOCOL_UUID,
  KAIROS_REFINING_PROTOCOL_UUID,
  memoryIsBuiltinSearchFooterProtocol
} from '../../src/constants/builtin-search-meta.js';
import type { Memory } from '../../src/types/memory.js';

function mem(partial: Partial<Memory> & Pick<Memory, 'memory_uuid'>): Memory {
  return {
    label: 'x',
    tags: [],
    text: '',
    llm_model_id: 'm',
    created_at: new Date().toISOString(),
    ...partial
  };
}

describe('memoryIsBuiltinSearchFooterProtocol', () => {
  it('detects refine head and chain members', () => {
    expect(
      memoryIsBuiltinSearchFooterProtocol(
        mem({ memory_uuid: KAIROS_REFINING_PROTOCOL_UUID })
      )
    ).toBe(true);
    expect(
      memoryIsBuiltinSearchFooterProtocol(
        mem({ memory_uuid: 'other-uuid', chain: { id: KAIROS_REFINING_PROTOCOL_UUID, label: 'L', step_index: 2, step_count: 3 } })
      )
    ).toBe(true);
  });

  it('detects creation head and chain members', () => {
    expect(
      memoryIsBuiltinSearchFooterProtocol(
        mem({ memory_uuid: KAIROS_CREATION_PROTOCOL_UUID })
      )
    ).toBe(true);
    expect(
      memoryIsBuiltinSearchFooterProtocol(
        mem({ memory_uuid: 'step-2', chain: { id: KAIROS_CREATION_PROTOCOL_UUID, label: 'L', step_index: 2, step_count: 5 } })
      )
    ).toBe(true);
  });

  it('returns false for ordinary memories', () => {
    expect(
      memoryIsBuiltinSearchFooterProtocol(
        mem({ memory_uuid: 'aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee' })
      )
    ).toBe(false);
    expect(
      memoryIsBuiltinSearchFooterProtocol(
        mem({
          memory_uuid: 'aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee',
          chain: { id: 'bbbbbbbb-cccc-dddd-eeee-ffffffffffff', label: 'C', step_index: 1, step_count: 1 }
        })
      )
    ).toBe(false);
  });
});
