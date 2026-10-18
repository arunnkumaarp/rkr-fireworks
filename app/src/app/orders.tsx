import { useQuery } from '@tanstack/react-query';
import { Redirect, router } from 'expo-router';
import { ActivityIndicator, FlatList, Pressable, RefreshControl, StyleSheet, Text, View } from 'react-native';

import { Button } from '@/components/button';
import { colors } from '@/components/theme';
import { api } from '@/lib/api';
import { formatRupees } from '@/lib/format';
import { useAuth } from '@/store/auth';

const STATUS_LABEL: Record<string, string> = {
  submitted: 'Waiting for our call',
  confirmed: 'Confirmed',
  paid: 'Payment received',
  packed: 'Packed',
  dispatched: 'Dispatched',
  delivered: 'Delivered',
  cancelled: 'Cancelled',
};

export default function OrdersScreen() {
  const user = useAuth((s) => s.user);
  const signOut = useAuth((s) => s.signOut);
  const orders = useQuery({ queryKey: ['my-estimates', user?.id], queryFn: api.myEstimates, enabled: !!user });

  if (!user) return <Redirect href={{ pathname: '/login', params: { next: '/orders' } }} />;
  if (orders.isPending) return <ActivityIndicator style={styles.center} size="large" color={colors.primary} />;

  return (
    <FlatList
      contentContainerStyle={styles.container}
      data={orders.data ?? []}
      keyExtractor={(e) => e.number}
      refreshControl={<RefreshControl refreshing={orders.isRefetching} onRefresh={() => void orders.refetch()} />}
      ListHeaderComponent={<Text style={styles.signedIn}>Logged in as {user.email}</Text>}
      ListEmptyComponent={
        <View style={styles.empty}>
          <Text style={styles.emptyText}>
            {orders.isError ? 'Could not load your orders.' : "You haven't sent an estimate yet."}
          </Text>
          <Button title="Browse price list" onPress={() => router.replace('/')} />
        </View>
      }
      renderItem={({ item }) => (
        <Pressable
          accessibilityRole="button"
          onPress={() => router.push({ pathname: '/estimate/[number]', params: { number: item.number } })}
          style={({ pressed }) => [styles.card, pressed && styles.pressed]}>
          <View style={styles.cardTop}>
            <Text style={styles.number}>{item.number}</Text>
            <Text style={styles.total}>{formatRupees(item.total)}</Text>
          </View>
          <Text style={[styles.status, item.status === 'cancelled' && styles.cancelled]}>
            {STATUS_LABEL[item.status] ?? item.status}
            {item.lr_number ? ` · ${item.transport_name} LR ${item.lr_number}` : ''}
          </Text>
          <Text style={styles.meta}>
            {new Date(item.created_at).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })} ·{' '}
            {item.items.length} products
          </Text>
        </Pressable>
      )}
      ListFooterComponent={<Button title="Log out" variant="secondary" onPress={signOut} style={styles.logout} />}
    />
  );
}

const styles = StyleSheet.create({
  center: { flex: 1, justifyContent: 'center' },
  container: { padding: 16, gap: 12, width: '100%', maxWidth: 640, alignSelf: 'center' },
  signedIn: { fontSize: 15, color: colors.text, marginBottom: 4 },
  card: { backgroundColor: colors.surfaceAlt, borderRadius: 14, padding: 16, gap: 4 },
  pressed: { opacity: 0.8 },
  cardTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline' },
  number: { fontSize: 18, fontWeight: '800', color: colors.text },
  total: { fontSize: 18, fontWeight: '800', color: colors.text, fontVariant: ['tabular-nums'] },
  status: { fontSize: 15, fontWeight: '600', color: colors.green },
  cancelled: { color: colors.danger },
  meta: { fontSize: 14, color: colors.muted },
  empty: { paddingVertical: 32, gap: 16, alignItems: 'center' },
  emptyText: { fontSize: 16, color: colors.text },
  logout: { marginTop: 12 },
});
