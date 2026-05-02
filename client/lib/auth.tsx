"use client";
import { createContext, useContext, useEffect, useState, ReactNode } from "react";
import { useRouter } from "next/navigation";
import { api } from "./api";

type User = { id: string; email: string; displayName: string; avatarColor: string };
type Ctx = {
  user: User | null;
  loading: boolean;
  login: (e: string, p: string) => Promise<void>;
  register: (e: string, p: string, n?: string) => Promise<void>;
  logout: () => void;
  updateProfile: (displayName: string, avatarColor: string) => Promise<void>;
  changePassword: (current: string, next: string) => Promise<void>;
};

const AuthCtx = createContext<Ctx | null>(null);

export const AuthProvider = ({ children }: { children: ReactNode }) => {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const router = useRouter();

  useEffect(() => {
    const token = typeof window !== "undefined" ? localStorage.getItem("collabpad_token") : null;
    if (!token) { setLoading(false); return; }
    api.get("/api/auth/me")
      .then((r) => setUser(r.data.user))
      .catch(() => localStorage.removeItem("collabpad_token"))
      .finally(() => setLoading(false));
  }, []);

  const login = async (email: string, password: string) => {
    const { data } = await api.post("/api/auth/login", { email, password });
    localStorage.setItem("collabpad_token", data.token);
    setUser(data.user);
    router.push("/dashboard");
  };
  const register = async (email: string, password: string, displayName?: string) => {
    const { data } = await api.post("/api/auth/register", { email, password, displayName });
    localStorage.setItem("collabpad_token", data.token);
    setUser(data.user);
    router.push("/dashboard");
  };
  const logout = () => {
    localStorage.removeItem("collabpad_token");
    setUser(null);
    router.push("/");
  };
  const updateProfile = async (displayName: string, avatarColor: string) => {
    const { data } = await api.patch("/api/auth/me", { displayName, avatarColor });
    setUser(data.user);
  };

  const changePassword = async (current: string, next: string) => {
    await api.patch("/api/auth/change-password", { currentPassword: current, newPassword: next });
  };

  return <AuthCtx.Provider value={{ user, loading, login, register, logout, updateProfile, changePassword }}>{children}</AuthCtx.Provider>;
};

export const useAuth = () => {
  const c = useContext(AuthCtx);
  if (!c) throw new Error("useAuth must be inside AuthProvider");
  return c;
};
