/**
 * Template versions (build plan B3). Content is stored once and never changed; approval uses
 * @docsmart/template-library's rules, and the database allows only draft → approved → retired.
 */
import { audit } from '@docsmart/platform';
import {
  type Approver,
  approve,
  type Catalogue,
  contentHash,
  type TemplateTree,
  type TemplateVersionRecord,
} from '@docsmart/template-library';
import type { Actor, Tx } from './db/connect.js';

function toRecord(row: {
  id: string;
  template: string;
  class: string;
  version: number;
  jurisdictions: string[];
  content_hash: string;
  status: 'draft' | 'approved' | 'retired';
  approval: unknown;
  retirement: unknown;
}): TemplateVersionRecord {
  return {
    id: row.id,
    template: row.template,
    class: row.class,
    version: row.version,
    jurisdictions: row.jurisdictions,
    content_hash: row.content_hash,
    status: row.status,
    ...(row.approval ? { approval: row.approval as TemplateVersionRecord['approval'] & object } : {}),
    ...(row.retirement ? { retirement: row.retirement as TemplateVersionRecord['retirement'] & object } : {}),
  };
}

const COLUMNS = [
  'id',
  'template',
  'class',
  'version',
  'jurisdictions',
  'content_hash',
  'status',
  'approval',
  'retirement',
] as const;

/** Stores a draft template version. The hash is computed here, from the content. */
export async function storeTemplate(
  tx: Tx,
  who: Actor,
  t: { id: string; class: string; version: number; jurisdictions: string[]; tree: TemplateTree },
): Promise<TemplateVersionRecord> {
  const hash = contentHash(t.tree);
  await tx
    .insertInto('template_versions')
    .values({
      tenant_id: who.tenant_id,
      id: t.id,
      template: t.tree.template,
      class: t.class,
      version: t.version,
      jurisdictions: t.jurisdictions,
      content_hash: hash,
      content: JSON.stringify(t.tree),
      status: 'draft',
      approval: null,
      retirement: null,
    })
    .execute();
  await audit(tx, {
    tenant_id: who.tenant_id,
    actor: who.actor,
    action: 'template.stored',
    entity: 'template_version',
    entity_id: t.id,
    version_hash: hash,
  });
  return {
    id: t.id,
    template: t.tree.template,
    class: t.class,
    version: t.version,
    jurisdictions: t.jurisdictions,
    content_hash: hash,
    status: 'draft',
  };
}

export async function templateVersion(
  tx: Tx,
  id: string,
): Promise<{ record: TemplateVersionRecord; tree: TemplateTree } | undefined> {
  const row = await tx
    .selectFrom('template_versions')
    .select([...COLUMNS, 'content'])
    .where('id', '=', id)
    .executeTakeFirst();
  return row ? { record: toRecord(row), tree: row.content as TemplateTree } : undefined;
}

export async function templateVersions(tx: Tx): Promise<TemplateVersionRecord[]> {
  return (
    await tx
      .selectFrom('template_versions')
      .select([...COLUMNS])
      .execute()
  ).map(toRecord);
}

/** Approves a draft (DF-02). Refusals come from @docsmart/template-library's approve(). */
export async function approveTemplate(
  tx: Tx,
  who: Actor,
  id: string,
  catalogue: Catalogue,
  approver: Approver,
  at: string,
): Promise<TemplateVersionRecord> {
  const found = await templateVersion(tx, id);
  if (!found) throw new Error(`No template version ${id}.`);
  const approved = approve(found.record, found.tree, catalogue, approver, at, await templateVersions(tx));
  await tx
    .updateTable('template_versions')
    .set({ status: 'approved', approval: JSON.stringify(approved.approval) })
    .where('id', '=', id)
    .execute();
  await audit(tx, {
    tenant_id: who.tenant_id,
    actor: approver.lawyer_id,
    action: 'template.approved',
    entity: 'template_version',
    entity_id: id,
    version_hash: found.record.content_hash,
    details: { supersedes: approved.approval?.supersedes ?? null },
  });
  return approved;
}
