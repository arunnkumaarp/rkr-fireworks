import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { Btn, Chips, Columns, confirm, ErrorText, Field, fieldErrors, FormRow, Loading, Note, Page, Panel, Pill, Section, Table } from '@/components/admin/ui';
import { admin } from '@/lib/admin-api';
import { API_URL, type ShopSettings } from '@/lib/api';
import { formatDateTime } from '@/lib/format';
import { useAuth } from '@/store/auth';

const FIELDS = [
  'shop_name', 'phone_primary', 'phone_secondary', 'whatsapp_number', 'email', 'address', 'announcement',
  'min_order_value', 'packing_charge_percent', 'upi_id', 'bank_details',
] as const;
type Form = Record<(typeof FIELDS)[number], string>;

export default function SettingsScreen() {
  const settings = useQuery({ queryKey: ['admin', 'settings'], queryFn: admin.settings });
  const [form, setForm] = useState<Form | null>(null);
  const [formOf, setFormOf] = useState<ShopSettings | undefined>();
  if (settings.data && settings.data !== formOf) {
    setFormOf(settings.data);
    setForm(Object.fromEntries(FIELDS.map((f) => [f, String(settings.data[f] ?? '')])) as Form);
  }
  const queryClient = useQueryClient();
  const save = useMutation({
    mutationFn: (patch: Partial<Form>) => admin.updateSettings(patch as Partial<ShopSettings>),
    onSuccess: (saved) => {
      queryClient.setQueryData(['admin', 'settings'], saved);
      queryClient.invalidateQueries({ queryKey: ['settings'] }); // the customer side
    },
  });
  const errors = fieldErrors(save.error);

  if (!form || !settings.data) {
    return <Page title="Settings & team">{settings.isError ? <ErrorText error={settings.error} /> : <Loading />}</Page>;
  }
  const s = settings.data;
  const patch = Object.fromEntries(FIELDS.filter((f) => form[f] !== String(s[f] ?? '')).map((f) => [f, form[f]]));
  const dirty = Object.keys(patch).length > 0;
  const set = (k: keyof Form) => (v: string) => setForm({ ...form, [k]: v });
  const adminSite = API_URL.replace(/\/api\/v1\/?$/, '/django-admin/content/shopsettings/1/change/');

  return (
    <Page title="Settings & team" lead="Business details shown to customers, order rules, payment details, and who can use this admin.">
      <Columns min={1000} gap={28}>
        <View style={styles.col}>
          <Section title="Business">
            <Panel>
              <Field label="Shop name" value={form.shop_name} onChangeText={set('shop_name')} error={errors.shop_name} />
              <FormRow>
                <Field label="Phone" value={form.phone_primary} onChangeText={set('phone_primary')} keyboardType="phone-pad" />
                <Field label="Second phone" value={form.phone_secondary} onChangeText={set('phone_secondary')} keyboardType="phone-pad" />
                <Field label="WhatsApp" value={form.whatsapp_number} onChangeText={set('whatsapp_number')} keyboardType="phone-pad" />
              </FormRow>
              <Field label="Email" value={form.email} onChangeText={set('email')} keyboardType="email-address" autoCapitalize="none" error={errors.email} />
              <Field label="Address" value={form.address} onChangeText={set('address')} multiline />
              <Field label="Announcement banner" value={form.announcement} onChangeText={set('announcement')} hint="Shown at the top of the shop" />
            </Panel>
          </Section>
        </View>
        <View style={styles.col}>
          <Section title="Orders and payment">
            <Panel>
              <FormRow>
                <Field label="Minimum order (₹)" value={form.min_order_value} onChangeText={set('min_order_value')} keyboardType="decimal-pad" error={errors.min_order_value} />
                <Field label="Packing charge %" value={form.packing_charge_percent} onChangeText={set('packing_charge_percent')} keyboardType="decimal-pad" error={errors.packing_charge_percent} />
              </FormRow>
              <Field label="UPI ID" value={form.upi_id} onChangeText={set('upi_id')} autoCapitalize="none" />
              <Field label="Bank details" value={form.bank_details} onChangeText={set('bank_details')} multiline />
              <Note>
                UPI QR image: {s.upi_qr ? 'uploaded' : 'not uploaded'}. Upload or change it in Django admin at {adminSite}
              </Note>
            </Panel>
          </Section>
          <View style={styles.saveRow}>
            <ErrorText error={save.error && !Object.keys(errors).length ? save.error : null} />
            <Btn kind="primary" title={dirty ? 'Save settings' : save.isSuccess ? 'Saved' : 'No changes'} disabled={!dirty} loading={save.isPending} onPress={() => save.mutate(patch)} />
          </View>
        </View>
      </Columns>
      <Team />
    </Page>
  );
}

function Team() {
  const me = useAuth((s) => s.user);
  const team = useQuery({ queryKey: ['admin', 'team'], queryFn: admin.team });
  const [email, setEmail] = useState('');
  const [name, setName] = useState('');
  const [role, setRole] = useState('staff');
  const queryClient = useQueryClient();
  const refresh = () => queryClient.invalidateQueries({ queryKey: ['admin', 'team'] });
  const add = useMutation({ mutationFn: admin.addMember, onSuccess: () => { refresh(); setEmail(''); setName(''); } });
  const change = useMutation({ mutationFn: ({ id, role }: { id: number; role: string }) => admin.setRole(id, role), onSuccess: refresh });
  const remove = useMutation({ mutationFn: admin.removeMember, onSuccess: refresh });
  const errors = fieldErrors(add.error);

  return (
    <Section title="Team and access">
      <Note>
        Admins can do everything, including money, reports, offers, settings and the team. Staff handle orders, dispatch, products, stock and customers. Everyone logs in
        with an emailed code; there are no passwords to share.
      </Note>
      <ErrorText error={change.error ?? remove.error ?? team.error} />
      <Table
        rows={team.data}
        loading={team.isPending}
        keyOf={(m) => m.id}
        columns={[
          { key: 'e', label: 'Person', flex: 2, render: (m) => `${m.first_name ? `${m.first_name} · ` : ''}${m.email}` },
          { key: 'r', label: 'Access', render: (m) => <Pill label={m.is_owner ? 'Owner' : m.role === 'admin' ? 'Admin' : 'Staff'} tone={m.role === 'admin' ? 'gold' : 'blue'} /> },
          { key: 'l', label: 'Last login', flex: 1.3, render: (m) => formatDateTime(m.last_login), hideOnPhone: true },
          {
            key: 'a',
            label: '',
            flex: 1.8,
            align: 'right',
            render: (m) =>
              m.is_owner || m.id === me?.id ? (
                m.id === me?.id ? 'You' : ''
              ) : (
                <View style={styles.rowActions}>
                  <Btn small title={m.role === 'admin' ? 'Make staff' : 'Make admin'} onPress={() => change.mutate({ id: m.id, role: m.role === 'admin' ? 'staff' : 'admin' })} />
                  <Btn small kind="danger" title="Remove" onPress={async () => { if (await confirm(`Remove ${m.email} from the team? They keep a customer account.`)) remove.mutate(m.id); }} />
                </View>
              ),
          },
        ]}
      />
      <Panel>
        <FormRow>
          <Field label="Email" value={email} onChangeText={setEmail} keyboardType="email-address" autoCapitalize="none" error={errors.email ?? errors.detail} />
          <Field label="Name (optional)" value={name} onChangeText={setName} />
        </FormRow>
        <Chips wrap options={[{ value: 'staff', label: 'Staff' }, { value: 'admin', label: 'Admin' }]} value={role} onChange={setRole} />
        <View style={styles.saveRow}>
          <Btn kind="primary" title="Give access" disabled={!email.includes('@')} loading={add.isPending} onPress={() => add.mutate({ email: email.trim(), role, first_name: name.trim() })} />
        </View>
      </Panel>
    </Section>
  );
}

const styles = StyleSheet.create({
  col: { flex: 1, gap: 28 },
  saveRow: { alignItems: 'flex-end', gap: 8 },
  rowActions: { flexDirection: 'row', gap: 8, flexWrap: 'wrap', justifyContent: 'flex-end' },
});
