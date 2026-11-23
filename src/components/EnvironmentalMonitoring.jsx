import { useContext } from 'react';
import { LanguageContext } from '../LanguageContext';
import { translations } from '../translation';
import { useSensorReadings } from '../hooks/useSensorReadings';
import {
  Activity,
  AlertTriangle,
  CloudRain,
  Droplets,
  Lightbulb,
  RefreshCw,
  Thermometer,
} from 'lucide-react';

function SensorRangeGauge({ value, scaleMinimum, scaleMaximum, minimum, maximum, unit, labels, language }) {
  const markerPosition = value == null
    ? null
    : Math.max(0, Math.min(100, ((value - scaleMinimum) / (scaleMaximum - scaleMinimum)) * 100));
  const rangeStart = ((minimum - scaleMinimum) / (scaleMaximum - scaleMinimum)) * 100;
  const rangeWidth = ((maximum - minimum) / (scaleMaximum - scaleMinimum)) * 100;

  return (
    <div
      role="img"
      aria-label={language === 'tl'
        ? `Target na saklaw: ${minimum} hanggang ${maximum}${unit}${value == null ? ', walang kasalukuyang reading' : `, kasalukuyang ${value}${unit}`}`
        : `Target range: ${minimum} to ${maximum}${unit}${value == null ? ', no current reading' : `, current reading ${value}${unit}`}`}
    >
      <div className="relative h-3 rounded-full bg-amber-200">
        <span
          className="absolute inset-y-0 rounded-full bg-emerald-500"
          style={{ left: `${rangeStart}%`, width: `${rangeWidth}%` }}
        />
        {markerPosition !== null && (
          <span
            className="absolute -top-1 h-5 w-5 -translate-x-1/2 rounded-full border-2 border-white bg-[#1C1917] shadow"
            style={{ left: `${markerPosition}%` }}
          />
        )}
      </div>
      <div className="mt-2 grid grid-cols-3 gap-1 text-[10px] font-semibold leading-tight text-[#57534E] sm:text-[11px]">
        <span className="text-left">{labels[0]}</span>
        <span className="text-center text-[#14532D]">{labels[1]} · {minimum}–{maximum}{unit}</span>
        <span className="text-right">{labels[2]}</span>
      </div>
    </div>
  );
}

export default function EnvironmentalMonitoring() {
  const { language: lang } = useContext(LanguageContext);

  const L = {
    noData: translations[lang]?.noData || (lang === 'tl' ? 'Walang datos' : 'No data available'),
    humidity: translations[lang]?.humidity || (lang === 'tl' ? 'Kahalumigmigan' : 'Humidity'),
  };

  const { snapshot, loading, error, checkedAt, refresh } = useSensorReadings();

  const computeTemp = (tempVal) => {
    if (tempVal == null) return { label: L.noData, action: '' };
    if (tempVal < 24) return { label: lang === 'tl' ? 'Mababa sa target' : 'Below target', action: lang === 'tl' ? 'Bantayan ang bagong usbong at kondisyon ng puno' : 'Monitor new growth and overall tree condition' };
    if (tempVal <= 32) return { label: lang === 'tl' ? 'Normal' : 'Normal', action: lang === 'tl' ? 'Maayos ang temperatura ngayon' : 'Temperature is in a healthy range' };
    if (tempVal <= 36) return { label: lang === 'tl' ? 'Mainit' : 'Warm', action: lang === 'tl' ? 'Bantayan ang halumigmig ng lupa at kondisyon ng rambutan' : 'Monitor soil moisture and rambutan tree condition' };
    return { label: lang === 'tl' ? 'Napaka-init' : 'Very hot', action: lang === 'tl' ? 'Bawasan ang trabaho sa tanghali' : 'Avoid heavy field work at noon' };
  };

  const computeHumidity = (humidityVal) => {
    if (humidityVal == null) return { label: L.noData, action: '' };
    if (humidityVal < 65) return { label: lang === 'tl' ? 'Mababa sa target' : 'Below target', action: lang === 'tl' ? 'Bantayan ang pagkatuyo ng lupa at pagkalanta ng dahon' : 'Check soil dryness and watch for wilting leaves' };
    if (humidityVal <= 80) return { label: lang === 'tl' ? 'Nasa target' : 'In target', action: lang === 'tl' ? 'Nasa target ang halumigmig; patuloy na suriin ang mga dahon' : 'Humidity is within target; continue checking the leaves' };
    return { label: lang === 'tl' ? 'Masyadong mahalumigmig' : 'Too humid', action: lang === 'tl' ? 'Dagdagan ang airflow at bantayan ang kondisyon ng tanim' : 'Improve airflow and monitor overall crop condition' };
  };

  const computeWeather = (raining) => {
    if (raining == null) {
      return {
        label: lang === 'tl' ? 'Hindi matukoy' : 'Unverified',
        action: lang === 'tl'
          ? 'Raw sensor signal lamang ang available. I-verify sa firmware ang active LOW/HIGH bago ito bigyang-kahulugan bilang ulan.'
          : 'Only a raw sensor signal is available. Verify the firmware active LOW/HIGH logic before interpreting it as rain.',
      };
    }
    if (raining) {
      return {
        label: lang === 'tl' ? 'May ulan' : 'Raining',
        action: lang === 'tl'
          ? 'May aktuwal na ulan. Kung gagamit ng pesticide, sundin ang rainfast interval sa label; hindi ito rekomendasyong mag-apply.'
          : 'Rain is detected. If using a pesticide, follow its label rainfast interval; this is not a recommendation to apply.',
      };
    }
    return { label: lang === 'tl' ? 'Walang ulan' : 'No rain', action: lang === 'tl' ? 'Maayos ang kondisyon sa bukid' : 'Field conditions look stable' };
  };

  const displayedTemperature = snapshot.temperature ?? snapshot.lastTemperature;
  const displayedHumidity = snapshot.humidity ?? snapshot.lastHumidity;
  const displayedIsRaining = snapshot.isRaining ?? snapshot.lastIsRaining;
  const hasCurrentMeasurements = [snapshot.temperature, snapshot.humidity, snapshot.isRaining, snapshot.rainRaw].some((value) => value != null);
  const hasMeasurements = [displayedTemperature, displayedHumidity, displayedIsRaining, snapshot.lastRainRaw].some((value) => value != null);
  const hasStaleMeasurements = hasMeasurements && !hasCurrentMeasurements;
  const connecting = loading && checkedAt == null;
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

  const tempStat = computeTemp(snapshot.temperature);
  const humidityStat = computeHumidity(snapshot.humidity);
  const weatherStat = computeWeather(displayedIsRaining);
  const recommendationText = hasCurrentMeasurements
    ? [computeWeather(snapshot.isRaining).action, tempStat.action, humidityStat.action].filter(Boolean).join(' | ')
    : null;
  const outsideTarget = (value, minimum, maximum) => value != null && (value < minimum || value > maximum);
  const needsAttention = outsideTarget(snapshot.temperature, 24, 32)
    || outsideTarget(snapshot.humidity, 65, 80);
  const connectionTone = snapshot.status === 'recent' && hasMeasurements
    ? 'border-emerald-200 bg-emerald-50 text-[#14532D]'
    : error
      ? 'border-red-200 bg-red-50 text-red-800'
      : 'border-stone-200 bg-stone-100 text-stone-700';
  const temperatureBadgeTone = snapshot.temperature == null
    ? 'bg-stone-100 text-stone-700'
    : outsideTarget(snapshot.temperature, 24, 32)
      ? 'bg-amber-100 text-amber-900'
      : 'bg-emerald-100 text-emerald-900';
  const humidityBadgeTone = snapshot.humidity == null
    ? 'bg-stone-100 text-stone-700'
    : outsideTarget(snapshot.humidity, 65, 80)
      ? 'bg-amber-100 text-amber-900'
      : 'bg-emerald-100 text-emerald-900';
  const rainBadgeTone = snapshot.isRaining == null
    ? 'bg-stone-100 text-stone-700'
    : snapshot.isRaining
      ? 'bg-blue-100 text-blue-900'
      : 'bg-emerald-100 text-emerald-900';
  const connectionStateLabel = snapshot.status === 'recent' && hasMeasurements
    ? (lang === 'tl' ? 'May koneksyon' : 'Connected')
    : snapshot.status === 'error'
      ? (lang === 'tl' ? 'Hindi maabot' : 'Unavailable')
      : snapshot.status === 'stale'
        ? (lang === 'tl' ? 'Walang bagong reading' : 'No recent reading')
        : snapshot.status === 'unknown_time'
          ? (lang === 'tl' ? 'Hindi tiyak ang oras' : 'Timestamp unknown')
          : (lang === 'tl' ? 'Naghihintay ng datos' : 'Waiting for data');

  return (
    <section className="space-y-4 sm:space-y-5" aria-label={lang === 'tl' ? 'Pagsubaybay sa kapaligiran' : 'Environmental monitoring'}>
      <section aria-label={lang === 'tl' ? 'Koneksyon ng sensor' : 'Sensor connection'} className="sensor-connection rounded-3xl border border-stone-200 bg-white p-4 sm:p-5">
        <div className="flex min-w-0 items-start gap-3 sm:items-center">
          <span className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl ${connectionTone}`}>
            <Activity className="h-5 w-5" aria-hidden="true" />
          </span>
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <p role="status" className="font-bold text-[#1C1917]">{connectionTitle}</p>
              <span className={`rounded-full px-2.5 py-1 text-[11px] font-bold ${connectionTone}`}>
                {connectionStateLabel}
              </span>
            </div>
            <p className="mt-1 text-xs leading-relaxed text-[#57534E] sm:text-sm">{connectionDescription}</p>
            <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-[11px] text-[#57534E]">
              {snapshot.deviceId && <span>{lang === 'tl' ? 'Device' : 'Device'}: {snapshot.deviceId}</span>}
              {snapshot.receivedAt && (
                <span>{lang === 'tl' ? 'Huling reading' : 'Last reading'}: {new Date(snapshot.receivedAt).toLocaleString(lang === 'tl' ? 'fil-PH' : 'en-PH')}</span>
              )}
              {checkedAt && (
                <span>{lang === 'tl' ? 'Huling check' : 'Last checked'}: {new Date(checkedAt).toLocaleTimeString()}</span>
              )}
            </div>
          </div>
        </div>
        <button
          type="button"
          disabled={loading}
          onClick={refresh}
          className="sensor-refresh inline-flex items-center justify-center gap-2 rounded-2xl border border-stone-300 bg-[#FAF9F5] px-4 font-bold text-[#1C1917] transition hover:border-[#14532D] hover:text-[#14532D] disabled:cursor-wait disabled:opacity-60"
        >
          <RefreshCw className={`h-4 w-4 text-[#14532D] ${loading ? 'animate-spin' : ''}`} aria-hidden="true" />
          {loading ? (lang === 'tl' ? 'Naglo-load...' : 'Refreshing...') : (lang === 'tl' ? 'I-refresh' : 'Refresh sensors')}
        </button>
      </section>

      <section className={`flex flex-col gap-3 rounded-3xl border p-4 sm:flex-row sm:items-center sm:justify-between sm:p-5 ${
        needsAttention
          ? 'border-amber-200 bg-amber-50'
          : hasMeasurements
            ? 'border-emerald-200 bg-emerald-50'
            : 'border-stone-200 bg-white'
      }`}>
        <div className="flex items-start gap-3">
          <span className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl ${
            needsAttention ? 'bg-amber-100 text-amber-800' : 'bg-white/80 text-[#14532D]'
          }`}>
            {needsAttention ? <AlertTriangle className="h-5 w-5" aria-hidden="true" /> : <Lightbulb className="h-5 w-5" aria-hidden="true" />}
          </span>
          <div>
            <p className="text-[11px] font-bold uppercase tracking-wider text-[#14532D]">
              {lang === 'tl' ? 'Mga dapat gawin ngayon' : 'What to do today'}
            </p>
            <p className="mt-1 text-sm font-semibold leading-relaxed text-[#1C1917]">
              {recommendationText || (lang === 'tl' ? 'Hinihintay ang bagong sensor reading bago magbigay ng payo.' : 'Waiting for a current sensor reading before giving advice.')}
            </p>
          </div>
        </div>
      </section>

      <div className="environment-sensor-grid grid gap-4 sm:gap-5">
        <article className="flex min-w-0 flex-col justify-between gap-5 rounded-3xl border border-stone-200 bg-white p-5 sm:p-6">
          <div>
            <div className="flex items-center justify-between gap-3">
              <div className="flex min-w-0 items-center gap-3">
                <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-emerald-100 text-[#14532D]">
                  <Thermometer className="h-5 w-5" aria-hidden="true" />
                </span>
                <h3 className="truncate font-bold text-[#1C1917]">{lang === 'tl' ? 'Temperatura' : 'Temperature'}</h3>
              </div>
              <span className={`shrink-0 rounded-full px-2.5 py-1 text-[11px] font-bold ${temperatureBadgeTone}`}>{tempStat.label}</span>
            </div>
            <p className="mt-5 font-extrabold tracking-tight text-4xl text-[#1C1917]" style={{ fontFamily: "'Plus Jakarta Sans', sans-serif" }}>
              {displayedTemperature == null ? L.noData : `${Number(displayedTemperature).toFixed(1)}°C`}
            </p>
            <p className="mt-1 text-xs leading-relaxed text-[#57534E]">
              {hasStaleMeasurements && snapshot.temperature == null
                ? (lang === 'tl' ? 'Huling naka-save na sukat; hindi ito kasalukuyang reading.' : 'Last saved measurement; this is not a current reading.')
                : tempStat.action || (lang === 'tl' ? 'Target na saklaw: 24–32°C' : 'Target range: 24–32°C')}
            </p>
          </div>
          <SensorRangeGauge
            value={snapshot.temperature}
            scaleMinimum={16}
            scaleMaximum={40}
            minimum={24}
            maximum={32}
            unit="°C"
            language={lang}
            labels={lang === 'tl' ? ['Malamig', 'Ligtas', 'Mainit'] : ['Cool', 'Target', 'Hot']}
          />
        </article>

        <article className="flex min-w-0 flex-col justify-between gap-5 rounded-3xl border border-stone-200 bg-white p-5 sm:p-6">
          <div>
            <div className="flex items-center justify-between gap-3">
              <div className="flex min-w-0 items-center gap-3">
                <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-sky-100 text-sky-800">
                  <Droplets className="h-5 w-5" aria-hidden="true" />
                </span>
                <h3 className="truncate font-bold text-[#1C1917]">{L.humidity}</h3>
              </div>
              <span className={`shrink-0 rounded-full px-2.5 py-1 text-[11px] font-bold ${humidityBadgeTone}`}>{humidityStat.label}</span>
            </div>
            <p className="mt-5 font-extrabold tracking-tight text-4xl text-[#1C1917]" style={{ fontFamily: "'Plus Jakarta Sans', sans-serif" }}>
              {displayedHumidity == null ? L.noData : `${Number(displayedHumidity).toFixed(1)}%`}
            </p>
            <p className="mt-1 text-xs leading-relaxed text-[#57534E]">
              {hasStaleMeasurements && snapshot.humidity == null
                ? (lang === 'tl' ? 'Huling naka-save na sukat; hindi ito kasalukuyang reading.' : 'Last saved measurement; this is not a current reading.')
                : humidityStat.action || (lang === 'tl' ? 'Target na saklaw: 65–80%' : 'Target range: 65–80%')}
            </p>
          </div>
          <SensorRangeGauge
            value={snapshot.humidity}
            scaleMinimum={0}
            scaleMaximum={100}
            minimum={65}
            maximum={80}
            unit="%"
            language={lang}
            labels={lang === 'tl' ? ['Tuyo', 'Ligtas', 'Mahalumigmig'] : ['Dry', 'Target', 'Humid']}
          />
        </article>

        <article className="flex min-w-0 flex-col justify-between gap-5 rounded-3xl border border-stone-200 bg-white p-5 sm:p-6">
          <div>
            <div className="flex items-center justify-between gap-3">
              <div className="flex min-w-0 items-center gap-3">
                <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-blue-100 text-blue-800">
                  <CloudRain className="h-5 w-5" aria-hidden="true" />
                </span>
                <h3 className="truncate font-bold text-[#1C1917]">{lang === 'tl' ? 'Aktuwal na Pag-detect ng Ulan' : 'Actual Rain Detection'}</h3>
              </div>
              <span className={`shrink-0 rounded-full px-2.5 py-1 text-[11px] font-bold ${rainBadgeTone}`}>{weatherStat.label}</span>
            </div>
            <p className="mt-5 font-extrabold tracking-tight text-3xl text-[#1C1917]" style={{ fontFamily: "'Plus Jakarta Sans', sans-serif" }}>
              {displayedIsRaining == null && snapshot.rainRaw == null ? L.noData : weatherStat.label}
            </p>
            <p className="mt-1 text-xs leading-relaxed text-[#57534E]">
              {snapshot.status !== 'recent' && displayedIsRaining != null
                ? (lang === 'tl' ? 'Huling naka-save na status; hindi ito kasalukuyang reading.' : 'Last saved status; this is not a current reading.')
                : weatherStat.action || (lang === 'tl' ? 'Lalabas dito ang status kapag may sensor reading.' : 'The rain status appears when a sensor reading is available.')}
            </p>
          </div>
        </article>
      </div>

      <p className="text-[11px] leading-relaxed text-[#57534E]">
        {lang === 'tl'
          ? 'Gabay lamang ang target ranges. Patuloy na obserbahan ang mga puno at dahon.'
          : 'Target ranges are a guide. Continue observing the trees and leaves.'}
      </p>
    </section>
  );

}
