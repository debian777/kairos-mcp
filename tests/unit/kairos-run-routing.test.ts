/**
 * Unit tests for kairos_run routing: one strong match (score >= 0.5) -> direct_match; else refine.
 * Tests the decision table in isolation (same logic as selectRunTarget in kairos-orchestration).
 */
const REFINING_PROTOCOL_URI = 'kairos://mem/00000000-0000-0000-0000-000000002002';
const RELEVANT_SCORE = 0.5;

type Role = 'match' | 'refine' | 'create';
type RoutingDecision = 'direct_match' | 'refine_ambiguous' | 'refine_no_match' | 'refine_weak_match';

interface UnifiedChoice {
  uri: string;
  label: string;
  chain_label: string | null;
  score: number | null;
  role: Role;
  tags: string[];
  next_action: string;
  protocol_version: string | null;
}

function selectRunTarget(choices: UnifiedChoice[]): { uri: string; choice: UnifiedChoice; decision: RoutingDecision } {
  const matches = choices.filter(c => c.role === 'match');
  const fallbackRefine = choices.find(c => c.role === 'refine') ?? {
    uri: REFINING_PROTOCOL_URI,
    label: 'Get help refining your search',
    chain_label: null,
    score: null,
    role: 'refine' as const,
    tags: [] as string[],
    next_action: '',
    protocol_version: null
  };
  if (matches.length === 0) {
    return { uri: fallbackRefine.uri, choice: fallbackRefine, decision: 'refine_no_match' };
  }
  if (matches.length === 1) {
    const score = matches[0]!.score ?? 0;
    if (score >= RELEVANT_SCORE) {
      return { uri: matches[0]!.uri, choice: matches[0]!, decision: 'direct_match' };
    }
    return { uri: fallbackRefine.uri, choice: fallbackRefine, decision: 'refine_weak_match' };
  }
  return { uri: fallbackRefine.uri, choice: fallbackRefine, decision: 'refine_ambiguous' };
}

describe('selectRunTarget (kairos_run routing)', () => {
  const refineChoice: UnifiedChoice = {
    uri: REFINING_PROTOCOL_URI,
    label: 'Get help refining your search',
    chain_label: null,
    score: null,
    role: 'refine',
    tags: ['meta', 'refine'],
    next_action: 'call kairos_begin with ' + REFINING_PROTOCOL_URI,
    protocol_version: null
  };

  test('no matches: returns refine, decision refine_no_match', () => {
    const choices = [refineChoice, { ...refineChoice, role: 'create' as const, uri: 'kairos://mem/00000000-0000-0000-0000-000000002001', label: 'Create' }];
    const { uri, choice, decision } = selectRunTarget(choices);
    expect(decision).toBe('refine_no_match');
    expect(uri).toBe(REFINING_PROTOCOL_URI);
    expect(choice.role).toBe('refine');
  });

  test('one strong match (score >= 0.5): returns that URI, decision direct_match', () => {
    const matchUri = 'kairos://mem/11111111-2222-3333-4444-555555555555';
    const matchChoice: UnifiedChoice = {
      uri: matchUri,
      label: 'Test Protocol',
      chain_label: 'Test',
      score: 0.78,
      role: 'match',
      tags: [],
      next_action: 'call kairos_begin with ' + matchUri,
      protocol_version: '1.0.0'
    };
    const choices = [matchChoice, refineChoice];
    const { uri, choice, decision } = selectRunTarget(choices);
    expect(decision).toBe('direct_match');
    expect(uri).toBe(matchUri);
    expect(choice.role).toBe('match');
    expect(choice.score).toBe(0.78);
  });

  test('one weak match (score < 0.5): returns refine, decision refine_weak_match', () => {
    const matchUri = 'kairos://mem/11111111-2222-3333-4444-555555555555';
    const matchChoice: UnifiedChoice = {
      uri: matchUri,
      label: 'Weak',
      chain_label: null,
      score: 0.35,
      role: 'match',
      tags: [],
      next_action: 'call kairos_begin with ' + matchUri,
      protocol_version: null
    };
    const choices = [matchChoice, refineChoice];
    const { uri, decision } = selectRunTarget(choices);
    expect(decision).toBe('refine_weak_match');
    expect(uri).toBe(REFINING_PROTOCOL_URI);
  });

  test('one match at exactly 0.5: direct_match', () => {
    const matchUri = 'kairos://mem/aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee';
    const matchChoice: UnifiedChoice = {
      uri: matchUri,
      label: 'Boundary',
      chain_label: null,
      score: 0.5,
      role: 'match',
      tags: [],
      next_action: 'call kairos_begin with ' + matchUri,
      protocol_version: null
    };
    const { uri, decision } = selectRunTarget([matchChoice, refineChoice]);
    expect(decision).toBe('direct_match');
    expect(uri).toBe(matchUri);
  });

  test('multiple matches: returns refine, decision refine_ambiguous', () => {
    const match1: UnifiedChoice = {
      uri: 'kairos://mem/11111111-2222-3333-4444-555555555551',
      label: 'A',
      chain_label: null,
      score: 0.8,
      role: 'match',
      tags: [],
      next_action: '',
      protocol_version: null
    };
    const match2: UnifiedChoice = {
      uri: 'kairos://mem/11111111-2222-3333-4444-555555555552',
      label: 'B',
      chain_label: null,
      score: 0.7,
      role: 'match',
      tags: [],
      next_action: '',
      protocol_version: null
    };
    const choices = [match1, match2, refineChoice];
    const { uri, decision } = selectRunTarget(choices);
    expect(decision).toBe('refine_ambiguous');
    expect(uri).toBe(REFINING_PROTOCOL_URI);
  });
});
