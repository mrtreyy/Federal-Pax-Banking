import { useState, useEffect, useRef } from "react";
import { X, Send, MessageCircle, Phone, Paperclip, Image } from "lucide-react";
import { supabase, trackFeatureUse } from "@/lib/supabase";
import type { Account } from "@/lib/supabase";
import { usePolling } from "@/hooks/usePolling";

interface Props {
  account: Account;
  onClose: () => void;
  initialMessage?: string;
}

type ChatMessage = {
  id: string;
  text: string;
  sender: "user" | "bot";
  timestamp: Date;
  fileUrl?: string;
  fileName?: string;
};

// Professional GHOB responses - extensive bank context
const GHOB_CONTEXTS = {
  greeting: [
    "Good day! Welcome to the Global Health Online Banking secure support line. How may I assist you today?",
    "Hello! Thank you for reaching out to GHOB Customer Support. I'm here to help. What can I do for you?",
    "Good day, how may we be of service to you today? Our support team is available to assist with all banking needs.",
    "Welcome to Global Health Online Banking support. Please describe your concern and we will attend to it promptly.",
  ],
  transfer: [
    "I understand you have an inquiry regarding a transfer. Please provide the Transaction Reference ID (TRN) so our team can investigate immediately. Transfers are typically processed within 24 business hours.",
    "For transfer-related issues, kindly share your Transaction ID starting with TXN- and the beneficiary account number. Our resolution team will escalate this within one business day.",
    "Thank you for reporting this transfer concern. GHOB processes all inter-bank transfers through secure banking channels. Please note that delays may occur due to beneficiary bank processing times. Share your TXN reference for a direct investigation.",
  ],
  balance: [
    "Your account balance is refreshed in real-time on your dashboard. If you notice a discrepancy, please allow up to 24 hours for pending transactions to reflect. You may also contact administration for a manual ledger review.",
    "Balance inquiries are best handled through your dashboard's balance section. If a transaction has not reflected within 2 business days, please raise a formal dispute through the 'Disputes' section for immediate investigation.",
    "GHOB ensures all balance updates are posted in real-time. For any unreconciled amounts, please provide the transaction reference and our reconciliation team will attend to it within 48 hours.",
  ],
  card: [
    "For virtual card inquiries, your card management section provides full controls including freezing, viewing limits, and checking transaction history. If your card has been compromised, freeze it immediately and contact administration.",
    "GHOB Virtual Visa Cards are secured by industry-standard encryption. For card-related concerns — lost card, unauthorised transaction, limit adjustments — please provide your card's last 4 digits and we will assist promptly.",
    "Your GHOB Virtual Card is managed directly from your dashboard. Limits, freeze status, and transaction history are available there. For limit increases, contact administration with your account verification.",
  ],
  security: [
    "GHOB takes your account security extremely seriously. If you suspect unauthorised access, please freeze your account immediately through Settings and contact our security team. We will conduct an immediate account audit.",
    "For security concerns, we recommend: (1) Reset your transfer PIN, (2) Enable app security lock, (3) Report to administration via this chat. Our security team responds to all alerts within 2 hours.",
    "Thank you for raising this security concern. GHOB employs multi-layer security protocols including transaction monitoring and device fingerprinting. Our security team has been alerted and will review your account activity.",
  ],
  loan: [
    "Thank you for your interest in GHOB credit services. Your loan application will be reviewed by our credit assessment team within 2–3 business days. Loan amounts and terms are subject to account tier and transaction history.",
    "GHOB offers flexible credit facilities to qualifying account holders. Applications are reviewed based on account standing, transaction history, and tier classification. You will be notified of the decision directly to your notification centre.",
    "For loan inquiries: applications submitted through your dashboard are processed in order of receipt. Tier 3 and above accounts receive priority processing. Approval decisions are typically communicated within 48–72 hours.",
  ],
  statement: [
    "Account statements can be generated for any calendar month through your Transaction History section. Monthly statements in CSV format are available for immediate download. For certified statements, please contact administration.",
    "GHOB provides full account statements through the 'Statement' option in your transaction history. For official bank letters or certified statements for visa or mortgage purposes, please submit a request to administration.",
  ],
  tier: [
    "Account tier upgrades are processed after verification of submitted identification documents. Standard processing takes 3–5 business days. Tier 2 and above accounts gain access to enhanced features including higher transfer limits.",
    "GHOB's tiered account system provides progressively enhanced banking features. To upgrade your tier, submit a request with valid government-issued ID through your dashboard. Our compliance team reviews all requests personally.",
  ],
  acknowledged: [
    "Thank you for the information provided. Your concern has been escalated to our resolution team. You will receive an update within 2–3 business days through your notification centre.",
    "We have received your details and logged this concern with reference to your account. Our administration team will review and respond within 24–48 business hours.",
    "Your report has been formally logged. GHOB's standard resolution timeframe is 2–3 working days. Should this be urgent, please use the 'Contact Administration' option below to reach our team directly.",
  ],
  default: [
    "Thank you for contacting Global Health Online Banking support. Your concern has been noted and will be reviewed by our customer care team within 24–48 business hours. We apologise for any inconvenience.",
    "We appreciate your patience. Your inquiry has been forwarded to the appropriate department. A representative will follow up through your notification centre or this chat within 2 business days.",
    "Thank you for reaching out to GHOB. Our support team is currently reviewing your concern. For urgent matters, please use the direct administration contact below. We value your continued trust in us.",
    "Your message has been received. Global Health Online Banking is committed to resolving all customer concerns within our standard SLA of 48 business hours. Please keep your Transaction ID handy for reference.",
  ],
};

function getBotResponse(msg: string, name: string): string {
  const m = msg.toLowerCase();
  let pool = GHOB_CONTEXTS.default;

  if (m.match(/\b(hi|hello|good (day|morning|afternoon|evening)|hey|greetings)\b/)) {
    return `Good day, ${name}! Welcome to the Global Health Online Banking secure support line. How may I assist you today?`;
  }
  if (m.match(/\b(transfer|send|sent|wire|payment|not received|not arrived|failed transfer)\b/)) {
    pool = GHOB_CONTEXTS.transfer;
  } else if (m.match(/\b(balance|amount|funds|money|credit|debit|ledger)\b/)) {
    pool = GHOB_CONTEXTS.balance;
  } else if (m.match(/\b(card|virtual card|visa|cvv|freeze card|card limit|lost card)\b/)) {
    pool = GHOB_CONTEXTS.card;
  } else if (m.match(/\b(security|hack|unauthorised|suspicious|scam|fraud|phishing)\b/)) {
    pool = GHOB_CONTEXTS.security;
  } else if (m.match(/\b(loan|credit|borrow|financing|facility)\b/)) {
    pool = GHOB_CONTEXTS.loan;
  } else if (m.match(/\b(statement|report|history|csv|pdf|document)\b/)) {
    pool = GHOB_CONTEXTS.statement;
  } else if (m.match(/\b(tier|upgrade|level|premium|elite)\b/)) {
    pool = GHOB_CONTEXTS.tier;
  } else if (m.match(/\b(thank|thanks|ok|okay|noted|done|attached|sent|uploaded)\b/)) {
    pool = GHOB_CONTEXTS.acknowledged;
  }

  return pool[Math.floor(Math.random() * pool.length)];
}

export default function GHOBChatSupport({ account, onClose, initialMessage }: Props) {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState(initialMessage || "");
  const [isTyping, setIsTyping] = useState(false);
  const [uploading, setUploading] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    trackFeatureUse(account.account_name, account.id, "chat_support");
    const greeting: ChatMessage = {
      id: "greeting",
      text: `Good day, ${account.account_name}. Welcome to the Global Health Online Banking secure customer support channel. I am your virtual banking assistant. How may I be of service to you today?`,
      sender: "bot",
      timestamp: new Date(),
    };
    setMessages([greeting]);
  }, [account.account_name, account.id]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, isTyping]);

  const sendMessage = (text?: string) => {
    const msgText = text || input.trim();
    if (!msgText) return;

    const userMsg: ChatMessage = {
      id: Date.now().toString(),
      text: msgText,
      sender: "user",
      timestamp: new Date(),
    };
    setMessages(prev => [...prev, userMsg]);
    setInput("");
    setIsTyping(true);

    supabase.from("banking_messages").insert({
      account_id: account.id,
      sender: "user",
      message: msgText,
      message_type: "support",
      is_read: false,
      is_seen: false,
    }).then(() => {
      supabase.from("banking_notifications").insert({
        account_id: account.id,
        target: "admin",
        title: `Chat Support — ${account.account_name}`,
        body: msgText.slice(0, 120),
        is_read: false,
      });
      supabase.from("banking_notifications").insert({
        account_id: account.id,
        target: "cas",
        title: `Chat Support — ${account.account_name}`,
        body: msgText.slice(0, 120),
        is_read: false,
      });
    });

    const delay = 1400 + Math.random() * 1000;
    setTimeout(() => {
      const botText = getBotResponse(msgText, account.account_name);
      const botMsg: ChatMessage = {
        id: (Date.now() + 1).toString(),
        text: botText,
        sender: "bot",
        timestamp: new Date(),
      };
      setIsTyping(false);
      setMessages(prev => [...prev, botMsg]);

      supabase.from("banking_messages").insert({
        account_id: account.id,
        sender: "ghob",
        message: botText,
        message_type: "support",
        is_read: true,
        is_seen: true,
      });
    }, delay);
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    const path = `chat-${account.id}-${Date.now()}.${file.name.split(".").pop()}`;
    const { data, error } = await supabase.storage.from("profiles").upload(path, file, { upsert: true });
    if (!error && data) {
      const { data: url } = supabase.storage.from("profiles").getPublicUrl(data.path);
      const fileMsg: ChatMessage = {
        id: Date.now().toString(),
        text: `Attached: ${file.name}`,
        sender: "user",
        timestamp: new Date(),
        fileUrl: url.publicUrl,
        fileName: file.name,
      };
      setMessages(prev => [...prev, fileMsg]);
      await supabase.from("banking_messages").insert({
        account_id: account.id,
        sender: "user",
        message: `[File attached: ${file.name}] ${url.publicUrl}`,
        message_type: "support",
        is_read: false,
        is_seen: false,
      });
      setTimeout(() => {
        const ack: ChatMessage = {
          id: (Date.now() + 1).toString(),
          text: "Thank you for the attachment. Our team has received the file and it has been added to your case. A representative will review this shortly.",
          sender: "bot",
          timestamp: new Date(),
        };
        setMessages(prev => [...prev, ack]);
      }, 1200);
    }
    setUploading(false);
    if (fileRef.current) fileRef.current.value = "";
  };

  const QUICK_REPLIES = [
    "My transfer hasn't arrived",
    "I want to check my balance",
    "Help with my virtual card",
    "I want to report a transaction",
  ];

  return (
    <div className="fixed inset-0 z-50 flex flex-col" style={{ background: "hsl(220,45%,8%)" }}>
      {/* Header */}
      <div className="flex items-center justify-between px-5 py-4 flex-shrink-0" style={{ background: "hsl(220,55%,13%)", borderBottom: "1px solid rgba(255,255,255,0.08)" }}>
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-2xl flex items-center justify-center relative" style={{ background: "linear-gradient(135deg, hsl(43,85%,55%), hsl(38,80%,42%))" }}>
            <MessageCircle size={18} className="text-gray-900" />
            <div className="absolute -bottom-0.5 -right-0.5 w-3 h-3 rounded-full bg-green-400 border-2" style={{ borderColor: "hsl(220,55%,13%)" }} />
          </div>
          <div>
            <div className="text-white font-bold text-sm">GHOB Customer Support</div>
            <div className="text-white/40 text-xs">● Online — Secure Banking Channel</div>
          </div>
        </div>
        <button onClick={onClose} className="text-white/40 hover:text-white p-1"><X size={20} /></button>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto p-4 space-y-3">
        {/* Quick replies - shown when only greeting */}
        {messages.length === 1 && (
          <div className="flex flex-wrap gap-2 mt-2">
            {QUICK_REPLIES.map(qr => (
              <button key={qr} onClick={() => sendMessage(qr)}
                className="text-xs px-3 py-2 rounded-2xl text-left"
                style={{ background: "rgba(200,155,50,0.1)", border: "1px solid rgba(200,155,50,0.25)", color: "hsl(43,85%,60%)" }}>
                {qr}
              </button>
            ))}
          </div>
        )}

        {messages.map(msg => (
          <div key={msg.id} className={`flex ${msg.sender === "user" ? "justify-end" : "justify-start"}`}>
            {msg.sender === "bot" && (
              <div className="w-8 h-8 rounded-2xl flex items-center justify-center flex-shrink-0 mr-2 mt-1" style={{ background: "linear-gradient(135deg, hsl(43,85%,55%), hsl(38,80%,42%))" }}>
                <MessageCircle size={13} className="text-gray-900" />
              </div>
            )}
            <div className="max-w-[78%]">
              <div className="px-4 py-3 rounded-2xl text-sm leading-relaxed"
                style={msg.sender === "user"
                  ? { background: "linear-gradient(135deg, hsl(43,85%,55%), hsl(38,80%,42%))", color: "#1a1a1a", borderBottomRightRadius: 6 }
                  : { background: "hsl(220,45%,16%)", color: "rgba(255,255,255,0.87)", border: "1px solid rgba(255,255,255,0.08)", borderBottomLeftRadius: 6 }}>
                {msg.fileUrl ? (
                  <a href={msg.fileUrl} target="_blank" rel="noopener noreferrer" className="underline text-xs">📎 {msg.fileName}</a>
                ) : msg.text}
              </div>
              <div className={`text-xs mt-0.5 ${msg.sender === "user" ? "text-right" : ""}`} style={{ color: "rgba(255,255,255,0.2)", fontSize: 10 }}>
                {msg.timestamp.toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit" })}
              </div>
            </div>
          </div>
        ))}

        {isTyping && (
          <div className="flex justify-start">
            <div className="w-8 h-8 rounded-2xl flex items-center justify-center flex-shrink-0 mr-2 mt-1" style={{ background: "linear-gradient(135deg, hsl(43,85%,55%), hsl(38,80%,42%))" }}>
              <MessageCircle size={13} className="text-gray-900" />
            </div>
            <div className="px-4 py-3 rounded-2xl flex items-center gap-1.5" style={{ background: "hsl(220,45%,16%)", border: "1px solid rgba(255,255,255,0.08)" }}>
              {[0, 1, 2].map(i => (
                <div key={i} className="w-2 h-2 rounded-full bg-white/40 animate-bounce" style={{ animationDelay: `${i * 150}ms` }} />
              ))}
            </div>
          </div>
        )}
        <div ref={bottomRef} />
      </div>

      {/* Disclaimer */}
      <div className="px-4 py-1.5 flex-shrink-0 text-center">
        <p className="text-white/20" style={{ fontSize: 10 }}>🔒 This is a secure GHOB banking channel. All conversations are encrypted and logged.</p>
      </div>

      {/* Input */}
      <div className="flex items-center gap-2 px-4 py-3 flex-shrink-0" style={{ background: "hsl(220,55%,13%)", borderTop: "1px solid rgba(255,255,255,0.08)" }}>
        <input type="file" ref={fileRef} className="hidden" accept="image/*,.pdf,.doc,.docx" onChange={handleFileUpload} />
        <button onClick={() => fileRef.current?.click()} disabled={uploading}
          className="w-10 h-10 rounded-2xl flex items-center justify-center flex-shrink-0 transition-colors"
          style={{ background: "rgba(255,255,255,0.07)" }}>
          {uploading ? (
            <div className="w-4 h-4 border-2 border-yellow-500/30 border-t-yellow-500 rounded-full animate-spin" />
          ) : (
            <Paperclip size={16} style={{ color: "rgba(255,255,255,0.4)" }} />
          )}
        </button>
        <input
          type="text"
          className="dark-input flex-1 py-2.5 text-sm"
          placeholder="Type a message..."
          value={input}
          onChange={e => setInput(e.target.value)}
          onKeyDown={e => e.key === "Enter" && sendMessage()}
        />
        <button onClick={() => sendMessage()} disabled={!input.trim()}
          className="w-10 h-10 rounded-2xl flex items-center justify-center flex-shrink-0 transition-all"
          style={{ background: input.trim() ? "linear-gradient(135deg, hsl(43,85%,55%), hsl(38,80%,42%))" : "rgba(255,255,255,0.07)" }}>
          <Send size={16} style={{ color: input.trim() ? "#1a1a1a" : "rgba(255,255,255,0.3)" }} />
        </button>
      </div>
    </div>
  );
}
