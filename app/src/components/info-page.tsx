import { ScrollView, StyleSheet, Text, View } from 'react-native';

import { colors, fonts } from './theme';

export type InfoSection = { heading: string; body: string[] };

export function InfoPage({ title, intro, sections }: { title: string; intro: string; sections: InfoSection[] }) {
  return (
    <ScrollView contentContainerStyle={styles.container}>
      <Text style={styles.title} accessibilityRole="header">
        {title}
      </Text>
      <Text style={styles.intro}>{intro}</Text>
      {sections.map((s) => (
        <View key={s.heading} style={styles.section}>
          <Text style={styles.heading} accessibilityRole="header">
            {s.heading}
          </Text>
          {s.body.map((p) => (
            <Text key={p} style={styles.body}>
              {p}
            </Text>
          ))}
        </View>
      ))}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { padding: 20, paddingBottom: 64, gap: 28, width: '100%', maxWidth: 720, alignSelf: 'center' },
  title: { fontFamily: fonts.display, fontSize: 48, lineHeight: 50, color: colors.text },
  intro: { fontFamily: fonts.text, fontSize: 20, lineHeight: 29, color: colors.text },
  section: { gap: 10 },
  heading: { fontFamily: fonts.textBold, fontSize: 20, color: colors.primary },
  body: { fontFamily: fonts.text, fontSize: 17, lineHeight: 26, color: colors.text },
});
