import { apiFetch } from '../lib/apiFetch.mjs';
import { useContext, useEffect, useState } from 'react';
import { LanguageContext } from '../LanguageContext';
import { translations } from '../translation';
import { sensorSnapshot } from '../lib/sensorReadings.mjs';
import { Leaf3D, Lightbulb3D } from './Environmental3DIcons';

const SENSOR_REFRESH_INTERVAL_MS = 5000;
const SENSOR_REQUEST_TIMEOUT_MS = 10000;

export default function EnvironmentalMonitoring() {
  const { language: lang } = useContext(LanguageContext);

  const L = {
    noData: translations[lang]?.noData || (lang === 'tl' ? 'Walang datos' : 'No data available'),
    humidity: translations[lang]?.humidity || (lang === 'tl' ? 'Kahalumigmigan' : 'Humidity'),
  };

  const [iotData, setIotData] = useState(null);
  const [fetchState, setFetchState] = useState({ loading: true, error: false, checkedAt: null });
  const [refreshTick, setRefreshTick] = useState(0);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    const timerId = setTimeout(() => setLoaded(true), 80);
    return () => clearTimeout(timerId);
  }, []);

  const computeTemp = (tempVal) => {
    if (tempVal == null) return { label: L.noData, action: '' };
    if (tempVal < 20) return { label: lang === 'tl' ? 'Malamig' : 'Cold', action: lang === 'tl' ? 'Protektahan ang halaman sa lamig' : 'Protect crops from cold' };
    if (tempVal <= 32) return { label: lang === 'tl' ? 'Normal' : 'Normal', action: lang === 'tl' ? 'Maayos ang temperatura ngayon' : 'Temperature is in a healthy range' };
    if (tempVal <= 36) return { label: lang === 'tl' ? 'Mainit' : 'Warm', action: lang === 'tl' ? 'Bantayan ang halumigmig ng lupa at kondisyon ng rambutan' : 'Monitor soil moisture and rambutan tree condition' };
    return { label: lang === 'tl' ? 'Napaka-init' : 'Very hot', action: lang === 'tl' ? 'Bawasan ang trabaho sa tanghali' : 'Avoid heavy field work at noon' };
  };

  const computeHumidity = (humidityVal) => {
    if (humidityVal == null) return { label: L.noData, action: '' };
    if (humidityVal < 40) return { label: lang === 'tl' ? 'Masyadong tuyo' : 'Too dry', action: lang === 'tl' ? 'Bantayan ang pagkatuyo ng halaman at lupa' : 'Monitor plant and soil dryness' };
    if (humidityVal <= 75) return { label: lang === 'tl' ? 'Katamtaman' : 'Balanced', action: lang === 'tl' ? 'Magandang humidity para sa tanim' : 'Humidity is in a healthy range' };
    return { label: lang === 'tl' ? 'Masyadong mahalumigmig' : 'Too humid', action: lang === 'tl' ? 'Dagdagan ang airflow at bantayan ang kondisyon ng tanim' : 'Improve airflow and monitor overall crop condition' };
  };

   const computeWeather = (raining) => {
    if (raining == null) return { label: L.noData, action: '' };
    if (raining) {
      return { label: lang === 'tl' ? 'May ulan' : 'Raining', action: lang === 'tl' ? 'Iwasan muna ang pag-spray ng kemikal' : 'Avoid chemical spraying for now' };
    }
    return { label: lang === 'tl' ? 'Walang ulan' : 'No rain', action: lang === 'tl' ? 'Maayos ang kondisyon sa bukid' : 'Field conditions look stable' };
  };

  useEffect(() => {
    let mounted = true;
    let controller;
    let pollTimer;

    async function poll() {
      controller = new AbortController();
      const requestController = controller;
      const timeoutId = setTimeout(() => requestController.abort(), SENSOR_REQUEST_TIMEOUT_MS);
      setFetchState((previous) => ({ ...previous, loading: true }));
      try {
        const res = await apiFetch('/api/sensors/', { signal: requestController.signal, cache: 'no-store' });
        if (!res.ok) throw new Error('Sensor request failed');
        const j = await res.json();
        if (!j || typeof j !== 'object' || Array.isArray(j) || j.error) throw new Error('Invalid sensor response');
        if (!mounted) return;

        setIotData(j);
        setFetchState({ loading: false, error: false, checkedAt: Date.now() });
      } catch {
        if (mounted) setFetchState({ loading: false, error: true, checkedAt: Date.now() });
      } finally {
        clearTimeout(timeoutId);
        if (mounted) pollTimer = setTimeout(poll, SENSOR_REFRESH_INTERVAL_MS);
      }
    }

    poll();

    return () => {
      mounted = false;
      clearTimeout(pollTimer);
      controller?.abort();
    };
  }, [refreshTick]);

  const snapshot = sensorSnapshot(iotData, { requestFailed: fetchState.error });
  const displayedTemperature = snapshot.temperature;
  const displayedHumidity = snapshot.humidity;
  const displayedIsRaining = snapshot.isRaining;
  const hasMeasurements = [displayedTemperature, displayedHumidity, displayedIsRaining].some((value) => value != null);
  const connecting = fetchState.loading && fetchState.checkedAt == null;
  const connectionMessages = {
    recent: hasMeasurements
      ? [lang === 'tl' ? 'May bagong sensor reading' : 'Recent sensor reading', lang === 'tl' ? 'Konektado ang server at may bagong datos mula sa device.' : 'The server is connected and the device has sent a recent reading.']
      : [lang === 'tl' ? 'Walang measurements sa reading' : 'Measurements unavailable', lang === 'tl' ? 'May natanggap na reading, pero walang temperature, humidity, o rain measurement.' : 'A reading arrived without temperature, humidity, or rain measurements.'],
    empty: [lang === 'tl' ? 'Hinihintay ang unang reading' : 'Waiting for the first reading', lang === 'tl' ? 'Konektado ang server. Wala pang naipapadalang reading ang device.' : 'The server is connected. No device readings have been saved yet.'],
    stale: [lang === 'tl' ? 'Walang bagong reading mula sa device' : 'No recent device readings', lang === 'tl' ? 'Konektado ang server, pero mahigit dalawang minuto nang walang bagong reading mula sa device.' : 'The server is connected, but the device has not sent a reading in more than two minutes.'],
    error: [lang === 'tl' ? 'Hindi ma-load ang sensor readings' : 'Unable to fetch sensor readings', lang === 'tl' ? 'Hindi maabot ang sensor service. Tingnan ang koneksyon at subukang mag-refresh.' : 'The sensor service could not be reached. Check the connection and try refreshing.'],
    unknown_time: [lang === 'tl' ? 'Hindi matiyak ang oras ng reading' : 'Reading time unavailable', lang === 'tl' ? 'May sagot ang server pero hindi matiyak kung bago ang reading.' : 'The server responded, but this reading has no usable timestamp.'],
  };
  const [connectionTitle, connectionDescription] = connecting
    ? [lang === 'tl' ? 'Kumokonekta sa sensors...' : 'Connecting to sensors...', lang === 'tl' ? 'Kinukuha ang pinakabagong reading.' : 'Fetching the latest saved reading.']
    : connectionMessages[snapshot.status];

  const tempStat = computeTemp(displayedTemperature);
  const humidityStat = computeHumidity(displayedHumidity);
  const weatherStat = computeWeather(displayedIsRaining);
  const recommendationText = [weatherStat.action, tempStat.action, humidityStat.action].filter(Boolean).join(' | ');

  const cardClass = `mb-3 rounded-2xl p-4 shadow-sm transition-opacity transition-transform duration-400 sm:rounded-3xl sm:p-5 ${
    loaded ? 'translate-y-0 opacity-100' : 'translate-y-2 opacity-0'
  }`;
  const statHeaderClass = 'flex flex-wrap items-start justify-between gap-3 sm:items-center';
  const statTitleClass = 'text-base font-semibold tracking-wide sm:text-lg';
  const statValueClass = 'my-3 break-words text-3xl font-extrabold leading-tight text-white sm:text-[56px]';
  const statBadgeClass = 'shrink-0 rounded-full bg-white/20 px-3 py-1.5 text-sm font-medium sm:px-3.5 sm:text-base';
  const statActionClass = 'text-base leading-7 text-white/95 sm:text-lg';

  return (
    <>
    <div className="mx-auto max-w-4xl px-3 pb-16 pt-3 text-lg sm:px-6 sm:pb-24 sm:pt-4 sm:text-xl">
      <section aria-label={lang === 'tl' ? 'Koneksyon ng sensor' : 'Sensor connection'} className="sensor-connection mb-4 rounded-2xl border border-slate-200 bg-white p-4 text-sm text-slate-600">
        <div className="min-w-0 flex-1 wrap-break-word">
          <p role="status" className="font-semibold text-slate-900">{connectionTitle}</p>
          <p className="mt-1 leading-6">{connectionDescription}</p>
          {snapshot.deviceId && <p className="mt-2">{lang === 'tl' ? 'Device' : 'Device'}: {snapshot.deviceId}</p>}
          {snapshot.receivedAt && <p className="mt-1">{lang === 'tl' ? 'Huling reading' : 'Last device reading'}: {new Date(snapshot.receivedAt).toLocaleString()}</p>}
          {fetchState.checkedAt && <p className="mt-1 text-xs text-slate-500">{lang === 'tl' ? 'Huling pag-check' : 'Last checked'}: {new Date(fetchState.checkedAt).toLocaleTimeString()} · {lang === 'tl' ? 'Awtomatikong nagre-refresh bawat 5 segundo' : 'Refreshes every 5 seconds'}</p>}
        </div>
        <button type="button" disabled={fetchState.loading} onClick={() => setRefreshTick((value) => value + 1)} className="sensor-refresh rounded-lg border border-emerald-300 bg-white px-4 py-3 text-emerald-800 disabled:opacity-50">
          {fetchState.loading ? (lang === 'tl' ? 'Naglo-load...' : 'Refreshing...') : (lang === 'tl' ? 'I-refresh' : 'Refresh sensors')}
        </button>
      </section>
      <div className={cardClass} style={{ background: 'linear-gradient(180deg,#FF7A18,#FF4D00)', color: '#fff', boxShadow: '0 14px 40px rgba(255,90,0,0.12)' }}>
        <div className={statHeaderClass}>
          <div className="flex min-w-0 items-center gap-3">
            <div className="text-3xl sm:text-4xl">🌡️</div>
            <div className={statTitleClass}>{lang === 'tl' ? 'TEMPERATURA' : 'TEMPERATURE'}</div>
          </div>
          <span className={statBadgeClass}>{tempStat.label}</span>
        </div>
        <div className={statValueClass}>
          {displayedTemperature != null ? `${Number(displayedTemperature).toFixed(1)}°C` : L.noData}
        </div>
        <div className={statActionClass}>{tempStat.action}</div>
      </div>

      <div className={cardClass} style={{ background: 'linear-gradient(180deg,#10B981,#059669)', color: '#fff', boxShadow: '0 14px 40px rgba(6,95,70,0.08)' }}>
        <div className={statHeaderClass}>
          <div className="flex min-w-0 items-center gap-3">
            <div className="text-3xl sm:text-4xl">💧</div>
            <div className={statTitleClass}>{L.humidity}</div>
          </div>
          <span className={statBadgeClass}>{humidityStat.label}</span>
        </div>
        <div className={statValueClass}>{displayedHumidity != null ? `${Math.round(displayedHumidity)}%` : L.noData}</div>
        <div className={statActionClass}>{humidityStat.action}</div>
      </div>

      <div className={cardClass} style={{ background: 'linear-gradient(180deg,#0f172a,#071029)', color: '#fff', boxShadow: '0 14px 40px rgba(2,6,23,0.12)' }}>
        <div className={statHeaderClass}>
          <div className="flex min-w-0 items-center gap-3">
            <div className="text-3xl sm:text-4xl">🌤️</div>
            <div className={statTitleClass}>{lang === 'tl' ? 'SENSOR NG ULAN' : 'RAIN SENSOR'}</div>
          </div>
          <span className={statBadgeClass}>{weatherStat.label}</span>
        </div>
        <div className={statValueClass}>
          {displayedIsRaining == null ? L.noData : weatherStat.label}
        </div>
        <div className={statActionClass}>{weatherStat.action}</div>
      </div>

      <div className={`${cardClass} border border-emerald-100 bg-white`} style={{ boxShadow: '0 14px 40px rgba(16,185,129,0.08)' }}>
        <div>
          <div className="text-base font-semibold text-emerald-700 sm:text-lg">{lang === 'tl' ? 'Rekomendasyon' : 'Recommendation'}</div>
          <div className="mt-2 text-base leading-7 text-slate-700 sm:text-lg">
            {recommendationText || (lang === 'tl' ? 'Hinihintay ang bagong sensor reading bago magbigay ng payo.' : 'Waiting for a current sensor reading before giving advice.')}
          </div>
        </div>
      </div>

      <footer className="mt-4 px-2 text-center text-sm leading-6 text-gray-500 sm:text-base">© 2025 Smart Farming for Rambutan Cultivation</footer>
    </div>
    <div className="environment-status-grid mt-4 grid gap-4">
  {/* Farm Status */}
  <article className="relative overflow-hidden rounded-3xl border border-emerald-100 bg-linear-to-br from-emerald-50 to-green-100 p-6">
    <div className="absolute -bottom-3 -right-2 h-28 w-28 opacity-20">
      <Leaf3D />
    </div>

    <div className="mb-3 h-14 w-14 rounded-2xl bg-white/60 p-1.5">
      <Leaf3D />
    </div>

    <p className="text-xs font-bold tracking-wide text-emerald-700">
      {lang === 'tl' ? 'KALAGAYAN NG BUKID' : 'FARM STATUS'}
    </p>

    <p className="mt-1 text-2xl font-black text-emerald-950">
      {hasMeasurements ? (lang === 'tl' ? 'May sensor readings' : 'Readings available') : (lang === 'tl' ? 'Hinihintay ang datos' : 'Waiting for data')}
    </p>

    <p className="mt-1 text-sm text-emerald-700">
      {snapshot.status === 'recent'
        ? (lang === 'tl' ? 'Tingnan ang bawat sensor reading sa itaas.' : 'Review the available sensor readings above.')
        : (lang === 'tl' ? 'Walang kasalukuyang sensor data.' : 'Current sensor data is unavailable.')}
    </p>
  </article>

  {/* Recommendation */}
  <article className="flex items-center gap-4 rounded-3xl border border-amber-100 bg-white p-6 shadow-[0_2px_5px_rgba(15,23,42,.06)]">
    <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-amber-50 p-1.5">
      <Lightbulb3D />
    </div>

    <div>
      <p className="text-xs font-bold tracking-wide text-slate-500">
        {lang === 'tl' ? 'REKOMENDASYON' : 'RECOMMENDATION'}
      </p>

      <p className="mt-1 text-sm font-medium text-slate-700">
        {recommendationText ||
          (lang === 'tl'
            ? 'Hinihintay ang sensor data.'
            : 'Waiting for sensor data.')}
      </p>
    </div>
  </article>
</div>
    </>
  );

}
