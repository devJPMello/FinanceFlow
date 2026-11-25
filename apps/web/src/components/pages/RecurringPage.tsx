import { zodResolver } from '@hookform/resolvers/zod';
import { CalendarClock, Pause, Pencil, Play, Plus, Repeat, Trash2 } from 'lucide-react';
import { useState } from 'react';
import { Controller, useForm } from 'react-hook-form';
import { recurringSchema, RecurringInput } from '@financeflow/shared';
import { formatDate } from '@/lib/format';
import { useAccounts, useCategories, useDeleteRecurring, useRecurring, useSaveRecurring, useToggleRecurring } from '@/features/hooks';
import type { RecurringRule } from '@/features/types';
import { Button, IconButton } from '../atoms/Button';
import { Input, Select } from '../atoms/Input';
import { Money } from '../atoms/Money';
import { Segmented } from '../atoms/Segmented';
import { Skeleton } from '../atoms/Skeleton';
import { Card } from '../atoms/Typography';
import { confirmDialog } from '../molecules/ConfirmHost';
import { EmptyState } from '../molecules/EmptyState';
import { FormField } from '../molecules/FormField';
import { Modal } from '../molecules/Modal';
import { PageHeader } from '../molecules/PageHeader';

const FREQ = { WEEKLY: 'Toda semana', MONTHLY: 'Todo mês', YEARLY: 'Todo ano' } as const;
const today = () => new Date().toISOString().slice(0, 10);

function RecurringForm({ rule, onDone }: { rule: RecurringRule | null; onDone: () => void }) {
  const { data: accounts = [] } = useAccounts();
  const { data: categories = [] } = useCategories();
  const save = useSaveRecurring();
  const { register, handleSubmit, control, watch, setValue, formState: { errors } } = useForm<RecurringInput>({
    resolver: zodResolver(recurringSchema) as never,
    defaultValues: rule
      ? {
          accountId: rule.accountId, categoryId: rule.categoryId ?? '', type: rule.type, amount: rule.amount, description: rule.description,
          frequency: rule.frequency, startDate: rule.startDate.slice(0, 10), endDate: rule.endDate?.slice(0, 10) ?? '',
        }
      : { type: 'EXPENSE', frequency: 'MONTHLY', startDate: today(), accountId: accounts[0]?.id ?? '', categoryId: '', endDate: '' },
  });
  const type = watch('type');

  return (
    <form className="space-y-5" noValidate onSubmit={handleSubmit((v) => save.mutate({ ...v, endDate: v.endDate || null, id: rule?.id }, { onSuccess: onDone }))}>
      <Controller control={control} name="type" render={({ field }) => (
        <Segmented label="Tipo" className="w-full" value={field.value} onChange={(v) => { field.onChange(v); setValue('categoryId', ''); }}
          options={[{ value: 'EXPENSE', label: 'Despesa', tone: 'expense' }, { value: 'INCOME', label: 'Receita', tone: 'income' }]} />
      )} />
      <FormField label="Descrição" error={errors.description?.message}><Input placeholder="Ex.: Aluguel, Netflix, Salário" autoFocus {...register('description')} /></FormField>
      <div className="grid gap-3 sm:grid-cols-2">
        <FormField label="Valor (R$)" error={errors.amount?.message}><Input type="number" step="0.01" min="0" placeholder="0,00" {...register('amount')} /></FormField>
        <FormField label="Frequência"><Select {...register('frequency')}>{Object.entries(FREQ).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</Select></FormField>
      </div>
      <div className="grid gap-3 sm:grid-cols-2">
        <FormField label="Começa em" error={errors.startDate?.message}><Input type="date" {...register('startDate')} /></FormField>
        <FormField label="Termina em (opcional)"><Input type="date" {...register('endDate')} /></FormField>
      </div>
      <div className="grid gap-3 sm:grid-cols-2">
        <FormField label="Conta" error={errors.accountId?.message}>
          <Select {...register('accountId')}><option value="">Selecione…</option>{accounts.map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}</Select>
        </FormField>
        <FormField label="Categoria">
          <Select {...register('categoryId')}><option value="">Sem categoria</option>{categories.filter((c) => c.kind === type).map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}</Select>
        </FormField>
      </div>
      <p className="text-xs text-slate-500">As transações são lançadas automaticamente a cada vencimento. Se a data de início já passou, os lançamentos atrasados são criados agora.</p>
      <div className="flex justify-end gap-2"><Button type="button" variant="secondary" onClick={onDone}>Cancelar</Button><Button type="submit" loading={save.isPending}>Salvar</Button></div>
    </form>
  );
}

export function RecurringPage() {
  const { data = [], isLoading } = useRecurring();
  const toggle = useToggleRecurring();
  const del = useDeleteRecurring();
  const [editing, setEditing] = useState<RecurringRule | null>(null);
  const [open, setOpen] = useState(false);
  const openForm = (r: RecurringRule | null) => { setEditing(r); setOpen(true); };

  return (
    <>
      <PageHeader title="Recorrentes" subtitle="Assinaturas, aluguel, salário e outros lançamentos que se repetem." actions={<Button onClick={() => openForm(null)}><Plus className="h-4 w-4" />Nova recorrência</Button>} />
      {isLoading ? (
        <div className="grid gap-4 md:grid-cols-2">{[0, 1].map((i) => <Skeleton key={i} className="h-28 w-full !rounded-2xl" />)}</div>
      ) : data.length === 0 ? (
        <EmptyState icon={<Repeat className="h-6 w-6" />} title="Nenhuma recorrência" description="Cadastre uma vez e o FinanceFlow lança as transações para você a cada vencimento." action={<Button onClick={() => openForm(null)}><Plus className="h-4 w-4" />Nova recorrência</Button>} />
      ) : (
        <div className="grid gap-4 md:grid-cols-2">
          {data.map((r) => (
            <Card key={r.id} className={r.active ? 'group' : 'group opacity-60'}>
              <div className="flex items-start gap-3">
                <span className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl ${r.type === 'INCOME' ? 'bg-emerald-50 text-emerald-600 dark:bg-emerald-500/15' : 'bg-rose-50 text-rose-600 dark:bg-rose-500/15'}`}><Repeat className="h-5 w-5" /></span>
                <div className="min-w-0 flex-1">
                  <p className="truncate font-semibold">{r.description}</p>
                  <p className="text-xs text-slate-500">{FREQ[r.frequency]} · {r.account?.name}{r.category ? ` · ${r.category.name}` : ''}</p>
                </div>
                <p className="text-lg font-bold"><Money value={r.amount} type={r.type} /></p>
              </div>
              <div className="mt-4 flex flex-wrap items-center justify-between gap-2 border-t border-slate-100 pt-3 text-xs text-slate-500 dark:border-slate-800">
                <span className="flex flex-wrap items-center gap-x-1.5">
                  <CalendarClock className="h-3.5 w-3.5 shrink-0" />
                  {r.active ? `Próximo: ${formatDate(r.nextDate)}` : r.endDate && r.nextDate > r.endDate ? 'Encerrada' : 'Pausada'}
                  <span className="text-slate-400">· {r.generatedCount} lançada(s)</span>
                </span>
                <span className="flex">
                  <IconButton label={r.active ? 'Pausar' : 'Retomar'} onClick={() => toggle.mutate({ id: r.id, active: !r.active })}>{r.active ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4" />}</IconButton>
                  <IconButton label={`Editar ${r.description}`} onClick={() => openForm(r)}><Pencil className="h-4 w-4" /></IconButton>
                  <IconButton label={`Excluir ${r.description}`} onClick={async () => (await confirmDialog({ title: 'Excluir recorrência', message: `Excluir “${r.description}”? As transações já lançadas continuam no histórico.`, confirmLabel: 'Excluir' })) && del.mutate(r.id)}><Trash2 className="h-4 w-4" /></IconButton>
                </span>
              </div>
            </Card>
          ))}
        </div>
      )}
      <Modal open={open} title={editing ? 'Editar recorrência' : 'Nova recorrência'} onClose={() => setOpen(false)}>
        <RecurringForm key={editing?.id ?? 'new'} rule={editing} onDone={() => setOpen(false)} />
      </Modal>
    </>
  );
}
