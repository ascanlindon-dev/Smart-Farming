export const DASHBOARD_TREND_METRICS = {
  temperature: {
    field: 'temp',
    minimum: 24,
    maximum: 32,
    unit: '°C',
    changeThreshold: 0.5,
  },
  humidity: {
    field: 'humidity',
    minimum: 65,
    maximum: 80,
    unit: '%',
    changeThreshold: 2,
  },
};

function finiteNumber(value) {
  if (typeof value !== 'number' && typeof value !== 'string') return null;
  if (typeof value === 'string' && !value.trim()) return null;
  const number = Number(value);
  return Number.isFinite(number) ? number : null;
}

export function analyzeDashboardTrend(data, metric) {
  const config = DASHBOARD_TREND_METRICS[metric];
  if (!config) throw new Error(`Unknown dashboard trend metric: ${metric}`);

  const samples = (Array.isArray(data) ? data : []).map((item, index) => ({
    index,
    label: typeof item?.time === 'string' ? item.time : '',
    value: finiteNumber(item?.[config.field]),
  }));
  const measured = samples.filter((sample) => sample.value !== null);
  const average = measured.length
    ? measured.reduce((total, sample) => total + sample.value, 0) / measured.length
    : null;
  const first = measured[0]?.value ?? null;
  const last = measured[measured.length - 1]?.value ?? null;
  const change = first === null || last === null ? null : last - first;
  const averageStatus = average === null
    ? 'no-data'
    : average < config.minimum
      ? 'below'
      : average > config.maximum
        ? 'above'
        : 'within';

  return {
    config,
    samples,
    measuredCount: measured.length,
    average,
    inRangeCount: measured.filter(
      (sample) => sample.value >= config.minimum && sample.value <= config.maximum,
    ).length,
    status: averageStatus === 'within' && measured.length > 0 && measured.length !== measured.filter(
      (sample) => sample.value >= config.minimum && sample.value <= config.maximum,
    ).length
      ? 'mixed'
      : averageStatus,
    direction: change === null || Math.abs(change) < config.changeThreshold
      ? 'steady'
      : change > 0
        ? 'rising'
        : 'falling',
    change,
  };
}

export function dashboardTrendSummary(data, metric, language = 'en') {
  const isTagalog = language === 'tl';
  const analysis = analyzeDashboardTrend(data, metric);
  const { config, measuredCount, average, inRangeCount, status, direction, change } = analysis;

  if (status === 'no-data') {
    return isTagalog
      ? 'Wala pang naitalang readings nitong nakaraang 7 araw, kaya hindi pa masusuri ang saklaw o epekto nito sa taniman.'
      : 'No readings were recorded in the past 7 days, so the range and its effect on the orchard cannot be assessed yet.';
  }

  const value = `${average.toFixed(1)}${config.unit}`;
  const band = `${config.minimum}–${config.maximum}${config.unit}`;
  const outOfRangeCount = measuredCount - inRangeCount;
  const outOfRangeDays = isTagalog
    ? `${outOfRangeCount} araw`
    : `${outOfRangeCount} ${outOfRangeCount === 1 ? 'day' : 'days'}`;
  const measuredDays = isTagalog
    ? `${inRangeCount} sa ${measuredCount} araw`
    : `${inRangeCount} of ${measuredCount} days`;

  let context;
  if (metric === 'temperature') {
    if (status === 'above') {
      context = isTagalog
        ? 'Mas mataas sa target ang average; maaaring tumaas ang water stress. Suriin ang halumigmig ng lupa at bantayan ang mga dahon.'
        : 'The average is above target and may increase water stress. Check soil moisture and monitor the leaves.';
    } else if (status === 'below') {
      context = isTagalog
        ? 'Mas mababa sa target ang average at maaaring bumagal ang paglaki. Bantayan ang bagong usbong at kondisyon ng mga puno.'
        : 'The average is below target and growth may slow. Watch new growth and overall tree condition.';
    } else if (outOfRangeCount > 0) {
      context = isTagalog
        ? `${outOfRangeDays} ang lumampas sa target; bantayan ang panandaliang init o lamig sa mga dahon.`
        : `${outOfRangeDays} fell outside the target; watch for short periods of heat or cool stress on leaves.`;
    } else {
      context = isTagalog
        ? 'Nasa target ang average. Patuloy na subaybayan ang puno dahil hindi temperatura lang ang batayan ng kalusugan nito.'
        : 'The average is within target. Keep monitoring the trees, since temperature alone does not determine crop health.';
    }
  } else if (status === 'above') {
    context = isTagalog
      ? 'Mataas ang halumigmig at maaaring pabor ito sa sakit na fungal. Tingnan kung nananatiling basa ang dahon at panatilihin ang maayos na daloy ng hangin.'
      : 'High humidity can favor fungal disease. Check whether leaves stay wet and maintain good airflow through the canopy.';
  } else if (status === 'below') {
    context = isTagalog
      ? 'Mababang halumigmig ay maaaring magpabilis ng pagkawala ng tubig. Suriin ang lupa at bantayan ang pagkalanta ng dahon.'
      : 'Low humidity can increase water loss. Check the soil and watch for wilting leaves.';
  } else if (outOfRangeCount > 0) {
    context = isTagalog
      ? `${outOfRangeDays} ang lumampas sa target; bantayan ang pagbabago sa pagkabasa ng dahon at mga sintomas ng sakit.`
      : `${outOfRangeDays} fell outside the target; watch leaf wetness and check for disease symptoms.`;
  } else {
    context = isTagalog
      ? 'Nasa target ang average. Patuloy na siyasatin ang dahon; hindi sapat ang halumigmig lang para matukoy ang sakit.'
      : 'The average is within target. Continue checking leaves; humidity alone cannot diagnose disease.';
  }

  const base = isTagalog
    ? `Ang 7-araw na average ng ${metric === 'temperature' ? 'temperatura' : 'halumigmig'} ay ${value}; ${measuredDays} ang nasa target na ${band}.`
    : `The 7-day average ${metric === 'temperature' ? 'temperature' : 'humidity'} is ${value}; ${measuredDays} were within the ${band} target.`;
  const trend = direction === 'steady'
    ? ''
    : isTagalog
      ? ` Ang huling daily average ay ${Math.abs(change).toFixed(1)}${metric === 'humidity' ? ' puntos' : '°C'} ${direction === 'rising' ? 'mas mataas' : 'mas mababa'} kaysa sa unang sukat.`
      : ` The last daily average is ${Math.abs(change).toFixed(1)}${metric === 'humidity' ? ' percentage points' : '°C'} ${direction === 'rising' ? 'higher' : 'lower'} than the first reading.`;

  return `${base}${trend} ${context}`;
}
