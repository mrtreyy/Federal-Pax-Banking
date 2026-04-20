import { useState, useEffect } from "react";
import { ArrowLeft, CreditCard, CheckCircle, XCircle, Clock, User, RefreshCw, Snowflake, Edit2, Lock, Unlock, DollarSign, Calendar } from "lucide-react";
import { supabase, type VirtualCardApplication, type Account } from "@/lib/supabase";
import { formatDateTime, formatCurrency } from "@/lib/utils";
import { usePolling } from "@/hooks/usePolling";
import { toast } from "sonner";

interface Props {
  onClose: () => void;
  accounts?: Account[];
}

function generateCardNumber(): string {
  const groups = Array.from({ length: 4 }, () =>
    Math.floor(1000 + Math.random() * 9000).toString()
  );
  groups[0] = "4" + groups[0].slice(1);
  return groups.join(" ");
}
function generateCVV(): string { return Math.floor(100 + Math.random() * 900).toString(); }
function generateExpiry(): string {
  const now = new Date();
  const year = (now.getFullYear() + 3) % 100;
  const month = String(now.getMonth() + 1).padStart(2, "0");
  return `${month}/${year}`;
}
function todayStr(): string { return new Date().toISOString().split("T")[0]; }

export default function CASVirtualCardReview({ onClose, accounts = [] }: Props) {
  const [applications, setApplications] = useState<VirtualCardApplication[]>([]);
  const [selected, setSelected] = useState<VirtualCardApplication | null>(null);
  const [loading, setLoading] = useState(true);
  const [processing, setProcessing] = useState(false);
  const [declineReason, setDeclineReason] = useState("");
  const [showDeclineInput, setShowDeclineInput] = useState(false);
  const [filterStatus, setFilterStatus] = useState<"all" | "pending" | "approved" | "declined">("pending");
  // Edit fields
  const [editMode, setEditMode] = useState(false);
  const [editExpiry, setEditExpiry] = useState("");
  const [editIssued, setEditIssued] = useState("");
  const [editDailyLimit, setEditDailyLimit] = useState("");
  const [editMonthlyLimit, setEditMonthlyLimit] = useState("");
  const [editCardHolder, setEditCardHolder] = useState("");

  const fetchApplications = async () => {
    const { data } = await supabase
      .from("virtual_card_applications")
      .select("*")
      .order("applied_at", { ascending: false });
    if (data) setApplications(data as VirtualCardApplication[]);
    setLoading(false);
  };

  useEffect(() => { fetchApplications(); }, []);
  usePolling(fetchApplications, 10000, !selected && !editMode);

  const handleApprove = async () => {
    if (!selected || processing) return;
    setProcessing(true);

    const cardNumber = generateCardNumber();
    const cardCVV = generateCVV();
    const cardExpiry = editExpiry || generateExpiry();
    const issuedDate = editIssued || todayStr();
    const now = new Date().toISOString();

    const { error } = await supabase.from("virtual_card_applications").update({
      status: "approved",
      reviewed_at: now,
      reviewed_by: "CEO",
      card_number: cardNumber,
      card_holder: (editCardHolder || selected.account_name).toUpperCase(),
      card_expiry: cardExpiry,
      card_cvv: cardCVV,
      card_type: "Visa Virtual",
      card_is_frozen: false,
      card_daily_limit: editDailyLimit ? parseFloat(editDailyLimit) : null,
      card_monthly_limit: editMonthlyLimit ? parseFloat(editMonthlyLimit) : null,
      issued_date: issuedDate,
    }).eq("id", selected.id);

    if (error) { toast.error("Failed to approve application."); setProcessing(false); return; }

    await supabase.from("banking_notifications").insert({
      account_id: selected.account_id,
      target: selected.account_id,
      title: "🎉 Virtual Card Approved",
      body: `Congratulations, ${selected.account_name}! Your BankUnited Virtual Visa Card application has been approved by our CEO administration. Your card is now active and available in your account dashboard. Card limits ${editDailyLimit ? `(Daily: ${formatCurrency(parseFloat(editDailyLimit), "USD")})` : ""} have been configured. Please keep your card details strictly confidential.`,
      is_read: false,
    });

    toast.success(`Virtual card approved for ${selected.account_name}.`);
    setSelected(null);
    setEditMode(false);
    setProcessing(false);
    fetchApplications();
  };

  const handleDecline = async () => {
    if (!selected || processing || !declineReason.trim()) { toast.error("Please provide a decline reason."); return; }
    setProcessing(true);

    await supabase.from("virtual_card_applications").update({
      status: "declined",
      reviewed_at: new Date().toISOString(),
      reviewed_by: "CEO",
      decline_reason: declineReason.trim(),
    }).eq("id", selected.id);

    await supabase.from("banking_notifications").insert({
      account_id: selected.account_id,
      target: selected.account_id,
      title: "Virtual Card Application — Decision",
      body: `Dear ${selected.account_name}, following a thorough review of your BankUnited Virtual Visa Card application, we regret to inform you that your request has not been approved at this time. Reason: ${declineReason.trim()}. You may reapply through your dashboard. We sincerely apologise for any inconvenience this may cause.`,
      is_read: false,
    });

    toast.success(`Application declined. ${selected.account_name} has been notified.`);
    setSelected(null);
    setDeclineReason("");
    setShowDeclineInput(false);
    setProcessing(false);
    fetchApplications();
  };

  const handleToggleCardFreeze = async (app: VirtualCardApplication) => {
    const newVal = !app.card_is_frozen;
    await supabase.from("virtual_card_applications").update({ card_is_frozen: newVal }).eq("id", app.id);
    await supabase.from("banking_notifications").insert({
      account_id: app.account_id,
      target: app.account_id,
      title: newVal ? "Virtual Card Suspended" : "Virtual Card Reactivated",
      body: newVal
        ? "Your BKU Virtual Visa Card has been temporarily suspended by administration. Contact support for assistance."
        : "Your BKU Virtual Visa Card has been reactivated. You may resume online transactions immediately.",
      is_read: false,
    });
    toast.success(`Card ${newVal ? "frozen" : "unfrozen"} for ${app.account_name}.`);
    fetchApplications();
    if (selected?.id === app.id) setSelected({ ...app, card_is_frozen: newVal });
  };

  const handleSaveEdit = async () => {
    if (!selected) return;
    setProcessing(true);
    const update: Record<string, unknown> = {};
    if (editExpiry) update.card_expiry = editExpiry;
    if (editIssued) update.issued_date = editIssued;
    if (editDailyLimit) update.card_daily_limit = parseFloat(editDailyLimit);
    if (editMonthlyLimit) update.card_monthly_limit = parseFloat(editMonthlyLimit);
    if (editCardHolder) update.card_holder = editCardHolder.toUpperCase();
    await supabase.from("virtual_card_applications").update(update).eq("id", selected.id);
    toast.success("Card details updated.");
    setEditMode(false);
    setProcessing(false);
    fetchApplications();
    const { data } = await supabase.from("virtual_card_applications").select("*").eq("id", selected.id).single();
    if (data) setSelected(data as VirtualCardApplication);
  };

  const filtered = applications.filter(a => filterStatus === "all" || a.status === filterStatus);
  const pendingCount = applications.filter(a => a.status === "pending").length;

  if (selected) {
    const linkedAccount = accounts.find(a => a.id === selected.account_id);
    return (
      <div className="fixed inset-0 z-[60] flex flex-col" style={{ background: "hsl(220,45%,8%)" }}>
        <div className="flex items-center gap-3 px-5 pt-12 pb-4 flex-shrink-0" style={{ background: "hsl(220,55%,12%)", borderBottom: "1px solid rgba(255,255,255,0.06)" }}>
          <button onClick={() => { setSelected(null); setEditMode(false); setShowDeclineInput(false); }} className="text-white/40 hover:text-white">
            <ArrowLeft size={20} />
          </button>
          <CreditCard size={18} style={{ color: "hsl(43,85%,60%)" }} />
          <div className="text-white font-bold flex-1">Card Application Detail</div>
          <span className={`text-xs px-2.5 py-1 rounded-full font-semibold ${
            selected.status === "pending" ? "bg-yellow-500/15 text-yellow-400" :
            selected.status === "approved" ? "bg-green-500/15 text-green-400" : "bg-red-500/15 text-red-400"
          }`}>{selected.status.toUpperCase()}</span>
        </div>

        <div className="flex-1 overflow-y-auto p-5 space-y-4 pb-8">
          {/* Applicant */}
          <div className="rounded-3xl p-5 space-y-3" style={{ background: "hsl(220,50%,14%)", border: "1px solid rgba(255,255,255,0.08)" }}>
            <div className="flex items-center gap-3 pb-3" style={{ borderBottom: "1px solid rgba(255,255,255,0.07)" }}>
              <div className="w-12 h-12 rounded-2xl flex items-center justify-center" style={{ background: "rgba(200,155,50,0.15)" }}>
                <User size={20} style={{ color: "hsl(43,85%,60%)" }} />
              </div>
              <div>
                <div className="text-white font-bold">{selected.account_name}</div>
                <div className="text-white/40 text-xs font-mono">{selected.account_number}</div>
                {linkedAccount && <div className="text-white/30 text-xs">Tier {linkedAccount.account_tier || 1} · {linkedAccount.currency}</div>}
              </div>
            </div>
            {[
              ["Applied", formatDateTime(selected.applied_at)],
              ["Decline History", selected.decline_count > 0 ? `${selected.decline_count} previous decline(s)` : "First application"],
              ...(selected.status !== "pending" ? [
                ["Reviewed", selected.reviewed_at ? formatDateTime(selected.reviewed_at) : "—"],
                ["Reviewed By", selected.reviewed_by || "—"],
              ] : []),
              ...(selected.decline_reason ? [["Decline Reason", selected.decline_reason]] : []),
            ].map(([l, v]) => (
              <div key={l} className="flex justify-between py-1.5" style={{ borderBottom: "1px solid rgba(255,255,255,0.05)" }}>
                <span className="text-white/40 text-xs">{l}</span>
                <span className="text-white text-xs font-medium text-right max-w-[55%]">{v}</span>
              </div>
            ))}
          </div>

          {/* Approved card details / Edit mode */}
          {selected.status === "approved" && (
            <div className="rounded-3xl p-5 space-y-3" style={{ background: "rgba(34,197,94,0.05)", border: "1px solid rgba(34,197,94,0.2)" }}>
              <div className="flex items-center justify-between mb-2">
                <div className="text-green-400 font-semibold text-sm">Issued Card Details</div>
                <div className="flex items-center gap-2">
                  <button onClick={() => handleToggleCardFreeze(selected)}
                    className="flex items-center gap-1 px-3 py-1.5 rounded-xl text-xs font-medium"
                    style={{ background: selected.card_is_frozen ? "rgba(59,130,246,0.2)" : "rgba(255,255,255,0.07)", color: selected.card_is_frozen ? "#60a5fa" : "rgba(255,255,255,0.5)" }}>
                    {selected.card_is_frozen ? <><Unlock size={10} /> Unfreeze</> : <><Snowflake size={10} /> Freeze</>}
                  </button>
                  <button onClick={() => {
                    setEditMode(!editMode);
                    setEditExpiry(selected.card_expiry || "");
                    setEditIssued(selected.issued_date || "");
                    setEditDailyLimit(selected.card_daily_limit ? String(selected.card_daily_limit) : "");
                    setEditMonthlyLimit(selected.card_monthly_limit ? String(selected.card_monthly_limit) : "");
                    setEditCardHolder(selected.card_holder || "");
                  }} className="flex items-center gap-1 px-3 py-1.5 rounded-xl text-xs font-medium" style={{ background: "rgba(200,155,50,0.1)", color: "hsl(43,85%,60%)" }}>
                    <Edit2 size={10} /> Edit
                  </button>
                </div>
              </div>

              {selected.card_is_frozen && (
                <div className="p-2 rounded-xl text-center" style={{ background: "rgba(59,130,246,0.1)" }}>
                  <span className="text-blue-400 text-xs font-semibold">❄ Card Currently Frozen</span>
                </div>
              )}

              {editMode ? (
                <div className="space-y-3">
                  <div>
                    <label className="text-white/40 text-xs mb-1 block">Card Holder Name</label>
                    <input className="dark-input text-sm" value={editCardHolder} onChange={e => setEditCardHolder(e.target.value)} />
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <label className="text-white/40 text-xs mb-1 block">Expiry (MM/YY)</label>
                      <input className="dark-input text-sm" placeholder="MM/YY" value={editExpiry} onChange={e => setEditExpiry(e.target.value)} />
                    </div>
                    <div>
                      <label className="text-white/40 text-xs mb-1 block">Issued Date</label>
                      <input type="date" className="dark-input text-sm" value={editIssued} onChange={e => setEditIssued(e.target.value)} />
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <label className="text-white/40 text-xs mb-1 block">Daily Limit</label>
                      <input type="number" className="dark-input text-sm" placeholder="Unlimited" value={editDailyLimit} onChange={e => setEditDailyLimit(e.target.value)} />
                    </div>
                    <div>
                      <label className="text-white/40 text-xs mb-1 block">Monthly Limit</label>
                      <input type="number" className="dark-input text-sm" placeholder="Unlimited" value={editMonthlyLimit} onChange={e => setEditMonthlyLimit(e.target.value)} />
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <button onClick={() => setEditMode(false)} className="py-2.5 rounded-xl text-sm text-white/50" style={{ background: "rgba(255,255,255,0.07)" }}>Cancel</button>
                    <button onClick={handleSaveEdit} disabled={processing} className="gold-btn py-2.5 text-sm font-semibold">Save</button>
                  </div>
                </div>
              ) : (
                [
                  ["Card Number", selected.card_number || "—"],
                  ["Card Holder", selected.card_holder || "—"],
                  ["Expiry", selected.card_expiry || "—"],
                  ["CVV", selected.card_cvv || "—"],
                  ["Issued Date", selected.issued_date || "—"],
                  ["Daily Limit", selected.card_daily_limit ? formatCurrency(selected.card_daily_limit, "USD") : "Unlimited"],
                  ["Monthly Limit", selected.card_monthly_limit ? formatCurrency(selected.card_monthly_limit, "USD") : "Unlimited"],
                  ["Card Status", selected.card_is_frozen ? "❄ Frozen" : "✓ Active"],
                ].map(([l, v]) => (
                  <div key={l} className="flex justify-between py-1.5" style={{ borderBottom: "1px solid rgba(255,255,255,0.06)" }}>
                    <span className="text-white/40 text-xs">{l}</span>
                    <span className="text-white text-xs font-mono font-medium">{v}</span>
                  </div>
                ))
              )}
            </div>
          )}

          {/* Pending — set limits before approving */}
          {selected.status === "pending" && (
            <div className="rounded-3xl p-4 space-y-3" style={{ background: "rgba(200,155,50,0.05)", border: "1px solid rgba(200,155,50,0.2)" }}>
              <div className="text-yellow-400/80 text-sm font-semibold">Set Card Parameters (Optional)</div>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="text-white/40 text-xs mb-1 block">Card Holder Name</label>
                  <input className="dark-input text-xs" placeholder={selected.account_name} value={editCardHolder} onChange={e => setEditCardHolder(e.target.value)} />
                </div>
                <div>
                  <label className="text-white/40 text-xs mb-1 block">Expiry (MM/YY)</label>
                  <input className="dark-input text-xs" placeholder="Auto-generate" value={editExpiry} onChange={e => setEditExpiry(e.target.value)} />
                </div>
                <div>
                  <label className="text-white/40 text-xs mb-1 block">Issued Date</label>
                  <input type="date" className="dark-input text-xs" value={editIssued} onChange={e => setEditIssued(e.target.value)} />
                </div>
                <div>
                  <label className="text-white/40 text-xs mb-1 block">Daily Limit</label>
                  <input type="number" className="dark-input text-xs" placeholder="Unlimited" value={editDailyLimit} onChange={e => setEditDailyLimit(e.target.value)} />
                </div>
                <div className="col-span-2">
                  <label className="text-white/40 text-xs mb-1 block">Monthly Limit</label>
                  <input type="number" className="dark-input text-xs" placeholder="Unlimited" value={editMonthlyLimit} onChange={e => setEditMonthlyLimit(e.target.value)} />
                </div>
              </div>
            </div>
          )}

          {/* Actions */}
          {selected.status === "pending" && !showDeclineInput && (
            <div className="grid grid-cols-2 gap-3">
              <button onClick={() => setShowDeclineInput(true)} disabled={processing}
                className="py-3.5 rounded-2xl text-sm font-semibold flex items-center justify-center gap-2"
                style={{ background: "rgba(239,68,68,0.12)", color: "#f87171", border: "1px solid rgba(239,68,68,0.25)" }}>
                <XCircle size={15} /> Decline
              </button>
              <button onClick={handleApprove} disabled={processing} className="gold-btn py-3.5 text-sm font-semibold flex items-center justify-center gap-2">
                {processing ? <div className="w-4 h-4 border-2 border-gray-900/30 border-t-gray-900 rounded-full animate-spin" /> : <><CheckCircle size={15} /> Approve</>}
              </button>
            </div>
          )}

          {selected.status === "pending" && showDeclineInput && (
            <div className="rounded-3xl p-4 space-y-3" style={{ background: "rgba(239,68,68,0.06)", border: "1px solid rgba(239,68,68,0.2)" }}>
              <div className="text-red-400 text-sm font-semibold">Reason for Declining</div>
              <textarea className="dark-input resize-none w-full text-sm" rows={4}
                placeholder="Provide a professional reason for declining this application. The applicant will receive this message directly..."
                value={declineReason} onChange={e => setDeclineReason(e.target.value)} />
              <div className="grid grid-cols-2 gap-3">
                <button onClick={() => { setShowDeclineInput(false); setDeclineReason(""); }}
                  className="py-3 rounded-2xl text-white/60 text-sm" style={{ background: "rgba(255,255,255,0.07)" }}>Back</button>
                <button onClick={handleDecline} disabled={processing || !declineReason.trim()}
                  className="py-3 rounded-2xl text-sm font-semibold flex items-center justify-center gap-2"
                  style={{ background: "rgba(239,68,68,0.2)", color: "#f87171", opacity: !declineReason.trim() ? 0.5 : 1 }}>
                  {processing ? <div className="w-4 h-4 border-2 border-red-400/30 border-t-red-400 rounded-full animate-spin" /> : <><XCircle size={14} /> Confirm Decline</>}
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 z-[60] flex flex-col" style={{ background: "hsl(220,45%,8%)" }}>
      <div className="flex items-center gap-3 px-5 pt-12 pb-4 flex-shrink-0" style={{ background: "hsl(220,55%,12%)", borderBottom: "1px solid rgba(255,255,255,0.06)" }}>
        <button onClick={onClose} className="text-white/40 hover:text-white"><ArrowLeft size={20} /></button>
        <CreditCard size={18} style={{ color: "hsl(43,85%,60%)" }} />
        <div className="text-white font-bold flex-1">Virtual Card Applications</div>
        {pendingCount > 0 && (
          <span className="bg-yellow-500 text-gray-900 text-xs rounded-full px-2 py-0.5 font-bold">{pendingCount} pending</span>
        )}
      </div>

      <div className="flex gap-2 px-4 pt-3 pb-2 flex-shrink-0">
        {(["pending", "approved", "declined", "all"] as const).map(s => (
          <button key={s} onClick={() => setFilterStatus(s)}
            className="px-3 py-1.5 rounded-xl text-xs font-semibold capitalize flex-shrink-0"
            style={filterStatus === s ? { background: "hsl(43,85%,55%)", color: "#111" } : { background: "rgba(255,255,255,0.07)", color: "rgba(255,255,255,0.5)" }}>
            {s} ({s === "all" ? applications.length : applications.filter(a => a.status === s).length})
          </button>
        ))}
      </div>

      <div className="flex-1 overflow-y-auto p-4 space-y-3">
        {loading ? (
          <div className="flex items-center justify-center py-16">
            <div className="w-6 h-6 border-2 border-yellow-500/30 border-t-yellow-500 rounded-full animate-spin" />
          </div>
        ) : filtered.length === 0 ? (
          <div className="text-center py-16">
            <CreditCard size={40} className="mx-auto mb-3 text-white/10" />
            <div className="text-white/25 text-sm">No {filterStatus === "all" ? "" : filterStatus} applications</div>
          </div>
        ) : (
          filtered.map(app => (
            <button key={app.id} onClick={() => { setSelected(app); setEditExpiry(app.card_expiry || ""); setEditIssued(app.issued_date || ""); setEditDailyLimit(app.card_daily_limit ? String(app.card_daily_limit) : ""); setEditMonthlyLimit(app.card_monthly_limit ? String(app.card_monthly_limit) : ""); setEditCardHolder(app.card_holder || ""); }}
              className="w-full text-left rounded-3xl p-4 space-y-2 transition-colors hover:bg-white/5"
              style={{ background: "rgba(255,255,255,0.03)", border: `1px solid ${app.status === "pending" ? "rgba(200,155,50,0.25)" : app.status === "approved" ? "rgba(34,197,94,0.2)" : "rgba(239,68,68,0.2)"}` }}>
              <div className="flex items-start justify-between gap-3">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-2xl flex items-center justify-center flex-shrink-0"
                    style={{ background: app.status === "pending" ? "rgba(200,155,50,0.15)" : app.status === "approved" ? "rgba(34,197,94,0.12)" : "rgba(239,68,68,0.12)" }}>
                    {app.status === "pending" ? <Clock size={16} style={{ color: "hsl(43,85%,60%)" }} /> :
                     app.status === "approved" ? <CheckCircle size={16} color="#22c55e" /> : <XCircle size={16} color="#f87171" />}
                  </div>
                  <div className="min-w-0">
                    <div className="text-white font-semibold text-sm truncate">{app.account_name}</div>
                    <div className="text-white/40 text-xs font-mono">{app.account_number}</div>
                    {app.status === "approved" && app.card_is_frozen && (
                      <div className="text-blue-400 text-xs">❄ Card Frozen</div>
                    )}
                  </div>
                </div>
                <span className={`text-xs px-2 py-0.5 rounded-full font-semibold flex-shrink-0 ${
                  app.status === "pending" ? "bg-yellow-500/15 text-yellow-400" :
                  app.status === "approved" ? "bg-green-500/15 text-green-400" : "bg-red-500/15 text-red-400"}`}>
                  {app.status}
                </span>
              </div>
              <div className="flex items-center justify-between text-xs">
                <span className="text-white/30">{formatDateTime(app.applied_at)}</span>
                <div className="flex items-center gap-2">
                  {app.card_daily_limit && <span className="text-white/30">Daily: {formatCurrency(app.card_daily_limit, "USD")}</span>}
                  {app.decline_count > 0 && <span className="flex items-center gap-1 text-orange-400/70"><RefreshCw size={10} /> {app.decline_count}</span>}
                </div>
              </div>
            </button>
          ))
        )}
      </div>
    </div>
  );
}
