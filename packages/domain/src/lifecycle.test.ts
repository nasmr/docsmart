import { describe, expect, test } from 'vitest';
import type { GateFacts } from './gate.js';
import {
  type ApplyResult,
  applyEvent,
  type DocumentLifecycle,
  type LifecycleEvent,
  startDocument,
  type VersionRef,
} from './lifecycle.js';
import { HASH_A, HASH_B, passingFacts } from './test-facts.js';

const start = () =>
  startDocument({
    document_id: 'doc_lumen_d12',
    document_class: 'D12',
    scope: 'portfolio',
    portfolio_id: 'pf_lumen',
  });
const version = (n: number, hash = HASH_A): VersionRef => ({ id: `ver_${n}`, number: n, content_hash: hash });
const assembled = (v: VersionRef): LifecycleEvent => ({ type: 'VERSION_ASSEMBLED', version: v });
const factsFor = (v: VersionRef, over: Partial<GateFacts> = {}): GateFacts =>
  passingFacts({
    version: { id: v.id, document_id: 'doc_lumen_d12', content_hash: v.content_hash },
    latest_version_id: v.id,
    ...over,
  });
const ready = (v: VersionRef, over: Partial<GateFacts> = {}): LifecycleEvent => ({
  type: 'MARK_READY',
  facts: factsFor(v, over),
  actor: 'sponsor_1',
});
const withdraw: LifecycleEvent = { type: 'WITHDRAW', actor: 'sponsor_1', reason: 'Project cancelled.' };

function ok(r: ApplyResult): DocumentLifecycle {
  if (!r.ok) throw new Error(`refused: ${r.reason}`);
  return r.lifecycle;
}
const run = (events: LifecycleEvent[]) => events.reduce((d, e) => ok(applyEvent(d, e)), start());

describe('starting', () => {
  test('a new document is DRAFTING with no version', () => {
    expect(start()).toEqual({
      state: 'DRAFTING',
      context: expect.objectContaining({ current_version: null, ready_version_id: null }),
    });
  });

  test('a portfolio document needs a portfolio (INV-9)', () => {
    expect(() =>
      startDocument({ document_id: 'd', document_class: 'D12', scope: 'portfolio', portfolio_id: null }),
    ).toThrow(/INV-9/);
  });

  test('an umbrella document has no portfolio', () => {
    expect(() =>
      startDocument({ document_id: 'd', document_class: 'U3', scope: 'umbrella', portfolio_id: 'pf_x' }),
    ).toThrow();
  });
});

describe('the path to READY_FOR_SUBMISSION', () => {
  test('assemble, pass the gate, freeze that version', () => {
    const d = run([assembled(version(1)), ready(version(1))]);
    expect(d.state).toBe('READY_FOR_SUBMISSION');
    expect(d.context.ready_version_id).toBe('ver_1');
  });

  test('re-drafts stay ASSEMBLED and number versions in order', () => {
    const d = run([assembled(version(1)), assembled(version(2)), assembled(version(3))]);
    expect(d.state).toBe('ASSEMBLED');
    expect(d.context.current_version?.number).toBe(3);
  });

  test('any change after READY creates a new version back in ASSEMBLED (decision 0001)', () => {
    const d = run([assembled(version(1)), ready(version(1)), assembled(version(2, HASH_B))]);
    expect(d.state).toBe('ASSEMBLED');
    expect(d.context.ready_version_id).toBeNull();
    expect(d.context.current_version?.number).toBe(2);
  });

  test('inputs changing sends the document back to DRAFTING, keeping the version count', () => {
    const d = run([assembled(version(1)), { type: 'INPUTS_CHANGED' }]);
    expect(d.state).toBe('DRAFTING');
    expect(ok(applyEvent(d, assembled(version(2)))).context.current_version?.number).toBe(2);
    expect(applyEvent(d, assembled(version(1))).ok).toBe(false);
  });
});

describe('refusals', () => {
  test('the gate must pass, and the refusal says why', () => {
    const d = run([assembled(version(1))]);
    const r = applyEvent(d, ready(version(1), { template: { version_id: 't', status: 'retired' } }));
    expect(r.ok).toBe(false);
    if (!r.ok) {
      expect(r.reason).toBe('The submission gate did not pass.');
      expect(r.gate?.failures.map((f) => f.condition)).toEqual([1]);
    }
  });

  test('only the latest version can be marked ready', () => {
    const d = run([assembled(version(1)), assembled(version(2))]);
    expect(applyEvent(d, ready(version(1)))).toEqual({
      ok: false,
      reason: 'Only the latest version can be marked ready.',
    });
  });

  test('the stored state, not the caller, decides which version is latest', () => {
    const d = run([assembled(version(1)), assembled(version(2))]);
    // Claiming an older version is the latest does not let it through...
    const stale = applyEvent(d, {
      type: 'MARK_READY',
      facts: factsFor(version(1), { latest_version_id: 'ver_1' }),
      actor: 'a',
    });
    expect(stale.ok).toBe(false);
    // ...and a wrong claim about the latest version does not stop the real latest one.
    const latest = applyEvent(d, {
      type: 'MARK_READY',
      facts: factsFor(version(2), { latest_version_id: 'ver_9' }),
      actor: 'a',
    });
    expect(latest.ok).toBe(true);
  });

  test('the version content must match the stored version', () => {
    const d = run([assembled(version(1))]);
    const r = applyEvent(d, { type: 'MARK_READY', facts: factsFor(version(1, HASH_B)), actor: 'a' });
    expect(r).toEqual({ ok: false, reason: 'The version content does not match the stored version.' });
  });

  test.each([
    [0, 'Version 0 does not follow version 0.'],
    [2, 'Version 2 does not follow version 0.'],
  ])('a first version numbered %i is refused', (n, reason) => {
    expect(applyEvent(start(), assembled(version(n)))).toEqual({ ok: false, reason });
  });

  test('MARK_READY is not allowed while DRAFTING', () => {
    expect(applyEvent(start(), ready(version(1)))).toEqual({
      ok: false,
      reason: 'MARK_READY is not allowed in DRAFTING.',
    });
  });

  test('INPUTS_CHANGED is not accepted once READY: the package stays frozen until a new version (decision 0009)', () => {
    const d = run([assembled(version(1)), ready(version(1))]);
    expect(applyEvent(d, { type: 'INPUTS_CHANGED' })).toEqual({
      ok: false,
      reason: 'INPUTS_CHANGED is not allowed in READY_FOR_SUBMISSION.',
    });
  });

  test('withdrawing needs a reason', () => {
    expect(applyEvent(start(), { type: 'WITHDRAW', actor: 'a', reason: ' ' }).ok).toBe(false);
  });

  test('nothing is accepted after WITHDRAWN', () => {
    const d = run([assembled(version(1)), withdraw]);
    for (const e of [assembled(version(2)), ready(version(1)), { type: 'INPUTS_CHANGED' } as const, withdraw]) {
      expect(applyEvent(d, e)).toEqual({ ok: false, reason: 'The document has been withdrawn.' });
    }
  });
});

test('applyEvent never changes the stored lifecycle it is given', () => {
  const d = run([assembled(version(1))]);
  const before = structuredClone(d);
  applyEvent(d, ready(version(1)));
  applyEvent(d, assembled(version(2)));
  expect(d).toEqual(before);
});

test('a lifecycle survives a round trip through JSON (as stored in the database)', () => {
  const d = JSON.parse(JSON.stringify(run([assembled(version(1)), ready(version(1))]))) as DocumentLifecycle;
  expect(ok(applyEvent(d, assembled(version(2)))).state).toBe('ASSEMBLED');
});

// Every reachable state, from every kind of event, valid and invalid.
describe('exhaustive exploration', () => {
  function events(d: DocumentLifecycle): LifecycleEvent[] {
    const n = d.context.current_version?.number ?? 0;
    const cur = d.context.current_version ?? version(1);
    return [
      assembled(version(n + 1, n % 2 ? HASH_A : HASH_B)),
      assembled(version(n)), // repeats the number
      assembled(version(n + 2)), // skips a number
      { type: 'INPUTS_CHANGED' },
      ready(cur),
      ready(cur, {
        findings: [
          { id: 'f', version_id: cur.id, check: 'cross_portfolio', severity: 'blocks', at: 'c', message: 'm' },
        ],
      }),
      ready(version(Math.max(1, n - 1))), // a stale version
      withdraw,
      { type: 'WITHDRAW', actor: 'a', reason: '' },
    ];
  }

  const seen = new Map<string, DocumentLifecycle>();
  const edges: Array<{ from: DocumentLifecycle; event: LifecycleEvent; to: DocumentLifecycle }> = [];
  let frontier = [start()];
  for (let depth = 0; depth < 7; depth++) {
    const next: DocumentLifecycle[] = [];
    for (const d of frontier) {
      for (const e of events(d)) {
        const r = applyEvent(d, e);
        if (!r.ok) continue;
        edges.push({ from: d, event: e, to: r.lifecycle });
        const key = JSON.stringify(r.lifecycle);
        if (!seen.has(key)) {
          seen.set(key, r.lifecycle);
          next.push(r.lifecycle);
        }
      }
    }
    frontier = next;
  }
  const states = [...seen.values()];

  test('explores a non-trivial graph', () => {
    expect(states.length).toBeGreaterThan(20);
  });

  test('reaches every state', () => {
    expect(new Set(states.map((s) => s.state))).toEqual(
      new Set(['DRAFTING', 'ASSEMBLED', 'READY_FOR_SUBMISSION', 'WITHDRAWN']),
    );
  });

  test('READY_FOR_SUBMISSION always holds the latest version, frozen', () => {
    for (const s of states.filter((s) => s.state === 'READY_FOR_SUBMISSION')) {
      expect(s.context.ready_version_id).toBe(s.context.current_version?.id);
    }
  });

  test('ready_version_id is set only while READY_FOR_SUBMISSION', () => {
    for (const s of states.filter((s) => s.state !== 'READY_FOR_SUBMISSION'))
      expect(s.context.ready_version_id).toBeNull();
  });

  test('READY_FOR_SUBMISSION is entered only through a passing gate on the latest version', () => {
    for (const e of edges.filter(
      (e) => e.to.state === 'READY_FOR_SUBMISSION' && e.from.state !== 'READY_FOR_SUBMISSION',
    )) {
      expect(e.event.type).toBe('MARK_READY');
      if (e.event.type === 'MARK_READY') {
        expect(e.event.facts.version.id).toBe(e.from.context.current_version?.id);
        expect(e.event.facts.findings).toEqual([]);
      }
    }
  });

  test('version numbers only ever go up by one, and never go back', () => {
    for (const e of edges) {
      const a = e.from.context.current_version?.number ?? 0;
      const b = e.to.context.current_version?.number ?? 0;
      expect(b === a || b === a + 1).toBe(true);
      if (b === a + 1) expect(e.event.type).toBe('VERSION_ASSEMBLED');
    }
  });

  test('ASSEMBLED and READY_FOR_SUBMISSION always have a version', () => {
    for (const s of states.filter((s) => s.state === 'ASSEMBLED' || s.state === 'READY_FOR_SUBMISSION')) {
      expect(s.context.current_version).not.toBeNull();
    }
  });

  test('WITHDRAWN has no way out', () => {
    for (const s of states.filter((s) => s.state === 'WITHDRAWN')) {
      for (const e of events(s)) expect(applyEvent(s, e).ok).toBe(false);
    }
  });
});
