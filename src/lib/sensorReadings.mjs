export const SENSOR_FRESHNESS_MS = 2 * 60 * 1000;

function sensorNumber(value) {
  if (typeof value !== 'number' && typeof value !== 'string') return null;
  if (typeof value === 'string' && !value.trim()) return null;
  const number = Number(value);
  return Number.isFinite(number) ? number : null;
}

function sensorBoolean(value) {
  if (value === true || value === 1 || value === '1' || value === 'true') return true;
  if (value === false || value === 0 || value === '0' || value === 'false') return false;
  return null;
}

// A successful fetch can still return an old database row. Only recent,
// timestamped readings should appear as current measurements or drive advice.
export function sensorSnapshot(payload, { now = Date.now(), requestFailed = false } = {}) {
  const data = payload && typeof payload === 'object' && !Array.isArray(payload) ? payload : {};
  const timestamp = typeof data.received_at === 'string' ? Date.parse(data.received_at) : NaN;
  const receivedAt = Number.isFinite(timestamp) ? new Date(timestamp).toISOString() : null;
  const age = now - timestamp;
  let status;
  if (requestFailed) status = 'error';
  else if (!Object.keys(data).length) status = 'empty';
  else if (!receivedAt || age < -60000) status = 'unknown_time';
  else if (age > SENSOR_FRESHNESS_MS) status = 'stale';
  else status = 'recent';

  const current = status === 'recent';
  const rainRaw = sensorNumber(data.rainRaw ?? data.rain_raw ?? data.rain);
  const rainFlag = sensorBoolean(data.isRaining ?? data.is_raining);

  return {
    status,
    receivedAt,
    deviceId: typeof data.device_id === 'string' ? data.device_id.trim() : null,
    temperature: current ? sensorNumber(data.temperature ?? data.temp ?? data.temp_c ?? data.temperature_c) : null,
    humidity: current ? sensorNumber(data.humidity ?? data.hum ?? data.relative_humidity) : null,
    rainRaw: current ? rainRaw : null,
    // A raw sensor value has no rain meaning until the device reports its verified logic.
    isRaining: current ? rainFlag : null,
    lastTemperature: sensorNumber(data.temperature ?? data.temp ?? data.temp_c ?? data.temperature_c),
    lastHumidity: sensorNumber(data.humidity ?? data.hum ?? data.relative_humidity),
    lastRainRaw: rainRaw,
    lastIsRaining: rainFlag,
  };
}
