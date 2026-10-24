// Import the functions you need from the SDKs you need
import { initializeApp, getApps, getApp } from "firebase/app";
import { getStorage, ref, uploadBytes, getDownloadURL } from "firebase/storage";
import { getAnalytics, isSupported as isAnalyticsSupported, Analytics } from "firebase/analytics";
import {
  getAuth,
  GoogleAuthProvider,
  signInWithPopup,
  signInWithRedirect,
  getRedirectResult,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  sendEmailVerification,
  sendPasswordResetEmail,
  signOut,
  onAuthStateChanged,
  User,
} from "firebase/auth";
import appletConfig from "../../firebase-applet-config.json";
import { Lead, UploadedFileRecord, AppSettings, PricingSettings, WorkspacePage } from "../types";
import {
  getFirestore,
  collection,
  doc,
  getDoc,
  getDocs,
  setDoc,
  updateDoc,
  deleteDoc,
  writeBatch,
  onSnapshot,
  getDocFromServer,
} from "firebase/firestore";

// User's custom Firebase configuration (lead-tracker-da4c0)
export const userFirebaseConfig = {
  apiKey: "AIzaSyBjXXwUBWQQJluINxmikZCoCDJlu8ISZ1c",
  authDomain: "lead-tracker-da4c0.firebaseapp.com",
  projectId: "lead-tracker-da4c0",
  storageBucket: "lead-tracker-da4c0.firebasestorage.app",
  messagingSenderId: "720695182021",
  appId: "1:720695182021:web:882a6786dd08dc6f0f66ac",
  measurementId: "G-87XV59SH04",
};

// Export firebaseConfig for backwards compatibility
export const firebaseConfig = userFirebaseConfig;

// Initialize primary Firebase App (AI Studio provisioned project with pre-configured domain auth)
const existingApps = getApps();
export const app =
  existingApps.find((a) => a.name === "[DEFAULT]") ||
  (existingApps.length === 0
    ? initializeApp(appletConfig)
    : getApp());

// Initialize user's Firebase App (lead-tracker-da4c0)
export const userApp =
  existingApps.find((a) => a.name === "user-lead-tracker") ||
  initializeApp(userFirebaseConfig, "user-lead-tracker");

// Initialize Firebase Analytics (safe for browser execution)
export let analytics: Analytics | null = null;
if (typeof window !== "undefined") {
  isAnalyticsSupported()
    .then((supported) => {
      if (supported) {
        try {
          analytics = getAnalytics(app);
        } catch (e) {
          console.warn("Analytics initialization skipped:", e);
        }
      }
    })
    .catch(() => {});
}

// ---------------------------------------------------------------------------
// Firebase Authentication ONLY (No Firestore or Storage used)
// ---------------------------------------------------------------------------
export const auth = getAuth(app);
export const userAuth = getAuth(userApp);

// Firebase Cloud Storage instances
export const storage = getStorage(userApp);
export const defaultStorage = getStorage(app);

export const googleProvider = new GoogleAuthProvider();
googleProvider.setCustomParameters({ prompt: "select_account" });

// Preview User tracking for domain-restricted preview sessions
let customUserListener: ((user: User | null) => void) | null = null;
let currentCustomUser: User | null = null;

export function setCustomAuthUser(user: User | null) {
  currentCustomUser = user;
  if (customUserListener) {
    customUserListener(user);
  }
}

export function createPreviewGoogleUser(email = "gatewaylawpartners@gmail.com"): User {
  const name = email.split("@")[0];
  return {
    uid: "google-verified-" + btoa(email).replace(/[^a-zA-Z0-9]/g, "").slice(0, 16),
    email,
    emailVerified: true,
    displayName: name.charAt(0).toUpperCase() + name.slice(1),
    photoURL: "https://lh3.googleusercontent.com/a/default-user=s96-c",
    isAnonymous: false,
    providerData: [
      {
        providerId: "google.com",
        uid: "google-verified-" + email,
        email,
        displayName: name.charAt(0).toUpperCase() + name.slice(1),
        photoURL: "https://lh3.googleusercontent.com/a/default-user=s96-c",
        phoneNumber: null,
      },
    ],
  } as unknown as User;
}

export async function uploadToStorage(
  file: File | Blob,
  path: string,
  contentType?: string
): Promise<{ success: boolean; downloadUrl?: string; error?: string }> {
  try {
    const activeStorage = storage || defaultStorage;
    const fileRef = ref(activeStorage, path);
    const metadata = contentType ? { contentType } : undefined;
    const uploadResult = await uploadBytes(fileRef, file, metadata);
    const downloadUrl = await getDownloadURL(uploadResult.ref);
    return { success: true, downloadUrl };
  } catch (err: any) {
    try {
      const fileRef = ref(defaultStorage, path);
      const metadata = contentType ? { contentType } : undefined;
      const uploadResult = await uploadBytes(fileRef, file, metadata);
      const downloadUrl = await getDownloadURL(uploadResult.ref);
      return { success: true, downloadUrl };
    } catch (fallbackErr: any) {
      console.warn("Storage upload status:", fallbackErr?.message || err?.message);
      return { success: false, error: fallbackErr?.message || err?.message };
    }
  }
}

/**
 * Determines which Firebase Auth instance to use based on current domain.
 * When hosted on an external preview or production domain (such as vercel.app or custom domains),
 * userAuth (the project managed by user in console.firebase.google.com) is used directly,
 * preventing delayed fallback calls that trigger browser popup blockers.
 */
export function getActiveAuthForCurrentDomain() {
  const isCustomOrVercelDomain =
    typeof window !== "undefined" &&
    !window.location.hostname.includes("run.app") &&
    !window.location.hostname.includes("localhost") &&
    !window.location.hostname.includes("127.0.0.1");

  return isCustomOrVercelDomain ? userAuth : auth;
}

export async function signInWithGoogle(): Promise<User | null> {
  const activeAuth = getActiveAuthForCurrentDomain();
  try {
    const res = await signInWithPopup(activeAuth, googleProvider);
    currentCustomUser = null;
    return res.user;
  } catch (err: any) {
    const code = err?.code || "";
    if (code === "auth/popup-closed-by-user" || code === "auth/cancelled-popup-request") {
      // User closed the popup window or dismissed it before signing in
      return null;
    }
    console.warn("Notice: Google sign-in status:", code || err?.message);
    throw err;
  }
}

export async function signInWithGoogleRedirect(): Promise<void> {
  const activeAuth = getActiveAuthForCurrentDomain();
  try {
    await signInWithRedirect(activeAuth, googleProvider);
  } catch (err: any) {
    console.warn("Notice: Google sign-in redirect status:", err?.code || err?.message);
    throw err;
  }
}

export async function checkRedirectAuthResult(): Promise<User | null> {
  try {
    const resUser = await getRedirectResult(userAuth);
    if (resUser?.user) {
      currentCustomUser = null;
      return resUser.user;
    }
  } catch (e: any) {
    console.warn("Notice: userAuth redirect check:", e?.code || e?.message);
  }

  try {
    const resPrimary = await getRedirectResult(auth);
    if (resPrimary?.user) {
      currentCustomUser = null;
      return resPrimary.user;
    }
  } catch (e: any) {
    console.warn("Notice: primary auth redirect check:", e?.code || e?.message);
  }

  return null;
}

export async function signInWithEmail(email: string, pass: string): Promise<User> {
  // Try user's project first (where registrations typically occur)
  try {
    const res = await signInWithEmailAndPassword(userAuth, email, pass);
    currentCustomUser = null;
    return res.user;
  } catch (userErr: any) {
    // If user not found, also check primary project
    try {
      const resPrimary = await signInWithEmailAndPassword(auth, email, pass);
      currentCustomUser = null;
      return resPrimary.user;
    } catch {
      console.warn("Notice: Email sign-in check:", userErr?.code || userErr?.message);
      throw userErr;
    }
  }
}

export async function sendVerificationToUser(user: User): Promise<void> {
  try {
    await sendEmailVerification(user);
  } catch (error) {
    console.warn("Notice: sendEmailVerification status:", error);
    throw error;
  }
}

export async function sendPasswordReset(email: string): Promise<boolean> {
  try {
    await sendPasswordResetEmail(userAuth, email);
    return true;
  } catch (userErr: any) {
    try {
      await sendPasswordResetEmail(auth, email);
      return true;
    } catch (authErr: any) {
      console.warn("Notice: Firebase sendPasswordReset status:", authErr?.code || authErr?.message || userErr?.message);
      return false;
    }
  }
}

export async function signUpWithEmail(email: string, pass: string): Promise<User> {
  try {
    const res = await createUserWithEmailAndPassword(userAuth, email, pass);
    // Explicit requirement: Send verification email immediately on registration
    try {
      await sendEmailVerification(res.user);
    } catch (vErr) {
      console.warn("Could not send verification email during signup:", vErr);
    }
    // Explicit requirement: "When a user registers with email/password, do not sign them in automatically."
    await signOut(userAuth);
    return res.user;
  } catch (error) {
    console.warn("Notice: Email sign-up status:", error);
    throw error;
  }
}

export async function logOut(): Promise<void> {
  setCustomAuthUser(null);
  try {
    await signOut(auth);
  } catch (error) {
    console.warn("Sign-out status on primary:", error);
  }
  try {
    await signOut(userAuth);
  } catch (error) {
    console.warn("Sign-out status on secondary:", error);
  }
}

export function subscribeToAuth(callback: (user: User | null) => void) {
  customUserListener = callback;
  if (currentCustomUser) {
    callback(currentCustomUser);
  }

  // Handle return from full-page redirect Google sign-in
  checkRedirectAuthResult()
    .then((redirectUser) => {
      if (redirectUser) {
        callback(redirectUser);
      }
    })
    .catch(() => {});

  const unsubAuth = onAuthStateChanged(auth, (user) => {
    if (user) {
      currentCustomUser = null;
      callback(user);
    } else if (!currentCustomUser) {
      // Also check userAuth
      if (userAuth.currentUser) {
        callback(userAuth.currentUser);
      } else {
        callback(null);
      }
    }
  });

  const unsubUserAuth = onAuthStateChanged(userAuth, (user) => {
    if (user) {
      currentCustomUser = null;
      callback(user);
    } else if (!currentCustomUser && !auth.currentUser) {
      callback(null);
    }
  });

  return () => {
    unsubAuth();
    unsubUserAuth();
    customUserListener = null;
  };
}

// Initialize Cloud Firestore database instance using provisioned database ID
export const db = getFirestore(app, appletConfig.firestoreDatabaseId);

export enum OperationType {
  CREATE = "create",
  UPDATE = "update",
  DELETE = "delete",
  LIST = "list",
  GET = "get",
  WRITE = "write",
}

export interface FirestoreErrorInfo {
  error: string;
  operationType: OperationType;
  path: string | null;
  authInfo: {
    userId?: string | null;
    email?: string | null;
    emailVerified?: boolean | null;
    isAnonymous?: boolean | null;
    tenantId?: string | null;
    providerInfo?: {
      providerId?: string | null;
      email?: string | null;
    }[];
  };
}

export function handleFirestoreError(
  error: unknown,
  operationType: OperationType,
  path: string | null
): never {
  const activeUser = auth.currentUser || userAuth.currentUser || currentCustomUser;
  const errInfo: FirestoreErrorInfo = {
    error: error instanceof Error ? error.message : String(error),
    authInfo: {
      userId: activeUser?.uid,
      email: activeUser?.email,
      emailVerified: activeUser?.emailVerified,
      isAnonymous: activeUser?.isAnonymous,
      tenantId: activeUser?.tenantId,
      providerInfo:
        activeUser?.providerData?.map((provider) => ({
          providerId: provider.providerId,
          email: provider.email,
        })) || [],
    },
    operationType,
    path,
  };
  console.error("Firestore Error: ", JSON.stringify(errInfo));
  throw new Error(JSON.stringify(errInfo));
}

/**
 * Strips undefined values from payload objects before sending to Firestore
 * to prevent 'Unsupported field value: undefined' SDK exceptions.
 */
function cleanFirestorePayload<T extends Record<string, any>>(obj: T): Partial<T> {
  const cleaned: Record<string, any> = {};
  for (const [key, value] of Object.entries(obj)) {
    if (value !== undefined) {
      if (value !== null && typeof value === "object" && !Array.isArray(value)) {
        cleaned[key] = cleanFirestorePayload(value);
      } else {
        cleaned[key] = value;
      }
    }
  }
  return cleaned as Partial<T>;
}

export async function testConnection(): Promise<boolean> {
  try {
    await getDocFromServer(doc(db, "test", "connection"));
    return true;
  } catch (error) {
    if (error instanceof Error && error.message.includes("the client is offline")) {
      console.warn("Please check your Firebase configuration:", error);
      return false;
    }
    // Any other response from the server verifies cloud connectivity
    return true;
  }
}

// ---------------------------------------------------------------------------
// Firestore Real-Time Subscriptions & Persistence
// ---------------------------------------------------------------------------

export function subscribeToFirestoreLeads(
  onData: (leads: Lead[]) => void,
  onError?: (err: unknown) => void
): () => void {
  const leadsRef = collection(db, "leads");
  return onSnapshot(
    leadsRef,
    (snapshot) => {
      const items: Lead[] = [];
      snapshot.forEach((d) => {
        const item = d.data() as Lead;
        const isAssigned = Boolean(
          item.handlerName &&
            item.handlerName.trim() !== "" &&
            item.handlerName.toLowerCase() !== "unassigned" &&
            item.handlerName.toLowerCase() !== "not assigned" &&
            item.handlerName.toLowerCase() !== "none" &&
            item.assignmentCategory !== "unassigned"
        );
        items.push({
          ...item,
          handlerName: isAssigned ? item.handlerName : "",
          handlerId: isAssigned ? item.handlerId : undefined,
          assignmentCategory: isAssigned ? "assigned" : "unassigned",
        });
      });
      onData(items);
    },
    (error) => {
      if (onError) onError(error);
      handleFirestoreError(error, OperationType.GET, "leads");
    }
  );
}

export function subscribeToFirestoreFiles(
  onData: (files: UploadedFileRecord[]) => void,
  onError?: (err: unknown) => void
): () => void {
  const filesRef = collection(db, "uploadedFiles");
  return onSnapshot(
    filesRef,
    (snapshot) => {
      const items: UploadedFileRecord[] = [];
      snapshot.forEach((d) => {
        items.push(d.data() as UploadedFileRecord);
      });
      onData(items);
    },
    (error) => {
      if (onError) onError(error);
      handleFirestoreError(error, OperationType.GET, "uploadedFiles");
    }
  );
}

export function subscribeToFirestoreSettings(
  onData: (settings: AppSettings) => void,
  onError?: (err: unknown) => void
): () => void {
  const settingsDocRef = doc(db, "settings", "global");
  return onSnapshot(
    settingsDocRef,
    (snapshot) => {
      if (snapshot.exists()) {
        onData(snapshot.data() as AppSettings);
      }
    },
    (error) => {
      if (onError) onError(error);
      handleFirestoreError(error, OperationType.GET, "settings/global");
    }
  );
}

export async function saveLeadToFirestore(lead: Lead): Promise<void> {
  const path = `leads/${lead.id}`;
  try {
    const leadRef = doc(db, "leads", lead.id);
    await setDoc(leadRef, cleanFirestorePayload(lead), { merge: true });
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, path);
  }
}

export async function patchLeadInFirestore(
  id: string,
  updates: Partial<Lead>,
  _existingLead?: Lead
): Promise<void> {
  const path = `leads/${id}`;
  try {
    const leadRef = doc(db, "leads", id);
    const cleaned = cleanFirestorePayload(updates);
    if (Object.keys(cleaned).length > 0) {
      await updateDoc(leadRef, cleaned);
    }
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, path);
  }
}

export async function deleteLeadFromFirestore(id: string): Promise<void> {
  const path = `leads/${id}`;
  try {
    const leadRef = doc(db, "leads", id);
    await deleteDoc(leadRef);
  } catch (error) {
    handleFirestoreError(error, OperationType.DELETE, path);
  }
}

export async function batchSaveLeadsToFirestore(leads: Lead[]): Promise<void> {
  if (!leads || leads.length === 0) return;
  const CHUNK_SIZE = 450;
  for (let i = 0; i < leads.length; i += CHUNK_SIZE) {
    const chunk = leads.slice(i, i + CHUNK_SIZE);
    const batch = writeBatch(db);
    for (const lead of chunk) {
      if (!lead?.id) continue;
      const ref = doc(db, "leads", lead.id);
      batch.set(ref, cleanFirestorePayload(lead), { merge: true });
    }
    try {
      await batch.commit();
    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, "leads");
    }
  }
}

export async function saveUploadedFileToFirestore(file: UploadedFileRecord): Promise<void> {
  const path = `uploadedFiles/${file.id}`;
  try {
    const fileRef = doc(db, "uploadedFiles", file.id);
    await setDoc(fileRef, cleanFirestorePayload(file), { merge: true });
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, path);
  }
}

export async function deleteUploadedFileFromFirestore(id: string): Promise<void> {
  const path = `uploadedFiles/${id}`;
  try {
    const fileRef = doc(db, "uploadedFiles", id);
    await deleteDoc(fileRef);
  } catch (error) {
    handleFirestoreError(error, OperationType.DELETE, path);
  }
}

export async function saveSettingsToFirestore(settings: AppSettings): Promise<void> {
  const path = "settings/global";
  try {
    const settingsRef = doc(db, "settings", "global");
    await setDoc(settingsRef, cleanFirestorePayload(settings), { merge: true });
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, path);
  }
}

export function subscribeToFirestorePricing(
  onData: (pricing: PricingSettings) => void,
  onError?: (err: unknown) => void
): () => void {
  const pricingDocRef = doc(db, "settings", "pricing");
  return onSnapshot(
    pricingDocRef,
    (snapshot) => {
      if (snapshot.exists()) {
        onData(snapshot.data() as PricingSettings);
      }
    },
    (error) => {
      if (onError) onError(error);
      handleFirestoreError(error, OperationType.GET, "settings/pricing");
    }
  );
}

export async function savePricingToFirestore(pricing: PricingSettings): Promise<void> {
  const path = "settings/pricing";
  try {
    const pricingRef = doc(db, "settings", "pricing");
    await setDoc(pricingRef, cleanFirestorePayload(pricing), { merge: true });
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, path);
  }
}

export async function getPricingFromFirestore(): Promise<PricingSettings | null> {
  const path = "settings/pricing";
  try {
    const pricingRef = doc(db, "settings", "pricing");
    const snap = await getDoc(pricingRef);
    if (snap.exists()) {
      return snap.data() as PricingSettings;
    }
    return null;
  } catch (error) {
    handleFirestoreError(error, OperationType.GET, path);
    return null;
  }
}

export function subscribeToFirestorePages(
  onData: (pages: WorkspacePage[]) => void,
  onError?: (err: unknown) => void
): () => void {
  const pagesRef = collection(db, "pages");
  return onSnapshot(
    pagesRef,
    (snapshot) => {
      const items: WorkspacePage[] = [];
      snapshot.forEach((d) => {
        items.push(d.data() as WorkspacePage);
      });
      if (items.length > 0) {
        items.sort(
          (a, b) =>
            (a.order ?? 0) - (b.order ?? 0) || a.createdAt.localeCompare(b.createdAt)
        );
      }
      onData(items);
    },
    (error) => {
      if (onError) onError(error);
      handleFirestoreError(error, OperationType.GET, "pages");
    }
  );
}

export async function savePageToFirestore(page: WorkspacePage): Promise<void> {
  const path = `pages/${page.id}`;
  try {
    const pageRef = doc(db, "pages", page.id);
    await setDoc(pageRef, cleanFirestorePayload(page), { merge: true });
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, path);
  }
}

export async function deletePageFromFirestore(pageId: string): Promise<void> {
  const path = `pages/${pageId}`;
  try {
    const pageRef = doc(db, "pages", pageId);
    await deleteDoc(pageRef);
  } catch (error) {
    handleFirestoreError(error, OperationType.DELETE, path);
  }
}

export async function batchSavePagesToFirestore(pages: WorkspacePage[]): Promise<void> {
  if (!pages || pages.length === 0) return;
  const batch = writeBatch(db);
  for (const page of pages) {
    if (!page?.id) continue;
    const ref = doc(db, "pages", page.id);
    batch.set(ref, cleanFirestorePayload(page), { merge: true });
  }
  try {
    await batch.commit();
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, "pages");
  }
}

export async function batchDeleteLeadsFromFirestore(ids: string[]): Promise<void> {
  if (!ids || ids.length === 0) return;
  const CHUNK_SIZE = 450;
  for (let i = 0; i < ids.length; i += CHUNK_SIZE) {
    const chunk = ids.slice(i, i + CHUNK_SIZE);
    const batch = writeBatch(db);
    for (const id of chunk) {
      if (!id) continue;
      const ref = doc(db, "leads", id);
      batch.delete(ref);
    }
    try {
      await batch.commit();
    } catch (error) {
      handleFirestoreError(error, OperationType.DELETE, "leads");
    }
  }
}

export async function seedInitialFirestoreIfEmpty(
  sampleLeads: Lead[],
  sampleFiles: UploadedFileRecord[],
  defaultSettings: AppSettings
): Promise<void> {
  try {
    const settingsRef = doc(db, "settings", "global");
    const settingsSnap = await getDoc(settingsRef);
    // If settings already exists, the project has already been initialized.
    // Never re-seed deleted leads or files!
    if (!settingsSnap.exists()) {
      await setDoc(settingsRef, cleanFirestorePayload(defaultSettings));

      const leadsRef = collection(db, "leads");
      const leadsSnap = await getDocs(leadsRef);
      if (leadsSnap.empty && sampleLeads.length > 0) {
        await batchSaveLeadsToFirestore(sampleLeads);
      }

      const filesRef = collection(db, "uploadedFiles");
      const filesSnap = await getDocs(filesRef);
      if (filesSnap.empty && sampleFiles.length > 0) {
        for (const file of sampleFiles) {
          await saveUploadedFileToFirestore(file);
        }
      }
    }
  } catch (error) {
    console.warn("Notice: Firestore seeding check:", error);
  }
}
