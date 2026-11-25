import clsx from 'clsx';
import { CreditCard, Landmark, Zap } from 'lucide-react';

export const PAYMENT_METHODS = {
  PIX: { label: 'Pix', icon: Zap, tone: 'bg-teal-50 text-teal-700 dark:bg-teal-500/15 dark:text-teal-300' },
  DEBIT: { label: 'Débito', icon: Landmark, tone: 'bg-sky-50 text-sky-700 dark:bg-sky-500/15 dark:text-sky-300' },
  CREDIT: { label: 'Crédito', icon: CreditCard, tone: 'bg-violet-50 text-violet-700 dark:bg-violet-500/15 dark:text-violet-300' },
} as const;
export type PaymentMethodKey = keyof typeof PAYMENT_METHODS;

export function PaymentBadge({ method }: { method?: string | null }) {
  const m = method ? PAYMENT_METHODS[method as PaymentMethodKey] : undefined;
  if (!m) return null;
  return (
    <span className={clsx('inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-medium', m.tone)}>
      <m.icon className="h-3 w-3" />{m.label}
    </span>
  );
}
