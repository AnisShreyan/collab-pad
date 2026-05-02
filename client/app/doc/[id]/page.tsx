"use client";
import { useEffect, useRef, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { OutputData } from "@editorjs/editorjs";
import { AuthProvider, useAuth } from "@/lib/auth";
import { api } from "@/lib/api";
import { getSocket, closeSocket } from "@/lib/socket";
import dynamic from "next/dynamic";
const Editor = dynamic(() => import("@/components/Editor").then(mod => mod.Editor), { ssr: false });
import { ShareDialog } from "@/components/ShareDialog";
import { ArrowLeft, Cloud, Check, Loader2, Settings } from "lucide-react";
import toast from "react-hot-toast";

type Doc = {
  _id: string;
  title: string;
  content: OutputData;
  ownerId: string;
  updatedAt: string;
};
type Presence = { userId: string; displayName: string; avatarColor: string };
type RemoteCursor = {
  socketId: string;
  userId: string;
  displayName: string;
  avatarColor: string;
  range: { index: number; length: number } | null;
  x?: number;
  y?: number;
};

const DEBOUNCE = 700;
const CURSOR_THROTTLE = 50;

function Inner() {
  const { id } = useParams<{ id: string }>();
  const { user, loading } = useAuth();
  const router = useRouter();
  const [doc, setDoc] = useState<Doc | null>(null);
  const [canEdit, setCanEdit] = useState(false);
  const [isOwner, setIsOwner] = useState(false);
  const [presence, setPresence] = useState<Presence[]>([]);
  const [remoteCursors, setRemoteCursors] = useState<Map<string, RemoteCursor>>(
    new Map(),
  );
  const [saveState, setSaveState] = useState<"idle" | "saving" | "saved">(
    "idle",
  );
  const [extVersion, setExtVersion] = useState(0);

  const localEditing = useRef(false);
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastSavedJson = useRef("");
  const cursorThrottleTimer = useRef<ReturnType<typeof setTimeout> | null>(
    null,
  );

  useEffect(() => {
    if (!loading && !user) router.push("/auth/login");
  }, [loading, user, router]);

  useEffect(() => {
    if (!user || !id) return;
    api
      .get(`/api/documents/${id}`)
      .then((r) => {
        const d = r.data.document;
        setDoc(d);
        setCanEdit(r.data.canEdit);
        setIsOwner(r.data.isOwner);
        lastSavedJson.current = JSON.stringify(d.content);
      })
      .catch(() => {
        toast.error("Cannot open document");
        router.push("/dashboard");
      });
  }, [user, id, router]);

  // Socket
  useEffect(() => {
    if (!user || !doc) return;
    const s = getSocket();
    s.emit("doc:join", { docId: doc._id });

    s.on("presence:update", (list: Presence[]) => {
      setPresence(list.filter((p) => p.userId !== user.id));
    });
    s.on("doc:remote-change", ({ content }: { content: OutputData }) => {
      const json = JSON.stringify(content);
      if (json === lastSavedJson.current) return;
      if (localEditing.current) return;
      lastSavedJson.current = json;
      setDoc((d) => (d ? { ...d, content } : d));
      setExtVersion((v) => v + 1);
    });
    s.on("doc:title", ({ title }: { title: string }) => {
      setDoc((d) => (d ? { ...d, title } : d));
    });
    s.on("cursor:update", (cursor: RemoteCursor) => {
      setRemoteCursors((prev) => {
        const updated = new Map(prev);
        updated.set(cursor.socketId, cursor);
        return updated;
      });
    });
    s.on("cursor:remove", ({ socketId }: { socketId: string }) => {
      setRemoteCursors((prev) => {
        const updated = new Map(prev);
        updated.delete(socketId);
        return updated;
      });
    });
    s.on("doc:error", (msg: string) => toast.error(msg));

    return () => {
      s.off("presence:update");
      s.off("doc:remote-change");
      s.off("doc:title");
      s.off("cursor:update");
      s.off("cursor:remove");
      s.off("doc:error");
    };
  }, [user, doc?._id]);

  useEffect(
    () => () => {
      closeSocket();
    },
    [],
  );

  const handleEditorChange = (content: OutputData) => {
    if (!canEdit || !doc) return;
    localEditing.current = true;
    if (saveTimer.current) clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(() => {
      const json = JSON.stringify(content);
      if (json === lastSavedJson.current) {
        localEditing.current = false;
        return;
      }
      lastSavedJson.current = json;
      setSaveState("saving");
      getSocket().emit("doc:change", { docId: doc._id, content });
      setTimeout(() => {
        setSaveState("saved");
        setTimeout(() => setSaveState("idle"), 1000);
      }, 200);
      localEditing.current = false;
    }, DEBOUNCE);
  };

  const handleCursorChange = (
    cursorData: { index: number; length: number; x: number; y: number } | null,
  ) => {
    if (!doc || !canEdit || !cursorData) return;
    if (cursorThrottleTimer.current) clearTimeout(cursorThrottleTimer.current);
    cursorThrottleTimer.current = setTimeout(() => {
      const socket = getSocket();
      socket.emit("cursor:update", {
        docId: doc._id,
        index: cursorData.index,
        length: cursorData.length,
        x: cursorData.x,
        y: cursorData.y,
      });
    }, CURSOR_THROTTLE);
  };

  const handleTitleChange = (title: string) => {
    if (!doc || !canEdit) return;
    setDoc({ ...doc, title });
    getSocket().emit("doc:title", { docId: doc._id, title });
  };

  if (loading || !doc)
    return (
      <div className="min-h-screen flex items-center justify-center bg-white">
        <Loader2 className="w-5 h-5 animate-spin text-gray-200" />
      </div>
    );

  return (
    <div className="min-h-screen bg-white text-gray-900 selection:bg-gray-100">
      <header className="sticky top-0 bg-white/80 backdrop-blur-sm z-30 border-b border-gray-50">
        <div className="max-w-5xl mx-auto px-4 h-12 flex items-center justify-between">
          <div className="flex items-center gap-2 min-w-0">
            <Link
              href="/dashboard"
              className="p-1.5 hover:bg-gray-100 rounded-md transition-colors text-gray-400 hover:text-gray-900"
            >
              <ArrowLeft className="w-4 h-4" />
            </Link>
            <div className="h-4 w-px bg-gray-100 mx-1" />
            <span className="text-xs font-bold tracking-tight uppercase text-gray-400">
              Collabpad
            </span>
            <div className="h-4 w-px bg-gray-100 mx-1" />
            <div className="flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-wider text-gray-400">
              {saveState === "saving" && (
                <span className="flex items-center gap-1 text-gray-900">
                  <Loader2 className="w-2.5 h-2.5 animate-spin" /> Saving
                </span>
              )}
              {saveState === "saved" && (
                <span className="flex items-center gap-1 text-green-600">
                  <Check className="w-2.5 h-2.5" /> Saved
                </span>
              )}
              {saveState === "idle" && (
                <span className="flex items-center gap-1">
                  {canEdit ? "Synced" : "Read Only"}
                </span>
              )}
            </div>
          </div>

          <div className="flex items-center gap-3">
            <div className="flex -space-x-1.5 mr-2">
              {presence.slice(0, 4).map((p) => (
                <div
                  key={p.userId}
                  title={p.displayName}
                  className="w-6 h-6 rounded-full border-2 border-white text-[10px] font-bold flex items-center justify-center text-white shadow-sm ring-1 ring-gray-50"
                  style={{ backgroundColor: p.avatarColor }}
                >
                  {p.displayName.slice(0, 1).toUpperCase()}
                </div>
              ))}
              {presence.length > 4 && (
                <div className="w-6 h-6 rounded-full border-2 border-white bg-gray-100 text-[10px] font-bold flex items-center justify-center text-gray-500">
                  +{presence.length - 4}
                </div>
              )}
            </div>

            {isOwner && <ShareDialog documentId={doc._id} />}

            <Link
              href="/settings"
              className="p-1.5 hover:bg-gray-100 rounded-md transition-colors text-gray-400 hover:text-gray-900"
            >
              <Settings className="w-4 h-4" />
            </Link>
          </div>
        </div>
      </header>

      <main className="max-w-3xl mx-auto px-6 py-16 md:py-24">
        <input
          value={doc.title}
          onChange={(e) => handleTitleChange(e.target.value)}
          readOnly={!canEdit}
          placeholder="Untitled document"
          className="w-full bg-transparent border-0 outline-none text-4xl md:text-5xl font-bold tracking-tight mb-12 placeholder:text-gray-100"
        />
        <div className="relative">
          <Editor
            data={doc.content}
            readOnly={!canEdit}
            onChange={handleEditorChange}
            onCursorChange={handleCursorChange}
            externalVersion={extVersion}
          />

          <div className="absolute inset-0 pointer-events-none">
            {Array.from(remoteCursors.values()).map(
              (cursor) =>
                cursor.x !== undefined &&
                cursor.y !== undefined && (
                  <div
                    key={cursor.socketId}
                    className="absolute transition-all duration-100 ease-linear flex flex-col items-start"
                    style={{
                      left: `${cursor.x}px`,
                      top: `${cursor.y - 20}px`,
                    }}
                  >
                    <div
                      className="px-1.5 py-0.5 rounded-sm text-[9px] font-bold text-white shadow-sm whitespace-nowrap mb-0.5 uppercase tracking-tighter"
                      style={{ backgroundColor: cursor.avatarColor }}
                    >
                      {cursor.displayName}
                    </div>
                    <div
                      className="w-0.5 h-5 opacity-50"
                      style={{ backgroundColor: cursor.avatarColor }}
                    />
                  </div>
                ),
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
