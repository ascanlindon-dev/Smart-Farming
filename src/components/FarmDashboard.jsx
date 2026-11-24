import { useContext, useEffect, useMemo, useRef, useState } from 'react';
import {
  AlertTriangle,
  ArrowRight,
  CheckCircle2,
  Cloud,
  CloudRain,
  Droplets,
  Leaf,
  MapPin,
  RefreshCw,
  ScanLine,
  ShieldCheck,
  Sprout,
  Sun,
  Thermometer,
  Wind,
} from 'lucide-react';
import { LanguageContext } from '../LanguageContext';
import { apiFetch } from '../lib/apiFetch.mjs';
import { analyzeDashboardTrend, dashboardTrendSummary } from '../lib/dashboardTrends.mjs';
import { sensorSnapshot } from '../lib/sensorReadings.mjs';
import { readSessionData, writeSessionData } from '../lib/sessionDataCache.mjs';
import { useWeather } from '../hooks/useWeather';

const DEFAULT_FARM_WEATHER_QUERY = 'Victoria, Oriental Mindoro, Philippines';
const DASHBOARD_SENSOR_KEY = '/api/sensors/';
const DASHBOARD_HISTORY_KEY = '/api/sensors/history/?range=7days';
const DASHBOARD_TRANSACTIONS_KEY = '/api/predictions/transactions/?page_size=5';

const numberOrNull = (value) => {
  if (value === null || value === undefined || String(value).trim() === '') return null;
  const number = Number(value);
  return Number.isFinite(number) ? number : null;
};

const formatMetric = (value, suffix = '', decimals = 1) => {
  const number = numberOrNull(value);
  return number == null ? '—' : `${number.toFixed(decimals)}${suffix}`;
};

const normalizeDiseaseLabel = (label) => {
  const text = String(label || '').trim().toLowerCase();
  if (!text) return null;
  if (text.includes('healthy')) return 'healthy';
  if (text.includes('algal')) return 'algal';
  if (text.includes('anthracnose') || text.includes('anthrac') || text.includes('antrac')) return 'anthracnose';
  if (text.includes('sooty')) return 'sooty';
  if (text.includes('unknown') || text.includes('not leaf')) return null;
  return text;
};

const normalizeMaturityLabel = (label) => {
  const text = String(label || '').trim().toLowerCase();
  if (!text) return null;
  if (text.includes('ripe') && !text.includes('unripe')) return 'ripe';
  if (text.includes('unripe') || text.includes('immature') || text.includes('young')) return 'unripe';
  if (text === 'mature') return 'ripe';
  return null;
};

const formatActivityTime = (value, language) => {
  if (!value) return language === 'tl' ? 'Walang petsa' : 'No date';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return language === 'tl' ? 'Walang petsa' : 'No date';
  return date.toLocaleString(language === 'tl' ? 'fil-PH' : 'en-PH', {
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  });
};

const getTemperatureTheme = (value, isTagalog) => {
  const temperature = numberOrNull(value);
  if (temperature == null) return {
    iconBg: 'bg-stone-100 text-stone-500',
    value: 'text-stone-500',
    note: isTagalog ? 'Walang kasalukuyang sensor data' : 'No current sensor data',
    icon: Thermometer,
  };
  if (temperature >= 36) return {
    iconBg: 'bg-red-100 text-red-700',
    value: 'text-red-800',
    note: isTagalog ? 'Mataas ang init — bantayan ang pananim' : 'Hot conditions — monitor the crops',
    icon: Sun,
  };
  if (temperature >= 30) return {
    iconBg: 'bg-amber-100 text-amber-700',
    value: 'text-amber-800',
    note: isTagalog ? 'Mainit ang kondisyon ng bukid' : 'Warm farm conditions',
    icon: Sun,
  };
  return {
    iconBg: 'bg-emerald-100 text-emerald-800',
    value: 'text-stone-900',
    note: isTagalog ? 'Naitalang temperatura ng bukid' : 'Recorded farm temperature',
    icon: Thermometer,
  };
};

const getHumidityTheme = (value, isTagalog) => {
  const humidity = numberOrNull(value);
  if (humidity == null) return {
    iconBg: 'bg-stone-100 text-stone-500',
    value: 'text-stone-500',
    note: isTagalog ? 'Walang kasalukuyang sensor data' : 'No current sensor data',
  };
  if (humidity >= 85) return {
    iconBg: 'bg-blue-100 text-blue-700',
    value: 'text-blue-800',
    note: isTagalog ? 'Mataas ang halumigmig' : 'High humidity',
  };
  if (humidity >= 75) return {
    iconBg: 'bg-cyan-100 text-cyan-700',
    value: 'text-cyan-800',
    note: isTagalog ? 'Medyo mataas ang halumigmig' : 'Slightly high humidity',
  };
  return {
    iconBg: 'bg-emerald-100 text-emerald-800',
    value: 'text-stone-900',
    note: isTagalog ? 'Naitalang halumigmig ng bukid' : 'Recorded farm humidity',
  };
};

const getWeatherTheme = (condition, temperature) => {
  const weatherText = String(condition || '').toLowerCase();
  const currentTemperature = numberOrNull(temperature);
  if (weatherText.includes('rain') || weatherText.includes('storm') || weatherText.includes('thunder')) {
    return { icon: CloudRain, iconColor: 'text-blue-700', iconBg: 'bg-blue-50' };
  }
  if (currentTemperature >= 35 || weatherText.includes('clear') || weatherText.includes('sun')) {
    return { icon: Sun, iconColor: 'text-amber-700', iconBg: 'bg-amber-50' };
  }
  if (weatherText.includes('cloud') || weatherText.includes('overcast')) {
    return { icon: Cloud, iconColor: 'text-stone-600', iconBg: 'bg-stone-100' };
  }
  return { icon: Cloud, iconColor: 'text-emerald-800', iconBg: 'bg-emerald-50' };
};

function MiniTrendChart({ data, metric, language }) {
  const analysis = useMemo(() => analyzeDashboardTrend(data, metric), [data, metric]);
  const { config, samples } = analysis;
  const hasMeasurements = analysis.measuredCount > 0;
  const observedValues = samples
    .map((sample) => sample.value)
    .filter((value) => value !== null);
  const domainMin = metric === 'temperature'
    ? Math.floor((Math.min(config.minimum, ...observedValues) - 5) / 5) * 5
    : Math.floor(Math.min(0, ...observedValues) / 20) * 20;
  const domainMax = metric === 'temperature'
    ? Math.ceil((Math.max(config.maximum, ...observedValues) + 5) / 5) * 5
    : Math.ceil(Math.max(100, ...observedValues) / 20) * 20;
  const tickStep = metric === 'temperature' ? 5 : 20;
  const domainRange = domainMax - domainMin;
  const ticks = [];
  for (let value = Math.ceil(domainMin / tickStep) * tickStep; value <= domainMax; value += tickStep) {
    ticks.push(value);
  }
  const bandTop = ((domainMax - config.maximum) / domainRange) * 100;
  const bandHeight = ((config.maximum - config.minimum) / domainRange) * 100;
  const title = metric === 'temperature'
    ? (language === 'tl' ? 'temperatura' : 'temperature')
    : (language === 'tl' ? 'halumigmig' : 'humidity');

  return (
    <div className="rounded-2xl border border-stone-200 bg-[#FAF9F5] p-3 sm:p-4">
      <div className="mb-3 flex flex-wrap items-start justify-between gap-2">
        <p role="status" className="max-w-3xl text-sm font-medium leading-relaxed text-[#1C1917]">
          {dashboardTrendSummary(data, metric, language)}
        </p>
        <span className={`shrink-0 rounded-full px-2.5 py-1 text-[11px] font-bold ${
          analysis.status === 'within'
            ? 'bg-emerald-100 text-emerald-900'
            : analysis.status === 'no-data'
              ? 'bg-stone-200 text-stone-700'
              : 'bg-amber-100 text-amber-900'
        }`}>
          {analysis.status === 'within'
            ? (language === 'tl' ? 'Nasa target' : 'In target')
            : analysis.status === 'mixed'
              ? (language === 'tl' ? 'May araw na lampas' : 'Some days outside')
            : analysis.status === 'no-data'
              ? (language === 'tl' ? 'Walang datos' : 'No data')
              : analysis.status === 'above'
                ? (language === 'tl' ? 'Lampas sa target' : 'Above target')
                : (language === 'tl' ? 'Mababa sa target' : 'Below target')}
        </span>
      </div>
      <div
        className="relative mt-3 h-48 sm:h-52"
        role="img"
        aria-label={language === 'tl' ? `7-araw na trend ng ${title}` : `7-day ${title} trend`}
      >
        <div className="absolute inset-x-0 top-0 bottom-7" aria-hidden="true">
          <div className="absolute inset-y-0 left-10 right-0 rounded-sm bg-white/70">
            <div
              className="absolute inset-x-0 border-y border-dashed border-emerald-700 bg-emerald-100/70"
              style={{ top: `${bandTop}%`, height: `${bandHeight}%` }}
            />
            <div className="absolute inset-0 grid grid-cols-7">
              {samples.map((sample, index) => {
                if (sample.value === null) {
                  return (
                    <div key={`${sample.label}-${index}`} className="relative h-full min-w-0">
                      <span className="absolute inset-x-0 bottom-1 text-center text-xs text-stone-400">—</span>
                    </div>
                  );
                }
                const valueHeight = Math.max(0, Math.min(100, ((sample.value - domainMin) / domainRange) * 100));
                const inTarget = sample.value >= config.minimum && sample.value <= config.maximum;
                return (
                  <div key={`${sample.label}-${index}`} className="relative h-full min-w-0">
                    <span
                      className={`absolute inset-x-0 bottom-0 mx-auto w-1/2 max-w-10 rounded-t-md ${
                        inTarget ? 'bg-[#15803D]' : 'bg-amber-600'
                      }`}
                      style={{ height: `${valueHeight}%` }}
                    />
                    <span
                      className="absolute inset-x-0 -translate-y-full text-center text-[10px] font-bold leading-none text-[#1C1917]"
                      style={{ bottom: `calc(${valueHeight}% + 4px)` }}
                    >
                      {Math.round(sample.value)}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>
          {ticks.map((tick) => {
            const position = ((domainMax - tick) / domainRange) * 100;
            return (
              <div key={tick} className="absolute inset-x-0" style={{ top: `${position}%` }}>
                <span className="absolute left-0 w-8 -translate-y-1/2 text-right text-[11px] font-semibold leading-none text-[#57534E]">
                  {tick}
                </span>
                <span className="absolute left-10 right-0 border-t border-dashed border-stone-300" />
              </div>
            );
          })}
        </div>
        <div className="absolute inset-x-10 bottom-0 grid h-6 grid-cols-7" aria-hidden="true">
          {samples.map((sample, index) => (
            <span key={`label-${sample.label}-${index}`} className="truncate text-center text-[11px] font-medium text-[#57534E]">
              {sample.label || `${language === 'tl' ? 'Araw' : 'Day'} ${index + 1}`}
            </span>
          ))}
        </div>
        {!hasMeasurements && (
          <p className="absolute inset-x-10 bottom-8 text-center text-xs font-medium text-[#57534E]">
            {language === 'tl' ? 'Wala pang sukat sa panahong ito.' : 'No readings for this period yet.'}
          </p>
        )}
      </div>
      <div className="mt-1 flex flex-wrap items-center justify-between gap-2 border-t border-stone-200 pt-2 text-xs text-stone-600">
        <span className="inline-flex items-center gap-2 font-semibold text-emerald-900">
          <span className="h-3 w-3 rounded-sm border border-emerald-700 bg-emerald-200" aria-hidden="true" />
          {language === 'tl' ? 'Target zone' : 'Target band'}: {config.minimum}–{config.maximum}{config.unit}
        </span>
        {!hasMeasurements && (
          <span>{language === 'tl' ? 'Lalabas ang linya kapag may readings.' : 'The trend line appears when readings are available.'}</span>
        )}
      </div>
    </div>
  );
}

function TrendDayStrip({ data, metric, language }) {
  const analysis = analyzeDashboardTrend(data, metric);
  const { config } = analysis;
  const [selectedIndex, setSelectedIndex] = useState(null);
  const samples = analysis.samples.slice(-7);
  const activeIndex = selectedIndex === null || selectedIndex >= samples.length
    ? samples.length - 1
    : selectedIndex;
  const activeSample = samples[activeIndex];
  const metricLabel = metric === 'temperature'
    ? (language === 'tl' ? 'Temperatura' : 'Temperature')
    : (language === 'tl' ? 'Halumigmig' : 'Humidity');
  const activeDayLabel = activeSample?.label || (language === 'tl' ? 'Araw' : 'Day');
  const activeInTarget = activeSample?.value !== null
    && activeSample?.value >= config.minimum
    && activeSample?.value <= config.maximum;
  const activeStatus = activeSample?.value === null || !activeSample
    ? (language === 'tl' ? 'Walang reading' : 'No reading')
    : activeInTarget
      ? (language === 'tl' ? 'Nasa target' : 'In target')
      : activeSample.value > config.maximum
        ? (language === 'tl' ? 'Mataas sa target' : 'Above target')
        : (language === 'tl' ? 'Mababa sa target' : 'Below target');

  return (
    <section className="rounded-2xl border border-stone-200 bg-[#FAF9F5] p-3.5 sm:p-4" aria-label={metricLabel}>
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <div>
          <h4 className="text-sm font-bold text-[#1C1917]">{metricLabel}</h4>
          <p className="mt-0.5 text-[11px] text-[#57534E]">
            {language === 'tl' ? 'Pumili ng araw para makita ang detalye' : 'Select a day to see its reading'}
          </p>
        </div>
        <span className="rounded-lg border border-stone-200 bg-white px-2.5 py-1 text-xs font-bold text-[#14532D]">
          {analysis.measuredCount
            ? (language === 'tl'
              ? `${analysis.inRangeCount}/${analysis.measuredCount} araw nasa target`
              : `${analysis.inRangeCount}/${analysis.measuredCount} days in target`)
            : (language === 'tl' ? 'Wala pang readings' : 'No readings yet')}
        </span>
      </div>
      {samples.length ? (
        <>
          <div className="grid grid-cols-4 gap-1.5 sm:grid-cols-7 sm:gap-2">
            {samples.map((sample, index) => {
              const inTarget = sample.value !== null
                && sample.value >= config.minimum
                && sample.value <= config.maximum;
              const outsideAbove = sample.value !== null && sample.value > config.maximum;
              const tone = sample.value === null
                ? 'border-stone-200 bg-white text-stone-500'
                : inTarget
                  ? 'border-emerald-200 bg-emerald-50 text-emerald-950'
                  : 'border-amber-200 bg-amber-50 text-amber-950';
              const dayLabel = sample.label ? sample.label.slice(0, 3) : `${language === 'tl' ? 'Araw' : 'Day'} ${index + 1}`;
              const statusLabel = sample.value === null
                ? (language === 'tl' ? 'Walang data' : 'No data')
                : inTarget
                  ? (language === 'tl' ? 'Nasa target' : 'In range')
                  : outsideAbove
                    ? (language === 'tl' ? 'Mataas' : 'High')
                    : (language === 'tl' ? 'Mababa' : 'Low');

              return (
                <button
                  type="button"
                  key={`${sample.label}-${index}`}
                  onClick={() => setSelectedIndex(index)}
                  aria-pressed={activeIndex === index}
                  aria-label={`${dayLabel}: ${sample.value === null ? statusLabel : `${Math.round(sample.value)}${config.unit}, ${statusLabel}`}`}
                  className={`min-w-0 rounded-xl border p-2 text-center transition focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#14532D] ${
                    activeIndex === index ? 'border-[#14532D] bg-white shadow-sm' : tone
                  }`}
                >
                  <span className="block truncate text-[11px] font-bold text-[#57534E]">{dayLabel}</span>
                  <span className="mt-1 block font-extrabold text-sm sm:text-base">
                    {sample.value === null ? '—' : `${Math.round(sample.value)}${config.unit}`}
                  </span>
                  <span className="mt-0.5 block truncate text-[10px] font-semibold">{statusLabel}</span>
                </button>
              );
            })}
          </div>
          <div className="mt-3 rounded-xl border border-stone-200 bg-white px-3 py-2 text-xs font-semibold text-[#14532D]" aria-live="polite">
            {activeDayLabel}: {activeSample?.value === null || !activeSample ? activeStatus : `${Math.round(activeSample.value)}${config.unit} · ${activeStatus}`}
          </div>
        </>
      ) : (
        <p className="rounded-xl border border-dashed border-stone-300 bg-white p-3 text-xs leading-relaxed text-[#57534E]">
          {dashboardTrendSummary(data, metric, language)}
        </p>
      )}
    </section>
  );
}

function WeeklyTakeaway({ temperatureData, humidityData, language }) {
  const isTagalog = language === 'tl';
  const temperature = analyzeDashboardTrend(temperatureData, 'temperature');
  const humidity = analyzeDashboardTrend(humidityData, 'humidity');
  const hasMeasurements = temperature.measuredCount > 0 || humidity.measuredCount > 0;
  const needsAttention = [temperature.status, humidity.status].some(
    (status) => ['above', 'below', 'mixed'].includes(status),
  );
  const Icon = !hasMeasurements ? Thermometer : needsAttention ? AlertTriangle : CheckCircle2;
  const tone = !hasMeasurements
    ? 'border-stone-200 bg-stone-50 text-stone-700'
    : needsAttention
      ? 'border-amber-200 bg-amber-50 text-amber-950'
      : 'border-emerald-200 bg-emerald-50 text-[#1C1917]';
  const iconTone = !hasMeasurements
    ? 'bg-stone-200 text-stone-700'
    : needsAttention
      ? 'bg-amber-100 text-amber-800'
      : 'bg-emerald-100 text-[#14532D]';

  return (
    <div className={`flex items-start gap-3 rounded-2xl border p-3.5 sm:p-4 ${tone}`}>
      <span className={`mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-xl ${iconTone}`}>
        <Icon className="h-5 w-5" aria-hidden="true" />
      </span>
      <div className="min-w-0">
        <p className="text-[11px] font-bold uppercase tracking-wider text-[#14532D]">
          {isTagalog ? 'Buod ng linggo' : 'Weekly takeaway'}
        </p>
        <p className="mt-1 text-xs font-semibold leading-relaxed sm:text-sm">
          {dashboardTrendSummary(temperatureData, 'temperature', language)}
        </p>
        <p className="mt-1 text-xs leading-relaxed sm:text-sm">
          {dashboardTrendSummary(humidityData, 'humidity', language)}
        </p>
      </div>
    </div>
  );
}

async function fetchDashboardResource(path, signal) {
  const response = await apiFetch(path, { signal, cache: 'no-store' });
  const payload = await response.json().catch(() => null);
  if (!response.ok) {
    throw new Error(payload?.error || `Request failed (HTTP ${response.status}).`);
  }
  if (!payload || typeof payload !== 'object') {
    throw new Error('The server returned an invalid response.');
  }
  return payload;
}

export default function FarmDashboard({ farmerName, location, notifications = [], onNavigate }) {
  const { language } = useContext(LanguageContext);
  const isTagalog = language === 'tl';
  const profileLocation = typeof location === 'string' ? location.trim() : '';
  const weatherQuery = profileLocation || DEFAULT_FARM_WEATHER_QUERY;
  const {
    weatherData,
    error: weatherError,
    loading: weatherLoading,
    refresh: refreshWeather,
  } = useWeather(weatherQuery, 3);
  const weatherLocation = weatherData?.resolved_location?.name
    ? [weatherData.resolved_location.name, weatherData.resolved_location.region].filter(Boolean).join(', ')
    : weatherQuery;
  const [initialCache] = useState(() => ({
    sensor: readSessionData(DASHBOARD_SENSOR_KEY),
    history: readSessionData(DASHBOARD_HISTORY_KEY),
    transactions: readSessionData(DASHBOARD_TRANSACTIONS_KEY),
  }));
  const [sensorData, setSensorData] = useState(initialCache.sensor?.data ?? null);
  const [temperatureHistory, setTemperatureHistory] = useState(
    () => initialCache.history?.data?.temperatureData || [],
  );
  const [humidityHistory, setHumidityHistory] = useState(
    () => initialCache.history?.data?.humidityData || [],
  );
  const [transactions, setTransactions] = useState(
    () => initialCache.transactions?.data?.results || [],
  );
  const [sensorFetchError, setSensorFetchError] = useState(false);
  const hasDisplayedData = useRef(Boolean(
    initialCache.sensor || initialCache.history || initialCache.transactions,
  ));
  const [loading, setLoading] = useState(!hasDisplayedData.current);
  const [sourceErrors, setSourceErrors] = useState([]);
  const [refreshToken, setRefreshToken] = useState(0);
  const [trendView, setTrendView] = useState('summary');

  useEffect(() => {
    let active = true;
    let inFlight = false;
    const controller = new AbortController();

    const loadDashboardData = async () => {
      if (inFlight) return;
      inFlight = true;
      const results = await Promise.allSettled([
        fetchDashboardResource('/api/sensors/', controller.signal),
        fetchDashboardResource('/api/sensors/history/?range=7days', controller.signal),
        fetchDashboardResource('/api/predictions/transactions/?page_size=5', controller.signal),
      ]);
      if (!active) return;

      const errors = [];
      const [sensorResult, historyResult, transactionResult] = results;
      if (sensorResult.status === 'fulfilled') {
        writeSessionData(DASHBOARD_SENSOR_KEY, sensorResult.value);
        setSensorData(sensorResult.value);
        setSensorFetchError(false);
        hasDisplayedData.current = true;
      } else {
        setSensorFetchError(true);
        errors.push(sensorResult.reason?.message || 'Unable to load sensor readings.');
      }
      if (historyResult.status === 'fulfilled') {
        writeSessionData(DASHBOARD_HISTORY_KEY, historyResult.value);
        setTemperatureHistory(Array.isArray(historyResult.value.temperatureData) ? historyResult.value.temperatureData : []);
        setHumidityHistory(Array.isArray(historyResult.value.humidityData) ? historyResult.value.humidityData : []);
        hasDisplayedData.current = true;
      } else {
        errors.push(historyResult.reason?.message || 'Unable to load sensor history.');
      }
      if (transactionResult.status === 'fulfilled') {
        writeSessionData(DASHBOARD_TRANSACTIONS_KEY, transactionResult.value);
        setTransactions(Array.isArray(transactionResult.value.results) ? transactionResult.value.results : []);
        hasDisplayedData.current = true;
      } else {
        errors.push(transactionResult.reason?.message || 'Unable to load recent activity.');
      }
      setSourceErrors(errors);
      setLoading(false);
      inFlight = false;
    };

    if (!hasDisplayedData.current) setLoading(true);
    void loadDashboardData();
    const intervalId = window.setInterval(loadDashboardData, 60_000);
    return () => {
      active = false;
      controller.abort();
      window.clearInterval(intervalId);
    };
  }, [refreshToken]);

  const snapshot = sensorSnapshot(sensorData || {}, { requestFailed: sensorFetchError });
  const currentTemperature = snapshot.temperature;
  const currentHumidity = snapshot.humidity;
  const displayedTemperature = currentTemperature ?? snapshot.lastTemperature;
  const displayedHumidity = currentHumidity ?? snapshot.lastHumidity;
  const displayedRain = snapshot.isRaining ?? snapshot.lastIsRaining;
  const activeAlerts = notifications.slice(0, 3);
  const hasHighAlert = notifications.some((notification) => notification.severity === 'high');
  const hasCurrentReadings = snapshot.status === 'recent';
  const health = hasHighAlert
    ? {
      label: isTagalog ? 'Kailangan ng pansin' : 'Needs attention',
      note: isTagalog ? 'May aktibong alert na nangangailangan ng pagsusuri' : 'An active alert needs review',
      tone: 'text-red-800',
      icon: AlertTriangle,
      iconBg: 'bg-red-100 text-red-700',
    }
    : notifications.length
      ? {
        label: isTagalog ? 'Bantayan' : 'Monitor',
        note: isTagalog ? 'Suriin ang mga aktibong alert' : 'Review the active alerts',
        tone: 'text-amber-800',
        icon: AlertTriangle,
        iconBg: 'bg-amber-100 text-amber-700',
      }
      : hasCurrentReadings
        ? {
          label: isTagalog ? 'Mabuti' : 'Good',
          note: isTagalog ? 'Walang aktibong alert' : 'No active alerts',
          tone: 'text-[#14532D]',
          icon: ShieldCheck,
          iconBg: 'bg-emerald-100 text-[#14532D]',
        }
        : {
          label: isTagalog ? 'Naghihintay ng data' : 'Awaiting data',
          note: isTagalog ? 'Wala pang kasalukuyang sensor readings' : 'No current sensor readings',
          tone: 'text-stone-600',
          icon: ShieldCheck,
          iconBg: 'bg-stone-100 text-stone-500',
        };
  const HealthIcon = health.icon;
  const currentWeather = weatherData?.current || null;
  const todayForecast = weatherData?.forecast?.[0] || null;
  const currentWeatherTemperature = numberOrNull(currentWeather?.temp);
  const temperatureTheme = getTemperatureTheme(currentTemperature, isTagalog);
  const humidityTheme = getHumidityTheme(currentHumidity, isTagalog);
  const weatherTheme = getWeatherTheme(currentWeather?.condition || todayForecast?.condition, currentWeatherTemperature);
  const TemperatureIcon = temperatureTheme.icon;
  const WeatherIcon = weatherTheme.icon;
  const lastUpdated = snapshot.receivedAt
    ? formatActivityTime(snapshot.receivedAt, language)
    : isTagalog ? 'Walang sensor update' : 'No sensor update';
  const latestLeaf = transactions.find((transaction) => transaction.prediction_type === 'leaf') || null;
  const latestFruit = transactions.find((transaction) => transaction.prediction_type === 'rambutan') || null;
  const diseaseStatus = normalizeDiseaseLabel(latestLeaf?.label);
  const maturityStatus = normalizeMaturityLabel(latestFruit?.label);
  const diseaseConfidence = numberOrNull(latestLeaf?.confidence);
  const maturityConfidence = numberOrNull(latestFruit?.confidence);
  const formatConfidence = (value) => {
    if (value == null) return null;
    const percent = value <= 1 ? value * 100 : value;
    return percent.toFixed(1);
  };
  const todayRainfall = numberOrNull(todayForecast?.rainfall);
  const todayRainChance = numberOrNull(todayForecast?.rainChance);
  const rainExpected = snapshot.isRaining === true
    || (todayRainChance !== null && todayRainChance >= 50)
    || (todayRainfall !== null && todayRainfall >= 1);
  const diseaseLabel = diseaseStatus
    ? (isTagalog
      ? ({
          healthy: 'Malusog na Dahon',
          algal: 'Algal Spot',
          anthracnose: 'Anthracnose',
          sooty: 'Sooty Mold',
        }[diseaseStatus] || latestLeaf.label)
      : ({
          healthy: 'Healthy Leaf',
          algal: 'Algal Spot',
          anthracnose: 'Anthracnose',
          sooty: 'Sooty Mold',
        }[diseaseStatus] || latestLeaf.label))
    : null;
  const maturityLabel = maturityStatus
    ? (maturityStatus === 'ripe'
      ? (isTagalog ? 'Hinog / Ripe' : 'Ripe')
      : (isTagalog ? 'Hindi pa Hinog / Unripe' : 'Unripe'))
    : null;

  const integratedRecommendations = [];
  if (maturityStatus === 'ripe') {
    integratedRecommendations.push(
      isTagalog
        ? 'Suriin ang aktuwal na bunga at kondisyon sa taniman bago isaalang-alang ang pag-aani.'
        : 'Inspect the actual fruit and field conditions before considering harvest.',
    );
  } else if (maturityStatus === 'unripe') {
    integratedRecommendations.push(
      isTagalog
        ? 'Patuloy na bantayan ang pagkahinog. Hindi awtomatikong handa ang buong taniman dahil sa isang scan.'
        : 'Continue monitoring maturity. A single scan does not mean the whole farm is ready for harvest.',
    );
  } else {
    integratedRecommendations.push(
      isTagalog
        ? 'Walang pinakabagong fruit maturity assessment; hindi mapagkakatiwalaang magpasiya ang pag-aani.'
        : 'No recent fruit maturity assessment is available; do not assume harvest readiness.',
    );
  }

  if (diseaseStatus && diseaseStatus !== 'healthy') {
    integratedRecommendations.push(
      isTagalog
        ? 'May nakitang sakit sa pinakabagong leaf scan. Bantayan ang apektadong halaman at kumonsulta sa agricultural expert kung kumalat o lumala.'
        : 'A disease was detected in the latest leaf scan. Monitor affected plants and consult an agricultural expert if symptoms spread or worsen.',
    );
  } else if (diseaseStatus === 'healthy') {
    integratedRecommendations.push(
      isTagalog
        ? 'Ang pinakabagong leaf scan ay malusog; patuloy na mag-monitor para sa bagong sintomas.'
        : 'The latest leaf scan is healthy; continue monitoring for new symptoms.',
    );
  } else {
    integratedRecommendations.push(
      isTagalog
        ? 'Walang pinakabagong disease scan; hindi maipaliwanag nang direkta ang epekto sa bunga.'
        : 'No recent disease scan is available; disease impact on fruit cannot be assumed.',
    );
  }

  if (rainExpected) {
    integratedRecommendations.push(
      isTagalog
        ? 'Posible o may inaasahang ulan. Sa anumang pesticide, suriin ang rainfast interval at pansamantalang ipagpaliban ang pag-spray kung kaya nitong mabawasan ang epekto; sundin ang produkto at safety label.'
        : 'Rain is detected or expected. For any pesticide, check the rainfast interval and consider postponing spraying if rain may reduce effectiveness; follow the product and safety label.',
    );
  } else if (snapshot.status === 'recent') {
    integratedRecommendations.push(
      isTagalog
        ? 'Walang ulan na nadedetect sa pinakabagong sensor at forecast. Suriin pa rin ang produkto at angkop na weather bago mag-spray.'
        : 'No rain is detected in the latest sensor or forecast. Still check the product label and suitable weather conditions before spraying.',
    );
  }

  const refreshDashboard = () => {
    setRefreshToken((value) => value + 1);
    if (weatherQuery) refreshWeather();
  };

  return (
    <section className="space-y-4 sm:space-y-5" aria-labelledby="farm-dashboard-title">
      <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-end">
        <div>
          <p className="text-sm font-bold tracking-tight text-[#14532D]">
            {isTagalog ? 'Magandang araw,' : 'Welcome,'} {farmerName || (isTagalog ? 'Magsasaka' : 'Farmer')}
          </p>
          <h2 id="farm-dashboard-title" className="mt-1 font-extrabold tracking-tight text-[#1C1917] text-2xl sm:text-3xl">
            {isTagalog ? 'Buod ng iyong bukid' : 'Your farm at a glance'}
          </h2>
          <p className="mt-2 inline-flex items-center gap-1.5 text-xs text-[#57534E] sm:text-sm">
            <MapPin className="h-4 w-4 shrink-0 text-[#14532D]" aria-hidden="true" />
            {weatherLocation}
            <span className="mx-1 text-stone-300">|</span>
            <span>{isTagalog ? 'Sensor update:' : 'Sensor update:'} {lastUpdated}</span>
          </p>
        </div>
      </div>

      {sourceErrors.length > 0 && (
        <div role="alert" className="flex flex-col gap-3 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-950 sm:flex-row sm:items-center sm:justify-between">
          <p>{isTagalog ? 'May ilang datos mula sa database na hindi ma-load.' : 'Some database-backed dashboard data could not be loaded.'} {sourceErrors.join(' ')}</p>
          <button type="button" onClick={refreshDashboard} className="inline-flex min-h-10 shrink-0 items-center justify-center gap-2 rounded-xl border border-amber-300 bg-white px-3 font-semibold hover:bg-amber-100">
            <RefreshCw className="h-4 w-4" aria-hidden="true" />
            {isTagalog ? 'Subukan muli' : 'Retry'}
          </button>
        </div>
      )}

      <div className="dashboard-primary-grid grid gap-4 sm:gap-5">
        <section className="dashboard-weather-card flex flex-col justify-between rounded-3xl border border-stone-200 bg-white p-5 sm:p-6" aria-labelledby="dashboard-weather-title">
          <div className="flex items-start justify-between gap-4">
            <div className="min-w-0">
              <span id="dashboard-weather-title" className="inline-block max-w-full rounded-lg bg-emerald-100 px-2.5 py-1 text-[11px] font-bold uppercase tracking-wider text-[#14532D]">
                {isTagalog ? 'Panahon ngayon' : 'Current weather'}
              </span>
              <div className="mt-3 flex flex-wrap items-baseline gap-x-3 gap-y-1">
                <span className="font-extrabold tracking-tight text-[#1C1917] text-4xl sm:text-5xl">
                  {currentWeatherTemperature == null ? '—' : `${Math.round(currentWeatherTemperature)}°C`}
                </span>
                <span className="text-sm font-semibold text-[#57534E]">
                  {currentWeather?.condition || todayForecast?.condition || (
                    weatherLoading
                      ? (isTagalog ? 'Naglo-load...' : 'Loading weather...')
                      : weatherQuery
                        ? (isTagalog ? 'Walang available na forecast' : 'No forecast available')
                        : (isTagalog ? 'Magdagdag ng lokasyon sa profile para sa forecast' : 'Add a farm location to your profile for a forecast')
                  )}
                </span>
              </div>
              <p className="mt-1 text-xs text-[#57534E]">
                {weatherLocation}
              </p>
            </div>
            <span className={`flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl border border-stone-200 ${weatherTheme.iconBg}`}>
              <WeatherIcon className={`h-7 w-7 ${weatherTheme.iconColor}`} aria-hidden="true" />
            </span>
          </div>

          {weatherError && (
            <p role="status" className="mt-3 rounded-xl bg-amber-50 px-3 py-2 text-xs leading-relaxed text-amber-900">
              {isTagalog ? 'Hindi makuha ang live weather; ipapakita lamang ang naka-save na datos kung mayroon.' : 'Live weather is unavailable; saved data is shown only when available.'}
            </p>
          )}

          <div className="mt-5 grid grid-cols-3 gap-2.5 border-t border-stone-200 pt-4 sm:gap-3">
            <div className="rounded-2xl border border-stone-200 bg-[#FAF9F5] p-3">
              <div className="flex items-center gap-1.5 text-xs font-semibold text-[#57534E]"><Wind className="h-4 w-4 text-[#14532D]" aria-hidden="true" />{isTagalog ? 'Hangin' : 'Wind'}</div>
              <p className="mt-1 font-bold text-[#1C1917]">{formatMetric(currentWeather?.wind, ' kph')}</p>
            </div>
            <div className="rounded-2xl border border-stone-200 bg-[#FAF9F5] p-3">
              <div className="flex items-center gap-1.5 text-xs font-semibold text-[#57534E]"><Droplets className="h-4 w-4 text-[#14532D]" aria-hidden="true" />{isTagalog ? 'Halumigmig' : 'Humidity'}</div>
              <p className="mt-1 font-bold text-[#1C1917]">{formatMetric(currentWeather?.humidity, '%', 0)}</p>
            </div>
            <div className="rounded-2xl border border-stone-200 bg-[#FAF9F5] p-3">
              <div className="flex items-center gap-1.5 text-xs font-semibold text-[#57534E]"><CloudRain className="h-4 w-4 text-[#14532D]" aria-hidden="true" />{isTagalog ? 'Ulan sa forecast' : "Today's rain forecast"}</div>
              <p className="mt-1 font-bold text-[#1C1917]">{formatMetric(todayForecast?.rainfall, ' mm')}</p>
            </div>
          </div>
        </section>

        <section className="dashboard-alerts-card flex flex-col justify-between rounded-3xl border border-stone-200 bg-white p-5 sm:p-6" aria-labelledby="dashboard-alerts-title">
          <div>
            <div className="flex items-center justify-between gap-2">
              <span className="text-xs font-bold uppercase tracking-wider text-[#57534E]">
                {activeAlerts.length
                  ? (isTagalog ? 'Kailangan ng pansin' : 'Needs attention')
                  : (isTagalog ? 'Kalagayan ng bukid' : 'Farm status')}
              </span>
              <span className={`rounded-full px-2.5 py-1 text-xs font-bold ${
                hasHighAlert
                  ? 'bg-red-100 text-red-800'
                  : notifications.length
                    ? 'bg-amber-100 text-amber-900'
                    : 'bg-emerald-100 text-emerald-900'
              }`}>
                {notifications.length} {isTagalog ? 'alert' : `alert${notifications.length === 1 ? '' : 's'}`}
              </span>
            </div>
            <h3 id="dashboard-alerts-title" className="mt-2 font-extrabold text-lg text-[#1C1917]">
              {activeAlerts.length
                ? (isTagalog ? 'Mga alert sa bukid' : 'Farm alerts')
                : hasCurrentReadings
                  ? (isTagalog ? 'Walang kailangang aksyon' : 'Orchard status clear')
                  : (isTagalog ? 'Naghihintay ng datos' : 'Waiting for farm data')}
            </h3>
            <p className="mt-0.5 text-xs leading-relaxed text-[#57534E] sm:text-sm">
              {activeAlerts.length
                ? (isTagalog ? 'Pumili ng alert para buksan ang kaugnay na bahagi.' : 'Select an alert to open its related section.')
                : hasCurrentReadings
                  ? (isTagalog ? 'Walang aktibong alert mula sa kasalukuyang datos.' : 'No active alerts from current readings.')
                  : (isTagalog ? 'Lalabas dito ang mga alert kapag may bagong sensor data.' : 'Alerts will appear when new sensor data is available.')}
            </p>
          </div>

          {activeAlerts.length ? (
            <div className={`mt-4 divide-y rounded-2xl px-3 ${
              hasHighAlert ? 'divide-red-100 border border-red-100 bg-red-50/70' : 'divide-amber-100 border border-amber-100 bg-amber-50/70'
            }`}>
              {activeAlerts.map((alert) => (
                <button
                  type="button"
                  key={alert.id}
                  onClick={() => onNavigate?.(alert.tab)}
                  className="flex min-h-16 w-full items-start gap-3 py-3 text-left"
                >
                  <span className={`mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-xl ${alert.severity === 'high' ? 'bg-red-100 text-red-700' : 'bg-amber-100 text-amber-800'}`}>
                    <AlertTriangle className="h-5 w-5" aria-hidden="true" />
                  </span>
                  <span className="min-w-0 flex-1">
                    <strong className="block text-sm text-[#1C1917]">{alert.title}</strong>
                    <span className="mt-0.5 block text-xs leading-relaxed text-[#57534E]">{alert.description}</span>
                  </span>
                  <ArrowRight className="mt-1 h-4 w-4 shrink-0 text-[#57534E]" aria-hidden="true" />
                </button>
              ))}
            </div>
          ) : (
            <div className="mt-4 flex min-h-16 items-center gap-3 rounded-2xl border border-stone-200 bg-[#FAF9F5] p-4">
              <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-emerald-100 text-[#14532D]">
                <CheckCircle2 className="h-5 w-5" aria-hidden="true" />
              </span>
              <p className="text-sm font-semibold text-[#1C1917]">
                {hasCurrentReadings ? (isTagalog ? 'Walang aktibong alert ngayon.' : 'No active alerts right now.') : (isTagalog ? 'Wala pang sapat na datos para sa status.' : 'Not enough data to determine status yet.')}
              </p>
            </div>
          )}
        </section>
      </div>

      <section className="space-y-3" aria-labelledby="dashboard-sensor-readings-title">
        <div>
          <h3 id="dashboard-sensor-readings-title" className="font-extrabold text-lg text-[#1C1917]">
            {isTagalog ? 'Kalagayan at mga reading ng sensor' : 'Farm status and sensor readings'}
          </h3>
          <p className="mt-1 text-xs text-[#57534E]">
            {isTagalog ? 'Kalusugan ng bukid at pinakahuling sukat ng sensor.' : 'Farm health and the latest sensor measurements.'}
          </p>
        </div>
        <div className="dashboard-sensor-grid grid gap-4 sm:gap-5">
          <section className="flex items-center justify-between gap-4 rounded-3xl border border-[#E2ECE6] bg-white p-5">
            <div>
              <p className="text-xs font-bold uppercase tracking-wider text-[#57534E]">{isTagalog ? 'Kalusugan ng bukid' : 'Farm health'}</p>
              <p className={`mt-1 font-extrabold text-2xl ${health.tone}`}>{health.label}</p>
              <p className="mt-1 text-xs text-[#57534E]">{health.note}</p>
            </div>
            <span className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl ${health.iconBg}`}><HealthIcon className="h-6 w-6" aria-hidden="true" /></span>
          </section>
          <section className="flex items-center justify-between gap-4 rounded-3xl border border-[#E2ECE6] bg-white p-5">
            <div>
              <p className="text-xs font-bold uppercase tracking-wider text-[#57534E]">{isTagalog ? 'Temperatura' : 'Temperature'}</p>
              <p className={`mt-1 font-extrabold text-3xl ${temperatureTheme.value}`}>{formatMetric(displayedTemperature, '°C')}</p>
              <p className="mt-1 text-xs text-[#57534E]">
                {snapshot.status !== 'recent' && snapshot.lastTemperature != null
                  ? (isTagalog ? 'Huling naka-save na sukat; hindi kasalukuyang reading.' : 'Last saved measurement; not a current reading.')
                  : loading ? (isTagalog ? 'Kinukuha ang data...' : 'Loading database readings...') : temperatureTheme.note}
              </p>
            </div>
            <span className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl ${temperatureTheme.iconBg}`}><TemperatureIcon className="h-6 w-6" aria-hidden="true" /></span>
          </section>
          <section className="flex items-center justify-between gap-4 rounded-3xl border border-[#E2ECE6] bg-white p-5">
            <div>
              <p className="text-xs font-bold uppercase tracking-wider text-[#57534E]">{isTagalog ? 'Halumigmig' : 'Humidity'}</p>
              <p className={`mt-1 font-extrabold text-3xl ${humidityTheme.value}`}>{formatMetric(displayedHumidity, '%')}</p>
              <p className="mt-1 text-xs text-[#57534E]">
                {snapshot.status !== 'recent' && snapshot.lastHumidity != null
                  ? (isTagalog ? 'Huling naka-save na sukat; hindi kasalukuyang reading.' : 'Last saved measurement; not a current reading.')
                  : loading ? (isTagalog ? 'Kinukuha ang data...' : 'Loading database readings...') : humidityTheme.note}
              </p>
            </div>
            <span className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl ${humidityTheme.iconBg}`}><Droplets className="h-6 w-6" aria-hidden="true" /></span>
          </section>
          <section className="flex items-center justify-between gap-4 rounded-3xl border border-[#E2ECE6] bg-white p-5">
            <div>
              <p className="text-xs font-bold uppercase tracking-wider text-[#57534E]">{isTagalog ? 'Ulan sa sensor' : 'Rain sensor'}</p>
              <p className="mt-1 font-extrabold text-xl text-[#1C1917]">
                {displayedRain === true
                  ? (isTagalog ? 'May ulan' : 'Rain detected')
                  : displayedRain === false
                    ? (isTagalog ? 'Walang ulan' : 'No rain detected')
                    : snapshot.status === 'stale'
                      ? (isTagalog ? 'Walang bagong reading' : 'No recent reading')
                      : (isTagalog ? 'Hindi available' : 'Unavailable')}
              </p>
              {snapshot.status !== 'recent' && displayedRain != null && (
                <p className="mt-1 text-xs text-[#57534E]">
                  {isTagalog ? 'Huling naka-save na status; hindi kasalukuyang reading.' : 'Last saved status; not a current reading.'}
                </p>
              )}
              <p className="mt-1 text-xs text-[#57534E]">
                {snapshot.receivedAt
                  ? `${isTagalog ? 'Huling reading' : 'Latest reading'}: ${formatActivityTime(snapshot.receivedAt, language)}`
                  : (isTagalog ? 'Walang sensor reading' : 'No sensor reading')}
              </p>
            </div>
            <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-blue-100 text-blue-700"><CloudRain className="h-6 w-6" aria-hidden="true" /></span>
          </section>
        </div>
      </section>

      <section className="space-y-3" aria-labelledby="dashboard-crop-checks-title">
        <div>
          <h3 id="dashboard-crop-checks-title" className="font-extrabold text-lg text-[#1C1917]">
            {isTagalog ? 'Mga pagsusuri sa pananim at ani' : 'Crop and harvest checks'}
          </h3>
          <p className="mt-1 text-xs text-[#57534E]">
            {isTagalog ? 'Pinakabagong resulta ng dahon at bunga; tingnan ang aktuwal na halaman bago magpasya.' : 'Latest leaf and fruit results; check the actual plant before making decisions.'}
          </p>
        </div>
        <div className="dashboard-crop-grid grid gap-4 sm:gap-5">
        <article className="rounded-3xl border border-stone-200 bg-white p-5 sm:p-6">
          <div className="flex items-center justify-between gap-3">
            <div>
              <p className="text-xs font-bold uppercase tracking-wider text-[#57534E]">{isTagalog ? 'Pinakabagong sakit sa dahon' : 'Latest leaf disease'}</p>
              <h3 className="mt-1 font-extrabold text-lg text-[#1C1917]">{diseaseLabel || (isTagalog ? 'Walang scan' : 'No scan yet')}</h3>
            </div>
            <span className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl ${diseaseStatus && diseaseStatus !== 'healthy' ? 'bg-amber-100 text-amber-800' : 'bg-emerald-100 text-[#14532D]'}`}>
              <Leaf className="h-5 w-5" aria-hidden="true" />
            </span>
          </div>
          <p className="mt-3 text-sm leading-relaxed text-[#57534E]">
            {diseaseStatus && diseaseStatus !== 'healthy'
              ? (isTagalog ? 'Bantayan ang apektadong halaman at ang epekto nito sa kalusugan at kalidad ng bunga.' : 'Monitor the affected plant and its possible effect on plant health and fruit quality.')
              : diseaseStatus === 'healthy'
                ? (isTagalog ? 'Walang nakikitang sakit sa pinakabagong leaf scan.' : 'No clear disease was detected in the latest leaf scan.')
                : (isTagalog ? 'Walang pinakabagong leaf disease assessment.' : 'No recent leaf disease assessment is available.')}
          </p>
          {latestLeaf && (
            <p className="mt-2 text-xs font-semibold text-[#57534E]">
              {isTagalog ? 'Kumpiyansa' : 'Confidence'}: {formatConfidence(diseaseConfidence) == null ? (isTagalog ? 'Wala' : 'Unavailable') : `${formatConfidence(diseaseConfidence)}%`}
            </p>
          )}
          <button type="button" onClick={() => onNavigate?.('disease')} className="mt-4 inline-flex min-h-10 items-center gap-1.5 text-xs font-bold text-[#14532D] hover:underline">
            {isTagalog ? 'Buksan ang Leaf Disease' : 'Open Leaf Disease'} <ArrowRight className="h-3.5 w-3.5" aria-hidden="true" />
          </button>
        </article>

        <article className="rounded-3xl border border-stone-200 bg-white p-5 sm:p-6">
          <div className="flex items-center justify-between gap-3">
            <div>
              <p className="text-xs font-bold uppercase tracking-wider text-[#57534E]">{isTagalog ? 'Pinakabagong maturity scan' : 'Latest maturity scan'}</p>
              <h3 className="mt-1 font-extrabold text-lg text-[#1C1917]">{maturityLabel || (isTagalog ? 'Walang scan' : 'No scan yet')}</h3>
            </div>
            <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-emerald-100 text-[#14532D]">
              <Sprout className="h-5 w-5" aria-hidden="true" />
            </span>
          </div>
          <p className="mt-3 text-sm leading-relaxed text-[#57534E]">
            {maturityStatus === 'ripe'
              ? (isTagalog ? 'Isang bunga ang naklasipika bilang ripe. Suriin ang aktuwal na bunga bago anihin.' : 'A fruit was classified as ripe. Inspect the actual fruit before harvesting.')
              : maturityStatus === 'unripe'
                ? (isTagalog ? 'Patuloy na bantayan ang bunga; hindi nito pinapahiwatig na handa ang buong taniman.' : 'Continue monitoring the fruit; this does not indicate the whole farm is ready.')
                : (isTagalog ? 'Walang pinakabagong fruit maturity assessment.' : 'No recent fruit maturity assessment is available.')}
          </p>
          {latestFruit && (
            <p className="mt-2 text-xs font-semibold text-[#57534E]">
              {isTagalog ? 'Kumpiyansa' : 'Confidence'}: {formatConfidence(maturityConfidence) == null ? (isTagalog ? 'Wala' : 'Unavailable') : `${formatConfidence(maturityConfidence)}%`}
            </p>
          )}
          <button type="button" onClick={() => onNavigate?.('maturity')} className="mt-4 inline-flex min-h-10 items-center gap-1.5 text-xs font-bold text-[#14532D] hover:underline">
            {isTagalog ? 'Buksan ang Maturity' : 'Open Maturity Assessment'} <ArrowRight className="h-3.5 w-3.5" aria-hidden="true" />
          </button>
        </article>

        </div>
      </section>

      <div className="dashboard-detail-grid grid gap-4 sm:gap-5">
        <section className="dashboard-trend-card rounded-3xl border border-stone-200 bg-white p-5 sm:p-6" aria-labelledby="dashboard-trend-title">
          <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
            <div>
              <h3 id="dashboard-trend-title" className="font-extrabold text-lg text-[#1C1917]">
                {isTagalog ? '7-araw na kalagayan ng taniman' : '7-day orchard condition'}
              </h3>
              <p className="mt-1 text-xs leading-relaxed text-[#57534E]">
                {isTagalog
                  ? 'Buod ng temperatura at halumigmig, kasama ang gabay na saklaw at epekto nito sa rambutan.'
                  : 'A plain-language view of temperature and humidity, their target bands, and possible effects on rambutan.'}
              </p>
            </div>
            <div className="inline-flex max-w-full items-center rounded-xl border border-stone-200 bg-[#FAF9F5] p-1" role="group" aria-label={isTagalog ? 'Ipakita ang trend' : 'Trend display mode'}>
              <button
                type="button"
                onClick={() => setTrendView('summary')}
                aria-pressed={trendView === 'summary'}
                className={`min-h-9 rounded-lg px-2.5 text-xs font-bold transition sm:px-3 ${
                  trendView === 'summary' ? 'bg-[#14532D] text-white shadow-sm' : 'text-[#57534E] hover:text-[#1C1917]'
                }`}
              >
                {isTagalog ? '7-araw na buod' : '7-day summary'}
              </button>
              <button
                type="button"
                onClick={() => setTrendView('chart')}
                aria-pressed={trendView === 'chart'}
                className={`min-h-9 rounded-lg px-2.5 text-xs font-bold transition sm:px-3 ${
                  trendView === 'chart' ? 'bg-[#14532D] text-white shadow-sm' : 'text-[#57534E] hover:text-[#1C1917]'
                }`}
              >
                {isTagalog ? 'Tsart ng ligtas na saklaw' : 'Safe-zone chart'}
              </button>
            </div>
          </div>
          {trendView === 'summary' ? (
            <div className="space-y-3.5">
              <WeeklyTakeaway
                temperatureData={temperatureHistory}
                humidityData={humidityHistory}
                language={language}
              />
              <TrendDayStrip data={temperatureHistory} metric="temperature" language={language} />
              <p className="text-[11px] leading-relaxed text-[#57534E]">
                {isTagalog
                  ? 'Gabay lamang ang target bands; hindi ito diagnosis. Patuloy na obserbahan ang mga puno at dahon.'
                  : 'Target bands are guides, not a diagnosis. Continue observing the trees and leaves.'}
              </p>
            </div>
          ) : (
            <div className="space-y-4">
              <section aria-labelledby="dashboard-temperature-trend-title">
                <h4 id="dashboard-temperature-trend-title" className="mb-2 text-sm font-bold text-[#1C1917]">
                  {isTagalog ? 'Temperatura' : 'Temperature'}
                </h4>
                <MiniTrendChart data={temperatureHistory} metric="temperature" language={language} />
              </section>
              <section aria-labelledby="dashboard-humidity-trend-title">
                <h4 id="dashboard-humidity-trend-title" className="mb-2 text-sm font-bold text-[#1C1917]">
                  {isTagalog ? 'Halumigmig' : 'Humidity'}
                </h4>
                <MiniTrendChart data={humidityHistory} metric="humidity" language={language} />
              </section>
            </div>
          )}
        </section>

        <section className="dashboard-activity-card rounded-3xl border border-stone-200 bg-white p-5 sm:p-6" aria-labelledby="dashboard-activity-title">
          <div className="mb-3 flex items-center justify-between gap-2">
            <h3 id="dashboard-activity-title" className="font-extrabold text-lg text-[#1C1917]">
              {isTagalog ? 'Kamakailang aktibidad' : 'Recent activity'}
            </h3>
            <button type="button" onClick={() => onNavigate?.('analytics')} className="inline-flex items-center gap-1 text-xs font-bold text-[#14532D] hover:underline">
              {isTagalog ? 'Tingnan lahat' : 'View all'} <ArrowRight className="h-3.5 w-3.5" aria-hidden="true" />
            </button>
          </div>
          {transactions.length ? (
            <div className="divide-y divide-stone-200">
              {transactions.slice(0, 3).map((transaction) => {
                const isLeaf = transaction.prediction_type === 'leaf';
                const ActivityIcon = isLeaf ? Leaf : Sprout;
                return (
                  <div key={transaction.id} className="flex items-center justify-between gap-3 py-3 first:pt-1">
                    <div className="flex min-w-0 items-center gap-3">
                      <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-emerald-100 text-[#14532D]"><ActivityIcon className="h-5 w-5" aria-hidden="true" /></span>
                      <span className="min-w-0">
                        <strong className="block truncate text-sm text-[#1C1917]">{isLeaf ? (isTagalog ? 'Pagsusuri ng dahon' : 'Leaf scan') : (isTagalog ? 'Pagsusuri ng pagkahinog' : 'Maturity check')}</strong>
                        <span className="block truncate text-xs text-[#57534E]">{transaction.label}</span>
                      </span>
                    </div>
                    <time className="shrink-0 text-[11px] text-[#57534E]">{formatActivityTime(transaction.created_at, language)}</time>
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="rounded-2xl border border-stone-200 bg-[#FAF9F5] p-4 text-center">
              <p className="text-sm text-[#57534E]">{loading ? (isTagalog ? 'Kinukuha ang aktibidad...' : 'Loading activity...') : (isTagalog ? 'Wala pang naka-save na scan sa account na ito.' : 'No saved scans for this account yet.')}</p>
              {!loading && (
                <button type="button" onClick={() => onNavigate?.('disease')} className="mt-3 inline-flex min-h-11 items-center justify-center gap-2 rounded-xl bg-[#14532D] px-4 text-sm font-bold text-white hover:bg-[#0F3F22]">
                  <ScanLine className="h-4 w-4" aria-hidden="true" />{isTagalog ? 'Unang scan ng dahon' : 'Scan your first leaf'}
                </button>
              )}
            </div>
          )}

          <div className="mt-4 grid grid-cols-2 gap-2.5 border-t border-stone-200 pt-4">
            <button type="button" onClick={() => onNavigate?.('monitoring')} className="inline-flex min-h-12 items-center justify-center gap-2 rounded-2xl border border-stone-200 bg-[#FAF9F5] px-3 text-xs font-bold text-[#1C1917] transition hover:border-[#14532D] sm:text-sm">
              <Wind className="h-4 w-4 text-[#14532D]" aria-hidden="true" />{isTagalog ? 'Mga sensor' : 'Live sensors'}
            </button>
            <button type="button" onClick={refreshDashboard} className="inline-flex min-h-12 items-center justify-center gap-2 rounded-2xl border border-stone-200 bg-white px-3 text-xs font-bold text-[#1C1917] transition hover:border-[#14532D] sm:text-sm">
              <RefreshCw className="h-4 w-4 text-[#14532D]" aria-hidden="true" />{isTagalog ? 'I-refresh' : 'Refresh'}
            </button>
          </div>
          <section className="mt-4 rounded-2xl border border-emerald-200 bg-emerald-50 p-4" aria-labelledby="dashboard-recommendations-title">
            <div className="flex items-start gap-3">
              <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-white text-[#14532D]">
                <ShieldCheck className="h-5 w-5" aria-hidden="true" />
              </span>
              <div className="min-w-0">
                <h3 id="dashboard-recommendations-title" className="font-extrabold text-base text-[#1C1917]">
                  {isTagalog ? 'Mga susunod na hakbang' : 'Recommended next steps'}
                </h3>
                <div className="mt-3 space-y-2">
                  {integratedRecommendations.map((recommendation) => (
                    <p key={recommendation} className="rounded-xl border border-emerald-100 bg-white/80 p-3 text-sm leading-relaxed text-[#1C1917]">
                      {recommendation}
                    </p>
                  ))}
                </div>
              </div>
            </div>
          </section>
        </section>
      </div>

    </section>
  );
}
