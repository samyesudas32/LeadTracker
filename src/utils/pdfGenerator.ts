import { jsPDF } from "jspdf";
import autoTable from "jspdf-autotable";
import { Lead, HandlerRecord, SheetChangeRecord } from "../types";
import {
  formatUploadDayLabel,
  getLocalDateString,
  getCutoffReportingWindow,
  isProcessedAfterCutoff,
  getReportDateForTimestamp,
  DEFAULT_CUTOFF_HOUR,
  formatCutoffHourLabel,
  formatTimeFromIso,
} from "./dateUtils";
import { cleanSheetName, getReportPdfFileName } from "./changeLogUtils";

export interface PdfReportOptions {
  title?: string;
  subtitle?: string;
  companyName?: string;
  dateStr?: string; // e.g. "2026-09-29"
  dateLabel?: string; // e.g. "Today (Sep 29, 2026)"
  selectedHandler?: string; // "all" or specific Handler name
  groupByHandler?: boolean;
  includeContactDetails?: boolean;
  includePaymentInfo?: boolean;
  includeNotes?: boolean;
  includeStatus?: boolean;
  includeAssignedTime?: boolean;
  orientation?: "portrait" | "landscape";
  handlers?: HandlerRecord[];
  cutoffHour?: number; // Kept for backward compatibility
  reportScope?: "standard" | "rollover-only" | "all"; // Kept for backward compatibility
  enableCutoff?: boolean;
  fileName?: string; // Original spreadsheet filename (e.g. "Sam.xlsx" or "Jerin.xlsx")
  sheetName?: string; // Sheet identifier or clean name (e.g. "Sam" or "Jerin")
  changes?: SheetChangeRecord[]; // Daily activity & modifications on this date
  includeChangesLog?: boolean; // Whether to include the changes log in the PDF
  includeAllRecords?: boolean; // true: include all sheet records (assigned & unassigned); false: assigned only
}

/**
 * Resolves the display handler name for a lead.
 * If lead is unassigned or category is unassigned, strictly returns "Unassigned"
 * without erroneously falling back to stale previous handler IDs.
 */
export function getLeadHandlerName(lead: Lead, handlers: HandlerRecord[] = []): string {
  // 1. Explicit unassigned category
  if (lead.assignmentCategory === "unassigned") {
    return "";
  }

  // 2. Check handlerName string
  if (lead.handlerName && lead.handlerName.trim() !== "") {
    const trimmed = lead.handlerName.trim();
    if (
      trimmed.toLowerCase() === "unassigned" ||
      trimmed.toLowerCase() === "not assigned" ||
      trimmed.toLowerCase() === "none" ||
      trimmed.toLowerCase() === "no handler"
    ) {
      return "";
    }
    const found = handlers.find((h) => h?.name && h.name.toLowerCase() === trimmed.toLowerCase());
    return found?.name || trimmed;
  }

  // 3. Fallback to handlerId ONLY if category is explicitly 'assigned'
  if (lead.assignmentCategory === "assigned" && lead.handlerId && lead.handlerId.trim() !== "") {
    const found = handlers.find((h) => h.id === lead.handlerId);
    if (found?.name) return found.name;
  }

  return "";
}

/**
 * Checks whether a lead has an actual handler assigned (excludes unassigned/empty).
 */
export function isLeadAssignedToHandler(lead: Lead, handlers: HandlerRecord[] = []): boolean {
  if (lead.assignmentCategory === "unassigned") return false;
  const name = getLeadHandlerName(lead, handlers).toLowerCase();
  const isNameAssigned =
    name !== "" &&
    name !== "unassigned" &&
    name !== "not assigned" &&
    name !== "none" &&
    name !== "no handler";
  return isNameAssigned;
}

/**
 * Checks whether a lead's assignment was processed after cutoff.
 * Note: Cutoff restrictions are removed so all assignments compile into the daily report.
 */
export function isLeadPostCutoffRollover(_lead: Lead, _cutoffHour: number = DEFAULT_CUTOFF_HOUR): boolean {
  return false;
}

/**
 * Calculates the effective daily report date for a lead.
 * No 11 PM cutoff restriction: all assignments compile directly into the calendar date.
 */
export function getLeadEffectiveReportDate(lead: Lead, _cutoffHour: number = DEFAULT_CUTOFF_HOUR): string {
  // 1. Explicit reportDate takes precedence (saved in local YYYY-MM-DD on assignment)
  if (lead.reportDate && /^\d{4}-\d{2}-\d{2}$/.test(lead.reportDate)) {
    return lead.reportDate;
  }

  // 2. Local date derived from assignedAt timestamp
  if (lead.assignedAt) {
    const dateFromAssigned = getReportDateForTimestamp(lead.assignedAt);
    if (dateFromAssigned) return dateFromAssigned;
  }

  // 3. Fallback to uploadDate if valid YYYY-MM-DD
  if (lead.uploadDate && /^\d{4}-\d{2}-\d{2}$/.test(lead.uploadDate)) {
    return lead.uploadDate;
  }

  // 4. Fallback to createdAt timestamp in local time
  if (lead.createdAt) {
    const dateFromCreated = getReportDateForTimestamp(lead.createdAt);
    if (dateFromCreated) return dateFromCreated;
  }

  return getLocalDateString(0);
}

/**
 * Filter leads by assigned date compiling all assignments into the daily report
 * without any 11 PM cutoff time or daily time restrictions.
 */
export function getLeadsAssignedForDate(
  leads: Lead[],
  targetDateStr: string,
  _handlers: HandlerRecord[] = []
): Lead[] {
  return leads.filter((lead) => {
    if (targetDateStr === "all") {
      return true;
    }

    const effectiveDate = getLeadEffectiveReportDate(lead);
    if (effectiveDate === targetDateStr) return true;

    if (lead.reportDate === targetDateStr) return true;

    if (lead.assignedAt && getReportDateForTimestamp(lead.assignedAt) === targetDateStr) {
      return true;
    }

    if (lead.uploadDate === targetDateStr) {
      return true;
    }

    if (lead.updatedAt && getReportDateForTimestamp(lead.updatedAt) === targetDateStr) {
      return true;
    }

    return false;
  });
}

/**
 * Generates a high-quality, professional PDF document
 * compiling uploaded Excel data, daily sheet modifications, and handler assignments.
 * Never drops sheet records so all Excel data is accurately visible.
 */
export function generateAssignedLeadsPdf(
  leads: Lead[],
  options: PdfReportOptions = {}
): jsPDF {
  const {
    companyName = "Client Operations Team",
    dateStr = getLocalDateString(0),
    selectedHandler = "all",
    groupByHandler = true,
    includeContactDetails = true,
    includePaymentInfo = true, // Preserve Excel payment receipt & proof data
    includeNotes = true,
    includeStatus = true,
    includeAssignedTime = true,
    orientation = "landscape",
    handlers = [],
    fileName,
    sheetName,
    changes = [],
    includeChangesLog = false,
    includeAllRecords = true,
  } = options;

  const cleanName = cleanSheetName(sheetName || fileName);
  const isAllSheets = cleanName.toUpperCase() === "ALL_SHEETS";
  const isSheetSpecific = !isAllSheets;
  const isHandlerSelected = Boolean(selectedHandler && selectedHandler !== "all");

  // User requirement: When PDF is downloaded, "1. DAILY CHANGES & ACTIVITY LOG FOR ALL_SHEETS"
  // is strictly NOT needed. Only "SHEET TASKS & CLIENT REGISTER FOR ALL_SHEETS" is needed.
  // Therefore, for ALL_SHEETS, never include changes log. For specific sheets, only include if explicitly requested.
  const shouldIncludeChangesLog =
    !isAllSheets && Boolean(includeChangesLog && changes && changes.length > 0);

  const defaultTitle = isHandlerSelected
    ? isSheetSpecific
      ? `${cleanName} — ${selectedHandler} Daily Report`
      : `${selectedHandler} — Daily Assignment & Tasks Report`
    : isSheetSpecific
    ? shouldIncludeChangesLog
      ? `${cleanName} — Daily Changes & Assigned Tasks Report`
      : `${cleanName} — Daily Assigned Tasks & Leads Report`
    : "Daily Lead & Handler Assignment Report";
  const title = options.title || defaultTitle;

  // When a handler is selected, strictly filter to ONLY that handler's assigned leads (handler_id IS NOT NULL)
  // Strictly exclude all unassigned records or records belonging to any other handlers
  const activeLeads = isHandlerSelected
    ? leads.filter((l) => {
        if (!isLeadAssignedToHandler(l, handlers)) return false;
        const hName = getLeadHandlerName(l, handlers);
        if (!hName || hName.trim() === "" || hName.toLowerCase() === "unassigned") return false;
        return hName.toLowerCase() === selectedHandler.toLowerCase();
      })
    : includeAllRecords
    ? leads
    : leads.filter((l) => isLeadAssignedToHandler(l, handlers));

  // Formatted date label
  const isAllDates = dateStr === "all";
  const dayInfo = formatUploadDayLabel(dateStr);
  const formattedDateTitle = isAllDates
    ? "All Recorded Dates"
    : dayInfo.isToday
    ? `Today (${dayInfo.subLabel || dateStr})`
    : dayInfo.isTomorrow
    ? `Tomorrow (${dayInfo.subLabel || dateStr})`
    : dayInfo.subLabel || dateStr;

  const doc = new jsPDF({
    orientation,
    unit: "mm",
    format: "a4",
  });

  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const margin = 12;

  // 1. Top Decorative Brand Bar
  doc.setFillColor(15, 23, 42); // slate-900
  doc.rect(0, 0, pageWidth, 25, "F");

  // Accent Line: emerald-500 standard
  doc.setFillColor(16, 185, 129); // emerald-500
  doc.rect(0, 25, pageWidth, 2.5, "F");

  // Company / Org / Sheet Tag
  doc.setFont("helvetica", "bold");
  doc.setFontSize(8.5);
  doc.setTextColor(148, 163, 184); // slate-400
  const orgTag = isHandlerSelected
    ? `${companyName.toUpperCase()}  •  HANDLER REPORT: ${selectedHandler.toUpperCase()}${
        isSheetSpecific ? `  •  SHEET: ${(fileName || cleanName).toUpperCase()}` : ""
      }`
    : isSheetSpecific
    ? `${companyName.toUpperCase()}  •  EXCEL SPREADSHEET: ${(fileName || cleanName).toUpperCase()}`
    : `${companyName.toUpperCase()}  •  DAILY LEAD & HANDLER ASSIGNMENT REGISTER`;
  doc.text(orgTag, margin, 9);

  // Main Report Title
  doc.setFontSize(12);
  doc.setTextColor(255, 255, 255);
  doc.text(title.toUpperCase(), margin, 17);

  // Subtitle Tag
  doc.setFont("helvetica", "normal");
  doc.setFontSize(7.5);
  doc.setTextColor(203, 213, 225);
  doc.text(
    isHandlerSelected
      ? `CLIENT TASKS & ACTIVITY FOR ${selectedHandler.toUpperCase()}  •  NO DAILY TIME RESTRICTIONS`
      : shouldIncludeChangesLog
      ? "ALL DAILY ASSIGNMENTS & SHEET CHANGES COMPILED  •  NO DAILY TIME RESTRICTIONS"
      : "ALL DAILY ASSIGNMENTS & CLIENT REGISTER COMPILED  •  NO DAILY TIME RESTRICTIONS",
    margin,
    23
  );

  // Date & Sheet Tag in Top Right
  doc.setFont("helvetica", "bold");
  doc.setFontSize(8.5);
  doc.setTextColor(255, 255, 255);
  const dateBadgeText = isHandlerSelected
    ? isSheetSpecific
      ? `SHEET: ${cleanName.toUpperCase()}  |  HANDLER: ${selectedHandler.toUpperCase()}  |  DATE: ${formattedDateTitle.toUpperCase()}`
      : `HANDLER: ${selectedHandler.toUpperCase()}  |  DATE: ${formattedDateTitle.toUpperCase()}`
    : isSheetSpecific
    ? `SHEET: ${cleanName.toUpperCase()}  |  DATE: ${formattedDateTitle.toUpperCase()}`
    : `REPORT DATE: ${formattedDateTitle.toUpperCase()}`;
  doc.text(dateBadgeText, pageWidth - margin, 11, { align: "right" });

  const generatedTimeStr = `Generated: ${new Date().toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  })} at ${new Date().toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit", hour12: true })}`;
  doc.setFont("helvetica", "normal");
  doc.setFontSize(7.5);
  doc.setTextColor(148, 163, 184);
  doc.text(generatedTimeStr, pageWidth - margin, 17, { align: "right" });

  doc.setFontSize(7);
  doc.setTextColor(226, 232, 240);
  doc.text("Daily Scope: Full Calendar Day (12:00 AM - 11:59 PM)", pageWidth - margin, 23, { align: "right" });

  let currentY = 32;

  // 2. Summary Statistics Box
  const totalCount = activeLeads.length;
  const changesCount = changes ? changes.length : 0;
  const assignedCount = activeLeads.filter((l) => isLeadAssignedToHandler(l, handlers)).length;
  const unassignedCount = totalCount - assignedCount;

  // Stat Card Background
  doc.setFillColor(248, 250, 252); // slate-50
  doc.setDrawColor(226, 232, 240); // slate-200
  doc.roundedRect(margin, currentY, pageWidth - margin * 2, 24, 2, 2, "FD");

  // Summary Metrics text
  doc.setFont("helvetica", "bold");
  doc.setFontSize(9);
  doc.setTextColor(30, 41, 59); // slate-800
  const summaryHeader = isHandlerSelected
    ? `Handler Report for "${selectedHandler}"${
        isSheetSpecific ? ` in Sheet "${fileName || cleanName}"` : ""
      }: ${totalCount} Assigned Records${shouldIncludeChangesLog ? `  •  ${changesCount} Changes Recorded` : ""}`
    : isSheetSpecific
    ? `Summary for "${fileName || cleanName}": ${totalCount} Total Sheet Records (${assignedCount} Assigned, ${unassignedCount} Pending)${shouldIncludeChangesLog ? `  •  ${changesCount} Changes Recorded` : ""}`
    : `Assignment Summary: ${totalCount} Total Records (${assignedCount} Assigned, ${unassignedCount} Pending)${shouldIncludeChangesLog ? `  •  ${changesCount} Changes Recorded` : ""}`;
  doc.text(summaryHeader, margin + 4, currentY + 6);

  // Distribution note inside summary
  doc.setFont("helvetica", "bold");
  doc.setFontSize(8);
  doc.setTextColor(16, 185, 129); // emerald-600
  doc.text(`• Full daily compilation active (no time restrictions)`, margin + 140, currentY + 6);

  doc.setFont("helvetica", "normal");
  doc.setFontSize(8);
  doc.setTextColor(71, 85, 105);

  const interestedCount = activeLeads.filter((l) => l.status === "Interested").length;
  const followUpCount = activeLeads.filter((l) => l.status === "Requires Follow-up").length;
  const pendingCount = activeLeads.filter((l) => l.status === "Pending Call").length;

  const statusSummary = `Status Breakdown: ${interestedCount} Interested  •  ${followUpCount} Requires Follow-up  •  ${pendingCount} Pending Call`;
  doc.text(statusSummary, margin + 4, currentY + 12);

  // Handler pills / distribution text
  const handlerCounts: Record<string, number> = {};
  activeLeads.forEach((lead) => {
    const isAssigned = isLeadAssignedToHandler(lead, handlers);
    const hName = isAssigned ? getLeadHandlerName(lead, handlers) : "Unassigned / Pending";
    handlerCounts[hName] = (handlerCounts[hName] || 0) + 1;
  });

  const handlerBreakdownStr = Object.entries(handlerCounts)
    .map(([hName, count]) => `${hName}: ${count} ${count === 1 ? "record" : "records"}`)
    .join("   |   ");

  doc.setFont("helvetica", "bold");
  doc.setTextColor(15, 23, 42);
  doc.text(`Scope & Assignment: `, margin + 4, currentY + 18.5);

  doc.setFont("helvetica", "normal");
  doc.setTextColor(79, 70, 229); // indigo-600
  doc.text(
    isHandlerSelected
      ? `Dedicated report for ${selectedHandler} (${totalCount} tasks in scope)`
      : handlerBreakdownStr || "None assigned",
    margin + 42,
    currentY + 18.5
  );

  currentY += 29;

  // Check if both leads and changes are empty
  if (activeLeads.length === 0 && (!shouldIncludeChangesLog || changesCount === 0)) {
    doc.setFillColor(254, 242, 242);
    doc.setDrawColor(254, 202, 202);
    doc.roundedRect(margin, currentY, pageWidth - margin * 2, 25, 2, 2, "FD");

    doc.setFont("helvetica", "bold");
    doc.setFontSize(11);
    doc.setTextColor(185, 28, 28);
    doc.text(
      isHandlerSelected
        ? `No recorded tasks found for handler "${selectedHandler}" on this date.`
        : `No recorded sheet records found for this date.`,
      margin + 6,
      currentY + 10
    );

    doc.setFont("helvetica", "normal");
    doc.setFontSize(9);
    doc.setTextColor(100, 116, 139);
    doc.text(
      isHandlerSelected
        ? `No tasks or activity was assigned to ${selectedHandler} for ${
            isSheetSpecific ? `sheet "${cleanName}"` : "the selected scope"
          } on report date "${dateStr}".`
        : `No client records were found for ${isSheetSpecific ? `sheet "${cleanName}"` : "any sheets"} on report date "${dateStr}".`,
      margin + 6,
      currentY + 17
    );
    return doc;
  }

  // =========================================================================
  // Section 1: Daily Changes & Activity Log on this Date
  // (Strictly omitted for ALL_SHEETS as requested; only Sheet Tasks & Client Register are included)
  // =========================================================================
  if (shouldIncludeChangesLog) {
    if (currentY > pageHeight - 35) {
      doc.addPage();
      currentY = 20;
    }

    doc.setFillColor(241, 245, 249); // slate-100
    doc.setDrawColor(203, 213, 225); // slate-300
    doc.roundedRect(margin, currentY, pageWidth - margin * 2, 8, 1.5, 1.5, "FD");

    doc.setFont("helvetica", "bold");
    doc.setFontSize(9);
    doc.setTextColor(30, 41, 59);
    doc.text(
      `1. DAILY CHANGES & ACTIVITY LOG FOR ${cleanName.toUpperCase()} — ${changes.length} ${
        changes.length === 1 ? "Change" : "Changes"
      } Recorded on ${formattedDateTitle}`,
      margin + 3,
      currentY + 5.5
    );

    currentY += 10;

    const changesHeaders = ["#", "Time", "Client / Person", "Change Type", "Modification Details & Notes", "Handler / Updated By"];
    const changesBody = changes.map((ch, idx) => [
      String(idx + 1),
      ch.timestamp ? formatTimeFromIso(ch.timestamp) : "Recorded",
      ch.leadName || "Client",
      ch.changeType.toUpperCase(),
      ch.summary || "Modified",
      ch.handlerName || "-",
    ]);

    autoTable(doc, {
      startY: currentY,
      head: [changesHeaders],
      body: changesBody,
      margin: { left: margin, right: margin },
      theme: "grid",
      headStyles: {
        fillColor: [15, 23, 42], // slate-900
        textColor: [255, 255, 255],
        fontStyle: "bold",
        fontSize: 7.5,
        cellPadding: 2,
      },
      bodyStyles: {
        fontSize: 7.2,
        cellPadding: 2,
        textColor: [30, 41, 59],
      },
      alternateRowStyles: {
        fillColor: [248, 250, 252],
      },
      columnStyles: {
        0: { cellWidth: 8, halign: "center" },
        1: { cellWidth: 20, fontStyle: "bold" },
        2: { cellWidth: orientation === "landscape" ? 34 : 26, fontStyle: "bold" },
        3: { cellWidth: 22, textColor: [79, 70, 229], fontStyle: "bold" },
        4: { fontStyle: "normal" },
        5: { cellWidth: 24, fontStyle: "bold", textColor: [16, 185, 129] },
      },
      didDrawPage: () => {
        const totalPages = doc.getNumberOfPages();
        const currentPage = (doc as any).internal.getCurrentPageInfo().pageNumber;
        doc.setFont("helvetica", "normal");
        doc.setFontSize(7.5);
        doc.setTextColor(148, 163, 184);
        doc.text(
          `${companyName} • ${cleanName} Daily Report • Page ${currentPage} of ${totalPages}`,
          pageWidth / 2,
          pageHeight - 6,
          { align: "center" }
        );
      },
    });

    currentY = (doc as any).lastAutoTable.finalY + 8;
  }

  // =========================================================================
  // Section 2: Sheet Tasks & Clients Register
  // =========================================================================
  if (activeLeads.length === 0) {
    if (currentY > pageHeight - 30) {
      doc.addPage();
      currentY = 20;
    }
    doc.setFillColor(248, 250, 252);
    doc.setDrawColor(226, 232, 240);
    doc.roundedRect(margin, currentY, pageWidth - margin * 2, 14, 1.5, 1.5, "FD");
    doc.setFont("helvetica", "bold");
    doc.setFontSize(8.5);
    doc.setTextColor(100, 116, 139);
    doc.text(
      isHandlerSelected
        ? `${shouldIncludeChangesLog ? "2. " : ""}HANDLER TASKS: No assigned records found for "${selectedHandler}" on this date.`
        : `${shouldIncludeChangesLog ? "2. " : ""}SHEET TASKS: No client records found for this specific date.`,
      margin + 4,
      currentY + 8.5
    );
    return doc;
  }

  // Section Banner for Tasks
  if (currentY > pageHeight - 35) {
    doc.addPage();
    currentY = 20;
  }

  doc.setFillColor(241, 245, 249);
  doc.setDrawColor(203, 213, 225);
  doc.roundedRect(margin, currentY, pageWidth - margin * 2, 8, 1.5, 1.5, "FD");

  doc.setFont("helvetica", "bold");
  doc.setFontSize(9);
  doc.setTextColor(30, 41, 59);
  const secTitle = isHandlerSelected
    ? `ASSIGNED CLIENT REGISTER FOR HANDLER: ${selectedHandler.toUpperCase()} — ${activeLeads.length} ${
        activeLeads.length === 1 ? "Record" : "Records"
      } on ${formattedDateTitle}`
    : shouldIncludeChangesLog
    ? `2. SHEET TASKS & CLIENT REGISTER FOR ${cleanName.toUpperCase()} — ${activeLeads.length} ${
        activeLeads.length === 1 ? "Record" : "Records"
      } on ${formattedDateTitle}`
    : `SHEET TASKS & CLIENT REGISTER FOR ${cleanName.toUpperCase()} — ${activeLeads.length} ${
        activeLeads.length === 1 ? "Record" : "Records"
      } on ${formattedDateTitle}`;
  doc.text(secTitle, margin + 3, currentY + 5.5);

  currentY += 10;

  // Determine if ANY lead in the report has manual notes provided
  const hasAnyManualNotes = activeLeads.some(
    (l) => l.manualNotes && l.manualNotes.trim().length > 0
  );

  // Headers specifically configured to include:
  // Client's name, phone number, email ID, city, month, call status, handler change, and manual notes only if provided
  const tableHeaders = [
    "#",
    "Client Name",
    "Phone Number",
    "Email ID",
    "City",
    "Month",
    "Call Status",
    "Handler Change",
  ];

  if (hasAnyManualNotes) {
    tableHeaders.push("Manual Notes");
  }

  // Helper to format a single lead row with all required columns
  const formatLeadRow = (lead: Lead, index: number): string[] => {
    // 1. Client's name
    const clientName = lead.fullName?.trim() || "Unnamed Client";

    // 2. Phone number
    const phone = lead.phoneNumber?.trim() || "-";

    // 3. Email ID
    const email = lead.email?.trim() || "-";

    // 4. City
    const city = lead.city?.trim() || "-";

    // 5. Month
    const month = lead.month?.trim() || lead.lostYearOrMonth?.trim() || "-";

    // 6. Call status
    const status = lead.status || "Pending Call";

    // 7. Handler change: lookup assignment change in changes, or display current handler assignment
    let handlerChangeStr = "";
    const assignChange = (changes || []).find(
      (c) =>
        c.leadId === lead.id &&
        (c.changeType === "assignment" || c.field === "handlerName" || c.field === "handler")
    );
    if (assignChange) {
      if (assignChange.oldValue && assignChange.newValue && assignChange.oldValue !== assignChange.newValue) {
        handlerChangeStr = `${assignChange.oldValue} → ${assignChange.newValue}`;
      } else if (assignChange.summary) {
        handlerChangeStr = assignChange.summary;
      }
    }
    if (!handlerChangeStr) {
      const isAssigned = isLeadAssignedToHandler(lead, handlers);
      const hName = getLeadHandlerName(lead, handlers);
      if (isAssigned) {
        handlerChangeStr = lead.assignedAt ? `Assigned to ${hName}` : hName;
      } else {
        handlerChangeStr = "Awaiting Assignment";
      }
    }

    const row: string[] = [
      String(index + 1),
      clientName,
      phone,
      email,
      city,
      month,
      status,
      handlerChangeStr,
    ];

    // 8. Manual notes only if provided
    if (hasAnyManualNotes) {
      const manualNote = lead.manualNotes && lead.manualNotes.trim().length > 0
        ? lead.manualNotes.trim()
        : "-";
      row.push(manualNote);
    }

    return row;
  };

  const getTableColumnStyles = (): Record<number, any> => {
    if (hasAnyManualNotes) {
      return {
        0: { cellWidth: 7, halign: "center" as const }, // #
        1: { cellWidth: 36, fontStyle: "bold" as const }, // Client Name
        2: { cellWidth: 28 }, // Phone Number
        3: { cellWidth: 40 }, // Email ID
        4: { cellWidth: 24 }, // City
        5: { cellWidth: 22 }, // Month
        6: { cellWidth: 28, fontStyle: "bold" as const }, // Call Status
        7: { cellWidth: 34, fontStyle: "bold" as const, textColor: [79, 70, 229] as [number, number, number] }, // Handler Change
        8: { cellWidth: 50, fontStyle: "normal" as const, textColor: [51, 65, 85] as [number, number, number] }, // Manual Notes
      };
    }
    return {
      0: { cellWidth: 8, halign: "center" as const }, // #
      1: { cellWidth: 42, fontStyle: "bold" as const }, // Client Name
      2: { cellWidth: 32 }, // Phone Number
      3: { cellWidth: 46 }, // Email ID
      4: { cellWidth: 28 }, // City
      5: { cellWidth: 24 }, // Month
      6: { cellWidth: 32, fontStyle: "bold" as const }, // Call Status
      7: { cellWidth: 40, fontStyle: "bold" as const, textColor: [79, 70, 229] as [number, number, number] }, // Handler Change
    };
  };

  // 4. Render Table:
  // If handler is selected, render ONLY that specific report directly!
  if (isHandlerSelected) {
    const sortedLeads = [...activeLeads].sort((a, b) =>
      (a.fullName || "").localeCompare(b.fullName || "")
    );
    const bodyData = sortedLeads.map((l, i) => formatLeadRow(l, i));

    autoTable(doc, {
      startY: currentY,
      head: [tableHeaders],
      body: bodyData,
      margin: { left: margin, right: margin },
      theme: "grid",
      styles: {
        fontSize: hasAnyManualNotes ? 6.8 : 7.2,
        cellPadding: 1.8,
        overflow: "linebreak",
      },
      headStyles: {
        fillColor: [15, 23, 42],
        textColor: [255, 255, 255],
        fontStyle: "bold",
        fontSize: 7.5,
      },
      alternateRowStyles: {
        fillColor: [248, 250, 252],
      },
      columnStyles: getTableColumnStyles(),
      didDrawPage: () => {
        const totalPages = doc.getNumberOfPages();
        const currentPage = (doc as any).internal.getCurrentPageInfo().pageNumber;
        doc.setFont("helvetica", "normal");
        doc.setFontSize(7.5);
        doc.setTextColor(148, 163, 184);
        doc.text(
          `${companyName} • ${cleanName} (${selectedHandler} Report) • Page ${currentPage} of ${totalPages}`,
          pageWidth / 2,
          pageHeight - 6,
          { align: "center" }
        );
      },
    });

    return doc;
  }

  // When all handlers are in scope, check groupByHandler
  if (groupByHandler) {
    const grouped: Record<string, Lead[]> = {};
    const unassignedGroup: Lead[] = [];

    activeLeads.forEach((lead) => {
      if (isLeadAssignedToHandler(lead, handlers)) {
        const hName = getLeadHandlerName(lead, handlers);
        if (!grouped[hName]) grouped[hName] = [];
        grouped[hName].push(lead);
      } else {
        unassignedGroup.push(lead);
      }
    });

    const sortedHandlerNames = Object.keys(grouped).sort((a, b) => a.localeCompare(b));

    // Render each handler group
    sortedHandlerNames.forEach((handlerName) => {
      const handlerLeads = grouped[handlerName];
      const handlerRecord = handlers.find(
        (h) => h?.name && handlerName && h.name.toLowerCase() === handlerName.toLowerCase()
      );
      const roleText = handlerRecord?.role ? ` (${handlerRecord.role})` : "";

      if (currentY > pageHeight - 35) {
        doc.addPage();
        currentY = 20;
      }

      // Handler Section Banner
      doc.setFillColor(241, 245, 249);
      doc.setDrawColor(203, 213, 225);
      doc.roundedRect(margin, currentY, pageWidth - margin * 2, 8, 1.5, 1.5, "FD");

      doc.setFont("helvetica", "bold");
      doc.setFontSize(9);
      doc.setTextColor(30, 41, 59);
      doc.text(
        `HANDLER: ${handlerName.toUpperCase()}${roleText.toUpperCase()}  —  ${handlerLeads.length} ${
          handlerLeads.length === 1 ? "Record Assigned" : "Records Assigned"
        }`,
        margin + 3,
        currentY + 5.5
      );

      currentY += 10;

      const bodyData = handlerLeads.map((l, i) => formatLeadRow(l, i));

      autoTable(doc, {
        startY: currentY,
        head: [tableHeaders],
        body: bodyData,
        margin: { left: margin, right: margin },
        theme: "grid",
        styles: {
          fontSize: hasAnyManualNotes ? 6.8 : 7.2,
          cellPadding: 1.8,
          overflow: "linebreak",
        },
        headStyles: {
          fillColor: [30, 41, 59],
          textColor: [255, 255, 255],
          fontStyle: "bold",
          fontSize: 7.5,
        },
        alternateRowStyles: {
          fillColor: [248, 250, 252],
        },
        columnStyles: getTableColumnStyles(),
        didDrawPage: () => {
          const totalPages = doc.getNumberOfPages();
          const currentPage = (doc as any).internal.getCurrentPageInfo().pageNumber;
          doc.setFont("helvetica", "normal");
          doc.setFontSize(7.5);
          doc.setTextColor(148, 163, 184);
          doc.text(
            `${companyName} • ${cleanName} Daily Report • Page ${currentPage} of ${totalPages}`,
            pageWidth / 2,
            pageHeight - 6,
            { align: "center" }
          );
        },
      });

      currentY = (doc as any).lastAutoTable.finalY + 8;
    });

    // Render Unassigned / Pending group if any!
    if (unassignedGroup.length > 0) {
      if (currentY > pageHeight - 35) {
        doc.addPage();
        currentY = 20;
      }

      doc.setFillColor(254, 243, 199); // amber-100
      doc.setDrawColor(252, 211, 77); // amber-300
      doc.roundedRect(margin, currentY, pageWidth - margin * 2, 8, 1.5, 1.5, "FD");

      doc.setFont("helvetica", "bold");
      doc.setFontSize(9);
      doc.setTextColor(146, 64, 14); // amber-900
      doc.text(
        `UNASSIGNED / PENDING TASKS FOR ${cleanName.toUpperCase()}  —  ${unassignedGroup.length} ${
          unassignedGroup.length === 1 ? "Record" : "Records"
        } Awaiting Assignment`,
        margin + 3,
        currentY + 5.5
      );

      currentY += 10;

      const bodyData = unassignedGroup.map((l, i) => formatLeadRow(l, i));

      autoTable(doc, {
        startY: currentY,
        head: [tableHeaders],
        body: bodyData,
        margin: { left: margin, right: margin },
        theme: "grid",
        styles: {
          fontSize: hasAnyManualNotes ? 6.8 : 7.2,
          cellPadding: 1.8,
          overflow: "linebreak",
        },
        headStyles: {
          fillColor: [180, 83, 9], // amber-700
          textColor: [255, 255, 255],
          fontStyle: "bold",
          fontSize: 7.5,
        },
        alternateRowStyles: {
          fillColor: [255, 251, 235], // amber-50
        },
        columnStyles: getTableColumnStyles(),
        didDrawPage: () => {
          const totalPages = doc.getNumberOfPages();
          const currentPage = (doc as any).internal.getCurrentPageInfo().pageNumber;
          doc.setFont("helvetica", "normal");
          doc.setFontSize(7.5);
          doc.setTextColor(148, 163, 184);
          doc.text(
            `${companyName} • ${cleanName} Daily Report • Page ${currentPage} of ${totalPages}`,
            pageWidth / 2,
            pageHeight - 6,
            { align: "center" }
          );
        },
      });

      currentY = (doc as any).lastAutoTable.finalY + 8;
    }
  } else {
    // Single unified table sorted by Handler then Person Name
    const sortedLeads = [...activeLeads].sort((a, b) => {
      const hA = getLeadHandlerName(a, handlers);
      const hB = getLeadHandlerName(b, handlers);
      if (hA !== hB) return hA.localeCompare(hB);
      return (a.fullName || "").localeCompare(b.fullName || "");
    });

    const bodyData = sortedLeads.map((l, i) => formatLeadRow(l, i));

    autoTable(doc, {
      startY: currentY,
      head: [tableHeaders],
      body: bodyData,
      margin: { left: margin, right: margin },
      theme: "grid",
      styles: {
        fontSize: hasAnyManualNotes ? 6.8 : 7.2,
        cellPadding: 1.8,
        overflow: "linebreak",
      },
      headStyles: {
        fillColor: [15, 23, 42],
        textColor: [255, 255, 255],
        fontStyle: "bold",
        fontSize: 7.5,
      },
      alternateRowStyles: {
        fillColor: [248, 250, 252],
      },
      columnStyles: getTableColumnStyles(),
      didDrawPage: () => {
        const totalPages = doc.getNumberOfPages();
        const currentPage = (doc as any).internal.getCurrentPageInfo().pageNumber;
        doc.setFont("helvetica", "normal");
        doc.setFontSize(7.5);
        doc.setTextColor(148, 163, 184);
        doc.text(
          `${companyName} • ${cleanName} Daily Report • Page ${currentPage} of ${totalPages}`,
          pageWidth / 2,
          pageHeight - 6,
          { align: "center" }
        );
      },
    });
  }

  return doc;
}

/**
 * Directly downloads the PDF report file to the user's computer.
 * File is named with BOTH the Excel sheet's name and the specific date,
 * e.g. "Sam_2026-10-08_Daily_Report.pdf" or "Jerin_2026-10-08_Daily_Report.pdf"
 * If a handler is selected, it downloads only that handler's report e.g. "Sam_Athira_2026-10-08_Report.pdf"
 */
export function downloadAssignedLeadsPdf(
  leads: Lead[],
  options: PdfReportOptions = {}
): string {
  const doc = generateAssignedLeadsPdf(leads, options);
  const rawDate = options.dateStr || getLocalDateString(0);
  const dateStr = rawDate === "all" ? "All_Dates" : rawDate;
  const isHandlerSelected = Boolean(options.selectedHandler && options.selectedHandler !== "all");
  const fileName = getReportPdfFileName(
    options.sheetName || options.fileName,
    dateStr,
    isHandlerSelected ? options.selectedHandler : "Daily_Report"
  );
  doc.save(fileName);
  return fileName;
}

/**
 * Returns a Blob URL for previewing or printing the PDF report.
 */
export function getAssignedLeadsPdfBlobUrl(
  leads: Lead[],
  options: PdfReportOptions = {}
): string {
  const doc = generateAssignedLeadsPdf(leads, options);
  const blob = doc.output("blob");
  return URL.createObjectURL(blob);
}
