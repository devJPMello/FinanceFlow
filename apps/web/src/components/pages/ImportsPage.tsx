import { FileSpreadsheet, Undo2 } from 'lucide-react';
import { formatDate } from '@/lib/format';
import { useImports, useRevertImport } from '@/features/hooks';
import { Badge } from '../atoms/Badge';
import { Button } from '../atoms/Button';
import { Card, SectionTitle } from '../atoms/Typography';
import { confirmDialog } from '../molecules/ConfirmHost';
import { PageHeader } from '../molecules/PageHeader';
import { ImportWizard } from '../organisms/ImportWizard';

const TONE = { CONFIRMED: 'success', REVERTED: 'neutral', MAPPED: 'warning', UPLOADED: 'neutral' } as const;
const LABEL = { CONFIRMED: 'Importada', REVERTED: 'Desfeita', MAPPED: 'Em revisão', UPLOADED: 'Enviada' } as const;

export function ImportsPage() {
  const { data = [] } = useImports();
  const revert = useRevertImport();
  return (
    <>
      <PageHeader title="Importar planilha" subtitle="Traga seu extrato em CSV, XLSX, XLS ou OFX — nós cuidamos do resto." />
      <ImportWizard />
      <Card>
        <SectionTitle>Histórico de importações</SectionTitle>
        {data.length === 0 ? <p className="text-sm text-slate-500">Nenhuma importação ainda.</p> : (
          <ul className="divide-y divide-slate-100 text-sm dark:divide-slate-800">
            {data.map((i) => (
              <li key={i.id} className="flex flex-wrap items-center justify-between gap-2 py-3">
                <span className="flex items-center gap-3">
                  <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-brand-50 text-brand-600 dark:bg-brand-500/15"><FileSpreadsheet className="h-4 w-4" /></span>
                  <span><span className="font-medium">{i.fileName}</span><span className="block text-xs text-slate-500">{i.totalRows} linhas · {formatDate(i.createdAt)}</span></span>
                </span>
                <span className="flex items-center gap-2">
                  <Badge tone={TONE[i.status as keyof typeof TONE]}>{LABEL[i.status as keyof typeof LABEL]}</Badge>
                  {i.status === 'CONFIRMED' && (
                    <Button variant="ghost" size="sm" onClick={async () => (await confirmDialog({ title: 'Desfazer importação', message: 'As transações criadas por este arquivo serão removidas.', confirmLabel: 'Desfazer' })) && revert.mutate(i.id)}>
                      <Undo2 className="h-4 w-4" />Desfazer
                    </Button>
                  )}
                </span>
              </li>
            ))}
          </ul>
        )}
      </Card>
    </>
  );
}
