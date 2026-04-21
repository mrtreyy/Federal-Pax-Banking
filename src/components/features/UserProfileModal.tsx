import { useState } from "react";
import { X, Eye, EyeOff, Copy, Check } from "lucide-react";
import { type Account } from "@/lib/supabase";
import { toast } from "sonner";

interface Props {
  account: Account;
  onClose: () => void;
}

export default function UserProfileModal({ account, onClose }: Props) {
  const [showPassword, setShowPassword] = useState(false);
  const [copied, setCopied] = useState<string | null>(null);

  const copyToClipboard = (text: string, field: string) => {
    navigator.clipboard?.writeText(text);
    setCopied(field);
    toast.success(`${field} copied to clipboard`);
    setTimeout(() => setCopied(null), 2000);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center px-4 pb-4">
      <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" onClick={onClose} />
      <div className="relative w-full max-w-sm rounded-3xl overflow-hidden" style={{ background: "hsl(220,50%,12%)", border: "1px solid rgba(255,255,255,0.1)" }}>
        <div className="p-5 flex items-center justify-between" style={{ borderBottom: "1px solid rgba(255,255,255,0.08)" }}>
          <h3 className="text-white font-bold text-lg">My Profile</h3>
          <button onClick={onClose} className="text-white/40 hover:text-white p-1"><X size={20} /></button>
        </div>

        <div className="p-5 space-y-4 max-h-[80vh] overflow-y-auto">
          {/* Email */}
          <div>
            <label className="text-white/40 text-xs mb-1 block">Email</label>
            <div className="flex items-center gap-2">
              <span className="text-white text-sm flex-1 truncate">{account.login_email}</span>
              <button onClick={() => copyToClipboard(account.login_email, 'Email')} className="text-white/40 hover:text-white p-1">
                {copied === 'Email' ? <Check size={14} className="text-green-400" /> : <Copy size={14} />}
              </button>
            </div>
          </div>

          {/* Password */}
          <div>
            <label className="text-white/40 text-xs mb-1 block">Password</label>
            <div className="flex items-center gap-2">
              <span className="text-white text-sm flex-1 truncate">
                {showPassword ? account.login_password : '•'.repeat(8)}
              </span>
              <button onClick={() => setShowPassword(!showPassword)} className="text-white/40 hover:text-white p-1">
                {showPassword ? <EyeOff size={14} /> : <Eye size={14} />}
              </button>
              <button onClick={() => copyToClipboard(account.login_password, 'Password')} className="text-white/40 hover:text-white p-1">
                {copied === 'Password' ? <Check size={14} className="text-green-400" /> : <Copy size={14} />}
              </button>
            </div>
          </div>

          {/* Phone */}
          <div>
            <label className="text-white/40 text-xs mb-1 block">Phone</label>
            <div className="flex items-center gap-2">
              <span className="text-white text-sm flex-1 truncate">{account.phone || '—'}</span>
              {account.phone && (
                <button onClick={() => copyToClipboard(account.phone!, 'Phone')} className="text-white/40 hover:text-white p-1">
                  {copied === 'Phone' ? <Check size={14} className="text-green-400" /> : <Copy size={14} />}
                </button>
              )}
            </div>
          </div>

          {/* Location Section */}
          <div className="mt-4 pt-4 border-t border-white/10">
            <h3 className="text-white/60 text-xs font-semibold mb-3 uppercase tracking-wider flex items-center gap-1">
              <span>📍</span> Location
            </h3>
            <div className="space-y-3">
              <div>
                <label className="text-white/40 text-xs mb-1 block">Address</label>
                <div className="text-white text-sm">{account.address || 'Not provided'}</div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-white/40 text-xs mb-1 block">State</label>
                  <div className="text-white text-sm">{account.state || '—'}</div>
                </div>
                <div>
                  <label className="text-white/40 text-xs mb-1 block">Country</label>
                  <div className="text-white text-sm">{account.country || '—'}</div>
                </div>
              </div>
              <div>
                <label className="text-white/40 text-xs mb-1 block">ZIP Code</label>
                <div className="text-white text-sm">{account.zipcode || '—'}</div>
              </div>
            </div>
          </div>

          {/* ID Info */}
          <div className="mt-4 pt-4 border-t border-white/10">
            <h3 className="text-white/60 text-xs font-semibold mb-3 uppercase tracking-wider">ID Info</h3>
            <div className="text-white text-sm">{account.id_info || 'Not provided'}</div>
          </div>

          {/* Transfer PIN */}
          <div className="mt-4 pt-4 border-t border-white/10">
            <h3 className="text-white/60 text-xs font-semibold mb-3 uppercase tracking-wider">Transfer PIN</h3>
            <div className="flex items-center gap-2">
              <span className="text-white text-sm">{account.transfer_pin || 'Not set'}</span>
              {account.transfer_pin && (
                <button onClick={() => copyToClipboard(account.transfer_pin!, 'Transfer PIN')} className="text-white/40 hover:text-white p-1">
                  {copied === 'Transfer PIN' ? <Check size={14} className="text-green-400" /> : <Copy size={14} />}
                </button>
              )}
            </div>
          </div>

          {/* Login Activity Section */}
          <div className="mt-4 pt-4 border-t border-white/10">
            <h3 className="text-white/60 text-xs font-semibold mb-3 uppercase tracking-wider">👤 Login Activity</h3>
            <div className="space-y-3">
              <div className="flex justify-between items-center">
                <span className="text-white/40 text-xs">Last Login</span>
                <span className="text-white text-xs">
                  {account.last_login_at ? new Date(account.last_login_at).toLocaleString() : 'Never'}
                </span>
              </div>
              <div className="flex justify-between items-start">
                <span className="text-white/40 text-xs">Device</span>
                <span className="text-white text-xs text-right max-w-[180px] truncate">
                  {account.last_login_device || 'Unknown'}
                </span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-white/40 text-xs">Account Created</span>
                <span className="text-white text-xs">
                  {new Date(account.created_at).toLocaleDateString()}
                </span>
              </div>
            </div>
          </div>

          {/* Sign Out Button */}
          <button
            onClick={() => {
              localStorage.clear();
              window.location.href = '/';
            }}
            className="w-full mt-4 py-3 rounded-xl text-sm font-semibold text-red-400 hover:text-red-300"
            style={{ background: "rgba(239,68,68,0.1)", border: "1px solid rgba(239,68,68,0.2)" }}
          >
            Sign Out
          </button>
        </div>
      </div>
    </div>
  );
}