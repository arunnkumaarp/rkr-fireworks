import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { Btn, Chips, confirm, ErrorText, Field, fieldErrors, FormRow, Note, Page, Sheet, Stat, StatGrid, Table, useLayout } from '@/components/admin/ui';
import { admin, type Expense } from '@/lib/admin-api';
import { formatDate, formatRupees, formatRupeesWhole, isoDate } from '@/lib/format';
import { EXPENSE_CATEGORIES } from '@/lib/status';

type Draft = { id?: number; spent_on: string; category: string; amount: string; description: string };

const monthStart = () => isoDate(new Date(new Date().getFullYear(), new Date().getMonth(), 1));

export default function ExpensesScreen() {
  const [category, setCategory] = useState('');
  const [from, setFrom] = useState(monthStart());
  const [to, setTo] = useState(isoDate());
  const [draft, setDraft] = useState<Draft | null>(null);
  const { medium } = useLayout();
  const ok = (d: string) => (/^\d{4}-\d{2}-\d{2}$/.test(d) ? d : '');
  const filters = { category, from: ok(from), to: ok(to) };
  const list = useQuery({ queryKey: ['admin', 'expenses', filters], queryFn: () => admin.expenses(filters) });
  const queryClient = useQueryClient();
  const refresh = () => {
    for (const k of ['expenses', 'dashboard', 'report']) queryClient.invalidateQueries({ queryKey: ['admin', k] });
  };
  const save = useMutation({
    mutationFn: (d: Draft) => admin.saveExpense({ ...d, amount: Number(d.amount).toFixed(2) }),
    onSuccess: () => {
      refresh();
      setDraft(null);
    },
  });
  const remove = useMutation({
    mutationFn: admin.deleteExpense,
    onSuccess: () => {
      refresh();
      setDraft(null);
    },
  });
  const errors = fieldErrors(save.error);
  const rows = list.data ?? [];
  const total = rows.reduce((s, e) => s + Number(e.amount), 0);
  const byCategory = EXPENSE_CATEGORIES.map((c) => ({ ...c, sum: rows.filter((e) => e.category === c.value).reduce((s, e) => s + Number(e.amount), 0) }))
    .filter((c) => c.sum > 0)
    .sort((a, b) => b.sum - a.sum);
  const edit = (e: Expense) => setDraft({ id: e.id, spent_on: e.spent_on, category: e.category, amount: e.amount, description: e.description });

  return (
    <Page
      title="Expenses"
      lead="What the shop spends. Profit in the reports is money received minus these, so enter stock purchases here too."
      actions={<Btn kind="primary" title="Add expense" onPress={() => setDraft({ spent_on: isoDate(), category: 'stock', amount: '', description: '' })} />}
      refreshing={list.isRefetching}
      onRefresh={() => void list.refetch()}>
      <View style={[styles.row, medium && styles.rowWide]}>
        <View style={styles.dates}>
          <Field label="From" value={from} onChangeText={setFrom} style={styles.date} />
          <Field label="To" value={to} onChangeText={setTo} style={styles.date} />
        </View>
      </View>
      <Chips options={[{ value: '', label: 'Every category' }, ...EXPENSE_CATEGORIES]} value={category} onChange={setCategory} />
      <StatGrid>
        <Stat big label="Spent in this period" value={formatRupeesWhole(total)} note={`${rows.length} entries`} />
        {byCategory.slice(0, 3).map((c) => (
          <Stat key={c.value} label={c.label} value={formatRupeesWhole(c.sum)} onPress={() => setCategory(c.value)} />
        ))}
      </StatGrid>
      <ErrorText error={list.error ?? remove.error} />
      <Table
        rows={list.data}
        loading={list.isPending}
        keyOf={(e) => e.id}
        onRowPress={edit}
        empty="No expenses in this period."
        columns={[
          { key: 'd', label: 'Date', render: (e) => formatDate(e.spent_on) },
          { key: 'c', label: 'Category', flex: 1.3, render: (e) => e.category_label },
          { key: 'x', label: 'Description', flex: 2, render: (e) => e.description || '—', hideOnPhone: true },
          { key: 'b', label: 'Entered by', flex: 1.4, render: (e) => e.recorded_by || '—', hideOnPhone: true },
          { key: 'a', label: 'Amount', align: 'right', render: (e) => formatRupees(e.amount) },
        ]}
      />
      <Sheet visible={!!draft} title={draft?.id ? 'Edit expense' : 'Add expense'} onClose={() => setDraft(null)}>
        {draft ? (
          <>
            <Chips wrap options={EXPENSE_CATEGORIES} value={draft.category} onChange={(category) => setDraft({ ...draft, category })} />
            <FormRow>
              <Field label="Amount (₹)" value={draft.amount} onChangeText={(t) => setDraft({ ...draft, amount: t.replace(/[^\d.]/g, '') })} keyboardType="decimal-pad" error={errors.amount} />
              <Field label="Date" value={draft.spent_on} onChangeText={(spent_on) => setDraft({ ...draft, spent_on })} error={errors.spent_on} />
            </FormRow>
            <Field label="Description" value={draft.description} onChangeText={(description) => setDraft({ ...draft, description })} placeholder="Supplier, bill number, what for" />
            <Note>Every change is recorded in the audit log.</Note>
            <ErrorText error={save.error && !errors.amount && !errors.spent_on ? save.error : null} />
            <View style={styles.actions}>
              {draft.id ? (
                <Btn
                  kind="danger"
                  title="Delete"
                  loading={remove.isPending}
                  onPress={async () => {
                    if (await confirm('Delete this expense?')) remove.mutate(draft.id!);
                  }}
                />
              ) : null}
              <View style={styles.spacer} />
              <Btn kind="primary" title="Save" disabled={!Number(draft.amount)} loading={save.isPending} onPress={() => save.mutate(draft)} />
            </View>
          </>
        ) : null}
      </Sheet>
    </Page>
  );
}

const styles = StyleSheet.create({
  row: { gap: 12 },
  rowWide: { flexDirection: 'row', alignItems: 'flex-end' },
  dates: { flexDirection: 'row', gap: 12 },
  date: { flexBasis: 150, flexGrow: 0, minWidth: 130 },
  actions: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  spacer: { flex: 1 },
});
