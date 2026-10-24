import React, { useState } from "react";
import {
  Users,
  UserCheck,
  UserX,
  Calendar,
  Clock,
  ArrowRight,
  Sparkles,
  CheckCircle2,
  AlertCircle,
  Plus,
  Filter,
  PhoneCall,
  X,
  ChevronRight,
  ChevronDown,
  DivideSquare,
  Download,
} from "lucide-react";
import { Lead, HandlerRecord, CallStatus } from "../types";
import { getLocalDateString, formatUploadDayLabel, getReportDateForTimestamp } from "../utils/dateUtils";
import { getHandlerColorClasses } from "../data/handlerDefaults";
import { isLeadAssignedToHandler, getLeadHandlerName } from "../utils/pdfGenerator";

interface TodayHandlersWorkloadProps {
  leads: Lead[];
  handlers: HandlerRecord[];
  activeHandlerFilter: string;
  onSelectHandlerFilter: (handlerName: string) => void;
  onAssignUnassignedToHandler: (handlerName: string, handlerId?: string, count?: number) => void;
  onAutoDistributeUnassigned: () => void;
  onSwitchToUnassignedTab: () => void;
  activeWorkspaceTab: string;
  onOpenPdfReport?: (dateStr?: string, fileId?: string, handlerName?: string) => void;
}

export const TodayHandlersWorkload: React.FC<TodayHandlersWorkloadProps> = ({
  leads,
  handlers,
  activeHandlerFilter,
  onSelectHandlerFilter,
  onAssignUnassignedToHandler,
  onAutoDistributeUnassigned,
  onSwitchToUnassignedTab,
  activeWorkspaceTab,
  onOpenPdfReport,
}) => {
  const [selectedQuickCount, setSelectedQuickCount] = useState<Record<string, number>>({});
  const [showAssignSuccess, setShowAssignSuccess] = useState<string | null>(null);

  // Collapse / Expand state (persisted to localStorage)
  const [isExpanded, setIsExpanded] = useState<boolean>(() => {
    try {
      const saved = localStorage.getItem("today_workload_expanded_state");
      if (saved !== null) {
        return JSON.parse(saved);
      }
    } catch {
      // ignore
    }
    return true;
  });

  const handleToggleExpand = () => {
    setIsExpanded((prev) => {
      const next = !prev;
      try {
        localStorage.setItem("today_workload_expanded_state", JSON.stringify(next));
      } catch {
        // ignore
      }
      return next;
    });
  };

  const todayStr = getLocalDateString(0);
  const todayLabel = formatUploadDayLabel(todayStr);

  // Filter tasks that belong to today (assigned today or uploaded today)
  const todayLeads = leads.filter((l) => {
    if (l.reportDate === todayStr) return true;
    if (l.assignedAt && getReportDateForTimestamp(l.assignedAt) === todayStr) return true;
    if (l.uploadDate === todayStr) return true;
    if (l.createdAt && getReportDateForTimestamp(l.createdAt) === todayStr) return true;
    return false;
  });

  // Total unassigned tasks (today and overall)
  const unassignedTodayLeads = todayLeads.filter(
    (l) => !isLeadAssignedToHandler(l, handlers)
  );
  const totalUnassignedLeads = leads.filter(
    (l) => !isLeadAssignedToHandler(l, handlers)
  );

  // Calculate workload per handler
  interface HandlerWorkload {
    handler: HandlerRecord;
    todayTasks: Lead[];
    totalTasks: Lead[];
    statusBreakdown: Record<string, number>;
    hasTasksToday: boolean;
  }

  const workloads: HandlerWorkload[] = handlers.map((h) => {
    const handlerTodayTasks = todayLeads.filter(
      (l) =>
        isLeadAssignedToHandler(l, handlers) &&
        ((getLeadHandlerName(l, handlers).toLowerCase() === h.name.toLowerCase()) ||
          (l.handlerId && l.handlerId === h.id))
    );

    const handlerTotalTasks = leads.filter(
      (l) =>
        isLeadAssignedToHandler(l, handlers) &&
        ((getLeadHandlerName(l, handlers).toLowerCase() === h.name.toLowerCase()) ||
          (l.handlerId && l.handlerId === h.id))
    );

    const breakdown: Record<string, number> = {
      Interested: 0,
      "Requires Follow-up": 0,
      "Pending Call": 0,
      "No Answer": 0,
      "Not Interested": 0,
    };

    handlerTodayTasks.forEach((l) => {
      if (breakdown[l.status] !== undefined) {
        breakdown[l.status]++;
      }
    });

    return {
      handler: h,
      todayTasks: handlerTodayTasks,
      totalTasks: handlerTotalTasks,
      statusBreakdown: breakdown,
      hasTasksToday: handlerTodayTasks.length > 0,
    };
  });

  // Separate handlers who have assigned tasks today vs those who haven't
  const handlersWithTasksToday = workloads.filter((w) => w.hasTasksToday);
  const handlersWithoutTasksToday = workloads.filter((w) => !w.hasTasksToday);

  const handleQuickAssign = (handler: HandlerRecord, count?: number) => {
    const targetCount = count || selectedQuickCount[handler.id] || 3;
    onAssignUnassignedToHandler(handler.name, handler.id, targetCount);
    setShowAssignSuccess(
      `Assigned ${Math.min(targetCount, totalUnassignedLeads.length)} task(s) to ${handler.name}`
    );
    setTimeout(() => setShowAssignSuccess(null), 3500);
  };

  return (
    <div
      id="section-today-handlers-workload"
      className="bg-white border border-slate-200/90 rounded-2xl shadow-xs overflow-hidden transition-all"
    >
      {/* Top Banner & Header */}
      <div
        onClick={handleToggleExpand}
        className="px-6 py-4 border-b border-slate-100 bg-white cursor-pointer hover:bg-slate-50/60 transition-colors select-none"
      >
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-xl bg-indigo-50 text-indigo-600 border border-indigo-100 shadow-2xs">
              <Users className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center flex-wrap gap-2">
                <h2 className="text-base font-bold text-slate-900">
                  Today's Handler Workload Allocation
                </h2>
                <span className="inline-flex items-center gap-1 text-xs font-semibold px-2.5 py-0.5 rounded-md bg-slate-100 text-slate-700 border border-slate-200">
                  <Calendar className="w-3 h-3 text-slate-500" />
                  {todayLabel.subLabel} (Today)
                </span>
                {activeHandlerFilter !== "all" && (
                  <span className="inline-flex items-center gap-1 text-xs font-semibold px-2 py-0.5 rounded-md bg-indigo-50 text-indigo-700 border border-indigo-200">
                    Filtered by: {activeHandlerFilter}
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        onSelectHandlerFilter("all");
                      }}
                      className="text-indigo-600 hover:text-indigo-900 cursor-pointer ml-0.5"
                      title="Clear handler filter"
                    >
                      <X className="w-3 h-3" />
                    </button>
                  </span>
                )}
              </div>
              <p className="text-xs text-slate-500 mt-0.5">
                Staff workload allocation for today: assigned specialists vs available handlers
              </p>
            </div>
          </div>

          {/* Quick Metrics Chips & Collapse/Expand Toggle */}
          <div
            className="flex items-center flex-wrap gap-2 text-xs"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-50 border border-slate-200 text-slate-700 font-medium">
              <UserCheck className="w-3.5 h-3.5 text-indigo-600" />
              <span>
                <strong className="font-bold text-slate-900 tabular-nums">{handlersWithTasksToday.length}</strong> Assigned Today
              </span>
            </div>
            <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-50 border border-slate-200 text-slate-700 font-medium">
              <UserX className="w-3.5 h-3.5 text-slate-500" />
              <span>
                <strong className="font-bold text-slate-900 tabular-nums">{handlersWithoutTasksToday.length}</strong> Free Today
              </span>
            </div>
            <button
              type="button"
              id="btn-goto-unassigned-tab-badge"
              onClick={onSwitchToUnassignedTab}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl border font-semibold cursor-pointer transition-all ${
                totalUnassignedLeads.length > 0
                  ? "bg-amber-500 text-white border-amber-600 hover:bg-amber-600 shadow-xs"
                  : "bg-slate-100 text-slate-600 border-slate-200 hover:bg-slate-200"
              }`}
              title="Open dedicated Unassigned Tasks tab"
            >
              <AlertCircle className="w-3.5 h-3.5" />
              <span className="tabular-nums">{totalUnassignedLeads.length} Unassigned Tasks</span>
            </button>

            {/* Collapse / Expand Toggle Button */}
            <button
              type="button"
              id="btn-toggle-workload-expand"
              onClick={handleToggleExpand}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-slate-700 hover:text-indigo-600 bg-white hover:bg-slate-50 border border-slate-200 rounded-xl transition-all cursor-pointer shadow-2xs"
              title={
                isExpanded
                  ? "Collapse Today's Handler Workload section"
                  : "Expand Today's Handler Workload section"
              }
              aria-expanded={isExpanded}
            >
              <span>{isExpanded ? "Collapse" : "Expand"}</span>
              <ChevronDown
                className={`w-3.5 h-3.5 text-slate-500 transition-transform duration-200 ${
                  isExpanded ? "rotate-180" : ""
                }`}
              />
            </button>
          </div>
        </div>
      </div>

      {/* Assignment Success Flash Toast */}
      {showAssignSuccess && (
        <div className="bg-slate-900 text-white px-6 py-2.5 text-xs font-medium flex items-center justify-between animate-in fade-in">
          <span className="flex items-center gap-1.5">
            <CheckCircle2 className="w-4 h-4 text-emerald-400" />
            {showAssignSuccess}
          </span>
          <button
            type="button"
            onClick={() => setShowAssignSuccess(null)}
            className="text-slate-400 hover:text-white cursor-pointer"
          >
            ✕
          </button>
        </div>
      )}

      {/* Collapsed Status Summary Hint */}
      {!isExpanded && (
        <div
          onClick={handleToggleExpand}
          className="px-6 py-2.5 bg-slate-50/60 hover:bg-slate-100/60 border-t border-slate-100 flex items-center justify-between text-xs text-slate-500 cursor-pointer transition-colors"
        >
          <span>
            Showing overview ({handlersWithTasksToday.length} active, {handlersWithoutTasksToday.length} available) • Grid collapsed
          </span>
          <span className="text-indigo-600 font-semibold flex items-center gap-1 hover:underline">
            Click to Expand Full Breakdown ↓
          </span>
        </div>
      )}

      {/* Main Two-Section Grid: Handlers WITH tasks today vs Handlers WITHOUT tasks today */}
      {isExpanded && (
        <>
          <div className="p-6 grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* ============================================================== */}
        {/* SECTION 1: Handlers who HAVE assigned tasks today             */}
        {/* ============================================================== */}
        <div className="space-y-3">
          <div className="flex items-center justify-between pb-2 border-b border-slate-100">
            <div className="flex items-center gap-2">
              <span className="flex h-2.5 w-2.5 rounded-full bg-indigo-600"></span>
              <h3 className="text-sm font-bold text-slate-900 flex items-center gap-1.5">
                Handlers With Assigned Tasks Today
                <span className="px-2 py-0.5 text-xs rounded-full bg-slate-100 text-slate-700 font-bold tabular-nums">
                  {handlersWithTasksToday.length}
                </span>
              </h3>
            </div>
            <span className="text-[11px] text-slate-500 font-medium">
              Actively Assigned
            </span>
          </div>

          {handlersWithTasksToday.length === 0 ? (
            <div className="p-6 rounded-xl border border-dashed border-slate-200 bg-slate-50/50 text-center text-xs text-slate-500">
              <UserX className="w-8 h-8 text-slate-300 mx-auto mb-2" />
              <p className="font-semibold text-slate-700">No handlers have tasks assigned for today yet.</p>
              <p className="mt-1 text-slate-400">
                Upload an Excel sheet or assign tasks to handlers from the unassigned list.
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {handlersWithTasksToday.map(({ handler, todayTasks, statusBreakdown }) => {
                const colorClasses = getHandlerColorClasses(handler.color);
                const isFiltered = Boolean(
                  activeHandlerFilter &&
                    handler?.name &&
                    activeHandlerFilter.toLowerCase() === handler.name.toLowerCase()
                );
                const hasStatusBreakdown =
                  statusBreakdown["Interested"] > 0 ||
                  statusBreakdown["Requires Follow-up"] > 0 ||
                  statusBreakdown["Pending Call"] > 0 ||
                  statusBreakdown["No Answer"] > 0;

                return (
                  <div
                    key={handler.id}
                    id={`handler-card-active-${handler.id}`}
                    className={`relative p-4 rounded-xl border transition-all flex flex-col justify-between ${
                      isFiltered
                        ? "border-indigo-600 bg-indigo-50/40 shadow-xs ring-2 ring-indigo-400/30"
                        : "border-slate-200/90 bg-white hover:border-slate-300 hover:shadow-xs"
                    }`}
                  >
                    <div>
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex items-center gap-2.5">
                          <div
                            className="w-9 h-9 rounded-xl flex items-center justify-center font-bold text-sm text-indigo-700 bg-indigo-50 border border-indigo-100 shadow-2xs"
                          >
                            {handler.name ? handler.name.charAt(0).toUpperCase() : "H"}
                          </div>
                          <div>
                            <div className="flex items-center gap-1.5">
                              <span className="font-bold text-slate-900 text-sm">
                                {handler.name}
                              </span>
                              {handler.isDefault && (
                                <span className="text-[10px] px-1.5 py-0.5 rounded bg-slate-100 text-slate-600 font-medium">
                                  Default
                                </span>
                              )}
                            </div>
                            <span className="text-[11px] text-slate-500 block truncate max-w-[130px]">
                              {handler.role || "Lead Specialist"}
                            </span>
                          </div>
                        </div>

                        {/* Today Task Count Badge */}
                        <div className="text-right">
                          <span className="inline-flex items-center px-2 py-0.5 rounded-md text-xs font-bold bg-slate-100 text-slate-800 border border-slate-200 tabular-nums">
                            {todayTasks.length} {todayTasks.length === 1 ? "task" : "tasks"}
                          </span>
                          <span className="text-[10px] text-slate-400 block mt-0.5">today</span>
                        </div>
                      </div>

                      {/* Status Breakdown Pills with guaranteed min-height */}
                      <div className="mt-3 pt-2.5 border-t border-slate-100 flex items-center flex-wrap gap-1 text-[10px] min-h-[30px]">
                        {hasStatusBreakdown ? (
                          <>
                            {statusBreakdown["Interested"] > 0 && (
                              <span className="px-1.5 py-0.5 rounded bg-slate-100 text-slate-700 border border-slate-200 font-medium tabular-nums">
                                {statusBreakdown["Interested"]} Interested
                              </span>
                            )}
                            {statusBreakdown["Requires Follow-up"] > 0 && (
                              <span className="px-1.5 py-0.5 rounded bg-slate-100 text-slate-700 border border-slate-200 font-medium tabular-nums">
                                {statusBreakdown["Requires Follow-up"]} Follow-up
                              </span>
                            )}
                            {statusBreakdown["Pending Call"] > 0 && (
                              <span className="px-1.5 py-0.5 rounded bg-slate-100 text-slate-700 border border-slate-200 font-medium tabular-nums">
                                {statusBreakdown["Pending Call"]} Pending
                              </span>
                            )}
                            {statusBreakdown["No Answer"] > 0 && (
                              <span className="px-1.5 py-0.5 rounded bg-slate-100 text-slate-700 border border-slate-200 font-medium tabular-nums">
                                {statusBreakdown["No Answer"]} No Answer
                              </span>
                            )}
                          </>
                        ) : (
                          <span className="text-[11px] text-slate-400 italic">No calls logged yet today</span>
                        )}
                      </div>
                    </div>

                    {/* Action buttons to filter tasks and download assigned PDF */}
                    <div className="mt-3 pt-1 flex items-center gap-1.5">
                      <button
                        type="button"
                        id={`btn-filter-handler-${(handler?.name || handler?.id || "").toLowerCase()}`}
                        onClick={() =>
                          onSelectHandlerFilter(isFiltered ? "all" : (handler?.name || "all"))
                        }
                        className={`flex-1 py-1.5 px-2 rounded-lg text-xs font-semibold flex items-center justify-center gap-1 cursor-pointer transition-colors ${
                          isFiltered
                            ? "bg-indigo-600 text-white hover:bg-indigo-700"
                            : "bg-slate-100 hover:bg-slate-200 text-slate-700"
                        }`}
                      >
                        <Filter className="w-3 h-3" />
                        {isFiltered ? "Clear Filter" : `View Tasks`}
                      </button>

                      {onOpenPdfReport && (
                        <button
                          type="button"
                          id={`btn-pdf-handler-${(handler?.name || "").toLowerCase()}`}
                          onClick={() => onOpenPdfReport(todayStr, undefined, handler.name)}
                          className="py-1.5 px-2.5 rounded-lg text-xs font-bold bg-indigo-50 hover:bg-indigo-100 text-indigo-700 border border-indigo-200 flex items-center justify-center gap-1 cursor-pointer transition-colors shadow-2xs shrink-0"
                          title={`Download ${handler.name}'s assigned leads PDF report for today`}
                        >
                          <Download className="w-3 h-3 text-indigo-600" />
                          <span>PDF</span>
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* ============================================================== */}
        {/* SECTION 2: Handlers who DO NOT have assigned tasks today       */}
        {/* ============================================================== */}
        <div className="space-y-3">
          <div className="flex items-center justify-between pb-2 border-b border-slate-100">
            <div className="flex items-center gap-2">
              <span className="flex h-2.5 w-2.5 rounded-full bg-slate-400"></span>
              <h3 className="text-sm font-bold text-slate-900 flex items-center gap-1.5">
                Handlers Without Assigned Tasks Today
                <span className="px-2 py-0.5 text-xs rounded-full bg-slate-100 text-slate-700 font-bold tabular-nums">
                  {handlersWithoutTasksToday.length}
                </span>
              </h3>
            </div>
            <span className="text-[11px] text-slate-500 font-medium">
              Available & Free
            </span>
          </div>

          {handlersWithoutTasksToday.length === 0 ? (
            <div className="p-6 rounded-xl border border-dashed border-slate-200 bg-slate-50/50 text-center text-xs text-slate-700">
              <CheckCircle2 className="w-8 h-8 text-indigo-600 mx-auto mb-2" />
              <p className="font-semibold text-slate-900">All registered handlers have tasks assigned for today!</p>
              <p className="mt-1 text-slate-500">
                Workload is currently distributed across all staff members.
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {handlersWithoutTasksToday.map(({ handler, totalTasks }) => {
                const hasUnassigned = totalUnassignedLeads.length > 0;

                return (
                  <div
                    key={handler.id}
                    id={`handler-card-free-${handler.id}`}
                    className="p-4 rounded-xl border border-slate-200 bg-white hover:border-slate-300 transition-all shadow-2xs flex flex-col justify-between"
                  >
                    <div>
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex items-center gap-2.5">
                          <div
                            className="w-9 h-9 rounded-xl flex items-center justify-center font-bold text-sm text-slate-700 bg-slate-100 border border-slate-200 shadow-2xs"
                          >
                            {handler.name.charAt(0).toUpperCase()}
                          </div>
                          <div>
                            <div className="flex items-center gap-1.5">
                              <span className="font-bold text-slate-900 text-sm">
                                {handler.name}
                              </span>
                            </div>
                            <span className="text-[11px] text-slate-500 block truncate max-w-[130px]">
                              {handler.role || "Lead Specialist"}
                            </span>
                          </div>
                        </div>

                        {/* 0 tasks badge */}
                        <div className="text-right">
                          <span className="inline-flex items-center px-2 py-0.5 rounded-md text-xs font-medium bg-slate-100 text-slate-700 border border-slate-200 tabular-nums">
                            0 tasks today
                          </span>
                          <span className="text-[10px] text-indigo-600 font-medium block mt-0.5">
                            Available
                          </span>
                        </div>
                      </div>

                      <div className="mt-3 pt-2.5 border-t border-slate-100 text-[11px] text-slate-500 flex items-center justify-between min-h-[30px]">
                        <span className="tabular-nums">Total all-time: {totalTasks.length}</span>
                        <span className="text-slate-600 font-medium">Ready for allocation</span>
                      </div>
                    </div>

                    {/* Quick Assign Action */}
                    <div className="mt-3 pt-1 flex items-center gap-1.5">
                      <button
                        type="button"
                        id={`btn-quick-assign-handler-${(handler?.name || handler?.id || "").toLowerCase()}`}
                        onClick={() => handleQuickAssign(handler, 3)}
                        disabled={!hasUnassigned}
                        className="flex-1 py-1.5 px-2 rounded-lg text-xs font-semibold bg-indigo-600 hover:bg-indigo-700 text-white disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-1 cursor-pointer transition-colors shadow-2xs"
                        title={
                          hasUnassigned
                            ? `Assign next 3 unassigned tasks to ${handler.name}`
                            : "No unassigned tasks currently available to assign"
                        }
                      >
                        <Plus className="w-3 h-3" />
                        Assign 3 Tasks
                      </button>

                      <button
                        type="button"
                        id={`btn-assign-all-handler-${(handler?.name || handler?.id || "").toLowerCase()}`}
                        onClick={() => handleQuickAssign(handler, totalUnassignedLeads.length)}
                        disabled={!hasUnassigned}
                        className="py-1.5 px-2 rounded-lg text-xs font-semibold bg-slate-100 hover:bg-slate-200 text-slate-700 disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer transition-colors"
                        title={`Assign all ${totalUnassignedLeads.length} unassigned tasks to ${handler.name}`}
                      >
                        All ({totalUnassignedLeads.length})
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* Bottom Distribution Action Bar */}
      {totalUnassignedLeads.length > 0 && (
        <div className="px-5 py-3 border-t border-slate-100 bg-amber-50/50 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs">
          <div className="flex items-center gap-2 text-amber-900 font-medium">
            <AlertCircle className="w-4 h-4 text-amber-600 shrink-0" />
            <span>
              <strong>{totalUnassignedLeads.length} unassigned task(s)</strong> available for distribution
              {unassignedTodayLeads.length > 0 && ` (${unassignedTodayLeads.length} from today's uploads)`}.
            </span>
          </div>

          <div className="flex items-center flex-wrap gap-2">
            {handlersWithoutTasksToday.length > 0 && (
              <button
                type="button"
                id="btn-auto-distribute-workload"
                onClick={onAutoDistributeUnassigned}
                className="px-3 py-1.5 rounded-lg bg-amber-600 hover:bg-amber-700 text-white font-semibold flex items-center gap-1 cursor-pointer transition-colors shadow-xs"
              >
                <Sparkles className="w-3.5 h-3.5" />
                Distribute Evenly to Free Handlers
              </button>
            )}

            <button
              type="button"
              id="btn-open-dedicated-unassigned-tab"
              onClick={onSwitchToUnassignedTab}
              className="px-3 py-1.5 rounded-lg bg-white hover:bg-slate-50 border border-slate-300 text-slate-800 font-semibold flex items-center gap-1 cursor-pointer transition-colors"
            >
              Open "Unassigned Tasks" Tab
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      )}
    </>
  )}
</div>
  );
};
