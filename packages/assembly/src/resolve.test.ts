import { describe, expect, test } from 'vitest';
import { lookupList, lookupRoute } from './resolve.js';
import { catalogue, input } from './test/fixtures.js';

describe('every catalogue field and list can be looked up', () => {
  test.each(Object.entries(catalogue.fields))('%s', (field, spec) => {
    expect(lookupRoute(field, spec), `${field} from ${spec.source}`).toBeDefined();
  });

  test.each(Object.keys(catalogue.lists))('list %s', async (list) => {
    const i = await input('batch_atlas_d1sp', { party: 'pty_040' }); // an entity, for its signatories and controllers
    const ctx = { ...i, document: { ...i.document, inputs: { meeting: { attendee_director_ids: ['dir_01'] } } } };
    expect(Array.isArray(lookupList(list, ctx))).toBe(true);
  });

  test('a list nothing knows is reported, not empty', async () => {
    expect(lookupList('umbrella.officers', await input('doc_lumen_d12'))).toEqual({
      missing: 'no lookup for list umbrella.officers',
    });
  });
});
