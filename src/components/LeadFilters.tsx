import React from "react";
import { Search, Calendar, MapPin, X, Users, BookmarkCheck } from "lucide-react";
import { StatusFilter, Lead } from "../types";

interface LeadFiltersProps {
  leads?: Lead[];
  searchQuery: string;
  onSearchChange: (val: string) => void;
  statusFilter: StatusFilter;
  onStatusFilterChange: (val: StatusFilter) => void;
  selectedYear: string;
  onYearChange: (val: string) => void;
  availableYears: string[];
  selectedCity: string;
  onCityChange: (val: string) => void;
  availableCities: string[];
  sortBy: string;
  onSortByChange: (val: string) => void;
  onResetFilters: () => void;
  hasActiveFilters: boolean;
  selectedHandler?: string;
  onHandlerChange?: (val: string) => void;
  availableHandlers?: { id: string; name: string; role?: string }[];
  isSessionRestored?: boolean;
}

export const LeadFilters: React.FC<LeadFiltersProps> = ({
  leads,
  searchQuery,
  onSearchChange,
  statusFilter,
  onStatusFilterChange,
  selectedYear,
  onYearChange,
  availableYears,
  selectedCity,
  onCityChange,
  availableCities,
  sortBy,
  onSortByChange,
  onResetFilters,
  hasActiveFilters,
  selectedHandler,
  onHandlerChange,
  availableHandlers,
  isSessionRestored,
}) => {
  const totalCount = leads?.length ?? 0;
  const integratedCount =
    leads?.filter((l) => Boolean(l.fileId || l.uploadedFileName || l.paymentReceipt || l.proof))
      .length ?? 0;
  const interestedCount = leads?.filter((l) => l.status === "Interested").length ?? 0;
  const requiresCount = leads?.filter((l) => l.status === "Requires Follow-up").length ?? 0;
  const pendingCount = leads?.filter((l) => l.status === "Pending Call").length ?? 0;
  const noAnswerCount = leads?.filter((l) => l.status === "No Answer").length ?? 0;
  const notInterestedCount = leads?.filter((l) => l.status === "Not Interested").length ?? 0;

  const statusTabs: {
    id: StatusFilter;
    label: string;
    count?: number;
    activeStyle: string;
    hoverStyle: string;
    badgeStyle: string;
  }[] = [
    {
      id: "all",
      label: "All Leads",
      count: totalCount,
      activeStyle:
        "bg-gradient-to-r from-slate-100 via-slate-50 to-indigo-50/50 border-slate-300 text-slate-900 ring-2 ring-slate-400/40 shadow-xs",
      hoverStyle:
        "hover:bg-slate-100/80 hover:text-slate-900 border-slate-200/80 text-slate-700 bg-white",
      badgeStyle: "bg-slate-200/70 text-slate-700",
    },
    {
      id: "Integrated",
      label: "Integrated",
      count: integratedCount,
      activeStyle:
        "bg-gradient-to-r from-sky-50 via-blue-50/70 to-indigo-50/30 border-sky-300 text-sky-950 ring-2 ring-sky-500/40 shadow-xs",
      hoverStyle:
        "hover:bg-sky-50/60 hover:text-sky-900 border-sky-200/70 text-sky-800 bg-sky-50/30",
      badgeStyle: "bg-sky-100 text-sky-800",
    },
    {
      id: "Interested",
      label: "Interested",
      count: interestedCount,
      activeStyle:
        "bg-gradient-to-r from-emerald-50 via-teal-50/70 to-slate-50 border-emerald-300 text-emerald-950 ring-2 ring-emerald-500/40 shadow-xs",
      hoverStyle:
        "hover:bg-emerald-50/60 hover:text-emerald-900 border-emerald-200/70 text-emerald-800 bg-emerald-50/30",
      badgeStyle: "bg-emerald-100 text-emerald-800",
    },
    {
      id: "Requires Follow-up",
      label: "Requires Follow-up",
      count: requiresCount,
      activeStyle:
        "bg-gradient-to-r from-rose-50 via-red-50/60 to-amber-50/30 border-rose-300 text-rose-950 ring-2 ring-rose-500/40 shadow-xs",
      hoverStyle:
        "hover:bg-rose-50/60 hover:text-rose-900 border-rose-200/70 text-rose-800 bg-rose-50/30",
      badgeStyle: "bg-rose-100 text-rose-800",
    },
    {
      id: "Pending Call",
      label: "Pending Call",
      count: pendingCount,
      activeStyle:
        "bg-gradient-to-r from-indigo-50 via-violet-50/60 to-slate-50 border-indigo-300 text-indigo-950 ring-2 ring-indigo-500/40 shadow-xs",
      hoverStyle:
        "hover:bg-indigo-50/60 hover:text-indigo-900 border-indigo-200/70 text-indigo-800 bg-indigo-50/30",
      badgeStyle: "bg-indigo-100 text-indigo-800",
    },
    {
      id: "No Answer",
      label: "No Answer",
      count: noAnswerCount,
      activeStyle:
        "bg-gradient-to-r from-slate-100 via-amber-50/40 to-slate-50 border-slate-300 text-slate-900 ring-2 ring-slate-400/40 shadow-xs",
      hoverStyle:
        "hover:bg-slate-100/80 hover:text-slate-900 border-slate-200/80 text-slate-700 bg-white",
      badgeStyle: "bg-slate-200/70 text-slate-700",
    },
    {
      id: "Not Interested",
      label: "Not Interested",
      count: notInterestedCount,
      activeStyle:
        "bg-gradient-to-r from-slate-100 via-zinc-100 to-slate-50 border-slate-300 text-slate-900 ring-2 ring-slate-400/40 shadow-xs",
      hoverStyle:
        "hover:bg-slate-100/80 hover:text-slate-900 border-slate-200/80 text-slate-700 bg-white",
      badgeStyle: "bg-slate-200/70 text-slate-700",
    },
  ];

  return (
    <div className="bg-white border border-slate-200/90 rounded-2xl p-5 shadow-xs space-y-3.5">
      {/* Top row: Search and Sort */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3">
        {/* Search bar with dedicated Search Button */}
        <div className="flex items-center gap-2 flex-1 min-w-[280px]">
          <div className="relative flex-1">
            <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
            <input
              id="input-lead-search"
              type="text"
              value={searchQuery}
              onChange={(e) => onSearchChange(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  const targetTable = document.getElementById("lead-records-table");
                  if (targetTable) {
                    targetTable.scrollIntoView({ behavior: "smooth", block: "nearest" });
                  }
                }
              }}
              placeholder="Search leads by client name, phone, email, city, month, receipt, notes..."
              className="w-full pl-9 pr-8 py-2 text-xs sm:text-sm bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none transition-all placeholder:text-slate-400 shadow-2xs"
            />
            {searchQuery ? (
              <button
                type="button"
                onClick={() => onSearchChange("")}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 p-0.5 cursor-pointer"
                title="Clear search"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            ) : (
              <kbd className="hidden sm:inline-block absolute right-2.5 top-1/2 -translate-y-1/2 px-1.5 py-0.5 text-[10px] font-mono font-semibold text-slate-400 bg-slate-200/60 border border-slate-300/70 rounded pointer-events-none">
                /
              </kbd>
            )}
          </div>
          <button
            id="btn-search-client"
            type="button"
            onClick={() => {
              const el = document.getElementById("input-lead-search") as HTMLInputElement;
              if (el) el.focus();
              const targetTable = document.getElementById("lead-records-table");
              if (targetTable) {
                targetTable.scrollIntoView({ behavior: "smooth", block: "nearest" });
              }
            }}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs sm:text-sm font-semibold rounded-xl bg-indigo-600 hover:bg-indigo-700 active:bg-indigo-800 text-white shadow-2xs transition-colors cursor-pointer shrink-0"
            title="Search client name in Main List"
          >
            <Search className="w-3.5 h-3.5" />
            <span>Search</span>
          </button>
        </div>

        {/* Sort selector */}
        <div className="flex items-center gap-2 shrink-0 text-xs">
          <span className="text-slate-500 font-medium">Sort by:</span>
          <select
            id="select-sort-by"
            value={sortBy}
            onChange={(e) => onSortByChange(e.target.value)}
            className="py-1.5 px-2.5 bg-slate-50 border border-slate-200 rounded-lg text-slate-700 font-medium focus:ring-2 focus:ring-indigo-500 focus:outline-none cursor-pointer"
          >
            <option value="default">Default Order</option>
            <option value="name-asc">Name (A → Z)</option>
            <option value="name-desc">Name (Z → A)</option>
            <option value="lost-period">Month / Period</option>
            <option value="status">Call Status</option>
            <option value="most-called">Most Dialed</option>
          </select>
        </div>
      </div>

      {/* Second row: Status Chips + Dropdown Filters */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pt-3 border-t border-slate-100">
        {/* Status tabs with subtle light gradients and tabular counts */}
        <div className="flex items-center flex-wrap gap-1.5">
          {statusTabs.map((tab) => {
            const isActive = statusFilter === tab.id;
            return (
              <button
                key={tab.id}
                id={`filter-tab-${(tab?.id || "").toLowerCase().replace(/\s+/g, "-")}`}
                type="button"
                onClick={() => onStatusFilterChange(tab.id)}
                className={`inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-lg border transition-all duration-150 cursor-pointer select-none ${
                  isActive ? tab.activeStyle : tab.hoverStyle
                }`}
              >
                <span>{tab.label}</span>
                {tab.count !== undefined && (
                  <span
                    className={`text-[10px] font-bold px-1.5 py-0.2 rounded tabular-nums ${
                      isActive ? "bg-white/90 text-slate-900 border border-slate-300/60 shadow-2xs" : tab.badgeStyle
                    }`}
                  >
                    {tab.count}
                  </span>
                )}
              </button>
            );
          })}
        </div>

        {/* Dropdowns for Year & City & Handler */}
        <div className="flex items-center flex-wrap gap-2 text-xs">
          {/* Lost Year filter */}
          <div className="flex items-center gap-1 bg-slate-50 px-2 py-1 rounded-lg border border-slate-200">
            <Calendar className="w-3.5 h-3.5 text-slate-400" />
            <select
              id="select-filter-year"
              value={selectedYear}
              onChange={(e) => onYearChange(e.target.value)}
              className="bg-transparent text-slate-700 font-medium focus:outline-none cursor-pointer"
            >
              <option value="all">All Months</option>
              {availableYears.map((yr) => (
                <option key={yr} value={yr}>
                  {yr}
                </option>
              ))}
            </select>
          </div>

          {/* City filter */}
          <div className="flex items-center gap-1 bg-slate-50 px-2 py-1 rounded-lg border border-slate-200">
            <MapPin className="w-3.5 h-3.5 text-slate-400" />
            <select
              id="select-filter-city"
              value={selectedCity}
              onChange={(e) => onCityChange(e.target.value)}
              className="bg-transparent text-slate-700 font-medium focus:outline-none cursor-pointer"
            >
              <option value="all">All Cities</option>
              {availableCities.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>
          </div>

          {/* Handler filter (from settings) */}
          {availableHandlers && availableHandlers.length > 0 && onHandlerChange && (
            <div className="flex items-center gap-1 bg-slate-50 px-2 py-1 rounded-lg border border-slate-200">
              <Users className="w-3.5 h-3.5 text-indigo-600" />
              <select
                id="select-filter-handler"
                value={selectedHandler || "all"}
                onChange={(e) => onHandlerChange(e.target.value)}
                className="bg-transparent text-slate-800 font-semibold focus:outline-none cursor-pointer"
              >
                <option value="all">All Handlers</option>
                {availableHandlers.map((h) => (
                  <option key={h.id} value={h.name}>
                    {h.name} {h.role ? `(${h.role})` : ""}
                  </option>
                ))}
              </select>
            </div>
          )}

          {isSessionRestored && (
            <span
              id="badge-session-restored"
              className="inline-flex items-center gap-1 px-2 py-1 text-xs font-semibold text-emerald-700 bg-emerald-50 border border-emerald-200/90 rounded-lg shadow-2xs select-none"
              title="Workspace filters, active tab, and search were restored from your previous work session"
            >
              <BookmarkCheck className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
              <span>Session Restored</span>
            </span>
          )}

          {hasActiveFilters && (
            <button
              id="btn-reset-filters"
              type="button"
              onClick={onResetFilters}
              className="inline-flex items-center gap-1 px-2.5 py-1 text-xs text-red-600 hover:text-red-700 hover:bg-red-50 rounded-lg transition-colors cursor-pointer"
            >
              <X className="w-3.5 h-3.5" />
              Reset Filters
            </button>
          )}
        </div>
      </div>
    </div>
  );
};
