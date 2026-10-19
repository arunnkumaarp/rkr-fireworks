import { useQuery } from '@tanstack/react-query';
import { router } from 'expo-router';
import { useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { Chips, ErrorText, Page, Pill, SearchBox, Table } from '@/components/admin/ui';
import { admin } from '@/lib/admin-api';
import { formatDate, formatRupees } from '@/lib/format';
import { useDebounced } from '@/lib/use-debounced';

const SHOW = [
  { value: '', label: 'Everyone' },
  { value: 'new', label: 'Joined in 30 days' },
  { value: 'buyers', label: 'Have ordered' },
  { value: 'repeat', label: 'Ordered twice or more' },
];
const SORT = [
  { value: 'joined', label: 'Newest' },
  { value: 'recent', label: 'Last order' },
  { value: 'purchases', label: 'Biggest buyers' },
];

export default function CustomersScreen() {
  const [show, setShow] = useState('');
  const [sort, setSort] = useState('joined');
  const [search, setSearch] = useState('');
  const q = useDebounced(search.trim(), 250);
  const list = useQuery({ queryKey: ['admin', 'customers', show, sort, q], queryFn: () => admin.customers({ show, sort, search: q }) });

  return (
    <Page
      title="Customers"
      lead="Everyone who has logged in to order. Purchases count confirmed orders only."
      refreshing={list.isRefetching}
      onRefresh={() => void list.refetch()}>
      <View style={styles.filters}>
        <SearchBox value={search} onChange={setSearch} placeholder="Search name, email, phone, city" />
        <Chips options={SHOW} value={show} onChange={setShow} />
        <Chips options={SORT} value={sort} onChange={setSort} />
      </View>
      <ErrorText error={list.error} />
      <Table
        rows={list.data}
        loading={list.isPending}
        keyOf={(c) => c.id}
        onRowPress={(c) => router.push({ pathname: '/admin/customers/[id]', params: { id: String(c.id) } })}
        empty="No customers match."
        columns={[
          { key: 'n', label: 'Customer', flex: 1.6, render: (c) => c.first_name || c.email },
          { key: 'p', label: 'Phone', render: (c) => c.phone || '—' },
          { key: 'c', label: 'City', render: (c) => c.city || '—', hideOnPhone: true },
          { key: 'o', label: 'Orders', align: 'right', render: (c) => (c.open_orders ? <Pill label={`${c.orders} · ${c.open_orders} open`} tone="gold" /> : String(c.orders)) },
          { key: 'l', label: 'Last order', render: (c) => formatDate(c.last_order), hideOnPhone: true },
          { key: 't', label: 'Purchases', align: 'right', render: (c) => formatRupees(c.purchases ?? 0) },
        ]}
      />
    </Page>
  );
}

const styles = StyleSheet.create({ filters: { gap: 12 } });
