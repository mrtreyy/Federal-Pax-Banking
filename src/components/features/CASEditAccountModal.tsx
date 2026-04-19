import { useState } from "react";
import { X, Upload, Eye, EyeOff, RefreshCw } from "lucide-react";
import { supabase, type Account, type AdministrationPlus, type SubAdminPortal, logAudit } from "@/lib/supabase";
import { generateAccountNumber } from "@/lib/utils";
import { toast } from "sonner";

type EditTarget =
  | { type: "individual"; data: Account }
  | { type: "ap"; data: AdministrationPlus }
  | { type: "adp"; data: SubAdminPortal };

interface Props {
  target: EditTarget;
  onClose: () => void;
  onSuccess: () => void;
}

const ALL_CURRENCIES = [
  "USD","EUR","GBP","CAD","AUD","JPY","NGN","GHS","ZAR","CHF","CNY","INR",
  "MXN","BRL","KES","EGP","AED","SAR","SGD","HKD","NOK","SEK","DKK","NZD","THB",
  "CZK","HUF","PLN","RON","BGN","HRK","RSD","ISK","TRY","UAH","ILS","JOD","KWD",
  "QAR","OMR","BHD","MAD","TND","DZD","LYD","PKR","BDT","LKR","MMK","KHR","VND",
];
const ACCOUNT_TYPES = ["Savings Account","Checking Account","Current Account","Fixed Deposit Account","Business Account","Joint Account"];

export default function CASEditAccountModal({ target, onClose, onSuccess }: Props) {
  const [showPw, setShowPw] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [loading, setLoading] = useState(false);

  // Individual account form
  const [indForm, setIndForm] = useState(() =>
    target.type === "individual" ? {
      account_name: target.data.account_name,
      account_type: (target.data as Account).account_type,
      account_number: (target.data as Account).account_number,
      currency: (target.data as Account).currency,
      balance: String((target.data as Account).balance),
      login_email: (target.data as Account).login_email,
      login_password: (target.data as Account).login_password,
      transfer_pin: (target.data as Account).transfer_pin || "",
      profile_picture: target.data.profile_picture || "",
      phone: (target.data as Account).phone || "",
      address: (target.data as Account).address || "",
      state: (target.data as Account).state || "",
      country: (target.data as Account).country || "",
      zipcode: (target.data as Account).zipcode || "",
      id_info: (target.data as Account).id_info || "",
      balance_threshold: String((target.data as Account).balance_threshold || ""),
    } : {
      account_name: "", account_type: "", account_number: "", currency: "USD",
      balance: "0", login_email: "", login_password: "", transfer_pin: "",
      profile_picture: "", phone: "", address: "", state: "", country: "",
      zipcode: "", id_info: "", balance_threshold: "",
    }
  );

  // AP/ADP form
  const [portalForm, setPortalForm] = useState(() => ({
    name: target.data.name || (target.data as Account).account_name || "",
    password: target.data.password || (target.data as Account).login_password || "",
    profile_picture: target.data.profile_picture || "",
    tier: target.type === "ap" ? String((target.data as AdministrationPlus).tier) : "",
    max_admin_portals: target.type === "ap" ? String((target.data as AdministrationPlus).max_admin_portals) : "",
    max_individual_per_admin: target.type === "ap" ? String((target.data as AdministrationPlus).max_individual_per_admin) : "",
    max_individual: target.type === "adp" ? String((target.data as SubAdminPortal).max_individual) : "",
  }));

  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    const path = `profile-${Date.now()}.${file.name.split(".").pop()}`;
    const { data, error } = await supabase.storage.from("profiles").upload(path, file, { upsert: true });
    if (!error && data) {
      const { data: url } = supabase.storage.from("profiles").getPublicUrl(data.path);
      if (target.type === "individual") {
        setIndForm(f => ({ ...f, profile_picture: url.publicUrl }));
      } else {
        setPortalForm(f => ({ ...f, profile_picture: url.publicUrl }));
      }
      toast.success("Picture uploaded!");
    }
    setUploading(false);
  };

  const handleSave = async () => {
    setLoading(true);
    try {
      if (target.type === "individual") {
        const { error } = await supabase.from("banking_accounts").update({
          account_name: indForm.account_name.trim(),
          account_type: indForm.account_type,
          account_number: indForm.account_number,
          currency: indForm.currency,
          balance: parseFloat(indForm.balance) || 0,
          login_email: indForm.login_email.trim().toLowerCase(),
          login_password: indForm.login_password,
          transfer_pin: indForm.transfer_pin || null,
          profile_picture: indForm.profile_picture || null,
          phone: indForm.phone || null,
          address: indForm.address || null,
          state: indForm.state || null,
          country: indForm.country || null,
          zipcode: indForm.zipcode || null,
          id_info: indForm.id_info || null,
          balance_threshold: indForm.balance_threshold ? parseFloat(indForm.balance_threshold) : null,
          updated_at: new Date().toISOString(),
        }).eq("id", target.data.id);
        if (error) throw error;
        await logAudit("ceo_edit_individual", target.data.id, indForm.account_name, {}, "CEO", "cas");
      } else if (target.type === "ap") {
        const { error } = await supabase.from("administration_plus").update({
          name: portalForm.name.trim(),
          password: portalForm.password,
          profile_picture: portalForm.profile_picture || null,
          max_admin_portals: parseInt(portalForm.max_admin_portals) || 3,
          max_individual_per_admin: parseInt(portalForm.max_individual_per_admin) || 3,
        }).eq("id", target.data.id);
        if (error) throw error;
        await logAudit("ceo_edit_ap", target.data.id, portalForm.name, {}, "CEO", "cas");
      } else if (target.type === "adp") {
        const { error } = await supabase.from("sub_admin_portals").update({
          name: portalForm.name.trim(),
          password: portalForm.password,
          profile_picture: portalForm.profile_picture || null,
          max_individual: parseInt(portalForm.max_individual) || 3,
        }).eq("id", target.data.id);
        if (error) throw error;
        await logAudit("ceo_edit_adp", target.data.id, portalForm.name, {}, "CEO", "cas");
      }
      toast.success("Account updated successfully.");
      onSuccess();
      onClose();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Failed to update.";
      toast.error(msg);
    }
    setLoading(false);
  };

  const typeLabel = target.type === "individual" ? "Individual Account" : target.type === "ap" ? "Administration Plus" : "Admin Portal";

  return (
    <div className="fixed inset-0 z-50 flex flex-col" style={{ background: "hsl(220,45%,8%)" }}>
      <div className="flex items-center justify-between px-5 py-4 flex-shrink-0" style={{ background: "hsl(220,55%,13%)", borderBottom: "1px solid rgba(255,255,255,0.08)" }}>
        <div>
          <h3 className="text-white font-bold text-lg">Edit Account</h3>
          <div className="text-white/40 text-xs">{typeLabel} · CEO Override</div>
        </div>
        <button onClick={onClose} className="text-white/40 hover:text-white"><X size={20} /></button>
      </div>

      <div className="flex-1 overflow-y-auto p-5 space-y-4">
        {target.type === "individual" ? (
          <>
            {/* Profile picture */}
            <div>
              <label className="text-white/60 text-xs mb-1.5 block">Profile Picture</label>
              <label className="flex items-center gap-3 cursor-pointer p-3 rounded-2xl" style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)" }}>
                <Upload size={16} style={{ color: "hsl(43,85%,60%)" }} />
                <span className="text-white/60 text-sm">{uploading ? "Uploading..." : indForm.profile_picture ? "Picture set ✓" : "Upload picture"}</span>
                <input type="file" accept="image/*" className="hidden" onChange={handleUpload} disabled={uploading} />
              </label>
              {indForm.profile_picture && <img src={indForm.profile_picture} alt="" className="w-14 h-14 rounded-full object-cover mt-2 border-2" style={{ borderColor: "hsl(43,85%,55%)" }} />}
            </div>

            <F label="Account Name *" value={indForm.account_name} onChange={v => setIndForm(f => ({ ...f, account_name: v }))} />

            <div>
              <label className="text-white/60 text-xs mb-1.5 block">Account Type</label>
              <select className="dark-input" value={indForm.account_type} onChange={e => setIndForm(f => ({ ...f, account_type: e.target.value }))}>
                {ACCOUNT_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
              </select>
            </div>

            <div>
              <label className="text-white/60 text-xs mb-1.5 block">Account Number</label>
              <div className="flex gap-2">
                <input className="dark-input flex-1 font-mono text-sm" value={indForm.account_number} onChange={e => setIndForm(f => ({ ...f, account_number: e.target.value }))} />
                <button onClick={() => setIndForm(f => ({ ...f, account_number: generateAccountNumber() }))} className="px-3 rounded-2xl text-xs flex-shrink-0 flex items-center gap-1" style={{ background: "rgba(255,255,255,0.07)", color: "hsl(43,85%,60%)" }}>
                  <RefreshCw size={12} /> New
                </button>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-white/60 text-xs mb-1.5 block">Currency</label>
                <select className="dark-input" value={indForm.currency} onChange={e => setIndForm(f => ({ ...f, currency: e.target.value }))}>
                  {ALL_CURRENCIES.map(c => <option key={c} value={c}>{c}</option>)}
                </select>
              </div>
              <F label="Balance" value={indForm.balance} onChange={v => setIndForm(f => ({ ...f, balance: v }))} type="number" />
            </div>

            <F label="Login Email *" value={indForm.login_email} onChange={v => setIndForm(f => ({ ...f, login_email: v }))} type="email" />

            <div>
              <label className="text-white/60 text-xs mb-1.5 block">Login Password *</label>
              <div className="relative">
                <input type={showPw ? "text" : "password"} className="dark-input pr-10" value={indForm.login_password} onChange={e => setIndForm(f => ({ ...f, login_password: e.target.value }))} />
                <button type="button" className="absolute right-3 top-1/2 -translate-y-1/2 text-white/40" onClick={() => setShowPw(!showPw)}>
                  {showPw ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>
            </div>

            <div>
              <label className="text-white/60 text-xs mb-1.5 block">Transfer PIN (4 digits)</label>
              <input type="text" maxLength={4} className="dark-input tracking-widest text-center text-xl font-bold" placeholder="••••" value={indForm.transfer_pin} onChange={e => setIndForm(f => ({ ...f, transfer_pin: e.target.value.replace(/\D/g, "").slice(0, 4) }))} />
            </div>

            <F label="Phone" value={indForm.phone} onChange={v => setIndForm(f => ({ ...f, phone: v }))} />
            <F label="Address" value={indForm.address} onChange={v => setIndForm(f => ({ ...f, address: v }))} />
            <F label="State" value={indForm.state} onChange={v => setIndForm(f => ({ ...f, state: v }))} />
            <F label="Country" value={indForm.country} onChange={v => setIndForm(f => ({ ...f, country: v }))} />
            <F label="ZIP Code" value={indForm.zipcode} onChange={v => setIndForm(f => ({ ...f, zipcode: v }))} />
            <F label="ID Information" value={indForm.id_info} onChange={v => setIndForm(f => ({ ...f, id_info: v }))} />
            <F label="Balance Alert Threshold" value={indForm.balance_threshold} onChange={v => setIndForm(f => ({ ...f, balance_threshold: v }))} type="number" />
          </>
        ) : (
          <>
            <div>
              <label className="text-white/60 text-xs mb-1.5 block">Profile Picture</label>
              <label className="flex items-center gap-3 cursor-pointer p-3 rounded-2xl" style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)" }}>
                <Upload size={16} style={{ color: "hsl(43,85%,60%)" }} />
                <span className="text-white/60 text-sm">{uploading ? "Uploading..." : portalForm.profile_picture ? "Picture set ✓" : "Upload picture"}</span>
                <input type="file" accept="image/*" className="hidden" onChange={handleUpload} disabled={uploading} />
              </label>
              {portalForm.profile_picture && <img src={portalForm.profile_picture} alt="" className="w-14 h-14 rounded-full object-cover mt-2 border-2" style={{ borderColor: "hsl(43,85%,55%)" }} />}
            </div>

            <F label="Name *" value={portalForm.name} onChange={v => setPortalForm(f => ({ ...f, name: v }))} />

            <div>
              <label className="text-white/60 text-xs mb-1.5 block">Password *</label>
              <div className="relative">
                <input type={showPw ? "text" : "password"} className="dark-input pr-10" value={portalForm.password} onChange={e => setPortalForm(f => ({ ...f, password: e.target.value }))} />
                <button type="button" className="absolute right-3 top-1/2 -translate-y-1/2 text-white/40" onClick={() => setShowPw(!showPw)}>
                  {showPw ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>
            </div>

            {target.type === "ap" && (
              <>
                <F label="Max Admin Portals" value={portalForm.max_admin_portals} onChange={v => setPortalForm(f => ({ ...f, max_admin_portals: v }))} type="number" />
                <F label="Max Individual Per Admin" value={portalForm.max_individual_per_admin} onChange={v => setPortalForm(f => ({ ...f, max_individual_per_admin: v }))} type="number" />
              </>
            )}

            {target.type === "adp" && (
              <F label="Max Individual Accounts" value={portalForm.max_individual} onChange={v => setPortalForm(f => ({ ...f, max_individual: v }))} type="number" />
            )}
          </>
        )}
      </div>

      <div className="px-5 py-4 flex-shrink-0" style={{ borderTop: "1px solid rgba(255,255,255,0.08)" }}>
        <button onClick={handleSave} disabled={loading} className="gold-btn w-full py-3.5 text-sm font-semibold flex items-center justify-center gap-2">
          {loading ? <div className="w-5 h-5 border-2 border-gray-900/30 border-t-gray-900 rounded-full animate-spin" /> : "Save Changes"}
        </button>
      </div>
    </div>
  );
}

function F({ label, value, onChange, type = "text" }: { label: string; value: string; onChange: (v: string) => void; type?: string }) {
  return (
    <div>
      <label className="text-white/60 text-xs mb-1.5 block">{label}</label>
      <input type={type} className="dark-input" value={value} onChange={e => onChange(e.target.value)} />
    </div>
  );
}
