import { parseKairosUri } from '../../src/tools/kairos-uri.js';

describe('parseKairosUri', () => {
  test('parses adapter slug URIs', () => {
    expect(parseKairosUri('kairos://adapter/create-merge-request')).toEqual({
      kind: 'adapter',
      id: 'create-merge-request',
      idKind: 'slug',
      raw: 'kairos://adapter/create-merge-request'
    });
  });
});
