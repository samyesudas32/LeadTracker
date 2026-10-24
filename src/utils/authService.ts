import { AdminCredentials, RBACConfig, PermissionDefinition, UserAccount, AppRole } from "../types";
import { apiClient } from "../services/apiClient";
import { DEFAULT_RBAC_CONFIG, DEFAULT_CUSTOMER_USER } from "../data/rbacDefaults";

export const DEFAULT_ADMIN_CREDENTIALS: AdminCredentials = {
  userId: "admin",
  password: "Sam@1997",
  recoveryEmail: "gatewaylawpartners@gmail.com",
  lastUpdated: new Date().toISOString(),
};

const CREDENTIALS_STORAGE_KEY = "lead_tracker_admin_credentials_v1";
const SESSION_AUTH_KEY = "lead_tracker_settings_auth_session_v1";
const APP_AUTH_KEY = "lead_tracker_app_auth_session_v1";
const ACTIVE_USER_STORAGE_KEY = "lead_tracker_active_user_v1";
const RBAC_STORAGE_KEY = "lead_tracker_rbac_config_v1";

export { DEFAULT_CUSTOMER_USER };

export const DEFAULT_MANAGER_USER: UserAccount = {
  id: "user-admin",
  username: "admin",
  displayName: "Administrator",
  role: "manager",
  email: "gatewaylawpartners@gmail.com",
  status: "active",
  createdAt: "2026-09-30T17:30:00.000Z",
};

export const DEFAULT_STAFF_USER: UserAccount = {
  id: "user-staff",
  username: "staff",
  displayName: "Staff Specialist",
  role: "staff",
  email: "staff@company.com",
  status: "active",
  createdAt: "2026-09-30T17:30:00.000Z",
};

/**
 * Check if the user has an active authenticated session for the application.
 */
export function isAppAuthenticated(): boolean {
  try {
    return (
      sessionStorage.getItem(APP_AUTH_KEY) === "true" ||
      localStorage.getItem(APP_AUTH_KEY) === "true"
    );
  } catch {
    return false;
  }
}

/**
 * Get currently authenticated user account.
 */
export function getCurrentAuthUser(): UserAccount {
  try {
    const raw = sessionStorage.getItem(ACTIVE_USER_STORAGE_KEY) || localStorage.getItem(ACTIVE_USER_STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (parsed && parsed.role) {
        return parsed;
      }
    }
  } catch {
    // fallback
  }
  return DEFAULT_MANAGER_USER;
}

/**
 * Set the currently authenticated user.
 */
export function setCurrentAuthUser(user: UserAccount | null): void {
  try {
    if (user) {
      sessionStorage.setItem(ACTIVE_USER_STORAGE_KEY, JSON.stringify(user));
      localStorage.setItem(ACTIVE_USER_STORAGE_KEY, JSON.stringify(user));
    } else {
      sessionStorage.removeItem(ACTIVE_USER_STORAGE_KEY);
      localStorage.removeItem(ACTIVE_USER_STORAGE_KEY);
    }
  } catch {
    // storage fallback
  }
}

/**
 * Retrieve current user role ("manager" | "staff" | "customer" | "super_admin").
 */
export function getUserRole(): AppRole {
  return getCurrentAuthUser().role;
}

/**
 * Check if current user is Manager.
 */
export function isManager(): boolean {
  return getUserRole() === "manager";
}

/**
 * Check if current user is Staff.
 */
export function isStaff(): boolean {
  return getUserRole() === "staff";
}

/**
 * Check if current user is Customer / Client (View-Only).
 */
export function isCustomer(): boolean {
  return getUserRole() === "customer";
}

/**
 * Set application authentication session state.
 */
export function setAppAuthenticated(
  authenticated: boolean,
  rememberMe: boolean = true,
  user?: UserAccount
): void {
  try {
    if (authenticated) {
      sessionStorage.setItem(APP_AUTH_KEY, "true");
      sessionStorage.setItem(SESSION_AUTH_KEY, "true");
      if (rememberMe) {
        localStorage.setItem(APP_AUTH_KEY, "true");
      }
      if (user) {
        setCurrentAuthUser(user);
      }
    } else {
      sessionStorage.removeItem(APP_AUTH_KEY);
      sessionStorage.removeItem(SESSION_AUTH_KEY);
      localStorage.removeItem(APP_AUTH_KEY);
      setCurrentAuthUser(null);
    }
  } catch {
    // ignore storage exceptions
  }
}

/**
 * Switch active role (for simulation / testing or role elevation).
 */
export function switchActiveRole(newRole: AppRole): UserAccount {
  const current = getCurrentAuthUser();
  const updated: UserAccount = {
    ...current,
    role: newRole,
    displayName: newRole === "manager" ? "Administrator (Manager Mode)" : `${current.displayName || "Staff Member"} (Staff Mode)`,
  };
  setCurrentAuthUser(updated);
  return updated;
}

// ==========================================
// RBAC Configuration & Dynamic Permissions
// ==========================================

/**
 * Get active RBAC configuration from localStorage or defaults.
 */
export function getRbacConfig(): RBACConfig {
  try {
    const raw = localStorage.getItem(RBAC_STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (parsed && parsed.rolePermissions) {
        return {
          ...DEFAULT_RBAC_CONFIG,
          ...parsed,
          rolePermissions: {
            ...DEFAULT_RBAC_CONFIG.rolePermissions,
            ...(parsed.rolePermissions || {}),
          },
        };
      }
    }
  } catch {
    // fallback
  }
  return DEFAULT_RBAC_CONFIG;
}

/**
 * Save RBAC configuration locally.
 */
export function saveRbacConfigLocally(config: RBACConfig): void {
  try {
    localStorage.setItem(
      RBAC_STORAGE_KEY,
      JSON.stringify({
        ...config,
        lastUpdated: new Date().toISOString(),
      })
    );
  } catch (err) {
    console.error("Failed to save RBAC config locally:", err);
  }
}

/**
 * Synchronize RBAC configuration from server.
 */
export async function syncRbacConfigFromServer(): Promise<RBACConfig> {
  try {
    const res = await apiClient.getRbac();
    if (res && res.success && res.rbac) {
      saveRbacConfigLocally(res.rbac);
      return res.rbac;
    }
  } catch (err) {
    console.warn("Notice: Server RBAC sync fallback to local:", err);
  }
  return getRbacConfig();
}

/**
 * Core dynamic permission check:
 * Returns whether the active user has permission to perform an action.
 * - Manager role has full access to ALL features (always true).
 * - Staff role checks dynamically configured permissions.
 */
export function hasPermission(permissionId: string, customUser?: UserAccount): boolean {
  const user = customUser || getCurrentAuthUser();

  // 1. Manager and Super Admin roles have full, unrestricted access to ALL features
  if (user.role === "manager" || user.role === "super_admin") {
    return true;
  }

  // 2. Customer role: view-only permissions
  if (user.role === "customer") {
    const rbac = getRbacConfig();
    const customerPermissions = rbac.rolePermissions?.customer;
    if (customerPermissions && Object.prototype.hasOwnProperty.call(customerPermissions, permissionId)) {
      return Boolean(customerPermissions[permissionId]);
    }
    return (
      permissionId === "leads:view" ||
      permissionId === "analytics:view" ||
      permissionId === "reports:pdf" ||
      permissionId === "export:excel"
    );
  }

  // 3. Staff role: Check dynamic permission matrix
  const rbac = getRbacConfig();
  const staffPermissions = rbac.rolePermissions?.staff;

  if (staffPermissions && Object.prototype.hasOwnProperty.call(staffPermissions, permissionId)) {
    return Boolean(staffPermissions[permissionId]);
  }

  // If a permission is not explicitly defined in staff permissions, default to false (safe closed world)
  return false;
}

/**
 * Alias for readable action checks.
 */
export function canPerform(actionId: string): boolean {
  return hasPermission(actionId);
}

/**
 * Dynamically toggle or update a permission for a role (e.g. staff).
 */
export async function updateRolePermission(
  role: AppRole,
  permissionId: string,
  allowed: boolean
): Promise<boolean> {
  const current = getRbacConfig();
  const updatedStaff = {
    ...(current.rolePermissions[role] || {}),
    [permissionId]: allowed,
  };

  const updatedConfig: RBACConfig = {
    ...current,
    rolePermissions: {
      ...current.rolePermissions,
      [role]: updatedStaff,
    },
    lastUpdated: new Date().toISOString(),
  };

  saveRbacConfigLocally(updatedConfig);

  try {
    await apiClient.updateRolePermissions(role, { [permissionId]: allowed });
    return true;
  } catch (err) {
    console.warn("Notice: Server updateRolePermissions fallback to local:", err);
    return true;
  }
}

/**
 * Dynamically register a new permission definition in the system.
 */
export async function addDynamicPermission(
  definition: PermissionDefinition,
  defaultStaff: boolean = false
): Promise<boolean> {
  const current = getRbacConfig();
  const cleanId = definition.id.trim().toLowerCase().replace(/[^a-z0-9_:-]/g, "_");

  const existingIdx = current.permissions.findIndex((p) => p.id === cleanId);
  const updatedPerms = existingIdx >= 0
    ? current.permissions.map((p) => (p.id === cleanId ? { ...definition, id: cleanId, isCustom: true } : p))
    : [...current.permissions, { ...definition, id: cleanId, isCustom: true }];

  const updatedConfig: RBACConfig = {
    ...current,
    permissions: updatedPerms,
    rolePermissions: {
      ...current.rolePermissions,
      manager: {
        ...(current.rolePermissions.manager || {}),
        [cleanId]: true,
      },
      staff: {
        ...(current.rolePermissions.staff || {}),
        [cleanId]: defaultStaff,
      },
    },
    lastUpdated: new Date().toISOString(),
  };

  saveRbacConfigLocally(updatedConfig);

  try {
    await apiClient.addRbacPermission({ ...definition, id: cleanId, defaultStaff });
    return true;
  } catch (err) {
    console.warn("Notice: Server addRbacPermission fallback to local:", err);
    return true;
  }
}

// ==========================================
// Admin & User Credentials Handling
// ==========================================

export function getAdminCredentials(): AdminCredentials {
  try {
    const raw = localStorage.getItem(CREDENTIALS_STORAGE_KEY);
    if (!raw) {
      localStorage.setItem(CREDENTIALS_STORAGE_KEY, JSON.stringify(DEFAULT_ADMIN_CREDENTIALS));
      return DEFAULT_ADMIN_CREDENTIALS;
    }
    const parsed = JSON.parse(raw);
    if (!parsed.userId || !parsed.password) {
      localStorage.setItem(CREDENTIALS_STORAGE_KEY, JSON.stringify(DEFAULT_ADMIN_CREDENTIALS));
      return DEFAULT_ADMIN_CREDENTIALS;
    }
    return {
      userId: parsed.userId || DEFAULT_ADMIN_CREDENTIALS.userId,
      password: parsed.password || DEFAULT_ADMIN_CREDENTIALS.password,
      recoveryEmail: parsed.recoveryEmail || DEFAULT_ADMIN_CREDENTIALS.recoveryEmail,
      lastUpdated: parsed.lastUpdated || DEFAULT_ADMIN_CREDENTIALS.lastUpdated,
    };
  } catch {
    return DEFAULT_ADMIN_CREDENTIALS;
  }
}

export function saveAdminCredentialsLocally(creds: AdminCredentials): void {
  try {
    localStorage.setItem(
      CREDENTIALS_STORAGE_KEY,
      JSON.stringify({
        ...creds,
        lastUpdated: creds.lastUpdated || new Date().toISOString(),
      })
    );
  } catch (err) {
    console.error("Failed to save admin credentials locally:", err);
  }
}

export async function syncAdminCredentialsFromServer(): Promise<AdminCredentials> {
  try {
    const info = await apiClient.getCredentialsInfo();
    if (info && info.userId) {
      const current = getAdminCredentials();
      const updated: AdminCredentials = {
        userId: info.userId,
        password: current.password,
        recoveryEmail: info.recoveryEmail || current.recoveryEmail,
        lastUpdated: info.lastUpdated || current.lastUpdated,
      };
      saveAdminCredentialsLocally(updated);
      return updated;
    }
  } catch (err) {
    console.warn("Notice: Server credentials info sync:", err);
  }
  return getAdminCredentials();
}

export async function saveAdminCredentials(creds: AdminCredentials): Promise<boolean> {
  try {
    saveAdminCredentialsLocally(creds);
    const res = await apiClient.resetAdminCredentials({
      userId: creds.userId,
      password: creds.password,
      recoveryEmail: creds.recoveryEmail,
    });
    return Boolean(res && res.success);
  } catch (err) {
    console.error("Failed to save admin credentials to server:", err);
    return false;
  }
}

/**
 * Self-service credential update for the currently authenticated account (Staff or Manager).
 * Keeps the active session alive with the updated credentials.
 */
export async function updateSelfCredentials(payload: {
  currentPassword?: string;
  newUserId: string;
  newPassword?: string;
  displayName?: string;
  recoveryEmail?: string;
  otpCode?: string;
}): Promise<{ success: boolean; message?: string; error?: string; user?: UserAccount }> {
  try {
    const current = getCurrentAuthUser();
    const res = await apiClient.updateAccountCredentials({
      targetUserId: current.id || current.username,
      currentPassword: payload.currentPassword,
      newUserId: payload.newUserId,
      newPassword: payload.newPassword,
      displayName: payload.displayName,
      recoveryEmail: payload.recoveryEmail,
      otpCode: payload.otpCode,
      isManagerReset: false,
    });

    if (res.success && res.user) {
      const updatedUser: UserAccount = {
        ...current,
        id: res.user.id || current.id,
        username: res.user.username,
        displayName: res.user.displayName || current.displayName,
        role: res.user.role || current.role,
        email: res.user.email !== undefined ? res.user.email : current.email,
      };
      setCurrentAuthUser(updatedUser);

      if (updatedUser.role === "manager") {
        const adminCreds = getAdminCredentials();
        saveAdminCredentialsLocally({
          ...adminCreds,
          userId: res.user.username,
          password: payload.newPassword || adminCreds.password,
          recoveryEmail: payload.recoveryEmail || adminCreds.recoveryEmail,
          lastUpdated: new Date().toISOString(),
        });
      }

      return { success: true, message: res.message, user: updatedUser };
    }

    return { success: false, error: res.error || "Failed to update credentials." };
  } catch (err: any) {
    return { success: false, error: err?.message || "An unexpected error occurred while updating credentials." };
  }
}

/**
 * Administrative reset of a Staff member's credentials by a Manager.
 */
export async function adminResetStaffCredentials(payload: {
  staffUserId: string;
  newUserId: string;
  newPassword?: string;
  displayName?: string;
  email?: string;
}): Promise<{ success: boolean; message?: string; error?: string; user?: UserAccount }> {
  try {
    const res = await apiClient.updateAccountCredentials({
      targetUserId: payload.staffUserId,
      newUserId: payload.newUserId,
      newPassword: payload.newPassword,
      displayName: payload.displayName,
      recoveryEmail: payload.email,
      isManagerReset: true,
    });

    return res;
  } catch (err: any) {
    return { success: false, error: err?.message || "An unexpected error occurred while resetting staff credentials." };
  }
}

/**
 * Authenticate either Manager (admin) or Staff account.
 */
export async function authenticateAdmin(
  userIdInput: string,
  passwordInput: string
): Promise<{ success: boolean; error?: string; user?: UserAccount }> {
  const cleanInput = userIdInput.trim();

  try {
    const res = await apiClient.adminLogin(cleanInput, passwordInput);
    if (res.success && res.authenticated) {
      setSettingsSessionAuthenticated(true);
      const authenticatedUser: UserAccount = res.user
        ? {
            id: res.user.id,
            username: res.user.username,
            displayName: res.user.displayName,
            role: res.user.role,
            email: res.user.email,
            status: "active",
            createdAt: new Date().toISOString(),
          }
        : cleanInput.toLowerCase() === "staff"
        ? DEFAULT_STAFF_USER
        : DEFAULT_MANAGER_USER;

      setCurrentAuthUser(authenticatedUser);

      if (authenticatedUser.role === "manager") {
        const current = getAdminCredentials();
        saveAdminCredentialsLocally({
          ...current,
          userId: cleanInput,
          password: passwordInput,
          lastUpdated: new Date().toISOString(),
        });
      }

      return { success: true, user: authenticatedUser };
    }
    return { success: false, error: res.error || "Invalid User ID or Password." };
  } catch (e: any) {
    // Local fallback authentication
    const current = getAdminCredentials();
    const isAdminMatch =
      current.userId.trim().toLowerCase() === cleanInput.toLowerCase() &&
      current.password === passwordInput;

    if (isAdminMatch) {
      setSettingsSessionAuthenticated(true);
      setCurrentAuthUser(DEFAULT_MANAGER_USER);
      return { success: true, user: DEFAULT_MANAGER_USER };
    }

    // Check registered RBAC accounts (Staff, Customer, etc.)
    const rbac = getRbacConfig();
    const matchingUser = rbac.users.find(
      (u) =>
        u.status === "active" &&
        (u.username.toLowerCase() === cleanInput.toLowerCase() ||
          (u.email && u.email.toLowerCase() === cleanInput.toLowerCase()))
    );

    if (matchingUser) {
      const defaultPass = matchingUser.role === "customer" ? "Client@123" : "Staff@123";
      if (matchingUser.password === passwordInput || (!matchingUser.password && passwordInput === defaultPass)) {
        setSettingsSessionAuthenticated(true);
        setCurrentAuthUser(matchingUser);
        return { success: true, user: matchingUser };
      }
    }

    // Check default staff credentials
    const isStaffMatch =
      (cleanInput.toLowerCase() === "staff" || cleanInput.toLowerCase() === "helen") &&
      passwordInput === "Staff@123";

    if (isStaffMatch) {
      setSettingsSessionAuthenticated(true);
      const staffUser: UserAccount = {
        ...DEFAULT_STAFF_USER,
        username: cleanInput.toLowerCase(),
        displayName: cleanInput.toLowerCase() === "helen" ? "Helen Specialist" : "Staff Specialist",
      };
      setCurrentAuthUser(staffUser);
      return { success: true, user: staffUser };
    }

    // Check default customer credentials
    const isCustomerMatch =
      (cleanInput.toLowerCase() === "client" || cleanInput.toLowerCase() === "customer") &&
      passwordInput === "Client@123";

    if (isCustomerMatch) {
      setSettingsSessionAuthenticated(true);
      setCurrentAuthUser(DEFAULT_CUSTOMER_USER);
      return { success: true, user: DEFAULT_CUSTOMER_USER };
    }

    return {
      success: false,
      error: e?.message || "Invalid User ID or Password. Please try again.",
    };
  }
}

/**
 * Synchronous local helper to get demo accounts if offline or loading.
 */
export function getLocalDemoAccounts() {
  const adminCreds = getAdminCredentials();
  const rbac = getRbacConfig();
  const staff = rbac.users.find((u) => u.role === "staff" && u.status === "active") || DEFAULT_STAFF_USER;
  const customer = rbac.users.find((u) => u.role === "customer" && u.status === "active") || DEFAULT_CUSTOMER_USER;
  return {
    manager: {
      username: adminCreds.userId || "admin",
      password: adminCreds.password || "Sam@1997",
      displayName: "Manager (Full Access)",
    },
    staff: {
      username: staff.username,
      password: staff.password || "Staff@123",
      displayName: staff.displayName || "Staff Specialist",
    },
    customer: {
      username: customer.username,
      password: customer.password || "Client@123",
      displayName: customer.displayName || "Customer / Client (View-Only)",
    },
    superAdmin: {
      username: "superadmin",
      password: "SuperAdmin@2026",
      displayName: "Super Administrator",
    },
  };
}

export function isSettingsSessionAuthenticated(): boolean {
  try {
    return sessionStorage.getItem(SESSION_AUTH_KEY) === "true";
  } catch {
    return false;
  }
}

export function setSettingsSessionAuthenticated(authenticated: boolean): void {
  try {
    if (authenticated) {
      sessionStorage.setItem(SESSION_AUTH_KEY, "true");
    } else {
      sessionStorage.removeItem(SESSION_AUTH_KEY);
    }
  } catch {
    // ignore sessionStorage errors
  }
}

export function generateRecoveryOTP(): string {
  const min = 100000;
  const max = 999999;
  return Math.floor(Math.random() * (max - min + 1) + min).toString();
}

/**
 * Synchronous local credential verification.
 */
export function verifyAdminLogin(userIdInput: string, passwordInput: string): boolean {
  const cleanInput = userIdInput.trim();
  const current = getAdminCredentials();
  if (
    current.userId.trim().toLowerCase() === cleanInput.toLowerCase() &&
    current.password === passwordInput
  ) {
    return true;
  }
  const rbac = getRbacConfig();
  const foundUser = rbac.users.find(
    (u) =>
      u.status === "active" &&
      (u.username.toLowerCase() === cleanInput.toLowerCase() ||
        (u.email && u.email.toLowerCase() === cleanInput.toLowerCase()))
  );
  if (foundUser && foundUser.password === passwordInput) {
    return true;
  }
  return false;
}
