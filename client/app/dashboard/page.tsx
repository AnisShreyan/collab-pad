"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { AuthProvider, useAuth } from "@/lib/auth";
import { api } from "@/lib/api";
import toast from "react-hot-toast";
import { Plus, FileText, Trash2, LogOut, Settings, Search } from "lucide-react";

type Doc = {
  _id: string;
  title: string;
  updatedAt: string;
  ownerId: { _id: string; displayName: string; avatarColor: string };
  editLogs?: {
    userId: { _id: string; displayName: string; avatarColor: string } | string;
    userName: string;
    avatarColor: string;
    timestamp: string;
  }[];
};

function Inner() {
  const { user, loading, logout } = useAuth();
  const router = useRouter();
  const [docs, setDocs] = useState<Doc[]>([]);
  const [q, setQ] = useState("");
  const [expanded, setExpanded] = useState<string | null>(null);

  useEffect(() => {
    if (!loading && !user) router.push("/auth/login");
  }, [loading, user, router]);

  useEffect(() => {
    if (!user) return;
    api.get("/api/documents").then((r) => setDocs(r.data.documents));
  }, [user]);

  const create = async () => {
    const { data } = await api.post("/api/documents", { title: "" });
    router.push(`/doc/${data.document._id}`);
  };
  const remove = async (id: string) => {
    if (!confirm("Delete this document?")) return;
    await api.delete(`/api/documents/${id}`);
    setDocs(docs.filter((d: any) => d._id !== id));
    toast.success("Deleted");
  };

  if (loading || !user)
    return (
      <div className="min-h-screen flex items-center justify-center text-gray-400 font-medium">
        Loading…
      </div>
    );
  const filtered = docs.filter((d) =>
    d.title.toLowerCase().includes(q.toLowerCase()),
  );

  return (
    <div className="min-h-screen bg-white text-gray-900 selection:bg-gray-100">
      <header className="border-b border-gray-100">
        <div className="max-w-4xl mx-auto px-6 h-16 flex items-center justify-between">
          <Link href="/dashboard" className="flex items-center gap-2 group">
            <div className="w-6 h-6 bg-gray-900 rounded flex items-center justify-center group-hover:scale-105 transition-transform">
              <span className="text-white font-bold text-xs">C</span>
            </div>
            <span className="text-sm font-semibold tracking-tight">
              Collabpad
            </span>
          </Link>

          <div className="flex items-center gap-2">
            <div className="flex items-center gap-1.5 px-2 py-1.5 rounded-lg">
              <div
                className="w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-bold text-white shadow-sm"
                style={{ background: user.avatarColor }}
              >
                {user.displayName
                  ? user.displayName.slice(0, 1).toUpperCase()
                  : user.email.slice(0, 1).toUpperCase()}
              </div>
              <span className="text-xs font-medium text-gray-600 hidden sm:block">
                {user.displayName || user.email.split("@")[0]}
              </span>
            </div>

            <div className="w-px h-4 bg-gray-200 mx-1" />

            <Link
              href="/settings"
              className="p-2 text-gray-400 hover:text-gray-900 transition-colors"
            >
              <Settings className="w-4 h-4" />
            </Link>

            <button
              onClick={logout}
              className="p-2 text-gray-400 hover:text-red-500 transition-colors"
            >
              <LogOut className="w-4 h-4" />
            </button>
          </div>
        </div>
      </header>

      <main className="max-w-4xl mx-auto px-6 py-12">
        <div className="flex flex-col gap-8">
          <div className="flex items-center justify-between">
            <h1 className="text-2xl font-bold tracking-tight">All Documents</h1>
            <button
              onClick={create}
              className="inline-flex items-center gap-2 px-3.5 py-2 rounded-full bg-gray-900 text-white text-xs font-semibold hover:bg-gray-800 transition-all hover:translate-y-[-1px] active:translate-y-0"
            >
              <Plus className="w-3.5 h-3.5" /> New Document
            </button>
          </div>

          <div className="relative group">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 group-focus-within:text-gray-600 transition-colors" />
            <input
              className="w-full bg-gray-50 border-transparent focus:bg-white focus:border-gray-200 focus:ring-0 rounded-xl pl-10 pr-4 py-2.5 text-sm transition-all outline-none"
              placeholder="Search by title..."
              value={q}
              onChange={(e) => setQ(e.target.value)}
            />
          </div>

          <div className="grid gap-4">
            {filtered.length === 0 ? (
              <div className="text-center py-24 border border-dashed border-gray-200 rounded-2xl">
                <p className="text-sm text-gray-400 font-medium">
                  No documents found.
                </p>
              </div>
            ) : (
              filtered.map((d) => {
                const editorsMap = new Map(
                  d.editLogs?.map((log) => {
                    const isPopulated = typeof log.userId === "object";
                    const id = isPopulated
                      ? (log.userId as any)._id
                      : log.userId;
                    const name = isPopulated
                      ? (log.userId as any).displayName
                      : log.userName;
                    const color = isPopulated
                      ? (log.userId as any).avatarColor
                      : log.avatarColor;

                    return [
                      id,
                      {
                        name,
                        color:
                          color || d.ownerId.avatarColor || "hsl(221 83% 53%)",
                      },
                    ];
                  }) || [],
                );
                // The owner is guaranteed to have a color
                if (!editorsMap.has(d.ownerId._id)) {
                  editorsMap.set(d.ownerId._id, {
                    name: d.ownerId.displayName,
                    color: d.ownerId.avatarColor || "hsl(221 83% 53%)",
                  });
                }
                const uniqueEditors = Array.from(editorsMap.values());

                console.log("=======================");
                console.log(uniqueEditors);

                console.log("=======================");

                return (
                  <div
                    key={d._id}
                    className="group border border-gray-100 rounded-2xl overflow-hidden hover:border-gray-200 transition-colors shadow-sm hover:shadow-md"
                  >
                    <div className="flex items-center gap-4 p-4">
                      <Link
                        href={`/doc/${d._id}`}
                        className="flex items-center gap-4 flex-1 min-w-0"
                      >
                        <div className="w-10 h-10 rounded-lg flex items-center justify-center text-white shadow-sm transition-all">
                          <FileText className="w-6 h-6" color="black" />
                        </div>
                        <div className="flex flex-col min-w-0">
                          <span className="font-bold text-sm truncate">
                            {d.title || "Untitled Document"}
                          </span>
                          <span className="text-[10px] font-medium text-gray-400 uppercase tracking-wider">
                            Edited{" "}
                            {new Date(d.updatedAt).toLocaleDateString(
                              undefined,
                              {
                                month: "short",
                                day: "numeric",
                                hour: "numeric",
                                minute: "2-digit",
                                hour12: true,
                              },
                            )}
                          </span>
                        </div>
                      </Link>

                      <div className="flex items-center gap-2">
                        <button
                          onClick={() =>
                            setExpanded(expanded === d._id ? null : d._id)
                          }
                          className="px-3 py-1.5 text-[10px] font-bold uppercase tracking-widest text-gray-400 hover:text-gray-900 transition-colors"
                        >
                          {expanded === d._id ? "Hide Logs" : "View Logs"}
                        </button>

                        {(d.ownerId._id === user?.id ||
                          (d.ownerId as any).id === user?.id) && (
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              remove(d._id);
                            }}
                            className="p-2 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors"
                            title="Delete document"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        )}
                      </div>
                    </div>

                    {expanded === d._id && (
                      <div className="bg-gray-50/50 border-t border-gray-100 p-4 space-y-5 animate-in slide-in-from-top-2 duration-200">
                        {uniqueEditors.length > 0 && (
                          <div className="space-y-3">
                            <h4 className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">
                              Contributors
                            </h4>
                            <div className="flex items-center gap-3">
                              <div className="flex -space-x-2">
                                {uniqueEditors.map((editor, i) => (
                                  <div
                                    key={i}
                                    title={editor.name || "User"}
                                    className="w-7 h-7 rounded-full border-2 border-white flex items-center justify-center text-white text-[10px] font-bold shadow-sm ring-1 ring-gray-100 transition-transform hover:scale-110 hover:z-10"
                                    style={{
                                      backgroundColor:
                                        editor.color ||
                                        d.ownerId.avatarColor ||
                                        "hsl(221 83% 53%)",
                                    }}
                                  >
                                    {(editor.name || "U")
                                      .slice(0, 1)
                                      .toUpperCase()}
                                  </div>
                                ))}
                              </div>
                              <div className="text-[10px] text-gray-500 font-medium italic">
                                {uniqueEditors.map((e) => e.name).join(", ")}
                              </div>
                            </div>
                          </div>
                        )}

                        <div className="space-y-3">
                          <h4 className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">
                            Recent Activity
                          </h4>
                          <div className="space-y-1 max-h-48 overflow-y-auto pr-2 custom-scrollbar">
                            {(d.editLogs || [])
                              .slice()
                              .reverse()
                              .map((log, i) => (
                                <div
                                  key={i}
                                  className="flex items-center justify-between text-[11px] py-1.5 border-b border-gray-100 last:border-0"
                                >
                                  <div className="flex items-center gap-2">
                                    <div
                                      className="w-1.5 h-1.5 rounded-full"
                                      style={{
                                        backgroundColor:
                                          (typeof log.userId === "object"
                                            ? (log.userId as any).avatarColor
                                            : log.avatarColor) ||
                                          "hsl(220 70% 55%)",
                                      }}
                                    />
                                    <span className="font-semibold text-gray-700">
                                      {typeof log.userId === "object"
                                        ? (log.userId as any).displayName
                                        : log.userName}
                                    </span>
                                  </div>
                                  <span className="text-gray-400 text-[10px]">
                                    {new Date(log.timestamp).toLocaleString(
                                      undefined,
                                      {
                                        month: "short",
                                        day: "numeric",
                                        hour: "numeric",
                                        minute: "2-digit",
                                        hour12: true,
                                      },
                                    )}
                                  </span>
                                </div>
                              ))}
                            {(d.editLogs || []).length === 0 && (
                              <p className="text-[11px] text-gray-400 italic">
                                No edit history yet.
                              </p>
                            )}
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                );
              })
            )}
          </div>
        </div>
      </main>
    </div>
  );
}
export default function Page() {
  return (
    <AuthProvider>
      <Inner />
    </AuthProvider>
  );
}
