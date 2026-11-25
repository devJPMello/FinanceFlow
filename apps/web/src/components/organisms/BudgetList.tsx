import clsx from 'clsx';
import { PiggyBank, Trash2 } from 'lucide-react';
import { formatMoney } from '@/lib/format';
import type { Budget } from '@/features/types';
import { Badge } from '../atoms/Badge';
import { IconButton } from '../atoms/Button';
import { Card } from '../atoms/Typography';
import { CategoryTag } from '../molecules/CategoryTag';
import { EmptyState } from '../molecules/EmptyState';

export function BudgetList({ budgets, onDelete }: { budgets: Budget[]; onDelete?: (id: string) => void }) {
  if (!budgets.length) {
    return <EmptyState icon={<PiggyBank className="h-6 w-6" />} title="Nenhum orçamento neste mês" description="Defina limites por categoria para acompanhar seus gastos." />;
  }
  return (
    <div className="grid gap-3 md:grid-cols-2">
      {budgets.map((b) => {
        const over = b.percent > 100;
        const warn = b.percent >= 80;
        return (
          <Card key={b.id} className="space-y-3">
            <div className="flex items-center justify-between">
              <CategoryTag name={b.category.name} color={b.category.color} />
              <div className="flex items-center gap-1">
                {over ? <Badge tone="danger">Estourado</Badge> : warn ? <Badge tone="warning">Atenção</Badge> : <Badge tone="success">No limite</Badge>}
                {onDelete && <IconButton label={`Remover orçamento de ${b.category.name}`} onClick={() => onDelete(b.id)}><Trash2 className="h-4 w-4" /></IconButton>}
              </div>
            </div>
            <div className="flex items-end justify-between">
              <span className="text-xl font-bold tabular-nums">{formatMoney(b.spent)}</span>
              <span className="text-sm text-slate-500">de {formatMoney(b.amount)}</span>
            </div>
            <div
              className="h-2.5 overflow-hidden rounded-full bg-slate-100 dark:bg-slate-800"
              role="progressbar" aria-label={`Consumo de ${b.category.name}`} aria-valuenow={Math.min(b.percent, 100)} aria-valuemin={0} aria-valuemax={100}
            >
              <div
                className={clsx('h-full rounded-full transition-all duration-500', over ? 'bg-rose-500' : warn ? 'bg-amber-400' : 'bg-emerald-500')}
                style={{ width: `${Math.min(b.percent, 100)}%` }}
              />
            </div>
            <p className="text-xs text-slate-500">
              {over ? `${formatMoney(Math.abs(b.remaining))} acima do limite` : `Restam ${formatMoney(b.remaining)}`} · {b.percent}%
            </p>
          </Card>
        );
      })}
    </div>
  );
}
