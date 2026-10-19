import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { admin as tone, Btn, Chips, ErrorText, Field, FormRow, Loading, Page, Pill, SearchBox, Sheet, useLayout } from '@/components/admin/ui';
import { PressScale } from '@/components/press-scale';
import { type } from '@/components/theme';
import { admin, type AdminEstimate, type EstimatePatch } from '@/lib/admin-api';
import { formatDate, formatRupees, isoDate } from '@/lib/format';
import { ADMIN_STATUS_LABEL, PAYMENT_LABEL, PAYMENT_TONE, STATUS_TONE } from '@/lib/status';
import { useDebounced } from '@/lib/use-debounced';

const VIEWS = [
  { value: 'ready', label: 'To pack and dispatch', stage: 'to_dispatch' },
  { value: 'transit', label: 'In transit', stage: 'dispatched' },
  { value: 'done', label: 'Delivered', stage: 'completed' },
];

export default function DispatchScreen() {
  const params = useLocalSearchParams<{ view?: string }>();
  const [view, setView] = useState(params.view && VIEWS.some((v) => v.value === params.view) ? params.view : 'ready');
  const [search, setSearch] = useState('');
  const q = useDebounced(search.trim(), 250);
  const stage = VIEWS.find((v) => v.value === view)!.stage;
  const list = useQuery({ queryKey: ['admin', 'estimates', { stage, search: q }], queryFn: () => admin.estimates({ stage, search: q }) });
  const [dispatching, setDispatching] = useState<AdminEstimate | null>(null);
  const queryClient = useQueryClient();
  const update = useMutation({
    mutationFn: ({ number, patch }: { number: string; patch: EstimatePatch }) => admin.updateEstimate(number, patch),
    onSuccess: () => {
      for (const k of ['estimates', 'estimate', 'dashboard', 'notifications', 'products']) queryClient.invalidateQueries({ queryKey: ['admin', k] });
      setDispatching(null);
    },
  });
  const { medium } = useLayout();
  const rows = list.data ?? [];
  // Oldest first: the order that has waited longest goes out first.
  const sorted = view === 'done' ? rows : [...rows].reverse();

  return (
    <Page
      title="Dispatch"
      lead="Confirmed orders waiting to go out, parcels on the road, and what has arrived."
      refreshing={list.isRefetching}
      onRefresh={() => void list.refetch()}>
      <View style={styles.filters}>
        <Chips options={VIEWS} value={view} onChange={setView} />
        <SearchBox value={search} onChange={setSearch} placeholder="Search order, name, city, LR number" />
      </View>
      <ErrorText error={update.error ?? list.error} />
      {list.isPending ? (
        <Loading />
      ) : !sorted.length ? (
        <Text style={styles.empty}>{view === 'ready' ? 'Nothing waiting to go out.' : view === 'transit' ? 'No parcels on the road.' : 'No deliveries yet.'}</Text>
      ) : (
        <View style={[styles.grid, medium && styles.gridWide]}>
          {sorted.map((e) => (
            <View key={e.number} style={[styles.card, medium && styles.cardWide]}>
              <PressScale scaleTo={0.98} accessibilityRole="link" onPress={() => router.push({ pathname: '/admin/estimates/[number]', params: { number: e.number } })} style={styles.cardHead}>
                <Text style={styles.number}>{e.number}</Text>
                <Text style={styles.total}>{formatRupees(e.total)}</Text>
              </PressScale>
              <View style={styles.pills}>
                <Pill label={ADMIN_STATUS_LABEL[e.status]} tone={STATUS_TONE[e.status]} />
                <Pill label={PAYMENT_LABEL[e.payment_status]} tone={PAYMENT_TONE[e.payment_status]} />
              </View>
              <Text style={styles.name}>
                {e.customer_name} · {e.phone}
              </Text>
              <Text style={styles.address}>
                {e.address}, {e.city}, {e.state} – {e.pincode}
              </Text>
              <Text style={styles.meta}>
                {e.items.length} products ·{' '}
                {e.dispatch_date
                  ? `dispatched ${formatDate(e.dispatch_date)}${e.transport_name ? ` by ${e.transport_name}` : ''}${e.lr_number ? `, LR ${e.lr_number}` : ''}`
                  : `ordered ${formatDate(e.created_at)}`}
                {e.delivered_on ? ` · delivered ${formatDate(e.delivered_on)}` : ''}
              </Text>
              <View style={styles.actions}>
                {view === 'ready' && e.status !== 'packed' ? (
                  <Btn small title="Mark packed" loading={update.isPending && update.variables?.number === e.number && update.variables.patch.status === 'packed'} onPress={() => update.mutate({ number: e.number, patch: { status: 'packed' } })} />
                ) : null}
                {view === 'ready' ? <Btn small kind="primary" title="Dispatch" onPress={() => setDispatching(e)} /> : null}
                {view === 'transit' ? (
                  <Btn small kind="primary" title="Mark delivered" onPress={() => update.mutate({ number: e.number, patch: { status: 'delivered' } })} />
                ) : null}
                {view === 'transit' ? <Btn small title="Edit LR" onPress={() => setDispatching(e)} /> : null}
              </View>
            </View>
          ))}
        </View>
      )}
      {dispatching ? (
        <DispatchSheet
          estimate={dispatching}
          saving={update.isPending}
          onClose={() => setDispatching(null)}
          onSave={(patch) => update.mutate({ number: dispatching.number, patch })}
        />
      ) : null}
    </Page>
  );
}

function DispatchSheet({ estimate, saving, onClose, onSave }: { estimate: AdminEstimate; saving: boolean; onClose: () => void; onSave: (p: EstimatePatch) => void }) {
  const [transport, setTransport] = useState(estimate.transport_name);
  const [lr, setLr] = useState(estimate.lr_number);
  const [date, setDate] = useState(estimate.dispatch_date ?? isoDate());
  return (
    <Sheet visible title={`Dispatch ${estimate.number}`} onClose={onClose}>
      <Text style={styles.address}>
        {estimate.customer_name}, {estimate.address}, {estimate.city} – {estimate.pincode}
      </Text>
      <FormRow>
        <Field label="Transport" value={transport} onChangeText={setTransport} placeholder="KPN, ABT Parcel…" />
        <Field label="LR / tracking number" value={lr} onChangeText={setLr} />
      </FormRow>
      <Field label="Dispatched on" value={date} onChangeText={setDate} />
      <Btn
        kind="primary"
        title={estimate.status === 'dispatched' ? 'Save' : 'Mark dispatched'}
        loading={saving}
        onPress={() => onSave({ status: 'dispatched', transport_name: transport, lr_number: lr, dispatch_date: date || null })}
      />
    </Sheet>
  );
}

const styles = StyleSheet.create({
  filters: { gap: 14 },
  empty: { color: tone.muted, ...type.regular, fontSize: 16, paddingVertical: 32 },
  grid: { gap: 12 },
  gridWide: { flexDirection: 'row', flexWrap: 'wrap' },
  card: { backgroundColor: tone.panel, borderRadius: 16, padding: 18, gap: 8 },
  cardWide: { flexBasis: 360, flexGrow: 1, maxWidth: 620 },
  cardHead: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline' },
  number: { color: tone.ink, ...type.semibold, fontSize: 18 },
  total: { color: tone.ink, ...type.semibold, fontSize: 18, fontVariant: ['tabular-nums'] },
  pills: { flexDirection: 'row', gap: 8, flexWrap: 'wrap' },
  name: { color: tone.ink, ...type.medium, fontSize: 15 },
  address: { color: tone.soft, ...type.regular, fontSize: 15, lineHeight: 22 },
  meta: { color: tone.muted, ...type.regular, fontSize: 14 },
  actions: { flexDirection: 'row', gap: 8, flexWrap: 'wrap', marginTop: 4 },
});
