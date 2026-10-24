import { PermissionDefinition, RBACConfig, UserAccount } from "../types/rbac";

export const DEFAULT_PERMISSION_DEFINITIONS: PermissionDefinition[] = [
  // 1. Leads Management
  {
    id: "leads:view",
    label: "View Leads & Workspaces",
    description: "Browse, filter, and inspect leads across daily worksheets and categories.",
    category: "Leads",
  },
  {
    id: "leads:edit",
    label: "Edit Lead Details & Notes",
    description: "Modify lead name, phone, email, notes, manual comments, and verification fields.",
    category: "Leads",
  },
  {
    id: "leads:create",
    label: "Create New Leads",
    description: "Manually add single new client leads to the active workspace.",
    category: "Leads",
  },
  {
    id: "leads:status_change",
    label: "Update Call Status",
    description: "Change client call status (Interested, Follow-up, No Answer, Not Interested).",
    category: "Leads",
  },
  {
    id: "leads:reassign_handler",
    label: "Reassign Lead Handler",
    description: "Assign or transfer leads between specialists and team handlers.",
    category: "Leads",
  },
  {
    id: "leads:delete_single",
    label: "Delete Individual Lead",
    description: "Permanently delete a single lead entry from the workspace.",
    category: "Leads",
  },
  {
    id: "leads:delete_batch",
    label: "Bulk Delete Leads",
    description: "Batch select and purge multiple lead records simultaneously.",
    category: "Leads",
  },

  // 2. Files & Ingestion
  {
    id: "files:upload",
    label: "Upload & Ingest Spreadsheets",
    description: "Upload XLSX, XLS, and CSV files to import bulk client records.",
    category: "Files & Data",
  },
  {
    id: "files:delete",
    label: "Delete Uploaded Files",
    description: "Remove entire uploaded spreadsheet batches and purge associated leads.",
    category: "Files & Data",
  },

  // 3. Export & Reporting
  {
    id: "export:excel",
    label: "Export to Excel (.xlsx)",
    description: "Download active or filtered lead databases into formatted Microsoft Excel files.",
    category: "Export & Reports",
  },
  {
    id: "export:csv",
    label: "Export to CSV (.csv)",
    description: "Download lead databases into comma-separated text files.",
    category: "Export & Reports",
  },
  {
    id: "reports:pdf",
    label: "Generate PDF Reports",
    description: "Generate and download professional team workload PDF reports.",
    category: "Export & Reports",
  },

  // 4. Administration & Governance
  {
    id: "handlers:manage",
    label: "Manage Handlers & Specialists",
    description: "Add, edit, reassign, or remove staff handler profiles and color themes.",
    category: "Administration",
  },
  {
    id: "settings:view",
    label: "View System Settings",
    description: "Access system configuration, company profiles, and preferences.",
    category: "Administration",
  },
  {
    id: "settings:manage",
    label: "Manage System Settings",
    description: "Edit cutoff hours, business rules, duplicate detection, and title tags.",
    category: "Administration",
  },
  {
    id: "rbac:manage",
    label: "Manage Roles & Permissions",
    description: "Dynamically customize staff permissions, create dynamic rules, and manage accounts.",
    category: "Administration",
  },
  {
    id: "shortcuts:manage",
    label: "Configure Keyboard Shortcuts",
    description: "Customize personal keyboard shortcuts and speed bindings.",
    category: "Administration",
  },
  {
    id: "analytics:view",
    label: "View Analytics & Metrics",
    description: "Inspect performance KPI cards, attended metrics, and team progress meters.",
    category: "Administration",
  },
];

export const DEFAULT_INITIAL_STAFF_PERMISSIONS: Record<string, boolean> = {
  "leads:view": true,
  "leads:edit": true,
  "leads:create": true,
  "leads:status_change": true,
  "analytics:view": true,
  "shortcuts:manage": true,
  // Limited permissions initially:
  "leads:reassign_handler": false,
  "leads:delete_single": false,
  "leads:delete_batch": false,
  "files:upload": false,
  "files:delete": false,
  "export:excel": false,
  "export:csv": false,
  "reports:pdf": false,
  "handlers:manage": false,
  "settings:view": false,
  "settings:manage": false,
  "rbac:manage": false,
};

export const DEFAULT_INITIAL_CUSTOMER_PERMISSIONS: Record<string, boolean> = {
  "leads:view": true,
  "analytics:view": true,
  "export:excel": true,
  "export:csv": false,
  "reports:pdf": true,
  "shortcuts:manage": false,
  "leads:edit": false,
  "leads:create": false,
  "leads:status_change": false,
  "leads:reassign_handler": false,
  "leads:delete_single": false,
  "leads:delete_batch": false,
  "files:upload": false,
  "files:delete": false,
  "handlers:manage": false,
  "settings:view": false,
  "settings:manage": false,
  "rbac:manage": false,
};

export const DEFAULT_INITIAL_MANAGER_PERMISSIONS: Record<string, boolean> = DEFAULT_PERMISSION_DEFINITIONS.reduce(
  (acc, p) => ({ ...acc, [p.id]: true }),
  {} as Record<string, boolean>
);

export const DEFAULT_CUSTOMER_USER: UserAccount = {
  id: "user-customer",
  username: "client",
  displayName: "Client Account",
  role: "customer",
  email: "client@leadflow.io",
  password: "Client@123",
  status: "active",
  createdAt: "2026-09-30T17:30:00.000Z",
};

export const DEFAULT_USER_ACCOUNTS: UserAccount[] = [
  {
    id: "user-admin",
    username: "admin",
    displayName: "Administrator",
    role: "manager",
    email: "gatewaylawpartners@gmail.com",
    password: "Sam@1997",
    status: "active",
    createdAt: "2026-09-30T17:30:00.000Z",
  },
  {
    id: "user-staff",
    username: "staff",
    displayName: "Staff Member",
    role: "staff",
    email: "staff@company.com",
    password: "Staff@123",
    status: "active",
    createdAt: "2026-09-30T17:30:00.000Z",
  },
  DEFAULT_CUSTOMER_USER,
  {
    id: "user-helen",
    username: "helen",
    displayName: "Helen Specialist",
    role: "staff",
    email: "helen@company.com",
    password: "Staff@123",
    status: "active",
    createdAt: "2026-09-30T17:30:00.000Z",
  },
  {
    id: "user-athira",
    username: "athira",
    displayName: "Athira Handler",
    role: "staff",
    email: "athira@company.com",
    password: "Staff@123",
    status: "active",
    createdAt: "2026-09-30T17:30:00.000Z",
  },
];

export const DEFAULT_RBAC_CONFIG: RBACConfig = {
  version: 1,
  permissions: DEFAULT_PERMISSION_DEFINITIONS,
  rolePermissions: {
    manager: DEFAULT_INITIAL_MANAGER_PERMISSIONS,
    staff: DEFAULT_INITIAL_STAFF_PERMISSIONS,
    customer: DEFAULT_INITIAL_CUSTOMER_PERMISSIONS,
  },
  users: DEFAULT_USER_ACCOUNTS,
  lastUpdated: new Date().toISOString(),
};
