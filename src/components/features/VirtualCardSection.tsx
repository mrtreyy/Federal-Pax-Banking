import { useState, useEffect } from "react";
import { CreditCard, Clock, CheckCircle, XCircle, Send, Shield, Wifi, RefreshCw } from "lucide-react";
import { supabase, type Account, type VirtualCardApplication } from "@/lib/supabase";
import { formatDateTime } from "@/lib/utils";
import { toast } from "sonner";
import { usePolling } from "@/hooks/usePolling";

interface Props {
  account: Account;
}

export default function VirtualCardSection({ account }: Props) {
  const [application, setApplication] = useState<VirtualCardApplication | null>(null);
  const [loading, setLoading] = useState(true);
  const [applying, setApplying] = useState(false);
  const [showApplyForm, setShowApplyForm] = useState(false);
  const [flipped, setFlipped] = useState(false);

  const fetchApplication = async () => {
    const { data } = await supabase
      .from("virtual_card_applications")
      .select("*")
      .eq("account_id", account.id)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    setApplication(data || null);
    setLoading(false);
  };

  useEffect(() => { fetchApplication(); }, [account.id]);
  usePolling(fetchApplication, 10000, true);

  const handleApply = async () => {
    setApplying(true);
    // Delete any previous declined application to reset trail
    if (application && application.status === "declined") {
      await supabase.from("virtual_card_applications").delete().eq("id", application.id);
    }

    const { error } = await supabase.from("virtual_card_applications").insert({
      account_id: account.id,
      account_name: account.account_name,
      account_number: account.account_number,
      status: "pending",
      decline_count: application?.status === "declined" ? (application.decline_count || 0) + 1 : 0,
    });

    if (error) { toast.error("Application failed. Please try again."); setApplying(false); return; }

    // Notify CAS
    await supabase.from("banking_notifications").insert({
      account_id: account.id,
      target: "cas",
      title: "Virtual Card Application",
      body: `${account.account_name} (${account.account_number}) has submitted a virtual card application and is awaiting CEO approval.`,
      is_read: false,
    });

    toast.success("Application submitted successfully. Estimated review: 2–3 business days.");
    setShowApplyForm(false);
    setApplying(false);
    fetchApplication();
  };

  if (loading) return (
    <div className="rounded-3xl p-5 flex items-center justify-center" style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.06)", minHeight: 80 }}>
      <div className="w-5 h-5 border-2 border-yellow-500/30 border-t-yellow-500 rounded-full animate-spin" />
    </div>
  );

  // ── APPROVED: Show the virtual card ──
  if (application?.status === "approved" && application.card_number) {
    const cardDigits = application.card_number.match(/.{1,4}/g) || [];
    return (
      <div className="space-y-3">
        <div className="flex items-center justify-between mb-1">
          <h3 className="text-white font-bold text-sm flex items-center gap-2">
            <CreditCard size={15} style={{ color: "hsl(43,85%,60%)" }} /> Virtual Card
          </h3>
          <span className="text-xs px-2 py-0.5 rounded-full font-semibold" style={{ background: "rgba(34,197,94,0.15)", color: "#22c55e" }}>Active</span>
        </div>

        {/* Card visual */}
        <div
          className="relative w-full cursor-pointer select-none"
          style={{ perspective: 900, height: 195 }}
          onClick={() => setFlipped(f => !f)}
        >
          <div
            className="absolute inset-0 transition-transform duration-500"
            style={{ transformStyle: "preserve-3d", transform: flipped ? "rotateY(180deg)" : "rotateY(0deg)" }}
          >
            {/* Front */}
            <div className="absolute inset-0 rounded-3xl p-6 flex flex-col justify-between overflow-hidden"
              style={{
                backfaceVisibility: "hidden",
                background: "linear-gradient(135deg, hsl(220,60%,22%) 0%, hsl(220,70%,14%) 55%, hsl(38,70%,30%) 100%)",
                border: "1px solid rgba(200,155,50,0.3)",
                boxShadow: "0 8px 32px rgba(0,0,0,0.5)",
              }}>
              {/* Shimmer */}
              <div className="absolute inset-0 opacity-20 rounded-3xl" style={{ background: "radial-gradient(ellipse at 70% 30%, rgba(200,155,50,0.5) 0%, transparent 60%)" }} />
              <div className="relative flex items-start justify-between">
                <div>
                  <div className="text-white/50 text-xs font-medium">{application.card_type || "Visa Virtual"}</div>
                  <div className="text-white/80 text-xs mt-0.5">BankUnited</div>
                </div>
                <Wifi size={20} style={{ color: "hsl(43,85%,60%)", transform: "rotate(90deg)" }} />
              </div>
              <div className="relative">
                <div className="w-10 h-7 rounded-md mb-3" style={{ background: "linear-gradient(135deg, hsl(43,85%,55%), hsl(38,70%,40%))" }} />
                <div className="flex items-center gap-3 font-mono text-white font-bold text-base tracking-widest">
                  {cardDigits.map((g, i) => (
                    <span key={i}>{i === 2 ? "••••" : g}</span>
                  ))}
                </div>
              </div>
              <div className="relative flex items-end justify-between">
                <div>
                  <div className="text-white/40 text-xs uppercase tracking-wide mb-0.5">Card Holder</div>
                  <div className="text-white font-semibold text-sm tracking-wide">{application.card_holder}</div>
                </div>
                <div className="text-right">
                  <div className="text-white/40 text-xs uppercase tracking-wide mb-0.5">Expires</div>
                  <div className="text-white font-semibold text-sm">{application.card_expiry}</div>
                </div>
                <div className="text-right">
                  <div style={{ color: "hsl(43,85%,60%)", fontWeight: 900, fontSize: 22, fontStyle: "italic", letterSpacing: -1 }}>VISA</div>
                </div>
              </div>
            </div>

            {/* Back */}
            <div className="absolute inset-0 rounded-3xl overflow-hidden flex flex-col justify-center"
              style={{
                backfaceVisibility: "hidden",
                transform: "rotateY(180deg)",
                background: "linear-gradient(135deg, hsl(220,55%,16%) 0%, hsl(220,65%,10%) 100%)",
                border: "1px solid rgba(200,155,50,0.2)",
              }}>
              <div className="w-full h-10 mt-4 mb-6" style={{ background: "rgba(0,0,0,0.5)" }} />
              <div className="px-6 flex items-center justify-between">
                <div className="flex-1 h-8 rounded-lg mr-3" style={{ background: "rgba(255,255,255,0.08)" }} />
                <div className="text-right">
                  <div className="text-white/40 text-xs mb-0.5">CVV</div>
                  <div className="text-white font-bold font-mono text-base tracking-widest">{application.card_cvv}</div>
                </div>
              </div>
              <div className="px-6 mt-4 text-center">
                <div className="text-white/20 text-xs">Tap card to flip · Virtual card for online use only</div>
                <div className="text-white/15 text-xs mt-1">© {new Date().getFullYear()} BankUnited</div>
              </div>
            </div>
          </div>
        </div>

        <div className="text-white/25 text-xs text-center">Tap card to reveal CVV · Virtual use only</div>

        <div className="grid grid-cols-2 gap-3">
          <div className="rounded-2xl p-3" style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.07)" }}>
            <div className="text-white/40 text-xs mb-0.5">Card Number</div>
            <div className="text-white font-mono text-xs font-semibold">{application.card_number}</div>
          </div>
          <div className="rounded-2xl p-3" style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.07)" }}>
            <div className="text-white/40 text-xs mb-0.5">Approved</div>
            <div className="text-white text-xs font-semibold">{application.reviewed_at ? formatDateTime(application.reviewed_at) : "—"}</div>
          </div>
        </div>
      </div>
    );
  }

  // ── PENDING ──
  if (application?.status === "pending") {
    return (
      <div className="rounded-3xl p-5 space-y-3" style={{ background: "rgba(200,155,50,0.05)", border: "1px solid rgba(200,155,50,0.2)" }}>
        <div className="flex items-center gap-3">
          <div className="w-11 h-11 rounded-2xl flex items-center justify-center flex-shrink-0" style={{ background: "rgba(200,155,50,0.15)" }}>
            <Clock size={20} style={{ color: "hsl(43,85%,60%)" }} />
          </div>
          <div>
            <div className="text-white font-bold text-sm">Virtual Card Application Pending</div>
            <div className="text-white/50 text-xs mt-0.5">Under review by administration</div>
          </div>
        </div>
        <div className="rounded-2xl p-3 space-y-1.5" style={{ background: "rgba(255,255,255,0.04)" }}>
          <div className="flex justify-between text-xs">
            <span className="text-white/40">Applied</span>
            <span className="text-white/70">{formatDateTime(application.applied_at)}</span>
          </div>
          <div className="flex justify-between text-xs">
            <span className="text-white/40">Estimated Review</span>
            <span style={{ color: "hsl(43,85%,60%)" }} className="font-semibold">2 – 3 Business Days</span>
          </div>
          <div className="flex justify-between text-xs">
            <span className="text-white/40">Status</span>
            <span className="text-yellow-400 font-semibold">● Awaiting CEO Approval</span>
          </div>
        </div>
        <div className="text-white/30 text-xs leading-relaxed">
          Your virtual card application is currently under review by BankUnited administration. You will receive a notification once a decision has been made.
        </div>
      </div>
    );
  }

  // ── DECLINED ──
  if (application?.status === "declined") {
    return (
      <div className="rounded-3xl p-5 space-y-3" style={{ background: "rgba(239,68,68,0.05)", border: "1px solid rgba(239,68,68,0.2)" }}>
        <div className="flex items-center gap-3">
          <div className="w-11 h-11 rounded-2xl flex items-center justify-center flex-shrink-0" style={{ background: "rgba(239,68,68,0.15)" }}>
            <XCircle size={20} color="#f87171" />
          </div>
          <div>
            <div className="text-white font-bold text-sm">Application Declined</div>
            <div className="text-red-400/70 text-xs mt-0.5">Your previous application was not approved</div>
          </div>
        </div>
        {application.decline_reason && (
          <div className="rounded-2xl p-3" style={{ background: "rgba(239,68,68,0.08)" }}>
            <div className="text-white/50 text-xs mb-0.5">Reason from Administration</div>
            <div className="text-red-300 text-xs leading-relaxed">{application.decline_reason}</div>
          </div>
        )}
        <div className="text-white/30 text-xs leading-relaxed">
          You may reapply for a virtual card. Please note that reapplying resets your application trail. Ensure your account information is complete and up to date before submitting a new application.
        </div>
        {!showApplyForm ? (
          <button onClick={() => setShowApplyForm(true)} className="gold-btn w-full py-3 text-sm font-semibold flex items-center justify-center gap-2">
            <RefreshCw size={14} /> Reapply for Virtual Card
          </button>
        ) : (
          <ApplyConfirmForm
            account={account}
            isReapply
            applying={applying}
            onApply={handleApply}
            onCancel={() => setShowApplyForm(false)}
          />
        )}
      </div>
    );
  }

  // ── NO APPLICATION: Apply ──
  if (showApplyForm) {
    return (
      <ApplyConfirmForm
        account={account}
        isReapply={false}
        applying={applying}
        onApply={handleApply}
        onCancel={() => setShowApplyForm(false)}
      />
    );
  }

  return (
    <div className="rounded-3xl p-5 space-y-4" style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.08)" }}>
      <div className="flex items-center gap-3">
        <div className="w-12 h-12 rounded-2xl flex items-center justify-center flex-shrink-0" style={{ background: "rgba(200,155,50,0.12)", border: "1px solid rgba(200,155,50,0.2)" }}>
          <CreditCard size={22} style={{ color: "hsl(43,85%,60%)" }} />
        </div>
        <div>
          <div className="text-white font-bold">Virtual Card</div>
          <div className="text-white/40 text-xs mt-0.5">Apply for a BankUnited Virtual Visa Card</div>
        </div>
      </div>

      <div className="grid grid-cols-3 gap-2">
        {[
          { icon: <Shield size={14} />, label: "Secure" },
          { icon: <CreditCard size={14} />, label: "Visa Virtual" },
          { icon: <CheckCircle size={14} />, label: "Instant Use" },
        ].map(f => (
          <div key={f.label} className="rounded-2xl p-2.5 flex flex-col items-center gap-1" style={{ background: "rgba(255,255,255,0.04)" }}>
            <span style={{ color: "hsl(43,85%,60%)" }}>{f.icon}</span>
            <span className="text-white/50 text-xs">{f.label}</span>
          </div>
        ))}
      </div>

      <div className="text-white/40 text-xs leading-relaxed">
        Apply for a BankUnited Virtual Visa Card for seamless online payments. Applications are reviewed by our CEO administration and typically processed within <span className="text-yellow-400/80 font-medium">2–3 business days</span>.
      </div>

      <button onClick={() => setShowApplyForm(true)} className="gold-btn w-full py-3.5 text-sm font-semibold flex items-center justify-center gap-2">
        <Send size={15} /> Apply for Virtual Card
      </button>
    </div>
  );
}

function ApplyConfirmForm({ account, isReapply, applying, onApply, onCancel }: {
  account: Account;
  isReapply: boolean;
  applying: boolean;
  onApply: () => void;
  onCancel: () => void;
}) {
  return (
    <div className="rounded-3xl p-5 space-y-4" style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(200,155,50,0.2)" }}>
      <div className="text-white font-bold text-sm">{isReapply ? "Reapply for Virtual Card" : "Virtual Card Application"}</div>

      <div className="space-y-2">
        <div className="text-white/50 text-xs font-semibold uppercase tracking-wide">Application Details</div>
        {[
          ["Full Name", account.account_name],
          ["Account Number", account.account_number],
          ["Account Type", account.account_type],
          ["Currency", account.currency],
          ["Email", account.login_email],
        ].map(([l, v]) => (
          <div key={l} className="flex justify-between py-1.5" style={{ borderBottom: "1px solid rgba(255,255,255,0.05)" }}>
            <span className="text-white/40 text-xs">{l}</span>
            <span className="text-white text-xs font-medium">{v}</span>
          </div>
        ))}
      </div>

      <div className="rounded-2xl p-3" style={{ background: "rgba(200,155,50,0.07)", border: "1px solid rgba(200,155,50,0.15)" }}>
        <div className="text-yellow-400/80 text-xs leading-relaxed">
          By submitting this application, you confirm that all account information is accurate and complete. BankUnited administration will review your application within <strong>2–3 business days</strong>. You will be notified of the decision via your notification centre.
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <button onClick={onCancel} className="py-3 rounded-2xl text-white/60 text-sm font-medium" style={{ background: "rgba(255,255,255,0.07)" }}>Cancel</button>
        <button onClick={onApply} disabled={applying} className="gold-btn py-3 text-sm font-semibold flex items-center justify-center gap-2">
          {applying ? <div className="w-4 h-4 border-2 border-gray-900/30 border-t-gray-900 rounded-full animate-spin" /> : <><Send size={13} /> Submit</>}
        </button>
      </div>
    </div>
  );
}
