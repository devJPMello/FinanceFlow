import clsx from 'clsx';

interface Option<T extends string> { value: T; label: string; tone?: 'income' | 'expense' }

interface Props<T extends string> {
  value: T;
  onChange: (v: T) => void;
  options: Option<T>[];
  label: string;
  className?: string;
}

/** Controle segmentado (radio group visual), ex.: Despesa / Receita. */
export function Segmented<T extends string>({ value, onChange, options, label, className }: Props<T>) {
  return (
    <div role="radiogroup" aria-label={label} className={clsx('inline-flex rounded-xl bg-slate-100 p-1 dark:bg-slate-800', className)}>
      {options.map((o) => {
        const active = o.value === value;
        return (
          <button
            key={o.value} type="button" role="radio" aria-checked={active} onClick={() => onChange(o.value)}
            className={clsx(
              'flex-1 rounded-lg px-4 py-1.5 text-sm font-medium transition-all',
              active
                ? clsx('bg-white shadow-sm dark:bg-slate-900', o.tone === 'income' ? 'text-income' : o.tone === 'expense' ? 'text-expense' : 'text-brand-700 dark:text-brand-200')
                : 'text-slate-500 hover:text-slate-700 dark:hover:text-slate-200',
            )}
          >
            {o.label}
          </button>
        );
      })}
    </div>
  );
}
