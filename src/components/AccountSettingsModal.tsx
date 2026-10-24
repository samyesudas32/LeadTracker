import React, { useState, useEffect } from "react";
import {
  User,
  Lock,
  KeyRound,
  Eye,
  EyeOff,
  ShieldCheck,
  CheckCircle2,
  AlertCircle,
  X,
  Loader2,
  Mail,
  ShieldAlert,
} from "lucide-react";
import { UserAccount } from "../types/rbac";
import { updateSelfCredentials } from "../utils/authService";
import { apiClient } from "../services/apiClient";

interface AccountSettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentUser: UserAccount;
  onUserUpdated: (updatedUser: UserAccount) => void;
}

export const AccountSettingsModal: React.FC<AccountSettingsModalProps> = ({
  isOpen,
  onClose,
  currentUser,
  onUserUpdated,
}) => {
  const [userId, setUserId] = useState(currentUser.username || "");
  const [displayName, setDisplayName] = useState(currentUser.displayName || "");
  const [email, setEmail] = useState(currentUser.email || "");
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");

  const [showCurrentPassword, setShowCurrentPassword] = useState(false);
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  // OTP 2FA State
  const [otpCode, setOtpCode] = useState("");
  const [isOtpSent, setIsOtpSent] = useState(false);
  const [otpSending, setOtpSending] = useState(false);
  const [otpDemoNotice, setOtpDemoNotice] = useState<string | null>(null);

  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  // Sync state when modal opens or user changes
  useEffect(() => {
    if (isOpen) {
      setUserId(currentUser.username || "");
      setDisplayName(currentUser.displayName || "");
      setEmail(currentUser.email || "");
      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");
      setOtpCode("");
      setIsOtpSent(false);
      setOtpDemoNotice(null);
      setErrorMsg(null);
      setSuccessMsg(null);
    }
  }, [isOpen, currentUser]);

  if (!isOpen) return null;

  const isManager = currentUser.role === "manager";

  const handleSendOtp = async () => {
    setErrorMsg(null);
    setOtpSending(true);
    try {
      const res = await apiClient.sendSecurityOtp({
        email: email.trim() || currentUser.email || "security@leadplatform.io",
        purpose: "credential_update",
        targetUserId: currentUser.id,
      });
      if (res.success) {
        setIsOtpSent(true);
        if (res.code) {
          setOtpDemoNotice(`2FA OTP Dispatched! Verification code: ${res.code} (Expires in 10 mins)`);
        }
      } else {
        setErrorMsg("Failed to dispatch 2FA verification code. Please check your recovery email.");
      }
    } catch (err: any) {
      setErrorMsg(err?.message || "Failed to dispatch verification code.");
    } finally {
      setOtpSending(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);
    setSuccessMsg(null);

    const cleanUserId = userId.trim();
    if (!cleanUserId) {
      setErrorMsg("User ID cannot be empty.");
      return;
    }

    if (!currentPassword) {
      setErrorMsg("Please enter your Current Password to verify your identity.");
      return;
    }

    if (newPassword) {
      if (newPassword.length < 4) {
        setErrorMsg("New Password must be at least 4 characters.");
        return;
      }
      if (newPassword !== confirmPassword) {
        setErrorMsg("New Password and Confirm New Password do not match.");
        return;
      }
    }

    // If changing password or User ID and OTP was dispatched, verify OTP code was entered
    if (isOtpSent && (!otpCode || otpCode.trim().length !== 6)) {
      setErrorMsg("Please enter the 6-digit OTP verification code received.");
      return;
    }

    setLoading(true);

    try {
      const result = await updateSelfCredentials({
        currentPassword,
        newUserId: cleanUserId,
        newPassword: newPassword.trim() ? newPassword : undefined,
        displayName: displayName.trim() || undefined,
        recoveryEmail: email.trim() || undefined,
        otpCode: otpCode.trim() || undefined,
      });

      if (result.success && result.user) {
        setSuccessMsg(
          result.message || "Your account credentials have been updated successfully! Active session maintained."
        );
        onUserUpdated(result.user);
        setCurrentPassword("");
        setNewPassword("");
        setConfirmPassword("");
        setOtpCode("");
        setTimeout(() => {
          onClose();
        }, 1600);
      } else {
        setErrorMsg(result.error || "Failed to update credentials. Please check your current password.");
      }
    } catch (err: any) {
      setErrorMsg(err?.message || "An unexpected error occurred while saving your credentials.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-xs p-4 overflow-y-auto animate-in fade-in duration-150">
      <div
        className="bg-white rounded-2xl shadow-2xl max-w-lg w-full border border-slate-200 overflow-hidden animate-in zoom-in-95 duration-150 my-8"
        role="dialog"
        aria-modal="true"
        aria-labelledby="account-modal-title"
      >
        {/* Modal Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 bg-slate-50/70">
          <div className="flex items-center gap-3">
            <div
              className={`p-2.5 rounded-xl ${
                isManager ? "bg-indigo-100 text-indigo-700" : "bg-teal-100 text-teal-700"
              }`}
            >
              <KeyRound className="w-5 h-5" />
            </div>
            <div>
              <h2 id="account-modal-title" className="text-base font-bold text-slate-900">
                {isManager ? "Manager Account & Credentials" : "Staff Account & Credentials"}
              </h2>
              <p className="text-xs text-slate-500">
                Update your login User ID and secure password independently
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-slate-600 rounded-lg hover:bg-slate-200/60 transition-colors cursor-pointer"
            title="Close"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Account Identity Badge */}
        <div className="px-6 pt-5 pb-2">
          <div
            className={`p-3.5 rounded-xl border flex items-center justify-between ${
              isManager
                ? "bg-indigo-50/70 border-indigo-200/80 text-indigo-950"
                : "bg-teal-50/70 border-teal-200/80 text-teal-950"
            }`}
          >
            <div className="flex items-center gap-3 min-w-0">
              <div
                className={`w-10 h-10 rounded-xl flex items-center justify-center font-bold text-sm shrink-0 shadow-2xs ${
                  isManager
                    ? "bg-indigo-600 text-white"
                    : "bg-teal-600 text-white"
                }`}
              >
                {isManager ? "👑" : "👤"}
              </div>
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <span className="font-bold text-sm truncate">
                    {currentUser.displayName || currentUser.username}
                  </span>
                  <span
                    className={`text-[10px] uppercase font-extrabold px-1.5 py-0.5 rounded tracking-wider ${
                      isManager
                        ? "bg-indigo-200/70 text-indigo-900"
                        : "bg-teal-200/70 text-teal-900"
                    }`}
                  >
                    {isManager ? "Manager" : "Staff Specialist"}
                  </span>
                </div>
                <div className="flex items-center gap-2 text-xs text-slate-600 mt-0.5">
                  <span className="font-mono text-slate-500 font-medium">@{currentUser.username}</span>
                  <span>•</span>
                  <span className="inline-flex items-center gap-1 text-emerald-600 font-semibold text-[11px]">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                    Active Session
                  </span>
                </div>
              </div>
            </div>
            <div className="text-right shrink-0">
              <span className="text-[11px] font-semibold text-slate-500">
                {isManager ? "System Admin" : "Staff Access"}
              </span>
            </div>
          </div>
          <p className="text-[11px] text-slate-500 mt-2 px-1">
            {isManager
              ? "As Manager, you can independently modify your admin User ID, password, and OTP recovery email."
              : "As a Staff Specialist, you can independently update your personal User ID and password. Your session remains logged in."}
          </p>
        </div>

        {/* Feedback Alerts */}
        {errorMsg && (
          <div className="mx-6 mt-3 p-3 bg-rose-50 border border-rose-200 text-rose-800 rounded-xl text-xs flex items-start gap-2 animate-in fade-in">
            <AlertCircle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
            <div className="flex-1 font-medium">{errorMsg}</div>
          </div>
        )}

        {successMsg && (
          <div className="mx-6 mt-3 p-3 bg-emerald-50 border border-emerald-200 text-emerald-800 rounded-xl text-xs flex items-start gap-2 animate-in fade-in">
            <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
            <div className="flex-1 font-medium">{successMsg}</div>
          </div>
        )}

        {/* Credentials Form */}
        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          {/* User ID Section */}
          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1">
              User ID / Login Username <span className="text-rose-500">*</span>
            </label>
            <div className="relative">
              <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-400">
                <User className="w-4 h-4" />
              </div>
              <input
                type="text"
                value={userId}
                onChange={(e) => setUserId(e.target.value)}
                placeholder="Enter unique User ID"
                required
                className="w-full pl-9 pr-3.5 py-2 text-sm bg-slate-50 border border-slate-300 rounded-xl focus:bg-white focus:ring-2 focus:ring-indigo-500 font-semibold text-slate-900 transition-colors"
              />
            </div>
            <p className="text-[11px] text-slate-400 mt-1">
              Used when signing in from the login page.
            </p>
          </div>

          {/* Optional Display Name & Email */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">
                Display Name
              </label>
              <input
                type="text"
                value={displayName}
                onChange={(e) => setDisplayName(e.target.value)}
                placeholder="Full Name"
                className="w-full px-3 py-2 text-sm bg-slate-50 border border-slate-300 rounded-xl focus:bg-white focus:ring-2 focus:ring-indigo-500 font-medium text-slate-900 transition-colors"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">
                {isManager ? "OTP Recovery Email" : "Email Address"}
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-400">
                  <Mail className="w-4 h-4" />
                </div>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="user@company.com"
                  className="w-full pl-9 pr-3 py-2 text-sm bg-slate-50 border border-slate-300 rounded-xl focus:bg-white focus:ring-2 focus:ring-indigo-500 font-medium text-slate-900 transition-colors"
                />
              </div>
            </div>
          </div>

          <div className="border-t border-slate-200 pt-3">
            <h3 className="text-xs font-bold uppercase tracking-wider text-slate-500 mb-3 flex items-center gap-1.5">
              <ShieldCheck className="w-3.5 h-3.5 text-indigo-500" />
              <span>Password & Authentication Security</span>
            </h3>

            {/* Current Password Field (Verification) */}
            <div className="mb-3">
              <label className="block text-xs font-bold text-slate-700 mb-1">
                Current Password <span className="text-rose-500">*</span>
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-400">
                  <Lock className="w-4 h-4" />
                </div>
                <input
                  type={showCurrentPassword ? "text" : "password"}
                  value={currentPassword}
                  onChange={(e) => setCurrentPassword(e.target.value)}
                  placeholder="Enter current password to verify identity"
                  required
                  className="w-full pl-9 pr-10 py-2 text-sm bg-slate-50 border border-slate-300 rounded-xl focus:bg-white focus:ring-2 focus:ring-indigo-500 font-medium text-slate-900 transition-colors"
                />
                <button
                  type="button"
                  onClick={() => setShowCurrentPassword(!showCurrentPassword)}
                  className="absolute inset-y-0 right-0 pr-3 flex items-center text-slate-400 hover:text-slate-600 cursor-pointer"
                  title={showCurrentPassword ? "Hide password" : "Show password"}
                >
                  {showCurrentPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
              <p className="text-[11px] text-slate-400 mt-1">
                Required for security verification before changes are saved.
              </p>
            </div>

            {/* New Password & Confirm Password */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  New Password <span className="text-slate-400 font-normal">(optional)</span>
                </label>
                <div className="relative">
                  <input
                    type={showNewPassword ? "text" : "password"}
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    placeholder="Leave blank to keep"
                    className="w-full px-3 pr-9 py-2 text-sm bg-slate-50 border border-slate-300 rounded-xl focus:bg-white focus:ring-2 focus:ring-indigo-500 font-medium text-slate-900 transition-colors"
                  />
                  <button
                    type="button"
                    onClick={() => setShowNewPassword(!showNewPassword)}
                    className="absolute inset-y-0 right-0 pr-2.5 flex items-center text-slate-400 hover:text-slate-600 cursor-pointer"
                  >
                    {showNewPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Confirm New Password
                </label>
                <div className="relative">
                  <input
                    type={showConfirmPassword ? "text" : "password"}
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    placeholder="Re-enter new password"
                    disabled={!newPassword}
                    className="w-full px-3 pr-9 py-2 text-sm bg-slate-50 border border-slate-300 rounded-xl focus:bg-white focus:ring-2 focus:ring-indigo-500 font-medium text-slate-900 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                  />
                  <button
                    type="button"
                    onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                    disabled={!newPassword}
                    className="absolute inset-y-0 right-0 pr-2.5 flex items-center text-slate-400 hover:text-slate-600 cursor-pointer disabled:opacity-50"
                  >
                    {showConfirmPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>
            </div>
          </div>

          {/* 2FA One-Time Password (OTP) Verification Section */}
          <div className="border-t border-slate-200 pt-3.5 pb-1">
            <div className="flex items-center justify-between gap-2 mb-2">
              <div className="flex items-center gap-1.5">
                <ShieldAlert className="w-4 h-4 text-emerald-600" />
                <span className="text-xs font-bold text-slate-800">
                  Two-Factor Authentication (OTP Verification)
                </span>
              </div>
              <button
                type="button"
                onClick={handleSendOtp}
                disabled={otpSending}
                className="inline-flex items-center gap-1 px-2.5 py-1 text-[11px] font-semibold rounded-lg bg-emerald-50 text-emerald-700 hover:bg-emerald-100 border border-emerald-200 transition-colors cursor-pointer disabled:opacity-50"
              >
                {otpSending ? (
                  <>
                    <Loader2 className="w-3 h-3 animate-spin" />
                    <span>Sending...</span>
                  </>
                ) : isOtpSent ? (
                  <span>Resend Code</span>
                ) : (
                  <span>Send 6-Digit Code</span>
                )}
              </button>
            </div>

            <div className="p-3 rounded-xl bg-slate-50 border border-slate-200 space-y-2">
              <p className="text-[11px] text-slate-500 leading-relaxed">
                For security, updating sensitive credentials requires 2FA verification. Click <strong>Send 6-Digit Code</strong> to dispatch an OTP to your recovery email.
              </p>

              {otpDemoNotice && (
                <div className="p-2 rounded-lg bg-emerald-50 border border-emerald-200 text-emerald-900 text-[11px] font-medium flex items-center gap-1.5 animate-in fade-in">
                  <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                  <span>{otpDemoNotice}</span>
                </div>
              )}

              {isOtpSent && (
                <div className="flex items-center gap-2 pt-1">
                  <div className="relative flex-1">
                    <input
                      type="text"
                      maxLength={6}
                      value={otpCode}
                      onChange={(e) => setOtpCode(e.target.value.replace(/\D/g, ""))}
                      placeholder="Enter 6-digit OTP"
                      className="w-full px-3 py-1.5 text-xs font-mono font-bold tracking-widest bg-white border border-slate-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 outline-none text-slate-900"
                    />
                  </div>
                  <span className="text-[11px] text-slate-400 font-medium">Valid for 10 min</span>
                </div>
              )}
            </div>
          </div>

          {/* Action Buttons */}
          <div className="pt-4 border-t border-slate-100 flex items-center justify-end gap-3">
            <button
              type="button"
              onClick={onClose}
              disabled={loading}
              className="px-4 py-2 text-xs sm:text-sm font-semibold text-slate-600 hover:text-slate-800 bg-white hover:bg-slate-100 border border-slate-200 rounded-xl transition-colors cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading}
              className={`inline-flex items-center gap-2 px-5 py-2 text-xs sm:text-sm font-semibold text-white rounded-xl shadow-xs transition-all cursor-pointer ${
                isManager
                  ? "bg-indigo-600 hover:bg-indigo-700"
                  : "bg-teal-600 hover:bg-teal-700"
              } disabled:opacity-50 disabled:cursor-not-allowed`}
            >
              {loading ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>Saving Changes...</span>
                </>
              ) : (
                <>
                  <ShieldCheck className="w-4 h-4" />
                  <span>Save Account Credentials</span>
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
