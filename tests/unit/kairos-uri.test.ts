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

  test('parses artifact slug URIs', () => {
    expect(parseKairosUri('kairos://artifact/sort-jira-py')).toEqual({
      kind: 'artifact',
      id: 'sort-jira-py',
      idKind: 'slug',
      raw: 'kairos://artifact/sort-jira-py'
    });
  });

  test('parses artifact uuid URIs', () => {
    expect(parseKairosUri('kairos://artifact/00000000-0000-0000-0000-000000000001')).toEqual({
      kind: 'artifact',
      id: '00000000-0000-0000-0000-000000000001',
      idKind: 'uuid',
      raw: 'kairos://artifact/00000000-0000-0000-0000-000000000001'
    });
  });
});
