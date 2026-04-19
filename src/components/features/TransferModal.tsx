import { useState } from "react";
import { X, Send, CheckCircle, Building2, Eye, EyeOff, ArrowLeft } from "lucide-react";
import { supabase, type Account, logAudit } from "@/lib/supabase";
import { toast } from "sonner";
import { BANK_SUGGESTIONS, formatCurrency } from "@/lib/utils";
import type { Beneficiary } from "@/lib/supabase";

interface Props {
  account: Account;
  onClose: () => void;
  onSuccess: () => void;
  preselectedBeneficiary?: Beneficiary | null;
}

type TransferStep = "form" | "confirm" | "pin" | "success";

export default function TransferModal({ account, onClose, onSuccess, preselectedBeneficiary }: Props) {
  const [recipientName, setRecipientName] = useState(preselectedBeneficiary?.name || "");
  const [description, setDescription] = useState("");
  const [bankName, setBankName] = useState(preselectedBeneficiary?.bank_name || "");
  const [bankSuggestions, setBankSuggestions] = useState<string[]>([]);
  const [accountNumber, setAccountNumber] = useState(preselectedBeneficiary?.account_number || "");
  const [amount, setAmount] = useState("");
  const [pin, setPin] = useState("");
  const [showPin, setShowPin] = useState(false);
  const [loading, setLoading] = useState(false);
  const [step, setStep] = useState<TransferStep>("form");
  const [completedTx, setCompletedTx] = useState<string>("");

  const requiresPin = !!account.transfer_pin;

  const handleBankInput = (val: string) => {
    setBankName(val);
    if (val.length >= 2) {
      setBankSuggestions(BANK_SUGGESTIONS.filter(b => b.toLowerCase().includes(val.toLowerCase())).slice(0, 5));
    } else {
      setBankSuggestions([]);
    }
  };

  const handleProceedToConfirm = () => {
    if (!recipientName.trim() || !amount.trim() || !accountNumber.trim()) {
      toast.error("Please fill in all required fields."); return;
    }
    const amt = parseFloat(amount);
    if (isNaN(amt) || amt <= 0) { toast.error("Enter a valid amount."); return; }
    if (amt > account.balance) { toast.error("Insufficient balance."); return; }
    setStep("confirm");
  };

  const handleConfirm = () => {
    if (requiresPin) { setStep("pin"); } else { handleSend(); }
  };

  const handleSend = async () => {
    if (requiresPin && pin !== account.transfer_pin) {
      toast.error("Incorrect transfer PIN."); return;
    }
    const amt = parseFloat(amount);
    setLoading(true);

    const { error: txErr } = await supabase.from("banking_transactions").insert({
      account_id: account.id,
      type: "transfer",
      amount: amt,
      recipient_name: recipientName.trim(),
      recipient_bank: bankName.trim() || null,
      recipient_account_number: accountNumber.trim(),
      description: description.trim() || null,
      admin_override: false,
      custom_timestamp: new Date().toISOString(),
    });

    if (txErr) { toast.error("Transfer failed. Please try again."); setLoading(false); return; }

    await supabase.from("banking_accounts").update({ balance: account.balance - amt, updated_at: new Date().toISOString() }).eq("id", account.id);

    await supabase.from("banking_notifications").insert({
      account_id: account.id,
      target: "admin",
      title: `Transfer from ${account.account_name}`,
      body: `${account.account_name} sent ${account.currency} ${amt.toFixed(2)} to ${recipientName}`,
      is_read: false,
    });

    await logAudit("transfer", account.id, account.account_name, { amount: amt, recipient: recipientName.trim(), bank: bankName.trim() }, account.account_name, "individual");

    setCompletedTx(recipientName);
    setLoading(false);
    setStep("success");
    onSuccess();
  };

  const maskAccount = (num: string) => `${"•".repeat(Math.max(0, num.length - 4))}${num.slice(-4)}`;

  if (step === "success") {
    return (
      <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center px-4 pb-4">
        <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" />
        <div className="relative w-full max-w-sm rounded-3xl p-8 flex flex-col items-center text-center" style={{ background: "hsl(220,50%,12%)", border: "1px solid rgba(255,255,255,0.1)" }}>
          <div className="w-20 h-20 rounded-full flex items-center justify-center mb-4" style={{ background: "rgba(34,197,94,0.15)" }}>
            <CheckCircle size={40} color="#22c55e" />
          </div>
          <h3 className="text-white font-bold text-xl mb-2">Transfer Successful</h3>
          <p className="text-white/60 text-sm">{account.currency} {parseFloat(amount).toFixed(2)} has been sent to {completedTx}</p>
          <button onClick={onClose} className="gold-btn px-8 py-3 mt-6 text-sm font-semibold">Done</button>
        </div>
      </div>
    );
  }

  if (step === "pin") {
    return (
      <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center px-4 pb-4">
        <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" onClick={() => setStep("confirm")} />
        <div className="relative w-full max-w-sm rounded-3xl overflow-hidden" style={{ background: "hsl(220,50%,12%)", border: "1px solid rgba(255,255,255,0.1)" }}>
          <div className="p-5 flex items-center gap-3" style={{ borderBottom: "1px solid rgba(255,255,255,0.08)" }}>
            <button onClick={() => setStep("confirm")} className="text-white/40"><ArrowLeft size={18} /></button>
            <h3 className="text-white font-bold">Enter Transfer PIN</h3>
          </div>
          <div className="p-5 space-y-4">
            <div className="text-center">
              <div className="text-white/50 text-sm">Confirm your transfer of</div>
              <div className="text-white font-black text-3xl" style={{ color: "hsl(43,85%,60%)" }}>{formatCurrency(parseFloat(amount), account.currency)}</div>
              <div className="text-white/40 text-xs mt-1">to {recipientName}</div>
            </div>
            <div className="relative">
              <input type={showPin ? "text" : "password"} maxLength={4}
                className="dark-input pr-12 tracking-widest text-center text-2xl font-bold"
                placeholder="••••" value={pin} onChange={(e) => setPin(e.target.value.replace(/\D/g, "").slice(0, 4))} />
              <button type="button" className="absolute right-4 top-1/2 -translate-y-1/2 text-white/40" onClick={() => setShowPin(!showPin)}>
                {showPin ? <EyeOff size={16} /> : <Eye size={16} />}
              </button>
            </div>
            <button onClick={handleSend} disabled={loading || pin.length !== 4}
              className="gold-btn w-full py-3.5 text-sm font-semibold flex items-center justify-center gap-2"
              style={{ opacity: pin.length !== 4 ? 0.5 : 1 }}>
              {loading ? <div className="w-5 h-5 border-2 border-gray-900/30 border-t-gray-900 rounded-full animate-spin" /> : <><Send size={16} /> Complete Transfer</>}
            </button>
          </div>
        </div>
      </div>
    );
  }

  if (step === "confirm") {
    const amt = parseFloat(amount);
    return (
      <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center px-4 pb-4">
        <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" />
        <div className="relative w-full max-w-sm rounded-3xl overflow-hidden" style={{ background: "hsl(220,50%,12%)", border: "1px solid rgba(255,255,255,0.1)" }}>
          {/* Confirmation header */}
          <div className="p-5 text-center" style={{ background: "linear-gradient(135deg,hsl(220,60%,18%),hsl(220,70%,12%))", borderBottom: "1px solid rgba(255,255,255,0.08)" }}>
            <div className="text-white/40 text-xs mb-1 uppercase tracking-wide">Transfer Amount</div>
            <div className="font-black text-4xl" style={{ color: "#ef4444", letterSpacing: "-1.5px" }}>-{formatCurrency(amt, account.currency)}</div>
            <div className="text-white/50 text-sm mt-1">Review before confirming</div>
          </div>
          <div className="p-5 space-y-2">
            {[
              ["To", recipientName],
              ["Bank", bankName || "Not specified"],
              ["Account No.", maskAccount(accountNumber)],
              ["Narration", description || "No narration"],
              ["From", account.account_name],
              ["New Balance", formatCurrency(account.balance - amt, account.currency)],
            ].map(([l, v]) => (
              <div key={l} className="flex justify-between py-2" style={{ borderBottom: "1px solid rgba(255,255,255,0.06)" }}>
                <span className="text-white/40 text-xs">{l}</span>
                <span className="text-white text-xs font-semibold text-right max-w-[55%]">{v}</span>
              </div>
            ))}
            <div className="grid grid-cols-2 gap-3 pt-2">
              <button onClick={() => setStep("form")} className="py-3 rounded-2xl text-white/60 text-sm font-medium" style={{ background: "rgba(255,255,255,0.07)" }}>
                Back & Edit
              </button>
              <button onClick={handleConfirm} className="gold-btn py-3 text-sm font-semibold flex items-center justify-center gap-2">
                <Send size={14} /> Confirm
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // Form step
  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center px-4 pb-4">
      <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" onClick={onClose} />
      <div className="relative w-full max-w-sm rounded-3xl overflow-hidden" style={{ background: "hsl(220,50%,12%)", border: "1px solid rgba(255,255,255,0.1)" }}>
        <div className="p-5 flex items-center justify-between" style={{ borderBottom: "1px solid rgba(255,255,255,0.08)" }}>
          <h3 className="text-white font-bold text-lg">Send Transfer</h3>
          <button onClick={onClose} className="text-white/40 hover:text-white p-1"><X size={20} /></button>
        </div>

        <div className="p-5 space-y-3 max-h-[75vh] overflow-y-auto">
          <div>
            <label className="text-white/60 text-xs mb-1.5 block">Recipient Name *</label>
            <input type="text" className="dark-input" placeholder="Full name of recipient" value={recipientName} onChange={(e) => setRecipientName(e.target.value)} />
          </div>
          <div>
            <label className="text-white/60 text-xs mb-1.5 block">Amount ({account.currency}) *</label>
            <input type="number" className="dark-input" placeholder={`Amount in ${account.currency}`} value={amount} onChange={(e) => setAmount(e.target.value)} />
            <div className="text-white/25 text-xs mt-1">Available: {formatCurrency(account.balance, account.currency)}</div>
          </div>
          <div className="relative">
            <label className="text-white/60 text-xs mb-1.5 flex items-center gap-1.5 block"><Building2 size={12} /> Bank Name</label>
            <input type="text" className="dark-input" placeholder="Type bank name..." value={bankName} onChange={(e) => handleBankInput(e.target.value)} />
            {bankSuggestions.length > 0 && (
              <div className="absolute top-full left-0 right-0 z-50 rounded-2xl overflow-hidden mt-1 shadow-2xl" style={{ background: "hsl(220,55%,14%)", border: "1px solid rgba(255,255,255,0.1)" }}>
                {bankSuggestions.map((b) => (
                  <button key={b} onClick={() => { setBankName(b); setBankSuggestions([]); }}
                    className="w-full text-left px-4 py-2.5 text-white text-xs hover:bg-white/5" style={{ borderBottom: "1px solid rgba(255,255,255,0.05)" }}>
                    {b}
                  </button>
                ))}
              </div>
            )}
          </div>
          <div>
            <label className="text-white/60 text-xs mb-1.5 block">Account Number *</label>
            <input type="text" className="dark-input" placeholder="Recipient account number" value={accountNumber} onChange={(e) => setAccountNumber(e.target.value)} />
          </div>
          <div>
            <label className="text-white/60 text-xs mb-1.5 block">Transfer Narration</label>
            <input type="text" className="dark-input" placeholder="Purpose of transfer" value={description} onChange={(e) => setDescription(e.target.value)} />
          </div>

          <div className="pt-1">
            <button onClick={handleProceedToConfirm}
              className="gold-btn w-full py-3.5 text-sm font-semibold flex items-center justify-center gap-2 min-h-[52px]">
              <Send size={16} /> Review Transfer
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
