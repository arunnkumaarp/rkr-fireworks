import { StyleSheet, Text, View } from 'react-native';

import { colors, fonts } from './theme';

/** A category heading, set like the website's price list. */
export function Banner({ title }: { title: string; color?: string }) {
  return (
    <View style={styles.wrap} accessibilityRole="header">
      <Text style={styles.title}>{title}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { paddingTop: 36, paddingBottom: 10, paddingHorizontal: 14, backgroundColor: colors.background },
  title: { fontFamily: fonts.display, fontSize: 26, color: colors.gold },
});
