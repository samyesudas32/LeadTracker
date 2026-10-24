import React, { useRef, useState, useEffect } from "react";
import {
  CalendarDays,
  Calendar,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Clock,
  Download,
  Eye,
  FileSpreadsheet,
  FileText,
  FileCode,
  Filter,
  Plus,
  Sparkles,
  Trash2,
  X,
  Layers,
  ChevronDown,
  ChevronUp,
} from "lucide-react";
import { UploadedFileRecord, Lead } from "../types";
import { formatUploadDayLabel, formatTimeFromIso, getLocalDateString } from "../utils/dateUtils";

export interface DateTabNavigationProps {
  files: UploadedFileRecord[];
  leads: Lead[];
  activeDateFilter: string; // "all" or specific YYYY-MM-DD
  activeFileFilter: string; // "all" or specific fileId
  activeWorkspaceTab?: string; // "all", "unassigned", "assigned", or "file-xxx"
  onSelectDateFilter: (dateStr: string) => void;
  onSelectFileFilter: (fileId: string) => void;
  onDeleteFile: (file: UploadedFileRecord) => void;
  onExportFileLeads?: (file: UploadedFileRecord) => void;
  onQuickUploadForDate?: (dateStr: string) => void;
  onQuickUploadForTomorrow?: () => void;
  onOpenPdfReport?: (dateStr?: string, fileId?: string) => void;
}

export const DateTabNavigation: React.FC<DateTabNavigationProps> = ({
  files,
  leads,
  activeDateFilter,
  activeFileFilter,
  activeWorkspaceTab,
  onSelectDateFilter,
  onSelectFileFilter,
  onDeleteFile,
  onExportFileLeads,
  onQuickUploadForDate,
  onQuickUploadForTomorrow,
  onOpenPdfReport,
}) => {
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const [canScrollLeft, setCanScrollLeft] = useState(false);
  const [canScrollRight, setCanScrollRight] = useState(false);
  const [isFilesDrawerOpen, setIsFilesDrawerOpen] = useState(true);

  const todayStr = getLocalDateString(0);
  const tomorrowStr = getLocalDateString(1);

  // Check if viewing a specific categorized spreadsheet
  const effectiveFileId =
    activeFileFilter !== "all"
      ? activeFileFilter
      : activeWorkspaceTab?.startsWith("file-")
      ? activeWorkspaceTab.replace("file-", "").split(":")[0]
      : "all";

  const isFileScoped = effectiveFileId !== "all";
  const activeScopedFile = isFileScoped
    ? files.find(
        (f) =>
          f.id === effectiveFileId ||
          `file-${f.id}` === activeWorkspaceTab ||
          `file-${f.id}` === activeWorkspaceTab?.split(":")[0]
      )
    : null;

  // Leads scoped to active sheet if filtered, otherwise all leads across the entire pipeline
  const scopedLeads = isFileScoped && activeScopedFile
    ? leads.filter(
        (l) =>
          l.fileId === activeScopedFile.id ||
          l.uploadedFileName === activeScopedFile.fileName
      )
    : leads;

  // Group files by uploadDate (YYYY-MM-DD)
  const groupedFiles: Record<string, UploadedFileRecord[]> = {};
  const filesToGroup = isFileScoped && activeScopedFile ? [activeScopedFile] : files;
  filesToGroup.forEach((f) => {
    const d = f.uploadDate || todayStr;
    if (!groupedFiles[d]) {
      groupedFiles[d] = [];
    }
    groupedFiles[d].push(f);
  });

  // Calculate leads per date
  const leadsPerDate: Record<string, number> = {};
  scopedLeads.forEach((l) => {
    const d = l.uploadDate || l.createdAt?.slice(0, 10) || todayStr;
    leadsPerDate[d] = (leadsPerDate[d] || 0) + 1;
  });

  // Collect all unique dates from files and leads, always ensuring Today and Tomorrow
  const allDateKeys = Array.from(
    new Set([
      todayStr,
      tomorrowStr,
      ...Object.keys(groupedFiles),
      ...Object.keys(leadsPerDate),
    ])
  ).sort((a, b) => {
    // Today first, Tomorrow second, then descending dates
    if (a === todayStr && b === tomorrowStr) return -1;
    if (a === tomorrowStr && b === todayStr) return 1;
    if (a === todayStr) return -1;
    if (b === todayStr) return 1;
    if (a === tomorrowStr) return -1;
    if (b === tomorrowStr) return 1;
    return b.localeCompare(a);
  });

  // Check scroll positions
  const checkScroll = () => {
    const el = scrollContainerRef.current;
    if (!el) return;
    setCanScrollLeft(el.scrollLeft > 6);
    setCanScrollRight(el.scrollLeft + el.clientWidth < el.scrollWidth - 6);
  };

  useEffect(() => {
    checkScroll();
    window.addEventListener("resize", checkScroll);
    return () => window.removeEventListener("resize", checkScroll);
  }, [allDateKeys.length]);

  const scrollAnimRef = useRef<number | null>(null);

  const quickSmoothScrollTo = (targetX: number, duration = 160) => {
    const el = scrollContainerRef.current;
    if (!el) return;

    if (scrollAnimRef.current !== null) {
      cancelAnimationFrame(scrollAnimRef.current);
      scrollAnimRef.current = null;
    }

    const startX = el.scrollLeft;
    const maxScroll = el.scrollWidth - el.clientWidth;
    const clampedTarget = Math.max(0, Math.min(maxScroll, targetX));
    const distance = clampedTarget - startX;

    if (Math.abs(distance) < 2) {
      el.scrollLeft = clampedTarget;
      checkScroll();
      return;
    }

    const startTime = performance.now();
    const step = (now: number) => {
      const elapsed = now - startTime;
      const progress = Math.min(1, elapsed / duration);
      const easeOut = 1 - Math.pow(1 - progress, 3);
      el.scrollLeft = Math.round(startX + distance * easeOut);
      checkScroll();

      if (progress < 1) {
        scrollAnimRef.current = requestAnimationFrame(step);
      } else {
        scrollAnimRef.current = null;
        checkScroll();
      }
    };
    scrollAnimRef.current = requestAnimationFrame(step);
  };

  const handleScroll = (direction: "left" | "right") => {
    const el = scrollContainerRef.current;
    if (!el) return;
    const scrollAmount = direction === "left" ? -320 : 320;
    quickSmoothScrollTo(el.scrollLeft + scrollAmount, 160);
  };

  // Scroll active tab into view when activeDateFilter changes
  useEffect(() => {
    if (!scrollContainerRef.current) return;
    const activeEl = scrollContainerRef.current.querySelector(
      `[data-date-key="${activeDateFilter}"]`
    ) as HTMLElement;
    if (activeEl) {
      const container = scrollContainerRef.current;
      const targetLeft =
        activeEl.offsetLeft - (container.clientWidth / 2 - activeEl.clientWidth / 2);
      quickSmoothScrollTo(targetLeft, 180);
    }
  }, [activeDateFilter]);

  const getFileIcon = (fileType: string, fileName: string) => {
    const lower = (fileName || "").toLowerCase();
    if (
      fileType === "xlsx" ||
      fileType === "xls" ||
      fileType === "xml" ||
      lower.endsWith(".xlsx") ||
      lower.endsWith(".xls") ||
      lower.endsWith(".xml")
    ) {
      return <FileSpreadsheet className="w-4 h-4 text-emerald-600" />;
    }
    if (fileType === "csv" || lower.endsWith(".csv")) {
      return <FileText className="w-4 h-4 text-sky-600" />;
    }
    return <FileCode className="w-4 h-4 text-indigo-600" />;
  };

  const totalFilesCount = isFileScoped ? 1 : files.length;
  const totalRecordsCount = scopedLeads.length;

  // Active date files
  const activeDayFiles =
    activeDateFilter === "all" ? filesToGroup : groupedFiles[activeDateFilter] || [];
  const activeDayLeadsCount =
    activeDateFilter === "all" ? scopedLeads.length : leadsPerDate[activeDateFilter] || 0;
  const activeDayInfo =
    activeDateFilter !== "all" ? formatUploadDayLabel(activeDateFilter) : null;

  return (
    <div
      id="section-date-tab-navigation"
      className="bg-white border border-slate-200/90 rounded-2xl shadow-xs overflow-hidden transition-all"
    >
      {/* Top Header Bar */}
      <div className="px-6 py-4 flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 bg-white">
        <div className="flex items-center gap-3">
          <div className="p-2.5 rounded-xl bg-indigo-50 text-indigo-600 border border-indigo-100 shadow-2xs">
            <CalendarDays className="w-5 h-5" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-base font-bold text-slate-900 tracking-tight">
                Daily Pipeline & Date Navigation
              </h2>
              <span className="hidden sm:inline-flex text-xs font-semibold px-2 py-0.5 rounded-md bg-slate-100 text-slate-700 border border-slate-200/60 tabular-nums">
                {allDateKeys.length} active {allDateKeys.length === 1 ? "day" : "days"} • {totalRecordsCount} {totalRecordsCount === 1 ? "lead" : "leads"}
                {isFileScoped && activeScopedFile && ` in "${activeScopedFile.fileName}"`}
              </span>
            </div>
            <p className="text-xs text-slate-500 mt-0.5">
              {isFileScoped && activeScopedFile
                ? `Showing daily breakdown for sheet "${activeScopedFile.fileName}". Click "Show All Combined" to view entire directory.`
                : "Select any date button to filter records, view assigned workloads, and manage files"}
            </p>
          </div>
        </div>

        {/* Right side controls: Clear filter, Day PDF, Scroll buttons */}
        <div className="flex items-center gap-2">
          {(activeDateFilter !== "all" || isFileScoped) && (
            <button
              type="button"
              id="btn-clear-date-filter-top"
              onClick={() => {
                onSelectDateFilter("all");
                onSelectFileFilter("all");
              }}
              className="px-2.5 py-1.5 text-xs font-semibold text-slate-700 bg-white hover:bg-slate-50 border border-slate-200 rounded-lg cursor-pointer transition-colors flex items-center gap-1.5 shadow-2xs"
              title="Show all records across all dates and sheets"
            >
              <X className="w-3.5 h-3.5 text-slate-500" />
              <span>Show All Combined ({leads.length})</span>
            </button>
          )}

          {onOpenPdfReport && (
            <button
              type="button"
              id="btn-top-day-pdf"
              onClick={() =>
                onOpenPdfReport(activeDateFilter !== "all" ? activeDateFilter : undefined)
              }
              className="px-2.5 py-1.5 text-xs font-medium text-slate-700 bg-white hover:bg-slate-50 border border-slate-200 rounded-lg cursor-pointer transition-colors flex items-center gap-1.5 shadow-2xs"
              title="Generate PDF report for the active date"
            >
              <FileText className="w-3.5 h-3.5 text-indigo-600" />
              <span>
                {activeDateFilter === "all"
                  ? "Today's PDF"
                  : activeDayInfo?.isToday
                  ? "Today's PDF"
                  : "Day PDF"}
              </span>
            </button>
          )}

          {/* Left / Right Scroll Navigation Arrows */}
          <div className="hidden sm:flex items-center gap-1 pl-1 border-l border-slate-200">
            <button
              type="button"
              onClick={() => handleScroll("left")}
              disabled={!canScrollLeft}
              className={`p-1.5 rounded-lg border transition-all cursor-pointer ${
                canScrollLeft
                  ? "border-slate-200 bg-white text-slate-700 hover:bg-slate-50 hover:text-slate-900 shadow-2xs"
                  : "border-slate-100 bg-slate-50 text-slate-300 cursor-not-allowed"
              }`}
              title="Scroll dates left"
              aria-label="Scroll dates left"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
            <button
              type="button"
              onClick={() => handleScroll("right")}
              disabled={!canScrollRight}
              className={`p-1.5 rounded-lg border transition-all cursor-pointer ${
                canScrollRight
                  ? "border-slate-200 bg-white text-slate-700 hover:bg-slate-50 hover:text-slate-900 shadow-2xs"
                  : "border-slate-100 bg-slate-50 text-slate-300 cursor-not-allowed"
              }`}
              title="Scroll dates right"
              aria-label="Scroll dates right"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>

      {/* Horizontal Scrollable Flexbox Bar for Dates */}
      <div className="relative bg-slate-50/50 p-3 sm:p-4 border-b border-slate-100">
        <div
          ref={scrollContainerRef}
          onScroll={checkScroll}
          onWheel={(e) => {
            if (scrollContainerRef.current) {
              const delta = Math.abs(e.deltaX) > Math.abs(e.deltaY) ? e.deltaX : e.deltaY;
              if (delta !== 0) {
                scrollContainerRef.current.scrollLeft += delta;
                checkScroll();
              }
            }
          }}
          className="flex items-stretch gap-2.5 sm:gap-3 overflow-x-auto py-1 px-0.5 focus:outline-none scrollbar-thin"
          style={{ scrollbarWidth: "thin" }}
          role="tablist"
          aria-label="Date filter tabs"
        >
          {/* Tab 1: All Dates */}
          <button
            type="button"
            id="tab-date-all"
            data-date-key="all"
            role="tab"
            aria-selected={activeDateFilter === "all" && !isFileScoped}
            onClick={() => {
              onSelectDateFilter("all");
              onSelectFileFilter("all");
            }}
            className={`shrink-0 group relative flex flex-col justify-between min-w-[155px] sm:min-w-[170px] p-3 sm:p-3.5 rounded-2xl border transition-all duration-200 cursor-pointer text-left select-none ${
              activeDateFilter === "all" && !isFileScoped
                ? "bg-white border-indigo-600 shadow-md ring-2 ring-indigo-500/20 text-slate-900"
                : "bg-white border-slate-200/90 text-slate-700 hover:border-slate-300 hover:bg-slate-50/70 shadow-xs hover:shadow-sm"
            }`}
          >
            <div>
              <div className="flex items-center justify-between gap-1 mb-1">
                <span className="text-[11px] font-bold uppercase tracking-wider text-indigo-700 flex items-center gap-1">
                  <Layers className="w-3 h-3" />
                  All Records
                </span>
                <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-md bg-slate-100 text-slate-600 tabular-nums">
                  {files.length} {files.length === 1 ? "file" : "files"}
                </span>
              </div>
              <h3 className="text-sm sm:text-base font-bold tracking-tight text-slate-900">
                All Dates
              </h3>
              <p className="text-[11px] text-slate-500 mt-0.5">
                Full Database
              </p>
            </div>

            <div className="mt-3 pt-2 border-t border-slate-100 flex items-center justify-between text-xs">
              <span className="font-semibold text-slate-800 tabular-nums">
                {leads.length} leads
              </span>
              <span className="w-2 h-2 rounded-full bg-indigo-500" />
            </div>

            {/* Clear Active Indicator Pill */}
            {activeDateFilter === "all" && !isFileScoped && (
              <span
                className="absolute -bottom-[1px] inset-x-5 h-1 bg-indigo-600 rounded-full"
                aria-hidden="true"
              />
            )}
          </button>

          {/* Date Tabs */}
          {allDateKeys.map((dateKey) => {
            const dayInfo = formatUploadDayLabel(dateKey);
            const dayFiles = groupedFiles[dateKey] || [];
            const dayLeadsCount = leadsPerDate[dateKey] || 0;
            const isDateActive = activeDateFilter === dateKey;

            // Extract Day of week & formatted month-day
            const parts = dateKey.split("-").map(Number);
            let dateObj: Date;
            if (parts.length === 3) {
              dateObj = new Date(parts[0], parts[1] - 1, parts[2]);
            } else {
              dateObj = new Date(dateKey);
            }

            const weekday = !isNaN(dateObj.getTime())
              ? dateObj.toLocaleDateString("en-US", { weekday: "short" })
              : "";
            const monthDay = !isNaN(dateObj.getTime())
              ? dateObj.toLocaleDateString("en-US", {
                  month: "short",
                  day: "numeric",
                })
              : dateKey;
            const yearStr = !isNaN(dateObj.getTime()) ? dateObj.getFullYear() : "";

            return (
              <button
                key={dateKey}
                id={`tab-date-${dateKey}`}
                data-date-key={dateKey}
                role="tab"
                aria-selected={isDateActive}
                onClick={() => {
                  onSelectDateFilter(dateKey);
                  // If switching dates, clear active file filter unless it belongs to this day
                  if (activeFileFilter !== "all") {
                    const fileBelongs = dayFiles.some((f) => f.id === activeFileFilter);
                    if (!fileBelongs) {
                      onSelectFileFilter("all");
                    }
                  }
                }}
                className={`shrink-0 group relative flex flex-col justify-between min-w-[170px] sm:min-w-[190px] p-3 sm:p-3.5 rounded-2xl border transition-all duration-200 cursor-pointer text-left select-none ${
                  isDateActive
                    ? "bg-white border-indigo-600 shadow-md ring-2 ring-indigo-500/20 text-slate-900"
                    : "bg-white border-slate-200/90 text-slate-700 hover:border-slate-300 hover:bg-slate-50/70 shadow-2xs hover:shadow-xs"
                }`}
              >
                <div>
                  {/* Top Day Badge & Files Count */}
                  <div className="flex items-center justify-between gap-1 mb-1">
                    {dayInfo.isToday ? (
                      <span className="px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider rounded-md bg-indigo-50 text-indigo-700 border border-indigo-200/80 flex items-center gap-1">
                        <CheckCircle2 className="w-3 h-3 text-indigo-600" />
                        Today
                      </span>
                    ) : dayInfo.isTomorrow ? (
                      <span className="px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider rounded-md bg-slate-100 text-slate-700 border border-slate-200 flex items-center gap-1">
                        <Calendar className="w-3 h-3 text-slate-500" />
                        Tomorrow
                      </span>
                    ) : dayInfo.isYesterday ? (
                      <span className="px-1.5 py-0.5 text-[10px] font-medium uppercase tracking-wider rounded-md bg-slate-100 text-slate-600 border border-slate-200">
                        Yesterday
                      </span>
                    ) : (
                      <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wide">
                        {weekday}
                      </span>
                    )}

                    <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded-md bg-slate-100 text-slate-600 tabular-nums">
                      {dayFiles.length} {dayFiles.length === 1 ? "file" : "files"}
                    </span>
                  </div>

                  {/* Primary Date Text (Highly legible & well-spaced) */}
                  <div className="mt-1">
                    <h3 className="text-sm sm:text-base font-bold text-slate-900 tracking-tight flex items-baseline gap-1">
                      <span>{monthDay}</span>
                      <span className="text-xs font-normal text-slate-400">
                        {yearStr}
                      </span>
                    </h3>
                    <p className="text-[11px] text-slate-500 truncate">
                      {dayInfo.isToday || dayInfo.isTomorrow
                        ? weekday + " • " + dateKey
                        : dateKey}
                    </p>
                  </div>
                </div>

                {/* Bottom Row: Lead counts and Status indicator */}
                <div className="mt-3 pt-2 border-t border-slate-100/90 flex items-center justify-between text-xs">
                  <span
                    className={`font-semibold tabular-nums ${
                      dayLeadsCount > 0 ? "text-slate-800" : "text-slate-400"
                    }`}
                  >
                    {dayLeadsCount} {dayLeadsCount === 1 ? "lead" : "leads"}
                  </span>
                  <span
                    className={`w-2 h-2 rounded-full ${
                      isDateActive
                        ? "bg-indigo-600 ring-2 ring-indigo-200"
                        : dayLeadsCount > 0
                        ? "bg-slate-400"
                        : "bg-slate-200"
                    }`}
                  />
                </div>

                {/* Clear Active Indicator for the selected date */}
                {isDateActive && (
                  <span
                    className="absolute -bottom-[1px] inset-x-5 h-1 rounded-full bg-indigo-600"
                    aria-hidden="true"
                  />
                )}
              </button>
            );
          })}
        </div>
      </div>

      {/* Selected Day Details & Files Drawer */}
      <div className="bg-slate-50/70 p-3.5 sm:p-4">
        {/* Active Day Banner Bar */}
        <div className="flex flex-wrap items-center justify-between gap-2.5 pb-3 border-b border-slate-200/70">
          <div className="flex items-center gap-2">
            <div className="p-1.5 rounded-lg bg-white border border-slate-200 text-indigo-600 shadow-2xs">
              <Calendar className="w-4 h-4" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-xs sm:text-sm font-bold text-slate-900">
                  {isFileScoped && activeScopedFile
                    ? activeDateFilter === "all"
                      ? `Viewing: Categorized Sheet "${activeScopedFile.fileName}" (All Dates)`
                      : `Viewing: ${activeScopedFile.fileName} • ${activeDayInfo?.label || "Day"} (${
                          activeDayInfo?.subLabel || activeDateFilter
                        })`
                    : activeDateFilter === "all"
                    ? "Viewing: All Dates Combined"
                    : `Viewing: ${activeDayInfo?.label || "Day"} (${
                        activeDayInfo?.subLabel || activeDateFilter
                      })`}
                </span>
                <span className="text-xs font-semibold px-2 py-0.5 rounded-md bg-white border border-slate-200 text-slate-700 shadow-2xs tabular-nums">
                  {activeDayLeadsCount} {activeDayLeadsCount === 1 ? "lead" : "leads"}
                </span>
                {isFileScoped && activeDayLeadsCount !== leads.length && (
                  <span className="text-[11px] font-medium text-slate-500">
                    of {leads.length} total in pipeline
                  </span>
                )}
              </div>
              <p className="text-[11px] text-slate-500">
                {isFileScoped && activeScopedFile ? (
                  <span>
                    Viewing {activeDayLeadsCount} record{activeDayLeadsCount === 1 ? "" : "s"} isolated to spreadsheet <strong>{activeScopedFile.fileName}</strong>.{" "}
                    <button
                      type="button"
                      onClick={() => {
                        onSelectFileFilter("all");
                        onSelectDateFilter("all");
                      }}
                      className="text-indigo-600 font-semibold underline hover:text-indigo-800 cursor-pointer ml-1 inline-flex items-center gap-0.5"
                    >
                      View all {leads.length} leads in master directory →
                    </button>
                  </span>
                ) : activeDateFilter === "all" ? (
                  `Showing all ${leads.length} records combined in the pipeline across all uploaded spreadsheets. Click any date tab above to isolate leads for that day.`
                ) : (
                  `Table and workload are filtered exclusively to records from ${activeDayInfo?.label} (${activeDateFilter}).`
                )}
              </p>
            </div>
          </div>

          {/* Quick Actions for Selected Date */}
          <div className="flex items-center gap-2">
            {onOpenPdfReport && (
              <button
                type="button"
                id="btn-active-date-download-pdf"
                onClick={() =>
                  onOpenPdfReport(
                    activeDateFilter !== "all" ? activeDateFilter : undefined,
                    activeScopedFile ? activeScopedFile.id : undefined
                  )
                }
                className="px-2.5 py-1 text-xs font-semibold text-indigo-700 bg-white hover:bg-slate-50 border border-indigo-200 rounded-lg cursor-pointer transition-colors flex items-center gap-1.5 shadow-2xs"
                title={`Download assigned leads PDF report for ${
                  activeDateFilter === "all" ? "All Dates" : activeDayInfo?.label || activeDateFilter
                }`}
              >
                <FileText className="w-3.5 h-3.5 text-indigo-600" />
                <span>
                  {activeDateFilter === "all"
                    ? "PDF Report (All Dates)"
                    : `PDF Report (${activeDayInfo?.label || activeDateFilter})`}
                </span>
              </button>
            )}

            {isFileScoped && (
              <button
                type="button"
                id="btn-show-all-files-combined"
                onClick={() => {
                  onSelectFileFilter("all");
                  onSelectDateFilter("all");
                }}
                className="px-2.5 py-1 text-xs font-semibold text-slate-700 bg-white hover:bg-slate-50 border border-slate-200 rounded-lg cursor-pointer transition-colors flex items-center gap-1 shadow-2xs"
                title="Show all records combined across all uploaded sheets"
              >
                <Layers className="w-3.5 h-3.5 text-indigo-600" />
                <span>Show All Sheets ({leads.length})</span>
              </button>
            )}

            {activeDateFilter !== "all" && onQuickUploadForDate && (
              <button
                type="button"
                id="btn-upload-for-active-date"
                onClick={() => onQuickUploadForDate(activeDateFilter)}
                className="px-2.5 py-1 text-xs font-semibold text-indigo-700 bg-white hover:bg-indigo-50 border border-indigo-200 rounded-lg cursor-pointer transition-colors flex items-center gap-1 shadow-2xs"
                title={`Upload Excel or CSV file for ${activeDayInfo?.label}`}
              >
                <Plus className="w-3.5 h-3.5" />
                <span>Upload Sheet for {activeDayInfo?.label}</span>
              </button>
            )}

            {activeDateFilter === tomorrowStr &&
              !groupedFiles[tomorrowStr]?.length &&
              onQuickUploadForTomorrow && (
                <button
                  type="button"
                  id="btn-load-tomorrow-sample"
                  onClick={onQuickUploadForTomorrow}
                  className="px-2.5 py-1 text-xs font-semibold text-indigo-700 bg-indigo-50 hover:bg-indigo-100 border border-indigo-200 rounded-lg cursor-pointer transition-colors flex items-center gap-1 shadow-2xs"
                  title="Add sample spreadsheet for Tomorrow"
                >
                  <Sparkles className="w-3.5 h-3.5 text-indigo-600" />
                  <span>Load Tomorrow's Batch</span>
                </button>
              )}

            <button
              type="button"
              onClick={() => setIsFilesDrawerOpen(!isFilesDrawerOpen)}
              className="px-2 py-1 text-xs font-medium text-slate-600 bg-white hover:bg-slate-100 border border-slate-200 rounded-lg cursor-pointer transition-colors flex items-center gap-1 shadow-2xs"
              title={isFilesDrawerOpen ? "Hide files strip" : "Show files strip"}
            >
              <span>Files ({activeDayFiles.length})</span>
              {isFilesDrawerOpen ? (
                <ChevronUp className="w-3.5 h-3.5" />
              ) : (
                <ChevronDown className="w-3.5 h-3.5" />
              )}
            </button>
          </div>
        </div>

        {/* Files Strip for the active date */}
        {isFilesDrawerOpen && (
          <div className="pt-3">
            {activeDayFiles.length === 0 ? (
              <div className="py-5 px-4 text-center border border-dashed border-slate-200 rounded-xl bg-white/70">
                <Calendar className="w-5 h-5 text-slate-300 mx-auto mb-1" />
                <p className="text-xs font-semibold text-slate-700">
                  {activeDateFilter === "all"
                    ? "No files uploaded yet."
                    : `No spreadsheet files recorded under ${activeDayInfo?.label} (${activeDateFilter}).`}
                </p>
                <p className="text-[11px] text-slate-400 mt-0.5">
                  Upload an Excel (.xlsx, .xls) or CSV file above with {activeDayInfo?.label || "this day"} as the selected date.
                </p>
                {activeDateFilter !== "all" && onQuickUploadForDate && (
                  <button
                    type="button"
                    onClick={() => onQuickUploadForDate(activeDateFilter)}
                    className="mt-2.5 inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-indigo-700 bg-white hover:bg-indigo-50 border border-indigo-200 rounded-lg cursor-pointer transition-colors shadow-2xs"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    Upload File for {activeDayInfo?.label}
                  </button>
                )}
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2.5">
                {activeDayFiles.map((file) => {
                  const isFileActive = activeFileFilter === file.id;
                  const uploadTime = formatTimeFromIso(file.uploadedAt);

                  return (
                    <div
                      key={file.id}
                      id={`file-card-${file.id}`}
                      className={`p-3 rounded-xl border transition-all flex flex-col justify-between ${
                        isFileActive
                          ? "bg-indigo-50/80 border-indigo-400 ring-2 ring-indigo-400/40 shadow-xs"
                          : "bg-white border-slate-200/90 hover:border-slate-300 hover:shadow-xs"
                      }`}
                    >
                      <div className="flex items-start gap-2.5">
                        <div className="p-2 rounded-lg bg-slate-50 border border-slate-100 shrink-0">
                          {getFileIcon(file.fileType, file.fileName)}
                        </div>

                        <div className="min-w-0 flex-1">
                          <div className="flex items-center justify-between gap-1">
                            <h4
                              className="text-xs font-bold text-slate-900 truncate"
                              title={file.fileName}
                            >
                              {file.fileName}
                            </h4>
                            <span className="text-[10px] uppercase font-bold px-1.5 py-0.5 rounded bg-slate-100 text-slate-600 shrink-0">
                              {file.fileType === "xml" ? "Excel XML" : file.fileType || "file"}
                            </span>
                          </div>

                          <div className="flex items-center gap-2 text-[11px] text-slate-500 mt-1 flex-wrap">
                            {uploadTime && (
                              <span className="flex items-center gap-1">
                                <Clock className="w-3 h-3 text-slate-400" />
                                {uploadTime}
                              </span>
                            )}
                            {file.fileSize && <span>• {file.fileSize}</span>}
                            <span className="font-semibold text-emerald-700 bg-emerald-50 px-1.5 py-0.2 rounded border border-emerald-200/60 tabular-nums">
                              {file.recordCount} leads
                            </span>
                          </div>
                        </div>
                      </div>

                      {/* File Card Actions */}
                      <div className="flex items-center justify-between gap-1 mt-2.5 pt-2 border-t border-slate-100 text-xs">
                        <button
                          type="button"
                          id={`btn-view-file-${file.id}`}
                          onClick={() =>
                            onSelectFileFilter(isFileActive ? "all" : file.id)
                          }
                          className={`px-2 py-1 rounded text-xs font-medium flex items-center gap-1 cursor-pointer transition-colors ${
                            isFileActive
                              ? "bg-indigo-600 text-white"
                              : "text-indigo-700 hover:bg-indigo-50"
                          }`}
                          title="Filter table to only leads from this file"
                        >
                          <Eye className="w-3 h-3" />
                          {isFileActive ? "Viewing" : "View Leads"}
                        </button>

                        <div className="flex items-center gap-1">
                          {onExportFileLeads && (
                            <button
                              type="button"
                              onClick={() => onExportFileLeads(file)}
                              className="p-1 rounded text-slate-400 hover:text-slate-700 hover:bg-slate-100 cursor-pointer transition-colors"
                              title="Export leads from this file"
                            >
                              <Download className="w-3.5 h-3.5" />
                            </button>
                          )}
                          <button
                            type="button"
                            id={`btn-delete-file-${file.id}`}
                            onClick={() => onDeleteFile(file)}
                            className="p-1 rounded text-slate-400 hover:text-red-600 hover:bg-red-50 cursor-pointer transition-colors"
                            title="Delete this file and its associated leads"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};
