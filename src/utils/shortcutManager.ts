import { ShortcutActionId, ShortcutDefinition } from "../types/shortcuts";

export const SHORTCUTS_STORAGE_KEY = "leads_tracker_custom_shortcuts_v1";

export const SHORTCUT_DEFINITIONS: ShortcutDefinition[] = [
  // 1. Navigation & Views
  {
    id: "nav_tracker",
    name: "Switch to Leads Tracker",
    description: "Navigate to the main lead register and caller board",
    category: "Navigation & Views",
    defaultKey: "alt+1",
    targetUiButton: "Top Navigation Bar → Leads Tracker Tab",
    iconName: "LayoutDashboard",
  },
  {
    id: "nav_shortcuts",
    name: "Switch to Shortcuts Tab",
    description: "Open this keyboard shortcuts manager and button directory",
    category: "Navigation & Views",
    defaultKey: "alt+2",
    targetUiButton: "Top Navigation Bar → Shortcuts Tab",
    iconName: "Keyboard",
  },
  {
    id: "nav_settings",
    name: "Switch to Settings",
    description: "Configure callers/handlers, display settings, and presets",
    category: "Navigation & Views",
    defaultKey: "alt+3",
    targetUiButton: "Top Navigation Bar → Settings Tab",
    iconName: "Settings",
  },
  {
    id: "scroll_upload",
    name: "Jump to Upload & Ingestion",
    description: "Scroll to and expand the Excel/XML spreadsheet uploader panel",
    category: "Navigation & Views",
    defaultKey: "u",
    targetUiButton: "Page Section → Excel Sheet Auto-Analyzer & Ingestion",
    iconName: "UploadCloud",
  },

  // 2. Search & Filtering
  {
    id: "search_focus",
    name: "Focus Search Bar",
    description: "Quickly focus the client name, phone number, email, or city search filter",
    category: "Search & Filtering",
    defaultKey: "/",
    targetUiButton: "Filter Bar → Search Input",
    iconName: "Search",
  },
  {
    id: "search_reset",
    name: "Reset All Filters & Search",
    description: "Clear active search keywords, status filter, city, and handler filters",
    category: "Search & Filtering",
    defaultKey: "alt+r",
    targetUiButton: "Filter Bar → Reset Filters Button",
    iconName: "RotateCcw",
  },
  {
    id: "filter_status_cycle",
    name: "Cycle Status Filter",
    description: "Cycle through status views: All → Interested → Follow-up → Pending → No Answer → Not Interested",
    category: "Search & Filtering",
    defaultKey: "s",
    targetUiButton: "Filter Bar → Call Status Dropdown",
    iconName: "Filter",
  },
  {
    id: "filter_handler_cycle",
    name: "Cycle Assigned Handler",
    description: "Cycle active table filter through team handlers (All → Helen → Athira → Anjana...)",
    category: "Search & Filtering",
    defaultKey: "h",
    targetUiButton: "Filter Bar → Filter by Handler Dropdown",
    iconName: "Users",
  },

  // 3. Leads & Edit Operations
  {
    id: "lead_add",
    name: "Add New Lead",
    description: "Open manual lead creation dialog with full payment, month, and client fields",
    category: "Leads & Edit Operations",
    defaultKey: "n",
    targetUiButton: "Header Action Bar → '+ Add Lead' Button",
    iconName: "Plus",
  },
  {
    id: "lead_select_all",
    name: "Select All Leads",
    description: "Select all currently filtered leads for batch reassignment or deletion",
    category: "Leads & Edit Operations",
    defaultKey: "alt+a",
    targetUiButton: "Table Header Checkbox → Select All",
    iconName: "CheckSquare",
  },
  {
    id: "lead_clear_selection",
    name: "Clear Selection",
    description: "Deselect all selected rows in the leads table",
    category: "Leads & Edit Operations",
    defaultKey: "alt+x",
    targetUiButton: "Batch Action Bar → Clear Selection Button",
    iconName: "XSquare",
  },
  {
    id: "lead_delete_selected",
    name: "Delete Selected Leads",
    description: "Trigger deletion dialog for all currently checked lead rows",
    category: "Leads & Edit Operations",
    defaultKey: "delete",
    targetUiButton: "Batch Action Bar → 'Delete Selected' Button",
    iconName: "Trash2",
  },
  {
    id: "undo_delete",
    name: "Undo Last Deletion",
    description: "Instantly restore recently deleted records from the undo buffer",
    category: "Leads & Edit Operations",
    defaultKey: "ctrl+z",
    targetUiButton: "Floating Notification → 'Undo' Button",
    iconName: "Undo2",
  },

  // 4. Day Sections & Ingestion
  {
    id: "day_today",
    name: "View Today's Leads Section",
    description: "Filter lead records to today's date section",
    category: "Day Sections & Ingestion",
    defaultKey: "alt+t",
    targetUiButton: "Uploaded Files Section → Today's 'View Leads' Button",
    iconName: "Calendar",
  },
  {
    id: "day_tomorrow",
    name: "View Tomorrow's Leads Section",
    description: "Filter lead records to tomorrow's date section",
    category: "Day Sections & Ingestion",
    defaultKey: "alt+m",
    targetUiButton: "Uploaded Files Section → Tomorrow's 'View Leads' Button",
    iconName: "CalendarDays",
  },
  {
    id: "day_all",
    name: "View All Days Combined",
    description: "Remove day restriction and view leads across all uploaded dates",
    category: "Day Sections & Ingestion",
    defaultKey: "alt+d",
    targetUiButton: "Uploaded Files Section → 'View All Days' Button",
    iconName: "Layers",
  },
  {
    id: "quick_upload_tomorrow",
    name: "Quick Upload for Tomorrow",
    description: "Presets the uploader destination directly to Tomorrow and jumps to dropzone",
    category: "Day Sections & Ingestion",
    defaultKey: "alt+q",
    targetUiButton: "Tomorrow's Day Card → '+ Upload Sheet for Tomorrow' Button",
    iconName: "Upload",
  },
  {
    id: "drop_file_today",
    name: 'Drop your Excel / XML file here (will be added to "Today" section)',
    description: "Directly open file picker or dropzone to upload Excel / XML file into Today's section",
    category: "Day Sections & Ingestion",
    defaultKey: "alt+u",
    targetUiButton: 'Shortcuts Tab & Ingestion Panel → Drop your Excel / XML file here (will be added to "Today" section)',
    iconName: "FileSpreadsheet",
  },
  {
    id: "toggle_workload_expand",
    name: "Toggle Today's Handler Workload (Collapse/Expand)",
    description: "Expand or collapse Today's Handler Workload Allocation section on the dashboard",
    category: "Day Sections & Ingestion",
    defaultKey: "alt+w",
    targetUiButton: "Today's Handler Workload Allocation → Collapse/Expand Button",
    iconName: "Users",
  },

  // 5. PDF & Export Reports
  {
    id: "report_pdf",
    name: "Daily Handler PDF Report",
    description: "Open the handler-assigned PDF generator with real-time preview and export",
    category: "PDF & Export Reports",
    defaultKey: "p",
    targetUiButton: "Header Action Bar → 'Daily PDF Report' Button",
    iconName: "FileSpreadsheet",
  },
  {
    id: "export_excel",
    name: "Export to Excel (.xlsx)",
    description: "Export currently filtered or all lead records into a formatted Excel sheet",
    category: "PDF & Export Reports",
    defaultKey: "e",
    targetUiButton: "Header Action Bar → 'Excel' Export Button",
    iconName: "FileDown",
  },
  {
    id: "export_csv",
    name: "Export to CSV",
    description: "Download CSV document containing all visible client and payment fields",
    category: "PDF & Export Reports",
    defaultKey: "c",
    targetUiButton: "Header Action Bar → 'CSV' Export Button",
    iconName: "FileText",
  },

  // 6. Dialog & Window
  {
    id: "modal_close",
    name: "Close Active Modal / Escape",
    description: "Close any open dialog, modal preview, or blur active inputs",
    category: "Dialog & Window",
    defaultKey: "escape",
    targetUiButton: "Modal Windows → Close Button (X)",
    iconName: "X",
  },
];

/**
 * Build default shortcuts map
 */
export function getDefaultShortcutsMap(): Record<ShortcutActionId, string> {
  const map: Partial<Record<ShortcutActionId, string>> = {};
  for (const def of SHORTCUT_DEFINITIONS) {
    map[def.id] = def.defaultKey;
  }
  return map as Record<ShortcutActionId, string>;
}

/**
 * Load saved custom shortcuts from localStorage with fallback to defaults
 */
export function loadCustomShortcuts(): Record<ShortcutActionId, string> {
  const defaults = getDefaultShortcutsMap();
  if (typeof window === "undefined") return defaults;

  try {
    const raw = localStorage.getItem(SHORTCUTS_STORAGE_KEY);
    if (!raw) return defaults;
    const parsed = JSON.parse(raw);
    if (parsed && typeof parsed === "object") {
      return { ...defaults, ...parsed };
    }
  } catch (err) {
    console.warn("Could not load custom shortcuts from localStorage:", err);
  }

  return defaults;
}

/**
 * Save custom shortcuts to localStorage
 */
export function saveCustomShortcuts(shortcuts: Record<ShortcutActionId, string>): void {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(SHORTCUTS_STORAGE_KEY, JSON.stringify(shortcuts));
  } catch (err) {
    console.error("Could not save custom shortcuts to localStorage:", err);
  }
}

/**
 * Reset all shortcuts to factory defaults
 */
export function resetAllShortcuts(): Record<ShortcutActionId, string> {
  const defaults = getDefaultShortcutsMap();
  saveCustomShortcuts(defaults);
  return defaults;
}

/**
 * Formats a canonical key combo (e.g. "ctrl+alt+k") into individual readable tokens
 */
export function formatKeyDisplay(combo: string): string[] {
  if (!combo) return [];
  const parts = combo.toLowerCase().split("+").map((p) => p.trim()).filter(Boolean);

  const isMac = typeof navigator !== "undefined" && /Mac|iPod|iPhone|iPad/.test(navigator.platform);

  return parts.map((part) => {
    switch (part) {
      case "ctrl":
      case "control":
        return isMac ? "⌃ Control" : "Ctrl";
      case "alt":
      case "option":
        return isMac ? "⌥ Option" : "Alt";
      case "shift":
        return isMac ? "⇧ Shift" : "Shift";
      case "meta":
      case "cmd":
      case "command":
        return isMac ? "⌘ Cmd" : "Win";
      case "escape":
      case "esc":
        return "Esc";
      case "delete":
      case "del":
        return "Del";
      case "backspace":
        return "Backspace";
      case "enter":
        return "↵ Enter";
      case "arrowup":
      case "up":
        return "↑";
      case "arrowdown":
      case "down":
        return "↓";
      case "arrowleft":
      case "left":
        return "←";
      case "arrowright":
      case "right":
        return "→";
      case "space":
        return "Space";
      case "tab":
        return "Tab";
      case "slash":
      case "/":
        return "/";
      case "question":
      case "?":
        return "?";
      default:
        return part.length === 1 ? part.toUpperCase() : part.charAt(0).toUpperCase() + part.slice(1);
    }
  });
}

/**
 * Converts a KeyboardEvent into our canonical lowercase combo string
 */
export function eventToKeyCombo(e: KeyboardEvent): string {
  const keys: string[] = [];

  if (e.ctrlKey) keys.push("ctrl");
  if (e.altKey) keys.push("alt");
  if (e.shiftKey) keys.push("shift");
  if (e.metaKey) keys.push("meta");

  let key = (e.key || "").toLowerCase();

  // Normalize special key names
  if (key === "control" || key === "alt" || key === "shift" || key === "meta") {
    // Only a modifier was pressed, no primary key yet
    return keys.join("+");
  }

  if (key === "escape") key = "escape";
  else if (key === " ") key = "space";
  else if (key === "delete") key = "delete";
  else if (key === "backspace") key = "backspace";
  else if (key === "enter") key = "enter";

  keys.push(key);
  return keys.join("+");
}

/**
 * Determines whether the user is typing inside an editable field
 */
export function isTargetEditable(target: EventTarget | null): boolean {
  if (!target || !(target instanceof HTMLElement)) return false;
  const tagName = (target.tagName || "").toLowerCase();
  if (tagName === "input" || tagName === "textarea" || tagName === "select") {
    return true;
  }
  if (target.isContentEditable) {
    return true;
  }
  return false;
}

/**
 * Matches a KeyboardEvent against a canonical shortcut string
 */
export function matchEventToShortcut(e: KeyboardEvent, combo: string): boolean {
  if (!combo) return false;
  const currentCombo = eventToKeyCombo(e);

  // Direct match
  if (currentCombo === (combo || "").toLowerCase()) {
    return true;
  }

  // Handle case where shift was pressed for '?' or uppercase letters
  if (combo === "?" && e.key === "?") return true;
  if (combo === "/" && e.key === "/") return true;

  return false;
}

/**
 * Finds conflict if a key combination is already used by another action
 */
export function findShortcutConflict(
  actionId: ShortcutActionId,
  keyCombo: string,
  shortcutsMap: Record<ShortcutActionId, string>
): ShortcutDefinition | null {
  const normalized = (keyCombo || "").toLowerCase().trim();
  for (const [id, assignedKey] of Object.entries(shortcutsMap)) {
    if (id !== actionId && assignedKey && assignedKey.toLowerCase().trim() === normalized) {
      return SHORTCUT_DEFINITIONS.find((def) => def.id === id) || null;
    }
  }
  return null;
}
