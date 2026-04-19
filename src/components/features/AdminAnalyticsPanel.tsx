import { useState, useEffect } from "react";
import { X, BarChart2, TrendingUp, TrendingDown } from "lucide-react";
import type { Account, Transaction } from "@/lib/supabase";
import { formatCurrency, formatDateTime } from "@/lib/utils";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Legend } from "recharts";

interface Props {
  transactions: Transaction[];
  accounts: Account[];
  onClose: () => void;
}

export default function AdminAnalyticsPanel({ transactions, accounts, onClose }: Props) {
  const [period, setPeriod] = useState<"7d" | "30d" | "90d" | "all">("30d");

  const now = new Date();
  const cutoff = period === "7d" ? new Date(now.getTime() - 7 * 86400000)
    : period === "30d" ? new Date(now.getTime() - 30 * 86400000)
    : period === "90d" ? new Date(now.getTime() - 90 * 86400000)
    : new Date(0);

  const filtered = transactions.filter(tx => new Date(tx.custom_timestamp) >= cutoff);

  // Group by day
  const byDay: Record<string, { deposits: number; transfers: number }> = {};
  filtered.forEach(tx => {
    const day = new Date(tx.custom_timestamp).toLocaleDateString("en-US", { month: "short", day: "numeric" });
    if (!byDay[day]) byDay[day] = { deposits: 0, transfers: 0 };
    if (tx.type === "deposit" || tx.type === "credit") byDay[day].deposits += Number(tx.amount);
    else byDay[day].transfers += Number(tx.amount);
  });

  const chartData = Object.entries(byDay).slice(-20).map(([day, vals]) => ({
    day,
    "Deposits": Math.round(vals.deposits),
    "Transfers": Math.round(vals.transfers),
  }));

  const totalDeposits = filtered.filter(t => t.type === "deposit" || t.type === "credit").reduce((s, t) => s + Number(t.amount), 0);
  const totalTransfers = filtered.filter(t => t.type !== "deposit" && t.type !== "credit").reduce((s, t) => s + Number(t.amount), 0);

  return (
    <div className="min-h-screen pb-20" style={{ background: "hsl(220,45%,8%)" }}>
      <div className="sticky top-0 z-30 flex items-center justify-between px-5 pt-12 pb-4" style={{ background: "hsl(220,55%,12%)", borderBottom: "1px solid rgba(255,255,255,0.06)" }}>
        <div className="flex items-center gap-2">
          <BarChart2 size={20} style={{ color: "hsl(43,85%,60%)" }} />
          <span className="text-white font-bold">Analytics</span>
        </div>
        <button onClick={onClose} className="text-white/40 hover:text-white"><X size={20} /></button>
      </div>

      <div className="px-4 pt-5 space-y-4">
        {/* Period selector */}
        <div className="flex gap-2">
          {(["7d", "30d", "90d", "all"] as const).map(p => (
            <button key={p} onClick={() => setPeriod(p)}
              className="flex-1 py-2 rounded-xl text-xs font-semibold"
              style={period === p ? { background: "hsl(43,85%,55%)", color: "#111" } : { background: "rgba(255,255,255,0.07)", color: "rgba(255,255,255,0.5)" }}>
              {p === "all" ? "All" : p}
            </button>
          ))}
        </div>

        {/* Summary */}
        <div className="grid grid-cols-2 gap-3">
          <div className="navy-card p-4">
            <div className="flex items-center gap-2 mb-1"><TrendingUp size={14} color="#22c55e" /><span className="text-white/50 text-xs">Total In</span></div>
            <div className="text-green-400 font-bold text-xl">{formatCurrency(totalDeposits, "USD")}</div>
            <div className="text-white/30 text-xs">{filtered.filter(t => t.type === "deposit" || t.type === "credit").length} transactions</div>
          </div>
          <div className="navy-card p-4">
            <div className="flex items-center gap-2 mb-1"><TrendingDown size={14} color="#ef4444" /><span className="text-white/50 text-xs">Total Out</span></div>
            <div className="text-red-400 font-bold text-xl">{formatCurrency(totalTransfers, "USD")}</div>
            <div className="text-white/30 text-xs">{filtered.filter(t => t.type !== "deposit" && t.type !== "credit").length} transactions</div>
          </div>
        </div>

        {/* Chart */}
        {chartData.length > 0 ? (
          <div className="navy-card p-4">
            <div className="text-white/60 text-xs font-semibold mb-3">Deposits vs Transfers</div>
            <ResponsiveContainer width="100%" height={200}>
              <BarChart data={chartData} margin={{ top: 0, right: 0, bottom: 0, left: 0 }}>
                <XAxis dataKey="day" tick={{ fill: "rgba(255,255,255,0.3)", fontSize: 10 }} />
                <YAxis tick={{ fill: "rgba(255,255,255,0.3)", fontSize: 10 }} />
                <Tooltip contentStyle={{ background: "hsl(220,50%,14%)", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 12, color: "white" }} />
                <Legend wrapperStyle={{ fontSize: 11, color: "rgba(255,255,255,0.5)" }} />
                <Bar dataKey="Deposits" fill="#22c55e" radius={[4, 4, 0, 0]} />
                <Bar dataKey="Transfers" fill="#ef4444" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        ) : (
          <div className="text-center py-8 text-white/30 text-sm">No data for this period</div>
        )}

        {/* Top accounts by balance */}
        <div className="navy-card p-4">
          <div className="text-white/60 text-xs font-semibold mb-3">Top Accounts by Balance</div>
          {[...accounts].sort((a, b) => Number(b.balance) - Number(a.balance)).slice(0, 5).map((acc, i) => (
            <div key={acc.id} className="flex items-center gap-3 py-2" style={{ borderBottom: "1px solid rgba(255,255,255,0.05)" }}>
              <span className="text-white/25 text-xs w-4">{i+1}</span>
              <span className="text-white text-xs flex-1">{acc.account_name}</span>
              <span className="text-yellow-400 text-xs font-bold">{formatCurrency(acc.balance, acc.currency)}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
