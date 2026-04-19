import { useState } from "react";
import { X, Calendar, CheckCircle } from "lucide-react";
import { supabase, type Account, logAudit } from "@/lib/supabase";
import { toast } from "sonner";

interface Props {
  accounts: Account[];
  onClose: () => void;
  onSuccess: () => void;
}

const BANK_LIST = [
  "Bank of America","Chase","Wells Fargo","Citibank","Capital One","TD Bank","US Bank",
  "PNC Bank","HSBC","Barclays","Deutsche Bank","BNP Paribas","Standard Chartered","First Bank",
  "GTBank","Zenith Bank","Access Bank","UBA","Fidelity Bank","Stanbic IBTC","Heritage Bank",
  "GCB Bank","Ecobank","Standard Bank","FNB","Absa Bank","Nedbank","Capitec Bank","KCB Bank",
  "Equity Bank","Co-operative Bank","National Bank","Emirates NBD","FAB","ADCB","QNB","Riyad Bank",
];

export default function CASScheduledTxModal({ accounts, onClose, onSuccess }: Props) {
  const [accountSearch, setAccountSearch] = useState("");
  const [selectedAccount, setSelectedAccount] = useState<Account | null>(null);
  const [type, setType] = useState<"deposit" | "transfer">("deposit");
  const [amount, setAmount] = useState("");
  const [senderName, setSenderName] = useState("");
  const [recipientName, setRecipientName] = useState("");
  const [recipientBank, setRecipientBank] = useState("");
  const [bankSearch, setBankSearch] = useState("");
  const [description, setDescription] = useState("");
  const [scheduledDate, setScheduledDate] = useState(new Date().toISOString().slice(0, 10));
  const [scheduledTime, setScheduledTime] = useState("12:00");
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);

  const filteredAccounts = accounts.filter(a =>
    a.account_name.toLowerCase().includes(accountSearch.toLowerCase())
  ).slice(0, 8);

  const filteredBanks = BANK_LIST.filter(b => b.toLowerCase().includes(bankSearch.toLowerCase())).slice(0, 6);

  const handleSchedule = async () => {
    if (!selectedAccount) { toast.error("Select an account."); return; }
    if (!amount || parseFloat(amount) <= 0) { toast.error("Enter a valid amount."); return; }

    setLoading(true);
    const scheduledAt = new Date(`${scheduledDate}T${scheduledTime}`).toISOString();

    const { error } = await supabase.from("scheduled_transactions").insert({
      account_id: selectedAccount.id,
      type,
      amount: parseFloat(amount),
      recipient_name: recipientName || null,
      recipient_bank: recipientBank || null,
      sender_name: senderName || null,
      description: description || null,
      scheduled_at: scheduledAt,
      processed: false,
    });

    if (error) {
      toast.error(error.message || "Failed to schedule transaction.");
      setLoading(false);
      return;
    }

    await logAudit(
      "ceo_schedule_transaction",
      selectedAccount.id,
      selectedAccount.account_name,
      { type, amount: parseFloat(amount), scheduled_at: scheduledAt },
      "CEO",
      "cas"
    );

    setLoading(false);
    setSuccess(true);
    setTimeout(() => { onSuccess(); onClose(); }, 2000);
  };

  if (success) {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center px-4">
        <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" />
        <div className="relative w-full max-w-sm rounded-3xl p-8 flex flex-col items-center text-center" style={{ background: "hsl(220,50%,12%)", border: "1px solid rgba(255,255,255,0.1)" }}>
          <div className="w-16 h-16 rounded-full flex items-center justify-center mb-4" style={{ background: "rgba(34,197,94,0.15)" }}>
            <CheckCircle size={36} color="#22c55e" />
          </div>
          <h3 className="text-white font-bold text-lg mb-2">Transaction Scheduled!</h3>
          <p className="text-white/60 text-sm">
            {type === "deposit" ? "Deposit" : "Transfer"} of {amount} {selectedAccount?.currency} to <strong className="text-white">{selectedAccount?.account_name}</strong> scheduled.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 z-50 flex flex-col" style={{ background: "hsl(220,45%,8%)" }}>
      <div className="flex items-center justify-between px-5 py-4 flex-shrink-0" style={{ background: "hsl(220,55%,13%)", borderBottom: "1px solid rgba(255,255,255,0.08)" }}>
        <div>
          <h3 className="text-white font-bold text-lg">Schedule Transaction</h3>
          <div className="text-white/40 text-xs">CEO · Future Date Deposit or Transfer</div>
        </div>
        <button onClick={onClose} className="text-white/40 hover:text-white"><X size={20} /></button>
      </div>

      <div className="flex-1 overflow-y-auto p-5 space-y-4">
        {/* Account selection */}
        <div>
          <label className="text-white/60 text-xs mb-1.5 block">Select Account *</label>
          <input className="dark-input mb-2" placeholder="Search account name..." value={accountSearch} onChange={e => setAccountSearch(e.target.value)} />
          {accountSearch && (
            <div className="rounded-2xl overflow-hidden" style={{ border: "1px solid rgba(255,255,255,0.08)" }}>
              {filteredAccounts.map(acc => (
                <button key={acc.id} onClick={() => { setSelectedAccount(acc); setAccountSearch(""); }}
                  className="w-full flex items-center gap-3 px-4 py-2.5 text-left hover:bg-white/5 transition-colors"
                  style={{ borderBottom: "1px solid rgba(255,255,255,0.04)", background: "hsl(220,50%,14%)" }}>
                  <div className="w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold" style={{ background: "hsl(220,50%,22%)", color: "hsl(43,85%,60%)" }}>
                    {acc.account_name.slice(0, 2).toUpperCase()}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="text-white text-sm">{acc.account_name}</div>
                    <div className="text-white/30 text-xs">{acc.account_number} · {acc.currency}</div>
                  </div>
                </button>
              ))}
              {filteredAccounts.length === 0 && <div className="px-4 py-3 text-white/30 text-sm">No accounts found</div>}
            </div>
          )}
          {selectedAccount && (
            <div className="flex items-center gap-3 p-3 rounded-2xl" style={{ background: "rgba(200,155,50,0.08)", border: "1px solid rgba(200,155,50,0.2)" }}>
              <div className="w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold" style={{ background: "hsl(43,85%,55%)", color: "#111" }}>
                {selectedAccount.account_name.slice(0, 2).toUpperCase()}
              </div>
              <div className="flex-1">
                <div className="text-white font-semibold text-sm">{selectedAccount.account_name}</div>
                <div className="text-white/40 text-xs">{selectedAccount.account_number} · {selectedAccount.currency}</div>
              </div>
              <button onClick={() => setSelectedAccount(null)} className="text-white/40 hover:text-white/60">✕</button>
            </div>
          )}
        </div>

        {/* Type */}
        <div>
          <label className="text-white/60 text-xs mb-1.5 block">Transaction Type</label>
          <div className="grid grid-cols-2 gap-2">
            {(["deposit", "transfer"] as const).map(t => (
              <button key={t} onClick={() => setType(t)}
                className="py-2.5 rounded-2xl text-sm font-medium capitalize"
                style={type === t ? { background: "hsl(43,85%,55%)", color: "#111" } : { background: "rgba(255,255,255,0.07)", color: "rgba(255,255,255,0.6)" }}>
                {t}
              </button>
            ))}
          </div>
        </div>

        {/* Amount */}
        <div>
          <label className="text-white/60 text-xs mb-1.5 block">Amount ({selectedAccount?.currency || "USD"}) *</label>
          <input type="number" className="dark-input text-lg font-bold" placeholder="0.00" value={amount} onChange={e => setAmount(e.target.value)} />
        </div>

        {type === "deposit" && (
          <div>
            <label className="text-white/60 text-xs mb-1.5 block">Sender Name</label>
            <input className="dark-input" placeholder="Name of sender" value={senderName} onChange={e => setSenderName(e.target.value)} />
          </div>
        )}

        {type === "transfer" && (
          <>
            <div>
              <label className="text-white/60 text-xs mb-1.5 block">Recipient Name</label>
              <input className="dark-input" placeholder="Recipient full name" value={recipientName} onChange={e => setRecipientName(e.target.value)} />
            </div>
            <div>
              <label className="text-white/60 text-xs mb-1.5 block">Bank Name</label>
              <input className="dark-input mb-1" placeholder="Search or type bank name" value={bankSearch || recipientBank} onChange={e => { setBankSearch(e.target.value); setRecipientBank(e.target.value); }} />
              {bankSearch && bankSearch !== recipientBank && (
                <div className="rounded-2xl overflow-hidden" style={{ border: "1px solid rgba(255,255,255,0.08)" }}>
                  {filteredBanks.map(b => (
                    <button key={b} onClick={() => { setRecipientBank(b); setBankSearch(""); }}
                      className="w-full text-left px-4 py-2 text-sm text-white/70 hover:bg-white/5"
                      style={{ borderBottom: "1px solid rgba(255,255,255,0.04)", background: "hsl(220,50%,14%)" }}>
                      {b}
                    </button>
                  ))}
                </div>
              )}
            </div>
          </>
        )}

        <div>
          <label className="text-white/60 text-xs mb-1.5 block">Description</label>
          <input className="dark-input" placeholder="Optional note" value={description} onChange={e => setDescription(e.target.value)} />
        </div>

        {/* Schedule date/time */}
        <div className="p-4 rounded-2xl space-y-3" style={{ background: "rgba(200,155,50,0.06)", border: "1px solid rgba(200,155,50,0.12)" }}>
          <div className="flex items-center gap-2 mb-1">
            <Calendar size={14} style={{ color: "hsl(43,85%,60%)" }} />
            <span className="text-white/60 text-xs font-semibold uppercase tracking-wide">Schedule Date & Time</span>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-white/40 text-xs mb-1 block">Date</label>
              <input type="date" className="dark-input py-2 text-sm" value={scheduledDate} onChange={e => setScheduledDate(e.target.value)} />
            </div>
            <div>
              <label className="text-white/40 text-xs mb-1 block">Time</label>
              <input type="time" className="dark-input py-2 text-sm" value={scheduledTime} onChange={e => setScheduledTime(e.target.value)} />
            </div>
          </div>
        </div>
      </div>

      <div className="px-5 py-4 flex-shrink-0" style={{ borderTop: "1px solid rgba(255,255,255,0.08)" }}>
        <button onClick={handleSchedule} disabled={loading} className="gold-btn w-full py-3.5 text-sm font-semibold flex items-center justify-center gap-2">
          {loading ? <div className="w-5 h-5 border-2 border-gray-900/30 border-t-gray-900 rounded-full animate-spin" /> : <><Calendar size={14} /> Schedule Transaction</>}
        </button>
      </div>
    </div>
  );
}
