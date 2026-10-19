import { ActivityIndicator, StyleSheet, Text, type ViewStyle } from 'react-native';

import { colors, type } from './theme';
import { PressScale } from './press-scale';

type Props = {
  title: string;
  onPress: () => void;
  variant?: 'primary' | 'secondary' | 'whatsapp';
  disabled?: boolean;
  loading?: boolean;
  style?: ViewStyle;
};

export function Button({ title, onPress, variant = 'primary', disabled, loading, style }: Props) {
  const inactive = disabled || loading;
  return (
    <PressScale
      accessibilityRole="button"
      accessibilityState={{ disabled: inactive }}
      onPress={onPress}
      disabled={inactive}
      style={[styles.base, styles[variant], inactive && styles.disabled, style]}>
      {loading ? (
        <ActivityIndicator color={variant === 'primary' ? colors.onPrimary : colors.text} />
      ) : (
        <Text style={[styles.text, variant !== 'primary' && styles.textSecondary]}>{title}</Text>
      )}
    </PressScale>
  );
}

const styles = StyleSheet.create({
  base: {
    minHeight: 48,
    borderRadius: 999,
    paddingHorizontal: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  primary: { backgroundColor: colors.primary },
  secondary: { backgroundColor: colors.sectionBg },
  whatsapp: { backgroundColor: '#1F9D55' },
  disabled: { opacity: 0.5 },
  text: { color: colors.onPrimary, ...type.semibold, fontSize: 16 },
  textSecondary: { color: colors.text },
});
