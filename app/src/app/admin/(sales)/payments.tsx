import { useQuery } from '@tanstack/react-query';
import { router } from 'expo-router';
import { useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { Chips, ErrorText, Field, Note, Page, Pill, SearchBox, Section, Stat, StatGrid, Table, useLayout } from '@/components/admin/ui';
import { admin } from '@/lib/admin-api';
import { formatDate, formatRupees, formatRupeesWhole } from '@/lib/format';
import { ADMIN_STATUS_LABEL, METHOD_LABEL, METHODS, PAYMENT_TONE, STATUS_TONE } from '@/lib/status';
import { useDebounced } from '@/lib/use-debounced';

const DUE = [
  { value: 'unpaid', label: 'Unpaid' },
  { value: 'partial', label: 'Part paid' },
  { value: 'refund_due', label: 'Refund due' },
  { value: 'paid', label: 'Paid in full' },
];

export default function PaymentsScreen() {
  const [due, setDue] = useState('unpaid');
  const [kind, setKind] = useState('');
  const [method, setMethod] = useState('');
  const [search, setSearch] = useState('');
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const { medium } = useLayout();
  const q = useDebounced(search.trim(), 250);
  const ok = (d: string) => (/^\d{4}-\d{2}-\d{2}$/.test(d) ? d : '');

  const summary = useQuery({ queryKey: ['admin', 'payments', 'summary'], queryFn: admin.paymentsSummary });
  // "Unpaid" here means confirmed orders: a new estimate is not owed yet.
  const owing = useQuery({
    queryKey: ['admin', 'estimates', { payment: due, stage: due === 'refund_due' ? '' : 'committed' }],
    queryFn: () => admin.estimates({ payment: due, stage: due === 'refund_due' ? '' : 'committed' }),
  });
  const filters = { kind, method, search: q, from: ok(from), to: ok(to) };
  const ledger = useQuery({ queryKey: ['admin', 'payments', filters], queryFn: () => admin.payments(filters) });
  const s = summary.data;

  return (
    <Page
      title="Payments"
      lead="Money is paid outside the site, by UPI, cash or bank. Record each payment on its order to keep balances right."
      refreshing={summary.isRefetching}
      onRefresh={() => {
        void summary.refetch();
        void owing.refetch();
        void ledger.refetch();
      }}>
      <ErrorText error={summary.error} />
      <StatGrid>
        <Stat big label="Still to collect" value={s ? formatRupeesWhole(s.outstanding) : '…'} note="Confirmed orders not yet fully paid" tone={s && Number(s.outstanding) > 0 ? 'amber' : undefined} />
        <Stat label="Received, all time" value={s ? formatRupeesWhole(s.received) : '…'} tone="green" />
        <Stat label="Refunded" value={s ? formatRupeesWhole(s.refunded) : '…'} />
        <Stat label="Refunds due" value={s ? String(s.buckets.refund_due.count) : '…'} tone={s?.buckets.refund_due.count ? 'red' : undefined} onPress={() => setDue('refund_due')} />
      </StatGrid>
      {s?.by_method.length ? (
        <Note>
          Received by {s.by_method.map((m) => `${METHOD_LABEL[m.method]} ${formatRupeesWhole(m.amount)}`).join(' · ')}
        </Note>
      ) : null}

      <Section title="Orders by payment">
        <Chips options={DUE.map((d) => ({ ...d, count: s?.buckets[d.value as keyof typeof s.buckets]?.count }))} value={due} onChange={setDue} />
        <Table
          rows={owing.data}
          loading={owing.isPending}
          keyOf={(e) => e.number}
          onRowPress={(e) => router.push({ pathname: '/admin/estimates/[number]', params: { number: e.number } })}
          empty="No orders here."
          columns={[
            { key: 'n', label: 'Order', render: (e) => e.number },
            { key: 'c', label: 'Customer', flex: 1.5, render: (e) => `${e.customer_name} · ${e.phone}` },
            { key: 's', label: 'Status', render: (e) => <Pill label={ADMIN_STATUS_LABEL[e.status]} tone={STATUS_TONE[e.status]} />, hideOnPhone: true },
            { key: 't', label: 'Total', align: 'right', render: (e) => formatRupees(e.total) },
            { key: 'p', label: 'Paid', align: 'right', render: (e) => formatRupees(e.amount_paid) },
            {
              key: 'b',
              label: due === 'refund_due' ? 'To refund' : 'Balance',
              align: 'right',
              render: (e) => <Pill label={formatRupees(due === 'refund_due' ? e.amount_paid : e.balance)} tone={PAYMENT_TONE[e.payment_status]} />,
            },
          ]}
        />
      </Section>

      <Section title="Payment ledger">
        <View style={[styles.row, medium && styles.rowWide]}>
          <SearchBox value={search} onChange={setSearch} placeholder="Search order, customer, reference" />
          <View style={styles.dates}>
            <Field label="From" value={from} onChangeText={setFrom} placeholder="YYYY-MM-DD" style={styles.date} />
            <Field label="To" value={to} onChangeText={setTo} placeholder="YYYY-MM-DD" style={styles.date} />
          </View>
        </View>
        <Chips options={[{ value: '', label: 'Payments and refunds' }, { value: 'payment', label: 'Payments' }, { value: 'refund', label: 'Refunds' }]} value={kind} onChange={setKind} />
        <Chips options={[{ value: '', label: 'Any method' }, ...METHODS]} value={method} onChange={setMethod} />
        <Table
          rows={ledger.data}
          loading={ledger.isPending}
          keyOf={(p) => p.id}
          onRowPress={(p) => router.push({ pathname: '/admin/estimates/[number]', params: { number: p.estimate } })}
          empty="No payments recorded for these filters."
          columns={[
            { key: 'd', label: 'Date', render: (p) => formatDate(p.paid_on) },
            { key: 'o', label: 'Order', render: (p) => p.estimate },
            { key: 'c', label: 'Customer', flex: 1.4, render: (p) => p.customer_name, hideOnPhone: true },
            { key: 'm', label: 'Method', render: (p) => `${METHOD_LABEL[p.method]}${p.reference ? ` · ${p.reference}` : ''}` },
            { key: 'k', label: 'Type', render: (p) => <Pill label={p.kind === 'refund' ? 'Refund' : 'Payment'} tone={p.kind === 'refund' ? 'red' : 'green'} /> },
            { key: 'a', label: 'Amount', align: 'right', render: (p) => formatRupees(p.amount) },
          ]}
        />
      </Section>
    </Page>
  );
}

const styles = StyleSheet.create({
  row: { gap: 12 },
  rowWide: { flexDirection: 'row', alignItems: 'flex-end' },
  dates: { flexDirection: 'row', gap: 12 },
  date: { flexBasis: 140, flexGrow: 0, minWidth: 130 },
});
