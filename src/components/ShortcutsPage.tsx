import React, { useState, useEffect, useRef } from "react";
import {
  Keyboard,
  RotateCcw,
  Search,
  Check,
  AlertTriangle,
  Sparkles,
  LayoutDashboard,
  Settings,
  UploadCloud,
  Filter,
  Users,
  Plus,
  CheckSquare,
  XSquare,
  Trash2,
  Undo2,
  Calendar,
  CalendarDays,
  Layers,
  Upload,
  FileSpreadsheet,
  FileDown,
  FileText,
  X,
  Play,
  Edit3,
  HelpCircle,
  Zap,
  Loader2,
  CheckCircle2,
  ArrowRight,
} from "lucide-react";
import { ShortcutActionId, ShortcutCategory, ShortcutDefinition } from "../types/shortcuts";
import {
  SHORTCUT_DEFINITIONS,
  formatKeyDisplay,
  eventToKeyCombo,
  findShortcutConflict,
} from "../utils/shortcutManager";
import { Lead } from "../types";
import { UploadFileInfo } from "./UploadSection";
import { getLocalDateString, formatUploadDayLabel } from "../utils/dateUtils";
import {
  parseExcelFile,
  parseXmlSpreadsheet,
  isXmlSpreadsheet,
  parseCsvLeads,
} from "../utils/parser";

interface ShortcutsPageProps {
  shortcuts: Record<ShortcutActionId, string>;
  onUpdateShortcut: (actionId: ShortcutActionId, newKey: string) => void;
  onResetAllShortcuts: () => void;
  onResetSingleShortcut: (actionId: ShortcutActionId) => void;
  onExecuteAction: (actionId: ShortcutActionId) => void;
  onLeadsExtracted?: (
    newLeads: Lead[],
    mode: "append" | "replace",
    fileInfo?: UploadFileInfo
  ) => void;
  onNavigateToTracker?: (targetDate?: string) => void;
}

// Icon helper map
const ICON_MAP: Record<string, React.ElementType> = {
  LayoutDashboard,
  Keyboard,
  Settings,
  UploadCloud,
  Search,
  RotateCcw,
  Filter,
  Users,
  Plus,
  CheckSquare,
  XSquare,
  Trash2,
  Undo2,
  Calendar,
  CalendarDays,
  Layers,
  Upload,
  FileSpreadsheet,
  FileDown,
  FileText,
  X,
};

export const ShortcutsPage: React.FC<ShortcutsPageProps> = ({
  shortcuts,
  onUpdateShortcut,
  onResetAllShortcuts,
  onResetSingleShortcut,
  onExecuteAction,
  onLeadsExtracted,
  onNavigateToTracker,
}) => {
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedCategory, setSelectedCategory] = useState<string>("all");
  const [editingActionId, setEditingActionId] = useState<ShortcutActionId | null>(null);
  const [recordedCombo, setRecordedCombo] = useState<string>("");
  const [conflictWarning, setConflictWarning] = useState<ShortcutDefinition | null>(null);

  // Testing arena state
  const [testPressedCombo, setTestPressedCombo] = useState<string>("");
  const [testMatchedAction, setTestMatchedAction] = useState<ShortcutDefinition | null>(null);
  const [isTestActive, setIsTestActive] = useState(false);
  const testInputRef = useRef<HTMLInputElement>(null);

  // Drop Excel/XML File for Today state & ref
  const [isDropzoneDragging, setIsDropzoneDragging] = useState(false);
  const [isAnalyzingFile, setIsAnalyzingFile] = useState(false);
  const [dropzoneStatus, setDropzoneStatus] = useState<{
    type: "success" | "error" | "info";
    message: string;
    count?: number;
    fileName?: string;
  } | null>(null);
  const dropFileInputRef = useRef<HTMLInputElement>(null);

  const todayStr = getLocalDateString(0);
  const todayLabel = formatUploadDayLabel(todayStr);

  const handleProcessFileForToday = async (file: File) => {
    setIsAnalyzingFile(true);
    setDropzoneStatus({
      type: "info",
      message: `Analyzing spreadsheet "${file.name}" for Today's section (${todayLabel.subLabel})...`,
    });

    try {
      const fileName = (file?.name || "").toLowerCase();
      const isXml = fileName.endsWith(".xml");
      const isExcel = fileName.endsWith(".xlsx") || fileName.endsWith(".xls");
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
      const meta = { uploadDate: todayStr, uploadedFileName: file.name, fileId };

      if (isXmlByContent) {
        const xmlText = cachedText || (await file.text());
        extractedLeads = parseXmlSpreadsheet(xmlText, meta);
      } else if (isExcel) {
        extractedLeads = await parseExcelFile(file, meta);
      } else if (fileName.endsWith(".csv")) {
        const text = cachedText || (await file.text());
        extractedLeads = parseCsvLeads(text, meta);
      } else {
        const text = cachedText || (await file.text());
        extractedLeads = parseCsvLeads(text, meta);
      }

      if (!extractedLeads || extractedLeads.length === 0) {
        setDropzoneStatus({
          type: "error",
          message: `No leads could be parsed from "${file.name}". Please ensure standard column headers (Name, Phone, Month, etc.).`,
        });
        setIsAnalyzingFile(false);
        return;
      }

      // Ensure every lead has fileId, uploadedFileName, and uploadDate = todayStr
      const enrichedLeads: Lead[] = extractedLeads.map((l) => ({
        ...l,
        uploadDate: todayStr,
        uploadedFileName: file.name,
        fileId,
      }));

      const fileInfo: UploadFileInfo = {
        id: fileId,
        fileName: file.name,
        uploadDate: todayStr,
        fileSize,
        fileType,
      };

      if (onLeadsExtracted) {
        onLeadsExtracted(enrichedLeads, "append", fileInfo);
      }

      setDropzoneStatus({
        type: "success",
        message: `Successfully analyzed and imported ${enrichedLeads.length} leads directly into "Today" section!`,
        count: enrichedLeads.length,
        fileName: file.name,
      });
    } catch (err: any) {
      setDropzoneStatus({
        type: "error",
        message: err?.message || "Failed to parse file. Please try again.",
      });
    } finally {
      setIsAnalyzingFile(false);
    }
  };

  const handleDropzoneDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDropzoneDragging(false);
    const files = e.dataTransfer.files;
    if (files && files.length > 0) {
      handleProcessFileForToday(files[0]);
    }
  };

  const handleDropzoneFileInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (files && files.length > 0) {
      handleProcessFileForToday(files[0]);
    }
  };

  // Count customized shortcuts
  const customCount = SHORTCUT_DEFINITIONS.filter(
    (def) => shortcuts[def.id] !== def.defaultKey
  ).length;

  // Categories list
  const categories: ShortcutCategory[] = [
    "Navigation & Views",
    "Search & Filtering",
    "Leads & Edit Operations",
    "Day Sections & Ingestion",
    "PDF & Export Reports",
    "Dialog & Window",
  ];

  // Filtered definitions
  const filteredDefinitions = SHORTCUT_DEFINITIONS.filter((def) => {
    if (selectedCategory !== "all" && def.category !== selectedCategory) {
      return false;
    }
    if (searchQuery.trim()) {
      const q = (searchQuery || "").toLowerCase();
      const matchName = def.name?.toLowerCase().includes(q);
      const matchDesc = def.description?.toLowerCase().includes(q);
      const matchTarget = def.targetUiButton?.toLowerCase().includes(q);
      const matchKey = (shortcuts[def.id] || def.defaultKey || "").toLowerCase().includes(q);
      return Boolean(matchName || matchDesc || matchTarget || matchKey);
    }
    return true;
  });

  // Handle key recording when editing a shortcut
  useEffect(() => {
    if (!editingActionId) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      e.preventDefault();
      e.stopPropagation();

      // Don't record standalone modifier presses
      if (["Control", "Alt", "Shift", "Meta"].includes(e.key)) {
        return;
      }

      // If escape is pressed alone without modifiers, cancel editing
      if (e.key === "Escape" && !e.ctrlKey && !e.altKey && !e.shiftKey) {
        setEditingActionId(null);
        setRecordedCombo("");
        setConflictWarning(null);
        return;
      }

      const combo = eventToKeyCombo(e);
      setRecordedCombo(combo);

      // Check conflict
      const conflict = findShortcutConflict(editingActionId, combo, shortcuts);
      setConflictWarning(conflict);
    };

    window.addEventListener("keydown", handleKeyDown, { capture: true });
    return () => {
      window.removeEventListener("keydown", handleKeyDown, { capture: true });
    };
  }, [editingActionId, shortcuts]);

  const handleSaveEdit = (actionId: ShortcutActionId) => {
    if (recordedCombo) {
      onUpdateShortcut(actionId, recordedCombo);
    }
    setEditingActionId(null);
    setRecordedCombo("");
    setConflictWarning(null);
  };

  const handleCancelEdit = () => {
    setEditingActionId(null);
    setRecordedCombo("");
    setConflictWarning(null);
  };

  // Handle Testing Arena keydown
  const handleTestKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    e.preventDefault();
    e.stopPropagation();

    if (["Control", "Alt", "Shift", "Meta"].includes(e.key)) return;

    const combo = eventToKeyCombo(e.nativeEvent);
    setTestPressedCombo(combo);

    // Find which action matches this combo
    const matched = SHORTCUT_DEFINITIONS.find(
      (def) =>
        (shortcuts[def.id] || def.defaultKey || "").toLowerCase() ===
        (combo || "").toLowerCase()
    );
    setTestMatchedAction(matched || null);
  };

  return (
    <div className="space-y-6">
      {/* Top Banner / Hero */}
      <div className="bg-white border border-slate-200/90 rounded-2xl p-6 shadow-xs">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="flex items-start gap-4">
            <div className="p-3 bg-indigo-50 border border-indigo-100 rounded-2xl text-indigo-600 shrink-0 shadow-2xs">
              <Keyboard className="w-6 h-6" />
            </div>
            <div>
              <div className="flex items-center gap-2.5 flex-wrap">
                <h1 className="text-xl font-bold text-slate-900 tracking-tight">
                  Global Custom Keyboard Shortcuts
                </h1>
                <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-indigo-50 text-indigo-700 border border-indigo-200/80">
                  {SHORTCUT_DEFINITIONS.length} Actions Available
                </span>
                {customCount > 0 && (
                  <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-amber-50 text-amber-700 border border-amber-200">
                    {customCount} Customized
                  </span>
                )}
              </div>
              <p className="text-xs sm:text-sm text-slate-500 mt-1 max-w-2xl leading-relaxed">
                Control the entire application instantly with your keyboard. Every button, filter, view switch, and edit operation is listed below and can be customized to any key combination.
              </p>
            </div>
          </div>

          {/* Quick Action Buttons */}
          <div className="flex items-center gap-2 self-start md:self-auto shrink-0">
            {customCount > 0 && (
              <button
                type="button"
                onClick={onResetAllShortcuts}
                className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-semibold text-rose-700 bg-rose-50 hover:bg-rose-100 border border-rose-200 rounded-xl transition-colors cursor-pointer"
                title="Restore all shortcuts back to original defaults"
              >
                <RotateCcw className="w-3.5 h-3.5" />
                Reset All to Defaults
              </button>
            )}
            <button
              type="button"
              onClick={() => {
                setIsTestActive(true);
                setTimeout(() => testInputRef.current?.focus(), 50);
              }}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold text-white bg-indigo-600 hover:bg-indigo-700 rounded-xl shadow-xs transition-colors cursor-pointer"
            >
              <Zap className="w-3.5 h-3.5" />
              Test Key Press
            </button>
          </div>
        </div>

        {/* Live Testing Arena Box */}
        {isTestActive && (
          <div className="mt-5 p-4 bg-indigo-50/60 border border-indigo-200/90 rounded-xl animate-in fade-in duration-150">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-bold text-indigo-900 flex items-center gap-1.5">
                <Zap className="w-3.5 h-3.5 text-indigo-600" />
                Live Shortcut Testing Arena
              </span>
              <button
                type="button"
                onClick={() => {
                  setIsTestActive(false);
                  setTestPressedCombo("");
                  setTestMatchedAction(null);
                }}
                className="text-xs text-indigo-600 hover:text-indigo-900 cursor-pointer font-medium"
              >
                Close Tester ✕
              </button>
            </div>

            <div className="flex flex-col sm:flex-row items-center gap-3">
              <input
                ref={testInputRef}
                type="text"
                placeholder="Click here and press any key combination on your keyboard..."
                onKeyDown={handleTestKeyDown}
                readOnly
                className="w-full sm:w-96 px-3.5 py-2 text-xs bg-white border border-indigo-300 focus:border-indigo-500 rounded-lg shadow-2xs font-mono outline-hidden cursor-pointer"
              />

              {testPressedCombo && (
                <div className="flex items-center gap-2">
                  <span className="text-xs text-slate-500">Detected:</span>
                  <div className="flex items-center gap-1">
                    {formatKeyDisplay(testPressedCombo).map((k, i) => (
                      <kbd
                        key={i}
                        className="px-2 py-0.5 text-xs font-mono font-bold bg-white text-indigo-900 border border-indigo-200 rounded shadow-2xs"
                      >
                        {k}
                      </kbd>
                    ))}
                  </div>

                  {testMatchedAction ? (
                    <div className="inline-flex items-center gap-1 text-xs text-emerald-700 bg-emerald-50 border border-emerald-200 px-2.5 py-1 rounded-md font-semibold">
                      <Check className="w-3.5 h-3.5" />
                      Triggers: <strong>{testMatchedAction.name}</strong>
                    </div>
                  ) : (
                    <span className="text-xs text-slate-400 italic">
                      (No action assigned to this key)
                    </span>
                  )}
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Additional Option: Drop your Excel / XML file here (will be added to "Today" section) for custom shortcut */}
      <div
        id="shortcuts-option-dropzone-card"
        className="bg-gradient-to-br from-emerald-50/70 via-white to-indigo-50/50 border border-emerald-200/90 rounded-2xl p-6 shadow-xs relative overflow-hidden"
      >
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 pb-4 border-b border-emerald-100">
          <div className="flex items-start gap-3.5">
            <div className="p-3 bg-emerald-100 text-emerald-700 rounded-2xl shadow-2xs shrink-0 mt-0.5 border border-emerald-200">
              <FileSpreadsheet className="w-6 h-6" />
            </div>
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <span className="text-[11px] font-bold uppercase tracking-wider text-emerald-700 bg-emerald-100/80 px-2 py-0.5 rounded-md border border-emerald-200">
                  Custom Shortcut Feature
                </span>
                <h2 className="text-base font-bold text-slate-900">
                  Drop your Excel / XML file here (will be added to "Today" section)
                </h2>
              </div>
              <p className="text-xs text-slate-600 mt-1">
                Drag-and-drop or select any Excel/XML spreadsheet here to instantly parse and add all lead records directly into <strong>Today's workspace ({todayLabel.subLabel})</strong>. Trigger anytime with your custom shortcut key!
              </p>
            </div>
          </div>

          {/* Shortcut Key Controller */}
          <div className="flex items-center gap-2 self-start lg:self-center shrink-0 bg-white/90 p-2 rounded-xl border border-emerald-200/90 shadow-2xs">
            <div className="text-xs text-slate-500 pr-1 hidden sm:inline">
              Assigned Key:
            </div>
            <div className="flex items-center gap-1">
              {formatKeyDisplay(shortcuts.drop_file_today || "alt+u").map((keyToken, idx) => (
                <kbd
                  key={idx}
                  className="px-2.5 py-1 text-xs font-mono font-bold bg-emerald-50 text-emerald-900 border border-emerald-300 rounded-lg shadow-2xs"
                >
                  {keyToken}
                </kbd>
              ))}
            </div>

            <button
              type="button"
              id="btn-customize-drop-shortcut"
              onClick={() => {
                setEditingActionId("drop_file_today");
                setRecordedCombo("");
                setConflictWarning(null);
                const row = document.getElementById("shortcut-row-drop_file_today");
                if (row) {
                  row.scrollIntoView({ behavior: "smooth", block: "center" });
                }
              }}
              className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-semibold text-indigo-700 bg-indigo-50 hover:bg-indigo-100 border border-indigo-200 rounded-lg transition-colors cursor-pointer"
              title="Change shortcut key for dropping Excel/XML into Today"
            >
              <Edit3 className="w-3.5 h-3.5" />
              Customize Shortcut
            </button>

            <button
              type="button"
              onClick={() => dropFileInputRef.current?.click()}
              className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-semibold text-emerald-700 bg-emerald-50 hover:bg-emerald-100 border border-emerald-200 rounded-lg transition-colors cursor-pointer"
              title="Test file picker trigger"
            >
              <Play className="w-3.5 h-3.5" />
              Test Trigger
            </button>

            {shortcuts.drop_file_today && shortcuts.drop_file_today !== "alt+u" && (
              <button
                type="button"
                onClick={() => onResetSingleShortcut("drop_file_today")}
                className="p-1 text-slate-400 hover:text-rose-600 rounded-lg transition-colors cursor-pointer"
                title="Reset shortcut back to default Alt+U"
              >
                <RotateCcw className="w-3.5 h-3.5" />
              </button>
            )}
          </div>
        </div>

        {/* Dropzone Area */}
        <div
          onDragOver={(e) => {
            e.preventDefault();
            setIsDropzoneDragging(true);
          }}
          onDragLeave={() => setIsDropzoneDragging(false)}
          onDrop={handleDropzoneDrop}
          onClick={() => dropFileInputRef.current?.click()}
          className={`mt-4 border-2 border-dashed rounded-xl p-6 text-center cursor-pointer transition-all duration-200 select-none ${
            isDropzoneDragging
              ? "border-emerald-500 bg-emerald-50/80 scale-[1.005] shadow-xs"
              : "border-emerald-300/80 hover:border-emerald-500 bg-white/70 hover:bg-emerald-50/30"
          }`}
        >
          <input
            ref={dropFileInputRef}
            id="input-shortcuts-tab-drop-file"
            type="file"
            accept=".xlsx,.xls,.xml,.csv,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,application/vnd.ms-excel,text/xml,text/csv"
            onChange={handleDropzoneFileInput}
            className="hidden"
          />

          <div className="flex flex-col items-center justify-center space-y-2">
            <div className="p-3 rounded-full bg-emerald-100 text-emerald-700 shadow-2xs">
              {isAnalyzingFile ? (
                <Loader2 className="w-6 h-6 animate-spin text-emerald-600" />
              ) : (
                <UploadCloud className="w-6 h-6 text-emerald-600" />
              )}
            </div>

            <div>
              <p className="text-sm font-bold text-slate-900">
                Drop your Excel / XML file here (will be added to "Today" section)
              </p>
              <p className="text-xs text-slate-500 mt-0.5">
                or <span className="text-emerald-700 font-semibold underline underline-offset-2">browse computer files</span> (.xlsx, .xls, .xml, .csv)
              </p>
            </div>

            <div className="flex items-center gap-2 pt-1 text-[11px] text-slate-400">
              <span className="inline-flex items-center gap-1 font-medium text-emerald-800 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200">
                <Calendar className="w-3 h-3 text-emerald-600" />
                Target: {todayLabel.subLabel} (Today)
              </span>
              <span>•</span>
              <span className="font-mono text-slate-500">
                Shortcut: {shortcuts.drop_file_today ? formatKeyDisplay(shortcuts.drop_file_today).join("+") : "Alt+U"}
              </span>
            </div>
          </div>
        </div>

        {/* Processing / Success / Error Feedback Banner */}
        {dropzoneStatus && (
          <div
            className={`mt-4 p-3.5 rounded-xl border text-xs flex items-center justify-between gap-3 animate-in fade-in duration-150 ${
              dropzoneStatus.type === "success"
                ? "bg-emerald-50 border-emerald-200 text-emerald-900"
                : dropzoneStatus.type === "error"
                ? "bg-rose-50 border-rose-200 text-rose-900"
                : "bg-indigo-50 border-indigo-200 text-indigo-900"
            }`}
          >
            <div className="flex items-center gap-2 min-w-0">
              {dropzoneStatus.type === "success" ? (
                <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
              ) : dropzoneStatus.type === "error" ? (
                <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0" />
              ) : (
                <Loader2 className="w-4 h-4 text-indigo-600 animate-spin shrink-0" />
              )}
              <span className="font-medium truncate">{dropzoneStatus.message}</span>
            </div>

            <div className="flex items-center gap-2 shrink-0">
              {dropzoneStatus.type === "success" && onNavigateToTracker && (
                <button
                  type="button"
                  onClick={() => onNavigateToTracker(todayStr)}
                  className="inline-flex items-center gap-1 px-3 py-1 bg-emerald-600 hover:bg-emerald-700 text-white font-semibold rounded-lg shadow-2xs transition-colors cursor-pointer text-xs"
                >
                  <span>Open in Today's Tracker</span>
                  <ArrowRight className="w-3.5 h-3.5" />
                </button>
              )}
              <button
                type="button"
                onClick={() => setDropzoneStatus(null)}
                className="text-slate-400 hover:text-slate-700 cursor-pointer"
                title="Dismiss status"
              >
                ✕
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Filter and Search Bar */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
        {/* Search */}
        <div className="relative flex-1 max-w-md">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            placeholder="Search actions, buttons, or key combos (e.g. 'export', 'alt', 'lead')..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-9 pr-3 py-2 text-xs bg-white border border-slate-200 rounded-xl focus:outline-hidden focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 shadow-2xs"
          />
          {searchQuery && (
            <button
              type="button"
              onClick={() => setSearchQuery("")}
              className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 cursor-pointer"
            >
              ✕
            </button>
          )}
        </div>

        {/* Category Pills */}
        <div className="flex items-center gap-1.5 overflow-x-auto pb-1 max-w-full text-xs">
          <button
            type="button"
            onClick={() => setSelectedCategory("all")}
            className={`px-3 py-1.5 rounded-lg font-medium whitespace-nowrap cursor-pointer transition-colors ${
              selectedCategory === "all"
                ? "bg-slate-900 text-white shadow-xs"
                : "bg-white text-slate-600 hover:bg-slate-100 border border-slate-200"
            }`}
          >
            All Categories ({SHORTCUT_DEFINITIONS.length})
          </button>
          {categories.map((cat) => {
            const count = SHORTCUT_DEFINITIONS.filter((d) => d.category === cat).length;
            return (
              <button
                key={cat}
                type="button"
                onClick={() => setSelectedCategory(cat)}
                className={`px-3 py-1.5 rounded-lg font-medium whitespace-nowrap cursor-pointer transition-colors ${
                  selectedCategory === cat
                    ? "bg-indigo-600 text-white shadow-xs"
                    : "bg-white text-slate-600 hover:bg-slate-100 border border-slate-200"
                }`}
              >
                {cat} ({count})
              </button>
            );
          })}
        </div>
      </div>

      {/* Main Directory Table of All Buttons & Edit Options */}
      <div className="bg-white border border-slate-200/90 rounded-2xl shadow-xs overflow-hidden">
        <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between">
          <h2 className="text-sm font-bold text-slate-900 flex items-center gap-2">
            <span>Action & Button Directory</span>
            <span className="text-xs font-normal text-slate-500">
              ({filteredDefinitions.length} matching {filteredDefinitions.length === 1 ? "action" : "actions"})
            </span>
          </h2>
          <span className="text-xs text-slate-400 hidden sm:inline">
            Click "Edit Shortcut" on any item to rebind it to your own custom keys
          </span>
        </div>

        <div className="divide-y divide-slate-100">
          {filteredDefinitions.length === 0 ? (
            <div className="p-12 text-center">
              <Search className="w-8 h-8 text-slate-300 mx-auto mb-2" />
              <p className="text-sm font-semibold text-slate-700">No actions found matching your query</p>
              <p className="text-xs text-slate-400 mt-1">Try clearing the search or category filter</p>
              <button
                type="button"
                onClick={() => {
                  setSearchQuery("");
                  setSelectedCategory("all");
                }}
                className="mt-3 px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold rounded-lg cursor-pointer transition-colors"
              >
                Clear Filters
              </button>
            </div>
          ) : (
            filteredDefinitions.map((def) => {
              const IconComponent = ICON_MAP[def.iconName] || Keyboard;
              const currentKey = shortcuts[def.id] || def.defaultKey;
              const isCustomized = currentKey !== def.defaultKey;
              const isEditing = editingActionId === def.id;

              return (
                <div
                  key={def.id}
                  id={`shortcut-row-${def.id}`}
                  className={`p-4 sm:px-6 transition-colors ${
                    isEditing ? "bg-indigo-50/50" : "hover:bg-slate-50/60"
                  }`}
                >
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                    {/* Action Info */}
                    <div className="flex items-start gap-3.5 min-w-0 flex-1">
                      <div className="p-2 rounded-xl bg-slate-100 text-slate-700 shrink-0 mt-0.5">
                        <IconComponent className="w-4 h-4" />
                      </div>

                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2 flex-wrap">
                          <h3 className="text-sm font-bold text-slate-900">{def.name}</h3>
                          <span className="text-[10px] font-semibold px-2 py-0.2 rounded-md bg-slate-100 text-slate-600">
                            {def.category}
                          </span>
                          {isCustomized && (
                            <span className="text-[10px] font-semibold px-2 py-0.2 rounded-md bg-amber-50 text-amber-700 border border-amber-200">
                              Custom
                            </span>
                          )}
                        </div>

                        <p className="text-xs text-slate-500 mt-0.5 leading-normal">
                          {def.description}
                        </p>

                        <div className="flex items-center gap-1.5 text-[11px] text-slate-400 mt-1 font-mono">
                          <span className="font-sans font-medium text-slate-600">Location:</span>
                          <span className="truncate">{def.targetUiButton}</span>
                        </div>
                      </div>
                    </div>

                    {/* Key Combination & Edit Controls */}
                    <div className="flex items-center gap-3 shrink-0 self-end sm:self-center">
                      {isEditing ? (
                        /* Active Key Recorder Mode */
                        <div className="flex items-center gap-2 p-2 bg-white border-2 border-indigo-500 rounded-xl shadow-xs">
                          <div className="flex items-center gap-1">
                            {recordedCombo ? (
                              formatKeyDisplay(recordedCombo).map((token, idx) => (
                                <kbd
                                  key={idx}
                                  className="px-2 py-1 text-xs font-mono font-bold bg-indigo-50 text-indigo-700 border border-indigo-200 rounded-md"
                                >
                                  {token}
                                </kbd>
                              ))
                            ) : (
                              <span className="text-xs font-medium text-indigo-600 animate-pulse px-2">
                                Press your new keys now...
                              </span>
                            )}
                          </div>

                          <div className="flex items-center gap-1 border-l border-slate-200 pl-2">
                            <button
                              type="button"
                              onClick={() => handleSaveEdit(def.id)}
                              disabled={!recordedCombo}
                              className="px-2.5 py-1 text-xs font-semibold bg-emerald-600 hover:bg-emerald-700 disabled:opacity-40 text-white rounded-md cursor-pointer transition-colors"
                            >
                              Save
                            </button>
                            <button
                              type="button"
                              onClick={handleCancelEdit}
                              className="px-2 py-1 text-xs font-medium bg-slate-100 hover:bg-slate-200 text-slate-600 rounded-md cursor-pointer transition-colors"
                            >
                              Cancel
                            </button>
                          </div>
                        </div>
                      ) : (
                        /* Standard View Mode */
                        <div className="flex items-center gap-2">
                          {/* Key Badges */}
                          <div className="flex items-center gap-1">
                            {formatKeyDisplay(currentKey).map((token, idx) => (
                              <kbd
                                key={idx}
                                className={`px-2.5 py-1 text-xs font-mono font-bold rounded-lg border shadow-2xs tracking-wide ${
                                  isCustomized
                                    ? "bg-amber-50 text-amber-900 border-amber-300"
                                    : "bg-slate-100 text-slate-800 border-slate-300/80"
                                }`}
                              >
                                {token}
                              </kbd>
                            ))}
                          </div>

                          {/* Edit Button */}
                          <button
                            type="button"
                            id={`btn-edit-shortcut-${def.id}`}
                            onClick={() => {
                              setEditingActionId(def.id);
                              setRecordedCombo("");
                              setConflictWarning(null);
                            }}
                            className="p-1.5 text-slate-500 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg cursor-pointer transition-colors"
                            title="Edit this shortcut key combination"
                          >
                            <Edit3 className="w-3.5 h-3.5" />
                          </button>

                          {/* Test Trigger Button */}
                          <button
                            type="button"
                            onClick={() => onExecuteAction(def.id)}
                            className="p-1.5 text-slate-400 hover:text-emerald-600 hover:bg-emerald-50 rounded-lg cursor-pointer transition-colors"
                            title="Test action now (triggers this button)"
                          >
                            <Play className="w-3.5 h-3.5" />
                          </button>

                          {/* Revert Single Shortcut */}
                          {isCustomized && (
                            <button
                              type="button"
                              onClick={() => onResetSingleShortcut(def.id)}
                              className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg cursor-pointer transition-colors"
                              title={`Reset to default: ${def.defaultKey}`}
                            >
                              <RotateCcw className="w-3.5 h-3.5" />
                            </button>
                          )}
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Conflict alert inline if any */}
                  {isEditing && conflictWarning && (
                    <div className="mt-2 text-xs text-amber-800 bg-amber-50 border border-amber-200 rounded-lg p-2 flex items-center gap-1.5">
                      <AlertTriangle className="w-3.5 h-3.5 text-amber-600 shrink-0" />
                      <span>
                        Notice: Key combo <strong>{recordedCombo}</strong> is currently assigned to <strong>"{conflictWarning.name}"</strong>. Saving will override it.
                      </span>
                    </div>
                  )}
                </div>
              );
            })
          )}
        </div>
      </div>

      {/* Useful Keyboard Tips Card */}
      <div className="p-4 rounded-xl bg-slate-100/70 border border-slate-200/80 text-xs text-slate-600 flex items-start gap-3">
        <HelpCircle className="w-4 h-4 text-indigo-600 shrink-0 mt-0.5" />
        <div className="space-y-1">
          <span className="font-bold text-slate-800 block">Keyboard Pro Tips:</span>
          <p>
            • Shortcuts with modifiers (<kbd className="px-1 py-0.5 bg-white border border-slate-300 rounded font-mono text-[10px]">Alt</kbd>, <kbd className="px-1 py-0.5 bg-white border border-slate-300 rounded font-mono text-[10px]">Ctrl</kbd>) work everywhere, even while typing.
          </p>
          <p>
            • Single-letter keys (like <kbd className="px-1 py-0.5 bg-white border border-slate-300 rounded font-mono text-[10px]">N</kbd> for New Lead, <kbd className="px-1 py-0.5 bg-white border border-slate-300 rounded font-mono text-[10px]">/</kbd> for Search) are automatically paused when typing inside text boxes to avoid disrupting notes.
          </p>
          <p>
            • Pressing <kbd className="px-1 py-0.5 bg-white border border-slate-300 rounded font-mono text-[10px]">Escape</kbd> anytime closes modals and clears active input focus.
          </p>
        </div>
      </div>
    </div>
  );
};
