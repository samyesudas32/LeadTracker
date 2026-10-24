import { Lead, UploadedFileRecord, AppSettings } from "../types";
import { apiClient } from "./apiClient";

export type RealtimeTransport = "websocket" | "sse" | "polling" | "disconnected";
export type RealtimeStatus = "connected" | "connecting" | "offline";

export interface RealtimeEventPayload {
  type: string;
  version?: number;
  timestamp?: number;
  activeSessions?: number;
  sourceClientId?: string;
  leadId?: string;
  updates?: Partial<Lead>;
  updatedLead?: Lead;
  leads?: Lead[];
  files?: UploadedFileRecord[];
  settings?: AppSettings;
  shortcuts?: Record<string, string>;
  [key: string]: any;
}

export type RealtimeListener = (event: RealtimeEventPayload) => void;
export type StatusListener = (status: RealtimeStatus, transport: RealtimeTransport, activeSessions: number) => void;

class RealtimeSyncService {
  private ws: WebSocket | null = null;
  private sseUnsubscribe: (() => void) | null = null;
  private isDestroyed = false;
  private clientId: string = "";
  private reconnectTimer: any = null;
  private heartbeatTimer: any = null;
  private pollTimer: any = null;
  private reconnectAttempts = 0;
  private currentVersion = 0;
  private activeSessionsCount = 1;
  private currentTransport: RealtimeTransport = "disconnected";
  private currentStatus: RealtimeStatus = "connecting";

  private eventListeners = new Set<RealtimeListener>();
  private statusListeners = new Set<StatusListener>();

  constructor() {
    this.clientId = "client-" + Math.random().toString(36).substring(2, 11) + "-" + Date.now().toString(36);
  }

  public getClientId(): string {
    return this.clientId;
  }

  public setClientId(id: string): void {
    if (id) this.clientId = id;
  }

  public getStatus(): RealtimeStatus {
    return this.currentStatus;
  }

  public getTransport(): RealtimeTransport {
    return this.currentTransport;
  }

  public getActiveSessions(): number {
    return this.activeSessionsCount;
  }

  public getVersion(): number {
    return this.currentVersion;
  }

  public setVersion(v: number): void {
    if (typeof v === "number" && v > this.currentVersion) {
      this.currentVersion = v;
    }
  }

  public subscribe(listener: RealtimeListener): () => void {
    this.eventListeners.add(listener);
    return () => {
      this.eventListeners.delete(listener);
    };
  }

  public onStatusChange(listener: StatusListener): () => void {
    this.statusListeners.add(listener);
    // Emit initial status
    try {
      listener(this.currentStatus, this.currentTransport, this.activeSessionsCount);
    } catch (_) {}
    return () => {
      this.statusListeners.delete(listener);
    };
  }

  private notifyStatus(status: RealtimeStatus, transport: RealtimeTransport) {
    this.currentStatus = status;
    this.currentTransport = transport;
    for (const listener of this.statusListeners) {
      try {
        listener(status, transport, this.activeSessionsCount);
      } catch (err) {
        console.warn("Realtime status listener error:", err);
      }
    }
  }

  private notifyEvent(event: RealtimeEventPayload) {
    if (event.version && typeof event.version === "number") {
      this.setVersion(event.version);
    }
    if (typeof event.activeSessions === "number") {
      this.activeSessionsCount = event.activeSessions;
      this.notifyStatus(this.currentStatus, this.currentTransport);
    }

    for (const listener of this.eventListeners) {
      try {
        listener(event);
      } catch (err) {
        console.warn("Realtime event listener error:", err);
      }
    }
  }

  public init(): void {
    if (typeof window === "undefined") return;
    this.isDestroyed = false;

    // Listen to browser network connectivity
    window.addEventListener("online", this.handleOnline);
    window.addEventListener("offline", this.handleOffline);

    // Start primary WebSocket connection
    this.connectWebSocket();

    // Start background reconciliation heartbeat (every 6 seconds)
    this.startBackgroundReconciliation();
  }

  private handleOnline = () => {
    this.notifyStatus("connecting", this.currentTransport);
    this.reconnectAttempts = 0;
    this.connectWebSocket();
  };

  private handleOffline = () => {
    this.notifyStatus("offline", "disconnected");
  };

  private getWsUrl(): string {
    const isHttps = window.location.protocol === "https:";
    const protocol = isHttps ? "wss:" : "ws:";
    return `${protocol}//${window.location.host}/api/ws`;
  }

  private connectWebSocket(): void {
    if (this.isDestroyed) return;
    this.cleanupWebSocket();

    const wsUrl = this.getWsUrl();

    try {
      this.notifyStatus("connecting", "websocket");
      const ws = new WebSocket(wsUrl);
      this.ws = ws;

      let connectionTimeout = setTimeout(() => {
        // If WebSocket doesn't open within 3.5s, fall back to SSE
        if (ws.readyState !== WebSocket.OPEN) {
          console.info("[Realtime] WebSocket connection slow/unsupported; activating SSE fallback.");
          this.fallbackToSse();
        }
      }, 3500);

      ws.onopen = () => {
        clearTimeout(connectionTimeout);
        this.reconnectAttempts = 0;
        this.notifyStatus("connected", "websocket");
        // Clean up SSE if active
        if (this.sseUnsubscribe) {
          this.sseUnsubscribe();
          this.sseUnsubscribe = null;
        }
        // Send initial ping to confirm channel
        this.sendWs({ action: "ping", clientId: this.clientId });
        this.startHeartbeat();
      };

      ws.onmessage = (event) => {
        try {
          const data: RealtimeEventPayload = JSON.parse(event.data);
          this.notifyEvent(data);
        } catch (err) {
          console.warn("[Realtime] Could not parse WebSocket payload:", err);
        }
      };

      ws.onerror = (err) => {
        console.warn("[Realtime] WebSocket error notice:", err);
        clearTimeout(connectionTimeout);
        this.fallbackToSse();
      };

      ws.onclose = () => {
        clearTimeout(connectionTimeout);
        this.cleanupWebSocket();
        if (!this.isDestroyed) {
          this.fallbackToSse();
          this.scheduleReconnect();
        }
      };
    } catch (e) {
      console.warn("[Realtime] WebSocket initialization exception:", e);
      this.fallbackToSse();
    }
  }

  private fallbackToSse(): void {
    if (this.isDestroyed || this.sseUnsubscribe) return;

    try {
      this.notifyStatus("connecting", "sse");
      this.sseUnsubscribe = apiClient.subscribeToLiveStream(
        (data) => {
          this.notifyStatus("connected", "sse");
          this.notifyEvent(data);
        },
        (err) => {
          console.warn("[Realtime] SSE connection notice:", err);
          this.notifyStatus("offline", "polling");
        }
      );
      this.notifyStatus("connected", "sse");
    } catch (err) {
      console.warn("[Realtime] SSE activation error:", err);
      this.notifyStatus("offline", "polling");
    }
  }

  private scheduleReconnect(): void {
    if (this.isDestroyed || this.reconnectTimer) return;
    this.reconnectAttempts++;
    // Exponential backoff capped at 8 seconds
    const delay = Math.min(1000 * Math.pow(1.5, this.reconnectAttempts), 8000);
    this.reconnectTimer = setTimeout(() => {
      this.reconnectTimer = null;
      if (!this.isDestroyed) {
        this.connectWebSocket();
      }
    }, delay);
  }

  private startHeartbeat(): void {
    this.stopHeartbeat();
    this.heartbeatTimer = setInterval(() => {
      if (this.ws && this.ws.readyState === WebSocket.OPEN) {
        this.sendWs({ action: "ping", clientId: this.clientId });
      }
    }, 15000);
  }

  private stopHeartbeat(): void {
    if (this.heartbeatTimer) {
      clearInterval(this.heartbeatTimer);
      this.heartbeatTimer = null;
    }
  }

  private startBackgroundReconciliation(): void {
    if (this.pollTimer) clearInterval(this.pollTimer);
    // Every 6 seconds, check server version as a resilient safety net
    this.pollTimer = setInterval(async () => {
      if (this.isDestroyed) return;
      try {
        const health = await apiClient.checkHealth();
        if (health && typeof health.version === "number") {
          if (this.currentVersion > 0 && health.version > this.currentVersion) {
            // Version mismatch detected - trigger sync
            this.setVersion(health.version);
            this.notifyEvent({
              type: "leads_updated",
              version: health.version,
              timestamp: Date.now(),
              reason: "version_reconciliation",
            });
          }
        }
      } catch (_) {
        // network transient, ignore
      }
    }, 6000);
  }

  private cleanupWebSocket(): void {
    this.stopHeartbeat();
    if (this.ws) {
      try {
        this.ws.onopen = null;
        this.ws.onmessage = null;
        this.ws.onerror = null;
        this.ws.onclose = null;
        this.ws.close();
      } catch (_) {}
      this.ws = null;
    }
  }

  private sendWs(payload: any): boolean {
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      try {
        this.ws.send(JSON.stringify({ ...payload, clientId: this.clientId }));
        return true;
      } catch (err) {
        console.warn("[Realtime] Error sending WS message:", err);
      }
    }
    return false;
  }

  // Real-time Mutation Dispatchers (instantly push to WebSocket, fallback to REST API)
  public async patchLead(leadId: string, updates: Partial<Lead>): Promise<void> {
    const wsSent = this.sendWs({
      action: "patch_lead",
      leadId,
      updates,
    });

    // Always invoke REST API in parallel for atomic persistence and SSE propagation
    try {
      await apiClient.updateLead(leadId, updates, this.clientId);
    } catch (err) {
      if (!wsSent) {
        throw err;
      }
    }
  }

  public async syncLeads(leads: Lead[]): Promise<void> {
    const wsSent = this.sendWs({
      action: "sync_leads",
      leads,
    });

    try {
      await apiClient.syncLeads(leads, this.clientId);
    } catch (err) {
      if (!wsSent) {
        throw err;
      }
    }
  }

  public async syncFiles(files: UploadedFileRecord[]): Promise<void> {
    const wsSent = this.sendWs({
      action: "sync_files",
      files,
    });

    try {
      await apiClient.syncFiles(files, this.clientId);
    } catch (err) {
      if (!wsSent) {
        throw err;
      }
    }
  }

  public async syncSettings(settings: AppSettings): Promise<void> {
    const wsSent = this.sendWs({
      action: "sync_settings",
      settings,
    });

    try {
      await apiClient.saveSettings(settings);
    } catch (err) {
      if (!wsSent) {
        throw err;
      }
    }
  }

  public async deleteLead(leadId: string): Promise<void> {
    const wsSent = this.sendWs({
      action: "delete_lead",
      leadId,
    });

    try {
      await apiClient.deleteLead(leadId, this.clientId);
    } catch (err) {
      if (!wsSent) {
        throw err;
      }
    }
  }

  public async bulkDeleteLeads(ids: string[]): Promise<void> {
    const wsSent = this.sendWs({
      action: "bulk_delete_leads",
      ids,
    });

    try {
      await apiClient.bulkDeleteLeads(ids, this.clientId);
    } catch (err) {
      if (!wsSent) {
        throw err;
      }
    }
  }

  public async deleteFile(fileId: string): Promise<void> {
    const wsSent = this.sendWs({
      action: "delete_file",
      fileId,
    });

    try {
      await apiClient.deleteFile(fileId, this.clientId);
    } catch (err) {
      if (!wsSent) {
        throw err;
      }
    }
  }

  public async clearAll(): Promise<void> {
    const wsSent = this.sendWs({
      action: "clear_all",
    });

    try {
      await Promise.all([
        apiClient.clearAllLeads(this.clientId),
        apiClient.clearAllFiles(this.clientId),
      ]);
    } catch (err) {
      if (!wsSent) {
        throw err;
      }
    }
  }

  public destroy(): void {
    this.isDestroyed = true;
    if (typeof window !== "undefined") {
      window.removeEventListener("online", this.handleOnline);
      window.removeEventListener("offline", this.handleOffline);
    }
    this.cleanupWebSocket();
    if (this.sseUnsubscribe) {
      this.sseUnsubscribe();
      this.sseUnsubscribe = null;
    }
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }
    if (this.pollTimer) {
      clearInterval(this.pollTimer);
      this.pollTimer = null;
    }
    this.eventListeners.clear();
    this.statusListeners.clear();
  }
}

export const realtimeSync = new RealtimeSyncService();
