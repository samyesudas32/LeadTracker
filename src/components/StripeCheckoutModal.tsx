import React, { useState } from "react";
import {
  CreditCard,
  CheckCircle2,
  Lock,
  ShieldCheck,
  X,
  Loader2,
  Calendar,
  Building2,
  ArrowRight,
  Sparkles,
} from "lucide-react";
import { Tenant, SubscriptionTier } from "../types/saas";
import { apiClient } from "../services/apiClient";

interface StripeCheckoutModalProps {
  isOpen: boolean;
  onClose: () => void;
  tenant?: Tenant | null;
  initialTier?: SubscriptionTier;
  onRenewalSuccess?: (updatedTenant: Tenant) => void;
}

export const StripeCheckoutModal: React.FC<StripeCheckoutModalProps> = ({
  isOpen,
  onClose,
  tenant,
  initialTier = "standard",
  onRenewalSuccess,
}) => {
  const [selectedTier, setSelectedTier] = useState<SubscriptionTier>(initialTier);
  const [billingInterval, setBillingInterval] = useState<"month" | "year">("month");
  const [cardNumber, setCardNumber] = useState("4242 •••• •••• 4242");
  const [cardExpiry, setCardExpiry] = useState("12/28");
  const [cardCvc, setCardCvc] = useState("981");
  const [cardHolder, setCardHolder] = useState(tenant?.contactName || "Sarah Jenkins");
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  if (!isOpen) return null;

  const targetTenant = tenant || {
    id: "tenant-acme-prod",
    name: "Acme Lead Operations",
    slug: "acme",
    status: "active",
    planTier: selectedTier,
    expiresAt: new Date(Date.now() + 60 * 24 * 60 * 60 * 1000).toISOString(),
    contactEmail: "admin@acme-leads.com",
  };

  const monthlyPrice = selectedTier === "enterprise" ? 499 : 149;
  const annualDiscountMultiplier = 10; // 10 months price for 12 months
  const totalPrice = billingInterval === "year" ? monthlyPrice * annualDiscountMultiplier : monthlyPrice;

  const handlePay = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setErrorMsg(null);

    try {
      const res = await apiClient.confirmStripeRenewal({
        tenantId: targetTenant.id,
        planTier: selectedTier,
        billingInterval,
        last4: "4242",
      });

      if (res.success && res.tenant) {
        setSuccess(true);
        if (onRenewalSuccess) {
          onRenewalSuccess(res.tenant);
        }
        setTimeout(() => {
          setSuccess(false);
          onClose();
        }, 1800);
      } else {
        setErrorMsg("Failed to process payment. Please verify card details.");
      }
    } catch (err: any) {
      setErrorMsg(err?.message || "Payment gateway processing error.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/70 backdrop-blur-xs p-4 overflow-y-auto animate-in fade-in duration-150">
      <div
        className="bg-white rounded-2xl shadow-2xl max-w-lg w-full border border-slate-200 overflow-hidden animate-in zoom-in-95 duration-150 my-6"
        role="dialog"
        aria-modal="true"
        aria-labelledby="stripe-modal-title"
      >
        {/* Stripe Header Brand */}
        <div className="bg-slate-900 px-6 py-4 flex items-center justify-between text-white">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-emerald-500/20 text-emerald-400 flex items-center justify-center font-bold text-sm border border-emerald-500/30">
              S
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="font-bold text-sm tracking-tight text-white">Stripe Secure Checkout</span>
                <span className="text-[10px] font-semibold px-2 py-0.5 rounded bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                  Live Test Mode
                </span>
              </div>
              <p className="text-[11px] text-slate-400">Enterprise Multi-Tenant Subscription Gateway</p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {success ? (
          <div className="p-8 text-center space-y-3">
            <div className="w-16 h-16 rounded-full bg-emerald-100 text-emerald-600 flex items-center justify-center mx-auto">
              <CheckCircle2 className="w-9 h-9" />
            </div>
            <h3 className="text-lg font-bold text-slate-900">Payment Processed Successfully!</h3>
            <p className="text-xs text-slate-600 max-w-xs mx-auto">
              Organization <strong>{targetTenant.name}</strong> has been reactivated to <strong>Active</strong> mode. Validity extended by{" "}
              {billingInterval === "year" ? "1 Full Year" : "30 Days"}.
            </p>
          </div>
        ) : (
          <form onSubmit={handlePay} className="p-6 space-y-4 text-xs">
            {errorMsg && (
              <div className="p-3 rounded-xl bg-red-50 border border-red-200 text-red-800 flex items-center gap-2 text-xs">
                <span>{errorMsg}</span>
              </div>
            )}

            {/* Target Organization Info */}
            <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200/90 flex items-center justify-between">
              <div>
                <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500">Target Tenant</span>
                <div className="font-bold text-sm text-slate-900 flex items-center gap-1.5">
                  <Building2 className="w-3.5 h-3.5 text-indigo-600" />
                  <span>{targetTenant.name}</span>
                </div>
              </div>
              <div className="text-right">
                <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500">Current Status</span>
                <div className="font-bold text-xs capitalize text-emerald-700">{targetTenant.status || "Active"}</div>
              </div>
            </div>

            {/* Plan Tier and Billing Cadence Switcher */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <label className="font-semibold text-slate-700">Select Subscription Tier</label>
                {/* Cadence Toggle */}
                <div className="flex items-center gap-1 bg-slate-100 p-0.5 rounded-lg border border-slate-200">
                  <button
                    type="button"
                    onClick={() => setBillingInterval("month")}
                    className={`px-2 py-0.5 rounded text-[10px] font-bold transition-all cursor-pointer ${
                      billingInterval === "month" ? "bg-white text-slate-900 shadow-2xs" : "text-slate-500"
                    }`}
                  >
                    Monthly
                  </button>
                  <button
                    type="button"
                    onClick={() => setBillingInterval("year")}
                    className={`px-2 py-0.5 rounded text-[10px] font-bold transition-all cursor-pointer ${
                      billingInterval === "year" ? "bg-emerald-600 text-white shadow-2xs" : "text-slate-500"
                    }`}
                  >
                    Annual (Save 17%)
                  </button>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2.5">
                <button
                  type="button"
                  onClick={() => setSelectedTier("standard")}
                  className={`p-3 rounded-xl border text-left transition-all cursor-pointer ${
                    selectedTier === "standard"
                      ? "border-emerald-500 bg-emerald-50/50 ring-2 ring-emerald-500/20"
                      : "border-slate-200 hover:border-slate-300 bg-white"
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-slate-900 text-xs">Standard Tier</span>
                    <span className="font-mono font-bold text-slate-800 text-xs">$149/mo</span>
                  </div>
                  <p className="text-[10px] text-slate-500 mt-1">Up to 50,000 leads, 15 staff handlers, full RLS database.</p>
                </button>

                <button
                  type="button"
                  onClick={() => setSelectedTier("enterprise")}
                  className={`p-3 rounded-xl border text-left transition-all cursor-pointer ${
                    selectedTier === "enterprise"
                      ? "border-emerald-500 bg-emerald-50/50 ring-2 ring-emerald-500/20"
                      : "border-slate-200 hover:border-slate-300 bg-white"
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-slate-900 text-xs">Enterprise Tier</span>
                    <span className="font-mono font-bold text-slate-800 text-xs">$499/mo</span>
                  </div>
                  <p className="text-[10px] text-slate-500 mt-1">250,000+ leads, 100 users, dedicated subdomains, custom RLS.</p>
                </button>
              </div>
            </div>

            {/* Payment Details Form */}
            <div className="space-y-2.5 pt-2 border-t border-slate-100">
              <label className="font-semibold text-slate-700 block">Payment Details (PCI DSS Compliant)</label>

              <div>
                <label className="text-[11px] text-slate-500 block mb-1">Cardholder Name</label>
                <input
                  type="text"
                  value={cardHolder}
                  onChange={(e) => setCardHolder(e.target.value)}
                  className="w-full px-3 py-2 text-xs border border-slate-200 rounded-lg outline-none focus:ring-2 focus:ring-emerald-500"
                  required
                />
              </div>

              <div>
                <label className="text-[11px] text-slate-500 block mb-1">Card Number</label>
                <div className="relative">
                  <CreditCard className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                  <input
                    type="text"
                    value={cardNumber}
                    onChange={(e) => setCardNumber(e.target.value)}
                    className="w-full pl-9 pr-3 py-2 text-xs border border-slate-200 rounded-lg outline-none font-mono focus:ring-2 focus:ring-emerald-500"
                    required
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2.5">
                <div>
                  <label className="text-[11px] text-slate-500 block mb-1">Expiration (MM/YY)</label>
                  <input
                    type="text"
                    value={cardExpiry}
                    onChange={(e) => setCardExpiry(e.target.value)}
                    className="w-full px-3 py-2 text-xs border border-slate-200 rounded-lg outline-none font-mono focus:ring-2 focus:ring-emerald-500"
                    required
                  />
                </div>
                <div>
                  <label className="text-[11px] text-slate-500 block mb-1">Security CVC</label>
                  <input
                    type="text"
                    value={cardCvc}
                    onChange={(e) => setCardCvc(e.target.value)}
                    className="w-full px-3 py-2 text-xs border border-slate-200 rounded-lg outline-none font-mono focus:ring-2 focus:ring-emerald-500"
                    required
                  />
                </div>
              </div>
            </div>

            {/* Total Summary and Instant Reactivation Button */}
            <div className="pt-3 border-t border-slate-100 flex items-center justify-between">
              <div>
                <span className="text-[11px] text-slate-500 block">Total Due Today</span>
                <span className="text-base font-extrabold text-slate-900 font-mono tabular-nums">
                  ${totalPrice}.00 USD
                </span>
              </div>

              <button
                type="submit"
                disabled={loading}
                className="inline-flex items-center gap-1.5 px-5 py-2.5 rounded-xl font-bold text-xs bg-emerald-600 hover:bg-emerald-700 text-white shadow-md transition-all cursor-pointer disabled:opacity-50"
              >
                {loading ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    <span>Processing...</span>
                  </>
                ) : (
                  <>
                    <Lock className="w-3.5 h-3.5" />
                    <span>Pay & Activate Organization</span>
                  </>
                )}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
};
