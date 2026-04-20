import { useState, useEffect } from "react";
import { ArrowLeft, Globe, ToggleLeft, ToggleRight, Check, RefreshCw } from "lucide-react";
import { supabase, type Account, logAudit } from "@/lib/supabase";
import { toast } from "sonner";

interface Props {
  accounts: Account[];
  onClose: () => void;
}

const ALL_CURRENCIES = ["USD", "EUR", "GBP", "JPY", "AUD", "CAD", "CHF", "CNY", "NGN", "ZAR", "INR", "BRL", "MXN", "AED", "SAR"];
const CURRENCY_NAMES: Record<string, string> = {
  USD: "US Dollar", EUR: "Euro", GBP: "British Pound", JPY: "Japanese Yen",
  AUD: "Australian Dollar", CAD: "Canadian Dollar", CHF: "Swiss Franc",
  CNY: "Chinese Yuan", NGN: "Nigerian Naira", ZAR: "South African Rand",
  INR: "Indian Rupee", BRL: "Brazilian Real", MXN: "Mexican Peso",
  AED: "UAE Dirham", SAR: "Saudi Riyal",
};

export default function CASCurrencySettings({ accounts, onClose }: Props) {
  const [enabledCurrencies, setEnabledCurrencies] = useState<Set<string>>(new Set(ALL_CURRENCIES));
  const [selectedAccount, setSelectedAccount] = useState<string>("");
  const [accountCurrencies, setAccountCurrencies] = useState<Set<string>>(new Set(["USD"]));
  const [savingGlobal, setSavingGlobal] = useState(false);
  const [savingAccount, setSavingAccount] = useState(false);
  const [rates, setRates] = useState<Record<string, number>>({});
  const [ratesLoading, setRatesLoading] = useState(false);

  useEffect(() => {
    fetchRates();
    const interval = setInterval(fetchRates, 60000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    if (selectedAccount) {
      const acc = accounts.find(a => a.id === selectedAccount);
      // Load existing currencies from account or default to USD
      if (acc) {
        const stored = localStorage.getItem(`bku_currencies_${acc.id}`);
        if (stored) {
          setAccountCurrencies(new Set(JSON.parse(stored)));
        } else {
          setAccountCurrencies(new Set([acc.currency || "USD"]));
        }
      }
    }
  }, [selectedAccount, accounts]);

  const fetchRates = async () => {
    setRatesLoading(true);
    try {
      const res = await fetch("https://api.exchangerate-api.com/v4/latest/USD");
      const data = await res.json();
      if (data.rates) setRates(data.rates);
    } catch {
      // Fallback static rates
      setRates({ EUR: 0.92, GBP: 0.79, JPY: 149.5, AUD: 1.53, CAD: 1.36, CHF: 0.88, CNY: 7.24, NGN: 1580, ZAR: 18.6, INR: 83.4, BRL: 4.97, MXN: 17.2, AED: 3.67, SAR: 3.75 });
    }
    setRatesLoading(false);
  };

  const toggleGlobalCurrency = (currency: string) => {
    setEnabledCurrencies(prev => {
      const next = new Set(prev);
      if (next.has(currency)) next.delete(currency);
      else next.add(currency);
      return next;
    });
  };

  const toggleAccountCurrency = (currency: string) => {
    setAccountCurrencies(prev => {
      const next = new Set(prev);
      if (next.has(currency)) next.delete(currency);
      else next.add(currency);
      return next;
    });
  };

  const handleApplyToAll = async () => {
    setSavingGlobal(true);
    const currencyList = Array.from(enabledCurrencies);
    for (const acc of accounts) {
      localStorage.setItem(`bku_currencies_${acc.id}`, JSON.stringify(currencyList));
    }
    await logAudit("ceo_apply_currencies_all", undefined, "All Accounts", { currencies: currencyList }, "CEO", "cas");
    toast.success(`Applied ${currencyList.length} currencies to all ${accounts.length} accounts.`);
    setSavingGlobal(false);
  };

  const handleSaveAccountCurrencies = async () => {
    if (!selectedAccount) return;
    const acc = accounts.find(a => a.id === selectedAccount);
    if (!acc) return;
    setSavingAccount(true);
    const currencyList = Array.from(accountCurrencies);
    localStorage.setItem(`bku_currencies_${acc.id}`, JSON.stringify(currencyList));
    await logAudit("ceo_set_account_currencies", acc.id, acc.account_name, { currencies: currencyList }, "CEO", "cas");
    toast.success(`Currencies updated for ${acc.account_name}.`);
    setSavingAccount(false);
  };

  return (
    <div className="min-h-screen" style={{ background: "hsl(220,45%,8%)" }}>
      <div className="sticky top-0 z-30 flex items-center gap-3 px-5 pt-12 pb-4" style={{ background: "hsl(220,55%,12%)", borderBottom: "1px solid rgba(255,255,255,0.06)" }}>
        <button onClick={onClose} className="text-white/40 hover:text-white"><ArrowLeft size={20} /></button>
        <Globe size={18} style={{ color: "hsl(43,85%,60%)" }} />
        <div className="flex-1">
          <div className="text-white font-bold">IDA Currency Settings</div>
          <div className="text-white/40 text-xs">BankUnited CAS — Multi-Currency Control</div>
        </div>
        <button onClick={fetchRates} disabled={ratesLoading} className="text-white/40 hover:text-white">
          <RefreshCw size={16} className={ratesLoading ? "animate-spin" : ""} />
        </button>
      </div>

      <div className="px-4 pt-4 pb-8 space-y-5">
        {/* Live Rates Display */}
        {Object.keys(rates).length > 0 && (
          <div className="rounded-2xl p-4" style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)" }}>
            <div className="text-white/50 text-xs font-semibold uppercase tracking-wide mb-2">Live Exchange Rates (vs USD)</div>
            <div className="grid grid-cols-3 gap-1.5">
              {ALL_CURRENCIES.filter(c => c !== "USD" && rates[c]).map(c => (
                <div key={c} className="rounded-xl p-2 text-center" style={{ background: "rgba(255,255,255,0.04)" }}>
                  <div className="text-white/40 text-xs">{c}</div>
                  <div className="text-white font-semibold text-xs">{rates[c]?.toFixed(2)}</div>
                </div>
              ))}
            </div>
            <div className="text-white/25 text-xs mt-2 text-center">Auto-refreshes every 60 seconds</div>
          </div>
        )}

        {/* Global Currency Toggles */}
        <div>
          <div className="text-white/50 text-xs font-semibold uppercase tracking-wide mb-2">Platform-Wide Currencies</div>
          <div className="rounded-3xl overflow-hidden" style={{ background: "hsl(220,50%,13%)", border: "1px solid rgba(255,255,255,0.08)" }}>
            {ALL_CURRENCIES.map((cur, i) => (
              <div key={cur} className="flex items-center justify-between px-4 py-3" style={{ borderBottom: i < ALL_CURRENCIES.length - 1 ? "1px solid rgba(255,255,255,0.05)" : "none" }}>
                <div>
                  <div className="text-white font-medium text-sm">{cur}</div>
                  <div className="text-white/40 text-xs">{CURRENCY_NAMES[cur]}</div>
                </div>
                <button onClick={() => toggleGlobalCurrency(cur)}>
                  {enabledCurrencies.has(cur)
                    ? <ToggleRight size={28} style={{ color: "hsl(43,85%,60%)" }} />
                    : <ToggleLeft size={28} style={{ color: "rgba(255,255,255,0.2)" }} />}
                </button>
              </div>
            ))}
          </div>
          <button onClick={handleApplyToAll} disabled={savingGlobal} className="gold-btn w-full py-3 text-sm font-semibold mt-3 flex items-center justify-center gap-2">
            {savingGlobal ? <div className="w-4 h-4 border-2 border-gray-900/30 border-t-gray-900 rounded-full animate-spin" /> : <><Check size={14} /> Apply to All {accounts.length} Accounts</>}
          </button>
        </div>

        {/* Per-Account Currency Assignment */}
        <div>
          <div className="text-white/50 text-xs font-semibold uppercase tracking-wide mb-2">Per-Account Currency Assignment</div>
          <select className="dark-input text-sm mb-3" value={selectedAccount} onChange={e => setSelectedAccount(e.target.value)}>
            <option value="">Select an account...</option>
            {accounts.map(a => <option key={a.id} value={a.id}>{a.account_name} — {a.account_number} ({a.currency})</option>)}
          </select>
          {selectedAccount && (
            <div className="space-y-3">
              <div className="text-white/40 text-xs">Select currencies for this account:</div>
              <div className="rounded-2xl overflow-hidden" style={{ background: "hsl(220,50%,13%)", border: "1px solid rgba(255,255,255,0.08)" }}>
                {ALL_CURRENCIES.filter(c => enabledCurrencies.has(c)).map((cur, i, arr) => (
                  <div key={cur} className="flex items-center justify-between px-4 py-2.5" style={{ borderBottom: i < arr.length - 1 ? "1px solid rgba(255,255,255,0.05)" : "none" }}>
                    <div className="flex items-center gap-2">
                      <div className="text-white font-medium text-sm">{cur}</div>
                      <div className="text-white/40 text-xs">{CURRENCY_NAMES[cur]}</div>
                      {rates[cur] && <div className="text-white/25 text-xs">1 USD = {rates[cur]?.toFixed(2)} {cur}</div>}
                    </div>
                    <button onClick={() => toggleAccountCurrency(cur)}>
                      {accountCurrencies.has(cur)
                        ? <ToggleRight size={24} style={{ color: "hsl(43,85%,60%)" }} />
                        : <ToggleLeft size={24} style={{ color: "rgba(255,255,255,0.2)" }} />}
                    </button>
                  </div>
                ))}
              </div>
              <button onClick={handleSaveAccountCurrencies} disabled={savingAccount} className="gold-btn w-full py-3 text-sm font-semibold flex items-center justify-center gap-2">
                {savingAccount ? <div className="w-4 h-4 border-2 border-gray-900/30 border-t-gray-900 rounded-full animate-spin" /> : <><Check size={14} /> Save Account Currencies ({accountCurrencies.size} selected)</>}
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
