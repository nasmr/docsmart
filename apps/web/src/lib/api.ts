/**
 * The API client. Shapes come from @docsmart/schemas, the same contract the API serves. In
 * development the browser calls /api on the Vite server, which forwards to the API (vite.config.ts),
 * with a development token (VITE_DEV_TOKEN). Sign-in is not decided yet (decision 0005).
 */
import type {
  AssembledVersion,
  AssembleRequest,
  CreateDocument,
  DispositionRequest,
  DocumentList,
  DocumentResponse,
  ErrorResponse,
  FindingsResponse,
  RecordEntity,
  RecordList,
  SavedRecord,
  SubmissionPackage,
  TemplateVersion,
  VersionResponse,
} from '@docsmart/schemas';
import type { z } from 'zod';

export type Entity = z.infer<typeof RecordEntity>;
export type DocumentView = z.infer<typeof DocumentResponse>;
export type Version = z.infer<typeof VersionResponse>;
export type Finding = z.infer<typeof FindingsResponse>['findings'][number];
export type Template = z.infer<typeof TemplateVersion>;
export type Package = z.infer<typeof SubmissionPackage>;
export type ApiErrorBody = z.infer<typeof ErrorResponse>;
export type Assembly = z.input<typeof AssembleRequest>;
export type ListedRecord = z.infer<typeof RecordList>['records'][number];

export class ApiError extends Error {
  readonly status: number;
  readonly body: ApiErrorBody;

  constructor(status: number, body: ApiErrorBody) {
    super(body.message);
    this.name = 'ApiError';
    this.status = status;
    this.body = body;
  }
}

const TOKEN = import.meta.env.VITE_DEV_TOKEN as string | undefined;

async function call<T>(method: 'GET' | 'POST' | 'PUT', path: string, body?: unknown): Promise<T> {
  const res = await fetch(`/api${path}`, {
    method,
    headers: {
      ...(TOKEN ? { authorization: `Bearer ${TOKEN}` } : {}),
      ...(body === undefined ? {} : { 'content-type': 'application/json' }),
    },
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
  });
  if (res.status === 204) return undefined as T;
  const text = await res.text();
  let json: unknown;
  try {
    json = text ? JSON.parse(text) : undefined;
  } catch {
    json = undefined;
  }
  if (!res.ok) {
    const fallback: ApiErrorBody = {
      error: 'internal',
      message: res.status === 502 || res.status === 504 ? 'The API is not running.' : `HTTP ${res.status}`,
    };
    throw new ApiError(res.status, (json as ApiErrorBody | undefined)?.error ? (json as ApiErrorBody) : fallback);
  }
  return json as T;
}

const q = (params: Record<string, string | undefined>) => {
  const s = new URLSearchParams(Object.entries(params).filter((e): e is [string, string] => !!e[1])).toString();
  return s ? `?${s}` : '';
};

export const api = {
  records: (entity: Entity, portfolio_id?: string) =>
    call<z.infer<typeof RecordList>>('GET', `/records/${entity}${q({ portfolio_id })}`).then((r) => r.records),
  record: (entity: Entity, id: string) =>
    call<{ data: Record<string, unknown> }>('GET', `/records/${entity}/${id}`).then((r) => r.data),
  saveRecord: (entity: Entity, id: string, data: unknown) =>
    call<z.infer<typeof SavedRecord>>('PUT', `/records/${entity}/${id}`, data),

  templates: () => call<Template[]>('GET', '/templates'),

  documents: (filter: { scope?: 'umbrella' | 'portfolio'; portfolio_id?: string } = {}) =>
    call<z.infer<typeof DocumentList>>('GET', `/documents${q(filter)}`).then((r) => r.documents),
  document: (id: string) => call<DocumentView>('GET', `/documents/${id}`),
  createDocument: (body: z.infer<typeof CreateDocument>) => call<DocumentView>('POST', '/documents', body),
  assemble: (id: string, body: Assembly) =>
    call<z.infer<typeof AssembledVersion>>('POST', `/documents/${id}/versions`, body),
  version: (id: string, version: string) => call<Version>('GET', `/documents/${id}/versions/${version}`),
  findings: (id: string, version: string) =>
    call<z.infer<typeof FindingsResponse>>('GET', `/documents/${id}/versions/${version}/findings`).then(
      (r) => r.findings,
    ),
  dispose: (findingId: string, body: z.infer<typeof DispositionRequest>) =>
    call<void>('POST', `/findings/${encodeURIComponent(findingId)}/disposition`, body),
  markReady: (id: string) => call<Package>('POST', `/documents/${id}/ready`),
  package: (id: string) => call<Package>('GET', `/documents/${id}/package`),
  withdraw: (id: string, reason: string) => call<void>('POST', `/documents/${id}/withdraw`, { reason }),

  /** The Word rendering, saved by the browser. A fetch, not a link, because it needs the token. */
  async downloadWord(id: string, version: string): Promise<void> {
    const res = await fetch(`/api/documents/${id}/versions/${version}/word`, {
      headers: TOKEN ? { authorization: `Bearer ${TOKEN}` } : {},
    });
    if (!res.ok) throw new ApiError(res.status, { error: 'not_found', message: 'The Word file is not available.' });
    const url = URL.createObjectURL(await res.blob());
    const a = document.createElement('a');
    a.href = url;
    a.download = `${id}-${version}.docx`;
    a.click();
    URL.revokeObjectURL(url);
  },
};

export const message = (e: unknown) => (e instanceof Error ? e.message : String(e));
