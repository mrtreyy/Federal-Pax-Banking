import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";
import bankLogo from "@/assets/bankunited-logo.jpg";
import { Eye, EyeOff, ArrowLeft, Crown } from "lucide-react";
import { trackLogin } from "@/lib/supabase";

const CAS_PASSWORD = "Ceoacess2026@#$";

export default function CASLogin() {
  const navigate = useNavigate();
  const [password, setPassword] = useState("");
  const [showPw, setShowPw] = useState(false);
  const [loading, setLoading] = useState(false);

  const handleLogin = (e: React.FormEvent) => {
    e.preventDefault();
    if (!password.trim()) { toast.error("Please enter the CEO access password."); return; }
    setLoading(true);
    setTimeout(async () => {
      if (password === CAS_PASSWORD) {
        localStorage.setItem("ghob_cas_session", JSON.stringify({ isCEO: true, loginTime: new Date().toISOString() }));
        await trackLogin("CEO", "cas");
        toast.success("CEO access granted. Welcome.");
        navigate("/cas/dashboard");
      } else {
        toast.error("Incorrect password. Access denied.");
        setLoading(false);
      }
    }, 900);
  };

  return (
    <div className="min-h-screen flex flex-col items-center justify-center px-5" style={{ background: "hsl(220,45%,8%)" }}>
      <div className="w-full max-w-sm">
        <button onClick={() => navigate("/admin")} className="flex items-center gap-2 text-white/40 hover:text-white/70 text-sm mb-8 transition-colors">
          <ArrowLeft size={16} /> Back
        </button>

        <div className="glass-card p-8">
          <div className="flex flex-col items-center mb-8">
            <div className="relative mb-4">
              <div className="w-16 h-16 rounded-2xl flex items-center justify-center" style={{ background: "linear-gradient(135deg, hsl(43,85%,55%), hsl(38,80%,42%))" }}>
                <Crown size={28} className="text-gray-900" />
              </div>
            </div>
            <h1 className="text-white font-bold text-lg text-center leading-tight">CEO Administrative<br />Access System</h1>
            <p className="text-white/40 text-xs mt-1">BankUnited · CAS</p>
          </div>

          <form onSubmit={handleLogin} className="space-y-4">
            <div>
              <label className="text-white/60 text-xs mb-1.5 block">CEO Access Password</label>
              <div className="relative">
                <input type={showPw ? "text" : "password"} className="dark-input pr-12" placeholder="Enter CEO access password"
                  value={password} onChange={(e) => setPassword(e.target.value)} />
                <button type="button" className="absolute right-4 top-1/2 -translate-y-1/2 text-white/40 hover:text-white/70" onClick={() => setShowPw(!showPw)}>
                  {showPw ? <EyeOff size={18} /> : <Eye size={18} />}
                </button>
              </div>
            </div>
            <button type="submit" disabled={loading} className="gold-btn w-full py-3.5 text-sm font-semibold flex items-center justify-center gap-2 min-h-[52px]">
              {loading ? <div className="w-5 h-5 border-2 border-gray-900/30 border-t-gray-900 rounded-full animate-spin" /> : <><Crown size={16} /> Access CEO System</>}
            </button>
          </form>

          <div className="mt-4 pt-4 border-t border-white/10">
            <div className="grid grid-cols-3 gap-2">
              {[
                { label: "Individual Portal", path: "/" },
                { label: "Admin Portal", path: "/admin" },
                { label: "AP Portal", path: "/ap/login" },
              ].map((btn) => (
                <button key={btn.path} onClick={() => navigate(btn.path)}
                  className="py-2 rounded-xl text-white/40 text-xs hover:text-white/60 transition-colors"
                  style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.06)" }}>
                  {btn.label}
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
