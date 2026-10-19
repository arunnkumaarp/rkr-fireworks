import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { router } from 'expo-router';
import { useMemo, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { admin as tone, Btn, Chips, ErrorText, Page, Pill, SearchBox, Table, Toggle } from '@/components/admin/ui';
import { type } from '@/components/theme';
import { admin, type AdminProduct } from '@/lib/admin-api';
import { formatRupees } from '@/lib/format';
import { STOCK_LABEL, STOCK_TONE } from '@/lib/status';

const SHOW = [
  { value: 'all', label: 'All' },
  { value: 'on', label: 'On sale' },
  { value: 'off', label: 'Switched off' },
  { value: 'low', label: 'Low stock' },
  { value: 'out', label: 'Out of stock' },
];

export default function ProductsScreen() {
  const products = useQuery({ queryKey: ['admin', 'products'], queryFn: () => admin.products() });
  const categories = useQuery({ queryKey: ['admin', 'categories'], queryFn: admin.categories });
  const [search, setSearch] = useState('');
  const [show, setShow] = useState('all');
  const [category, setCategory] = useState('');
  const queryClient = useQueryClient();
  const toggle = useMutation({
    mutationFn: ({ id, is_active }: { id: number; is_active: boolean }) => admin.updateProduct(id, { is_active }),
    onSuccess: (saved) => {
      queryClient.setQueryData<AdminProduct[]>(['admin', 'products'], (list) => list?.map((p) => (p.id === saved.id ? saved : p)));
      queryClient.invalidateQueries({ queryKey: ['products'] }); // the customer price list
    },
  });

  const rows = useMemo(() => {
    const q = search.trim().toLowerCase();
    return (products.data ?? []).filter(
      (p) =>
        (!q || p.name.toLowerCase().includes(q) || String(p.code) === q) &&
        (!category || String(p.category) === category) &&
        (show === 'all' || (show === 'on' ? p.is_active : show === 'off' ? !p.is_active : p.stock_state === show)),
    );
  }, [products.data, search, category, show]);

  return (
    <Page
      title="Products"
      lead={`${products.data?.length ?? '…'} products on the price list. Changes show on the website and app straight away.`}
      actions={<Btn kind="primary" title="Add product" onPress={() => router.push({ pathname: '/admin/products/[id]', params: { id: 'new' } })} />}
      refreshing={products.isRefetching}
      onRefresh={() => void products.refetch()}>
      <View style={styles.filters}>
        <SearchBox value={search} onChange={setSearch} placeholder="Search by name or code" />
        <Chips options={SHOW} value={show} onChange={setShow} />
        <Chips
          options={[{ value: '', label: 'Every category' }, ...(categories.data ?? []).map((c) => ({ value: String(c.id), label: c.name }))]}
          value={category}
          onChange={setCategory}
        />
      </View>
      <ErrorText error={toggle.error ?? products.error} />
      <Text style={styles.count}>{rows.length} shown</Text>
      <Table
        rows={rows}
        loading={products.isPending}
        keyOf={(p) => p.id}
        onRowPress={(p) => router.push({ pathname: '/admin/products/[id]', params: { id: String(p.id) } })}
        empty="No products match."
        columns={[
          { key: 'n', label: 'Product', flex: 2.4, render: (p) => <Text style={[styles.name, !p.is_active && styles.off]}>{`${p.code}. ${p.name}`}</Text> },
          { key: 'c', label: 'Category', flex: 1.4, render: (p) => p.category_name, hideOnPhone: true },
          { key: 'm', label: 'MRP', align: 'right', render: (p) => formatRupees(p.mrp) },
          {
            key: 'o',
            label: 'Offer price',
            align: 'right',
            render: (p) => `${formatRupees(p.offer_price)}${p.effective_discount !== p.discount_percent ? ' *' : ''}`,
          },
          { key: 's', label: 'Stock', render: (p) => <Pill label={p.stock === null ? STOCK_LABEL.untracked : `${p.stock} · ${STOCK_LABEL[p.stock_state]}`} tone={STOCK_TONE[p.stock_state]} /> },
          {
            key: 'a',
            label: 'On sale',
            render: (p) => <Toggle label={p.is_active ? 'On' : 'Off'} value={p.is_active} onChange={(is_active) => toggle.mutate({ id: p.id, is_active })} />,
          },
        ]}
      />
      <Text style={styles.count}>* A seasonal offer is lowering this price right now.</Text>
    </Page>
  );
}

const styles = StyleSheet.create({
  filters: { gap: 12 },
  count: { color: tone.muted, ...type.regular, fontSize: 14, marginTop: -12 },
  name: { color: tone.ink, ...type.medium, fontSize: 15 },
  off: { color: tone.muted },
});
