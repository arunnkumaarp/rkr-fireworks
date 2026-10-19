import { router, Stack, useLocalSearchParams } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Platform,
  Pressable,
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
import { Hero, PromoCard } from '@/components/hero';
import { haptic, isIOS, isNative, surface } from '@/components/native';
import { PriceListHeader, ProductRow } from '@/components/product-row';
import { ShopFooter } from '@/components/shop-footer';
import { colors, MAX_CONTENT_WIDTH, type, WIDE_BREAKPOINT } from '@/components/theme';
import type { Product } from '@/lib/api';
import { formatRupeesShort } from '@/lib/format';
import { useCategories, useProducts, useShopSettings } from '@/lib/queries';
import { cartTotals, syncCartWithCatalogue, useCart } from '@/store/cart';
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
  const totals = cartTotals(lines);

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

  const screen = (
    <Stack.Screen
      options={{
        title: 'RKR Crackers',
        headerSearchBarOptions: isNative
          ? {
              placeholder: 'Search 220 crackers or a code',
              onChangeText: (e) => setSearch(e.nativeEvent.text),
              onCancelButtonPress: () => setSearch(''),
              hideWhenScrolling: false,
              tintColor: colors.gold,
              textColor: colors.text,
              headerIconColor: colors.text,
              hintTextColor: colors.muted,
            }
          : undefined,
        headerRight: isNative && totals.products > 0 ? () => <TotalButton total={totals.subtotal} /> : undefined,
      }}
    />
  );

  if (products.isPending || categories.isPending) {
    return (
      <>
        {screen}
        <ActivityIndicator style={styles.center} size="large" color={colors.primary} />
      </>
    );
  }
  if (products.isError || categories.isError) {
    return (
      <View style={[styles.center, styles.errorBox]}>
        {screen}
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

  const chips = (
    <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chips}>
      <Chip label="All" active={categoryId === null} onPress={() => setCategoryId(null)} />
      {categories.data.map((c) => (
        <Chip key={c.id} label={c.name} active={categoryId === c.id} onPress={() => setCategoryId(c.id)} />
      ))}
    </ScrollView>
  );

  const header = isNative ? (
    <View style={styles.nativeHeader}>
      {!search ? <PromoCard shop={shop} /> : null}
      {chips}
    </View>
  ) : (
    <View>
      <Hero shop={shop} />
      <View style={styles.tools}>
        <TextInput
          value={search}
          onChangeText={setSearch}
          placeholder="Search by name or code"
          placeholderTextColor={colors.muted}
          style={styles.search}
          accessibilityLabel="Search products"
        />
        {chips}
        {wide && <PriceListHeader />}
      </View>
    </View>
  );

  return (
    <View style={styles.flex}>
      {screen}
      <SectionList
        style={styles.flex}
        contentContainerStyle={[styles.grow, isNative && styles.nativeList]}
        contentInsetAdjustmentBehavior="automatic"
        sections={sections}
        keyExtractor={(p) => String(p.id)}
        ListHeaderComponent={header}
        stickySectionHeadersEnabled={isNative}
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode="on-drag"
        initialNumToRender={24}
        renderSectionHeader={({ section }) =>
          isNative ? (
            <View style={styles.sectionHead}>
              <Text style={styles.sectionTitle} accessibilityRole="header">
                {section.title}
              </Text>
              <Text style={styles.sectionCount}>{section.data.length}</Text>
            </View>
          ) : (
            <View style={styles.page}>
              <Banner title={section.title} />
            </View>
          )
        }
        renderItem={({ item, index, section }) => (
          <View
            style={
              isNative
                ? [styles.cell, index === 0 && styles.cellFirst, index === section.data.length - 1 && styles.cellLast]
                : styles.page
            }>
            {isNative && index > 0 ? <View style={styles.separator} /> : null}
            <ProductRow product={item} quantity={lines[item.id]?.quantity ?? 0} onChange={setQuantity} wide={wide} />
          </View>
        )}
        ListEmptyComponent={<Text style={styles.empty}>No crackers match “{search}”.</Text>}
        ListFooterComponent={
          isNative ? (
            <Text style={styles.footnote}>Prices include 80% off MRP. Transport is paid at your nearest office.</Text>
          ) : (
            <View style={styles.footer}>
              <ShopFooter shop={shop} />
            </View>
          )
        }
      />
      {isNative ? null : <CartBar />}
    </View>
  );
}

/** Header button with the running total; opens the cart tab. */
function TotalButton({ total }: { total: number }) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`Cart total ${total}. Open cart`}
      onPress={() => router.navigate('/cart')}
      hitSlop={8}
      style={({ pressed }) => [styles.total, pressed && { opacity: 0.7 }]}>
      <Text style={styles.totalText}>{formatRupeesShort(total)}</Text>
    </Pressable>
  );
}

function Chip({ label, active, onPress }: { label: string; active: boolean; onPress: () => void }) {
  return (
    <PressScale
      scaleTo={0.94}
      accessibilityRole="button"
      accessibilityState={{ selected: active }}
      onPress={() => {
        haptic.select();
        onPress();
      }}
      style={[styles.chip, active && styles.chipActive]}>
      <Text style={[styles.chipText, active && styles.chipTextActive]}>{label}</Text>
    </PressScale>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1, backgroundColor: colors.background },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  errorBox: { padding: 24, gap: 16 },
  errorText: { ...type.regular, fontSize: 16, color: colors.text, textAlign: 'center' },
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
    ...type.regular,
    color: colors.text,
  },
  nativeHeader: { gap: 16, paddingTop: 8, paddingBottom: 4 },
  nativeList: { paddingHorizontal: 16, paddingBottom: 32 },
  chips: { gap: 8, paddingRight: 16 },
  chip: { paddingHorizontal: 16, height: 36, justifyContent: 'center', borderRadius: isIOS ? 18 : 8, backgroundColor: surface.group },
  chipActive: { backgroundColor: colors.primary },
  chipText: { ...type.medium, fontSize: 15, color: colors.text },
  chipTextActive: { color: colors.onPrimary },
  sectionHead: { flexDirection: 'row', alignItems: 'baseline', gap: 8, paddingTop: 22, paddingBottom: 8, backgroundColor: colors.background },
  sectionTitle: { ...type.semibold, fontSize: 20, color: colors.text, flexShrink: 1 },
  sectionCount: { ...type.regular, fontSize: 15, color: surface.secondary },
  cell: { backgroundColor: surface.group },
  cellFirst: { borderTopLeftRadius: 14, borderTopRightRadius: 14 },
  cellLast: { borderBottomLeftRadius: 14, borderBottomRightRadius: 14 },
  separator: { height: StyleSheet.hairlineWidth, backgroundColor: surface.separator, marginLeft: 16 },
  empty: { padding: 24, textAlign: 'center', color: colors.muted, ...type.regular, fontSize: 16 },
  footnote: { color: surface.secondary, ...type.regular, fontSize: 13, textAlign: 'center', paddingTop: 24 },
  total: { backgroundColor: colors.primary, borderRadius: 16, paddingHorizontal: 12, height: 32, justifyContent: 'center' },
  totalText: { color: colors.onPrimary, ...type.semibold, fontSize: 15, fontVariant: ['tabular-nums'] },
  grow: { flexGrow: 1 },
  footer: { marginTop: 'auto', paddingTop: 48 },
});
