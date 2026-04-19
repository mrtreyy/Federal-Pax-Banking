import { Bell, X, Check, Reply, Paperclip, Send, ArrowLeft, ChevronRight } from "lucide-react";
import type { BankingNotification } from "@/lib/supabase";
import { formatDateTime } from "@/lib/utils";
import { supabase } from "@/lib/supabase";
import { useState } from "react";
import { toast } from "sonner";

interface Props {
  notifications: BankingNotification[];
  onClose: () => void;
  onRefresh: () => void;
}

export default function AdminNotifications({ notifications, onClose, onRefresh }: Props) {
  const adminNotifs = notifications.filter(n => n.target === "admin").sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
  const unread = adminNotifs.filter(n => !n.is_read).length;
  const [selected, setSelected] = useState<BankingNotification | null>(null);
  const [replyText, setReplyText] = useState("");
  const [sending, setSending] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [fileRef, setFileRef] = useState<HTMLInputElement | null>(null);

  const markAllRead = async () => {
    for (const n of adminNotifs.filter(n => !n.is_read)) {
      await supabase.from("banking_notifications").update({ is_read: true }).eq("id", n.id);
    }
    onRefresh();
  };

  const markOne = async (id: string) => {
    await supabase.from("banking_notifications").update({ is_read: true }).eq("id", id);
    onRefresh();
  };

  const handleSendReply = async () => {
    if (!replyText.trim() || !selected) return;
    setSending(true);
    if (selected.account_id) {
      await supabase.from("banking_messages").insert({
        account_id: selected.account_id,
        sender: "admin",
        message: replyText.trim(),
        message_type: "chat",
        is_read: true,
        is_seen: false,
      });
      await supabase.from("banking_notifications").insert({
        account_id: selected.account_id,
        target: selected.account_id,
        title: "Response from Administration",
        body: replyText.trim().slice(0, 150),
        is_read: false,
      });
    }
    setSending(false);
    setReplyText("");
    setSelected(null);
    toast.success("Reply sent to account!");
    onRefresh();
  };

  const handleFileReply = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !selected?.account_id) return;
    setUploading(true);
    const path = `admin-reply-${Date.now()}.${file.name.split(".").pop()}`;
    const { data, error } = await supabase.storage.from("profiles").upload(path, file, { upsert: true });
    if (!error && data) {
      const { data: url } = supabase.storage.from("profiles").getPublicUrl(data.path);
      await supabase.from("banking_messages").insert({
        account_id: selected.account_id,
        sender: "admin",
        message: `[File: ${file.name}] ${url.publicUrl}`,
        message_type: "chat",
        is_read: true,
        is_seen: false,
      });
      toast.success("File sent to account.");
    }
    setUploading(false);
    if (fileRef) fileRef.value = "";
  };

  // DETAIL VIEW
  if (selected) {
    return (
      <div className="fixed inset-0 z-50 flex flex-col" style={{ background: "hsl(220,45%,8%)" }}>
        <div className="flex items-center gap-3 px-5 pt-12 pb-4 flex-shrink-0" style={{ background: "hsl(220,55%,12%)", borderBottom: "1px solid rgba(255,255,255,0.06)" }}>
          <button onClick={() => { setSelected(null); setReplyText(""); }} className="text-white/40 hover:text-white"><ArrowLeft size={20} /></button>
          <Bell size={17} style={{ color: "hsl(43,85%,60%)" }} />
          <div className="text-white font-bold flex-1 truncate">Notification</div>
          {!selected.is_read && (
            <button onClick={() => { markOne(selected.id); setSelected({ ...selected, is_read: true }); onRefresh(); }}
              className="text-xs px-3 py-1.5 rounded-xl font-semibold"
              style={{ background: "rgba(34,197,94,0.12)", color: "#22c55e" }}>
              <Check size={11} className="inline mr-1" />Mark Read
            </button>
          )}
        </div>
        <div className="flex-1 overflow-y-auto p-5 space-y-4">
          <div className="rounded-3xl p-5 space-y-3" style={{ background: "hsl(220,50%,14%)", border: "1px solid rgba(255,255,255,0.08)" }}>
            <div className="text-white font-bold text-base">{selected.title}</div>
            <div className="text-white/30 text-xs">{formatDateTime(selected.created_at)}</div>
            <div className="h-px" style={{ background: "rgba(255,255,255,0.07)" }} />
            <div className="text-white/75 text-sm leading-relaxed">{selected.body}</div>
          </div>
          {selected.account_id && (
            <div className="rounded-3xl p-5 space-y-3" style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.08)" }}>
              <div className="text-white/50 text-sm font-semibold flex items-center gap-2"><Reply size={14} /> Reply to Account</div>
              <textarea className="dark-input resize-none w-full text-sm" rows={4}
                placeholder="Type your reply to the account holder..."
                value={replyText} onChange={e => setReplyText(e.target.value)} />
              <div className="flex items-center gap-2">
                <input type="file" className="hidden" accept="image/*,.pdf,.doc,.docx" ref={el => setFileRef(el)} onChange={handleFileReply} />
                <button onClick={() => fileRef?.click()} disabled={uploading}
                  className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs"
                  style={{ background: "rgba(255,255,255,0.07)", color: "rgba(255,255,255,0.5)" }}>
                  {uploading ? <div className="w-3 h-3 border border-yellow-500/40 border-t-yellow-500 rounded-full animate-spin" /> : <Paperclip size={13} />}
                  {uploading ? "Sending..." : "Attach"}
                </button>
                <button onClick={handleSendReply} disabled={sending || !replyText.trim()}
                  className="flex-1 gold-btn py-2 text-sm font-semibold flex items-center justify-center gap-2">
                  {sending ? <div className="w-4 h-4 border-2 border-gray-900/30 border-t-gray-900 rounded-full animate-spin" /> : <><Send size={13} /> Send Reply</>}
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    );
  }

  // LIST VIEW
  return (
    <div className="fixed inset-0 z-50 flex flex-col" style={{ background: "hsl(220,45%,8%)" }}>
      <div className="flex items-center justify-between px-5 py-4 flex-shrink-0" style={{ background: "hsl(220,55%,13%)", borderBottom: "1px solid rgba(255,255,255,0.08)" }}>
        <div className="flex items-center gap-3">
          <button onClick={onClose} className="text-white/40 hover:text-white"><ArrowLeft size={20} /></button>
          <Bell size={20} style={{ color: "hsl(43,85%,60%)" }} />
          <div>
            <div className="text-white font-bold">Notifications</div>
            {unread > 0 && <div className="text-white/40 text-xs">{unread} unread</div>}
          </div>
        </div>
        {unread > 0 && (
          <button onClick={markAllRead} className="text-xs text-yellow-400 hover:text-yellow-300 transition-colors">Mark all read</button>
        )}
      </div>

      <div className="flex-1 overflow-y-auto p-4 space-y-2">
        {adminNotifs.length === 0 ? (
          <div className="text-center py-16">
            <Bell size={40} className="mx-auto mb-3 text-white/15" />
            <div className="text-white/30 text-sm">No notifications yet</div>
          </div>
        ) : (
          adminNotifs.map(n => (
            <button key={n.id} onClick={() => { setSelected(n); if (!n.is_read) markOne(n.id); }}
              className="w-full text-left p-4 rounded-2xl transition-colors hover:bg-white/5"
              style={{ background: n.is_read ? "rgba(255,255,255,0.03)" : "rgba(200,155,50,0.05)", border: `1px solid ${n.is_read ? "rgba(255,255,255,0.06)" : "rgba(200,155,50,0.2)"}` }}>
              <div className="flex items-start gap-3">
                <div className="w-9 h-9 rounded-2xl flex items-center justify-center flex-shrink-0" style={{ background: n.is_read ? "rgba(255,255,255,0.06)" : "rgba(200,155,50,0.15)" }}>
                  <Bell size={15} style={{ color: n.is_read ? "rgba(255,255,255,0.4)" : "hsl(43,85%,60%)" }} />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-start justify-between gap-2">
                    <div className="text-white text-sm font-semibold">{n.title}</div>
                    {!n.is_read && <div className="w-2 h-2 rounded-full flex-shrink-0 mt-1.5" style={{ background: "hsl(43,85%,60%)" }} />}
                  </div>
                  <div className="text-white/60 text-xs leading-relaxed mt-0.5 line-clamp-2">{n.body}</div>
                  <div className="text-white/25 text-xs mt-1">{formatDateTime(n.created_at)}</div>
                </div>
                <ChevronRight size={14} className="text-white/20 flex-shrink-0 mt-1" />
              </div>
            </button>
          ))
        )}
      </div>
    </div>
  );
}
