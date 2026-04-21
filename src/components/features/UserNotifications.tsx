import { useState, useEffect } from "react";
import { ArrowLeft, Bell, Check, Reply, Paperclip, Send, ChevronRight } from "lucide-react";
import { supabase, type BankingNotification } from "@/lib/supabase";
import { formatDateTime } from "@/lib/utils";
import { usePolling } from "@/hooks/usePolling";
import { toast } from "sonner";

interface Props {
  notifications: BankingNotification[];
  accountId: string;
  onClose: () => void;
  onRefresh: () => void;
}

export default function UserNotifications({ notifications, accountId, onClose, onRefresh }: Props) {
  const myNotifs = notifications
    .filter(n => n.account_id === accountId || n.target === accountId)
    .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
    
  const unread = myNotifs.filter(n => !n.is_read).length;
  const [selected, setSelected] = useState<BankingNotification | null>(null);
  const [replyText, setReplyText] = useState("");
  const [sending, setSending] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [fileRef, setFileRef] = useState<HTMLInputElement | null>(null);

  const markAllRead = async () => {
    for (const n of myNotifs.filter(n => !n.is_read)) {
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
    await supabase.from("banking_messages").insert({
      account_id: accountId,
      sender: "user",
      message: `Re: ${selected.title}\n${replyText.trim()}`,
      message_type: "chat",
      is_read: false,
      is_seen: false,
    });
    await supabase.from("banking_notifications").insert({
      account_id: accountId,
      target: "cas",
      title: `Notification Reply — ${selected.title}`,
      body: replyText.trim().slice(0, 150),
      is_read: false,
    });
    await supabase.from("banking_notifications").insert({
      account_id: accountId,
      target: "admin",
      title: `Notification Reply — ${selected.title}`,
      body: replyText.trim().slice(0, 150),
      is_read: false,
    });
    setSending(false);
    setReplyText("");
    toast.success("Reply sent to administration!");
  };

  const handleFileReply = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !selected) return;
    setUploading(true);
    const path = `reply-${accountId}-${Date.now()}.${file.name.split(".").pop()}`;
    const { data, error } = await supabase.storage.from("profiles").upload(path, file, { upsert: true });
    if (!error && data) {
      const { data: url } = supabase.storage.from("profiles").getPublicUrl(data.path);
      await supabase.from("banking_messages").insert({
        account_id: accountId,
        sender: "user",
        message: `[File: ${file.name}] ${url.publicUrl}`,
        message_type: "chat",
        is_read: false,
        is_seen: false,
      });
      toast.success("File attached and sent to administration.");
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
            <button onClick={() => { markOne(selected.id); setSelected({ ...selected, is_read: true }); }}
              className="text-xs px-3 py-1.5 rounded-xl font-semibold"
              style={{ background: "rgba(34,197,94,0.1)", color: "#22c55e" }}>
              <Check size={13} className="inline mr-1" /> Mark Read
            </button>
          )}
        </div>

        <div className="flex-1 overflow-y-auto p-5 space-y-4">
          <div className="rounded-2xl p-4" style={{ background: "hsl(220,50%,14%)", border: "1px solid rgba(255,255,255,0.08)" }}>
            <div className="text-white/40 text-xs mb-2">{formatDateTime(selected.created_at)}</div>
            <div className="text-white font-bold text-lg mb-2">{selected.title}</div>
            <div className="text-white/70 text-sm leading-relaxed">{selected.body}</div>
          </div>

          <div className="rounded-2xl p-4 space-y-3" style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.08)" }}>
            <div className="text-white/50 text-sm font-semibold flex items-center gap-2">
              <Reply size={14} /> Reply to Administration
            </div>
            <textarea
              className="dark-input resize-none w-full text-sm leading-relaxed"
              rows={4}
              placeholder="Type your reply..."
              value={replyText}
              onChange={e => setReplyText(e.target.value)}
            />
            <div className="flex items-center gap-2">
              <input type="file" className="hidden" accept="image/*,.pdf,.doc,.docx"
                ref={el => setFileRef(el)} onChange={handleFileReply} />
              <button onClick={() => fileRef?.click()} disabled={uploading}
                className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs"
                style={{ background: "rgba(255,255,255,0.07)", color: "rgba(255,255,255,0.5)" }}>
                {uploading ? <div className="w-3 h-3 border border-yellow-500/40 border-t-yellow-500 rounded-full animate-spin" /> : <Paperclip size={13} />}
                {uploading ? "Sending..." : "Attach File"}
              </button>
              <button onClick={handleSendReply} disabled={sending || !replyText.trim()}
                className="flex-1 gold-btn py-2 text-sm font-semibold flex items-center justify-center gap-2">
                {sending ? <div className="w-4 h-4 border-2 border-gray-900/30 border-t-gray-900 rounded-full animate-spin" /> : <><Send size={13} /> Send Reply</>}
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // LIST VIEW
  return (
    <div className="fixed inset-0 z-50 flex flex-col" style={{ background: "hsl(220,45%,8%)" }}>
      <div className="flex items-center justify-between px-5 pt-12 pb-4 flex-shrink-0" style={{ background: "hsl(220,55%,12%)", borderBottom: "1px solid rgba(255,255,255,0.06)" }}>
        <div className="flex items-center gap-3">
          <button onClick={onClose} className="text-white/40 hover:text-white"><ArrowLeft size={20} /></button>
          <Bell size={18} style={{ color: "hsl(43,85%,60%)" }} />
          <div>
            <div className="text-white font-bold">Notifications</div>
            {unread > 0 && <div className="text-white/40 text-xs">{unread} unread</div>}
          </div>
        </div>
        {unread > 0 && (
          <button onClick={markAllRead} className="text-xs text-yellow-400 hover:text-yellow-300">Mark all read</button>
        )}
      </div>

      {myNotifs.length === 0 ? (
        <div className="flex-1 flex flex-col items-center justify-center p-6 text-center">
          <Bell size={48} className="text-white/20 mb-4" />
          <h3 className="text-white font-semibold text-base mb-2">No Notifications</h3>
          <p className="text-white/40 text-sm leading-relaxed max-w-xs">
            You don't have any notifications at this time. When you receive alerts, messages, or updates from BankUnited, they will appear here.
          </p>
        </div>
      ) : (
        <div className="flex-1 overflow-y-auto p-4 space-y-2">
          {myNotifs.map(n => (
            <button key={n.id} onClick={() => { setSelected(n); if (!n.is_read) markOne(n.id); }}
              className="w-full text-left p-4 rounded-2xl transition-colors hover:bg-white/5"
              style={{ background: n.is_read ? "rgba(255,255,255,0.03)" : "rgba(200,155,50,0.05)", border: `1px solid ${n.is_read ? "rgba(255,255,255,0.06)" : "rgba(200,155,50,0.2)"}` }}>
              <div className="flex items-start gap-3">
                <div className="w-9 h-9 rounded-2xl flex items-center justify-center flex-shrink-0"
                  style={{ background: n.is_read ? "rgba(255,255,255,0.06)" : "rgba(200,155,50,0.15)" }}>
                  <Bell size={15} style={{ color: n.is_read ? "rgba(255,255,255,0.4)" : "hsl(43,85%,60%)" }} />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-0.5">
                    <span className="text-white text-sm font-semibold truncate">{n.title}</span>
                    {!n.is_read && <div className="w-2 h-2 rounded-full flex-shrink-0" style={{ background: "hsl(43,85%,60%)" }} />}
                  </div>
                  <div className="text-white/50 text-xs leading-relaxed line-clamp-2">{n.body}</div>
                  <div className="flex items-center gap-2 mt-1.5">
                    <span className="text-white/30 text-xs">{formatDateTime(n.created_at)}</span>
                  </div>
                </div>
                <ChevronRight size={14} className="text-white/20 flex-shrink-0 mt-1" />
              </div>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}