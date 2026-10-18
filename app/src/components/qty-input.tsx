import { useState } from 'react';
import { StyleSheet, Text, TextInput, View } from 'react-native';

import { MAX_QTY } from '@/store/cart';

import { colors, fonts } from './theme';
import { PressScale } from './press-scale';

type Props = { value: number; onChange: (qty: number) => void; label: string };

export function QtyInput({ value, onChange, label }: Props) {
  // Local text so the field can be empty while typing.
  const [text, setText] = useState(value ? String(value) : '');
  const [shown, setShown] = useState(value);
  if (value !== shown) {
    setShown(value);
    setText(value ? String(value) : '');
  }

  if (value === 0) {
    return (
      <PressScale
        scaleTo={0.9}
        accessibilityRole="button"
        accessibilityLabel={`Add ${label}`}
        onPress={() => onChange(1)}
        style={styles.add}>
        <Text style={styles.addText}>Add</Text>
      </PressScale>
    );
  }

  return (
    <View style={styles.row}>
      <PressScale
        scaleTo={0.8}
        accessibilityRole="button"
        accessibilityLabel={`Decrease ${label}`}
        onPress={() => onChange(value - 1)}
        style={styles.btn}>
        <Text style={styles.btnText}>−</Text>
      </PressScale>
      <TextInput
        accessibilityLabel={`Quantity of ${label}`}
        value={text}
        keyboardType="number-pad"
        maxLength={String(MAX_QTY).length}
        selectTextOnFocus
        onChangeText={(t) => setText(t.replace(/\D/g, ''))}
        onEndEditing={() => onChange(Number(text) || 0)}
        onBlur={() => onChange(Number(text) || 0)}
        style={styles.input}
      />
      <PressScale
        scaleTo={0.8}
        accessibilityRole="button"
        accessibilityLabel={`Increase ${label}`}
        onPress={() => onChange(value + 1)}
        style={styles.btn}>
        <Text style={styles.btnText}>+</Text>
      </PressScale>
    </View>
  );
}

const styles = StyleSheet.create({
  add: {
    width: 112,
    height: 40,
    borderRadius: 999,
    backgroundColor: colors.sectionBg,
    alignItems: 'center',
    justifyContent: 'center',
  },
  addText: { fontFamily: fonts.textBold, fontSize: 16, color: colors.gold },
  row: {
    width: 112,
    height: 40,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderRadius: 999,
    backgroundColor: colors.gold,
    paddingHorizontal: 2,
  },
  btn: { width: 36, height: 36, borderRadius: 999, alignItems: 'center', justifyContent: 'center' },
  btnText: { fontFamily: fonts.textBold, fontSize: 20, lineHeight: 22, color: colors.onPrimary },
  input: {
    width: 36,
    minWidth: 0,
    height: 36,
    textAlign: 'center',
    fontFamily: fonts.textBold,
    fontSize: 16,
    color: colors.onPrimary,
    padding: 0,
  },
});
