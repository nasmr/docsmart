/**
 * SVC-EVID: content-addressed evidence (build plan B1). Bytes live in object storage under their
 * SHA-256; the database holds what they are. Reading checks the bytes against their address, so
 * stored content that has been changed is detected, never returned.
 */
import { createHash } from 'node:crypto';
import {
  GetObjectCommand,
  HeadObjectCommand,
  NoSuchKey,
  NotFound,
  PutObjectCommand,
  S3Client,
} from '@aws-sdk/client-s3';
import type { Kysely } from 'kysely';
import { audit } from './audit.js';
import { type PlatformTables, platform } from './tables.js';

/** Where evidence bytes are kept. */
export interface ObjectStore {
  put(key: string, bytes: Uint8Array, mediaType: string): Promise<void>;
  /** Undefined when there is no such object. */
  get(key: string): Promise<Uint8Array | undefined>;
}

export const sha256 = (bytes: Uint8Array) => createHash('sha256').update(bytes).digest('hex');

/** Tenant first, then the hash split for listing; the hash alone identifies the content. */
export const storageKey = (tenantId: string, hash: string) => `${tenantId}/${hash.slice(0, 2)}/${hash}`;

export class EvidenceError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'EvidenceError';
  }
}

/** Stores bytes as evidence and returns their SHA-256. Storing the same bytes twice is harmless. */
export async function putEvidence<DB extends PlatformTables>(
  anyDb: Kysely<DB>,
  store: ObjectStore,
  e: { tenant_id: string; bytes: Uint8Array; media_type: string; created_by: string },
): Promise<string> {
  const db = platform(anyDb);
  const hash = sha256(e.bytes);
  const existing = await db.selectFrom('evidence').select('sha256').where('sha256', '=', hash).executeTakeFirst();
  if (existing) return hash;
  const key = storageKey(e.tenant_id, hash);
  // The object first: if the row then fails, an unreferenced object is harmless; the reverse is not.
  await store.put(key, e.bytes, e.media_type);
  await db
    .insertInto('evidence')
    .values({
      tenant_id: e.tenant_id,
      sha256: hash,
      media_type: e.media_type,
      size: e.bytes.length,
      storage_key: key,
      created_by: e.created_by,
    })
    .execute();
  await audit(db, {
    tenant_id: e.tenant_id,
    actor: e.created_by,
    action: 'evidence.stored',
    entity: 'evidence',
    entity_id: hash,
    details: { media_type: e.media_type, size: e.bytes.length },
  });
  return hash;
}

/** Reads evidence by its hash, checking the bytes still match it. */
export async function getEvidence<DB extends PlatformTables>(
  anyDb: Kysely<DB>,
  store: ObjectStore,
  hash: string,
): Promise<{ bytes: Uint8Array; media_type: string }> {
  const db = platform(anyDb);
  const row = await db
    .selectFrom('evidence')
    .select(['storage_key', 'media_type'])
    .where('sha256', '=', hash)
    .executeTakeFirst();
  if (!row) throw new EvidenceError(`No evidence ${hash}.`);
  const bytes = await store.get(row.storage_key);
  if (!bytes) throw new EvidenceError(`Evidence ${hash} is recorded but its content is missing from storage.`);
  if (sha256(bytes) !== hash) throw new EvidenceError(`Evidence ${hash} has been altered in storage.`);
  return { bytes, media_type: row.media_type };
}

/** S3-compatible storage (decision 0012): SeaweedFS locally (decision 0007). */
export class S3ObjectStore implements ObjectStore {
  private readonly client: S3Client;
  private readonly bucket: string;

  constructor(
    bucket: string,
    config: { endpoint: string; region: string; accessKeyId: string; secretAccessKey: string },
  ) {
    this.bucket = bucket;
    this.client = new S3Client({
      endpoint: config.endpoint,
      region: config.region,
      forcePathStyle: true,
      credentials: { accessKeyId: config.accessKeyId, secretAccessKey: config.secretAccessKey },
    });
  }

  async put(key: string, bytes: Uint8Array, mediaType: string): Promise<void> {
    await this.client.send(
      new PutObjectCommand({ Bucket: this.bucket, Key: key, Body: bytes, ContentType: mediaType }),
    );
  }

  async get(key: string): Promise<Uint8Array | undefined> {
    try {
      const r = await this.client.send(new GetObjectCommand({ Bucket: this.bucket, Key: key }));
      return r.Body ? new Uint8Array(await r.Body.transformToByteArray()) : undefined;
    } catch (e) {
      if (e instanceof NoSuchKey || e instanceof NotFound) return undefined;
      throw e;
    }
  }

  async exists(key: string): Promise<boolean> {
    try {
      await this.client.send(new HeadObjectCommand({ Bucket: this.bucket, Key: key }));
      return true;
    } catch (e) {
      if (e instanceof NotFound || (e as { name?: string }).name === 'NotFound') return false;
      throw e;
    }
  }

  destroy(): void {
    this.client.destroy();
  }
}

/** For tests and local work without object storage. */
export class MemoryObjectStore implements ObjectStore {
  readonly objects = new Map<string, Uint8Array>();

  async put(key: string, bytes: Uint8Array): Promise<void> {
    this.objects.set(key, new Uint8Array(bytes));
  }

  async get(key: string): Promise<Uint8Array | undefined> {
    const b = this.objects.get(key);
    return b ? new Uint8Array(b) : undefined;
  }
}
