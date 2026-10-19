import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';

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
  Table,
  Toggle,
} from '@/components/admin/ui';
import { fonts } from '@/components/theme';
import { admin, type AdminProduct, type ProductInput, type StockChange } from '@/lib/admin-api';
import { formatDateTime, formatRupees } from '@/lib/format';
import { STOCK_LABEL, STOCK_TONE } from '@/lib/status';

type Form = {
  code: string;
  name: string;
  category: string;
  unit: string;
  mrp: string;
  discount_percent: string;
  description: string;
  video_url: string;
  is_active: boolean;
  low_stock_threshold: string;
};

const EMPTY: Form = {
  code: '', name: '', category: '', unit: 'Box', mrp: '', discount_percent: '80', description: '', video_url: '', is_active: true, low_stock_threshold: '10',
};

const toForm = (p: AdminProduct): Form => ({
  code: String(p.code),
  name: p.name,
  category: String(p.category),
  unit: p.unit,
  mrp: p.mrp,
  discount_percent: p.discount_percent,
  description: p.description,
  video_url: p.video_url,
  is_active: p.is_active,
  low_stock_threshold: String(p.low_stock_threshold),
});

function toInput(f: Form): ProductInput {
  return {
    code: Number(f.code),
    name: f.name.trim(),
    category: Number(f.category),
    unit: f.unit,
    mrp: f.mrp,
    discount_percent: f.discount_percent || '0',
    description: f.description,
    video_url: f.video_url.trim(),
    is_active: f.is_active,
    low_stock_threshold: Number(f.low_stock_threshold || 0),
  };
}

export default function ProductEditor() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const isNew = id === 'new';
  const product = useQuery({ queryKey: ['admin', 'products', id], queryFn: () => admin.product(Number(id)), enabled: !isNew });
  const categories = useQuery({ queryKey: ['admin', 'categories'], queryFn: admin.categories });
  const all = useQuery({ queryKey: ['admin', 'products'], queryFn: () => admin.products(), enabled: isNew });
  const [form, setForm] = useState<Form | null>(isNew ? EMPTY : null);
  const [formOf, setFormOf] = useState<AdminProduct | undefined>();
  if (product.data && product.data !== formOf) {
    setFormOf(product.data);
    setForm(toForm(product.data));
  }
  // Suggest the next free code for a new product.
  if (isNew && form && !form.code && all.data?.length) {
    setForm({ ...form, code: String(Math.max(...all.data.map((p) => p.code)) + 1) });
  }

  const queryClient = useQueryClient();
  const refresh = (saved?: AdminProduct) => {
    if (saved) queryClient.setQueryData(['admin', 'products', String(saved.id)], saved);
    for (const k of [['admin', 'products'], ['admin', 'inventory'], ['admin', 'dashboard'], ['products']]) queryClient.invalidateQueries({ queryKey: k });
  };
  const save = useMutation({
    mutationFn: (f: Form) => (isNew ? admin.createProduct(toInput(f)) : admin.updateProduct(Number(id), toInput(f))),
    onSuccess: (saved) => {
      refresh(saved);
      if (isNew) router.replace({ pathname: '/admin/products/[id]', params: { id: String(saved.id) } });
    },
  });
  const remove = useMutation({
    mutationFn: () => admin.deleteProduct(Number(id)),
    onSuccess: () => {
      refresh();
      router.replace('/admin/products');
    },
  });

  if (!form) {
    return (
      <Page title="Product" back="/admin/products">
        {product.isError ? <ErrorText error={product.error} /> : <Loading />}
      </Page>
    );
  }

  const errors = fieldErrors(save.error);
  const set = (k: keyof Form) => (v: string) => setForm({ ...form, [k]: v });
  const num = (k: keyof Form) => (v: string) => setForm({ ...form, [k]: v.replace(/[^\d.]/g, '') });
  const preview = Number(form.mrp) * (1 - Number(form.discount_percent || 0) / 100);
  const p = product.data;
  const valid = form.name.trim() && form.category && Number(form.mrp) > 0 && Number(form.code) > 0;

  return (
    <Page
      title={isNew ? 'Add product' : form.name || 'Product'}
      lead={isNew ? 'New products show on the shop app as soon as they are saved and switched on.' : `Code ${p?.code} · last changed ${formatDateTime(p?.updated_at)}`}
      back="/admin/products">
      <Columns min={1000} gap={28}>
        <View style={styles.main}>
          <Section title="Details">
            <Panel>
              <FormRow>
                <Field label="Code" value={form.code} onChangeText={num('code')} keyboardType="number-pad" error={errors.code} hint="Number on the printed list" />
                <Field label="Name" value={form.name} onChangeText={set('name')} error={errors.name} style={{ flexGrow: 3 }} />
              </FormRow>
              <View style={styles.group}>
                <Text style={styles.label}>Category</Text>
                <Chips wrap options={(categories.data ?? []).map((c) => ({ value: String(c.id), label: c.name }))} value={form.category} onChange={set('category')} />
                {errors.category ? <Text style={styles.error}>{errors.category}</Text> : null}
              </View>
              <View style={styles.group}>
                <Text style={styles.label}>Sold by</Text>
                <Chips wrap options={[{ value: 'Box', label: 'Box' }, { value: 'PKT', label: 'Packet' }, { value: 'Pcs', label: 'Pieces' }]} value={form.unit} onChange={set('unit')} />
              </View>
              <Field label="Description" value={form.description} onChangeText={set('description')} multiline />
              <Field label="Video link" value={form.video_url} onChangeText={set('video_url')} placeholder="https://youtube.com/…" error={errors.video_url} autoCapitalize="none" />
            </Panel>
          </Section>
        </View>

        <View style={styles.side}>
          <Section title="Price">
            <Panel>
              <FormRow>
                <Field label="MRP (₹)" value={form.mrp} onChangeText={num('mrp')} keyboardType="decimal-pad" error={errors.mrp} />
                <Field label="Discount %" value={form.discount_percent} onChangeText={num('discount_percent')} keyboardType="decimal-pad" error={errors.discount_percent} />
              </FormRow>
              <Line label="Customer pays" value={Number.isFinite(preview) && preview > 0 ? formatRupees(preview) : '—'} strong />
              {p && p.effective_discount !== p.discount_percent ? (
                <Note>A seasonal offer of {Number(p.effective_discount)}% is running, so customers pay {formatRupees(p.offer_price)} today.</Note>
              ) : null}
              <Toggle label={form.is_active ? 'On sale' : 'Switched off (hidden from customers)'} value={form.is_active} onChange={(v) => setForm({ ...form, is_active: v })} />
            </Panel>
          </Section>
          {p ? <StockPanel product={p} onChanged={refresh} /> : <Note>Stock tracking can be switched on after the product is saved.</Note>}
          <Field label="Warn when stock falls to" value={form.low_stock_threshold} onChangeText={num('low_stock_threshold')} keyboardType="number-pad" />
        </View>
      </Columns>

      <ErrorText error={save.error && !Object.keys(errors).some((k) => k in EMPTY) ? save.error : null} />
      <ErrorText error={remove.error} />
      <View style={styles.bar}>
        {!isNew ? (
          <Btn
            kind="danger"
            title="Delete"
            loading={remove.isPending}
            onPress={async () => {
              if (await confirm(`Delete ${form.name}? Products already on orders can't be deleted; switch them off instead.`)) remove.mutate();
            }}
          />
        ) : null}
        <View style={styles.spacer} />
        <Btn kind="primary" title={isNew ? 'Add product' : save.isSuccess && !save.isPending ? 'Saved' : 'Save'} disabled={!valid} loading={save.isPending} onPress={() => save.mutate(form)} />
      </View>
    </Page>
  );
}

function StockPanel({ product, onChanged }: { product: AdminProduct; onChanged: (p: AdminProduct) => void }) {
  const [qty, setQty] = useState('');
  const [note, setNote] = useState('');
  const queryClient = useQueryClient();
  const movements = useQuery({ queryKey: ['admin', 'movements', product.id], queryFn: () => admin.movements({ product: product.id }) });
  const change = useMutation({
    mutationFn: (body: StockChange) => admin.changeStock(product.id, body),
    onSuccess: (saved) => {
      setQty('');
      setNote('');
      onChanged(saved);
      queryClient.invalidateQueries({ queryKey: ['admin', 'movements', product.id] });
    },
  });
  const n = Number(qty);
  const tracked = product.stock !== null;
  const errors = fieldErrors(change.error);

  return (
    <Section title="Stock">
      <Panel>
        <View style={styles.stockHead}>
          <Text style={styles.stockNumber}>{tracked ? product.stock : '—'}</Text>
          <Pill label={STOCK_LABEL[product.stock_state]} tone={STOCK_TONE[product.stock_state]} />
        </View>
        <Note>
          {tracked
            ? 'Confirmed orders take stock automatically. At zero the product leaves the price list.'
            : 'Not tracked: the product stays on sale whatever the count. Set a count to start tracking.'}
        </Note>
        <FormRow>
          <Field label="Quantity" value={qty} onChangeText={(t) => setQty(t.replace(/\D/g, ''))} keyboardType="number-pad" error={errors.quantity} />
          <Field label="Note" value={note} onChangeText={setNote} placeholder="Supplier, bill no." />
        </FormRow>
        <View style={styles.stockActions}>
          {tracked ? (
            <>
              <Btn small kind="primary" title="Add" disabled={!n} loading={change.isPending} onPress={() => change.mutate({ mode: 'add', quantity: n, note, reason: 'restock' })} />
              <Btn small title="Remove damaged" disabled={!n} onPress={() => change.mutate({ mode: 'remove', quantity: n, note, reason: 'damage' })} />
              <Btn small title="Set count" disabled={qty === ''} onPress={() => change.mutate({ mode: 'set', quantity: n, note, reason: 'adjustment' })} />
              <Btn small title="Stop tracking" onPress={() => change.mutate({ mode: 'untrack' })} />
            </>
          ) : (
            <Btn small kind="primary" title="Start tracking at this count" disabled={qty === ''} loading={change.isPending} onPress={() => change.mutate({ mode: 'set', quantity: n, note })} />
          )}
        </View>
        <ErrorText error={change.error && !errors.quantity ? change.error : null} />
      </Panel>
      {movements.data?.length ? (
        <Table
          rows={movements.data.slice(0, 12)}
          keyOf={(m) => m.id}
          columns={[
            { key: 'd', label: 'When', flex: 1.3, render: (m) => formatDateTime(m.created_at) },
            { key: 'r', label: 'Why', flex: 1.6, render: (m) => [m.reason_label, m.estimate, m.note].filter(Boolean).join(' · ') },
            { key: 'c', label: 'Change', align: 'right', render: (m) => (m.change > 0 ? `+${m.change}` : String(m.change)) },
            { key: 'b', label: 'Left', align: 'right', render: (m) => String(m.balance) },
          ]}
        />
      ) : null}
    </Section>
  );
}

const styles = StyleSheet.create({
  main: { flex: 3, gap: 28 },
  side: { flex: 2, gap: 20 },
  group: { gap: 8 },
  label: { color: tone.ink, fontFamily: fonts.textSemi, fontSize: 14 },
  error: { color: '#FF8A7A', fontFamily: fonts.text, fontSize: 13 },
  bar: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  spacer: { flex: 1 },
  stockHead: { flexDirection: 'row', alignItems: 'center', gap: 14 },
  stockNumber: { color: tone.ink, fontFamily: fonts.display, fontSize: 56, lineHeight: 60, fontVariant: ['tabular-nums'] },
  stockActions: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
});
