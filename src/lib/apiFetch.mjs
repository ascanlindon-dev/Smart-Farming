// Use the Vite proxy by default and keep session/CSRF handling in one place.
export async function apiFetch(input, options = {}) {
  const base = import.meta.env?.VITE_API_BASE || '';
  const url = typeof input === 'string' && input.startsWith('/api/') ? base + input : input;
  const method = (options.method || 'GET').toUpperCase();
  const headers = new Headers(options.headers);
  if (!['GET', 'HEAD', 'OPTIONS'].includes(method)) {
    const response = await fetch(base + '/api/csrf/', { credentials: 'include', signal: options.signal });
    if (!response.ok) throw new Error('Unable to initialize a secure request. Please retry.');
    const { csrfToken } = await response.json();
    headers.set('X-CSRFToken', csrfToken);
  }
  return fetch(url, { ...options, method, headers, credentials: 'include' });
}
