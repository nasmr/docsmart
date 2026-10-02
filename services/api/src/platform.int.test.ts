// The platform services (build plan B1) against the real database.
import {
  audit,
  auditTrail,
  EvidenceError,
  getEvidence,
  getPolicy,
  MemoryObjectStore,
  putEvidence,
  setPolicy,
  storageKey,
} from '@docsmart/platform';
import { afterAll, beforeAll, describe, expect, test } from 'vitest';
import { withTenant } from './db/connect.js';
import { app, createTenant } from './test/db.js';

const WHO = { tenant_id: 'platform_t', actor: 'ops_1' };
const OTHER = 'platform_u';
const db = app();
const bytes = (s: string) => new TextEncoder().encode(s);

beforeAll(async () => {
  await createTenant(WHO.tenant_id);
  await createTenant(OTHER);
});
afterAll(() => db.destroy());

describe('evidence (SVC-EVID)', () => {
  test('content-addressed: the same bytes twice give one record', async () => {
    const store = new MemoryObjectStore();
    const [a, b] = await withTenant(db, WHO.tenant_id, async (tx) => [
      await putEvidence(tx, store, {
        tenant_id: WHO.tenant_id,
        bytes: bytes('executed resolution'),
        media_type: 'text/plain',
        created_by: WHO.actor,
      }),
      await putEvidence(tx, store, {
        tenant_id: WHO.tenant_id,
        bytes: bytes('executed resolution'),
        media_type: 'text/plain',
        created_by: WHO.actor,
      }),
    ]);
    expect(a).toBe(b);
    expect(a).toMatch(/^[0-9a-f]{64}$/);
    const rows = await withTenant(db, WHO.tenant_id, (tx) =>
      tx.selectFrom('evidence').select('sha256').where('sha256', '=', a).execute(),
    );
    expect(rows).toHaveLength(1);
  });

  test('content altered in storage is detected, never returned', async () => {
    const store = new MemoryObjectStore();
    const hash = await withTenant(db, WHO.tenant_id, (tx) =>
      putEvidence(tx, store, {
        tenant_id: WHO.tenant_id,
        bytes: bytes('cost basis: USD 9.40'),
        media_type: 'text/plain',
        created_by: WHO.actor,
      }),
    );
    store.objects.set(storageKey(WHO.tenant_id, hash), bytes('cost basis: USD 4.90'));
    await expect(withTenant(db, WHO.tenant_id, (tx) => getEvidence(tx, store, hash))).rejects.toThrow(EvidenceError);
    await expect(withTenant(db, WHO.tenant_id, (tx) => getEvidence(tx, store, hash))).rejects.toThrow(/altered/);
  });

  test('content missing from storage is an error, not an empty file', async () => {
    const store = new MemoryObjectStore();
    const hash = await withTenant(db, WHO.tenant_id, (tx) =>
      putEvidence(tx, store, {
        tenant_id: WHO.tenant_id,
        bytes: bytes('valuation report'),
        media_type: 'text/plain',
        created_by: WHO.actor,
      }),
    );
    store.objects.clear();
    await expect(withTenant(db, WHO.tenant_id, (tx) => getEvidence(tx, store, hash))).rejects.toThrow(
      /missing from storage/,
    );
  });

  test('another tenant cannot read it', async () => {
    const store = new MemoryObjectStore();
    const hash = await withTenant(db, WHO.tenant_id, (tx) =>
      putEvidence(tx, store, {
        tenant_id: WHO.tenant_id,
        bytes: bytes('tenant t only'),
        media_type: 'text/plain',
        created_by: WHO.actor,
      }),
    );
    await expect(withTenant(db, OTHER, (tx) => getEvidence(tx, store, hash))).rejects.toThrow(/No evidence/);
  });
});

describe('policy (SVC-POLICY)', () => {
  test('each change is a new version from a reviewed change, and the latest counts', async () => {
    await withTenant(db, WHO.tenant_id, async (tx) => {
      expect(await getPolicy(tx, 'severities')).toBeUndefined();
      expect(
        await setPolicy(tx, {
          tenant_id: WHO.tenant_id,
          key: 'severities',
          value: { defined_terms: 'review' },
          approved_by: 'law_1',
          change_ref: 'CHG-10',
        }),
      ).toBe(1);
      expect(
        await setPolicy(tx, {
          tenant_id: WHO.tenant_id,
          key: 'severities',
          value: { defined_terms: 'blocks' },
          approved_by: 'law_1',
          change_ref: 'CHG-11',
        }),
      ).toBe(2);
      expect(await getPolicy(tx, 'severities')).toEqual({
        version: 2,
        value: { defined_terms: 'blocks' },
        approved_by: 'law_1',
        change_ref: 'CHG-11',
      });
      expect((await auditTrail(tx, 'policy', 'severities')).map((r) => r.action)).toEqual([
        'policy.changed',
        'policy.changed',
      ]);
    });
  });

  test('a change without an approver or a change reference is refused', async () => {
    await expect(
      withTenant(db, WHO.tenant_id, (tx) =>
        setPolicy(tx, { tenant_id: WHO.tenant_id, key: 'x', value: 1, approved_by: ' ', change_ref: 'CHG' }),
      ),
    ).rejects.toThrow(/approver and a change reference/);
  });

  test('two concurrent changes to one key cannot both succeed', async () => {
    const change = (n: number) =>
      withTenant(db, WHO.tenant_id, (tx) =>
        setPolicy(tx, {
          tenant_id: WHO.tenant_id,
          key: 'race',
          value: n,
          approved_by: 'law_1',
          change_ref: `CHG-${n}`,
        }),
      );
    const results = await Promise.allSettled([change(1), change(2)]);
    const versions = await withTenant(db, WHO.tenant_id, (tx) =>
      tx.selectFrom('policy_versions').select('version').where('key', '=', 'race').execute(),
    );
    // Either one wins and the other fails on the duplicate version, or they ran one after the other.
    expect(versions.map((v) => v.version).sort()).toEqual(
      results.every((r) => r.status === 'fulfilled') ? [1, 2] : [1],
    );
  });
});

describe('audit (SVC-LOG)', () => {
  test('an entry needs an actor', async () => {
    await expect(
      withTenant(db, WHO.tenant_id, (tx) =>
        audit(tx, { tenant_id: WHO.tenant_id, actor: '', action: 'x', entity: 'x', entity_id: 'x' }),
      ),
    ).rejects.toThrow(/needs an actor/);
  });

  test('an entry written in a transaction that fails is not kept', async () => {
    await withTenant(db, WHO.tenant_id, async (tx) => {
      await audit(tx, {
        tenant_id: WHO.tenant_id,
        actor: WHO.actor,
        action: 'attempt',
        entity: 'probe',
        entity_id: 'p1',
      });
      throw new Error('the change itself failed');
    }).catch(() => undefined);
    expect(await withTenant(db, WHO.tenant_id, (tx) => auditTrail(tx, 'probe', 'p1'))).toEqual([]);
  });
});
