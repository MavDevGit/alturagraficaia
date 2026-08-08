import { initializeApp, type FirebaseOptions } from "firebase/app";
import {
  browserPopupRedirectResolver,
  connectAuthEmulator,
  getAuth,
} from "@firebase/auth";

type PopupResolverWithStorageProbe = {
  _isIframeWebStorageSupported?: (
    auth: unknown,
    callback: (supported: boolean) => unknown,
  ) => void;
};

// @firebase/auth 1.13.x throws auth/internal-error after its iframe storage
// callback succeeds. Until the upstream probe is corrected, skip only that
// broken probe; Firebase still validates the origin and OAuth response.
const popupResolver =
  browserPopupRedirectResolver as PopupResolverWithStorageProbe;
if (popupResolver._isIframeWebStorageSupported) {
  popupResolver._isIframeWebStorageSupported = (_auth, callback) => {
    callback(true);
  };
}

const localMode = import.meta.env.VITE_AUTH_DRIVER === "local";
const firebaseConfig: FirebaseOptions = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
  appId: import.meta.env.VITE_FIREBASE_APP_ID,
};
const missingConfiguration = Object.entries(firebaseConfig)
  .filter(([, value]) => !value)
  .map(([key]) => key);
export const firebaseConfigurationError =
  !localMode && missingConfiguration.length > 0
    ? `Falta configurar Firebase (${missingConfiguration.join(", ")}).`
    : null;
const app =
  localMode || firebaseConfigurationError
    ? null
    : initializeApp(firebaseConfig);

export const firebaseAuth = localMode || !app ? null : getAuth(app);
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
