"use client";
import { useState } from "react";
import { api } from "@/lib/api";
import toast from "react-hot-toast";
import { Share2, Copy, X, Check } from "lucide-react";

export const ShareDialog = ({ documentId }: { documentId: string }) => {
  const [open, setOpen] = useState(false);
  const [role, setRole] = useState<"viewer"|"editor">("editor");
  const [link, setLink] = useState<string>("");
  const [busy, setBusy] = useState(false);
  const [copied, setCopied] = useState(false);

  const create = async () => {
    setBusy(true);
    try {
      const { data } = await api.post(`/api/share/${documentId}`, { role });
      const url = `${window.location.origin}/invite/${data.link.token}`;
      setLink(url);
    } catch (e:any) { toast.error(e?.response?.data?.error || "Failed"); }
    finally { setBusy(false); }
  };

  const copy = () => { 
    navigator.clipboard.writeText(link); 
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
    toast.success("Link copied to clipboard"); 
  };

  return (
    <>
      <button onClick={()=>setOpen(true)} className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold bg-gray-900 text-white hover:bg-gray-800 transition-all">
        <Share2 className="w-3.5 h-3.5"/> Share
      </button>
      
      {open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-gray-900/10 backdrop-blur-sm" onClick={()=>setOpen(false)}>
          <div className="bg-white rounded-2xl shadow-2xl shadow-gray-200/50 p-6 w-full max-w-sm border border-gray-100" onClick={e=>e.stopPropagation()}>
            <div className="flex items-center justify-between mb-6">
              <h3 className="text-lg font-bold tracking-tight">Share document</h3>
              <button onClick={()=>setOpen(false)} className="p-1 hover:bg-gray-50 rounded-lg transition-colors text-gray-400 hover:text-gray-900">
                <X className="w-4 h-4"/>
              </button>
            </div>
            
            <div className="space-y-4">
              <div>
                <label className="block text-[10px] font-bold uppercase tracking-wider text-gray-400 mb-2">Access Level</label>
                <div className="flex gap-1 p-1 bg-gray-50 rounded-xl">
                  <button 
                    onClick={() => setRole("viewer")}
                    className={`flex-1 py-1.5 text-xs font-semibold rounded-lg transition-all ${role === "viewer" ? "bg-white shadow-sm text-gray-900" : "text-gray-400 hover:text-gray-600"}`}
                  >
                    Viewer
                  </button>
                  <button 
                    onClick={() => setRole("editor")}
                    className={`flex-1 py-1.5 text-xs font-semibold rounded-lg transition-all ${role === "editor" ? "bg-white shadow-sm text-gray-900" : "text-gray-400 hover:text-gray-600"}`}
                  >
                    Editor
                  </button>
                </div>
              </div>

              {!link ? (
                <button 
                  onClick={create} 
                  disabled={busy} 
                  className="w-full py-2.5 rounded-xl bg-gray-900 text-white text-xs font-bold hover:bg-gray-800 transition-all disabled:opacity-50"
                >
                  {busy ? "Generating Link..." : "Create Invite Link"}
                </button>
              ) : (
                <div className="space-y-2">
                  <label className="block text-[10px] font-bold uppercase tracking-wider text-gray-400">Invite Link</label>
                  <div className="flex gap-2 p-1 pl-3 bg-gray-50 rounded-xl border border-gray-100 items-center">
                    <input readOnly value={link} className="flex-1 bg-transparent text-xs font-medium outline-none text-gray-600 truncate"/>
                    <button 
                      onClick={copy} 
                      className={`p-2 rounded-lg transition-all ${copied ? "bg-green-50 text-green-600" : "hover:bg-white hover:shadow-sm text-gray-400 hover:text-gray-900"}`}
                    >
                      {copied ? <Check className="w-4 h-4"/> : <Copy className="w-4 h-4"/>}
                    </button>
                  </div>
                  <p className="text-[10px] text-gray-400 text-center">Anyone with this link can {role} this document.</p>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </>
  );
};

