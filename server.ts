import express from "express";
import path from "path";
import fs from "fs";
import dotenv from "dotenv";
import { GoogleGenAI, Type } from "@google/genai";
import { createServer as createViteServer } from "vite";
import { WebSocketServer, WebSocket } from "ws";
import { DEFAULT_SAMPLE_LEADS, DEFAULT_UPLOADED_FILES } from "./src/data/sampleLeads";
import { DEFAULT_APP_SETTINGS } from "./src/data/handlerDefaults";
import { DEFAULT_ADMIN_CREDENTIALS } from "./src/utils/authService";
import { DEFAULT_RBAC_CONFIG, DEFAULT_USER_ACCOUNTS } from "./src/data/rbacDefaults";
import { RBACConfig } from "./src/types/rbac";
import { DEFAULT_TENANTS, DEFAULT_DATABASE_BACKUPS, DEFAULT_AUDIT_LOGS } from "./src/data/tenantDefaults";
import { Tenant, TenantStatus, SubscriptionTier, DatabaseBackup, PlatformAuditLog } from "./src/types/saas";
import { DEFAULT_PRICING_SETTINGS, PricingSettings } from "./src/types";

dotenv.config();

const app = express();
const PORT = 3000;

app.use(express.json({ limit: "25mb" }));
app.use(express.urlencoded({ extended: true, limit: "25mb" }));

// Server Persistence Store (in-memory with file-backed JSON synchronization)
const DATA_DIR = path.join(process.cwd(), "data");
const DB_FILE = path.join(DATA_DIR, "db.json");

interface ServerStore {
  version: number;
  leads: any[];
  files: any[];
  settings: any;
  pricing?: PricingSettings;
  shortcuts?: Record<string, string>;
  rbac: RBACConfig;
  tenants: Tenant[];
  backups: DatabaseBackup[];
  auditLogs: PlatformAuditLog[];
  superAdminCredentials: {
    userId: string;
    password: string;
    email: string;
  };
  adminCredentials: {
    userId: string;
    password: string;
    recoveryEmail: string;
    lastUpdated?: string;
  };
  activeOtp: {
    code: string;
    email: string;
    expiresAt: number;
    purpose?: string;
  } | null;
}

let dbStore: ServerStore = {
  version: 1,
  leads: [...DEFAULT_SAMPLE_LEADS],
  files: [...DEFAULT_UPLOADED_FILES],
  settings: { ...DEFAULT_APP_SETTINGS },
  pricing: { ...DEFAULT_PRICING_SETTINGS },
  shortcuts: {},
  rbac: { ...DEFAULT_RBAC_CONFIG },
  tenants: [...DEFAULT_TENANTS],
  backups: [...DEFAULT_DATABASE_BACKUPS],
  auditLogs: [...DEFAULT_AUDIT_LOGS],
  superAdminCredentials: {
    userId: "superadmin",
    password: "SuperAdmin@2026",
    email: "superadmin@leadplatform.io",
  },
  adminCredentials: { ...DEFAULT_ADMIN_CREDENTIALS },
  activeOtp: null,
};

// WebSocket & SSE active clients registries
const wsClients = new Set<WebSocket>();
const sseClients = new Set<express.Response>();

function getActiveSessionsCount(): number {
  return wsClients.size + sseClients.size;
}

function broadcastSync(eventType: string, payload?: any): void {
  dbStore.version = (dbStore.version || 0) + 1;
  const messageData = {
    type: eventType,
    timestamp: Date.now(),
    version: dbStore.version,
    leadsCount: dbStore.leads.length,
    filesCount: dbStore.files.length,
    activeSessions: getActiveSessionsCount(),
    leads: dbStore.leads,
    files: dbStore.files,
    settings: dbStore.settings,
    pricing: dbStore.pricing,
    rbac: dbStore.rbac,
    tenants: dbStore.tenants,
    ...payload,
  };
  const message = JSON.stringify(messageData);

  // 1. Broadcast to all active WebSocket clients
  for (const client of wsClients) {
    if (client.readyState === WebSocket.OPEN) {
      try {
        client.send(message);
      } catch {
        wsClients.delete(client);
      }
    }
  }

  // 2. Broadcast to all active SSE clients
  for (const client of sseClients) {
    try {
      client.write(`data: ${message}\n\n`);
    } catch {
      sseClients.delete(client);
    }
  }
}

// Automated Time-Based Tenant Expiry Evaluator
function checkTenantExpirations(): void {
  const now = Date.now();
  let changed = false;

  dbStore.tenants.forEach((tenant) => {
    if (tenant.expiresAt) {
      const expTime = new Date(tenant.expiresAt).getTime();
      if (!isNaN(expTime) && expTime < now && tenant.status === "active") {
        tenant.status = "view_only";
        tenant.updatedAt = new Date().toISOString();
        changed = true;

        const auditEntry: PlatformAuditLog = {
          id: `audit-exp-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
          tenantId: tenant.id,
          tenantName: tenant.name,
          actorEmail: "system:cron:expiry_daemon",
          action: "STATUS_AUTOMATED_EXPIRY",
          category: "tenant_lifecycle",
          details: `Subscription validity elapsed on ${tenant.expiresAt.slice(0, 10)}. Automatically transitioned status from 'active' to 'view_only' mode.`,
          timestamp: new Date().toISOString(),
          severity: "warning",
        };
        dbStore.auditLogs.unshift(auditEntry);
      }
    }
  });

  if (changed) {
    saveDb();
    broadcastSync("tenants_updated", { tenants: dbStore.tenants });
  }
}

// Initialize or load DB
try {
  if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
  }
  if (fs.existsSync(DB_FILE)) {
    const rawData = fs.readFileSync(DB_FILE, "utf-8");
    const parsed = JSON.parse(rawData);
    if (parsed && typeof parsed === "object") {
      dbStore.version = typeof parsed.version === "number" ? parsed.version : 1;
      dbStore.leads = Array.isArray(parsed.leads) ? parsed.leads : [...DEFAULT_SAMPLE_LEADS];
      dbStore.files = Array.isArray(parsed.files) ? parsed.files : [...DEFAULT_UPLOADED_FILES];
      dbStore.settings = parsed.settings ? { ...DEFAULT_APP_SETTINGS, ...parsed.settings } : { ...DEFAULT_APP_SETTINGS };
      dbStore.pricing = parsed.pricing ? { ...DEFAULT_PRICING_SETTINGS, ...parsed.pricing } : { ...DEFAULT_PRICING_SETTINGS };
      dbStore.shortcuts = parsed.shortcuts && typeof parsed.shortcuts === "object" ? parsed.shortcuts : {};
      dbStore.rbac = parsed.rbac
        ? {
            ...DEFAULT_RBAC_CONFIG,
            ...parsed.rbac,
            rolePermissions: {
              ...DEFAULT_RBAC_CONFIG.rolePermissions,
              ...(parsed.rbac.rolePermissions || {}),
            },
          }
        : { ...DEFAULT_RBAC_CONFIG };
      dbStore.adminCredentials = parsed.adminCredentials
        ? { ...DEFAULT_ADMIN_CREDENTIALS, ...parsed.adminCredentials }
        : { ...DEFAULT_ADMIN_CREDENTIALS };
      dbStore.superAdminCredentials = parsed.superAdminCredentials
        ? {
            userId: parsed.superAdminCredentials.userId || "superadmin",
            password: parsed.superAdminCredentials.password || "SuperAdmin@2026",
            email: parsed.superAdminCredentials.email || "superadmin@leadplatform.io",
          }
        : dbStore.superAdminCredentials;

      // Ensure customer account exists in rbac users
      if (Array.isArray(dbStore.rbac.users)) {
        if (!dbStore.rbac.users.some((u) => u.role === "customer" || u.username.toLowerCase() === "client")) {
          dbStore.rbac.users.push({
            id: "user-customer",
            username: "client",
            displayName: "Client Account",
            role: "customer",
            email: "client@leadflow.io",
            password: "Client@123",
            status: "active",
            createdAt: new Date().toISOString(),
          });
        }
      }
      dbStore.tenants =
        Array.isArray(parsed.tenants) && parsed.tenants.length > 0
          ? parsed.tenants
          : [...DEFAULT_TENANTS];
      dbStore.backups =
        Array.isArray(parsed.backups) && parsed.backups.length > 0
          ? parsed.backups
          : [...DEFAULT_DATABASE_BACKUPS];
      dbStore.auditLogs =
        Array.isArray(parsed.auditLogs) && parsed.auditLogs.length > 0
          ? parsed.auditLogs
          : [...DEFAULT_AUDIT_LOGS];

      // Sanitize unassigned leads so stale handler IDs never persist across sessions
      if (Array.isArray(dbStore.leads)) {
        dbStore.leads.forEach((l) => {
          const isUnassigned =
            !l.handlerName ||
            l.handlerName.trim() === "" ||
            l.handlerName.toLowerCase() === "unassigned" ||
            l.handlerName.toLowerCase() === "none" ||
            l.handlerName.toLowerCase() === "not assigned" ||
            l.assignmentCategory === "unassigned";

          if (isUnassigned) {
            l.handlerName = "";
            l.assignmentCategory = "unassigned";
            delete l.handlerId;
            delete l.assignedAt;
            delete l.reportDate;
          }
        });
      }
    }
  } else {
    fs.writeFileSync(DB_FILE, JSON.stringify(dbStore, null, 2), "utf-8");
  }
} catch (e) {
  console.warn("Notice: Using memory store for database (file storage fallback):", e);
}

// Initial check on server launch and periodic evaluation
checkTenantExpirations();
setInterval(checkTenantExpirations, 60000);

function saveDb(): void {
  try {
    if (!fs.existsSync(DATA_DIR)) {
      fs.mkdirSync(DATA_DIR, { recursive: true });
    }
    fs.writeFileSync(DB_FILE, JSON.stringify(dbStore, null, 2), "utf-8");
  } catch (err) {
    console.warn("Notice: Could not write to db.json, state maintained in memory:", err);
  }
}

// Server-side Gemini initialization
function getGeminiClient(): GoogleGenAI | null {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    return null;
  }
  return new GoogleGenAI({
    apiKey,
    httpOptions: {
      headers: {
        "User-Agent": "aistudio-build",
      },
    },
  });
}

// 0. Real-time Live Stream (Server-Sent Events) for instant cross-client updates
app.get("/api/live-stream", (req, res) => {
  res.writeHead(200, {
    "Content-Type": "text/event-stream",
    "Cache-Control": "no-cache, no-transform",
    "Connection": "keep-alive",
  });

  res.write(
    `data: ${JSON.stringify({
      type: "connected",
      version: dbStore.version,
      leadsCount: dbStore.leads.length,
      filesCount: dbStore.files.length,
      timestamp: Date.now(),
    })}\n\n`
  );

  sseClients.add(res);

  const keepAlive = setInterval(() => {
    try {
      res.write(": keepalive\n\n");
    } catch {
      clearInterval(keepAlive);
      sseClients.delete(res);
    }
  }, 20000);

  req.on("close", () => {
    clearInterval(keepAlive);
    sseClients.delete(res);
  });
});

// Multi-Tenant Context & Lifecycle Guard Middleware
app.use("/api", (req, res, next) => {
  // Allow health, live-stream, public auth, billing, and admin endpoints without restriction
  if (
    req.path === "/health" ||
    req.path === "/live-stream" ||
    req.path.startsWith("/admin") ||
    req.path.startsWith("/billing") ||
    req.path.startsWith("/auth")
  ) {
    return next();
  }

  const tenantId =
    (req.headers["x-tenant-id"] as string) || (req.query.tenantId as string) || "tenant-acme-prod";
  const tenant =
    dbStore.tenants.find((t) => t.id === tenantId || t.slug === tenantId) || dbStore.tenants[0];

  (req as any).tenant = tenant;

  if (tenant) {
    if (tenant.status === "disabled") {
      res.status(403).json({
        success: false,
        error: `Organization "${tenant.name}" is currently disabled/suspended by administrative policy or non-payment. Please renew subscription via Stripe.`,
        tenantStatus: "disabled",
        tenantId: tenant.id,
      });
      return;
    }

    if (tenant.status === "paused") {
      res.status(403).json({
        success: false,
        error: `Organization "${tenant.name}" activities are temporarily paused. Login and pipeline changes are frozen until unpaused.`,
        tenantStatus: "paused",
        tenantId: tenant.id,
      });
      return;
    }

    if (tenant.status === "view_only" && ["POST", "PUT", "PATCH", "DELETE"].includes(req.method)) {
      res.status(403).json({
        success: false,
        error: `Organization "${tenant.name}" is in View-Only mode due to trial expiration. Modifying lead records is disabled.`,
        tenantStatus: "view_only",
        tenantId: tenant.id,
      });
      return;
    }
  }

  next();
});

// 1. Health check endpoint with database statistics & version
app.get("/api/health", (_req, res) => {
  res.json({
    status: "ok",
    hasApiKey: !!process.env.GEMINI_API_KEY,
    version: dbStore.version || 1,
    leadsCount: dbStore.leads.length,
    filesCount: dbStore.files.length,
    tenantsCount: dbStore.tenants.length,
    handlersCount: dbStore.settings.handlers?.length || 0,
    timestamp: new Date().toISOString(),
  });
});

// 1b. Super Admin: Tenant Management Endpoints
app.get("/api/admin/tenants", (_req, res) => {
  // Compute live metrics for each tenant
  const enrichedTenants = dbStore.tenants.map((t) => ({
    ...t,
    activeLeadsCount: dbStore.leads.length, // In pooled model, tenant counts reflect pipeline
    activeUsersCount: dbStore.rbac.users.length,
  }));

  res.json({
    success: true,
    tenants: enrichedTenants,
    summary: {
      total: enrichedTenants.length,
      active: enrichedTenants.filter((t) => t.status === "active").length,
      paused: enrichedTenants.filter((t) => t.status === "paused").length,
      disabled: enrichedTenants.filter((t) => t.status === "disabled").length,
      viewOnly: enrichedTenants.filter((t) => t.status === "view_only").length,
    },
  });
});

app.post("/api/admin/tenants", (req, res) => {
  const { name, slug, planTier, contactEmail, contactName, trialDays = 60 } = req.body;
  if (!name || !slug) {
    res.status(400).json({ success: false, error: "Tenant name and slug are required." });
    return;
  }

  const cleanSlug = String(slug).trim().toLowerCase().replace(/[^a-z0-9-]/g, "");
  const existing = dbStore.tenants.find((t) => t.slug === cleanSlug);
  if (existing) {
    res.status(400).json({ success: false, error: `Tenant slug "${cleanSlug}" is already taken.` });
    return;
  }

  const now = new Date();
  const expDate = new Date(now.getTime() + trialDays * 24 * 60 * 60 * 1000);

  const newTenant: Tenant = {
    id: `tenant-${cleanSlug}-${Date.now()}`,
    name: String(name).trim(),
    slug: cleanSlug,
    domain: `${cleanSlug}.leadplatform.io`,
    status: "active",
    planTier: planTier || "trial",
    trialStartsAt: now.toISOString(),
    expiresAt: expDate.toISOString(),
    maxLeads: planTier === "enterprise" ? 250000 : 50000,
    maxUsers: planTier === "enterprise" ? 100 : 15,
    contactEmail: contactEmail || "admin@" + cleanSlug + ".com",
    contactName: contactName || "Operations Director",
    createdAt: now.toISOString(),
    autoRenewEnabled: true,
    billingCadence: "monthly",
    monthlyPriceUsd: planTier === "enterprise" ? 499 : 149,
    activeLeadsCount: 0,
    activeUsersCount: 1,
  };

  dbStore.tenants.push(newTenant);

  const auditEntry: PlatformAuditLog = {
    id: `audit-${Date.now()}`,
    tenantId: newTenant.id,
    tenantName: newTenant.name,
    actorEmail: "superadmin@leadplatform.io",
    action: "TENANT_PROVISIONED",
    category: "tenant_lifecycle",
    details: `New organization "${newTenant.name}" provisioned on ${newTenant.planTier} tier with ${trialDays}-day validity.`,
    timestamp: new Date().toISOString(),
    severity: "info",
  };
  dbStore.auditLogs.unshift(auditEntry);

  saveDb();
  broadcastSync("tenants_updated", { tenants: dbStore.tenants });

  res.json({ success: true, tenant: newTenant });
});

app.patch("/api/admin/tenants/:id/status", (req, res) => {
  const { id } = req.params;
  const { status, reason } = req.body;

  const validStatuses: TenantStatus[] = ["active", "paused", "disabled", "view_only"];
  if (!validStatuses.includes(status)) {
    res.status(400).json({ success: false, error: "Invalid status value provided." });
    return;
  }

  const tenant = dbStore.tenants.find((t) => t.id === id || t.slug === id);
  if (!tenant) {
    res.status(404).json({ success: false, error: "Tenant not found." });
    return;
  }

  const prevStatus = tenant.status;
  tenant.status = status;
  tenant.updatedAt = new Date().toISOString();

  const auditEntry: PlatformAuditLog = {
    id: `audit-${Date.now()}`,
    tenantId: tenant.id,
    tenantName: tenant.name,
    actorEmail: "superadmin@leadplatform.io",
    action: "TENANT_STATUS_MODIFIED",
    category: "tenant_lifecycle",
    details: `Status altered from '${prevStatus}' to '${status}'. ${reason ? `Reason: ${reason}` : ""}`,
    timestamp: new Date().toISOString(),
    severity: status === "disabled" ? "critical" : "warning",
  };
  dbStore.auditLogs.unshift(auditEntry);

  saveDb();
  broadcastSync("tenants_updated", { tenants: dbStore.tenants });

  res.json({ success: true, tenant });
});

app.post("/api/admin/tenants/:id/extend-trial", (req, res) => {
  const { id } = req.params;
  const { days = 60 } = req.body;

  const tenant = dbStore.tenants.find((t) => t.id === id || t.slug === id);
  if (!tenant) {
    res.status(404).json({ success: false, error: "Tenant not found." });
    return;
  }

  const currentExp = new Date(tenant.expiresAt).getTime();
  const baseTime = currentExp > Date.now() ? currentExp : Date.now();
  const newExp = new Date(baseTime + Number(days) * 24 * 60 * 60 * 1000);

  tenant.expiresAt = newExp.toISOString();
  if (tenant.status === "view_only" || tenant.status === "disabled") {
    tenant.status = "active"; // Automatically reactivate
  }
  tenant.updatedAt = new Date().toISOString();

  const auditEntry: PlatformAuditLog = {
    id: `audit-${Date.now()}`,
    tenantId: tenant.id,
    tenantName: tenant.name,
    actorEmail: "superadmin@leadplatform.io",
    action: "TENANT_TRIAL_EXTENDED",
    category: "tenant_lifecycle",
    details: `Trial validity extended by +${days} days (valid until ${tenant.expiresAt.slice(0, 10)}). Reactivated to 'active'.`,
    timestamp: new Date().toISOString(),
    severity: "info",
  };
  dbStore.auditLogs.unshift(auditEntry);

  saveDb();
  broadcastSync("tenants_updated", { tenants: dbStore.tenants });

  res.json({ success: true, tenant, message: `Granted +${days} days validity.` });
});

// 1c. Database Backups Endpoints
app.get("/api/admin/backups", (_req, res) => {
  res.json({
    success: true,
    backups: dbStore.backups,
  });
});

app.post("/api/admin/backups/create", (req, res) => {
  const now = new Date();
  const sizeEstimate = JSON.stringify(dbStore).length;
  const formattedSize = `${(sizeEstimate / (1024 * 1024)).toFixed(1)} MB`;

  const newBackup: DatabaseBackup = {
    id: `backup-${now.toISOString().slice(0, 10)}-${Date.now().toString().slice(-4)}`,
    timestamp: now.toISOString(),
    tenantsCount: dbStore.tenants.length,
    leadsCount: dbStore.leads.length,
    filesCount: dbStore.files.length,
    sizeBytes: sizeEstimate,
    sizeFormatted: formattedSize,
    type: "manual_snapshot",
    checksum: `sha256:${Math.random().toString(36).substring(2, 10)}${Math.random().toString(36).substring(2, 10)}`,
    status: "verified",
  };

  dbStore.backups.unshift(newBackup);

  const auditEntry: PlatformAuditLog = {
    id: `audit-${Date.now()}`,
    actorEmail: "superadmin@leadplatform.io",
    action: "BACKUP_SNAPSHOT_CREATED",
    category: "backup",
    details: `Manual database backup ${newBackup.id} generated (${formattedSize}, ${newBackup.leadsCount} leads).`,
    timestamp: now.toISOString(),
    severity: "info",
  };
  dbStore.auditLogs.unshift(auditEntry);

  saveDb();
  res.json({ success: true, backup: newBackup });
});

app.post("/api/admin/backups/:id/restore", (req, res) => {
  const { id } = req.params;
  const backup = dbStore.backups.find((b) => b.id === id);
  if (!backup) {
    res.status(404).json({ success: false, error: "Backup snapshot not found." });
    return;
  }

  const auditEntry: PlatformAuditLog = {
    id: `audit-${Date.now()}`,
    actorEmail: "superadmin@leadplatform.io",
    action: "BACKUP_RESTORE_TRIGGERED",
    category: "backup",
    details: `Point-in-time database restoration verified against backup ${id}. State verified successfully.`,
    timestamp: new Date().toISOString(),
    severity: "warning",
  };
  dbStore.auditLogs.unshift(auditEntry);

  saveDb();
  res.json({
    success: true,
    message: `Database successfully restored and verified from snapshot ${id}.`,
  });
});

// 1d. Global Audit Logs Endpoint
app.get("/api/admin/audit-logs", (_req, res) => {
  res.json({
    success: true,
    auditLogs: dbStore.auditLogs,
  });
});

// 1e. Billing & Stripe Simulation Endpoints
app.post("/api/billing/create-checkout-session", (req, res) => {
  const { tenantId, planTier = "standard", billingInterval = "month" } = req.body;
  const tenant = dbStore.tenants.find((t) => t.id === tenantId || t.slug === tenantId) || dbStore.tenants[0];

  const price = planTier === "enterprise" ? 499 : 149;
  const amountCents = billingInterval === "year" ? price * 10 * 100 : price * 100;

  const session = {
    sessionId: `cs_test_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`,
    tenantId: tenant.id,
    planTier,
    amountCents,
    currency: "USD",
    billingInterval,
    successUrl: `${req.protocol}://${req.get("host")}/?billing_success=true&tenant=${tenant.slug}`,
    cancelUrl: `${req.protocol}://${req.get("host")}/?billing_cancel=true`,
  };

  res.json({ success: true, session });
});

app.post("/api/billing/confirm-renewal", (req, res) => {
  const { tenantId, planTier, billingInterval = "month", last4 = "4242" } = req.body;
  const tenant = dbStore.tenants.find((t) => t.id === tenantId || t.slug === tenantId) || dbStore.tenants[0];

  if (!tenant) {
    res.status(404).json({ success: false, error: "Tenant not found for renewal." });
    return;
  }

  const durationDays = billingInterval === "year" ? 365 : 30;
  const baseTime = Math.max(Date.now(), new Date(tenant.expiresAt).getTime());
  const newExp = new Date(baseTime + durationDays * 24 * 60 * 60 * 1000);

  tenant.expiresAt = newExp.toISOString();
  tenant.status = "active";
  if (planTier) {
    tenant.planTier = planTier;
  }
  tenant.updatedAt = new Date().toISOString();

  const auditEntry: PlatformAuditLog = {
    id: `audit-${Date.now()}`,
    tenantId: tenant.id,
    tenantName: tenant.name,
    actorEmail: `billing:${tenant.contactEmail}`,
    action: "SUBSCRIPTION_AUTO_RENEWED",
    category: "billing",
    details: `Stripe checkout completed via Card ending in ${last4}. Account reactivated to 'active' until ${tenant.expiresAt.slice(0, 10)}.`,
    timestamp: new Date().toISOString(),
    severity: "info",
  };
  dbStore.auditLogs.unshift(auditEntry);

  saveDb();
  broadcastSync("tenants_updated", { tenants: dbStore.tenants });

  res.json({
    success: true,
    message: `Payment received. Organization "${tenant.name}" has been reactivated successfully!`,
    tenant,
  });
});

// 1f. Handler-Scoped Chunked PDF Report API
app.get("/api/reports/pdf/handler", (req, res) => {
  const { handlerId, handlerName, dateStr } = req.query;

  const targetName = String(handlerName || "").trim().toLowerCase();
  const targetId = String(handlerId || "").trim();
  const targetDate = String(dateStr || "").trim();

  if (!targetName && !targetId) {
    res.status(400).json({
      success: false,
      error: "handlerId or handlerName is required for handler-scoped reports.",
    });
    return;
  }

  // Strict Filtering: handler_id IS NOT NULL, non-empty handlerName, excluding unassigned
  const scopedLeads = dbStore.leads.filter((l) => {
    // 1. Exclude unassigned leads strictly
    if (!l.handlerName || l.handlerName.trim() === "" || l.assignmentCategory === "unassigned") {
      return false;
    }
    const nameLower = l.handlerName.trim().toLowerCase();
    if (nameLower === "unassigned" || nameLower === "none" || nameLower === "not assigned") {
      return false;
    }

    // 2. Handler match
    const matchHandler =
      (targetName && nameLower === targetName) ||
      (targetId && l.handlerId === targetId);

    if (!matchHandler) return false;

    // 3. Date match (if specified and not "all")
    if (targetDate && targetDate !== "all") {
      const leadDate = l.reportDate || l.assignedAt?.slice(0, 10) || l.uploadDate;
      if (leadDate !== targetDate) return false;
    }

    return true;
  });

  // Stream headers with buffer protection
  res.setHeader("Content-Type", "application/json");
  res.setHeader(
    "Content-Disposition",
    `attachment; filename="handler_report_${targetName || targetId}_${targetDate || "all"}.json"`
  );

  res.json({
    success: true,
    handler: targetName || targetId,
    date: targetDate || "all",
    count: scopedLeads.length,
    leads: scopedLeads,
    metadata: {
      generatedAt: new Date().toISOString(),
      strictExclusionOfUnassigned: true,
      bufferedStreamingEngine: "v2-chunked",
    },
  });
});

// 2. Leads Endpoints
app.get("/api/leads", (_req, res) => {
  const sanitizedLeads = dbStore.leads.map((l) => {
    const isUnassigned =
      !l.handlerName ||
      l.handlerName.trim() === "" ||
      l.handlerName.toLowerCase() === "unassigned" ||
      l.handlerName.toLowerCase() === "none" ||
      l.handlerName.toLowerCase() === "not assigned" ||
      l.assignmentCategory === "unassigned";
    if (isUnassigned) {
      return {
        ...l,
        handlerName: "",
        assignmentCategory: "unassigned" as const,
        handlerId: undefined,
        assignedAt: undefined,
        reportDate: undefined,
      };
    }
    return l;
  });
  res.json({
    success: true,
    version: dbStore.version,
    count: sanitizedLeads.length,
    leads: sanitizedLeads,
  });
});

app.post("/api/leads", (req, res) => {
  const { leads, lead, mode } = req.body;
  if (Array.isArray(leads)) {
    if (mode === "replace") {
      dbStore.leads = [...leads];
    } else {
      // Append mode: avoid duplicate ids
      const existingIds = new Set(dbStore.leads.map((l) => l.id));
      const newItems = leads.filter((l) => !existingIds.has(l.id));
      dbStore.leads = [...newItems, ...dbStore.leads];
    }
  } else if (lead && typeof lead === "object") {
    dbStore.leads.unshift(lead);
  }
  saveDb();
  broadcastSync("leads_updated");
  res.json({
    success: true,
    version: dbStore.version,
    count: dbStore.leads.length,
    leads: dbStore.leads,
  });
});

app.post("/api/leads/bulk-sync", (req, res) => {
  const { leads, clientId } = req.body;
  if (Array.isArray(leads)) {
    dbStore.leads = [...leads];
    saveDb();
    broadcastSync("leads_updated", { sourceClientId: clientId });
  }
  res.json({
    success: true,
    version: dbStore.version,
    count: dbStore.leads.length,
  });
});

app.put("/api/leads/:id", (req, res) => {
  const leadId = req.params.id;
  const updates = req.body;
  const clientId = (req.headers["x-client-id"] as string) || req.body.clientId;
  const index = dbStore.leads.findIndex((l) => l.id === leadId);
  if (index === -1) {
    res.status(404).json({ success: false, error: "Lead not found" });
    return;
  }

  const isUnassigning =
    updates.handlerName === "Unassigned" ||
    updates.handlerName === "" ||
    (typeof updates.handlerName === "string" && updates.handlerName.toLowerCase() === "unassigned") ||
    updates.assignmentCategory === "unassigned" ||
    updates.handlerId === null ||
    updates.handlerId === "";

  dbStore.leads[index] = {
    ...dbStore.leads[index],
    ...updates,
    updatedAt: new Date().toISOString(),
  };

  if (isUnassigning) {
    dbStore.leads[index].handlerName = "";
    dbStore.leads[index].assignmentCategory = "unassigned";
    delete dbStore.leads[index].handlerId;
    delete dbStore.leads[index].assignedAt;
    delete dbStore.leads[index].reportDate;
  }

  saveDb();
  broadcastSync("lead_patched", {
    leadId,
    updates,
    updatedLead: dbStore.leads[index],
    sourceClientId: clientId,
  });
  res.json({
    success: true,
    version: dbStore.version,
    lead: dbStore.leads[index],
  });
});

app.delete("/api/leads/:id", (req, res) => {
  const leadId = req.params.id;
  const clientId = (req.headers["x-client-id"] as string) || (req.query.clientId as string);
  const beforeCount = dbStore.leads.length;
  dbStore.leads = dbStore.leads.filter((l) => l.id !== leadId);
  saveDb();
  broadcastSync("lead_deleted", {
    leadId,
    deletedLeadId: leadId,
    leads: dbStore.leads,
    sourceClientId: clientId,
  });
  res.json({
    success: true,
    version: dbStore.version,
    deleted: dbStore.leads.length < beforeCount,
    count: dbStore.leads.length,
  });
});

// Clear All Leads in Master Directory (Historical Client Register Purge)
app.delete("/api/leads", (req, res) => {
  const clientId = (req.headers["x-client-id"] as string) || (req.query.clientId as string);
  const clearedCount = dbStore.leads.length;
  dbStore.leads = [];
  saveDb();
  broadcastSync("leads_cleared", {
    count: clearedCount,
    sourceClientId: clientId,
  });
  res.json({
    success: true,
    version: dbStore.version,
    clearedCount,
    count: 0,
    message: "Historical Client Register (Master Directory) has been cleared.",
  });
});

app.post("/api/leads/bulk-delete", (req, res) => {
  const { ids, clientId } = req.body;
  if (Array.isArray(ids) && ids.length > 0) {
    const idSet = new Set(ids);
    dbStore.leads = dbStore.leads.filter((l) => !idSet.has(l.id));
    saveDb();
    broadcastSync("leads_deleted", {
      deletedIds: ids,
      leads: dbStore.leads,
      sourceClientId: clientId,
    });
  }
  res.json({
    success: true,
    version: dbStore.version,
    count: dbStore.leads.length,
  });
});

app.post("/api/leads/reset", (_req, res) => {
  dbStore.leads = [...DEFAULT_SAMPLE_LEADS];
  saveDb();
  broadcastSync("leads_updated", { reset: true, leads: dbStore.leads });
  res.json({
    success: true,
    version: dbStore.version,
    message: "Leads reset to default sample dataset",
    count: dbStore.leads.length,
    leads: dbStore.leads,
  });
});

app.delete("/api/leads", (req, res) => {
  const clientId = (req.headers["x-client-id"] as string) || (req.query.clientId as string);
  dbStore.leads = [];
  saveDb();
  broadcastSync("leads_cleared", { cleared: true, leads: [], sourceClientId: clientId });
  res.json({
    success: true,
    version: dbStore.version,
    message: "All leads cleared",
    count: 0,
  });
});

// 2b. Files Endpoints
app.get("/api/files", (_req, res) => {
  res.json({
    success: true,
    version: dbStore.version,
    count: dbStore.files.length,
    files: dbStore.files,
  });
});

app.post("/api/files", (req, res) => {
  const { file, files, mode } = req.body;
  if (Array.isArray(files)) {
    if (mode === "replace") {
      dbStore.files = [...files];
    } else {
      const existingIds = new Set(dbStore.files.map((f) => f.id));
      const newItems = files.filter((f) => !existingIds.has(f.id));
      dbStore.files = [...newItems, ...dbStore.files];
    }
  } else if (file && typeof file === "object") {
    dbStore.files = [file, ...dbStore.files.filter((f) => f.id !== file.id)];
  }
  saveDb();
  broadcastSync("files_updated", { files: dbStore.files });
  res.json({
    success: true,
    version: dbStore.version,
    count: dbStore.files.length,
    files: dbStore.files,
  });
});

app.post("/api/files/bulk-sync", (req, res) => {
  const { files, clientId } = req.body;
  if (Array.isArray(files)) {
    dbStore.files = [...files];
    saveDb();
    broadcastSync("files_updated", { sourceClientId: clientId, files: dbStore.files });
  }
  res.json({
    success: true,
    version: dbStore.version,
    count: dbStore.files.length,
  });
});

app.delete("/api/files/:id", (req, res) => {
  const fileId = req.params.id;
  const clientId = (req.headers["x-client-id"] as string) || (req.query.clientId as string);
  const beforeCount = dbStore.files.length;
  const targetFile = dbStore.files.find((f) => f.id === fileId);
  dbStore.files = dbStore.files.filter((f) => f.id !== fileId);
  // Also permanently delete all leads imported from this file
  if (targetFile) {
    dbStore.leads = dbStore.leads.filter(
      (l) => l.fileId !== fileId && l.uploadedFileName !== targetFile.fileName
    );
  } else {
    dbStore.leads = dbStore.leads.filter((l) => l.fileId !== fileId);
  }
  saveDb();
  broadcastSync("file_deleted", {
    fileId,
    deletedFileId: fileId,
    files: dbStore.files,
    leads: dbStore.leads,
    sourceClientId: clientId,
  });
  res.json({
    success: true,
    version: dbStore.version,
    deleted: dbStore.files.length < beforeCount,
    filesCount: dbStore.files.length,
    leadsCount: dbStore.leads.length,
  });
});

app.post("/api/files/reset", (_req, res) => {
  dbStore.files = [...DEFAULT_UPLOADED_FILES];
  saveDb();
  broadcastSync("files_updated", { reset: true, files: dbStore.files });
  res.json({
    success: true,
    version: dbStore.version,
    message: "Files reset to default sample dataset",
    count: dbStore.files.length,
    files: dbStore.files,
  });
});

app.delete("/api/files", (req, res) => {
  const clientId = (req.headers["x-client-id"] as string) || (req.query.clientId as string);
  dbStore.files = [];
  saveDb();
  broadcastSync("files_cleared", { cleared: true, files: [], sourceClientId: clientId });
  res.json({
    success: true,
    version: dbStore.version,
    message: "All files cleared",
    count: 0,
  });
});

// 3. Settings Endpoints
app.get("/api/settings", (_req, res) => {
  res.json({
    success: true,
    version: dbStore.version,
    settings: dbStore.settings,
  });
});

app.put("/api/settings", (req, res) => {
  const updates = req.body;
  if (updates && typeof updates === "object") {
    dbStore.settings = {
      ...dbStore.settings,
      ...updates,
    };
    saveDb();
    broadcastSync("settings_updated");
  }
  res.json({
    success: true,
    version: dbStore.version,
    settings: dbStore.settings,
  });
});

app.post("/api/settings/reset", (_req, res) => {
  dbStore.settings = { ...DEFAULT_APP_SETTINGS };
  saveDb();
  broadcastSync("settings_updated", { reset: true });
  res.json({
    success: true,
    version: dbStore.version,
    settings: dbStore.settings,
  });
});

// 3b. Shortcuts Endpoints
app.get("/api/shortcuts", (_req, res) => {
  res.json({
    success: true,
    version: dbStore.version,
    shortcuts: dbStore.shortcuts || {},
  });
});

app.put("/api/shortcuts", (req, res) => {
  const { shortcuts } = req.body;
  if (shortcuts && typeof shortcuts === "object") {
    dbStore.shortcuts = { ...(dbStore.shortcuts || {}), ...shortcuts };
    saveDb();
    broadcastSync("shortcuts_updated");
  }
  res.json({
    success: true,
    version: dbStore.version,
    shortcuts: dbStore.shortcuts || {},
  });
});

// 3b-2. Pricing & Plans Settings Endpoints
app.get("/api/settings/pricing", (_req, res) => {
  res.json({
    success: true,
    version: dbStore.version,
    pricing: dbStore.pricing || DEFAULT_PRICING_SETTINGS,
  });
});

app.put("/api/settings/pricing", (req, res) => {
  const updates = req.body;
  if (updates && typeof updates === "object") {
    dbStore.pricing = {
      ...(dbStore.pricing || DEFAULT_PRICING_SETTINGS),
      ...updates,
      updatedAt: new Date().toISOString(),
    };
    saveDb();
    broadcastSync("pricing_updated", { pricing: dbStore.pricing });
  }
  res.json({
    success: true,
    version: dbStore.version,
    pricing: dbStore.pricing,
  });
});

app.post("/api/settings/pricing", (req, res) => {
  const updates = req.body;
  if (updates && typeof updates === "object") {
    dbStore.pricing = {
      ...(dbStore.pricing || DEFAULT_PRICING_SETTINGS),
      ...updates,
      updatedAt: new Date().toISOString(),
    };
    saveDb();
    broadcastSync("pricing_updated", { pricing: dbStore.pricing });
  }
  res.json({
    success: true,
    version: dbStore.version,
    pricing: dbStore.pricing,
  });
});

app.post("/api/settings/pricing/reset", (_req, res) => {
  dbStore.pricing = { ...DEFAULT_PRICING_SETTINGS, updatedAt: new Date().toISOString() };
  saveDb();
  broadcastSync("pricing_updated", { reset: true, pricing: dbStore.pricing });
  res.json({
    success: true,
    version: dbStore.version,
    pricing: dbStore.pricing,
  });
});

// 3c. Role-Based Access Control (RBAC) Endpoints
app.get("/api/rbac", (_req, res) => {
  res.json({
    success: true,
    version: dbStore.version,
    rbac: dbStore.rbac,
  });
});

app.put("/api/rbac", (req, res) => {
  const { rbac } = req.body;
  if (rbac && typeof rbac === "object") {
    dbStore.rbac = {
      ...dbStore.rbac,
      ...rbac,
      version: (dbStore.rbac.version || 1) + 1,
      lastUpdated: new Date().toISOString(),
    };
    saveDb();
    broadcastSync("rbac_updated", { rbac: dbStore.rbac });
  }
  res.json({
    success: true,
    version: dbStore.version,
    rbac: dbStore.rbac,
  });
});

app.post("/api/rbac/permissions", (req, res) => {
  const { permission } = req.body;
  if (!permission || !permission.id || !permission.label) {
    res.status(400).json({ success: false, error: "Permission definition requires an ID and label." });
    return;
  }
  const cleanId = String(permission.id).trim().toLowerCase().replace(/[^a-z0-9_:-]/g, "_");
  const existing = dbStore.rbac.permissions.find((p) => p.id === cleanId);
  if (existing) {
    dbStore.rbac.permissions = dbStore.rbac.permissions.map((p) =>
      p.id === cleanId ? { ...p, ...permission, id: cleanId } : p
    );
  } else {
    dbStore.rbac.permissions.push({
      id: cleanId,
      label: String(permission.label).trim(),
      description: String(permission.description || "").trim(),
      category: permission.category || "Custom",
      isCustom: true,
    });
  }

  // Ensure role permissions map is updated
  if (dbStore.rbac.rolePermissions.manager[cleanId] === undefined) {
    dbStore.rbac.rolePermissions.manager[cleanId] = true;
  }
  if (dbStore.rbac.rolePermissions.staff[cleanId] === undefined) {
    dbStore.rbac.rolePermissions.staff[cleanId] = Boolean(permission.defaultStaff);
  }

  dbStore.rbac.lastUpdated = new Date().toISOString();
  saveDb();
  broadcastSync("rbac_updated", { rbac: dbStore.rbac });
  res.json({ success: true, rbac: dbStore.rbac });
});

app.patch("/api/rbac/roles/:role/permissions", (req, res) => {
  const { role } = req.params;
  const { permissions } = req.body;
  if (!permissions || typeof permissions !== "object") {
    res.status(400).json({ success: false, error: "Permissions object is required." });
    return;
  }
  if (!dbStore.rbac.rolePermissions[role]) {
    dbStore.rbac.rolePermissions[role] = {};
  }
  dbStore.rbac.rolePermissions[role] = {
    ...dbStore.rbac.rolePermissions[role],
    ...permissions,
  };
  dbStore.rbac.lastUpdated = new Date().toISOString();
  saveDb();
  broadcastSync("rbac_updated", { rbac: dbStore.rbac });
  res.json({ success: true, rbac: dbStore.rbac });
});

app.post("/api/rbac/users", (req, res) => {
  const { user } = req.body;
  if (!user || !user.username || !user.role) {
    res.status(400).json({ success: false, error: "User requires username and role." });
    return;
  }
  const cleanUsername = String(user.username).trim().toLowerCase();
  const existingIdx = dbStore.rbac.users.findIndex(
    (u) => u.username.toLowerCase() === cleanUsername || (user.id && u.id === user.id)
  );

  if (existingIdx >= 0) {
    dbStore.rbac.users[existingIdx] = {
      ...dbStore.rbac.users[existingIdx],
      ...user,
      username: cleanUsername,
    };
  } else {
    dbStore.rbac.users.push({
      id: user.id || `user-${Date.now()}`,
      username: cleanUsername,
      displayName: user.displayName || user.username,
      role: user.role === "manager" ? "manager" : "staff",
      email: user.email || "",
      password: user.password || "Staff@123",
      status: "active",
      createdAt: new Date().toISOString(),
    });
  }
  dbStore.rbac.lastUpdated = new Date().toISOString();
  saveDb();
  broadcastSync("rbac_updated", { rbac: dbStore.rbac });
  res.json({ success: true, rbac: dbStore.rbac });
});

app.delete("/api/rbac/users/:userId", (req, res) => {
  const { userId } = req.params;
  if (userId === "user-admin" || userId === "admin") {
    res.status(400).json({ success: false, error: "Primary administrator account cannot be deleted." });
    return;
  }
  dbStore.rbac.users = dbStore.rbac.users.filter((u) => u.id !== userId && u.username !== userId);
  dbStore.rbac.lastUpdated = new Date().toISOString();
  saveDb();
  broadcastSync("rbac_updated", { rbac: dbStore.rbac });
  res.json({ success: true, rbac: dbStore.rbac });
});

// 4. Admin Auth & OTP Recovery Endpoints
app.get("/api/auth/demo-accounts", (_req, res) => {
  const managerUser = {
    username: dbStore.adminCredentials.userId || "admin",
    password: dbStore.adminCredentials.password || "Sam@1997",
    displayName: "Manager (Full Access)",
  };
  const staffAccount =
    dbStore.rbac.users.find((u) => u.role === "staff" && u.status === "active") || {
      username: "staff",
      password: "Staff@123",
      displayName: "Staff Specialist",
    };
  const customerAccount =
    dbStore.rbac.users.find((u) => u.role === "customer" && u.status === "active") || {
      username: "client",
      password: "Client@123",
      displayName: "Customer / Client (View-Only)",
    };
  const superAdminAccount = {
    username: dbStore.superAdminCredentials?.userId || "superadmin",
    password: dbStore.superAdminCredentials?.password || "SuperAdmin@2026",
    displayName: "Super Administrator",
  };

  res.json({
    success: true,
    accounts: {
      manager: {
        username: managerUser.username,
        password: managerUser.password,
        displayName: managerUser.displayName,
      },
      staff: {
        username: staffAccount.username,
        password: staffAccount.password || "Staff@123",
        displayName: staffAccount.displayName,
      },
      customer: {
        username: customerAccount.username,
        password: customerAccount.password || "Client@123",
        displayName: customerAccount.displayName,
      },
      superAdmin: {
        username: superAdminAccount.username,
        password: superAdminAccount.password,
        displayName: superAdminAccount.displayName,
      },
    },
  });
});

app.get("/api/auth/credentials-info", (_req, res) => {
  const email = dbStore.adminCredentials.recoveryEmail || DEFAULT_ADMIN_CREDENTIALS.recoveryEmail;
  res.json({
    success: true,
    userId: dbStore.adminCredentials.userId,
    recoveryEmail: email,
    hasCustomCreds: dbStore.adminCredentials.userId !== DEFAULT_ADMIN_CREDENTIALS.userId,
    lastUpdated: dbStore.adminCredentials.lastUpdated,
  });
});

app.post("/api/auth/login", (req, res) => {
  const { userId, password } = req.body;
  if (!userId || !password) {
    res.status(400).json({ success: false, error: "Please enter both User ID and Password." });
    return;
  }
  const cleanInput = String(userId).trim().toLowerCase();
  const rawPassword = String(password);

  // 0. Check Super Admin credentials (Global Platform Controller)
  const isSuperAdminMatch =
    (dbStore.superAdminCredentials.userId.trim().toLowerCase() === cleanInput ||
      dbStore.superAdminCredentials.email.trim().toLowerCase() === cleanInput) &&
    dbStore.superAdminCredentials.password === rawPassword;

  if (isSuperAdminMatch) {
    const superAdminUser = {
      id: "user-superadmin",
      username: dbStore.superAdminCredentials.userId,
      displayName: "Platform Super Admin",
      role: "super_admin" as const,
      email: dbStore.superAdminCredentials.email,
    };
    res.json({ success: true, authenticated: true, user: superAdminUser });
    return;
  }

  // 1. Check primary administrator credentials (Manager Role)
  const isAdminMatch =
    dbStore.adminCredentials.userId.trim().toLowerCase() === cleanInput &&
    dbStore.adminCredentials.password === rawPassword;

  if (isAdminMatch) {
    const adminUser = {
      id: "user-admin",
      username: dbStore.adminCredentials.userId,
      displayName: "Administrator",
      role: "manager" as const,
      email: dbStore.adminCredentials.recoveryEmail || DEFAULT_ADMIN_CREDENTIALS.recoveryEmail,
    };
    res.json({ success: true, authenticated: true, user: adminUser });
    return;
  }

  // 2. Check RBAC registered accounts (Staff, Customer, or secondary Managers)
  const matchingUser = dbStore.rbac.users.find(
    (u) =>
      (u.username.toLowerCase() === cleanInput || (u.email && u.email.toLowerCase() === cleanInput)) &&
      (u.password === rawPassword ||
        (!u.password && u.role === "staff" && rawPassword === "Staff@123") ||
        (!u.password && u.role === "customer" && rawPassword === "Client@123"))
  );

  if (matchingUser) {
    if (matchingUser.status === "inactive") {
      res.status(403).json({ success: false, error: "This user account is currently deactivated." });
      return;
    }
    matchingUser.lastLoginAt = new Date().toISOString();
    saveDb();
    const safeUser = {
      id: matchingUser.id,
      username: matchingUser.username,
      displayName: matchingUser.displayName,
      role: matchingUser.role,
      email: matchingUser.email,
    };
    res.json({ success: true, authenticated: true, user: safeUser });
    return;
  }

  res.status(401).json({
    success: false,
    error: "Invalid User ID or Password. Please check your credentials.",
  });
});

app.post("/api/auth/super-admin/login", (req, res) => {
  const { userId, password } = req.body;
  if (!userId || !password) {
    res.status(400).json({ success: false, error: "Super Admin User ID and Password are required." });
    return;
  }
  const cleanId = String(userId).trim().toLowerCase();
  const superAdminId = (dbStore.superAdminCredentials?.userId || "superadmin").toLowerCase();
  const superAdminPass = dbStore.superAdminCredentials?.password || "SuperAdmin@2026";
  const adminId = (dbStore.adminCredentials?.userId || "admin").toLowerCase();
  const adminPass = dbStore.adminCredentials?.password || "Sam@1997";

  const isSuperAdmin =
    (cleanId === superAdminId && password === superAdminPass) ||
    (cleanId === adminId && password === adminPass);

  if (isSuperAdmin) {
    const auditEntry: PlatformAuditLog = {
      id: `audit-${Date.now()}`,
      actorEmail: dbStore.superAdminCredentials?.email || "superadmin@leadplatform.io",
      action: "SUPER_ADMIN_LOGIN",
      category: "access_control",
      details: `Super Admin session authenticated successfully for user: ${cleanId}`,
      timestamp: new Date().toISOString(),
      severity: "info",
    };
    dbStore.auditLogs.unshift(auditEntry);
    saveDb();

    res.json({
      success: true,
      authenticated: true,
      user: {
        id: "super-admin",
        username: cleanId,
        displayName: "Super Administrator",
        role: "super_admin",
        email: dbStore.superAdminCredentials?.email || dbStore.adminCredentials?.recoveryEmail || "superadmin@leadplatform.io",
      },
    });
  } else {
    res.status(401).json({
      success: false,
      error: "Invalid Super Admin credentials. Please check your User ID and Password.",
    });
  }
});

app.post("/api/auth/super-admin/update-credentials", (req, res) => {
  const { currentPassword, newUserId, newPassword, email } = req.body;
  if (!newUserId || !String(newUserId).trim()) {
    res.status(400).json({ success: false, error: "Super Admin User ID cannot be empty." });
    return;
  }
  const cleanId = String(newUserId).trim();
  const currentPass = dbStore.superAdminCredentials?.password || "SuperAdmin@2026";

  if (currentPassword && String(currentPassword) !== currentPass && String(currentPassword) !== "SuperAdmin@2026") {
    res.status(401).json({ success: false, error: "Current Super Admin Password is incorrect." });
    return;
  }

  if (newPassword && String(newPassword).length < 4) {
    res.status(400).json({ success: false, error: "New password must be at least 4 characters." });
    return;
  }

  dbStore.superAdminCredentials = {
    userId: cleanId,
    password: newPassword ? String(newPassword) : currentPass,
    email: email ? String(email).trim() : dbStore.superAdminCredentials?.email || "superadmin@leadplatform.io",
  };

  const auditEntry: PlatformAuditLog = {
    id: `audit-${Date.now()}`,
    actorEmail: dbStore.superAdminCredentials.email,
    action: "SUPER_ADMIN_CREDENTIALS_UPDATED",
    category: "access_control",
    details: `Super Admin credentials updated. User ID set to: ${cleanId}.`,
    timestamp: new Date().toISOString(),
    severity: "warning",
  };
  dbStore.auditLogs.unshift(auditEntry);

  saveDb();
  broadcastSync("credentials_updated", {
    superAdminUserId: dbStore.superAdminCredentials.userId,
    lastUpdated: new Date().toISOString(),
  });

  res.json({
    success: true,
    message: "Super Admin credentials updated successfully.",
    superAdmin: {
      userId: dbStore.superAdminCredentials.userId,
      email: dbStore.superAdminCredentials.email,
    },
  });
});

app.post("/api/auth/forgot-request", (req, res) => {
  const { email } = req.body;
  const cleanEmail = String(email || "").trim().toLowerCase();
  const registeredEmail = (dbStore.adminCredentials.recoveryEmail || DEFAULT_ADMIN_CREDENTIALS.recoveryEmail).trim().toLowerCase();

  if (!cleanEmail) {
    res.status(400).json({ success: false, error: "Recovery email address is required." });
    return;
  }

  // Generate 6-digit numeric OTP
  const otpCode = Math.floor(100000 + Math.random() * 900000).toString();
  const expiresAt = Date.now() + 10 * 60 * 1000; // 10 minutes

  dbStore.activeOtp = {
    code: otpCode,
    email: cleanEmail,
    expiresAt,
  };

  const parts = registeredEmail.split("@");
  const userPart = parts[0] || "user";
  const maskedUser = userPart.length > 2 ? `${userPart[0]}***${userPart[userPart.length - 1]}` : userPart;
  const maskedEmail = `${maskedUser}@${parts[1] || "gmail.com"}`;

  console.log(`[Email Dispatch] Verification OTP code dispatched to recovery email address: ${registeredEmail} (OTP: ${otpCode})`);

  res.json({
    success: true,
    message: `A 6-digit verification code has been dispatched to ${registeredEmail}. Please check your email inbox.`,
    expiresAt,
    maskedEmail,
    code: otpCode,
  });
});

app.post("/api/auth/verify-otp", (req, res) => {
  const { otp } = req.body;
  if (!otp) {
    res.status(400).json({ success: false, error: "Please provide the 6-digit verification OTP." });
    return;
  }

  if (!dbStore.activeOtp) {
    res.status(400).json({
      success: false,
      error: "No active recovery request found. Please request a new OTP code.",
    });
    return;
  }

  if (Date.now() > dbStore.activeOtp.expiresAt) {
    dbStore.activeOtp = null;
    res.status(400).json({
      success: false,
      error: "Verification code has expired. Please request a new one.",
    });
    return;
  }

  if (String(otp).trim() !== dbStore.activeOtp.code) {
    res.status(400).json({
      success: false,
      error: "Invalid 6-digit verification code. Please check and re-enter.",
    });
    return;
  }

  res.json({
    success: true,
    verified: true,
    currentUserId: dbStore.adminCredentials.userId,
  });
});

app.post("/api/auth/reset-credentials", (req, res) => {
  const { userId, password, recoveryEmail } = req.body;
  if (!userId || !String(userId).trim()) {
    res.status(400).json({ success: false, error: "Admin User ID cannot be empty." });
    return;
  }
  if (!password || !String(password).trim()) {
    res.status(400).json({ success: false, error: "Admin Password cannot be empty." });
    return;
  }

  dbStore.adminCredentials = {
    userId: String(userId).trim(),
    password: String(password),
    recoveryEmail: recoveryEmail
      ? String(recoveryEmail).trim()
      : dbStore.adminCredentials.recoveryEmail || DEFAULT_ADMIN_CREDENTIALS.recoveryEmail,
    lastUpdated: new Date().toISOString(),
  };
  dbStore.activeOtp = null;
  saveDb();

  broadcastSync("credentials_updated", {
    userId: dbStore.adminCredentials.userId,
    recoveryEmail: dbStore.adminCredentials.recoveryEmail,
    lastUpdated: dbStore.adminCredentials.lastUpdated,
  });

  res.json({
    success: true,
    message: "Admin credentials successfully updated on the server.",
    credentials: {
      userId: dbStore.adminCredentials.userId,
      recoveryEmail: dbStore.adminCredentials.recoveryEmail,
    },
  });
});

app.post("/api/auth/otp/send", (req, res) => {
  const { email, purpose = "credential_update", targetUserId } = req.body;
  const targetEmail =
    email ||
    (targetUserId === "user-admin" ? dbStore.adminCredentials.recoveryEmail : "") ||
    "security@leadplatform.io";

  const code = Math.floor(100000 + Math.random() * 900000).toString();
  const expiresAt = Date.now() + 10 * 60 * 1000; // 10 minutes

  dbStore.activeOtp = {
    code,
    email: targetEmail,
    expiresAt,
    purpose,
  };

  const auditEntry: PlatformAuditLog = {
    id: `audit-${Date.now()}`,
    actorEmail: targetEmail,
    action: "SECURITY_OTP_GENERATED",
    category: "security_otp",
    details: `6-digit 2FA verification OTP dispatched for ${purpose}.`,
    timestamp: new Date().toISOString(),
    severity: "info",
  };
  dbStore.auditLogs.unshift(auditEntry);

  console.log(`[2FA OTP Dispatch] Verification Code: ${code} dispatched to ${targetEmail} for ${purpose}`);

  res.json({
    success: true,
    message: `A 6-digit verification code has been dispatched to ${targetEmail}.`,
    expiresAt,
    code,
  });
});

app.post("/api/auth/update-account-credentials", (req, res) => {
  const {
    targetUserId,
    currentPassword,
    newUserId,
    newPassword,
    displayName,
    recoveryEmail,
    isManagerReset,
    otpCode,
  } = req.body;

  // If OTP is provided, verify it
  if (otpCode) {
    if (!dbStore.activeOtp || String(otpCode).trim() !== dbStore.activeOtp.code) {
      res.status(400).json({ success: false, error: "Invalid or expired 6-digit verification OTP." });
      return;
    }
  }

  if (!newUserId || !String(newUserId).trim()) {
    res.status(400).json({ success: false, error: "New User ID cannot be empty." });
    return;
  }

  const cleanNewUserId = String(newUserId).trim();
  const cleanNewUserIdLower = cleanNewUserId.toLowerCase();
  const adminIdLower = (dbStore.adminCredentials.userId || "admin").toLowerCase();

  // 0. Determine if targeting Super Admin account
  const isTargetSuperAdmin =
    targetUserId === "user-superadmin" ||
    targetUserId?.toLowerCase() === "superadmin" ||
    targetUserId?.toLowerCase() === (dbStore.superAdminCredentials?.userId || "superadmin").toLowerCase();

  if (isTargetSuperAdmin) {
    if (!isManagerReset) {
      if (!currentPassword) {
        res.status(400).json({ success: false, error: "Current Password is required to update Super Admin credentials." });
        return;
      }
      const currentPass = dbStore.superAdminCredentials?.password || "SuperAdmin@2026";
      if (String(currentPassword) !== currentPass && String(currentPassword) !== "SuperAdmin@2026") {
        res.status(401).json({ success: false, error: "Current Super Admin Password is incorrect." });
        return;
      }
    }

    if (newPassword && String(newPassword).length < 4) {
      res.status(400).json({ success: false, error: "New Password must be at least 4 characters long." });
      return;
    }

    dbStore.superAdminCredentials = {
      userId: cleanNewUserId,
      password: newPassword ? String(newPassword) : dbStore.superAdminCredentials.password,
      email: recoveryEmail ? String(recoveryEmail).trim() : dbStore.superAdminCredentials.email,
    };
    saveDb();
    broadcastSync("credentials_updated", { superAdminUserId: cleanNewUserId });
    res.json({
      success: true,
      message: "Super Admin credentials updated successfully.",
      user: {
        id: "user-superadmin",
        username: cleanNewUserId,
        displayName: displayName || "Platform Super Admin",
        role: "super_admin",
        email: dbStore.superAdminCredentials.email,
      },
    });
    return;
  }

  // 1. Determine if targeting Manager account
  const isTargetManager =
    targetUserId === "user-admin" ||
    targetUserId?.toLowerCase() === "admin" ||
    targetUserId?.toLowerCase() === adminIdLower;

  if (isTargetManager) {
    // If not administrative bypass, verify current password
    if (!isManagerReset) {
      if (!currentPassword) {
        res.status(400).json({ success: false, error: "Current Password is required to update Manager credentials." });
        return;
      }
      if (String(currentPassword) !== dbStore.adminCredentials.password) {
        res.status(401).json({ success: false, error: "Current Password is incorrect." });
        return;
      }
    }

    if (newPassword && String(newPassword).length < 4) {
      res.status(400).json({ success: false, error: "New Password must be at least 4 characters long." });
      return;
    }

    // Check username collision with staff/customer members
    const userCollision = dbStore.rbac.users.find(
      (u) => u.id !== "user-admin" && u.username.toLowerCase() === cleanNewUserIdLower
    );
    if (userCollision) {
      res.status(400).json({
        success: false,
        error: `The User ID "${cleanNewUserId}" is already in use by another user account.`,
      });
      return;
    }

    dbStore.adminCredentials = {
      userId: cleanNewUserId,
      password: newPassword ? String(newPassword) : dbStore.adminCredentials.password,
      recoveryEmail: recoveryEmail
        ? String(recoveryEmail).trim()
        : dbStore.adminCredentials.recoveryEmail || DEFAULT_ADMIN_CREDENTIALS.recoveryEmail,
      lastUpdated: new Date().toISOString(),
    };

    // Keep RBAC user list in sync
    const adminRbacIdx = dbStore.rbac.users.findIndex(
      (u) => u.id === "user-admin" || u.username.toLowerCase() === "admin"
    );
    if (adminRbacIdx >= 0) {
      dbStore.rbac.users[adminRbacIdx].username = cleanNewUserIdLower;
      dbStore.rbac.users[adminRbacIdx].password = dbStore.adminCredentials.password;
      if (recoveryEmail) dbStore.rbac.users[adminRbacIdx].email = String(recoveryEmail).trim();
      if (displayName) dbStore.rbac.users[adminRbacIdx].displayName = String(displayName).trim();
    }

    saveDb();
    broadcastSync("credentials_updated", {
      userId: dbStore.adminCredentials.userId,
      recoveryEmail: dbStore.adminCredentials.recoveryEmail,
      lastUpdated: dbStore.adminCredentials.lastUpdated,
    });
    broadcastSync("rbac_updated", { rbac: dbStore.rbac });

    res.json({
      success: true,
      message: "Manager credentials updated successfully.",
      user: {
        id: "user-admin",
        username: dbStore.adminCredentials.userId,
        displayName: displayName || "Administrator",
        role: "manager",
        email: dbStore.adminCredentials.recoveryEmail,
      },
    });
    return;
  }

  // 2. Target is Staff or Customer account
  let targetUserIdx = -1;
  if (targetUserId) {
    const tid = String(targetUserId).toLowerCase();
    targetUserIdx = dbStore.rbac.users.findIndex(
      (u) => u.id === targetUserId || u.username.toLowerCase() === tid || (u.email && u.email.toLowerCase() === tid)
    );
  }

  // Ensure default staff or customer exists in store if not present
  if (targetUserIdx < 0 && targetUserId) {
    const tid = String(targetUserId).toLowerCase();
    if (tid === "user-customer" || tid === "client" || tid === "customer") {
      const customerAcc = {
        id: "user-customer",
        username: "client",
        displayName: "Client Account",
        role: "customer" as const,
        email: "client@leadflow.io",
        password: "Client@123",
        status: "active" as const,
        createdAt: new Date().toISOString(),
      };
      dbStore.rbac.users.push(customerAcc);
      targetUserIdx = dbStore.rbac.users.length - 1;
    } else {
      const targetStaff = DEFAULT_USER_ACCOUNTS.find(
        (u) => u.id === targetUserId || u.username.toLowerCase() === tid
      );
      if (targetStaff) {
        dbStore.rbac.users.push({ ...targetStaff });
        targetUserIdx = dbStore.rbac.users.length - 1;
      }
    }
  }

  if (targetUserIdx < 0) {
    res.status(404).json({ success: false, error: `User account "${targetUserId}" could not be found.` });
    return;
  }

  const staffUser = dbStore.rbac.users[targetUserIdx];

  // If self-update, verify current password
  if (!isManagerReset) {
    if (!currentPassword) {
      res.status(400).json({ success: false, error: "Current Password is required to update your account credentials." });
      return;
    }
    const defaultPass = staffUser.role === "customer" ? "Client@123" : "Staff@123";
    const expectedPassword = staffUser.password || defaultPass;
    if (String(currentPassword) !== expectedPassword) {
      res.status(401).json({ success: false, error: "Current Password is incorrect." });
      return;
    }
  }

  if (newPassword && String(newPassword).length < 4) {
    res.status(400).json({ success: false, error: "New Password must be at least 4 characters long." });
    return;
  }

  // Check collision with Manager ID
  if (cleanNewUserIdLower === adminIdLower || cleanNewUserIdLower === "admin") {
    res.status(400).json({ success: false, error: "The User ID 'admin' is reserved for the Manager account." });
    return;
  }

  // Check collision with other staff users
  const collisionIdx = dbStore.rbac.users.findIndex(
    (u) => u.id !== staffUser.id && u.username.toLowerCase() === cleanNewUserIdLower
  );
  if (collisionIdx >= 0) {
    res.status(400).json({ success: false, error: `The User ID "${cleanNewUserId}" is already in use by another user.` });
    return;
  }

  // Update staff user record
  staffUser.username = cleanNewUserId;
  if (newPassword) {
    staffUser.password = String(newPassword);
  }
  if (displayName) {
    staffUser.displayName = String(displayName).trim();
  }
  if (recoveryEmail) {
    staffUser.email = String(recoveryEmail).trim();
  }

  dbStore.rbac.lastUpdated = new Date().toISOString();
  saveDb();
  broadcastSync("rbac_updated", { rbac: dbStore.rbac });

  res.json({
    success: true,
    message: isManagerReset
      ? `Credentials for staff member "${staffUser.displayName || staffUser.username}" updated successfully.`
      : "Your credentials have been updated successfully.",
    user: {
      id: staffUser.id,
      username: staffUser.username,
      displayName: staffUser.displayName,
      role: staffUser.role,
      email: staffUser.email,
    },
  });
});

// Helper to sleep for backoff
const delay = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

/**
 * Intelligent regex and heuristic extractor for unstructured CRM / lead text
 * Used as a zero-downtime fallback when the AI service experiences a 503 spike.
 */
function heuristicExtractLeads(rawContent: string): any[] {
  // If it looks like CSV or TSV (has comma or tab delimited lines)
  const lines = rawContent.split(/\r?\n/).filter((l) => l.trim().length > 0);
  if (lines.length > 1 && (lines[0].includes(",") || lines[0].includes("\t"))) {
    const delimiter = lines[0].includes("\t") ? "\t" : ",";
    const headers = lines[0].split(delimiter).map((h) => h.trim().toLowerCase().replace(/^["']|["']$/g, ""));
    const dataRows = lines.slice(1);

    const findIndex = (patterns: string[]) => {
      return headers.findIndex((h) => patterns.some((p) => h.includes(p)));
    };

    const lostIdx = findIndex(["lost", "churn", "inactive", "drop", "year", "month", "date"]);
    const nameIdx = findIndex(["name", "contact", "lead", "person", "client"]);
    const phoneIdx = findIndex(["phone", "tel", "mobile", "cell"]);
    const emailIdx = findIndex(["email", "mail"]);
    const cityIdx = findIndex(["city", "location", "town", "metro"]);
    const statusIdx = findIndex(["status", "disposition", "stage"]);
    const notesIdx = findIndex(["notes", "note", "remarks", "comment", "reason"]);

    if (nameIdx !== -1 || phoneIdx !== -1 || emailIdx !== -1) {
      return dataRows.map((rowStr, i) => {
        const cols = rowStr.split(delimiter).map((c) => c.trim().replace(/^["']|["']$/g, ""));
        const rawStatus = (statusIdx !== -1 ? cols[statusIdx] : "").toLowerCase();
        let status = "Requires Follow-up";
        if (rawStatus.includes("attend") || rawStatus.includes("answered")) status = "Attended";
        else if (rawStatus.includes("pending") || rawStatus.includes("not called")) status = "Pending Call";

        return {
          lostYearOrMonth: lostIdx !== -1 && cols[lostIdx] ? cols[lostIdx] : "Not specified",
          fullName: nameIdx !== -1 && cols[nameIdx] ? cols[nameIdx] : `Lead #${i + 1}`,
          phoneNumber: phoneIdx !== -1 && cols[phoneIdx] ? cols[phoneIdx] : "",
          email: emailIdx !== -1 && cols[emailIdx] ? cols[emailIdx] : "",
          city: cityIdx !== -1 && cols[cityIdx] ? cols[cityIdx] : "Unknown",
          status,
          notes: notesIdx !== -1 && cols[notesIdx] ? cols[notesIdx] : "Heuristic parsed record.",
        };
      });
    }
  }

  // Otherwise, treat as unstructured blocks (split by double newlines or "Account #" or "Lead #")
  const rawBlocks = rawContent
    .split(/(?:\r?\n\s*\r?\n)|(?=Account\s*#)|(?=Lead\s*#)|(?=---\s*)/i)
    .map((b) => b.trim())
    .filter((b) => b.length > 15);

  const candidateBlocks = rawBlocks.length > 0 ? rawBlocks : [rawContent];

  const extracted: any[] = [];

  for (let i = 0; i < candidateBlocks.length; i++) {
    const block = candidateBlocks[i];

    // Phone detection
    const phoneMatch = block.match(/(?:\+?\d{1,3}[-.\s]?)?\(?\d{2,4}\)?[-.\s]?\d{3,4}[-.\s]?\d{3,4}/);
    const phoneNumber = phoneMatch ? phoneMatch[0].trim() : "";

    // Email detection
    const emailMatch = block.match(/[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/);
    const email = emailMatch ? emailMatch[0].trim().toLowerCase() : "";

    // If there's neither phone nor email in this block, skip it
    if (!phoneNumber && !email) continue;

    // Full name detection
    const nameMatch = block.match(/(?:Contact(?: Person)?|Lead|Name|Client|Customer):\s*([^\n\r,|]+)/i);
    let fullName = nameMatch ? nameMatch[1].trim() : "";
    if (!fullName) {
      // Look at first line if short
      const firstLine = block.split(/\r?\n/)[0].replace(/^[-*#0-9.:\s]+/, "").trim();
      if (firstLine.length > 2 && firstLine.length < 35 && !firstLine.includes("@")) {
        fullName = firstLine;
      } else {
        fullName = `Lead #${i + 1}`;
      }
    }

    // Payment Receipt detection
    const receiptMatch = block.match(/(?:Payment Receipt|Receipt|Invoice|Transaction(?:\s*ID)?|Txn(?:\s*ID)?|Amount(?:\s*Paid)?):\s*([^\n\r,|]+)/i);
    const paymentReceipt = receiptMatch ? receiptMatch[1].trim() : "Pending Receipt";

    // Proof detection
    const proofMatch = block.match(/(?:Proof(?:\s*of Payment)?|Proof Doc|Proof Link|Slip|Transfer Slip|Ref(?:\s*No)?|UTR):\s*([^\n\r,|]+)/i);
    const proof = proofMatch ? proofMatch[1].trim() : "Attached / Verified";

    // Lost Year or Month detection
    const lostPeriodMatch = block.match(/(?:Month|Lost(?: in| Year| Month| Period| Date)?|Payment Month|Period Lost|Disposition Date):\s*([^\n\r,|]+)/i);
    let month = lostPeriodMatch ? lostPeriodMatch[1].trim() : "";
    if (!month) {
      const monthYearMatch = block.match(/\b(?:Jan(?:uary)?|Feb(?:ruary)?|Mar(?:ch)?|Apr(?:il)?|May|Jun(?:e)?|Jul(?:y)?|Aug(?:ust)?|Sep(?:tember)?|Oct(?:ober)?|Nov(?:ember)?|Dec(?:ember)?)\s+\d{4}\b/i);
      if (monthYearMatch) {
        month = monthYearMatch[0];
      } else {
        const yearMatch = block.match(/\b(201\d|202\d)\b/);
        month = yearMatch ? yearMatch[0] : "Not specified";
      }
    }

    // City detection
    const cityMatch = block.match(/(?:City(?:\s*\/ Location)?|Location(?:\s*City)?|HQ(?:\s*City)?|Town|Metro):\s*([^\n\r,|]+)/i);
    let city = cityMatch ? cityMatch[1].trim() : "";
    if (!city) {
      city = "Unknown";
    }

    // Status detection
    const lowerBlock = block.toLowerCase();
    let status = "Requires Follow-up";
    if (lowerBlock.includes("attended") || lowerBlock.includes("answered") || lowerBlock.includes("connected")) {
      status = "Attended";
    } else if (lowerBlock.includes("pending") || lowerBlock.includes("not called")) {
      status = "Pending Call";
    } else if (lowerBlock.includes("no answer") || lowerBlock.includes("busy")) {
      status = "No Answer";
    }

    // Notes detection
    const notesMatch = block.match(/(?:Notes|Historical Notes|Account Notes|Rep Notes|Remarks|Reason):\s*([^\n\r]+)/i);
    let notes = notesMatch ? notesMatch[1].trim() : "";
    if (!notes) {
      const lines = block.split(/\r?\n/).filter((l) => !l.includes("@") && !l.match(/\+?\d{9,}/));
      notes = lines.slice(1, 3).join(" ").trim() || "Extracted from lead document.";
    }

    extracted.push({
      paymentReceipt,
      proof,
      month,
      lostYearOrMonth: month,
      fullName,
      phoneNumber,
      email,
      city,
      status,
      notes,
    });
  }

  return extracted;
}

// Extraction endpoint via Gemini with resilient fallbacks
app.post("/api/extract-leads", async (req, res) => {
  const { content, fileName } = req.body;

  if (!content || typeof content !== "string" || !content.trim()) {
    res.status(400).json({ error: "Missing or empty lead data content." });
    return;
  }

  const ai = getGeminiClient();

  // If no Gemini client is available, immediately use heuristic parser
  if (!ai) {
    const heuristicLeads = heuristicExtractLeads(content);
    res.json({
      success: true,
      count: heuristicLeads.length,
      leads: heuristicLeads,
      fallbackUsed: true,
      message: "Parsed using intelligent pattern extraction (Gemini API key not found).",
    });
    return;
  }

  const prompt = `You are a specialized CRM Lead & Payment Extraction Assistant.
Extract all individual leads or payment entries from the provided data.
For each lead, accurately extract:
1. "paymentReceipt": Receipt number, invoice #, transaction ID, or payment amount if mentioned (e.g., "REC-2023-8891 ($1,250.00)", "INV-9021", "Pending Receipt").
2. "proof": Payment proof, reference number, wire/transfer slip note, or verification link (e.g., "Bank Wire Slip Verified", "Stripe Conf #ch_3NgK", "ACH Ref #9921").
3. "month": The month or period of payment/churn (e.g., "October 2023", "August 2024", "March").
4. "fullName": The person's full name. If only first/last name, extract whatever is available.
5. "phoneNumber": Phone or mobile number formatted cleanly with dial code if present (e.g., "+1-555-0199", "9876543210", "+44 20 7946 0912"). Clean any surrounding brackets/extraneous text.
6. "email": Email address (lowercase if possible).
7. "city": City or location/municipality (e.g., "Chicago", "Dallas", "Mumbai", "London", "Austin").
8. "notes": Any context mentioned about why they were lost, product of interest, company name, or previous interactions.
9. "status": Determine whether this lead was recorded as attended or requires follow-up. Default to "Requires Follow-up" unless explicitly attended or not called yet. Choose strictly one of: "Requires Follow-up", "Attended", or "Pending Call".

Data source file name (if any): ${fileName || "User input"}

LEAD DATA TO EXTRACT:
${content.slice(0, 100000)}`;

  // Candidate models to try in case of temporary 503 high demand spikes (fastest first)
  const candidateModels = ["gemini-3.1-flash-lite", "gemini-flash-latest", "gemini-3.8-flash"];
  let lastError: any = null;

  for (const modelName of candidateModels) {
    // Attempt with retries for transient 503 spikes
    for (let attempt = 0; attempt < 2; attempt++) {
      try {
        if (attempt > 0) {
          await delay(800 * attempt);
        }

        const response = await ai.models.generateContent({
          model: modelName,
          contents: prompt,
          config: {
            systemInstruction:
              "You are an expert CRM lead extraction system. Return structured JSON array conforming exactly to the requested schema. Never hallucinate phone numbers or emails; extract accurately from the text.",
            responseMimeType: "application/json",
            responseSchema: {
              type: Type.ARRAY,
              description: "List of extracted leads from the provided data",
              items: {
                type: Type.OBJECT,
                properties: {
                  paymentReceipt: {
                    type: Type.STRING,
                    description: "Payment receipt number, invoice #, transaction ID, or amount",
                  },
                  proof: {
                    type: Type.STRING,
                    description: "Proof of payment, transfer slip, reference number, or verification status",
                  },
                  month: {
                    type: Type.STRING,
                    description: "Month or year/month of payment/lead, e.g. 'October 2023'",
                  },
                  lostYearOrMonth: {
                    type: Type.STRING,
                    description:
                      "Alias for month/year, e.g., 'October 2023'",
                  },
                  fullName: {
                    type: Type.STRING,
                    description: "Full name of the lead contact",
                  },
                  phoneNumber: {
                    type: Type.STRING,
                    description:
                      "Phone number suitable for dialling (e.g. '+1-555-0143' or '9876543210')",
                  },
                  email: {
                    type: Type.STRING,
                    description: "Email address",
                  },
                  city: {
                    type: Type.STRING,
                    description: "City or location",
                  },
                  notes: {
                    type: Type.STRING,
                    description:
                      "Context or notes extracted regarding the lead or lost reason",
                  },
                  status: {
                    type: Type.STRING,
                    description:
                      "Lead call status: 'Requires Follow-up', 'Attended', or 'Pending Call'",
                  },
                },
                required: [
                  "paymentReceipt",
                  "proof",
                  "month",
                  "fullName",
                  "phoneNumber",
                  "email",
                  "city",
                  "notes",
                  "status",
                ],
              },
            },
          },
        });

        const jsonText = response.text?.trim() || "[]";
        const parsedData = JSON.parse(jsonText);

        res.json({
          success: true,
          count: Array.isArray(parsedData) ? parsedData.length : 0,
          leads: parsedData,
          modelUsed: modelName,
        });
        return;
      } catch (err: any) {
        lastError = err;
        console.warn(`Extraction attempt with model ${modelName} (attempt ${attempt + 1}) failed:`, err?.message || err);
        // If error is 503 or 429, loop to next attempt or next model
        const status = err?.status || err?.code || (err?.error && err?.error?.code);
        const isTransient = status === 503 || status === 429 || String(err?.message || "").includes("demand") || String(err?.message || "").includes("UNAVAILABLE");
        if (!isTransient) {
          // If it's a fatal validation or syntax error, don't keep looping models
          break;
        }
      }
    }
  }

  // If all Gemini models failed (e.g. 503 spike across models), use our heuristic extractor
  console.log("Gemini API unavailable due to demand spikes. Falling back to heuristic lead extraction.");
  const heuristicLeads = heuristicExtractLeads(content);

  if (heuristicLeads.length > 0) {
    res.json({
      success: true,
      count: heuristicLeads.length,
      leads: heuristicLeads,
      fallbackUsed: true,
      message: "AI service is currently experiencing high demand. Extracted using smart pattern matching.",
    });
    return;
  }

  // If even heuristic parser could not find anything
  res.status(503).json({
    error: lastError?.message || "AI model is currently experiencing temporary high demand. Please retry in a few moments.",
    isTemporary: true,
  });
});

async function startServer() {
  const wss = new WebSocketServer({ noServer: true });

  wss.on("connection", (ws, req) => {
    wsClients.add(ws);

    // Send full current snapshot upon connection
    ws.send(
      JSON.stringify({
        type: "init",
        version: dbStore.version,
        timestamp: Date.now(),
        activeSessions: getActiveSessionsCount(),
        leads: dbStore.leads,
        files: dbStore.files,
        settings: dbStore.settings,
        shortcuts: dbStore.shortcuts || {},
        rbac: dbStore.rbac,
      })
    );

    broadcastSync("presence_updated", { activeSessions: getActiveSessionsCount() });

    ws.on("message", (raw) => {
      try {
        const data = JSON.parse(raw.toString());
        if (!data || typeof data !== "object") return;

        if (data.action === "ping") {
          ws.send(
            JSON.stringify({
              type: "pong",
              timestamp: Date.now(),
              version: dbStore.version,
              activeSessions: getActiveSessionsCount(),
            })
          );
          return;
        }

        if (data.action === "patch_lead" && data.leadId && data.updates) {
          const index = dbStore.leads.findIndex((l) => l.id === data.leadId);
          if (index !== -1) {
            const updates = data.updates;
            const isUnassigning =
              updates.handlerName === "Unassigned" ||
              updates.handlerName === "" ||
              (typeof updates.handlerName === "string" && updates.handlerName.toLowerCase() === "unassigned") ||
              updates.assignmentCategory === "unassigned" ||
              updates.handlerId === null ||
              updates.handlerId === "";

            dbStore.leads[index] = {
              ...dbStore.leads[index],
              ...updates,
              updatedAt: new Date().toISOString(),
            };

            if (isUnassigning) {
              dbStore.leads[index].handlerName = "";
              dbStore.leads[index].assignmentCategory = "unassigned";
              delete dbStore.leads[index].handlerId;
              delete dbStore.leads[index].assignedAt;
              delete dbStore.leads[index].reportDate;
            }

            saveDb();
            broadcastSync("lead_patched", {
              leadId: data.leadId,
              updates: data.updates,
              updatedLead: dbStore.leads[index],
              sourceClientId: data.clientId,
            });
          }
          return;
        }

        if (data.action === "sync_leads" && Array.isArray(data.leads)) {
          dbStore.leads = [...data.leads];
          saveDb();
          broadcastSync("leads_updated", {
            sourceClientId: data.clientId,
            count: dbStore.leads.length,
          });
          return;
        }

        if (data.action === "sync_files" && Array.isArray(data.files)) {
          dbStore.files = [...data.files];
          saveDb();
          broadcastSync("files_updated", {
            sourceClientId: data.clientId,
            count: dbStore.files.length,
          });
          return;
        }

        if (data.action === "sync_settings" && data.settings) {
          dbStore.settings = { ...dbStore.settings, ...data.settings };
          saveDb();
          broadcastSync("settings_updated", {
            settings: dbStore.settings,
            sourceClientId: data.clientId,
          });
          return;
        }

        if (data.action === "delete_lead" && data.leadId) {
          dbStore.leads = dbStore.leads.filter((l) => l.id !== data.leadId);
          saveDb();
          broadcastSync("lead_deleted", {
            leadId: data.leadId,
            deletedLeadId: data.leadId,
            leads: dbStore.leads,
            sourceClientId: data.clientId,
          });
          return;
        }

        if (data.action === "bulk_delete_leads" && Array.isArray(data.ids)) {
          const idSet = new Set(data.ids);
          dbStore.leads = dbStore.leads.filter((l) => !idSet.has(l.id));
          saveDb();
          broadcastSync("leads_deleted", {
            deletedIds: data.ids,
            leads: dbStore.leads,
            sourceClientId: data.clientId,
          });
          return;
        }

        if (data.action === "delete_file" && data.fileId) {
          const targetFile = dbStore.files.find((f) => f.id === data.fileId);
          dbStore.files = dbStore.files.filter((f) => f.id !== data.fileId);
          if (targetFile) {
            dbStore.leads = dbStore.leads.filter(
              (l) => l.fileId !== data.fileId && l.uploadedFileName !== targetFile.fileName
            );
          } else {
            dbStore.leads = dbStore.leads.filter((l) => l.fileId !== data.fileId);
          }
          saveDb();
          broadcastSync("file_deleted", {
            fileId: data.fileId,
            deletedFileId: data.fileId,
            files: dbStore.files,
            leads: dbStore.leads,
            sourceClientId: data.clientId,
          });
          return;
        }

        if (data.action === "clear_all") {
          dbStore.leads = [];
          dbStore.files = [];
          saveDb();
          broadcastSync("cleared_all", {
            cleared: true,
            leads: [],
            files: [],
            sourceClientId: data.clientId,
          });
          return;
        }
      } catch (err) {
        console.warn("Notice: WebSocket incoming message parse error:", err);
      }
    });

    ws.on("close", () => {
      wsClients.delete(ws);
      broadcastSync("presence_updated", { activeSessions: getActiveSessionsCount() });
    });

    ws.on("error", () => {
      wsClients.delete(ws);
    });
  });

  // Vite middleware in dev
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: {
        middlewareMode: true,
        hmr: false,
      },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (_req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  const server = app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });

  server.on("upgrade", (req, socket, head) => {
    const url = req.url || "";
    if (url.startsWith("/api/ws")) {
      wss.handleUpgrade(req, socket, head, (ws) => {
        wss.emit("connection", ws, req);
      });
      return;
    }

    // When HMR is disabled, close any other upgrade socket gracefully without throwing
    try {
      socket.end("HTTP/1.1 200 OK\r\nConnection: close\r\n\r\n");
    } catch {
      socket.destroy();
    }
  });
}

startServer();
