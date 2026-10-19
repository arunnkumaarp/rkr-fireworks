import { router } from 'expo-router';
import { StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { formatRupees } from '@/lib/format';
import { useShopSettings } from '@/lib/queries';
import { cartTotals, useCart } from '@/store/cart';

import { colors, MAX_CONTENT_WIDTH, type } from './theme';
import { PressScale } from './press-scale';

export function CartBar() {
  const lines = useCart((s) => s.lines);
  const { data: shop } = useShopSettings();
  const insets = useSafeAreaInsets();
  const totals = cartTotals(lines);
  if (totals.products === 0) return null;

  const minOrder = Number(shop?.min_order_value ?? 0);
  const shortBy = minOrder - totals.subtotal;

  return (
    <View style={[styles.wrap, { paddingBottom: 10 + insets.bottom }]}>
      <View style={styles.inner}>
        <View style={styles.summary}>
          <Text style={styles.total}>{formatRupees(totals.subtotal)}</Text>
          <Text style={styles.meta}>
            {totals.products} products · You save {formatRupees(totals.savings)}
          </Text>
          {shortBy > 0 && (
            <Text style={styles.warn}>Add {formatRupees(shortBy)} more (min. order {formatRupees(minOrder)})</Text>
          )}
        </View>
        <PressScale scaleTo={0.94} accessibilityRole="button" onPress={() => router.push('/cart')} style={styles.btn}>
          <Text style={styles.btnText}>View cart</Text>
        </PressScale>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    backgroundColor: colors.purple,
    paddingTop: 10,
    paddingHorizontal: 16,
  },
  inner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    width: '100%',
    maxWidth: MAX_CONTENT_WIDTH,
    alignSelf: 'center',
  },
  summary: { flex: 1, gap: 2 },
  total: { color: colors.text, ...type.semibold, fontSize: 20, },
  meta: { color: colors.muted, ...type.regular, fontSize: 12 },
  warn: { color: colors.gold, ...type.medium, fontSize: 12, },
  btn: { backgroundColor: colors.gold, borderRadius: 999, paddingHorizontal: 18, paddingVertical: 12 },
  btnText: { color: colors.onPrimary, ...type.semibold, fontSize: 15 },
});
