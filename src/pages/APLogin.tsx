import { useState, useEffect } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { toast } from "sonner";
import bankLogo from "@/assets/bankunited-logo.png";
import { Eye, EyeOff, ArrowLeft, ShieldCheck } from "lucide-react";
import { supabase, trackLogin, type AdministrationPlus } from "@/lib/supabase";

const TIER_CONFIG = {
  1: { label: "Tier 1", maxAdminPortals: 3, maxIndividualPerAdmin: 2, maxBalance: 2100000 },
  2: { label: "Tier 2", maxAdminPortals: 3, maxIndividualPerAdmin: 3, maxBalance: 42000000 },
  3: { label: "Tier 3", maxAdminPortals: 4, maxIndividualPerAdmin: 4, maxBalance: 85000000 },
  4: { label: "Tier 4", maxAdminPortals: 6, maxIndividualPerAdmin: 4, maxBalance: 150000000 },
};

export default function APLogin() {
  const navigate = useNavigate();
  const location = useLocation();
  const [tier, setTier] = useState<number>((location.state as { tier?: number })?.tier || 1);
  const [password, setPassword] = useState("");
  const [showPw, setShowPw] = useState(false);
  const [loading, setLoading] = useState(false);
  const [apAccounts, setApAccounts] = useState<AdministrationPlus[]>([]);

  useEffect(() => {
    supabase.from("administration_plus").select("*").eq("tier", tier).then(({ data }) => {
      if (data) setApAccounts(data);
    });
  }, [tier]);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!password.trim()) { toast.error("Please enter your password."); return; }
    setLoading(true);
    const { data, error } = await supabase.from("administration_plus").select("*").eq("tier", tier).eq("password", password.trim()).single();
    if (error || !data) {
      toast.error("Incorrect password. Access denied.");
      setLoading(false);
      return;
    }
    localStorage.setItem("ghob_ap_session", JSON.stringify({ ...data, tier }));
    await trackLogin(data.name, `administration_plus_tier${tier}`, data.id);
    toast.success(`Welcome, ${data.name}!`);
    navigate("/ap/dashboard");
  };

  const cfg = TIER_CONFIG[tier as keyof typeof TIER_CONFIG];

  return (
    <div className="min-h-screen flex flex-col items-center justify-center px-5" style={{ background: "hsl(220,45%,8%)" }}>
      <div className="w-full max-w-sm">
        <button onClick={() => navigate("/admin")} className="flex items-center gap-2 text-white/40 hover:text-white/70 text-sm mb-8 transition-colors">
          <ArrowLeft size={16} /> Back
        </button>

        <div className="glass-card p-8">
          <div className="flex flex-col items-center mb-6">
            <img src={bankLogo} alt="BankUnited" className="w-14 h-14 rounded-2xl mb-3 bg-white p-1" />
            <h1 className="text-white font-bold text-lg text-center leading-tight">Administration Plus</h1>
            <p className="text-white/40 text-xs mt-1">BankUnited</p>
          </div>

          {/* Tier selector */}
          <div className="grid grid-cols-4 gap-1.5 mb-5">
            {[1, 2, 3, 4].map((t) => (
              <button key={t} onClick={() => setTier(t)}
                className="py-2 rounded-xl text-xs font-semibold transition-all"
                style={tier === t ? { background: "hsl(43,85%,55%)", color: "#111" } : { background: "rgba(255,255,255,0.07)", color: "rgba(255,255,255,0.5)" }}>
                Tier {t}
              </button>
            ))}
          </div>

          {cfg && (
            <div className="rounded-2xl p-3 mb-4 text-xs space-y-1" style={{ background: "rgba(200,155,50,0.06)", border: "1px solid rgba(200,155,50,0.15)" }}>
              <div className="flex justify-between"><span className="text-white/40">Max Admin Portals</span><span className="text-yellow-400 font-semibold">{cfg.maxAdminPortals}</span></div>
              <div className="flex justify-between"><span className="text-white/40">Max Individuals/Admin</span><span className="text-yellow-400 font-semibold">{cfg.maxIndividualPerAdmin}</span></div>
              <div className="flex justify-between"><span className="text-white/40">Max Balance Across All</span><span className="text-yellow-400 font-semibold">${cfg.maxBalance.toLocaleString()}</span></div>
            </div>
          )}

          <form onSubmit={handleLogin} className="space-y-4">
            <div>
              <label className="text-white/60 text-xs mb-1.5 block">Administration Plus Password</label>
              <div className="relative">
                <input type={showPw ? "text" : "password"} className="dark-input pr-12" placeholder="Enter AP password"
                  value={password} onChange={(e) => setPassword(e.target.value)} />
                <button type="button" className="absolute right-4 top-1/2 -translate-y-1/2 text-white/40 hover:text-white/70" onClick={() => setShowPw(!showPw)}>
                  {showPw ? <EyeOff size={18} /> : <Eye size={18} />}
                </button>
              </div>
            </div>
            <button type="submit" disabled={loading} className="gold-btn w-full py-3.5 text-sm font-semibold flex items-center justify-center gap-2 min-h-[52px]">
              {loading ? <div className="w-5 h-5 border-2 border-gray-900/30 border-t-gray-900 rounded-full animate-spin" /> : <><ShieldCheck size={16} /> Access Tier {tier} Portal</>}
            </button>
          </form>
          <div className="mt-4 pt-4 border-t border-white/10 text-center">
            <p className="text-white/20 text-xs">BankUnited · Administration Plus</p>
          </div>
        </div>
      </div>
    </div>
  );
}
