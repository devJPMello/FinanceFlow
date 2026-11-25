import { zodResolver } from '@hookform/resolvers/zod';
import { Sparkles, Trash2, Wand2 } from 'lucide-react';
import { useForm } from 'react-hook-form';
import { ruleSchema, RuleInput } from '@financeflow/shared';
import { useApplyRules, useCategories, useDeleteRule, useRules, useSaveRule } from '@/features/hooks';
import { toast } from '@/lib/toast-store';
import { Button, IconButton } from '../atoms/Button';
import { Input, Select } from '../atoms/Input';
import { Skeleton } from '../atoms/Skeleton';
import { Card, SectionTitle } from '../atoms/Typography';
import { CategoryTag } from '../molecules/CategoryTag';
import { EmptyState } from '../molecules/EmptyState';
import { FormField } from '../molecules/FormField';
import { PageHeader } from '../molecules/PageHeader';

export function RulesPage() {
  const { data: rules = [], isLoading } = useRules();
  const { data: categories = [] } = useCategories();
  const save = useSaveRule();
  const del = useDeleteRule();
  const apply = useApplyRules();
  const { register, handleSubmit, reset, formState: { errors } } = useForm<RuleInput>({
    resolver: zodResolver(ruleSchema) as never, defaultValues: { matchType: 'CONTAINS', priority: 0, pattern: '', categoryId: '' },
  });

  const onApply = () =>
    apply.mutate(undefined, {
      onSuccess: ({ updated }) => toast.success(updated ? `${updated} transação(ões) categorizada(s)` : 'Nenhuma transação sem categoria combinou com as regras'),
    });

  return (
    <>
      <PageHeader
        title="Regras de categorização"
        subtitle="Categorize automaticamente pela descrição, nas importações e nas transações antigas."
        actions={<Button variant="secondary" loading={apply.isPending} disabled={!rules.length} onClick={onApply}><Wand2 className="h-4 w-4" />Aplicar às sem categoria</Button>}
      />

      <Card>
        <SectionTitle>Nova regra</SectionTitle>
        <form
          className="grid items-start gap-3 sm:grid-cols-2 xl:grid-cols-[1fr_9rem_1fr_6rem_auto]" noValidate
          onSubmit={handleSubmit((v) => save.mutate(v, { onSuccess: () => reset({ matchType: v.matchType, priority: 0, pattern: '', categoryId: '' }) }))}
        >
          <FormField label="Quando a descrição" error={errors.pattern?.message}>
            <Input placeholder="Ex.: uber, ifood, mercado" {...register('pattern')} />
          </FormField>
          <FormField label="Tipo de busca">
            <Select {...register('matchType')}><option value="CONTAINS">Contém</option><option value="REGEX">Regex</option></Select>
          </FormField>
          <FormField label="Categorizar como" error={errors.categoryId?.message}>
            <Select {...register('categoryId')}>
              <option value="">Selecione…</option>
              {categories.map((c) => <option key={c.id} value={c.id}>{c.name} ({c.kind === 'INCOME' ? 'receita' : 'despesa'})</option>)}
            </Select>
          </FormField>
          <FormField label="Prioridade" error={errors.priority?.message}><Input type="number" min="0" {...register('priority')} /></FormField>
          <Button type="submit" className="sm:col-span-2 xl:col-span-1 xl:mt-[1.65rem]" loading={save.isPending}><Sparkles className="h-4 w-4" />Criar</Button>
        </form>
        <p className="mt-3 text-xs text-slate-500">Não diferencia maiúsculas de minúsculas. Em caso de empate, vale a regra de maior prioridade. A categoria precisa ser do mesmo tipo (receita/despesa) da transação.</p>
      </Card>

      {isLoading ? (
        <Skeleton className="h-40 w-full !rounded-2xl" />
      ) : rules.length === 0 ? (
        <EmptyState icon={<Wand2 className="h-6 w-6" />} title="Nenhuma regra ainda" description="Crie uma regra como “contém UBER → Transporte” e as próximas importações já virão categorizadas." />
      ) : (
        <Card className="!p-0">
          <ul className="divide-y divide-slate-100 dark:divide-slate-800">
            {rules.map((r) => (
              <li key={r.id} className="group flex flex-wrap items-center gap-3 px-5 py-3.5 text-sm">
                <span className="text-slate-500">{r.matchType === 'REGEX' ? 'Regex' : 'Contém'}</span>
                <code className="rounded-lg bg-slate-100 px-2 py-0.5 font-mono text-[13px] dark:bg-slate-800">{r.pattern}</code>
                <span className="text-slate-400">→</span>
                <CategoryTag name={r.category.name} color={r.category.color} />
                <span className="ml-auto text-xs text-slate-400">prioridade {r.priority}</span>
                <IconButton label={`Excluir regra ${r.pattern}`} className="opacity-0 group-hover:opacity-100 focus:opacity-100" onClick={() => del.mutate(r.id)}><Trash2 className="h-4 w-4" /></IconButton>
              </li>
            ))}
          </ul>
        </Card>
      )}
    </>
  );
}
