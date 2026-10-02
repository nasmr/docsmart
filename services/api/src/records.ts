/**
 * The sponsor's records (build plan B4). Each is validated by @docsmart/domain before it is written,
 * and each change adds a version, so earlier values stay available for re-derivation (DF-51).
 */
import {
  Asset,
  Offer,
  Party,
  Portfolio,
  type PortfolioRecords,
  PortfolioTerms,
  Sponsor,
  SubscriptionAccount,
  SubscriptionRequest,
  Umbrella,
} from '@docsmart/domain';
import { audit } from '@docsmart/platform';
import { sql } from 'kysely';
import type { z } from 'zod';
import type { Actor, Tx } from './db/connect.js';
import type { RecordEntity } from './db/schema.js';

const SCHEMAS: Record<RecordEntity, z.ZodType> = {
  umbrella: Umbrella,
  sponsor: Sponsor,
  portfolio: Portfolio,
  portfolio_terms: PortfolioTerms,
  offer: Offer,
  asset: Asset,
  subscription_account: SubscriptionAccount,
  party: Party,
  subscription_request: SubscriptionRequest,
};

export class InvalidRecord extends Error {
  readonly entity: RecordEntity;
  readonly issues: string[];

  constructor(entity: RecordEntity, issues: string[]) {
    super(`${entity}: ${issues.join('; ')}`);
    this.name = 'InvalidRecord';
    this.entity = entity;
    this.issues = issues;
  }
}

/** Saves a new version of a record after validating it. Returns the version number. */
export async function saveRecord(tx: Tx, who: Actor, entity: RecordEntity, id: string, data: unknown): Promise<number> {
  const parsed = SCHEMAS[entity].safeParse(data);
  if (!parsed.success)
    throw new InvalidRecord(
      entity,
      parsed.error.issues.map((i) => `${i.path.join('.') || '(record)'}: ${i.message}`),
    );
  const latest = await tx
    .selectFrom('record_versions')
    .select(sql<number>`max(version)`.as('v'))
    .where('entity', '=', entity)
    .where('id', '=', id)
    .executeTakeFirst();
  const version = (latest?.v ?? 0) + 1;
  await tx
    .insertInto('record_versions')
    .values({ tenant_id: who.tenant_id, entity, id, version, data: JSON.stringify(parsed.data), created_by: who.actor })
    .execute();
  await audit(tx, {
    tenant_id: who.tenant_id,
    actor: who.actor,
    action: 'record.saved',
    entity,
    entity_id: id,
    details: { version },
  });
  return version;
}

/** The current version of a record. */
export async function currentRecord<T>(tx: Tx, entity: RecordEntity, id: string): Promise<T | undefined> {
  const row = await tx
    .selectFrom('record_versions')
    .select('data')
    .where('entity', '=', entity)
    .where('id', '=', id)
    .orderBy('version', 'desc')
    .limit(1)
    .executeTakeFirst();
  return row?.data as T | undefined;
}

/** The current version of the one record of an entity that belongs to a portfolio. */
async function portfolioPart<T>(tx: Tx, entity: RecordEntity, portfolioId: string): Promise<T | undefined> {
  const rows = await tx
    .selectFrom('record_versions')
    .select(['id', 'version', 'data'])
    .where('entity', '=', entity)
    .where(sql`data->>'portfolio_id'`, '=', portfolioId)
    .orderBy('version', 'desc')
    .execute();
  const ids = new Set(rows.map((r) => r.id));
  if (ids.size > 1) throw new Error(`Portfolio ${portfolioId} has more than one ${entity}: ${[...ids].join(', ')}.`);
  return rows[0]?.data as T | undefined;
}

/** A portfolio's records as assembly needs them, or undefined if any is missing. */
export async function portfolioRecords(tx: Tx, portfolioId: string): Promise<PortfolioRecords | undefined> {
  const [portfolio, terms, offer, asset, subscription_account] = await Promise.all([
    currentRecord<PortfolioRecords['portfolio']>(tx, 'portfolio', portfolioId),
    portfolioPart<PortfolioRecords['terms']>(tx, 'portfolio_terms', portfolioId),
    portfolioPart<PortfolioRecords['offer']>(tx, 'offer', portfolioId),
    portfolioPart<PortfolioRecords['asset']>(tx, 'asset', portfolioId),
    // A subscription account has no id of its own; it is kept under its portfolio's id.
    currentRecord<PortfolioRecords['subscription_account']>(tx, 'subscription_account', portfolioId),
  ]);
  if (!portfolio || !terms || !offer || !asset || !subscription_account) return undefined;
  return { portfolio, terms, offer, asset, subscription_account };
}

/**
 * The current version of every record of an entity, by id. With a portfolio, only the records that
 * belong to it: those whose portfolio_id is the portfolio, and those kept under its id.
 */
export async function listRecords(
  tx: Tx,
  entity: RecordEntity,
  portfolioId?: string,
): Promise<Array<{ id: string; version: number; data: Record<string, unknown> }>> {
  let q = tx
    .selectFrom('record_versions')
    .distinctOn('id')
    .select(['id', 'version', 'data'])
    .where('entity', '=', entity);
  if (portfolioId) {
    q = q.where((eb) => eb.or([eb(sql`data->>'portfolio_id'`, '=', portfolioId), eb('id', '=', portfolioId)]));
  }
  const rows = await q.orderBy('id').orderBy('version', 'desc').execute();
  return rows.map((r) => ({ id: r.id, version: r.version, data: r.data as Record<string, unknown> }));
}
