import { useState, useEffect } from "react";
import { ArrowLeft, TrendingUp, Target, Award, Star, ChevronUp, Clock, FileText, Shield, Send, BookOpen, RefreshCw, Plus, Trash2, CreditCard, Layers, Users } from "lucide-react";
import { supabase, type Account, type TierUpgradeRequest, type LoanApplication, type ChequeRequest, type VirtualCardApplication, type SavingsGoal, trackFeatureUse } from "@/lib/supabase";
import { formatCurrency, formatDateTime } from "@/lib/utils";
import { usePolling } from "@/hooks/usePolling";
import { toast } from "sonner";

// This is the CAS Platform Controls panel - manages all 15 new features
interface Props {
  accounts: Account[];
  onClose: () => void;
}

type ReviewType = "tier" | "loan" | "cheque";

export default function CASPlatformControls({ accounts, onClose }: Props) {
  const [activeSection, setActiveSection] = useState<ReviewType | "overview" | "savings" | "goals">("overview");
  const [tierRequests, setTierRequests] = useState<TierUpgradeRequest[]>([]);
  const [loanApplications, setLoanApplications] = useState<LoanApplication[]>([]);
  const [chequeRequests, setChequeRequests] = useState<ChequeRequest[]>([]);
  const [savingsGoals, setSavingsGoals] = useState<SavingsGoal[]>([]);
  const [cardApps, setCardApps] = useState<VirtualCardApplication[]>([]);
  const [selected, setSelected] = useState<TierUpgradeRequest | LoanApplication | ChequeRequest | null>(null);
  const [declineReason, setDeclineReason] = useState("");
  const [processing, setProcessing] = useState(false);
  const [repaymentTerms, setRepaymentTerms] = useState("");

  const fetchAll = async () => {
    const [tierRes, loanRes, chequeRes, goalsRes, cardRes] = await Promise.all([
      supabase.from("tier_upgrade_requests").select("*").order("applied_at", { ascending: false }),
      supabase.from("loan_applications").select("*").order("applied_at", { ascending: false }),
      supabase.from("cheque_requests").select("*").order("applied_at", { ascending: false }),
      supabase.from("savings_goals").select("*").order("created_at", { ascending: false }),
      supabase.from("virtual_card_applications").select("*").order("applied_at", { ascending: false }),
    ]);
    if (tierRes.data) setTierRequests(tierRes.data as TierUpgradeRequest[]);
    if (loanRes.data) setLoanApplications(loanRes.data as LoanApplication[]);
    if (chequeRes.data) setChequeRequests(chequeRes.data as ChequeRequest[]);
    if (goalsRes.data) setSavingsGoals(goalsRes.data as SavingsGoal[]);
    if (cardRes.data) setCardApps(cardRes.data as VirtualCardApplication[]);
  };

  useEffect(() => { fetchAll(); }, []);
  usePolling(fetchAll, 10000, !selected);

  // Tier upgrade handlers
  const handleApproveTier = async (req: TierUpgradeRequest) => {
    setProcessing(true);
    await supabase.from("banking_accounts").update({ account_tier: req.requested_tier }).eq("id", req.account_id);
    await supabase.from("tier_upgrade_requests").update({ status: "approved", reviewed_at: new Date().toISOString(), reviewed_by: "CEO" }).eq("id", req.id);
    await supabase.from("banking_notifications").insert({
      account_id: req.account_id,
      target: req.account_id,
      title: "Tier Upgrade Approved 🎉",
      body: `Congratulations, ${req.account_name}! Your request to upgrade to Tier ${req.requested_tier} has been approved by GHOB CEO Administration. Your account has been upgraded and you now have access to all Tier ${req.requested_tier} features and privileges.`,
      is_read: false,
    });
    toast.success(`${req.account_name} upgraded to Tier ${req.requested_tier}.`);
    setSelected(null);
    setProcessing(false);
    fetchAll();
  };

  const handleDeclineTier = async (req: TierUpgradeRequest) => {
    if (!declineReason.trim()) { toast.error("Please provide a decline reason."); return; }
    setProcessing(true);
    await supabase.from("tier_upgrade_requests").update({ status: "declined", decline_reason: declineReason.trim(), reviewed_at: new Date().toISOString(), reviewed_by: "CEO" }).eq("id", req.id);
    await supabase.from("banking_notifications").insert({
      account_id: req.account_id,
      target: req.account_id,
      title: "Tier Upgrade Request — Update",
      body: `Dear ${req.account_name}, after careful review of your Tier ${req.requested_tier} upgrade request, GHOB CEO Administration is unable to approve this request at this time. Reason: ${declineReason.trim()}. You may reapply with updated documentation.`,
      is_read: false,
    });
    toast.success("Tier upgrade request declined.");
    setSelected(null);
    setDeclineReason("");
    setProcessing(false);
    fetchAll();
  };

  // Loan handlers
  const handleApproveLoan = async (req: LoanApplication) => {
    if (!repaymentTerms.trim()) { toast.error("Please specify repayment terms."); return; }
    setProcessing(true);
    const { error } = await supabase.from("banking_transactions").insert({
      account_id: req.account_id,
      type: "credit",
      amount: req.amount,
      description: `GHOB Loan Disbursement — ${req.purpose}`,
      sender_name: "Global Health Online Banking",
      admin_override: true,
      custom_timestamp: new Date().toISOString(),
    });
    if (!error) {
      const acc = accounts.find(a => a.id === req.account_id);
      if (acc) await supabase.from("banking_accounts").update({ balance: Number(acc.balance) + Number(req.amount), updated_at: new Date().toISOString() }).eq("id", req.account_id);
      await supabase.from("loan_applications").update({ status: "approved", repayment_terms: repaymentTerms.trim(), reviewed_at: new Date().toISOString(), reviewed_by: "CEO" }).eq("id", req.id);
      await supabase.from("banking_notifications").insert({
        account_id: req.account_id,
        target: req.account_id,
        title: "Loan Application Approved",
        body: `Dear ${req.account_name}, your GHOB loan application for ${formatCurrency(req.amount, "USD")} has been approved. The funds have been disbursed to your account. Repayment Terms: ${repaymentTerms.trim()}.`,
        is_read: false,
      });
      toast.success(`Loan of ${formatCurrency(req.amount, "USD")} disbursed to ${req.account_name}.`);
    }
    setSelected(null);
    setRepaymentTerms("");
    setProcessing(false);
    fetchAll();
  };

  const handleDeclineLoan = async (req: LoanApplication) => {
    if (!declineReason.trim()) { toast.error("Please provide a decline reason."); return; }
    setProcessing(true);
    await supabase.from("loan_applications").update({ status: "declined", decline_reason: declineReason.trim(), reviewed_at: new Date().toISOString(), reviewed_by: "CEO" }).eq("id", req.id);
    await supabase.from("banking_notifications").insert({
      account_id: req.account_id,
      target: req.account_id,
      title: "Loan Application — Decision",
      body: `Dear ${req.account_name}, your loan application for ${formatCurrency(req.amount, "USD")} has not been approved at this time. Reason: ${declineReason.trim()}.`,
      is_read: false,
    });
    toast.success("Loan application declined.");
    setSelected(null);
    setDeclineReason("");
    setProcessing(false);
    fetchAll();
  };

  // Cheque handlers
  const handleApproveCheque = async (req: ChequeRequest) => {
    setProcessing(true);
    await supabase.from("cheque_requests").update({ status: "approved", reviewed_at: new Date().toISOString(), reviewed_by: "CEO" }).eq("id", req.id);
    await supabase.from("banking_notifications").insert({
      account_id: req.account_id,
      target: req.account_id,
      title: "Cheque Book Request Approved",
      body: `Dear ${req.account_name}, your GHOB cheque book request has been approved. Your cheque book will be dispatched to your registered address within 5–7 business days.`,
      is_read: false,
    });
    toast.success("Cheque book request approved.");
    setSelected(null);
    setProcessing(false);
    fetchAll();
  };

  const handleDeclineCheque = async (req: ChequeRequest) => {
    if (!declineReason.trim()) { toast.error("Please provide a decline reason."); return; }
    setProcessing(true);
    await supabase.from("cheque_requests").update({ status: "declined", decline_reason: declineReason.trim(), reviewed_at: new Date().toISOString(), reviewed_by: "CEO" }).eq("id", req.id);
    await supabase.from("banking_notifications").insert({
      account_id: req.account_id,
      target: req.account_id,
      title: "Cheque Book Request — Declined",
      body: `Dear ${req.account_name}, your GHOB cheque book request could not be processed at this time. Reason: ${declineReason.trim()}.`,
      is_read: false,
    });
    toast.success("Cheque book request declined.");
    setSelected(null);
    setDeclineReason("");
    setProcessing(false);
    fetchAll();
  };

  // Alter account tier directly
  const handleAlterTier = async (accountId: string, accountName: string, newTier: number) => {
    await supabase.from("banking_accounts").update({ account_tier: newTier }).eq("id", accountId);
    await supabase.from("banking_notifications").insert({
      account_id: accountId,
      target: accountId,
      title: "Account Tier Updated",
      body: `Your GHOB account has been updated to Tier ${newTier} by CEO Administration.`,
      is_read: false,
    });
    toast.success(`${accountName} tier set to ${newTier}.`);
    fetchAll();
  };

  // Pause/resume savings goal
  const handleToggleSavingsGoal = async (goal: SavingsGoal) => {
    await supabase.from("savings_goals").update({ is_paused: !goal.is_paused }).eq("id", goal.id);
    toast.success(goal.is_paused ? "Savings goal resumed." : "Savings goal paused.");
    fetchAll();
  };

  const pendingTier = tierRequests.filter(r => r.status === "pending").length;
  const pendingLoan = loanApplications.filter(r => r.status === "pending").length;
  const pendingCheque = chequeRequests.filter(r => r.status === "pending").length;

  const TIER_NAMES: Record<number, string> = { 1: "Standard", 2: "Silver", 3: "Gold", 4: "Platinum", 5: "Elite" };

  return (
    <div className="fixed inset-0 z-[55] flex flex-col" style={{ background: "hsl(220,45%,8%)" }}>
      <div className="flex items-center gap-3 px-5 pt-12 pb-4 flex-shrink-0" style={{ background: "hsl(220,55%,12%)", borderBottom: "1px solid rgba(255,255,255,0.06)" }}>
        <button onClick={onClose} className="text-white/40 hover:text-white"><ArrowLeft size={20} /></button>
        <Layers size={18} style={{ color: "hsl(43,85%,60%)" }} />
        <div className="text-white font-bold flex-1">Platform Controls</div>
      </div>

      {/* Section tabs */}
      <div className="flex gap-2 px-4 pt-3 pb-2 overflow-x-auto flex-shrink-0">
        {([
          { key: "overview", label: "Overview" },
          { key: "tier", label: `Tier Upgrades${pendingTier > 0 ? ` (${pendingTier})` : ""}` },
          { key: "loan", label: `Loans${pendingLoan > 0 ? ` (${pendingLoan})` : ""}` },
          { key: "cheque", label: `Cheques${pendingCheque > 0 ? ` (${pendingCheque})` : ""}` },
          { key: "goals", label: "Savings Goals" },
        ] as const).map(s => (
          <button key={s.key} onClick={() => setActiveSection(s.key as typeof activeSection)}
            className="px-3 py-1.5 rounded-xl text-xs font-semibold whitespace-nowrap flex-shrink-0"
            style={activeSection === s.key ? { background: "hsl(43,85%,55%)", color: "#111" } : { background: "rgba(255,255,255,0.07)", color: "rgba(255,255,255,0.5)" }}>
            {s.label}
          </button>
        ))}
      </div>

      <div className="flex-1 overflow-y-auto p-4 space-y-3">

        {/* OVERVIEW */}
        {activeSection === "overview" && (
          <>
            <div className="text-white/50 text-xs font-semibold uppercase tracking-wide mb-2">Platform Feature Summary</div>
            {[
              { icon: <ChevronUp size={16} />, label: "Tier Upgrade Requests", count: tierRequests.length, pending: pendingTier, onClick: () => setActiveSection("tier") },
              { icon: <TrendingUp size={16} />, label: "Loan Applications", count: loanApplications.length, pending: pendingLoan, onClick: () => setActiveSection("loan") },
              { icon: <BookOpen size={16} />, label: "Cheque Book Requests", count: chequeRequests.length, pending: pendingCheque, onClick: () => setActiveSection("cheque") },
              { icon: <Target size={16} />, label: "Savings Goals", count: savingsGoals.length, pending: savingsGoals.filter(g => !g.is_paused).length, onClick: () => setActiveSection("goals") },
              { icon: <CreditCard size={16} />, label: "Virtual Cards", count: cardApps.length, pending: cardApps.filter(a => a.status === "pending").length, onClick: () => {} },
            ].map(item => (
              <button key={item.label} onClick={item.onClick}
                className="w-full flex items-center gap-3 p-4 rounded-2xl text-left"
                style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)" }}>
                <div className="w-10 h-10 rounded-2xl flex items-center justify-center flex-shrink-0" style={{ background: "rgba(200,155,50,0.12)", color: "hsl(43,85%,60%)" }}>
                  {item.icon}
                </div>
                <div className="flex-1">
                  <div className="text-white font-semibold text-sm">{item.label}</div>
                  <div className="text-white/40 text-xs">{item.count} total</div>
                </div>
                {item.pending > 0 && (
                  <span className="bg-yellow-500 text-gray-900 text-xs rounded-full px-2 py-0.5 font-bold">{item.pending}</span>
                )}
              </button>
            ))}

            {/* Direct Tier Alteration */}
            <div className="mt-4">
              <div className="text-white/50 text-xs font-semibold uppercase tracking-wide mb-2">Direct Tier Control — All Accounts</div>
              <div className="space-y-2">
                {accounts.slice(0, 20).map(acc => (
                  <div key={acc.id} className="flex items-center gap-3 p-3 rounded-2xl" style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.06)" }}>
                    <div className="flex-1 min-w-0">
                      <div className="text-white text-xs font-semibold truncate">{acc.account_name}</div>
                      <div className="text-white/30 text-xs">Current: Tier {acc.account_tier || 1} · {TIER_NAMES[acc.account_tier || 1]}</div>
                    </div>
                    <select
                      className="text-xs rounded-xl px-2 py-1.5 font-semibold"
                      style={{ background: "hsl(220,50%,20%)", color: "hsl(43,85%,60%)", border: "1px solid rgba(200,155,50,0.3)" }}
                      value={acc.account_tier || 1}
                      onChange={e => handleAlterTier(acc.id, acc.account_name, parseInt(e.target.value))}>
                      {[1, 2, 3, 4, 5].map(t => (
                        <option key={t} value={t}>Tier {t} — {TIER_NAMES[t]}</option>
                      ))}
                    </select>
                  </div>
                ))}
              </div>
            </div>
          </>
        )}

        {/* TIER UPGRADE REQUESTS */}
        {activeSection === "tier" && !selected && (
          <>
            <div className="text-white/50 text-xs font-semibold uppercase tracking-wide">Tier Upgrade Requests ({tierRequests.length})</div>
            {tierRequests.length === 0 ? (
              <div className="text-center py-10 text-white/25 text-sm">No tier upgrade requests</div>
            ) : (
              tierRequests.map(req => (
                <button key={req.id} onClick={() => setSelected(req)}
                  className="w-full text-left rounded-2xl p-4 space-y-1"
                  style={{ background: "rgba(255,255,255,0.03)", border: `1px solid ${req.status === "pending" ? "rgba(200,155,50,0.25)" : req.status === "approved" ? "rgba(34,197,94,0.2)" : "rgba(239,68,68,0.2)"}` }}>
                  <div className="flex items-center justify-between">
                    <div className="text-white font-semibold text-sm">{req.account_name}</div>
                    <span className={`text-xs px-2 py-0.5 rounded-full font-semibold ${req.status === "pending" ? "bg-yellow-500/15 text-yellow-400" : req.status === "approved" ? "bg-green-500/15 text-green-400" : "bg-red-500/15 text-red-400"}`}>
                      {req.status}
                    </span>
                  </div>
                  <div className="text-white/40 text-xs">Tier {req.current_tier} → Tier {req.requested_tier} · {TIER_NAMES[req.requested_tier]}</div>
                  <div className="text-white/25 text-xs">{formatDateTime(req.applied_at)}</div>
                </button>
              ))
            )}
          </>
        )}

        {/* LOANS */}
        {activeSection === "loan" && !selected && (
          <>
            <div className="text-white/50 text-xs font-semibold uppercase tracking-wide">Loan Applications ({loanApplications.length})</div>
            {loanApplications.length === 0 ? (
              <div className="text-center py-10 text-white/25 text-sm">No loan applications</div>
            ) : (
              loanApplications.map(req => (
                <button key={req.id} onClick={() => setSelected(req)}
                  className="w-full text-left rounded-2xl p-4 space-y-1"
                  style={{ background: "rgba(255,255,255,0.03)", border: `1px solid ${req.status === "pending" ? "rgba(200,155,50,0.25)" : req.status === "approved" ? "rgba(34,197,94,0.2)" : "rgba(239,68,68,0.2)"}` }}>
                  <div className="flex items-center justify-between">
                    <div className="text-white font-semibold text-sm">{req.account_name}</div>
                    <span className={`text-xs px-2 py-0.5 rounded-full font-semibold ${req.status === "pending" ? "bg-yellow-500/15 text-yellow-400" : req.status === "approved" ? "bg-green-500/15 text-green-400" : "bg-red-500/15 text-red-400"}`}>
                      {req.status}
                    </span>
                  </div>
                  <div className="text-white font-bold" style={{ color: "hsl(43,85%,60%)" }}>{formatCurrency(req.amount, "USD")}</div>
                  <div className="text-white/40 text-xs truncate">{req.purpose}</div>
                  <div className="text-white/25 text-xs">{formatDateTime(req.applied_at)}</div>
                </button>
              ))
            )}
          </>
        )}

        {/* CHEQUES */}
        {activeSection === "cheque" && !selected && (
          <>
            <div className="text-white/50 text-xs font-semibold uppercase tracking-wide">Cheque Book Requests ({chequeRequests.length})</div>
            {chequeRequests.length === 0 ? (
              <div className="text-center py-10 text-white/25 text-sm">No cheque book requests</div>
            ) : (
              chequeRequests.map(req => (
                <button key={req.id} onClick={() => setSelected(req)}
                  className="w-full text-left rounded-2xl p-4 space-y-1"
                  style={{ background: "rgba(255,255,255,0.03)", border: `1px solid ${req.status === "pending" ? "rgba(200,155,50,0.25)" : req.status === "approved" ? "rgba(34,197,94,0.2)" : "rgba(239,68,68,0.2)"}` }}>
                  <div className="flex items-center justify-between">
                    <div className="text-white font-semibold text-sm">{req.account_name}</div>
                    <span className={`text-xs px-2 py-0.5 rounded-full font-semibold ${req.status === "pending" ? "bg-yellow-500/15 text-yellow-400" : req.status === "approved" ? "bg-green-500/15 text-green-400" : "bg-red-500/15 text-red-400"}`}>
                      {req.status}
                    </span>
                  </div>
                  <div className="text-white/40 text-xs">{req.account_number}</div>
                  {req.delivery_address && <div className="text-white/30 text-xs truncate">Deliver to: {req.delivery_address}</div>}
                  <div className="text-white/25 text-xs">{formatDateTime(req.applied_at)}</div>
                </button>
              ))
            )}
          </>
        )}

        {/* SAVINGS GOALS */}
        {activeSection === "goals" && (
          <>
            <div className="text-white/50 text-xs font-semibold uppercase tracking-wide">All Platform Savings Goals ({savingsGoals.length})</div>
            {savingsGoals.length === 0 ? (
              <div className="text-center py-10 text-white/25 text-sm">No savings goals created yet</div>
            ) : (
              savingsGoals.map(goal => {
                const acc = accounts.find(a => a.id === goal.account_id);
                const pct = Math.min(100, (Number(goal.current_amount) / Number(goal.target_amount)) * 100);
                return (
                  <div key={goal.id} className="rounded-2xl p-4 space-y-2" style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.07)" }}>
                    <div className="flex items-start justify-between">
                      <div>
                        <div className="text-white font-semibold text-sm">{goal.name}</div>
                        <div className="text-white/40 text-xs">{acc?.account_name || "Unknown account"}</div>
                      </div>
                      <button onClick={() => handleToggleSavingsGoal(goal)}
                        className="text-xs px-2.5 py-1 rounded-xl font-medium"
                        style={goal.is_paused ? { background: "rgba(34,197,94,0.1)", color: "#22c55e" } : { background: "rgba(251,146,60,0.1)", color: "#fb923c" }}>
                        {goal.is_paused ? "Resume" : "Pause"}
                      </button>
                    </div>
                    <div className="flex justify-between text-xs">
                      <span className="text-white/40">{formatCurrency(goal.current_amount, "USD")} / {formatCurrency(goal.target_amount, "USD")}</span>
                      <span style={{ color: "hsl(43,85%,60%)" }}>{pct.toFixed(0)}%</span>
                    </div>
                    <div className="w-full h-1.5 rounded-full overflow-hidden" style={{ background: "rgba(255,255,255,0.08)" }}>
                      <div className="h-full rounded-full transition-all" style={{ width: `${pct}%`, background: "linear-gradient(90deg,hsl(43,85%,55%),hsl(38,80%,42%))" }} />
                    </div>
                  </div>
                );
              })
            )}
          </>
        )}

        {/* DETAIL / REVIEW VIEW */}
        {selected && (() => {
          const isTier = "requested_tier" in selected;
          const isLoan = "purpose" in selected;
          const isCheque = "delivery_address" in selected;

          return (
            <div className="space-y-3">
              <button onClick={() => { setSelected(null); setDeclineReason(""); setRepaymentTerms(""); }} className="flex items-center gap-2 text-white/50 hover:text-white text-sm">
                <ArrowLeft size={16} /> Back to list
              </button>

              <div className="rounded-3xl p-5 space-y-2" style={{ background: "hsl(220,50%,14%)", border: "1px solid rgba(255,255,255,0.08)" }}>
                <div className="text-white font-bold">{selected.account_name}</div>
                <div className="text-white/40 text-xs">{selected.account_number}</div>
                {isTier && (
                  <>
                    <div className="text-white/60 text-sm">Requesting: Tier {(selected as TierUpgradeRequest).current_tier} → Tier {(selected as TierUpgradeRequest).requested_tier} ({TIER_NAMES[(selected as TierUpgradeRequest).requested_tier]})</div>
                    {(selected as TierUpgradeRequest).id_document_type && <div className="text-white/40 text-xs">ID Type: {(selected as TierUpgradeRequest).id_document_type}</div>}
                    {(selected as TierUpgradeRequest).id_document_url && (
                      <a href={(selected as TierUpgradeRequest).id_document_url} target="_blank" rel="noopener noreferrer"
                        className="inline-flex items-center gap-1 text-xs px-3 py-1.5 rounded-xl"
                        style={{ background: "rgba(200,155,50,0.1)", color: "hsl(43,85%,60%)" }}>
                        <FileText size={12} /> View Submitted Document
                      </a>
                    )}
                    {(selected as TierUpgradeRequest).additional_notes && <div className="text-white/50 text-xs leading-relaxed">{(selected as TierUpgradeRequest).additional_notes}</div>}
                  </>
                )}
                {isLoan && (
                  <>
                    <div className="text-white font-bold text-xl" style={{ color: "hsl(43,85%,60%)" }}>{formatCurrency((selected as LoanApplication).amount, "USD")}</div>
                    <div className="text-white/60 text-sm">Purpose: {(selected as LoanApplication).purpose}</div>
                  </>
                )}
                {isCheque && (
                  <div className="text-white/60 text-sm">Delivery Address: {(selected as ChequeRequest).delivery_address || "Not specified"}</div>
                )}
                <div className="text-white/25 text-xs">{formatDateTime(selected.applied_at)}</div>
              </div>

              {selected.status === "pending" && (
                <div className="space-y-3">
                  {isLoan && (
                    <div>
                      <label className="text-white/60 text-xs mb-1 block">Repayment Terms (required for approval)</label>
                      <textarea className="dark-input resize-none text-sm w-full" rows={2}
                        placeholder="e.g. 12 monthly installments of $500, starting March 2026"
                        value={repaymentTerms} onChange={e => setRepaymentTerms(e.target.value)} />
                    </div>
                  )}
                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-2">
                      <textarea className="dark-input resize-none text-xs w-full" rows={3}
                        placeholder="Decline reason (if declining)..."
                        value={declineReason} onChange={e => setDeclineReason(e.target.value)} />
                      <button onClick={() => {
                        if (isTier) handleDeclineTier(selected as TierUpgradeRequest);
                        else if (isLoan) handleDeclineLoan(selected as LoanApplication);
                        else handleDeclineCheque(selected as ChequeRequest);
                      }} disabled={processing || !declineReason.trim()}
                        className="w-full py-2.5 rounded-xl text-xs font-semibold"
                        style={{ background: "rgba(239,68,68,0.15)", color: "#f87171", opacity: !declineReason.trim() ? 0.5 : 1 }}>
                        Decline
                      </button>
                    </div>
                    <button onClick={() => {
                      if (isTier) handleApproveTier(selected as TierUpgradeRequest);
                      else if (isLoan) handleApproveLoan(selected as LoanApplication);
                      else handleApproveCheque(selected as ChequeRequest);
                    }} disabled={processing} className="gold-btn text-sm font-semibold flex items-center justify-center">
                      {processing ? <div className="w-4 h-4 border-2 border-gray-900/30 border-t-gray-900 rounded-full animate-spin" /> : "Approve"}
                    </button>
                  </div>
                </div>
              )}
              {selected.status !== "pending" && (
                <div className="text-center py-4 text-white/30 text-sm">This request has already been {selected.status}.</div>
              )}
            </div>
          );
        })()}
      </div>
    </div>
  );
}
