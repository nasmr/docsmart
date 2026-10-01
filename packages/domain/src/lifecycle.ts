/**
 * Document lifecycle for this slice (build plan §2.3, decision 0001):
 *
 *   DRAFTING ─version assembled─▶ ASSEMBLED ─gate passed─▶ READY_FOR_SUBMISSION
 *       ▲                          │    ▲                         │
 *       └──── inputs changed ──────┘    └──── new version ────────┘
 *   withdraw from any state → WITHDRAWN (final)
 *
 * XState is used only as a pure transition function: the state lives in the database, and the
 * API applies an event to the stored state inside the same transaction that writes the audit row.
 */
import { assign, setup, transition } from 'xstate';
import type { DocumentClass, DocumentScope, DocumentState } from './documents.js';
import { evaluateGate, type GateFacts, type GateResult } from './gate.js';

export interface VersionRef {
  id: string;
  number: number;
  content_hash: string;
}

export interface LifecycleContext {
  document_id: string;
  document_class: DocumentClass;
  scope: DocumentScope;
  portfolio_id: string | null;
  /** The latest version; kept when inputs change, so numbering continues. */
  current_version: VersionRef | null;
  /** The version frozen as the submission package, while READY_FOR_SUBMISSION. */
  ready_version_id: string | null;
}

/** What the database stores. */
export interface DocumentLifecycle {
  state: DocumentState;
  context: LifecycleContext;
}

export type LifecycleEvent =
  | { type: 'VERSION_ASSEMBLED'; version: VersionRef }
  | { type: 'INPUTS_CHANGED' }
  | { type: 'MARK_READY'; facts: GateFacts; actor: string }
  | { type: 'WITHDRAW'; actor: string; reason: string };

/** Gate facts, with the latest version taken from the stored state rather than from the caller. */
function gateFor(context: LifecycleContext, facts: GateFacts): GateResult {
  return evaluateGate({
    ...facts,
    document_id: context.document_id,
    latest_version_id: context.current_version?.id ?? '',
  });
}

function versionFollows(context: LifecycleContext, v: VersionRef): string | null {
  const expected = (context.current_version?.number ?? 0) + 1;
  if (v.number !== expected) return `Version ${v.number} does not follow version ${expected - 1}.`;
  if (v.id === context.current_version?.id) return 'The version id is already in use.';
  return null;
}

function markReadyProblem(context: LifecycleContext, facts: GateFacts): string | null {
  if (!context.current_version) return 'There is no version to submit.';
  if (facts.version.id !== context.current_version.id) return 'Only the latest version can be marked ready.';
  if (facts.version.content_hash !== context.current_version.content_hash) {
    return 'The version content does not match the stored version.';
  }
  if (facts.document_class !== context.document_class) return 'The facts are for a different document class.';
  return null;
}

export const documentMachine = setup({
  types: {
    context: {} as LifecycleContext,
    events: {} as LifecycleEvent,
    input: {} as Omit<LifecycleContext, 'current_version' | 'ready_version_id'>,
  },
  guards: {
    versionFollows: ({ context, event }) =>
      event.type === 'VERSION_ASSEMBLED' && versionFollows(context, event.version) === null,
    gatePasses: ({ context, event }) =>
      event.type === 'MARK_READY' &&
      markReadyProblem(context, event.facts) === null &&
      gateFor(context, event.facts).passed,
    hasReason: ({ event }) => event.type === 'WITHDRAW' && event.reason.trim() !== '' && event.actor.trim() !== '',
  },
  actions: {
    recordVersion: assign({
      current_version: ({ event }) => (event.type === 'VERSION_ASSEMBLED' ? event.version : null),
      ready_version_id: null,
    }),
    freezeVersion: assign({ ready_version_id: ({ context }) => context.current_version?.id ?? null }),
    clearReady: assign({ ready_version_id: null }),
  },
}).createMachine({
  id: 'document',
  initial: 'DRAFTING',
  context: ({ input }) => ({ ...input, current_version: null, ready_version_id: null }),
  states: {
    DRAFTING: {
      on: {
        VERSION_ASSEMBLED: { target: 'ASSEMBLED', guard: 'versionFollows', actions: 'recordVersion' },
        WITHDRAW: { target: 'WITHDRAWN', guard: 'hasReason' },
      },
    },
    ASSEMBLED: {
      on: {
        VERSION_ASSEMBLED: { target: 'ASSEMBLED', guard: 'versionFollows', actions: 'recordVersion' },
        INPUTS_CHANGED: { target: 'DRAFTING' },
        MARK_READY: { target: 'READY_FOR_SUBMISSION', guard: 'gatePasses', actions: 'freezeVersion' },
        WITHDRAW: { target: 'WITHDRAWN', guard: 'hasReason' },
      },
    },
    READY_FOR_SUBMISSION: {
      on: {
        // Any change creates a new version and the document returns to ASSEMBLED (decision 0001).
        VERSION_ASSEMBLED: { target: 'ASSEMBLED', guard: 'versionFollows', actions: 'recordVersion' },
        WITHDRAW: { target: 'WITHDRAWN', guard: 'hasReason', actions: 'clearReady' },
      },
    },
    WITHDRAWN: { type: 'final' },
  },
});

export function startDocument(
  input: Omit<LifecycleContext, 'current_version' | 'ready_version_id'>,
): DocumentLifecycle {
  if (input.scope === 'portfolio' && !input.portfolio_id)
    throw new Error('A portfolio document needs a portfolio_id (INV-9).');
  if (input.scope === 'umbrella' && input.portfolio_id) throw new Error('An umbrella document has no portfolio_id.');
  return { state: 'DRAFTING', context: { ...input, current_version: null, ready_version_id: null } };
}

export type ApplyResult =
  | { ok: true; lifecycle: DocumentLifecycle; from: DocumentState; to: DocumentState }
  | { ok: false; reason: string; gate?: GateResult };

/** Applies an event to a stored lifecycle. Never changes its input. */
export function applyEvent(current: DocumentLifecycle, event: LifecycleEvent): ApplyResult {
  const snapshot = documentMachine.resolveState({ value: current.state, context: structuredClone(current.context) });
  if (!snapshot.can(event)) return refuse(current, event);
  const [next] = transition(documentMachine, snapshot, event);
  const to = next.value as DocumentState;
  return { ok: true, lifecycle: { state: to, context: next.context }, from: current.state, to };
}

// Explains why an event was refused, in words the sponsor can act on.
function refuse(current: DocumentLifecycle, event: LifecycleEvent): ApplyResult {
  const { state, context } = current;
  if (state === 'WITHDRAWN') return { ok: false, reason: 'The document has been withdrawn.' };
  const allowed: Record<Exclude<DocumentState, 'WITHDRAWN'>, LifecycleEvent['type'][]> = {
    DRAFTING: ['VERSION_ASSEMBLED', 'WITHDRAW'],
    ASSEMBLED: ['VERSION_ASSEMBLED', 'INPUTS_CHANGED', 'MARK_READY', 'WITHDRAW'],
    READY_FOR_SUBMISSION: ['VERSION_ASSEMBLED', 'WITHDRAW'],
  };
  if (!allowed[state].includes(event.type)) return { ok: false, reason: `${event.type} is not allowed in ${state}.` };
  switch (event.type) {
    case 'VERSION_ASSEMBLED':
      return { ok: false, reason: versionFollows(context, event.version) ?? 'The version was refused.' };
    case 'MARK_READY': {
      const problem = markReadyProblem(context, event.facts);
      if (problem) return { ok: false, reason: problem };
      const gate = gateFor(context, event.facts);
      return { ok: false, reason: 'The submission gate did not pass.', gate };
    }
    case 'WITHDRAW':
      return { ok: false, reason: 'Withdrawing needs an actor and a reason.' };
    default:
      return { ok: false, reason: `${event.type} was refused.` };
  }
}
