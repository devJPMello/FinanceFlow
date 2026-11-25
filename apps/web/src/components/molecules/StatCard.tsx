import clsx from 'clsx';
import { ReactNode } from 'react';
import { Card, Text } from '../atoms/Typography';

const tones = {
  income: 'bg-emerald-50 text-emerald-600 dark:bg-emerald-500/15',
  expense: 'bg-rose-50 text-rose-600 dark:bg-rose-500/15',
  brand: 'bg-brand-50 text-brand-600 dark:bg-brand-500/15',
};

interface Props {
  label: string;
  children: ReactNode;
  icon: ReactNode;
  tone?: keyof typeof tones;
  /** Linha auxiliar abaixo do valor (ex.: variação vs mês anterior). */
  footer?: ReactNode;
}

export function StatCard({ label, children, icon, tone = 'brand', footer }: Props) {
  return (
    <Card>
      <div className="flex items-center gap-3">
        <span className={clsx('flex h-10 w-10 items-center justify-center rounded-xl', tones[tone])}>{icon}</span>
        <Text muted>{label}</Text>
      </div>
      <div className="mt-4 text-2xl font-bold tracking-tight sm:text-[1.7rem]">{children}</div>
      {footer && <div className="mt-1 text-xs text-slate-500">{footer}</div>}
    </Card>
  );
}
