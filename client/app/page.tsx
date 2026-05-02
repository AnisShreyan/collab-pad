"use client";
import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { AuthProvider, useAuth } from "@/lib/auth";

function LandingContent() {
  const { user, loading } = useAuth();

  return (
    <div className="min-h-screen flex flex-col bg-white text-gray-900 selection:bg-gray-100">
      <header className="border-b border-gray-50">
        <div className="max-w-4xl mx-auto px-6 h-16 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-6 h-6 bg-gray-900 rounded flex items-center justify-center">
              <span className="text-white font-bold text-xs">C</span>
            </div>
            <span className="text-sm font-semibold tracking-tight uppercase">
              Collabpad
            </span>
          </div>
          <div className="flex gap-4">
            {!loading && user ? (
              <Link
                href="/dashboard"
                className="text-sm font-bold text-gray-900 transition-colors"
              >
                Go to Dashboard
              </Link>
            ) : (
              <>
                <Link
                  href="/auth/login"
                  className="text-sm font-medium text-gray-500 hover:text-gray-900 transition-colors"
                >
                  Sign in
                </Link>
                <Link
                  href="/auth/register"
                  className="text-sm font-bold text-gray-900 transition-colors"
                >
                  Get started
                </Link>
              </>
            )}
          </div>
        </div>
      </header>

      <main className="flex-1 flex flex-col items-center justify-center px-6 py-24">
        <div className="max-w-xl text-center space-y-12">
          <div className="space-y-4">
            <h1 className="text-5xl md:text-6xl font-bold tracking-tighter leading-[1.1]">
              Collaborative writing, <br />
              <span className="text-gray-400">perfected.</span>
            </h1>
            <p className="text-lg text-gray-500 font-medium max-w-lg mx-auto">
              A minimalist workspace for real-time collaboration. Share a link,
              write together, and watch the magic happen.
            </p>
          </div>

          <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
            {!loading && user ? (
              <Link
                href="/dashboard"
                className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-10 py-4 rounded-full bg-gray-900 text-white font-bold hover:bg-gray-800 transition-all hover:translate-y-[-2px] active:translate-y-0 shadow-lg shadow-gray-200"
              >
                Go to Dashboard <ArrowRight className="w-4 h-4" />
              </Link>
            ) : (
              <>
                <Link
                  href="/auth/register"
                  className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-8 py-3 rounded-full bg-gray-900 text-white font-bold hover:bg-gray-800 transition-all hover:translate-y-[-2px] active:translate-y-0"
                >
                  Start Creating <ArrowRight className="w-4 h-4" />
                </Link>
                <Link
                  href="/auth/login"
                  className="w-full sm:w-auto inline-flex items-center justify-center px-8 py-3 rounded-full border border-gray-200 text-gray-900 font-bold hover:bg-gray-50 transition-all"
                >
                  Live Demo
                </Link>
              </>
            )}
          </div>

          <div className="pt-12 flex items-center justify-center gap-8">
            <div className="flex flex-col items-center">
              <span className="text-xl font-bold">100%</span>
              <span className="text-[10px] uppercase tracking-widest text-gray-400 font-bold">
                Real-time
              </span>
            </div>
            <div className="w-px h-8 bg-gray-100" />
            <div className="flex flex-col items-center">
              <span className="text-xl font-bold">0</span>
              <span className="text-[10px] uppercase tracking-widest text-gray-400 font-bold">
                Bloat
              </span>
            </div>
            <div className="w-px h-8 bg-gray-100" />
            <div className="flex flex-col items-center">
              <span className="text-xl font-bold">∞</span>
              <span className="text-[10px] uppercase tracking-widest text-gray-400 font-bold">
                Simplicity
              </span>
            </div>
          </div>
        </div>
      </main>

      <footer className="py-12 border-t border-gray-50 text-center">
        <p className="text-xs font-medium text-gray-400 uppercase tracking-widest">
          Built with ❤️ for Writers
        </p>
      </footer>
    </div>
  );
}

export default function Landing() {
  return (
    <AuthProvider>
      <LandingContent />
    </AuthProvider>
  );
}
