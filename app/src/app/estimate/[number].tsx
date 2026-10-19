import { useQuery } from '@tanstack/react-query';
import { Image } from 'expo-image';
import { Redirect, router, useLocalSearchParams } from 'expo-router';
import { ActivityIndicator, Linking, ScrollView, StyleSheet, Text, View } from 'react-native';

import { Button } from '@/components/button';
import { formatPhone } from '@/components/hero';
import { colors, fonts, type } from '@/components/theme';
import { api, type Estimate, type ShopSettings } from '@/lib/api';
import { formatRupees } from '@/lib/format';
import { useShopSettings } from '@/lib/queries';
import { useAuth } from '@/store/auth';

export default function EstimateScreen() {
  const { number } = useLocalSearchParams<{ number: string }>();
  const signedIn = useAuth((s) => !!s.user);
  const { data: shop } = useShopSettings();
  const estimate = useQuery({
    queryKey: ['estimate', number],
    queryFn: () => api.estimate(number),
    enabled: !!number && signedIn,
  });

  if (!signedIn) return <Redirect href={{ pathname: '/login', params: { next: `/estimate/${number}` } }} />;

  if (estimate.isPending && estimate.fetchStatus !== 'idle') {
    return <ActivityIndicator style={styles.center} size="large" color={colors.primary} />;
  }
  if (!estimate.data) {
    return (
      <View style={[styles.center, styles.pad]}>
        <Text style={styles.body}>We couldn’t find this estimate.</Text>
        <Button title="Back to price list" onPress={() => router.replace('/')} />
      </View>
    );
  }

  const e = estimate.data;
  return (
    <ScrollView contentContainerStyle={styles.container}>
      <View style={styles.success}>
        <Text style={styles.successTitle}>Estimate submitted</Text>
        <Text style={styles.number}>{e.number}</Text>
        <Text style={styles.successSub}>
          Thank you, {e.customer_name}. We’ll call you on {e.phone} to confirm your order.
        </Text>
      </View>

      {shop?.whatsapp_number ? (
        <Button
          title="Send estimate on WhatsApp"
          variant="whatsapp"
          onPress={() => Linking.openURL(whatsappLink(shop.whatsapp_number, e))}
        />
      ) : null}
      {shop?.phone_primary ? (
        <Button title={`Call ${formatPhone(shop.phone_primary)}`} variant="secondary" onPress={() => Linking.openURL(`tel:${shop.phone_primary}`)} />
      ) : null}

      {shop && (shop.upi_id || shop.upi_qr || shop.bank_details) ? <PaymentCard shop={shop} total={e.total} /> : null}

      <View style={styles.card}>
        <Text style={styles.cardTitle}>Items</Text>
        {e.items.map((i) => (
          <View key={i.code} style={styles.itemRow}>
            <Text style={styles.itemName}>
              {i.code}. {i.name} × {i.quantity}
            </Text>
            <Text style={styles.itemAmount}>{formatRupees(i.amount)}</Text>
          </View>
        ))}
        <View style={styles.divider} />
        <Line label="MRP total" value={formatRupees(e.mrp_total)} />
        <Line label="Subtotal" value={formatRupees(e.subtotal)} />
        {Number(e.discount) > 0 && <Line label={`Coupon ${e.coupon_code}`} value={`− ${formatRupees(e.discount)}`} />}
        {Number(e.packing_charge) > 0 && <Line label="Packing" value={formatRupees(e.packing_charge)} />}
        <Line label="Total" value={formatRupees(e.total)} bold />
      </View>

      <View style={styles.card}>
        <Text style={styles.cardTitle}>Delivery to</Text>
        <Text style={styles.body}>
          {e.address}
          {'\n'}
          {e.city}, {e.state} – {e.pincode}
        </Text>
      </View>

      <Button title="Back to price list" variant="secondary" onPress={() => router.replace('/')} />
    </ScrollView>
  );
}

function PaymentCard({ shop, total }: { shop: ShopSettings; total: string }) {
  return (
    <View style={styles.card}>
      <Text style={styles.cardTitle}>Payment</Text>
      <Text style={styles.body}>
        Please pay after we confirm your order by phone. Amount: {formatRupees(total)}
      </Text>
      {shop.upi_qr ? (
        <Image source={{ uri: shop.upi_qr }} style={styles.qr} contentFit="contain" accessibilityLabel="UPI QR code" />
      ) : null}
      {shop.upi_id ? <Text style={styles.upi}>UPI ID: {shop.upi_id}</Text> : null}
      {shop.bank_details ? <Text style={styles.body}>{shop.bank_details}</Text> : null}
    </View>
  );
}

function Line({ label, value, bold }: { label: string; value: string; bold?: boolean }) {
  return (
    <View style={styles.itemRow}>
      <Text style={[styles.lineLabel, bold && styles.bold]}>{label}</Text>
      <Text style={[styles.itemAmount, bold && styles.bold]}>{value}</Text>
    </View>
  );
}

function whatsappLink(shopNumber: string, e: Estimate) {
  const digits = shopNumber.replace(/\D/g, '');
  const to = digits.length === 10 ? `91${digits}` : digits;
  const items = e.items.map((i) => `${i.code}. ${i.name} x ${i.quantity}`).join('\n');
  const text =
    `Estimate ${e.number}\n${e.customer_name} (${e.phone})\n${e.city}, ${e.state}\n\n` +
    `${items}\n\nTotal: ${formatRupees(e.total)}`;
  return `https://wa.me/${to}?text=${encodeURIComponent(text)}`;
}

const styles = StyleSheet.create({
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  pad: { padding: 24, gap: 16 },
  container: { padding: 16, gap: 14, width: '100%', maxWidth: 640, alignSelf: 'center' },
  success: { backgroundColor: colors.sectionBg, borderRadius: 14, padding: 20, gap: 6, alignItems: 'center' },
  successTitle: { color: colors.text, ...type.medium, fontSize: 16, },
  number: { color: colors.gold, fontFamily: fonts.display, fontSize: 28, letterSpacing: 1 },
  successSub: { color: colors.muted, ...type.regular, fontSize: 14, textAlign: 'center', lineHeight: 20 },
  card: { backgroundColor: colors.surfaceAlt, borderRadius: 14, padding: 16, gap: 8 },
  cardTitle: { ...type.semibold, fontSize: 16, color: colors.text },
  body: { ...type.regular, fontSize: 15, color: colors.text, lineHeight: 21 },
  qr: { width: 220, height: 220, alignSelf: 'center', marginVertical: 8 },
  upi: { ...type.semibold, fontSize: 16, color: colors.purple, textAlign: 'center' },
  itemRow: { flexDirection: 'row', justifyContent: 'space-between', gap: 12 },
  itemName: { flex: 1, ...type.regular, fontSize: 14, color: colors.text },
  itemAmount: { ...type.regular, fontSize: 14, color: colors.text, fontVariant: ['tabular-nums'] },
  lineLabel: { ...type.regular, fontSize: 14, color: colors.muted },
  bold: { ...type.semibold, fontSize: 17, color: colors.text },
  divider: { height: 1, backgroundColor: colors.border, marginVertical: 4 },
});
