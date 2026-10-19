import { Platform } from 'react-native';

import { ApiError, request, send, type Estimate, type EstimateItem, type ShopSettings } from './api';

export type Money = string;

export type Payment = {
  id: number;
  estimate: string;
  customer_name: string;
  kind: 'payment' | 'refund';
  method: string;
  amount: Money;
  paid_on: string;
  reference: string;
  note: string;
  recorded_by: string;
  created_at: string;
};

export type PaymentState = 'unpaid' | 'partial' | 'paid' | 'refund_due' | 'closed';

export type AdminEstimate = Omit<Estimate, 'items'> & {
  items: (EstimateItem & { id: number; product: number | null })[];
  admin_notes: string;
  user: number | null;
  amount_paid: Money;
  balance: Money;
  payment_status: PaymentState;
  updated_at: string;
  payments?: Payment[];
};

export type EstimatePatch = Partial<
  Pick<
    AdminEstimate,
    | 'status'
    | 'transport_name'
    | 'lr_number'
    | 'dispatch_date'
    | 'delivered_on'
    | 'admin_notes'
    | 'customer_name'
    | 'phone'
    | 'address'
    | 'city'
    | 'state'
    | 'pincode'
    | 'notes'
  >
> & { item_changes?: { id: number; quantity: number; price?: string }[] };

export type Dashboard = {
  today: number;
  this_week: number;
  this_month: number;
  awaiting_call: number;
  confirmed: number;
  processing: number;
  to_dispatch: number;
  in_transit: number;
  completed: number;
  cancelled: number;
  confirmed_orders: number;
  confirmed_value: Money;
  month_sales: Money;
  out_of_stock: number;
  low_stock: number;
  top_products: { code: number; name: string; quantity: number }[];
  series: { date: string; sales: Money }[];
  recent: { number: string; customer_name: string; city: string; total: Money; status: string; created_at: string }[];
  money?: {
    received_total: Money;
    received_month: Money;
    expenses_month: Money;
    profit_month: Money;
    outstanding: Money;
  };
};

export type StockState = 'untracked' | 'ok' | 'low' | 'out';

export type AdminProduct = {
  id: number;
  code: number;
  name: string;
  category: number;
  category_name: string;
  mrp: Money;
  discount_percent: string;
  effective_discount: string;
  offer_price: Money;
  unit: string;
  description: string;
  video_url: string;
  is_active: boolean;
  stock: number | null;
  low_stock_threshold: number;
  stock_state: StockState;
  updated_at: string;
};

export type ProductInput = Partial<
  Pick<
    AdminProduct,
    | 'code'
    | 'name'
    | 'category'
    | 'mrp'
    | 'discount_percent'
    | 'unit'
    | 'description'
    | 'video_url'
    | 'is_active'
    | 'low_stock_threshold'
  >
>;

export type AdminCategory = { id: number; name: string; slug: string; sort_order: number; is_active: boolean; product_count: number };

export type StockMovement = {
  id: number;
  product: number;
  product_code: number;
  product_name: string;
  change: number;
  balance: number;
  reason: string;
  reason_label: string;
  estimate: string | null;
  note: string;
  user: string;
  created_at: string;
};

export type Inventory = { products: number; active: number; tracked: number; out: number; low: number; units: number; mrp_value: Money };

export type StockChange = { mode: 'add' | 'remove' | 'set' | 'untrack'; quantity?: number; reason?: string; note?: string };

export type Customer = {
  id: number;
  email: string;
  first_name: string;
  phone: string;
  date_joined: string;
  last_login: string | null;
  is_active: boolean;
  orders: number;
  open_orders: number;
  purchases: Money | null;
  last_order: string | null;
  city: string;
  amount_paid?: Money;
  address?: string;
};

export type PaymentsSummary = {
  buckets: Record<'unpaid' | 'partial' | 'paid' | 'refund_due', { count: number; amount: Money }>;
  outstanding: Money;
  received: Money;
  refunded: Money;
  by_method: { method: string; amount: Money; count: number }[];
};

export type Expense = {
  id: number;
  spent_on: string;
  category: string;
  category_label: string;
  amount: Money;
  description: string;
  recorded_by: string;
  created_at: string;
};

export type Report = {
  from: string;
  to: string;
  group: 'day' | 'month' | 'year';
  rows: { period: string; orders: number; sales: Money; received: Money; expenses: Money; profit: Money }[];
  totals: { orders: number; sales: Money; received: Money; expenses: Money; profit: Money; cancelled: number };
  expenses_by_category: { category: string; label: string; amount: Money }[];
  received_by_method: { method: string; label: string; amount: Money }[];
  top_products: { code: number; name: string; quantity: number; amount: Money }[];
};

export type Offer = {
  id: number;
  name: string;
  category: number | null;
  category_name: string;
  discount_percent: string;
  starts_on: string;
  ends_on: string;
  is_active: boolean;
  is_running: boolean;
};

export type Coupon = {
  id: number;
  code: string;
  description: string;
  kind: 'percent' | 'flat';
  value: string;
  min_order: Money;
  max_discount: Money | null;
  starts_on: string | null;
  ends_on: string | null;
  usage_limit: number | null;
  is_active: boolean;
  times_used: number;
};

export type Alert = {
  id: string;
  kind: string;
  title: string;
  body: string;
  link: string;
  at: string;
  tone: 'alert' | 'warn' | 'info';
  unread: boolean;
};

export type TeamMember = {
  id: number;
  email: string;
  first_name: string;
  phone: string;
  role: 'staff' | 'admin';
  is_owner: boolean;
  is_active: boolean;
  last_login: string | null;
  date_joined: string;
};

export type AuditEntry = {
  id: number;
  user_email: string;
  action: string;
  object_type: string;
  object_id: string;
  summary: string;
  changes: Record<string, unknown>;
  ip: string | null;
  created_at: string;
};

type Params = Record<string, string | number | boolean | undefined | null>;

function qs(params: Params = {}) {
  const entries = Object.entries(params).filter(([, v]) => v !== undefined && v !== null && v !== '');
  return entries.length ? `?${new URLSearchParams(entries.map(([k, v]) => [k, String(v)]))}` : '';
}

const json = (method: string, body?: unknown): RequestInit => ({ method, body: body === undefined ? undefined : JSON.stringify(body) });
const enc = encodeURIComponent;

export const admin = {
  dashboard: () => request<Dashboard>('/admin/dashboard/'),
  notifications: () => request<{ unread: number; items: Alert[] }>('/admin/notifications/'),
  markSeen: () => request<{ unread: number }>('/admin/notifications/seen/', json('POST')),

  estimates: (p: Params = {}) => request<AdminEstimate[]>(`/admin/estimates/${qs(p)}`),
  estimate: (number: string) => request<AdminEstimate>(`/admin/estimates/${enc(number)}/`),
  updateEstimate: (number: string, patch: EstimatePatch) =>
    request<AdminEstimate>(`/admin/estimates/${enc(number)}/`, json('PATCH', patch)),

  payments: (p: Params = {}) => request<Payment[]>(`/admin/payments/${qs(p)}`),
  paymentsSummary: () => request<PaymentsSummary>('/admin/payments/summary/'),
  addPayment: (body: Partial<Payment>) => request<Payment>('/admin/payments/', json('POST', body)),
  deletePayment: (id: number) => request<void>(`/admin/payments/${id}/`, json('DELETE')),

  products: (p: Params = {}) => request<AdminProduct[]>(`/admin/products/${qs(p)}`),
  product: (id: number) => request<AdminProduct>(`/admin/products/${id}/`),
  createProduct: (body: ProductInput) => request<AdminProduct>('/admin/products/', json('POST', body)),
  updateProduct: (id: number, patch: ProductInput) => request<AdminProduct>(`/admin/products/${id}/`, json('PATCH', patch)),
  deleteProduct: (id: number) => request<void>(`/admin/products/${id}/`, json('DELETE')),
  changeStock: (id: number, body: StockChange) => request<AdminProduct>(`/admin/products/${id}/stock/`, json('POST', body)),
  inventory: () => request<Inventory>('/admin/inventory/'),
  movements: (p: Params = {}) => request<StockMovement[]>(`/admin/stock-movements/${qs(p)}`),

  categories: () => request<AdminCategory[]>('/admin/categories/'),
  createCategory: (body: Partial<AdminCategory>) => request<AdminCategory>('/admin/categories/', json('POST', body)),
  updateCategory: (id: number, patch: Partial<AdminCategory>) =>
    request<AdminCategory>(`/admin/categories/${id}/`, json('PATCH', patch)),
  deleteCategory: (id: number) => request<void>(`/admin/categories/${id}/`, json('DELETE')),

  offers: () => request<Offer[]>('/admin/offers/'),
  saveOffer: (o: Partial<Offer>) =>
    o.id ? request<Offer>(`/admin/offers/${o.id}/`, json('PATCH', o)) : request<Offer>('/admin/offers/', json('POST', o)),
  deleteOffer: (id: number) => request<void>(`/admin/offers/${id}/`, json('DELETE')),
  coupons: () => request<Coupon[]>('/admin/coupons/'),
  saveCoupon: (c: Partial<Coupon>) =>
    c.id ? request<Coupon>(`/admin/coupons/${c.id}/`, json('PATCH', c)) : request<Coupon>('/admin/coupons/', json('POST', c)),
  deleteCoupon: (id: number) => request<void>(`/admin/coupons/${id}/`, json('DELETE')),

  customers: (p: Params = {}) => request<Customer[]>(`/admin/customers/${qs(p)}`),
  customer: (id: number) => request<Customer>(`/admin/customers/${id}/`),

  expenses: (p: Params = {}) => request<Expense[]>(`/admin/expenses/${qs(p)}`),
  saveExpense: (e: Partial<Expense>) =>
    e.id ? request<Expense>(`/admin/expenses/${e.id}/`, json('PATCH', e)) : request<Expense>('/admin/expenses/', json('POST', e)),
  deleteExpense: (id: number) => request<void>(`/admin/expenses/${id}/`, json('DELETE')),
  report: (p: Params) => request<Report>(`/admin/reports/${qs(p)}`),

  settings: () => request<ShopSettings>('/admin/settings/'),
  updateSettings: (patch: Partial<ShopSettings>) => request<ShopSettings>('/admin/settings/', json('PATCH', patch)),
  team: () => request<TeamMember[]>('/admin/team/'),
  addMember: (body: { email: string; role: string; first_name?: string }) =>
    request<TeamMember>('/admin/team/', json('POST', body)),
  setRole: (id: number, role: string) => request<TeamMember>(`/admin/team/${id}/`, json('PATCH', { role })),
  removeMember: (id: number) => request<TeamMember>(`/admin/team/${id}/`, json('DELETE')),
  audit: (p: Params = {}) => request<AuditEntry[]>(`/admin/audit/${qs(p)}`),
  updateMe: (patch: { first_name?: string; phone?: string }) => request<{ first_name: string; phone: string }>('/me/', json('PATCH', patch)),
};

/** Downloads a CSV report. The API needs the login token, so a plain link won't do. */
export async function downloadReport(p: Params) {
  let res = await send(`/admin/reports/${qs(p)}`);
  if (res.status === 401) {
    // One retry through the normal path refreshes the token.
    await admin.dashboard().catch(() => undefined);
    res = await send(`/admin/reports/${qs(p)}`);
  }
  if (!res.ok) throw new ApiError(res.status, { detail: ['Could not download the report.'] });
  if (Platform.OS !== 'web') throw new ApiError(0, { detail: ['Download reports from the website on a computer.'] });
  const name = /filename="([^"]+)"/.exec(res.headers.get('Content-Disposition') ?? '')?.[1] ?? 'report.csv';
  const url = URL.createObjectURL(await res.blob());
  const a = document.createElement('a');
  a.href = url;
  a.download = name;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
