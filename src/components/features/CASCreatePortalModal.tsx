import { useState } from "react";
import { X, Upload, Eye, EyeOff, CheckCircle } from "lucide-react";
import { supabase, logAudit } from "@/lib/supabase";
import { toast } from "sonner";

type PortalType = "ap" | "adp";

interface Props {
  type: PortalType;
  onClose: () => void;
  onSuccess: () => void;
  parentApId?: string; // For creating ADP under a specific AP
}

const AP_TIER_CONFIGS = [
  { tier: 1, maxAdmins: 3, maxIndividual: 3, maxBalance: 21500000, label: "Tier 1" },
  { tier: 2, maxAdmins: 3, maxIndividual: 3, maxBalance: 42000000, label: "Tier 2" },
  { tier: 3, maxAdmins: 4, maxIndividual: 4, maxBalance: 85000000, label: "Tier 3" },
  { tier: 4, maxAdmins: 6, maxIndividual: 4, maxBalance: 150000000, label: "Tier 4" },
];

export default function CASCreatePortalModal({ type, onClose, onSuccess, parentApId }: Props) {
  const [name, setName] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPw, setShowPw] = useState(false);
  const [profilePicture, setProfilePicture] = useState("");
  const [uploading, setUploading] = useState(false);
  const [selectedTier, setSelectedTier] = useState(1);
  const [maxIndividual, setMaxIndividual] = useState("3");
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);

  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    const path = `profile-${Date.now()}.${file.name.split(".").pop()}`;
    const { data, error } = await supabase.storage.from("profiles").upload(path, file, { upsert: true });
    if (!error && data) {
      const { data: url } = supabase.storage.from("profiles").getPublicUrl(data.path);
      setProfilePicture(url.publicUrl);
      toast.success("Picture uploaded!");
    }
    setUploading(false);
  };

  const handleCreate = async () => {
    if (!name.trim()) { toast.error("Name is required."); return; }
    if (!password.trim()) { toast.error("Password is required."); return; }
    if (password.length < 6) { toast.error("Password must be at least 6 characters."); return; }
    if (password !== confirmPassword) { toast.error("Passwords do not match."); return; }

    setLoading(true);
    try {
      if (type === "ap") {
        const config = AP_TIER_CONFIGS.find(c => c.tier === selectedTier)!;
        const { error } = await supabase.from("administration_plus").insert({
          name: name.trim(),
          tier: selectedTier,
          password,
          profile_picture: profilePicture || null,
          max_admin_portals: config.maxAdmins,
          max_individual_per_admin: config.maxIndividual,
          max_balance: config.maxBalance,
        });
        if (error) throw error;
        await logAudit("ceo_create_ap", undefined, name.trim(), { tier: selectedTier }, "CEO", "cas");
      } else {
        const { error } = await supabase.from("sub_admin_portals").insert({
          name: name.trim(),
          password,
          profile_picture: profilePicture || null,
          created_by_ap: parentApId || null,
          max_individual: parseInt(maxIndividual) || 3,
        });
        if (error) throw error;
        await logAudit("ceo_create_adp", undefined, name.trim(), {}, "CEO", "cas");
      }

      setLoading(false);
      setSuccess(true);
      setTimeout(() => { onSuccess(); onClose(); }, 2000);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Failed to create.";
      toast.error(msg);
      setLoading(false);
    }
  };

  if (success) {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center px-4">
        <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" />
        <div className="relative w-full max-w-sm rounded-3xl p-8 flex flex-col items-center text-center" style={{ background: "hsl(220,50%,12%)", border: "1px solid rgba(255,255,255,0.1)" }}>
          <div className="w-16 h-16 rounded-full flex items-center justify-center mb-4" style={{ background: "rgba(34,197,94,0.15)" }}>
            <CheckCircle size={36} color="#22c55e" />
          </div>
          <h3 className="text-white font-bold text-lg mb-2">
            {type === "ap" ? "Administration Plus" : "Admin Portal"} Created!
          </h3>
          <p className="text-white/60 text-sm"><strong className="text-white">{name}</strong> is now active.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 z-50 flex flex-col" style={{ background: "hsl(220,45%,8%)" }}>
      <div className="flex items-center justify-between px-5 py-4 flex-shrink-0" style={{ background: "hsl(220,55%,13%)", borderBottom: "1px solid rgba(255,255,255,0.08)" }}>
        <div>
          <h3 className="text-white font-bold text-lg">
            Create {type === "ap" ? "Administration Plus" : "Admin Portal"}
          </h3>
          <div className="text-white/40 text-xs">CEO Administrative System</div>
        </div>
        <button onClick={onClose} className="text-white/40 hover:text-white"><X size={20} /></button>
      </div>

      <div className="flex-1 overflow-y-auto p-5 space-y-4">
        {/* Tier selector for AP */}
        {type === "ap" && (
          <div>
            <label className="text-white/60 text-xs mb-2 block">Administration Plus Tier</label>
            <div className="grid grid-cols-2 gap-2">
              {AP_TIER_CONFIGS.map(config => (
                <button key={config.tier} onClick={() => setSelectedTier(config.tier)}
                  className="p-3 rounded-2xl text-left transition-all"
                  style={selectedTier === config.tier ? {
                    background: "rgba(200,155,50,0.15)", border: "2px solid hsl(43,85%,55%)"
                  } : {
                    background: "rgba(255,255,255,0.04)", border: "2px solid rgba(255,255,255,0.08)"
                  }}>
                  <div className="text-white font-bold text-sm">{config.label}</div>
                  <div className="text-white/40 text-xs mt-0.5">Max {config.maxAdmins} admins</div>
                  <div className="text-white/40 text-xs">{config.maxIndividual} users each</div>
                  <div style={{ color: "hsl(43,85%,60%)" }} className="text-xs mt-0.5">
                    ${(config.maxBalance / 1000000).toFixed(1)}M limit
                  </div>
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Max individual for ADP */}
        {type === "adp" && (
          <div>
            <label className="text-white/60 text-xs mb-1.5 block">Max Individual Accounts</label>
            <input type="number" className="dark-input" value={maxIndividual} onChange={e => setMaxIndividual(e.target.value)} min="1" />
          </div>
        )}

        {/* Profile picture */}
        <div>
          <label className="text-white/60 text-xs mb-1.5 block">Profile Picture</label>
          <label className="flex items-center gap-3 cursor-pointer p-3 rounded-2xl" style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)" }}>
            <Upload size={16} style={{ color: "hsl(43,85%,60%)" }} />
            <span className="text-white/60 text-sm">{uploading ? "Uploading..." : profilePicture ? "Picture set ✓" : "Upload profile picture"}</span>
            <input type="file" accept="image/*" className="hidden" onChange={handleUpload} disabled={uploading} />
          </label>
          {profilePicture && <img src={profilePicture} alt="" className="w-14 h-14 rounded-full object-cover mt-2 border-2" style={{ borderColor: "hsl(43,85%,55%)" }} />}
        </div>

        {/* Name */}
        <div>
          <label className="text-white/60 text-xs mb-1.5 block">
            {type === "ap" ? "Administration Plus Name *" : "Admin Portal Name *"}
          </label>
          <input className="dark-input" placeholder={type === "ap" ? "e.g. Global Holdings AP" : "e.g. West Region Portal"} value={name} onChange={e => setName(e.target.value)} />
        </div>

        {/* Password */}
        <div>
          <label className="text-white/60 text-xs mb-1.5 block">Login Password *</label>
          <div className="relative">
            <input type={showPw ? "text" : "password"} className="dark-input pr-10" placeholder="Set login password" value={password} onChange={e => setPassword(e.target.value)} />
            <button type="button" className="absolute right-3 top-1/2 -translate-y-1/2 text-white/40" onClick={() => setShowPw(!showPw)}>
              {showPw ? <EyeOff size={16} /> : <Eye size={16} />}
            </button>
          </div>
        </div>

        <div>
          <label className="text-white/60 text-xs mb-1.5 block">Confirm Password *</label>
          <input type="password" className="dark-input" placeholder="Confirm password" value={confirmPassword} onChange={e => setConfirmPassword(e.target.value)} />
        </div>

        <div className="rounded-2xl p-3" style={{ background: "rgba(200,155,50,0.06)", border: "1px solid rgba(200,155,50,0.12)" }}>
          <p className="text-yellow-400/70 text-xs leading-relaxed">
            {type === "ap"
              ? `This password will be used on the Administration Plus login page under Tier ${selectedTier}.`
              : "This password will be used to log into the Admin Portal dashboard."}
          </p>
        </div>
      </div>

      <div className="px-5 py-4 flex-shrink-0" style={{ borderTop: "1px solid rgba(255,255,255,0.08)" }}>
        <button onClick={handleCreate} disabled={loading} className="gold-btn w-full py-3.5 text-sm font-semibold flex items-center justify-center gap-2">
          {loading ? <div className="w-5 h-5 border-2 border-gray-900/30 border-t-gray-900 rounded-full animate-spin" /> : `Create ${type === "ap" ? "Administration Plus" : "Admin Portal"}`}
        </button>
      </div>
    </div>
  );
}
