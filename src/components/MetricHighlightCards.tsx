import React from "react";
import {
  Database,
  FileCheck2,
  CheckCircle2,
  AlertCircle,
  CalendarClock,
  PhoneCall,
  RotateCcw,
  Sparkles,
  PhoneIncoming,
  Check,
} from "lucide-react";
import { Lead, StatusFilter } from "../types";

interface MetricHighlightCardsProps {
  leads: Lead[];
  activeFilter?: StatusFilter;
  onSelectFilter?: (filter: StatusFilter) => void;
  className?: string;
}

export const MetricHighlightCards: React.FC<MetricHighlightCardsProps> = ({
  leads,
  activeFilter = "all",
  onSelectFilter,
  className = "",
}) => {
  const total = leads.length;

  // Integrated: Leads ingested/integrated from spreadsheets or with complete proof/receipt metadata
  const integrated = leads.filter(
    (l) => Boolean(l.fileId || l.uploadedFileName || l.paymentReceipt || l.proof)
  ).length;

  // Interested: Leads marked with Interested status
  const interested = leads.filter((l) => l.status === "Interested").length;

  // Require: Leads requiring immediate attention / action
  const requireCount = leads.filter((l) => l.status === "Requires Follow-up").length;

  // Follow up: Leads in follow-up pipeline (Requires Follow-up or with explicit follow-up notes/history)
  const followUpCount = leads.filter(
    (l) =>
      l.status === "Requires Follow-up" ||
      (l.manualNotes && /follow|call back|schedule|quote/i.test(l.manualNotes))
  ).length;

  // Pending Calls: Leads with Pending Call status awaiting first outreach
  const pendingCalls = leads.filter((l) => l.status === "Pending Call").length;

  // Additional secondary counts
  const noAnswer = leads.filter((l) => l.status === "No Answer").length;
  const notInterested = leads.filter((l) => l.status === "Not Interested").length;

  // Percentages & Rates
  const integratedPercent = total > 0 ? Math.round((integrated / total) * 100) : 100;
  const conversionRate = total > 0 ? Math.round((interested / total) * 100) : 0;
  const pendingPercent = total > 0 ? Math.round((pendingCalls / total) * 100) : 0;

  const handleCardClick = (targetFilter: StatusFilter) => {
    if (!onSelectFilter) return;
    if (activeFilter === targetFilter) {
      onSelectFilter("all");
    } else {
      onSelectFilter(targetFilter);
    }
  };

  return (
    <div className={`space-y-2.5 ${className}`}>
      {/* Header row with section descriptor and quick reset */}
      <div className="flex items-center justify-between gap-3 px-1">
        <div className="flex items-center gap-2">
          <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500">
            Pipeline & Ingestion Metrics
          </span>
          <span className="text-[11px] text-slate-400 hidden sm:inline">
            • Subtle gradients • Click any card to filter
          </span>
        </div>

        {activeFilter && activeFilter !== "all" && onSelectFilter && (
          <button
            type="button"
            onClick={() => onSelectFilter("all")}
            className="inline-flex items-center gap-1.5 px-2.5 py-1 text-xs font-semibold text-indigo-700 bg-indigo-50 hover:bg-indigo-100 border border-indigo-200/80 rounded-lg transition-all cursor-pointer shadow-2xs"
            title="Reset active filter to all records"
          >
            <RotateCcw className="w-3 h-3" />
            <span>Showing: {activeFilter}</span>
            <span className="text-[10px] text-indigo-500 font-normal">✕ Reset</span>
          </button>
        )}
      </div>

      {/* 6 High-Fidelity Metric Cards with Subtle, Light Gradient Shades */}
      <div className="grid grid-cols-2 sm:grid-cols-3 xl:grid-cols-6 gap-3">
        {/* 1. Total Metric Card */}
        <button
          type="button"
          onClick={() => handleCardClick("all")}
          className={`relative text-left p-3.5 rounded-2xl border transition-all duration-200 cursor-pointer overflow-hidden group select-none ${
            activeFilter === "all"
              ? "bg-gradient-to-br from-slate-50 via-slate-100/90 to-indigo-50/40 border-slate-300 ring-2 ring-slate-400/50 shadow-xs"
              : "bg-gradient-to-br from-slate-50/90 via-slate-100/50 to-indigo-50/20 border-slate-200/90 hover:border-slate-300 hover:shadow-xs hover:-translate-y-0.5"
          }`}
          title="Filter: View All Leads"
        >
          {/* Subtle Top Accent Hairline */}
          <div className="absolute top-0 left-0 right-0 h-0.5 bg-slate-400 group-hover:bg-slate-500 transition-colors" />

          <div className="flex items-center justify-between mb-1.5">
            <span className="text-xs font-bold text-slate-700 tracking-tight">Total</span>
            <div className="p-1.5 rounded-lg bg-slate-200/70 text-slate-700 shadow-2xs group-hover:bg-slate-200 transition-colors">
              <Database className="w-3.5 h-3.5" />
            </div>
          </div>

          <div className="flex items-baseline justify-between mt-1">
            <span className="text-2xl font-bold text-slate-900 tabular-nums tracking-tight">
              {total}
            </span>
            <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded bg-slate-200/70 text-slate-700 border border-slate-300/60 tabular-nums">
              Records
            </span>
          </div>

          <div className="flex items-center justify-between mt-1.5 pt-1.5 border-t border-slate-200/60 text-[11px] text-slate-500 font-medium">
            <span className="truncate">All Registry</span>
            {activeFilter === "all" && (
              <span className="text-[10px] text-slate-700 font-bold flex items-center gap-0.5">
                <Check className="w-3 h-3" /> Active
              </span>
            )}
          </div>
        </button>

        {/* 2. Integrated Metric Card */}
        <button
          type="button"
          onClick={() => handleCardClick("Integrated")}
          className={`relative text-left p-3.5 rounded-2xl border transition-all duration-200 cursor-pointer overflow-hidden group select-none ${
            activeFilter === "Integrated"
              ? "bg-gradient-to-br from-sky-50 via-blue-50/90 to-indigo-50/50 border-sky-300 ring-2 ring-sky-500/50 shadow-xs"
              : "bg-gradient-to-br from-sky-50/80 via-blue-50/40 to-indigo-50/20 border-sky-200/80 hover:border-sky-300 hover:shadow-xs hover:-translate-y-0.5"
          }`}
          title="Filter: View Integrated Spreadsheet Leads"
        >
          {/* Subtle Top Accent Hairline */}
          <div className="absolute top-0 left-0 right-0 h-0.5 bg-sky-400 group-hover:bg-sky-500 transition-colors" />

          <div className="flex items-center justify-between mb-1.5">
            <span className="text-xs font-bold text-sky-900 tracking-tight">Integrated</span>
            <div className="p-1.5 rounded-lg bg-sky-100 text-sky-700 shadow-2xs group-hover:bg-sky-200/80 transition-colors">
              <FileCheck2 className="w-3.5 h-3.5" />
            </div>
          </div>

          <div className="flex items-baseline justify-between mt-1">
            <span className="text-2xl font-bold text-sky-950 tabular-nums tracking-tight">
              {integrated}
            </span>
            <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded bg-sky-100/90 text-sky-700 border border-sky-200/70 tabular-nums">
              {integratedPercent}%
            </span>
          </div>

          <div className="flex items-center justify-between mt-1.5 pt-1.5 border-t border-sky-200/60 text-[11px] text-sky-700/80 font-medium">
            <span className="truncate">Excel Synced</span>
            {activeFilter === "Integrated" && (
              <span className="text-[10px] text-sky-800 font-bold flex items-center gap-0.5">
                <Check className="w-3 h-3" /> Active
              </span>
            )}
          </div>
        </button>

        {/* 3. Interested Metric Card */}
        <button
          type="button"
          onClick={() => handleCardClick("Interested")}
          className={`relative text-left p-3.5 rounded-2xl border transition-all duration-200 cursor-pointer overflow-hidden group select-none ${
            activeFilter === "Interested"
              ? "bg-gradient-to-br from-emerald-50 via-teal-50/90 to-emerald-50/60 border-emerald-300 ring-2 ring-emerald-500/50 shadow-xs"
              : "bg-gradient-to-br from-emerald-50/90 via-teal-50/40 to-slate-50 border-emerald-200/80 hover:border-emerald-300 hover:shadow-xs hover:-translate-y-0.5"
          }`}
          title="Filter: View Interested Leads"
        >
          {/* Subtle Top Accent Hairline */}
          <div className="absolute top-0 left-0 right-0 h-0.5 bg-emerald-500 group-hover:bg-emerald-600 transition-colors" />

          <div className="flex items-center justify-between mb-1.5">
            <span className="text-xs font-bold text-emerald-900 tracking-tight">Interested</span>
            <div className="p-1.5 rounded-lg bg-emerald-100 text-emerald-700 shadow-2xs group-hover:bg-emerald-200/80 transition-colors">
              <CheckCircle2 className="w-3.5 h-3.5" />
            </div>
          </div>

          <div className="flex items-baseline justify-between mt-1">
            <span className="text-2xl font-bold text-emerald-950 tabular-nums tracking-tight">
              {interested}
            </span>
            <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded bg-emerald-100/90 text-emerald-700 border border-emerald-200/70 tabular-nums">
              {conversionRate}%
            </span>
          </div>

          <div className="flex items-center justify-between mt-1.5 pt-1.5 border-t border-emerald-200/60 text-[11px] text-emerald-700/80 font-medium">
            <span className="truncate">High Intent</span>
            {activeFilter === "Interested" && (
              <span className="text-[10px] text-emerald-800 font-bold flex items-center gap-0.5">
                <Check className="w-3 h-3" /> Active
              </span>
            )}
          </div>
        </button>

        {/* 4. Require Metric Card */}
        <button
          type="button"
          onClick={() => handleCardClick("Requires Follow-up")}
          className={`relative text-left p-3.5 rounded-2xl border transition-all duration-200 cursor-pointer overflow-hidden group select-none ${
            activeFilter === "Requires Follow-up"
              ? "bg-gradient-to-br from-rose-50 via-red-50/90 to-amber-50/40 border-rose-300 ring-2 ring-rose-500/50 shadow-xs"
              : "bg-gradient-to-br from-rose-50/90 via-red-50/40 to-amber-50/20 border-rose-200/80 hover:border-rose-300 hover:shadow-xs hover:-translate-y-0.5"
          }`}
          title="Filter: View Leads Requiring Action"
        >
          {/* Subtle Top Accent Hairline */}
          <div className="absolute top-0 left-0 right-0 h-0.5 bg-rose-400 group-hover:bg-rose-500 transition-colors" />

          <div className="flex items-center justify-between mb-1.5">
            <span className="text-xs font-bold text-rose-900 tracking-tight">Require</span>
            <div className="p-1.5 rounded-lg bg-rose-100 text-rose-700 shadow-2xs group-hover:bg-rose-200/80 transition-colors">
              <AlertCircle className="w-3.5 h-3.5" />
            </div>
          </div>

          <div className="flex items-baseline justify-between mt-1">
            <span className="text-2xl font-bold text-rose-950 tabular-nums tracking-tight">
              {requireCount}
            </span>
            <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded bg-rose-100/90 text-rose-700 border border-rose-200/70">
              Priority
            </span>
          </div>

          <div className="flex items-center justify-between mt-1.5 pt-1.5 border-t border-rose-200/60 text-[11px] text-rose-700/80 font-medium">
            <span className="truncate">Action Needed</span>
            {activeFilter === "Requires Follow-up" && (
              <span className="text-[10px] text-rose-800 font-bold flex items-center gap-0.5">
                <Check className="w-3 h-3" /> Active
              </span>
            )}
          </div>
        </button>

        {/* 5. Follow up Metric Card */}
        <button
          type="button"
          onClick={() => handleCardClick("Requires Follow-up")}
          className={`relative text-left p-3.5 rounded-2xl border transition-all duration-200 cursor-pointer overflow-hidden group select-none ${
            activeFilter === "Requires Follow-up"
              ? "bg-gradient-to-br from-amber-50 via-orange-50/90 to-yellow-50/40 border-amber-300 ring-2 ring-amber-500/50 shadow-xs"
              : "bg-gradient-to-br from-amber-50/90 via-orange-50/40 to-yellow-50/20 border-amber-200/80 hover:border-amber-300 hover:shadow-xs hover:-translate-y-0.5"
          }`}
          title="Filter: View Follow up Pipeline"
        >
          {/* Subtle Top Accent Hairline */}
          <div className="absolute top-0 left-0 right-0 h-0.5 bg-amber-400 group-hover:bg-amber-500 transition-colors" />

          <div className="flex items-center justify-between mb-1.5">
            <span className="text-xs font-bold text-amber-900 tracking-tight">Follow up</span>
            <div className="p-1.5 rounded-lg bg-amber-100 text-amber-700 shadow-2xs group-hover:bg-amber-200/80 transition-colors">
              <CalendarClock className="w-3.5 h-3.5" />
            </div>
          </div>

          <div className="flex items-baseline justify-between mt-1">
            <span className="text-2xl font-bold text-amber-950 tabular-nums tracking-tight">
              {followUpCount}
            </span>
            <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded bg-amber-100/90 text-amber-700 border border-amber-200/70">
              Pipeline
            </span>
          </div>

          <div className="flex items-center justify-between mt-1.5 pt-1.5 border-t border-amber-200/60 text-[11px] text-amber-700/80 font-medium">
            <span className="truncate">Scheduled</span>
            {activeFilter === "Requires Follow-up" && (
              <span className="text-[10px] text-amber-800 font-bold flex items-center gap-0.5">
                <Check className="w-3 h-3" /> Active
              </span>
            )}
          </div>
        </button>

        {/* 6. Pending Calls Metric Card */}
        <button
          type="button"
          onClick={() => handleCardClick("Pending Call")}
          className={`relative text-left p-3.5 rounded-2xl border transition-all duration-200 cursor-pointer overflow-hidden group select-none ${
            activeFilter === "Pending Call"
              ? "bg-gradient-to-br from-indigo-50 via-violet-50/90 to-blue-50/50 border-indigo-300 ring-2 ring-indigo-500/50 shadow-xs"
              : "bg-gradient-to-br from-indigo-50/90 via-violet-50/40 to-slate-50 border-indigo-200/80 hover:border-indigo-300 hover:shadow-xs hover:-translate-y-0.5"
          }`}
          title="Filter: View Pending Calls"
        >
          {/* Subtle Top Accent Hairline */}
          <div className="absolute top-0 left-0 right-0 h-0.5 bg-indigo-400 group-hover:bg-indigo-500 transition-colors" />

          <div className="flex items-center justify-between mb-1.5">
            <span className="text-xs font-bold text-indigo-900 tracking-tight">Pending Calls</span>
            <div className="p-1.5 rounded-lg bg-indigo-100 text-indigo-700 shadow-2xs group-hover:bg-indigo-200/80 transition-colors">
              <PhoneCall className="w-3.5 h-3.5" />
            </div>
          </div>

          <div className="flex items-baseline justify-between mt-1">
            <span className="text-2xl font-bold text-indigo-950 tabular-nums tracking-tight">
              {pendingCalls}
            </span>
            <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded bg-indigo-100/90 text-indigo-700 border border-indigo-200/70 tabular-nums">
              {pendingPercent}%
            </span>
          </div>

          <div className="flex items-center justify-between mt-1.5 pt-1.5 border-t border-indigo-200/60 text-[11px] text-indigo-700/80 font-medium">
            <span className="truncate">To Be Dialed</span>
            {activeFilter === "Pending Call" && (
              <span className="text-[10px] text-indigo-800 font-bold flex items-center gap-0.5">
                <Check className="w-3 h-3" /> Active
              </span>
            )}
          </div>
        </button>
      </div>

      {/* Quiet metadata line for remaining dispo states (No Answer, Not Interested) adhering to Anti-Slop Zero-Pill discipline */}
      {(noAnswer > 0 || notInterested > 0) && (
        <div className="flex items-center justify-end gap-3 text-[11px] text-slate-500 px-1 pt-0.5 font-medium">
          <span>Other Dispositions:</span>
          {noAnswer > 0 && (
            <button
              type="button"
              onClick={() => handleCardClick("No Answer")}
              className={`hover:text-slate-900 transition-colors cursor-pointer ${
                activeFilter === "No Answer" ? "text-indigo-600 font-bold" : ""
              }`}
            >
              <strong className="tabular-nums font-bold text-slate-700">{noAnswer}</strong> No Answer
            </button>
          )}
          {noAnswer > 0 && notInterested > 0 && <span aria-hidden="true">·</span>}
          {notInterested > 0 && (
            <button
              type="button"
              onClick={() => handleCardClick("Not Interested")}
              className={`hover:text-slate-900 transition-colors cursor-pointer ${
                activeFilter === "Not Interested" ? "text-indigo-600 font-bold" : ""
              }`}
            >
              <strong className="tabular-nums font-bold text-slate-700">{notInterested}</strong> Not Interested
            </button>
          )}
        </div>
      )}
    </div>
  );
};
