import { useQuery } from '@tanstack/react-query';
import { router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';

import { Chips, ErrorText, Note, Page, Pill, Section, Stat, StatGrid, Table } from '@/components/admin/ui';
import { admin } from '@/lib/admin-api';
import { formatDateTime, formatRupees, formatRupeesWhole } from '@/lib/format';
import { STOCK_LABEL, STOCK_TONE } from '@/lib/status';

const SHOW = [
  { value: 'low', label: 'Running low' },
  { value: 'out', label: 'Out of stock' },
  { value: 'tracked', label: 'All tracked' },
  { value: 'untracked', label: 'Not tracked' },
];

export default function InventoryScreen() {
  const params = useLocalSearchParams<{ stock?: string }>();
  const [show, setShow] = useState(params.stock && SHOW.some((s) => s.value === params.stock) ? params.stock : 'low');
  const summary = useQuery({ queryKey: ['admin', 'inventory'], queryFn: admin.inventory });
  const products = useQuery({ queryKey: ['admin', 'products', { stock: show }], queryFn: () => admin.products({ stock: show }) });
  const movements = useQuery({ queryKey: ['admin', 'movements', 'all'], queryFn: () => admin.movements() });
  const s = summary.data;

  return (
    <Page
      title="Inventory"
      lead="Stock is counted only for products you track. Open a product to restock, correct a count or remove damaged boxes."
      refreshing={summary.isRefetching}
      onRefresh={() => {
        void summary.refetch();
        void products.refetch();
        void movements.refetch();
      }}>
      <StatGrid>
        <Stat label="Tracked products" value={s ? `${s.tracked} of ${s.products}` : '…'} />
        <Stat label="Running low" value={s ? String(s.low) : '…'} tone={s?.low ? 'amber' : undefined} onPress={() => setShow('low')} />
        <Stat label="Out of stock" value={s ? String(s.out) : '…'} tone={s?.out ? 'red' : undefined} onPress={() => setShow('out')} />
        <Stat label="Units in stock" value={s ? s.units.toLocaleString('en-IN') : '…'} note={s ? `${formatRupeesWhole(s.mrp_value)} at MRP` : undefined} />
      </StatGrid>

      <Section>
        <Chips options={SHOW} value={show} onChange={setShow} />
        <ErrorText error={products.error} />
        <Table
          rows={products.data}
          loading={products.isPending}
          keyOf={(p) => p.id}
          onRowPress={(p) => router.push({ pathname: '/admin/products/[id]', params: { id: String(p.id) } })}
          empty={show === 'low' ? 'Nothing is running low.' : show === 'out' ? 'Nothing is out of stock.' : 'No products here.'}
          columns={[
            { key: 'n', label: 'Product', flex: 2.4, render: (p) => `${p.code}. ${p.name}` },
            { key: 'c', label: 'Category', flex: 1.4, render: (p) => p.category_name, hideOnPhone: true },
            { key: 'q', label: 'In stock', align: 'right', render: (p) => (p.stock === null ? '—' : String(p.stock)) },
            { key: 'w', label: 'Warn at', align: 'right', render: (p) => String(p.low_stock_threshold), hideOnPhone: true },
            { key: 's', label: 'State', render: (p) => <Pill label={STOCK_LABEL[p.stock_state]} tone={STOCK_TONE[p.stock_state]} /> },
            { key: 'o', label: 'Offer price', align: 'right', render: (p) => formatRupees(p.offer_price), hideOnPhone: true },
          ]}
        />
      </Section>

      <Section title="Recent stock changes">
        <Note>Every change is kept: restocks, corrections, damage, and stock taken or returned by orders.</Note>
        <Table
          rows={movements.data?.slice(0, 40)}
          loading={movements.isPending}
          keyOf={(m) => m.id}
          onRowPress={(m) => router.push({ pathname: '/admin/products/[id]', params: { id: String(m.product) } })}
          empty="No stock changes yet. Track a product's stock from its page."
          columns={[
            { key: 'p', label: 'Product', flex: 2, render: (m) => `${m.product_code}. ${m.product_name}` },
            { key: 'r', label: 'Why', flex: 1.6, render: (m) => [m.reason_label, m.estimate].filter(Boolean).join(' · ') },
            { key: 'c', label: 'Change', align: 'right', render: (m) => (m.change > 0 ? `+${m.change}` : String(m.change)) },
            { key: 'b', label: 'Left', align: 'right', render: (m) => String(m.balance) },
            { key: 'd', label: 'When', flex: 1.3, render: (m) => formatDateTime(m.created_at), hideOnPhone: true },
            { key: 'u', label: 'By', flex: 1.3, render: (m) => m.user || 'Order', hideOnPhone: true },
          ]}
        />
      </Section>
    </Page>
  );
}
