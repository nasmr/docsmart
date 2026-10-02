/**
 * Keeping block ids across counsel's edits (decision 0008). Ids travel in Word as bookmarks. After a
 * re-import, the new tree is matched against the previous version to settle two cases bookmarks
 * cannot: a pasted copy carrying the original's bookmark, and a block whose bookmark was lost.
 */
import { blockText, type IdBlock, idBlocks, type TemplateTree } from './format.js';
import type { ImportResult } from './word/import.js';

/** Word overlap at or above which a block without a bookmark takes a vanished block's id. To be tuned on real edits. */
export const MATCH_THRESHOLD = 0.6;

export interface Reconciliation {
  /** Ids present before and after. */
  kept: string[];
  /** Blocks that lost their bookmark and were matched to their previous id by text. */
  recovered: Array<{ id: string; text: string }>;
  /** Blocks with no previous counterpart: show them for counsel to confirm (build plan §9). */
  added: string[];
  /** Ids from the previous version with no counterpart now. */
  removed: string[];
}

function words(s: string): Set<string> {
  return new Set(s.toLowerCase().match(/[\p{L}\p{N}_{}.]+/gu) ?? []);
}

/** Jaccard overlap of the two texts' words, from 0 to 1. */
export function similarity(a: string, b: string): number {
  const x = words(a);
  const y = words(b);
  if (!x.size && !y.size) return 1;
  let inter = 0;
  for (const w of x) if (y.has(w)) inter++;
  return inter / (x.size + y.size - inter);
}

export function reconcile(
  previous: TemplateTree,
  imported: ImportResult,
): { tree: TemplateTree; report: Reconciliation } {
  const tree = structuredClone(imported.tree);
  const next = [...idBlocks(tree.body)];
  const before = new Map([...idBlocks(previous.body)].map((b) => [b.id, b] as const));
  const sim = (a: IdBlock, b: IdBlock) => (a.t === b.t ? similarity(blockText(a), blockText(b)) : 0);

  // 1. A pasted copy: of the blocks that carried the same bookmark, the one closest to the
  //    previous text keeps the id.
  for (const { id: copyId, bookmark } of imported.ids.duplicates) {
    const copy = next.find((b) => b.id === copyId);
    const holder = next.find((b) => b.id === bookmark);
    const was = before.get(bookmark);
    if (copy && holder && was && sim(copy, was) > sim(holder, was)) {
      copy.id = bookmark;
      holder.id = copyId;
    }
  }

  // 2. A lost bookmark: a new block takes the id of a vanished block of the same kind whose text is
  //    close enough. Document order, best match first, each vanished id used once.
  const present = new Set(next.map((b) => b.id));
  const orphans = [...before.values()].filter((b) => !present.has(b.id));
  const recovered: Reconciliation['recovered'] = [];
  for (const b of next) {
    if (before.has(b.id)) continue;
    let best: IdBlock | undefined;
    let score = MATCH_THRESHOLD;
    for (const o of orphans) {
      const s = sim(b, o);
      if (s >= score && (!best || s > score)) {
        best = o;
        score = s;
      }
    }
    if (best) {
      b.id = best.id;
      orphans.splice(orphans.indexOf(best), 1);
      recovered.push({ id: b.id, text: blockText(b).slice(0, 80) });
    }
  }

  const after = new Set(next.map((b) => b.id));
  return {
    tree,
    report: {
      kept: [...before.keys()].filter((id) => after.has(id) && !recovered.some((r) => r.id === id)),
      recovered,
      added: next.filter((b) => !before.has(b.id)).map((b) => b.id),
      removed: [...before.keys()].filter((id) => !after.has(id)),
    },
  };
}
