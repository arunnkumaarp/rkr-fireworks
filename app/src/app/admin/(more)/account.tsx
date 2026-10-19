import { useMutation } from '@tanstack/react-query';
import { router } from 'expo-router';
import { useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { Btn, ErrorText, Field, fieldErrors, FormRow, Line, Note, Page, Panel, Section } from '@/components/admin/ui';
import { admin } from '@/lib/admin-api';
import { useAuth } from '@/store/auth';

export default function AccountScreen() {
  const user = useAuth((s) => s.user);
  const updateUser = useAuth((s) => s.updateUser);
  const signOut = useAuth((s) => s.signOut);
  const [name, setName] = useState(user?.first_name ?? '');
  const [phone, setPhone] = useState(user?.phone ?? '');
  const save = useMutation({ mutationFn: admin.updateMe, onSuccess: (saved) => updateUser(saved) });
  const errors = fieldErrors(save.error);
  if (!user) return null;
  const dirty = name !== user.first_name || phone !== user.phone;

  return (
    <Page title="My account" lead="Your own details. To change who has access, an admin uses Settings & team.">
      <Section title="Details">
        <Panel>
          <Line label="Email (used to log in)" value={user.email} />
          <Line label="Access" value={user.role === 'admin' ? 'Admin: everything' : 'Staff: orders, dispatch, products, stock, customers'} />
          <FormRow>
            <Field label="Name" value={name} onChangeText={setName} error={errors.first_name} />
            <Field label="Phone" value={phone} onChangeText={setPhone} keyboardType="phone-pad" error={errors.phone} />
          </FormRow>
          <ErrorText error={save.error && !Object.keys(errors).length ? save.error : null} />
          <View style={styles.right}>
            <Btn kind="primary" title={dirty ? 'Save' : save.isSuccess ? 'Saved' : 'No changes'} disabled={!dirty} loading={save.isPending} onPress={() => save.mutate({ first_name: name.trim(), phone: phone.trim() })} />
          </View>
        </Panel>
      </Section>
      <Section title="Security">
        <Note>
          You log in with a one-time code sent to your email; it expires after 10 minutes. On a shared computer, log out when you finish. Every change you make is kept in
          the audit log.
        </Note>
        <View style={styles.left}>
          <Btn
            kind="danger"
            title="Log out"
            onPress={() => {
              signOut();
              router.replace('/login');
            }}
          />
        </View>
      </Section>
    </Page>
  );
}

const styles = StyleSheet.create({ right: { alignItems: 'flex-end' }, left: { alignItems: 'flex-start' } });
