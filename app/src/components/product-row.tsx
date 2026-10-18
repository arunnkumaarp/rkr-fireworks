import { memo } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import type { Product } from '@/lib/api';
import { formatRupees, toPaise } from '@/lib/format';

import { QtyInput } from './qty-input';
import { colors } from './theme';

type Props = { product: Product; quantity: number; onChange: (product: Product, qty: number) => void };

export const ProductRow = memo(function ProductRow({ product, quantity, onChange }: Props) {
  const amount = (toPaise(product.offer_price) * quantity) / 100;
  return (
    <View style={[styles.row, quantity > 0 && styles.rowActive]}>
      <Text style={styles.code}>{product.code}</Text>
      <View style={styles.info}>
        <Text style={styles.name}>{product.name}</Text>
        <View style={styles.prices}>
          <Text style={styles.mrp}>{formatRupees(product.mrp)}</Text>
          <Text style={styles.offer}>{formatRupees(product.offer_price)}</Text>
          <Text style={styles.unit}>/ {product.unit}</Text>
        </View>
      </View>
      <View style={styles.right}>
        <QtyInput value={quantity} onChange={(q) => onChange(product, q)} label={product.name} />
        <Text style={[styles.amount, quantity === 0 && styles.amountEmpty]}>
          {quantity > 0 ? formatRupees(amount) : ' '}
        </Text>
      </View>
    </View>
  );
});

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
    paddingHorizontal: 12,
    backgroundColor: colors.surface,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border,
    gap: 10,
  },
  rowActive: { backgroundColor: '#FFF6E0' },
  code: { width: 30, fontSize: 12, color: colors.muted, fontVariant: ['tabular-nums'] },
  info: { flex: 1, gap: 3 },
  name: { fontSize: 15, fontWeight: '600', color: colors.text },
  prices: { flexDirection: 'row', alignItems: 'baseline', gap: 6, flexWrap: 'wrap' },
  mrp: { fontSize: 12, color: colors.muted, textDecorationLine: 'line-through' },
  offer: { fontSize: 15, fontWeight: '700', color: colors.green },
  unit: { fontSize: 12, color: colors.muted },
  right: { alignItems: 'flex-end', gap: 4 },
  amount: { fontSize: 13, fontWeight: '700', color: colors.text, fontVariant: ['tabular-nums'] },
  amountEmpty: { color: 'transparent' },
});
