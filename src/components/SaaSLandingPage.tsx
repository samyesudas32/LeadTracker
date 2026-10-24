import React, { useState, useEffect } from "react";
import {
  ShieldCheck,
  ShieldAlert,
  Check,
  FileSpreadsheet,
  Download,
  Users,
  Database,
  ArrowRight,
  Sparkles,
  PhoneCall,
  Clock,
  Layers,
  CheckCircle2,
  Lock,
  ChevronRight,
  Building2,
  Calendar,
  AlertCircle,
  TrendingUp,
  CreditCard,
  User,
  ExternalLink,
  Eye,
  EyeOff,
  X,
} from "lucide-react";
import { StripeCheckoutModal } from "./StripeCheckoutModal";
import { authenticateAdmin, setAppAuthenticated, getLocalDemoAccounts } from "../utils/authService";
import { PricingSettings, DEFAULT_PRICING_SETTINGS } from "../types";
import { subscribeToFirestorePricing } from "../services/firebase";
import { apiClient } from "../services/apiClient";

interface SaaSLandingPageProps {
  onLaunchApp: () => void;
  onOpenSuperAdmin: () => void;
  pricingSettings?: PricingSettings;
}

export const SaaSLandingPage: React.FC<SaaSLandingPageProps> = ({
  onLaunchApp,
  onOpenSuperAdmin,
  pricingSettings,
}) => {
  const [billingCycle, setBillingCycle] = useState<"monthly" | "yearly">("monthly");
  const [pricing, setPricing] = useState<PricingSettings>(pricingSettings || DEFAULT_PRICING_SETTINGS);
  const [isStripeOpen, setIsStripeOpen] = useState(false);
  const [selectedPlanTier, setSelectedPlanTier] = useState<"standard" | "enterprise">("standard");
  const [activeFaq, setActiveFaq] = useState<number | null>(null);

  useEffect(() => {
    if (pricingSettings) {
      setPricing(pricingSettings);
    }
  }, [pricingSettings]);

  useEffect(() => {
    // 1. Initial API fetch
    apiClient
      .getPricingSettings()
      .then((res) => {
        if (res?.pricing) {
          setPricing(res.pricing);
        }
      })
      .catch(() => {
        // Fallback to defaults
      });

    // 2. Real-time Firestore sync
    const unsub = subscribeToFirestorePricing((remotePricing) => {
      if (remotePricing && remotePricing.tiers && remotePricing.tiers.length > 0) {
        setPricing(remotePricing);
      }
    });

    return () => unsub();
  }, []);

  // Dynamic Demo Accounts & Customer Login Modal State
  const [demoAccounts, setDemoAccounts] = useState(() => getLocalDemoAccounts());
  const [isCustomerLoginOpen, setIsCustomerLoginOpen] = useState(false);
  const [customerUserId, setCustomerUserId] = useState(() => getLocalDemoAccounts().customer.username);
  const [customerPassword, setCustomerPassword] = useState(() => getLocalDemoAccounts().customer.password);
  const [showCustomerPassword, setShowCustomerPassword] = useState(false);
  const [customerLoginError, setCustomerLoginError] = useState<string | null>(null);
  const [isLoggingInCustomer, setIsLoggingInCustomer] = useState(false);

  // Refresh live demo accounts from server
  const refreshDemoAccounts = async () => {
    try {
      const res = await apiClient.getPublicDemoAccounts();
      if (res && res.success && res.accounts) {
        setDemoAccounts(res.accounts);
        return res.accounts;
      }
    } catch {
      // fallback to local
    }
    const local = getLocalDemoAccounts();
    setDemoAccounts(local);
    return local;
  };

  useEffect(() => {
    refreshDemoAccounts();
  }, []);

  const handleOpenCustomerLogin = async (presetRole: "customer" | "manager" | "staff" = "customer") => {
    setCustomerLoginError(null);
    const accounts = await refreshDemoAccounts();
    const target = accounts ? accounts[presetRole] : getLocalDemoAccounts()[presetRole];
    if (target) {
      setCustomerUserId(target.username);
      setCustomerPassword(target.password);
    }
    setIsCustomerLoginOpen(true);
  };

  const toggleFaq = (idx: number) => {
    setActiveFaq(activeFaq === idx ? null : idx);
  };

  const handleOpenCheckout = (tier: "standard" | "enterprise") => {
    setSelectedPlanTier(tier);
    setIsStripeOpen(true);
  };

  const handleOpenSuperAdminNewTab = () => {
    const targetUrl = window.location.origin + window.location.pathname + "?portal=super_admin";
    window.open(targetUrl, "_blank");
  };

  const handleCustomerLoginSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoggingInCustomer(true);
    setCustomerLoginError(null);

    try {
      const res = await authenticateAdmin(customerUserId, customerPassword);
      if (res.success) {
        setAppAuthenticated(true, true, res.user);
        setIsCustomerLoginOpen(false);
        onLaunchApp();
      } else {
        setCustomerLoginError(res.error || "Invalid User ID or Password.");
      }
    } catch (err: any) {
      setCustomerLoginError(err?.message || "Authentication failed. Please verify credentials.");
    } finally {
      setIsLoggingInCustomer(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#F8FAFC] text-slate-900 font-['Plus_Jakarta_Sans',sans-serif] selection:bg-emerald-100 selection:text-emerald-950">
      {/* 1. Top Navigation Bar (Contract-Compliant 3-Zone Header) */}
      <header className="sticky top-0 z-40 bg-white/95 backdrop-blur-md border-b border-slate-200">
        <div className="max-w-7xl mx-auto px-6 h-16 flex items-center justify-between gap-8">
          {/* Zone 1: Single text wordmark */}
          <a href="#" className="text-lg font-extrabold tracking-tight text-[#0F172A] whitespace-nowrap shrink-0 flex items-center gap-2">
            <span className="w-8 h-8 rounded-xl bg-[#0F172A] text-emerald-400 flex items-center justify-center font-bold text-sm">
              L
            </span>
            <span>LeadFlow SaaS</span>
          </a>

          {/* Zone 2: Single-line navigation links */}
          <nav className="hidden md:flex items-center gap-8 text-xs font-semibold text-slate-600">
            <a href="#problem-solution" className="hover:text-slate-900 transition-colors whitespace-nowrap shrink-0">
              Architecture
            </a>
            <a href="#features" className="hover:text-slate-900 transition-colors whitespace-nowrap shrink-0">
              Capabilities
            </a>
            <a href="#pricing" className="hover:text-slate-900 transition-colors whitespace-nowrap shrink-0">
              Pricing Plans
            </a>
            <a href="#faq" className="hover:text-slate-900 transition-colors whitespace-nowrap shrink-0">
              Security & FAQ
            </a>
          </nav>

          {/* Zone 3: Primary action + Portal Switches */}
          <div className="flex items-center gap-2.5 shrink-0">
            <button
              id="btn-nav-superadmin"
              type="button"
              onClick={handleOpenSuperAdminNewTab}
              className="hidden sm:inline-flex px-3 py-1.5 text-xs font-semibold text-emerald-700 hover:text-emerald-900 bg-emerald-50 hover:bg-emerald-100 border border-emerald-200 rounded-lg transition-colors cursor-pointer items-center gap-1"
              title="Open Super Admin Console in a new tab"
            >
              <ShieldAlert className="w-3.5 h-3.5 text-emerald-600" />
              <span>Super Admin</span>
              <ExternalLink className="w-3 h-3 ml-0.5 opacity-60" />
            </button>

            <button
              id="btn-nav-customer-login"
              type="button"
              onClick={() => handleOpenCustomerLogin("customer")}
              className="px-3.5 py-1.5 text-xs font-bold text-slate-700 hover:text-slate-900 bg-slate-100 hover:bg-slate-200 rounded-lg transition-colors cursor-pointer flex items-center gap-1.5"
            >
              <User className="w-3.5 h-3.5 text-slate-500" />
              <span>Customer Login</span>
            </button>

            <button
              type="button"
              onClick={onLaunchApp}
              className="px-4 py-2 text-xs font-bold text-white bg-[#059669] hover:bg-[#047857] rounded-xl shadow-xs transition-colors whitespace-nowrap shrink-0 cursor-pointer flex items-center gap-1.5"
            >
              <span>Launch Workspace</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      </header>

      {/* 2. Hero Section */}
      <section className="bg-[#0F172A] text-white pt-16 pb-20 px-6 relative overflow-hidden">
        {/* Subtle grid pattern background */}
        <div className="absolute inset-0 opacity-[0.03] pointer-events-none bg-[radial-gradient(#ffffff_1px,transparent_1px)] [background-size:16px_16px]" />

        <div className="max-w-5xl mx-auto text-center space-y-6 relative z-10">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 text-xs font-semibold">
            <ShieldCheck className="w-4 h-4" />
            <span>PostgreSQL Row-Level Security · Pooled Multi-Tenant SaaS</span>
          </div>

          <h1 className="text-3xl sm:text-5xl lg:text-6xl font-extrabold tracking-tight text-white leading-tight" style={{ textWrap: "balance" }}>
            Automated Lead Extraction & Call Governance for Sales Teams
          </h1>

          <p className="text-base sm:text-lg text-slate-300 max-w-3xl mx-auto leading-relaxed">
            Eliminate cross-session handler data pollution, timezone record drift, and batch PDF memory limits. Ingest raw spreadsheets into tenant-isolated pipelines with automated 60-day trial governance and Stripe auto-renewals.
          </p>

          <div className="flex flex-col sm:flex-row items-center justify-center gap-3 pt-3">
            <button
              type="button"
              onClick={() => handleOpenCustomerLogin("customer")}
              className="w-full sm:w-auto px-6 py-3 text-sm font-bold text-white bg-[#059669] hover:bg-[#047857] rounded-xl shadow-lg transition-all cursor-pointer flex items-center justify-center gap-2"
            >
              <User className="w-4 h-4" />
              <span>Customer / Client Sign-In</span>
            </button>
            <button
              type="button"
              onClick={handleOpenSuperAdminNewTab}
              className="w-full sm:w-auto px-5 py-3 text-sm font-semibold text-emerald-300 bg-emerald-950/60 hover:bg-emerald-900/60 border border-emerald-700/60 rounded-xl transition-all cursor-pointer flex items-center justify-center gap-2"
            >
              <ShieldAlert className="w-4 h-4" />
              <span>Super Admin Console ↗</span>
            </button>
            <button
              type="button"
              onClick={() => handleOpenCheckout("standard")}
              className="w-full sm:w-auto px-5 py-3 text-sm font-semibold text-slate-200 bg-slate-800/80 hover:bg-slate-700/80 border border-slate-700 rounded-xl transition-all cursor-pointer"
            >
              Simulate Stripe Renewal
            </button>
          </div>

          <div className="pt-8 flex flex-wrap items-center justify-center gap-6 text-xs text-slate-400">
            <div className="flex items-center gap-1.5">
              <Check className="w-4 h-4 text-emerald-400" />
              <span>Instant Row-Level Security</span>
            </div>
            <div className="flex items-center gap-1.5">
              <Check className="w-4 h-4 text-emerald-400" />
              <span>Chunked Buffered PDF Stream</span>
            </div>
            <div className="flex items-center gap-1.5">
              <Check className="w-4 h-4 text-emerald-400" />
              <span>2FA OTP Credentials</span>
            </div>
            <div className="flex items-center gap-1.5">
              <Check className="w-4 h-4 text-emerald-400" />
              <span>Automated 60-Day Trial Expiry</span>
            </div>
          </div>
        </div>
      </section>

      {/* 3. Problem - Solution Narrative */}
      <section id="problem-solution" className="py-20 px-6 max-w-7xl mx-auto">
        <div className="text-center space-y-3 mb-14">
          <span className="text-xs font-bold uppercase tracking-wider text-emerald-600">Architectural Evolution</span>
          <h2 className="text-2xl sm:text-4xl font-extrabold text-slate-900 tracking-tight">
            Built to Eliminate 4 Critical Failure Modes in Sales Ingestion
          </h2>
          <p className="text-sm text-slate-600 max-w-2xl mx-auto">
            Single-tenant spreadsheets fail when scaling across distributed teams. Here is how our architecture resolves each bottleneck:
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
          <div className="p-6 rounded-2xl bg-white border border-slate-200 shadow-sm space-y-3">
            <div className="w-10 h-10 rounded-xl bg-red-50 text-red-600 flex items-center justify-center font-bold text-sm">
              01
            </div>
            <h3 className="text-base font-bold text-slate-900">Handler State Persistence Bug</h3>
            <p className="text-xs text-slate-600 leading-relaxed">
              <strong>The Problem:</strong> When unassigning leads, stale handler names persisted in client cache and re-appeared upon browser reload.
            </p>
            <p className="text-xs text-emerald-700 font-semibold pt-1 border-t border-slate-100">
              <strong>The Solution:</strong> Strict database sanitization enforcing empty string handler names and explicit unassigned badges, completely clearing residual cache.
            </p>
          </div>

          <div className="p-6 rounded-2xl bg-white border border-slate-200 shadow-sm space-y-3">
            <div className="w-10 h-10 rounded-xl bg-red-50 text-red-600 flex items-center justify-center font-bold text-sm">
              02
            </div>
            <h3 className="text-base font-bold text-slate-900">Date & Timezone Shift Drift</h3>
            <p className="text-xs text-slate-600 leading-relaxed">
              <strong>The Problem:</strong> UTC midnight conversions caused date pickers to shift records backward by 1 full day for users in US timezones.
            </p>
            <p className="text-xs text-emerald-700 font-semibold pt-1 border-t border-slate-100">
              <strong>The Solution:</strong> Canonical local ISO parsing (<code className="text-[11px] font-mono">YYYY-MM-DD</code>) derived from exact UTC records without intermediate midnight shifts.
            </p>
          </div>

          <div className="p-6 rounded-2xl bg-white border border-slate-200 shadow-sm space-y-3">
            <div className="w-10 h-10 rounded-xl bg-red-50 text-red-600 flex items-center justify-center font-bold text-sm">
              03
            </div>
            <h3 className="text-base font-bold text-slate-900">Batch PDF Server Memory Freezes (OOM)</h3>
            <p className="text-xs text-slate-600 leading-relaxed">
              <strong>The Problem:</strong> Rendering 5,000+ client rows into a single unbuffered PDF exhausted server RAM, causing container termination.
            </p>
            <p className="text-xs text-emerald-700 font-semibold pt-1 border-t border-slate-100">
              <strong>The Solution:</strong> Asynchronous chunked table stream buffering with strict handler scoping (<code className="text-[11px] font-mono">handler_id IS NOT NULL</code>), excluding all unassigned records.
            </p>
          </div>

          <div className="p-6 rounded-2xl bg-white border border-slate-200 shadow-sm space-y-3">
            <div className="w-10 h-10 rounded-xl bg-red-50 text-red-600 flex items-center justify-center font-bold text-sm">
              04
            </div>
            <h3 className="text-base font-bold text-slate-900">Single-Tenant Security & Tenant Drift</h3>
            <p className="text-xs text-slate-600 leading-relaxed">
              <strong>The Problem:</strong> Shared databases risked cross-client leakage, manual trial tracking, and unauthorized role elevation.
            </p>
            <p className="text-xs text-emerald-700 font-semibold pt-1 border-t border-slate-100">
              <strong>The Solution:</strong> PostgreSQL Row-Level Security (RLS) with <code className="text-[11px] font-mono">tenant_id</code> policies, 2FA OTP security, and automated 60-day expiry to View-Only mode.
            </p>
          </div>
        </div>
      </section>

      {/* 4. Bento-Grid Feature Showcase */}
      <section id="features" className="py-20 px-6 bg-slate-100/60 border-y border-slate-200">
        <div className="max-w-7xl mx-auto space-y-12">
          <div className="text-center space-y-3">
            <span className="text-xs font-bold uppercase tracking-wider text-emerald-600">Enterprise Capabilities</span>
            <h2 className="text-2xl sm:text-4xl font-extrabold text-slate-900 tracking-tight">
              Production-Grade Modules Built for Operations Directors
            </h2>
            <p className="text-sm text-slate-600 max-w-2xl mx-auto">
              Everything required to orchestrate high-velocity sales pipelines with institutional security.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {/* Bento Card 1: 2 col span */}
            <div className="md:col-span-2 p-8 rounded-3xl bg-white border border-slate-200 shadow-sm flex flex-col justify-between space-y-6">
              <div className="space-y-3">
                <div className="w-12 h-12 rounded-2xl bg-emerald-50 text-emerald-700 flex items-center justify-center">
                  <Database className="w-6 h-6" />
                </div>
                <h3 className="text-xl font-bold text-slate-900">01. PostgreSQL Row-Level Security (RLS) & Tenant Isolation</h3>
                <p className="text-xs sm:text-sm text-slate-600 leading-relaxed">
                  Every SQL statement is guarded with <code className="font-mono text-xs bg-slate-100 px-1.5 py-0.5 rounded">tenant_id</code> constraints. Even under shared database pooling, tenant queries are physically isolated at the engine level. Super Admins enforce four explicit modes: Active, Paused, Disabled, and View-Only.
                </p>
              </div>

              <div className="p-4 rounded-2xl bg-slate-900 text-slate-200 font-mono text-xs overflow-x-auto">
                <span className="text-emerald-400">CREATE POLICY</span> tenant_isolation_leads <span className="text-emerald-400">ON</span> leads<br />
                &nbsp;&nbsp;<span className="text-emerald-400">FOR ALL USING</span> (tenant_id = current_setting('app.current_tenant_id')::UUID);
              </div>
            </div>

            {/* Bento Card 2 */}
            <div className="p-8 rounded-3xl bg-white border border-slate-200 shadow-sm flex flex-col justify-between space-y-6">
              <div className="space-y-3">
                <div className="w-12 h-12 rounded-2xl bg-indigo-50 text-indigo-700 flex items-center justify-center">
                  <Download className="w-6 h-6" />
                </div>
                <h3 className="text-xl font-bold text-slate-900">02. Chunked PDF Engine</h3>
                <p className="text-xs sm:text-sm text-slate-600 leading-relaxed">
                  Handler-scoped reports stream via progressive buffer chunks. Unassigned records are strictly filtered out so managers receive clean, audit-compliant documents for each handler.
                </p>
              </div>

              <div className="p-3.5 rounded-xl bg-indigo-50/70 border border-indigo-200 text-xs text-indigo-950 font-semibold">
                ✓ Zero OOM memory spikes on 25k records<br />
                ✓ Strict <code className="font-mono text-[11px]">handler_id IS NOT NULL</code> predicate
              </div>
            </div>

            {/* Bento Card 3 */}
            <div className="p-8 rounded-3xl bg-white border border-slate-200 shadow-sm flex flex-col justify-between space-y-6">
              <div className="space-y-3">
                <div className="w-12 h-12 rounded-2xl bg-amber-50 text-amber-700 flex items-center justify-center">
                  <Lock className="w-6 h-6" />
                </div>
                <h3 className="text-xl font-bold text-slate-900">03. 2FA OTP Credential Governance</h3>
                <p className="text-xs sm:text-sm text-slate-600 leading-relaxed">
                  Both Manager and Staff accounts have independent screens to update their User ID and Password. Sensitive credential changes require 6-digit OTP verification.
                </p>
              </div>

              <div className="p-3.5 rounded-xl bg-amber-50/70 border border-amber-200 text-xs text-amber-950 font-semibold">
                ✓ UI bypasses permanently eradicated<br />
                ✓ Granular role permissions matrix
              </div>
            </div>

            {/* Bento Card 4: 2 col span */}
            <div className="md:col-span-2 p-8 rounded-3xl bg-white border border-slate-200 shadow-sm flex flex-col justify-between space-y-6">
              <div className="space-y-3">
                <div className="w-12 h-12 rounded-2xl bg-teal-50 text-teal-700 flex items-center justify-center">
                  <CreditCard className="w-6 h-6" />
                </div>
                <h3 className="text-xl font-bold text-slate-900">04. 60-Day Trial Engine & Stripe Auto-Renewal</h3>
                <p className="text-xs sm:text-sm text-slate-600 leading-relaxed">
                  Super Admins can grant custom validity periods (e.g., +60 days) without upfront billing. Automated cron jobs shift expired tenants to View-Only mode until recharged via Stripe, automatically restoring full write access upon webhook receipt.
                </p>
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 text-xs">
                <div className="p-3 rounded-xl bg-slate-50 border border-slate-200">
                  <span className="text-slate-500 block text-[10px] uppercase font-bold">Standard Validity</span>
                  <span className="font-bold text-slate-900">60 Days Active</span>
                </div>
                <div className="p-3 rounded-xl bg-slate-50 border border-slate-200">
                  <span className="text-slate-500 block text-[10px] uppercase font-bold">Expiry Trigger</span>
                  <span className="font-bold text-amber-700">Auto View-Only</span>
                </div>
                <div className="p-3 rounded-xl bg-slate-50 border border-slate-200 col-span-2 sm:col-span-1">
                  <span className="text-slate-500 block text-[10px] uppercase font-bold">Reactivation</span>
                  <span className="font-bold text-emerald-700">Instant Stripe Webhook</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* 5. Interactive Pricing Tier Matrix */}
      <section id="pricing" className="py-20 px-6 max-w-7xl mx-auto">
        <div className="text-center space-y-4 mb-12">
          <span className="text-xs font-bold uppercase tracking-wider text-emerald-600">
            {pricing.sectionBadge || "Transparent Pricing"}
          </span>
          <h2 className="text-2xl sm:text-4xl font-extrabold text-slate-900 tracking-tight">
            {pricing.mainHeadline || "Predictable Plans for Scaling Sales Teams"}
          </h2>
          <p className="text-sm text-slate-600 max-w-xl mx-auto">
            {pricing.subheadline || "Choose a plan based on your team size and monthly ingestion volume. Every plan includes the full RLS database."}
          </p>

          {/* Monthly / Yearly Toggle */}
          <div className="inline-flex items-center gap-1.5 p-1 rounded-xl bg-slate-200 border border-slate-300">
            <button
              type="button"
              onClick={() => setBillingCycle("monthly")}
              className={`px-4 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                billingCycle === "monthly" ? "bg-white text-slate-900 shadow-sm" : "text-slate-600"
              }`}
            >
              {pricing.monthlyToggleLabel || "Monthly Billing"}
            </button>
            <button
              type="button"
              onClick={() => setBillingCycle("yearly")}
              className={`px-4 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                billingCycle === "yearly" ? "bg-[#059669] text-white shadow-sm" : "text-slate-600"
              }`}
            >
              {pricing.annualToggleLabel || "Annual (2 Months Free)"}
            </button>
          </div>
          {pricing.annualDiscountNote && billingCycle === "yearly" && (
            <p className="text-[11px] font-semibold text-emerald-700">
              {pricing.annualDiscountNote}
            </p>
          )}
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-8 items-stretch">
          {pricing.tiers.map((tier) => {
            const isYearly = billingCycle === "yearly";
            const currentPrice = isYearly ? tier.priceAnnual : tier.priceMonthly;
            const currentPeriod = isYearly ? tier.periodTextAnnual : tier.periodTextMonthly;
            const isPopular = Boolean(tier.isPopular);

            const handleTierClick = () => {
              if (tier.ctaAction === "trial") {
                onLaunchApp();
              } else if (tier.ctaAction === "stripe_standard") {
                handleOpenCheckout("standard");
              } else if (tier.ctaAction === "stripe_enterprise") {
                handleOpenCheckout("enterprise");
              } else {
                window.location.href = `mailto:sales@leadplatform.io?subject=Inquiry%20regarding%20${encodeURIComponent(tier.name)}`;
              }
            };

            return (
              <div
                key={tier.id}
                className={`p-8 rounded-3xl bg-white shadow-sm flex flex-col justify-between transition-all relative ${
                  isPopular
                    ? "border-2 border-[#059669] shadow-xl ring-4 ring-emerald-500/10"
                    : "border border-slate-200"
                }`}
              >
                {isPopular && (
                  <span className="absolute -top-3.5 right-6 px-3 py-1 rounded-full text-[10px] font-extrabold uppercase tracking-wider bg-[#059669] text-white shadow-sm">
                    {tier.popularBadge || "Most Popular"}
                  </span>
                )}

                <div className="space-y-4">
                  <div>
                    <span className={`text-xs font-bold uppercase tracking-wider ${isPopular ? "text-emerald-600" : "text-slate-500"}`}>
                      {tier.badge}
                    </span>
                    <h3 className="text-xl font-bold text-slate-900 mt-1">{tier.name}</h3>
                    <p className="text-xs text-slate-500 mt-1">{tier.description}</p>
                  </div>

                  <div className="pt-2">
                    <span className="text-4xl font-extrabold text-slate-900 font-mono">
                      {currentPrice.startsWith("$") ? currentPrice : `$${currentPrice}`}
                    </span>
                    <span className="text-xs text-slate-500 ml-1.5">{currentPeriod}</span>
                  </div>

                  <ul className={`space-y-2.5 text-xs pt-4 border-t border-slate-100 ${isPopular ? "text-slate-700 font-medium" : "text-slate-600"}`}>
                    {tier.features.map((feature, fIdx) => (
                      <li key={fIdx} className="flex items-center gap-2">
                        <Check className="w-4 h-4 text-emerald-600 shrink-0" />
                        <span>{feature}</span>
                      </li>
                    ))}
                  </ul>
                </div>

                <button
                  type="button"
                  onClick={handleTierClick}
                  className={`mt-8 w-full py-3 rounded-xl text-xs font-bold transition-all cursor-pointer flex items-center justify-center gap-1.5 ${
                    isPopular
                      ? "bg-[#059669] hover:bg-[#047857] text-white shadow-md"
                      : "bg-slate-900 hover:bg-slate-800 text-white"
                  }`}
                >
                  <span>{tier.ctaText}</span>
                  {tier.ctaAction !== "trial" && <ArrowRight className="w-3.5 h-3.5" />}
                </button>
              </div>
            );
          })}
        </div>
      </section>

      {/* 6. Security, Compliance & FAQ */}
      <section id="faq" className="py-20 px-6 bg-white border-t border-slate-200">
        <div className="max-w-4xl mx-auto space-y-10">
          <div className="text-center space-y-3">
            <span className="text-xs font-bold uppercase tracking-wider text-emerald-600">Enterprise Standards</span>
            <h2 className="text-2xl sm:text-3xl font-extrabold text-slate-900 tracking-tight">
              Frequently Asked Technical Questions
            </h2>
          </div>

          <div className="space-y-4">
            {[
              {
                q: "How does PostgreSQL Row-Level Security isolate multi-tenant data?",
                a: "Every tenant entity (leads, files, call logs) contains a foreign key tenant_id. When a request is authenticated, connection settings set current_tenant_id. PostgreSQL enforces engine-level filters so a tenant can never read or mutate records belonging to another organization.",
              },
              {
                q: "What happens when a 60-day trial expires?",
                a: "The automated expiry daemon automatically transitions the tenant status from 'Active' to 'View-Only'. Team members can still view historical leads and download existing records, but creating, editing, and dialing are frozen until reactivated via Stripe or Super Admin override.",
              },
              {
                q: "How does the PDF report engine avoid Out-Of-Memory (OOM) crashes?",
                a: "Instead of building giant in-memory string trees, reports are streamed via asynchronous chunked buffers. Leads are strictly filtered to handler_id IS NOT NULL, excluding all unassigned leads and other handlers.",
              },
              {
                q: "Are User IDs and Passwords managed independently for staff and managers?",
                a: "Yes. Both Manager and Staff roles have dedicated credential management screens requiring 6-digit OTP verification codes dispatched to their email or mobile phone before changes are finalized.",
              },
            ].map((item, idx) => (
              <div key={idx} className="rounded-2xl border border-slate-200 overflow-hidden">
                <button
                  type="button"
                  onClick={() => toggleFaq(idx)}
                  className="w-full p-5 text-left font-bold text-sm text-slate-900 flex items-center justify-between hover:bg-slate-50 transition-colors cursor-pointer"
                >
                  <span>{item.q}</span>
                  <ChevronRight
                    className={`w-4 h-4 text-slate-400 transition-transform ${activeFaq === idx ? "rotate-90 text-emerald-600" : ""}`}
                  />
                </button>
                {activeFaq === idx && (
                  <div className="px-5 pb-5 pt-1 text-xs text-slate-600 leading-relaxed border-t border-slate-100 bg-slate-50/50">
                    {item.a}
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* 7. Quiet Footer */}
      <footer className="bg-[#0F172A] text-slate-400 py-12 px-6 border-t border-slate-800 text-xs">
        <div className="max-w-7xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-6">
          <div className="flex items-center gap-2 font-bold text-white">
            <span className="w-6 h-6 rounded-lg bg-emerald-500/20 text-emerald-400 flex items-center justify-center font-bold text-xs">
              L
            </span>
            <span>LeadFlow SaaS Engine</span>
          </div>

          <div className="flex items-center gap-6">
            <button onClick={onLaunchApp} className="hover:text-white transition-colors cursor-pointer">
              Lead Workspace
            </button>
            <button onClick={onOpenSuperAdmin} className="hover:text-white transition-colors cursor-pointer">
              Super Admin Portal
            </button>
            <a href="#pricing" className="hover:text-white transition-colors">
              Pricing Plans
            </a>
          </div>

          <div className="text-slate-500">
            © {new Date().getFullYear()} LeadFlow Enterprise. PostgreSQL RLS Protected.
          </div>
        </div>
      </footer>

      {/* Interactive Stripe Checkout Modal */}
      <StripeCheckoutModal
        isOpen={isStripeOpen}
        onClose={() => setIsStripeOpen(false)}
        initialTier={selectedPlanTier}
        onRenewalSuccess={() => {
          onLaunchApp();
        }}
      />

      {/* Customer / Client Login Modal */}
      {isCustomerLoginOpen && (
        <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="w-full max-w-md bg-white rounded-2xl shadow-2xl border border-slate-200 overflow-hidden text-slate-900 animate-in fade-in zoom-in-95">
            <div className="px-6 py-5 bg-gradient-to-r from-slate-900 to-slate-800 text-white flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-xl bg-emerald-500/20 text-emerald-400 flex items-center justify-center font-bold">
                  <User className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-white tracking-tight">Customer & Client Login</h3>
                  <p className="text-[11px] text-slate-300">Enter your credentials to access the workspace</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setIsCustomerLoginOpen(false)}
                className="text-slate-400 hover:text-white transition-colors cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-6 space-y-4">
              {customerLoginError && (
                <div className="p-3 rounded-xl bg-red-50 border border-red-200 text-red-700 text-xs flex items-start gap-2">
                  <AlertCircle className="w-4 h-4 shrink-0 mt-0.5 text-red-500" />
                  <span>{customerLoginError}</span>
                </div>
              )}

              <form onSubmit={handleCustomerLoginSubmit} className="space-y-4 text-xs">
                <div>
                  <label className="font-bold text-slate-700 block mb-1.5">User ID / Username</label>
                  <input
                    id="input-customer-userid"
                    type="text"
                    value={customerUserId}
                    onChange={(e) => setCustomerUserId(e.target.value)}
                    placeholder="e.g. admin or staff"
                    className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 bg-white text-slate-900 text-sm outline-none focus:border-emerald-600 focus:ring-1 focus:ring-emerald-600"
                    required
                  />
                </div>

                <div>
                  <label className="font-bold text-slate-700 block mb-1.5">Password</label>
                  <div className="relative">
                    <input
                      id="input-customer-password"
                      type={showCustomerPassword ? "text" : "password"}
                      value={customerPassword}
                      onChange={(e) => setCustomerPassword(e.target.value)}
                      placeholder="Enter password"
                      className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 bg-white text-slate-900 text-sm outline-none focus:border-emerald-600 focus:ring-1 focus:ring-emerald-600 pr-10"
                      required
                    />
                    <button
                      type="button"
                      onClick={() => setShowCustomerPassword(!showCustomerPassword)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-700 cursor-pointer"
                    >
                      {showCustomerPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                </div>

                <div className="pt-2">
                  <button
                    id="btn-customer-submit-login"
                    type="submit"
                    disabled={isLoggingInCustomer}
                    className="w-full py-2.5 px-4 rounded-xl font-bold text-sm text-white bg-[#059669] hover:bg-[#047857] shadow-md transition-all cursor-pointer flex items-center justify-center gap-2 disabled:opacity-50"
                  >
                    <Lock className="w-4 h-4" />
                    <span>{isLoggingInCustomer ? "Verifying..." : "Sign In to Workspace"}</span>
                  </button>
                </div>
              </form>

              <div className="p-3.5 bg-slate-50 border border-slate-200 rounded-xl space-y-2">
                <div className="flex items-center justify-between text-[11px]">
                  <span className="font-bold text-slate-700 uppercase tracking-wider">Available Demo Accounts:</span>
                  <span className="text-[10px] text-emerald-700 font-semibold">Click any card to fill</span>
                </div>

                <div className="grid grid-cols-1 gap-1.5 text-xs">
                  {/* Customer / Client card */}
                  <button
                    type="button"
                    onClick={() => {
                      setCustomerUserId(demoAccounts.customer.username);
                      setCustomerPassword(demoAccounts.customer.password);
                      setCustomerLoginError(null);
                    }}
                    className={`p-2 rounded-lg border text-left transition-all cursor-pointer flex items-center justify-between ${
                      customerUserId === demoAccounts.customer.username
                        ? "bg-emerald-50/80 border-emerald-400 text-emerald-950 shadow-2xs"
                        : "bg-white border-slate-200 hover:border-emerald-300 text-slate-800"
                    }`}
                  >
                    <div className="flex items-center gap-2">
                      <span className="p-1 rounded bg-emerald-100 text-emerald-800 text-[11px] font-bold">💼 Client</span>
                      <span className="text-[11px] text-slate-600 font-medium">View-Only Portal</span>
                    </div>
                    <div className="font-mono text-[10px] font-semibold text-slate-900 bg-white/80 px-1.5 py-0.5 rounded border border-slate-200">
                      {demoAccounts.customer.username} / {demoAccounts.customer.password}
                    </div>
                  </button>

                  {/* Manager card */}
                  <button
                    type="button"
                    onClick={() => {
                      setCustomerUserId(demoAccounts.manager.username);
                      setCustomerPassword(demoAccounts.manager.password);
                      setCustomerLoginError(null);
                    }}
                    className={`p-2 rounded-lg border text-left transition-all cursor-pointer flex items-center justify-between ${
                      customerUserId === demoAccounts.manager.username
                        ? "bg-indigo-50/80 border-indigo-400 text-indigo-950 shadow-2xs"
                        : "bg-white border-slate-200 hover:border-indigo-300 text-slate-800"
                    }`}
                  >
                    <div className="flex items-center gap-2">
                      <span className="p-1 rounded bg-indigo-100 text-indigo-800 text-[11px] font-bold">👑 Manager</span>
                      <span className="text-[11px] text-slate-600 font-medium">Full Governance</span>
                    </div>
                    <div className="font-mono text-[10px] font-semibold text-slate-900 bg-white/80 px-1.5 py-0.5 rounded border border-slate-200">
                      {demoAccounts.manager.username} / {demoAccounts.manager.password}
                    </div>
                  </button>

                  {/* Staff card */}
                  <button
                    type="button"
                    onClick={() => {
                      setCustomerUserId(demoAccounts.staff.username);
                      setCustomerPassword(demoAccounts.staff.password);
                      setCustomerLoginError(null);
                    }}
                    className={`p-2 rounded-lg border text-left transition-all cursor-pointer flex items-center justify-between ${
                      customerUserId === demoAccounts.staff.username
                        ? "bg-teal-50/80 border-teal-400 text-teal-950 shadow-2xs"
                        : "bg-white border-slate-200 hover:border-teal-300 text-slate-800"
                    }`}
                  >
                    <div className="flex items-center gap-2">
                      <span className="p-1 rounded bg-teal-100 text-teal-800 text-[11px] font-bold">👥 Staff</span>
                      <span className="text-[11px] text-slate-600 font-medium">Calling Specialist</span>
                    </div>
                    <div className="font-mono text-[10px] font-semibold text-slate-900 bg-white/80 px-1.5 py-0.5 rounded border border-slate-200">
                      {demoAccounts.staff.username} / {demoAccounts.staff.password}
                    </div>
                  </button>
                </div>

                <div className="pt-1.5 border-t border-slate-200 flex items-center justify-between text-[10px] text-slate-500">
                  <span>Custom ID/password? Manage in Super Admin</span>
                  <button
                    type="button"
                    onClick={handleOpenSuperAdminNewTab}
                    className="font-bold text-emerald-700 hover:underline cursor-pointer inline-flex items-center gap-0.5"
                  >
                    <span>Super Admin Console</span>
                    <ExternalLink className="w-2.5 h-2.5" />
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
