import { useState, useEffect, useRef } from "react";
import { ArrowLeft, Send, Search } from "lucide-react";
import { supabase, type BankingMessage, type Account } from "@/lib/supabase";
import { formatDateTime, getInitials } from "@/lib/utils";
import { usePolling } from "@/hooks/usePolling";
import bankLogo from "@/assets/bankunited-logo.png";

interface Props {
  accounts: Account[];
  onClose: () => void;
}

export default function CASChatPanel({ accounts, onClose }: Props) {
  const [messages, setMessages] = useState<BankingMessage[]>([]);
  const [selectedAccountId, setSelectedAccountId] = useState<string | null>(null);
  const [reply, setReply] = useState("");
  const [sending, setSending] = useState(false);
  const [search, setSearch] = useState("");
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const fetchMessages = async () => {
    const { data } = await supabase
      .from("banking_messages")
      .select("*")
      .order("created_at", { ascending: true });
    if (data) setMessages(data);
  };

  useEffect(() => { fetchMessages(); }, []);
  usePolling(fetchMessages, 5000, true);

  useEffect(() => {
    if (selectedAccountId) {
      messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
    }
  }, [messages, selectedAccountId]);

  const accountsWithMessages = accounts.filter(a =>
    messages.some(m => m.account_id === a.id)
  );

  const filteredAccounts = accountsWithMessages.filter(a =>
    a.account_name.toLowerCase().includes(search.toLowerCase())
  );

  const getLastMessage = (accountId: string) => {
    const acctMsgs = messages.filter(m => m.account_id === accountId);
    return acctMsgs[acctMsgs.length - 1];
  };

  const getUnreadCount = (accountId: string) =>
    messages.filter(m => m.account_id === accountId && m.sender === "user" && !m.is_seen).length;

  const handleSend = async () => {
    if (!reply.trim() || !selectedAccountId || sending) return;
    setSending(true);
    await supabase.from("banking_messages").insert({
      account_id: selectedAccountId,
      sender: "admin",
      message: reply.trim(),
      message_type: "chat",
      is_read: false,
      is_seen: false,
    });
    // Mark user messages as seen
    await supabase.from("banking_messages")
      .update({ is_seen: true })
      .eq("account_id", selectedAccountId)
      .eq("sender", "user");
    setReply("");
    setSending(false);
    fetchMessages();
  };

  const selectedAccount = accounts.find(a => a.id === selectedAccountId);
  const conversationMsgs = messages.filter(m => m.account_id === selectedAccountId);

  if (selectedAccountId && selectedAccount) {
    return (
      <div className="fixed inset-0 z-50 flex flex-col" style={{ background: "hsl(220,45%,8%)" }}>
        {/* Header */}
        <div className="flex items-center gap-3 px-4 pt-12 pb-4 flex-shrink-0" style={{ background: "hsl(220,55%,12%)", borderBottom: "1px solid rgba(255,255,255,0.06)" }}>
          <button onClick={() => setSelectedAccountId(null)} className="text-white/40 hover:text-white">
            <ArrowLeft size={20} />
          </button>
          {selectedAccount.profile_picture ? (
            <img src={selectedAccount.profile_picture} alt="" className="w-9 h-9 rounded-full object-cover" style={{ border: "2px solid hsl(43,85%,55%)" }} />
          ) : (
            <div className="w-9 h-9 rounded-full flex items-center justify-center text-sm font-bold" style={{ background: "hsl(220,50%,22%)", color: "hsl(43,85%,60%)" }}>
              {getInitials(selectedAccount.account_name)}
            </div>
          )}
          <div className="flex-1 min-w-0">
            <div className="text-white font-bold text-sm">{selectedAccount.account_name}</div>
            <div className="text-white/40 text-xs">{selectedAccount.account_number}</div>
          </div>
        </div>

        {/* Messages */}
        <div className="flex-1 overflow-y-auto p-4 space-y-3">
          {conversationMsgs.length === 0 ? (
            <div className="text-center py-12 text-white/25 text-sm">No messages yet</div>
          ) : (
            conversationMsgs.map(msg => {
              const isAdmin = msg.sender === "admin";
              return (
                <div key={msg.id} className={`flex ${isAdmin ? "justify-end" : "justify-start"}`}>
                  <div className="flex items-end gap-2 max-w-[80%]">
                    {!isAdmin && (
                      selectedAccount.profile_picture ? (
                        <img src={selectedAccount.profile_picture} alt="" className="w-6 h-6 rounded-full object-cover flex-shrink-0 mb-1" />
                      ) : (
                        <div className="w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0 mb-1" style={{ background: "hsl(220,50%,22%)", color: "hsl(43,85%,60%)" }}>
                          {getInitials(selectedAccount.account_name)}
                        </div>
                      )
                    )}
                    <div>
                      <div
                        className="px-4 py-2.5 rounded-2xl text-sm leading-relaxed"
                        style={isAdmin ? {
                          background: "linear-gradient(135deg, hsl(43,85%,55%), hsl(38,80%,45%))",
                          color: "#111",
                          borderBottomRightRadius: 4,
                        } : {
                          background: "hsl(220,50%,18%)",
                          color: "rgba(255,255,255,0.85)",
                          borderBottomLeftRadius: 4,
                        }}
                      >
                        {msg.message}
                      </div>
                      <div className={`text-white/25 text-xs mt-0.5 ${isAdmin ? "text-right" : "text-left"}`}>
                        {formatDateTime(msg.created_at)}
                        {isAdmin && <span className="ml-1">{msg.is_seen ? "✓✓" : "✓"}</span>}
                      </div>
                    </div>
                    {isAdmin && (
                      <img src={bankLogo} alt="CEO" className="w-6 h-6 rounded-full flex-shrink-0 mb-1" />
                    )}
                  </div>
                </div>
              );
            })
          )}
          <div ref={messagesEndRef} />
        </div>

        {/* Input */}
        <div className="flex items-center gap-3 px-4 py-4 flex-shrink-0" style={{ background: "hsl(220,55%,12%)", borderTop: "1px solid rgba(255,255,255,0.06)" }}>
          <input
            className="flex-1 dark-input py-3"
            placeholder="Type a reply..."
            value={reply}
            onChange={e => setReply(e.target.value)}
            onKeyDown={e => e.key === "Enter" && !e.shiftKey && handleSend()}
          />
          <button
            onClick={handleSend}
            disabled={!reply.trim() || sending}
            className="w-11 h-11 rounded-2xl flex items-center justify-center flex-shrink-0 transition-opacity"
            style={{ background: "hsl(43,85%,55%)", opacity: !reply.trim() ? 0.4 : 1 }}
          >
            <Send size={16} className="text-gray-900" />
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 z-50 flex flex-col" style={{ background: "hsl(220,45%,8%)" }}>
      <div className="flex items-center gap-3 px-4 pt-12 pb-4 flex-shrink-0" style={{ background: "hsl(220,55%,12%)", borderBottom: "1px solid rgba(255,255,255,0.06)" }}>
        <button onClick={onClose} className="text-white/40 hover:text-white"><ArrowLeft size={20} /></button>
        <div className="text-white font-bold">Platform Chats</div>
        <span className="text-white/30 text-xs ml-1">({accountsWithMessages.length} accounts)</span>
      </div>

      <div className="px-4 pt-3 pb-2">
        <div className="relative">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-white/30" />
          <input className="dark-input pl-9 text-sm py-2.5" placeholder="Search accounts..." value={search} onChange={e => setSearch(e.target.value)} />
        </div>
      </div>

      <div className="flex-1 overflow-y-auto">
        {filteredAccounts.length === 0 ? (
          <div className="text-center py-16 text-white/25 text-sm">No chat conversations yet</div>
        ) : (
          filteredAccounts.map(acc => {
            const last = getLastMessage(acc.id);
            const unread = getUnreadCount(acc.id);
            return (
              <button
                key={acc.id}
                onClick={() => setSelectedAccountId(acc.id)}
                className="w-full flex items-center gap-3 px-4 py-4 text-left hover:bg-white/5 transition-colors"
                style={{ borderBottom: "1px solid rgba(255,255,255,0.05)" }}
              >
                {acc.profile_picture ? (
                  <img src={acc.profile_picture} alt="" className="w-12 h-12 rounded-full object-cover flex-shrink-0" style={{ border: "2px solid hsl(43,85%,55%)" }} />
                ) : (
                  <div className="w-12 h-12 rounded-full flex items-center justify-center text-base font-bold flex-shrink-0" style={{ background: "hsl(220,50%,22%)", color: "hsl(43,85%,60%)" }}>
                    {getInitials(acc.account_name)}
                  </div>
                )}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between mb-0.5">
                    <span className="text-white font-semibold text-sm">{acc.account_name}</span>
                    {last && <span className="text-white/30 text-xs">{new Date(last.created_at).toLocaleDateString()}</span>}
                  </div>
                  <div className="text-white/40 text-xs truncate">
                    {last ? (last.sender === "admin" ? "You: " : "") + last.message : "No messages"}
                  </div>
                </div>
                {unread > 0 && (
                  <span className="w-5 h-5 bg-red-500 text-white text-xs rounded-full flex items-center justify-center font-bold flex-shrink-0" style={{ fontSize: 9 }}>
                    {unread}
                  </span>
                )}
              </button>
            );
          })
        )}
      </div>
    </div>
  );
}
