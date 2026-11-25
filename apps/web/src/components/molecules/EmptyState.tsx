import { Inbox } from 'lucide-react';
import { ReactNode } from 'react';
import { Text } from '../atoms/Typography';

interface Props { title: string; description?: string; action?: ReactNode; icon?: ReactNode }

export function EmptyState({ title, description, action, icon }: Props) {
  return (
    <div className="flex flex-col items-center gap-3 rounded-2xl border border-dashed border-slate-300 bg-white/50 p-10 text-center dark:border-slate-700 dark:bg-transparent">
      <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-brand-50 text-brand-600 dark:bg-brand-500/15">
        {icon ?? <Inbox className="h-6 w-6" />}
      </span>
      <p className="font-semibold">{title}</p>
      {description && <Text muted className="max-w-sm">{description}</Text>}
      {action}
    </div>
  );
}
