/**
 * Date utility helpers for organizing files and leads by day
 */

export function getLocalDateString(offsetDays: number = 0): string {
  const d = new Date();
  d.setDate(d.getDate() + offsetDays);
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

export function formatTimeFromIso(isoString?: string): string {
  if (!isoString) return "";
  try {
    const d = new Date(isoString);
    if (isNaN(d.getTime())) return "";
    return d.toLocaleTimeString("en-US", {
      hour: "numeric",
      minute: "2-digit",
      hour12: true,
    });
  } catch {
    return "";
  }
}

export interface DayInfo {
  label: string;
  subLabel: string;
  isToday: boolean;
  isTomorrow: boolean;
  isYesterday: boolean;
}

export function formatUploadDayLabel(dateStr: string): DayInfo {
  if (dateStr === "all") {
    return {
      label: "All Recorded Dates",
      subLabel: "All Recorded Dates",
      isToday: false,
      isTomorrow: false,
      isYesterday: false,
    };
  }

  const todayStr = getLocalDateString(0);
  const tomorrowStr = getLocalDateString(1);
  const yesterdayStr = getLocalDateString(-1);

  const parts = dateStr.split("-").map(Number);
  let dateObj: Date;
  if (parts.length === 3) {
    dateObj = new Date(parts[0], parts[1] - 1, parts[2]);
  } else {
    dateObj = new Date(dateStr);
  }

  const formattedDate = !isNaN(dateObj.getTime())
    ? dateObj.toLocaleDateString("en-US", {
        weekday: "short",
        month: "short",
        day: "numeric",
        year: "numeric",
      })
    : dateStr;

  if (dateStr === todayStr) {
    return {
      label: "Today",
      subLabel: formattedDate,
      isToday: true,
      isTomorrow: false,
      isYesterday: false,
    };
  }
  if (dateStr === tomorrowStr) {
    return {
      label: "Tomorrow",
      subLabel: formattedDate,
      isToday: false,
      isTomorrow: true,
      isYesterday: false,
    };
  }
  if (dateStr === yesterdayStr) {
    return {
      label: "Yesterday",
      subLabel: formattedDate,
      isToday: false,
      isTomorrow: false,
      isYesterday: true,
    };
  }

  return {
    label: formattedDate,
    subLabel: "",
    isToday: false,
    isTomorrow: false,
    isYesterday: false,
  };
}

/**
 * Assignment Reporting Logic Helpers (No 11 PM cutoff restriction)
 */
export const DEFAULT_CUTOFF_HOUR = 23; // Kept for backward compatibility

/**
 * Format a 24-hour number into 12-hour AM/PM string, e.g. 23 -> "11:00 PM"
 */
export function formatCutoffHourLabel(hour: number = DEFAULT_CUTOFF_HOUR): string {
  const normalized = Math.max(0, Math.min(23, Math.floor(hour)));
  const period = normalized >= 12 ? "PM" : "AM";
  const displayHour = normalized % 12 === 0 ? 12 : normalized % 12;
  return `${displayHour}:00 ${period}`;
}

/**
 * Checks whether a given timestamp occurred after a given hour.
 * Note: Cutoff restrictions are disabled for PDF report generation.
 */
export function isProcessedAfterCutoff(
  _timestamp?: string | Date,
  _cutoffHour: number = DEFAULT_CUTOFF_HOUR
): boolean {
  // Daily time restrictions have been removed
  return false;
}

/**
 * Given a timestamp, determines which calendar date report it belongs to.
 * All assignments compile directly into the daily report for that calendar date
 * without any 11 PM cutoff or daily time restrictions.
 */
export function getReportDateForTimestamp(
  timestamp?: string | Date,
  _cutoffHour?: number
): string {
  if (!timestamp) {
    return getLocalDateString(0);
  }

  if (typeof timestamp === "string") {
    const trimmed = timestamp.trim();
    // If it's already in YYYY-MM-DD format, return directly to prevent UTC midnight parsing shift!
    if (/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) {
      return trimmed;
    }
  }

  const d =
    typeof timestamp === "string"
      ? new Date(timestamp)
      : new Date(timestamp.getTime());

  if (isNaN(d.getTime())) {
    return getLocalDateString(0);
  }

  // Compile directly into local calendar date
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

/**
 * Returns previous day in YYYY-MM-DD
 */
export function getPreviousDayString(dateStr: string): string {
  const parts = dateStr.split("-").map(Number);
  const d = parts.length === 3 ? new Date(parts[0], parts[1] - 1, parts[2]) : new Date(dateStr);
  d.setDate(d.getDate() - 1);
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

/**
 * Returns next day in YYYY-MM-DD
 */
export function getNextDayString(dateStr: string): string {
  const parts = dateStr.split("-").map(Number);
  const d = parts.length === 3 ? new Date(parts[0], parts[1] - 1, parts[2]) : new Date(dateStr);
  d.setDate(d.getDate() + 1);
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

/**
 * Returns descriptive string of the reporting window for a date.
 * Full 24-hour day without cutoff restrictions.
 */
export function getCutoffReportingWindow(
  dateStr: string,
  _cutoffHour?: number
): { fromStr: string; toStr: string; label: string } {
  const targetInfo = formatUploadDayLabel(dateStr);
  const targetText = targetInfo.subLabel || dateStr;

  return {
    fromStr: `${dateStr} 12:00 AM`,
    toStr: `${dateStr} 11:59 PM`,
    label: `${targetText} (Full Calendar Day - No Cutoff Restrictions)`,
  };
}
