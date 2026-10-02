/**
 * The API reports an invalid record as "path: message" lines (ErrorResponse.issues), with
 * "(record)" for problems with the record as a whole. These place each one by its field.
 */
export interface Issue {
  path: string;
  message: string;
}

export function parseIssues(lines: readonly string[]): Issue[] {
  return lines.map((line) => {
    const at = line.indexOf(': ');
    if (at < 0) return { path: '', message: line };
    const path = line.slice(0, at);
    return { path: path === '(record)' ? '' : path, message: line.slice(at + 2) };
  });
}

const within = (issue: string, field: string) => issue === field || issue.startsWith(`${field}.`);

/** The messages for a field and anything inside it (a money's amount, say), with the inner path named. */
export function issuesAt(issues: readonly Issue[], field: string): string[] {
  return issues
    .filter((i) => within(i.path, field))
    .map((i) => (i.path === field ? i.message : `${i.path.slice(field.length + 1).replace(/\./g, ' ')}: ${i.message}`));
}

/** Issues that no shown field claims, to show at the top of the form. */
export function unplaced(issues: readonly Issue[], fields: readonly string[]): Issue[] {
  return issues.filter((i) => !fields.some((f) => within(i.path, f)));
}
