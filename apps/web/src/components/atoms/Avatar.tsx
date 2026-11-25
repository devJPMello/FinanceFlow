import clsx from 'clsx';

export function Avatar({ name, className }: { name?: string | null; className?: string }) {
  const initials = (name ?? '?').split(' ').filter(Boolean).slice(0, 2).map((p) => p[0]?.toUpperCase()).join('');
  return (
    <span
      aria-hidden
      className={clsx('inline-flex h-9 w-9 items-center justify-center rounded-full bg-gradient-to-br from-brand-400 to-brand-700 text-xs font-semibold text-white', className)}
    >
      {initials}
    </span>
  );
}
