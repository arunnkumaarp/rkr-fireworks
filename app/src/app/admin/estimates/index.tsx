import { useQuery } from '@tanstack/react-query';
import { router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { FlatList, RefreshControl, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';

import { colors, fonts } from '@/components/theme';
import { api } from '@/lib/api';
import { formatRupees } from '@/lib/format';
import { ADMIN_STATUS_LABEL, STATUSES } from '@/lib/status';
import { PressScale } from '@/components/press-scale';

export default function AdminEstimates() {
  const params = useLocalSearchParams<{ status?: string }>();
  const [status, setStatus] = useState(params.status ?? '');
  const [search, setSearch] = useState('');
  const list = useQuery({
    queryKey: ['admin', 'estimates', status, search.trim()],
    queryFn: () => api.admin.estimates({ status, search: search.trim() }),
  });

  return (
    <FlatList
      contentContainerStyle={styles.container}
      data={list.data ?? []}
      keyExtractor={(e) => e.number}
      keyboardShouldPersistTaps="handled"
      refreshControl={<RefreshControl refreshing={list.isRefetching} onRefresh={() => void list.refetch()} />}
      ListHeaderComponent={
        <View style={styles.header}>
          <TextInput
            value={search}
            onChangeText={setSearch}
            placeholder="Search number, name, phone, city"
            placeholderTextColor={colors.muted}
            style={styles.search}
            accessibilityLabel="Search estimates"
          />
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chips}>
            {['', ...STATUSES].map((s) => (
              <PressScale scaleTo={0.97}
                key={s || 'all'}
                accessibilityRole="button"
                accessibilityState={{ selected: status === s }}
                onPress={() => setStatus(s)}
                style={[styles.chip, status === s && styles.chipActive]}>
                <Text style={[styles.chipText, status === s && styles.chipTextActive]}>
                  {s ? ADMIN_STATUS_LABEL[s] : 'All'}
                </Text>
              </PressScale>
            ))}
          </ScrollView>
        </View>
      }
      ListEmptyComponent={
        <Text style={styles.empty}>
          {list.isPending ? 'Loading…' : list.isError ? `Could not load: ${list.error.message}` : 'No estimates here.'}
        </Text>
      }
      renderItem={({ item }) => (
        <PressScale scaleTo={0.97}
          accessibilityRole="button"
          onPress={() => router.push({ pathname: '/admin/estimates/[number]', params: { number: item.number } })}
          style={styles.card}>
          <View style={styles.cardTop}>
            <Text style={styles.number}>{item.number}</Text>
            <Text style={styles.total}>{formatRupees(item.total)}</Text>
          </View>
          <Text style={styles.name}>
            {item.customer_name} · {item.city}
          </Text>
          <Text style={[styles.status, item.status === 'submitted' && styles.statusNew]}>
            {ADMIN_STATUS_LABEL[item.status] ?? item.status} ·{' '}
            {new Date(item.created_at).toLocaleString('en-IN', { day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit' })}
          </Text>
        </PressScale>
      )}
    />
  );
}

const styles = StyleSheet.create({
  container: { padding: 16, gap: 10, width: '100%', maxWidth: 720, alignSelf: 'center' },
  header: { gap: 10, marginBottom: 4 },
  search: {
    height: 44,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: colors.border,
    paddingHorizontal: 12,
    fontFamily: fonts.text, fontSize: 16,
    color: colors.text,
    backgroundColor: colors.surface,
  },
  chips: { gap: 8 },
  chip: { paddingHorizontal: 14, paddingVertical: 8, borderRadius: 999, backgroundColor: colors.surfaceAlt },
  chipActive: { backgroundColor: colors.purple },
  chipText: { fontFamily: fonts.textSemi, fontSize: 14, color: colors.text },
  chipTextActive: { color: colors.text },
  empty: { padding: 24, textAlign: 'center', color: colors.muted, fontFamily: fonts.text, fontSize: 15 },
  card: { backgroundColor: colors.surfaceAlt, borderRadius: 14, padding: 14, gap: 3 },
  pressed: { opacity: 0.8 },
  cardTop: { flexDirection: 'row', justifyContent: 'space-between' },
  number: { fontFamily: fonts.textBold, fontSize: 17, color: colors.text },
  total: { fontFamily: fonts.textBold, fontSize: 17, color: colors.text, fontVariant: ['tabular-nums'] },
  name: { fontFamily: fonts.text, fontSize: 15, color: colors.text },
  status: { fontFamily: fonts.text, fontSize: 14, color: colors.muted },
  statusNew: { color: colors.primary, fontFamily: fonts.textBold },
});
