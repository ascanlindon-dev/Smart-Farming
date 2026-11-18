import { useContext, useMemo, useState } from 'react';
import { useWeather } from '../hooks/useWeather';
import { WeatherRefreshStatus } from './WeatherRefreshStatus';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from './ui/card';
import { Badge } from './ui/badge';
import { Alert, AlertDescription, AlertTitle } from './ui/alert';
import { Button } from './ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from './ui/tabs';
import {
  CloudRain,
  AlertTriangle,
  Wind,
  Thermometer,
  CloudSnow,
  Sun,
  Clock,
  CheckCircle2,
  XCircle,
  Droplets,
  Cloud,
  CloudDrizzle,
} from 'lucide-react';
import { LanguageContext } from '../LanguageContext';
import { translations } from '../translation';
import { RainCloud3D } from './Environmental3DIcons';

const DEFAULT_WEATHER_QUERY = 'Victoria, Oriental Mindoro, Philippines';
const FIXED_LOCATION_LABEL = 'Victoria, Oriental Mindoro, Philippines';
const WEATHER_FORECAST_STORAGE_KEY = 'latest_weather_forecast';
const WEATHER_REFRESH_INTERVAL_MS = 60 * 60 * 1000;

const resolveWeatherQuery = async (fallbackQuery = DEFAULT_WEATHER_QUERY) => {
  if (typeof navigator !== 'undefined' && navigator.geolocation) {
    try {
      const position = await new Promise((resolve, reject) => {
        navigator.geolocation.getCurrentPosition(resolve, reject, {
          enableHighAccuracy: true,
          timeout: 10000,
          maximumAge: 600000,
        });
      });
      return `${position.coords.latitude},${position.coords.longitude}`;
    } catch (error) {
      // Fall back to the default city if geolocation is blocked or unavailable.
    }
  }

  return fallbackQuery;
};

const getSavedWeatherForecast = () => {
  try {
    const saved = JSON.parse(localStorage.getItem(WEATHER_FORECAST_STORAGE_KEY) || 'null');
    return Array.isArray(saved?.forecast) && saved.forecast.length > 0 ? saved : null;
  } catch (error) {
    return null;
  }
};

const getDayLabel = (dateString, fallbackIndex, language) => {
  const locale = language === 'tl' ? 'fil-PH' : 'en-US';

  if (dateString) {
    const date = new Date(dateString);
    if (!Number.isNaN(date.getTime())) {
      return date.toLocaleDateString(locale, { weekday: 'long' });
    }
  }

  const fallbackDate = new Date();
  fallbackDate.setDate(fallbackDate.getDate() + fallbackIndex);
  return fallbackDate.toLocaleDateString(locale, { weekday: 'long' });
};

const normalizeCondition = (condition) => {
  const cond = String(condition || '').toLowerCase();

  if (/(clear|sunny|mainly clear|fair)/.test(cond)) return 'sunny';
  if (/(cloud|overcast|fog|mist)/.test(cond)) return 'cloudy';
  if (/(thunder|storm|hail)/.test(cond)) return 'storm';
  if (/(snow|sleet|ice)/.test(cond)) return 'snow';
  if (/(drizzle|freezing drizzle|rain|shower)/.test(cond)) return 'rainy';

  return 'sunny';
};

const getWeatherIcon = (condition) => {
  switch (normalizeCondition(condition)) {
    case 'storm':
      return <AlertTriangle className="h-12 w-12" />;
    case 'rainy':
      return <CloudRain className="h-12 w-12" />;
    case 'light_rain':
      return <CloudDrizzle className="h-12 w-12" />;
    case 'cloudy':
      return <Cloud className="h-12 w-12" />;
    case 'snow':
      return <CloudSnow className="h-12 w-12" />;
    default:
      return <Sun className="h-12 w-12" />;
  }
};

const getWeatherBackground = (condition) => {
  switch (normalizeCondition(condition)) {
    case 'storm':
      return 'bg-gradient-to-br from-violet-100 to-purple-100';
    case 'rainy':
      return 'bg-gradient-to-br from-blue-200 to-cyan-100';
    case 'light_rain':
      return 'bg-gradient-to-br from-blue-100 to-sky-100';
    case 'cloudy':
      return 'bg-gradient-to-br from-gray-100 to-slate-100';
    case 'snow':
      return 'bg-gradient-to-br from-cyan-50 to-slate-100';
    default:
      return 'bg-gradient-to-br from-orange-100 to-yellow-100';
  }
};

const getWeatherIconColor = (condition) => {
  switch (normalizeCondition(condition)) {
    case 'storm':
      return 'text-violet-600';
    case 'rainy':
      return 'text-blue-500';
    case 'light_rain':
      return 'text-blue-400';
    case 'cloudy':
      return 'text-gray-400';
    case 'snow':
      return 'text-cyan-500';
    default:
      return 'text-orange-400';
  }
};

const getShortDayLabel = (dateString, fallbackIndex, language) => {
  const locale = language === 'tl' ? 'fil-PH' : 'en-US';
  const date = dateString ? new Date(dateString) : new Date(Date.now() + fallbackIndex * 86400000);
  return Number.isNaN(date.getTime()) ? getDayLabel(dateString, fallbackIndex, language) : date.toLocaleDateString(locale, { weekday: 'short' });
};

const Forecast3DIcon = ({ condition }) => {
  const kind = normalizeCondition(condition);
  if (kind === 'rainy' || kind === 'light_rain' || kind === 'storm') return <RainCloud3D isRaining />;
  if (kind === 'cloudy') return <RainCloud3D />;
  return <svg viewBox="0 0 48 48" className="h-full w-full" fill="none" aria-hidden="true"><defs><radialGradient id="weather-sun" cx="38%" cy="30%" r="65%"><stop stopColor="#fef9c3"/><stop offset="1" stopColor="#f59e0b"/></radialGradient><filter id="weather-sun-shadow"><feDropShadow dy="2" stdDeviation="2" floodColor="#f59e0b66"/></filter></defs>{[0, 45, 90, 135, 180, 225, 270, 315].map((angle) => <line key={angle} x1={24 + Math.cos(angle * Math.PI / 180) * 15} y1={24 + Math.sin(angle * Math.PI / 180) * 15} x2={24 + Math.cos(angle * Math.PI / 180) * 20} y2={24 + Math.sin(angle * Math.PI / 180) * 20} stroke="#f59e0b" strokeWidth="2.5" strokeLinecap="round"/>)}<circle cx="24" cy="24" r="12" fill="url(#weather-sun)" filter="url(#weather-sun-shadow)"/><circle cx="20" cy="19" r="4" fill="#fff" fillOpacity=".4"/></svg>;
};

const formatImpact = (index, language) => {
  if (index <= 0) return language === 'tl' ? 'ngayon' : 'today';
  if (index === 1) return language === 'tl' ? 'bukas' : 'tomorrow';
  return language === 'tl' ? `sa loob ng ${index + 1} araw` : `within ${index + 1} days`;
};

const buildWeatherAlerts = (forecast, language) => {
  const alerts = [];

  forecast.forEach((day, index) => {
    const rainfall = Number(day.rainfall ?? 0);
    const wind = Number(day.wind ?? day.windSpeed ?? 0);
    const high = Number(day.temperature?.max ?? day.high ?? 0);
    const condition = day.condition || '';
    const normalized = normalizeCondition(condition);
    const impactText = formatImpact(index, language);

    if (rainfall >= 20 || normalized === 'storm') {
      alerts.push({
        id: `rain-${day.date || index}`,
        type: 'heavy_rain',
        severity: rainfall >= 40 || normalized === 'storm' ? 'critical' : 'high',
        title: language === 'tl' ? 'Malakas na Ulan' : 'Heavy Rain Warning',
        description:
          language === 'tl'
            ? `May forecast na humigit-kumulang ${rainfall.toFixed(1)} mm na ulan. Posibleng magdulot ito ng sobrang basang lupa at pagbaha sa mababang bahagi ng bukid.`
            : `The forecast shows about ${rainfall.toFixed(1)} mm of rainfall. This may lead to overly wet soil and flooding in low farm areas.`,
        timeToImpact: impactText,
        recommendations:
          language === 'tl'
            ? [
                'Linisin at buksan ang mga kanal ng tubig.',
                'Iwasan muna ang pag-spray habang maulan.',
                'Bantayan ang mga bahaging madaling bahain.',
              ]
            : [
                'Clear and open drainage canals.',
                'Pause spraying while rainfall is active.',
                'Watch areas that flood easily.',
              ],
        active: true,
        timestamp: new Date(),
      });
    }

    if (wind >= 30) {
      alerts.push({
        id: `wind-${day.date || index}`,
        type: 'strong_wind',
        severity: wind >= 45 ? 'high' : 'moderate',
        title: language === 'tl' ? 'Babala sa Malakas na Hangin' : 'Strong Wind Advisory',
        description:
          language === 'tl'
            ? `Inaasahan ang hangin na umaabot sa ${wind} km/h. Maaaring makaapekto ito sa mga batang puno at pag-spray sa bukid.`
            : `Winds may reach ${wind} km/h. This can affect young trees and spraying operations on the farm.`,
        timeToImpact: impactText,
        recommendations:
          language === 'tl'
            ? [
                'Tiyaking matibay ang suporta ng batang puno.',
                'Ipagpaliban ang pag-spray kung malakas ang hangin.',
                'Suriin ang mga lambat at takip.',
              ]
            : [
                'Secure supports for young trees.',
                'Postpone spraying during strong winds.',
                'Check nets and protective covers.',
              ],
        active: true,
        timestamp: new Date(),
      });
    }

    if (high >= 35) {
      alerts.push({
        id: `heat-${day.date || index}`,
        type: 'extreme_heat',
        severity: high >= 38 ? 'high' : 'moderate',
        title: language === 'tl' ? 'Abiso sa Matinding Init' : 'Extreme Heat Advisory',
        description:
          language === 'tl'
            ? `Maaaring umabot sa ${high}°C ang init. Posibleng tumaas ang stress ng halaman at pagkatuyo ng lupa.`
            : `Temperatures may reach ${high}°C. Plant stress and soil dryness may increase.`,
        timeToImpact: impactText,
        recommendations:
          language === 'tl'
            ? [
                'Mag-monitor ng kondisyon ng dahon at lupa.',
                'Iwasan ang mabigat na field work sa tanghali.',
                'Gawin ang farm work sa umaga o hapon kung maaari.',
              ]
            : [
                'Monitor leaf and soil condition.',
                'Avoid heavy field work at noon.',
                'Do farm work in the morning or late afternoon when possible.',
              ],
        active: true,
        timestamp: new Date(),
      });
    }
  });

  return alerts;
};

export function WeatherAlerts({ isActive = true }) {
  const { language: lang } = useContext(LanguageContext);

  const { weatherData, error, loading, refresh } = useWeather(DEFAULT_WEATHER_QUERY, 7);
  const forecast = useMemo(() => weatherData?.forecast || [], [weatherData]);
  const [dismissedIds, setDismissedIds] = useState([]);

  const generatedAlerts = useMemo(() => buildWeatherAlerts(forecast, lang), [forecast, lang]);
  const activeAlerts = generatedAlerts.filter((alert) => !dismissedIds.includes(alert.id));
  const inactiveAlerts = generatedAlerts.filter((alert) => dismissedIds.includes(alert.id));
  const currentWeather = weatherData?.current || {};
  const currentTemp = Number(currentWeather.temp ?? 0);
  const currentCondition = currentWeather.condition || (lang === 'tl' ? 'Maayos na panahon' : 'Clear weather');
  const currentHumidity = Number(currentWeather.humidity ?? 0);
  const currentWind = Number(currentWeather.wind ?? 0);

  const getSeverityColor = (severity) => {
    switch (severity) {
      case 'critical':
      case 'high':
        return 'destructive';
      case 'moderate':
        return 'default';
      default:
        return 'secondary';
    }
  };

  const getSeverityIcon = (type) => {
    switch (type) {
      case 'heavy_rain':
        return <CloudRain className="h-5 w-5" />;
      case 'strong_wind':
        return <Wind className="h-5 w-5" />;
      case 'extreme_heat':
        return <Thermometer className="h-5 w-5" />;
      case 'frost':
        return <CloudSnow className="h-5 w-5" />;
      default:
        return <AlertTriangle className="h-5 w-5" />;
    }
  };

  const dismissAlert = (id) => {
    setDismissedIds((prev) => (prev.includes(id) ? prev : [...prev, id]));
  };

  const L = {
    title: translations[lang]?.weatherAlerts || (lang === 'tl' ? 'Mga Babala sa Panahon' : 'Weather Alerts'),
    description:
      lang === 'tl'
        ? 'Real-time na babala sa panahon at forecast para sa iyong bukid'
        : 'Real-time weather alerts and forecasts for your farm',
    forecast: 'Forecast',
    activeAlerts: 'Active Alerts',
    rain: lang === 'tl' ? 'Ulan' : 'Rain',
    wind: lang === 'tl' ? 'Hangin' : 'Wind',
    alertHistory: 'History Alert',
    weekAhead: lang === 'tl' ? 'Pagpaplano sa Susunod na Linggo' : 'Week Ahead Planning',
    weekAheadDesc:
      lang === 'tl' ? 'Mga inirerekomendang gawain batay sa totoong forecast' : 'Recommended activities based on live forecast data',
    noActiveAlerts: lang === 'tl' ? 'Walang aktibong babala sa panahon' : 'No active weather alerts',
    allNormal: lang === 'tl' ? 'Lahat ng kondisyon ay normal' : 'All conditions are within normal parameters',
    noHistory: lang === 'tl' ? 'Walang kasaysayan ng babala' : 'No alert history',
    dismissedHere: lang === 'tl' ? 'Dito lalabas ang mga na-dismiss na babala' : 'Dismissed alerts will appear here',
    dismiss: lang === 'tl' ? 'I-dismiss' : 'Dismiss',
    dismissed: lang === 'tl' ? 'Na-dismiss' : 'Dismissed',
    alertDetails: lang === 'tl' ? 'Detalye ng Babala' : 'Alert Details',
    recommendedActions: lang === 'tl' ? 'Mga Inirerekomendang Aksyon' : 'Recommended Actions',
    impactIn: lang === 'tl' ? 'Inaasahang epekto' : 'Impact expected',
    critical: 'Critical',
    highPriority: lang === 'tl' ? 'Mataas na Priyoridad' : 'High Priority',
    moderate: lang === 'tl' ? 'Katamtaman' : 'Moderate',
    forecastUnavailable: lang === 'tl' ? 'Walang forecast data ngayon.' : 'No forecast data available right now.',
    liveSource:
      lang === 'tl'
        ? 'Ang mga notification na ito ay galing sa kasalukuyang weather API data.'
        : 'These notifications are generated from current weather API data.',
  };

  const weekAheadNotes = useMemo(() => {
    if (!forecast.length) return [];
    return forecast.slice(0, 7).map((day, index) => {
      const rainfall = Number(day.rainfall ?? 0);
      const high = Number(day.temperature?.max ?? 0);
      const wind = Number(day.wind ?? 0);
      const label = getDayLabel(day.date, index, lang);

      if (rainfall >= 20) {
        return {
          icon: <CloudRain className="h-6 w-6 text-blue-600" />,
          className: 'bg-blue-50 border-blue-200 text-blue-900',
          text:
            lang === 'tl'
              ? `${label}: May forecast na malakas na ulan na ${rainfall.toFixed(1)} mm. Unahin ang drainage at iwasan muna ang pag-spray.`
              : `${label}: Heavy rainfall of ${rainfall.toFixed(1)} mm is forecast. Prioritize drainage and avoid spraying for now.`,
        };
      }

      if (high >= 35) {
        return {
          icon: <Thermometer className="h-6 w-6 text-amber-600" />,

          className: 'bg-amber-50 border-amber-200 text-amber-900',
          text:
            lang === 'tl'
              ? `${label}: Mataas ang init na aabot sa ${high}°C. Bantayan ang lupa at kondisyon ng halaman.`
              : `${label}: High heat may reach ${high}°C. Monitor soil and plant condition closely.`,
        };
      }

      return {
        icon: <Wind className="h-6 w-6 text-green-600" />,
        className: 'bg-green-50 border-green-200 text-green-900',
        text:
          lang === 'tl'
            ? `${label}: Mas maayos ang kondisyon ng panahon. Magandang araw ito para sa regular na farm inspection.`
            : `${label}: Weather conditions look more stable. This is a good day for routine farm inspection.`,
      };
    });
  }, [forecast, lang]);

  // Presentation below follows the Figma weather layout. The existing weather API request
  // and its response fields above remain the single source of truth for every value shown.
  // Always begin with today, so Wednesday is shown first when today is Wednesday.
  const displayedForecast = forecast.slice(0, 7);
  const rainfallFor = (day) => Number(day?.rainfall ?? 0);
  const lowestRainDay = displayedForecast.reduce((lowest, day) => !lowest || rainfallFor(day) < rainfallFor(lowest) ? day : lowest, null);
  const highestRainDay = displayedForecast.reduce((highest, day) => !highest || rainfallFor(day) > rainfallFor(highest) ? day : highest, null);
  const todayRain = rainfallFor(displayedForecast[0]);
  // Keep the UI's displayed rain chance within the requested 10%–80% range.
  // The original API value remains unchanged for forecast logic and rainfall data.
  const rawTodayRainChance = Number(displayedForecast[0]?.rainChance ?? 0);
  const todayRainChance = Number.isFinite(rawTodayRainChance)
    ? Math.round(Math.min(80, Math.max(10, rawTodayRainChance)))
    : 10;
  const forecastRangeLabel = displayedForecast.length
    ? `${getDayLabel(displayedForecast[0]?.date, 0, lang)} hanggang ${getDayLabel(displayedForecast[displayedForecast.length - 1]?.date, displayedForecast.length - 1, lang)}`
    : '';

  return (
    <section className="mx-auto w-full max-w-4xl">
      <div className="mb-3 sm:mb-5">
        <h2 className="text-xl font-black text-slate-800 sm:text-2xl">{lang === 'tl' ? 'Panahon' : 'Weather'}</h2>
        <p className="mt-1 text-xs text-slate-400 sm:text-sm">{forecastRangeLabel ? (lang === 'tl' ? `Pagtataya ng panahon: ${forecastRangeLabel}` : `Weather forecast: ${forecastRangeLabel}`) : (lang === 'tl' ? 'Pagtataya ng panahon para sa susunod na 7 araw' : 'Weather forecast for the next 7 days')}</p>
      </div>

      {error ? (
        <div className="rounded-3xl border border-amber-200 bg-amber-50 p-4 text-xs text-amber-900 sm:p-6 sm:text-sm">{error}</div>
      ) : displayedForecast.length === 0 ? (
        <div className="rounded-3xl border border-slate-100 bg-white p-4 text-xs text-slate-500 shadow-sm sm:p-6 sm:text-sm">{L.forecastUnavailable}</div>
      ) : (
        <>
          <div className="rounded-3xl border border-slate-50 bg-white p-2 shadow-[0_2px_5px_rgba(15,23,42,.08)] sm:p-4 md:p-6">
            <div className="weather-seven-day-grid grid gap-1 sm:gap-2">
              {displayedForecast.map((day, index) => {
                const high = Number(day.temperature?.max ?? day.high ?? 0);
                const low = Number(day.temperature?.min ?? day.low ?? 0);
                return <article key={day.date || index} className={`flex min-w-0 flex-col items-center gap-1 rounded-2xl px-1.5 py-3 text-center transition sm:px-2 sm:py-4 ${index === 0 ? 'bg-[#0d3d2b]' : 'hover:bg-slate-50'}`}>
                  <p className={`text-xs font-bold ${index === 0 ? 'text-emerald-300' : 'text-slate-400'}`}>{getShortDayLabel(day.date, index, lang)}</p>
                  <div className="h-10 w-10 sm:h-12 sm:w-12"><Forecast3DIcon condition={day.condition} /></div>
                  <p className={`font-black text-base sm:text-lg ${index === 0 ? 'text-white' : 'text-slate-800'}`}>{high.toFixed(0)}°</p>
                  <p className={`text-xs font-medium ${index === 0 ? 'text-white/50' : 'text-slate-400'}`}>{low.toFixed(0)}°</p>
                  {index === 0 && <span className="text-[9px] font-bold uppercase tracking-wide text-emerald-300">{lang === 'tl' ? 'Ngayon' : 'Today'}</span>}
                </article>;
              })}
            </div>
          </div>

          <div className="mt-3 grid gap-2 sm:mt-4 sm:gap-3 sm:grid-cols-2 lg:grid-cols-3">
            <article className="flex flex-col items-start gap-2 rounded-2xl border border-slate-50 bg-white p-3 shadow-sm sm:flex-row sm:items-center sm:gap-3 sm:p-4"><div className="h-9 w-9 shrink-0 sm:h-10 sm:w-10"><RainCloud3D isRaining={todayRain > 0} /></div><div className="min-w-0"><p className="text-xs font-semibold text-slate-400">{lang === 'tl' ? 'Tsansa ng ulan' : 'Rain chance'}</p><p className="font-black text-slate-800">{todayRainChance}%</p><p className="text-xs text-slate-400">{lang === 'tl' ? 'Susunod na 24 oras' : 'Next 24h'}</p></div></article>
            <article className="flex flex-col items-start gap-2 rounded-2xl border border-slate-50 bg-white p-3 shadow-sm sm:flex-row sm:items-center sm:gap-3 sm:p-4"><div className="h-9 w-9 shrink-0 sm:h-10 sm:w-10"><Forecast3DIcon condition={lowestRainDay?.condition} /></div><div className="min-w-0"><p className="text-xs font-semibold text-slate-400">{lang === 'tl' ? 'Araw na mas kaunti ang ulan' : 'Day with less rain'}</p><p className="font-black text-slate-800">{getDayLabel(lowestRainDay?.date, displayedForecast.indexOf(lowestRainDay), lang)}</p><p className="text-xs text-slate-400 truncate">{lowestRainDay?.condition || '—'}</p></div></article>
            <article className="flex flex-col items-start gap-2 rounded-2xl border border-slate-50 bg-white p-3 shadow-sm sm:flex-row sm:items-center sm:gap-3 sm:p-4"><div className="h-9 w-9 shrink-0 sm:h-10 sm:w-10"><RainCloud3D isRaining={rainfallFor(highestRainDay) > 0} /></div><div className="min-w-0"><p className="text-xs font-semibold text-slate-400">{lang === 'tl' ? 'Araw na may pinakamalakas na ulan' : 'Day with the most rain'}</p><p className="font-black text-slate-800">{getDayLabel(highestRainDay?.date, displayedForecast.indexOf(highestRainDay), lang)}</p><p className="text-xs text-slate-400 truncate">{highestRainDay ? `${lang === 'tl' ? 'Dami ng ulan' : 'Rainfall'}: ${rainfallFor(highestRainDay).toFixed(1)} mm` : '—'}</p></div></article>
          </div>
        </>
      )}
    </section>
  );

  return (
    <div className="space-y-4 text-base sm:space-y-6 sm:text-lg">
      <Card className="border-none bg-gradient-to-r from-orange-600 via-red-500 to-pink-500 text-white shadow-xl">
        <CardHeader>
          <CardTitle className="text-lg text-white sm:text-xl md:text-2xl">{L.title}</CardTitle>
          <CardDescription className="text-xs leading-5 text-orange-100 sm:text-base sm:leading-6">{L.description}</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
            <div className="space-y-1">
              <p className="text-base leading-6 text-orange-100 sm:text-lg">{L.activeAlerts}</p>
              <p className="text-3xl font-bold text-white">{activeAlerts.length}</p>
            </div>
            <div className="space-y-1">
              <p className="text-base leading-6 text-orange-100 sm:text-lg">{L.critical}</p>
              <p className="text-3xl font-bold text-white">{activeAlerts.filter((a) => a.severity === 'critical').length}</p>
            </div>
            <div className="space-y-1">
              <p className="text-base leading-6 text-orange-100 sm:text-lg">{L.highPriority}</p>
              <p className="text-3xl font-bold text-white">{activeAlerts.filter((a) => a.severity === 'high').length}</p>
            </div>
            <div className="space-y-1">
              <p className="text-base leading-6 text-orange-100 sm:text-lg">{L.moderate}</p>
              <p className="text-3xl font-bold text-white">{activeAlerts.filter((a) => a.severity === 'moderate').length}</p>
            </div>
          </div>
          <div className="mt-4 rounded-2xl border border-white/20 bg-white/10 p-4 backdrop-blur-sm">
            <div className="flex items-end justify-between gap-3">
              <div>
                <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-orange-100">{lang === 'tl' ? 'Kasalukuyang panahon' : 'Current weather'}</p>
                <p className="mt-2 text-4xl font-black text-white sm:text-5xl">{currentTemp}°C</p>
                <p className="text-sm text-orange-100 sm:text-base">{currentCondition}</p>
              </div>
              <div className="text-right text-xs text-orange-100 sm:text-sm">
                <p className="font-semibold text-white">{FIXED_LOCATION_LABEL}</p>
                <p>{lang === 'tl' ? `Humidity ${currentHumidity}%` : `Humidity ${currentHumidity}%`}</p>
                <p>{lang === 'tl' ? `Hangin ${currentWind} km/h` : `Wind ${currentWind} km/h`}</p>
              </div>
            </div>
          </div>
          <p className="mt-4 text-base leading-7 text-orange-100">{L.liveSource}</p>
        </CardContent>
      </Card>

      <Tabs defaultValue="forecast" className="space-y-6">
          <TabsList className="inline-flex h-auto w-full min-w-0 snap-x snap-mandatory gap-1 overflow-x-auto overscroll-x-contain border-2 border-gray-100 bg-white shadow-md scroll-smooth [scrollbar-width:none] [-ms-overflow-style:none] [-webkit-overflow-scrolling:touch] [touch-action:pan-x] [&::-webkit-scrollbar]:hidden">
            <TabsTrigger value="forecast" className="snap-start shrink-0 whitespace-nowrap px-3 py-2 text-base data-[state=active]:bg-gradient-to-r data-[state=active]:from-orange-600 data-[state=active]:to-red-500 data-[state=active]:text-white sm:px-6 sm:text-lg">
              <span>{L.forecast}</span>
            </TabsTrigger>
            <TabsTrigger value="active" className="snap-start shrink-0 whitespace-nowrap px-3 py-2 text-base data-[state=active]:bg-gradient-to-r data-[state=active]:from-orange-600 data-[state=active]:to-red-500 data-[state=active]:text-white sm:px-6 sm:text-lg">
              <span>{L.activeAlerts}</span>
            </TabsTrigger>
            <TabsTrigger value="history" className="snap-start shrink-0 whitespace-nowrap px-3 py-2 text-base data-[state=active]:bg-gradient-to-r data-[state=active]:from-orange-600 data-[state=active]:to-red-500 data-[state=active]:text-white sm:px-6 sm:text-lg">
              <span>{L.alertHistory}</span>
            </TabsTrigger>
          </TabsList>

        <TabsContent value="forecast" className="space-y-4">
          {error ? (
            <Card className="border-2 border-amber-200 bg-amber-50 shadow-xl">
              <CardContent className="py-8 text-base text-amber-900">{error}</CardContent>
            </Card>
          ) : forecast.length === 0 ? (
            <Card className="border-2 border-gray-100 bg-white/90 shadow-xl">
              <CardContent className="py-8 text-base text-gray-600">{L.forecastUnavailable}</CardContent>
            </Card>
          ) : (
            <>
              <div className="grid grid-cols-2 gap-4 md:grid-cols-5">
                {forecast.map((day, index) => (
                  <Card
                    key={day.date || index}
                    className="mx-auto w-full max-w-sm border-2 border-gray-100 bg-white/90 shadow-xl transition-all duration-300 hover:shadow-2xl"
                  >
                    <CardHeader className="pb-3 text-center">
                      <CardTitle className="min-h-[56px] text-center text-lg leading-tight sm:text-xl">
                        {getDayLabel(day.date, index, lang)}
                      </CardTitle>
                      <CardDescription className="text-center text-base">{day.condition}</CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-4 text-center">
                      <div className={`flex items-center justify-center rounded-2xl p-6 shadow-md ${getWeatherBackground(day.condition)}`}>
                        <div className={getWeatherIconColor(day.condition)}>{getWeatherIcon(day.condition)}</div>
                      </div>

                      <div className="text-center">
                        <div className="flex items-baseline justify-center gap-1">
                          <span className="text-4xl font-bold text-gray-900">{day.temperature?.max}°</span>
                          <span className="text-2xl text-gray-500">/ {day.temperature?.min}°</span>
                        </div>
                      </div>

                      <div className="space-y-2 border-t-2 border-gray-100 pt-2 text-left">
                        <div className="flex items-center gap-2">
                          <Droplets className="h-4 w-4 text-blue-500" />
                          <span className="text-base text-gray-600">{L.rain}</span>
                          <span className="ml-auto text-base font-semibold text-gray-900">{day.rainfall}mm</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <Wind className="h-4 w-4 text-purple-500" />
                          <span className="text-base text-gray-600">{L.wind}</span>
                          <span className="ml-auto text-base font-semibold text-gray-900">{day.wind}km/h</span>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>

              <Card className="border-2 border-gray-100 bg-white/90 shadow-xl">
                <CardHeader>
                  <CardTitle className="text-2xl">{L.weekAhead}</CardTitle>
                  <CardDescription className="text-base">{L.weekAheadDesc}</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="space-y-3">
                    {weekAheadNotes.map((note, index) => (
                      <div key={index} className={`flex items-start gap-3 rounded-lg border-2 p-4 shadow-md ${note.className}`}>
                        {note.icon}
                        <div className="flex-1">
                          <p className="text-base">{note.text}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            </>
          )}
        </TabsContent>

        <TabsContent value="active" className="space-y-4">
          {activeAlerts.length === 0 ? (
            <Card className="border-2 border-gray-100 bg-white/90 shadow-xl">
              <CardContent className="flex flex-col items-center justify-center py-12">
                <CheckCircle2 className="mb-3 h-16 w-16 text-green-500" />
                <p className="text-xl font-semibold text-gray-900">{L.noActiveAlerts}</p>
                <p className="text-base text-gray-600">{L.allNormal}</p>
              </CardContent>
            </Card>
          ) : (
            activeAlerts.map((alert) => (
              <Card
                key={alert.id}
                className="border-l-4 bg-white/90 shadow-xl"
                style={{ borderLeftColor: alert.severity === 'critical' || alert.severity === 'high' ? '#ef4444' : '#f59e0b' }}
              >
                <CardHeader className="p-4 sm:p-6">
                  <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                    <div className="flex min-w-0 flex-1 items-start gap-3">
                      <div
                        className={`rounded-lg p-2.5 shadow-md sm:p-3 ${
                          alert.severity === 'critical' || alert.severity === 'high'
                            ? 'bg-red-100 text-red-600'
                            : 'bg-amber-100 text-amber-600'
                        }`}
                      >
                        {getSeverityIcon(alert.type)}
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="mb-2 flex flex-wrap items-center gap-2">
                          <CardTitle className="break-words text-lg leading-tight sm:text-xl">{alert.title}</CardTitle>
                          <Badge variant={getSeverityColor(alert.severity)} className="text-xs sm:text-sm">
                            {alert.severity.toUpperCase()}
                          </Badge>
                        </div>
                        <CardDescription className="flex flex-wrap items-center gap-2 break-words text-sm sm:text-base">
                          <Clock className="h-4 w-4" />
                          {L.impactIn}: {alert.timeToImpact}
                        </CardDescription>
                      </div>
                    </div>
                    <Button variant="outline" size="sm" onClick={() => dismissAlert(alert.id)} className="w-full text-sm sm:w-auto sm:text-base">
                      {L.dismiss}
                    </Button>
                  </div>
                </CardHeader>
                <CardContent className="space-y-4 px-4 pb-4 pt-0 sm:px-6 sm:pb-6">
                  <Alert className="border-2 shadow-md">
                    <AlertTriangle className="h-5 w-5" />
                    <AlertTitle className="text-lg">{L.alertDetails}</AlertTitle>
                    <AlertDescription className="text-sm leading-6 sm:text-base">{alert.description}</AlertDescription>
                  </Alert>

                  <div>
                    <h4 className="mb-2 text-sm font-semibold text-gray-700 sm:text-base">{L.recommendedActions}:</h4>
                    <ul className="space-y-2">
                      {alert.recommendations.map((rec, index) => (
                        <li key={index} className="flex items-start gap-2 text-sm leading-6 text-gray-700 sm:text-base">
                          <div className="mt-2 h-2 w-2 rounded-full bg-green-500" />
                          <span>{rec}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                </CardContent>
              </Card>
            ))
          )}
        </TabsContent>

        <TabsContent value="history" className="space-y-4">
          {inactiveAlerts.length === 0 ? (
            <Card className="border-2 border-gray-100 bg-white/90 shadow-xl">
              <CardContent className="flex flex-col items-center justify-center py-12">
                <XCircle className="mb-3 h-16 w-16 text-gray-400" />
                <p className="text-xl font-semibold text-gray-900">{L.noHistory}</p>
                <p className="text-base text-gray-600">{L.dismissedHere}</p>
              </CardContent>
            </Card>
          ) : (
            inactiveAlerts.map((alert) => (
              <Card key={alert.id} className="border-2 border-gray-100 bg-white/80 shadow-lg opacity-75">
                <CardHeader className="p-4 sm:p-6">
                  <div className="flex items-start gap-3">
                    <div className="rounded-lg bg-gray-100 p-2.5 text-gray-600 shadow-md sm:p-3">{getSeverityIcon(alert.type)}</div>
                    <div className="min-w-0 flex-1">
                      <div className="mb-2 flex flex-col items-start gap-2 sm:flex-row sm:flex-wrap sm:items-center">
                        <CardTitle className="break-words text-lg leading-tight sm:text-xl">{alert.title}</CardTitle>
                        <Badge variant="outline" className="text-xs sm:text-sm">
                          {L.dismissed}
                        </Badge>
                      </div>
                      <CardDescription className="break-words text-sm leading-5 sm:text-base">{alert.timestamp.toLocaleString()}</CardDescription>
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="px-4 pb-4 pt-0 sm:px-6 sm:pb-6">
                  <p className="text-sm leading-6 text-gray-600 sm:text-base">{alert.description}</p>
                </CardContent>
              </Card>
            ))
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}

export default WeatherAlerts;
