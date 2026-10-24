import React, { useRef, useState, useEffect } from "react";
import {
  Layers,
  Plus,
  Copy,
  Edit2,
  Trash2,
  ChevronLeft,
  ChevronRight,
  MoreVertical,
  Check,
  FolderOpen,
} from "lucide-react";
import { WorkspacePage } from "../types";
import { PAGE_COLORS } from "../utils/pageManager";

interface PageNavigationTabsProps {
  pages: WorkspacePage[];
  activePageId: string;
  leadCountsByPage: Record<string, number>;
  onSelectPage: (pageId: string) => void;
  onOpenCreateModal: () => void;
  onOpenDuplicateModal: (page: WorkspacePage) => void;
  onOpenRenameModal: (page: WorkspacePage) => void;
  onOpenDeleteModal: (page: WorkspacePage) => void;
}

export const PageNavigationTabs: React.FC<PageNavigationTabsProps> = ({
  pages,
  activePageId,
  leadCountsByPage,
  onSelectPage,
  onOpenCreateModal,
  onOpenDuplicateModal,
  onOpenRenameModal,
  onOpenDeleteModal,
}) => {
  const scrollRef = useRef<HTMLDivElement>(null);
  const [canScrollLeft, setCanScrollLeft] = useState(false);
  const [canScrollRight, setCanScrollRight] = useState(false);
  const [openMenuPageId, setOpenMenuPageId] = useState<string | null>(null);
  const [isOverviewDropdownOpen, setIsOverviewDropdownOpen] = useState(false);

  // Check scroll overflows
  const checkScroll = () => {
    if (scrollRef.current) {
      const { scrollLeft, scrollWidth, clientWidth } = scrollRef.current;
      setCanScrollLeft(scrollLeft > 4);
      setCanScrollRight(scrollLeft + clientWidth < scrollWidth - 4);
    }
  };

  useEffect(() => {
    checkScroll();
    window.addEventListener("resize", checkScroll);
    return () => window.removeEventListener("resize", checkScroll);
  }, [pages]);

  const handleScroll = (dir: "left" | "right") => {
    if (scrollRef.current) {
      const amount = dir === "left" ? -240 : 240;
      scrollRef.current.scrollBy({ left: amount, behavior: "smooth" });
      setTimeout(checkScroll, 250);
    }
  };

  // Close menus on outside click
  useEffect(() => {
    const handleOutsideClick = (e: MouseEvent) => {
      const target = e.target as HTMLElement;
      if (!target.closest("[data-page-menu-container]") && !target.closest("[data-overview-container]")) {
        setOpenMenuPageId(null);
        setIsOverviewDropdownOpen(false);
      }
    };
    document.addEventListener("mousedown", handleOutsideClick);
    return () => document.removeEventListener("mousedown", handleOutsideClick);
  }, []);

  const getColorClass = (color?: WorkspacePage["color"]) => {
    const found = PAGE_COLORS.find((c) => c.id === color);
    return found ? found.dotClass : "bg-indigo-500";
  };

  return (
    <div className="w-full bg-slate-900 border-b border-slate-800 text-white select-none">
      <div className="w-full max-w-full px-4 sm:px-6 flex items-center justify-between gap-3 py-1.5">
        {/* Left Section: Label & All Pages Quick Jump */}
        <div className="flex items-center gap-2 shrink-0">
          <div className="flex items-center gap-1.5 text-xs font-bold text-slate-300">
            <Layers className="w-3.5 h-3.5 text-indigo-400" />
            <span className="hidden sm:inline">Workspace Pages:</span>
          </div>

          {pages.length > 2 && (
            <div className="relative" data-overview-container>
              <button
                type="button"
                onClick={() => setIsOverviewDropdownOpen(!isOverviewDropdownOpen)}
                className="px-2 py-0.5 rounded text-[11px] font-semibold text-slate-300 hover:text-white bg-slate-800 hover:bg-slate-700 transition-colors cursor-pointer flex items-center gap-1 border border-slate-700"
                title="View all pages directory"
              >
                <FolderOpen className="w-3 h-3 text-indigo-400" />
                <span className="tabular-nums font-bold">{pages.length} Pages</span>
              </button>

              {isOverviewDropdownOpen && (
                <div className="absolute left-0 top-full mt-1.5 w-64 bg-slate-800 rounded-xl shadow-2xl border border-slate-700 py-2 z-50 animate-in fade-in zoom-in-95 duration-100">
                  <div className="px-3 py-1.5 text-[10px] font-bold text-slate-400 uppercase tracking-wider border-b border-slate-700/60 flex items-center justify-between">
                    <span>Select Workspace</span>
                    <span className="tabular-nums">{pages.length} total</span>
                  </div>
                  <div className="max-h-60 overflow-y-auto py-1">
                    {pages.map((p) => {
                      const count = leadCountsByPage[p.id] ?? 0;
                      const isActive = p.id === activePageId;
                      return (
                        <button
                          key={p.id}
                          type="button"
                          onClick={() => {
                            onSelectPage(p.id);
                            setIsOverviewDropdownOpen(false);
                          }}
                          className={`w-full px-3 py-2 text-xs flex items-center justify-between transition-colors cursor-pointer ${
                            isActive
                              ? "bg-slate-700/80 text-white font-semibold"
                              : "text-slate-300 hover:bg-slate-700 hover:text-white"
                          }`}
                          style={
                            isActive && p.customColor
                              ? { backgroundColor: `${p.customColor}25`, borderLeft: `3px solid ${p.customColor}` }
                              : undefined
                          }
                        >
                          <div className="flex items-center gap-2 truncate">
                            <span
                              className={`w-2 h-2 rounded-full shrink-0 ${!p.customColor ? getColorClass(p.color) : ""}`}
                              style={p.customColor ? { backgroundColor: p.customColor } : undefined}
                            />
                            <span className="truncate">{p.name}</span>
                          </div>
                          <div className="flex items-center gap-1.5 shrink-0 ml-2">
                            <span className="text-[10px] tabular-nums font-bold px-1.5 py-0.5 rounded bg-slate-900/60 text-slate-300">
                              {count}
                            </span>
                            {isActive && (
                              <Check
                                className="w-3 h-3 text-indigo-400"
                                style={p.customColor ? { color: p.customColor } : undefined}
                              />
                            )}
                          </div>
                        </button>
                      );
                    })}
                  </div>
                  <div className="pt-1.5 mt-1 border-t border-slate-700/60 px-2">
                    <button
                      type="button"
                      onClick={() => {
                        setIsOverviewDropdownOpen(false);
                        onOpenCreateModal();
                      }}
                      className="w-full py-1.5 px-2 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold transition-colors cursor-pointer flex items-center justify-center gap-1.5 shadow-2xs"
                    >
                      <Plus className="w-3.5 h-3.5" />
                      <span>New / Duplicate Page</span>
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Center Section: Scrollable Tab Strip with Arrows */}
        <div className="flex-1 relative flex items-center min-w-0">
          {canScrollLeft && (
            <button
              type="button"
              onClick={() => handleScroll("left")}
              className="absolute left-0 z-20 h-7 w-6 bg-slate-900/95 hover:bg-slate-800 text-slate-300 hover:text-white rounded-l flex items-center justify-center transition-colors cursor-pointer shadow-xs border-r border-slate-800"
              aria-label="Scroll tabs left"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
          )}

          <div
            ref={scrollRef}
            onScroll={checkScroll}
            className="flex items-center gap-1.5 overflow-x-auto no-scrollbar scroll-smooth w-full px-1 py-0.5"
            style={{ scrollbarWidth: "none", msOverflowStyle: "none" }}
          >
            {pages.map((page) => {
              const isActive = page.id === activePageId;
              const leadCount = leadCountsByPage[page.id] ?? 0;
              const isMenuOpen = openMenuPageId === page.id;

              return (
                <div
                  key={page.id}
                  data-page-menu-container
                  className={`group relative flex items-center shrink-0 rounded-lg transition-all border ${
                    isActive
                      ? (page.customColor ? "bg-slate-800 text-white shadow-xs" : "bg-slate-800 border-indigo-500/80 text-white shadow-xs")
                      : "bg-slate-900/90 border-slate-800 text-slate-400 hover:text-slate-200 hover:bg-slate-800/60 hover:border-slate-700"
                  }`}
                  style={
                    isActive && page.customColor
                      ? {
                          borderColor: page.customColor,
                          boxShadow: `0 0 10px ${page.customColor}30`,
                        }
                      : undefined
                  }
                >
                  <button
                    type="button"
                    onClick={() => onSelectPage(page.id)}
                    className="flex items-center gap-2 px-3 py-1.5 text-xs font-semibold cursor-pointer truncate max-w-[190px] sm:max-w-[220px]"
                    title={`${page.name}${page.description ? ` - ${page.description}` : ""}`}
                  >
                    <span
                      className={`w-2 h-2 rounded-full shrink-0 transition-transform ${
                        !page.customColor ? getColorClass(page.color) : ""
                      } ${isActive ? "scale-110" : ""}`}
                      style={
                        page.customColor
                          ? {
                              backgroundColor: page.customColor,
                              boxShadow: isActive ? `0 0 0 2px ${page.customColor}40` : undefined,
                            }
                          : undefined
                      }
                    />
                    <span className="truncate">{page.name}</span>
                    <span
                      className={`text-[10px] font-bold tabular-nums px-1.5 py-0.2 rounded shrink-0 ${
                        isActive
                          ? (page.customColor ? "text-white shadow-2xs" : "bg-indigo-600 text-white shadow-2xs")
                          : "bg-slate-800 text-slate-400 group-hover:text-slate-300"
                      }`}
                      style={
                        isActive && page.customColor
                          ? { backgroundColor: page.customColor }
                          : undefined
                      }
                      title={`${leadCount} leads in this workspace`}
                    >
                      {leadCount}
                    </span>
                  </button>

                  {/* Options menu trigger */}
                  <div className="relative pr-1.5">
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        setOpenMenuPageId(isMenuOpen ? null : page.id);
                      }}
                      className={`p-1 rounded transition-colors cursor-pointer ${
                        isActive
                          ? "text-slate-300 hover:text-white hover:bg-slate-700"
                          : "text-slate-500 hover:text-slate-300 hover:bg-slate-800 opacity-60 group-hover:opacity-100"
                      }`}
                      title="Page options (Duplicate, Rename, Delete)"
                      aria-label="Workspace page options"
                    >
                      <MoreVertical className="w-3.5 h-3.5" />
                    </button>

                    {isMenuOpen && (
                      <div className="absolute right-0 top-full mt-1 w-44 bg-slate-800 rounded-xl shadow-2xl border border-slate-700 py-1.5 z-50 animate-in fade-in zoom-in-95 duration-100 text-slate-200">
                        <div className="px-3 py-1 text-[10px] font-bold text-slate-400 uppercase tracking-wider border-b border-slate-700/60 truncate">
                          {page.name}
                        </div>

                        <button
                          type="button"
                          onClick={() => {
                            setOpenMenuPageId(null);
                            onOpenDuplicateModal(page);
                          }}
                          className="w-full px-3 py-1.5 text-xs flex items-center gap-2 hover:bg-slate-700 hover:text-white transition-colors cursor-pointer text-left"
                        >
                          <Copy className="w-3.5 h-3.5 text-indigo-400" />
                          <span>Duplicate Page</span>
                        </button>

                        <button
                          type="button"
                          onClick={() => {
                            setOpenMenuPageId(null);
                            onOpenRenameModal(page);
                          }}
                          className="w-full px-3 py-1.5 text-xs flex items-center gap-2 hover:bg-slate-700 hover:text-white transition-colors cursor-pointer text-left"
                        >
                          <Edit2 className="w-3.5 h-3.5 text-amber-400" />
                          <span>Rename Page</span>
                        </button>

                        {pages.length > 1 && (
                          <div className="pt-1 mt-1 border-t border-slate-700/60">
                            <button
                              type="button"
                              onClick={() => {
                                setOpenMenuPageId(null);
                                onOpenDeleteModal(page);
                              }}
                              className="w-full px-3 py-1.5 text-xs flex items-center gap-2 hover:bg-rose-950/50 hover:text-rose-400 text-rose-400 transition-colors cursor-pointer text-left"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                              <span>Delete Page</span>
                            </button>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              );
            })}

            {/* Quick + button directly beside tabs */}
            <button
              type="button"
              id="btn-create-duplicate-page"
              onClick={onOpenCreateModal}
              className="px-2.5 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white font-semibold text-xs transition-all cursor-pointer flex items-center gap-1.5 shrink-0 shadow-2xs hover:shadow-xs active:scale-95 border border-indigo-400/40"
              title="Create new workspace or duplicate current page without limit"
            >
              <Plus className="w-3.5 h-3.5 stroke-[2.5]" />
              <span className="hidden sm:inline">New / Duplicate</span>
            </button>
          </div>

          {canScrollRight && (
            <button
              type="button"
              onClick={() => handleScroll("right")}
              className="absolute right-0 z-20 h-7 w-6 bg-slate-900/95 hover:bg-slate-800 text-slate-300 hover:text-white rounded-r flex items-center justify-center transition-colors cursor-pointer shadow-xs border-l border-slate-800"
              aria-label="Scroll tabs right"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          )}
        </div>

        {/* Right Section: 1-Click Fast Duplicate Active Page */}
        <div className="hidden lg:flex items-center gap-1.5 shrink-0">
          <button
            type="button"
            id="btn-fast-duplicate-page"
            onClick={() => {
              const current = pages.find((p) => p.id === activePageId) || pages[0];
              if (current) onOpenDuplicateModal(current);
            }}
            className="px-2.5 py-1 rounded-md text-[11px] font-semibold text-slate-300 hover:text-white bg-slate-800 hover:bg-slate-700 transition-colors cursor-pointer flex items-center gap-1 border border-slate-700 shadow-2xs"
            title="Duplicate the currently open workspace in one click"
          >
            <Copy className="w-3 h-3 text-indigo-400" />
            <span>Duplicate Current</span>
          </button>
        </div>
      </div>
    </div>
  );
};
