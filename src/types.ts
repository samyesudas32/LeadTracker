export type CallStatus =
  | "Interested"
  | "Requires Follow-up"
  | "Pending Call"
  | "No Answer"
  | "Not Interested";

export interface HandlerRecord {
  id: string;
  name: string; // e.g. "Helen", "Athira", "Anjana"
  color: "purple" | "emerald" | "blue" | "amber" | "rose" | "indigo" | "teal" | "slate";
  email?: string;
  phone?: string;
  role?: string;
  isDefault?: boolean;
  createdAt: string;
}

export interface AppSettings {
  handlers: HandlerRecord[];
  activeFrontPageHandler: string; // "all" or specific Handler name like "Helen"
  defaultNewLeadHandler: string; // "active" | "unassigned" | specific Handler name
  softwareTitle: string;
  companyName?: string;
  tableDensity?: "comfortable" | "compact";
  dateFormat?: "MMM D, YYYY" | "YYYY-MM-DD" | "DD/MM/YYYY";
  defaultLeadStatus?: CallStatus;
  quickNotePresets?: string[];
  autoIncrementCallOnDial?: boolean;
  duplicateCheckMode?: "allow" | "warn" | "skip";
  defaultImportMode?: "append" | "replace";
  autoFillCurrentMonthIfMissing?: boolean;
  cutoffHour?: number; // 24-hour format: default 23 for 11:00 PM cutoff
  enableCutoffRollover?: boolean;
}

export interface WorkspacePage {
  id: string; // e.g. "page-default", "page-1729752000"
  name: string; // e.g. "Main Workspace", "Real Estate Q4"
  description?: string;
  color?: "indigo" | "blue" | "emerald" | "purple" | "rose" | "amber" | "teal" | "slate";
  customColor?: string; // Optional custom hex color e.g. "#6366F1", "#10B981"
  isDefault?: boolean;
  order?: number;
  createdAt: string;
  updatedAt: string;
}

export interface UploadedFileRecord {
  id: string;
  fileName: string;
  uploadDate: string; // YYYY-MM-DD e.g. "2026-09-21"
  uploadedAt: string; // ISO string
  fileSize?: string;
  fileType: "xlsx" | "xls" | "xml" | "csv" | "text" | "manual";
  recordCount: number;
  pageId?: string; // Associated WorkspacePage ID
}

export type PaymentMethod = "Card" | "Bank Transfer" | "UPI" | "Cash";
export type CompletionStatus = "Pending" | "Completed" | "Refunded";

export interface Lead {
  id: string;
  paymentReceipt?: string;
  proof?: string;
  month: string;
  lostYearOrMonth?: string; // Kept for backward compatibility
  fullName: string;
  phoneNumber: string;
  email: string;
  city: string;
  status: CallStatus;
  notes: string;
  manualNotes?: string; // Additional column for manually typed notes for each client
  handlerId?: string; // e.g. "handler-helen"
  handlerName?: string; // e.g. "Helen", "Athira", "Anjana"
  assignmentCategory?: "unassigned" | "assigned"; // Explicit status category separating unassigned vs assigned
  assignedAt?: string; // ISO timestamp when handler was assigned/updated
  reportDate?: string; // YYYY-MM-DD effective daily report date (accounting for 11 PM cutoff)
  isPostCutoffRollover?: boolean; // Flag indicating assignment was processed after 11 PM cutoff
  createdAt: string;
  updatedAt?: string;
  lastDialedAt?: string;
  callCount?: number;
  uploadDate?: string; // YYYY-MM-DD (e.g. "2026-09-21")
  uploadedFileName?: string; // Name of file uploaded from
  fileId?: string; // Reference to UploadedFileRecord
  paymentDate?: string; // YYYY-MM-DD format for payment processing date
  paymentMethod?: PaymentMethod | string; // "Card" | "Bank Transfer" | "UPI" | "Cash"
  completionStatus?: CompletionStatus; // "Pending" | "Completed" | "Refunded"
  completedAt?: string; // ISO timestamp when marked as Completed
  pageId?: string; // Associated WorkspacePage ID
}

export type StatusFilter = "all" | CallStatus | "Integrated";

export interface ExtractionStats {
  total: number;
  attended: number;
  requiresFollowUp: number;
  pending: number;
  noAnswer: number;
}

export interface AdminCredentials {
  userId: string;
  password: string;
  recoveryEmail: string;
  lastUpdated?: string;
}

export interface SheetChangeRecord {
  id: string;
  leadId: string;
  leadName: string;
  fileId?: string;
  fileName?: string; // Original spreadsheet name, e.g. "Sam.xlsx" or "Jerin.xlsx"
  date: string; // YYYY-MM-DD local date
  timestamp: string; // ISO string
  changeType:
    | "assignment"
    | "status"
    | "manual_notes"
    | "notes"
    | "month"
    | "import"
    | "dial"
    | "payment"
    | "completion"
    | "edit";
  summary: string; // Human-readable change summary (e.g. "Assigned to Helen", "Status changed to Interested")
  field?: string;
  oldValue?: string;
  newValue?: string;
  handlerName?: string;
}

export * from "./types/rbac";

export interface PricingTierConfig {
  id: "trial" | "standard" | "enterprise";
  badge: string;
  popularBadge?: string;
  isPopular?: boolean;
  name: string;
  description: string;
  priceMonthly: string;
  priceAnnual: string;
  periodTextMonthly: string;
  periodTextAnnual: string;
  features: string[];
  ctaText: string;
  ctaAction: "trial" | "stripe_standard" | "stripe_enterprise" | "contact";
}

export interface PricingSettings {
  sectionBadge: string;
  mainHeadline: string;
  subheadline: string;
  monthlyToggleLabel: string;
  annualToggleLabel: string;
  annualDiscountNote?: string;
  tiers: PricingTierConfig[];
  updatedAt?: string;
  updatedBy?: string;
}

export const DEFAULT_PRICING_SETTINGS: PricingSettings = {
  sectionBadge: "Transparent Pricing",
  mainHeadline: "Predictable Plans for Scaling Sales Teams",
  subheadline: "Choose a plan based on your team size and monthly ingestion volume. Every plan includes the full RLS database.",
  monthlyToggleLabel: "Monthly Billing",
  annualToggleLabel: "Annual (2 Months Free)",
  annualDiscountNote: "Save up to 20% with annual plans",
  tiers: [
    {
      id: "trial",
      badge: "Evaluation",
      isPopular: false,
      name: "60-Day Free Trial",
      description: "For sales teams piloting automated ingestion",
      priceMonthly: "$0",
      priceAnnual: "$0",
      periodTextMonthly: "for 60 days",
      periodTextAnnual: "for 60 days",
      features: [
        "Up to 5,000 lead records",
        "5 team handlers",
        "Excel & CSV ingestion",
        "Chunked daily PDF reports",
        "No credit card required upfront",
      ],
      ctaText: "Start Free Trial Now",
      ctaAction: "trial",
    },
    {
      id: "standard",
      badge: "Growing Operations",
      popularBadge: "Most Popular",
      isPopular: true,
      name: "Standard Organization",
      description: "For active sales branches and outbound teams",
      priceMonthly: "$149",
      priceAnnual: "$124",
      periodTextMonthly: "/ month",
      periodTextAnnual: "/ month",
      features: [
        "Up to 50,000 lead records",
        "15 staff handlers & manager seats",
        "Row-Level Security PostgreSQL",
        "2FA OTP credential governance",
        "Daily automated backup sync",
      ],
      ctaText: "Activate Standard with Stripe",
      ctaAction: "stripe_standard",
    },
    {
      id: "enterprise",
      badge: "Scale & Governance",
      isPopular: false,
      name: "Enterprise Platform",
      description: "For national brokerages and call center operations",
      priceMonthly: "$499",
      priceAnnual: "$415",
      periodTextMonthly: "/ month",
      periodTextAnnual: "/ month",
      features: [
        "250,000+ lead records",
        "100+ staff accounts & custom roles",
        "Custom subdomain / domain binding",
        "Real-time webhook notifications",
        "Dedicated account representative",
      ],
      ctaText: "Contact Enterprise Sales",
      ctaAction: "stripe_enterprise",
    },
  ],
};
