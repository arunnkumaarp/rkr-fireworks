import { useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Linking,
  Pressable,
  ScrollView,
  SectionList,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';

import { Button } from '@/components/button';
import { CartBar } from '@/components/cart-bar';
import { ProductRow } from '@/components/product-row';
import { colors, MAX_CONTENT_WIDTH } from '@/components/theme';
import type { Product } from '@/lib/api';
import { useCategories, useProducts, useShopSettings } from '@/lib/queries';
import { syncCartWithCatalogue, useCart } from '@/store/cart';

export default function QuickOrderScreen() {
  const products = useProducts();
  const categories = useCategories();
  const { data: shop } = useShopSettings();
  const lines = useCart((s) => s.lines);
  const setQuantity = useCart((s) => s.setQuantity);
  const [search, setSearch] = useState('');
  const [categoryId, setCategoryId] = useState<number | null>(null);

  useEffect(() => {
    if (products.data) syncCartWithCatalogue(products.data);
  }, [products.data]);

  const sections = useMemo(() => {
    if (!products.data || !categories.data) return [];
    const q = search.trim().toLowerCase();
    const matches = (p: Product) =>
      (categoryId === null || p.category === categoryId) &&
      (!q || p.name.toLowerCase().includes(q) || String(p.code) === q);
    return categories.data
      .map((c) => ({ key: String(c.id), title: c.name, data: products.data.filter(matches).filter((p) => p.category === c.id) }))
      .filter((s) => s.data.length > 0);
  }, [products.data, categories.data, search, categoryId]);

  if (products.isPending || categories.isPending) {
    return <ActivityIndicator style={styles.center} size="large" color={colors.primary} />;
  }
  if (products.isError || categories.isError) {
    return (
      <View style={[styles.center, styles.errorBox]}>
        <Text style={styles.errorText}>Could not load the price list. Check your connection.</Text>
        <Button title="Try again" onPress={() => { products.refetch(); categories.refetch(); }} />
      </View>
    );
  }

  const header = (
    <View>
      <View style={styles.hero}>
        <Text style={styles.heroTitle}>{shop?.shop_name ?? 'RKR Crackers'}</Text>
        <Text style={styles.heroOffer}>{shop?.announcement || '80% off every cracker'}</Text>
        <Text style={styles.heroSub}>
          Fill in quantities and send your estimate. We'll call to confirm the order.
          {shop ? ` Minimum order ₹${Number(shop.min_order_value).toLocaleString('en-IN')}.` : ''}
        </Text>
        {shop?.phone_primary ? (
          <Pressable onPress={() => Linking.openURL(`tel:${shop.phone_primary}`)}>
            <Text style={styles.heroPhone}>
              Call {shop.phone_primary}
              {shop.phone_secondary ? ` · ${shop.phone_secondary}` : ''}
            </Text>
          </Pressable>
        ) : null}
      </View>
      <View style={styles.searchWrap}>
        <TextInput
          value={search}
          onChangeText={setSearch}
          placeholder="Search by name or code"
          placeholderTextColor={colors.muted}
          style={styles.search}
          clearButtonMode="while-editing"
          accessibilityLabel="Search products"
        />
      </View>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chips}>
        <Chip label="All" active={categoryId === null} onPress={() => setCategoryId(null)} />
        {categories.data.map((c) => (
          <Chip key={c.id} label={c.name} active={categoryId === c.id} onPress={() => setCategoryId(c.id)} />
        ))}
      </ScrollView>
    </View>
  );

  return (
    <View style={styles.flex}>
      <SectionList
        style={styles.flex}
        contentContainerStyle={styles.list}
        sections={sections}
        keyExtractor={(p) => String(p.id)}
        ListHeaderComponent={header}
        stickySectionHeadersEnabled
        keyboardShouldPersistTaps="handled"
        renderSectionHeader={({ section }) => (
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>{section.title}</Text>
          </View>
        )}
        renderItem={({ item }) => (
          <ProductRow product={item} quantity={lines[item.id]?.quantity ?? 0} onChange={setQuantity} />
        )}
        ListEmptyComponent={<Text style={styles.empty}>No products match “{search}”.</Text>}
        ListFooterComponent={
          <Text style={styles.footer}>
            Prices include an 80% discount on MRP. Firecrackers are delivered only where sale is permitted.
            Please follow safety guidelines and local timing rules.
          </Text>
        }
      />
      <CartBar />
    </View>
  );
}

function Chip({ label, active, onPress }: { label: string; active: boolean; onPress: () => void }) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ selected: active }}
      onPress={onPress}
      style={[styles.chip, active && styles.chipActive]}>
      <Text style={[styles.chipText, active && styles.chipTextActive]}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  errorBox: { padding: 24, gap: 16 },
  errorText: { fontSize: 16, color: colors.text, textAlign: 'center' },
  list: { width: '100%', maxWidth: MAX_CONTENT_WIDTH, alignSelf: 'center', paddingBottom: 24 },
  hero: { backgroundColor: colors.purple, paddingHorizontal: 20, paddingVertical: 28, gap: 8 },
  heroTitle: { color: '#fff', fontSize: 18, fontWeight: '700' },
  heroOffer: { color: colors.gold, fontSize: 44, lineHeight: 46, fontWeight: '800', letterSpacing: -1 },
  heroSub: { color: '#fff', fontSize: 16, lineHeight: 23, maxWidth: 560 },
  heroPhone: { color: '#fff', fontSize: 15, fontWeight: '700', marginTop: 4, textDecorationLine: 'underline' },
  searchWrap: { padding: 12, backgroundColor: colors.background },
  search: {
    height: 44,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    paddingHorizontal: 14,
    fontSize: 16,
    color: colors.text,
  },
  chips: { paddingHorizontal: 12, paddingBottom: 12, gap: 8 },
  chip: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 999,
    backgroundColor: colors.surfaceAlt,
  },
  chipActive: { backgroundColor: colors.primary },
  chipText: { fontSize: 14, fontWeight: '600', color: colors.text },
  chipTextActive: { color: '#fff' },
  sectionHeader: { backgroundColor: colors.sectionBg, paddingHorizontal: 12, paddingVertical: 10 },
  sectionTitle: { fontSize: 17, fontWeight: '800', color: colors.primaryDark },
  empty: { padding: 24, textAlign: 'center', color: colors.muted },
  footer: { padding: 16, fontSize: 13, color: colors.muted, lineHeight: 18, textAlign: 'center' },
});
