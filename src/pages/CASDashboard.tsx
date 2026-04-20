import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import {
  supabase, type Account, type Transaction, type BankingNotification,
  type AdministrationPlus, type SubAdminPortal, type LoginActivity, type AdminAuditLog,
  logAudit
} from "@/lib/supabase";
import { formatCurrency, formatDateTime, getInitials } from "@/lib/utils";
import { usePolling } from "@/hooks/usePolling";
import {
  Crown, LogOut, Users, Building2, TrendingUp, TrendingDown,
  ChevronRight, Bell, Plus, X, ArrowLeft, Edit2, Snowflake, XCircle,
  Eye, EyeOff, Search, Activity, Calendar, Timer,
  Power, Trash2, Download, Unlock, CreditCard,
} from "lucide-react";
import bankLogo from "@/assets/bankunited-logo.jpg";
import { toast } from "sonner";
import TransactionReceiptModal from "@/components/features/TransactionReceiptModal";
import EditTransactionModal from "@/components/features/EditTransactionModal";
import AdminDepositModal from "@/components/features/AdminDepositModal";
import CreateAccountModal from "@/components/features/CreateAccountModal";
import CASBottomNav from "@/components/features/CASBottomNav";
import CASChatPanel from "@/components/features/CASChatPanel";
import CASNotificationsPanel from "@/components/features/CASNotificationsPanel";
import CASEditAccountModal from "@/components/features/CASEditAccountModal";
import CASCreatePortalModal from "@/components/features/CASCreatePortalModal";
import CASScheduledTxModal from "@/components/features/CASScheduledTxModal";
import CASVirtualCardReview from "@/components/features/CASVirtualCardReview";
import CurrencyConverterWidget from "@/components/features/CurrencyConverterWidget";
import CASPlatformControls from "@/components/features/CASPlatformControls";
import CASAuditLogPanel from "@/components/features/CASAuditLogPanel";
import CASCurrencySettings from "@/components/features/CASCurrencySettings";

type CASTab = "home" | "accounts" | "chats" | "notifications";

type TimerTarget = {
  table: "banking_accounts" | "administration_plus" | "sub_admin_portals";
  id: string;
  name: string;
  statusField: "is_frozen" | "is_closed" | "is_inactive";
};

const ALL_CURRENCIES = ["USD", "EUR", "GBP", "JPY", "AUD", "CAD", "CHF", "CNY", "NGN", "ZAR", "INR", "BRL", "MXN", "AED", "SAR"];

export default function CASDashboard() {
  const navigate = useNavigate();
  const [tab, setTab] = useState<CASTab>("home");
  const [aps, setAps] = useState<AdministrationPlus[]>([]);
  const [subAdmins, setSubAdmins] = useState<SubAdminPortal[]>([]);
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [notifications, setNotifications] = useState<BankingNotification[]>([]);
  const [loginActivity, setLoginActivity] = useState<LoginActivity[]>([]);
  const [auditLog, setAuditLog] = useState<AdminAuditLog[]>([]);
  const [selectedTx, setSelectedTx] = useState<Transaction | null>(null);
  const [editTx, setEditTx] = useState<Transaction | null>(null);
  const [showDeposit, setShowDeposit] = useState(false);
  const [showCreateIndividual, setShowCreateIndividual] = useState(false);
  const [expandedAP, setExpandedAP] = useState<string | null>(null);
  const [expandedSubAdmin, setExpandedSubAdmin] = useState<string | null>(null);
  const [selectedAccount, setSelectedAccount] = useState<Account | null>(null);
  const [selectedAP, setSelectedAP] = useState<AdministrationPlus | null>(null);
  const [selectedADP, setSelectedADP] = useState<SubAdminPortal | null>(null);
  const [drillView, setDrillView] = useState<"account" | "ap" | "adp" | null>(null);
  const [showBalance, setShowBalance] = useState(true);
  const [searchAcct, setSearchAcct] = useState("");
  const [showConverter, setShowConverter] = useState(false);
  const [showCreateAP, setShowCreateAP] = useState(false);
  const [showCreateADP, setShowCreateADP] = useState(false);
  const [showCreateMenu, setShowCreateMenu] = useState(false);
  const [showScheduled, setShowScheduled] = useState(false);
  const [editTarget, setEditTarget] = useState<Parameters<typeof CASEditAccountModal>[0]["target"] | null>(null);
  const [timerTarget, setTimerTarget] = useState<TimerTarget | null>(null);
  const [timerHours, setTimerHours] = useState("24");
  const [showCardReview, setShowCardReview] = useState(false);
  const [showStatementDownload, setShowStatementDownload] = useState(false);
  const [stmtAccount, setStmtAccount] = useState("");
  const [stmtFrom, setStmtFrom] = useState("");
  const [stmtTo, setStmtTo] = useState("");
  const [showPlatformControls, setShowPlatformControls] = useState(false);
  const [showAuditLog, setShowAuditLog] = useState(false);
  const [showCurrencySettings, setShowCurrencySettings] = useState(false);

  useEffect(() => {
    const raw = localStorage.getItem("ghob_cas_session");
    if (!raw) { navigate("/cas/login"); return; }
    fetchAll();
  }, [navigate]);

  const fetchAll = async () => {
    const [apsRes, subRes, accRes, txRes, notifRes, actRes, auditRes] = await Promise.all([
      supabase.from("administration_plus").select("*").order("tier"),
      supabase.from("sub_admin_portals").select("*"),
      supabase.from("banking_accounts").select("*").order("account_name"),
      supabase.from("banking_transactions").select("*").order("custom_timestamp", { ascending: false }).limit(500),
      supabase.from("banking_notifications").select("*").order("created_at", { ascending: false }),
      supabase.from("login_activity").select("*").order("login_at", { ascending: false }).limit(200),
      supabase.from("admin_audit_log").select("*").order("created_at", { ascending: false }).limit(200),
    ]);
    if (apsRes.data) setAps(apsRes.data);
    if (subRes.data) setSubAdmins(subRes.data);
    if (accRes.data) setAccounts(accRes.data);
    if (txRes.data) setTransactions(txRes.data);
    if (notifRes.data) setNotifications(notifRes.data);
    if (actRes.data) setLoginActivity(actRes.data);
    if (auditRes.data) setAuditLog(auditRes.data);
  };

  usePolling(fetchAll, 8000, !selectedTx && !editTx && !showDeposit && !showCreateIndividual);

  const handleLogout = () => { localStorage.removeItem("ghob_cas_session"); navigate("/cas/login"); };

  const totalBalance = accounts.reduce((s, a) => s + Number(a.balance), 0);
  // Platform aggregate counters for savings/loans/bills
  const [savingsTotal, setSavingsTotal] = useState(0);
  const [loansTotal, setLoansTotal] = useState(0);
  const [billsTotal, setBillsTotal] = useState(0);

  useEffect(() => {
    // Fetch savings goals, loan applications, bill payments totals
    Promise.all([
      supabase.from("savings_goals").select("current_amount"),
      supabase.from("loan_applications").select("amount").in("status", ["approved"]),
      supabase.from("bill_payments").select("amount").eq("status", "completed"),
    ]).then(([sg, la, bp]) => {
      if (sg.data) setSavingsTotal(sg.data.reduce((s: number, r: {current_amount: number}) => s + Number(r.current_amount), 0));
      if (la.data) setLoansTotal(la.data.reduce((s: number, r: {amount: number}) => s + Number(r.amount), 0));
      if (bp.data) setBillsTotal(bp.data.reduce((s: number, r: {amount: number}) => s + Number(r.amount), 0));
    });
  }, [accounts]);
  const totalIn = transactions.filter(t => t.type === "deposit" || t.type === "credit").reduce((s, t) => s + Number(t.amount), 0);
  const totalOut = transactions.filter(t => t.type === "transfer" || t.type === "debit").reduce((s, t) => s + Number(t.amount), 0);
  const unreadNotifs = notifications.filter(n => !n.is_read).length;
  const pendingCardApps = notifications.filter(n => n.target === "cas" && n.title.toLowerCase().includes("virtual card") && !n.is_read).length;
  const unreadChats = accounts.reduce((count, acc) => {
    return count + notifications.filter(n => n.account_id === acc.id && !n.is_read && n.target !== "admin").length;
  }, 0);

  const handleDownloadStatement = () => {
    const acc = accounts.find(a => a.id === stmtAccount);
    if (!acc) return;
    const accTxs = transactions.filter(t => {
      if (t.account_id !== acc.id) return false;
      if (stmtFrom && new Date(t.custom_timestamp) < new Date(stmtFrom)) return false;
      if (stmtTo && new Date(t.custom_timestamp) > new Date(stmtTo + "T23:59:59")) return false;
      return true;
    });
    let running = 0;
    const tIn = accTxs.filter(t => t.type === "deposit" || t.type === "credit").reduce((s, t) => s + Number(t.amount), 0);
    const tOut = accTxs.filter(t => t.type !== "deposit" && t.type !== "credit").reduce((s, t) => s + Number(t.amount), 0);
    const rows = accTxs.map(t => {
      const isIn = t.type === "deposit" || t.type === "credit";
      running += isIn ? Number(t.amount) : -Number(t.amount);
      return [new Date(t.custom_timestamp).toLocaleDateString(), t.description || t.recipient_name || t.type, isIn ? "+" + t.amount : "-" + t.amount, running.toFixed(2)];
    });
    const html = `<!DOCTYPE html><html><head><meta charset="UTF-8"/><title>BankUnited Statement</title><style>*{margin:0;padding:0;box-sizing:border-box;}body{font-family:Inter,Arial,sans-serif;background:#f8f9fa;padding:32px;}h1{font-size:20px;color:#0A1E3F;}h2{font-size:14px;color:#555;margin-top:4px;}.summary{display:grid;grid-template-columns:repeat(4,1fr);gap:16px;margin:24px 0;}.card{background:#0A1E3F;color:#fff;border-radius:12px;padding:16px;}.card-label{font-size:11px;opacity:0.6;}.card-val{font-size:20px;font-weight:700;margin-top:4px;color:#D4AF37;}table{width:100%;border-collapse:collapse;margin-top:16px;}th{background:#0A1E3F;color:#D4AF37;padding:10px;font-size:12px;text-align:left;}td{padding:9px 10px;font-size:12px;border-bottom:1px solid #eee;}tr:nth-child(even){background:#f4f4f4;}.footer{margin-top:24px;font-size:11px;color:#999;text-align:center;}</style></head><body><h1>🏦 BankUnited</h1><h2>Official Bank Statement</h2><p style="margin-top:8px;font-size:12px;color:#666">${acc.account_name} &nbsp;|&nbsp; ${acc.account_number} &nbsp;|&nbsp; Tier ${acc.account_tier || 1} &nbsp;|&nbsp; ${stmtFrom || "All time"} — ${stmtTo || "present"}</p><div class="summary"><div class="card"><div class="card-label">Total Money In</div><div class="card-val">${acc.currency} ${tIn.toFixed(2)}</div></div><div class="card"><div class="card-label">Total Money Out</div><div class="card-val">${acc.currency} ${tOut.toFixed(2)}</div></div><div class="card"><div class="card-label">Net Change</div><div class="card-val">${acc.currency} ${(tIn - tOut).toFixed(2)}</div></div><div class="card"><div class="card-label">Closing Balance</div><div class="card-val">${acc.currency} ${Number(acc.balance).toFixed(2)}</div></div></div><table><tr><th>Date</th><th>Description</th><th>Amount</th><th>Running Balance</th></tr>${rows.map(r => `<tr><td>${r[0]}</td><td>${r[1]}</td><td>${r[2]}</td><td>${r[3]}</td></tr>`).join("")}</table><div class="footer">Generated by BankUnited CEO Administration on ${new Date().toLocaleString()} &nbsp;|&nbsp; © 2015 BankUnited. All rights reserved.</div></body></html>`;
    const w = window.open("", "_blank");
    if (w) { w.document.write(html); w.document.close(); }
  };

  const handleToggleStatus = async (
    table: "banking_accounts" | "administration_plus" | "sub_admin_portals",
    id: string, name: string,
    field: "is_frozen" | "is_closed" | "is_inactive",
    currentValue: boolean
  ) => {
    const update: Record<string, unknown> = { [field]: !currentValue, ceo_locked: !currentValue };
    if (table === "banking_accounts") update.updated_at = new Date().toISOString();
    const { error } = await supabase.from(table).update(update).eq("id", id);
    if (!error) {
      const action = currentValue ? `ceo_un${field.replace("is_", "")}` : `ceo_${field.replace("is_", "")}`;
      await logAudit(action, id, name, {}, "CEO", "cas");
      toast.success(`${name}: ${currentValue ? "status restored" : field.replace("is_", "") + " applied"}.`);
      fetchAll();
      if (selectedAccount?.id === id) {
        const { data } = await supabase.from("banking_accounts").select("*").eq("id", id).single();
        if (data) setSelectedAccount(data);
      }
    }
  };

  const handleDeleteAccount = async (acc: Account) => {
    if (!confirm(`Permanently delete ${acc.account_name}? This cannot be undone.`)) return;
    await supabase.from("banking_accounts").delete().eq("id", acc.id);
    await logAudit("ceo_delete_account", acc.id, acc.account_name, {}, "CEO", "cas");
    toast.success("Account deleted.");
    setSelectedAccount(null); setDrillView(null); fetchAll();
  };

  const handleDeleteAP = async (ap: AdministrationPlus) => {
    if (!confirm(`Delete AP account "${ap.name}"? This cannot be undone.`)) return;
    await supabase.from("administration_plus").delete().eq("id", ap.id);
    await logAudit("ceo_delete_ap", ap.id, ap.name, {}, "CEO", "cas");
    toast.success("AP account deleted.");
    setSelectedAP(null); setDrillView(null); fetchAll();
  };

  const handleDeleteADP = async (adp: SubAdminPortal) => {
    if (!confirm(`Delete Admin Portal "${adp.name}"? This cannot be undone.`)) return;
    await supabase.from("sub_admin_portals").delete().eq("id", adp.id);
    await logAudit("ceo_delete_adp", adp.id, adp.name, {}, "CEO", "cas");
    toast.success("Admin Portal deleted.");
    setSelectedADP(null); setDrillView(null); fetchAll();
  };

  const handleSetTimer = async () => {
    if (!timerTarget) return;
    const hrs = parseFloat(timerHours);
    if (isNaN(hrs) || hrs <= 0) { toast.error("Enter a valid number of hours."); return; }
    const expiresAt = new Date(Date.now() + hrs * 3600000).toISOString();
    await supabase.from(timerTarget.table).update({ status_timer_expires_at: expiresAt }).eq("id", timerTarget.id);
    toast.success(`Timer set: account will auto-restore in ${hrs} hours.`);
    setTimerTarget(null); fetchAll();
  };

  const filteredAccounts = accounts.filter(a =>
    a.account_name.toLowerCase().includes(searchAcct.toLowerCase()) ||
    a.account_number.toLowerCase().includes(searchAcct.toLowerCase())
  );

  // ---- TIMER MODAL ----
  if (timerTarget) {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center px-4" style={{ background: "rgba(0,0,0,0.7)" }}>
        <div className="w-full max-w-sm rounded-3xl p-6" style={{ background: "hsl(220,50%,12%)", border: "1px solid rgba(255,255,255,0.1)" }}>
          <div className="flex items-center gap-3 mb-4">
            <Timer size={20} style={{ color: "hsl(43,85%,60%)" }} />
            <div className="text-white font-bold">Set Auto-Restore Timer</div>
          </div>
          <div className="text-white/50 text-sm mb-4">
            Set how many hours until <strong className="text-white">{timerTarget.name}</strong> auto-reverts from {timerTarget.statusField.replace("is_", "")} status.
          </div>
          <div className="mb-4">
            <label className="text-white/60 text-xs mb-1.5 block">Hours until auto-restore</label>
            <input type="number" className="dark-input text-lg font-bold" value={timerHours} onChange={e => setTimerHours(e.target.value)} min="0.5" step="0.5" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <button onClick={() => setTimerTarget(null)} className="py-3 rounded-2xl text-white/60 text-sm" style={{ background: "rgba(255,255,255,0.07)" }}>Cancel</button>
            <button onClick={handleSetTimer} className="gold-btn py-3 text-sm font-semibold">Set Timer</button>
          </div>
        </div>
      </div>
    );
  }

  // ---- DRILL VIEWS ----
  if (drillView === "account" && selectedAccount) {
    const acctTxs = transactions.filter(t => t.account_id === selectedAccount.id);
    return (
      <div className="min-h-screen pb-24" style={{ background: "hsl(220,45%,8%)" }}>
        <div className="sticky top-0 z-30 flex items-center gap-3 px-5 pt-12 pb-4" style={{ background: "hsl(220,55%,12%)", borderBottom: "1px solid rgba(255,255,255,0.06)" }}>
          <button onClick={() => { setDrillView(null); setSelectedAccount(null); }} className="text-white/40 hover:text-white"><ArrowLeft size={20} /></button>
          <div className="flex-1">
            <div className="text-white font-bold">{selectedAccount.account_name}</div>
            <div className="text-white/40 text-xs">{selectedAccount.account_number} · {selectedAccount.currency}</div>
          </div>
          <button onClick={() => setEditTarget({ type: "individual", data: selectedAccount })} className="text-white/40 hover:text-yellow-400"><Edit2 size={16} /></button>
        </div>
        <div className="px-4 pt-4 space-y-4 pb-4">
          <div className="navy-card p-4">
            <div className="flex items-center gap-3 mb-4">
              {selectedAccount.profile_picture ? (
                <img src={selectedAccount.profile_picture} alt="" className="w-16 h-16 rounded-full object-cover" style={{ border: "2px solid hsl(43,85%,55%)" }} />
              ) : (
                <div className="w-16 h-16 rounded-full flex items-center justify-center text-xl font-bold" style={{ background: "hsl(220,50%,22%)", color: "hsl(43,85%,60%)" }}>
                  {getInitials(selectedAccount.account_name)}
                </div>
              )}
              <div>
                <div className="text-white font-bold text-lg">{selectedAccount.account_name}</div>
                <div className="text-white/40 text-sm">{selectedAccount.account_type} · Tier {selectedAccount.account_tier || 1}</div>
                <div className="flex gap-1 mt-1 flex-wrap">
                  {selectedAccount.is_frozen && <span className="text-blue-400 text-xs px-2 py-0.5 rounded-full" style={{ background: "rgba(59,130,246,0.15)" }}>❄ Frozen</span>}
                  {selectedAccount.is_closed && <span className="text-red-400 text-xs px-2 py-0.5 rounded-full" style={{ background: "rgba(239,68,68,0.15)" }}>✗ Closed</span>}
                  {selectedAccount.is_inactive && <span className="text-orange-400 text-xs px-2 py-0.5 rounded-full" style={{ background: "rgba(251,146,60,0.15)" }}>◉ Inactive</span>}
                  {selectedAccount.ceo_locked && <span className="text-xs px-2 py-0.5 rounded-full" style={{ color: "hsl(43,85%,60%)", background: "rgba(200,155,50,0.15)" }}>👑 CEO Locked</span>}
                </div>
              </div>
            </div>
            {[
              ["Balance", formatCurrency(selectedAccount.balance, selectedAccount.currency)],
              ["Email", selectedAccount.login_email],
              ["Password", selectedAccount.login_password],
              ["Phone", selectedAccount.phone || "—"],
              ["Address", selectedAccount.address || "—"],
              ["State/Country", [selectedAccount.state, selectedAccount.country].filter(Boolean).join(", ") || "—"],
              ["ZIP", selectedAccount.zipcode || "—"],
              ["ID Info", selectedAccount.id_info || "—"],
              ["Transfer PIN", selectedAccount.transfer_pin || "Not set"],
              ["Currency", selectedAccount.currency],
              ["Created", formatDateTime(selectedAccount.created_at)],
              ["Last Login", selectedAccount.last_login_at ? formatDateTime(selectedAccount.last_login_at) : "Never"],
            ].map(([l, v]) => (
              <div key={l} className="flex justify-between py-1.5" style={{ borderBottom: "1px solid rgba(255,255,255,0.04)" }}>
                <span className="text-white/40 text-xs flex-shrink-0">{l}</span>
                <span className="text-white text-xs font-medium text-right break-all max-w-[60%]">{v}</span>
              </div>
            ))}
          </div>
          <div className="navy-card p-4">
            <div className="text-white/50 text-xs font-semibold uppercase tracking-wide mb-3">CEO Account Controls</div>
            <div className="grid grid-cols-3 gap-2 mb-3">
              <button onClick={() => handleToggleStatus("banking_accounts", selectedAccount.id, selectedAccount.account_name, "is_frozen", selectedAccount.is_frozen || false)}
                className="py-2.5 rounded-2xl text-xs font-medium"
                style={{ background: selectedAccount.is_frozen ? "rgba(59,130,246,0.2)" : "rgba(255,255,255,0.07)", color: selectedAccount.is_frozen ? "#60a5fa" : "rgba(255,255,255,0.6)" }}>
                {selectedAccount.is_frozen ? <><Unlock size={11} className="inline mr-1" />Unfreeze</> : <><Snowflake size={11} className="inline mr-1" />Freeze</>}
              </button>
              <button onClick={() => handleToggleStatus("banking_accounts", selectedAccount.id, selectedAccount.account_name, "is_closed", selectedAccount.is_closed || false)}
                className="py-2.5 rounded-2xl text-xs font-medium"
                style={{ background: selectedAccount.is_closed ? "rgba(239,68,68,0.2)" : "rgba(255,255,255,0.07)", color: selectedAccount.is_closed ? "#f87171" : "rgba(255,255,255,0.6)" }}>
                {selectedAccount.is_closed ? <><Unlock size={11} className="inline mr-1" />Open</> : <><XCircle size={11} className="inline mr-1" />Close</>}
              </button>
              <button onClick={() => handleToggleStatus("banking_accounts", selectedAccount.id, selectedAccount.account_name, "is_inactive", selectedAccount.is_inactive || false)}
                className="py-2.5 rounded-2xl text-xs font-medium"
                style={{ background: selectedAccount.is_inactive ? "rgba(251,146,60,0.2)" : "rgba(255,255,255,0.07)", color: selectedAccount.is_inactive ? "#fb923c" : "rgba(255,255,255,0.6)" }}>
                {selectedAccount.is_inactive ? <><Power size={11} className="inline mr-1" />Activate</> : <><Power size={11} className="inline mr-1" />Inactive</>}
              </button>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <button onClick={() => setTimerTarget({ table: "banking_accounts", id: selectedAccount.id, name: selectedAccount.account_name, statusField: "is_frozen" })}
                className="py-2.5 rounded-2xl text-xs flex items-center justify-center gap-1"
                style={{ background: "rgba(255,255,255,0.05)", color: "rgba(255,255,255,0.5)", border: "1px solid rgba(255,255,255,0.08)" }}>
                <Timer size={11} /> Set Timer
              </button>
              <button onClick={() => handleDeleteAccount(selectedAccount)}
                className="py-2.5 rounded-2xl text-xs flex items-center justify-center gap-1"
                style={{ background: "rgba(239,68,68,0.1)", color: "#f87171", border: "1px solid rgba(239,68,68,0.2)" }}>
                <Trash2 size={11} /> Delete
              </button>
            </div>
          </div>
          <div>
            <h3 className="text-white font-bold mb-2">Transactions ({acctTxs.length})</h3>
            {acctTxs.length === 0 ? <div className="text-white/25 text-sm text-center py-6">No transactions</div> : (
              <div className="space-y-2">
                {acctTxs.map(tx => {
                  const isIn = tx.type === "deposit" || tx.type === "credit";
                  return (
                    <div key={tx.id} className="flex items-center gap-3 p-3 rounded-2xl" style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.06)" }}>
                      <div className="flex-1 min-w-0">
                        <div className="text-white text-xs font-medium">{tx.recipient_name || (isIn ? "Deposit" : "Transfer")}</div>
                        <div className="text-white/30 text-xs">{formatDateTime(tx.custom_timestamp)}</div>
                      </div>
                      <span className="font-bold text-xs" style={{ color: isIn ? "#22c55e" : "#ef4444" }}>
                        {isIn ? "+" : "-"}{formatCurrency(tx.amount, selectedAccount.currency)}
                      </span>
                      <button onClick={() => setSelectedTx(tx)} className="text-white/30 hover:text-white/60"><Eye size={13} /></button>
                      <button onClick={() => setEditTx(tx)} className="text-white/30 hover:text-yellow-400"><Edit2 size={13} /></button>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
        {selectedTx && <TransactionReceiptModal tx={{ ...selectedTx, account_name: selectedAccount.account_name, currency: selectedAccount.currency }} onClose={() => setSelectedTx(null)} />}
        {editTx && <EditTransactionModal tx={editTx} onClose={() => setEditTx(null)} onSuccess={fetchAll} />}
        {editTarget && <CASEditAccountModal target={editTarget} onClose={() => setEditTarget(null)} onSuccess={() => { fetchAll(); setEditTarget(null); supabase.from("banking_accounts").select("*").eq("id", selectedAccount.id).single().then(({ data }) => { if (data) setSelectedAccount(data); }); }} />}
        <CASBottomNav active={tab} onHome={() => { setDrillView(null); setSelectedAccount(null); setTab("home"); }} onAccounts={() => { setDrillView(null); setSelectedAccount(null); setTab("accounts"); }} onChats={() => { setDrillView(null); setSelectedAccount(null); setTab("chats"); }} onNotifications={() => { setDrillView(null); setSelectedAccount(null); setTab("notifications"); }} notifCount={unreadNotifs} chatCount={unreadChats} />
      </div>
    );
  }

  if (drillView === "ap" && selectedAP) {
    const apSubAdmins = subAdmins.filter(s => s.created_by_ap === selectedAP.id);
    return (
      <div className="min-h-screen pb-24" style={{ background: "hsl(220,45%,8%)" }}>
        <div className="sticky top-0 z-30 flex items-center gap-3 px-5 pt-12 pb-4" style={{ background: "hsl(220,55%,12%)", borderBottom: "1px solid rgba(255,255,255,0.06)" }}>
          <button onClick={() => { setDrillView(null); setSelectedAP(null); }} className="text-white/40 hover:text-white"><ArrowLeft size={20} /></button>
          <div className="flex-1">
            <div className="text-white font-bold">{selectedAP.name}</div>
            <div className="text-white/40 text-xs">Administration Plus · Tier {selectedAP.tier}</div>
          </div>
          <button onClick={() => setEditTarget({ type: "ap", data: selectedAP })} className="text-white/40 hover:text-yellow-400"><Edit2 size={16} /></button>
        </div>
        <div className="px-4 pt-4 space-y-4 pb-4">
          <div className="navy-card p-4 grid grid-cols-2 gap-3">
            <div><div className="text-white/40 text-xs">Max Admins</div><div className="text-white font-bold">{apSubAdmins.length} / {selectedAP.max_admin_portals}</div></div>
            <div><div className="text-white/40 text-xs">Max Balance</div><div style={{ color: "hsl(43,85%,60%)" }} className="font-bold text-sm">{formatCurrency(selectedAP.max_balance, "USD")}</div></div>
            <div className="flex gap-1 flex-wrap col-span-2">
              {selectedAP.is_frozen && <span className="text-blue-400 text-xs px-2 py-0.5 rounded-full" style={{ background: "rgba(59,130,246,0.15)" }}>❄ Frozen</span>}
              {selectedAP.is_closed && <span className="text-red-400 text-xs px-2 py-0.5 rounded-full" style={{ background: "rgba(239,68,68,0.15)" }}>✗ Closed</span>}
              {selectedAP.is_inactive && <span className="text-orange-400 text-xs px-2 py-0.5 rounded-full" style={{ background: "rgba(251,146,60,0.15)" }}>◉ Inactive</span>}
            </div>
          </div>
          <div className="navy-card p-4">
            <div className="text-white/50 text-xs font-semibold uppercase tracking-wide mb-3">CEO Controls</div>
            <div className="grid grid-cols-3 gap-2 mb-2">
              <button onClick={() => handleToggleStatus("administration_plus", selectedAP.id, selectedAP.name, "is_frozen", selectedAP.is_frozen || false)}
                className="py-2 rounded-xl text-xs" style={{ background: selectedAP.is_frozen ? "rgba(59,130,246,0.2)" : "rgba(255,255,255,0.07)", color: selectedAP.is_frozen ? "#60a5fa" : "rgba(255,255,255,0.5)" }}>
                {selectedAP.is_frozen ? "Unfreeze" : "Freeze"}
              </button>
              <button onClick={() => handleToggleStatus("administration_plus", selectedAP.id, selectedAP.name, "is_closed", selectedAP.is_closed || false)}
                className="py-2 rounded-xl text-xs" style={{ background: selectedAP.is_closed ? "rgba(239,68,68,0.2)" : "rgba(255,255,255,0.07)", color: selectedAP.is_closed ? "#f87171" : "rgba(255,255,255,0.5)" }}>
                {selectedAP.is_closed ? "Open" : "Close"}
              </button>
              <button onClick={() => handleToggleStatus("administration_plus", selectedAP.id, selectedAP.name, "is_inactive", selectedAP.is_inactive || false)}
                className="py-2 rounded-xl text-xs" style={{ background: selectedAP.is_inactive ? "rgba(251,146,60,0.2)" : "rgba(255,255,255,0.07)", color: selectedAP.is_inactive ? "#fb923c" : "rgba(255,255,255,0.5)" }}>
                {selectedAP.is_inactive ? "Activate" : "Inactive"}
              </button>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <button onClick={() => setTimerTarget({ table: "administration_plus", id: selectedAP.id, name: selectedAP.name, statusField: "is_frozen" })}
                className="py-2 rounded-xl text-xs flex items-center justify-center gap-1" style={{ background: "rgba(255,255,255,0.05)", color: "rgba(255,255,255,0.5)" }}>
                <Timer size={11} /> Set Timer
              </button>
              <button onClick={() => handleDeleteAP(selectedAP)}
                className="py-2 rounded-xl text-xs flex items-center justify-center gap-1" style={{ background: "rgba(239,68,68,0.1)", color: "#f87171" }}>
                <Trash2 size={11} /> Delete AP
              </button>
            </div>
          </div>
          <h3 className="text-white font-bold">Admin Portals ({apSubAdmins.length})</h3>
          {apSubAdmins.length === 0 ? <div className="text-white/25 text-sm text-center py-6">No admin portals created under this AP</div> : (
            apSubAdmins.map(sub => {
              const subAccounts = accounts.filter(a => a.created_by_sub_admin === sub.id);
              return (
                <button key={sub.id} onClick={() => { setSelectedADP(sub); setDrillView("adp"); }}
                  className="w-full flex items-center gap-3 p-4 rounded-2xl text-left" style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)" }}>
                  {sub.profile_picture ? <img src={sub.profile_picture} alt="" className="w-10 h-10 rounded-full object-cover" /> : <div className="w-10 h-10 rounded-full flex items-center justify-center text-sm font-bold" style={{ background: "hsl(220,50%,22%)", color: "hsl(43,85%,60%)" }}>{getInitials(sub.name)}</div>}
                  <div className="flex-1"><div className="text-white font-semibold text-sm">{sub.name}</div><div className="text-white/40 text-xs">{subAccounts.length} / {sub.max_individual} accounts</div></div>
                  <ChevronRight size={16} className="text-white/30" />
                </button>
              );
            })
          )}
        </div>
        {editTarget && <CASEditAccountModal target={editTarget} onClose={() => setEditTarget(null)} onSuccess={() => { fetchAll(); setEditTarget(null); }} />}
        <CASBottomNav active={tab} onHome={() => { setDrillView(null); setSelectedAP(null); setTab("home"); }} onAccounts={() => { setDrillView(null); setSelectedAP(null); setTab("accounts"); }} onChats={() => setTab("chats")} onNotifications={() => setTab("notifications")} notifCount={unreadNotifs} chatCount={unreadChats} />
      </div>
    );
  }

  if (drillView === "adp" && selectedADP) {
    const adpAccounts = accounts.filter(a => a.created_by_sub_admin === selectedADP.id);
    return (
      <div className="min-h-screen pb-24" style={{ background: "hsl(220,45%,8%)" }}>
        <div className="sticky top-0 z-30 flex items-center gap-3 px-5 pt-12 pb-4" style={{ background: "hsl(220,55%,12%)", borderBottom: "1px solid rgba(255,255,255,0.06)" }}>
          <button onClick={() => { setDrillView(selectedAP ? "ap" : null); setSelectedADP(null); }} className="text-white/40 hover:text-white"><ArrowLeft size={20} /></button>
          <div className="flex-1"><div className="text-white font-bold">{selectedADP.name}</div><div className="text-white/40 text-xs">Admin Portal · {adpAccounts.length}/{selectedADP.max_individual} accounts</div></div>
          <button onClick={() => setEditTarget({ type: "adp", data: selectedADP })} className="text-white/40 hover:text-yellow-400"><Edit2 size={16} /></button>
        </div>
        <div className="px-4 pt-4 space-y-4 pb-4">
          <div className="navy-card p-4">
            <div className="text-white/50 text-xs font-semibold uppercase tracking-wide mb-3">CEO Controls</div>
            <div className="grid grid-cols-3 gap-2 mb-2">
              <button onClick={() => handleToggleStatus("sub_admin_portals", selectedADP.id, selectedADP.name, "is_frozen", selectedADP.is_frozen || false)}
                className="py-2 rounded-xl text-xs" style={{ background: selectedADP.is_frozen ? "rgba(59,130,246,0.2)" : "rgba(255,255,255,0.07)", color: selectedADP.is_frozen ? "#60a5fa" : "rgba(255,255,255,0.5)" }}>
                {selectedADP.is_frozen ? "Unfreeze" : "Freeze"}
              </button>
              <button onClick={() => handleToggleStatus("sub_admin_portals", selectedADP.id, selectedADP.name, "is_closed", selectedADP.is_closed || false)}
                className="py-2 rounded-xl text-xs" style={{ background: selectedADP.is_closed ? "rgba(239,68,68,0.2)" : "rgba(255,255,255,0.07)", color: selectedADP.is_closed ? "#f87171" : "rgba(255,255,255,0.5)" }}>
                {selectedADP.is_closed ? "Open" : "Close"}
              </button>
              <button onClick={() => handleToggleStatus("sub_admin_portals", selectedADP.id, selectedADP.name, "is_inactive", selectedADP.is_inactive || false)}
                className="py-2 rounded-xl text-xs" style={{ background: selectedADP.is_inactive ? "rgba(251,146,60,0.2)" : "rgba(255,255,255,0.07)", color: selectedADP.is_inactive ? "#fb923c" : "rgba(255,255,255,0.5)" }}>
                {selectedADP.is_inactive ? "Activate" : "Inactive"}
              </button>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <button onClick={() => setTimerTarget({ table: "sub_admin_portals", id: selectedADP.id, name: selectedADP.name, statusField: "is_frozen" })}
                className="py-2 rounded-xl text-xs flex items-center justify-center gap-1" style={{ background: "rgba(255,255,255,0.05)", color: "rgba(255,255,255,0.5)" }}>
                <Timer size={11} /> Set Timer
              </button>
              <button onClick={() => handleDeleteADP(selectedADP)}
                className="py-2 rounded-xl text-xs flex items-center justify-center gap-1" style={{ background: "rgba(239,68,68,0.1)", color: "#f87171" }}>
                <Trash2 size={11} /> Delete
              </button>
            </div>
          </div>
          <h3 className="text-white font-bold">Individual Accounts ({adpAccounts.length})</h3>
          {adpAccounts.map(acc => (
            <button key={acc.id} onClick={() => { setSelectedAccount(acc); setDrillView("account"); }}
              className="w-full flex items-center gap-3 p-4 rounded-2xl text-left" style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.06)" }}>
              {acc.profile_picture ? <img src={acc.profile_picture} alt="" className="w-10 h-10 rounded-full object-cover" style={{ border: "2px solid hsl(43,85%,55%)" }} /> : <div className="w-10 h-10 rounded-full flex items-center justify-center text-sm font-bold" style={{ background: "hsl(220,50%,22%)", color: "hsl(43,85%,60%)" }}>{getInitials(acc.account_name)}</div>}
              <div className="flex-1 min-w-0"><div className="text-white text-sm font-medium">{acc.account_name}</div><div className="text-white/30 text-xs">{acc.account_number}</div></div>
              <div className="text-right">
                <div className="text-green-400 text-sm font-bold">{formatCurrency(acc.balance, acc.currency)}</div>
                <div className="flex gap-1 justify-end">{acc.is_frozen && <Snowflake size={10} color="#60a5fa" />}{acc.is_closed && <XCircle size={10} color="#f87171" />}</div>
              </div>
              <ChevronRight size={14} className="text-white/20" />
            </button>
          ))}
        </div>
        {editTarget && <CASEditAccountModal target={editTarget} onClose={() => setEditTarget(null)} onSuccess={() => { fetchAll(); setEditTarget(null); }} />}
        <CASBottomNav active={tab} onHome={() => { setDrillView(null); setSelectedADP(null); setTab("home"); }} onAccounts={() => { setDrillView(null); setSelectedADP(null); setTab("accounts"); }} onChats={() => setTab("chats")} onNotifications={() => setTab("notifications")} notifCount={unreadNotifs} chatCount={unreadChats} />
      </div>
    );
  }

  // ---- PANEL VIEWS ----
  if (tab === "chats") return <><CASChatPanel accounts={accounts} onClose={() => setTab("home")} /><CASBottomNav active={tab} onHome={() => setTab("home")} onAccounts={() => setTab("accounts")} onChats={() => setTab("chats")} onNotifications={() => setTab("notifications")} notifCount={unreadNotifs} chatCount={unreadChats} /></>;
  if (showAuditLog) return <CASAuditLogPanel accounts={accounts} onClose={() => setShowAuditLog(false)} />;
  if (showCurrencySettings) return <CASCurrencySettings accounts={accounts} onClose={() => setShowCurrencySettings(false)} />;
  if (showPlatformControls) return <CASPlatformControls accounts={accounts} onClose={() => setShowPlatformControls(false)} />;
  if (showCardReview) return <CASVirtualCardReview onClose={() => setShowCardReview(false)} accounts={accounts} />;
  if (tab === "notifications") return <><CASNotificationsPanel accounts={accounts} onClose={() => setTab("home")} /><CASBottomNav active={tab} onHome={() => setTab("home")} onAccounts={() => setTab("accounts")} onChats={() => setTab("chats")} onNotifications={() => setTab("notifications")} notifCount={unreadNotifs} chatCount={unreadChats} /></>;

  // ---- ACCOUNTS TAB ----
  if (tab === "accounts") {
    return (
      <div className="min-h-screen pb-24" style={{ background: "hsl(220,45%,8%)" }}>
        <div className="sticky top-0 z-30 flex items-center justify-between px-5 pt-12 pb-4" style={{ background: "hsl(220,55%,12%)", borderBottom: "1px solid rgba(255,255,255,0.06)" }}>
          <div className="text-white font-bold text-base">All Platform Accounts</div>
          <button onClick={() => setShowCreateMenu(!showCreateMenu)} className="gold-btn px-4 py-2 text-xs font-semibold flex items-center gap-1"><Plus size={14} /> Create</button>
        </div>
        {showCreateMenu && (
          <div className="mx-4 mt-3 rounded-2xl overflow-hidden" style={{ background: "hsl(220,50%,16%)", border: "1px solid rgba(255,255,255,0.1)" }}>
            {[
              { label: "Administration Plus Account", onClick: () => { setShowCreateAP(true); setShowCreateMenu(false); } },
              { label: "Admin Portal (ADP)", onClick: () => { setShowCreateADP(true); setShowCreateMenu(false); } },
              { label: "Individual Directive User", onClick: () => { setShowCreateIndividual(true); setShowCreateMenu(false); } },
            ].map(item => (
              <button key={item.label} onClick={item.onClick} className="w-full text-left px-5 py-3.5 text-white/80 text-sm hover:bg-white/5 transition-colors" style={{ borderBottom: "1px solid rgba(255,255,255,0.06)" }}>{item.label}</button>
            ))}
          </div>
        )}
        <div className="px-4 pt-3 pb-2">
          <div className="relative"><Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-white/30" /><input className="dark-input pl-9 text-sm" placeholder="Search accounts..." value={searchAcct} onChange={e => setSearchAcct(e.target.value)} /></div>
        </div>
        <div className="px-4 space-y-3 pb-4">
          {aps.map(ap => {
            const apSubAdmins = subAdmins.filter(s => s.created_by_ap === ap.id);
            const isExpAP = expandedAP === ap.id;
            return (
              <div key={ap.id} className="rounded-3xl overflow-hidden" style={{ background: "hsl(220,50%,14%)", border: "1px solid rgba(255,255,255,0.08)" }}>
                <div className="flex items-center gap-3 p-4">
                  {ap.profile_picture ? <img src={ap.profile_picture} alt="" className="w-10 h-10 rounded-full object-cover" style={{ border: "2px solid hsl(43,85%,55%)" }} /> : <div className="w-10 h-10 rounded-full flex items-center justify-center text-sm font-bold" style={{ background: "linear-gradient(135deg,hsl(43,85%,55%),hsl(38,80%,42%))", color: "#111" }}>{getInitials(ap.name)}</div>}
                  <button onClick={() => { setSelectedAP(ap); setDrillView("ap"); }} className="flex-1 text-left"><div className="text-white font-semibold text-sm">{ap.name}</div><div className="text-white/40 text-xs">AP Tier {ap.tier} · {apSubAdmins.length} admins</div></button>
                  <button onClick={() => setExpandedAP(isExpAP ? null : ap.id)} className="text-white/30 p-1"><ChevronRight size={16} style={{ transform: isExpAP ? "rotate(90deg)" : "none" }} /></button>
                </div>
                {isExpAP && apSubAdmins.map(sub => {
                  const subAccs = accounts.filter(a => a.created_by_sub_admin === sub.id).filter(a => !searchAcct || a.account_name.toLowerCase().includes(searchAcct.toLowerCase()));
                  const isExpSub = expandedSubAdmin === sub.id;
                  return (
                    <div key={sub.id} style={{ borderTop: "1px solid rgba(255,255,255,0.06)" }}>
                      <button onClick={() => setExpandedSubAdmin(isExpSub ? null : sub.id)} className="w-full px-6 py-3 flex items-center gap-3 text-left hover:bg-white/5">
                        <Building2 size={13} style={{ color: "hsl(43,85%,60%)" }} />
                        <span className="text-white/80 text-sm flex-1">{sub.name}</span>
                        <span className="text-white/40 text-xs">{subAccs.length} accounts</span>
                        <ChevronRight size={12} className="text-white/25" style={{ transform: isExpSub ? "rotate(90deg)" : "none" }} />
                      </button>
                      {isExpSub && subAccs.map(acc => (
                        <button key={acc.id} onClick={() => { setSelectedAccount(acc); setDrillView("account"); }} className="w-full flex items-center gap-3 px-8 py-2.5 hover:bg-white/5" style={{ borderTop: "1px solid rgba(255,255,255,0.04)" }}>
                          {acc.profile_picture ? <img src={acc.profile_picture} alt="" className="w-8 h-8 rounded-full object-cover" /> : <div className="w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold" style={{ background: "hsl(220,50%,22%)", color: "hsl(43,85%,60%)" }}>{getInitials(acc.account_name)}</div>}
                          <div className="flex-1 min-w-0"><div className="text-white text-xs font-medium">{acc.account_name}</div><div className="text-white/30 text-xs">{acc.account_number}</div></div>
                          <span className="text-green-400 text-xs font-bold">{formatCurrency(acc.balance, acc.currency)}</span>
                          <ChevronRight size={12} className="text-white/20" />
                        </button>
                      ))}
                    </div>
                  );
                })}
              </div>
            );
          })}
          <div className="rounded-3xl overflow-hidden" style={{ background: "hsl(220,50%,14%)", border: "1px solid rgba(255,255,255,0.08)" }}>
            <div className="p-4 flex items-center gap-3">
              <div className="w-10 h-10 rounded-full flex items-center justify-center" style={{ background: "hsl(220,55%,22%)", border: "1px solid rgba(255,255,255,0.1)" }}><Crown size={16} style={{ color: "hsl(43,85%,60%)" }} /></div>
              <div><div className="text-white font-semibold text-sm">Mother Admin Portal</div><div className="text-white/40 text-xs">{accounts.filter(a => !a.created_by_sub_admin).length} direct accounts</div></div>
            </div>
            {filteredAccounts.filter(a => !a.created_by_sub_admin).map(acc => (
              <button key={acc.id} onClick={() => { setSelectedAccount(acc); setDrillView("account"); }} className="w-full flex items-center gap-3 px-4 py-3 hover:bg-white/5 text-left" style={{ borderTop: "1px solid rgba(255,255,255,0.06)" }}>
                {acc.profile_picture ? <img src={acc.profile_picture} alt="" className="w-9 h-9 rounded-full object-cover" /> : <div className="w-9 h-9 rounded-full flex items-center justify-center text-sm font-bold" style={{ background: "hsl(220,50%,22%)", color: "hsl(43,85%,60%)" }}>{getInitials(acc.account_name)}</div>}
                <div className="flex-1 min-w-0"><div className="text-white text-sm font-medium">{acc.account_name}</div><div className="text-white/30 text-xs">{acc.account_number}</div></div>
                <div className="text-right"><div className="text-green-400 text-sm font-bold">{formatCurrency(acc.balance, acc.currency)}</div><div className="flex gap-1 justify-end mt-0.5">{acc.is_frozen && <Snowflake size={10} color="#60a5fa" />}{acc.is_closed && <XCircle size={10} color="#f87171" />}</div></div>
                <ChevronRight size={14} className="text-white/20" />
              </button>
            ))}
          </div>
        </div>
        {showCreateAP && <CASCreatePortalModal type="ap" onClose={() => setShowCreateAP(false)} onSuccess={fetchAll} />}
        {showCreateADP && <CASCreatePortalModal type="adp" onClose={() => setShowCreateADP(false)} onSuccess={fetchAll} />}
        {showCreateIndividual && <CreateAccountModal onClose={() => setShowCreateIndividual(false)} onSuccess={fetchAll} />}
        <CASBottomNav active={tab} onHome={() => setTab("home")} onAccounts={() => setTab("accounts")} onChats={() => setTab("chats")} onNotifications={() => setTab("notifications")} notifCount={unreadNotifs} chatCount={unreadChats} />
      </div>
    );
  }

  // ---- HOME TAB ----
  return (
    <div className="min-h-screen pb-24" style={{ background: "hsl(220,45%,8%)" }}>
      <div className="sticky top-0 z-30 flex items-center justify-between px-5 pt-12 pb-4" style={{ background: "hsl(220,55%,12%)", borderBottom: "1px solid rgba(255,255,255,0.06)" }}>
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl flex items-center justify-center" style={{ background: "linear-gradient(135deg, hsl(43,85%,55%), hsl(38,80%,42%))" }}>
            <Crown size={18} className="text-gray-900" />
          </div>
          <div>
            <div className="text-white/40 text-xs">BKU · CEO Administrative System</div>
            <div className="text-white font-bold text-sm">BankUnited · CAS</div>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <button onClick={() => setShowConverter(!showConverter)} className="text-white/40 hover:text-white/70 text-xs font-bold">FX</button>
          <button onClick={handleLogout} className="text-white/40 hover:text-white/70"><LogOut size={16} /></button>
        </div>
      </div>

      <div className="px-4 pt-4 space-y-4 pb-4">
        {showConverter && <CurrencyConverterWidget />}

        {/* Total Balance Card */}
        <div className="rounded-3xl p-5 relative overflow-hidden" style={{ background: "linear-gradient(135deg, hsl(220,60%,18%) 0%, hsl(220,70%,12%) 100%)", border: "1px solid rgba(255,255,255,0.1)" }}>
          <div className="absolute top-0 right-0 w-32 h-32 rounded-full opacity-10" style={{ background: "hsl(43,85%,60%)", transform: "translate(30%,-30%)" }} />
          <div className="flex items-start justify-between mb-3">
            <div>
              <div className="text-white/40 text-xs mb-1">Total Balance · All Platform</div>
              <div className="text-white font-bold" style={{ fontSize: "clamp(1.6rem, 5vw, 2.4rem)" }}>
                {showBalance ? formatCurrency(totalBalance, "USD") : "••••••••"}
              </div>
            </div>
            <button onClick={() => setShowBalance(!showBalance)} className="text-white/40 hover:text-white">
              {showBalance ? <Eye size={18} /> : <EyeOff size={18} />}
            </button>
          </div>
          <div className="grid grid-cols-3 gap-2">
            <div className="rounded-xl p-2 text-center" style={{ background: "rgba(255,255,255,0.06)" }}>
              <div style={{ color: "hsl(43,85%,60%)" }} className="font-bold text-base">{aps.length}</div>
              <div className="text-white/30 text-xs">AP</div>
            </div>
            <div className="rounded-xl p-2 text-center" style={{ background: "rgba(255,255,255,0.06)" }}>
              <div className="text-blue-400 font-bold text-base">{subAdmins.length}</div>
              <div className="text-white/30 text-xs">ADP</div>
            </div>
            <div className="rounded-xl p-2 text-center" style={{ background: "rgba(255,255,255,0.06)" }}>
              <div className="text-green-400 font-bold text-base">{accounts.length}</div>
              <div className="text-white/30 text-xs">IDA</div>
            </div>
          </div>
        </div>

        {/* Total In / Out */}
        <div className="grid grid-cols-2 gap-3">
          <div className="rounded-2xl p-4" style={{ background: "rgba(34,197,94,0.08)", border: "1px solid rgba(34,197,94,0.2)" }}>
            <div className="flex items-center gap-1.5 mb-1"><TrendingUp size={13} color="#22c55e" /><span className="text-green-400 text-xs">Total In</span></div>
            <div className="text-white font-bold">{formatCurrency(totalIn, "USD")}</div>
            <div className="text-white/30 text-xs">{transactions.filter(t => t.type === "deposit" || t.type === "credit").length} txns</div>
          </div>
          <div className="rounded-2xl p-4" style={{ background: "rgba(239,68,68,0.08)", border: "1px solid rgba(239,68,68,0.2)" }}>
            <div className="flex items-center gap-1.5 mb-1"><TrendingDown size={13} color="#ef4444" /><span className="text-red-400 text-xs">Total Out</span></div>
            <div className="text-white font-bold">{formatCurrency(totalOut, "USD")}</div>
            <div className="text-white/30 text-xs">{transactions.filter(t => t.type !== "deposit" && t.type !== "credit").length} txns</div>
          </div>
        </div>

        {/* Platform Aggregate Counters */}
        <div className="grid grid-cols-3 gap-2">
          <div className="rounded-2xl p-3 text-center" style={{ background: "rgba(200,155,50,0.07)", border: "1px solid rgba(200,155,50,0.2)" }}>
            <div style={{ color: "hsl(43,85%,60%)" }} className="font-bold text-sm">${(savingsTotal / 1000).toFixed(1)}K</div>
            <div className="text-white/40 text-xs mt-0.5">Total Saved</div>
          </div>
          <div className="rounded-2xl p-3 text-center" style={{ background: "rgba(59,130,246,0.07)", border: "1px solid rgba(59,130,246,0.2)" }}>
            <div className="text-blue-400 font-bold text-sm">${(loansTotal / 1000).toFixed(1)}K</div>
            <div className="text-white/40 text-xs mt-0.5">Active Loans</div>
          </div>
          <div className="rounded-2xl p-3 text-center" style={{ background: "rgba(34,197,94,0.07)", border: "1px solid rgba(34,197,94,0.2)" }}>
            <div className="text-green-400 font-bold text-sm">${(billsTotal / 1000).toFixed(1)}K</div>
            <div className="text-white/40 text-xs mt-0.5">Bills Paid</div>
          </div>
        </div>

        {/* Quick Actions */}
        <div className="grid grid-cols-2 gap-3">
          <button onClick={() => setShowDeposit(true)} className="gold-btn py-3 text-xs font-semibold flex items-center justify-center gap-1.5">
            <Plus size={14} /> CEO Deposit
          </button>
          <button onClick={() => setShowScheduled(true)} className="py-3 rounded-2xl text-xs font-semibold flex items-center justify-center gap-1.5" style={{ background: "rgba(200,155,50,0.1)", color: "hsl(43,85%,60%)", border: "1px solid rgba(200,155,50,0.2)" }}>
            <Calendar size={14} /> Schedule Tx
          </button>
        </div>

        {/* Platform Controls & Audit Log */}
        <div className="grid grid-cols-2 gap-3">
          <button onClick={() => setShowPlatformControls(true)} className="flex items-center gap-2 px-4 py-3 rounded-2xl text-left" style={{ background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.09)" }}>
            <Activity size={15} style={{ color: "hsl(43,85%,60%)" }} />
            <div><div className="text-white font-semibold text-xs">Platform Controls</div><div className="text-white/30 text-xs">Tiers, Loans, Cheques</div></div>
          </button>
          <button onClick={() => setShowAuditLog(true)} className="flex items-center gap-2 px-4 py-3 rounded-2xl text-left" style={{ background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.09)" }}>
            <Search size={15} style={{ color: "hsl(43,85%,60%)" }} />
            <div><div className="text-white font-semibold text-xs">Audit Log</div><div className="text-white/30 text-xs">{auditLog.length} events</div></div>
          </button>
        </div>

        {/* Statement Download */}
        <button onClick={() => setShowStatementDownload(!showStatementDownload)} className="w-full flex items-center gap-3 px-4 py-3.5 rounded-2xl text-left" style={{ background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.09)" }}>
          <div className="w-10 h-10 rounded-2xl flex items-center justify-center flex-shrink-0" style={{ background: "rgba(200,155,50,0.12)" }}>
            <Download size={18} style={{ color: "hsl(43,85%,60%)" }} />
          </div>
          <div>
            <div className="text-white font-semibold text-sm">Download User Statement</div>
            <div className="text-white/40 text-xs">BankUnited official statement for any account</div>
          </div>
        </button>
        {showStatementDownload && (
          <div className="rounded-2xl p-4 space-y-3" style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)" }}>
            <div className="text-white/60 text-xs font-semibold">Select Account & Date Range</div>
            <select className="dark-input text-sm" value={stmtAccount} onChange={e => setStmtAccount(e.target.value)}>
              <option value="">Select account...</option>
              {accounts.map(a => <option key={a.id} value={a.id}>{a.account_name} — {a.account_number}</option>)}
            </select>
            <div className="grid grid-cols-2 gap-2">
              <div><label className="text-white/40 text-xs mb-1 block">From Date</label><input type="date" className="dark-input py-2 text-xs" value={stmtFrom} onChange={e => setStmtFrom(e.target.value)} /></div>
              <div><label className="text-white/40 text-xs mb-1 block">To Date</label><input type="date" className="dark-input py-2 text-xs" value={stmtTo} onChange={e => setStmtTo(e.target.value)} /></div>
            </div>
            <button onClick={handleDownloadStatement} disabled={!stmtAccount} className="gold-btn w-full py-2.5 text-xs font-semibold flex items-center justify-center gap-2" style={{ opacity: !stmtAccount ? 0.5 : 1 }}>
              <Download size={13} /> Generate & Download Statement
            </button>
          </div>
        )}

        {/* Currency Settings */}
        <button onClick={() => setShowCurrencySettings(true)} className="w-full flex items-center gap-3 px-4 py-3.5 rounded-2xl text-left" style={{ background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.09)" }}>
          <div className="w-10 h-10 rounded-2xl flex items-center justify-center flex-shrink-0" style={{ background: "rgba(200,155,50,0.12)" }}>
            <span style={{ fontSize: 18 }}>🌐</span>
          </div>
          <div>
            <div className="text-white font-semibold text-sm">IDA Currency Settings</div>
            <div className="text-white/40 text-xs">Manage multi-currency per account · {ALL_CURRENCIES.length} currencies</div>
          </div>
        </button>

        {/* Virtual Card Applications */}
        <button onClick={() => setShowCardReview(true)} className="w-full flex items-center gap-3 px-4 py-3.5 rounded-2xl text-left transition-colors" style={{ background: "rgba(200,155,50,0.06)", border: "1px solid rgba(200,155,50,0.2)" }}>
          <div className="w-10 h-10 rounded-2xl flex items-center justify-center flex-shrink-0" style={{ background: "rgba(200,155,50,0.15)" }}>
            <CreditCard size={18} style={{ color: "hsl(43,85%,60%)" }} />
          </div>
          <div className="flex-1">
            <div className="text-white font-semibold text-sm">Virtual Card Applications</div>
            <div className="text-white/40 text-xs mt-0.5">Review, approve or decline user applications</div>
          </div>
          {pendingCardApps > 0 && <span className="bg-yellow-500 text-gray-900 text-xs rounded-full px-2 py-0.5 font-bold">{pendingCardApps}</span>}
        </button>

        {/* Create shortcuts */}
        <div className="grid grid-cols-3 gap-2">
          <button onClick={() => setShowCreateAP(true)} className="py-2.5 rounded-2xl text-xs font-medium" style={{ background: "rgba(255,255,255,0.07)", color: "rgba(255,255,255,0.6)" }}>+ AP</button>
          <button onClick={() => setShowCreateADP(true)} className="py-2.5 rounded-2xl text-xs font-medium" style={{ background: "rgba(255,255,255,0.07)", color: "rgba(255,255,255,0.6)" }}>+ ADP</button>
          <button onClick={() => setShowCreateIndividual(true)} className="py-2.5 rounded-2xl text-xs font-medium" style={{ background: "rgba(255,255,255,0.07)", color: "rgba(255,255,255,0.6)" }}>+ IDA</button>
        </div>

        {/* Portal shortcuts */}
        <div>
          <div className="text-white/40 text-xs font-semibold mb-2">Navigate To</div>
          <div className="grid grid-cols-3 gap-2">
            {[{ label: "Individual", path: "/" }, { label: "Admin Portal", path: "/admin" }, { label: "AP Portal", path: "/ap/login" }].map(btn => (
              <button key={btn.path} onClick={() => navigate(btn.path)} className="py-2.5 rounded-xl text-xs text-white/50 hover:text-white/70 transition-colors" style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.06)" }}>{btn.label}</button>
            ))}
          </div>
        </div>

        {/* Activity Log */}
        <div>
          <div className="flex items-center gap-2 mb-3"><Activity size={15} style={{ color: "hsl(43,85%,60%)" }} /><span className="text-white font-bold text-sm">Recent Login Activity</span></div>
          {loginActivity.slice(0, 5).map(log => (
            <div key={log.id} className="flex items-center gap-3 py-2.5" style={{ borderBottom: "1px solid rgba(255,255,255,0.05)" }}>
              <div className="flex-1 min-w-0"><div className="text-white text-xs font-medium truncate">{log.account_name}</div><div className="text-white/40 text-xs">{log.portal_type}</div></div>
              <div className="text-white/30 text-xs flex-shrink-0">{formatDateTime(log.login_at)}</div>
            </div>
          ))}
          {loginActivity.length === 0 && <div className="text-white/25 text-xs text-center py-4">No activity yet</div>}
        </div>

        {/* Recent Transactions */}
        <div>
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-white font-bold text-sm">Recent Transactions</h3>
            <button onClick={() => setTab("accounts")} className="text-white/40 text-xs hover:text-white/60">View all</button>
          </div>
          <div className="space-y-2">
            {transactions.slice(0, 10).map(tx => {
              const acc = accounts.find(a => a.id === tx.account_id);
              const isIn = tx.type === "deposit" || tx.type === "credit";
              return (
                <button key={tx.id} onClick={() => setSelectedTx(tx)} className="w-full flex items-center gap-3 p-3 rounded-2xl text-left" style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.06)" }}>
                  <div className="w-8 h-8 rounded-xl flex items-center justify-center flex-shrink-0" style={{ background: isIn ? "rgba(34,197,94,0.12)" : "rgba(239,68,68,0.12)" }}>
                    <TrendingUp size={14} color={isIn ? "#22c55e" : "#ef4444"} style={{ transform: isIn ? "none" : "rotate(180deg)" }} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="text-white text-xs font-medium">{acc?.account_name || "—"}</div>
                    <div className="text-white/30 text-xs">{tx.recipient_name || (isIn ? "Deposit" : "Transfer")} · {formatDateTime(tx.custom_timestamp)}</div>
                  </div>
                  <span className="font-bold text-xs flex-shrink-0" style={{ color: isIn ? "#22c55e" : "#ef4444" }}>
                    {isIn ? "+" : "-"}{formatCurrency(tx.amount, acc?.currency || "USD")}
                  </span>
                </button>
              );
            })}
          </div>
        </div>
      </div>

      {/* Modals */}
      {selectedTx && <TransactionReceiptModal tx={{ ...selectedTx, account_name: accounts.find(a => a.id === selectedTx.account_id)?.account_name, currency: accounts.find(a => a.id === selectedTx.account_id)?.currency }} onClose={() => setSelectedTx(null)} />}
      {editTx && <EditTransactionModal tx={editTx} onClose={() => setEditTx(null)} onSuccess={fetchAll} />}
      {showDeposit && <AdminDepositModal accounts={accounts} onClose={() => setShowDeposit(false)} onSuccess={fetchAll} />}
      {showCreateIndividual && <CreateAccountModal onClose={() => setShowCreateIndividual(false)} onSuccess={fetchAll} />}
      {showCreateAP && <CASCreatePortalModal type="ap" onClose={() => setShowCreateAP(false)} onSuccess={fetchAll} />}
      {showCreateADP && <CASCreatePortalModal type="adp" onClose={() => setShowCreateADP(false)} onSuccess={fetchAll} />}
      {showScheduled && <CASScheduledTxModal accounts={accounts} onClose={() => setShowScheduled(false)} onSuccess={fetchAll} />}
      {editTarget && <CASEditAccountModal target={editTarget} onClose={() => setEditTarget(null)} onSuccess={fetchAll} />}

      <CASBottomNav active={tab} onHome={() => setTab("home")} onAccounts={() => setTab("accounts")} onChats={() => setTab("chats")} onNotifications={() => setTab("notifications")} notifCount={unreadNotifs} chatCount={unreadChats} />
    </div>
  );
}
