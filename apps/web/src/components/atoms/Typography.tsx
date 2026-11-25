import clsx from 'clsx';
import { HTMLAttributes } from 'react';

export function Heading({ className, ...p }: HTMLAttributes<HTMLHeadingElement>) {
  return <h1 className={clsx('text-2xl font-bold tracking-tight sm:text-3xl', className)} {...p} />;
}

export function Text({ muted, className, ...p }: HTMLAttributes<HTMLParagraphElement> & { muted?: boolean }) {
  return <p className={clsx('text-sm', muted && 'text-slate-500 dark:text-slate-400', className)} {...p} />;
}

export function ColorDot({ color, className }: { color: string; className?: string }) {
  return <span aria-hidden className={clsx('inline-block h-2.5 w-2.5 shrink-0 rounded-full', className)} style={{ backgroundColor: color }} />;
}

export function Card({ className, ...p }: HTMLAttributes<HTMLDivElement>) {
  return <div className={clsx('surface p-5', className)} {...p} />;
}

export function SectionTitle({ children, action }: { children: React.ReactNode; action?: React.ReactNode }) {
  return (
    <div className="mb-4 flex items-center justify-between gap-2">
      <h2 className="text-base font-semibold">{children}</h2>
      {action}
    </div>
  );
}
