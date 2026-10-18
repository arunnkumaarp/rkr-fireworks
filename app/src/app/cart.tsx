import { router } from 'expo-router';
import { ScrollView, StyleSheet, Text, View } from 'react-native';

import { Button } from '@/components/button';
import { ProductRow } from '@/components/product-row';
import { colors, MAX_CONTENT_WIDTH, fonts } from '@/components/theme';
import { formatRupees } from '@/lib/format';
import { useShopSettings } from '@/lib/queries';
import { cartTotals, useCart } from '@/store/cart';

export default function CartScreen() {
  const lines = useCart((s) => s.lines);
  const setQuantity = useCart((s) => s.setQuantity);
  const clear = useCart((s) => s.clear);
  const { data: shop } = useShopSettings();

  const items = Object.values(lines).sort((a, b) => a.product.code - b.product.code);
  const totals = cartTotals(lines, Number(shop?.packing_charge_percent ?? 0));
  const minOrder = Number(shop?.min_order_value ?? 0);
  const shortBy = minOrder - totals.subtotal;

  if (items.length === 0) {
    return (
      <View style={styles.emptyWrap}>
        <Text style={styles.emptyTitle}>Your cart is empty</Text>
        <Text style={styles.emptySub}>Add quantities from the price list to build your estimate.</Text>
        <Button title="Browse price list" onPress={() => router.replace('/')} />
      </View>
    );
  }

  return (
    <ScrollView contentContainerStyle={styles.container}>
      <View style={styles.card}>
        {items.map(({ product, quantity }) => (
          <ProductRow key={product.id} product={product} quantity={quantity} onChange={setQuantity} />
        ))}
      </View>

      <View style={[styles.card, styles.totals]}>
        <Row label={`MRP total (${totals.count} items)`} value={formatRupees(totals.mrp)} strike />
        <Row label="You save (80%)" value={`− ${formatRupees(totals.savings)}`} highlight />
        <Row label="Subtotal" value={formatRupees(totals.subtotal)} />
        {totals.packing > 0 && (
          <Row label={`Packing (${Number(shop?.packing_charge_percent)}%)`} value={formatRupees(totals.packing)} />
        )}
        <View style={styles.divider} />
        <Row label="Estimate total" value={formatRupees(totals.total)} bold />
        <Text style={styles.note}>Transport charges are paid at delivery, as per your transport office.</Text>
      </View>

      {shortBy > 0 && (
        <Text style={styles.warn}>
          Minimum order is {formatRupees(minOrder)}. Add {formatRupees(shortBy)} more to continue.
        </Text>
      )}

      <Button title="Continue to checkout" disabled={shortBy > 0} onPress={() => router.push('/checkout')} />
      <Button title="Clear cart" variant="secondary" onPress={clear} />
    </ScrollView>
  );
}

function Row({ label, value, bold, strike, highlight }: {
  label: string; value: string; bold?: boolean; strike?: boolean; highlight?: boolean;
}) {
  return (
    <View style={styles.row}>
      <Text style={[styles.rowLabel, bold && styles.bold]}>{label}</Text>
      <Text style={[styles.rowValue, bold && styles.bold, strike && styles.strike, highlight && styles.highlight]}>
        {value}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { padding: 16, gap: 16, width: '100%', maxWidth: MAX_CONTENT_WIDTH, alignSelf: 'center' },
  card: { backgroundColor: colors.surfaceAlt, borderRadius: 14, overflow: 'hidden' },
  totals: { padding: 16, gap: 10 },
  row: { flexDirection: 'row', justifyContent: 'space-between', gap: 12 },
  rowLabel: { fontFamily: fonts.text, fontSize: 15, color: colors.muted },
  rowValue: { fontFamily: fonts.text, fontSize: 15, color: colors.text, fontVariant: ['tabular-nums'] },
  bold: { fontFamily: fonts.textBold, fontSize: 18, color: colors.text },
  strike: { textDecorationLine: 'line-through', color: colors.muted },
  highlight: { color: colors.green, fontFamily: fonts.textBold },
  divider: { height: 1, backgroundColor: colors.border },
  note: { fontFamily: fonts.text, fontSize: 12, color: colors.muted },
  warn: { color: colors.danger, fontFamily: fonts.textSemi, textAlign: 'center' },
  emptyWrap: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24, gap: 12 },
  emptyTitle: { fontFamily: fonts.textBold, fontSize: 20, color: colors.text },
  emptySub: { fontFamily: fonts.text, fontSize: 15, color: colors.muted, textAlign: 'center', marginBottom: 8 },
});
