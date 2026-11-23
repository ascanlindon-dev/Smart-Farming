import { useContext, useMemo, useState } from 'react';
import { useWeather } from '../hooks/useWeather';
import { useSensorReadings } from '../hooks/useSensorReadings';
import { WeatherRefreshStatus } from './WeatherRefreshStatus';
import { Badge } from './ui/badge';
import { Button } from './ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from './ui/tabs';
import {
  CloudRain,
  AlertTriangle,
  Wind,
  Thermometer,
  CheckCircle2,
} from 'lucide-react';
import { LanguageContext } from '../LanguageContext';
import { translations } from '../translation';

const DEFAULT_WEATHER_QUERY = 'Victoria, Oriental Mindoro, Philippines';
const FIXED_LOCATION_LABEL = 'Victoria, Oriental Mindoro, Philippines';

const parseForecastDate = (dateString) => {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(dateString || ''));
  if (!match) return null;
  const date = new Date(Number(match[1]), Number(match[2]) - 1, Number(match[3]), 12);
  return Number.isNaN(date.getTime()) ? null : date;
};

const getManilaDate = () => {
  const dateParts = new Intl.DateTimeFormat('en-US', {
    timeZone: 'Asia/Manila',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(new Date());
  const parts = Object.fromEntries(dateParts.map(({ type, value }) => [type, value]));
  return `${parts.year}-${parts.month}-${parts.day}`;
};

const getDayLabel = (dateString, fallbackIndex, language) => {
  const locale = language === 'tl' ? 'fil-PH' : 'en-US';

  const date = parseForecastDate(dateString);
  if (date) return date.toLocaleDateString(locale, { weekday: 'long' });

  const fallbackDate = new Date();
  fallbackDate.setDate(fallbackDate.getDate() + fallbackIndex);
  return fallbackDate.toLocaleDateString(locale, { weekday: 'long' });
};

const getDateLabel = (dateString, fallbackIndex, language) => {
  const locale = language === 'tl' ? 'fil-PH' : 'en-US';
  const date = parseForecastDate(dateString);
  if (date) return date.toLocaleDateString(locale, { month: 'short', day: 'numeric' });

  const fallbackDate = new Date();
  fallbackDate.setDate(fallbackDate.getDate() + fallbackIndex);
  return fallbackDate.toLocaleDateString(locale, { month: 'short', day: 'numeric' });
};

const normalizeCondition = (condition) => {
  const cond = String(condition || '').toLowerCase();

  if (/(clear|sunny|mainly clear|fair)/.test(cond)) return 'sunny';
  if (/(cloud|overcast|fog|mist)/.test(cond)) return 'cloudy';
  if (/(thunder|storm|hail)/.test(cond)) return 'storm';
  if (/(snow|sleet|ice)/.test(cond)) return 'snow';
  if (/(drizzle|freezing drizzle|rain|shower)/.test(cond)) return 'rainy';

  return 'unknown';
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
    case 'unknown':
      return 'bg-stone-100';
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
    case 'unknown':
      return 'text-stone-500';
    default:
      return 'text-orange-400';
  }
};

const getShortDayLabel = (dateString, fallbackIndex, language) => {
  const locale = language === 'tl' ? 'fil-PH' : 'en-US';
  const date = parseForecastDate(dateString);
  if (date) return date.toLocaleDateString(locale, { weekday: 'short' });

  const fallbackDate = new Date();
  fallbackDate.setDate(fallbackDate.getDate() + fallbackIndex);
  return fallbackDate.toLocaleDateString(locale, { weekday: 'short' });
};

const weatherKindForCode = (code) => {
  if (code === null || code === undefined || typeof code === 'boolean' || String(code).trim() === '' || !Number.isInteger(Number(code))) return null;
  const value = Number(code);
  if (value === 0 || value === 1) return 'sunny';
  if (value === 2 || value === 3 || value === 45 || value === 48) return 'cloudy';
  if ([51, 53, 55, 56, 57, 61, 63, 65, 66, 67, 80, 81, 82].includes(value)) return 'rainy';
  if ([71, 73, 75, 77, 85, 86].includes(value)) return 'snow';
  if ([95, 96, 99].includes(value)) return 'storm';
  return 'unknown';
};

const WeatherIcon = ({ condition, code, className = 'h-full w-full' }) => {
  const kind = weatherKindForCode(code) ?? normalizeCondition(condition);
  const isPartlyCloudy = kind === 'cloudy' && (Number(code) === 2 || /(partly|mostly|mainly)/i.test(String(condition || '')));
  const hasCloud = kind !== 'sunny';
  const hasRain = kind === 'rainy' || kind === 'storm';
  const hasSnow = kind === 'snow';

  if (!hasCloud) {
    return (
      <svg viewBox="0 0 48 48" className={className} fill="none" aria-hidden="true">
        <g className="wx-anim-sun">
          <circle cx="24" cy="24" r="9" fill="#fbbf24" />
          <path d="M24 3v7m0 28v7M3 24h7m28 0h7M9.2 9.2l5 5m19.6 19.6 5 5m0-29.6-5 5m-19.6 19.6-5 5" stroke="#d97706" strokeWidth="2.5" strokeLinecap="round" />
          <circle cx="21" cy="20" r="3" fill="#fff" fillOpacity=".45" />
        </g>
      </svg>
    );
  }

  return (
    <svg viewBox="0 0 48 48" className={className} fill="none" aria-hidden="true">
      {isPartlyCloudy && (
        <g className="wx-anim-sun">
          <circle cx="31" cy="17" r="7" fill="#fbbf24" />
          <path d="M31 4v4m0 18v4m-13-13h4m18 0h4m-22-9 3 3m13 13 3 3m0-19-3 3m-13 13-3 3" stroke="#d97706" strokeWidth="2" strokeLinecap="round" />
        </g>
      )}
      <g className="wx-anim-cloud">
        <path d="M38 31H13a8 8 0 1 1 1.4-15.9A12 12 0 0 1 38.2 19a7 7 0 0 1-.2 12Z" fill={kind === 'unknown' ? '#d6d3d1' : '#bae6fd'} stroke={kind === 'unknown' ? '#78716c' : '#0284c7'} strokeWidth="1.8" strokeLinejoin="round" />
        <path d="M17 18c4-5 9-7 14-5" stroke="#fff" strokeWidth="2.5" strokeLinecap="round" opacity=".8" />
      </g>
      {hasRain && (
        <>
          <path className="wx-anim-drop-1" d="m15 36-2 5" stroke="#0284c7" strokeWidth="2.2" strokeLinecap="round" />
          <path className="wx-anim-drop-2" d="m24 36-2 5" stroke="#0284c7" strokeWidth="2.2" strokeLinecap="round" />
          <path className="wx-anim-drop-3" d="m33 36-2 5" stroke="#0284c7" strokeWidth="2.2" strokeLinecap="round" />
        </>
      )}
      {hasSnow && (
        <g fill="#0284c7">
          <circle cx="15" cy="38" r="1.7" />
          <circle cx="24" cy="42" r="1.7" />
          <circle cx="33" cy="38" r="1.7" />
        </g>
      )}
      {kind === 'storm' && (
        <path d="m29 34-7 9h5l-1 6 9-11h-5l2-4Z" fill="#fbbf24" stroke="#b45309" strokeWidth="1" strokeLinejoin="round" />
      )}
    </svg>
  );
};

const metricOrNull = (value) => {
  if (value === null || value === undefined || String(value).trim() === '') return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
};

const formatForecastTime = (value, language) => {
  const match = /T(\d{2}):(\d{2})/.exec(String(value || ''));
  if (!match) return null;
  return new Date(2000, 0, 1, Number(match[1]), Number(match[2])).toLocaleTimeString(
    language === 'tl' ? 'fil-PH' : 'en-US',
    { hour: 'numeric', minute: '2-digit' },
  );
};

const getForecastBadge = (day, language) => {
  const rainfall = metricOrNull(day?.rainfall);
  const rainChance = metricOrNull(day?.rainChance);
  const hasRainData = rainfall !== null || rainChance !== null;

  if (!hasRainData) {
    return {
      label: language === 'tl' ? 'Limitadong datos' : 'Limited data',
      className: 'bg-stone-100 text-stone-700',
    };
  }
  if (normalizeCondition(day?.condition) === 'storm' || (rainfall !== null && rainfall >= 20)) {
    return {
      label: language === 'tl' ? 'Babala sa ulan' : 'Rain alert',
      className: 'bg-amber-100 text-amber-950',
    };
  }
  if ((rainChance !== null && rainChance >= 60) || (rainfall !== null && rainfall >= 5)) {
    return {
      label: language === 'tl' ? 'Posibleng umulan' : 'Rain watch',
      className: 'bg-sky-100 text-sky-950',
    };
  }
  return {
    label: language === 'tl' ? 'Mababang tsansa ng ulan' : 'Low rain chance',
    className: 'bg-emerald-100 text-emerald-950',
  };
};

const getForecastAdvice = (day, language, rainDetected) => {
  if (rainDetected === true) {
    return language === 'tl'
      ? 'May aktuwal na ulan ayon sa sensor. Ipagpaliban ang pag-spray; kung gagamit ng pesticide, sundin ang rainfast interval sa label. Hindi ito awtomatikong rekomendasyon na mag-apply.'
      : 'The rain sensor detects rain at the farm. Postpone spraying; if using a pesticide, follow its label rainfast interval. This is not a recommendation to apply.';
  }

  if (!day) {
    return language === 'tl'
      ? 'Walang sapat na datos para magbigay ng gabay sa gawain.'
      : 'There is not enough forecast data to provide a work guide.';
  }

  const rainfall = metricOrNull(day.rainfall);
  const rainChance = metricOrNull(day.rainChance);
  const wind = metricOrNull(day.wind);
  const high = metricOrNull(day.temperature?.max ?? day.high);

  if ((rainfall !== null && rainfall >= 20) || normalizeCondition(day.condition) === 'storm') {
    return language === 'tl'
      ? 'May inaasahang malakas na ulan. Unahin ang drainage at ipagpaliban ang pag-spray at pag-aani habang masama ang panahon.'
      : 'Heavy rain is expected. Prioritize drainage and postpone spraying and harvesting while conditions are severe.';
  }
  if ((rainChance !== null && rainChance >= 60) || (rainfall !== null && rainfall >= 5)) {
    return language === 'tl'
      ? 'Posible ang ulan. Suriin ang aktuwal na kondisyon at sundin ang rainfast interval sa label ng anumang pesticide; huwag mag-apply dahil lang sa forecast.'
      : 'Rain is possible. Check actual conditions and follow any pesticide label rainfast interval; do not apply solely because of the forecast.';
  }
  if (wind !== null && wind >= 30) {
    return language === 'tl'
      ? 'Maaaring lumakas ang hangin. Ipagpaliban ang pag-spray at tiyaking maayos ang suporta ng mga batang puno.'
      : 'Winds may be strong. Postpone spraying and check supports on young trees.';
  }
  if (high !== null && high >= 35) {
    return language === 'tl'
      ? 'Mataas ang inaasahang init. Magplano ng gawain sa mas malamig na oras at bantayan ang lupa at mga puno.'
      : 'High temperatures are expected. Plan work during cooler hours and monitor soil and trees.';
  }
  return language === 'tl'
    ? 'Walang matinding panganib sa forecast. Suriin pa rin ang kondisyon ng dahon at bunga bago magtrabaho.'
    : 'No severe weather risk is shown. Still check leaves and fruit conditions before working.';
};

const getRainForecastStatus = (day) => {
  if (!day) return null;
  const rainfall = metricOrNull(day.rainfall);
  const rainChance = metricOrNull(day.rainChance);
  const condition = normalizeCondition(day.condition);
  if (rainfall === null && rainChance === null && condition === 'unknown') return null;
  return (rainChance !== null && rainChance >= 50)
    || (rainfall !== null && rainfall >= 1)
    || condition === 'rainy'
    || condition === 'storm';
};

const getRainInterpretation = (rainDetected, rainExpected, language, hasRawSignal) => {
  const actual = rainDetected === true
    ? (language === 'tl' ? 'May aktuwal na ulan na nakita ng sensor sa bukid' : 'Rain is detected by the farm sensor')
    : rainDetected === false
      ? (language === 'tl' ? 'Walang ulan na nakita ng sensor sa bukid' : 'No rain is detected by the farm sensor')
      : (language === 'tl'
        ? (hasRawSignal ? 'Hindi pa matukoy ang raw sensor signal' : 'Walang mapatunayang status ng rain sensor')
        : (hasRawSignal ? 'The raw sensor signal is not yet verified' : 'No verified rain-sensor status is available'));
  const forecast = rainExpected === true
    ? (language === 'tl' ? 'may ulan na inaasahan sa forecast ngayon' : 'rain is expected in today’s forecast')
    : rainExpected === false
      ? (language === 'tl' ? 'walang ulan na inaasahan sa forecast ngayon' : 'no rain is expected in today’s forecast')
      : (language === 'tl' ? 'walang sapat na datos sa forecast ng ulan' : 'rain forecast data is unavailable');
  return `${actual}; ${forecast}.`;
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
  const {
    snapshot: sensor,
    loading: sensorLoading,
    error: sensorError,
  } = useSensorReadings(isActive);
  const forecast = useMemo(() => weatherData?.forecast || [], [weatherData]);
  const todayDate = getManilaDate();
  const todayForecast = forecast.find((day) => day.date === todayDate) || null;
  const [dismissedIds, setDismissedIds] = useState([]);
  const [selectedDayIndex, setSelectedDayIndex] = useState(0);

  const generatedAlerts = useMemo(() => buildWeatherAlerts(forecast, lang), [forecast, lang]);
  const activeAlerts = generatedAlerts.filter((alert) => !dismissedIds.includes(alert.id));
  const inactiveAlerts = generatedAlerts.filter((alert) => dismissedIds.includes(alert.id));
  const currentWeather = weatherData?.current || {};
  const currentCondition = currentWeather.condition || (
    loading
      ? (lang === 'tl' ? 'Kinukuha ang panahon...' : 'Loading current weather...')
      : (lang === 'tl' ? 'Walang kasalukuyang datos' : 'Current weather unavailable')
  );

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
    activeAlerts: lang === 'tl' ? 'Mga Aktibong Babala' : 'Active Alerts',
    alertHistory: lang === 'tl' ? 'Kasaysayan ng Babala' : 'Alert History',
    noActiveAlerts: lang === 'tl' ? 'Walang aktibong babala sa panahon' : 'No active weather alerts',
    noHistory: lang === 'tl' ? 'Walang kasaysayan ng babala' : 'No alert history',
    dismiss: lang === 'tl' ? 'I-dismiss' : 'Dismiss',
    dismissed: lang === 'tl' ? 'Na-dismiss' : 'Dismissed',
    impactIn: lang === 'tl' ? 'Inaasahang epekto' : 'Impact expected',
    forecastUnavailable: lang === 'tl' ? 'Walang forecast data ngayon.' : 'No forecast data available right now.',
  };

  const displayedForecast = forecast.slice(0, 7);
  const selectedDay = displayedForecast[selectedDayIndex] || displayedForecast[0] || null;
  const isTodaySelected = selectedDay?.date === todayDate;
  const todayHourlyForecast = (weatherData?.hourly || []).filter(
    (hour) => typeof hour.time === 'string' && hour.time.slice(0, 10) === todayDate,
  );
  const rainfallFor = (day) => metricOrNull(day?.rainfall);
  const measuredRainForecast = displayedForecast.filter((day) => rainfallFor(day) !== null);
  const lowestRainDay = measuredRainForecast.reduce((lowest, day) => !lowest || rainfallFor(day) < rainfallFor(lowest) ? day : lowest, null);
  const highestRainDay = measuredRainForecast.reduce((highest, day) => !highest || rainfallFor(day) > rainfallFor(highest) ? day : highest, null);
  const todayRain = metricOrNull(todayForecast?.precipitationSum ?? todayForecast?.rainSum);
  const todayRainChance = metricOrNull(todayForecast?.rainChance);
  const todayHigh = metricOrNull(todayForecast?.temperature?.max);
  const todayLow = metricOrNull(todayForecast?.temperature?.min);
  const todayRainExpected = getRainForecastStatus(todayForecast);
  const selectedRainfall = metricOrNull(selectedDay?.rainfall);
  const selectedRainChance = metricOrNull(selectedDay?.rainChance);
  const selectedWind = metricOrNull(selectedDay?.wind);
  const selectedAdvice = getForecastAdvice(selectedDay, lang, sensor.isRaining);
  const selectedDayPosition = selectedDay ? displayedForecast.indexOf(selectedDay) : -1;
  const sprayNeedsCaution = sensor.isRaining === true
    || (selectedRainChance !== null && selectedRainChance >= 60)
    || (selectedRainfall !== null && selectedRainfall >= 5)
    || (selectedWind !== null && selectedWind >= 30);
  const selectedSevereWeather = (selectedRainfall !== null && selectedRainfall >= 20)
    || normalizeCondition(selectedDay?.condition) === 'storm';
  const sprayTask = !selectedDay
    ? (lang === 'tl' ? 'Walang forecast' : 'No forecast')
    : sprayNeedsCaution
      ? (lang === 'tl' ? 'Ipagpaliban' : 'Postpone')
      : (lang === 'tl' ? 'Suriin muna ang kondisyon' : 'Check conditions first');
  const waterTask = sensor.isRaining === true
    ? (lang === 'tl' ? 'Suriin muna ang lupa' : 'Check soil first')
    : selectedRainfall !== null && selectedRainfall >= 5
      ? (lang === 'tl' ? 'Maaaring umulan' : 'Rain may help')
    : (lang === 'tl' ? 'Suriin muna ang lupa' : 'Check soil first');
  const harvestTask = selectedSevereWeather
    ? (lang === 'tl' ? 'Iwasan habang maulan' : 'Avoid during severe weather')
    : (lang === 'tl' ? 'Suriin ang bunga' : 'Check fruit readiness');
  const locationName = weatherData?.resolved_location?.name
    ? [weatherData.resolved_location.name, weatherData.resolved_location.region].filter(Boolean).join(', ')
    : FIXED_LOCATION_LABEL;
  const currentTemperature = metricOrNull(currentWeather.temp);
  const currentHumidityValue = metricOrNull(currentWeather.humidity);
  const currentWindValue = metricOrNull(currentWeather.wind);
  const selectedDayName = selectedDay ? getDayLabel(selectedDay.date, selectedDay.dayIndex ?? selectedDayIndex, lang) : '';
  const forecastRangeLabel = displayedForecast.length
    ? `${getDayLabel(displayedForecast[0]?.date, 0, lang)} ${lang === 'tl' ? 'hanggang' : 'to'} ${getDayLabel(displayedForecast[displayedForecast.length - 1]?.date, displayedForecast.length - 1, lang)}`
    : '';
  const actualRainLabel = sensor.isRaining === true
    ? (lang === 'tl' ? 'May ulan na nakita' : 'Rain detected')
    : sensor.isRaining === false
      ? (lang === 'tl' ? 'Walang ulan na nakita' : 'No rain detected')
      : sensorError
        ? (lang === 'tl' ? 'Hindi available ang sensor' : 'Sensor unavailable')
        : sensor.rainRaw !== null
          ? (lang === 'tl' ? 'Hindi pa beripikado' : 'Unverified signal')
          : sensorLoading
            ? (lang === 'tl' ? 'Kinukuha ang reading' : 'Checking sensor')
            : (lang === 'tl' ? 'Walang beripikadong status' : 'No verified status');
  const forecastRainLabel = todayRainExpected === true
    ? (lang === 'tl' ? 'Inaasahan ang ulan' : 'Rain expected')
    : todayRainExpected === false
      ? (lang === 'tl' ? 'Walang inaasahang ulan' : 'No rain expected')
      : (lang === 'tl' ? 'Walang sapat na datos' : 'Insufficient forecast data');
  const rainInterpretation = getRainInterpretation(
    sensor.isRaining,
    todayRainExpected,
    lang,
    sensor.rainRaw !== null,
  );

  return (
    <section className="mx-auto w-full max-w-7xl space-y-4 sm:space-y-5" aria-labelledby="weather-page-title">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 id="weather-page-title" className="text-2xl font-extrabold tracking-tight text-[#1C1917] sm:text-3xl" style={{ fontFamily: "'Nunito', sans-serif" }}>{L.title}</h2>
          <p className="mt-1 text-sm text-[#57534E]">{forecastRangeLabel
            ? `${lang === 'tl' ? 'Pagtataya para sa' : 'Forecast for'} ${forecastRangeLabel}`
            : L.description}</p>
        </div>
        <WeatherRefreshStatus loading={loading} refresh={refresh} language={lang} />
      </div>

      {error && (
        <div role="status" className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-950">
          {error}
        </div>
      )}
      <section className="grid items-stretch gap-4 lg:grid-cols-12 sm:gap-5" aria-label={lang === 'tl' ? 'Panahon at gabay sa bukid' : 'Farm weather and guide'}>
        <article className="flex flex-col justify-between space-y-5 rounded-3xl border border-stone-200 bg-white p-5 shadow-sm sm:p-6 lg:col-span-7">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-xs font-bold uppercase tracking-wider text-[#14532D]">{locationName} · {lang === 'tl' ? 'Ngayon' : 'Today'}</span>
                <span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-bold ${sensor.isRaining === true ? 'bg-sky-100 text-sky-900' : sensor.isRaining === false ? 'bg-emerald-100 text-emerald-900' : 'bg-amber-100 text-amber-950'}`}>
                  <span className={`h-1.5 w-1.5 rounded-full ${sensor.isRaining === true ? 'bg-sky-600' : sensor.isRaining === false ? 'bg-emerald-600' : 'bg-amber-600'}`} aria-hidden="true" />
                  {actualRainLabel}
                </span>
              </div>
              <p className="mt-1 text-[11px] text-[#57534E]">
                {lang === 'tl' ? 'Huling update ng sensor' : 'Last sensor update'}: {sensor.receivedAt ? new Date(sensor.receivedAt).toLocaleString(lang === 'tl' ? 'fil-PH' : 'en-PH') : '—'}
              </p>
              {sensorError && <p role="status" className="mt-1 text-xs text-amber-900">{lang === 'tl' ? 'Hindi makuha ang pinakabagong sensor reading.' : 'The latest sensor reading could not be retrieved.'}</p>}

              <section className="mt-3" aria-labelledby="weather-current-title">
                <h3 id="weather-current-title" className="text-xs font-extrabold uppercase tracking-wider text-[#1C1917]">{lang === 'tl' ? 'Kasalukuyang Kondisyon' : 'Current Conditions'}</h3>
                <div className="mt-1 flex flex-wrap items-baseline gap-x-3 gap-y-1">
                  <span className="font-extrabold tracking-tight text-4xl text-[#1C1917] sm:text-5xl" style={{ fontFamily: "'Nunito', sans-serif" }}>
                    {currentTemperature === null ? '—' : `${Math.round(currentTemperature)}°C`}
                  </span>
                  <span className="font-bold text-sm text-sky-800">{currentCondition}</span>
                </div>
                <p className="mt-1 text-xs text-[#57534E]">
                  {lang === 'tl' ? 'Weather code' : 'WMO weather code'}: {currentWeather.weatherCode ?? (lang === 'tl' ? 'Hindi available' : 'Unavailable')}
                </p>
              </section>
            </div>
            <span className={`flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl border border-stone-200 ${getWeatherBackground(currentCondition)} ${getWeatherIconColor(currentCondition)}`}>
              <WeatherIcon condition={currentCondition} code={currentWeather.weatherCode} className="h-9 w-9" />
            </span>
          </div>

          <div className="grid grid-cols-2 gap-2.5">
            <div className="rounded-2xl border border-stone-200 bg-[#FAF9F5] p-3">
              <span className="block text-[11px] font-bold uppercase text-[#57534E]">{lang === 'tl' ? 'Hangin' : 'Wind'}</span>
              <span className="mt-0.5 block font-extrabold text-base text-[#1C1917] sm:text-lg">{currentWindValue === null ? '—' : `${currentWindValue} km/h`}</span>
            </div>
            <div className="rounded-2xl border border-stone-200 bg-[#FAF9F5] p-3">
              <span className="block text-[11px] font-bold uppercase text-[#57534E]">{lang === 'tl' ? 'Halumigmig' : 'Air Moisture'}</span>
              <span className="mt-0.5 block font-extrabold text-base text-[#1C1917] sm:text-lg">{currentHumidityValue === null ? '—' : `${currentHumidityValue}%`}</span>
            </div>
          </div>

          <section className="space-y-3 border-t border-stone-200 pt-4" aria-labelledby="weather-today-title">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <h3 id="weather-today-title" className="font-extrabold text-sm uppercase tracking-wider text-[#1C1917]">{lang === 'tl' ? 'Panahon Ngayon' : "Today's Weather"}</h3>
              <span className={`rounded-full px-2.5 py-1 text-[11px] font-bold ${todayRainExpected === true ? 'bg-sky-100 text-sky-900' : todayRainExpected === false ? 'bg-emerald-100 text-emerald-900' : 'bg-stone-100 text-stone-700'}`}>
                {forecastRainLabel}
              </span>
            </div>
            {loading && !todayForecast ? (
              <p role="status" className="text-sm text-[#57534E]">{lang === 'tl' ? 'Kinukuha ang forecast ngayong araw...' : "Loading today's full-day forecast..."}</p>
            ) : !todayForecast ? (
              <p role="status" className="text-sm text-[#57534E]">{lang === 'tl' ? 'Hindi available ang forecast ngayong araw.' : "Today's forecast is unavailable."}</p>
            ) : (
              <>
                <div className="flex items-center gap-3">
                  <span className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl border border-stone-200 ${getWeatherBackground(todayForecast.condition)} ${getWeatherIconColor(todayForecast.condition)}`}>
                    <WeatherIcon condition={todayForecast.condition} code={todayForecast.weatherCode} className="h-8 w-8" />
                  </span>
                  <div>
                    <p className="font-bold text-[#1C1917]">{todayForecast.condition || (lang === 'tl' ? 'Hindi available' : 'Unavailable')}</p>
                    <p className="text-xs text-[#57534E]">
                      {lang === 'tl' ? 'Mababa / Mataas' : 'Low / High'}: {todayLow === null ? '—' : `${Math.round(todayLow)}°`} / {todayHigh === null ? '—' : `${Math.round(todayHigh)}°`}C
                    </p>
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-3">
                  <div className="rounded-2xl border border-stone-200 bg-[#FAF9F5] p-3">
                    <span className="block text-[10px] font-bold uppercase text-[#57534E]">{lang === 'tl' ? 'Pinakamataas na tsansa ng ulan' : 'Max precipitation probability'}</span>
                    <span className="mt-0.5 block font-extrabold text-base text-[#1C1917]">{todayRainChance === null ? '—' : `${todayRainChance}%`}</span>
                  </div>
                  <div className="rounded-2xl border border-stone-200 bg-[#FAF9F5] p-3">
                    <span className="block text-[10px] font-bold uppercase text-[#57534E]">{lang === 'tl' ? 'Inaasahang ulan' : 'Expected rain'}</span>
                    <span className="mt-0.5 block font-extrabold text-base text-[#1C1917]">{todayRain === null ? '—' : `${todayRain.toFixed(1)} mm`}</span>
                  </div>
                </div>
              </>
            )}
          </section>

          <p role="status" className="rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-2.5 text-xs font-medium leading-relaxed text-emerald-950">
            {rainInterpretation}
          </p>

          {isTodaySelected && todayHourlyForecast.length > 0 && (
            <section role="region" className="border-t border-stone-200 pt-4" aria-labelledby="weather-hourly-title">
              <div className="mb-2.5 flex items-center justify-between gap-2">
                <h3 id="weather-hourly-title" className="text-xs font-extrabold uppercase tracking-wider text-[#1C1917]">
                  {lang === 'tl' ? 'Susunod na Oras Ngayon' : 'Next Hours Today'}
                </h3>
              </div>
              <div className="grid grid-cols-3 gap-2 sm:grid-cols-4 lg:grid-cols-6">
                {todayHourlyForecast.map((hour, index) => {
                  const rainChance = metricOrNull(hour.rainChance);
                  const temperature = metricOrNull(hour.temperature);
                  return (
                    <article key={hour.time || index} className="space-y-1 rounded-2xl border border-stone-200 bg-[#FAF9F5] p-2.5 text-center">
                      <span className="block text-[11px] font-bold text-[#57534E]">{formatForecastTime(hour.time, lang) || hour.label || '—'}</span>
                      <span className="mx-auto block h-7 w-7 text-sky-800"><WeatherIcon condition={hour.condition} code={hour.weatherCode} /></span>
                      <span className="block font-extrabold text-sm text-[#1C1917]">{temperature === null ? '—' : `${Math.round(temperature)}°`}</span>
                      <span className="block text-[11px] font-bold text-sky-700">{rainChance === null ? '—' : `${rainChance}%`}</span>
                    </article>
                  );
                })}
              </div>
            </section>
          )}
        </article>

        <section className="rounded-3xl border border-stone-200 bg-white p-5 shadow-sm sm:p-6 lg:col-span-5" aria-labelledby="weather-work-guide-title">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <h3 id="weather-work-guide-title" className="font-extrabold text-lg text-[#1C1917]" style={{ fontFamily: "'Nunito', sans-serif" }}>{lang === 'tl' ? 'Gabay sa Gawain sa Bukid' : 'Orchard Work Guide'}</h3>
              <span className="rounded-xl bg-emerald-100 px-2.5 py-1 text-xs font-extrabold text-[#14532D]">{selectedDayName}{isTodaySelected ? ` · ${lang === 'tl' ? 'Ngayon' : 'Today'}` : ''}</span>
            </div>
            <p className="mt-1 text-xs text-[#57534E]">{lang === 'tl' ? 'Simpleng gabay batay sa panahon sa napiling araw.' : "Simple farm advice based on the selected day's weather."}</p>
            <div className="mt-4 space-y-2.5">
              {[
                {
                  label: lang === 'tl' ? 'Pag-spray ng dahon' : 'Leaf Spraying',
                  note: sprayNeedsCaution ? selectedAdvice : (lang === 'tl' ? 'Suriin muna ang panahon bago mag-spray.' : 'Check the weather before spraying.'),
                  badge: sprayTask,
                  caution: sprayNeedsCaution,
                },
                {
                  label: lang === 'tl' ? 'Pagdidilig ng puno' : 'Tree Watering',
                  note: selectedRainfall !== null && selectedRainfall >= 5
                    ? (lang === 'tl' ? 'Maaaring mapanatiling basa ng ulan ang lupa; suriin muna ito.' : 'Rain may keep the soil moist; check it before watering.')
                    : (lang === 'tl' ? 'Suriin ang halumigmig ng lupa bago magdilig.' : 'Check soil moisture before watering.'),
                  badge: waterTask,
                  caution: false,
                },
                {
                  label: lang === 'tl' ? 'Pag-aani ng bunga' : 'Fruit Harvesting',
                  note: selectedSevereWeather
                    ? (lang === 'tl' ? 'Suriin ang panahon bago mag-ani.' : 'Check weather conditions before harvesting.')
                    : (lang === 'tl' ? 'Suriin kung handa na ang bunga.' : 'Check fruit readiness before harvesting.'),
                  badge: harvestTask,
                  caution: selectedSevereWeather,
                },
              ].map((task) => (
                <div key={task.label} className="flex items-center justify-between gap-3 rounded-2xl border border-stone-200 bg-[#FAF9F5] p-3">
                  <div className="min-w-0">
                    <p className="text-sm font-bold text-[#1C1917]">{task.label}</p>
                    <p className="mt-0.5 text-xs text-[#57534E]">{task.note}</p>
                  </div>
                  <span className={`shrink-0 rounded-xl px-2.5 py-1 text-[11px] font-bold ${task.caution ? 'bg-amber-100 text-amber-950' : 'bg-emerald-100 text-emerald-950'}`}>{task.badge}</span>
                </div>
              ))}
            </div>
            <p className="mt-3 rounded-xl bg-stone-100 p-3 text-[11px] leading-relaxed text-[#57534E]">{lang === 'tl' ? 'Suriin ang aktuwal na panahon at halumigmig ng lupa. Sundin ang label at rainfast interval ng pesticide.' : 'Check actual sky conditions and soil moisture. Follow the pesticide label and rainfast interval.'}</p>
        </section>
      </section>

      <section className="space-y-4 rounded-3xl border border-stone-200 bg-white p-4 sm:p-6" aria-labelledby="weather-7day-title">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <h3 id="weather-7day-title" className="font-extrabold text-lg text-[#1C1917]" style={{ fontFamily: "'Nunito', sans-serif" }}>{lang === 'tl' ? 'Taya ng Panahon sa Susunod na 7 Araw' : '7-Day Weather Forecast'}</h3>
            <p className="mt-1 text-xs text-[#57534E]">{lang === 'tl' ? 'Pumili ng araw para makita ang detalye at gabay sa gawain.' : 'Select a day to see its forecast details and work guide.'}</p>
          </div>
          <div className="flex flex-wrap items-center gap-2 text-xs font-bold">
            {lowestRainDay && (
              <span className="rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-1.5 text-[#14532D]">
                {lang === 'tl' ? 'Pinakamababang ulan' : 'Driest day'}: {getDayLabel(lowestRainDay.date, displayedForecast.indexOf(lowestRainDay), lang)} · {rainfallFor(lowestRainDay).toFixed(1)} mm
              </span>
            )}
            {highestRainDay && (
              <span className="rounded-xl border border-amber-200 bg-amber-50 px-3 py-1.5 text-amber-950">
                {lang === 'tl' ? 'Pinakamaraming ulan' : 'Heaviest rain'}: {getDayLabel(highestRainDay.date, displayedForecast.indexOf(highestRainDay), lang)} · {rainfallFor(highestRainDay).toFixed(1)} mm
              </span>
            )}
            {weatherData?.forecast_complete === false && (
              <span role="status" className="rounded-xl bg-amber-100 px-3 py-1.5 text-amber-950">{lang === 'tl' ? 'Hindi kumpleto ang forecast' : 'Forecast incomplete'}</span>
            )}
          </div>
        </div>

        {displayedForecast.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-stone-300 bg-[#FAF9F5] p-6 text-center text-sm text-[#57534E]">
            {loading ? (lang === 'tl' ? 'Kinukuha ang forecast...' : 'Loading forecast...') : L.forecastUnavailable}
          </div>
        ) : (
          <>
            <div className="weather-seven-day-grid grid gap-2">
              {displayedForecast.map((day, index) => {
                const isToday = day.date === todayDate;
                const isSelected = index === selectedDayPosition;
                const high = metricOrNull(day.temperature?.max ?? day.high);
                const low = metricOrNull(day.temperature?.min ?? day.low);
                const rainChance = metricOrNull(day.rainChance);
                const badge = getForecastBadge(day, lang);
                return (
                  <button
                    type="button"
                    key={day.date || index}
                    onClick={() => setSelectedDayIndex(index)}
                    aria-pressed={isSelected}
                    aria-label={`${getDayLabel(day.date, index, lang)}${day.condition ? `, ${day.condition}` : ''}, ${high === null ? '—' : `${high}°`}/${low === null ? '—' : `${low}°`}, ${rainChance === null ? (lang === 'tl' ? 'walang datos ng tsansa ng ulan' : 'rain chance unavailable') : `${rainChance}% ${lang === 'tl' ? 'tsansa ng ulan' : 'rain chance'}`}`}
                    className={`flex min-w-0 flex-col items-center gap-1.5 rounded-2xl border p-2.5 text-center transition focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#14532D] sm:p-3 ${
                      isSelected
                        ? 'border-2 border-[#14532D] bg-[#14532D] text-white shadow-sm'
                        : 'border-stone-200 bg-[#FAF9F5] text-[#1C1917] hover:border-emerald-700'
                    }`}
                  >
                    {isToday && <span className="rounded-full bg-emerald-300 px-2 py-0.5 text-[9px] font-extrabold uppercase tracking-wider text-emerald-950">{lang === 'tl' ? 'Ngayon' : 'Today'}</span>}
                    <span className={`text-xs font-extrabold ${isSelected ? 'text-white' : 'text-[#1C1917]'}`}>{getShortDayLabel(day.date, index, lang)}</span>
                    <span className={`text-[11px] font-medium ${isSelected ? 'text-emerald-200' : 'text-[#57534E]'}`}>{getDateLabel(day.date, index, lang)}</span>
                    <span className={`h-9 w-9 ${isSelected ? 'text-emerald-100' : 'text-sky-800'}`}><WeatherIcon condition={day.condition} code={day.weatherCode} /></span>
                    <span className="font-extrabold text-sm">{high === null ? '—' : `${Math.round(high)}°`} <span className={`text-xs font-semibold ${isSelected ? 'text-emerald-200' : 'text-[#57534E]'}`}>/ {low === null ? '—' : `${Math.round(low)}°`}</span></span>
                    <span className={`text-[10px] font-bold ${isSelected ? 'text-emerald-200' : 'text-sky-800'}`}>{rainChance === null ? '—' : `${lang === 'tl' ? 'Ulan' : 'Rain'}: ${rainChance}%`}</span>
                    <span className={`w-full truncate rounded-lg px-1.5 py-1 text-[9px] font-bold ${isSelected ? 'bg-white/20 text-white' : badge.className}`}>{badge.label}</span>
                  </button>
                );
              })}
            </div>

            <div className="flex flex-col justify-between gap-3 rounded-2xl border border-stone-200 bg-[#FAF9F5] p-4 sm:flex-row sm:items-center">
              <div className="min-w-0">
                <span className="text-xs font-bold uppercase tracking-wider text-[#14532D]">
                  {selectedDayName}{isTodaySelected ? ` · ${lang === 'tl' ? 'Ngayon' : 'Today'}` : ''}
                </span>
                <p className="mt-1 text-sm font-semibold leading-relaxed text-[#1C1917]">{selectedDay?.condition || (lang === 'tl' ? 'Hindi available ang kondisyon.' : 'Condition unavailable.')}</p>
                <p className="mt-1 text-xs leading-relaxed text-[#57534E]">{selectedAdvice}</p>
              </div>
              <div className="grid shrink-0 grid-cols-2 gap-2 text-xs font-bold sm:grid-cols-3">
                <span className="rounded-xl border border-stone-200 bg-white px-3 py-2 text-[#1C1917]">{lang === 'tl' ? 'Tsansa ng ulan' : 'Rain chance'}: {selectedRainChance === null ? '—' : `${selectedRainChance}%`}</span>
                <span className="rounded-xl border border-stone-200 bg-white px-3 py-2 text-[#1C1917]">{lang === 'tl' ? 'Kabuuang ulan' : 'Total rain'}: {selectedRainfall === null ? '—' : `${selectedRainfall.toFixed(1)} mm`}</span>
                <span className="col-span-2 rounded-xl border border-stone-200 bg-white px-3 py-2 text-[#1C1917] sm:col-span-1">{lang === 'tl' ? 'Hangin' : 'Wind'}: {selectedWind === null ? '—' : `${selectedWind} km/h`}</span>
              </div>
            </div>
          </>
        )}
      </section>

      <section className="rounded-3xl border border-stone-200 bg-white p-4 sm:p-6" aria-label={lang === 'tl' ? 'Mga babala sa panahon' : 'Weather alerts'}>
      <Tabs defaultValue="active" className="space-y-4">
        <TabsList className="grid h-auto w-full grid-cols-2 rounded-2xl border border-stone-200 bg-[#FAF9F5] p-1">
          <TabsTrigger value="active" className="min-h-10 rounded-xl text-sm data-[state=active]:bg-[#14532D] data-[state=active]:text-white">{L.activeAlerts} ({activeAlerts.length})</TabsTrigger>
          <TabsTrigger value="history" className="min-h-10 rounded-xl text-sm data-[state=active]:bg-[#14532D] data-[state=active]:text-white">{L.alertHistory} ({inactiveAlerts.length})</TabsTrigger>
        </TabsList>
        <TabsContent value="active" className="space-y-3">
          {activeAlerts.length === 0 ? (
            <div className="flex items-center gap-3 rounded-2xl border border-emerald-200 bg-emerald-50 p-4">
              <CheckCircle2 className="h-5 w-5 shrink-0 text-[#14532D]" aria-hidden="true" />
              <p className="text-sm font-semibold text-[#1C1917]">{L.noActiveAlerts}</p>
            </div>
          ) : activeAlerts.map((alert) => (
            <article key={alert.id} className="rounded-2xl border border-stone-200 bg-white p-4">
              <div className="flex items-start gap-3">
                <span className={`rounded-xl p-2 ${alert.severity === 'critical' || alert.severity === 'high' ? 'bg-red-100 text-red-700' : 'bg-amber-100 text-amber-800'}`}>{getSeverityIcon(alert.type)}</span>
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <h3 className="font-bold text-[#1C1917]">{alert.title}</h3>
                    <Badge variant={getSeverityColor(alert.severity)}>{alert.severity.toUpperCase()}</Badge>
                  </div>
                  <p className="mt-1 text-xs text-[#57534E]">{L.impactIn}: {alert.timeToImpact}</p>
                  <p className="mt-2 text-sm leading-relaxed text-[#1C1917]">{alert.description}</p>
                  <ul className="mt-2 list-inside list-disc space-y-1 text-xs text-[#57534E]">{alert.recommendations.map((recommendation) => <li key={recommendation}>{recommendation}</li>)}</ul>
                </div>
                <Button variant="outline" size="sm" onClick={() => dismissAlert(alert.id)}>{L.dismiss}</Button>
              </div>
            </article>
          ))}
        </TabsContent>
        <TabsContent value="history" className="space-y-3">
          {inactiveAlerts.length === 0
            ? <p className="rounded-2xl border border-stone-200 bg-white p-5 text-center text-sm text-[#57534E]">{L.noHistory}</p>
            : inactiveAlerts.map((alert) => (
              <article key={alert.id} className="rounded-2xl border border-stone-200 bg-white p-4 opacity-75">
                <h3 className="font-bold text-[#1C1917]">{alert.title} · {L.dismissed}</h3>
                <p className="mt-1 text-sm text-[#57534E]">{alert.description}</p>
              </article>
            ))}
        </TabsContent>
      </Tabs>
      </section>
    </section>
  );

}

export default WeatherAlerts;
