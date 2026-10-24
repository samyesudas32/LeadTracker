import { WorkspacePage, Lead, UploadedFileRecord } from "../types";

export const PAGES_STORAGE_KEY = "workspace_pages_v1";
export const ACTIVE_PAGE_STORAGE_KEY = "active_workspace_page_id_v1";

export const DEFAULT_PAGE: WorkspacePage = {
  id: "page-default",
  name: "Main Workspace",
  description: "Primary lead generation and tracking workspace",
  color: "indigo",
  isDefault: true,
  order: 0,
  createdAt: "2026-09-01T00:00:00.000Z",
  updatedAt: "2026-09-01T00:00:00.000Z",
};

export const PAGE_COLORS: {
  id: WorkspacePage["color"];
  label: string;
  badgeClass: string;
  dotClass: string;
}[] = [
  { id: "indigo", label: "Indigo", badgeClass: "bg-indigo-50 text-indigo-700 border-indigo-200", dotClass: "bg-indigo-500" },
  { id: "blue", label: "Blue", badgeClass: "bg-blue-50 text-blue-700 border-blue-200", dotClass: "bg-blue-500" },
  { id: "emerald", label: "Emerald", badgeClass: "bg-emerald-50 text-emerald-700 border-emerald-200", dotClass: "bg-emerald-500" },
  { id: "purple", label: "Purple", badgeClass: "bg-purple-50 text-purple-700 border-purple-200", dotClass: "bg-purple-500" },
  { id: "rose", label: "Rose", badgeClass: "bg-rose-50 text-rose-700 border-rose-200", dotClass: "bg-rose-500" },
  { id: "amber", label: "Amber", badgeClass: "bg-amber-50 text-amber-700 border-amber-200", dotClass: "bg-amber-500" },
  { id: "teal", label: "Teal", badgeClass: "bg-teal-50 text-teal-700 border-teal-200", dotClass: "bg-teal-500" },
  { id: "slate", label: "Slate", badgeClass: "bg-slate-100 text-slate-700 border-slate-300", dotClass: "bg-slate-500" },
];

export function isValidHexColor(hex?: string): boolean {
  if (!hex || typeof hex !== "string") return false;
  return /^#([0-9A-Fa-f]{3}|[0-9A-Fa-f]{6})$/.test(hex.trim());
}

/**
 * Loads the list of workspace pages from localStorage.
 * If empty or corrupted, initializes with the default workspace page.
 */
export function loadWorkspacePages(): WorkspacePage[] {
  try {
    const raw = localStorage.getItem(PAGES_STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed) && parsed.length > 0) {
        return parsed.map((p, idx) => ({
          ...p,
          id: p.id || `page-${idx + 1}`,
          name: p.name || `Workspace ${idx + 1}`,
          color: p.color || "indigo",
          customColor: isValidHexColor(p.customColor) ? p.customColor : undefined,
          createdAt: p.createdAt || new Date().toISOString(),
          updatedAt: p.updatedAt || new Date().toISOString(),
        }));
      }
    }
  } catch (err) {
    console.warn("Notice: Failed to parse workspace pages from local storage:", err);
  }
  return [DEFAULT_PAGE];
}

/**
 * Persists the list of workspace pages to localStorage.
 */
export function saveWorkspacePagesLocally(pages: WorkspacePage[]): void {
  try {
    localStorage.setItem(PAGES_STORAGE_KEY, JSON.stringify(pages));
  } catch (err) {
    console.error("Failed to save workspace pages to localStorage:", err);
  }
}

/**
 * Loads the active page ID from localStorage, validating against existing pages.
 */
export function getActiveWorkspacePageId(pages: WorkspacePage[]): string {
  try {
    const savedId = localStorage.getItem(ACTIVE_PAGE_STORAGE_KEY);
    if (savedId && pages.some((p) => p.id === savedId)) {
      return savedId;
    }
  } catch (err) {
    console.warn("Notice: Failed to load active page ID from local storage:", err);
  }
  return pages[0]?.id || DEFAULT_PAGE.id;
}

/**
 * Persists the active page ID to localStorage.
 */
export function saveActiveWorkspacePageIdLocally(id: string): void {
  try {
    localStorage.setItem(ACTIVE_PAGE_STORAGE_KEY, id);
  } catch (err) {
    console.error("Failed to save active workspace page ID to localStorage:", err);
  }
}

/**
 * Generates a unique page ID.
 */
export function generatePageId(): string {
  return `page-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`;
}

/**
 * Creates a new blank workspace page.
 */
export function createBlankPage(
  name: string,
  description?: string,
  color?: WorkspacePage["color"],
  customColor?: string
): WorkspacePage {
  const now = new Date().toISOString();
  return {
    id: generatePageId(),
    name: name.trim() || "New Workspace",
    description: description?.trim() || "",
    color: color || "indigo",
    customColor: isValidHexColor(customColor) ? customColor!.trim() : undefined,
    isDefault: false,
    createdAt: now,
    updatedAt: now,
  };
}

/**
 * Duplicates an existing workspace page along with all its leads and uploaded files.
 * Generates fresh UUIDs for cloned leads and files while maintaining internal relationships.
 */
export function duplicateWorkspacePage(
  sourcePage: WorkspacePage,
  sourceLeads: Lead[],
  sourceFiles: UploadedFileRecord[],
  customName?: string,
  color?: WorkspacePage["color"],
  customColor?: string
): {
  newPage: WorkspacePage;
  clonedLeads: Lead[];
  clonedFiles: UploadedFileRecord[];
} {
  const now = new Date().toISOString();
  const newPageId = generatePageId();

  // Create page definition
  const finalCustomColor = customColor !== undefined
    ? (isValidHexColor(customColor) ? customColor.trim() : undefined)
    : sourcePage.customColor;

  const newPage: WorkspacePage = {
    id: newPageId,
    name: (customName && customName.trim()) || `${sourcePage.name} (Copy)`,
    description: sourcePage.description ? `${sourcePage.description} (Cloned)` : undefined,
    color: color || sourcePage.color || "indigo",
    customColor: finalCustomColor,
    isDefault: false,
    createdAt: now,
    updatedAt: now,
  };

  // Map old file IDs to new file IDs
  const fileIdMap: Record<string, string> = {};
  const clonedFiles: UploadedFileRecord[] = sourceFiles.map((file) => {
    const newFileId = `file-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`;
    fileIdMap[file.id] = newFileId;
    return {
      ...file,
      id: newFileId,
      pageId: newPageId,
      uploadedAt: now,
    };
  });

  // Deep clone all leads, mapping fileId if associated
  const clonedLeads: Lead[] = sourceLeads.map((lead, idx) => {
    const newLeadId = `lead-${Date.now()}-${idx}-${Math.random().toString(36).substring(2, 7)}`;
    const newFileId = lead.fileId ? fileIdMap[lead.fileId] || lead.fileId : undefined;
    return {
      ...lead,
      id: newLeadId,
      pageId: newPageId,
      fileId: newFileId,
      createdAt: now,
      updatedAt: now,
    };
  });

  return {
    newPage,
    clonedLeads,
    clonedFiles,
  };
}
