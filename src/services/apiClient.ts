import { Lead, AppSettings, AdminCredentials, UploadedFileRecord, RBACConfig, PermissionDefinition, UserAccount, PricingSettings } from "../types";

const BASE_URL = "";

export interface HealthResponse {
  status: string;
  hasApiKey: boolean;
  timestamp: string;
  leadsCount?: number;
  filesCount?: number;
  version?: string;
}

export interface ExtractLeadsResponse {
  success: boolean;
  count: number;
  leads: any[];
  fallbackUsed?: boolean;
  modelUsed?: string;
  message?: string;
  error?: string;
}

export interface AuthLoginResponse {
  success: boolean;
  authenticated?: boolean;
  user?: {
    id: string;
    username: string;
    displayName: string;
    role: "manager" | "staff" | "customer" | "super_admin";
    email?: string;
  };
  error?: string;
}

export interface RequestOtpResponse {
  success: boolean;
  message?: string;
  code?: string;
  expiresAt?: number;
  maskedEmail?: string;
  error?: string;
}

export interface VerifyOtpResponse {
  success: boolean;
  verified?: boolean;
  currentUserId?: string;
  error?: string;
}

class ApiClient {
  private async request<T>(
    endpoint: string,
    options: RequestInit = {}
  ): Promise<T> {
    const url = `${BASE_URL}${endpoint}`;
    const headers = {
      "Content-Type": "application/json",
      ...(options.headers || {}),
    };

    const response = await fetch(url, {
      ...options,
      headers,
    });

    const data = await response.json().catch(() => ({}));

    if (!response.ok) {
      const errorMsg =
        data?.error || data?.message || `Request failed with status ${response.status}`;
      const err = new Error(errorMsg) as any;
      err.status = response.status;
      err.data = data;
      throw err;
    }

    return data as T;
  }

  // 1. Health Check
  async checkHealth(): Promise<HealthResponse> {
    return this.request<HealthResponse>("/api/health");
  }

  // 2. Leads Endpoints
  async getLeads(): Promise<Lead[]> {
    const data = await this.request<{ success: boolean; leads: Lead[]; count: number }>("/api/leads");
    return data.leads || [];
  }

  async syncLeads(leads: Lead[], clientId?: string): Promise<{ success: boolean; count: number; version?: number }> {
    return this.request<{ success: boolean; count: number; version?: number }>("/api/leads/bulk-sync", {
      method: "POST",
      body: JSON.stringify({ leads, clientId }),
    });
  }

  async addLeads(leads: Lead[], mode: "append" | "replace" = "append"): Promise<Lead[]> {
    const data = await this.request<{ success: boolean; leads: Lead[] }>("/api/leads", {
      method: "POST",
      body: JSON.stringify({ leads, mode }),
    });
    return data.leads || [];
  }

  async updateLead(id: string, updates: Partial<Lead>, clientId?: string): Promise<Lead> {
    const data = await this.request<{ success: boolean; lead: Lead }>(`/api/leads/${encodeURIComponent(id)}`, {
      method: "PUT",
      headers: clientId ? { "X-Client-Id": clientId } : undefined,
      body: JSON.stringify({ ...updates, clientId }),
    });
    return data.lead;
  }

  async deleteLead(id: string, clientId?: string): Promise<boolean> {
    const data = await this.request<{ success: boolean }>(`/api/leads/${encodeURIComponent(id)}`, {
      method: "DELETE",
      headers: clientId ? { "X-Client-Id": clientId } : undefined,
    });
    return data.success;
  }

  async bulkDeleteLeads(ids: string[], clientId?: string): Promise<boolean> {
    const data = await this.request<{ success: boolean }>("/api/leads/bulk-delete", {
      method: "POST",
      body: JSON.stringify({ ids, clientId }),
    });
    return data.success;
  }

  async resetLeads(): Promise<Lead[]> {
    const data = await this.request<{ success: boolean; leads: Lead[] }>("/api/leads/reset", {
      method: "POST",
    });
    return data.leads || [];
  }

  async clearAllLeads(clientId?: string): Promise<boolean> {
    const data = await this.request<{ success: boolean }>("/api/leads", {
      method: "DELETE",
      headers: clientId ? { "X-Client-Id": clientId } : undefined,
    });
    return data.success;
  }

  // 2b. Files Endpoints
  async getFiles(): Promise<UploadedFileRecord[]> {
    const data = await this.request<{ success: boolean; files: UploadedFileRecord[]; count: number }>("/api/files");
    return data.files || [];
  }

  async syncFiles(files: UploadedFileRecord[], clientId?: string): Promise<{ success: boolean; count: number; version?: number }> {
    return this.request<{ success: boolean; count: number; version?: number }>("/api/files/bulk-sync", {
      method: "POST",
      body: JSON.stringify({ files, clientId }),
    });
  }

  async addFile(file: UploadedFileRecord): Promise<UploadedFileRecord[]> {
    const data = await this.request<{ success: boolean; files: UploadedFileRecord[] }>("/api/files", {
      method: "POST",
      body: JSON.stringify({ file }),
    });
    return data.files || [];
  }

  async deleteFile(id: string, clientId?: string): Promise<boolean> {
    const data = await this.request<{ success: boolean }>(`/api/files/${encodeURIComponent(id)}`, {
      method: "DELETE",
      headers: clientId ? { "X-Client-Id": clientId } : undefined,
    });
    return data.success;
  }

  async clearAllFiles(clientId?: string): Promise<boolean> {
    const data = await this.request<{ success: boolean }>("/api/files", {
      method: "DELETE",
      headers: clientId ? { "X-Client-Id": clientId } : undefined,
    });
    return data.success;
  }

  async resetFiles(): Promise<UploadedFileRecord[]> {
    const data = await this.request<{ success: boolean; files: UploadedFileRecord[] }>("/api/files/reset", {
      method: "POST",
    });
    return data.files || [];
  }

  // 3. Settings Endpoints
  async getSettings(): Promise<AppSettings> {
    const data = await this.request<{ success: boolean; settings: AppSettings }>("/api/settings");
    return data.settings;
  }

  async saveSettings(settings: AppSettings): Promise<AppSettings> {
    const data = await this.request<{ success: boolean; settings: AppSettings }>("/api/settings", {
      method: "PUT",
      body: JSON.stringify(settings),
    });
    return data.settings;
  }

  async resetSettings(): Promise<AppSettings> {
    const data = await this.request<{ success: boolean; settings: AppSettings }>("/api/settings/reset", {
      method: "POST",
    });
    return data.settings;
  }

  // 3b. Shortcuts Endpoints
  async getShortcuts(): Promise<Record<string, string>> {
    const data = await this.request<{ success: boolean; shortcuts: Record<string, string> }>("/api/shortcuts");
    return data.shortcuts || {};
  }

  async saveShortcuts(shortcuts: Record<string, string>): Promise<Record<string, string>> {
    const data = await this.request<{ success: boolean; shortcuts: Record<string, string> }>("/api/shortcuts", {
      method: "PUT",
      body: JSON.stringify({ shortcuts }),
    });
    return data.shortcuts || {};
  }

  // 3c. Live Stream Subscription (Server-Sent Events)
  subscribeToLiveStream(
    onMessage: (event: { type: string; version: number; timestamp: number; [key: string]: any }) => void,
    onError?: (err: any) => void
  ): () => void {
    if (typeof window === "undefined" || !("EventSource" in window)) {
      return () => {};
    }

    let eventSource: EventSource | null = null;
    let isClosed = false;

    const connect = () => {
      if (isClosed) return;
      try {
        eventSource = new EventSource("/api/live-stream");

        eventSource.onmessage = (e) => {
          try {
            const data = JSON.parse(e.data);
            onMessage(data);
          } catch (err) {
            console.warn("Could not parse SSE message:", err);
          }
        };

        eventSource.onerror = (err) => {
          onError?.(err);
          eventSource?.close();
          // Auto reconnect after brief pause
          if (!isClosed) {
            setTimeout(connect, 3000);
          }
        };
      } catch (e) {
        onError?.(e);
        if (!isClosed) {
          setTimeout(connect, 4000);
        }
      }
    };

    connect();

    return () => {
      isClosed = true;
      eventSource?.close();
    };
  }

  // 4. Extraction Endpoint
  async extractLeads(content: string, fileName?: string): Promise<ExtractLeadsResponse> {
    return this.request<ExtractLeadsResponse>("/api/extract-leads", {
      method: "POST",
      body: JSON.stringify({ content, fileName }),
    });
  }

  // 5. Auth & OTP Endpoints
  async adminLogin(userId: string, password: string): Promise<AuthLoginResponse> {
    return this.request<AuthLoginResponse>("/api/auth/login", {
      method: "POST",
      body: JSON.stringify({ userId, password }),
    });
  }

  async superAdminLogin(userId: string, password: string): Promise<AuthLoginResponse> {
    return this.request<AuthLoginResponse>("/api/auth/super-admin/login", {
      method: "POST",
      body: JSON.stringify({ userId, password }),
    });
  }

  async requestRecoveryOtp(email: string): Promise<RequestOtpResponse> {
    return this.request<RequestOtpResponse>("/api/auth/forgot-request", {
      method: "POST",
      body: JSON.stringify({ email }),
    });
  }

  async verifyRecoveryOtp(otp: string): Promise<VerifyOtpResponse> {
    return this.request<VerifyOtpResponse>("/api/auth/verify-otp", {
      method: "POST",
      body: JSON.stringify({ otp }),
    });
  }

  async resetAdminCredentials(credentials: {
    userId: string;
    password: string;
    recoveryEmail: string;
  }): Promise<{ success: boolean; message?: string }> {
    return this.request<{ success: boolean; message?: string }>("/api/auth/reset-credentials", {
      method: "POST",
      body: JSON.stringify(credentials),
    });
  }

  async updateAccountCredentials(payload: {
    targetUserId?: string;
    currentPassword?: string;
    newUserId: string;
    newPassword?: string;
    displayName?: string;
    recoveryEmail?: string;
    isManagerReset?: boolean;
    otpCode?: string;
  }): Promise<{
    success: boolean;
    message?: string;
    error?: string;
    user?: any;
  }> {
    return this.request<{
      success: boolean;
      message?: string;
      error?: string;
      user?: any;
    }>("/api/auth/update-account-credentials", {
      method: "POST",
      body: JSON.stringify(payload),
    });
  }

  async getCredentialsInfo(): Promise<{
    success: boolean;
    userId?: string;
    recoveryEmail: string;
    hasCustomCreds: boolean;
    lastUpdated?: string;
  }> {
    return this.request<{
      success: boolean;
      userId?: string;
      recoveryEmail: string;
      hasCustomCreds: boolean;
      lastUpdated?: string;
    }>("/api/auth/credentials-info");
  }

  async getPublicDemoAccounts(): Promise<{
    success: boolean;
    accounts: {
      manager: { username: string; password: string; displayName: string };
      staff: { username: string; password: string; displayName: string };
      customer: { username: string; password: string; displayName: string };
      superAdmin: { username: string; password: string; displayName: string };
    };
  }> {
    return this.request("/api/auth/demo-accounts");
  }

  async updateSuperAdminCredentials(payload: {
    currentPassword?: string;
    newUserId: string;
    newPassword?: string;
    email?: string;
  }): Promise<{ success: boolean; message?: string; error?: string; superAdmin?: any }> {
    return this.request("/api/auth/super-admin/update-credentials", {
      method: "POST",
      body: JSON.stringify(payload),
    });
  }

  // 6. Role-Based Access Control (RBAC) Endpoints
  async getRbac(): Promise<{ success: boolean; version?: number; rbac: RBACConfig }> {
    return this.request<{ success: boolean; version?: number; rbac: RBACConfig }>("/api/rbac");
  }

  async updateRbac(rbac: Partial<RBACConfig>): Promise<{ success: boolean; rbac: RBACConfig }> {
    return this.request<{ success: boolean; rbac: RBACConfig }>("/api/rbac", {
      method: "PUT",
      body: JSON.stringify({ rbac }),
    });
  }

  async addRbacPermission(permission: Partial<PermissionDefinition> & { defaultStaff?: boolean }): Promise<{ success: boolean; rbac: RBACConfig }> {
    return this.request<{ success: boolean; rbac: RBACConfig }>("/api/rbac/permissions", {
      method: "POST",
      body: JSON.stringify({ permission }),
    });
  }

  async updateRolePermissions(role: string, permissions: Record<string, boolean>): Promise<{ success: boolean; rbac: RBACConfig }> {
    return this.request<{ success: boolean; rbac: RBACConfig }>(`/api/rbac/roles/${role}/permissions`, {
      method: "PATCH",
      body: JSON.stringify({ permissions }),
    });
  }

  async saveRbacUser(user: Partial<UserAccount>): Promise<{ success: boolean; rbac: RBACConfig }> {
    return this.request<{ success: boolean; rbac: RBACConfig }>("/api/rbac/users", {
      method: "POST",
      body: JSON.stringify({ user }),
    });
  }

  async deleteRbacUser(userId: string): Promise<{ success: boolean; rbac: RBACConfig }> {
    return this.request<{ success: boolean; rbac: RBACConfig }>(`/api/rbac/users/${userId}`, {
      method: "DELETE",
    });
  }

  // 7. Multi-Tenant SaaS & Super Admin Endpoints
  async getTenants(): Promise<{
    success: boolean;
    tenants: any[];
    summary: { total: number; active: number; paused: number; disabled: number; viewOnly: number };
  }> {
    return this.request("/api/admin/tenants");
  }

  async createTenant(data: {
    name: string;
    slug: string;
    planTier: string;
    contactEmail: string;
    contactName?: string;
    trialDays?: number;
  }): Promise<{ success: boolean; tenant: any }> {
    return this.request("/api/admin/tenants", {
      method: "POST",
      body: JSON.stringify(data),
    });
  }

  async updateTenantStatus(
    id: string,
    status: string,
    reason?: string
  ): Promise<{ success: boolean; tenant: any }> {
    return this.request(`/api/admin/tenants/${encodeURIComponent(id)}/status`, {
      method: "PATCH",
      body: JSON.stringify({ status, reason }),
    });
  }

  async extendTenantTrial(
    id: string,
    days: number = 60
  ): Promise<{ success: boolean; tenant: any; message: string }> {
    return this.request(`/api/admin/tenants/${encodeURIComponent(id)}/extend-trial`, {
      method: "POST",
      body: JSON.stringify({ days }),
    });
  }

  // 8. Database Backups Endpoints
  async getBackups(): Promise<{ success: boolean; backups: any[] }> {
    return this.request("/api/admin/backups");
  }

  async createBackup(): Promise<{ success: boolean; backup: any }> {
    return this.request("/api/admin/backups/create", {
      method: "POST",
    });
  }

  async restoreBackup(id: string): Promise<{ success: boolean; message: string }> {
    return this.request(`/api/admin/backups/${encodeURIComponent(id)}/restore`, {
      method: "POST",
    });
  }

  // 9. Global Audit Logs
  async getAuditLogs(): Promise<{ success: boolean; auditLogs: any[] }> {
    return this.request("/api/admin/audit-logs");
  }

  // 10. Stripe Billing & Subscription Auto-Renewal
  async createCheckoutSession(data: {
    tenantId: string;
    planTier?: string;
    billingInterval?: "month" | "year";
  }): Promise<{ success: boolean; session: any }> {
    return this.request("/api/billing/create-checkout-session", {
      method: "POST",
      body: JSON.stringify(data),
    });
  }

  async confirmStripeRenewal(data: {
    tenantId: string;
    planTier?: string;
    billingInterval?: "month" | "year";
    last4?: string;
  }): Promise<{ success: boolean; tenant: any; message: string }> {
    return this.request("/api/billing/confirm-renewal", {
      method: "POST",
      body: JSON.stringify(data),
    });
  }

  // 11. Security 2FA OTP
  async sendSecurityOtp(data: {
    email?: string;
    purpose?: string;
    targetUserId?: string;
  }): Promise<{ success: boolean; message: string; code: string; expiresAt: number }> {
    return this.request("/api/auth/otp/send", {
      method: "POST",
      body: JSON.stringify(data),
    });
  }

  // 12. Pricing & Plans Settings Endpoints
  async getPricingSettings(): Promise<{ success: boolean; pricing: PricingSettings }> {
    return this.request("/api/settings/pricing");
  }

  async savePricingSettings(pricing: Partial<PricingSettings>): Promise<{ success: boolean; pricing: PricingSettings }> {
    return this.request("/api/settings/pricing", {
      method: "POST",
      body: JSON.stringify(pricing),
    });
  }

  async resetPricingSettings(): Promise<{ success: boolean; pricing: PricingSettings }> {
    return this.request("/api/settings/pricing/reset", {
      method: "POST",
    });
  }
}

export const apiClient = new ApiClient();

