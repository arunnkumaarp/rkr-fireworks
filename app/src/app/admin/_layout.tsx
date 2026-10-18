import { Redirect, Stack } from 'expo-router';

import { colors } from '@/components/theme';
import { useAuth } from '@/store/auth';

export default function AdminLayout() {
  const user = useAuth((s) => s.user);
  if (!user) return <Redirect href={{ pathname: '/login', params: { next: '/admin' } }} />;
  // The API enforces this too; the redirect just keeps customers out of screens they can't use.
  if (user.role !== 'admin') return <Redirect href="/" />;

  return (
    <Stack
      screenOptions={{
        headerStyle: { backgroundColor: colors.purple },
        headerTintColor: '#fff',
        headerTitleStyle: { fontWeight: '700' },
        contentStyle: { backgroundColor: colors.background },
      }}>
      <Stack.Screen name="index" options={{ title: 'Shop admin' }} />
      <Stack.Screen name="estimates/index" options={{ title: 'Estimates' }} />
      <Stack.Screen name="estimates/[number]" options={{ title: 'Estimate' }} />
      <Stack.Screen name="products" options={{ title: 'Products & prices' }} />
    </Stack>
  );
}
