import { router, Stack } from 'expo-router';
import { ScrollView, StyleSheet, Text, View } from 'react-native';

import { Button } from '@/components/button';
import { confirmNative, haptic, isNative, ListRow, ListSection, surface } from '@/components/native';
import { ProductRow } from '@/components/product-row';
import { colors, MAX_CONTENT_WIDTH, type } from '@/components/theme';
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
  const screen = (
    <Stack.Screen
      options={{
        title: isNative ? 'Cart' : 'Your cart',
        headerRight:
          isNative && items.length
            ? () => (
                <Text
                  accessibilityRole="button"
                  onPress={async () => {
                    if (await confirmNative('Empty the cart?', 'Every product is removed.', 'Empty')) {
                      haptic.warning();
                      clear();
                    }
                  }}
                  style={styles.headerAction}>
                  Clear
                </Text>
              )
            : undefined,
      }}
    />
  );

  if (items.length === 0) {
    return (
      <View style={styles.emptyWrap}>
        {screen}
        <Text style={styles.emptyTitle}>Your cart is empty</Text>
        <Text style={styles.emptySub}>Add quantities from the price list to build your estimate.</Text>
        <Button title="Browse the price list" onPress={() => router.navigate('/')} />
      </View>
    );
  }

  const checkout = (
    <>
      {shortBy > 0 && (
        <Text style={styles.warn}>
          Minimum order is {formatRupees(minOrder)}. Add {formatRupees(shortBy)} more to continue.
        </Text>
      )}
      <Button title="Continue to checkout" disabled={shortBy > 0} onPress={() => router.push('/checkout')} />
    </>
  );

  return (
    <View style={styles.flex}>
      {screen}
      <ScrollView contentContainerStyle={styles.container} contentInsetAdjustmentBehavior="automatic">
        <ListSection title={`${totals.products} products · ${totals.count} items`}>
          {items.map(({ product, quantity }) => (
            <ProductRow key={product.id} product={product} quantity={quantity} onChange={setQuantity} />
          ))}
        </ListSection>
        <ListSection footer="Transport charges are paid at delivery, at your transport office.">
          <ListRow title={`MRP total`} value={formatRupees(totals.mrp)} />
          <ListRow title="You save (80%)" accessory={<Text style={styles.save}>− {formatRupees(totals.savings)}</Text>} />
          {totals.packing > 0 ? <ListRow title={`Packing (${Number(shop?.packing_charge_percent)}%)`} value={formatRupees(totals.packing)} /> : null}
          <ListRow title="Estimate total" accessory={<Text style={styles.total}>{formatRupees(totals.total)}</Text>} />
        </ListSection>
        {isNative ? null : (
          <>
            {checkout}
            <Button title="Clear cart" variant="secondary" onPress={clear} />
          </>
        )}
      </ScrollView>
      {/* On phones the action stays in reach, above the tab bar. */}
      {isNative ? <View style={styles.dock}>{checkout}</View> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1, backgroundColor: colors.background },
  container: { padding: 16, gap: 24, width: '100%', maxWidth: MAX_CONTENT_WIDTH, alignSelf: 'center' },
  save: { ...type.medium, fontSize: 17, color: colors.green, fontVariant: ['tabular-nums'] },
  total: { ...type.semibold, fontSize: 20, color: colors.text, fontVariant: ['tabular-nums'] },
  warn: { color: colors.danger, ...type.medium, fontSize: 14, textAlign: 'center' },
  dock: { paddingHorizontal: 16, paddingTop: 10, paddingBottom: 12, gap: 8, backgroundColor: colors.background },
  headerAction: { color: colors.gold, ...type.regular, fontSize: 17, paddingHorizontal: 4 },
  emptyWrap: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 32, gap: 12, backgroundColor: colors.background },
  emptyTitle: { ...type.semibold, fontSize: 22, color: colors.text },
  emptySub: { ...type.regular, fontSize: 16, color: surface.secondary, textAlign: 'center', marginBottom: 8, lineHeight: 22 },
});
