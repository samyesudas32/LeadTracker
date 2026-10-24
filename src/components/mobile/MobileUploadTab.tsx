import React, { useState, useRef } from "react";
import {
  UploadCloud,
  FileSpreadsheet,
  Check,
  AlertCircle,
  Loader2,
  Calendar,
  Sparkles,
  ArrowRight,
  Download,
} from "lucide-react";
import { Lead, HandlerRecord } from "../../types";
import {
  parseExcelFile,
  parseCsvLeads,
  parseXmlSpreadsheet,
  isXmlSpreadsheet,
  exportLeadsToExcel,
} from "../../utils/parser";
import { getLocalDateString, formatUploadDayLabel } from "../../utils/dateUtils";
import { apiClient } from "../../services/apiClient";
import { UploadFileInfo, ExtractedFileResult } from "../UploadSection";

export interface MobileUploadTabProps {
  handlers: HandlerRecord[];
  onLeadsExtracted: (
    newLeads: Lead[],
    mode: "append" | "replace",
    fileInfo?: UploadFileInfo
  ) => void;
  onMultipleFilesExtracted?: (
    results: ExtractedFileResult[],
    mode: "append" | "replace"
  ) => void;
  onSwitchToLeadsTab: () => void;
}

export const MobileUploadTab: React.FC<MobileUploadTabProps> = ({
  handlers = [],
  onLeadsExtracted,
  onMultipleFilesExtracted,
  onSwitchToLeadsTab,
}) => {
  const [selectedImportHandler, setSelectedImportHandler] = useState<string>("");
  const [importMode, setImportMode] = useState<"append" | "replace">("append");
  const [isProcessing, setIsProcessing] = useState(false);
  const [statusMessage, setStatusMessage] = useState<{
    type: "success" | "error" | "info";
    text: string;
  } | null>(null);

  const todayStr = getLocalDateString(0);
  const tomorrowStr = getLocalDateString(1);
  const todayLabel = formatUploadDayLabel(todayStr).label;
  const tomorrowLabel = formatUploadDayLabel(tomorrowStr).label;
  const [targetUploadDate, setTargetUploadDate] = useState<string>(todayStr);

  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleDownloadSample = () => {
    exportLeadsToExcel([
      {
        id: "sample-1",
        fullName: "James Peterson",
        phoneNumber: "+1 (555) 234-5678",
        email: "james.p@example.com",
        city: "Chicago",
        month: "October 2026",
        status: "Interested",
        handlerName: "", // Intentionally blank to test import pre-assignment
        paymentReceipt: "REC-99101",
        notes: "Inbound quote inquiry",
        createdAt: new Date().toISOString(),
      },
      {
        id: "sample-2",
        fullName: "Elena Rostova",
        phoneNumber: "+1 (555) 876-5432",
        email: "elena.r@example.com",
        city: "Austin",
        month: "October 2026",
        status: "Requires Follow-up",
        handlerName: handlers[0]?.name || "Sarah Jenkins", // Existing handler
        paymentReceipt: "REC-99102",
        notes: "Scheduled product demo",
        createdAt: new Date().toISOString(),
      },
    ]);
  };

  const processFile = async (file: File) => {
    setIsProcessing(true);
    setStatusMessage(null);

    try {
      const fileName = (file?.name || "").toLowerCase();
      const isXml = fileName.endsWith(".xml");
      const isExcel =
        fileName.endsWith(".xlsx") ||
        fileName.endsWith(".xls") ||
        fileName.endsWith(".xlsm") ||
        fileName.endsWith(".xlsb");
      const fileId = `file-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
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
      }

      let extractedLeads: Lead[] = [];

      if (isXmlByContent) {
        const xmlText = cachedText || (await file.text());
        extractedLeads = parseXmlSpreadsheet(xmlText, {
          uploadDate: targetUploadDate,
          uploadedFileName: file.name,
          fileId,
        });
      } else if (isExcel) {
        try {
          extractedLeads = await parseExcelFile(file, {
            uploadDate: targetUploadDate,
            uploadedFileName: file.name,
            fileId,
          });
        } catch (excelErr) {
          const txt = cachedText || (await file.text());
          extractedLeads = parseCsvLeads(txt, {
            uploadDate: targetUploadDate,
            uploadedFileName: file.name,
            fileId,
          });
        }
      } else {
        const text = cachedText || (await file.text());
        extractedLeads = parseCsvLeads(text, {
          uploadDate: targetUploadDate,
          uploadedFileName: file.name,
          fileId,
        });

        if (extractedLeads.length === 0) {
          const data = await apiClient.extractLeads(text, file.name);
          if (data && Array.isArray(data.leads)) {
            extractedLeads = data.leads.map((l: any, idx: number) => ({
              ...l,
              id: l.id || `lead-${Date.now()}-${idx}`,
              uploadDate: targetUploadDate,
              uploadedFileName: file.name,
              fileId,
            }));
          }
        }
      }

      if (extractedLeads.length === 0) {
        throw new Error(
          `Could not extract client records from "${file.name}". Please ensure headers include Name and Phone.`
        );
      }

      // STRICT HANDLER LOGIC RULE:
      // If a handler is selected, display only that person's name.
      // If no selection is made, mark as 'Unassigned'.
      // Only assign records where handler is missing or unassigned.
      const isImportHandlerSelected = Boolean(
        selectedImportHandler && selectedImportHandler.trim() !== ""
      );
      const matchedImportHandler = isImportHandlerSelected
        ? handlers?.find(
            (h) =>
              h?.name &&
              h.name.toLowerCase() === selectedImportHandler.trim().toLowerCase()
          )
        : undefined;

      const enrichedLeads = extractedLeads.map((lead) => {
        const hasExistingHandler = Boolean(
          lead.handlerName &&
            lead.handlerName.trim() !== "" &&
            lead.handlerName.toLowerCase() !== "unassigned" &&
            lead.handlerName.toLowerCase() !== "none" &&
            lead.handlerName.toLowerCase() !== "not assigned"
        );

        if (!hasExistingHandler && isImportHandlerSelected) {
          return {
            ...lead,
            handlerName: selectedImportHandler.trim(),
            handlerId: matchedImportHandler?.id,
            assignmentCategory: "assigned" as const,
            assignedAt: new Date().toISOString(),
            reportDate: targetUploadDate,
            uploadDate: targetUploadDate,
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
            reportDate: lead.reportDate || targetUploadDate,
            uploadDate: targetUploadDate,
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
          uploadDate: targetUploadDate,
          uploadedFileName: file.name,
          fileId,
        };
      });

      const fileInfo: UploadFileInfo = {
        id: fileId,
        fileName: file.name,
        uploadDate: targetUploadDate,
        fileSize,
        fileType: isXmlByContent
          ? "xml"
          : isExcel
          ? "xlsx"
          : "csv",
      };

      if (onMultipleFilesExtracted) {
        onMultipleFilesExtracted([{ leads: enrichedLeads, fileInfo }], importMode);
      } else {
        onLeadsExtracted(enrichedLeads, importMode, fileInfo);
      }

      const assignedCount = enrichedLeads.filter(
        (l) => l.assignmentCategory === "assigned"
      ).length;
      const unassignedCount = enrichedLeads.length - assignedCount;

      setStatusMessage({
        type: "success",
        text: `Successfully ingested ${enrichedLeads.length} leads (${assignedCount} assigned to ${
          isImportHandlerSelected ? selectedImportHandler : "pre-existing"
        }, ${unassignedCount} unassigned)`,
      });
    } catch (err: any) {
      setStatusMessage({
        type: "error",
        text: err?.message || "Failed to parse file. Please verify format.",
      });
    } finally {
      setIsProcessing(false);
      if (fileInputRef.current) {
        fileInputRef.current.value = "";
      }
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      processFile(file);
    }
  };

  return (
    <div className="space-y-4">
      {/* Configuration Card */}
      <div className="bg-white dark:bg-slate-900 rounded-2xl p-4 shadow-sm border border-slate-200 dark:border-slate-800 space-y-4">
        <div>
          <h3 className="text-base font-bold text-slate-900 dark:text-slate-100 flex items-center gap-2">
            <UploadCloud className="w-5 h-5 text-indigo-600 dark:text-indigo-400" />
            Excel & CSV Spreadsheet Import
          </h3>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
            Pre-assign incoming unallocated leads to a specialist upon ingestion.
          </p>
        </div>

        {/* Handler Selection Dropdown (STRICT RULE) */}
        <div>
          <label
            htmlFor="mobile-select-import-handler"
            className="block text-xs font-bold text-slate-800 dark:text-slate-200 mb-1.5"
          >
            Assign Handler to Missing Records
          </label>
          <div className="relative">
            <select
              id="mobile-select-import-handler"
              value={selectedImportHandler}
              onChange={(e) => setSelectedImportHandler(e.target.value)}
              className="w-full min-h-[48px] px-3.5 py-2.5 text-sm font-semibold bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-600 text-slate-900 dark:text-slate-100 cursor-pointer shadow-xs"
            >
              <option value="">Unassigned</option>
              {handlers.map((h) => (
                <option key={h.id} value={h.name}>
                  {h.name}
                </option>
              ))}
            </select>
          </div>
          <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-1">
            {selectedImportHandler ? (
              <span className="text-indigo-600 dark:text-indigo-400 font-medium">
                Records without a handler will be assigned to: {selectedImportHandler}
              </span>
            ) : (
              <span>Records without a handler will remain marked as 'Unassigned'.</span>
            )}
          </p>
        </div>

        {/* Date Section Selector */}
        <div>
          <label className="block text-xs font-bold text-slate-800 dark:text-slate-200 mb-1.5">
            Target Upload Date
          </label>
          <div className="grid grid-cols-2 gap-2">
            <button
              type="button"
              onClick={() => setTargetUploadDate(todayStr)}
              className={`min-h-[48px] px-3 py-2 text-xs font-bold rounded-xl border flex items-center justify-center gap-1.5 cursor-pointer active:scale-95 transition-all ${
                targetUploadDate === todayStr
                  ? "bg-indigo-600 text-white border-indigo-600 shadow-sm"
                  : "bg-slate-50 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border-slate-200 dark:border-slate-700"
              }`}
            >
              <Calendar className="w-4 h-4" />
              <span>Today ({todayLabel})</span>
            </button>
            <button
              type="button"
              onClick={() => setTargetUploadDate(tomorrowStr)}
              className={`min-h-[48px] px-3 py-2 text-xs font-bold rounded-xl border flex items-center justify-center gap-1.5 cursor-pointer active:scale-95 transition-all ${
                targetUploadDate === tomorrowStr
                  ? "bg-indigo-600 text-white border-indigo-600 shadow-sm"
                  : "bg-slate-50 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border-slate-200 dark:border-slate-700"
              }`}
            >
              <Calendar className="w-4 h-4" />
              <span>Tomorrow ({tomorrowLabel})</span>
            </button>
          </div>
        </div>

        {/* Mode Selector */}
        <div className="flex items-center justify-between pt-1 text-xs">
          <span className="font-semibold text-slate-700 dark:text-slate-300">
            Import Mode:
          </span>
          <div className="inline-flex rounded-xl bg-slate-100 dark:bg-slate-800 p-1 border border-slate-200 dark:border-slate-700">
            <button
              type="button"
              onClick={() => setImportMode("append")}
              className={`px-3 py-1.5 rounded-lg font-semibold transition-all cursor-pointer ${
                importMode === "append"
                  ? "bg-white dark:bg-slate-700 text-indigo-700 dark:text-indigo-200 shadow-xs"
                  : "text-slate-500 dark:text-slate-400"
              }`}
            >
              Append Leads
            </button>
            <button
              type="button"
              onClick={() => setImportMode("replace")}
              className={`px-3 py-1.5 rounded-lg font-semibold transition-all cursor-pointer ${
                importMode === "replace"
                  ? "bg-white dark:bg-slate-700 text-rose-700 dark:text-rose-200 shadow-xs"
                  : "text-slate-500 dark:text-slate-400"
              }`}
            >
              Replace
            </button>
          </div>
        </div>
      </div>

      {/* Tap-Friendly Upload Dropzone */}
      <div
        onClick={() => fileInputRef.current?.click()}
        className="bg-white dark:bg-slate-900 rounded-3xl p-6 border-2 border-dashed border-indigo-300 dark:border-indigo-800 hover:border-indigo-500 dark:hover:border-indigo-600 text-center cursor-pointer transition-all active:scale-[0.99] shadow-sm flex flex-col items-center justify-center min-h-[220px]"
      >
        <input
          ref={fileInputRef}
          type="file"
          accept=".xlsx,.xls,.csv,.xml,.tsv,.txt"
          onChange={handleFileChange}
          className="hidden"
        />

        <div className="w-16 h-16 rounded-2xl bg-indigo-50 dark:bg-indigo-950/60 text-indigo-600 dark:text-indigo-400 flex items-center justify-center mb-3">
          {isProcessing ? (
            <Loader2 className="w-8 h-8 animate-spin" />
          ) : (
            <FileSpreadsheet className="w-8 h-8" />
          )}
        </div>

        <h4 className="text-base font-bold text-slate-900 dark:text-slate-100">
          {isProcessing ? "Processing Spreadsheet..." : "Tap to Select Excel / CSV File"}
        </h4>
        <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 max-w-[260px]">
          Supports .xlsx, .xls, .xml, and .csv with automatic column recognition.
        </p>

        <button
          type="button"
          className="mt-4 min-h-[48px] px-6 rounded-xl bg-indigo-600 hover:bg-indigo-700 active:scale-95 text-white font-bold text-sm shadow-md shadow-indigo-600/20 inline-flex items-center gap-2 pointer-events-none"
        >
          <UploadCloud className="w-5 h-5" />
          <span>Browse Files</span>
        </button>
      </div>

      {/* Status Alert */}
      {statusMessage && (
        <div
          className={`p-4 rounded-2xl border text-xs font-medium flex items-start gap-2.5 animate-in fade-in duration-150 ${
            statusMessage.type === "success"
              ? "bg-emerald-50 dark:bg-emerald-950/50 text-emerald-800 dark:text-emerald-200 border-emerald-200 dark:border-emerald-800"
              : statusMessage.type === "error"
              ? "bg-rose-50 dark:bg-rose-950/50 text-rose-800 dark:text-rose-200 border-rose-200 dark:border-rose-800"
              : "bg-blue-50 dark:bg-blue-950/50 text-blue-800 dark:text-blue-200 border-blue-200 dark:border-blue-800"
          }`}
        >
          {statusMessage.type === "success" ? (
            <Check className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
          ) : (
            <AlertCircle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
          )}
          <div className="flex-1">
            <p>{statusMessage.text}</p>
            {statusMessage.type === "success" && (
              <button
                type="button"
                onClick={onSwitchToLeadsTab}
                className="mt-2 min-h-[40px] px-3.5 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white font-bold inline-flex items-center gap-1.5 cursor-pointer shadow-xs"
              >
                <span>View Ingested Leads</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </button>
            )}
          </div>
        </div>
      )}

      {/* Quick Template Download */}
      <div className="bg-slate-50 dark:bg-slate-800/60 rounded-2xl p-4 border border-slate-200 dark:border-slate-700 flex items-center justify-between">
        <div>
          <h5 className="text-xs font-bold text-slate-800 dark:text-slate-200">
            Need a template?
          </h5>
          <p className="text-[11px] text-slate-500 dark:text-slate-400">
            Download standard Excel format with sample data
          </p>
        </div>
        <button
          type="button"
          onClick={handleDownloadSample}
          className="min-h-[44px] px-3 rounded-xl bg-white dark:bg-slate-700 border border-slate-200 dark:border-slate-600 text-slate-700 dark:text-slate-200 font-semibold text-xs flex items-center gap-1.5 active:scale-95 transition-all shadow-2xs cursor-pointer"
        >
          <Download className="w-4 h-4 text-slate-500" />
          <span>Template</span>
        </button>
      </div>
    </div>
  );
};
