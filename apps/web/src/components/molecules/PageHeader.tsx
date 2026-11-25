import { ReactNode } from 'react';
import { Heading, Text } from '../atoms/Typography';

export function PageHeader({ title, subtitle, actions }: { title: string; subtitle?: string; actions?: ReactNode }) {
  return (
    <div className="flex flex-wrap items-end justify-between gap-3">
      <div>
        <Heading>{title}</Heading>
        {subtitle && <Text muted className="mt-1">{subtitle}</Text>}
      </div>
      {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
    </div>
  );
}
