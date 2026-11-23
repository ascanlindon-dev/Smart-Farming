import { apiFetch } from '../lib/apiFetch.mjs';
import { useContext, useEffect, useState } from 'react';
import { ArrowLeft, Eye, EyeOff, KeyRound, MailCheck, ShieldCheck } from 'lucide-react';
import { LanguageContext } from '../LanguageContext';
import { Input } from './ui/input';
import { Label } from './ui/label';
import { Button } from './ui/button';
import AuthShell from './AuthShell';

const translations = {
  en: {
    badge: 'Account Recovery',
    requestTitle: 'Reset your password',
    requestDescription: 'Enter the email address linked to your RAMBUTECH account. We’ll send you a verification code.',
    email: 'Email address',
    emailPlaceholder: 'farmer@example.com',
    sendCode: 'Send verification code',
    sending: 'Sending code...',
    resetTitle: 'Choose a new password',
    resetDescription: 'Enter the 6-digit code sent to your email, then create a new password.',
    code: 'Verification code',
    codePlaceholder: '6-digit code',
    newPassword: 'New password',
    confirmPassword: 'Confirm new password',
    passwordHint: 'Use at least 8 characters.',
    updatePassword: 'Update password',
    updating: 'Updating password...',
    resend: 'Resend code',
    resendIn: (seconds) => `Resend code in ${seconds}s`,
    resending: 'Sending...',
    doneTitle: 'Password updated',
    doneDescription: 'Your password has been changed. You can now sign in with your new password.',
    back: 'Back to sign in',
    passwordMismatch: 'The passwords do not match.',
    passwordShort: 'Use at least 8 characters for your new password.',
    requestError: 'Could not send a reset code. Please try again.',
    resendError: 'Could not resend the code. Please try again.',
    resetError: 'Could not reset your password. Please try again.',
    connectionError: 'Unable to connect to the server. Check your connection and try again.',
  },
  tl: {
    badge: 'Pagbawi ng Account',
    requestTitle: 'I-reset ang password',
    requestDescription: 'Ilagay ang email na naka-link sa iyong RAMBUTECH account. Padadalhan ka namin ng verification code.',
    email: 'Email address',
    emailPlaceholder: 'magsasaka@example.com',
    sendCode: 'Ipadala ang verification code',
    sending: 'Ipinapadala ang code...',
    resetTitle: 'Gumawa ng bagong password',
    resetDescription: 'Ilagay ang 6-digit na code na ipinadala sa email mo, pagkatapos ay gumawa ng bagong password.',
    code: 'Verification code',
    codePlaceholder: '6-digit na code',
    newPassword: 'Bagong password',
    confirmPassword: 'Kumpirmahin ang bagong password',
    passwordHint: 'Gumamit ng hindi bababa sa 8 karakter.',
    updatePassword: 'I-update ang password',
    updating: 'Ina-update ang password...',
    resend: 'Ipadala muli ang code',
    resendIn: (seconds) => `Muling ipadala sa loob ng ${seconds}s`,
    resending: 'Ipinapadala...',
    doneTitle: 'Na-update na ang password',
    doneDescription: 'Napaltan na ang iyong password. Maaari ka nang mag-sign in gamit ang bago mong password.',
    back: 'Bumalik sa pag-sign in',
    passwordMismatch: 'Hindi magkatugma ang mga password.',
    passwordShort: 'Gumamit ng hindi bababa sa 8 karakter para sa bagong password.',
    requestError: 'Hindi makapagpadala ng reset code. Subukan muli.',
    resendError: 'Hindi naipadala muli ang code. Subukan muli.',
    resetError: 'Hindi na-reset ang password. Subukan muli.',
    connectionError: 'Hindi makakonekta sa server. Suriin ang koneksyon at subukan muli.',
  },
};

export default function ForgotPassword({ onSwitchToLogin }) {
  const { language, changeLanguage } = useContext(LanguageContext);
  const t = translations[language] || translations.en;
  const [stage, setStage] = useState('request');
  const [email, setEmail] = useState('');
  const [code, setCode] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [error, setError] = useState('');
  const [info, setInfo] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [resendCooldown, setResendCooldown] = useState(0);
  const [resendingCode, setResendingCode] = useState(false);

  useEffect(() => {
    if (resendCooldown <= 0) return undefined;
    const timer = setTimeout(() => setResendCooldown((seconds) => seconds - 1), 1000);
    return () => clearTimeout(timer);
  }, [resendCooldown]);

  const handleRequestCode = async (event) => {
    event.preventDefault();
    const normalizedEmail = email.trim().toLowerCase();
    if (!normalizedEmail) return;
    setError('');
    setSubmitting(true);
    try {
      const response = await apiFetch('/api/password_reset/request/', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: normalizedEmail }),
      });
      const result = await response.json().catch(() => ({}));
      if (!response.ok) {
        setError(result.error || t.requestError);
        return;
      }
      setEmail(normalizedEmail);
      setInfo(result.message || 'If an account exists for this email, a reset code has been sent.');
      setStage('reset');
      setResendCooldown(30);
    } catch {
      setError(t.connectionError);
    } finally {
      setSubmitting(false);
    }
  };

  const handleResendCode = async () => {
    if (!email.trim() || resendCooldown > 0 || resendingCode) return;
    setError('');
    setResendingCode(true);
    try {
      const response = await apiFetch('/api/otp/request/', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: email.trim().toLowerCase(), purpose: 'reset' }),
      });
      const result = await response.json().catch(() => ({}));
      if (!response.ok) {
        setError(result.error || t.resendError);
        return;
      }
      setInfo(result.message || 'A new verification code was sent. Check your email.');
      setCode('');
      setResendCooldown(30);
    } catch {
      setError(t.connectionError);
    } finally {
      setResendingCode(false);
    }
  };

  const handleConfirmReset = async (event) => {
    event.preventDefault();
    if (newPassword.length < 8) {
      setError(t.passwordShort);
      return;
    }
    if (newPassword !== confirmPassword) {
      setError(t.passwordMismatch);
      return;
    }
    setError('');
    setSubmitting(true);
    try {
      const response = await apiFetch('/api/password_reset/confirm/', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: email.trim().toLowerCase(),
          code: code.trim(),
          newPassword,
          confirmPassword,
        }),
      });
      const result = await response.json().catch(() => ({}));
      if (!response.ok) {
        setError(result.error || t.resetError);
        return;
      }
      setStage('done');
    } catch {
      setError(t.connectionError);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <AuthShell
      language={language}
      onLanguageChange={changeLanguage}
      badge={t.badge}
    >
      {stage === 'request' && (
        <div>
          <div className="mb-6">
            <span className="mb-4 flex h-12 w-12 items-center justify-center rounded-2xl bg-emerald-50 text-[#14532D]">
              <KeyRound className="h-6 w-6" aria-hidden="true" />
            </span>
            <h1 className="auth-heading text-2xl font-extrabold tracking-tight text-stone-900 sm:text-3xl">{t.requestTitle}</h1>
            <p className="mt-2 text-sm leading-relaxed text-stone-600">{t.requestDescription}</p>
          </div>
          <form onSubmit={handleRequestCode} className="space-y-5">
            <div className="space-y-2">
              <Label htmlFor="reset-email" className="text-sm font-bold text-stone-800">{t.email}</Label>
              <Input
                id="reset-email"
                type="email"
                placeholder={t.emailPlaceholder}
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                autoComplete="email"
                className="min-h-[50px] rounded-xl border border-[#D6D3CD] bg-white px-4 text-[15px] focus-visible:border-[#14532D] focus-visible:ring-4 focus-visible:ring-emerald-600/20"
                required
              />
            </div>
            {error && <p role="alert" className="rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-800">{error}</p>}
            <Button type="submit" disabled={submitting} className="min-h-[52px] w-full rounded-xl bg-[#14532D] text-[15px] font-bold text-white shadow-sm hover:bg-[#0F3F22] disabled:opacity-60">
              {submitting ? t.sending : t.sendCode}
            </Button>
          </form>
        </div>
      )}

      {stage === 'reset' && (
        <div>
          <div className="mb-6">
            <span className="mb-4 flex h-12 w-12 items-center justify-center rounded-2xl bg-emerald-50 text-[#14532D]">
              <MailCheck className="h-6 w-6" aria-hidden="true" />
            </span>
            <h1 className="auth-heading text-2xl font-extrabold tracking-tight text-stone-900 sm:text-3xl">{t.resetTitle}</h1>
            <p className="mt-2 text-sm leading-relaxed text-stone-600">{t.resetDescription}</p>
            <p className="mt-2 break-all text-sm font-semibold text-[#14532D]">{email}</p>
          </div>
          {info && <p role="status" className="mb-4 rounded-xl border border-emerald-200 bg-emerald-50 p-3 text-sm leading-relaxed text-emerald-900">{info}</p>}
          <form onSubmit={handleConfirmReset} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="reset-code" className="text-sm font-bold text-stone-800">{t.code}</Label>
              <Input
                id="reset-code"
                type="text"
                inputMode="numeric"
                maxLength={6}
                placeholder={t.codePlaceholder}
                value={code}
                onChange={(event) => setCode(event.target.value.replace(/[^0-9]/g, ''))}
                autoComplete="one-time-code"
                className="min-h-[50px] rounded-xl border border-[#D6D3CD] bg-white px-4 text-[15px] tracking-[0.3em] focus-visible:border-[#14532D] focus-visible:ring-4 focus-visible:ring-emerald-600/20"
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="new-password" className="text-sm font-bold text-stone-800">{t.newPassword}</Label>
              <div className="relative">
                <Input
                  id="new-password"
                  type={showNewPassword ? 'text' : 'password'}
                  value={newPassword}
                  onChange={(event) => setNewPassword(event.target.value)}
                  autoComplete="new-password"
                  minLength={8}
                  className="min-h-[50px] rounded-xl border border-[#D6D3CD] bg-white px-4 pr-14 text-[15px] focus-visible:border-[#14532D] focus-visible:ring-4 focus-visible:ring-emerald-600/20"
                  required
                />
                <button type="button" onClick={() => setShowNewPassword((value) => !value)} className="absolute right-1.5 top-1/2 flex h-11 w-11 -translate-y-1/2 items-center justify-center rounded-xl text-stone-600 hover:bg-stone-100 focus:outline-none focus:ring-2 focus:ring-[#14532D]" aria-label={showNewPassword ? 'Hide password' : 'Show password'} aria-pressed={showNewPassword}>
                  {showNewPassword ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
                </button>
              </div>
              <p className="text-xs text-stone-500">{t.passwordHint}</p>
            </div>
            <div className="space-y-2">
              <Label htmlFor="confirm-password" className="text-sm font-bold text-stone-800">{t.confirmPassword}</Label>
              <div className="relative">
                <Input
                  id="confirm-password"
                  type={showConfirmPassword ? 'text' : 'password'}
                  value={confirmPassword}
                  onChange={(event) => setConfirmPassword(event.target.value)}
                  autoComplete="new-password"
                  minLength={8}
                  className="min-h-[50px] rounded-xl border border-[#D6D3CD] bg-white px-4 pr-14 text-[15px] focus-visible:border-[#14532D] focus-visible:ring-4 focus-visible:ring-emerald-600/20"
                  required
                />
                <button type="button" onClick={() => setShowConfirmPassword((value) => !value)} className="absolute right-1.5 top-1/2 flex h-11 w-11 -translate-y-1/2 items-center justify-center rounded-xl text-stone-600 hover:bg-stone-100 focus:outline-none focus:ring-2 focus:ring-[#14532D]" aria-label={showConfirmPassword ? 'Hide password' : 'Show password'} aria-pressed={showConfirmPassword}>
                  {showConfirmPassword ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
                </button>
              </div>
            </div>
            {error && <p role="alert" className="rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-800">{error}</p>}
            <Button type="submit" disabled={submitting} className="min-h-[52px] w-full rounded-xl bg-[#14532D] text-[15px] font-bold text-white shadow-sm hover:bg-[#0F3F22] disabled:opacity-60">
              {submitting ? t.updating : t.updatePassword}
            </Button>
          </form>
          <div className="mt-4 flex flex-wrap items-center justify-between gap-2">
            <button type="button" onClick={handleResendCode} disabled={resendCooldown > 0 || resendingCode} className="min-h-10 rounded-lg px-2 text-sm font-semibold text-[#14532D] hover:bg-emerald-50 disabled:cursor-not-allowed disabled:text-stone-400">
              {resendingCode ? t.resending : resendCooldown > 0 ? t.resendIn(resendCooldown) : t.resend}
            </button>
            <button type="button" onClick={onSwitchToLogin} className="inline-flex min-h-10 items-center gap-1 rounded-lg px-2 text-sm font-semibold text-stone-600 hover:bg-stone-100 hover:text-stone-900">
              <ArrowLeft className="h-4 w-4" aria-hidden="true" />
              {t.back}
            </button>
          </div>
        </div>
      )}

      {stage === 'done' && (
        <div className="text-center">
          <span className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-emerald-50 text-[#14532D]">
            <ShieldCheck className="h-7 w-7" aria-hidden="true" />
          </span>
          <h1 className="auth-heading text-2xl font-extrabold tracking-tight text-stone-900 sm:text-3xl">{t.doneTitle}</h1>
          <p className="mt-2 text-sm leading-relaxed text-stone-600">{t.doneDescription}</p>
          <Button type="button" onClick={onSwitchToLogin} className="mt-6 min-h-[52px] w-full rounded-xl bg-[#14532D] text-[15px] font-bold text-white shadow-sm hover:bg-[#0F3F22]">
            {t.back}
          </Button>
        </div>
      )}

      {stage !== 'done' && stage !== 'reset' && (
        <button type="button" onClick={onSwitchToLogin} className="mt-5 inline-flex min-h-10 w-full items-center justify-center gap-1 rounded-lg px-2 text-sm font-semibold text-stone-600 hover:bg-stone-100 hover:text-stone-900">
          <ArrowLeft className="h-4 w-4" aria-hidden="true" />
          {t.back}
        </button>
      )}
    </AuthShell>
  );
}
