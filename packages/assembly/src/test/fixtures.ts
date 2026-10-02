// Assembly inputs built from the Meridian Horizon fixtures and the first-pass templates.
import { readdirSync, readFileSync } from 'node:fs';
import {
  Party,
  type Party as PartyT,
  PortfolioRecords,
  Sponsor,
  SubscriptionRequest,
  type SubscriptionRequest as SubscriptionRequestT,
  Umbrella,
} from '@docsmart/domain';
import { importWord, type TemplateTree } from '@docsmart/template-library';
import { type AssemblyInput, assemble } from '../assemble.js';
import { type FieldCatalogue, FieldCatalogueSchema, type References } from '../resolve.js';

const repo = new URL('../../../../', import.meta.url);
const json = (path: string) => JSON.parse(readFileSync(new URL(path, repo), 'utf8'));
const fx = (path: string) => json(`fixtures/meridian-horizon/${path}`);

export const catalogue: FieldCatalogue = FieldCatalogueSchema.parse(json('templates/fields/catalogue.json'));

const umbrella = Umbrella.parse(fx('umbrella.json'));
const sponsor = Sponsor.parse(fx('sponsor.json'));
const portfolios = Object.fromEntries(
  ['lumen', 'atlas', 'atlas-ii'].map((f) => {
    const r = PortfolioRecords.parse(fx(`portfolios/${f}.json`));
    return [r.portfolio.id, r];
  }),
);
const parties: PartyT[] = fx('parties.json').map((p: unknown) => Party.parse(p));
const subscriptions: SubscriptionRequestT[] = [
  ...fx('subscriptions/atlas.json'),
  ...fx('subscriptions/lumen.json'),
].map((s: unknown) => SubscriptionRequest.parse(s));
const documents: Array<
  Record<string, unknown> & { id: string; class: string; portfolio_id?: string; inputs?: Record<string, unknown> }
> = fx('documents.json').documents;
const executed: Array<{ party_id: string; portfolio_id: string; ref: string; executed_date: string }> =
  fx('documents.json').executed;

const templateCache = new Map<string, TemplateTree>();
export async function template(id: string): Promise<TemplateTree> {
  const cached = templateCache.get(id);
  if (cached) return cached;
  const dir = 'templates/first-pass/';
  const name = readdirSync(new URL(dir, repo)).find((f) => f.startsWith(`${id}_`)) as string;
  const { tree } = await importWord(readFileSync(new URL(dir + name, repo)), id);
  templateCache.set(id, tree);
  return tree;
}

/** A placeholder: U3 is not drafted yet (decision 0004). */
export const U3_HASH = 'e'.repeat(64);

/** The assembly input for a fixture document, or for one investor's subscription agreement. */
export async function input(
  documentId: string,
  opts: { party?: string; template?: string } = {},
): Promise<AssemblyInput> {
  const doc = documents.find((d) => d.id === documentId);
  if (!doc) throw new Error(`no fixture document ${documentId}`);
  const portfolio = portfolios[doc.portfolio_id as string];
  const references: References = {};
  let inputs: Record<string, unknown> = { ...(doc.inputs ?? {}) };
  let party: PartyT | undefined;
  let subscription: SubscriptionRequestT | undefined;
  let templateId = opts.template ?? (doc.expected_template as string | undefined);

  if (doc.class === 'D13' || doc.class === 'D1-SP') {
    const d15 = documents.find((d) => d.class === 'D15' && d.portfolio_id === doc.portfolio_id);
    if (d15?.inputs) references.D15 = { date: d15.inputs.date as string };
  }
  if (doc.class === 'D1-SP') {
    party = parties.find((p) => p.id === opts.party);
    subscription = subscriptions.find((s) => s.party_id === opts.party && s.offer_id === portfolio?.offer.id);
    if (!party || !subscription) throw new Error(`no subscription by ${opts.party} in ${doc.portfolio_id}`);
    const perInvestor = (doc.per_investor_inputs as Array<{ party_id: string }> | undefined)?.find(
      (x) => x.party_id === party?.id,
    );
    inputs = { company_signatory_id: inputs.company_signatory_id, ...(perInvestor ?? {}) };
    const earlier = executed.find((e) => e.party_id === party?.id);
    if (earlier) {
      references.earlier_agreement = {
        portfolio_legal_name: portfolios[earlier.portfolio_id]?.portfolio.legal_name as string,
        executed_date: earlier.executed_date,
        ref: earlier.ref,
      };
    }
    templateId ??= earlier ? 'D1SP-C' : party.type === 'individual' ? 'D1SP-A' : 'D1SP-B';
    const u3 = documents.find((d) => d.class === 'U3');
    references.U3 = { version_label: u3?.version_label as string, content_hash: U3_HASH };
    // The supplement it is built on, assembled for real so its hash is the one recorded.
    const d13 = documents.find((d) => d.class === 'D13' && d.portfolio_id === doc.portfolio_id);
    if (d13) {
      const supplement = assemble(await input(d13.id));
      references.D13 = {
        supplement_number: d13.inputs?.supplement_number as number,
        date: d13.inputs?.date as string,
        content_hash: supplement.content_hash,
      };
    }
  }
  if (!templateId) throw new Error(`no template for ${documentId}`);
  return {
    template: await template(templateId),
    template_version_id: `${templateId}_v1`,
    catalogue,
    document: { id: opts.party ? `${documentId}_${opts.party}` : documentId, class: doc.class, inputs },
    records: {
      umbrella,
      sponsor,
      ...(portfolio ? { portfolio } : {}),
      ...(party ? { party } : {}),
      ...(subscription ? { subscription } : {}),
    },
    references,
  };
}

export const ATLAS_INVESTORS = subscriptions.filter((s) => s.offer_id === 'off_atlas_1').map((s) => s.party_id);
export const FIXTURE_DOCUMENTS = documents.filter((d) => d.expected_template).map((d) => d.id);
