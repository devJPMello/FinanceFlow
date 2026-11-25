import { zodResolver } from '@hookform/resolvers/zod';
import { useEffect } from 'react';
import { Controller, useForm } from 'react-hook-form';
import { transactionSchema, TransactionInput } from '@financeflow/shared';
import { useAccounts, useCategories, useSaveTransaction, useTags } from '@/features/hooks';
import type { Transaction } from '@/features/types';
import { Button } from '../atoms/Button';
import { Input, Select } from '../atoms/Input';
import { Segmented } from '../atoms/Segmented';
import { FormField } from '../molecules/FormField';
import { PAYMENT_METHODS } from '../molecules/PaymentBadge';
import { TagInput } from '../molecules/TagInput';
import { AttachmentList } from './AttachmentList';

interface Props {
  transaction?: Transaction | null;
  onDone: () => void;
}

export function TransactionForm({ transaction, onDone }: Props) {
  const { data: accounts = [] } = useAccounts();
  const { data: categories = [] } = useCategories();
  const save = useSaveTransaction();
  const { data: knownTags = [] } = useTags();

  const { register, handleSubmit, watch, control, setValue, getValues, formState: { errors } } = useForm<TransactionInput>({
    resolver: zodResolver(transactionSchema) as never,
    defaultValues: transaction
      ? {
          accountId: transaction.accountId, categoryId: transaction.categoryId, type: transaction.type === 'INCOME' ? 'INCOME' : 'EXPENSE',
          amount: transaction.amount, date: transaction.date.slice(0, 10), description: transaction.description, notes: transaction.notes ?? '', paymentMethod: (transaction.paymentMethod ?? '') as never, tags: transaction.tags ?? [],
        }
      : { type: 'EXPENSE', date: new Date().toISOString().slice(0, 10), accountId: accounts[0]?.id ?? '', categoryId: '', paymentMethod: '' as never, tags: [], installments: 1 },
  });

  // contas podem chegar depois de abrir o formulário: pré-seleciona a primeira
  useEffect(() => {
    if (!transaction && !getValues('accountId') && accounts[0]) setValue('accountId', accounts[0].id);
  }, [accounts, transaction, getValues, setValue]);

  const type = watch('type');
  const onSubmit = handleSubmit((values) => save.mutate({ ...values, id: transaction?.id }, { onSuccess: onDone }));

  return (
    <form onSubmit={onSubmit} className="space-y-5" noValidate>
      <Controller
        control={control} name="type"
        render={({ field }) => (
          <Segmented
            label="Tipo" className="w-full" value={field.value}
            onChange={(v) => { field.onChange(v); setValue('categoryId', ''); }}
            options={[{ value: 'EXPENSE', label: 'Despesa', tone: 'expense' }, { value: 'INCOME', label: 'Receita', tone: 'income' }]}
          />
        )}
      />
      <FormField label="Valor (R$)" error={errors.amount?.message}>
        <Input type="number" step="0.01" min="0" inputMode="decimal" placeholder="0,00" className="!py-3 text-lg font-semibold" autoFocus {...register('amount')} />
      </FormField>
      <FormField label="Descrição" error={errors.description?.message}>
        <Input placeholder="Ex.: Supermercado" {...register('description')} />
      </FormField>
      <div className="grid gap-3 sm:grid-cols-2">
        <FormField label="Data" error={errors.date?.message}><Input type="date" {...register('date')} /></FormField>
        <FormField label="Conta" error={errors.accountId?.message}>
          <Select {...register('accountId')}>
            <option value="">Selecione…</option>
            {accounts.map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}
          </Select>
        </FormField>
      </div>
      <div className="grid gap-3 sm:grid-cols-2">
        <FormField label="Categoria">
          <Select {...register('categoryId')}>
            <option value="">Sem categoria</option>
            {categories.filter((c) => c.kind === type).map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
          </Select>
        </FormField>
        <FormField label="Forma de pagamento">
          <Select {...register('paymentMethod')}>
            <option value="">Não informar</option>
            {Object.entries(PAYMENT_METHODS).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
          </Select>
        </FormField>
      </div>
      {!transaction && (
        <FormField label="Parcelas" error={errors.installments?.message}>
          <div className="flex items-center gap-3">
            <Input type="number" min="1" max="60" className="!w-24" {...register('installments')} />
            <p className="text-xs text-slate-500">{Number(watch('installments')) > 1 ? `Serão criadas ${watch('installments')} transações mensais, cada uma com o valor acima.` : 'Deixe em 1 para uma transação única.'}</p>
          </div>
        </FormField>
      )}
      <FormField label="Tags (opcional)">
        <Controller control={control} name="tags" render={({ field }) => <TagInput value={field.value ?? []} onChange={field.onChange} suggestions={knownTags} />} />
      </FormField>
      <FormField label="Observações (opcional)"><Input {...register('notes')} /></FormField>
      {transaction && <AttachmentList transactionId={transaction.id} items={transaction.attachments ?? []} />}
      <div className="flex justify-end gap-2 pt-1">
        <Button type="button" variant="secondary" onClick={onDone}>Cancelar</Button>
        <Button type="submit" loading={save.isPending}>Salvar</Button>
      </div>
    </form>
  );
}
