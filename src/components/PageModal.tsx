import React, { useState, useEffect, useRef } from "react";
import {
  X,
  Copy,
  Plus,
  Edit2,
  Trash2,
  Layers,
  FileSpreadsheet,
  Users,
  AlertCircle,
  Check,
  Pipette,
  Palette,
} from "lucide-react";
import { WorkspacePage, Lead, UploadedFileRecord } from "../types";
import { PAGE_COLORS, isValidHexColor } from "../utils/pageManager";

export type PageModalMode = "create" | "duplicate" | "rename" | "delete";

interface PageModalProps {
  isOpen: boolean;
  mode: PageModalMode;
  targetPage?: WorkspacePage | null;
  activePage: WorkspacePage;
  pageLeadsCount: number;
  pageFilesCount: number;
  onClose: () => void;
  onCreateBlank: (
    name: string,
    description?: string,
    color?: WorkspacePage["color"],
    customColor?: string
  ) => void;
  onDuplicatePage: (
    sourcePage: WorkspacePage,
    customName?: string,
    color?: WorkspacePage["color"],
    customColor?: string
  ) => void;
  onRenamePage: (
    pageId: string,
    newName: string,
    description?: string,
    color?: WorkspacePage["color"],
    customColor?: string
  ) => void;
  onDeletePage: (pageId: string) => void;
  totalPagesCount: number;
}

export const PageModal: React.FC<PageModalProps> = ({
  isOpen,
  mode,
  targetPage,
  activePage,
  pageLeadsCount,
  pageFilesCount,
  onClose,
  onCreateBlank,
  onDuplicatePage,
  onRenamePage,
  onDeletePage,
  totalPagesCount,
}) => {
  const effectivePage = targetPage || activePage;
  const [createType, setCreateType] = useState<"duplicate" | "blank">(
    mode === "duplicate" ? "duplicate" : "duplicate"
  );
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [color, setColor] = useState<WorkspacePage["color"]>("indigo");
  const [isCustomColor, setIsCustomColor] = useState(false);
  const [customColor, setCustomColor] = useState("#6366F1");
  const [customHexInput, setCustomHexInput] = useState("#6366F1");
  const [error, setError] = useState<string | null>(null);
  const colorInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!isOpen) return;
    setError(null);

    if (mode === "rename") {
      setName(effectivePage.name);
      setDescription(effectivePage.description || "");
      setColor(effectivePage.color || "indigo");
      if (effectivePage.customColor && isValidHexColor(effectivePage.customColor)) {
        setIsCustomColor(true);
        setCustomColor(effectivePage.customColor);
        setCustomHexInput(effectivePage.customColor);
      } else {
        setIsCustomColor(false);
        setCustomColor("#6366F1");
        setCustomHexInput("#6366F1");
      }
    } else if (mode === "duplicate") {
      setCreateType("duplicate");
      setName(`${effectivePage.name} (Copy)`);
      setDescription(effectivePage.description || "");
      setColor(effectivePage.color || "indigo");
      if (effectivePage.customColor && isValidHexColor(effectivePage.customColor)) {
        setIsCustomColor(true);
        setCustomColor(effectivePage.customColor);
        setCustomHexInput(effectivePage.customColor);
      } else {
        setIsCustomColor(false);
        setCustomColor("#6366F1");
        setCustomHexInput("#6366F1");
      }
    } else if (mode === "create") {
      setCreateType("duplicate");
      setName(`${effectivePage.name} (Copy)`);
      setDescription("");
      setColor("blue");
      setIsCustomColor(false);
      setCustomColor("#3B82F6");
      setCustomHexInput("#3B82F6");
    } else if (mode === "delete") {
      setName(effectivePage.name);
    }
  }, [isOpen, mode, effectivePage]);

  if (!isOpen) return null;

  const handleHexInputChange = (val: string) => {
    let sanitized = val.trim();
    if (!sanitized.startsWith("#")) {
      sanitized = "#" + sanitized;
    }
    setCustomHexInput(sanitized);
    if (isValidHexColor(sanitized)) {
      setCustomColor(sanitized);
      setIsCustomColor(true);
    }
  };

  const handleNativeColorChange = (val: string) => {
    setCustomColor(val);
    setCustomHexInput(val.toUpperCase());
    setIsCustomColor(true);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (mode === "delete") {
      if (totalPagesCount <= 1) {
        setError("Cannot delete the only remaining workspace page.");
        return;
      }
      onDeletePage(effectivePage.id);
      onClose();
      return;
    }

    const trimmedName = name.trim();
    if (!trimmedName) {
      setError("Please provide a valid workspace page name.");
      return;
    }

    const finalCustomColor = isCustomColor && isValidHexColor(customColor) ? customColor : undefined;

    if (mode === "rename") {
      onRenamePage(effectivePage.id, trimmedName, description.trim(), color, finalCustomColor);
      onClose();
    } else if (mode === "duplicate" || (mode === "create" && createType === "duplicate")) {
      onDuplicatePage(effectivePage, trimmedName, color, finalCustomColor);
      onClose();
    } else {
      onCreateBlank(trimmedName, description.trim(), color, finalCustomColor);
      onClose();
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/60 backdrop-blur-xs animate-in fade-in duration-150">
      <div
        className="w-full max-w-lg bg-white rounded-2xl shadow-2xl border border-slate-200 overflow-hidden flex flex-col max-h-[90vh]"
        role="dialog"
        aria-modal="true"
      >
        {/* Modal Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 bg-slate-50/80">
          <div className="flex items-center gap-2.5">
            <div
              className={`p-2 rounded-xl text-white shadow-xs ${
                mode === "delete"
                  ? "bg-rose-600"
                  : mode === "rename"
                  ? "bg-amber-600"
                  : "bg-indigo-600"
              }`}
            >
              {mode === "delete" ? (
                <Trash2 className="w-5 h-5" />
              ) : mode === "rename" ? (
                <Edit2 className="w-5 h-5" />
              ) : mode === "duplicate" || createType === "duplicate" ? (
                <Copy className="w-5 h-5" />
              ) : (
                <Plus className="w-5 h-5" />
              )}
            </div>
            <div>
              <h3 className="text-base font-bold text-slate-900 tracking-tight">
                {mode === "delete"
                  ? "Delete Workspace Page"
                  : mode === "rename"
                  ? "Rename Workspace Page"
                  : mode === "duplicate"
                  ? "Duplicate Workspace Page"
                  : "Create or Duplicate Page"}
              </h3>
              <p className="text-xs text-slate-500">
                {mode === "delete"
                  ? "Permanently remove this independent workspace"
                  : mode === "rename"
                  ? "Update title, description, and color tag"
                  : "Work with unlimited independent lead datasets"}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-lg transition-colors cursor-pointer"
            aria-label="Close modal"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Body */}
        <form onSubmit={handleSubmit} className="p-6 space-y-5 overflow-y-auto">
          {error && (
            <div className="flex items-center gap-2 p-3 text-xs font-medium text-rose-700 bg-rose-50 border border-rose-200 rounded-xl">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          {/* Delete Mode View */}
          {mode === "delete" ? (
            <div className="space-y-4">
              <div className="p-4 rounded-xl bg-rose-50/70 border border-rose-200 text-rose-900 text-sm space-y-2">
                <p className="font-semibold">
                  Are you sure you want to delete &ldquo;{effectivePage.name}&rdquo;?
                </p>
                <p className="text-xs text-rose-700 leading-relaxed">
                  This will permanently delete this independent workspace including its{" "}
                  <strong className="tabular-nums font-bold">{pageLeadsCount}</strong> leads,{" "}
                  <strong className="tabular-nums font-bold">{pageFilesCount}</strong> uploaded
                  file batches, and associated records. This action cannot be undone.
                </p>
              </div>

              {totalPagesCount <= 1 && (
                <div className="p-3 rounded-lg bg-amber-50 border border-amber-200 text-xs text-amber-800">
                  You cannot delete your only workspace. Create another page first before deleting this one.
                </div>
              )}
            </div>
          ) : (
            <>
              {/* Type selector when in 'create' mode */}
              {mode === "create" && (
                <div className="space-y-2">
                  <label className="text-xs font-semibold uppercase tracking-wider text-slate-500">
                    Creation Method
                  </label>
                  <div className="grid grid-cols-2 gap-3">
                    <button
                      type="button"
                      onClick={() => {
                        setCreateType("duplicate");
                        setName(`${effectivePage.name} (Copy)`);
                      }}
                      className={`p-3.5 rounded-xl border text-left transition-all cursor-pointer flex flex-col gap-1.5 ${
                        createType === "duplicate"
                          ? "border-indigo-600 bg-indigo-50/50 ring-2 ring-indigo-500/20"
                          : "border-slate-200 hover:border-slate-300 bg-white"
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <span className="font-bold text-sm text-slate-900 flex items-center gap-1.5">
                          <Copy className="w-4 h-4 text-indigo-600" />
                          Duplicate Active
                        </span>
                        {createType === "duplicate" && (
                          <span className="w-2 h-2 rounded-full bg-indigo-600" />
                        )}
                      </div>
                      <p className="text-[11px] text-slate-500 leading-snug">
                        Clone all <strong className="tabular-nums">{pageLeadsCount}</strong> leads, files, handlers, and settings into a new page.
                      </p>
                    </button>

                    <button
                      type="button"
                      onClick={() => {
                        setCreateType("blank");
                        setName(`Workspace ${totalPagesCount + 1}`);
                      }}
                      className={`p-3.5 rounded-xl border text-left transition-all cursor-pointer flex flex-col gap-1.5 ${
                        createType === "blank"
                          ? "border-indigo-600 bg-indigo-50/50 ring-2 ring-indigo-500/20"
                          : "border-slate-200 hover:border-slate-300 bg-white"
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <span className="font-bold text-sm text-slate-900 flex items-center gap-1.5">
                          <Plus className="w-4 h-4 text-indigo-600" />
                          New Blank Page
                        </span>
                        {createType === "blank" && (
                          <span className="w-2 h-2 rounded-full bg-indigo-600" />
                        )}
                      </div>
                      <p className="text-[11px] text-slate-500 leading-snug">
                        Start with a fresh, clean workspace and standard default team handlers.
                      </p>
                    </button>
                  </div>
                </div>
              )}

              {/* Duplicate Summary Pill */}
              {(mode === "duplicate" || (mode === "create" && createType === "duplicate")) && (
                <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200 text-xs text-slate-600 flex items-center justify-between gap-4">
                  <div className="flex items-center gap-2">
                    <Layers className="w-4 h-4 text-indigo-600 shrink-0" />
                    <span>
                      Cloning from: <strong className="text-slate-900">{effectivePage.name}</strong>
                    </span>
                  </div>
                  <div className="flex items-center gap-3 text-slate-500 shrink-0 font-medium">
                    <span className="flex items-center gap-1">
                      <Users className="w-3.5 h-3.5 text-slate-400" />
                      <strong className="text-slate-800 tabular-nums">{pageLeadsCount}</strong> leads
                    </span>
                    <span className="flex items-center gap-1">
                      <FileSpreadsheet className="w-3.5 h-3.5 text-slate-400" />
                      <strong className="text-slate-800 tabular-nums">{pageFilesCount}</strong> files
                    </span>
                  </div>
                </div>
              )}

              {/* Page Name Field */}
              <div className="space-y-1.5">
                <label
                  htmlFor="workspace-page-name-input"
                  className="block text-xs font-semibold text-slate-700"
                >
                  Workspace Page Name <span className="text-rose-500">*</span>
                </label>
                <input
                  id="workspace-page-name-input"
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="e.g. Real Estate Q4 Campaign, Dubai Inbound..."
                  className="w-full px-3.5 py-2.5 text-sm rounded-xl border border-slate-300 focus:outline-hidden focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 bg-white shadow-2xs"
                  autoFocus
                  required
                />
              </div>

              {/* Page Description Field */}
              <div className="space-y-1.5">
                <label
                  htmlFor="workspace-page-desc-input"
                  className="block text-xs font-semibold text-slate-700"
                >
                  Description (Optional)
                </label>
                <input
                  id="workspace-page-desc-input"
                  type="text"
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="e.g. Dedicated lead intake for high-priority cases"
                  className="w-full px-3.5 py-2 text-sm rounded-xl border border-slate-300 focus:outline-hidden focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 bg-white shadow-2xs"
                />
              </div>

              {/* Color Accent Picker */}
              <div className="space-y-2.5">
                <div className="flex items-center justify-between">
                  <label className="block text-xs font-semibold text-slate-700">
                    Workspace Color Accent
                  </label>
                  {isCustomColor && (
                    <span className="text-[11px] font-mono font-medium text-slate-500 flex items-center gap-1.5">
                      Selected: <strong className="text-slate-800">{customColor.toUpperCase()}</strong>
                    </span>
                  )}
                </div>

                <div className="flex items-center gap-2 flex-wrap">
                  {PAGE_COLORS.map((c) => {
                    const isSelected = !isCustomColor && color === c.id;
                    return (
                      <button
                        key={c.id}
                        type="button"
                        onClick={() => {
                          setColor(c.id);
                          setIsCustomColor(false);
                        }}
                        className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer flex items-center gap-1.5 border ${
                          isSelected
                            ? "border-slate-900 bg-slate-900 text-white shadow-xs scale-105"
                            : `${c.badgeClass} hover:opacity-90`
                        }`}
                      >
                        <span className={`w-2 h-2 rounded-full ${c.dotClass}`} />
                        <span>{c.label}</span>
                        {isSelected && <Check className="w-3 h-3 text-white ml-0.5" />}
                      </button>
                    );
                  })}

                  {/* Custom Color Option Button */}
                  <button
                    type="button"
                    onClick={() => {
                      setIsCustomColor(true);
                      colorInputRef.current?.click();
                    }}
                    className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer flex items-center gap-1.5 border ${
                      isCustomColor
                        ? "border-slate-900 bg-slate-900 text-white shadow-xs scale-105"
                        : "bg-white text-slate-700 border-slate-300 hover:border-slate-400 hover:bg-slate-50"
                    }`}
                  >
                    <span
                      className="w-2.5 h-2.5 rounded-full ring-1 ring-slate-400/40 shrink-0"
                      style={{ backgroundColor: customColor }}
                    />
                    <Palette className="w-3.5 h-3.5" />
                    <span>Custom</span>
                    {isCustomColor && <Check className="w-3 h-3 text-white ml-0.5" />}
                  </button>
                </div>

                {/* Custom Color Picker Swatch & HEX Input Box */}
                {isCustomColor && (
                  <div className="p-3 bg-slate-50 rounded-xl border border-slate-200/90 flex flex-col sm:flex-row sm:items-center justify-between gap-3 animate-in fade-in duration-150">
                    <div className="flex items-center gap-2.5">
                      {/* Native Color Picker Trigger Swatch */}
                      <div className="relative group">
                        <button
                          type="button"
                          onClick={() => colorInputRef.current?.click()}
                          className="w-9 h-9 rounded-xl shadow-xs border-2 border-white ring-1 ring-slate-300 flex items-center justify-center cursor-pointer transition-transform hover:scale-105"
                          style={{ backgroundColor: customColor }}
                          title="Click to open system color picker"
                        >
                          <Pipette className="w-4 h-4 text-white drop-shadow-md opacity-90 group-hover:opacity-100" />
                        </button>
                        <input
                          ref={colorInputRef}
                          type="color"
                          value={customColor}
                          onChange={(e) => handleNativeColorChange(e.target.value)}
                          className="sr-only"
                          aria-label="Choose custom workspace color"
                        />
                      </div>

                      {/* HEX Text Input */}
                      <div className="space-y-0.5">
                        <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block">
                          Hex Code
                        </label>
                        <div className="flex items-center gap-1.5">
                          <input
                            type="text"
                            value={customHexInput}
                            onChange={(e) => handleHexInputChange(e.target.value)}
                            maxLength={7}
                            placeholder="#6366F1"
                            className="w-24 px-2.5 py-1 text-xs font-mono font-bold uppercase rounded-lg border border-slate-300 bg-white focus:outline-hidden focus:ring-2 focus:ring-indigo-500"
                          />
                          {!isValidHexColor(customHexInput) && (
                            <span className="text-[10px] text-rose-500 font-medium">Invalid</span>
                          )}
                        </div>
                      </div>
                    </div>

                    {/* Quick Swatch Palette */}
                    <div className="flex items-center gap-1.5 self-start sm:self-center">
                      <span className="text-[10px] text-slate-400 font-semibold uppercase mr-0.5">
                        Ideas:
                      </span>
                      {[
                        "#6366F1", // Indigo
                        "#0EA5E9", // Sky
                        "#10B981", // Emerald
                        "#F59E0B", // Amber
                        "#EC4899", // Pink
                        "#8B5CF6", // Violet
                        "#14B8A6", // Teal
                        "#F43F5E", // Rose
                      ].map((quickHex) => (
                        <button
                          key={quickHex}
                          type="button"
                          onClick={() => handleNativeColorChange(quickHex)}
                          className={`w-5 h-5 rounded-md cursor-pointer transition-transform hover:scale-115 border border-white ring-1 ring-slate-200 shadow-2xs ${
                            customColor.toUpperCase() === quickHex.toUpperCase() ? "scale-115 ring-2 ring-slate-900" : ""
                          }`}
                          style={{ backgroundColor: quickHex }}
                          title={`Select ${quickHex}`}
                        />
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </>
          )}

          {/* Modal Footer Controls */}
          <div className="pt-3 border-t border-slate-100 flex items-center justify-end gap-3">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-xs font-semibold text-slate-700 hover:text-slate-900 hover:bg-slate-100 rounded-xl transition-colors cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={mode === "delete" && totalPagesCount <= 1}
              className={`px-5 py-2.5 text-xs font-bold rounded-xl text-white shadow-sm transition-all cursor-pointer flex items-center gap-2 ${
                mode === "delete"
                  ? "bg-rose-600 hover:bg-rose-700 disabled:opacity-50 disabled:cursor-not-allowed"
                  : "bg-indigo-600 hover:bg-indigo-700"
              }`}
            >
              {mode === "delete" ? (
                <>
                  <Trash2 className="w-4 h-4" />
                  <span>Delete Workspace</span>
                </>
              ) : mode === "rename" ? (
                <>
                  <Check className="w-4 h-4" />
                  <span>Save Changes</span>
                </>
              ) : mode === "duplicate" || createType === "duplicate" ? (
                <>
                  <Copy className="w-4 h-4" />
                  <span>Create Duplicate Page</span>
                </>
              ) : (
                <>
                  <Plus className="w-4 h-4" />
                  <span>Create Blank Page</span>
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
