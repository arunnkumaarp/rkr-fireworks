import { useLocalSearchParams } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Platform,
  ScrollView,
  SectionList,
  StyleSheet,
  Text,
  TextInput,
  useWindowDimensions,
  View,
} from 'react-native';

import { Banner } from '@/components/banner';
import { Button } from '@/components/button';
import { CartBar } from '@/components/cart-bar';
import { Hero } from '@/components/hero';
import { PriceListHeader, ProductRow } from '@/components/product-row';
import { ShopFooter } from '@/components/shop-footer';
import { colors, fonts, MAX_CONTENT_WIDTH, WIDE_BREAKPOINT } from '@/components/theme';
import type { Product } from '@/lib/api';
import { useCategories, useProducts, useShopSettings } from '@/lib/queries';
import { syncCartWithCatalogue, useCart } from '@/store/cart';
import { PressScale } from '@/components/press-scale';

export default function PriceListScreen() {
  // On the web the public price list is the website at "/"; this screen serves the mobile apps.
  if (Platform.OS === 'web' && typeof window !== 'undefined' && !__DEV__) {
    window.location.replace('/');
    return null;
  }
  return <PriceList />;
}

function PriceList() {
  const products = useProducts();
  const categories = useCategories();
  const { data: shop } = useShopSettings();
  const lines = useCart((s) => s.lines);
  const setQuantity = useCart((s) => s.setQuantity);
  // ?q= pre-fills the search, so a link can open the list at e.g. gift boxes.
  const { q } = useLocalSearchParams<{ q?: string }>();
  const [search, setSearch] = useState(q ?? '');
  const [categoryId, setCategoryId] = useState<number | null>(null);
  const wide = useWindowDimensions().width >= WIDE_BREAKPOINT;

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
      .map((c) => ({
        key: String(c.id),
        title: c.name,
        data: products.data.filter((p) => p.category === c.id && matches(p)),
      }))
      .filter((s) => s.data.length > 0);
  }, [products.data, categories.data, search, categoryId]);

  if (products.isPending || categories.isPending) {
    return <ActivityIndicator style={styles.center} size="large" color={colors.primary} />;
  }
  if (products.isError || categories.isError) {
    return (
      <View style={[styles.center, styles.errorBox]}>
        <Text style={styles.errorText}>Could not load the price list. Check your connection.</Text>
        <Button
          title="Try again"
          onPress={() => {
            products.refetch();
            categories.refetch();
          }}
        />
      </View>
    );
  }

  const header = (
    <View>
      <Hero shop={shop} />
      <View style={styles.tools}>
        <TextInput
          value={search}
          onChangeText={setSearch}
          placeholder="Search by name or code"
          placeholderTextColor={colors.muted}
          style={styles.search}
          clearButtonMode="while-editing"
          accessibilityLabel="Search products"
        />
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chips}>
          <Chip label="All" active={categoryId === null} onPress={() => setCategoryId(null)} />
          {categories.data.map((c) => (
            <Chip key={c.id} label={c.name} active={categoryId === c.id} onPress={() => setCategoryId(c.id)} />
          ))}
        </ScrollView>
        {wide && <PriceListHeader />}
      </View>
    </View>
  );

  return (
    <View style={styles.flex}>
      <SectionList
        style={styles.flex}
        contentContainerStyle={styles.grow}
        sections={sections}
        keyExtractor={(p) => String(p.id)}
        ListHeaderComponent={header}
        stickySectionHeadersEnabled={false}
        keyboardShouldPersistTaps="handled"
        initialNumToRender={30}
        renderSectionHeader={({ section }) => (
          <View style={styles.page}>
            <Banner title={section.title} />
          </View>
        )}
        renderItem={({ item }) => (
          <View style={styles.page}>
            <ProductRow product={item} quantity={lines[item.id]?.quantity ?? 0} onChange={setQuantity} wide={wide} />
          </View>
        )}
        ListEmptyComponent={<Text style={styles.empty}>No products match “{search}”.</Text>}
        ListFooterComponent={
          <View style={styles.footer}>
            <ShopFooter shop={shop} />
          </View>
        }
      />
      <CartBar />
    </View>
  );
}

function Chip({ label, active, onPress }: { label: string; active: boolean; onPress: () => void }) {
  return (
    <PressScale scaleTo={0.94}
      accessibilityRole="button"
      accessibilityState={{ selected: active }}
      onPress={onPress}
      style={[styles.chip, active && styles.chipActive]}>
      <Text style={[styles.chipText, active && styles.chipTextActive]}>{label}</Text>
    </PressScale>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  errorBox: { padding: 24, gap: 16 },
  errorText: { fontFamily: fonts.text, fontSize: 16, color: colors.text, textAlign: 'center' },
  page: { width: '100%', maxWidth: MAX_CONTENT_WIDTH, alignSelf: 'center' },
  tools: { width: '100%', maxWidth: MAX_CONTENT_WIDTH, alignSelf: 'center', padding: 16, gap: 12 },
  search: {
    height: 48,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    paddingHorizontal: 14,
    fontSize: 16,
    fontFamily: fonts.text,
    color: colors.text,
  },
  chips: { gap: 8 },
  chip: { paddingHorizontal: 14, paddingVertical: 9, borderRadius: 999, backgroundColor: colors.surfaceAlt },
  chipActive: { backgroundColor: colors.primary },
  chipText: { fontFamily: fonts.textSemi, fontSize: 14, color: colors.text },
  chipTextActive: { color: colors.onPrimary },
  empty: { padding: 24, textAlign: 'center', color: colors.muted, fontFamily: fonts.text },
  grow: { flexGrow: 1 },
  footer: { marginTop: 'auto', paddingTop: 48 },
});
