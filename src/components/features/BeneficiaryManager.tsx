import { useState, useEffect } from "react";
import { ArrowLeft, Users, Plus, X, CheckCircle, Trash2, Edit2 } from "lucide-react";
import { supabase, type Account, type Beneficiary, trackFeatureUse, logAudit } from "@/lib/supabase";
import { formatDateTime } from "@/lib/utils";
import { usePolling } from "@/hooks/usePolling";
import { toast } from "sonner";
import { BANK_SUGGESTIONS } from "@/lib/utils";

interface Props {
  account: Account;
  onBack: () => void;
  onSelectBeneficiary?: (b: Beneficiary) => void;
  selectMode?: boolean;
}

export default function BeneficiaryManager({ account, onBack, onSelectBeneficiary, selectMode }: Props) {
  const [beneficiaries, setBeneficiaries] = useState<Beneficiary[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAdd, setShowAdd] = useState(false);
  const [editBeneficiary, setEditBeneficiary] = useState<Beneficiary | null>(null);

  // Form state
  const [name, setName] = useState("");
  const [bankName, setBankName] = useState("");
  const [bankSuggestions, setBankSuggestions] = useState<string[]>([]);
  const [accountNumber, setAccountNumber] = useState("");
  const [nickname, setNickname] = useState("");
  const [pin, setPin] = useState("");
  const [step, setStep] = useState<"form" | "pin" | "success">("form");
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!selectMode) trackFeatureUse(account.account_name, account.id, "beneficiary_manager");
    fetchBeneficiaries();
  }, [account.id]);

  const fetchBeneficiaries = async () => {
    const { data } = await supabase.from("beneficiaries").select("*").eq("account_id", account.id).order("created_at", { ascending: false });
    if (data) setBeneficiaries(data as Beneficiary[]);
    setLoading(false);
  };

  usePolling(fetchBeneficiaries, 10000, !showAdd && !editBeneficiary);

  const handleBankInput = (val: string) => {
    setBankName(val);
    if (val.length >= 2) setBankSuggestions(BANK_SUGGESTIONS.filter(b => b.toLowerCase().includes(val.toLowerCase())).slice(0, 4));
    else setBankSuggestions([]);
  };

  const handleAdd = async () => {
    if (!name.trim() || !bankName.trim() || !accountNumber.trim()) { toast.error("Please fill all required fields."); return; }
    if (accountNumber.length < 5) { toast.error("Account number appears too short."); return; }
    if (account.transfer_pin) { setStep("pin"); return; }
    await saveNew();
  };

  const saveNew = async () => {
    setSubmitting(true);
    const { error } = await supabase.from("beneficiaries").insert({
      account_id: account.id,
      name: name.trim(),
      bank_name: bankName.trim(),
      account_number: accountNumber.trim(),
      nickname: nickname.trim() || null,
    });
    if (error) { toast.error("Could not save beneficiary."); setSubmitting(false); return; }
    await logAudit("beneficiary_added", account.id, account.account_name, { name: name.trim(), bank: bankName.trim() }, account.account_name, "individual");
    toast.success("Beneficiary saved successfully.");
    setStep("success");
    setSubmitting(false);
    fetchBeneficiaries();
    setTimeout(() => { resetForm(); }, 1500);
  };

  const handlePinConfirm = async () => {
    if (pin !== account.transfer_pin) { toast.error("Incorrect PIN."); return; }
    await saveNew();
  };

  const handleDelete = async (b: Beneficiary) => {
    if (!confirm(`Remove ${b.name} from saved beneficiaries?`)) return;
    await supabase.from("beneficiaries").delete().eq("id", b.id);
    toast.success("Beneficiary removed.");
    fetchBeneficiaries();
  };

  const handleUpdate = async () => {
    if (!editBeneficiary) return;
    await supabase.from("beneficiaries").update({ name: name.trim(), nickname: nickname.trim() || null }).eq("id", editBeneficiary.id);
    toast.success("Beneficiary updated.");
    setEditBeneficiary(null);
    fetchBeneficiaries();
  };

  const resetForm = () => {
    setName(""); setBankName(""); setAccountNumber(""); setNickname(""); setPin(""); setStep("form"); setShowAdd(false);
  };

  const openEdit = (b: Beneficiary) => {
    setName(b.name); setNickname(b.nickname || ""); setEditBeneficiary(b);
  };

  const maskAccount = (num: string) => `${"•".repeat(Math.max(0, num.length - 4))}${num.slice(-4)}`;

  if (loading) return (
    <div className="min-h-screen flex items-center justify-center" style={{ background: "hsl(220,45%,8%)" }}>
      <div className="w-8 h-8 border-2 border-yellow-500/30 border-t-yellow-500 rounded-full animate-spin" />
    </div>
  );

  return (
    <div className="min-h-screen" style={{ background: "hsl(220,45%,8%)" }}>
      <div className="sticky top-0 z-30 flex items-center gap-3 px-5 pt-12 pb-4" style={{ background: "hsl(220,55%,12%)", borderBottom: "1px solid rgba(255,255,255,0.06)" }}>
        <button onClick={onBack} className="text-white/40 hover:text-white"><ArrowLeft size={20} /></button>
        <Users size={18} style={{ color: "hsl(43,85%,60%)" }} />
        <div className="flex-1">
          <div className="text-white font-bold">{selectMode ? "Select Beneficiary" : "Saved Beneficiaries"}</div>
          <div className="text-white/40 text-xs">{beneficiaries.length} saved</div>
        </div>
        {!selectMode && (
          <button onClick={() => setShowAdd(true)} className="gold-btn px-3 py-1.5 text-xs font-semibold flex items-center gap-1">
            <Plus size={13} /> Add
          </button>
        )}
      </div>

      <div className="px-4 pt-4 pb-8 space-y-2">
        {beneficiaries.length === 0 ? (
          <div className="text-center py-16 rounded-3xl" style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.06)" }}>
            <Users size={40} className="mx-auto mb-3 text-white/10" />
            <div className="text-white/30 text-sm">No beneficiaries saved yet</div>
            {!selectMode && (
              <button onClick={() => setShowAdd(true)} className="gold-btn px-5 py-2.5 text-sm font-semibold mt-4 mx-auto flex items-center gap-2">
                <Plus size={14} /> Add First Beneficiary
              </button>
            )}
          </div>
        ) : (
          beneficiaries.map(b => (
            <div key={b.id} className="flex items-center gap-3 p-4 rounded-2xl"
              style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)" }}>
              <div className="w-10 h-10 rounded-full flex items-center justify-center text-sm font-bold flex-shrink-0"
                style={{ background: "hsl(220,50%,22%)", color: "hsl(43,85%,60%)" }}>
                {b.name.slice(0, 2).toUpperCase()}
              </div>
              <div className="flex-1 min-w-0">
                <div className="text-white font-semibold text-sm">{b.nickname || b.name}</div>
                {b.nickname && <div className="text-white/40 text-xs">{b.name}</div>}
                <div className="text-white/30 text-xs">{b.bank_name} · {maskAccount(b.account_number)}</div>
              </div>
              {selectMode ? (
                <button onClick={() => onSelectBeneficiary?.(b)} className="gold-btn px-3 py-1.5 text-xs font-semibold">Select</button>
              ) : (
                <div className="flex gap-2">
                  <button onClick={() => openEdit(b)} className="p-2 rounded-xl text-white/40 hover:text-white" style={{ background: "rgba(255,255,255,0.07)" }}>
                    <Edit2 size={13} />
                  </button>
                  <button onClick={() => handleDelete(b)} className="p-2 rounded-xl text-red-400/60 hover:text-red-400" style={{ background: "rgba(239,68,68,0.07)" }}>
                    <Trash2 size={13} />
                  </button>
                </div>
              )}
            </div>
          ))
        )}
      </div>

      {/* Add Beneficiary Modal */}
      {showAdd && (
        <div className="fixed inset-0 z-50 flex items-end justify-center">
          <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" onClick={resetForm} />
          <div className="relative w-full max-w-sm rounded-t-3xl overflow-hidden" style={{ background: "hsl(220,50%,12%)", border: "1px solid rgba(255,255,255,0.1)", maxHeight: "90vh" }}>
            <div className="flex items-center justify-between p-5" style={{ borderBottom: "1px solid rgba(255,255,255,0.08)" }}>
              <div className="text-white font-bold">{step === "success" ? "Beneficiary Saved" : step === "pin" ? "Confirm with PIN" : "Add Beneficiary"}</div>
              <button onClick={resetForm} className="text-white/40"><X size={18} /></button>
            </div>

            {step === "success" && (
              <div className="p-8 text-center space-y-3">
                <div className="w-16 h-16 rounded-full flex items-center justify-center mx-auto" style={{ background: "rgba(34,197,94,0.15)" }}>
                  <CheckCircle size={32} color="#22c55e" />
                </div>
                <div className="text-white font-bold">Beneficiary Added</div>
              </div>
            )}

            {step === "pin" && (
              <div className="p-5 space-y-4">
                <div className="text-white/50 text-sm text-center">Enter your transfer PIN to save this beneficiary</div>
                <input type="password" maxLength={4} className="dark-input text-center text-2xl tracking-widest font-bold" placeholder="••••"
                  value={pin} onChange={e => setPin(e.target.value.replace(/\D/g, "").slice(0, 4))} />
                <button onClick={handlePinConfirm} disabled={submitting || pin.length !== 4} className="gold-btn w-full py-3 text-sm font-semibold">
                  {submitting ? <div className="w-4 h-4 border-2 border-gray-900/30 border-t-gray-900 rounded-full animate-spin mx-auto" /> : "Confirm & Save"}
                </button>
              </div>
            )}

            {step === "form" && (
              <div className="p-5 space-y-3 overflow-y-auto" style={{ maxHeight: "70vh" }}>
                <div>
                  <label className="text-white/60 text-xs mb-1.5 block">Full Name *</label>
                  <input className="dark-input" placeholder="Beneficiary full name" value={name} onChange={e => setName(e.target.value)} />
                </div>
                <div className="relative">
                  <label className="text-white/60 text-xs mb-1.5 block">Bank Name *</label>
                  <input className="dark-input" placeholder="Search bank..." value={bankName} onChange={e => handleBankInput(e.target.value)} />
                  {bankSuggestions.length > 0 && (
                    <div className="absolute top-full left-0 right-0 z-50 rounded-2xl overflow-hidden mt-1 shadow-2xl" style={{ background: "hsl(220,55%,14%)", border: "1px solid rgba(255,255,255,0.1)" }}>
                      {bankSuggestions.map(b => (
                        <button key={b} onClick={() => { setBankName(b); setBankSuggestions([]); }}
                          className="w-full text-left px-4 py-2.5 text-white text-xs hover:bg-white/5" style={{ borderBottom: "1px solid rgba(255,255,255,0.05)" }}>{b}</button>
                      ))}
                    </div>
                  )}
                </div>
                <div>
                  <label className="text-white/60 text-xs mb-1.5 block">Account Number *</label>
                  <input className="dark-input font-mono" placeholder="Account number" value={accountNumber} onChange={e => setAccountNumber(e.target.value)} />
                </div>
                <div>
                  <label className="text-white/60 text-xs mb-1.5 block">Nickname (optional)</label>
                  <input className="dark-input" placeholder="e.g. My Brother" value={nickname} onChange={e => setNickname(e.target.value)} />
                </div>
                <button onClick={handleAdd} disabled={submitting} className="gold-btn w-full py-3 text-sm font-semibold">
                  {submitting ? <div className="w-4 h-4 border-2 border-gray-900/30 border-t-gray-900 rounded-full animate-spin mx-auto" /> : "Save Beneficiary"}
                </button>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Edit Modal */}
      {editBeneficiary && (
        <div className="fixed inset-0 z-50 flex items-end justify-center">
          <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" onClick={() => setEditBeneficiary(null)} />
          <div className="relative w-full max-w-sm rounded-t-3xl p-5 space-y-3" style={{ background: "hsl(220,50%,12%)", border: "1px solid rgba(255,255,255,0.1)" }}>
            <div className="flex items-center justify-between">
              <div className="text-white font-bold">Edit Beneficiary</div>
              <button onClick={() => setEditBeneficiary(null)} className="text-white/40"><X size={18} /></button>
            </div>
            <div className="text-white/40 text-xs">Account number cannot be changed after creation</div>
            <div>
              <label className="text-white/60 text-xs mb-1.5 block">Display Name</label>
              <input className="dark-input" value={name} onChange={e => setName(e.target.value)} />
            </div>
            <div>
              <label className="text-white/60 text-xs mb-1.5 block">Nickname</label>
              <input className="dark-input" placeholder="Optional nickname" value={nickname} onChange={e => setNickname(e.target.value)} />
            </div>
            <button onClick={handleUpdate} className="gold-btn w-full py-3 text-sm font-semibold">Save Changes</button>
          </div>
        </div>
      )}
    </div>
  );
}
