import React, { useState, useEffect, useMemo, useRef } from "react";
import { RotateCcw } from "lucide-react";
import { Header } from "./components/Header";
import { UploadSection, UploadFileInfo, ExtractedFileResult } from "./components/UploadSection";
import { DateTabNavigation } from "./components/DateTabNavigation";
import { TodayHandlersWorkload } from "./components/TodayHandlersWorkload";
import { LeadWorkspaceTabs, parseWorkspaceTab } from "./components/LeadWorkspaceTabs";
import { LeadFilters } from "./components/LeadFilters";
import { LeadTable } from "./components/LeadTable";
import { CallLogModal } from "./components/CallLogModal";
import { LeadModal } from "./components/LeadModal";
import { DeleteConfirmModal } from "./components/DeleteConfirmModal";
import { SettingsPage } from "./components/SettingsPage";
import { ShortcutsPage } from "./components/ShortcutsPage";
import { PdfReportModal } from "./components/PdfReportModal";
import { CompletedReportsModal } from "./components/CompletedReportsModal";
import { SaaSLandingPage } from "./components/SaaSLandingPage";
import { SuperAdminPortal } from "./components/SuperAdminPortal";
import { SuperAdminAuthModal } from "./components/SuperAdminAuthModal";
import { MobileAppShell } from "./components/mobile/MobileAppShell";
import { PageModal, PageModalMode } from "./components/PageModal";
import { DEFAULT_SAMPLE_LEADS, DEFAULT_UPLOADED_FILES } from "./data/sampleLeads";
import { DEFAULT_APP_SETTINGS, SETTINGS_STORAGE_KEY } from "./data/handlerDefaults";
import { exportLeadsToCsv, exportLeadsToExcel } from "./utils/parser";
import { Lead, CallStatus, StatusFilter, AppSettings, UploadedFileRecord, CompletionStatus, WorkspacePage } from "./types";
import { ShortcutActionId } from "./types/shortcuts";
import {
  SHORTCUT_DEFINITIONS,
  loadCustomShortcuts,
  saveCustomShortcuts,
  resetAllShortcuts,
  isTargetEditable,
  matchEventToShortcut,
  formatKeyDisplay,
} from "./utils/shortcutManager";
import {
  loadWorkspacePages,
  saveWorkspacePagesLocally,
  getActiveWorkspacePageId,
  saveActiveWorkspacePageIdLocally,
  createBlankPage,
  duplicateWorkspacePage,
  DEFAULT_PAGE,
} from "./utils/pageManager";
import { getLocalDateString, DEFAULT_CUTOFF_HOUR, getReportDateForTimestamp } from "./utils/dateUtils";
import { isLeadAssignedToHandler } from "./utils/pdfGenerator";
import { recordLeadChange } from "./utils/changeLogUtils";
import { apiClient } from "./services/apiClient";
import { realtimeSync, RealtimeTransport } from "./services/realtimeSync";
import {
  testConnection,
  subscribeToAuth,
  signInWithGoogle,
  logOut,
  subscribeToFirestoreLeads,
  subscribeToFirestoreFiles,
  subscribeToFirestoreSettings,
  subscribeToFirestorePages,
  savePageToFirestore,
  deletePageFromFirestore,
  saveLeadToFirestore,
  patchLeadInFirestore,
  deleteLeadFromFirestore,
  batchDeleteLeadsFromFirestore,
  batchSaveLeadsToFirestore,
  saveUploadedFileToFirestore,
  deleteUploadedFileFromFirestore,
  saveSettingsToFirestore,
  seedInitialFirestoreIfEmpty,
} from "./services/firebase";
import { LoginPage } from "./components/LoginPage";
import {
  isAppAuthenticated,
  setAppAuthenticated,
  getAdminCredentials,
  saveAdminCredentialsLocally,
  syncAdminCredentialsFromServer,
  getRbacConfig,
  saveRbacConfigLocally,
  getCurrentAuthUser,
} from "./utils/authService";
import { RBACConfig, UserAccount } from "./types/rbac";
import type { User } from "firebase/auth";

const STORAGE_KEY = "lead_tracker_data_v2";
const FILES_STORAGE_KEY = "uploaded_files_data_v2";
const WORKSPACE_SESSION_STORAGE_KEY = "lead_tracker_workspace_session_v1";

interface WorkspaceSessionState {
  activeWorkspaceTab?: string;
  activeFileFilter?: string;
  activeDateFilter?: string;
  statusFilter?: StatusFilter;
  selectedYear?: string;
  selectedCity?: string;
  selectedHandler?: string;
  searchQuery?: string;
  sortBy?: string;
}

function loadSavedSessionState(): WorkspaceSessionState {
  try {
    const raw = localStorage.getItem(WORKSPACE_SESSION_STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (parsed && typeof parsed === "object") {
        return parsed;
      }
    }
  } catch (err) {
    console.warn("Notice: Failed to load workspace session state:", err);
  }
  return {};
}

export default function App() {
  // Authentication gate state
  const [isAuthenticated, setIsAuthenticated] = useState<boolean>(() => isAppAuthenticated());

  // Workspace saved session state
  const [savedSession] = useState<WorkspaceSessionState>(() => loadSavedSessionState());
  const isSessionRestored = useRef<boolean>(
    Boolean(
      (savedSession.activeWorkspaceTab && savedSession.activeWorkspaceTab !== "all") ||
      (savedSession.activeFileFilter && savedSession.activeFileFilter !== "all") ||
      (savedSession.activeDateFilter && savedSession.activeDateFilter !== "all") ||
      (savedSession.statusFilter && savedSession.statusFilter !== "all") ||
      (savedSession.selectedYear && savedSession.selectedYear !== "all") ||
      (savedSession.selectedCity && savedSession.selectedCity !== "all") ||
      (savedSession.selectedHandler && savedSession.selectedHandler !== "all") ||
      (savedSession.searchQuery && savedSession.searchQuery.trim() !== "") ||
      (savedSession.sortBy && savedSession.sortBy !== "default")
    )
  );

  // Active Authenticated Account & RBAC Configuration
  const [rbacConfig, setRbacConfig] = useState<RBACConfig>(() => getRbacConfig());
  const [currentAuthUser, setCurrentAuthUser] = useState<UserAccount>(() => getCurrentAuthUser());

  // Navigation state: "tracker" | "settings" | "shortcuts" | "landing" | "super_admin"
  const [currentPage, setCurrentPage] = useState<
    "tracker" | "settings" | "shortcuts" | "landing" | "super_admin"
  >(() => {
    try {
      const params = new URLSearchParams(window.location.search);
      const portal = params.get("portal");
      if (portal === "super_admin") return "super_admin";
      if (portal === "tracker" || portal === "workspace") return "tracker";
    } catch {}
    return "landing";
  });

  // Super Admin Authentication Challenge Modal state
  const [isSuperAdminAuthModalOpen, setIsSuperAdminAuthModalOpen] = useState(false);

  // Mobile-first responsive auto-switch and view mode preference
  const [isMobileScreen, setIsMobileScreen] = useState<boolean>(() => {
    if (typeof window === "undefined") return false;
    return window.innerWidth < 768;
  });
  const [viewModeOverride, setViewModeOverride] = useState<"auto" | "mobile" | "desktop">("auto");

  useEffect(() => {
    const handleResize = () => {
      setIsMobileScreen(window.innerWidth < 768);
    };
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, []);

  const isMobileView = viewModeOverride === "mobile" || (viewModeOverride === "auto" && isMobileScreen);

  // Server & Database connectivity status
  const [serverStatus, setServerStatus] = useState<"connected" | "connecting" | "offline">("connecting");
  const [firebaseStatus, setFirebaseStatus] = useState<"connected" | "connecting" | "offline">("connecting");
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [realtimeTransport, setRealtimeTransport] = useState<RealtimeTransport>("disconnected");
  const [activeSessions, setActiveSessions] = useState<number>(1);
  const isInitialMount = useRef(true);
  const isRemoteUpdateRef = useRef(false);
  const clientIdRef = useRef<string>(realtimeSync.getClientId());

  // Uploaded Files State (Grouped by Day sections: Today, Tomorrow, Past)
  const [uploadedFiles, setUploadedFiles] = useState<UploadedFileRecord[]>(() => {
    try {
      const saved = localStorage.getItem(FILES_STORAGE_KEY);
      if (saved !== null) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed)) {
          return parsed;
        }
      }
    } catch (e) {
      console.error("Failed to read files from localStorage:", e);
    }
    return DEFAULT_UPLOADED_FILES;
  });

  // Categorized Workspace Tabs state: "all" | "unassigned" | `file-${fileId}`
  const [activeWorkspaceTab, setActiveWorkspaceTab] = useState<string>(
    () => savedSession.activeWorkspaceTab || "all"
  );

  // Date section filter and File filter
  const [activeDateFilter, setActiveDateFilter] = useState<string>(
    () => savedSession.activeDateFilter || "all"
  );
  const [activeFileFilter, setActiveFileFilter] = useState<string>(
    () => savedSession.activeFileFilter || "all"
  );
  const [presetUploadDate, setPresetUploadDate] = useState<string | undefined>(undefined);

  // System & Application Settings (Handlers, Ingestion, Defaults, UI)
  const [settings, setSettings] = useState<AppSettings>(() => {
    try {
      const saved = localStorage.getItem(SETTINGS_STORAGE_KEY);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (parsed && Array.isArray(parsed.handlers)) {
          return {
            ...DEFAULT_APP_SETTINGS,
            ...parsed,
          };
        }
      }
    } catch (e) {
      console.error("Failed to read settings from localStorage:", e);
    }
    return DEFAULT_APP_SETTINGS;
  });

  // Synchronize document title
  useEffect(() => {
    if (settings.softwareTitle) {
      document.title = settings.softwareTitle;
    }
  }, [settings.softwareTitle]);

  // Initialize leads from localStorage or default sample
  const [leads, setLeads] = useState<Lead[]>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved !== null) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed)) {
          return parsed.map((item: Lead) => {
            const isAssigned = Boolean(
              item.handlerName &&
                item.handlerName.trim() !== "" &&
                item.handlerName.toLowerCase() !== "unassigned" &&
                item.handlerName.toLowerCase() !== "not assigned" &&
                item.handlerName.toLowerCase() !== "none" &&
                item.assignmentCategory !== "unassigned"
            );
            return {
              ...item,
              handlerName: isAssigned ? item.handlerName : "",
              handlerId: isAssigned ? item.handlerId : undefined,
              status: (item.status as string) === "Attended" ? "Interested" : item.status,
              assignmentCategory: (isAssigned ? "assigned" : "unassigned") as "assigned" | "unassigned",
              isPostCutoffRollover: false,
              assignedAt: isAssigned ? item.assignedAt : undefined,
              reportDate: isAssigned ? (item.assignedAt ? item.assignedAt.slice(0, 10) : item.reportDate) : undefined,
            };
          });
        }
      }
    } catch (e) {
      console.error("Failed to read from localStorage:", e);
    }
    return DEFAULT_SAMPLE_LEADS;
  });

  // Unlimited Workspace Pages State
  const [pages, setPages] = useState<WorkspacePage[]>(() => loadWorkspacePages());
  const [activePageId, setActivePageId] = useState<string>(() => getActiveWorkspacePageId(pages));
  const [pageModalState, setPageModalState] = useState<{
    isOpen: boolean;
    mode: PageModalMode;
    targetPage: WorkspacePage | null;
  }>({
    isOpen: false,
    mode: "create",
    targetPage: null,
  });

  const activePage = useMemo(() => {
    return pages.find((p) => p.id === activePageId) || pages[0] || DEFAULT_PAGE;
  }, [pages, activePageId]);

  useEffect(() => {
    saveWorkspacePagesLocally(pages);
  }, [pages]);

  useEffect(() => {
    saveActiveWorkspacePageIdLocally(activePageId);
  }, [activePageId]);

  // Data scoped to active workspace page
  const currentPageLeads = useMemo(() => {
    return leads.filter((l) => (l.pageId || "page-default") === activePageId);
  }, [leads, activePageId]);

  const currentPageFiles = useMemo(() => {
    return uploadedFiles.filter((f) => (f.pageId || "page-default") === activePageId);
  }, [uploadedFiles, activePageId]);

  const leadCountsByPage = useMemo(() => {
    const counts: Record<string, number> = {};
    for (const p of pages) {
      counts[p.id] = 0;
    }
    for (const l of leads) {
      const pid = l.pageId || "page-default";
      counts[pid] = (counts[pid] || 0) + 1;
    }
    return counts;
  }, [pages, leads]);

  // Initial Full-Stack Server Hydration
  useEffect(() => {
    let isMounted = true;

    async function initFullStackData() {
      try {
        const health = await apiClient.checkHealth();
        if (!isMounted) return;
        if (health.status === "ok") {
          setServerStatus("connected");
        }

        // Fetch server leads
        try {
          const remoteLeads = await apiClient.getLeads();
          if (isMounted && Array.isArray(remoteLeads)) {
            isRemoteUpdateRef.current = true;
            const sanitized = remoteLeads.map((item: Lead) => {
              const isAssigned = Boolean(
                item.handlerName &&
                  item.handlerName.trim() !== "" &&
                  item.handlerName.toLowerCase() !== "unassigned" &&
                  item.handlerName.toLowerCase() !== "not assigned" &&
                  item.handlerName.toLowerCase() !== "none" &&
                  item.assignmentCategory !== "unassigned"
              );
              return {
                ...item,
                handlerName: isAssigned ? item.handlerName : "",
                handlerId: isAssigned ? item.handlerId : undefined,
                status: (item.status as string) === "Attended" ? "Interested" : item.status,
                assignmentCategory: (isAssigned ? "assigned" : "unassigned") as "assigned" | "unassigned",
                isPostCutoffRollover: false,
                assignedAt: isAssigned ? item.assignedAt : undefined,
                reportDate: isAssigned ? (item.assignedAt ? item.assignedAt.slice(0, 10) : item.reportDate) : undefined,
              };
            });
            setLeads(sanitized);
            try {
              localStorage.setItem(STORAGE_KEY, JSON.stringify(sanitized));
            } catch (_) {}
          }
        } catch (leadErr) {
          console.warn("Notice: Initial remote leads fetch fallback to local:", leadErr);
        }

        // Fetch server uploaded files
        try {
          const remoteFiles = await apiClient.getFiles();
          if (isMounted && Array.isArray(remoteFiles)) {
            isRemoteUpdateRef.current = true;
            setUploadedFiles(remoteFiles);
          }
        } catch (filesErr) {
          console.warn("Notice: Initial remote files fetch fallback to local:", filesErr);
        }

        // Fetch server settings
        try {
          const remoteSettings = await apiClient.getSettings();
          if (isMounted && remoteSettings && Array.isArray(remoteSettings.handlers)) {
            setSettings((prev) => ({ ...prev, ...remoteSettings }));
          }
        } catch (settingsErr) {
          console.warn("Notice: Initial remote settings fetch fallback to local:", settingsErr);
        }

        // Fetch server custom shortcuts
        try {
          const remoteShortcuts = await apiClient.getShortcuts();
          if (isMounted && remoteShortcuts && typeof remoteShortcuts === "object" && Object.keys(remoteShortcuts).length > 0) {
            setShortcuts((prev) => ({ ...prev, ...remoteShortcuts }));
          }
        } catch (scErr) {
          console.warn("Notice: Initial remote shortcuts fetch fallback to local:", scErr);
        }

        // Sync admin credentials info from server
        try {
          await syncAdminCredentialsFromServer();
        } catch (credErr) {
          console.warn("Notice: Initial remote credentials fetch fallback to local:", credErr);
        }

        // Sync remote RBAC configuration from server
        try {
          const remoteRbac = await apiClient.getRbac();
          if (isMounted && remoteRbac && remoteRbac.success && remoteRbac.rbac) {
            setRbacConfig(remoteRbac.rbac);
            saveRbacConfigLocally(remoteRbac.rbac);
          }
        } catch (rbacErr) {
          console.warn("Notice: Initial remote RBAC fetch fallback to local:", rbacErr);
        }
      } catch {
        if (isMounted) {
          setServerStatus("offline");
        }
      } finally {
        isInitialMount.current = false;
      }
    }

    initFullStackData();

    return () => {
      isMounted = false;
    };
  }, []);

  // Google Cloud Firestore Real-Time Synchronization & Authentication
  useEffect(() => {
    let isMounted = true;

    // 1. Connection probe to Firestore
    testConnection().then((connected) => {
      if (isMounted) {
        setFirebaseStatus(connected ? "connected" : "offline");
      }
    });

    // 2. Auth listener for Google account login state
    const unsubAuth = subscribeToAuth((user) => {
      if (isMounted) {
        setCurrentUser(user);
      }
    });

    // 3. Auto-seed initial defaults if Firestore collections are empty
    seedInitialFirestoreIfEmpty(
      DEFAULT_SAMPLE_LEADS,
      DEFAULT_UPLOADED_FILES,
      DEFAULT_APP_SETTINGS
    );

    // 4. Real-time Firestore snapshot listener for leads
    const unsubFirestoreLeads = subscribeToFirestoreLeads(
      (remoteLeads) => {
        if (!isMounted) return;
        if (Array.isArray(remoteLeads)) {
          isRemoteUpdateRef.current = true;
          setLeads(remoteLeads);
          setFirebaseStatus("connected");
        }
      },
      (err) => {
        console.warn("Notice: Firestore leads sync status:", err);
      }
    );

    // 5. Real-time Firestore snapshot listener for uploaded files
    const unsubFirestoreFiles = subscribeToFirestoreFiles(
      (remoteFiles) => {
        if (!isMounted) return;
        if (Array.isArray(remoteFiles)) {
          isRemoteUpdateRef.current = true;
          setUploadedFiles(remoteFiles);
          setFirebaseStatus("connected");
        }
      },
      (err) => {
        console.warn("Notice: Firestore files sync status:", err);
      }
    );

    // 6. Real-time Firestore snapshot listener for global settings
    const unsubFirestoreSettings = subscribeToFirestoreSettings(
      (remoteSettings) => {
        if (!isMounted) return;
        if (remoteSettings && Array.isArray(remoteSettings.handlers)) {
          isRemoteUpdateRef.current = true;
          setSettings((prev) => ({ ...prev, ...remoteSettings }));
          setFirebaseStatus("connected");
        }
      },
      (err) => {
        console.warn("Notice: Firestore settings sync status:", err);
      }
    );

    // 7. Real-time Firestore snapshot listener for unlimited pages
    const unsubFirestorePages = subscribeToFirestorePages(
      (remotePages) => {
        if (!isMounted) return;
        if (Array.isArray(remotePages) && remotePages.length > 0) {
          setPages(remotePages);
        }
      },
      (err) => {
        console.warn("Notice: Firestore pages sync status:", err);
      }
    );

    return () => {
      isMounted = false;
      unsubAuth();
      unsubFirestoreLeads();
      unsubFirestoreFiles();
      unsubFirestoreSettings();
      unsubFirestorePages();
    };
  }, []);

  // Real-Time Multi-Device WebSocket Synchronization (with SSE & Polling Fallbacks)
  useEffect(() => {
    realtimeSync.setClientId(clientIdRef.current);
    realtimeSync.init();

    const unsubStatus = realtimeSync.onStatusChange((status, transport, sessions) => {
      setServerStatus(status);
      setRealtimeTransport(transport);
      if (typeof sessions === "number" && sessions > 0) {
        setActiveSessions(sessions);
      }
    });

    const unsubEvents = realtimeSync.subscribe((event) => {
      // Prevent loopback if event originated from this client session
      if (event.sourceClientId && event.sourceClientId === clientIdRef.current) {
        return;
      }

      if (event.type === "init") {
        if (Array.isArray(event.leads)) {
          isRemoteUpdateRef.current = true;
          setLeads(event.leads);
        }
        if (Array.isArray(event.files)) {
          isRemoteUpdateRef.current = true;
          setUploadedFiles(event.files);
        }
        if (event.settings && Array.isArray(event.settings.handlers)) {
          isRemoteUpdateRef.current = true;
          setSettings((prev) => ({ ...prev, ...event.settings }));
        }
        if (event.shortcuts && typeof event.shortcuts === "object") {
          setShortcuts((prev) => ({ ...prev, ...event.shortcuts }));
        }
        if (event.rbac) {
          setRbacConfig(event.rbac);
          saveRbacConfigLocally(event.rbac);
        }
        if (typeof event.activeSessions === "number") {
          setActiveSessions(event.activeSessions);
        }
        setServerStatus("connected");
        return;
      }

      if (event.type === "lead_patched") {
        if (event.leadId) {
          isRemoteUpdateRef.current = true;
          setLeads((prev) =>
            prev.map((l) =>
              l.id === event.leadId
                ? event.updatedLead
                  ? { ...l, ...event.updatedLead }
                  : { ...l, ...(event.updates || {}) }
                : l
            )
          );
          setServerStatus("connected");
        }
        return;
      }

      if (event.type === "lead_deleted") {
        const idToDelete = event.leadId || event.deletedLeadId;
        isRemoteUpdateRef.current = true;
        if (Array.isArray(event.leads)) {
          setLeads(event.leads);
        } else if (idToDelete) {
          setLeads((prev) => prev.filter((l) => l.id !== idToDelete));
        }
        setServerStatus("connected");
        return;
      }

      if (event.type === "leads_deleted") {
        isRemoteUpdateRef.current = true;
        if (Array.isArray(event.leads)) {
          setLeads(event.leads);
        } else if (Array.isArray(event.deletedIds)) {
          const delSet = new Set(event.deletedIds);
          setLeads((prev) => prev.filter((l) => !delSet.has(l.id)));
        }
        setServerStatus("connected");
        return;
      }

      if (event.type === "file_deleted") {
        const fileIdToDelete = event.fileId || event.deletedFileId;
        isRemoteUpdateRef.current = true;
        if (Array.isArray(event.files)) {
          setUploadedFiles(event.files);
        } else if (fileIdToDelete) {
          setUploadedFiles((prev) => prev.filter((f) => f.id !== fileIdToDelete));
        }
        if (Array.isArray(event.leads)) {
          setLeads(event.leads);
        }
        setServerStatus("connected");
        return;
      }

      if (event.type === "leads_cleared") {
        isRemoteUpdateRef.current = true;
        setLeads([]);
        setServerStatus("connected");
        return;
      }

      if (event.type === "files_cleared") {
        isRemoteUpdateRef.current = true;
        setUploadedFiles([]);
        setServerStatus("connected");
        return;
      }

      if (event.type === "cleared_all") {
        isRemoteUpdateRef.current = true;
        setLeads([]);
        setUploadedFiles([]);
        setServerStatus("connected");
        return;
      }

      if (event.type === "leads_updated") {
        if (Array.isArray(event.leads)) {
          isRemoteUpdateRef.current = true;
          setLeads(event.leads);
          setServerStatus("connected");
        } else {
          apiClient
            .getLeads()
            .then((remoteLeads) => {
              if (Array.isArray(remoteLeads)) {
                isRemoteUpdateRef.current = true;
                setLeads(remoteLeads);
                setServerStatus("connected");
              }
            })
            .catch(() => {});
        }
        return;
      }

      if (event.type === "files_updated") {
        if (Array.isArray(event.files)) {
          isRemoteUpdateRef.current = true;
          setUploadedFiles(event.files);
        } else {
          apiClient
            .getFiles()
            .then((remoteFiles) => {
              if (Array.isArray(remoteFiles)) {
                isRemoteUpdateRef.current = true;
                setUploadedFiles(remoteFiles);
              }
            })
            .catch(() => {});
        }
        return;
      }

      if (event.type === "settings_updated") {
        if (event.settings && Array.isArray(event.settings.handlers)) {
          isRemoteUpdateRef.current = true;
          setSettings((prev) => ({ ...prev, ...event.settings }));
        } else {
          apiClient
            .getSettings()
            .then((remoteSettings) => {
              if (remoteSettings && Array.isArray(remoteSettings.handlers)) {
                isRemoteUpdateRef.current = true;
                setSettings((prev) => ({ ...prev, ...remoteSettings }));
              }
            })
            .catch(() => {});
        }
        return;
      }

      if (event.type === "shortcuts_updated") {
        if (event.shortcuts && typeof event.shortcuts === "object") {
          setShortcuts((prev) => ({ ...prev, ...event.shortcuts }));
        } else {
          apiClient
            .getShortcuts()
            .then((remoteShortcuts) => {
              if (remoteShortcuts && typeof remoteShortcuts === "object") {
                setShortcuts((prev) => ({ ...prev, ...remoteShortcuts }));
              }
            })
            .catch(() => {});
        }
        return;
      }

      if (event.type === "credentials_updated") {
        if (event.userId) {
          const current = getAdminCredentials();
          saveAdminCredentialsLocally({
            ...current,
            userId: event.userId,
            recoveryEmail: event.recoveryEmail || current.recoveryEmail,
            lastUpdated: event.lastUpdated || new Date().toISOString(),
          });
        }
        return;
      }

      if (event.type === "rbac_updated" && event.rbac) {
        setRbacConfig(event.rbac);
        saveRbacConfigLocally(event.rbac);
        return;
      }

      if (event.type === "presence_updated" && typeof event.activeSessions === "number") {
        setActiveSessions(event.activeSessions);
        return;
      }
    });

    return () => {
      unsubStatus();
      unsubEvents();
      realtimeSync.destroy();
    };
  }, []);

  // Save settings when changed (Local + Server)
  useEffect(() => {
    try {
      localStorage.setItem(SETTINGS_STORAGE_KEY, JSON.stringify(settings));
    } catch (e) {
      console.error("Failed to save settings to localStorage:", e);
    }

    if (isRemoteUpdateRef.current) {
      return;
    }

    if (!isInitialMount.current) {
      realtimeSync.syncSettings(settings).catch(() => {});
      saveSettingsToFirestore(settings).catch(() => {});
    }
  }, [settings]);

  // Save files when changed (Local + Server)
  useEffect(() => {
    try {
      localStorage.setItem(FILES_STORAGE_KEY, JSON.stringify(uploadedFiles));
    } catch (e) {
      console.error("Failed to save files to localStorage:", e);
    }

    if (isRemoteUpdateRef.current) {
      return;
    }

    if (!isInitialMount.current) {
      const handler = setTimeout(() => {
        realtimeSync.syncFiles(uploadedFiles).catch(() => {});
      }, 300);

      return () => clearTimeout(handler);
    }
  }, [uploadedFiles]);

  // Save leads when changed (Local + Server)
  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(leads));
    } catch (e) {
      console.error("Failed to save to localStorage:", e);
    }

    if (isRemoteUpdateRef.current) {
      isRemoteUpdateRef.current = false;
      return;
    }

    if (!isInitialMount.current) {
      const handler = setTimeout(() => {
        realtimeSync
          .syncLeads(leads)
          .then(() => setServerStatus("connected"))
          .catch(() => {});
      }, 300);

      return () => clearTimeout(handler);
    }
  }, [leads]);

  // Filter and search states (restored from saved session so user resumes work seamlessly)
  const [searchQuery, setSearchQuery] = useState<string>(() => savedSession.searchQuery || "");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>(() => savedSession.statusFilter || "all");
  const [selectedYear, setSelectedYear] = useState<string>(() => savedSession.selectedYear || "all");
  const [selectedCity, setSelectedCity] = useState<string>(() => savedSession.selectedCity || "all");
  const [selectedHandler, setSelectedHandler] = useState<string>(() => savedSession.selectedHandler || "all");
  const [sortBy, setSortBy] = useState<string>(() => savedSession.sortBy || "default");

  // Automatically save workspace session state across reloads and next-day continuation
  useEffect(() => {
    const sessionState: WorkspaceSessionState = {
      activeWorkspaceTab,
      activeFileFilter,
      activeDateFilter,
      statusFilter,
      selectedYear,
      selectedCity,
      selectedHandler,
      searchQuery,
      sortBy,
    };
    try {
      localStorage.setItem(WORKSPACE_SESSION_STORAGE_KEY, JSON.stringify(sessionState));
    } catch (e) {
      console.warn("Notice: Failed to save workspace session state:", e);
    }
  }, [
    activeWorkspaceTab,
    activeFileFilter,
    activeDateFilter,
    statusFilter,
    selectedYear,
    selectedCity,
    selectedHandler,
    searchQuery,
    sortBy,
  ]);

  // Selection state for batch operations (like deleting multiple leads)
  const [selectedLeadIds, setSelectedLeadIds] = useState<string[]>([]);

  // Modals state
  const [callLogLead, setCallLogLead] = useState<Lead | null>(null);
  const [isLeadModalOpen, setIsLeadModalOpen] = useState(false);
  const [editingLead, setEditingLead] = useState<Lead | null>(null);

  // PDF Report Modal state
  const [isPdfModalOpen, setIsPdfModalOpen] = useState(false);
  const [pdfReportDate, setPdfReportDate] = useState<string | undefined>(undefined);
  const [pdfReportFileId, setPdfReportFileId] = useState<string | undefined>(undefined);
  const [pdfSelectedLeadIds, setPdfSelectedLeadIds] = useState<string[] | null>(null);

  const handleOpenPdfReport = (targetDate?: string, targetFileId?: string) => {
    if (targetDate === "selected") {
      setPdfSelectedLeadIds(selectedLeadIds.length > 0 ? selectedLeadIds : null);
      setPdfReportDate("all");
      setPdfReportFileId(targetFileId);
    } else {
      setPdfSelectedLeadIds(null);
      setPdfReportDate(targetDate || getLocalDateString(0));
      setPdfReportFileId(targetFileId);
    }
    setIsPdfModalOpen(true);
  };

  // Dedicated Weekly & Monthly Completed Reports Modal state
  const [isCompletedReportsOpen, setIsCompletedReportsOpen] = useState(false);

  // In-App Deletion Confirmation Modal
  const [deleteConfirm, setDeleteConfirm] = useState<{
    isOpen: boolean;
    title: string;
    description: string;
    itemCount?: number;
    onConfirm: () => void;
  }>({
    isOpen: false,
    title: "",
    description: "",
    onConfirm: () => {},
  });

  // Undo / Move Notification Toast state
  const [undoToast, setUndoToast] = useState<{
    message: string;
    deletedLeads: Lead[];
    actionLabel?: string;
    onAction?: () => void;
  } | null>(null);
  const undoTimerRef = useRef<any>(null);

  // Extract unique available months/years and cities for dropdown filters scoped to active workspace
  const availableYears = useMemo(() => {
    const set = new Set<string>();
    currentPageLeads.forEach((l) => {
      const m = l.month || l.lostYearOrMonth;
      if (m && m !== "Not specified") {
        set.add(m);
      }
    });
    return Array.from(set).sort();
  }, [currentPageLeads]);

  const availableCities = useMemo(() => {
    const set = new Set<string>();
    currentPageLeads.forEach((l) => {
      if (l.city && l.city !== "Unknown") {
        set.add(l.city);
      }
    });
    return Array.from(set).sort();
  }, [currentPageLeads]);

  // Filtered & Sorted Leads scoped to active workspace page
  const filteredLeads = useMemo(() => {
    const { fileId: tabFileId, section: tabSection } = parseWorkspaceTab(activeWorkspaceTab);
    const effectiveFileId =
      tabFileId !== "all"
        ? tabFileId
        : activeFileFilter !== "all"
        ? activeFileFilter
        : null;

    return currentPageLeads
      .filter((lead) => {
        // Dedicated Excel sheet scoping (tracks each upload by filename / fileId)
        if (effectiveFileId) {
          const matchingFile = currentPageFiles.find((f) => f.id === effectiveFileId);
          const isFileMatch =
            lead.fileId === effectiveFileId ||
            (matchingFile &&
              (lead.uploadedFileName === matchingFile.fileName || lead.fileId === matchingFile.id));
          if (!isFileMatch) {
            return false;
          }
        }

        // Dedicated Section filtering: Main List vs Unassigned List vs Assigned Section vs Interested Section
        if (tabSection === "unassigned") {
          const isAssigned = isLeadAssignedToHandler(lead, settings.handlers);
          if (isAssigned) {
            return false;
          }
        } else if (tabSection === "assigned") {
          const isAssigned = isLeadAssignedToHandler(lead, settings.handlers);
          if (!isAssigned) {
            return false;
          }
        } else if (tabSection === "interested") {
          if (lead.status !== "Interested") {
            return false;
          }
        }

        // Status filter
        if (statusFilter === "Integrated") {
          const isIntegrated = Boolean(
            lead.fileId || lead.uploadedFileName || lead.paymentReceipt || lead.proof
          );
          if (!isIntegrated) {
            return false;
          }
        } else if (statusFilter !== "all" && lead.status !== statusFilter) {
          return false;
        }

        // Year / Month filter
        const currentMonth = lead.month || lead.lostYearOrMonth;
        if (selectedYear !== "all" && currentMonth !== selectedYear) {
          return false;
        }

        // City filter
        if (selectedCity !== "all" && lead.city !== selectedCity) {
          return false;
        }

        // Handler filter
        if (selectedHandler && selectedHandler !== "all") {
          const handlerVal = lead.handlerName || "Unassigned";
          if (handlerVal.toLowerCase() !== selectedHandler.toLowerCase()) {
            return false;
          }
        }

        // Upload Date Filter (Day section)
        if (activeDateFilter !== "all") {
          const leadDate = lead.uploadDate || lead.createdAt?.slice(0, 10);
          if (leadDate !== activeDateFilter) {
            return false;
          }
        }

        // Search query across all fields (receipt, proof, month, name, phone, email, city, notes, handler)
        if (searchQuery.trim()) {
          const q = searchQuery.toLowerCase();
          const matchReceipt = lead.paymentReceipt?.toLowerCase().includes(q);
          const matchProof = lead.proof?.toLowerCase().includes(q);
          const matchMonth = (lead.month || lead.lostYearOrMonth)?.toLowerCase().includes(q);
          const matchName = lead.fullName?.toLowerCase().includes(q);
          const matchPhone = lead.phoneNumber?.toLowerCase().includes(q);
          const matchEmail = lead.email?.toLowerCase().includes(q);
          const matchCity = lead.city?.toLowerCase().includes(q);
          const matchHandler = lead.handlerName?.toLowerCase().includes(q);
          const matchNotes = lead.notes?.toLowerCase().includes(q);
          const matchManualNotes = lead.manualNotes?.toLowerCase().includes(q);

          if (
            !matchReceipt &&
            !matchProof &&
            !matchMonth &&
            !matchName &&
            !matchPhone &&
            !matchEmail &&
            !matchCity &&
            !matchHandler &&
            !matchNotes &&
            !matchManualNotes
          ) {
            return false;
          }
        }

        return true;
      })
      .sort((a, b) => {
        switch (sortBy) {
          case "name-asc":
            return a.fullName.localeCompare(b.fullName);
          case "name-desc":
            return b.fullName.localeCompare(a.fullName);
          case "lost-period":
            return (a.month || a.lostYearOrMonth || "").localeCompare(b.month || b.lostYearOrMonth || "");
          case "status":
            return a.status.localeCompare(b.status);
          case "most-called":
            return (b.callCount || 0) - (a.callCount || 0);
          default:
            return 0;
        }
      });
  }, [currentPageLeads, statusFilter, selectedYear, selectedCity, selectedHandler, activeDateFilter, activeFileFilter, activeWorkspaceTab, currentPageFiles, searchQuery, sortBy]);

  const hasActiveFilters =
    searchQuery.trim() !== "" ||
    statusFilter !== "all" ||
    selectedYear !== "all" ||
    selectedCity !== "all" ||
    selectedHandler !== "all" ||
    activeDateFilter !== "all" ||
    activeFileFilter !== "all" ||
    activeWorkspaceTab !== "all" ||
    sortBy !== "default";

  const handleResetFilters = () => {
    setSearchQuery("");
    setStatusFilter("all");
    setSelectedYear("all");
    setSelectedCity("all");
    setSelectedHandler("all");
    setActiveDateFilter("all");
    setActiveFileFilter("all");
    setActiveWorkspaceTab("all");
    setSortBy("default");
  };

  // Lead Selection
  const handleToggleSelectLead = (leadId: string) => {
    setSelectedLeadIds((prev) =>
      prev.includes(leadId) ? prev.filter((id) => id !== leadId) : [...prev, leadId]
    );
  };

  const handleToggleSelectBatch = (leadIds: string[], select: boolean) => {
    setSelectedLeadIds((prev) => {
      if (select) {
        const set = new Set(prev);
        leadIds.forEach((id) => set.add(id));
        return Array.from(set);
      } else {
        const toRemove = new Set(leadIds);
        return prev.filter((id) => !toRemove.has(id));
      }
    });
  };

  const handleSelectAll = () => {
    setSelectedLeadIds(filteredLeads.map((l) => l.id));
  };

  const handleClearSelection = () => {
    setSelectedLeadIds([]);
  };

  // Lead CRUD Operations
  const handleUpdateStatus = (leadId: string, newStatus: CallStatus) => {
    let updatedLead: Lead | undefined;
    const isInterested = newStatus === "Interested";
    const todayStr = getLocalDateString(0);

    setLeads((prev) =>
      prev.map((lead) => {
        if (lead.id === leadId) {
          updatedLead = {
            ...lead,
            status: newStatus,
            paymentDate: isInterested ? (lead.paymentDate || todayStr) : lead.paymentDate,
            paymentMethod: isInterested ? (lead.paymentMethod || "Card") : lead.paymentMethod,
            completionStatus: isInterested ? (lead.completionStatus || "Pending") : lead.completionStatus,
            updatedAt: new Date().toISOString(),
          };
          return updatedLead;
        }
        return lead;
      })
    );
    if (updatedLead) {
      recordLeadChange({
        leadId,
        leadName: (updatedLead as Lead).fullName,
        fileId: (updatedLead as Lead).fileId,
        fileName: (updatedLead as Lead).uploadedFileName,
        changeType: "status",
        summary: `Status updated to ${newStatus}${isInterested ? " (moved to Interested Clients tab)" : ""}`,
        newValue: newStatus,
        handlerName: (updatedLead as Lead).handlerName,
      });
    }

    const patchPayload: Partial<Lead> = {
      status: newStatus,
      ...(isInterested
        ? {
            paymentDate: updatedLead?.paymentDate,
            paymentMethod: updatedLead?.paymentMethod,
            completionStatus: updatedLead?.completionStatus,
          }
        : {}),
    };

    realtimeSync.patchLead(leadId, patchPayload).catch(() => {});
    patchLeadInFirestore(leadId, patchPayload, updatedLead).catch(() => {});
  };

  const handleBatchUpdateStatus = (newStatus: CallStatus) => {
    if (selectedLeadIds.length === 0) return;
    const nowIso = new Date().toISOString();
    const isInterested = newStatus === "Interested";
    const todayStr = getLocalDateString(0);
    const updatedBatch: Lead[] = [];

    setLeads((prev) =>
      prev.map((lead) => {
        if (selectedLeadIds.includes(lead.id)) {
          const u: Lead = {
            ...lead,
            status: newStatus,
            paymentDate: isInterested ? (lead.paymentDate || todayStr) : lead.paymentDate,
            paymentMethod: isInterested ? (lead.paymentMethod || "Card") : lead.paymentMethod,
            completionStatus: isInterested ? (lead.completionStatus || "Pending") : lead.completionStatus,
            updatedAt: nowIso,
          };
          updatedBatch.push(u);
          return u;
        }
        return lead;
      })
    );
    updatedBatch.forEach((u) => {
      recordLeadChange({
        leadId: u.id,
        leadName: u.fullName,
        fileId: u.fileId,
        fileName: u.uploadedFileName,
        changeType: "status",
        summary: `Status updated to ${newStatus}`,
        newValue: newStatus,
        handlerName: u.handlerName,
      });
    });
    batchSaveLeadsToFirestore(updatedBatch).catch(() => {});
    selectedLeadIds.forEach((id) => {
      const match = updatedBatch.find((b) => b.id === id);
      const patchData: Partial<Lead> = {
        status: newStatus,
        ...(isInterested
          ? {
              paymentDate: match?.paymentDate,
              paymentMethod: match?.paymentMethod,
              completionStatus: match?.completionStatus,
            }
          : {}),
      };
      realtimeSync.patchLead(id, patchData).catch(() => {});
    });
    setSelectedLeadIds([]);
  };

  const handleUpdateNotes = (leadId: string, newNotes: string) => {
    let updatedLead: Lead | undefined;
    setLeads((prev) =>
      prev.map((lead) => {
        if (lead.id === leadId) {
          updatedLead = {
            ...lead,
            notes: newNotes,
            updatedAt: new Date().toISOString(),
          };
          return updatedLead;
        }
        return lead;
      })
    );
    if (updatedLead) {
      recordLeadChange({
        leadId,
        leadName: (updatedLead as Lead).fullName,
        fileId: (updatedLead as Lead).fileId,
        fileName: (updatedLead as Lead).uploadedFileName,
        changeType: "notes",
        summary: `Notes updated: ${newNotes.substring(0, 45)}`,
        newValue: newNotes,
        handlerName: (updatedLead as Lead).handlerName,
      });
    }
    realtimeSync.patchLead(leadId, { notes: newNotes }).catch(() => {});
    patchLeadInFirestore(leadId, { notes: newNotes }, updatedLead).catch(() => {});
  };

  const handleUpdateManualNotes = (leadId: string, newManualNotes: string) => {
    let updatedLead: Lead | undefined;
    setLeads((prev) =>
      prev.map((lead) => {
        if (lead.id === leadId) {
          updatedLead = {
            ...lead,
            manualNotes: newManualNotes,
            updatedAt: new Date().toISOString(),
          };
          return updatedLead;
        }
        return lead;
      })
    );
    if (updatedLead) {
      recordLeadChange({
        leadId,
        leadName: (updatedLead as Lead).fullName,
        fileId: (updatedLead as Lead).fileId,
        fileName: (updatedLead as Lead).uploadedFileName,
        changeType: "manual_notes",
        summary: `Client notes updated: "${newManualNotes.substring(0, 45)}"`,
        newValue: newManualNotes,
        handlerName: (updatedLead as Lead).handlerName,
      });
    }
    realtimeSync.patchLead(leadId, { manualNotes: newManualNotes }).catch(() => {});
    patchLeadInFirestore(leadId, { manualNotes: newManualNotes }, updatedLead).catch(() => {});
  };

  const handleUpdateMonth = (leadId: string, newMonth: string) => {
    let updatedLead: Lead | undefined;
    setLeads((prev) =>
      prev.map((lead) => {
        if (lead.id === leadId) {
          updatedLead = {
            ...lead,
            month: newMonth,
            lostYearOrMonth: newMonth,
            updatedAt: new Date().toISOString(),
          };
          return updatedLead;
        }
        return lead;
      })
    );
    if (updatedLead) {
      recordLeadChange({
        leadId,
        leadName: (updatedLead as Lead).fullName,
        fileId: (updatedLead as Lead).fileId,
        fileName: (updatedLead as Lead).uploadedFileName,
        changeType: "month",
        summary: `Updated month to ${newMonth}`,
        newValue: newMonth,
        handlerName: (updatedLead as Lead).handlerName,
      });
    }
    realtimeSync.patchLead(leadId, { month: newMonth, lostYearOrMonth: newMonth }).catch(() => {});
    patchLeadInFirestore(leadId, { month: newMonth, lostYearOrMonth: newMonth }, updatedLead).catch(() => {});
  };

  const handleBatchUpdateMonth = (newMonth: string) => {
    if (selectedLeadIds.length === 0 || !newMonth.trim()) return;
    const nowIso = new Date().toISOString();
    const updatedBatch: Lead[] = [];
    setLeads((prev) =>
      prev.map((lead) => {
        if (selectedLeadIds.includes(lead.id)) {
          const u = {
            ...lead,
            month: newMonth.trim(),
            lostYearOrMonth: newMonth.trim(),
            updatedAt: nowIso,
          };
          updatedBatch.push(u);
          return u;
        }
        return lead;
      })
    );
    batchSaveLeadsToFirestore(updatedBatch).catch(() => {});
    selectedLeadIds.forEach((id) => {
      realtimeSync.patchLead(id, { month: newMonth.trim(), lostYearOrMonth: newMonth.trim() }).catch(() => {});
    });
    setSelectedLeadIds([]);
  };

  const handleSaveCallLog = (leadId: string, status: CallStatus, noteToAdd: string) => {
    let patchedItem: Partial<Lead> | null = null;
    let fullLead: Lead | undefined;
    setLeads((prev) =>
      prev.map((lead) => {
        if (lead.id !== leadId) return lead;

        const currentNotes = lead.notes || "";
        const timestamp = new Date().toLocaleDateString("en-US", {
          month: "short",
          day: "numeric",
        });
        const updatedNotes = noteToAdd.trim()
          ? `${currentNotes ? currentNotes + " | " : ""}[${timestamp} Call: ${status}] ${noteToAdd.trim()}`
          : currentNotes;
        const newCallCount = (lead.callCount || 0) + 1;
        const dialedAt = new Date().toISOString();

        patchedItem = {
          status,
          notes: updatedNotes,
          callCount: newCallCount,
          lastDialedAt: dialedAt,
        };

        fullLead = {
          ...lead,
          status,
          notes: updatedNotes,
          callCount: newCallCount,
          lastDialedAt: dialedAt,
          updatedAt: dialedAt,
        };
        return fullLead;
      })
    );
    if (patchedItem) {
      realtimeSync.patchLead(leadId, patchedItem).catch(() => {});
      patchLeadInFirestore(leadId, patchedItem, fullLead).catch(() => {});
    }
  };

  const handleSaveLead = (leadData: Lead) => {
    const now = new Date();
    const todayStr = getLocalDateString(0);
    const isAssigned = Boolean(
      leadData.handlerName &&
        leadData.handlerName.trim() !== "" &&
        leadData.handlerName.toLowerCase() !== "unassigned" &&
        leadData.handlerName.toLowerCase() !== "not assigned" &&
        leadData.handlerName.toLowerCase() !== "none"
    );

    const targetHandler = isAssigned
      ? (settings.handlers.find(
          (h) => h?.name && leadData.handlerName && h.name.toLowerCase() === leadData.handlerName.toLowerCase()
        ) || (leadData.handlerId ? settings.handlers.find((h) => h.id === leadData.handlerId) : undefined))
      : undefined;

    const finalHandlerName = isAssigned ? (targetHandler?.name || leadData.handlerName?.trim() || "") : "";
    const finalHandlerId = isAssigned ? (targetHandler?.id || leadData.handlerId) : undefined;
    const category: "assigned" | "unassigned" = isAssigned ? "assigned" : "unassigned";

    const enrichedLead: Lead = {
      ...leadData,
      pageId: leadData.pageId || activePageId,
      handlerName: finalHandlerName,
      handlerId: finalHandlerId,
      assignmentCategory: category,
      assignedAt: isAssigned ? (leadData.assignedAt || now.toISOString()) : undefined,
      reportDate: isAssigned ? (leadData.reportDate || todayStr) : undefined,
      isPostCutoffRollover: false,
      updatedAt: now.toISOString(),
    };

    setLeads((prev) => {
      const exists = prev.some((l) => l.id === enrichedLead.id);
      if (exists) {
        return prev.map((l) => (l.id === enrichedLead.id ? enrichedLead : l));
      }
      return [enrichedLead, ...prev];
    });
    saveLeadToFirestore(enrichedLead).catch(() => {});
    realtimeSync.patchLead(enrichedLead.id, enrichedLead).catch(() => {});
  };

  // Bulk Reassign Leads from one Handler to another
  const handleBulkReassignHandler = (oldHandlerName: string, newHandlerName: string) => {
    const targetHandler = settings.handlers.find(
      (h) => h?.name && newHandlerName && h.name.toLowerCase() === newHandlerName.toLowerCase()
    );
    const now = new Date();
    const todayStr = getLocalDateString(0);
    const isAssigned = Boolean(
      newHandlerName &&
        newHandlerName.trim() !== "" &&
        newHandlerName.toLowerCase() !== "unassigned"
    );

    const updatedBatch: Lead[] = [];
    setLeads((prev) =>
      prev.map((lead) => {
        const currentHandler = lead.handlerName || "Unassigned";
        if (currentHandler.toLowerCase() === (oldHandlerName || "").toLowerCase()) {
          const u = {
            ...lead,
            handlerName: isAssigned ? newHandlerName : "",
            handlerId: isAssigned ? (targetHandler?.id || lead.handlerId) : undefined,
            assignmentCategory: (isAssigned ? "assigned" : "unassigned") as "assigned" | "unassigned",
            assignedAt: isAssigned ? now.toISOString() : undefined,
            reportDate: isAssigned ? todayStr : undefined,
            isPostCutoffRollover: false,
            updatedAt: now.toISOString(),
          };
          updatedBatch.push(u);
          return u;
        }
        return lead;
      })
    );
    if (updatedBatch.length > 0) {
      updatedBatch.forEach((u) => {
        recordLeadChange({
          leadId: u.id,
          leadName: u.fullName,
          fileId: u.fileId,
          fileName: u.uploadedFileName,
          changeType: "assignment",
          summary: isAssigned ? `Reassigned to handler ${newHandlerName}` : `Unassigned from handler`,
          newValue: isAssigned ? newHandlerName : "",
          handlerName: isAssigned ? newHandlerName : "",
        });
      });
      batchSaveLeadsToFirestore(updatedBatch).catch(() => {});
      updatedBatch.forEach((u) => {
        realtimeSync
          .patchLead(u.id, {
            handlerName: u.handlerName,
            handlerId: isAssigned ? u.handlerId : (null as any),
            assignmentCategory: u.assignmentCategory,
            assignedAt: isAssigned ? u.assignedAt : (null as any),
            reportDate: isAssigned ? u.reportDate : (null as any),
            isPostCutoffRollover: false,
          })
          .catch(() => {});
      });
    }
  };

  // Update single lead's assigned Handler
  const handleUpdateHandler = (leadId: string, handlerName: string, handlerId?: string) => {
    const now = new Date();
    const todayStr = getLocalDateString(0);
    const isAssigned = Boolean(
      handlerName &&
        handlerName.trim() !== "" &&
        handlerName.toLowerCase() !== "unassigned" &&
        handlerName.toLowerCase() !== "not assigned" &&
        handlerName.toLowerCase() !== "none"
    );

    const targetHandler = isAssigned
      ? (settings.handlers.find(
          (h) => h?.name && handlerName && h.name.toLowerCase() === handlerName.toLowerCase()
        ) || (handlerId ? settings.handlers.find((h) => h.id === handlerId) : undefined))
      : undefined;

    const finalHandlerName = isAssigned ? (targetHandler?.name || handlerName.trim()) : "";
    const finalHandlerId = isAssigned ? (targetHandler?.id || handlerId) : undefined;
    const category: "assigned" | "unassigned" = isAssigned ? "assigned" : "unassigned";

    let updatedLead: Lead | undefined;
    let leadName = "";
    setLeads((prev) =>
      prev.map((lead) => {
        if (lead.id === leadId) {
          leadName = lead.fullName;
          updatedLead = {
            ...lead,
            handlerName: finalHandlerName,
            handlerId: finalHandlerId,
            assignmentCategory: category,
            assignedAt: isAssigned ? now.toISOString() : undefined,
            reportDate: isAssigned ? todayStr : undefined,
            isPostCutoffRollover: false,
            updatedAt: now.toISOString(),
          };
          return updatedLead;
        }
        return lead;
      })
    );
    if (updatedLead) {
      recordLeadChange({
        leadId,
        leadName: (updatedLead as Lead).fullName,
        fileId: (updatedLead as Lead).fileId,
        fileName: (updatedLead as Lead).uploadedFileName,
        changeType: "assignment",
        summary: isAssigned ? `Assigned to handler ${finalHandlerName}` : `Unassigned from handler`,
        newValue: finalHandlerName,
        handlerName: finalHandlerName,
      });
    }
    const patchPayload = {
      handlerName: finalHandlerName,
      handlerId: isAssigned ? finalHandlerId : (null as any),
      assignmentCategory: category,
      assignedAt: isAssigned ? now.toISOString() : (null as any),
      reportDate: isAssigned ? todayStr : (null as any),
      isPostCutoffRollover: false,
    };
    realtimeSync.patchLead(leadId, patchPayload).catch(() => {});
    patchLeadInFirestore(leadId, patchPayload, updatedLead).catch(() => {});

    // Notification feedback when automatically moving between views
    if (activeWorkspaceTab === "unassigned" && isAssigned) {
      triggerUndo(
        [],
        `✓ "${leadName || "Lead"}" assigned to ${finalHandlerName} — moved to Assigned Leads`,
        "View in Assigned Section →",
        () => setActiveWorkspaceTab("assigned")
      );
    } else if (activeWorkspaceTab === "assigned" && !isAssigned) {
      triggerUndo(
        [],
        `✓ "${leadName || "Lead"}" set to Unassigned — moved to Unassigned Leads queue`,
        "View in Unassigned Queue →",
        () => setActiveWorkspaceTab("unassigned")
      );
    }
  };

  // Batch update assigned Handler for selected leads
  const handleBatchUpdateHandler = (handlerName: string, handlerId?: string) => {
    if (selectedLeadIds.length === 0) return;
    const now = new Date();
    const todayStr = getLocalDateString(0);
    const isAssigned = Boolean(
      handlerName &&
        handlerName.trim() !== "" &&
        handlerName.toLowerCase() !== "unassigned" &&
        handlerName.toLowerCase() !== "not assigned" &&
        handlerName.toLowerCase() !== "none"
    );

    const targetHandler = isAssigned
      ? (settings.handlers.find(
          (h) => h?.name && handlerName && h.name.toLowerCase() === handlerName.toLowerCase()
        ) || (handlerId ? settings.handlers.find((h) => h.id === handlerId) : undefined))
      : undefined;

    const finalHandlerName = isAssigned ? (targetHandler?.name || handlerName.trim()) : "";
    const finalHandlerId = isAssigned ? (targetHandler?.id || handlerId) : undefined;
    const category: "assigned" | "unassigned" = isAssigned ? "assigned" : "unassigned";

    const patchPayload = {
      handlerName: finalHandlerName,
      handlerId: isAssigned ? finalHandlerId : (null as any),
      assignmentCategory: category,
      assignedAt: isAssigned ? now.toISOString() : (null as any),
      reportDate: isAssigned ? todayStr : (null as any),
      isPostCutoffRollover: false,
    };

    const count = selectedLeadIds.length;
    const updatedBatch: Lead[] = [];
    setLeads((prev) =>
      prev.map((lead) => {
        if (selectedLeadIds.includes(lead.id)) {
          const u = {
            ...lead,
            ...patchPayload,
            updatedAt: now.toISOString(),
          };
          updatedBatch.push(u);
          return u;
        }
        return lead;
      })
    );

    if (updatedBatch.length > 0) {
      updatedBatch.forEach((u) => {
        recordLeadChange({
          leadId: u.id,
          leadName: u.fullName,
          fileId: u.fileId,
          fileName: u.uploadedFileName,
          changeType: "assignment",
          summary: isAssigned ? `Batch assigned to handler ${finalHandlerName}` : `Batch unassigned from handler`,
          newValue: finalHandlerName,
          handlerName: finalHandlerName,
        });
      });
      batchSaveLeadsToFirestore(updatedBatch).catch(() => {});
      selectedLeadIds.forEach((id) => {
        realtimeSync.patchLead(id, patchPayload).catch(() => {});
      });
    }
    setSelectedLeadIds([]);

    if (activeWorkspaceTab === "unassigned" && isAssigned) {
      triggerUndo(
        [],
        `✓ ${count} lead(s) assigned to ${finalHandlerName} — moved to Assigned Leads`,
        "View in Assigned Section →",
        () => setActiveWorkspaceTab("assigned")
      );
    } else if (activeWorkspaceTab === "assigned" && !isAssigned) {
      triggerUndo(
        [],
        `✓ ${count} lead(s) marked Unassigned — moved to Unassigned Leads queue`,
        "View in Unassigned Queue →",
        () => setActiveWorkspaceTab("unassigned")
      );
    }
  };

  // Payment and Completion Status Operations for Interested Clients
  const handleUpdatePaymentDate = (leadId: string, paymentDate: string) => {
    let updatedLead: Lead | undefined;
    setLeads((prev) =>
      prev.map((lead) => {
        if (lead.id === leadId) {
          updatedLead = {
            ...lead,
            paymentDate,
            updatedAt: new Date().toISOString(),
          };
          return updatedLead;
        }
        return lead;
      })
    );
    if (updatedLead) {
      recordLeadChange({
        leadId,
        leadName: (updatedLead as Lead).fullName,
        fileId: (updatedLead as Lead).fileId,
        fileName: (updatedLead as Lead).uploadedFileName,
        changeType: "payment",
        summary: `Payment date set to ${paymentDate}`,
        newValue: paymentDate,
        handlerName: (updatedLead as Lead).handlerName,
      });
    }
    realtimeSync.patchLead(leadId, { paymentDate }).catch(() => {});
    patchLeadInFirestore(leadId, { paymentDate }, updatedLead).catch(() => {});
  };

  const handleUpdatePaymentMethod = (leadId: string, paymentMethod: string) => {
    let updatedLead: Lead | undefined;
    setLeads((prev) =>
      prev.map((lead) => {
        if (lead.id === leadId) {
          updatedLead = {
            ...lead,
            paymentMethod,
            updatedAt: new Date().toISOString(),
          };
          return updatedLead;
        }
        return lead;
      })
    );
    if (updatedLead) {
      recordLeadChange({
        leadId,
        leadName: (updatedLead as Lead).fullName,
        fileId: (updatedLead as Lead).fileId,
        fileName: (updatedLead as Lead).uploadedFileName,
        changeType: "payment",
        summary: `Payment method set to ${paymentMethod}`,
        newValue: paymentMethod,
        handlerName: (updatedLead as Lead).handlerName,
      });
    }
    realtimeSync.patchLead(leadId, { paymentMethod }).catch(() => {});
    patchLeadInFirestore(leadId, { paymentMethod }, updatedLead).catch(() => {});
  };

  const handleUpdateCompletionStatus = (leadId: string, completionStatus: CompletionStatus) => {
    let updatedLead: Lead | undefined;
    const nowIso = new Date().toISOString();
    setLeads((prev) =>
      prev.map((lead) => {
        if (lead.id === leadId) {
          const completedAt = completionStatus === "Completed" ? (lead.completedAt || nowIso) : undefined;
          updatedLead = {
            ...lead,
            completionStatus,
            completedAt,
            updatedAt: nowIso,
          };
          return updatedLead;
        }
        return lead;
      })
    );
    if (updatedLead) {
      recordLeadChange({
        leadId,
        leadName: (updatedLead as Lead).fullName,
        fileId: (updatedLead as Lead).fileId,
        fileName: (updatedLead as Lead).uploadedFileName,
        changeType: "completion",
        summary: `Completion status set to ${completionStatus}`,
        newValue: completionStatus,
        handlerName: (updatedLead as Lead).handlerName,
      });
    }
    const patchData: Partial<Lead> = {
      completionStatus,
      completedAt: completionStatus === "Completed" ? (updatedLead?.completedAt || nowIso) : (null as any),
    };
    realtimeSync.patchLead(leadId, patchData).catch(() => {});
    patchLeadInFirestore(leadId, patchData, updatedLead).catch(() => {});
  };

  // Restore leads from backup file
  const handleRestoreLeads = (restoredLeads: Lead[]) => {
    setLeads(restoredLeads);
    batchSaveLeadsToFirestore(restoredLeads).catch(() => {});
    setSelectedLeadIds([]);
    handleResetFilters();
  };

  // Trigger undo or move notification banner
  const triggerUndo = (
    deletedItems: Lead[],
    message: string,
    actionLabel?: string,
    onAction?: () => void
  ) => {
    if (undoTimerRef.current) clearTimeout(undoTimerRef.current);
    setUndoToast({ message, deletedLeads: deletedItems, actionLabel, onAction });
    undoTimerRef.current = setTimeout(() => {
      setUndoToast(null);
    }, 7000);
  };

  const handleRestoreUndo = () => {
    if (undoToast && undoToast.deletedLeads.length > 0) {
      setLeads((prev) => [...undoToast.deletedLeads, ...prev]);
      batchSaveLeadsToFirestore(undoToast.deletedLeads).catch(() => {});
      setUndoToast(null);
      if (undoTimerRef.current) clearTimeout(undoTimerRef.current);
    }
  };

  // Single Lead Delete
  const handleDeleteSingleLead = (lead: Lead) => {
    setDeleteConfirm({
      isOpen: true,
      title: "Delete Record?",
      description: `Are you sure you want to delete "${lead.fullName}" (${lead.paymentReceipt || lead.phoneNumber || "Record"})?`,
      itemCount: 1,
      onConfirm: () => {
        setLeads((prev) => prev.filter((l) => l.id !== lead.id));
        setSelectedLeadIds((prev) => prev.filter((id) => id !== lead.id));
        deleteLeadFromFirestore(lead.id).catch(() => {});
        realtimeSync.deleteLead(lead.id).catch(() => {});
        triggerUndo([lead], `Deleted "${lead.fullName}"`);
      },
    });
  };

  // Batch Delete Selected Leads
  const handleDeleteSelected = () => {
    if (selectedLeadIds.length === 0) return;
    const count = selectedLeadIds.length;
    setDeleteConfirm({
      isOpen: true,
      title: `Delete ${count} Selected Record(s)?`,
      description: `Are you sure you want to remove the ${count} selected records? This action will permanently remove them from your active tracker across all devices.`,
      itemCount: count,
      onConfirm: () => {
        const toDelete = leads.filter((l) => selectedLeadIds.includes(l.id));
        const idsToDelete = [...selectedLeadIds];
        setLeads((prev) => prev.filter((l) => !selectedLeadIds.includes(l.id)));
        setSelectedLeadIds([]);
        batchDeleteLeadsFromFirestore(idsToDelete).catch(() => {});
        realtimeSync.bulkDeleteLeads(idsToDelete).catch(() => {});
        triggerUndo(toDelete, `Deleted ${count} selected record(s)`);
      },
    });
  };

  // Clear All Leads in Active Workspace Page
  const handleClearAll = () => {
    if (currentPageLeads.length === 0 && currentPageFiles.length === 0) return;
    setDeleteConfirm({
      isOpen: true,
      title: `Delete All Records in "${activePage.name}"?`,
      description: `Are you sure you want to permanently delete all ${currentPageLeads.length} records and ${currentPageFiles.length} file sections from "${activePage.name}"? Other workspace pages will remain unaffected.`,
      itemCount: currentPageLeads.length,
      onConfirm: () => {
        const allCurrent = [...currentPageLeads];
        const allLeadIds = allCurrent.map((l) => l.id);
        const allFileIds = currentPageFiles.map((f) => f.id);
        batchDeleteLeadsFromFirestore(allLeadIds).catch(() => {});
        allFileIds.forEach((fId) => {
          deleteUploadedFileFromFirestore(fId).catch(() => {});
        });
        setLeads((prev) => prev.filter((l) => (l.pageId || "page-default") !== activePageId));
        setUploadedFiles((prev) => prev.filter((f) => (f.pageId || "page-default") !== activePageId));
        setSelectedLeadIds([]);
        handleResetFilters();
        triggerUndo(allCurrent, `Deleted all ${allCurrent.length} records from "${activePage.name}"`);
        realtimeSync.bulkDeleteLeads(allLeadIds).catch(() => {});
      },
    });
  };

  // Workspace Page Operations
  const handleSelectPage = (pageId: string) => {
    setActivePageId(pageId);
    setActiveWorkspaceTab("all");
    setActiveFileFilter("all");
    setActiveDateFilter("all");
    setSelectedHandler("all");
    setSearchQuery("");
    setSelectedLeadIds([]);
  };

  const handleCreateBlankPage = (
    name: string,
    description?: string,
    color?: WorkspacePage["color"],
    customColor?: string
  ) => {
    const newPage = createBlankPage(name, description, color, customColor);
    setPages((prev) => {
      const updated = [...prev, newPage];
      savePageToFirestore(newPage).catch(() => {});
      return updated;
    });
    handleSelectPage(newPage.id);
    triggerUndo([], `✓ Created new blank workspace "${newPage.name}"`);
  };

  const handleDuplicatePage = (
    sourcePage: WorkspacePage,
    customName?: string,
    color?: WorkspacePage["color"],
    customColor?: string
  ) => {
    const sourceLeads = leads.filter((l) => (l.pageId || "page-default") === sourcePage.id);
    const sourceFiles = uploadedFiles.filter((f) => (f.pageId || "page-default") === sourcePage.id);

    const { newPage, clonedLeads, clonedFiles } = duplicateWorkspacePage(
      sourcePage,
      sourceLeads,
      sourceFiles,
      customName,
      color,
      customColor
    );

    setPages((prev) => {
      const updated = [...prev, newPage];
      savePageToFirestore(newPage).catch(() => {});
      return updated;
    });

    if (clonedFiles.length > 0) {
      setUploadedFiles((prev) => [...clonedFiles, ...prev]);
      clonedFiles.forEach((f) => saveUploadedFileToFirestore(f).catch(() => {}));
    }

    if (clonedLeads.length > 0) {
      setLeads((prev) => [...clonedLeads, ...prev]);
      batchSaveLeadsToFirestore(clonedLeads).catch(() => {});
    }

    handleSelectPage(newPage.id);
    triggerUndo(
      [],
      `✓ Duplicated "${sourcePage.name}" into "${newPage.name}" (${clonedLeads.length} leads cloned)`
    );
  };

  const handleRenamePage = (
    pageId: string,
    newName: string,
    description?: string,
    color?: WorkspacePage["color"],
    customColor?: string
  ) => {
    setPages((prev) =>
      prev.map((p) => {
        if (p.id === pageId) {
          const updated: WorkspacePage = {
            ...p,
            name: newName,
            description: description !== undefined ? description : p.description,
            color: color || p.color,
            customColor: customColor !== undefined ? customColor : p.customColor,
            updatedAt: new Date().toISOString(),
          };
          savePageToFirestore(updated).catch(() => {});
          return updated;
        }
        return p;
      })
    );
  };

  const handleDeletePage = (pageId: string) => {
    if (pages.length <= 1) return;
    const pageToDelete = pages.find((p) => p.id === pageId);
    const pageName = pageToDelete?.name || "Workspace";

    deletePageFromFirestore(pageId).catch(() => {});
    const remainingPages = pages.filter((p) => p.id !== pageId);
    setPages(remainingPages);

    const leadsToDelete = leads.filter((l) => (l.pageId || "page-default") === pageId);
    const filesToDelete = uploadedFiles.filter((f) => (f.pageId || "page-default") === pageId);

    if (leadsToDelete.length > 0) {
      batchDeleteLeadsFromFirestore(leadsToDelete.map((l) => l.id)).catch(() => {});
      setLeads((prev) => prev.filter((l) => (l.pageId || "page-default") !== pageId));
    }

    if (filesToDelete.length > 0) {
      filesToDelete.forEach((f) => deleteUploadedFileFromFirestore(f.id).catch(() => {}));
      setUploadedFiles((prev) => prev.filter((f) => (f.pageId || "page-default") !== pageId));
    }

    if (activePageId === pageId) {
      handleSelectPage(remainingPages[0].id);
    }

    triggerUndo([], `✓ Deleted workspace "${pageName}" and its records`);
  };

  // Assign unassigned leads to a specific handler
  const handleAssignUnassignedToHandler = (
    handlerName: string,
    handlerId?: string,
    count: number = 3
  ) => {
    let assigned = 0;
    const resolvedHandler =
      settings.handlers.find((h) => h?.name && handlerName && h.name.toLowerCase() === handlerName.toLowerCase()) ||
      settings.handlers.find((h) => h.id === handlerId);
    const finalHandlerName = resolvedHandler?.name || handlerName;
    const finalHandlerId = resolvedHandler?.id || handlerId;

    const now = new Date();
    const todayStr = getLocalDateString(0);
    const isAssigned = Boolean(
      finalHandlerName &&
        finalHandlerName.trim() !== "" &&
        finalHandlerName.toLowerCase() !== "unassigned"
    );

    const updatedBatch: Lead[] = [];
    setLeads((prev) =>
      prev.map((lead) => {
        const isUnassigned =
          !lead.handlerName ||
          lead.handlerName === "Unassigned" ||
          lead.handlerName.trim() === "" ||
          lead.assignmentCategory === "unassigned";
        if (isUnassigned && assigned < count) {
          assigned++;
          const u = {
            ...lead,
            handlerName: finalHandlerName,
            handlerId: finalHandlerId,
            assignmentCategory: (isAssigned ? "assigned" : "unassigned") as "assigned" | "unassigned",
            assignedAt: isAssigned ? now.toISOString() : undefined,
            reportDate: isAssigned ? todayStr : undefined,
            isPostCutoffRollover: false,
            updatedAt: new Date().toISOString(),
          };
          updatedBatch.push(u);
          return u;
        }
        return lead;
      })
    );
    if (updatedBatch.length > 0) {
      batchSaveLeadsToFirestore(updatedBatch).catch(() => {});
      updatedBatch.forEach((u) => {
        realtimeSync
          .patchLead(u.id, {
            handlerName: u.handlerName,
            handlerId: u.handlerId,
            assignmentCategory: u.assignmentCategory,
            assignedAt: u.assignedAt,
            reportDate: u.reportDate,
            isPostCutoffRollover: false,
          })
          .catch(() => {});
      });
      triggerUndo(
        [],
        `✓ Assigned ${assigned} lead(s) to ${finalHandlerName} — moved to Assigned Leads`,
        "View in Assigned Section →",
        () => setActiveWorkspaceTab("assigned")
      );
    }
  };

  // Batch assign all unassigned leads to a chosen handler
  const handleBatchAssignAllUnassigned = (handlerName: string, handlerId?: string) => {
    const resolvedHandler =
      settings.handlers.find((h) => h?.name && handlerName && h.name.toLowerCase() === handlerName.toLowerCase()) ||
      settings.handlers.find((h) => h.id === handlerId);
    const finalHandlerName = resolvedHandler?.name || handlerName;
    const finalHandlerId = resolvedHandler?.id || handlerId;

    const now = new Date();
    const todayStr = getLocalDateString(0);
    const isAssigned = Boolean(
      finalHandlerName &&
        finalHandlerName.trim() !== "" &&
        finalHandlerName.toLowerCase() !== "unassigned"
    );

    const updatedBatch: Lead[] = [];
    setLeads((prev) =>
      prev.map((lead) => {
        const isUnassigned =
          !lead.handlerName ||
          lead.handlerName === "Unassigned" ||
          lead.handlerName.trim() === "" ||
          lead.assignmentCategory === "unassigned";
        if (isUnassigned) {
          const u = {
            ...lead,
            handlerName: finalHandlerName,
            handlerId: finalHandlerId,
            assignmentCategory: (isAssigned ? "assigned" : "unassigned") as "assigned" | "unassigned",
            assignedAt: isAssigned ? now.toISOString() : undefined,
            reportDate: isAssigned ? todayStr : undefined,
            isPostCutoffRollover: false,
            updatedAt: new Date().toISOString(),
          };
          updatedBatch.push(u);
          return u;
        }
        return lead;
      })
    );
    if (updatedBatch.length > 0) {
      updatedBatch.forEach((u) => {
        recordLeadChange({
          leadId: u.id,
          leadName: u.fullName,
          fileId: u.fileId,
          fileName: u.uploadedFileName,
          changeType: "assignment",
          summary: `Assigned task to handler ${finalHandlerName}`,
          newValue: finalHandlerName,
          handlerName: finalHandlerName,
        });
      });
      batchSaveLeadsToFirestore(updatedBatch).catch(() => {});
      updatedBatch.forEach((u) => {
        realtimeSync
          .patchLead(u.id, {
            handlerName: u.handlerName,
            handlerId: u.handlerId,
            assignmentCategory: u.assignmentCategory,
            assignedAt: u.assignedAt,
            reportDate: u.reportDate,
            isPostCutoffRollover: false,
          })
          .catch(() => {});
      });
      triggerUndo(
        [],
        `✓ All ${updatedBatch.length} unassigned lead(s) assigned to ${finalHandlerName} — moved to Assigned Leads`,
        "View in Assigned Section →",
        () => setActiveWorkspaceTab("assigned")
      );
    }
  };

  // Evenly distribute unassigned leads among handlers who do not have tasks assigned today
  const handleAutoDistributeUnassigned = () => {
    const todayStr = getLocalDateString(0);
    const todayLeads = leads.filter(
      (l) => (l.uploadDate || l.createdAt?.slice(0, 10)) === todayStr
    );

    // Find handlers who currently have 0 tasks today
    const handlersWithoutTasks = settings.handlers.filter((h) => {
      const hCount = todayLeads.filter(
        (l) =>
          (h?.name && l.handlerName?.toLowerCase() === h.name.toLowerCase()) ||
          l.handlerId === h.id
      ).length;
      return hCount === 0;
    });

    const targetPool =
      handlersWithoutTasks.length > 0 ? handlersWithoutTasks : settings.handlers;
    if (targetPool.length === 0) return;

    const now = new Date();

    let poolIdx = 0;
    const updatedBatch: Lead[] = [];
    setLeads((prev) =>
      prev.map((lead) => {
        const isUnassigned =
          !lead.handlerName ||
          lead.handlerName === "Unassigned" ||
          lead.handlerName.trim() === "" ||
          lead.assignmentCategory === "unassigned";
        if (isUnassigned) {
          const assignedHandler = targetPool[poolIdx % targetPool.length];
          poolIdx++;
          const u = {
            ...lead,
            handlerName: assignedHandler.name,
            handlerId: assignedHandler.id,
            assignmentCategory: "assigned" as const,
            assignedAt: now.toISOString(),
            reportDate: todayStr,
            isPostCutoffRollover: false,
            updatedAt: new Date().toISOString(),
          };
          updatedBatch.push(u);
          return u;
        }
        return lead;
      })
    );
    if (updatedBatch.length > 0) {
      batchSaveLeadsToFirestore(updatedBatch).catch(() => {});
      updatedBatch.forEach((u) => {
        realtimeSync
          .patchLead(u.id, {
            handlerName: u.handlerName,
            handlerId: u.handlerId,
            assignmentCategory: "assigned",
            assignedAt: u.assignedAt,
            reportDate: u.reportDate,
            isPostCutoffRollover: false,
          })
          .catch(() => {});
      });
      triggerUndo(
        [],
        `✓ Evenly distributed ${updatedBatch.length} lead(s) across team handlers — moved to Assigned Leads`,
        "View in Assigned Section →",
        () => setActiveWorkspaceTab("assigned")
      );
    }
  };

  const handleLeadsExtracted = (
    newLeads: Lead[],
    mode: "append" | "replace",
    fileInfo?: UploadFileInfo
  ) => {
    const todayStr = getLocalDateString(0);
    const now = new Date();

    // All daily assignments compiled without daily time restrictions
    const effectiveUploadDate = fileInfo?.uploadDate || todayStr;

    const generatedFileId = fileInfo?.id || `file-${Date.now()}`;
    const generatedFileName = fileInfo?.fileName || "Uploaded_Sheet.xlsx";

    // All original data from the Excel sheet is preserved accurately.
    // Leads without an assigned handler remain strictly 'Unassigned' and are not defaulted to any handler.
    const leadsToProcess = newLeads.map((l) => {
      const isAssigned = Boolean(
        l.handlerName &&
        l.handlerName.trim() !== "" &&
        l.handlerName.toLowerCase() !== "unassigned" &&
        l.handlerName.toLowerCase() !== "not assigned" &&
        l.handlerName.toLowerCase() !== "none"
      );

      const cleanHandlerName = isAssigned ? l.handlerName!.trim() : "";
      const matchedHandler = isAssigned
        ? settings.handlers.find(
            (h) => h?.name && h.name.toLowerCase() === cleanHandlerName.toLowerCase()
          ) || (l.handlerId ? settings.handlers.find((h) => h.id === l.handlerId) : undefined)
        : undefined;

      return {
        ...l,
        pageId: l.pageId || activePageId,
        handlerId: isAssigned ? (matchedHandler?.id || l.handlerId) : undefined,
        handlerName: isAssigned ? cleanHandlerName : "",
        assignmentCategory: (isAssigned ? "assigned" : "unassigned") as "assigned" | "unassigned",
        assignedAt: isAssigned ? (l.assignedAt || now.toISOString()) : undefined,
        reportDate: isAssigned ? (l.reportDate || effectiveUploadDate) : undefined,
        isPostCutoffRollover: false,
        status: l.status || settings.defaultLeadStatus || "Requires Follow-up",
        uploadDate: effectiveUploadDate,
        fileId: l.fileId || generatedFileId,
        uploadedFileName: l.uploadedFileName || generatedFileName,
      };
    });

    if (fileInfo) {
      const newFile: UploadedFileRecord = {
        id: fileInfo.id || generatedFileId,
        pageId: activePageId,
        fileName: fileInfo.fileName,
        uploadDate: effectiveUploadDate,
        uploadedAt: new Date().toISOString(),
        fileSize: fileInfo.fileSize || "25.0 KB",
        fileType: fileInfo.fileType || "xlsx",
        recordCount: leadsToProcess.length,
      };
      setUploadedFiles((prev) => {
        if (mode === "replace") {
          return [newFile];
        }
        return [newFile, ...prev.filter((f) => f.id !== newFile.id)];
      });

      // Subsequent new Excel sheet uploads are categorized in separate tabs and auto-focused!
      setActiveWorkspaceTab(`file-${newFile.id}`);
      setActiveFileFilter(newFile.id);
      setActiveDateFilter("all");
      saveUploadedFileToFirestore(newFile).catch(() => {});
    } else {
      setActiveDateFilter("all");
      setActiveFileFilter("all");
      setActiveWorkspaceTab("all");
    }

    batchSaveLeadsToFirestore(leadsToProcess).catch(() => {});

    if (mode === "replace") {
      setLeads(leadsToProcess);
    } else {
      // Append mode: NEVER drop or omit leads from an imported spreadsheet!
      // All extracted records must be safely loaded into the active pipeline.
      setLeads((prev) => {
        // If current pipeline only contains placeholder sample leads, replace them with user's real upload
        const isInitialPlaceholderOnly =
          prev.length > 0 &&
          prev.every((l) => l.id.startsWith("lead-") && (!l.fileId || l.fileId.startsWith("file-today-") || l.fileId.startsWith("file-tomorrow-")));
        if (isInitialPlaceholderOnly) {
          return leadsToProcess;
        }

        // Avoid duplicate IDs while preserving all unique entries from the sheet
        const existingIds = new Set(prev.map((l) => l.id));
        const newItems = leadsToProcess.filter((l) => !existingIds.has(l.id));
        return [...newItems, ...prev];
      });
    }
    // Clear other filters so user immediately sees their newly uploaded sheet in its tab
    setSearchQuery("");
    setStatusFilter("all");
    setSelectedYear("all");
    setSelectedCity("all");
    setSelectedHandler("all");
    setActiveDateFilter("all");

    triggerUndo(
      [],
      `✓ Successfully imported ${leadsToProcess.length} lead(s) from "${fileInfo?.fileName || "spreadsheet"}"`
    );
  };

  const handleMultipleFilesExtracted = (
    results: ExtractedFileResult[],
    mode: "append" | "replace"
  ) => {
    if (!results || results.length === 0) return;
    const todayStr = getLocalDateString(0);
    const now = new Date();

    const allNewFiles: UploadedFileRecord[] = [];
    const allProcessedLeads: Lead[] = [];

    for (let i = 0; i < results.length; i++) {
      const { leads: newLeads, fileInfo } = results[i];
      const effectiveUploadDate = fileInfo?.uploadDate || todayStr;
      const generatedFileId = fileInfo?.id || `file-${Date.now()}-${i}`;
      const generatedFileName = fileInfo?.fileName || `Uploaded_Sheet_${i + 1}.xlsx`;

      const leadsToProcess = newLeads.map((l) => {
        const isAssigned = Boolean(
          l.handlerName &&
          l.handlerName.trim() !== "" &&
          l.handlerName.toLowerCase() !== "unassigned" &&
          l.handlerName.toLowerCase() !== "not assigned" &&
          l.handlerName.toLowerCase() !== "none"
        );

        const cleanHandlerName = isAssigned ? l.handlerName!.trim() : "";
        const matchedHandler = isAssigned
          ? settings.handlers.find(
              (h) => h?.name && h.name.toLowerCase() === cleanHandlerName.toLowerCase()
            ) || (l.handlerId ? settings.handlers.find((h) => h.id === l.handlerId) : undefined)
          : undefined;

        return {
          ...l,
          pageId: l.pageId || activePageId,
          handlerId: isAssigned ? (matchedHandler?.id || l.handlerId) : undefined,
          handlerName: isAssigned ? cleanHandlerName : "",
          assignmentCategory: (isAssigned ? "assigned" : "unassigned") as "assigned" | "unassigned",
          assignedAt: isAssigned ? (l.assignedAt || now.toISOString()) : undefined,
          reportDate: isAssigned ? (l.reportDate || effectiveUploadDate) : undefined,
          isPostCutoffRollover: false,
          status: l.status || settings.defaultLeadStatus || "Requires Follow-up",
          uploadDate: effectiveUploadDate,
          fileId: l.fileId || generatedFileId,
          uploadedFileName: l.uploadedFileName || generatedFileName,
        };
      });

      const newFile: UploadedFileRecord = {
        id: fileInfo?.id || generatedFileId,
        pageId: activePageId,
        fileName: generatedFileName,
        uploadDate: effectiveUploadDate,
        uploadedAt: now.toISOString(),
        fileSize: fileInfo?.fileSize || "25.0 KB",
        fileType: fileInfo?.fileType || "xlsx",
        recordCount: leadsToProcess.length,
      };

      allNewFiles.push(newFile);
      allProcessedLeads.push(...leadsToProcess);
      saveUploadedFileToFirestore(newFile).catch(() => {});
    }

    batchSaveLeadsToFirestore(allProcessedLeads).catch(() => {});

    setUploadedFiles((prev) => {
      if (mode === "replace") {
        return allNewFiles;
      }
      const newFileIds = new Set(allNewFiles.map((f) => f.id));
      return [...allNewFiles, ...prev.filter((f) => !newFileIds.has(f.id))];
    });

    if (mode === "replace") {
      setLeads(allProcessedLeads);
    } else {
      setLeads((prev) => {
        const isInitialPlaceholderOnly =
          prev.length > 0 &&
          prev.every((l) => l.id.startsWith("lead-") && (!l.fileId || l.fileId.startsWith("file-today-") || l.fileId.startsWith("file-tomorrow-")));
        if (isInitialPlaceholderOnly) {
          return allProcessedLeads;
        }
        const existingIds = new Set(prev.map((l) => l.id));
        const newItems = allProcessedLeads.filter((l) => !existingIds.has(l.id));
        return [...newItems, ...prev];
      });
    }

    if (allNewFiles.length > 0) {
      setActiveWorkspaceTab(`file-${allNewFiles[0].id}`);
      setActiveFileFilter(allNewFiles[0].id);
    }
    setActiveDateFilter("all");
    setSearchQuery("");
    setStatusFilter("all");
    setSelectedYear("all");
    setSelectedCity("all");
    setSelectedHandler("all");

    triggerUndo(
      [],
      `✓ Successfully imported ${allProcessedLeads.length} lead(s) across ${allNewFiles.length} spreadsheet(s)`
    );
  };

  const handleDeleteFile = (file: UploadedFileRecord) => {
    setDeleteConfirm({
      isOpen: true,
      title: `Delete File "${file.fileName}"?`,
      description: `Are you sure you want to remove this file and its ${file.recordCount || 0} associated lead record(s)?`,
      itemCount: file.recordCount,
      onConfirm: () => {
        const fileLeadIds = leads
          .filter((l) => l.fileId === file.id || l.uploadedFileName === file.fileName)
          .map((l) => l.id);
        setLeads((prev) =>
          prev.filter((l) => l.fileId !== file.id && l.uploadedFileName !== file.fileName)
        );
        setUploadedFiles((prev) => prev.filter((f) => f.id !== file.id));
        setSelectedLeadIds((prev) => prev.filter((id) => !fileLeadIds.includes(id)));
        if (activeFileFilter === file.id) setActiveFileFilter("all");
        if (activeWorkspaceTab === `file-${file.id}`) setActiveWorkspaceTab("all");
        triggerUndo(
          leads.filter((l) => fileLeadIds.includes(l.id)),
          `Deleted file "${file.fileName}"`
        );
        deleteUploadedFileFromFirestore(file.id).catch(() => {});
        batchDeleteLeadsFromFirestore(fileLeadIds).catch(() => {});
        realtimeSync.deleteFile(file.id).catch(() => {});
      },
    });
  };

  const handleExportFileLeads = (file: UploadedFileRecord) => {
    const fileLeads = leads.filter((l) => l.fileId === file.id);
    exportLeadsToExcel(fileLeads.length > 0 ? fileLeads : leads);
  };

  const handleQuickUploadForTomorrow = () => {
    const tomorrowStr = getLocalDateString(1);
    setPresetUploadDate(tomorrowStr);
    const uploadEl = document.getElementById("section-upload-panel");
    if (uploadEl) {
      uploadEl.scrollIntoView({ behavior: "smooth" });
    }
  };

  const handleQuickUploadForDate = (dateStr: string) => {
    setPresetUploadDate(dateStr);
    const uploadEl = document.getElementById("section-upload-panel");
    if (uploadEl) {
      uploadEl.scrollIntoView({ behavior: "smooth" });
    }
  };

  const handleResetToSample = async () => {
    try {
      const stampedLeads = DEFAULT_SAMPLE_LEADS.map((l) => ({
        ...l,
        id: `sample-${activePageId}-${l.id}`,
        pageId: activePageId,
      }));
      const stampedFiles = DEFAULT_UPLOADED_FILES.map((f) => ({
        ...f,
        id: `sample-file-${activePageId}-${f.id}`,
        pageId: activePageId,
      }));

      setLeads((prev) => [
        ...stampedLeads,
        ...prev.filter((l) => (l.pageId || "page-default") !== activePageId),
      ]);
      setUploadedFiles((prev) => [
        ...stampedFiles,
        ...prev.filter((f) => (f.pageId || "page-default") !== activePageId),
      ]);
      batchSaveLeadsToFirestore(stampedLeads).catch(() => {});
      stampedFiles.forEach((f) => saveUploadedFileToFirestore(f).catch(() => {}));
    } catch {
      const stampedLeads = DEFAULT_SAMPLE_LEADS.map((l) => ({
        ...l,
        id: `sample-${activePageId}-${l.id}`,
        pageId: activePageId,
      }));
      const stampedFiles = DEFAULT_UPLOADED_FILES.map((f) => ({
        ...f,
        id: `sample-file-${activePageId}-${f.id}`,
        pageId: activePageId,
      }));
      setLeads((prev) => [
        ...stampedLeads,
        ...prev.filter((l) => (l.pageId || "page-default") !== activePageId),
      ]);
      setUploadedFiles((prev) => [
        ...stampedFiles,
        ...prev.filter((f) => (f.pageId || "page-default") !== activePageId),
      ]);
    }
    setSelectedLeadIds([]);
    handleResetFilters();
    triggerUndo([], `✓ Reset "${activePage.name}" to sample demo dataset`);
  };

  // Keyboard Shortcuts State
  const [shortcuts, setShortcuts] = useState<Record<ShortcutActionId, string>>(() =>
    loadCustomShortcuts()
  );

  const handleUpdateShortcut = (actionId: ShortcutActionId, newKey: string) => {
    setShortcuts((prev) => {
      const updated = { ...prev, [actionId]: newKey };
      saveCustomShortcuts(updated);
      apiClient.saveShortcuts(updated).catch(() => {});
      return updated;
    });
  };

  const handleResetAllShortcuts = () => {
    const defaults = resetAllShortcuts();
    setShortcuts(defaults);
    apiClient.saveShortcuts(defaults).catch(() => {});
  };

  const handleResetSingleShortcut = (actionId: ShortcutActionId) => {
    const def = SHORTCUT_DEFINITIONS.find((d) => d.id === actionId);
    if (def) {
      handleUpdateShortcut(actionId, def.defaultKey);
    }
  };

  // Execution engine for any shortcut action
  const executeShortcutAction = (actionId: ShortcutActionId) => {
    switch (actionId) {
      case "nav_tracker":
        setCurrentPage("tracker");
        break;

      case "nav_shortcuts":
        setCurrentPage("shortcuts");
        break;

      case "nav_settings":
        setCurrentPage("settings");
        break;

      case "scroll_upload":
        setCurrentPage("tracker");
        setTimeout(() => {
          document.getElementById("section-upload-panel")?.scrollIntoView({ behavior: "smooth" });
        }, 50);
        break;

      case "search_focus":
        setCurrentPage("tracker");
        setTimeout(() => {
          const el = document.getElementById("input-lead-search") as HTMLInputElement;
          el?.focus();
          el?.select();
        }, 50);
        break;

      case "search_reset":
        handleResetFilters();
        break;

      case "filter_status_cycle": {
        const statuses: StatusFilter[] = [
          "all",
          "Integrated",
          "Interested",
          "Requires Follow-up",
          "Pending Call",
          "No Answer",
          "Not Interested",
        ];
        const nextIdx = (statuses.indexOf(statusFilter) + 1) % statuses.length;
        setStatusFilter(statuses[nextIdx]);
        break;
      }

      case "filter_handler_cycle": {
        const handlerNames = [
          "all",
          ...settings.handlers.map((h) => h?.name).filter(Boolean) as string[],
        ];
        const currentIdx = handlerNames.findIndex(
          (name) => name?.toLowerCase() === (selectedHandler || "").toLowerCase()
        );
        const nextIdx = currentIdx >= 0 ? (currentIdx + 1) % handlerNames.length : 0;
        setSelectedHandler(handlerNames[nextIdx]);
        break;
      }

      case "lead_add":
        setEditingLead(null);
        setIsLeadModalOpen(true);
        break;

      case "lead_select_all":
        handleSelectAll();
        break;

      case "lead_clear_selection":
        handleClearSelection();
        break;

      case "lead_delete_selected":
        if (selectedLeadIds.length > 0) {
          handleDeleteSelected();
        }
        break;

      case "undo_delete":
        handleRestoreUndo();
        break;

      case "day_today":
        setActiveDateFilter(getLocalDateString(0));
        break;

      case "day_tomorrow":
        setActiveDateFilter(getLocalDateString(1));
        break;

      case "day_all":
        setActiveDateFilter("all");
        break;

      case "quick_upload_tomorrow":
        handleQuickUploadForTomorrow();
        break;

      case "drop_file_today": {
        const dropInput = document.getElementById("input-shortcuts-tab-drop-file") as HTMLInputElement;
        if (currentPage === "shortcuts" && dropInput) {
          dropInput.click();
          break;
        }
        setCurrentPage("tracker");
        const todayDate = getLocalDateString(0);
        setPresetUploadDate(todayDate);
        setTimeout(() => {
          const uploadEl = document.getElementById("section-upload-panel");
          if (uploadEl) {
            uploadEl.scrollIntoView({ behavior: "smooth" });
          }
          const fileInput = document.getElementById("input-upload-excel-file") as HTMLInputElement;
          if (fileInput) {
            fileInput.click();
          } else {
            document.getElementById("upload-dropzone-box")?.click();
          }
        }, 120);
        break;
      }

      case "toggle_workload_expand": {
        if (currentPage !== "tracker") {
          setCurrentPage("tracker");
        }
        setTimeout(() => {
          const btn = document.getElementById("btn-toggle-workload-expand");
          if (btn) {
            btn.click();
            btn.scrollIntoView({ behavior: "smooth", block: "center" });
          }
        }, 100);
        break;
      }

      case "report_pdf":
        handleOpenPdfReport();
        break;

      case "export_excel":
        exportLeadsToExcel(filteredLeads.length > 0 ? filteredLeads : leads);
        break;

      case "export_csv":
        exportLeadsToCsv(filteredLeads.length > 0 ? filteredLeads : leads);
        break;

      case "modal_close":
        setIsLeadModalOpen(false);
        setIsPdfModalOpen(false);
        setCallLogLead(null);
        setDeleteConfirm((prev) => ({ ...prev, isOpen: false }));
        break;
    }
  };

  // Global Keyboard Listener
  useEffect(() => {
    const handleGlobalKeyDown = (e: KeyboardEvent) => {
      const isEditable = isTargetEditable(e.target);

      // Check each configured shortcut
      for (const [actionId, combo] of Object.entries(shortcuts)) {
        if (!combo) continue;

        if (matchEventToShortcut(e, combo)) {
          if (isEditable) {
            // Allow Escape to blur inputs or close modals
            if (actionId === "modal_close") {
              (e.target as HTMLElement)?.blur();
              executeShortcutAction("modal_close");
              e.preventDefault();
              return;
            }

            // Allow shortcuts with modifier keys (Alt, Ctrl) even while typing in inputs
            const hasModifier =
              combo.includes("alt") || combo.includes("ctrl") || combo.includes("meta");
            if (!hasModifier) {
              // Ignore single character shortcuts while typing in inputs
              continue;
            }
          }

          e.preventDefault();
          e.stopPropagation();
          executeShortcutAction(actionId as ShortcutActionId);
          return;
        }
      }
    };

    window.addEventListener("keydown", handleGlobalKeyDown);
    return () => {
      window.removeEventListener("keydown", handleGlobalKeyDown);
    };
  }, [
    shortcuts,
    filteredLeads,
    leads,
    selectedLeadIds,
    statusFilter,
    selectedHandler,
    settings.handlers,
    activeDateFilter,
  ]);

  const handleSignOutAndExit = async () => {
    try {
      await logOut();
    } catch (e) {
      console.warn("Sign out exception:", e);
    }
    setCurrentUser(null);
    setAppAuthenticated(false);
    setIsAuthenticated(false);
  };

  // 1. Landing Page View (Default first touch when domain is opened)
  if (currentPage === "landing") {
    return (
      <main id="main-landing-container" className="min-h-screen w-full bg-[#F8FAFC]">
        <SaaSLandingPage
          onLaunchApp={() => {
            setCurrentPage("tracker");
          }}
          onOpenSuperAdmin={() => {
            window.open(window.location.origin + window.location.pathname + "?portal=super_admin", "_blank");
          }}
        />
      </main>
    );
  }

  // 2. Super Admin Platform Console View (Dedicated Tab Window with Independent Login Gate)
  if (currentPage === "super_admin") {
    return (
      <main id="main-super-admin-container" className="min-h-screen w-full bg-slate-900">
        <SuperAdminPortal
          leads={leads}
          onDeleteLead={handleDeleteSingleLead}
          onClearAllLeads={handleClearAll}
          onNavigateToWorkspace={() => setCurrentPage("tracker")}
          onNavigateToLanding={() => setCurrentPage("landing")}
        />
      </main>
    );
  }

  // 3. Client / Customer Authentication Gate for Tracker / Workspace
  if (!isAuthenticated) {
    return (
      <LoginPage
        softwareTitle={settings.softwareTitle}
        onLoginSuccess={() => {
          setCurrentAuthUser(getCurrentAuthUser());
          setIsAuthenticated(true);
        }}
      />
    );
  }

  // 4. Mobile-First Native Mobile App Interface
  if (isMobileView && currentPage === "tracker") {
    return (
      <div id="mobile-app-root" className="h-[100dvh] max-h-[100dvh] w-full overflow-hidden bg-slate-100 dark:bg-slate-950 flex flex-col">
        <MobileAppShell
          leads={currentPageLeads}
          handlers={settings.handlers}
          uploadedFiles={currentPageFiles}
          onUpdateLead={handleSaveLead}
          onUpdateHandler={handleUpdateHandler}
          onUpdateStatus={handleUpdateStatus}
          onUpdateManualNotes={handleUpdateManualNotes}
          onDeleteLead={handleDeleteSingleLead}
          onOpenCallLog={(lead) => setCallLogLead(lead)}
          onOpenNewLeadModal={() => {
            setEditingLead(null);
            setIsLeadModalOpen(true);
          }}
          onOpenEditLeadModal={(lead) => {
            setEditingLead(lead);
            setIsLeadModalOpen(true);
          }}
          onLeadsExtracted={handleLeadsExtracted}
          onMultipleFilesExtracted={handleMultipleFilesExtracted}
          onSwitchToDesktop={() => setViewModeOverride("desktop")}
          onRequestSuperAdmin={() => setIsSuperAdminAuthModalOpen(true)}
          onOpenCompletionReports={() => setIsCompletedReportsOpen(true)}
          onUpdatePaymentDate={handleUpdatePaymentDate}
          onUpdatePaymentMethod={handleUpdatePaymentMethod}
          onUpdateCompletionStatus={handleUpdateCompletionStatus}
        />

        {/* Call Log Modal */}
        <CallLogModal
          lead={callLogLead}
          onClose={() => setCallLogLead(null)}
          onSaveCallLog={handleSaveCallLog}
          quickPresets={settings.quickNotePresets}
          handlerName={callLogLead?.handlerName}
        />

        {/* Add / Edit Lead Modal */}
        <LeadModal
          isOpen={isLeadModalOpen}
          onClose={() => {
            setIsLeadModalOpen(false);
            setEditingLead(null);
          }}
          onSaveLead={handleSaveLead}
          initialLead={editingLead}
          handlers={settings.handlers}
        />

        {/* PDF Report Generation Modal */}
        <PdfReportModal
          isOpen={isPdfModalOpen}
          onClose={() => {
            setIsPdfModalOpen(false);
            setPdfSelectedLeadIds(null);
            setPdfReportFileId(undefined);
          }}
          leads={pdfSelectedLeadIds ? leads.filter((l) => pdfSelectedLeadIds.includes(l.id)) : leads}
          handlers={settings.handlers}
          settings={settings}
          initialDateStr={pdfReportDate}
          files={uploadedFiles}
          initialFileId={pdfReportFileId}
        />

        {/* Weekly & Monthly Completed Clients & Payment Reports Modal */}
        <CompletedReportsModal
          isOpen={isCompletedReportsOpen}
          onClose={() => setIsCompletedReportsOpen(false)}
          leads={leads}
          handlers={settings.handlers}
          companyName={settings.companyName}
          softwareTitle={settings.softwareTitle}
        />

        {/* Super Admin Access Security Challenge Modal */}
        <SuperAdminAuthModal
          isOpen={isSuperAdminAuthModalOpen}
          onClose={() => setIsSuperAdminAuthModalOpen(false)}
          onSuccess={() => {
            setIsSuperAdminAuthModalOpen(false);
            setCurrentPage("super_admin");
          }}
        />
      </div>
    );
  }

  return (
    <div
      id="main-app-container"
      data-testid="main-container"
      className="main-container-scrollable h-screen max-h-screen overflow-y-auto bg-slate-50 flex flex-col text-slate-900 font-sans"
      style={{ overflowY: "auto", height: "100vh", maxHeight: "100vh" }}
    >
      {/* Top Application Bar with Navigation, Metrics, and Quick Actions */}
      <Header
        leads={currentPageLeads}
        softwareTitle={settings.softwareTitle}
        currentPage={currentPage}
        serverStatus={serverStatus}
        activeSessions={activeSessions}
        realtimeTransport={realtimeTransport}
        statusFilter={statusFilter}
        onStatusFilterChange={setStatusFilter}
        onNavigate={(page) => {
          if (page === "super_admin") {
            setIsSuperAdminAuthModalOpen(true);
            return;
          }
          setCurrentPage(page);
        }}
        onRequestSuperAdmin={() => setIsSuperAdminAuthModalOpen(true)}
        onSwitchToMobile={() => setViewModeOverride("mobile")}
        onExportCsv={() => exportLeadsToCsv(filteredLeads.length > 0 ? filteredLeads : currentPageLeads)}
        onExportExcel={() => exportLeadsToExcel(filteredLeads.length > 0 ? filteredLeads : currentPageLeads)}
        onOpenPdfReport={() => handleOpenPdfReport()}
        onOpenCompletionReports={() => setIsCompletedReportsOpen(true)}
        onOpenAddModal={() => {
          setEditingLead(null);
          setIsLeadModalOpen(true);
        }}
        onResetToSample={handleResetToSample}
        onClearAll={handleClearAll}
        handlersCount={settings.handlers.length}
        activeHandlerName={selectedHandler !== "all" ? selectedHandler : undefined}
        shortcutsMap={shortcuts}
        firebaseStatus={firebaseStatus}
        currentUser={currentUser}
        currentUserAccount={currentAuthUser}
        pages={pages}
        activePageId={activePageId}
        leadCountsByPage={leadCountsByPage}
        onSelectPage={handleSelectPage}
        onOpenCreatePageModal={() =>
          setPageModalState({ isOpen: true, mode: "create", targetPage: activePage })
        }
        onOpenDuplicatePageModal={(page) =>
          setPageModalState({ isOpen: true, mode: "duplicate", targetPage: page })
        }
        onOpenRenamePageModal={(page) =>
          setPageModalState({ isOpen: true, mode: "rename", targetPage: page })
        }
        onOpenDeletePageModal={(page) =>
          setPageModalState({ isOpen: true, mode: "delete", targetPage: page })
        }
        rbacConfig={rbacConfig}
        onUserAccountUpdated={(updatedUser) => setCurrentAuthUser(updatedUser)}
        onSignIn={async () => {
          try {
            await signInWithGoogle();
          } catch (err: any) {
            console.warn("Sign-in notice:", err?.code || err?.message || err);
          }
        }}
        onSignOut={handleSignOutAndExit}
        onAdminLogout={handleSignOutAndExit}
      />

      {/* Main Content Area */}
      {currentPage === "settings" ? (
        <main id="main-settings-container" className="flex-1 w-full max-w-full px-4 sm:px-6 py-5">
          <SettingsPage
            leads={leads}
            settings={settings}
            rbacConfig={rbacConfig}
            onSaveSettings={setSettings}
            onUpdateRbacConfig={(newCfg) => {
              setRbacConfig(newCfg);
              saveRbacConfigLocally(newCfg);
            }}
            onUserAccountUpdated={(updatedUser) => setCurrentAuthUser(updatedUser)}
            onBulkReassignHandler={handleBulkReassignHandler}
            onRestoreLeads={handleRestoreLeads}
            onResetToSample={handleResetToSample}
            onClearAllLeads={handleClearAll}
            onNavigateToTracker={() => setCurrentPage("tracker")}
          />
        </main>
      ) : currentPage === "shortcuts" ? (
        <main id="main-shortcuts-container" className="flex-1 w-full max-w-full px-4 sm:px-6 py-5">
          <ShortcutsPage
            shortcuts={shortcuts}
            onUpdateShortcut={handleUpdateShortcut}
            onResetAllShortcuts={handleResetAllShortcuts}
            onResetSingleShortcut={handleResetSingleShortcut}
            onExecuteAction={executeShortcutAction}
            onLeadsExtracted={handleLeadsExtracted}
            onNavigateToTracker={(targetDate) => {
              setCurrentPage("tracker");
              if (targetDate) {
                setActiveDateFilter(targetDate);
              }
            }}
          />
        </main>
      ) : (
        <main id="main-container" className="flex-1 w-full max-w-full px-4 sm:px-6 py-5 space-y-5">
          {/* Upload & Ingestion Accordion Panel with automatic Excel analysis */}
          <div id="section-upload-panel">
            <UploadSection
              onLeadsExtracted={handleLeadsExtracted}
              onMultipleFilesExtracted={handleMultipleFilesExtracted}
              presetUploadDate={presetUploadDate}
              handlers={settings.handlers}
              shortcutKey={
                shortcuts.drop_file_today
                  ? formatKeyDisplay(shortcuts.drop_file_today).join("+")
                  : "Alt+U"
              }
            />
          </div>

          {/* Horizontal, Scrollable Tab Navigation for Dates at the Top */}
          <DateTabNavigation
            files={currentPageFiles}
            leads={currentPageLeads}
            activeDateFilter={activeDateFilter}
            activeFileFilter={activeFileFilter}
            activeWorkspaceTab={activeWorkspaceTab}
            onSelectDateFilter={(dateStr) => {
              setActiveDateFilter(dateStr);
              if (dateStr === "all") {
                setActiveFileFilter("all");
                setActiveWorkspaceTab("all");
              }
            }}
            onSelectFileFilter={(fId) => {
              setActiveFileFilter(fId);
              if (fId !== "all") {
                setActiveWorkspaceTab(`file-${fId}`);
              } else {
                setActiveWorkspaceTab("all");
              }
            }}
            onDeleteFile={handleDeleteFile}
            onExportFileLeads={handleExportFileLeads}
            onQuickUploadForDate={handleQuickUploadForDate}
            onQuickUploadForTomorrow={handleQuickUploadForTomorrow}
            onOpenPdfReport={handleOpenPdfReport}
          />

          {/* Today's Handlers Workload & Task Allocation (Assigned Today vs Free Today) */}
          <TodayHandlersWorkload
            leads={currentPageLeads}
            handlers={settings.handlers}
            activeHandlerFilter={selectedHandler}
            onSelectHandlerFilter={(hName) => setSelectedHandler(hName)}
            onAssignUnassignedToHandler={handleAssignUnassignedToHandler}
            onAutoDistributeUnassigned={handleAutoDistributeUnassigned}
            onSwitchToUnassignedTab={() => {
              setActiveWorkspaceTab("unassigned");
              setActiveFileFilter("all");
            }}
            activeWorkspaceTab={activeWorkspaceTab}
            onOpenPdfReport={handleOpenPdfReport}
          />

          {/* Categorized Workspace Tabs: All Leads, Dedicated Unassigned Tasks, & Separate Excel Sheet Tabs */}
          <LeadWorkspaceTabs
            files={currentPageFiles}
            leads={currentPageLeads}
            activeTab={activeWorkspaceTab}
            onSelectTab={(tabId) => {
              setActiveWorkspaceTab(tabId);
              const { fileId } = parseWorkspaceTab(tabId);
              if (fileId !== "all") {
                setActiveFileFilter(fileId);
              } else {
                setActiveFileFilter("all");
              }
            }}
            onDeleteFile={handleDeleteFile}
            onExportFileLeads={handleExportFileLeads}
            handlers={settings.handlers}
            onBatchAssignAllUnassigned={handleBatchAssignAllUnassigned}
            onAutoDistributeUnassigned={handleAutoDistributeUnassigned}
            onOpenPdfReport={handleOpenPdfReport}
            onOpenCompletionReports={() => setIsCompletedReportsOpen(true)}
          />

          {/* Filters, Search, Status Navigation, and Handler Filter */}
          <LeadFilters
            leads={currentPageLeads}
            searchQuery={searchQuery}
            onSearchChange={setSearchQuery}
            statusFilter={statusFilter}
            onStatusFilterChange={setStatusFilter}
            selectedYear={selectedYear}
            onYearChange={setSelectedYear}
            availableYears={availableYears}
            selectedCity={selectedCity}
            onCityChange={setSelectedCity}
            availableCities={availableCities}
            sortBy={sortBy}
            onSortByChange={setSortBy}
            onResetFilters={handleResetFilters}
            hasActiveFilters={hasActiveFilters}
            selectedHandler={selectedHandler}
            onHandlerChange={setSelectedHandler}
            availableHandlers={settings.handlers}
            isSessionRestored={isSessionRestored.current}
          />

          {/* Lead Table with Payment Receipt, Proof, Month, Full Name, Phone (tel:), Email, City, and Manual Notes */}
          <LeadTable
            leads={filteredLeads}
            allLeads={currentPageLeads}
            activeWorkspaceTab={activeWorkspaceTab}
            onSelectWorkspaceTab={(tabId) => {
              setActiveWorkspaceTab(tabId);
              const { fileId } = parseWorkspaceTab(tabId);
              if (fileId !== "all") {
                setActiveFileFilter(fileId);
              } else {
                setActiveFileFilter("all");
              }
            }}
            selectedLeadIds={selectedLeadIds}
            onToggleSelectLead={handleToggleSelectLead}
            onToggleSelectBatch={handleToggleSelectBatch}
            onSelectAll={handleSelectAll}
            onClearSelection={handleClearSelection}
            onDeleteSelected={handleDeleteSelected}
            onBatchUpdateStatus={handleBatchUpdateStatus}
            onUpdateStatus={handleUpdateStatus}
            onUpdateMonth={handleUpdateMonth}
            onBatchUpdateMonth={handleBatchUpdateMonth}
            onUpdateNotes={handleUpdateNotes}
            onUpdateManualNotes={handleUpdateManualNotes}
            onOpenCallLog={(lead) => setCallLogLead(lead)}
            onEditLead={(lead) => {
              setEditingLead(lead);
              setIsLeadModalOpen(true);
            }}
            onDeleteLead={handleDeleteSingleLead}
            activeDateFilter={activeDateFilter}
            activeFileFilter={activeFileFilter}
            activeFileName={currentPageFiles.find((f) => f.id === activeFileFilter)?.fileName}
            onClearDateFilter={() => setActiveDateFilter("all")}
            onClearFileFilter={() => {
              setActiveFileFilter("all");
              if (activeWorkspaceTab.startsWith("file-")) {
                setActiveWorkspaceTab("all");
              }
            }}
            handlers={settings.handlers}
            onUpdateHandler={handleUpdateHandler}
            onBatchUpdateHandler={handleBatchUpdateHandler}
            onSaveCallLog={handleSaveCallLog}
            quickPresets={settings.quickNotePresets}
            onOpenPdfReport={handleOpenPdfReport}
            onOpenCompletionReports={() => setIsCompletedReportsOpen(true)}
            onUpdatePaymentDate={handleUpdatePaymentDate}
            onUpdatePaymentMethod={handleUpdatePaymentMethod}
            onUpdateCompletionStatus={handleUpdateCompletionStatus}
          />
        </main>
      )}

      {/* Footer */}
      <footer className="mt-auto py-5 border-t border-slate-200/80 bg-white text-center text-xs text-slate-500">
        <div className="w-full max-w-full px-4 sm:px-6 flex flex-col sm:flex-row items-center justify-between gap-2">
          <span>
            {settings.companyName ? `${settings.companyName} • ` : ""}
            {settings.softwareTitle || "Lead & Payment Tracker"} • Direct manual entry notes per client
          </span>
          <span className="text-slate-400">
            Fields: Payment Receipt • Proof • Month • Full Name • Phone (tel:) • Email • City • Manual Notes (Type Here)
          </span>
        </div>
      </footer>

      {/* Floating Undo Toast Notification */}
      {undoToast && (
        <div className="fixed bottom-6 right-6 z-50 bg-slate-900 text-white px-4 py-3 rounded-xl shadow-xl border border-slate-700 flex items-center gap-3 animate-in slide-in-from-bottom-5 duration-200">
          <span className="text-xs sm:text-sm">{undoToast.message}</span>
          {undoToast.deletedLeads && undoToast.deletedLeads.length > 0 && (
            <button
              id="btn-undo-delete"
              type="button"
              onClick={handleRestoreUndo}
              className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-bold text-amber-300 hover:text-amber-200 bg-slate-800 hover:bg-slate-700 rounded-lg cursor-pointer transition-colors"
            >
              <RotateCcw className="w-3 h-3" />
              Undo
            </button>
          )}
          {undoToast.actionLabel && undoToast.onAction && (
            <button
              id="btn-toast-action"
              type="button"
              onClick={() => {
                undoToast.onAction?.();
                setUndoToast(null);
              }}
              className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-bold text-indigo-300 hover:text-white bg-indigo-900/70 hover:bg-indigo-800 rounded-lg cursor-pointer transition-colors"
            >
              {undoToast.actionLabel}
            </button>
          )}
          <button
            type="button"
            onClick={() => setUndoToast(null)}
            className="text-slate-400 hover:text-white text-xs ml-1 cursor-pointer"
          >
            ✕
          </button>
        </div>
      )}

      {/* In-App Deletion Confirmation Modal */}
      <DeleteConfirmModal
        isOpen={deleteConfirm.isOpen}
        onClose={() => setDeleteConfirm((prev) => ({ ...prev, isOpen: false }))}
        onConfirm={deleteConfirm.onConfirm}
        title={deleteConfirm.title}
        description={deleteConfirm.description}
        itemCount={deleteConfirm.itemCount}
      />

      {/* Call Log & Outcome Modal */}
      <CallLogModal
        lead={callLogLead}
        onClose={() => setCallLogLead(null)}
        onSaveCallLog={handleSaveCallLog}
        quickPresets={settings.quickNotePresets}
        handlerName={callLogLead?.handlerName}
      />

      {/* Add / Edit Lead Modal */}
      <LeadModal
        isOpen={isLeadModalOpen}
        onClose={() => {
          setIsLeadModalOpen(false);
          setEditingLead(null);
        }}
        onSaveLead={handleSaveLead}
        initialLead={editingLead}
        handlers={settings.handlers}
      />

      {/* PDF Report Generation Modal */}
      <PdfReportModal
        isOpen={isPdfModalOpen}
        onClose={() => {
          setIsPdfModalOpen(false);
          setPdfSelectedLeadIds(null);
          setPdfReportFileId(undefined);
        }}
        leads={pdfSelectedLeadIds ? currentPageLeads.filter((l) => pdfSelectedLeadIds.includes(l.id)) : currentPageLeads}
        handlers={settings.handlers}
        settings={settings}
        initialDateStr={pdfReportDate}
        files={currentPageFiles}
        initialFileId={pdfReportFileId}
      />

      {/* Weekly & Monthly Completed Clients & Payment Reports Modal */}
      <CompletedReportsModal
        isOpen={isCompletedReportsOpen}
        onClose={() => setIsCompletedReportsOpen(false)}
        leads={currentPageLeads}
        handlers={settings.handlers}
        companyName={settings.companyName}
        softwareTitle={settings.softwareTitle}
      />

      {/* Super Admin Access Security Challenge Modal */}
      <SuperAdminAuthModal
        isOpen={isSuperAdminAuthModalOpen}
        onClose={() => setIsSuperAdminAuthModalOpen(false)}
        onSuccess={() => {
          setIsSuperAdminAuthModalOpen(false);
          setCurrentPage("super_admin");
        }}
      />

      {/* Unlimited Workspace Page Manager Modal (Create Blank, Duplicate, Rename, Delete) */}
      <PageModal
        isOpen={pageModalState.isOpen}
        mode={pageModalState.mode}
        targetPage={pageModalState.targetPage}
        activePage={activePage}
        pageLeadsCount={currentPageLeads.length}
        pageFilesCount={currentPageFiles.length}
        onClose={() => setPageModalState((prev) => ({ ...prev, isOpen: false }))}
        onCreateBlank={handleCreateBlankPage}
        onDuplicatePage={handleDuplicatePage}
        onRenamePage={handleRenamePage}
        onDeletePage={handleDeletePage}
        totalPagesCount={pages.length}
      />
    </div>
  );
}

