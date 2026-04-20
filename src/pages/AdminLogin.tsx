import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";
import bankLogo from "@/assets/bankunited-logo.jpg";
import { Eye, EyeOff, ArrowLeft, ShieldCheck } from "lucide-react";
import { trackLogin } from "@/lib/supabase";

const ADMIN_PASSWORD = "adminportal2026@#$";

export default function AdminLogin() {
  const navigate = useNavigate();
  const [password, setPassword] = useState("");
  const [showPw, setShowPw] = useState(false);
  const [loading, setLoading] = useState(false);
  const [showCEOMenu, setShowCEOMenu] = useState(false);

  const handleLogin = (e: React.FormEvent) => {
    e.preventDefault();
    if (!password.trim()) { toast.error("Please enter the administration password."); return; }
    setLoading(true);
    setTimeout(async () => {
      if (password === ADMIN_PASSWORD) {
        localStorage.setItem("ghob_admin_session", JSON.stringify({ isAdmin: true, loginTime: new Date().toISOString() }));
        await trackLogin("Administrator", "admin_portal");
        toast.success("Access granted. Welcome, Administrator.");
        navigate("/admin/dashboard");
      } else {
        toast.error("Incorrect password. Access denied.");
        setLoading(false);
      }
    }, 900);
  };

  return (
    <div className="min-h-screen flex flex-col items-center justify-center px-5" style={{ background: "hsl(220,45%,8%)" }}>
      <div className="w-full max-w-sm">
        <div className="flex justify-between items-start mb-8">
          <button onClick={() => navigate("/")} className="flex items-center gap-2 text-white/40 hover:text-white/70 text-sm transition-colors">
            <ArrowLeft size={16} /> Back to Portal
          </button>
          <div className="relative">
            <button
              onClick={() => setShowCEOMenu(!showCEOMenu)}
              className="text-white/25 hover:text-white/50 transition-colors"
              style={{ fontSize: "11px" }}
            >
              CEO Access
            </button>
            {showCEOMenu && (
              <div className="absolute right-0 top-6 z-50 rounded-2xl overflow-hidden shadow-2xl" style={{ background: "hsl(220,55%,14%)", border: "1px solid rgba(255,255,255,0.1)", minWidth: 220 }}>
                <div className="px-4 py-3" style={{ borderBottom: "1px solid rgba(255,255,255,0.08)" }}>
                  <div className="flex items-center gap-2 mb-1">
                    <img src={bankLogo} alt="BankUnited" className="w-6 h-6 rounded-lg bg-white p-0.5" />
                    <span className="text-white text-xs font-bold">BankUnited</span>
                  </div>
                  <div className="text-white/30 text-xs">CEO Administrative Access</div>
                </div>
                {[
                  { label: "Administration Plus · Tier 1", path: "/ap/login", tier: 1 },
                  { label: "Administration Plus · Tier 2", path: "/ap/login", tier: 2 },
                  { label: "Administration Plus · Tier 3", path: "/ap/login", tier: 3 },
                  { label: "Administration Plus · Tier 4", path: "/ap/login", tier: 4 },
                ].map((item) => (
                  <button key={item.tier} onClick={() => { setShowCEOMenu(false); navigate(item.path, { state: { tier: item.tier } }); }}
                    className="w-full text-left px-4 py-3 hover:bg-white/5 transition-colors"
                    style={{ borderBottom: "1px solid rgba(255,255,255,0.05)" }}>
                    <div className="text-white text-xs font-medium">{item.label}</div>
                  </button>
                ))}
                <button onClick={() => { setShowCEOMenu(false); navigate("/cas/login"); }}
                  className="w-full text-left px-4 py-3 hover:bg-white/5 transition-colors">
                  <div className="text-yellow-400 text-xs font-semibold">CEO Administrative System (CAS)</div>
                </button>
              </div>
            )}
          </div>
        </div>

        <div className="glass-card p-8">
          <div className="flex flex-col items-center mb-8">
            <div className="relative mb-4">
              <img src={bankLogo} alt="BankUnited" className="w-16 h-16 rounded-2xl bg-white p-1" />
              <div className="absolute -bottom-1 -right-1 w-6 h-6 rounded-full flex items-center justify-center" style={{ background: "hsl(43,85%,55%)" }}>
                <ShieldCheck size={13} className="text-gray-900" />
              </div>
            </div>
            <h1 className="text-white font-bold text-lg text-center leading-tight">Business Directory<br />Administration Portal</h1>
            <p className="text-white/40 text-xs mt-1">BankUnited — Authorized Personnel Only</p>
          </div>

          <form onSubmit={handleLogin} className="space-y-4">
            <div>
              <label className="text-white/60 text-xs mb-1.5 block">Administration Password</label>
              <div className="relative">
                <input type={showPw ? "text" : "password"} className="dark-input pr-12" placeholder="Enter administration password"
                  value={password} onChange={(e) => setPassword(e.target.value)} autoComplete="current-password" />
                <button type="button" className="absolute right-4 top-1/2 -translate-y-1/2 text-white/40 hover:text-white/70" onClick={() => setShowPw(!showPw)}>
                  {showPw ? <EyeOff size={18} /> : <Eye size={18} />}
                </button>
              </div>
            </div>
            <button type="submit" disabled={loading} className="gold-btn w-full py-3.5 text-sm font-semibold flex items-center justify-center gap-2 min-h-[52px] mt-2">
              {loading ? <div className="w-5 h-5 border-2 border-gray-900/30 border-t-gray-900 rounded-full animate-spin" /> : <><ShieldCheck size={16} /> Access Administration Portal</>}
            </button>
          </form>

          <div className="mt-6 pt-4 border-t border-white/10 text-center">
            <p className="text-white/20 text-xs">BankUnited · Secure Administration</p>
          </div>
        </div>
      </div>
    </div>
  );
}
