import { useState, useEffect } from "react";
import { ArrowLeft, Zap, Plus, X, CheckCircle, Eye } from "lucide-react";
import { supabase, type Account, trackFeatureUse, logAudit } from "@/lib/supabase";
import { formatCurrency, formatDateTime } from "@/lib/utils";
import { usePolling } from "@/hooks/usePolling";
import { toast } from "sonner";

interface Props {
  account: Account;
  onBack: () => void;
}

interface BillPayment {
  id: string;
  account_id: string;
  biller_name: string;
  biller_category: string;
  customer_id: string;
  amount: number;
  status: string;
  created_at: string;
}

const BILLER_CATEGORIES = ["Utilities", "Telecom", "Cable/Internet", "Insurance", "Education", "Rent", "Government", "Other"];
const CATEGORY_ICONS: Record<string, string> = {
  Utilities: "⚡", Telecom: "📱", "Cable/Internet": "🌐", Insurance: "🛡️", Education: "🎓", Rent: "🏠", Government: "🏛️", Other: "💳"
};

export default function BillPaymentPage({ account, onBack }: Props) {
  const [payments, setPayments] = useState<BillPayment[]>([]);
  const [loading, setLoading] = useState(true);
  const [showPayForm, setShowPayForm] = useState(false);
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);

  // Payment form
  const [billerName, setBillerName] = useState("");
  const [customerId, setCustomerId] = useState("");
  const [amount, setAmount] = useState("");
  const [pin, setPin] = useState("");
  const [step, setStep] = useState<"form" | "confirm" | "pin" | "success">("form");
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    trackFeatureUse(account.account_name, account.id, "bill_payment");
    fetchPayments();
  }, [account.id]);

  const fetchPayments = async () => {
    const { data } = await supabase.from("bill_payments").select("*").eq("account_id", account.id).order("created_at", { ascending: false });
    if (data) setPayments(data as BillPayment[]);
    setLoading(false);
  };

  usePolling(fetchPayments, 8000, step === "form" && !showPayForm);

  const handleProceedToConfirm = () => {
    if (!billerName.trim() || !customerId.trim() || !amount) { toast.error("Please fill all required fields."); return; }
    const amt = parseFloat(amount);
    if (isNaN(amt) || amt <= 0) { toast.error("Enter a valid amount."); return; }
    if (amt > account.balance) { toast.error("Insufficient balance."); return; }
    setStep("confirm");
  };

  const handleProceedToPin = () => {
    if (account.transfer_pin) { setStep("pin"); } else { handleSubmitPayment(); }
  };

  const handleSubmitPayment = async () => {
    if (account.transfer_pin && pin !== account.transfer_pin) { toast.error("Incorrect PIN."); return; }
    const amt = parseFloat(amount);
    setSubmitting(true);

    await supabase.from("bill_payments").insert({
      account_id: account.id,
      biller_name: billerName.trim(),
      biller_category: selectedCategory || "Other",
      customer_id: customerId.trim(),
      amount: amt,
      status: "completed",
    });

    await supabase.from("banking_accounts").update({ balance: account.balance - amt, updated_at: new Date().toISOString() }).eq("id", account.id);
    await supabase.from("banking_transactions").insert({
      account_id: account.id,
      type: "debit",
      amount: amt,
      recipient_name: billerName.trim(),
      description: `Bill Payment — ${selectedCategory}: ${customerId}`,
      admin_override: false,
      custom_timestamp: new Date().toISOString(),
    });

    await logAudit("bill_payment", account.id, account.account_name, { biller: billerName, category: selectedCategory, amount: amt }, account.account_name, "individual");

    setStep("success");
    setSubmitting(false);
    fetchPayments();
  };

  const resetForm = () => {
    setBillerName(""); setCustomerId(""); setAmount(""); setPin(""); setSelectedCategory(null);
    setStep("form"); setShowPayForm(false);
  };

  if (loading) return (
    <div className="min-h-screen flex items-center justify-center" style={{ background: "hsl(220,45%,8%)" }}>
      <div className="w-8 h-8 border-2 border-yellow-500/30 border-t-yellow-500 rounded-full animate-spin" />
    </div>
  );

  return (
    <div className="min-h-screen" style={{ background: "hsl(220,45%,8%)" }}>
      <div className="sticky top-0 z-30 flex items-center gap-3 px-5 pt-12 pb-4" style={{ background: "hsl(220,55%,12%)", borderBottom: "1px solid rgba(255,255,255,0.06)" }}>
        <button onClick={onBack} className="text-white/40 hover:text-white"><ArrowLeft size={20} /></button>
        <Zap size={18} style={{ color: "hsl(43,85%,60%)" }} />
        <div className="flex-1">
          <div className="text-white font-bold">Bill Payments</div>
          <div className="text-white/40 text-xs">Pay utilities, telecom, and more</div>
        </div>
        <button onClick={() => setShowPayForm(true)} className="gold-btn px-3 py-1.5 text-xs font-semibold flex items-center gap-1">
          <Plus size={13} /> Pay
        </button>
      </div>

      <div className="px-4 pt-4 pb-8 space-y-4">
        {/* Category Grid */}
        {!showPayForm && (
          <div className="grid grid-cols-4 gap-2">
            {BILLER_CATEGORIES.map(cat => (
              <button key={cat} onClick={() => { setSelectedCategory(cat); setShowPayForm(true); }}
                className="flex flex-col items-center gap-1.5 p-3 rounded-2xl"
                style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)" }}>
                <span className="text-2xl">{CATEGORY_ICONS[cat]}</span>
                <span className="text-white/60 text-xs text-center leading-tight">{cat}</span>
              </button>
            ))}
          </div>
        )}

        {/* Payment Form */}
        {showPayForm && step === "form" && (
          <div className="rounded-3xl p-5 space-y-4" style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)" }}>
            <div className="flex items-center justify-between">
              <div className="text-white font-bold">New Bill Payment</div>
              <button onClick={resetForm} className="text-white/40"><X size={18} /></button>
            </div>
            <div>
              <label className="text-white/60 text-xs mb-1.5 block">Category</label>
              <select className="dark-input text-sm" value={selectedCategory || ""} onChange={e => setSelectedCategory(e.target.value)}>
                <option value="">Select category</option>
                {BILLER_CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
              </select>
            </div>
            <div>
              <label className="text-white/60 text-xs mb-1.5 block">Biller / Company Name *</label>
              <input className="dark-input" placeholder="e.g. Electric Company" value={billerName} onChange={e => setBillerName(e.target.value)} />
            </div>
            <div>
              <label className="text-white/60 text-xs mb-1.5 block">Account / Customer ID *</label>
              <input className="dark-input" placeholder="Your account reference" value={customerId} onChange={e => setCustomerId(e.target.value)} />
            </div>
            <div>
              <label className="text-white/60 text-xs mb-1.5 block">Amount ({account.currency}) *</label>
              <input type="number" className="dark-input" placeholder="0.00" value={amount} onChange={e => setAmount(e.target.value)} />
              <div className="text-white/25 text-xs mt-1">Balance: {formatCurrency(account.balance, account.currency)}</div>
            </div>
            <button onClick={handleProceedToConfirm} className="gold-btn w-full py-3 text-sm font-semibold">Review Payment</button>
          </div>
        )}

        {/* Confirm Screen */}
        {showPayForm && step === "confirm" && (
          <div className="rounded-3xl overflow-hidden" style={{ border: "1px solid rgba(200,155,50,0.25)" }}>
            <div className="p-5 text-center" style={{ background: "linear-gradient(135deg,hsl(220,60%,18%),hsl(220,70%,12%))" }}>
              <div className="text-white/40 text-xs mb-1">Payment Amount</div>
              <div className="text-white font-black text-4xl">{formatCurrency(parseFloat(amount), account.currency)}</div>
              <div className="text-white/50 text-sm mt-1">{billerName}</div>
            </div>
            <div className="p-5 space-y-2" style={{ background: "rgba(255,255,255,0.03)" }}>
              {[
                ["Biller", billerName],
                ["Category", selectedCategory || "Other"],
                ["Customer ID", customerId],
                ["Amount", formatCurrency(parseFloat(amount), account.currency)],
                ["From Account", account.account_number],
              ].map(([l, v]) => (
                <div key={l} className="flex justify-between py-2" style={{ borderBottom: "1px solid rgba(255,255,255,0.05)" }}>
                  <span className="text-white/40 text-xs">{l}</span>
                  <span className="text-white text-xs font-semibold">{v}</span>
                </div>
              ))}
              <div className="grid grid-cols-2 gap-3 pt-2">
                <button onClick={() => setStep("form")} className="py-3 rounded-2xl text-white/60 text-sm" style={{ background: "rgba(255,255,255,0.07)" }}>Back</button>
                <button onClick={handleProceedToPin} className="gold-btn py-3 text-sm font-semibold">Confirm</button>
              </div>
            </div>
          </div>
        )}

        {/* PIN Step */}
        {showPayForm && step === "pin" && (
          <div className="rounded-3xl p-5 space-y-4" style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)" }}>
            <div className="text-center text-white font-bold">Enter Transfer PIN</div>
            <input type="password" maxLength={4} className="dark-input text-center text-2xl tracking-widest font-bold" placeholder="••••"
              value={pin} onChange={e => setPin(e.target.value.replace(/\D/g, "").slice(0, 4))} />
            <button onClick={handleSubmitPayment} disabled={submitting || pin.length !== 4} className="gold-btn w-full py-3 text-sm font-semibold">
              {submitting ? <div className="w-4 h-4 border-2 border-gray-900/30 border-t-gray-900 rounded-full animate-spin mx-auto" /> : "Pay Bill"}
            </button>
          </div>
        )}

        {/* Success */}
        {step === "success" && (
          <div className="text-center py-10 space-y-3">
            <div className="w-16 h-16 rounded-full flex items-center justify-center mx-auto" style={{ background: "rgba(34,197,94,0.15)" }}>
              <CheckCircle size={32} color="#22c55e" />
            </div>
            <div className="text-white font-bold text-xl">Payment Successful</div>
            <div className="text-white/50 text-sm">{formatCurrency(parseFloat(amount), account.currency)} paid to {billerName}</div>
            <button onClick={resetForm} className="gold-btn px-6 py-2.5 text-sm font-semibold mt-2">Done</button>
          </div>
        )}

        {/* Payment History */}
        {!showPayForm && (
          <div>
            <div className="text-white/50 text-xs font-semibold uppercase tracking-wide mb-2">Payment History ({payments.length})</div>
            {payments.length === 0 ? (
              <div className="text-center py-8 text-white/20 text-sm">No payments yet</div>
            ) : (
              payments.map(p => (
                <div key={p.id} className="flex items-center gap-3 p-4 rounded-2xl mb-2"
                  style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.06)" }}>
                  <div className="text-2xl flex-shrink-0">{CATEGORY_ICONS[p.biller_category] || "💳"}</div>
                  <div className="flex-1 min-w-0">
                    <div className="text-white font-semibold text-sm">{p.biller_name}</div>
                    <div className="text-white/40 text-xs">{p.biller_category} · {formatDateTime(p.created_at)}</div>
                  </div>
                  <div className="text-right flex-shrink-0">
                    <div className="text-red-400 font-bold text-sm">-{formatCurrency(p.amount, account.currency)}</div>
                    <div className="text-green-400 text-xs">{p.status}</div>
                  </div>
                </div>
              ))
            )}
          </div>
        )}
      </div>
    </div>
  );
}
