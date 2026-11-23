import { useCallback, useContext, useEffect, useState } from 'react';
import { AlertCircle, FileText, ShieldCheck } from 'lucide-react';
import { apiFetch } from '../lib/apiFetch.mjs';
import { LanguageContext } from '../LanguageContext';
import ConsentPage from './ConsentPage';

export default function ConsentSettings({ onWithdrawn }) {
  const { language } = useContext(LanguageContext);
  const isTagalog = language === 'tl';
  const [status, setStatus] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [showReview, setShowReview] = useState(false);
  const [confirmWithdraw, setConfirmWithdraw] = useState(false);
  const [withdrawing, setWithdrawing] = useState(false);

  const loadConsent = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const response = await apiFetch('/api/consent/');
      const result = await response.json();
      if (!response.ok) {
        throw new Error(result.error || 'Unable to load consent status.');
      }
      setStatus(result);
    } catch (requestError) {
      setError(requestError.message || 'Unable to load consent status.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadConsent();
  }, [loadConsent]);

  const withdrawAll = async () => {
    setWithdrawing(true);
    setError('');
    try {
      const response = await apiFetch('/api/consent/withdraw/', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ scope: 'all' }),
      });
      const result = await response.json();
      if (!response.ok) {
        throw new Error(result.error || 'Unable to withdraw consent.');
      }
      await onWithdrawn?.();
    } catch (requestError) {
      setError(requestError.message || 'Unable to withdraw consent.');
    } finally {
      setWithdrawing(false);
      setConfirmWithdraw(false);
    }
  };

  if (showReview) {
    return (
      <ConsentPage
        mode="review"
        initialConsent={status?.current}
        currentVersion={status?.consentVersion}
        onAccepted={(result) => {
          setStatus(result);
          setShowReview(false);
        }}
        onDecline={() => setShowReview(false)}
      />
    );
  }

  return (
    <section className="space-y-3 border-t border-slate-200 pt-5" aria-labelledby="consent-settings-heading">
      <div className="flex items-start gap-3">
        <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-emerald-50 text-emerald-700">
          <ShieldCheck className="h-5 w-5" aria-hidden="true" />
        </span>
        <div>
          <h4 id="consent-settings-heading" className="text-lg font-bold text-slate-800">
            {isTagalog ? 'Data Privacy at Pahintulot' : 'Data Privacy & Consent'}
          </h4>
          <p className="text-sm text-slate-500">
            {isTagalog ? 'Suriin o baguhin ang iyong mga piniling pahintulot.' : 'Review or update your consent choices.'}
          </p>
        </div>
      </div>

      {loading ? (
        <p role="status" className="text-sm text-slate-600">{isTagalog ? 'Kinukuha ang status...' : 'Loading consent status...'}</p>
      ) : status && (
        <div className="grid gap-2 rounded-xl border border-emerald-100 bg-emerald-50/70 p-4 text-sm sm:grid-cols-2">
          <p>
            <span className="font-semibold text-slate-800">{isTagalog ? 'Privacy Notice:' : 'Privacy Notice:'}</span>{' '}
            <span className={status.privacyAccepted ? 'font-semibold text-emerald-800' : 'font-semibold text-amber-800'}>
              {status.privacyAccepted ? (isTagalog ? 'Tinanggap' : 'Accepted') : (isTagalog ? 'Kailangang suriin' : 'Review required')}
            </span>
          </p>
          <p>
            <span className="font-semibold text-slate-800">{isTagalog ? 'Pananaliksik:' : 'Research:'}</span>{' '}
            <span className="font-semibold text-slate-700">
              {status.researchAccepted ? (isTagalog ? 'Sumali' : 'Opted in') : (isTagalog ? 'Hindi sumali' : 'Not participating')}
            </span>
          </p>
          <p className="text-xs text-slate-600 sm:col-span-2">
            {isTagalog ? 'Bersyon ng pahintulot: ' : 'Consent version: '}
            {status.current?.consent_version || status.consentVersion}
            {status.current?.agreed_at && ` · ${new Date(status.current.agreed_at).toLocaleString()}`}
          </p>
        </div>
      )}

      {error && (
        <p role="alert" className="flex items-start gap-2 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-800">
          <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
          {error}
        </p>
      )}

      <div className="flex flex-col gap-2 sm:flex-row">
        <button
          type="button"
          onClick={() => setShowReview(true)}
          disabled={loading || !status}
          className="flex flex-1 items-center justify-center gap-2 rounded-xl bg-emerald-700 px-4 py-3 font-semibold text-white transition hover:bg-emerald-800 disabled:cursor-not-allowed disabled:opacity-50"
        >
          <FileText className="h-4 w-4" aria-hidden="true" />
          {isTagalog ? 'Suriin ang Privacy Notice' : 'Review Privacy Notice'}
        </button>
        <button
          type="button"
          onClick={() => setConfirmWithdraw(true)}
          disabled={loading || !status?.current || withdrawing}
          className="rounded-xl border border-rose-300 px-4 py-3 font-semibold text-rose-700 transition hover:bg-rose-50 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {isTagalog ? 'Bawiin ang lahat ng pahintulot' : 'Withdraw all consent'}
        </button>
      </div>

      {confirmWithdraw && (
        <div className="fixed inset-0 z-[80] flex items-center justify-center bg-slate-950/50 p-4" role="alertdialog" aria-modal="true" aria-labelledby="withdraw-consent-title">
          <div className="w-full max-w-md space-y-4 rounded-2xl bg-white p-6 shadow-2xl">
            <h4 id="withdraw-consent-title" className="text-lg font-bold text-slate-900">
              {isTagalog ? 'Bawiin ang lahat ng pahintulot?' : 'Withdraw all consent?'}
            </h4>
            <p className="text-sm leading-relaxed text-slate-600">
              {isTagalog
                ? 'Itatala ang oras ng pag-withdraw at ila-log out ka. Hindi mo magagamit ang farm system hangga’t hindi mo muling tinatanggap ang kasalukuyang Privacy Notice.'
                : 'The withdrawal time will be recorded and you will be signed out. You cannot use the farm system until you accept the current Privacy Notice again.'}
            </p>
            <div className="flex gap-3">
              <button
                type="button"
                onClick={withdrawAll}
                disabled={withdrawing}
                className="flex-1 rounded-xl bg-rose-700 px-4 py-3 font-bold text-white hover:bg-rose-800 disabled:opacity-60"
              >
                {withdrawing ? (isTagalog ? 'Pinoproseso...' : 'Processing...') : (isTagalog ? 'Oo, bawiin' : 'Yes, withdraw')}
              </button>
              <button
                type="button"
                onClick={() => setConfirmWithdraw(false)}
                disabled={withdrawing}
                className="flex-1 rounded-xl border border-slate-300 px-4 py-3 font-bold text-slate-700 hover:bg-slate-50"
              >
                {isTagalog ? 'Kanselahin' : 'Cancel'}
              </button>
            </div>
          </div>
        </div>
      )}
    </section>
  );
}
