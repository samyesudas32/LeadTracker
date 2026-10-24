export type AppRole = "super_admin" | "manager" | "staff" | "customer";

export interface PermissionDefinition {
  id: string; // e.g. "leads:view", "files:upload", or dynamic keys
  label: string;
  description: string;
  category: "Leads" | "Files & Data" | "Export & Reports" | "Administration" | "Custom";
  isCustom?: boolean;
}

export interface UserAccount {
  id: string;
  username: string; // e.g. "admin", "staff", "client", "helen"
  displayName: string;
  role: AppRole;
  email?: string;
  password?: string;
  status: "active" | "inactive";
  createdAt: string;
  lastLoginAt?: string;
}

export interface RolePermissions {
  manager: Record<string, boolean>;
  staff: Record<string, boolean>;
  customer?: Record<string, boolean>;
  [customRole: string]: Record<string, boolean> | undefined;
}

export interface RBACConfig {
  version: number;
  permissions: PermissionDefinition[];
  rolePermissions: RolePermissions;
  users: UserAccount[];
  lastUpdated?: string;
}
