import { useQuery } from '@tanstack/react-query';
import { Redirect, router, Stack } from 'expo-router';
import { ActivityIndicator, FlatList, RefreshControl, StyleSheet, Text, View } from 'react-native';

import { Button } from '@/components/button';
import { isNative, surface, Touchable } from '@/components/native';
import { PressScale } from '@/components/press-scale';
import { colors, type } from '@/components/theme';
import { api, type Estimate } from '@/lib/api';
import { formatDate, formatRupees } from '@/lib/format';
import { STATUS_LABEL } from '@/lib/status';
import { useAuth } from '@/store/auth';

export default function OrdersScreen() {
  const user = useAuth((s) => s.user);
  const signOut = useAuth((s) => s.signOut);
  const orders = useQuery({ queryKey: ['my-estimates', user?.id], queryFn: api.myEstimates, enabled: !!user });
  const screen = <Stack.Screen options={{ title: isNative ? 'Orders' : 'My orders' }} />;

  if (!user) {
    // A tab is never a redirect on phones: say what it is for and offer the sign-in sheet.
    if (!isNative) return <Redirect href={{ pathname: '/login', params: { next: '/orders' } }} />;
    return (
      <View style={styles.emptyWrap}>
        {screen}
        <Text style={styles.emptyTitle}>Your estimates live here</Text>
        <Text style={styles.emptySub}>Log in with your email to send an estimate and follow it to your door.</Text>
        <Button title="Log in" onPress={() => router.push('/login')} />
      </View>
    );
  }
  if (orders.isPending) {
    return (
      <>
        {screen}
        <ActivityIndicator style={styles.center} size="large" color={colors.primary} />
      </>
    );
  }

  const open = (e: Estimate) => router.push({ pathname: '/estimate/[number]', params: { number: e.number } });

  return (
    <>
      {screen}
      <FlatList
        style={styles.list}
        contentInsetAdjustmentBehavior="automatic"
        contentContainerStyle={styles.container}
        data={orders.data ?? []}
        keyExtractor={(e) => e.number}
        refreshControl={<RefreshControl refreshing={orders.isRefetching} onRefresh={() => void orders.refetch()} tintColor={colors.gold} />}
        ListHeaderComponent={
          <View style={styles.header}>
            {!isNative ? <Text style={styles.signedIn}>Logged in as {user.email}</Text> : null}
            {user.role !== 'customer' ? <Button title="Open the shop admin" onPress={() => router.replace('/admin')} /> : null}
          </View>
        }
        ListEmptyComponent={
          <View style={styles.empty}>
            <Text style={styles.emptyText}>
              {orders.isError ? 'Could not load your orders.' : "You haven't sent an estimate yet."}
            </Text>
            <Button title="Browse the price list" onPress={() => router.navigate('/')} />
          </View>
        }
        renderItem={({ item }) =>
          isNative ? (
            <Touchable accessibilityRole="button" onPress={() => open(item)} style={styles.cell}>
              <View style={styles.cardTop}>
                <Text style={styles.number}>{item.number}</Text>
                <Text style={styles.total}>{formatRupees(item.total)}</Text>
              </View>
              <Text style={[styles.status, item.status === 'cancelled' && styles.cancelled]}>
                {STATUS_LABEL[item.status] ?? item.status}
                {item.lr_number ? ` · ${item.transport_name} LR ${item.lr_number}` : ''}
              </Text>
              <Text style={styles.meta}>
                {formatDate(item.created_at)} · {item.items.length} products
              </Text>
            </Touchable>
          ) : (
            <PressScale scaleTo={0.97} accessibilityRole="button" onPress={() => open(item)} style={styles.card}>
              <View style={styles.cardTop}>
                <Text style={styles.number}>{item.number}</Text>
                <Text style={styles.total}>{formatRupees(item.total)}</Text>
              </View>
              <Text style={[styles.status, item.status === 'cancelled' && styles.cancelled]}>
                {STATUS_LABEL[item.status] ?? item.status}
                {item.lr_number ? ` · ${item.transport_name} LR ${item.lr_number}` : ''}
              </Text>
              <Text style={styles.meta}>
                {formatDate(item.created_at)} · {item.items.length} products
              </Text>
            </PressScale>
          )
        }
        ListFooterComponent={!isNative ? <Button title="Log out" variant="secondary" onPress={signOut} style={styles.logout} /> : undefined}
      />
    </>
  );
}

const styles = StyleSheet.create({
  list: { flex: 1, backgroundColor: colors.background },
  center: { flex: 1, justifyContent: 'center' },
  container: { padding: 16, gap: 12, width: '100%', maxWidth: 640, alignSelf: 'center' },
  header: { gap: 12 },
  signedIn: { ...type.regular, fontSize: 15, color: colors.text },
  card: { backgroundColor: colors.surfaceAlt, borderRadius: 14, padding: 16, gap: 4 },
  cell: { backgroundColor: surface.group, borderRadius: 14, padding: 16, gap: 4, overflow: 'hidden' },
  cardTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline' },
  number: { ...type.semibold, fontSize: 17, color: colors.text },
  total: { ...type.semibold, fontSize: 17, color: colors.text, fontVariant: ['tabular-nums'] },
  status: { ...type.medium, fontSize: 15, color: colors.green },
  cancelled: { color: colors.danger },
  meta: { ...type.regular, fontSize: 14, color: surface.secondary },
  empty: { paddingVertical: 32, gap: 16, alignItems: 'center' },
  emptyText: { ...type.regular, fontSize: 16, color: colors.text },
  emptyWrap: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 32, gap: 12, backgroundColor: colors.background },
  emptyTitle: { ...type.semibold, fontSize: 22, color: colors.text, textAlign: 'center' },
  emptySub: { ...type.regular, fontSize: 16, color: surface.secondary, textAlign: 'center', lineHeight: 22, marginBottom: 8 },
  logout: { marginTop: 12 },
});
