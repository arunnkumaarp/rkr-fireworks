import { useMutation, useQuery } from '@tanstack/react-query';
import { useState } from 'react';
import { Platform, StyleSheet, Text, View } from 'react-native';

import { BarChart } from '@/components/admin/bar-chart';
import { admin as tone, Btn, Chips, Columns, ErrorText, Field, Line, Loading, Note, Page, Panel, Section, Stat, StatGrid, Table } from '@/components/admin/ui';
import { type } from '@/components/theme';
import { admin, downloadReport, type Report } from '@/lib/admin-api';
import { formatRupees, formatRupeesWhole, isoDate } from '@/lib/format';

function preset(key: string): [string, string] {
  const now = new Date();
  const y = now.getFullYear();
  const m = now.getMonth();
  switch (key) {
    case 'last-month':
      return [isoDate(new Date(y, m - 1, 1)), isoDate(new Date(y, m, 0))];
    case '30-days':
      return [isoDate(new Date(y, m, now.getDate() - 29)), isoDate(now)];
    case 'this-year':
      return [isoDate(new Date(y, 0, 1)), isoDate(now)];
    case 'last-year':
      return [isoDate(new Date(y - 1, 0, 1)), isoDate(new Date(y - 1, 11, 31))];
    case 'today':
      return [isoDate(now), isoDate(now)];
    default:
      return [isoDate(new Date(y, m, 1)), isoDate(now)];
  }
}

const PRESETS = [
  { value: 'today', label: 'Today' },
  { value: 'this-month', label: 'This month' },
  { value: 'last-month', label: 'Last month' },
  { value: '30-days', label: 'Last 30 days' },
  { value: 'this-year', label: 'This year' },
  { value: 'last-year', label: 'Last year' },
  { value: 'custom', label: 'Choose dates' },
];
const GROUPS = [
  { value: '', label: 'Auto' },
  { value: 'day', label: 'Daily' },
  { value: 'month', label: 'Monthly' },
  { value: 'year', label: 'Yearly' },
];

function periodLabel(period: string, group: Report['group'], long = false) {
  const d = new Date(`${period}T00:00:00`);
  if (group === 'year') return String(d.getFullYear());
  if (group === 'month') return d.toLocaleDateString('en-IN', { month: long ? 'long' : 'short', year: long ? 'numeric' : '2-digit' });
  return d.toLocaleDateString('en-IN', long ? { weekday: 'short', day: 'numeric', month: 'long' } : { day: 'numeric', month: 'short' });
}

export default function ReportsScreen() {
  const [range, setRange] = useState('this-month');
  const [custom, setCustom] = useState<[string, string]>(preset('this-month'));
  const [group, setGroup] = useState('');
  const [from, to] = range === 'custom' ? custom : preset(range);
  const ok = (d: string) => /^\d{4}-\d{2}-\d{2}$/.test(d);
  const params = { from, to, group };
  const report = useQuery({ queryKey: ['admin', 'report', params], queryFn: () => admin.report(params), enabled: ok(from) && ok(to) });
  const download = useMutation({ mutationFn: (kind: 'summary' | 'orders') => downloadReport({ ...params, download: kind }) });
  const r = report.data;
  const profit = Number(r?.totals.profit ?? 0);

  return (
    <Page
      title="Reports"
      lead="Sales, money received, expenses and profit for any period. Profit is money received minus recorded expenses."
      actions={
        Platform.OS === 'web' ? (
          <>
            <Btn title="Download summary (CSV)" loading={download.isPending && download.variables === 'summary'} onPress={() => download.mutate('summary')} />
            <Btn title="Download orders (CSV)" loading={download.isPending && download.variables === 'orders'} onPress={() => download.mutate('orders')} />
          </>
        ) : undefined
      }
      refreshing={report.isRefetching}
      onRefresh={() => void report.refetch()}>
      <View style={styles.filters}>
        <Chips options={PRESETS} value={range} onChange={(v) => {
          if (v === 'custom') setCustom([from, to]);
          setRange(v);
        }} />
        {range === 'custom' ? (
          <View style={styles.dates}>
            <Field label="From" value={custom[0]} onChangeText={(v) => setCustom([v, custom[1]])} placeholder="YYYY-MM-DD" style={styles.date} />
            <Field label="To" value={custom[1]} onChangeText={(v) => setCustom([custom[0], v])} placeholder="YYYY-MM-DD" style={styles.date} />
          </View>
        ) : null}
        <Chips options={GROUPS} value={group} onChange={setGroup} />
      </View>
      <ErrorText error={download.error ?? report.error} />

      {!r ? (
        report.isPending && ok(from) && ok(to) ? <Loading /> : <Note>Enter both dates as YYYY-MM-DD.</Note>
      ) : (
        <>
          <Text style={styles.range}>
            {periodLabel(r.from, 'day', true)} to {periodLabel(r.to, 'day', true)}
          </Text>
          <StatGrid>
            <Stat big label="Profit" value={formatRupeesWhole(r.totals.profit)} tone={profit < 0 ? 'red' : 'green'} note="Received minus expenses" />
            <Stat label="Money received" value={formatRupeesWhole(r.totals.received)} note="Payments minus refunds" />
            <Stat label="Expenses" value={formatRupeesWhole(r.totals.expenses)} />
            <Stat label="Confirmed sales" value={formatRupeesWhole(r.totals.sales)} note="Value of orders placed and confirmed" />
            <Stat label="Orders" value={String(r.totals.orders)} note={r.totals.cancelled ? `${r.totals.cancelled} cancelled, not counted` : undefined} />
          </StatGrid>

          <Columns min={1100} gap={20}>
            <Panel style={styles.chart}>
              <Text style={styles.chartTitle}>Received and spent</Text>
              <BarChart
                title="Money received and expenses per period"
                series={[
                  { name: 'Received', color: tone.series.primary },
                  { name: 'Expenses', color: tone.series.secondary },
                ]}
                data={r.rows.map((row) => ({ label: periodLabel(row.period, r.group), detail: periodLabel(row.period, r.group, true), values: [Number(row.received), Number(row.expenses)] }))}
              />
            </Panel>
            <Panel style={styles.chart}>
              <Text style={styles.chartTitle}>Confirmed sales</Text>
              <BarChart
                title="Confirmed order value per period"
                series={[{ name: 'Confirmed sales', color: tone.series.primary }]}
                data={r.rows.map((row) => ({ label: periodLabel(row.period, r.group), detail: periodLabel(row.period, r.group, true), values: [Number(row.sales)] }))}
              />
            </Panel>
          </Columns>

          <Section title={r.group === 'day' ? 'Day by day' : r.group === 'month' ? 'Month by month' : 'Year by year'}>
            <Table
              rows={[...r.rows].reverse()}
              keyOf={(row) => row.period}
              columns={[
                { key: 'p', label: 'Period', render: (row) => periodLabel(row.period, r.group, true) },
                { key: 'o', label: 'Orders', align: 'right', render: (row) => String(row.orders) },
                { key: 's', label: 'Sales', align: 'right', render: (row) => formatRupees(row.sales) },
                { key: 'r', label: 'Received', align: 'right', render: (row) => formatRupees(row.received) },
                { key: 'e', label: 'Expenses', align: 'right', render: (row) => formatRupees(row.expenses) },
                { key: 'f', label: 'Profit', align: 'right', render: (row) => <Text style={[styles.cell, Number(row.profit) < 0 && styles.negative]}>{formatRupees(row.profit)}</Text> },
              ]}
            />
          </Section>

          <Columns min={1000} gap={20}>
            <Section title="Expenses by category" style={styles.col}>
              <Panel>
                {r.expenses_by_category.length ? r.expenses_by_category.map((e) => <Line key={e.category} label={e.label} value={formatRupees(e.amount)} />) : <Note>No expenses in this period.</Note>}
              </Panel>
            </Section>
            <Section title="Received by method" style={styles.col}>
              <Panel>
                {r.received_by_method.length ? r.received_by_method.map((m) => <Line key={m.method} label={m.label} value={formatRupees(m.amount)} />) : <Note>No payments in this period.</Note>}
              </Panel>
            </Section>
            <Section title="Best sellers" style={styles.col}>
              <Panel>
                {r.top_products.length ? (
                  r.top_products.map((p) => <Line key={p.code} label={`${p.name} × ${p.quantity}`} value={formatRupeesWhole(p.amount)} />)
                ) : (
                  <Note>No confirmed orders in this period.</Note>
                )}
              </Panel>
            </Section>
          </Columns>
          {Platform.OS !== 'web' ? <Note>CSV downloads are on the website: open the shop admin on a computer.</Note> : null}
        </>
      )}
    </Page>
  );
}

const styles = StyleSheet.create({
  filters: { gap: 12 },
  dates: { flexDirection: 'row', gap: 12 },
  date: { flexBasis: 150, flexGrow: 0, minWidth: 130 },
  range: { color: tone.soft, ...type.medium, fontSize: 16, marginBottom: -16 },
  chart: { flex: 1, gap: 14 },
  chartTitle: { color: tone.ink, ...type.semibold, fontSize: 18 },
  col: { flex: 1 },
  cell: { color: tone.ink, ...type.regular, fontSize: 15, fontVariant: ['tabular-nums'] },
  negative: { color: '#FF8A7A' },
});
