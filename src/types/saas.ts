import { AppRole } from "./rbac";

export type TenantStatus = "active" | "paused" | "disabled" | "view_only";
export type SubscriptionTier = "trial" | "standard" | "enterprise";

export interface Tenant {
  id: string;
  name: string;
  slug: string;
  domain?: string;
  status: TenantStatus;
  planTier: SubscriptionTier;
  trialStartsAt: string;
  expiresAt: string; // ISO string
  maxLeads: number;
  maxUsers: number;
  contactEmail: string;
  contactName?: string;
  createdAt: string;
  updatedAt?: string;
  autoRenewEnabled?: boolean;
  billingCadence?: "monthly" | "yearly";
  monthlyPriceUsd?: number;
  activeLeadsCount?: number;
  activeUsersCount?: number;
}

export interface DatabaseBackup {
  id: string;
  timestamp: string; // ISO string
  tenantsCount: number;
  leadsCount: number;
  filesCount: number;
  sizeBytes: number;
  sizeFormatted: string;
  type: "automated_daily" | "manual_snapshot";
  checksum: string;
  status: "verified" | "pending";
  downloadUrl?: string;
}

export interface PlatformAuditLog {
  id: string;
  tenantId?: string;
  tenantName?: string;
  userId?: string;
  actorEmail: string;
  action: string;
  category: "tenant_lifecycle" | "billing" | "security_otp" | "backup" | "access_control";
  details: string;
  timestamp: string;
  ipAddress?: string;
  severity?: "info" | "warning" | "critical";
}

export interface StripeCheckoutSession {
  sessionId: string;
  tenantId: string;
  planTier: SubscriptionTier;
  amountCents: number;
  currency: string;
  billingInterval: "month" | "year";
  successUrl: string;
  cancelUrl: string;
  clientSecret?: string;
}
