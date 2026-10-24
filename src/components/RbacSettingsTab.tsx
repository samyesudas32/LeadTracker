import React, { useState } from "react";
import {
  Shield,
  ShieldCheck,
  ShieldAlert,
  Users,
  UserCheck,
  KeyRound,
  Plus,
  Trash2,
  Check,
  X,
  AlertTriangle,
  Sparkles,
  Info,
  Search,
  Filter,
  CheckCircle2,
  RotateCcw,
  Sliders,
  FileSpreadsheet,
  Download,
  FileText,
  Lock,
  Unlock,
  ChevronRight,
  UserPlus,
  Eye,
  RefreshCw,
} from "lucide-react";
import {
  RBACConfig,
  PermissionDefinition,
  UserAccount,
  AppRole,
} from "../types/rbac";
import {
  DEFAULT_INITIAL_STAFF_PERMISSIONS,
  DEFAULT_INITIAL_MANAGER_PERMISSIONS,
} from "../data/rbacDefaults";
import {
  getCurrentAuthUser,
  setCurrentAuthUser,
  adminResetStaffCredentials,
  updateRolePermission,
  addDynamicPermission,
  saveRbacConfigLocally,
} from "../utils/authService";
import { apiClient } from "../services/apiClient";

interface RbacSettingsTabProps {
  rbacConfig: RBACConfig;
  onUpdateRbacConfig: (newConfig: RBACConfig) => void;
  onNotification?: (msg: string, type?: "success" | "info" | "error") => void;
}

export const RbacSettingsTab: React.FC<RbacSettingsTabProps> = ({
  rbacConfig,
  onUpdateRbacConfig,
  onNotification,
}) => {
  const [currentUser, setCurrentUser] = useState<UserAccount>(() => getCurrentAuthUser());
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedCategory, setSelectedCategory] = useState<string>("All");
  const [isUpdating, setIsUpdating] = useState<string | null>(null);

  // Add Dynamic Permission Modal
  const [isAddPermModalOpen, setIsAddPermModalOpen] = useState(false);
  const [newPermKey, setNewPermKey] = useState("");
  const [newPermLabel, setNewPermLabel] = useState("");
  const [newPermDesc, setNewPermDesc] = useState("");
  const [newPermCategory, setNewPermCategory] = useState<PermissionDefinition["category"]>("Custom");
  const [newPermDefaultStaff, setNewPermDefaultStaff] = useState(false);
  const [permFormError, setPermFormError] = useState<string | null>(null);

  // Add User Modal
  const [isAddUserModalOpen, setIsAddUserModalOpen] = useState(false);
  const [newUsername, setNewUsername] = useState("");
  const [newDisplayName, setNewDisplayName] = useState("");
  const [newUserEmail, setNewUserEmail] = useState("");
  const [newUserRole, setNewUserRole] = useState<AppRole>("staff");
  const [newUserPassword, setNewUserPassword] = useState("Staff@123");
  const [userFormError, setUserFormError] = useState<string | null>(null);

  // Active role toggle feedback
  const [feedbackMsg, setFeedbackMsg] = useState<string | null>(null);

  const staffPerms = rbacConfig.rolePermissions?.staff || {};
  const totalPermsCount = rbacConfig.permissions.length;
  const staffAllowedCount = rbacConfig.permissions.filter((p) => Boolean(staffPerms[p.id])).length;

  const showToast = (msg: string, type: "success" | "info" | "error" = "success") => {
    setFeedbackMsg(msg);
    if (onNotification) onNotification(msg, type);
    setTimeout(() => {
      setFeedbackMsg(null);
    }, 4000);
  };

  // Toggle Staff Permission dynamically
  const handleToggleStaffPermission = async (permissionId: string) => {
    const currentVal = Boolean(staffPerms[permissionId]);
    const nextVal = !currentVal;
    setIsUpdating(permissionId);

    try {
      const updatedStaff = {
        ...staffPerms,
        [permissionId]: nextVal,
      };

      const nextConfig: RBACConfig = {
        ...rbacConfig,
        rolePermissions: {
          ...rbacConfig.rolePermissions,
          staff: updatedStaff,
        },
        lastUpdated: new Date().toISOString(),
      };

      onUpdateRbacConfig(nextConfig);
      saveRbacConfigLocally(nextConfig);
      await updateRolePermission("staff", permissionId, nextVal);

      showToast(
        `Staff permission "${permissionId}" ${nextVal ? "GRANTED" : "REVOKED"} successfully!`,
        nextVal ? "success" : "info"
      );
    } catch (err: any) {
      showToast(`Failed to update permission: ${err.message}`, "error");
    } finally {
      setIsUpdating(null);
    }
  };

  // Quick Preset Handlers
  const handleApplyPreset = async (presetType: "limited" | "power" | "all") => {
    let nextStaff: Record<string, boolean> = {};

    if (presetType === "limited") {
      nextStaff = { ...DEFAULT_INITIAL_STAFF_PERMISSIONS };
    } else if (presetType === "power") {
      nextStaff = {
        ...DEFAULT_INITIAL_STAFF_PERMISSIONS,
        "files:upload": true,
        "export:excel": true,
        "export:csv": true,
        "reports:pdf": true,
        "leads:reassign_handler": true,
      };
    } else if (presetType === "all") {
      rbacConfig.permissions.forEach((p) => {
        nextStaff[p.id] = true;
      });
    }

    const nextConfig: RBACConfig = {
      ...rbacConfig,
      rolePermissions: {
        ...rbacConfig.rolePermissions,
        staff: nextStaff,
      },
      lastUpdated: new Date().toISOString(),
    };

    onUpdateRbacConfig(nextConfig);
    saveRbacConfigLocally(nextConfig);

    try {
      await apiClient.updateRolePermissions("staff", nextStaff);
      showToast(`Applied preset: ${presetType.toUpperCase()} permissions to Staff role.`, "success");
    } catch {
      showToast(`Applied preset locally.`, "info");
    }
  };

  // Create Dynamic Permission
  const handleCreateDynamicPermission = async (e: React.FormEvent) => {
    e.preventDefault();
    setPermFormError(null);

    const cleanKey = newPermKey.trim().toLowerCase().replace(/[^a-z0-9_:-]/g, "_");
    if (!cleanKey) {
      setPermFormError("Permission key is required.");
      return;
    }

    if (!newPermLabel.trim()) {
      setPermFormError("Permission label is required.");
      return;
    }

    const newDef: PermissionDefinition = {
      id: cleanKey,
      label: newPermLabel.trim(),
      description: newPermDesc.trim() || `Custom dynamic permission: ${newPermLabel.trim()}`,
      category: newPermCategory,
      isCustom: true,
    };

    try {
      const nextPerms = [...rbacConfig.permissions.filter((p) => p.id !== cleanKey), newDef];
      const nextConfig: RBACConfig = {
        ...rbacConfig,
        permissions: nextPerms,
        rolePermissions: {
          ...rbacConfig.rolePermissions,
          manager: {
            ...rbacConfig.rolePermissions.manager,
            [cleanKey]: true,
          },
          staff: {
            ...rbacConfig.rolePermissions.staff,
            [cleanKey]: newPermDefaultStaff,
          },
        },
        lastUpdated: new Date().toISOString(),
      };

      onUpdateRbacConfig(nextConfig);
      await addDynamicPermission(newDef, newPermDefaultStaff);

      setIsAddPermModalOpen(false);
      setNewPermKey("");
      setNewPermLabel("");
      setNewPermDesc("");
      showToast(`New dynamic permission "${newDef.label}" added to system!`, "success");
    } catch (err: any) {
      setPermFormError(err?.message || "Failed to add permission.");
    }
  };

  // Create User Account
  const handleCreateUser = async (e: React.FormEvent) => {
    e.preventDefault();
    setUserFormError(null);

    const cleanUsername = newUsername.trim().toLowerCase();
    if (!cleanUsername) {
      setUserFormError("Username is required.");
      return;
    }

    if (rbacConfig.users.some((u) => u.username.toLowerCase() === cleanUsername)) {
      setUserFormError("A user with this username already exists.");
      return;
    }

    const newUser: UserAccount = {
      id: `user-${Date.now()}`,
      username: cleanUsername,
      displayName: newDisplayName.trim() || cleanUsername,
      role: newUserRole,
      email: newUserEmail.trim(),
      password: newUserPassword,
      status: "active",
      createdAt: new Date().toISOString(),
    };

    try {
      const nextUsers = [...rbacConfig.users, newUser];
      const nextConfig: RBACConfig = {
        ...rbacConfig,
        users: nextUsers,
        lastUpdated: new Date().toISOString(),
      };

      onUpdateRbacConfig(nextConfig);
      saveRbacConfigLocally(nextConfig);
      await apiClient.saveRbacUser(newUser);

      setIsAddUserModalOpen(false);
      setNewUsername("");
      setNewDisplayName("");
      setNewUserEmail("");
      showToast(`User account "${newUser.username}" created successfully!`, "success");
    } catch (err: any) {
      setUserFormError(err?.message || "Failed to create user account.");
    }
  };

  // Staff Credentials Reset Modal State (Manager Admin Control)
  const [resetStaffTarget, setResetStaffTarget] = useState<UserAccount | null>(null);
  const [resetStaffUsername, setResetStaffUsername] = useState("");
  const [resetStaffDisplayName, setResetStaffDisplayName] = useState("");
  const [resetStaffEmail, setResetStaffEmail] = useState("");
  const [resetStaffNewPassword, setResetStaffNewPassword] = useState("");
  const [resetStaffConfirmPassword, setResetStaffConfirmPassword] = useState("");
  const [resetStaffLoading, setResetStaffLoading] = useState(false);
  const [resetStaffError, setResetStaffError] = useState<string | null>(null);

  const handleOpenResetStaffModal = (user: UserAccount) => {
    setResetStaffTarget(user);
    setResetStaffUsername(user.username);
    setResetStaffDisplayName(user.displayName || user.username);
    setResetStaffEmail(user.email || "");
    setResetStaffNewPassword("");
    setResetStaffConfirmPassword("");
    setResetStaffError(null);
  };

  const handleSaveResetStaffCredentials = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!resetStaffTarget) return;
    setResetStaffError(null);

    const cleanUsername = resetStaffUsername.trim().toLowerCase();
    if (!cleanUsername) {
      setResetStaffError("Staff User ID cannot be empty.");
      return;
    }

    if (resetStaffNewPassword) {
      if (resetStaffNewPassword.length < 4) {
        setResetStaffError("New Password must be at least 4 characters long.");
        return;
      }
      if (resetStaffNewPassword !== resetStaffConfirmPassword) {
        setResetStaffError("New Password and Confirm Password do not match.");
        return;
      }
    }

    setResetStaffLoading(true);

    try {
      const res = await adminResetStaffCredentials({
        staffUserId: resetStaffTarget.id || resetStaffTarget.username,
        newUserId: cleanUsername,
        newPassword: resetStaffNewPassword || undefined,
        displayName: resetStaffDisplayName.trim() || undefined,
        email: resetStaffEmail.trim() || undefined,
      });

      if (res.success && res.user) {
        const nextUsers = rbacConfig.users.map((u) =>
          u.id === resetStaffTarget.id || u.username === resetStaffTarget.username
            ? { ...u, ...res.user }
            : u
        );
        const nextConfig: RBACConfig = {
          ...rbacConfig,
          users: nextUsers,
          lastUpdated: new Date().toISOString(),
        };
        onUpdateRbacConfig(nextConfig);
        saveRbacConfigLocally(nextConfig);
        showToast(
          res.message || `Credentials for "${cleanUsername}" successfully updated!`,
          "success"
        );
        setResetStaffTarget(null);
      } else {
        setResetStaffError(res.error || "Failed to reset staff credentials.");
      }
    } catch (err: any) {
      setResetStaffError(err?.message || "An unexpected error occurred while resetting credentials.");
    } finally {
      setResetStaffLoading(false);
    }
  };

  // Delete User Account
  const handleDeleteUser = async (user: UserAccount) => {
    if (user.username === "admin") {
      showToast("Cannot delete primary admin account.", "error");
      return;
    }

    const nextUsers = rbacConfig.users.filter((u) => u.id !== user.id);
    const nextConfig: RBACConfig = {
      ...rbacConfig,
      users: nextUsers,
      lastUpdated: new Date().toISOString(),
    };

    onUpdateRbacConfig(nextConfig);
    saveRbacConfigLocally(nextConfig);

    try {
      await apiClient.deleteRbacUser(user.id);
      showToast(`User ${user.username} deleted.`, "info");
    } catch {
      showToast(`User removed locally.`, "info");
    }
  };

  // Filter permissions
  const filteredPermissions = rbacConfig.permissions.filter((p) => {
    const matchesCategory = selectedCategory === "All" || p.category === selectedCategory;
    const matchesQuery =
      p.label.toLowerCase().includes(searchQuery.toLowerCase()) ||
      p.id.toLowerCase().includes(searchQuery.toLowerCase()) ||
      p.description.toLowerCase().includes(searchQuery.toLowerCase());
    return matchesCategory && matchesQuery;
  });

  const categories = ["All", "Leads", "Files & Data", "Export & Reports", "Administration", "Custom"];

  return (
    <div className="space-y-8 animate-in fade-in pb-12">
      {/* Toast Notification */}
      {feedbackMsg && (
        <div className="fixed bottom-6 right-6 z-50 bg-slate-900 text-white px-4 py-3 rounded-xl shadow-xl flex items-center gap-3 border border-slate-700 animate-in slide-in-from-bottom">
          <CheckCircle2 className="w-5 h-5 text-emerald-400 shrink-0" />
          <span className="text-sm font-medium">{feedbackMsg}</span>
        </div>
      )}

      {/* Header Banner */}
      <div className="bg-gradient-to-r from-slate-900 via-indigo-950 to-slate-900 text-white p-6 rounded-2xl shadow-lg border border-indigo-900/40 relative overflow-hidden">
        <div className="absolute right-0 top-0 bottom-0 w-96 bg-[radial-gradient(ellipse_at_top_right,_var(--tw-gradient-stops))] from-indigo-500/10 via-transparent to-transparent pointer-events-none" />
        <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div className="space-y-2">
            <div className="inline-flex items-center gap-2 px-2.5 py-1 rounded-full bg-indigo-500/20 border border-indigo-400/30 text-indigo-300 text-xs font-semibold tracking-wide uppercase">
              <ShieldCheck className="w-3.5 h-3.5" />
              <span>Role-Based Access Control System</span>
            </div>
            <h2 className="text-2xl font-bold tracking-tight text-white">
              Dynamic Permissions & Role Governance
            </h2>
            <p className="text-slate-300 text-sm max-w-2xl leading-relaxed">
              Two distinct roles govern access: <strong>Manager</strong> holds full, unrestricted access across all software capabilities. <strong>Staff</strong> begins with limited operational permissions, which you can dynamically expand, update, or restrict at any stage in real time.
            </p>
          </div>

          {/* Credential Governance Policy Card */}
          <div className="bg-white/10 backdrop-blur-md border border-white/20 p-3.5 rounded-xl flex flex-col gap-2 shrink-0 sm:min-w-[280px]">
            <div className="flex items-center justify-between text-xs text-slate-300 font-medium">
              <span className="flex items-center gap-1.5">
                <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />
                <span>Credential Governance</span>
              </span>
              <span className="text-[11px] px-2 py-0.5 rounded bg-emerald-500/20 text-emerald-300 font-bold border border-emerald-500/30">
                Secure Isolation
              </span>
            </div>
            <div className="p-2.5 bg-black/25 rounded-lg text-xs text-slate-200 space-y-1">
              <p className="font-semibold text-white flex items-center gap-1.5">
                <span>🔐</span>
                <span>Independent Account Settings</span>
              </p>
              <p className="text-[11px] text-slate-300 leading-relaxed">
                All accounts independently manage their credentials. Managers can reset staff credentials using the table below.
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Role Comparison Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
        {/* Manager Card */}
        <div className="bg-white rounded-2xl p-5 border border-indigo-100 shadow-sm relative overflow-hidden flex flex-col justify-between">
          <div className="space-y-3">
            <div className="flex items-start justify-between">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 rounded-xl bg-indigo-50 text-indigo-600 flex items-center justify-center text-xl shadow-xs">
                  👑
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <h3 className="text-base font-bold text-slate-900">Manager Role</h3>
                    <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-indigo-100 text-indigo-800 uppercase tracking-wider">
                      Full Access
                    </span>
                  </div>
                  <p className="text-xs text-slate-500">Unrestricted operational and administrative authority</p>
                </div>
              </div>
              <span className="text-xs font-bold text-indigo-600 bg-indigo-50 px-2 py-1 rounded-md border border-indigo-200">
                100% Granted
              </span>
            </div>
            <p className="text-xs text-slate-600 leading-normal">
              Managers have permanent access to all tracker features, ingestion, spreadsheets, handler workloads, PDF reporting, export tools, system preferences, and user role provisioning.
            </p>
          </div>
          <div className="mt-4 pt-3 border-t border-slate-100 flex items-center justify-between text-xs text-slate-500">
            <span className="font-medium text-slate-700">All {totalPermsCount} system permissions</span>
            <span className="text-emerald-600 font-semibold flex items-center gap-1">
              <Check className="w-3.5 h-3.5" /> Immutable Access
            </span>
          </div>
        </div>

        {/* Staff Card */}
        <div className="bg-white rounded-2xl p-5 border border-slate-200 shadow-sm relative overflow-hidden flex flex-col justify-between">
          <div className="space-y-3">
            <div className="flex items-start justify-between">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 rounded-xl bg-teal-50 text-teal-600 flex items-center justify-center text-xl shadow-xs">
                  👤
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <h3 className="text-base font-bold text-slate-900">Staff Role</h3>
                    <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-teal-100 text-teal-800 uppercase tracking-wider">
                      Configurable
                    </span>
                  </div>
                  <p className="text-xs text-slate-500">Dynamically customized feature permissions</p>
                </div>
              </div>
              <span className="text-xs font-bold text-teal-700 bg-teal-50 px-2 py-1 rounded-md border border-teal-200">
                {staffAllowedCount} of {totalPermsCount} Active
              </span>
            </div>
            <p className="text-xs text-slate-600 leading-normal">
              Staff initially has limited permissions (viewing leads, updating call status, and editing notes). Managers can toggle any permission on or off dynamically below at any time without software redeployment.
            </p>
          </div>

          {/* Quick Presets Bar */}
          <div className="mt-4 pt-3 border-t border-slate-100 flex flex-wrap items-center justify-between gap-2 text-xs">
            <span className="text-slate-500 font-medium">Quick Presets:</span>
            <div className="flex items-center gap-1.5">
              <button
                type="button"
                id="btn-preset-limited"
                onClick={() => handleApplyPreset("limited")}
                className="px-2 py-1 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded text-[11px] font-semibold transition-colors cursor-pointer"
              >
                Strict Limited
              </button>
              <button
                type="button"
                id="btn-preset-power"
                onClick={() => handleApplyPreset("power")}
                className="px-2 py-1 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 rounded text-[11px] font-semibold transition-colors cursor-pointer"
              >
                Power Staff
              </button>
              <button
                type="button"
                id="btn-preset-all"
                onClick={() => handleApplyPreset("all")}
                className="px-2 py-1 bg-teal-50 hover:bg-teal-100 text-teal-700 rounded text-[11px] font-semibold transition-colors cursor-pointer"
              >
                Full Access
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Dynamic Permission Matrix Section */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
        {/* Toolbar */}
        <div className="p-5 border-b border-slate-200 flex flex-col md:flex-row md:items-center justify-between gap-4 bg-slate-50/50">
          <div>
            <h3 className="text-base font-bold text-slate-900 flex items-center gap-2">
              <ShieldCheck className="w-5 h-5 text-indigo-600" />
              <span>Dynamic Permission Matrix</span>
            </h3>
            <p className="text-xs text-slate-500 mt-0.5">
              Toggle any permission for the Staff role. Changes apply across all PCs and sessions in real-time.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2.5">
            {/* Search */}
            <div className="relative">
              <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search permissions..."
                className="pl-9 pr-3 py-1.5 text-xs bg-white border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-100 focus:border-indigo-500 w-48 text-slate-800"
              />
              {searchQuery && (
                <button
                  type="button"
                  onClick={() => setSearchQuery("")}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              )}
            </div>

            {/* Add Dynamic Permission Button */}
            <button
              type="button"
              id="btn-add-dynamic-permission"
              onClick={() => setIsAddPermModalOpen(true)}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-semibold rounded-lg shadow-xs transition-colors cursor-pointer"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Add Dynamic Permission</span>
            </button>
          </div>
        </div>

        {/* Categories Bar */}
        <div className="px-5 py-2.5 border-b border-slate-100 bg-white flex items-center gap-2 overflow-x-auto text-xs">
          <span className="text-slate-400 font-medium mr-1 text-[11px]">Filter:</span>
          {categories.map((cat) => (
            <button
              key={cat}
              type="button"
              onClick={() => setSelectedCategory(cat)}
              className={`px-2.5 py-1 rounded-md text-xs font-semibold whitespace-nowrap transition-colors cursor-pointer ${
                selectedCategory === cat
                  ? "bg-indigo-100 text-indigo-800"
                  : "text-slate-600 hover:bg-slate-100 hover:text-slate-900"
              }`}
            >
              {cat}
            </button>
          ))}
        </div>

        {/* Matrix Table */}
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="bg-slate-100/70 border-b border-slate-200 text-slate-600 font-bold uppercase tracking-wider text-[11px]">
                <th className="py-3 px-5">Permission Capability</th>
                <th className="py-3 px-4">Category</th>
                <th className="py-3 px-4 text-center">Manager Access</th>
                <th className="py-3 px-6 text-center">Staff Access (Dynamic Toggle)</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filteredPermissions.length === 0 ? (
                <tr>
                  <td colSpan={4} className="py-8 text-center text-slate-400">
                    No permissions match your filter criteria.
                  </td>
                </tr>
              ) : (
                filteredPermissions.map((perm) => {
                  const isStaffAllowed = Boolean(staffPerms[perm.id]);
                  const isBusy = isUpdating === perm.id;

                  return (
                    <tr
                      key={perm.id}
                      className="hover:bg-slate-50/80 transition-colors group"
                      id={`perm-row-${perm.id.replace(/[^a-zA-Z0-9]/g, "-")}`}
                    >
                      {/* Name & Description */}
                      <td className="py-3.5 px-5">
                        <div className="flex items-start gap-2.5">
                          <div className="mt-0.5">
                            {perm.isCustom ? (
                              <Sparkles className="w-4 h-4 text-amber-500" />
                            ) : perm.category === "Leads" ? (
                              <Users className="w-4 h-4 text-indigo-500" />
                            ) : perm.category === "Files & Data" ? (
                              <FileSpreadsheet className="w-4 h-4 text-blue-500" />
                            ) : perm.category === "Export & Reports" ? (
                              <Download className="w-4 h-4 text-teal-500" />
                            ) : (
                              <Shield className="w-4 h-4 text-slate-500" />
                            )}
                          </div>
                          <div>
                            <div className="flex items-center gap-2">
                              <span className="font-bold text-slate-900">{perm.label}</span>
                              <span className="font-mono text-[10px] text-slate-400 px-1.5 py-0.5 rounded bg-slate-100">
                                {perm.id}
                              </span>
                              {perm.isCustom && (
                                <span className="text-[10px] font-bold text-amber-700 bg-amber-50 border border-amber-200 px-1.5 py-0.2 rounded">
                                  Dynamic Custom
                                </span>
                              )}
                            </div>
                            <p className="text-[11px] text-slate-500 mt-0.5 max-w-lg leading-relaxed">
                              {perm.description}
                            </p>
                          </div>
                        </div>
                      </td>

                      {/* Category */}
                      <td className="py-3.5 px-4 whitespace-nowrap">
                        <span className="px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider bg-slate-100 text-slate-700 border border-slate-200">
                          {perm.category}
                        </span>
                      </td>

                      {/* Manager Access (Always Granted) */}
                      <td className="py-3.5 px-4 text-center whitespace-nowrap">
                        <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-bold bg-indigo-50 text-indigo-700 border border-indigo-200">
                          <Check className="w-3.5 h-3.5 text-indigo-600" />
                          <span>Always Allowed</span>
                        </span>
                      </td>

                      {/* Staff Access Toggle */}
                      <td className="py-3.5 px-6 text-center whitespace-nowrap">
                        <div className="inline-flex items-center justify-center gap-2.5">
                          <button
                            type="button"
                            id={`toggle-staff-${perm.id.replace(/[^a-zA-Z0-9]/g, "-")}`}
                            disabled={isBusy}
                            onClick={() => handleToggleStaffPermission(perm.id)}
                            className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors cursor-pointer focus:outline-none focus:ring-2 focus:ring-indigo-400 focus:ring-offset-2 ${
                              isStaffAllowed ? "bg-teal-600" : "bg-slate-300"
                            } ${isBusy ? "opacity-50 cursor-wait" : ""}`}
                            title={`Click to ${isStaffAllowed ? "Revoke" : "Grant"} staff permission`}
                          >
                            <span
                              className={`inline-block h-4 w-4 transform rounded-full bg-white shadow-sm transition-transform ${
                                isStaffAllowed ? "translate-x-6" : "translate-x-1"
                              }`}
                            />
                          </button>
                          <span
                            className={`text-xs font-bold min-w-[64px] text-left ${
                              isStaffAllowed ? "text-teal-700" : "text-slate-400"
                            }`}
                          >
                            {isStaffAllowed ? "Allowed" : "Restricted"}
                          </span>
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Staff User Accounts Governance */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="p-5 border-b border-slate-200 flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-slate-50/50">
          <div>
            <h3 className="text-base font-bold text-slate-900 flex items-center gap-2">
              <Users className="w-5 h-5 text-indigo-600" />
              <span>User Accounts & Role Assignments</span>
            </h3>
            <p className="text-xs text-slate-500 mt-0.5">
              Manage accounts, assign roles (Manager or Staff), and provision team members.
            </p>
          </div>

          <button
            type="button"
            id="btn-add-user-account"
            onClick={() => setIsAddUserModalOpen(true)}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-slate-800 hover:bg-slate-900 text-white text-xs font-semibold rounded-lg shadow-xs transition-colors cursor-pointer self-start sm:self-auto"
          >
            <UserPlus className="w-3.5 h-3.5" />
            <span>Create User Account</span>
          </button>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="bg-slate-100/70 border-b border-slate-200 text-slate-600 font-bold uppercase tracking-wider text-[11px]">
                <th className="py-3 px-5">User Details</th>
                <th className="py-3 px-4">Username / ID</th>
                <th className="py-3 px-4">Role Assigned</th>
                <th className="py-3 px-4">Status</th>
                <th className="py-3 px-5 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {rbacConfig.users.map((user) => (
                <tr key={user.id} className="hover:bg-slate-50/80 transition-colors">
                  <td className="py-3.5 px-5">
                    <div className="flex items-center gap-3">
                      <div
                        className={`w-8 h-8 rounded-full flex items-center justify-center font-bold text-xs ${
                          user.role === "manager"
                            ? "bg-indigo-100 text-indigo-700"
                            : "bg-teal-100 text-teal-700"
                        }`}
                      >
                        {user.displayName.charAt(0).toUpperCase()}
                      </div>
                      <div>
                        <div className="font-bold text-slate-900">{user.displayName}</div>
                        {user.email && <div className="text-[11px] text-slate-500">{user.email}</div>}
                      </div>
                    </div>
                  </td>
                  <td className="py-3.5 px-4 font-mono font-medium text-slate-700">{user.username}</td>
                  <td className="py-3.5 px-4">
                    <span
                      className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-bold uppercase tracking-wider ${
                        user.role === "manager"
                          ? "bg-indigo-100 text-indigo-800 border border-indigo-200"
                          : "bg-teal-100 text-teal-800 border border-teal-200"
                      }`}
                    >
                      {user.role === "manager" ? "👑 Manager" : "👤 Staff"}
                    </span>
                  </td>
                  <td className="py-3.5 px-4">
                    <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-emerald-700">
                      <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                      Active
                    </span>
                  </td>
                  <td className="py-3.5 px-5 text-right whitespace-nowrap">
                    <div className="flex items-center justify-end gap-2">
                      {user.username !== "admin" && (
                        <>
                          <button
                            type="button"
                            id={`btn-reset-staff-creds-${user.username}`}
                            onClick={() => handleOpenResetStaffModal(user)}
                            className="inline-flex items-center gap-1 px-2.5 py-1 text-[11px] font-semibold rounded border border-indigo-200 bg-indigo-50/70 hover:bg-indigo-100 text-indigo-700 transition-colors cursor-pointer"
                            title={`Reset User ID or Password for ${user.displayName || user.username}`}
                          >
                            <KeyRound className="w-3 h-3 text-indigo-500" />
                            <span>Reset Credentials</span>
                          </button>
                          <button
                            type="button"
                            id={`btn-delete-user-${user.username}`}
                            onClick={() => handleDeleteUser(user)}
                            className="p-1 text-slate-400 hover:text-rose-600 transition-colors cursor-pointer"
                            title="Delete user account"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </>
                      )}
                      {user.username === "admin" && (
                        <span className="inline-flex items-center gap-1 text-[11px] text-indigo-700 font-semibold bg-indigo-50 px-2.5 py-1 rounded border border-indigo-100">
                          👑 Primary Manager
                        </span>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* MODAL 1: ADD DYNAMIC PERMISSION */}
      {isAddPermModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-xs p-4 animate-in fade-in">
          <div className="bg-white rounded-2xl shadow-2xl max-w-lg w-full p-6 border border-slate-200 animate-in zoom-in-95">
            <div className="flex items-center justify-between pb-4 border-b border-slate-100 mb-5">
              <div className="flex items-center gap-2.5">
                <div className="p-2 bg-indigo-50 text-indigo-600 rounded-xl">
                  <Sparkles className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-slate-900">Add Dynamic Permission</h3>
                  <p className="text-xs text-slate-500">Define a new capability rule on the fly</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setIsAddPermModalOpen(false)}
                className="text-slate-400 hover:text-slate-600 p-1"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {permFormError && (
              <div className="mb-4 p-3 bg-rose-50 border border-rose-200 rounded-xl text-xs text-rose-700 flex items-center gap-2">
                <AlertTriangle className="w-4 h-4 shrink-0 text-rose-500" />
                <span>{permFormError}</span>
              </div>
            )}

            <form onSubmit={handleCreateDynamicPermission} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                  Permission Identifier Key (e.g. leads:custom_rule)
                </label>
                <input
                  type="text"
                  required
                  value={newPermKey}
                  onChange={(e) => setNewPermKey(e.target.value)}
                  placeholder="e.g. audit:export_logs or leads:vip_access"
                  className="w-full px-3 py-2 text-xs border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-100 focus:border-indigo-500 font-mono"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                  Human-Readable Label
                </label>
                <input
                  type="text"
                  required
                  value={newPermLabel}
                  onChange={(e) => setNewPermLabel(e.target.value)}
                  placeholder="e.g. Export Audit Logs"
                  className="w-full px-3 py-2 text-xs border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-100 focus:border-indigo-500"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                  Category
                </label>
                <select
                  value={newPermCategory}
                  onChange={(e) => setNewPermCategory(e.target.value as any)}
                  className="w-full px-3 py-2 text-xs border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-100 focus:border-indigo-500 bg-white"
                >
                  <option value="Leads">Leads</option>
                  <option value="Files & Data">Files & Data</option>
                  <option value="Export & Reports">Export & Reports</option>
                  <option value="Administration">Administration</option>
                  <option value="Custom">Custom</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                  Description
                </label>
                <textarea
                  rows={2}
                  value={newPermDesc}
                  onChange={(e) => setNewPermDesc(e.target.value)}
                  placeholder="Describe what access this permission controls..."
                  className="w-full px-3 py-2 text-xs border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-100 focus:border-indigo-500"
                />
              </div>

              <div className="pt-2">
                <label className="flex items-center gap-2 cursor-pointer text-xs text-slate-700 font-medium">
                  <input
                    type="checkbox"
                    checked={newPermDefaultStaff}
                    onChange={(e) => setNewPermDefaultStaff(e.target.checked)}
                    className="w-4 h-4 rounded text-indigo-600 focus:ring-indigo-500 border-slate-300"
                  />
                  <span>Allow Staff role by default for this new permission</span>
                </label>
              </div>

              <div className="pt-4 border-t border-slate-100 flex items-center justify-end gap-2.5">
                <button
                  type="button"
                  onClick={() => setIsAddPermModalOpen(false)}
                  className="px-4 py-2 border border-slate-200 text-slate-700 rounded-xl text-xs font-semibold hover:bg-slate-50 cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  id="btn-save-new-dynamic-permission"
                  className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-semibold shadow-xs cursor-pointer"
                >
                  Add Permission to System
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL 2: ADD USER ACCOUNT */}
      {isAddUserModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-xs p-4 animate-in fade-in">
          <div className="bg-white rounded-2xl shadow-2xl max-w-lg w-full p-6 border border-slate-200 animate-in zoom-in-95">
            <div className="flex items-center justify-between pb-4 border-b border-slate-100 mb-5">
              <div className="flex items-center gap-2.5">
                <div className="p-2 bg-slate-100 text-slate-700 rounded-xl">
                  <UserPlus className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-slate-900">Create User Account</h3>
                  <p className="text-xs text-slate-500">Provision a new user and assign their access role</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setIsAddUserModalOpen(false)}
                className="text-slate-400 hover:text-slate-600 p-1"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {userFormError && (
              <div className="mb-4 p-3 bg-rose-50 border border-rose-200 rounded-xl text-xs text-rose-700 flex items-center gap-2">
                <AlertTriangle className="w-4 h-4 shrink-0 text-rose-500" />
                <span>{userFormError}</span>
              </div>
            )}

            <form onSubmit={handleCreateUser} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                  Username (Login ID)
                </label>
                <input
                  type="text"
                  required
                  value={newUsername}
                  onChange={(e) => setNewUsername(e.target.value)}
                  placeholder="e.g. jessica or staff2"
                  className="w-full px-3 py-2 text-xs border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-100 focus:border-indigo-500 font-mono"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                  Full Display Name
                </label>
                <input
                  type="text"
                  required
                  value={newDisplayName}
                  onChange={(e) => setNewDisplayName(e.target.value)}
                  placeholder="e.g. Jessica Taylor"
                  className="w-full px-3 py-2 text-xs border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-100 focus:border-indigo-500"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                  Email Address
                </label>
                <input
                  type="email"
                  value={newUserEmail}
                  onChange={(e) => setNewUserEmail(e.target.value)}
                  placeholder="e.g. jessica@company.com"
                  className="w-full px-3 py-2 text-xs border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-100 focus:border-indigo-500"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                    Assigned Role
                  </label>
                  <select
                    value={newUserRole}
                    onChange={(e) => setNewUserRole(e.target.value as AppRole)}
                    className="w-full px-3 py-2 text-xs border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-100 focus:border-indigo-500 bg-white"
                  >
                    <option value="staff">Staff (Limited Permissions)</option>
                    <option value="manager">Manager (Full Access)</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                    Initial Password
                  </label>
                  <input
                    type="text"
                    required
                    value={newUserPassword}
                    onChange={(e) => setNewUserPassword(e.target.value)}
                    placeholder="Password"
                    className="w-full px-3 py-2 text-xs border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-100 focus:border-indigo-500 font-mono"
                  />
                </div>
              </div>

              <div className="pt-4 border-t border-slate-100 flex items-center justify-end gap-2.5">
                <button
                  type="button"
                  onClick={() => setIsAddUserModalOpen(false)}
                  className="px-4 py-2 border border-slate-200 text-slate-700 rounded-xl text-xs font-semibold hover:bg-slate-50 cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  id="btn-save-new-user-account"
                  className="px-4 py-2 bg-slate-900 hover:bg-slate-800 text-white rounded-xl text-xs font-semibold shadow-xs cursor-pointer"
                >
                  Create Account
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL 3: RESET STAFF CREDENTIALS (MANAGER ADMIN OVERRIDE) */}
      {resetStaffTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-xs p-4 animate-in fade-in">
          <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full p-6 border border-slate-200 animate-in zoom-in-95">
            <div className="flex items-center justify-between pb-4 border-b border-slate-100 mb-4">
              <div className="flex items-center gap-2.5">
                <div className="p-2 bg-indigo-50 text-indigo-600 rounded-xl">
                  <KeyRound className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-slate-900">Reset Staff Credentials</h3>
                  <p className="text-xs text-slate-500">
                    Manager Override for <strong className="text-slate-800">{resetStaffTarget.displayName}</strong>
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setResetStaffTarget(null)}
                className="p-1 text-slate-400 hover:text-slate-600 rounded-lg hover:bg-slate-100 transition-colors cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {resetStaffError && (
              <div className="mb-4 p-3 bg-rose-50 border border-rose-200 text-rose-800 rounded-xl text-xs flex items-center gap-2">
                <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0" />
                <span>{resetStaffError}</span>
              </div>
            )}

            <form onSubmit={handleSaveResetStaffCredentials} className="space-y-3.5">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  User ID (Login Username) <span className="text-rose-500">*</span>
                </label>
                <input
                  type="text"
                  required
                  value={resetStaffUsername}
                  onChange={(e) => setResetStaffUsername(e.target.value)}
                  placeholder="e.g. helen or staff2"
                  className="w-full px-3 py-2 text-xs border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-100 focus:border-indigo-500 font-mono font-semibold"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Display Name
                  </label>
                  <input
                    type="text"
                    value={resetStaffDisplayName}
                    onChange={(e) => setResetStaffDisplayName(e.target.value)}
                    placeholder="Helen Specialist"
                    className="w-full px-3 py-2 text-xs border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-100 focus:border-indigo-500"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Email Address
                  </label>
                  <input
                    type="email"
                    value={resetStaffEmail}
                    onChange={(e) => setResetStaffEmail(e.target.value)}
                    placeholder="helen@company.com"
                    className="w-full px-3 py-2 text-xs border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-100 focus:border-indigo-500"
                  />
                </div>
              </div>

              <div className="pt-2 border-t border-slate-100">
                <div className="space-y-3">
                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">
                      Set New Password
                    </label>
                    <input
                      type="text"
                      value={resetStaffNewPassword}
                      onChange={(e) => setResetStaffNewPassword(e.target.value)}
                      placeholder="Enter new password (or leave blank to keep)"
                      className="w-full px-3 py-2 text-xs border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-100 focus:border-indigo-500 font-mono"
                    />
                    <p className="text-[10px] text-slate-400 mt-1">
                      Minimum 4 characters. Staff can later change their password via My Account.
                    </p>
                  </div>

                  {resetStaffNewPassword && (
                    <div>
                      <label className="block text-xs font-bold text-slate-700 mb-1">
                        Confirm New Password
                      </label>
                      <input
                        type="text"
                        value={resetStaffConfirmPassword}
                        onChange={(e) => setResetStaffConfirmPassword(e.target.value)}
                        placeholder="Re-enter password to confirm"
                        className="w-full px-3 py-2 text-xs border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-100 focus:border-indigo-500 font-mono"
                      />
                    </div>
                  )}
                </div>
              </div>

              <div className="pt-4 border-t border-slate-100 flex items-center justify-end gap-2.5">
                <button
                  type="button"
                  onClick={() => setResetStaffTarget(null)}
                  disabled={resetStaffLoading}
                  className="px-4 py-2 border border-slate-200 text-slate-700 rounded-xl text-xs font-semibold hover:bg-slate-50 cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  id="btn-confirm-reset-staff-creds"
                  disabled={resetStaffLoading}
                  className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-semibold shadow-xs cursor-pointer flex items-center gap-1.5 disabled:opacity-50"
                >
                  <KeyRound className="w-3.5 h-3.5" />
                  <span>{resetStaffLoading ? "Saving..." : "Update Staff Credentials"}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
