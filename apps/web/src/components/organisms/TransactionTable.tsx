import clsx from 'clsx';
import { ArrowDownLeft, ArrowUpRight, Paperclip, Pencil, Repeat, Trash2 } from 'lucide-react';
import { formatDate } from '@/lib/format';
import type { Transaction } from '@/features/types';
import { IconButton } from '../atoms/Button';
import { Money } from '../atoms/Money';
import { CategoryTag } from '../molecules/CategoryTag';

interface Props {
  items: Transaction[];
  selected: Set<string>;
  onToggle: (id: string) => void;
  onToggleAll: () => void;
  onEdit: (t: Transaction) => void;
  onDelete: (t: Transaction) => void;
}

function TypeIcon({ type }: { type: Transaction['type'] }) {
  const income = type === 'INCOME';
  return (
    <span className={clsx('flex h-9 w-9 shrink-0 items-center justify-center rounded-xl', income ? 'bg-emerald-50 text-emerald-600 dark:bg-emerald-500/15' : 'bg-rose-50 text-rose-600 dark:bg-rose-500/15')}>
      {income ? <ArrowUpRight className="h-4 w-4" /> : <ArrowDownLeft className="h-4 w-4" />}
    </span>
  );
}

/** Selos auxiliares: parcela, recorrência, anexos e tags. */
function Extras({ t }: { t: Transaction }) {
  const chips = [
    t.installmentTotal ? <span key="i" className="rounded-full bg-amber-50 px-2 py-0.5 text-[11px] font-medium text-amber-700 dark:bg-amber-500/15 dark:text-amber-300">{t.installmentNo}/{t.installmentTotal}</span> : null,
    t.recurringId ? <span key="r" title="Recorrente" className="text-slate-400"><Repeat className="h-3.5 w-3.5" /></span> : null,
    t.attachments?.length ? <span key="a" title={`${t.attachments.length} anexo(s)`} className="text-slate-400"><Paperclip className="h-3.5 w-3.5" /></span> : null,
    ...(t.tags ?? []).map((g) => <span key={g} className="rounded-full bg-slate-100 px-2 py-0.5 text-[11px] text-slate-600 dark:bg-slate-800 dark:text-slate-300">#{g}</span>),
  ].filter(Boolean);
  return chips.length ? <span className="flex flex-wrap items-center gap-1.5">{chips}</span> : null;
}

export function TransactionTable({ items, selected, onToggle, onToggleAll, onEdit, onDelete }: Props) {
  const allSelected = items.length > 0 && items.every((t) => selected.has(t.id));
  return (
    <>
      {/* Desktop: tabela */}
      <div className="surface hidden overflow-hidden md:block">
        <table className="w-full text-left text-sm">
          <thead className="bg-slate-50/80 text-xs font-medium uppercase tracking-wide text-slate-500 dark:bg-slate-800/40">
            <tr>
              <th className="w-12 px-4 py-3"><input type="checkbox" aria-label="Selecionar todas" checked={allSelected} onChange={onToggleAll} /></th>
              <th className="px-2 py-3">Descrição</th>
              <th className="px-4 py-3">Categoria</th>
              <th className="hidden px-4 py-3 xl:table-cell">Conta</th>
              <th className="px-4 py-3">Data</th>
              <th className="px-4 py-3 text-right">Valor</th>
              <th className="w-24 px-4 py-3"><span className="sr-only">Ações</span></th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
            {items.map((t) => (
              <tr key={t.id} className={clsx('group transition-colors hover:bg-slate-50 dark:hover:bg-slate-800/40', selected.has(t.id) && 'bg-brand-50/50 dark:bg-brand-500/10')}>
                <td className="px-4 py-3"><input type="checkbox" aria-label={`Selecionar ${t.description}`} checked={selected.has(t.id)} onChange={() => onToggle(t.id)} /></td>
                <td className="px-2 py-3"><div className="flex items-center gap-3"><TypeIcon type={t.type} /><div className="min-w-0"><span className="font-medium">{t.description}</span><Extras t={t} /></div></div></td>
                <td className="px-4 py-3"><CategoryTag name={t.category?.name} color={t.category?.color} /></td>
                <td className="hidden whitespace-nowrap px-4 py-3 text-slate-500 xl:table-cell">{t.account?.name}</td>
                <td className="whitespace-nowrap px-4 py-3 text-slate-500">{formatDate(t.date)}</td>
                <td className="px-4 py-3 text-right font-semibold"><Money value={t.amount} type={t.type} /></td>
                <td className="px-4 py-3">
                  <div className="flex justify-end opacity-0 transition-opacity focus-within:opacity-100 group-hover:opacity-100">
                    <IconButton label={`Editar ${t.description}`} onClick={() => onEdit(t)}><Pencil className="h-4 w-4" /></IconButton>
                    <IconButton label={`Excluir ${t.description}`} onClick={() => onDelete(t)}><Trash2 className="h-4 w-4" /></IconButton>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Mobile: cartões */}
      <ul className="space-y-2 md:hidden">
        {items.map((t) => (
          <li key={t.id} className="surface flex items-center gap-3 p-3">
            <TypeIcon type={t.type} />
            <button className="min-w-0 flex-1 text-left" onClick={() => onEdit(t)} aria-label={`Editar ${t.description}`}>
              <p className="truncate font-medium">{t.description}</p>
              <p className="text-xs text-slate-500">{formatDate(t.date)} · {t.category?.name ?? 'Sem categoria'}</p>
              <Extras t={t} />
            </button>
            <div className="flex flex-col items-end gap-1">
              <span className="font-semibold"><Money value={t.amount} type={t.type} /></span>
              <button className="text-xs text-slate-400 hover:text-rose-600" onClick={() => onDelete(t)} aria-label={`Excluir ${t.description}`}>Excluir</button>
            </div>
          </li>
        ))}
      </ul>
    </>
  );
}
