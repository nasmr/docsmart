/**
 * Who is calling. Sign-in is not decided yet (decision 0005, open points: about M4). Until then the
 * API accepts development bearer tokens from configuration, each mapped to a tenant, an actor and a
 * role. The server refuses to start with them unless ALLOW_DEV_TOKENS=1, so they cannot reach
 * production by accident.
 */
import { z } from 'zod';

export const Principal = z.discriminatedUnion('role', [
  z.object({ role: z.literal('sponsor'), tenant_id: z.string(), actor: z.string() }),
  z.object({
    role: z.literal('counsel'),
    tenant_id: z.string(),
    actor: z.string(),
    /** From the identity module once it exists; configured for now. */
    lawyer: z.object({ verified: z.boolean(), admissions: z.array(z.string()) }),
  }),
]);
export type Principal = z.infer<typeof Principal>;

export class AuthError extends Error {
  readonly status: 401 | 403;

  constructor(status: 401 | 403, message: string) {
    super(message);
    this.name = 'AuthError';
    this.status = status;
  }
}

/** Parses API_DEV_TOKENS: a JSON object of token → principal. */
export function devTokens(json: string | undefined, allowed: boolean): Map<string, Principal> {
  if (!json) return new Map();
  if (!allowed) {
    throw new Error('API_DEV_TOKENS is set but ALLOW_DEV_TOKENS is not 1. Development tokens are for local use only.');
  }
  const parsed = z
    .record(z.string().min(16, 'tokens must be at least 16 characters'), Principal)
    .parse(JSON.parse(json));
  return new Map(Object.entries(parsed));
}

export function authenticate(header: string | undefined, tokens: ReadonlyMap<string, Principal>): Principal {
  const token = header?.match(/^Bearer (\S+)$/)?.[1];
  if (!token) throw new AuthError(401, 'Send a bearer token.');
  const principal = tokens.get(token);
  if (!principal) throw new AuthError(401, 'The token is not recognised.');
  return principal;
}

export function requireRole<R extends Principal['role']>(p: Principal, role: R): Extract<Principal, { role: R }> {
  if (p.role !== role) throw new AuthError(403, `Only ${role} can do this.`);
  return p as Extract<Principal, { role: R }>;
}
