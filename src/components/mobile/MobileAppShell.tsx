import React, { useState, useMemo } from "react";
import {
  Users,
  UploadCloud,
  UserCheck,
  BarChart3,
  Search,
  X,
  Plus,
  Monitor,
  Check,
  Layers,
  ChevronDown,
} from "lucide-react";
import { Lead, HandlerRecord, CallStatus, UploadedFileRecord, CompletionStatus } from "../../types";
import { MobileLeadCard } from "./MobileLeadCard";
import { MobileBottomSheet } from "./MobileBottomSheet";
import { MobileUploadTab } from "./MobileUploadTab";
import { MobileWorkloadTab } from "./MobileWorkloadTab";
import { UploadFileInfo, ExtractedFileResult } from "../UploadSection";

export type MobileTab = "leads" | "upload" | "assigned" | "workload";

export interface MobileAppShellProps {
  leads: Lead[];
  handlers: HandlerRecord[];
  uploadedFiles: UploadedFileRecord[];
  onUpdateLead: (updatedLead: Lead) => void;
  onUpdateHandler: (leadId: string, newHandlerName: string, newHandlerId?: string) => void;
  onUpdateStatus: (leadId: string, newStatus: CallStatus) => void;
  onUpdateManualNotes: (leadId: string, manualNotes: string) => void;
  onDeleteLead?: (lead: Lead) => void;
  onOpenCallLog?: (lead: Lead) => void;
  onOpenNewLeadModal?: () => void;
  onOpenEditLeadModal?: (lead: Lead) => void;
  onLeadsExtracted: (
    newLeads: Lead[],
    mode: "append" | "replace",
    fileInfo?: UploadFileInfo
  ) => void;
  onMultipleFilesExtracted?: (
    results: ExtractedFileResult[],
    mode: "append" | "replace"
  ) => void;
  onSwitchToDesktop: () => void;
  onRequestSuperAdmin?: () => void;
  onOpenCompletionReports?: () => void;
  onUpdatePaymentDate?: (leadId: string, paymentDate: string) => void;
  onUpdatePaymentMethod?: (leadId: string, paymentMethod: string) => void;
  onUpdateCompletionStatus?: (leadId: string, completionStatus: CompletionStatus) => void;
}

const CALL_STATUS_OPTIONS: CallStatus[] = [
  "Pending Call",
  "Interested",
  "Requires Follow-up",
  "No Answer",
  "Not Interested",
];

export const MobileAppShell: React.FC<MobileAppShellProps> = ({
  leads,
  handlers,
  uploadedFiles: _uploadedFiles,
  onUpdateLead: _onUpdateLead,
  onUpdateHandler,
  onUpdateStatus,
  onUpdateManualNotes,
  onDeleteLead,
  onOpenCallLog,
  onOpenNewLeadModal,
  onOpenEditLeadModal,
  onLeadsExtracted,
  onMultipleFilesExtracted,
  onSwitchToDesktop,
  onRequestSuperAdmin: _onRequestSuperAdmin,
  onOpenCompletionReports,
  onUpdatePaymentDate,
  onUpdatePaymentMethod,
  onUpdateCompletionStatus,
}) => {
  const [activeTab, setActiveTab] = useState<MobileTab>("leads");
  const [searchQuery, setSearchQuery] = useState("");
  const [isSearchVisible, setIsSearchVisible] = useState(false);
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [selectedSpecialistFilter, setSelectedSpecialistFilter] = useState<string>("all");

  // Bottom Sheet States
  const [activeHandlerSheetLead, setActiveHandlerSheetLead] = useState<Lead | null>(null);
  const [activeStatusSheetLead, setActiveStatusSheetLead] = useState<Lead | null>(null);

  // Unassigned vs Assigned Lead Segments
  const assignedLeads = useMemo(() => {
    return leads.filter(
      (l) =>
        l.handlerName &&
        l.handlerName.trim() !== "" &&
        l.handlerName.toLowerCase() !== "unassigned" &&
        l.handlerName.toLowerCase() !== "none"
    );
  }, [leads]);

  // Filtered Leads based on current tab and search query
  const displayedLeads = useMemo(() => {
    let list = leads;

    // Tab-level restriction
    if (activeTab === "assigned") {
      list = assignedLeads;
    }

    // Specialist filter
    if (selectedSpecialistFilter !== "all") {
      if (selectedSpecialistFilter === "Unassigned") {
        list = list.filter(
          (l) =>
            !l.handlerName ||
            l.handlerName.trim() === "" ||
            l.handlerName.toLowerCase() === "unassigned" ||
            l.handlerName.toLowerCase() === "none"
        );
      } else {
        list = list.filter(
          (l) =>
            l.handlerName &&
            l.handlerName.toLowerCase() === selectedSpecialistFilter.toLowerCase()
        );
      }
    }

    // Status filter
    if (statusFilter !== "all") {
      list = list.filter((l) => l.status === statusFilter);
    }

    // Search query
    if (searchQuery.trim() !== "") {
      const q = searchQuery.toLowerCase().trim();
      list = list.filter(
        (l) =>
          l.fullName?.toLowerCase().includes(q) ||
          l.phoneNumber?.includes(q) ||
          l.email?.toLowerCase().includes(q) ||
          l.city?.toLowerCase().includes(q) ||
          l.handlerName?.toLowerCase().includes(q) ||
          l.paymentReceipt?.toLowerCase().includes(q)
      );
    }

    return list;
  }, [leads, assignedLeads, activeTab, selectedSpecialistFilter, statusFilter, searchQuery]);

  const handleReassignFromSheet = (cleanName: string, handlerId?: string) => {
    if (!activeHandlerSheetLead) return;
    const isUnassigned = !cleanName || cleanName.toLowerCase() === "unassigned";
    onUpdateHandler(
      activeHandlerSheetLead.id,
      isUnassigned ? "" : cleanName,
      isUnassigned ? undefined : handlerId
    );
    setActiveHandlerSheetLead(null);
  };

  const handleUpdateStatusFromSheet = (status: CallStatus) => {
    if (!activeStatusSheetLead) return;
    onUpdateStatus(activeStatusSheetLead.id, status);
    setActiveStatusSheetLead(null);
  };

  return (
    <div
      id="mobile-native-app-container"
      className="h-[100dvh] max-h-[100dvh] w-full overflow-hidden flex flex-col bg-slate-100 dark:bg-slate-950 text-slate-900 dark:text-slate-100 select-none"
    >
      {/* 1. Mobile Top App Bar (56px) */}
      <header className="h-14 shrink-0 px-4 bg-white/95 dark:bg-slate-900/95 backdrop-blur-md border-b border-slate-200/80 dark:border-slate-800 flex items-center justify-between z-30 pt-safe">
        <div className="flex items-center gap-2.5 truncate">
          <div className="w-8 h-8 rounded-xl bg-indigo-600 text-white flex items-center justify-center font-black text-sm shadow-xs shrink-0">
            LT
          </div>
          <div className="truncate">
            <h1 className="text-sm font-bold text-slate-900 dark:text-slate-100 leading-tight truncate">
              {activeTab === "leads" && "Client Leads"}
              {activeTab === "upload" && "Spreadsheet Import"}
              {activeTab === "assigned" && "Assigned Queue"}
              {activeTab === "workload" && "Team Workload"}
            </h1>
            <p className="text-[10px] text-slate-500 font-medium">
              {leads.length} Total Records
            </p>
          </div>
        </div>

        {/* Top Bar Quick Action Controls (>=44px touch targets) */}
        <div className="flex items-center gap-1">
          {activeTab !== "upload" && activeTab !== "workload" && (
            <button
              type="button"
              onClick={() => setIsSearchVisible(!isSearchVisible)}
              className="min-h-[44px] min-w-[44px] flex items-center justify-center rounded-xl text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 active:scale-95 transition-transform cursor-pointer"
              aria-label="Toggle search"
              title="Search leads"
            >
              <Search className="w-5 h-5" />
            </button>
          )}

          {onOpenNewLeadModal && (
            <button
              type="button"
              onClick={onOpenNewLeadModal}
              className="min-h-[44px] min-w-[44px] flex items-center justify-center rounded-xl text-indigo-600 dark:text-indigo-400 hover:bg-indigo-50 dark:hover:bg-indigo-950/50 active:scale-95 transition-transform cursor-pointer"
              aria-label="Add new lead"
              title="Create new record"
            >
              <Plus className="w-5 h-5 stroke-[2.5]" />
            </button>
          )}

          {onOpenCompletionReports && (
            <button
              type="button"
              onClick={onOpenCompletionReports}
              className="min-h-[44px] min-w-[44px] flex items-center justify-center rounded-xl text-emerald-600 dark:text-emerald-400 hover:bg-emerald-50 dark:hover:bg-emerald-950/50 active:scale-95 transition-transform cursor-pointer"
              aria-label="Completion Reports"
              title="Open Completion Reports (Weekly & Monthly)"
            >
              <BarChart3 className="w-5 h-5 stroke-[2.2]" />
            </button>
          )}

          {/* Desktop Mode Switcher */}
          <button
            type="button"
            onClick={onSwitchToDesktop}
            className="min-h-[44px] min-w-[44px] flex items-center justify-center rounded-xl text-slate-500 hover:text-slate-800 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 active:scale-95 transition-transform cursor-pointer"
            aria-label="Switch to desktop view"
            title="Switch to Desktop Mode"
          >
            <Monitor className="w-5 h-5" />
          </button>
        </div>
      </header>

      {/* Expandable Mobile Search Bar */}
      {isSearchVisible && (
        <div className="px-4 py-2 bg-white dark:bg-slate-900 border-b border-slate-200/80 dark:border-slate-800 flex items-center gap-2 animate-in slide-in-from-top-2 duration-150 shrink-0">
          <div className="flex-1 relative flex items-center">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 pointer-events-none" />
            <input
              type="text"
              autoFocus
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search by name, phone, city..."
              className="w-full min-h-[44px] pl-9 pr-9 text-xs bg-slate-100 dark:bg-slate-800 border-0 rounded-xl outline-none focus:ring-2 focus:ring-indigo-500/20 font-medium text-slate-900 dark:text-slate-100"
            />
            {searchQuery && (
              <button
                type="button"
                onClick={() => setSearchQuery("")}
                className="absolute right-2.5 min-h-[36px] min-w-[36px] flex items-center justify-center text-slate-400 hover:text-slate-600"
              >
                <X className="w-4 h-4" />
              </button>
            )}
          </div>
          <button
            type="button"
            onClick={() => {
              setIsSearchVisible(false);
              setSearchQuery("");
            }}
            className="min-h-[44px] px-2 text-xs font-semibold text-slate-500 hover:text-slate-800 dark:hover:text-slate-200"
          >
            Cancel
          </button>
        </div>
      )}

      {/* 2. Scrollable Body Canvas (Rest of Viewport) */}
      <main className="flex-1 overflow-y-auto overscroll-contain px-4 py-3 space-y-3">
        {/* Quick Segment Filters for Leads & Assigned Tabs */}
        {(activeTab === "leads" || activeTab === "assigned") && (
          <div className="space-y-2 pb-1">
            {/* Horizontal Status Chips Carousel */}
            <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar py-1 text-xs">
              <button
                type="button"
                onClick={() => setStatusFilter("all")}
                className={`min-h-[36px] px-3 rounded-full font-bold whitespace-nowrap cursor-pointer transition-all active:scale-95 ${
                  statusFilter === "all"
                    ? "bg-slate-900 dark:bg-white text-white dark:text-slate-900 shadow-xs"
                    : "bg-white dark:bg-slate-900 text-slate-600 dark:text-slate-300 border border-slate-200 dark:border-slate-800"
                }`}
              >
                All ({activeTab === "assigned" ? assignedLeads.length : leads.length})
              </button>

              {CALL_STATUS_OPTIONS.map((status) => {
                const count = (activeTab === "assigned" ? assignedLeads : leads).filter(
                  (l) => l.status === status
                ).length;
                return (
                  <button
                    key={status}
                    type="button"
                    onClick={() => setStatusFilter(status === statusFilter ? "all" : status)}
                    className={`min-h-[36px] px-3 rounded-full font-bold whitespace-nowrap cursor-pointer transition-all active:scale-95 ${
                      statusFilter === status
                        ? "bg-indigo-600 text-white shadow-xs"
                        : "bg-white dark:bg-slate-900 text-slate-600 dark:text-slate-300 border border-slate-200 dark:border-slate-800"
                    }`}
                  >
                    {status} ({count})
                  </button>
                );
              })}
            </div>

            {/* Specialist Filter Dropdown Pill */}
            {handlers.length > 0 && (
              <div className="flex items-center justify-between text-xs text-slate-500 pt-0.5">
                <span className="font-semibold">Specialist Filter:</span>
                <select
                  value={selectedSpecialistFilter}
                  onChange={(e) => setSelectedSpecialistFilter(e.target.value)}
                  className="min-h-[36px] px-2.5 py-1 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg text-slate-800 dark:text-slate-200 font-semibold cursor-pointer outline-none"
                >
                  <option value="all">All Specialists</option>
                  <option value="Unassigned">Unassigned Only</option>
                  {handlers.map((h) => (
                    <option key={h.id} value={h.name}>
                      {h.name}
                    </option>
                  ))}
                </select>
              </div>
            )}
          </div>
        )}

        {/* Tab 1: Leads View */}
        {activeTab === "leads" && (
          <div className="space-y-3 pb-20">
            {displayedLeads.map((lead) => (
              <MobileLeadCard
                key={lead.id}
                lead={lead}
                handlers={handlers}
                onUpdateHandler={onUpdateHandler}
                onUpdateStatus={onUpdateStatus}
                onUpdateNotes={onUpdateManualNotes}
                onOpenCallLog={onOpenCallLog}
                onEditLead={onOpenEditLeadModal}
                onDeleteLead={onDeleteLead}
                onSelectHandlerSheet={setActiveHandlerSheetLead}
                onSelectStatusSheet={setActiveStatusSheetLead}
                onUpdatePaymentDate={onUpdatePaymentDate}
                onUpdatePaymentMethod={onUpdatePaymentMethod}
                onUpdateCompletionStatus={onUpdateCompletionStatus}
              />
            ))}

            {displayedLeads.length === 0 && (
              <div className="bg-white dark:bg-slate-900 rounded-2xl p-8 text-center border border-slate-200 dark:border-slate-800 shadow-sm mt-4">
                <Users className="w-10 h-10 text-slate-300 mx-auto mb-2" />
                <h3 className="text-sm font-bold text-slate-800 dark:text-slate-200">
                  No Client Leads Match
                </h3>
                <p className="text-xs text-slate-500 mt-1 max-w-[240px] mx-auto">
                  Try clearing the search query or adjusting the status/specialist filter.
                </p>
                {(searchQuery || statusFilter !== "all" || selectedSpecialistFilter !== "all") && (
                  <button
                    type="button"
                    onClick={() => {
                      setSearchQuery("");
                      setStatusFilter("all");
                      setSelectedSpecialistFilter("all");
                    }}
                    className="mt-3 px-3 py-1.5 rounded-lg bg-indigo-50 dark:bg-indigo-950/60 text-indigo-600 dark:text-indigo-400 font-semibold text-xs cursor-pointer"
                  >
                    Reset Filters
                  </button>
                )}
              </div>
            )}
          </div>
        )}

        {/* Tab 2: Upload Excel / CSV View */}
        {activeTab === "upload" && (
          <div className="pb-20">
            <MobileUploadTab
              handlers={handlers}
              onLeadsExtracted={onLeadsExtracted}
              onMultipleFilesExtracted={onMultipleFilesExtracted}
              onSwitchToLeadsTab={() => setActiveTab("leads")}
            />
          </div>
        )}

        {/* Tab 3: Assigned Leads View */}
        {activeTab === "assigned" && (
          <div className="space-y-3 pb-20">
            {displayedLeads.map((lead) => (
              <MobileLeadCard
                key={lead.id}
                lead={lead}
                handlers={handlers}
                onUpdateHandler={onUpdateHandler}
                onUpdateStatus={onUpdateStatus}
                onUpdateNotes={onUpdateManualNotes}
                onOpenCallLog={onOpenCallLog}
                onEditLead={onOpenEditLeadModal}
                onDeleteLead={onDeleteLead}
                onSelectHandlerSheet={setActiveHandlerSheetLead}
                onSelectStatusSheet={setActiveStatusSheetLead}
                onUpdatePaymentDate={onUpdatePaymentDate}
                onUpdatePaymentMethod={onUpdatePaymentMethod}
                onUpdateCompletionStatus={onUpdateCompletionStatus}
              />
            ))}

            {displayedLeads.length === 0 && (
              <div className="bg-white dark:bg-slate-900 rounded-2xl p-8 text-center border border-slate-200 dark:border-slate-800 shadow-sm mt-4">
                <UserCheck className="w-10 h-10 text-slate-300 mx-auto mb-2" />
                <h3 className="text-sm font-bold text-slate-800 dark:text-slate-200">
                  No Assigned Leads Found
                </h3>
                <p className="text-xs text-slate-500 mt-1 max-w-[240px] mx-auto">
                  All current leads are unallocated or filtered out.
                </p>
                <button
                  type="button"
                  onClick={() => setActiveTab("leads")}
                  className="mt-3 px-3 py-1.5 rounded-lg bg-indigo-600 text-white font-semibold text-xs cursor-pointer"
                >
                  Go to Leads Queue
                </button>
              </div>
            )}
          </div>
        )}

        {/* Tab 4: Team Workload View */}
        {activeTab === "workload" && (
          <div className="pb-20">
            <MobileWorkloadTab
              leads={leads}
              handlers={handlers}
              onSelectHandlerFilter={(handlerName) => {
                setSelectedSpecialistFilter(handlerName);
                setActiveTab(handlerName === "Unassigned" ? "leads" : "assigned");
              }}
            />
          </div>
        )}
      </main>

      {/* 3. Sticky Bottom Navigation Dock (64px + safe area padding) */}
      <nav
        id="mobile-bottom-navigation-dock"
        aria-label="Mobile Navigation Dock"
        className="fixed bottom-0 left-0 right-0 z-40 bg-white/95 dark:bg-slate-900/95 backdrop-blur-md border-t border-slate-200/80 dark:border-slate-800 pb-safe"
      >
        <div className="grid grid-cols-4 items-center h-16 max-w-md mx-auto">
          {/* Tab 1: Leads */}
          <button
            type="button"
            onClick={() => setActiveTab("leads")}
            className={`min-h-[48px] flex flex-col items-center justify-center transition-all cursor-pointer ${
              activeTab === "leads"
                ? "text-indigo-600 dark:text-indigo-400 font-bold"
                : "text-slate-500 dark:text-slate-400 hover:text-slate-800"
            }`}
          >
            <div className="relative">
              <Users className="w-5 h-5" />
              {activeTab === "leads" && (
                <span className="absolute -bottom-1 left-1/2 -translate-x-1/2 w-1.5 h-1.5 bg-indigo-600 rounded-full" />
              )}
            </div>
            <span className="text-[11px] tracking-tight mt-1">Leads</span>
          </button>

          {/* Tab 2: Upload */}
          <button
            type="button"
            onClick={() => setActiveTab("upload")}
            className={`min-h-[48px] flex flex-col items-center justify-center transition-all cursor-pointer ${
              activeTab === "upload"
                ? "text-indigo-600 dark:text-indigo-400 font-bold"
                : "text-slate-500 dark:text-slate-400 hover:text-slate-800"
            }`}
          >
            <div className="relative">
              <UploadCloud className="w-5 h-5" />
              {activeTab === "upload" && (
                <span className="absolute -bottom-1 left-1/2 -translate-x-1/2 w-1.5 h-1.5 bg-indigo-600 rounded-full" />
              )}
            </div>
            <span className="text-[11px] tracking-tight mt-1">Upload</span>
          </button>

          {/* Tab 3: Assigned */}
          <button
            type="button"
            onClick={() => setActiveTab("assigned")}
            className={`min-h-[48px] flex flex-col items-center justify-center transition-all cursor-pointer ${
              activeTab === "assigned"
                ? "text-indigo-600 dark:text-indigo-400 font-bold"
                : "text-slate-500 dark:text-slate-400 hover:text-slate-800"
            }`}
          >
            <div className="relative">
              <UserCheck className="w-5 h-5" />
              {activeTab === "assigned" && (
                <span className="absolute -bottom-1 left-1/2 -translate-x-1/2 w-1.5 h-1.5 bg-indigo-600 rounded-full" />
              )}
            </div>
            <span className="text-[11px] tracking-tight mt-1">Assigned</span>
          </button>

          {/* Tab 4: Team Workload */}
          <button
            type="button"
            onClick={() => setActiveTab("workload")}
            className={`min-h-[48px] flex flex-col items-center justify-center transition-all cursor-pointer ${
              activeTab === "workload"
                ? "text-indigo-600 dark:text-indigo-400 font-bold"
                : "text-slate-500 dark:text-slate-400 hover:text-slate-800"
            }`}
          >
            <div className="relative">
              <BarChart3 className="w-5 h-5" />
              {activeTab === "workload" && (
                <span className="absolute -bottom-1 left-1/2 -translate-x-1/2 w-1.5 h-1.5 bg-indigo-600 rounded-full" />
              )}
            </div>
            <span className="text-[11px] tracking-tight mt-1">Workload</span>
          </button>
        </div>
      </nav>

      {/* 4. Modal Bottom Sheet: Quick Handler Reassignment (STRICT RULE: Clean Name Only) */}
      <MobileBottomSheet
        isOpen={Boolean(activeHandlerSheetLead)}
        onClose={() => setActiveHandlerSheetLead(null)}
        title="Assign Specialist"
        subtitle={activeHandlerSheetLead ? `Client: ${activeHandlerSheetLead.fullName}` : undefined}
      >
        <div className="space-y-1.5 pb-6">
          <p className="text-xs text-slate-500 mb-2 font-medium">
            Select a specialist or leave unassigned:
          </p>

          {/* Unassigned Option */}
          <button
            type="button"
            onClick={() => handleReassignFromSheet("")}
            className={`w-full min-h-[48px] px-4 py-3 rounded-xl border text-sm font-semibold flex items-center justify-between cursor-pointer active:scale-[0.98] transition-all ${
              !activeHandlerSheetLead?.handlerName ||
              activeHandlerSheetLead.handlerName.toLowerCase() === "unassigned" ||
              activeHandlerSheetLead.handlerName.toLowerCase() === "none"
                ? "bg-indigo-50 dark:bg-indigo-950/60 border-indigo-300 dark:border-indigo-700 text-indigo-900 dark:text-indigo-200"
                : "bg-slate-50 dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300"
            }`}
          >
            <span>Unassigned</span>
            {(!activeHandlerSheetLead?.handlerName ||
              activeHandlerSheetLead.handlerName.toLowerCase() === "unassigned" ||
              activeHandlerSheetLead.handlerName.toLowerCase() === "none") && (
              <Check className="w-4 h-4 text-indigo-600" />
            )}
          </button>

          {/* Handler Options: Displays ONLY clean name */}
          {handlers.map((h) => {
            const isSelected =
              activeHandlerSheetLead?.handlerName &&
              activeHandlerSheetLead.handlerName.toLowerCase() === h.name.toLowerCase();

            return (
              <button
                key={h.id}
                type="button"
                onClick={() => handleReassignFromSheet(h.name, h.id)}
                className={`w-full min-h-[48px] px-4 py-3 rounded-xl border text-sm font-semibold flex items-center justify-between cursor-pointer active:scale-[0.98] transition-all ${
                  isSelected
                    ? "bg-indigo-50 dark:bg-indigo-950/60 border-indigo-300 dark:border-indigo-700 text-indigo-900 dark:text-indigo-200"
                    : "bg-slate-50 dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300"
                }`}
              >
                <span>{h.name}</span>
                {isSelected && <Check className="w-4 h-4 text-indigo-600" />}
              </button>
            );
          })}
        </div>
      </MobileBottomSheet>

      {/* 5. Modal Bottom Sheet: Call Status Picker */}
      <MobileBottomSheet
        isOpen={Boolean(activeStatusSheetLead)}
        onClose={() => setActiveStatusSheetLead(null)}
        title="Update Call Status"
        subtitle={activeStatusSheetLead ? `Client: ${activeStatusSheetLead.fullName}` : undefined}
      >
        <div className="space-y-1.5 pb-6">
          {CALL_STATUS_OPTIONS.map((status) => {
            const isSelected = activeStatusSheetLead?.status === status;
            return (
              <button
                key={status}
                type="button"
                onClick={() => handleUpdateStatusFromSheet(status)}
                className={`w-full min-h-[48px] px-4 py-3 rounded-xl border text-sm font-semibold flex items-center justify-between cursor-pointer active:scale-[0.98] transition-all ${
                  isSelected
                    ? "bg-indigo-50 dark:bg-indigo-950/60 border-indigo-300 dark:border-indigo-700 text-indigo-900 dark:text-indigo-200"
                    : "bg-slate-50 dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300"
                }`}
              >
                <span>{status}</span>
                {isSelected && <Check className="w-4 h-4 text-indigo-600" />}
              </button>
            );
          })}
        </div>
      </MobileBottomSheet>
    </div>
  );
};
