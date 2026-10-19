import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { router } from 'expo-router';
import { useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { admin as tone, Btn, Chips, ErrorText, Loading, Page, TONES } from '@/components/admin/ui';
import { PressScale } from '@/components/press-scale';
import { type } from '@/components/theme';
import { admin } from '@/lib/admin-api';
import { formatDateTime } from '@/lib/format';

const KINDS = [
  { value: '', label: 'Everything' },
  { value: 'new_order', label: 'New orders' },
  { value: 'stock', label: 'Stock' },
  { value: 'dispatch', label: 'Dispatch' },
  { value: 'transit', label: 'In transit' },
  { value: 'payment', label: 'Payments' },
  { value: 'refund', label: 'Refunds' },
];

export default function NotificationsScreen() {
  const list = useQuery({ queryKey: ['admin', 'notifications'], queryFn: admin.notifications });
  const [kind, setKind] = useState('');
  const queryClient = useQueryClient();
  const seen = useMutation({
    mutationFn: admin.markSeen,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['admin', 'notifications'] }),
  });
  const items = (list.data?.items ?? []).filter((a) => !kind || a.kind === kind);
  const counts = Object.fromEntries(KINDS.map((k) => [k.value, (list.data?.items ?? []).filter((a) => !k.value || a.kind === k.value).length]));

  return (
    <Page
      title="Notifications"
      lead="What needs attention now. Alerts clear themselves once the order or product is dealt with."
      actions={list.data?.unread ? <Btn title={`Mark ${list.data.unread} as read`} loading={seen.isPending} onPress={() => seen.mutate()} /> : undefined}
      refreshing={list.isRefetching}
      onRefresh={() => void list.refetch()}>
      <Chips options={KINDS.filter((k) => !k.value || counts[k.value]).map((k) => ({ ...k, count: counts[k.value] }))} value={kind} onChange={setKind} />
      <ErrorText error={list.error} />
      {list.isPending ? (
        <Loading />
      ) : !items.length ? (
        <Text style={styles.empty}>All clear. Nothing needs you right now.</Text>
      ) : (
        <View style={styles.list}>
          {items.map((a) => (
            <PressScale key={a.id} scaleTo={0.99} accessibilityRole="link" onPress={() => router.push(a.link as never)} style={[styles.item, a.unread && styles.unread]}>
              <View style={[styles.mark, { backgroundColor: TONES[a.tone === 'alert' ? 'red' : a.tone === 'warn' ? 'amber' : 'blue'].fg }]} />
              <View style={styles.body}>
                <Text style={styles.title}>{a.title}</Text>
                <Text style={styles.text}>{a.body}</Text>
              </View>
              <Text style={styles.when}>
                {a.unread ? 'New · ' : ''}
                {formatDateTime(a.at)}
              </Text>
            </PressScale>
          ))}
        </View>
      )}
    </Page>
  );
}

const styles = StyleSheet.create({
  empty: { color: tone.soft, ...type.regular, fontSize: 17, paddingVertical: 32 },
  list: { gap: 8 },
  item: { flexDirection: 'row', alignItems: 'flex-start', gap: 14, backgroundColor: tone.panel, borderRadius: 14, padding: 16, flexWrap: 'wrap' },
  unread: { backgroundColor: tone.raised },
  mark: { width: 4, alignSelf: 'stretch', borderRadius: 2 },
  body: { flex: 1, gap: 3, minWidth: 200 },
  title: { color: tone.ink, ...type.semibold, fontSize: 16 },
  text: { color: tone.soft, ...type.regular, fontSize: 15, lineHeight: 21 },
  when: { color: tone.muted, ...type.regular, fontSize: 13 },
});
