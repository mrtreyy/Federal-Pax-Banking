import { useState } from "react";
import { X, Save, Building2 } from "lucide-react";
import { supabase, type Transaction, logAudit } from "@/lib/supabase";
import { toast } from "sonner";
import { BANK_SUGGESTIONS } from "@/lib/utils";

interface Props {
  tx: Transaction;
  onClose: () => void;
  onSuccess: () => void;
}

export default function EditTransactionModal({ tx, onClose, onSuccess }: Props) {
  // Parse existing date
  const existing = new Date(tx.custom_timestamp);
  const padded = (n: number) => String(n).padStart(2, "0");
  const defaultDT = `${existing.getFullYear()}-${padded(existing.getMonth()+1)}-${padded(existing.getDate())}T${padded(existing.getHours())}:${padded(existing.getMinutes())}`;

  const [customDate, setCustomDate] = useState(defaultDT);
  const [description, setDescription] = useState(tx.description || "");
  const [recipientName, setRecipientName] = useState(tx.recipient_name || "");
  const [recipientBank, setRecipientBank] = useState(tx.recipient_bank || "");
  const [bankSuggestions, setBankSuggestions] = useState<string[]>([]);
  const [recipientAcctNum, setRecipientAcctNum] = useState(tx.recipient_account_number || "");
  const [amount, setAmount] = useState(String(tx.amount));
  const [loading, setLoading] = useState(false);

  const handleBankInput = (val: string) => {
    setRecipientBank(val);
    if (val.length >= 2) {
      setBankSuggestions(BANK_SUGGESTIONS.filter(b => b.toLowerCase().includes(val.toLowerCase())).slice(0, 5));
    } else {
      setBankSuggestions([]);
    }
  };

  const handleSave = async () => {
    setLoading(true);
    const { error } = await supabase.from("banking_transactions").update({
      custom_timestamp: new Date(customDate).toISOString(),
      description: description.trim() || null,
      recipient_name: recipientName.trim() || null,
      recipient_bank: recipientBank.trim() || null,
      recipient_account_number: recipientAcctNum.trim() || null,
      amount: parseFloat(amount) || tx.amount,
    }).eq("id", tx.id);

    if (error) {
      toast.error("Failed to update transaction.");
    } else {
      await logAudit("edit_transaction", tx.account_id, undefined, { tx_id: tx.transaction_id, new_date: customDate });
      toast.success("Transaction updated.");
      onSuccess();
      onClose();
    }
    setLoading(false);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center px-4 pb-4">
      <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" onClick={onClose} />
      <div className="relative w-full max-w-sm rounded-3xl overflow-hidden" style={{ background: "hsl(220,50%,12%)", border: "1px solid rgba(255,255,255,0.1)" }}>
        <div className="p-5 flex items-center justify-between" style={{ borderBottom: "1px solid rgba(255,255,255,0.08)" }}>
          <h3 className="text-white font-bold text-lg">Edit Transaction</h3>
          <button onClick={onClose} className="text-white/40 hover:text-white p-1"><X size={20} /></button>
        </div>
        <div className="p-5 space-y-3 max-h-[80vh] overflow-y-auto">
          <div className="flex justify-between items-center p-3 rounded-xl" style={{ background: "rgba(255,255,255,0.04)" }}>
            <span className="text-white/40 text-xs">Transaction ID</span>
            <span className="text-white font-mono text-xs">{tx.transaction_id}</span>
          </div>
          <div>
            <label className="text-white/60 text-xs mb-1.5 block">Date & Time (Year / Month / Day / Hour / Min)</label>
            <input type="datetime-local" className="dark-input" value={customDate} onChange={(e) => setCustomDate(e.target.value)} />
          </div>
          <div>
            <label className="text-white/60 text-xs mb-1.5 block">Amount</label>
            <input type="number" className="dark-input" value={amount} onChange={(e) => setAmount(e.target.value)} />
          </div>
          <div>
            <label className="text-white/60 text-xs mb-1.5 block">Recipient / Sender Name</label>
            <input type="text" className="dark-input" placeholder="Name" value={recipientName} onChange={(e) => setRecipientName(e.target.value)} />
          </div>
          <div className="relative">
            <label className="text-white/60 text-xs mb-1.5 block flex items-center gap-1.5"><Building2 size={12} /> Bank Name</label>
            <input type="text" className="dark-input" placeholder="Type bank name..." value={recipientBank} onChange={(e) => handleBankInput(e.target.value)} />
            {bankSuggestions.length > 0 && (
              <div className="absolute top-full left-0 right-0 z-50 rounded-2xl overflow-hidden mt-1" style={{ background: "hsl(220,55%,14%)", border: "1px solid rgba(255,255,255,0.1)" }}>
                {bankSuggestions.map((b) => (
                  <button key={b} onClick={() => { setRecipientBank(b); setBankSuggestions([]); }}
                    className="w-full text-left px-4 py-2.5 text-white text-xs hover:bg-white/5" style={{ borderBottom: "1px solid rgba(255,255,255,0.05)" }}>
                    {b}
                  </button>
                ))}
              </div>
            )}
          </div>
          <div>
            <label className="text-white/60 text-xs mb-1.5 block">Account Number</label>
            <input type="text" className="dark-input" placeholder="Account number" value={recipientAcctNum} onChange={(e) => setRecipientAcctNum(e.target.value)} />
          </div>
          <div>
            <label className="text-white/60 text-xs mb-1.5 block">Description</label>
            <input type="text" className="dark-input" placeholder="Transaction description" value={description} onChange={(e) => setDescription(e.target.value)} />
          </div>
          <button onClick={handleSave} disabled={loading} className="gold-btn w-full py-3.5 text-sm font-semibold flex items-center justify-center gap-2">
            {loading ? <div className="w-5 h-5 border-2 border-gray-900/30 border-t-gray-900 rounded-full animate-spin" /> : <><Save size={16} /> Save Changes</>}
          </button>
        </div>
      </div>
    </div>
  );
}
