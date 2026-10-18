import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { ActivityIndicator, Linking, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';

import { Button } from '@/components/button';
import { QtyInput } from '@/components/qty-input';
import { colors, fonts } from '@/components/theme';
import { api, type AdminEstimate, type EstimatePatch } from '@/lib/api';
import { formatRupees, toPaise } from '@/lib/format';
import { ADMIN_STATUS_LABEL, STATUSES } from '@/lib/status';

type Draft = {
  status: string;
  transport_name: string;
  lr_number: string;
  items: Record<number, { quantity: number; price: string }>;
};

function toDraft(e: AdminEstimate): Draft {
  return {
    status: e.status,
    transport_name: e.transport_name,
    lr_number: e.lr_number,
    items: Object.fromEntries(e.items.map((i) => [i.id, { quantity: i.quantity, price: i.price }])),
  };
}

function toPatch(e: AdminEstimate, d: Draft): EstimatePatch {
  const patch: EstimatePatch = {};
  if (d.status !== e.status) patch.status = d.status;
  if (d.transport_name !== e.transport_name) patch.transport_name = d.transport_name;
  if (d.lr_number !== e.lr_number) patch.lr_number = d.lr_number;
  const changes = e.items
    .filter((i) => d.items[i.id].quantity !== i.quantity || toPaise(d.items[i.id].price) !== toPaise(i.price))
    .map((i) => ({ id: i.id, quantity: d.items[i.id].quantity, price: Number(d.items[i.id].price || 0).toFixed(2) }));
  if (changes.length) patch.item_changes = changes;
  return patch;
}

export default function AdminEstimateDetail() {
  const { number } = useLocalSearchParams<{ number: string }>();
  const queryClient = useQueryClient();
  const estimate = useQuery({ queryKey: ['admin', 'estimate', number], queryFn: () => api.admin.estimate(number) });
  const [draft, setDraft] = useState<Draft | null>(null);
  // Reset the draft whenever a fresh copy arrives from the server (first load or after saving).
  const [draftOf, setDraftOf] = useState<AdminEstimate | undefined>();
  if (estimate.data && estimate.data !== draftOf) {
    setDraftOf(estimate.data);
    setDraft(toDraft(estimate.data));
  }

  const save = useMutation({
    mutationFn: (patch: EstimatePatch) => api.admin.updateEstimate(number, patch),
    onSuccess: (updated) => {
      queryClient.setQueryData(['admin', 'estimate', number], updated);
      queryClient.invalidateQueries({ queryKey: ['admin', 'estimates'] });
      queryClient.invalidateQueries({ queryKey: ['admin', 'dashboard'] });
    },
  });

  if (!estimate.data || !draft) {
    return estimate.isError ? (
      <Text style={styles.error}>{estimate.error.message}</Text>
    ) : (
      <ActivityIndicator style={styles.center} size="large" color={colors.primary} />
    );
  }

  const e = estimate.data;
  const patch = toPatch(e, draft);
  const dirty = Object.keys(patch).length > 0;
  const draftTotal =
    e.items.reduce((sum, i) => sum + toPaise(draft.items[i.id].price || 0) * draft.items[i.id].quantity, 0) / 100;
  const setItem = (id: number, change: Partial<Draft['items'][number]>) =>
    setDraft((d) => d && { ...d, items: { ...d.items, [id]: { ...d.items[id], ...change } } });

  return (
    <ScrollView contentContainerStyle={styles.container} keyboardShouldPersistTaps="handled">
      <View style={styles.block}>
        <Text style={styles.title}>{e.customer_name}</Text>
        <Text style={styles.body}>
          {e.phone} · {e.email}
          {'\n'}
          {e.address}, {e.city}, {e.state} – {e.pincode}
        </Text>
        {e.notes ? <Text style={styles.body}>Note: {e.notes}</Text> : null}
        <View style={styles.actions}>
          <Button title="Call" onPress={() => Linking.openURL(`tel:${e.phone}`)} style={styles.flex} />
          <Button
            title="WhatsApp"
            variant="whatsapp"
            onPress={() => Linking.openURL(`https://wa.me/91${e.phone}?text=${encodeURIComponent(`Hello ${e.customer_name}, about your estimate ${e.number}`)}`)}
            style={styles.flex}
          />
        </View>
      </View>

      <View style={styles.block}>
        <Text style={styles.heading}>Status</Text>
        <View style={styles.chips}>
          {STATUSES.map((s) => (
            <Pressable
              key={s}
              accessibilityRole="button"
              accessibilityState={{ selected: draft.status === s }}
              onPress={() => setDraft({ ...draft, status: s })}
              style={[styles.chip, draft.status === s && styles.chipActive]}>
              <Text style={[styles.chipText, draft.status === s && styles.chipTextActive]}>{ADMIN_STATUS_LABEL[s]}</Text>
            </Pressable>
          ))}
        </View>
        <View style={styles.actions}>
          <Field label="Transport" value={draft.transport_name} onChange={(v) => setDraft({ ...draft, transport_name: v })} />
          <Field label="LR number" value={draft.lr_number} onChange={(v) => setDraft({ ...draft, lr_number: v })} />
        </View>
      </View>

      <View style={styles.block}>
        <Text style={styles.heading}>Items</Text>
        <Text style={styles.hint}>Change quantities or prices after the call. Quantity 0 removes the item.</Text>
        {e.items.map((i) => {
          const d = draft.items[i.id];
          return (
            <View key={i.id} style={[styles.item, d.quantity === 0 && styles.itemRemoved]}>
              <Text style={styles.itemName}>
                {i.code}. {i.name}
              </Text>
              <View style={styles.itemControls}>
                <TextInput
                  value={d.price}
                  onChangeText={(t) => setItem(i.id, { price: t.replace(/[^\d.]/g, '') })}
                  keyboardType="decimal-pad"
                  style={styles.price}
                  accessibilityLabel={`Price of ${i.name}`}
                />
                <QtyInput value={d.quantity} onChange={(q) => setItem(i.id, { quantity: Math.max(q, 0) })} label={i.name} />
              </View>
            </View>
          );
        })}
        <View style={styles.totalRow}>
          <Text style={styles.heading}>Subtotal</Text>
          <Text style={styles.heading}>{formatRupees(draftTotal)}</Text>
        </View>
        {Number(e.packing_charge) > 0 && <Text style={styles.hint}>Packing charge is recalculated when you save.</Text>}
      </View>

      {save.error ? <Text style={styles.error}>{save.error.message}</Text> : null}
      <Button
        title={dirty ? 'Save changes' : save.isSuccess ? 'Saved' : 'No changes'}
        disabled={!dirty}
        loading={save.isPending}
        onPress={() => save.mutate(patch)}
      />
    </ScrollView>
  );
}

function Field({ label, value, onChange }: { label: string; value: string; onChange: (v: string) => void }) {
  return (
    <View style={styles.flex}>
      <Text style={styles.label}>{label}</Text>
      <TextInput value={value} onChangeText={onChange} style={styles.input} accessibilityLabel={label} />
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  center: { flex: 1, justifyContent: 'center' },
  container: { padding: 16, gap: 18, width: '100%', maxWidth: 720, alignSelf: 'center' },
  block: { gap: 10 },
  title: { fontFamily: fonts.display, fontSize: 26, color: colors.text },
  heading: { fontFamily: fonts.textBold, fontSize: 18, color: colors.text },
  body: { fontFamily: fonts.text, fontSize: 15, color: colors.text, lineHeight: 22 },
  hint: { fontFamily: fonts.text, fontSize: 14, color: colors.muted },
  actions: { flexDirection: 'row', gap: 10 },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip: { paddingHorizontal: 14, paddingVertical: 8, borderRadius: 999, backgroundColor: colors.surfaceAlt },
  chipActive: { backgroundColor: colors.purple },
  chipText: { fontFamily: fonts.textSemi, fontSize: 14, color: colors.text },
  chipTextActive: { color: '#fff' },
  label: { fontFamily: fonts.textSemi, fontSize: 14, color: colors.text, marginBottom: 4 },
  input: {
    height: 44,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: colors.border,
    paddingHorizontal: 12,
    fontFamily: fonts.text, fontSize: 16,
    color: colors.text,
    backgroundColor: colors.surface,
  },
  item: { backgroundColor: colors.surfaceAlt, borderRadius: 12, padding: 12, gap: 8 },
  itemRemoved: { opacity: 0.45 },
  itemName: { fontFamily: fonts.textSemi, fontSize: 15, color: colors.text },
  itemControls: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: 12 },
  price: {
    width: 110,
    height: 36,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: colors.border,
    paddingHorizontal: 10,
    fontFamily: fonts.text, fontSize: 15,
    color: colors.text,
    backgroundColor: colors.surface,
  },
  totalRow: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 4 },
  error: { color: colors.danger, fontFamily: fonts.textSemi, padding: 4 },
});
