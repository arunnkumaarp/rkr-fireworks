import { useAuth } from '@/store/auth';

export const API_URL = process.env.EXPO_PUBLIC_API_URL ?? 'http://localhost:8000/api/v1';

export type Category = {
  id: number;
  name: string;
  slug: string;
  image: string | null;
  sort_order: number;
  product_count: number;
};

export type Product = {
  id: number;
  code: number;
  name: string;
  category: number;
  category_name: string;
  mrp: string;
  discount_percent: string;
  offer_price: string;
  unit: string;
  description: string;
  image: string | null;
  video_url: string;
};

export type ShopSettings = {
  shop_name: string;
  phone_primary: string;
  phone_secondary: string;
  whatsapp_number: string;
  email: string;
  address: string;
  min_order_value: string;
  packing_charge_percent: string;
  announcement: string;
  upi_id: string;
  upi_qr: string | null;
  bank_details: string;
};

export type EstimateItem = {
  code: number;
  name: string;
  unit: string;
  mrp: string;
  price: string;
  quantity: number;
  amount: string;
};

export type Estimate = {
  number: string;
  customer_name: string;
  phone: string;
  email: string;
  address: string;
  city: string;
  state: string;
  pincode: string;
  notes: string;
  items: EstimateItem[];
  mrp_total: string;
  subtotal: string;
  packing_charge: string;
  total: string;
  status: string;
  transport_name: string;
  lr_number: string;
  created_at: string;
};

export type User = {
  id: number;
  email: string;
  first_name: string;
  phone: string;
  role: 'customer' | 'admin';
};

export type EstimateInput = Pick<
  Estimate,
  'customer_name' | 'phone' | 'email' | 'address' | 'city' | 'state' | 'pincode' | 'notes'
> & { lines: { product: number; quantity: number }[] };

export type AdminEstimate = Omit<Estimate, 'items'> & { items: (EstimateItem & { id: number })[] };

export type EstimatePatch = Partial<Pick<Estimate, 'status' | 'transport_name' | 'lr_number' | 'notes'>> & {
  item_changes?: { id: number; quantity: number; price?: string }[];
};

export type Dashboard = {
  today: number;
  this_week: number;
  awaiting_call: number;
  to_dispatch: number;
  confirmed_value: string | number;
  top_products: { code: number; name: string; quantity: number }[];
};

export type AdminProduct = Pick<
  Product,
  'id' | 'code' | 'name' | 'category' | 'category_name' | 'mrp' | 'discount_percent' | 'offer_price' | 'unit'
> & { is_active: boolean };

/** Validation errors from DRF, flattened into readable messages. */
export class ApiError extends Error {
  constructor(public status: number, public fields: Record<string, string[]>) {
    super(Object.values(fields).flat().join('\n') || `Request failed (${status})`);
  }
}

function send(path: string, init?: RequestInit) {
  const { access } = useAuth.getState();
  return fetch(`${API_URL}${path}`, {
    ...init,
    headers: {
      'Content-Type': 'application/json',
      ...(access ? { Authorization: `Bearer ${access}` } : {}),
      ...init?.headers,
    },
  });
}

/** Swaps the refresh token for a new access token; signs out if it has expired. */
async function refreshAccess() {
  const { refresh, setAccess, signOut } = useAuth.getState();
  if (!refresh) {
    signOut();
    return false;
  }
  const res = await fetch(`${API_URL}/auth/refresh/`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ refresh }),
  });
  if (!res.ok) {
    signOut();
    return false;
  }
  setAccess((await res.json()).access);
  return true;
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  let res = await send(path, init);
  if (res.status === 401 && useAuth.getState().access) {
    // Refresh, or sign out on failure; either way retry once (public endpoints work signed out).
    await refreshAccess();
    res = await send(path, init);
  }
  if (!res.ok) {
    let body: unknown = {};
    try {
      body = await res.json();
    } catch {}
    const fields: Record<string, string[]> = {};
    if (body && typeof body === 'object') {
      for (const [key, value] of Object.entries(body)) {
        fields[key] = Array.isArray(value) ? value.map(String) : [String(value)];
      }
    }
    throw new ApiError(res.status, fields);
  }
  return res.json();
}

export const api = {
  categories: () => request<Category[]>('/categories/'),
  products: () => request<Product[]>('/products/'),
  settings: () => request<ShopSettings>('/settings/public/'),
  createEstimate: (input: EstimateInput) =>
    request<Estimate>('/estimates/', { method: 'POST', body: JSON.stringify(input) }),
  sendCode: (email: string) =>
    request<{ detail: string }>('/auth/otp/send/', { method: 'POST', body: JSON.stringify({ email }) }),
  verifyCode: (email: string, code: string) =>
    request<{ access: string; refresh: string; user: User }>('/auth/otp/verify/', {
      method: 'POST',
      body: JSON.stringify({ email, code }),
    }),
  myEstimates: () => request<Estimate[]>('/estimates/mine/'),
  admin: {
    dashboard: () => request<Dashboard>('/admin/dashboard/'),
    estimates: (params: { status?: string; search?: string }) => {
      const q = new URLSearchParams(Object.entries(params).filter(([, v]) => v) as [string, string][]);
      return request<Estimate[]>(`/admin/estimates/?${q}`);
    },
    estimate: (number: string) => request<AdminEstimate>(`/admin/estimates/${encodeURIComponent(number)}/`),
    updateEstimate: (number: string, patch: EstimatePatch) =>
      request<AdminEstimate>(`/admin/estimates/${encodeURIComponent(number)}/`, {
        method: 'PATCH',
        body: JSON.stringify(patch),
      }),
    products: () => request<AdminProduct[]>('/admin/products/'),
    updateProduct: (id: number, patch: Partial<Pick<AdminProduct, 'mrp' | 'discount_percent' | 'is_active'>>) =>
      request<AdminProduct>(`/admin/products/${id}/`, { method: 'PATCH', body: JSON.stringify(patch) }),
  },
  estimate: (number: string) => request<Estimate>(`/estimates/${encodeURIComponent(number)}/`),
};
