"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";
import { api } from "@/lib/api";
import type { User } from "@/lib/types";

type AuthContextValue = {
  user: User | null;
  token: string | null;
  isLoading: boolean;
  isAuthenticated: boolean;
  login: (input: { email: string; password: string }) => Promise<void>;
  register: (input: {
    name: string;
    email: string;
    password: string;
  }) => Promise<void>;
  logout: () => void;
};

const AuthContext = createContext<AuthContextValue | null>(null);

const TOKEN_KEY = "datapulse_token";

function getStoredToken() {
  if (typeof window === "undefined") return null;
  return localStorage.getItem(TOKEN_KEY);
}

function saveToken(token: string) {
  localStorage.setItem(TOKEN_KEY, token);
}

function removeToken() {
  localStorage.removeItem(TOKEN_KEY);
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  /* Restore session from localStorage on mount */
  useEffect(() => {
    const savedToken = getStoredToken();

    if (!savedToken) {
      setIsLoading(false);
      return;
    }

    let isMounted = true;

    async function restoreSession() {
      try {
        const response = await api.me(savedToken!);

        if (!isMounted) return;

        setToken(savedToken);
        setUser(response.data.user);
      } catch {
        removeToken();

        if (!isMounted) return;

        setToken(null);
        setUser(null);
      } finally {
        if (isMounted) {
          setIsLoading(false);
        }
      }
    }

    restoreSession();

    return () => {
      isMounted = false;
    };
  }, []);

  const login = useCallback(
    async (input: { email: string; password: string }) => {
      const response = await api.login(input);
      const { user: loggedInUser, token: newToken } = response.data;

      saveToken(newToken);
      setToken(newToken);
      setUser(loggedInUser);
    },
    []
  );

  const register = useCallback(
    async (input: { name: string; email: string; password: string }) => {
      const response = await api.register(input);
      const { user: newUser, token: newToken } = response.data;

      saveToken(newToken);
      setToken(newToken);
      setUser(newUser);
    },
    []
  );

  const logout = useCallback(() => {
    removeToken();
    setToken(null);
    setUser(null);
  }, []);

  const isAuthenticated = Boolean(token && user);

  const value = useMemo(
    () => ({
      user,
      token,
      isLoading,
      isAuthenticated,
      login,
      register,
      logout,
    }),
    [user, token, isLoading, isAuthenticated, login, register, logout]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);

  if (!context) {
    throw new Error("useAuth must be used within an AuthProvider");
  }

  return context;
}
