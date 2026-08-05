import { createContext, useContext } from "react";
import type { User } from "@firebase/auth";

export type AuthContextValue = {
  user: User | null;
  loading: boolean;
  login(email: string, password: string): Promise<void>;
  register(email: string, password: string): Promise<void>;
  loginGoogle(): Promise<void>;
  loginLocal(): Promise<void>;
  logout(): Promise<void>;
  reset(email: string): Promise<void>;
};

export const AuthContext = createContext<AuthContextValue | null>(null);

export function useAuth(): AuthContextValue {
  const value = useContext(AuthContext);
  if (!value) throw new Error("useAuth debe usarse dentro de AuthProvider.");
  return value;
}
