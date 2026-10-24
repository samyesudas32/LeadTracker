import React, { useMemo, useState, useRef, useEffect } from "react";
import {
  FileSpreadsheet,
  Layers,
  AlertCircle,
  FileText,
  Calendar,
  Trash2,
  Download,
  Users,
  Sparkles,
  CheckCircle2,
  UserCheck,
  FolderOpen,
  ArrowRight,
  Search,
  ChevronDown,
  Check,
  X,
  CreditCard,
  BarChart2,
} from "lucide-react";
import { UploadedFileRecord, Lead, HandlerRecord } from "../types";
import { getLocalDateString } from "../utils/dateUtils";
import { isLeadAssignedToHandler, getLeadHandlerName } from "../utils/pdfGenerator";
import { getHandlerColorClasses } from "../data/handlerDefaults";

export function parseWorkspaceTab(tabId: string): {
  fileId: string;
  section: "main" | "unassigned" | "assigned" | "interested";
} {
  if (!tabId || tabId === "all") {
    return { fileId: "all", section: "main" };
  }
  if (tabId === "unassigned") {
    return { fileId: "all", section: "unassigned" };
  }
  if (tabId === "assigned") {
    return { fileId: "all", section: "assigned" };
  }
  if (tabId === "interested") {
    return { fileId: "all", section: "interested" };
  }
  if (tabId.startsWith("file-")) {
    const raw = tabId.replace("file-", "");
    const parts = raw.split(":");
    const fileId = parts[0];
    const section = (parts[1] as "main" | "unassigned" | "assigned" | "interested") || "main";
    return {
      fileId,
      section:
        section === "unassigned" || section === "assigned" || section === "interested"
          ? section
          : "main",
    };
  }
  return { fileId: "all", section: "main" };
}

export function buildWorkspaceTab(
  fileId: string,
  section: "main" | "unassigned" | "assigned" | "interested"
): string {
  if (fileId === "all") {
    return section;
  }
  return section === "main" ? `file-${fileId}` : `file-${fileId}:${section}`;
}

export interface LeadWorkspaceTabsProps {
  files: UploadedFileRecord[];
  leads: Lead[];
  activeTab: string; // "all" | "unassigned" | "assigned" | "interested" | `file-${fileId}` | `file-${fileId}:unassigned` | `file-${fileId}:assigned` | `file-${fileId}:interested`
  onSelectTab: (tabId: string) => void;
  onDeleteFile: (file: UploadedFileRecord) => void;
  onExportFileLeads: (file: UploadedFileRecord) => void;
  handlers: HandlerRecord[];
  onBatchAssignAllUnassigned: (handlerName: string, handlerId?: string) => void;
  onAutoDistributeUnassigned: () => void;
  onOpenPdfReport?: (dateStr?: string, fileId?: string) => void;
  onOpenCompletionReports?: () => void;
  selectedHandlerFilter?: string;
  onSelectHandlerFilter?: (handlerName: string) => void;
}

export const LeadWorkspaceTabs: React.FC<LeadWorkspaceTabsProps> = ({
  files,
  leads,
  activeTab,
  onSelectTab,
  onDeleteFile,
  onExportFileLeads,
  handlers,
  onBatchAssignAllUnassigned,
  onAutoDistributeUnassigned,
  onOpenPdfReport,
  onOpenCompletionReports,
  selectedHandlerFilter = "all",
  onSelectHandlerFilter,
}) => {
  const todayStr = getLocalDateString(0);

  // Parse active context: which file is active, and which section (main, unassigned, assigned)
  const { fileId: currentFileId, section: currentSection } = useMemo(
    () => parseWorkspaceTab(activeTab),
    [activeTab]
  );

  const activeFile = useMemo(() => {
    if (currentFileId === "all") return null;
    return files.find((f) => f.id === currentFileId) || null;
  }, [files, currentFileId]);

  // Leads in the active scope (either isolated to the active spreadsheet, or all leads across pipeline)
  const scopedLeads = useMemo(() => {
    if (!activeFile) return leads;
    return leads.filter(
      (l) => l.fileId === activeFile.id || l.uploadedFileName === activeFile.fileName
    );
  }, [leads, activeFile]);

  // Scoped unassigned leads
  const scopedUnassignedLeads = useMemo(() => {
    return scopedLeads.filter((l) => !isLeadAssignedToHandler(l, handlers));
  }, [scopedLeads, handlers]);

  // Scoped assigned leads
  const scopedAssignedLeads = useMemo(() => {
    return scopedLeads.filter((l) => isLeadAssignedToHandler(l, handlers));
  }, [scopedLeads, handlers]);

  // Scoped interested leads (leads with status === 'Interested')
  const scopedInterestedLeads = useMemo(() => {
    return scopedLeads.filter((l) => l.status === "Interested");
  }, [scopedLeads]);

  const scopeTotalCount = scopedLeads.length;
  const scopeUnassignedCount = scopedUnassignedLeads.length;
  const scopeAssignedCount = scopedAssignedLeads.length;
  const scopeInterestedCount = scopedInterestedLeads.length;

  // Global counts across all spreadsheets
  const totalAllCount = leads.length;
  const totalAllUnassigned = useMemo(
    () => leads.filter((l) => !isLeadAssignedToHandler(l, handlers)).length,
    [leads, handlers]
  );
  const totalAllAssigned = useMemo(
    () => leads.filter((l) => isLeadAssignedToHandler(l, handlers)).length,
    [leads, handlers]
  );
  const totalAllInterested = useMemo(
    () => leads.filter((l) => l.status === "Interested").length,
    [leads]
  );

  // Breakdown of assigned leads per handler in the current scope
  const handlerBreakdown = useMemo(() => {
    const counts: Record<string, number> = {};
    scopedAssignedLeads.forEach((l) => {
      const name = getLeadHandlerName(l, handlers);
      if (name && name.toLowerCase() !== "unassigned") {
        counts[name] = (counts[name] || 0) + 1;
      }
    });
    return counts;
  }, [scopedAssignedLeads, handlers]);

  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const dropdownRef = useRef<HTMLDivElement>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);

  // Close dropdown on click outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsDropdownOpen(false);
      }
    };
    if (isDropdownOpen) {
      document.addEventListener("mousedown", handleClickOutside);
    }
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [isDropdownOpen]);

  // Focus search input when dropdown opens
  useEffect(() => {
    if (isDropdownOpen) {
      setTimeout(() => {
        searchInputRef.current?.focus();
      }, 50);
    } else {
      setSearchQuery("");
    }
  }, [isDropdownOpen]);

  // Filtered files based on search
  const filteredFiles = useMemo(() => {
    if (!searchQuery.trim()) return files;
    const query = searchQuery.toLowerCase();
    return files.filter(
      (f) =>
        f.fileName.toLowerCase().includes(query) ||
        (f.uploadDate && f.uploadDate.toLowerCase().includes(query))
    );
  }, [files, searchQuery]);

  // Handler to switch section while preserving the current file scope
  const handleSectionSwitch = (newSection: "main" | "unassigned" | "assigned" | "interested") => {
    const newTab = buildWorkspaceTab(currentFileId, newSection);
    onSelectTab(newTab);
  };

  // Handler to switch file while preserving or resetting section
  const handleFileSwitch = (newFileId: string) => {
    const newTab = buildWorkspaceTab(newFileId, currentSection);
    onSelectTab(newTab);
  };

  return (
    <div id="section-lead-workspace-tabs" className="space-y-3">
      {/* ============================================================== */}
      {/* 1. Multi-Spreadsheet Workspaces: Searchable Sheet Combobox     */}
      {/* ============================================================== */}
      <div className="bg-white border border-slate-200/90 rounded-2xl p-3 sm:p-4 shadow-xs">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 pb-3 mb-3 border-b border-slate-100">
          <div className="flex items-center gap-2.5">
            <span className="p-2 rounded-xl bg-indigo-50 text-indigo-700 border border-indigo-100 shadow-2xs">
              <FolderOpen className="w-4 h-4" />
            </span>
            <div>
              <h2 className="text-xs sm:text-sm font-bold text-slate-900 flex items-center gap-2">
                <span>Multi-Spreadsheet Workspaces</span>
                <span className="text-[11px] font-bold px-2 py-0.5 rounded-full bg-indigo-100 text-indigo-800 tabular-nums">
                  {files.length} {files.length === 1 ? "Uploaded Sheet" : "Uploaded Sheets"}
                </span>
              </h2>
              <p className="text-[11px] text-slate-500">
                Easily search and access any uploaded Excel workbook with isolated Main, Unassigned, and Assigned queues.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 self-end sm:self-auto text-xs">
            {onOpenPdfReport && (
              <button
                type="button"
                id="btn-open-pdf-report-top"
                onClick={() => onOpenPdfReport(undefined, activeFile ? activeFile.id : undefined)}
                className="px-3 py-1.5 rounded-xl bg-indigo-50 hover:bg-indigo-100 text-indigo-700 font-bold border border-indigo-200/80 flex items-center gap-1.5 cursor-pointer transition-colors shadow-2xs"
                title="Download assigned leads PDF report organized by specific dates"
              >
                <FileText className="w-3.5 h-3.5 text-indigo-600" />
                <span>PDF Reports by Date</span>
              </button>
            )}
          </div>
        </div>

        {/* Searchable Dropdown Combobox Selector */}
        <div className="relative" ref={dropdownRef}>
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2">
            {/* Active Sheet Trigger Button */}
            <button
              type="button"
              id="btn-sheet-selector-dropdown-trigger"
              onClick={() => setIsDropdownOpen(!isDropdownOpen)}
              className={`flex-1 flex items-center justify-between gap-3 px-3.5 py-2.5 rounded-xl border text-left transition-all cursor-pointer ${
                isDropdownOpen
                  ? "bg-slate-50 border-indigo-500 ring-2 ring-indigo-500/20 shadow-xs"
                  : "bg-slate-50/80 hover:bg-slate-100/90 border-slate-200 text-slate-800"
              }`}
              title="Click to search and select from uploaded spreadsheets"
              aria-haspopup="listbox"
              aria-expanded={isDropdownOpen}
            >
              <div className="flex items-center gap-3 min-w-0">
                {activeFile ? (
                  <span className="p-2 rounded-lg bg-emerald-50 text-emerald-700 border border-emerald-200 shrink-0">
                    <FileSpreadsheet className="w-4 h-4" />
                  </span>
                ) : (
                  <span className="p-2 rounded-lg bg-slate-900 text-white shrink-0">
                    <Layers className="w-4 h-4" />
                  </span>
                )}
                <div className="min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-xs sm:text-sm font-bold text-slate-900 truncate max-w-[240px] sm:max-w-md">
                      {activeFile ? activeFile.fileName : "All Uploads Combined (Master Overview)"}
                    </span>
                    {activeFile && activeFile.uploadDate === todayStr && (
                      <span className="text-[9px] px-1.5 py-0.5 rounded font-extrabold uppercase tracking-wider bg-indigo-50 text-indigo-700 border border-indigo-200">
                        Today
                      </span>
                    )}
                  </div>
                  <div className="flex items-center gap-2 text-[11px] text-slate-500 mt-0.5">
                    {activeFile ? (
                      <>
                        <span>Uploaded: {activeFile.uploadDate}</span>
                        <span>•</span>
                        <span className="font-semibold text-slate-700">
                          {scopeTotalCount} {scopeTotalCount === 1 ? "Client" : "Clients"}
                        </span>
                        <span>•</span>
                        <span className={scopeUnassignedCount > 0 ? "text-amber-600 font-semibold" : "text-emerald-600 font-semibold"}>
                          {scopeUnassignedCount} Unassigned
                        </span>
                      </>
                    ) : (
                      <>
                        <span>Master pipeline</span>
                        <span>•</span>
                        <span className="font-semibold text-slate-700">
                          {totalAllCount} Total Clients
                        </span>
                        <span>•</span>
                        <span className={totalAllUnassigned > 0 ? "text-amber-600 font-semibold" : "text-emerald-600 font-semibold"}>
                          {totalAllUnassigned} Unassigned
                        </span>
                      </>
                    )}
                  </div>
                </div>
              </div>

              <div className="flex items-center gap-2 shrink-0">
                <span className="text-xs font-semibold text-indigo-600 bg-indigo-50 px-2 py-1 rounded-md border border-indigo-200/80 hidden sm:inline-flex items-center gap-1.5">
                  <span>Browse Workspaces</span>
                  <ChevronDown className={`w-3.5 h-3.5 transition-transform duration-200 ${isDropdownOpen ? "rotate-180" : ""}`} />
                </span>
                <ChevronDown className={`w-4 h-4 text-slate-400 sm:hidden transition-transform duration-200 ${isDropdownOpen ? "rotate-180" : ""}`} />
              </div>
            </button>

            {/* Quick Context Actions for the Active Selection */}
            {activeFile && (
              <div className="flex items-center gap-1.5 self-end sm:self-auto">
                <button
                  type="button"
                  id="btn-quick-switch-to-all"
                  onClick={() => handleFileSwitch("all")}
                  className="px-3 py-2 rounded-xl text-xs font-semibold text-slate-700 bg-white hover:bg-slate-50 border border-slate-200 transition-colors shadow-2xs cursor-pointer flex items-center gap-1.5"
                  title="Switch to master view combining all spreadsheets"
                >
                  <Layers className="w-3.5 h-3.5 text-slate-500" />
                  <span className="hidden md:inline">Master Overview</span>
                </button>

                <button
                  type="button"
                  id="btn-quick-export-sheet"
                  onClick={() => onExportFileLeads(activeFile)}
                  className="p-2 rounded-xl text-slate-700 bg-white hover:bg-slate-50 border border-slate-200 transition-colors shadow-2xs cursor-pointer"
                  title={`Export "${activeFile.fileName}" to Excel`}
                >
                  <Download className="w-4 h-4 text-slate-600" />
                </button>

                <button
                  type="button"
                  id="btn-quick-delete-sheet"
                  onClick={() => onDeleteFile(activeFile)}
                  className="p-2 rounded-xl text-slate-400 hover:text-red-600 bg-white hover:bg-red-50 border border-slate-200 hover:border-red-200 transition-colors shadow-2xs cursor-pointer"
                  title={`Delete "${activeFile.fileName}"`}
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            )}
          </div>

          {/* Searchable Dropdown Menu Popover */}
          {isDropdownOpen && (
            <div
              id="sheet-selector-dropdown-menu"
              className="absolute left-0 right-0 top-full mt-2 z-40 bg-white rounded-2xl shadow-2xl border border-slate-200 overflow-hidden animate-in fade-in zoom-in-95 duration-150"
            >
              {/* Search Bar Input */}
              <div className="p-3 border-b border-slate-100 bg-slate-50/80">
                <div className="relative">
                  <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                  <input
                    ref={searchInputRef}
                    id="input-sheet-selector-search"
                    type="text"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder="Search spreadsheets by filename or upload date..."
                    className="w-full pl-9 pr-8 py-2 text-xs bg-white border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none transition-all placeholder:text-slate-400 font-medium"
                  />
                  {searchQuery && (
                    <button
                      type="button"
                      onClick={() => setSearchQuery("")}
                      className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 p-0.5 rounded cursor-pointer"
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>
                <div className="flex items-center justify-between text-[11px] text-slate-500 mt-2 px-1">
                  <span>
                    Showing {filteredFiles.length} of {files.length} spreadsheet{files.length === 1 ? "" : "s"}
                  </span>
                  <span>Click to switch workspace</span>
                </div>
              </div>

              {/* Scrollable Sheet List */}
              <div className="max-h-72 overflow-y-auto divide-y divide-slate-100 p-1">
                {/* Option 0: All Uploads Combined (Always Accessible) */}
                <button
                  type="button"
                  id="sheet-dropdown-option-all"
                  onClick={() => {
                    handleFileSwitch("all");
                    setIsDropdownOpen(false);
                  }}
                  className={`w-full flex items-center justify-between gap-3 px-3 py-2.5 rounded-xl text-left transition-colors cursor-pointer ${
                    currentFileId === "all"
                      ? "bg-indigo-50 text-indigo-950 font-bold"
                      : "hover:bg-slate-50 text-slate-800"
                  }`}
                >
                  <div className="flex items-center gap-2.5 min-w-0">
                    <span
                      className={`p-1.5 rounded-lg shrink-0 ${
                        currentFileId === "all"
                          ? "bg-slate-900 text-white"
                          : "bg-slate-100 text-slate-700"
                      }`}
                    >
                      <Layers className="w-4 h-4" />
                    </span>
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-bold text-slate-900 truncate">
                          All Uploads Combined (Master Overview)
                        </span>
                        {currentFileId === "all" && (
                          <span className="text-[10px] px-1.5 py-0.2 rounded bg-indigo-600 text-white font-extrabold">
                            Active
                          </span>
                        )}
                      </div>
                      <span className="text-[11px] text-slate-500 block">
                        Master client directory across all spreadsheets
                      </span>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 shrink-0">
                    <span className="text-xs px-2 py-0.5 rounded-full bg-slate-100 text-slate-700 font-extrabold tabular-nums">
                      {totalAllCount} Clients
                    </span>
                    {totalAllUnassigned > 0 && (
                      <span className="text-[10px] px-1.5 py-0.5 rounded-md bg-amber-50 text-amber-700 border border-amber-200 font-semibold tabular-nums">
                        {totalAllUnassigned} Unassigned
                      </span>
                    )}
                    {currentFileId === "all" && (
                      <Check className="w-4 h-4 text-indigo-600" />
                    )}
                  </div>
                </button>

                {/* Option 1..N: Filtered Spreadsheets */}
                {filteredFiles.map((file) => {
                  const isFileActive = currentFileId === file.id;
                  const isToday = file.uploadDate === todayStr;
                  const fileLeadCount = leads.filter(
                    (l) => l.fileId === file.id || l.uploadedFileName === file.fileName
                  ).length;
                  const fileUnassigned = leads.filter(
                    (l) =>
                      (l.fileId === file.id || l.uploadedFileName === file.fileName) &&
                      !isLeadAssignedToHandler(l, handlers)
                  ).length;

                  return (
                    <div
                      key={file.id}
                      className={`group flex items-center justify-between gap-2 px-3 py-2 rounded-xl transition-colors ${
                        isFileActive ? "bg-indigo-50/70" : "hover:bg-slate-50"
                      }`}
                    >
                      <button
                        type="button"
                        id={`sheet-dropdown-option-${file.id}`}
                        onClick={() => {
                          handleFileSwitch(file.id);
                          setIsDropdownOpen(false);
                        }}
                        className="flex-1 flex items-center gap-2.5 min-w-0 text-left cursor-pointer"
                      >
                        <span
                          className={`p-1.5 rounded-lg shrink-0 ${
                            isFileActive
                              ? "bg-indigo-600 text-white"
                              : "bg-emerald-50 text-emerald-700 border border-emerald-200"
                          }`}
                        >
                          <FileSpreadsheet className="w-4 h-4" />
                        </span>

                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-1.5 flex-wrap">
                            <span
                              className={`text-xs font-bold truncate max-w-[200px] sm:max-w-xs ${
                                isFileActive ? "text-indigo-900" : "text-slate-900"
                              }`}
                              title={file.fileName}
                            >
                              {file.fileName}
                            </span>
                            {isToday && (
                              <span className="text-[9px] px-1.5 py-0.2 rounded font-extrabold uppercase tracking-wider bg-indigo-50 text-indigo-700 border border-indigo-200">
                                Today
                              </span>
                            )}
                            {isFileActive && (
                              <span className="text-[9px] px-1.5 py-0.2 rounded bg-indigo-600 text-white font-extrabold">
                                Active
                              </span>
                            )}
                          </div>
                          <div className="flex items-center gap-2 text-[10px] text-slate-400">
                            <span>Uploaded: {file.uploadDate}</span>
                          </div>
                        </div>

                        <div className="flex items-center gap-2 shrink-0">
                          <span className="text-[11px] px-2 py-0.5 rounded-full bg-slate-100 text-slate-700 font-bold tabular-nums">
                            {fileLeadCount} {fileLeadCount === 1 ? "lead" : "leads"}
                          </span>
                          <span
                            className={`text-[10px] px-1.5 py-0.5 rounded-md font-semibold tabular-nums ${
                              fileUnassigned > 0
                                ? "bg-amber-50 text-amber-700 border border-amber-200"
                                : "bg-emerald-50 text-emerald-700 border border-emerald-200"
                            }`}
                          >
                            {fileUnassigned > 0 ? `${fileUnassigned} Unassigned` : "All Assigned"}
                          </span>
                          {isFileActive && <Check className="w-4 h-4 text-indigo-600" />}
                        </div>
                      </button>

                      {/* Row Action Buttons */}
                      <div className="flex items-center gap-0.5 opacity-70 group-hover:opacity-100 transition-opacity pl-1 border-l border-slate-200/60">
                        {onOpenPdfReport && (
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              onOpenPdfReport(todayStr, file.id);
                            }}
                            className="p-1.5 rounded-lg text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 transition-colors cursor-pointer"
                            title={`Download PDF report for "${file.fileName}"`}
                          >
                            <FileText className="w-3.5 h-3.5" />
                          </button>
                        )}
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            onExportFileLeads(file);
                          }}
                          className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors cursor-pointer"
                          title={`Export "${file.fileName}" to Excel`}
                        >
                          <Download className="w-3.5 h-3.5" />
                        </button>
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            onDeleteFile(file);
                          }}
                          className="p-1.5 rounded-lg text-slate-400 hover:text-red-600 hover:bg-red-50 transition-colors cursor-pointer"
                          title={`Delete spreadsheet "${file.fileName}"`}
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                  );
                })}

                {filteredFiles.length === 0 && (
                  <div className="py-6 text-center text-xs text-slate-500">
                    <FileSpreadsheet className="w-8 h-8 mx-auto text-slate-300 mb-2" />
                    <p className="font-semibold text-slate-700">No spreadsheets found</p>
                    <p className="text-[11px] text-slate-400 mt-0.5">
                      No files matching &quot;{searchQuery}&quot;
                    </p>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* ============================================================== */}
      {/* 2. Three Distinct Sections for the Active Upload:              */}
      {/*    [Main List] [Unassigned List] [Assigned Section]            */}
      {/* ============================================================== */}
      <div className="bg-slate-50 border border-slate-200 rounded-2xl p-2 sm:p-2.5 shadow-2xs">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-2 mb-2 border-b border-slate-200/80 px-1">
          <div className="flex items-center gap-2">
            <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">
              {activeFile ? (
                <span>
                  Viewing Upload:{" "}
                  <strong className="text-slate-900 font-extrabold">{activeFile.fileName}</strong>
                </span>
              ) : (
                <span>
                  Viewing: <strong className="text-slate-900 font-extrabold">All Uploads Combined</strong>
                </span>
              )}
            </span>
          </div>

          {activeFile && (
            <button
              type="button"
              onClick={() => handleFileSwitch("all")}
              className="text-[11px] font-bold text-indigo-600 hover:text-indigo-800 underline cursor-pointer inline-flex items-center gap-1 self-start sm:self-auto"
            >
              <span>Switch to Master Directory ({totalAllCount} clients)</span>
              <ArrowRight className="w-3 h-3" />
            </button>
          )}
        </div>

        {/* 4 Section Buttons: Main, Unassigned, Assigned, Interested */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2">
          {/* Section 1: Main List */}
          <button
            type="button"
            id="btn-section-main-list"
            onClick={() => handleSectionSwitch("main")}
            className={`flex items-center justify-between p-3 rounded-xl border text-left transition-all cursor-pointer ${
              currentSection === "main"
                ? "bg-white border-slate-900 text-slate-900 shadow-xs ring-2 ring-slate-900/10"
                : "bg-white/80 border-slate-200 text-slate-700 hover:bg-white hover:border-slate-300"
            }`}
          >
            <div className="flex items-center gap-2.5">
              <span
                className={`p-2 rounded-lg ${
                  currentSection === "main"
                    ? "bg-slate-900 text-white"
                    : "bg-slate-100 text-slate-600"
                }`}
              >
                <Layers className="w-4 h-4" />
              </span>
              <div>
                <span className="block text-xs sm:text-sm font-bold text-slate-900">
                  Main List
                </span>
                <span className="block text-[10px] text-slate-500">
                  {activeFile ? "All clients in this upload" : "All clients across directory"}
                </span>
              </div>
            </div>
            <span
              className={`text-xs px-2.5 py-1 rounded-full font-extrabold tabular-nums ${
                currentSection === "main"
                  ? "bg-slate-900 text-white"
                  : "bg-slate-100 text-slate-700"
              }`}
            >
              {scopeTotalCount} {scopeTotalCount === 1 ? "Client" : "Clients"}
            </span>
          </button>

          {/* Section 2: Unassigned List */}
          <button
            type="button"
            id="btn-section-unassigned-list"
            onClick={() => handleSectionSwitch("unassigned")}
            className={`flex items-center justify-between p-3 rounded-xl border text-left transition-all cursor-pointer ${
              currentSection === "unassigned"
                ? "bg-amber-600 text-white border-amber-700 shadow-xs ring-2 ring-amber-400/30"
                : "bg-white/80 border-slate-200 text-slate-700 hover:bg-white hover:border-amber-300"
            }`}
          >
            <div className="flex items-center gap-2.5">
              <span
                className={`p-2 rounded-lg ${
                  currentSection === "unassigned"
                    ? "bg-amber-700 text-white"
                    : "bg-amber-50 text-amber-700 border border-amber-200/60"
                }`}
              >
                <AlertCircle className="w-4 h-4" />
              </span>
              <div>
                <span
                  className={`block text-xs sm:text-sm font-bold ${
                    currentSection === "unassigned" ? "text-white" : "text-slate-900"
                  }`}
                >
                  Unassigned List
                </span>
                <span
                  className={`block text-[10px] ${
                    currentSection === "unassigned" ? "text-amber-100" : "text-slate-500"
                  }`}
                >
                  Pending handler allocation
                </span>
              </div>
            </div>
            <span
              className={`text-xs px-2.5 py-1 rounded-full font-extrabold tabular-nums ${
                currentSection === "unassigned"
                  ? "bg-amber-700 text-white"
                  : scopeUnassignedCount > 0
                  ? "bg-amber-500 text-white"
                  : "bg-slate-100 text-slate-600"
              }`}
            >
              {scopeUnassignedCount} {scopeUnassignedCount === 1 ? "Client" : "Clients"}
            </span>
          </button>

          {/* Section 3: Assigned Section */}
          <button
            type="button"
            id="btn-section-assigned-section"
            onClick={() => handleSectionSwitch("assigned")}
            className={`flex items-center justify-between p-3 rounded-xl border text-left transition-all cursor-pointer ${
              currentSection === "assigned"
                ? "bg-indigo-600 text-white border-indigo-700 shadow-xs ring-2 ring-indigo-400/30"
                : "bg-white/80 border-slate-200 text-slate-700 hover:bg-white hover:border-indigo-300"
            }`}
          >
            <div className="flex items-center gap-2.5">
              <span
                className={`p-2 rounded-lg ${
                  currentSection === "assigned"
                    ? "bg-indigo-700 text-white"
                    : "bg-indigo-50 text-indigo-700 border border-indigo-200/60"
                }`}
              >
                <UserCheck className="w-4 h-4" />
              </span>
              <div>
                <span
                  className={`block text-xs sm:text-sm font-bold ${
                    currentSection === "assigned" ? "text-white" : "text-slate-900"
                  }`}
                >
                  Assigned Section
                </span>
                <span
                  className={`block text-[10px] ${
                    currentSection === "assigned" ? "text-indigo-100" : "text-slate-500"
                  }`}
                >
                  Allocated to team handlers
                </span>
              </div>
            </div>
            <span
              className={`text-xs px-2.5 py-1 rounded-full font-extrabold tabular-nums ${
                currentSection === "assigned"
                  ? "bg-indigo-700 text-white"
                  : scopeAssignedCount > 0
                  ? "bg-indigo-600 text-white"
                  : "bg-slate-100 text-slate-600"
              }`}
            >
              {scopeAssignedCount} {scopeAssignedCount === 1 ? "Client" : "Clients"}
            </span>
          </button>

          {/* Section 4: Interested Clients (Dedicated Tab) */}
          <button
            type="button"
            id="btn-section-interested-clients"
            onClick={() => handleSectionSwitch("interested")}
            className={`flex items-center justify-between p-3 rounded-xl border text-left transition-all cursor-pointer ${
              currentSection === "interested"
                ? "bg-emerald-600 text-white border-emerald-700 shadow-xs ring-2 ring-emerald-400/30"
                : "bg-white/80 border-slate-200 text-slate-700 hover:bg-white hover:border-emerald-300"
            }`}
          >
            <div className="flex items-center gap-2.5">
              <span
                className={`p-2 rounded-lg ${
                  currentSection === "interested"
                    ? "bg-emerald-700 text-white"
                    : "bg-emerald-50 text-emerald-700 border border-emerald-200/60"
                }`}
              >
                <CreditCard className="w-4 h-4" />
              </span>
              <div>
                <span
                  className={`block text-xs sm:text-sm font-bold ${
                    currentSection === "interested" ? "text-white" : "text-slate-900"
                  }`}
                >
                  Interested Clients
                </span>
                <span
                  className={`block text-[10px] ${
                    currentSection === "interested" ? "text-emerald-100" : "text-slate-500"
                  }`}
                >
                  Payment & Completion
                </span>
              </div>
            </div>
            <span
              className={`text-xs px-2.5 py-1 rounded-full font-extrabold tabular-nums ${
                currentSection === "interested"
                  ? "bg-emerald-700 text-white"
                  : scopeInterestedCount > 0
                  ? "bg-emerald-600 text-white"
                  : "bg-slate-100 text-slate-600"
              }`}
            >
              {scopeInterestedCount} {scopeInterestedCount === 1 ? "Client" : "Clients"}
            </span>
          </button>
        </div>
      </div>

      {/* ============================================================== */}
      {/* 3. Contextual Toolbar for the Active Section & Scope           */}
      {/* ============================================================== */}
      {currentSection === "unassigned" && (
        <div
          id="unassigned-triage-toolbar"
          className="bg-white border border-amber-200 rounded-2xl p-4 shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-3 animate-in fade-in"
        >
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-xl bg-amber-50 text-amber-700 border border-amber-200 shadow-2xs">
              <AlertCircle className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <h3 className="text-sm font-bold text-slate-900">
                  Unassigned List & Allocation Queue
                </h3>
                <span className="text-xs font-bold px-2 py-0.5 rounded-md bg-amber-100 text-amber-900 border border-amber-300 tabular-nums">
                  {scopeUnassignedCount} pending in {activeFile ? activeFile.fileName : "all sheets"}
                </span>
                <span className="text-[11px] font-semibold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-md border border-emerald-200">
                  Selecting a handler auto-moves lead to Assigned Section
                </span>
              </div>
              <p className="text-xs text-slate-500 mt-0.5">
                Every record in this queue is awaiting handler assignment. When you select a handler from the table dropdown or use the quick buttons, the lead automatically transfers to the <strong>Assigned Section</strong>.
              </p>
            </div>
          </div>

          <div className="flex items-center flex-wrap gap-2 text-xs">
            {scopeUnassignedCount > 0 ? (
              <>
                <button
                  type="button"
                  id="btn-distribute-unassigned-tab"
                  onClick={onAutoDistributeUnassigned}
                  className="px-3.5 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-semibold flex items-center gap-1.5 cursor-pointer transition-colors shadow-2xs"
                  title="Evenly distribute unassigned leads to available team handlers"
                >
                  <Sparkles className="w-3.5 h-3.5" />
                  Distribute Evenly
                </button>

                <div className="flex items-center gap-1.5 bg-slate-50 px-2.5 py-1.5 rounded-xl border border-slate-200">
                  <Users className="w-3.5 h-3.5 text-slate-500" />
                  <span className="text-slate-600 font-medium">Assign All To:</span>
                  <select
                    id="select-assign-all-unassigned"
                    defaultValue=""
                    onChange={(e) => {
                      if (e.target.value) {
                        const targetHandler = handlers.find(
                          (h) => h.name.toLowerCase() === e.target.value.toLowerCase()
                        );
                        onBatchAssignAllUnassigned(e.target.value, targetHandler?.id);
                        e.target.value = "";
                      }
                    }}
                    className="bg-transparent text-slate-900 font-bold focus:outline-none cursor-pointer"
                  >
                    <option value="" disabled>
                      Select Handler...
                    </option>
                    {handlers.map((h) => (
                      <option key={h.id} value={h.name}>
                        {h.name}
                      </option>
                    ))}
                  </select>
                </div>
              </>
            ) : (
              <span className="text-xs text-emerald-700 font-bold flex items-center gap-1 bg-emerald-50 px-3 py-1.5 rounded-xl border border-emerald-200">
                <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                All leads in this upload are assigned!
              </span>
            )}
          </div>
        </div>
      )}

      {currentSection === "assigned" && (
        <div
          id="assigned-leads-toolbar"
          className="bg-white border border-indigo-200 rounded-2xl p-4 shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-3 animate-in fade-in"
        >
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-xl bg-indigo-50 text-indigo-700 border border-indigo-200 shadow-2xs">
              <UserCheck className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <h3 className="text-sm font-bold text-slate-900">
                  Assigned Leads Section
                </h3>
                <span className="text-xs font-bold px-2 py-0.5 rounded-md bg-indigo-100 text-indigo-900 border border-indigo-300 tabular-nums">
                  {scopeAssignedCount} assigned records in {activeFile ? activeFile.fileName : "all sheets"}
                </span>
                <span className="text-[11px] font-semibold text-slate-600 bg-slate-100 px-2 py-0.5 rounded-md">
                  Active Team Workload
                </span>
              </div>
              <p className="text-xs text-slate-500 mt-0.5">
                Shows all leads assigned to team handlers. Reassigning to "Unassigned" returns them back to the <strong>Unassigned List</strong>.
              </p>
            </div>
          </div>

          <div className="flex items-center flex-wrap gap-2 text-xs">
            {/* Quick Handler filter chips inside assigned section */}
            <div className="flex items-center gap-1.5 flex-wrap">
              <span className="text-slate-500 font-medium">Filter Handler:</span>
              <button
                type="button"
                onClick={() => onSelectHandlerFilter && onSelectHandlerFilter("all")}
                className={`px-2.5 py-1 rounded-lg font-semibold text-xs transition-colors cursor-pointer ${
                  selectedHandlerFilter === "all"
                    ? "bg-indigo-600 text-white"
                    : "bg-slate-100 text-slate-700 hover:bg-slate-200"
                }`}
              >
                All ({scopeAssignedCount})
              </button>
              {Object.entries(handlerBreakdown).map(([hName, count]) => {
                const hRecord = handlers.find(
                  (h) => h.name.toLowerCase() === hName.toLowerCase()
                );
                const colorCls = getHandlerColorClasses(hRecord?.color);
                const isSelected = selectedHandlerFilter?.toLowerCase() === hName.toLowerCase();
                return (
                  <button
                    key={hName}
                    type="button"
                    onClick={() =>
                      onSelectHandlerFilter &&
                      onSelectHandlerFilter(isSelected ? "all" : hName)
                    }
                    className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-bold border transition-colors cursor-pointer ${
                      isSelected
                        ? "bg-slate-900 text-white border-slate-900"
                        : `${colorCls.badge} hover:opacity-90`
                    }`}
                  >
                    <span className={`w-1.5 h-1.5 rounded-full ${colorCls.dot}`} />
                    <span>{hName}:</span>
                    <span>{count}</span>
                  </button>
                );
              })}
            </div>

            {onOpenPdfReport && (
              <button
                type="button"
                id="btn-download-assigned-leads-pdf"
                onClick={() =>
                  onOpenPdfReport(todayStr, activeFile ? activeFile.id : undefined)
                }
                className="px-3.5 py-1.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-bold flex items-center gap-1.5 cursor-pointer transition-colors shadow-2xs ml-auto"
                title="Download assigned leads as a PDF report organized by specific dates"
              >
                <Download className="w-3.5 h-3.5" />
                <span>Download Assigned Leads (PDF)</span>
              </button>
            )}
          </div>
        </div>
      )}

      {currentSection === "interested" && (
        <div
          id="interested-clients-toolbar"
          className="bg-white border border-emerald-200 rounded-2xl p-4 shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-3 animate-in fade-in"
        >
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-xl bg-emerald-50 text-emerald-700 border border-emerald-200 shadow-2xs">
              <CreditCard className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <h3 className="text-sm font-bold text-slate-900">
                  Interested Clients & Payment Workflow
                </h3>
                <span className="text-xs font-bold px-2 py-0.5 rounded-md bg-emerald-100 text-emerald-900 border border-emerald-300 tabular-nums">
                  {scopeInterestedCount} interested in {activeFile ? activeFile.fileName : "all sheets"}
                </span>
                <span className="text-[11px] font-semibold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-md border border-emerald-200">
                  {scopedInterestedLeads.filter((l) => l.completionStatus === "Completed").length} Completed
                </span>
                <span className="text-[11px] font-semibold text-amber-700 bg-amber-50 px-2 py-0.5 rounded-md border border-amber-200">
                  {scopedInterestedLeads.filter((l) => !l.completionStatus || l.completionStatus === "Pending").length} Pending
                </span>
                {scopedInterestedLeads.filter((l) => l.completionStatus === "Refunded").length > 0 && (
                  <span className="text-[11px] font-semibold text-rose-700 bg-rose-50 px-2 py-0.5 rounded-md border border-rose-200">
                    {scopedInterestedLeads.filter((l) => l.completionStatus === "Refunded").length} Refunded
                  </span>
                )}
              </div>
              <p className="text-xs text-slate-500 mt-0.5">
                Track <strong>Payment Date</strong>, select <strong>Payment Method</strong> (Card, Bank Transfer, UPI, Cash), and update <strong>Completion Status</strong>. Completed clients automatically populate into Weekly and Monthly performance reports.
              </p>
            </div>
          </div>

          <div className="flex items-center flex-wrap gap-2 text-xs">
            {onOpenCompletionReports && (
              <button
                type="button"
                id="btn-open-completion-reports-workspace"
                onClick={onOpenCompletionReports}
                className="px-3.5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold flex items-center gap-1.5 cursor-pointer transition-colors shadow-2xs"
                title="Open interactive Weekly & Monthly Completion Reports with PDF and Excel export"
              >
                <BarChart2 className="w-4 h-4" />
                <span>Completion Reports (Weekly / Monthly)</span>
              </button>
            )}
          </div>
        </div>
      )}

      {currentSection === "main" && activeFile && (
        <div
          id={`sheet-category-toolbar-${activeFile.id}`}
          className="bg-white border border-slate-200/90 rounded-2xl p-4 shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-3 animate-in fade-in"
        >
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-xl bg-emerald-50 text-emerald-700 border border-emerald-100 shadow-2xs">
              <FileSpreadsheet className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center flex-wrap gap-2">
                <h3 className="text-sm font-bold text-slate-900">
                  Main List: {activeFile.fileName}
                </h3>
                <span className="text-xs font-semibold px-2 py-0.5 rounded-md bg-slate-100 text-slate-700 border border-slate-200 tabular-nums">
                  {scopeTotalCount} Total Clients Listed
                </span>
                <span className="text-xs font-semibold px-2 py-0.5 rounded-md bg-slate-100 text-slate-700 border border-slate-200 flex items-center gap-1">
                  <Calendar className="w-3 h-3 text-slate-500" />
                  Upload Date: {activeFile.uploadDate === todayStr ? `Today (${activeFile.uploadDate})` : activeFile.uploadDate}
                </span>
                <span className="text-xs font-semibold px-2 py-0.5 rounded-md bg-amber-50 text-amber-800 border border-amber-200 tabular-nums">
                  {scopeUnassignedCount} unassigned
                </span>
                <span className="text-xs font-semibold px-2 py-0.5 rounded-md bg-indigo-50 text-indigo-800 border border-indigo-200 tabular-nums">
                  {scopeAssignedCount} assigned
                </span>
              </div>
              <p className="text-xs text-slate-500 mt-0.5">
                Isolated view showing all records imported from original spreadsheet <strong>{activeFile.fileName}</strong>.
              </p>
            </div>
          </div>

          <div className="flex items-center flex-wrap gap-2 text-xs">
            <button
              type="button"
              id={`btn-export-sheet-${activeFile.id}`}
              onClick={() => onExportFileLeads(activeFile)}
              className="px-3 py-1.5 rounded-xl bg-white hover:bg-slate-50 border border-slate-200 text-slate-700 font-semibold flex items-center gap-1.5 cursor-pointer transition-colors shadow-2xs"
              title="Export this sheet to Excel"
            >
              <Download className="w-3.5 h-3.5 text-slate-500" />
              Export Sheet
            </button>

            {onOpenPdfReport && (
              <button
                type="button"
                id={`btn-daily-pdf-sheet-${activeFile.id}`}
                onClick={() => onOpenPdfReport(todayStr, activeFile.id)}
                className="px-3 py-1.5 rounded-xl bg-indigo-50 hover:bg-indigo-100 border border-indigo-200 text-indigo-700 font-bold flex items-center gap-1.5 cursor-pointer transition-colors shadow-2xs"
                title={`Download daily assigned tasks PDF for "${activeFile.fileName}"`}
              >
                <FileText className="w-3.5 h-3.5 text-indigo-600" />
                <span>Daily PDF Report</span>
              </button>
            )}

            <button
              type="button"
              id={`btn-delete-sheet-${activeFile.id}`}
              onClick={() => onDeleteFile(activeFile)}
              className="px-3 py-1.5 rounded-xl bg-white hover:bg-red-50 border border-red-200 text-red-700 font-semibold flex items-center gap-1.5 cursor-pointer transition-colors"
              title="Delete this uploaded spreadsheet"
            >
              <Trash2 className="w-3.5 h-3.5 text-red-500" />
              Delete Sheet
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
