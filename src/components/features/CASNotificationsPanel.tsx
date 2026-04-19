import { useState, useEffect } from "react";
import { ArrowLeft, Bell, Check, Reply, Paperclip, X, Send, ChevronRight } from "lucide-react";
import { supabase, type BankingNotification, type Account } from "@/lib/supabase";
import { formatDateTime } from "@/lib/utils";
import { usePolling } from "@/hooks/usePolling";
import { toast } from "sonner";

interface Props {
  accounts: Account[];
  onClose: () => void;
}

export default function CASNotificationsPanel({ accounts, onClose }: Props) {
  const [notifications, setNotifications] = useState<BankingNotification[]>([]);
  const [selected, setSelected] = useState<BankingNotification | null>(null);
  const [replyText, setReplyText] = useState("");
  const [sending, setSending] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [fileRef, setFileRef] = useState<HTMLInputElement | null>(null);

  const fetchNotifs = async () => {
    const { data } = await supabase
      .from("banking_notifications")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(200);
    if (data) setNotifications(data);
  };

  useEffect(() => { fetchNotifs(); }, []);
  usePolling(fetchNotifs, 6000, !selected);

  const markRead = async (id: string) => {
    await supabase.from("banking_notifications").update({ is_read: true }).eq("id", id);
    fetchNotifs();
  };

  const markAllRead = async () => {
    const unread = notifications.filter(n => !n.is_read);
    for (const n of unread) {
      await supabase.from("banking_notifications").update({ is_read: true }).eq("id", n.id);
    }
    fetchNotifs();
    toast.success("All notifications marked as read.");
  };

  const handleSendReply = async () => {
    if (!selected || !replyText.trim()) return;
    setSending(true);

    const targetAccountId = selected.account_id || selected.target;
    const linkedAccount = accounts.find(a => a.id === targetAccountId);

    if (targetAccountId && targetAccountId !== "admin" && targetAccountId !== "cas") {
      await supabase.from("banking_messages").insert({
        account_id: targetAccountId,
        sender: "admin",
        message: replyText.trim(),
        message_type: "chat",
        is_read: true,
        is_seen: false,
      });
      await supabase.from("banking_notifications").insert({
        account_id: targetAccountId,
        target: targetAccountId,
        title: "Response from CEO Administration",
        body: replyText.trim().slice(0, 150),
        is_read: false,
      });
    }

    await markRead(selected.id);
    setSending(false);
    setReplyText("");
    setSelected(null);
    toast.success(`Reply sent to ${linkedAccount?.account_name || "account"}.`);
    fetchNotifs();
  };

  const handleFileReply = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !selected) return;
    setUploading(true);
    const path = `cas-reply-${Date.now()}.${file.name.split(".").pop()}`;
    const { data, error } = await supabase.storage.from("profiles").upload(path, file, { upsert: true });
    if (!error && data) {
      const { data: url } = supabase.storage.from("profiles").getPublicUrl(data.path);
      const targetAccountId = selected.account_id || selected.target;
      if (targetAccountId && targetAccountId !== "admin" && targetAccountId !== "cas") {
        await supabase.from("banking_messages").insert({
          account_id: targetAccountId,
          sender: "admin",
          message: `[File from CEO Administration: ${file.name}] ${url.publicUrl}`,
          message_type: "chat",
          is_read: true,
          is_seen: false,
        });
        await supabase.from("banking_notifications").insert({
          account_id: targetAccountId,
          target: targetAccountId,
          title: "File from CEO Administration",
          body: `A file has been shared with you by GHOB CEO Administration: ${file.name}`,
          is_read: false,
        });
      }
      toast.success("File sent successfully.");
    }
    setUploading(false);
    if (fileRef) fileRef.value = "";
  };

  // Category badge
  const getCategoryBadge = (title: string) => {
    if (title.toLowerCase().includes("card")) return { label: "Virtual Card", color: "#c89b3c" };
    if (title.toLowerCase().includes("loan")) return { label: "Loan", color: "#a855f7" };
    if (title.toLowerCase().includes("tier")) return { label: "Tier", color: "#3b82f6" };
    if (title.toLowerCase().includes("cheque")) return { label: "Cheque", color: "#14b8a6" };
    if (title.toLowerCase().includes("support") || title.toLowerCase().includes("chat")) return { label: "Support", color: "#22c55e" };
    if (title.toLowerCase().includes("dispute")) return { label: "Dispute", color: "#ef4444" };
    return { label: "General", color: "rgba(255,255,255,0.3)" };
  };

  const unreadCount = notifications.filter(n => !n.is_read).length;

  // DETAIL VIEW
  if (selected) {
    const linkedAccount = accounts.find(a => a.id === selected.account_id || a.id === selected.target);
    const badge = getCategoryBadge(selected.title);
    return (
      <div className="fixed inset-0 z-50 flex flex-col" style={{ background: "hsl(220,45%,8%)" }}>
        <div className="flex items-center gap-3 px-5 pt-12 pb-4 flex-shrink-0" style={{ background: "hsl(220,55%,12%)", borderBottom: "1px solid rgba(255,255,255,0.06)" }}>
          <button onClick={() => { setSelected(null); setReplyText(""); }} className="text-white/40 hover:text-white"><ArrowLeft size={20} /></button>
          <Bell size={17} style={{ color: "hsl(43,85%,60%)" }} />
          <div className="text-white font-bold flex-1 truncate">{selected.title}</div>
        </div>

        <div className="flex-1 overflow-y-auto p-5 space-y-4">
          {/* Source account */}
          {linkedAccount && (
            <div className="rounded-2xl p-3 flex items-center gap-3" style={{ background: "rgba(200,155,50,0.07)", border: "1px solid rgba(200,155,50,0.18)" }}>
              <div className="w-9 h-9 rounded-full flex items-center justify-center text-sm font-bold flex-shrink-0" style={{ background: "hsl(220,50%,22%)", color: "hsl(43,85%,60%)" }}>
                {linkedAccount.account_name.slice(0, 2).toUpperCase()}
              </div>
              <div>
                <div className="text-white font-semibold text-sm">{linkedAccount.account_name}</div>
                <div className="text-white/40 text-xs">{linkedAccount.account_number} · Tier {linkedAccount.account_tier || 1}</div>
              </div>
            </div>
          )}

          {/* Notification content */}
          <div className="rounded-3xl p-5" style={{ background: "hsl(220,50%,14%)", border: "1px solid rgba(255,255,255,0.08)" }}>
            <div className="flex items-start justify-between gap-2 mb-3">
              <div>
                <span className="text-xs px-2 py-0.5 rounded-full font-semibold" style={{ background: `${badge.color}20`, color: badge.color }}>{badge.label}</span>
              </div>
              <span className="text-white/25 text-xs flex-shrink-0">{formatDateTime(selected.created_at)}</span>
            </div>
            <div className="text-white font-bold mb-2">{selected.title}</div>
            <div className="text-white/70 text-sm leading-relaxed">{selected.body}</div>
            {!selected.is_read && (
              <button onClick={() => { markRead(selected.id); setSelected({ ...selected, is_read: true }); }}
                className="mt-4 flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-semibold"
                style={{ background: "rgba(34,197,94,0.1)", color: "#22c55e", border: "1px solid rgba(34,197,94,0.2)" }}>
                <Check size={13} /> Mark as Read
              </button>
            )}
          </div>

          {/* Reply section */}
          <div className="rounded-3xl p-5 space-y-3" style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.08)" }}>
            <div className="text-white/50 text-sm font-semibold flex items-center gap-2">
              <Reply size={14} /> Reply to Account
            </div>
            <textarea
              className="dark-input resize-none w-full text-sm leading-relaxed"
              rows={4}
              placeholder={linkedAccount ? `Reply to ${linkedAccount.account_name}...` : "Type your reply..."}
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
            <div className="text-white font-bold">CAS Notifications</div>
            {unreadCount > 0 && <div className="text-white/40 text-xs">{unreadCount} unread</div>}
          </div>
        </div>
        {unreadCount > 0 && (
          <button onClick={markAllRead} className="text-xs text-yellow-400 hover:text-yellow-300">Mark all read</button>
        )}
      </div>

      <div className="flex-1 overflow-y-auto p-4 space-y-2">
        {notifications.length === 0 ? (
          <div className="text-center py-16">
            <Bell size={40} className="mx-auto mb-3 text-white/10" />
            <div className="text-white/25 text-sm">No notifications yet</div>
          </div>
        ) : (
          notifications.map(n => {
            const linkedAccount = accounts.find(a => a.id === n.account_id || a.id === n.target);
            const badge = getCategoryBadge(n.title);
            return (
              <button key={n.id} onClick={() => { setSelected(n); if (!n.is_read) markRead(n.id); }}
                className="w-full text-left p-4 rounded-2xl transition-colors hover:bg-white/5"
                style={{ background: n.is_read ? "rgba(255,255,255,0.03)" : "rgba(200,155,50,0.05)", border: `1px solid ${n.is_read ? "rgba(255,255,255,0.06)" : "rgba(200,155,50,0.2)"}` }}>
                <div className="flex items-start gap-3">
                  <div className="w-9 h-9 rounded-2xl flex items-center justify-center flex-shrink-0 mt-0.5"
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
                      <span className="text-xs px-2 py-0.5 rounded-full font-medium" style={{ background: `${badge.color}18`, color: badge.color }}>{badge.label}</span>
                      {linkedAccount && <span className="text-white/30 text-xs">{linkedAccount.account_name}</span>}
                      <span className="text-white/20 text-xs ml-auto">{formatDateTime(n.created_at)}</span>
                    </div>
                  </div>
                  <ChevronRight size={14} className="text-white/20 flex-shrink-0 mt-1" />
                </div>
              </button>
            );
          })
        )}
      </div>
    </div>
  );
}
