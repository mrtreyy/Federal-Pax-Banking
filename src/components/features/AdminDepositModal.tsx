import { useState } from "react";
import { X, CheckCircle, User, Building2 } from "lucide-react";
import { supabase, type Account, logAudit } from "@/lib/supabase";
import { toast } from "sonner";
import { BANK_SUGGESTIONS } from "@/lib/utils";

interface Props {
  accounts: Account[];
  selectedAccount?: Account;
  onClose: () => void;
  onSuccess: () => void;
}

export default function AdminDepositModal({ accounts, selectedAccount, onClose, onSuccess }: Props) {
  const [accountId, setAccountId] = useState(selectedAccount?.id || "");
  const [amount, setAmount] = useState("");
  const [description, setDescription] = useState("");
  const [senderName, setSenderName] = useState("");
  const [senderBank, setSenderBank] = useState("");
  const [bankSuggestions, setBankSuggestions] = useState<string[]>([]);
  const [customDate, setCustomDate] = useState(new Date().toISOString().slice(0, 16));
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);

  const chosenAccount = accounts.find((a) => a.id === accountId);

  const handleBankInput = (val: string) => {
    setSenderBank(val);
    if (val.length >= 2) {
      setBankSuggestions(BANK_SUGGESTIONS.filter(b => b.toLowerCase().includes(val.toLowerCase())).slice(0, 5));
    } else {
      setBankSuggestions([]);
    }
  };

  const handleDeposit = async () => {
    if (!accountId) { toast.error("Select an account."); return; }
    const amt = parseFloat(amount);
    if (isNaN(amt) || amt <= 0) { toast.error("Enter a valid amount."); return; }
    if (!chosenAccount) return;

    setLoading(true);

    const { error: txErr } = await supabase.from("banking_transactions").insert({
      account_id: accountId,
      type: "deposit",
      amount: amt,
      description: description.trim() || "Admin Deposit",
      recipient_name: senderName.trim() || null,
      recipient_bank: senderBank.trim() || null,
      admin_override: true,
      custom_timestamp: new Date(customDate).toISOString(),
    });

    if (txErr) { toast.error("Deposit failed."); setLoading(false); return; }

    await supabase.from("banking_accounts").update({ balance: Number(chosenAccount.balance) + amt, updated_at: new Date().toISOString() }).eq("id", accountId);

    await supabase.from("banking_notifications").insert({
      account_id: accountId,
      target: accountId,
      title: "Deposit Received",
      body: `${chosenAccount.currency} ${amt.toFixed(2)} has been deposited${senderName ? ` from ${senderName}` : ""}.`,
      is_read: false,
    });

    await logAudit("admin_deposit", accountId, chosenAccount.account_name, { amount: amt, sender: senderName, bank: senderBank, description, timestamp: customDate });

    // Check balance threshold alert
    const newBalance = Number(chosenAccount.balance) + amt;
    if (chosenAccount.balance_threshold && newBalance < Number(chosenAccount.balance_threshold)) {
      await supabase.from("banking_notifications").insert({
        account_id: accountId,
        target: accountId,
        title: "Balance Alert",
        body: `Your balance (${chosenAccount.currency} ${newBalance.toFixed(2)}) is below your set threshold.`,
        is_read: false,
      });
    }

    setLoading(false);
    setSuccess(true);
    setTimeout(() => { onSuccess(); onClose(); }, 2000);
  };

  if (success) {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center px-4">
        <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" />
        <div className="relative w-full max-w-sm rounded-3xl p-8 flex flex-col items-center text-center" style={{ background: "hsl(220,50%,12%)", border: "1px solid rgba(255,255,255,0.1)" }}>
          <div className="w-20 h-20 rounded-full flex items-center justify-center mb-4" style={{ background: "rgba(34,197,94,0.15)" }}>
            <CheckCircle size={40} color="#22c55e" />
          </div>
          <h3 className="text-white font-bold text-xl mb-2">Deposit Successful</h3>
          <p className="text-white/60 text-sm">{chosenAccount?.currency} {parseFloat(amount).toFixed(2)} deposited to {chosenAccount?.account_name}{senderName ? ` from ${senderName}` : ""}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center px-4 pb-4">
      <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" onClick={onClose} />
      <div className="relative w-full max-w-sm rounded-3xl overflow-hidden" style={{ background: "hsl(220,50%,12%)", border: "1px solid rgba(255,255,255,0.1)" }}>
        <div className="p-5 flex items-center justify-between" style={{ borderBottom: "1px solid rgba(255,255,255,0.08)" }}>
          <h3 className="text-white font-bold text-lg">Admin Deposit</h3>
          <button onClick={onClose} className="text-white/40 hover:text-white p-1"><X size={20} /></button>
        </div>
        <div className="p-5 space-y-3 max-h-[80vh] overflow-y-auto">
          <div>
            <label className="text-white/60 text-xs mb-1.5 block">Select Account *</label>
            <select className="dark-input" value={accountId} onChange={(e) => setAccountId(e.target.value)}>
              <option value="">— Choose account —</option>
              {accounts.map((a) => <option key={a.id} value={a.id}>{a.account_name} ({a.account_number})</option>)}
            </select>
          </div>
          {chosenAccount && (
            <div className="p-3 rounded-2xl text-xs" style={{ background: "rgba(34,197,94,0.08)", border: "1px solid rgba(34,197,94,0.15)" }}>
              Current balance: <span className="text-green-400 font-bold">{chosenAccount.currency} {Number(chosenAccount.balance).toFixed(2)}</span>
            </div>
          )}
          <div>
            <label className="text-white/60 text-xs mb-1.5 block">Amount *</label>
            <input type="number" className="dark-input" placeholder="0.00" value={amount} onChange={(e) => setAmount(e.target.value)} />
          </div>
          <div>
            <label className="text-white/60 text-xs mb-1.5 block flex items-center gap-1.5"><User size={12} /> Sender Name</label>
            <input type="text" className="dark-input" placeholder="Name of the sender" value={senderName} onChange={(e) => setSenderName(e.target.value)} />
          </div>
          <div className="relative">
            <label className="text-white/60 text-xs mb-1.5 block flex items-center gap-1.5"><Building2 size={12} /> Sender Bank</label>
            <input type="text" className="dark-input" placeholder="Type bank name..." value={senderBank} onChange={(e) => handleBankInput(e.target.value)} />
            {bankSuggestions.length > 0 && (
              <div className="absolute top-full left-0 right-0 z-50 rounded-2xl overflow-hidden mt-1" style={{ background: "hsl(220,55%,14%)", border: "1px solid rgba(255,255,255,0.1)" }}>
                {bankSuggestions.map((b) => (
                  <button key={b} onClick={() => { setSenderBank(b); setBankSuggestions([]); }}
                    className="w-full text-left px-4 py-2.5 text-white text-xs hover:bg-white/5 transition-colors" style={{ borderBottom: "1px solid rgba(255,255,255,0.05)" }}>
                    {b}
                  </button>
                ))}
              </div>
            )}
          </div>
          <div>
            <label className="text-white/60 text-xs mb-1.5 block">Description</label>
            <input type="text" className="dark-input" placeholder="Deposit description" value={description} onChange={(e) => setDescription(e.target.value)} />
          </div>
          <div>
            <label className="text-white/60 text-xs mb-1.5 block">Transaction Date & Time (Including Year)</label>
            <input type="datetime-local" className="dark-input" value={customDate} onChange={(e) => setCustomDate(e.target.value)} />
          </div>
          <button onClick={handleDeposit} disabled={loading} className="gold-btn w-full py-3.5 text-sm font-semibold flex items-center justify-center gap-2">
            {loading ? <div className="w-5 h-5 border-2 border-gray-900/30 border-t-gray-900 rounded-full animate-spin" /> : "Make Deposit"}
          </button>
        </div>
      </div>
    </div>
  );
}
