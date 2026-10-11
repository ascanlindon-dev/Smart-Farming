import { apiFetch } from '../lib/apiFetch.mjs';
import { useState, useEffect } from "react";
import { Input } from "./ui/input";
import { Label } from "./ui/label";
import { Button } from "./ui/button";
import { Leaf } from "lucide-react";
import rambutanImage from "figma:asset/a8803903c13af0b87fc355b5d6d1dbf82a50518f.png";

export default function ForgotPassword({ onSwitchToLogin }) {
  const [stage, setStage] = useState("request"); // 'request' | 'reset' | 'done'
  const [email, setEmail] = useState("");
  const [code, setCode] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState("");
  const [info, setInfo] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [resendCooldown, setResendCooldown] = useState(0);
  const [resendingCode, setResendingCode] = useState(false);

  // Cooldown timer effect
  useEffect(() => {
    if (resendCooldown > 0) {
      const timer = setTimeout(() => setResendCooldown(resendCooldown - 1), 1000);
      return () => clearTimeout(timer);
    }
  }, [resendCooldown]);

  const handleRequestCode = async (e) => {
    e.preventDefault();
    if (!email.trim()) return;
    setError("");
    setSubmitting(true);
    try {
      const res = await apiFetch('/api/password_reset/request/', {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: email.trim().toLowerCase() }),
      });
      let result;
      try { result = await res.json(); } catch (e) { result = {}; }
      if (res.ok) {
        setInfo(result.message || "If an account exists for this email, a reset code has been sent.");
        setStage("reset");
        setResendCooldown(30); // 30 second cooldown
      } else {
        setError(result.error || "Failed to send reset code.");
      }
    } catch (err) {
      setError("Unable to connect to server.");
    } finally {
      setSubmitting(false);
    }
  };

  const handleResendCode = async (e) => {
    e.preventDefault();
    if (!email.trim() || resendCooldown > 0) return;
    setError("");
    setResendingCode(true);
    try {
      const res = await apiFetch('/api/otp/request/', {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: email.trim().toLowerCase(), purpose: "reset" }),
      });
      let result;
      try { result = await res.json(); } catch (e) { result = {}; }
      if (res.ok) {
        setInfo("New verification code sent. Check your email.");
        setCode("");
        setResendCooldown(30); // 30 second cooldown
      } else {
        setError(result.error || "Failed to resend code. Please try again.");
      }
    } catch (err) {
      setError("Unable to connect to server.");
    } finally {
      setResendingCode(false);
    }
  };

  const handleConfirmReset = async (e) => {
    e.preventDefault();
    if (!code.trim() || !newPassword) return;
    if (newPassword !== confirmPassword) {
      setError("Passwords do not match.");
      return;
    }
    setError("");
    setSubmitting(true);
    try {
      const res = await apiFetch('/api/password_reset/confirm/', {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: email.trim().toLowerCase(),
          code: code.trim(),
          newPassword,
          confirmPassword,
        }),
      });
      let result;
      try { result = await res.json(); } catch (e) { result = {}; }
      if (res.ok) {
        setStage("done");
      } else {
        setError(result.error || "Failed to reset password.");
      }
    } catch (err) {
      setError("Unable to connect to server.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-linear-to-br from-emerald-50 via-green-50 to-amber-50 flex items-center justify-center p-4 overflow-hidden relative">
      <div className="absolute top-10 right-1/4 w-80 h-80 bg-emerald-300 rounded-full blur-3xl opacity-20 sm:w-96 sm:h-96"></div>
      <div className="absolute bottom-10 left-1/4 w-64 h-64 bg-amber-300 rounded-full blur-3xl opacity-20 sm:w-80 sm:h-80"></div>

      <div className="absolute top-0 right-0 z-0 pointer-events-none overflow-hidden">
        <div className="transform rotate-15 origin-top-right translate-x-8 -translate-y-4">
          <img
            src={rambutanImage}
            alt="Rambutan fruits"
            className="w-50 sm:w-70 md:w-[320px] lg:w-100 xl:w-120 h-auto object-contain drop-shadow-2xl opacity-90"
          />
        </div>
      </div>

      <div className="w-full max-w-md relative z-10">
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-16 h-16 bg-linear-to-r from-emerald-600 via-teal-600 to-green-600 rounded-2xl mb-4 shadow-lg">
            <Leaf className="w-8 h-8 text-white" />
          </div>
          <h1 className="brand-wordmark mb-2 text-emerald-800">RAMBUTECH</h1>
        </div>

        <div className="max-w-md mx-auto">
          {stage === "request" && (
            <>
              <div className="text-center mb-6">
                <h2 className="text-emerald-800 mb-2">Reset your password</h2>
                <p className="text-slate-600">Enter your account email and we'll send you a verification code.</p>
              </div>
              <form onSubmit={handleRequestCode} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="reset-email">Email Address</Label>
                  <Input
                    id="reset-email"
                    type="email"
                    placeholder="Enter your email address"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    autoComplete="email"
                    required
                  />
                </div>
                {error && <p className="text-sm text-red-600">{error}</p>}
                <Button
                  disabled={submitting}
                  className="w-full bg-linear-to-r from-emerald-700 via-teal-600 to-green-600 hover:opacity-90 text-white shadow-md"
                >
                  {submitting ? "Sending..." : "Send Code"}
                </Button>
              </form>
            </>
          )}

          {stage === "reset" && (
            <>
              <div className="text-center mb-6">
                <h2 className="text-emerald-800 mb-2">Enter code & new password</h2>
                <p className="text-slate-600">{info}</p>
              </div>
              <form onSubmit={handleConfirmReset} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="reset-code">Verification Code</Label>
                  <Input
                    id="reset-code"
                    type="text"
                    inputMode="numeric"
                    maxLength={6}
                    placeholder="6-digit code"
                    value={code}
                    onChange={(e) => setCode(e.target.value.replace(/[^0-9]/g, ""))}
                    autoComplete="one-time-code"
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="new-password">New Password</Label>
                  <Input
                    id="new-password"
                    type="password"
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="confirm-password">Confirm New Password</Label>
                  <Input
                    id="confirm-password"
                    type="password"
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    required
                  />
                </div>
                {error && <p className="text-sm text-red-600">{error}</p>}
                <Button
                  disabled={submitting}
                  className="w-full bg-linear-to-r from-emerald-700 via-teal-600 to-green-600 hover:opacity-90 text-white shadow-md"
                >
                  {submitting ? "Updating..." : "Update Password"}
                </Button>
              </form>

              <div className="mt-6 text-center space-y-3">
                <button
                  onClick={handleResendCode}
                  disabled={resendCooldown > 0 || resendingCode}
                  className={`inline-block text-sm font-semibold py-2 px-4 rounded-lg transition ${
                    resendCooldown > 0
                      ? "text-slate-400 cursor-not-allowed"
                      : "text-emerald-700 hover:text-emerald-800 hover:bg-emerald-50"
                  }`}
                >
                  {resendCooldown > 0 ? `Resend Code in ${resendCooldown}s` : "Resend Code"}
                </button>
                <button
                  onClick={onSwitchToLogin}
                  className="block w-full text-sm text-slate-500 hover:text-slate-700"
                >
                  Back to sign in
                </button>
              </div>
            </>
          )}

          {stage === "done" && (
            <div className="text-center space-y-4">
              <h2 className="text-emerald-800 mb-2">Password updated</h2>
              <p className="text-slate-600">You can now log in with your new password.</p>
              <Button
                onClick={onSwitchToLogin}
                className="w-full bg-linear-to-r from-emerald-700 via-teal-600 to-green-600 hover:opacity-90 text-white shadow-md"
              >
                Back to Login
              </Button>
            </div>
          )}

          {stage !== "done" && (
            <div className="mt-6 text-center">
              <button
                onClick={onSwitchToLogin}
                className="text-sm text-slate-500 hover:text-slate-700"
              >
                Back to sign in
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
