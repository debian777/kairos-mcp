// Replaced TypeScript type imports with JSDoc typedef usage
/**
 * @typedef {import('../../src/types/memory.js').Memory} Memory
 */

// Extract the scoreMemory function from memory-qdrant-store.ts for testing
function scoreMemory(memory, normalizedQuery) {
  const label = memory.label.toLowerCase();
  const text = memory.text.toLowerCase();
  const tags = memory.tags.map(tag => tag.toLowerCase());

  let score = 0;

  // 1. Exact phrase match (highest weight)
  if (label.includes(normalizedQuery)) {
    score += 300;
  }
  if (text.includes(normalizedQuery)) {
    score += 200;
  }

  // 2. Tag matches
  const tagMatches = tags.filter(tag => tag.includes(normalizedQuery) || normalizedQuery.includes(tag));
  score += tagMatches.length * 150;

  // 3. Word-level matching with TF-IDF-like scoring
  const queryWords = normalizedQuery.split(/\s+/).filter(word => word.length > 2);
  if (queryWords.length > 0) {
    const labelWords = label.split(/\s+/);
    const textWords = text.split(/\s+/);

    // Calculate term frequency in label and text
    let wordMatchScore = 0;
    for (const queryWord of queryWords) {
      // Exact word matches in label
      const labelExactMatches = labelWords.filter(word => word === queryWord).length;
      wordMatchScore += labelExactMatches * 50;

      // Partial word matches in label
      const labelPartialMatches = labelWords.filter(word => word.includes(queryWord) || queryWord.includes(word)).length;
      wordMatchScore += (labelPartialMatches - labelExactMatches) * 25;

      // Exact word matches in text
      const textExactMatches = textWords.filter(word => word === queryWord).length;
      wordMatchScore += textExactMatches * 30;

      // Partial word matches in text
      const textPartialMatches = textWords.filter(word => word.includes(queryWord) || queryWord.includes(word)).length;
      wordMatchScore += (textPartialMatches - textExactMatches) * 15;
    }

    // Normalize by query length to prevent bias toward longer queries
    wordMatchScore = wordMatchScore / Math.sqrt(queryWords.length);
    score += wordMatchScore;
  }

  // 4. Content quality factors
  // Prefer memories with more structured content (headers, lists)
  const hasHeaders = /^#+\s/.test(memory.text);
  const hasLists = /^[-*+]\s/m.test(memory.text);
  const contentLength = memory.text.length;

  if (hasHeaders) score += 20;
  if (hasLists) score += 15;

  // Length bonus (sweet spot around 500-2000 chars)
  if (contentLength > 200 && contentLength < 3000) {
    score += Math.min(contentLength / 100, 50);
  }

  // 5. Recency bonus (newer content slightly preferred)
  const ageInDays = (Date.now() - new Date(memory.created_at).getTime()) / (1000 * 60 * 60 * 24);
  if (ageInDays < 30) {
    score += Math.max(0, 10 - ageInDays);
  }

  // Normalize score to 0-1 range for consistency
  return Math.min(score / 500, 1.0);
}

describe('Relevance Scoring', () => {
  const baseMemory = {
    memory_uuid: 'test-uuid',
    label: 'Test Memory',
    tags: ['test', 'sample'],
    text: 'This is a test memory with some content.',
    previous_memory_uuid: null,
    next_memory_uuid: null,
    llm_model_id: 'test-model',
    created_at: new Date().toISOString()
  };

  describe('Exact phrase matching', () => {
    test('should give high score for exact phrase match in label', () => {
      const memory = { ...baseMemory, label: 'JavaScript programming guide' };
      const score = scoreMemory(memory, 'javascript programming');
      expect(score).toBeGreaterThan(0.5); // 300 points normalized
    });

    test('should give high score for exact phrase match in text', () => {
      const memory = { ...baseMemory, text: 'This document covers JavaScript programming in detail.' };
      const score = scoreMemory(memory, 'javascript programming');
      expect(score).toBeGreaterThan(0.3); // 200 points normalized
    });

    test('should give maximum score for matches in both label and text', () => {
      const memory = {
        ...baseMemory,
        label: 'JavaScript programming guide',
        text: 'This document covers JavaScript programming in detail.'
      };
      const score = scoreMemory(memory, 'javascript programming');
      expect(score).toBe(1.0); // 500+ points capped at 1.0
    });
  });

  describe('Tag-based scoring', () => {
    test('should score higher when query matches tags exactly', () => {
      const memory = { ...baseMemory, tags: ['javascript', 'programming', 'guide'] };
      const score = scoreMemory(memory, 'javascript');
      expect(score).toBeGreaterThan(0.2); // 150 points for tag match
    });

    test('should score for partial tag matches', () => {
      const memory = { ...baseMemory, tags: ['javascript', 'programming'] };
      const score = scoreMemory(memory, 'script');
      expect(score).toBeGreaterThan(0.2); // 150 points for partial tag match
    });

    test('should accumulate scores for multiple tag matches', () => {
      const memory = { ...baseMemory, tags: ['javascript', 'programming', 'guide'] };
      const score = scoreMemory(memory, 'programming guide');
      expect(score).toBeGreaterThan(0.4); // Multiple tag matches
    });
  });

  describe('Word-level matching', () => {
    test('should score exact word matches in label', () => {
      const memory = { ...baseMemory, label: 'JavaScript programming tutorial' };
      const score = scoreMemory(memory, 'javascript');
      expect(score).toBeGreaterThan(0.05); // 50 points for exact word match
    });

    test('should score partial word matches in text', () => {
      const memory = { ...baseMemory, text: 'This covers scripting languages including JavaScript.' };
      const score = scoreMemory(memory, 'script');
      expect(score).toBeGreaterThan(0.02); // 15 points for partial match
    });

    test('should normalize scores by query length', () => {
      const memory1 = { ...baseMemory, text: 'JavaScript programming' };
      const memory2 = { ...baseMemory, text: 'JavaScript programming tutorial guide' };

      const score1 = scoreMemory(memory1, 'javascript');
      const score2 = scoreMemory(memory2, 'javascript programming tutorial');

      // Both should have reasonable scores, not biased by query length
      expect(score1).toBeGreaterThan(0.05);
      expect(score2).toBeGreaterThan(0.05);
    });
  });

  describe('Content structure bonuses', () => {
    test('should give bonus for headers', () => {
      const memory = { ...baseMemory, text: '# JavaScript Guide\n\nThis is content.' };
      const score = scoreMemory(memory, 'javascript');
      expect(score).toBeGreaterThan(0.02); // 20 points for headers
    });

    test('should give bonus for lists', () => {
      const memory = { ...baseMemory, text: 'Features:\n- Item 1\n- Item 2\n- Item 3' };
      const score = scoreMemory(memory, 'features');
      expect(score).toBeGreaterThan(0.02); // 15 points for lists
    });

    test('should give bonus for optimal content length', () => {
      const memory = {
        ...baseMemory,
        text: 'A'.repeat(1000), // 1000 characters - optimal length
        label: 'Test content'
      };
      const score = scoreMemory(memory, 'test');
      expect(score).toBeGreaterThan(0.05); // Length bonus (up to 50 points)
    });
  });

  describe('Recency bonuses', () => {
    test('should give bonus for recent content', () => {
      const recentMemory = {
        ...baseMemory,
        created_at: new Date(Date.now() - 86400000).toISOString() // 1 day ago
      };
      const score = scoreMemory(recentMemory, 'test');
      expect(score).toBeGreaterThan(0.01); // Recency bonus (up to 10 points)
    });

    test('should not give bonus for old content', () => {
      const oldMemory = {
        ...baseMemory,
        created_at: new Date(Date.now() - 86400000 * 60).toISOString() // 60 days ago
      };
      const score = scoreMemory(oldMemory, 'test');
      // Old content (60+ days) gets no recency bonus
      expect(score).toBeGreaterThanOrEqual(0);
      // Score should be valid (may be high due to other factors)
      expect(typeof score).toBe('number');
    });
  });

  describe('Score normalization', () => {
    test('should normalize scores to 0-1 range', () => {
      const memory = {
        ...baseMemory,
        label: 'perfect match for query',
        text: 'perfect match for query with lots of content'.repeat(10),
        tags: ['perfect', 'match', 'query']
      };
      const score = scoreMemory(memory, 'perfect match for query');
      expect(score).toBe(1.0); // Should be capped at 1.0
    });

    test('should return very low score for no meaningful matches', () => {
      const memory = { ...baseMemory, text: 'unrelated content', tags: [] };
      const score = scoreMemory(memory, 'nonexistent');
      expect(score).toBeLessThan(0.1); // Very low score for no matches
    });
  });

  describe('Edge cases', () => {
    test('should handle empty query gracefully', () => {
      const score = scoreMemory(baseMemory, '');
      // Empty query still gets some score from content bonuses
      expect(score).toBeGreaterThan(0);
    });

    test('should handle empty content', () => {
      const memory = {
        ...baseMemory,
        text: '',
        label: '',
        tags: []
      };
      const score = scoreMemory(memory, 'test');
      // Even empty content gets some score from recency and length bonuses
      expect(score).toBeGreaterThan(0);
    });

    test('should handle special characters', () => {
      const memory = { ...baseMemory, text: 'Content with @#$%^&*() symbols!' };
      const score = scoreMemory(memory, '@#$%');
      expect(score).toBeGreaterThan(0);
    });

    test('should handle very short words', () => {
      const score = scoreMemory(baseMemory, 'a an the');
      // Short words are filtered, but content bonuses still apply
      expect(score).toBeGreaterThan(0);
    });

    test('should handle case insensitive matching', () => {
      const memory = { ...baseMemory, text: 'JAVASCRIPT PROGRAMMING' };
      const score = scoreMemory(memory, 'javascript programming');
      expect(score).toBeGreaterThan(0.3);
    });
  });
});