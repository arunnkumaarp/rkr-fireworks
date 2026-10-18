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

export type EstimateInput = Pick<
  Estimate,
  'customer_name' | 'phone' | 'email' | 'address' | 'city' | 'state' | 'pincode' | 'notes'
> & { lines: { product: number; quantity: number }[] };

/** Validation errors from DRF, flattened into readable messages. */
export class ApiError extends Error {
  constructor(public status: number, public fields: Record<string, string[]>) {
    super(Object.values(fields).flat().join('\n') || `Request failed (${status})`);
  }
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${API_URL}${path}`, {
    ...init,
    headers: { 'Content-Type': 'application/json', ...init?.headers },
  });
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
  estimate: (number: string, phone: string) =>
    request<Estimate>(`/estimates/${encodeURIComponent(number)}/?phone=${encodeURIComponent(phone)}`),
};
