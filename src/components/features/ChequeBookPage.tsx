import { useState, useEffect } from "react";
import { ArrowLeft, BookOpen, Upload, CheckCircle, Clock, XCircle, X } from "lucide-react";
import { supabase, type Account, type ChequeRequest, trackFeatureUse, logAudit } from "@/lib/supabase";
import { formatDateTime } from "@/lib/utils";
import { usePolling } from "@/hooks/usePolling";
import { toast } from "sonner";

interface Props {
  account: Account;
  onBack: () => void;
}

const LEAVES_OPTIONS = [25, 50, 100];

// Currency-specific ID options
const CURRENCY_IDS: Record<string, string[]> = {
  USD: ["Driver's License", "State ID", "US Passport", "Green Card", "Social Security Card"],
  GBP: ["UK Driving Licence", "UK Passport", "Biometric Residence Permit", "National ID Card"],
  EUR: ["National ID Card", "EU Driving Licence", "EU Passport", "Residence Permit"],
  NGN: ["National ID Card (NIN)", "Driver's License", "International Passport", "Voter's Card", "BVN Slip"],
  DEFAULT: ["National ID Card", "Passport", "Driver's License", "Voter's Card"],
};

const getCurrencyIDs = (currency: string) => CURRENCY_IDS[currency] || CURRENCY_IDS.DEFAULT;

export default function ChequeBookPage({ account, onBack }: Props) {
  const [request, setRequest] = useState<ChequeRequest | null>(null);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);

  const [fullName, setFullName] = useState(account.account_name);
  const [leaves, setLeaves] = useState(25);
  const [deliveryAddress, setDeliveryAddress] = useState(account.address || "");
  const [idType, setIdType] = useState(getCurrencyIDs(account.currency)[0]);
  const [idDocUrl, setIdDocUrl] = useState("");
  const [uploading, setUploading] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    trackFeatureUse(account.account_name, account.id, "cheque_book");
    fetchRequest();
  }, [account.id]);

  const fetchRequest = async () => {
    const { data } = await supabase.from("cheque_requests").select("*").eq("account_id", account.id).order("applied_at", { ascending: false }).limit(1).maybeSingle();
    setRequest(data || null);
    setLoading(false);
  };

  usePolling(fetchRequest, 8000, true);

  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    const path = `cheque-id-${account.id}-${Date.now()}.${file.name.split(".").pop()}`;
    const { data, error } = await supabase.storage.from("profiles").upload(path, file, { upsert: true });
    if (!error && data) {
      const { data: url } = supabase.storage.from("profiles").getPublicUrl(data.path);
      setIdDocUrl(url.publicUrl);
      toast.success("Document uploaded successfully.");
    } else {
      toast.error("Upload failed. Please try again.");
    }
    setUploading(false);
  };

  const handleSubmit = async () => {
    if (!idDocUrl) { toast.error("Please upload a valid identity document."); return; }
    if (!deliveryAddress.trim()) { toast.error("Please provide a delivery address."); return; }
    setSubmitting(true);

    if (request?.status === "declined") {
      await supabase.from("cheque_requests").delete().eq("id", request.id);
    }

    await supabase.from("cheque_requests").insert({
      account_id: account.id,
      account_name: fullName,
      account_number: account.account_number,
      delivery_address: deliveryAddress.trim(),
      id_document_url: idDocUrl,
      id_document_type: idType,
      leaves_count: leaves,
      status: "pending",
    });

    // Notify CAS
    await supabase.from("banking_notifications").insert({
      account_id: account.id,
      target: "cas",
      title: "Cheque Book Request",
      body: `${account.account_name} (${account.account_number}) has requested a cheque book. Leaves: ${leaves}. ID: ${idType}. Delivery: ${deliveryAddress}. Tier: ${account.account_tier || 1}. Currency: ${account.currency}. ID Document: ${idDocUrl}`,
      is_read: false,
    });

    await logAudit("cheque_book_requested", account.id, account.account_name, { leaves, idType, delivery: deliveryAddress }, account.account_name, "individual");

    toast.success("Cheque book request submitted. You will be notified within 5-7 business days.");
    setShowForm(false);
    setIdDocUrl("");
    setSubmitting(false);
    fetchRequest();
  };

  const TRACKER = ["Request Received", "Processing", "Shipped", "Delivered"];
  const getStepIndex = (status: string) => {
    if (status === "approved") return 2;
    if (status === "pending") return 1;
    return 0;
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
        <BookOpen size={18} style={{ color: "hsl(43,85%,60%)" }} />
        <div className="flex-1">
          <div className="text-white font-bold">Cheque Book</div>
          <div className="text-white/40 text-xs">FederalPax Banking Cheque Service</div>
        </div>
      </div>

      <div className="px-4 pt-5 pb-8 space-y-4">
        {/* Status */}
        {request?.status === "pending" && (
          <div className="rounded-3xl p-5 space-y-4" style={{ background: "rgba(200,155,50,0.05)", border: "1px solid rgba(200,155,50,0.2)" }}>
            <div className="flex items-center gap-3">
              <Clock size={20} style={{ color: "hsl(43,85%,60%)" }} />
              <div>
                <div className="text-white font-semibold">Cheque Book Under Processing</div>
                <div className="text-white/40 text-xs">Submitted {formatDateTime(request.applied_at)}</div>
              </div>
            </div>
            <div className="space-y-2">
              {TRACKER.map((step, i) => {
                const stepIdx = getStepIndex(request.status);
                return (
                  <div key={step} className="flex items-center gap-3">
                    <div className="w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0"
                      style={{ background: i <= stepIdx ? "rgba(200,155,50,0.25)" : "rgba(255,255,255,0.07)", color: i <= stepIdx ? "hsl(43,85%,60%)" : "rgba(255,255,255,0.3)" }}>
                      {i < stepIdx ? "✓" : i + 1}
                    </div>
                    <span className={`text-sm ${i <= stepIdx ? "text-white" : "text-white/30"}`}>{step}</span>
                  </div>
                );
              })}
            </div>
            {request.tracking_number && (
              <div className="rounded-xl p-3" style={{ background: "rgba(255,255,255,0.05)" }}>
                <div className="text-white/40 text-xs">Tracking Number</div>
                <div className="text-white font-mono font-bold">{request.tracking_number}</div>
              </div>
            )}
          </div>
        )}

        {request?.status === "declined" && (
          <div className="rounded-3xl p-5 space-y-3" style={{ background: "rgba(239,68,68,0.05)", border: "1px solid rgba(239,68,68,0.2)" }}>
            <div className="flex items-center gap-3">
              <XCircle size={20} color="#f87171" />
              <div className="text-white font-semibold">Request Declined</div>
            </div>
            {request.decline_reason && (
              <div className="rounded-xl p-3" style={{ background: "rgba(239,68,68,0.08)" }}>
                <div className="text-white/40 text-xs mb-0.5">Reason</div>
                <div className="text-red-300 text-sm">{request.decline_reason}</div>
              </div>
            )}
            <div className="text-white/30 text-xs">You may reapply with updated information.</div>
          </div>
        )}

        {request?.status === "approved" && (
          <div className="rounded-3xl p-5 space-y-3 text-center" style={{ background: "rgba(34,197,94,0.06)", border: "1px solid rgba(34,197,94,0.2)" }}>
            <CheckCircle size={28} color="#22c55e" className="mx-auto" />
            <div className="text-white font-bold">Cheque Book Approved</div>
            <div className="text-white/50 text-sm">Your cheque book is being processed and will be dispatched to your delivery address within 5-7 business days.</div>
            {request.tracking_number && (
              <div className="rounded-xl p-3" style={{ background: "rgba(255,255,255,0.05)" }}>
                <div className="text-white/40 text-xs">Tracking</div>
                <div className="text-white font-mono">{request.tracking_number}</div>
              </div>
            )}
          </div>
        )}

        {/* No request or declined: show apply button */}
        {(!request || request.status === "declined") && !showForm && (
          <div className="space-y-4">
            <div className="rounded-3xl p-6 text-center space-y-3" style={{ background: "linear-gradient(135deg,hsl(220,60%,16%),hsl(220,70%,11%))", border: "1px solid rgba(200,155,50,0.15)" }}>
              <div className="w-16 h-16 rounded-3xl flex items-center justify-center mx-auto" style={{ background: "linear-gradient(135deg,hsl(43,85%,55%),hsl(38,70%,38%))" }}>
                <BookOpen size={28} color="#111" />
              </div>
              <div className="text-white font-bold text-xl">FederalPax Cheque Book</div>
              <div className="text-white/50 text-sm">Request your official FederalPax Banking cheque book for secure and professional payments.</div>
            </div>
            <button onClick={() => setShowForm(true)} className="gold-btn w-full py-4 text-base font-bold">Request Cheque Book</button>
          </div>
        )}

        {/* Application Form */}
        {showForm && (
          <div className="rounded-3xl p-5 space-y-4" style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(200,155,50,0.2)" }}>
            <div className="flex items-center justify-between">
              <div className="text-white font-bold">Cheque Book Application</div>
              <button onClick={() => { setShowForm(false); setIdDocUrl(""); }} className="text-white/40"><X size={18} /></button>
            </div>
            <div>
              <label className="text-white/60 text-xs mb-1.5 block">Full Name</label>
              <input className="dark-input" value={fullName} onChange={e => setFullName(e.target.value)} />
            </div>
            <div>
              <label className="text-white/60 text-xs mb-1.5 block">Number of Leaves</label>
              <select className="dark-input text-sm" value={leaves} onChange={e => setLeaves(parseInt(e.target.value))}>
                {LEAVES_OPTIONS.map(l => <option key={l} value={l}>{l} leaves</option>)}
              </select>
            </div>
            <div>
              <label className="text-white/60 text-xs mb-1.5 block">Delivery Address *</label>
              <textarea className="dark-input resize-none" rows={2} placeholder="Full delivery address" value={deliveryAddress} onChange={e => setDeliveryAddress(e.target.value)} />
            </div>
            <div>
              <label className="text-white/60 text-xs mb-1.5 block">ID Document Type</label>
              <select className="dark-input text-sm" value={idType} onChange={e => setIdType(e.target.value)}>
                {getCurrencyIDs(account.currency).map(id => <option key={id} value={id}>{id}</option>)}
              </select>
            </div>
            <div>
              <label className="text-white/60 text-xs mb-1.5 block">Upload Identity Document *</label>
              <label className="flex items-center gap-3 p-3 rounded-2xl cursor-pointer" style={{ background: "rgba(255,255,255,0.04)", border: `1px solid ${idDocUrl ? "rgba(34,197,94,0.3)" : "rgba(255,255,255,0.08)"}` }}>
                <Upload size={16} style={{ color: idDocUrl ? "#22c55e" : "hsl(43,85%,60%)" }} />
                <span className="text-white/60 text-xs">{uploading ? "Uploading..." : idDocUrl ? "✓ Document uploaded" : "Tap to upload identity document"}</span>
                <input type="file" accept="image/*,.pdf" className="hidden" onChange={handleUpload} disabled={uploading} />
              </label>
            </div>
            <button onClick={handleSubmit} disabled={submitting || !idDocUrl} className="gold-btn w-full py-3 text-sm font-semibold" style={{ opacity: !idDocUrl ? 0.5 : 1 }}>
              {submitting ? <div className="w-4 h-4 border-2 border-gray-900/30 border-t-gray-900 rounded-full animate-spin mx-auto" /> : "Submit Request"}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
