export const STATUSES = ['submitted', 'confirmed', 'paid', 'packed', 'dispatched', 'delivered', 'cancelled'] as const;

export const STATUS_LABEL: Record<string, string> = {
  submitted: 'Waiting for our call',
  confirmed: 'Confirmed',
  paid: 'Payment received',
  packed: 'Packed',
  dispatched: 'Dispatched',
  delivered: 'Delivered',
  cancelled: 'Cancelled',
};

/** Shorter wording for the shop's own screens. */
export const ADMIN_STATUS_LABEL: Record<string, string> = { ...STATUS_LABEL, submitted: 'New', paid: 'Paid' };

export type Tone = 'gold' | 'green' | 'blue' | 'red' | 'neutral' | 'amber';

export const STATUS_TONE: Record<string, Tone> = {
  submitted: 'gold',
  confirmed: 'blue',
  paid: 'blue',
  packed: 'amber',
  dispatched: 'amber',
  delivered: 'green',
  cancelled: 'red',
};

/** Groups of statuses the order list filters by; the API understands the same keys. */
export const STAGES: { value: string; label: string }[] = [
  { value: 'open', label: 'Pending' },
  { value: 'new', label: 'New' },
  { value: 'confirmed', label: 'Confirmed' },
  { value: 'processing', label: 'Processing' },
  { value: 'dispatched', label: 'Dispatched' },
  { value: 'completed', label: 'Completed' },
  { value: 'cancelled', label: 'Cancelled' },
  { value: '', label: 'All' },
];

export const PAYMENT_LABEL: Record<string, string> = {
  unpaid: 'Unpaid',
  partial: 'Part paid',
  paid: 'Paid',
  refund_due: 'Refund due',
  closed: 'Closed',
};

export const PAYMENT_TONE: Record<string, Tone> = {
  unpaid: 'red',
  partial: 'amber',
  paid: 'green',
  refund_due: 'red',
  closed: 'neutral',
};

export const METHODS: { value: string; label: string }[] = [
  { value: 'upi', label: 'UPI' },
  { value: 'cash', label: 'Cash' },
  { value: 'bank', label: 'Bank transfer' },
  { value: 'card', label: 'Card' },
  { value: 'cheque', label: 'Cheque' },
  { value: 'other', label: 'Other' },
];

export const METHOD_LABEL = Object.fromEntries(METHODS.map((m) => [m.value, m.label]));

export const EXPENSE_CATEGORIES: { value: string; label: string }[] = [
  { value: 'stock', label: 'Stock purchase' },
  { value: 'transport', label: 'Transport' },
  { value: 'packing', label: 'Packing material' },
  { value: 'wages', label: 'Wages' },
  { value: 'rent', label: 'Rent' },
  { value: 'utilities', label: 'Power, phone, internet' },
  { value: 'marketing', label: 'Marketing' },
  { value: 'licence', label: 'Licences and fees' },
  { value: 'other', label: 'Other' },
];

export const STOCK_LABEL: Record<string, string> = { untracked: 'Not tracked', ok: 'In stock', low: 'Low', out: 'Out of stock' };
export const STOCK_TONE: Record<string, Tone> = { untracked: 'neutral', ok: 'green', low: 'amber', out: 'red' };
