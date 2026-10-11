import assert from 'node:assert/strict';
import test from 'node:test';
import { apiFetch } from './apiFetch.mjs';

test('table requests use the current origin and retain cancellation and cache options', async (t) => {
  const signal = new AbortController().signal;
  const response = Response.json({ results: [] });
  const fetch = t.mock.method(globalThis, 'fetch', async () => response);
  for (const path of ['/api/sensors/readings/?page_size=50', '/api/predictions/transactions/?page_size=50']) {
    assert.equal(await apiFetch(path, { signal, cache: 'no-store' }), response);
    const [url, options] = fetch.mock.calls.at(-1).arguments;
    assert.equal(url, path);
    assert.equal(options.credentials, 'same-origin');
    assert.equal(options.signal, signal);
    assert.equal(options.cache, 'no-store');
  }
  assert.equal(fetch.mock.callCount(), 2);
});

test('login obtains CSRF from the same origin and preserves the JSON body', async (t) => {
  const body = JSON.stringify({ credential: 'test-google-token' });
  const signal = new AbortController().signal;
  const fetch = t.mock.method(globalThis, 'fetch', async (url) =>
    Response.json(url === '/api/csrf/' ? { csrfToken: 'test-csrf' } : { email: 'farmer@example.test' }));
  await apiFetch('/api/auth/google/', { method: 'post', body, signal, headers: { 'Content-Type': 'application/json' } });
  assert.equal(fetch.mock.callCount(), 2);
  const [csrfUrl, csrfOptions] = fetch.mock.calls[0].arguments;
  assert.equal(csrfUrl, '/api/csrf/');
  assert.equal(csrfOptions.credentials, 'same-origin');
  assert.equal(csrfOptions.signal, signal);
  const [url, options] = fetch.mock.calls[1].arguments;
  assert.equal(url, '/api/auth/google/');
  assert.equal(options.method, 'POST');
  assert.equal(options.headers.get('X-CSRFToken'), 'test-csrf');
  assert.equal(options.headers.get('Content-Type'), 'application/json');
  assert.equal(options.body, body);
  assert.equal(options.credentials, 'same-origin');
});

test('photo uploads keep FormData so the browser supplies its multipart boundary', async (t) => {
  const body = new FormData();
  body.append('image', new Blob(['image'], { type: 'image/jpeg' }), 'leaf.jpg');
  const fetch = t.mock.method(globalThis, 'fetch', async () => Response.json({ csrfToken: 'test-csrf' }));
  await apiFetch('/api/predict_leaf/', { method: 'POST', body });
  const options = fetch.mock.calls[1].arguments[1];
  assert.equal(options.body, body);
  assert.equal(options.headers.has('Content-Type'), false);
  assert.equal(options.headers.get('X-CSRFToken'), 'test-csrf');
});

test('failed or empty CSRF responses stop the write request', async (t) => {
  for (const response of [new Response('', { status: 503 }), Response.json({})]) {
    const fetch = t.mock.method(globalThis, 'fetch', async () => response);
    await assert.rejects(apiFetch('/api/login/', { method: 'POST' }), /secure request/);
    assert.equal(fetch.mock.callCount(), 1);
    fetch.mock.restore();
  }
});

test('absolute backend URLs cannot send session data to a different server', async (t) => {
  const fetch = t.mock.method(globalThis, 'fetch', async () => Response.json({}));
  for (const path of ['https://old-backend.example.test/api/login/', '//old-backend.example.test/api/login/', 'api/login/']) {
    await assert.rejects(apiFetch(path, { method: 'POST' }), /same-origin/);
  }
  assert.equal(fetch.mock.callCount(), 0);
});
