import React, { useState, useEffect } from "react";
import { ShieldAlert, Lock, User, Eye, EyeOff, X, ArrowRight, Loader2, Sparkles } from "lucide-react";
import { apiClient } from "../services/apiClient";
import { getLocalDemoAccounts, getAdminCredentials } from "../utils/authService";

export interface SuperAdminAuthModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

export const SuperAdminAuthModal: React.FC<SuperAdminAuthModalProps> = ({
  isOpen,
  onClose,
  onSuccess,
}) => {
  const [userId, setUserId] = useState("superadmin");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [liveAccounts, setLiveAccounts] = useState(() => getLocalDemoAccounts());

  useEffect(() => {
    if (isOpen) {
      apiClient
        .getPublicDemoAccounts()
        .then((res) => {
          if (res?.accounts) {
            setLiveAccounts(res.accounts);
            if (res.accounts.superAdmin) {
              setUserId(res.accounts.superAdmin.username);
            }
          }
        })
        .catch(() => {
          const local = getLocalDemoAccounts();
          setLiveAccounts(local);
        });
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);

    const cleanId = userId.trim().toLowerCase();
    try {
      const res = await apiClient.superAdminLogin(cleanId, password);
      if (res && res.success && res.authenticated) {
        sessionStorage.setItem("lead_tracker_superadmin_auth", "true");
        setPassword("");
        onSuccess();
        return;
      } else {
        setError(res?.error || "Invalid Super Admin credentials.");
      }
    } catch {
      // Local fallback verification
      const local = getLocalDemoAccounts();
      const adminCreds = getAdminCredentials();
      const isSuperMatch =
        (cleanId === local.superAdmin.username.toLowerCase() && password === local.superAdmin.password) ||
        (cleanId === "superadmin" && password === "SuperAdmin@2026");
      const isAdminMatch =
        (cleanId === adminCreds.userId.toLowerCase() && password === adminCreds.password) ||
        (cleanId === "admin" && password === "Sam@1997");

      if (isSuperMatch || isAdminMatch) {
        sessionStorage.setItem("lead_tracker_superadmin_auth", "true");
        setPassword("");
        onSuccess();
        return;
      } else {
        setError("Invalid Super Admin credentials. Please check your User ID and Password.");
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div
      id="superadmin-auth-modal-backdrop"
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/75 backdrop-blur-xs animate-in fade-in duration-200"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="superadmin-modal-title"
        className="w-full max-w-md bg-white rounded-2xl shadow-2xl border border-slate-200 overflow-hidden text-slate-900 animate-in zoom-in-95 duration-200"
      >
        {/* Header with Dark High-Security Branding */}
        <div className="bg-[#0F172A] px-6 py-5 text-white flex items-start justify-between relative">
          <div className="flex items-center gap-3">
            <div className="w-11 h-11 rounded-xl bg-indigo-600/30 border border-indigo-400/40 flex items-center justify-center text-indigo-400 shrink-0 shadow-inner">
              <ShieldAlert className="w-6 h-6 text-indigo-400" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-[10px] font-extrabold uppercase tracking-widest px-2 py-0.5 rounded bg-indigo-500/20 text-indigo-300 border border-indigo-500/30">
                  Restricted Area
                </span>
              </div>
              <h3 id="superadmin-modal-title" className="text-base font-bold text-white mt-1">
                Super Admin Authentication
              </h3>
              <p className="text-xs text-slate-400 mt-0.5">
                Elevated administrator credentials required
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="text-slate-400 hover:text-white p-1 rounded-lg hover:bg-slate-800 transition-colors cursor-pointer"
            aria-label="Close dialog"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Form Body */}
        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          <p className="text-xs text-slate-600 leading-relaxed">
            Please authenticate with your Super Admin account to access tenant management, global lead registers, and billing operations.
          </p>

          {error && (
            <div className="p-3 bg-red-50 border border-red-200 rounded-xl text-xs text-red-700 flex items-start gap-2">
              <ShieldAlert className="w-4 h-4 text-red-600 shrink-0 mt-0.5" />
              <span>{error}</span>
            </div>
          )}

          {/* User ID Field */}
          <div>
            <label className="block text-xs font-bold uppercase tracking-wider text-slate-700 mb-1.5">
              Super Admin User ID
            </label>
            <div className="relative">
              <User className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
              <input
                id="superadmin-auth-userid"
                type="text"
                required
                autoFocus
                value={userId}
                onChange={(e) => setUserId(e.target.value)}
                placeholder="e.g. admin"
                className="w-full pl-9 pr-3 py-2 text-sm bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none transition-all font-medium text-slate-900"
              />
            </div>
          </div>

          {/* Password Field */}
          <div>
            <label className="block text-xs font-bold uppercase tracking-wider text-slate-700 mb-1.5">
              Password
            </label>
            <div className="relative">
              <Lock className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
              <input
                id="superadmin-auth-password"
                type={showPassword ? "text" : "password"}
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Enter Super Admin password"
                className="w-full pl-9 pr-10 py-2 text-sm bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none transition-all font-medium text-slate-900"
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 cursor-pointer p-0.5"
                aria-label={showPassword ? "Hide password" : "Show password"}
              >
                {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
            <div className="mt-2 p-2.5 rounded-xl bg-slate-50 border border-slate-200 text-xs text-slate-600 flex items-center justify-between">
              <div>
                <span className="text-[11px] font-bold text-slate-700 block">Active Super Admin:</span>
                <span className="font-mono text-[11px] text-slate-900 font-semibold select-all">
                  {liveAccounts.superAdmin.username} / {liveAccounts.superAdmin.password}
                </span>
              </div>
              <button
                type="button"
                onClick={() => {
                  setUserId(liveAccounts.superAdmin.username);
                  setPassword(liveAccounts.superAdmin.password);
                  setError(null);
                }}
                className="px-2.5 py-1 text-[11px] font-bold text-indigo-700 bg-indigo-50 hover:bg-indigo-100 rounded-lg border border-indigo-200 transition-colors cursor-pointer"
              >
                Autofill
              </button>
            </div>
          </div>

          {/* Action Buttons */}
          <div className="pt-2 flex items-center justify-end gap-2.5">
            <button
              type="button"
              id="btn-cancel-superadmin-auth"
              onClick={onClose}
              className="px-4 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-100 rounded-xl transition-colors cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="submit"
              id="btn-submit-superadmin-auth"
              disabled={loading || !userId.trim() || !password}
              className="inline-flex items-center gap-2 px-4 py-2 text-xs font-bold text-white bg-indigo-600 hover:bg-indigo-700 active:bg-indigo-800 disabled:opacity-50 disabled:pointer-events-none rounded-xl shadow-xs transition-colors cursor-pointer"
            >
              {loading ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>Verifying...</span>
                </>
              ) : (
                <>
                  <span>Unlock Console</span>
                  <ArrowRight className="w-4 h-4" />
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
