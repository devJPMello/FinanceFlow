import clsx from 'clsx';
import { ButtonHTMLAttributes, forwardRef } from 'react';
import { Spinner } from './Spinner';

type Variant = 'primary' | 'secondary' | 'ghost' | 'danger' | 'soft';

const variants: Record<Variant, string> = {
  primary:
    'bg-gradient-to-b from-brand-500 to-brand-600 text-white shadow-sm shadow-brand-600/30 hover:from-brand-600 hover:to-brand-700 active:scale-[0.98] disabled:opacity-50',
  secondary:
    'border border-slate-200 bg-white text-slate-700 shadow-sm hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-800/60 dark:text-slate-100 dark:hover:bg-slate-800',
  soft: 'bg-brand-50 text-brand-700 hover:bg-brand-100 dark:bg-brand-500/15 dark:text-brand-200 dark:hover:bg-brand-500/25',
  ghost: 'text-slate-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800',
  danger: 'bg-rose-600 text-white shadow-sm hover:bg-rose-700 active:scale-[0.98] disabled:opacity-50',
};

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
  loading?: boolean;
  size?: 'sm' | 'md' | 'lg';
}

const sizes = { sm: 'px-3 py-1.5 text-xs', md: 'px-4 py-2 text-sm', lg: 'px-5 py-2.5 text-sm' };

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  ({ variant = 'primary', size = 'md', loading, className, children, disabled, ...rest }, ref) => (
    <button
      ref={ref}
      disabled={disabled || loading}
      className={clsx(
        'inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-xl font-medium transition-all disabled:cursor-not-allowed',
        sizes[size], variants[variant], className,
      )}
      {...rest}
    >
      {loading && <Spinner className="h-4 w-4" />}
      {children}
    </button>
  ),
);
Button.displayName = 'Button';

/** Botão só com ícone; `label` vira aria-label e tooltip. */
export const IconButton = forwardRef<HTMLButtonElement, Omit<ButtonProps, 'size'> & { label: string }>(
  ({ label, className, children, variant = 'ghost', ...rest }, ref) => (
    <Button ref={ref} variant={variant} aria-label={label} title={label} className={clsx('!p-2', className)} {...rest}>
      {children}
    </Button>
  ),
);
IconButton.displayName = 'IconButton';
