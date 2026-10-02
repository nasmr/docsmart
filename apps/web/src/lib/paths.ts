/** Reading and writing nested record values by dotted path ("directors.0.name"). */
export type Data = Record<string, unknown>;

const isObject = (v: unknown): v is Data => typeof v === 'object' && v !== null && !Array.isArray(v);

export function getPath(data: unknown, path: string): unknown {
  let at: unknown = data;
  for (const key of path.split('.')) {
    if (Array.isArray(at)) at = at[Number(key)];
    else if (isObject(at)) at = at[key];
    else return undefined;
  }
  return at;
}

/**
 * A copy of `data` with the value at `path` set. Undefined removes it, and any object left empty by
 * that. Objects and arrays along the way are copied, never changed.
 */
export function setPath<T>(data: T, path: string, value: unknown): T {
  if (value === undefined && getPath(data, path) === undefined) return data;
  const [key, ...rest] = path.split('.') as [string, ...string[]];
  let next = rest.length
    ? setPath(getPath(data, key) ?? (/^\d+$/.test(rest[0] as string) ? [] : {}), rest.join('.'), value)
    : value;
  if (value === undefined && isObject(next) && Object.keys(next).length === 0) next = undefined;
  if (Array.isArray(data)) {
    const copy = [...data];
    copy[Number(key)] = next;
    return copy as T;
  }
  const copy: Data = { ...(isObject(data) ? data : {}) };
  if (next === undefined) delete copy[key];
  else copy[key] = next;
  return copy as T;
}

/** True when nothing in it was entered: only empty strings, nulls, undefined and empty containers. */
export function isBlank(v: unknown): boolean {
  if (v === undefined || v === null || v === '') return true;
  if (Array.isArray(v)) return v.every(isBlank);
  if (isObject(v)) return Object.values(v).every(isBlank);
  return false;
}
