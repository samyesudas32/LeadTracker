import React, { useState, useRef, useEffect } from "react";
import {
  Users,
  Sliders,
  PhoneCall,
  FileSpreadsheet,
  Database,
  ArrowLeft,
  Check,
  Plus,
  Trash2,
  Edit2,
  RotateCcw,
  Download,
  Upload,
  AlertTriangle,
  Mail,
  Phone,
  Shield,
  ShieldCheck,
  Lock,
  Eye,
  EyeOff,
  Sparkles,
  Save,
  CheckCircle2,
  Info,
  Clock,
  Briefcase,
  Layers,
  FileText,
  Tag,
  X,
} from "lucide-react";
import { AppSettings, HandlerRecord, Lead, CallStatus } from "../types";
import { DEFAULT_HANDLERS, DEFAULT_APP_SETTINGS, getHandlerColorClasses } from "../data/handlerDefaults";
import { exportLeadsToCsv, exportLeadsToExcel } from "../utils/parser";
import { SettingsLoginPage } from "./SettingsLoginPage";
import { ConfirmModal } from "./ConfirmModal";
import {
  isSettingsSessionAuthenticated,
  setSettingsSessionAuthenticated,
  getAdminCredentials,
  saveAdminCredentials,
  DEFAULT_ADMIN_CREDENTIALS,
  getRbacConfig,
  getCurrentAuthUser,
  setCurrentAuthUser,
} from "../utils/authService";
import { apiClient } from "../services/apiClient";
import { RbacSettingsTab } from "./RbacSettingsTab";
import { RBACConfig, UserAccount } from "../types/rbac";

interface SettingsPageProps {
  settings: AppSettings;
  leads: Lead[];
  rbacConfig?: RBACConfig;
  onSaveSettings: (newSettings: AppSettings) => void;
  onUpdateRbacConfig?: (newConfig: RBACConfig) => void;
  onUserAccountUpdated?: (user: UserAccount) => void;
  onNavigateToTracker: () => void;
  onBulkReassignHandler: (oldHandlerName: string, newHandlerName: string) => void;
  onRestoreLeads: (leads: Lead[]) => void;
  onResetToSample: () => void;
  onClearAllLeads: () => void;
}

const AVAILABLE_COLORS: HandlerRecord["color"][] = [
  "purple",
  "emerald",
  "blue",
  "amber",
  "rose",
  "indigo",
  "teal",
  "slate",
];

export const SettingsPage: React.FC<SettingsPageProps> = ({
  settings,
  leads,
  rbacConfig,
  onSaveSettings,
  onUpdateRbacConfig,
  onUserAccountUpdated,
  onNavigateToTracker,
  onBulkReassignHandler,
  onRestoreLeads,
  onResetToSample,
  onClearAllLeads,
}) => {
  const [isAuthenticated, setIsAuthenticated] = useState<boolean>(() =>
    isSettingsSessionAuthenticated()
  );

  const [activeTab, setActiveTab] = useState<
    "handlers" | "general" | "security" | "rbac" | "workflow" | "ingestion" | "data"
  >("handlers");

  const [currentRbac, setCurrentRbac] = useState<RBACConfig>(() => rbacConfig || getRbacConfig());

  useEffect(() => {
    if (rbacConfig) {
      setCurrentRbac(rbacConfig);
    }
  }, [rbacConfig]);

  // Admin security edit state
  const [adminCreds, setAdminCreds] = useState(() => getAdminCredentials());
  const [securityUserId, setSecurityUserId] = useState(adminCreds.userId);
  const [securityPassword, setSecurityPassword] = useState(adminCreds.password);
  const [securityEmail, setSecurityEmail] = useState(adminCreds.recoveryEmail);
  const [showSecPassword, setShowSecPassword] = useState(false);

  // Form State initialized from settings
  const [formData, setFormData] = useState<AppSettings>(settings);

  // New handler creation inputs
  const [newHandlerName, setNewHandlerName] = useState("");
  const [newHandlerRole, setNewHandlerRole] = useState("Lead Specialist");
  const [newHandlerEmail, setNewHandlerEmail] = useState("");
  const [newHandlerPhone, setNewHandlerPhone] = useState("");
  const [newHandlerColor, setNewHandlerColor] = useState<HandlerRecord["color"]>("purple");

  // Edit handler inputs
  const [editingHandlerId, setEditingHandlerId] = useState<string | null>(null);
  const [editName, setEditName] = useState("");
  const [editRole, setEditRole] = useState("");
  const [editEmail, setEditEmail] = useState("");
  const [editPhone, setEditPhone] = useState("");
  const [editColor, setEditColor] = useState<HandlerRecord["color"]>("purple");

  // Bulk Reassignment state
  const [reassignFrom, setReassignFrom] = useState<string>("");
  const [reassignTo, setReassignTo] = useState<string>("");
  const [reassignSuccessMsg, setReassignSuccessMsg] = useState<string | null>(null);

  // Quick note preset input
  const [newPresetTag, setNewPresetTag] = useState("");

  // Feedback notifications
  const [saveStatus, setSaveStatus] = useState<{
    type: "success" | "info" | "error";
    message: string;
  } | null>(null);

  // In-app Confirmation Modal (replaces browser window.confirm)
  const [confirmModal, setConfirmModal] = useState<{
    isOpen: boolean;
    title: string;
    description: string;
    confirmText?: string;
    cancelText?: string;
    variant?: "danger" | "warning" | "primary" | "emerald";
    itemCount?: number;
    itemLabel?: string;
    onConfirm: () => void;
  }>({
    isOpen: false,
    title: "",
    description: "",
    onConfirm: () => {},
  });

  const fileInputRef = useRef<HTMLInputElement>(null);

  // Sync latest admin credentials metadata from server
  useEffect(() => {
    apiClient
      .getCredentialsInfo()
      .then((info) => {
        if (info && info.userId) {
          setSecurityUserId(info.userId);
          setAdminCreds((prev) => ({
            ...prev,
            userId: info.userId || prev.userId,
            recoveryEmail: info.recoveryEmail || prev.recoveryEmail,
          }));
        }
        if (info && info.recoveryEmail) {
          setSecurityEmail(info.recoveryEmail);
        }
      })
      .catch(() => {});
  }, []);

  // Display feedback helper
  const triggerFeedback = (message: string, type: "success" | "info" | "error" = "success") => {
    setSaveStatus({ type, message });
    setTimeout(() => {
      setSaveStatus(null);
    }, 3500);
  };

  // Security Credentials Management
  const handleSaveSecurityCredentials = async () => {
    if (!securityUserId.trim()) {
      triggerFeedback("Admin User ID cannot be empty", "error");
      return;
    }
    if (!securityPassword.trim()) {
      triggerFeedback("Admin Password cannot be empty", "error");
      return;
    }
    const updated = {
      userId: securityUserId.trim(),
      password: securityPassword,
      recoveryEmail: securityEmail.trim() || DEFAULT_ADMIN_CREDENTIALS.recoveryEmail,
      lastUpdated: new Date().toISOString(),
    };
    const success = await saveAdminCredentials(updated);
    if (success) {
      setAdminCreds(updated);
      const curUser = getCurrentAuthUser();
      const updatedUser: UserAccount = {
        ...curUser,
        username: updated.userId,
        role: "manager",
        email: updated.recoveryEmail,
      };
      setCurrentAuthUser(updatedUser);
      if (onUserAccountUpdated) {
        onUserAccountUpdated(updatedUser);
      }
      triggerFeedback("Admin login credentials updated successfully! Active session maintained.");
    } else {
      triggerFeedback("Failed to update credentials on server. Please try again.", "error");
    }
  };

  const handleResetSecurityToDefault = () => {
    setConfirmModal({
      isOpen: true,
      title: "Reset Admin Credentials?",
      description: "Are you sure you want to reset admin login credentials to factory default (User: admin / Pass: Sam@1997)?",
      confirmText: "Reset Credentials",
      variant: "warning",
      onConfirm: async () => {
        const success = await saveAdminCredentials(DEFAULT_ADMIN_CREDENTIALS);
        if (success) {
          setAdminCreds(DEFAULT_ADMIN_CREDENTIALS);
          setSecurityUserId(DEFAULT_ADMIN_CREDENTIALS.userId);
          setSecurityPassword(DEFAULT_ADMIN_CREDENTIALS.password);
          setSecurityEmail(DEFAULT_ADMIN_CREDENTIALS.recoveryEmail);
          triggerFeedback("Credentials reset to default (admin / Sam@1997)");
        } else {
          triggerFeedback("Failed to reset credentials on server.", "error");
        }
      },
    });
  };

  // Save current formData to parent & localStorage
  const handleSaveAllChanges = (updatedSettings?: AppSettings) => {
    const toSave = updatedSettings || formData;
    setFormData(toSave);
    onSaveSettings(toSave);
    triggerFeedback("Settings saved & updated successfully!");
  };

  // --- Handlers Management ---
  const handleAddHandler = (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = newHandlerName.trim();
    if (!trimmed) return;

    if (formData.handlers.some((h) => h?.name && trimmed && h.name.toLowerCase() === trimmed.toLowerCase())) {
      triggerFeedback(`Handler ID "${trimmed}" already exists.`, "error");
      return;
    }

    const newHandler: HandlerRecord = {
      id: `handler-${Date.now()}`,
      name: trimmed,
      role: newHandlerRole.trim() || "Lead Specialist",
      email: newHandlerEmail.trim(),
      phone: newHandlerPhone.trim(),
      color: newHandlerColor,
      isDefault: formData.handlers.length === 0,
      createdAt: new Date().toISOString(),
    };

    const updatedHandlers = [...formData.handlers, newHandler];
    const updated = {
      ...formData,
      handlers: updatedHandlers,
    };
    setFormData(updated);
    handleSaveAllChanges(updated);

    setNewHandlerName("");
    setNewHandlerEmail("");
    setNewHandlerPhone("");
    triggerFeedback(`Handler ID "${trimmed}" created and added!`);
  };

  const handleStartEdit = (handler: HandlerRecord) => {
    setEditingHandlerId(handler.id);
    setEditName(handler.name);
    setEditRole(handler.role || "");
    setEditEmail(handler.email || "");
    setEditPhone(handler.phone || "");
    setEditColor(handler.color);
  };

  const handleSaveEdit = (id: string) => {
    const trimmed = editName.trim();
    if (!trimmed) return;

    const original = formData.handlers.find((h) => h.id === id);
    const oldName = original?.name;

    const updatedHandlers = formData.handlers.map((h) => {
      if (h.id === id) {
        return {
          ...h,
          name: trimmed,
          role: editRole.trim() || h.role,
          email: editEmail.trim(),
          phone: editPhone.trim(),
          color: editColor,
        };
      }
      return h;
    });

    let updatedActiveFront = formData.activeFrontPageHandler;
    if (oldName && updatedActiveFront === oldName) {
      updatedActiveFront = trimmed;
    }

    const updated = {
      ...formData,
      handlers: updatedHandlers,
      activeFrontPageHandler: updatedActiveFront,
    };

    setFormData(updated);
    setEditingHandlerId(null);
    handleSaveAllChanges(updated);

    // If name changed, optionally offer to bulk update leads
    if (oldName && oldName !== trimmed) {
      const matchCount = leads.filter(
        (l) => l.handlerName?.toLowerCase() === oldName.toLowerCase()
      ).length;
      if (matchCount > 0) {
        setConfirmModal({
          isOpen: true,
          title: "Update Assigned Leads?",
          description: `You renamed "${oldName}" to "${trimmed}". Do you also want to update ${matchCount} existing lead(s) currently assigned to "${oldName}"?`,
          confirmText: "Update Leads",
          variant: "primary",
          itemCount: matchCount,
          itemLabel: "assigned lead(s)",
          onConfirm: () => {
            onBulkReassignHandler(oldName, trimmed);
            triggerFeedback(`Renamed handler and updated ${matchCount} leads to "${trimmed}"!`);
          },
        });
        return;
      }
    }

    triggerFeedback(`Updated details for Handler "${trimmed}"!`);
  };

  const handleDeleteHandler = (handler: HandlerRecord) => {
    if (formData.handlers.length <= 1) {
      triggerFeedback("At least one Handler ID must remain configured.", "error");
      return;
    }

    const assignedCount = leads.filter(
      (l) => handler?.name && l.handlerName?.toLowerCase() === handler.name.toLowerCase()
    ).length;

    const message =
      assignedCount > 0
        ? `Are you sure you want to remove Handler "${handler.name}"? Note: ${assignedCount} lead(s) currently reference this Handler.`
        : `Are you sure you want to remove Handler "${handler.name}"?`;

    setConfirmModal({
      isOpen: true,
      title: `Delete Handler "${handler.name}"?`,
      description: message,
      confirmText: "Delete Handler",
      variant: "danger",
      itemCount: assignedCount > 0 ? assignedCount : undefined,
      itemLabel: "lead(s) referencing this handler",
      onConfirm: () => {
        const updatedHandlers = formData.handlers.filter((h) => h.id !== handler.id);
        let updatedActive = formData.activeFrontPageHandler;
        if (updatedActive === handler.name) {
          updatedActive = updatedHandlers[0]?.name || "all";
        }

        const updated = {
          ...formData,
          handlers: updatedHandlers,
          activeFrontPageHandler: updatedActive,
        };
        setFormData(updated);
        handleSaveAllChanges(updated);
        triggerFeedback(`Removed Handler "${handler.name}"`);
      },
    });
  };

  const handleResetHandlersToDefault = () => {
    setConfirmModal({
      isOpen: true,
      title: "Reset Handlers to Default?",
      description: "Reset Handlers to default preset (Helen, Athira, and Anjana)?",
      confirmText: "Reset Handlers",
      variant: "warning",
      onConfirm: () => {
        const updated = {
          ...formData,
          handlers: DEFAULT_HANDLERS,
          activeFrontPageHandler: "Helen",
        };
        setFormData(updated);
        handleSaveAllChanges(updated);
        triggerFeedback("Reset Handlers to Helen, Athira, and Anjana!");
      },
    });
  };

  const handleExecuteBulkReassignment = () => {
    if (!reassignFrom || !reassignTo) {
      triggerFeedback("Please select both source and target handlers.", "error");
      return;
    }
    if (reassignFrom === reassignTo) {
      triggerFeedback("Source and destination handlers cannot be the same.", "error");
      return;
    }

    const count = leads.filter(
      (l) => reassignFrom && l.handlerName?.toLowerCase() === reassignFrom.toLowerCase()
    ).length;

    if (count === 0) {
      triggerFeedback(`No active leads currently assigned to "${reassignFrom}".`, "info");
      return;
    }

    setConfirmModal({
      isOpen: true,
      title: `Reassign Leads?`,
      description: `Reassign all ${count} lead(s) from "${reassignFrom}" to "${reassignTo}"?`,
      confirmText: "Reassign All",
      variant: "primary",
      itemCount: count,
      itemLabel: "lead(s)",
      onConfirm: () => {
        onBulkReassignHandler(reassignFrom, reassignTo);
        setReassignSuccessMsg(`Successfully reassigned ${count} lead(s) to "${reassignTo}"`);
        setTimeout(() => setReassignSuccessMsg(null), 4000);
        triggerFeedback(`Reassigned ${count} lead(s) to "${reassignTo}"!`);
        setReassignFrom("");
        setReassignTo("");
      },
    });
  };

  // --- Quick Presets Management ---
  const handleAddPresetTag = (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = newPresetTag.trim();
    if (!trimmed) return;

    const current = formData.quickNotePresets || [];
    if (current.includes(trimmed)) {
      triggerFeedback("Preset note tag already exists.", "info");
      return;
    }

    const updatedPresets = [...current, trimmed];
    const updated = { ...formData, quickNotePresets: updatedPresets };
    setFormData(updated);
    handleSaveAllChanges(updated);
    setNewPresetTag("");
  };

  const handleRemovePresetTag = (tag: string) => {
    const current = formData.quickNotePresets || [];
    const updatedPresets = current.filter((t) => t !== tag);
    const updated = { ...formData, quickNotePresets: updatedPresets };
    setFormData(updated);
    handleSaveAllChanges(updated);
  };

  // --- Backup & Restore ---
  const handleDownloadFullBackup = () => {
    const backupData = {
      exportVersion: "2.0",
      exportedAt: new Date().toISOString(),
      softwareTitle: formData.softwareTitle,
      settings: formData,
      leadCount: leads.length,
      leads: leads,
    };

    const blob = new Blob([JSON.stringify(backupData, null, 2)], {
      type: "application/json",
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    const dateStr = new Date().toISOString().slice(0, 10);
    a.href = url;
    a.download = `lead-tracker-backup-${dateStr}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    triggerFeedback("Full system backup JSON downloaded successfully!");
  };

  const handleUploadBackupFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const text = event.target?.result as string;
        const parsed = JSON.parse(text);

        if (!parsed || (!parsed.leads && !parsed.settings)) {
          triggerFeedback("Invalid backup file structure.", "error");
          return;
        }

        const leadCount = Array.isArray(parsed.leads) ? parsed.leads.length : 0;

        setConfirmModal({
          isOpen: true,
          title: "Restore Backup?",
          description: `Restore backup with ${leadCount} lead(s) and workspace settings? This will update your active workspace.`,
          confirmText: "Restore Backup",
          variant: "warning",
          itemCount: leadCount,
          itemLabel: "lead(s)",
          onConfirm: () => {
            if (Array.isArray(parsed.leads)) {
              onRestoreLeads(parsed.leads);
            }
            if (parsed.settings) {
              setFormData(parsed.settings);
              onSaveSettings(parsed.settings);
            }
            triggerFeedback(`Restored ${leadCount} lead(s) and settings successfully!`);
          },
        });
      } catch (err) {
        console.error("Failed to parse backup JSON:", err);
        triggerFeedback("Failed to parse JSON file. Please ensure it is valid.", "error");
      }
    };
    reader.readAsText(file);
    // Reset input
    e.target.value = "";
  };

  const handleResetAllSettings = () => {
    setConfirmModal({
      isOpen: true,
      title: "Reset All Settings?",
      description: "Reset all software settings to initial factory defaults? Your lead data will NOT be deleted.",
      confirmText: "Reset All Settings",
      variant: "warning",
      onConfirm: () => {
        setFormData(DEFAULT_APP_SETTINGS);
        handleSaveAllChanges(DEFAULT_APP_SETTINGS);
        triggerFeedback("Reset all settings to factory default!");
      },
    });
  };

  // Approximate storage estimate
  const storageUsageKb = React.useMemo(() => {
    try {
      let total = 0;
      for (let x in localStorage) {
        if (localStorage.hasOwnProperty(x)) {
          total += (localStorage[x].length * 2);
        }
      }
      return (total / 1024).toFixed(1);
    } catch {
      return "0.0";
    }
  }, [leads, formData]);

  // If user is not authenticated for settings, display the Administrative Login page
  if (!isAuthenticated) {
    return (
      <SettingsLoginPage
        onLoginSuccess={() => setIsAuthenticated(true)}
        onNavigateToTracker={onNavigateToTracker}
      />
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col text-slate-900 pb-16">
      {/* Settings Top Bar */}
      <div className="bg-white border-b border-slate-200/90 shadow-2xs sticky top-0 z-30">
        <div className="w-full mx-auto px-4 sm:px-6 lg:px-8 xl:px-10 py-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <button
                id="btn-back-to-tracker"
                onClick={onNavigateToTracker}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs sm:text-sm font-semibold text-slate-700 bg-slate-100 hover:bg-slate-200 hover:text-slate-900 rounded-xl transition-colors cursor-pointer"
                title="Return to Lead Data Extractor & Call Tracker"
              >
                <ArrowLeft className="w-4 h-4" />
                <span>Back to Leads Tracker</span>
              </button>
              <div className="h-5 w-px bg-slate-200 hidden sm:block" />
              <div>
                <h1 className="text-lg sm:text-xl font-bold tracking-tight text-slate-900 flex items-center gap-2">
                  <span>Software Settings & Preferences</span>
                  <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-indigo-50 text-indigo-700 border border-indigo-200">
                    Configuration
                  </span>
                </h1>
                <p className="text-xs text-slate-500">
                  Manage Handler IDs (Helen, Athira, Anjana), workflow defaults, column rules & data backups
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <button
                id="btn-lock-settings"
                type="button"
                onClick={() => {
                  setSettingsSessionAuthenticated(false);
                  setIsAuthenticated(false);
                }}
                className="inline-flex items-center gap-1.5 px-3 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs sm:text-sm font-semibold rounded-xl border border-slate-200 transition-colors cursor-pointer"
                title="Lock Settings (Requires User ID & Password to access again)"
              >
                <Lock className="w-3.5 h-3.5 text-slate-500" />
                <span className="hidden sm:inline">Lock / Sign Out</span>
                <span className="sm:hidden">Lock</span>
              </button>

              <button
                id="btn-save-settings-bar"
                onClick={() => handleSaveAllChanges()}
                className="inline-flex items-center gap-1.5 px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white text-xs sm:text-sm font-semibold rounded-xl shadow-xs transition-colors cursor-pointer"
              >
                <Save className="w-4 h-4" />
                <span>Save All Changes</span>
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Floating or Inline Feedback Toast */}
      {saveStatus && (
        <div className="w-full mx-auto px-4 sm:px-6 lg:px-8 xl:px-10 mt-4">
          <div
            className={`p-3 rounded-xl border text-xs sm:text-sm flex items-center justify-between gap-2 animate-in fade-in duration-150 ${
              saveStatus.type === "success"
                ? "bg-emerald-50 border-emerald-200 text-emerald-800"
                : saveStatus.type === "error"
                ? "bg-rose-50 border-rose-200 text-rose-800"
                : "bg-blue-50 border-blue-200 text-blue-800"
            }`}
          >
            <div className="flex items-center gap-2">
              {saveStatus.type === "success" ? (
                <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
              ) : saveStatus.type === "error" ? (
                <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0" />
              ) : (
                <Info className="w-4 h-4 text-blue-600 shrink-0" />
              )}
              <span className="font-medium">{saveStatus.message}</span>
            </div>
            <button
              onClick={() => setSaveStatus(null)}
              className="text-slate-400 hover:text-slate-600 p-1 cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}

      {/* Main Settings Body with Sidebar Navigation */}
      <div className="w-full mx-auto px-4 sm:px-6 lg:px-8 xl:px-10 py-6 flex-1">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          {/* Navigation Sidebar */}
          <aside className="lg:col-span-3">
            <nav className="bg-white border border-slate-200/90 rounded-2xl p-2.5 shadow-2xs space-y-1">
              <button
                id="tab-handlers"
                onClick={() => setActiveTab("handlers")}
                className={`w-full flex items-center justify-between px-3.5 py-2.5 rounded-xl text-xs sm:text-sm font-semibold transition-all cursor-pointer ${
                  activeTab === "handlers"
                    ? "bg-indigo-600 text-white shadow-xs"
                    : "text-slate-600 hover:bg-slate-100 hover:text-slate-900"
                }`}
              >
                <div className="flex items-center gap-2.5">
                  <Users className="w-4 h-4" />
                  <span>Team & Handler IDs</span>
                </div>
                <span
                  className={`text-[11px] font-bold px-2 py-0.5 rounded-full ${
                    activeTab === "handlers"
                      ? "bg-indigo-700 text-white"
                      : "bg-slate-100 text-slate-600"
                  }`}
                >
                  {formData.handlers.length}
                </span>
              </button>

              <button
                id="tab-general"
                onClick={() => setActiveTab("general")}
                className={`w-full flex items-center gap-2.5 px-3.5 py-2.5 rounded-xl text-xs sm:text-sm font-semibold transition-all cursor-pointer ${
                  activeTab === "general"
                    ? "bg-indigo-600 text-white shadow-xs"
                    : "text-slate-600 hover:bg-slate-100 hover:text-slate-900"
                }`}
              >
                <Sliders className="w-4 h-4" />
                <span>General & Display</span>
              </button>

              <button
                id="tab-security"
                onClick={() => setActiveTab("security")}
                className={`w-full flex items-center gap-2.5 px-3.5 py-2.5 rounded-xl text-xs sm:text-sm font-semibold transition-all cursor-pointer ${
                  activeTab === "security"
                    ? "bg-indigo-600 text-white shadow-xs"
                    : "text-slate-600 hover:bg-slate-100 hover:text-slate-900"
                }`}
              >
                <ShieldCheck className="w-4 h-4" />
                <span>Security & Admin Login</span>
              </button>

              <button
                id="tab-rbac"
                onClick={() => setActiveTab("rbac")}
                className={`w-full flex items-center justify-between px-3.5 py-2.5 rounded-xl text-xs sm:text-sm font-semibold transition-all cursor-pointer ${
                  activeTab === "rbac"
                    ? "bg-indigo-600 text-white shadow-xs"
                    : "text-slate-600 hover:bg-slate-100 hover:text-slate-900"
                }`}
              >
                <div className="flex items-center gap-2.5">
                  <Shield className="w-4 h-4 text-emerald-500" />
                  <span>Access Control (RBAC)</span>
                </div>
                <span
                  className={`text-[10px] font-bold px-1.5 py-0.5 rounded ${
                    activeTab === "rbac"
                      ? "bg-indigo-700 text-white"
                      : "bg-emerald-50 text-emerald-700 border border-emerald-200"
                  }`}
                >
                  Roles & Perms
                </span>
              </button>

              <button
                id="tab-workflow"
                onClick={() => setActiveTab("workflow")}
                className={`w-full flex items-center gap-2.5 px-3.5 py-2.5 rounded-xl text-xs sm:text-sm font-semibold transition-all cursor-pointer ${
                  activeTab === "workflow"
                    ? "bg-indigo-600 text-white shadow-xs"
                    : "text-slate-600 hover:bg-slate-100 hover:text-slate-900"
                }`}
              >
                <PhoneCall className="w-4 h-4" />
                <span>Call & Follow-up Workflow</span>
              </button>

              <button
                id="tab-ingestion"
                onClick={() => setActiveTab("ingestion")}
                className={`w-full flex items-center gap-2.5 px-3.5 py-2.5 rounded-xl text-xs sm:text-sm font-semibold transition-all cursor-pointer ${
                  activeTab === "ingestion"
                    ? "bg-indigo-600 text-white shadow-xs"
                    : "text-slate-600 hover:bg-slate-100 hover:text-slate-900"
                }`}
              >
                <FileSpreadsheet className="w-4 h-4" />
                <span>Excel Ingestion Rules</span>
              </button>

              <button
                id="tab-data"
                onClick={() => setActiveTab("data")}
                className={`w-full flex items-center gap-2.5 px-3.5 py-2.5 rounded-xl text-xs sm:text-sm font-semibold transition-all cursor-pointer ${
                  activeTab === "data"
                    ? "bg-indigo-600 text-white shadow-xs"
                    : "text-slate-600 hover:bg-slate-100 hover:text-slate-900"
                }`}
              >
                <Database className="w-4 h-4" />
                <span>Data Backup & Storage</span>
              </button>
            </nav>

            {/* Quick Context Card */}
            <div className="mt-4 bg-indigo-50/70 border border-indigo-200/70 rounded-2xl p-4 text-xs space-y-2">
              <div className="flex items-center gap-1.5 font-bold text-indigo-900">
                <Sparkles className="w-4 h-4 text-indigo-600" />
                <span>Workspace Summary</span>
              </div>
              <p className="text-slate-600 leading-relaxed">
                Active leads: <strong className="text-slate-900">{leads.length}</strong>
                <br />
                Configured Handlers: <strong className="text-slate-900">{formData.handlers.length}</strong>
                <br />
                Active View: <strong className="text-indigo-800">{formData.activeFrontPageHandler}</strong>
              </p>
            </div>
          </aside>

          {/* Content Pane */}
          <main className="lg:col-span-9 space-y-6">
            {/* 1. TEAM & HANDLERS TAB */}
            {activeTab === "handlers" && (
              <div className="space-y-6 animate-in fade-in duration-150">
                {/* Section Overview */}
                <div className="bg-white border border-slate-200/90 rounded-2xl p-6 shadow-2xs">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-5 border-b border-slate-100">
                    <div>
                      <h2 className="text-base sm:text-lg font-bold text-slate-900 flex items-center gap-2">
                        <Users className="w-5 h-5 text-purple-600" />
                        Handler IDs Management
                      </h2>
                      <p className="text-xs text-slate-500 mt-0.5">
                        Define and customize Handler names (e.g. Helen, Athira, Anjana), their designations, and visual color badges.
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={handleResetHandlersToDefault}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-slate-600 bg-slate-100 hover:bg-slate-200 rounded-lg cursor-pointer transition-colors self-start sm:self-auto"
                      title="Reset back to Helen, Athira, and Anjana"
                    >
                      <RotateCcw className="w-3.5 h-3.5 text-slate-500" />
                      Reset to Default 3
                    </button>
                  </div>

                  {/* Add Handler Card */}
                  <form
                    onSubmit={handleAddHandler}
                    className="mt-6 bg-purple-50/50 border border-purple-100/90 rounded-2xl p-4 sm:p-5"
                  >
                    <h3 className="text-xs font-bold uppercase tracking-wider text-purple-900 flex items-center gap-1.5 mb-4">
                      <Plus className="w-4 h-4 text-purple-600" />
                      Add New Handler ID
                    </h3>
                    <div className="grid grid-cols-1 sm:grid-cols-12 gap-3.5">
                      <div className="sm:col-span-4">
                        <label className="block text-xs font-semibold text-slate-700 mb-1">
                          Handler Name / ID *
                        </label>
                        <input
                          type="text"
                          value={newHandlerName}
                          onChange={(e) => setNewHandlerName(e.target.value)}
                          placeholder="e.g. Helen, Priya, Alex"
                          required
                          className="w-full px-3 py-2 text-sm bg-white border border-slate-300 rounded-xl focus:ring-2 focus:ring-purple-500 focus:outline-none font-medium"
                        />
                      </div>

                      <div className="sm:col-span-4">
                        <label className="block text-xs font-semibold text-slate-700 mb-1">
                          Role / Title
                        </label>
                        <input
                          type="text"
                          value={newHandlerRole}
                          onChange={(e) => setNewHandlerRole(e.target.value)}
                          placeholder="e.g. Senior Lead Specialist"
                          className="w-full px-3 py-2 text-sm bg-white border border-slate-300 rounded-xl focus:ring-2 focus:ring-purple-500 focus:outline-none"
                        />
                      </div>

                      <div className="sm:col-span-4">
                        <label className="block text-xs font-semibold text-slate-700 mb-1">
                          Color Badge
                        </label>
                        <div className="flex items-center gap-1.5 pt-1.5">
                          {AVAILABLE_COLORS.map((col) => {
                            const style = getHandlerColorClasses(col);
                            return (
                              <button
                                type="button"
                                key={col}
                                onClick={() => setNewHandlerColor(col)}
                                className={`w-6 h-6 rounded-full border-2 transition-transform cursor-pointer ${
                                  style.avatar
                                } ${
                                  newHandlerColor === col
                                    ? "scale-110 ring-2 ring-purple-600 ring-offset-1 border-white"
                                    : "opacity-60 hover:opacity-100 border-transparent"
                                }`}
                                title={col}
                              />
                            );
                          })}
                        </div>
                      </div>

                      <div className="sm:col-span-5">
                        <label className="block text-xs font-semibold text-slate-700 mb-1">
                          Email (Optional)
                        </label>
                        <input
                          type="email"
                          value={newHandlerEmail}
                          onChange={(e) => setNewHandlerEmail(e.target.value)}
                          placeholder="handler@company.com"
                          className="w-full px-3 py-2 text-xs sm:text-sm bg-white border border-slate-300 rounded-xl focus:ring-2 focus:ring-purple-500 focus:outline-none"
                        />
                      </div>

                      <div className="sm:col-span-4">
                        <label className="block text-xs font-semibold text-slate-700 mb-1">
                          Direct Phone (Optional)
                        </label>
                        <input
                          type="text"
                          value={newHandlerPhone}
                          onChange={(e) => setNewHandlerPhone(e.target.value)}
                          placeholder="+1 (555) 000-0000"
                          className="w-full px-3 py-2 text-xs sm:text-sm bg-white border border-slate-300 rounded-xl focus:ring-2 focus:ring-purple-500 focus:outline-none"
                        />
                      </div>

                      <div className="sm:col-span-3 flex items-end">
                        <button
                          type="submit"
                          disabled={!newHandlerName.trim()}
                          className="w-full inline-flex items-center justify-center gap-1.5 px-4 py-2 bg-purple-600 hover:bg-purple-700 disabled:opacity-50 text-white text-xs sm:text-sm font-semibold rounded-xl shadow-xs transition-colors cursor-pointer"
                        >
                          <Plus className="w-4 h-4" />
                          Add Handler
                        </button>
                      </div>
                    </div>
                  </form>

                  {/* List of Configured Handlers */}
                  <div className="mt-6 space-y-3">
                    <h3 className="text-xs font-bold uppercase tracking-wider text-slate-500">
                      Configured Handlers ({formData.handlers.length})
                    </h3>

                    {formData.handlers.map((handler) => {
                      const isEditing = editingHandlerId === handler.id;
                      const colors = getHandlerColorClasses(handler.color);
                      const leadCount = leads.filter(
                        (l) => handler?.name && l.handlerName?.toLowerCase() === handler.name.toLowerCase()
                      ).length;

                      return (
                        <div
                          key={handler.id}
                          className={`p-4 rounded-2xl border transition-all ${
                            isEditing
                              ? "bg-purple-50/40 border-purple-300 shadow-sm"
                              : "bg-slate-50/50 border-slate-200/90 hover:border-slate-300 hover:bg-white"
                          }`}
                        >
                          {isEditing ? (
                            <div className="space-y-4">
                              <div className="grid grid-cols-1 sm:grid-cols-12 gap-3">
                                <div className="sm:col-span-4">
                                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                                    Handler Name *
                                  </label>
                                  <input
                                    type="text"
                                    value={editName}
                                    onChange={(e) => setEditName(e.target.value)}
                                    className="w-full px-3 py-1.5 text-sm bg-white border border-slate-300 rounded-lg focus:ring-2 focus:ring-purple-500 font-bold"
                                  />
                                </div>
                                <div className="sm:col-span-4">
                                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                                    Role / Designation
                                  </label>
                                  <input
                                    type="text"
                                    value={editRole}
                                    onChange={(e) => setEditRole(e.target.value)}
                                    className="w-full px-3 py-1.5 text-xs bg-white border border-slate-300 rounded-lg focus:ring-2 focus:ring-purple-500"
                                  />
                                </div>
                                <div className="sm:col-span-4">
                                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                                    Color
                                  </label>
                                  <div className="flex items-center gap-1 pt-1">
                                    {AVAILABLE_COLORS.map((col) => {
                                      const colStyle = getHandlerColorClasses(col);
                                      return (
                                        <button
                                          type="button"
                                          key={col}
                                          onClick={() => setEditColor(col)}
                                          className={`w-5 h-5 rounded-full border transition-transform cursor-pointer ${
                                            colStyle.avatar
                                          } ${
                                            editColor === col
                                              ? "scale-125 ring-2 ring-purple-600 ring-offset-1 border-white"
                                              : "opacity-50 hover:opacity-90 border-transparent"
                                          }`}
                                        />
                                      );
                                    })}
                                  </div>
                                </div>

                                <div className="sm:col-span-6">
                                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                                    Email
                                  </label>
                                  <input
                                    type="email"
                                    value={editEmail}
                                    onChange={(e) => setEditEmail(e.target.value)}
                                    className="w-full px-3 py-1.5 text-xs bg-white border border-slate-300 rounded-lg focus:ring-2 focus:ring-purple-500"
                                  />
                                </div>

                                <div className="sm:col-span-6">
                                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                                    Direct Phone
                                  </label>
                                  <input
                                    type="text"
                                    value={editPhone}
                                    onChange={(e) => setEditPhone(e.target.value)}
                                    className="w-full px-3 py-1.5 text-xs bg-white border border-slate-300 rounded-lg focus:ring-2 focus:ring-purple-500"
                                  />
                                </div>
                              </div>

                              <div className="flex justify-end gap-2 pt-1 border-t border-purple-100">
                                <button
                                  type="button"
                                  onClick={() => setEditingHandlerId(null)}
                                  className="px-3 py-1.5 text-xs font-medium text-slate-600 hover:bg-slate-100 rounded-lg cursor-pointer"
                                >
                                  Cancel
                                </button>
                                <button
                                  type="button"
                                  onClick={() => handleSaveEdit(handler.id)}
                                  className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-purple-600 hover:bg-purple-700 text-white text-xs font-semibold rounded-lg shadow-xs cursor-pointer"
                                >
                                  <Check className="w-3.5 h-3.5" />
                                  Save Changes
                                </button>
                              </div>
                            </div>
                          ) : (
                            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                              <div className="flex items-center gap-3.5 min-w-0">
                                <div
                                  className={`w-10 h-10 rounded-full flex items-center justify-center font-bold text-sm shadow-xs shrink-0 ${colors.avatar}`}
                                >
                                  {handler.name.charAt(0).toUpperCase()}
                                </div>
                                <div className="min-w-0">
                                  <div className="flex items-center flex-wrap gap-2">
                                    <span className="font-bold text-slate-900 text-sm">
                                      {handler.name}
                                    </span>
                                    <span
                                      className={`text-[10px] font-semibold px-2 py-0.5 rounded-full border ${colors.badge}`}
                                    >
                                      Handler ID
                                    </span>
                                    {formData.activeFrontPageHandler === handler.name && (
                                      <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-purple-100 text-purple-800 border border-purple-200">
                                        Default Front View
                                      </span>
                                    )}
                                    <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-slate-100 text-slate-600">
                                      {leadCount} {leadCount === 1 ? "lead" : "leads"}
                                    </span>
                                  </div>
                                  <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-slate-500 mt-1">
                                    <span>{handler.role || "Lead Specialist"}</span>
                                    {handler.email && (
                                      <span className="flex items-center gap-1 text-slate-400">
                                        <Mail className="w-3 h-3" />
                                        {handler.email}
                                      </span>
                                    )}
                                    {handler.phone && (
                                      <span className="flex items-center gap-1 text-slate-400">
                                        <Phone className="w-3 h-3" />
                                        {handler.phone}
                                      </span>
                                    )}
                                  </div>
                                </div>
                              </div>

                              <div className="flex items-center gap-1.5 self-end sm:self-auto shrink-0">
                                <button
                                  type="button"
                                  onClick={() => handleStartEdit(handler)}
                                  className="p-2 text-slate-400 hover:text-purple-600 hover:bg-purple-50 rounded-xl transition-colors cursor-pointer"
                                  title="Edit Handler Name / Role"
                                >
                                  <Edit2 className="w-4 h-4" />
                                </button>
                                <button
                                  type="button"
                                  onClick={() => handleDeleteHandler(handler)}
                                  className="p-2 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-xl transition-colors cursor-pointer"
                                  title="Delete Handler"
                                >
                                  <Trash2 className="w-4 h-4" />
                                </button>
                              </div>
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>

                {/* Bulk Reassignment Tool Card */}
                <div className="bg-white border border-slate-200/90 rounded-2xl p-6 shadow-2xs">
                  <div className="flex items-center gap-2 mb-2">
                    <Briefcase className="w-5 h-5 text-indigo-600" />
                    <h3 className="text-base font-bold text-slate-900">
                      Bulk Lead Reassignment Tool
                    </h3>
                  </div>
                  <p className="text-xs text-slate-500 mb-4">
                    Transfer all leads from one Handler ID to another in a single operation.
                  </p>

                  {reassignSuccessMsg && (
                    <div className="mb-4 p-3 bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs rounded-xl flex items-center gap-2">
                      <Check className="w-4 h-4 text-emerald-600 shrink-0" />
                      <span>{reassignSuccessMsg}</span>
                    </div>
                  )}

                  <div className="grid grid-cols-1 sm:grid-cols-12 gap-3 items-end bg-slate-50 p-4 rounded-xl border border-slate-200">
                    <div className="sm:col-span-5">
                      <label className="block text-xs font-semibold text-slate-700 mb-1">
                        Transfer Leads From:
                      </label>
                      <select
                        value={reassignFrom}
                        onChange={(e) => setReassignFrom(e.target.value)}
                        className="w-full px-3 py-2 text-xs sm:text-sm bg-white border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500 font-medium"
                      >
                        <option value="">Select source handler...</option>
                        {formData.handlers.map((h) => {
                          const count = leads.filter(
                            (l) => h?.name && l.handlerName?.toLowerCase() === h.name.toLowerCase()
                          ).length;
                          return (
                            <option key={h.id} value={h.name}>
                              {h.name} ({count} leads)
                            </option>
                          );
                        })}
                      </select>
                    </div>

                    <div className="sm:col-span-5">
                      <label className="block text-xs font-semibold text-slate-700 mb-1">
                        Assign New Handler To:
                      </label>
                      <select
                        value={reassignTo}
                        onChange={(e) => setReassignTo(e.target.value)}
                        className="w-full px-3 py-2 text-xs sm:text-sm bg-white border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500 font-medium"
                      >
                        <option value="">Select destination handler...</option>
                        {formData.handlers.map((h) => (
                          <option key={h.id} value={h.name}>
                            {h.name} ({h.role || "Specialist"})
                          </option>
                        ))}
                      </select>
                    </div>

                    <div className="sm:col-span-2">
                      <button
                        type="button"
                        onClick={handleExecuteBulkReassignment}
                        disabled={!reassignFrom || !reassignTo || reassignFrom === reassignTo}
                        className="w-full py-2 px-3 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white text-xs font-semibold rounded-lg shadow-xs transition-colors cursor-pointer"
                      >
                        Transfer Leads
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* 2. GENERAL & DISPLAY TAB */}
            {activeTab === "general" && (
              <div className="space-y-6 animate-in fade-in duration-150">
                <div className="bg-white border border-slate-200/90 rounded-2xl p-6 shadow-2xs space-y-6">
                  <div>
                    <h2 className="text-base sm:text-lg font-bold text-slate-900 flex items-center gap-2">
                      <Sliders className="w-5 h-5 text-purple-600" />
                      General & Display Preferences
                    </h2>
                    <p className="text-xs text-slate-500 mt-0.5">
                      Customize application headers, front page views, date displays, and density.
                    </p>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-5 pt-2">
                    {/* Software Title */}
                    <div>
                      <label className="block text-xs font-bold text-slate-700 mb-1.5">
                        Software / Application Title
                      </label>
                      <input
                        type="text"
                        value={formData.softwareTitle}
                        onChange={(e) =>
                          setFormData({ ...formData, softwareTitle: e.target.value })
                        }
                        className="w-full px-3.5 py-2 text-sm bg-slate-50 border border-slate-300 rounded-xl focus:bg-white focus:ring-2 focus:ring-purple-500 font-semibold text-slate-900"
                        placeholder="e.g. Lead & Payment Tracker"
                      />
                      <p className="text-[11px] text-slate-400 mt-1">
                        Displays in the top header and browser tab.
                      </p>
                    </div>

                    {/* Company / Department */}
                    <div>
                      <label className="block text-xs font-bold text-slate-700 mb-1.5">
                        Company or Team Department
                      </label>
                      <input
                        type="text"
                        value={formData.companyName || ""}
                        onChange={(e) =>
                          setFormData({ ...formData, companyName: e.target.value })
                        }
                        className="w-full px-3.5 py-2 text-sm bg-slate-50 border border-slate-300 rounded-xl focus:bg-white focus:ring-2 focus:ring-purple-500"
                        placeholder="e.g. Accounts & Client Operations"
                      />
                      <p className="text-[11px] text-slate-400 mt-1">
                        Optional organization label for reports and exports.
                      </p>
                    </div>

                    {/* Default Front Page Handler */}
                    <div>
                      <label className="block text-xs font-bold text-slate-700 mb-1.5">
                        Default Front Page Handler View
                      </label>
                      <select
                        value={formData.activeFrontPageHandler}
                        onChange={(e) =>
                          setFormData({ ...formData, activeFrontPageHandler: e.target.value })
                        }
                        className="w-full px-3.5 py-2 text-sm bg-slate-50 border border-slate-300 rounded-xl focus:bg-white focus:ring-2 focus:ring-purple-500 font-medium"
                      >
                        <option value="all">Show All Handlers (Combined Team View)</option>
                        {formData.handlers.map((h) => (
                          <option key={h.id} value={h.name}>
                            Handler: {h.name} ({h.role || "Specialist"})
                          </option>
                        ))}
                      </select>
                      <p className="text-[11px] text-slate-400 mt-1">
                        Determines which Handler filter is selected by default on load.
                      </p>
                    </div>

                    {/* Default Handler for New Leads */}
                    <div>
                      <label className="block text-xs font-bold text-slate-700 mb-1.5">
                        Default Assignment for New / Uploaded Leads
                      </label>
                      <select
                        value={formData.defaultNewLeadHandler}
                        onChange={(e) =>
                          setFormData({ ...formData, defaultNewLeadHandler: e.target.value })
                        }
                        className="w-full px-3.5 py-2 text-sm bg-slate-50 border border-slate-300 rounded-xl focus:bg-white focus:ring-2 focus:ring-purple-500 font-medium"
                      >
                        <option value="active">Assign to currently active front page Handler</option>
                        <option value="unassigned">Leave Unassigned</option>
                        {formData.handlers.map((h) => (
                          <option key={h.id} value={h.name}>
                            Always assign to {h.name}
                          </option>
                        ))}
                      </select>
                    </div>

                    {/* Date Format */}
                    <div>
                      <label className="block text-xs font-bold text-slate-700 mb-1.5">
                        Date Display Format
                      </label>
                      <select
                        value={formData.dateFormat || "MMM D, YYYY"}
                        onChange={(e) =>
                          setFormData({
                            ...formData,
                            dateFormat: e.target.value as any,
                          })
                        }
                        className="w-full px-3.5 py-2 text-sm bg-slate-50 border border-slate-300 rounded-xl focus:bg-white focus:ring-2 focus:ring-purple-500"
                      >
                        <option value="MMM D, YYYY">Sep 22, 2026 (Month Day, Year)</option>
                        <option value="YYYY-MM-DD">2026-09-22 (Standard ISO)</option>
                        <option value="DD/MM/YYYY">22/09/2026 (Day/Month/Year)</option>
                      </select>
                    </div>

                    {/* Table Density */}
                    <div>
                      <label className="block text-xs font-bold text-slate-700 mb-1.5">
                        Lead Table Row Density
                      </label>
                      <select
                        value={formData.tableDensity || "comfortable"}
                        onChange={(e) =>
                          setFormData({
                            ...formData,
                            tableDensity: e.target.value as "comfortable" | "compact",
                          })
                        }
                        className="w-full px-3.5 py-2 text-sm bg-slate-50 border border-slate-300 rounded-xl focus:bg-white focus:ring-2 focus:ring-purple-500"
                      >
                        <option value="comfortable">Comfortable (Spacious notes & buttons)</option>
                        <option value="compact">Compact (Higher row density per screen)</option>
                      </select>
                    </div>
                  </div>

                  <div className="pt-4 border-t border-slate-100 flex justify-end">
                    <button
                      type="button"
                      onClick={() => handleSaveAllChanges()}
                      className="inline-flex items-center gap-1.5 px-4 py-2 bg-purple-600 hover:bg-purple-700 text-white text-xs sm:text-sm font-semibold rounded-xl shadow-xs cursor-pointer"
                    >
                      <Save className="w-4 h-4" />
                      Save General Preferences
                    </button>
                  </div>
                </div>
              </div>
            )}

            {/* 3. SECURITY & ADMIN LOGIN TAB */}
            {activeTab === "security" && (
              <div className="space-y-6 animate-in fade-in duration-150">
                <div className="bg-white border border-slate-200/90 rounded-2xl p-6 shadow-2xs space-y-6">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-5 border-b border-slate-100">
                    <div>
                      <h2 className="text-base sm:text-lg font-bold text-slate-900 flex items-center gap-2">
                        <ShieldCheck className="w-5 h-5 text-indigo-600" />
                        Admin Access Credentials & Password
                      </h2>
                      <p className="text-xs text-slate-500 mt-0.5">
                        Manage the User ID, Password, and recovery email for accessing this settings dashboard.
                      </p>
                    </div>
                    <button
                      type="button"
                      id="btn-lock-settings-inline"
                      onClick={() => {
                        setSettingsSessionAuthenticated(false);
                        setIsAuthenticated(false);
                      }}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-rose-700 bg-rose-50 hover:bg-rose-100 border border-rose-200 rounded-lg cursor-pointer transition-colors self-start sm:self-auto"
                      title="Lock Settings immediately"
                    >
                      <Lock className="w-3.5 h-3.5" />
                      <span>Lock Settings Now</span>
                    </button>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
                    {/* User ID */}
                    <div>
                      <label className="block text-xs font-bold text-slate-700 mb-1.5">
                        Admin User ID
                      </label>
                      <input
                        id="input-edit-sec-userid"
                        type="text"
                        value={securityUserId}
                        onChange={(e) => setSecurityUserId(e.target.value)}
                        placeholder="admin"
                        className="w-full px-3.5 py-2 text-sm bg-slate-50 border border-slate-300 rounded-xl focus:bg-white focus:ring-2 focus:ring-indigo-500 font-semibold text-slate-900"
                      />
                      <p className="text-[11px] text-slate-400 mt-1">
                        Default: <strong className="font-mono text-slate-600">admin</strong>
                      </p>
                    </div>

                    {/* Password */}
                    <div>
                      <label className="block text-xs font-bold text-slate-700 mb-1.5">
                        Admin Password
                      </label>
                      <div className="relative">
                        <input
                          id="input-edit-sec-password"
                          type={showSecPassword ? "text" : "password"}
                          value={securityPassword}
                          onChange={(e) => setSecurityPassword(e.target.value)}
                          placeholder="Sam@1997"
                          className="w-full px-3.5 pr-10 py-2 text-sm bg-slate-50 border border-slate-300 rounded-xl focus:bg-white focus:ring-2 focus:ring-indigo-500 font-medium text-slate-900"
                        />
                        <button
                          type="button"
                          onClick={() => setShowSecPassword(!showSecPassword)}
                          className="absolute inset-y-0 right-0 pr-3 flex items-center text-slate-400 hover:text-slate-600 cursor-pointer"
                        >
                          {showSecPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                        </button>
                      </div>
                      <p className="text-[11px] text-slate-400 mt-1">
                        Default: <strong className="font-mono text-slate-600">Sam@1997</strong>
                      </p>
                    </div>

                    {/* Recovery Email */}
                    <div className="sm:col-span-2">
                      <label className="block text-xs font-bold text-slate-700 mb-1.5">
                        Registered Recovery Email Address (for OTP)
                      </label>
                      <div className="relative">
                        <input
                          id="input-edit-sec-email"
                          type="email"
                          value={securityEmail}
                          onChange={(e) => setSecurityEmail(e.target.value)}
                          placeholder="gatewaylawpartners@gmail.com"
                          className="w-full px-3.5 py-2 text-sm bg-slate-50 border border-slate-300 rounded-xl focus:bg-white focus:ring-2 focus:ring-indigo-500 font-medium text-slate-900"
                        />
                      </div>
                      <p className="text-[11px] text-slate-400 mt-1">
                        When "Forgot ID or Password?" is clicked on the login page, the 6-digit verification OTP code is dispatched to this email address.
                      </p>
                    </div>
                  </div>

                  <div className="pt-4 border-t border-slate-100 flex flex-wrap items-center justify-between gap-3">
                    <button
                      type="button"
                      id="btn-reset-sec-defaults"
                      onClick={handleResetSecurityToDefault}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-slate-600 bg-slate-100 hover:bg-slate-200 rounded-lg cursor-pointer transition-colors"
                    >
                      <RotateCcw className="w-3.5 h-3.5 text-slate-500" />
                      <span>Reset to admin / Sam@1997</span>
                    </button>

                    <button
                      type="button"
                      id="btn-save-admin-security"
                      onClick={handleSaveSecurityCredentials}
                      className="inline-flex items-center gap-1.5 px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white text-xs sm:text-sm font-semibold rounded-xl shadow-xs transition-colors cursor-pointer"
                    >
                      <Save className="w-4 h-4" />
                      <span>Update Credentials</span>
                    </button>
                  </div>
                </div>
              </div>
            )}

            {/* ROLE-BASED ACCESS CONTROL (RBAC) TAB */}
            {activeTab === "rbac" && (
              <RbacSettingsTab
                rbacConfig={currentRbac}
                onUpdateRbacConfig={(newCfg) => {
                  setCurrentRbac(newCfg);
                  if (onUpdateRbacConfig) {
                    onUpdateRbacConfig(newCfg);
                  }
                }}
                onNotification={(msg, type) => {
                  setSaveStatus({ message: msg, type: type || "success" });
                  setTimeout(() => setSaveStatus(null), 4000);
                }}
              />
            )}

            {/* 3. CALL & FOLLOW-UP WORKFLOW TAB */}
            {activeTab === "workflow" && (
              <div className="space-y-6 animate-in fade-in duration-150">
                <div className="bg-white border border-slate-200/90 rounded-2xl p-6 shadow-2xs space-y-6">
                  <div>
                    <h2 className="text-base sm:text-lg font-bold text-slate-900 flex items-center gap-2">
                      <PhoneCall className="w-5 h-5 text-purple-600" />
                      Call & Telecalling Workflow Settings
                    </h2>
                    <p className="text-xs text-slate-500 mt-0.5">
                      Configure attendance call statuses, default outcomes, and quick-note preset templates.
                    </p>
                  </div>

                  {/* Standard Call Status Overview */}
                  <div>
                    <h3 className="text-xs font-bold uppercase tracking-wider text-slate-600 mb-3">
                      Call Status Workflows
                    </h3>
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                      <div className="p-3.5 rounded-xl border border-emerald-200 bg-emerald-50/50">
                        <span className="text-xs font-bold px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800 border border-emerald-300">
                          Interested
                        </span>
                        <p className="text-xs text-slate-600 mt-2">
                          Client responded positively, payment acknowledged, or service confirmed.
                        </p>
                      </div>

                      <div className="p-3.5 rounded-xl border border-amber-200 bg-amber-50/50">
                        <span className="text-xs font-bold px-2 py-0.5 rounded-full bg-amber-100 text-amber-800 border border-amber-300">
                          Requires Follow-up
                        </span>
                        <p className="text-xs text-slate-600 mt-2">
                          Spoke with client, requested callback, pending receipt or documentation.
                        </p>
                      </div>

                      <div className="p-3.5 rounded-xl border border-indigo-200 bg-indigo-50/50">
                        <span className="text-xs font-bold px-2 py-0.5 rounded-full bg-indigo-100 text-indigo-800 border border-indigo-300">
                          Pending Call
                        </span>
                        <p className="text-xs text-slate-600 mt-2">
                          Freshly imported lead, not yet reached or dialed.
                        </p>
                      </div>

                      <div className="p-3.5 rounded-xl border border-slate-200 bg-slate-50">
                        <span className="text-xs font-bold px-2 py-0.5 rounded-full bg-slate-200 text-slate-800 border border-slate-300">
                          No Answer
                        </span>
                        <p className="text-xs text-slate-600 mt-2">
                          Ringing with no response, voicemail reached, or line busy.
                        </p>
                      </div>

                      <div className="p-3.5 rounded-xl border border-rose-200 bg-rose-50/50">
                        <span className="text-xs font-bold px-2 py-0.5 rounded-full bg-rose-100 text-rose-800 border border-rose-300">
                          Not Interested
                        </span>
                        <p className="text-xs text-slate-600 mt-2">
                          Client explicitly declined, canceled, or requested removal.
                        </p>
                      </div>
                    </div>
                  </div>

                  {/* Workflow Options */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-5 pt-3 border-t border-slate-100">
                    <div>
                      <label className="block text-xs font-bold text-slate-700 mb-1.5">
                        Default Status for Fresh / Extracted Leads
                      </label>
                      <select
                        value={formData.defaultLeadStatus || "Pending Call"}
                        onChange={(e) =>
                          setFormData({
                            ...formData,
                            defaultLeadStatus: e.target.value as CallStatus,
                          })
                        }
                        className="w-full px-3.5 py-2 text-sm bg-slate-50 border border-slate-300 rounded-xl focus:bg-white focus:ring-2 focus:ring-purple-500 font-medium"
                      >
                        <option value="Pending Call">Pending Call</option>
                        <option value="Requires Follow-up">Requires Follow-up</option>
                        <option value="Interested">Interested</option>
                        <option value="No Answer">No Answer</option>
                      </select>
                    </div>

                    <div className="flex items-center pt-5">
                      <label className="flex items-center gap-3 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={formData.autoIncrementCallOnDial ?? true}
                          onChange={(e) =>
                            setFormData({
                              ...formData,
                              autoIncrementCallOnDial: e.target.checked,
                            })
                          }
                          className="w-4 h-4 rounded text-purple-600 focus:ring-purple-500 cursor-pointer"
                        />
                        <span className="text-xs sm:text-sm font-semibold text-slate-700">
                          Auto-increment call count when clicking phone <code className="text-purple-600">tel:</code> link
                        </span>
                      </label>
                    </div>
                  </div>

                  {/* Daily Handler Assignment & PDF Reporting Logic */}
                  <div className="pt-4 border-t border-slate-100 space-y-3">
                    <div className="flex items-center justify-between">
                      <h3 className="text-xs font-bold uppercase tracking-wider text-slate-700 flex items-center gap-1.5">
                        <Clock className="w-4 h-4 text-purple-600" />
                        Daily PDF Reporting Logic (No Time Restrictions)
                      </h3>
                      <span className="text-[11px] font-bold px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200">
                        No Time Restrictions Active
                      </span>
                    </div>
                    <p className="text-xs text-slate-500">
                      The 11:00 PM cutoff time has been removed. All activities, Excel imports, and handler assignments processed throughout the entire day are compiled directly into the daily PDF report without any daily time restrictions or rollovers.
                    </p>

                    <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200 text-xs text-slate-700 space-y-1">
                      <p className="font-semibold text-slate-900">
                        ✓ Full 24-Hour Calendar Day Compilation Active
                      </p>
                      <p className="text-slate-600 text-[11px]">
                        Every lead assignment recorded for a date (whether assigned at 9:00 AM, 3:00 PM, 11:15 PM, or 11:59 PM) is automatically unified into that specific day&apos;s daily report with full Excel data preserved.
                      </p>
                    </div>
                  </div>

                  {/* Quick Note Presets */}
                  <div className="pt-4 border-t border-slate-100 space-y-3">
                    <h3 className="text-xs font-bold uppercase tracking-wider text-slate-700 flex items-center gap-1.5">
                      <Tag className="w-4 h-4 text-purple-600" />
                      Quick Call Notes Presets
                    </h3>
                    <p className="text-xs text-slate-500">
                      Preset snippets telecallers can quickly append to manual client notes during call logging.
                    </p>

                    {/* Presets Chips */}
                    <div className="flex flex-wrap gap-2 pt-1">
                      {(formData.quickNotePresets || []).map((preset) => (
                        <span
                          key={preset}
                          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium bg-slate-100 text-slate-800 border border-slate-200"
                        >
                          <span>{preset}</span>
                          <button
                            type="button"
                            onClick={() => handleRemovePresetTag(preset)}
                            className="p-0.5 text-slate-400 hover:text-rose-600 cursor-pointer"
                            title="Remove preset tag"
                          >
                            <X className="w-3 h-3" />
                          </button>
                        </span>
                      ))}
                    </div>

                    {/* Add new preset form */}
                    <form onSubmit={handleAddPresetTag} className="flex gap-2 max-w-md pt-2">
                      <input
                        type="text"
                        value={newPresetTag}
                        onChange={(e) => setNewPresetTag(e.target.value)}
                        placeholder="Add new preset snippet..."
                        className="flex-1 px-3 py-1.5 text-xs bg-slate-50 border border-slate-300 rounded-lg focus:bg-white focus:ring-2 focus:ring-purple-500"
                      />
                      <button
                        type="submit"
                        disabled={!newPresetTag.trim()}
                        className="px-3 py-1.5 bg-purple-600 hover:bg-purple-700 disabled:opacity-50 text-white text-xs font-semibold rounded-lg cursor-pointer transition-colors"
                      >
                        Add Tag
                      </button>
                    </form>
                  </div>

                  <div className="pt-4 border-t border-slate-100 flex justify-end">
                    <button
                      type="button"
                      onClick={() => handleSaveAllChanges()}
                      className="inline-flex items-center gap-1.5 px-4 py-2 bg-purple-600 hover:bg-purple-700 text-white text-xs sm:text-sm font-semibold rounded-xl shadow-xs cursor-pointer"
                    >
                      <Save className="w-4 h-4" />
                      Save Workflow Settings
                    </button>
                  </div>
                </div>
              </div>
            )}

            {/* 4. EXCEL INGESTION RULES TAB */}
            {activeTab === "ingestion" && (
              <div className="space-y-6 animate-in fade-in duration-150">
                <div className="bg-white border border-slate-200/90 rounded-2xl p-6 shadow-2xs space-y-6">
                  <div>
                    <h2 className="text-base sm:text-lg font-bold text-slate-900 flex items-center gap-2">
                      <FileSpreadsheet className="w-5 h-5 text-purple-600" />
                      Spreadsheet Auto-Ingestion & Parsing Rules
                    </h2>
                    <p className="text-xs text-slate-500 mt-0.5">
                      Configure how Excel and CSV files are analyzed, duplicate checking, and default mapping behaviors.
                    </p>
                  </div>

                  <div className="space-y-4 pt-2">
                    {/* Duplicate Detection Mode */}
                    <div className="p-4 bg-slate-50 rounded-xl border border-slate-200 space-y-2">
                      <label className="block text-xs font-bold text-slate-800">
                        Phone Number Duplicate Detection
                      </label>
                      <p className="text-xs text-slate-500">
                        Define behavior when an uploaded spreadsheet contains phone numbers already in your workspace.
                      </p>
                      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-1">
                        <label
                          className={`p-3 rounded-xl border cursor-pointer flex flex-col gap-1 transition-all ${
                            (formData.duplicateCheckMode || "warn") === "warn"
                              ? "bg-purple-50/70 border-purple-400 text-purple-900"
                              : "bg-white border-slate-200 text-slate-700 hover:border-slate-300"
                          }`}
                        >
                          <div className="flex items-center gap-2">
                            <input
                              type="radio"
                              name="duplicateCheck"
                              value="warn"
                              checked={(formData.duplicateCheckMode || "warn") === "warn"}
                              onChange={() =>
                                setFormData({ ...formData, duplicateCheckMode: "warn" })
                              }
                              className="text-purple-600"
                            />
                            <span className="text-xs font-bold">Warn & Allow</span>
                          </div>
                          <span className="text-[11px] text-slate-500 pl-5">
                            Highlight existing leads but allow import
                          </span>
                        </label>

                        <label
                          className={`p-3 rounded-xl border cursor-pointer flex flex-col gap-1 transition-all ${
                            formData.duplicateCheckMode === "skip"
                              ? "bg-purple-50/70 border-purple-400 text-purple-900"
                              : "bg-white border-slate-200 text-slate-700 hover:border-slate-300"
                          }`}
                        >
                          <div className="flex items-center gap-2">
                            <input
                              type="radio"
                              name="duplicateCheck"
                              value="skip"
                              checked={formData.duplicateCheckMode === "skip"}
                              onChange={() =>
                                setFormData({ ...formData, duplicateCheckMode: "skip" })
                              }
                              className="text-purple-600"
                            />
                            <span className="text-xs font-bold">Skip Duplicates</span>
                          </div>
                          <span className="text-[11px] text-slate-500 pl-5">
                            Omit rows matching existing phone numbers
                          </span>
                        </label>

                        <label
                          className={`p-3 rounded-xl border cursor-pointer flex flex-col gap-1 transition-all ${
                            formData.duplicateCheckMode === "allow"
                              ? "bg-purple-50/70 border-purple-400 text-purple-900"
                              : "bg-white border-slate-200 text-slate-700 hover:border-slate-300"
                          }`}
                        >
                          <div className="flex items-center gap-2">
                            <input
                              type="radio"
                              name="duplicateCheck"
                              value="allow"
                              checked={formData.duplicateCheckMode === "allow"}
                              onChange={() =>
                                setFormData({ ...formData, duplicateCheckMode: "allow" })
                              }
                              className="text-purple-600"
                            />
                            <span className="text-xs font-bold">Always Import</span>
                          </div>
                          <span className="text-[11px] text-slate-500 pl-5">
                            Import every row without checking
                          </span>
                        </label>
                      </div>
                    </div>

                    {/* Default Import Mode */}
                    <div className="p-4 bg-slate-50 rounded-xl border border-slate-200 space-y-2">
                      <label className="block text-xs font-bold text-slate-800">
                        Default Ingestion Action
                      </label>
                      <select
                        value={formData.defaultImportMode || "append"}
                        onChange={(e) =>
                          setFormData({
                            ...formData,
                            defaultImportMode: e.target.value as "append" | "replace",
                          })
                        }
                        className="w-full px-3.5 py-2 text-xs sm:text-sm bg-white border border-slate-300 rounded-xl focus:ring-2 focus:ring-purple-500"
                      >
                        <option value="append">Append new rows to active workspace (Preserve existing)</option>
                        <option value="replace">Replace workspace with newly uploaded file</option>
                      </select>
                    </div>

                    {/* Auto-fill Current Month */}
                    <div className="p-4 bg-slate-50 rounded-xl border border-slate-200">
                      <label className="flex items-start gap-3 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={formData.autoFillCurrentMonthIfMissing ?? true}
                          onChange={(e) =>
                            setFormData({
                              ...formData,
                              autoFillCurrentMonthIfMissing: e.target.checked,
                            })
                          }
                          className="w-4 h-4 rounded text-purple-600 focus:ring-purple-500 cursor-pointer mt-0.5"
                        />
                        <div>
                          <span className="text-xs sm:text-sm font-bold text-slate-800 block">
                            Auto-fill Current Month for Empty Month Cells
                          </span>
                          <span className="text-xs text-slate-500 block mt-0.5">
                            When an uploaded Excel file has blank month or year columns, automatically fill with the active month (e.g., "September 2026").
                          </span>
                        </div>
                      </label>
                    </div>
                  </div>

                  <div className="pt-4 border-t border-slate-100 flex justify-end">
                    <button
                      type="button"
                      onClick={() => handleSaveAllChanges()}
                      className="inline-flex items-center gap-1.5 px-4 py-2 bg-purple-600 hover:bg-purple-700 text-white text-xs sm:text-sm font-semibold rounded-xl shadow-xs cursor-pointer"
                    >
                      <Save className="w-4 h-4" />
                      Save Ingestion Rules
                    </button>
                  </div>
                </div>
              </div>
            )}

            {/* 5. DATA BACKUP & STORAGE TAB */}
            {activeTab === "data" && (
              <div className="space-y-6 animate-in fade-in duration-150">
                <div className="bg-white border border-slate-200/90 rounded-2xl p-6 shadow-2xs space-y-6">
                  <div>
                    <h2 className="text-base sm:text-lg font-bold text-slate-900 flex items-center gap-2">
                      <Database className="w-5 h-5 text-purple-600" />
                      Data Backup, Storage & Workspace Management
                    </h2>
                    <p className="text-xs text-slate-500 mt-0.5">
                      Export full system backups, restore from JSON files, and monitor local storage usage.
                    </p>
                  </div>

                  {/* Storage Metrics Cards */}
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                    <div className="p-3.5 bg-slate-50 border border-slate-200 rounded-xl">
                      <span className="text-[11px] font-semibold text-slate-500">Total Leads</span>
                      <div className="text-xl font-bold text-slate-900 mt-1">{leads.length}</div>
                    </div>
                    <div className="p-3.5 bg-purple-50 border border-purple-200 rounded-xl">
                      <span className="text-[11px] font-semibold text-purple-700">Handler IDs</span>
                      <div className="text-xl font-bold text-purple-900 mt-1">
                        {formData.handlers.length}
                      </div>
                    </div>
                    <div className="p-3.5 bg-blue-50 border border-blue-200 rounded-xl">
                      <span className="text-[11px] font-semibold text-blue-700">Storage Used</span>
                      <div className="text-xl font-bold text-blue-900 mt-1">{storageUsageKb} KB</div>
                    </div>
                    <div className="p-3.5 bg-emerald-50 border border-emerald-200 rounded-xl">
                      <span className="text-[11px] font-semibold text-emerald-700">Status</span>
                      <div className="text-xs font-bold text-emerald-800 mt-2 flex items-center gap-1">
                        <Check className="w-3.5 h-3.5" /> Healthy
                      </div>
                    </div>
                  </div>

                  {/* Backup & Restore Action Section */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2">
                    <div className="p-4 rounded-xl border border-slate-200 bg-slate-50/50 flex flex-col justify-between space-y-3">
                      <div>
                        <h4 className="text-xs font-bold text-slate-900 flex items-center gap-1.5">
                          <Download className="w-4 h-4 text-purple-600" />
                          Export System Backup (.json)
                        </h4>
                        <p className="text-xs text-slate-500 mt-1">
                          Download a complete JSON snapshot containing all {leads.length} lead records, manual notes, and custom Handler IDs.
                        </p>
                      </div>
                      <button
                        type="button"
                        onClick={handleDownloadFullBackup}
                        className="inline-flex items-center justify-center gap-1.5 px-4 py-2 bg-purple-600 hover:bg-purple-700 text-white text-xs font-semibold rounded-xl transition-colors cursor-pointer"
                      >
                        <Download className="w-3.5 h-3.5" />
                        Download Backup JSON
                      </button>
                    </div>

                    <div className="p-4 rounded-xl border border-slate-200 bg-slate-50/50 flex flex-col justify-between space-y-3">
                      <div>
                        <h4 className="text-xs font-bold text-slate-900 flex items-center gap-1.5">
                          <Upload className="w-4 h-4 text-indigo-600" />
                          Restore from Backup File (.json)
                        </h4>
                        <p className="text-xs text-slate-500 mt-1">
                          Restore an existing JSON backup file to instantly reload all records and handler configurations.
                        </p>
                      </div>
                      <input
                        type="file"
                        ref={fileInputRef}
                        accept=".json,application/json"
                        onChange={handleUploadBackupFile}
                        className="hidden"
                      />
                      <button
                        type="button"
                        onClick={() => fileInputRef.current?.click()}
                        className="inline-flex items-center justify-center gap-1.5 px-4 py-2 bg-white border border-slate-300 hover:bg-slate-100 text-slate-700 text-xs font-semibold rounded-xl transition-colors cursor-pointer"
                      >
                        <Upload className="w-3.5 h-3.5 text-slate-500" />
                        Upload & Restore JSON
                      </button>
                    </div>
                  </div>

                  {/* Spreadsheet Direct Exports */}
                  <div className="p-4 rounded-xl border border-slate-200 bg-slate-50 space-y-3">
                    <h4 className="text-xs font-bold text-slate-900 flex items-center gap-1.5">
                      <FileSpreadsheet className="w-4 h-4 text-emerald-600" />
                      Quick Spreadsheet Exports
                    </h4>
                    <p className="text-xs text-slate-500">
                      Export all active records directly to standard office formats:
                    </p>
                    <div className="flex flex-wrap gap-2.5">
                      <button
                        type="button"
                        onClick={() => exportLeadsToExcel(leads)}
                        disabled={leads.length === 0}
                        className="inline-flex items-center gap-1.5 px-3.5 py-2 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white text-xs font-semibold rounded-lg shadow-xs transition-colors cursor-pointer"
                      >
                        <FileSpreadsheet className="w-4 h-4" />
                        Export All to Excel (.xlsx)
                      </button>
                      <button
                        type="button"
                        onClick={() => exportLeadsToCsv(leads)}
                        disabled={leads.length === 0}
                        className="inline-flex items-center gap-1.5 px-3.5 py-2 bg-white border border-slate-300 hover:bg-slate-100 disabled:opacity-50 text-slate-700 text-xs font-semibold rounded-lg transition-colors cursor-pointer"
                      >
                        <Download className="w-4 h-4 text-slate-500" />
                        Export All to CSV
                      </button>
                    </div>
                  </div>

                  {/* Danger Zone */}
                  <div className="p-5 rounded-2xl border border-rose-200 bg-rose-50/40 space-y-4">
                    <h4 className="text-xs font-bold uppercase tracking-wider text-rose-800 flex items-center gap-1.5">
                      <AlertTriangle className="w-4 h-4 text-rose-600" />
                      Danger Zone
                    </h4>
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                      <button
                        type="button"
                        onClick={() => {
                          setConfirmModal({
                            isOpen: true,
                            title: "Reload Sample Leads?",
                            description: "Reload original 10 sample lead records? Any unsaved edits will be refreshed.",
                            confirmText: "Reload Sample",
                            variant: "primary",
                            onConfirm: () => {
                              onResetToSample();
                              triggerFeedback("Reloaded default sample leads!");
                            },
                          });
                        }}
                        className="px-3.5 py-2.5 rounded-xl bg-white border border-rose-200 text-slate-700 hover:bg-rose-50 text-xs font-semibold transition-colors cursor-pointer text-left"
                      >
                        <span className="block font-bold text-slate-800">Reload Sample Leads</span>
                        <span className="text-[11px] text-slate-500 block mt-0.5">
                          Load original 10 sample records
                        </span>
                      </button>

                      <button
                        type="button"
                        onClick={() => {
                          setConfirmModal({
                            isOpen: true,
                            title: "Clear All Lead Records?",
                            description: "Are you sure you want to delete ALL lead records? This cannot be undone unless you have an exported backup.",
                            confirmText: "Clear All Leads",
                            variant: "danger",
                            itemCount: leads.length,
                            itemLabel: "lead record(s)",
                            onConfirm: () => {
                              onClearAllLeads();
                              triggerFeedback("All lead records cleared!");
                            },
                          });
                        }}
                        className="px-3.5 py-2.5 rounded-xl bg-white border border-rose-200 text-rose-700 hover:bg-rose-50 text-xs font-semibold transition-colors cursor-pointer text-left"
                      >
                        <span className="block font-bold text-rose-700">Clear All Lead Records</span>
                        <span className="text-[11px] text-rose-500 block mt-0.5">
                          Empty lead workspace
                        </span>
                      </button>

                      <button
                        type="button"
                        onClick={handleResetAllSettings}
                        className="px-3.5 py-2.5 rounded-xl bg-white border border-rose-200 text-slate-700 hover:bg-rose-50 text-xs font-semibold transition-colors cursor-pointer text-left"
                      >
                        <span className="block font-bold text-slate-800">Reset All Settings</span>
                        <span className="text-[11px] text-slate-500 block mt-0.5">
                          Restore factory default settings
                        </span>
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* TAB: RBAC (Role-Based Access Control) */}
            {activeTab === "rbac" && (
              <div className="space-y-6">
                <RbacSettingsTab
                  rbacConfig={currentRbac}
                  onUpdateRbacConfig={(newCfg) => {
                    setCurrentRbac(newCfg);
                    if (onUpdateRbacConfig) {
                      onUpdateRbacConfig(newCfg);
                    }
                  }}
                  onNotification={(msg) => triggerFeedback(msg)}
                />
              </div>
            )}
          </main>
        </div>
      </div>

      {/* In-App Confirmation Modal (Replaces browser window.confirm) */}
      <ConfirmModal
        isOpen={confirmModal.isOpen}
        onClose={() => setConfirmModal((prev) => ({ ...prev, isOpen: false }))}
        onConfirm={confirmModal.onConfirm}
        title={confirmModal.title}
        description={confirmModal.description}
        confirmText={confirmModal.confirmText}
        cancelText={confirmModal.cancelText}
        variant={confirmModal.variant}
        itemCount={confirmModal.itemCount}
        itemLabel={confirmModal.itemLabel}
      />
    </div>
  );
};
