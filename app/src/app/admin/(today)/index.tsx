import { useQuery } from '@tanstack/react-query';
import { router } from 'expo-router';
import { StyleSheet, Text, View } from 'react-native';

import { BarChart } from '@/components/admin/bar-chart';
import { admin as tone, Columns, ErrorText, Loading, Page, Panel, Pill, Section, Stat, StatGrid, Table } from '@/components/admin/ui';
import { PressScale } from '@/components/press-scale';
import { colors, fonts, type } from '@/components/theme';
import { admin, type Dashboard } from '@/lib/admin-api';
import { formatDateTime, formatRupees, formatRupeesWhole } from '@/lib/format';
import { ADMIN_STATUS_LABEL, STATUS_TONE } from '@/lib/status';
import { useAuth } from '@/store/auth';

const go = (pathname: string, params?: Record<string, string>) => router.push({ pathname: pathname as never, params });

export default function AdminDashboard() {
  const user = useAuth((s) => s.user);
  const dash = useQuery({ queryKey: ['admin', 'dashboard'], queryFn: admin.dashboard });
  const d = dash.data;
  const month = new Date().toLocaleDateString('en-IN', { month: 'long' });

  return (
    <Page
      title="Dashboard"
      lead={`Hello ${user?.first_name || user?.email}. Here is the shop today, ${new Date().toLocaleDateString('en-IN', { weekday: 'long', day: 'numeric', month: 'long' })}.`}
      refreshing={dash.isRefetching}
      onRefresh={() => void dash.refetch()}>
      {!d ? (
        dash.isError ? <ErrorText error={dash.error} /> : <Loading />
      ) : (
        <>
          <Columns min={900}>
            <PressScale scaleTo={0.98} accessibilityRole="button" onPress={() => go('/admin/estimates', { stage: 'new' })} style={styles.lead}>
              <Text style={styles.leadNumber}>{d.awaiting_call}</Text>
              <Text style={styles.leadText}>
                {d.awaiting_call === 1 ? 'new estimate is waiting for your call' : 'new estimates are waiting for your call'}
              </Text>
              <Text style={styles.leadSub}>
                {d.today} today · {d.this_week} this week · {d.this_month} in {month}
              </Text>
            </PressScale>
            {d.money ? <MoneyPanel d={d} month={month} /> : <OpsPanel d={d} />}
          </Columns>

          <Section title="Orders by stage">
            <StatGrid>
              <Stat label="New" value={String(d.awaiting_call)} tone="gold" onPress={() => go('/admin/estimates', { stage: 'new' })} />
              <Stat label="Confirmed" value={String(d.confirmed)} onPress={() => go('/admin/estimates', { stage: 'confirmed' })} />
              <Stat label="Paid or packed" value={String(d.processing)} onPress={() => go('/admin/dispatch')} />
              <Stat label="In transit" value={String(d.in_transit)} onPress={() => go('/admin/dispatch', { view: 'transit' })} />
              <Stat label="Delivered" value={String(d.completed)} tone="green" onPress={() => go('/admin/estimates', { stage: 'completed' })} />
              <Stat label="Cancelled" value={String(d.cancelled)} onPress={() => go('/admin/estimates', { stage: 'cancelled' })} />
            </StatGrid>
          </Section>

          <Section title="Confirmed sales, last 30 days">
            <Panel>
              <BarChart
                title="Confirmed order value per day for the last 30 days"
                series={[{ name: 'Confirmed sales', color: tone.series.primary }]}
                data={d.series.map((s) => {
                  const date = new Date(`${s.date}T00:00:00`);
                  return {
                    label: date.toLocaleDateString('en-IN', { day: 'numeric', month: 'short' }),
                    detail: date.toLocaleDateString('en-IN', { weekday: 'short', day: 'numeric', month: 'long' }),
                    values: [Number(s.sales)],
                  };
                })}
              />
            </Panel>
          </Section>

          <Columns min={1000} gap={28}>
            <View style={styles.flex2}>
              <Section title="Latest orders" actions={<Link label="All orders" onPress={() => go('/admin/estimates')} />}>
                <Table
                  rows={d.recent}
                  keyOf={(r) => r.number}
                  onRowPress={(r) => go('/admin/estimates/[number]', { number: r.number })}
                  empty="No orders yet. They appear here the moment a customer sends an estimate."
                  columns={[
                    { key: 'n', label: 'Order', flex: 1, render: (r) => r.number },
                    { key: 'c', label: 'Customer', flex: 1.6, render: (r) => `${r.customer_name}, ${r.city}` },
                    { key: 's', label: 'Status', flex: 1, render: (r) => <Pill label={ADMIN_STATUS_LABEL[r.status]} tone={STATUS_TONE[r.status]} /> },
                    { key: 'd', label: 'Placed', flex: 1.1, render: (r) => formatDateTime(r.created_at), hideOnPhone: true },
                    { key: 't', label: 'Total', flex: 1, align: 'right', render: (r) => formatRupees(r.total) },
                  ]}
                />
              </Section>
            </View>
            <View style={styles.flex1}>
              <Section title="Most ordered">
                <Panel>
                  {d.top_products.length ? (
                    d.top_products.slice(0, 8).map((p, i) => (
                      <View key={p.code} style={styles.topRow}>
                        <Text style={[styles.topName, i === 0 && styles.topFirst]} numberOfLines={1}>
                          {p.name}
                        </Text>
                        <Text style={styles.topQty}>{p.quantity}</Text>
                      </View>
                    ))
                  ) : (
                    <Text style={styles.muted}>Products appear here once estimates come in.</Text>
                  )}
                </Panel>
              </Section>
            </View>
          </Columns>

          {d.out_of_stock + d.low_stock > 0 ? (
            <Section title="Stock to look at">
              <StatGrid>
                <Stat label="Out of stock" value={String(d.out_of_stock)} tone="red" note="Hidden from the price list" onPress={() => go('/admin/inventory', { stock: 'out' })} />
                <Stat label="Running low" value={String(d.low_stock)} tone="amber" onPress={() => go('/admin/inventory', { stock: 'low' })} />
              </StatGrid>
            </Section>
          ) : null}
        </>
      )}
    </Page>
  );
}

function MoneyPanel({ d, month }: { d: Dashboard; month: string }) {
  const m = d.money!;
  const profit = Number(m.profit_month);
  return (
    <View style={styles.moneyGrid}>
      <StatGrid>
        <Stat big label={`Confirmed sales in ${month}`} value={formatRupeesWhole(d.month_sales)} note={`${formatRupeesWhole(d.confirmed_value)} all time`} />
      </StatGrid>
      <StatGrid>
        <Stat label={`Received in ${month}`} value={formatRupeesWhole(m.received_month)} onPress={() => go('/admin/payments')} />
        <Stat label={`Expenses in ${month}`} value={formatRupeesWhole(m.expenses_month)} onPress={() => go('/admin/expenses')} />
        <Stat label="Profit this month" value={formatRupeesWhole(m.profit_month)} tone={profit < 0 ? 'red' : 'green'} note="Received minus expenses" onPress={() => go('/admin/reports')} />
        <Stat label="Still to collect" value={formatRupeesWhole(m.outstanding)} tone={Number(m.outstanding) > 0 ? 'amber' : undefined} onPress={() => go('/admin/payments')} />
      </StatGrid>
    </View>
  );
}

function OpsPanel({ d }: { d: Dashboard }) {
  return (
    <View style={styles.moneyGrid}>
      <StatGrid>
        <Stat big label="Ready to dispatch" value={String(d.to_dispatch)} onPress={() => go('/admin/dispatch')} />
        <Stat big label="In transit" value={String(d.in_transit)} onPress={() => go('/admin/dispatch', { view: 'transit' })} />
      </StatGrid>
    </View>
  );
}

function Link({ label, onPress }: { label: string; onPress: () => void }) {
  return (
    <Text accessibilityRole="link" onPress={onPress} style={styles.link}>
      {label}
    </Text>
  );
}

const styles = StyleSheet.create({
  lead: { flex: 1, backgroundColor: colors.primary, borderRadius: 20, padding: 24, gap: 6, justifyContent: 'flex-end', minHeight: 240 },
  leadNumber: { color: colors.onPrimary, fontFamily: fonts.display, fontSize: 112, lineHeight: 112, letterSpacing: -4, fontVariant: ['tabular-nums'] },
  leadText: { color: colors.onPrimary, ...type.semibold, fontSize: 22, lineHeight: 28, maxWidth: 360 },
  leadSub: { color: colors.onPrimary, ...type.regular, fontSize: 15, opacity: 0.8 },
  moneyGrid: { flex: 1.4, gap: 12 },
  flex1: { flex: 1 },
  flex2: { flex: 2 },
  topRow: { flexDirection: 'row', justifyContent: 'space-between', gap: 12 },
  topName: { flex: 1, color: tone.soft, ...type.regular, fontSize: 15 },
  topFirst: { color: tone.ink, ...type.medium },
  topQty: { color: tone.ink, ...type.semibold, fontSize: 15, fontVariant: ['tabular-nums'] },
  muted: { color: tone.muted, ...type.regular, fontSize: 15 },
  link: { color: tone.gold, ...type.medium, fontSize: 15 },
});
