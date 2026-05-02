"use client";
import { useEffect } from "react";
import { useParams, useRouter } from "next/navigation";
import { AuthProvider, useAuth } from "@/lib/auth";
import { api } from "@/lib/api";
import toast from "react-hot-toast";
import { Loader2 } from "lucide-react";

function Inner() {
  const { token } = useParams<{ token: string }>();
  const { user, loading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (loading) return;
    if (!user) {
      sessionStorage.setItem("collabpad_invite", token);
      router.push("/auth/login");
      return;
    }
    api.post(`/api/share/accept/${token}`)
      .then(r => { toast.success("Access granted"); router.push(`/doc/${r.data.documentId}`); })
      .catch((e) => { toast.error(e?.response?.data?.error || "Invalid invite"); router.push("/dashboard"); });
  }, [user, loading, token, router]);

  return <div className="min-h-screen flex items-center justify-center"><Loader2 className="w-5 h-5 animate-spin text-gray-400"/></div>;
}
export default function Page() { return <AuthProvider><Inner/></AuthProvider>; }
