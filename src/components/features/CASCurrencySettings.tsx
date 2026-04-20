import { useState, useEffect, useCallback } from "react";
import { ArrowLeft, Globe, ToggleLeft, ToggleRight, Check, RefreshCw, Trash2 } from "lucide-react";
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
  // Global platform-wide enabled currencies — persisted in localStorage
  const [enabledGlobal, setEnabledGlobal] = useState<Set<string>>(() => {
    const stored = localStorage.getItem("bku_global_currencies");
    if (stored) {
      try { return new Set(JSON.parse(stored)); } catch { /* ignore */ }
    }
    return new Set(ALL_CURRENCIES);
  });

  const [selectedAccount, setSelectedAccount] = useState<string>("");
  // Per-account currencies — loaded from DB (enabled_currencies column)
  const [accountCurrencies, setAccountCurrencies] = useState<Set<string>>(new Set(["USD"]));
  const [originalAccountCurrencies, setOriginalAccountCurrencies] = useState<Set<string>>(new Set(["USD"]));
  const [savingGlobal, setSavingGlobal] = useState(false);
  const [savingAccount, setSavingAccount] = useState(false);
  const [rates, setRates] = useState<Record<string, number>>({});
  const [ratesLoading, setRatesLoading] = useState(false);
  const [ratesLastUpdated, setRatesLastUpdated] = useState<Date | null>(null);

  const fetchRates = useCallback(async () => {
    setRatesLoading(true);
    try {
      const res = await fetch("https://api.exchangerate-api.com/v4/latest/USD");
      const data = await res.json();
      if (data.rates) {
        setRates(data.rates);
        setRatesLastUpdated(new Date());
      }
    } catch {
      // Fallback static rates
      setRates({ USD: 1, EUR: 0.92, GBP: 0.79, JPY: 149.5, AUD: 1.53, CAD: 1.36, CHF: 0.88, CNY: 7.24, NGN: 1580, ZAR: 18.6, INR: 83.4, BRL: 4.97, MXN: 17.2, AED: 3.67, SAR: 3.75 });
      setRatesLastUpdated(new Date());
    }
    setRatesLoading(false);
  }, []);

  useEffect(() => {
    fetchRates();
    const interval = setInterval(fetchRates, 60000);
    return () => clearInterval(interval);
  }, [fetchRates]);

  // Load per-account currencies from DB when account selected
  useEffect(() => {
    if (!selectedAccount) return;
    const acc = accounts.find(a => a.id === selectedAccount);
    if (!acc) return;

    // Load from DB column enabled_currencies
    const dbCurrencies = (acc as Record<string, unknown>).enabled_currencies as string[] | null;
    if (dbCurrencies && dbCurrencies.length > 0) {
      const s = new Set(dbCurrencies);
      setAccountCurrencies(new Set(s));
      setOriginalAccountCurrencies(new Set(s));
    } else {
      // Default to account's base currency
      const s = new Set([acc.currency || "USD"]);
      setAccountCurrencies(new Set(s));
      setOriginalAccountCurrencies(new Set(s));
    }
  }, [selectedAccount, accounts]);

  // Persist global setting to localStorage whenever it changes
  useEffect(() => {
    localStorage.setItem("bku_global_currencies", JSON.stringify(Array.from(enabledGlobal)));
  }, [enabledGlobal]);

  const toggleGlobalCurrency = (currency: string) => {
    setEnabledGlobal(prev => {
      const next = new Set(prev);
      if (next.has(currency)) {
        next.delete(currency);
      } else {
        next.add(currency);
      }
      return next;
    });
  };

  const toggleAccountCurrency = (currency: string) => {
    setAccountCurrencies(prev => {
      const next = new Set(prev);
      if (next.has(currency)) {
        next.delete(currency);
      } else {
        next.add(currency);
      }
      return next;
    });
  };

  const handleApplyToAll = async () => {
    setSavingGlobal(true);
    const currencyList = Array.from(enabledGlobal);
    // Apply to all accounts in DB
    const errors: string[] = [];
    for (const acc of accounts) {
      const { error } = await supabase
        .from("banking_accounts")
        .update({ enabled_currencies: currencyList, updated_at: new Date().toISOString() })
        .eq("id", acc.id);
      if (error) errors.push(acc.account_name);
    }
    await logAudit("ceo_apply_currencies_all", undefined, "All Accounts", { currencies: currencyList, accountCount: accounts.length }, "CEO", "cas");
    if (errors.length > 0) {
      toast.error(`Failed to update ${errors.length} accounts.`);
    } else {
      toast.success(`Applied ${currencyList.length} currencies to all ${accounts.length} accounts.`);
    }
    setSavingGlobal(false);
  };

  const handleSaveAccountCurrencies = async () => {
    if (!selectedAccount) return;
    const acc = accounts.find(a => a.id === selectedAccount);
    if (!acc) return;
    setSavingAccount(true);
    const currencyList = Array.from(accountCurrencies);
    const prevList = Array.from(originalAccountCurrencies);
    const added = currencyList.filter(c => !prevList.includes(c));
    const removed = prevList.filter(c => !currencyList.includes(c));

    const { error } = await supabase
      .from("banking_accounts")
      .update({ enabled_currencies: currencyList, updated_at: new Date().toISOString() })
      .eq("id", acc.id);

    if (error) {
      toast.error("Failed to save currency settings.");
      setSavingAccount(false);
      return;
    }

    await logAudit("ceo_set_account_currencies", acc.id, acc.account_name, {
      currencies_added: added,
      currencies_removed: removed,
      final_currencies: currencyList,
    }, "CEO", "cas");

    setOriginalAccountCurrencies(new Set(accountCurrencies));
    toast.success(`Currencies updated for ${acc.account_name}: ${currencyList.join(", ")}`);
    setSavingAccount(false);
  };

  const handleRevokeCurrency = async (accId: string, currency: string) => {
    const acc = accounts.find(a => a.id === accId);
    if (!acc) return;
    const dbCurrencies = (acc as Record<string, unknown>).enabled_currencies as string[] | null;
    const current = dbCurrencies || [acc.currency];
    const updated = current.filter(c => c !== currency);
    if (updated.length === 0) {
      toast.error("Cannot remove all currencies. At least one must remain.");
      return;
    }
    await supabase.from("banking_accounts").update({ enabled_currencies: updated, updated_at: new Date().toISOString() }).eq("id", accId);
    await logAudit("ceo_revoke_currency", accId, acc.account_name, { currency_removed: currency, remaining: updated }, "CEO", "cas");
    toast.success(`${currency} revoked from ${acc.account_name}.`);
  };

  return (
    <div className="min-h-screen pb-8" style={{ background: "hsl(220,45%,8%)" }}>
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
        {/* Live Rates */}
        {Object.keys(rates).length > 0 && (
          <div className="rounded-2xl p-4" style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)" }}>
            <div className="flex items-center justify-between mb-2">
              <div className="text-white/50 text-xs font-semibold uppercase tracking-wide">Live Exchange Rates (vs USD)</div>
              {ratesLastUpdated && <div className="text-white/25 text-xs">Updated {ratesLastUpdated.toLocaleTimeString()}</div>}
            </div>
            <div className="grid grid-cols-3 gap-1.5">
              {ALL_CURRENCIES.filter(c => c !== "USD").map(c => (
                <div key={c} className="rounded-xl p-2 text-center" style={{ background: "rgba(255,255,255,0.04)" }}>
                  <div className="text-white/40 text-xs">{c}</div>
                  <div className="text-white font-semibold text-xs">{rates[c]?.toFixed(c === "JPY" || c === "NGN" ? 0 : 2) || "—"}</div>
                </div>
              ))}
            </div>
            <div className="text-white/25 text-xs mt-2 text-center">Auto-refreshes every 60 seconds</div>
          </div>
        )}

        {/* Global Platform Currencies */}
        <div>
          <div className="text-white/50 text-xs font-semibold uppercase tracking-wide mb-2">Platform-Wide Currencies</div>
          <div className="text-white/30 text-xs mb-3">Toggle currencies ON/OFF. State is saved immediately. Use "Apply to All" to push to every account.</div>
          <div className="rounded-3xl overflow-hidden" style={{ background: "hsl(220,50%,13%)", border: "1px solid rgba(255,255,255,0.08)" }}>
            {ALL_CURRENCIES.map((cur, i) => {
              const isOn = enabledGlobal.has(cur);
              return (
                <div key={cur} className="flex items-center justify-between px-4 py-3" style={{ borderBottom: i < ALL_CURRENCIES.length - 1 ? "1px solid rgba(255,255,255,0.05)" : "none" }}>
                  <div>
                    <div className="flex items-center gap-2">
                      <div className="text-white font-medium text-sm">{cur}</div>
                      <div className={`text-xs font-semibold ${isOn ? "text-green-400" : "text-white/20"}`}>{isOn ? "ON" : "OFF"}</div>
                    </div>
                    <div className="text-white/40 text-xs">{CURRENCY_NAMES[cur]}</div>
                  </div>
                  <button
                    onClick={() => toggleGlobalCurrency(cur)}
                    className="focus:outline-none"
                    aria-label={`Toggle ${cur} ${isOn ? "off" : "on"}`}
                  >
                    {isOn
                      ? <ToggleRight size={32} style={{ color: "hsl(43,85%,60%)" }} />
                      : <ToggleLeft size={32} style={{ color: "rgba(255,255,255,0.2)" }} />}
                  </button>
                </div>
              );
            })}
          </div>
          <button
            onClick={handleApplyToAll}
            disabled={savingGlobal}
            className="gold-btn w-full py-3 text-sm font-semibold mt-3 flex items-center justify-center gap-2"
          >
            {savingGlobal
              ? <div className="w-4 h-4 border-2 border-gray-900/30 border-t-gray-900 rounded-full animate-spin" />
              : <><Check size={14} /> Apply to All {accounts.length} Accounts ({Array.from(enabledGlobal).length} currencies)</>}
          </button>
        </div>

        {/* Per-Account Currency Assignment */}
        <div>
          <div className="text-white/50 text-xs font-semibold uppercase tracking-wide mb-2">Per-Account Currency Assignment</div>
          <div className="text-white/30 text-xs mb-3">Select an account and choose which currencies that specific user can access. Saves to database — changes take effect immediately.</div>
          <select
            className="dark-input text-sm mb-3"
            value={selectedAccount}
            onChange={e => setSelectedAccount(e.target.value)}
          >
            <option value="">Select an account...</option>
            {accounts.map(a => {
              const dbCurrencies = (a as Record<string, unknown>).enabled_currencies as string[] | null;
              const count = dbCurrencies?.length || 1;
              return (
                <option key={a.id} value={a.id}>
                  {a.account_name} — {a.account_number} ({a.currency}) · {count} currencies
                </option>
              );
            })}
          </select>

          {selectedAccount && (
            <div className="space-y-3">
              <div className="text-white/40 text-xs">Toggle currencies for this account. Click Save to apply.</div>
              <div className="rounded-2xl overflow-hidden" style={{ background: "hsl(220,50%,13%)", border: "1px solid rgba(255,255,255,0.08)" }}>
                {ALL_CURRENCIES.map((cur, i, arr) => {
                  const isOn = accountCurrencies.has(cur);
                  const rateDisplay = cur === "USD" ? "Base" : rates[cur] ? `1 USD = ${rates[cur]?.toFixed(cur === "JPY" || cur === "NGN" ? 0 : 2)} ${cur}` : "";
                  return (
                    <div key={cur} className="flex items-center justify-between px-4 py-2.5" style={{ borderBottom: i < arr.length - 1 ? "1px solid rgba(255,255,255,0.05)" : "none" }}>
                      <div className="flex-1">
                        <div className="flex items-center gap-2">
                          <div className="text-white font-medium text-sm">{cur}</div>
                          <div className="text-white/40 text-xs">{CURRENCY_NAMES[cur]}</div>
                          <div className={`text-xs font-bold ${isOn ? "text-green-400" : "text-white/15"}`}>{isOn ? "✓" : "✗"}</div>
                        </div>
                        {rateDisplay && <div className="text-white/25 text-xs mt-0.5">{rateDisplay}</div>}
                      </div>
                      <button
                        onClick={() => toggleAccountCurrency(cur)}
                        className="flex-shrink-0 focus:outline-none"
                        aria-label={`Toggle ${cur} for account`}
                      >
                        {isOn
                          ? <ToggleRight size={28} style={{ color: "hsl(43,85%,60%)" }} />
                          : <ToggleLeft size={28} style={{ color: "rgba(255,255,255,0.2)" }} />}
                      </button>
                    </div>
                  );
                })}
              </div>

              <div className="flex items-center justify-between text-xs text-white/40 px-1">
                <span>{accountCurrencies.size} currencies selected</span>
                <span>{Array.from(accountCurrencies).join(", ")}</span>
              </div>

              <button
                onClick={handleSaveAccountCurrencies}
                disabled={savingAccount}
                className="gold-btn w-full py-3 text-sm font-semibold flex items-center justify-center gap-2"
              >
                {savingAccount
                  ? <div className="w-4 h-4 border-2 border-gray-900/30 border-t-gray-900 rounded-full animate-spin" />
                  : <><Check size={14} /> Save — {accountCurrencies.size} currencies for this account</>}
              </button>
            </div>
          )}
        </div>

        {/* Quick Revoke Per Account */}
        <div>
          <div className="text-white/50 text-xs font-semibold uppercase tracking-wide mb-2">Current Currency Assignments</div>
          <div className="space-y-2">
            {accounts.filter(a => {
              const dbC = (a as Record<string, unknown>).enabled_currencies as string[] | null;
              return dbC && dbC.length > 1;
            }).slice(0, 10).map(acc => {
              const dbC = (acc as Record<string, unknown>).enabled_currencies as string[];
              return (
                <div key={acc.id} className="rounded-2xl p-3" style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.07)" }}>
                  <div className="text-white font-semibold text-xs mb-1">{acc.account_name}</div>
                  <div className="flex flex-wrap gap-1">
                    {dbC.map(c => (
                      <div key={c} className="flex items-center gap-1 px-2 py-0.5 rounded-full text-xs" style={{ background: "rgba(200,155,50,0.1)", border: "1px solid rgba(200,155,50,0.2)", color: "hsl(43,85%,60%)" }}>
                        {c}
                        <button onClick={() => handleRevokeCurrency(acc.id, c)} className="text-red-400/60 hover:text-red-400 ml-0.5">
                          <Trash2 size={9} />
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}
