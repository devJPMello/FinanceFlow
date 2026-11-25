import { AlertTriangle, ArrowDownRight, ArrowUpRight, ChevronRight, Scale, Wallet } from 'lucide-react';
import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '@/lib/auth-store';
import { currentMonth, formatDate, formatMoney, monthBounds } from '@/lib/format';
import { useAccounts, useBudgetAlerts, useBudgets, useCashflow, useSummary, useTransactions } from '@/features/hooks';
import { Skeleton } from '../atoms/Skeleton';
import { Money } from '../atoms/Money';
import { Card, SectionTitle } from '../atoms/Typography';
import { CategoryTag } from '../molecules/CategoryTag';
import { EmptyState } from '../molecules/EmptyState';
import { MonthSwitcher, shiftMonth } from '../molecules/MonthSwitcher';
import { PageHeader } from '../molecules/PageHeader';
import { StatCard } from '../molecules/StatCard';
import { BudgetList } from '../organisms/BudgetList';
import { CashflowChart, CategoryChart } from '../organisms/Charts';

function greeting() {
  const h = new Date().getHours();
  return h < 12 ? 'Bom dia' : h < 18 ? 'Boa tarde' : 'Boa noite';
}

/** Variação percentual vs período anterior, formatada para o rodapé do card. */
function Delta({ now, prev, inverse }: { now: number; prev?: number; inverse?: boolean }) {
  if (prev === undefined) return <span>&nbsp;</span>;
  if (!prev) return <span>Sem dados no mês anterior</span>;
  const pct = Math.round(((now - prev) / prev) * 100);
  const good = inverse ? pct <= 0 : pct >= 0;
  return (
    <span className={good ? 'text-emerald-600' : 'text-rose-600'}>
      {pct >= 0 ? '▲' : '▼'} {Math.abs(pct)}% <span className="text-slate-400">vs mês anterior</span>
    </span>
  );
}

export function DashboardPage() {
  const user = useAuth((s) => s.user);
  const [month, setMonth] = useState(currentMonth());
  const { from, to } = monthBounds(month);
  const prev = monthBounds(shiftMonth(month, -1));
  const summary = useSummary(from, to);
  const prevSummary = useSummary(prev.from, prev.to);
  const cashflow = useCashflow(6);
  const budgets = useBudgets(month);
  const alerts = useBudgetAlerts(month).data ?? [];
  const accounts = useAccounts();
  const recent = useTransactions({ page: 1, pageSize: 6, from, to });

  const totalBalance = (accounts.data ?? []).reduce((s, a) => s + a.balance, 0);
  const s = summary.data;

  return (
    <>
      <PageHeader
        title={`${greeting()}, ${user?.name?.split(' ')[0] ?? ''}`}
        subtitle="Aqui está o resumo das suas finanças."
        actions={<MonthSwitcher value={month} onChange={setMonth} />}
      />

      {alerts.length > 0 && (
        <Link to="/budgets" role="alert" className={`flex items-start gap-3 rounded-2xl border p-4 text-sm transition-colors ${alerts.some((a) => a.level === 'danger') ? 'border-rose-200 bg-rose-50 text-rose-800 hover:bg-rose-100 dark:border-rose-500/30 dark:bg-rose-500/10 dark:text-rose-200' : 'border-amber-200 bg-amber-50 text-amber-800 hover:bg-amber-100 dark:border-amber-500/30 dark:bg-amber-500/10 dark:text-amber-200'}`}>
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
          <div>
            <p className="font-semibold">{alerts.some((a) => a.level === 'danger') ? 'Orçamento estourado' : 'Orçamento perto do limite'}</p>
            <p className="mt-0.5">{alerts.map((a) => `${a.category.name} (${a.percent}%)`).join(' · ')}</p>
          </div>
          <ChevronRight className="ml-auto h-4 w-4 shrink-0 self-center" />
        </Link>
      )}

      {/* Hero: saldo total */}
      <section
        aria-label="Saldo total"
        className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-brand-600 via-brand-700 to-brand-900 p-6 text-white shadow-pop sm:p-8"
      >
        <div aria-hidden className="absolute -right-16 -top-16 h-64 w-64 rounded-full bg-white/10 blur-2xl" />
        <div aria-hidden className="absolute -bottom-20 left-1/3 h-56 w-56 rounded-full bg-brand-400/30 blur-3xl" />
        <div className="relative flex flex-wrap items-end justify-between gap-6">
          <div>
            <p className="flex items-center gap-2 text-sm text-white/70"><Wallet className="h-4 w-4" />Saldo total em contas</p>
            {accounts.isLoading ? <Skeleton className="mt-3 h-10 w-56 !bg-white/20" /> : (
              <p className="mt-2 text-4xl font-bold tracking-tight tabular-nums sm:text-5xl">{formatMoney(totalBalance)}</p>
            )}
          </div>
          <div className="flex flex-wrap gap-2">
            {(accounts.data ?? []).slice(0, 3).map((a) => (
              <div key={a.id} className="rounded-2xl bg-white/10 px-4 py-2.5 backdrop-blur">
                <p className="text-xs text-white/70">{a.name}</p>
                <p className="font-semibold tabular-nums">{formatMoney(a.balance)}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <div className="grid gap-4 sm:grid-cols-3">
        <StatCard label="Receitas do mês" tone="income" icon={<ArrowUpRight className="h-5 w-5" />} footer={<Delta now={s?.income ?? 0} prev={prevSummary.data?.income} />}>
          {s ? <Money value={s.income} plain /> : <Skeleton className="h-8 w-32" />}
        </StatCard>
        <StatCard label="Despesas do mês" tone="expense" icon={<ArrowDownRight className="h-5 w-5" />} footer={<Delta now={s?.expense ?? 0} prev={prevSummary.data?.expense} inverse />}>
          {s ? <Money value={s.expense} plain /> : <Skeleton className="h-8 w-32" />}
        </StatCard>
        <StatCard label="Resultado do mês" icon={<Scale className="h-5 w-5" />} footer={s ? (s.balance >= 0 ? 'Você economizou neste mês' : 'Gastos acima das receitas') : undefined}>
          {s ? <Money value={s.balance} /> : <Skeleton className="h-8 w-32" />}
        </StatCard>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <CategoryChart data={s?.byCategory ?? []} loading={summary.isLoading} />
        <CashflowChart data={cashflow.data} loading={cashflow.isLoading} />
      </div>

      <div className="grid gap-4 lg:grid-cols-5">
        <Card className="lg:col-span-3">
          <SectionTitle action={<Link to="/transactions" className="flex items-center text-sm font-medium text-brand-600 hover:underline">Ver todas<ChevronRight className="h-4 w-4" /></Link>}>
            Últimas transações
          </SectionTitle>
          {recent.isLoading ? (
            <div className="space-y-3">{[0, 1, 2].map((i) => <Skeleton key={i} className="h-10 w-full" />)}</div>
          ) : recent.data?.items.length ? (
            <ul className="divide-y divide-slate-100 dark:divide-slate-800">
              {recent.data.items.map((t) => (
                <li key={t.id} className="flex items-center justify-between gap-3 py-3">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium">{t.description}</p>
                    <p className="mt-0.5 flex items-center gap-2 text-xs text-slate-500">{formatDate(t.date)}<CategoryTag name={t.category?.name} color={t.category?.color} /></p>
                  </div>
                  <span className="shrink-0 text-sm font-semibold"><Money value={t.amount} type={t.type} /></span>
                </li>
              ))}
            </ul>
          ) : (
            <EmptyState title="Nenhuma transação neste mês" description="Adicione uma transação ou importe sua planilha." action={<Link to="/imports" className="text-sm font-medium text-brand-600 hover:underline">Importar planilha</Link>} />
          )}
        </Card>
        <div className="lg:col-span-2">
          <SectionTitle action={<Link to="/budgets" className="flex items-center text-sm font-medium text-brand-600 hover:underline">Gerenciar<ChevronRight className="h-4 w-4" /></Link>}>Orçamentos</SectionTitle>
          <div className="[&>div]:grid-cols-1"><BudgetList budgets={(budgets.data ?? []).slice(0, 4)} /></div>
        </div>
      </div>
    </>
  );
}
