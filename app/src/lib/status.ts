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
export const ADMIN_STATUS_LABEL: Record<string, string> = { ...STATUS_LABEL, submitted: 'New' };
