import { useContext, useEffect, useId, useRef, useState } from 'react';
import { ChevronDown, ChevronUp, RefreshCw } from 'lucide-react';
import { LanguageContext } from '../LanguageContext';
import { apiFetch } from '../lib/apiFetch.mjs';
import { readSessionData, writeSessionData } from '../lib/sessionDataCache.mjs';
import { Button } from './ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from './ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from './ui/table';

const translations = {
  en: {
    title: 'Sensor Readings',
    description: 'The latest 50 saved farm sensor readings, newest first.',
    temperature: 'Temperature (°C)',
    humidity: 'Humidity (%)',
    rain: 'Rain',
    receivedAt: 'Received At',
    refresh: 'Refresh',
    loading: 'Loading sensor readings...',
    error: 'Unable to load sensor readings. Please try again.',
    stale: 'Showing saved readings. The latest refresh failed.',
    expired: 'Your session has expired. Please sign in again to view sensor readings.',
    retry: 'Try again',
    empty: 'No sensor readings yet. Readings will appear when your device sends data.',
    unavailable: 'No data',
    note: 'Rain shows raw sensor values. Dates and times use your local timezone.',
    expand: 'View latest 50',
    minimize: 'Minimize to 10',
    showing: (shown, total) => `Showing ${shown} of ${total} recent readings`,
  },
  tl: {
    title: 'Mga Reading ng Sensor',
    description: 'Ang pinakabagong 50 naka-save na reading ng sensor sa bukid, pinakabago muna.',
    temperature: 'Temperatura (°C)',
    humidity: 'Halumigmig (%)',
    rain: 'Ulan',
    receivedAt: 'Petsa at Oras ng Pagtanggap',
    refresh: 'I-refresh',
    loading: 'Kinukuha ang mga reading ng sensor...',
    error: 'Hindi makuha ang mga reading ng sensor. Subukan muli.',
    stale: 'Ipinapakita ang naka-save na readings. Nabigo ang pinakabagong pag-refresh.',
    expired: 'Nag-expire ang iyong session. Mag-sign in muli upang makita ang mga reading ng sensor.',
    retry: 'Subukan muli',
    empty: 'Wala pang reading ng sensor. Lalabas dito ang datos kapag nagpadala ang iyong device.',
    unavailable: 'Walang datos',
    note: 'Ang ulan ay raw na halaga mula sa sensor. Ang petsa at oras ay ayon sa iyong lokal na timezone.',
    expand: 'Tingnan ang huling 50',
    minimize: 'Ipakita lang ang 10',
    showing: (shown, total) => `Ipinapakita ang ${shown} sa ${total} pinakabagong reading`,
  },
};

const READINGS_CACHE_KEY = '/api/sensors/readings/?page_size=50';

export default function SensorReadings() {
  const { language } = useContext(LanguageContext);
  const t = translations[language] || translations.en;
  const [expanded, setExpanded] = useState(false);
  const contentId = useId();
  const [revision, setRevision] = useState(0);
  const [initialCache] = useState(() => readSessionData(READINGS_CACHE_KEY));
  const [data, setData] = useState(initialCache?.data ?? null);
  const hasData = useRef(Boolean(initialCache));
  const [loading, setLoading] = useState(!initialCache);
  const [error, setError] = useState(null);

  useEffect(() => {
    const controller = new AbortController();
    const cached = readSessionData(READINGS_CACHE_KEY);
    if (cached) setData(cached.data);
    setLoading(!cached && !hasData.current);
    setError(null);

    async function loadReadings() {
      try {
        const response = await apiFetch(READINGS_CACHE_KEY, {
          signal: controller.signal,
          cache: 'no-store',
        });
        if (response.status === 401 || response.status === 403) {
          if (!controller.signal.aborted) setError('expired');
          return;
        }
        if (!response.ok) throw new Error('Unable to load sensor readings');
        const result = await response.json();
        if (!controller.signal.aborted) {
          setData(result);
          writeSessionData(READINGS_CACHE_KEY, result);
          hasData.current = true;
        }
      } catch {
        if (!controller.signal.aborted) setError('error');
      } finally {
        if (!controller.signal.aborted) setLoading(false);
      }
    }

    void loadReadings();
    return () => controller.abort();
  }, [revision]);

  const refresh = () => setRevision((value) => value + 1);
  const dateFormatter = new Intl.DateTimeFormat(language === 'tl' ? 'fil-PH' : 'en-PH', {
    year: 'numeric', month: 'short', day: 'numeric',
    hour: 'numeric', minute: '2-digit', second: '2-digit', timeZoneName: 'short',
  });
  const recentRecords = (data?.results || []).slice(0, 50);
  const visibleRecords = expanded ? recentRecords : recentRecords.slice(0, 10);

  return (
    <Card className="min-w-0 border-slate-200 bg-white shadow-sm">
      <CardHeader className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <CardTitle className="text-base text-slate-900">{t.title}</CardTitle>
          <CardDescription className="mt-1 text-sm text-slate-600">{t.description}</CardDescription>
        </div>
        <div className="flex shrink-0 flex-wrap gap-2">
          <Button type="button" variant="outline" onClick={refresh} disabled={loading}>
            <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} aria-hidden="true" />
            {t.refresh}
          </Button>
          <Button type="button" variant="outline" onClick={() => setExpanded((value) => !value)}
            disabled={loading || (!expanded && recentRecords.length <= 10)}
            aria-expanded={expanded} aria-controls={contentId}>
            {expanded ? <ChevronUp className="h-4 w-4" aria-hidden="true" /> : <ChevronDown className="h-4 w-4" aria-hidden="true" />}
            {expanded ? t.minimize : t.expand}
          </Button>
        </div>
      </CardHeader>
      <CardContent id={contentId} className="min-w-0 space-y-4" aria-busy={loading}>
        {error === 'expired' ? (
          <div role="alert" className="space-y-3 rounded-xl bg-red-50 p-4 text-sm text-red-800">
            <p>{t.expired}</p>
            <Button type="button" variant="outline" onClick={refresh}>{t.retry}</Button>
          </div>
        ) : loading && !data ? (
          <p role="status" className="py-8 text-center text-sm text-slate-600">{t.loading}</p>
        ) : error && !data ? (
          <div role="alert" className="space-y-3 rounded-xl bg-red-50 p-4 text-sm text-red-800">
            <p>{t.error}</p>
            <Button type="button" variant="outline" onClick={refresh}>{t.retry}</Button>
          </div>
        ) : data && (
          <>
            {error && <p role="status" className="rounded-lg bg-amber-50 px-3 py-2 text-sm text-amber-900">{t.stale}</p>}
            <Table aria-label={t.title}>
              <TableHeader>
                <TableRow className="bg-slate-50">
                  <TableHead scope="col">{t.temperature}</TableHead>
                  <TableHead scope="col">{t.humidity}</TableHead>
                  <TableHead scope="col">{t.rain}</TableHead>
                  <TableHead scope="col">{t.receivedAt}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {visibleRecords.length ? visibleRecords.map((record) => (
                  <TableRow key={record.id}>
                    <TableCell className="text-slate-900">{record.temperature ?? t.unavailable}</TableCell>
                    <TableCell className="text-slate-900">{record.humidity ?? t.unavailable}</TableCell>
                    <TableCell className="text-slate-900">{record.rain ?? t.unavailable}</TableCell>
                    <TableCell className="text-slate-600">
                      <time dateTime={record.received_at}>{dateFormatter.format(new Date(record.received_at))}</time>
                    </TableCell>
                  </TableRow>
                )) : (
                  <TableRow>
                    <TableCell colSpan={4} className="whitespace-normal py-8 text-center text-slate-500">{t.empty}</TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
            <div className="flex flex-col gap-3 text-sm text-slate-600 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <p role="status">{t.showing(visibleRecords.length, recentRecords.length)}</p>
                <p className="mt-1 text-xs">{t.note}</p>
              </div>
              {expanded && (
                <Button type="button" variant="outline" size="sm" onClick={() => setExpanded(false)}
                  aria-expanded={expanded} aria-controls={contentId}>
                  <ChevronUp className="h-4 w-4" aria-hidden="true" />{t.minimize}
                </Button>
              )}
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
}
