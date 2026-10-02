export type ImportProblemCode =
  | 'not_word' // not a readable Word file
  | 'tracked_change' // unresolved tracked insertions, deletions or moves (decision 0010)
  | 'nested_table' // a table inside a table
  | 'unknown_marker' // [[…]] that is not IF, ELSE, END IF, FOR EACH or END FOR EACH
  | 'unbalanced_block' // a condition or loop that is not closed, or closed twice
  | 'empty_table'; // a table with no rows

export interface ImportProblem {
  code: ImportProblemCode;
  /** Where in the Word file, e.g. paragraph 37 (“2.1 A segregated portfolio…”). */
  at: string;
  message: string;
}

/** An import that cannot produce a tree. Lists every problem found, not only the first. */
export class ImportFailure extends Error {
  readonly problems: ImportProblem[];

  constructor(problems: ImportProblem[]) {
    super(problems.map((p) => `${p.at}: ${p.message}`).join('\n'));
    this.name = 'ImportFailure';
    this.problems = problems;
  }
}
