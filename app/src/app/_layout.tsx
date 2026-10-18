import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { Link, Stack } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { StatusBar } from 'expo-status-bar';
import { useEffect } from 'react';

import { colors } from '@/components/theme';
import { useAuth } from '@/store/auth';

SplashScreen.preventAutoHideAsync();

const queryClient = new QueryClient({
  defaultOptions: { queries: { staleTime: 5 * 60 * 1000, retry: 1 } },
});

export default function RootLayout() {
  useEffect(() => {
    SplashScreen.hideAsync();
  }, []);

  return (
    <QueryClientProvider client={queryClient}>
      <StatusBar style="light" />
      <Stack
        screenOptions={{
          headerStyle: { backgroundColor: colors.primary },
          headerTintColor: '#fff',
          headerTitleStyle: { fontWeight: '700' },
          contentStyle: { backgroundColor: colors.background },
        }}>
        <Stack.Screen name="index" options={{ title: 'RKR Crackers', headerRight: () => <AccountLink /> }} />
        <Stack.Screen name="cart" options={{ title: 'Your cart' }} />
        <Stack.Screen name="checkout" options={{ title: 'Delivery details' }} />
        <Stack.Screen name="login" options={{ title: 'Log in' }} />
        <Stack.Screen name="orders" options={{ title: 'My orders' }} />
        <Stack.Screen name="admin" options={{ headerShown: false }} />
        <Stack.Screen name="estimate/[number]" options={{ title: 'Estimate', headerBackVisible: false }} />
      </Stack>
    </QueryClientProvider>
  );
}

function AccountLink() {
  const user = useAuth((s) => s.user);
  const isAdmin = user?.role === 'admin';
  return (
    <Link href={isAdmin ? '/admin' : '/orders'} style={{ color: '#fff', fontWeight: '700', fontSize: 15, paddingHorizontal: 12 }}>
      {isAdmin ? 'Shop admin' : user ? 'My orders' : 'Log in'}
    </Link>
  );
}
