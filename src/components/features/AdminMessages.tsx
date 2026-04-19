import { useState, useEffect, useRef } from "react";
import { X, Send, ArrowLeft, MessageSquare, CheckCheck, Check } from "lucide-react";
import { supabase, type Account, type BankingMessage } from "@/lib/supabase";
import { getInitials, formatDateTime } from "@/lib/utils";
import { usePolling } from "@/hooks/usePolling";

interface Props {
  onClose: () => void;
  accounts: Account[];
}

export default function AdminMessages({ onClose, accounts }: Props) {
  const [selectedAccount, setSelectedAccount] = useState<Account | null>(null);
  const [messages, setMessages] = useState<BankingMessage[]>([]);
  const [allMessages, setAllMessages] = useState<BankingMessage[]>([]);
  const [reply, setReply] = useState("");
  const [sending, setSending] = useState(false);
  const [adminTyping, setAdminTyping] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);

  const fetchAllMessages = async () => {
    const { data } = await supabase
      .from("banking_messages")
      .select("*")
      .order("created_at", { ascending: false });
    if (data) setAllMessages(data);
  };

  const fetchThreadMessages = async (accountId: string) => {
    const { data } = await supabase
      .from("banking_messages")
      .select("*")
      .eq("account_id", accountId)
      .order("created_at", { ascending: true });
    if (data) {
      setMessages(data);
      // Mark as seen
      for (const msg of data.filter((m) => m.sender !== "admin" && !m.is_seen)) {
        await supabase.from("banking_messages").update({ is_seen: true, is_read: true }).eq("id", msg.id);
      }
    }
  };

  usePolling(fetchAllMessages, 4000, !selectedAccount);
  usePolling(() => selectedAccount && fetchThreadMessages(selectedAccount.id), 3000, !!selectedAccount);

  useEffect(() => {
    if (selectedAccount) {
      bottomRef.current?.scrollIntoView({ behavior: "smooth" });
    }
  }, [messages, selectedAccount]);

  const handleSendReply = async () => {
    if (!reply.trim() || !selectedAccount) return;
    setSending(true);
    const msgText = reply.trim();
    setReply("");

    await supabase.from("banking_messages").insert({
      account_id: selectedAccount.id,
      sender: "admin",
      message: msgText,
      message_type: "chat",
      is_read: true,
      is_seen: false,
    });

    await supabase.from("banking_notifications").insert({
      account_id: selectedAccount.id,
      target: selectedAccount.id,
      title: "New message from Administration",
      body: msgText.slice(0, 100),
      is_read: false,
    });

    setSending(false);
    fetchThreadMessages(selectedAccount.id);
  };

  // Group messages by account for list view
  const accountThreads = accounts.map((acc) => {
    const msgs = allMessages.filter((m) => m.account_id === acc.id);
    const lastMsg = msgs[0];
    const unread = msgs.filter((m) => m.sender !== "admin" && !m.is_seen).length;
    return { account: acc, lastMsg, unread };
  }).filter((t) => t.lastMsg);

  if (selectedAccount) {
    const acct = accounts.find((a) => a.id === selectedAccount.id);
    return (
      <div className="fixed inset-0 z-50 flex flex-col" style={{ background: "hsl(220,45%,8%)" }}>
        <div className="flex items-center gap-3 px-5 py-4 flex-shrink-0"
          style={{ background: "hsl(220,55%,13%)", borderBottom: "1px solid rgba(255,255,255,0.08)" }}>
          <button onClick={() => setSelectedAccount(null)} className="text-white/40 hover:text-white p-1"><ArrowLeft size={20} /></button>
          {acct?.profile_picture ? (
            <img src={acct.profile_picture} alt="" className="w-9 h-9 rounded-full object-cover" style={{ border: "2px solid hsl(43,85%,55%)" }} />
          ) : (
            <div className="w-9 h-9 rounded-full flex items-center justify-center text-sm font-bold"
              style={{ background: "hsl(220,50%,22%)", color: "hsl(43,85%,60%)" }}>
              {getInitials(selectedAccount.account_name)}
            </div>
          )}
          <div className="flex-1 min-w-0">
            <div className="text-white font-semibold text-sm truncate">{selectedAccount.account_name}</div>
            <div className="text-white/40 text-xs">{selectedAccount.account_number}</div>
          </div>
          <button onClick={onClose} className="text-white/40 hover:text-white p-1"><X size={20} /></button>
        </div>

        <div className="flex-1 overflow-y-auto p-4 space-y-3">
          {messages.map((msg) => {
            const isAdmin = msg.sender === "admin";
            return (
              <div key={msg.id} className={`flex ${isAdmin ? "justify-end" : "justify-start"}`}>
                <div className="max-w-[75%]">
                  <div className="px-4 py-2.5 rounded-2xl text-sm leading-relaxed"
                    style={isAdmin
                      ? { background: "linear-gradient(135deg, hsl(43,85%,55%), hsl(38,80%,42%))", color: "#1a1a1a" }
                      : { background: "hsl(220,45%,16%)", color: "rgba(255,255,255,0.85)", border: "1px solid rgba(255,255,255,0.08)" }
                    }>
                    {msg.message}
                  </div>
                  <div className="flex items-center gap-1 mt-1 px-1" style={{ justifyContent: isAdmin ? "flex-end" : "flex-start" }}>
                    <span className="text-white/25 text-xs">{formatDateTime(msg.created_at)}</span>
                    {isAdmin && (
                      msg.is_seen
                        ? <CheckCheck size={12} color="hsl(43,85%,60%)" />
                        : <Check size={12} className="text-white/30" />
                    )}
                  </div>
                </div>
              </div>
            );
          })}
          <div ref={bottomRef} />
        </div>

        <div className="flex items-center gap-3 px-4 py-4 flex-shrink-0"
          style={{ background: "hsl(220,55%,13%)", borderTop: "1px solid rgba(255,255,255,0.08)" }}>
          <input type="text" className="dark-input flex-1 py-2.5 text-sm" placeholder="Type a reply..."
            value={reply} onChange={(e) => setReply(e.target.value)} onKeyDown={(e) => e.key === "Enter" && handleSendReply()} />
          <button onClick={handleSendReply} disabled={!reply.trim() || sending}
            className="w-11 h-11 rounded-2xl flex items-center justify-center flex-shrink-0 transition-all"
            style={{ background: reply.trim() ? "linear-gradient(135deg, hsl(43,85%,55%), hsl(38,80%,42%))" : "rgba(255,255,255,0.07)" }}>
            <Send size={16} style={{ color: reply.trim() ? "#1a1a1a" : "rgba(255,255,255,0.3)" }} />
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 z-50 flex flex-col" style={{ background: "hsl(220,45%,8%)" }}>
      <div className="flex items-center justify-between px-5 py-4 flex-shrink-0"
        style={{ background: "hsl(220,55%,13%)", borderBottom: "1px solid rgba(255,255,255,0.08)" }}>
        <div className="flex items-center gap-2">
          <MessageSquare size={20} style={{ color: "hsl(43,85%,60%)" }} />
          <span className="text-white font-bold">Messages</span>
        </div>
        <button onClick={onClose} className="text-white/40 hover:text-white p-1"><X size={20} /></button>
      </div>

      <div className="flex-1 overflow-y-auto">
        {accountThreads.length === 0 ? (
          <div className="text-center py-16">
            <MessageSquare size={40} className="mx-auto mb-3 text-white/15" />
            <div className="text-white/30 text-sm">No messages yet</div>
          </div>
        ) : (
          <div className="p-4 space-y-2">
            {accountThreads.map(({ account: acc, lastMsg, unread }) => (
              <button key={acc.id} onClick={() => setSelectedAccount(acc)}
                className="w-full flex items-center gap-3 p-4 rounded-2xl text-left hover:bg-white/5 transition-colors"
                style={{ background: unread > 0 ? "rgba(200,155,50,0.05)" : "rgba(255,255,255,0.03)", border: `1px solid ${unread > 0 ? "rgba(200,155,50,0.2)" : "rgba(255,255,255,0.06)"}` }}>
                {acc.profile_picture ? (
                  <img src={acc.profile_picture} alt="" className="w-12 h-12 rounded-full object-cover flex-shrink-0" style={{ border: "2px solid hsl(43,85%,55%)" }} />
                ) : (
                  <div className="w-12 h-12 rounded-full flex items-center justify-center text-base font-bold flex-shrink-0"
                    style={{ background: "hsl(220,50%,22%)", color: "hsl(43,85%,60%)" }}>
                    {getInitials(acc.account_name)}
                  </div>
                )}
                <div className="flex-1 min-w-0">
                  <div className="flex justify-between items-center">
                    <span className="text-white font-semibold text-sm">{acc.account_name}</span>
                    <span className="text-white/30 text-xs">{lastMsg ? formatDateTime(lastMsg.created_at).slice(0, 10) : ""}</span>
                  </div>
                  <div className="flex justify-between items-center mt-0.5">
                    <span className="text-white/50 text-xs truncate">{lastMsg?.message?.slice(0, 40)}{(lastMsg?.message?.length ?? 0) > 40 ? "..." : ""}</span>
                    {unread > 0 && (
                      <span className="flex-shrink-0 ml-2 bg-yellow-500 text-gray-900 text-xs rounded-full w-5 h-5 flex items-center justify-center font-bold">
                        {unread}
                      </span>
                    )}
                  </div>
                </div>
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
