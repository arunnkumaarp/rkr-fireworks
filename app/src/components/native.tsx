import * as Haptics from 'expo-haptics';
import { Slot, Stack } from 'expo-router';
import type { ComponentProps, ReactNode } from 'react';
import { Alert, Platform, Pressable, type PressableProps, StyleSheet, Text, View, type ViewStyle } from 'react-native';

import { colors, fonts, type } from './theme';

export const isNative = Platform.OS !== 'web';
export const isIOS = Platform.OS === 'ios';

/** Grouped-list surfaces, one tone step above the ground (iOS inset grouped lists, Material surface containers). */
export const surface = {
  ground: colors.background,
  group: '#1C1A18',
  pressed: '#2A2622',
  separator: '#34302C',
  secondary: '#A8A19A',
};

// ---------- feedback ----------

export const haptic = {
  /** A light tap: adding to the cart, toggling. */
  tap: () => isNative && Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {}),
  /** Moving through values: quantity steps, chips. */
  select: () => isNative && Haptics.selectionAsync().catch(() => {}),
  success: () => isNative && Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {}),
  warning: () => isNative && Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning).catch(() => {}),
};

/**
 * Platform press feedback: an ink ripple on Android, a highlight on iOS, hover on the web.
 * Use for list rows and other large targets; buttons keep their spring.
 */
export function Touchable({ style, children, ...rest }: PressableProps & { style?: ViewStyle | ViewStyle[]; children: ReactNode }) {
  return (
    <Pressable
      android_ripple={{ color: 'rgba(255,255,255,0.12)' }}
      style={({ pressed, hovered }: { pressed: boolean; hovered?: boolean }) => [
        style,
        (pressed && isIOS) || hovered ? { backgroundColor: surface.pressed } : null,
      ]}
      {...rest}>
      {children}
    </Pressable>
  );
}

/** The platform's own confirm dialog (UIAlertController / Material dialog); window.confirm on the web. */
export function confirmNative(title: string, message: string, action = 'OK'): Promise<boolean> {
  if (!isNative) return Promise.resolve(window.confirm(`${title}\n\n${message}`));
  return new Promise((resolve) =>
    Alert.alert(title, message, [
      { text: 'Cancel', style: 'cancel', onPress: () => resolve(false) },
      { text: action, style: 'destructive', onPress: () => resolve(true) },
    ], { cancelable: true, onDismiss: () => resolve(false) }),
  );
}

// ---------- navigation ----------

/** Header styling for every native stack: night ground, gold controls, system title, brand large title. */
export const stackOptions: ComponentProps<typeof Stack>['screenOptions'] = {
  headerStyle: { backgroundColor: colors.background },
  headerShadowVisible: false,
  headerTintColor: colors.gold,
  headerTitleStyle: { color: colors.text, ...type.semibold },
  headerLargeTitleStyle: { color: colors.text, fontFamily: fonts.display },
  headerLargeTitleShadowVisible: false,
  headerBackButtonDisplayMode: 'minimal',
  contentStyle: { backgroundColor: colors.background },
};

/** The stack inside one tab. Large titles on iOS; Material's top app bar on Android. The web shows its own layout. */
export function TabStack() {
  if (!isNative) return <Slot />;
  return <Stack screenOptions={{ ...stackOptions, headerLargeTitle: isIOS }} />;
}

// ---------- lists ----------

/** An inset grouped list section (iOS Settings) that reads as a Material list on Android. */
export function ListSection({ title, footer, children, style }: { title?: string; footer?: string; children: ReactNode; style?: ViewStyle }) {
  const rows = (Array.isArray(children) ? children.flat() : [children]).filter(Boolean);
  return (
    <View style={[styles.section, style]}>
      {title ? <Text style={styles.sectionTitle}>{title}</Text> : null}
      <View style={styles.group}>
        {rows.map((row, i) => (
          <View key={i}>
            {i > 0 ? <View style={styles.separator} /> : null}
            {row}
          </View>
        ))}
      </View>
      {footer ? <Text style={styles.sectionFooter}>{footer}</Text> : null}
    </View>
  );
}

type RowProps = {
  title: string;
  subtitle?: string;
  value?: string;
  onPress?: () => void;
  destructive?: boolean;
  tint?: boolean;
  accessory?: ReactNode;
  /** Shows the iOS disclosure chevron. On by default for rows that navigate. */
  chevron?: boolean;
};

export function ListRow({ title, subtitle, value, onPress, destructive, tint, accessory, chevron = !!onPress }: RowProps) {
  const body = (
    <View style={styles.row}>
      <View style={styles.rowText}>
        <Text style={[styles.rowTitle, destructive && styles.destructive, tint && styles.tint]} numberOfLines={2}>
          {title}
        </Text>
        {subtitle ? <Text style={styles.rowSubtitle}>{subtitle}</Text> : null}
      </View>
      {value ? <Text style={styles.rowValue}>{value}</Text> : null}
      {accessory}
      {chevron && isIOS ? <Text style={styles.chevron}>›</Text> : null}
    </View>
  );
  if (!onPress) return body;
  return (
    <Touchable accessibilityRole="button" onPress={onPress}>
      {body}
    </Touchable>
  );
}

const styles = StyleSheet.create({
  section: { gap: 8 },
  sectionTitle: { color: surface.secondary, ...type.medium, fontSize: 14, marginHorizontal: 16 },
  sectionFooter: { color: surface.secondary, ...type.regular, fontSize: 13, lineHeight: 18, marginHorizontal: 16 },
  group: { backgroundColor: surface.group, borderRadius: isIOS ? 12 : 16, overflow: 'hidden' },
  separator: { height: StyleSheet.hairlineWidth, backgroundColor: surface.separator, marginLeft: 16 },
  row: { minHeight: isIOS ? 48 : 56, paddingHorizontal: 16, paddingVertical: 11, flexDirection: 'row', alignItems: 'center', gap: 12 },
  rowText: { flex: 1, gap: 2 },
  rowTitle: { color: colors.text, ...type.regular, fontSize: isIOS ? 17 : 16 },
  rowSubtitle: { color: surface.secondary, ...type.regular, fontSize: 14, lineHeight: 19 },
  rowValue: { color: surface.secondary, ...type.regular, fontSize: isIOS ? 17 : 16, fontVariant: ['tabular-nums'] },
  chevron: { color: '#5E5852', fontSize: 24, lineHeight: 26, marginRight: -4 },
  destructive: { color: colors.danger },
  tint: { color: colors.gold },
});
