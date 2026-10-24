import Papa from "papaparse";
import * as XLSX from "xlsx";
import { Lead, CallStatus } from "../types";

/**
 * Safely decodes XML numeric and named entities (including code points > 65535 like mathematical bold symbols)
 */
export function decodeXmlEntities(str: string): string {
  if (!str) return "";
  return str
    .replace(/&#(\d+);/g, (_, dec) => {
      try {
        const code = parseInt(dec, 10);
        return String.fromCodePoint ? String.fromCodePoint(code) : String.fromCharCode(code);
      } catch {
        return "";
      }
    })
    .replace(/&#x([0-9a-fA-F]+);/g, (_, hex) => {
      try {
        const code = parseInt(hex, 16);
        return String.fromCodePoint ? String.fromCodePoint(code) : String.fromCharCode(code);
      } catch {
        return "";
      }
    })
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'");
}

/**
 * Normalizes mathematical alphanumeric, bold, script, gothic Unicode symbols
 * to standard clean characters (e.g. 𝗝𝗔𝗜𝗦𝗢𝗡 -> JAISON) while safely preserving
 * international scripts (Malayalam, Hindi, Arabic, Tamil, etc.)
 */
export function cleanStylizedText(text: string): string {
  if (!text) return "";
  try {
    return text.normalize("NFKD").trim();
  } catch {
    return text.trim();
  }
}

/**
 * Determines whether raw text or a file slice is an XML document
 */
export function isXmlSpreadsheet(content: string): boolean {
  if (!content) return false;
  const trimmed = content.trim().slice(0, 1500);
  if (trimmed.startsWith("<?xml")) return true;
  if (
    trimmed.includes("<Workbook") &&
    (trimmed.includes("urn:schemas-microsoft-com:office:spreadsheet") ||
      trimmed.includes("progid=\"Excel.Sheet\"") ||
      trimmed.includes("ss:Workbook"))
  ) {
    return true;
  }
  if (trimmed.includes("<Worksheet") || trimmed.includes("<Table") || trimmed.includes("<Row")) {
    return true;
  }
  return false;
}

/**
 * Clean phone number for tel: protocol URI.
 * Removes spaces, dashes, brackets, keeps leading '+' and digits.
 */
export function formatTelLink(phone: string): string {
  if (!phone) return "";
  const hasPlus = phone.trim().startsWith("+");
  const digits = phone.replace(/\D/g, "");
  return hasPlus ? `tel:+${digits}` : `tel:${digits}`;
}

/**
 * Normalizes input status string into our valid CallStatus enum
 */
export function normalizeStatus(rawStatus?: string): CallStatus {
  if (!rawStatus) return "Requires Follow-up";
  const lower = rawStatus.toLowerCase().trim();
  if (lower.includes("not interested") || lower.includes("dnc") || lower.includes("lost") || lower.includes("declined")) {
    return "Not Interested";
  }
  if (lower.includes("interest") || lower.includes("attend") || lower.includes("connect") || lower.includes("answered") || lower.includes("completed") || lower.includes("positive")) {
    return "Interested";
  }
  if (lower.includes("follow") || lower.includes("callback") || lower.includes("scheduled")) {
    return "Requires Follow-up";
  }
  if (lower.includes("no answer") || lower.includes("busy") || lower.includes("voicemail")) {
    return "No Answer";
  }
  if (lower.includes("pending") || lower.includes("new") || lower.includes("open") || lower.includes("not called")) {
    return "Pending Call";
  }
  return "Requires Follow-up";
}

/**
 * Extracts month and year or standardizes month name
 */
export function extractMonth(rawDate?: string): string {
  if (!rawDate || !rawDate.trim()) return "Not specified";
  const str = rawDate.trim();

  // Excel serial date number (e.g. 45210)
  if (/^\d{5}$/.test(str)) {
    try {
      const parsedDate = new Date((parseInt(str, 10) - 25569) * 86400 * 1000);
      if (!isNaN(parsedDate.getTime())) {
        const monthNames = [
          "January", "February", "March", "April", "May", "June",
          "July", "August", "September", "October", "November", "December"
        ];
        return `${monthNames[parsedDate.getMonth()]} ${parsedDate.getFullYear()}`;
      }
    } catch (_) {
      // ignore
    }
  }

  // Already standard formatted e.g. "October 2023", "March", "2024-05"
  if (/^[A-Za-z]+\s+\d{4}$/.test(str)) return str;
  if (/^\d{4}$/.test(str)) return str;

  // Try parsing ISO or standard date formats
  const dateObj = new Date(str);
  if (!isNaN(dateObj.getTime()) && !/^\d+$/.test(str)) {
    const monthNames = [
      "January", "February", "March", "April", "May", "June",
      "July", "August", "September", "October", "November", "December"
    ];
    return `${monthNames[dateObj.getMonth()]} ${dateObj.getFullYear()}`;
  }

  // Regex for month name and optional year
  const monthMatch = str.match(/\b(Jan(?:uary)?|Feb(?:ruary)?|Mar(?:ch)?|Apr(?:il)?|May|Jun(?:e)?|Jul(?:y)?|Aug(?:ust)?|Sep(?:tember)?|Oct(?:ober)?|Nov(?:ember)?|Dec(?:ember)?)\b/i);
  const yearMatch = str.match(/\b(19\d\d|20\d\d)\b/);

  if (monthMatch && yearMatch) {
    return `${monthMatch[0]} ${yearMatch[0]}`;
  }
  if (monthMatch) {
    return monthMatch[0];
  }
  if (yearMatch) {
    return yearMatch[0];
  }

  return str;
}

/**
 * Normalizes rows extracted from Excel or CSV with smart header fuzzy matching
 */
function normalizeRowData(
  row: Record<string, any>,
  index: number,
  meta?: { uploadDate?: string; uploadedFileName?: string; fileId?: string }
): Lead {
  const keys = Object.keys(row);

  // Helper to find value from fuzzy pattern list
  const findValue = (patterns: string[]): string => {
    for (const pattern of patterns) {
      const cleanPattern = pattern.replace(/[^a-z0-9]/g, "");
      const matchingKey = keys.find((k) => {
        const cleanK = (k || "").toLowerCase().replace(/[^a-z0-9]/g, "");
        return cleanK === cleanPattern || cleanK.includes(cleanPattern);
      });
      if (matchingKey && row[matchingKey] !== undefined && row[matchingKey] !== null) {
        const val = String(row[matchingKey]).trim();
        if (val !== "") return val;
      }
    }
    return "";
  };

  // 1. Payment Receipt (Bypassed & excluded as per user specification)
  const paymentReceipt = "";
  const proof = "";

  // 2. Month (Month of payment or loss)
  const rawMonth = findValue([
    "month", "payment month", "billing month", "lost month", "period", "lost year", "year", "date", "payment date", "loss date",
    "registration date", "created date", "join date"
  ]);
  let month = extractMonth(rawMonth);
  if ((!month || month === "Not specified") && meta?.uploadDate) {
    month = extractMonth(meta.uploadDate);
  }

  // 5. Phone Number
  let phoneNumber = findValue([
    "phone number", "phonenumber", "phone", "phone no", "ph no", "mobile", "mobile number", "mobile no", "mob no",
    "contact number", "contact no", "contact", "cell", "cell no", "cell phone", "tel", "tel no", "telephone",
    "whatsapp", "whatsapp number", "wa no", "calling number", "call no", "call"
  ]);

  // Clean trailing decimal zero from Excel numbers like 9876543210.0
  if (phoneNumber) {
    phoneNumber = phoneNumber.replace(/\.0+$/, "").trim();
  }

  // 6. Email ID
  let email = findValue([
    "email id", "email_id", "emailid", "email address", "e-mail", "e-mail id", "email", "mail", "mail id"
  ]);

  // 4. Full Name (with Unicode stylized font cleaning and First/Last name joining)
  const firstName = findValue(["first name", "firstname", "first", "fname", "given name"]);
  const lastName = findValue(["last name", "lastname", "last", "lname", "surname", "family name"]);
  let rawFullName = "";

  if (firstName || lastName) {
    rawFullName = [firstName, lastName].filter(Boolean).join(" ");
  }
  if (!rawFullName) {
    rawFullName = findValue([
      "full name", "fullname", "name", "contact name", "customer name", "client name",
      "customer", "client", "contact", "lead", "person", "candidate name", "student name", "caller"
    ]);
  }
  let fullName = cleanStylizedText(rawFullName);

  // Heuristic fallbacks for sheets with non-standard headers (e.g. Column_1, Column_2)
  if (!phoneNumber) {
    for (const k of keys) {
      const v = String(row[k] || "").trim().replace(/\.0+$/, "");
      const digits = v.replace(/\D/g, "");
      if (digits.length >= 7 && digits.length <= 15 && (/^(\+?\d[\d\s-]{6,16}\d)$/.test(v) || /^\d{10,12}$/.test(digits))) {
        phoneNumber = v;
        break;
      }
    }
  }

  if (!email) {
    for (const k of keys) {
      const v = String(row[k] || "").trim();
      if (/^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/.test(v)) {
        email = v;
        break;
      }
    }
  }

  // If fullName is missing, or is purely numeric digits (like an unformatted phone), format it
  if (!fullName || fullName.length < 2) {
    // Check if any text column contains a human name
    for (const k of keys) {
      const v = String(row[k] || "").trim();
      if (
        /^[A-Za-z\u00C0-\u024F\u0900-\u0D7F\s.'-]{3,35}$/.test(v) &&
        v.includes(" ") &&
        !v.includes("@") &&
        v !== month &&
        v !== paymentReceipt &&
        v.toLowerCase() !== "pending" &&
        v.toLowerCase() !== "unknown"
      ) {
        fullName = cleanStylizedText(v);
        break;
      }
    }
    if (!fullName) {
      fullName = `Lead #${index + 1}`;
    }
  } else if (/^\+?\d{7,15}$/.test(fullName.trim()) && email && email.includes("@")) {
    const emailPrefix = email.split("@")[0].replace(/[0-9._-]+/g, " ").trim();
    if (emailPrefix.length >= 2) {
      const formattedName = emailPrefix
        .split(" ")
        .filter(Boolean)
        .map((word) => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
        .join(" ");
      fullName = `${formattedName} (${fullName.trim()})`;
    }
  }

  // 7. City
  const rawCity = findValue([
    "city", "town", "metro", "location", "state", "place", "address", "district", "area", "region", "branch"
  ]);
  const city = cleanStylizedText(rawCity) || "Unknown";

  // 8. Status
  const rawStatus = findValue([
    "status", "call status", "call_status", "disposition", "stage", "attendance", "outcome", "lead status"
  ]);
  const status = normalizeStatus(rawStatus);

  // 9. Dedicated Imported Notes
  const notes = findValue([
    "notes", "note", "remarks", "remark", "comment", "comments", "description", "reason", "loss reason", "feedback", "details"
  ]);

  // 10. Additional Column for Manual Notes (manual entry for each client)
  const manualNotes = findValue([
    "manual notes", "manual note", "manual entry", "manual", "client notes", "staff notes", "agent notes", "my notes", "user notes", "caller notes"
  ]);

  // 11. Handler (Caller / Account Specialist)
  const handlerName = findValue([
    "handler", "handlers", "assigned to", "assignee", "agent", "caller", "owner", "rep", "representative", "staff", "handle by", "handled by", "specialist"
  ]) || "";

  // 12. Payment Date, Method, and Completion Status
  const rawPaymentDate = findValue([
    "payment date", "paid date", "payment_date", "pay date", "transaction date", "txn date"
  ]);
  const rawPaymentMethod = findValue([
    "payment method", "payment_method", "payment mode", "pay mode", "pay method", "method"
  ]);
  const rawCompletionStatus = findValue([
    "completion status", "completion_status", "job status", "fulfillment status", "work status"
  ]);

  const finalNotes = notes
    ? cleanStylizedText(notes)
    : `Imported from ${meta?.uploadedFileName || "file"}`;

  const isAssigned = Boolean(
    handlerName &&
    handlerName.trim() !== "" &&
    handlerName.toLowerCase() !== "unassigned" &&
    handlerName.toLowerCase() !== "none" &&
    handlerName.toLowerCase() !== "not assigned"
  );

  const isInterested = status === "Interested";
  const defaultPaymentDate = rawPaymentDate || (isInterested ? (meta?.uploadDate || new Date().toISOString().slice(0, 10)) : undefined);
  const defaultPaymentMethod = rawPaymentMethod || (isInterested ? "Card" : undefined);
  const defaultCompletionStatus = (rawCompletionStatus as any) || (isInterested ? "Pending" : undefined);

  return {
    id: `lead-xl-${Date.now()}-${index}-${Math.random().toString(36).slice(2, 7)}`,
    paymentReceipt,
    proof,
    month,
    lostYearOrMonth: month,
    fullName,
    phoneNumber,
    email,
    city,
    status,
    paymentDate: defaultPaymentDate,
    paymentMethod: defaultPaymentMethod,
    completionStatus: defaultCompletionStatus,
    completedAt: defaultCompletionStatus === "Completed" ? new Date().toISOString() : undefined,
    handlerName: isAssigned ? handlerName.trim() : "",
    assignmentCategory: isAssigned ? "assigned" : "unassigned",
    assignedAt: isAssigned ? new Date().toISOString() : undefined,
    reportDate: isAssigned ? (meta?.uploadDate || new Date().toISOString().slice(0, 10)) : undefined,
    isPostCutoffRollover: false,
    notes: finalNotes,
    manualNotes: manualNotes ? cleanStylizedText(manualNotes) : "",
    createdAt: new Date().toISOString(),
    callCount: 0,
    uploadDate: meta?.uploadDate,
    uploadedFileName: meta?.uploadedFileName,
    fileId: meta?.fileId,
  };
}

/**
 * Helper to identify whether a cell value looks like a genuine phone number
 */
export function isLikelyPhoneCell(val: any): boolean {
  if (val === undefined || val === null) return false;
  const s = String(val).trim();
  const digits = s.replace(/\D/g, "");
  return digits.length >= 7 && digits.length <= 15 && (/^\+?\d/.test(s) || /^\d+$/.test(digits));
}

/**
 * Helper to identify whether a cell value looks like an email address
 */
export function isLikelyEmailCell(val: any): boolean {
  if (val === undefined || val === null) return false;
  const s = String(val).trim();
  return /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/.test(s);
}

/**
 * Robust check if a row is a true column header row vs a client data row
 */
export function isLikelyHeaderRow(row: any[]): boolean {
  if (!Array.isArray(row) || row.length === 0) return false;
  // If row contains genuine client contact info, it is definitely a client data row!
  if (row.some((cell) => isLikelyPhoneCell(cell) || isLikelyEmailCell(cell))) {
    return false;
  }

  const headerKeywords = [
    "name", "full name", "first name", "last name", "client", "customer", "lead", "person", "caller", "candidate", "student",
    "phone", "mobile", "contact", "cell", "tel", "whatsapp",
    "email", "mail", "email id",
    "city", "town", "district", "state", "location", "address", "place", "region",
    "receipt", "invoice", "payment", "utr", "txn", "proof", "voucher", "slip",
    "month", "year", "date", "period", "status", "notes", "remarks", "handler", "agent", "sl.no", "sl no", "s.no", "no"
  ];

  let matchCount = 0;
  for (const cell of row) {
    const text = String(cell || "").toLowerCase().replace(/[^a-z0-9]/g, " ").trim();
    if (!text || text.length > 35) continue;
    // Check if cell equals or starts/ends with a header keyword
    const isKw = headerKeywords.some(
      (kw) => text === kw || text === kw.replace(/\s+/g, "") || text.startsWith(kw + " ") || text.endsWith(" " + kw)
    );
    if (isKw) {
      matchCount++;
    }
  }

  // Must match at least 2 distinct header column titles to be considered a genuine header row
  return matchCount >= 2;
}

/**
 * Parses Microsoft Excel XML Spreadsheet 2003 (SpreadsheetML) from a DOM Document
 */
function parseSpreadsheetMlDoc(doc: Document): Record<string, any>[] {
  const allElements = doc.getElementsByTagName("*");
  const rows: Element[] = [];
  for (let i = 0; i < allElements.length; i++) {
    if ((allElements[i].localName || "").toLowerCase() === "row") {
      rows.push(allElements[i]);
    }
  }

  if (rows.length === 0) return [];

  const tableData: string[][] = [];

  for (const row of rows) {
    const rowCells: string[] = [];
    let currentColIdx = 0;

    for (let c = 0; c < row.children.length; c++) {
      const cellEl = row.children[c];
      if ((cellEl.localName || "").toLowerCase() !== "cell") continue;

      const indexAttr =
        cellEl.getAttribute("ss:Index") ||
        cellEl.getAttributeNS("urn:schemas-microsoft-com:office:spreadsheet", "Index") ||
        cellEl.getAttribute("Index");

      if (indexAttr) {
        const targetIdx = parseInt(indexAttr, 10) - 1;
        if (!isNaN(targetIdx) && targetIdx >= currentColIdx) {
          currentColIdx = targetIdx;
        }
      }

      let cellText = "";
      const dataChild = Array.from(cellEl.children).find(
        (child) => (child.localName || "").toLowerCase() === "data"
      );

      if (dataChild) {
        cellText = dataChild.textContent || "";
      } else {
        cellText = cellEl.textContent || "";
      }

      rowCells[currentColIdx] = cleanStylizedText(cellText);
      currentColIdx++;
    }

    if (rowCells.some((val) => val && val.length > 0)) {
      tableData.push(rowCells);
    }
  }

  if (tableData.length === 0) return [];

  // Identify Header Row - A real header row NEVER contains client phone numbers or email addresses and matches >= 2 column headers
  let headerRowIdx = -1;
  for (let r = 0; r < Math.min(tableData.length, 10); r++) {
    if (isLikelyHeaderRow(tableData[r])) {
      headerRowIdx = r;
      break;
    }
  }

  const maxCols = Math.max(...tableData.map((r) => r.length), 1);
  let headers: string[] = [];
  let startRow = 0;

  if (headerRowIdx >= 0) {
    const rawHeaders = tableData[headerRowIdx] || [];
    headers = Array.from({ length: maxCols }, (_, i) => {
      const clean = cleanStylizedText(String(rawHeaders[i] || "")).trim();
      return clean || `Column_${i + 1}`;
    });
    startRow = headerRowIdx + 1;
  } else {
    // No header row exists: All rows (including Row 0) are valid client data rows
    headers = Array.from({ length: maxCols }, (_, i) => `Column_${i + 1}`);
    startRow = 0;
  }

  const records: Record<string, any>[] = [];
  for (let r = startRow; r < tableData.length; r++) {
    const row = tableData[r];
    const record: Record<string, any> = {};
    let hasData = false;

    for (let c = 0; c < headers.length; c++) {
      const headerKey = headers[c];
      const val = row[c] !== undefined ? row[c] : "";
      record[headerKey] = val;
      if (val) hasData = true;
    }

    if (hasData) {
      records.push(record);
    }
  }

  return records;
}

/**
 * Regex-based tokenizer fallback for Excel XML Spreadsheet 2003 (SpreadsheetML)
 */
function parseSpreadsheetMlWithRegex(decodedXml: string): Record<string, any>[] {
  const rowRegex = /<Row\b[^>]*>([\s\S]*?)<\/Row>/gi;
  const cellRegex = /<Cell\b([^>]*)>([\s\S]*?)<\/Cell>|<Cell\b([^>]*)\/>/gi;
  const dataRegex = /<Data\b[^>]*>([\s\S]*?)<\/Data>/i;

  const allRows: string[][] = [];
  let rowMatch: RegExpExecArray | null;

  while ((rowMatch = rowRegex.exec(decodedXml)) !== null) {
    const rowContent = rowMatch[1];
    const cells: string[] = [];
    let colIdx = 0;

    let cellMatch: RegExpExecArray | null;
    while ((cellMatch = cellRegex.exec(rowContent)) !== null) {
      const attrs = cellMatch[1] || cellMatch[3] || "";
      const cellBody = cellMatch[2] || "";

      const indexMatch =
        attrs.match(/\bss:Index\s*=\s*["'](\d+)["']/i) ||
        attrs.match(/\bIndex\s*=\s*["'](\d+)["']/i);

      if (indexMatch) {
        const targetIdx = parseInt(indexMatch[1], 10) - 1;
        if (!isNaN(targetIdx) && targetIdx >= colIdx) {
          colIdx = targetIdx;
        }
      }

      let val = "";
      const dataMatch = cellBody.match(dataRegex);
      if (dataMatch) {
        val = dataMatch[1].replace(/<[^>]+>/g, "").trim();
      } else {
        val = cellBody.replace(/<[^>]+>/g, "").trim();
      }

      cells[colIdx] = cleanStylizedText(val);
      colIdx++;
    }

    if (cells.some((c) => c && c.length > 0)) {
      allRows.push(cells);
    }
  }

  if (allRows.length === 0) return [];

  // Identify Header Row safely without dropping client rows
  let headerRowIdx = -1;
  for (let r = 0; r < Math.min(allRows.length, 10); r++) {
    if (isLikelyHeaderRow(allRows[r])) {
      headerRowIdx = r;
      break;
    }
  }

  const maxCols = Math.max(...allRows.map((r) => r.length), 1);
  let headers: string[] = [];
  let startRow = 0;

  if (headerRowIdx >= 0) {
    const rawHeaders = allRows[headerRowIdx] || [];
    headers = Array.from({ length: maxCols }, (_, i) => {
      const clean = cleanStylizedText(String(rawHeaders[i] || "")).trim();
      return clean || `Column_${i + 1}`;
    });
    startRow = headerRowIdx + 1;
  } else {
    // No header row found: Start from row 0 so no client is omitted
    headers = Array.from({ length: maxCols }, (_, i) => `Column_${i + 1}`);
    startRow = 0;
  }

  const records: Record<string, any>[] = [];
  for (let r = startRow; r < allRows.length; r++) {
    const row = allRows[r];
    const record: Record<string, any> = {};
    let hasData = false;

    for (let c = 0; c < headers.length; c++) {
      const key = headers[c];
      const val = row[c] !== undefined ? row[c] : "";
      record[key] = val;
      if (val) hasData = true;
    }

    if (hasData) {
      records.push(record);
    }
  }

  return records;
}

/**
 * Generic XML DOM parser for <lead>, <row>, <person>, <item>, <record> tags
 */
function parseGenericXmlDoc(doc: Document): Record<string, any>[] {
  const candidateTagNames = ["lead", "record", "row", "item", "person", "contact", "entry", "client"];
  let recordNodes: Element[] = [];

  for (const tag of candidateTagNames) {
    const elements = doc.getElementsByTagName(tag);
    if (elements.length > 0) {
      recordNodes = Array.from(elements);
      break;
    }
  }

  if (recordNodes.length === 0) {
    const root = doc.documentElement;
    if (root && root.children.length > 0) {
      const firstChild = root.children[0];
      if (firstChild.children.length > 0) {
        recordNodes = Array.from(root.children);
      }
    }
  }

  if (recordNodes.length === 0) return [];

  const results: Record<string, any>[] = [];
  for (const node of recordNodes) {
    const rec: Record<string, any> = {};
    let hasData = false;

    for (let i = 0; i < node.children.length; i++) {
      const child = node.children[i];
      const key = (child.localName || "").toLowerCase();
      const val = cleanStylizedText(child.textContent || "");
      rec[key] = val;
      if (val) hasData = true;
    }

    if (hasData) {
      results.push(rec);
    }
  }

  return results;
}

/**
 * Generic XML Regex parser
 */
function parseGenericXmlWithRegex(decodedXml: string): Record<string, any>[] {
  const candidateTagNames = ["lead", "record", "person", "contact", "entry", "item", "client"];
  for (const tag of candidateTagNames) {
    const itemRegex = new RegExp(`<${tag}\\b[^>]*>([\\s\\S]*?)<\\/${tag}>`, "gi");
    const matches: string[] = [];
    let m: RegExpExecArray | null;
    while ((m = itemRegex.exec(decodedXml)) !== null) {
      matches.push(m[1]);
    }
    if (matches.length > 0) {
      const records: Record<string, any>[] = [];
      const fieldRegex = /<([A-Za-z0-9_-]+)\b[^>]*>([\s\S]*?)<\/\1>/gi;
      for (const itemXml of matches) {
        const rec: Record<string, any> = {};
        let fMatch: RegExpExecArray | null;
        let hasData = false;
        while ((fMatch = fieldRegex.exec(itemXml)) !== null) {
          const key = fMatch[1].toLowerCase();
          const val = cleanStylizedText(fMatch[2].replace(/<[^>]+>/g, "").trim());
          rec[key] = val;
          if (val) hasData = true;
        }
        if (hasData) records.push(rec);
      }
      if (records.length > 0) return records;
    }
  }
  return [];
}

/**
 * Parses an Excel XML Spreadsheet (.xml, SpreadsheetML) into standard Lead records
 */
export function parseXmlSpreadsheet(
  xmlText: string,
  meta?: { uploadDate?: string; uploadedFileName?: string; fileId?: string }
): Lead[] {
  // Decode XML numeric and named entities
  const decoded = decodeXmlEntities(xmlText);

  let rawRows: Record<string, any>[] = [];

  // Try Browser DOMParser first
  if (typeof DOMParser !== "undefined") {
    try {
      const parser = new DOMParser();
      const doc = parser.parseFromString(decoded, "text/xml");
      const parseError = doc.querySelector("parsererror");
      if (!parseError) {
        rawRows = parseSpreadsheetMlDoc(doc);
        if (rawRows.length === 0) {
          rawRows = parseGenericXmlDoc(doc);
        }
      }
    } catch (_) {
      // Fall through to regex tokenizer fallback
    }
  }

  // Fallback to regex tokenizer if DOMParser produced 0 rows or is unavailable
  if (!rawRows || rawRows.length === 0) {
    rawRows = parseSpreadsheetMlWithRegex(decoded);
    if (rawRows.length === 0) {
      rawRows = parseGenericXmlWithRegex(decoded);
    }
  }

  if (!rawRows || rawRows.length === 0) {
    throw new Error("No data rows found in the uploaded XML spreadsheet.");
  }

  const fileMeta = {
    uploadDate: meta?.uploadDate,
    uploadedFileName: meta?.uploadedFileName || "Spreadsheet.xml",
    fileId: meta?.fileId,
  };

  return rawRows.map((row, index) => normalizeRowData(row, index, fileMeta));
}

/**
 * Automatically analyze and parse Excel (.xlsx, .xls, .xml) files into Lead records
 */
export async function parseExcelFile(
  file: File,
  meta?: { uploadDate?: string; uploadedFileName?: string; fileId?: string }
): Promise<Lead[]> {
  // Check if this file is an XML spreadsheet (e.g. <?xml or <Workbook)
  try {
    const headerSlice = await file.slice(0, 1500).text();
    if (isXmlSpreadsheet(headerSlice)) {
      const fullXml = await file.text();
      return parseXmlSpreadsheet(fullXml, meta);
    }
  } catch (_) {
    // Continue to standard XLSX binary parse
  }

  const arrayBuffer = await file.arrayBuffer();
  const workbook = XLSX.read(arrayBuffer, { type: "array", cellDates: true });

  if (!workbook.SheetNames || workbook.SheetNames.length === 0) {
    throw new Error("The uploaded Excel workbook contains no sheets.");
  }

  const fileMeta = {
    uploadDate: meta?.uploadDate,
    uploadedFileName: meta?.uploadedFileName || file.name,
    fileId: meta?.fileId,
  };

  // Inspect all sheets in the workbook and extract lead data rows
  let allExtractedRecords: Record<string, any>[] = [];

  const headerKeywords = [
    "name", "full name", "first name", "last name", "customer", "client", "student", "candidate", "caller", "lead", "person",
    "phone", "mobile", "contact", "tel", "cell", "whatsapp",
    "email", "mail", "email id",
    "city", "town", "location", "place", "district", "state", "address",
    "receipt", "invoice", "payment", "transaction", "txn", "utr", "proof", "slip",
    "month", "year", "date", "status", "notes", "remarks", "handler", "agent"
  ];

  for (const sheetName of workbook.SheetNames) {
    const worksheet = workbook.Sheets[sheetName];
    if (!worksheet) continue;

    // Convert sheet to 2D array of rows
    const grid: any[][] = XLSX.utils.sheet_to_json(worksheet, {
      header: 1,
      defval: "",
      blankrows: false,
    });

    if (!grid || grid.length === 0) continue;

    // Search top 25 rows for a genuine header row
    let bestHeaderIdx = -1;
    let highestScore = 0;

    for (let r = 0; r < Math.min(grid.length, 25); r++) {
      const row = grid[r];
      if (!Array.isArray(row)) continue;

      if (!isLikelyHeaderRow(row)) {
        continue;
      }

      let score = 0;
      for (const cell of row) {
        const text = String(cell || "").toLowerCase().replace(/[^a-z0-9]/g, " ").trim();
        if (!text || text.length > 35) continue;
        for (const kw of headerKeywords) {
          if (text === kw || text.startsWith(kw + " ") || text.endsWith(" " + kw)) {
            score++;
            break;
          }
        }
      }
      if (score > highestScore && score >= 2) {
        highestScore = score;
        bestHeaderIdx = r;
      }
    }

    const maxCols = Math.max(
      ...grid.map((r) => (Array.isArray(r) ? r.length : 0)),
      1
    );

    let headers: string[] = [];
    let startRow = 0;

    if (bestHeaderIdx >= 0 && highestScore > 0) {
      const rawHeaderRow = grid[bestHeaderIdx] || [];
      headers = Array.from({ length: maxCols }, (_, i) => {
        const clean = cleanStylizedText(String(rawHeaderRow[i] || "")).trim();
        return clean || `Column_${i + 1}`;
      });
      startRow = bestHeaderIdx + 1;
    } else {
      // No header row found: Start from row 0 so no client is omitted
      headers = Array.from({ length: maxCols }, (_, i) => `Column_${i + 1}`);
      startRow = 0;
    }

    const sheetRecords: Record<string, any>[] = [];
    for (let r = startRow; r < grid.length; r++) {
      const row = grid[r];
      if (!Array.isArray(row)) continue;
      const record: Record<string, any> = {};
      let hasData = false;

      for (let c = 0; c < headers.length; c++) {
        const key = headers[c];
        let val = row[c] !== undefined && row[c] !== null ? row[c] : "";
        if (val instanceof Date) {
          val = val.toISOString().slice(0, 10);
        } else if (typeof val === "number") {
          val = String(val).replace(/\.0+$/, "");
        } else {
          val = cleanStylizedText(String(val)).trim();
        }
        record[key] = val;
        if (val) hasData = true;
      }

      if (hasData) {
        sheetRecords.push(record);
      }
    }

    if (sheetRecords.length > 0) {
      allExtractedRecords = [...allExtractedRecords, ...sheetRecords];
    }
  }

  // Fallback if grid parsing produced nothing
  if (allExtractedRecords.length === 0) {
    const sheetName = workbook.SheetNames[0];
    const worksheet = workbook.Sheets[sheetName];
    const fallbackRows = XLSX.utils.sheet_to_json<Record<string, any>>(worksheet, { defval: "", raw: false });
    if (fallbackRows && fallbackRows.length > 0) {
      allExtractedRecords = fallbackRows;
    }
  }

  if (!allExtractedRecords || allExtractedRecords.length === 0) {
    throw new Error("No data rows found in the uploaded Excel sheet. Please make sure the sheet contains lead data.");
  }

  return allExtractedRecords.map((row, index) => normalizeRowData(row, index, fileMeta));
}

/**
 * Parse CSV / TSV text client-side with smart header matching
 */
export function parseCsvLeads(
  csvText: string,
  meta?: { uploadDate?: string; uploadedFileName?: string; fileId?: string }
): Lead[] {
  const result = Papa.parse<Record<string, string>>(csvText, {
    header: true,
    skipEmptyLines: true,
    transformHeader: (header) => header.trim().toLowerCase(),
  });

  if (!result.data || result.data.length === 0) {
    return [];
  }

  return result.data.map((row, index) => normalizeRowData(row, index, meta));
}

/**
 * Export current leads back to clean CSV with all requested fields
 */
export function exportLeadsToCsv(leads: Lead[]): void {
  const exportData = leads.map((l) => ({
    "Full Name": l.fullName,
    "Phone Number": l.phoneNumber,
    "Email ID": l.email,
    "City": l.city,
    "Month": l.month || l.lostYearOrMonth || "Not specified",
    "Call Status": l.status,
    "Payment Date": l.paymentDate || "",
    "Payment Method": l.paymentMethod || "",
    "Completion Status": l.completionStatus || "",
    "Handler": l.handlerName || "Unassigned",
    "Imported Notes": l.notes,
    "Manual Notes": l.manualNotes || "",
    "Call Count": l.callCount || 0,
    "Last Dialed": l.lastDialedAt ? new Date(l.lastDialedAt).toLocaleString() : "Never",
  }));

  const csv = Papa.unparse(exportData);
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.setAttribute("href", url);
  link.setAttribute("download", `lead_records_${new Date().toISOString().slice(0, 10)}.csv`);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

/**
 * Export leads to genuine Excel (.xlsx) file
 */
export function exportLeadsToExcel(leads: Lead[]): void {
  const exportData = leads.map((l) => ({
    "Full Name": l.fullName,
    "Phone Number": l.phoneNumber,
    "Email ID": l.email,
    "City": l.city,
    "Month": l.month || l.lostYearOrMonth || "Not specified",
    "Call Status": l.status,
    "Payment Date": l.paymentDate || "",
    "Payment Method": l.paymentMethod || "",
    "Completion Status": l.completionStatus || "",
    "Handler": l.handlerName || "Unassigned",
    "Imported Notes": l.notes,
    "Manual Notes": l.manualNotes || "",
    "Call Count": l.callCount || 0,
    "Last Dialed": l.lastDialedAt ? new Date(l.lastDialedAt).toLocaleString() : "Never",
  }));

  const worksheet = XLSX.utils.json_to_sheet(exportData);
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, "Leads & Payments");
  XLSX.writeFile(workbook, `leads_and_payments_${new Date().toISOString().slice(0, 10)}.xlsx`);
}
