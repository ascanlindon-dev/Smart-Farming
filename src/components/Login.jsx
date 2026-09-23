import { apiFetch } from '../lib/apiFetch.mjs';
import { useState, useEffect } from "react";
import { useContext } from 'react';
import { toast } from 'sonner';
import { LanguageContext } from '../LanguageContext';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "./ui/card";
import { Input } from "./ui/input";
import { Label } from "./ui/label";
import { Button } from "./ui/button";
import GoogleSignInButton from "./GoogleSignInButton";
import { Eye, EyeOff, Leaf } from "lucide-react";
import rambutanImage from "figma:asset/a8803903c13af0b87fc355b5d6d1dbf82a50518f.png";

export default function Login({ onLogin, onSwitchToSignup, onSwitchToForgot }) {
  const API_BASE = import.meta.env.VITE_API_BASE || "";
  const [identifier, setIdentifier] = useState(""); // email or mobile
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [rememberMe, setRememberMe] = useState(true);
  const [error, setError] = useState("");
  const [isSigningIn, setIsSigningIn] = useState(false);
  const { language } = useContext(LanguageContext);
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
    apiFetch(API_BASE + '/api/ping', { method: 'GET' })
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
    const requestTimeout = setTimeout(() => controller.abort(), 10000);

    const url = `${API_BASE}/api/login`;
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
    const url = `${API_BASE}/api/otp/verify/`;
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
    const requestTimeout = setTimeout(() => controller.abort(), 10000);
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
    const url = `${API_BASE}/api/otp/request/`;
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
        {/* Login Form */}
        <div className="w-full">
          {/* Logo and Title */}
          <div className="text-center mb-8">
            <div className="inline-flex items-center justify-center w-16 h-16 bg-gradient-to-r from-emerald-600 via-teal-600 to-green-600 rounded-2xl mb-4 shadow-lg">
              <Leaf className="w-8 h-8 text-white" />
            </div>
            <h1 className="brand-wordmark mb-2 text-emerald-800">RAMBUTECH</h1>
            <p className="text-slate-600 mb-8">Farm Resilience & Disease Detection</p>
          </div>

          {/* Login Form - No Card */}
          <div className="max-w-md mx-auto">
            {stage === "otp" ? (
              <>
                <div className="text-center mb-6">
                  <h2 className="text-emerald-800 mb-2">Check your email</h2>
                  <p className="text-slate-600">{otpInfo || `We sent a verification code to ${otpEmail}.`}</p>
                </div>
                <form onSubmit={handleVerifyOtp} className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="otpCode">Verification Code</Label>
                    <Input
                      id="otpCode"
                      type="text"
                      inputMode="numeric"
                      maxLength={6}
                      placeholder="6-digit code"
                      value={otpCode}
                      onChange={(e) => setOtpCode(e.target.value.replace(/[^0-9]/g, ""))}
                      autoComplete="one-time-code"
                      required
                    />
                  </div>

                  <Button
                    type="submit"
                    disabled={verifyingOtp}
                    className="w-full bg-gradient-to-r from-emerald-700 via-teal-600 to-green-600 hover:opacity-90 text-white shadow-md"
                  >
                    {verifyingOtp ? "Verifying..." : "Verify Code"}
                  </Button>
                  {otpError && (
                    <p className="text-red-600 text-sm text-center mt-2">{otpError}</p>
                  )}
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
                    onClick={() => { setStage("credentials"); setError(""); setOtpError(""); }}
                    className="text-sm text-slate-500 hover:text-slate-700"
                  >
                    Back to sign in
                  </button>
                </div>
              </>
            ) : (
              <>
            <div className="text-center mb-6">
              <h2 className="text-emerald-800 mb-2">Welcome Back</h2>
              <p className="text-slate-600">{language === 'tl' ? 'Mag-sign in gamit ang Google o ang iyong email at password.' : 'Choose Google or sign in with your email and password.'}</p>
            </div>
              {!backendUp && (
                <div className="mb-4 p-3 bg-red-50 border border-red-200 text-red-700 rounded">
                  <strong>Backend unreachable:</strong> The API server is not responding.
                  <div className="mt-2 text-sm">Make sure the backend is running: <code>python manage.py runserver 0.0.0.0:8000</code>.</div>
                </div>
              )}
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="identifier">Email Address</Label>
                <Input
                  id="identifier"
                  type="email"
                  placeholder="Enter your email address"
                  value={identifier}
                  onChange={(e) => setIdentifier(e.target.value)}
                  autoComplete="email"
                  required
                />
              </div>

              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <Label htmlFor="password">Password</Label>
                  <button
                    type="button"
                    onClick={onSwitchToForgot}
                    className="text-xs text-emerald-700 hover:text-emerald-800 font-semibold"
                  >
                    Forgot password?
                  </button>
                </div>
                <div className="relative">
                  <Input
                    id="password"
                    type={showPassword ? "text" : "password"}
                    placeholder="••••••••"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    autoComplete="current-password"
                    className="pr-12"
                    required
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword((visible) => !visible)}
                    className="absolute flex items-center justify-center text-slate-500 hover:text-emerald-700"
                    style={{ top: "50%", right: "0.5rem", width: "2rem", height: "2rem", transform: "translateY(-50%)" }}
                    aria-label={showPassword ? "Hide password" : "Show password"}
                    title={showPassword ? "Hide password" : "Show password"}
                  >
                    {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                  </button>
                </div>
              </div>

              <label className="flex items-center gap-2 text-sm text-slate-700 cursor-pointer">
                <input
                  type="checkbox"
                  checked={rememberMe}
                  onChange={(e) => setRememberMe(e.target.checked)}
                  className="h-4 w-4 accent-emerald-700"
                />
                Remember me on this device
              </label>

              <Button
                type="submit"
                disabled={isSigningIn}
                className="w-full bg-gradient-to-r from-emerald-700 via-teal-600 to-green-600 hover:opacity-90 text-white shadow-md"
              >
                {isSigningIn ? "Signing in..." : "Sign In"}
              </Button>
              {error && (
                <p role="alert" className="text-red-600 text-sm text-center mt-2">{error}</p>
              )}

            </form>

            <div className="my-4 flex items-center gap-3 text-sm text-slate-500">
              <span className="h-px flex-1 bg-slate-300" />
              <span>{language === 'tl' ? 'o' : 'or'}</span>
              <span className="h-px flex-1 bg-slate-300" />
            </div>
            <GoogleSignInButton onCredential={handleGoogleSignIn} disabled={isSigningIn} />

            <div className="mt-6 text-center">
              <p className="text-sm text-slate-600">
                Don't have an account?{" "}
                <button
                  onClick={onSwitchToSignup}
                  className="text-emerald-700 hover:text-emerald-800 font-semibold"
                >
                  Sign up
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
