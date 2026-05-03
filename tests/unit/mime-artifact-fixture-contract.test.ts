import { loadMimeArtifactContract, readMimeFixtureUtf8 } from '../utils/mime-artifact-fixture-contract.js';

describe('mime-artifact-fixture-contract', () => {
  it('loads and validates artifact-contract.json', () => {
    const c = loadMimeArtifactContract();
    expect(c.artifactPaths).toHaveLength(7);
    expect(c.expectedArtifactSlugs).toHaveLength(7);
    expect(c.mimeByPath['notes.txt']).toBe('text/plain');
  });

  it('reads fixture bytes for a contract path', () => {
    const c = loadMimeArtifactContract();
    const first = c.artifactPaths[0]!;
    const body = readMimeFixtureUtf8(first);
    expect(body.length).toBeGreaterThan(0);
  });
});
