import AsyncStorage from '@react-native-async-storage/async-storage';
import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';

import type { Product } from '@/lib/api';
import { toPaise } from '@/lib/format';

export type CartLine = { product: Product; quantity: number };

type CartState = {
  lines: Record<number, CartLine>;
  setQuantity: (product: Product, quantity: number) => void;
  clear: () => void;
};

export const MAX_QTY = 999;

export const useCart = create<CartState>()(
  persist(
    (set) => ({
      lines: {},
      setQuantity: (product, quantity) =>
        set((state) => {
          const lines = { ...state.lines };
          const qty = Math.min(Math.max(Math.floor(quantity) || 0, 0), MAX_QTY);
          if (qty === 0) delete lines[product.id];
          else lines[product.id] = { product, quantity: qty };
          return { lines };
        }),
      clear: () => set({ lines: {} }),
    }),
    { name: 'rkr-cart', storage: createJSONStorage(() => AsyncStorage) },
  ),
);

export function cartTotals(lines: Record<number, CartLine>, packingPercent = 0) {
  let mrp = 0;
  let subtotal = 0;
  let count = 0;
  for (const { product, quantity } of Object.values(lines)) {
    mrp += toPaise(product.mrp) * quantity;
    subtotal += toPaise(product.offer_price) * quantity;
    count += quantity;
  }
  const packing = Math.round((subtotal * packingPercent) / 100);
  return {
    count,
    products: Object.keys(lines).length,
    mrp: mrp / 100,
    subtotal: subtotal / 100,
    savings: (mrp - subtotal) / 100,
    packing: packing / 100,
    total: (subtotal + packing) / 100,
  };
}

/**
 * Keeps cart lines in step with the latest catalogue: refreshes prices and drops
 * products that are no longer sold, so the estimate the server builds matches the screen.
 */
export function syncCartWithCatalogue(products: Product[]) {
  const byId = new Map(products.map((p) => [p.id, p]));
  useCart.setState((state) => {
    const lines: Record<number, CartLine> = {};
    for (const line of Object.values(state.lines)) {
      const fresh = byId.get(line.product.id);
      if (fresh) lines[fresh.id] = { product: fresh, quantity: line.quantity };
    }
    return { lines };
  });
}
