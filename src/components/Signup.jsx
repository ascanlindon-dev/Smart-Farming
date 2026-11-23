import { apiFetch } from '../lib/apiFetch.mjs';
import { useState, useEffect } from "react";
import { useContext } from 'react';
import { LanguageContext } from '../LanguageContext';
import { Input } from "./ui/input";
import { Label } from "./ui/label";
import { Button } from "./ui/button";
import GoogleSignInButton from "./GoogleSignInButton";
import { Eye, EyeOff } from "lucide-react";
import AuthShell from "./AuthShell";

const translations = {
  en: {
    title: "Create Account",
    subtitle: "Sign up to start monitoring your farm",
    name: "Full Name",
    contact: "Email Address",
    password: "Password (min. 8 characters)",
    confirm: "Confirm Password",
    show: "Show",
    hide: "Hide",
    button: "Create Account",
    error: "Please fill all fields correctly",
    errorName: "Please enter your full name.",
    errorEmail: "Please enter a valid email address.",
    errorPassword: "Password must be at least 8 characters.",
    errorConfirm: "Passwords do not match.",
    login: "Already have an account? Log in",
  },
  tl: {
    title: "Gumawa ng Account",
    subtitle: "Mag-sign up para masubaybayan ang inyong bukid",
    name: "Buong Pangalan",
    contact: "Email Address",
    password: "Password (hindi bababa sa 8 karakter)",
    confirm: "Kumpirmahin ang Password",
    show: "Ipakita",
    hide: "Itago",
    button: "Gumawa ng Account",
    error: "Pakikumpleto at ayusin ang lahat ng detalye",
    errorName: "Pakilagay ang inyong buong pangalan.",
    errorEmail: "Pakilagay ng wastong email address.",
    errorPassword: "Dapat hindi bababa sa 8 karakter ang password.",
    errorConfirm: "Hindi magkatugma ang password.",
    login: "May account na? Mag-login",
  },
};

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export default function Signup({ onSignup, onSwitchToLogin }) {
  const { language, changeLanguage } = useContext(LanguageContext);

  const t = translations[language];
  const [name, setName] = useState("");
  const [contact, setContact] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [error, setError] = useState("");
  const [backendUp, setBackendUp] = useState(true);

  // OTP verification step (code emailed via Gmail after signup)
  const [stage, setStage] = useState("form"); // 'form' | 'otp'
  const [otpEmail, setOtpEmail] = useState("");
  const [otpCode, setOtpCode] = useState("");
  const [otpError, setOtpError] = useState("");
  const [otpInfo, setOtpInfo] = useState("");
  const [verifyingOtp, setVerifyingOtp] = useState(false);
  const [resendingOtp, setResendingOtp] = useState(false);
  const [resendCooldown, setResendCooldown] = useState(0);

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
    // normalize inputs
    const normalizedContact = contact.trim().toLowerCase();
    const normalizedName = name.trim();
    const normalizedPassword = password;

    if (!normalizedName) {
      setError(t.errorName);
      return;
    }
    if (!EMAIL_REGEX.test(normalizedContact)) {
      setError(t.errorEmail);
      return;
    }
    if (normalizedPassword.length < 8) {
      setError(t.errorPassword);
      return;
    }
    if (normalizedPassword !== confirmPassword) {
      setError(t.errorConfirm);
      return;
    }
    setError("");

    // Send signup data to backend
    const url = '/api/signup/';
    console.debug('Signup request', url, { email: normalizedContact, name: normalizedName });
    try {
      const res = await apiFetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: normalizedContact,
          password: normalizedPassword,
          name: normalizedName,
          confirmPassword: confirmPassword,
          role: "user"
        })
      });
      let result;
      try { result = await res.json(); } catch(e) { result = {}; }
      if (res.ok) {
        // Account created; require the emailed OTP before allowing login.
        setOtpEmail(normalizedContact);
        setOtpCode("");
        setOtpError("");
        setOtpInfo(`We sent a verification code to ${normalizedContact}.`);
        setStage("otp");
      } else {
        setError(result.error || "Signup failed. Please try again.");
      }
    } catch (err) {
      console.error('Signup fetch error', err);
      setError("Unable to connect to server.");
    }
  };

  const handleGoogleSignIn = async (credential) => {
    setError("");
    try {
      const res = await apiFetch('/api/auth/google/', {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ credential }),
      });
      const result = await res.json();
      if (!res.ok) throw new Error(result.error || "Google sign-in failed.");
      onSignup({ role: "farmer", email: result.email, name: result.name, username: result.username });
    } catch (err) {
      setError(err.message || "Google sign-in failed.");
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
        body: JSON.stringify({ email: otpEmail, code: otpCode.trim(), purpose: "signup" }),
      });
      let result;
      try { result = await res.json(); } catch (e) { result = {}; }
      if (res.ok) {
        onSignup({
          role: "farmer",
          email: result.email || otpEmail,
          name: result.name || name,
          username: result.username || otpEmail,
        });
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

  const handleResendOtp = async () => {
    if (resendCooldown > 0) return; // Prevent clicks during cooldown
    setOtpError("");
    setResendingOtp(true);
    const url = '/api/otp/request/';
    try {
      const res = await apiFetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: otpEmail, purpose: "signup" }),
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
            <p className="mt-2 text-sm leading-relaxed text-stone-600">{otpInfo || `We sent a verification code to ${otpEmail}.`}</p>
          </div>
          <form onSubmit={handleVerifyOtp} className="space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="signupOtp" className="text-sm font-bold text-stone-800">Verification Code</Label>
              <Input
                id="signupOtp"
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
            {otpError && <p role="alert" className="text-sm text-red-700">{otpError}</p>}
            <Button type="submit" disabled={verifyingOtp} className="min-h-[52px] w-full rounded-2xl bg-[#14532D] text-base font-bold text-white hover:bg-[#0F3F22]">
              {verifyingOtp ? 'Verifying...' : (language === 'tl' ? 'I-verify ang Code' : 'Verify Code')}
            </Button>
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
            <button type="button" onClick={() => setStage('form')} className="min-h-11 rounded-lg px-3 text-sm font-bold text-stone-600 hover:bg-stone-100">
              {language === 'tl' ? 'Bumalik sa pag-sign up' : 'Back to sign up'}
            </button>
          </div>
        </div>
      ) : (
        <div>
          <div className="mb-6">
            <h1 className="text-2xl font-extrabold tracking-tight text-stone-900 sm:text-3xl" style={{ fontFamily: "'Plus Jakarta Sans', sans-serif" }}>
              {language === 'tl' ? t.title : 'Create Farmer Account'}
            </h1>
            <p className="mt-2 text-[15px] text-stone-600">
              {language === 'tl' ? t.subtitle : 'Start monitoring your rambutan farm today.'}
            </p>
          </div>

          {!backendUp && (
            <div role="alert" className="mb-4 rounded-2xl border border-red-200 bg-red-50 px-3 py-2 text-[13px] text-red-800">
              <strong>Service temporarily unavailable.</strong>
              <span className="ml-1">{language === 'tl' ? 'Hindi makakonekta sa server. I-refresh ang page at subukan muli.' : 'We could not connect to the server. Please refresh the page and try again.'}</span>
            </div>
          )}

          <GoogleSignInButton onCredential={handleGoogleSignIn} />
          <div className="my-5 flex items-center gap-3">
            <span className="h-px flex-1 bg-[#D6D3CD]" />
            <span className="text-xs font-semibold uppercase tracking-wider text-stone-600">{language === 'tl' ? 'o gamitin ang email' : 'or use email'}</span>
            <span className="h-px flex-1 bg-[#D6D3CD]" />
          </div>

          <form onSubmit={handleSubmit} className="space-y-5">
            <div className="space-y-2">
              <Label htmlFor="signupName" className="text-sm font-bold text-stone-800">{t.name}</Label>
              <Input
                id="signupName"
                value={name}
                onChange={(e) => setName(e.target.value)}
                autoComplete="name"
                placeholder={language === 'tl' ? 'hal. Juan Dela Cruz' : 'e.g. Juan Dela Cruz'}
                className="min-h-[50px] rounded-xl border border-[#D6D3CD] bg-white px-4 text-[15px] focus-visible:border-[#14532D] focus-visible:ring-4 focus-visible:ring-emerald-600/20"
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="signupEmail" className="text-sm font-bold text-stone-800">{t.contact}</Label>
              <Input
                id="signupEmail"
                type="email"
                placeholder={language === 'tl' ? 'magsasaka@example.com' : 'farmer@example.com'}
                value={contact}
                onChange={(e) => setContact(e.target.value)}
                autoComplete="email"
                className="min-h-[50px] rounded-xl border border-[#D6D3CD] bg-white px-4 text-[15px] focus-visible:border-[#14532D] focus-visible:ring-4 focus-visible:ring-emerald-600/20"
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="signupPassword" className="text-sm font-bold text-stone-800">{t.password}</Label>
              <div className="relative">
                <Input
                  id="signupPassword"
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  autoComplete="new-password"
                  className="min-h-[50px] rounded-xl border border-[#D6D3CD] bg-white px-4 pr-14 text-[15px] focus-visible:border-[#14532D] focus-visible:ring-4 focus-visible:ring-emerald-600/20"
                  required
                />
                <button type="button" onClick={() => setShowPassword(!showPassword)} className="absolute right-1.5 top-1/2 flex h-11 w-11 -translate-y-1/2 items-center justify-center rounded-xl text-stone-600 hover:bg-stone-100 focus:outline-none focus:ring-2 focus:ring-[#14532D]" aria-label={showPassword ? t.hide : t.show} aria-pressed={showPassword}>
                  {showPassword ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
                </button>
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="signupConfirmPassword" className="text-sm font-bold text-stone-800">{t.confirm}</Label>
              <div className="relative">
                <Input
                  id="signupConfirmPassword"
                  type={showConfirm ? 'text' : 'password'}
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  autoComplete="new-password"
                  className="min-h-[50px] rounded-xl border border-[#D6D3CD] bg-white px-4 pr-14 text-[15px] focus-visible:border-[#14532D] focus-visible:ring-4 focus-visible:ring-emerald-600/20"
                  required
                />
                <button type="button" onClick={() => setShowConfirm(!showConfirm)} className="absolute right-1.5 top-1/2 flex h-11 w-11 -translate-y-1/2 items-center justify-center rounded-xl text-stone-600 hover:bg-stone-100 focus:outline-none focus:ring-2 focus:ring-[#14532D]" aria-label={showConfirm ? t.hide : t.show} aria-pressed={showConfirm}>
                  {showConfirm ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
                </button>
              </div>
            </div>

            {error && <p role="alert" className="rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-800">{error}</p>}
            <Button type="submit" className="min-h-[52px] w-full rounded-xl bg-[#14532D] text-[15px] font-bold text-white shadow-lg shadow-emerald-950/20 hover:bg-[#0F3F22]">
              {t.button}
            </Button>
          </form>

          <div className="mt-6 border-t border-stone-200 pt-4 text-center">
            <p className="text-sm text-stone-600">
              {language === 'tl' ? 'May account ka na ba?' : 'Already have an account?'}{' '}
              <button type="button" onClick={onSwitchToLogin} className="min-h-10 rounded-lg px-2 font-bold text-[#14532D] hover:underline">
                {language === 'tl' ? 'Mag-sign In' : 'Sign In'}
              </button>
            </p>
          </div>
        </div>
      )}
    </AuthShell>
  );
}
