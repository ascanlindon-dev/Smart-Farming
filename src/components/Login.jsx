import { apiFetch } from '../lib/apiFetch.mjs';
import { useState, useEffect } from "react";
import { useContext } from 'react';
import { toast } from 'sonner';
import { LanguageContext } from '../LanguageContext';
import { Input } from "./ui/input";
import { Label } from "./ui/label";
import { Button } from "./ui/button";
import GoogleSignInButton from "./GoogleSignInButton";
import { Eye, EyeOff } from "lucide-react";
import AuthShell from "./AuthShell";

export default function Login({ onLogin, onSwitchToSignup, onSwitchToForgot }) {
  const [identifier, setIdentifier] = useState(""); // email or mobile
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [rememberMe, setRememberMe] = useState(true);
  const [error, setError] = useState("");
  const [isSigningIn, setIsSigningIn] = useState(false);
  const { language, changeLanguage } = useContext(LanguageContext);
  const [backendUp, setBackendUp] = useState(true);

  // OTP verification step (sent to the account's Gmail address)
  const [stage, setStage] = useState("credentials"); // 'credentials' | 'otp'
  const [otpPurpose, setOtpPurpose] = useState("login"); // 'login' | 'signup'
  const [otpEmail, setOtpEmail] = useState("");
  const [otpCode, setOtpCode] = useState("");
  const [otpError, setOtpError] = useState("");
  const [otpInfo, setOtpInfo] = useState("");
  const [verifyingOtp, setVerifyingOtp] = useState(false);
  const [resendingOtp, setResendingOtp] = useState(false);
  const [resendCooldown, setResendCooldown] = useState(0);

  // Check backend availability on mount
  useEffect(() => {
    apiFetch('/api/ping/', { method: 'GET' })
      .then((r) => {
        if (!r.ok) throw new Error('Ping failed');
        setBackendUp(true);
      })
      .catch(() => setBackendUp(false));
  }, []);

  // Cooldown timer effect
  useEffect(() => {
    if (resendCooldown > 0) {
      const timer = setTimeout(() => setResendCooldown(resendCooldown - 1), 1000);
      return () => clearTimeout(timer);
    }
  }, [resendCooldown]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");
    if (!identifier || !password) return;
    const id = identifier.trim().toLowerCase();
    const pw = password;
    setIsSigningIn(true);
    const controller = new AbortController();
    const requestTimeout = setTimeout(() => controller.abort(), 30000);

    const url = '/api/login/';
    try {
      const res = await apiFetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        signal: controller.signal,
        body: JSON.stringify({ identifier: id, password: pw }) // send identifier
      });
      let result;
      try { result = await res.json(); } catch(e) { result = {}; }
      if (res.ok && result.otpRequired) {
        // Password verified; a login code was emailed to the account's Gmail address.
        setOtpPurpose("login");
        setOtpEmail(result.email || id);
        setOtpCode("");
        setOtpError("");
        setOtpInfo(`We sent a verification code to ${result.email || id}.`);
        setStage("otp");
      } else if (res.status === 403 && result.verificationRequired) {
        // Account exists but the signup email was never verified; resend that OTP.
        setOtpPurpose("signup");
        setOtpEmail(result.email || id);
        setOtpCode("");
        setOtpError("");
        setOtpInfo(result.error || "Please verify your email first.");
        setStage("otp");
      } else if (res.ok) {
        toast.success('Signed in');
        onLogin({
          role: result.role || 'farmer',
          email: result.email || id,
          name: result.name || '',
          username: result.username || id,
        }, rememberMe);
      } else {
        setError(result.error || "Sorry, the credentials you entered are incorrect. Please try again.");
      }
    } catch (err) {
      console.error('Login fetch error', err);
      setError(err.name === "AbortError" ? "Sign in is taking too long. Please try again." : "Unable to connect to server.");
    } finally {
      clearTimeout(requestTimeout);
      setIsSigningIn(false);
    }
  };

  const handleVerifyOtp = async (e) => {
    e.preventDefault();
    if (!otpCode.trim()) return;
    setOtpError("");
    setVerifyingOtp(true);
    const url = '/api/otp/verify/';
    try {
      const res = await apiFetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: otpEmail, code: otpCode.trim(), purpose: otpPurpose }),
      });
      let result;
      try { result = await res.json(); } catch (e) { result = {}; }
      if (res.ok) {
        if (otpPurpose === "signup") {
          toast.success(result.message || "Email verified. You can now log in.");
          setStage("credentials");
          setOtpCode("");
        } else {
          toast.success('Signed in');
          onLogin({
            role: result.role || 'farmer',
            email: result.email || otpEmail,
            name: result.name || '',
            username: result.username || otpEmail,
          }, rememberMe);
        }
      } else {
        setOtpError(result.error || "Invalid code. Please try again.");
      }
    } catch (err) {
      console.error('OTP verify fetch error', err);
      setOtpError("Unable to connect to server.");
    } finally {
      setVerifyingOtp(false);
    }
  };

  const handleGoogleSignIn = async (credential) => {
    setError("");
    setIsSigningIn(true);
    const controller = new AbortController();
    const requestTimeout = setTimeout(() => controller.abort(), 30000);
    try {
      const res = await apiFetch('/api/auth/google/', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        signal: controller.signal,
        body: JSON.stringify({ credential }),
      });
      const result = await res.json();
      if (!res.ok) throw new Error(result.error || 'Google sign-in failed. Please try again.');
      toast.success('Signed in');
      onLogin({
        role: result.role || 'farmer',
        email: result.email,
        name: result.name || '',
        username: result.username || result.email,
      }, rememberMe);
    } catch (err) {
      setError(err.name === 'AbortError' ? 'Google sign-in is taking too long. Please try again.' : err.message || 'Google sign-in failed. Please try again.');
    } finally {
      clearTimeout(requestTimeout);
      setIsSigningIn(false);
    }
  };

  const handleResendOtp = async () => {
    if (resendCooldown > 0) return; // Prevent clicks during cooldown
    setOtpError("");
    setResendingOtp(true);
    const url = '/api/otp/request/';
    try {
      const res = await apiFetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: otpEmail, purpose: otpPurpose }),
      });
      let result;
      try { result = await res.json(); } catch (e) { result = {}; }
      if (res.ok) {
        setOtpInfo(`A new code was sent to ${otpEmail}.`);
        setResendCooldown(30); // 30 second cooldown
      } else {
        setOtpError(result.error || "Failed to resend code.");
      }
    } catch (err) {
      setOtpError("Unable to connect to server.");
    } finally {
      setResendingOtp(false);
    }
  };

  return (
    <AuthShell language={language} onLanguageChange={changeLanguage}>
      {stage === 'otp' ? (
        <div className="space-y-5">
          <div>
            <h1 className="text-[26px] font-extrabold tracking-tight text-stone-900 sm:text-3xl" style={{ fontFamily: "'Plus Jakarta Sans', sans-serif" }}>
              {language === 'tl' ? 'Tingnan ang iyong email' : 'Check your email'}
            </h1>
            <p className="mt-2 text-sm leading-relaxed text-stone-600">
              {otpInfo || `We sent a verification code to ${otpEmail}.`}
            </p>
          </div>
          <form onSubmit={handleVerifyOtp} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="otpCode" className="text-sm font-bold text-stone-800">
                {language === 'tl' ? 'Verification Code' : 'Verification Code'}
              </Label>
              <Input
                id="otpCode"
                type="text"
                inputMode="numeric"
                maxLength={6}
                placeholder="6-digit code"
                value={otpCode}
                onChange={(e) => setOtpCode(e.target.value.replace(/[^0-9]/g, ""))}
                autoComplete="one-time-code"
                className="min-h-[50px] rounded-2xl border-2 border-[#D6D3CD] bg-white px-4 text-base focus-visible:ring-emerald-700"
                required
              />
            </div>
            <Button
              type="submit"
              disabled={verifyingOtp}
              className="min-h-[52px] w-full rounded-2xl bg-[#14532D] text-base font-bold text-white shadow-lg hover:bg-[#0F3F22]"
            >
              {verifyingOtp ? 'Verifying...' : (language === 'tl' ? 'I-verify ang Code' : 'Verify Code')}
            </Button>
            {otpError && <p role="alert" className="text-sm text-red-700">{otpError}</p>}
          </form>
          <div className="space-y-3 text-center">
            <p className="text-sm text-stone-600">
              {language === 'tl' ? 'Walang natanggap na code?' : "Didn't get a code?"}{' '}
              <button
                type="button"
                onClick={handleResendOtp}
                disabled={resendCooldown > 0 || resendingOtp}
                className="font-bold text-[#14532D] hover:underline disabled:cursor-not-allowed disabled:text-stone-400"
              >
                {resendCooldown > 0 ? `Resend in ${resendCooldown}s` : (language === 'tl' ? 'Ipadala muli' : 'Resend code')}
              </button>
            </p>
            <button type="button" onClick={() => { setStage('credentials'); setError(''); setOtpError(''); }} className="min-h-11 rounded-lg px-3 text-sm font-bold text-stone-600 hover:bg-stone-100">
              {language === 'tl' ? 'Bumalik sa pag-sign in' : 'Back to sign in'}
            </button>
          </div>
        </div>
      ) : (
        <div>
          <div className="mb-6">
            <h1 className="text-2xl font-extrabold tracking-tight text-stone-900 sm:text-3xl" style={{ fontFamily: "'Plus Jakarta Sans', sans-serif" }}>
              {language === 'tl' ? 'Maligayang Pagbabalik' : 'Welcome Back'}
            </h1>
            <p className="mt-2 text-[15px] text-stone-600">
              {language === 'tl' ? 'Mag-sign in para tingnan ang iyong rambutan farm.' : 'Sign in to check your rambutan trees.'}
            </p>
          </div>

          {!backendUp && (
            <div role="alert" className="mb-4 rounded-2xl border border-red-200 bg-red-50 px-3 py-2 text-[13px] text-red-800">
              <strong>Service temporarily unavailable.</strong>
              <span className="ml-1">{language === 'tl' ? 'Hindi makakonekta sa server. I-refresh ang page at subukan muli.' : 'We could not connect to the server. Please refresh the page and try again.'}</span>
            </div>
          )}

          <GoogleSignInButton onCredential={handleGoogleSignIn} disabled={isSigningIn} />
          <div className="my-5 flex items-center gap-3">
            <span className="h-px flex-1 bg-[#D6D3CD]" />
            <span className="text-xs font-semibold uppercase tracking-wider text-stone-600">{language === 'tl' ? 'o gamitin ang email' : 'or use email'}</span>
            <span className="h-px flex-1 bg-[#D6D3CD]" />
          </div>

          <form onSubmit={handleSubmit} className="space-y-5">
            <div className="space-y-2">
              <Label htmlFor="identifier" className="text-sm font-bold text-stone-800">
                {language === 'tl' ? 'Email Address' : 'Email Address'}
              </Label>
              <Input
                id="identifier"
                type="email"
                placeholder="farmer@example.com"
                value={identifier}
                onChange={(e) => setIdentifier(e.target.value)}
                autoComplete="email"
                className="min-h-[50px] rounded-xl border border-[#D6D3CD] bg-white px-4 text-[15px] focus-visible:border-[#14532D] focus-visible:ring-4 focus-visible:ring-emerald-600/20"
                required
              />
            </div>

            <div className="space-y-2">
              <div className="flex items-center justify-between gap-2">
                <Label htmlFor="password" className="text-sm font-bold text-stone-800">
                  {language === 'tl' ? 'Password' : 'Password'}
                </Label>
                <button type="button" onClick={onSwitchToForgot} className="min-h-8 rounded px-1 text-xs font-bold text-[#14532D] hover:underline sm:text-sm">
                  {language === 'tl' ? 'Nakalimutan ang password?' : 'Forgot password?'}
                </button>
              </div>
              <div className="relative">
                <Input
                  id="password"
                  type={showPassword ? 'text' : 'password'}
                  placeholder="••••••••"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  autoComplete="current-password"
                  className="min-h-[50px] rounded-xl border border-[#D6D3CD] bg-white px-4 pr-14 text-[15px] focus-visible:border-[#14532D] focus-visible:ring-4 focus-visible:ring-emerald-600/20"
                  required
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((visible) => !visible)}
                  className="absolute right-1.5 top-1/2 flex h-11 w-11 -translate-y-1/2 items-center justify-center rounded-xl text-stone-600 hover:bg-stone-100 hover:text-stone-900 focus:outline-none focus:ring-2 focus:ring-[#14532D]"
                  aria-label={showPassword ? 'Hide password' : 'Show password'}
                  aria-pressed={showPassword}
                >
                  {showPassword ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
                </button>
              </div>
            </div>

            <label className="inline-flex min-h-11 cursor-pointer select-none items-center gap-3 py-1 text-sm font-medium text-stone-800">
              <input
                type="checkbox"
                checked={rememberMe}
                onChange={(e) => setRememberMe(e.target.checked)}
                className="h-6 w-6 rounded-lg accent-[#14532D] focus:ring-2 focus:ring-[#14532D]"
              />
              {language === 'tl' ? 'Manatiling naka-sign in sa cellphone na ito' : 'Keep me signed in on this phone'}
            </label>

            {error && <p role="alert" className="rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-800">{error}</p>}
            <Button
              type="submit"
              disabled={isSigningIn}
              className="min-h-[52px] w-full rounded-xl bg-[#14532D] text-[15px] font-bold text-white shadow-lg shadow-emerald-950/20 hover:bg-[#0F3F22] disabled:opacity-60"
            >
              {isSigningIn ? (language === 'tl' ? 'Nag-si-sign in...' : 'Signing in...') : (language === 'tl' ? 'Mag-sign In' : 'Sign In')}
            </Button>
          </form>

          <div className="mt-6 border-t border-stone-200 pt-4 text-center">
            <p className="text-sm text-stone-600">
              {language === 'tl' ? 'Wala pang account?' : "Don't have an account?"}{' '}
              <button type="button" onClick={onSwitchToSignup} className="min-h-10 rounded-lg px-2 font-bold text-[#14532D] hover:underline">
                {language === 'tl' ? 'Gumawa ng Account' : 'Create Account'}
              </button>
            </p>
          </div>
        </div>
      )}
    </AuthShell>
  );
}
