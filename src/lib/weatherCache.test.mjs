import assert from 'node:assert/strict';
import test from 'node:test';
import { readWeatherCache, writeWeatherCache } from './weatherCache.mjs';

const weatherData = {
  ok: true,
  forecast: [{ date: '2026-11-23', condition: 'Clear Sky' }],
  current: { condition: 'Clear Sky' },
};

test('weather cache is scoped by query and forecast duration and marked stale', () => {
  const query = `Cache test ${Date.now()}`;
  writeWeatherCache(query, 7, weatherData);

  const cached = readWeatherCache(query, 7);
  assert.equal(cached.source, 'browser_cache');
  assert.equal(cached.stale, true);
  assert.equal(cached.forecast[0].condition, 'Clear Sky');
  assert.equal(readWeatherCache(query, 3), null);
});

test('invalid API shapes are not persisted as weather data', () => {
  const query = `Invalid cache test ${Date.now()}`;
  writeWeatherCache(query, 7, { ok: true, forecast: [] });
  assert.equal(readWeatherCache(query, 7), null);
});
