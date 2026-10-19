import { router, Stack } from 'expo-router';
import { ScrollView, StyleSheet, Text } from 'react-native';

import { confirmNative, ListRow, ListSection, surface } from '@/components/native';
import { colors, type } from '@/components/theme';
import { useAuth } from '@/store/auth';

/** Phones: everything that doesn't get its own tab, grouped like a settings screen. */
export default function MoreScreen() {
  const user = useAuth((s) => s.user);
  const signOut = useAuth((s) => s.signOut);
  const isAdmin = user?.role === 'admin';
  const go = (href: string) => () => router.push(href as never);

  return (
    <ScrollView style={styles.flex} contentContainerStyle={styles.container} contentInsetAdjustmentBehavior="automatic">
      <Stack.Screen options={{ title: 'More' }} />
      <ListSection title="Sales">
        <ListRow title="Dispatch" subtitle="Pack, send and track parcels" onPress={go('/admin/dispatch')} />
        <ListRow title="Customers" onPress={go('/admin/customers')} />
        <ListRow title="Notifications" onPress={go('/admin/notifications')} />
      </ListSection>
      <ListSection title="Price list">
        <ListRow title="Categories" onPress={go('/admin/categories')} />
        <ListRow title="Inventory" subtitle="Stock counts and changes" onPress={go('/admin/inventory')} />
        {isAdmin ? <ListRow title="Offers & coupons" onPress={go('/admin/offers')} /> : null}
      </ListSection>
      {isAdmin ? (
        <ListSection title="Money">
          <ListRow title="Payments" onPress={go('/admin/payments')} />
          <ListRow title="Expenses" onPress={go('/admin/expenses')} />
          <ListRow title="Reports" subtitle="Sales, received, expenses, profit" onPress={go('/admin/reports')} />
        </ListSection>
      ) : null}
      <ListSection title="Shop">
        {isAdmin ? <ListRow title="Settings & team" onPress={go('/admin/settings')} /> : null}
        {isAdmin ? <ListRow title="Audit log" onPress={go('/admin/audit')} /> : null}
        <ListRow title="My account" onPress={go('/admin/account')} />
        <ListRow title="View the shop" tint onPress={() => router.replace('/')} />
      </ListSection>
      <ListSection footer={`${user?.email} · ${isAdmin ? 'Admin' : 'Staff'}`}>
        <ListRow
          title="Log out"
          destructive
          chevron={false}
          onPress={async () => {
            if (await confirmNative('Log out?', 'You will need a new email code to log in again.', 'Log out')) {
              signOut();
              router.replace('/');
            }
          }}
        />
      </ListSection>
      <Text style={styles.note}>Reports download as CSV from the website on a computer.</Text>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1, backgroundColor: colors.background },
  container: { padding: 16, gap: 28, paddingBottom: 48 },
  note: { ...type.regular, fontSize: 13, color: surface.secondary, textAlign: 'center' },
});
