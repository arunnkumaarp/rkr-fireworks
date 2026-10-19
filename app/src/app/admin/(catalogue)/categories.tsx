import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';

import { Btn, confirm, ErrorText, Field, fieldErrors, FormRow, Note, Page, Pill, Sheet, Table, Toggle } from '@/components/admin/ui';
import { admin, type AdminCategory } from '@/lib/admin-api';

type Draft = { id?: number; name: string; sort_order: string; is_active: boolean };

export default function CategoriesScreen() {
  const list = useQuery({ queryKey: ['admin', 'categories'], queryFn: admin.categories });
  const [draft, setDraft] = useState<Draft | null>(null);
  const queryClient = useQueryClient();
  const refresh = () => {
    for (const k of [['admin', 'categories'], ['admin', 'products'], ['categories'], ['products']]) queryClient.invalidateQueries({ queryKey: k });
  };
  const save = useMutation({
    mutationFn: (d: Draft) => {
      const body = { name: d.name.trim(), sort_order: Number(d.sort_order || 0), is_active: d.is_active };
      return d.id ? admin.updateCategory(d.id, body) : admin.createCategory(body);
    },
    onSuccess: () => {
      refresh();
      setDraft(null);
    },
  });
  const remove = useMutation({ mutationFn: admin.deleteCategory, onSuccess: refresh });
  const errors = fieldErrors(save.error);
  const edit = (c: AdminCategory) => setDraft({ id: c.id, name: c.name, sort_order: String(c.sort_order), is_active: c.is_active });

  return (
    <Page
      title="Categories"
      lead="The groups on the price list, in the order shown. Switching a category off hides all its products."
      actions={<Btn kind="primary" title="Add category" onPress={() => setDraft({ name: '', sort_order: String((list.data?.length ?? 0) + 1), is_active: true })} />}>
      <ErrorText error={remove.error ?? list.error} />
      <Table
        rows={list.data}
        loading={list.isPending}
        keyOf={(c) => c.id}
        onRowPress={edit}
        columns={[
          { key: 'n', label: 'Category', flex: 2, render: (c) => c.name },
          { key: 'o', label: 'Order', align: 'right', render: (c) => String(c.sort_order) },
          { key: 'p', label: 'Products', align: 'right', render: (c) => String(c.product_count) },
          { key: 's', label: 'Shown', render: (c) => <Pill label={c.is_active ? 'Shown' : 'Hidden'} tone={c.is_active ? 'green' : 'neutral'} /> },
          {
            key: 'd',
            label: '',
            align: 'right',
            hideOnPhone: true,
            render: (c) =>
              c.product_count === 0 ? (
                <Btn small kind="danger" title="Delete" onPress={async () => { if (await confirm(`Delete the empty category ${c.name}?`)) remove.mutate(c.id); }} />
              ) : (
                ''
              ),
          },
        ]}
      />
      <Sheet visible={!!draft} title={draft?.id ? 'Edit category' : 'Add category'} onClose={() => setDraft(null)}>
        {draft ? (
          <>
            <FormRow>
              <Field label="Name" value={draft.name} onChangeText={(name) => setDraft({ ...draft, name })} error={errors.name} />
              <Field label="Position" value={draft.sort_order} onChangeText={(v) => setDraft({ ...draft, sort_order: v.replace(/\D/g, '') })} keyboardType="number-pad" />
            </FormRow>
            <Toggle label={draft.is_active ? 'Shown to customers' : 'Hidden from customers'} value={draft.is_active} onChange={(is_active) => setDraft({ ...draft, is_active })} />
            <Note>The website’s printed list is built from the price-list file; new categories appear in the shop app at once.</Note>
            <ErrorText error={save.error && !errors.name ? save.error : null} />
            <Btn kind="primary" title="Save" disabled={!draft.name.trim()} loading={save.isPending} onPress={() => save.mutate(draft)} />
          </>
        ) : null}
      </Sheet>
    </Page>
  );
}
