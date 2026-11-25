import { Download } from 'lucide-react';
import { useState } from 'react';
import { currentMonth, formatDate, formatMoney } from '@/lib/format';
import { downloadTransactionsCsv, useCashflow, useSummary } from '@/features/hooks';
import { Button } from '../atoms/Button';
import { Input } from '../atoms/Input';
import { Money } from '../atoms/Money';
import { Card, ColorDot, SectionTitle } from '../atoms/Typography';
import { FormField } from '../molecules/FormField';
import { PageHeader } from '../molecules/PageHeader';
import { CashflowChart, CategoryChart } from '../organisms/Charts';

export function ReportsPage() {
  const [from, setFrom] = useState(`${currentMonth()}-01`);
  const [to, setTo] = useState(new Date().toISOString().slice(0, 10));
  const { data, isLoading } = useSummary(from, to);
  const cashflow = useCashflow(12);
  const total = data?.byCategory.reduce((s, c) => s + c.total, 0) ?? 0;
  return (
    <>
      <PageHeader title="Relatórios" subtitle="Analise qualquer período e exporte seus dados." actions={<Button variant="secondary" onClick={() => downloadTransactionsCsv({ from, to })}><Download className="h-4 w-4" />Exportar CSV</Button>} />
      <Card className="grid gap-3 !p-4 sm:grid-cols-2">
        <FormField label="De"><Input type="date" value={from} onChange={(e) => setFrom(e.target.value)} /></FormField>
        <FormField label="Até"><Input type="date" value={to} onChange={(e) => setTo(e.target.value)} /></FormField>
      </Card>
      <div className="grid gap-4 sm:grid-cols-3">
        {[['Receitas', data?.income, 'INCOME'], ['Despesas', data?.expense, 'EXPENSE'], ['Resultado', data?.balance, undefined]].map(([l, v, t]) => (
          <div key={l as string} className="surface px-5 py-4"><p className="text-sm text-slate-500">{l}</p><p className="text-2xl font-bold">{v === undefined ? '—' : <Money value={v as number} type={t as 'INCOME' | 'EXPENSE' | undefined} />}</p></div>
        ))}
      </div>
      <div className="grid gap-4 lg:grid-cols-2">
        <CategoryChart data={data?.byCategory ?? []} loading={isLoading} />
        <CashflowChart data={cashflow.data} loading={cashflow.isLoading} />
      </div>
      {data && (
        <div className="grid gap-4 lg:grid-cols-2">
          <Card>
            <SectionTitle>Detalhe por categoria</SectionTitle>
            <ul className="divide-y divide-slate-100 text-sm dark:divide-slate-800">
              {data.byCategory.map((c) => (
                <li key={c.name} className="space-y-1.5 py-3">
                  <div className="flex items-center justify-between"><span className="flex items-center gap-2"><ColorDot color={c.color} />{c.name}</span><span className="font-medium tabular-nums">{formatMoney(c.total)}</span></div>
                  <div className="h-1.5 overflow-hidden rounded-full bg-slate-100 dark:bg-slate-800"><div className="h-full rounded-full" style={{ width: `${total ? (c.total / total) * 100 : 0}%`, backgroundColor: c.color }} /></div>
                </li>
              ))}
              {!data.byCategory.length && <li className="py-3 text-slate-500">Sem despesas no período.</li>}
            </ul>
          </Card>
          <Card>
            <SectionTitle>Maiores despesas</SectionTitle>
            <ul className="divide-y divide-slate-100 text-sm dark:divide-slate-800">
              {data.topExpenses.map((t) => (
                <li key={t.id} className="flex items-center justify-between py-3"><span>{t.description}<span className="block text-xs text-slate-500">{formatDate(t.date)} · {t.category ?? 'Sem categoria'}</span></span><Money value={t.amount} type="EXPENSE" className="font-semibold" /></li>
              ))}
              {!data.topExpenses.length && <li className="py-3 text-slate-500">Sem despesas no período.</li>}
            </ul>
          </Card>
        </div>
      )}
    </>
  );
}
