import { zodResolver } from '@hookform/resolvers/zod';
import clsx from 'clsx';
import { Banknote, Check, CreditCard, Landmark, LineChart, PiggyBank, Plus, Trash2, Wallet } from 'lucide-react';
import { useState } from 'react';
import { Controller, useForm } from 'react-hook-form';
import { accountSchema, AccountInput, budgetSchema, BudgetInput, categorySchema, CategoryInput } from '@financeflow/shared';
import { currentMonth, formatMoney } from '@/lib/format';
import {
  useAccounts, useBudgets, useCategories, useDeleteAccount, useDeleteBudget, useDeleteCategory, useSaveAccount, useSaveBudget, useSaveCategory,
} from '@/features/hooks';
import { Button, IconButton } from '../atoms/Button';
import { Input, Select } from '../atoms/Input';
import { Money } from '../atoms/Money';
import { Segmented } from '../atoms/Segmented';
import { Skeleton } from '../atoms/Skeleton';
import { Card, ColorDot, SectionTitle } from '../atoms/Typography';
import { confirmDialog } from '../molecules/ConfirmHost';
import { EmptyState } from '../molecules/EmptyState';
import { FormField } from '../molecules/FormField';
import { Modal } from '../molecules/Modal';
import { MonthSwitcher } from '../molecules/MonthSwitcher';
import { PageHeader } from '../molecules/PageHeader';
import { BudgetList } from '../organisms/BudgetList';

const TYPES = {
  CHECKING: { label: 'Conta corrente', icon: Landmark },
  CREDIT_CARD: { label: 'Cartão de crédito', icon: CreditCard },
  CASH: { label: 'Dinheiro', icon: Banknote },
  INVESTMENT: { label: 'Investimento', icon: LineChart },
} as const;

export function AccountsPage() {
  const { data = [], isLoading } = useAccounts();
  const save = useSaveAccount();
  const del = useDeleteAccount();
  const [open, setOpen] = useState(false);
  const { register, handleSubmit, reset, formState: { errors } } = useForm<AccountInput>({
    resolver: zodResolver(accountSchema) as never, defaultValues: { type: 'CHECKING', initialBalance: 0 },
  });
  const total = data.reduce((s, a) => s + a.balance, 0);

  return (
    <>
      <PageHeader
        title="Contas" subtitle={data.length ? `Saldo somado: ${formatMoney(total)}` : 'Cadastre suas contas e cartões.'}
        actions={<Button onClick={() => setOpen(true)}><Plus className="h-4 w-4" />Nova conta</Button>}
      />
      {isLoading ? (
        <div className="grid gap-4 xl:grid-cols-2">{[0, 1].map((i) => <Skeleton key={i} className="h-28 w-full !rounded-2xl" />)}</div>
      ) : data.length === 0 ? (
        <EmptyState icon={<Wallet className="h-6 w-6" />} title="Nenhuma conta ainda" description="Crie uma conta para registrar transações." />
      ) : (
        <div className="grid gap-4 xl:grid-cols-2">
          {data.map((a) => {
            const T = TYPES[a.type];
            return (
              <Card key={a.id} className="group flex items-center gap-4 transition-shadow hover:shadow-pop">
                <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-brand-400 to-brand-700 text-white"><T.icon className="h-6 w-6" /></span>
                <div className="min-w-0 flex-1">
                  <p className="truncate font-semibold">{a.name}</p>
                  <p className="text-xs text-slate-500">{T.label}</p>
                </div>
                <div className="text-right">
                  <p className="text-xs text-slate-500">Saldo</p>
                  <p className="text-lg font-bold"><Money value={a.balance} /></p>
                </div>
                <IconButton
                  label={`Excluir ${a.name}`} className="opacity-0 group-hover:opacity-100 focus:opacity-100"
                  onClick={async () => (await confirmDialog({ title: 'Excluir conta', message: `Excluir “${a.name}” e todas as suas transações? Não dá para desfazer.`, confirmLabel: 'Excluir' })) && del.mutate(a.id)}
                ><Trash2 className="h-4 w-4" /></IconButton>
              </Card>
            );
          })}
        </div>
      )}
      <Modal open={open} title="Nova conta" onClose={() => setOpen(false)}>
        <form className="space-y-4" noValidate onSubmit={handleSubmit((v) => save.mutate(v, { onSuccess: () => { reset(); setOpen(false); } }))}>
          <FormField label="Nome" error={errors.name?.message}><Input placeholder="Ex.: Nubank" autoFocus {...register('name')} /></FormField>
          <FormField label="Tipo"><Select {...register('type')}>{Object.entries(TYPES).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}</Select></FormField>
          <FormField label="Saldo inicial (R$)"><Input type="number" step="0.01" {...register('initialBalance')} /></FormField>
          <div className="flex justify-end gap-2"><Button type="button" variant="secondary" onClick={() => setOpen(false)}>Cancelar</Button><Button type="submit" loading={save.isPending}>Salvar</Button></div>
        </form>
      </Modal>
    </>
  );
}

const SWATCHES = ['#f97316', '#ef4444', '#ec4899', '#a855f7', '#6366f1', '#0ea5e9', '#14b8a6', '#22c55e', '#eab308', '#64748b'];

export function CategoriesPage() {
  const { data = [], isLoading } = useCategories();
  const save = useSaveCategory();
  const del = useDeleteCategory();
  const [open, setOpen] = useState(false);
  const { register, handleSubmit, reset, control, formState: { errors } } = useForm<CategoryInput>({
    resolver: zodResolver(categorySchema) as never, defaultValues: { kind: 'EXPENSE', color: SWATCHES[4] },
  });
  const group = (kind: string, title: string) => (
    <Card>
      <SectionTitle>{title}</SectionTitle>
      {isLoading ? <Skeleton className="h-32 w-full" /> : (
        <ul className="divide-y divide-slate-100 dark:divide-slate-800">
          {data.filter((c) => c.kind === kind).map((c) => (
            <li key={c.id} className="group flex items-center justify-between py-2.5 text-sm">
              <span className="flex items-center gap-3"><span className="flex h-8 w-8 items-center justify-center rounded-lg" style={{ backgroundColor: `${c.color}22` }}><ColorDot color={c.color} className="!h-3 !w-3" /></span>{c.name}</span>
              <IconButton
                label={`Excluir ${c.name}`} className="opacity-0 group-hover:opacity-100 focus:opacity-100"
                onClick={async () => (await confirmDialog({ title: 'Excluir categoria', message: `Excluir “${c.name}”? As transações ficam sem categoria.`, confirmLabel: 'Excluir' })) && del.mutate(c.id)}
              ><Trash2 className="h-4 w-4" /></IconButton>
            </li>
          ))}
        </ul>
      )}
    </Card>
  );
  return (
    <>
      <PageHeader title="Categorias" subtitle="Organize seus gastos e receitas." actions={<Button onClick={() => setOpen(true)}><Plus className="h-4 w-4" />Nova categoria</Button>} />
      <div className="grid gap-4 md:grid-cols-2">{group('EXPENSE', 'Despesas')}{group('INCOME', 'Receitas')}</div>
      <Modal open={open} title="Nova categoria" onClose={() => setOpen(false)}>
        <form className="space-y-5" noValidate onSubmit={handleSubmit((v) => save.mutate(v, { onSuccess: () => { reset(); setOpen(false); } }))}>
          <FormField label="Nome" error={errors.name?.message}><Input autoFocus {...register('name')} /></FormField>
          <Controller control={control} name="kind" render={({ field }) => (
            <Segmented label="Tipo" className="w-full" value={field.value} onChange={field.onChange}
              options={[{ value: 'EXPENSE', label: 'Despesa', tone: 'expense' }, { value: 'INCOME', label: 'Receita', tone: 'income' }]} />
          )} />
          <Controller control={control} name="color" render={({ field }) => (
            <fieldset>
              <legend className="mb-2 text-sm font-medium">Cor</legend>
              <div className="flex flex-wrap gap-2">
                {SWATCHES.map((c) => (
                  <button key={c} type="button" aria-label={`Cor ${c}`} aria-pressed={field.value === c} onClick={() => field.onChange(c)}
                    className={clsx('flex h-8 w-8 items-center justify-center rounded-full transition-transform hover:scale-110', field.value === c && 'ring-2 ring-offset-2 ring-slate-400')}
                    style={{ backgroundColor: c }}>
                    {field.value === c && <Check className="h-4 w-4 text-white" />}
                  </button>
                ))}
              </div>
            </fieldset>
          )} />
          <div className="flex justify-end gap-2"><Button type="button" variant="secondary" onClick={() => setOpen(false)}>Cancelar</Button><Button type="submit" loading={save.isPending}>Salvar</Button></div>
        </form>
      </Modal>
    </>
  );
}

export function BudgetsPage() {
  const [month, setMonth] = useState(currentMonth());
  const { data = [], isLoading } = useBudgets(month);
  const { data: categories = [] } = useCategories();
  const save = useSaveBudget();
  const del = useDeleteBudget();
  const { register, handleSubmit, reset, formState: { errors } } = useForm<BudgetInput>({ resolver: zodResolver(budgetSchema) as never });
  const total = data.reduce((s, b) => s + b.amount, 0);
  const spent = data.reduce((s, b) => s + b.spent, 0);
  return (
    <>
      <PageHeader title="Orçamentos" subtitle={data.length ? `${formatMoney(spent)} gastos de ${formatMoney(total)} orçados` : 'Defina limites mensais por categoria.'} actions={<MonthSwitcher value={month} onChange={setMonth} />} />
      <Card>
        <SectionTitle>Definir limite</SectionTitle>
        <form className="grid items-end gap-3 sm:grid-cols-[1fr_12rem_auto]" noValidate onSubmit={handleSubmit((v) => save.mutate({ ...v, month }, { onSuccess: () => reset() }))}>
          <FormField label="Categoria" error={errors.categoryId?.message}>
            <Select {...register('categoryId')}><option value="">Selecione…</option>{categories.filter((c) => c.kind === 'EXPENSE').map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}</Select>
          </FormField>
          <FormField label="Limite (R$)" error={errors.amount?.message}><Input type="number" step="0.01" placeholder="0,00" {...register('amount')} /></FormField>
          <Button type="submit" loading={save.isPending}><PiggyBank className="h-4 w-4" />Definir</Button>
        </form>
      </Card>
      {isLoading ? <Skeleton className="h-32 w-full !rounded-2xl" /> : <BudgetList budgets={data} onDelete={(id) => del.mutate(id)} />}
    </>
  );
}

export function NotFoundPage() {
  return <EmptyState title="Página não encontrada" description="O endereço que você acessou não existe." />;
}
