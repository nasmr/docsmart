/**
 * Legal names and the contracting-party designation (DF-P10, DF-62, decision 0003).
 *
 * Decision 0003 is proposed and waits on BVI counsel (addendum question 13.11). Until counsel
 * confirms the wording, the designation is a placeholder: anything that leaves the platform must
 * check DESIGNATION_WORDING_STATUS (build plan §9).
 */
export const DESIGNATION_WORDING_STATUS: 'placeholder_pending_counsel' | 'confirmed' = 'placeholder_pending_counsel';

const UMBRELLA_WORDS = /(?:^|\s)(?:Segregated Portfolio Company|SPC)(?:\s|$)/;
const PORTFOLIO_WORDS = /(?:^|\s)Segregated Portfolio(?:\s|$)/;

function spacingProblems(name: string): string[] {
  if (name.trim() === '') return ['is empty'];
  const problems: string[] = [];
  if (name !== name.trim()) problems.push('has leading or trailing spaces');
  if (/\s{2,}|[^\S ]/.test(name.trim())) problems.push('has repeated spaces, tabs or line breaks');
  return problems;
}

/** Problems with an umbrella (SPC) legal name; empty when it is acceptable. */
export function umbrellaNameProblems(name: string): string[] {
  const problems = spacingProblems(name);
  if (name.trim() !== '' && !UMBRELLA_WORDS.test(name)) {
    problems.push('must include “Segregated Portfolio Company” or “SPC” as words');
  }
  return problems;
}

/** Problems with a portfolio legal name; empty when it is acceptable. */
export function portfolioNameProblems(name: string): string[] {
  const problems = spacingProblems(name);
  if (name.trim() !== '' && !PORTFOLIO_WORDS.test(name)) problems.push('must include “Segregated Portfolio” as words');
  return problems;
}

export class InvalidNameError extends Error {
  constructor(which: 'umbrella' | 'portfolio', name: string, problems: string[]) {
    super(`${which} legal name “${name}” ${problems.join('; ')}`);
    this.name = 'InvalidNameError';
  }
}

/**
 * The contracting-party wording for a portfolio: “[SPC legal name] for and on behalf of
 * [portfolio legal name]”. Generated, never typed (DF-P10). Refuses invalid names rather than
 * producing wording that would fail the contracting-party check.
 */
export function designation(umbrellaLegalName: string, portfolioLegalName: string): string {
  const u = umbrellaNameProblems(umbrellaLegalName);
  if (u.length) throw new InvalidNameError('umbrella', umbrellaLegalName, u);
  const p = portfolioNameProblems(portfolioLegalName);
  if (p.length) throw new InvalidNameError('portfolio', portfolioLegalName, p);
  return `${umbrellaLegalName} for and on behalf of ${portfolioLegalName}`;
}
