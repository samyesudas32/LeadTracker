import React, { useState, useMemo, useEffect } from "react";
import {
  FileText,
  Download,
  Printer,
  Copy,
  Check,
  X,
  Calendar,
  UserCheck,
  Sliders,
  CheckCircle2,
  AlertCircle,
  FileSpreadsheet,
  ChevronDown,
  ChevronUp,
  Clock,
  ArrowRight,
  ShieldCheck,
  Sparkles,
  FolderOpen,
  FileDown,
  ExternalLink,
  Layers,
  History,
} from "lucide-react";
import { Lead, HandlerRecord, AppSettings, UploadedFileRecord, SheetChangeRecord } from "../types";
import {
  getLocalDateString,
  formatUploadDayLabel,
  formatTimeFromIso,
  getReportDateForTimestamp,
} from "../utils/dateUtils";
import { getHandlerColorClasses } from "../data/handlerDefaults";
import {
  downloadAssignedLeadsPdf,
  getAssignedLeadsPdfBlobUrl,
  getLeadsAssignedForDate,
  getLeadHandlerName,
  isLeadAssignedToHandler,
  getLeadEffectiveReportDate,
  PdfReportOptions,
} from "../utils/pdfGenerator";
import {
  cleanSheetName,
  getReportPdfFileName,
  getDailyChangesForSheet,
  getStoredChangeLogs,
} from "../utils/changeLogUtils";

interface PdfReportModalProps {
  isOpen: boolean;
  onClose: () => void;
  leads: Lead[];
  handlers: HandlerRecord[];
  settings: AppSettings;
  initialDateStr?: string; // Optional default date
  files?: UploadedFileRecord[]; // All uploaded spreadsheets
  initialFileId?: string; // Optional default spreadsheet filter
  initialHandler?: string; // Optional default handler filter
}

export const PdfReportModal: React.FC<PdfReportModalProps> = ({
  isOpen,
  onClose,
  leads,
  handlers,
  settings,
  initialDateStr,
  files = [],
  initialFileId,
  initialHandler,
}) => {
  const todayStr = getLocalDateString(0);
  const tomorrowStr = getLocalDateString(1);

  // Modal navigation tab: "organized_dates" | "customize_preview"
  const [modalTab, setModalTab] = useState<"organized_dates" | "customize_preview">(
    "organized_dates"
  );

  // Selected spreadsheet scope inside modal: "all" or specific fileId
  const [selectedFileId, setSelectedFileId] = useState<string>(initialFileId || "all");

  // Selected Date Filter Mode: "today" | "tomorrow" | "all" | "custom"
  const [dateMode, setDateMode] = useState<"today" | "tomorrow" | "all" | "custom">(() => {
    if (initialDateStr === "all") return "all";
    if (initialDateStr === tomorrowStr) return "tomorrow";
    if (initialDateStr && initialDateStr !== todayStr) return "custom";
    return "today";
  });
  const [customDate, setCustomDate] = useState<string>(
    initialDateStr && initialDateStr !== "all" ? initialDateStr : todayStr
  );

  // Selected Handler Filter
  const [selectedHandler, setSelectedHandler] = useState<string>(initialHandler || "all");

  // Customization Toggles
  const [reportTitle, setReportTitle] = useState("");
  const [orientation, setOrientation] = useState<"portrait" | "landscape">("landscape");
  const [groupByHandler, setGroupByHandler] = useState(true);
  const [includeChangesLog, setIncludeChangesLog] = useState(false);
  const [includeAllRecords, setIncludeAllRecords] = useState(false); // Default false: Download Assigned Leads Report!
  const [includeContactDetails, setIncludeContactDetails] = useState(true);
  const [includePaymentInfo, setIncludePaymentInfo] = useState(true);
  const [includeStatus, setIncludeStatus] = useState(true);
  const [includeNotes, setIncludeNotes] = useState(true);
  const [includeAssignedTime, setIncludeAssignedTime] = useState(true);

  // Options Accordion
  const [isOptionsOpen, setIsOptionsOpen] = useState(false);

  // Feedback & download states
  const [copiedStatus, setCopiedStatus] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);
  const [downloadingDateKey, setDownloadingDateKey] = useState<string | null>(null);
  const [batchDownloadStatus, setBatchDownloadStatus] = useState<string | null>(null);

  // Stored change logs
  const [changeLogs, setChangeLogs] = useState<SheetChangeRecord[]>([]);

  // Load latest change logs whenever modal opens
  useEffect(() => {
    if (isOpen) {
      setChangeLogs(getStoredChangeLogs());
      if (initialFileId) {
        setSelectedFileId(initialFileId);
      } else {
        setSelectedFileId("all");
      }
      if (initialDateStr === "all") {
        setDateMode("all");
      } else if (initialDateStr === tomorrowStr) {
        setDateMode("tomorrow");
      } else if (initialDateStr === todayStr) {
        setDateMode("today");
      } else if (initialDateStr) {
        setDateMode("custom");
        setCustomDate(initialDateStr);
      } else {
        setDateMode("today");
      }
      if (initialHandler && initialHandler !== "all") {
        setSelectedHandler(initialHandler);
      } else {
        setSelectedHandler("all");
      }
    }
  }, [isOpen, initialDateStr, initialFileId, initialHandler, todayStr, tomorrowStr]);

  // Currently active file object (if selected)
  const activeFile = useMemo(() => {
    if (!selectedFileId || selectedFileId === "all") return null;
    return files.find((f) => f.id === selectedFileId) || null;
  }, [files, selectedFileId]);

  // Scoped leads based on selected spreadsheet
  const scopedLeads = useMemo(() => {
    if (!activeFile) return leads;
    return leads.filter(
      (l) =>
        l.fileId === activeFile.id ||
        (activeFile.fileName && l.uploadedFileName === activeFile.fileName)
    );
  }, [leads, activeFile]);

  // Target date string for the report
  const activeDateStr = useMemo(() => {
    if (dateMode === "today") return todayStr;
    if (dateMode === "tomorrow") return tomorrowStr;
    if (dateMode === "custom") return customDate;
    return "all";
  }, [dateMode, todayStr, tomorrowStr, customDate]);

  // Leads matching the target date within scope
  const dateFilteredLeads = useMemo(() => {
    return getLeadsAssignedForDate(scopedLeads, activeDateStr, handlers);
  }, [scopedLeads, activeDateStr, handlers]);

  // Handler-assigned leads only
  const assignedLeadsOnly = useMemo(() => {
    return dateFilteredLeads.filter((l) => isLeadAssignedToHandler(l, handlers));
  }, [dateFilteredLeads, handlers]);

  // Final leads based on includeAllRecords and handler filter
  // If a handler is selected, strictly select ONLY that handler's records!
  const finalLeads = useMemo(() => {
    if (selectedHandler !== "all") {
      return dateFilteredLeads.filter(
        (l) => getLeadHandlerName(l, handlers).toLowerCase() === selectedHandler.toLowerCase()
      );
    }
    return includeAllRecords ? dateFilteredLeads : assignedLeadsOnly;
  }, [includeAllRecords, dateFilteredLeads, assignedLeadsOnly, selectedHandler, handlers]);

  // Check if any leads in the final list have manual notes provided
  const hasAnyManualNotes = useMemo(() => {
    return finalLeads.some((l) => l.manualNotes && l.manualNotes.trim().length > 0);
  }, [finalLeads]);

  // Daily changes synthesized and logged for the active sheet and date
  const activeDailyChanges = useMemo(() => {
    return getDailyChangesForSheet(
      leads,
      activeFile,
      activeDateStr,
      changeLogs,
      handlers
    );
  }, [leads, activeFile, activeDateStr, changeLogs, handlers]);

  // Filename that will be saved when user downloads
  const targetOutputFileName = useMemo(() => {
    return getReportPdfFileName(
      activeFile ? activeFile.fileName : undefined,
      activeDateStr,
      selectedHandler !== "all"
        ? selectedHandler
        : includeAllRecords
        ? "Daily_Report"
        : "Assigned_Report"
    );
  }, [activeFile, activeDateStr, selectedHandler, includeAllRecords]);

  // Dynamic effective report title
  const effectiveReportTitle = useMemo(() => {
    if (reportTitle.trim()) return reportTitle.trim();
    if (selectedHandler !== "all") {
      if (activeFile) {
        const clean = cleanSheetName(activeFile.fileName);
        return `${clean} — ${selectedHandler} Daily Report`;
      }
      return `${selectedHandler} — Daily Assignment & Tasks Report`;
    }
    if (activeFile) {
      const clean = cleanSheetName(activeFile.fileName);
      return includeAllRecords
        ? `${clean} — Daily Changes & All Client Records`
        : `${clean} — Daily Assigned Tasks & Leads Report`;
    }
    return includeAllRecords
      ? `Daily Lead & Handler Register (All Records)`
      : `Daily Assigned Leads & Handler Tasks Report`;
  }, [reportTitle, activeFile, selectedHandler, includeAllRecords]);

  // Handler breakdown counts including unassigned / pending
  const handlerBreakdown = useMemo(() => {
    const counts: Record<string, number> = {};
    finalLeads.forEach((l) => {
      const isAssigned = isLeadAssignedToHandler(l, handlers);
      const name = isAssigned ? getLeadHandlerName(l, handlers) : "Unassigned / Pending";
      counts[name] = (counts[name] || 0) + 1;
    });
    return counts;
  }, [finalLeads, handlers]);

  // All unique handler names
  const allUniqueHandlerNames = useMemo(() => {
    const set = new Set<string>();
    handlers.forEach((h) => h?.name && set.add(h.name));
    leads.forEach((l) => {
      const name = getLeadHandlerName(l, handlers);
      if (name && name.toLowerCase() !== "unassigned") {
        set.add(name);
      }
    });
    return Array.from(set).sort();
  }, [handlers, leads]);

  // Build structured sheet-by-sheet daily report summaries for the organized view
  const sheetCardsData = useMemo(() => {
    // If no files uploaded, represent the primary pipeline
    const listToRender: Array<{
      file: UploadedFileRecord | null;
      cleanName: string;
      displayName: string;
      recordCount: number;
      uploadDate: string;
    }> = [];

    if (files.length > 0) {
      files.forEach((f) => {
        listToRender.push({
          file: f,
          cleanName: cleanSheetName(f.fileName),
          displayName: f.fileName,
          recordCount: f.recordCount,
          uploadDate: f.uploadDate,
        });
      });
    } else {
      listToRender.push({
        file: null,
        cleanName: "All_Leads",
        displayName: "Master Pipeline (All Leads)",
        recordCount: leads.length,
        uploadDate: todayStr,
      });
    }

    return listToRender.map((item) => {
      // Find leads for this sheet
      const itemLeads = item.file
        ? leads.filter((l) => l.fileId === item.file?.id || l.uploadedFileName === item.file?.fileName)
        : leads;

      // Extract unique dates with activity for this sheet
      const datesSet = new Set<string>();
      datesSet.add(todayStr); // Always offer Today
      if (item.file?.uploadDate) datesSet.add(item.file.uploadDate);

      itemLeads.forEach((l) => {
        if (l.reportDate) datesSet.add(l.reportDate);
        if (l.uploadDate) datesSet.add(l.uploadDate);
        if (l.assignedAt) {
          const d = getReportDateForTimestamp(l.assignedAt);
          if (d) datesSet.add(d);
        }
        if (l.updatedAt) {
          const d = getReportDateForTimestamp(l.updatedAt);
          if (d) datesSet.add(d);
        }
      });

      // Sort dates: Today first, Tomorrow, then chronological descending
      const sortedDates = Array.from(datesSet).sort((a, b) => {
        if (a === todayStr) return -1;
        if (b === todayStr) return 1;
        if (a === tomorrowStr) return -1;
        if (b === tomorrowStr) return 1;
        return b.localeCompare(a);
      });

      const dateRows = sortedDates.map((d) => {
        const dayLeadsAll = getLeadsAssignedForDate(itemLeads, d, handlers);
        const dayLeadsAssigned = dayLeadsAll.filter((l) =>
          isLeadAssignedToHandler(l, handlers)
        );
        const dayHandlerLeads = selectedHandler !== "all"
          ? dayLeadsAll.filter(
              (l) => getLeadHandlerName(l, handlers).toLowerCase() === selectedHandler.toLowerCase()
            )
          : dayLeadsAssigned;
        const dayChanges = getDailyChangesForSheet(leads, item.file, d, changeLogs, handlers);
        const dayInfo = formatUploadDayLabel(d);
        const pdfFileName = getReportPdfFileName(
          item.file?.fileName,
          d,
          selectedHandler !== "all" ? selectedHandler : "Daily_Report"
        );

        return {
          dateStr: d,
          label: dayInfo.label,
          subLabel: dayInfo.subLabel || d,
          isToday: d === todayStr,
          isTomorrow: d === tomorrowStr,
          totalCount: dayLeadsAll.length,
          assignedCount: dayLeadsAssigned.length,
          handlerCount: dayHandlerLeads.length,
          pendingCount: dayLeadsAll.length - dayLeadsAssigned.length,
          changesCount: dayChanges.length,
          pdfFileName,
          leads: dayLeadsAll,
          handlerLeads: dayHandlerLeads,
          changes: dayChanges,
        };
      });

      return {
        ...item,
        dates: dateRows,
      };
    });
  }, [files, leads, todayStr, tomorrowStr, handlers, changeLogs, selectedHandler]);

  if (!isOpen) return null;

  const isHandlerSpecific = selectedHandler !== "all";

  const reportOptions: PdfReportOptions = {
    title: effectiveReportTitle,
    companyName: settings.companyName || "Client Operations Team",
    dateStr: activeDateStr === "all" ? todayStr : activeDateStr,
    selectedHandler,
    groupByHandler,
    includeContactDetails,
    includeStatus,
    includePaymentInfo,
    includeNotes,
    includeAssignedTime,
    orientation,
    handlers,
    fileName: activeFile ? activeFile.fileName : undefined,
    sheetName: activeFile ? cleanSheetName(activeFile.fileName) : undefined,
    changes: activeDailyChanges,
    includeChangesLog: Boolean(activeFile && includeChangesLog),
    includeAllRecords: !isHandlerSpecific && includeAllRecords,
  };

  // 1. Download Current Selected Report
  const handleDownload = () => {
    setIsGenerating(true);
    try {
      downloadAssignedLeadsPdf(finalLeads, reportOptions);
    } catch (e) {
      console.error("PDF generation failed:", e);
    } finally {
      setTimeout(() => setIsGenerating(false), 400);
    }
  };

  // 2. Direct Download for a Specific Sheet & Date
  const handleDirectSheetDateDownload = (
    file: UploadedFileRecord | null,
    dateStr: string,
    sheetLeads: Lead[],
    sheetChanges: SheetChangeRecord[],
    onlyAssigned: boolean = true
  ) => {
    const key = `${file?.id || "all"}-${dateStr}-${onlyAssigned ? "assigned" : "all"}`;
    setDownloadingDateKey(key);
    try {
      const clean = cleanSheetName(file?.fileName);
      const leadsForPdf = isHandlerSpecific
        ? sheetLeads.filter(
            (l) => getLeadHandlerName(l, handlers).toLowerCase() === selectedHandler.toLowerCase()
          )
        : onlyAssigned
        ? sheetLeads.filter((l) => isLeadAssignedToHandler(l, handlers))
        : sheetLeads;

      const pdfReportTitle = isHandlerSpecific
        ? `${clean} — ${selectedHandler} Daily Report`
        : onlyAssigned
        ? `${clean} — Daily Assigned Tasks & Leads Report`
        : `${clean} — Daily Changes & All Client Records`;

      const pdfFileName = getReportPdfFileName(
        file?.fileName,
        dateStr,
        isHandlerSpecific ? selectedHandler : onlyAssigned ? "Assigned_Report" : "Daily_Report"
      );

      downloadAssignedLeadsPdf(leadsForPdf, {
        ...reportOptions,
        title: pdfReportTitle,
        fileName: file?.fileName,
        sheetName: clean,
        dateStr,
        selectedHandler,
        changes: sheetChanges,
        includeChangesLog: Boolean(clean !== "All_Sheets" && includeChangesLog),
        includeAllRecords: !isHandlerSpecific && !onlyAssigned,
      });
    } catch (e) {
      console.error("Direct sheet PDF download failed:", e);
    } finally {
      setTimeout(() => setDownloadingDateKey(null), 400);
    }
  };

  // 3. Batch Download All Sheet PDFs for Today (Separately named)
  const handleBatchDownloadAllToday = async (onlyAssigned: boolean = true) => {
    setBatchDownloadStatus(
      isHandlerSpecific
        ? `Preparing separate daily PDFs for ${selectedHandler} across all sheets...`
        : `Preparing separate daily assigned lead PDFs for each uploaded Excel sheet...`
    );
    try {
      if (files.length === 0) {
        // Fallback: download master pipeline
        const todayLeadsAll = getLeadsAssignedForDate(leads, todayStr, handlers);
        const leadsForPdf = isHandlerSpecific
          ? todayLeadsAll.filter(
              (l) => getLeadHandlerName(l, handlers).toLowerCase() === selectedHandler.toLowerCase()
            )
          : onlyAssigned
          ? todayLeadsAll.filter((l) => isLeadAssignedToHandler(l, handlers))
          : todayLeadsAll;
        const todayChanges = getDailyChangesForSheet(leads, null, todayStr, changeLogs, handlers);
        downloadAssignedLeadsPdf(leadsForPdf, {
          ...reportOptions,
          title: isHandlerSpecific
            ? `${selectedHandler} — Daily Assignment & Tasks Report`
            : "Daily Assigned Leads & Handler Tasks Report",
          dateStr: todayStr,
          selectedHandler,
          changes: todayChanges,
          includeAllRecords: !isHandlerSpecific && !onlyAssigned,
        });
        setBatchDownloadStatus(
          isHandlerSpecific
            ? `Downloaded Daily PDF for ${selectedHandler}!`
            : "Downloaded Daily Assigned Leads PDF for Master Pipeline!"
        );
        setTimeout(() => setBatchDownloadStatus(null), 3000);
        return;
      }

      for (let i = 0; i < files.length; i++) {
        const file = files[i];
        const clean = cleanSheetName(file.fileName);
        setBatchDownloadStatus(
          `Generating PDF ${i + 1} of ${files.length}: ${clean}_${
            isHandlerSpecific ? `${selectedHandler}_` : "Assigned_"
          }${todayStr}_Report.pdf...`
        );

        const sheetLeads = leads.filter(
          (l) => l.fileId === file.id || l.uploadedFileName === file.fileName
        );
        const dayLeads = getLeadsAssignedForDate(sheetLeads, todayStr, handlers);
        const leadsForPdf = isHandlerSpecific
          ? dayLeads.filter(
              (l) => getLeadHandlerName(l, handlers).toLowerCase() === selectedHandler.toLowerCase()
            )
          : onlyAssigned
          ? dayLeads.filter((l) => isLeadAssignedToHandler(l, handlers))
          : dayLeads;
        const sheetChanges = getDailyChangesForSheet(leads, file, todayStr, changeLogs, handlers);

        downloadAssignedLeadsPdf(leadsForPdf, {
          ...reportOptions,
          title: isHandlerSpecific
            ? `${clean} — ${selectedHandler} Daily Report`
            : `${clean} — Daily Assigned Tasks & Leads Report`,
          fileName: file.fileName,
          sheetName: clean,
          dateStr: todayStr,
          selectedHandler,
          changes: sheetChanges,
          includeChangesLog: Boolean(clean !== "All_Sheets" && includeChangesLog),
          includeAllRecords: !isHandlerSpecific && !onlyAssigned,
        });

        // Small pause between downloads for smooth browser saving
        await new Promise((r) => setTimeout(r, 450));
      }

      setBatchDownloadStatus(
        isHandlerSpecific
          ? `Successfully downloaded ${files.length} separate daily reports for ${selectedHandler}!`
          : `Successfully downloaded ${files.length} separate assigned lead daily PDFs for each Excel sheet!`
      );
      setTimeout(() => setBatchDownloadStatus(null), 4000);
    } catch (e) {
      console.error("Batch download failed:", e);
      setBatchDownloadStatus("Error during batch download.");
      setTimeout(() => setBatchDownloadStatus(null), 3000);
    }
  };

  // 4. Print / Preview Action
  const handlePrintPreview = () => {
    setIsGenerating(true);
    try {
      const blobUrl = getAssignedLeadsPdfBlobUrl(finalLeads, reportOptions);
      const printWindow = window.open(blobUrl, "_blank");
      if (!printWindow) {
        downloadAssignedLeadsPdf(finalLeads, reportOptions);
      }
    } catch (e) {
      console.error("Preview failed:", e);
      downloadAssignedLeadsPdf(finalLeads, reportOptions);
    } finally {
      setTimeout(() => setIsGenerating(false), 400);
    }
  };

  // 5. Copy Summary Text
  const handleCopySummary = () => {
    let text = `📋 ${effectiveReportTitle.toUpperCase()}\n`;
    text += `Excel Sheet: ${activeFile ? activeFile.fileName : "All Sheets Combined"}\n`;
    text += `Report Date: ${activeDateStr === "all" ? "All Dates" : activeDateStr}\n`;
    text += `Saved Filename: ${targetOutputFileName}\n`;
    text += `Assigned Tasks: ${finalLeads.length}\n`;
    text += `Daily Changes Logged: ${activeDailyChanges.length}\n`;
    text += `----------------------------------------\n\n`;

    if (activeDailyChanges.length > 0) {
      text += `⚡ DAILY CHANGES & MODIFICATIONS (${activeDailyChanges.length}):\n`;
      activeDailyChanges.forEach((c, idx) => {
        text += `   ${idx + 1}. [${c.changeType.toUpperCase()}] ${c.leadName} - ${c.summary} (${formatTimeFromIso(c.timestamp)})\n`;
      });
      text += `\n`;
    }

    text += `👤 ASSIGNED LEADS & TASKS (${finalLeads.length}):\n`;
    finalLeads.forEach((lead, i) => {
      const hDisplay = getLeadHandlerName(lead, handlers);
      text += `   ${i + 1}. ${lead.fullName} ➔ ${hDisplay} | ${lead.phoneNumber || "No phone"} | Status: ${lead.status}\n`;
    });

    navigator.clipboard?.writeText(text);
    setCopiedStatus(true);
    setTimeout(() => setCopiedStatus(false), 2500);
  };

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-3 sm:p-5 animate-in fade-in duration-200">
      <div className="bg-white rounded-2xl shadow-2xl max-w-5xl w-full max-h-[92vh] flex flex-col border border-slate-200 overflow-hidden my-auto">
        {/* Modal Top Header */}
        <div className="px-6 py-4 border-b border-slate-200 bg-white flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-xl bg-indigo-600 text-white shadow-xs">
              <FileSpreadsheet className="w-5 h-5 text-white" />
            </div>
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <h2 className="text-lg sm:text-xl font-bold text-slate-900">
                  Daily Excel Sheet Reports & PDF Downloads
                </h2>
                <span className="text-[11px] font-bold px-2.5 py-0.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200 flex items-center gap-1">
                  <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                  <span>Changes & Tasks Tracked Daily</span>
                </span>
                <span className="text-[11px] font-semibold px-2 py-0.5 rounded-full bg-indigo-50 text-indigo-700 border border-indigo-200">
                  Saved with Sheet Name & Date
                </span>
              </div>
              <p className="text-xs text-slate-500 mt-0.5">
                Download daily PDF reports showing changes and assigned tasks for each specific Excel sheet (e.g. Sam, Jerin) on any date.
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="p-2 rounded-xl text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-colors cursor-pointer"
            title="Close dialog"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Tabs Navigation */}
        <div className="flex items-center gap-2 border-b border-slate-200 px-6 pt-2 bg-slate-50/80">
          <button
            type="button"
            id="tab-modal-daily-sheets"
            onClick={() => setModalTab("organized_dates")}
            className={`pb-2.5 px-3.5 text-xs sm:text-sm font-bold flex items-center gap-2 border-b-2 cursor-pointer transition-colors ${
              modalTab === "organized_dates"
                ? "border-indigo-600 text-indigo-700 bg-white rounded-t-lg border-t border-x shadow-2xs"
                : "border-transparent text-slate-500 hover:text-slate-800"
            }`}
          >
            <FileSpreadsheet className="w-4 h-4 text-emerald-600" />
            <span>Daily Reports by Excel Sheet & Date</span>
            <span className="text-[10px] px-2 py-0.5 rounded-full bg-indigo-100 text-indigo-800 font-bold tabular-nums">
              {files.length > 0 ? `${files.length} sheets` : "1 pipeline"}
            </span>
          </button>

          <button
            type="button"
            id="tab-modal-customize-preview"
            onClick={() => setModalTab("customize_preview")}
            className={`pb-2.5 px-3.5 text-xs sm:text-sm font-bold flex items-center gap-2 border-b-2 cursor-pointer transition-colors ${
              modalTab === "customize_preview"
                ? "border-indigo-600 text-indigo-700 bg-white rounded-t-lg border-t border-x shadow-2xs"
                : "border-transparent text-slate-500 hover:text-slate-800"
            }`}
          >
            <Sliders className="w-4 h-4 text-indigo-600" />
            <span>Customize & Full Document Preview</span>
          </button>
        </div>

        {/* Modal Body */}
        <div className="flex-1 overflow-y-auto p-5 sm:p-6 space-y-5">
          {/* TAB 1: Organized Daily Reports by Sheet & Date */}
          {modalTab === "organized_dates" && (
            <div className="space-y-4 animate-in fade-in">
              {/* Handler Quick Filter Bar in Tab 1 */}
              <div className="p-3 bg-white rounded-xl border border-slate-200 flex flex-wrap items-center justify-between gap-3 shadow-2xs">
                <div className="flex items-center gap-2">
                  <UserCheck className="w-4 h-4 text-indigo-600" />
                  <div>
                    <span className="text-xs font-bold text-slate-800">
                      Handler Report Filter:
                    </span>
                    <span className="text-[11px] text-slate-500 ml-1.5 hidden sm:inline">
                      {isHandlerSpecific
                        ? `Filtering strictly for "${selectedHandler}" (only ${selectedHandler}'s report will download)`
                        : "Combined report with all sheet records"}
                    </span>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <select
                    id="select-tab1-handler"
                    value={selectedHandler}
                    onChange={(e) => setSelectedHandler(e.target.value)}
                    className="px-3 py-1.5 rounded-lg text-xs font-bold border border-slate-300 bg-white text-slate-800 outline-none cursor-pointer focus:border-indigo-500"
                  >
                    <option value="all">All Handlers (All Records)</option>
                    {allUniqueHandlerNames.map((name) => (
                      <option key={name} value={name}>
                        Handler: {name} (Only {name}&apos;s report)
                      </option>
                    ))}
                  </select>

                  {isHandlerSpecific && (
                    <button
                      type="button"
                      onClick={() => setSelectedHandler("all")}
                      className="text-xs font-semibold text-indigo-600 hover:text-indigo-800 cursor-pointer underline"
                    >
                      Clear Filter
                    </button>
                  )}
                </div>
              </div>

              {isHandlerSpecific && (
                <div className="p-3 bg-indigo-50 border border-indigo-200 rounded-xl text-xs flex items-center justify-between gap-2 text-indigo-900 font-medium animate-in fade-in">
                  <div className="flex items-center gap-2">
                    <UserCheck className="w-4 h-4 text-indigo-600 shrink-0" />
                    <span>
                      <strong>Handler Selected: {selectedHandler}</strong> — Downloading will generate <strong>ONLY</strong> {selectedHandler}&apos;s specific daily report as a PDF (including Client Name, Phone Number, Email ID, City, Month, Call Status, Handler Change, and Manual Notes).
                    </span>
                  </div>
                  <span className="text-[10px] uppercase font-bold tracking-wider px-2 py-0.5 rounded bg-indigo-200 text-indigo-900 shrink-0">
                    Handler Filter Active
                  </span>
                </div>
              )}

              {/* Batch Download Bar */}
              <div className="p-4 rounded-xl bg-gradient-to-r from-indigo-50 via-slate-50 to-emerald-50 border border-indigo-200/80 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
                <div className="flex items-start gap-2.5">
                  <div className="p-2 rounded-xl bg-indigo-600 text-white shrink-0">
                    <Sparkles className="w-4 h-4" />
                  </div>
                  <div>
                    <h3 className="text-xs sm:text-sm font-bold text-slate-900">
                      {isHandlerSpecific
                        ? `Download Daily Reports for ${selectedHandler} (Today: ${todayStr})`
                        : `Download Daily Reports for All Sheets (Today: ${todayStr})`}
                    </h3>
                    <p className="text-[11px] text-slate-600 leading-relaxed">
                      {isHandlerSpecific
                        ? `Generates separate PDFs for each sheet containing only ${selectedHandler}'s assigned tasks on ${todayStr}.`
                        : `Generates separate PDFs for each uploaded Excel sheet, each named with the sheet's name and today's date (e.g. Sam_${todayStr}_Daily_Report.pdf).`}
                    </p>
                  </div>
                </div>

                <button
                  type="button"
                  id="btn-batch-download-today"
                  onClick={() => handleBatchDownloadAllToday(true)}
                  className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold rounded-xl shadow-xs inline-flex items-center gap-2 cursor-pointer transition-all shrink-0 self-end sm:self-auto"
                >
                  <Download className="w-4 h-4" />
                  <span>
                    {isHandlerSpecific
                      ? `Download Today's Assigned Reports for ${selectedHandler}`
                      : "Download All Today's Assigned Leads PDFs"}
                  </span>
                </button>
              </div>

              {batchDownloadStatus && (
                <div className="p-3 bg-indigo-600 text-white rounded-xl text-xs font-semibold flex items-center gap-2 animate-in fade-in">
                  <CheckCircle2 className="w-4 h-4 text-emerald-300" />
                  <span>{batchDownloadStatus}</span>
                </div>
              )}

              {/* Sheet Cards Grid */}
              <div className="space-y-4">
                {sheetCardsData.map((sheetItem) => {
                  const isCurrentActive =
                    sheetItem.file?.id === selectedFileId ||
                    (!sheetItem.file && selectedFileId === "all");

                  return (
                    <div
                      key={sheetItem.cleanName}
                      className={`border rounded-2xl overflow-hidden transition-all bg-white ${
                        isCurrentActive
                          ? "border-indigo-400 ring-2 ring-indigo-400/20 shadow-xs"
                          : "border-slate-200 shadow-2xs hover:border-slate-300"
                      }`}
                    >
                      {/* Sheet Card Header */}
                      <div className="p-3.5 sm:p-4 bg-slate-50/90 border-b border-slate-200 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                        <div className="flex items-center gap-3">
                          <div className="p-2 rounded-xl bg-emerald-100 text-emerald-800 border border-emerald-200">
                            <FileSpreadsheet className="w-5 h-5 text-emerald-700" />
                          </div>
                          <div>
                            <div className="flex items-center gap-2 flex-wrap">
                              <h4 className="text-sm font-bold text-slate-900">
                                {sheetItem.displayName}
                              </h4>
                              <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-slate-900 text-white font-mono">
                                Sheet: {sheetItem.cleanName}
                              </span>
                              <span className="text-[10px] font-semibold px-2 py-0.5 rounded-md bg-emerald-50 text-emerald-700 border border-emerald-200">
                                {sheetItem.recordCount} total clients
                              </span>
                              {isHandlerSpecific && (
                                <span className="text-[10px] font-bold px-2 py-0.5 rounded-md bg-indigo-50 text-indigo-700 border border-indigo-200">
                                  Filtering: {selectedHandler}
                                </span>
                              )}
                            </div>
                            <span className="text-[11px] text-slate-500 block mt-0.5">
                              Upload Date: {sheetItem.uploadDate} • Tracking changes & assignments by date
                            </span>
                          </div>
                        </div>

                        {/* Top Action: Download Today's PDF for this sheet */}
                        <div className="flex items-center gap-2">
                          <button
                            type="button"
                            onClick={() => {
                              setSelectedFileId(sheetItem.file?.id || "all");
                              setDateMode("today");
                              setModalTab("customize_preview");
                            }}
                            className="px-3 py-1.5 bg-white border border-slate-300 text-slate-700 hover:bg-slate-50 text-xs font-semibold rounded-xl cursor-pointer transition-colors"
                          >
                            Customize / Preview
                          </button>

                          <button
                            type="button"
                            onClick={() => {
                              const todayRow = sheetItem.dates.find((d) => d.isToday) || sheetItem.dates[0];
                              handleDirectSheetDateDownload(
                                sheetItem.file,
                                todayRow?.dateStr || todayStr,
                                todayRow?.leads || [],
                                todayRow?.changes || [],
                                true
                              );
                            }}
                            disabled={downloadingDateKey === `${sheetItem.file?.id || "all"}-${todayStr}-assigned`}
                            className="px-3.5 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold rounded-xl shadow-xs inline-flex items-center gap-1.5 cursor-pointer transition-colors disabled:opacity-50"
                            title={`Download assigned leads PDF for ${sheetItem.cleanName} on ${todayStr}`}
                          >
                            <Download className="w-3.5 h-3.5" />
                            <span>
                              {isHandlerSpecific
                                ? `Download ${selectedHandler}'s Assigned PDF`
                                : "Download Assigned Leads (Today)"}
                            </span>
                          </button>
                        </div>
                      </div>

                      {/* Daily Dates Table for this Sheet */}
                      <div className="p-3 sm:p-4">
                        <div className="overflow-x-auto">
                          <table className="w-full text-xs text-left">
                            <thead>
                              <tr className="text-slate-500 font-bold uppercase tracking-wider text-[10px] border-b border-slate-200 pb-2">
                                <th className="pb-2 px-2">Report Date</th>
                                <th className="pb-2 px-2">Assigned Tasks & Clients</th>
                                <th className="pb-2 px-2">Daily Changes Logged</th>
                                <th className="pb-2 px-2">Saved PDF Filename</th>
                                <th className="pb-2 px-2 text-right">Actions</th>
                              </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100">
                              {sheetItem.dates.map((row) => {
                                const downloadAssignedKey = `${sheetItem.file?.id || "all"}-${row.dateStr}-assigned`;
                                const downloadAllKey = `${sheetItem.file?.id || "all"}-${row.dateStr}-all`;
                                const isDownloadingAssigned = downloadingDateKey === downloadAssignedKey;
                                const isDownloadingAll = downloadingDateKey === downloadAllKey;

                                return (
                                  <tr
                                    key={row.dateStr}
                                    className="hover:bg-slate-50 transition-colors"
                                  >
                                    <td className="py-2.5 px-2">
                                      <div className="flex items-center gap-2">
                                        <span className="font-bold text-slate-900">
                                          {row.subLabel}
                                        </span>
                                        {row.isToday && (
                                          <span className="text-[9px] px-1.5 py-0.5 rounded font-extrabold uppercase bg-emerald-100 text-emerald-800">
                                            Today
                                          </span>
                                        )}
                                        {row.isTomorrow && (
                                          <span className="text-[9px] px-1.5 py-0.5 rounded font-extrabold uppercase bg-indigo-100 text-indigo-800">
                                            Tomorrow
                                          </span>
                                        )}
                                      </div>
                                    </td>

                                    <td className="py-2.5 px-2">
                                      <div className="flex items-center gap-1.5 flex-wrap">
                                        {isHandlerSpecific ? (
                                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full font-bold text-[11px] bg-indigo-100 text-indigo-900 border border-indigo-200">
                                            <UserCheck className="w-3 h-3 text-indigo-700" />
                                            <span>{row.handlerCount} tasks for {selectedHandler}</span>
                                          </span>
                                        ) : (
                                          <>
                                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full font-bold text-[11px] bg-indigo-50 text-indigo-700 border border-indigo-200">
                                              <UserCheck className="w-3 h-3" />
                                              <span>{row.assignedCount} assigned</span>
                                            </span>
                                            {row.pendingCount > 0 && (
                                              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full font-medium text-[10px] bg-amber-50 text-amber-700 border border-amber-200">
                                                <span>{row.pendingCount} pending</span>
                                              </span>
                                            )}
                                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full font-medium text-[10px] bg-slate-100 text-slate-700">
                                              <span>{row.totalCount} total</span>
                                            </span>
                                          </>
                                        )}
                                      </div>
                                    </td>

                                    <td className="py-2.5 px-2">
                                      <span
                                        className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full font-bold text-[11px] ${
                                          row.changesCount > 0
                                            ? "bg-emerald-50 text-emerald-700 border border-emerald-200"
                                            : "bg-slate-100 text-slate-500"
                                        }`}
                                      >
                                        <History className="w-3 h-3" />
                                        <span>{row.changesCount} changes</span>
                                      </span>
                                    </td>

                                    <td className="py-2.5 px-2 font-mono text-[11px] text-slate-600">
                                      <span className="bg-slate-100 px-2 py-0.5 rounded text-slate-800 font-semibold border border-slate-200">
                                        {row.pdfFileName}
                                      </span>
                                    </td>

                                    <td className="py-2.5 px-2 text-right">
                                      <div className="inline-flex items-center gap-1.5 justify-end">
                                        <button
                                          type="button"
                                          onClick={() => {
                                            setSelectedFileId(sheetItem.file?.id || "all");
                                            if (row.isToday) setDateMode("today");
                                            else if (row.isTomorrow) setDateMode("tomorrow");
                                            else {
                                              setDateMode("custom");
                                              setCustomDate(row.dateStr);
                                            }
                                            setIncludeAllRecords(false);
                                            setModalTab("customize_preview");
                                          }}
                                          className="px-2.5 py-1 text-slate-600 hover:text-slate-900 hover:bg-slate-100 rounded-lg font-semibold transition-colors cursor-pointer text-xs"
                                        >
                                          Preview
                                        </button>

                                        {/* Primary: Download Assigned Leads PDF */}
                                        <button
                                          type="button"
                                          onClick={() =>
                                            handleDirectSheetDateDownload(
                                              sheetItem.file,
                                              row.dateStr,
                                              row.leads,
                                              row.changes,
                                              true
                                            )
                                          }
                                          disabled={isDownloadingAssigned}
                                          className="px-3 py-1 bg-indigo-600 hover:bg-indigo-700 text-white font-bold rounded-lg transition-colors cursor-pointer inline-flex items-center gap-1 shadow-2xs text-xs disabled:opacity-50"
                                          title={`Download assigned leads PDF for ${row.subLabel}`}
                                        >
                                          <Download className="w-3 h-3 text-white" />
                                          <span>
                                            {isDownloadingAssigned
                                              ? "Downloading..."
                                              : isHandlerSpecific
                                              ? `Download ${selectedHandler} (${row.handlerCount})`
                                              : `Download Assigned (${row.assignedCount})`}
                                          </span>
                                        </button>

                                        {/* Secondary: Download All Records PDF if not handler-specific */}
                                        {!isHandlerSpecific && (
                                          <button
                                            type="button"
                                            onClick={() =>
                                              handleDirectSheetDateDownload(
                                                sheetItem.file,
                                                row.dateStr,
                                                row.leads,
                                                row.changes,
                                                false
                                              )
                                            }
                                            disabled={isDownloadingAll}
                                            className="px-2 py-1 bg-white hover:bg-slate-100 border border-slate-200 text-slate-700 font-semibold rounded-lg transition-colors cursor-pointer inline-flex items-center gap-1 text-[11px] disabled:opacity-50"
                                            title={`Download all ${row.totalCount} records (including unassigned) for ${row.subLabel}`}
                                          >
                                            <span>All ({row.totalCount})</span>
                                          </button>
                                        )}
                                      </div>
                                    </td>
                                  </tr>
                                );
                              })}
                            </tbody>
                          </table>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* TAB 2: Customize & Document Preview */}
          {modalTab === "customize_preview" && (
            <div className="space-y-4 animate-in fade-in">
              {/* Scope & Date Selection Box */}
              <div className="p-4 rounded-xl bg-slate-50 border border-slate-200/80 space-y-3.5">
                {/* Row 1: Excel Sheet Selection */}
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <div className="flex items-center gap-2">
                    <FileSpreadsheet className="w-4 h-4 text-emerald-600" />
                    <span className="text-xs font-bold text-slate-700 uppercase tracking-wider">
                      Target Excel Sheet:
                    </span>
                  </div>

                  <div className="flex items-center gap-2">
                    <select
                      id="select-pdf-file"
                      value={selectedFileId}
                      onChange={(e) => setSelectedFileId(e.target.value)}
                      className="px-3 py-1.5 rounded-lg text-xs font-bold border border-slate-300 bg-white text-slate-800 outline-none cursor-pointer focus:border-indigo-500"
                    >
                      <option value="all">
                        All Sheets Combined ({leads.length} total clients)
                      </option>
                      {files.map((f) => (
                        <option key={f.id} value={f.id}>
                          Excel Sheet: {f.fileName} ({cleanSheetName(f.fileName)}) — {f.recordCount} records
                        </option>
                      ))}
                    </select>

                    {activeFile && (
                      <span className="text-[11px] font-bold px-2 py-0.5 rounded bg-emerald-100 text-emerald-800">
                        {cleanSheetName(activeFile.fileName)}
                      </span>
                    )}
                  </div>
                </div>

                {/* Row 2: Date Selector */}
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pt-2.5 border-t border-slate-200/60">
                  <div className="flex items-center gap-2">
                    <Calendar className="w-4 h-4 text-indigo-600" />
                    <span className="text-xs font-bold text-slate-700 uppercase tracking-wider">
                      Report Date:
                    </span>
                  </div>

                  <div className="flex flex-wrap items-center gap-1.5">
                    <button
                      id="tab-report-today"
                      type="button"
                      onClick={() => setDateMode("today")}
                      className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
                        dateMode === "today"
                          ? "bg-indigo-600 text-white shadow-xs"
                          : "bg-white text-slate-700 hover:bg-slate-100 border border-slate-200"
                      }`}
                    >
                      Today ({todayStr})
                    </button>

                    <button
                      id="tab-report-tomorrow"
                      type="button"
                      onClick={() => setDateMode("tomorrow")}
                      className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
                        dateMode === "tomorrow"
                          ? "bg-indigo-600 text-white shadow-xs"
                          : "bg-white text-slate-700 hover:bg-slate-100 border border-slate-200"
                      }`}
                    >
                      Tomorrow ({tomorrowStr})
                    </button>

                    <button
                      id="tab-report-custom"
                      type="button"
                      onClick={() => setDateMode("custom")}
                      className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
                        dateMode === "custom"
                          ? "bg-indigo-600 text-white shadow-xs"
                          : "bg-white text-slate-700 hover:bg-slate-100 border border-slate-200"
                      }`}
                    >
                      Pick Date
                    </button>

                    <button
                      id="tab-report-all"
                      type="button"
                      onClick={() => setDateMode("all")}
                      className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
                        dateMode === "all"
                          ? "bg-indigo-600 text-white shadow-xs"
                          : "bg-white text-slate-700 hover:bg-slate-100 border border-slate-200"
                      }`}
                    >
                      All Recorded Dates
                    </button>
                  </div>
                </div>

                {/* Custom Date Input */}
                {dateMode === "custom" && (
                  <div className="pt-2 border-t border-slate-200/60 flex items-center justify-end gap-2 animate-in fade-in">
                    <span className="text-xs text-slate-600 font-medium">Select Specific Date:</span>
                    <input
                      type="date"
                      value={customDate}
                      onChange={(e) => setCustomDate(e.target.value)}
                      className="px-3 py-1.5 rounded-lg text-xs font-bold border border-slate-300 bg-white text-slate-800 outline-none focus:border-indigo-500 cursor-pointer"
                    />
                  </div>
                )}

                {/* Row 3: Handler Filter & Options Accordion */}
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pt-2.5 border-t border-slate-200/60">
                  <div className="flex items-center gap-2">
                    <UserCheck className="w-4 h-4 text-indigo-600" />
                    <span className="text-xs font-bold text-slate-700 uppercase tracking-wider">
                      Handler Filter:
                    </span>
                  </div>

                  <div className="flex items-center gap-2">
                    <select
                      value={selectedHandler}
                      onChange={(e) => setSelectedHandler(e.target.value)}
                      className="px-3 py-1.5 rounded-lg text-xs font-semibold border border-slate-300 bg-white text-slate-800 outline-none cursor-pointer focus:border-indigo-500"
                    >
                      <option value="all">All Handlers ({allUniqueHandlerNames.length})</option>
                      {allUniqueHandlerNames.map((name) => {
                        const hRecord = handlers.find(
                          (h) => h?.name && h.name.toLowerCase() === name.toLowerCase()
                        );
                        return (
                          <option key={name} value={name}>
                            Handler: {name} {hRecord?.role ? `(${hRecord.role})` : ""}
                          </option>
                        );
                      })}
                    </select>

                    <button
                      type="button"
                      onClick={() => setIsOptionsOpen((prev) => !prev)}
                      className="inline-flex items-center gap-1 px-2.5 py-1.5 text-xs font-medium text-slate-600 bg-white border border-slate-200 rounded-lg hover:bg-slate-100 cursor-pointer transition-colors"
                    >
                      <Sliders className="w-3.5 h-3.5 text-slate-500" />
                      <span>Layout & Columns</span>
                      {isOptionsOpen ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
                    </button>
                  </div>
                </div>

                {/* Row 4: Report Content Selector (Assigned Leads vs All Records) */}
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pt-2.5 border-t border-slate-200/60">
                  <div className="flex items-center gap-2">
                    <UserCheck className="w-4 h-4 text-emerald-600" />
                    <span className="text-xs font-bold text-slate-700 uppercase tracking-wider">
                      Report Content:
                    </span>
                  </div>

                  <div className="flex items-center gap-2 text-xs">
                    <label
                      className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border font-bold cursor-pointer transition-all ${
                        !includeAllRecords
                          ? "bg-indigo-600 text-white border-indigo-700 shadow-xs"
                          : "bg-white text-slate-700 border-slate-300 hover:bg-slate-100"
                      }`}
                    >
                      <input
                        type="radio"
                        name="tab2ReportContent"
                        checked={!includeAllRecords}
                        onChange={() => setIncludeAllRecords(false)}
                        className="sr-only"
                      />
                      <span>Assigned Leads Only ({assignedLeadsOnly.length})</span>
                    </label>

                    <label
                      className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border font-semibold cursor-pointer transition-all ${
                        includeAllRecords
                          ? "bg-indigo-600 text-white border-indigo-700 shadow-xs"
                          : "bg-white text-slate-700 border-slate-300 hover:bg-slate-100"
                      }`}
                    >
                      <input
                        type="radio"
                        name="tab2ReportContent"
                        checked={includeAllRecords}
                        onChange={() => setIncludeAllRecords(true)}
                        className="sr-only"
                      />
                      <span>All Sheet Records ({dateFilteredLeads.length})</span>
                    </label>
                  </div>
                </div>

                {/* Expandable Options Panel */}
                {isOptionsOpen && (
                  <div className="p-3.5 bg-white rounded-lg border border-slate-200 space-y-3 animate-in fade-in">
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <div>
                        <label className="text-[11px] font-bold text-slate-600 block mb-1">
                          Custom Report Title (Optional):
                        </label>
                        <input
                          type="text"
                          placeholder={effectiveReportTitle}
                          value={reportTitle}
                          onChange={(e) => setReportTitle(e.target.value)}
                          className="w-full text-xs px-2.5 py-1.5 rounded-lg border border-slate-300 text-slate-800 outline-none focus:border-indigo-500 font-medium"
                        />
                      </div>

                      <div>
                        <label className="text-[11px] font-bold text-slate-600 block mb-1">
                          Page Orientation:
                        </label>
                        <div className="flex items-center gap-2">
                          <button
                            type="button"
                            onClick={() => setOrientation("landscape")}
                            className={`flex-1 py-1.5 text-xs font-semibold rounded-lg border cursor-pointer transition-colors ${
                              orientation === "landscape"
                                ? "bg-slate-900 text-white border-slate-900"
                                : "bg-white text-slate-700 border-slate-200 hover:bg-slate-50"
                            }`}
                          >
                            Landscape (Wide)
                          </button>
                          <button
                            type="button"
                            onClick={() => setOrientation("portrait")}
                            className={`flex-1 py-1.5 text-xs font-semibold rounded-lg border cursor-pointer transition-colors ${
                              orientation === "portrait"
                                ? "bg-slate-900 text-white border-slate-900"
                                : "bg-white text-slate-700 border-slate-200 hover:bg-slate-50"
                            }`}
                          >
                            Portrait
                          </button>
                        </div>
                      </div>
                    </div>

                    <div className="pt-2 border-t border-slate-100 flex flex-wrap items-center gap-3 text-xs">
                      <label className="inline-flex items-center gap-1.5 cursor-pointer text-indigo-900 font-bold bg-indigo-50/60 px-2 py-1 rounded-md border border-indigo-200">
                        <input
                          type="checkbox"
                          checked={includeAllRecords}
                          onChange={(e) => setIncludeAllRecords(e.target.checked)}
                          className="w-3.5 h-3.5 rounded text-indigo-600 focus:ring-indigo-500"
                        />
                        <span>Include All Sheet Records (Assigned & Pending)</span>
                      </label>

                      {activeFile ? (
                        <label className="inline-flex items-center gap-1.5 cursor-pointer text-indigo-900 font-bold">
                          <input
                            type="checkbox"
                            checked={includeChangesLog}
                            onChange={(e) => setIncludeChangesLog(e.target.checked)}
                            className="w-3.5 h-3.5 rounded text-indigo-600 focus:ring-indigo-500"
                          />
                          <span>Include Daily Changes Log</span>
                        </label>
                      ) : (
                        <span className="text-[11px] text-emerald-700 bg-emerald-50 px-2.5 py-1 rounded-lg border border-emerald-200 font-bold">
                          Scope: Sheet Tasks & Client Register compiled for All Sheets
                        </span>
                      )}

                      <label className="inline-flex items-center gap-1.5 cursor-pointer text-slate-700">
                        <input
                          type="checkbox"
                          checked={groupByHandler}
                          onChange={(e) => setGroupByHandler(e.target.checked)}
                          className="w-3.5 h-3.5 rounded text-indigo-600 focus:ring-indigo-500"
                        />
                        <span>Group by Handler</span>
                      </label>

                      <label className="inline-flex items-center gap-1.5 cursor-pointer text-slate-700">
                        <input
                          type="checkbox"
                          checked={includePaymentInfo}
                          onChange={(e) => setIncludePaymentInfo(e.target.checked)}
                          className="w-3.5 h-3.5 rounded text-indigo-600 focus:ring-indigo-500"
                        />
                        <span>Payment Receipt & Proof</span>
                      </label>

                      <label className="inline-flex items-center gap-1.5 cursor-pointer text-slate-700">
                        <input
                          type="checkbox"
                          checked={includeContactDetails}
                          onChange={(e) => setIncludeContactDetails(e.target.checked)}
                          className="w-3.5 h-3.5 rounded text-indigo-600 focus:ring-indigo-500"
                        />
                        <span>Contact Info</span>
                      </label>

                      <label className="inline-flex items-center gap-1.5 cursor-pointer text-slate-700">
                        <input
                          type="checkbox"
                          checked={includeNotes}
                          onChange={(e) => setIncludeNotes(e.target.checked)}
                          className="w-3.5 h-3.5 rounded text-indigo-600 focus:ring-indigo-500"
                        />
                        <span>Notes & Remarks</span>
                      </label>
                    </div>
                  </div>
                )}
              </div>

              {/* Dynamic Target Saved Filename Banner */}
              <div className="p-3 rounded-xl bg-indigo-50/80 border border-indigo-200 flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs">
                <div className="flex items-center gap-2">
                  <FileDown className="w-4 h-4 text-indigo-600" />
                  <span className="font-semibold text-slate-700">Target PDF Filename:</span>
                  <span className="font-mono font-bold text-indigo-900 bg-white px-2.5 py-0.5 rounded border border-indigo-200">
                    {targetOutputFileName}
                  </span>
                </div>
                <span className="text-[11px] text-indigo-700 font-medium">
                  Named with both Excel sheet & specific date
                </span>
              </div>

              {/* KPI Strip */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                <div className="p-3 rounded-xl bg-indigo-50 border border-indigo-200">
                  <span className="text-[11px] font-semibold text-indigo-700 block">Total Sheet Tasks</span>
                  <div className="flex items-baseline gap-1 mt-0.5">
                    <span className="text-xl font-bold text-indigo-950">{finalLeads.length}</span>
                    <span className="text-xs text-indigo-600">records</span>
                  </div>
                </div>

                <div className="p-3 rounded-xl bg-emerald-50 border border-emerald-200">
                  <span className="text-[11px] font-semibold text-emerald-800 block">
                    {activeFile ? "Daily Changes" : "Uploaded Sheets"}
                  </span>
                  <div className="flex items-baseline gap-1 mt-0.5">
                    <span className="text-xl font-bold text-emerald-950">
                      {activeFile ? activeDailyChanges.length : files.length}
                    </span>
                    <span className="text-xs text-emerald-700">
                      {activeFile ? "activities" : "files compiled"}
                    </span>
                  </div>
                </div>

                <div className="p-3 rounded-xl bg-slate-50 border border-slate-200 col-span-2">
                  <span className="text-[11px] font-semibold text-slate-700 block">
                    Assignment Distribution
                  </span>
                  <div className="flex flex-wrap items-center gap-1.5 mt-1">
                    {Object.entries(handlerBreakdown).map(([hName, count]) => (
                      <span
                        key={hName}
                        className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-bold ${
                          hName === "Unassigned / Pending"
                            ? "bg-amber-100 border border-amber-300 text-amber-900"
                            : "bg-white border border-slate-200 text-slate-800"
                        }`}
                      >
                        <span>{hName}:</span>
                        <span>{count}</span>
                      </span>
                    ))}
                    {Object.keys(handlerBreakdown).length === 0 && (
                      <span className="text-xs text-slate-400">None in scope</span>
                    )}
                  </div>
                </div>
              </div>

              {/* Document Preview Sections */}
              <div className="space-y-4">
                {/* 1. Daily Changes Log Preview - Only if individual sheet is selected and changes log enabled */}
                {includeChangesLog && activeFile && activeDailyChanges.length > 0 && (
                  <div>
                    <h3 className="text-xs font-bold text-slate-800 uppercase tracking-wider mb-2 flex items-center gap-1.5">
                      <History className="w-4 h-4 text-emerald-600" />
                      <span>
                        1. Daily Changes & Activity Log Preview ({activeDailyChanges.length} Events)
                      </span>
                    </h3>
                    <div className="border border-slate-200 rounded-xl overflow-hidden max-h-[220px] overflow-y-auto">
                      <table className="w-full text-xs text-left">
                        <thead className="bg-slate-900 text-white font-bold sticky top-0">
                          <tr>
                            <th className="py-2 px-3 w-8 text-center">#</th>
                            <th className="py-2 px-3">Time</th>
                            <th className="py-2 px-3">Client</th>
                            <th className="py-2 px-3">Action</th>
                            <th className="py-2 px-3">Change Summary</th>
                            <th className="py-2 px-3">Handler</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                          {activeDailyChanges.map((ch, i) => (
                            <tr key={ch.id} className="hover:bg-slate-50">
                              <td className="py-1.5 px-3 text-slate-400 text-center font-mono">
                                {i + 1}
                              </td>
                              <td className="py-1.5 px-3 font-mono text-[11px] text-slate-600">
                                {ch.timestamp ? formatTimeFromIso(ch.timestamp) : "-"}
                              </td>
                              <td className="py-1.5 px-3 font-bold text-slate-900">
                                {ch.leadName}
                              </td>
                              <td className="py-1.5 px-3">
                                <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-indigo-50 text-indigo-700">
                                  {ch.changeType.toUpperCase()}
                                </span>
                              </td>
                              <td className="py-1.5 px-3 text-slate-700">{ch.summary}</td>
                              <td className="py-1.5 px-3 text-emerald-700 font-semibold">
                                {ch.handlerName || "-"}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}

                {/* Sheet Tasks & Client Register Preview */}
                <div>
                  <h3 className="text-xs font-bold text-slate-800 uppercase tracking-wider mb-2 flex items-center gap-1.5">
                    <UserCheck className="w-4 h-4 text-indigo-600" />
                    <span>
                      {includeChangesLog && activeFile && activeDailyChanges.length > 0 ? "2. " : ""}
                      Sheet Tasks & Client Register Preview ({finalLeads.length} Records)
                    </span>
                  </h3>

                  {finalLeads.length === 0 ? (
                    <div className="p-6 text-center bg-slate-50 rounded-xl border border-dashed border-slate-300">
                      <AlertCircle className="w-6 h-6 text-amber-500 mx-auto mb-1.5" />
                      <p className="text-xs font-bold text-slate-800">
                        No client records found for this specific date in {activeFile ? activeFile.fileName : "current scope"}.
                      </p>
                      <p className="text-[11px] text-slate-500 mt-0.5">
                        {activeDailyChanges.length > 0
                          ? "However, changes and modifications are logged and will be compiled into the report!"
                          : "Try switching dates or choosing All Dates."}
                      </p>
                    </div>
                  ) : (
                    <div className="border border-slate-200 rounded-xl overflow-hidden max-h-[280px] overflow-y-auto">
                      <table className="w-full text-xs text-left">
                        <thead className="bg-slate-900 text-white font-bold sticky top-0">
                          <tr>
                            <th className="py-2 px-3 w-8 text-center">#</th>
                            <th className="py-2 px-3">Client Name</th>
                            <th className="py-2 px-3">Phone Number</th>
                            <th className="py-2 px-3">Email ID</th>
                            <th className="py-2 px-3">City</th>
                            <th className="py-2 px-3">Month</th>
                            <th className="py-2 px-3">Call Status</th>
                            <th className="py-2 px-3">Handler Change</th>
                            {hasAnyManualNotes && <th className="py-2 px-3">Manual Notes</th>}
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                          {finalLeads.map((lead, idx) => {
                            const isAssigned = isLeadAssignedToHandler(lead, handlers);
                            const hName = getLeadHandlerName(lead, handlers);

                            // Find handler assignment change or current status
                            const assignChange = activeDailyChanges.find(
                              (c) =>
                                c.leadId === lead.id &&
                                (c.changeType === "assignment" || c.field === "handlerName" || c.field === "handler")
                            );
                            let handlerChangeStr = "";
                            if (assignChange) {
                              if (assignChange.oldValue && assignChange.newValue && assignChange.oldValue !== assignChange.newValue) {
                                handlerChangeStr = `${assignChange.oldValue} → ${assignChange.newValue}`;
                              } else if (assignChange.summary) {
                                handlerChangeStr = assignChange.summary;
                              }
                            }
                            if (!handlerChangeStr) {
                              handlerChangeStr = isAssigned
                                ? (lead.assignedAt ? `Assigned to ${hName}` : hName)
                                : "Awaiting Assignment";
                            }

                            return (
                              <tr key={lead.id} className="hover:bg-slate-50">
                                <td className="py-1.5 px-3 text-slate-400 text-center font-mono">
                                  {idx + 1}
                                </td>
                                <td className="py-1.5 px-3 font-bold text-slate-900">
                                  {lead.fullName || "Unnamed Client"}
                                </td>
                                <td className="py-1.5 px-3 font-mono text-slate-600">
                                  {lead.phoneNumber || "-"}
                                </td>
                                <td className="py-1.5 px-3 text-slate-600">
                                  {lead.email || "-"}
                                </td>
                                <td className="py-1.5 px-3 text-slate-600">
                                  {lead.city || "-"}
                                </td>
                                <td className="py-1.5 px-3 font-semibold text-slate-700">
                                  {lead.month || lead.lostYearOrMonth || "-"}
                                </td>
                                <td className="py-1.5 px-3">
                                  <span className="px-1.5 py-0.5 rounded text-[10px] font-semibold bg-slate-100 text-slate-700">
                                    {lead.status}
                                  </span>
                                </td>
                                <td className="py-1.5 px-3 font-semibold text-indigo-700">
                                  {handlerChangeStr}
                                </td>
                                {hasAnyManualNotes && (
                                  <td
                                    className="py-1.5 px-3 text-slate-700 max-w-[200px] truncate"
                                    title={lead.manualNotes || ""}
                                  >
                                    {lead.manualNotes && lead.manualNotes.trim().length > 0
                                      ? lead.manualNotes.trim()
                                      : "-"}
                                  </td>
                                )}
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Modal Bottom Footer Actions */}
        <div className="px-6 py-4 border-t border-slate-200 bg-slate-50 flex flex-col sm:flex-row items-center justify-between gap-3">
          <div className="flex items-center gap-2 flex-wrap">
            <button
              id="btn-copy-pdf-summary"
              type="button"
              onClick={handleCopySummary}
              className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-semibold text-slate-700 bg-white border border-slate-300 hover:bg-slate-100 rounded-xl transition-colors cursor-pointer"
            >
              {copiedStatus ? (
                <>
                  <Check className="w-3.5 h-3.5 text-emerald-600" />
                  <span className="text-emerald-700">Copied to Clipboard!</span>
                </>
              ) : (
                <>
                  <Copy className="w-3.5 h-3.5 text-slate-500" />
                  <span>Copy Report Summary</span>
                </>
              )}
            </button>

            <button
              id="btn-print-pdf-report"
              type="button"
              onClick={handlePrintPreview}
              disabled={isGenerating}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold text-slate-800 bg-white border border-slate-300 hover:bg-slate-100 rounded-xl transition-colors cursor-pointer disabled:opacity-50"
              title="Open print view"
            >
              <Printer className="w-3.5 h-3.5 text-slate-600" />
              <span>Print / Preview</span>
            </button>
          </div>

          <div className="flex items-center gap-2 w-full sm:w-auto justify-end">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-xs font-semibold text-slate-600 hover:text-slate-800 bg-transparent hover:bg-slate-200/60 rounded-xl transition-colors cursor-pointer"
            >
              Close
            </button>

            <button
              id="btn-confirm-download-pdf"
              type="button"
              onClick={handleDownload}
              disabled={isGenerating || (finalLeads.length === 0 && activeDailyChanges.length === 0)}
              className="inline-flex items-center gap-2 px-5 py-2.5 text-white text-xs sm:text-sm font-bold rounded-xl shadow-xs transition-all cursor-pointer bg-indigo-600 hover:bg-indigo-700 disabled:bg-indigo-300 disabled:cursor-not-allowed"
              title={`Download ${targetOutputFileName}`}
            >
              <Download className="w-4 h-4" />
              <span>
                {isGenerating ? "Generating PDF..." : `Download PDF (${targetOutputFileName})`}
              </span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
