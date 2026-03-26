import type { Memory } from '../../types/memory.js';
import { getActivationPatterns, getAdapterName } from './memory-accessors.js';

function compactSegments(parts: Array<string | null | undefined>): string {
  return parts
    .map((part) => (part ?? '').trim())
    .filter((part) => part.length > 0)
    .join('\n');
}

function normalizeTags(tags: string[] | undefined): string[] {
  return Array.from(
    new Set(
      (tags ?? [])
        .map((tag) => tag.trim())
        .filter((tag) => tag.length > 0)
    )
  );
}

function normalizeActivationPatterns(patterns: string[] | undefined): string[] {
  return Array.from(
    new Set(
      (patterns ?? [])
        .map((pattern) => pattern.trim())
        .filter((pattern) => pattern.length > 0)
    )
  );
}

export interface ActivationSearchFields {
  primaryDenseText: string;
  titleDenseText: string;
  activationPatternDenseText: string;
  sparseText: string;
  adapterNameText: string;
  labelText: string;
  activationPatternsText: string;
  tagsText: string;
}

export function buildActivationSearchFields(params: {
  adapterName: string;
  label: string;
  text: string;
  tags?: string[];
  activationPatterns?: string[];
}): ActivationSearchFields {
  const adapterNameText = params.adapterName.trim();
  const labelText = params.label.trim();
  const tags = normalizeTags(params.tags);
  const activationPatterns = normalizeActivationPatterns(params.activationPatterns);
  const tagsText = tags.join(' ');
  const activationPatternsText = activationPatterns.join('\n');

  const titleDenseText = compactSegments([adapterNameText, labelText]);
  const activationPatternDenseText = compactSegments([
    activationPatternsText,
    tagsText ? `Tags: ${tagsText}` : '',
    labelText
  ]);
  const primaryDenseText = compactSegments([
    titleDenseText,
    activationPatternsText,
    tagsText ? `Tags: ${tagsText}` : '',
    params.text
  ]);

  return {
    primaryDenseText,
    titleDenseText,
    activationPatternDenseText,
    sparseText: compactSegments([titleDenseText, activationPatternsText, tagsText, params.text]),
    adapterNameText,
    labelText,
    activationPatternsText,
    tagsText
  };
}

export function buildActivationSearchFieldsForMemory(memory: Pick<
  Memory,
  'label' | 'text' | 'tags' | 'adapter' | 'memory_uuid'
>): ActivationSearchFields {
  return buildActivationSearchFields({
    adapterName: getAdapterName(memory),
    label: memory.label,
    text: memory.text,
    tags: memory.tags,
    activationPatterns: getActivationPatterns(memory)
  });
}
