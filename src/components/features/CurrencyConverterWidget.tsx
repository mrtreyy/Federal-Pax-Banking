import { useState, useEffect } from "react";
import { ArrowLeftRight, TrendingUp, ChevronDown } from "lucide-react";

const CURRENCIES = [
  "USD","EUR","GBP","CAD","AUD","JPY","NGN","GHS","ZAR","CHF","CNY","INR",
  "MXN","BRL","KES","EGP","AED","SAR","SGD","HKD","NOK","SEK","DKK","NZD","THB",
];

// Static approximate rates relative to USD (sandbox rates)
const RATES_TO_USD: Record<string, number> = {
  USD: 1, EUR: 0.92, GBP: 0.79, CAD: 1.37, AUD: 1.54, JPY: 149.5,
  NGN: 1580, GHS: 14.5, ZAR: 18.6, CHF: 0.88, CNY: 7.24, INR: 83.2,
  MXN: 17.1, BRL: 5.02, KES: 133, EGP: 48.5, AED: 3.67, SAR: 3.75,
  SGD: 1.34, HKD: 7.82, NOK: 10.7, SEK: 10.5, DKK: 6.9, NZD: 1.63, THB: 35.6,
};

interface Props {
  defaultFrom?: string;
}

export default function CurrencyConverterWidget({ defaultFrom = "USD" }: Props) {
  const [from, setFrom] = useState(defaultFrom);
  const [to, setTo] = useState(from === "USD" ? "EUR" : "USD");
  const [amount, setAmount] = useState("1000");
  const [result, setResult] = useState<number | null>(null);

  useEffect(() => {
    convert();
  }, [from, to, amount]);

  const convert = () => {
    const val = parseFloat(amount);
    if (!val || isNaN(val)) { setResult(null); return; }
    const fromRate = RATES_TO_USD[from] || 1;
    const toRate = RATES_TO_USD[to] || 1;
    setResult((val / fromRate) * toRate);
  };

  const swap = () => {
    setFrom(to);
    setTo(from);
  };

  const fmt = (n: number, currency: string) => {
    const decimals = ["JPY", "NGN", "KES"].includes(currency) ? 0 : 2;
    return n.toLocaleString("en-US", { minimumFractionDigits: decimals, maximumFractionDigits: decimals });
  };

  return (
    <div className="rounded-3xl p-4" style={{ background: "hsl(220,50%,14%)", border: "1px solid rgba(255,255,255,0.08)" }}>
      <div className="flex items-center gap-2 mb-3">
        <TrendingUp size={15} style={{ color: "hsl(43,85%,60%)" }} />
        <span className="text-white/60 text-xs font-semibold uppercase tracking-wide">Currency Converter</span>
        <span className="ml-auto text-white/20 text-xs">Indicative rates</span>
      </div>

      <div className="space-y-3">
        {/* Amount */}
        <div>
          <label className="text-white/40 text-xs mb-1 block">Amount</label>
          <input
            type="number"
            className="dark-input text-lg font-bold"
            value={amount}
            onChange={e => setAmount(e.target.value)}
            placeholder="0"
          />
        </div>

        {/* From / To */}
        <div className="flex items-center gap-2">
          <div className="flex-1">
            <label className="text-white/40 text-xs mb-1 block">From</label>
            <div className="relative">
              <select
                className="dark-input appearance-none pr-8 font-semibold"
                value={from}
                onChange={e => setFrom(e.target.value)}
              >
                {CURRENCIES.map(c => <option key={c} value={c}>{c}</option>)}
              </select>
              <ChevronDown size={13} className="absolute right-3 top-1/2 -translate-y-1/2 text-white/30 pointer-events-none" />
            </div>
          </div>

          <button
            onClick={swap}
            className="mt-5 w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0 transition-colors hover:bg-yellow-400/20"
            style={{ background: "rgba(255,255,255,0.07)", border: "1px solid rgba(255,255,255,0.1)" }}
          >
            <ArrowLeftRight size={14} style={{ color: "hsl(43,85%,60%)" }} />
          </button>

          <div className="flex-1">
            <label className="text-white/40 text-xs mb-1 block">To</label>
            <div className="relative">
              <select
                className="dark-input appearance-none pr-8 font-semibold"
                value={to}
                onChange={e => setTo(e.target.value)}
              >
                {CURRENCIES.map(c => <option key={c} value={c}>{c}</option>)}
              </select>
              <ChevronDown size={13} className="absolute right-3 top-1/2 -translate-y-1/2 text-white/30 pointer-events-none" />
            </div>
          </div>
        </div>

        {/* Result */}
        {result !== null && (
          <div className="rounded-2xl p-3" style={{ background: "rgba(200,155,50,0.08)", border: "1px solid rgba(200,155,50,0.15)" }}>
            <div className="text-white/50 text-xs mb-0.5">{fmt(parseFloat(amount) || 0, from)} {from} =</div>
            <div className="text-white font-bold text-2xl">{fmt(result, to)} <span style={{ color: "hsl(43,85%,60%)" }}>{to}</span></div>
            <div className="text-white/30 text-xs mt-1">
              1 {from} = {fmt(RATES_TO_USD[to] / RATES_TO_USD[from], to)} {to}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
