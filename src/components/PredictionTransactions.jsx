import { useContext, useEffect, useId, useRef, useState } from 'react';
import { ChevronDown, ChevronUp, RefreshCw } from 'lucide-react';
import { LanguageContext } from '../LanguageContext';
import { apiFetch } from '../lib/apiFetch.mjs';
import { maturityReadiness } from '../lib/maturityAdvice.mjs';
import { readSessionData, writeSessionData } from '../lib/sessionDataCache.mjs';
import { Button } from './ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from './ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from './ui/table';

const translations = {
  en: {
    title: 'Prediction Transactions',
    leafTitle: 'Leaf Disease Scans',
    maturityTitle: 'Maturity Assessment Scans',
    description: 'Your latest 50 saved leaf disease and fruit maturity scans, newest first.',
    leafDescription: 'Saved leaf disease scan results, newest first.',
    maturityDescription: 'Saved rambutan maturity scan results, newest first.',
    totalTransactions: 'Total Transactions',
    leafTransactions: 'Leaf',
    fruitTransactions: 'Fruit',
    assessedFruits: 'Assessed fruits',
    ripe: 'Ripe',
    unripe: 'Unripe',
    photo: 'Fruit photo',
    confidence: 'Confidence',
    unavailablePhoto: 'Image unavailable',
    previousPage: 'Previous',
    nextPage: 'Next',
    pageOf: (page, total) => `Page ${page} of ${total}`,
    predictionType: 'Prediction Type',
    label: 'Label',
    imageName: 'Image Name',
    createdAt: 'Created At',
    refresh: 'Refresh',
    loading: 'Loading your transactions...',
    error: 'Unable to load your transactions. Please try again.',
    stale: 'Showing saved transactions. The latest refresh failed.',
    expired: 'Your session has expired. Please sign in again to view your transactions.',
    retry: 'Try again',
    empty: 'No prediction transactions yet. Saved scans will appear here.',
    leafEmpty: 'No leaf disease scans saved yet.',
    maturityEmpty: 'No maturity assessment scans saved yet.',
    noImage: 'No image name',
    localTime: 'Dates and times use your local timezone.',
    manilaTime: 'Assessment dates and times use Asia/Manila.',
    timelineNote: 'Each item is one photo assessment. Separate photos are not assumed to show the same fruit.',
    expand: 'View latest 50',
    minimize: 'Minimize to 10',
    showing: (shown, total) => `Showing ${shown} of ${total} recent transactions`,
  },
  tl: {
    title: 'Mga Transaksyon ng Prediksyon',
    leafTitle: 'Mga Scan ng Sakit sa Dahon',
    maturityTitle: 'Mga Scan ng Pagtatasa ng Pagkahinog',
    description: 'Ang pinakabagong 50 naka-save na scan ng sakit sa dahon at pagkahinog ng bunga sa iyong account, pinakabago muna.',
    leafDescription: 'Mga naka-save na resulta ng scan sa sakit ng dahon, pinakabago muna.',
    maturityDescription: 'Mga naka-save na resulta ng scan sa pagkahinog ng rambutan, pinakabago muna.',
    totalTransactions: 'Kabuuang Transaksyon',
    leafTransactions: 'Dahon',
    fruitTransactions: 'Prutas',
    assessedFruits: 'Mga nasuring bunga',
    ripe: 'Hinog',
    unripe: 'Hindi pa hinog',
    photo: 'Larawan ng bunga',
    confidence: 'Kumpiyansa',
    unavailablePhoto: 'Hindi available ang larawan',
    previousPage: 'Nakaraan',
    nextPage: 'Susunod',
    pageOf: (page, total) => `Pahina ${page} sa ${total}`,
    predictionType: 'Uri ng Prediksyon',
    label: 'Label',
    imageName: 'Pangalan ng Larawan',
    createdAt: 'Petsa at Oras',
    refresh: 'I-refresh',
    loading: 'Kinukuha ang iyong mga transaksyon...',
    error: 'Hindi makuha ang iyong mga transaksyon. Subukan muli.',
    stale: 'Ipinapakita ang naka-save na transaksyon. Nabigo ang pinakabagong pag-refresh.',
    expired: 'Nag-expire ang iyong session. Mag-sign in muli upang makita ang iyong mga transaksyon.',
    retry: 'Subukan muli',
    empty: 'Wala pang transaksyon ng prediksyon. Lalabas dito ang mga naka-save na scan.',
    leafEmpty: 'Wala pang naka-save na scan ng sakit sa dahon.',
    maturityEmpty: 'Wala pang naka-save na scan ng pagtatasa ng pagkahinog.',
    noImage: 'Walang pangalan ng larawan',
    localTime: 'Ang petsa at oras ay ayon sa iyong lokal na timezone.',
    manilaTime: 'Ang petsa at oras ng assessment ay ayon sa Asia/Manila.',
    timelineNote: 'Bawat item ay isang pagsusuri ng larawan. Hindi ipinapalagay na iisang bunga ang nasa magkakahiwalay na larawan.',
    expand: 'Tingnan ang huling 50',
    minimize: 'Ipakita lang ang 10',
    showing: (shown, total) => `Ipinapakita ang ${shown} sa ${total} pinakabagong transaksyon`,
  },
};

function getTransactionsPath(predictionType, page) {
  const params = new URLSearchParams({ page_size: '50', page: String(page) });
  if (predictionType) params.set('prediction_type', predictionType);
  return `/api/predictions/transactions/?${params.toString()}`;
}

function MaturityHistoryPhoto({ src, alt, unavailableLabel }) {
  const [failed, setFailed] = useState(false);
  if (failed || !src) {
    return <span className="text-xs text-slate-500">{unavailableLabel}</span>;
  }
  return (
    <img
      src={src}
      alt={alt}
      loading="lazy"
      onError={() => setFailed(true)}
      className="h-14 w-14 rounded-lg border border-slate-200 bg-slate-50 object-cover"
    />
  );
}

export default function PredictionTransactions({
  predictionType = '',
  onCountsChange,
  refreshKey = 0,
  viewMode = 'table',
}) {
  const { language } = useContext(LanguageContext);
  const t = translations[language] || translations.en;
  const title = predictionType === 'leaf' ? t.leafTitle : predictionType === 'rambutan' ? t.maturityTitle : t.title;
  const description = predictionType === 'leaf'
    ? t.leafDescription
    : predictionType === 'rambutan'
      ? t.maturityDescription
      : t.description;
  const emptyMessage = predictionType === 'leaf'
    ? t.leafEmpty
    : predictionType === 'rambutan'
      ? t.maturityEmpty
      : t.empty;
  const [expanded, setExpanded] = useState(false);
  const [page, setPage] = useState(1);
  const contentId = useId();
  const [revision, setRevision] = useState(0);
  const requestPath = getTransactionsPath(predictionType, page);
  const [initialCache] = useState(() => readSessionData(requestPath));
  const [data, setData] = useState(initialCache?.data ?? null);
  const requestPathRef = useRef(requestPath);
  const [loading, setLoading] = useState(!initialCache);
  const [error, setError] = useState(null);

  useEffect(() => {
    const controller = new AbortController();
    const cached = readSessionData(requestPath);
    const pathChanged = requestPathRef.current !== requestPath;
    requestPathRef.current = requestPath;
    if (cached) {
      setData(cached.data);
      onCountsChange?.({ leaf: cached.data.leaf_count, maturity: cached.data.fruit_count });
    } else if (pathChanged) {
      setData(null);
    }
    setLoading(!cached && (pathChanged || !data));
    setError(null);

    async function loadTransactions() {
      try {
        const response = await apiFetch(requestPath, {
          signal: controller.signal,
          cache: 'no-store',
        });
        if (response.status === 401 || response.status === 403) {
          if (!controller.signal.aborted) setError('expired');
          return;
        }
        if (!response.ok) throw new Error('Unable to load transactions');
        const result = await response.json();
        if (!controller.signal.aborted) {
          setData(result);
          writeSessionData(requestPath, result);
          onCountsChange?.({ leaf: result.leaf_count, maturity: result.fruit_count });
        }
      } catch {
        if (!controller.signal.aborted) setError('error');
      } finally {
        if (!controller.signal.aborted) setLoading(false);
      }
    }

    void loadTransactions();
    return () => controller.abort();
  }, [onCountsChange, page, predictionType, refreshKey, requestPath, revision]);

  const refresh = () => setRevision((value) => value + 1);
  const dateFormatter = new Intl.DateTimeFormat(language === 'tl' ? 'fil-PH' : 'en-PH', {
    year: 'numeric', month: 'short', day: 'numeric',
    hour: 'numeric', minute: '2-digit', second: '2-digit', timeZoneName: 'short',
    ...(predictionType === 'rambutan' ? { timeZone: 'Asia/Manila' } : {}),
  });
  const recentRecords = (data?.results || []).slice(0, 50);
  const visibleRecords = expanded ? recentRecords : recentRecords.slice(0, 10);

  return (
    <Card className="min-w-0 border-slate-200 bg-white shadow-sm">
      <CardHeader className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <CardTitle className="text-base text-slate-900">{title}</CardTitle>
          <CardDescription className="mt-1 text-sm text-slate-600">{description}</CardDescription>
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
            {viewMode === 'timeline' && predictionType === 'rambutan' ? (
              <div>
                <p className="mb-4 text-sm leading-6 text-slate-600">{t.timelineNote}</p>
                {visibleRecords.length ? (
                  <ol className="ml-2 space-y-3 border-l-2 border-emerald-100">
                    {visibleRecords.map((record) => {
                      const readiness = maturityReadiness(record.label);
                      const label = readiness === 'mature' ? t.ripe : readiness === 'immature' ? t.unripe : record.label;
                      return (
                        <li key={record.id} className="relative pl-5">
                          <span className="absolute -left-[0.42rem] top-4 h-3 w-3 rounded-full border-2 border-white bg-emerald-600 ring-2 ring-emerald-100" aria-hidden="true" />
                          <article className="flex min-w-0 flex-col gap-3 rounded-xl border border-slate-200 bg-white p-3 sm:flex-row sm:items-center">
                            <MaturityHistoryPhoto
                              src={record.image_url}
                              alt={`${t.photo} ${record.id}`}
                              unavailableLabel={t.unavailablePhoto}
                            />
                            <div className="min-w-0 flex-1">
                              <div className="flex flex-wrap items-center gap-2">
                                <span className={`rounded-full px-2.5 py-1 text-xs font-semibold ${readiness === 'mature' ? 'bg-emerald-50 text-emerald-800' : readiness === 'immature' ? 'bg-sky-50 text-sky-800' : 'bg-slate-100 text-slate-700'}`}>
                                  {label}
                                </span>
                                {record.confidence !== null && record.confidence !== undefined
                                  && Number.isFinite(Number(record.confidence)) && (
                                  <span className="text-xs text-slate-600">
                                    {t.confidence}: {(Number(record.confidence) * 100).toFixed(1)}%
                                  </span>
                                )}
                              </div>
                              <p className="mt-1 text-xs text-slate-500">{t.photo} #{record.id}</p>
                              <time className="mt-1 block text-sm text-slate-700" dateTime={record.created_at}>
                                {dateFormatter.format(new Date(record.created_at))}
                              </time>
                            </div>
                          </article>
                        </li>
                      );
                    })}
                  </ol>
                ) : (
                  <p className="whitespace-normal py-8 text-center text-slate-500">{emptyMessage}</p>
                )}
              </div>
            ) : (
              <Table aria-label={title}>
                <TableHeader>
                  <TableRow className="bg-slate-50">
                    {predictionType === 'rambutan' ? (
                      <>
                        <TableHead scope="col">{t.photo}</TableHead>
                        <TableHead scope="col">{t.label}</TableHead>
                        <TableHead scope="col">{t.confidence}</TableHead>
                        <TableHead scope="col">{t.createdAt}</TableHead>
                      </>
                    ) : (
                      <>
                        <TableHead scope="col">{t.predictionType}</TableHead>
                        <TableHead scope="col">{t.label}</TableHead>
                        <TableHead scope="col">{t.imageName}</TableHead>
                        <TableHead scope="col">{t.createdAt}</TableHead>
                      </>
                    )}
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {visibleRecords.length ? visibleRecords.map((record) => (
                    <TableRow key={record.id}>
                      {predictionType === 'rambutan' ? (
                        <>
                          <TableCell>
                            <MaturityHistoryPhoto
                              src={record.image_url}
                              alt={`${t.photo} ${record.id}`}
                              unavailableLabel={t.unavailablePhoto}
                            />
                          </TableCell>
                          <TableCell className="font-medium text-slate-900">
                            {maturityReadiness(record.label) === 'mature'
                              ? t.ripe
                              : maturityReadiness(record.label) === 'immature'
                                ? t.unripe
                                : record.label}
                          </TableCell>
                          <TableCell className="text-slate-600">
                            {record.confidence !== null && record.confidence !== undefined
                              && Number.isFinite(Number(record.confidence))
                              ? `${(Number(record.confidence) * 100).toFixed(1)}%`
                              : '—'}
                          </TableCell>
                        </>
                      ) : (
                        <>
                          <TableCell>
                            <span className={`inline-flex rounded-full px-2.5 py-1 text-xs font-medium ${record.prediction_type === 'leaf' ? 'bg-emerald-50 text-emerald-800' : 'bg-orange-50 text-orange-800'}`}>
                              {record.prediction_type}
                            </span>
                          </TableCell>
                          <TableCell className="max-w-xs whitespace-normal break-words font-medium text-slate-900">{record.label}</TableCell>
                          <TableCell className="max-w-xs whitespace-normal break-all text-slate-600">{record.image_name || t.noImage}</TableCell>
                        </>
                      )}
                      <TableCell className="text-slate-600">
                        <time dateTime={record.created_at}>{dateFormatter.format(new Date(record.created_at))}</time>
                      </TableCell>
                    </TableRow>
                  )) : (
                    <TableRow>
                      <TableCell colSpan={4} className="whitespace-normal py-8 text-center text-slate-500">{emptyMessage}</TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            )}
            <dl className="grid grid-cols-1 gap-2 rounded-lg border border-slate-200 bg-slate-50 px-4 py-3 text-sm sm:grid-cols-3 sm:gap-6">
              {(predictionType === 'rambutan'
                ? [
                    [t.assessedFruits, data.assessed_count],
                    [t.ripe, data.ripe_count],
                    [t.unripe, data.unripe_count],
                  ]
                : [
                    [t.totalTransactions, data.total_count ?? data.count],
                    [t.leafTransactions, data.leaf_count],
                    [t.fruitTransactions, data.fruit_count],
                  ]).map(([label, count]) => (
                <div key={label} className="flex items-baseline gap-2">
                  <dt className="font-medium text-slate-700">{label}</dt>
                  <dd className="font-semibold tabular-nums text-slate-900">
                    = {new Intl.NumberFormat(language === 'tl' ? 'fil-PH' : 'en-PH').format(count ?? 0)}
                  </dd>
                </div>
              ))}
            </dl>
            <div className="flex flex-col gap-3 text-sm text-slate-600 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <p role="status">{t.showing(visibleRecords.length, recentRecords.length)}</p>
                <p className="mt-1 text-xs">{predictionType === 'rambutan' ? t.manilaTime : t.localTime}</p>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                {expanded && (
                  <Button type="button" variant="outline" size="sm" onClick={() => setExpanded(false)}
                    aria-expanded={expanded} aria-controls={contentId}>
                    <ChevronUp className="h-4 w-4" aria-hidden="true" />{t.minimize}
                  </Button>
                )}
                {data.total_pages > 1 && (
                  <>
                    <Button type="button" variant="outline" size="sm" disabled={page <= 1 || loading}
                      onClick={() => setPage((value) => Math.max(1, value - 1))}>
                      {t.previousPage}
                    </Button>
                    <span className="text-xs tabular-nums">{t.pageOf(data.page, data.total_pages)}</span>
                    <Button type="button" variant="outline" size="sm" disabled={page >= data.total_pages || loading}
                      onClick={() => setPage((value) => Math.min(data.total_pages, value + 1))}>
                      {t.nextPage}
                    </Button>
                  </>
                )}
              </div>
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
}
