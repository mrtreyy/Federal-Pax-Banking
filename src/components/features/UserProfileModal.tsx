import { useState } from "react";
import { X, User, CreditCard, MapPin, LogOut, Eye, EyeOff, Clock, Activity } from "lucide-react";
import type { Account } from "@/lib/supabase";
import { formatDateTime, getInitials } from "@/lib/utils";
import { useNavigate } from "react-router-dom";

interface Props {
  account: Account;
  onClose: () => void;
}

export default function UserProfileModal({ account, onClose }: Props) {
  const navigate = useNavigate();
  const [showPw, setShowPw] = useState(false);

  const handleLogout = () => {
    localStorage.removeItem("ghob_user_session");
    navigate("/");
  };

  return (
    <div className="fixed inset-0 z-50 flex flex-col" style={{ background: "hsl(220,45%,8%)" }}>
      <div className="flex items-center justify-between px-5 py-4 flex-shrink-0" style={{ background: "hsl(220,55%,13%)", borderBottom: "1px solid rgba(255,255,255,0.08)" }}>
        <div className="flex items-center gap-2">
          <User size={18} style={{ color: "hsl(43,85%,60%)" }} />
          <span className="text-white font-bold">My Profile</span>
        </div>
        <button onClick={onClose} className="text-white/40 hover:text-white p-1"><X size={20} /></button>
      </div>

      <div className="flex-1 overflow-y-auto">
        {/* Profile header */}
        <div className="flex flex-col items-center pt-8 pb-6 px-5" style={{ background: "hsl(220,55%,13%)", borderBottom: "1px solid rgba(255,255,255,0.06)" }}>
          {account.profile_picture ? (
            <img src={account.profile_picture} alt="" className="w-24 h-24 rounded-full object-cover mb-3" style={{ border: "3px solid hsl(43,85%,55%)" }} />
          ) : (
            <div className="w-24 h-24 rounded-full flex items-center justify-center text-2xl font-bold mb-3" style={{ background: "hsl(220,50%,22%)", color: "hsl(43,85%,60%)", border: "3px solid hsl(43,85%,55%)" }}>
              {getInitials(account.account_name)}
            </div>
          )}
          <div className="text-white font-bold text-xl">{account.account_name}</div>
          <div className="text-white/40 text-sm mt-0.5">{account.account_type}</div>
          {account.is_frozen && <span className="mt-2 text-blue-400 text-xs px-3 py-1 rounded-full" style={{ background: "rgba(59,130,246,0.15)" }}>❄️ Account Frozen</span>}
          {account.is_closed && <span className="mt-2 text-red-400 text-xs px-3 py-1 rounded-full" style={{ background: "rgba(239,68,68,0.15)" }}>✗ Account Closed</span>}
        </div>

        <div className="p-5 space-y-4">
          {/* Account Details */}
          <Section icon={CreditCard} title="Account Information">
            <Row label="Account Name" value={account.account_name} />
            <Row label="Account Number" value={account.account_number} mono />
            <Row label="Account Type" value={account.account_type} />
            <Row label="Currency" value={account.currency} />
            <Row label="Email" value={account.login_email} />
            <div className="flex justify-between py-2" style={{ borderBottom: "1px solid rgba(255,255,255,0.04)" }}>
              <span className="text-white/40 text-xs">Password</span>
              <div className="flex items-center gap-2">
                <span className="text-white text-xs font-medium">{showPw ? account.login_password : "••••••••"}</span>
                <button onClick={() => setShowPw(!showPw)} className="text-white/30 hover:text-white/60">
                  {showPw ? <EyeOff size={12} /> : <Eye size={12} />}
                </button>
              </div>
            </div>
          </Section>

          {/* Location */}
          {(account.address || account.state || account.country) && (
            <Section icon={MapPin} title="Location">
              {account.address && <Row label="Address" value={account.address} />}
              {account.state && <Row label="State" value={account.state} />}
              {account.country && <Row label="Country" value={account.country} />}
              {account.zipcode && <Row label="ZIP Code" value={account.zipcode} />}
              {account.phone && <Row label="Phone" value={account.phone} />}
            </Section>
          )}

          {/* Login Activity */}
          <Section icon={Activity} title="Login Activity">
            {account.last_login_at ? (
              <>
                <Row label="Last Login" value={formatDateTime(account.last_login_at)} />
                {account.last_login_device && <Row label="Device" value={account.last_login_device.slice(0, 60)} />}
              </>
            ) : (
              <div className="text-white/30 text-xs py-2">No login history available</div>
            )}
            <Row label="Account Created" value={formatDateTime(account.created_at)} />
          </Section>

          <button onClick={handleLogout}
            className="w-full py-3.5 rounded-2xl text-sm font-semibold flex items-center justify-center gap-2 transition-colors"
            style={{ background: "rgba(239,68,68,0.1)", color: "#f87171", border: "1px solid rgba(239,68,68,0.2)" }}>
            <LogOut size={16} /> Sign Out
          </button>
        </div>
      </div>
    </div>
  );
}

function Section({ icon: Icon, title, children }: { icon: React.ElementType; title: string; children: React.ReactNode }) {
  return (
    <div className="navy-card p-4">
      <div className="flex items-center gap-2 mb-3">
        <Icon size={15} style={{ color: "hsl(43,85%,60%)" }} />
        <span className="text-white/60 text-xs font-semibold uppercase tracking-wide">{title}</span>
      </div>
      {children}
    </div>
  );
}

function Row({ label, value, mono }: { label: string; value: string; mono?: boolean }) {
  return (
    <div className="flex justify-between items-start py-2" style={{ borderBottom: "1px solid rgba(255,255,255,0.04)" }}>
      <span className="text-white/40 text-xs flex-shrink-0 w-28">{label}</span>
      <span className={`text-white text-xs text-right font-medium break-all ml-2 ${mono ? "font-mono" : ""}`}>{value}</span>
    </div>
  );
}
