import { useState, useRef } from "react";
import { X, ArrowDownLeft, ArrowUpRight, Download, Search, Calendar, Filter } from "lucide-react";
import type { Transaction } from "@/lib/supabase";
import { formatCurrency, formatDateTime, printReceipt, downloadAsCSV } from "@/lib/utils";
import TransactionReceiptModal from "./TransactionReceiptModal";

interface Props {
  type: "in" | "out";
  transactions: Transaction[];
  currency: string;
  accountName: string;
  onClose: () => void;
  onReportTx?: (tx: Transaction) => void;
}

export default function TotalInOutModal({ type, transactions, currency, accountName, onClose, onReportTx }: Props) {
  const [search, setSearch] = useState("");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [selectedTx, setSelectedTx] = useState<Transaction | null>(null);
  const isIn = type === "in";

  const filtered = transactions.filter((tx) => {
    const txIsIn = tx.type === "deposit" || tx.type === "credit";
    if (isIn !== txIsIn) return false;
    if (search && !((tx.recipient_name || "").toLowerCase().includes(search.toLowerCase()) || tx.transaction_id.toLowerCase().includes(search.toLowerCase()) || (tx.description || "").toLowerCase().includes(search.toLowerCase()))) return false;
    if (dateFrom && new Date(tx.custom_timestamp) < new Date(dateFrom)) return false;
    if (dateTo && new Date(tx.custom_timestamp) > new Date(dateTo + "T23:59:59")) return false;
    return true;
  });

  const total = filtered.reduce((s, t) => s + Number(t.amount), 0);

  const handleExportCSV = () => {
    const rows = [
      ["Transaction ID", "Type", "Amount", "Currency", "Recipient/Sender", "Bank", "Description", "Date & Time"],
      ...filtered.map(tx => [tx.transaction_id, tx.type, String(tx.amount), currency, tx.recipient_name || "", tx.recipient_bank || "", tx.description || "", formatDateTime(tx.custom_timestamp)]),
    ];
    downloadAsCSV(rows, `${accountName}-${type}-transactions`);
  };

  return (
    <>
      <div className="fixed inset-0 z-50 flex flex-col" style={{ background: "hsl(220,45%,8%)" }}>
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 flex-shrink-0" style={{ background: "hsl(220,55%,13%)", borderBottom: "1px solid rgba(255,255,255,0.08)" }}>
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl flex items-center justify-center"
              style={{ background: isIn ? "rgba(34,197,94,0.15)" : "rgba(239,68,68,0.15)" }}>
              {isIn ? <ArrowDownLeft size={20} color="#22c55e" /> : <ArrowUpRight size={20} color="#ef4444" />}
            </div>
            <div>
              <div className="text-white font-bold">Total {isIn ? "In" : "Out"}</div>
              <div className="font-bold text-lg" style={{ color: isIn ? "#22c55e" : "#ef4444" }}>
                {formatCurrency(total, currency)}
              </div>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button onClick={handleExportCSV}
              className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-medium"
              style={{ background: "rgba(255,255,255,0.07)", color: "rgba(255,255,255,0.6)" }}>
              <Download size={13} /> Export
            </button>
            <button onClick={onClose} className="text-white/40 hover:text-white p-1"><X size={20} /></button>
          </div>
        </div>

        {/* Filters */}
        <div className="px-4 py-3 flex-shrink-0 space-y-2" style={{ borderBottom: "1px solid rgba(255,255,255,0.06)" }}>
          <div className="relative">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-white/30" />
            <input className="dark-input pl-9 py-2 text-sm" placeholder="Search transactions..." value={search} onChange={e => setSearch(e.target.value)} />
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="text-white/40 text-xs mb-1 block flex items-center gap-1"><Calendar size={10} /> From</label>
              <input type="date" className="dark-input py-2 text-xs" value={dateFrom} onChange={e => setDateFrom(e.target.value)} />
            </div>
            <div>
              <label className="text-white/40 text-xs mb-1 block flex items-center gap-1"><Calendar size={10} /> To</label>
              <input type="date" className="dark-input py-2 text-xs" value={dateTo} onChange={e => setDateTo(e.target.value)} />
            </div>
          </div>
          <div className="text-white/30 text-xs">{filtered.length} transaction{filtered.length !== 1 ? "s" : ""} found</div>
        </div>

        {/* List */}
        <div className="flex-1 overflow-y-auto p-4 space-y-2">
          {filtered.length === 0 ? (
            <div className="text-center py-12">
              <div className="text-white/25 text-sm">No transactions found</div>
            </div>
          ) : (
            filtered.map((tx) => (
              <button key={tx.id} onClick={() => setSelectedTx(tx)}
                className="w-full flex items-center gap-3 p-4 rounded-2xl text-left spring-tap"
                style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.06)" }}>
                <div className="w-9 h-9 rounded-2xl flex items-center justify-center flex-shrink-0"
                  style={{ background: isIn ? "rgba(34,197,94,0.12)" : "rgba(239,68,68,0.12)" }}>
                  {isIn ? <ArrowDownLeft size={16} color="#22c55e" /> : <ArrowUpRight size={16} color="#ef4444" />}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="text-white text-sm font-medium truncate">
                    {tx.recipient_name || (isIn ? "Deposit Received" : "Transfer Sent")}
                  </div>
                  <div className="text-white/40 text-xs">{formatDateTime(tx.custom_timestamp)}</div>
                  {tx.description && <div className="text-white/25 text-xs truncate">{tx.description}</div>}
                </div>
                <div className="font-bold text-sm flex-shrink-0" style={{ color: isIn ? "#22c55e" : "#ef4444" }}>
                  {isIn ? "+" : "-"}{formatCurrency(tx.amount, currency)}
                </div>
              </button>
            ))
          )}
        </div>
      </div>

      {selectedTx && (
        <TransactionReceiptModal
          tx={{ ...selectedTx, account_name: accountName, currency }}
          onClose={() => setSelectedTx(null)}
          showReport={!!onReportTx}
          onReport={onReportTx ? () => { setSelectedTx(null); onReportTx(selectedTx); } : undefined}
        />
      )}
    </>
  );
}
