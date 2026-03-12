import { createContext, useContext, useEffect, useState } from "react";
import { useLocation } from "wouter";
import { apiRequest } from "@/lib/queryClient";

export interface AuthUser {
  id: string;
  username: string;
  email: string | null;
  displayName: string | null;
  role: string;
  divisionCode: string | null;
  isActive: boolean;
  mustChangePassword: boolean;
}

interface AuthContextValue {
  user: AuthUser | null;
  loading: boolean;
  login: (username: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
  refreshUser: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue>({
  user: null,
  loading: true,
  login: async () => {},
  logout: async () => {},
  refreshUser: async () => {},
});

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [loading, setLoading] = useState(true);
  const [, navigate] = useLocation();

  async function fetchMe() {
    try {
      const r = await fetch("/api/auth/me", { credentials: "include" });
      const data = r.ok ? await r.json() : null;
      setUser(data);
    } catch {
      setUser(null);
    }
  }

  useEffect(() => {
    fetchMe().finally(() => setLoading(false));
  }, []);

  async function login(username: string, password: string) {
    const res = await apiRequest("POST", "/api/auth/login", { username, password });
    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      throw new Error(body.error || "Login failed");
    }
    const data = await res.json();
    setUser(data);
    navigate("/");
  }

  async function logout() {
    await apiRequest("POST", "/api/auth/logout", {});
    setUser(null);
    navigate("/login");
  }

  async function refreshUser() {
    await fetchMe();
  }

  return (
    <AuthContext.Provider value={{ user, loading, login, logout, refreshUser }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  return useContext(AuthContext);
}
