import clsx from 'clsx';
import { formatMoney } from '@/lib/format';

interface Props {
  value: number;
  /** INCOME fica verde, EXPENSE vermelho; sem tipo, o sinal do valor decide. */
  type?: 'INCOME' | 'EXPENSE' | 'TRANSFER';
  /** Sem cor (para usar sobre fundos coloridos). */
  plain?: boolean;
  className?: string;
}

export function Money({ value, type, plain, className }: Props) {
  const positive = type ? type === 'INCOME' : value >= 0;
  const neutral = type === 'TRANSFER' || plain;
  return (
    <span className={clsx('tabular-nums', !neutral && (positive ? 'text-income' : 'text-expense'), className)}>
      {type === 'EXPENSE' ? '-' : type === 'INCOME' ? '+' : ''}
      {formatMoney(type ? Math.abs(value) : value)}
    </span>
  );
}
