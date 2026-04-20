import { useState } from "react";
import { X, Download, Printer, MessageSquare, Copy, CheckCheck, ArrowUpRight, ArrowDownLeft, Share2 } from "lucide-react";
import { formatCurrency, formatDateTime } from "@/lib/utils";
import type { Transaction } from "@/lib/supabase";
import { toast } from "sonner";
import bankLogo from "@/assets/bankunited-logo.jpg";

interface Props {
  tx: Transaction & { account_name?: string; currency?: string };
  onClose: () => void;
  onReport?: () => void;
  showReport?: boolean;
}

function generateReceiptHTML(tx: Props["tx"]): string {
  const isIn = tx.type === "deposit" || tx.type === "credit";
  const color = isIn ? "#22c55e" : "#ef4444";
  const currency = tx.currency || "USD";
  const rows = [
    ["Transaction ID", tx.transaction_id],
    ["Type", tx.type.toUpperCase()],
    tx.account_name ? ["Account Holder", tx.account_name] : null,
    (tx as Record<string, unknown>).sender_name ? ["Sender", (tx as Record<string, unknown>).sender_name as string] : null,
    tx.recipient_name ? ["Beneficiary", tx.recipient_name] : null,
    tx.recipient_bank ? ["Beneficiary Bank", tx.recipient_bank] : null,
    tx.recipient_account_number ? ["Beneficiary Account", tx.recipient_account_number] : null,
    tx.description ? ["Narration", tx.description] : null,
    ["Value Date", formatDateTime(tx.custom_timestamp)],
    ["Status", "SUCCESSFUL"],
    ["Verified By", "BankUnited"],
  ].filter(Boolean) as string[][];

  return `<!DOCTYPE html>
<html>
<head>
<meta charset="UTF-8" name="viewport" content="width=device-width,initial-scale=1"/>
<title>BankUnited Receipt — ${tx.transaction_id}</title>
<style>
  @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800;900&display=swap');
  *{margin:0;padding:0;box-sizing:border-box;}
  body{font-family:Inter,Arial,sans-serif;background:#0d1321;min-height:100vh;display:flex;align-items:flex-start;justify-content:center;padding:32px 16px;color:#fff;}
  .wrapper{width:100%;max-width:460px;}
  .card{background:#111b2e;border:1px solid rgba(255,255,255,0.1);border-radius:28px;overflow:hidden;}
  .header-band{background:linear-gradient(135deg,#1a2a4a 0%,#111b2e 100%);padding:28px 28px 20px;text-align:center;border-bottom:1px solid rgba(255,255,255,0.08);}
  .logo-ring{width:64px;height:64px;border-radius:20px;background:linear-gradient(135deg,#c89b3c,#8a6820);display:flex;align-items:center;justify-content:center;margin:0 auto 12px;box-shadow:0 8px 24px rgba(200,155,60,0.35);}
  .logo-text{font-size:26px;font-weight:900;color:#111;letter-spacing:-1px;}
  .bank-name{font-size:15px;font-weight:700;color:#fff;margin-bottom:2px;letter-spacing:0.3px;}
  .bank-sub{font-size:11px;color:rgba(255,255,255,0.35);letter-spacing:0.5px;text-transform:uppercase;}
  .status-badge{display:inline-flex;align-items:center;gap:6px;margin-top:12px;padding:5px 14px;border-radius:50px;background:rgba(34,197,94,0.12);border:1px solid rgba(34,197,94,0.3);}
  .status-dot{width:7px;height:7px;border-radius:50%;background:#22c55e;box-shadow:0 0 6px rgba(34,197,94,0.6);}
  .status-text{font-size:11px;font-weight:700;color:#22c55e;text-transform:uppercase;letter-spacing:0.8px;}
  .amount-section{padding:24px 28px;text-align:center;border-bottom:1px solid rgba(255,255,255,0.07);}
  .direction{font-size:12px;font-weight:600;text-transform:uppercase;letter-spacing:1px;color:rgba(255,255,255,0.3);margin-bottom:6px;}
  .amount{font-size:42px;font-weight:900;color:${color};letter-spacing:-1.5px;line-height:1;}
  .currency-tag{font-size:12px;font-weight:600;color:rgba(255,255,255,0.3);margin-top:6px;letter-spacing:0.5px;}
  .details{padding:20px 28px;}
  .row{display:flex;justify-content:space-between;align-items:flex-start;padding:11px 0;border-bottom:1px solid rgba(255,255,255,0.05);}
  .row:last-child{border:none;}
  .label{font-size:12px;color:rgba(255,255,255,0.35);font-weight:500;flex-shrink:0;margin-right:12px;padding-top:1px;}
  .value{font-size:12px;color:rgba(255,255,255,0.9);font-weight:600;text-align:right;word-break:break-all;max-width:62%;}
  .value.mono{font-family:monospace;letter-spacing:0.5px;}
  .footer{background:rgba(255,255,255,0.03);border-top:1px solid rgba(255,255,255,0.06);padding:18px 28px;text-align:center;}
  .footer-brand{font-size:11px;color:rgba(255,255,255,0.25);margin-bottom:4px;}
  .footer-legal{font-size:10px;color:rgba(255,255,255,0.13);line-height:1.5;}
  .watermark{margin-top:16px;color:rgba(200,155,60,0.25);font-size:10px;font-weight:700;letter-spacing:2px;text-transform:uppercase;}
  @media print {
    body{background:#fff;padding:0;}
    .card{border:1px solid #ddd;border-radius:0;}
    .header-band{background:#f8f9fa;}
    .bank-name,.amount,.value{color:#000 !important;}
    .label,.direction,.bank-sub,.footer-brand,.footer-legal{color:#555 !important;}
  }
</style>
</head>
<body>
<div class="wrapper">
  <div class="card">
    <div class="header-band">
      <div class="logo-ring"><div class="logo-text">G</div></div>
      <div class="bank-name">BankUnited</div>
      <div class="bank-sub">Official Transaction Receipt</div>
      <div class="status-badge"><div class="status-dot"></div><div class="status-text">Transaction Successful</div></div>
    </div>
    <div class="amount-section">
      <div class="direction">${isIn ? "Amount Received" : "Amount Sent"}</div>
      <div class="amount">${isIn ? "+" : "-"}${formatCurrency(tx.amount, currency)}</div>
      <div class="currency-tag">${currency} · ${new Date(tx.custom_timestamp).toLocaleDateString("en-US", { weekday: "long", year: "numeric", month: "long", day: "numeric" })}</div>
    </div>
    <div class="details">
      ${rows.map(([l, v]) => `<div class="row"><span class="label">${l}</span><span class="value${l === "Transaction ID" || l === "Beneficiary Account" ? " mono" : ""}">${v}</span></div>`).join("")}
    </div>
    <div class="footer">
      <div class="footer-brand">© 2015 BankUnited · All Rights Reserved</div>
      <div class="footer-legal">This is an electronically generated receipt. No signature is required. This document is valid as proof of transaction. Please retain for your records.</div>
      <div class="watermark">🔒 BKU · SECURED & VERIFIED</div>
    </div>
  </div>
</div>
<script>window.onload = function(){ window.print(); }</script>
</body>
</html>`;
}

export default function TransactionReceiptModal({ tx, onClose, onReport, showReport }: Props) {
  const isIn = tx.type === "deposit" || tx.type === "credit";
  const currency = tx.currency || "USD";
  const [copied, setCopied] = useState(false);

  const copyTxId = async () => {
    await navigator.clipboard.writeText(tx.transaction_id);
    setCopied(true);
    toast.success("Transaction ID copied!");
    setTimeout(() => setCopied(false), 2000);
  };

  const handleDownload = () => {
    const html = generateReceiptHTML(tx);
    const w = window.open("", "_blank");
    if (!w) { toast.error("Please allow popups to download receipt."); return; }
    w.document.write(html);
    w.document.close();
  };

  const fields = [
    { label: "Transaction ID", value: tx.transaction_id, mono: true },
    { label: "Type", value: tx.type.charAt(0).toUpperCase() + tx.type.slice(1) },
    tx.account_name ? { label: "Account", value: tx.account_name } : null,
    (tx as Record<string, unknown>).sender_name ? { label: "Sender", value: (tx as Record<string, unknown>).sender_name as string } : null,
    tx.recipient_name ? { label: "Recipient", value: tx.recipient_name } : null,
    tx.recipient_bank ? { label: "Bank", value: tx.recipient_bank } : null,
    tx.recipient_account_number ? { label: "Account No.", value: tx.recipient_account_number, mono: true } : null,
    tx.description ? { label: "Narration", value: tx.description } : null,
  ].filter(Boolean) as { label: string; value: string; mono?: boolean }[];

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center px-4 pb-4">
      <div className="absolute inset-0 bg-black/75 backdrop-blur-sm" onClick={onClose} />
      <div className="relative w-full max-w-sm rounded-3xl overflow-hidden" style={{ background: "hsl(220,50%,12%)", border: "1px solid rgba(255,255,255,0.12)" }}>

        {/* Header */}
        <div className="p-5 flex items-center gap-3" style={{ background: "linear-gradient(135deg,hsl(220,60%,18%),hsl(220,70%,12%))", borderBottom: "1px solid rgba(255,255,255,0.08)" }}>
          <div className="w-11 h-11 rounded-2xl flex items-center justify-center flex-shrink-0" style={{ background: isIn ? "rgba(34,197,94,0.18)" : "rgba(239,68,68,0.18)", border: `1px solid ${isIn ? "rgba(34,197,94,0.3)" : "rgba(239,68,68,0.3)"}` }}>
            {isIn ? <ArrowDownLeft size={20} color="#22c55e" /> : <ArrowUpRight size={20} color="#ef4444" />}
          </div>
          <div className="flex-1 min-w-0">
            <div className="text-white font-bold text-base capitalize">{tx.type} Receipt</div>
            <button onClick={copyTxId} className="flex items-center gap-1 group mt-0.5">
              <span className="text-white/35 text-xs font-mono truncate">{tx.transaction_id}</span>
              {copied ? <CheckCheck size={11} color="hsl(43,85%,60%)" /> : <Copy size={11} className="text-white/20 group-hover:text-white/50" />}
            </button>
          </div>
          <button onClick={onClose} className="text-white/40 hover:text-white"><X size={20} /></button>
        </div>

        {/* Amount */}
        <div className="px-5 py-5 text-center" style={{ background: "rgba(255,255,255,0.02)", borderBottom: "1px solid rgba(255,255,255,0.06)" }}>
          <div className="text-white/40 text-xs mb-1 uppercase tracking-wide">{isIn ? "Amount Received" : "Amount Sent"}</div>
          <div className="font-black" style={{ fontSize: "clamp(1.8rem,7vw,2.5rem)", color: isIn ? "#22c55e" : "#ef4444", letterSpacing: "-1.5px" }}>
            {isIn ? "+" : "-"}{formatCurrency(tx.amount, currency)}
          </div>
          <div className="text-white/30 text-xs mt-1">{formatDateTime(tx.custom_timestamp)}</div>
          <div className="mt-3 inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full" style={{ background: "rgba(34,197,94,0.1)", border: "1px solid rgba(34,197,94,0.25)" }}>
            <div className="w-1.5 h-1.5 rounded-full bg-green-400" />
            <span className="text-green-400 text-xs font-semibold tracking-wide">TRANSACTION SUCCESSFUL</span>
          </div>
        </div>

        {/* Details */}
        <div className="px-5 py-3">
          {fields.map(f => (
            <div key={f.label} className="flex justify-between items-start py-2.5" style={{ borderBottom: "1px solid rgba(255,255,255,0.05)" }}>
              <span className="text-white/35 text-xs flex-shrink-0 w-28">{f.label}</span>
              <span className={`text-white text-xs text-right font-medium break-all ml-2 ${f.mono ? "font-mono" : ""}`}>{f.value}</span>
            </div>
          ))}
        </div>

        {/* BankUnited Footer */}
        <div className="px-5 pb-4 pt-1 text-center">
          <div className="text-white/15 text-xs">🔒 Secured & Verified by BankUnited</div>
        </div>

        {/* Actions */}
        <div className="px-5 pb-5 grid grid-cols-3 gap-2">
          <button onClick={handleDownload}
            className="flex flex-col items-center gap-1.5 py-3 rounded-2xl text-white/60 hover:text-white transition-colors"
            style={{ background: "rgba(255,255,255,0.07)", border: "1px solid rgba(255,255,255,0.1)" }}>
            <Download size={17} style={{ color: "hsl(43,85%,60%)" }} />
            <span className="text-xs font-medium">Download</span>
          </button>
          <button onClick={copyTxId}
            className="flex flex-col items-center gap-1.5 py-3 rounded-2xl text-white/60 hover:text-white transition-colors"
            style={{ background: "rgba(255,255,255,0.07)", border: "1px solid rgba(255,255,255,0.1)" }}>
            {copied ? <CheckCheck size={17} color="hsl(43,85%,60%)" /> : <Copy size={17} />}
            <span className="text-xs font-medium">Copy ID</span>
          </button>
          {showReport && onReport ? (
            <button onClick={onReport}
              className="flex flex-col items-center gap-1.5 py-3 rounded-2xl transition-colors"
              style={{ background: "rgba(239,68,68,0.1)", border: "1px solid rgba(239,68,68,0.2)", color: "#f87171" }}>
              <MessageSquare size={17} />
              <span className="text-xs font-medium">Dispute</span>
            </button>
          ) : (
            <button onClick={handleDownload}
              className="flex flex-col items-center gap-1.5 py-3 rounded-2xl text-white/60 hover:text-white transition-colors"
              style={{ background: "rgba(255,255,255,0.07)", border: "1px solid rgba(255,255,255,0.1)" }}>
              <Share2 size={17} />
              <span className="text-xs font-medium">Share</span>
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
