import { Download, Plus, Search, X } from 'lucide-react';
import { useEffect, useState } from 'react';
import { currentMonth, monthBounds } from '@/lib/format';
import { downloadTransactionsCsv, useAccounts, useBulkCategory, useCategories, useDeleteTransaction, useTags, useTransactions } from '@/features/hooks';
import type { Transaction, TxFilters } from '@/features/types';
import { Button, IconButton } from '../atoms/Button';
import { Input, Select } from '../atoms/Input';
import { Money } from '../atoms/Money';
import { Skeleton } from '../atoms/Skeleton';
import { Card } from '../atoms/Typography';
import { confirmDialog } from '../molecules/ConfirmHost';
import { EmptyState } from '../molecules/EmptyState';
import { Modal } from '../molecules/Modal';
import { MonthSwitcher } from '../molecules/MonthSwitcher';
import { PageHeader } from '../molecules/PageHeader';
import { TransactionForm } from '../organisms/TransactionForm';
import { TransactionTable } from '../organisms/TransactionTable';

export function TransactionsPage() {
  const [month, setMonth] = useState(currentMonth());
  const [filters, setFilters] = useState<TxFilters>({ page: 1, pageSize: 15 });
  const [search, setSearch] = useState('');
  const [editing, setEditing] = useState<Transaction | null>(null);
  const [formOpen, setFormOpen] = useState(false);
  const [selected, setSelected] = useState<Set<string>>(new Set());

  const query: TxFilters = { ...filters, ...monthBounds(month) };
  const { data, isLoading } = useTransactions(query);
  const { data: accounts = [] } = useAccounts();
  const { data: categories = [] } = useCategories();
  const { data: tags = [] } = useTags();
  const del = useDeleteTransaction();
  const bulk = useBulkCategory();

  // debounce da busca
  useEffect(() => {
    const t = setTimeout(() => { setFilters((f) => ({ ...f, q: search || undefined, page: 1 })); setSelected(new Set()); }, 300);
    return () => clearTimeout(t);
  }, [search]);

  const set = (p: Partial<TxFilters>) => { setFilters((f) => ({ ...f, ...p, page: 1 })); setSelected(new Set()); };
  const items = data?.items ?? [];
  const pages = data ? Math.max(1, Math.ceil(data.total / data.pageSize)) : 1;
  const page = filters.page ?? 1;
  const hasFilters = !!(filters.q || filters.accountId || filters.categoryId || filters.type || filters.tag);
  const editingTx = editing ? items.find((t) => t.id === editing.id) ?? editing : null;

  const askDelete = async (t: Transaction) => {
    if (await confirmDialog({ title: 'Excluir transação', message: `Excluir “${t.description}”? Esta ação não pode ser desfeita.`, confirmLabel: 'Excluir' })) del.mutate(t.id);
  };

  return (
    <>
      <PageHeader
        title="Transações"
        subtitle="Todas as suas receitas e despesas em um só lugar."
        actions={
          <>
            <Button variant="secondary" onClick={() => downloadTransactionsCsv(query)}><Download className="h-4 w-4" />Exportar</Button>
            <Button onClick={() => { setEditing(null); setFormOpen(true); }}><Plus className="h-4 w-4" />Nova transação</Button>
          </>
        }
      />

      <Card className="space-y-4 !p-4">
        <div className="flex flex-wrap items-center gap-3">
          <MonthSwitcher value={month} onChange={(m) => { setMonth(m); set({}); }} />
          <div className="min-w-48 flex-1">
            <Input type="search" aria-label="Buscar" placeholder="Buscar por descrição…" icon={<Search className="h-4 w-4" />} value={search} onChange={(e) => setSearch(e.target.value)} />
          </div>
        </div>
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          <Select aria-label="Conta" value={filters.accountId ?? ''} onChange={(e) => set({ accountId: e.target.value || undefined })}>
            <option value="">Todas as contas</option>{accounts.map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}
          </Select>
          <Select aria-label="Categoria" value={filters.categoryId ?? ''} onChange={(e) => set({ categoryId: e.target.value || undefined })}>
            <option value="">Todas as categorias</option>{categories.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
          </Select>
          <Select aria-label="Tipo" value={filters.type ?? ''} onChange={(e) => set({ type: e.target.value || undefined })}>
            <option value="">Receitas e despesas</option><option value="INCOME">Só receitas</option><option value="EXPENSE">Só despesas</option>
          </Select>
          <Select aria-label="Tag" value={filters.tag ?? ''} onChange={(e) => set({ tag: e.target.value || undefined })}>
            <option value="">Todas as tags</option>{tags.map((t) => <option key={t} value={t}>#{t}</option>)}
          </Select>
        </div>
        {hasFilters && (
          <button className="flex items-center gap-1 text-sm font-medium text-brand-600 hover:underline" onClick={() => { setSearch(''); setFilters({ page: 1, pageSize: 15 }); }}>
            <X className="h-3.5 w-3.5" />Limpar filtros
          </button>
        )}
      </Card>

      {data && (
        <div className="grid gap-3 sm:grid-cols-3">
          {[
            ['Receitas', <Money key="i" value={data.totals.income} type="INCOME" />],
            ['Despesas', <Money key="e" value={data.totals.expense} type="EXPENSE" />],
            ['Saldo', <Money key="s" value={data.totals.income - data.totals.expense} />],
          ].map(([label, value]) => (
            <div key={label as string} className="surface px-4 py-3">
              <p className="text-xs text-slate-500">{label}</p>
              <p className="text-base font-bold sm:text-lg">{value}</p>
            </div>
          ))}
        </div>
      )}

      {selected.size > 0 && (
        <div className="flex flex-wrap items-center gap-3 rounded-2xl bg-brand-600 p-3 text-white shadow-pop animate-slide-up">
          <span className="text-sm font-medium">{selected.size} selecionada(s)</span>
          <Select aria-label="Categoria em lote" className="!w-52 !py-1.5 text-slate-900" defaultValue="" onChange={(e) => {
            if (!e.target.value) return;
            bulk.mutate({ ids: [...selected], categoryId: e.target.value === 'none' ? null : e.target.value }, { onSuccess: () => setSelected(new Set()) });
          }}>
            <option value="">Aplicar categoria…</option><option value="none">Sem categoria</option>
            {categories.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
          </Select>
          <IconButton label="Limpar seleção" className="ml-auto !text-white hover:!bg-white/15" onClick={() => setSelected(new Set())}><X className="h-4 w-4" /></IconButton>
        </div>
      )}

      {isLoading ? (
        <div className="surface space-y-3 p-4">{[0, 1, 2, 3, 4].map((i) => <Skeleton key={i} className="h-12 w-full" />)}</div>
      ) : items.length === 0 ? (
        <EmptyState
          title={hasFilters ? 'Nada encontrado com esses filtros' : 'Nenhuma transação neste mês'}
          description={hasFilters ? 'Tente remover alguns filtros.' : 'Adicione uma transação ou importe sua planilha.'}
          action={!hasFilters && <Button onClick={() => { setEditing(null); setFormOpen(true); }}><Plus className="h-4 w-4" />Nova transação</Button>}
        />
      ) : (
        <TransactionTable
          items={items} selected={selected}
          onToggle={(id) => setSelected((s) => { const n = new Set(s); if (n.has(id)) n.delete(id); else n.add(id); return n; })}
          onToggleAll={() => setSelected((s) => (items.every((t) => s.has(t.id)) ? new Set() : new Set(items.map((t) => t.id))))}
          onEdit={(t) => { setEditing(t); setFormOpen(true); }}
          onDelete={askDelete}
        />
      )}

      <div className="flex items-center justify-between text-sm text-slate-500">
        <span>{data?.total ?? 0} transações</span>
        <div className="flex items-center gap-2">
          <Button variant="secondary" size="sm" disabled={page <= 1} onClick={() => setFilters((f) => ({ ...f, page: page - 1 }))}>Anterior</Button>
          <span>{page} / {pages}</span>
          <Button variant="secondary" size="sm" disabled={page >= pages} onClick={() => setFilters((f) => ({ ...f, page: page + 1 }))}>Próxima</Button>
        </div>
      </div>

      <Modal open={formOpen} title={editing ? 'Editar transação' : 'Nova transação'} onClose={() => setFormOpen(false)}>
        <TransactionForm key={editing?.id ?? 'new'} transaction={editingTx} onDone={() => setFormOpen(false)} />
      </Modal>
    </>
  );
}
