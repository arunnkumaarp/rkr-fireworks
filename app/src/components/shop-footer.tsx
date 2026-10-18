import { Image } from 'expo-image';
import { Link } from 'expo-router';
import { Linking, Pressable, StyleSheet, Text, useWindowDimensions, View } from 'react-native';

import type { ShopSettings } from '@/lib/api';

import { formatPhone } from './hero';
import { colors, fonts, MAX_CONTENT_WIDTH, WIDE_BREAKPOINT } from './theme';

/** The back page of the price list: name and phone numbers on the purple band. */
export function ShopFooter({ shop }: { shop?: ShopSettings }) {
  const { width } = useWindowDimensions();
  const wide = width >= WIDE_BREAKPOINT;
  const name = (shop?.shop_name ?? 'RKR Crackers').toUpperCase();
  const phones = [shop?.phone_primary, shop?.phone_secondary].filter(Boolean) as string[];

  return (
    <View style={styles.band}>
      <View style={[styles.inner, wide && styles.innerWide]}>
        <View style={[styles.col, wide && styles.colWide]}>
          <Text style={[styles.name, { fontSize: wide ? 96 : 60, lineHeight: wide ? 96 : 60 }]}>{name}</Text>
          <Text style={styles.body}>Call or WhatsApp us to order, ask about stock, or check on your delivery.</Text>
          {phones.map((p) => (
            <Pressable key={p} accessibilityRole="link" onPress={() => Linking.openURL(`tel:${p}`)}>
              <Text style={styles.phone}>{formatPhone(p)}</Text>
            </Pressable>
          ))}
          {shop?.address ? <Text style={styles.body}>{shop.address}</Text> : null}
          <View style={styles.links}>
            <Link href="/safety" style={styles.link}>Safety guide</Link>
            <Link href="/terms" style={styles.link}>Terms of sale</Link>
            <Link href="/privacy" style={styles.link}>Privacy</Link>
          </View>
          <Text style={styles.fine}>
            We deliver only where the sale of firecrackers is permitted. Follow local rules on timings and green
            crackers. Sold to adults only.
          </Text>
        </View>
        <Image
          source={require('@/assets/images/rkr-crackers.jpg')}
          style={[styles.art, wide && styles.artWide]}
          contentFit="cover"
          accessibilityLabel="A boy in a blue kurta holding an armful of rockets and sparklers"
        />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  band: { backgroundColor: colors.purple, paddingHorizontal: 16, paddingTop: 48, paddingBottom: 32 },
  inner: { width: '100%', maxWidth: MAX_CONTENT_WIDTH, alignSelf: 'center', gap: 28 },
  innerWide: { flexDirection: 'row', alignItems: 'flex-end' },
  col: { gap: 12 },
  colWide: { flex: 1 },
  name: { fontFamily: fonts.display, color: colors.gold },
  body: { fontFamily: fonts.text, fontSize: 17, lineHeight: 25, color: '#fff', maxWidth: 520 },
  phone: { fontFamily: fonts.display, fontSize: 40, color: '#fff', fontVariant: ['tabular-nums'] },
  links: { flexDirection: 'row', flexWrap: 'wrap', gap: 20, marginTop: 8 },
  link: { fontFamily: fonts.textSemi, fontSize: 16, color: '#fff', textDecorationLine: 'underline' },
  fine: { fontFamily: fonts.text, fontSize: 14, lineHeight: 20, color: '#E9DDF0', maxWidth: 560 },
  art: { width: '100%', aspectRatio: 1.41 },
  artWide: { flex: 1, width: undefined },
});
