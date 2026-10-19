import { useQuery } from '@tanstack/react-query';
import { router, useLocalSearchParams } from 'expo-router';
import { Linking } from 'react-native';

import { Btn, Columns, ErrorText, Line, Loading, Page, Panel, Pill, Section, Stat, StatGrid, Table } from '@/components/admin/ui';
import { admin } from '@/lib/admin-api';
import { formatDate, formatDateTime, formatRupees, formatRupeesWhole } from '@/lib/format';
import { ADMIN_STATUS_LABEL, PAYMENT_LABEL, PAYMENT_TONE, STATUS_TONE } from '@/lib/status';

export default function CustomerDetail() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const customer = useQuery({ queryKey: ['admin', 'customers', 'detail', id], queryFn: () => admin.customer(Number(id)) });
  const orders = useQuery({ queryKey: ['admin', 'estimates', { customer: id }], queryFn: () => admin.estimates({ customer: id }) });
  const c = customer.data;

  if (!c) {
    return (
      <Page title="Customer" back="/admin/customers">
        {customer.isError ? <ErrorText error={customer.error} /> : <Loading />}
      </Page>
    );
  }
  const balance = (orders.data ?? []).reduce((s, e) => s + Number(e.balance), 0);

  return (
    <Page
      title={c.first_name || c.email}
      lead={`Customer since ${formatDate(c.date_joined)}. Last logged in ${formatDateTime(c.last_login)}.`}
      back="/admin/customers"
      actions={
        c.phone ? (
          <>
            <Btn title="Call" onPress={() => Linking.openURL(`tel:${c.phone}`)} />
            <Btn title="WhatsApp" onPress={() => Linking.openURL(`https://wa.me/91${c.phone}`)} />
          </>
        ) : undefined
      }>
      <Columns min={900}>
        <Panel style={{ flex: 1 }}>
          <Line label="Email" value={c.email} />
          <Line label="Phone" value={c.phone || '—'} />
          <Line label="Last delivery address" value={c.address || '—'} />
        </Panel>
        <StatGrid>
          <Stat label="Orders" value={String(c.orders)} note={c.open_orders ? `${c.open_orders} still open` : undefined} />
          <Stat label="Confirmed purchases" value={formatRupeesWhole(c.purchases ?? 0)} />
          <Stat label="Paid" value={formatRupeesWhole(c.amount_paid ?? 0)} />
          <Stat label="Balance due" value={formatRupeesWhole(balance)} tone={balance > 0 ? 'amber' : undefined} />
        </StatGrid>
      </Columns>
      <Section title="Order history">
        <Table
          rows={orders.data}
          loading={orders.isPending}
          keyOf={(e) => e.number}
          onRowPress={(e) => router.push({ pathname: '/admin/estimates/[number]', params: { number: e.number } })}
          empty="No orders yet."
          columns={[
            { key: 'n', label: 'Order', render: (e) => e.number },
            { key: 'd', label: 'Placed', render: (e) => formatDate(e.created_at) },
            { key: 's', label: 'Status', render: (e) => <Pill label={ADMIN_STATUS_LABEL[e.status]} tone={STATUS_TONE[e.status]} /> },
            { key: 'p', label: 'Payment', render: (e) => <Pill label={PAYMENT_LABEL[e.payment_status]} tone={PAYMENT_TONE[e.payment_status]} /> },
            { key: 't', label: 'Total', align: 'right', render: (e) => formatRupees(e.total) },
          ]}
        />
      </Section>
    </Page>
  );
}
