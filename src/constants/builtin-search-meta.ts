import type { Memory } from '../types/memory.js';

/** Refine-help protocol; always appended as an **activate** footer choice (not a vector match). */
export const KAIROS_REFINING_PROTOCOL_UUID = '00000000-0000-0000-0000-000000002002';

/** Built-in adapter authoring flow; always appended as an **activate** footer choice (not a vector match). */
export const KAIROS_CREATION_PROTOCOL_UUID = '00000000-0000-0000-0000-000000002001';

/** True if this memory belongs to built-in footer protocols (refine / create). */
export function memoryIsBuiltinSearchFooterProtocol(m: Memory): boolean {
  return (
    m.memory_uuid === KAIROS_REFINING_PROTOCOL_UUID ||
    m.adapter?.id === KAIROS_REFINING_PROTOCOL_UUID ||
    m.memory_uuid === KAIROS_CREATION_PROTOCOL_UUID ||
    m.adapter?.id === KAIROS_CREATION_PROTOCOL_UUID
  );
}
