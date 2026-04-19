import { useState } from "react";
import { X, Save, Trash2, Snowflake, XCircle, Upload, Eye, EyeOff, Shield } from "lucide-react";
import { supabase, type Account, logAudit } from "@/lib/supabase";
import { toast } from "sonner";

interface Props {
  account: Account;
  onClose: () => void;
  onSuccess: () => void;
  onDelete?: () => void;
}

const ACCOUNT_TYPES = ["Savings Account", "Checking Account", "Current Account", "Fixed Deposit Account", "Business Account", "Joint Account"];
const CURRENCIES = ["USD", "EUR", "GBP", "CAD", "AUD", "JPY", "NGN", "GHS", "ZAR"];

export default function EditAccountModal({ account, onClose, onSuccess, onDelete }: Props) {
  const [form, setForm] = useState({ ...account, balance: String(account.balance), transfer_pin: account.transfer_pin || "", balance_threshold: String(account.balance_threshold || "") });
  const [loading, setLoading] = useState(false);
  const [tab, setTab] = useState<"basic" | "deposit" | "credentials" | "status" | "security">("basic");
  const [showPw, setShowPw] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [uploadingBanner, setUploadingBanner] = useState(false);

  const set = (key: string, val: string | boolean) => setForm(f => ({ ...f, [key]: val }));

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

  const handleBannerUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploadingBanner(true);
    const path = `banner-${Date.now()}.${file.name.split(".").pop()}`;
    const { data, error } = await supabase.storage.from("profiles").upload(path, file, { upsert: true });
    if (!error && data) {
      const { data: url } = supabase.storage.from("profiles").getPublicUrl(data.path);
      set("custom_banner", url.publicUrl);
      toast.success("Banner uploaded!");
    }
    setUploadingBanner(false);
  };

  const handleSave = async () => {
    setLoading(true);
    const { error } = await supabase.from("banking_accounts").update({
      account_name: form.account_name,
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
      custom_banner: form.custom_banner || null,
      login_email: form.login_email?.trim().toLowerCase() || null,
      login_password: form.login_password || null,
      is_frozen: form.is_frozen,
      is_closed: form.is_closed,
      transfer_pin: form.transfer_pin?.trim() || null,
      balance_threshold: form.balance_threshold ? parseFloat(form.balance_threshold) : null,
      updated_at: new Date().toISOString(),
    }).eq("id", account.id);

    if (error) {
      toast.error("Failed to save changes.");
    } else {
      await logAudit("edit_account", account.id, account.account_name, { tabs: tab });
      toast.success("Account updated successfully.");
      onSuccess();
      onClose();
    }
    setLoading(false);
  };

  const tabs = [
    { key: "basic", label: "Basic" },
    { key: "deposit", label: "Deposit" },
    { key: "credentials", label: "Access" },
    { key: "security", label: "Security" },
    { key: "status", label: "Status" },
  ] as const;

  return (
    <div className="fixed inset-0 z-50 flex flex-col" style={{ background: "hsl(220,45%,8%)" }}>
      <div className="flex items-center justify-between px-5 py-4 flex-shrink-0" style={{ background: "hsl(220,55%,13%)", borderBottom: "1px solid rgba(255,255,255,0.08)" }}>
        <div>
          <h3 className="text-white font-bold text-lg">Edit Account</h3>
          <p className="text-white/40 text-xs">{account.account_name}</p>
        </div>
        <button onClick={onClose} className="text-white/40 hover:text-white p-1"><X size={20} /></button>
      </div>

      <div className="flex gap-1 px-4 py-2 flex-shrink-0 overflow-x-auto no-scrollbar" style={{ borderBottom: "1px solid rgba(255,255,255,0.08)" }}>
        {tabs.map(t => (
          <button key={t.key} onClick={() => setTab(t.key)}
            className="flex-shrink-0 px-3 py-1.5 rounded-xl text-xs font-medium transition-all"
            style={tab === t.key ? { background: "hsl(43,85%,55%)", color: "#1a1a1a" } : { background: "rgba(255,255,255,0.06)", color: "rgba(255,255,255,0.5)" }}>
            {t.label}
          </button>
        ))}
      </div>

      <div className="flex-1 overflow-y-auto p-5 space-y-4">
        {tab === "basic" && (
          <>
            <F label="Account Name" value={form.account_name} onChange={v => set("account_name", v)} />
            <div>
              <label className="text-white/60 text-xs mb-1.5 block">Account Type</label>
              <select className="dark-input" value={form.account_type} onChange={e => set("account_type", e.target.value)}>
                {ACCOUNT_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
              </select>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-white/60 text-xs mb-1.5 block">Currency</label>
                <select className="dark-input" value={form.currency} onChange={e => set("currency", e.target.value)}>
                  {CURRENCIES.map(c => <option key={c} value={c}>{c}</option>)}
                </select>
              </div>
              <F label="Balance" value={form.balance} onChange={v => set("balance", v)} type="number" />
            </div>
            <F label="State" value={form.state || ""} onChange={v => set("state", v)} />
            <F label="Country" value={form.country || ""} onChange={v => set("country", v)} />
            <F label="ZIP Code" value={form.zipcode || ""} onChange={v => set("zipcode", v)} />
            <F label="Address" value={form.address || ""} onChange={v => set("address", v)} />
            <F label="Phone" value={form.phone || ""} onChange={v => set("phone", v)} />
            <F label="ID Info" value={form.id_info || ""} onChange={v => set("id_info", v)} />
            {/* Profile picture */}
            <div>
              <label className="text-white/60 text-xs mb-1.5 block">Profile Picture</label>
              {form.profile_picture && <img src={form.profile_picture} alt="" className="w-14 h-14 rounded-full object-cover mb-2 border-2" style={{ borderColor: "hsl(43,85%,55%)" }} />}
              <label className="flex items-center gap-2 p-3 rounded-2xl cursor-pointer" style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)" }}>
                <Upload size={15} style={{ color: "hsl(43,85%,60%)" }} />
                <span className="text-white/60 text-xs">{uploading ? "Uploading..." : "Change profile picture"}</span>
                <input type="file" accept="image/*" className="hidden" onChange={handleProfileUpload} disabled={uploading} />
              </label>
            </div>
            {/* Custom banner */}
            <div>
              <label className="text-white/60 text-xs mb-1.5 block">Custom Banner (shown on user dashboard)</label>
              {form.custom_banner && <img src={form.custom_banner} alt="" className="w-full h-16 rounded-xl object-cover mb-2" />}
              <label className="flex items-center gap-2 p-3 rounded-2xl cursor-pointer" style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)" }}>
                <Upload size={15} style={{ color: "hsl(43,85%,60%)" }} />
                <span className="text-white/60 text-xs">{uploadingBanner ? "Uploading..." : "Upload custom banner"}</span>
                <input type="file" accept="image/*" className="hidden" onChange={handleBannerUpload} disabled={uploadingBanner} />
              </label>
            </div>
          </>
        )}

        {tab === "deposit" && (
          <>
            <F label="Bitcoin (BTC) Address" value={form.btc_address || ""} onChange={v => set("btc_address", v)} />
            <F label="PayPal Email" value={form.paypal_email || ""} onChange={v => set("paypal_email", v)} type="email" />
            <F label="Bank Name" value={form.bank_name || ""} onChange={v => set("bank_name", v)} />
            <F label="Bank Account Number" value={form.bank_account_number || ""} onChange={v => set("bank_account_number", v)} />
            <F label="Bank Routing Number" value={form.bank_routing || ""} onChange={v => set("bank_routing", v)} />
          </>
        )}

        {tab === "credentials" && (
          <>
            <div className="rounded-2xl p-3 mb-2" style={{ background: "rgba(239,68,68,0.07)", border: "1px solid rgba(239,68,68,0.15)" }}>
              <p className="text-red-400/80 text-xs">Changing credentials will require the account holder to use the new login details.</p>
            </div>
            <F label="Login Email" value={form.login_email || ""} onChange={v => set("login_email", v)} type="email" />
            <div>
              <label className="text-white/60 text-xs mb-1.5 block">Login Password</label>
              <div className="relative">
                <input type={showPw ? "text" : "password"} className="dark-input pr-10" value={form.login_password || ""} onChange={e => set("login_password", e.target.value)} />
                <button type="button" className="absolute right-3 top-1/2 -translate-y-1/2 text-white/40" onClick={() => setShowPw(!showPw)}>
                  {showPw ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>
            </div>
          </>
        )}

        {tab === "security" && (
          <>
            <div className="rounded-2xl p-4" style={{ background: "rgba(200,155,50,0.06)", border: "1px solid rgba(200,155,50,0.15)" }}>
              <div className="flex items-center gap-2 mb-2">
                <Shield size={16} style={{ color: "hsl(43,85%,60%)" }} />
                <span className="text-white font-semibold text-sm">Transfer Authentication PIN</span>
              </div>
              <p className="text-white/40 text-xs mb-3">Set a 4-digit PIN that the account holder must enter before any transfer is processed. Only admin can set or change this PIN.</p>
              <input type="text" maxLength={4} className="dark-input tracking-widest text-center text-xl font-bold" placeholder="••••"
                value={form.transfer_pin || ""} onChange={e => set("transfer_pin", e.target.value.replace(/\D/g, "").slice(0, 4))} />
              {form.transfer_pin && <div className="text-yellow-400 text-xs mt-1 text-center">PIN set: {form.transfer_pin}</div>}
              {!form.transfer_pin && <div className="text-white/30 text-xs mt-1 text-center">Leave blank to remove transfer PIN</div>}
            </div>

            <div>
              <label className="text-white/60 text-xs mb-1.5 block">Balance Alert Threshold ({form.currency})</label>
              <input type="number" className="dark-input" placeholder="Notify when balance falls below this amount"
                value={form.balance_threshold || ""} onChange={e => set("balance_threshold", e.target.value)} />
              <div className="text-white/30 text-xs mt-1">Account holder receives a notification when balance drops below this amount.</div>
            </div>
          </>
        )}

        {tab === "status" && (
          <div className="space-y-4">
            <div className="rounded-2xl p-4" style={{ background: form.is_frozen ? "rgba(59,130,246,0.1)" : "rgba(255,255,255,0.04)", border: `1px solid ${form.is_frozen ? "rgba(59,130,246,0.3)" : "rgba(255,255,255,0.08)"}` }}>
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2">
                  <Snowflake size={18} color={form.is_frozen ? "#60a5fa" : "rgba(255,255,255,0.4)"} />
                  <span className="text-white font-semibold text-sm">Freeze Account</span>
                </div>
                <button onClick={() => set("is_frozen", !form.is_frozen)} className="w-12 h-6 rounded-full transition-all relative" style={{ background: form.is_frozen ? "#3b82f6" : "rgba(255,255,255,0.15)" }}>
                  <div className="w-4 h-4 rounded-full bg-white absolute top-1 transition-all" style={{ left: form.is_frozen ? "26px" : "4px" }} />
                </button>
              </div>
              <p className="text-white/40 text-xs">When frozen, deposit and transfer are disabled. Account shows "Account Frozen for Policy Violation".</p>
            </div>

            <div className="rounded-2xl p-4" style={{ background: form.is_closed ? "rgba(239,68,68,0.1)" : "rgba(255,255,255,0.04)", border: `1px solid ${form.is_closed ? "rgba(239,68,68,0.3)" : "rgba(255,255,255,0.08)"}` }}>
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2">
                  <XCircle size={18} color={form.is_closed ? "#f87171" : "rgba(255,255,255,0.4)"} />
                  <span className="text-white font-semibold text-sm">Close Account</span>
                </div>
                <button onClick={() => set("is_closed", !form.is_closed)} className="w-12 h-6 rounded-full transition-all relative" style={{ background: form.is_closed ? "#ef4444" : "rgba(255,255,255,0.15)" }}>
                  <div className="w-4 h-4 rounded-full bg-white absolute top-1 transition-all" style={{ left: form.is_closed ? "26px" : "4px" }} />
                </button>
              </div>
              <p className="text-white/40 text-xs">All financial features are disabled. Contact Administration shown to user.</p>
            </div>

            {onDelete && (
              <button onClick={onDelete} className="w-full py-3 rounded-2xl text-red-400 text-sm font-medium flex items-center justify-center gap-2 hover:bg-red-500/10 transition-colors" style={{ border: "1px solid rgba(239,68,68,0.2)" }}>
                <Trash2 size={16} /> Delete This Account
              </button>
            )}
          </div>
        )}
      </div>

      <div className="px-5 py-4 flex-shrink-0" style={{ borderTop: "1px solid rgba(255,255,255,0.08)" }}>
        <button onClick={handleSave} disabled={loading} className="gold-btn w-full py-3.5 text-sm font-semibold flex items-center justify-center gap-2">
          {loading ? <div className="w-5 h-5 border-2 border-gray-900/30 border-t-gray-900 rounded-full animate-spin" /> : <><Save size={16} /> Save Changes</>}
        </button>
      </div>
    </div>
  );
}

function F({ label, value, onChange, type = "text" }: { label: string; value: string; onChange: (v: string) => void; type?: string }) {
  return (
    <div>
      <label className="text-white/60 text-xs mb-1.5 block">{label}</label>
      <input type={type} className="dark-input" placeholder={label} value={value} onChange={e => onChange(e.target.value)} />
    </div>
  );
}
