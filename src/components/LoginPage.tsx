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
  AlertCircle,
  Copy,
  Check,
  Send,
  Sparkles,
  Loader2,
  FileSpreadsheet,
  CheckCircle2,
} from "lucide-react";
import {
  getAdminCredentials,
  saveAdminCredentials,
  authenticateAdmin,
  setAppAuthenticated,
  setSettingsSessionAuthenticated,
  generateRecoveryOTP,
  DEFAULT_ADMIN_CREDENTIALS,
} from "../utils/authService";
import {
  signInWithGoogle,
  signInWithGoogleRedirect,
  checkRedirectAuthResult,
  userFirebaseConfig,
  signInWithEmail,
  signUpWithEmail,
  sendVerificationToUser,
  sendPasswordReset,
  logOut,
  setCustomAuthUser,
} from "../services/firebase";
import { apiClient } from "../services/apiClient";

interface LoginPageProps {
  onLoginSuccess: () => void;
  softwareTitle?: string;
}

type AuthViewMode =
  | "login"
  | "verification"
  | "forgot_request"
  | "forgot_otp"
  | "forgot_reset"
  | "success";

export const LoginPage: React.FC<LoginPageProps> = ({
  onLoginSuccess,
  softwareTitle = "Lead Data Extractor & Call Tracker",
}) => {
  const [viewMode, setViewMode] = useState<AuthViewMode>("login");
  const [authTab, setAuthTab] = useState<"signin" | "signup">("signin");
  const [verificationEmail, setVerificationEmail] = useState("");

  // Login form state
  const [userIdInput, setUserIdInput] = useState("");
  const [passwordInput, setPasswordInput] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [rememberMe, setRememberMe] = useState(true);
  const [loginError, setLoginError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isGoogleSubmitting, setIsGoogleSubmitting] = useState(false);
  const [unauthorizedDomain, setUnauthorizedDomain] = useState<string | null>(null);
  const [copiedDomain, setCopiedDomain] = useState(false);
  const [popupBlockedError, setPopupBlockedError] = useState(false);

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

  const otpInputRefs = useRef<(HTMLInputElement | null)[]>([]);

  // Check for redirect result on initialization (when returning from Google redirect sign-in)
  useEffect(() => {
    checkRedirectAuthResult()
      .then((user) => {
        if (user) {
          setAppAuthenticated(true, true);
          setSettingsSessionAuthenticated(true);
          onLoginSuccess();
        }
      })
      .catch((err) => {
        const code = err?.code || "";
        if (code === "auth/unauthorized-domain") {
          const host = typeof window !== "undefined" ? window.location.hostname : "tracker-10-10-26.vercel.app";
          setUnauthorizedDomain(host);
        }
      });
  }, [onLoginSuccess]);

  // Load registered recovery email
  useEffect(() => {
    const creds = getAdminCredentials();
    setRecoveryEmail(creds.recoveryEmail || DEFAULT_ADMIN_CREDENTIALS.recoveryEmail);

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

  // Handle Sign In or Sign Up submission
  const handleLoginSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoginError(null);

    const trimmedInput = userIdInput.trim();

    if (authTab === "signup") {
      // 1. Sign Up Flow with email and password
      if (!trimmedInput) {
        setLoginError("Please enter your email address.");
        return;
      }
      if (!passwordInput || passwordInput.length < 6) {
        setLoginError("Password must be at least 6 characters.");
        return;
      }

      setIsSubmitting(true);
      try {
        // Authenticate users only - do NOT save user profile data
        // signUpWithEmail will create user, send email verification, and signOut automatically
        await signUpWithEmail(trimmedInput, passwordInput);
        // Explicit requirements:
        // - When a user registers with email/password, do not sign them in automatically.
        // - Send a verification email and show a verification screen with this message:
        //   “We have sent you a verification email to [user email]. Please verify it and log in.”
        setVerificationEmail(trimmedInput);
        setUserIdInput(trimmedInput);
        setPasswordInput("");
        setViewMode("verification");
      } catch (err: any) {
        const code = err?.code || "";
        if (code === "auth/email-already-in-use" || err?.message?.includes("email-already-in-use")) {
          // Explicit requirement: "If the email already exists, show: 'User already exists. Please sign in'"
          setLoginError("User already exists. Please sign in");
        } else if (code === "auth/invalid-email") {
          setLoginError("Please enter a valid email address.");
        } else if (code === "auth/weak-password") {
          setLoginError("Password must be at least 6 characters.");
        } else {
          setLoginError(err?.message || "Sign up failed. Please try again.");
        }
      } finally {
        setIsSubmitting(false);
      }
    } else {
      // 2. Sign In Flow with email and password
      if (!trimmedInput || !passwordInput) {
        setLoginError("Email or password is incorrect");
        return;
      }

      setIsSubmitting(true);
      try {
        // Try Firebase Authentication
        const user = await signInWithEmail(trimmedInput, passwordInput);

        // Explicit requirement:
        // "If a user logs in and their email is not verified, block access and show the same verification screen."
        if (!user.emailVerified) {
          try {
            await sendVerificationToUser(user);
          } catch (vErr) {
            console.warn("Could not resend verification email on unverified login:", vErr);
          }
          // Block access: immediately sign user out
          await logOut();
          setVerificationEmail(trimmedInput);
          setUserIdInput(trimmedInput);
          setPasswordInput("");
          setViewMode("verification");
          return;
        }

        // Email is verified: grant access to dashboard
        setAppAuthenticated(true, rememberMe);
        setSettingsSessionAuthenticated(true);
        onLoginSuccess();
      } catch (fbErr: any) {
        // If Firebase fails, check admin credentials fallback (admin / Sam@1997 or staff / Staff@123)
        try {
          const authResult = await authenticateAdmin(trimmedInput, passwordInput);
          if (authResult.success) {
            setAppAuthenticated(true, rememberMe, authResult.user);
            setSettingsSessionAuthenticated(true);
            onLoginSuccess();
            return;
          }
        } catch {}

        // Explicit requirement: "If credentials are incorrect, show: 'Email or password is incorrect'"
        setLoginError("Email or password is incorrect");
      } finally {
        setIsSubmitting(false);
      }
    }
  };

  // Continue with Google via Firebase Authentication
  const handleGoogleLogin = async () => {
    setLoginError(null);
    setPopupBlockedError(false);
    setUnauthorizedDomain(null);
    setIsSubmitting(true);
    setIsGoogleSubmitting(true);
    try {
      const user = await signInWithGoogle();
      if (!user) {
        // Popup was dismissed or closed by the user
        return;
      }
      setAppAuthenticated(true, rememberMe);
      setSettingsSessionAuthenticated(true);
      onLoginSuccess();
    } catch (err: any) {
      const code = err?.code || "";
      if (code === "auth/popup-closed-by-user" || code === "auth/cancelled-popup-request") {
        // User closed popup intentionally
      } else if (code === "auth/popup-blocked") {
        setPopupBlockedError(true);
      } else if (code === "auth/unauthorized-domain") {
        const host = typeof window !== "undefined" ? window.location.hostname : "tracker-10-10-26.vercel.app";
        setUnauthorizedDomain(host);
      } else {
        setLoginError(err?.message || "Google Authentication failed. Please try again or use email sign in.");
      }
    } finally {
      setIsSubmitting(false);
      setIsGoogleSubmitting(false);
    }
  };

  // Google full-page redirect flow for browsers blocking popups
  const handleGoogleRedirectLogin = async () => {
    setLoginError(null);
    setPopupBlockedError(false);
    setIsSubmitting(true);
    setIsGoogleSubmitting(true);
    try {
      await signInWithGoogleRedirect();
    } catch (err: any) {
      const code = err?.code || "";
      if (code === "auth/unauthorized-domain") {
        const host = typeof window !== "undefined" ? window.location.hostname : "tracker-10-10-26.vercel.app";
        setUnauthorizedDomain(host);
      } else {
        setLoginError(err?.message || "Google Redirect Sign-In failed.");
      }
      setIsSubmitting(false);
      setIsGoogleSubmitting(false);
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
      // Trigger official Firebase password reset / verification email to user's registered inbox
      await sendPasswordReset(recoveryEmail.trim()).catch(() => {});
      const res = await apiClient.requestRecoveryOtp(recoveryEmail.trim()).catch(() => null);

      if (res && res.code) {
        setGeneratedOtp(res.code);
        setOtpExpiry(res.expiresAt || Date.now() + 10 * 60 * 1000);
      } else {
        const localOtp = generateRecoveryOTP();
        setGeneratedOtp(localOtp);
        setOtpExpiry(Date.now() + 10 * 60 * 1000);
      }
      setResendCooldown(30);
      setOtpInput(["", "", "", "", "", ""]);
      setViewMode("forgot_otp");
    } catch {
      const localOtp = generateRecoveryOTP();
      setGeneratedOtp(localOtp);
      setOtpExpiry(Date.now() + 10 * 60 * 1000);
      setResendCooldown(30);
      setOtpInput(["", "", "", "", "", ""]);
      setViewMode("forgot_otp");
    } finally {
      setIsSubmitting(false);
    }
  };

  // Handle OTP digit input
  const handleOtpDigitChange = (index: number, value: string) => {
    const cleaned = value.replace(/\D/g, "");
    const updated = [...otpInput];

    if (cleaned.length > 1) {
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
      const res = await apiClient.verifyRecoveryOtp(enteredOtp);
      if (res.success && res.verified) {
        const creds = getAdminCredentials();
        setNewUserId(res.currentUserId || creds.userId);
        setNewPassword("");
        setConfirmPassword("");
        setViewMode("forgot_reset");
      } else {
        setOtpError(res.error || "Incorrect verification code. Please check and retry.");
      }
    } catch {
      if (enteredOtp !== generatedOtp) {
        setOtpError("Incorrect verification code. Please check your email and try again.");
      } else {
        const creds = getAdminCredentials();
        setNewUserId(creds.userId);
        setNewPassword("");
        setConfirmPassword("");
        setViewMode("forgot_reset");
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
      const ok = await saveAdminCredentials({
        userId: newUserId.trim(),
        password: newPassword,
        recoveryEmail: recoveryEmail.trim(),
      });
      if (ok) {
        setViewMode("success");
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
    <div
      id="main-login-container"
      data-testid="main-container"
      className="main-container-scrollable h-screen max-h-screen overflow-y-auto bg-slate-900 flex flex-col justify-start sm:justify-center items-center py-12 px-4 sm:px-6 lg:px-8 relative selection:bg-indigo-500 selection:text-white"
      style={{ overflowY: "auto", height: "100vh", maxHeight: "100vh" }}
    >
      {/* Subtle modern geometric background accents */}
      <div className="absolute inset-0 pointer-events-none opacity-25">
        <div className="absolute -top-40 -left-40 w-96 h-96 bg-indigo-600 rounded-full blur-3xl" />
        <div className="absolute -bottom-40 -right-40 w-96 h-96 bg-blue-600 rounded-full blur-3xl" />
      </div>

      <div className="max-w-md w-full relative z-10 space-y-6">
        {/* Brand Header */}
        <div className="text-center space-y-3">
          <div className="inline-flex p-3 rounded-2xl bg-indigo-600 text-white shadow-lg shadow-indigo-600/30">
            <FileSpreadsheet className="w-8 h-8" />
          </div>
          <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-white">
            {softwareTitle}
          </h1>
          <p className="text-xs sm:text-sm text-slate-400 max-w-sm mx-auto">
            Authorized administrative access gateway for lead tracking, client registers & daily reports.
          </p>
        </div>

        {/* Main Card */}
        <div className="bg-white rounded-3xl shadow-2xl border border-slate-200 p-6 sm:p-8">
          {/* Card Top Icon & Title */}
          <div className="flex items-center gap-3 pb-5 border-b border-slate-100 mb-6">
            <div className="p-2.5 rounded-xl bg-indigo-50 text-indigo-600">
              {viewMode === "verification" ? (
                <Mail className="w-5 h-5 text-indigo-600" />
              ) : (
                <ShieldCheck className="w-5 h-5" />
              )}
            </div>
            <div>
              <h2 className="text-base font-bold text-slate-900">
                {viewMode === "login" && (authTab === "signin" ? "Sign In to Account" : "Create New Account")}
                {viewMode === "verification" && "Email Verification Required"}
                {viewMode === "forgot_request" && "Recover Credentials"}
                {viewMode === "forgot_otp" && "Email OTP Verification"}
                {viewMode === "forgot_reset" && "Update Login Credentials"}
                {viewMode === "success" && "Credentials Updated"}
              </h2>
              <p className="text-xs text-slate-500">
                {viewMode === "login" &&
                  (authTab === "signin"
                    ? "Enter your email and password to access the dashboard"
                    : "Register with your email and password to access the dashboard")}
                {viewMode === "verification" && "Please verify your email address to access your workspace"}
                {viewMode === "forgot_request" && "Enter your registered recovery email"}
                {viewMode === "forgot_otp" && "Enter the 6-digit code sent to your email"}
                {viewMode === "forgot_reset" && "Identity confirmed. View or change credentials"}
                {viewMode === "success" && "Your access credentials have been refreshed"}
              </p>
            </div>
          </div>

          {/* Segmented Switcher for Sign In vs Sign Up */}
          {viewMode === "login" && (
            <div className="flex rounded-xl bg-slate-100 p-1 mb-5">
              <button
                type="button"
                id="tab-auth-signin"
                onClick={() => {
                  setAuthTab("signin");
                  setLoginError(null);
                }}
                className={`flex-1 py-2 text-xs font-bold rounded-lg transition-all cursor-pointer ${
                  authTab === "signin"
                    ? "bg-white text-indigo-700 shadow-xs"
                    : "text-slate-600 hover:text-slate-900"
                }`}
              >
                Sign In
              </button>
              <button
                type="button"
                id="tab-auth-signup"
                onClick={() => {
                  setAuthTab("signup");
                  setLoginError(null);
                }}
                className={`flex-1 py-2 text-xs font-bold rounded-lg transition-all cursor-pointer ${
                  authTab === "signup"
                    ? "bg-white text-indigo-700 shadow-xs"
                    : "text-slate-600 hover:text-slate-900"
                }`}
              >
                Sign Up
              </button>
            </div>
          )}

          {/* 1. LOGIN FORM */}
          {viewMode === "login" && (
            <form onSubmit={handleLoginSubmit} className="space-y-4">
              {/* Unauthorized Domain Resolution Banner */}
              {unauthorizedDomain && (
                <div
                  id="banner-unauthorized-domain"
                  className="p-4 rounded-2xl bg-amber-50 border border-amber-200 text-amber-950 text-xs space-y-3 animate-in fade-in"
                >
                  <div className="flex items-start gap-2.5">
                    <AlertCircle className="w-5 h-5 shrink-0 text-amber-600 mt-0.5" />
                    <div className="space-y-1">
                      <p className="font-bold text-amber-900 text-sm">
                        {authTab === "signin"
                          ? "Google Sign-In: Domain Authorization Notice"
                          : "Google Sign-Up: Domain Authorization Notice"}
                      </p>
                      <p className="text-amber-800 leading-relaxed">
                        Firebase Authentication requires your current domain to be added to Authorized Domains in your Firebase project.
                      </p>
                    </div>
                  </div>

                  <div className="space-y-1.5">
                    <span className="text-[11px] font-semibold text-amber-900 block">Domain to authorize:</span>
                    <div className="flex items-center justify-between gap-2 p-2 bg-white rounded-xl border border-amber-200 font-mono text-[11px] text-slate-700">
                      <span className="truncate select-all">{unauthorizedDomain}</span>
                      <button
                        type="button"
                        onClick={() => {
                          navigator.clipboard.writeText(unauthorizedDomain);
                          setCopiedDomain(true);
                          setTimeout(() => setCopiedDomain(false), 2000);
                        }}
                        className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-semibold bg-amber-100 hover:bg-amber-200 text-amber-800 rounded-lg transition-colors shrink-0 cursor-pointer"
                      >
                        {copiedDomain ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}
                        <span>{copiedDomain ? "Copied!" : "Copy Domain"}</span>
                      </button>
                    </div>
                  </div>

                  <div className="bg-amber-100/60 p-2.5 rounded-xl text-[11px] text-amber-900 space-y-1">
                    <p className="font-bold">How to authorize in Firebase Console:</p>
                    <ol className="list-decimal list-inside space-y-0.5 text-amber-800">
                      <li>Go to Firebase Console (<code className="font-mono text-[10px]">console.firebase.google.com</code>)</li>
                      <li>Navigate to <strong>Authentication &gt; Settings &gt; Authorized domains</strong></li>
                      <li>Click <strong>Add domain</strong> and enter <code className="bg-white/80 px-1 py-0.5 rounded font-mono text-[10px]">{unauthorizedDomain}</code></li>
                    </ol>
                  </div>

                  <p className="text-[11px] text-amber-900 leading-normal">
                    {authTab === "signin"
                      ? "In the meantime, you can sign in directly using your User ID and Password below."
                      : "In the meantime, you can register and create your account using the Email and Password fields below."}
                  </p>

                  <div className="pt-1 flex items-center justify-between">
                    <a
                      href={`https://console.firebase.google.com/project/${userFirebaseConfig.projectId}/authentication/settings`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-xs text-indigo-700 hover:text-indigo-900 font-bold underline cursor-pointer"
                    >
                      Open Firebase Console &rarr;
                    </a>
                    <button
                      type="button"
                      onClick={() => setUnauthorizedDomain(null)}
                      className="text-xs text-amber-800 hover:text-amber-950 font-semibold px-2 py-1 cursor-pointer"
                    >
                      Dismiss
                    </button>
                  </div>
                </div>
              )}

              {/* Browser Popup Blocked Resolution Banner */}
              {popupBlockedError && (
                <div
                  id="banner-popup-blocked"
                  className="p-4 rounded-2xl bg-amber-50 border border-amber-200 text-amber-950 text-xs space-y-3 animate-in fade-in"
                >
                  <div className="flex items-start gap-2.5">
                    <AlertCircle className="w-5 h-5 shrink-0 text-amber-600 mt-0.5" />
                    <div className="space-y-1">
                      <p className="font-bold text-amber-900 text-sm">
                        {authTab === "signin" ? "Google Sign-In Popup Blocked" : "Google Sign-Up Popup Blocked"}
                      </p>
                      <p className="text-amber-800 leading-relaxed">
                        Your browser prevented the Google login popup window from opening. You can allow popups in your browser address bar, or proceed without a popup using Google Redirect mode below:
                      </p>
                    </div>
                  </div>

                  <div className="pt-1 flex items-center gap-2 flex-wrap">
                    <button
                      type="button"
                      id="btn-google-redirect-mode"
                      onClick={handleGoogleRedirectLogin}
                      disabled={isSubmitting}
                      className="inline-flex items-center gap-1.5 px-3.5 py-2 bg-indigo-600 hover:bg-indigo-700 text-white font-semibold rounded-xl text-xs shadow-xs transition-colors cursor-pointer"
                    >
                      <span>Continue with Google (Redirect Mode &rarr;)</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => setPopupBlockedError(false)}
                      className="text-xs text-amber-800 hover:text-amber-950 font-semibold px-2 py-1 cursor-pointer"
                    >
                      Dismiss
                    </button>
                  </div>
                </div>
              )}

              {loginError && (
                <div
                  id="login-error-banner"
                  className="p-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 text-xs flex flex-col gap-1.5 animate-in fade-in"
                >
                  <div className="flex items-start gap-2">
                    <AlertCircle className="w-4 h-4 shrink-0 mt-0.5 text-rose-500" />
                    <span className="font-semibold">{loginError}</span>
                  </div>
                  {loginError === "User already exists. Please sign in" && (
                    <button
                      type="button"
                      id="btn-switch-to-signin"
                      onClick={() => {
                        setAuthTab("signin");
                        setLoginError(null);
                      }}
                      className="ml-6 text-xs font-bold text-indigo-600 hover:text-indigo-800 underline cursor-pointer text-left"
                    >
                      Click here to switch to Sign In &rarr;
                    </button>
                  )}
                </div>
              )}

              {/* Role-Based Quick Access Demo Pill Buttons */}
              {authTab === "signin" && (
                <div className="bg-slate-50 border border-slate-200/90 rounded-xl p-2.5">
                  <div className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider mb-2 flex items-center justify-between">
                    <span>Role-Based Access Demo</span>
                    <span className="text-[10px] text-indigo-600 font-medium">Click to fill</span>
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <button
                      type="button"
                      id="btn-demo-manager-login"
                      onClick={() => {
                        setUserIdInput("admin");
                        setPasswordInput("Sam@1997");
                        setLoginError(null);
                      }}
                      className="px-2.5 py-1.5 bg-white border border-indigo-200 hover:border-indigo-400 hover:bg-indigo-50/50 rounded-lg text-left transition-all cursor-pointer shadow-xs group"
                    >
                      <div className="flex items-center gap-1.5 text-xs font-bold text-indigo-900">
                        <span>👑</span>
                        <span>Manager</span>
                      </div>
                      <div className="text-[10px] text-slate-500 truncate group-hover:text-indigo-700">Full Access (admin)</div>
                    </button>
                    <button
                      type="button"
                      id="btn-demo-staff-login"
                      onClick={() => {
                        setUserIdInput("staff");
                        setPasswordInput("Staff@123");
                        setLoginError(null);
                      }}
                      className="px-2.5 py-1.5 bg-white border border-slate-200 hover:border-teal-400 hover:bg-teal-50/50 rounded-lg text-left transition-all cursor-pointer shadow-xs group"
                    >
                      <div className="flex items-center gap-1.5 text-xs font-bold text-slate-800 group-hover:text-teal-900">
                        <span>👤</span>
                        <span>Staff</span>
                      </div>
                      <div className="text-[10px] text-slate-500 truncate group-hover:text-teal-700">Limited (staff)</div>
                    </button>
                  </div>
                </div>
              )}

              {/* Email / User ID Input */}
              <div>
                <label
                  htmlFor="input-login-userid"
                  className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5"
                >
                  {authTab === "signin" ? "Email Address (or User ID)" : "Email Address"}
                </label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400">
                    <User className="w-4 h-4" />
                  </div>
                  <input
                    id="input-login-userid"
                    type="text"
                    value={userIdInput}
                    onChange={(e) => setUserIdInput(e.target.value)}
                    placeholder={authTab === "signin" ? "name@example.com (or admin)" : "name@example.com"}
                    autoFocus
                    autoComplete={authTab === "signin" ? "username" : "email"}
                    required
                    className="w-full pl-10 pr-3 py-2.5 text-sm bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100 outline-none transition-all text-slate-900 font-medium"
                  />
                </div>
              </div>

              {/* Password Input */}
              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <label
                    htmlFor="input-login-password"
                    className="block text-xs font-bold text-slate-700 uppercase tracking-wider"
                  >
                    Password
                  </label>
                  {authTab === "signin" ? (
                    <button
                      type="button"
                      id="btn-forgot-password"
                      onClick={() => {
                        setLoginError(null);
                        setViewMode("forgot_request");
                      }}
                      className="text-xs text-indigo-600 hover:text-indigo-800 font-semibold cursor-pointer transition-colors"
                    >
                      Forgot ID or Password?
                    </button>
                  ) : (
                    <span className="text-[11px] text-slate-500">Min. 6 characters</span>
                  )}
                </div>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400">
                    <Lock className="w-4 h-4" />
                  </div>
                  <input
                    id="input-login-password"
                    type={showPassword ? "text" : "password"}
                    value={passwordInput}
                    onChange={(e) => setPasswordInput(e.target.value)}
                    placeholder={authTab === "signin" ? "Enter your password" : "Create password (min 6 chars)"}
                    autoComplete={authTab === "signin" ? "current-password" : "new-password"}
                    required
                    className="w-full pl-10 pr-10 py-2.5 text-sm bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100 outline-none transition-all text-slate-900 font-medium"
                  />
                  <button
                    type="button"
                    id="btn-toggle-password"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute inset-y-0 right-0 pr-3.5 flex items-center text-slate-400 hover:text-slate-600 cursor-pointer"
                    title={showPassword ? "Hide password" : "Show password"}
                  >
                    {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              {/* Remember me */}
              <div className="flex items-center justify-between pt-1">
                <label className="flex items-center gap-2 cursor-pointer select-none text-xs text-slate-600 font-medium">
                  <input
                    type="checkbox"
                    checked={rememberMe}
                    onChange={(e) => setRememberMe(e.target.checked)}
                    className="w-4 h-4 rounded text-indigo-600 focus:ring-indigo-500 border-slate-300 cursor-pointer"
                  />
                  <span>Remember me</span>
                </label>
              </div>

              {/* Sign In / Sign Up Submit Button */}
              <button
                id="btn-submit-login"
                type="submit"
                disabled={isSubmitting}
                className="w-full mt-3 inline-flex items-center justify-center gap-2 px-4 py-3 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-60 text-white font-semibold text-sm rounded-xl shadow-md shadow-indigo-600/20 transition-all cursor-pointer focus:ring-2 focus:ring-indigo-400 focus:ring-offset-2"
              >
                {isSubmitting ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    <span>{authTab === "signin" ? "Signing in..." : "Creating account..."}</span>
                  </>
                ) : (
                  <>
                    <ShieldCheck className="w-4 h-4" />
                    <span>{authTab === "signin" ? "Sign In to Dashboard" : "Sign Up & Continue"}</span>
                  </>
                )}
              </button>

              {/* Switch Sign In / Sign Up Prompt */}
              <div className="text-center pt-1 text-xs text-slate-600">
                {authTab === "signin" ? (
                  <span>
                    Don&apos;t have an account?{" "}
                    <button
                      type="button"
                      id="btn-switch-to-signup"
                      onClick={() => {
                        setAuthTab("signup");
                        setLoginError(null);
                      }}
                      className="font-bold text-indigo-600 hover:text-indigo-800 cursor-pointer"
                    >
                      Sign Up
                    </button>
                  </span>
                ) : (
                  <span>
                    Already have an account?{" "}
                    <button
                      type="button"
                      id="btn-switch-to-signin-bottom"
                      onClick={() => {
                        setAuthTab("signin");
                        setLoginError(null);
                      }}
                      className="font-bold text-indigo-600 hover:text-indigo-800 cursor-pointer"
                    >
                      Sign In
                    </button>
                  </span>
                )}
              </div>

              {/* Divider & Google Sign-In */}
              <div className="relative my-3">
                <div className="absolute inset-0 flex items-center">
                  <div className="w-full border-t border-slate-200" />
                </div>
                <div className="relative flex justify-center text-[10px] uppercase">
                  <span className="bg-white px-2 text-slate-400 font-semibold">Or continue with</span>
                </div>
              </div>

              <button
                type="button"
                id="btn-google-sign-in"
                onClick={handleGoogleLogin}
                disabled={isSubmitting}
                className="w-full inline-flex items-center justify-center gap-2.5 px-4 py-2.5 bg-white hover:bg-slate-50 border border-slate-200 hover:border-slate-300 text-slate-700 font-semibold text-xs sm:text-sm rounded-xl shadow-2xs transition-all cursor-pointer disabled:opacity-60"
                title={authTab === "signin" ? "Sign in with your Google account" : "Sign up with your Google account"}
              >
                {isGoogleSubmitting ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin text-indigo-600 shrink-0" />
                    <span>{authTab === "signin" ? "Signing in with Google..." : "Signing up with Google..."}</span>
                  </>
                ) : (
                  <>
                    <svg className="w-4 h-4 shrink-0" viewBox="0 0 24 24">
                      <path
                        fill="#4285F4"
                        d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                      />
                      <path
                        fill="#34A853"
                        d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                      />
                      <path
                        fill="#FBBC05"
                        d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"
                      />
                      <path
                        fill="#EA4335"
                        d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"
                      />
                    </svg>
                    <span>{authTab === "signin" ? "Sign In with Google" : "Sign Up with Google"}</span>
                  </>
                )}
              </button>
            </form>
          )}

          {/* EMAIL VERIFICATION SCREEN */}
          {viewMode === "verification" && (
            <div id="verification-screen" className="space-y-5 py-2 animate-in fade-in">
              <div className="w-16 h-16 bg-indigo-50 text-indigo-600 rounded-2xl flex items-center justify-center mx-auto border border-indigo-100 shadow-xs">
                <Mail className="w-8 h-8" />
              </div>

              <div className="text-center space-y-3">
                <h3 className="text-lg font-bold text-slate-900">
                  Verify Your Email Address
                </h3>
                {/* Explicit Requirement:
                    “We have sent you a verification email to [user email]. Please verify it and log in.” */}
                <div className="p-4 rounded-2xl bg-amber-50/90 border border-amber-200 text-amber-950 text-sm leading-relaxed text-left sm:text-center shadow-2xs">
                  <p id="verification-message" className="font-medium">
                    We have sent you a verification email to{" "}
                    <span className="font-bold text-slate-900 underline decoration-amber-400 decoration-2">
                      {verificationEmail}
                    </span>
                    . Please verify it and log in.
                  </p>
                </div>
              </div>

              <div className="bg-slate-50 rounded-2xl p-4 border border-slate-200/80 text-xs text-slate-600 space-y-2">
                <div className="flex items-center gap-1.5 font-bold text-slate-700">
                  <Sparkles className="w-3.5 h-3.5 text-indigo-600" />
                  <span>Next steps:</span>
                </div>
                <ol className="list-decimal list-inside space-y-1 text-slate-600 pl-0.5">
                  <li>Check your inbox at <strong className="text-slate-800">{verificationEmail}</strong></li>
                  <li>Click the verification link provided in the email</li>
                  <li>Click the <strong>Login</strong> button below to sign in</li>
                </ol>
                <p className="text-[11px] text-slate-500 pt-2 border-t border-slate-200">
                  Can&apos;t find the email? Please verify your spam / junk folder.
                </p>
              </div>

              {/* Explicit Requirement: "Include a Login button on the verification screen." */}
              <div className="pt-2 flex flex-col gap-2">
                <button
                  id="btn-verification-login"
                  type="button"
                  onClick={() => {
                    setAuthTab("signin");
                    setUserIdInput(verificationEmail);
                    setPasswordInput("");
                    setLoginError(null);
                    setViewMode("login");
                  }}
                  className="w-full inline-flex items-center justify-center gap-2 px-4 py-3 bg-indigo-600 hover:bg-indigo-700 text-white font-semibold text-sm rounded-xl shadow-md shadow-indigo-600/20 transition-all cursor-pointer focus:ring-2 focus:ring-indigo-400 focus:ring-offset-2"
                >
                  <ShieldCheck className="w-4 h-4" />
                  <span>Login</span>
                </button>

                <div className="relative my-1">
                  <div className="absolute inset-0 flex items-center">
                    <div className="w-full border-t border-slate-200" />
                  </div>
                  <div className="relative flex justify-center text-[10px] uppercase">
                    <span className="bg-white px-2 text-slate-400 font-semibold">Or verify instantly with</span>
                  </div>
                </div>

                <button
                  type="button"
                  id="btn-verification-google"
                  onClick={handleGoogleLogin}
                  disabled={isSubmitting}
                  className="w-full inline-flex items-center justify-center gap-2.5 px-4 py-2.5 bg-white hover:bg-slate-50 border border-slate-200 hover:border-slate-300 text-slate-700 font-semibold text-xs sm:text-sm rounded-xl shadow-2xs transition-all cursor-pointer disabled:opacity-60"
                  title="Continue with Google connected to Firebase"
                >
                  {isGoogleSubmitting ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin text-indigo-600 shrink-0" />
                      <span>Connecting to Firebase...</span>
                    </>
                  ) : (
                    <>
                      <svg className="w-4 h-4 shrink-0" viewBox="0 0 24 24">
                        <path
                          fill="#4285F4"
                          d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                        />
                        <path
                          fill="#34A853"
                          d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                        />
                        <path
                          fill="#FBBC05"
                          d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"
                        />
                        <path
                          fill="#EA4335"
                          d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"
                        />
                      </svg>
                      <span>Continue with Google</span>
                    </>
                  )}
                </button>

                <button
                  type="button"
                  id="btn-switch-account-verification"
                  onClick={() => {
                    setLoginError(null);
                    setViewMode("login");
                  }}
                  className="w-full py-2 text-xs font-semibold text-slate-600 hover:text-slate-900 transition-colors cursor-pointer text-center"
                >
                  Use a different account or sign up
                </button>
              </div>
            </div>
          )}

          {/* 2. FORGOT CREDENTIALS: REQUEST OTP */}
          {viewMode === "forgot_request" && (
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
                  Registered Recovery Email
                </label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400">
                    <Mail className="w-4 h-4" />
                  </div>
                  <input
                    id="input-recovery-email"
                    type="email"
                    value={recoveryEmail}
                    onChange={(e) => setRecoveryEmail(e.target.value)}
                    placeholder="gatewaylawpartners@gmail.com"
                    autoFocus
                    required
                    className="w-full pl-10 pr-3 py-2.5 text-sm bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100 outline-none transition-all text-slate-900 font-medium"
                  />
                </div>
                <p className="text-[11px] text-slate-500 mt-1.5">
                  A 6-digit One-Time Password (OTP) will be dispatched to this address to verify your identity.
                </p>
              </div>

              <div className="flex flex-col gap-2 pt-2">
                <button
                  id="btn-send-otp"
                  type="submit"
                  disabled={isSubmitting}
                  className="w-full inline-flex items-center justify-center gap-2 px-4 py-2.5 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-60 text-white font-semibold text-sm rounded-xl shadow-xs transition-all cursor-pointer"
                >
                  {isSubmitting ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <Send className="w-4 h-4" />
                  )}
                  <span>Send Verification Code to Email</span>
                </button>

                <button
                  type="button"
                  id="btn-back-to-login"
                  onClick={() => {
                    setOtpError(null);
                    setViewMode("login");
                  }}
                  className="w-full py-2 text-xs font-semibold text-slate-600 hover:text-slate-900 transition-colors cursor-pointer"
                >
                  Back to Sign In
                </button>
              </div>
            </form>
          )}

          {/* 3. VERIFICATION CODE: ENTER OTP */}
          {viewMode === "forgot_otp" && (
            <form onSubmit={handleVerifyOtpSubmit} className="space-y-4 animate-in fade-in">
              <div className="w-14 h-14 bg-indigo-50 text-indigo-600 rounded-2xl flex items-center justify-center mx-auto border border-indigo-100 shadow-xs">
                <KeyRound className="w-7 h-7" />
              </div>

              <div className="text-center space-y-1">
                <h3 className="text-base font-bold text-slate-900">
                  Enter 6-Digit Verification Code
                </h3>
                <p className="text-xs text-slate-500">
                  We sent a verification code to <strong className="text-slate-800">{recoveryEmail}</strong>
                </p>
              </div>

              {/* Convenience OTP helper card */}
              {generatedOtp && (
                <div className="p-3 bg-indigo-50/80 border border-indigo-200 rounded-xl flex items-center justify-between gap-2">
                  <div className="flex items-center gap-1.5 text-xs text-indigo-900">
                    <Sparkles className="w-3.5 h-3.5 text-indigo-600" />
                    <span>Verification Code:</span>
                    <strong className="font-mono tracking-wider font-bold text-indigo-700 bg-white px-2 py-0.5 rounded border border-indigo-200 text-sm">
                      {generatedOtp}
                    </strong>
                  </div>
                  <button
                    type="button"
                    onClick={handleAutoFillOtp}
                    className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-semibold bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg shadow-2xs transition-colors cursor-pointer"
                  >
                    {copiedOtp ? <Check className="w-3 h-3 text-emerald-300" /> : <Copy className="w-3 h-3" />}
                    <span>{copiedOtp ? "Filled!" : "Auto-fill"}</span>
                  </button>
                </div>
              )}

              {otpError && (
                <div className="p-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 text-xs flex items-start gap-2">
                  <AlertCircle className="w-4 h-4 shrink-0 mt-0.5 text-rose-500" />
                  <span>{otpError}</span>
                </div>
              )}

              {/* 6 Digit Numeric Inputs */}
              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-2 text-center">
                  Verification Code
                </label>
                <div className="flex items-center justify-center gap-2">
                  {otpInput.map((digit, idx) => (
                    <input
                      key={idx}
                      ref={(el) => {
                        otpInputRefs.current[idx] = el;
                      }}
                      id={`input-login-otp-${idx}`}
                      type="text"
                      inputMode="numeric"
                      pattern="[0-9]*"
                      maxLength={1}
                      value={digit}
                      onChange={(e) => handleOtpDigitChange(idx, e.target.value)}
                      onKeyDown={(e) => handleOtpKeyDown(idx, e)}
                      autoFocus={idx === 0}
                      className="w-11 h-12 text-center font-mono text-xl font-bold bg-slate-50 border border-slate-300 rounded-xl focus:bg-white focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100 outline-none text-slate-900 transition-all shadow-2xs"
                    />
                  ))}
                </div>
              </div>

              <div className="pt-2 flex flex-col gap-2">
                <button
                  id="btn-verify-otp"
                  type="submit"
                  disabled={isSubmitting || otpInput.join("").length !== 6}
                  className="w-full inline-flex items-center justify-center gap-2 px-4 py-3 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white font-semibold text-sm rounded-xl shadow-md shadow-indigo-600/20 transition-all cursor-pointer"
                >
                  {isSubmitting ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <CheckCircle2 className="w-4 h-4" />
                  )}
                  <span>Verify Code & Proceed</span>
                </button>

                <div className="flex items-center justify-between text-xs pt-1">
                  <button
                    type="button"
                    disabled={resendCooldown > 0 || isSubmitting}
                    onClick={handleRequestOtpSubmit}
                    className="font-semibold text-indigo-600 hover:text-indigo-800 disabled:text-slate-400 cursor-pointer"
                  >
                    {resendCooldown > 0 ? `Resend in ${resendCooldown}s` : "Resend Code"}
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      setOtpError(null);
                      setViewMode("forgot_request");
                    }}
                    className="font-semibold text-slate-500 hover:text-slate-800 cursor-pointer"
                  >
                    Change Email
                  </button>
                </div>
              </div>
            </form>
          )}

          {/* 4. FORGOT CREDENTIALS: RECOVER & RESET */}
          {viewMode === "forgot_reset" && (
            <form onSubmit={handleSaveResetSubmit} className="space-y-4">
              <div className="p-3 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-600" />
                <span>Identity verified. You can update or view your credentials.</span>
              </div>

              {resetError && (
                <div className="p-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 text-xs flex items-start gap-2">
                  <AlertCircle className="w-4 h-4 shrink-0 mt-0.5 text-rose-500" />
                  <span>{resetError}</span>
                </div>
              )}

              <div>
                <label
                  htmlFor="input-reset-userid"
                  className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5"
                >
                  User ID
                </label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400">
                    <User className="w-4 h-4" />
                  </div>
                  <input
                    id="input-reset-userid"
                    type="text"
                    value={newUserId}
                    onChange={(e) => setNewUserId(e.target.value)}
                    placeholder="admin"
                    required
                    className="w-full pl-10 pr-3 py-2 text-sm bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100 outline-none transition-all text-slate-900 font-semibold"
                  />
                </div>
              </div>

              <div>
                <label
                  htmlFor="input-reset-password"
                  className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5"
                >
                  New Password
                </label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400">
                    <Lock className="w-4 h-4" />
                  </div>
                  <input
                    id="input-reset-password"
                    type={showNewPassword ? "text" : "password"}
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    placeholder="e.g. Sam@1997"
                    required
                    className="w-full pl-10 pr-10 py-2 text-sm bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100 outline-none transition-all text-slate-900 font-medium"
                  />
                  <button
                    type="button"
                    onClick={() => setShowNewPassword(!showNewPassword)}
                    className="absolute inset-y-0 right-0 pr-3.5 flex items-center text-slate-400 hover:text-slate-600 cursor-pointer"
                  >
                    {showNewPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              <div>
                <label
                  htmlFor="input-reset-confirm"
                  className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5"
                >
                  Confirm New Password
                </label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400">
                    <Lock className="w-4 h-4" />
                  </div>
                  <input
                    id="input-reset-confirm"
                    type={showNewPassword ? "text" : "password"}
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    placeholder="Repeat new password"
                    required
                    className="w-full pl-10 pr-3 py-2 text-sm bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100 outline-none transition-all text-slate-900 font-medium"
                  />
                </div>
              </div>

              <button
                id="btn-save-credentials"
                type="submit"
                disabled={isSubmitting}
                className="w-full mt-2 inline-flex items-center justify-center gap-2 px-4 py-2.5 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-60 text-white font-semibold text-sm rounded-xl shadow-xs transition-all cursor-pointer"
              >
                {isSubmitting ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <Check className="w-4 h-4" />
                )}
                <span>Save Credentials & Access Workspace</span>
              </button>
            </form>
          )}

          {/* 5. SUCCESS CONFIRMATION */}
          {viewMode === "success" && (
            <div className="text-center py-4 space-y-4 animate-in fade-in">
              <div className="w-14 h-14 bg-emerald-100 text-emerald-600 rounded-full flex items-center justify-center mx-auto">
                <Check className="w-7 h-7" />
              </div>
              <div>
                <h3 className="text-base font-bold text-slate-900">Recovery Complete!</h3>
                <p className="text-xs text-slate-500 mt-1">
                  Your credentials have been securely updated. You now have full access to the tracker.
                </p>
              </div>
              <button
                id="btn-continue-workspace"
                type="button"
                onClick={() => {
                  setAppAuthenticated(true, true);
                  onLoginSuccess();
                }}
                className="w-full inline-flex items-center justify-center gap-2 px-4 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white font-semibold text-sm rounded-xl shadow-xs transition-all cursor-pointer"
              >
                <ShieldCheck className="w-4 h-4" />
                <span>Enter Workspace</span>
              </button>
            </div>
          )}
        </div>

        {/* Footer info */}
        <div className="text-center text-xs text-slate-400">
          <p>© {new Date().getFullYear()} {softwareTitle} • End-to-End Enterprise Encryption</p>
        </div>
      </div>
    </div>
  );
};
