import { useContext, useEffect, useState } from 'react';
import { CalendarDays, ClipboardCheck, Loader2, Save } from 'lucide-react';
import { LanguageContext } from '../LanguageContext';
import { apiFetch } from '../lib/apiFetch.mjs';
import { maturityReadiness } from '../lib/maturityAdvice.mjs';
import { Button } from './ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from './ui/card';
import { Input } from './ui/input';
import { Label } from './ui/label';

const translations = {
  en: {
    title: 'Actual Harvest Records',
    history: 'Past harvests',
    description: 'Record harvests that have already happened. Past dates are reference only and do not change a CNN result.',
    harvestDate: 'Harvest date',
    notes: 'Notes (optional)',
    notesPlaceholder: 'For example, fruit condition or harvest observations',
    linkAssessment: 'Link this record to the currently displayed assessment only',
    linkedCaution: 'Other photos are not assumed to show the same fruit.',
    save: 'Save harvest record',
    saving: 'Saving...',
    loadError: 'Could not load harvest records. Try again.',
    saveError: 'Could not save this harvest record. Try again.',
    saved: 'Harvest record saved.',
    loading: 'Loading harvest records...',
    empty: 'No harvest dates recorded yet.',
    linked: (id, label) => `Linked to assessment #${id} (${label})`,
    notLinked: 'Farm harvest record; not linked to an assessment',
    refresh: 'Retry',
  },
  tl: {
    title: 'Mga Aktuwal na Tala ng Pag-ani',
    history: 'Mga nakaraang anihan',
    description: 'Itala ang mga anihang naganap na. Sanggunian lamang ang mga dating petsa at hindi nito binabago ang resulta ng CNN.',
    harvestDate: 'Petsa ng pag-ani',
    notes: 'Mga tala (opsyonal)',
    notesPlaceholder: 'Halimbawa, kondisyon ng bunga o obserbasyon sa pag-ani',
    linkAssessment: 'Iugnay ang tala sa kasalukuyang assessment lamang',
    linkedCaution: 'Hindi ipinapalagay na iisang bunga ang nasa ibang mga larawan.',
    save: 'I-save ang tala ng pag-ani',
    saving: 'Sine-save...',
    loadError: 'Hindi makuha ang mga tala ng pag-ani. Subukan muli.',
    saveError: 'Hindi na-save ang tala ng pag-ani. Subukan muli.',
    saved: 'Nai-save ang tala ng pag-ani.',
    loading: 'Kinukuha ang mga tala ng pag-ani...',
    empty: 'Wala pang naitalang petsa ng pag-ani.',
    linked: (id, label) => `Naka-link sa assessment #${id} (${label})`,
    notLinked: 'Tala ng ani sa bukid; hindi naka-link sa assessment',
    refresh: 'Subukan muli',
  },
};

function getManilaDate() {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Manila',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(new Date());
  const values = Object.fromEntries(parts.map(({ type, value }) => [type, value]));
  return `${values.year}-${values.month}-${values.day}`;
}

function formatHarvestDate(value, language) {
  const date = new Date(`${value}T12:00:00+08:00`);
  return new Intl.DateTimeFormat(language === 'tl' ? 'fil-PH' : 'en-PH', {
    dateStyle: 'medium',
    timeZone: 'Asia/Manila',
  }).format(date);
}

function sortHarvestRecords(records) {
  return [...records].sort((left, right) => (
    right.harvest_date.localeCompare(left.harvest_date) || right.id - left.id
  ));
}

export default function HarvestRecords({ predictionId = null }) {
  const { language } = useContext(LanguageContext);
  const t = translations[language] || translations.en;
  const [harvestDate, setHarvestDate] = useState(getManilaDate);
  const [notes, setNotes] = useState('');
  const [linkAssessment, setLinkAssessment] = useState(false);
  const [records, setRecords] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [revision, setRevision] = useState(0);

  useEffect(() => {
    setLinkAssessment(false);
  }, [predictionId]);

  useEffect(() => {
    const controller = new AbortController();
    async function loadRecords() {
      try {
        setLoading(true);
        const response = await apiFetch('/api/maturity/harvest-records/', {
          signal: controller.signal,
          cache: 'no-store',
        });
        const data = await response.json();
        if (!response.ok) throw new Error(data.error || t.loadError);
        if (!Array.isArray(data.results)) throw new Error(t.loadError);
        if (!controller.signal.aborted) {
          setRecords(sortHarvestRecords(data.results));
          setError('');
        }
      } catch {
        if (!controller.signal.aborted) setError(t.loadError);
      } finally {
        if (!controller.signal.aborted) setLoading(false);
      }
    }

    void loadRecords();
    return () => controller.abort();
  }, [revision, t.loadError]);

  async function handleSubmit(event) {
    event.preventDefault();
    setError('');
    setSuccess('');
    setSaving(true);
    try {
      const response = await apiFetch('/api/maturity/harvest-records/', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          harvest_date: harvestDate,
          notes,
          prediction_id: linkAssessment ? predictionId : null,
        }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || t.saveError);
      if (!Number.isInteger(data.id)) throw new Error(t.saveError);
      setRecords((current) => sortHarvestRecords([data, ...current]));
      setNotes('');
      setSuccess(t.saved);
    } catch (submitError) {
      setError(submitError.message || t.saveError);
    } finally {
      setSaving(false);
    }
  }

  return (
    <Card className="border border-emerald-100 bg-white shadow-sm">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base text-slate-900">
          <CalendarDays className="h-5 w-5 text-emerald-700" aria-hidden="true" />
          {t.title}
        </CardTitle>
        <CardDescription className="text-sm leading-6 text-slate-600">{t.description}</CardDescription>
      </CardHeader>
      <CardContent className="space-y-5">
        <form onSubmit={handleSubmit} className="grid gap-4 rounded-xl border border-emerald-100 bg-emerald-50/50 p-4 sm:grid-cols-2">
          <div className="space-y-2">
            <Label htmlFor="harvest-date">{t.harvestDate}</Label>
            <Input
              id="harvest-date"
              type="date"
              value={harvestDate}
              max={getManilaDate()}
              onChange={(event) => setHarvestDate(event.target.value)}
              required
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="harvest-notes">{t.notes}</Label>
            <Input
              id="harvest-notes"
              value={notes}
              onChange={(event) => setNotes(event.target.value)}
              placeholder={t.notesPlaceholder}
              maxLength={500}
            />
          </div>
          {predictionId && (
            <div className="space-y-1 sm:col-span-2">
              <label className="flex min-h-10 items-center gap-2 text-sm font-medium text-slate-800">
                <input
                  type="checkbox"
                  checked={linkAssessment}
                  onChange={(event) => setLinkAssessment(event.target.checked)}
                  className="h-4 w-4 rounded border-slate-300 accent-emerald-700"
                />
                {t.linkAssessment}
              </label>
              <p className="pl-6 text-xs text-slate-600">{t.linkedCaution}</p>
            </div>
          )}
          {error && <p role="alert" className="text-sm text-red-700 sm:col-span-2">{error}</p>}
          {success && <p role="status" className="text-sm text-emerald-800 sm:col-span-2">{success}</p>}
          <Button type="submit" disabled={saving || !harvestDate} className="gap-2 sm:col-span-2 sm:w-fit">
            {saving ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" /> : <Save className="h-4 w-4" aria-hidden="true" />}
            {saving ? t.saving : t.save}
          </Button>
        </form>

        <div>
          <h3 className="mb-3 flex items-center gap-2 text-sm font-semibold text-slate-800">
            <ClipboardCheck className="h-4 w-4 text-emerald-700" aria-hidden="true" />
            {t.history}
          </h3>
          {loading && !records.length ? (
            <p role="status" className="py-4 text-sm text-slate-600">{t.loading}</p>
          ) : error && !records.length ? (
            <div role="alert" className="space-y-2 rounded-lg bg-red-50 p-3 text-sm text-red-800">
              <p>{t.loadError}</p>
              <Button type="button" variant="outline" size="sm" onClick={() => setRevision((value) => value + 1)}>
                {t.refresh}
              </Button>
            </div>
          ) : records.length ? (
            <>
              {error && <p role="status" className="mb-3 text-sm text-amber-800">{t.loadError}</p>}
              <ol className="space-y-3">
                {records.map((record) => {
                  const linkedReadiness = record.prediction
                    ? maturityReadiness(record.prediction.label)
                    : null;
                  const linkedLabel = linkedReadiness === 'mature'
                    ? (language === 'tl' ? 'Hinog' : 'Ripe')
                    : linkedReadiness === 'immature'
                      ? (language === 'tl' ? 'Hindi pa hinog' : 'Unripe')
                      : record.prediction?.label;
                  return (
                    <li key={record.id} className="rounded-lg border border-slate-200 bg-white p-3">
                      <p className="font-semibold text-slate-900">
                        {formatHarvestDate(record.harvest_date, language)}
                      </p>
                      <p className="mt-1 text-xs text-slate-600">
                        {record.prediction
                          ? t.linked(record.prediction.id, linkedLabel)
                          : t.notLinked}
                      </p>
                      {record.notes && <p className="mt-2 whitespace-pre-wrap text-sm text-slate-700">{record.notes}</p>}
                    </li>
                  );
                })}
              </ol>
            </>
          ) : (
            <p className="rounded-lg border border-dashed border-slate-300 p-4 text-sm text-slate-600">{t.empty}</p>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
