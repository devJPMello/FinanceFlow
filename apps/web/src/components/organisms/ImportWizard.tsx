import clsx from 'clsx';
import { AlertTriangle, ArrowLeft, ArrowRight, Check, CheckCircle2, Copy, Sparkles } from 'lucide-react';
import { useState } from 'react';
import { Link } from 'react-router-dom';
import { formatDate } from '@/lib/format';
import {
  useAccounts, useApplyMapping, useCategories, useConfirmImport, useImportDetail, usePatchImportRow, useUploadImport,
} from '@/features/hooks';
import type { ImportMappingInput, ImportUpload } from '@/features/types';
import { Badge } from '../atoms/Badge';
import { Button } from '../atoms/Button';
import { Select } from '../atoms/Input';
import { Money } from '../atoms/Money';
import { Skeleton } from '../atoms/Skeleton';
import { Card, SectionTitle } from '../atoms/Typography';
import { FileDropzone } from '../molecules/FileDropzone';
import { FormField } from '../molecules/FormField';

const STEPS = ['Arquivo', 'Mapeamento', 'Revisão', 'Concluído'];

function Stepper({ step }: { step: number }) {
  return (
    <ol className="flex items-center" aria-label="Etapas da importação">
      {STEPS.map((s, i) => (
        <li key={s} aria-current={i === step ? 'step' : undefined} className={clsx('flex items-center', i < STEPS.length - 1 && 'flex-1')}>
          <span className="flex items-center gap-2">
            <span className={clsx('flex h-8 w-8 items-center justify-center rounded-full text-sm font-semibold transition-colors',
              i < step ? 'bg-emerald-500 text-white' : i === step ? 'bg-brand-600 text-white shadow-md shadow-brand-600/30' : 'bg-slate-200 text-slate-500 dark:bg-slate-800')}>
              {i < step ? <Check className="h-4 w-4" /> : i + 1}
            </span>
            <span className={clsx('hidden text-sm font-medium sm:inline', i === step ? 'text-slate-900 dark:text-slate-100' : 'text-slate-400')}>{s}</span>
          </span>
          {i < STEPS.length - 1 && <span className={clsx('mx-3 h-0.5 flex-1 rounded', i < step ? 'bg-emerald-500' : 'bg-slate-200 dark:bg-slate-800')} />}
        </li>
      ))}
    </ol>
  );
}

export function ImportWizard() {
  const [step, setStep] = useState(0);
  const [upload, setUpload] = useState<ImportUpload | null>(null);
  const [result, setResult] = useState<number | null>(null);
  const uploadMut = useUploadImport();

  return (
    <div className="space-y-6">
      <Card className="!py-4"><Stepper step={step} /></Card>
      {step === 0 && (
        <FileDropzone loading={uploadMut.isPending} onFile={(f) => uploadMut.mutate(f, { onSuccess: (u) => { setUpload(u); setStep(1); } })} />
      )}
      {step === 1 && upload && <MappingStep upload={upload} onBack={() => setStep(0)} onDone={() => setStep(2)} />}
      {step === 2 && upload && <ReviewStep id={upload.id} onBack={() => setStep(1)} onDone={(n) => { setResult(n); setStep(3); }} />}
      {step === 3 && (
        <Card className="flex animate-slide-up flex-col items-center gap-4 py-14 text-center">
          <span className="flex h-16 w-16 items-center justify-center rounded-full bg-emerald-50 text-emerald-600 dark:bg-emerald-500/15"><CheckCircle2 className="h-9 w-9" /></span>
          <div>
            <p className="text-2xl font-bold">{result} transações importadas!</p>
            <p className="mt-1 text-sm text-slate-500">Elas já aparecem no seu dashboard e nos relatórios.</p>
          </div>
          <div className="flex gap-2">
            <Link to="/transactions"><Button>Ver transações</Button></Link>
            <Button variant="secondary" onClick={() => { setUpload(null); setStep(0); }}>Importar outro arquivo</Button>
          </div>
        </Card>
      )}
    </div>
  );
}

function MappingStep({ upload, onBack, onDone }: { upload: ImportUpload; onBack: () => void; onDone: () => void }) {
  const { data: accounts = [] } = useAccounts();
  const apply = useApplyMapping(upload.id);
  const s = upload.suggestedMapping;
  const [accountId, setAccountId] = useState('');
  const [split, setSplit] = useState(!!s.credit || !!s.debit);
  const [m, setM] = useState<Partial<ImportMappingInput>>({ dateFormat: 'DD/MM/YYYY', decimal: ',', ...s });
  const set = <K extends keyof ImportMappingInput>(k: K, v: ImportMappingInput[K] | undefined) => setM((p) => ({ ...p, [k]: v }));
  const cols = (
    <>
      <option value="">Selecione…</option>
      {upload.columns.map((c) => <option key={c} value={c}>{c}</option>)}
    </>
  );
  const valid = accountId && m.date && m.description && (split ? m.credit || m.debit : m.amount);
  const autoDetected = !!(s.date && s.description && s.amount);
  const highlighted = (col: string) => m.date === col || m.description === col || m.amount === col || m.credit === col || m.debit === col;

  return (
    <div className="grid gap-6 xl:grid-cols-5">
      <Card className="min-w-0 xl:col-span-3">
        <SectionTitle action={<Badge tone="info">{upload.totalRows} linhas</Badge>}>Prévia de {upload.fileName}</SectionTitle>
        <div className="overflow-x-auto rounded-xl border border-slate-100 dark:border-slate-800">
          <table className="w-full text-left text-sm">
            <thead>
              <tr>{upload.columns.map((c) => (
                <th key={c} className={clsx('whitespace-nowrap px-3 py-2 text-xs font-semibold uppercase', highlighted(c) ? 'bg-brand-50 text-brand-700 dark:bg-brand-500/15' : 'bg-slate-50 text-slate-500 dark:bg-slate-800/40')}>{c}</th>
              ))}</tr>
            </thead>
            <tbody>
              {upload.sample.map((r, i) => (
                <tr key={i} className="border-t border-slate-100 dark:border-slate-800">
                  {upload.columns.map((c) => <td key={c} className="whitespace-nowrap px-3 py-2">{r[c]}</td>)}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>

      <Card className="space-y-4 xl:col-span-2">
        <SectionTitle>Mapeie as colunas</SectionTitle>
        {autoDetected && (
          <p className="flex items-center gap-2 rounded-xl bg-brand-50 p-3 text-sm text-brand-700 dark:bg-brand-500/15 dark:text-brand-200"><Sparkles className="h-4 w-4 shrink-0" />Detectamos as colunas automaticamente. Confira antes de processar.</p>
        )}
        <FormField label="Conta de destino">
          <Select value={accountId} onChange={(e) => setAccountId(e.target.value)}>
            <option value="">Selecione…</option>{accounts.map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}
          </Select>
        </FormField>
        <FormField label="Coluna de data"><Select value={m.date ?? ''} onChange={(e) => set('date', e.target.value)}>{cols}</Select></FormField>
        <FormField label="Coluna de descrição"><Select value={m.description ?? ''} onChange={(e) => set('description', e.target.value)}>{cols}</Select></FormField>
        {!split ? (
          <FormField label="Coluna de valor" hint="Negativo = despesa, positivo = receita"><Select value={m.amount ?? ''} onChange={(e) => set('amount', e.target.value)}>{cols}</Select></FormField>
        ) : (
          <>
            <FormField label="Coluna de crédito (receita)"><Select value={m.credit ?? ''} onChange={(e) => set('credit', e.target.value || undefined)}>{cols}</Select></FormField>
            <FormField label="Coluna de débito (despesa)"><Select value={m.debit ?? ''} onChange={(e) => set('debit', e.target.value || undefined)}>{cols}</Select></FormField>
          </>
        )}
        <div className="grid grid-cols-2 gap-3">
          <FormField label="Formato da data">
            <Select value={m.dateFormat} onChange={(e) => set('dateFormat', e.target.value as ImportMappingInput['dateFormat'])}>
              <option value="DD/MM/YYYY">DD/MM/AAAA</option><option value="YYYY-MM-DD">AAAA-MM-DD</option><option value="MM/DD/YYYY">MM/DD/AAAA</option>
            </Select>
          </FormField>
          <FormField label="Decimal">
            <Select value={m.decimal} onChange={(e) => set('decimal', e.target.value as ',' | '.')}>
              <option value=",">Vírgula (1,50)</option><option value=".">Ponto (1.50)</option>
            </Select>
          </FormField>
        </div>
        <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={split} onChange={(e) => setSplit(e.target.checked)} />Crédito e débito em colunas separadas</label>
        {!split && <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={!!m.invertSign} onChange={(e) => set('invertSign', e.target.checked)} />Inverter sinal (despesas vêm positivas)</label>}
        <div className="flex justify-between pt-2">
          <Button variant="secondary" onClick={onBack}><ArrowLeft className="h-4 w-4" />Voltar</Button>
          <Button
            disabled={!valid} loading={apply.isPending}
            onClick={() => {
              const mapping = { ...m, ...(split ? { amount: undefined } : { credit: undefined, debit: undefined }) } as ImportMappingInput;
              apply.mutate({ accountId, mapping }, { onSuccess: onDone });
            }}
          >Processar<ArrowRight className="h-4 w-4" /></Button>
        </div>
      </Card>
    </div>
  );
}

const STATUS_TONE = { PENDING: 'info', DUPLICATE: 'warning', ERROR: 'danger', IMPORTED: 'success' } as const;
const STATUS_LABEL = { PENDING: 'Nova', DUPLICATE: 'Duplicada', ERROR: 'Erro', IMPORTED: 'Importada' } as const;

function ReviewStep({ id, onBack, onDone }: { id: string; onBack: () => void; onDone: (n: number) => void }) {
  const { data } = useImportDetail(id);
  const { data: categories = [] } = useCategories();
  const patch = usePatchImportRow(id);
  const confirm = useConfirmImport(id);
  if (!data) return <Skeleton className="h-64 w-full !rounded-2xl" />;
  const toImport = data.rows.filter((r) => r.status === 'PENDING' && !r.skip).length;

  return (
    <div className="space-y-4">
      <div className="grid gap-3 sm:grid-cols-3">
        <div className="surface flex items-center gap-3 p-4"><span className="flex h-10 w-10 items-center justify-center rounded-xl bg-brand-50 text-brand-600 dark:bg-brand-500/15"><Check className="h-5 w-5" /></span><div><p className="text-2xl font-bold">{data.counts.pending}</p><p className="text-xs text-slate-500">novas transações</p></div></div>
        <div className="surface flex items-center gap-3 p-4"><span className="flex h-10 w-10 items-center justify-center rounded-xl bg-amber-50 text-amber-600 dark:bg-amber-500/15"><Copy className="h-5 w-5" /></span><div><p className="text-2xl font-bold">{data.counts.duplicate}</p><p className="text-xs text-slate-500">duplicadas (ignoradas)</p></div></div>
        <div className="surface flex items-center gap-3 p-4"><span className="flex h-10 w-10 items-center justify-center rounded-xl bg-rose-50 text-rose-600 dark:bg-rose-500/15"><AlertTriangle className="h-5 w-5" /></span><div><p className="text-2xl font-bold">{data.counts.error}</p><p className="text-xs text-slate-500">com erro</p></div></div>
      </div>

      <div className="surface hidden max-h-[30rem] overflow-auto md:block">
        <table className="w-full text-left text-sm">
          <thead className="sticky top-0 z-10 bg-slate-50 text-xs uppercase text-slate-500 dark:bg-slate-800">
            <tr><th className="px-3 py-2.5">Importar</th><th className="px-3 py-2.5">Status</th><th className="px-3 py-2.5">Data</th><th className="px-3 py-2.5">Descrição</th><th className="px-3 py-2.5">Categoria</th><th className="px-3 py-2.5 text-right">Valor</th></tr>
          </thead>
          <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
            {data.rows.map((r) => (
              <tr key={r.id} className={clsx(r.skip && 'opacity-50')}>
                <td className="px-3 py-2"><input type="checkbox" aria-label={`Importar linha ${r.index + 1}`} disabled={r.status === 'ERROR'} checked={!r.skip} onChange={(e) => patch.mutate({ rowId: r.id, skip: !e.target.checked })} /></td>
                <td className="px-3 py-2"><Badge tone={STATUS_TONE[r.status]}>{STATUS_LABEL[r.status]}</Badge>{r.error && <span className="ml-2 text-xs text-rose-600">{r.error}</span>}</td>
                <td className="whitespace-nowrap px-3 py-2">{r.date ? formatDate(r.date) : '—'}</td>
                <td className="px-3 py-2">{r.description}</td>
                <td className="px-3 py-2">
                  {r.type && (
                    <Select aria-label={`Categoria da linha ${r.index + 1}`} className="!w-36 !py-1.5" value={r.categoryId ?? ''} onChange={(e) => patch.mutate({ rowId: r.id, categoryId: e.target.value || null })}>
                      <option value="">Sem categoria</option>
                      {categories.filter((c) => c.kind === r.type).map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
                    </Select>
                  )}
                </td>
                <td className="px-3 py-2 text-right font-medium">{r.amount != null && r.type && <Money value={r.amount} type={r.type} />}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {/* Celular: um cartão por linha, com tudo visível sem rolagem lateral */}
      <ul className="space-y-2 md:hidden">
        {data.rows.map((r) => (
          <li key={r.id} className={clsx('surface space-y-3 p-3', r.skip && 'opacity-50')}>
            <div className="flex items-start gap-3">
              <input type="checkbox" className="mt-1 h-4 w-4" aria-label={`Importar linha ${r.index + 1}`} disabled={r.status === 'ERROR'} checked={!r.skip} onChange={(e) => patch.mutate({ rowId: r.id, skip: !e.target.checked })} />
              <div className="min-w-0 flex-1">
                <p className="break-words font-medium">{r.description || '—'}</p>
                <p className="mt-0.5 flex flex-wrap items-center gap-2 text-xs text-slate-500">
                  {r.date ? formatDate(r.date) : '—'}
                  <Badge tone={STATUS_TONE[r.status]}>{STATUS_LABEL[r.status]}</Badge>
                  {r.error && <span className="text-rose-600">{r.error}</span>}
                </p>
              </div>
              <span className="shrink-0 font-semibold">{r.amount != null && r.type && <Money value={r.amount} type={r.type} />}</span>
            </div>
            {r.type && (
              <Select aria-label={`Categoria da linha ${r.index + 1}`} className="!py-2" value={r.categoryId ?? ''} onChange={(e) => patch.mutate({ rowId: r.id, categoryId: e.target.value || null })}>
                <option value="">Sem categoria</option>
                {categories.filter((c) => c.kind === r.type).map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
              </Select>
            )}
          </li>
        ))}
      </ul>
      <div className="flex justify-between">
        <Button variant="secondary" onClick={onBack}><ArrowLeft className="h-4 w-4" />Voltar</Button>
        <Button size="lg" disabled={toImport === 0} loading={confirm.isPending} onClick={() => confirm.mutate(undefined, { onSuccess: (r) => onDone(r.imported) })}>
          Importar {toImport} transações
        </Button>
      </div>
    </div>
  );
}
