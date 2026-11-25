import clsx from 'clsx';
import { AlertCircle, CheckCircle2, Info, X } from 'lucide-react';
import { useToasts } from '@/lib/toast-store';

const icons = { success: CheckCircle2, error: AlertCircle, info: Info };
const colors = {
  success: 'text-emerald-500',
  error: 'text-rose-500',
  info: 'text-brand-500',
};

export function Toaster() {
  const { toasts, dismiss } = useToasts();
  return (
    <div aria-live="polite" className="pointer-events-none fixed bottom-4 right-4 z-[60] flex w-[min(22rem,calc(100vw-2rem))] flex-col gap-2">
      {toasts.map((t) => {
        const Icon = icons[t.tone];
        return (
          <div
            key={t.id}
            role={t.tone === 'error' ? 'alert' : 'status'}
            className="pointer-events-auto flex animate-toast-in items-start gap-3 rounded-xl border border-slate-200 bg-white p-3.5 shadow-pop dark:border-slate-700 dark:bg-slate-900"
          >
            <Icon className={clsx('mt-0.5 h-5 w-5 shrink-0', colors[t.tone])} />
            <p className="flex-1 text-sm">{t.message}</p>
            <button aria-label="Fechar aviso" onClick={() => dismiss(t.id)} className="text-slate-400 hover:text-slate-600">
              <X className="h-4 w-4" />
            </button>
          </div>
        );
      })}
    </div>
  );
}
