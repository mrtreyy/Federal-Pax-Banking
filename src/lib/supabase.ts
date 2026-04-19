import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL as string;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string;

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: { persistSession: false },
});

export type Account = {
  id: string;
  account_name: string;
  account_number: string;
  account_type: string;
  balance: number;
  currency: string;
  login_email: string;
  login_password: string;
  profile_picture?: string;
  state?: string;
  country?: string;
  zipcode?: string;
  address?: string;
  phone?: string;
  id_info?: string;
  btc_address?: string;
  paypal_email?: string;
  bank_name?: string;
  bank_account_number?: string;
  bank_routing?: string;
  is_frozen: boolean;
  is_closed: boolean;
  is_inactive?: boolean;
  status_timer_expires_at?: string;
  ceo_locked?: boolean;
  created_at: string;
  updated_at: string;
  transfer_pin?: string;
  balance_threshold?: number;
  custom_banner?: string;
  created_by_sub_admin?: string;
  created_by_ap?: string;
  last_login_at?: string;
  last_login_device?: string;
  account_tier?: number;
  balance_hidden?: boolean;
};

export type Transaction = {
  id: string;
  account_id: string;
  type: string;
  amount: number;
  recipient_name?: string;
  recipient_bank?: string;
  recipient_account_number?: string;
  description?: string;
  transaction_id: string;
  admin_override: boolean;
  custom_timestamp: string;
  created_at: string;
  sender_name?: string;
};

export type BankingMessage = {
  id: string;
  account_id: string;
  sender: string;
  message: string;
  message_type: string;
  transaction_ref?: string;
  is_read: boolean;
  is_seen: boolean;
  is_typing?: boolean;
  created_at: string;
};

export type BankingNotification = {
  id: string;
  account_id?: string;
  target: string;
  title: string;
  body: string;
  is_read: boolean;
  related_message_id?: string;
  created_at: string;
};

export type AdminAuditLog = {
  id: string;
  action: string;
  target_account_id?: string;
  target_account_name?: string;
  details?: Record<string, unknown>;
  performed_by: string;
  portal_type?: string;
  created_at: string;
};

export type AdministrationPlus = {
  id: string;
  name: string;
  tier: number;
  password: string;
  profile_picture?: string;
  max_admin_portals: number;
  max_individual_per_admin: number;
  max_balance: number;
  created_at: string;
  is_frozen?: boolean;
  is_closed?: boolean;
  is_inactive?: boolean;
  status_timer_expires_at?: string;
  ceo_locked?: boolean;
};

export type SubAdminPortal = {
  id: string;
  name: string;
  password: string;
  profile_picture?: string;
  created_by_ap?: string;
  max_individual: number;
  created_at: string;
  is_frozen?: boolean;
  is_closed?: boolean;
  is_inactive?: boolean;
  status_timer_expires_at?: string;
  ceo_locked?: boolean;
};

export type LoginActivity = {
  id: string;
  account_id?: string;
  account_name: string;
  portal_type: string;
  ip_address?: string;
  user_agent?: string;
  login_at: string;
};

export type VirtualCardApplication = {
  id: string;
  account_id: string;
  account_name: string;
  account_number: string;
  status: 'pending' | 'approved' | 'declined';
  decline_count: number;
  applied_at: string;
  reviewed_at?: string;
  reviewed_by?: string;
  decline_reason?: string;
  card_number?: string;
  card_holder?: string;
  card_expiry?: string;
  card_cvv?: string;
  card_type?: string;
  card_is_frozen?: boolean;
  card_daily_limit?: number;
  card_monthly_limit?: number;
  issued_date?: string;
  created_at: string;
};

export type ScheduledTransaction = {
  id: string;
  account_id: string;
  type: string;
  amount: number;
  recipient_name?: string;
  recipient_bank?: string;
  sender_name?: string;
  description?: string;
  scheduled_at: string;
  processed: boolean;
  created_at: string;
};

export type SavingsGoal = {
  id: string;
  account_id: string;
  name: string;
  target_amount: number;
  current_amount: number;
  deadline?: string;
  is_paused: boolean;
  created_at: string;
  updated_at: string;
};

export type LoanApplication = {
  id: string;
  account_id: string;
  account_name: string;
  account_number: string;
  amount: number;
  purpose: string;
  status: 'pending' | 'approved' | 'declined';
  decline_reason?: string;
  repayment_terms?: string;
  reviewed_by?: string;
  reviewed_at?: string;
  applied_at: string;
  created_at: string;
};

export type Beneficiary = {
  id: string;
  account_id: string;
  name: string;
  bank_name: string;
  account_number: string;
  nickname?: string;
  created_at: string;
};

export type StandingOrder = {
  id: string;
  account_id: string;
  recipient_name: string;
  recipient_bank: string;
  recipient_account_number: string;
  amount: number;
  frequency: string;
  next_run_date: string;
  description?: string;
  is_paused: boolean;
  created_at: string;
};

export type ChequeRequest = {
  id: string;
  account_id: string;
  account_name: string;
  account_number: string;
  status: 'pending' | 'approved' | 'declined';
  decline_reason?: string;
  delivery_address?: string;
  reviewed_by?: string;
  reviewed_at?: string;
  applied_at: string;
  created_at: string;
};

export type TierUpgradeRequest = {
  id: string;
  account_id: string;
  account_name: string;
  account_number: string;
  current_tier: number;
  requested_tier: number;
  id_document_url?: string;
  id_document_type?: string;
  additional_notes?: string;
  status: 'pending' | 'approved' | 'declined';
  decline_reason?: string;
  reviewed_by?: string;
  reviewed_at?: string;
  applied_at: string;
  created_at: string;
};

export type TransactionDispute = {
  id: string;
  account_id: string;
  transaction_id: string;
  account_name: string;
  reason: string;
  status: 'pending' | 'resolved' | 'dismissed' | 'reversed';
  resolution_note?: string;
  reviewed_by?: string;
  reviewed_at?: string;
  amount?: number;
  created_at: string;
};

export async function logAudit(
  action: string,
  targetId?: string,
  targetName?: string,
  details?: Record<string, unknown>,
  performedBy = 'admin',
  portalType = 'admin'
) {
  await supabase.from('admin_audit_log').insert({
    action,
    target_account_id: targetId || null,
    target_account_name: targetName || null,
    details: details || null,
    performed_by: performedBy,
    portal_type: portalType,
  });
}

export async function getClientIP(): Promise<string> {
  try {
    const res = await fetch('https://api.ipify.org?format=json');
    const data = await res.json();
    return data.ip || 'unknown';
  } catch {
    return 'unknown';
  }
}

export async function trackLogin(
  accountName: string,
  portalType: string,
  accountId?: string
) {
  const ip = await getClientIP();
  await supabase.from('login_activity').insert({
    account_id: accountId || null,
    account_name: accountName,
    portal_type: portalType,
    ip_address: ip,
    user_agent: navigator.userAgent,
    login_at: new Date().toISOString(),
  });
  await logAudit('login', accountId, accountName, { portal: portalType, ip, ua: navigator.userAgent.slice(0, 80) }, accountName, portalType);
}

export async function trackFeatureUse(
  accountName: string,
  accountId: string,
  feature: string,
  portalType = 'individual'
) {
  await logAudit('feature_used', accountId, accountName, { feature }, accountName, portalType);
}
