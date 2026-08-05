import { initializeApp } from "firebase/app";
import { connectAuthEmulator, getAuth } from "@firebase/auth";

const app = initializeApp({
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
  appId: import.meta.env.VITE_FIREBASE_APP_ID,
});

export const firebaseAuth =
  import.meta.env.VITE_AUTH_DRIVER === "local" ? null : getAuth(app);
if (
  firebaseAuth &&
  import.meta.env.VITE_USE_AUTH_EMULATOR === "true" &&
  !(globalThis as { __authEmulator?: boolean }).__authEmulator
) {
  connectAuthEmulator(firebaseAuth, "http://127.0.0.1:9099", {
    disableWarnings: true,
  });
  (globalThis as { __authEmulator?: boolean }).__authEmulator = true;
}
