import { useState, useEffect } from "react";
import { ArrowLeft, TrendingUp, Upload, CheckCircle, Clock, XCircle, X, ChevronRight } from "lucide-react";
import { supabase, type Account, type LoanApplication, trackFeatureUse, logAudit } from "@/lib/supabase";
import { formatCurrency, formatDateTime } from "@/lib/utils";
import { usePolling } from "@/hooks/usePolling";
import { toast } from "sonner";

interface Props {
  account: Account;
  onBack: () => void;
}

const LOAN_TYPES = ["Personal", "Business", "Mortgage", "Auto"];
const TERMS = [3, 6, 12, 24, 36, 48, 60];

// Tier-based loan limits
const TIER_LIMITS: Record<number, { min: number; max: number }> = {
  1: { min: 500, max: 10000 },
  2: { min: 1000, max: 25000 },
  3: { min: 2000, max: 75000 },
  4: { min: 5000, max: 150000 },
  5: { min: 10000, max: 500000 },
};

const CURRENCY_IDS: Record<string, string[]> = {
  USD: ["Driver's License", "State ID", "US Passport", "Green Card", "Social Security Card"],
  GBP: ["UK Driving Licence", "UK Passport", "Biometric Residence Permit", "National ID Card"],
  EUR: ["National ID Card", "EU Driving Licence", "EU Passport", "Residence Permit"],
  NGN: ["National ID Card (NIN)", "Driver's License", "International Passport", "Voter's Card", "BVN Slip"],
  DEFAULT: ["National ID Card", "Passport", "Driver's License", "Voter's Card"],
};

const getCurrencyIDs = (currency: string) => CURRENCY_IDS[currency] || CURRENCY_IDS.DEFAULT;

const INTEREST_RATE: Record<number, number> = { 3: 4.5, 6: 5.5, 12: 7.5, 24: 9.0, 36: 10.5, 48: 12.0, 60: 13.5 };

export default function LoanApplicationPage({ account, onBack }: Props) {
  const [loans, setLoans] = useState<LoanApplication[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [selectedLoan, setSelectedLoan] = useState<LoanApplication | null>(null);

  // Form
  const [step, setStep] = useState(1); // 1=details, 2=documents, 3=review
  const [fullName, setFullName] = useState(account.account_name);
  const [loanType, setLoanType] = useState("Personal");
  const [amount, setAmount] = useState("");
  const [termMonths, setTermMonths] = useState(12);
  const [purpose, setPurpose] = useState("");
  const [idType, setIdType] = useState(getCurrencyIDs(account.currency)[0]);
  const [idDocUrl, setIdDocUrl] = useState("");
  const [incomeDocUrl, setIncomeDocUrl] = useState("");
  const [agreed, setAgreed] = useState(false);
  const [uploading, setUploading] = useState<"id" | "income" | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const tier = account.account_tier || 1;
  const limits = TIER_LIMITS[tier];
  const rate = INTEREST_RATE[termMonths] || 7.5;
  const principal = parseFloat(amount) || 0;
  const monthlyPayment = principal > 0 ? ((principal * (1 + rate / 100)) / termMonths) : 0;

  useEffect(() => {
    trackFeatureUse(account.account_name, account.id, "loan_application");
    fetchLoans();
  }, [account.id]);

  const fetchLoans = async () => {
    const { data } = await supabase.from("loan_applications").select("*").eq("account_id", account.id).order("applied_at", { ascending: false });
    if (data) setLoans(data as LoanApplication[]);
    setLoading(false);
  };

  usePolling(fetchLoans, 8000, !showForm && !selectedLoan);

  const handleUpload = async (type: "id" | "income", e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(type);
    const path = `loan-${type}-${account.id}-${Date.now()}.${file.name.split(".").pop()}`;
    const { data, error } = await supabase.storage.from("profiles").upload(path, file, { upsert: true });
    if (!error && data) {
      const { data: url } = supabase.storage.from("profiles").getPublicUrl(data.path);
      if (type === "id") setIdDocUrl(url.publicUrl);
      else setIncomeDocUrl(url.publicUrl);
      toast.success(`${type === "id" ? "ID document" : "Income document"} uploaded.`);
    } else {
      toast.error("Upload failed. Please try again.");
    }
    setUploading(null);
  };

  const handleSubmit = async () => {
    if (!agreed) { toast.error("Please agree to the terms and conditions."); return; }
    if (!idDocUrl) { toast.error("ID document is required."); return; }
    setSubmitting(true);

    await supabase.from("loan_applications").insert({
      account_id: account.id,
      account_name: fullName,
      account_number: account.account_number,
      amount: principal,
      purpose,
      loan_type: loanType.toLowerCase(),
      term_months: termMonths,
      id_document_url: idDocUrl,
      id_document_type: idType,
      income_document_url: incomeDocUrl || null,
      status: "pending",
    });

    await supabase.from("banking_notifications").insert({
      account_id: account.id,
      target: "cas",
      title: `Loan Application — ${loanType}`,
      body: `${account.account_name} (${account.account_number}) has applied for a ${loanType} loan of ${formatCurrency(principal, account.currency)} over ${termMonths} months. Purpose: ${purpose}. Tier: ${account.account_tier || 1}. Currency: ${account.currency}. ID Type: ${idType}. ID Document: ${idDocUrl}${incomeDocUrl ? ` Income Doc: ${incomeDocUrl}` : ""}`,
      is_read: false,
    });

    await logAudit("loan_application_submitted", account.id, account.account_name, { loanType, amount: principal, termMonths }, account.account_name, "individual");

    toast.success("Loan application submitted. You will be notified of the decision.");
    setShowForm(false);
    resetForm();
    setSubmitting(false);
    fetchLoans();
  };

  const resetForm = () => {
    setStep(1); setAmount(""); setPurpose(""); setIdDocUrl(""); setIncomeDocUrl(""); setAgreed(false); setLoanType("Personal"); setTermMonths(12);
  };

  const TRACKER_STEPS = ["Pending", "Under Review", "Approved", "Declined", "Disbursed"];
  const getTrackerStep = (status: string) => {
    if (status === "pending") return 0;
    if (status === "approved") return 2;
    if (status === "declined") return 3;
    return 1;
  };

  if (loading) return (
    <div className="min-h-screen flex items-center justify-center" style={{ background: "hsl(220,45%,8%)" }}>
      <div className="w-8 h-8 border-2 border-yellow-500/30 border-t-yellow-500 rounded-full animate-spin" />
    </div>
  );

  // Loan detail
  if (selectedLoan) {
    const stepIdx = getTrackerStep(selectedLoan.status);
    return (
      <div className="min-h-screen" style={{ background: "hsl(220,45%,8%)" }}>
        <div className="sticky top-0 z-30 flex items-center gap-3 px-5 pt-12 pb-4" style={{ background: "hsl(220,55%,12%)", borderBottom: "1px solid rgba(255,255,255,0.06)" }}>
          <button onClick={() => setSelectedLoan(null)} className="text-white/40 hover:text-white"><ArrowLeft size={20} /></button>
          <div className="text-white font-bold flex-1">Loan Application Detail</div>
        </div>
        <div className="px-4 pt-4 pb-8 space-y-4">
          <div className="rounded-3xl p-5 space-y-2" style={{ background: "hsl(220,50%,14%)", border: "1px solid rgba(255,255,255,0.08)" }}>
            <div className="text-white font-bold text-2xl" style={{ color: "hsl(43,85%,60%)" }}>{formatCurrency(selectedLoan.amount, account.currency)}</div>
            <div className="text-white/50 text-sm">{(selectedLoan as Record<string, string>).loan_type?.toUpperCase() || "Personal"} Loan · {(selectedLoan as Record<string, unknown>).term_months || 12} months</div>
            {[
              ["Purpose", selectedLoan.purpose],
              ["Submitted", formatDateTime(selectedLoan.applied_at)],
              ...(selectedLoan.repayment_terms ? [["Repayment Terms", selectedLoan.repayment_terms]] : []),
              ...(selectedLoan.decline_reason ? [["Decline Reason", selectedLoan.decline_reason]] : []),
            ].map(([l, v]) => (
              <div key={l} className="flex justify-between py-1.5" style={{ borderBottom: "1px solid rgba(255,255,255,0.05)" }}>
                <span className="text-white/40 text-xs">{l}</span>
                <span className="text-white text-xs font-medium text-right max-w-[55%]">{v}</span>
              </div>
            ))}
          </div>
          {/* Tracker */}
          <div className="rounded-2xl p-4 space-y-2" style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)" }}>
            {TRACKER_STEPS.map((s, i) => (
              <div key={s} className="flex items-center gap-3">
                <div className="w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0"
                  style={{ background: i === stepIdx ? "rgba(200,155,50,0.25)" : i < stepIdx ? "rgba(34,197,94,0.2)" : "rgba(255,255,255,0.07)", color: i === stepIdx ? "hsl(43,85%,60%)" : i < stepIdx ? "#22c55e" : "rgba(255,255,255,0.3)" }}>
                  {i < stepIdx ? "✓" : i + 1}
                </div>
                <span className={`text-sm ${i === stepIdx ? "text-white font-semibold" : i < stepIdx ? "text-green-400" : "text-white/30"}`}>{s}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen" style={{ background: "hsl(220,45%,8%)" }}>
      <div className="sticky top-0 z-30 flex items-center gap-3 px-5 pt-12 pb-4" style={{ background: "hsl(220,55%,12%)", borderBottom: "1px solid rgba(255,255,255,0.06)" }}>
        <button onClick={onBack} className="text-white/40 hover:text-white"><ArrowLeft size={20} /></button>
        <TrendingUp size={18} style={{ color: "hsl(43,85%,60%)" }} />
        <div className="flex-1">
          <div className="text-white font-bold">Loan Applications</div>
          <div className="text-white/40 text-xs">Tier {tier} · {formatCurrency(limits.min, account.currency)} – {formatCurrency(limits.max, account.currency)}</div>
        </div>
        {!showForm && (
          <button onClick={() => setShowForm(true)} className="gold-btn px-3 py-1.5 text-xs font-semibold">Apply</button>
        )}
      </div>

      <div className="px-4 pt-4 pb-8 space-y-4">
        {/* Application Form */}
        {showForm && (
          <div className="rounded-3xl p-5 space-y-4" style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(200,155,50,0.2)" }}>
            <div className="flex items-center justify-between">
              <div className="text-white font-bold">Loan Application — Step {step}/3</div>
              <button onClick={() => { setShowForm(false); resetForm(); }} className="text-white/40"><X size={18} /></button>
            </div>

            {step === 1 && (
              <div className="space-y-3">
                <div>
                  <label className="text-white/60 text-xs mb-1.5 block">Full Name</label>
                  <input className="dark-input" value={fullName} onChange={e => setFullName(e.target.value)} />
                </div>
                <div>
                  <label className="text-white/60 text-xs mb-1.5 block">Loan Type</label>
                  <div className="grid grid-cols-2 gap-2">
                    {LOAN_TYPES.map(t => (
                      <button key={t} onClick={() => setLoanType(t)}
                        className="py-2 rounded-xl text-sm font-medium"
                        style={loanType === t ? { background: "rgba(200,155,50,0.2)", color: "hsl(43,85%,60%)", border: "1px solid rgba(200,155,50,0.4)" } : { background: "rgba(255,255,255,0.06)", color: "rgba(255,255,255,0.6)", border: "1px solid rgba(255,255,255,0.08)" }}>
                        {t}
                      </button>
                    ))}
                  </div>
                </div>
                <div>
                  <label className="text-white/60 text-xs mb-1.5 block">Amount ({account.currency}) — Max: {formatCurrency(limits.max, account.currency)}</label>
                  <input type="number" className="dark-input" placeholder={`${limits.min} – ${limits.max}`} value={amount} onChange={e => setAmount(e.target.value)} min={limits.min} max={limits.max} />
                </div>
                <div>
                  <label className="text-white/60 text-xs mb-1.5 block">Term Length</label>
                  <select className="dark-input text-sm" value={termMonths} onChange={e => setTermMonths(parseInt(e.target.value))}>
                    {TERMS.map(t => <option key={t} value={t}>{t} months</option>)}
                  </select>
                </div>
                {principal > 0 && (
                  <div className="rounded-2xl p-3" style={{ background: "rgba(200,155,50,0.07)", border: "1px solid rgba(200,155,50,0.15)" }}>
                    <div className="grid grid-cols-3 gap-2 text-center">
                      <div><div className="text-white/40 text-xs">Rate</div><div className="text-yellow-400 font-bold">{rate}%</div></div>
                      <div><div className="text-white/40 text-xs">Monthly</div><div className="text-white font-bold text-sm">{formatCurrency(monthlyPayment, account.currency)}</div></div>
                      <div><div className="text-white/40 text-xs">Total</div><div className="text-white font-bold text-sm">{formatCurrency(monthlyPayment * termMonths, account.currency)}</div></div>
                    </div>
                  </div>
                )}
                <div>
                  <label className="text-white/60 text-xs mb-1.5 block">Purpose of Loan *</label>
                  <textarea className="dark-input resize-none" rows={3} placeholder="Describe the purpose of this loan..." value={purpose} onChange={e => setPurpose(e.target.value)} />
                </div>
                <button onClick={() => { if (!amount || !purpose.trim()) { toast.error("Please fill all fields."); return; } setStep(2); }} className="gold-btn w-full py-3 text-sm font-semibold">Next: Upload Documents</button>
              </div>
            )}

            {step === 2 && (
              <div className="space-y-4">
                <div>
                  <label className="text-white/60 text-xs mb-1.5 block">ID Document Type</label>
                  <select className="dark-input text-sm" value={idType} onChange={e => setIdType(e.target.value)}>
                    {getCurrencyIDs(account.currency).map(id => <option key={id} value={id}>{id}</option>)}
                  </select>
                </div>
                <div>
                  <label className="text-white/60 text-xs mb-1.5 block">Upload Identity Document * (Front)</label>
                  <label className="flex items-center gap-3 p-3 rounded-2xl cursor-pointer" style={{ background: "rgba(255,255,255,0.04)", border: `1px solid ${idDocUrl ? "rgba(34,197,94,0.3)" : "rgba(255,255,255,0.08)"}` }}>
                    <Upload size={16} style={{ color: idDocUrl ? "#22c55e" : "hsl(43,85%,60%)" }} />
                    <span className="text-white/60 text-xs">{uploading === "id" ? "Uploading..." : idDocUrl ? "✓ ID uploaded" : "Upload ID document"}</span>
                    <input type="file" accept="image/*,.pdf" className="hidden" onChange={e => handleUpload("id", e)} disabled={uploading !== null} />
                  </label>
                </div>
                <div>
                  <label className="text-white/60 text-xs mb-1.5 block">Proof of Income (optional)</label>
                  <label className="flex items-center gap-3 p-3 rounded-2xl cursor-pointer" style={{ background: "rgba(255,255,255,0.04)", border: `1px solid ${incomeDocUrl ? "rgba(34,197,94,0.3)" : "rgba(255,255,255,0.08)"}` }}>
                    <Upload size={16} style={{ color: incomeDocUrl ? "#22c55e" : "rgba(255,255,255,0.4)" }} />
                    <span className="text-white/60 text-xs">{uploading === "income" ? "Uploading..." : incomeDocUrl ? "✓ Income doc uploaded" : "Upload pay stub / bank statement"}</span>
                    <input type="file" accept="image/*,.pdf" className="hidden" onChange={e => handleUpload("income", e)} disabled={uploading !== null} />
                  </label>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <button onClick={() => setStep(1)} className="py-3 rounded-2xl text-white/60 text-sm" style={{ background: "rgba(255,255,255,0.07)" }}>Back</button>
                  <button onClick={() => { if (!idDocUrl) { toast.error("ID document is required."); return; } setStep(3); }} className="gold-btn py-3 text-sm font-semibold">Review</button>
                </div>
              </div>
            )}

            {step === 3 && (
              <div className="space-y-4">
                <div className="rounded-2xl p-4 space-y-2" style={{ background: "rgba(255,255,255,0.04)" }}>
                  {[
                    ["Type", loanType],
                    ["Amount", formatCurrency(principal, account.currency)],
                    ["Term", `${termMonths} months`],
                    ["Rate", `${rate}%`],
                    ["Monthly Payment", formatCurrency(monthlyPayment, account.currency)],
                    ["ID Type", idType],
                    ["Purpose", purpose],
                  ].map(([l, v]) => (
                    <div key={l} className="flex justify-between py-1.5" style={{ borderBottom: "1px solid rgba(255,255,255,0.05)" }}>
                      <span className="text-white/40 text-xs">{l}</span>
                      <span className="text-white text-xs font-semibold text-right max-w-[55%]">{v}</span>
                    </div>
                  ))}
                </div>
                <label className="flex items-start gap-3 cursor-pointer">
                  <div onClick={() => setAgreed(!agreed)} className="w-5 h-5 rounded-md flex items-center justify-center flex-shrink-0 mt-0.5" style={{ background: agreed ? "hsl(43,85%,55%)" : "rgba(255,255,255,0.1)", border: "1px solid rgba(255,255,255,0.2)" }}>
                    {agreed && <CheckCircle size={13} className="text-gray-900" />}
                  </div>
                  <span className="text-white/50 text-xs leading-relaxed">I confirm the information provided is accurate and I agree to BankUnited's loan terms and conditions.</span>
                </label>
                <div className="grid grid-cols-2 gap-3">
                  <button onClick={() => setStep(2)} className="py-3 rounded-2xl text-white/60 text-sm" style={{ background: "rgba(255,255,255,0.07)" }}>Back</button>
                  <button onClick={handleSubmit} disabled={submitting || !agreed} className="gold-btn py-3 text-sm font-semibold" style={{ opacity: !agreed ? 0.5 : 1 }}>
                    {submitting ? <div className="w-4 h-4 border-2 border-gray-900/30 border-t-gray-900 rounded-full animate-spin mx-auto" /> : "Submit Application"}
                  </button>
                </div>
              </div>
            )}
          </div>
        )}

        {/* Existing Loans */}
        {!showForm && (
          <>
            {loans.length === 0 ? (
              <div className="text-center py-16 rounded-3xl" style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.06)" }}>
                <TrendingUp size={40} className="mx-auto mb-3 text-white/10" />
                <div className="text-white/30 text-sm">No loan applications yet</div>
                <div className="text-white/20 text-xs mt-1">Tier {tier} — Eligible for up to {formatCurrency(limits.max, account.currency)}</div>
                <button onClick={() => setShowForm(true)} className="gold-btn px-5 py-2.5 text-sm font-semibold mt-4 mx-auto flex items-center gap-2">Apply Now</button>
              </div>
            ) : (
              loans.map(loan => (
                <button key={loan.id} onClick={() => setSelectedLoan(loan)}
                  className="w-full text-left rounded-2xl p-4"
                  style={{ background: "rgba(255,255,255,0.04)", border: `1px solid ${loan.status === "approved" ? "rgba(34,197,94,0.2)" : loan.status === "declined" ? "rgba(239,68,68,0.2)" : "rgba(200,155,50,0.2)"}` }}>
                  <div className="flex items-center justify-between">
                    <div className="text-white font-bold">{formatCurrency(loan.amount, account.currency)}</div>
                    <span className={`text-xs px-2 py-0.5 rounded-full font-semibold ${loan.status === "pending" ? "bg-yellow-500/15 text-yellow-400" : loan.status === "approved" ? "bg-green-500/15 text-green-400" : "bg-red-500/15 text-red-400"}`}>{loan.status}</span>
                  </div>
                  <div className="text-white/40 text-xs mt-1">{loan.purpose} · {formatDateTime(loan.applied_at)}</div>
                  {loan.repayment_terms && <div className="text-white/30 text-xs mt-0.5">{loan.repayment_terms}</div>}
                </button>
              ))
            )}
          </>
        )}
      </div>
    </div>
  );
}
