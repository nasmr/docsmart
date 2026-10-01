/**
 * Consent to read an investor's record, scoped to a portfolio (INV-14, DF-13).
 *
 * A party's record is read by a portfolio's workflows only with a consent grant for that portfolio.
 * Joining a portfolio grants consent for that portfolio only, never for the umbrella.
 */
export interface ConsentGrant {
  party_id: string;
  portfolio_id: string;
  purpose: string;
  granted_at: string;
  /** ISO date-time after which the grant no longer applies; null for no expiry. */
  expires_at: string | null;
}

/** The purpose recorded when a party joins a portfolio through a subscription. */
export const ADMINISTER_HOLDING = 'administer_holding';

/** The grant a party gives by subscribing to a portfolio: that portfolio only (INV-14). */
export function joiningGrant(partyId: string, portfolioId: string, grantedAt: string): ConsentGrant {
  return {
    party_id: partyId,
    portfolio_id: portfolioId,
    purpose: ADMINISTER_HOLDING,
    granted_at: grantedAt,
    expires_at: null,
  };
}

/**
 * Whether a portfolio's workflow may read a party's record for a purpose at a time. True only with
 * a grant for exactly that party, portfolio and purpose that has started and not expired.
 */
export function mayRead(
  grants: readonly ConsentGrant[],
  request: { party_id: string; portfolio_id: string; purpose: string; at: string },
): boolean {
  const at = Date.parse(request.at);
  if (Number.isNaN(at)) throw new Error(`Invalid time “${request.at}”.`);
  return grants.some(
    (g) =>
      g.party_id === request.party_id &&
      g.portfolio_id === request.portfolio_id &&
      g.purpose === request.purpose &&
      Date.parse(g.granted_at) <= at &&
      (g.expires_at === null || at < Date.parse(g.expires_at)),
  );
}
