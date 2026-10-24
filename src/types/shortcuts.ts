export type ShortcutActionId =
  // Navigation & Views
  | "nav_tracker"
  | "nav_shortcuts"
  | "nav_settings"
  | "scroll_upload"
  // Search & Filtering
  | "search_focus"
  | "search_reset"
  | "filter_status_cycle"
  | "filter_handler_cycle"
  // Leads & Edit Operations
  | "lead_add"
  | "lead_select_all"
  | "lead_clear_selection"
  | "lead_delete_selected"
  | "undo_delete"
  // Day Sections & Files
  | "day_today"
  | "day_tomorrow"
  | "day_all"
  | "quick_upload_tomorrow"
  | "drop_file_today"
  | "toggle_workload_expand"
  // Reports & Export
  | "report_pdf"
  | "export_excel"
  | "export_csv"
  // Dialog & Window
  | "modal_close";

export type ShortcutCategory =
  | "Navigation & Views"
  | "Search & Filtering"
  | "Leads & Edit Operations"
  | "Day Sections & Ingestion"
  | "PDF & Export Reports"
  | "Dialog & Window";

export interface ShortcutDefinition {
  id: ShortcutActionId;
  name: string;
  description: string;
  category: ShortcutCategory;
  defaultKey: string; // e.g. "alt+1", "n", "p", "/", "ctrl+z"
  targetUiButton: string; // Where this button is in the UI
  iconName: string;
}
