/**
 * Builds the assembly input for a document from the database: the approved template, the current
 * records, and the documents it is built on (addendum §4.2).
 */
import type { AssemblyInput, FieldCatalogue, References } from '@docsmart/assembly';
import type { Party, PortfolioRecords, Sponsor, SubscriptionRequest, Umbrella } from '@docsmart/domain';
import type { AssembleRequest } from '@docsmart/schemas';
import type { z } from 'zod';
import type { Tx } from '../db/connect.js';
import type { Reference } from '../documents.js';
import { currentRecord, portfolioRecords } from '../records.js';
import { templateVersion } from '../templates.js';

export class NotFound extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'NotFound';
  }
}

type Request = z.infer<typeof AssembleRequest>;
type Snapshot = Array<{ field: string; item?: string; value: unknown }>;

/** A referenced document's version, with the values it was assembled with. */
async function referencedVersion(tx: Tx, pointer: { document_id: string; version_id: string }) {
  const row = await tx
    .selectFrom('draft_versions')
    .select(['content_hash', 'number', 'slot_snapshot'])
    .where('id', '=', pointer.version_id)
    .where('document_id', '=', pointer.document_id)
    .executeTakeFirst();
  if (!row) throw new NotFound(`No version ${pointer.version_id} of document ${pointer.document_id}.`);
  const value = (field: string) => (row.slot_snapshot as Snapshot).find((v) => v.field === field && !v.item)?.value;
  return { ...row, value };
}

export async function assemblyInput(
  tx: Tx,
  catalogue: FieldCatalogue,
  doc: { id: string; class: string; umbrella_id: string; portfolio_id: string | null },
  req: Request,
): Promise<{ input: AssemblyInput; references: Reference[] }> {
  const template = await templateVersion(tx, req.template_version_id);
  if (!template) throw new NotFound(`No template version ${req.template_version_id}.`);
  const umbrella = await currentRecord<Umbrella>(tx, 'umbrella', doc.umbrella_id);
  if (!umbrella) throw new NotFound(`No umbrella ${doc.umbrella_id}.`);
  const sponsor = await currentRecord<Sponsor>(tx, 'sponsor', umbrella.sponsor_id);
  if (!sponsor) throw new NotFound(`No sponsor ${umbrella.sponsor_id}.`);
  let portfolio: PortfolioRecords | undefined;
  if (doc.portfolio_id) {
    portfolio = await portfolioRecords(tx, doc.portfolio_id);
    if (!portfolio) {
      throw new NotFound(
        `Portfolio ${doc.portfolio_id} is missing a record (portfolio, terms, offer, asset or subscription account).`,
      );
    }
  }
  const party = req.party_id ? await currentRecord<Party>(tx, 'party', req.party_id) : undefined;
  if (req.party_id && !party) throw new NotFound(`No party ${req.party_id}.`);
  const subscription = req.subscription_id
    ? await currentRecord<SubscriptionRequest>(tx, 'subscription_request', req.subscription_id)
    : undefined;
  if (req.subscription_id && !subscription) throw new NotFound(`No subscription request ${req.subscription_id}.`);

  const references: References = {};
  const pointers: Reference[] = [];
  if (req.references.D13) {
    const d13 = await referencedVersion(tx, req.references.D13);
    references.D13 = {
      supplement_number: d13.value('portfolio.supplement_number') as number,
      date: d13.value('supplement.date') as string,
      content_hash: d13.content_hash,
    };
    pointers.push({ kind: 'D13', ...req.references.D13 });
  }
  if (req.references.U3) {
    const u3 = await referencedVersion(tx, req.references.U3);
    references.U3 = { version_label: String(u3.number), content_hash: u3.content_hash };
    pointers.push({ kind: 'U3', ...req.references.U3 });
  }
  if (req.references.D15) references.D15 = req.references.D15;
  if (req.references.earlier_agreement) references.earlier_agreement = req.references.earlier_agreement;

  return {
    input: {
      template: template.tree,
      template_version_id: template.record.id,
      catalogue,
      document: { id: doc.id, class: doc.class, inputs: req.inputs },
      records: {
        umbrella,
        sponsor,
        ...(portfolio ? { portfolio } : {}),
        ...(party ? { party } : {}),
        ...(subscription ? { subscription } : {}),
      },
      references,
    },
    references: pointers,
  };
}
