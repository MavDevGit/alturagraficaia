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
import { firebaseAuth } from "./firebase";
import { AUTH_EXPIRED_EVENT, registerTokenProvider } from "../api/client";
import { AuthContext, type AuthContextValue } from "./context";

export function AuthProvider({ children }: PropsWithChildren) {
  const queryClient = useQueryClient();
  const previousUid = useRef<string | null>(null);
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [localUid, setLocalUid] = useState<string | null>(() =>
    sessionStorage.getItem("altura.localUid"),
  );
  const localMode = import.meta.env.VITE_AUTH_DRIVER === "local";

  useEffect(() => {
    if (localMode || !firebaseAuth) {
      setLoading(false);
      return;
    }
    return onAuthStateChanged(firebaseAuth, (next) => {
      if (previousUid.current !== next?.uid) queryClient.clear();
      previousUid.current = next?.uid ?? null;
      setUser(next);
      setLoading(false);
    });
  }, [localMode, queryClient]);
  const token = useCallback(
    async () => (localUid ? `local:${localUid}` : (user?.getIdToken() ?? null)),
    [localUid, user],
  );
  useEffect(() => registerTokenProvider(token), [token]);
  useEffect(() => {
    const expire = () => {
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
      login: async (email, password) => {
        if (!firebaseAuth) throw new Error("Firebase no está activo.");
        await signInWithEmailAndPassword(firebaseAuth, email, password);
      },
      register: async (email, password) => {
        if (!firebaseAuth) throw new Error("Firebase no está activo.");
        await createUserWithEmailAndPassword(firebaseAuth, email, password);
      },
      loginGoogle: async () => {
        if (!firebaseAuth) throw new Error("Firebase no está activo.");
        await signInWithPopup(firebaseAuth, new GoogleAuthProvider());
      },
      loginLocal: async () => {
        sessionStorage.setItem("altura.localUid", "local-admin");
        setLocalUid("local-admin");
      },
      logout: async () => {
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
    [loading, localMode, localUid, queryClient, user],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}
