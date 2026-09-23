import assert from 'node:assert/strict';
import test from 'node:test';
import { sensorSnapshot, SENSOR_FRESHNESS_MS } from './sensorReadings.mjs';

const now = Date.parse('2026-09-17T08:00:00Z');
const recent = { received_at: '2026-09-17T07:59:50Z', device_id: 'wemos_d1r1' };

test('an empty response never creates sensor readings or assumes no rain', () => {
  for (const payload of [null, undefined, {}, [], 'invalid']) {
    const result = sensorSnapshot(payload, { now });
    assert.equal(result.status, 'empty');
    assert.equal(result.temperature, null);
    assert.equal(result.humidity, null);
    assert.equal(result.isRaining, null);
  }
});

test('real zero readings and a false rain flag are preserved', () => {
  const result = sensorSnapshot({ ...recent, temperature: 0, humidity: '0', isRaining: false }, { now });
  assert.equal(result.status, 'recent');
  assert.equal(result.temperature, 0);
  assert.equal(result.humidity, 0);
  assert.equal(result.isRaining, false);
});

test('a later response with missing fields does not reuse previous values', () => {
  const first = sensorSnapshot({ ...recent, temperature: 31, humidity: 75, isRaining: true }, { now });
  const next = sensorSnapshot({ ...recent, temperature: null, humidity: null, isRaining: null }, { now });
  assert.equal(first.temperature, 31);
  assert.equal(next.temperature, null);
  assert.equal(next.humidity, null);
  assert.equal(next.isRaining, null);
});

test('old readings are hidden while their device and last-reading time remain available', () => {
  const result = sensorSnapshot({ ...recent, received_at: '2026-08-15T07:31:38Z', temperature: 29, humidity: 68, rain: 0 }, { now });
  assert.equal(result.status, 'stale');
  assert.equal(result.deviceId, 'wemos_d1r1');
  assert.equal(result.receivedAt, '2026-08-15T07:31:38.000Z');
  assert.equal(result.temperature, null);
  assert.equal(result.humidity, null);
  assert.equal(result.isRaining, null);
});

test('an unchanged database row becomes stale even when fetching succeeds', () => {
  const data = { ...recent, temperature: 30 };
  assert.equal(sensorSnapshot(data, { now }).status, 'recent');
  const later = sensorSnapshot(data, { now: now + SENSOR_FRESHNESS_MS });
  assert.equal(later.status, 'stale');
  assert.equal(later.temperature, null);
});

test('a failed fetch hides previously available readings', () => {
  const result = sensorSnapshot({ ...recent, temperature: 31, humidity: 75, isRaining: true }, { now, requestFailed: true });
  assert.equal(result.status, 'error');
  assert.equal(result.temperature, null);
  assert.equal(result.humidity, null);
  assert.equal(result.isRaining, null);
  assert.equal(result.deviceId, 'wemos_d1r1');
});

test('missing, invalid, and far-future timestamps cannot claim current readings', () => {
  for (const received_at of [undefined, null, '', 'not a date', '2026-09-18T08:00:00Z']) {
    const result = sensorSnapshot({ temperature: 29, received_at }, { now });
    assert.equal(result.status, 'unknown_time');
    assert.equal(result.temperature, null);
  }
});

test('invalid values do not become zero or NaN measurements', () => {
  for (const value of ['', ' ', 'NaN', 'Infinity', Infinity, true, {}, []]) {
    const result = sensorSnapshot({ ...recent, temperature: value, humidity: value }, { now });
    assert.equal(result.temperature, null);
    assert.equal(result.humidity, null);
  }
});

test('rain flags and numeric aliases are read without inventing a rain amount', () => {
  const result = sensorSnapshot({ ...recent, temp_c: '30.5', relative_humidity: '72', is_raining: 'false' }, { now });
  assert.equal(result.temperature, 30.5);
  assert.equal(result.humidity, 72);
  assert.equal(result.isRaining, false);
  assert.equal(sensorSnapshot({ ...recent, rain: 1 }, { now }).isRaining, true);
  assert.equal(sensorSnapshot({ ...recent, rain: 0 }, { now }).isRaining, false);
  assert.equal(sensorSnapshot({ ...recent, rain: null }, { now }).isRaining, null);
});
