import { describe, expect, test } from 'vitest';
import { getPath, isBlank, setPath } from './paths.js';

describe('paths', () => {
  const data = { a: { b: 1 }, list: [{ name: 'x' }, { name: 'y' }] };

  test('get', () => {
    expect(getPath(data, 'a.b')).toBe(1);
    expect(getPath(data, 'list.1.name')).toBe('y');
    expect(getPath(data, 'a.b.c')).toBeUndefined();
    expect(getPath(data, 'missing.deep')).toBeUndefined();
  });

  test('set copies along the path and leaves the original alone', () => {
    const next = setPath(data, 'list.1.name', 'z');
    expect(next).toEqual({ a: { b: 1 }, list: [{ name: 'x' }, { name: 'z' }] });
    expect(data.list[1]?.name).toBe('y');
    expect(next.a).toBe(data.a);
    expect(Array.isArray(next.list)).toBe(true);
  });

  test('set creates what is missing, and undefined removes', () => {
    expect(setPath({}, 'x.y', 'v')).toEqual({ x: { y: 'v' } });
    expect(setPath({}, 'items.0.id', 'v')).toEqual({ items: [{ id: 'v' }] });
    expect(setPath({ x: { y: 'v', z: 1 } }, 'x.y', undefined)).toEqual({ x: { z: 1 } });
    expect(setPath({ x: { y: 'v' }, k: 1 }, 'x.y', undefined)).toEqual({ k: 1 });
    const same = { a: 1 };
    expect(setPath(same, 'b.c', undefined)).toBe(same);
  });

  test('blank', () => {
    expect(isBlank({ a: '', b: { c: undefined }, d: [] })).toBe(true);
    expect(isBlank({ a: false })).toBe(false);
    expect(isBlank({ a: 0 })).toBe(false);
    expect(isBlank({ a: { b: 'x' } })).toBe(false);
  });
});
