import { useMutation } from '@tanstack/react-query';
import Constants from 'expo-constants';
import { router, Stack } from 'expo-router';
import { useState } from 'react';
import { Linking, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';

import { Button } from '@/components/button';
import { formatPhone } from '@/components/hero';
import { confirmNative, haptic, ListRow, ListSection, surface } from '@/components/native';
import { colors, type } from '@/components/theme';
import { request, type User } from '@/lib/api';
import { useShopSettings } from '@/lib/queries';
import { useAuth } from '@/store/auth';

export default function AccountScreen() {
  const user = useAuth((s) => s.user);
  const signOut = useAuth((s) => s.signOut);
  const { data: shop } = useShopSettings();
  const team = user && user.role !== 'customer';

  return (
    <ScrollView style={styles.flex} contentContainerStyle={styles.container} contentInsetAdjustmentBehavior="automatic">
      <Stack.Screen options={{ title: 'Account' }} />

      {user ? (
        <Profile user={user} />
      ) : (
        <View style={styles.guest}>
          <Text style={styles.guestTitle}>Log in to order</Text>
          <Text style={styles.guestText}>We email you a 6-digit code. No password to remember.</Text>
          <Button title="Log in with email" onPress={() => router.push('/login')} />
        </View>
      )}

      {team ? (
        <ListSection title="Shop">
          <ListRow title="Open the shop admin" tint onPress={() => router.push('/admin')} />
        </ListSection>
      ) : null}

      <ListSection title="Talk to us" footer={shop?.address || undefined}>
        {shop?.phone_primary ? <ListRow title="Call" value={formatPhone(shop.phone_primary)} onPress={() => Linking.openURL(`tel:${shop.phone_primary}`)} /> : null}
        {shop?.phone_secondary ? <ListRow title="Call" value={formatPhone(shop.phone_secondary)} onPress={() => Linking.openURL(`tel:${shop.phone_secondary}`)} /> : null}
        {shop?.whatsapp_number ? (
          <ListRow title="WhatsApp" value={formatPhone(shop.whatsapp_number)} onPress={() => Linking.openURL(`https://wa.me/91${shop.whatsapp_number}`)} />
        ) : null}
      </ListSection>

      <ListSection title="Good to know">
        <ListRow title="Safety guide" onPress={() => router.push('/safety')} />
        <ListRow title="Terms of sale" onPress={() => router.push('/terms')} />
        <ListRow title="Privacy" onPress={() => router.push('/privacy')} />
      </ListSection>

      {user ? (
        <ListSection>
          <ListRow
            title="Log out"
            destructive
            chevron={false}
            onPress={async () => {
              if (await confirmNative('Log out?', `You are logged in as ${user.email}.`, 'Log out')) signOut();
            }}
          />
        </ListSection>
      ) : null}

      <Text style={styles.version}>RKR Crackers {Constants.expoConfig?.version ?? ''}</Text>
    </ScrollView>
  );
}

/** Name and phone, edited in place; the email is the login and can't change here. */
function Profile({ user }: { user: User }) {
  const updateUser = useAuth((s) => s.updateUser);
  const [name, setName] = useState(user.first_name);
  const [phone, setPhone] = useState(user.phone);
  const save = useMutation({
    mutationFn: () =>
      request<User>('/me/', { method: 'PATCH', body: JSON.stringify({ first_name: name.trim(), phone: phone.trim() }) }),
    onSuccess: (saved) => {
      haptic.success();
      updateUser(saved);
    },
  });
  const dirty = name !== user.first_name || phone !== user.phone;

  return (
    <ListSection title="Your details" footer={save.error ? save.error.message : 'Used to fill in your delivery details.'}>
      <ListRow title={user.email} subtitle="Login email" />
      <Field label="Name" value={name} onValue={setName} textContentType="name" />
      <Field label="Mobile" value={phone} onValue={setPhone} keyboardType="phone-pad" textContentType="telephoneNumber" />
      {dirty ? <ListRow title={save.isPending ? 'Saving…' : 'Save changes'} tint chevron={false} onPress={() => save.mutate()} /> : null}
    </ListSection>
  );
}

function Field({ label, value, onValue, ...input }: { label: string; value: string; onValue: (v: string) => void } & React.ComponentProps<typeof TextInput>) {
  return (
    <View style={styles.field}>
      <Text style={styles.fieldLabel}>{label}</Text>
      <TextInput
        value={value}
        onChangeText={onValue}
        placeholder="Add"
        placeholderTextColor={surface.secondary}
        style={styles.fieldInput}
        accessibilityLabel={label}
        returnKeyType="done"
        {...input}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1, backgroundColor: colors.background },
  container: { padding: 16, gap: 28, paddingBottom: 48 },
  guest: { backgroundColor: surface.group, borderRadius: 16, padding: 20, gap: 10 },
  guestTitle: { fontFamily: 'Gambarino', fontSize: 28, color: colors.text },
  guestText: { ...type.regular, fontSize: 16, lineHeight: 22, color: surface.secondary, marginBottom: 6 },
  field: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, minHeight: 48, gap: 12 },
  fieldLabel: { ...type.regular, fontSize: 17, color: colors.text, width: 72 },
  fieldInput: { flex: 1, ...type.regular, fontSize: 17, color: colors.text, textAlign: 'right', paddingVertical: 12 },
  version: { ...type.regular, fontSize: 13, color: surface.secondary, textAlign: 'center' },
});
