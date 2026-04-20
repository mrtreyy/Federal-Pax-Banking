import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase, type Account, type Transaction, type BankingNotification, trackLogin, trackFeatureUse } from "@/lib/supabase";
import { formatCurrency, formatDateTime, getInitials, downloadAsCSV, printReceipt } from "@/lib/utils";
import { usePolling } from "@/hooks/usePolling";
import UserBottomNav from "@/components/features/UserBottomNav";
import TransactionReceiptModal from "@/components/features/TransactionReceiptModal";
import TransferModal from "@/components/features/TransferModal";
import DepositInfoModal from "@/components/features/DepositInfoModal";
import UserProfileModal from "@/components/features/UserProfileModal";
import TotalInOutModal from "@/components/features/TotalInOutModal";
import GHOBChatSupport from "@/components/features/GHOBChatSupport";
import VirtualCardPage from "@/components/features/VirtualCardPage";
import CurrencyConverterWidget from "@/components/features/CurrencyConverterWidget";
import UserNotifications from "@/components/features/UserNotifications";
import TierUpgradeSection from "@/components/features/TierUpgradeSection";
import SavingsGoalsPage from "@/components/features/SavingsGoalsPage";
import BillPaymentPage from "@/components/features/BillPaymentPage";
import BeneficiaryManager from "@/components/features/BeneficiaryManager";
import StatementRequestPage from "@/components/features/StatementRequestPage";
import ChequeBookPage from "@/components/features/ChequeBookPage";
import LoanApplicationPage from "@/components/features/LoanApplicationPage";
import {
  ArrowDownLeft, ArrowUpRight, Eye, EyeOff, Snowflake, XCircle,
  Phone, ChevronRight, Bell, Search, Filter, X, Download, FileText, CreditCard,
  Star, TrendingUp, Shield, Target, Zap, Users, BookOpen
} from "lucide-react";
import bankLogo from "@/assets/bankunited-logo.jpg";

const TIER_NAMES: Record<number, string> = {
  1: "Standard", 2: "Silver", 3: "Gold", 4: "Platinum", 5: "Elite"
};
const TIER_COLORS: Record<number, string> = {
  1: "rgba(255,255,255,0.4)", 2: "#94a3b8", 3: "#c89b3c", 4: "#60a5fa", 5: "#a855f7"
};

export default function UserDashboard() {
  const navigate = useNavigate();
  const [account, setAccount] = useState<Account | null>(null);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [notifications, setNotifications] = useState<BankingNotification[]>([]);
  const [unreadMsgs, setUnreadMsgs] = useState(0);
  const [showBalance, setShowBalance] = useState(true);
  const [activeTab, setActiveTab] = useState<"home" | "notifications" | "chat">("home");
  const [selectedTx, setSelectedTx] = useState<Transaction | null>(null);
  const [showTransfer, setShowTransfer] = useState(false);
  const [showDeposit, setShowDeposit] = useState(false);
  const [showProfile, setShowProfile] = useState(false);
  const [showTotalIn, setShowTotalIn] = useState(false);
  const [showTotalOut, setShowTotalOut] = useState(false);
  const [showConverter, setShowConverter] = useState(false);
  const [reportTx, setReportTx] = useState<Transaction | null>(null);
  const [showVirtualCard, setShowVirtualCard] = useState(false);
  const [showTierUpgrade, setShowTierUpgrade] = useState(false);
  const [showSavingsGoals, setShowSavingsGoals] = useState(false);
  const [showBillPayment, setShowBillPayment] = useState(false);
  const [showBeneficiaries, setShowBeneficiaries] = useState(false);
  const [showStatementRequest, setShowStatementRequest] = useState(false);
  const [showChequeBook, setShowChequeBook] = useState(false);
  const [showLoanApplication, setShowLoanApplication] = useState(false);
  const [activeCurrency, setActiveCurrency] = useState("");
  const [showCurrencySwitcher, setShowCurrencySwitcher] = useState(false);
  const [enabledCurrencies, setEnabledCurrencies] = useState<string[]>([]);
  const [exchangeRates, setExchangeRates] = useState<Record<string, number>>({});
  const [txSearch, setTxSearch] = useState("");
  const [txFilterFrom, setTxFilterFrom] = useState("");
  const [txFilterTo, setTxFilterTo] = useState("");
  const [txFilterType, setTxFilterType] = useState<"all" | "deposit" | "transfer">("all");
  const [showTxFilter, setShowTxFilter] = useState(false);
  const [showStatement, setShowStatement] = useState(false);
  const [statementMonth, setStatementMonth] = useState(new Date().toISOString().slice(0, 7));

  useEffect(() => {
    const raw = localStorage.getItem("ghob_user_session");
    if (!raw) { navigate("/"); return; }
    const session = JSON.parse(raw);
    setAccount(session);
    const hidden = localStorage.getItem(`ghob_balance_hidden_${session.id}`);
    if (hidden === "true") setShowBalance(false);
    fetchAccount(session.id);
    fetchTransactions(session.id);
    fetchNotifications(session.id);
    trackLogin(session.account_name, "individual_directive_user", session.id);
    // Load exchange rates
    fetch("https://api.exchangerate-api.com/v4/latest/USD").then(r => r.json()).then(d => { if (d.rates) setExchangeRates(d.rates); }).catch(() => {
      setExchangeRates({ EUR: 0.92, GBP: 0.79, JPY: 149.5, AUD: 1.53, CAD: 1.36, CHF: 0.88, CNY: 7.24, NGN: 1580, ZAR: 18.6, INR: 83.4, BRL: 4.97, MXN: 17.2, AED: 3.67, SAR: 3.75 });
    });
    supabase.from("banking_accounts").update({ last_login_at: new Date().toISOString(), last_login_device: navigator.userAgent.slice(0, 100), updated_at: new Date().toISOString() }).eq("id", session.id);
  }, [navigate]);

  const toggleBalance = () => {
    const newVal = !showBalance;
    setShowBalance(newVal);
    if (account) localStorage.setItem(`ghob_balance_hidden_${account.id}`, String(!newVal));
  };

  const fetchAccount = async (id: string) => {
    const { data } = await supabase.from("banking_accounts").select("*").eq("id", id).single();
    if (data) {
      setAccount(data);
      localStorage.setItem("ghob_user_session", JSON.stringify(data));
      // Load enabled currencies from DB
      const dbCurrencies = (data as Record<string, unknown>).enabled_currencies as string[] | null;
      const currencies = dbCurrencies && dbCurrencies.length > 0 ? dbCurrencies : [data.currency || "USD"];
      setEnabledCurrencies(currencies);
      // Set active currency to account base currency if not already set
      setActiveCurrency(prev => prev && currencies.includes(prev) ? prev : data.currency || "USD");
    }
  };
  const fetchTransactions = async (id: string) => {
    const { data } = await supabase.from("banking_transactions").select("*").eq("account_id", id).order("custom_timestamp", { ascending: false });
    if (data) setTransactions(data);
  };
  const fetchNotifications = async (id: string) => {
    const { data } = await supabase.from("banking_notifications").select("*").or(`account_id.eq.${id},target.eq.${id}`).order("created_at", { ascending: false });
    if (data) setNotifications(data);
  };
  const fetchUnreadMsgs = async (id: string) => {
    const { data } = await supabase.from("banking_messages").select("id").eq("account_id", id).eq("sender", "admin").eq("is_seen", false);
    setUnreadMsgs(data?.length || 0);
  };

  usePolling(() => {
    if (account?.id) {
      fetchAccount(account.id);
      fetchTransactions(account.id);
      fetchNotifications(account.id);
      fetchUnreadMsgs(account.id);
    }
  }, 5000, !!account);

  if (!account) return (
    <div className="min-h-screen flex items-center justify-center" style={{ background: "hsl(220,45%,8%)" }}>
      <div className="w-8 h-8 border-2 border-yellow-500/30 border-t-yellow-500 rounded-full animate-spin" />
    </div>
  );

  // Feature page routes
  if (showTierUpgrade) return <TierUpgradeSection account={account} onBack={() => setShowTierUpgrade(false)} />;
  if (showVirtualCard) return <VirtualCardPage account={account} onBack={() => setShowVirtualCard(false)} />;
  if (showSavingsGoals) return <SavingsGoalsPage account={account} onBack={() => setShowSavingsGoals(false)} />;
  if (showBillPayment) return <BillPaymentPage account={account} onBack={() => setShowBillPayment(false)} />;
  if (showBeneficiaries) return <BeneficiaryManager account={account} onBack={() => setShowBeneficiaries(false)} />;
  if (showStatementRequest) return <StatementRequestPage account={account} onBack={() => setShowStatementRequest(false)} />;
  if (showChequeBook) return <ChequeBookPage account={account} onBack={() => setShowChequeBook(false)} />;
  if (showLoanApplication) return <LoanApplicationPage account={account} onBack={() => setShowLoanApplication(false)} />;

  if (activeTab === "chat") return <GHOBChatSupport account={account} onClose={() => setActiveTab("home")} initialMessage={reportTx ? `Reporting transaction: ${reportTx.transaction_id}` : undefined} />;
  if (activeTab === "notifications") return <UserNotifications notifications={notifications} accountId={account.id} onClose={() => setActiveTab("home")} onRefresh={() => fetchNotifications(account.id)} />;

  const filteredTxs = transactions.filter(tx => {
    if (txSearch && !((tx.recipient_name || "").toLowerCase().includes(txSearch.toLowerCase()) || tx.transaction_id.toLowerCase().includes(txSearch.toLowerCase()) || (tx.description || "").toLowerCase().includes(txSearch.toLowerCase()))) return false;
    if (txFilterType !== "all") {
      const isIn = tx.type === "deposit" || tx.type === "credit";
      if (txFilterType === "deposit" && !isIn) return false;
      if (txFilterType === "transfer" && isIn) return false;
    }
    if (txFilterFrom && new Date(tx.custom_timestamp) < new Date(txFilterFrom)) return false;
    if (txFilterTo && new Date(tx.custom_timestamp) > new Date(txFilterTo + "T23:59:59")) return false;
    return true;
  });

  const totalIn = transactions.filter(t => t.type === "deposit" || t.type === "credit").reduce((s, t) => s + Number(t.amount), 0);
  const totalOut = transactions.filter(t => t.type !== "deposit" && t.type !== "credit").reduce((s, t) => s + Number(t.amount), 0);
  const unreadNotifs = notifications.filter(n => !n.is_read).length;
  const isFrozen = account.is_frozen;
  const isClosed = account.is_closed;
  const isInactive = account.is_inactive;
  const restricted = isFrozen || isClosed || isInactive;
  const tier = account.account_tier || 1;
  const tierName = TIER_NAMES[tier] || "Standard";
  const tierColor = TIER_COLORS[tier] || "rgba(255,255,255,0.4)";

  const statementTxs = transactions.filter(tx => tx.custom_timestamp.slice(0, 7) === statementMonth);
  const handleExportStatement = () => {
    let runningBalance = 0;
    const rows = [
      ["Date", "Description", "Type", "Amount", "Running Balance"],
      ...statementTxs.map(tx => {
        const isIn = tx.type === "deposit" || tx.type === "credit";
        runningBalance += isIn ? Number(tx.amount) : -Number(tx.amount);
        return [formatDateTime(tx.custom_timestamp), tx.description || tx.recipient_name || tx.type, tx.type, (isIn ? "+" : "-") + String(tx.amount), String(runningBalance.toFixed(2))];
      }),
    ];
    downloadAsCSV(rows, `${account.account_name}-statement-${statementMonth}`);
  };

  // Quick access items
  const QUICK_ACCESS = [
    { icon: <CreditCard size={18} />, label: "Virtual Card", onClick: () => { setShowVirtualCard(true); trackFeatureUse(account.account_name, account.id, "virtual_card"); } },
    { icon: <TrendingUp size={18} />, label: "FX Rates", onClick: () => { setShowConverter(!showConverter); trackFeatureUse(account.account_name, account.id, "currency_converter"); } },
    { icon: <Target size={18} />, label: "Savings", onClick: () => { setShowSavingsGoals(true); trackFeatureUse(account.account_name, account.id, "savings_goals"); } },
    { icon: <TrendingUp size={18} />, label: "Loans", onClick: () => { setShowLoanApplication(true); trackFeatureUse(account.account_name, account.id, "loans"); } },
    { icon: <Zap size={18} />, label: "Bill Pay", onClick: () => { setShowBillPayment(true); trackFeatureUse(account.account_name, account.id, "bill_payment"); } },
    { icon: <Users size={18} />, label: "Saved", onClick: () => { setShowBeneficiaries(true); trackFeatureUse(account.account_name, account.id, "beneficiaries"); } },
    { icon: <BookOpen size={18} />, label: "Cheque", onClick: () => { setShowChequeBook(true); trackFeatureUse(account.account_name, account.id, "cheque_book"); } },
    { icon: <FileText size={18} />, label: "Statement", onClick: () => { setShowStatementRequest(true); trackFeatureUse(account.account_name, account.id, "statement_request"); } },
    { icon: <Download size={18} />, label: "Export CSV", onClick: () => { setShowStatement(!showStatement); trackFeatureUse(account.account_name, account.id, "account_statement"); } },
  ];

  return (
    <div className="min-h-screen pb-24" style={{ background: "hsl(220,45%,8%)" }}>
      {/* Header */}
      <div className="sticky top-0 z-30 flex items-center justify-between px-5 pt-12 pb-4" style={{ background: "hsl(220,55%,12%)", borderBottom: "1px solid rgba(255,255,255,0.06)" }}>
        <div className="flex items-center gap-3">
          <img src={bankLogo} alt="BankUnited" className="w-9 h-9 rounded-xl bg-white p-0.5" />
          <div>
            <div className="text-white/50 text-xs">BankUnited</div>
            <div className="text-white font-bold text-sm leading-tight">Secure Banking</div>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <button onClick={() => { setShowConverter(!showConverter); if (account) trackFeatureUse(account.account_name, account.id, "currency_converter"); }}
            className="text-xs font-bold" style={{ color: showConverter ? "hsl(43,85%,60%)" : "rgba(255,255,255,0.4)" }}>FX</button>
          <button onClick={() => setActiveTab("notifications")} className="relative">
            <Bell size={22} style={{ color: unreadNotifs > 0 ? "hsl(43,85%,60%)" : "rgba(255,255,255,0.5)" }} />
            {unreadNotifs > 0 && <span className="absolute -top-1 -right-1 bg-red-500 text-white text-xs rounded-full w-4 h-4 flex items-center justify-center font-bold" style={{ fontSize: 9 }}>{unreadNotifs > 9 ? "9+" : unreadNotifs}</span>}
          </button>
          <button onClick={() => setShowProfile(true)}>
            {account.profile_picture ? (
              <img src={account.profile_picture} alt="" className="w-9 h-9 rounded-full object-cover" style={{ border: "2px solid hsl(43,85%,55%)" }} />
            ) : (
              <div className="w-9 h-9 rounded-full flex items-center justify-center text-sm font-bold" style={{ background: "hsl(220,50%,22%)", color: "hsl(43,85%,60%)", border: "2px solid hsl(43,85%,55%)" }}>
                {getInitials(account.account_name)}
              </div>
            )}
          </button>
        </div>
      </div>

      <div className="px-4 pt-5 space-y-4">
        {showConverter && <CurrencyConverterWidget defaultFrom={account.currency} />}

        {/* Status Banners */}
        {isClosed && (
          <div className="closed-overlay p-4 rounded-3xl text-center">
            <XCircle size={28} color="#f87171" className="mx-auto mb-2" />
            <div className="text-red-400 font-bold text-sm">Account Closed</div>
            <div className="text-red-300/70 text-xs mt-1 leading-relaxed">This account has been permanently closed. All financial services are suspended. Reference: {account.account_number}</div>
            <button onClick={() => setActiveTab("chat")} className="mt-3 inline-flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-medium" style={{ background: "rgba(239,68,68,0.15)", color: "#f87171" }}>
              <Phone size={12} /> Contact Administration
            </button>
          </div>
        )}
        {isInactive && !isFrozen && !isClosed && (
          <div className="p-4 rounded-3xl text-center" style={{ background: "rgba(251,146,60,0.08)", border: "1px solid rgba(251,146,60,0.2)" }}>
            <div className="text-orange-400 font-bold text-sm">Account Inactive</div>
            <div className="text-orange-300/70 text-xs mt-1 leading-relaxed">Your account has been set to inactive. Contact Administration to reactivate.</div>
            <button onClick={() => setActiveTab("chat")} className="mt-3 inline-flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-medium" style={{ background: "rgba(251,146,60,0.15)", color: "#fb923c" }}>Contact Administration</button>
          </div>
        )}
        {isFrozen && !isClosed && (
          <div className="frozen-overlay p-4 rounded-3xl text-center">
            <Snowflake size={28} color="#60a5fa" className="mx-auto mb-2" />
            <div className="text-blue-400 font-bold text-sm">Account Frozen for Policy Violation</div>
            <div className="text-blue-300/70 text-xs mt-1 leading-relaxed">Your account has been temporarily suspended. Contact Administration for dismissal.</div>
            <button onClick={() => setActiveTab("chat")} className="mt-3 inline-flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-medium" style={{ background: "rgba(96,165,250,0.15)", color: "#60a5fa" }}>
              <Phone size={12} /> Contact Administration
            </button>
          </div>
        )}

        {account.custom_banner && <img src={account.custom_banner} alt="" className="w-full rounded-2xl object-cover" style={{ maxHeight: 80 }} />}

        {/* Balance Card */}
        <div className="rounded-3xl p-5 relative overflow-hidden" style={{ background: "linear-gradient(135deg, hsl(220,60%,18%) 0%, hsl(220,70%,12%) 100%)", border: "1px solid rgba(255,255,255,0.1)" }}>
          <div className="absolute top-0 right-0 w-32 h-32 rounded-full opacity-10" style={{ background: "hsl(43,85%,60%)", transform: "translate(30%,-30%)" }} />
          <div className="flex items-start justify-between mb-1">
            <div>
              <div className="flex items-center gap-2 mb-0.5">
                <div className="text-white/50 text-xs">{account.account_type}</div>
                <span className="text-xs px-2 py-0.5 rounded-full font-semibold" style={{ background: `${tierColor}20`, color: tierColor, border: `1px solid ${tierColor}40` }}>
                  {tier === 5 ? "⭐ " : ""}{tierName}
                </span>
              </div>
              <div className="text-white font-bold text-lg leading-tight">{account.account_name}</div>
              <div className="text-white/40 text-xs mt-0.5 font-mono">{account.account_number}</div>
            </div>
            <button onClick={toggleBalance} className="text-white/50 hover:text-white transition-colors">
              {showBalance ? <Eye size={18} /> : <EyeOff size={18} />}
            </button>
          </div>
          <div className="mt-3">
            <div className="text-white/40 text-xs mb-1">Available Balance</div>
            <div className="text-white font-bold" style={{ fontSize: "clamp(1.6rem, 6vw, 2.5rem)" }}>
              {showBalance ? (() => {
                const cur = activeCurrency || account.currency;
                if (cur === account.currency) return formatCurrency(account.balance, cur);
                const rate = exchangeRates[cur];
                if (!rate) return formatCurrency(account.balance, account.currency);
                const converted = Number(account.balance) * rate;
                return formatCurrency(converted, cur);
              })() : "•••••••"}
            </div>
            {/* Currency Switcher */}
            <div className="relative mt-1.5">
              <button
                onClick={() => enabledCurrencies.length > 1 && setShowCurrencySwitcher(!showCurrencySwitcher)}
                className={`flex items-center gap-1.5 text-xs font-semibold px-2.5 py-1 rounded-xl transition-colors ${enabledCurrencies.length > 1 ? "cursor-pointer" : "cursor-default"}`}
                style={{ background: "rgba(200,155,50,0.1)", border: "1px solid rgba(200,155,50,0.25)", color: "hsl(43,85%,60%)" }}
              >
                <span>{activeCurrency || account.currency}</span>
                {enabledCurrencies.length > 1 && <span style={{ fontSize: 9 }}>▼</span>}
                {(activeCurrency && activeCurrency !== account.currency) && (
                  <span className="text-white/40 font-normal">· Tier {tier} Account · BankUnited</span>
                )}
              </button>
              {showCurrencySwitcher && enabledCurrencies.length > 1 && (
                <div className="absolute top-full left-0 z-50 mt-1 rounded-2xl overflow-hidden shadow-2xl" style={{ background: "hsl(220,55%,14%)", border: "1px solid rgba(255,255,255,0.12)", minWidth: 160 }}>
                  {enabledCurrencies.map(cur => (
                    <button
                      key={cur}
                      onClick={() => { setActiveCurrency(cur); setShowCurrencySwitcher(false); }}
                      className="w-full text-left px-4 py-2.5 text-xs hover:bg-white/5 transition-colors flex items-center justify-between"
                      style={{ borderBottom: "1px solid rgba(255,255,255,0.05)", color: cur === activeCurrency ? "hsl(43,85%,60%)" : "rgba(255,255,255,0.7)" }}
                    >
                      <span className="font-semibold">{cur}</span>
                      {cur !== account.currency && exchangeRates[cur] && (
                        <span className="text-white/30">×{exchangeRates[cur]?.toFixed(2)}</span>
                      )}
                      {cur === activeCurrency && <span style={{ fontSize: 9 }}>✓</span>}
                    </button>
                  ))}
                </div>
              )}
            </div>
            {(activeCurrency && activeCurrency !== account.currency) && (
              <div className="text-white/30 text-xs mt-0.5">{account.currency} base · converted to {activeCurrency} · Tier {tier} · BankUnited</div>
            )}
            {(!activeCurrency || activeCurrency === account.currency) && (
              <div className="text-white/30 text-xs mt-0.5">{account.currency} · Tier {tier} Account · BankUnited</div>
            )}
          </div>
        </div>

        {/* Action Buttons */}
        <div className="grid grid-cols-2 gap-3">
          <button onClick={() => { if (!restricted) { setShowDeposit(true); trackFeatureUse(account.account_name, account.id, "deposit_info"); }}} disabled={restricted}
            className="gold-btn py-3.5 text-sm font-semibold flex items-center justify-center gap-2" style={restricted ? { opacity: 0.4, cursor: "not-allowed" } : {}}>
            <ArrowDownLeft size={18} /> Deposit
          </button>
          <button onClick={() => { if (!restricted) { setShowTransfer(true); trackFeatureUse(account.account_name, account.id, "transfer"); }}} disabled={restricted}
            className="gold-btn py-3.5 text-sm font-semibold flex items-center justify-center gap-2" style={restricted ? { opacity: 0.4, cursor: "not-allowed" } : {}}>
            <ArrowUpRight size={18} /> Transfer
          </button>
        </div>

        {/* Quick Access Grid — 9 services */}
        <div className="grid grid-cols-3 gap-2">
          {QUICK_ACCESS.map(item => (
            <button key={item.label} onClick={item.onClick}
              className="flex flex-col items-center gap-1.5 py-3 rounded-2xl transition-colors"
              style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)" }}>
              <span style={{ color: "hsl(43,85%,60%)" }}>{item.icon}</span>
              <span className="text-white/60 text-xs font-medium">{item.label}</span>
            </button>
          ))}
        </div>

        {/* Tier Upgrade Button */}
        <button onClick={() => { setShowTierUpgrade(true); trackFeatureUse(account.account_name, account.id, "tier_upgrade"); }}
          className="w-full flex items-center gap-3 px-4 py-3 rounded-2xl text-left"
          style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.07)" }}>
          <div className="w-8 h-8 rounded-xl flex items-center justify-center flex-shrink-0" style={{ background: `${tierColor}15`, color: tierColor }}>
            <Star size={15} />
          </div>
          <div className="flex-1">
            <div className="text-white font-semibold text-sm">Account Tier — {tierName}</div>
            <div className="text-white/35 text-xs">Tier {tier} of 5 · Tap to view or request upgrade</div>
          </div>
          <ChevronRight size={14} className="text-white/20" />
        </button>

        {/* Total In / Out */}
        <div className="grid grid-cols-2 gap-3">
          <button onClick={() => { setShowTotalIn(true); trackFeatureUse(account.account_name, account.id, "total_in_view"); }}
            className="rounded-2xl p-4 text-left spring-tap" style={{ background: "rgba(34,197,94,0.08)", border: "1px solid rgba(34,197,94,0.2)" }}>
            <div className="flex items-center gap-1.5 mb-1"><ArrowDownLeft size={14} color="#22c55e" /><span className="text-green-400 text-xs font-medium">Total In</span></div>
            <div className="text-white font-bold text-lg leading-tight">{showBalance ? formatCurrency(totalIn, account.currency) : "••••"}</div>
          </button>
          <button onClick={() => { setShowTotalOut(true); trackFeatureUse(account.account_name, account.id, "total_out_view"); }}
            className="rounded-2xl p-4 text-left spring-tap" style={{ background: "rgba(239,68,68,0.08)", border: "1px solid rgba(239,68,68,0.2)" }}>
            <div className="flex items-center gap-1.5 mb-1"><ArrowUpRight size={14} color="#ef4444" /><span className="text-red-400 text-xs font-medium">Total Out</span></div>
            <div className="text-white font-bold text-lg leading-tight">{showBalance ? formatCurrency(totalOut, account.currency) : "••••"}</div>
          </button>
        </div>

        {/* CSV Statement Export */}
        {showStatement && (
          <div className="p-4 rounded-2xl space-y-2" style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)" }}>
            <div className="text-white/60 text-xs font-semibold">Monthly Account Statement Export</div>
            <input type="month" className="dark-input py-2 text-sm" value={statementMonth} onChange={e => setStatementMonth(e.target.value)} />
            <div className="text-white/30 text-xs">{statementTxs.length} transactions in {statementMonth}</div>
            <button onClick={handleExportStatement} className="gold-btn w-full py-2.5 text-xs font-semibold flex items-center justify-center gap-2">
              <Download size={13} /> Export as CSV
            </button>
          </div>
        )}

        {/* Transaction History */}
        <div>
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-white font-bold text-base">Transaction History</h3>
            <button onClick={() => setShowTxFilter(!showTxFilter)} className="flex items-center gap-1 px-2.5 py-1.5 rounded-xl text-xs"
              style={{ background: showTxFilter ? "rgba(200,155,50,0.1)" : "rgba(255,255,255,0.07)", color: showTxFilter ? "hsl(43,85%,60%)" : "rgba(255,255,255,0.5)" }}>
              <Filter size={12} /> Filter
            </button>
          </div>

          {showTxFilter && (
            <div className="mb-3 p-3 rounded-2xl space-y-2" style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)" }}>
              <div className="relative">
                <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-white/30" />
                <input className="dark-input pl-8 py-2 text-xs" placeholder="Search transactions..." value={txSearch} onChange={e => setTxSearch(e.target.value)} />
              </div>
              <div className="grid grid-cols-3 gap-1.5">
                {(["all", "deposit", "transfer"] as const).map(t => (
                  <button key={t} onClick={() => setTxFilterType(t)} className="py-1.5 rounded-xl text-xs capitalize"
                    style={txFilterType === t ? { background: "hsl(43,85%,55%)", color: "#111" } : { background: "rgba(255,255,255,0.07)", color: "rgba(255,255,255,0.5)" }}>
                    {t}
                  </button>
                ))}
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="text-white/40 text-xs mb-1 block">From</label>
                  <input type="date" className="dark-input py-2 text-xs" value={txFilterFrom} onChange={e => setTxFilterFrom(e.target.value)} />
                </div>
                <div>
                  <label className="text-white/40 text-xs mb-1 block">To</label>
                  <input type="date" className="dark-input py-2 text-xs" value={txFilterTo} onChange={e => setTxFilterTo(e.target.value)} />
                </div>
              </div>
              <button onClick={() => { setTxSearch(""); setTxFilterType("all"); setTxFilterFrom(""); setTxFilterTo(""); }} className="text-xs text-white/40 hover:text-white/60">Clear filters</button>
            </div>
          )}

          <div className="text-white/30 text-xs mb-2">{filteredTxs.length} of {transactions.length} transactions</div>

          {filteredTxs.length === 0 ? (
            <div className="text-center py-10 rounded-3xl" style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.06)" }}>
              <div className="text-white/20 text-sm">No transactions found</div>
            </div>
          ) : (
            <div className="space-y-2">
              {filteredTxs.map((tx) => {
                const isIn = tx.type === "deposit" || tx.type === "credit";
                return (
                  <button key={tx.id} onClick={() => { setSelectedTx(tx); trackFeatureUse(account.account_name, account.id, "transaction_detail"); }}
                    className="w-full flex items-center gap-3 p-4 rounded-2xl text-left spring-tap hover:bg-white/5 transition-colors"
                    style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.06)" }}>
                    <div className="w-10 h-10 rounded-2xl flex items-center justify-center flex-shrink-0" style={{ background: isIn ? "rgba(34,197,94,0.12)" : "rgba(239,68,68,0.12)" }}>
                      {isIn ? <ArrowDownLeft size={18} color="#22c55e" /> : <ArrowUpRight size={18} color="#ef4444" />}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="text-white text-sm font-medium truncate">{tx.recipient_name || (isIn ? "Deposit Received" : "Transfer Sent")}</div>
                      <div className="text-white/40 text-xs">{formatDateTime(tx.custom_timestamp)}</div>
                      {tx.description && <div className="text-white/30 text-xs truncate">{tx.description}</div>}
                    </div>
                    <div className="flex items-center gap-1.5 flex-shrink-0">
                      <span className="font-bold text-sm" style={{ color: isIn ? "#22c55e" : "#ef4444" }}>
                        {isIn ? "+" : "-"}{formatCurrency(tx.amount, account.currency)}
                      </span>
                      <ChevronRight size={14} className="text-white/25" />
                    </div>
                  </button>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {selectedTx && (
        <TransactionReceiptModal
          tx={{ ...selectedTx, account_name: account.account_name, currency: account.currency }}
          onClose={() => setSelectedTx(null)}
          showReport
          onReport={() => { setReportTx(selectedTx); setSelectedTx(null); setActiveTab("chat"); }}
        />
      )}
      {showTransfer && <TransferModal account={account} onClose={() => setShowTransfer(false)} onSuccess={() => { fetchAccount(account.id); fetchTransactions(account.id); }} />}
      {showDeposit && <DepositInfoModal account={account} onClose={() => setShowDeposit(false)} />}
      {showProfile && <UserProfileModal account={account} onClose={() => setShowProfile(false)} />}
      {showTotalIn && (
        <TotalInOutModal type="in" transactions={transactions} currency={account.currency} accountName={account.account_name}
          onClose={() => setShowTotalIn(false)} onReportTx={(tx) => { setReportTx(tx); setShowTotalIn(false); setActiveTab("chat"); }} />
      )}
      {showTotalOut && (
        <TotalInOutModal type="out" transactions={transactions} currency={account.currency} accountName={account.account_name}
          onClose={() => setShowTotalOut(false)} onReportTx={(tx) => { setReportTx(tx); setShowTotalOut(false); setActiveTab("chat"); }} />
      )}

      <UserBottomNav active={activeTab} onHome={() => setActiveTab("home")} onNotifications={() => setActiveTab("notifications")} onChat={() => setActiveTab("chat")} notifCount={unreadNotifs} chatCount={unreadMsgs} />
    </div>
  );
}
