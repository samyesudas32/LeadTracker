import React from "react";
import {
  Users,
  AlertCircle,
  CheckCircle2,
  PhoneCall,
  Clock,
  ArrowRight,
  TrendingUp,
  UserCheck,
} from "lucide-react";
import { Lead, HandlerRecord } from "../../types";

export interface MobileWorkloadTabProps {
  leads: Lead[];
  handlers: HandlerRecord[];
  onSelectHandlerFilter: (handlerName: string) => void;
}

export const MobileWorkloadTab: React.FC<MobileWorkloadTabProps> = ({
  leads,
  handlers,
  onSelectHandlerFilter,
}) => {
  const totalLeads = leads.length;

  const unassignedLeads = leads.filter(
    (l) =>
      !l.handlerName ||
      l.handlerName.trim() === "" ||
      l.handlerName.toLowerCase() === "unassigned" ||
      l.handlerName.toLowerCase() === "none"
  );

  const assignedLeads = leads.filter(
    (l) =>
      l.handlerName &&
      l.handlerName.trim() !== "" &&
      l.handlerName.toLowerCase() !== "unassigned" &&
      l.handlerName.toLowerCase() !== "none"
  );

  const totalCalls = leads.reduce((acc, l) => acc + (l.callCount || 0), 0);

  // Group by clean handler name
  const handlerStats = handlers.map((h) => {
    const handlerLeads = leads.filter(
      (l) => l.handlerName && l.handlerName.toLowerCase() === h.name.toLowerCase()
    );
    const attended = handlerLeads.filter(
      (l) => l.status === "Interested" || l.status === "Requires Follow-up"
    ).length;
    const calls = handlerLeads.reduce((acc, l) => acc + (l.callCount || 0), 0);
    const capacityPercent = totalLeads > 0 ? Math.round((handlerLeads.length / totalLeads) * 100) : 0;

    return {
      handler: h,
      leadCount: handlerLeads.length,
      attendedCount: attended,
      callsCount: calls,
      capacityPercent,
    };
  });

  return (
    <div className="space-y-4">
      {/* Overview Stat Cards */}
      <div className="grid grid-cols-2 gap-3">
        <div className="bg-white dark:bg-slate-900 rounded-2xl p-4 border border-slate-200/90 dark:border-slate-800 shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-500 dark:text-slate-400">
              Total Ingested
            </span>
            <Users className="w-4 h-4 text-indigo-600 dark:text-indigo-400" />
          </div>
          <div className="text-2xl font-extrabold text-slate-900 dark:text-slate-100 mt-2">
            {totalLeads}
          </div>
          <div className="text-[11px] text-slate-500 mt-0.5">
            {assignedLeads.length} assigned · {unassignedLeads.length} in queue
          </div>
        </div>

        <div className="bg-white dark:bg-slate-900 rounded-2xl p-4 border border-slate-200/90 dark:border-slate-800 shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-500 dark:text-slate-400">
              Total Dials
            </span>
            <PhoneCall className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
          </div>
          <div className="text-2xl font-extrabold text-emerald-600 dark:text-emerald-400 mt-2">
            {totalCalls}
          </div>
          <div className="text-[11px] text-slate-500 mt-0.5">
            Active outreach activity
          </div>
        </div>
      </div>

      {/* Unassigned Warning Alert if leads are pending */}
      {unassignedLeads.length > 0 && (
        <div className="bg-amber-50 dark:bg-amber-950/40 rounded-2xl p-4 border border-amber-200 dark:border-amber-800/60 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-amber-100 dark:bg-amber-900/60 text-amber-700 dark:text-amber-300 flex items-center justify-center shrink-0">
              <AlertCircle className="w-5 h-5" />
            </div>
            <div>
              <h4 className="text-xs font-bold text-amber-950 dark:text-amber-200">
                {unassignedLeads.length} Unallocated Leads
              </h4>
              <p className="text-[11px] text-amber-700 dark:text-amber-400 mt-0.5">
                Waiting to be assigned to specialists
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={() => onSelectHandlerFilter("Unassigned")}
            className="min-h-[44px] px-3.5 rounded-xl bg-amber-600 hover:bg-amber-700 active:scale-95 text-white font-bold text-xs shadow-xs transition-all cursor-pointer inline-flex items-center gap-1"
          >
            <span>Assign</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

      {/* Team Specialist Workload Cards */}
      <div className="bg-white dark:bg-slate-900 rounded-2xl p-4 border border-slate-200 dark:border-slate-800 shadow-sm space-y-3">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-bold text-slate-900 dark:text-slate-100 flex items-center gap-2">
            <UserCheck className="w-4 h-4 text-indigo-600 dark:text-indigo-400" />
            Specialist Allocation & Load
          </h3>
          <span className="text-xs font-semibold text-slate-500">
            {handlers.length} Members
          </span>
        </div>

        <div className="space-y-2.5">
          {handlerStats.map((stat) => (
            <div
              key={stat.handler.id}
              onClick={() => onSelectHandlerFilter(stat.handler.name)}
              className="p-3.5 rounded-xl bg-slate-50 dark:bg-slate-800/70 border border-slate-200/80 dark:border-slate-700 hover:border-indigo-400 cursor-pointer active:scale-[0.99] transition-all"
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2.5">
                  <div className="w-8 h-8 rounded-full bg-indigo-100 dark:bg-indigo-950 text-indigo-700 dark:text-indigo-300 font-bold text-xs flex items-center justify-center">
                    {stat.handler.name.slice(0, 2).toUpperCase()}
                  </div>
                  <div>
                    <h4 className="text-xs font-bold text-slate-900 dark:text-slate-100">
                      {stat.handler.name}
                    </h4>
                    <span className="text-[11px] text-slate-500 dark:text-slate-400">
                      {stat.leadCount} leads assigned · {stat.callsCount} calls
                    </span>
                  </div>
                </div>

                <div className="text-right">
                  <span className="text-sm font-black text-indigo-600 dark:text-indigo-400">
                    {stat.leadCount}
                  </span>
                  <span className="text-[10px] text-slate-400 block">
                    {stat.capacityPercent}% share
                  </span>
                </div>
              </div>

              {/* Progress Bar */}
              <div className="w-full bg-slate-200 dark:bg-slate-700 h-1.5 rounded-full overflow-hidden mt-2.5">
                <div
                  className="bg-indigo-600 dark:bg-indigo-500 h-full rounded-full transition-all duration-300"
                  style={{ width: `${Math.min(100, Math.max(5, stat.capacityPercent))}%` }}
                />
              </div>
            </div>
          ))}

          {handlerStats.length === 0 && (
            <div className="text-center py-6 text-xs text-slate-500">
              No team specialists configured yet.
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
