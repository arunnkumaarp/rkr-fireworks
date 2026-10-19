import { useQuery } from '@tanstack/react-query';
import { useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { admin as tone, Chips, ErrorText, Note, Page, Pill, SearchBox, Table } from '@/components/admin/ui';
import { type } from '@/components/theme';
import { admin, type AuditEntry } from '@/lib/admin-api';
import { formatDateTime } from '@/lib/format';
import type { Tone } from '@/lib/status';
import { useDebounced } from '@/lib/use-debounced';

const TYPES = [
  { value: '', label: 'Everything' },
  { value: 'order', label: 'Orders' },
  { value: 'payment', label: 'Payments' },
  { value: 'product', label: 'Products' },
  { value: 'category', label: 'Categories' },
  { value: 'expense', label: 'Expenses' },
  { value: 'offer', label: 'Offers' },
  { value: 'coupon', label: 'Coupons' },
  { value: 'settings', label: 'Settings' },
  { value: 'user', label: 'Team and logins' },
];

const ACTION_TONE: Record<string, Tone> = { create: 'green', update: 'blue', delete: 'red', login: 'neutral', team: 'gold', stock: 'amber' };

function changesText(e: AuditEntry) {
  return Object.entries(e.changes ?? {})
    .map(([k, v]) => (Array.isArray(v) && v.length === 2 ? `${k}: ${v[0] ?? '—'} → ${v[1] ?? '—'}` : `${k}: ${Array.isArray(v) ? v.join(', ') : String(v)}`))
    .join('; ');
}

export default function AuditScreen() {
  const [type, setType] = useState('');
  const [search, setSearch] = useState('');
  const q = useDebounced(search.trim(), 250);
  const list = useQuery({ queryKey: ['admin', 'audit', type, q], queryFn: () => admin.audit({ object_type: type, search: q }) });

  return (
    <Page
      title="Audit log"
      lead="Every change made in the shop admin, who made it and when. Entries can't be edited or deleted."
      refreshing={list.isRefetching}
      onRefresh={() => void list.refetch()}>
      <SearchBox value={search} onChange={setSearch} placeholder="Search by person, order number or text" />
      <Chips options={TYPES} value={type} onChange={setType} />
      <ErrorText error={list.error} />
      <Table
        rows={list.data}
        loading={list.isPending}
        keyOf={(e) => e.id}
        empty="No entries."
        columns={[
          { key: 'w', label: 'When', flex: 1.1, render: (e) => formatDateTime(e.created_at) },
          { key: 'u', label: 'Who', flex: 1.4, render: (e) => e.user_email || 'System' },
          { key: 'a', label: 'Action', render: (e) => <Pill label={e.action} tone={ACTION_TONE[e.action] ?? 'neutral'} /> },
          {
            key: 's',
            label: 'What',
            flex: 3,
            render: (e) => (
              <View style={styles.what}>
                <Text style={styles.summary}>{e.summary}</Text>
                {Object.keys(e.changes ?? {}).length ? <Text style={styles.changes}>{changesText(e)}</Text> : null}
              </View>
            ),
          },
        ]}
      />
      <Note>Shows the latest 300 entries for the filter. The full log is also in Django admin.</Note>
    </Page>
  );
}

const styles = StyleSheet.create({
  what: { gap: 2, flexShrink: 1 },
  summary: { color: tone.ink, ...type.regular, fontSize: 15 },
  changes: { color: tone.muted, ...type.regular, fontSize: 13 },
});
