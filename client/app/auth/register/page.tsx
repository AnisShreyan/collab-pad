"use client";
import { useState } from "react";
import Link from "next/link";
import { AuthProvider, useAuth } from "@/lib/auth";
import toast from "react-hot-toast";

import { useRouter } from "next/navigation";
import { useEffect } from "react";

function Form() {
  const { user, loading, register } = useAuth();
  const router = useRouter();
  const [email, setEmail] = useState(""); 
  const [password, setPassword] = useState(""); 
  const [name, setName] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!loading && user) router.push("/dashboard");
  }, [user, loading, router]);

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault(); 
    setBusy(true);
    try { 
      await register(email, password, name); 
    } catch (err: any) { 
      toast.error(err?.response?.data?.error || "Registration failed"); 
    } finally { 
      setBusy(false); 
    }
  };

  if (loading || user) return null;

  return (
    <div className="w-full max-w-sm space-y-8">
      <div className="flex flex-col items-center gap-4">
        <div className="w-8 h-8 bg-gray-900 rounded flex items-center justify-center">
          <span className="text-white font-bold text-xs">C</span>
        </div>
        <div className="text-center space-y-1">
          <h1 className="text-xl font-bold tracking-tight">Create your account</h1>
          <p className="text-xs font-medium text-gray-400">Join the minimalist workspace</p>
        </div>
      </div>
      
      <form onSubmit={onSubmit} className="space-y-4">
        <div className="space-y-1">
          <label className="text-[10px] font-bold uppercase tracking-wider text-gray-400 ml-1">Display Name</label>
          <input 
            className="w-full bg-gray-50 border-transparent focus:bg-white focus:border-gray-200 focus:ring-0 rounded-xl px-4 py-2.5 text-sm transition-all outline-none" 
            type="text"
            placeholder="Your name" 
            value={name} 
            onChange={e=>setName(e.target.value)}
          />
        </div>

        <div className="space-y-1">
          <label className="text-[10px] font-bold uppercase tracking-wider text-gray-400 ml-1">Email</label>
          <input 
            className="w-full bg-gray-50 border-transparent focus:bg-white focus:border-gray-200 focus:ring-0 rounded-xl px-4 py-2.5 text-sm transition-all outline-none" 
            type="email" 
            placeholder="name@example.com" 
            value={email} 
            onChange={e=>setEmail(e.target.value)} 
            required
          />
        </div>

        <div className="space-y-1">
          <label className="text-[10px] font-bold uppercase tracking-wider text-gray-400 ml-1">Password</label>
          <input 
            className="w-full bg-gray-50 border-transparent focus:bg-white focus:border-gray-200 focus:ring-0 rounded-xl px-4 py-2.5 text-sm transition-all outline-none" 
            type="password" 
            placeholder="Min. 6 characters" 
            minLength={6}
            value={password} 
            onChange={e=>setPassword(e.target.value)} 
            required
          />
        </div>

        <button 
          disabled={busy} 
          className="w-full py-3 rounded-xl bg-gray-900 text-white text-sm font-bold hover:bg-gray-800 transition-all active:scale-[0.98] disabled:opacity-50 flex items-center justify-center gap-2"
        >
          {busy ? (
            <div className="w-4 h-4 border-2 border-white/20 border-t-white rounded-full animate-spin" />
          ) : "Get Started"}
        </button>
      </form>

      <p className="text-center text-xs font-medium text-gray-400">
        Already have an account?{" "}
        <Link href="/auth/login" className="text-gray-900 font-bold hover:underline">
          Sign in
        </Link>
      </p>
    </div>
  );
}

export default function Page() {
  return (
    <AuthProvider>
      <div className="min-h-screen flex items-center justify-center bg-white p-6">
        <Form />
      </div>
    </AuthProvider>
  );
}

