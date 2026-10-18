import { Image } from 'expo-image';
import { Linking, Pressable, StyleSheet, Text, useWindowDimensions, View } from 'react-native';

import type { ShopSettings } from '@/lib/api';

import { colors, fonts, MAX_CONTENT_WIDTH, WIDE_BREAKPOINT } from './theme';

export function formatPhone(p: string) {
  const d = p.replace(/\D/g, '');
  return d.length === 10 ? `${d.slice(0, 5)} ${d.slice(5)}` : p;
}

/** The cover of the printed price list: a white sheet on the shop's red. */
export function Hero({ shop }: { shop?: ShopSettings }) {
  const { width } = useWindowDimensions();
  const wide = width >= WIDE_BREAKPOINT;
  const headline = Math.min(Math.max(width * (wide ? 0.085 : 0.17), 56), 128);
  const minOrder = shop ? Number(shop.min_order_value).toLocaleString('en-IN') : null;
  const phones = [shop?.phone_primary, shop?.phone_secondary].filter(Boolean) as string[];

  return (
    <View style={styles.ground}>
      <View style={[styles.sheet, wide && styles.sheetWide]}>
        <View style={[styles.text, wide && styles.textWide]}>
          <Text style={styles.brand}>{shop?.shop_name ?? 'RKR Crackers'}</Text>
          <Text style={[styles.headline, { fontSize: headline, lineHeight: headline * 0.98 }]} accessibilityRole="header">
            2026 PRICE LIST
          </Text>
          <View style={styles.offerRow}>
            <View style={styles.stamp}>
              <Text style={styles.stampBig}>80%</Text>
              <Text style={styles.stampSmall}>OFF</Text>
            </View>
            <Text style={styles.statement}>
              Every item at 80% off MRP. Fill in your quantities, send the estimate, and we call you to confirm.
            </Text>
          </View>
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
          source={require('@/assets/images/rkr-cart.jpg')}
          style={[styles.art, wide ? styles.artWide : { height: Math.min(width - 32, 420) }]}
          contentFit="contain"
          accessibilityLabel="A boy in a white veshti running with a shopping cart full of Diwali crackers"
        />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  ground: { backgroundColor: colors.primary, padding: 12 },
  sheet: {
    backgroundColor: colors.surface,
    width: '100%',
    maxWidth: MAX_CONTENT_WIDTH,
    alignSelf: 'center',
    padding: 20,
    gap: 8,
  },
  sheetWide: { flexDirection: 'row', alignItems: 'center', padding: 40, gap: 32 },
  text: { gap: 14 },
  textWide: { flex: 1.1 },
  brand: { fontFamily: fonts.display, fontSize: 26, color: colors.primary },
  headline: { fontFamily: fonts.display, color: colors.text },
  offerRow: { flexDirection: 'row', alignItems: 'center', gap: 16 },
  stamp: {
    width: 92,
    height: 92,
    borderRadius: 46,
    backgroundColor: colors.gold,
    alignItems: 'center',
    justifyContent: 'center',
    transform: [{ rotate: '-8deg' }],
  },
  stampBig: { fontFamily: fonts.display, fontSize: 34, lineHeight: 36, color: colors.purple },
  stampSmall: { fontFamily: fonts.display, fontSize: 18, lineHeight: 20, color: colors.purple },
  statement: { flex: 1, fontFamily: fonts.text, fontSize: 18, lineHeight: 26, color: colors.text, maxWidth: 460 },
  small: { fontFamily: fonts.text, fontSize: 15, color: colors.text },
  phones: { flexDirection: 'row', flexWrap: 'wrap', gap: 20 },
  phone: { fontFamily: fonts.display, fontSize: 30, color: colors.primary, fontVariant: ['tabular-nums'] },
  art: { width: '100%' },
  artWide: { flex: 1, aspectRatio: 1, maxHeight: 520 },
});
