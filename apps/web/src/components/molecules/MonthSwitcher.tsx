import { ChevronLeft, ChevronRight } from 'lucide-react';
import { IconButton } from '../atoms/Button';

export function shiftMonth(ym: string, delta: number) {
  const [y, m] = ym.split('-').map(Number);
  return new Date(Date.UTC(y, m - 1 + delta, 1)).toISOString().slice(0, 7);
}

export function MonthSwitcher({ value, onChange }: { value: string; onChange: (ym: string) => void }) {
  const [y, m] = value.split('-').map(Number);
  const month = new Date(y, m - 1, 1).toLocaleDateString('pt-BR', { month: 'long' });
  const label = `${month.charAt(0).toUpperCase()}${month.slice(1)} ${y}`;
  return (
    <div className="inline-flex items-center gap-1 rounded-xl border border-slate-200 bg-white p-1 shadow-sm dark:border-slate-700 dark:bg-slate-900">
      <IconButton label="Mês anterior" onClick={() => onChange(shiftMonth(value, -1))}><ChevronLeft className="h-4 w-4" /></IconButton>
      <span className="min-w-36 select-none text-center text-sm font-medium" aria-live="polite">{label}</span>
      <IconButton label="Próximo mês" onClick={() => onChange(shiftMonth(value, 1))}><ChevronRight className="h-4 w-4" /></IconButton>
    </div>
  );
}
