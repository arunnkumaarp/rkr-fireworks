import { memo } from 'react';
import { Platform, StyleSheet, Text, View } from 'react-native';

import type { Product } from '@/lib/api';
import { formatRupees, toPaise } from '@/lib/format';

import { QtyInput } from './qty-input';
import { colors, type } from './theme';

type Props = {
  product: Product;
  quantity: number;
  onChange: (product: Product, qty: number) => void;
  /** Wide screens show the printed price list's full columns. */
  wide?: boolean;
};

export const ProductRow = memo(function ProductRow({ product, quantity, onChange, wide }: Props) {
  const amount = (toPaise(product.offer_price) * quantity) / 100;
  const amountText = quantity > 0 ? formatRupees(amount) : '';
  const qty = <QtyInput value={quantity} onChange={(q) => onChange(product, q)} label={product.name} />;

  if (wide) {
    return (
      <View style={[styles.row, quantity > 0 && styles.rowActive]}>
        <Text style={[styles.cell, styles.colCode]}>{product.code}</Text>
        <Text style={[styles.cell, styles.colName, styles.name]}>{product.name}</Text>
        <Text style={[styles.cell, styles.colMrp, styles.mrp]}>{formatRupees(product.mrp)}</Text>
        <Text style={[styles.cell, styles.colUnit]}>1 {product.unit}</Text>
        <Text style={[styles.cell, styles.colOffer, styles.offer]}>{formatRupees(product.offer_price)}</Text>
        <View style={styles.colQty}>{qty}</View>
        <Text style={[styles.cell, styles.colAmount, styles.amount]}>{amountText}</Text>
      </View>
    );
  }

  if (Platform.OS !== 'web') {
    return (
      <View style={styles.nativeCell}>
        <View style={styles.info}>
          <Text style={styles.cellName}>{product.name}</Text>
          <View style={styles.prices}>
            <Text style={styles.cellOffer}>{formatRupees(product.offer_price)}</Text>
            <Text style={styles.mrp}>{formatRupees(product.mrp)}</Text>
            <Text style={styles.unit}>
              / {product.unit} · #{product.code}
            </Text>
          </View>
          {quantity > 0 ? <Text style={styles.cellAmount}>{amountText}</Text> : null}
        </View>
        {qty}
      </View>
    );
  }

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
        {qty}
        <Text style={styles.amount}>{amountText || ' '}</Text>
      </View>
    </View>
  );
});

/** Column headings, set like the red bar at the top of each printed page. */
export function PriceListHeader() {
  return (
    <View style={styles.header}>
      <Text style={[styles.headCell, styles.colCode]}>Code</Text>
      <Text style={[styles.headCell, styles.colName]}>Name of the product</Text>
      <Text style={[styles.headCell, styles.colMrp]}>MRP</Text>
      <Text style={[styles.headCell, styles.colUnit]}>Unit</Text>
      <Text style={[styles.headCell, styles.colOffer]}>Offer price</Text>
      <Text style={[styles.headCell, styles.colQty, styles.center]}>Qty</Text>
      <Text style={[styles.headCell, styles.colAmount]}>Amount</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  nativeCell: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 16, paddingVertical: 12, minHeight: 64 },
  cellName: { ...type.regular, fontSize: 17, lineHeight: 22, color: colors.text },
  cellOffer: { ...type.semibold, fontSize: 15, color: colors.green, fontVariant: ['tabular-nums'] },
  cellAmount: { ...type.medium, fontSize: 14, color: colors.gold, fontVariant: ['tabular-nums'] },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
    paddingHorizontal: 14,
    backgroundColor: colors.surface,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border,
    gap: 12,
  },
  rowActive: { backgroundColor: colors.sectionBg },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.primary,
    borderRadius: 999,
    paddingVertical: 12,
    paddingHorizontal: 14,
    gap: 12,
  },
  headCell: { color: colors.onPrimary, ...type.semibold, fontSize: 14 },
  center: { textAlign: 'center' },
  cell: { ...type.regular, fontSize: 15, color: colors.text, fontVariant: ['tabular-nums'] },
  colCode: { width: 44 },
  colName: { flex: 1 },
  colMrp: { width: 96, textAlign: 'right' },
  colUnit: { width: 60, textAlign: 'center' },
  colOffer: { width: 100, textAlign: 'right' },
  colQty: { width: 132, alignItems: 'center' },
  colAmount: { width: 108, textAlign: 'right' },
  code: { width: 30, ...type.regular, fontSize: 13, color: colors.muted, fontVariant: ['tabular-nums'] },
  info: { flex: 1, gap: 3 },
  name: { ...type.medium, fontSize: 16, color: colors.text },
  prices: { flexDirection: 'row', alignItems: 'baseline', gap: 6, flexWrap: 'wrap' },
  mrp: { ...type.regular, fontSize: 13, color: colors.muted, textDecorationLine: 'line-through' },
  offer: { ...type.semibold, fontSize: 16, color: colors.green },
  unit: { ...type.regular, fontSize: 13, color: colors.muted },
  right: { alignItems: 'flex-end', gap: 4 },
  amount: { ...type.semibold, fontSize: 14, color: colors.text, fontVariant: ['tabular-nums'] },
});
