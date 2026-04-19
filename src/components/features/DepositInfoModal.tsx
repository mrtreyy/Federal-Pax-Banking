import { X, Bitcoin, Building2, Mail, Copy, CheckCheck } from "lucide-react";
import type { Account } from "@/lib/supabase";
import { useState } from "react";
import { toast } from "sonner";

interface Props {
  account: Account;
  onClose: () => void;
}

export default function DepositInfoModal({ account, onClose }: Props) {
  const [copied, setCopied] = useState<string | null>(null);

  const copyToClipboard = async (text: string, label: string) => {
    await navigator.clipboard.writeText(text);
    setCopied(label);
    toast.success(`${label} copied!`);
    setTimeout(() => setCopied(null), 2000);
  };

  const hasBtc = !!account.btc_address;
  const hasPaypal = !!account.paypal_email;
  const hasBank = !!(account.bank_name || account.bank_account_number);
  const hasAny = hasBtc || hasPaypal || hasBank;

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center px-4 pb-4">
      <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" onClick={onClose} />
      <div
        className="relative w-full max-w-sm rounded-3xl overflow-hidden"
        style={{ background: "hsl(220,50%,12%)", border: "1px solid rgba(255,255,255,0.1)" }}
      >
        <div className="p-5 flex items-center justify-between" style={{ borderBottom: "1px solid rgba(255,255,255,0.08)" }}>
          <div>
            <h3 className="text-white font-bold text-lg">Deposit Instructions</h3>
            <p className="text-white/40 text-xs">Send funds using any method below</p>
          </div>
          <button onClick={onClose} className="text-white/40 hover:text-white p-1">
            <X size={20} />
          </button>
        </div>

        <div className="p-5 space-y-4 max-h-[70vh] overflow-y-auto">
          {!hasAny && (
            <div className="text-center py-8">
              <p className="text-white/40 text-sm">No deposit information has been configured for this account.</p>
              <p className="text-white/25 text-xs mt-1">Please contact administration.</p>
            </div>
          )}

          {/* Bitcoin */}
          {hasBtc && (
            <div className="rounded-2xl p-4" style={{ background: "rgba(247,147,26,0.1)", border: "1px solid rgba(247,147,26,0.2)" }}>
              <div className="flex items-center gap-2 mb-3">
                <Bitcoin size={18} color="#F7931A" />
                <span className="text-white font-semibold text-sm">Bitcoin (BTC)</span>
              </div>
              <p className="text-white/50 text-xs mb-2">Send BTC to the address below:</p>
              <div className="flex items-center gap-2">
                <code className="text-white text-xs flex-1 break-all" style={{ fontFamily: "monospace" }}>
                  {account.btc_address}
                </code>
                <button
                  onClick={() => copyToClipboard(account.btc_address!, "BTC Address")}
                  className="flex-shrink-0 text-yellow-400 hover:text-yellow-300 transition-colors"
                >
                  {copied === "BTC Address" ? <CheckCheck size={16} /> : <Copy size={16} />}
                </button>
              </div>
            </div>
          )}

          {/* PayPal */}
          {hasPaypal && (
            <div className="rounded-2xl p-4" style={{ background: "rgba(0,112,201,0.1)", border: "1px solid rgba(0,112,201,0.2)" }}>
              <div className="flex items-center gap-2 mb-3">
                <Mail size={18} color="#00b2ff" />
                <span className="text-white font-semibold text-sm">PayPal</span>
              </div>
              <p className="text-white/50 text-xs mb-2">Send to PayPal email:</p>
              <div className="flex items-center gap-2">
                <span className="text-white text-sm flex-1">{account.paypal_email}</span>
                <button
                  onClick={() => copyToClipboard(account.paypal_email!, "PayPal Email")}
                  className="flex-shrink-0 text-blue-400 hover:text-blue-300 transition-colors"
                >
                  {copied === "PayPal Email" ? <CheckCheck size={16} /> : <Copy size={16} />}
                </button>
              </div>
            </div>
          )}

          {/* Bank Transfer */}
          {hasBank && (
            <div className="rounded-2xl p-4" style={{ background: "rgba(34,197,94,0.1)", border: "1px solid rgba(34,197,94,0.2)" }}>
              <div className="flex items-center gap-2 mb-3">
                <Building2 size={18} color="#22c55e" />
                <span className="text-white font-semibold text-sm">Bank Transfer</span>
              </div>
              <div className="space-y-2">
                {account.bank_name && (
                  <div className="flex justify-between items-center">
                    <span className="text-white/50 text-xs">Bank Name</span>
                    <span className="text-white text-xs font-medium">{account.bank_name}</span>
                  </div>
                )}
                {account.bank_account_number && (
                  <div className="flex justify-between items-center">
                    <span className="text-white/50 text-xs">Account No.</span>
                    <div className="flex items-center gap-2">
                      <span className="text-white text-xs font-medium">{account.bank_account_number}</span>
                      <button
                        onClick={() => copyToClipboard(account.bank_account_number!, "Account Number")}
                        className="text-green-400 hover:text-green-300 transition-colors"
                      >
                        {copied === "Account Number" ? <CheckCheck size={14} /> : <Copy size={14} />}
                      </button>
                    </div>
                  </div>
                )}
                {account.bank_routing && (
                  <div className="flex justify-between items-center">
                    <span className="text-white/50 text-xs">Routing No.</span>
                    <div className="flex items-center gap-2">
                      <span className="text-white text-xs font-medium">{account.bank_routing}</span>
                      <button
                        onClick={() => copyToClipboard(account.bank_routing!, "Routing Number")}
                        className="text-green-400 hover:text-green-300 transition-colors"
                      >
                        {copied === "Routing Number" ? <CheckCheck size={14} /> : <Copy size={14} />}
                      </button>
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}

          <div
            className="rounded-2xl p-3 text-center"
            style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.06)" }}
          >
            <p className="text-white/40 text-xs">
              After making your deposit, your balance will be updated by administration.
              Contact support if you have any issues.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
