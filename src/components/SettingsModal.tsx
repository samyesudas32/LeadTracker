import React, { useState } from "react";
import { 
  X, 
  Settings, 
  UserCheck, 
  Plus, 
  Trash2, 
  Edit2, 
  Check, 
  Shield, 
  Sparkles,
  Palette,
  Briefcase,
  Mail,
  HelpCircle,
  RotateCcw
} from "lucide-react";
import { HandlerRecord, AppSettings } from "../types";
import { DEFAULT_HANDLERS, getHandlerColorClasses } from "../data/handlerDefaults";

interface SettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  settings: AppSettings;
  onSaveSettings: (newSettings: AppSettings) => void;
  onBulkReassignHandler?: (oldHandlerName: string, newHandlerName: string) => void;
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

export const SettingsModal: React.FC<SettingsModalProps> = ({
  isOpen,
  onClose,
  settings,
  onSaveSettings,
  onBulkReassignHandler,
}) => {
  const [activeTab, setActiveTab] = useState<"handlers" | "general">("handlers");
  const [handlers, setHandlers] = useState<HandlerRecord[]>(settings.handlers || DEFAULT_HANDLERS);
  const [activeFrontPageHandler, setActiveFrontPageHandler] = useState<string>(
    settings.activeFrontPageHandler || "Helen"
  );
  const [defaultNewLeadHandler, setDefaultNewLeadHandler] = useState<string>(
    settings.defaultNewLeadHandler || "active"
  );
  const [softwareTitle, setSoftwareTitle] = useState<string>(
    settings.softwareTitle || "Lead & Payment Tracker"
  );

  // New handler form state
  const [newHandlerName, setNewHandlerName] = useState("");
  const [newHandlerRole, setNewHandlerRole] = useState("Lead Specialist");
  const [newHandlerEmail, setNewHandlerEmail] = useState("");
  const [newHandlerColor, setNewHandlerColor] = useState<HandlerRecord["color"]>("purple");
  const [editingHandlerId, setEditingHandlerId] = useState<string | null>(null);
  const [editName, setEditName] = useState("");
  const [editRole, setEditRole] = useState("");
  const [editColor, setEditColor] = useState<HandlerRecord["color"]>("purple");

  // Reassignment prompt state when deleting or renaming
  const [saveFeedback, setSaveFeedback] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleAddHandler = (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = newHandlerName.trim();
    if (!trimmed) return;

    // Check duplicate
    if (handlers.some((h) => h?.name && trimmed && h.name.toLowerCase() === trimmed.toLowerCase())) {
      showFeedback(`Handler "${trimmed}" already exists.`);
      return;
    }

    const newHandler: HandlerRecord = {
      id: `handler-${Date.now()}`,
      name: trimmed,
      role: newHandlerRole.trim() || "Lead Specialist",
      email: newHandlerEmail.trim(),
      color: newHandlerColor,
      isDefault: handlers.length === 0,
      createdAt: new Date().toISOString(),
    };

    const updated = [...handlers, newHandler];
    setHandlers(updated);
    setNewHandlerName("");
    setNewHandlerEmail("");
    showFeedback(`Added Handler "${trimmed}" successfully!`);
  };

  const handleStartEdit = (handler: HandlerRecord) => {
    setEditingHandlerId(handler.id);
    setEditName(handler.name);
    setEditRole(handler.role || "");
    setEditColor(handler.color);
  };

  const handleSaveEdit = (id: string) => {
    const trimmed = editName.trim();
    if (!trimmed) return;

    const original = handlers.find((h) => h.id === id);
    const oldName = original?.name;

    const updated = handlers.map((h) => {
      if (h.id === id) {
        return {
          ...h,
          name: trimmed,
          role: editRole.trim() || h.role,
          color: editColor,
        };
      }
      return h;
    });

    setHandlers(updated);
    setEditingHandlerId(null);

    // If active handler was renamed, update it
    if (oldName && activeFrontPageHandler === oldName) {
      setActiveFrontPageHandler(trimmed);
    }

    // Optional prompt to update existing leads with this handler name
    if (oldName && oldName !== trimmed && onBulkReassignHandler) {
      onBulkReassignHandler(oldName, trimmed);
    }

    showFeedback(`Updated Handler details for "${trimmed}"`);
  };

  const handleDeleteHandler = (handler: HandlerRecord) => {
    if (handlers.length <= 1) {
      showFeedback("At least one Handler ID must remain configured.");
      return;
    }

    const updated = handlers.filter((h) => h.id !== handler.id);
    setHandlers(updated);

    if (activeFrontPageHandler === handler.name) {
      setActiveFrontPageHandler(updated[0]?.name || "all");
    }

    showFeedback(`Removed Handler "${handler.name}"`);
  };

  const showFeedback = (msg: string) => {
    setSaveFeedback(msg);
    setTimeout(() => setSaveFeedback(null), 3500);
  };

  const handleSaveAll = () => {
    const newSettings: AppSettings = {
      handlers,
      activeFrontPageHandler,
      defaultNewLeadHandler,
      softwareTitle,
    };
    onSaveSettings(newSettings);
    onClose();
  };

  const handleResetDefaults = () => {
    setHandlers(DEFAULT_HANDLERS);
    setActiveFrontPageHandler("Helen");
    showFeedback("Reset Handlers to Helen, Athira, and Anjana");
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-xs p-4 overflow-y-auto">
      <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 w-full max-w-3xl overflow-hidden animate-in fade-in zoom-in-95 duration-150 my-8">
        {/* Header */}
        <div className="px-6 py-5 border-b border-slate-100 flex items-center justify-between bg-slate-50/70">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-xl bg-purple-600 text-white shadow-xs">
              <Settings className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-slate-900 flex items-center gap-2">
                Software Settings & Handler IDs
              </h2>
              <p className="text-xs text-slate-500">
                Configure Handler ID names (e.g. Helen, Athira, Anjana), front page defaults & permissions
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-lg transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Tab Navigation */}
        <div className="px-6 border-b border-slate-200 bg-white flex gap-6">
          <button
            onClick={() => setActiveTab("handlers")}
            className={`py-3 text-sm font-semibold border-b-2 flex items-center gap-2 transition-colors cursor-pointer ${
              activeTab === "handlers"
                ? "border-purple-600 text-purple-700"
                : "border-transparent text-slate-500 hover:text-slate-800"
            }`}
          >
            <UserCheck className="w-4 h-4" />
            Handler IDs ({handlers.length})
          </button>
          <button
            onClick={() => setActiveTab("general")}
            className={`py-3 text-sm font-semibold border-b-2 flex items-center gap-2 transition-colors cursor-pointer ${
              activeTab === "general"
                ? "border-purple-600 text-purple-700"
                : "border-transparent text-slate-500 hover:text-slate-800"
            }`}
          >
            <Shield className="w-4 h-4" />
            Front Page & Defaults
          </button>
        </div>

        {/* Alert Feedback */}
        {saveFeedback && (
          <div className="mx-6 mt-4 p-3 bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs rounded-xl flex items-center gap-2">
            <Check className="w-4 h-4 text-emerald-600 shrink-0" />
            <span>{saveFeedback}</span>
          </div>
        )}

        {/* Body Content */}
        <div className="p-6 max-h-[65vh] overflow-y-auto space-y-6">
          {activeTab === "handlers" ? (
            <>
              {/* Add New Handler Form */}
              <div className="bg-purple-50/50 border border-purple-100 rounded-xl p-4">
                <h3 className="text-xs font-bold uppercase tracking-wider text-purple-900 flex items-center gap-1.5 mb-3">
                  <Plus className="w-4 h-4 text-purple-600" />
                  Add New Handler ID
                </h3>
                <form onSubmit={handleAddHandler} className="grid grid-cols-1 sm:grid-cols-12 gap-3">
                  <div className="sm:col-span-4">
                    <label className="block text-xs font-medium text-slate-700 mb-1">
                      Handler Name / ID *
                    </label>
                    <input
                      type="text"
                      value={newHandlerName}
                      onChange={(e) => setNewHandlerName(e.target.value)}
                      placeholder="e.g. Helen, Athira, Anjana"
                      required
                      className="w-full px-3 py-2 text-sm bg-white border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500 font-medium"
                    />
                  </div>

                  <div className="sm:col-span-4">
                    <label className="block text-xs font-medium text-slate-700 mb-1">
                      Role / Designation
                    </label>
                    <input
                      type="text"
                      value={newHandlerRole}
                      onChange={(e) => setNewHandlerRole(e.target.value)}
                      placeholder="e.g. Client Engagement"
                      className="w-full px-3 py-2 text-sm bg-white border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500"
                    />
                  </div>

                  <div className="sm:col-span-4">
                    <label className="block text-xs font-medium text-slate-700 mb-1">
                      Color Badge
                    </label>
                    <div className="flex items-center gap-1.5 pt-1">
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

                  <div className="sm:col-span-9">
                    <input
                      type="email"
                      value={newHandlerEmail}
                      onChange={(e) => setNewHandlerEmail(e.target.value)}
                      placeholder="Email address (optional)"
                      className="w-full px-3 py-1.5 text-xs bg-white border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500"
                    />
                  </div>

                  <div className="sm:col-span-3">
                    <button
                      type="submit"
                      disabled={!newHandlerName.trim()}
                      className="w-full inline-flex items-center justify-center gap-1.5 px-3 py-2 bg-purple-600 hover:bg-purple-700 disabled:opacity-50 text-white text-xs font-semibold rounded-lg shadow-xs transition-colors cursor-pointer"
                    >
                      <Plus className="w-3.5 h-3.5" />
                      Add Handler
                    </button>
                  </div>
                </form>
              </div>

              {/* Handlers List */}
              <div>
                <div className="flex items-center justify-between mb-3">
                  <div>
                    <h3 className="text-sm font-bold text-slate-800">
                      Configured Handler IDs ({handlers.length})
                    </h3>
                    <p className="text-xs text-slate-500">
                      These Handler names will appear in dropdowns, front page filter bars, and record assignment
                    </p>
                  </div>
                  <button
                    onClick={handleResetDefaults}
                    type="button"
                    className="inline-flex items-center gap-1 text-xs text-slate-500 hover:text-purple-700 hover:underline cursor-pointer"
                  >
                    <RotateCcw className="w-3 h-3" />
                    Reset to Default 3 (Helen, Athira, Anjana)
                  </button>
                </div>

                <div className="space-y-2.5">
                  {handlers.map((handler) => {
                    const isEditing = editingHandlerId === handler.id;
                    const colors = getHandlerColorClasses(handler.color);

                    return (
                      <div
                        key={handler.id}
                        className={`p-3.5 rounded-xl border transition-all ${
                          isEditing
                            ? "bg-purple-50/40 border-purple-300 shadow-sm"
                            : "bg-white border-slate-200 hover:border-slate-300"
                        }`}
                      >
                        {isEditing ? (
                          <div className="space-y-3">
                            <div className="grid grid-cols-1 sm:grid-cols-12 gap-3">
                              <div className="sm:col-span-5">
                                <label className="block text-[11px] font-semibold text-slate-600 mb-1">
                                  Handler Name *
                                </label>
                                <input
                                  type="text"
                                  value={editName}
                                  onChange={(e) => setEditName(e.target.value)}
                                  className="w-full px-3 py-1.5 text-sm bg-white border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500 font-bold"
                                />
                              </div>
                              <div className="sm:col-span-4">
                                <label className="block text-[11px] font-semibold text-slate-600 mb-1">
                                  Role / Position
                                </label>
                                <input
                                  type="text"
                                  value={editRole}
                                  onChange={(e) => setEditRole(e.target.value)}
                                  className="w-full px-3 py-1.5 text-xs bg-white border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500"
                                />
                              </div>
                              <div className="sm:col-span-3">
                                <label className="block text-[11px] font-semibold text-slate-600 mb-1">
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
                            </div>
                            <div className="flex justify-end gap-2 pt-1">
                              <button
                                type="button"
                                onClick={() => setEditingHandlerId(null)}
                                className="px-3 py-1.5 text-xs font-medium text-slate-600 hover:bg-slate-100 rounded-lg"
                              >
                                Cancel
                              </button>
                              <button
                                type="button"
                                onClick={() => handleSaveEdit(handler.id)}
                                className="inline-flex items-center gap-1 px-3 py-1.5 bg-purple-600 hover:bg-purple-700 text-white text-xs font-semibold rounded-lg shadow-xs"
                              >
                                <Check className="w-3.5 h-3.5" />
                                Save Changes
                              </button>
                            </div>
                          </div>
                        ) : (
                          <div className="flex items-center justify-between gap-4">
                            <div className="flex items-center gap-3 min-w-0">
                              <div
                                className={`w-9 h-9 rounded-full flex items-center justify-center font-bold text-sm shadow-xs ${colors.avatar}`}
                              >
                                {handler.name.charAt(0).toUpperCase()}
                              </div>
                              <div className="min-w-0">
                                <div className="flex items-center gap-2">
                                  <span className="font-bold text-slate-900 text-sm">
                                    {handler.name}
                                  </span>
                                  <span
                                    className={`text-[10px] font-semibold px-2 py-0.5 rounded-full border ${colors.badge}`}
                                  >
                                    Handler ID
                                  </span>
                                  {activeFrontPageHandler === handler.name && (
                                    <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-purple-100 text-purple-700 border border-purple-200">
                                      Active on Front Page
                                    </span>
                                  )}
                                </div>
                                <div className="flex items-center gap-3 text-xs text-slate-500 mt-0.5">
                                  <span>{handler.role || "Lead Specialist"}</span>
                                  {handler.email && (
                                    <span className="flex items-center gap-1 text-slate-400">
                                      <Mail className="w-3 h-3" />
                                      {handler.email}
                                    </span>
                                  )}
                                </div>
                              </div>
                            </div>

                            <div className="flex items-center gap-1 shrink-0">
                              <button
                                type="button"
                                onClick={() => handleStartEdit(handler)}
                                className="p-1.5 text-slate-400 hover:text-purple-600 hover:bg-purple-50 rounded-lg transition-colors cursor-pointer"
                                title="Edit Handler Name / Role"
                              >
                                <Edit2 className="w-4 h-4" />
                              </button>
                              <button
                                type="button"
                                onClick={() => handleDeleteHandler(handler)}
                                className="p-1.5 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors cursor-pointer"
                                title="Remove Handler"
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
            </>
          ) : (
            /* General Settings Tab */
            <div className="space-y-6">
              <div className="bg-slate-50 rounded-xl p-4 border border-slate-200 space-y-4">
                <h3 className="text-xs font-bold uppercase tracking-wider text-slate-700 flex items-center gap-2">
                  <UserCheck className="w-4 h-4 text-purple-600" />
                  Front Page Handler Assignment
                </h3>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                    Default Front Page Handler View
                  </label>
                  <select
                    value={activeFrontPageHandler}
                    onChange={(e) => setActiveFrontPageHandler(e.target.value)}
                    className="w-full px-3 py-2 text-sm bg-white border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500 font-medium"
                  >
                    <option value="all">Show All Handlers (Combined Team View)</option>
                    {handlers.map((h) => (
                      <option key={h.id} value={h.name}>
                        Handler: {h.name} ({h.role || "Specialist"})
                      </option>
                    ))}
                  </select>
                  <p className="text-[11px] text-slate-500 mt-1">
                    When you load the front page, the lead table and quick metrics can focus on this Handler by default. You can change it anytime with the selector on the front page.
                  </p>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                    Default Handler for Newly Uploaded / Added Leads
                  </label>
                  <select
                    value={defaultNewLeadHandler}
                    onChange={(e) => setDefaultNewLeadHandler(e.target.value)}
                    className="w-full px-3 py-2 text-sm bg-white border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500"
                  >
                    <option value="active">Assign to currently active front page Handler</option>
                    <option value="unassigned">Leave Unassigned</option>
                    {handlers.map((h) => (
                      <option key={h.id} value={h.name}>
                        Always assign to {h.name}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="bg-slate-50 rounded-xl p-4 border border-slate-200 space-y-3">
                <h3 className="text-xs font-bold uppercase tracking-wider text-slate-700 flex items-center gap-2">
                  <Briefcase className="w-4 h-4 text-slate-600" />
                  Software Customization
                </h3>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Application Title
                  </label>
                  <input
                    type="text"
                    value={softwareTitle}
                    onChange={(e) => setSoftwareTitle(e.target.value)}
                    className="w-full px-3 py-2 text-sm bg-white border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500"
                  />
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-slate-100 bg-slate-50/80 flex items-center justify-between">
          <div className="text-xs text-slate-500 flex items-center gap-1.5">
            <Sparkles className="w-4 h-4 text-purple-600" />
            <span>Changes persist automatically across sessions</span>
          </div>
          <div className="flex items-center gap-2.5">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-xs sm:text-sm font-medium text-slate-600 hover:bg-slate-200/70 rounded-lg transition-colors cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handleSaveAll}
              className="inline-flex items-center gap-1.5 px-4 py-2 bg-purple-600 hover:bg-purple-700 text-white text-xs sm:text-sm font-semibold rounded-lg shadow-xs shadow-purple-200 transition-colors cursor-pointer"
            >
              <Check className="w-4 h-4" />
              Save & Apply Settings
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
