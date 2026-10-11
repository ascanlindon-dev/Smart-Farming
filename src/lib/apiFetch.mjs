// Railway serves the frontend and API on the same origin. Vite proxies these
// same paths during development; no backend hostname belongs in the browser.
export async function apiFetch(input, options = {}) {
  if (typeof input !== 'string' || !input.startsWith('/api/')) {
    throw new TypeError('API requests must use a same-origin /api/ path.');
  }
  const method = (options.method || 'GET').toUpperCase();
  const headers = new Headers(options.headers);
  if (!['GET', 'HEAD', 'OPTIONS'].includes(method)) {
    const response = await fetch('/api/csrf/', { credentials: 'same-origin', signal: options.signal, cache: 'no-store' });
    if (!response.ok) throw new Error('Unable to initialize a secure request. Please retry.');
    const { csrfToken } = await response.json();
    if (!csrfToken) throw new Error('Unable to initialize a secure request. Please retry.');
    headers.set('X-CSRFToken', csrfToken);
  }
  return fetch(input, { ...options, method, headers, credentials: 'same-origin' });
}
