import { useQuery } from '@tanstack/react-query';
import { router } from 'expo-router';
import { ActivityIndicator, Pressable, RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native';

import { Button } from '@/components/button';
import { colors, fonts } from '@/components/theme';
import { api } from '@/lib/api';
import { formatRupees } from '@/lib/format';
import { useAuth } from '@/store/auth';

export default function AdminDashboard() {
  const signOut = useAuth((s) => s.signOut);
  const dash = useQuery({ queryKey: ['admin', 'dashboard'], queryFn: api.admin.dashboard });

  if (dash.isPending) return <ActivityIndicator style={styles.center} size="large" color={colors.primary} />;
  if (!dash.data) return <Text style={styles.error}>Could not load the dashboard. {dash.error?.message}</Text>;
  const d = dash.data;

  return (
    <ScrollView
      contentContainerStyle={styles.container}
      refreshControl={<RefreshControl refreshing={dash.isRefetching} onRefresh={() => void dash.refetch()} />}>
      <Pressable
        accessibilityRole="button"
        onPress={() => router.push({ pathname: '/admin/estimates', params: { status: 'submitted' } })}
        style={styles.lead}>
        <Text style={styles.leadNumber}>{d.awaiting_call}</Text>
        <Text style={styles.leadText}>
          {d.awaiting_call === 1 ? 'new estimate waiting for your call' : 'new estimates waiting for your call'}
        </Text>
      </Pressable>

      <View style={styles.facts}>
        <Fact value={formatRupees(d.confirmed_value)} label="Confirmed order value" />
        <Fact value={String(d.today)} label="Estimates today" />
        <Fact value={String(d.this_week)} label="This week" />
        <Fact value={String(d.to_dispatch)} label="Paid or packed, to dispatch" />
      </View>

      <Button title="All estimates" onPress={() => router.push('/admin/estimates')} />
      <Button title="Products & prices" variant="secondary" onPress={() => router.push('/admin/products')} />

      {d.top_products.length > 0 && (
        <View style={styles.block}>
          <Text style={styles.heading}>Most ordered</Text>
          {d.top_products.map((p) => (
            <View key={p.code} style={styles.row}>
              <Text style={styles.rowName}>
                {p.code}. {p.name}
              </Text>
              <Text style={styles.rowQty}>{p.quantity}</Text>
            </View>
          ))}
        </View>
      )}

      <Text style={styles.note}>
        Shop settings (UPI ID, QR code, minimum order, packing charge) are edited in the web admin at /django-admin/.
      </Text>
      <Button title="Log out" variant="secondary" onPress={signOut} />
    </ScrollView>
  );
}

function Fact({ value, label }: { value: string; label: string }) {
  return (
    <View style={styles.fact}>
      <Text style={styles.factValue}>{value}</Text>
      <Text style={styles.factLabel}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  center: { flex: 1, justifyContent: 'center' },
  error: { padding: 20, color: colors.danger },
  container: { padding: 16, gap: 14, width: '100%', maxWidth: 720, alignSelf: 'center' },
  lead: { backgroundColor: colors.primary, borderRadius: 14, padding: 20 },
  leadNumber: { color: '#fff', fontFamily: fonts.display, fontSize: 56, lineHeight: 60, letterSpacing: -1 },
  leadText: { color: '#fff', fontFamily: fonts.textSemi, fontSize: 17, },
  facts: { flexDirection: 'row', flexWrap: 'wrap', backgroundColor: colors.surfaceAlt, borderRadius: 14, paddingVertical: 8 },
  fact: { width: '50%', padding: 12, gap: 2 },
  factValue: { fontFamily: fonts.textBold, fontSize: 22, color: colors.text, fontVariant: ['tabular-nums'] },
  factLabel: { fontFamily: fonts.text, fontSize: 14, color: colors.text },
  block: { gap: 8, marginTop: 8 },
  heading: { fontFamily: fonts.textBold, fontSize: 20, color: colors.text },
  row: { flexDirection: 'row', justifyContent: 'space-between', gap: 12 },
  rowName: { flex: 1, fontFamily: fonts.text, fontSize: 15, color: colors.text },
  rowQty: { fontFamily: fonts.textBold, fontSize: 15, color: colors.text, fontVariant: ['tabular-nums'] },
  note: { fontFamily: fonts.text, fontSize: 14, color: colors.muted, lineHeight: 20, marginTop: 8 },
});
