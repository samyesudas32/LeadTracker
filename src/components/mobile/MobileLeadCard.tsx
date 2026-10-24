import React, { useState } from "react";
import {
  Phone,
  Mail,
  MapPin,
  ChevronDown,
  ChevronUp,
  UserCheck,
  User,
  Clock,
  Edit2,
  Trash2,
  CheckCircle2,
  FileSpreadsheet,
  Save,
  CreditCard,
  Calendar,
} from "lucide-react";
import { Lead, HandlerRecord, CallStatus, CompletionStatus, PaymentMethod } from "../../types";

export interface MobileLeadCardProps {
  lead: Lead;
  handlers: HandlerRecord[];
  onUpdateHandler: (leadId: string, newHandlerName: string, newHandlerId?: string) => void;
  onUpdateStatus: (leadId: string, newStatus: CallStatus) => void;
  onUpdateNotes: (leadId: string, notes: string) => void;
  onOpenCallLog?: (lead: Lead) => void;
  onEditLead?: (lead: Lead) => void;
  onDeleteLead?: (lead: Lead) => void;
  onSelectHandlerSheet?: (lead: Lead) => void;
  onSelectStatusSheet?: (lead: Lead) => void;
  canEdit?: boolean;
  onUpdatePaymentDate?: (leadId: string, paymentDate: string) => void;
  onUpdatePaymentMethod?: (leadId: string, paymentMethod: string) => void;
  onUpdateCompletionStatus?: (leadId: string, completionStatus: CompletionStatus) => void;
}

const STATUS_COLORS: Record<CallStatus, { bg: string; text: string; dot: string }> = {
  Interested: {
    bg: "bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300 border-emerald-200 dark:border-emerald-800",
    text: "text-emerald-700 dark:text-emerald-300",
    dot: "bg-emerald-500",
  },
  "Requires Follow-up": {
    bg: "bg-amber-50 dark:bg-amber-950/40 text-amber-700 dark:text-amber-300 border-amber-200 dark:border-amber-800",
    text: "text-amber-700 dark:text-amber-300",
    dot: "bg-amber-500",
  },
  "Pending Call": {
    bg: "bg-blue-50 dark:bg-blue-950/40 text-blue-700 dark:text-blue-300 border-blue-200 dark:border-blue-800",
    text: "text-blue-700 dark:text-blue-300",
    dot: "bg-blue-500",
  },
  "No Answer": {
    bg: "bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border-slate-200 dark:border-slate-700",
    text: "text-slate-700 dark:text-slate-300",
    dot: "bg-slate-400",
  },
  "Not Interested": {
    bg: "bg-rose-50 dark:bg-rose-950/40 text-rose-700 dark:text-rose-300 border-rose-200 dark:border-rose-800",
    text: "text-rose-700 dark:text-rose-300",
    dot: "bg-rose-500",
  },
};

export const MobileLeadCard: React.FC<MobileLeadCardProps> = ({
  lead,
  handlers,
  onUpdateHandler: _onUpdateHandler,
  onUpdateStatus: _onUpdateStatus,
  onUpdateNotes,
  onOpenCallLog,
  onEditLead,
  onDeleteLead,
  onSelectHandlerSheet,
  onSelectStatusSheet,
  canEdit = true,
  onUpdatePaymentDate,
  onUpdatePaymentMethod,
  onUpdateCompletionStatus,
}) => {
  const [isExpanded, setIsExpanded] = useState(false);
  const [manualNoteText, setManualNoteText] = useState(lead.manualNotes || "");
  const [isNoteSaved, setIsNoteSaved] = useState(false);

  // Check assignment
  const isAssigned = Boolean(
    lead.handlerName &&
      lead.handlerName.trim() !== "" &&
      lead.handlerName.toLowerCase() !== "unassigned" &&
      lead.handlerName.toLowerCase() !== "none" &&
      lead.handlerName.toLowerCase() !== "not assigned"
  );

  const cleanHandlerName = isAssigned ? lead.handlerName!.trim() : "Unassigned";

  const statusConfig = STATUS_COLORS[lead.status] || STATUS_COLORS["Pending Call"];

  const handleSaveNotes = () => {
    onUpdateNotes(lead.id, manualNoteText);
    setIsNoteSaved(true);
    setTimeout(() => setIsNoteSaved(false), 2000);
  };

  return (
    <div
      id={`mobile-lead-card-${lead.id}`}
      className="bg-white dark:bg-slate-900 rounded-2xl p-4 shadow-sm border border-slate-200/90 dark:border-slate-800 transition-all hover:shadow-md"
    >
      {/* Top Row: Lead Name & 1-Tap Calling CTA */}
      <div className="flex items-start justify-between gap-3">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <h4 className="text-base font-bold text-slate-900 dark:text-slate-100 truncate tracking-tight">
              {lead.fullName || "Unnamed Lead"}
            </h4>
            {lead.callCount && lead.callCount > 0 ? (
              <span className="text-[11px] font-semibold text-slate-500 dark:text-slate-400">
                · {lead.callCount} {lead.callCount === 1 ? "call" : "calls"}
              </span>
            ) : null}
          </div>

          <div className="flex items-center gap-2 text-xs text-slate-500 dark:text-slate-400 mt-0.5 truncate">
            {lead.city && (
              <span className="inline-flex items-center gap-1 shrink-0">
                <MapPin className="w-3 h-3 text-slate-400" />
                {lead.city}
              </span>
            )}
            {lead.city && lead.uploadedFileName && <span>·</span>}
            {lead.uploadedFileName && (
              <span className="inline-flex items-center gap-1 shrink-0 truncate max-w-[140px]">
                <FileSpreadsheet className="w-3 h-3 text-indigo-500" />
                {lead.uploadedFileName}
              </span>
            )}
          </div>
        </div>

        {/* 1-Tap Telephone Action (48x48px touch target) */}
        {lead.phoneNumber ? (
          <a
            href={`tel:${lead.phoneNumber.replace(/[^\d+]/g, "")}`}
            onClick={() => {
              if (onOpenCallLog) onOpenCallLog(lead);
            }}
            className="min-h-[48px] min-w-[48px] flex items-center justify-center rounded-full bg-emerald-600 hover:bg-emerald-700 active:scale-95 text-white shadow-md shadow-emerald-600/20 transition-all shrink-0 cursor-pointer"
            aria-label={`Call ${lead.fullName}`}
            title={`Call ${lead.phoneNumber}`}
          >
            <Phone className="w-5 h-5 fill-white" />
          </a>
        ) : (
          <div className="min-h-[48px] min-w-[48px] flex items-center justify-center rounded-full bg-slate-100 dark:bg-slate-800 text-slate-400 shrink-0">
            <Phone className="w-5 h-5" />
          </div>
        )}
      </div>

      {/* Middle Row: Phone Number & Email Display */}
      <div className="mt-3 grid grid-cols-1 gap-1 text-xs text-slate-600 dark:text-slate-300">
        {lead.phoneNumber && (
          <div className="font-mono text-sm font-semibold text-slate-800 dark:text-slate-200">
            {lead.phoneNumber}
          </div>
        )}
        {lead.email && (
          <div className="flex items-center gap-1.5 text-slate-500 dark:text-slate-400 truncate">
            <Mail className="w-3.5 h-3.5 shrink-0" />
            <span className="truncate">{lead.email}</span>
          </div>
        )}
      </div>

      {/* Bottom Row Controls: Status & Handler (>=48px touch targets for sheets) */}
      <div className="mt-3 pt-3 border-t border-slate-100 dark:border-slate-800 grid grid-cols-2 gap-2">
        {/* Call Status Sheet Trigger */}
        <button
          type="button"
          onClick={() => onSelectStatusSheet?.(lead)}
          className={`min-h-[48px] px-3 py-2 rounded-xl border text-xs font-semibold flex items-center justify-between gap-1.5 cursor-pointer active:scale-[0.98] transition-all text-left ${statusConfig.bg}`}
          title="Change attendance status"
        >
          <div className="flex items-center gap-2 truncate">
            <span className={`w-2 h-2 rounded-full shrink-0 ${statusConfig.dot}`} />
            <span className="truncate">{lead.status}</span>
          </div>
          <ChevronDown className="w-3.5 h-3.5 opacity-60 shrink-0" />
        </button>

        {/* Handler Assignment Sheet Trigger (Displays ONLY clean name or Unassigned) */}
        <button
          type="button"
          onClick={() => onSelectHandlerSheet?.(lead)}
          className={`min-h-[48px] px-3 py-2 rounded-xl border text-xs font-semibold flex items-center justify-between gap-1.5 cursor-pointer active:scale-[0.98] transition-all text-left ${
            isAssigned
              ? "bg-indigo-50/70 dark:bg-indigo-950/40 text-indigo-950 dark:text-indigo-200 border-indigo-200 dark:border-indigo-800"
              : "bg-slate-50 dark:bg-slate-800/80 text-slate-600 dark:text-slate-400 border-slate-200 dark:border-slate-700"
          }`}
          title="Reassign specialist"
        >
          <div className="flex items-center gap-2 truncate">
            {isAssigned ? (
              <UserCheck className="w-3.5 h-3.5 text-indigo-600 dark:text-indigo-400 shrink-0" />
            ) : (
              <User className="w-3.5 h-3.5 text-slate-400 shrink-0" />
            )}
            <span className="truncate">{cleanHandlerName}</span>
          </div>
          <ChevronDown className="w-3.5 h-3.5 opacity-60 shrink-0" />
        </button>
      </div>

      {/* Interested Client Workflow: Payment Date, Method, Completion Status */}
      {lead.status === "Interested" && (
        <div className="mt-3 p-3 rounded-2xl bg-emerald-50/70 dark:bg-emerald-950/40 border border-emerald-200/80 dark:border-emerald-800 space-y-2">
          <div className="flex items-center justify-between text-xs font-bold text-emerald-900 dark:text-emerald-200">
            <span className="flex items-center gap-1.5">
              <CreditCard className="w-3.5 h-3.5 text-emerald-600" />
              <span>Payment & Completion Tracking</span>
            </span>
            <span
              className={`text-[10px] px-2 py-0.5 rounded-full font-extrabold uppercase ${
                lead.completionStatus === "Completed"
                  ? "bg-emerald-600 text-white"
                  : lead.completionStatus === "Refunded"
                  ? "bg-rose-600 text-white"
                  : "bg-amber-500 text-white"
              }`}
            >
              {lead.completionStatus || "Pending"}
            </span>
          </div>

          <div className="grid grid-cols-2 gap-2 text-xs">
            {/* Payment Date */}
            <div>
              <label className="block text-[10px] font-bold text-slate-500 dark:text-slate-400 mb-0.5">
                Payment Date
              </label>
              <input
                type="date"
                value={lead.paymentDate || ""}
                onChange={(e) => onUpdatePaymentDate?.(lead.id, e.target.value)}
                className="w-full min-h-[48px] px-2.5 py-2 rounded-xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 font-semibold text-slate-900 dark:text-slate-100 text-xs shadow-2xs"
              />
            </div>

            {/* Payment Method */}
            <div>
              <label className="block text-[10px] font-bold text-slate-500 dark:text-slate-400 mb-0.5">
                Payment Method
              </label>
              <select
                value={lead.paymentMethod || "Card"}
                onChange={(e) => onUpdatePaymentMethod?.(lead.id, e.target.value)}
                className="w-full min-h-[48px] px-2.5 py-2 rounded-xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 font-semibold text-slate-900 dark:text-slate-100 text-xs shadow-2xs cursor-pointer"
              >
                <option value="Card">Card</option>
                <option value="Bank Transfer">Bank Transfer</option>
                <option value="UPI">UPI</option>
                <option value="Cash">Cash</option>
              </select>
            </div>
          </div>

          {/* Completion Status Toggle Buttons (>=48px touch targets) */}
          <div className="pt-1">
            <label className="block text-[10px] font-bold text-slate-500 dark:text-slate-400 mb-1">
              Completion Status
            </label>
            <div className="grid grid-cols-3 gap-1.5">
              {(["Pending", "Completed", "Refunded"] as CompletionStatus[]).map((status) => {
                const isSelected = (lead.completionStatus || "Pending") === status;
                return (
                  <button
                    key={status}
                    type="button"
                    onClick={() => onUpdateCompletionStatus?.(lead.id, status)}
                    className={`min-h-[48px] px-2 py-2 rounded-xl text-xs font-bold border transition-all cursor-pointer flex items-center justify-center gap-1 active:scale-95 ${
                      isSelected
                        ? status === "Completed"
                          ? "bg-emerald-600 text-white border-emerald-700 shadow-xs"
                          : status === "Refunded"
                          ? "bg-rose-600 text-white border-rose-700 shadow-xs"
                          : "bg-amber-500 text-white border-amber-600 shadow-xs"
                        : "bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-300 border-slate-200 dark:border-slate-700"
                    }`}
                  >
                    <span>{status}</span>
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* Expand / Collapse Drawer for Manual Notes & Extra Details */}
      <div className="mt-2 pt-2 flex items-center justify-between text-xs text-slate-500">
        <button
          type="button"
          onClick={() => setIsExpanded(!isExpanded)}
          className="min-h-[36px] flex items-center gap-1.5 font-medium text-indigo-600 dark:text-indigo-400 hover:text-indigo-800 active:scale-95 transition-transform"
        >
          {isExpanded ? (
            <>
              <ChevronUp className="w-4 h-4" />
              <span>Hide Details</span>
            </>
          ) : (
            <>
              <ChevronDown className="w-4 h-4" />
              <span>
                {lead.manualNotes ? "View/Edit Notes" : "Add Notes & Details"}
              </span>
            </>
          )}
        </button>

        <div className="flex items-center gap-1">
          {onOpenCallLog && (
            <button
              type="button"
              onClick={() => onOpenCallLog(lead)}
              className="min-h-[36px] px-2 flex items-center gap-1 font-medium text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200"
            >
              <Clock className="w-3.5 h-3.5" />
              <span>Log</span>
            </button>
          )}
          {canEdit && onEditLead && (
            <button
              type="button"
              onClick={() => onEditLead(lead)}
              className="min-h-[36px] min-w-[36px] flex items-center justify-center rounded-lg text-slate-400 hover:text-slate-700 dark:hover:text-slate-200"
              title="Edit full lead details"
            >
              <Edit2 className="w-3.5 h-3.5" />
            </button>
          )}
          {canEdit && onDeleteLead && (
            <button
              type="button"
              onClick={() => onDeleteLead(lead)}
              className="min-h-[36px] min-w-[36px] flex items-center justify-center rounded-lg text-rose-400 hover:text-rose-600"
              title="Delete lead"
            >
              <Trash2 className="w-3.5 h-3.5" />
            </button>
          )}
        </div>
      </div>

      {/* Expanded Details Section */}
      {isExpanded && (
        <div className="mt-3 pt-3 border-t border-slate-100 dark:border-slate-800 space-y-3 animate-in fade-in duration-150">
          {lead.paymentReceipt && (
            <div className="text-xs bg-slate-50 dark:bg-slate-800/60 p-2.5 rounded-xl border border-slate-200/60 dark:border-slate-700/60">
              <span className="font-semibold text-slate-700 dark:text-slate-300">
                Payment Receipt:
              </span>{" "}
              <span className="font-mono text-slate-900 dark:text-slate-100">
                {lead.paymentReceipt}
              </span>
            </div>
          )}

          <div>
            <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
              Manual Notes / Call Comments
            </label>
            <div className="relative">
              <textarea
                rows={2}
                value={manualNoteText}
                onChange={(e) => setManualNoteText(e.target.value)}
                placeholder="Type quick comments, conversation details, or client follow-up..."
                className="w-full text-xs p-2.5 bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 rounded-xl outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 text-slate-900 dark:text-slate-100 font-medium"
              />
            </div>
            <div className="flex justify-end mt-1.5">
              <button
                type="button"
                onClick={handleSaveNotes}
                className="min-h-[40px] px-3 rounded-lg bg-indigo-600 hover:bg-indigo-700 active:scale-95 text-white text-xs font-semibold flex items-center gap-1.5 transition-all shadow-xs"
              >
                {isNoteSaved ? (
                  <>
                    <CheckCircle2 className="w-3.5 h-3.5" />
                    <span>Saved!</span>
                  </>
                ) : (
                  <>
                    <Save className="w-3.5 h-3.5" />
                    <span>Save Note</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
