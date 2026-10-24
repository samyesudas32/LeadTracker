import React, { useState } from "react";
import {
  PhoneCall,
  CheckCircle2,
  Clock,
  AlertCircle,
  Download,
  Plus,
  RotateCcw,
  Trash2,
  FileSpreadsheet,
  FileText,
  Settings,
  LayoutDashboard,
  Users,
  Keyboard,
  ShieldCheck,
  Lock,
  KeyRound,
  Globe,
  Building2,
  Sparkles,
  ShieldAlert,
  Smartphone,
  BarChart3,
} from "lucide-react";
import { Lead, StatusFilter, UserAccount, RBACConfig, AppRole, WorkspacePage } from "../types";
import { formatKeyDisplay } from "../utils/shortcutManager";
import { MetricHighlightCards } from "./MetricHighlightCards";
import { hasPermission, getCurrentAuthUser } from "../utils/authService";
import { AccountSettingsModal } from "./AccountSettingsModal";
import { PageNavigationTabs } from "./PageNavigationTabs";

export type AppPage = "tracker" | "settings" | "shortcuts" | "landing" | "super_admin";

interface HeaderProps {
  leads: Lead[];
  softwareTitle?: string;
  currentPage: AppPage;
  onNavigate: (page: AppPage) => void;
  onExportCsv: () => void;
  onExportExcel: () => void;
  onOpenPdfReport: () => void;
  onOpenAddModal: () => void;
  onResetToSample: () => void;
  onClearAll: () => void;
  handlersCount?: number;
  activeHandlerName?: string;
  serverStatus?: "connected" | "connecting" | "offline";
  activeSessions?: number;
  realtimeTransport?: string;
  firebaseStatus?: "connected" | "connecting" | "offline";
  currentUser?: { displayName?: string | null; email?: string | null; photoURL?: string | null } | null;
  currentUserAccount?: UserAccount;
  rbacConfig?: RBACConfig;
  onSwitchRole?: (newRole: AppRole) => void;
  onUserAccountUpdated?: (user: UserAccount) => void;
  onSignIn?: () => void;
  onSignOut?: () => void;
  onAdminLogout?: () => void;
  shortcutsMap?: Record<string, string>;
  statusFilter?: StatusFilter;
  onStatusFilterChange?: (filter: StatusFilter) => void;
  onRequestSuperAdmin?: () => void;
  onSwitchToMobile?: () => void;
  onOpenCompletionReports?: () => void;
  pages?: WorkspacePage[];
  activePageId?: string;
  leadCountsByPage?: Record<string, number>;
  onSelectPage?: (pageId: string) => void;
  onOpenCreatePageModal?: () => void;
  onOpenDuplicatePageModal?: (page: WorkspacePage) => void;
  onOpenRenamePageModal?: (page: WorkspacePage) => void;
  onOpenDeletePageModal?: (page: WorkspacePage) => void;
}

export const Header: React.FC<HeaderProps> = ({
  leads,
  softwareTitle = "Lead & Payment Tracker",
  currentPage,
  onNavigate,
  onRequestSuperAdmin,
  onExportCsv,
  onExportExcel,
  onOpenPdfReport,
  onOpenCompletionReports,
  onOpenAddModal,
  onResetToSample,
  onClearAll,
  handlersCount,
  activeHandlerName,
  serverStatus = "connected",
  activeSessions = 1,
  realtimeTransport,
  firebaseStatus = "connected",
  currentUser,
  currentUserAccount,
  rbacConfig: _rbacConfig,
  onSwitchRole: _onSwitchRole,
  onUserAccountUpdated,
  onSignIn,
  onSignOut,
  onAdminLogout,
  shortcutsMap,
  statusFilter = "all",
  onStatusFilterChange,
  onSwitchToMobile,
  pages,
  activePageId,
  leadCountsByPage,
  onSelectPage,
  onOpenCreatePageModal,
  onOpenDuplicatePageModal,
  onOpenRenamePageModal,
  onOpenDeletePageModal,
}) => {
  const [isAccountModalOpen, setIsAccountModalOpen] = useState(false);
  const total = leads.length;

  const user = currentUserAccount || getCurrentAuthUser();
  const isMgr = user.role === "manager" || user.role === "super_admin";
  const isCustomer = user.role === "customer";
  const canAdd = hasPermission("leads:create", user);
  const canBulkDelete = hasPermission("leads:delete_batch", user);
  const canPdf = hasPermission("reports:pdf", user);
  const canExcel = hasPermission("export:excel", user);
  const canCsv = hasPermission("export:csv", user);
  const canSettings = hasPermission("settings:view", user);
  const canMetrics = hasPermission("analytics:view", user);
  const canShortcuts = hasPermission("shortcuts:manage", user);

  return (
    <header className="border-b border-slate-200/90 bg-white relative z-30 shadow-2xs">
      {/* SaaS Multi-Portal Switcher: Public Landing Page, Super Admin Portal, CRM Lead Tracker, Settings, Shortcuts */}
      <div className="bg-[#0F172A] text-slate-300 px-4 sm:px-6 py-2 border-b border-slate-800 flex flex-wrap items-center justify-between gap-3 text-xs">
        <div className="flex items-center gap-2">
          <span className="font-extrabold text-white tracking-wider uppercase text-[10px] bg-indigo-600 px-2 py-0.5 rounded-md flex items-center gap-1 shadow-2xs">
            <Building2 className="w-3 h-3 text-emerald-300" />
            <span>Enterprise Multi-Tenant SaaS</span>
          </span>
          <span className="text-[11px] text-slate-400 hidden md:inline">
            PostgreSQL RLS Architecture • Active Portal:
          </span>
        </div>

        <nav className="flex items-center gap-1.5 flex-wrap">
          <button
            type="button"
            id="nav-portal-landing"
            onClick={() => onNavigate("landing")}
            className={`px-3 py-1 rounded-lg text-xs font-semibold transition-all cursor-pointer flex items-center gap-1.5 ${
              currentPage === "landing"
                ? "bg-white text-slate-900 shadow-xs"
                : "text-slate-300 hover:text-white hover:bg-slate-800"
            }`}
            title="View public SaaS Landing Page"
          >
            <Globe className="w-3.5 h-3.5 text-emerald-400" />
            <span>Landing Page</span>
          </button>

          <button
            type="button"
            id="nav-portal-super-admin"
            onClick={() => {
              if (onRequestSuperAdmin) {
                onRequestSuperAdmin();
              } else {
                onNavigate("super_admin");
              }
            }}
            className={`px-3 py-1 rounded-lg text-xs font-semibold transition-all cursor-pointer flex items-center gap-1.5 ${
              currentPage === "super_admin"
                ? "bg-white text-slate-900 shadow-xs"
                : "text-slate-300 hover:text-white hover:bg-slate-800"
            }`}
            title="View Super Admin Console & Tenant Management"
          >
            <Building2 className="w-3.5 h-3.5 text-indigo-400" />
            <span>Super Admin</span>
          </button>

          <button
            type="button"
            id="nav-portal-tracker"
            onClick={() => onNavigate("tracker")}
            className={`px-3 py-1 rounded-lg text-xs font-semibold transition-all cursor-pointer flex items-center gap-1.5 ${
              currentPage === "tracker"
                ? "bg-indigo-600 text-white shadow-xs"
                : "text-slate-300 hover:text-white hover:bg-slate-800"
            }`}
            title="View CRM Lead Tracker Workspace"
          >
            <LayoutDashboard className="w-3.5 h-3.5 text-emerald-300" />
            <span>Lead Tracker (Workspace)</span>
          </button>

          {canSettings && (
            <button
              type="button"
              id="nav-portal-settings"
              onClick={() => onNavigate("settings")}
              className={`px-2.5 py-1 rounded-lg text-xs font-semibold transition-all cursor-pointer flex items-center gap-1.5 ${
                currentPage === "settings"
                  ? "bg-white text-slate-900 shadow-xs"
                  : "text-slate-300 hover:text-white hover:bg-slate-800"
              }`}
              title="Configure CRM Settings & RBAC"
            >
              <Settings className="w-3.5 h-3.5 text-amber-400" />
              <span>Settings</span>
            </button>
          )}

          {canShortcuts && (
            <button
              type="button"
              id="nav-portal-shortcuts"
              onClick={() => onNavigate("shortcuts")}
              className={`px-2.5 py-1 rounded-lg text-xs font-semibold transition-all cursor-pointer flex items-center gap-1.5 ${
                currentPage === "shortcuts"
                  ? "bg-white text-slate-900 shadow-xs"
                  : "text-slate-300 hover:text-white hover:bg-slate-800"
              }`}
              title="View Keyboard Shortcuts & Actions"
            >
              <Keyboard className="w-3.5 h-3.5 text-cyan-400" />
              <span>Shortcuts</span>
            </button>
          )}
        </nav>
      </div>

      {/* Unlimited Workspace Pages Navigation Tabs */}
      {currentPage === "tracker" && pages && pages.length > 0 && onSelectPage && (
        <PageNavigationTabs
          pages={pages}
          activePageId={activePageId || pages[0].id}
          leadCountsByPage={leadCountsByPage || {}}
          onSelectPage={onSelectPage}
          onOpenCreateModal={onOpenCreatePageModal || (() => {})}
          onOpenDuplicateModal={onOpenDuplicatePageModal || (() => {})}
          onOpenRenameModal={onOpenRenamePageModal || (() => {})}
          onOpenDeleteModal={onOpenDeletePageModal || (() => {})}
        />
      )}

      <div className="w-full max-w-full px-4 sm:px-6 py-3.5 sm:py-4">
        <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
          <div className="flex flex-col sm:flex-row sm:items-center gap-4">
            <div className="flex items-center gap-3">
              <div className="p-2.5 rounded-xl bg-indigo-600 text-white shadow-xs">
                <FileSpreadsheet className="w-5 h-5" />
              </div>
              <div>
                <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-slate-900 flex items-center flex-wrap gap-2">
                  <span>{softwareTitle}</span>
                  {activeHandlerName && activeHandlerName !== "all" && (
                    <span className="text-xs font-semibold px-2 py-0.5 rounded-md bg-indigo-50 text-indigo-700 border border-indigo-200">
                      Handler: {activeHandlerName}
                    </span>
                  )}
                  <span
                    id="badge-server-status"
                    className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-md text-[11px] font-medium border ${
                      serverStatus === "connected"
                        ? "bg-emerald-50 text-emerald-700 border-emerald-200/80"
                        : serverStatus === "connecting"
                        ? "bg-amber-50 text-amber-700 border-amber-200/80"
                        : "bg-slate-100 text-slate-600 border-slate-200"
                    }`}
                    title={
                      serverStatus === "connected"
                        ? "Full-stack server and REST endpoints fully synchronized"
                        : serverStatus === "connecting"
                        ? "Connecting to Express server API..."
                        : "Offline / Local storage active"
                    }
                  >
                    <span
                      className={`w-1.5 h-1.5 rounded-full ${
                        serverStatus === "connected"
                          ? "bg-emerald-500"
                          : serverStatus === "connecting"
                          ? "bg-amber-500 animate-ping"
                          : "bg-slate-400"
                      }`}
                    />
                    <span className="tabular-nums flex items-center gap-1">
                      {serverStatus === "connected" ? (
                        <>
                          <span className="font-semibold">Live Synced</span>
                          {realtimeTransport === "websocket" && (
                            <span className="text-[10px] text-emerald-700 bg-emerald-100 px-1 rounded font-mono font-bold">
                              WS
                            </span>
                          )}
                          {activeSessions && activeSessions > 1 ? (
                            <span className="text-[10px] text-emerald-800 bg-emerald-100/90 px-1.5 rounded-full font-medium">
                              {activeSessions} sessions
                            </span>
                          ) : null}
                        </>
                      ) : serverStatus === "connecting" ? (
                        "Syncing..."
                      ) : (
                        "Offline Cache"
                      )}
                    </span>
                  </span>

                  <span
                    id="badge-firebase-status"
                    className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-md text-[11px] font-medium border ${
                      firebaseStatus === "connected"
                        ? "bg-amber-50 text-amber-900 border-amber-200"
                        : firebaseStatus === "connecting"
                        ? "bg-amber-50/50 text-amber-700 border-amber-200"
                        : "bg-slate-100 text-slate-500 border-slate-200"
                    }`}
                    title={
                      firebaseStatus === "connected"
                        ? "Google Cloud Firestore Live Database Connected & Synced"
                        : "Connecting to Firebase Firestore..."
                    }
                  >
                    <span
                      className={`w-1.5 h-1.5 rounded-full ${
                        firebaseStatus === "connected"
                          ? "bg-amber-500"
                          : firebaseStatus === "connecting"
                          ? "bg-amber-400 animate-pulse"
                          : "bg-slate-400"
                      }`}
                    />
                    <span className="flex items-center gap-1">
                      <span className="font-semibold">Firebase</span>
                      <span className="text-[10px] text-amber-800 bg-amber-100 px-1 rounded font-mono font-bold">
                        Firestore
                      </span>
                    </span>
                  </span>
                </h1>
                <p className="text-xs text-slate-500 mt-0.5">
                  Automated Spreadsheet Analysis • Full Name, Phone (tel:), Email, City, Queue Handler & Manual Notes
                </p>
              </div>
            </div>

            {/* Page Navigation Tabs */}
            <div className="flex items-center bg-slate-100 p-1 rounded-xl self-start sm:self-auto border border-slate-200/70">
              <button
                id="nav-btn-tracker"
                onClick={() => onNavigate("tracker")}
                className={`flex items-center gap-1.5 px-3 py-1.5 text-xs sm:text-sm font-semibold rounded-lg transition-all cursor-pointer ${
                  currentPage === "tracker"
                    ? "bg-white text-indigo-900 shadow-xs"
                    : "text-slate-600 hover:text-slate-900"
                }`}
              >
                <LayoutDashboard className="w-3.5 h-3.5 text-indigo-600" />
                <span>Leads Tracker</span>
                <span className="text-[10px] px-1.5 py-0.2 rounded-full bg-slate-200 text-slate-700 font-bold tabular-nums" title={`${total} clients listed`}>
                  {total} Clients
                </span>
              </button>

              <button
                id="nav-btn-shortcuts"
                onClick={() => onNavigate("shortcuts")}
                className={`flex items-center gap-1.5 px-3 py-1.5 text-xs sm:text-sm font-semibold rounded-lg transition-all cursor-pointer ${
                  currentPage === "shortcuts"
                    ? "bg-white text-indigo-900 shadow-xs"
                    : "text-slate-600 hover:text-slate-900"
                }`}
                title="Keyboard Shortcuts & Action Directory"
              >
                <Keyboard className="w-3.5 h-3.5 text-indigo-600" />
                <span>Shortcuts</span>
                <kbd className="hidden sm:inline-block px-1.5 py-0.2 text-[10px] font-mono font-bold rounded bg-slate-200 text-slate-700">
                  {shortcutsMap?.nav_shortcuts ? formatKeyDisplay(shortcutsMap.nav_shortcuts).join("+") : "Alt+2"}
                </kbd>
              </button>

              <button
                id="nav-btn-settings"
                onClick={() => {
                  if (canSettings) {
                    onNavigate("settings");
                  }
                }}
                disabled={!canSettings}
                className={`flex items-center gap-1.5 px-3 py-1.5 text-xs sm:text-sm font-semibold rounded-lg transition-all ${
                  !canSettings
                    ? "opacity-60 cursor-not-allowed text-slate-400 bg-slate-50"
                    : currentPage === "settings"
                    ? "bg-white text-indigo-900 shadow-xs cursor-pointer"
                    : "text-slate-600 hover:text-slate-900 cursor-pointer"
                }`}
                title={!canSettings ? "Settings restricted for Staff role (requires settings:view)" : "Open System Settings"}
              >
                {!canSettings ? (
                  <Lock className="w-3.5 h-3.5 text-slate-400" />
                ) : (
                  <Settings className="w-3.5 h-3.5 text-indigo-600" />
                )}
                <span>Settings</span>
                {!canSettings ? (
                  <span className="text-[10px] px-1 py-0.2 rounded bg-amber-100 text-amber-800 font-bold">
                    Restricted
                  </span>
                ) : (
                  handlersCount !== undefined && (
                    <span className="text-[10px] px-1.5 py-0.2 rounded-full bg-indigo-100 text-indigo-800 font-bold tabular-nums">
                      {handlersCount}
                    </span>
                  )
                )}
              </button>
            </div>
          </div>

          {/* Action buttons with consistent Indigo accent & neutral secondary buttons */}
          <div className="flex items-center flex-wrap gap-2">
            {currentPage === "tracker" ? (
              <>
                {isMgr && (
                  <button
                    id="btn-reset-sample"
                    onClick={onResetToSample}
                    className="inline-flex items-center gap-1.5 px-3 py-2 text-xs sm:text-sm font-medium text-slate-700 bg-white hover:bg-slate-50 border border-slate-200 rounded-lg shadow-2xs transition-colors cursor-pointer"
                    title="Reload default sample leads"
                  >
                    <RotateCcw className="w-3.5 h-3.5 text-slate-500" />
                    <span>Sample Data</span>
                  </button>
                )}

                {total > 0 && canBulkDelete && (
                  <button
                    id="btn-delete-all-leads"
                    onClick={onClearAll}
                    className="inline-flex items-center gap-1.5 px-3 py-2 text-xs sm:text-sm font-medium text-slate-600 hover:text-red-700 hover:bg-red-50/60 rounded-lg transition-colors cursor-pointer border border-transparent hover:border-red-200"
                    title="Delete all records"
                  >
                    <Trash2 className="w-3.5 h-3.5 text-slate-400 group-hover:text-red-600" />
                    <span>Clear All</span>
                  </button>
                )}

                <button
                  id="btn-generate-pdf-report"
                  onClick={() => {
                    if (canPdf) onOpenPdfReport();
                  }}
                  disabled={total === 0 || !canPdf}
                  className={`inline-flex items-center gap-1.5 px-3 py-2 text-xs sm:text-sm font-medium border rounded-lg shadow-2xs transition-colors ${
                    !canPdf
                      ? "opacity-50 cursor-not-allowed bg-slate-50 text-slate-400 border-slate-200"
                      : "text-slate-700 bg-white border-slate-200 hover:bg-slate-50 disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
                  }`}
                  title={
                    !canPdf
                      ? "PDF Generation restricted for Staff (enable in Access Control)"
                      : `Generate printable PDF report (${
                          shortcutsMap?.report_pdf ? formatKeyDisplay(shortcutsMap.report_pdf).join("+") : "P"
                        })`
                  }
                >
                  <FileText className="w-4 h-4 text-indigo-600" />
                  <span>PDF Report</span>
                  {!canPdf ? (
                    <span className="text-[10px] px-1 py-0.2 rounded bg-amber-100 text-amber-800 font-bold">
                      Locked
                    </span>
                  ) : (
                    <span className="text-[10px] px-1.5 py-0.2 rounded bg-slate-100 text-slate-600 font-mono font-bold hidden sm:inline-block">
                      {shortcutsMap?.report_pdf ? formatKeyDisplay(shortcutsMap.report_pdf).join("+") : "P"}
                    </span>
                  )}
                </button>

                {onOpenCompletionReports && (
                  <button
                    id="btn-header-completion-reports"
                    onClick={onOpenCompletionReports}
                    className="inline-flex items-center gap-1.5 px-3 py-2 text-xs sm:text-sm font-semibold text-emerald-800 bg-emerald-50 hover:bg-emerald-100 border border-emerald-200/90 rounded-lg shadow-2xs transition-colors cursor-pointer"
                    title="Generate Weekly & Monthly Completion Reports with PDF and Excel export"
                  >
                    <BarChart3 className="w-4 h-4 text-emerald-600" />
                    <span>Completion Reports</span>
                  </button>
                )}

                <button
                  id="btn-export-excel"
                  onClick={() => {
                    if (canExcel) onExportExcel();
                  }}
                  disabled={total === 0 || !canExcel}
                  className={`inline-flex items-center gap-1.5 px-3 py-2 text-xs sm:text-sm font-medium border rounded-lg shadow-2xs transition-colors ${
                    !canExcel
                      ? "opacity-50 cursor-not-allowed bg-slate-50 text-slate-400 border-slate-200"
                      : "text-slate-700 bg-white border-slate-200 hover:bg-slate-50 disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
                  }`}
                  title={
                    !canExcel
                      ? "Excel Export restricted for Staff (enable in Access Control)"
                      : `Export all data to Excel .xlsx spreadsheet (${
                          shortcutsMap?.export_excel ? formatKeyDisplay(shortcutsMap.export_excel).join("+") : "E"
                        })`
                  }
                >
                  <FileSpreadsheet className="w-4 h-4 text-emerald-600" />
                  <span>Export Excel</span>
                  {!canExcel ? (
                    <span className="text-[10px] px-1 py-0.2 rounded bg-amber-100 text-amber-800 font-bold">
                      Locked
                    </span>
                  ) : (
                    <span className="text-[10px] px-1.5 py-0.2 rounded bg-slate-100 text-slate-600 font-mono font-bold hidden sm:inline-block">
                      {shortcutsMap?.export_excel ? formatKeyDisplay(shortcutsMap.export_excel).join("+") : "E"}
                    </span>
                  )}
                </button>

                <button
                  id="btn-export-csv"
                  onClick={() => {
                    if (canCsv) onExportCsv();
                  }}
                  disabled={total === 0 || !canCsv}
                  className={`inline-flex items-center gap-1.5 px-3 py-2 text-xs sm:text-sm font-medium border rounded-lg shadow-2xs transition-colors ${
                    !canCsv
                      ? "opacity-50 cursor-not-allowed bg-slate-50 text-slate-400 border-slate-200"
                      : "text-slate-700 bg-white border-slate-200 hover:bg-slate-50 disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
                  }`}
                  title={
                    !canCsv
                      ? "CSV Export restricted for Staff (enable in Access Control)"
                      : `Export CSV (${
                          shortcutsMap?.export_csv ? formatKeyDisplay(shortcutsMap.export_csv).join("+") : "C"
                        })`
                  }
                >
                  <Download className="w-4 h-4 text-slate-500" />
                  <span>Export CSV</span>
                  {!canCsv ? (
                    <span className="text-[10px] px-1 py-0.2 rounded bg-amber-100 text-amber-800 font-bold">
                      Locked
                    </span>
                  ) : (
                    <span className="text-[10px] px-1.5 py-0.2 rounded bg-slate-100 text-slate-600 font-mono font-bold hidden sm:inline-block">
                      {shortcutsMap?.export_csv ? formatKeyDisplay(shortcutsMap.export_csv).join("+") : "C"}
                    </span>
                  )}
                </button>

                <button
                  id="btn-add-lead"
                  onClick={() => {
                    if (canAdd) onOpenAddModal();
                  }}
                  disabled={!canAdd}
                  className={`inline-flex items-center gap-1.5 px-3.5 py-2 text-xs sm:text-sm font-semibold rounded-lg shadow-xs transition-colors ${
                    !canAdd
                      ? "opacity-50 cursor-not-allowed bg-slate-300 text-slate-500"
                      : "text-white bg-indigo-600 hover:bg-indigo-700 cursor-pointer"
                  }`}
                  title={
                    !canAdd
                      ? "Lead creation restricted for Staff (requires leads:create)"
                      : `Add Record (${
                          shortcutsMap?.lead_add ? formatKeyDisplay(shortcutsMap.lead_add).join("+") : "N"
                        })`
                  }
                >
                  <Plus className="w-4 h-4" />
                  <span>Add Record</span>
                  {!canAdd ? (
                    <span className="text-[10px] px-1 py-0.2 rounded bg-amber-100 text-amber-800 font-bold">
                      Locked
                    </span>
                  ) : (
                    <span className="text-[10px] px-1.5 py-0.2 rounded bg-indigo-700 text-indigo-100 font-mono font-bold hidden sm:inline-block">
                      {shortcutsMap?.lead_add ? formatKeyDisplay(shortcutsMap.lead_add).join("+") : "N"}
                    </span>
                  )}
                </button>

                {canSettings && (
                  <button
                    id="btn-header-settings"
                    onClick={() => onNavigate("settings")}
                    className="inline-flex items-center gap-1.5 px-3 py-2 text-xs sm:text-sm font-medium text-slate-700 bg-white hover:bg-slate-50 border border-slate-200 rounded-lg shadow-2xs transition-colors cursor-pointer"
                    title="Open Settings Page"
                  >
                    <Settings className="w-4 h-4 text-slate-500" />
                    <span>Settings</span>
                  </button>
                )}

                {onSwitchToMobile && (
                  <button
                    id="btn-switch-to-mobile"
                    type="button"
                    onClick={onSwitchToMobile}
                    className="inline-flex items-center gap-1.5 px-3 py-2 text-xs sm:text-sm font-semibold text-indigo-700 bg-indigo-50 hover:bg-indigo-100 border border-indigo-200 rounded-lg shadow-2xs transition-colors cursor-pointer"
                    title="Switch to Mobile App View"
                  >
                    <Smartphone className="w-4 h-4 text-indigo-600" />
                    <span>Mobile App View</span>
                  </button>
                )}
              </>
            ) : (
              <button
                id="btn-settings-to-tracker"
                onClick={() => onNavigate("tracker")}
                className="inline-flex items-center gap-1.5 px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white text-xs sm:text-sm font-semibold rounded-xl shadow-xs transition-colors cursor-pointer"
              >
                <LayoutDashboard className="w-4 h-4" />
                <span>Return to Leads Tracker</span>
                <kbd className="px-1.5 py-0.5 rounded bg-indigo-700 text-white font-mono font-bold text-[10px] ml-1">
                  Alt+1
                </kbd>
              </button>
            )}

            {/* Google Authentication Status & Sign In Button */}
            {currentUser ? (
              <div className="flex items-center gap-2 pl-2 border-l border-slate-200">
                {currentUser.photoURL ? (
                  <img
                    src={currentUser.photoURL}
                    alt={currentUser.displayName || "User"}
                    className="w-7 h-7 rounded-full border border-slate-200"
                  />
                ) : (
                  <div className="w-7 h-7 rounded-full bg-indigo-100 text-indigo-700 font-bold text-xs flex items-center justify-center border border-indigo-200">
                    {currentUser.displayName ? currentUser.displayName[0].toUpperCase() : "U"}
                  </div>
                )}
                <div className="hidden md:flex flex-col text-left">
                  <span className="text-xs font-semibold text-slate-800 leading-tight max-w-[110px] truncate">
                    {currentUser.displayName || currentUser.email}
                  </span>
                  <span className="text-[10px] text-emerald-600 font-medium">Logged in</span>
                </div>
                {onSignOut && (
                  <button
                    onClick={onSignOut}
                    className="text-xs text-slate-500 hover:text-slate-800 px-2 py-1 rounded hover:bg-slate-100 transition-colors cursor-pointer"
                    title="Sign Out"
                  >
                    Logout
                  </button>
                )}
              </div>
            ) : onSignIn ? (
              <button
                onClick={onSignIn}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-slate-700 bg-white hover:bg-slate-50 border border-slate-200 rounded-lg shadow-2xs transition-colors cursor-pointer"
                title="Sign in with Google to authenticate with Firebase"
              >
                <svg className="w-3.5 h-3.5" viewBox="0 0 24 24">
                  <path
                    fill="#4285F4"
                    d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                  />
                  <path
                    fill="#34A853"
                    d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                  />
                  <path
                    fill="#FBBC05"
                    d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"
                  />
                  <path
                    fill="#EA4335"
                    d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"
                  />
                </svg>
                <span>Continue with Google</span>
              </button>
            ) : null}

            {/* Active User Role Badge & Quick Live Switcher */}
            <div className="flex items-center gap-1.5 pl-2 border-l border-slate-200">
              <div
                id="header-role-badge"
                className={`flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-bold border shadow-2xs select-none ${
                  isMgr
                    ? "bg-indigo-50 border-indigo-200 text-indigo-900"
                    : isCustomer
                    ? "bg-teal-50 border-teal-200 text-teal-900"
                    : "bg-amber-50 border-amber-200 text-amber-900"
                }`}
                title={`Active Role: ${
                  isMgr
                    ? "Manager (Unrestricted Full Access)"
                    : isCustomer
                    ? "Customer / Client (View-Only Access)"
                    : "Staff (Configurable Role-Based Access)"
                } • Account: ${user.username}`}
              >
                <span>{isMgr ? "👑" : isCustomer ? "👤" : "🛡️"}</span>
                <span className="capitalize">{isCustomer ? "Customer" : user.role}</span>
                <span
                  className={`hidden sm:inline-block text-[10px] font-normal px-1 rounded ${
                    isMgr
                      ? "bg-indigo-100 text-indigo-800"
                      : isCustomer
                      ? "bg-teal-100 text-teal-800 font-semibold"
                      : "bg-amber-100 text-amber-800"
                  }`}
                >
                  {isMgr ? "Full Access" : isCustomer ? "View-Only" : "Dynamic Perms"}
                </span>
              </div>

              {/* Dedicated "My Account" Credential Settings Modal Trigger */}
              <button
                type="button"
                id="btn-header-my-account"
                onClick={() => setIsAccountModalOpen(true)}
                className="inline-flex items-center gap-1.5 px-2.5 py-1 text-xs font-semibold rounded-lg border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 shadow-2xs transition-all cursor-pointer hover:border-slate-300"
                title="Manage your User ID and Password securely"
              >
                <KeyRound className="w-3.5 h-3.5 text-indigo-600" />
                <span>My Account</span>
              </button>

              {onAdminLogout && (
                <button
                  type="button"
                  id="btn-header-admin-logout"
                  onClick={onAdminLogout}
                  className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-semibold text-slate-600 hover:text-red-700 hover:bg-red-50 rounded-lg border border-slate-200 hover:border-red-200 transition-colors cursor-pointer"
                  title="Lock workspace & return to login screen"
                >
                  <Lock className="w-3 h-3 text-slate-400" />
                  <span>Log Out</span>
                </button>
              )}

              {/* Portal Jump Links */}
              <button
                type="button"
                id="btn-header-landing"
                onClick={() => onNavigate("landing")}
                className="hidden xl:inline-flex items-center gap-1 px-2.5 py-1 text-xs font-semibold text-slate-600 hover:text-slate-900 bg-white hover:bg-slate-50 border border-slate-200 rounded-lg transition-colors cursor-pointer"
                title="Go to Public Landing Page"
              >
                <Building2 className="w-3 h-3 text-slate-500" />
                <span>Landing Page</span>
              </button>

              <button
                type="button"
                id="btn-header-superadmin-newtab"
                onClick={() => {
                  if (onRequestSuperAdmin) {
                    onRequestSuperAdmin();
                  } else {
                    onNavigate("super_admin");
                  }
                }}
                className="hidden xl:inline-flex items-center gap-1 px-2.5 py-1 text-xs font-semibold text-emerald-700 bg-emerald-50 hover:bg-emerald-100 border border-emerald-200 rounded-lg transition-colors cursor-pointer"
                title="Open Super Admin Platform Console"
              >
                <ShieldAlert className="w-3 h-3 text-emerald-600" />
                <span>Super Admin</span>
              </button>
            </div>
          </div>
        </div>

        {/* Key Pipeline Metrics: Total, Integrated, Interested, Require, Follow up, and Pending Calls */}
        {currentPage === "tracker" && canMetrics && (
          <MetricHighlightCards
            leads={leads}
            activeFilter={statusFilter}
            onSelectFilter={onStatusFilterChange}
            className="mt-4 pt-4 border-t border-slate-100"
          />
        )}
      </div>

      {/* Dedicated My Account Credential Management Modal */}
      <AccountSettingsModal
        isOpen={isAccountModalOpen}
        onClose={() => setIsAccountModalOpen(false)}
        currentUser={user}
        onUserUpdated={(updatedUser) => {
          if (onUserAccountUpdated) {
            onUserAccountUpdated(updatedUser);
          }
        }}
      />
    </header>
  );
};
