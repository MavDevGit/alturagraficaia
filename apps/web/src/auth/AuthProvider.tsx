import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type PropsWithChildren,
} from "react";
import {
  GoogleAuthProvider,
  createUserWithEmailAndPassword,
  onAuthStateChanged,
  sendPasswordResetEmail,
  signInWithEmailAndPassword,
  signInWithPopup,
  signOut,
  type User,
} from "@firebase/auth";
import { useQueryClient } from "@tanstack/react-query";
import { firebaseAuth, firebaseConfigurationError } from "./firebase";
import { AUTH_EXPIRED_EVENT, api, registerTokenProvider } from "../api/client";
import { AuthContext, type AuthContextValue } from "./context";

export function AuthProvider({ children }: PropsWithChildren) {
  const queryClient = useQueryClient();
  const previousUid = useRef<string | null>(null);
  const authRevision = useRef(0);
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [authError, setAuthError] = useState<string | null>(
    firebaseConfigurationError,
  );
  const [localUid, setLocalUid] = useState<string | null>(() =>
    sessionStorage.getItem("altura.localUid"),
  );
  const localMode = import.meta.env.VITE_AUTH_DRIVER === "local";

  useEffect(() => {
    if (localMode || !firebaseAuth) {
      setLoading(false);
      return;
    }
    const auth = firebaseAuth;
    return onAuthStateChanged(auth, async (next) => {
      const revision = ++authRevision.current;
      if (previousUid.current !== next?.uid) queryClient.clear();
      previousUid.current = next?.uid ?? null;
      if (!next) {
        setUser(null);
        setLoading(false);
        return;
      }

      setLoading(true);
      try {
        await api("/me");
        if (
          revision === authRevision.current &&
          auth.currentUser?.uid === next.uid
        ) {
          setUser(next);
          setAuthError(null);
          setLoading(false);
        }
      } catch (reason) {
        if (revision !== authRevision.current) return;
        const message =
          reason instanceof Error
            ? reason.message
            : "No se pudo validar la cuenta con la API.";
        setAuthError(`Firebase aceptó la cuenta, pero la API falló: ${message}`);
        setUser(null);
        setLoading(false);
        await signOut(auth);
      }
    });
  }, [localMode, queryClient]);
  const token = useCallback(
    async () =>
      localUid
        ? `local:${localUid}`
        : (firebaseAuth?.currentUser?.getIdToken() ?? null),
    [localUid],
  );
  useEffect(() => registerTokenProvider(token), [token]);
  useEffect(() => {
    const expire = (event: Event) => {
      const message = (event as CustomEvent<{ message?: string }>).detail
        ?.message;
      setAuthError(
        message
          ? `Firebase aceptó la cuenta, pero la API la rechazó: ${message}`
          : "La sesión expiró. Ingresa nuevamente.",
      );
      sessionStorage.removeItem("altura.localUid");
      setLocalUid(null);
      queryClient.clear();
      if (firebaseAuth) void signOut(firebaseAuth);
    };
    window.addEventListener(AUTH_EXPIRED_EVENT, expire);
    return () => window.removeEventListener(AUTH_EXPIRED_EVENT, expire);
  }, [queryClient]);

  const value = useMemo<AuthContextValue>(
    () => ({
      user:
        user ??
        (localUid
          ? ({
              uid: localUid,
              email: `${localUid}@local.alturagrafica.test`,
              displayName: "Administrador local",
            } as User)
          : null),
      loading: localMode ? false : loading,
      authError,
      clearAuthError: () => setAuthError(null),
      login: async (email, password) => {
        if (!firebaseAuth) throw new Error("Firebase no está activo.");
        setAuthError(null);
        await signInWithEmailAndPassword(firebaseAuth, email, password);
      },
      register: async (email, password) => {
        if (!firebaseAuth) throw new Error("Firebase no está activo.");
        setAuthError(null);
        await createUserWithEmailAndPassword(firebaseAuth, email, password);
      },
      loginGoogle: async () => {
        if (!firebaseAuth) throw new Error("Firebase no está activo.");
        setAuthError(null);
        const provider = new GoogleAuthProvider();
        provider.setCustomParameters({ prompt: "select_account" });
        await signInWithPopup(firebaseAuth, provider);
      },
      loginLocal: async () => {
        setAuthError(null);
        sessionStorage.setItem("altura.localUid", "local-admin");
        setLocalUid("local-admin");
      },
      logout: async () => {
        setAuthError(null);
        sessionStorage.removeItem("altura.localUid");
        setLocalUid(null);
        queryClient.clear();
        if (firebaseAuth) await signOut(firebaseAuth);
      },
      reset: async (email) => {
        if (!firebaseAuth) throw new Error("Firebase no está activo.");
        await sendPasswordResetEmail(firebaseAuth, email);
      },
    }),
    [authError, loading, localMode, localUid, queryClient, user],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}
