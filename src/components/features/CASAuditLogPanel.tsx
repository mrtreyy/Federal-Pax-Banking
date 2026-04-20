import { useState, useEffect } from "react";
import { ArrowLeft, ClipboardList, X, ChevronRight, RefreshCw, AlertTriangle, Eye, Download } from "lucide-react";
import { supabase, type AdminAuditLog, type Account } from "@/lib/supabase";
import { formatDateTime, downloadAsCSV } from "@/lib/utils";
import { usePolling } from "@/hooks/usePolling";
import { toast } from "sonner";

interface Props {
  accounts: Account[];
  onClose: () => void;
}

const ACTION_CATEGORIES: Record<string, string> = {
  login: "Login / Access",
  logout: "Login / Access",
  feature_used: "Feature Activity",
  admin_deposit: "Financial",
  freeze_account: "Account Control",
  unfreeze_account: "Account Control",
  close_account: "Account Control",
  reopen_account: "Account Control",
  delete_account: "Account Control",
  edit_transaction: "Transaction Edit",
  create_sub_admin: "Account Creation",
  ceo_freeze: "CEO Action",
  ceo_close: "CEO Action",
  ceo_delete_account: "CEO Action",
  ceo_delete_ap: "CEO Action",
  ceo_delete_adp: "CEO Action",
  ceo_inactive: "CEO Action",
  ceo_activate: "CEO Action",
};

const categoryColor = (cat: string) => {
  if (cat === "Login / Access") return "#60a5fa";
  if (cat === "Feature Activity") return "#22c55e";
  if (cat === "Financial") return "hsl(43,85%,60%)";
  if (cat === "Account Control") return "#f87171";
  if (cat === "CEO Action") return "#a855f7";
  if (cat === "Transaction Edit") return "#fb923c";
  return "rgba(255,255,255,0.4)";
};

const actionLabel = (action: string, details?: Record<string, unknown>): string => {
  const map: Record<string, string> = {
    login: "User Login",
    feature_used: `Feature Used: ${details?.feature || "unknown"}`,
    admin_deposit: "Admin Deposit",
    freeze_account: "Account Frozen",
    unfreeze_account: "Account Unfrozen",
    close_account: "Account Closed",
    reopen_account: "Account Reopened",
    delete_account: "Account Deleted",
    edit_transaction: "Transaction Edited",
    create_sub_admin: "Admin Portal Created",
    ceo_freeze: "CEO — Account Frozen",
    ceo_close: "CEO — Account Closed",
    ceo_delete_account: "CEO — Account Deleted",
    ceo_inactive: "CEO — Set Inactive",
    ceo_activate: "CEO — Activated",
  };
  return map[action] || action.replace(/_/g, " ").replace(/\b\w/g, l => l.toUpperCase());
};

export default function CASAuditLogPanel({ accounts, onClose }: Props) {
  const [logs, setLogs] = useState<AdminAuditLog[]>([]);
  const [selected, setSelected] = useState<AdminAuditLog | null>(null);
  const [filterCat, setFilterCat] = useState<string>("all");
  const [revoking, setRevoking] = useState(false);

  const fetchLogs = async () => {
    const { data } = await supabase.from("admin_audit_log").select("*").order("created_at", { ascending: false }).limit(300);
    if (data) setLogs(data);
  };

  useEffect(() => { fetchLogs(); }, []);
  usePolling(fetchLogs, 8000, !selected);

  const categories = ["all", "Login / Access", "Feature Activity", "Financial", "Account Control", "CEO Action", "Transaction Edit"];
  const filtered = filterCat === "all" ? logs : logs.filter(l => (ACTION_CATEGORIES[l.action] || "Other") === filterCat);

  const handleExportCSV = () => {
    const rows = [
      ["Action", "Category", "Account Name", "Portal", "Performed By", "Date/Time", "Details"],
      ...logs.map(l => [
        actionLabel(l.action, l.details),
        ACTION_CATEGORIES[l.action] || "Other",
        l.target_account_name || "—",
        l.portal_type || "—",
        l.performed_by,
        formatDateTime(l.created_at),
        l.details ? JSON.stringify(l.details) : "—",
      ]),
    ];
    downloadAsCSV(rows, `ghob-audit-log-${new Date().toISOString().slice(0, 10)}`);
    toast.success("Audit log exported as CSV.");
  };

  // Revoke action: only for transaction events
  const handleRevokeAction = async (log: AdminAuditLog) => {
    if (!log.target_account_id || !log.details) return;
    const txId = (log.details as Record<string, unknown>).transaction_id as string;
    const amount = (log.details as Record<string, unknown>).amount as number;
    if (!amount) { toast.error("Cannot determine transaction amount for reversal."); return; }
    setRevoking(true);

    // Create reversal transaction
    await supabase.from("banking_transactions").insert({
      account_id: log.target_account_id,
      type: "credit",
      amount: amount,
      description: "Action revoked by BankUnited administration",
      sender_name: "BankUnited Administration",
      admin_override: true,
      custom_timestamp: new Date().toISOString(),
    });

    // Update account balance
    const acc = accounts.find(a => a.id === log.target_account_id);
    if (acc) {
      await supabase.from("banking_accounts").update({ balance: Number(acc.balance) + Number(amount), updated_at: new Date().toISOString() }).eq("id", acc.id);
    }

    // Notify user
    await supabase.from("banking_notifications").insert({
      account_id: log.target_account_id,
      target: log.target_account_id,
      title: "Transaction Reversed by Administration",
      body: `A transaction on your account has been reviewed and reversed by BankUnited CEO Administration. The amount has been returned to your account. Reason: Action revoked by BankUnited administration.`,
      is_read: false,
    });

    // Mark audit log as resolved
    await supabase.from("admin_audit_log").update({ details: { ...(log.details || {}), revoked: true, revoked_at: new Date().toISOString() } }).eq("id", log.id);

    toast.success("Action revoked. Amount returned to account.");
    setSelected(null);
    setRevoking(false);
    fetchLogs();
  };

  const handleIgnore = () => {
    setSelected(null);
    toast.success("Action ignored. No changes made.");
  };

  if (selected) {
    const cat = ACTION_CATEGORIES[selected.action] || "Other";
    const catCol = categoryColor(cat);
    const linkedAccount = accounts.find(a => a.id === selected.target_account_id);
    const isTransaction = selected.action.includes("deposit") || (selected.details as Record<string, unknown>)?.amount;
    const isRevoked = (selected.details as Record<string, unknown>)?.revoked;

    return (
      <div className="fixed inset-0 z-[65] flex flex-col" style={{ background: "hsl(220,45%,8%)" }}>
        <div className="flex items-center gap-3 px-5 pt-12 pb-4 flex-shrink-0" style={{ background: "hsl(220,55%,12%)", borderBottom: "1px solid rgba(255,255,255,0.06)" }}>
          <button onClick={() => setSelected(null)} className="text-white/40 hover:text-white"><ArrowLeft size={20} /></button>
          <ClipboardList size={18} style={{ color: "hsl(43,85%,60%)" }} />
          <div className="text-white font-bold flex-1">Audit Event Detail</div>
          <span className="text-xs px-2 py-0.5 rounded-full font-semibold" style={{ background: `${catCol}20`, color: catCol }}>{cat}</span>
        </div>

        <div className="flex-1 overflow-y-auto p-5 space-y-4">
          {/* Event Info */}
          <div className="rounded-3xl p-5 space-y-3" style={{ background: "hsl(220,50%,14%)", border: "1px solid rgba(255,255,255,0.08)" }}>
            <div className="text-white font-bold text-base">{actionLabel(selected.action, selected.details || {})}</div>
            <div className="text-white/25 text-xs">{formatDateTime(selected.created_at)}</div>

            {[
              ["Category", cat],
              ["Performed By", selected.performed_by],
              ["Portal", selected.portal_type || "—"],
              ["Target Account", selected.target_account_name || "—"],
              ...(selected.details ? Object.entries(selected.details).filter(([k]) => !["revoked", "revoked_at"].includes(k)).map(([k, v]) => [k.replace(/_/g, " ").replace(/\b\w/g, l => l.toUpperCase()), String(v)]) : []),
            ].map(([l, v]) => (
              <div key={l} className="flex justify-between py-1.5" style={{ borderBottom: "1px solid rgba(255,255,255,0.05)" }}>
                <span className="text-white/40 text-xs">{l}</span>
                <span className="text-white text-xs font-medium text-right max-w-[55%] break-all">{v}</span>
              </div>
            ))}
          </div>

          {/* Linked account */}
          {linkedAccount && (
            <div className="rounded-2xl p-4 flex items-center gap-3" style={{ background: "rgba(200,155,50,0.07)", border: "1px solid rgba(200,155,50,0.15)" }}>
              <div className="w-9 h-9 rounded-full flex items-center justify-center text-sm font-bold" style={{ background: "hsl(220,50%,22%)", color: "hsl(43,85%,60%)" }}>
                {linkedAccount.account_name.slice(0, 2).toUpperCase()}
              </div>
              <div>
                <div className="text-white font-semibold text-sm">{linkedAccount.account_name}</div>
                <div className="text-white/40 text-xs">{linkedAccount.account_number} · Tier {linkedAccount.account_tier || 1}</div>
              </div>
            </div>
          )}

          {isRevoked && (
            <div className="rounded-2xl p-3 text-center" style={{ background: "rgba(239,68,68,0.08)", border: "1px solid rgba(239,68,68,0.2)" }}>
              <div className="text-red-400 text-sm font-semibold">⟳ This action has already been revoked</div>
            </div>
          )}

          {/* Revoke / Ignore Buttons */}
          {isTransaction && !isRevoked && (
            <div className="space-y-3">
              <div className="rounded-2xl p-3" style={{ background: "rgba(251,146,60,0.07)", border: "1px solid rgba(251,146,60,0.2)" }}>
                <div className="flex items-center gap-2 text-orange-400 text-xs font-semibold mb-1">
                  <AlertTriangle size={13} /> CEO Action Required
                </div>
                <div className="text-white/50 text-xs leading-relaxed">
                  This is a financial transaction event. You may revoke this action — the transaction amount will be returned to the account immediately, and the user will be notified. Or you may ignore this event and take no action.
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <button onClick={handleIgnore} className="py-3 rounded-2xl text-white/60 text-sm font-semibold" style={{ background: "rgba(255,255,255,0.07)" }}>
                  Ignore
                </button>
                <button onClick={() => handleRevokeAction(selected)} disabled={revoking}
                  className="py-3 rounded-2xl text-sm font-semibold flex items-center justify-center gap-2"
                  style={{ background: "rgba(239,68,68,0.15)", color: "#f87171", border: "1px solid rgba(239,68,68,0.25)" }}>
                  {revoking ? <div className="w-4 h-4 border-2 border-red-400/30 border-t-red-400 rounded-full animate-spin" /> : <><RefreshCw size={14} /> Revoke Action</>}
                </button>
              </div>
            </div>
          )}

          {!isTransaction && (
            <div className="grid grid-cols-2 gap-3">
              <button onClick={handleIgnore} className="py-3 rounded-2xl text-white/60 text-sm font-semibold" style={{ background: "rgba(255,255,255,0.07)" }}>
                Ignore
              </button>
              <button onClick={() => setSelected(null)} className="gold-btn py-3 text-sm font-semibold">Close</button>
            </div>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 z-[65] flex flex-col" style={{ background: "hsl(220,45%,8%)" }}>
      <div className="sticky top-0 z-30 flex items-center justify-between px-5 pt-12 pb-4 flex-shrink-0" style={{ background: "hsl(220,55%,12%)", borderBottom: "1px solid rgba(255,255,255,0.06)" }}>
        <div className="flex items-center gap-2">
          <button onClick={onClose} className="text-white/40 hover:text-white mr-1"><ArrowLeft size={20} /></button>
          <ClipboardList size={20} style={{ color: "hsl(43,85%,60%)" }} />
          <span className="text-white font-bold">Audit Log</span>
          <span className="text-white/30 text-xs ml-1">({logs.length})</span>
        </div>
        <button onClick={handleExportCSV} className="flex items-center gap-1 px-3 py-1.5 rounded-xl text-xs font-semibold"
          style={{ background: "rgba(200,155,50,0.1)", color: "hsl(43,85%,60%)" }}>
          <Download size={13} /> Export
        </button>
      </div>

      {/* Category filter */}
      <div className="flex gap-2 px-4 pt-3 pb-2 overflow-x-auto flex-shrink-0">
        {categories.map(cat => (
          <button key={cat} onClick={() => setFilterCat(cat)}
            className="px-3 py-1.5 rounded-xl text-xs font-semibold whitespace-nowrap flex-shrink-0 capitalize"
            style={filterCat === cat ? { background: "hsl(43,85%,55%)", color: "#111" } : { background: "rgba(255,255,255,0.07)", color: "rgba(255,255,255,0.5)" }}>
            {cat === "all" ? `All (${logs.length})` : cat}
          </button>
        ))}
      </div>

      <div className="flex-1 overflow-y-auto p-4 space-y-2">
        {filtered.length === 0 ? (
          <div className="text-center py-12 text-white/25 text-sm">No audit events in this category</div>
        ) : (
          filtered.map(log => {
            const cat = ACTION_CATEGORIES[log.action] || "Other";
            const col = categoryColor(cat);
            const isRevoked = (log.details as Record<string, unknown>)?.revoked;
            return (
              <button key={log.id} onClick={() => setSelected(log)}
                className="w-full text-left p-4 rounded-2xl transition-colors hover:bg-white/5"
                style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.06)" }}>
                <div className="flex items-start gap-3">
                  <div className="w-2 h-2 rounded-full mt-2 flex-shrink-0" style={{ background: col }} />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-start justify-between gap-2">
                      <div className="text-white text-xs font-semibold">{actionLabel(log.action, log.details || {})}</div>
                      <span className="text-xs px-1.5 py-0.5 rounded-full flex-shrink-0" style={{ background: `${col}18`, color: col }}>{cat}</span>
                    </div>
                    {log.target_account_name && <div className="text-white/50 text-xs mt-0.5">{log.target_account_name}</div>}
                    <div className="flex items-center justify-between mt-1">
                      <span className="text-white/25 text-xs">{log.performed_by} · {log.portal_type}</span>
                      <span className="text-white/20 text-xs">{formatDateTime(log.created_at)}</span>
                    </div>
                    {isRevoked && <div className="text-red-400/60 text-xs mt-0.5">⟳ Revoked</div>}
                  </div>
                  <ChevronRight size={14} className="text-white/15 flex-shrink-0 mt-0.5" />
                </div>
              </button>
            );
          })
        )}
      </div>
    </div>
  );
}
