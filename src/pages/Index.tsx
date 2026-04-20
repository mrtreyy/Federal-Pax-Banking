import { useState, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { supabase, trackLogin } from "@/lib/supabase";
import { toast } from "sonner";
import bankHero from "@/assets/bank-hero.jpg";
import bankLogo from "@/assets/bankunited-logo.jpg";
import { Eye, EyeOff, Star, Shield, Globe, Lock, CheckCircle, XCircle, RefreshCw, Building2, TrendingUp, MapPin } from "lucide-react";

const testimonials = [
  {
    name: "James Whitfield",
    title: "Business Executive",
    avatar: "https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=80&h=80&fit=crop&crop=face",
    text: "Overall very satisfied with BankUnited. The app is clean and easy to navigate. I had a slight delay with a transfer once, it took about an hour longer than expected, but customer service was responsive and kept me updated. Not perfect but definitely reliable. I trust them with my finances.",
    stars: 4,
  },
  {
    name: "Sophia Laurent",
    title: "Healthcare Director",
    avatar: "https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=80&h=80&fit=crop&crop=face",
    text: "I've been with BankUnited for three years now. The online platform is fast and intuitive. Transfers, bill payments, everything just works. What really impressed me was how their support team handled a duplicate charge issue. They resolved it within hours and followed up personally. That kind of care is rare these days. Highly recommend.",
    stars: 5,
  },
  {
    name: "Marcus Okonkwo",
    title: "International Consultant",
    avatar: "https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?w=80&h=80&fit=crop&crop=face",
    text: "Honest review. The platform is great when it works. I did experience a delay with a cheque book shipment. It took nearly two weeks when I was quoted five days. Frustrating at the time but they comped the fee and apologized. The actual banking features are good. I'm satisfied, just not blown away.",
    stars: 3,
  },
  {
    name: "Elena Vasquez",
    title: "Investment Analyst",
    avatar: "https://images.unsplash.com/photo-1438761681033-6461ffad8d80?w=80&h=80&fit=crop&crop=face",
    text: "As a small business owner, BankUnited has been a game changer. Multi currency support lets me pay international suppliers without hidden fees or delays. The dashboard gives me full visibility and I can set custom alerts for large payments. It's built for people who value their time and money.",
    stars: 5,
  },
  {
    name: "David Chen",
    title: "Tech Entrepreneur",
    avatar: "https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=80&h=80&fit=crop&crop=face",
    text: "I switched from a traditional bank six months ago and haven't looked back. Everything is digital and smooth. I'm only giving four stars because I'd love to see more customization in the notification settings. That said, the core banking features are solid and I've never had a security concern.",
    stars: 4,
  },
];

const features = [
  { icon: Shield, label: "Bank-Grade Security", desc: "256-bit encryption on all transactions" },
  { icon: Globe, label: "Global Access", desc: "Available from anywhere in the world" },
  { icon: Lock, label: "Private & Secure", desc: "Your data is always protected" },
];

const bankStats = [
  { icon: Building2, label: "Headquarters", value: "Miami Lakes, Florida" },
  { icon: TrendingUp, label: "Stock", value: "NYSE: BKU (Russell 1000, S&P 600)" },
  { icon: MapPin, label: "Total Assets", value: "$35.0 billion (December 2025)" },
];

// CAPTCHA types
type VehicleType = "bicycle" | "bus" | "car" | "school-bus";
interface CaptchaItem {
  type: VehicleType;
  emoji: string;
  label: string;
  bg: string;
}

const VEHICLE_EMOJIS: CaptchaItem[] = [
  { type: "bicycle", emoji: "🚲", label: "Bicycle", bg: "rgba(34,197,94,0.15)" },
  { type: "bus", emoji: "🚌", label: "Bus", bg: "rgba(59,130,246,0.15)" },
  { type: "car", emoji: "🚗", label: "Car", bg: "rgba(239,68,68,0.15)" },
  { type: "school-bus", emoji: "🚐", label: "School Bus", bg: "rgba(234,179,8,0.18)" },
];

function generateCaptcha(): { grid: CaptchaItem[]; target: VehicleType } {
  const targets: VehicleType[] = ["bicycle", "bus", "car", "school-bus"];
  const target = targets[Math.floor(Math.random() * targets.length)];
  const grid: CaptchaItem[] = [];
  const targetCount = Math.floor(Math.random() * 3) + 2;
  for (let i = 0; i < 9; i++) {
    if (i < targetCount) {
      grid.push({ ...VEHICLE_EMOJIS.find(v => v.type === target)! });
    } else {
      const others = VEHICLE_EMOJIS.filter(v => v.type !== target);
      grid.push({ ...others[Math.floor(Math.random() * others.length)] });
    }
  }
  for (let i = grid.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [grid[i], grid[j]] = [grid[j], grid[i]];
  }
  return { grid, target };
}

export default function Index() {
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPw, setShowPw] = useState(false);
  const [loading, setLoading] = useState(false);

  const [showCaptcha, setShowCaptcha] = useState(false);
  const [captcha, setCaptcha] = useState(() => generateCaptcha());
  const [selected, setSelected] = useState<Set<number>>(new Set());
  const [captchaError, setCaptchaError] = useState(false);
  const [captchaPassed, setCaptchaPassed] = useState(false);
  const [pendingLogin, setPendingLogin] = useState<{ data: Record<string, unknown> } | null>(null);

  const refreshCaptcha = useCallback(() => {
    setCaptcha(generateCaptcha());
    setSelected(new Set());
    setCaptchaError(false);
  }, []);

  const toggleSelect = (idx: number) => {
    setSelected(prev => {
      const next = new Set(prev);
      if (next.has(idx)) next.delete(idx);
      else next.add(idx);
      return next;
    });
    setCaptchaError(false);
  };

  const verifyCaptcha = () => {
    const allTargetsSelected = captcha.grid.every((item, i) => {
      if (item.type === captcha.target) return selected.has(i);
      return !selected.has(i);
    });

    if (allTargetsSelected) {
      setCaptchaPassed(true);
      setTimeout(() => {
        if (pendingLogin) completeLogin(pendingLogin.data);
      }, 600);
    } else {
      setCaptchaError(true);
      setTimeout(() => refreshCaptcha(), 1000);
    }
  };

  const completeLogin = async (data: Record<string, unknown>) => {
    localStorage.setItem("ghob_user_session", JSON.stringify(data));
    await trackLogin(data.account_name as string, "individual_directive_user", data.id as string);
    await supabase.from("banking_accounts").update({
      last_login_at: new Date().toISOString(),
      last_login_device: navigator.userAgent.slice(0, 100),
      updated_at: new Date().toISOString(),
    }).eq("id", data.id as string);
    toast.success(`Welcome back, ${data.account_name}!`);
    navigate("/dashboard");
  };

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim() || !password.trim()) { toast.error("Please enter your email and password."); return; }
    setLoading(true);
    try {
      const { data, error } = await supabase.from("banking_accounts").select("*").eq("login_email", email.trim().toLowerCase()).single();
      if (error || !data) { toast.error("Invalid credentials. Please try again."); setLoading(false); return; }
      if (data.login_password !== password) { toast.error("Invalid credentials. Please try again."); setLoading(false); return; }
      setPendingLogin({ data });
      setCaptchaPassed(false);
      refreshCaptcha();
      setShowCaptcha(true);
      setLoading(false);
    } catch {
      toast.error("Login failed. Please try again.");
      setLoading(false);
    }
  };

  if (showCaptcha && !captchaPassed) {
    const targetLabel = VEHICLE_EMOJIS.find(v => v.type === captcha.target)?.label || "";
    return (
      <div className="min-h-screen flex items-center justify-center px-5" style={{ background: "hsl(220,45%,8%)" }}>
        <div className="w-full max-w-sm">
          <div className="glass-card p-6">
            <div className="text-center mb-5">
              <div className="w-14 h-14 rounded-2xl flex items-center justify-center mx-auto mb-3" style={{ background: "rgba(200,155,50,0.1)", border: "1px solid rgba(200,155,50,0.2)" }}>
                <Shield size={28} style={{ color: "hsl(43,85%,60%)" }} />
              </div>
              <h2 className="text-white font-bold text-lg">Security Verification</h2>
              <p className="text-white/50 text-sm mt-1">Confirm you're not a bot</p>
            </div>
            <div className="rounded-2xl p-4 mb-4 text-center" style={{ background: "rgba(200,155,50,0.08)", border: "1px solid rgba(200,155,50,0.15)" }}>
              <p className="text-white/70 text-sm">Select all images containing a</p>
              <p className="text-white font-bold text-xl mt-1">{VEHICLE_EMOJIS.find(v => v.type === captcha.target)?.emoji} {targetLabel}</p>
            </div>
            {captchaError && (
              <div className="flex items-center gap-2 p-3 rounded-2xl mb-3" style={{ background: "rgba(239,68,68,0.1)", border: "1px solid rgba(239,68,68,0.2)" }}>
                <XCircle size={16} color="#f87171" />
                <span className="text-red-400 text-sm">Try again — incorrect selection</span>
              </div>
            )}
            <div className="grid grid-cols-3 gap-2 mb-4">
              {captcha.grid.map((item, idx) => {
                const isSel = selected.has(idx);
                return (
                  <button key={idx} onClick={() => toggleSelect(idx)}
                    className="aspect-square rounded-2xl flex items-center justify-center text-4xl relative transition-all"
                    style={{ background: isSel ? "rgba(200,155,50,0.2)" : "rgba(255,255,255,0.04)", border: isSel ? "2px solid hsl(43,85%,55%)" : "2px solid rgba(255,255,255,0.08)", transform: isSel ? "scale(0.95)" : "scale(1)" }}>
                    {item.emoji}
                    {isSel && <div className="absolute top-1 right-1 w-5 h-5 rounded-full flex items-center justify-center" style={{ background: "hsl(43,85%,55%)" }}><CheckCircle size={12} className="text-gray-900" /></div>}
                  </button>
                );
              })}
            </div>
            <p className="text-white/30 text-xs text-center mb-4">Click all squares with a {targetLabel}. Click Verify when done.</p>
            <div className="grid grid-cols-2 gap-3">
              <button onClick={refreshCaptcha} className="flex items-center justify-center gap-2 py-3 rounded-2xl text-sm font-medium" style={{ background: "rgba(255,255,255,0.07)", color: "rgba(255,255,255,0.6)" }}>
                <RefreshCw size={14} /> Refresh
              </button>
              <button onClick={verifyCaptcha} className="gold-btn py-3 text-sm font-semibold">Verify</button>
            </div>
            <button onClick={() => { setShowCaptcha(false); setPendingLogin(null); }} className="w-full text-center text-white/30 text-xs mt-4 hover:text-white/50">Cancel Login</button>
          </div>
        </div>
      </div>
    );
  }

  if (captchaPassed) {
    return (
      <div className="min-h-screen flex items-center justify-center px-5" style={{ background: "hsl(220,45%,8%)" }}>
        <div className="flex flex-col items-center gap-4">
          <div className="w-16 h-16 rounded-full flex items-center justify-center" style={{ background: "rgba(34,197,94,0.15)" }}>
            <CheckCircle size={36} color="#22c55e" />
          </div>
          <div className="text-white font-bold text-lg">Verification Passed</div>
          <div className="text-white/40 text-sm">Signing you in...</div>
          <div className="w-6 h-6 border-2 border-yellow-500/30 border-t-yellow-500 rounded-full animate-spin" />
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen" style={{ background: "hsl(220,45%,8%)" }}>
      {/* Hero Section */}
      <div className="relative w-full" style={{ minHeight: "60vh" }}>
        <img src={bankHero} alt="BankUnited" className="w-full object-cover" style={{ height: "60vh", objectPosition: "center" }} />
        <div className="absolute inset-0 flex flex-col" style={{ background: "linear-gradient(to bottom, rgba(10,20,60,0.7) 0%, rgba(10,20,60,0.92) 100%)" }}>
          {/* Top bar */}
          <div className="flex items-center justify-between px-6 pt-8">
            <div className="flex items-center gap-3">
              <img src={bankLogo} alt="BankUnited" className="h-10 w-auto rounded-xl bg-white p-1" style={{ maxHeight: 48 }} />
            </div>
            <button onClick={() => navigate("/admin")} className="text-white/40 text-xs hover:text-white/70 transition-colors" style={{ fontSize: "11px" }}>
              Administration
            </button>
          </div>
          {/* Hero content */}
          <div className="flex-1 flex flex-col items-center justify-center text-center px-6 pb-8">
            <h1 className="text-white font-bold mb-3" style={{ fontSize: "clamp(1.8rem, 5vw, 3rem)", fontFamily: "'Inter', sans-serif" }}>
              Banking Built for{" "}
              <span style={{ color: "hsl(43,85%,60%)" }}>Everyone.</span>
            </h1>
            <p className="text-white/60 text-sm max-w-xs leading-relaxed">
              Access your account securely from anywhere. BankUnited — trusted by thousands worldwide.
            </p>
          </div>
        </div>
      </div>

      {/* Login Card */}
      <div className="px-5 -mt-8 relative z-10">
        <div className="glass-card p-6 max-w-md mx-auto">
          <div className="flex items-center gap-3 mb-4">
            <img src={bankLogo} alt="BankUnited" className="h-10 w-auto bg-white rounded-xl p-1" />
            <div>
              <h2 className="text-white font-bold text-lg leading-tight">Sign In</h2>
              <p className="text-white/40 text-xs">BankUnited — Individual Account Portal</p>
            </div>
          </div>
          <form onSubmit={handleLogin} className="space-y-4">
            <div>
              <label className="text-white/60 text-xs mb-1.5 block">Email Address</label>
              <input type="email" className="dark-input" placeholder="your@email.com" value={email} onChange={(e) => setEmail(e.target.value)} autoComplete="email" />
            </div>
            <div>
              <label className="text-white/60 text-xs mb-1.5 block">Password</label>
              <div className="relative">
                <input type={showPw ? "text" : "password"} className="dark-input pr-12" placeholder="Enter password" value={password} onChange={(e) => setPassword(e.target.value)} autoComplete="current-password" />
                <button type="button" className="absolute right-4 top-1/2 -translate-y-1/2 text-white/40 hover:text-white/70" onClick={() => setShowPw(!showPw)}>
                  {showPw ? <EyeOff size={18} /> : <Eye size={18} />}
                </button>
              </div>
            </div>
            <button type="submit" disabled={loading} className="gold-btn w-full py-3.5 text-sm font-semibold mt-2 flex items-center justify-center gap-2 min-h-[52px]">
              {loading ? <div className="w-5 h-5 border-2 border-gray-900/30 border-t-gray-900 rounded-full animate-spin" /> : "Sign In to My Account"}
            </button>
          </form>
          <p className="text-center text-white/25 text-xs mt-5">Protected by 256-bit bank-grade encryption</p>
        </div>
      </div>

      {/* Bank Info Section — below login, above reviews */}
      <div className="px-5 mt-8">
        <div className="max-w-md mx-auto rounded-3xl p-5 space-y-3" style={{ background: "hsl(220,50%,13%)", border: "1px solid rgba(255,255,255,0.08)" }}>
          <div className="flex items-center gap-2 mb-2">
            <img src={bankLogo} alt="BankUnited" className="h-7 w-auto bg-white rounded-lg p-0.5" />
            <div className="text-white font-bold text-sm">BankUnited</div>
            <div className="text-white/30 text-xs">|</div>
            <div className="text-white/40 text-xs">Public Bank Holding Company</div>
          </div>
          <div className="grid grid-cols-2 gap-2">
            {[
              { label: "Headquarters", value: "Miami Lakes, Florida" },
              { label: "Stock", value: "NYSE: BKU" },
              { label: "Index", value: "Russell 1000, S&P 600" },
              { label: "Total Assets", value: "$35.0B (Dec 2025)" },
            ].map(stat => (
              <div key={stat.label} className="rounded-2xl p-3" style={{ background: "rgba(255,255,255,0.04)" }}>
                <div className="text-white/40 text-xs">{stat.label}</div>
                <div className="text-white font-semibold text-xs mt-0.5">{stat.value}</div>
              </div>
            ))}
          </div>
          <div className="rounded-2xl p-3" style={{ background: "rgba(200,155,50,0.07)", border: "1px solid rgba(200,155,50,0.15)" }}>
            <div className="text-white/40 text-xs">Primary Markets</div>
            <div className="text-yellow-400/90 font-medium text-xs mt-0.5">Florida · New York Tri-State · Dallas · Atlanta · Charlotte</div>
          </div>
        </div>
      </div>

      {/* Features */}
      <div className="px-5 mt-6">
        <div className="max-w-md mx-auto grid grid-cols-3 gap-3">
          {features.map((f) => (
            <div key={f.label} className="navy-card p-3 text-center">
              <div className="flex justify-center mb-2"><f.icon size={22} style={{ color: "hsl(43,85%,60%)" }} /></div>
              <div className="text-white text-xs font-semibold mb-0.5">{f.label}</div>
              <div className="text-white/40 text-xs leading-tight">{f.desc}</div>
            </div>
          ))}
        </div>
      </div>

      {/* Testimonials */}
      <div className="px-5 mt-8 pb-12">
        <div className="max-w-md mx-auto">
          <h3 className="text-white/60 text-xs font-semibold uppercase tracking-wider mb-4 text-center">What Our Clients Say</h3>
          <div className="space-y-3">
            {testimonials.map((t) => (
              <div key={t.name} className="navy-card p-4 flex gap-3">
                <img src={t.avatar} alt={t.name} className="w-10 h-10 rounded-full object-cover flex-shrink-0 border-2" style={{ borderColor: "hsl(43,85%,55%)" }} />
                <div className="min-w-0">
                  <div className="flex items-center gap-1 mb-1">
                    {Array.from({ length: 5 }).map((_, i) => (
                      <Star key={i} size={10} fill={i < t.stars ? "hsl(43,85%,60%)" : "transparent"} color={i < t.stars ? "hsl(43,85%,60%)" : "rgba(255,255,255,0.2)"} />
                    ))}
                  </div>
                  <p className="text-white/70 text-xs leading-relaxed mb-1.5">"{t.text}"</p>
                  <div className="text-white text-xs font-semibold">{t.name}</div>
                  <div className="text-white/40 text-xs">{t.title}</div>
                </div>
              </div>
            ))}
          </div>
          <div className="text-center mt-8 pb-4">
            <div className="text-white/20 text-xs">© 2015 BankUnited. All rights reserved.</div>
          </div>
        </div>
      </div>
    </div>
  );
}
