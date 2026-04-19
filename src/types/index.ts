export type UserSession = {
  id: string;
  account_name: string;
  account_number: string;
  account_type: string;
  balance: number;
  currency: string;
  login_email: string;
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
};

export type AdminSession = {
  isAdmin: true;
  loginTime: string;
};
