import { router, Stack } from 'expo-router';
import { Children, type ReactNode, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Modal,
  Platform,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  type TextInputProps,
  useWindowDimensions,
  Switch,
  View,
  type ViewStyle,
} from 'react-native';

import { haptic, isIOS, isNative, surface, Touchable } from '@/components/native';
import { PressScale } from '@/components/press-scale';
import { colors, fonts, type } from '@/components/theme';
import type { Tone } from '@/lib/status';

export const SIDEBAR_BREAKPOINT = 1024;

/** Surfaces step up in tone instead of carrying lines or shadows. */
export const admin = {
  ground: colors.background,
  panel: '#171513',
  raised: '#211E1B',
  well: '#100E0D',
  line: '#2C2825', // tables and form fields only
  ink: colors.text,
  soft: '#C9C2BA',
  muted: colors.muted,
  gold: colors.gold,
  series: { primary: '#C4861C', secondary: '#4F8BE8' }, // validated for the dark chart surface
};

export const TONES: Record<Tone, { bg: string; fg: string }> = {
  gold: { bg: '#3A2E14', fg: '#F2B544' },
  green: { bg: '#17301F', fg: '#7FD99A' },
  blue: { bg: '#16263F', fg: '#8DB8FF' },
  red: { bg: '#3A1B17', fg: '#FF8A7A' },
  amber: { bg: '#33260F', fg: '#E8A33D' },
  neutral: { bg: '#26221F', fg: '#C9C2BA' },
};

export function useLayout() {
  const { width } = useWindowDimensions();
  return { width, wide: width >= SIDEBAR_BREAKPOINT, medium: width >= 700 };
}

// ---------- page frame ----------

type PageProps = {
  title: string;
  lead?: string;
  actions?: ReactNode;
  back?: string;
  children: ReactNode;
  refreshing?: boolean;
  onRefresh?: () => void;
};

export function Page({ title, lead, actions, back, children, refreshing, onRefresh }: PageProps) {
  const { medium } = useLayout();
  if (isNative) {
    return (
      <ScrollView
        style={styles.page}
        contentContainerStyle={[styles.pageInner, styles.pageNative]}
        contentInsetAdjustmentBehavior="automatic"
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode="on-drag"
        refreshControl={onRefresh ? <RefreshControl refreshing={!!refreshing} onRefresh={onRefresh} tintColor={admin.gold} /> : undefined}>
        <Stack.Screen options={{ title }} />
        {lead || actions ? (
          <View style={styles.head}>
            {lead ? <Text style={styles.leadNative}>{lead}</Text> : null}
            {actions ? <View style={styles.headActions}>{actions}</View> : null}
          </View>
        ) : null}
        {children}
      </ScrollView>
    );
  }
  return (
    <ScrollView
      style={styles.page}
      contentContainerStyle={[styles.pageInner, medium && styles.pageInnerWide]}
      keyboardShouldPersistTaps="handled"
      refreshControl={onRefresh ? <RefreshControl refreshing={!!refreshing} onRefresh={onRefresh} tintColor={admin.gold} /> : undefined}>
      {back ? (
        <Pressable accessibilityRole="link" onPress={() => (router.canGoBack() ? router.back() : router.replace(back as never))}>
          <Text style={styles.back}>← Back</Text>
        </Pressable>
      ) : null}
      <View style={[styles.head, medium && styles.headWide]}>
        <View style={styles.headText}>
          <Text style={[styles.title, medium && styles.titleWide]} accessibilityRole="header">
            {title}
          </Text>
          {lead ? <Text style={styles.lead}>{lead}</Text> : null}
        </View>
        {actions ? <View style={styles.headActions}>{actions}</View> : null}
      </View>
      {children}
    </ScrollView>
  );
}

export function Section({ title, actions, children, style }: { title?: string; actions?: ReactNode; children: ReactNode; style?: ViewStyle }) {
  return (
    <View style={[styles.section, style]}>
      {title || actions ? (
        <View style={styles.sectionHead}>
          {title ? <Text style={styles.sectionTitle}>{title}</Text> : <View />}
          {actions}
        </View>
      ) : null}
      {children}
    </View>
  );
}

export function Panel({ children, style }: { children: ReactNode; style?: ViewStyle | ViewStyle[] }) {
  return <View style={[styles.panel, style]}>{children}</View>;
}

/** Columns that fold into one on a phone. */
export function Columns({ children, min = 700, gap = 16 }: { children: ReactNode; min?: number; gap?: number }) {
  const { width } = useLayout();
  if (width >= min) return <View style={{ flexDirection: 'row', gap, alignItems: 'stretch' }}>{children}</View>;
  // Stacked: each column sizes to its content, whatever flex it asks for side by side.
  return (
    <View style={{ gap }}>
      {Children.toArray(children).map((child, i) => (
        <View key={i}>{child}</View>
      ))}
    </View>
  );
}

// ---------- figures ----------

export function Stat({
  label,
  value,
  note,
  tone,
  onPress,
  big,
}: {
  label: string;
  value: string;
  note?: string;
  tone?: Tone;
  onPress?: () => void;
  big?: boolean;
}) {
  const body = (
    <>
      <Text style={[styles.statValue, big && styles.statValueBig, tone && { color: TONES[tone].fg }]} numberOfLines={1} adjustsFontSizeToFit>
        {value}
      </Text>
      <Text style={styles.statLabel}>{label}</Text>
      {note ? <Text style={styles.statNote}>{note}</Text> : null}
    </>
  );
  if (!onPress) return <View style={[styles.stat, big && styles.statBig]}>{body}</View>;
  return (
    <PressScale scaleTo={0.98} accessibilityRole="button" onPress={onPress} style={[styles.stat, big && styles.statBig]}>
      {body}
    </PressScale>
  );
}

export function StatGrid({ children }: { children: ReactNode }) {
  return <View style={styles.statGrid}>{children}</View>;
}

export function Pill({ label, tone = 'neutral' }: { label: string; tone?: Tone }) {
  const t = TONES[tone];
  return (
    <View style={[styles.pill, { backgroundColor: t.bg }]}>
      <View style={[styles.pillDot, { backgroundColor: t.fg }]} />
      <Text style={[styles.pillText, { color: t.fg }]}>{label}</Text>
    </View>
  );
}

// ---------- controls ----------

type BtnProps = { title: string; onPress: () => void; kind?: 'primary' | 'quiet' | 'danger'; disabled?: boolean; loading?: boolean; small?: boolean };

export function Btn({ title, onPress, kind = 'quiet', disabled, loading, small }: BtnProps) {
  const off = disabled || loading;
  return (
    <PressScale
      scaleTo={0.96}
      accessibilityRole="button"
      accessibilityState={{ disabled: off }}
      disabled={off}
      onPress={onPress}
      style={[styles.btn, small && styles.btnSmall, styles[`btn_${kind}`], off && styles.btnOff]}>
      {loading ? (
        <ActivityIndicator color={kind === 'primary' ? colors.onPrimary : admin.ink} />
      ) : (
        <Text style={[styles.btnText, small && styles.btnTextSmall, kind === 'primary' && styles.btnTextPrimary, kind === 'danger' && styles.btnTextDanger]}>
          {title}
        </Text>
      )}
    </PressScale>
  );
}

export function Chips<T extends string>({
  options,
  value,
  onChange,
  wrap,
}: {
  options: { value: T; label: string; count?: number }[];
  value: T;
  onChange: (v: T) => void;
  wrap?: boolean;
}) {
  const items = options.map((o) => {
    const on = o.value === value;
    return (
      <PressScale
        scaleTo={0.96}
        key={o.value || 'all'}
        accessibilityRole="button"
        accessibilityState={{ selected: on }}
        onPress={() => onChange(o.value)}
        style={[styles.chip, on && styles.chipOn]}>
        <Text style={[styles.chipText, on && styles.chipTextOn]}>
          {o.label}
          {o.count !== undefined ? ` ${o.count}` : ''}
        </Text>
      </PressScale>
    );
  });
  if (wrap) return <View style={styles.chipsWrap}>{items}</View>;
  return (
    <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chipsRow}>
      {items}
    </ScrollView>
  );
}

export function SearchBox({ value, onChange, placeholder }: { value: string; onChange: (v: string) => void; placeholder: string }) {
  return (
    <TextInput
      value={value}
      onChangeText={onChange}
      placeholder={placeholder}
      placeholderTextColor={admin.muted}
      style={styles.search}
      accessibilityLabel={placeholder}
      returnKeyType="search"
    />
  );
}

export function Field({ label, error, hint, style, ...input }: TextInputProps & { label: string; error?: string; hint?: string; style?: ViewStyle }) {
  return (
    <View style={[styles.field, style]}>
      <Text style={styles.fieldLabel}>{label}</Text>
      <TextInput
        placeholderTextColor={admin.muted}
        {...input}
        style={[styles.input, input.multiline && styles.inputMulti, !!error && styles.inputError]}
        accessibilityLabel={label}
      />
      {error ? <Text style={styles.fieldError}>{error}</Text> : hint ? <Text style={styles.fieldHint}>{hint}</Text> : null}
    </View>
  );
}

export function Toggle({ label, value, onChange }: { label: string; value: boolean; onChange: (v: boolean) => void }) {
  if (isNative) {
    return (
      <View style={styles.toggle}>
        <Switch
          value={value}
          onValueChange={(v) => {
            haptic.tap();
            onChange(v);
          }}
          trackColor={{ true: colors.green, false: admin.line }}
          accessibilityLabel={label}
        />
        <Text style={styles.toggleText}>{label}</Text>
      </View>
    );
  }
  return (
    <Pressable accessibilityRole="switch" accessibilityState={{ checked: value }} onPress={() => onChange(!value)} style={styles.toggle}>
      <View style={[styles.track, value && styles.trackOn]}>
        <View style={[styles.knob, value && styles.knobOn]} />
      </View>
      <Text style={styles.toggleText}>{label}</Text>
    </Pressable>
  );
}

export function FormRow({ children }: { children: ReactNode }) {
  const { medium } = useLayout();
  return <View style={[styles.formRow, medium && styles.formRowWide]}>{children}</View>;
}

// ---------- tables ----------

export type Column<T> = {
  key: string;
  label: string;
  flex?: number;
  align?: 'left' | 'right';
  render: (row: T) => ReactNode;
  /** Hidden from the stacked phone layout (the first column is always the card's title). */
  hideOnPhone?: boolean;
};

export function Table<T>({
  columns,
  rows,
  keyOf,
  onRowPress,
  empty = 'Nothing here yet.',
  loading,
}: {
  columns: Column<T>[];
  rows: T[] | undefined;
  keyOf: (row: T) => string | number;
  onRowPress?: (row: T) => void;
  empty?: string;
  loading?: boolean;
}) {
  const { medium } = useLayout();
  if (loading && !rows) return <Loading />;
  if (!rows?.length) return <Text style={styles.empty}>{empty}</Text>;

  if (!medium && isNative) {
    const [first, ...rest] = columns;
    return (
      <View style={styles.nativeGroup}>
        {rows.map((row, i) => {
          const inner = (
            <View style={styles.nativeRow}>
              <View style={styles.nativeRowMain}>
                <View style={styles.flex1}>{cell(first.render(row), styles.cardTitleText)}</View>
                {onRowPress && isIOS ? <Text style={styles.chevron}>›</Text> : null}
              </View>
              {rest
                .filter((c) => !c.hideOnPhone)
                .map((c) => (
                  <View key={c.key} style={styles.cardLine}>
                    <Text style={styles.cardLabel}>{c.label}</Text>
                    <View style={styles.cardValue}>{cell(c.render(row), styles.td, 'right')}</View>
                  </View>
                ))}
            </View>
          );
          return (
            <View key={keyOf(row)}>
              {i > 0 ? <View style={styles.nativeSeparator} /> : null}
              {onRowPress ? (
                <Touchable accessibilityRole="button" onPress={() => onRowPress(row)}>
                  {inner}
                </Touchable>
              ) : (
                inner
              )}
            </View>
          );
        })}
      </View>
    );
  }

  if (!medium) {
    const [first, ...rest] = columns;
    return (
      <View style={styles.cards}>
        {rows.map((row) => {
          const inner = (
            <>
              <View style={styles.cardTitle}>{cell(first.render(row), styles.cardTitleText)}</View>
              {rest
                .filter((c) => !c.hideOnPhone)
                .map((c) => (
                  <View key={c.key} style={styles.cardLine}>
                    <Text style={styles.cardLabel}>{c.label}</Text>
                    <View style={styles.cardValue}>{cell(c.render(row), styles.td, 'right')}</View>
                  </View>
                ))}
            </>
          );
          return onRowPress ? (
            <PressScale scaleTo={0.98} key={keyOf(row)} accessibilityRole="button" onPress={() => onRowPress(row)} style={styles.card}>
              {inner}
            </PressScale>
          ) : (
            <View key={keyOf(row)} style={styles.card}>
              {inner}
            </View>
          );
        })}
      </View>
    );
  }

  return (
    <View style={styles.table} accessibilityRole={Platform.OS === 'web' ? ('table' as never) : undefined}>
      <View style={[styles.tr, styles.thead]}>
        {columns.map((c) => (
          <Text key={c.key} style={[styles.th, { flex: c.flex ?? 1, textAlign: c.align ?? 'left' }]}>
            {c.label}
          </Text>
        ))}
      </View>
      {rows.map((row) => {
        const cells = columns.map((c) => (
          <View key={c.key} style={{ flex: c.flex ?? 1, alignItems: c.align === 'right' ? 'flex-end' : 'flex-start' }}>
            {cell(c.render(row), styles.td, c.align)}
          </View>
        ));
        return onRowPress ? (
          <Pressable
            key={keyOf(row)}
            accessibilityRole="button"
            onPress={() => onRowPress(row)}
            style={({ hovered, pressed }: { hovered?: boolean; pressed: boolean }) => [styles.tr, (hovered || pressed) && styles.trHover]}>
            {cells}
          </Pressable>
        ) : (
          <View key={keyOf(row)} style={styles.tr}>
            {cells}
          </View>
        );
      })}
    </View>
  );
}

function cell(node: ReactNode, style: object, align?: 'left' | 'right') {
  if (typeof node === 'string' || typeof node === 'number') {
    return <Text style={[style, align === 'right' && styles.num]}>{node}</Text>;
  }
  return node;
}

/** A label / value pair for detail panels. */
export function Line({ label, value, strong }: { label: string; value: ReactNode; strong?: boolean }) {
  return (
    <View style={styles.line}>
      <Text style={styles.lineLabel}>{label}</Text>
      {typeof value === 'string' || typeof value === 'number' ? (
        <Text style={[styles.lineValue, strong && styles.lineStrong]}>{value}</Text>
      ) : (
        value
      )}
    </View>
  );
}

// ---------- states ----------

export function Loading() {
  return <ActivityIndicator style={styles.loading} size="large" color={admin.gold} />;
}

export function ErrorText({ error }: { error: unknown }) {
  if (!error) return null;
  const message = error instanceof Error ? error.message : String(error);
  return <Text style={styles.error}>{message}</Text>;
}

export function Note({ children }: { children: ReactNode }) {
  return <Text style={styles.note}>{children}</Text>;
}

export function Sheet({ visible, title, onClose, children }: { visible: boolean; title: string; onClose: () => void; children: ReactNode }) {
  const { medium } = useLayout();
  if (isIOS) {
    return (
      <Modal visible={visible} presentationStyle="pageSheet" animationType="slide" onRequestClose={onClose}>
        <View style={styles.pageSheet}>
          <View style={styles.pageSheetBar}>
            <Text style={styles.pageSheetTitle}>{title}</Text>
            <Pressable accessibilityRole="button" onPress={onClose} hitSlop={12} style={styles.pageSheetDone}>
              <Text style={styles.pageSheetDoneText}>Cancel</Text>
            </Pressable>
          </View>
          <ScrollView contentContainerStyle={styles.sheetBody} keyboardShouldPersistTaps="handled" keyboardDismissMode="interactive">
            {children}
          </ScrollView>
        </View>
      </Modal>
    );
  }
  return (
    <Modal visible={visible} transparent animationType={isNative ? 'slide' : 'fade'} onRequestClose={onClose} statusBarTranslucent>
      <Pressable style={styles.scrim} onPress={onClose} accessibilityLabel="Close" />
      <View style={[styles.sheetWrap, medium && styles.sheetWrapWide]} pointerEvents="box-none">
        <View style={[styles.sheet, medium && styles.sheetWide]}>
          <View style={styles.sheetHead}>
            <Text style={styles.sheetTitle}>{title}</Text>
            <Pressable accessibilityRole="button" onPress={onClose} hitSlop={12}>
              <Text style={styles.sheetClose}>Close</Text>
            </Pressable>
          </View>
          <ScrollView contentContainerStyle={styles.sheetBody} keyboardShouldPersistTaps="handled">
            {children}
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
}

/** Asks before something that can't be undone. */
export function confirm(message: string): Promise<boolean> {
  if (Platform.OS === 'web') return Promise.resolve(window.confirm(message));
  return new Promise((resolve) =>
    Alert.alert('Please confirm', message, [
      { text: 'Cancel', style: 'cancel', onPress: () => resolve(false) },
      { text: 'Yes', style: 'destructive', onPress: () => resolve(true) },
    ]),
  );
}

/** Keeps a form's text fields in one object. */
export function useForm<T extends Record<string, unknown>>(initial: T) {
  const [form, setForm] = useState<T>(initial);
  const set = <K extends keyof T>(key: K) => (value: T[K]) => setForm((f) => ({ ...f, [key]: value }));
  return { form, setForm, set };
}

export const fieldErrors = (error: unknown): Record<string, string> => {
  const fields = (error as { fields?: Record<string, string[]> } | null)?.fields;
  return fields ? Object.fromEntries(Object.entries(fields).map(([k, v]) => [k, v.join(' ')])) : {};
};

const styles = StyleSheet.create({
  page: { flex: 1, backgroundColor: admin.ground },
  pageInner: { padding: 16, paddingBottom: 64, gap: 28, width: '100%', maxWidth: 1280, alignSelf: 'center' },
  pageNative: { paddingTop: 8, gap: 24 },
  leadNative: { color: admin.soft, ...type.regular, fontSize: 15, lineHeight: 21 },
  nativeGroup: { backgroundColor: surface.group, borderRadius: isIOS ? 12 : 16, overflow: 'hidden' },
  nativeRow: { paddingHorizontal: 16, paddingVertical: 12, gap: 6 },
  nativeRowMain: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  nativeSeparator: { height: StyleSheet.hairlineWidth, backgroundColor: surface.separator, marginLeft: 16 },
  chevron: { color: '#5E5852', fontSize: 24, lineHeight: 26 },
  flex1: { flex: 1 },
  pageSheet: { flex: 1, backgroundColor: admin.panel },
  pageSheetBar: { height: 56, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 16 },
  pageSheetTitle: { color: admin.ink, ...type.semibold, fontSize: 17 },
  pageSheetDone: { position: 'absolute', left: 16, top: 0, bottom: 0, justifyContent: 'center' },
  pageSheetDoneText: { color: admin.gold, ...type.regular, fontSize: 17 },
  pageInnerWide: { padding: 32, paddingBottom: 96, gap: 40 },
  back: { color: admin.soft, ...type.medium, fontSize: 15, marginBottom: -12 },
  head: { gap: 16 },
  headWide: { flexDirection: 'row', alignItems: 'flex-end', justifyContent: 'space-between' },
  headText: { gap: 6, flexShrink: 1 },
  title: { color: admin.ink, fontFamily: fonts.display, fontSize: 34, lineHeight: 38, letterSpacing: -0.6 },
  titleWide: { fontSize: 48, lineHeight: 52, letterSpacing: -1.2 },
  lead: { color: admin.soft, ...type.regular, fontSize: 16, lineHeight: 24, maxWidth: 640 },
  headActions: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },

  section: { gap: 14 },
  sectionHead: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' },
  sectionTitle: { color: admin.ink, ...type.semibold, fontSize: 20 },
  panel: { backgroundColor: admin.panel, borderRadius: 16, padding: 18, gap: 12 },

  statGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 12 },
  stat: { flexGrow: 1, flexBasis: 150, backgroundColor: admin.panel, borderRadius: 16, padding: 18, gap: 4, minWidth: 140 },
  statBig: { flexBasis: 260, backgroundColor: admin.raised },
  statValue: { color: admin.ink, ...type.semibold, fontSize: 28, lineHeight: 34, fontVariant: ['tabular-nums'], letterSpacing: -0.5 },
  statValueBig: { fontFamily: fonts.display, fontSize: 52, lineHeight: 56, letterSpacing: -1.5 },
  statLabel: { color: admin.ink, ...type.medium, fontSize: 15 },
  statNote: { color: admin.muted, ...type.regular, fontSize: 14 },

  pill: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 10, paddingVertical: 4, borderRadius: 999, alignSelf: 'flex-start' },
  pillDot: { width: 6, height: 6, borderRadius: 3 },
  pillText: { ...type.medium, fontSize: 13 },

  btn: { minHeight: 44, paddingHorizontal: 18, borderRadius: 999, alignItems: 'center', justifyContent: 'center' },
  btnSmall: { minHeight: 34, paddingHorizontal: 14 },
  btn_primary: { backgroundColor: admin.gold },
  btn_quiet: { backgroundColor: admin.raised },
  btn_danger: { backgroundColor: TONES.red.bg },
  btnOff: { opacity: 0.45 },
  btnText: { color: admin.ink, ...type.semibold, fontSize: 15 },
  btnTextSmall: { fontSize: 14 },
  btnTextPrimary: { color: colors.onPrimary },
  btnTextDanger: { color: TONES.red.fg },

  chipsRow: { gap: 8, paddingRight: 8 },
  chipsWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip: { paddingHorizontal: 14, paddingVertical: 8, borderRadius: 999, backgroundColor: admin.panel },
  chipOn: { backgroundColor: admin.ink },
  chipText: { color: admin.soft, ...type.medium, fontSize: 14, fontVariant: ['tabular-nums'] },
  chipTextOn: { color: admin.ground },

  search: {
    height: 46, borderRadius: 999, paddingHorizontal: 18, backgroundColor: admin.panel,
    color: admin.ink, ...type.regular, fontSize: 16, flexGrow: 1, minWidth: 200,
  },
  field: { gap: 6, flexGrow: 1, flexBasis: 200 },
  fieldLabel: { color: admin.ink, ...type.medium, fontSize: 14 },
  input: {
    minHeight: 44, borderRadius: 10, borderWidth: 1, borderColor: admin.line, paddingHorizontal: 12,
    backgroundColor: admin.well, color: admin.ink, ...type.regular, fontSize: 16,
  },
  inputMulti: { minHeight: 88, paddingTop: 10, textAlignVertical: 'top' },
  inputError: { borderColor: colors.danger },
  fieldError: { color: colors.danger, ...type.regular, fontSize: 13 },
  fieldHint: { color: admin.muted, ...type.regular, fontSize: 13 },
  formRow: { gap: 14 },
  formRowWide: { flexDirection: 'row', flexWrap: 'wrap' },

  toggle: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 4 },
  track: { width: 42, height: 24, borderRadius: 12, backgroundColor: admin.line, padding: 3 },
  trackOn: { backgroundColor: colors.green },
  knob: { width: 18, height: 18, borderRadius: 9, backgroundColor: admin.soft },
  knobOn: { transform: [{ translateX: 18 }], backgroundColor: admin.ground },
  toggleText: { color: admin.ink, ...type.regular, fontSize: 15 },

  table: { backgroundColor: admin.panel, borderRadius: 16, paddingVertical: 4, overflow: 'hidden' },
  thead: { backgroundColor: admin.panel },
  tr: { flexDirection: 'row', alignItems: 'center', gap: 16, paddingHorizontal: 18, paddingVertical: 13, borderBottomWidth: 1, borderBottomColor: admin.line },
  trHover: { backgroundColor: admin.raised },
  th: { color: admin.muted, ...type.medium, fontSize: 14 },
  td: { color: admin.ink, ...type.regular, fontSize: 15 },
  num: { fontVariant: ['tabular-nums'], textAlign: 'right' },

  cards: { gap: 10 },
  card: { backgroundColor: admin.panel, borderRadius: 14, padding: 14, gap: 6 },
  cardTitle: { marginBottom: 2 },
  cardTitleText: { color: admin.ink, ...type.semibold, fontSize: 16 },
  cardLine: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: 12 },
  cardLabel: { color: admin.muted, ...type.regular, fontSize: 14 },
  cardValue: { flexShrink: 1, alignItems: 'flex-end' },

  line: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: 16, paddingVertical: 2 },
  lineLabel: { color: admin.soft, ...type.regular, fontSize: 15 },
  lineValue: { color: admin.ink, ...type.medium, fontSize: 15, fontVariant: ['tabular-nums'], textAlign: 'right', flexShrink: 1 },
  lineStrong: { ...type.semibold, fontSize: 18 },

  loading: { paddingVertical: 48 },
  empty: { color: admin.muted, ...type.regular, fontSize: 15, paddingVertical: 24, textAlign: 'center' },
  error: { color: colors.danger, ...type.medium, fontSize: 15 },
  note: { color: admin.muted, ...type.regular, fontSize: 14, lineHeight: 21 },

  scrim: { ...StyleSheet.absoluteFill, backgroundColor: 'rgba(0,0,0,0.6)' },
  sheetWrap: { flex: 1, justifyContent: 'flex-end' },
  sheetWrapWide: { justifyContent: 'center', alignItems: 'center', padding: 24 },
  // A dialog truly floats, so it is the one place with a shadow.
  sheet: {
    backgroundColor: admin.panel, borderTopLeftRadius: 20, borderTopRightRadius: 20, maxHeight: '90%',
    shadowColor: '#000', shadowOpacity: 0.5, shadowRadius: 30, elevation: 12,
  },
  sheetWide: { borderRadius: 20, width: '100%', maxWidth: 560 },
  sheetHead: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 20, paddingBottom: 8 },
  sheetTitle: { color: admin.ink, fontFamily: fonts.display, fontSize: 28 },
  sheetClose: { color: admin.soft, ...type.medium, fontSize: 15 },
  sheetBody: { padding: 20, paddingTop: 8, gap: 14 },
});
