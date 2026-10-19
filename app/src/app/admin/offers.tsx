import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { admin as tone, Btn, Chips, confirm, ErrorText, Field, fieldErrors, FormRow, Note, Page, Pill, Section, Sheet, Table, Toggle } from '@/components/admin/ui';
import { fonts } from '@/components/theme';
import { admin, type Coupon, type Offer } from '@/lib/admin-api';
import { formatDate, formatRupees, isoDate } from '@/lib/format';

type OfferDraft = { id?: number; name: string; category: string; discount_percent: string; starts_on: string; ends_on: string; is_active: boolean };
type CouponDraft = {
  id?: number;
  code: string;
  description: string;
  kind: 'percent' | 'flat';
  value: string;
  min_order: string;
  max_discount: string;
  starts_on: string;
  ends_on: string;
  usage_limit: string;
  is_active: boolean;
};

const inDays = (n: number) => isoDate(new Date(Date.now() + n * 86_400_000));

export default function OffersScreen() {
  const offers = useQuery({ queryKey: ['admin', 'offers'], queryFn: admin.offers });
  const coupons = useQuery({ queryKey: ['admin', 'coupons'], queryFn: admin.coupons });
  const categories = useQuery({ queryKey: ['admin', 'categories'], queryFn: admin.categories });
  const [offer, setOffer] = useState<OfferDraft | null>(null);
  const [coupon, setCoupon] = useState<CouponDraft | null>(null);
  const queryClient = useQueryClient();
  const refresh = () => {
    for (const k of [['admin', 'offers'], ['admin', 'coupons'], ['admin', 'products'], ['products']]) queryClient.invalidateQueries({ queryKey: k });
  };

  const saveOffer = useMutation({
    mutationFn: (d: OfferDraft) => admin.saveOffer({ ...d, category: d.category ? Number(d.category) : null }),
    onSuccess: () => {
      refresh();
      setOffer(null);
    },
  });
  const removeOffer = useMutation({ mutationFn: admin.deleteOffer, onSuccess: () => { refresh(); setOffer(null); } });
  const saveCoupon = useMutation({
    mutationFn: (d: CouponDraft) =>
      admin.saveCoupon({
        ...d,
        max_discount: d.max_discount || null,
        starts_on: d.starts_on || null,
        ends_on: d.ends_on || null,
        usage_limit: d.usage_limit ? Number(d.usage_limit) : null,
        min_order: d.min_order || '0',
      }),
    onSuccess: () => {
      refresh();
      setCoupon(null);
    },
  });
  const removeCoupon = useMutation({ mutationFn: admin.deleteCoupon, onSuccess: () => { refresh(); setCoupon(null); } });
  const offerErrors = fieldErrors(saveOffer.error);
  const couponErrors = fieldErrors(saveCoupon.error);

  const editOffer = (o: Offer) =>
    setOffer({ id: o.id, name: o.name, category: o.category ? String(o.category) : '', discount_percent: o.discount_percent, starts_on: o.starts_on, ends_on: o.ends_on, is_active: o.is_active });
  const editCoupon = (c: Coupon) =>
    setCoupon({
      id: c.id, code: c.code, description: c.description, kind: c.kind, value: c.value, min_order: c.min_order, max_discount: c.max_discount ?? '',
      starts_on: c.starts_on ?? '', ends_on: c.ends_on ?? '', usage_limit: c.usage_limit ? String(c.usage_limit) : '', is_active: c.is_active,
    });

  return (
    <Page title="Offers & coupons" lead="Seasonal offers lower prices for a category or the whole list between two dates. Coupons give a discount at checkout.">
      <Section
        title="Seasonal offers"
        actions={<Btn small kind="primary" title="New offer" onPress={() => setOffer({ name: '', category: '', discount_percent: '85', starts_on: isoDate(), ends_on: inDays(7), is_active: true })} />}>
        <Note>While an offer runs, a product gets the bigger of its own discount and the offer’s. Prices on past estimates never change.</Note>
        <ErrorText error={offers.error} />
        <Table
          rows={offers.data}
          loading={offers.isPending}
          keyOf={(o) => o.id}
          onRowPress={editOffer}
          empty="No offers yet."
          columns={[
            { key: 'n', label: 'Offer', flex: 1.6, render: (o) => o.name },
            { key: 'c', label: 'Applies to', flex: 1.4, render: (o) => o.category_name },
            { key: 'd', label: 'Discount', align: 'right', render: (o) => `${Number(o.discount_percent)}%` },
            { key: 'w', label: 'Dates', flex: 1.6, render: (o) => `${formatDate(o.starts_on)} – ${formatDate(o.ends_on)}` },
            { key: 's', label: 'State', render: (o) => <Pill label={o.is_running ? 'Running' : o.is_active ? 'Scheduled or ended' : 'Off'} tone={o.is_running ? 'green' : 'neutral'} /> },
          ]}
        />
      </Section>

      <Section
        title="Coupon codes"
        actions={
          <Btn small kind="primary" title="New coupon" onPress={() => setCoupon({ code: '', description: '', kind: 'percent', value: '5', min_order: '2000', max_discount: '', starts_on: '', ends_on: '', usage_limit: '', is_active: true })} />
        }>
        <ErrorText error={coupons.error} />
        <Table
          rows={coupons.data}
          loading={coupons.isPending}
          keyOf={(c) => c.id}
          onRowPress={editCoupon}
          empty="No coupons yet."
          columns={[
            { key: 'c', label: 'Code', render: (c) => <Text style={styles.code}>{c.code}</Text> },
            { key: 'v', label: 'Gives', flex: 1.4, render: (c) => (c.kind === 'percent' ? `${Number(c.value)}% off${c.max_discount ? `, up to ${formatRupees(c.max_discount)}` : ''}` : `${formatRupees(c.value)} off`) },
            { key: 'm', label: 'Min order', align: 'right', render: (c) => formatRupees(c.min_order), hideOnPhone: true },
            { key: 'u', label: 'Used', align: 'right', render: (c) => `${c.times_used}${c.usage_limit ? ` of ${c.usage_limit}` : ''}` },
            { key: 'e', label: 'Ends', render: (c) => formatDate(c.ends_on), hideOnPhone: true },
            { key: 's', label: 'State', render: (c) => <Pill label={c.is_active ? 'On' : 'Off'} tone={c.is_active ? 'green' : 'neutral'} /> },
          ]}
        />
      </Section>

      <Sheet visible={!!offer} title={offer?.id ? 'Edit offer' : 'New offer'} onClose={() => setOffer(null)}>
        {offer ? (
          <>
            <Field label="Name" value={offer.name} onChangeText={(name) => setOffer({ ...offer, name })} placeholder="Diwali week" error={offerErrors.name} />
            <Text style={styles.label}>Applies to</Text>
            <Chips wrap options={[{ value: '', label: 'All products' }, ...(categories.data ?? []).map((c) => ({ value: String(c.id), label: c.name }))]} value={offer.category} onChange={(category) => setOffer({ ...offer, category })} />
            <FormRow>
              <Field label="Discount %" value={offer.discount_percent} onChangeText={(v) => setOffer({ ...offer, discount_percent: v.replace(/[^\d.]/g, '') })} keyboardType="decimal-pad" error={offerErrors.discount_percent} />
              <Field label="Starts" value={offer.starts_on} onChangeText={(starts_on) => setOffer({ ...offer, starts_on })} error={offerErrors.starts_on} />
              <Field label="Ends" value={offer.ends_on} onChangeText={(ends_on) => setOffer({ ...offer, ends_on })} error={offerErrors.ends_on} />
            </FormRow>
            <Toggle label={offer.is_active ? 'On' : 'Off'} value={offer.is_active} onChange={(is_active) => setOffer({ ...offer, is_active })} />
            <ErrorText error={saveOffer.error && !Object.keys(offerErrors).some((k) => k in offer) ? saveOffer.error : removeOffer.error} />
            <View style={styles.actions}>
              {offer.id ? <Btn kind="danger" title="Delete" onPress={async () => { if (await confirm('Delete this offer?')) removeOffer.mutate(offer.id!); }} /> : null}
              <View style={styles.spacer} />
              <Btn kind="primary" title="Save" disabled={!offer.name.trim()} loading={saveOffer.isPending} onPress={() => saveOffer.mutate(offer)} />
            </View>
          </>
        ) : null}
      </Sheet>

      <Sheet visible={!!coupon} title={coupon?.id ? 'Edit coupon' : 'New coupon'} onClose={() => setCoupon(null)}>
        {coupon ? (
          <>
            <FormRow>
              <Field label="Code" value={coupon.code} onChangeText={(code) => setCoupon({ ...coupon, code: code.toUpperCase() })} autoCapitalize="characters" placeholder="DIWALI5" error={couponErrors.code} />
              <Field label="Description" value={coupon.description} onChangeText={(description) => setCoupon({ ...coupon, description })} />
            </FormRow>
            <Chips wrap options={[{ value: 'percent', label: 'Percent off' }, { value: 'flat', label: 'Rupees off' }]} value={coupon.kind} onChange={(kind) => setCoupon({ ...coupon, kind: kind as CouponDraft['kind'] })} />
            <FormRow>
              <Field label={coupon.kind === 'percent' ? 'Percent' : 'Rupees'} value={coupon.value} onChangeText={(v) => setCoupon({ ...coupon, value: v.replace(/[^\d.]/g, '') })} keyboardType="decimal-pad" error={couponErrors.value} />
              <Field label="Minimum order (₹)" value={coupon.min_order} onChangeText={(v) => setCoupon({ ...coupon, min_order: v.replace(/[^\d.]/g, '') })} keyboardType="decimal-pad" />
              {coupon.kind === 'percent' ? (
                <Field label="Cap (₹, optional)" value={coupon.max_discount} onChangeText={(v) => setCoupon({ ...coupon, max_discount: v.replace(/[^\d.]/g, '') })} keyboardType="decimal-pad" />
              ) : null}
            </FormRow>
            <FormRow>
              <Field label="Starts (optional)" value={coupon.starts_on} onChangeText={(starts_on) => setCoupon({ ...coupon, starts_on })} placeholder="YYYY-MM-DD" error={couponErrors.starts_on} />
              <Field label="Ends (optional)" value={coupon.ends_on} onChangeText={(ends_on) => setCoupon({ ...coupon, ends_on })} placeholder="YYYY-MM-DD" error={couponErrors.ends_on} />
              <Field label="Uses allowed" value={coupon.usage_limit} onChangeText={(v) => setCoupon({ ...coupon, usage_limit: v.replace(/\D/g, '') })} keyboardType="number-pad" placeholder="Unlimited" />
            </FormRow>
            <Toggle label={coupon.is_active ? 'On' : 'Off'} value={coupon.is_active} onChange={(is_active) => setCoupon({ ...coupon, is_active })} />
            <ErrorText error={saveCoupon.error && !couponErrors.code && !couponErrors.value ? saveCoupon.error : removeCoupon.error} />
            <View style={styles.actions}>
              {coupon.id ? <Btn kind="danger" title="Delete" onPress={async () => { if (await confirm('Delete this coupon? Coupons already used on orders can only be switched off.')) removeCoupon.mutate(coupon.id!); }} /> : null}
              <View style={styles.spacer} />
              <Btn kind="primary" title="Save" disabled={!coupon.code.trim() || !Number(coupon.value)} loading={saveCoupon.isPending} onPress={() => saveCoupon.mutate(coupon)} />
            </View>
          </>
        ) : null}
      </Sheet>
    </Page>
  );
}

const styles = StyleSheet.create({
  code: { color: tone.gold, fontFamily: fonts.textBold, fontSize: 15, letterSpacing: 0.5 },
  label: { color: tone.ink, fontFamily: fonts.textSemi, fontSize: 14 },
  actions: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  spacer: { flex: 1 },
});
