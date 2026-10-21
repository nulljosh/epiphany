import { describe, it, expect, beforeEach } from 'vitest';
import { put, list } from '../../server/api/_blob.js';

// Fake KV that pages two keys at a time, like the real one does at 1000.
function fakeKv() {
  const store = new Map();
  return {
    async put(name, value, { metadata } = {}) { store.set(name, { value, metadata }); },
    async list({ prefix, cursor }) {
      const names = [...store.keys()].filter((n) => n.startsWith(prefix)).sort();
      const start = cursor ? Number(cursor) : 0;
      const keys = names.slice(start, start + 2).map((name) => ({ name, metadata: store.get(name).metadata }));
      const done = start + 2 >= names.length;
      return { keys, list_complete: done, cursor: done ? undefined : String(start + 2) };
    },
  };
}

describe('_blob list', () => {
  beforeEach(() => { globalThis.__blobKv = fakeKv(); });

  it('walks every page and reports sizes', async () => {
    for (const k of ['a', 'b', 'c', 'd', 'e']) await put(`x/${k}`, 'hello');
    const { blobs } = await list({ prefix: 'x/' });
    expect(blobs).toHaveLength(5);
    expect(blobs.every((b) => b.size === 5)).toBe(true);
  });
});
