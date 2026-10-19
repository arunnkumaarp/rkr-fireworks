import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Redirect, router } from 'expo-router';
import { useState } from 'react';
import { KeyboardAvoidingView, Platform, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';

import { Button } from '@/components/button';
import { colors, MAX_CONTENT_WIDTH, fonts } from '@/components/theme';
import { api, ApiError, type EstimateInput } from '@/lib/api';
import { formatRupees } from '@/lib/format';
import { useShopSettings } from '@/lib/queries';
import { useAuth } from '@/store/auth';
import { cartTotals, useCart } from '@/store/cart';

type Form = Omit<EstimateInput, 'lines'>;

const EMPTY: Form = { customer_name: '', phone: '', email: '', address: '', city: '', state: 'Tamil Nadu', pincode: '', notes: '' };

function validate(form: Form) {
  const errors: Partial<Record<keyof Form, string>> = {};
  if (!form.customer_name.trim()) errors.customer_name = 'Enter your name';
  if (form.phone.replace(/\D/g, '').slice(-10).length !== 10) errors.phone = 'Enter a 10-digit mobile number';
  if (!form.address.trim()) errors.address = 'Enter your address';
  if (!form.city.trim()) errors.city = 'Enter your city';
  if (!form.state.trim()) errors.state = 'Enter your state';
  if (!/^\d{6}$/.test(form.pincode.trim())) errors.pincode = 'Enter a 6-digit pincode';
  return errors;
}

export default function CheckoutScreen() {
  const lines = useCart((s) => s.lines);
  const clear = useCart((s) => s.clear);
  const { data: shop } = useShopSettings();
  const user = useAuth((s) => s.user);
  const updateUser = useAuth((s) => s.updateUser);
  const queryClient = useQueryClient();
  const [form, setForm] = useState<Form>(() => ({
    ...EMPTY,
    customer_name: user?.first_name ?? '',
    phone: user?.phone ?? '',
  }));
  const [touched, setTouched] = useState(false);
  const [couponCode, setCouponCode] = useState('');
  const [coupon, setCoupon] = useState<{ code: string; discount: string; description: string } | null>(null);

  // Returning customers: start from the details of their last estimate.
  const last = useQuery({ queryKey: ['my-estimates', user?.id], queryFn: api.myEstimates, enabled: !!user });
  const [prefilled, setPrefilled] = useState(false);
  const e = last.data?.[0];
  if (e && !prefilled) {
    setPrefilled(true);
    setForm((f) => ({
      ...f,
      customer_name: f.customer_name || e.customer_name,
      phone: f.phone || e.phone,
      address: f.address || e.address,
      city: f.city || e.city,
      state: e.state,
      pincode: f.pincode || e.pincode,
    }));
  }

  const submit = useMutation({
    mutationFn: api.createEstimate,
    onSuccess: (estimate) => {
      clear();
      updateUser({ phone: estimate.phone, first_name: user?.first_name || estimate.customer_name });
      queryClient.invalidateQueries({ queryKey: ['my-estimates'] });
      router.replace({ pathname: '/estimate/[number]', params: { number: estimate.number } });
    },
  });

  const totals = cartTotals(lines, Number(shop?.packing_charge_percent ?? 0));
  const checkCoupon = useMutation({
    mutationFn: () => api.checkCoupon(couponCode.trim(), totals.subtotal),
    onSuccess: setCoupon,
    onError: () => setCoupon(null),
  });
  if (!user) return <Redirect href={{ pathname: '/login', params: { next: '/checkout' } }} />;
  if (totals.products === 0 && !submit.isSuccess) return <Redirect href="/cart" />;

  const errors = validate(form);
  const set = (key: keyof Form) => (value: string) => setForm((f) => ({ ...f, [key]: value }));
  const field = (key: keyof Form, label: string, props: Partial<React.ComponentProps<typeof TextInput>> = {}) => (
    <View style={styles.field}>
      <Text style={styles.label}>{label}</Text>
      <TextInput
        value={form[key]}
        onChangeText={set(key)}
        style={[styles.input, props.multiline && styles.multiline, touched && errors[key] && styles.inputError]}
        placeholderTextColor={colors.muted}
        accessibilityLabel={label}
        {...props}
      />
      {touched && errors[key] ? <Text style={styles.error}>{errors[key]}</Text> : null}
    </View>
  );

  const onSubmit = () => {
    setTouched(true);
    if (Object.keys(errors).length > 0) return;
    submit.mutate({
      ...form,
      lines: Object.values(lines).map((l) => ({ product: l.product.id, quantity: l.quantity })),
      ...(coupon ? { coupon: coupon.code } : {}),
    });
  };

  const serverError = submit.error instanceof ApiError ? submit.error.message : submit.error ? 'Could not reach the shop. Please try again.' : null;

  return (
    <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <ScrollView contentContainerStyle={styles.container} keyboardShouldPersistTaps="handled">
        {field('customer_name', 'Full name', { autoComplete: 'name', textContentType: 'name' })}
        {field('phone', 'Mobile number', { keyboardType: 'phone-pad', autoComplete: 'tel', placeholder: '10-digit mobile' })}
        <Text style={styles.note}>Order updates go to {user.email}</Text>
        {field('address', 'Address', { multiline: true, autoComplete: 'street-address', placeholder: 'Door no, street, area' })}
        <View style={styles.row}>
          <View style={styles.flex}>{field('city', 'City', { autoComplete: 'postal-address-locality' })}</View>
          <View style={styles.flex}>{field('pincode', 'Pincode', { keyboardType: 'number-pad', maxLength: 6, autoComplete: 'postal-code' })}</View>
        </View>
        {field('state', 'State', { autoComplete: 'postal-address-region' })}
        {field('notes', 'Notes (optional)', { multiline: true, placeholder: 'Nearest transport office, preferred call time…' })}

        <View style={styles.field}>
          <Text style={styles.label}>Coupon code (optional)</Text>
          <View style={styles.row}>
            <TextInput
              value={couponCode}
              onChangeText={(t) => {
                setCouponCode(t.toUpperCase());
                setCoupon(null);
              }}
              autoCapitalize="characters"
              style={[styles.input, styles.flex]}
              placeholderTextColor={colors.muted}
              accessibilityLabel="Coupon code"
            />
            <Button title="Apply" variant="secondary" onPress={() => checkCoupon.mutate()} loading={checkCoupon.isPending} disabled={!couponCode.trim()} />
          </View>
          {coupon ? (
            <Text style={styles.applied}>
              {coupon.code} applied: you save {formatRupees(coupon.discount)}
              {coupon.description ? ` · ${coupon.description}` : ''}
            </Text>
          ) : checkCoupon.error ? (
            <Text style={styles.error}>{checkCoupon.error.message}</Text>
          ) : null}
        </View>

        <View style={styles.summary}>
          <Text style={styles.summaryText}>{totals.products} products · {totals.count} items</Text>
          <Text style={styles.summaryTotal}>{formatRupees(totals.total - Number(coupon?.discount ?? 0))}</Text>
        </View>
        <Text style={styles.note}>
          No payment now. After you submit, we’ll call you to confirm the order and share payment details.
        </Text>
        {serverError ? <Text style={styles.serverError}>{serverError}</Text> : null}
        <Button title="Submit estimate" onPress={onSubmit} loading={submit.isPending} />

      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  container: { padding: 16, gap: 14, width: '100%', maxWidth: 640, alignSelf: 'center' },
  row: { flexDirection: 'row', gap: 12 },
  field: { gap: 6 },
  label: { fontFamily: fonts.textSemi, fontSize: 14, color: colors.text },
  input: {
    minHeight: 46,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontFamily: fonts.text, fontSize: 16,
    color: colors.text,
  },
  multiline: { minHeight: 80, textAlignVertical: 'top' },
  inputError: { borderColor: colors.danger },
  error: { color: colors.danger, fontFamily: fonts.text, fontSize: 13 },
  summary: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: colors.sectionBg,
    borderRadius: 12,
    padding: 14,
    marginTop: 6,
  },
  summaryText: { color: colors.text, fontFamily: fonts.text, fontSize: 14 },
  summaryTotal: { color: colors.text, fontFamily: fonts.textBold, fontSize: 20, },
  note: { fontFamily: fonts.text, fontSize: 13, color: colors.muted, lineHeight: 19 },
  serverError: { color: colors.danger, fontFamily: fonts.textSemi },
  applied: { color: colors.green, fontFamily: fonts.textSemi, fontSize: 14 },
});

void MAX_CONTENT_WIDTH;
