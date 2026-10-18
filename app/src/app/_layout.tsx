import { Anton_400Regular } from '@expo-google-fonts/anton';
import { Archivo_400Regular, Archivo_600SemiBold, Archivo_800ExtraBold, useFonts } from '@expo-google-fonts/archivo';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { Link, Stack } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { StatusBar } from 'expo-status-bar';
import { useEffect } from 'react';

import { colors, fonts } from '@/components/theme';
import { useAuth } from '@/store/auth';

SplashScreen.preventAutoHideAsync();

const queryClient = new QueryClient({
  defaultOptions: { queries: { staleTime: 5 * 60 * 1000, retry: 1 } },
});

export default function RootLayout() {
  const [fontsLoaded, fontError] = useFonts({ Anton_400Regular, Archivo_400Regular, Archivo_600SemiBold, Archivo_800ExtraBold });
  const ready = fontsLoaded || !!fontError;

  useEffect(() => {
    if (ready) SplashScreen.hideAsync();
  }, [ready]);

  if (!ready) return null;

  return (
    <QueryClientProvider client={queryClient}>
      <StatusBar style="light" />
      <Stack
        screenOptions={{
          headerStyle: { backgroundColor: colors.primary },
          headerTintColor: '#fff',
          headerTitleStyle: { fontFamily: fonts.display, fontSize: 22 },
          // The bar is a plain wordmark that always leads home; `title` still names the browser tab.
          headerTitle: () => <Wordmark />,
          contentStyle: { backgroundColor: colors.background },
        }}>
        <Stack.Screen name="index" options={{ title: 'RKR Crackers', headerRight: () => <AccountLink /> }} />
        <Stack.Screen name="cart" options={{ title: 'Your cart' }} />
        <Stack.Screen name="checkout" options={{ title: 'Delivery details' }} />
        <Stack.Screen name="login" options={{ title: 'Log in' }} />
        <Stack.Screen name="orders" options={{ title: 'My orders' }} />
        <Stack.Screen name="admin" options={{ headerShown: false }} />
        <Stack.Screen name="safety" options={{ title: 'Safety guide' }} />
        <Stack.Screen name="terms" options={{ title: 'Terms of sale' }} />
        <Stack.Screen name="privacy" options={{ title: 'Privacy' }} />
        <Stack.Screen name="estimate/[number]" options={{ title: 'Estimate', headerBackVisible: false }} />
      </Stack>
    </QueryClientProvider>
  );
}

function Wordmark() {
  return (
    <Link href="/" style={{ color: '#fff', fontFamily: fonts.display, fontSize: 24 }}>
      RKR Crackers
    </Link>
  );
}

function AccountLink() {
  const user = useAuth((s) => s.user);
  const isAdmin = user?.role === 'admin';
  return (
    <Link href={isAdmin ? '/admin' : '/orders'} style={{ color: '#fff', fontFamily: fonts.textBold, fontSize: 15, paddingHorizontal: 12 }}>
      {isAdmin ? 'Shop admin' : user ? 'My orders' : 'Log in'}
    </Link>
  );
}
