import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { memo, useMemo, useState } from 'react';
import { FlatList, StyleSheet, Switch, Text, TextInput, View } from 'react-native';

import { colors } from '@/components/theme';
import { api, type AdminProduct } from '@/lib/api';
import { formatRupees } from '@/lib/format';

const KEY = ['admin', 'products'];

export default function AdminProducts() {
  const products = useQuery({ queryKey: KEY, queryFn: api.admin.products });
  const [search, setSearch] = useState('');

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return (products.data ?? []).filter((p) => !q || p.name.toLowerCase().includes(q) || String(p.code) === q);
  }, [products.data, search]);

  return (
    <FlatList
      contentContainerStyle={styles.container}
      data={filtered}
      keyExtractor={(p) => String(p.id)}
      keyboardShouldPersistTaps="handled"
      ListHeaderComponent={
        <View style={styles.header}>
          <TextInput
            value={search}
            onChangeText={setSearch}
            placeholder="Search by name or code"
            placeholderTextColor={colors.muted}
            style={styles.search}
            accessibilityLabel="Search products"
          />
          <Text style={styles.hint}>Edit the MRP and press done to save. Switch off products that are out of stock.</Text>
        </View>
      }
      ListEmptyComponent={<Text style={styles.hint}>{products.isPending ? 'Loading…' : 'No products found.'}</Text>}
      renderItem={({ item }) => <ProductEditor product={item} />}
    />
  );
}

const ProductEditor = memo(function ProductEditor({ product }: { product: AdminProduct }) {
  const queryClient = useQueryClient();
  const [mrp, setMrp] = useState(product.mrp);
  const update = useMutation({
    mutationFn: (patch: Parameters<typeof api.admin.updateProduct>[1]) => api.admin.updateProduct(product.id, patch),
    onSuccess: (saved) => {
      queryClient.setQueryData<AdminProduct[]>(KEY, (list) => list?.map((p) => (p.id === saved.id ? saved : p)));
      setMrp(saved.mrp);
      // The public price list must show the new price.
      queryClient.invalidateQueries({ queryKey: ['products'] });
    },
    onError: () => setMrp(product.mrp),
  });

  const saveMrp = () => {
    const value = Number(mrp);
    if (!Number.isFinite(value) || value <= 0 || value.toFixed(2) === Number(product.mrp).toFixed(2)) {
      setMrp(product.mrp);
      return;
    }
    update.mutate({ mrp: value.toFixed(2) });
  };

  return (
    <View style={[styles.row, !product.is_active && styles.inactive]}>
      <View style={styles.info}>
        <Text style={styles.name}>
          {product.code}. {product.name}
        </Text>
        <Text style={styles.meta}>
          {product.category_name} · offer {formatRupees(product.offer_price)} / {product.unit}
        </Text>
        {update.error ? <Text style={styles.error}>{update.error.message}</Text> : null}
      </View>
      <TextInput
        value={mrp}
        onChangeText={(t) => setMrp(t.replace(/[^\d.]/g, ''))}
        onEndEditing={saveMrp}
        onBlur={saveMrp}
        keyboardType="decimal-pad"
        returnKeyType="done"
        editable={!update.isPending}
        style={styles.mrp}
        accessibilityLabel={`MRP of ${product.name}`}
      />
      <Switch
        value={product.is_active}
        onValueChange={(is_active) => update.mutate({ is_active })}
        disabled={update.isPending}
        trackColor={{ true: colors.green }}
        accessibilityLabel={`${product.name} on sale`}
      />
    </View>
  );
});

const styles = StyleSheet.create({
  container: { padding: 16, gap: 8, width: '100%', maxWidth: 720, alignSelf: 'center' },
  header: { gap: 8, marginBottom: 6 },
  search: {
    height: 44,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: colors.border,
    paddingHorizontal: 12,
    fontSize: 16,
    color: colors.text,
    backgroundColor: colors.surface,
  },
  hint: { fontSize: 14, color: colors.muted },
  row: { flexDirection: 'row', alignItems: 'center', gap: 10, backgroundColor: colors.surfaceAlt, borderRadius: 12, padding: 12 },
  inactive: { opacity: 0.55 },
  info: { flex: 1, gap: 2 },
  name: { fontSize: 15, fontWeight: '600', color: colors.text },
  meta: { fontSize: 13, color: colors.muted },
  error: { fontSize: 13, color: colors.danger },
  mrp: {
    width: 96,
    height: 38,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: colors.border,
    paddingHorizontal: 10,
    fontSize: 15,
    textAlign: 'right',
    color: colors.text,
    backgroundColor: colors.surface,
    fontVariant: ['tabular-nums'],
  },
});
