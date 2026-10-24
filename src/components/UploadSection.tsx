import React, { useState, useRef, useEffect } from "react";
import {
  UploadCloud,
  Sparkles,
  FileText,
  FileSpreadsheet,
  Check,
  AlertCircle,
  Loader2,
  ArrowRight,
  Download,
  Zap,
  Calendar,
  Lock,
  UserCheck,
} from "lucide-react";
import {
  parseExcelFile,
  parseCsvLeads,
  parseXmlSpreadsheet,
  isXmlSpreadsheet,
  exportLeadsToExcel,
} from "../utils/parser";
import { RAW_CSV_SAMPLE, RAW_UNSTRUCTURED_SAMPLE, DEFAULT_SAMPLE_LEADS } from "../data/sampleLeads";
import { Lead, HandlerRecord } from "../types";
import { getLocalDateString, formatUploadDayLabel } from "../utils/dateUtils";
import { apiClient } from "../services/apiClient";
import { hasPermission } from "../utils/authService";

export interface UploadFileInfo {
  id?: string;
  fileName: string;
  uploadDate: string;
  fileSize?: string;
  fileType: "xlsx" | "xls" | "xml" | "csv" | "text" | "manual";
}

export interface ExtractedFileResult {
  leads: Lead[];
  fileInfo: UploadFileInfo;
}

interface UploadSectionProps {
  onLeadsExtracted: (
    newLeads: Lead[],
    mode: "append" | "replace",
    fileInfo?: UploadFileInfo
  ) => void;
  onMultipleFilesExtracted?: (
    results: ExtractedFileResult[],
    mode: "append" | "replace"
  ) => void;
  presetUploadDate?: string;
  shortcutKey?: string;
  handlers?: HandlerRecord[];
}

export const UploadSection: React.FC<UploadSectionProps> = ({
  onLeadsExtracted,
  onMultipleFilesExtracted,
  presetUploadDate,
  shortcutKey,
  handlers = [],
}) => {
  const [isOpen, setIsOpen] = useState(true);
  const [activeTab, setActiveTab] = useState<"upload" | "paste">("upload");
  const [pastedContent, setPastedContent] = useState("");
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [selectedFilesSummary, setSelectedFilesSummary] = useState<string | null>(null);
  const [filePreviewText, setFilePreviewText] = useState("");
  const [isDragOver, setIsDragOver] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [importMode, setImportMode] = useState<"replace" | "append">("append");
  const [selectedImportHandler, setSelectedImportHandler] = useState<string>("");
  
  const todayStr = getLocalDateString(0);
  const tomorrowStr = getLocalDateString(1);
  const todayLabel = formatUploadDayLabel(todayStr);
  const [targetUploadDate, setTargetUploadDate] = useState<string>(todayStr);

  useEffect(() => {
    if (presetUploadDate) {
      setTargetUploadDate(presetUploadDate);
      setIsOpen(true);
      setActiveTab("upload");
    }
  }, [presetUploadDate]);

  const [statusMessage, setStatusMessage] = useState<{
    type: "success" | "error" | "info";
    text: string;
  } | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);

  /**
   * Helper to parse a single File into enriched leads and metadata
   */
  const extractFileLeads = async (
    file: File,
    effectiveUploadDate: string,
    fileIndex: number = 0
  ): Promise<{ leads: Lead[]; fileInfo: UploadFileInfo; preview?: string }> => {
    const fileName = (file?.name || "").toLowerCase();
    const isXml = fileName.endsWith(".xml");
    const isExcel =
      fileName.endsWith(".xlsx") ||
      fileName.endsWith(".xls") ||
      fileName.endsWith(".xlsm") ||
      fileName.endsWith(".xlsb");
    const fileId = `file-${Date.now()}-${fileIndex}-${Math.random().toString(36).slice(2, 6)}`;
    const fileSize = `${(file.size / 1024).toFixed(1)} KB`;

    let isXmlByContent = isXml;
    let cachedText: string | null = null;

    if (!isExcel || isXml) {
      try {
        cachedText = await file.text();
        if (isXmlSpreadsheet(cachedText)) {
          isXmlByContent = true;
        }
      } catch (_) {}
    } else {
      try {
        const headerSlice = await file.slice(0, 1500).text();
        if (isXmlSpreadsheet(headerSlice)) {
          isXmlByContent = true;
        }
      } catch (_) {}
    }

    const fileType: "xlsx" | "xls" | "xml" | "csv" | "text" = isXmlByContent
      ? "xml"
      : isExcel
      ? fileName.endsWith(".xls")
        ? "xls"
        : "xlsx"
      : fileName.endsWith(".csv")
      ? "csv"
      : "text";

    let extractedLeads: Lead[] = [];

    if (isXmlByContent) {
      const xmlText = cachedText || (await file.text());
      extractedLeads = parseXmlSpreadsheet(xmlText, {
        uploadDate: effectiveUploadDate,
        uploadedFileName: file.name,
        fileId,
      });
    } else if (isExcel) {
      try {
        extractedLeads = await parseExcelFile(file, {
          uploadDate: effectiveUploadDate,
          uploadedFileName: file.name,
          fileId,
        });
      } catch (excelErr) {
        try {
          const txt = cachedText || (await file.text());
          extractedLeads = parseCsvLeads(txt, {
            uploadDate: effectiveUploadDate,
            uploadedFileName: file.name,
            fileId,
          });
        } catch (_) {
          throw excelErr;
        }
      }
    } else if (fileName.endsWith(".csv") || fileName.endsWith(".tsv") || fileName.endsWith(".txt")) {
      const text = cachedText || (await file.text());
      extractedLeads = parseCsvLeads(text, {
        uploadDate: effectiveUploadDate,
        uploadedFileName: file.name,
        fileId,
      });

      if (extractedLeads.length === 0) {
        const data = await apiClient.extractLeads(text, file.name);
        if (data.leads && data.leads.length > 0) {
          extractedLeads = data.leads.map((l: any, idx: number) => ({
            id: `lead-auto-${Date.now()}-${fileIndex}-${idx}`,
            paymentReceipt: l.paymentReceipt || "Pending Receipt",
            proof: l.proof || "Verified",
            month: l.month || l.lostYearOrMonth || "Not specified",
            lostYearOrMonth: l.month || l.lostYearOrMonth || "Not specified",
            fullName: l.fullName || "Lead",
            phoneNumber: l.phoneNumber || "",
            email: l.email || "",
            city: l.city || "Unknown",
            status: l.status || "Requires Follow-up",
            notes: l.notes || "Imported from file",
            createdAt: new Date().toISOString(),
            callCount: 0,
            uploadDate: effectiveUploadDate,
            uploadedFileName: file.name,
            fileId,
          }));
        }
      }
    } else {
      const text = cachedText || (await file.text());
      if (isXmlSpreadsheet(text)) {
        extractedLeads = parseXmlSpreadsheet(text, {
          uploadDate: effectiveUploadDate,
          uploadedFileName: file.name,
          fileId,
        });
      } else {
        extractedLeads = parseCsvLeads(text, {
          uploadDate: effectiveUploadDate,
          uploadedFileName: file.name,
          fileId,
        });
      }
    }

    if (extractedLeads.length === 0) {
      throw new Error(
        `Could not detect tabular rows or lead entries in "${file.name}". Please verify columns include Name, Phone, Month, or Status.`
      );
    }

    const isImportHandlerSelected = Boolean(selectedImportHandler && selectedImportHandler.trim() !== "");
    const matchedImportHandler = isImportHandlerSelected
      ? handlers?.find((h) => h?.name && h.name.toLowerCase() === selectedImportHandler.trim().toLowerCase())
      : undefined;

    const enrichedLeads = extractedLeads.map((lead) => {
      const hasExistingHandler = Boolean(
        lead.handlerName &&
        lead.handlerName.trim() !== "" &&
        lead.handlerName.toLowerCase() !== "unassigned" &&
        lead.handlerName.toLowerCase() !== "none" &&
        lead.handlerName.toLowerCase() !== "not assigned"
      );

      // Only assign records where handler is missing or unassigned
      if (!hasExistingHandler && isImportHandlerSelected) {
        return {
          ...lead,
          handlerName: selectedImportHandler.trim(),
          handlerId: matchedImportHandler?.id,
          assignmentCategory: "assigned" as const,
          assignedAt: new Date().toISOString(),
          reportDate: effectiveUploadDate,
          uploadDate: effectiveUploadDate,
          uploadedFileName: file.name,
          fileId,
        };
      }

      if (hasExistingHandler) {
        return {
          ...lead,
          handlerName: lead.handlerName?.trim() || "",
          assignmentCategory: "assigned" as const,
          assignedAt: lead.assignedAt || new Date().toISOString(),
          reportDate: lead.reportDate || effectiveUploadDate,
          uploadDate: effectiveUploadDate,
          uploadedFileName: file.name,
          fileId,
        };
      }

      return {
        ...lead,
        handlerName: "",
        handlerId: undefined,
        assignmentCategory: "unassigned" as const,
        assignedAt: undefined,
        reportDate: undefined,
        uploadDate: effectiveUploadDate,
        uploadedFileName: file.name,
        fileId,
      };
    });

    return {
      leads: enrichedLeads,
      fileInfo: {
        id: fileId,
        fileName: file.name,
        uploadDate: effectiveUploadDate,
        fileSize,
        fileType,
      },
      preview: cachedText ? cachedText.slice(0, 3000) : undefined,
    };
  };

  /**
   * Automatically analyze uploaded Excel / XML spreadsheet(s)
   * Supports MULTIPLE file uploads simultaneously, tracking each by its original filename!
   */
  const handleAutoAnalyzeFiles = async (filesList: FileList | File[]) => {
    const rawFiles = Array.from(filesList).filter(Boolean);
    if (rawFiles.length === 0) return;

    if (!hasPermission("files:upload")) {
      setStatusMessage({
        type: "error",
        text: "Permission Denied: File upload is restricted for your role. Contact a Manager to enable this permission in Access Control (RBAC).",
      });
      return;
    }

    setStatusMessage(null);
    setIsProcessing(true);

    const effectiveUploadDate = targetUploadDate || todayStr;
    const effectiveDayLabel =
      effectiveUploadDate === todayStr ? "Today's date" : formatUploadDayLabel(effectiveUploadDate).label;

    if (rawFiles.length === 1) {
      // Single file upload
      const file = rawFiles[0];
      setSelectedFile(file);
      setSelectedFilesSummary(null);

      try {
        setStatusMessage({
          type: "info",
          text: `Analyzing spreadsheet "${file.name}" reflecting ${effectiveDayLabel} (${effectiveUploadDate})...`,
        });

        const result = await extractFileLeads(file, effectiveUploadDate, 0);
        if (result.preview) setFilePreviewText(result.preview);

        if (onMultipleFilesExtracted) {
          onMultipleFilesExtracted([result], importMode);
        } else {
          onLeadsExtracted(result.leads, importMode, result.fileInfo);
        }

        setStatusMessage({
          type: "success",
          text: `Analysis complete! Entered ${result.leads.length} record(s) from "${file.name}" reflecting ${effectiveDayLabel} (${effectiveUploadDate}). Categorized under its dedicated sheet tab!`,
        });
        setIsProcessing(false);
      } catch (err: any) {
        console.error("Auto analyze error:", err);
        setIsProcessing(false);
        setStatusMessage({
          type: "error",
          text: err.message || `Failed to analyze "${file.name}". Please check format.`,
        });
      }
      return;
    }

    // Multiple files upload
    setSelectedFile(null);
    setSelectedFilesSummary(`${rawFiles.length} files selected: ${rawFiles.map((f) => f.name).join(", ")}`);

    const results: ExtractedFileResult[] = [];
    const errors: string[] = [];
    let totalLeadsCount = 0;

    for (let i = 0; i < rawFiles.length; i++) {
      const file = rawFiles[i];
      try {
        setStatusMessage({
          type: "info",
          text: `Analyzing file ${i + 1} of ${rawFiles.length}: "${file.name}" (${(file.size / 1024).toFixed(1)} KB)...`,
        });

        const res = await extractFileLeads(file, effectiveUploadDate, i);
        results.push(res);
        totalLeadsCount += res.leads.length;
      } catch (err: any) {
        console.error(`Error analyzing file "${file.name}":`, err);
        errors.push(`"${file.name}": ${err.message || "Failed to parse"}`);
      }
    }

    if (results.length > 0) {
      if (onMultipleFilesExtracted) {
        onMultipleFilesExtracted(results, importMode);
      } else {
        // Fallback: feed files sequentially
        results.forEach((r) => onLeadsExtracted(r.leads, importMode, r.fileInfo));
      }

      const fileSummaries = results
        .map((r) => `"${r.fileInfo.fileName}" (${r.leads.length} leads)`)
        .join(", ");

      setStatusMessage({
        type: "success",
        text: `Analysis complete! Ingested ${results.length} spreadsheet(s) [${totalLeadsCount} total clients]: ${fileSummaries}. Each upload is tracked by its original filename with separate Main, Unassigned, and Assigned views!${
          errors.length > 0 ? ` (Note: ${errors.length} file(s) had errors: ${errors.join("; ")})` : ""
        }`,
      });
    } else {
      setStatusMessage({
        type: "error",
        text: `Failed to analyze selected files: ${errors.join("; ")}`,
      });
    }

    setIsProcessing(false);
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(false);
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      handleAutoAnalyzeFiles(e.dataTransfer.files);
    }
  };

  // AI or Text Extract for pasted raw CRM logs / text
  const handlePastedDataAnalyze = async () => {
    if (!hasPermission("files:upload")) {
      setStatusMessage({
        type: "error",
        text: "Permission Denied: Pasting and ingesting client records is restricted for your role. Contact a Manager to enable this permission in Access Control (RBAC).",
      });
      return;
    }

    if (!pastedContent.trim()) {
      setStatusMessage({ type: "error", text: "Please paste lead data or CRM notes first." });
      return;
    }

    const fileId = `file-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;

    try {
      setIsProcessing(true);
      setStatusMessage({
        type: "info",
        text: `Analyzing pasted data for section "${formatUploadDayLabel(targetUploadDate).label}" (${targetUploadDate})...`,
      });

      // Quick check if pasted CSV
      const quickCsv = parseCsvLeads(pastedContent, {
        uploadDate: targetUploadDate,
        uploadedFileName: "Pasted_Spreadsheet_Data.csv",
        fileId,
      });
      if (quickCsv.length > 0) {
        onLeadsExtracted(quickCsv, importMode, {
          id: fileId,
          fileName: "Pasted_Spreadsheet_Data.csv",
          uploadDate: targetUploadDate,
          fileSize: `${(pastedContent.length / 1024).toFixed(1)} KB`,
          fileType: "csv",
        });
        const dayLabel = formatUploadDayLabel(targetUploadDate).label;
        setStatusMessage({
          type: "success",
          text: `Auto-analyzed! Entered ${quickCsv.length} record(s) under "${dayLabel}'s" section.`,
        });
        setIsProcessing(false);
        return;
      }

      // Send to server-side extraction
      const data = await apiClient.extractLeads(pastedContent, "Pasted text");

      const formatted: Lead[] = (data.leads || []).map((l: any, i: number) => ({
        id: `lead-paste-${Date.now()}-${i}`,
        paymentReceipt: l.paymentReceipt || "Pending Receipt",
        proof: l.proof || "Verified",
        month: l.month || l.lostYearOrMonth || "Not specified",
        lostYearOrMonth: l.month || l.lostYearOrMonth || "Not specified",
        fullName: l.fullName || "Lead",
        phoneNumber: l.phoneNumber || "",
        email: l.email || "",
        city: l.city || "Unknown",
        status: l.status || "Requires Follow-up",
        notes: l.notes || "Extracted from text",
        createdAt: new Date().toISOString(),
        callCount: 0,
        uploadDate: targetUploadDate,
        uploadedFileName: "Pasted_Lead_Batch.txt",
        fileId,
      }));

      if (formatted.length === 0) {
        setStatusMessage({
          type: "error",
          text: "No records could be identified. Try checking your pasted text.",
        });
        setIsProcessing(false);
        return;
      }

      onLeadsExtracted(formatted, importMode, {
        id: fileId,
        fileName: "Pasted_Lead_Batch.txt",
        uploadDate: targetUploadDate,
        fileSize: `${(pastedContent.length / 1024).toFixed(1)} KB`,
        fileType: "text",
      });
      const dayLabel = formatUploadDayLabel(targetUploadDate).label;
      setStatusMessage({
        type: "success",
        text: `Analysis complete! Entered ${formatted.length} record(s) under "${dayLabel}'s" section.`,
      });
      setIsProcessing(false);
    } catch (err: any) {
      setIsProcessing(false);
      setStatusMessage({
        type: "error",
        text: err.message || "Failed to analyze pasted text.",
      });
    }
  };

  const handleDownloadSampleExcel = () => {
    exportLeadsToExcel(DEFAULT_SAMPLE_LEADS);
  };

  const loadSampleCsv = () => {
    setActiveTab("paste");
    setPastedContent(RAW_CSV_SAMPLE);
    setStatusMessage({
      type: "info",
      text: "Loaded sample data with Payment Receipt, Month, Name, Phone & City. Click 'Analyze & Enter to Software'.",
    });
  };

  const loadSampleUnstructured = () => {
    setActiveTab("paste");
    setPastedContent(RAW_UNSTRUCTURED_SAMPLE);
    setStatusMessage({
      type: "info",
      text: "Loaded raw payment & lead register text. Click 'Analyze & Enter to Software'.",
    });
  };

  return (
    <div className="bg-white border border-slate-200/90 rounded-2xl shadow-xs overflow-hidden transition-all">
      {/* Accordion Header */}
      <div
        onClick={() => setIsOpen(!isOpen)}
        className="px-6 py-4 flex items-center justify-between cursor-pointer hover:bg-slate-50/70 transition-colors"
      >
        <div className="flex items-center gap-3">
          <div className="p-2.5 rounded-xl bg-indigo-50 text-indigo-600 border border-indigo-100">
            <FileSpreadsheet className="w-5 h-5" />
          </div>
          <div>
            <h2 className="text-base font-bold text-slate-900 flex items-center gap-2">
              <span>Spreadsheet Auto-Analyzer & Ingestion</span>
              <span className="text-[11px] font-semibold px-2 py-0.5 rounded-md bg-indigo-50 text-indigo-700 border border-indigo-200/80 flex items-center gap-1">
                <Zap className="w-3 h-3" /> Auto-Entry
              </span>
            </h2>
            <p className="text-xs text-slate-500 mt-0.5">
              Upload Excel / XML (.xlsx, .xls, .xml, .csv) — Automatically enters Payment Receipt, Proof, Month, Full Name, Phone (tel:), Email, City & Manual Notes
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <span className="text-xs text-indigo-600 font-medium hidden sm:inline">
            {isOpen ? "Collapse" : "Expand"}
          </span>
          <div
            className={`w-7 h-7 rounded-full bg-slate-100 flex items-center justify-center text-slate-600 transition-transform ${
              isOpen ? "rotate-180" : ""
            }`}
          >
            ↓
          </div>
        </div>
      </div>

      {/* Accordion Body */}
      {isOpen && (
        <div className="px-6 pb-6 pt-3 border-t border-slate-100 bg-slate-50/40">
          {/* Active Auto-Date & Tab Categorization Info Notice */}
          <div className="bg-white border border-slate-200 rounded-xl p-3 flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 text-xs text-slate-800 mb-4 shadow-2xs">
            <div className="flex items-center gap-2.5">
              <div className="p-1.5 rounded-lg bg-indigo-600 text-white shrink-0">
                <Check className="w-3.5 h-3.5" />
              </div>
              <div>
                <span className="font-bold text-slate-900 block sm:inline">
                  Automated Date Ingestion:
                </span>{" "}
                <span className="text-slate-600">
                  Uploaded spreadsheets are automatically tagged with{" "}
                  <strong className="text-indigo-700 font-semibold">
                    {formatUploadDayLabel(targetUploadDate).label} ({targetUploadDate})
                  </strong>{" "}
                  and categorized into their own dedicated sheet tab for instant access.
                </span>
              </div>
            </div>
            <div className="flex items-center gap-1.5 shrink-0 self-start sm:self-auto">
              <span className="px-2 py-0.5 rounded-md bg-indigo-600 text-white font-bold text-[11px] shadow-2xs">
                Target: {targetUploadDate}
              </span>
              <span className="px-2 py-0.5 rounded-md bg-slate-100 text-slate-700 font-semibold text-[11px] border border-slate-200">
                Categorized Tab
              </span>
            </div>
          </div>

          {/* Quick preset toolbar & Excel template download */}
          <div className="flex flex-wrap items-center justify-between gap-3 py-3 border-b border-slate-200/70 mb-4">
            {/* Upload Target Day Selector */}
            <div className="flex flex-wrap items-center gap-2 text-xs">
              <span className="font-semibold text-slate-700 flex items-center gap-1.5">
                <Calendar className="w-3.5 h-3.5 text-indigo-600" />
                Upload to Day Section:
              </span>
              <div className="inline-flex rounded-lg p-0.5 bg-slate-200/70 border border-slate-200">
                <button
                  id="btn-select-upload-today"
                  type="button"
                  onClick={() => setTargetUploadDate(todayStr)}
                  className={`px-3 py-1 rounded-md text-xs font-bold transition-all cursor-pointer ${
                    targetUploadDate === todayStr
                      ? "bg-white text-indigo-900 shadow-xs border border-slate-200"
                      : "text-slate-600 hover:text-slate-900"
                  }`}
                >
                  Today ({todayStr.slice(5)})
                </button>
                <button
                  id="btn-select-upload-tomorrow"
                  type="button"
                  onClick={() => setTargetUploadDate(tomorrowStr)}
                  className={`px-3 py-1 rounded-md text-xs font-bold transition-all cursor-pointer ${
                    targetUploadDate === tomorrowStr
                      ? "bg-white text-indigo-900 shadow-xs border border-slate-200"
                      : "text-slate-600 hover:text-slate-900"
                  }`}
                >
                  Tomorrow ({tomorrowStr.slice(5)})
                </button>
              </div>

              <div className="flex items-center gap-1">
                <span className="text-[11px] text-slate-500">Other date:</span>
                <input
                  id="input-custom-upload-date"
                  type="date"
                  value={targetUploadDate}
                  onChange={(e) => e.target.value && setTargetUploadDate(e.target.value)}
                  className="px-2 py-1 text-xs bg-white border border-slate-200 rounded-md text-slate-700 cursor-pointer outline-none focus:ring-1 focus:ring-indigo-500 shadow-2xs font-mono"
                  title="Choose custom upload date section"
                />
              </div>

              {/* Assign Handler Dropdown Selector */}
              <div className="flex items-center gap-1.5 ml-1 pl-2 border-l border-slate-200">
                <span className="font-semibold text-slate-700 flex items-center gap-1">
                  <UserCheck className="w-3.5 h-3.5 text-indigo-600" />
                  Assign Handler:
                </span>
                <select
                  id="select-import-handler"
                  value={selectedImportHandler}
                  onChange={(e) => setSelectedImportHandler(e.target.value)}
                  className="px-2.5 py-1 text-xs bg-white border border-slate-200 rounded-md text-slate-800 font-semibold cursor-pointer outline-none focus:ring-1 focus:ring-indigo-500 shadow-2xs"
                  title="Select handler to assign to incoming leads without an existing handler"
                >
                  <option value="">Unassigned</option>
                  {handlers.map((h) => (
                    <option key={h.id} value={h.name}>
                      {h.name}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div className="flex items-center gap-3 text-xs text-slate-600">
              <div className="flex items-center gap-2">
                <span className="font-medium">Mode:</span>
                <label className="inline-flex items-center gap-1 cursor-pointer">
                  <input
                    type="radio"
                    name="importMode"
                    value="append"
                    checked={importMode === "append"}
                    onChange={() => setImportMode("append")}
                    className="text-indigo-600 focus:ring-indigo-500"
                  />
                  Append
                </label>
                <label className="inline-flex items-center gap-1 cursor-pointer">
                  <input
                    type="radio"
                    name="importMode"
                    value="replace"
                    checked={importMode === "replace"}
                    onChange={() => setImportMode("replace")}
                    className="text-indigo-600 focus:ring-indigo-500"
                  />
                  Replace
                </label>
              </div>

              <button
                id="btn-download-sample-excel"
                type="button"
                onClick={handleDownloadSampleExcel}
                className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-medium text-slate-700 bg-white border border-slate-200 hover:bg-slate-50 rounded-md transition-colors cursor-pointer shadow-2xs"
                title="Download ready-to-use sample Excel .xlsx template"
              >
                <Download className="w-3 h-3 text-slate-500" />
                <span>Sample Template</span>
              </button>
            </div>
          </div>

          {/* Mode Tabs */}
          <div className="flex gap-2 mb-3">
            <button
              id="tab-upload-excel"
              type="button"
              onClick={() => setActiveTab("upload")}
              className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition-colors cursor-pointer flex items-center gap-1.5 ${
                activeTab === "upload"
                  ? "bg-white text-indigo-900 shadow-xs border border-slate-200"
                  : "text-slate-600 hover:text-slate-900"
              }`}
            >
              <FileSpreadsheet className="w-4 h-4 text-indigo-600" />
              Upload Excel / XML Sheet (.xlsx, .xls, .xml, .csv)
            </button>
            <button
              id="tab-paste-text"
              type="button"
              onClick={() => setActiveTab("paste")}
              className={`px-3 py-1.5 text-xs font-medium rounded-lg transition-colors cursor-pointer flex items-center gap-1.5 ${
                activeTab === "paste"
                  ? "bg-white text-indigo-900 shadow-xs border border-slate-200"
                  : "text-slate-600 hover:text-slate-900"
              }`}
            >
              <FileText className="w-3.5 h-3.5 text-slate-500" />
              Paste Raw Data / Text
            </button>
          </div>

          {/* Dynamic RBAC Notice if Upload is restricted */}
          {!hasPermission("files:upload") && (
            <div
              id="banner-upload-restricted"
              className="mb-3.5 p-3 rounded-xl bg-amber-50 border border-amber-200 text-amber-900 text-xs flex items-center justify-between gap-2"
            >
              <div className="flex items-center gap-2">
                <Lock className="w-4 h-4 text-amber-600 shrink-0" />
                <span>
                  <strong>Upload Restricted for Staff Role:</strong> File ingestion permission (<code className="font-mono text-amber-900 bg-amber-100 px-1 py-0.5 rounded">files:upload</code>) is currently disabled. A Manager can dynamically toggle this in <strong>Settings &rarr; Access Control (RBAC)</strong>.
                </span>
              </div>
              <span className="text-[10px] uppercase font-bold bg-amber-200 text-amber-900 px-1.5 py-0.5 rounded shrink-0">
                Staff Restricted
              </span>
            </div>
          )}

          {/* Upload Tab with Automatic Excel Entry */}
          {activeTab === "upload" && (
            <div>
              <div
                id="upload-dropzone-box"
                onDragOver={handleDragOver}
                onDragLeave={handleDragLeave}
                onDrop={handleDrop}
                onClick={() => fileInputRef.current?.click()}
                className={`border-2 border-dashed rounded-xl p-8 text-center cursor-pointer transition-all ${
                  isDragOver
                    ? "border-indigo-500 bg-indigo-50/60 scale-[1.005]"
                    : "border-slate-300 bg-white hover:border-indigo-400 hover:bg-slate-50/50"
                }`}
              >
                <input
                  id="input-upload-excel-file"
                  ref={fileInputRef}
                  type="file"
                  multiple
                  accept=".xlsx,.xls,.xlsm,.xlsb,.xml,.csv,.tsv,.txt"
                  onClick={(e) => {
                    (e.target as HTMLInputElement).value = "";
                  }}
                  onChange={(e) => {
                    if (e.target.files && e.target.files.length > 0) {
                      handleAutoAnalyzeFiles(e.target.files);
                    }
                  }}
                  className="hidden"
                />

                <div className="flex flex-col items-center justify-center gap-2.5">
                  <div className="p-3.5 bg-indigo-50 border border-indigo-100 rounded-2xl text-indigo-600 shadow-xs">
                    {isProcessing ? (
                      <Loader2 className="w-7 h-7 animate-spin text-indigo-600" />
                    ) : (
                      <UploadCloud className="w-7 h-7" />
                    )}
                  </div>

                  <div>
                    <span className="text-sm font-bold text-slate-800 block">
                      {isProcessing
                        ? `Analyzing Spreadsheets & Entering into "${formatUploadDayLabel(targetUploadDate).label}" Section...`
                        : selectedFilesSummary
                        ? selectedFilesSummary
                        : selectedFile
                        ? `Selected: ${selectedFile.name}`
                        : `Drop one or multiple Excel / XML spreadsheets here (will be added to "${formatUploadDayLabel(targetUploadDate).label}" section)`}
                      {shortcutKey && !selectedFile && !selectedFilesSummary && !isProcessing && (
                        <kbd className="hidden sm:inline-block ml-2 px-1.5 py-0.5 text-[10px] font-mono font-bold bg-slate-100 text-slate-700 border border-slate-300/80 rounded shadow-2xs">
                          {shortcutKey}
                        </kbd>
                      )}
                    </span>
                    <p className="text-xs text-slate-500 mt-1 max-w-md mx-auto">
                      Supports <strong>multiple file uploads</strong> (.xlsx, .xls, .xml, .csv). Each spreadsheet is tracked by its <strong>original filename</strong> with its own Main List, Unassigned List, and Assigned Section!
                    </p>
                  </div>

                  <div className="flex flex-wrap items-center justify-center gap-1.5 mt-1">
                    <span className="text-[11px] px-2 py-0.5 rounded-md bg-indigo-50 text-indigo-800 font-semibold border border-indigo-200/70">
                      Destination: {formatUploadDayLabel(targetUploadDate).label} ({targetUploadDate})
                    </span>
                    <span className="text-[11px] px-2 py-0.5 rounded-md bg-emerald-50 text-emerald-800 font-semibold border border-emerald-200/70">
                      Multi-Sheet Support
                    </span>
                    <span className="text-[11px] px-2 py-0.5 rounded-md bg-slate-100 text-slate-700 font-medium">
                      Original Filename Tracking
                    </span>
                    <span className="text-[11px] px-2 py-0.5 rounded-md bg-slate-100 text-slate-700 font-medium">
                      Month
                    </span>
                    <span className="text-[11px] px-2 py-0.5 rounded-md bg-slate-100 text-slate-700 font-medium">
                      Full Name
                    </span>
                    <span className="text-[11px] px-2 py-0.5 rounded-md bg-slate-100 text-slate-700 font-medium">
                      Click-to-Dial Phone
                    </span>
                    <span className="text-[11px] px-2 py-0.5 rounded-md bg-slate-100 text-slate-700 font-medium">
                      City
                    </span>
                    <span className="text-[11px] px-2 py-0.5 rounded-md bg-slate-100 text-slate-700 font-medium">
                      Manual Notes
                    </span>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Paste Tab */}
          {activeTab === "paste" && (
            <div>
              <textarea
                id="textarea-pasted-lead-data"
                rows={6}
                value={pastedContent}
                onChange={(e) => setPastedContent(e.target.value)}
                placeholder={`Paste CSV rows or payment records here to enter under "${formatUploadDayLabel(targetUploadDate).label}" section (${targetUploadDate})...`}
                className="w-full text-xs sm:text-sm font-mono p-3 bg-white border border-slate-300 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none placeholder:text-slate-400"
              />
              <div className="flex items-center justify-between text-xs text-slate-500 mt-1">
                <span>{pastedContent.length} characters</span>
                <div className="flex items-center gap-2">
                  {pastedContent.length > 0 && (
                    <button
                      type="button"
                      onClick={() => setPastedContent("")}
                      className="text-slate-400 hover:text-red-500 cursor-pointer"
                    >
                      Clear text
                    </button>
                  )}
                  <button
                    id="btn-analyze-paste"
                    type="button"
                    disabled={isProcessing || !pastedContent.trim()}
                    onClick={handlePastedDataAnalyze}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-white bg-indigo-600 hover:bg-indigo-700 rounded-lg shadow-xs disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer transition-colors"
                  >
                    {isProcessing ? (
                      <>
                        <Loader2 className="w-3.5 h-3.5 animate-spin" />
                        Analyzing...
                      </>
                    ) : (
                      <>
                        <Sparkles className="w-3.5 h-3.5" />
                        Analyze & Enter to {formatUploadDayLabel(targetUploadDate).label}
                      </>
                    )}
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* Status Message */}
          {statusMessage && (
            <div
              className={`mt-3.5 p-3.5 rounded-xl flex items-start gap-2.5 text-xs sm:text-sm ${
                statusMessage.type === "success"
                  ? "bg-slate-50 text-slate-800 border border-slate-200"
                  : statusMessage.type === "error"
                  ? "bg-red-50 text-red-800 border border-red-200"
                  : "bg-indigo-50 text-indigo-800 border border-indigo-200"
              }`}
            >
              {statusMessage.type === "success" ? (
                <Check className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
              ) : statusMessage.type === "error" ? (
                <AlertCircle className="w-4 h-4 text-red-600 shrink-0 mt-0.5" />
              ) : (
                <Loader2 className="w-4 h-4 text-indigo-600 shrink-0 mt-0.5 animate-spin" />
              )}
              <div className="flex-1 font-medium">{statusMessage.text}</div>
            </div>
          )}
        </div>
      )}
    </div>
  );
};
