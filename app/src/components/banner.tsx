import { StyleSheet, Text, View } from 'react-native';
import Svg, { Polygon } from 'react-native-svg';

import { fonts } from './theme';

const H = 40;
const NOTCH = 14;

/** The price list's category banner: a filled band with chevron-cut ends. */
export function Banner({ title, color }: { title: string; color: string }) {
  return (
    <View style={styles.wrap} accessibilityRole="header">
      <View style={styles.band}>
        <Svg width={NOTCH} height={H} style={styles.end}>
          <Polygon points={`0,0 ${NOTCH},0 ${NOTCH},${H} 0,${H} ${NOTCH},${H / 2}`} fill={color} />
        </Svg>
        <View style={[styles.mid, { backgroundColor: color }]}>
          <Text style={styles.title} numberOfLines={1}>
            {title.toUpperCase()}
          </Text>
        </View>
        <Svg width={NOTCH} height={H} style={styles.end}>
          <Polygon points={`0,0 ${NOTCH},0 0,${H / 2} ${NOTCH},${H} 0,${H}`} fill={color} />
        </Svg>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { alignItems: 'center', paddingVertical: 12, backgroundColor: '#fff' },
  band: { flexDirection: 'row', height: H, maxWidth: '100%' },
  end: { flexShrink: 0 },
  mid: { justifyContent: 'center', paddingHorizontal: 20, minWidth: 200, flexShrink: 1 },
  title: { fontFamily: fonts.display, fontSize: 20, color: '#fff', textAlign: 'center' },
});
