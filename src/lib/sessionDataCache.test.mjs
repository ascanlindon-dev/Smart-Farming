import assert from 'node:assert/strict';
import { afterEach, describe, it } from 'node:test';
import {
  clearSessionDataCache,
  readSessionData,
  setSessionDataScope,
  writeSessionData,
} from './sessionDataCache.mjs';

class MemoryStorage {
  values = new Map();

  get length() {
    return this.values.size;
  }

  getItem(key) {
    return this.values.get(key) ?? null;
  }

  key(index) {
    return [...this.values.keys()][index] ?? null;
  }

  removeItem(key) {
    this.values.delete(key);
  }

  setItem(key, value) {
    this.values.set(key, value);
  }
}

const originalWindow = globalThis.window;

afterEach(() => {
  setSessionDataScope(null);
  if (originalWindow === undefined) delete globalThis.window;
  else globalThis.window = originalWindow;
});

describe('session data cache', () => {
  it('hydrates data only for the matching account and clears it on logout', () => {
    globalThis.window = { sessionStorage: new MemoryStorage() };
    setSessionDataScope('farmer@example.com');
    writeSessionData('/api/sensors/', { temperature: 28 });

    assert.deepEqual(readSessionData('/api/sensors/')?.data, { temperature: 28 });

    setSessionDataScope('other@example.com');
    assert.equal(readSessionData('/api/sensors/'), null);

    setSessionDataScope('farmer@example.com');
    clearSessionDataCache();
    assert.equal(readSessionData('/api/sensors/'), null);
  });

  it('ignores and removes malformed cache entries', () => {
    const storage = new MemoryStorage();
    globalThis.window = { sessionStorage: storage };
    setSessionDataScope('farmer@example.com');
    writeSessionData('/api/sensors/', { temperature: 28 });
    const cacheKey = storage.key(0);
    storage.setItem(cacheKey, '{invalid');
    const originalWarn = console.warn;
    console.warn = () => {};

    try {
      assert.equal(readSessionData('/api/sensors/'), null);
      assert.equal(storage.getItem(cacheKey), null);
    } finally {
      console.warn = originalWarn;
    }
  });
});
