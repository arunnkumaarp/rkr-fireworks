import { Slot } from 'expo-router';
import { NativeTabs } from 'expo-router/native-tabs';

import { isNative } from '@/components/native';
import { colors } from '@/components/theme';
import { cartTotals, useCart } from '@/store/cart';

// Open on the price list, not the first group alphabetically.
export const unstable_settings = { anchor: '(shop)' };

/** The app's four tabs: the system tab bar on iOS, Material bottom navigation on Android. */
export default function TabsLayout() {
  const lines = useCart((s) => s.lines);
  if (!isNative) return <Slot />;
  const count = cartTotals(lines).products;

  return (
    <NativeTabs
      tintColor={colors.gold}
      iconColor={colors.muted}
      indicatorColor="#3A2E14"
      rippleColor="rgba(242,181,68,0.16)"
      labelVisibilityMode="labeled"
      badgeBackgroundColor={colors.gold}
      badgeTextColor={colors.onPrimary}
      backgroundColor={colors.background}
      labelStyle={{ color: colors.muted }}
      disableTransparentOnScrollEdge>
      <NativeTabs.Trigger name="(shop)">
        <NativeTabs.Trigger.Icon sf={{ default: 'flame', selected: 'flame.fill' }} md="local_fire_department" />
        <NativeTabs.Trigger.Label>Shop</NativeTabs.Trigger.Label>
      </NativeTabs.Trigger>
      <NativeTabs.Trigger name="(cart)">
        <NativeTabs.Trigger.Icon sf={{ default: 'cart', selected: 'cart.fill' }} md="shopping_cart" />
        <NativeTabs.Trigger.Label>Cart</NativeTabs.Trigger.Label>
        {count > 0 ? <NativeTabs.Trigger.Badge>{String(count)}</NativeTabs.Trigger.Badge> : null}
      </NativeTabs.Trigger>
      <NativeTabs.Trigger name="(orders)">
        <NativeTabs.Trigger.Icon sf={{ default: 'shippingbox', selected: 'shippingbox.fill' }} md="receipt_long" />
        <NativeTabs.Trigger.Label>Orders</NativeTabs.Trigger.Label>
      </NativeTabs.Trigger>
      <NativeTabs.Trigger name="(account)">
        <NativeTabs.Trigger.Icon sf={{ default: 'person.crop.circle', selected: 'person.crop.circle.fill' }} md="account_circle" />
        <NativeTabs.Trigger.Label>Account</NativeTabs.Trigger.Label>
      </NativeTabs.Trigger>
    </NativeTabs>
  );
}
