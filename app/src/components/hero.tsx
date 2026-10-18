import { Image } from 'expo-image';
import { Linking, Pressable, StyleSheet, Text, useWindowDimensions, View } from 'react-native';

import type { ShopSettings } from '@/lib/api';

import { colors, fonts, MAX_CONTENT_WIDTH, WIDE_BREAKPOINT } from './theme';

export function formatPhone(p: string) {
  const d = p.replace(/\D/g, '');
  return d.length === 10 ? `${d.slice(0, 5)} ${d.slice(5)}` : p;
}

/** The home screen of the mobile app: the offer beside a night photograph, as on the website. */
export function Hero({ shop }: { shop?: ShopSettings }) {
  const { width } = useWindowDimensions();
  const wide = width >= WIDE_BREAKPOINT;
  const headline = Math.min(Math.max(width * (wide ? 0.06 : 0.12), 40), 88);
  const minOrder = shop ? Number(shop.min_order_value).toLocaleString('en-IN') : null;
  const phones = [shop?.phone_primary, shop?.phone_secondary].filter(Boolean) as string[];

  return (
    <View style={styles.ground}>
      <View style={[styles.sheet, wide && styles.sheetWide]}>
        <View style={[styles.text, wide && styles.textWide]}>
          <Text style={styles.brand}>{shop?.shop_name ?? 'RKR Crackers'}</Text>
          <Text style={[styles.headline, { fontSize: headline, lineHeight: headline * 0.98 }]} accessibilityRole="header">
            Every cracker, 80% off.
          </Text>
          <Text style={styles.statement}>
            Diwali 2026: all 220 items from our price list. Pick your quantities, send an estimate, and we call you to
            confirm.
          </Text>
          <Text style={styles.small}>
            {minOrder ? `Minimum order ₹${minOrder}. ` : ''}No payment until we confirm.
          </Text>
          {phones.length > 0 && (
            <View style={styles.phones}>
              {phones.map((p) => (
                <Pressable key={p} accessibilityRole="link" onPress={() => Linking.openURL(`tel:${p}`)}>
                  <Text style={styles.phone}>{formatPhone(p)}</Text>
                </Pressable>
              ))}
            </View>
          )}
        </View>
        <Image
          source={require('@/assets/images/hero-night.jpg')}
          style={[styles.art, wide ? styles.artWide : { height: Math.min(width - 32, 420) }]}
          contentFit="cover"
          accessibilityLabel="A large flowerpot cracker throwing golden sparks at night"
        />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  ground: { backgroundColor: colors.background, padding: 12 },
  sheet: {
    backgroundColor: colors.surfaceAlt,
    borderRadius: 14,
    width: '100%',
    maxWidth: MAX_CONTENT_WIDTH,
    alignSelf: 'center',
    padding: 20,
    gap: 8,
  },
  sheetWide: { flexDirection: 'row', alignItems: 'center', padding: 40, gap: 32 },
  text: { gap: 14 },
  textWide: { flex: 1.1 },
  brand: { fontFamily: fonts.display, fontSize: 26, color: colors.gold },
  headline: { fontFamily: fonts.display, color: colors.text, letterSpacing: -0.5 },
  statement: { fontFamily: fonts.text, fontSize: 18, lineHeight: 26, color: colors.text, maxWidth: 460 },
  small: { fontFamily: fonts.text, fontSize: 15, color: colors.text },
  phones: { flexDirection: 'row', flexWrap: 'wrap', gap: 20 },
  phone: { fontFamily: fonts.display, fontSize: 30, color: colors.primary, fontVariant: ['tabular-nums'] },
  art: { width: '100%', borderRadius: 12 },
  artWide: { flex: 1, aspectRatio: 1, maxHeight: 520 },
});
