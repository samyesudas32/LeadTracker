import React, { useState, useEffect, useRef } from "react";
import {
  Shield,
  ShieldCheck,
  Lock,
  User,
  Eye,
  EyeOff,
  KeyRound,
  Mail,
  ArrowLeft,
  CheckCircle2,
  AlertCircle,
  RefreshCw,
  Copy,
  Check,
  Send,
  Sparkles,
  Loader2,
} from "lucide-react";
import {
  getAdminCredentials,
  saveAdminCredentials,
  verifyAdminLogin,
  authenticateAdmin,
  setSettingsSessionAuthenticated,
  generateRecoveryOTP,
} from "../utils/authService";
import { apiClient } from "../services/apiClient";
import { sendPasswordReset } from "../services/firebase";

interface SettingsLoginPageProps {
  onLoginSuccess: () => void;
  onNavigateToTracker: () => void;
}

type AuthMode = "login" | "forgot_request" | "forgot_otp" | "forgot_reset" | "success";

export const SettingsLoginPage: React.FC<SettingsLoginPageProps> = ({
  onLoginSuccess,
  onNavigateToTracker,
}) => {
  const [authMode, setAuthMode] = useState<AuthMode>("login");

  // Login form state
  const [userIdInput, setUserIdInput] = useState("");
  const [passwordInput, setPasswordInput] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loginError, setLoginError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Recovery flow state
  const [recoveryEmail, setRecoveryEmail] = useState("");
  const [generatedOtp, setGeneratedOtp] = useState<string | null>(null);
  const [otpExpiry, setOtpExpiry] = useState<number | null>(null);
  const [otpInput, setOtpInput] = useState<string[]>(["", "", "", "", "", ""]);
  const [otpError, setOtpError] = useState<string | null>(null);
  const [resendCooldown, setResendCooldown] = useState(0);
  const [copiedOtp, setCopiedOtp] = useState(false);

  // Reset credentials state
  const [newUserId, setNewUserId] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [resetError, setResetError] = useState<string | null>(null);

  // OTP input refs
  const otpInputRefs = useRef<(HTMLInputElement | null)[]>([]);

  // Initialize recovery email from stored credentials and backend
  useEffect(() => {
    const creds = getAdminCredentials();
    setRecoveryEmail(creds.recoveryEmail || "gatewaylawpartners@gmail.com");

    apiClient
      .getCredentialsInfo()
      .then((info) => {
        if (info && info.recoveryEmail) {
          setRecoveryEmail(info.recoveryEmail);
        }
      })
      .catch(() => {});
  }, []);

  // Countdown timer for OTP resend cooldown
  useEffect(() => {
    if (resendCooldown <= 0) return;
    const timer = setInterval(() => {
      setResendCooldown((prev) => Math.max(0, prev - 1));
    }, 1000);
    return () => clearInterval(timer);
  }, [resendCooldown]);

  // Handle standard login
  const handleLoginSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoginError(null);

    if (!userIdInput.trim()) {
      setLoginError("Please enter your User ID.");
      return;
    }
    if (!passwordInput) {
      setLoginError("Please enter your Password.");
      return;
    }

    setIsSubmitting(true);
    try {
      const authResult = await authenticateAdmin(userIdInput, passwordInput);
      if (authResult.success) {
        onLoginSuccess();
      } else {
        setLoginError(authResult.error || "Invalid User ID or Password. Please try again.");
      }
    } catch (err: any) {
      setLoginError(err?.message || "Authentication failed. Please verify credentials.");
    } finally {
      setIsSubmitting(false);
    }
  };

  // Start forgot password / user id flow: Request OTP
  const handleRequestOtpSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setOtpError(null);

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(recoveryEmail.trim())) {
      setOtpError("Please enter a valid recovery email address.");
      return;
    }

    setIsSubmitting(true);
    try {
      // Trigger official Firebase password reset email to user's registered inbox
      sendPasswordReset(recoveryEmail.trim()).catch(() => {});

      // Dispatch request to back-end API
      const response = await apiClient.requestRecoveryOtp(recoveryEmail.trim());
      if (response.success && response.code) {
        setGeneratedOtp(response.code);
        setOtpExpiry(response.expiresAt || Date.now() + 10 * 60 * 1000);
      } else {
        // Fallback to local OTP generator
        const newOtp = generateRecoveryOTP();
        setGeneratedOtp(newOtp);
        setOtpExpiry(Date.now() + 10 * 60 * 1000);
      }
      setResendCooldown(30);
      setOtpInput(["", "", "", "", "", ""]);
      setAuthMode("forgot_otp");
    } catch {
      // Local fallback on connection issue
      const newOtp = generateRecoveryOTP();
      setGeneratedOtp(newOtp);
      setOtpExpiry(Date.now() + 10 * 60 * 1000);
      setResendCooldown(30);
      setOtpInput(["", "", "", "", "", ""]);
      setAuthMode("forgot_otp");
    } finally {
      setIsSubmitting(false);
    }
  };

  // Handle OTP digit input
  const handleOtpDigitChange = (index: number, value: string) => {
    // Only accept numeric digit
    const cleaned = value.replace(/\D/g, "");
    const updated = [...otpInput];

    if (cleaned.length > 1) {
      // Paste handling
      const digits = cleaned.slice(0, 6).split("");
      for (let i = 0; i < 6; i++) {
        updated[i] = digits[i] || "";
      }
      setOtpInput(updated);
      const nextIdx = Math.min(5, digits.length);
      otpInputRefs.current[nextIdx]?.focus();
      return;
    }

    updated[index] = cleaned;
    setOtpInput(updated);

    if (cleaned && index < 5) {
      otpInputRefs.current[index + 1]?.focus();
    }
  };

  const handleOtpKeyDown = (index: number, e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Backspace" && !otpInput[index] && index > 0) {
      otpInputRefs.current[index - 1]?.focus();
    }
  };

  // Auto-fill OTP convenience button
  const handleAutoFillOtp = () => {
    if (!generatedOtp) return;
    const digits = generatedOtp.split("");
    setOtpInput(digits);
    setCopiedOtp(true);
    setTimeout(() => setCopiedOtp(false), 2000);
    otpInputRefs.current[5]?.focus();
  };

  // Verify OTP submission
  const handleVerifyOtpSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setOtpError(null);

    const enteredOtp = otpInput.join("");
    if (enteredOtp.length !== 6) {
      setOtpError("Please enter all 6 digits of the OTP code.");
      return;
    }

    if (otpExpiry && Date.now() > otpExpiry) {
      setOtpError("The OTP has expired. Please click 'Resend OTP' to request a new code.");
      return;
    }

    setIsSubmitting(true);
    try {
      // Verify with backend
      const res = await apiClient.verifyRecoveryOtp(enteredOtp);
      if (res.success && res.verified) {
        const creds = getAdminCredentials();
        setNewUserId(res.currentUserId || creds.userId);
        setNewPassword("");
        setConfirmPassword("");
        setAuthMode("forgot_reset");
      } else {
        setOtpError(res.error || "Incorrect verification code. Please check and retry.");
      }
    } catch {
      // Fallback check against client state
      if (enteredOtp !== generatedOtp) {
        setOtpError("Incorrect verification code. Please check your email and try again.");
      } else {
        const creds = getAdminCredentials();
        setNewUserId(creds.userId);
        setNewPassword("");
        setConfirmPassword("");
        setAuthMode("forgot_reset");
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  // Save new credentials
  const handleSaveResetSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setResetError(null);

    if (!newUserId.trim()) {
      setResetError("User ID cannot be empty.");
      return;
    }
    if (newPassword.length < 4) {
      setResetError("Password must be at least 4 characters long.");
      return;
    }
    if (newPassword !== confirmPassword) {
      setResetError("Passwords do not match. Please retype carefully.");
      return;
    }

    setIsSubmitting(true);
    try {
      // Save locally and sync with backend
      const ok = await saveAdminCredentials({
        userId: newUserId.trim(),
        password: newPassword,
        recoveryEmail: recoveryEmail.trim(),
      });
      if (ok) {
        setAuthMode("success");
      } else {
        setResetError("Failed to save credentials to server. Please verify connection and retry.");
      }
    } catch (err: any) {
      setResetError(err?.message || "Failed to update credentials. Please retry.");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="max-w-md w-full mx-auto py-10 px-4">
      {/* Return to tracker back button */}
      <div className="mb-6">
        <button
          type="button"
          id="btn-login-back-to-tracker"
          onClick={onNavigateToTracker}
          className="inline-flex items-center gap-1.5 text-xs font-semibold text-slate-500 hover:text-indigo-600 transition-colors cursor-pointer group"
        >
          <ArrowLeft className="w-3.5 h-3.5 group-hover:-translate-x-0.5 transition-transform" />
          <span>Return to Lead Tracker</span>
        </button>
      </div>

      {/* Main Authentication Card */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6 sm:p-8">
        {/* Brand & Security Header */}
        <div className="text-center mb-6">
          <div className="w-12 h-12 bg-indigo-50 border border-indigo-100 rounded-2xl flex items-center justify-center mx-auto mb-3 shadow-2xs">
            <Shield className="w-6 h-6 text-indigo-600" />
          </div>
          <h1 className="text-xl font-bold text-slate-900 tracking-tight">
            Settings Security
          </h1>
          <p className="text-xs text-slate-500 mt-1">
            {authMode === "login" && "Administrative credentials are required to modify settings"}
            {authMode === "forgot_request" && "Recover your User ID or Password via email OTP"}
            {authMode === "forgot_otp" && "Enter the 6-digit verification code sent to your email"}
            {authMode === "forgot_reset" && "Identity confirmed. View or update your login credentials"}
            {authMode === "success" && "Credentials successfully updated"}
          </p>
        </div>

        {/* 1. LOGIN FORM */}
        {authMode === "login" && (
          <form onSubmit={handleLoginSubmit} className="space-y-4">
            {loginError && (
              <div className="p-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 text-xs flex items-start gap-2 animate-in fade-in">
                <AlertCircle className="w-4 h-4 shrink-0 mt-0.5 text-rose-500" />
                <span>{loginError}</span>
              </div>
            )}

            {/* User ID Field */}
            <div>
              <label
                htmlFor="input-login-userid"
                className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5"
              >
                User ID
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-400">
                  <User className="w-4 h-4" />
                </div>
                <input
                  id="input-login-userid"
                  type="text"
                  value={userIdInput}
                  onChange={(e) => setUserIdInput(e.target.value)}
                  placeholder="admin"
                  autoFocus
                  autoComplete="username"
                  className="w-full pl-9 pr-3 py-2.5 text-sm bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100 outline-none transition-all text-slate-900 font-medium"
                />
              </div>
            </div>

            {/* Password Field */}
            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label
                  htmlFor="input-login-password"
                  className="block text-xs font-bold text-slate-700 uppercase tracking-wider"
                >
                  Password
                </label>
                <button
                  type="button"
                  id="btn-goto-forgot"
                  onClick={() => {
                    setLoginError(null);
                    setAuthMode("forgot_request");
                  }}
                  className="text-xs text-indigo-600 hover:text-indigo-800 font-semibold cursor-pointer transition-colors"
                >
                  Forgot ID or Password?
                </button>
              </div>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-400">
                  <Lock className="w-4 h-4" />
                </div>
                <input
                  id="input-login-password"
                  type={showPassword ? "text" : "password"}
                  value={passwordInput}
                  onChange={(e) => setPasswordInput(e.target.value)}
                  placeholder="••••••••"
                  autoComplete="current-password"
                  className="w-full pl-9 pr-10 py-2.5 text-sm bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100 outline-none transition-all text-slate-900 font-medium"
                />
                <button
                  type="button"
                  id="btn-toggle-login-password"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute inset-y-0 right-0 pr-3 flex items-center text-slate-400 hover:text-slate-600 cursor-pointer"
                  title={showPassword ? "Hide password" : "Show password"}
                >
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            {/* Submit Button */}
            <button
              id="btn-submit-login"
              type="submit"
              className="w-full mt-2 inline-flex items-center justify-center gap-2 px-4 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white font-semibold text-sm rounded-xl shadow-xs transition-all cursor-pointer focus:ring-2 focus:ring-indigo-400 focus:ring-offset-2"
            >
              <ShieldCheck className="w-4 h-4" />
              <span>Sign In to Settings</span>
            </button>

            {/* Default credentials helper note */}
            <div className="pt-3 border-t border-slate-100 flex items-center justify-between text-[11px] text-slate-400">
              <span>Default User ID: <strong className="text-slate-600 font-mono">admin</strong></span>
              <span>Default Password: <strong className="text-slate-600 font-mono">Sam@1997</strong></span>
            </div>
          </form>
        )}

        {/* 2. FORGOT CREDENTIALS: REQUEST OTP */}
        {authMode === "forgot_request" && (
          <form onSubmit={handleRequestOtpSubmit} className="space-y-4">
            {otpError && (
              <div className="p-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 text-xs flex items-start gap-2">
                <AlertCircle className="w-4 h-4 shrink-0 mt-0.5 text-rose-500" />
                <span>{otpError}</span>
              </div>
            )}

            <div>
              <label
                htmlFor="input-recovery-email"
                className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5"
              >
                Registered Email Address
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-400">
                  <Mail className="w-4 h-4" />
                </div>
                <input
                  id="input-recovery-email"
                  type="email"
                  value={recoveryEmail}
                  onChange={(e) => setRecoveryEmail(e.target.value)}
                  placeholder="name@company.com"
                  autoFocus
                  required
                  className="w-full pl-9 pr-3 py-2.5 text-sm bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100 outline-none transition-all text-slate-900 font-medium"
                />
              </div>
              <p className="text-[11px] text-slate-500 mt-1.5">
                A 6-digit One-Time Password (OTP) will be dispatched to this address to verify recovery.
              </p>
            </div>

            <div className="flex flex-col gap-2 pt-2">
              <button
                id="btn-send-otp"
                type="submit"
                className="w-full inline-flex items-center justify-center gap-2 px-4 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white font-semibold text-sm rounded-xl shadow-xs transition-all cursor-pointer"
              >
                <Send className="w-4 h-4" />
                <span>Send Verification Code to Email</span>
              </button>

              <button
                type="button"
                id="btn-back-to-login"
                onClick={() => {
                  setOtpError(null);
                  setAuthMode("login");
                }}
                className="w-full py-2 text-xs font-semibold text-slate-600 hover:text-slate-900 transition-colors cursor-pointer"
              >
                Back to Sign In
              </button>
            </div>
          </form>
        )}

        {/* 3. VERIFICATION CODE SENT TO EMAIL */}
        {authMode === "forgot_otp" && (
          <div className="space-y-5 py-2 animate-in fade-in">
            <div className="w-16 h-16 bg-indigo-50 text-indigo-600 rounded-2xl flex items-center justify-center mx-auto border border-indigo-100 shadow-xs">
              <Mail className="w-8 h-8" />
            </div>

            <div className="text-center space-y-3">
              <h3 className="text-lg font-bold text-slate-900">
                Verification Code Sent to Email
              </h3>
              <div className="p-4 rounded-2xl bg-amber-50/90 border border-amber-200 text-amber-950 text-sm leading-relaxed text-left sm:text-center shadow-2xs">
                <p id="verification-message" className="font-medium">
                  We have sent a verification code to{" "}
                  <span className="font-bold text-slate-900 underline decoration-amber-400 decoration-2">
                    {recoveryEmail}
                  </span>
                  . Please check your email inbox and log in.
                </p>
              </div>
            </div>

            <div className="pt-2 flex flex-col gap-2">
              <button
                id="btn-verification-login"
                type="button"
                onClick={() => {
                  setAuthMode("login");
                }}
                className="w-full inline-flex items-center justify-center gap-2 px-4 py-3 bg-indigo-600 hover:bg-indigo-700 text-white font-semibold text-sm rounded-xl shadow-md shadow-indigo-600/20 transition-all cursor-pointer focus:ring-2 focus:ring-indigo-400 focus:ring-offset-2"
              >
                <ShieldCheck className="w-4 h-4" />
                <span>Back to Login</span>
              </button>

              <button
                type="button"
                onClick={() => {
                  setOtpError(null);
                  setAuthMode("forgot_request");
                }}
                className="w-full py-2 text-xs font-semibold text-slate-600 hover:text-slate-900 transition-colors cursor-pointer text-center"
              >
                Change Email or Resend
              </button>
            </div>
          </div>
        )}

        {/* 4. FORGOT CREDENTIALS: RECOVER & RESET */}
        {authMode === "forgot_reset" && (
          <form onSubmit={handleSaveResetSubmit} className="space-y-4">
            <div className="p-3 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-600" />
              <span>Identity verified successfully. You may keep or update your credentials.</span>
            </div>

            {resetError && (
              <div className="p-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 text-xs flex items-start gap-2">
                <AlertCircle className="w-4 h-4 shrink-0 mt-0.5 text-rose-500" />
                <span>{resetError}</span>
              </div>
            )}

            {/* Recover / Update User ID */}
            <div>
              <label
                htmlFor="input-reset-userid"
                className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5"
              >
                User ID (Recovered)
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-400">
                  <User className="w-4 h-4" />
                </div>
                <input
                  id="input-reset-userid"
                  type="text"
                  value={newUserId}
                  onChange={(e) => setNewUserId(e.target.value)}
                  placeholder="admin"
                  required
                  className="w-full pl-9 pr-3 py-2 text-sm bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100 outline-none transition-all text-slate-900 font-semibold"
                />
              </div>
              <p className="text-[11px] text-slate-400 mt-1">
                Your current User ID is shown above. You can keep it as <strong className="text-slate-600 font-mono">admin</strong> or update it.
              </p>
            </div>

            {/* New Password */}
            <div>
              <label
                htmlFor="input-reset-password"
                className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5"
              >
                New Password
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-400">
                  <Lock className="w-4 h-4" />
                </div>
                <input
                  id="input-reset-password"
                  type={showNewPassword ? "text" : "password"}
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  placeholder="e.g. Sam@1997"
                  required
                  className="w-full pl-9 pr-10 py-2 text-sm bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100 outline-none transition-all text-slate-900 font-medium"
                />
                <button
                  type="button"
                  onClick={() => setShowNewPassword(!showNewPassword)}
                  className="absolute inset-y-0 right-0 pr-3 flex items-center text-slate-400 hover:text-slate-600 cursor-pointer"
                >
                  {showNewPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            {/* Confirm New Password */}
            <div>
              <label
                htmlFor="input-reset-confirm"
                className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5"
              >
                Confirm New Password
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-400">
                  <Lock className="w-4 h-4" />
                </div>
                <input
                  id="input-reset-confirm"
                  type={showNewPassword ? "text" : "password"}
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  placeholder="Repeat new password"
                  required
                  className="w-full pl-9 pr-3 py-2 text-sm bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100 outline-none transition-all text-slate-900 font-medium"
                />
              </div>
            </div>

            <button
              id="btn-save-credentials"
              type="submit"
              className="w-full mt-2 inline-flex items-center justify-center gap-2 px-4 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white font-semibold text-sm rounded-xl shadow-xs transition-all cursor-pointer"
            >
              <Check className="w-4 h-4" />
              <span>Save Credentials & Access Settings</span>
            </button>
          </form>
        )}

        {/* 5. SUCCESS CONFIRMATION */}
        {authMode === "success" && (
          <div className="text-center py-4 space-y-4 animate-in fade-in">
            <div className="w-14 h-14 bg-emerald-100 text-emerald-600 rounded-full flex items-center justify-center mx-auto">
              <Check className="w-7 h-7" />
            </div>
            <div>
              <h2 className="text-base font-bold text-slate-900">Recovery Complete!</h2>
              <p className="text-xs text-slate-500 mt-1">
                Your credentials have been securely updated. You now have full access to settings.
              </p>
            </div>
            <button
              id="btn-continue-settings"
              type="button"
              onClick={onLoginSuccess}
              className="w-full inline-flex items-center justify-center gap-2 px-4 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white font-semibold text-sm rounded-xl shadow-xs transition-all cursor-pointer"
            >
              <ShieldCheck className="w-4 h-4" />
              <span>Open Settings Dashboard</span>
            </button>
          </div>
        )}
      </div>
    </div>
  );
};
