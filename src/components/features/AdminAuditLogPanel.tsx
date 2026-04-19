import { useState, useEffect } from "react";
import { X, ClipboardList } from "lucide-react";
import { supabase, type AdminAuditLog } from "@/lib/supabase";
import { formatDateTime } from "@/lib/utils";
import { usePolling } from "@/hooks/usePolling";

interface Props {
  onClose: () => void;
}

export default function AdminAuditLogPanel({ onClose }: Props) {
  const [logs, setLogs] = useState<AdminAuditLog[]>([]);

  const fetchLogs = async () => {
    const { data } = await supabase.from("admin_audit_log").select("*").order("created_at", { ascending: false }).limit(100);
    if (data) setLogs(data);
  };

  useEffect(() => { fetchLogs(); }, []);
  usePolling(fetchLogs, 10000, true);

  const actionColor = (action: string) => {
    if (action.includes("delete") || action.includes("close")) return "#ef4444";
    if (action.includes("freeze")) return "#60a5fa";
    if (action.includes("unfreeze") || action.includes("reopen")) return "#22c55e";
    if (action.includes("deposit")) return "#22c55e";
    if (action.includes("edit")) return "hsl(43,85%,60%)";
    return "rgba(255,255,255,0.5)";
  };

  const actionLabel = (action: string) => {
    const map: Record<string, string> = {
      admin_deposit: "Admin Deposit",
      freeze_account: "Freeze Account",
      unfreeze_account: "Unfreeze Account",
      close_account: "Close Account",
      reopen_account: "Reopen Account",
      delete_account: "Delete Account",
      edit_transaction: "Edit Transaction",
      create_sub_admin: "Create Admin Portal",
      ceo_freeze: "CEO Freeze",
      ceo_close: "CEO Close",
      ceo_delete_account: "CEO Delete",
    };
    return map[action] || action.replace(/_/g, " ").replace(/\b\w/g, l => l.toUpperCase());
  };

  return (
    <div className="min-h-screen pb-20" style={{ background: "hsl(220,45%,8%)" }}>
      <div className="sticky top-0 z-30 flex items-center justify-between px-5 pt-12 pb-4" style={{ background: "hsl(220,55%,12%)", borderBottom: "1px solid rgba(255,255,255,0.06)" }}>
        <div className="flex items-center gap-2">
          <ClipboardList size={20} style={{ color: "hsl(43,85%,60%)" }} />
          <span className="text-white font-bold">Admin Audit Log</span>
          <span className="text-white/30 text-xs ml-1">({logs.length})</span>
        </div>
        <button onClick={onClose} className="text-white/40 hover:text-white"><X size={20} /></button>
      </div>

      <div className="p-4 space-y-2">
        {logs.length === 0 ? (
          <div className="text-center py-12 text-white/25 text-sm">No audit events recorded yet</div>
        ) : (
          logs.map(log => (
            <div key={log.id} className="p-4 rounded-2xl" style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.06)" }}>
              <div className="flex items-start justify-between mb-1">
                <span className="text-xs font-semibold px-2 py-0.5 rounded-full" style={{ background: "rgba(200,155,50,0.1)", color: actionColor(log.action) }}>
                  {actionLabel(log.action)}
                </span>
                <span className="text-white/25 text-xs">{formatDateTime(log.created_at)}</span>
              </div>
              {log.target_account_name && <div className="text-white text-xs font-medium mt-1">Target: {log.target_account_name}</div>}
              <div className="text-white/30 text-xs">By: {log.performed_by} ({log.portal_type})</div>
              {log.details && Object.keys(log.details).length > 0 && (
                <div className="text-white/20 text-xs mt-1 font-mono">{JSON.stringify(log.details)}</div>
              )}
            </div>
          ))
        )}
      </div>
    </div>
  );
}
