import { apiFetch } from '../lib/apiFetch.mjs';
import { readSessionData, writeSessionData } from '../lib/sessionDataCache.mjs';
import { useContext, useEffect, useMemo, useRef, useState } from 'react';
import { LanguageContext } from '../LanguageContext';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from './ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from './ui/tabs';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from './ui/select';
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Legend,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import {
  Download,
  RefreshCw,
} from 'lucide-react';
import {
  Activity3D,
  Leaf3D,
  Rambutan3D,
  RainCloud3D,
  Thermometer3D,
  WaterDrop3D,
} from './Environmental3DIcons';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import PredictionTransactions from './PredictionTransactions';
import SensorReadings from './SensorReadings';

const translations = {
  en: {
    title: 'Farm Overview',
    subtitle: 'Farm performance, environmental trends, and downloadable summaries for your farm.',
    customRange: 'Custom Range',
    startDate: 'Start Date',
    endDate: 'End Date',
    apply: 'Apply',
    monitoringWindow: 'Monitoring Window',
    today: 'Today',
    last3Days: 'Last 3 Days',
    last2Weeks: 'Last 2 Weeks',
    last2Months: 'Last 2 Months',
    last6Months: 'Last 6 Months',
    last7: 'Last 7 Days',
    last30: 'Last 30 Days',
    last90: 'Last 90 Days',
    lastYear: 'Last Year',
    allTime: 'All Time',
    noData: 'No historical data available yet.',
    download: 'Download Summary',
    riskAnalysis: 'Risk Analysis',
    scanCountsStale: 'Showing saved scan counts; the latest refresh failed.',
    scanCountsUnavailable: 'Saved scan counts are unavailable.',
  },
  tl: {
    title: 'Pangkalahatang-ideya ng Bukid',
    subtitle: 'Mga trend ng performance at kapaligiran ng iyong bukid, kasama ang downloadable summary.',
    customRange: 'Pasadyang Saklaw',
    startDate: 'Petsa ng Simula',
    endDate: 'Petsa ng Wakas',
    apply: 'I-apply',
    monitoringWindow: 'Panahon ng Pagsubaybay',
    today: 'Ngayon',
    last3Days: 'Huling 3 Araw',
    last2Weeks: 'Huling 2 Linggo',
    last2Months: 'Huling 2 Buwan',
    last6Months: 'Huling 6 Buwan',
    last7: 'Huling 7 Araw',
    last30: 'Huling 30 Araw',
    last90: 'Huling 90 Araw',
    lastYear: 'Huling Taon',
    allTime: 'Lahat ng Panahon',
    noData: 'Wala pang historical data.',
    download: 'I-download ang Summary',
    riskAnalysis: 'Pagsusuri ng Panganib',
    scanCountsStale: 'Ipinapakita ang naka-save na bilang ng scan; nabigo ang pinakabagong pag-refresh.',
    scanCountsUnavailable: 'Hindi available ang naka-save na bilang ng scan.',
  },
};

const emptyHistory = {
  temperatureData: [],
  rainfallData: [],
  humidityData: [],
  diseaseRiskData: [],
  sensorRecords: [],
  summary: {
    avgTemperature: null,
    totalRainfall: null,
    avgHumidity: null,
    riskLabel: 'No data',
    optimalDays: 0,
    rainyDays: 0,
    currentRisk: null,
    totalRecords: 0,
    days: 0,
  },
  leafDetectionData: [],
  fruitMaturityData: [],
  predictionRecords: [],
  leafLabelBreakdown: [],
  fruitLabelBreakdown: [],
  leafSummary: {
    totalScans: 0,
    avgConfidence: null,
    topLabel: null,
  },
  fruitSummary: {
    totalScans: 0,
    avgConfidence: null,
    topLabel: null,
  },
  rainfallSummary: {
    totalRainfall: null,
    rainyDays: 0,
    dryDays: 0,
    avgPerDay: 0,
    previousPeriodTotal: 0,
    changeFromPrevious: 0,
    peakDay: null,
    lowestDay: null,
    consistentRange: {
      start: null,
      end: null,
      length: 0,
    },
    distribution: {
      rainyPercent: 0,
      dryPercent: 0,
    },
    insights: [],
    patterns: [],
    recommendation: '',
    recommendationSource: 'fallback',
  },
};

const FORECAST_DAYS_BY_RANGE = {
  today: 1,
  '3days': 3,
  '7days': 7,
  '2weeks': 10,
  '2months': 10,
  '6months': 10,
  '30days': 10,
  '90days': 10,
  '1year': 10,
};

function mergeHistoryPayloads(sensorData = {}, predictionData = {}) {
  return {
    ...emptyHistory,
    temperatureData: sensorData.temperatureData || [],
    rainfallData: sensorData.rainfallData || [],
    humidityData: sensorData.humidityData || [],
    diseaseRiskData: sensorData.diseaseRiskData || [],
    sensorRecords: sensorData.sensorRecords || [],
    summary: { ...emptyHistory.summary, ...(sensorData.summary || {}) },
    rainfallSummary: { ...emptyHistory.rainfallSummary, ...(sensorData.rainfallSummary || {}) },
    leafDetectionData: predictionData.leafDetectionData || [],
    fruitMaturityData: predictionData.fruitMaturityData || [],
    predictionRecords: predictionData.predictionRecords || [],
    leafLabelBreakdown: predictionData.leafLabelBreakdown || [],
    fruitLabelBreakdown: predictionData.fruitLabelBreakdown || [],
    leafSummary: { ...emptyHistory.leafSummary, ...(predictionData.leafSummary || {}) },
    fruitSummary: { ...emptyHistory.fruitSummary, ...(predictionData.fruitSummary || {}) },
  };
}

function getSavedPredictionCounts(data) {
  if (!Number.isInteger(data?.leaf_count) || !Number.isInteger(data?.fruit_count)) {
    return null;
  }
  return { leaf: data.leaf_count, maturity: data.fruit_count };
}

function formatValue(value, suffix = '', fallbackText = 'No data') {
  if (value == null || Number.isNaN(value)) return fallbackText;
  return `${value}${suffix}`;
}

function getRiskPresentation(riskLabel, riskValue) {
  const normalized = String(riskLabel || '').toLowerCase();
  if (normalized === 'high' || (riskValue ?? 0) >= 70) {
    return {
      label: 'High',
      badgeClass: 'bg-red-100 text-red-700 border border-red-200',
      barClass: 'bg-red-500',
      iconClass: 'text-red-600',
    };
  }
  if (normalized === 'medium' || (riskValue ?? 0) >= 45) {
    return {
      label: 'Medium',
      badgeClass: 'bg-amber-100 text-amber-700 border border-amber-200',
      barClass: 'bg-amber-500',
      iconClass: 'text-amber-600',
    };
  }
  if (normalized === 'low' || riskValue != null) {
    return {
      label: 'Low',
      badgeClass: 'bg-emerald-100 text-emerald-700 border border-emerald-200',
      barClass: 'bg-emerald-500',
      iconClass: 'text-emerald-600',
    };
  }
  return {
    label: 'No data',
    badgeClass: 'bg-slate-100 text-slate-700 border border-slate-200',
    barClass: 'bg-slate-400',
    iconClass: 'text-slate-500',
  };
}

function getHumidityPresentation(avgHumidity) {
  if (avgHumidity == null) {
    return {
      label: 'No data',
      badgeClass: 'bg-slate-100 text-slate-700 border border-slate-200',
      toneClass: 'text-slate-700',
    };
  }
  if (avgHumidity > 80) {
    return {
      label: 'Too High',
      badgeClass: 'bg-red-100 text-red-700 border border-red-200',
      toneClass: 'text-red-700',
    };
  }
  if (avgHumidity >= 75) {
    return {
      label: 'Slightly High',
      badgeClass: 'bg-amber-100 text-amber-700 border border-amber-200',
      toneClass: 'text-amber-700',
    };
  }
  return {
    label: 'Good',
    badgeClass: 'bg-emerald-100 text-emerald-700 border border-emerald-200',
    toneClass: 'text-emerald-700',
  };
}

function getRainfallPresentation(totalRainfall, rainyDays) {
  if (totalRainfall == null) {
    return {
      label: 'No data',
      badgeClass: 'bg-slate-100 text-slate-700 border border-slate-200',
    };
  }
  if (totalRainfall >= 80 || rainyDays >= 5) {
    return {
      label: 'Heavy Rain',
      badgeClass: 'bg-red-100 text-red-700 border border-red-200',
    };
  }
  if (totalRainfall >= 30 || rainyDays >= 2) {
    return {
      label: 'Moderate Rain',
      badgeClass: 'bg-amber-100 text-amber-700 border border-amber-200',
    };
  }
  return {
    label: 'Light Rain',
    badgeClass: 'bg-emerald-100 text-emerald-700 border border-emerald-200',
  };
}

function buildForecastRainfall(forecast) {
  const validDays = (Array.isArray(forecast) ? forecast : [])
    .map((day) => ({
      ...day,
      rainfall: Number(day?.rainfall),
    }))
    .filter((day) => Number.isFinite(day.rainfall) && day.rainfall >= 0);

  if (!validDays.length) {
    return { data: [], summary: emptyHistory.rainfallSummary };
  }

  let cumulative = 0;
  const data = validDays.map((day) => {
    cumulative += day.rainfall;
    return {
      time: day.day || day.date,
      rainfall: Number(day.rainfall.toFixed(1)),
      cumulative: Number(cumulative.toFixed(1)),
    };
  });
  const totalRainfall = Number(cumulative.toFixed(1));
  const rainyDays = data.filter((day) => day.rainfall > 0).length;
  const dryDays = data.length - rainyDays;
  const peakDay = data.reduce((peak, day) => (!peak || day.rainfall > peak.rainfall ? day : peak), null);
  const lowestDay = data.reduce((lowest, day) => (!lowest || day.rainfall < lowest.rainfall ? day : lowest), null);

  return {
    data,
    summary: {
      ...emptyHistory.rainfallSummary,
      totalRainfall,
      rainyDays,
      dryDays,
      avgPerDay: Number((totalRainfall / data.length).toFixed(1)),
      previousPeriodTotal: null,
      changeFromPrevious: null,
      peakDay,
      lowestDay,
      distribution: {
        rainyPercent: Math.round((rainyDays / data.length) * 100),
        dryPercent: Math.round((dryDays / data.length) * 100),
      },
      recommendation: 'Rainfall values are based on the weather forecast, not calibrated farm rain-gauge measurements.',
    },
  };
}

function HistoryTooltip({ active, payload, label }) {
  if (!active || !payload?.length) return null;

  return (
    <div className="rounded-2xl border border-slate-200 bg-white/95 px-4 py-3 shadow-2xl backdrop-blur-sm transition-all duration-200">
      <p className="mb-2 text-sm font-semibold text-slate-900">{label}</p>
      <div className="space-y-1.5">
        {payload.map((entry) => (
          <div key={entry.name} className="flex items-center justify-between gap-6 text-sm">
            <span className="flex items-center gap-2 text-slate-600">
              <span
                className="inline-block h-2.5 w-2.5 rounded-full"
                style={{ backgroundColor: entry.color }}
              />
              {entry.name}
            </span>
            <span className="font-semibold text-slate-900">{entry.value ?? 'No data'}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

export default function HistoricalData({ location = '' }) {
  const { language } = useContext(LanguageContext);
  const t = translations[language] || translations.en;
  const [timeRange, setTimeRange] = useState('7days');
  const savedPredictionsPath = '/api/predictions/transactions/?page_size=1&page=1';
  const [initialCache] = useState(() => ({
    sensors: readSessionData('/api/sensors/history/?range=7days'),
    predictions: readSessionData('/api/predictions/history/?range=7days'),
    weather: readSessionData('/api/weather/?q=Victoria%2C%20Oriental%20Mindoro%2C%20Philippines&days=7'),
    savedPredictions: readSessionData(savedPredictionsPath),
  }));
  const [activeLogCategory, setActiveLogCategory] = useState('sensors');
  const [savedPredictionCounts, setSavedPredictionCounts] = useState(() => {
    return getSavedPredictionCounts(initialCache.savedPredictions?.data);
  });
  const [savedPredictionCountsError, setSavedPredictionCountsError] = useState(false);
  const [customStartDate, setCustomStartDate] = useState('');
  const [customEndDate, setCustomEndDate] = useState('');
  const [appliedCustomRange, setAppliedCustomRange] = useState({ start: '', end: '' });
  const [history, setHistory] = useState(() => mergeHistoryPayloads(
    initialCache.sensors?.data,
    initialCache.predictions?.data,
  ));
  const initialUpdatedAt = Math.max(
    initialCache.sensors?.savedAt || 0,
    initialCache.predictions?.savedAt || 0,
  );
  const [lastUpdated, setLastUpdated] = useState(initialUpdatedAt ? new Date(initialUpdatedAt) : null);
  const [refreshRevision, setRefreshRevision] = useState(0);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [nlpSummary, setNlpSummary] = useState('');
  const [weatherForecast, setWeatherForecast] = useState(() => initialCache.weather?.data?.forecast || []);
  const [activeSection, setActiveSection] = useState('temperature');
  const [chartRenderKey, setChartRenderKey] = useState(0);
  const sectionTabsRef = useRef(null);
  const activeHistoryPathRef = useRef(null);
  const tabsPointerActiveRef = useRef(false);
  const tabsPointerIdRef = useRef(null);
  const tabsScrollLeftRef = useRef(0);
  const tabsTouchStartXRef = useRef(0);

  useEffect(() => {
    const controller = new AbortController();
    const cached = readSessionData(savedPredictionsPath);
    const cachedCounts = getSavedPredictionCounts(cached?.data);
    if (cachedCounts) setSavedPredictionCounts(cachedCounts);

    async function loadSavedPredictionCounts() {
      try {
        const response = await apiFetch(savedPredictionsPath, {
          signal: controller.signal,
          cache: 'no-store',
        });
        if (!response.ok) throw new Error('Unable to load saved scan counts');
        const result = await response.json();
        const counts = getSavedPredictionCounts(result);
        if (!counts) throw new Error('Invalid saved scan counts response');
        if (!controller.signal.aborted) {
          setSavedPredictionCounts(counts);
          setSavedPredictionCountsError(false);
          writeSessionData(savedPredictionsPath, result);
        }
      } catch {
        if (!controller.signal.aborted) {
          setSavedPredictionCountsError(true);
          if (!cachedCounts) setSavedPredictionCounts(null);
        }
      }
    }

    void loadSavedPredictionCounts();
    return () => controller.abort();
  }, []);

  useEffect(() => {
    let active = true;

    if (timeRange === 'custom' && (!appliedCustomRange.start || !appliedCustomRange.end)) {
      setHistory(emptyHistory);
      return () => {
        active = false;
      };
    }

    const params = new URLSearchParams();
    params.set('range', timeRange);
    if (timeRange === 'custom') {
      params.set('start_date', appliedCustomRange.start);
      params.set('end_date', appliedCustomRange.end);
    }
    const query = params.toString();
    const sensorPath = `/api/sensors/history/?${query}`;
    const predictionPath = `/api/predictions/history/?${query}`;
    const forecastDays = FORECAST_DAYS_BY_RANGE[timeRange] || 7;
    const weatherPath = `/api/weather/?q=Victoria%2C%20Oriental%20Mindoro%2C%20Philippines&days=${forecastDays}`;
    const sensorCache = readSessionData(sensorPath);
    const predictionCache = readSessionData(predictionPath);
    const weatherCache = readSessionData(weatherPath);
    const filterChanged = activeHistoryPathRef.current !== sensorPath;
    if (filterChanged) {
      activeHistoryPathRef.current = sensorPath;
      setHistory(mergeHistoryPayloads(sensorCache?.data, predictionCache?.data));
      setWeatherForecast(weatherCache?.data?.forecast || []);
      const cachedUpdatedAt = Math.max(sensorCache?.savedAt || 0, predictionCache?.savedAt || 0);
      setLastUpdated(cachedUpdatedAt ? new Date(cachedUpdatedAt) : null);
    }

    async function loadHistory() {
      try {
        const res = await apiFetch(sensorPath);
        if (!res.ok) {
          throw new Error('Failed to load history');
        }
        const json = await res.json();
        if (!active) return;
        writeSessionData(sensorPath, json);
        setHistory((prev) => ({
          ...prev,
          temperatureData: json.temperatureData || [],
          rainfallData: json.rainfallData || [],
          humidityData: json.humidityData || [],
          diseaseRiskData: json.diseaseRiskData || [],
          sensorRecords: json.sensorRecords || [],
          summary: { ...emptyHistory.summary, ...(json.summary || {}) },
          rainfallSummary: { ...emptyHistory.rainfallSummary, ...(json.rainfallSummary || {}) },
        }));
        setLastUpdated(new Date());
      } catch (error) {
        if (!active || hasExistingData) return;
      }
    }

    async function loadPredictionHistory() {
      try {
        const res = await apiFetch(predictionPath);
        if (!res.ok) {
          throw new Error('Failed to load prediction history');
        }
        const json = await res.json();
        if (!active) return;
        writeSessionData(predictionPath, json);
        setHistory((prev) => ({
          ...prev,
          leafDetectionData: json.leafDetectionData || [],
          fruitMaturityData: json.fruitMaturityData || [],
          predictionRecords: json.predictionRecords || [],
          leafLabelBreakdown: json.leafLabelBreakdown || [],
          fruitLabelBreakdown: json.fruitLabelBreakdown || [],
          leafSummary: { ...emptyHistory.leafSummary, ...(json.leafSummary || {}) },
          fruitSummary: { ...emptyHistory.fruitSummary, ...(json.fruitSummary || {}) },
        }));
      } catch (error) {
        if (!active || hasExistingData) return;
      }
    }

    async function loadWeatherForecast() {
      try {
        const response = await apiFetch(weatherPath);
        if (!response.ok) throw new Error('Failed to load weather forecast');
        const json = await response.json();
        if (!active) return;
        writeSessionData(weatherPath, json);
        setWeatherForecast(Array.isArray(json.forecast) ? json.forecast : []);
      } catch (error) {
        if (!active) return;
      }
    }

    async function refreshAll() {
      setIsRefreshing(true);
      try {
        await Promise.all([loadHistory(), loadPredictionHistory(), loadWeatherForecast()]);
      } finally {
        if (active) setIsRefreshing(false);
      }
    }

    refreshAll();

    return () => {
      active = false;
    };
  }, [timeRange, appliedCustomRange.start, appliedCustomRange.end, refreshRevision]);

  useEffect(() => {
    setChartRenderKey((prev) => prev + 1);

    const resize = () => window.dispatchEvent(new Event('resize'));
    const firstFrame = requestAnimationFrame(() => {
      resize();
      requestAnimationFrame(resize);
    });

    return () => cancelAnimationFrame(firstFrame);
  }, [activeSection]);

  const handleTabsPointerDown = (event) => {
    const container = sectionTabsRef.current;
    if (!container) return;
    tabsPointerActiveRef.current = true;
    tabsPointerIdRef.current = event.pointerId;
    tabsTouchStartXRef.current = event.clientX;
    tabsScrollLeftRef.current = container.scrollLeft;
    container.setPointerCapture?.(event.pointerId);
  };

  const handleTabsPointerMove = (event) => {
    const container = sectionTabsRef.current;
    if (!container || !tabsPointerActiveRef.current) return;
    if (tabsPointerIdRef.current !== event.pointerId) return;
    event.preventDefault();
    const currentX = event.clientX;
    const deltaX = currentX - tabsTouchStartXRef.current;
    container.scrollLeft = tabsScrollLeftRef.current - deltaX;
  };

  const handleTabsPointerEnd = (event) => {
    const container = sectionTabsRef.current;
    if (tabsPointerIdRef.current !== event.pointerId) return;
    tabsPointerActiveRef.current = false;
    tabsPointerIdRef.current = null;
    container?.releasePointerCapture?.(event.pointerId);
  };

  const handleTabsTouchStartCapture = (event) => {
    const container = sectionTabsRef.current;
    if (!container) return;
    tabsTouchStartXRef.current = event.touches[0]?.clientX ?? 0;
    tabsScrollLeftRef.current = container.scrollLeft;
  };

  const handleTabsTouchMoveCapture = (event) => {
    const container = sectionTabsRef.current;
    if (!container) return;
    const currentX = event.touches[0]?.clientX ?? tabsTouchStartXRef.current;
    const deltaX = currentX - tabsTouchStartXRef.current;
    if (Math.abs(deltaX) < 4) return;
    container.scrollLeft = tabsScrollLeftRef.current - deltaX;
  };

  const {
    temperatureData,
    rainfallData,
    humidityData,
    diseaseRiskData,
    sensorRecords,
    summary,
    leafDetectionData,
    fruitMaturityData,
    predictionRecords,
    leafLabelBreakdown,
    fruitLabelBreakdown,
    leafSummary,
    fruitSummary,
    rainfallSummary,
  } = history;

  const forecastRainfall = useMemo(() => buildForecastRainfall(weatherForecast), [weatherForecast]);
  const displayedRainfallData = forecastRainfall.data.length > 0 ? forecastRainfall.data : rainfallData;
  const displayedRainfallSummary = forecastRainfall.data.length > 0 ? forecastRainfall.summary : rainfallSummary;

  const hasAnyData = useMemo(
    () =>
      temperatureData.length > 0 ||
      rainfallData.length > 0 ||
      humidityData.length > 0 ||
      diseaseRiskData.length > 0 ||
      leafDetectionData.length > 0 ||
      fruitMaturityData.length > 0 ||
      leafLabelBreakdown.length > 0 ||
      fruitLabelBreakdown.length > 0 ||
      weatherForecast.length > 0,
    [temperatureData, rainfallData, humidityData, diseaseRiskData, leafDetectionData, fruitMaturityData, leafLabelBreakdown, fruitLabelBreakdown, weatherForecast],
  );
  const hasExistingData = lastUpdated !== null || hasAnyData;
  const rangeLabel =
    timeRange === 'custom' && appliedCustomRange.start && appliedCustomRange.end ? `${appliedCustomRange.start} to ${appliedCustomRange.end}` :
    timeRange === 'today' ? t.today :
    timeRange === '3days' ? t.last3Days :
    timeRange === '2weeks' ? t.last2Weeks :
    timeRange === '2months' ? t.last2Months :
    timeRange === '6months' ? t.last6Months :
    timeRange === '7days' ? t.last7 :
    timeRange === '30days' ? t.last30 :
    timeRange === 'all' ? t.allTime :
    timeRange === '90days' ? t.last90 :
    t.lastYear;

  const handleApplyCustomRange = () => {
    if (!customStartDate || !customEndDate) return;
    setAppliedCustomRange({ start: customStartDate, end: customEndDate });
  };

  useEffect(() => {
    let active = true;

    async function loadNlpSummary() {
      if (!hasAnyData) {
        setNlpSummary('');
        return;
      }

      try {
        const res = await apiFetch('/api/nlp/summary/', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            kind: 'historical',
            payload: {
              rangeLabel,
              summary,
              rainfallSummary: displayedRainfallSummary,
              leafSummary,
              fruitSummary,
              language,
            },
          }),
        });
        if (!res.ok) throw new Error('Failed to load NLP summary');
        const json = await res.json();
        if (!active) return;
        setNlpSummary(json.summary || '');
      } catch (error) {
        if (!active) return;
        setNlpSummary('');
      }
    }

    loadNlpSummary();
    return () => {
      active = false;
    };
  }, [hasAnyData, rangeLabel, summary, displayedRainfallSummary, leafSummary, fruitSummary, language]);

  const riskUi = getRiskPresentation(summary.riskLabel, summary.currentRisk);
  const riskProgress = Math.max(0, Math.min(100, Math.round(summary.currentRisk ?? 0)));
  const humidityUi = getHumidityPresentation(summary.avgHumidity);
  const rainfallUi = getRainfallPresentation(displayedRainfallSummary.totalRainfall, displayedRainfallSummary.rainyDays);
  const highestHumidityDay = humidityData.length
    ? humidityData.reduce((best, item) => ((item.humidity ?? -1) > (best.humidity ?? -1) ? item : best), humidityData[0])
    : null;
  const lowestHumidityDay = humidityData.length
    ? humidityData.reduce((best, item) => ((item.humidity ?? Number.POSITIVE_INFINITY) < (best.humidity ?? Number.POSITIVE_INFINITY) ? item : best), humidityData[0])
    : null;
  let highHumidityStreak = 0;
  let currentHighHumidityStreak = 0;
  humidityData.forEach((item) => {
    if ((item.humidity ?? 0) >= 80) {
      currentHighHumidityStreak += 1;
      if (currentHighHumidityStreak > highHumidityStreak) {
        highHumidityStreak = currentHighHumidityStreak;
      }
    } else {
      currentHighHumidityStreak = 0;
    }
  });
  const humidityMeaning =
    summary.avgHumidity == null
      ? 'Humidity meaning will appear once more sensor history is available.'
      : summary.avgHumidity >= 75
        ? 'Humidity was slightly high this week. This may increase the chance of plant diseases.'
        : 'Humidity stayed in a manageable range this week. Conditions look more stable for the crop.';
  const humidityWarning =
    highHumidityStreak >= 3
      ? `Humidity was high for ${highHumidityStreak} straight days. Check your plants for signs of disease.`
      : null;

  const farmWeatherValue =
    summary.avgTemperature == null && summary.avgHumidity == null
      ? 'No farm weather data'
      : `${formatValue(summary.avgTemperature, ' C', 'No farm weather data')} / ${formatValue(summary.avgHumidity, '%', 'No farm weather data')}`;

  const wholeSystemSummary = [
    {
      label: 'Monitoring Window',
      value: rangeLabel,
      note: `${summary.totalRecords ?? 0} total environmental record${summary.totalRecords === 1 ? '' : 's'}`,
    },
    {
      label: 'Farm Weather',
      value: farmWeatherValue,
      note: summary.totalRainfall == null
        ? 'No farm weather data available yet.'
        : `Rainfall ${formatValue(summary.totalRainfall, ' mm')} with ${summary.rainyDays ?? 0} rainy day${summary.rainyDays === 1 ? '' : 's'}`,
    },
    {
      label: 'Disease Detection',
      value: `${leafSummary.totalScans ?? 0} scan${leafSummary.totalScans === 1 ? '' : 's'}`,
      note: leafSummary.topLabel ? `Top result: ${leafSummary.topLabel}` : 'No leaf detection data yet',
    },
    {
      label: 'Fruit Maturity',
      value: `${fruitSummary.totalScans ?? 0} scan${fruitSummary.totalScans === 1 ? '' : 's'}`,
      note: fruitSummary.topLabel ? `Top result: ${fruitSummary.topLabel}` : 'No fruit maturity data yet',
    },
    {
      label: 'Overall System',
      value: summary.riskLabel || 'No data',
      note: nlpSummary || 'Whole-system summary will appear here once enough data is available.',
    },
  ];

  const handleDownloadSummary = () => {
    const isTagalog = language === 'tl';
    const pdfText = isTagalog
      ? {
          title: 'Buod ng Bukid',
          subtitle: 'Mga tala at pagsusuri para sa napiling panahon',
          generated: 'Ginawa noong',
          period: 'Panahon ng tala',
          atGlance: 'MABILIS NA BUOD',
          metric: 'Sukatan',
          result: 'Resulta',
          meaning: 'Paliwanag',
          averageTemperature: 'Karaniwang temperatura',
          averageTemperatureMeaning: 'Average mula sa mga naitalang sensor reading.',
          averageHumidity: 'Karaniwang halumigmig',
          averageHumidityMeaning: 'Average mula sa mga naitalang sensor reading.',
          rainfallForecast: 'Inaasahang ulan (forecast)',
          rainfallRecorded: 'Naitalang ulan',
          rainfallForecastMeaning: 'Kabuuan mula sa mga araw na available sa weather forecast; hindi aktuwal na sukat ng rain gauge.',
          rainfallRecordedMeaning: 'Kabuuan mula sa mga naitalang sensor reading.',
          diseaseRisk: 'Tantya ng panganib sa kapaligiran',
          diseaseRiskMeaning: 'Tantya lamang mula sa environmental history; hindi diagnosis ng sakit ng halaman.',
          leafScans: 'Mga scan ng sakit sa dahon',
          leafScansMeaning: 'Bilang ng naka-save na leaf scan sa napiling panahon.',
          fruitScans: 'Mga pagsusuri ng pagkahinog',
          fruitScansMeaning: 'Bilang ng naka-save na fruit scan sa napiling panahon.',
          interpretation: 'ANO ANG IBIG SABIHIN NG MGA TALA?',
          noNarrative: 'Wala pang buod para sa napiling panahon.',
          dailyRecords: 'MGA TALA NG SENSOR SA BAWAT ARAW',
          forecastDetails: 'DETALYE NG FORECAST NG ULAN',
          scanTransactions: 'MGA DETALYE NG BAWAT SCAN',
          scanTransactionsMeaning: 'Bawat hanay ay isang scan na aktuwal na naka-save sa napiling panahon.',
          scanType: 'Uri ng scan',
          scanResult: 'Resulta',
          confidence: 'Kumpiyansa',
          dateAndTime: 'Petsa at oras',
          imageReference: 'Pangalan ng larawan',
          leafScan: 'Sakit sa dahon',
          maturityScan: 'Pagkahinog ng bunga',
          noImageReference: 'Walang pangalan',
          noScans: 'Walang naka-save na scan sa napiling panahon.',
          date: 'Petsa',
          temperature: 'Temperatura (°C)',
          humidity: 'Halumigmig (%)',
          forecastRainfall: 'Ulan sa forecast (mm)',
          environmentalRisk: 'Tantya ng panganib (%)',
          riskNote: 'Ang tantya ng panganib ay hindi diagnosis ng sakit ng halaman.',
          leafBreakdown: 'MGA RESULTA NG SCAN NG DAHON',
          fruitBreakdown: 'MGA RESULTA NG PAGSUSURI NG BUNGA',
          classification: 'Resulta',
          count: 'Bilang',
          totalScans: 'Kabuuang scan',
          avgConfidence: 'Karaniwang kumpiyansa',
          unavailable: 'Walang datos',
          page: 'Pahina',
          of: 'sa',
        }
      : {
          title: 'Farm Overview Summary',
          subtitle: 'Farm records and insights for the selected period',
          generated: 'Generated',
          period: 'Monitoring period',
          atGlance: 'AT A GLANCE',
          metric: 'Measure',
          result: 'Result',
          meaning: 'What it means',
          averageTemperature: 'Average temperature',
          averageTemperatureMeaning: 'Average from recorded sensor readings.',
          averageHumidity: 'Average humidity',
          averageHumidityMeaning: 'Average from recorded sensor readings.',
          rainfallForecast: 'Expected rainfall (forecast)',
          rainfallRecorded: 'Recorded rainfall',
          rainfallForecastMeaning: 'Total across the days currently available in the weather forecast; not a direct rain-gauge measurement.',
          rainfallRecordedMeaning: 'Total from recorded sensor readings.',
          diseaseRisk: 'Environmental risk estimate',
          diseaseRiskMeaning: 'Estimate from environmental history only; not a plant disease diagnosis.',
          leafScans: 'Leaf disease scans',
          leafScansMeaning: 'Saved leaf scans in the selected period.',
          fruitScans: 'Fruit maturity checks',
          fruitScansMeaning: 'Saved fruit scans in the selected period.',
          interpretation: 'WHAT DO THESE RECORDS MEAN?',
          noNarrative: 'No summary is available for this period yet.',
          dailyRecords: 'DAILY SENSOR RECORDS',
          forecastDetails: 'WEATHER FORECAST DETAILS',
          scanTransactions: 'INDIVIDUAL SCAN TRANSACTIONS',
          scanTransactionsMeaning: 'Each row is one scan actually saved during the selected period.',
          scanType: 'Scan type',
          scanResult: 'Result',
          confidence: 'Confidence',
          dateAndTime: 'Date and time',
          imageReference: 'Image file',
          leafScan: 'Leaf disease',
          maturityScan: 'Fruit maturity',
          noImageReference: 'No image name',
          noScans: 'No saved scans in the selected period.',
          date: 'Date',
          temperature: 'Temperature (°C)',
          humidity: 'Humidity (%)',
          forecastRainfall: 'Forecast rain (mm)',
          environmentalRisk: 'Risk estimate (%)',
          riskNote: 'The risk estimate is not a plant disease diagnosis.',
          leafBreakdown: 'LEAF SCAN RESULTS',
          fruitBreakdown: 'FRUIT MATURITY RESULTS',
          classification: 'Result',
          count: 'Count',
          totalScans: 'Total scans',
          avgConfidence: 'Average confidence',
          unavailable: 'No data',
          page: 'Page',
          of: 'of',
        };

    const doc = new jsPDF({ unit: 'pt', format: 'a4' });
    const pageWidth = doc.internal.pageSize.getWidth();
    const pageHeight = doc.internal.pageSize.getHeight();
    const margin = 42;
    const tableMargin = { left: margin, right: margin, top: 54, bottom: 48 };
    const locationLabel = location.trim().replace(/,\s*Philippines$/i, '') || 'Victoria, Oriental Mindoro';
    const generatedAt = new Intl.DateTimeFormat(isTagalog ? 'fil-PH' : 'en-PH', {
      dateStyle: 'medium',
      timeStyle: 'short',
      timeZone: 'Asia/Manila',
    }).format(new Date());
    const formatPdfValue = (value, suffix = '') => {
      const numericValue = Number(value);
      return value == null || value === '' || !Number.isFinite(numericValue)
        ? pdfText.unavailable
        : `${numericValue.toFixed(1)}${suffix}`;
    };
    const riskLabel = isTagalog
      ? ({ High: 'Mataas', Medium: 'Katamtaman', Low: 'Mababa', 'No data': pdfText.unavailable }[riskUi.label] || riskUi.label)
      : riskUi.label;
    const rainfallIsForecast = forecastRainfall.data.length > 0;
    const rainfallLabel = rainfallIsForecast ? pdfText.rainfallForecast : pdfText.rainfallRecorded;
    const rainfallMeaning = rainfallIsForecast ? pdfText.rainfallForecastMeaning : pdfText.rainfallRecordedMeaning;
    const generatedTitle = `${pdfText.title} - RAMBUTECH`;

    doc.setProperties({
      title: generatedTitle,
      subject: `${locationLabel} - ${rangeLabel}`,
      author: 'RAMBUTECH Smart Farming System',
      creator: 'RAMBUTECH',
    });

    doc.setFillColor(20, 83, 45);
    doc.rect(0, 0, pageWidth, 112, 'F');
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(21);
    doc.setTextColor(255, 255, 255);
    doc.text(pdfText.title, margin, 39);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(10);
    doc.setTextColor(226, 245, 233);
    doc.text(pdfText.subtitle, margin, 58);
    doc.text(locationLabel, margin, 76);
    doc.text(`${pdfText.period}: ${rangeLabel}`, margin, 94);
    doc.text(`${pdfText.generated}: ${generatedAt}`, pageWidth - margin, 94, { align: 'right' });

    const sectionHeading = (title, y) => {
      if (y > pageHeight - 90) {
        doc.addPage();
        y = 62;
      }
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(12);
      doc.setTextColor(20, 83, 45);
      doc.text(title, margin, y);
      return y + 8;
    };
    const tableOptions = {
      margin: tableMargin,
      styles: {
        font: 'helvetica',
        fontSize: 9,
        cellPadding: 6,
        textColor: [51, 65, 85],
        overflow: 'linebreak',
        valign: 'middle',
      },
      headStyles: {
        fillColor: [20, 83, 45],
        textColor: [255, 255, 255],
        fontStyle: 'bold',
      },
      alternateRowStyles: { fillColor: [244, 249, 246] },
      theme: 'grid',
      showHead: 'everyPage',
    };
    let y = 140;

    y = sectionHeading(pdfText.atGlance, y);
    autoTable(doc, {
      ...tableOptions,
      startY: y,
      head: [[pdfText.metric, pdfText.result, pdfText.meaning]],
      body: [
        [
          pdfText.averageTemperature,
          formatPdfValue(summary.avgTemperature, ' °C'),
          pdfText.averageTemperatureMeaning,
        ],
        [
          pdfText.averageHumidity,
          formatPdfValue(summary.avgHumidity, '%'),
          pdfText.averageHumidityMeaning,
        ],
        [
          rainfallLabel,
          formatPdfValue(displayedRainfallSummary.totalRainfall, ' mm'),
          rainfallMeaning,
        ],
        [pdfText.diseaseRisk, riskLabel, pdfText.diseaseRiskMeaning],
        [
          pdfText.leafScans,
          String(leafSummary.totalScans ?? 0),
          pdfText.leafScansMeaning,
        ],
        [
          pdfText.fruitScans,
          String(fruitSummary.totalScans ?? 0),
          pdfText.fruitScansMeaning,
        ],
      ],
      columnStyles: {
        0: { cellWidth: 132, fontStyle: 'bold' },
        1: { cellWidth: 94, halign: 'center', fontStyle: 'bold' },
      },
    });
    y = doc.lastAutoTable.finalY + 24;

    y = sectionHeading(pdfText.interpretation, y);
    autoTable(doc, {
      ...tableOptions,
      startY: y,
      body: [[nlpSummary || pdfText.noNarrative]],
      styles: {
        ...tableOptions.styles,
        fillColor: [244, 249, 246],
        fontSize: 10,
        cellPadding: 10,
      },
    });
    y = doc.lastAutoTable.finalY + 24;

    y = sectionHeading(pdfText.dailyRecords, y);
    const sensorRowCount = Math.max(temperatureData.length, humidityData.length, diseaseRiskData.length);
    const sensorDailyRows = Array.from({ length: sensorRowCount }, (_, index) => {
      const startDate = summary.startDate ? new Date(`${summary.startDate}T00:00:00Z`) : null;
      let dateLabel =
        temperatureData[index]?.time
        || humidityData[index]?.time
        || diseaseRiskData[index]?.time
        || pdfText.unavailable;

      if (summary.bucketMode !== 'month' && startDate && !Number.isNaN(startDate.getTime())) {
        startDate.setUTCDate(startDate.getUTCDate() + index);
        dateLabel = new Intl.DateTimeFormat(isTagalog ? 'fil-PH' : 'en-PH', {
          year: 'numeric',
          month: 'short',
          day: 'numeric',
          timeZone: 'UTC',
        }).format(startDate);
      }

      return [
        dateLabel,
        formatPdfValue(temperatureData[index]?.temp, ' °C'),
        formatPdfValue(humidityData[index]?.humidity, '%'),
        formatPdfValue(diseaseRiskData[index]?.risk, '%'),
      ];
    });

    autoTable(doc, {
      ...tableOptions,
      startY: y,
      head: [[pdfText.date, pdfText.temperature, pdfText.humidity, pdfText.environmentalRisk]],
      body: sensorDailyRows,
      columnStyles: {
        0: { cellWidth: 90 },
        1: { halign: 'center' },
        2: { halign: 'center' },
        3: { halign: 'center' },
      },
      didDrawPage: () => {
        doc.setFont('helvetica', 'italic');
        doc.setFontSize(8);
        doc.setTextColor(100, 116, 139);
        doc.text(pdfText.riskNote, margin, pageHeight - 34);
      },
    });
    y = doc.lastAutoTable.finalY + 24;

    if (rainfallIsForecast) {
      y = sectionHeading(pdfText.forecastDetails, y);
      autoTable(doc, {
        ...tableOptions,
        startY: y,
        head: [[pdfText.date, pdfText.forecastRainfall]],
        body: displayedRainfallData.map((record) => [
          record.date || record.time || pdfText.unavailable,
          formatPdfValue(record.rainfall, ' mm'),
        ]),
        columnStyles: { 1: { halign: 'center', cellWidth: 150 } },
      });
      y = doc.lastAutoTable.finalY + 24;
    }

    y = sectionHeading(pdfText.scanTransactions, y);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(9);
    doc.setTextColor(71, 85, 105);
    doc.text(pdfText.scanTransactionsMeaning, margin, y);
    y += 14;
    const scanDateFormatter = new Intl.DateTimeFormat(isTagalog ? 'fil-PH' : 'en-PH', {
      dateStyle: 'medium',
      timeStyle: 'short',
      timeZone: 'Asia/Manila',
    });
    const scanRows = [...predictionRecords]
      .sort((left, right) => new Date(right.createdAt) - new Date(left.createdAt))
      .map((record) => {
        const scanDate = new Date(record.createdAt);
        const dateLabel = Number.isNaN(scanDate.getTime())
          ? pdfText.unavailable
          : scanDateFormatter.format(scanDate);
        const typeLabel = record.type === 'leaf'
          ? pdfText.leafScan
          : record.type === 'rambutan'
            ? pdfText.maturityScan
            : String(record.type || pdfText.unavailable);
        const normalizedLabel = String(record.label || pdfText.unavailable);
        const resultLabel = isTagalog && record.type === 'rambutan'
          ? ['mature', 'ripe'].includes(normalizedLabel.toLowerCase())
            ? 'Hinog'
            : ['immature', 'unripe'].includes(normalizedLabel.toLowerCase())
              ? 'Hilaw'
              : normalizedLabel
          : normalizedLabel;
        const imagePath = String(record.imageName || '');
        const imageName = imagePath.split(/[\\/]/).pop() || pdfText.noImageReference;
        const compactImageName = imageName.length > 32
          ? `${imageName.slice(0, 14)}...${imageName.slice(-12)}`
          : imageName;
        return [
          dateLabel,
          typeLabel,
          resultLabel,
          formatPdfValue(record.confidence, '%'),
          compactImageName,
        ];
      });

    autoTable(doc, {
      ...tableOptions,
      startY: y,
      head: [[pdfText.dateAndTime, pdfText.scanType, pdfText.scanResult, pdfText.confidence, pdfText.imageReference]],
      body: scanRows.length
        ? scanRows
        : [[{ content: pdfText.noScans, colSpan: 5, styles: { halign: 'center' } }]],
      columnStyles: {
        0: { cellWidth: 105 },
        1: { cellWidth: 88 },
        2: { cellWidth: 110 },
        3: { cellWidth: 67, halign: 'center' },
        4: { cellWidth: 99 },
      },
    });
    y = doc.lastAutoTable.finalY + 24;

    const addBreakdown = (title, summaryData, breakdown, color) => {
      if (!breakdown.length) return;
      y = sectionHeading(title, y);
      autoTable(doc, {
        ...tableOptions,
        startY: y,
        head: [[pdfText.classification, pdfText.count]],
        body: breakdown.map((item) => {
          const label = String(item.label || pdfText.unavailable);
          const translatedLabel = isTagalog && ['mature', 'ripe'].includes(label.toLowerCase())
            ? 'Hinog'
            : isTagalog && ['immature', 'unripe'].includes(label.toLowerCase())
              ? 'Hilaw'
              : label;
          return [translatedLabel, String(item.count ?? 0)];
        }),
        headStyles: { ...tableOptions.headStyles, fillColor: color },
        columnStyles: { 1: { halign: 'center', cellWidth: 100 } },
      });
      y = doc.lastAutoTable.finalY + 8;
      if (y > pageHeight - 55) {
        doc.addPage();
        y = 62;
      }
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(9);
      doc.setTextColor(71, 85, 105);
      const confidence = formatPdfValue(summaryData.avgConfidence, '%');
      doc.text(
        `${pdfText.totalScans}: ${summaryData.totalScans ?? 0}  |  ${pdfText.avgConfidence}: ${confidence}`,
        margin,
        y,
      );
      y += 20;
    };

    addBreakdown(pdfText.leafBreakdown, leafSummary, leafLabelBreakdown, [16, 185, 129]);
    addBreakdown(pdfText.fruitBreakdown, fruitSummary, fruitLabelBreakdown, [234, 88, 12]);

    const pageCount = doc.getNumberOfPages();
    for (let pageNumber = 1; pageNumber <= pageCount; pageNumber += 1) {
      doc.setPage(pageNumber);
      if (pageNumber > 1) {
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(8);
        doc.setTextColor(20, 83, 45);
        doc.text(`${generatedTitle} | ${rangeLabel}`, margin, 30);
      }
      doc.setDrawColor(226, 232, 240);
      doc.line(margin, pageHeight - 24, pageWidth - margin, pageHeight - 24);
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(8);
      doc.setTextColor(100, 116, 139);
      doc.text(`${pdfText.page} ${pageNumber} ${pdfText.of} ${pageCount}`, pageWidth - margin, pageHeight - 10, { align: 'right' });
    }

    doc.save(`historical-summary-${timeRange}.pdf`);
  };

  return (
    <div className="historical-data-page mx-auto w-full max-w-[1360px] space-y-5 overflow-x-hidden sm:space-y-6">
      <section className="farm-overview-header flex flex-col gap-4">
        <div className="min-w-0">
          <h2 className="mt-1 text-xl font-bold tracking-tight text-slate-900 sm:text-2xl">{t.title}</h2>
          <p className="mt-1 max-w-2xl text-xs text-slate-600 sm:text-sm">
            {language === 'tl'
              ? `Komprehensibong tala at pagsusuri para sa ${(location.trim().replace(/,\s*Philippines$/i, '') || 'Victoria, Oriental Mindoro')}.`
              : `Comprehensive logs and analytics for ${(location.trim().replace(/,\s*Philippines$/i, '') || 'Victoria, Oriental Mindoro')}.`}
          </p>
        </div>

        <div className="flex min-w-0 flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-end">
          <div className="min-w-0">
            <p className="mb-1 text-xs font-semibold text-slate-600">{t.monitoringWindow}</p>
            <Select value={timeRange} onValueChange={setTimeRange}>
              <SelectTrigger className="farm-overview-range-select min-h-10 border-slate-300 bg-white text-slate-800">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="custom">{t.customRange}</SelectItem>
                <SelectItem value="today">{t.today}</SelectItem>
                <SelectItem value="3days">{t.last3Days}</SelectItem>
                <SelectItem value="2weeks">{t.last2Weeks}</SelectItem>
                <SelectItem value="2months">{t.last2Months}</SelectItem>
                <SelectItem value="6months">{t.last6Months}</SelectItem>
                <SelectItem value="7days">{t.last7}</SelectItem>
                <SelectItem value="30days">{t.last30}</SelectItem>
                <SelectItem value="all">{t.allTime}</SelectItem>
                <SelectItem value="90days">{t.last90}</SelectItem>
                <SelectItem value="1year">{t.lastYear}</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <button
            type="button"
            onClick={() => setRefreshRevision((revision) => revision + 1)}
            disabled={isRefreshing || (timeRange === 'custom' && (!appliedCustomRange.start || !appliedCustomRange.end))}
            className="inline-flex min-h-10 items-center justify-center gap-2 rounded-xl border border-slate-400 bg-white px-4 py-2 text-sm font-semibold text-slate-800 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-60"
          >
            <RefreshCw className={`h-4 w-4 ${isRefreshing ? 'animate-spin' : ''}`} aria-hidden="true" />
            {language === 'tl' ? 'I-refresh ang mga tala' : 'Refresh logs'}
          </button>
          <button
            type="button"
            onClick={handleDownloadSummary}
            className="inline-flex min-h-10 items-center justify-center gap-2 rounded-xl bg-[#1D6F42] px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-[#165934]"
          >
            <Download className="h-4 w-4" aria-hidden="true" />
            {language === 'tl' ? 'I-download ang buod' : 'Export PDF Summary'}
          </button>
        </div>
      </section>

      {timeRange === 'custom' && (
        <div className="flex flex-col gap-2 rounded-2xl border border-slate-200 bg-white p-3 sm:flex-row sm:items-end">
          <label className="flex flex-col text-xs font-medium text-slate-600">
            {t.startDate}
            <input
              type="date"
              value={customStartDate}
              onChange={(e) => setCustomStartDate(e.target.value)}
              className="mt-1 min-h-10 rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900"
            />
          </label>
          <label className="flex flex-col text-xs font-medium text-slate-600">
            {t.endDate}
            <input
              type="date"
              value={customEndDate}
              onChange={(e) => setCustomEndDate(e.target.value)}
              className="mt-1 min-h-10 rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900"
            />
          </label>
          <button
            type="button"
            onClick={handleApplyCustomRange}
            className="min-h-10 rounded-lg bg-[#1D6F42] px-4 py-2 text-sm font-semibold text-white transition hover:bg-[#165934] disabled:opacity-50"
            disabled={!customStartDate || !customEndDate}
          >
            {t.apply}
          </button>
        </div>
      )}

      <div className="flex flex-col gap-2 rounded-2xl border border-[#F5E1A4] bg-[#FEF9EC] px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex min-w-0 items-center gap-2.5 text-xs font-medium text-slate-800 sm:text-sm">
          <span className={`h-2.5 w-2.5 shrink-0 rounded-full ${lastUpdated ? 'bg-emerald-600' : 'bg-amber-500'}`} />
          <span className="min-w-0">
            {language === 'tl'
              ? `Panahon ng tala: ${rangeLabel} · ${summary.totalRecords ?? 0} environmental record · Lokal na timezone`
              : `Monitoring window: ${rangeLabel} · ${summary.totalRecords ?? 0} environmental records · Local timezone`}
          </span>
        </div>
        <span className="shrink-0 text-[11px] font-medium text-slate-500">
          {lastUpdated
            ? `${language === 'tl' ? 'Huling na-update:' : 'Last updated:'} ${lastUpdated.toLocaleString(language === 'tl' ? 'fil-PH' : 'en-PH')}`
            : (language === 'tl' ? 'Wala pang naitalang update' : 'No update recorded yet')}
        </span>
      </div>

      <section aria-label={language === 'tl' ? 'Mga pangunahing sukatan' : 'Executive summary metrics'} className="farm-overview-kpi-grid gap-4">
        <article className="flex min-w-0 flex-col justify-between rounded-[18px] border border-[#E2ECE6] bg-white p-5 shadow-sm">
          <div className="flex items-start justify-between gap-2">
            <div>
              <p className="text-[11px] font-bold uppercase tracking-[0.06em] text-slate-500">{language === 'tl' ? 'Average na Temperatura' : 'Average Temperature'}</p>
              <p className="mt-2.5 font-display text-[28px] font-bold leading-none text-slate-900">{formatValue(summary.avgTemperature, '°C', '—')}</p>
            </div>
            <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl border border-[#E2ECE6] bg-[#F4F8F6] text-amber-600">
              <Thermometer3D className="farm-overview-animated-svg h-8 w-8" />
            </span>
          </div>
          <p className="mt-4 border-t border-slate-100 pt-3 text-xs text-slate-500">{rangeLabel}</p>
        </article>

        <article className="flex min-w-0 flex-col justify-between rounded-[18px] border border-[#E2ECE6] bg-white p-5 shadow-sm">
          <div className="flex items-start justify-between gap-2">
            <div className="min-w-0">
              <p className="text-[11px] font-bold uppercase tracking-[0.06em] text-slate-500">{language === 'tl' ? 'Halumigmig sa Hangin' : 'Air Moisture / Humidity'}</p>
              <div className="mt-2.5 flex flex-wrap items-baseline gap-2">
                <span className="font-display text-[28px] font-bold leading-none text-slate-900">{formatValue(summary.avgHumidity, '%', '—')}</span>
                <span className={`inline-flex rounded-full px-2.5 py-0.5 text-[11px] font-semibold ${humidityUi.badgeClass}`}>{humidityUi.label}</span>
              </div>
            </div>
            <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl border border-[#E2ECE6] bg-[#F4F8F6] text-sky-600">
              <WaterDrop3D className="farm-overview-animated-svg h-8 w-8" />
            </span>
          </div>
          <p className="mt-4 border-t border-slate-100 pt-3 text-xs text-slate-500">{rangeLabel}</p>
        </article>

        <article className="flex min-w-0 flex-col justify-between rounded-[18px] border border-[#E2ECE6] bg-white p-5 shadow-sm">
          <div className="flex items-start justify-between gap-2">
            <div>
              <p className="text-[11px] font-bold uppercase tracking-[0.06em] text-slate-500">{language === 'tl' ? 'Panganib ng Sakit' : 'Disease Pressure'}</p>
              <div className="mt-2.5 flex flex-wrap items-baseline gap-2">
                <span className="font-display text-[28px] font-bold leading-none text-slate-900">{formatValue(summary.currentRisk, '%', '—')}</span>
                <span className={`inline-flex rounded-full px-2.5 py-0.5 text-[11px] font-semibold ${riskUi.badgeClass}`}>{riskUi.label}</span>
              </div>
            </div>
            <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl border border-[#E2ECE6] bg-[#F4F8F6] text-amber-600">
              <Leaf3D className="farm-overview-animated-svg h-8 w-8" />
            </span>
          </div>
          <div className="mt-4 border-t border-slate-100 pt-3">
            <div className="h-2 overflow-hidden rounded-full bg-slate-100">
              <div className={`h-full rounded-full transition-all ${riskUi.barClass}`} style={{ width: `${riskProgress}%` }} />
            </div>
          </div>
        </article>

        <article className="flex min-w-0 flex-col justify-between rounded-[18px] border border-[#E2ECE6] bg-white p-5 shadow-sm">
          <div className="flex items-start justify-between gap-2">
            <div>
              <p className="text-[11px] font-bold uppercase tracking-[0.06em] text-slate-500">{language === 'tl' ? 'Mga Naka-save na Scan' : 'AI Scan Transactions'}</p>
              <div className="mt-2.5 flex items-baseline gap-2">
                <span className="font-display text-[28px] font-bold leading-none text-slate-900">
                  {savedPredictionCounts
                    ? savedPredictionCounts.leaf + savedPredictionCounts.maturity
                    : '—'}
                </span>
                <span className="text-xs font-medium text-slate-500">{language === 'tl' ? 'naka-save na scan' : 'saved scans'}</span>
              </div>
            </div>
            <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl border border-[#E2ECE6] bg-[#F4F8F6] text-[#1D6F42]">
              <Activity3D className="farm-overview-animated-svg h-8 w-8" />
            </span>
          </div>
          <div className="mt-4 flex flex-wrap items-center gap-2 border-t border-slate-100 pt-3 text-[11px] font-semibold text-slate-700">
            <span className="rounded-full border border-[#E2ECE6] bg-[#F8FAF9] px-2.5 py-1">Leaf: {savedPredictionCounts?.leaf ?? '—'}</span>
            <span className="rounded-full border border-[#E2ECE6] bg-[#F8FAF9] px-2.5 py-1">Fruit: {savedPredictionCounts?.maturity ?? '—'}</span>
          </div>
          {savedPredictionCountsError && (
            <p role="status" className="mt-2 text-xs text-amber-800">
              {savedPredictionCounts ? t.scanCountsStale : t.scanCountsUnavailable}
            </p>
          )}
        </article>
      </section>

      {!hasAnyData ? (
        <Card className="border-slate-200 bg-white/85 shadow-sm backdrop-blur-sm">
          <CardContent className="py-10 text-center text-slate-700">{t.noData}</CardContent>
        </Card>
      ) : (
        <>
          <Card className="overflow-hidden border border-[#E2ECE6] bg-white shadow-sm">
              <CardContent className="w-full max-w-full space-y-4 overflow-x-hidden">
                <Tabs value={activeSection} onValueChange={setActiveSection} className="w-full space-y-6 overflow-x-hidden">
                  <div className="farm-overview-trends-grid">
                    <div className="farm-overview-trends-main min-w-0">
                  <div
                    ref={sectionTabsRef}
                    onPointerDown={handleTabsPointerDown}
                    onPointerMove={handleTabsPointerMove}
                    onPointerUp={handleTabsPointerEnd}
                    onPointerCancel={handleTabsPointerEnd}
                    onTouchStartCapture={handleTabsTouchStartCapture}
                    onTouchMoveCapture={handleTabsTouchMoveCapture}
                    className="scrollbar-hide relative z-10 mb-3 w-full select-none overflow-x-auto"
                  >
                    <TabsList className="flex h-auto w-max min-w-full gap-1 rounded-xl border border-[#E2ECE6] bg-[#F8FAF9] p-1.5 shadow-sm sm:gap-1.5">
                    <TabsTrigger data-section-tab="temperature" value="temperature" title="Temperature" className="group flex min-h-10 shrink-0 items-center justify-center gap-2 rounded-lg border border-transparent px-3 py-2 text-xs font-medium text-slate-600 transition data-[state=active]:border-[#1D6F42] data-[state=active]:bg-[#1D6F42] data-[state=active]:text-white data-[state=active]:shadow-sm"><Thermometer3D className="size-5 shrink-0 transition-transform duration-300 group-hover:-translate-y-0.5 group-hover:scale-110 motion-reduce:transition-none" /><span>Temperature</span></TabsTrigger>
                    <TabsTrigger data-section-tab="rainfall" value="rainfall" title="Rainfall" className="group flex min-h-10 shrink-0 items-center justify-center gap-2 rounded-lg border border-transparent px-3 py-2 text-xs font-medium text-slate-600 transition data-[state=active]:border-[#1D6F42] data-[state=active]:bg-[#1D6F42] data-[state=active]:text-white data-[state=active]:shadow-sm"><RainCloud3D className="size-5 shrink-0 transition-transform duration-300 group-hover:-translate-y-0.5 group-hover:scale-110 motion-reduce:transition-none" isRaining /><span>Rainfall</span></TabsTrigger>
                    <TabsTrigger data-section-tab="humidity-detail" value="humidity-detail" title="Humidity" className="group flex min-h-10 shrink-0 items-center justify-center gap-2 rounded-lg border border-transparent px-3 py-2 text-xs font-medium text-slate-600 transition data-[state=active]:border-[#1D6F42] data-[state=active]:bg-[#1D6F42] data-[state=active]:text-white data-[state=active]:shadow-sm"><WaterDrop3D className="size-5 shrink-0 transition-transform duration-300 group-hover:-translate-y-0.5 group-hover:scale-110 motion-reduce:transition-none" /><span>Humidity</span></TabsTrigger>
                    <TabsTrigger data-section-tab="leaf-detection" value="leaf-detection" title="Leaf Detection" className="group flex min-h-10 shrink-0 items-center justify-center gap-2 rounded-lg border border-transparent px-3 py-2 text-xs font-medium text-slate-600 transition data-[state=active]:border-[#1D6F42] data-[state=active]:bg-[#1D6F42] data-[state=active]:text-white data-[state=active]:shadow-sm"><Leaf3D className="size-5 shrink-0 transition-transform duration-300 group-hover:-translate-y-0.5 group-hover:scale-110 motion-reduce:transition-none" /><span>Leaf Scans</span></TabsTrigger>
                    <TabsTrigger data-section-tab="fruit-maturity" value="fruit-maturity" title="Fruit Maturity" className="group flex min-h-10 shrink-0 items-center justify-center gap-2 rounded-lg border border-transparent px-3 py-2 text-xs font-medium text-slate-600 transition data-[state=active]:border-[#1D6F42] data-[state=active]:bg-[#1D6F42] data-[state=active]:text-white data-[state=active]:shadow-sm"><Rambutan3D className="size-5 shrink-0 transition-transform duration-300 group-hover:-translate-y-0.5 group-hover:scale-110 motion-reduce:transition-none" /><span>Fruit Maturity</span></TabsTrigger>
                    </TabsList>
                  </div>

                  <div className="relative z-0 w-full min-w-0 max-w-full overflow-x-hidden overscroll-x-none pt-2 [touch-action:pan-y]">
                  <TabsContent value="temperature" className="w-full min-w-0 max-w-full overflow-x-hidden space-y-4">
                    <Card className="w-full max-w-full overflow-hidden border border-[#E2ECE6] bg-white shadow-sm">
                      <CardHeader>
                        <CardTitle className="text-slate-900">Temperature Trend</CardTitle>
                        <CardDescription className="text-slate-700">
                          Orange temperature curve with fill, plus the dashed optimal guide.
                        </CardDescription>
                      </CardHeader>
                      <CardContent>
                        <div className="h-[260px] w-full sm:h-[350px]">
                        <ResponsiveContainer key={`temperature-${chartRenderKey}`} width="100%" height="100%">
                          <AreaChart data={temperatureData}>
                            <defs>
                              <linearGradient id="tempFill" x1="0" y1="0" x2="0" y2="1">
                                <stop offset="5%" stopColor="#f59e0b" stopOpacity={0.35} />
                                <stop offset="95%" stopColor="#f59e0b" stopOpacity={0.03} />
                              </linearGradient>
                            </defs>
                            <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                            <XAxis dataKey="time" stroke="#64748b" style={{ fontSize: '12px' }} />
                            <YAxis stroke="#64748b" style={{ fontSize: '12px' }} label={{ value: 'Temperature (C)', angle: -90, position: 'insideLeft' }} />
                            <Tooltip content={<HistoryTooltip />} />
                            <Legend />
                            <Area
                              type="monotone"
                              dataKey="temp"
                              stroke="#f59e0b"
                              strokeWidth={3}
                              fill="url(#tempFill)"
                              name="Temperature"
                              activeDot={{ r: 7, fill: '#f59e0b', stroke: '#fff', strokeWidth: 3 }}
                            />
                            <Line
                              type="monotone"
                              dataKey="optimal"
                              stroke="#10b981"
                              strokeWidth={2.5}
                              strokeDasharray="6 6"
                              dot={false}
                              name="Optimal Temp"
                            />
                          </AreaChart>
                        </ResponsiveContainer>
                        </div>
                      </CardContent>
                    </Card>

                  </TabsContent>

                  <TabsContent value="rainfall" className="w-full min-w-0 max-w-full overflow-x-hidden space-y-4">
                    <Card className="w-full max-w-full overflow-hidden border border-sky-100 bg-gradient-to-r from-sky-50 to-white shadow-sm">
                      <CardContent className="px-6 py-6 sm:px-7 sm:py-7">
                        <div className="flex items-center gap-4">
                          <RainCloud3D className="farm-overview-animated-svg h-12 w-12 shrink-0" />
                          <div className="min-w-0">
                            <p className="text-sm font-semibold text-slate-600">Expected Rainfall · Next 7 Days</p>
                            <div className="mt-2 flex flex-wrap items-center gap-3">
                              <span className="font-display text-2xl font-bold text-slate-950 sm:text-3xl">
                                {formatValue(displayedRainfallSummary.totalRainfall, ' mm')}
                              </span>
                              <span className={`inline-flex items-center rounded-full px-3 py-1.5 text-sm font-medium ${rainfallUi.badgeClass}`}>
                                {rainfallUi.label}
                              </span>
                            </div>
                          </div>
                        </div>
                      </CardContent>
                    </Card>

                    <Card className="w-full max-w-full overflow-hidden border border-sky-100 bg-gradient-to-br from-sky-50 to-white shadow-sm">
                      <CardHeader>
                        <CardTitle className="font-display text-slate-900">Daily Rainfall Forecast</CardTitle>
                        <CardDescription className="text-slate-700">
                          Expected rainfall in millimeters, shown by day.
                        </CardDescription>
                      </CardHeader>
                      <CardContent>
                        <div className="h-[260px] w-full sm:h-[350px]">
                        <ResponsiveContainer key={`rainfall-${chartRenderKey}`} width="100%" height="100%">
                          <BarChart data={displayedRainfallData}>
                            <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                            <XAxis dataKey="time" stroke="#64748b" style={{ fontSize: '12px' }} />
                            <YAxis stroke="#64748b" style={{ fontSize: '12px' }} label={{ value: 'Daily (mm)', angle: -90, position: 'insideLeft' }} />
                            <Tooltip
                              formatter={(value, name) => {
                                if (name === 'Daily Rainfall') {
                                  const numeric = Number(value);
                                  const meaning = numeric >= 12 ? 'Heavy Rain' : numeric >= 5 ? 'Moderate Rain' : 'Light Rain';
                                  return [`${numeric} mm (${meaning})`, name];
                                }
                                return [value, name];
                              }}
                              contentStyle={{ backgroundColor: 'white', border: '1px solid #e2e8f0', borderRadius: '16px' }}
                            />
                            <Bar dataKey="rainfall" fill="#0ea5e9" name="Daily Rainfall" radius={[10, 10, 0, 0]} />
                          </BarChart>
                        </ResponsiveContainer>
                        </div>
                      </CardContent>
                    </Card>

                  </TabsContent>

                  <TabsContent value="humidity-detail" className="w-full min-w-0 max-w-full overflow-x-hidden space-y-4">
                    <Card className="w-full max-w-full overflow-hidden border border-emerald-100 bg-gradient-to-r from-emerald-50 to-white shadow-sm">
                      <CardContent className="px-6 py-6 sm:px-7 sm:py-7">
                        <div>
                          <p className="text-sm font-medium text-slate-600">Humidity This Week</p>
                          <div className="mt-2 flex flex-wrap items-center gap-3">
                            <span className="text-2xl font-bold text-slate-950 sm:text-3xl">
                              {summary.avgHumidity == null ? 'No humidity data' : formatValue(summary.avgHumidity, '%')}
                            </span>
                            <span className={`inline-flex items-center rounded-full px-3 py-1.5 text-sm font-medium ${humidityUi.badgeClass}`}>
                              {summary.avgHumidity == null ? 'No data' : humidityUi.label}
                            </span>
                          </div>
                        </div>
                      </CardContent>
                    </Card>

                    <Card className="w-full max-w-full overflow-hidden border border-emerald-100 bg-gradient-to-br from-emerald-50 to-white shadow-sm">
                      <CardHeader>
                        <CardTitle className="text-slate-900">Humidity in the Past 7 Days</CardTitle>
                        <CardDescription className="text-slate-700">
                          A simpler humidity view with clear day-by-day meaning.
                        </CardDescription>
                      </CardHeader>
                      <CardContent>
                        <div className="h-[260px] w-full sm:h-[350px]">
                        <ResponsiveContainer key={`humidity-${chartRenderKey}`} width="100%" height="100%">
                          <AreaChart data={humidityData}>
                            <defs>
                              <linearGradient id="humidityFill" x1="0" y1="0" x2="0" y2="1">
                                <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.32} />
                                <stop offset="95%" stopColor="#3b82f6" stopOpacity={0.04} />
                              </linearGradient>
                            </defs>
                            <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                            <XAxis dataKey="time" stroke="#64748b" style={{ fontSize: '12px' }} />
                            <YAxis stroke="#64748b" style={{ fontSize: '12px' }} label={{ value: 'Humidity (%)', angle: -90, position: 'insideLeft' }} />
                            <Tooltip
                              formatter={(value, name) => {
                                if (name === 'Humidity') {
                                  const numeric = Number(value);
                                  const meaning = numeric > 80 ? 'High' : numeric >= 75 ? 'Slightly High' : 'Good';
                                  return [`${numeric}% (${meaning})`, name];
                                }
                                return [value, name];
                              }}
                              contentStyle={{ backgroundColor: 'white', border: '1px solid #e2e8f0', borderRadius: '16px' }}
                            />
                            <Legend />
                            <Area
                              type="monotone"
                              dataKey="humidity"
                              stroke="#3b82f6"
                              strokeWidth={3}
                              fill="url(#humidityFill)"
                              name="Humidity"
                              activeDot={{ r: 7, fill: '#3b82f6', stroke: '#fff', strokeWidth: 3 }}
                            />
                          </AreaChart>
                        </ResponsiveContainer>
                        </div>
                      </CardContent>
                    </Card>

                    <Card className="border border-slate-200 bg-white shadow-sm">
                      <CardHeader>
                        <CardTitle className="text-slate-900">What this means</CardTitle>
                      </CardHeader>
                      <CardContent className="space-y-4 px-6 pb-6 pt-2 sm:px-7 sm:pb-7">
                        <div className="rounded-2xl bg-emerald-50 px-5 py-5 text-sm text-slate-700 sm:px-6">
                          <p className="font-medium text-emerald-900">What this means:</p>
                          <p className="mt-2">{humidityMeaning}</p>
                        </div>

                        {humidityWarning && (
                          <div className="rounded-2xl border border-amber-200 bg-amber-50 px-5 py-5 text-sm text-amber-800 sm:px-6">
                            <p className="font-medium">Warning:</p>
                            <p className="mt-2">{humidityWarning}</p>
                          </div>
                        )}
                      </CardContent>
                    </Card>

                    <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                      <Card className="border border-slate-200 bg-white shadow-sm">
                        <CardHeader>
                          <CardTitle className="text-slate-900">Easy Highlights</CardTitle>
                        </CardHeader>
                        <CardContent className="space-y-4 px-6 pb-6 pt-2 text-sm text-slate-700 sm:px-7 sm:pb-7">
                          <div className="flex items-center justify-between">
                            <span>Highest</span>
                            <span className="font-semibold text-slate-900">
                              {formatValue(highestHumidityDay?.humidity, '%')} ({highestHumidityDay?.time || 'No data'})
                            </span>
                          </div>
                          <div className="flex items-center justify-between">
                            <span>Lowest</span>
                            <span className="font-semibold text-slate-900">
                              {formatValue(lowestHumidityDay?.humidity, '%')} ({lowestHumidityDay?.time || 'No data'})
                            </span>
                          </div>
                        </CardContent>
                      </Card>

                      <Card className="border border-slate-200 bg-white shadow-sm">
                        <CardHeader>
                          <CardTitle className="text-slate-900">Humidity Guide</CardTitle>
                        </CardHeader>
                        <CardContent className="space-y-3 px-6 pb-6 pt-2 text-sm text-slate-700 sm:px-7 sm:pb-7">
                          <div className="flex items-center justify-between">
                            <span>Good Range</span>
                            <span className="font-semibold text-emerald-700">Below 75%</span>
                          </div>
                          <div className="flex items-center justify-between">
                            <span>Slightly High</span>
                            <span className="font-semibold text-amber-700">75% to 80%</span>
                          </div>
                          <div className="flex items-center justify-between">
                            <span>Too High</span>
                            <span className="font-semibold text-red-700">Above 80%</span>
                          </div>
                        </CardContent>
                      </Card>
                    </div>
                  </TabsContent>

                  <TabsContent value="leaf-detection" className="w-full min-w-0 max-w-full overflow-x-hidden space-y-4">
                    <Card className="w-full min-w-0 max-w-full overflow-hidden border border-emerald-100 bg-gradient-to-br from-emerald-50 to-white shadow-sm">
                      <CardHeader>
                          <CardTitle className="flex items-center gap-2 text-base text-slate-900">
                            <span className="h-7 w-7"><Leaf3D className="transition-transform duration-300 hover:-translate-y-0.5 hover:scale-110 motion-reduce:transition-none" /></span>
                          Leaf Detection Activity
                        </CardTitle>
                        <CardDescription className="text-slate-700">
                          Saved disease scans and average confidence over the selected range.
                        </CardDescription>
                      </CardHeader>
                      <CardContent className="min-w-0 px-6 py-6 sm:px-7 sm:py-7">
                        <div className="h-[260px] w-full min-w-0 sm:h-[320px]">
                        <ResponsiveContainer key={`leaf-${chartRenderKey}`} width="100%" height="100%">
                          <BarChart data={leafDetectionData}>
                            <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                            <XAxis dataKey="time" stroke="#64748b" style={{ fontSize: '12px' }} />
                            <YAxis yAxisId="left" stroke="#64748b" style={{ fontSize: '12px' }} />
                            <YAxis yAxisId="right" orientation="right" stroke="#64748b" style={{ fontSize: '12px' }} />
                            <Tooltip content={<HistoryTooltip />} />
                            <Legend />
                            <Bar yAxisId="left" dataKey="count" fill="#10b981" name="Leaf Scans" radius={[10, 10, 0, 0]} />
                            <Line yAxisId="right" type="monotone" dataKey="avgConfidence" stroke="#0f766e" strokeWidth={3} name="Avg Confidence %" activeDot={{ r: 7, fill: '#0f766e', stroke: '#fff', strokeWidth: 3 }} />
                          </BarChart>
                        </ResponsiveContainer>
                        </div>
                      </CardContent>
                    </Card>

                    <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                      <Card className="border border-slate-200 bg-white shadow-sm">
                        <CardHeader>
                          <CardTitle className="text-slate-900">Leaf Detection Summary</CardTitle>
                        </CardHeader>
                        <CardContent className="space-y-3 px-6 pb-6 pt-2 text-sm text-slate-700 sm:px-7 sm:pb-7">
                          <div className="flex items-center justify-between">
                            <span>Total Scans</span>
                            <span className="font-semibold text-slate-900">{leafSummary.totalScans ?? 0}</span>
                          </div>
                          <div className="flex items-center justify-between">
                            <span>Average Confidence</span>
                            <span className="font-semibold text-slate-900">{formatValue(leafSummary.avgConfidence, '%')}</span>
                          </div>
                          <div className="flex items-center justify-between">
                            <span>Top Result</span>
                            <span className="font-semibold text-slate-900">{leafSummary.topLabel || 'No leaf detection data'}</span>
                          </div>
                        </CardContent>
                      </Card>

                      <Card className="border border-slate-200 bg-white shadow-sm">
                        <CardHeader>
                          <CardTitle className="text-slate-900">Leaf Detection Breakdown</CardTitle>
                        </CardHeader>
                        <CardContent className="space-y-3 px-6 pb-6 pt-2 sm:px-7 sm:pb-7">
                          {leafLabelBreakdown.length ? leafLabelBreakdown.slice(0, 5).map((item) => (
                            <div key={item.label} className="flex items-center justify-between text-sm">
                              <span className="text-slate-700">{item.label}</span>
                              <span className="font-semibold text-slate-900">{item.count}</span>
                            </div>
                          )) : (
                            <p className="text-sm text-slate-500">No leaf detection history yet.</p>
                          )}
                        </CardContent>
                      </Card>
                    </div>
                  </TabsContent>

                  <TabsContent value="fruit-maturity" className="w-full min-w-0 max-w-full overflow-x-hidden space-y-4">
                    <Card className="w-full min-w-0 max-w-full overflow-hidden border border-orange-100 bg-gradient-to-br from-orange-50 to-white shadow-sm">
                      <CardHeader>
                          <CardTitle className="flex items-center gap-2 text-base text-slate-900">
                            <span className="h-7 w-7"><Rambutan3D className="transition-transform duration-300 hover:-translate-y-0.5 hover:scale-110 motion-reduce:transition-none" /></span>
                          Fruit Maturity Activity
                        </CardTitle>
                        <CardDescription className="text-slate-700">
                          Historical rambutan maturity scans and confidence trend.
                        </CardDescription>
                      </CardHeader>
                      <CardContent className="min-w-0 px-6 py-6 sm:px-7 sm:py-7">
                        <div className="h-[260px] w-full min-w-0 sm:h-[320px]">
                        <ResponsiveContainer key={`fruit-${chartRenderKey}`} width="100%" height="100%">
                          <BarChart data={fruitMaturityData}>
                            <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                            <XAxis dataKey="time" stroke="#64748b" style={{ fontSize: '12px' }} />
                            <YAxis yAxisId="left" stroke="#64748b" style={{ fontSize: '12px' }} />
                            <YAxis yAxisId="right" orientation="right" stroke="#64748b" style={{ fontSize: '12px' }} />
                            <Tooltip content={<HistoryTooltip />} />
                            <Legend />
                            <Bar yAxisId="left" dataKey="count" fill="#f97316" name="Fruit Scans" radius={[10, 10, 0, 0]} />
                            <Line yAxisId="right" type="monotone" dataKey="avgConfidence" stroke="#c2410c" strokeWidth={3} name="Avg Confidence %" activeDot={{ r: 7, fill: '#c2410c', stroke: '#fff', strokeWidth: 3 }} />
                          </BarChart>
                        </ResponsiveContainer>
                        </div>
                      </CardContent>
                    </Card>

                    <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                      <Card className="border border-slate-200 bg-white shadow-sm">
                        <CardHeader>
                          <CardTitle className="text-slate-900">Fruit Maturity Summary</CardTitle>
                        </CardHeader>
                        <CardContent className="space-y-3 px-6 pb-6 pt-2 text-sm text-slate-700 sm:px-7 sm:pb-7">
                          <div className="flex items-center justify-between">
                            <span>Total Scans</span>
                            <span className="font-semibold text-slate-900">{fruitSummary.totalScans ?? 0}</span>
                          </div>
                          <div className="flex items-center justify-between">
                            <span>Average Confidence</span>
                            <span className="font-semibold text-slate-900">{formatValue(fruitSummary.avgConfidence, '%')}</span>
                          </div>
                          <div className="flex items-center justify-between">
                            <span>Top Result</span>
                            <span className="font-semibold text-slate-900">{fruitSummary.topLabel || 'No fruit maturity data'}</span>
                          </div>
                        </CardContent>
                      </Card>

                      <Card className="border border-slate-200 bg-white shadow-sm">
                        <CardHeader>
                          <CardTitle className="text-slate-900">Fruit Maturity Breakdown</CardTitle>
                        </CardHeader>
                        <CardContent className="space-y-3 px-6 pb-6 pt-2 sm:px-7 sm:pb-7">
                          {fruitLabelBreakdown.length ? fruitLabelBreakdown.slice(0, 5).map((item) => (
                            <div key={item.label} className="flex items-center justify-between text-sm">
                              <span className="text-slate-700">{item.label}</span>
                              <span className="font-semibold text-slate-900">{item.count}</span>
                            </div>
                          )) : (
                            <p className="text-sm text-slate-500">No fruit maturity history yet.</p>
                          )}
                        </CardContent>
                      </Card>
                    </div>
                  </TabsContent>
                  </div>
                    </div>
                    <aside className="farm-overview-risk-guide min-w-0 rounded-[18px] border border-[#E2ECE6] bg-white p-5 shadow-sm sm:p-6">
                      <div className="flex items-start justify-between gap-2">
                        <div>
                          <h3 className="text-base font-bold text-slate-900 sm:text-[17px]">
                            {language === 'tl' ? 'Gabay sa Panganib at Aksyon' : 'Farm Risk & Action Guide'}
                          </h3>
                          <p className="mt-0.5 text-xs text-slate-500">
                            {language === 'tl' ? 'Batay sa mga tala sa napiling panahon.' : 'Based on recorded data for this period.'}
                          </p>
                        </div>
                        <span className="shrink-0 rounded-full bg-[#DCFCE7] px-3 py-1 text-[11px] font-semibold text-[#166534]">{rangeLabel}</span>
                      </div>

                      <div className="mt-4 space-y-3">
                        <article className="rounded-2xl border border-[#E2ECE6] bg-[#F8FAF9] p-3.5">
                          <div className="flex items-center justify-between gap-2">
                            <span className="text-[13px] font-bold text-slate-900">{language === 'tl' ? 'Panganib ng Sakit' : 'Disease Pressure'}</span>
                            <span className={`rounded-full px-2.5 py-0.5 text-[11px] font-semibold ${riskUi.badgeClass}`}>
                              {riskUi.label}{summary.currentRisk == null ? '' : ` · ${formatValue(summary.currentRisk, '%')}`}
                            </span>
                          </div>
                          <p className="mt-1.5 text-xs leading-relaxed text-slate-600">
                            {summary.currentRisk == null
                              ? (language === 'tl' ? 'Walang sapat na environmental history para matukoy ang risk sa panahong ito.' : 'There is not enough environmental history to estimate risk for this period.')
                              : (language === 'tl' ? 'Tantya ito mula sa naitalang environmental history, hindi diagnosis ng halaman.' : 'This estimate uses recorded environmental history; it is not a plant diagnosis.')}
                          </p>
                        </article>

                        <article className="rounded-2xl border border-[#E2ECE6] bg-[#F8FAF9] p-3.5">
                          <div className="flex items-center justify-between gap-2">
                            <span className="text-[13px] font-bold text-slate-900">{language === 'tl' ? 'Pagsubaybay sa Halumigmig' : 'Humidity Watch'}</span>
                            <span className={`rounded-full px-2.5 py-0.5 text-[11px] font-semibold ${humidityUi.badgeClass}`}>
                              {humidityUi.label}
                            </span>
                          </div>
                          <p className="mt-1.5 text-xs leading-relaxed text-slate-600">
                            {summary.avgHumidity == null
                              ? (language === 'tl' ? 'Walang humidity history para sa napiling panahon.' : 'No humidity history is available for this period.')
                              : summary.avgHumidity > 80
                                ? (language === 'tl' ? 'Mataas ang average humidity. Suriin ang mga dahon sa siksik o malilim na bahagi ng puno.' : 'Average humidity is above 80%. Check leaves in dense or shaded parts of the canopy.')
                                : (language === 'tl' ? 'Magpatuloy sa regular na pagsusuri ng mga dahon.' : 'Continue routine checks for changes in leaf condition.')}
                          </p>
                        </article>

                        <article className="rounded-2xl border border-[#E2ECE6] bg-[#F8FAF9] p-3.5">
                          <div className="flex items-center justify-between gap-2">
                            <span className="text-[13px] font-bold text-slate-900">{language === 'tl' ? 'Ulan sa Forecast' : 'Rainfall Outlook'}</span>
                            <span className={`rounded-full px-2.5 py-0.5 text-[11px] font-semibold ${rainfallUi.badgeClass}`}>
                              {formatValue(displayedRainfallSummary.totalRainfall, ' mm', language === 'tl' ? 'Walang datos' : 'Unavailable')}
                            </span>
                          </div>
                          <p className="mt-1.5 text-xs leading-relaxed text-slate-600">
                            {language === 'tl' ? 'Kabuuang ulan mula sa forecast para sa napiling panahon.' : 'Expected rainfall total from the forecast for the selected period.'}
                          </p>
                        </article>
                      </div>

                      <div className="mt-4 border-t border-slate-100 pt-3.5">
                        <p className="mb-2 text-[11px] font-bold uppercase tracking-[0.06em] text-slate-500">
                          {language === 'tl' ? 'MGA BUOD SA PANAHON' : 'PERIOD SUMMARY HIGHLIGHTS'}
                        </p>
                        <div className="grid grid-cols-2 gap-2.5">
                          <div className="rounded-xl border border-[#E2ECE6] bg-[#F8FAF9] px-3 py-2">
                            <p className="text-[11px] text-slate-500">{language === 'tl' ? 'Pinakamalakas na Ulan' : 'Heaviest Rain'}</p>
                            <p className="mt-0.5 text-xs font-bold text-slate-900">
                              {displayedRainfallSummary.peakDay
                                ? `${displayedRainfallSummary.peakDay.time} · ${formatValue(displayedRainfallSummary.peakDay.rainfall, ' mm')}`
                                : (language === 'tl' ? 'Walang datos' : 'Unavailable')}
                            </p>
                          </div>
                          <div className="rounded-xl border border-[#E2ECE6] bg-[#F8FAF9] px-3 py-2">
                            <p className="text-[11px] text-slate-500">{language === 'tl' ? 'Ulat' : 'Report Status'}</p>
                            <p className="mt-0.5 text-xs font-bold text-[#1D6F42]">{language === 'tl' ? 'Handa i-export' : 'PDF Export Ready'}</p>
                          </div>
                        </div>
                      </div>
                    </aside>
                  </div>
                </Tabs>
              </CardContent>
          </Card>
        </>
      )}

      {hasAnyData && (
        <Card className="border border-[#E2ECE6] bg-white shadow-sm">
          <CardHeader>
            <CardTitle className="text-base text-slate-900">{language === 'tl' ? 'Buod ng Buong Sistema' : 'Whole-System Summary'}</CardTitle>
            <CardDescription className="text-sm text-slate-600">
              {language === 'tl'
                ? 'Pinagsamang buod ng environmental monitoring, disease scans, at maturity checks para sa napiling panahon.'
                : 'Combined summary from environmental monitoring, disease scans, and maturity checks for this period.'}
            </CardDescription>
          </CardHeader>
          <CardContent className="pb-6 pt-0">
            <div className="rounded-2xl border border-emerald-100 bg-gradient-to-r from-emerald-50 to-cyan-50 p-4 sm:p-5">
              <p className="text-sm font-semibold text-emerald-900">{language === 'tl' ? 'Buod ng kalagayan ng bukid' : 'Overall System Narrative'}</p>
              <p className="mt-2 text-sm leading-7 text-slate-700">
                {nlpSummary || (language === 'tl' ? 'Wala pang buod para sa napiling panahon.' : 'No whole-system narrative is available for this period yet.')}
              </p>
            </div>
          </CardContent>
        </Card>
      )}

      <section aria-label={language === 'tl' ? 'Mga tala ng bukid' : 'Farm logs'} className="rounded-[18px] border border-[#E2ECE6] bg-white p-3 shadow-sm sm:p-5">
        <Tabs value={activeLogCategory} onValueChange={setActiveLogCategory} className="w-full">
          <TabsList className="flex h-auto w-full flex-wrap justify-start gap-2 rounded-none border-b border-slate-100 bg-transparent p-0 pb-3">
            <TabsTrigger
              value="sensors"
              className="group inline-flex min-h-10 items-center gap-2 rounded-xl border border-[#E2ECE6] bg-[#F8FAF9] px-4 py-2 text-xs font-semibold text-slate-700 data-[state=active]:border-[#114228] data-[state=active]:bg-[#114228] data-[state=active]:text-white sm:text-[13px]"
            >
              <Thermometer3D className="h-5 w-5 transition-transform duration-300 group-hover:-translate-y-0.5 group-hover:scale-110" />
              {language === 'tl' ? 'Mga Reading ng Sensor' : 'Sensor Readings'}
            </TabsTrigger>
            <TabsTrigger
              value="leaf-scans"
              className="group inline-flex min-h-10 items-center gap-2 rounded-xl border border-[#E2ECE6] bg-[#F8FAF9] px-4 py-2 text-xs font-semibold text-slate-700 data-[state=active]:border-[#114228] data-[state=active]:bg-[#114228] data-[state=active]:text-white sm:text-[13px]"
            >
              <Leaf3D className="h-5 w-5 transition-transform duration-300 group-hover:-translate-y-0.5 group-hover:scale-110" />
              <span>{language === 'tl' ? 'Mga Scan ng Sakit sa Dahon' : 'Leaf Disease Scans'}</span>
              <span className="rounded-full bg-slate-200 px-2 py-0.5 text-[11px] leading-none text-slate-700 group-data-[state=active]:bg-white/20 group-data-[state=active]:text-white">
                {savedPredictionCounts?.leaf ?? '—'}
              </span>
            </TabsTrigger>
            <TabsTrigger
              value="maturity-scans"
              className="group inline-flex min-h-10 items-center gap-2 rounded-xl border border-[#E2ECE6] bg-[#F8FAF9] px-4 py-2 text-xs font-semibold text-slate-700 data-[state=active]:border-[#114228] data-[state=active]:bg-[#114228] data-[state=active]:text-white sm:text-[13px]"
            >
              <Rambutan3D className="h-5 w-5 transition-transform duration-300 group-hover:-translate-y-0.5 group-hover:scale-110" />
              <span>{language === 'tl' ? 'Mga Scan ng Pagkahinog' : 'Maturity Assessment Scans'}</span>
              <span className="rounded-full bg-slate-200 px-2 py-0.5 text-[11px] leading-none text-slate-700 group-data-[state=active]:bg-white/20 group-data-[state=active]:text-white">
                {savedPredictionCounts?.maturity ?? '—'}
              </span>
            </TabsTrigger>
          </TabsList>
          <TabsContent value="sensors" className="mt-4">
            <SensorReadings />
          </TabsContent>
          <TabsContent value="leaf-scans" className="mt-4">
            <PredictionTransactions predictionType="leaf" onCountsChange={setSavedPredictionCounts} />
          </TabsContent>
          <TabsContent value="maturity-scans" className="mt-4">
            <PredictionTransactions predictionType="rambutan" onCountsChange={setSavedPredictionCounts} />
          </TabsContent>
        </Tabs>
      </section>
    </div>
  );
}
