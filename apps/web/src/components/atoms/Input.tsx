import clsx from 'clsx';
import { forwardRef, InputHTMLAttributes, ReactNode, SelectHTMLAttributes } from 'react';

const base =
  'w-full rounded-xl border bg-white px-3.5 py-2.5 text-sm text-slate-900 shadow-sm outline-none transition-colors placeholder:text-slate-400 ' +
  'hover:border-slate-300 focus:border-brand-500 focus:ring-2 focus:ring-brand-500/20 ' +
  'dark:bg-slate-900 dark:text-slate-100 border-slate-200 dark:border-slate-700 dark:hover:border-slate-600 disabled:opacity-60';

export interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  invalid?: boolean;
  /** Ícone à esquerda (ex.: lupa). */
  icon?: ReactNode;
}

export const Input = forwardRef<HTMLInputElement, InputProps>(({ invalid, icon, className, ...rest }, ref) => {
  const input = (
    <input
      ref={ref}
      aria-invalid={invalid || undefined}
      className={clsx(base, icon && 'pl-10', invalid && '!border-rose-500 focus:!ring-rose-500/20', className)}
      {...rest}
    />
  );
  if (!icon) return input;
  return (
    <div className="relative">
      <span className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400">{icon}</span>
      {input}
    </div>
  );
});
Input.displayName = 'Input';

export interface SelectProps extends SelectHTMLAttributes<HTMLSelectElement> {
  invalid?: boolean;
}

export const Select = forwardRef<HTMLSelectElement, SelectProps>(({ invalid, className, children, ...rest }, ref) => (
  <select ref={ref} aria-invalid={invalid || undefined} className={clsx(base, 'pr-8', invalid && '!border-rose-500', className)} {...rest}>
    {children}
  </select>
));
Select.displayName = 'Select';
