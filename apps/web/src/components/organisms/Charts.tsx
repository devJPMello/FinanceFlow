import { PieChart as PieIcon, BarChart3 } from 'lucide-react';
import { Bar, BarChart, CartesianGrid, Cell, Pie, PieChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { formatMoney, monthLabel } from '@/lib/format';
import type { CashflowPoint, Summary } from '@/features/types';
import { Card, ColorDot, SectionTitle } from '../atoms/Typography';
import { Skeleton } from '../atoms/Skeleton';
import { EmptyState } from '../molecules/EmptyState';

const tooltipStyle = { borderRadius: 12, border: '1px solid #e2e8f0', boxShadow: '0 8px 24px -8px rgb(15 23 42 / .2)', fontSize: 13 };

export function CategoryChart({ data, loading }: { data: Summary['byCategory']; loading?: boolean }) {
  const total = data.reduce((s, d) => s + d.total, 0);
  return (
    <Card>
      <SectionTitle>Gastos por categoria</SectionTitle>
      {loading ? (
        <Skeleton className="h-60 w-full" />
      ) : data.length === 0 ? (
        <EmptyState icon={<PieIcon className="h-6 w-6" />} title="Sem despesas no período" description="Quando houver gastos, a distribuição por categoria aparece aqui." />
      ) : (
        <div className="grid items-center gap-4 sm:grid-cols-[11rem_minmax(0,1fr)]">
          <div className="relative mx-auto h-44 w-44">
            <ResponsiveContainer>
              <PieChart>
                <Pie data={data} dataKey="total" nameKey="name" innerRadius={52} outerRadius={78} paddingAngle={3} cornerRadius={6} stroke="none" isAnimationActive={false}>
                  {data.map((d) => <Cell key={d.name} fill={d.color} />)}
                </Pie>
                <Tooltip formatter={(v: number) => formatMoney(v)} contentStyle={tooltipStyle} />
              </PieChart>
            </ResponsiveContainer>
            <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
              <span className="text-xs text-slate-500">Total</span>
              <span className="text-lg font-bold tabular-nums">{formatMoney(total)}</span>
            </div>
          </div>
          <ul className="space-y-2.5 text-sm">
            {data.slice(0, 6).map((d) => (
              <li key={d.name} className="flex items-center justify-between gap-3">
                <span className="flex min-w-0 items-center gap-2"><ColorDot color={d.color} /><span className="truncate">{d.name}</span></span>
                <span className="shrink-0 text-xs tabular-nums text-slate-500">{Math.round((d.total / total) * 100)}%</span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </Card>
  );
}

export function CashflowChart({ data, loading }: { data?: CashflowPoint[]; loading?: boolean }) {
  const rows = (data ?? []).map((d) => ({ ...d, label: monthLabel(d.month) }));
  const empty = rows.every((r) => !r.income && !r.expense);
  return (
    <Card>
      <SectionTitle
        action={
          <span className="flex items-center gap-3 text-xs text-slate-500">
            <span className="flex items-center gap-1.5"><ColorDot color="#10b981" />Receitas</span>
            <span className="flex items-center gap-1.5"><ColorDot color="#f43f5e" />Despesas</span>
          </span>
        }
      >
        Fluxo mensal
      </SectionTitle>
      {loading ? (
        <Skeleton className="h-60 w-full" />
      ) : empty ? (
        <EmptyState icon={<BarChart3 className="h-6 w-6" />} title="Sem movimentações" />
      ) : (
        <div className="h-60">
          <ResponsiveContainer>
            <BarChart data={rows} barGap={4} margin={{ left: -12, top: 4 }}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" strokeOpacity={0.6} />
              <XAxis dataKey="label" tickLine={false} axisLine={false} interval={0} tickFormatter={(v: string) => v.split(' ')[0].replace('.', '')} tick={{ fontSize: 12, fill: '#94a3b8' }} />
              <YAxis tickLine={false} axisLine={false} tick={{ fontSize: 12, fill: '#94a3b8' }} tickFormatter={(v) => (v >= 1000 ? `${Math.round(v / 1000)}k` : String(v))} width={48} />
              <Tooltip cursor={{ fill: 'rgb(148 163 184 / .12)' }} formatter={(v: number) => formatMoney(v)} contentStyle={tooltipStyle} />
              <Bar dataKey="income" name="Receitas" fill="#10b981" radius={[6, 6, 0, 0]} maxBarSize={26} isAnimationActive={false} />
              <Bar dataKey="expense" name="Despesas" fill="#f43f5e" radius={[6, 6, 0, 0]} maxBarSize={26} isAnimationActive={false} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}
    </Card>
  );
}
