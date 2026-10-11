import { apiFetch } from '../lib/apiFetch.mjs';
import { useState, useEffect } from "react";
import { useContext } from 'react';
import { LanguageContext } from '../LanguageContext';
import { Input } from "./ui/input";
import { Label } from "./ui/label";
import { Button } from "./ui/button";
import GoogleSignInButton from "./GoogleSignInButton";
import { Leaf, Eye, EyeOff } from "lucide-react";
import rambutanImage from "figma:asset/a8803903c13af0b87fc355b5d6d1dbf82a50518f.png";

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
  const { language: contextLanguage } = useContext(LanguageContext);
  // 🌾 Remember language preference (default Tagalog)
  const [language, setLanguage] = useState(() => {
    const saved = localStorage.getItem("language");
    return saved === "en" || saved === "tl" ? saved : contextLanguage;
  });

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

  const changeLanguage = (lang) => {
    setLanguage(lang);
    localStorage.setItem("language", lang);
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-emerald-50 via-green-50 to-amber-50 flex items-center justify-center p-4 overflow-hidden relative">
      {/* Unified Decorative elements */}
      <div className="absolute top-10 right-1/4 w-80 h-80 bg-emerald-300 rounded-full blur-3xl opacity-20 sm:w-96 sm:h-96"></div>
      <div className="absolute bottom-10 left-1/4 w-64 h-64 bg-amber-300 rounded-full blur-3xl opacity-20 sm:w-80 sm:h-80"></div>
      <div className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 w-[300px] h-[300px] bg-emerald-200 rounded-full blur-3xl opacity-10 sm:w-[600px] sm:h-[600px]"></div>

      {/* Slanted Rambutan Image - Upper Right Corner Design */}
      <div className="absolute top-0 right-0 z-0 pointer-events-none overflow-hidden">
        <div className="transform rotate-[15deg] origin-top-right translate-x-8 -translate-y-4">
          <img
            src={rambutanImage}
            alt="Rambutan fruits"
            className="w-[200px] sm:w-[280px] md:w-[320px] lg:w-[400px] xl:w-[480px] h-auto object-contain drop-shadow-2xl opacity-90"
          />
        </div>
      </div>

      <div className="w-full max-w-md relative z-10">
        {/* Signup Form */}
        <div className="w-full">
          {/* Logo and Title */}
          <div className="text-center mb-8">
            <div className="inline-flex items-center justify-center w-16 h-16 bg-gradient-to-r from-emerald-600 via-teal-600 to-green-600 rounded-2xl mb-4 shadow-lg">
              <Leaf className="w-8 h-8 text-white" />
            </div>
            <h1 className="brand-wordmark mb-2 text-emerald-800">RAMBUTECH</h1>
            <p className="text-slate-600 mb-8">Farm Resilience & Disease Detection</p>
          </div>

          {/* Language Switch */}
          <div className="flex justify-end gap-2 mb-4">
            <button
              onClick={() => changeLanguage("en")}
              className={language === "en" ? "text-emerald-700 font-bold" : "text-slate-400"}
            >
              EN
            </button>
            <button
              onClick={() => changeLanguage("tl")}
              className={language === "tl" ? "text-emerald-700 font-bold" : "text-slate-400"}
            >
              TL
            </button>
          </div>

          <div className="max-w-md mx-auto">
            {stage === "otp" ? (
              <>
                <div className="text-center mb-6">
                  <h2 className="text-emerald-800 mb-2">Check your email</h2>
                  <p className="text-slate-600">{otpInfo || `We sent a verification code to ${otpEmail}.`}</p>
                </div>

                <form onSubmit={handleVerifyOtp} className="space-y-4">
                  <div className="space-y-2">
                    <Label>Verification Code</Label>
                    <Input
                      type="text"
                      inputMode="numeric"
                      maxLength={6}
                      placeholder="6-digit code"
                      value={otpCode}
                      onChange={(e) => setOtpCode(e.target.value.replace(/[^0-9]/g, ""))}
                      autoComplete="one-time-code"
                    />
                  </div>

                  {otpError && <p className="text-sm text-red-600">{otpError}</p>}

                  <Button
                    disabled={verifyingOtp}
                    className="w-full bg-gradient-to-r from-emerald-700 via-teal-600 to-green-600 hover:opacity-90 text-white shadow-md"
                  >
                    {verifyingOtp ? "Verifying..." : "Verify Code"}
                  </Button>
                </form>

                <div className="mt-6 text-center space-y-2">
                  <p className="text-sm text-slate-600">
                    Didn't get a code?{" "}
                    <button
                      onClick={handleResendOtp}
                      disabled={resendCooldown > 0 || resendingOtp}
                      className={`font-semibold transition ${
                        resendCooldown > 0
                          ? "text-slate-400 cursor-not-allowed"
                          : "text-emerald-700 hover:text-emerald-800"
                      }`}
                    >
                      {resendCooldown > 0 ? `Resend in ${resendCooldown}s` : "Resend code"}
                    </button>
                  </p>
                  <button
                    onClick={() => setStage("form")}
                    className="text-sm text-slate-500 hover:text-slate-700"
                  >
                    Back to sign up
                  </button>
                </div>
              </>
            ) : (
              <>
            <div className="text-center mb-6">
              <h2 className="text-emerald-800 mb-2">{t.title}</h2>
              <p className="text-slate-600">{t.subtitle}</p>
            </div>

            {!backendUp && (
              <div className="mb-4 p-3 bg-red-50 border border-red-200 text-red-700 rounded">
                <strong>Service temporarily unavailable.</strong>
                <div className="mt-2 text-sm">We could not connect to the server. Please refresh the page and try again.</div>
              </div>
            )}

            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-2">
                <Label>{t.name}</Label>
                <Input value={name} onChange={(e) => setName(e.target.value)} />
              </div>

              <div className="space-y-2">
                <Label>{t.contact}</Label>
                <Input
                  type="email"
                  placeholder="email@example.com"
                  value={contact}
                  onChange={(e) => setContact(e.target.value)}
                  autoComplete="email"
                />
              </div>

              {/* Password */}
              <div className="space-y-2">
                <Label>{t.password}</Label>
                <div className="relative">
                  <Input
                    type={showPassword ? "text" : "password"}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="pr-16"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-4 top-1/2 -translate-y-1/2 text-emerald-700 p-1"
                    tabIndex={0}
                    aria-label={showPassword ? t.hide : t.show}
                    title={showPassword ? t.hide : t.show}
                    aria-pressed={showPassword}
                  >
                    {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                  </button>
                </div>
              </div>

              {/* Confirm Password */}
              <div className="space-y-2">
                <Label>{t.confirm}</Label>
                <div className="relative">
                  <Input
                    type={showConfirm ? "text" : "password"}
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    className="pr-16"
                  />
                  <button
                    type="button"
                    onClick={() => setShowConfirm(!showConfirm)}
                    className="absolute right-4 top-1/2 -translate-y-1/2 text-emerald-700 p-1"
                    tabIndex={0}
                    aria-label={showConfirm ? t.hide : t.show}
                    title={showConfirm ? t.hide : t.show}
                    aria-pressed={showConfirm}
                  >
                    {showConfirm ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                  </button>
                </div>
              </div>

              {error && <p className="text-sm text-red-600">{error}</p>}

              <Button
                className="w-full bg-gradient-to-r from-emerald-700 via-teal-600 to-green-600 hover:opacity-90 text-white shadow-md"
              >
                {t.button}
              </Button>
              <div className="flex items-center gap-3 text-xs text-slate-500">
                <span className="h-px flex-1 bg-slate-300" />
                <span>or</span>
                <span className="h-px flex-1 bg-slate-300" />
              </div>
              <div className="flex justify-center">
                <GoogleSignInButton onCredential={handleGoogleSignIn} />
              </div>
            </form>

            <div className="mt-6 text-center">
              <p className="text-sm text-slate-600">
                Already have an account?{" "}
                <button
                  onClick={onSwitchToLogin}
                  className="text-emerald-700 hover:text-emerald-800 font-semibold"
                >
                  Log in
                </button>
              </p>
            </div>
              </>
            )}

            {/* Info Text */}
            <p className="text-center text-sm text-slate-500 mt-6">
              Smart farming solutions for rambutan cultivation
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
