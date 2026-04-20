import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import {
  supabase, type Account, type Transaction, type BankingNotification,
  logAudit, trackLogin
} from "@/lib/supabase";
import { formatCurrency, formatDateTime, getInitials, downloadAsCSV } from "@/lib/utils";
import { usePolling } from "@/hooks/usePolling";
import AdminBottomNav from "@/components/features/AdminBottomNav";
import CreateAccountModal from "@/components/features/CreateAccountModal";
import EditAccountModal from "@/components/features/EditAccountModal";
import AdminDepositModal from "@/components/features/AdminDepositModal";
import AdminMessages from "@/components/features/AdminMessages";
import AdminNotifications from "@/components/features/AdminNotifications";
import EditTransactionModal from "@/components/features/EditTransactionModal";
import TransactionReceiptModal from "@/components/features/TransactionReceiptModal";
import CurrencyConverterWidget from "@/components/features/CurrencyConverterWidget";
import AdminAnalyticsPanel from "@/components/features/AdminAnalyticsPanel";
import AdminAuditLogPanel from "@/components/features/AdminAuditLogPanel";
import {
  Plus, Search, Snowflake, XCircle, Edit2, LogOut,
  ArrowDownLeft, ArrowUpRight, ChevronRight, Users,
  TrendingUp, DollarSign, Eye, EyeOff, RefreshCw, X,
  BarChart2, ClipboardList, Download, Calendar, Filter
} from "lucide-react";
import bankLogo from "@/assets/bankunited-logo.jpg";
import { toast } from "sonner";

export default function AdminDashboard() {
  const navigate = useNavigate();
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [notifications, setNotifications] = useState<BankingNotification[]>([]);
  const [msgCount, setMsgCount] = useState(0);
  const [search, setSearch] = useState("");
  const [activeTab, setActiveTab] = useState<"home" | "notifications" | "messages">("home");
  const [showCreate, setShowCreate] = useState(false);
  const [editAccount, setEditAccount] = useState<Account | null>(null);
  const [showDeposit, setShowDeposit] = useState(false);
  const [depositTarget, setDepositTarget] = useState<Account | undefined>(undefined);
  const [expandedAccount, setExpandedAccount] = useState<string | null>(null);
  const [selectedTx, setSelectedTx] = useState<Transaction | null>(null);
  const [editTx, setEditTx] = useState<Transaction | null>(null);
  const [loading, setLoading] = useState(true);
  const [showAnalytics, setShowAnalytics] = useState(false);
  const [showAudit, setShowAudit] = useState(false);
  const [showConverter, setShowConverter] = useState(false);
  // Clickable stats
  const [statsModal, setStatsModal] = useState<"accounts" | "frozen" | "closed" | "balance" | null>(null);
  // Filter state
  const [txFilterType, setTxFilterType] = useState<"all" | "deposit" | "transfer">("all");
  const [txFilterFrom, setTxFilterFrom] = useState("");
  const [txFilterTo, setTxFilterTo] = useState("");
  const [txFilterMonth, setTxFilterMonth] = useState("");
  const [showTxFilter, setShowTxFilter] = useState(false);

  useEffect(() => {
    const session = localStorage.getItem("ghob_admin_session");
    if (!session) { navigate("/admin"); return; }
    fetchAll();
  }, [navigate]);

  const fetchAll = async () => {
    await Promise.all([fetchAccounts(), fetchTransactions(), fetchNotifications(), fetchMsgCount()]);
    setLoading(false);
  };

  const fetchAccounts = async () => {
    const { data } = await supabase.from("banking_accounts").select("*").order("created_at", { ascending: false });
    if (data) setAccounts(data);
  };
  const fetchTransactions = async () => {
    const { data } = await supabase.from("banking_transactions").select("*").order("custom_timestamp", { ascending: false }).limit(500);
    if (data) setTransactions(data);
  };
  const fetchNotifications = async () => {
    const { data } = await supabase.from("banking_notifications").select("*").eq("target", "admin").order("created_at", { ascending: false });
    if (data) setNotifications(data);
  };
  const fetchMsgCount = async () => {
    const { data } = await supabase.from("banking_messages").select("id").eq("sender", "user").eq("is_seen", false);
    setMsgCount(data?.length || 0);
  };

  usePolling(fetchAll, 5000, !showCreate && !editAccount && !showDeposit);

  const handleLogout = () => { localStorage.removeItem("ghob_admin_session"); navigate("/admin"); };

  const handleDeleteAccount = async (accountId: string) => {
    if (!confirm("Delete this account and all its transactions? This cannot be undone.")) return;
    await supabase.from("banking_accounts").delete().eq("id", accountId);
    await logAudit("delete_account", accountId);
    fetchAccounts();
    setEditAccount(null);
  };

  const handleToggleFreeze = async (acc: Account) => {
    await supabase.from("banking_accounts").update({ is_frozen: !acc.is_frozen, updated_at: new Date().toISOString() }).eq("id", acc.id);
    await logAudit(acc.is_frozen ? "unfreeze_account" : "freeze_account", acc.id, acc.account_name);
    toast.success(`Account ${acc.is_frozen ? "unfrozen" : "frozen"}.`);
    fetchAccounts();
  };

  const handleToggleClose = async (acc: Account) => {
    await supabase.from("banking_accounts").update({ is_closed: !acc.is_closed, updated_at: new Date().toISOString() }).eq("id", acc.id);
    await logAudit(acc.is_closed ? "reopen_account" : "close_account", acc.id, acc.account_name);
    toast.success(`Account ${acc.is_closed ? "reopened" : "closed"}.`);
    fetchAccounts();
  };

  const handleExportAccounts = () => {
    const rows = [
      ["Name", "Number", "Type", "Balance", "Currency", "Email", "State", "Country", "Status"],
      ...accounts.map(a => [a.account_name, a.account_number, a.account_type, String(a.balance), a.currency, a.login_email, a.state || "", a.country || "", a.is_frozen ? "Frozen" : a.is_closed ? "Closed" : "Active"]),
    ];
    downloadAsCSV(rows, "ghob-accounts-export");
  };

  const filteredAccounts = accounts.filter(a =>
    a.account_name.toLowerCase().includes(search.toLowerCase()) ||
    a.account_number.toLowerCase().includes(search.toLowerCase()) ||
    a.login_email.toLowerCase().includes(search.toLowerCase())
  );

  // Filtered transactions for expanded account
  const getFilteredTxs = (accId: string) => {
    return transactions.filter(t => {
      if (t.account_id !== accId) return false;
      if (txFilterType !== "all" && t.type !== txFilterType) return false;
      if (txFilterMonth) {
        const d = new Date(t.custom_timestamp);
        const m = `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}`;
        if (m !== txFilterMonth) return false;
      }
      if (txFilterFrom && new Date(t.custom_timestamp) < new Date(txFilterFrom)) return false;
      if (txFilterTo && new Date(t.custom_timestamp) > new Date(txFilterTo + "T23:59:59")) return false;
      return true;
    });
  };

  const totalBalance = accounts.reduce((s, a) => s + Number(a.balance), 0);
  const frozenCount = accounts.filter(a => a.is_frozen).length;
  const closedCount = accounts.filter(a => a.is_closed).length;
  const unreadNotifs = notifications.filter(n => !n.is_read).length;

  // Currency breakdown
  const currencyBreakdown = accounts.reduce((acc, a) => {
    acc[a.currency] = (acc[a.currency] || 0) + Number(a.balance);
    return acc;
  }, {} as Record<string, number>);

  if (loading) return (
    <div className="min-h-screen flex items-center justify-center" style={{ background: "hsl(220,45%,8%)" }}>
      <div className="w-8 h-8 border-2 border-yellow-500/30 border-t-yellow-500 rounded-full animate-spin" />
    </div>
  );

  if (activeTab === "notifications") return (
    <>
      <AdminNotifications notifications={notifications} onClose={() => setActiveTab("home")} onRefresh={fetchNotifications} />
      <AdminBottomNav active={activeTab} onHome={() => setActiveTab("home")} onNotifications={() => setActiveTab("notifications")} onMessages={() => setActiveTab("messages")} notifCount={unreadNotifs} msgCount={msgCount} />
    </>
  );

  if (activeTab === "messages") return (
    <>
      <AdminMessages onClose={() => setActiveTab("home")} accounts={accounts} />
      <AdminBottomNav active={activeTab} onHome={() => setActiveTab("home")} onNotifications={() => setActiveTab("notifications")} onMessages={() => setActiveTab("messages")} notifCount={unreadNotifs} msgCount={msgCount} />
    </>
  );

  if (showAnalytics) return <AdminAnalyticsPanel transactions={transactions} accounts={accounts} onClose={() => setShowAnalytics(false)} />;
  if (showAudit) return <AdminAuditLogPanel onClose={() => setShowAudit(false)} />;

  // Stats modals
  if (statsModal === "accounts") {
    return (
      <div className="min-h-screen pb-24" style={{ background: "hsl(220,45%,8%)" }}>
        <div className="sticky top-0 z-30 flex items-center gap-3 px-5 pt-12 pb-4" style={{ background: "hsl(220,55%,12%)", borderBottom: "1px solid rgba(255,255,255,0.06)" }}>
          <button onClick={() => setStatsModal(null)} className="text-white/40 hover:text-white"><ChevronRight size={20} style={{ transform: "rotate(180deg)" }} /></button>
          <div className="text-white font-bold">All Accounts ({accounts.length})</div>
        </div>
        <div className="p-4 space-y-3">
          {accounts.map(acc => (
            <div key={acc.id} className="flex items-center gap-3 p-4 rounded-2xl" style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.06)" }}>
              {acc.profile_picture ? <img src={acc.profile_picture} alt="" className="w-10 h-10 rounded-full object-cover" style={{ border: "2px solid hsl(43,85%,55%)" }} /> : <div className="w-10 h-10 rounded-full flex items-center justify-center text-sm font-bold" style={{ background: "hsl(220,50%,22%)", color: "hsl(43,85%,60%)" }}>{getInitials(acc.account_name)}</div>}
              <div className="flex-1 min-w-0">
                <div className="text-white font-semibold text-sm">{acc.account_name}</div>
                <div className="text-white/40 text-xs">{acc.account_type} · {acc.account_number}</div>
              </div>
              <div className="text-right">
                <div className="text-white font-bold text-sm">{formatCurrency(acc.balance, acc.currency)}</div>
                {acc.is_frozen && <span className="text-blue-400 text-xs">Frozen</span>}
                {acc.is_closed && <span className="text-red-400 text-xs">Closed</span>}
              </div>
            </div>
          ))}
        </div>
        <AdminBottomNav active="home" onHome={() => setStatsModal(null)} onNotifications={() => setActiveTab("notifications")} onMessages={() => setActiveTab("messages")} notifCount={unreadNotifs} msgCount={msgCount} />
      </div>
    );
  }

  if (statsModal === "frozen") {
    const frozen = accounts.filter(a => a.is_frozen);
    return (
      <div className="min-h-screen pb-24" style={{ background: "hsl(220,45%,8%)" }}>
        <div className="sticky top-0 z-30 flex items-center gap-3 px-5 pt-12 pb-4" style={{ background: "hsl(220,55%,12%)", borderBottom: "1px solid rgba(255,255,255,0.06)" }}>
          <button onClick={() => setStatsModal(null)} className="text-white/40 hover:text-white"><ChevronRight size={20} style={{ transform: "rotate(180deg)" }} /></button>
          <div className="text-white font-bold">Frozen Accounts ({frozen.length})</div>
        </div>
        <div className="p-4 space-y-3">
          {frozen.length === 0 && <div className="text-center py-12 text-white/30 text-sm">No frozen accounts</div>}
          {frozen.map(acc => (
            <div key={acc.id} className="p-4 rounded-2xl" style={{ background: "rgba(59,130,246,0.08)", border: "1px solid rgba(59,130,246,0.2)" }}>
              <div className="flex items-center gap-3 mb-3">
                {acc.profile_picture ? <img src={acc.profile_picture} alt="" className="w-10 h-10 rounded-full object-cover" /> : <div className="w-10 h-10 rounded-full flex items-center justify-center text-sm font-bold" style={{ background: "hsl(220,50%,22%)", color: "hsl(43,85%,60%)" }}>{getInitials(acc.account_name)}</div>}
                <div className="flex-1">
                  <div className="text-white font-semibold">{acc.account_name}</div>
                  <div className="text-blue-400 text-xs flex items-center gap-1"><Snowflake size={11} /> Frozen</div>
                </div>
              </div>
              <button onClick={() => handleToggleFreeze(acc)} className="w-full py-2.5 rounded-xl text-sm font-semibold" style={{ background: "rgba(59,130,246,0.2)", color: "#60a5fa" }}>
                Unfreeze Account
              </button>
            </div>
          ))}
        </div>
        <AdminBottomNav active="home" onHome={() => setStatsModal(null)} onNotifications={() => setActiveTab("notifications")} onMessages={() => setActiveTab("messages")} notifCount={unreadNotifs} msgCount={msgCount} />
      </div>
    );
  }

  if (statsModal === "closed") {
    const closed = accounts.filter(a => a.is_closed);
    return (
      <div className="min-h-screen pb-24" style={{ background: "hsl(220,45%,8%)" }}>
        <div className="sticky top-0 z-30 flex items-center gap-3 px-5 pt-12 pb-4" style={{ background: "hsl(220,55%,12%)", borderBottom: "1px solid rgba(255,255,255,0.06)" }}>
          <button onClick={() => setStatsModal(null)} className="text-white/40 hover:text-white"><ChevronRight size={20} style={{ transform: "rotate(180deg)" }} /></button>
          <div className="text-white font-bold">Closed Accounts ({closed.length})</div>
        </div>
        <div className="p-4 space-y-3">
          {closed.length === 0 && <div className="text-center py-12 text-white/30 text-sm">No closed accounts</div>}
          {closed.map(acc => (
            <div key={acc.id} className="p-4 rounded-2xl" style={{ background: "rgba(239,68,68,0.08)", border: "1px solid rgba(239,68,68,0.2)" }}>
              <div className="flex items-center gap-3 mb-3">
                {acc.profile_picture ? <img src={acc.profile_picture} alt="" className="w-10 h-10 rounded-full object-cover" /> : <div className="w-10 h-10 rounded-full flex items-center justify-center text-sm font-bold" style={{ background: "hsl(220,50%,22%)", color: "hsl(43,85%,60%)" }}>{getInitials(acc.account_name)}</div>}
                <div className="flex-1">
                  <div className="text-white font-semibold">{acc.account_name}</div>
                  <div className="text-red-400 text-xs flex items-center gap-1"><XCircle size={11} /> Closed</div>
                </div>
              </div>
              <button onClick={() => handleToggleClose(acc)} className="w-full py-2.5 rounded-xl text-sm font-semibold" style={{ background: "rgba(239,68,68,0.15)", color: "#f87171" }}>
                Reopen Account
              </button>
            </div>
          ))}
        </div>
        <AdminBottomNav active="home" onHome={() => setStatsModal(null)} onNotifications={() => setActiveTab("notifications")} onMessages={() => setActiveTab("messages")} notifCount={unreadNotifs} msgCount={msgCount} />
      </div>
    );
  }

  if (statsModal === "balance") {
    return (
      <div className="min-h-screen pb-24" style={{ background: "hsl(220,45%,8%)" }}>
        <div className="sticky top-0 z-30 flex items-center gap-3 px-5 pt-12 pb-4" style={{ background: "hsl(220,55%,12%)", borderBottom: "1px solid rgba(255,255,255,0.06)" }}>
          <button onClick={() => setStatsModal(null)} className="text-white/40 hover:text-white"><ChevronRight size={20} style={{ transform: "rotate(180deg)" }} /></button>
          <div className="text-white font-bold">Balance by Currency</div>
        </div>
        <div className="p-4 space-y-3">
          {Object.entries(currencyBreakdown).map(([curr, bal]) => (
            <div key={curr} className="flex items-center justify-between p-4 rounded-2xl" style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)" }}>
              <div>
                <div className="text-white font-bold text-lg">{curr}</div>
                <div className="text-white/40 text-xs">{accounts.filter(a => a.currency === curr).length} accounts</div>
              </div>
              <div className="text-yellow-400 font-bold text-xl">{formatCurrency(bal, curr)}</div>
            </div>
          ))}
        </div>
        <AdminBottomNav active="home" onHome={() => setStatsModal(null)} onNotifications={() => setActiveTab("notifications")} onMessages={() => setActiveTab("messages")} notifCount={unreadNotifs} msgCount={msgCount} />
      </div>
    );
  }

  return (
    <div className="min-h-screen pb-24" style={{ background: "hsl(220,45%,8%)" }}>
      {/* Header */}
      <div className="sticky top-0 z-30 flex items-center justify-between px-5 pt-12 pb-4" style={{ background: "hsl(220,55%,12%)", borderBottom: "1px solid rgba(255,255,255,0.06)" }}>
        <div className="flex items-center gap-3">
          <img src={bankLogo} alt="BankUnited" className="w-9 h-9 rounded-xl bg-white p-0.5" />
          <div>
            <div className="text-white/50 text-xs">Business Directory</div>
            <div className="text-white font-bold text-sm leading-tight">Administration Portal</div>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <button onClick={() => setShowConverter(!showConverter)} className="text-white/40 hover:text-white/70 transition-colors" title="Currency Converter"><span className="text-xs font-bold">FX</span></button>
          <button onClick={() => setShowAnalytics(true)} className="text-white/40 hover:text-white/70 transition-colors"><BarChart2 size={18} /></button>
          <button onClick={() => setShowAudit(true)} className="text-white/40 hover:text-white/70 transition-colors"><ClipboardList size={18} /></button>
          <button onClick={handleLogout} className="text-white/40 hover:text-white/70 text-xs flex items-center gap-1"><LogOut size={16} /></button>
        </div>
      </div>

      <div className="px-4 pt-5 space-y-4">
        {showConverter && <CurrencyConverterWidget />}

        {/* Stats Grid */}
        <div className="grid grid-cols-2 gap-3">
          <button onClick={() => setStatsModal("accounts")} className="navy-card p-4 text-left spring-tap">
            <div className="flex items-center gap-2 mb-2">
              <Users size={16} style={{ color: "hsl(43,85%,60%)" }} />
              <span className="text-white/50 text-xs">Total Accounts</span>
            </div>
            <div className="text-white font-bold text-2xl">{accounts.length}</div>
            <div className="text-white/30 text-xs mt-0.5">Tap to view all</div>
          </button>

          <button onClick={() => setStatsModal("balance")} className="navy-card p-4 text-left spring-tap">
            <div className="flex items-center gap-2 mb-2">
              <DollarSign size={16} style={{ color: "hsl(43,85%,60%)" }} />
              <span className="text-white/50 text-xs">Total Balance</span>
            </div>
            <div className="text-white font-bold text-lg truncate">{formatCurrency(totalBalance, "USD")}</div>
            <div className="text-white/30 text-xs mt-0.5">Tap for breakdown</div>
          </button>

          <button onClick={() => setStatsModal("frozen")} className="rounded-2xl p-4 text-left spring-tap" style={{ background: "rgba(59,130,246,0.08)", border: "1px solid rgba(59,130,246,0.15)" }}>
            <div className="flex items-center gap-2 mb-2">
              <Snowflake size={16} color="#60a5fa" />
              <span className="text-blue-400/70 text-xs">Frozen</span>
            </div>
            <div className="text-blue-400 font-bold text-2xl">{frozenCount}</div>
            <div className="text-blue-400/40 text-xs mt-0.5">Tap to manage</div>
          </button>

          <button onClick={() => setStatsModal("closed")} className="rounded-2xl p-4 text-left spring-tap" style={{ background: "rgba(239,68,68,0.08)", border: "1px solid rgba(239,68,68,0.15)" }}>
            <div className="flex items-center gap-2 mb-2">
              <XCircle size={16} color="#f87171" />
              <span className="text-red-400/70 text-xs">Closed</span>
            </div>
            <div className="text-red-400 font-bold text-2xl">{closedCount}</div>
            <div className="text-red-400/40 text-xs mt-0.5">Tap to manage</div>
          </button>
        </div>

        {/* Actions */}
        <div className="grid grid-cols-3 gap-2">
          <button onClick={() => setShowCreate(true)} className="gold-btn py-3 text-xs font-semibold flex items-center justify-center gap-1.5">
            <Plus size={15} /> Create
          </button>
          <button onClick={() => { setDepositTarget(undefined); setShowDeposit(true); }}
            className="py-3 rounded-2xl text-xs font-semibold flex items-center justify-center gap-1.5 transition-all"
            style={{ background: "rgba(34,197,94,0.12)", border: "1px solid rgba(34,197,94,0.2)", color: "#22c55e" }}>
            <ArrowDownLeft size={15} /> Deposit
          </button>
          <button onClick={handleExportAccounts}
            className="py-3 rounded-2xl text-xs font-semibold flex items-center justify-center gap-1.5 transition-all"
            style={{ background: "rgba(255,255,255,0.07)", border: "1px solid rgba(255,255,255,0.1)", color: "rgba(255,255,255,0.6)" }}>
            <Download size={15} /> Export
          </button>
        </div>

        {/* Search */}
        <div className="relative">
          <Search size={16} className="absolute left-4 top-1/2 -translate-y-1/2 text-white/30" />
          <input className="dark-input pl-10" placeholder="Search accounts..." value={search} onChange={(e) => setSearch(e.target.value)} />
          {search && <button onClick={() => setSearch("")} className="absolute right-4 top-1/2 -translate-y-1/2 text-white/30"><X size={14} /></button>}
        </div>

        {/* Account count */}
        <div className="flex items-center justify-between">
          <h3 className="text-white font-bold text-base">{filteredAccounts.length} Account{filteredAccounts.length !== 1 ? "s" : ""} Created</h3>
          <button onClick={fetchAll} className="text-white/30 hover:text-white/60"><RefreshCw size={16} /></button>
        </div>

        {/* Transaction Filter Toggle */}
        {expandedAccount && (
          <div>
            <button onClick={() => setShowTxFilter(!showTxFilter)}
              className="flex items-center gap-2 text-xs font-medium px-3 py-2 rounded-xl transition-colors"
              style={{ background: showTxFilter ? "rgba(200,155,50,0.1)" : "rgba(255,255,255,0.06)", color: showTxFilter ? "hsl(43,85%,60%)" : "rgba(255,255,255,0.5)" }}>
              <Filter size={13} /> Transaction Filter
            </button>
            {showTxFilter && (
              <div className="mt-2 p-3 rounded-2xl space-y-2" style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)" }}>
                <div className="grid grid-cols-3 gap-1.5">
                  {(["all", "deposit", "transfer"] as const).map(t => (
                    <button key={t} onClick={() => setTxFilterType(t)}
                      className="py-1.5 rounded-xl text-xs capitalize"
                      style={txFilterType === t ? { background: "hsl(43,85%,55%)", color: "#111" } : { background: "rgba(255,255,255,0.07)", color: "rgba(255,255,255,0.5)" }}>
                      {t}
                    </button>
                  ))}
                </div>
                <div>
                  <label className="text-white/40 text-xs mb-1 block">Month (YYYY-MM)</label>
                  <input type="month" className="dark-input py-2 text-xs" value={txFilterMonth} onChange={e => setTxFilterMonth(e.target.value)} />
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="text-white/40 text-xs mb-1 block">From Date</label>
                    <input type="date" className="dark-input py-2 text-xs" value={txFilterFrom} onChange={e => setTxFilterFrom(e.target.value)} />
                  </div>
                  <div>
                    <label className="text-white/40 text-xs mb-1 block">To Date</label>
                    <input type="date" className="dark-input py-2 text-xs" value={txFilterTo} onChange={e => setTxFilterTo(e.target.value)} />
                  </div>
                </div>
                <button onClick={() => { setTxFilterType("all"); setTxFilterFrom(""); setTxFilterTo(""); setTxFilterMonth(""); }}
                  className="text-xs text-white/40 hover:text-white/60">Clear filters</button>
              </div>
            )}
          </div>
        )}

        {/* Accounts List */}
        {filteredAccounts.length === 0 ? (
          <div className="text-center py-12 rounded-3xl" style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.06)" }}>
            <Users size={32} className="mx-auto mb-3 text-white/15" />
            <div className="text-white/30 text-sm">{search ? "No accounts match your search." : "No accounts yet. Create one to get started."}</div>
          </div>
        ) : (
          <div className="space-y-3">
            {filteredAccounts.map((acc) => {
              const accTxs = getFilteredTxs(acc.id);
              const isExpanded = expandedAccount === acc.id;
              const totalAccIn = accTxs.filter(t => t.type === "deposit" || t.type === "credit").reduce((s, t) => s + Number(t.amount), 0);
              const totalAccOut = accTxs.filter(t => t.type !== "deposit" && t.type !== "credit").reduce((s, t) => s + Number(t.amount), 0);

              return (
                <div key={acc.id} className="rounded-3xl overflow-hidden" style={{ background: "hsl(220,50%,14%)", border: "1px solid rgba(255,255,255,0.08)" }}>
                  <div className="p-4">
                    <div className="flex items-center gap-3">
                      {acc.profile_picture ? (
                        <img src={acc.profile_picture} alt="" className="w-12 h-12 rounded-full object-cover flex-shrink-0" style={{ border: "2px solid hsl(43,85%,55%)" }} />
                      ) : (
                        <div className="w-12 h-12 rounded-full flex items-center justify-center text-base font-bold flex-shrink-0" style={{ background: "hsl(220,50%,22%)", color: "hsl(43,85%,60%)" }}>
                          {getInitials(acc.account_name)}
                        </div>
                      )}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="text-white font-bold text-sm">{acc.account_name}</span>
                          {acc.is_frozen && <Snowflake size={13} color="#60a5fa" />}
                          {acc.is_closed && <XCircle size={13} color="#f87171" />}
                        </div>
                        <div className="text-white/40 text-xs font-mono">{acc.account_number}</div>
                        <div className="text-white/30 text-xs">{acc.account_type}</div>
                      </div>
                      <div className="text-right flex-shrink-0">
                        <div className="text-white font-bold">{formatCurrency(acc.balance, acc.currency)}</div>
                        <div className="text-white/30 text-xs">{acc.currency}</div>
                      </div>
                    </div>

                    {/* Status badges */}
                    {(acc.is_frozen || acc.is_closed) && (
                      <div className="flex gap-2 mt-2">
                        {acc.is_frozen && <span className="text-blue-400 text-xs px-2 py-0.5 rounded-full" style={{ background: "rgba(59,130,246,0.15)" }}>❄️ Frozen</span>}
                        {acc.is_closed && <span className="text-red-400 text-xs px-2 py-0.5 rounded-full" style={{ background: "rgba(239,68,68,0.15)" }}>✗ Closed</span>}
                      </div>
                    )}

                    {/* Actions */}
                    <div className="flex gap-2 mt-3 flex-wrap">
                      <button onClick={() => setEditAccount(acc)} className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-medium" style={{ background: "rgba(255,255,255,0.06)", color: "rgba(255,255,255,0.7)" }}>
                        <Edit2 size={12} /> Edit
                      </button>
                      <button onClick={() => { setDepositTarget(acc); setShowDeposit(true); }} className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-medium" style={{ background: "rgba(34,197,94,0.1)", color: "#22c55e" }}>
                        <ArrowDownLeft size={12} /> Deposit
                      </button>
                      <button onClick={() => handleToggleFreeze(acc)} className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-medium" style={{ background: acc.is_frozen ? "rgba(59,130,246,0.15)" : "rgba(255,255,255,0.06)", color: acc.is_frozen ? "#60a5fa" : "rgba(255,255,255,0.5)" }}>
                        <Snowflake size={12} /> {acc.is_frozen ? "Unfreeze" : "Freeze"}
                      </button>
                      <button onClick={() => handleToggleClose(acc)} className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-medium" style={{ background: acc.is_closed ? "rgba(239,68,68,0.15)" : "rgba(255,255,255,0.06)", color: acc.is_closed ? "#f87171" : "rgba(255,255,255,0.5)" }}>
                        <XCircle size={12} /> {acc.is_closed ? "Reopen" : "Close"}
                      </button>
                      <button onClick={() => setExpandedAccount(isExpanded ? null : acc.id)} className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-medium" style={{ background: "rgba(255,255,255,0.06)", color: "rgba(255,255,255,0.7)" }}>
                        Txns <ChevronRight size={12} style={{ transform: isExpanded ? "rotate(90deg)" : "none", transition: "0.2s" }} />
                      </button>
                    </div>

                    <div className="mt-2 pt-2" style={{ borderTop: "1px solid rgba(255,255,255,0.05)" }}>
                      <div className="text-white/30 text-xs">Login: <span className="text-white/50">{acc.login_email}</span></div>
                      {acc.transfer_pin && <div className="text-white/30 text-xs">Transfer PIN: <span className="text-yellow-400/60">••••</span></div>}
                    </div>
                  </div>

                  {/* Transactions */}
                  {isExpanded && (
                    <div style={{ borderTop: "1px solid rgba(255,255,255,0.06)" }}>
                      <div className="px-4 py-2 flex items-center justify-between">
                        <span className="text-white/50 text-xs font-semibold">{accTxs.length} Transactions</span>
                        <div className="flex gap-3">
                          <span className="text-green-400 text-xs">+{formatCurrency(totalAccIn, acc.currency)}</span>
                          <span className="text-red-400 text-xs">-{formatCurrency(totalAccOut, acc.currency)}</span>
                        </div>
                      </div>
                      {accTxs.length === 0 ? (
                        <div className="text-center py-4 text-white/25 text-xs">No transactions match the current filter</div>
                      ) : (
                        <div className="px-3 pb-3 space-y-1.5">
                          {accTxs.slice(0, 15).map((tx) => {
                            const isIn = tx.type === "deposit" || tx.type === "credit";
                            return (
                              <div key={tx.id} className="flex items-center gap-2 p-2 rounded-xl" style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.05)" }}>
                                <div className="w-7 h-7 rounded-xl flex items-center justify-center flex-shrink-0" style={{ background: isIn ? "rgba(34,197,94,0.12)" : "rgba(239,68,68,0.12)" }}>
                                  {isIn ? <ArrowDownLeft size={13} color="#22c55e" /> : <ArrowUpRight size={13} color="#ef4444" />}
                                </div>
                                <div className="flex-1 min-w-0">
                                  <div className="text-white text-xs font-medium truncate">
                                    {tx.recipient_name || (isIn ? "Deposit" : "Transfer")}
                                    {tx.admin_override && <span className="text-yellow-400/60 text-xs ml-1">[admin]</span>}
                                  </div>
                                  <div className="text-white/30 text-xs">{formatDateTime(tx.custom_timestamp)}</div>
                                </div>
                                <div className="flex items-center gap-2 flex-shrink-0">
                                  <span className="font-bold text-xs" style={{ color: isIn ? "#22c55e" : "#ef4444" }}>
                                    {isIn ? "+" : "-"}{formatCurrency(tx.amount, acc.currency)}
                                  </span>
                                  <button onClick={() => setSelectedTx(tx)} className="text-white/30 hover:text-white/60"><Eye size={13} /></button>
                                  <button onClick={() => setEditTx(tx)} className="text-white/30 hover:text-yellow-400"><Edit2 size={13} /></button>
                                </div>
                              </div>
                            );
                          })}
                          {accTxs.length > 15 && <div className="text-center text-white/25 text-xs py-1">+{accTxs.length - 15} more</div>}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>

      {showCreate && <CreateAccountModal onClose={() => setShowCreate(false)} onSuccess={fetchAll} />}
      {editAccount && <EditAccountModal account={editAccount} onClose={() => setEditAccount(null)} onSuccess={fetchAll} onDelete={() => handleDeleteAccount(editAccount.id)} />}
      {showDeposit && <AdminDepositModal accounts={accounts} selectedAccount={depositTarget} onClose={() => { setShowDeposit(false); setDepositTarget(undefined); }} onSuccess={fetchAll} />}
      {selectedTx && (
        <TransactionReceiptModal
          tx={{ ...selectedTx, account_name: accounts.find(a => a.id === selectedTx.account_id)?.account_name, currency: accounts.find(a => a.id === selectedTx.account_id)?.currency }}
          onClose={() => setSelectedTx(null)}
        />
      )}
      {editTx && <EditTransactionModal tx={editTx} onClose={() => setEditTx(null)} onSuccess={fetchAll} />}

      <AdminBottomNav active={activeTab} onHome={() => setActiveTab("home")} onNotifications={() => setActiveTab("notifications")} onMessages={() => setActiveTab("messages")} notifCount={unreadNotifs} msgCount={msgCount} />
    </div>
  );
}
