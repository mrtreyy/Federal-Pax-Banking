import { useState, useEffect } from "react";
import { ArrowLeft, FileText, Clock, CheckCircle, X, Plus } from "lucide-react";
import { supabase, type Account, trackFeatureUse, logAudit } from "@/lib/supabase";
import { formatDateTime } from "@/lib/utils";
import { usePolling } from "@/hooks/usePolling";
import { toast } from "sonner";

interface Props {
  account: Account;
  onBack: () => void;
}

interface StatementRequest {
  id: string;
  account_id: string;
  account_name: string;
  account_number: string;
  account_email: string;
  period_months?: number;
  period_from?: string;
  period_to?: string;
  period_label: string;
  status: string;
  created_at: string;
}

const PERIOD_OPTIONS = [
  { label: "Last 1 Month", months: 1 },
  { label: "Last 3 Months", months: 3 },
  { label: "Last 6 Months", months: 6 },
  { label: "Last 12 Months", months: 12 },
  { label: "Custom Range", months: 0 },
];

export default function StatementRequestPage({ account, onBack }: Props) {
  const [requests, setRequests] = useState<StatementRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [submitted, setSubmitted] = useState(false);

  const [selectedPeriod, setSelectedPeriod] = useState(1);
  const [customFrom, setCustomFrom] = useState("");
  const [customTo, setCustomTo] = useState("");
  const [email, setEmail] = useState(account.login_email);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    trackFeatureUse(account.account_name, account.id, "statement_request");
    fetchRequests();
  }, [account.id]);

  const fetchRequests = async () => {
    const { data } = await supabase.from("statement_requests").select("*").eq("account_id", account.id).order("created_at", { ascending: false });
    if (data) setRequests(data as StatementRequest[]);
    setLoading(false);
  };

  usePolling(fetchRequests, 10000, !showForm);

  const handleSubmit = async () => {
    if (selectedPeriod === 0 && (!customFrom || !customTo)) { toast.error("Please specify a custom date range."); return; }
    setSubmitting(true);

    const periodOption = PERIOD_OPTIONS.find(p => p.months === selectedPeriod);
    const periodLabel = selectedPeriod === 0 ? `${customFrom} to ${customTo}` : periodOption?.label || "";

    const { error } = await supabase.from("statement_requests").insert({
      account_id: account.id,
      account_name: account.account_name,
      account_number: account.account_number,
      account_email: email,
      period_months: selectedPeriod || null,
      period_from: selectedPeriod === 0 ? customFrom : null,
      period_to: selectedPeriod === 0 ? customTo : null,
      period_label: periodLabel,
      status: "pending",
    });

    if (error) { toast.error("Could not submit request. Please try again."); setSubmitting(false); return; }

    // Notify CAS
    await supabase.from("banking_notifications").insert({
      account_id: account.id,
      target: "cas",
      title: "Bank Statement Request",
      body: `${account.account_name} (${account.account_number}) has requested a bank statement. Period: ${periodLabel}. Email: ${email}. Account Tier: ${account.account_tier || 1}. Account Currency: ${account.currency}.`,
      is_read: false,
    });

    await logAudit("statement_request_submitted", account.id, account.account_name, { period: periodLabel, email }, account.account_name, "individual");

    setSubmitted(true);
    setShowForm(false);
    setSubmitting(false);
    fetchRequests();
    setTimeout(() => setSubmitted(false), 5000);
  };

  if (loading) return (
    <div className="min-h-screen flex items-center justify-center" style={{ background: "hsl(220,45%,8%)" }}>
      <div className="w-8 h-8 border-2 border-yellow-500/30 border-t-yellow-500 rounded-full animate-spin" />
    </div>
  );

  return (
    <div className="min-h-screen" style={{ background: "hsl(220,45%,8%)" }}>
      <div className="sticky top-0 z-30 flex items-center gap-3 px-5 pt-12 pb-4" style={{ background: "hsl(220,55%,12%)", borderBottom: "1px solid rgba(255,255,255,0.06)" }}>
        <button onClick={onBack} className="text-white/40 hover:text-white"><ArrowLeft size={20} /></button>
        <FileText size={18} style={{ color: "hsl(43,85%,60%)" }} />
        <div className="flex-1">
          <div className="text-white font-bold">Statement Requests</div>
          <div className="text-white/40 text-xs">Request your official bank statement</div>
        </div>
        <button onClick={() => setShowForm(true)} className="gold-btn px-3 py-1.5 text-xs font-semibold flex items-center gap-1">
          <Plus size={13} /> Request
        </button>
      </div>

      <div className="px-4 pt-4 pb-8 space-y-4">
        {/* Submitted confirmation */}
        {submitted && (
          <div className="rounded-3xl p-5 text-center space-y-3" style={{ background: "rgba(34,197,94,0.07)", border: "1px solid rgba(34,197,94,0.2)" }}>
            <CheckCircle size={28} color="#22c55e" className="mx-auto" />
            <div className="text-white font-bold">Request Received</div>
            <div className="text-white/60 text-sm leading-relaxed">
              Your bank statement request has been received. Please allow <strong>2-3 business working days</strong> for processing. The statement will be delivered to your registered email address: <strong>{email}</strong>.
            </div>
          </div>
        )}

        {/* Previous Requests */}
        <div>
          <div className="text-white/50 text-xs font-semibold uppercase tracking-wide mb-2">Previous Requests ({requests.length})</div>
          {requests.length === 0 ? (
            <div className="text-center py-10 rounded-3xl text-white/20 text-sm" style={{ background: "rgba(255,255,255,0.02)", border: "1px solid rgba(255,255,255,0.05)" }}>
              No statement requests yet
            </div>
          ) : (
            requests.map(req => (
              <div key={req.id} className="flex items-center gap-3 p-4 rounded-2xl mb-2"
                style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)" }}>
                <div className="w-10 h-10 rounded-2xl flex items-center justify-center flex-shrink-0" style={{ background: "rgba(200,155,50,0.1)" }}>
                  <FileText size={16} style={{ color: "hsl(43,85%,60%)" }} />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="text-white font-semibold text-sm">{req.period_label}</div>
                  <div className="text-white/40 text-xs">{formatDateTime(req.created_at)}</div>
                </div>
                <span className={`text-xs px-2.5 py-1 rounded-full font-semibold ${req.status === "pending" ? "bg-yellow-500/15 text-yellow-400" : req.status === "completed" ? "bg-green-500/15 text-green-400" : "bg-red-500/15 text-red-400"}`}>
                  {req.status.charAt(0).toUpperCase() + req.status.slice(1)}
                </span>
              </div>
            ))
          )}
        </div>
      </div>

      {/* Request Form Modal */}
      {showForm && (
        <div className="fixed inset-0 z-50 flex items-end justify-center">
          <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" onClick={() => setShowForm(false)} />
          <div className="relative w-full max-w-sm rounded-t-3xl overflow-hidden" style={{ background: "hsl(220,50%,12%)", border: "1px solid rgba(255,255,255,0.1)", maxHeight: "90vh" }}>
            <div className="flex items-center justify-between p-5" style={{ borderBottom: "1px solid rgba(255,255,255,0.08)" }}>
              <div className="text-white font-bold">Request Bank Statement</div>
              <button onClick={() => setShowForm(false)} className="text-white/40"><X size={18} /></button>
            </div>
            <div className="p-5 space-y-4 overflow-y-auto" style={{ maxHeight: "75vh" }}>
              <div>
                <label className="text-white/60 text-xs mb-1.5 block">Statement Period</label>
                <div className="space-y-2">
                  {PERIOD_OPTIONS.map(opt => (
                    <button key={opt.months} onClick={() => setSelectedPeriod(opt.months)}
                      className="w-full text-left px-4 py-3 rounded-2xl text-sm flex items-center justify-between"
                      style={{ background: selectedPeriod === opt.months ? "rgba(200,155,50,0.15)" : "rgba(255,255,255,0.04)", border: `1px solid ${selectedPeriod === opt.months ? "rgba(200,155,50,0.4)" : "rgba(255,255,255,0.08)"}` }}>
                      <span className="text-white">{opt.label}</span>
                      {selectedPeriod === opt.months && <CheckCircle size={14} style={{ color: "hsl(43,85%,60%)" }} />}
                    </button>
                  ))}
                </div>
              </div>
              {selectedPeriod === 0 && (
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-white/60 text-xs mb-1.5 block">From Date</label>
                    <input type="date" className="dark-input py-2 text-sm" value={customFrom} onChange={e => setCustomFrom(e.target.value)} />
                  </div>
                  <div>
                    <label className="text-white/60 text-xs mb-1.5 block">To Date</label>
                    <input type="date" className="dark-input py-2 text-sm" value={customTo} onChange={e => setCustomTo(e.target.value)} />
                  </div>
                </div>
              )}
              <div>
                <label className="text-white/60 text-xs mb-1.5 block">Delivery Email</label>
                <input type="email" className="dark-input" value={email} onChange={e => setEmail(e.target.value)} />
                <div className="text-white/25 text-xs mt-1">Statement will be sent to this email address</div>
              </div>
              <div className="rounded-2xl p-3" style={{ background: "rgba(200,155,50,0.06)", border: "1px solid rgba(200,155,50,0.15)" }}>
                <div className="flex items-center gap-2 mb-1">
                  <Clock size={13} style={{ color: "hsl(43,85%,60%)" }} />
                  <span className="text-yellow-400/80 text-xs font-semibold">Processing Time</span>
                </div>
                <div className="text-white/50 text-xs leading-relaxed">
                  Please allow <strong className="text-white/70">2-3 business working days</strong> for your statement to be processed and delivered to your registered email address.
                </div>
              </div>
              <button onClick={handleSubmit} disabled={submitting} className="gold-btn w-full py-3 text-sm font-semibold flex items-center justify-center gap-2">
                {submitting ? <div className="w-4 h-4 border-2 border-gray-900/30 border-t-gray-900 rounded-full animate-spin" /> : <><FileText size={14} /> Submit Request</>}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
