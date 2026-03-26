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
  it('detects refine head and adapter layers', () => {
    expect(
      memoryIsBuiltinSearchFooterProtocol(
        mem({ memory_uuid: KAIROS_REFINING_PROTOCOL_UUID })
      )
    ).toBe(true);
    expect(
      memoryIsBuiltinSearchFooterProtocol(
        mem({
          memory_uuid: 'other-uuid',
          adapter: { id: KAIROS_REFINING_PROTOCOL_UUID, name: 'L', layer_index: 2, layer_count: 3 }
        })
      )
    ).toBe(true);
  });

  it('detects creation head and adapter layers', () => {
    expect(
      memoryIsBuiltinSearchFooterProtocol(
        mem({ memory_uuid: KAIROS_CREATION_PROTOCOL_UUID })
      )
    ).toBe(true);
    expect(
      memoryIsBuiltinSearchFooterProtocol(
        mem({
          memory_uuid: 'step-2',
          adapter: { id: KAIROS_CREATION_PROTOCOL_UUID, name: 'L', layer_index: 2, layer_count: 5 }
        })
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
          adapter: { id: 'bbbbbbbb-cccc-dddd-eeee-ffffffffffff', name: 'C', layer_index: 1, layer_count: 1 }
        })
      )
    ).toBe(false);
  });
});
