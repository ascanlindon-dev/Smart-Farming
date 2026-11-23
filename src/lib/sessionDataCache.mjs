const CACHE_VERSION = 1;
const CACHE_PREFIX = 'rambutech:data-cache:v1:';

let activeScope = null;

function getStorage() {
  if (typeof window === 'undefined') return null;
  try {
    return window.sessionStorage;
  } catch (error) {
    console.warn('Session data cache is unavailable.', error);
    return null;
  }
}

function scopedKey(key) {
  if (!activeScope || typeof key !== 'string' || !key) return null;
  return `${CACHE_PREFIX}${encodeURIComponent(activeScope)}:${encodeURIComponent(key)}`;
}

export function setSessionDataScope(identity) {
  const value = typeof identity === 'string' || typeof identity === 'number'
    ? String(identity).trim().toLowerCase()
    : '';
  activeScope = value || null;
}

export function readSessionData(key) {
  const storage = getStorage();
  const storageKey = scopedKey(key);
  if (!storage || !storageKey) return null;

  try {
    const saved = storage.getItem(storageKey);
    if (!saved) return null;
    const entry = JSON.parse(saved);
    if (entry?.version !== CACHE_VERSION || !Number.isFinite(entry.savedAt) || !('data' in entry)) {
      storage.removeItem(storageKey);
      return null;
    }
    return { data: entry.data, savedAt: entry.savedAt };
  } catch (error) {
    console.warn(`Could not read cached data for ${key}.`, error);
    try {
      storage.removeItem(storageKey);
    } catch (removeError) {
      console.warn(`Could not remove invalid cached data for ${key}.`, removeError);
    }
    return null;
  }
}

export function writeSessionData(key, data) {
  const storage = getStorage();
  const storageKey = scopedKey(key);
  if (!storage || !storageKey) return;

  try {
    storage.setItem(storageKey, JSON.stringify({
      version: CACHE_VERSION,
      savedAt: Date.now(),
      data,
    }));
  } catch (error) {
    console.warn(`Could not cache data for ${key}.`, error);
  }
}

export function clearSessionDataCache() {
  const storage = getStorage();
  if (!storage || !activeScope) return;

  const prefix = `${CACHE_PREFIX}${encodeURIComponent(activeScope)}:`;
  try {
    for (let index = storage.length - 1; index >= 0; index -= 1) {
      const key = storage.key(index);
      if (key?.startsWith(prefix)) storage.removeItem(key);
    }
  } catch (error) {
    console.warn('Could not clear the current account data cache.', error);
  }
}
