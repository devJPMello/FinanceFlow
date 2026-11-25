import { ReactNode, useId, cloneElement, isValidElement } from 'react';

interface Props {
  label: string;
  error?: string;
  hint?: string;
  children: ReactNode;
}

/** Associa label, controle e mensagem de erro com ids acessíveis. */
export function FormField({ label, error, hint, children }: Props) {
  const id = useId();
  const control = isValidElement(children)
    ? cloneElement(children as React.ReactElement<Record<string, unknown>>, {
        id,
        invalid: !!error,
        'aria-describedby': error ? `${id}-err` : undefined,
      })
    : children;
  return (
    <div className="space-y-1">
      <label htmlFor={id} className="block text-sm font-medium text-slate-700 dark:text-slate-300">{label}</label>
      {control}
      {hint && !error && <p className="text-xs text-slate-500">{hint}</p>}
      {error && <p id={`${id}-err`} role="alert" className="text-xs text-red-600">{error}</p>}
    </div>
  );
}
