import { useQuery } from '@tanstack/react-query';
import { Redirect, router, Slot, usePathname } from 'expo-router';
import { useState } from 'react';
import { Platform, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { admin as tone, TONES, useLayout } from '@/components/admin/ui';
import { colors, fonts } from '@/components/theme';
import { admin } from '@/lib/admin-api';
import { useAuth } from '@/store/auth';

type Item = { href: string; label: string; adminOnly?: boolean; badge?: 'alerts' | 'new' };

const NAV: { group: string; items: Item[] }[] = [
  {
    group: 'Today',
    items: [
      { href: '/admin', label: 'Dashboard' },
      { href: '/admin/notifications', label: 'Notifications', badge: 'alerts' },
    ],
  },
  {
    group: 'Sales',
    items: [
      { href: '/admin/estimates', label: 'Orders', badge: 'new' },
      { href: '/admin/dispatch', label: 'Dispatch' },
      { href: '/admin/customers', label: 'Customers' },
    ],
  },
  {
    group: 'Price list',
    items: [
      { href: '/admin/products', label: 'Products' },
      { href: '/admin/categories', label: 'Categories' },
      { href: '/admin/inventory', label: 'Inventory' },
      { href: '/admin/offers', label: 'Offers & coupons', adminOnly: true },
    ],
  },
  {
    group: 'Money',
    items: [
      { href: '/admin/payments', label: 'Payments', adminOnly: true },
      { href: '/admin/expenses', label: 'Expenses', adminOnly: true },
      { href: '/admin/reports', label: 'Reports', adminOnly: true },
    ],
  },
  {
    group: 'Shop',
    items: [
      { href: '/admin/settings', label: 'Settings & team', adminOnly: true },
      { href: '/admin/audit', label: 'Audit log', adminOnly: true },
      { href: '/admin/account', label: 'My account' },
    ],
  },
];

function isActive(path: string, href: string) {
  return href === '/admin' ? path === '/admin' : path === href || path.startsWith(`${href}/`);
}

export default function AdminLayout() {
  const user = useAuth((s) => s.user);
  const path = usePathname();
  const { wide } = useLayout();
  const insets = useSafeAreaInsets();
  // The menu belongs to the page it was opened on, so navigating closes it.
  const [menuFor, setMenuFor] = useState<string | null>(null);
  const menuOpen = menuFor === path;
  const allowed = user?.role === 'admin' || user?.role === 'staff';
  const alerts = useQuery({ queryKey: ['admin', 'notifications'], queryFn: admin.notifications, enabled: allowed, refetchInterval: 60_000 });
  const dash = useQuery({ queryKey: ['admin', 'dashboard'], queryFn: admin.dashboard, enabled: allowed, refetchInterval: 60_000 });

  if (!user) return <Redirect href={{ pathname: '/login', params: { next: '/admin' } }} />;
  // The API enforces this too; the redirect just keeps customers out of screens they can't use.
  if (!allowed) return <Redirect href="/" />;

  const badges = { alerts: alerts.data?.unread ?? 0, new: dash.data?.awaiting_call ?? 0 };
  const groups = NAV.map((g) => ({ ...g, items: g.items.filter((i) => !i.adminOnly || user.role === 'admin') })).filter((g) => g.items.length);

  const nav = (
    <ScrollView contentContainerStyle={styles.nav}>
      {groups.map((g) => (
        <View key={g.group} style={styles.group}>
          <Text style={styles.groupName}>{g.group}</Text>
          {g.items.map((item) => {
            const on = isActive(path, item.href);
            const count = item.badge ? badges[item.badge] : 0;
            return (
              <Pressable
                key={item.href}
                accessibilityRole="link"
                accessibilityState={{ selected: on }}
                onPress={() => router.navigate(item.href as never)}
                style={({ hovered }: { hovered?: boolean }) => [styles.link, hovered && styles.linkHover, on && styles.linkOn]}>
                <Text style={[styles.linkText, on && styles.linkTextOn]}>{item.label}</Text>
                {count > 0 ? (
                  <View style={[styles.badge, on && styles.badgeOn]}>
                    <Text style={styles.badgeText}>{count > 99 ? '99+' : count}</Text>
                  </View>
                ) : null}
              </Pressable>
            );
          })}
        </View>
      ))}
      <View style={styles.footer}>
        <Pressable
          accessibilityRole="link"
          onPress={() => (Platform.OS === 'web' ? window.location.assign('/') : router.navigate('/'))}
          style={styles.footLink}>
          <Text style={styles.footText}>View the shop</Text>
        </Pressable>
        <Text style={styles.who} numberOfLines={1}>
          {user.email} · {user.role === 'admin' ? 'Admin' : 'Staff'}
        </Text>
      </View>
    </ScrollView>
  );

  if (wide) {
    return (
      <View style={styles.shell}>
        <View style={styles.sidebar}>
          <Text style={styles.brand}>RKR Crackers</Text>
          <Text style={styles.brandSub}>Shop admin</Text>
          {nav}
        </View>
        <View style={styles.main}>
          <Slot />
        </View>
      </View>
    );
  }

  return (
    <View style={[styles.shell, styles.shellNarrow, { paddingTop: insets.top }]}>
      <View style={styles.bar}>
        <Pressable accessibilityRole="button" onPress={() => setMenuFor(menuOpen ? null : path)} hitSlop={8} style={styles.menuBtn}>
          <Text style={styles.menuText}>{menuOpen ? 'Close' : 'Menu'}</Text>
          {!menuOpen && badges.alerts + badges.new > 0 ? <View style={styles.dot} /> : null}
        </Pressable>
        <Text style={styles.barTitle} numberOfLines={1}>
          RKR Crackers
        </Text>
        <Pressable accessibilityRole="link" onPress={() => router.navigate('/admin/notifications')} hitSlop={8} style={styles.bell}>
          <Text style={styles.bellText}>Alerts</Text>
          {badges.alerts > 0 ? (
            <View style={styles.badge}>
              <Text style={styles.badgeText}>{badges.alerts > 99 ? '99+' : badges.alerts}</Text>
            </View>
          ) : null}
        </Pressable>
      </View>
      <View style={styles.main}>
        <Slot />
        {menuOpen ? <View style={styles.overlay}>{nav}</View> : null}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  shell: { flex: 1, flexDirection: 'row', backgroundColor: tone.ground },
  shellNarrow: { flexDirection: 'column' },
  sidebar: { width: 256, backgroundColor: tone.well, paddingTop: 28 },
  brand: { color: tone.ink, fontFamily: fonts.display, fontSize: 30, paddingHorizontal: 24, letterSpacing: -0.5 },
  brandSub: { color: tone.gold, fontFamily: fonts.textSemi, fontSize: 15, paddingHorizontal: 24, marginTop: 2, marginBottom: 12 },
  nav: { paddingHorizontal: 12, paddingBottom: 24, gap: 18 },
  group: { gap: 2 },
  groupName: { color: tone.muted, fontFamily: fonts.textSemi, fontSize: 14, paddingHorizontal: 12, paddingVertical: 6 },
  link: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 12, paddingVertical: 10, borderRadius: 10 },
  linkHover: { backgroundColor: tone.panel },
  linkOn: { backgroundColor: tone.raised },
  linkText: { color: tone.soft, fontFamily: fonts.textSemi, fontSize: 16 },
  linkTextOn: { color: tone.ink },
  badge: { minWidth: 22, height: 22, borderRadius: 11, paddingHorizontal: 6, backgroundColor: tone.gold, alignItems: 'center', justifyContent: 'center' },
  badgeOn: { backgroundColor: tone.gold },
  badgeText: { color: colors.onPrimary, fontFamily: fonts.textBold, fontSize: 12, fontVariant: ['tabular-nums'] },
  footer: { gap: 8, paddingHorizontal: 12, paddingTop: 8 },
  footLink: { paddingVertical: 6 },
  footText: { color: tone.gold, fontFamily: fonts.textSemi, fontSize: 15 },
  who: { color: tone.muted, fontFamily: fonts.text, fontSize: 13 },
  main: { flex: 1 },
  bar: { height: 56, flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 16, backgroundColor: tone.well },
  menuBtn: { flexDirection: 'row', alignItems: 'center', gap: 6, minWidth: 56 },
  menuText: { color: tone.ink, fontFamily: fonts.textBold, fontSize: 15 },
  dot: { width: 8, height: 8, borderRadius: 4, backgroundColor: TONES.gold.fg },
  barTitle: { flex: 1, textAlign: 'center', color: tone.ink, fontFamily: fonts.display, fontSize: 22 },
  bell: { flexDirection: 'row', alignItems: 'center', gap: 6, minWidth: 56, justifyContent: 'flex-end' },
  bellText: { color: tone.soft, fontFamily: fonts.textSemi, fontSize: 15 },
  overlay: { ...StyleSheet.absoluteFill, backgroundColor: tone.well, paddingTop: 12 },
});
