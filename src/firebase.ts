import { initializeApp, getApps } from "firebase/app";
import { getStorage } from "firebase/storage";
import { getAuth } from "firebase/auth";
import { getFirestore } from "firebase/firestore";
import { getAnalytics, isSupported as isAnalyticsSupported, Analytics } from "firebase/analytics";
import appletConfig from "../firebase-applet-config.json";

export const firebaseConfig = appletConfig;

// Initialize Firebase App
const existingApps = getApps();
export const app =
  existingApps.find((a) => a.name === "[DEFAULT]") ||
  (existingApps.length === 0
    ? initializeApp(appletConfig)
    : existingApps[0]);

// Initialize Cloud Firestore database instance with provisioned database ID
export const db = getFirestore(app, appletConfig.firestoreDatabaseId);

// Initialize Firebase Auth & Storage
export const auth = getAuth(app);
export const storage = getStorage(app);

export let analytics: Analytics | null = null;
if (typeof window !== "undefined") {
  isAnalyticsSupported()
    .then((supported) => {
      if (supported) {
        try {
          analytics = getAnalytics(app);
        } catch (err) {
          console.warn("Analytics initialization warning:", err);
        }
      }
    })
    .catch(() => {});
}

export default app;
