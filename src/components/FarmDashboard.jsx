import { useContext, useEffect, useMemo, useState } from 'react';
import {
  AlertTriangle,
  ArrowRight,
  CheckCircle2,
  CloudRain,
  Droplets,
  Leaf,
  RefreshCw,
  ScanLine,
  Sprout,
  Thermometer,
  Wind,
} from 'lucide-react';
import { LanguageContext } from '../LanguageContext';
import { apiFetch } from '../lib/apiFetch.mjs';
import { useWeather } from '../hooks/useWeather';

const DEFAULT_WEATHER_QUERY = 'Victoria, Oriental Mindoro, Philippines';

const numberOrNull = (value) => {
  const number = Number(value);
  return Number.isFinite(number) ? number : null;
};

const formatMetric = (value, suffix = '—', decimals = 1) => {
  const number = numberOrNull(value);
  return number == null ? suffix : `${number.toFixed(decimals)}${suffix}`;
};

const formatActivityTime = (value, language) => {
  if (!value) return language === 'tl' ? 'Walang petsa' : 'No date';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return language === 'tl' ? 'Walang petsa' : 'No date';
  return date.toLocaleString(language === 'tl' ? 'fil-PH' : 'en-PH', {
    month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit',
  });
};

const getActivityIcon = (type) => (type === 'leaf' ? Leaf : Sprout);

function MiniTrendChart({ data, language }) {
  const points = useMemo(() => {
    const values = (data || []).map((item) => numberOrNull(item.humidity)).filter((value) => value != null).slice(-12);
    if (values.length < 2) return [];
    const min = Math.min(...values);
    const spread = Math.max(Math.max(...values) - min, 1);
    return values.map((value, index) => `${(index / (values.length - 1)) * 100},${36 - ((value - min) / spread) * 28}`);
  }, [data]);

  return (
    <div className="min-h-[180px] rounded-2xl border border-slate-100 bg-gradient-to-b from-emerald-50/70 to-white p-3">
      {points.length ? (
        <>
          <svg viewBox="0 0 100 40" preserveAspectRatio="none" className="h-36 w-full" role="img" aria-label={language === 'tl' ? 'Trend ng halumigmig' : 'Humidity trend'}>
            <defs><linearGradient id="dashboardTrendFill" x1="0" x2="0" y1="0" y2="1"><stop offset="0%" stopColor="#34a66a" stopOpacity="0.28" /><stop offset="100%" stopColor="#34a66a" stopOpacity="0" /></linearGradient></defs>
            <polyline points={`0,40 ${points.join(' ')} 100,40`} fill="url(#dashboardTrendFill)" stroke="none" />
            <polyline points={points.join(' ')} fill="none" stroke="#208653" strokeWidth="1.4" vectorEffect="non-scaling-stroke" />
          </svg>
          <div className="flex justify-between px-1 text-[10px] text-slate-400"><span>{language === 'tl' ? 'Mas maaga' : 'Earlier'}</span><span>{language === 'tl' ? 'Pinakabago' : 'Latest'}</span></div>
        </>
      ) : <div className="flex h-40 items-center justify-center text-center text-xs text-slate-500">{language === 'tl' ? 'Wala pang sapat na trend data.' : 'Not enough trend data yet.'}</div>}
    </div>
  );
}

export default function FarmDashboard({ farmerName, location, notifications = [], onNavigate }) {
  const { language } = useContext(LanguageContext);
  const isTagalog = language === 'tl';
  const weatherQuery = location || DEFAULT_WEATHER_QUERY;
  const { weatherData, loading: weatherLoading, refresh: refreshWeather } = useWeather(weatherQuery, 3);
  const [sensorData, setSensorData] = useState({});
  const [humidityHistory, setHumidityHistory] = useState([]);
  const [transactions, setTransactions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [lastUpdated, setLastUpdated] = useState(null);

  useEffect(() => {
    let active = true;
    const controller = new AbortController();
    const loadDashboardData = async () => {
      try {
        const [sensorResponse, historyResponse, transactionResponse] = await Promise.all([
          apiFetch('/api/sensors/', { signal: controller.signal, cache: 'no-store' }),
          apiFetch('/api/sensors/history/?range=7days', { signal: controller.signal, cache: 'no-store' }),
          apiFetch('/api/predictions/transactions/?page_size=5', { signal: controller.signal, cache: 'no-store' }),
        ]);
        const nextSensorData = sensorResponse.ok ? await sensorResponse.json().catch(() => ({})) : {};
        const nextHistory = historyResponse.ok ? await historyResponse.json().catch(() => ({})) : {};
        const nextTransactions = transactionResponse.ok ? await transactionResponse.json().catch(() => ({})) : {};
        if (!active) return;
        setSensorData(nextSensorData || {});
        setHumidityHistory(nextHistory?.humidityData || []);
        setTransactions(nextTransactions?.results || []);
        setLastUpdated(new Date());
      } catch (error) {
        if (active && error.name !== 'AbortError') setLastUpdated(null);
      } finally {
        if (active) setLoading(false);
      }
    };
    void loadDashboardData();
    const intervalId = window.setInterval(loadDashboardData, 60_000);
    return () => { active = false; controller.abort(); window.clearInterval(intervalId); };
  }, []);

  const activeAlerts = notifications.slice(0, 3);
  const hasHighAlert = notifications.some((notification) => notification.severity === 'high');
  const health = hasHighAlert
    ? { label: isTagalog ? 'Kailangan ng pansin' : 'Needs attention', tone: 'text-red-700', icon: AlertTriangle, iconBg: 'bg-red-50' }
    : notifications.length
      ? { label: isTagalog ? 'Bantayan' : 'Monitor', tone: 'text-amber-700', icon: AlertTriangle, iconBg: 'bg-amber-50' }
      : { label: isTagalog ? 'Mabuti' : 'Good', tone: 'text-emerald-700', icon: CheckCircle2, iconBg: 'bg-emerald-50' };
  const HealthIcon = health.icon;
  const currentWeather = weatherData?.current || null;
  const todayForecast = weatherData?.forecast?.[0] || null;
  const updatedLabel = lastUpdated
    ? lastUpdated.toLocaleTimeString(isTagalog ? 'fil-PH' : 'en-PH', { hour: 'numeric', minute: '2-digit' })
    : isTagalog ? 'Hindi pa available' : 'Not available';

  return (
    <section className="space-y-5 sm:space-y-6" aria-labelledby="farm-dashboard-title">
      <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-end">
        <div>
          <p className="text-sm font-medium text-slate-500">{isTagalog ? 'Magandang araw' : 'Good morning'}, {farmerName || (isTagalog ? 'Magsasaka' : 'Farmer')} 👋</p>
          <h2 id="farm-dashboard-title" className="mt-1 text-2xl font-black tracking-tight text-slate-900 sm:text-3xl">{isTagalog ? 'Buod ng iyong bukid' : 'Your farm at a glance'}</h2>
          <p className="mt-1 text-xs text-slate-500 sm:text-sm">{location || DEFAULT_WEATHER_QUERY}</p>
        </div>
        <p className="text-xs text-slate-500">{isTagalog ? 'Huling update:' : 'Last updated:'} {updatedLabel}</p>
      </div>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3 sm:gap-4">
        <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:p-5"><div className="flex items-start justify-between"><div><p className="text-xs font-semibold text-slate-500">{isTagalog ? 'Kalagayan ng bukid' : 'Farm health'}</p><p className={`mt-2 text-xl font-black ${health.tone}`}>{health.label}</p></div><span className={`flex h-10 w-10 items-center justify-center rounded-xl ${health.iconBg} ${health.tone}`}><HealthIcon className="h-5 w-5" /></span></div><p className="mt-3 text-xs text-slate-500">{notifications.length ? `${notifications.length} ${isTagalog ? 'active alert' : 'active alert(s)'}` : (isTagalog ? 'Walang critical alerts' : 'No critical alerts')}</p></div>
        <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:p-5"><div className="flex items-start justify-between"><div><p className="text-xs font-semibold text-slate-500">{isTagalog ? 'Temperatura' : 'Temperature'}</p><p className="mt-2 text-2xl font-black text-slate-900">{formatMetric(sensorData.temperature, '°C')}</p></div><span className="flex h-10 w-10 items-center justify-center rounded-xl bg-orange-50 text-orange-600"><Thermometer className="h-5 w-5" /></span></div><p className="mt-3 text-xs text-slate-500">{loading ? (isTagalog ? 'Kinukuha ang data...' : 'Loading sensor data...') : sensorData.temperature == null ? (isTagalog ? 'Walang sensor data' : 'No sensor data') : (isTagalog ? 'Live sensor reading' : 'Live sensor reading')}</p></div>
        <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:p-5"><div className="flex items-start justify-between"><div><p className="text-xs font-semibold text-slate-500">{isTagalog ? 'Halumigmig' : 'Humidity'}</p><p className="mt-2 text-2xl font-black text-slate-900">{formatMetric(sensorData.humidity, '%')}</p></div><span className="flex h-10 w-10 items-center justify-center rounded-xl bg-blue-50 text-blue-600"><Droplets className="h-5 w-5" /></span></div><p className="mt-3 text-xs text-slate-500">{sensorData.humidity == null ? (isTagalog ? 'Walang sensor data' : 'No sensor data') : sensorData.humidity > 80 ? (isTagalog ? 'Mataas na halumigmig' : 'High humidity') : (isTagalog ? 'Nasa magandang range' : 'Within preferred range')}</p></div>
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-[1.25fr,.9fr]">
        <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:p-5"><div className="mb-4 flex items-start justify-between gap-3"><div><h3 className="text-base font-bold text-slate-900">{isTagalog ? 'Trend ng kapaligiran' : 'Environmental trend'}</h3><p className="mt-1 text-xs text-slate-500">{isTagalog ? 'Halumigmig sa nakaraang 7 araw' : 'Humidity over the past 7 days'}</p></div><span className="rounded-full bg-emerald-50 px-2.5 py-1 text-[11px] font-semibold text-emerald-700">{isTagalog ? 'Halumigmig' : 'Humidity'}</span></div><MiniTrendChart data={humidityHistory} language={language} /></div>
        <div className="rounded-2xl border border-slate-200 bg-gradient-to-br from-blue-50 to-white p-4 shadow-sm sm:p-5"><div className="flex items-start justify-between gap-3"><div><h3 className="text-base font-bold text-slate-900">{isTagalog ? 'Panahon ngayon' : "Today's weather"}</h3><p className="mt-1 text-xs text-slate-500">{weatherData?.resolved_location?.name || location || 'Victoria'}</p></div><CloudRain className="h-6 w-6 text-blue-500" /></div><div className="mt-6 flex items-center justify-between"><div><p className="text-4xl font-black tracking-tight text-slate-900">{currentWeather?.temp != null ? `${Math.round(currentWeather.temp)}°` : '—'}<span className="text-base font-semibold text-slate-500">C</span></p><p className="mt-1 text-sm text-slate-600">{currentWeather?.condition || (weatherLoading ? (isTagalog ? 'Naglo-load...' : 'Loading...') : (isTagalog ? 'Walang forecast' : 'No forecast'))}</p></div><span className="text-5xl" aria-hidden="true">{todayForecast?.icon || '🌦️'}</span></div><div className="mt-6 grid grid-cols-3 gap-2 border-t border-blue-100 pt-4 text-center text-xs text-slate-500"><div><Wind className="mx-auto mb-1 h-4 w-4 text-blue-500" />{currentWeather?.wind != null ? `${currentWeather.wind} kph` : '—'}</div><div><Droplets className="mx-auto mb-1 h-4 w-4 text-blue-500" />{currentWeather?.humidity != null ? `${currentWeather.humidity}%` : '—'}</div><div><CloudRain className="mx-auto mb-1 h-4 w-4 text-blue-500" />{todayForecast?.rainfall != null ? `${todayForecast.rainfall} mm` : '—'}</div></div></div>
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:p-5"><div className="mb-2 flex items-center justify-between"><h3 className="text-base font-bold text-slate-900">{isTagalog ? 'Kailangan ng pansin' : 'Needs attention'}</h3><span className="text-xs text-slate-500">{activeAlerts.length} {isTagalog ? 'alert' : 'alert(s)'}</span></div>{activeAlerts.length ? activeAlerts.map((alert) => <button type="button" key={alert.id} onClick={() => onNavigate?.(alert.tab)} className="flex w-full items-start gap-3 border-b border-slate-100 py-3 text-left last:border-0 last:pb-0 hover:bg-emerald-50/50"><span className={`mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg ${alert.severity === 'high' ? 'bg-red-50 text-red-600' : 'bg-amber-50 text-amber-600'}`}><AlertTriangle className="h-4 w-4" /></span><span className="min-w-0"><strong className="block text-sm text-slate-900">{alert.title}</strong><span className="mt-0.5 block text-xs leading-5 text-slate-500">{alert.description}</span></span><ArrowRight className="mt-1 h-4 w-4 shrink-0 text-slate-400" /></button>) : <div className="flex items-center gap-3 py-5 text-sm text-slate-500"><CheckCircle2 className="h-5 w-5 text-emerald-600" />{isTagalog ? 'Walang kailangang aksyon ngayon.' : 'Nothing needs attention right now.'}</div>}</div>
        <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:p-5"><div className="mb-2 flex items-center justify-between"><h3 className="text-base font-bold text-slate-900">{isTagalog ? 'Kamakailang aktibidad' : 'Recent activity'}</h3><button type="button" onClick={() => onNavigate?.('analytics')} className="text-xs font-semibold text-emerald-700 hover:text-emerald-900">{isTagalog ? 'Tingnan lahat' : 'View all'} <ArrowRight className="ml-1 inline h-3.5 w-3.5" /></button></div>{transactions.length ? transactions.slice(0, 3).map((transaction) => { const ActivityIcon = getActivityIcon(transaction.prediction_type); return <div key={transaction.id} className="flex items-center justify-between gap-3 border-b border-slate-100 py-3 last:border-0 last:pb-0"><div className="flex min-w-0 items-center gap-3"><span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-emerald-50 text-emerald-700"><ActivityIcon className="h-4 w-4" /></span><span className="min-w-0"><strong className="block truncate text-sm text-slate-900">{transaction.prediction_type === 'leaf' ? 'Leaf scan' : 'Maturity check'}</strong><span className="block truncate text-xs text-slate-500">{transaction.label}</span></span></div><time className="shrink-0 text-[11px] text-slate-400">{formatActivityTime(transaction.created_at, language)}</time></div>; }) : <div className="py-5 text-sm text-slate-500">{isTagalog ? 'Wala pang saved scans.' : 'No saved scans yet.'}</div>}</div>
      </div>

      <div className="flex flex-wrap gap-2.5"><button type="button" onClick={() => onNavigate?.('disease')} className="inline-flex items-center gap-2 rounded-xl bg-[#075137] px-4 py-3 text-sm font-bold text-white shadow-sm transition hover:bg-[#06432f]"><ScanLine className="h-4 w-4" />{isTagalog ? 'Mag-scan ng dahon' : 'Scan a leaf'}</button><button type="button" onClick={() => onNavigate?.('maturity')} className="inline-flex items-center gap-2 rounded-xl bg-emerald-100 px-4 py-3 text-sm font-bold text-emerald-800 transition hover:bg-emerald-200"><Sprout className="h-4 w-4" />{isTagalog ? 'Suriin ang maturity' : 'Check maturity'}</button><button type="button" onClick={() => onNavigate?.('weather')} className="inline-flex items-center gap-2 rounded-xl bg-blue-100 px-4 py-3 text-sm font-bold text-blue-800 transition hover:bg-blue-200"><CloudRain className="h-4 w-4" />{isTagalog ? 'Tingnan ang panahon' : 'View weather'}</button><button type="button" onClick={refreshWeather} className="ml-auto inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm font-semibold text-slate-700 transition hover:bg-slate-50"><RefreshCw className="h-4 w-4" />{isTagalog ? 'I-refresh' : 'Refresh'}</button></div>
    </section>
  );
}
