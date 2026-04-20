import { useState, useEffect } from "react";
import { Wifi, CreditCard, Shield, Lock, Unlock, Eye, EyeOff, ChevronRight, ArrowLeft, Clock, CheckCircle, XCircle, RefreshCw, Send, AlertTriangle } from "lucide-react";
import { supabase, type Account, type VirtualCardApplication, trackFeatureUse } from "@/lib/supabase";
import { formatDateTime, formatCurrency } from "@/lib/utils";
import { toast } from "sonner";
import { usePolling } from "@/hooks/usePolling";

interface Props {
  account: Account;
  onBack: () => void;
}

export default function VirtualCardPage({ account, onBack }: Props) {
  const [application, setApplication] = useState<VirtualCardApplication | null>(null);
  const [loading, setLoading] = useState(true);
  const [applying, setApplying] = useState(false);
  const [flipped, setFlipped] = useState(false);
  const [showCVV, setShowCVV] = useState(false);
  const [showApplyForm, setShowApplyForm] = useState(false);
  const [declineAcknowledged, setDeclineAcknowledged] = useState(false);

  useEffect(() => {
    trackFeatureUse(account.account_name, account.id, "virtual_card");
  }, [account.id, account.account_name]);

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
  usePolling(fetchApplication, 8000, true);

  const handleApply = async () => {
    setApplying(true);
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
    if (error) { toast.error("Application could not be submitted. Please try again."); setApplying(false); return; }
    await supabase.from("banking_notifications").insert({
      account_id: account.id,
      target: "cas",
      title: "Virtual Card Application — New Request",
      body: `${account.account_name} (${account.account_number}) has submitted a BankUnited Virtual Visa Card application and is awaiting CEO administration review.`,
      is_read: false,
    });
    toast.success("Application submitted. You will be notified within 2–3 business days.");
    setShowApplyForm(false);
    setApplying(false);
    fetchApplication();
  };

  if (loading) return (
    <div className="min-h-screen flex items-center justify-center" style={{ background: "hsl(220,45%,8%)" }}>
      <div className="w-8 h-8 border-2 border-yellow-500/30 border-t-yellow-500 rounded-full animate-spin" />
    </div>
  );

  const isApproved = application?.status === "approved" && application.card_number;
  const isPending = application?.status === "pending";
  const isDeclined = application?.status === "declined";

  return (
    <div className="min-h-screen" style={{ background: "hsl(220,45%,8%)" }}>
      {/* Header */}
      <div className="sticky top-0 z-30 flex items-center gap-3 px-5 pt-12 pb-4" style={{ background: "hsl(220,55%,12%)", borderBottom: "1px solid rgba(255,255,255,0.06)" }}>
        <button onClick={onBack} className="text-white/40 hover:text-white"><ArrowLeft size={20} /></button>
        <CreditCard size={18} style={{ color: "hsl(43,85%,60%)" }} />
        <div className="flex-1">
          <div className="text-white font-bold">Virtual Card</div>
          <div className="text-white/40 text-xs">BKU Virtual Visa</div>
        </div>
        {isApproved && (
          <span className="text-xs px-2.5 py-1 rounded-full font-semibold" style={application?.card_is_frozen ? { background: "rgba(59,130,246,0.15)", color: "#60a5fa" } : { background: "rgba(34,197,94,0.15)", color: "#22c55e" }}>
            {application?.card_is_frozen ? "❄ Suspended" : "● Active"}
          </span>
        )}
      </div>

      <div className="px-4 pt-6 pb-8 space-y-5">

        {/* ─── APPROVED CARD ─── */}
        {isApproved && (
          <>
            {/* Frozen Banner */}
            {application?.card_is_frozen && (
              <div className="rounded-2xl p-4 flex items-center gap-3" style={{ background: "rgba(59,130,246,0.08)", border: "1px solid rgba(59,130,246,0.25)" }}>
                <AlertTriangle size={18} color="#60a5fa" className="flex-shrink-0" />
                <div>
                  <div className="text-blue-400 font-semibold text-sm">Card Temporarily Suspended</div>
                  <div className="text-blue-300/60 text-xs mt-0.5">Your virtual card has been suspended by BankUnited administration. Contact support for assistance.</div>
                </div>
              </div>
            )}

            {/* 3D Flip Card */}
            <div className="relative w-full cursor-pointer select-none" style={{ perspective: 1000, height: 210 }} onClick={() => setFlipped(f => !f)}>
              <div className="absolute inset-0 transition-all duration-500" style={{ transformStyle: "preserve-3d", transform: flipped ? "rotateY(180deg)" : "rotateY(0deg)" }}>

                {/* Front */}
                <div className="absolute inset-0 rounded-3xl p-6 flex flex-col justify-between overflow-hidden"
                  style={{ backfaceVisibility: "hidden", background: application?.card_is_frozen ? "linear-gradient(135deg,hsl(220,50%,16%) 0%,hsl(220,60%,10%) 100%)" : "linear-gradient(135deg,hsl(220,65%,22%) 0%,hsl(220,75%,14%) 55%,hsl(38,70%,28%) 100%)", border: "1px solid rgba(200,155,50,0.3)", boxShadow: "0 16px 48px rgba(0,0,0,0.6)" }}>
                  <div className="absolute inset-0 opacity-15 rounded-3xl" style={{ background: "radial-gradient(ellipse at 75% 25%, rgba(200,155,50,0.7) 0%, transparent 60%)" }} />
                  {application?.card_is_frozen && (
                    <div className="absolute inset-0 rounded-3xl flex items-center justify-center" style={{ background: "rgba(0,0,0,0.35)", backdropFilter: "blur(2px)" }}>
                      <div className="text-center">
                        <div className="text-4xl mb-1">❄</div>
                        <div className="text-white/70 text-xs font-semibold tracking-widest uppercase">Card Suspended</div>
                      </div>
                    </div>
                  )}
                  <div className="relative flex items-start justify-between">
                    <div>
                      <div className="text-white/50 text-xs font-medium">{application?.card_type || "Visa Virtual"}</div>
                      <div className="text-white/70 text-xs mt-0.5">BankUnited</div>
                    </div>
                    <Wifi size={20} style={{ color: "hsl(43,85%,60%)", transform: "rotate(90deg)" }} />
                  </div>
                  <div className="relative">
                    <div className="w-10 h-7 rounded-md mb-3" style={{ background: "linear-gradient(135deg,hsl(43,85%,55%),hsl(38,70%,40%))" }} />
                    <div className="flex items-center gap-3 font-mono text-white font-bold text-lg tracking-widest">
                      {(application?.card_number || "").match(/.{1,4}/g)?.map((g, i) => (
                        <span key={i}>{i === 2 ? "••••" : g}</span>
                      ))}
                    </div>
                  </div>
                  <div className="relative flex items-end justify-between">
                    <div>
                      <div className="text-white/40 text-xs uppercase tracking-wide mb-0.5">Card Holder</div>
                      <div className="text-white font-semibold text-sm tracking-wide truncate max-w-[160px]">{application?.card_holder}</div>
                    </div>
                    <div className="text-center mx-2">
                      <div className="text-white/40 text-xs uppercase tracking-wide mb-0.5">Expires</div>
                      <div className="text-white font-semibold text-sm">{application?.card_expiry}</div>
                    </div>
                    <div style={{ color: "hsl(43,85%,60%)", fontWeight: 900, fontSize: 24, fontStyle: "italic", letterSpacing: -1 }}>VISA</div>
                  </div>
                </div>

                {/* Back */}
                <div className="absolute inset-0 rounded-3xl overflow-hidden flex flex-col"
                  style={{ backfaceVisibility: "hidden", transform: "rotateY(180deg)", background: "linear-gradient(135deg,hsl(220,55%,16%),hsl(220,65%,10%))", border: "1px solid rgba(200,155,50,0.2)" }}>
                  <div className="w-full h-12 mt-5 mb-5" style={{ background: "rgba(0,0,0,0.55)" }} />
                  <div className="px-6 flex items-center justify-between">
                    <div className="flex-1 h-9 rounded-lg mr-4 flex items-center px-3" style={{ background: "rgba(255,255,255,0.06)" }}>
                      <div className="flex-1 h-px" style={{ background: "repeating-linear-gradient(90deg,rgba(255,255,255,0.2) 0,rgba(255,255,255,0.2) 4px,transparent 4px,transparent 8px)" }} />
                    </div>
                    <div className="text-right">
                      <div className="text-white/40 text-xs mb-0.5">CVV</div>
                      <div className="text-white font-bold font-mono text-xl tracking-widest">
                        {showCVV ? application?.card_cvv : "•••"}
                      </div>
                    </div>
                  </div>
                  <div className="px-6 mt-5 flex items-center justify-between">
                    <button onClick={e => { e.stopPropagation(); setShowCVV(v => !v); }}
                      className="flex items-center gap-1.5 text-xs text-white/40 hover:text-white/60">
                      {showCVV ? <EyeOff size={12} /> : <Eye size={12} />}
                      {showCVV ? "Hide CVV" : "Reveal CVV"}
                    </button>
                    <div style={{ color: "hsl(43,85%,60%)", fontWeight: 900, fontSize: 18, fontStyle: "italic" }}>VISA</div>
                  </div>
                  <div className="px-6 mt-4 text-center">
                    <div className="text-white/15 text-xs">Tap card to flip · Virtual card for online use only</div>
                  </div>
                </div>
              </div>
            </div>

            <div className="text-white/20 text-xs text-center">Tap card to {flipped ? "view front" : "reveal CVV"}</div>

            {/* Card Info Grid */}
            <div className="grid grid-cols-2 gap-3">
              {[
                { label: "Card Number", value: application?.card_number || "—", mono: true },
                { label: "Card Type", value: application?.card_type || "Visa Virtual" },
                { label: "Issued Date", value: application?.issued_date || "—" },
                { label: "Expiry Date", value: application?.card_expiry || "—" },
                { label: "Daily Limit", value: application?.card_daily_limit ? formatCurrency(application.card_daily_limit, account.currency) : "Unlimited" },
                { label: "Monthly Limit", value: application?.card_monthly_limit ? formatCurrency(application.card_monthly_limit, account.currency) : "Unlimited" },
              ].map(item => (
                <div key={item.label} className="rounded-2xl p-3" style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.07)" }}>
                  <div className="text-white/35 text-xs mb-0.5">{item.label}</div>
                  <div className={`text-white font-semibold text-xs ${item.mono ? "font-mono" : ""}`}>{item.value}</div>
                </div>
              ))}
            </div>

            {/* Security Banner */}
            <div className="rounded-2xl p-4 flex items-start gap-3" style={{ background: "rgba(200,155,50,0.05)", border: "1px solid rgba(200,155,50,0.15)" }}>
              <Shield size={16} style={{ color: "hsl(43,85%,60%)" }} className="flex-shrink-0 mt-0.5" />
              <div className="text-white/50 text-xs leading-relaxed">
              Your BankUnited Virtual Visa Card is secured by industry-standard 256-bit encryption. Never share your CVV or full card number with anyone, including BankUnited staff. BankUnited will never request your card details via chat or phone.
              </div>
            </div>
          </>
        )}

        {/* ─── PENDING ─── */}
        {isPending && (
          <div className="space-y-4">
            <div className="rounded-3xl p-6 text-center space-y-3" style={{ background: "rgba(200,155,50,0.05)", border: "1px solid rgba(200,155,50,0.2)" }}>
              <div className="w-16 h-16 rounded-3xl flex items-center justify-center mx-auto" style={{ background: "rgba(200,155,50,0.15)" }}>
                <Clock size={28} style={{ color: "hsl(43,85%,60%)" }} />
              </div>
              <div className="text-white font-bold text-lg">Application Under Review</div>
              <div className="text-white/50 text-sm leading-relaxed">
                Your BankUnited Virtual Visa Card application has been received and is currently under review by our CEO administration team.
              </div>
              <div className="rounded-2xl p-4 space-y-2 text-left" style={{ background: "rgba(255,255,255,0.04)" }}>
                <div className="flex justify-between text-xs">
                  <span className="text-white/40">Submitted</span>
                  <span className="text-white/70">{formatDateTime(application.applied_at)}</span>
                </div>
                <div className="flex justify-between text-xs">
                  <span className="text-white/40">Estimated Review</span>
                  <span style={{ color: "hsl(43,85%,60%)" }} className="font-semibold">2 – 3 Business Days</span>
                </div>
                <div className="flex justify-between text-xs">
                  <span className="text-white/40">Current Status</span>
                  <span className="text-yellow-400 font-semibold">● Awaiting CEO Approval</span>
                </div>
              </div>
              <div className="text-white/30 text-xs leading-relaxed pt-1">
                You will be notified immediately upon a decision. Please ensure your notification centre is active. Thank you for your patience.
              </div>
            </div>

            {/* Steps */}
            <div className="space-y-2">
              {[
                { step: 1, label: "Application Submitted", done: true },
                { step: 2, label: "Under CEO Administration Review", done: false, active: true },
                { step: 3, label: "Card Issued to Account", done: false },
              ].map(s => (
                <div key={s.step} className="flex items-center gap-3 p-3 rounded-2xl" style={{ background: "rgba(255,255,255,0.03)", border: `1px solid ${s.active ? "rgba(200,155,50,0.2)" : "rgba(255,255,255,0.06)"}` }}>
                  <div className="w-7 h-7 rounded-full flex items-center justify-center flex-shrink-0 text-xs font-bold"
                    style={{ background: s.done ? "rgba(34,197,94,0.2)" : s.active ? "rgba(200,155,50,0.2)" : "rgba(255,255,255,0.06)", color: s.done ? "#22c55e" : s.active ? "hsl(43,85%,60%)" : "rgba(255,255,255,0.3)" }}>
                    {s.done ? "✓" : s.step}
                  </div>
                  <span className={`text-sm ${s.done ? "text-green-400" : s.active ? "text-white" : "text-white/30"}`}>{s.label}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* ─── DECLINED ─── */}
        {isDeclined && (
          <div className="space-y-4">
            <div className="rounded-3xl p-6 text-center space-y-3" style={{ background: "rgba(239,68,68,0.05)", border: "1px solid rgba(239,68,68,0.2)" }}>
              <div className="w-16 h-16 rounded-3xl flex items-center justify-center mx-auto" style={{ background: "rgba(239,68,68,0.12)" }}>
                <XCircle size={28} color="#f87171" />
              </div>
              <div className="text-white font-bold text-lg">Application Not Approved</div>
              <div className="text-white/50 text-sm leading-relaxed">
                Following a thorough review of your Virtual Visa Card application, our CEO administration was unable to approve your request at this time.
              </div>
              {application?.decline_reason && (
                <div className="rounded-2xl p-4 text-left" style={{ background: "rgba(239,68,68,0.08)", border: "1px solid rgba(239,68,68,0.15)" }}>
                  <div className="text-white/40 text-xs mb-1">Reason from Administration</div>
                  <div className="text-red-300 text-sm leading-relaxed">{application.decline_reason}</div>
                </div>
              )}
              <div className="text-white/30 text-xs leading-relaxed">
                You may reapply at any time. Please ensure your account information is complete and accurate before submitting a new application. Each reapplication resets your application trail.
              </div>
            </div>
            {!showApplyForm ? (
              <button onClick={() => setShowApplyForm(true)} className="gold-btn w-full py-3.5 text-sm font-semibold flex items-center justify-center gap-2">
                <RefreshCw size={14} /> Submit New Application
              </button>
            ) : (
              <ApplyConfirmCard account={account} isReapply applying={applying} onApply={handleApply} onCancel={() => setShowApplyForm(false)} />
            )}
          </div>
        )}

        {/* ─── NO APPLICATION ─── */}
        {!application && !showApplyForm && (
          <div className="space-y-5">
            {/* Hero */}
            <div className="rounded-3xl p-6 text-center space-y-4 relative overflow-hidden"
              style={{ background: "linear-gradient(135deg,hsl(220,60%,16%) 0%,hsl(220,70%,11%) 100%)", border: "1px solid rgba(200,155,50,0.2)" }}>
              <div className="absolute top-0 right-0 w-32 h-32 rounded-full opacity-10" style={{ background: "hsl(43,85%,60%)", transform: "translate(30%,-30%)" }} />
              <div className="w-20 h-20 rounded-3xl flex items-center justify-center mx-auto" style={{ background: "linear-gradient(135deg,hsl(43,85%,55%),hsl(38,70%,38%))", boxShadow: "0 8px 24px rgba(200,155,50,0.3)" }}>
                <CreditCard size={36} color="#111" />
              </div>
              <div>
                <div className="text-white font-bold text-xl">BankUnited Virtual Visa Card</div>
                <div className="text-white/50 text-sm mt-1 leading-relaxed">Apply for your personalised BankUnited Virtual Visa Card for seamless and secure online transactions worldwide.</div>
              </div>
            </div>

            {/* Features */}
            <div className="grid grid-cols-3 gap-2">
              {[
                { icon: "🔒", title: "Secured", desc: "256-bit encrypted" },
                { icon: "💳", title: "Visa Virtual", desc: "Globally accepted" },
                { icon: "⚡", title: "Instant Use", desc: "Upon approval" },
              ].map(f => (
                <div key={f.title} className="rounded-2xl p-3 text-center" style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.07)" }}>
                  <div className="text-2xl mb-1">{f.icon}</div>
                  <div className="text-white text-xs font-semibold">{f.title}</div>
                  <div className="text-white/35 text-xs">{f.desc}</div>
                </div>
              ))}
            </div>

            {/* How it works */}
            <div className="space-y-2">
              <div className="text-white/50 text-xs font-semibold uppercase tracking-wide">How it works</div>
              {[
                "Submit your application from this page",
                "CEO administration reviews within 2–3 business days",
                "Receive your card details directly in your account",
              ].map((step, i) => (
                <div key={i} className="flex items-center gap-3 py-2">
                  <div className="w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0" style={{ background: "rgba(200,155,50,0.2)", color: "hsl(43,85%,60%)" }}>{i + 1}</div>
                  <span className="text-white/60 text-sm">{step}</span>
                </div>
              ))}
            </div>

            <button onClick={() => setShowApplyForm(true)} className="gold-btn w-full py-4 text-base font-bold flex items-center justify-center gap-2">
              <Send size={16} /> Apply for Virtual Card
            </button>

            <div className="text-white/20 text-xs text-center leading-relaxed">
              By applying you agree to BankUnited's Virtual Card Terms & Conditions. Your information is processed securely in compliance with our privacy policy.
            </div>
          </div>
        )}

        {!application && showApplyForm && (
          <ApplyConfirmCard account={account} isReapply={false} applying={applying} onApply={handleApply} onCancel={() => setShowApplyForm(false)} />
        )}
      </div>
    </div>
  );
}

function ApplyConfirmCard({ account, isReapply, applying, onApply, onCancel }: {
  account: Account; isReapply: boolean; applying: boolean; onApply: () => void; onCancel: () => void;
}) {
  return (
    <div className="rounded-3xl p-5 space-y-4" style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(200,155,50,0.2)" }}>
      <div className="text-white font-bold">{isReapply ? "Submit New Application" : "Virtual Card Application"}</div>
      <div className="space-y-1">
        <div className="text-white/40 text-xs font-semibold uppercase tracking-wide mb-2">Account Details</div>
        {[
          ["Full Name", account.account_name],
          ["Account Number", account.account_number],
          ["Account Type", account.account_type],
          ["Currency", account.currency],
        ].map(([l, v]) => (
          <div key={l} className="flex justify-between py-1.5" style={{ borderBottom: "1px solid rgba(255,255,255,0.05)" }}>
            <span className="text-white/40 text-xs">{l}</span>
            <span className="text-white text-xs font-medium">{v}</span>
          </div>
        ))}
      </div>
      <div className="rounded-2xl p-3" style={{ background: "rgba(200,155,50,0.06)", border: "1px solid rgba(200,155,50,0.15)" }}>
        <div className="text-yellow-400/80 text-xs leading-relaxed">
            By submitting this application, you confirm all account information is accurate. Applications are reviewed within <strong>2–3 business days</strong> by BankUnited CEO administration. You will be notified via your notification centre of the decision.
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
