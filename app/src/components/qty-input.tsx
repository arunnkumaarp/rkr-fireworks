import { useState } from 'react';
import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native';

import { MAX_QTY } from '@/store/cart';

import { colors, fonts } from './theme';

type Props = { value: number; onChange: (qty: number) => void; label: string };

export function QtyInput({ value, onChange, label }: Props) {
  // Local text so the field can be empty while typing.
  const [text, setText] = useState(value ? String(value) : '');
  const [shown, setShown] = useState(value);
  if (value !== shown) {
    setShown(value);
    setText(value ? String(value) : '');
  }

  return (
    <View style={styles.row}>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={`Decrease ${label}`}
        onPress={() => onChange(value - 1)}
        disabled={value === 0}
        style={[styles.btn, value === 0 && styles.btnDisabled]}>
        <Text style={styles.btnText}>−</Text>
      </Pressable>
      <TextInput
        accessibilityLabel={`Quantity of ${label}`}
        value={text}
        placeholder="0"
        placeholderTextColor={colors.muted}
        keyboardType="number-pad"
        maxLength={String(MAX_QTY).length}
        selectTextOnFocus
        onChangeText={(t) => setText(t.replace(/\D/g, ''))}
        onEndEditing={() => onChange(Number(text) || 0)}
        onBlur={() => onChange(Number(text) || 0)}
        style={[styles.input, value > 0 && styles.inputActive]}
      />
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={`Increase ${label}`}
        onPress={() => onChange(value + 1)}
        style={[styles.btn, styles.btnPlus]}>
        <Text style={[styles.btnText, styles.btnPlusText]}>+</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  btn: {
    width: 32,
    height: 32,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.surface,
  },
  btnDisabled: { opacity: 0.4 },
  btnPlus: { backgroundColor: colors.primary, borderColor: colors.primary },
  btnText: { fontFamily: fonts.textSemi, fontSize: 18, color: colors.text, lineHeight: 20 },
  btnPlusText: { color: '#fff' },
  input: {
    width: 44,
    height: 32,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: colors.border,
    textAlign: 'center',
    fontFamily: fonts.textSemi, fontSize: 15,
    color: colors.text,
    backgroundColor: colors.surface,
    padding: 0,
  },
  inputActive: { borderColor: colors.primary, backgroundColor: '#FFF4F4' },
});
