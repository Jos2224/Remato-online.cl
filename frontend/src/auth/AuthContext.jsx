import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { authApi, getStoredToken, onUnauthorized, storeToken } from "../api/client";

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [token, setToken] = useState(getStoredToken);
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(Boolean(token));

  const clearSession = useCallback(() => {
    storeToken(null);
    setToken(null);
    setUser(null);
    setLoading(false);
  }, []);

  const refreshUser = useCallback(async () => {
    if (!getStoredToken()) {
      setUser(null);
      setLoading(false);
      return null;
    }
    try {
      const current = await authApi.me();
      setUser(current);
      return current;
    } catch (error) {
      if (error.status === 401) clearSession();
      throw error;
    } finally {
      setLoading(false);
    }
  }, [clearSession]);

  useEffect(() => {
    if (!token) {
      setLoading(false);
      return;
    }
    refreshUser().catch(() => {});
  }, [refreshUser, token]);

  // A token can expire or be revoked at any point, not only during start-up. Without
  // this the shell kept showing a signed-in user while every request failed with 401.
  useEffect(() => onUnauthorized(() => clearSession()), [clearSession]);

  const establishSession = useCallback((session) => {
    if (!session.token) throw new Error("El servidor no entregó una sesión válida.");
    storeToken(session.token);
    setToken(session.token);
    setUser(session.user);
  }, []);

  const login = useCallback(
    async (credentials) => {
      const session = await authApi.login(credentials);
      establishSession(session);
      return session.user;
    },
    [establishSession],
  );

  const register = useCallback(
    async (credentials) => {
      const session = await authApi.register(credentials);
      establishSession(session);
      return session.user;
    },
    [establishSession],
  );

  const value = useMemo(
    () => ({ user, token, loading, isAuthenticated: Boolean(token), login, register, logout: clearSession, refreshUser }),
    [clearSession, loading, login, refreshUser, register, token, user],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) throw new Error("useAuth debe usarse dentro de AuthProvider");
  return context;
}
