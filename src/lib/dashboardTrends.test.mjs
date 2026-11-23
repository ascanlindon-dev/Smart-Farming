import assert from 'node:assert/strict';
import test from 'node:test';
import { analyzeDashboardTrend, dashboardTrendSummary } from './dashboardTrends.mjs';

test('temperature summaries count target days and flag readings outside the band', () => {
  const data = [
    { time: 'Mon', temp: 27 },
    { time: 'Tue', temp: 30 },
    { time: 'Wed', temp: 34 },
  ];

  const analysis = analyzeDashboardTrend(data, 'temperature');
  const summary = dashboardTrendSummary(data, 'temperature', 'en');

  assert.equal(analysis.status, 'mixed');
  assert.equal(analysis.inRangeCount, 2);
  assert.equal(analysis.direction, 'rising');
  assert.match(summary, /2 of 3 days were within the 24–32°C target/);
  assert.match(summary, /1 day fell outside the target/);
});

test('consistently high temperatures explain possible water stress', () => {
  const summary = dashboardTrendSummary([
    { time: 'Mon', temp: 34 },
    { time: 'Tue', temp: 36 },
  ], 'temperature', 'en');

  assert.match(summary, /above target/);
  assert.match(summary, /water stress/);
});

test('high humidity summary explains orchard disease implications in Tagalog', () => {
  const data = [{ time: 'Mon', humidity: 83 }, { time: 'Tue', humidity: 87 }];
  const summary = dashboardTrendSummary(data, 'humidity', 'tl');

  assert.match(summary, /target na 65–80%/);
  assert.match(summary, /sakit na fungal/);
});

test('missing measurements produce an explicit no-data summary', () => {
  const summary = dashboardTrendSummary([{ time: 'Mon', temp: null }], 'temperature', 'en');

  assert.match(summary, /No readings were recorded/);
  assert.equal(analyzeDashboardTrend([{ temp: null }], 'temperature').status, 'no-data');
});

test('numeric strings are parsed but invalid values do not become measurements', () => {
  const result = analyzeDashboardTrend([
    { time: 'Mon', humidity: '72' },
    { time: 'Tue', humidity: 'NaN' },
    { time: 'Wed', humidity: null },
  ], 'humidity');

  assert.equal(result.measuredCount, 1);
  assert.equal(result.average, 72);
  assert.equal(result.status, 'within');
  assert.equal(result.direction, 'steady');
});
