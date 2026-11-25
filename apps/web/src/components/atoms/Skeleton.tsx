import clsx from 'clsx';

export function Skeleton({ className }: { className?: string }) {
  return <div aria-hidden className={clsx('skeleton', className ?? 'h-4 w-full')} />;
}
