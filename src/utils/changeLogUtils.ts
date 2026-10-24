import { Lead, SheetChangeRecord, UploadedFileRecord, HandlerRecord } from "../types";
import { getLocalDateString, getReportDateForTimestamp, formatTimeFromIso } from "./dateUtils";
import { getLeadHandlerName, isLeadAssignedToHandler } from "./pdfGenerator";

const CHANGE_LOG_STORAGE_KEY = "lead_data_sheet_change_logs_v2";

/**
 * Strips Excel extensions and formats clean sheet name for file naming and labels.
 * E.g. "Sam.xlsx" -> "Sam", "Jerin.xls" -> "Jerin", "Daily_Tasks.csv" -> "Daily_Tasks"
 */
export function cleanSheetName(fileName?: string): string {
  if (!fileName || fileName.trim() === "" || fileName.toLowerCase() === "all") {
    return "All_Sheets";
  }
  const stripped = fileName
    .replace(/\.(xlsx|xls|csv|xml|txt)$/i, "")
    .trim()
    .replace(/[^\w\s-]/g, "")
    .replace(/\s+/g, "_");

  return stripped || "Sheet";
}

/**
 * Returns a standardized PDF filename containing BOTH the Excel sheet name and the specific date.
 * E.g. "Sam_2026-10-08_Daily_Report.pdf" or "Jerin_2026-10-08_Daily_Report.pdf"
 */
export function getReportPdfFileName(
  sheetNameOrFileName?: string,
  dateStr?: string,
  suffixOrHandler: string = "Daily_Report"
): string {
  const cleanName = cleanSheetName(sheetNameOrFileName);
  const rawDate = dateStr || getLocalDateString(0);
  const effectiveDate = rawDate === "all" ? "All_Dates" : rawDate;

  // Determine if suffixOrHandler is a specific handler name or custom tag
  const isCustomHandlerOrSuffix = Boolean(
    suffixOrHandler &&
      suffixOrHandler !== "Daily_Report" &&
      suffixOrHandler !== "all"
  );

  if (cleanName === "All_Sheets") {
    if (isCustomHandlerOrSuffix) {
      const cleanHandler = cleanSheetName(suffixOrHandler);
      if (cleanHandler === "Assigned_Report") {
        return `Assigned_Leads_Report_${effectiveDate}.pdf`;
      }
      return `${cleanHandler}_${effectiveDate}_Daily_Report.pdf`;
    }
    return `Daily_Assigned_Leads_Report_${effectiveDate}.pdf`;
  }

  if (isCustomHandlerOrSuffix) {
    const cleanHandler = cleanSheetName(suffixOrHandler);
    if (cleanHandler === "Assigned_Report") {
      return `${cleanName}_${effectiveDate}_Assigned_Report.pdf`;
    }
    if (cleanName.toLowerCase() === cleanHandler.toLowerCase()) {
      return `${cleanName}_${effectiveDate}_Daily_Report.pdf`;
    }
    return `${cleanName}_${cleanHandler}_${effectiveDate}_Report.pdf`;
  }

  return `${cleanName}_${effectiveDate}_Daily_Report.pdf`;
}

/**
 * Retrieves change records from local storage.
 */
export function getStoredChangeLogs(): SheetChangeRecord[] {
  try {
    const raw = localStorage.getItem(CHANGE_LOG_STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch (e) {
    console.error("Failed to read change logs from localStorage:", e);
    return [];
  }
}

/**
 * Saves change records to local storage.
 */
export function saveStoredChangeLogs(records: SheetChangeRecord[]): void {
  try {
    // Keep the most recent 2000 changes to prevent storage overflow
    const trimmed = records.slice(0, 2000);
    localStorage.setItem(CHANGE_LOG_STORAGE_KEY, JSON.stringify(trimmed));
  } catch (e) {
    console.error("Failed to save change logs to localStorage:", e);
  }
}

/**
 * Creates and stores a new change log record.
 */
export function recordLeadChange(
  entry: Omit<SheetChangeRecord, "id" | "timestamp" | "date"> & {
    id?: string;
    timestamp?: string;
    date?: string;
  }
): SheetChangeRecord {
  const timestamp = entry.timestamp || new Date().toISOString();
  const date = entry.date || getLocalDateString(0);
  const newRecord: SheetChangeRecord = {
    id: entry.id || `change-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
    timestamp,
    date,
    leadId: entry.leadId,
    leadName: entry.leadName || "Client",
    fileId: entry.fileId,
    fileName: entry.fileName,
    changeType: entry.changeType,
    summary: entry.summary,
    field: entry.field,
    oldValue: entry.oldValue,
    newValue: entry.newValue,
    handlerName: entry.handlerName,
  };

  const existing = getStoredChangeLogs();
  const updated = [newRecord, ...existing];
  saveStoredChangeLogs(updated);

  return newRecord;
}

/**
 * Synthesizes and aggregates daily changes for a specific Excel sheet and date.
 * Combines explicit logged changes with state changes on leads (assignments, notes, updates)
 * so that any activity for "Sam" or "Jerin" on that date is comprehensively accounted for in the daily PDF report.
 */
export function getDailyChangesForSheet(
  leads: Lead[],
  targetFile: UploadedFileRecord | null | undefined,
  dateStr: string,
  explicitLogs: SheetChangeRecord[] = [],
  handlers: HandlerRecord[] = []
): SheetChangeRecord[] {
  const fileId = targetFile?.id;
  const fileName = targetFile?.fileName;

  // 1. Filter leads belonging to this sheet (or all if targetFile is null)
  const scopedLeads = leads.filter((l) => {
    if (!targetFile) return true;
    if (fileId && l.fileId === fileId) return true;
    if (fileName && l.uploadedFileName && l.uploadedFileName.toLowerCase() === fileName.toLowerCase()) return true;
    if (fileName && cleanSheetName(l.uploadedFileName) === cleanSheetName(fileName)) return true;
    return false;
  });

  // 2. Filter explicit logs that match this sheet and date
  const matchedExplicitLogs = explicitLogs.filter((log) => {
    // Date match
    if (dateStr !== "all" && log.date !== dateStr) {
      return false;
    }
    // File match
    if (targetFile) {
      if (fileId && log.fileId && log.fileId === fileId) return true;
      if (fileName && log.fileName && log.fileName.toLowerCase() === fileName.toLowerCase()) return true;
      if (fileName && log.fileName && cleanSheetName(log.fileName) === cleanSheetName(fileName)) return true;
      return false;
    }
    return true;
  });

  const changeMap = new Map<string, SheetChangeRecord>();

  // Add explicit logs first
  matchedExplicitLogs.forEach((log) => {
    changeMap.set(log.id, log);
  });

  // 3. Synthesize changes from leads if not already logged explicitly
  scopedLeads.forEach((lead) => {
    const leadSheetName = lead.uploadedFileName || fileName || "Sheet";
    const leadFileId = lead.fileId || fileId;

    // Check assignment activity on this date
    const assignedDate = lead.reportDate || (lead.assignedAt ? getReportDateForTimestamp(lead.assignedAt) : null);
    const isAssigned = isLeadAssignedToHandler(lead, handlers);

    if (isAssigned && (dateStr === "all" || assignedDate === dateStr)) {
      const handlerName = getLeadHandlerName(lead, handlers);
      const timeStr = lead.assignedAt ? formatTimeFromIso(lead.assignedAt) : "Assigned";
      const synthKey = `synth-assign-${lead.id}-${dateStr}`;

      if (!changeMap.has(synthKey)) {
        changeMap.set(synthKey, {
          id: synthKey,
          leadId: lead.id,
          leadName: lead.fullName,
          fileId: leadFileId,
          fileName: leadSheetName,
          date: assignedDate || dateStr,
          timestamp: lead.assignedAt || new Date().toISOString(),
          changeType: "assignment",
          summary: `Assigned task to handler ${handlerName} at ${timeStr}`,
          newValue: handlerName,
          handlerName,
        });
      }
    }

    // Check status or notes modifications on this date
    const updatedDate = lead.updatedAt ? getReportDateForTimestamp(lead.updatedAt) : null;
    if (lead.updatedAt && (dateStr === "all" || updatedDate === dateStr)) {
      const synthKey = `synth-update-${lead.id}-${dateStr}`;
      if (!changeMap.has(synthKey)) {
        let updateDesc = `Status: ${lead.status}`;
        if (lead.manualNotes?.trim()) {
          updateDesc += ` | Notes: "${lead.manualNotes.trim().substring(0, 40)}${lead.manualNotes.length > 40 ? "..." : ""}"`;
        }
        changeMap.set(synthKey, {
          id: synthKey,
          leadId: lead.id,
          leadName: lead.fullName,
          fileId: leadFileId,
          fileName: leadSheetName,
          date: updatedDate || dateStr,
          timestamp: lead.updatedAt,
          changeType: "status",
          summary: updateDesc,
          newValue: lead.status,
          handlerName: lead.handlerName,
        });
      }
    }

    // Check if uploaded on this date
    if (lead.uploadDate && (dateStr === "all" || lead.uploadDate === dateStr)) {
      const synthKey = `synth-upload-${lead.id}-${dateStr}`;
      if (!changeMap.has(synthKey) && changeMap.size < 500) {
        changeMap.set(synthKey, {
          id: synthKey,
          leadId: lead.id,
          leadName: lead.fullName,
          fileId: leadFileId,
          fileName: leadSheetName,
          date: lead.uploadDate,
          timestamp: lead.createdAt || new Date().toISOString(),
          changeType: "import",
          summary: `Imported from Excel sheet "${leadSheetName}"`,
          newValue: leadSheetName,
        });
      }
    }
  });

  const results = Array.from(changeMap.values());
  // Sort most recent first
  results.sort((a, b) => b.timestamp.localeCompare(a.timestamp));

  return results;
}
