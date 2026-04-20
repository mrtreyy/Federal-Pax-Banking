import { useState } from "react";
import { X, RefreshCw, CheckCircle, Upload, Eye, EyeOff } from "lucide-react";
import { supabase, logAudit } from "@/lib/supabase";
import { generateAccountNumber } from "@/lib/utils";
import { toast } from "sonner";

interface Props {
  onClose: () => void;
  onSuccess: () => void;
  createdBySubAdmin?: string;
  createdByAp?: string;
}

const ACCOUNT_TYPES = ["Savings Account", "Checking Account", "Current Account", "Fixed Deposit Account", "Business Account", "Joint Account", "Trust Account"];
const CURRENCIES = [
  "USD","EUR","GBP","CAD","AUD","JPY","NGN","GHS","ZAR","CHF","CNY","INR",
  "MXN","BRL","KES","EGP","AED","SAR","SGD","HKD","NOK","SEK","DKK","NZD","THB",
  "CZK","HUF","PLN","RON","TRY","UAH","ILS","JOD","KWD","QAR","OMR","BHD",
  "MAD","TND","DZD","PKR","BDT","LKR","MMK","VND","TWD","KRW","IDR","PHP",
];

export default function CreateAccountModal({ onClose, onSuccess, createdBySubAdmin, createdByAp }: Props) {
  const [step, setStep] = useState(1);
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [showPw, setShowPw] = useState(false);

  const [form, setForm] = useState({
    account_name: "",
    account_type: "Savings Account",
    account_number: generateAccountNumber(),
    currency: "USD",
    balance: "0",
    state: "",
    country: "",
    zipcode: "",
    address: "",
    phone: "",
    id_info: "",
    btc_address: "",
    paypal_email: "",
    bank_name: "",
    bank_account_number: "",
    bank_routing: "",
    profile_picture: "",
    login_email: "",
    login_password: "",
    transfer_pin: "",
    balance_threshold: "",
  });

  const set = (key: string, val: string) => setForm(f => ({ ...f, [key]: val }));

  const handleProfileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    const path = `profile-${Date.now()}.${file.name.split(".").pop()}`;
    const { data, error } = await supabase.storage.from("profiles").upload(path, file, { upsert: true });
    if (!error && data) {
      const { data: url } = supabase.storage.from("profiles").getPublicUrl(data.path);
      set("profile_picture", url.publicUrl);
      toast.success("Profile picture uploaded!");
    }
    setUploading(false);
  };

  const handleCreate = async () => {
    if (!form.account_name.trim()) { toast.error("Account name is required."); return; }
    if (!form.login_email.trim()) { toast.error("Login email is required."); return; }
    if (!form.login_password.trim()) { toast.error("Login password is required."); return; }
    if (form.login_password.length < 4) { toast.error("Password must be at least 4 characters."); return; }
    if (form.transfer_pin && form.transfer_pin.length !== 4) { toast.error("Transfer PIN must be exactly 4 digits."); return; }

    setLoading(true);
    const { error } = await supabase.from("banking_accounts").insert({
      account_name: form.account_name.trim(),
      account_type: form.account_type,
      account_number: form.account_number,
      currency: form.currency,
      balance: parseFloat(form.balance) || 0,
      state: form.state || null,
      country: form.country || null,
      zipcode: form.zipcode || null,
      address: form.address || null,
      phone: form.phone || null,
      id_info: form.id_info || null,
      btc_address: form.btc_address || null,
      paypal_email: form.paypal_email || null,
      bank_name: form.bank_name || null,
      bank_account_number: form.bank_account_number || null,
      bank_routing: form.bank_routing || null,
      profile_picture: form.profile_picture || null,
      login_email: form.login_email.trim().toLowerCase(),
      login_password: form.login_password,
      is_frozen: false,
      is_closed: false,
      transfer_pin: form.transfer_pin || null,
      balance_threshold: form.balance_threshold ? parseFloat(form.balance_threshold) : null,
      created_by_sub_admin: createdBySubAdmin || null,
      created_by_ap: createdByAp || null,
    });

    if (error) {
      toast.error(error.message || "Failed to create account.");
      setLoading(false);
      return;
    }

    await logAudit("create_account", undefined, form.account_name.trim(), { account_number: form.account_number });
    setLoading(false);
    setSuccess(true);
    setTimeout(() => { onSuccess(); onClose(); }, 2500);
  };

  if (success) {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center px-4">
        <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" />
        <div className="relative w-full max-w-sm rounded-3xl p-8 flex flex-col items-center text-center" style={{ background: "hsl(220,50%,12%)", border: "1px solid rgba(255,255,255,0.1)" }}>
          <div className="w-20 h-20 rounded-full flex items-center justify-center mb-4" style={{ background: "rgba(34,197,94,0.15)" }}>
            <CheckCircle size={40} color="#22c55e" />
          </div>
          <h3 className="text-white font-bold text-xl mb-2">Account Created!</h3>
          <p className="text-white/60 text-sm mb-1"><strong className="text-white">{form.account_name}</strong> has been successfully created.</p>
          <p className="text-white/40 text-xs">Account Number: {form.account_number}</p>
          <p className="text-white/40 text-xs mt-0.5">Login: {form.login_email}</p>
          {form.transfer_pin && <p className="text-yellow-400/60 text-xs mt-0.5">Transfer PIN set</p>}
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 z-50 flex flex-col" style={{ background: "hsl(220,45%,8%)" }}>
      <div className="flex items-center justify-between px-5 py-4 flex-shrink-0" style={{ background: "hsl(220,55%,13%)", borderBottom: "1px solid rgba(255,255,255,0.08)" }}>
        <div>
          <h3 className="text-white font-bold text-lg">Create Account</h3>
          <div className="flex gap-1.5 mt-1">
            {[1, 2, 3].map(s => (
              <div key={s} className="h-1 rounded-full transition-all" style={{ width: s <= step ? 24 : 16, background: s <= step ? "hsl(43,85%,55%)" : "rgba(255,255,255,0.15)" }} />
            ))}
          </div>
        </div>
        <button onClick={onClose} className="text-white/40 hover:text-white p-1"><X size={20} /></button>
      </div>

      <div className="flex-1 overflow-y-auto p-5 space-y-4">
        {step === 1 && (
          <>
            <div className="text-white/60 text-xs font-semibold uppercase tracking-wider mb-2">Account Details</div>
            <Field label="Account Name (Full Name) *" value={form.account_name} onChange={v => { set("account_name", v); set("account_number", generateAccountNumber()); }} placeholder="e.g. John Smith" />
            <div>
              <label className="text-white/60 text-xs mb-1.5 block">Account Type *</label>
              <select className="dark-input" value={form.account_type} onChange={e => set("account_type", e.target.value)}>
                {ACCOUNT_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
              </select>
            </div>
            <div>
              <label className="text-white/60 text-xs mb-1.5 block">Account Number</label>
              <div className="flex gap-2">
                <input className="dark-input flex-1 font-mono text-sm" value={form.account_number} readOnly />
                <button onClick={() => set("account_number", generateAccountNumber())} className="px-3 rounded-2xl flex items-center gap-1 text-xs flex-shrink-0" style={{ background: "rgba(255,255,255,0.07)", color: "hsl(43,85%,60%)" }}>
                  <RefreshCw size={14} /> Regenerate
                </button>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-white/60 text-xs mb-1.5 block">Currency</label>
                <select className="dark-input" value={form.currency} onChange={e => set("currency", e.target.value)}>
                  {CURRENCIES.map(c => <option key={c} value={c}>{c}</option>)}
                </select>
              </div>
              <Field label="Initial Balance" value={form.balance} onChange={v => set("balance", v)} placeholder="0.00" type="number" />
            </div>
            <Field label="State" value={form.state} onChange={v => set("state", v)} placeholder="State/Province" />
            <Field label="Country" value={form.country} onChange={v => set("country", v)} placeholder="Country" />
            <Field label="ZIP Code" value={form.zipcode} onChange={v => set("zipcode", v)} placeholder="ZIP / Postal Code" />
            <Field label="Address" value={form.address} onChange={v => set("address", v)} placeholder="Full address" />
            <Field label="Phone Number" value={form.phone} onChange={v => set("phone", v)} placeholder="+1 (555) 000-0000" />
            <Field label="ID Information (Optional)" value={form.id_info} onChange={v => set("id_info", v)} placeholder="Passport / DL / ID number" />
          </>
        )}

        {step === 2 && (
          <>
            <div className="text-white/60 text-xs font-semibold uppercase tracking-wider mb-2">Deposit Methods</div>
            <Field label="Bitcoin (BTC) Address" value={form.btc_address} onChange={v => set("btc_address", v)} placeholder="bc1q... or 1... or 3..." />
            <Field label="PayPal Email" value={form.paypal_email} onChange={v => set("paypal_email", v)} placeholder="paypal@email.com" type="email" />
            <Field label="Bank Name" value={form.bank_name} onChange={v => set("bank_name", v)} placeholder="Bank name" />
            <Field label="Bank Account Number" value={form.bank_account_number} onChange={v => set("bank_account_number", v)} placeholder="Account number" />
            <Field label="Bank Routing Number" value={form.bank_routing} onChange={v => set("bank_routing", v)} placeholder="Routing number" />
            <div>
              <label className="text-white/60 text-xs mb-1.5 block">Profile Picture (Optional)</label>
              <label className="flex items-center gap-3 cursor-pointer p-3 rounded-2xl transition-colors hover:bg-white/5" style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)" }}>
                <Upload size={18} style={{ color: "hsl(43,85%,60%)" }} />
                <div>
                  <div className="text-white text-sm">{uploading ? "Uploading..." : form.profile_picture ? "Picture uploaded ✓" : "Upload profile picture"}</div>
                  <div className="text-white/30 text-xs">JPG, PNG up to 5MB</div>
                </div>
                <input type="file" accept="image/*" className="hidden" onChange={handleProfileUpload} disabled={uploading} />
              </label>
              {form.profile_picture && <img src={form.profile_picture} alt="Preview" className="w-16 h-16 rounded-full object-cover mt-2 border-2" style={{ borderColor: "hsl(43,85%,55%)" }} />}
            </div>
          </>
        )}

        {step === 3 && (
          <>
            <div className="text-white/60 text-xs font-semibold uppercase tracking-wider mb-2">Login Credentials & Security</div>
            <div className="rounded-2xl p-4 mb-2" style={{ background: "rgba(200,155,50,0.05)", border: "1px solid rgba(200,155,50,0.15)" }}>
              <p className="text-yellow-400/80 text-xs leading-relaxed">These credentials will be used by the account holder to access the Individual Directive User portal.</p>
            </div>
            <Field label="Login Email *" value={form.login_email} onChange={v => set("login_email", v)} placeholder="user@email.com" type="email" />
            <div>
              <label className="text-white/60 text-xs mb-1.5 block">Login Password *</label>
              <div className="relative">
                <input type={showPw ? "text" : "password"} className="dark-input pr-10" placeholder="Minimum 4 characters" value={form.login_password} onChange={e => set("login_password", e.target.value)} />
                <button type="button" className="absolute right-3 top-1/2 -translate-y-1/2 text-white/40" onClick={() => setShowPw(!showPw)}>
                  {showPw ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>
            </div>
            <div>
              <label className="text-white/60 text-xs mb-1.5 block">Transfer PIN (Optional — 4 digits)</label>
              <input type="text" maxLength={4} className="dark-input tracking-widest text-center text-xl font-bold" placeholder="••••" value={form.transfer_pin} onChange={e => set("transfer_pin", e.target.value.replace(/\D/g, "").slice(0, 4))} />
              <div className="text-white/30 text-xs mt-1">If set, account holder must enter this PIN before any transfer.</div>
            </div>
            <div>
              <label className="text-white/60 text-xs mb-1.5 block">Balance Alert Threshold ({form.currency})</label>
              <input type="number" className="dark-input" placeholder="e.g. 500" value={form.balance_threshold} onChange={e => set("balance_threshold", e.target.value)} />
            </div>

            <div className="navy-card p-4 mt-2">
              <div className="text-white/60 text-xs font-semibold mb-2">Account Summary</div>
              {[
                { label: "Name", value: form.account_name },
                { label: "Type", value: form.account_type },
                { label: "Account No.", value: form.account_number },
                { label: "Currency", value: form.currency },
                { label: "Balance", value: form.balance },
                { label: "Email", value: form.login_email },
                { label: "Transfer PIN", value: form.transfer_pin || "None" },
              ].map(r => (
                <div key={r.label} className="flex justify-between py-1.5" style={{ borderBottom: "1px solid rgba(255,255,255,0.05)" }}>
                  <span className="text-white/40 text-xs">{r.label}</span>
                  <span className="text-white text-xs font-medium">{r.value || "—"}</span>
                </div>
              ))}
            </div>
          </>
        )}
      </div>

      <div className="px-5 py-4 flex gap-3 flex-shrink-0" style={{ borderTop: "1px solid rgba(255,255,255,0.08)" }}>
        {step > 1 && (
          <button onClick={() => setStep(s => s - 1)} className="flex-1 py-3 rounded-2xl text-white/60 text-sm font-medium" style={{ background: "rgba(255,255,255,0.07)" }}>
            Back
          </button>
        )}
        {step < 3 ? (
          <button onClick={() => { if (step === 1 && !form.account_name.trim()) { toast.error("Account name is required."); return; } setStep(s => s + 1); }} className="flex-1 gold-btn py-3 text-sm font-semibold">
            Continue
          </button>
        ) : (
          <button onClick={handleCreate} disabled={loading} className="flex-1 gold-btn py-3 text-sm font-semibold flex items-center justify-center gap-2">
            {loading ? <div className="w-5 h-5 border-2 border-gray-900/30 border-t-gray-900 rounded-full animate-spin" /> : "Create Account"}
          </button>
        )}
      </div>
    </div>
  );
}

function Field({ label, value, onChange, placeholder, type = "text" }: {
  label: string; value: string; onChange: (v: string) => void; placeholder: string; type?: string;
}) {
  return (
    <div>
      <label className="text-white/60 text-xs mb-1.5 block">{label}</label>
      <input type={type} className="dark-input" placeholder={placeholder} value={value} onChange={e => onChange(e.target.value)} />
    </div>
  );
}
