import { apiFetch } from '../lib/apiFetch.mjs';
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
  AlertTriangle,
  Apple,
  Clock3,
  Download,
  Droplets,
  Leaf,
  Thermometer,
} from 'lucide-react';
import { Leaf3D, Lightbulb3D, Rambutan3D, RainCloud3D, Thermometer3D, WaterDrop3D } from './Environmental3DIcons';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import html2canvas from 'html2canvas';

const translations = {
  en: {
    title: 'Farm Overview',
    subtitle: 'Farm performance, environmental trends, and downloadable summaries for your farm.',
    customRange: 'Custom Range',
    startDate: 'Start Date',
    endDate: 'End Date',
    apply: 'Apply',
    today: 'Today',
    last3Days: 'Last 3 Days',
    last2Weeks: 'Last 2 Weeks',
    last2Months: 'Last 2 Months',
    last6Months: 'Last 6 Months',
    last7: 'Last 7 Days',
    last30: 'Last 30 Days',
    last90: 'Last 90 Days',
    lastYear: 'Last Year',
    noData: 'No historical data available yet.',
    download: 'Download Summary',
    riskAnalysis: 'Risk Analysis',
  },
  tl: {
    title: 'Pangkalahatang-ideya ng Bukid',
    subtitle: 'Mga trend ng performance at kapaligiran ng iyong bukid, kasama ang downloadable summary.',
    customRange: 'Custom Range',
    startDate: 'Petsa ng Simula',
    endDate: 'Petsa ng Wakas',
    apply: 'I-apply',
    today: 'Ngayon',
    last3Days: 'Huling 3 Araw',
    last2Weeks: 'Huling 2 Linggo',
    last2Months: 'Huling 2 Buwan',
    last6Months: 'Huling 6 Buwan',
    last7: 'Huling 7 Araw',
    last30: 'Huling 30 Araw',
    last90: 'Huling 90 Araw',
    lastYear: 'Huling Taon',
    noData: 'Wala pang historical data.',
    download: 'I-download ang Summary',
    riskAnalysis: 'Pagsusuri ng Panganib',
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

function SectionHeader({ icon: Icon, visual: Visual, title, description }) {
  return (
    <div className="flex items-center gap-2.5">
      <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-emerald-50 p-1.5 text-emerald-700">
        {Visual ? <Visual /> : <Icon className="h-4 w-4" />}
      </div>
      <div>
        <h3 className="text-base font-bold text-slate-900">{title}</h3>
        <p className="text-xs text-slate-600 sm:text-sm">{description}</p>
      </div>
    </div>
  );
}

export default function HistoricalData() {
  const { language } = useContext(LanguageContext);
  const t = translations[language] || translations.en;
  const [timeRange, setTimeRange] = useState('7days');
  const [customStartDate, setCustomStartDate] = useState('');
  const [customEndDate, setCustomEndDate] = useState('');
  const [appliedCustomRange, setAppliedCustomRange] = useState({ start: '', end: '' });
  const [history, setHistory] = useState(emptyHistory);
  const [lastUpdated, setLastUpdated] = useState(null);
  const [nlpSummary, setNlpSummary] = useState('');
  const [nlpSource, setNlpSource] = useState('fallback');
  const [weatherForecast, setWeatherForecast] = useState([]);
  const [activeSection, setActiveSection] = useState('temperature');
  const [chartRenderKey, setChartRenderKey] = useState(0);
  const sectionTabsRef = useRef(null);
  const tabsPointerActiveRef = useRef(false);
  const tabsPointerIdRef = useRef(null);
  const tabsScrollLeftRef = useRef(0);
  const tabsTouchStartXRef = useRef(0);

  // Refs used to snapshot each chart as an image for the PDF export
  const temperatureChartRef = useRef(null);
  const rainfallChartRef = useRef(null);
  const humidityChartRef = useRef(null);
  const leafChartRef = useRef(null);
  const fruitChartRef = useRef(null);

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

    async function loadHistory() {
      try {
        const res = await apiFetch(`/api/sensors/history/?${params.toString()}`);
        if (!res.ok) {
          throw new Error('Failed to load history');
        }
        const json = await res.json();
        if (!active) return;
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
        const res = await apiFetch(`/api/predictions/history/?${params.toString()}`);
        if (!res.ok) {
          throw new Error('Failed to load prediction history');
        }
        const json = await res.json();
        if (!active) return;
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
        const rangeDays = {
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
        const forecastDays = rangeDays[timeRange] || 7;
        const response = await apiFetch(`/api/weather/?q=Victoria%2C%20Oriental%20Mindoro%2C%20Philippines&days=${forecastDays}`);
        if (!response.ok) throw new Error('Failed to load weather forecast');
        const json = await response.json();
        if (!active) return;
        setWeatherForecast(Array.isArray(json.forecast) ? json.forecast : []);
      } catch (error) {
        if (active) setWeatherForecast([]);
      }
    }

    async function refreshAll() {
      await Promise.all([loadHistory(), loadPredictionHistory(), loadWeatherForecast()]);
    }

    refreshAll();

    return () => {
      active = false;
    };
  }, [timeRange, appliedCustomRange.start, appliedCustomRange.end]);

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
  const heaviestRainfall = rainfallData.some((item) => item.rainfall != null)
    ? Math.max(...rainfallData.filter((item) => item.rainfall != null).map((item) => item.rainfall))
    : null;

  const rangeLabel =
    timeRange === 'custom' && appliedCustomRange.start && appliedCustomRange.end ? `${appliedCustomRange.start} to ${appliedCustomRange.end}` :
    timeRange === 'today' ? t.today :
    timeRange === '3days' ? t.last3Days :
    timeRange === '2weeks' ? t.last2Weeks :
    timeRange === '2months' ? t.last2Months :
    timeRange === '6months' ? t.last6Months :
    timeRange === '7days' ? t.last7 :
    timeRange === '30days' ? t.last30 :
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
        setNlpSource('fallback');
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
              rainfallSummary,
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
        setNlpSource(json.source || 'fallback');
      } catch (error) {
        if (!active) return;
        setNlpSummary('');
        setNlpSource('fallback');
      }
    }

    loadNlpSummary();
    return () => {
      active = false;
    };
  }, [hasAnyData, rangeLabel, summary, rainfallSummary, leafSummary, fruitSummary, language]);

  const riskUi = getRiskPresentation(summary.riskLabel, summary.currentRisk);
  const riskProgress = Math.max(0, Math.min(100, Math.round(summary.currentRisk ?? 0)));
  const humidityUi = getHumidityPresentation(summary.avgHumidity);
  const rainfallUi = getRainfallPresentation(rainfallSummary.totalRainfall, rainfallSummary.rainyDays);
  const rainfallMeaning =
    rainfallSummary.totalRainfall == null
      ? 'Rainfall meaning will appear once more sensor history is available.'
      : rainfallUi.label === 'Heavy Rain'
        ? 'Rainfall was heavy this week. Soil may stay too wet and affect plant health.'
        : rainfallUi.label === 'Moderate Rain'
          ? 'Rainfall was steady this week. This is generally good for crop growth.'
          : 'Rainfall stayed light this week. Conditions are relatively dry and may need closer watering attention.';
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

  const insights = [
    summary.avgTemperature != null
      ? `Temperature is ${summary.avgTemperature > 30 ? 'slightly above' : 'within'} the usual target range this ${rangeLabel.toLowerCase()}.`
      : 'Temperature insight will appear once more environmental records are available.',
    summary.avgHumidity != null
      ? `${summary.avgHumidity >= 75 ? 'High humidity may increase disease risk' : 'Humidity levels look manageable'} based on the recorded sensor trend.`
      : 'Humidity insight will appear once more sensor data is collected.',
    summary.totalRainfall == null ? 'Measured rainfall data is unavailable for the selected period.' : summary.totalRainfall > 0
      ? `${summary.rainyDays} rainy day${summary.rainyDays === 1 ? '' : 's'} contributed to ${summary.totalRainfall} mm total rainfall.`
      : 'No meaningful rainfall was recorded for the selected period.',
  ];

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

  // ---------- PDF export helpers ----------
  const captureChartImage = async (ref) => {
    if (!ref.current) return null;
    try {
      const canvas = await html2canvas(ref.current, {
        backgroundColor: '#ffffff',
        scale: 2,
      });
      return canvas.toDataURL('image/png');
    } catch (error) {
      console.error('Chart capture failed', error);
      return null;
    }
  };

  const handleDownloadSummary = async () => {
    const doc = new jsPDF({ unit: 'pt', format: 'a4' });
    const pageWidth = doc.internal.pageSize.getWidth();
    const pageHeight = doc.internal.pageSize.getHeight();
    const margin = 40;
    let y = margin;

    // ---------- Header: Logo, Petsa, Period ----------
    try {
      // Point this at your actual logo (public/ path or an imported base64 string)
      doc.addImage('/logo.png', 'PNG', margin, y, 50, 50);
    } catch (error) {
      // Logo is optional — continue without it if it fails to load
    }
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(18);
    doc.setTextColor('#0f766e');
    doc.text('RAMBUTECH Smart Farming System', margin + 60, y + 20);

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(10);
    doc.setTextColor('#475569');
    doc.text(`Petsa: ${new Date().toLocaleString('en-PH')}`, margin + 60, y + 36);
    doc.text(`Period: ${rangeLabel}`, margin + 60, y + 50);

    y += 72;
    doc.setDrawColor('#e2e8f0');
    doc.line(margin, y, pageWidth - margin, y);
    y += 24;

    // ---------- 1. Key Metrics Cards ----------
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(13);
    doc.setTextColor('#0f172a');
    doc.text('Key Metrics', margin, y);
    y += 16;

    const metrics = [
      { label: 'Avg Temperature', value: formatValue(summary.avgTemperature, ' C') },
      { label: 'Avg Humidity', value: formatValue(summary.avgHumidity, '%') },
      { label: 'Total Rainfall', value: formatValue(summary.totalRainfall, ' mm') },
      { label: 'Disease Risk', value: summary.riskLabel || 'No data' },
    ];

    const cardWidth = (pageWidth - margin * 2 - 3 * 10) / 4;
    const cardHeight = 60;
    metrics.forEach((metric, index) => {
      const x = margin + index * (cardWidth + 10);
      doc.setFillColor('#f8fafc');
      doc.setDrawColor('#e2e8f0');
      doc.roundedRect(x, y, cardWidth, cardHeight, 6, 6, 'FD');
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(8);
      doc.setTextColor('#64748b');
      doc.text(metric.label.toUpperCase(), x + 8, y + 18);
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(16);
      doc.setTextColor('#0f172a');
      doc.text(String(metric.value), x + 8, y + 40);
    });
    y += cardHeight + 28;

    // ---------- 2. Charts (rendered as images, falls back to the data table below) ----------
    const chartSections = [
      { ref: temperatureChartRef, title: 'Temperature Trend' },
      { ref: rainfallChartRef, title: 'Rainfall (Past 7 Days)' },
      { ref: humidityChartRef, title: 'Humidity (Past 7 Days)' },
      { ref: leafChartRef, title: 'Leaf Detection Activity' },
      { ref: fruitChartRef, title: 'Fruit Maturity Activity' },
    ];

    for (const section of chartSections) {
      const imgData = await captureChartImage(section.ref);

      if (y > pageHeight - 220) {
        doc.addPage();
        y = margin;
      }

      doc.setFont('helvetica', 'bold');
      doc.setFontSize(12);
      doc.setTextColor('#0f172a');
      doc.text(section.title, margin, y);
      y += 10;

      if (imgData) {
        const imgWidth = pageWidth - margin * 2;
        const imgHeight = imgWidth * 0.45;
        doc.addImage(imgData, 'PNG', margin, y, imgWidth, imgHeight);
        y += imgHeight + 20;
      } else {
        doc.setFont('helvetica', 'italic');
        doc.setFontSize(9);
        doc.setTextColor('#94a3b8');
        doc.text('Chart unavailable — see data table below.', margin, y + 12);
        y += 30;
      }
    }

    // ---------- 3. Narrative & Insights ----------
    if (y > pageHeight - 160) {
      doc.addPage();
      y = margin;
    }
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(13);
    doc.setTextColor('#0f172a');
    doc.text('Narrative & Insights', margin, y);
    y += 18;

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(10);
    doc.setTextColor('#334155');
    const narrativeText = nlpSummary || 'No whole-system narrative is available yet.';
    const narrativeLines = doc.splitTextToSize(narrativeText, pageWidth - margin * 2);
    doc.text(narrativeLines, margin, y);
    y += narrativeLines.length * 13 + 14;

    insights.forEach((insight) => {
      const lines = doc.splitTextToSize(`- ${insight}`, pageWidth - margin * 2);
      if (y > pageHeight - 60) {
        doc.addPage();
        y = margin;
      }
      doc.text(lines, margin, y);
      y += lines.length * 13 + 4;
    });

    y += 14;

    // ---------- 4. Data Table ----------
    if (y > pageHeight - 100) {
      doc.addPage();
      y = margin;
    }
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(13);
    doc.setTextColor('#0f172a');
    doc.text('Daily Data', margin, y);

    const rowCount = Math.max(
      temperatureData.length,
      humidityData.length,
      rainfallData.length,
      diseaseRiskData.length,
    );
    const dailyRows = [];
    for (let i = 0; i < rowCount; i += 1) {
      const dateLabel =
        temperatureData[i]?.time ||
        humidityData[i]?.time ||
        rainfallData[i]?.time ||
        diseaseRiskData[i]?.time ||
        '';
      dailyRows.push([
        dateLabel,
        temperatureData[i]?.temp ?? 'No data',
        humidityData[i]?.humidity ?? 'No data',
        rainfallData[i]?.rainfall ?? 'No data',
        diseaseRiskData[i]?.risk ?? 'No data',
      ]);
    }

    autoTable(doc, {
      startY: y + 8,
      head: [['Date', 'Temp (C)', 'Humidity (%)', 'Rainfall (mm)', 'Disease Risk (%)']],
      body: dailyRows,
      margin: { left: margin, right: margin },
      styles: { fontSize: 8, cellPadding: 4 },
      headStyles: { fillColor: [15, 118, 110] },
      theme: 'striped',
    });

    let finalY = doc.lastAutoTable.finalY + 24;

    if (leafLabelBreakdown.length) {
      if (finalY > pageHeight - 100) {
        doc.addPage();
        finalY = margin;
      }
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(12);
      doc.setTextColor('#0f172a');
      doc.text('Leaf Detection Breakdown', margin, finalY);
      autoTable(doc, {
        startY: finalY + 8,
        head: [['Label', 'Count']],
        body: leafLabelBreakdown.map((item) => [item.label, item.count]),
        margin: { left: margin, right: margin },
        styles: { fontSize: 8, cellPadding: 4 },
        headStyles: { fillColor: [16, 185, 129] },
        theme: 'striped',
      });
      finalY = doc.lastAutoTable.finalY + 24;
    }

    if (fruitLabelBreakdown.length) {
      if (finalY > pageHeight - 100) {
        doc.addPage();
        finalY = margin;
      }
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(12);
      doc.setTextColor('#0f172a');
      doc.text('Fruit Maturity Breakdown', margin, finalY);
      autoTable(doc, {
        startY: finalY + 8,
        head: [['Label', 'Count']],
        body: fruitLabelBreakdown.map((item) => [item.label, item.count]),
        margin: { left: margin, right: margin },
        styles: { fontSize: 8, cellPadding: 4 },
        headStyles: { fillColor: [249, 115, 22] },
        theme: 'striped',
      });
    }

    doc.save(`historical-summary-${timeRange}.pdf`);
  };

  return (
    <div className="historical-data-page relative mx-auto w-full max-w-6xl space-y-4 overflow-x-hidden px-3 sm:space-y-6 sm:px-6">
      <div className="pointer-events-none absolute inset-0 -z-10 bg-[radial-gradient(circle_at_top_left,rgba(59,130,246,0.12),transparent_30%),radial-gradient(circle_at_top_right,rgba(16,185,129,0.10),transparent_25%),linear-gradient(180deg,rgba(241,245,249,0.65),rgba(255,255,255,0))]" />
      <div className="pointer-events-none absolute right-0 top-8 -z-10 h-40 w-40 rounded-full bg-emerald-200/30 blur-3xl" />
      <div className="pointer-events-none absolute left-0 top-64 -z-10 h-56 w-56 rounded-full bg-sky-200/30 blur-3xl" />

      <Card className="border-none bg-gradient-to-r from-emerald-600 via-teal-600 to-cyan-600 text-white shadow-xl">
          <CardHeader>
          <div className="flex flex-col gap-5 lg:flex-row lg:items-start lg:justify-between">
            <div className="space-y-3">
              <div className="flex items-center gap-2 text-sm font-medium text-white/90">
                <Clock3 className="h-4 w-4" />
                {lastUpdated && <span>Last updated {lastUpdated.toLocaleTimeString()}</span>}
              </div>
              <div>
                <CardTitle className="text-xl text-white sm:text-2xl">{t.title}</CardTitle>
                <CardDescription className="mt-1 max-w-2xl text-xs text-white/90 sm:text-sm">
                  {t.subtitle}
                </CardDescription>
              </div>
            </div>

            <div className="flex flex-col gap-3 sm:flex-row">
              <Select value={timeRange} onValueChange={setTimeRange}>
                <SelectTrigger className="w-full border-white/30 bg-white/20 text-white backdrop-blur-md sm:w-[180px]">
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
                  <SelectItem value="90days">{t.last90}</SelectItem>
                  <SelectItem value="1year">{t.lastYear}</SelectItem>
                </SelectContent>
              </Select>

              {timeRange === 'custom' && (
                <div className="flex flex-col gap-2 rounded-xl border border-white/20 bg-white/10 p-3 backdrop-blur-md sm:flex-row sm:items-end">
                  <label className="flex flex-col text-xs text-white/90">
                    {t.startDate}
                    <input
                      type="date"
                      value={customStartDate}
                      onChange={(e) => setCustomStartDate(e.target.value)}
                      className="mt-1 rounded-lg border border-white/20 bg-white/90 px-3 py-2 text-sm text-slate-900"
                    />
                  </label>
                  <label className="flex flex-col text-xs text-white/90">
                    {t.endDate}
                    <input
                      type="date"
                      value={customEndDate}
                      onChange={(e) => setCustomEndDate(e.target.value)}
                      className="mt-1 rounded-lg border border-white/20 bg-white/90 px-3 py-2 text-sm text-slate-900"
                    />
                  </label>
                  <button
                    type="button"
                    onClick={handleApplyCustomRange}
                    className="w-full rounded-lg bg-emerald-500 px-4 py-2 text-sm font-medium text-white transition hover:bg-emerald-400 disabled:opacity-50 sm:w-auto"
                    disabled={!customStartDate || !customEndDate}
                  >
                    {t.apply}
                  </button>
                </div>
              )}

            </div>
          </div>
        </CardHeader>
      </Card>

      {!hasAnyData ? (
        <Card className="border-slate-200 bg-white/85 shadow-sm backdrop-blur-sm">
          <CardContent className="py-10 text-center text-slate-700">{t.noData}</CardContent>
        </Card>
      ) : (
        <>
          <div className="grid grid-cols-1 gap-4">
            <Card className="border-none bg-white/90 shadow-lg backdrop-blur-sm">
              <CardHeader className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <CardTitle className="text-base text-slate-900">Whole-System Summary</CardTitle>
                  <CardDescription className="text-sm text-slate-600">
                    Combined snapshot of environmental monitoring, disease scans, and maturity checks for the current range.
                  </CardDescription>
                </div>
                <button
                  type="button"
                  onClick={handleDownloadSummary}
                  className="inline-flex w-full items-center justify-center gap-2 rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm font-medium text-slate-800 transition hover:bg-slate-100 sm:w-auto"
                >
                  <Download className="h-4 w-4" />
                  Download Whole-System Summary
                </button>
              </CardHeader>
              <CardContent className="space-y-5 px-6 pb-6 pt-2 sm:px-8 sm:pb-8">
                <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-5">
                  {wholeSystemSummary.map((item) => (
                    <div key={item.label} className="min-w-0 rounded-2xl border border-slate-200 bg-slate-50 py-4 pr-5 shadow-sm sm:py-5 sm:pr-6" style={{ paddingLeft: '32px' }}>
                      <p className="break-words text-xs font-semibold uppercase tracking-[0.14em] text-slate-500">{item.label}</p>
                      <p className="mt-2 break-words text-lg font-semibold text-slate-900">{item.value}</p>
                      <p className="mt-2 break-words text-sm leading-7 text-slate-600">{item.note}</p>
                    </div>
                  ))}
                </div>

                <div className="rounded-2xl border border-emerald-100 bg-gradient-to-r from-emerald-50 to-cyan-50">
                  <div className="box-border flex w-full min-w-0 flex-col items-start pb-5 pr-5 pt-6 text-left sm:pr-6" style={{ paddingLeft: '32px' }}>
                    <p className="w-full min-w-0 break-words text-left text-base font-semibold text-emerald-900">System Narrative</p>
                    <p className="mt-3 w-full min-w-0 break-words text-left text-base leading-8 text-slate-700">
                      {nlpSummary || 'No whole-system narrative is available yet. Generate more history to build a stronger summary.'}
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card className="overflow-hidden border-none bg-white/85 shadow-lg backdrop-blur-sm">
              <CardContent className="w-full max-w-full space-y-4 overflow-x-hidden">
                <Tabs value={activeSection} onValueChange={setActiveSection} className="w-full space-y-6 overflow-x-hidden">
                  <div
                    ref={sectionTabsRef}
                    onPointerDown={handleTabsPointerDown}
                    onPointerMove={handleTabsPointerMove}
                    onPointerUp={handleTabsPointerEnd}
                    onPointerCancel={handleTabsPointerEnd}
                    onTouchStartCapture={handleTabsTouchStartCapture}
                    onTouchMoveCapture={handleTabsTouchMoveCapture}
                    className="relative z-10 mb-3 w-full select-none overflow-hidden"
                  >
                    <TabsList className="grid h-auto w-full min-w-0 grid-cols-5 gap-1 rounded-2xl border border-slate-200 bg-slate-50/90 p-1.5 shadow-sm sm:gap-2">
                    <TabsTrigger data-section-tab="temperature" value="temperature" title="Temperature" className="flex h-12 min-w-0 w-full items-center justify-center rounded-xl border border-transparent px-1 py-2 text-slate-600 transition-all duration-200 data-[state=active]:!border-emerald-600 data-[state=active]:!bg-emerald-500 data-[state=active]:!text-white data-[state=active]:shadow-lg data-[state=active]:ring-2 data-[state=active]:ring-emerald-200"><span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-white/85 p-0.5"><Thermometer3D className="size-8 block" /></span></TabsTrigger>
                    <TabsTrigger data-section-tab="rainfall" value="rainfall" title="Rainfall" className="flex h-12 min-w-0 w-full items-center justify-center rounded-xl border border-transparent px-1 py-2 text-slate-600 transition-all duration-200 data-[state=active]:!border-emerald-600 data-[state=active]:!bg-emerald-500 data-[state=active]:!text-white data-[state=active]:shadow-lg data-[state=active]:ring-2 data-[state=active]:ring-emerald-200"><span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-white/85 p-0.5"><RainCloud3D className="size-8 block" isRaining /></span></TabsTrigger>
                    <TabsTrigger data-section-tab="humidity-detail" value="humidity-detail" title="Humidity" className="flex h-12 min-w-0 w-full items-center justify-center rounded-xl border border-transparent px-1 py-2 text-slate-600 transition-all duration-200 data-[state=active]:!border-emerald-600 data-[state=active]:!bg-emerald-500 data-[state=active]:!text-white data-[state=active]:shadow-lg data-[state=active]:ring-2 data-[state=active]:ring-emerald-200"><span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-white/85 p-0.5"><WaterDrop3D className="size-8 block" /></span></TabsTrigger>
                    <TabsTrigger data-section-tab="leaf-detection" value="leaf-detection" title="Leaf Detection" className="flex h-12 min-w-0 w-full items-center justify-center rounded-xl border border-transparent px-1 py-2 text-slate-600 transition-all duration-200 data-[state=active]:!border-emerald-600 data-[state=active]:!bg-emerald-500 data-[state=active]:!text-white data-[state=active]:shadow-lg data-[state=active]:ring-2 data-[state=active]:ring-emerald-200"><span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-white/85 p-0.5"><Leaf3D className="size-8 block" /></span></TabsTrigger>
                    <TabsTrigger data-section-tab="fruit-maturity" value="fruit-maturity" title="Fruit Maturity" className="flex h-12 min-w-0 w-full items-center justify-center rounded-xl border border-transparent px-1 py-2 text-slate-600 transition-all duration-200 data-[state=active]:!border-emerald-600 data-[state=active]:!bg-emerald-500 data-[state=active]:!text-white data-[state=active]:shadow-lg data-[state=active]:ring-2 data-[state=active]:ring-emerald-200"><span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-white/85 p-0.5"><Rambutan3D className="size-8 block" /></span></TabsTrigger>
                    </TabsList>
                  </div>

                  <div className="relative z-0 w-full min-w-0 max-w-full overflow-x-hidden overscroll-x-none pt-2 [touch-action:pan-y]">
                  <TabsContent value="temperature" className="w-full min-w-0 max-w-full overflow-x-hidden space-y-4">
                    <Card className="w-full max-w-full overflow-hidden border border-orange-100 bg-gradient-to-br from-orange-50 to-white shadow-sm">
                      <CardHeader>
                        <CardTitle className="text-slate-900">Temperature Trend</CardTitle>
                        <CardDescription className="text-slate-700">
                          Orange temperature curve with fill, plus the dashed optimal guide.
                        </CardDescription>
                      </CardHeader>
                      <CardContent>
                        <div ref={temperatureChartRef} className="h-[260px] w-full sm:h-[350px]">
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

                    <div className="grid grid-cols-1 gap-4 lg:grid-cols-[1.1fr,0.9fr]">
                      <Card className="border-none bg-white shadow-lg backdrop-blur-sm">
                        <CardHeader>
                          <SectionHeader
                            icon={AlertTriangle}
                            visual={() => <Lightbulb3D />}
                            title={t.riskAnalysis}
                            description="Visual risk status, quick interpretation, and practical next steps."
                          />
                        </CardHeader>
                        <CardContent className="space-y-5">
                          <div className="flex items-center justify-between">
                            <span className={`inline-flex items-center gap-2 rounded-full px-3 py-1.5 text-sm font-medium ${riskUi.badgeClass}`}>
                              <AlertTriangle className="h-4 w-4" />
                              {riskUi.label}
                            </span>
                            <span className="text-sm font-medium text-slate-600">{formatValue(summary.currentRisk, '%')}</span>
                          </div>

                          <div>
                            <div className="mb-2 flex items-center justify-between text-sm text-slate-600">

                              <span>Environmental disease pressure</span>
                              <span>{riskProgress}%</span>
                            </div>
                            <div className="h-3 overflow-hidden rounded-full bg-slate-100">
                              <div
                                className={`h-full rounded-full transition-all duration-500 ${riskUi.barClass}`}
                                style={{ width: `${riskProgress}%` }}
                              />
                            </div>
                          </div>

                          <div className="rounded-2xl bg-slate-50 p-4">
                            <p className="text-sm font-semibold text-slate-900">Mini Insights</p>
                            <div className="mt-3 space-y-3">
                              {insights.map((insight) => (
                                <div key={insight} className="rounded-xl border border-slate-200 bg-white p-3 text-sm text-slate-700 shadow-sm">
                                  {insight}
                                </div>
                              ))}
                            </div>
                          </div>
                        </CardContent>
                      </Card>

                      <Card className="border-none bg-white shadow-lg backdrop-blur-sm">
                        <CardHeader>
                          <CardTitle className="text-slate-900">Temperature Summary</CardTitle>
                          <CardDescription className="text-slate-600">
                            Quick context for the selected monitoring window.
                          </CardDescription>
                        </CardHeader>
                        <CardContent className="space-y-4">
                          <div className="flex items-center justify-between rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3">
                            <div>
                              <p className="text-sm font-medium text-slate-900">Heaviest Day</p>
                              <p className="text-xs text-slate-600">Highest rainfall recorded in this range</p>
                            </div>
                            <span className="text-lg font-semibold text-slate-900">{formatValue(heaviestRainfall, ' mm')}</span>
                          </div>

                          <div className="flex items-center justify-between rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3">
                            <div>
                              <p className="text-sm font-medium text-slate-900">Monitoring Window</p>
                              <p className="text-xs text-slate-600">Current selected range</p>
                            </div>
                            <span className="text-lg font-semibold text-slate-900">{rangeLabel}</span>
                          </div>

                          <div className="rounded-2xl border border-slate-200 bg-gradient-to-r from-sky-50 to-emerald-50 p-4">
                            <p className="text-sm font-semibold text-slate-900">Download-ready reporting</p>
                            <p className="mt-2 text-sm text-slate-700">
                              Farmers can now export environmental data together with leaf detection and fruit maturity history in one PDF summary.
                            </p>
                          </div>
                        </CardContent>
                      </Card>
                    </div>
                  </TabsContent>

                  <TabsContent value="rainfall" className="w-full min-w-0 max-w-full overflow-x-hidden space-y-4">
                    <Card className="w-full max-w-full overflow-hidden border border-sky-100 bg-gradient-to-r from-sky-50 to-white shadow-sm">
                      <CardContent className="px-6 py-6 sm:px-7 sm:py-7">
                        <div>
                          <p className="text-sm font-medium text-slate-600">Rainfall This Week</p>
                          <div className="mt-2 flex flex-wrap items-center gap-3">
                            <span className="text-2xl font-bold text-slate-950 sm:text-3xl">
                              {formatValue(rainfallSummary.totalRainfall, ' mm')}
                            </span>
                            <span className={`inline-flex items-center rounded-full px-3 py-1.5 text-sm font-medium ${rainfallUi.badgeClass}`}>
                              {rainfallUi.label}
                            </span>
                          </div>
                        </div>
                      </CardContent>
                    </Card>

                    <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
                      <Card className="border border-sky-100 bg-gradient-to-br from-sky-50 to-white shadow-sm">
                        <CardContent className="px-6 py-5 sm:px-7 sm:py-6">
                          <p className="text-sm font-medium text-slate-600">Total Rainfall</p>
                            <p className="mt-2 text-xl font-bold text-slate-900 sm:text-2xl">{formatValue(rainfallSummary.totalRainfall, ' mm')}</p>
                        </CardContent>
                      </Card>
                      <Card className="border border-emerald-100 bg-gradient-to-br from-emerald-50 to-white shadow-sm">
                        <CardContent className="px-6 py-5 sm:px-7 sm:py-6">
                          <p className="text-sm font-medium text-slate-600">Rainy Days Count</p>
                            <p className="mt-2 text-xl font-bold text-slate-900 sm:text-2xl">{formatValue(rainfallSummary.rainyDays)}</p>
                        </CardContent>
                      </Card>
                      <Card className="border border-amber-100 bg-gradient-to-br from-amber-50 to-white shadow-sm">
                        <CardContent className="px-6 py-5 sm:px-7 sm:py-6">
                          <p className="text-sm font-medium text-slate-600">Dry Days Count</p>
                            <p className="mt-2 text-xl font-bold text-slate-900 sm:text-2xl">{formatValue(rainfallSummary.dryDays)}</p>
                        </CardContent>
                      </Card>
                      <Card className="border border-indigo-100 bg-gradient-to-br from-indigo-50 to-white shadow-sm">
                        <CardContent className="px-6 py-5 sm:px-7 sm:py-6">
                          <p className="text-sm font-medium text-slate-600">Average Rainfall per Day</p>
                            <p className="mt-2 text-xl font-bold text-slate-900 sm:text-2xl">{formatValue(rainfallSummary.avgPerDay, ' mm')}</p>
                        </CardContent>
                      </Card>
                    </div>

                    <Card className="w-full max-w-full overflow-hidden border border-sky-100 bg-gradient-to-br from-sky-50 to-white shadow-sm">
                      <CardHeader>
                        <CardTitle className="text-slate-900">Rainfall in the Past 7 Days</CardTitle>
                        <CardDescription className="text-slate-700">
                          A simple rainfall view with day-by-day meaning.
                        </CardDescription>
                      </CardHeader>
                      <CardContent>
                        <div ref={rainfallChartRef} className="h-[260px] w-full sm:h-[350px]">
                        <ResponsiveContainer key={`rainfall-${chartRenderKey}`} width="100%" height="100%">
                          <BarChart data={rainfallData}>
                            <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                            <XAxis dataKey="time" stroke="#64748b" style={{ fontSize: '12px' }} />
                            <YAxis yAxisId="left" stroke="#64748b" style={{ fontSize: '12px' }} label={{ value: 'Daily (mm)', angle: -90, position: 'insideLeft' }} />
                            <YAxis yAxisId="right" orientation="right" stroke="#64748b" style={{ fontSize: '12px' }} label={{ value: 'Cumulative (mm)', angle: 90, position: 'insideRight' }} />
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
                            <Legend />
                            <Bar yAxisId="left" dataKey="rainfall" fill="#0ea5e9" name="Daily Rainfall" radius={[10, 10, 0, 0]} />
                            <Line
                              yAxisId="right"
                              type="monotone"
                              dataKey="cumulative"
                              stroke="#8b5cf6"
                              strokeWidth={3}
                              name="Cumulative"
                              activeDot={{ r: 7, fill: '#8b5cf6', stroke: '#fff', strokeWidth: 3 }}
                            />
                          </BarChart>
                        </ResponsiveContainer>
                        </div>
                      </CardContent>
                    </Card>

                    <Card className="border border-slate-200 bg-white shadow-sm">
                      <CardHeader>
                        <CardTitle className="text-slate-900">What this means</CardTitle>
                      </CardHeader>
                      <CardContent>
                        <div className="rounded-2xl bg-emerald-50 p-4 text-sm text-slate-700">
                          <p className="font-medium text-emerald-900">What this means:</p>
                          <p className="mt-2">{rainfallMeaning}</p>
                        </div>
                      </CardContent>
                    </Card>

                    <div className="grid grid-cols-1 gap-4 lg:grid-cols-[1.05fr,0.95fr]">
                      <Card className="border border-slate-200 bg-white shadow-sm">
                        <CardHeader>
                          <CardTitle className="text-slate-900">Key Highlights</CardTitle>
                        </CardHeader>
                        <CardContent className="space-y-4 text-sm text-slate-700">
                          <div className="grid grid-cols-[minmax(0,1fr)_120px] items-start gap-3">
                            <span className="min-w-0">Highest Rainfall</span>
                            <span className="w-[120px] whitespace-normal break-normal text-right font-semibold text-slate-900">
                              {rainfallSummary.peakDay?.time || 'No data'} ({formatValue(rainfallSummary.peakDay?.rainfall, ' mm')})
                            </span>
                          </div>
                          <div className="grid grid-cols-[minmax(0,1fr)_120px] items-start gap-3">
                            <span className="min-w-0">Lowest Rainfall</span>
                            <span className="w-[120px] whitespace-normal break-normal text-right font-semibold text-slate-900">
                              {rainfallSummary.lowestDay?.time || 'No data'} ({formatValue(rainfallSummary.lowestDay?.rainfall, ' mm')})
                            </span>
                          </div>
                          <div className="grid grid-cols-[minmax(0,1fr)_120px] items-start gap-3">
                            <span className="min-w-0">Most Consistent Day Range</span>
                            <span className="w-[120px] whitespace-normal break-normal text-right font-semibold text-slate-900">
                              {rainfallSummary.consistentRange?.start
                                ? `${rainfallSummary.consistentRange.start}${rainfallSummary.consistentRange.end && rainfallSummary.consistentRange.end !== rainfallSummary.consistentRange.start ? `-${rainfallSummary.consistentRange.end}` : ''}`
                                : 'No sustained range'}
                            </span>
                          </div>
                        </CardContent>
                      </Card>

                      <Card className="border border-slate-200 bg-white shadow-sm">
                        <CardHeader>
                          <CardTitle className="text-slate-900">Weekly / Period Comparison</CardTitle>
                        </CardHeader>
                        <CardContent className="space-y-4 text-sm text-slate-700">
                          <div className="flex items-center justify-between">
                            <span>This Period</span>
                            <span className="font-semibold text-slate-900">{formatValue(rainfallSummary.totalRainfall, ' mm')}</span>
                          </div>
                          <div className="flex items-center justify-between">
                            <span>Previous Period</span>
                            <span className="font-semibold text-slate-900">{formatValue(rainfallSummary.previousPeriodTotal, ' mm')}</span>
                          </div>
                          <div className="flex items-center justify-between">
                            <span>Change</span>
                            <span className={`font-semibold ${Number(rainfallSummary.changeFromPrevious || 0) >= 0 ? 'text-emerald-700' : 'text-red-700'}`}>
                              {Number(rainfallSummary.changeFromPrevious || 0) >= 0 ? '+' : ''}{formatValue(rainfallSummary.changeFromPrevious, ' mm')}
                            </span>
                          </div>
                        </CardContent>
                      </Card>
                    </div>

                    <div className="grid grid-cols-1 gap-4 lg:grid-cols-[0.95fr,1.05fr]">
                      <Card className="border border-slate-200 bg-white shadow-sm">
                        <CardHeader>
                          <CardTitle className="text-slate-900">Rainfall Distribution</CardTitle>
                          <CardDescription className="text-slate-600">
                            Share of rainy days versus dry days.
                          </CardDescription>
                        </CardHeader>
                        <CardContent className="space-y-4">
                          <div className="h-4 overflow-hidden rounded-full bg-slate-100">
                            <div className="flex h-full w-full">
                              <div
                                className="bg-sky-500 transition-all duration-500"
                                style={{ width: `${rainfallSummary.distribution?.rainyPercent || 0}%` }}
                              />
                              <div
                                className="bg-amber-300 transition-all duration-500"
                                style={{ width: `${rainfallSummary.distribution?.dryPercent || 0}%` }}
                              />
                            </div>
                          </div>
                          <div className="grid grid-cols-1 gap-3 text-sm sm:grid-cols-2">
                            <div className="rounded-xl bg-sky-50 p-3 text-sky-800">
                              <p className="font-medium">Rainy</p>
                              <p className="mt-1 text-lg font-semibold">{formatValue(rainfallSummary.distribution?.rainyPercent, '%')}</p>
                            </div>
                            <div className="rounded-xl bg-amber-50 p-3 text-amber-800">
                              <p className="font-medium">Dry</p>
                              <p className="mt-1 text-lg font-semibold">{formatValue(rainfallSummary.distribution?.dryPercent, '%')}</p>
                            </div>
                          </div>
                        </CardContent>
                      </Card>

                      <Card className="border border-slate-200 bg-white shadow-sm">
                        <CardHeader>
                          <CardTitle className="text-slate-900"> Recommendation</CardTitle>
                          <CardDescription className="text-slate-600">
                            Whole-system summary generated from the selected historical data.
                          </CardDescription>
                        </CardHeader>
                        <CardContent className="space-y-3">
                          {nlpSummary ? (
                            <>
                              <div className="rounded-xl border border-slate-200 bg-slate-50 p-3 text-sm text-slate-700">
                                {nlpSummary}
                              </div>
                              <p className="text-xs text-slate-500">
                                Source: {nlpSource === 'ai' ? 'AI recommendation' : 'Fallback local recommendation'}
                              </p>
                            </>
                          ) : (
                            <p className="text-sm text-slate-500">No  recommendation yet for this range.</p>
                          )}
                        </CardContent>
                      </Card>
                    </div>
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
                        <div ref={humidityChartRef} className="h-[260px] w-full sm:h-[350px]">
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
                            <span className="h-7 w-7"><Leaf3D /></span>
                          Leaf Detection Activity
                        </CardTitle>
                        <CardDescription className="text-slate-700">
                          Saved disease scans and average confidence over the selected range.
                        </CardDescription>
                      </CardHeader>
                      <CardContent className="min-w-0 px-6 py-6 sm:px-7 sm:py-7">
                        <div ref={leafChartRef} className="h-[260px] w-full min-w-0 sm:h-[320px]">
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
                            <span className="h-7 w-7"><Leaf3D /></span>
                          Fruit Maturity Activity
                        </CardTitle>
                        <CardDescription className="text-slate-700">
                          Historical rambutan maturity scans and confidence trend.
                        </CardDescription>
                      </CardHeader>
                      <CardContent className="min-w-0 px-6 py-6 sm:px-7 sm:py-7">
                        <div ref={fruitChartRef} className="h-[260px] w-full min-w-0 sm:h-[320px]">
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
                </Tabs>
              </CardContent>
            </Card>
          </div>
        </>
      )}
    </div>
  );
}
