import { useState, useEffect } from "react";
import { ChevronUp, Star, Clock, CheckCircle, XCircle, Upload, ArrowLeft, RefreshCw } from "lucide-react";
import { supabase, type Account, type TierUpgradeRequest, trackFeatureUse } from "@/lib/supabase";
import { formatDateTime } from "@/lib/utils";
import { toast } from "sonner";
import { usePolling } from "@/hooks/usePolling";

interface Props {
  account: Account;
  onBack: () => void;
}

const TIER_NAMES: Record<number, { name: string; color: string; benefits: string[] }> = {
  1: { name: "Standard", color: "rgba(255,255,255,0.5)", benefits: ["Basic transfers", "Virtual card access", "Chat support"] },
  2: { name: "Silver", color: "#94a3b8", benefits: ["Higher transfer limits", "Priority support", "Savings goals"] },
  3: { name: "Gold", color: "#c89b3c", benefits: ["Loan facility", "Cheque book", "Currency wallet"] },
  4: { name: "Platinum", color: "#60a5fa", benefits: ["Premium card design", "Dedicated account manager", "Extended credit"] },
  5: { name: "Elite", color: "#a855f7", benefits: ["All premium features", "Top priority CEO access", "Unlimited benefits"] },
};

export default function TierUpgradeSection({ account, onBack }: Props) {
  const [request, setRequest] = useState<TierUpgradeRequest | null>(null);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [docType, setDocType] = useState("NIN");
  const [docUrl, setDocUrl] = useState("");
  const [notes, setNotes] = useState("");
  const [uploading, setUploading] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const currentTier = account.account_tier || 1;
  const nextTier = Math.min(currentTier + 1, 5);
  const isMaxTier = currentTier >= 5;

  useEffect(() => {
    trackFeatureUse(account.account_name, account.id, "tier_upgrade");
  }, [account.id, account.account_name]);

  const fetchRequest = async () => {
    const { data } = await supabase
      .from("tier_upgrade_requests")
      .select("*")
      .eq("account_id", account.id)
      .order("applied_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    setRequest(data || null);
    setLoading(false);
  };

  useEffect(() => { fetchRequest(); }, [account.id]);
  usePolling(fetchRequest, 8000, true);

  const handleUploadDoc = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    const path = `tier-doc-${account.id}-${Date.now()}.${file.name.split(".").pop()}`;
    const { data, error } = await supabase.storage.from("profiles").upload(path, file, { upsert: true });
    if (!error && data) {
      const { data: url } = supabase.storage.from("profiles").getPublicUrl(data.path);
      setDocUrl(url.publicUrl);
      toast.success("Document uploaded successfully.");
    } else {
      toast.error("Upload failed. Please try again.");
    }
    setUploading(false);
  };

  const handleSubmit = async () => {
    if (!docUrl) { toast.error("Please upload a valid identity document to proceed."); return; }
    setSubmitting(true);

    // Delete previous declined request
    if (request && request.status === "declined") {
      await supabase.from("tier_upgrade_requests").delete().eq("id", request.id);
    }

    const { error } = await supabase.from("tier_upgrade_requests").insert({
      account_id: account.id,
      account_name: account.account_name,
      account_number: account.account_number,
      current_tier: currentTier,
      requested_tier: nextTier,
      id_document_url: docUrl,
      id_document_type: docType,
      additional_notes: notes.trim() || null,
      status: "pending",
    });

    if (error) { toast.error("Submission failed. Please try again."); setSubmitting(false); return; }

    await supabase.from("banking_notifications").insert({
      account_id: account.id,
      target: "cas",
      title: `Tier Upgrade Request — ${account.account_name}`,
      body: `${account.account_name} (${account.account_number}) has requested a tier upgrade from Tier ${currentTier} to Tier ${nextTier} (${TIER_NAMES[nextTier]?.name}). ID Type: ${docType}.`,
      is_read: false,
    });

    toast.success("Tier upgrade request submitted successfully.");
    setShowForm(false);
    setDocUrl("");
    setNotes("");
    setSubmitting(false);
    fetchRequest();
  };

  if (loading) return (
    <div className="min-h-screen flex items-center justify-center" style={{ background: "hsl(220,45%,8%)" }}>
      <div className="w-8 h-8 border-2 border-yellow-500/30 border-t-yellow-500 rounded-full animate-spin" />
    </div>
  );

  const tierInfo = TIER_NAMES[currentTier];
  const nextTierInfo = TIER_NAMES[nextTier];

  return (
    <div className="min-h-screen" style={{ background: "hsl(220,45%,8%)" }}>
      <div className="sticky top-0 z-30 flex items-center gap-3 px-5 pt-12 pb-4" style={{ background: "hsl(220,55%,12%)", borderBottom: "1px solid rgba(255,255,255,0.06)" }}>
        <button onClick={onBack} className="text-white/40 hover:text-white"><ArrowLeft size={20} /></button>
        <ChevronUp size={18} style={{ color: "hsl(43,85%,60%)" }} />
        <div className="flex-1">
          <div className="text-white font-bold">Account Tier</div>
          <div className="text-white/40 text-xs">GHOB Tiered Banking</div>
        </div>
      </div>

      <div className="px-4 pt-6 pb-8 space-y-5">
        {/* Current Tier Card */}
        <div className="rounded-3xl p-6 relative overflow-hidden text-center"
          style={{ background: `linear-gradient(135deg, hsl(220,60%,16%) 0%, hsl(220,70%,11%) 100%)`, border: `1px solid ${tierInfo.color}30` }}>
          <div className="absolute inset-0" style={{ background: `radial-gradient(ellipse at 50% 0%, ${tierInfo.color}12, transparent 70%)` }} />
          <div className="relative">
            <div className="text-5xl mb-2">{currentTier === 5 ? "⭐" : currentTier === 4 ? "💎" : currentTier === 3 ? "🥇" : currentTier === 2 ? "🥈" : "🏦"}</div>
            <div className="text-white font-bold text-xl">{tierInfo.name} Account</div>
            <div className="text-white/50 text-sm mt-0.5">Tier {currentTier} of 5</div>
            <div className="flex justify-center mt-3 gap-1">
              {[1,2,3,4,5].map(t => (
                <div key={t} className="w-8 h-1.5 rounded-full" style={{ background: t <= currentTier ? tierInfo.color : "rgba(255,255,255,0.1)" }} />
              ))}
            </div>
          </div>
        </div>

        {/* Current Tier Benefits */}
        <div className="rounded-2xl p-4 space-y-2" style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)" }}>
          <div className="text-white/50 text-xs font-semibold uppercase tracking-wide">Your Current Benefits</div>
          {tierInfo.benefits.map(b => (
            <div key={b} className="flex items-center gap-2 text-sm">
              <CheckCircle size={14} color="#22c55e" className="flex-shrink-0" />
              <span className="text-white/70">{b}</span>
            </div>
          ))}
        </div>

        {/* Upgrade section */}
        {isMaxTier ? (
          <div className="rounded-3xl p-6 text-center space-y-2" style={{ background: "rgba(168,85,247,0.08)", border: "1px solid rgba(168,85,247,0.2)" }}>
            <div className="text-4xl">⭐</div>
            <div className="text-white font-bold">You're at the Top!</div>
            <div className="text-white/50 text-sm">Your Elite account has the highest tier and all premium features unlocked. Thank you for your loyalty to GHOB.</div>
          </div>
        ) : (
          <>
            {/* Next Tier Preview */}
            <div className="rounded-2xl p-4 space-y-2" style={{ background: `${nextTierInfo.color}08`, border: `1px solid ${nextTierInfo.color}30` }}>
              <div className="text-white/50 text-xs font-semibold uppercase tracking-wide">Tier {nextTier} — {nextTierInfo.name} Benefits</div>
              {nextTierInfo.benefits.map(b => (
                <div key={b} className="flex items-center gap-2 text-sm">
                  <ChevronUp size={14} style={{ color: nextTierInfo.color }} className="flex-shrink-0" />
                  <span className="text-white/70">{b}</span>
                </div>
              ))}
            </div>

            {/* Request Status */}
            {request?.status === "pending" && (
              <div className="rounded-3xl p-5 space-y-3" style={{ background: "rgba(200,155,50,0.05)", border: "1px solid rgba(200,155,50,0.2)" }}>
                <div className="flex items-center gap-3">
                  <Clock size={20} style={{ color: "hsl(43,85%,60%)" }} />
                  <div>
                    <div className="text-white font-semibold text-sm">Upgrade Request Under Review</div>
                    <div className="text-white/40 text-xs mt-0.5">Tier {request.current_tier} → Tier {request.requested_tier}</div>
                  </div>
                </div>
                <div className="text-white/40 text-xs leading-relaxed">
                  Your tier upgrade request is being reviewed by GHOB CEO Administration. Processing typically takes 3–5 business days. You will be notified of the outcome in your notification centre.
                </div>
                <div className="flex justify-between text-xs">
                  <span className="text-white/30">Submitted</span>
                  <span className="text-white/60">{formatDateTime(request.applied_at)}</span>
                </div>
              </div>
            )}

            {request?.status === "declined" && (
              <div className="rounded-3xl p-5 space-y-3" style={{ background: "rgba(239,68,68,0.05)", border: "1px solid rgba(239,68,68,0.2)" }}>
                <div className="flex items-center gap-3">
                  <XCircle size={20} color="#f87171" />
                  <div className="text-white font-semibold text-sm">Previous Request Declined</div>
                </div>
                {request.decline_reason && (
                  <div className="rounded-xl p-3" style={{ background: "rgba(239,68,68,0.08)" }}>
                    <div className="text-white/40 text-xs mb-0.5">Reason from Administration</div>
                    <div className="text-red-300 text-sm leading-relaxed">{request.decline_reason}</div>
                  </div>
                )}
                <div className="text-white/30 text-xs leading-relaxed">
                  You may reapply with updated or alternative identification documents. Each reapplication resets your request.
                </div>
              </div>
            )}

            {!request || request.status === "declined" ? (
              !showForm ? (
                <button onClick={() => setShowForm(true)} className="gold-btn w-full py-4 text-base font-bold flex items-center justify-center gap-2">
                  <ChevronUp size={18} /> Request Tier {nextTier} Upgrade
                </button>
              ) : (
                <div className="rounded-3xl p-5 space-y-4" style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(200,155,50,0.2)" }}>
                  <div className="text-white font-bold">Tier Upgrade Application</div>
                  <div className="text-white/50 text-xs leading-relaxed">
                    To upgrade to Tier {nextTier} ({nextTierInfo.name}), please provide a valid government-issued identity document. Your request will be reviewed by GHOB CEO Administration within 3–5 business days.
                  </div>
                  <div>
                    <label className="text-white/60 text-xs mb-1.5 block">ID Document Type</label>
                    <select className="dark-input text-sm" value={docType} onChange={e => setDocType(e.target.value)}>
                      <option value="NIN">National Identification Number (NIN)</option>
                      <option value="Passport">International Passport</option>
                      <option value="Driver's License">Driver's License</option>
                      <option value="Voter's Card">Voter's Card</option>
                      <option value="Utility Bill">Utility Bill</option>
                      <option value="Bank Statement">Bank Statement</option>
                    </select>
                  </div>
                  <div>
                    <label className="text-white/60 text-xs mb-1.5 block">Upload Document *</label>
                    <label className="flex items-center gap-3 p-3 rounded-2xl cursor-pointer" style={{ background: "rgba(255,255,255,0.04)", border: `1px solid ${docUrl ? "rgba(34,197,94,0.3)" : "rgba(255,255,255,0.08)"}` }}>
                      <Upload size={16} style={{ color: docUrl ? "#22c55e" : "hsl(43,85%,60%)" }} />
                      <span className="text-white/60 text-xs">{uploading ? "Uploading..." : docUrl ? "✓ Document uploaded" : "Tap to upload identity document"}</span>
                      <input type="file" accept="image/*,.pdf" className="hidden" onChange={handleUploadDoc} disabled={uploading} />
                    </label>
                  </div>
                  <div>
                    <label className="text-white/60 text-xs mb-1.5 block">Additional Notes (optional)</label>
                    <textarea className="dark-input resize-none text-sm w-full" rows={2} placeholder="Any additional information for the review team..." value={notes} onChange={e => setNotes(e.target.value)} />
                  </div>
                  <div className="rounded-xl p-3" style={{ background: "rgba(200,155,50,0.06)", border: "1px solid rgba(200,155,50,0.15)" }}>
                    <div className="text-yellow-400/80 text-xs leading-relaxed">
                      By submitting, you confirm all information provided is accurate and valid. Processing takes 3–5 business days. You will be notified via your notification centre upon decision.
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <button onClick={() => { setShowForm(false); setDocUrl(""); setNotes(""); }} className="py-3 rounded-2xl text-white/60 text-sm" style={{ background: "rgba(255,255,255,0.07)" }}>Cancel</button>
                    <button onClick={handleSubmit} disabled={submitting || !docUrl} className="gold-btn py-3 text-sm font-semibold flex items-center justify-center gap-2" style={{ opacity: !docUrl ? 0.5 : 1 }}>
                      {submitting ? <div className="w-4 h-4 border-2 border-gray-900/30 border-t-gray-900 rounded-full animate-spin" /> : "Submit Request"}
                    </button>
                  </div>
                </div>
              )
            ) : null}
          </>
        )}

        {/* All tier overview */}
        <div className="space-y-2">
          <div className="text-white/50 text-xs font-semibold uppercase tracking-wide">All Account Tiers</div>
          {[1,2,3,4,5].map(t => {
            const info = TIER_NAMES[t];
            return (
              <div key={t} className="flex items-center gap-3 p-3 rounded-2xl" style={{ background: t === currentTier ? `${info.color}08` : "rgba(255,255,255,0.02)", border: `1px solid ${t === currentTier ? `${info.color}30` : "rgba(255,255,255,0.05)"}` }}>
                <div className="w-8 h-8 rounded-xl flex items-center justify-center font-bold text-sm" style={{ background: `${info.color}15`, color: info.color }}>
                  {t}
                </div>
                <div className="flex-1">
                  <div className="text-white text-sm font-medium">{info.name}</div>
                  <div className="text-white/30 text-xs">{info.benefits[0]}</div>
                </div>
                {t === currentTier && (
                  <span className="text-xs px-2 py-0.5 rounded-full font-semibold" style={{ background: `${info.color}20`, color: info.color }}>Current</span>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
