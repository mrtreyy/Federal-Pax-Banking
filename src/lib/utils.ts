import { type ClassValue, clsx } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatCurrency(amount: number, currency: string = 'USD'): string {
  try {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: currency,
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(amount);
  } catch {
    return `${currency} ${Number(amount).toFixed(2)}`;
  }
}

export function formatDate(dateStr: string): string {
  return new Date(dateStr).toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });
}

export function formatDateTime(dateStr: string): string {
  return new Date(dateStr).toLocaleString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  });
}

export function formatTime(dateStr: string): string {
  return new Date(dateStr).toLocaleTimeString('en-US', {
    hour: '2-digit',
    minute: '2-digit',
  });
}

export function generateAccountNumber(): string {
  const prefix = 'BKU';
  const rand = Math.floor(Math.random() * 9000000000) + 1000000000;
  return `${prefix}${rand}`;
}

export function truncateText(text: string, maxLength: number): string {
  if (text.length <= maxLength) return text;
  return text.substring(0, maxLength) + '...';
}

export function getInitials(name: string): string {
  return name
    .split(' ')
    .map(part => part[0])
    .join('')
    .toUpperCase()
    .slice(0, 2);
}

export function downloadAsText(content: string, filename: string) {
  const blob = new Blob([content], { type: 'text/plain' });
  const link = document.createElement('a');
  link.download = `${filename}.txt`;
  link.href = URL.createObjectURL(blob);
  link.click();
}

export function downloadAsCSV(rows: string[][], filename: string) {
  const content = rows.map(r => r.map(c => `"${String(c).replace(/"/g, '""')}"`).join(',')).join('\n');
  const blob = new Blob([content], { type: 'text/csv' });
  const link = document.createElement('a');
  link.download = `${filename}.csv`;
  link.href = URL.createObjectURL(blob);
  link.click();
}

export function generateReceiptHTML(tx: {
  transaction_id: string;
  type: string;
  amount: number;
  currency?: string;
  recipient_name?: string;
  recipient_bank?: string;
  recipient_account_number?: string;
  description?: string;
  custom_timestamp: string;
  account_name?: string;
  sender_name?: string;
}): string {
  const isIn = tx.type === 'deposit' || tx.type === 'credit';
  const color = isIn ? '#22c55e' : '#ef4444';
  const amtStr = formatCurrency(tx.amount, tx.currency || 'USD');
  const rows = [
    ['Transaction ID', tx.transaction_id],
    ['Type', tx.type.toUpperCase()],
    ['Account', tx.account_name || '—'],
    tx.sender_name ? ['Sender', tx.sender_name] : null,
    tx.recipient_name ? ['Recipient', tx.recipient_name] : null,
    tx.recipient_bank ? ['Bank', tx.recipient_bank] : null,
    tx.recipient_account_number ? ['Account No.', tx.recipient_account_number] : null,
    tx.description ? ['Description', tx.description] : null,
    ['Date & Time', formatDateTime(tx.custom_timestamp)],
    ['Status', 'COMPLETED'],
  ].filter(Boolean) as string[][];

  return `<!DOCTYPE html>
<html>
<head>
<meta charset="UTF-8"/>
<title>BankUnited Receipt — ${tx.transaction_id}</title>
<style>
  *{margin:0;padding:0;box-sizing:border-box;}
  body{font-family:Inter,Arial,sans-serif;background:hsl(220,45%,8%);color:white;min-height:100vh;display:flex;align-items:center;justify-content:center;padding:24px;}
  .card{background:hsl(220,50%,14%);border:1px solid rgba(255,255,255,0.12);border-radius:24px;padding:32px;max-width:420px;width:100%;}
  .header{text-align:center;margin-bottom:24px;}
  .logo{width:56px;height:56px;border-radius:14px;background:linear-gradient(135deg,hsl(43,85%,55%),hsl(38,80%,42%));display:flex;align-items:center;justify-content:center;margin:0 auto 12px;}
  .logo-text{font-size:20px;font-weight:900;color:#111;}
  .bank-name{font-size:14px;font-weight:700;color:white;margin-bottom:2px;}
  .bank-sub{font-size:11px;color:rgba(255,255,255,0.4);}
  .amount{text-align:center;margin:20px 0;padding:20px;background:rgba(255,255,255,0.04);border-radius:16px;border:1px solid rgba(255,255,255,0.08);}
  .amount-val{font-size:2rem;font-weight:800;color:${color};}
  .amount-type{font-size:11px;color:rgba(255,255,255,0.4);margin-top:4px;text-transform:uppercase;}
  .divider{border:none;border-top:1px solid rgba(255,255,255,0.08);margin:16px 0;}
  .row{display:flex;justify-content:space-between;padding:10px 0;border-bottom:1px solid rgba(255,255,255,0.05);}
  .row:last-child{border:none;}
  .label{color:rgba(255,255,255,0.4);font-size:12px;}
  .val{color:white;font-size:12px;font-weight:600;text-align:right;max-width:60%;word-break:break-all;}
  .footer{text-align:center;margin-top:20px;color:rgba(255,255,255,0.2);font-size:11px;}
  .status{display:inline-block;padding:4px 12px;border-radius:20px;background:rgba(34,197,94,0.15);color:#22c55e;font-size:11px;font-weight:700;border:1px solid rgba(34,197,94,0.3);}
  @media print { body{background:#fff;color:#000;} .card{border:1px solid #ddd;background:#fff;} .label{color:#666;} .val{color:#000;} }
</style>
</head>
<body>
<div class="card">
  <div class="header">
    <div class="logo"><div class="logo-text">F</div></div>
    <div class="bank-name">BankUnited</div>
    <div class="bank-sub">Official Transaction Receipt</div>
  </div>
  <div class="amount">
    <div class="amount-val">${isIn ? '+' : '-'}${amtStr}</div>
    <div class="amount-type">${tx.type}</div>
  </div>
  <hr class="divider"/>
  <div>
    ${rows.map(([l, v]) => `<div class="row"><span class="label">${l}</span><span class="val">${v}</span></div>`).join('')}
  </div>
  <div class="footer">
    <div class="status">✓ COMPLETED</div>
    <div style="margin-top:12px;">Thank you for banking with BankUnited</div>
    <div style="margin-top:4px;">© 2015 BankUnited · All rights reserved</div>
  </div>
</div>
</body>
</html>`;
}

export function printReceipt(tx: { transaction_id: string; type: string; amount: number; currency?: string; description?: string; custom_timestamp: string; account_name?: string; [key: string]: unknown }) {
  const html = generateReceiptHTML(tx as Parameters<typeof generateReceiptHTML>[0]);
  const w = window.open('', '_blank');
  if (!w) return;
  w.document.write(html);
  w.document.close();
}

export function downloadReceiptAsHTML(tx: Parameters<typeof generateReceiptHTML>[0]) {
  const html = generateReceiptHTML(tx);
  const blob = new Blob([html], { type: 'text/html' });
  const link = document.createElement('a');
  link.download = `receipt-${tx.transaction_id}.html`;
  link.href = URL.createObjectURL(blob);
  link.click();
}

export function generateReceiptText(tx: Parameters<typeof generateReceiptHTML>[0]): string {
  return `
========================================
      BANKUNITED
      TRANSACTION RECEIPT
========================================
Transaction ID : ${tx.transaction_id}
Type           : ${tx.type.toUpperCase()}
Amount         : ${formatCurrency(tx.amount, tx.currency || 'USD')}
Date & Time    : ${formatDateTime(tx.custom_timestamp)}
Account        : ${tx.account_name || 'N/A'}
${tx.sender_name ? `Sender         : ${tx.sender_name}` : ''}
${tx.recipient_name ? `Recipient      : ${tx.recipient_name}` : ''}
${tx.recipient_bank ? `Bank           : ${tx.recipient_bank}` : ''}
${tx.recipient_account_number ? `Acct No.       : ${tx.recipient_account_number}` : ''}
${tx.description ? `Description    : ${tx.description}` : ''}
Status         : COMPLETED
========================================
     Thank you for banking with us
         BankUnited
========================================
`.trim();
}

export const BANK_SUGGESTIONS = [
  'JPMorgan Chase','Bank of America','Wells Fargo','Citibank','Goldman Sachs',
  'Morgan Stanley','US Bancorp','Truist Bank','PNC Bank','Capital One',
  'TD Bank','HSBC','Barclays','Lloyds Bank','NatWest','Santander',
  'Deutsche Bank','BNP Paribas','Credit Suisse','UBS','ING Bank',
  'Standard Chartered','ICICI Bank','HDFC Bank','Axis Bank','State Bank of India',
  'GTBank','Zenith Bank','Access Bank','First Bank Nigeria','UBA',
  'Ecobank','Stanbic IBTC','First National Bank','Absa Bank','Nedbank',
  'Standard Bank','FNB','Capitec Bank','African Bank','Investec',
  'Bank of Canada','Royal Bank of Canada','Scotiabank','CIBC','BMO',
  'ANZ Bank','Commonwealth Bank','Westpac','NAB','Macquarie Bank',
  'PayPal','Revolut','Wise (TransferWise)','N26','Monzo','Chime',
  'Cash App','Venmo','Stripe','Square Financial','Ally Bank',
  'First Republic Bank','Silicon Valley Bank','Signature Bank',
  'Eurobank','Alpha Bank','Piraeus Bank','National Bank of Greece',
  'CaixaBank','BBVA','Banco Sabadell','UniCredit','Intesa Sanpaolo',
];
