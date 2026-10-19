import { useQuery } from '@tanstack/react-query';
import { router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { Chips, ErrorText, Field, Page, Pill, SearchBox, Table, useLayout } from '@/components/admin/ui';
import { admin } from '@/lib/admin-api';
import { formatDateTime, formatRupees } from '@/lib/format';
import { ADMIN_STATUS_LABEL, PAYMENT_LABEL, PAYMENT_TONE, STAGES, STATUS_TONE } from '@/lib/status';
import { useDebounced } from '@/lib/use-debounced';

const PAYMENTS = [
  { value: '', label: 'Any payment' },
  { value: 'unpaid', label: 'Unpaid' },
  { value: 'partial', label: 'Part paid' },
  { value: 'paid', label: 'Paid' },
  { value: 'refund_due', label: 'Refund due' },
];

export default function AdminOrders() {
  const params = useLocalSearchParams<{ stage?: string; status?: string }>();
  // Old links used ?status=submitted.
  const [stage, setStage] = useState(params.stage ?? (params.status === 'submitted' ? 'new' : 'open'));
  const [payment, setPayment] = useState('');
  const [search, setSearch] = useState('');
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const { medium } = useLayout();
  const q = useDebounced(search.trim(), 250);
  const validDate = (d: string) => (/^\d{4}-\d{2}-\d{2}$/.test(d) ? d : '');
  const filters = { stage, payment, search: q, from: validDate(from), to: validDate(to) };
  const list = useQuery({ queryKey: ['admin', 'estimates', filters], queryFn: () => admin.estimates(filters) });

  return (
    <Page
      title="Orders"
      lead="Every estimate customers send. Open one to call, confirm, edit items, take payment and dispatch."
      refreshing={list.isRefetching}
      onRefresh={() => void list.refetch()}>
      <View style={styles.filters}>
        <Chips options={STAGES} value={stage} onChange={setStage} />
        <View style={[styles.row, medium && styles.rowWide]}>
          <SearchBox value={search} onChange={setSearch} placeholder="Search number, name, phone, city, LR" />
          <View style={styles.dates}>
            <Field label="From" value={from} onChangeText={setFrom} placeholder="YYYY-MM-DD" style={styles.date} />
            <Field label="To" value={to} onChangeText={setTo} placeholder="YYYY-MM-DD" style={styles.date} />
          </View>
        </View>
        <Chips options={PAYMENTS} value={payment} onChange={setPayment} />
      </View>
      <ErrorText error={list.error} />
      <Table
        rows={list.data}
        loading={list.isPending}
        keyOf={(e) => e.number}
        onRowPress={(e) => router.push({ pathname: '/admin/estimates/[number]', params: { number: e.number } })}
        empty="No orders match these filters."
        columns={[
          { key: 'n', label: 'Order', render: (e) => e.number },
          { key: 'c', label: 'Customer', flex: 1.6, render: (e) => `${e.customer_name}, ${e.city}` },
          { key: 'p', label: 'Placed', flex: 1.2, render: (e) => formatDateTime(e.created_at), hideOnPhone: true },
          { key: 's', label: 'Status', render: (e) => <Pill label={ADMIN_STATUS_LABEL[e.status]} tone={STATUS_TONE[e.status]} /> },
          { key: 'pay', label: 'Payment', render: (e) => <Pill label={PAYMENT_LABEL[e.payment_status]} tone={PAYMENT_TONE[e.payment_status]} /> },
          { key: 't', label: 'Total', align: 'right', render: (e) => formatRupees(e.total) },
        ]}
      />
    </Page>
  );
}

const styles = StyleSheet.create({
  filters: { gap: 14 },
  row: { gap: 12 },
  rowWide: { flexDirection: 'row', alignItems: 'flex-end' },
  dates: { flexDirection: 'row', gap: 12 },
  date: { flexBasis: 140, flexGrow: 0, minWidth: 130 },
});
