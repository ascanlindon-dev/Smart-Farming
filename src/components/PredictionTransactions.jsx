import { useContext, useEffect, useId, useState } from 'react';
import { ChevronDown, ChevronUp, RefreshCw } from 'lucide-react';
import { LanguageContext } from '../LanguageContext';
import { apiFetch } from '../lib/apiFetch.mjs';
import { Button } from './ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from './ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from './ui/table';

const translations = {
  en: {
    title: 'Prediction Transactions',
    description: 'Your latest 50 saved leaf disease and fruit maturity scans, newest first.',
    totalTransactions: 'Total Transactions',
    leafTransactions: 'Leaf',
    fruitTransactions: 'Fruit',
    predictionType: 'Prediction Type',
    label: 'Label',
    imageName: 'Image Name',
    createdAt: 'Created At',
    refresh: 'Refresh',
    loading: 'Loading your transactions...',
    error: 'Unable to load your transactions. Please try again.',
    expired: 'Your session has expired. Please sign in again to view your transactions.',
    retry: 'Try again',
    empty: 'No prediction transactions yet. Saved scans will appear here.',
    noImage: 'No image name',
    localTime: 'Dates and times use your local timezone.',
    expand: 'View latest 50',
    minimize: 'Minimize to 10',
    showing: (shown, total) => `Showing ${shown} of ${total} recent transactions`,
  },
  tl: {
    title: 'Mga Transaksyon ng Prediksyon',
    description: 'Ang pinakabagong 50 naka-save na scan ng sakit sa dahon at pagkahinog ng bunga sa iyong account, pinakabago muna.',
    totalTransactions: 'Kabuuang Transaksyon',
    leafTransactions: 'Dahon',
    fruitTransactions: 'Prutas',
    predictionType: 'Uri ng Prediksyon',
    label: 'Label',
    imageName: 'Pangalan ng Larawan',
    createdAt: 'Petsa at Oras',
    refresh: 'I-refresh',
    loading: 'Kinukuha ang iyong mga transaksyon...',
    error: 'Hindi makuha ang iyong mga transaksyon. Subukan muli.',
    expired: 'Nag-expire ang iyong session. Mag-sign in muli upang makita ang iyong mga transaksyon.',
    retry: 'Subukan muli',
    empty: 'Wala pang transaksyon ng prediksyon. Lalabas dito ang mga naka-save na scan.',
    noImage: 'Walang pangalan ng larawan',
    localTime: 'Ang petsa at oras ay ayon sa iyong lokal na timezone.',
    expand: 'Tingnan ang huling 50',
    minimize: 'Ipakita lang ang 10',
    showing: (shown, total) => `Ipinapakita ang ${shown} sa ${total} pinakabagong transaksyon`,
  },
};

export default function PredictionTransactions() {
  const { language } = useContext(LanguageContext);
  const t = translations[language] || translations.en;
  const [expanded, setExpanded] = useState(false);
  const contentId = useId();
  const [revision, setRevision] = useState(0);
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    const controller = new AbortController();
    setLoading(true);
    setError(null);
    setData(null);

    async function loadTransactions() {
      try {
        const response = await apiFetch('/api/predictions/transactions/?page_size=50', {
          signal: controller.signal,
          cache: 'no-store',
        });
        if (response.status === 401 || response.status === 403) {
          if (!controller.signal.aborted) setError('expired');
          return;
        }
        if (!response.ok) throw new Error('Unable to load transactions');
        const result = await response.json();
        if (!controller.signal.aborted) setData(result);
      } catch {
        if (!controller.signal.aborted) setError('error');
      } finally {
        if (!controller.signal.aborted) setLoading(false);
      }
    }

    void loadTransactions();
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
        {loading ? (
          <p role="status" className="py-8 text-center text-sm text-slate-600">{t.loading}</p>
        ) : error ? (
          <div role="alert" className="space-y-3 rounded-xl bg-red-50 p-4 text-sm text-red-800">
            <p>{t[error]}</p>
            <Button type="button" variant="outline" onClick={refresh}>{t.retry}</Button>
          </div>
        ) : data && (
          <>
            <Table aria-label={t.title}>
              <TableHeader>
                <TableRow className="bg-slate-50">
                  <TableHead scope="col">{t.predictionType}</TableHead>
                  <TableHead scope="col">{t.label}</TableHead>
                  <TableHead scope="col">{t.imageName}</TableHead>
                  <TableHead scope="col">{t.createdAt}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {visibleRecords.length ? visibleRecords.map((record) => (
                  <TableRow key={record.id}>
                    <TableCell>
                      <span className={`inline-flex rounded-full px-2.5 py-1 text-xs font-medium ${record.prediction_type === 'leaf' ? 'bg-emerald-50 text-emerald-800' : 'bg-orange-50 text-orange-800'}`}>
                        {record.prediction_type}
                      </span>
                    </TableCell>
                    <TableCell className="max-w-xs whitespace-normal break-words font-medium text-slate-900">{record.label}</TableCell>
                    <TableCell className="max-w-xs whitespace-normal break-all text-slate-600">{record.image_name || t.noImage}</TableCell>
                    <TableCell className="text-slate-600">
                      <time dateTime={record.created_at}>{dateFormatter.format(new Date(record.created_at))}</time>
                    </TableCell>
                  </TableRow>
                )) : (
                  <TableRow>
                    <TableCell colSpan={4} className="whitespace-normal py-8 text-center text-slate-500">{t.empty}</TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
            <dl className="grid grid-cols-1 gap-2 rounded-lg border border-slate-200 bg-slate-50 px-4 py-3 text-sm sm:grid-cols-3 sm:gap-6">
              {[
                [t.totalTransactions, data.count],
                [t.leafTransactions, data.leaf_count],
                [t.fruitTransactions, data.fruit_count],
              ].map(([label, count]) => (
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
                <p className="mt-1 text-xs">{t.localTime}</p>
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
