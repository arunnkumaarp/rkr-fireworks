import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { Linking, StyleSheet, Text, TextInput, View } from 'react-native';

import {
  admin as tone,
  Btn,
  Chips,
  Columns,
  confirm,
  ErrorText,
  Field,
  fieldErrors,
  FormRow,
  Line,
  Loading,
  Note,
  Page,
  Panel,
  Pill,
  Section,
  Sheet,
} from '@/components/admin/ui';
import { QtyInput } from '@/components/qty-input';
import { colors, fonts } from '@/components/theme';
import { admin, type AdminEstimate, type EstimatePatch } from '@/lib/admin-api';
import { formatDate, formatDateTime, formatRupees, isoDate, toPaise } from '@/lib/format';
import { ADMIN_STATUS_LABEL, METHOD_LABEL, METHODS, PAYMENT_LABEL, PAYMENT_TONE, STATUS_TONE, STATUSES } from '@/lib/status';
import { useAuth } from '@/store/auth';

const TEXT_FIELDS = [
  'status', 'transport_name', 'lr_number', 'admin_notes', 'customer_name', 'phone', 'address', 'city', 'state', 'pincode', 'notes',
] as const;
type TextField = (typeof TEXT_FIELDS)[number];

type Draft = Record<TextField, string> & {
  dispatch_date: string;
  delivered_on: string;
  items: Record<number, { quantity: number; price: string }>;
};

function toDraft(e: AdminEstimate): Draft {
  return {
    ...(Object.fromEntries(TEXT_FIELDS.map((f) => [f, e[f] ?? ''])) as Record<TextField, string>),
    dispatch_date: e.dispatch_date ?? '',
    delivered_on: e.delivered_on ?? '',
    items: Object.fromEntries(e.items.map((i) => [i.id, { quantity: i.quantity, price: i.price }])),
  };
}

function toPatch(e: AdminEstimate, d: Draft): EstimatePatch {
  const patch: EstimatePatch = {};
  for (const f of TEXT_FIELDS) if (d[f] !== (e[f] ?? '')) (patch as Record<string, string>)[f] = d[f];
  if (d.dispatch_date !== (e.dispatch_date ?? '')) patch.dispatch_date = d.dispatch_date || null;
  if (d.delivered_on !== (e.delivered_on ?? '')) patch.delivered_on = d.delivered_on || null;
  const changes = e.items
    .filter((i) => d.items[i.id].quantity !== i.quantity || toPaise(d.items[i.id].price) !== toPaise(i.price))
    .map((i) => ({ id: i.id, quantity: d.items[i.id].quantity, price: Number(d.items[i.id].price || 0).toFixed(2) }));
  if (changes.length) patch.item_changes = changes;
  return patch;
}

export default function AdminOrderDetail() {
  const { number } = useLocalSearchParams<{ number: string }>();
  const isAdmin = useAuth((s) => s.user?.role === 'admin');
  const queryClient = useQueryClient();
  const key = ['admin', 'estimate', number];
  const estimate = useQuery({ queryKey: key, queryFn: () => admin.estimate(number) });
  const [draft, setDraft] = useState<Draft | null>(null);
  const [draftOf, setDraftOf] = useState<AdminEstimate | undefined>();
  const [paying, setPaying] = useState(false);
  // Reset the draft whenever a fresh copy arrives from the server (first load or after saving).
  if (estimate.data && estimate.data !== draftOf) {
    setDraftOf(estimate.data);
    setDraft(toDraft(estimate.data));
  }

  const refreshLists = () => {
    for (const k of ['estimates', 'dashboard', 'notifications', 'payments', 'customers', 'products']) {
      queryClient.invalidateQueries({ queryKey: ['admin', k] });
    }
  };
  const save = useMutation({
    mutationFn: (patch: EstimatePatch) => admin.updateEstimate(number, patch),
    onSuccess: (updated) => {
      queryClient.setQueryData(key, updated);
      refreshLists();
    },
  });
  const removePayment = useMutation({
    mutationFn: admin.deletePayment,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: key });
      refreshLists();
    },
  });

  if (!estimate.data || !draft) {
    return (
      <Page title={`Order ${number}`} back="/admin/estimates">
        {estimate.isError ? <ErrorText error={estimate.error} /> : <Loading />}
      </Page>
    );
  }

  const e = estimate.data;
  const patch = toPatch(e, draft);
  const dirty = Object.keys(patch).length > 0;
  const errors = fieldErrors(save.error);
  const draftSubtotal = e.items.reduce((sum, i) => sum + toPaise(draft.items[i.id].price || 0) * draft.items[i.id].quantity, 0) / 100;
  const set = (f: keyof Draft) => (v: string) => setDraft((d) => d && { ...d, [f]: v });
  const setItem = (id: number, change: Partial<Draft['items'][number]>) =>
    setDraft((d) => d && { ...d, items: { ...d.items, [id]: { ...d.items[id], ...change } } });

  const saveBar = (
    <View style={styles.saveBar}>
      {save.error ? <ErrorText error={save.error} /> : null}
      <View style={styles.saveRow}>
        {dirty ? <Btn title="Undo changes" onPress={() => setDraft(toDraft(e))} /> : null}
        <Btn
          kind="primary"
          title={dirty ? 'Save changes' : save.isSuccess ? 'Saved' : 'No changes'}
          disabled={!dirty}
          loading={save.isPending}
          onPress={() => save.mutate(patch)}
        />
      </View>
    </View>
  );

  return (
    <Page
      title={`Order ${e.number}`}
      lead={`Placed ${formatDateTime(e.created_at)} by ${e.email || 'a customer'}.`}
      back="/admin/estimates"
      actions={
        <>
          <Btn title="Call" onPress={() => Linking.openURL(`tel:${e.phone}`)} />
          <Btn
            title="WhatsApp"
            onPress={() => Linking.openURL(`https://wa.me/91${e.phone}?text=${encodeURIComponent(`Hello ${e.customer_name}, about your estimate ${e.number}`)}`)}
          />
        </>
      }>
      <View style={styles.pills}>
        <Pill label={ADMIN_STATUS_LABEL[e.status]} tone={STATUS_TONE[e.status]} />
        <Pill label={PAYMENT_LABEL[e.payment_status]} tone={PAYMENT_TONE[e.payment_status]} />
        {e.coupon_code ? <Pill label={`Coupon ${e.coupon_code}`} tone="gold" /> : null}
      </View>

      <Section title="Status">
        <Chips wrap options={STATUSES.map((s) => ({ value: s, label: ADMIN_STATUS_LABEL[s] }))} value={draft.status} onChange={set('status')} />
        <Note>
          Confirming takes tracked stock; cancelling gives it back. Dispatch and delivery dates fill in on their own when you move the order on.
        </Note>
        {errors.stock ? <Text style={styles.error}>{errors.stock}</Text> : null}
      </Section>

      <Columns min={1000} gap={28}>
        <View style={styles.flex3}>
          <Section title="Items">
            <Note>Change quantities or prices after the call. Quantity 0 removes the item.</Note>
            <Panel>
              {e.items.map((i) => {
                const d = draft.items[i.id];
                return (
                  <View key={i.id} style={[styles.item, d.quantity === 0 && styles.itemRemoved]}>
                    <View style={styles.itemInfo}>
                      <Text style={styles.itemName}>
                        {i.code}. {i.name}
                      </Text>
                      <Text style={styles.itemMeta}>
                        MRP {formatRupees(i.mrp)} / {i.unit} · line {formatRupees((toPaise(d.price || 0) * d.quantity) / 100)}
                      </Text>
                    </View>
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
              <View style={styles.totals}>
                <Line label="Subtotal" value={formatRupees(draftSubtotal)} />
                {Number(e.discount) > 0 ? <Line label={`Coupon ${e.coupon_code}`} value={`− ${formatRupees(e.discount)}`} /> : null}
                {Number(e.packing_charge) > 0 ? <Line label="Packing" value={formatRupees(e.packing_charge)} /> : null}
                <Line label="Order total" value={formatRupees(e.total)} strong />
                {patch.item_changes ? <Note>Totals, coupon and packing are recalculated when you save.</Note> : null}
              </View>
            </Panel>
          </Section>

          <Section title="Payments" actions={isAdmin ? <Btn small kind="primary" title="Record payment" onPress={() => setPaying(true)} /> : undefined}>
            <Panel>
              <Line label="Received so far" value={formatRupees(e.amount_paid)} />
              <Line label="Balance to collect" value={formatRupees(e.balance)} strong />
              {(e.payments ?? []).map((p) => (
                <View key={p.id} style={styles.payment}>
                  <View style={styles.flex3}>
                    <Text style={styles.payTitle}>
                      {p.kind === 'refund' ? 'Refund' : 'Payment'} · {METHOD_LABEL[p.method]} · {formatDate(p.paid_on)}
                    </Text>
                    <Text style={styles.itemMeta}>
                      {[p.reference && `Ref ${p.reference}`, p.note, p.recorded_by && `by ${p.recorded_by}`].filter(Boolean).join(' · ')}
                    </Text>
                  </View>
                  <Text style={[styles.payAmount, p.kind === 'refund' && styles.refund]}>
                    {p.kind === 'refund' ? '− ' : ''}
                    {formatRupees(p.amount)}
                  </Text>
                  {isAdmin ? (
                    <Btn
                      small
                      kind="danger"
                      title="Remove"
                      onPress={async () => {
                        if (await confirm(`Remove this ${p.kind} of ${formatRupees(p.amount)}? Use this only for entries made by mistake.`)) {
                          removePayment.mutate(p.id);
                        }
                      }}
                    />
                  ) : null}
                </View>
              ))}
              {!e.payments?.length ? <Note>No payments recorded yet.</Note> : null}
              {!isAdmin ? <Note>Only admins can record payments.</Note> : null}
            </Panel>
          </Section>
        </View>

        <View style={styles.flex2}>
          <Section title="Dispatch">
            <Panel>
              <FormRow>
                <Field label="Transport" value={draft.transport_name} onChangeText={set('transport_name')} placeholder="KPN, ABT Parcel…" />
                <Field label="LR / tracking number" value={draft.lr_number} onChangeText={set('lr_number')} />
              </FormRow>
              <FormRow>
                <Field label="Dispatched on" value={draft.dispatch_date} onChangeText={set('dispatch_date')} placeholder="YYYY-MM-DD" error={errors.dispatch_date} />
                <Field label="Delivered on" value={draft.delivered_on} onChangeText={set('delivered_on')} placeholder="YYYY-MM-DD" error={errors.delivered_on} />
              </FormRow>
            </Panel>
          </Section>

          <Section title="Customer and delivery address">
            <Panel>
              <FormRow>
                <Field label="Name" value={draft.customer_name} onChangeText={set('customer_name')} error={errors.customer_name} />
                <Field label="Phone" value={draft.phone} onChangeText={set('phone')} keyboardType="phone-pad" error={errors.phone} />
              </FormRow>
              <Field label="Address" value={draft.address} onChangeText={set('address')} multiline error={errors.address} />
              <FormRow>
                <Field label="City" value={draft.city} onChangeText={set('city')} />
                <Field label="State" value={draft.state} onChangeText={set('state')} />
                <Field label="Pincode" value={draft.pincode} onChangeText={set('pincode')} keyboardType="number-pad" />
              </FormRow>
              <Field label="Customer's note" value={draft.notes} onChangeText={set('notes')} multiline />
            </Panel>
          </Section>

          <Section title="Shop notes">
            <Field label="Only the shop sees this" value={draft.admin_notes} onChangeText={set('admin_notes')} multiline placeholder="Call notes, special packing…" />
          </Section>
        </View>
      </Columns>

      {saveBar}

      <PaymentSheet estimate={e} visible={paying} onClose={() => setPaying(false)} onSaved={() => { queryClient.invalidateQueries({ queryKey: key }); refreshLists(); }} />
    </Page>
  );
}

function PaymentSheet({ estimate, visible, onClose, onSaved }: { estimate: AdminEstimate; visible: boolean; onClose: () => void; onSaved: () => void }) {
  const [kind, setKind] = useState<'payment' | 'refund'>('payment');
  const [method, setMethod] = useState('upi');
  const [amount, setAmount] = useState('');
  const [paidOn, setPaidOn] = useState(isoDate());
  const [reference, setReference] = useState('');
  const [note, setNote] = useState('');
  const add = useMutation({
    mutationFn: admin.addPayment,
    onSuccess: () => {
      onSaved();
      setAmount('');
      setReference('');
      setNote('');
      onClose();
    },
  });
  const errors = fieldErrors(add.error);
  const suggested = kind === 'payment' ? estimate.balance : estimate.amount_paid;

  return (
    <Sheet visible={visible} title={kind === 'payment' ? 'Record payment' : 'Record refund'} onClose={onClose}>
      <Chips wrap options={[{ value: 'payment', label: 'Payment received' }, { value: 'refund', label: 'Refund paid' }]} value={kind} onChange={(v) => setKind(v as typeof kind)} />
      <Chips wrap options={METHODS} value={method} onChange={setMethod} />
      <FormRow>
        <Field label="Amount (₹)" value={amount} onChangeText={(t) => setAmount(t.replace(/[^\d.]/g, ''))} keyboardType="decimal-pad" placeholder={suggested} error={errors.amount} />
        <Field label="Date" value={paidOn} onChangeText={setPaidOn} error={errors.paid_on} />
      </FormRow>
      <Field label="Reference" value={reference} onChangeText={setReference} placeholder="UPI ref, cheque no." />
      <Field label="Note" value={note} onChangeText={setNote} />
      {Number(suggested) > 0 && !amount ? <Btn small title={`Use ${formatRupees(suggested)}`} onPress={() => setAmount(suggested)} /> : null}
      <ErrorText error={add.error && !errors.amount ? add.error : null} />
      <Btn
        kind="primary"
        title="Save"
        loading={add.isPending}
        disabled={!Number(amount)}
        onPress={() => add.mutate({ estimate: estimate.number, kind, method, amount: Number(amount).toFixed(2), paid_on: paidOn, reference, note })}
      />
    </Sheet>
  );
}

const styles = StyleSheet.create({
  pills: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: -16 },
  flex3: { flex: 3, gap: 28 },
  flex2: { flex: 2, gap: 28 },
  item: { gap: 10, paddingVertical: 6 },
  itemRemoved: { opacity: 0.4 },
  itemInfo: { gap: 2 },
  itemName: { color: tone.ink, fontFamily: fonts.textSemi, fontSize: 15 },
  itemMeta: { color: tone.muted, fontFamily: fonts.text, fontSize: 13 },
  itemControls: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: 12 },
  price: {
    width: 110, height: 38, borderRadius: 8, borderWidth: 1, borderColor: tone.line, paddingHorizontal: 10,
    fontFamily: fonts.text, fontSize: 15, color: tone.ink, backgroundColor: tone.well, fontVariant: ['tabular-nums'],
  },
  totals: { gap: 6, marginTop: 8, paddingTop: 12, backgroundColor: tone.panel },
  payment: { flexDirection: 'row', alignItems: 'center', gap: 12, backgroundColor: tone.raised, borderRadius: 12, padding: 12 },
  payTitle: { color: tone.ink, fontFamily: fonts.textSemi, fontSize: 15 },
  payAmount: { color: colors.green, fontFamily: fonts.textBold, fontSize: 16, fontVariant: ['tabular-nums'] },
  refund: { color: colors.danger },
  saveBar: { gap: 10, alignItems: 'flex-end' },
  saveRow: { flexDirection: 'row', gap: 10 },
  error: { color: colors.danger, fontFamily: fonts.textSemi, fontSize: 15 },
});
