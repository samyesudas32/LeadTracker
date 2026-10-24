import React, { useState, useEffect } from "react";
import {
  ShieldAlert,
  Building2,
  Users,
  Database,
  Calendar,
  Clock,
  Play,
  Pause,
  Eye,
  EyeOff,
  Ban,
  CheckCircle2,
  AlertTriangle,
  Plus,
  RefreshCw,
  Download,
  CreditCard,
  Search,
  ExternalLink,
  Sparkles,
  ArrowRight,
  Shield,
  Sliders,
  Layers,
  History,
  FileSpreadsheet,
  Trash2,
  UserCheck,
  UserX,
  Lock,
  LogOut,
  Mail,
  Phone,
  AlertCircle,
  X,
  Tag,
  Save,
  RotateCcw,
  Edit3,
  Check,
  KeyRound,
  Copy,
} from "lucide-react";
import { Tenant, TenantStatus, DatabaseBackup, PlatformAuditLog, SubscriptionTier } from "../types/saas";
import { UserAccount, Lead, PricingSettings, PricingTierConfig, DEFAULT_PRICING_SETTINGS } from "../types";
import { apiClient } from "../services/apiClient";
import { getLocalDemoAccounts } from "../utils/authService";
import {
  deleteLeadFromFirestore,
  batchDeleteLeadsFromFirestore,
  savePricingToFirestore,
  subscribeToFirestorePricing,
} from "../services/firebase";
import { StripeCheckoutModal } from "./StripeCheckoutModal";

interface SuperAdminPortalProps {
  onNavigateToWorkspace: (tenantId?: string) => void;
  onNavigateToLanding: () => void;
  leads?: Lead[];
  onDeleteLead?: (lead: Lead) => void;
  onClearAllLeads?: () => void;
}

export const SuperAdminPortal: React.FC<SuperAdminPortalProps> = ({
  onNavigateToWorkspace,
  onNavigateToLanding,
  leads = [],
  onDeleteLead,
  onClearAllLeads,
}) => {
  // Super Admin Authentication Gate State
  const [isSuperAdminAuth, setIsSuperAdminAuth] = useState<boolean>(() => {
    try {
      return sessionStorage.getItem("lead_tracker_superadmin_auth") === "true";
    } catch {
      return false;
    }
  });
  const [demoAccounts, setDemoAccounts] = useState(() => getLocalDemoAccounts());
  const [loginUserId, setLoginUserId] = useState(() => getLocalDemoAccounts().superAdmin.username);
  const [loginPassword, setLoginPassword] = useState(() => getLocalDemoAccounts().superAdmin.password);
  const [showPassword, setShowPassword] = useState(false);
  const [loginError, setLoginError] = useState<string | null>(null);
  const [isLoggingIn, setIsLoggingIn] = useState(false);

  // Portal Data States
  const [tenants, setTenants] = useState<Tenant[]>([]);
  const [backups, setBackups] = useState<DatabaseBackup[]>([]);
  const [auditLogs, setAuditLogs] = useState<PlatformAuditLog[]>([]);
  const [users, setUsers] = useState<UserAccount[]>([]);
  const [masterLeads, setMasterLeads] = useState<Lead[]>(leads);
  const [loading, setLoading] = useState(true);
  const [searchFilter, setSearchFilter] = useState("");
  const [activeTab, setActiveTab] = useState<"credentials" | "users" | "tenants" | "directory" | "pricing" | "backups" | "audit">("credentials");

  // Credential Governance State
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [editingUser, setEditingUser] = useState<UserAccount | null>(null);
  const [editUserNewPassword, setEditUserNewPassword] = useState("");
  const [editUserNewUsername, setEditUserNewUsername] = useState("");
  const [showEditUserPassword, setShowEditUserPassword] = useState(false);
  const [isSavingUserCreds, setIsSavingUserCreds] = useState(false);

  // Super Admin Credential Editor State
  const [saNewUserId, setSaNewUserId] = useState(() => getLocalDemoAccounts().superAdmin.username);
  const [saNewPassword, setSaNewPassword] = useState(() => getLocalDemoAccounts().superAdmin.password);
  const [saEmail, setSaEmail] = useState("superadmin@leadplatform.io");
  const [showSaPassword, setShowSaPassword] = useState(false);
  const [isSavingSa, setIsSavingSa] = useState(false);

  // Manager Credential Editor State
  const [mgrNewUserId, setMgrNewUserId] = useState(() => getLocalDemoAccounts().manager.username);
  const [mgrNewPassword, setMgrNewPassword] = useState(() => getLocalDemoAccounts().manager.password);
  const [mgrEmail, setMgrEmail] = useState("gatewaylawpartners@gmail.com");
  const [showMgrPassword, setShowMgrPassword] = useState(false);
  const [isSavingMgr, setIsSavingMgr] = useState(false);

  // Customer Credential Editor State
  const [custNewUserId, setCustNewUserId] = useState(() => getLocalDemoAccounts().customer.username);
  const [custNewPassword, setCustNewPassword] = useState(() => getLocalDemoAccounts().customer.password);
  const [showCustPassword, setShowCustPassword] = useState(false);
  const [isSavingCust, setIsSavingCust] = useState(false);

  // Pricing & Plans Editor State
  const [pricing, setPricing] = useState<PricingSettings>(DEFAULT_PRICING_SETTINGS);
  const [isSavingPricing, setIsSavingPricing] = useState(false);
  const [pricingPreviewMode, setPricingPreviewMode] = useState<"monthly" | "yearly">("monthly");
  const [activePricingTierIdx, setActivePricingTierIdx] = useState<number>(0);
  const [newFeatureText, setNewFeatureText] = useState("");
  const [isResetPricingConfirmOpen, setIsResetPricingConfirmOpen] = useState(false);

  // User Accounts Management State
  const [isAddUserOpen, setIsAddUserOpen] = useState(false);
  const [newUsername, setNewUsername] = useState("");
  const [newDisplayName, setNewDisplayName] = useState("");
  const [newRole, setNewRole] = useState<"manager" | "staff" | "customer">("staff");
  const [newPassword, setNewPassword] = useState("Staff@123");
  const [newEmail, setNewEmail] = useState("");
  const [userActionLoading, setUserActionLoading] = useState(false);
  const [deleteUserConfirm, setDeleteUserConfirm] = useState<UserAccount | null>(null);

  // Historical Client Register Deletion State
  const [deleteLeadConfirm, setDeleteLeadConfirm] = useState<Lead | null>(null);
  const [isPurgeRegisterOpen, setIsPurgeRegisterOpen] = useState(false);
  const [purgeInputText, setPurgeInputText] = useState("");
  const [directorySearch, setDirectorySearch] = useState("");

  // Provisioning Modal State
  const [isProvisionOpen, setIsProvisionOpen] = useState(false);
  const [newOrgName, setNewOrgName] = useState("");
  const [newOrgSlug, setNewOrgSlug] = useState("");
  const [newOrgTier, setNewOrgTier] = useState<SubscriptionTier>("trial");
  const [newOrgEmail, setNewOrgEmail] = useState("");
  const [newOrgTrialDays, setNewOrgTrialDays] = useState(60);
  const [provisionLoading, setProvisionLoading] = useState(false);

  // Stripe Checkout Simulation
  const [selectedTenantForStripe, setSelectedTenantForStripe] = useState<Tenant | null>(null);
  const [isStripeModalOpen, setIsStripeModalOpen] = useState(false);

  // Toast feedback banner
  const [feedback, setFeedback] = useState<{ message: string; type: "success" | "error" } | null>(null);

  const showToast = (message: string, type: "success" | "error" = "success") => {
    setFeedback({ message, type });
    setTimeout(() => setFeedback(null), 4000);
  };

  const copyToClipboard = (text: string, id: string) => {
    try {
      navigator.clipboard.writeText(text);
      setCopiedId(id);
      setTimeout(() => setCopiedId(null), 2000);
      showToast("Copied to clipboard!", "success");
    } catch {
      showToast("Failed to copy to clipboard", "error");
    }
  };

  const loadAllData = async () => {
    setLoading(true);
    try {
      const [tenantsRes, backupsRes, auditRes, rbacRes, leadsRes, pricingRes, demoRes] = await Promise.all([
        apiClient.getTenants().catch(() => ({ success: false, tenants: [], summary: {} as any })),
        apiClient.getBackups().catch(() => ({ success: false, backups: [] })),
        apiClient.getAuditLogs().catch(() => ({ success: false, auditLogs: [] })),
        apiClient.getRbac().catch(() => ({ success: false, rbac: { users: [] } as any })),
        apiClient.getLeads().catch(() => leads),
        apiClient.getPricingSettings().catch(() => ({ success: false, pricing: DEFAULT_PRICING_SETTINGS })),
        apiClient.getPublicDemoAccounts().catch(() => ({ success: false, accounts: getLocalDemoAccounts() })),
      ]);

      if (tenantsRes.tenants) setTenants(tenantsRes.tenants);
      if (backupsRes.backups) setBackups(backupsRes.backups);
      if (auditRes.auditLogs) setAuditLogs(auditRes.auditLogs);
      if (rbacRes.rbac?.users) setUsers(rbacRes.rbac.users);
      if (pricingRes?.pricing) setPricing(pricingRes.pricing);
      if (Array.isArray(leadsRes) && leadsRes.length > 0) {
        setMasterLeads(leadsRes);
      } else if (leads && leads.length > 0) {
        setMasterLeads(leads);
      }
      if (demoRes?.accounts) {
        setDemoAccounts(demoRes.accounts);
        if (demoRes.accounts.superAdmin) {
          setSaNewUserId(demoRes.accounts.superAdmin.username);
          setSaNewPassword(demoRes.accounts.superAdmin.password);
        }
        if (demoRes.accounts.manager) {
          setMgrNewUserId(demoRes.accounts.manager.username);
          setMgrNewPassword(demoRes.accounts.manager.password);
        }
        if (demoRes.accounts.customer) {
          setCustNewUserId(demoRes.accounts.customer.username);
          setCustNewPassword(demoRes.accounts.customer.password);
        }
      }
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    apiClient
      .getPublicDemoAccounts()
      .then((res) => {
        if (res && res.accounts) {
          setDemoAccounts(res.accounts);
          if (res.accounts.superAdmin) {
            setLoginUserId((prev) => prev || res.accounts.superAdmin.username);
            setLoginPassword((prev) => prev || res.accounts.superAdmin.password);
          }
        }
      })
      .catch(() => {});
  }, []);

  useEffect(() => {
    if (isSuperAdminAuth) {
      loadAllData();
      const unsub = subscribeToFirestorePricing((remotePricing) => {
        if (remotePricing && remotePricing.tiers && remotePricing.tiers.length > 0) {
          setPricing(remotePricing);
        }
      });
      return () => unsub();
    }
  }, [isSuperAdminAuth]);

  // Credential Governance Handlers
  const handleSaveSuperAdminCreds = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!saNewUserId.trim()) {
      showToast("Super Admin User ID cannot be empty", "error");
      return;
    }
    if (!saNewPassword || saNewPassword.length < 4) {
      showToast("Super Admin Password must be at least 4 characters", "error");
      return;
    }
    setIsSavingSa(true);
    try {
      const res = await apiClient.updateSuperAdminCredentials({
        newUserId: saNewUserId.trim(),
        newPassword: saNewPassword,
        email: saEmail.trim(),
      });
      if (res.success) {
        showToast("Super Admin credentials updated successfully! Active across all portals.", "success");
        setDemoAccounts((prev) => ({
          ...prev,
          superAdmin: {
            username: saNewUserId.trim(),
            password: saNewPassword,
            displayName: "Super Administrator",
          },
        }));
      } else {
        showToast(res.error || "Failed to update Super Admin credentials", "error");
      }
    } catch (err: any) {
      showToast(err?.message || "Failed to update Super Admin credentials", "error");
    } finally {
      setIsSavingSa(false);
    }
  };

  const handleSaveManagerCreds = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!mgrNewUserId.trim()) {
      showToast("Manager User ID cannot be empty", "error");
      return;
    }
    if (!mgrNewPassword || mgrNewPassword.length < 4) {
      showToast("Manager Password must be at least 4 characters", "error");
      return;
    }
    setIsSavingMgr(true);
    try {
      const res = await apiClient.updateAccountCredentials({
        targetUserId: "user-admin",
        newUserId: mgrNewUserId.trim(),
        newPassword: mgrNewPassword,
        recoveryEmail: mgrEmail.trim(),
        isManagerReset: true,
      });
      if (res.success) {
        showToast("Manager credentials updated successfully! Changes reflect on the login modal.", "success");
        setDemoAccounts((prev) => ({
          ...prev,
          manager: {
            username: mgrNewUserId.trim(),
            password: mgrNewPassword,
            displayName: "Manager (Full Access)",
          },
        }));
        loadAllData();
      } else {
        showToast(res.error || "Failed to update Manager credentials", "error");
      }
    } catch (err: any) {
      showToast(err?.message || "Failed to update Manager credentials", "error");
    } finally {
      setIsSavingMgr(false);
    }
  };

  const handleSaveCustomerCreds = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!custNewUserId.trim()) {
      showToast("Customer User ID cannot be empty", "error");
      return;
    }
    if (!custNewPassword || custNewPassword.length < 4) {
      showToast("Customer Password must be at least 4 characters", "error");
      return;
    }
    setIsSavingCust(true);
    try {
      const res = await apiClient.updateAccountCredentials({
        targetUserId: "user-customer",
        newUserId: custNewUserId.trim(),
        newPassword: custNewPassword,
        isManagerReset: true,
      });
      if (res.success) {
        showToast("Customer credentials updated successfully! Client can now sign in with this ID and password.", "success");
        setDemoAccounts((prev) => ({
          ...prev,
          customer: {
            username: custNewUserId.trim(),
            password: custNewPassword,
            displayName: "Customer / Client (View-Only)",
          },
        }));
        loadAllData();
      } else {
        showToast(res.error || "Failed to update Customer credentials", "error");
      }
    } catch (err: any) {
      showToast(err?.message || "Failed to update Customer credentials", "error");
    } finally {
      setIsSavingCust(false);
    }
  };

  const handleSaveEditUserCreds = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingUser) return;
    if (!editUserNewUsername.trim()) {
      showToast("Username cannot be empty", "error");
      return;
    }
    if (editUserNewPassword && editUserNewPassword.length < 4) {
      showToast("Password must be at least 4 characters", "error");
      return;
    }
    setIsSavingUserCreds(true);
    try {
      const res = await apiClient.updateAccountCredentials({
        targetUserId: editingUser.id || editingUser.username,
        newUserId: editUserNewUsername.trim(),
        newPassword: editUserNewPassword ? editUserNewPassword : undefined,
        isManagerReset: true,
      });
      if (res.success) {
        showToast(`Credentials for "${editUserNewUsername.trim()}" updated successfully!`, "success");
        setEditingUser(null);
        setEditUserNewPassword("");
        loadAllData();
      } else {
        showToast(res.error || "Failed to update user credentials", "error");
      }
    } catch (err: any) {
      showToast(err?.message || "Failed to update user credentials", "error");
    } finally {
      setIsSavingUserCreds(false);
    }
  };

  // Pricing Handlers
  const handleSavePricing = async () => {
    setIsSavingPricing(true);
    try {
      const payload: PricingSettings = {
        ...pricing,
        updatedAt: new Date().toISOString(),
        updatedBy: "superadmin",
      };
      await Promise.all([
        apiClient.savePricingSettings(payload).catch((e) => console.warn("API pricing save notice:", e)),
        savePricingToFirestore(payload).catch((e) => console.warn("Firestore pricing save notice:", e)),
      ]);
      setPricing(payload);
      showToast("Pricing & plans configuration saved and published live to landing page!", "success");
    } catch (err) {
      showToast("Failed to save pricing configuration", "error");
    } finally {
      setIsSavingPricing(false);
    }
  };

  const handleResetPricing = async () => {
    setIsSavingPricing(true);
    try {
      await Promise.all([
        apiClient.resetPricingSettings().catch((e) => console.warn("API pricing reset notice:", e)),
        savePricingToFirestore(DEFAULT_PRICING_SETTINGS).catch((e) => console.warn("Firestore pricing reset notice:", e)),
      ]);
      setPricing(DEFAULT_PRICING_SETTINGS);
      setIsResetPricingConfirmOpen(false);
      showToast("Pricing restored to default standard packages", "success");
    } catch (err) {
      showToast("Failed to reset pricing", "error");
    } finally {
      setIsSavingPricing(false);
    }
  };

  const handleAddFeatureToActiveTier = () => {
    if (!newFeatureText.trim()) return;
    setPricing((prev) => {
      const nextTiers = [...prev.tiers];
      const target = { ...nextTiers[activePricingTierIdx] };
      target.features = [...target.features, newFeatureText.trim()];
      nextTiers[activePricingTierIdx] = target;
      return { ...prev, tiers: nextTiers };
    });
    setNewFeatureText("");
  };

  const handleRemoveFeatureFromActiveTier = (idx: number) => {
    setPricing((prev) => {
      const nextTiers = [...prev.tiers];
      const target = { ...nextTiers[activePricingTierIdx] };
      target.features = target.features.filter((_, i) => i !== idx);
      nextTiers[activePricingTierIdx] = target;
      return { ...prev, tiers: nextTiers };
    });
  };

  const handleUpdateActiveTierFeature = (idx: number, val: string) => {
    setPricing((prev) => {
      const nextTiers = [...prev.tiers];
      const target = { ...nextTiers[activePricingTierIdx] };
      const feats = [...target.features];
      feats[idx] = val;
      target.features = feats;
      nextTiers[activePricingTierIdx] = target;
      return { ...prev, tiers: nextTiers };
    });
  };

  useEffect(() => {
    if (leads && leads.length > 0) {
      setMasterLeads(leads);
    }
  }, [leads]);

  // Super Admin Login Handler
  const handleSuperAdminLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoggingIn(true);
    setLoginError(null);

    const cleanId = loginUserId.trim().toLowerCase();
    try {
      const res = await apiClient.superAdminLogin(cleanId, loginPassword);
      if (res && res.success && res.authenticated) {
        setIsSuperAdminAuth(true);
        sessionStorage.setItem("lead_tracker_superadmin_auth", "true");
        showToast("Super Admin authenticated successfully.");
        loadAllData();
      } else {
        setLoginError(res.error || "Invalid Super Admin credentials.");
      }
    } catch {
      // Local fallback credential evaluation
      if (
        (cleanId === "admin" && loginPassword === "Sam@1997") ||
        (cleanId === "superadmin" && loginPassword === "SuperAdmin@2026")
      ) {
        setIsSuperAdminAuth(true);
        sessionStorage.setItem("lead_tracker_superadmin_auth", "true");
        showToast("Super Admin authenticated successfully.");
        loadAllData();
      } else {
        setLoginError("Invalid Super Admin credentials. Please check your User ID and Password.");
      }
    } finally {
      setIsLoggingIn(false);
    }
  };

  const handleSuperAdminLogout = () => {
    sessionStorage.removeItem("lead_tracker_superadmin_auth");
    setIsSuperAdminAuth(false);
    setLoginPassword("");
  };

  // User Accounts Management
  const handleAddUser = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newUsername.trim()) return;
    setUserActionLoading(true);

    try {
      const res = await apiClient.saveRbacUser({
        username: newUsername.trim(),
        displayName: newDisplayName.trim() || newUsername.trim(),
        role: newRole,
        password: newPassword,
        email: newEmail.trim(),
        status: "active",
      });

      if (res.success && res.rbac?.users) {
        setUsers(res.rbac.users);
      } else {
        const newUser: UserAccount = {
          id: `user-${Date.now()}`,
          username: newUsername.trim().toLowerCase(),
          displayName: newDisplayName.trim() || newUsername.trim(),
          role: newRole,
          email: newEmail.trim(),
          status: "active",
          createdAt: new Date().toISOString(),
        };
        setUsers((prev) => [...prev, newUser]);
      }
      showToast(`User account "${newUsername}" created successfully!`);
      setIsAddUserOpen(false);
      setNewUsername("");
      setNewDisplayName("");
      setNewPassword("Staff@123");
      setNewEmail("");
    } catch (err: any) {
      showToast(err?.message || "Failed to create user account.", "error");
    } finally {
      setUserActionLoading(false);
    }
  };

  const handleDeleteUser = async (user: UserAccount) => {
    if (user.id === "user-admin" || user.username.toLowerCase() === "admin") {
      showToast("Primary Administrator account cannot be deleted.", "error");
      setDeleteUserConfirm(null);
      return;
    }

    try {
      const res = await apiClient.deleteRbacUser(user.id || user.username);
      if (res.success && res.rbac?.users) {
        setUsers(res.rbac.users);
      } else {
        setUsers((prev) => prev.filter((u) => u.id !== user.id && u.username !== user.username));
      }
      showToast(`User account "${user.displayName || user.username}" deleted successfully.`);
      setDeleteUserConfirm(null);
    } catch (err: any) {
      showToast(err?.message || "Failed to delete user account.", "error");
    }
  };

  // Master Directory Lead Deletions
  const handleDeleteMasterLead = async (lead: Lead) => {
    try {
      if (onDeleteLead) {
        onDeleteLead(lead);
      }
      await apiClient.deleteLead(lead.id);
      deleteLeadFromFirestore(lead.id).catch(() => {});
      setMasterLeads((prev) => prev.filter((l) => l.id !== lead.id));
      showToast(`Record for "${lead.fullName}" deleted from Master Directory.`);
      setDeleteLeadConfirm(null);
    } catch (err: any) {
      showToast(err?.message || "Failed to delete lead from Master Directory.", "error");
    }
  };

  const handlePurgeHistoricalRegister = async () => {
    try {
      if (onClearAllLeads) {
        onClearAllLeads();
      }
      await apiClient.clearAllLeads();
      const allIds = masterLeads.map((l) => l.id);
      batchDeleteLeadsFromFirestore(allIds).catch(() => {});
      setMasterLeads([]);
      showToast("Historical Client Register (Master Directory) completely cleared.");
      setIsPurgeRegisterOpen(false);
      setPurgeInputText("");
    } catch (err: any) {
      showToast(err?.message || "Failed to purge historical register.", "error");
    }
  };

  // Tenants Management
  const handleUpdateStatus = async (tenantId: string, nextStatus: TenantStatus) => {
    try {
      const res = await apiClient.updateTenantStatus(
        tenantId,
        nextStatus,
        `Super Admin manual status switch to ${nextStatus}`
      );
      if (res.success && res.tenant) {
        setTenants((prev) => prev.map((t) => (t.id === tenantId ? res.tenant : t)));
        showToast(`Tenant status changed to "${nextStatus}"`);
        loadAllData();
      }
    } catch (err: any) {
      showToast(err?.message || "Failed to alter tenant status.", "error");
    }
  };

  const handleExtendTrial = async (tenantId: string, days: number = 60) => {
    try {
      const res = await apiClient.extendTenantTrial(tenantId, days);
      if (res.success && res.tenant) {
        setTenants((prev) => prev.map((t) => (t.id === tenantId ? res.tenant : t)));
        showToast(res.message || `Extended validity by +${days} days.`);
        loadAllData();
      }
    } catch (err: any) {
      showToast(err?.message || "Failed to extend validity.", "error");
    }
  };

  const handleProvisionTenant = async (e: React.FormEvent) => {
    e.preventDefault();
    setProvisionLoading(true);
    try {
      const res = await apiClient.createTenant({
        name: newOrgName,
        slug: newOrgSlug,
        planTier: newOrgTier,
        contactEmail: newOrgEmail,
        trialDays: newOrgTrialDays,
      });

      if (res.success && res.tenant) {
        setTenants((prev) => [res.tenant, ...prev]);
        setIsProvisionOpen(false);
        setNewOrgName("");
        setNewOrgSlug("");
        setNewOrgEmail("");
        showToast(`Organization "${res.tenant.name}" provisioned successfully!`);
        loadAllData();
      }
    } catch (err: any) {
      showToast(err?.message || "Failed to provision organization.", "error");
    } finally {
      setProvisionLoading(false);
    }
  };

  const handleCreateBackup = async () => {
    try {
      const res = await apiClient.createBackup();
      if (res.success && res.backup) {
        setBackups((prev) => [res.backup, ...prev]);
        showToast(`Snapshot ${res.backup.id} created and verified.`);
      }
    } catch (err: any) {
      showToast(err?.message || "Backup snapshot failed.", "error");
    }
  };

  const handleRestoreBackup = async (id: string) => {
    try {
      const res = await apiClient.restoreBackup(id);
      showToast(res.message || `Restoration verified from snapshot ${id}.`);
      loadAllData();
    } catch (err: any) {
      showToast(err?.message || "Restoration check failed.", "error");
    }
  };

  // Filtered views
  const filteredUsers = users.filter((u) => {
    const q = searchFilter.toLowerCase();
    return (
      u.username.toLowerCase().includes(q) ||
      (u.displayName && u.displayName.toLowerCase().includes(q)) ||
      u.role.toLowerCase().includes(q) ||
      (u.email && u.email.toLowerCase().includes(q))
    );
  });

  const filteredMasterLeads = masterLeads.filter((l) => {
    const q = directorySearch.toLowerCase();
    return (
      l.fullName.toLowerCase().includes(q) ||
      l.phoneNumber.toLowerCase().includes(q) ||
      l.email.toLowerCase().includes(q) ||
      l.status.toLowerCase().includes(q) ||
      (l.city && l.city.toLowerCase().includes(q)) ||
      (l.handlerName && l.handlerName.toLowerCase().includes(q)) ||
      (l.uploadedFileName && l.uploadedFileName.toLowerCase().includes(q))
    );
  });

  const filteredTenants = tenants.filter(
    (t) =>
      t.name.toLowerCase().includes(searchFilter.toLowerCase()) ||
      t.slug.toLowerCase().includes(searchFilter.toLowerCase()) ||
      t.status.toLowerCase().includes(searchFilter.toLowerCase())
  );

  // ---------------------------------------------------------------------------
  // 1. Gate Screen: Super Admin Login Challenge (If Not Authenticated)
  // ---------------------------------------------------------------------------
  if (!isSuperAdminAuth) {
    return (
      <div className="min-h-screen bg-slate-950 flex flex-col items-center justify-center p-6 text-slate-100 font-['Plus_Jakarta_Sans',sans-serif]">
        <div className="w-full max-w-md bg-slate-900 border border-slate-800 rounded-2xl p-8 shadow-2xl relative overflow-hidden">
          <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-emerald-500 via-teal-400 to-indigo-500" />

          <div className="flex items-center gap-3 mb-6">
            <div className="p-3 rounded-xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-400">
              <ShieldAlert className="w-6 h-6" />
            </div>
            <div>
              <h2 className="text-xl font-extrabold text-white tracking-tight">Super Admin Platform</h2>
              <span className="text-[11px] font-mono text-emerald-400 font-bold uppercase tracking-wider">
                Restricted Console Access
              </span>
            </div>
          </div>

          <p className="text-xs text-slate-400 leading-relaxed mb-6">
            Enter your Super Administrator credentials to manage tenant organizations, user accounts, and the Historical Client Register.
          </p>

          {loginError && (
            <div className="mb-5 p-3 rounded-xl bg-red-950/70 border border-red-800/80 text-red-200 text-xs flex items-start gap-2.5">
              <AlertCircle className="w-4 h-4 shrink-0 mt-0.5 text-red-400" />
              <span>{loginError}</span>
            </div>
          )}

          <form onSubmit={handleSuperAdminLogin} className="space-y-4">
            <div>
              <label className="text-xs font-bold text-slate-300 block mb-1.5">Super Admin User ID</label>
              <input
                id="input-superadmin-userid"
                type="text"
                value={loginUserId}
                onChange={(e) => setLoginUserId(e.target.value)}
                placeholder="admin or superadmin"
                className="w-full px-3.5 py-2.5 rounded-xl bg-slate-950 border border-slate-700 text-white text-sm outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 transition-colors"
                required
              />
            </div>

            <div>
              <label className="text-xs font-bold text-slate-300 block mb-1.5">Password</label>
              <div className="relative">
                <input
                  id="input-superadmin-password"
                  type={showPassword ? "text" : "password"}
                  value={loginPassword}
                  onChange={(e) => setLoginPassword(e.target.value)}
                  placeholder="Enter administrator password"
                  className="w-full px-3.5 py-2.5 rounded-xl bg-slate-950 border border-slate-700 text-white text-sm outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 transition-colors pr-10"
                  required
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-white cursor-pointer"
                >
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            <button
              id="btn-superadmin-login"
              type="submit"
              disabled={isLoggingIn}
              className="w-full py-2.5 px-4 rounded-xl font-bold text-sm text-white bg-emerald-600 hover:bg-emerald-500 shadow-md transition-all cursor-pointer flex items-center justify-center gap-2 disabled:opacity-50"
            >
              <Lock className="w-4 h-4" />
              <span>{isLoggingIn ? "Authenticating..." : "Enter Super Admin Console"}</span>
            </button>
          </form>

          <div className="mt-6 pt-5 border-t border-slate-800 space-y-3">
            <div className="flex items-center justify-between text-xs text-slate-400">
              <div className="flex items-center gap-3">
                <button
                  type="button"
                  onClick={() => onNavigateToWorkspace()}
                  className="hover:text-emerald-400 transition-colors cursor-pointer flex items-center gap-1 font-semibold"
                >
                  <span>← Return to Tracker</span>
                </button>
                <span>•</span>
                <button
                  type="button"
                  onClick={onNavigateToLanding}
                  className="hover:text-white transition-colors cursor-pointer flex items-center gap-1"
                >
                  <span>Landing Page</span>
                </button>
              </div>
              <button
                type="button"
                onClick={() => {
                  setLoginUserId(demoAccounts.superAdmin.username);
                  setLoginPassword(demoAccounts.superAdmin.password);
                }}
                className="text-[11px] font-bold text-emerald-400 hover:text-emerald-300 underline cursor-pointer"
              >
                1-Click Autofill
              </button>
            </div>

            <div className="p-2.5 rounded-xl bg-slate-950/80 border border-slate-800 flex items-center justify-between text-[11px]">
              <span className="text-slate-400">Active Super Admin:</span>
              <span className="font-mono text-emerald-400 font-semibold">
                {demoAccounts.superAdmin.username} / {demoAccounts.superAdmin.password}
              </span>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // ---------------------------------------------------------------------------
  // 2. Main Authenticated Super Admin Platform Console View
  // ---------------------------------------------------------------------------
  return (
    <div className="min-h-screen bg-slate-900 text-slate-100 font-['Plus_Jakarta_Sans',sans-serif]">
      {/* Top Header Bar */}
      <header className="border-b border-slate-800 bg-slate-950/80 backdrop-blur-md px-6 py-4 sticky top-0 z-40 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="p-2.5 rounded-xl bg-emerald-500/10 text-emerald-400 border border-emerald-500/30">
            <ShieldAlert className="w-5 h-5" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-base sm:text-lg font-bold text-white tracking-tight">Super Admin Platform Console</h1>
              <span className="text-[10px] font-mono font-bold px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                Active Session
              </span>
            </div>
            <p className="text-xs text-slate-400">User accounts, master directory deletion, and tenant governance</p>
          </div>
        </div>

        <div className="flex items-center gap-2.5">
          <button
            type="button"
            onClick={onNavigateToLanding}
            className="px-3 py-1.5 rounded-lg text-xs font-semibold bg-slate-800 hover:bg-slate-700 text-slate-200 transition-colors cursor-pointer"
          >
            SaaS Landing Page
          </button>
          <button
            type="button"
            onClick={() => onNavigateToWorkspace()}
            className="px-3.5 py-1.5 rounded-lg text-xs font-bold bg-emerald-600 hover:bg-emerald-500 text-white shadow-sm transition-colors cursor-pointer flex items-center gap-1.5"
          >
            <span>Launch Client Workspace</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </button>
          <button
            type="button"
            onClick={handleSuperAdminLogout}
            title="Log out of Super Admin session"
            className="p-1.5 rounded-lg text-slate-400 hover:text-red-400 hover:bg-red-950/40 border border-slate-700 transition-colors cursor-pointer"
          >
            <LogOut className="w-4 h-4" />
          </button>
        </div>
      </header>

      {/* Global Feedback Banner */}
      {feedback && (
        <div
          className={`px-6 py-2.5 text-xs font-semibold flex items-center justify-between border-b ${
            feedback.type === "success"
              ? "bg-emerald-950/70 border-emerald-800 text-emerald-200"
              : "bg-red-950/70 border-red-800 text-red-200"
          }`}
        >
          <span>{feedback.message}</span>
          <button onClick={() => setFeedback(null)} className="text-slate-400 hover:text-white">
            ✕
          </button>
        </div>
      )}

      <div className="max-w-7xl mx-auto px-6 py-8 space-y-6">
        {/* KPI Metric Summary Strip */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="p-4 rounded-2xl bg-slate-800/80 border border-slate-700/80">
            <div className="flex items-center justify-between text-xs text-slate-400">
              <span>Managed User Accounts</span>
              <Users className="w-4 h-4 text-emerald-400" />
            </div>
            <div className="text-2xl font-extrabold text-white font-mono mt-1 tabular-nums">{users.length}</div>
            <div className="text-[11px] text-emerald-400 mt-1 flex items-center gap-1 font-medium">
              <span>{users.filter((u) => u.role === "manager").length} Managers</span>
              <span>·</span>
              <span className="text-slate-300">{users.filter((u) => u.role === "staff").length} Staff</span>
            </div>
          </div>

          <div className="p-4 rounded-2xl bg-slate-800/80 border border-slate-700/80">
            <div className="flex items-center justify-between text-xs text-slate-400">
              <span>Master Directory Leads</span>
              <Database className="w-4 h-4 text-indigo-400" />
            </div>
            <div className="text-2xl font-extrabold text-white font-mono mt-1 tabular-nums">
              {masterLeads.length.toLocaleString()}
            </div>
            <div className="text-[11px] text-slate-400 mt-1">Across all uploaded registers</div>
          </div>

          <div className="p-4 rounded-2xl bg-slate-800/80 border border-slate-700/80">
            <div className="flex items-center justify-between text-xs text-slate-400">
              <span>Managed Tenants</span>
              <Building2 className="w-4 h-4 text-emerald-400" />
            </div>
            <div className="text-2xl font-extrabold text-white font-mono mt-1 tabular-nums">{tenants.length}</div>
            <div className="text-[11px] text-slate-400 mt-1">RLS multi-tenant clusters</div>
          </div>

          <div className="p-4 rounded-2xl bg-slate-800/80 border border-slate-700/80">
            <div className="flex items-center justify-between text-xs text-slate-400">
              <span>Verified Backups</span>
              <CheckCircle2 className="w-4 h-4 text-teal-400" />
            </div>
            <div className="text-2xl font-extrabold text-white font-mono mt-1 tabular-nums">{backups.length}</div>
            <div className="text-[11px] text-teal-400 mt-1">Daily snapshots active</div>
          </div>
        </div>

        {/* View Tabs Bar */}
        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-800 pb-3">
          <div className="flex flex-wrap items-center gap-2">
            <button
              id="tab-superadmin-credentials"
              onClick={() => setActiveTab("credentials")}
              className={`px-4 py-2 rounded-xl text-xs font-bold transition-colors cursor-pointer flex items-center gap-1.5 ${
                activeTab === "credentials"
                  ? "bg-amber-500/20 text-amber-400 border border-amber-500/30"
                  : "text-slate-400 hover:text-white"
              }`}
            >
              <KeyRound className="w-3.5 h-3.5" />
              <span>Credential Governance</span>
            </button>

            <button
              id="tab-superadmin-users"
              onClick={() => setActiveTab("users")}
              className={`px-4 py-2 rounded-xl text-xs font-bold transition-colors cursor-pointer flex items-center gap-1.5 ${
                activeTab === "users"
                  ? "bg-emerald-500/20 text-emerald-400 border border-emerald-500/30"
                  : "text-slate-400 hover:text-white"
              }`}
            >
              <Users className="w-3.5 h-3.5" />
              <span>User Accounts ({users.length})</span>
            </button>

            <button
              id="tab-superadmin-directory"
              onClick={() => setActiveTab("directory")}
              className={`px-4 py-2 rounded-xl text-xs font-bold transition-colors cursor-pointer flex items-center gap-1.5 ${
                activeTab === "directory"
                  ? "bg-rose-500/20 text-rose-400 border border-rose-500/30"
                  : "text-slate-400 hover:text-white"
              }`}
            >
              <FileSpreadsheet className="w-3.5 h-3.5" />
              <span>Historical Client Register ({masterLeads.length})</span>
            </button>

            <button
              id="tab-superadmin-tenants"
              onClick={() => setActiveTab("tenants")}
              className={`px-4 py-2 rounded-xl text-xs font-bold transition-colors cursor-pointer flex items-center gap-1.5 ${
                activeTab === "tenants"
                  ? "bg-emerald-500/20 text-emerald-400 border border-emerald-500/30"
                  : "text-slate-400 hover:text-white"
              }`}
            >
              <Building2 className="w-3.5 h-3.5" />
              <span>Tenants & Lifecycles ({tenants.length})</span>
            </button>

            <button
              id="tab-superadmin-backups"
              onClick={() => setActiveTab("backups")}
              className={`px-4 py-2 rounded-xl text-xs font-bold transition-colors cursor-pointer flex items-center gap-1.5 ${
                activeTab === "backups"
                  ? "bg-emerald-500/20 text-emerald-400 border border-emerald-500/30"
                  : "text-slate-400 hover:text-white"
              }`}
            >
              <Database className="w-3.5 h-3.5" />
              <span>Database Backups ({backups.length})</span>
            </button>

            <button
              id="tab-superadmin-audit"
              onClick={() => setActiveTab("audit")}
              className={`px-4 py-2 rounded-xl text-xs font-bold transition-colors cursor-pointer flex items-center gap-1.5 ${
                activeTab === "audit"
                  ? "bg-emerald-500/20 text-emerald-400 border border-emerald-500/30"
                  : "text-slate-400 hover:text-white"
              }`}
            >
              <History className="w-3.5 h-3.5" />
              <span>Audit Logs ({auditLogs.length})</span>
            </button>

            <button
              id="tab-superadmin-pricing"
              onClick={() => setActiveTab("pricing")}
              className={`px-4 py-2 rounded-xl text-xs font-bold transition-colors cursor-pointer flex items-center gap-1.5 ${
                activeTab === "pricing"
                  ? "bg-emerald-500/20 text-emerald-400 border border-emerald-500/30"
                  : "text-slate-400 hover:text-white"
              }`}
            >
              <Tag className="w-3.5 h-3.5" />
              <span>Pricing & Plans Editor</span>
            </button>
          </div>

          <div className="flex items-center gap-2">
            {activeTab === "pricing" && (
              <>
                <button
                  id="btn-save-pricing-top"
                  onClick={handleSavePricing}
                  disabled={isSavingPricing}
                  className="px-3.5 py-1.5 rounded-xl text-xs font-bold bg-emerald-600 hover:bg-emerald-500 text-white shadow-xs transition-colors cursor-pointer flex items-center gap-1.5 disabled:opacity-50"
                >
                  <Save className="w-3.5 h-3.5" />
                  <span>{isSavingPricing ? "Saving..." : "Save & Publish"}</span>
                </button>
                <button
                  id="btn-reset-pricing-top"
                  onClick={() => setIsResetPricingConfirmOpen(true)}
                  disabled={isSavingPricing}
                  className="px-3 py-1.5 rounded-xl text-xs font-semibold bg-slate-800 hover:bg-slate-700 text-slate-300 transition-colors cursor-pointer flex items-center gap-1.5"
                >
                  <RotateCcw className="w-3.5 h-3.5" />
                  <span>Reset Defaults</span>
                </button>
              </>
            )}

            {activeTab === "users" && (
              <button
                id="btn-add-user-modal"
                onClick={() => setIsAddUserOpen(true)}
                className="px-3.5 py-1.5 rounded-xl text-xs font-bold bg-emerald-600 hover:bg-emerald-500 text-white shadow-xs transition-colors cursor-pointer flex items-center gap-1.5"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>Add User Account</span>
              </button>
            )}

            {activeTab === "directory" && (
              <button
                id="btn-purge-master-register"
                onClick={() => setIsPurgeRegisterOpen(true)}
                className="px-3.5 py-1.5 rounded-xl text-xs font-bold bg-rose-600 hover:bg-rose-500 text-white shadow-xs transition-colors cursor-pointer flex items-center gap-1.5"
              >
                <Trash2 className="w-3.5 h-3.5" />
                <span>Purge Master Register</span>
              </button>
            )}

            {activeTab === "tenants" && (
              <button
                onClick={() => setIsProvisionOpen(true)}
                className="px-3.5 py-1.5 rounded-xl text-xs font-bold bg-emerald-600 hover:bg-emerald-500 text-white shadow-xs transition-colors cursor-pointer flex items-center gap-1.5"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>Provision Organization</span>
              </button>
            )}

            <button
              onClick={loadAllData}
              className="p-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 transition-colors cursor-pointer"
              title="Refresh Data"
            >
              <RefreshCw className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* ------------------------------------------------------------------ */}
        {/* TAB 0: Credential Governance (Super Admin, Manager, Staff, Customer) */}
        {/* ------------------------------------------------------------------ */}
        {activeTab === "credentials" && (
          <div className="space-y-6">
            {/* Header info banner */}
            <div className="p-4 rounded-2xl bg-amber-950/30 border border-amber-900/60 flex flex-col md:flex-row md:items-center justify-between gap-4">
              <div className="flex items-center gap-3">
                <div className="p-2.5 rounded-xl bg-amber-500/20 text-amber-400">
                  <KeyRound className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-white flex items-center gap-2">
                    <span>Unified Credential Governance</span>
                    <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-amber-500/20 text-amber-300 border border-amber-500/30 font-bold uppercase">
                      Live Sync Active
                    </span>
                  </h3>
                  <p className="text-xs text-slate-300 mt-0.5">
                    Update User IDs and Passwords for all roles (Super Admin, Manager, Staff Specialist, and Customer / Client). Changes reflect instantly on login popups and the Available Demo Accounts card.
                  </p>
                </div>
              </div>
            </div>

            {/* Live Available Demo Accounts Preview Strip */}
            <div className="p-5 rounded-2xl bg-slate-950/70 border border-slate-800 shadow-md">
              <div className="flex items-center justify-between mb-3 pb-2 border-b border-slate-800">
                <div className="flex items-center gap-2">
                  <Sparkles className="w-4 h-4 text-emerald-400" />
                  <span className="text-xs font-bold text-white uppercase tracking-wider">
                    Live "Available Demo Accounts" Card (What Users & Clients See)
                  </span>
                </div>
                <span className="text-[11px] text-slate-400">
                  Click any account chip to copy test credentials
                </span>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
                {/* Customer card */}
                <div
                  onClick={() =>
                    copyToClipboard(
                      `${demoAccounts.customer.username} / ${demoAccounts.customer.password}`,
                      "copy-demo-cust"
                    )
                  }
                  className="p-3.5 rounded-xl bg-slate-900 border border-teal-500/30 hover:border-teal-400/60 transition-all cursor-pointer group"
                >
                  <div className="flex items-center justify-between mb-1.5">
                    <span className="text-[11px] font-bold text-teal-400 flex items-center gap-1.5">
                      <span>👤</span> Customer / Client
                    </span>
                    <span className="text-[9px] px-1.5 py-0.2 rounded bg-teal-500/20 text-teal-300 font-mono font-bold">
                      View-Only
                    </span>
                  </div>
                  <div className="font-mono text-xs text-white flex items-center justify-between">
                    <span>
                      <strong className="text-slate-300">ID:</strong> {demoAccounts.customer.username}
                    </span>
                    <span className="text-slate-400">/</span>
                    <span>
                      <strong className="text-slate-300">PW:</strong> {demoAccounts.customer.password}
                    </span>
                  </div>
                  <div className="text-[10px] text-teal-400/80 mt-1.5 flex items-center gap-1 group-hover:text-teal-300">
                    <Copy className="w-3 h-3" />
                    <span>{copiedId === "copy-demo-cust" ? "Copied!" : "Click to copy"}</span>
                  </div>
                </div>

                {/* Staff card */}
                <div
                  onClick={() =>
                    copyToClipboard(
                      `${demoAccounts.staff.username} / ${demoAccounts.staff.password}`,
                      "copy-demo-staff"
                    )
                  }
                  className="p-3.5 rounded-xl bg-slate-900 border border-blue-500/30 hover:border-blue-400/60 transition-all cursor-pointer group"
                >
                  <div className="flex items-center justify-between mb-1.5">
                    <span className="text-[11px] font-bold text-blue-400 flex items-center gap-1.5">
                      <span>🛡️</span> Staff Specialist
                    </span>
                    <span className="text-[9px] px-1.5 py-0.2 rounded bg-blue-500/20 text-blue-300 font-mono font-bold">
                      Queue Access
                    </span>
                  </div>
                  <div className="font-mono text-xs text-white flex items-center justify-between">
                    <span>
                      <strong className="text-slate-300">ID:</strong> {demoAccounts.staff.username}
                    </span>
                    <span className="text-slate-400">/</span>
                    <span>
                      <strong className="text-slate-300">PW:</strong> {demoAccounts.staff.password}
                    </span>
                  </div>
                  <div className="text-[10px] text-blue-400/80 mt-1.5 flex items-center gap-1 group-hover:text-blue-300">
                    <Copy className="w-3 h-3" />
                    <span>{copiedId === "copy-demo-staff" ? "Copied!" : "Click to copy"}</span>
                  </div>
                </div>

                {/* Manager card */}
                <div
                  onClick={() =>
                    copyToClipboard(
                      `${demoAccounts.manager.username} / ${demoAccounts.manager.password}`,
                      "copy-demo-mgr"
                    )
                  }
                  className="p-3.5 rounded-xl bg-slate-900 border border-purple-500/30 hover:border-purple-400/60 transition-all cursor-pointer group"
                >
                  <div className="flex items-center justify-between mb-1.5">
                    <span className="text-[11px] font-bold text-purple-400 flex items-center gap-1.5">
                      <span>👑</span> Manager
                    </span>
                    <span className="text-[9px] px-1.5 py-0.2 rounded bg-purple-500/20 text-purple-300 font-mono font-bold">
                      Full Access
                    </span>
                  </div>
                  <div className="font-mono text-xs text-white flex items-center justify-between">
                    <span>
                      <strong className="text-slate-300">ID:</strong> {demoAccounts.manager.username}
                    </span>
                    <span className="text-slate-400">/</span>
                    <span>
                      <strong className="text-slate-300">PW:</strong> {demoAccounts.manager.password}
                    </span>
                  </div>
                  <div className="text-[10px] text-purple-400/80 mt-1.5 flex items-center gap-1 group-hover:text-purple-300">
                    <Copy className="w-3 h-3" />
                    <span>{copiedId === "copy-demo-mgr" ? "Copied!" : "Click to copy"}</span>
                  </div>
                </div>

                {/* Super Admin card */}
                <div
                  onClick={() =>
                    copyToClipboard(
                      `${demoAccounts.superAdmin.username} / ${demoAccounts.superAdmin.password}`,
                      "copy-demo-sa"
                    )
                  }
                  className="p-3.5 rounded-xl bg-slate-900 border border-emerald-500/30 hover:border-emerald-400/60 transition-all cursor-pointer group"
                >
                  <div className="flex items-center justify-between mb-1.5">
                    <span className="text-[11px] font-bold text-emerald-400 flex items-center gap-1.5">
                      <span>⚡</span> Super Admin
                    </span>
                    <span className="text-[9px] px-1.5 py-0.2 rounded bg-emerald-500/20 text-emerald-300 font-mono font-bold">
                      Platform Root
                    </span>
                  </div>
                  <div className="font-mono text-xs text-white flex items-center justify-between">
                    <span>
                      <strong className="text-slate-300">ID:</strong> {demoAccounts.superAdmin.username}
                    </span>
                    <span className="text-slate-400">/</span>
                    <span>
                      <strong className="text-slate-300">PW:</strong> {demoAccounts.superAdmin.password}
                    </span>
                  </div>
                  <div className="text-[10px] text-emerald-400/80 mt-1.5 flex items-center gap-1 group-hover:text-emerald-300">
                    <Copy className="w-3 h-3" />
                    <span>{copiedId === "copy-demo-sa" ? "Copied!" : "Click to copy"}</span>
                  </div>
                </div>
              </div>
            </div>

            {/* 3 Core Governance Control Cards */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              {/* Card 1: Customer / Client Credentials */}
              <div className="bg-slate-800/60 border border-slate-700/80 rounded-2xl p-5 shadow-lg flex flex-col justify-between">
                <div>
                  <div className="flex items-center justify-between mb-4">
                    <div className="flex items-center gap-2.5">
                      <div className="p-2 rounded-xl bg-teal-500/10 text-teal-400 border border-teal-500/30">
                        <Users className="w-4 h-4" />
                      </div>
                      <div>
                        <h4 className="text-sm font-bold text-white">Customer / Client Sign-In</h4>
                        <span className="text-[11px] text-teal-400 font-medium">Customer Portal Role</span>
                      </div>
                    </div>
                    <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-teal-500/20 text-teal-300 border border-teal-500/30">
                      View-Only
                    </span>
                  </div>

                  <p className="text-xs text-slate-300 mb-4 leading-relaxed">
                    Set the login credentials used by customers/clients to sign in from the landing page. Customer role grants view-only access to leads and completion status without edit permissions.
                  </p>

                  <form onSubmit={handleSaveCustomerCreds} className="space-y-3.5">
                    <div>
                      <label className="text-xs font-semibold text-slate-300 block mb-1">
                        Customer User ID / Username
                      </label>
                      <input
                        id="input-gov-cust-userid"
                        type="text"
                        value={custNewUserId}
                        onChange={(e) => setCustNewUserId(e.target.value)}
                        placeholder="e.g. client, customer"
                        className="w-full px-3 py-2 bg-slate-900 border border-slate-700 rounded-xl text-xs text-white font-mono outline-none focus:border-teal-500"
                        required
                      />
                    </div>

                    <div>
                      <label className="text-xs font-semibold text-slate-300 block mb-1">
                        Customer Password
                      </label>
                      <div className="relative">
                        <input
                          id="input-gov-cust-password"
                          type={showCustPassword ? "text" : "password"}
                          value={custNewPassword}
                          onChange={(e) => setCustNewPassword(e.target.value)}
                          placeholder="Enter new customer password"
                          className="w-full px-3 py-2 bg-slate-900 border border-slate-700 rounded-xl text-xs text-white font-mono outline-none focus:border-teal-500 pr-10"
                          required
                        />
                        <button
                          type="button"
                          onClick={() => setShowCustPassword(!showCustPassword)}
                          className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-white cursor-pointer"
                        >
                          {showCustPassword ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                        </button>
                      </div>
                    </div>

                    <div className="pt-2">
                      <button
                        id="btn-save-cust-creds"
                        type="submit"
                        disabled={isSavingCust}
                        className="w-full py-2 px-3 rounded-xl bg-teal-600 hover:bg-teal-500 text-white font-bold text-xs shadow-sm transition-colors cursor-pointer flex items-center justify-center gap-1.5 disabled:opacity-50"
                      >
                        <Save className="w-3.5 h-3.5" />
                        <span>{isSavingCust ? "Updating..." : "Update Customer Credentials"}</span>
                      </button>
                    </div>
                  </form>
                </div>
              </div>

              {/* Card 2: Workspace Manager Credentials */}
              <div className="bg-slate-800/60 border border-slate-700/80 rounded-2xl p-5 shadow-lg flex flex-col justify-between">
                <div>
                  <div className="flex items-center justify-between mb-4">
                    <div className="flex items-center gap-2.5">
                      <div className="p-2 rounded-xl bg-purple-500/10 text-purple-400 border border-purple-500/30">
                        <Shield className="w-4 h-4" />
                      </div>
                      <div>
                        <h4 className="text-sm font-bold text-white">Workspace Manager Account</h4>
                        <span className="text-[11px] text-purple-400 font-medium">Primary CRM Admin</span>
                      </div>
                    </div>
                    <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-purple-500/20 text-purple-300 border border-purple-500/30">
                      Full Access
                    </span>
                  </div>

                  <p className="text-xs text-slate-300 mb-4 leading-relaxed">
                    Set the administrator credentials for the Workspace Manager role with unrestricted access to upload files, reassign handlers, and manage RBAC access controls.
                  </p>

                  <form onSubmit={handleSaveManagerCreds} className="space-y-3.5">
                    <div>
                      <label className="text-xs font-semibold text-slate-300 block mb-1">
                        Manager User ID / Username
                      </label>
                      <input
                        id="input-gov-mgr-userid"
                        type="text"
                        value={mgrNewUserId}
                        onChange={(e) => setMgrNewUserId(e.target.value)}
                        placeholder="e.g. admin"
                        className="w-full px-3 py-2 bg-slate-900 border border-slate-700 rounded-xl text-xs text-white font-mono outline-none focus:border-purple-500"
                        required
                      />
                    </div>

                    <div>
                      <label className="text-xs font-semibold text-slate-300 block mb-1">
                        Manager Password
                      </label>
                      <div className="relative">
                        <input
                          id="input-gov-mgr-password"
                          type={showMgrPassword ? "text" : "password"}
                          value={mgrNewPassword}
                          onChange={(e) => setMgrNewPassword(e.target.value)}
                          placeholder="Enter new manager password"
                          className="w-full px-3 py-2 bg-slate-900 border border-slate-700 rounded-xl text-xs text-white font-mono outline-none focus:border-purple-500 pr-10"
                          required
                        />
                        <button
                          type="button"
                          onClick={() => setShowMgrPassword(!showMgrPassword)}
                          className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-white cursor-pointer"
                        >
                          {showMgrPassword ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                        </button>
                      </div>
                    </div>

                    <div>
                      <label className="text-xs font-semibold text-slate-300 block mb-1">
                        Recovery & Security Email
                      </label>
                      <input
                        id="input-gov-mgr-email"
                        type="email"
                        value={mgrEmail}
                        onChange={(e) => setMgrEmail(e.target.value)}
                        placeholder="gatewaylawpartners@gmail.com"
                        className="w-full px-3 py-2 bg-slate-900 border border-slate-700 rounded-xl text-xs text-white outline-none focus:border-purple-500"
                      />
                    </div>

                    <div className="pt-2">
                      <button
                        id="btn-save-mgr-creds"
                        type="submit"
                        disabled={isSavingMgr}
                        className="w-full py-2 px-3 rounded-xl bg-purple-600 hover:bg-purple-500 text-white font-bold text-xs shadow-sm transition-colors cursor-pointer flex items-center justify-center gap-1.5 disabled:opacity-50"
                      >
                        <Save className="w-3.5 h-3.5" />
                        <span>{isSavingMgr ? "Updating..." : "Update Manager Credentials"}</span>
                      </button>
                    </div>
                  </form>
                </div>
              </div>

              {/* Card 3: Super Admin Console Account */}
              <div className="bg-slate-800/60 border border-slate-700/80 rounded-2xl p-5 shadow-lg flex flex-col justify-between">
                <div>
                  <div className="flex items-center justify-between mb-4">
                    <div className="flex items-center gap-2.5">
                      <div className="p-2 rounded-xl bg-emerald-500/10 text-emerald-400 border border-emerald-500/30">
                        <ShieldAlert className="w-4 h-4" />
                      </div>
                      <div>
                        <h4 className="text-sm font-bold text-white">Super Admin Console</h4>
                        <span className="text-[11px] text-emerald-400 font-medium">Global Platform Controller</span>
                      </div>
                    </div>
                    <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                      Platform Root
                    </span>
                  </div>

                  <p className="text-xs text-slate-300 mb-4 leading-relaxed">
                    Set the master platform administrator credentials for this Super Admin Console. Controls tenant provisioning, pricing plans, and system database backups.
                  </p>

                  <form onSubmit={handleSaveSuperAdminCreds} className="space-y-3.5">
                    <div>
                      <label className="text-xs font-semibold text-slate-300 block mb-1">
                        Super Admin User ID
                      </label>
                      <input
                        id="input-gov-sa-userid"
                        type="text"
                        value={saNewUserId}
                        onChange={(e) => setSaNewUserId(e.target.value)}
                        placeholder="e.g. superadmin"
                        className="w-full px-3 py-2 bg-slate-900 border border-slate-700 rounded-xl text-xs text-white font-mono outline-none focus:border-emerald-500"
                        required
                      />
                    </div>

                    <div>
                      <label className="text-xs font-semibold text-slate-300 block mb-1">
                        Super Admin Password
                      </label>
                      <div className="relative">
                        <input
                          id="input-gov-sa-password"
                          type={showSaPassword ? "text" : "password"}
                          value={saNewPassword}
                          onChange={(e) => setSaNewPassword(e.target.value)}
                          placeholder="Enter new Super Admin password"
                          className="w-full px-3 py-2 bg-slate-900 border border-slate-700 rounded-xl text-xs text-white font-mono outline-none focus:border-emerald-500 pr-10"
                          required
                        />
                        <button
                          type="button"
                          onClick={() => setShowSaPassword(!showSaPassword)}
                          className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-white cursor-pointer"
                        >
                          {showSaPassword ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                        </button>
                      </div>
                    </div>

                    <div>
                      <label className="text-xs font-semibold text-slate-300 block mb-1">
                        Master Audit Email
                      </label>
                      <input
                        id="input-gov-sa-email"
                        type="email"
                        value={saEmail}
                        onChange={(e) => setSaEmail(e.target.value)}
                        placeholder="superadmin@leadplatform.io"
                        className="w-full px-3 py-2 bg-slate-900 border border-slate-700 rounded-xl text-xs text-white outline-none focus:border-emerald-500"
                      />
                    </div>

                    <div className="pt-2">
                      <button
                        id="btn-save-sa-creds"
                        type="submit"
                        disabled={isSavingSa}
                        className="w-full py-2 px-3 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs shadow-sm transition-colors cursor-pointer flex items-center justify-center gap-1.5 disabled:opacity-50"
                      >
                        <Save className="w-3.5 h-3.5" />
                        <span>{isSavingSa ? "Updating..." : "Update Super Admin Credentials"}</span>
                      </button>
                    </div>
                  </form>
                </div>
              </div>
            </div>

            {/* Quick Staff Specialists & Accounts Directory Card */}
            <div className="p-5 rounded-2xl bg-slate-800/40 border border-slate-700/80">
              <div className="flex items-center justify-between mb-4">
                <div>
                  <h4 className="text-sm font-bold text-white flex items-center gap-2">
                    <Users className="w-4 h-4 text-blue-400" />
                    <span>Staff Specialists & Role Directory</span>
                  </h4>
                  <p className="text-xs text-slate-400 mt-0.5">
                    Directly change the User ID or Password for individual staff members or specialist accounts.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setIsAddUserOpen(true)}
                  className="px-3 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs flex items-center gap-1.5 cursor-pointer shadow-xs"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>Add New Account</span>
                </button>
              </div>

              <div className="overflow-x-auto rounded-xl border border-slate-700/80 bg-slate-900/60">
                <table className="w-full text-left text-xs">
                  <thead>
                    <tr className="border-b border-slate-800 text-slate-400 font-bold uppercase tracking-wider bg-slate-950/60">
                      <th className="py-2.5 px-3.5">User ID</th>
                      <th className="py-2.5 px-3.5">Display Name</th>
                      <th className="py-2.5 px-3.5">Role</th>
                      <th className="py-2.5 px-3.5">Email</th>
                      <th className="py-2.5 px-3.5 text-right">Edit Credentials</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800">
                    {users.map((u) => {
                      const isCustomer = u.role === "customer" || u.id === "user-customer";
                      return (
                        <tr key={u.id || u.username} className="hover:bg-slate-800/40 transition-colors">
                          <td className="py-2.5 px-3.5 font-mono font-bold text-white flex items-center gap-2">
                            <span className="w-6 h-6 rounded-lg bg-emerald-500/10 text-emerald-400 flex items-center justify-center text-[10px]">
                              {u.username.charAt(0).toUpperCase()}
                            </span>
                            <span>{u.username}</span>
                          </td>
                          <td className="py-2.5 px-3.5 text-slate-300 font-semibold">{u.displayName || u.username}</td>
                          <td className="py-2.5 px-3.5">
                            <span
                              className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                                u.role === "manager"
                                  ? "bg-purple-500/20 text-purple-300 border border-purple-500/30"
                                  : isCustomer
                                  ? "bg-teal-500/20 text-teal-300 border border-teal-500/30"
                                  : "bg-blue-500/20 text-blue-300 border border-blue-500/30"
                              }`}
                            >
                              {u.role === "manager" ? "Manager" : isCustomer ? "Customer (View-Only)" : "Staff Specialist"}
                            </span>
                          </td>
                          <td className="py-2.5 px-3.5 text-slate-400 font-mono text-[11px]">{u.email || "—"}</td>
                          <td className="py-2.5 px-3.5 text-right">
                            <button
                              type="button"
                              onClick={() => {
                                setEditingUser(u);
                                setEditUserNewUsername(u.username);
                                setEditUserNewPassword("");
                              }}
                              className="px-2.5 py-1 rounded-lg bg-slate-800 hover:bg-amber-950/50 hover:text-amber-300 text-slate-300 font-semibold text-[11px] transition-colors border border-slate-700 hover:border-amber-700/60 cursor-pointer inline-flex items-center gap-1.5"
                            >
                              <KeyRound className="w-3 h-3 text-amber-400" />
                              <span>Change User ID / Password</span>
                            </button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {/* ------------------------------------------------------------------ */}
        {/* TAB 1: User Accounts Management (Add & Delete User Accounts)        */}
        {/* ------------------------------------------------------------------ */}
        {activeTab === "users" && (
          <div className="space-y-4">
            <div className="flex items-center justify-between gap-4">
              <div className="relative flex-1 max-w-md">
                <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                <input
                  type="text"
                  value={searchFilter}
                  onChange={(e) => setSearchFilter(e.target.value)}
                  placeholder="Filter users by username, role, or email..."
                  className="w-full pl-9 pr-4 py-2 bg-slate-800/80 border border-slate-700 rounded-xl text-xs text-white placeholder:text-slate-400 outline-none focus:ring-1 focus:ring-emerald-500"
                />
              </div>
              <span className="text-xs text-slate-400">
                Displaying {filteredUsers.length} of {users.length} registered accounts
              </span>
            </div>

            <div className="overflow-x-auto rounded-2xl border border-slate-800 bg-slate-800/40">
              <table className="w-full text-left text-xs">
                <thead>
                  <tr className="border-b border-slate-700/80 bg-slate-900/60 text-slate-400 font-bold uppercase tracking-wider">
                    <th className="py-3 px-4">User ID / Username</th>
                    <th className="py-3 px-4">Display Name</th>
                    <th className="py-3 px-4">Role</th>
                    <th className="py-3 px-4">Contact Email</th>
                    <th className="py-3 px-4">Status</th>
                    <th className="py-3 px-4">Created Date</th>
                    <th className="py-3 px-4 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800">
                  {filteredUsers.length === 0 ? (
                    <tr>
                      <td colSpan={7} className="py-8 text-center text-slate-400">
                        No user accounts match the current search filter.
                      </td>
                    </tr>
                  ) : (
                    filteredUsers.map((u) => {
                      const isRootAdmin = u.id === "user-admin" || u.username.toLowerCase() === "admin";
                      return (
                        <tr key={u.id || u.username} className="hover:bg-slate-800/60 transition-colors">
                          <td className="py-3 px-4 font-mono font-bold text-white flex items-center gap-2">
                            <span className="w-6 h-6 rounded-lg bg-emerald-500/10 text-emerald-400 flex items-center justify-center text-[11px]">
                              {u.username.charAt(0).toUpperCase()}
                            </span>
                            <span>{u.username}</span>
                            {isRootAdmin && (
                              <span className="text-[9px] font-bold px-1.5 py-0.2 rounded bg-amber-500/20 text-amber-300 border border-amber-500/30">
                                Primary Admin
                              </span>
                            )}
                          </td>
                          <td className="py-3 px-4 text-slate-200 font-semibold">{u.displayName || u.username}</td>
                          <td className="py-3 px-4">
                            <span
                              className={`text-[11px] font-bold px-2 py-0.5 rounded-full ${
                                u.role === "manager"
                                  ? "bg-purple-500/20 text-purple-300 border border-purple-500/30"
                                  : u.role === "customer"
                                  ? "bg-teal-500/20 text-teal-300 border border-teal-500/30"
                                  : "bg-blue-500/20 text-blue-300 border border-blue-500/30"
                              }`}
                            >
                              {u.role === "manager" ? "Manager" : u.role === "customer" ? "Customer (View-Only)" : "Staff Specialist"}
                            </span>
                          </td>
                          <td className="py-3 px-4 text-slate-300 font-mono text-[11px]">
                            {u.email || "No email registered"}
                          </td>
                          <td className="py-3 px-4">
                            <span
                              className={`text-[10px] font-bold px-2 py-0.5 rounded-md ${
                                u.status === "active"
                                  ? "bg-emerald-950 text-emerald-300 border border-emerald-800"
                                  : "bg-slate-800 text-slate-400"
                              }`}
                            >
                              {u.status || "active"}
                            </span>
                          </td>
                          <td className="py-3 px-4 text-slate-400 text-[11px]">
                            {u.createdAt ? u.createdAt.slice(0, 10) : "System Default"}
                          </td>
                          <td className="py-3 px-4 text-right">
                            <div className="flex items-center justify-end gap-1.5">
                              <button
                                type="button"
                                onClick={() => {
                                  setEditingUser(u);
                                  setEditUserNewUsername(u.username);
                                  setEditUserNewPassword("");
                                }}
                                title={`Edit User ID & Password for ${u.username}`}
                                className="p-1.5 rounded-lg text-slate-400 hover:text-amber-400 hover:bg-amber-950/40 cursor-pointer transition-colors"
                              >
                                <KeyRound className="w-4 h-4" />
                              </button>
                              <button
                                type="button"
                                disabled={isRootAdmin}
                                onClick={() => setDeleteUserConfirm(u)}
                                title={isRootAdmin ? "Primary Admin cannot be deleted" : `Delete ${u.username}`}
                                className={`p-1.5 rounded-lg transition-colors ${
                                  isRootAdmin
                                    ? "text-slate-600 cursor-not-allowed"
                                    : "text-slate-400 hover:text-red-400 hover:bg-red-950/40 cursor-pointer"
                                }`}
                              >
                                <Trash2 className="w-4 h-4" />
                              </button>
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
        )}

        {/* ------------------------------------------------------------------ */}
        {/* TAB 2: Historical Client Register (Master Directory Deletion)      */}
        {/* ------------------------------------------------------------------ */}
        {activeTab === "directory" && (
          <div className="space-y-4">
            <div className="p-4 rounded-2xl bg-rose-950/30 border border-rose-900/60 flex items-center justify-between gap-4">
              <div className="flex items-center gap-3">
                <div className="p-2.5 rounded-xl bg-rose-500/20 text-rose-400">
                  <AlertTriangle className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-white">Historical Client Register (Master Directory)</h3>
                  <p className="text-xs text-slate-300">
                    Total of {masterLeads.length} client records across combined spreadsheet imports. You can delete single records or execute a bulk purge.
                  </p>
                </div>
              </div>

              <button
                type="button"
                onClick={() => setIsPurgeRegisterOpen(true)}
                className="px-4 py-2 rounded-xl text-xs font-bold bg-rose-600 hover:bg-rose-500 text-white shadow-md transition-colors cursor-pointer flex items-center gap-1.5 shrink-0"
              >
                <Trash2 className="w-4 h-4" />
                <span>Delete All Historical Records</span>
              </button>
            </div>

            <div className="flex items-center justify-between gap-4">
              <div className="relative flex-1 max-w-md">
                <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                <input
                  type="text"
                  value={directorySearch}
                  onChange={(e) => setDirectorySearch(e.target.value)}
                  placeholder="Search historical records by name, phone, email, handler, or city..."
                  className="w-full pl-9 pr-4 py-2 bg-slate-800/80 border border-slate-700 rounded-xl text-xs text-white placeholder:text-slate-400 outline-none focus:ring-1 focus:ring-emerald-500"
                />
              </div>
              <span className="text-xs text-slate-400">
                Showing {filteredMasterLeads.length} of {masterLeads.length} records
              </span>
            </div>

            <div className="overflow-x-auto rounded-2xl border border-slate-800 bg-slate-800/40">
              <table className="w-full text-left text-xs">
                <thead>
                  <tr className="border-b border-slate-700/80 bg-slate-900/60 text-slate-400 font-bold uppercase tracking-wider">
                    <th className="py-3 px-4">Client Name</th>
                    <th className="py-3 px-4">Phone Number</th>
                    <th className="py-3 px-4">Email</th>
                    <th className="py-3 px-4">Territory / City</th>
                    <th className="py-3 px-4">Status</th>
                    <th className="py-3 px-4">Assigned Handler</th>
                    <th className="py-3 px-4">Source Spreadsheet</th>
                    <th className="py-3 px-4 text-right">Delete</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800">
                  {filteredMasterLeads.length === 0 ? (
                    <tr>
                      <td colSpan={8} className="py-8 text-center text-slate-400">
                        {masterLeads.length === 0
                          ? "The Historical Client Register is currently empty."
                          : "No historical client records match your search."}
                      </td>
                    </tr>
                  ) : (
                    filteredMasterLeads.map((lead) => (
                      <tr key={lead.id} className="hover:bg-slate-800/60 transition-colors">
                        <td className="py-3 px-4 font-bold text-white">{lead.fullName}</td>
                        <td className="py-3 px-4 font-mono text-slate-300">{lead.phoneNumber}</td>
                        <td className="py-3 px-4 text-slate-400 truncate max-w-[150px]">{lead.email || "—"}</td>
                        <td className="py-3 px-4 text-slate-300">{lead.city || "—"}</td>
                        <td className="py-3 px-4">
                          <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-slate-700 text-slate-200">
                            {lead.status}
                          </span>
                        </td>
                        <td className="py-3 px-4">
                          <span
                            className={`text-[11px] font-semibold ${
                              lead.handlerName ? "text-emerald-400" : "text-slate-500 italic"
                            }`}
                          >
                            {lead.handlerName || "Unassigned"}
                          </span>
                        </td>
                        <td className="py-3 px-4 text-slate-400 text-[11px] truncate max-w-[140px]">
                          {lead.uploadedFileName || "Manual entry"}
                        </td>
                        <td className="py-3 px-4 text-right">
                          <button
                            type="button"
                            onClick={() => setDeleteLeadConfirm(lead)}
                            title={`Delete record for ${lead.fullName}`}
                            className="p-1.5 rounded-lg text-slate-400 hover:text-red-400 hover:bg-red-950/40 cursor-pointer transition-colors"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* ------------------------------------------------------------------ */}
        {/* TAB 3: Tenants & Lifecycle Controls                                 */}
        {/* ------------------------------------------------------------------ */}
        {activeTab === "tenants" && (
          <div className="space-y-4">
            <div className="flex items-center justify-between gap-4">
              <div className="relative flex-1 max-w-md">
                <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                <input
                  type="text"
                  value={searchFilter}
                  onChange={(e) => setSearchFilter(e.target.value)}
                  placeholder="Filter organizations by name, slug, or status..."
                  className="w-full pl-9 pr-4 py-2 bg-slate-800/80 border border-slate-700 rounded-xl text-xs text-white placeholder:text-slate-400 outline-none focus:ring-1 focus:ring-emerald-500"
                />
              </div>
              <span className="text-xs text-slate-400">
                Displaying {filteredTenants.length} of {tenants.length} organizations
              </span>
            </div>

            <div className="overflow-x-auto rounded-2xl border border-slate-800 bg-slate-800/40">
              <table className="w-full text-left text-xs">
                <thead>
                  <tr className="border-b border-slate-700/80 bg-slate-900/60 text-slate-400 font-bold uppercase tracking-wider">
                    <th className="py-3 px-4">Organization & Domain</th>
                    <th className="py-3 px-4">Status & Validity</th>
                    <th className="py-3 px-4">Tier</th>
                    <th className="py-3 px-4">RLS Leads</th>
                    <th className="py-3 px-4">Monthly Rate</th>
                    <th className="py-3 px-4 text-right">Lifecycle Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800">
                  {filteredTenants.map((tenant) => {
                    const daysLeft = Math.ceil(
                      (new Date(tenant.expiresAt).getTime() - Date.now()) / (1000 * 60 * 60 * 24)
                    );
                    return (
                      <tr key={tenant.id} className="hover:bg-slate-800/60 transition-colors">
                        <td className="py-3.5 px-4">
                          <div className="font-bold text-white text-sm">{tenant.name}</div>
                          <div className="text-[11px] font-mono text-emerald-400 flex items-center gap-1 mt-0.5">
                            <span>{tenant.slug}.leadplatform.io</span>
                          </div>
                        </td>
                        <td className="py-3.5 px-4">
                          <span
                            className={`text-[10px] font-extrabold uppercase px-2 py-0.5 rounded-full ${
                              tenant.status === "active"
                                ? "bg-emerald-950 text-emerald-300 border border-emerald-800"
                                : tenant.status === "view_only"
                                ? "bg-amber-950 text-amber-300 border border-amber-800"
                                : tenant.status === "paused"
                                ? "bg-blue-950 text-blue-300 border border-blue-800"
                                : "bg-red-950 text-red-300 border border-red-800"
                            }`}
                          >
                            {tenant.status.replace("_", " ")}
                          </span>
                          <div className="text-[11px] text-slate-400 font-mono mt-1">
                            {daysLeft > 0 ? `${daysLeft} days remaining` : "Expired"}
                          </div>
                        </td>
                        <td className="py-3.5 px-4 font-semibold text-slate-300 capitalize">{tenant.planTier}</td>
                        <td className="py-3.5 px-4 font-mono font-bold text-white tabular-nums">
                          {(tenant.activeLeadsCount || 1200).toLocaleString()}
                        </td>
                        <td className="py-3.5 px-4 font-mono text-emerald-400 font-bold">
                          ${tenant.monthlyPriceUsd || 149}/mo
                        </td>
                        <td className="py-3.5 px-4 text-right">
                          <div className="flex items-center justify-end gap-1.5">
                            {tenant.status !== "active" ? (
                              <button
                                onClick={() => handleUpdateStatus(tenant.id, "active")}
                                className="px-2.5 py-1 bg-emerald-600/30 hover:bg-emerald-600/50 text-emerald-300 border border-emerald-500/40 rounded-lg text-[11px] font-bold cursor-pointer"
                              >
                                Activate
                              </button>
                            ) : (
                              <button
                                onClick={() => handleUpdateStatus(tenant.id, "view_only")}
                                className="px-2.5 py-1 bg-amber-600/30 hover:bg-amber-600/50 text-amber-300 border border-amber-500/40 rounded-lg text-[11px] font-bold cursor-pointer"
                              >
                                View-Only
                              </button>
                            )}

                            <button
                              onClick={() => handleExtendTrial(tenant.id, 60)}
                              className="px-2.5 py-1 bg-slate-700 hover:bg-slate-600 text-slate-200 rounded-lg text-[11px] font-bold cursor-pointer"
                            >
                              +60 Days
                            </button>

                            <button
                              onClick={() => {
                                setSelectedTenantForStripe(tenant);
                                setIsStripeModalOpen(true);
                              }}
                              className="px-2.5 py-1 bg-indigo-600/40 hover:bg-indigo-600/60 text-indigo-200 border border-indigo-500/40 rounded-lg text-[11px] font-bold cursor-pointer flex items-center gap-1"
                            >
                              <CreditCard className="w-3 h-3" />
                              <span>Stripe</span>
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* ------------------------------------------------------------------ */}
        {/* TAB 4: Database Backups & Snapshots                                */}
        {/* ------------------------------------------------------------------ */}
        {activeTab === "backups" && (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <p className="text-xs text-slate-400">
                Cryptographically hashed snapshots with row-level integrity checks.
              </p>
              <button
                onClick={handleCreateBackup}
                className="px-3.5 py-1.5 rounded-xl text-xs font-bold bg-emerald-600 hover:bg-emerald-500 text-white shadow-xs cursor-pointer flex items-center gap-1.5"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>Create Instant Snapshot</span>
              </button>
            </div>

            <div className="overflow-x-auto rounded-2xl border border-slate-800 bg-slate-800/40">
              <table className="w-full text-left text-xs">
                <thead>
                  <tr className="border-b border-slate-700/80 bg-slate-900/60 text-slate-400 font-bold uppercase tracking-wider">
                    <th className="py-3 px-4">Snapshot ID</th>
                    <th className="py-3 px-4">Created At</th>
                    <th className="py-3 px-4">Total Records</th>
                    <th className="py-3 px-4">Archive Size</th>
                    <th className="py-3 px-4">Integrity Hash</th>
                    <th className="py-3 px-4 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800">
                  {backups.map((b) => (
                    <tr key={b.id} className="hover:bg-slate-800/60 transition-colors">
                      <td className="py-3 px-4 font-mono font-bold text-white">{b.id}</td>
                      <td className="py-3 px-4 text-slate-300 font-mono text-[11px]">{b.timestamp}</td>
                      <td className="py-3 px-4 font-mono font-bold text-emerald-400 tabular-nums">
                        {b.leadsCount.toLocaleString()} leads
                      </td>
                      <td className="py-3 px-4 font-mono text-slate-400">{b.sizeFormatted || `${b.sizeBytes} B`}</td>
                      <td className="py-3 px-4 font-mono text-[10px] text-slate-500 truncate max-w-[120px]">
                        {b.checksum}
                      </td>
                      <td className="py-3 px-4 text-right">
                        <button
                          onClick={() => handleRestoreBackup(b.id)}
                          className="px-2.5 py-1 bg-slate-700 hover:bg-slate-600 text-slate-200 rounded-lg text-[11px] font-bold cursor-pointer"
                        >
                          Verify Restore
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* ------------------------------------------------------------------ */}
        {/* TAB 5: Audit Logs                                                  */}
        {/* ------------------------------------------------------------------ */}
        {activeTab === "audit" && (
          <div className="space-y-4">
            <div className="overflow-x-auto rounded-2xl border border-slate-800 bg-slate-800/40">
              <table className="w-full text-left text-xs">
                <thead>
                  <tr className="border-b border-slate-700/80 bg-slate-900/60 text-slate-400 font-bold uppercase tracking-wider">
                    <th className="py-3 px-4">Timestamp</th>
                    <th className="py-3 px-4">Actor</th>
                    <th className="py-3 px-4">Action</th>
                    <th className="py-3 px-4">Severity</th>
                    <th className="py-3 px-4">Details</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800 font-mono">
                  {auditLogs.map((log) => (
                    <tr key={log.id} className="hover:bg-slate-800/60 transition-colors">
                      <td className="py-3 px-4 text-slate-400 text-[11px]">{log.timestamp.slice(0, 19)}</td>
                      <td className="py-3 px-4 text-emerald-400">{log.actorEmail}</td>
                      <td className="py-3 px-4 font-bold text-white">{log.action}</td>
                      <td className="py-3 px-4">
                        <span
                          className={`text-[9px] uppercase px-1.5 py-0.2 rounded font-extrabold ${
                            log.severity === "critical"
                              ? "bg-red-950 text-red-300 border border-red-800"
                              : log.severity === "warning"
                              ? "bg-amber-950 text-amber-300 border border-amber-800"
                              : "bg-emerald-950 text-emerald-300 border border-emerald-800"
                          }`}
                        >
                          {log.severity || "info"}
                        </span>
                      </td>
                      <td className="py-3 px-4 text-slate-300 font-sans text-xs">{log.details}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* ------------------------------------------------------------------ */}
        {/* TAB 6: Pricing & Plans Editor (Full Customization & Live Preview)  */}
        {/* ------------------------------------------------------------------ */}
        {activeTab === "pricing" && (
          <div className="space-y-6">
            {/* Top Info Banner */}
            <div className="p-4 rounded-2xl bg-slate-800/80 border border-slate-700/80 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
              <div className="flex items-center gap-3">
                <div className="p-2.5 rounded-xl bg-emerald-500/10 text-emerald-400 border border-emerald-500/30">
                  <Tag className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-white">SaaS Landing Page Pricing & Plans Configurator</h3>
                  <p className="text-xs text-slate-400">
                    Modify headlines, billing cycle labels, discount copy, plan prices, and feature checklists. Changes publish live immediately.
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-2 self-end sm:self-center">
                {pricing.updatedAt && (
                  <span className="text-[11px] text-slate-400 font-mono hidden md:inline">
                    Last updated: {new Date(pricing.updatedAt).toLocaleTimeString()}
                  </span>
                )}
                <button
                  type="button"
                  onClick={handleSavePricing}
                  disabled={isSavingPricing}
                  className="px-4 py-2 rounded-xl text-xs font-bold bg-emerald-600 hover:bg-emerald-500 text-white shadow-md transition-all cursor-pointer flex items-center gap-1.5 disabled:opacity-50"
                >
                  <Save className="w-4 h-4" />
                  <span>{isSavingPricing ? "Publishing..." : "Save & Publish"}</span>
                </button>
              </div>
            </div>

            {/* Main 2-Column Editor Layout: Form Editor on Left (7 cols), Live Preview on Right (5 cols) */}
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
              {/* Left Column: Form Controls */}
              <div className="lg:col-span-7 space-y-6">
                {/* 1. Header & Billing Controls Card */}
                <div className="p-5 rounded-2xl bg-slate-800/60 border border-slate-700 space-y-4">
                  <div className="flex items-center justify-between border-b border-slate-700/80 pb-3">
                    <div className="flex items-center gap-2 text-white font-bold text-xs uppercase tracking-wider">
                      <Sliders className="w-4 h-4 text-emerald-400" />
                      <span>Section Headlines & Billing Controls</span>
                    </div>
                    <span className="text-[11px] text-slate-400">Hero & Toggle copy</span>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5 text-xs">
                    <div>
                      <label className="text-slate-300 font-bold block mb-1">Section Badge Label</label>
                      <input
                        type="text"
                        value={pricing.sectionBadge}
                        onChange={(e) => setPricing((prev) => ({ ...prev, sectionBadge: e.target.value }))}
                        placeholder="Transparent Pricing"
                        className="w-full px-3 py-2 bg-slate-900 border border-slate-700 rounded-xl text-white outline-none focus:border-emerald-500"
                      />
                    </div>

                    <div>
                      <label className="text-slate-300 font-bold block mb-1">Main Section Headline</label>
                      <input
                        type="text"
                        value={pricing.mainHeadline}
                        onChange={(e) => setPricing((prev) => ({ ...prev, mainHeadline: e.target.value }))}
                        placeholder="Predictable Plans for Scaling Sales Teams"
                        className="w-full px-3 py-2 bg-slate-900 border border-slate-700 rounded-xl text-white outline-none focus:border-emerald-500 font-semibold"
                      />
                    </div>

                    <div className="sm:col-span-2">
                      <label className="text-slate-300 font-bold block mb-1">Subheadline Description</label>
                      <textarea
                        rows={2}
                        value={pricing.subheadline}
                        onChange={(e) => setPricing((prev) => ({ ...prev, subheadline: e.target.value }))}
                        placeholder="Choose a plan based on your team size and monthly ingestion volume. Every plan includes the full RLS database."
                        className="w-full px-3 py-2 bg-slate-900 border border-slate-700 rounded-xl text-white outline-none focus:border-emerald-500 resize-none"
                      />
                    </div>

                    <div>
                      <label className="text-slate-300 font-bold block mb-1">Monthly Billing Button</label>
                      <input
                        type="text"
                        value={pricing.monthlyToggleLabel}
                        onChange={(e) => setPricing((prev) => ({ ...prev, monthlyToggleLabel: e.target.value }))}
                        placeholder="Monthly Billing"
                        className="w-full px-3 py-2 bg-slate-900 border border-slate-700 rounded-xl text-white outline-none focus:border-emerald-500"
                      />
                    </div>

                    <div>
                      <label className="text-slate-300 font-bold block mb-1">Annual Billing Button</label>
                      <input
                        type="text"
                        value={pricing.annualToggleLabel}
                        onChange={(e) => setPricing((prev) => ({ ...prev, annualToggleLabel: e.target.value }))}
                        placeholder="Annual (2 Months Free)"
                        className="w-full px-3 py-2 bg-slate-900 border border-slate-700 rounded-xl text-white outline-none focus:border-emerald-500"
                      />
                    </div>

                    <div className="sm:col-span-2">
                      <label className="text-slate-300 font-bold block mb-1">Annual Discount Subtitle / Note</label>
                      <input
                        type="text"
                        value={pricing.annualDiscountNote || ""}
                        onChange={(e) => setPricing((prev) => ({ ...prev, annualDiscountNote: e.target.value }))}
                        placeholder="Save up to 20% with annual plans"
                        className="w-full px-3 py-2 bg-slate-900 border border-slate-700 rounded-xl text-white outline-none focus:border-emerald-500"
                      />
                    </div>
                  </div>
                </div>

                {/* 2. Tier Selection & Configurator Card */}
                <div className="p-5 rounded-2xl bg-slate-800/60 border border-slate-700 space-y-4">
                  <div className="flex items-center justify-between border-b border-slate-700/80 pb-3">
                    <div className="flex items-center gap-2 text-white font-bold text-xs uppercase tracking-wider">
                      <CreditCard className="w-4 h-4 text-emerald-400" />
                      <span>Plan Packages Configurator</span>
                    </div>
                    <span className="text-[11px] text-slate-400">Select tier below to customize</span>
                  </div>

                  {/* Tier Selector Tabs */}
                  <div className="grid grid-cols-3 gap-2">
                    {pricing.tiers.map((t, idx) => (
                      <button
                        key={t.id}
                        type="button"
                        onClick={() => setActivePricingTierIdx(idx)}
                        className={`p-3 rounded-xl text-left border transition-all cursor-pointer ${
                          activePricingTierIdx === idx
                            ? "bg-emerald-500/15 border-emerald-500 text-white shadow-sm"
                            : "bg-slate-900/60 border-slate-700/80 text-slate-400 hover:text-white hover:border-slate-600"
                        }`}
                      >
                        <div className="text-[10px] uppercase font-bold text-slate-400 flex items-center justify-between">
                          <span>Tier 0{idx + 1}</span>
                          {t.isPopular && (
                            <span className="text-[9px] px-1.5 py-0.2 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                              Popular
                            </span>
                          )}
                        </div>
                        <div className="text-xs font-bold text-white mt-1 truncate">{t.name}</div>
                        <div className="text-[11px] font-mono text-emerald-400 mt-0.5">
                          {t.priceMonthly} / {t.priceAnnual}
                        </div>
                      </button>
                    ))}
                  </div>

                  {/* Active Tier Form */}
                  {pricing.tiers[activePricingTierIdx] && (() => {
                    const activeTier = pricing.tiers[activePricingTierIdx];

                    const updateActiveTier = (patch: Partial<PricingTierConfig>) => {
                      setPricing((prev) => {
                        const nextTiers = [...prev.tiers];
                        nextTiers[activePricingTierIdx] = {
                          ...nextTiers[activePricingTierIdx],
                          ...patch,
                        };
                        return { ...prev, tiers: nextTiers };
                      });
                    };

                    return (
                      <div className="space-y-4 pt-2 text-xs">
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                          <div>
                            <label className="text-slate-300 font-bold block mb-1">Plan Display Name</label>
                            <input
                              type="text"
                              value={activeTier.name}
                              onChange={(e) => updateActiveTier({ name: e.target.value })}
                              placeholder="e.g. Standard Organization"
                              className="w-full px-3 py-2 bg-slate-900 border border-slate-700 rounded-xl text-white outline-none focus:border-emerald-500 font-bold"
                            />
                          </div>

                          <div>
                            <label className="text-slate-300 font-bold block mb-1">Category / Tagline Badge</label>
                            <input
                              type="text"
                              value={activeTier.badge}
                              onChange={(e) => updateActiveTier({ badge: e.target.value })}
                              placeholder="e.g. Growing Operations"
                              className="w-full px-3 py-2 bg-slate-900 border border-slate-700 rounded-xl text-white outline-none focus:border-emerald-500"
                            />
                          </div>

                          <div className="sm:col-span-2">
                            <label className="text-slate-300 font-bold block mb-1">Plan Description</label>
                            <input
                              type="text"
                              value={activeTier.description}
                              onChange={(e) => updateActiveTier({ description: e.target.value })}
                              placeholder="e.g. For active sales branches and outbound teams"
                              className="w-full px-3 py-2 bg-slate-900 border border-slate-700 rounded-xl text-white outline-none focus:border-emerald-500"
                            />
                          </div>

                          <div className="p-3 rounded-xl bg-slate-900 border border-slate-800 flex items-center justify-between sm:col-span-2">
                            <div>
                              <span className="text-white font-bold block">Highlight as "Most Popular"</span>
                              <span className="text-[11px] text-slate-400">Adds an emerald border and top badge highlight</span>
                            </div>
                            <div className="flex items-center gap-3">
                              <input
                                type="text"
                                value={activeTier.popularBadge || "Most Popular"}
                                onChange={(e) => updateActiveTier({ popularBadge: e.target.value })}
                                placeholder="Most Popular"
                                className="px-2.5 py-1 bg-slate-950 border border-slate-700 rounded-lg text-white text-[11px] outline-none focus:border-emerald-500 w-28"
                              />
                              <input
                                type="checkbox"
                                checked={Boolean(activeTier.isPopular)}
                                onChange={(e) => updateActiveTier({ isPopular: e.target.checked })}
                                className="w-4 h-4 accent-emerald-500 cursor-pointer"
                              />
                            </div>
                          </div>

                          <div>
                            <label className="text-slate-300 font-bold block mb-1">Monthly Billing Price ($)</label>
                            <div className="flex gap-2">
                              <input
                                type="text"
                                value={activeTier.priceMonthly}
                                onChange={(e) => updateActiveTier({ priceMonthly: e.target.value })}
                                placeholder="$149"
                                className="w-1/2 px-3 py-2 bg-slate-900 border border-slate-700 rounded-xl text-white font-mono font-bold outline-none focus:border-emerald-500"
                              />
                              <input
                                type="text"
                                value={activeTier.periodTextMonthly}
                                onChange={(e) => updateActiveTier({ periodTextMonthly: e.target.value })}
                                placeholder="/ month"
                                className="w-1/2 px-3 py-2 bg-slate-900 border border-slate-700 rounded-xl text-slate-300 text-[11px] outline-none focus:border-emerald-500"
                              />
                            </div>
                          </div>

                          <div>
                            <label className="text-slate-300 font-bold block mb-1">Annual Billing Price ($)</label>
                            <div className="flex gap-2">
                              <input
                                type="text"
                                value={activeTier.priceAnnual}
                                onChange={(e) => updateActiveTier({ priceAnnual: e.target.value })}
                                placeholder="$124"
                                className="w-1/2 px-3 py-2 bg-slate-900 border border-slate-700 rounded-xl text-emerald-400 font-mono font-bold outline-none focus:border-emerald-500"
                              />
                              <input
                                type="text"
                                value={activeTier.periodTextAnnual}
                                onChange={(e) => updateActiveTier({ periodTextAnnual: e.target.value })}
                                placeholder="/ month"
                                className="w-1/2 px-3 py-2 bg-slate-900 border border-slate-700 rounded-xl text-slate-300 text-[11px] outline-none focus:border-emerald-500"
                              />
                            </div>
                          </div>

                          <div>
                            <label className="text-slate-300 font-bold block mb-1">Button Call-to-Action Text</label>
                            <input
                              type="text"
                              value={activeTier.ctaText}
                              onChange={(e) => updateActiveTier({ ctaText: e.target.value })}
                              placeholder="Activate Standard with Stripe"
                              className="w-full px-3 py-2 bg-slate-900 border border-slate-700 rounded-xl text-white outline-none focus:border-emerald-500 font-bold"
                            />
                          </div>

                          <div>
                            <label className="text-slate-300 font-bold block mb-1">Button Action Trigger</label>
                            <select
                              value={activeTier.ctaAction}
                              onChange={(e) => updateActiveTier({ ctaAction: e.target.value as any })}
                              className="w-full px-3 py-2 bg-slate-900 border border-slate-700 rounded-xl text-white outline-none focus:border-emerald-500"
                            >
                              <option value="trial">Launch Free Workspace (Trial)</option>
                              <option value="stripe_standard">Trigger Stripe Standard Checkout Modal</option>
                              <option value="stripe_enterprise">Trigger Stripe Enterprise Checkout Modal</option>
                              <option value="contact">Open Enterprise Sales Email Inquirer</option>
                            </select>
                          </div>
                        </div>

                        {/* Features Checklist Editor */}
                        <div className="pt-2 border-t border-slate-700/80 space-y-2.5">
                          <label className="text-slate-300 font-bold flex items-center justify-between">
                            <span>Features Checklist ({activeTier.features.length})</span>
                            <span className="text-[10px] text-slate-400 font-normal">Edit text or remove unwanted items</span>
                          </label>

                          <div className="space-y-2 max-h-48 overflow-y-auto pr-1">
                            {activeTier.features.map((feat, fIdx) => (
                              <div key={fIdx} className="flex items-center gap-2">
                                <span className="w-5 h-5 rounded-md bg-emerald-500/10 text-emerald-400 flex items-center justify-center shrink-0">
                                  ✓
                                </span>
                                <input
                                  type="text"
                                  value={feat}
                                  onChange={(e) => handleUpdateActiveTierFeature(fIdx, e.target.value)}
                                  className="flex-1 px-2.5 py-1.5 bg-slate-900 border border-slate-700 rounded-lg text-white text-xs outline-none focus:border-emerald-500"
                                />
                                <button
                                  type="button"
                                  onClick={() => handleRemoveFeatureFromActiveTier(fIdx)}
                                  className="p-1.5 rounded-lg text-slate-400 hover:text-red-400 hover:bg-red-950/40 cursor-pointer"
                                  title="Remove this feature"
                                >
                                  <Trash2 className="w-3.5 h-3.5" />
                                </button>
                              </div>
                            ))}
                          </div>

                          {/* Add Feature input */}
                          <div className="flex items-center gap-2 pt-1">
                            <input
                              type="text"
                              value={newFeatureText}
                              onChange={(e) => setNewFeatureText(e.target.value)}
                              onKeyDown={(e) => {
                                if (e.key === "Enter") {
                                  e.preventDefault();
                                  handleAddFeatureToActiveTier();
                                }
                              }}
                              placeholder="Add a new feature bullet (e.g. 'Automated WhatsApp Webhook Sync')..."
                              className="flex-1 px-3 py-2 bg-slate-900 border border-slate-700 rounded-xl text-white text-xs outline-none focus:border-emerald-500"
                            />
                            <button
                              type="button"
                              onClick={handleAddFeatureToActiveTier}
                              disabled={!newFeatureText.trim()}
                              className="px-3 py-2 rounded-xl bg-slate-700 hover:bg-slate-600 text-white font-bold text-xs disabled:opacity-40 cursor-pointer flex items-center gap-1"
                            >
                              <Plus className="w-3.5 h-3.5" />
                              <span>Add</span>
                            </button>
                          </div>
                        </div>
                      </div>
                    );
                  })()}
                </div>
              </div>

              {/* Right Column: Interactive Real-Time Preview */}
              <div className="lg:col-span-5 space-y-4 sticky top-24">
                <div className="p-5 rounded-2xl bg-slate-800/60 border border-slate-700 space-y-4">
                  <div className="flex items-center justify-between border-b border-slate-700/80 pb-3">
                    <div className="flex items-center gap-2 text-white font-bold text-xs uppercase tracking-wider">
                      <Eye className="w-4 h-4 text-indigo-400" />
                      <span>Live Landing Page Card Preview</span>
                    </div>

                    {/* Preview Toggle */}
                    <div className="inline-flex items-center gap-1 p-0.5 rounded-lg bg-slate-900 border border-slate-700">
                      <button
                        type="button"
                        onClick={() => setPricingPreviewMode("monthly")}
                        className={`px-2.5 py-1 rounded-md text-[10px] font-bold transition-all cursor-pointer ${
                          pricingPreviewMode === "monthly" ? "bg-slate-700 text-white" : "text-slate-400"
                        }`}
                      >
                        Monthly
                      </button>
                      <button
                        type="button"
                        onClick={() => setPricingPreviewMode("yearly")}
                        className={`px-2.5 py-1 rounded-md text-[10px] font-bold transition-all cursor-pointer ${
                          pricingPreviewMode === "yearly" ? "bg-emerald-600 text-white" : "text-slate-400"
                        }`}
                      >
                        Annual
                      </button>
                    </div>
                  </div>

                  {/* Rendered Preview Card */}
                  {pricing.tiers[activePricingTierIdx] && (() => {
                    const previewTier = pricing.tiers[activePricingTierIdx];
                    const isYearly = pricingPreviewMode === "yearly";
                    const displayPrice = isYearly ? previewTier.priceAnnual : previewTier.priceMonthly;
                    const displayPeriod = isYearly ? previewTier.periodTextAnnual : previewTier.periodTextMonthly;
                    const isPopular = Boolean(previewTier.isPopular);

                    return (
                      <div className="space-y-3">
                        <div className="text-center pb-1">
                          <span className="text-[11px] font-bold text-emerald-400 uppercase tracking-wider block">
                            {pricing.sectionBadge}
                          </span>
                          <h4 className="text-sm font-extrabold text-white mt-0.5">
                            {pricing.mainHeadline}
                          </h4>
                          {pricing.annualDiscountNote && isYearly && (
                            <span className="text-[10px] text-emerald-300 font-semibold block mt-1">
                              {pricing.annualDiscountNote}
                            </span>
                          )}
                        </div>

                        {/* White Mock Card */}
                        <div
                          className={`p-6 rounded-2xl bg-white text-slate-900 shadow-xl relative transition-all ${
                            isPopular
                              ? "border-2 border-[#059669] ring-4 ring-emerald-500/10"
                              : "border border-slate-200"
                          }`}
                        >
                          {isPopular && (
                            <span className="absolute -top-3 right-5 px-2.5 py-0.5 rounded-full text-[9px] font-extrabold uppercase tracking-wider bg-[#059669] text-white shadow-sm">
                              {previewTier.popularBadge || "Most Popular"}
                            </span>
                          )}

                          <div className="space-y-3">
                            <div>
                              <span className={`text-[10px] font-bold uppercase tracking-wider ${isPopular ? "text-emerald-600" : "text-slate-500"}`}>
                                {previewTier.badge}
                              </span>
                              <h3 className="text-base font-bold text-slate-900 mt-0.5">{previewTier.name}</h3>
                              <p className="text-[11px] text-slate-500 mt-0.5">{previewTier.description}</p>
                            </div>

                            <div className="pt-1">
                              <span className="text-3xl font-extrabold text-slate-900 font-mono">
                                {displayPrice.startsWith("$") ? displayPrice : `$${displayPrice}`}
                              </span>
                              <span className="text-xs text-slate-500 ml-1.5">{displayPeriod}</span>
                            </div>

                            <ul className="space-y-2 text-xs pt-3 border-t border-slate-100 text-slate-600">
                              {previewTier.features.map((f, i) => (
                                <li key={i} className="flex items-center gap-2">
                                  <Check className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                                  <span>{f}</span>
                                </li>
                              ))}
                            </ul>
                          </div>

                          <div
                            className={`mt-6 w-full py-2.5 rounded-xl text-xs font-bold text-center transition-all ${
                              isPopular
                                ? "bg-[#059669] text-white shadow-sm"
                                : "bg-slate-900 text-white"
                            }`}
                          >
                            <span>{previewTier.ctaText}</span>
                          </div>
                        </div>

                        {/* Save & Reset Actions Bar */}
                        <div className="pt-3 border-t border-slate-700/80 flex items-center justify-between gap-2">
                          <button
                            type="button"
                            onClick={() => setIsResetPricingConfirmOpen(true)}
                            className="px-3 py-1.5 rounded-xl text-xs text-slate-400 hover:text-white bg-slate-800 hover:bg-slate-700 transition-colors cursor-pointer flex items-center gap-1.5"
                          >
                            <RotateCcw className="w-3.5 h-3.5" />
                            <span>Reset Defaults</span>
                          </button>

                          <button
                            type="button"
                            onClick={handleSavePricing}
                            disabled={isSavingPricing}
                            className="px-4 py-2 rounded-xl text-xs font-bold bg-emerald-600 hover:bg-emerald-500 text-white shadow-md transition-all cursor-pointer flex items-center gap-1.5 disabled:opacity-50"
                          >
                            <Save className="w-3.5 h-3.5" />
                            <span>{isSavingPricing ? "Publishing..." : "Save & Publish"}</span>
                          </button>
                        </div>
                      </div>
                    );
                  })()}
                </div>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* -------------------------------------------------------------------- */}
      {/* MODAL 1: Add User Account                                            */}
      {/* -------------------------------------------------------------------- */}
      {isAddUserOpen && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="w-full max-w-md bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-2xl">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <Users className="w-5 h-5 text-emerald-400" />
                <h3 className="text-base font-bold text-white">Add New User Account</h3>
              </div>
              <button
                type="button"
                onClick={() => setIsAddUserOpen(false)}
                className="text-slate-400 hover:text-white"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleAddUser} className="space-y-3.5 text-xs">
              <div>
                <label className="text-slate-300 font-bold block mb-1">User ID / Username *</label>
                <input
                  id="input-new-username"
                  type="text"
                  value={newUsername}
                  onChange={(e) => setNewUsername(e.target.value.toLowerCase().replace(/[^a-z0-9_-]/g, ""))}
                  placeholder="e.g. caller_alex"
                  className="w-full px-3 py-2 bg-slate-950 border border-slate-700 rounded-xl text-white font-mono outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500"
                  required
                />
              </div>

              <div>
                <label className="text-slate-300 font-bold block mb-1">Full / Display Name</label>
                <input
                  type="text"
                  value={newDisplayName}
                  onChange={(e) => setNewDisplayName(e.target.value)}
                  placeholder="e.g. Alex Rivera"
                  className="w-full px-3 py-2 bg-slate-950 border border-slate-700 rounded-xl text-white outline-none focus:border-emerald-500"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-slate-300 font-bold block mb-1">Role Permission Tier</label>
                  <select
                    value={newRole}
                    onChange={(e) => setNewRole(e.target.value as "manager" | "staff" | "customer")}
                    className="w-full px-3 py-2 bg-slate-950 border border-slate-700 rounded-xl text-white outline-none"
                  >
                    <option value="staff">Staff Specialist</option>
                    <option value="manager">Manager (Admin)</option>
                    <option value="customer">Customer / Client (View-Only)</option>
                  </select>
                </div>

                <div>
                  <label className="text-slate-300 font-bold block mb-1">Initial Password *</label>
                  <input
                    type="text"
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    placeholder="Staff@123"
                    className="w-full px-3 py-2 bg-slate-950 border border-slate-700 rounded-xl text-white font-mono outline-none focus:border-emerald-500"
                    required
                  />
                </div>
              </div>

              <div>
                <label className="text-slate-300 font-bold block mb-1">Contact / Recovery Email</label>
                <input
                  type="email"
                  value={newEmail}
                  onChange={(e) => setNewEmail(e.target.value)}
                  placeholder="alex.rivera@leadplatform.io"
                  className="w-full px-3 py-2 bg-slate-950 border border-slate-700 rounded-xl text-white outline-none focus:border-emerald-500"
                />
              </div>

              <div className="pt-3 border-t border-slate-800 flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setIsAddUserOpen(false)}
                  className="px-3.5 py-2 rounded-xl text-slate-400 hover:text-white cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  id="btn-submit-new-user"
                  type="submit"
                  disabled={userActionLoading}
                  className="px-4 py-2 rounded-xl font-bold bg-emerald-600 hover:bg-emerald-500 text-white shadow-md cursor-pointer disabled:opacity-50"
                >
                  {userActionLoading ? "Creating..." : "Save User Account"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* -------------------------------------------------------------------- */}
      {/* MODAL 1b: Edit User Credentials (Change User ID & Password)          */}
      {/* -------------------------------------------------------------------- */}
      {editingUser && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="w-full max-w-md bg-slate-900 border border-amber-500/40 rounded-2xl p-6 shadow-2xl text-xs">
            <div className="flex items-center justify-between pb-3 border-b border-slate-800 mb-4">
              <div className="flex items-center gap-2.5">
                <div className="p-2 rounded-xl bg-amber-500/10 text-amber-400 border border-amber-500/30">
                  <KeyRound className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-white">Update Account Credentials</h3>
                  <span className="text-[11px] text-slate-400">
                    Account: @{editingUser.username} ({editingUser.displayName || editingUser.role})
                  </span>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setEditingUser(null)}
                className="text-slate-400 hover:text-white cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleSaveEditUserCreds} className="space-y-4">
              <div>
                <label className="text-slate-300 font-bold block mb-1">User ID / Username *</label>
                <input
                  type="text"
                  value={editUserNewUsername}
                  onChange={(e) => setEditUserNewUsername(e.target.value)}
                  placeholder="e.g. staff_name"
                  className="w-full px-3 py-2 bg-slate-950 border border-slate-700 rounded-xl text-white font-mono outline-none focus:border-amber-500"
                  required
                />
              </div>

              <div>
                <label className="text-slate-300 font-bold block mb-1">
                  New Password <span className="font-normal text-slate-400">(leave blank to keep unchanged)</span>
                </label>
                <div className="relative">
                  <input
                    type={showEditUserPassword ? "text" : "password"}
                    value={editUserNewPassword}
                    onChange={(e) => setEditUserNewPassword(e.target.value)}
                    placeholder="Enter new password (min 4 characters)"
                    className="w-full px-3 py-2 bg-slate-950 border border-slate-700 rounded-xl text-white font-mono outline-none focus:border-amber-500 pr-10"
                  />
                  <button
                    type="button"
                    onClick={() => setShowEditUserPassword(!showEditUserPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-white cursor-pointer"
                  >
                    {showEditUserPassword ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                  </button>
                </div>
              </div>

              <div className="p-3 rounded-xl bg-slate-950 border border-slate-800 text-[11px] text-slate-400 flex items-start gap-2">
                <AlertCircle className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
                <span>
                  Updating this user's credentials applies immediately. If this account is featured in Available Demo Accounts, the badge will reflect the new credentials automatically.
                </span>
              </div>

              <div className="pt-3 border-t border-slate-800 flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setEditingUser(null)}
                  className="px-3.5 py-2 rounded-xl text-slate-400 hover:text-white cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSavingUserCreds}
                  className="px-4 py-2 rounded-xl font-bold bg-amber-600 hover:bg-amber-500 text-white shadow-md cursor-pointer disabled:opacity-50 flex items-center gap-1.5"
                >
                  <Save className="w-3.5 h-3.5" />
                  <span>{isSavingUserCreds ? "Saving..." : "Save Credentials"}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* -------------------------------------------------------------------- */}
      {/* MODAL 2: Delete User Account Confirmation                            */}
      {/* -------------------------------------------------------------------- */}
      {deleteUserConfirm && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="w-full max-w-sm bg-slate-900 border border-red-900/60 rounded-2xl p-6 shadow-2xl text-xs">
            <div className="flex items-center gap-2.5 text-red-400 mb-3 font-bold text-sm">
              <Trash2 className="w-5 h-5" />
              <span>Delete User Account?</span>
            </div>
            <p className="text-slate-300 leading-relaxed mb-4">
              Are you sure you want to permanently delete user account{" "}
              <strong className="text-white font-mono">@{deleteUserConfirm.username}</strong> (
              {deleteUserConfirm.displayName || "User"})? This user will no longer be able to log in.
            </p>
            <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-800">
              <button
                type="button"
                onClick={() => setDeleteUserConfirm(null)}
                className="px-3 py-1.5 rounded-lg text-slate-400 hover:text-white"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => handleDeleteUser(deleteUserConfirm)}
                className="px-3.5 py-1.5 rounded-lg bg-red-600 hover:bg-red-500 text-white font-bold cursor-pointer"
              >
                Yes, Delete Account
              </button>
            </div>
          </div>
        </div>
      )}

      {/* -------------------------------------------------------------------- */}
      {/* MODAL 3: Delete Single Historical Master Lead                        */}
      {/* -------------------------------------------------------------------- */}
      {deleteLeadConfirm && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="w-full max-w-sm bg-slate-900 border border-red-900/60 rounded-2xl p-6 shadow-2xl text-xs">
            <div className="flex items-center gap-2.5 text-red-400 mb-3 font-bold text-sm">
              <Trash2 className="w-5 h-5" />
              <span>Delete Historical Record?</span>
            </div>
            <p className="text-slate-300 leading-relaxed mb-4">
              Are you sure you want to remove client{" "}
              <strong className="text-white font-bold">"{deleteLeadConfirm.fullName}"</strong> ({deleteLeadConfirm.phoneNumber}) from the Historical Client Register?
            </p>
            <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-800">
              <button
                type="button"
                onClick={() => setDeleteLeadConfirm(null)}
                className="px-3 py-1.5 rounded-lg text-slate-400 hover:text-white"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => handleDeleteMasterLead(deleteLeadConfirm)}
                className="px-3.5 py-1.5 rounded-lg bg-red-600 hover:bg-red-500 text-white font-bold cursor-pointer"
              >
                Yes, Delete Record
              </button>
            </div>
          </div>
        </div>
      )}

      {/* -------------------------------------------------------------------- */}
      {/* MODAL 4: Bulk Purge Historical Client Register (Master Directory)    */}
      {/* -------------------------------------------------------------------- */}
      {isPurgeRegisterOpen && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="w-full max-w-md bg-slate-900 border border-red-900/80 rounded-2xl p-6 shadow-2xl text-xs">
            <div className="flex items-center gap-3 text-red-400 mb-3">
              <div className="p-2.5 rounded-xl bg-red-500/20 text-red-400">
                <AlertTriangle className="w-6 h-6" />
              </div>
              <div>
                <h3 className="text-base font-bold text-white">Purge Entire Historical Client Register</h3>
                <span className="text-[11px] text-red-300">Irreversible Master Directory Deletion</span>
              </div>
            </div>

            <p className="text-slate-300 leading-relaxed mb-4">
              This action will permanently delete all <strong className="text-white font-mono">{masterLeads.length}</strong> client records currently in the Historical Client Register across the local database, server store, and Cloud Firestore.
            </p>

            <div className="mb-4">
              <label className="text-slate-400 block mb-1 font-semibold">
                Type <strong className="text-red-400">PURGE</strong> to confirm execution:
              </label>
              <input
                type="text"
                value={purgeInputText}
                onChange={(e) => setPurgeInputText(e.target.value)}
                placeholder="PURGE"
                className="w-full px-3 py-2 bg-slate-950 border border-red-800 rounded-xl text-white font-mono outline-none focus:ring-1 focus:ring-red-500"
              />
            </div>

            <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-800">
              <button
                type="button"
                onClick={() => {
                  setIsPurgeRegisterOpen(false);
                  setPurgeInputText("");
                }}
                className="px-3.5 py-2 rounded-xl text-slate-400 hover:text-white"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={purgeInputText.trim().toUpperCase() !== "PURGE"}
                onClick={handlePurgeHistoricalRegister}
                className="px-4 py-2 rounded-xl bg-red-600 hover:bg-red-500 text-white font-bold cursor-pointer disabled:opacity-30 disabled:cursor-not-allowed shadow-md"
              >
                Confirm & Purge All Records
              </button>
            </div>
          </div>
        </div>
      )}

      {/* -------------------------------------------------------------------- */}
      {/* MODAL 5: Provision Organization                                      */}
      {/* -------------------------------------------------------------------- */}
      {isProvisionOpen && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="w-full max-w-md bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-2xl space-y-4 text-xs">
            <h3 className="text-base font-bold text-white">Provision New Tenant Organization</h3>
            <p className="text-xs text-slate-400">
              Creates a dedicated tenant domain with PostgreSQL Row-Level Security isolation.
            </p>

            <form onSubmit={handleProvisionTenant} className="space-y-3">
              <div>
                <label className="text-slate-400 font-semibold block mb-1">Company / Organization Name</label>
                <input
                  type="text"
                  value={newOrgName}
                  onChange={(e) => {
                    setNewOrgName(e.target.value);
                    if (!newOrgSlug) {
                      setNewOrgSlug(e.target.value.toLowerCase().replace(/[^a-z0-9]/g, ""));
                    }
                  }}
                  placeholder="e.g. Pacific Coast Solar"
                  className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-white outline-none focus:ring-2 focus:ring-emerald-500"
                  required
                />
              </div>

              <div>
                <label className="text-slate-400 font-semibold block mb-1">Subdomain Slug</label>
                <div className="flex items-center">
                  <input
                    type="text"
                    value={newOrgSlug}
                    onChange={(e) => setNewOrgSlug(e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, ""))}
                    placeholder="pacificsolar"
                    className="flex-1 px-3 py-2 bg-slate-800 border border-slate-700 rounded-l-lg text-white font-mono outline-none focus:ring-2 focus:ring-emerald-500"
                    required
                  />
                  <span className="px-3 py-2 bg-slate-950 border border-l-0 border-slate-700 rounded-r-lg text-slate-400 font-mono text-[11px]">
                    .leadplatform.io
                  </span>
                </div>
              </div>

              <div>
                <label className="text-slate-400 font-semibold block mb-1">Administrator Email</label>
                <input
                  type="email"
                  value={newOrgEmail}
                  onChange={(e) => setNewOrgEmail(e.target.value)}
                  placeholder="director@pacificsolar.com"
                  className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-white outline-none focus:ring-2 focus:ring-emerald-500"
                  required
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-slate-400 font-semibold block mb-1">Subscription Tier</label>
                  <select
                    value={newOrgTier}
                    onChange={(e) => setNewOrgTier(e.target.value as SubscriptionTier)}
                    className="w-full px-2.5 py-2 bg-slate-800 border border-slate-700 rounded-lg text-white outline-none"
                  >
                    <option value="trial">Free Trial</option>
                    <option value="standard">Standard ($149/mo)</option>
                    <option value="enterprise">Enterprise ($499/mo)</option>
                  </select>
                </div>

                <div>
                  <label className="text-slate-400 font-semibold block mb-1">Trial Validity (Days)</label>
                  <input
                    type="number"
                    min="7"
                    max="365"
                    value={newOrgTrialDays}
                    onChange={(e) => setNewOrgTrialDays(Number(e.target.value))}
                    className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-white font-mono outline-none"
                  />
                </div>
              </div>

              <div className="pt-3 border-t border-slate-800 flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setIsProvisionOpen(false)}
                  className="px-3.5 py-2 rounded-xl text-slate-400 hover:text-white"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={provisionLoading}
                  className="px-4 py-2 rounded-xl font-bold bg-emerald-600 hover:bg-emerald-500 text-white shadow-md cursor-pointer disabled:opacity-50"
                >
                  {provisionLoading ? "Provisioning..." : "Create Tenant"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* -------------------------------------------------------------------- */}
      {/* MODAL 6: Reset Pricing Configuration Confirmation                     */}
      {/* -------------------------------------------------------------------- */}
      {isResetPricingConfirmOpen && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="w-full max-w-sm bg-slate-900 border border-slate-700 rounded-2xl p-6 shadow-2xl text-xs">
            <div className="flex items-center gap-2.5 text-amber-400 mb-3 font-bold text-sm">
              <RotateCcw className="w-5 h-5" />
              <span>Reset Pricing to Defaults?</span>
            </div>
            <p className="text-slate-300 leading-relaxed mb-4">
              This will restore all default pricing plans, headlines, and feature checklists ($0 Trial, $149 Standard, $499 Enterprise) and publish them to the live SaaS landing page.
            </p>
            <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-800">
              <button
                type="button"
                onClick={() => setIsResetPricingConfirmOpen(false)}
                className="px-3 py-1.5 rounded-lg text-slate-400 hover:text-white cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleResetPricing}
                className="px-3.5 py-1.5 rounded-lg bg-amber-600 hover:bg-amber-500 text-white font-bold cursor-pointer"
              >
                Yes, Reset Pricing
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Interactive Stripe Checkout Modal */}
      <StripeCheckoutModal
        isOpen={isStripeModalOpen}
        onClose={() => setIsStripeModalOpen(false)}
        tenant={selectedTenantForStripe}
        onRenewalSuccess={(updatedTenant) => {
          setTenants((prev) => prev.map((t) => (t.id === updatedTenant.id ? updatedTenant : t)));
          showToast(`Organization "${updatedTenant.name}" reactivated successfully via Stripe!`);
          loadAllData();
        }}
      />
    </div>
  );
};
