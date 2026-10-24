import { HandlerRecord, AppSettings } from "../types";

export const DEFAULT_HANDLERS: HandlerRecord[] = [
  {
    id: "handler-helen",
    name: "Helen",
    color: "purple",
    email: "helen@company.com",
    role: "Senior Lead Specialist",
    isDefault: false,
    createdAt: new Date().toISOString(),
  },
  {
    id: "handler-athira",
    name: "Athira",
    color: "emerald",
    email: "athira@company.com",
    role: "Client Engagement Handler",
    isDefault: false,
    createdAt: new Date().toISOString(),
  },
  {
    id: "handler-anjana",
    name: "Anjana",
    color: "blue",
    email: "anjana@company.com",
    role: "Accounts & Recovery Handler",
    isDefault: false,
    createdAt: new Date().toISOString(),
  },
];

export const DEFAULT_APP_SETTINGS: AppSettings = {
  handlers: DEFAULT_HANDLERS,
  activeFrontPageHandler: "Helen", // Default front page handler
  defaultNewLeadHandler: "unassigned", // Leave newly uploaded leads unassigned by default
  softwareTitle: "Lead & Payment Tracker",
  companyName: "Client Operations Team",
  tableDensity: "comfortable",
  dateFormat: "MMM D, YYYY",
  defaultLeadStatus: "Pending Call",
  quickNotePresets: [
    "Called - left voicemail",
    "Spoke with client - requested callback",
    "Payment verified & proof confirmed",
    "Call back tomorrow morning",
    "Client requested invoice / details via email",
    "Wrong number or invalid contact",
  ],
  autoIncrementCallOnDial: true,
  duplicateCheckMode: "warn",
  defaultImportMode: "append",
  autoFillCurrentMonthIfMissing: true,
  cutoffHour: 23,
  enableCutoffRollover: false, // 11 PM cutoff time removed - all daily assignments compile without time restrictions
};

export const SETTINGS_STORAGE_KEY = "lead_tracker_settings_v1";

export function getHandlerColorClasses(color?: string) {
  switch (color) {
    case "purple":
      return {
        bg: "bg-purple-50",
        text: "text-purple-700",
        border: "border-purple-200",
        dot: "bg-purple-500",
        badge: "bg-purple-100 text-purple-800 border-purple-200",
        ring: "focus:ring-purple-500",
        avatar: "bg-purple-600 text-white",
      };
    case "emerald":
      return {
        bg: "bg-emerald-50",
        text: "text-emerald-700",
        border: "border-emerald-200",
        dot: "bg-emerald-500",
        badge: "bg-emerald-100 text-emerald-800 border-emerald-200",
        ring: "focus:ring-emerald-500",
        avatar: "bg-emerald-600 text-white",
      };
    case "blue":
      return {
        bg: "bg-blue-50",
        text: "text-blue-700",
        border: "border-blue-200",
        dot: "bg-blue-500",
        badge: "bg-blue-100 text-blue-800 border-blue-200",
        ring: "focus:ring-blue-500",
        avatar: "bg-blue-600 text-white",
      };
    case "amber":
      return {
        bg: "bg-amber-50",
        text: "text-amber-700",
        border: "border-amber-200",
        dot: "bg-amber-500",
        badge: "bg-amber-100 text-amber-800 border-amber-200",
        ring: "focus:ring-amber-500",
        avatar: "bg-amber-600 text-white",
      };
    case "rose":
      return {
        bg: "bg-rose-50",
        text: "text-rose-700",
        border: "border-rose-200",
        dot: "bg-rose-500",
        badge: "bg-rose-100 text-rose-800 border-rose-200",
        ring: "focus:ring-rose-500",
        avatar: "bg-rose-600 text-white",
      };
    case "indigo":
      return {
        bg: "bg-indigo-50",
        text: "text-indigo-700",
        border: "border-indigo-200",
        dot: "bg-indigo-500",
        badge: "bg-indigo-100 text-indigo-800 border-indigo-200",
        ring: "focus:ring-indigo-500",
        avatar: "bg-indigo-600 text-white",
      };
    case "teal":
      return {
        bg: "bg-teal-50",
        text: "text-teal-700",
        border: "border-teal-200",
        dot: "bg-teal-500",
        badge: "bg-teal-100 text-teal-800 border-teal-200",
        ring: "focus:ring-teal-500",
        avatar: "bg-teal-600 text-white",
      };
    default:
      return {
        bg: "bg-slate-50",
        text: "text-slate-700",
        border: "border-slate-200",
        dot: "bg-slate-500",
        badge: "bg-slate-100 text-slate-800 border-slate-200",
        ring: "focus:ring-slate-500",
        avatar: "bg-slate-600 text-white",
      };
  }
}
