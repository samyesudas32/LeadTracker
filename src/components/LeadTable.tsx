import React, { useState, useEffect, useRef, useMemo } from "react";
import {
  Phone,
  Mail,
  MapPin,
  Calendar,
  PhoneForwarded,
  Edit2,
  Trash2,
  Copy,
  Check,
  PenLine,
  X,
  CalendarDays,
  Filter,
  UserCheck,
  FileText,
  AlertCircle,
  CheckCircle2,
  Layers,
  Sparkles,
  ChevronLeft,
  ChevronRight,
  Pin,
  SlidersHorizontal,
  Download,
  Lock,
  Search,
  CreditCard,
} from "lucide-react";
import { Lead, CallStatus, HandlerRecord, CompletionStatus, PaymentMethod } from "../types";
import { formatTelLink } from "../utils/parser";
import { formatUploadDayLabel, getLocalDateString } from "../utils/dateUtils";
import { getHandlerColorClasses } from "../data/handlerDefaults";
import { parseWorkspaceTab, buildWorkspaceTab } from "./LeadWorkspaceTabs";
import { isLeadAssignedToHandler } from "../utils/pdfGenerator";
import { hasPermission } from "../utils/authService";

interface ManualNotesInputProps {
  leadId: string;
  clientName: string;
  initialValue?: string;
  onSave: (leadId: string, value: string) => void;
}

const ManualNotesInput: React.FC<ManualNotesInputProps> = ({
  leadId,
  clientName,
  initialValue = "",
  onSave,
}) => {
  const [text, setText] = useState(initialValue);
  const [saveStatus, setSaveStatus] = useState<"idle" | "saved">("idle");
  const timerRef = useRef<any>(null);

  useEffect(() => {
    setText(initialValue || "");
  }, [initialValue]);

  const commitSave = (newVal: string) => {
    if (newVal !== initialValue) {
      onSave(leadId, newVal);
      setSaveStatus("saved");
      if (timerRef.current) clearTimeout(timerRef.current);
      timerRef.current = setTimeout(() => {
        setSaveStatus("idle");
      }, 2000);
    }
  };

  const handleChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const val = e.target.value;
    setText(val);
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => {
      commitSave(val);
    }, 600);
  };

  const handleBlur = () => {
    if (timerRef.current) clearTimeout(timerRef.current);
    commitSave(text);
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      commitSave(text);
      (e.target as HTMLTextAreaElement).blur();
    }
  };

  return (
    <div className="relative group/manual">
      <textarea
        id={`input-manual-notes-${leadId}`}
        rows={2}
        value={text}
        onChange={handleChange}
        onBlur={handleBlur}
        onKeyDown={handleKeyDown}
        placeholder={`Type manual note for ${clientName}...`}
        className="w-full text-xs p-2 rounded-lg border border-slate-200 bg-white hover:border-slate-300 focus:border-indigo-500 focus:ring-1 focus:ring-indigo-400 outline-none text-slate-800 placeholder:text-slate-400 transition-all leading-relaxed resize-y min-h-[52px] shadow-2xs font-normal"
      />
      <div className="flex items-center justify-between mt-0.5 px-1">
        <span className="text-[10px]">
          {saveStatus === "saved" ? (
            <span className="inline-flex items-center gap-1 text-emerald-600 font-semibold animate-in fade-in">
              <Check className="w-3 h-3" /> Saved
            </span>
          ) : (
            <span className="text-slate-400 opacity-60 group-hover/manual:opacity-100 transition-opacity">
              Press Enter or click away to save
            </span>
          )}
        </span>
        {text && (
          <button
            type="button"
            onClick={() => {
              setText("");
              onSave(leadId, "");
            }}
            className="text-[10px] text-slate-400 hover:text-red-600 cursor-pointer opacity-0 group-hover/manual:opacity-100 transition-opacity"
            title="Clear note"
          >
            Clear
          </button>
        )}
      </div>
    </div>
  );
};

const getStatusBadge = (status: CallStatus) => {
  switch (status) {
    case "Interested":
      return "bg-emerald-50 text-emerald-800 border-emerald-200/80";
    case "Requires Follow-up":
      return "bg-amber-50 text-amber-800 border-amber-200/80";
    case "Pending Call":
      return "bg-blue-50 text-blue-800 border-blue-200/80";
    case "No Answer":
      return "bg-rose-50 text-rose-800 border-rose-200/80";
    case "Not Interested":
      return "bg-slate-100 text-slate-700 border-slate-200/80";
    default:
      return "bg-slate-100 text-slate-800 border-slate-200/80";
  }
};

interface LeadTableRowProps {
  lead: Lead;
  clientNumber?: number;
  isSelected: boolean;
  freezeNameColumn: boolean;
  onToggleSelectLead: (leadId: string) => void;
  handlers?: HandlerRecord[];
  onUpdateStatus: (leadId: string, newStatus: CallStatus) => void;
  onUpdateHandler?: (leadId: string, handlerName: string, handlerId?: string) => void;
  onUpdateManualNotes: (leadId: string, newManualNotes: string) => void;
  onDeleteLead: (lead: Lead) => void;
  onEditLead: (lead: Lead) => void;
  onOpenCallLog: (lead: Lead) => void;
  isEditingMonth: boolean;
  tempMonthText: string;
  setTempMonthText: (text: string) => void;
  isMonthSaved: boolean;
  isEmailCopied: boolean;
  onStartEditMonth: (lead: Lead) => void;
  onSaveMonth: (leadId: string) => void;
  onCancelEditMonth: () => void;
  onCopyEmail: (leadId: string, email: string) => void;
  onUpdatePaymentDate?: (leadId: string, paymentDate: string) => void;
  onUpdatePaymentMethod?: (leadId: string, paymentMethod: string) => void;
  onUpdateCompletionStatus?: (leadId: string, completionStatus: CompletionStatus) => void;
  isInterestedSection?: boolean;
}

const LeadTableRow = React.memo<LeadTableRowProps>(({
  lead,
  clientNumber,
  isSelected,
  freezeNameColumn,
  onToggleSelectLead,
  handlers,
  onUpdateStatus,
  onUpdateHandler,
  onUpdateManualNotes,
  onDeleteLead,
  onEditLead,
  onOpenCallLog,
  isEditingMonth,
  tempMonthText,
  setTempMonthText,
  isMonthSaved,
  isEmailCopied,
  onStartEditMonth,
  onSaveMonth,
  onCancelEditMonth,
  onCopyEmail,
  onUpdatePaymentDate,
  onUpdatePaymentMethod,
  onUpdateCompletionStatus,
  isInterestedSection = false,
}) => {
  const telLink = formatTelLink(lead.phoneNumber);
  const statusStyle = getStatusBadge(lead.status);

  const canChangeStatus = hasPermission("leads:status_change");
  const canReassignHandler = hasPermission("leads:reassign_handler");
  const canEditLead = hasPermission("leads:edit");
  const canDeleteLead = hasPermission("leads:delete_single");

  return (
    <tr
      id={`lead-row-${lead.id}`}
      className={`transition-colors group ${
        isSelected ? "bg-indigo-50/40 hover:bg-indigo-50/60" : "hover:bg-slate-50/70"
      }`}
    >
      {/* Select row checkbox & Client Number */}
      <td
        className={`py-3 pl-3 pr-2 w-14 text-center align-top ${
          freezeNameColumn
            ? `sticky left-0 z-20 ${isSelected ? "bg-indigo-50" : "bg-white"} group-hover:bg-slate-100 border-r border-slate-100`
            : ""
        }`}
      >
        <div className="flex flex-col items-center justify-center gap-1">
          <input
            id={`checkbox-lead-${lead.id}`}
            type="checkbox"
            checked={isSelected}
            onChange={() => onToggleSelectLead(lead.id)}
            className="w-4 h-4 rounded text-indigo-600 focus:ring-indigo-500 cursor-pointer mt-0.5"
            title={`Select Client #${clientNumber || ""}`}
          />
          {clientNumber !== undefined && (
            <span
              className="text-[10px] font-mono font-bold text-slate-500 bg-slate-100 px-1 py-0.2 rounded border border-slate-200/80 tabular-nums leading-none shadow-2xs"
              title={`Client #${clientNumber} listed in directory`}
            >
              #{clientNumber}
            </span>
          )}
        </div>
      </td>

      {/* 1. Full Name */}
      <td
        className={`py-3.5 px-3 min-w-[190px] w-[210px] align-top ${
          freezeNameColumn
            ? `sticky left-14 z-20 ${isSelected ? "bg-indigo-50" : "bg-white"} group-hover:bg-slate-100 border-r border-slate-200/80 shadow-xs`
            : ""
        }`}
      >
        <div className="flex items-start gap-2">
          <div className="w-7 h-7 rounded-lg bg-indigo-50 border border-indigo-100 text-indigo-700 font-bold text-xs flex items-center justify-center shrink-0 mt-0.5 shadow-2xs">
            {lead.fullName.charAt(0).toUpperCase() || "?"}
          </div>
          <div className="min-w-0">
            <span className="font-semibold text-slate-900 block leading-tight truncate max-w-[165px]" title={lead.fullName}>
              {lead.fullName}
            </span>
            {lead.uploadedFileName && (
              <span
                className="text-[10px] text-slate-400 truncate max-w-[160px] block mt-0.5"
                title={`Source file: ${lead.uploadedFileName}`}
              >
                {lead.uploadedFileName}
              </span>
            )}
          </div>
        </div>
      </td>

      {/* 2. Phone Number (tel: link) */}
      <td className="py-3.5 px-3 min-w-[140px] w-[150px] align-top whitespace-nowrap">
        {lead.phoneNumber ? (
          <div className="flex items-center">
            <a
              id={`tel-link-${lead.id}`}
              href={telLink}
              className="inline-flex items-center gap-1.5 font-mono text-xs font-semibold px-2.5 py-1.5 rounded-lg bg-slate-50 text-slate-800 hover:bg-indigo-50 hover:text-indigo-900 hover:border-indigo-300 border border-slate-200 transition-all cursor-pointer shadow-2xs tabular-nums w-full max-w-[140px] justify-center"
              title="Click to automatically dial on phone"
            >
              <Phone className="w-3 h-3 text-indigo-600 shrink-0" />
              <span className="truncate">{lead.phoneNumber}</span>
            </a>
          </div>
        ) : (
          <span className="text-xs text-slate-400 italic block py-1.5">No number</span>
        )}
      </td>

      {/* 3. Email ID */}
      <td className="py-3.5 px-3 min-w-[165px] w-[175px] align-top">
        {lead.email ? (
          <div className="flex items-center justify-between gap-1 w-full max-w-[170px] py-0.5">
            <a
              href={`mailto:${lead.email}`}
              className="text-xs font-mono text-slate-700 hover:text-indigo-600 hover:underline truncate max-w-[130px] block"
              title={`Email ${lead.email}`}
            >
              {lead.email}
            </a>
            <button
              type="button"
              onClick={() => onCopyEmail(lead.id, lead.email)}
              className="text-slate-400 hover:text-slate-600 p-1 rounded hover:bg-slate-100 transition-colors cursor-pointer shrink-0"
              title="Copy email address"
            >
              {isEmailCopied ? (
                <Check className="w-3.5 h-3.5 text-emerald-600" />
              ) : (
                <Copy className="w-3.5 h-3.5" />
              )}
            </button>
          </div>
        ) : (
          <span className="text-xs text-slate-400 italic block py-1.5">—</span>
        )}
      </td>

      {/* 4. City */}
      <td className="py-3.5 px-3 min-w-[95px] w-[105px] align-top">
        <div className="flex items-center gap-1.5 text-slate-700 py-1">
          <MapPin className="w-3.5 h-3.5 text-slate-400 shrink-0" />
          <span className="font-medium text-xs truncate max-w-[85px]" title={lead.city}>
            {lead.city || "Unknown"}
          </span>
        </div>
      </td>

      {/* 5. Call Attendance Status */}
      <td className="py-3.5 px-3 min-w-[150px] w-[155px] align-top whitespace-nowrap">
        <select
          id={`select-status-${lead.id}`}
          value={lead.status}
          disabled={!canChangeStatus}
          onChange={(e) => {
            if (canChangeStatus) {
              onUpdateStatus(lead.id, e.target.value as CallStatus);
            }
          }}
          className={`w-full max-w-[150px] text-xs font-semibold px-2.5 py-1.5 rounded-lg border outline-none transition-colors shadow-2xs truncate ${
            !canChangeStatus ? "opacity-60 cursor-not-allowed bg-slate-100 text-slate-500 border-slate-200" : `cursor-pointer ${statusStyle}`
          }`}
          title={!canChangeStatus ? "Status modification restricted for Staff (requires leads:status_change)" : "Update Call Attendance Status"}
        >
          <option value="Requires Follow-up">Requires Follow-up</option>
          <option value="Interested">Interested</option>
          <option value="Pending Call">Pending Call</option>
          <option value="No Answer">No Answer</option>
          <option value="Not Interested">Not Interested</option>
        </select>
      </td>

      {/* 8. Handler */}
      <td className="py-3.5 px-3 min-w-[190px] w-[200px] align-top whitespace-nowrap">
        {(() => {
          const isAssigned = isLeadAssignedToHandler(lead, handlers);
          const hName = isAssigned ? (lead.handlerName || "") : "";
          const matched = isAssigned
            ? handlers?.find((h) => h?.name && hName && h.name.toLowerCase() === hName.toLowerCase())
            : undefined;
          const hColor = getHandlerColorClasses(matched?.color);

          return (
            <div className="w-[185px] relative flex items-center">
              <span
                className={`absolute left-2.5 top-1/2 -translate-y-1/2 w-2 h-2 rounded-full shrink-0 ${
                  isAssigned ? hColor.dot : "bg-slate-300"
                } pointer-events-none z-10`}
                aria-hidden="true"
              />
              <select
                id={`select-row-handler-${lead.id}`}
                value={hName}
                disabled={!canReassignHandler}
                onChange={(e) => {
                  if (!canReassignHandler) return;
                  const newName = e.target.value;
                  const isNewAssigned = Boolean(
                    newName &&
                      newName.trim() !== "" &&
                      newName.toLowerCase() !== "unassigned" &&
                      newName.toLowerCase() !== "none" &&
                      newName.toLowerCase() !== "not assigned"
                  );
                  const found = isNewAssigned
                    ? handlers?.find((h) => h?.name && newName && h.name.toLowerCase() === newName.toLowerCase())
                    : undefined;
                  if (onUpdateHandler) {
                    onUpdateHandler(lead.id, isNewAssigned ? newName : "", found?.id);
                  }
                }}
                className={`w-full pl-6 pr-6 py-1.5 text-xs font-semibold rounded-lg border outline-none transition-all truncate shadow-2xs ${
                  !canReassignHandler
                    ? "opacity-60 cursor-not-allowed bg-slate-100 text-slate-500 border-slate-200"
                    : isAssigned
                    ? "border-indigo-200/90 bg-indigo-50/50 text-indigo-950 hover:border-indigo-300 focus:border-indigo-500 focus:ring-1 focus:ring-indigo-400 cursor-pointer"
                    : "border-slate-200/90 bg-slate-50/90 text-slate-600 hover:border-slate-300 focus:border-indigo-500 focus:ring-1 focus:ring-indigo-400 cursor-pointer"
                }`}
                title={!canReassignHandler ? "Handler reassignment restricted" : "Select assigned handler"}
              >
                <option value="">Unassigned</option>
                {handlers?.map((h) => (
                  <option key={h.id} value={h.name}>
                    {h.name}
                  </option>
                ))}
                {hName && !handlers?.some((h) => h.name.toLowerCase() === hName.toLowerCase()) && (
                  <option value={hName}>{hName}</option>
                )}
              </select>
            </div>
          );
        })()}
      </td>

      {/* Dedicated Interested Fields: Payment Date, Payment Method, Completion Status */}
      {isInterestedSection && (
        <td className="py-3.5 px-3 min-w-[150px] w-[160px] align-top whitespace-nowrap">
          <input
            id={`input-row-payment-date-${lead.id}`}
            type="date"
            value={lead.paymentDate || ""}
            onChange={(e) => onUpdatePaymentDate?.(lead.id, e.target.value)}
            className="w-full text-xs font-semibold px-2.5 py-1.5 rounded-lg border border-slate-200 bg-white text-slate-800 hover:border-slate-300 focus:border-indigo-500 focus:ring-1 focus:ring-indigo-400 outline-none shadow-2xs cursor-pointer"
            title="Set payment processing date"
          />
        </td>
      )}

      {isInterestedSection && (
        <td className="py-3.5 px-3 min-w-[140px] w-[150px] align-top whitespace-nowrap">
          <select
            id={`select-row-payment-method-${lead.id}`}
            value={lead.paymentMethod || "Card"}
            onChange={(e) => onUpdatePaymentMethod?.(lead.id, e.target.value)}
            className="w-full text-xs font-semibold px-2.5 py-1.5 rounded-lg border border-slate-200 bg-white text-slate-800 hover:border-slate-300 focus:border-indigo-500 focus:ring-1 focus:ring-indigo-400 outline-none shadow-2xs cursor-pointer"
            title="Select payment method (Card, Bank Transfer, UPI, Cash)"
          >
            <option value="Card">Card</option>
            <option value="Bank Transfer">Bank Transfer</option>
            <option value="UPI">UPI</option>
            <option value="Cash">Cash</option>
          </select>
        </td>
      )}

      {isInterestedSection && (
        <td className="py-3.5 px-3 min-w-[140px] w-[150px] align-top whitespace-nowrap">
          <select
            id={`select-row-completion-status-${lead.id}`}
            value={lead.completionStatus || "Pending"}
            onChange={(e) => onUpdateCompletionStatus?.(lead.id, e.target.value as CompletionStatus)}
            className={`w-full text-xs font-bold px-2.5 py-1.5 rounded-lg border outline-none shadow-2xs cursor-pointer transition-colors ${
              lead.completionStatus === "Completed"
                ? "bg-emerald-50 text-emerald-800 border-emerald-300 ring-1 ring-emerald-300/40"
                : lead.completionStatus === "Refunded"
                ? "bg-rose-50 text-rose-800 border-rose-300 ring-1 ring-rose-300/40"
                : "bg-amber-50 text-amber-800 border-amber-300 ring-1 ring-amber-300/40"
            }`}
            title="Update completion status (Pending, Completed, Refunded)"
          >
            <option value="Pending">Pending</option>
            <option value="Completed">Completed</option>
            <option value="Refunded">Refunded</option>
          </select>
        </td>
      )}

      {/* 9. Manual Notes */}
      <td className="py-3.5 px-3 min-w-[280px] w-[310px] align-top">
        <ManualNotesInput
          leadId={lead.id}
          clientName={lead.fullName}
          initialValue={lead.manualNotes}
          onSave={onUpdateManualNotes}
        />
      </td>

      {/* 10. Row Actions */}
      <td className="py-3.5 pl-3 pr-4 w-[100px] text-right align-top whitespace-nowrap">
        <div className="flex items-center justify-end gap-1 pt-0.5">
          <button
            id={`btn-call-log-${lead.id}`}
            type="button"
            onClick={() => onOpenCallLog(lead)}
            className="p-1.5 text-slate-500 hover:text-emerald-700 hover:bg-emerald-50 rounded-lg transition-colors cursor-pointer"
            title="Dial phone & log call outcome"
          >
            <PhoneForwarded className="w-4 h-4" />
          </button>

          {canEditLead ? (
            <button
              id={`btn-edit-lead-${lead.id}`}
              type="button"
              onClick={() => onEditLead(lead)}
              className="p-1.5 text-slate-500 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg transition-colors cursor-pointer"
              title="Edit lead details"
            >
              <Edit2 className="w-4 h-4" />
            </button>
          ) : (
            <span
              className="p-1.5 text-slate-300 cursor-not-allowed"
              title="Editing restricted for Staff role (requires leads:edit permission)"
            >
              <Lock className="w-3.5 h-3.5" />
            </span>
          )}

          {canDeleteLead ? (
            <button
              id={`btn-delete-lead-${lead.id}`}
              type="button"
              onClick={() => onDeleteLead(lead)}
              className="p-1.5 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors cursor-pointer"
              title={`Delete lead ${lead.fullName}`}
            >
              <Trash2 className="w-4 h-4" />
            </button>
          ) : (
            <span
              className="p-1.5 text-slate-300 cursor-not-allowed"
              title="Single lead deletion restricted for Staff role (requires leads:delete_single permission)"
            >
              <Lock className="w-3.5 h-3.5" />
            </span>
          )}
        </div>
      </td>
    </tr>
  );
});
LeadTableRow.displayName = "LeadTableRow";

interface LeadTableProps {
  leads: Lead[];
  allLeads?: Lead[];
  activeWorkspaceTab?: string;
  onSelectWorkspaceTab?: (tabId: string) => void;
  selectedLeadIds: string[];
  onToggleSelectLead: (leadId: string) => void;
  onToggleSelectBatch?: (leadIds: string[], select: boolean) => void;
  onSelectAll: () => void;
  onClearSelection: () => void;
  onDeleteSelected: () => void;
  onBatchUpdateStatus: (newStatus: CallStatus) => void;
  onUpdateStatus: (leadId: string, newStatus: CallStatus) => void;
  onUpdateMonth: (leadId: string, newMonth: string) => void;
  onBatchUpdateMonth?: (newMonth: string) => void;
  onUpdateNotes: (leadId: string, newNotes: string) => void;
  onUpdateManualNotes: (leadId: string, newManualNotes: string) => void;
  onDeleteLead: (lead: Lead) => void;
  onEditLead: (lead: Lead) => void;
  onOpenCallLog: (lead: Lead) => void;
  activeDateFilter?: string;
  activeFileFilter?: string;
  activeFileName?: string;
  onClearDateFilter?: () => void;
  onClearFileFilter?: () => void;
  handlers?: HandlerRecord[];
  onUpdateHandler?: (leadId: string, handlerName: string, handlerId?: string) => void;
  onBatchUpdateHandler?: (handlerName: string, handlerId?: string) => void;
  onSaveCallLog?: (leadId: string, status: CallStatus, noteToAdd: string) => void;
  quickPresets?: string[];
  onOpenPdfReport?: (dateStr?: string) => void;
  searchQuery?: string;
  onSearchChange?: (val: string) => void;
  onUpdatePaymentDate?: (leadId: string, paymentDate: string) => void;
  onUpdatePaymentMethod?: (leadId: string, paymentMethod: string) => void;
  onUpdateCompletionStatus?: (leadId: string, completionStatus: CompletionStatus) => void;
  onOpenCompletionReports?: () => void;
}

export const LeadTable: React.FC<LeadTableProps> = ({
  leads,
  allLeads,
  activeWorkspaceTab = "all",
  onSelectWorkspaceTab,
  selectedLeadIds,
  onToggleSelectLead,
  onToggleSelectBatch,
  onSelectAll,
  onClearSelection,
  onDeleteSelected,
  onBatchUpdateStatus,
  onUpdateStatus,
  onUpdateMonth,
  onBatchUpdateMonth,
  onUpdateNotes,
  onUpdateManualNotes,
  onDeleteLead,
  onEditLead,
  onOpenCallLog,
  activeDateFilter,
  activeFileFilter,
  activeFileName,
  onClearDateFilter,
  onClearFileFilter,
  handlers,
  onUpdateHandler,
  onBatchUpdateHandler,
  onSaveCallLog,
  quickPresets,
  onOpenPdfReport,
  searchQuery,
  onSearchChange,
  onUpdatePaymentDate,
  onUpdatePaymentMethod,
  onUpdateCompletionStatus,
  onOpenCompletionReports,
}) => {
  const [editingMonthId, setEditingMonthId] = useState<string | null>(null);
  const [tempMonthText, setTempMonthText] = useState("");
  const [monthSavedId, setMonthSavedId] = useState<string | null>(null);
  const [isBatchMonthOpen, setIsBatchMonthOpen] = useState(false);
  const [batchMonthText, setBatchMonthText] = useState("");
  const [copiedEmailId, setCopiedEmailId] = useState<string | null>(null);

  // Table horizontal scrolling, container tracking & sticky navigator state
  const tableContainerRef = useRef<HTMLDivElement>(null);
  const trackRef = useRef<HTMLDivElement>(null);
  const smoothScrollAnimRef = useRef<number | null>(null);
  const rafScrollRef = useRef<number | null>(null);
  const isDraggingRef = useRef(false);

  const [scrollProgress, setScrollProgress] = useState(0);
  const [canScrollLeft, setCanScrollLeft] = useState(false);
  const [canScrollRight, setCanScrollRight] = useState(false);
  const [isOverflowing, setIsOverflowing] = useState(false);
  const [freezeNameColumn, setFreezeNameColumn] = useState<boolean>(true);
  const [scrollLeftPos, setScrollLeftPos] = useState(0);
  const [scrollTotalWidth, setScrollTotalWidth] = useState(0);
  const [clientContainerWidth, setClientContainerWidth] = useState(0);
  const [isDragging, setIsDragging] = useState(false);

  // Column visibility state (all columns visible by default)
  const [visibleColumns, setVisibleColumns] = useState({
    phone: true,
    email: true,
    city: true,
    receipt: true,
    month: true,
    status: true,
    handler: true,
    notes: true,
  });
  const [isColumnDropdownOpen, setIsColumnDropdownOpen] = useState(false);

  // Measure and synchronize table scroll state
  const updateScrollMetrics = () => {
    const el = tableContainerRef.current;
    if (!el) return;
    const maxScroll = Math.max(0, el.scrollWidth - el.clientWidth);
    const overflowing = maxScroll > 8;
    setIsOverflowing(overflowing);
    setCanScrollLeft(el.scrollLeft > 6);
    setCanScrollRight(maxScroll - el.scrollLeft > 6);
    setScrollProgress(maxScroll > 0 ? (el.scrollLeft / maxScroll) * 100 : 0);
    setScrollLeftPos(el.scrollLeft);
    setScrollTotalWidth(el.scrollWidth);
    setClientContainerWidth(el.clientWidth);
  };

  useEffect(() => {
    updateScrollMetrics();
    const handleResize = () => updateScrollMetrics();
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, [leads.length, visibleColumns]);

  // Throttled table scroll using requestAnimationFrame
  const handleTableScroll = () => {
    if (rafScrollRef.current !== null) return;
    rafScrollRef.current = requestAnimationFrame(() => {
      rafScrollRef.current = null;
      updateScrollMetrics();
    });
  };

  // Snappy, silky smooth scroll animator with cubic ease-out
  const quickSmoothScrollTo = (targetX: number, duration = 160) => {
    const container = tableContainerRef.current;
    if (!container) return;

    if (smoothScrollAnimRef.current !== null) {
      cancelAnimationFrame(smoothScrollAnimRef.current);
      smoothScrollAnimRef.current = null;
    }

    const startX = container.scrollLeft;
    const maxScroll = Math.max(0, container.scrollWidth - container.clientWidth);
    const clampedTarget = Math.max(0, Math.min(maxScroll, targetX));
    const distance = clampedTarget - startX;

    if (Math.abs(distance) < 2) {
      container.scrollLeft = clampedTarget;
      updateScrollMetrics();
      return;
    }

    const startTime = performance.now();
    const step = (now: number) => {
      const elapsed = now - startTime;
      const progress = Math.min(1, elapsed / duration);
      // Cubic ease-out curve: instant acceleration, gentle stopping
      const easeOut = 1 - Math.pow(1 - progress, 3);
      container.scrollLeft = Math.round(startX + distance * easeOut);
      updateScrollMetrics();

      if (progress < 1) {
        smoothScrollAnimRef.current = requestAnimationFrame(step);
      } else {
        smoothScrollAnimRef.current = null;
        updateScrollMetrics();
      }
    };
    smoothScrollAnimRef.current = requestAnimationFrame(step);
  };

  const handleScrollLeftStep = (step = 320) => {
    if (!tableContainerRef.current) return;
    quickSmoothScrollTo(tableContainerRef.current.scrollLeft - step, 140);
  };

  const handleScrollRightStep = (step = 320) => {
    if (!tableContainerRef.current) return;
    quickSmoothScrollTo(tableContainerRef.current.scrollLeft + step, 140);
  };

  const handleJumpToSection = (targetX: number) => {
    quickSmoothScrollTo(targetX, 160);
  };

  // Direct 1:1 draggable slide bar pointer controller
  const handlePointerDownSlideBar = (e: React.PointerEvent<HTMLDivElement>) => {
    const track = trackRef.current;
    const container = tableContainerRef.current;
    if (!track || !container) return;

    if (smoothScrollAnimRef.current !== null) {
      cancelAnimationFrame(smoothScrollAnimRef.current);
      smoothScrollAnimRef.current = null;
    }

    e.preventDefault();
    track.setPointerCapture(e.pointerId);
    isDraggingRef.current = true;
    setIsDragging(true);

    const rect = track.getBoundingClientRect();
    const trackWidth = rect.width;
    const currentMaxScroll = Math.max(0, container.scrollWidth - container.clientWidth);

    const scrollToClientX = (clientX: number) => {
      if (trackWidth <= 0 || currentMaxScroll <= 0) return;
      const clickX = Math.max(0, Math.min(trackWidth, clientX - rect.left));
      const ratio = clickX / trackWidth;
      const targetScroll = Math.round(ratio * currentMaxScroll);
      container.scrollLeft = targetScroll;
      updateScrollMetrics();
    };

    scrollToClientX(e.clientX);

    const handlePointerMove = (ev: PointerEvent) => {
      if (!isDraggingRef.current) return;
      scrollToClientX(ev.clientX);
    };

    const handlePointerUp = (ev: PointerEvent) => {
      isDraggingRef.current = false;
      setIsDragging(false);
      try {
        track.releasePointerCapture(ev.pointerId);
      } catch (_) {}
      window.removeEventListener("pointermove", handlePointerMove);
      window.removeEventListener("pointerup", handlePointerUp);
      window.removeEventListener("pointercancel", handlePointerUp);
    };

    window.addEventListener("pointermove", handlePointerMove);
    window.addEventListener("pointerup", handlePointerUp);
    window.addEventListener("pointercancel", handlePointerUp);
  };

  // Mouse wheel horizontal slider interaction
  const handleSlideBarWheel = (e: React.WheelEvent) => {
    const container = tableContainerRef.current;
    if (!container) return;
    e.preventDefault();
    const delta = Math.abs(e.deltaX) > Math.abs(e.deltaY) ? e.deltaX : e.deltaY;
    container.scrollLeft += delta;
    updateScrollMetrics();
  };

  const toggleColumn = (key: keyof typeof visibleColumns) => {
    setVisibleColumns((prev) => ({ ...prev, [key]: !prev[key] }));
  };

  const visibleColumnCount = 3 + Object.values(visibleColumns).filter(Boolean).length;

  const todayStr = getLocalDateString(0);
  const tomorrowStr = getLocalDateString(1);

  // Parse active workspace tab into active fileId and section
  const { fileId: parsedFileId, section: parsedSection } = useMemo(
    () => parseWorkspaceTab(activeWorkspaceTab),
    [activeWorkspaceTab]
  );
  const isInterestedSection = parsedSection === "interested";
  const isFileScoped =
    Boolean(activeFileFilter && activeFileFilter !== "all") || parsedFileId !== "all";
  const activeScopedFileId =
    parsedFileId !== "all"
      ? parsedFileId
      : activeFileFilter && activeFileFilter !== "all"
      ? activeFileFilter
      : null;

  // Leads in the active upload scope (or across all files if not scoped)
  const currentScopeLeads = useMemo(() => {
    if (!isFileScoped || !activeScopedFileId) return allLeads || leads;
    return (allLeads || leads).filter(
      (l) =>
        l.fileId === activeScopedFileId ||
        (activeFileName && l.uploadedFileName === activeFileName)
    );
  }, [allLeads, leads, isFileScoped, activeScopedFileId, activeFileName]);

  // Unassigned and assigned counts for view tabs and status tracking within active scope
  const scopeUnassignedCount = useMemo(() => {
    return currentScopeLeads.filter((l) => !isLeadAssignedToHandler(l, handlers)).length;
  }, [currentScopeLeads, handlers]);

  const scopeAssignedCount = useMemo(() => {
    return currentScopeLeads.filter((l) => isLeadAssignedToHandler(l, handlers)).length;
  }, [currentScopeLeads, handlers]);

  const scopeInterestedCount = useMemo(() => {
    return currentScopeLeads.filter((l) => l.status === "Interested").length;
  }, [currentScopeLeads]);

  const scopeTotalCount = currentScopeLeads.length;

  // Master counts across the entire directory
  const totalAllCount = (allLeads || leads).length;
  const totalAllUnassigned = useMemo(() => {
    return (allLeads || leads).filter((l) => !isLeadAssignedToHandler(l, handlers)).length;
  }, [allLeads, leads, handlers]);
  const totalAllAssigned = useMemo(() => {
    return (allLeads || leads).filter((l) => isLeadAssignedToHandler(l, handlers)).length;
  }, [allLeads, leads, handlers]);
  const totalAllInterested = useMemo(() => {
    return (allLeads || leads).filter((l) => l.status === "Interested").length;
  }, [allLeads, leads]);

  const handleSelectSectionInTable = (targetSection: "main" | "unassigned" | "assigned" | "interested") => {
    if (onSelectWorkspaceTab) {
      const targetFile = activeScopedFileId || "all";
      onSelectWorkspaceTab(buildWorkspaceTab(targetFile, targetSection));
    }
  };

  // Group leads by upload date (or creation date)
  const groupedLeads = useMemo(() => {
    const groups: Record<string, Lead[]> = {};
    leads.forEach((lead) => {
      const dateKey = lead.uploadDate || lead.createdAt?.slice(0, 10) || todayStr;
      if (!groups[dateKey]) {
        groups[dateKey] = [];
      }
      groups[dateKey].push(lead);
    });
    return groups;
  }, [leads, todayStr]);

  // Order dates: Today, Tomorrow, then descending earlier dates
  const sortedDateKeys = useMemo(() => {
    return Object.keys(groupedLeads).sort((a, b) => {
      if (a === todayStr && b === tomorrowStr) return -1;
      if (a === tomorrowStr && b === todayStr) return 1;
      if (a === todayStr) return -1;
      if (b === todayStr) return 1;
      if (a === tomorrowStr) return -1;
      if (b === tomorrowStr) return 1;
      return b.localeCompare(a);
    });
  }, [groupedLeads, todayStr, tomorrowStr]);

  const isAllSelected = leads.length > 0 && selectedLeadIds.length === leads.length;
  const isPartiallySelected =
    selectedLeadIds.length > 0 && selectedLeadIds.length < leads.length;

  // Precompute 1-based listed client number for each lead
  const idToIndexMap = useMemo(() => {
    const map = new Map<string, number>();
    leads.forEach((l, idx) => {
      map.set(l.id, idx + 1);
    });
    return map;
  }, [leads]);

  const handleStartEditMonth = (lead: Lead) => {
    setEditingMonthId(lead.id);
    setTempMonthText(lead.month || lead.lostYearOrMonth || "");
  };

  const handleSaveMonth = (leadId: string) => {
    const newMonth = tempMonthText.trim() || "Not specified";
    onUpdateMonth(leadId, newMonth);
    setEditingMonthId(null);
    setMonthSavedId(leadId);
    setTimeout(() => setMonthSavedId(null), 2500);
  };

  const handleCancelEditMonth = () => {
    setEditingMonthId(null);
  };

  const handleConfirmBatchMonth = () => {
    if (!batchMonthText.trim() || !onBatchUpdateMonth) return;
    onBatchUpdateMonth(batchMonthText.trim());
    setIsBatchMonthOpen(false);
    setBatchMonthText("");
  };

  const handleCopyEmail = (leadId: string, email: string) => {
    if (!email) return;
    navigator.clipboard?.writeText(email);
    setCopiedEmailId(leadId);
    setTimeout(() => setCopiedEmailId(null), 2000);
  };

  const getStatusBadge = (status: CallStatus) => {
    switch (status) {
      case "Interested":
        return "bg-emerald-50 text-emerald-800 border-emerald-200/80";
      case "Requires Follow-up":
        return "bg-amber-50 text-amber-800 border-amber-200/80";
      case "Pending Call":
        return "bg-blue-50 text-blue-800 border-blue-200/80";
      case "No Answer":
        return "bg-rose-50 text-rose-800 border-rose-200/80";
      case "Not Interested":
        return "bg-slate-100 text-slate-700 border-slate-200/80";
      default:
        return "bg-slate-100 text-slate-800 border-slate-200/80";
    }
  };

  if (leads.length === 0) {
    if (activeWorkspaceTab === "unassigned") {
      return (
        <div className="bg-white border border-slate-200 rounded-2xl p-10 text-center shadow-xs">
          <div className="w-12 h-12 bg-emerald-50 text-emerald-600 rounded-full flex items-center justify-center mx-auto mb-3">
            <CheckCircle2 className="w-6 h-6" />
          </div>
          <h3 className="text-base font-bold text-slate-900">All Leads are Assigned!</h3>
          <p className="text-xs text-slate-500 max-w-md mx-auto mt-1">
            There are no unassigned leads pending in the queue. All customer records have been allocated to team handlers.
          </p>
          {onSelectWorkspaceTab && (
            <button
              type="button"
              id="btn-switch-to-assigned-empty"
              onClick={() => handleSelectSectionInTable("assigned")}
              className="mt-4 inline-flex items-center gap-1.5 px-4 py-2 text-xs font-bold text-white bg-indigo-600 hover:bg-indigo-700 rounded-xl shadow-xs transition-colors cursor-pointer"
            >
              <UserCheck className="w-4 h-4" />
              <span>View Assigned Leads Section ({scopeAssignedCount})</span>
            </button>
          )}
        </div>
      );
    }

    if (parsedSection === "assigned") {
      return (
        <div className="bg-white border border-slate-200 rounded-2xl p-10 text-center shadow-xs">
          <div className="w-12 h-12 bg-amber-50 text-amber-600 rounded-full flex items-center justify-center mx-auto mb-3">
            <AlertCircle className="w-6 h-6" />
          </div>
          <h3 className="text-base font-bold text-slate-900">No Assigned Leads Under Current Filter</h3>
          <p className="text-xs text-slate-500 max-w-md mx-auto mt-1">
            There are currently no leads assigned matching your criteria. Switch to the Unassigned Leads queue to allocate incoming records.
          </p>
          {onSelectWorkspaceTab && (
            <button
              type="button"
              id="btn-switch-to-unassigned-empty"
              onClick={() => handleSelectSectionInTable("unassigned")}
              className="mt-4 inline-flex items-center gap-1.5 px-4 py-2 text-xs font-bold text-white bg-amber-600 hover:bg-amber-700 rounded-xl shadow-xs transition-colors cursor-pointer"
            >
              <AlertCircle className="w-4 h-4" />
              <span>View Unassigned Leads Queue ({scopeUnassignedCount})</span>
            </button>
          )}
        </div>
      );
    }

    return (
      <div className="bg-white border border-slate-200 rounded-2xl p-12 text-center shadow-xs">
        <div className="w-12 h-12 bg-slate-100 rounded-full flex items-center justify-center mx-auto mb-3 text-slate-400">
          <Phone className="w-6 h-6" />
        </div>
        <h3 className="text-base font-bold text-slate-800">No leads found</h3>
        <p className="text-xs text-slate-500 max-w-sm mx-auto mt-1">
          {activeDateFilter && activeDateFilter !== "all"
            ? `No records found under date "${activeDateFilter}". Try clearing the date filter.`
            : "Upload an Excel spreadsheet (.xlsx, .xls) above or adjust your search filters to view lead records."}
        </p>
        {((activeDateFilter && activeDateFilter !== "all" && onClearDateFilter) ||
          (activeFileFilter && activeFileFilter !== "all" && onClearFileFilter)) && (
          <button
            type="button"
            onClick={() => {
              if (onClearDateFilter) onClearDateFilter();
              if (onClearFileFilter) onClearFileFilter();
            }}
            className="mt-3 px-3 py-1.5 text-xs font-semibold text-indigo-700 bg-indigo-50 hover:bg-indigo-100 border border-indigo-200 rounded-lg cursor-pointer transition-colors"
          >
            Clear Active Date / File Filter
          </button>
        )}
      </div>
    );
  }

  return (
    <div className="bg-white border border-slate-200/90 rounded-2xl shadow-xs relative">
      {/* Top View Mode Bar: Main List vs Unassigned List vs Assigned Section */}
      <div className="bg-slate-50/90 border-b border-slate-200/80 px-4 py-3 flex flex-col sm:flex-row sm:items-center justify-between gap-3 rounded-t-2xl">
        <div className="flex items-center gap-2.5">
          {parsedSection === "unassigned" ? (
            <div className="flex items-center gap-2">
              <span className="p-1.5 rounded-lg bg-amber-100 text-amber-800">
                <AlertCircle className="w-4 h-4" />
              </span>
              <div>
                <h3 className="text-xs sm:text-sm font-bold text-slate-900 flex items-center flex-wrap gap-2">
                  <span>
                    {isFileScoped && activeFileName
                      ? `Unassigned List — ${activeFileName}`
                      : "Unassigned List (Master Queue)"}
                  </span>
                  <span className="text-xs font-extrabold px-2.5 py-0.5 rounded-full bg-amber-600 text-white shadow-2xs tabular-nums">
                    {leads.length} Clients Listed
                  </span>
                  <span className="text-[11px] font-bold px-2 py-0.5 rounded-full bg-amber-100 text-amber-900 border border-amber-300 tabular-nums">
                    {scopeUnassignedCount} Pending in this upload
                  </span>
                </h3>
                <p className="text-[11px] text-slate-500">
                  Selecting a handler below automatically assigns the lead and moves it to the <strong>Assigned Section</strong>.
                </p>
              </div>
            </div>
          ) : parsedSection === "assigned" ? (
            <div className="flex items-center gap-2">
              <span className="p-1.5 rounded-lg bg-indigo-100 text-indigo-800">
                <UserCheck className="w-4 h-4" />
              </span>
              <div>
                <h3 className="text-xs sm:text-sm font-bold text-slate-900 flex items-center flex-wrap gap-2">
                  <span>
                    {isFileScoped && activeFileName
                      ? `Assigned Section — ${activeFileName}`
                      : "Assigned Section (Active Team Workload)"}
                  </span>
                  <span className="text-xs font-extrabold px-2.5 py-0.5 rounded-full bg-indigo-600 text-white shadow-2xs tabular-nums">
                    {leads.length} Clients Listed
                  </span>
                  <span className="text-[11px] font-bold px-2 py-0.5 rounded-full bg-indigo-100 text-indigo-900 border border-indigo-300 tabular-nums">
                    {scopeAssignedCount} Assigned in this upload
                  </span>
                </h3>
                <p className="text-[11px] text-slate-500">
                  Team handler allocation. Selecting "Unassigned" returns a lead back to the <strong>Unassigned List</strong>.
                </p>
              </div>
            </div>
          ) : isFileScoped ? (
            <div className="flex items-center gap-2">
              <span className="p-1.5 rounded-lg bg-blue-100 text-blue-800">
                <Layers className="w-4 h-4" />
              </span>
              <div>
                <h3 className="text-xs sm:text-sm font-bold text-slate-900 flex items-center flex-wrap gap-2">
                  <span>Main List — {activeFileName || "Excel Import"}</span>
                  <span className="text-xs font-extrabold px-2.5 py-0.5 rounded-full bg-blue-600 text-white shadow-2xs tabular-nums">
                    {leads.length} Clients Listed
                  </span>
                  {leads.length !== scopeTotalCount && (
                    <span className="text-[11px] font-bold px-2 py-0.5 rounded-full bg-slate-100 text-slate-600 border border-slate-200 tabular-nums">
                      of {scopeTotalCount} in this sheet
                    </span>
                  )}
                </h3>
                <p className="text-[11px] text-slate-500">
                  Spreadsheet isolated view ({scopeUnassignedCount} unassigned, {scopeAssignedCount} assigned).
                </p>
              </div>
            </div>
          ) : (
            <div className="flex items-center gap-2.5">
              <span className="p-2 rounded-xl bg-slate-900 text-white shadow-xs">
                <Layers className="w-4 h-4" />
              </span>
              <div>
                <h3 className="text-xs sm:text-sm font-bold text-slate-900 flex items-center flex-wrap gap-2">
                  <span>All Leads Directory (Master Pipeline)</span>
                  <span className="text-xs font-extrabold px-2.5 py-0.5 rounded-full bg-indigo-600 text-white shadow-2xs tabular-nums">
                    {leads.length} Clients Listed
                  </span>
                  {leads.length !== totalAllCount && (
                    <span className="text-[11px] font-bold px-2 py-0.5 rounded-full bg-slate-100 text-slate-600 border border-slate-200 tabular-nums">
                      of {totalAllCount} Total Clients
                    </span>
                  )}
                  {leads.length !== totalAllCount && onSelectWorkspaceTab && (
                    <button
                      type="button"
                      onClick={() => onSelectWorkspaceTab("all")}
                      className="text-[11px] font-bold px-2 py-0.5 rounded-full bg-indigo-50 text-indigo-700 border border-indigo-200 hover:bg-indigo-100 tabular-nums cursor-pointer"
                      title="Clear filters and show all clients in master directory"
                    >
                      Show All {totalAllCount} Clients →
                    </button>
                  )}
                </h3>
                <p className="text-[11px] text-slate-500">
                  Master directory showing {leads.length} client{leads.length === 1 ? "" : "s"} listed across all uploaded spreadsheets ({totalAllUnassigned} unassigned, {totalAllAssigned} assigned).
                </p>
              </div>
            </div>
          )}
        </div>

        {/* View Switcher Segmented Tabs for the Active Scope */}
        {onSelectWorkspaceTab && (
          <div className="flex items-center gap-1 bg-white p-1 rounded-xl border border-slate-200 shadow-2xs shrink-0 self-start sm:self-auto">
            {/* Main List Button */}
            <button
              id="table-view-main"
              type="button"
              onClick={() => handleSelectSectionInTable("main")}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                parsedSection === "main"
                  ? "bg-slate-900 text-white shadow-xs"
                  : "text-slate-600 hover:text-slate-900 hover:bg-slate-100"
              }`}
              title="View full main list of clients"
            >
              <Layers className="w-3.5 h-3.5" />
              <span>Main List</span>
              <span
                className={`text-[10px] px-1.5 py-0.5 rounded-full font-extrabold tabular-nums ${
                  parsedSection === "main"
                    ? "bg-slate-800 text-white"
                    : "bg-slate-100 text-slate-700"
                }`}
              >
                {scopeTotalCount}
              </span>
            </button>

            {/* Unassigned List Button */}
            <button
              id="table-view-unassigned"
              type="button"
              onClick={() => handleSelectSectionInTable("unassigned")}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                parsedSection === "unassigned"
                  ? "bg-amber-600 text-white shadow-xs"
                  : "text-slate-600 hover:text-slate-900 hover:bg-slate-100"
              }`}
              title="Switch to Unassigned Leads queue"
            >
              <AlertCircle className="w-3.5 h-3.5" />
              <span>Unassigned List</span>
              <span
                className={`text-[10px] px-1.5 py-0.5 rounded-full font-extrabold tabular-nums ${
                  parsedSection === "unassigned"
                    ? "bg-amber-700 text-white"
                    : "bg-amber-100 text-amber-900"
                }`}
              >
                {scopeUnassignedCount}
              </span>
            </button>

            {/* Assigned Section Button */}
            <button
              id="table-view-assigned"
              type="button"
              onClick={() => handleSelectSectionInTable("assigned")}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                parsedSection === "assigned"
                  ? "bg-indigo-600 text-white shadow-xs"
                  : "text-slate-600 hover:text-slate-900 hover:bg-slate-100"
              }`}
              title="Switch to Assigned Leads section"
            >
              <UserCheck className="w-3.5 h-3.5" />
              <span>Assigned Section</span>
              <span
                className={`text-[10px] px-1.5 py-0.5 rounded-full font-extrabold tabular-nums ${
                  parsedSection === "assigned"
                    ? "bg-indigo-700 text-white"
                    : "bg-indigo-100 text-indigo-900"
                }`}
              >
                {scopeAssignedCount}
              </span>
            </button>

            {/* Interested Clients Button */}
            <button
              id="table-view-interested"
              type="button"
              onClick={() => handleSelectSectionInTable("interested")}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                parsedSection === "interested"
                  ? "bg-emerald-600 text-white shadow-xs"
                  : "text-slate-600 hover:text-slate-900 hover:bg-slate-100"
              }`}
              title="Switch to Interested Clients queue"
            >
              <CreditCard className="w-3.5 h-3.5" />
              <span>Interested Clients</span>
              <span
                className={`text-[10px] px-1.5 py-0.5 rounded-full font-extrabold tabular-nums ${
                  parsedSection === "interested"
                    ? "bg-emerald-700 text-white"
                    : "bg-emerald-100 text-emerald-900"
                }`}
              >
                {scopeInterestedCount}
              </span>
            </button>

            {/* Quick Completion Reports button when viewing Interested Clients */}
            {parsedSection === "interested" && onOpenCompletionReports && (
              <button
                type="button"
                id="btn-table-completion-reports"
                onClick={onOpenCompletionReports}
                className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-bold bg-emerald-50 hover:bg-emerald-100 text-emerald-700 border border-emerald-200 transition-all cursor-pointer shadow-2xs ml-1"
                title="Open Weekly & Monthly Completion Reports"
              >
                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                <span className="hidden lg:inline">Completion Reports</span>
              </button>
            )}

            {/* Quick Assigned Leads PDF Download button */}
            {parsedSection === "assigned" && onOpenPdfReport && (
              <button
                type="button"
                id="btn-table-assigned-pdf"
                onClick={() =>
                  onOpenPdfReport(activeDateFilter !== "all" ? activeDateFilter : undefined)
                }
                className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-bold bg-indigo-50 hover:bg-indigo-100 text-indigo-700 border border-indigo-200 transition-all cursor-pointer shadow-2xs ml-1"
                title="Download assigned leads as a PDF report organized by date"
              >
                <Download className="w-3.5 h-3.5 text-indigo-600" />
                <span className="hidden lg:inline">Download Assigned PDF</span>
              </button>
            )}

            {/* Master All Directory Switcher (if file scoped) */}
            {isFileScoped && (
              <button
                id="table-view-all"
                type="button"
                onClick={() => onSelectWorkspaceTab("all")}
                className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-semibold text-indigo-700 hover:bg-indigo-50 border border-transparent hover:border-indigo-200 transition-all cursor-pointer"
                title="View all leads directory across all uploaded spreadsheets"
              >
                <Layers className="w-3.5 h-3.5 text-indigo-600" />
                <span className="hidden md:inline">All Sheets</span>
                <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-indigo-100 text-indigo-800 font-bold tabular-nums">
                  {totalAllCount}
                </span>
              </button>
            )}
          </div>
        )}
      </div>

      {/* Horizontal Viewport Quick Navigation, Old Leads Search Bar & Pagination Controls */}
      <div
        id="table-header-navigation-controls"
        style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}
        className="bg-slate-50/90 border-b border-slate-200/90 px-4 py-2.5 flex flex-col md:flex-row md:items-center md:justify-between gap-3 text-xs font-['Plus_Jakarta_Sans',sans-serif]"
      >
        {/* Left: Quick Jump Navigation Buttons */}
        <div className="flex items-center flex-wrap gap-2">
          <span className="text-[11px] font-bold text-slate-600 uppercase tracking-wider flex items-center gap-1.5">
            <SlidersHorizontal className="w-3.5 h-3.5 text-indigo-600" />
            <span className="hidden sm:inline">Sections:</span>
          </span>
          <div className="flex items-center gap-1">
            <button
              type="button"
              id="btn-quick-nav-client"
              onClick={() => handleJumpToSection(0)}
              className={`px-2.5 py-1 rounded-lg text-[11px] font-semibold border transition-all cursor-pointer ${
                scrollProgress <= 15
                  ? "bg-indigo-600 text-white border-indigo-700 shadow-2xs"
                  : "bg-white text-slate-700 border-slate-200 hover:bg-slate-100"
              }`}
              title="Jump to Full Name, Phone, Email & City"
            >
              ◀ 1. Client Details
            </button>
            <button
              type="button"
              id="btn-quick-nav-payment"
              onClick={() => handleJumpToSection(480)}
              className={`px-2.5 py-1 rounded-lg text-[11px] font-semibold border transition-all cursor-pointer ${
                scrollProgress > 15 && scrollProgress < 70
                  ? "bg-indigo-600 text-white border-indigo-700 shadow-2xs"
                  : "bg-white text-slate-700 border-slate-200 hover:bg-slate-100"
              }`}
              title="Jump to Call Status & Workflow"
            >
              2. Call Status
            </button>
            <button
              type="button"
              id="btn-quick-nav-workflow"
              onClick={() => handleJumpToSection(scrollTotalWidth || 1600)}
              className={`px-2.5 py-1 rounded-lg text-[11px] font-semibold border transition-all cursor-pointer ${
                scrollProgress >= 70
                  ? "bg-indigo-600 text-white border-indigo-700 shadow-2xs"
                  : "bg-white text-slate-700 border-slate-200 hover:bg-slate-100"
              }`}
              title="Jump to Handler & Queue, Manual Notes & Actions"
            >
              3. Handler & Notes ▶
            </button>
          </div>
        </div>

        {/* Right Header Area (Flex-End Alignment): Search input & button right next to table pagination navigation arrows */}
        <div className="flex items-center flex-wrap sm:flex-nowrap gap-2.5 justify-end w-full md:w-auto">
          {/* Integrated Search Input & Search Button */}
          {onSearchChange && (
            <div className="flex items-center gap-1.5 flex-1 sm:flex-initial">
              <div className="relative min-w-[190px] sm:min-w-[240px]">
                <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                <input
                  id="input-table-header-search"
                  type="text"
                  value={searchQuery || ""}
                  onChange={(e) => onSearchChange(e.target.value)}
                  placeholder="Search leads by name, city, phone..."
                  className="w-full pl-8 pr-7 py-1.5 text-xs bg-white border border-slate-200 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none transition-all placeholder:text-slate-400 shadow-2xs"
                />
                {searchQuery && (
                  <button
                    type="button"
                    onClick={() => onSearchChange("")}
                    className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 p-0.5 cursor-pointer"
                    title="Clear search"
                  >
                    <X className="w-3 h-3" />
                  </button>
                )}
              </div>
              <button
                id="btn-table-header-search"
                type="button"
                onClick={() => {
                  const el = document.getElementById("input-table-header-search") as HTMLInputElement;
                  if (el) el.focus();
                }}
                className="inline-flex items-center gap-1 px-3 py-1.5 text-xs font-semibold rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white shadow-2xs transition-colors cursor-pointer shrink-0"
                title="Search records in this table"
              >
                <Search className="w-3.5 h-3.5" />
                <span>Search</span>
              </button>
            </div>
          )}

          {/* Table Pagination & Step Scroll Navigation Controls */}
          <div className="flex items-center gap-1 bg-white border border-slate-200 rounded-lg p-0.5 shadow-2xs shrink-0">
            <button
              type="button"
              id="btn-nudge-left"
              onClick={() => handleScrollLeftStep(300)}
              disabled={!canScrollLeft}
              className="p-1.5 rounded text-slate-600 hover:bg-slate-100 hover:text-indigo-600 disabled:opacity-30 disabled:pointer-events-none cursor-pointer transition-colors"
              title="Scroll left 300px / Previous columns"
              aria-label="Previous columns"
            >
              <ChevronLeft className="w-3.5 h-3.5" />
            </button>
            <span className="text-[10px] font-mono font-bold text-slate-600 px-1.5 tabular-nums select-none">
              {Math.round(scrollProgress)}%
            </span>
            <button
              type="button"
              id="btn-nudge-right"
              onClick={() => handleScrollRightStep(300)}
              disabled={!canScrollRight}
              className="p-1.5 rounded text-slate-600 hover:bg-slate-100 hover:text-indigo-600 disabled:opacity-30 disabled:pointer-events-none cursor-pointer transition-colors"
              title="Scroll right 300px / Next columns"
              aria-label="Next columns"
            >
              <ChevronRight className="w-3.5 h-3.5" />
            </button>
          </div>

          {/* Freeze Full Name Pin Toggle */}
          <button
            type="button"
            id="btn-toggle-pin-name"
            onClick={() => setFreezeNameColumn(!freezeNameColumn)}
            className={`inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg border text-[11px] font-medium transition-all cursor-pointer shadow-2xs shrink-0 ${
              freezeNameColumn
                ? "bg-indigo-50 border-indigo-200 text-indigo-700 font-semibold"
                : "bg-white border-slate-200 text-slate-600 hover:bg-slate-50"
            }`}
            title={
              freezeNameColumn
                ? "Full Name is pinned while scrolling horizontally"
                : "Pin Full Name to stay visible while scrolling horizontally"
            }
          >
            <Pin className={`w-3 h-3 ${freezeNameColumn ? "rotate-45 text-indigo-600" : "text-slate-400"}`} />
            <span className="hidden sm:inline">{freezeNameColumn ? "Pinned" : "Pin"}</span>
          </button>
        </div>
      </div>
      {/* Active Filter Notification Bar */}
      {((activeDateFilter && activeDateFilter !== "all") ||
        (activeFileFilter && activeFileFilter !== "all")) && (
        <div className="bg-indigo-50/90 border-b border-indigo-200/80 px-4 py-2 flex items-center justify-between gap-2 text-xs">
          <div className="flex items-center gap-2">
            <Filter className="w-3.5 h-3.5 text-indigo-700" />
            <span className="font-semibold text-indigo-950">Active Filter:</span>
            {activeDateFilter && activeDateFilter !== "all" && (
              <span className="px-2 py-0.5 rounded-md bg-white border border-indigo-200 text-indigo-900 font-medium">
                Day: {formatUploadDayLabel(activeDateFilter).label} ({activeDateFilter})
              </span>
            )}
            {activeFileName && (
              <span className="px-2 py-0.5 rounded-md bg-white border border-indigo-200 text-indigo-900 font-medium truncate max-w-xs">
                File: {activeFileName}
              </span>
            )}
            <span className="text-slate-500">
              ({leads.length} {leads.length === 1 ? "lead" : "leads"} shown)
            </span>
          </div>

          <button
            type="button"
            onClick={() => {
              if (onClearDateFilter) onClearDateFilter();
              if (onClearFileFilter) onClearFileFilter();
            }}
            className="text-xs font-semibold text-indigo-700 hover:text-indigo-900 underline cursor-pointer"
          >
            Show All Days & Files
          </button>
        </div>
      )}

      {/* Batch Action Bar */}
      {selectedLeadIds.length > 0 && (
        <div className="bg-indigo-50/90 border-b border-indigo-200/70 px-4 py-2.5 flex flex-wrap items-center justify-between gap-3 text-xs">
          <div className="flex items-center gap-2">
            <span className="font-bold text-indigo-900 bg-indigo-100 px-2 py-0.5 rounded-md">
              {selectedLeadIds.length} lead{selectedLeadIds.length > 1 ? "s" : ""} selected
            </span>
            <button
              type="button"
              onClick={onClearSelection}
              className="text-indigo-700 hover:text-indigo-900 underline font-medium cursor-pointer"
            >
              Deselect all
            </button>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <span className="text-slate-600 font-medium">Batch mark:</span>
            <button
              type="button"
              onClick={() => onBatchUpdateStatus("Interested")}
              className="px-2.5 py-1 rounded bg-white text-emerald-700 border border-emerald-200 hover:bg-emerald-50 font-medium cursor-pointer transition-colors shadow-2xs"
            >
              Mark Interested
            </button>
            <button
              type="button"
              onClick={() => onBatchUpdateStatus("Requires Follow-up")}
              className="px-2.5 py-1 rounded bg-white text-amber-700 border border-amber-200 hover:bg-amber-50 font-medium cursor-pointer transition-colors shadow-2xs"
            >
              Requires Follow-up
            </button>

            {/* Batch Assign Handler */}
            {onBatchUpdateHandler && handlers && handlers.length > 0 && (
              <div className="flex items-center gap-1.5 bg-white px-2 py-1 rounded-lg border border-slate-200 text-xs shadow-2xs">
                <UserCheck className="w-3.5 h-3.5 text-indigo-600 shrink-0" />
                <span className="text-slate-600 font-medium">Assign Handler:</span>
                <select
                  id="select-batch-handler"
                  defaultValue=""
                  onChange={(e) => {
                    const chosen = e.target.value;
                    if (chosen) {
                      const isUnassigned = chosen.toLowerCase() === "unassigned";
                      const found = !isUnassigned
                        ? handlers.find((h) => h?.name && h.name.toLowerCase() === chosen.toLowerCase())
                        : undefined;
                      onBatchUpdateHandler(isUnassigned ? "" : chosen, found?.id);
                      e.target.value = "";
                    }
                  }}
                  className="bg-transparent font-semibold text-indigo-900 border-0 outline-none cursor-pointer"
                >
                  <option value="" disabled>Choose Handler...</option>
                  <option value="Unassigned">Unassigned</option>
                  {handlers.map((h) => (
                    <option key={h.id} value={h.name}>
                      {h.name}
                    </option>
                  ))}
                </select>
              </div>
            )}

            {hasPermission("reports:pdf") && onOpenPdfReport && (
              <button
                id="btn-batch-pdf-report"
                type="button"
                onClick={() => onOpenPdfReport("selected")}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-white text-slate-700 border border-slate-200 hover:bg-slate-50 font-medium cursor-pointer transition-colors shadow-2xs"
                title="Generate PDF report for selected leads"
              >
                <FileText className="w-3.5 h-3.5 text-indigo-600" />
                <span>PDF Report ({selectedLeadIds.length})</span>
              </button>
            )}

            {hasPermission("leads:delete_batch") && (
              <button
                id="btn-delete-selected-batch"
                type="button"
                onClick={onDeleteSelected}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-red-600 hover:bg-red-700 text-white font-semibold cursor-pointer shadow-xs transition-colors ml-1"
              >
                <Trash2 className="w-3.5 h-3.5" />
                Delete Selected ({selectedLeadIds.length})
              </button>
            )}
          </div>
        </div>
      )}

      <div
        id="table-scroll-container"
        ref={tableContainerRef}
        onScroll={handleTableScroll}
        onWheel={(e) => {
          if (e.shiftKey && e.deltaY !== 0 && tableContainerRef.current) {
            tableContainerRef.current.scrollLeft += e.deltaY;
          }
        }}
        className="overflow-x-auto custom-table-scrollbar"
      >
        <table className="w-full text-left border-collapse min-w-[1320px]">
          <thead className="sticky top-0 z-10 bg-slate-50/95 backdrop-blur-xs border-b border-slate-200/90 text-[11px] font-bold uppercase tracking-wider text-slate-600 shadow-2xs">
            <tr>
              {/* Checkbox column */}
              <th
                className={`py-3.5 pl-3 pr-2 w-14 text-center align-middle ${
                  freezeNameColumn ? "sticky left-0 z-30 bg-slate-50 border-r border-slate-200" : ""
                }`}
              >
                <div className="flex flex-col items-center justify-center gap-0.5">
                  <input
                    id="checkbox-select-all-leads"
                    type="checkbox"
                    checked={isAllSelected}
                    ref={(input) => {
                      if (input) input.indeterminate = isPartiallySelected;
                    }}
                    onChange={() => {
                      if (isAllSelected) {
                        onClearSelection();
                      } else {
                        onSelectAll();
                      }
                    }}
                    className="w-4 h-4 rounded text-indigo-600 focus:ring-indigo-500 cursor-pointer"
                    title="Select / Deselect all visible leads"
                  />
                  <span className="text-[9px] font-mono font-bold text-slate-500 uppercase tracking-tight">
                    No.
                  </span>
                </div>
              </th>
              {/* 1. Full Name */}
              <th
                className={`py-3.5 px-3 min-w-[190px] w-[210px] align-middle ${
                  freezeNameColumn ? "sticky left-14 z-30 bg-slate-50 border-r border-slate-200/90 shadow-xs" : ""
                }`}
              >
                Full Name
              </th>

              {/* 2. Phone Number */}
              <th className="py-3.5 px-3 min-w-[140px] w-[150px] align-middle">Phone Number (tel:)</th>

              {/* 3. Email ID */}
              <th className="py-3.5 px-3 min-w-[165px] w-[175px] align-middle">Email ID</th>

              {/* 4. City */}
              <th className="py-3.5 px-3 min-w-[95px] w-[105px] align-middle">City</th>

              {/* 5. Call Status */}
              <th className="py-3.5 px-3 min-w-[150px] w-[155px] align-middle">Call Status</th>

              {/* 6. Handlers */}
              <th className="py-3.5 px-3 min-w-[190px] w-[200px] align-middle">
                <div className="flex items-center gap-1.5 text-indigo-900 font-bold">
                  <UserCheck className="w-3.5 h-3.5 text-indigo-600 shrink-0" />
                  <span>Handler</span>
                </div>
              </th>

              {/* Dedicated Interested Columns */}
              {isInterestedSection && (
                <th className="py-3.5 px-3 min-w-[150px] w-[160px] align-middle">
                  <div className="flex items-center gap-1.5 text-emerald-800 font-bold">
                    <Calendar className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                    <span>Payment Date</span>
                  </div>
                </th>
              )}

              {isInterestedSection && (
                <th className="py-3.5 px-3 min-w-[140px] w-[150px] align-middle">
                  <div className="flex items-center gap-1.5 text-emerald-800 font-bold">
                    <CreditCard className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                    <span>Payment Method</span>
                  </div>
                </th>
              )}

              {isInterestedSection && (
                <th className="py-3.5 px-3 min-w-[140px] w-[150px] align-middle">
                  <div className="flex items-center gap-1.5 text-emerald-800 font-bold">
                    <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                    <span>Completion Status</span>
                  </div>
                </th>
              )}

              {/* 7. Manual Notes */}
              <th className="py-3.5 px-3 min-w-[280px] w-[310px] align-middle">
                <div className="flex items-center gap-1.5 text-indigo-700 font-bold">
                  <PenLine className="w-3.5 h-3.5 text-indigo-600 shrink-0" />
                  <span>Manual Notes (Type Here)</span>
                </div>
              </th>

              {/* 8. Actions */}
              <th className="py-3.5 pl-3 pr-4 w-[100px] text-right align-middle">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 text-xs sm:text-sm">
            {sortedDateKeys.map((dateKey) => {
              const dayLeads = groupedLeads[dateKey];
              const dayInfo = formatUploadDayLabel(dateKey);
              const dayLeadIds = dayLeads.map((l) => l.id);
              const isAllDaySelected =
                dayLeadIds.length > 0 && dayLeadIds.every((id) => selectedLeadIds.includes(id));

              return (
                <React.Fragment key={`day-section-${dateKey}`}>
                  {/* Organized Day Section Header Row */}
                  <tr
                    id={`day-section-header-${dateKey}`}
                    className="border-t-2 border-b border-slate-200/90 bg-slate-100/70 font-semibold transition-colors text-slate-900"
                  >
                    <td colSpan={isInterestedSection ? 12 : 9} className="py-2.5 px-4">
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <div className="flex items-center gap-2.5">
                          {dayInfo.isToday ? (
                            <span className="px-2.5 py-0.5 text-xs font-bold rounded-md bg-indigo-600 text-white shadow-2xs flex items-center gap-1">
                              <CalendarDays className="w-3 h-3" />
                              Today's Section
                            </span>
                          ) : dayInfo.isTomorrow ? (
                            <span className="px-2.5 py-0.5 text-xs font-bold rounded-md bg-slate-700 text-white shadow-2xs flex items-center gap-1">
                              <Calendar className="w-3 h-3" />
                              Tomorrow's Section
                            </span>
                          ) : (
                            <span className="px-2.5 py-0.5 text-xs font-bold rounded-md bg-slate-200 text-slate-700">
                              {dayInfo.label}
                            </span>
                          )}

                          <span className="text-xs sm:text-sm font-bold text-slate-900">
                            {dayInfo.subLabel || dayInfo.label}
                          </span>
                          <span className="text-xs text-slate-400 font-normal">
                            ({dateKey})
                          </span>

                          <span className="text-xs font-semibold px-2 py-0.5 rounded-md bg-white text-slate-700 border border-slate-200 shadow-2xs tabular-nums">
                            {dayLeads.length} {dayLeads.length === 1 ? "lead" : "leads"}
                          </span>
                        </div>

                        <div className="flex items-center gap-2">
                          {onOpenPdfReport && (
                            <button
                              type="button"
                              id={`btn-table-pdf-day-${dateKey}`}
                              onClick={() => onOpenPdfReport(dateKey)}
                              className="text-xs font-medium text-slate-700 hover:text-slate-900 bg-white hover:bg-slate-50 border border-slate-200 px-2.5 py-1 rounded-md cursor-pointer transition-colors shadow-2xs inline-flex items-center gap-1.5"
                              title={`Generate PDF report showing names and assigned handlers for ${dayInfo.label}`}
                            >
                              <FileText className="w-3.5 h-3.5 text-indigo-600" />
                              <span>{dayInfo.isToday ? "Today's PDF Report" : "Day PDF Report"}</span>
                            </button>
                          )}

                          <button
                            type="button"
                            onClick={() => {
                              if (onToggleSelectBatch) {
                                onToggleSelectBatch(dayLeadIds, !isAllDaySelected);
                              } else {
                                if (isAllDaySelected) {
                                  dayLeads.forEach((l) => {
                                    if (selectedLeadIds.includes(l.id)) onToggleSelectLead(l.id);
                                  });
                                } else {
                                  dayLeads.forEach((l) => {
                                    if (!selectedLeadIds.includes(l.id)) onToggleSelectLead(l.id);
                                  });
                                }
                              }
                            }}
                            className="text-xs font-medium text-slate-700 hover:text-slate-900 bg-white hover:bg-slate-50 border border-slate-200 px-2.5 py-1 rounded-md cursor-pointer transition-colors shadow-2xs"
                          >
                            {isAllDaySelected ? "Deselect Day" : `Select All in ${dayInfo.label}`}
                          </button>
                        </div>
                      </div>
                    </td>
                  </tr>

                  {/* Leads in this day's section */}
                  {dayLeads.map((lead) => (
                    <LeadTableRow
                      key={lead.id}
                      lead={lead}
                      clientNumber={idToIndexMap.get(lead.id)}
                      isSelected={selectedLeadIds.includes(lead.id)}
                      freezeNameColumn={freezeNameColumn}
                      onToggleSelectLead={onToggleSelectLead}
                      handlers={handlers}
                      onUpdateStatus={onUpdateStatus}
                      onUpdateHandler={onUpdateHandler}
                      onUpdateManualNotes={onUpdateManualNotes}
                      onDeleteLead={onDeleteLead}
                      onEditLead={onEditLead}
                      onOpenCallLog={onOpenCallLog}
                      isEditingMonth={editingMonthId === lead.id}
                      tempMonthText={tempMonthText}
                      setTempMonthText={setTempMonthText}
                      isMonthSaved={monthSavedId === lead.id}
                      isEmailCopied={copiedEmailId === lead.id}
                      onStartEditMonth={handleStartEditMonth}
                      onSaveMonth={handleSaveMonth}
                      onCancelEditMonth={handleCancelEditMonth}
                      onCopyEmail={handleCopyEmail}
                      onUpdatePaymentDate={onUpdatePaymentDate}
                      onUpdatePaymentMethod={onUpdatePaymentMethod}
                      onUpdateCompletionStatus={onUpdateCompletionStatus}
                      isInterestedSection={isInterestedSection}
                    />
                  ))}
                </React.Fragment>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* Persistent Sticky Horizontal Scrollbar Pinned to Viewport Bottom */}
      <div
        id="table-sticky-horizontal-scrollbar-bar"
        className="sticky bottom-0 z-20 bg-white/95 backdrop-blur-md border-t border-slate-200 px-4 py-2.5 shadow-lg flex flex-wrap items-center justify-between gap-3 text-xs"
      >
        <div className="flex items-center gap-2">
          <div className="flex items-center gap-1.5 font-semibold text-slate-800">
            <SlidersHorizontal className="w-4 h-4 text-indigo-600 shrink-0" />
            <span>Table Viewport</span>
          </div>
          <span className="text-[11px] text-slate-500 hidden sm:inline">
            {scrollProgress <= 15
              ? "Showing: Client info (Full Name, Phone, Email, City)"
              : scrollProgress >= 70
              ? "Showing: Workflow (Handler & Queue, Manual Notes, Actions)"
              : "Showing: Call Status & Stage"}
          </span>
        </div>

        {/* Center: Interactive Draggable Scrollbar Slider & Nudge Buttons */}
        <div className="flex items-center gap-2 flex-1 max-w-lg mx-auto">
          <button
            type="button"
            id="btn-sticky-scroll-left"
            onClick={() => handleScrollLeftStep(320)}
            disabled={!canScrollLeft}
            className="p-1.5 rounded-lg bg-slate-100 hover:bg-indigo-50 hover:text-indigo-700 disabled:opacity-30 disabled:pointer-events-none text-slate-700 border border-slate-200/80 transition-all cursor-pointer shadow-2xs shrink-0"
            title="Scroll table left (320px)"
          >
            <ChevronLeft className="w-4 h-4" />
          </button>

          {/* Interactive Draggable Slide Bar Track */}
          <div
            ref={trackRef}
            id="table-draggable-slide-bar"
            tabIndex={0}
            role="slider"
            aria-label="Table horizontal scroll position"
            aria-valuemin={0}
            aria-valuemax={100}
            aria-valuenow={Math.round(scrollProgress)}
            onPointerDown={handlePointerDownSlideBar}
            onWheel={handleSlideBarWheel}
            onKeyDown={(e) => {
              if (e.key === "ArrowLeft") {
                e.preventDefault();
                handleScrollLeftStep(140);
              } else if (e.key === "ArrowRight") {
                e.preventDefault();
                handleScrollRightStep(140);
              } else if (e.key === "Home") {
                e.preventDefault();
                handleJumpToSection(0);
              } else if (e.key === "End") {
                e.preventDefault();
                handleJumpToSection(scrollTotalWidth || 1600);
              }
            }}
            className="group/slider flex-1 h-7 flex items-center relative cursor-pointer select-none px-0.5 focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 rounded-full"
            title="Drag or click to smoothly glide across columns. Use mouse wheel or arrow keys."
          >
            {/* Visual Track Channel */}
            <div className="w-full h-3 bg-slate-200/90 group-hover/slider:bg-slate-300/80 rounded-full border border-slate-300/70 relative transition-colors shadow-inner flex items-center">
              {/* Subtle visual tick landmarks */}
              <div className="absolute left-[33%] top-0 bottom-0 w-px bg-slate-300/60" />
              <div className="absolute left-[66%] top-0 bottom-0 w-px bg-slate-300/60" />
            </div>

            {/* Draggable Active Thumb Handle */}
            <div
              className={`absolute top-0.5 bottom-0.5 rounded-full shadow-md flex items-center justify-center cursor-grab active:cursor-grabbing border border-indigo-400/50 ${
                isDragging
                  ? "bg-indigo-700 ring-2 ring-indigo-400/60 scale-y-105 shadow-indigo-300/50"
                  : "bg-gradient-to-r from-indigo-500 to-indigo-600 hover:from-indigo-600 hover:to-indigo-700 shadow-indigo-200"
              }`}
              style={{
                width: `${Math.max(14, Math.min(92, ((clientContainerWidth || 1) / (scrollTotalWidth || 1)) * 100))}%`,
                left: `${Math.max(0, Math.min(1, scrollLeftPos / Math.max(1, (scrollTotalWidth || 1) - (clientContainerWidth || 1)))) * (100 - Math.max(14, Math.min(92, ((clientContainerWidth || 1) / (scrollTotalWidth || 1)) * 100)))}%`,
                transition: isDragging ? "none" : "left 75ms ease-out, width 75ms ease-out",
              }}
            >
              {/* Subtle tactile grip lines inside thumb */}
              <div className="flex items-center gap-0.5 opacity-80 pointer-events-none">
                <span className="w-0.5 h-2.5 rounded-full bg-white/70" />
                <span className="w-0.5 h-2.5 rounded-full bg-white/90" />
                <span className="w-0.5 h-2.5 rounded-full bg-white/70" />
              </div>
            </div>
          </div>

          <button
            type="button"
            id="btn-sticky-scroll-right"
            onClick={() => handleScrollRightStep(320)}
            disabled={!canScrollRight}
            className="p-1.5 rounded-lg bg-slate-100 hover:bg-indigo-50 hover:text-indigo-700 disabled:opacity-30 disabled:pointer-events-none text-slate-700 border border-slate-200/80 transition-all cursor-pointer shadow-2xs shrink-0"
            title="Scroll table right (320px)"
          >
            <ChevronRight className="w-4 h-4" />
          </button>
        </div>

        {/* Quick Jump Buttons to Critical Columns */}
        <div className="flex items-center gap-1.5 shrink-0">
          <button
            type="button"
            id="btn-sticky-jump-client"
            onClick={() => handleJumpToSection(0)}
            className={`px-2.5 py-1 rounded-lg border text-xs font-semibold transition-all cursor-pointer ${
              scrollProgress <= 15
                ? "bg-indigo-600 text-white border-indigo-700 shadow-2xs"
                : "bg-white text-slate-700 border-slate-200 hover:bg-slate-50"
            }`}
            title="Jump to Full Name, Phone & Email"
          >
            ◀ Client Info
          </button>
          <button
            type="button"
            id="btn-sticky-jump-status"
            onClick={() => handleJumpToSection(480)}
            className={`px-2.5 py-1 rounded-lg border text-xs font-semibold transition-all cursor-pointer ${
              scrollProgress > 15 && scrollProgress < 70
                ? "bg-indigo-600 text-white border-indigo-700 shadow-2xs"
                : "bg-white text-slate-700 border-slate-200 hover:bg-slate-50"
            }`}
            title="Jump to Call Status & Specialist Handlers"
          >
            Call Status
          </button>
          <button
            type="button"
            id="btn-sticky-jump-handler"
            onClick={() => handleJumpToSection(scrollTotalWidth || 1600)}
            className={`px-2.5 py-1 rounded-lg border text-xs font-semibold transition-all cursor-pointer ${
              scrollProgress >= 70
                ? "bg-indigo-600 text-white border-indigo-700 shadow-2xs"
                : "bg-white text-slate-700 border-slate-200 hover:bg-slate-50"
            }`}
            title="Jump to Handler & Manual Notes"
          >
            Handler & Notes ▶
          </button>
        </div>
      </div>

      {/* Table Footer */}
      <div className="px-5 py-3 border-t border-slate-100 bg-slate-50/50 flex flex-col sm:flex-row items-center justify-between text-xs text-slate-500 gap-2">
        <span>
          Showing <strong className="text-slate-800 font-bold">{leads.length}</strong> client{leads.length === 1 ? "" : "s"} listed
          {isFileScoped
            ? ` in "${activeFileName || "Uploaded Sheet"}" (${scopeUnassignedCount} unassigned, ${scopeAssignedCount} assigned) • Master Directory: ${totalAllCount} clients`
            : leads.length !== totalAllCount
            ? ` (filtered from ${totalAllCount} total in directory)`
            : ` in master directory across all uploaded spreadsheets`}
          {` across ${sortedDateKeys.length} daily section${sortedDateKeys.length === 1 ? "" : "s"}`}
          {selectedLeadIds.length > 0 && ` • ${selectedLeadIds.length} selected`}
        </span>
        <div className="flex items-center gap-3">
          <span className="flex items-center gap-1">
            <span className="w-2 h-2 rounded-full bg-emerald-500 inline-block" />
            Interested
          </span>
          <span className="flex items-center gap-1">
            <span className="w-2 h-2 rounded-full bg-amber-500 inline-block" />
            Requires Follow-up
          </span>
          <span className="flex items-center gap-1">
            <span className="w-2 h-2 rounded-full bg-blue-500 inline-block" />
            Pending
          </span>
        </div>
      </div>
    </div>
  );
};
