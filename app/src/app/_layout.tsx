import { useFonts } from 'expo-font';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { Link, Stack } from 'expo-router';
import { Platform, Pressable, Text } from 'react-native';
import * as SplashScreen from 'expo-splash-screen';
import { StatusBar } from 'expo-status-bar';
import { useEffect } from 'react';

import { isIOS, isNative, stackOptions } from '@/components/native';
import { colors, fonts, type } from '@/components/theme';
import { useAuth } from '@/store/auth';

SplashScreen.preventAutoHideAsync();

const queryClient = new QueryClient({
  defaultOptions: { queries: { staleTime: 5 * 60 * 1000, retry: 1 } },
});

// The apps use the system face for text, so they only load the brand face.
const FONTS: Record<string, number> = isNative
  ? { Gambarino: require('@/assets/fonts/Gambarino-Regular.ttf') }
  : {
      Gambarino: require('@/assets/fonts/Gambarino-Regular.ttf'),
      'GeneralSans-Regular': require('@/assets/fonts/GeneralSans-Regular.ttf'),
      'GeneralSans-Medium': require('@/assets/fonts/GeneralSans-Medium.ttf'),
      'GeneralSans-Semibold': require('@/assets/fonts/GeneralSans-Semibold.ttf'),
    };

export default function RootLayout() {
  const [fontsLoaded, fontError] = useFonts(FONTS);
  const ready = fontsLoaded || !!fontError;

  useEffect(() => {
    if (ready) SplashScreen.hideAsync();
  }, [ready]);

  if (!ready) return null;

  return (
    <QueryClientProvider client={queryClient}>
      <StatusBar style="light" />
      {isNative ? <NativeRoot /> : <WebRoot />}
    </QueryClientProvider>
  );
}

/** Phones: tabs at the root; checkout, estimates and info pages push over them; log in is a sheet. */
function NativeRoot() {
  return (
    <Stack screenOptions={stackOptions}>
      <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
      <Stack.Screen name="admin" options={{ headerShown: false }} />
      <Stack.Screen
        name="login"
        options={{
          title: 'Log in',
          presentation: isIOS ? 'formSheet' : 'modal',
          sheetAllowedDetents: [0.62, 1],
          sheetGrabberVisible: true,
          sheetCornerRadius: 24,
          contentStyle: { backgroundColor: colors.surfaceAlt },
          headerShown: false,
        }}
      />
      <Stack.Screen name="checkout" options={{ title: 'Delivery details' }} />
      <Stack.Screen name="estimate/[number]" options={{ title: 'Estimate sent', headerBackVisible: false, gestureEnabled: false }} />
      <Stack.Screen name="safety" options={{ title: 'Safety guide' }} />
      <Stack.Screen name="terms" options={{ title: 'Terms of sale' }} />
      <Stack.Screen name="privacy" options={{ title: 'Privacy' }} />
    </Stack>
  );
}

/** The website's shop pages keep their wordmark bar. */
function WebRoot() {
  return (
    <Stack
      screenOptions={{
        headerStyle: { backgroundColor: colors.background },
        headerShadowVisible: false,
        headerTintColor: colors.text,
        headerTitleStyle: { fontFamily: fonts.display, fontSize: 22 },
        // The bar is a plain wordmark that always leads home; `title` still names the browser tab.
        headerTitle: () => <Wordmark />,
        contentStyle: { backgroundColor: colors.background },
        animation: 'slide_from_right',
        animationDuration: 280,
      }}>
      <Stack.Screen name="(tabs)" options={{ title: 'RKR Crackers', headerRight: () => <AccountLink /> }} />
      <Stack.Screen name="checkout" options={{ title: 'Delivery details' }} />
      <Stack.Screen name="login" options={{ title: 'Log in' }} />
      <Stack.Screen name="admin" options={{ headerShown: false }} />
      <Stack.Screen name="safety" options={{ title: 'Safety guide' }} />
      <Stack.Screen name="terms" options={{ title: 'Terms of sale' }} />
      <Stack.Screen name="privacy" options={{ title: 'Privacy' }} />
      <Stack.Screen name="estimate/[number]" options={{ title: 'Estimate', headerBackVisible: false }} />
    </Stack>
  );
}

const wordmarkStyle = { color: colors.text, fontFamily: fonts.display, fontSize: 26 };

function Wordmark() {
  if (Platform.OS === 'web') {
    // The website's price list lives outside the app at the site root.
    return (
      <Pressable accessibilityRole="link" onPress={() => window.location.assign('/')}>
        <Text style={wordmarkStyle}>RKR Crackers</Text>
      </Pressable>
    );
  }
  return (
    <Link href="/" style={wordmarkStyle}>
      RKR Crackers
    </Link>
  );
}

function AccountLink() {
  const user = useAuth((s) => s.user);
  const isAdmin = user?.role === 'admin' || user?.role === 'staff';
  return (
    <Link href={isAdmin ? '/admin' : user ? '/orders' : '/login'} style={{ color: colors.gold, ...type.medium, fontSize: 15, paddingHorizontal: 12 }}>
      {isAdmin ? 'Shop admin' : user ? 'My orders' : 'Log in'}
    </Link>
  );
}
