import { useCallback, useEffect, useState, useMemo, useRef, type ReactNode } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import api from '../lib/api';
import { Transaction, TransactionType, Category } from '../types';
import {
  Plus,
  Edit,
  Trash2,
  Filter,
  Search,
  Receipt,
  Download,
  ChevronUp,
  ChevronDown,
  Upload,
  Paperclip,
  X,
  Sparkles,
  GitMerge,
  Square,
  CheckSquare,
  Info,
} from 'lucide-react';
import toast from 'react-hot-toast';
import TransactionModal from '../components/TransactionModal';
import DeleteConfirmModal from '../components/DeleteConfirmModal';
import { formatCurrency, formatDate } from '../utils/format';
import {
  isValidMonthKey,
  monthKeyToDateRangeLocal,
  formatMonthKeyPt,
} from '../lib/periodContext';
import { getApiErrorWithRequestId } from '../lib/apiErrors';
import { TransactionsTableSkeleton } from '../components/LoadingSkeletons';

/** Cartões da página (importação, filtros, lista) — mesma hierarquia visual */
const TX_PAGE_CARD =
  'rounded-2xl border border-gray-200/70 bg-gradient-to-br from-white via-slate-50/25 to-slate-50/70 p-6 shadow-[0_1px_2px_rgba(15,23,42,0.04)]';

type TxListDensity = 'comfortable' | 'compact';

export default function Transactions() {
  const [searchParams, setSearchParams] = useSearchParams();
  const monthQuery = searchParams.get('month');

  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingTransaction, setEditingTransaction] = useState<Transaction | null>(null);
  const [deleteConfirm, setDeleteConfirm] = useState<{ id: string; description: string } | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [sortBy, setSortBy] = useState<{ field: string; order: 'asc' | 'desc' }>({
    field: 'date',
    order: 'desc',
  });
  const [pagination, setPagination] = useState({
    page: 1,
    limit: 50,
    total: 0,
    totalPages: 0,
  });
  const [filters, setFilters] = useState({
    type: '',
    startDate: '',
    endDate: '',
    categoryId: '',
    page: 1,
  });
  const [ofxExpenseCat, setOfxExpenseCat] = useState('');
  const [ofxIncomeCat, setOfxIncomeCat] = useState('');
  const [importBusy, setImportBusy] = useState(false);
  const [globalBalance, setGlobalBalance] = useState<number | null>(null);
  const [savedFilters, setSavedFilters] = useState<
    Array<{ id: string; name: string; filters: typeof filters; search: string }>
  >([]);
  const detailsRef = useRef<HTMLDetailsElement | null>(null);

  const openImportSection = useCallback(() => {
    const el = detailsRef.current;
    if (!el) return;
    el.open = true;
    requestAnimationFrame(() => {
      el.scrollIntoView({ behavior: 'smooth', block: 'start' });
    });
  }, []);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [batchCategoryId, setBatchCategoryId] = useState('');
  const [batchDeductible, setBatchDeductible] = useState<'unset' | 'true' | 'false'>('unset');
  const [batchNote, setBatchNote] = useState('');
  const [listDensity, setListDensity] = useState<TxListDensity>(() => {
    try {
      const v = localStorage.getItem('ff-tx-list-density');
      if (v === 'compact' || v === 'comfortable') return v;
    } catch {
      /* ignore */
    }
    return 'comfortable';
  });
  const [duplicateClusters, setDuplicateClusters] = useState<
    Array<{
      transactions: Array<{
        id: string;
        date: string;
        amount: number;
        description?: string | null;
        bankMemo?: string | null;
      }>;
    }>
  >([]);

  useEffect(() => {
    if (!isValidMonthKey(monthQuery)) return;
    const { startDate, endDate } = monthKeyToDateRangeLocal(monthQuery);
    setFilters((f) => {
      if (f.startDate === startDate && f.endDate === endDate) return f;
      return { ...f, startDate, endDate, page: 1 };
    });
  }, [monthQuery]);

  const loadTransactions = useCallback(async () => {
    try {
      setLoading(true);
      const params: Record<string, string | number> = {
        page: filters.page || 1,
        limit: 50,
      };
      if (filters.type) params.type = filters.type;
      if (filters.startDate) params.startDate = filters.startDate;
      if (filters.endDate) params.endDate = filters.endDate;
      if (filters.categoryId) params.categoryId = filters.categoryId;

      const response = await api.get('/transactions', { params });
      const body = response.data;
      const transactionsData = Array.isArray(body?.data) ? body.data : [];
      const validTransactions = transactionsData.filter((t: Transaction) => t && t.id);
      setTransactions(validTransactions);

      const pag = body?.pagination ?? body?.meta;
      if (pag && typeof pag.page === 'number') {
        setPagination({
          page: pag.page,
          limit: pag.limit ?? 50,
          total: pag.total ?? validTransactions.length,
          totalPages: pag.totalPages ?? 1,
        });
      } else {
        setPagination({
          page: 1,
          limit: 50,
          total: validTransactions.length,
          totalPages: 1,
        });
      }
    } catch (error: unknown) {
      console.error('Erro ao carregar transações:', error);
      toast.error(getApiErrorWithRequestId(error));
      setTransactions([]);
      setPagination({
        page: 1,
        limit: 50,
        total: 0,
        totalPages: 0,
      });
    } finally {
      setLoading(false);
    }
  }, [filters]);

  useEffect(() => {
    void loadTransactions();
  }, [filters, loadTransactions]);

  const fetchGlobalBalance = async () => {
    try {
      const { data } = await api.get<{ balance: number }>('/transactions/balance');
      setGlobalBalance(typeof data?.balance === 'number' ? data.balance : null);
    } catch {
      setGlobalBalance(null);
    }
  };

  const loadCategories = useCallback(async () => {
    try {
      const response = await api.get('/categories');
      // Suportar resposta paginada ou array direto
      const data = response.data?.data || response.data;
      setCategories(Array.isArray(data) ? data : []);
    } catch (error) {
      console.error('Erro ao carregar categorias:', error);
      setCategories([]);
    }
  }, []);

  useEffect(() => {
    void loadCategories();
    void fetchGlobalBalance();
    try {
      const raw = localStorage.getItem('ff-saved-transaction-filters');
      if (raw) {
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed)) setSavedFilters(parsed);
      }
    } catch {
      /* ignore invalid saved filters in localStorage */
    }
  }, [loadCategories]);

  const handleDelete = async (id: string) => {
    try {
      await api.delete(`/transactions/${id}`);
      toast.success('Transação excluída com sucesso');
      loadTransactions();
      fetchGlobalBalance();
    } catch (error: any) {
      toast.error(error.response?.data?.message || 'Erro ao excluir transação');
    }
  };

  const handleExport = () => {
    const csv = [
      ['Data', 'Descrição', 'Categoria', 'Tipo', 'Valor'].join(','),
      ...transactions
        .filter((t) => t && t.category)
        .map((t) =>
          [
            formatDate(t.date),
            (t.description || '').replace(/,/g, ' '),
            (t.category?.name || 'Sem categoria').replace(/,/g, ' '),
            t.type === 'INCOME' ? 'Receita' : 'Despesa',
            t.amount.toString(),
          ].join(',')
        ),
    ].join('\n');

    const blob = new Blob(['\ufeff' + csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `transacoes-${new Date().toISOString().split('T')[0]}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    toast.success('Transações exportadas com sucesso');
  };

  const sortedTransactions = [...transactions]
    .filter((t) => t && t.category) // Filtrar transações sem categoria
    .sort((a, b) => {
      let aVal: any = a[sortBy.field as keyof Transaction];
      let bVal: any = b[sortBy.field as keyof Transaction];

      if (sortBy.field === 'date') {
        aVal = new Date(aVal).getTime();
        bVal = new Date(bVal).getTime();
      } else if (sortBy.field === 'amount') {
        aVal = Number(aVal);
        bVal = Number(bVal);
      } else if (sortBy.field === 'description') {
        aVal = (aVal || '').toLowerCase();
        bVal = (bVal || '').toLowerCase();
      }

      if (sortBy.order === 'asc') {
        return aVal > bVal ? 1 : -1;
      } else {
        return aVal < bVal ? 1 : -1;
      }
    });

  const filteredTransactions = sortedTransactions.filter((t) => {
    if (!searchQuery.trim()) return true;
    const q = searchQuery.toLowerCase();
    const desc = (t.description || '').toLowerCase();
    const memo = (t.bankMemo || '').toLowerCase();
    return desc.includes(q) || memo.includes(q);
  });

  const pageTotals = useMemo(() => {
    let income = 0;
    let expense = 0;
    for (const t of filteredTransactions) {
      if (!t?.category) continue;
      const n = Number(t.amount);
      if (t.type === TransactionType.INCOME) income += n;
      else expense += n;
    }
    return { income, expense, net: income - expense };
  }, [filteredTransactions]);

  const txTableRows = useMemo(() => {
    type Row = { kind: 'day'; key: string; label: string } | { kind: 'tx'; t: Transaction };
    const list = filteredTransactions;
    if (sortBy.field !== 'date') {
      return list.map((t) => ({ kind: 'tx' as const, t }));
    }
    const out: Row[] = [];
    let prevKey = '';
    for (const t of list) {
      const dayKey = t.date.includes('T') ? t.date.split('T')[0]! : t.date.slice(0, 10);
      if (dayKey !== prevKey) {
        prevKey = dayKey;
        out.push({ kind: 'day', key: `d-${dayKey}`, label: formatDate(t.date) });
      }
      out.push({ kind: 'tx', t });
    }
    return out;
  }, [filteredTransactions, sortBy.field]);

  useEffect(() => {
    try {
      localStorage.setItem('ff-tx-list-density', listDensity);
    } catch {
      /* ignore */
    }
  }, [listDensity]);

  const hasActiveFilters =
    !!filters.type ||
    !!filters.startDate ||
    !!filters.endDate ||
    !!filters.categoryId ||
    !!searchQuery.trim();

  const stripMonthQuery = () => {
    setSearchParams(
      (prev) => {
        const next = new URLSearchParams(prev);
        next.delete('month');
        return next;
      },
      { replace: true },
    );
  };

  const clearAllFilters = () => {
    setSearchQuery('');
    setFilters({ type: '', startDate: '', endDate: '', categoryId: '', page: 1 });
    stripMonthQuery();
  };

  const saveCurrentFilter = () => {
    const name = window.prompt('Nome do filtro:');
    if (!name?.trim()) return;
    const item = {
      id: `sf-${Date.now()}`,
      name: name.trim(),
      filters: { ...filters, page: 1 },
      search: searchQuery,
    };
    const next = [item, ...savedFilters].slice(0, 12);
    setSavedFilters(next);
    localStorage.setItem('ff-saved-transaction-filters', JSON.stringify(next));
    toast.success('Filtro salvo');
  };

  const applySavedFilter = (id: string) => {
    const selected = savedFilters.find((f) => f.id === id);
    if (!selected) return;
    setFilters({ ...selected.filters, page: 1 });
    setSearchQuery(selected.search || '');
  };

  const removeSavedFilter = (id: string) => {
    const next = savedFilters.filter((f) => f.id !== id);
    setSavedFilters(next);
    localStorage.setItem('ff-saved-transaction-filters', JSON.stringify(next));
  };

  const handleSort = (field: string) => {
    setSortBy({
      field,
      order: sortBy.field === field && sortBy.order === 'desc' ? 'asc' : 'desc',
    });
  };

  const SortIcon = ({ field }: { field: string }) => {
    if (sortBy.field !== field) return null;
    return sortBy.order === 'asc' ? (
      <ChevronUp className="w-4 h-4 inline ml-1" />
    ) : (
      <ChevronDown className="w-4 h-4 inline ml-1" />
    );
  };

  const handleEdit = (transaction: Transaction) => {
    setEditingTransaction(transaction);
    setIsModalOpen(true);
  };

  useEffect(() => {
    const hash = window.location.hash || '';
    if (hash === '#new') {
      setIsModalOpen(true);
      window.history.replaceState(null, '', window.location.pathname + window.location.search);
      return;
    }
    if (hash === '#import') {
      if (detailsRef.current) detailsRef.current.open = true;
      window.history.replaceState(null, '', window.location.pathname + window.location.search);
      return;
    }
    if (!hash.startsWith('#tx=')) return;
    const txId = hash.replace('#tx=', '').trim();
    if (!txId) return;
    (async () => {
      try {
        const { data } = await api.get<Transaction>(`/transactions/${txId}`);
        setEditingTransaction(data);
        setIsModalOpen(true);
      } catch {
        toast.error('Não foi possível abrir a transação sugerida');
      } finally {
        window.history.replaceState(null, '', window.location.pathname + window.location.search);
      }
    })();
  }, []);

  const handleCloseModal = () => {
    setIsModalOpen(false);
    setEditingTransaction(null);
  };

  const handleSave = () => {
    loadTransactions();
    fetchGlobalBalance();
    handleCloseModal();
  };

  const appendImportDefaults = (fd: FormData) => {
    if (ofxExpenseCat) fd.append('defaultExpenseCategoryId', ofxExpenseCat);
    if (ofxIncomeCat) fd.append('defaultIncomeCategoryId', ofxIncomeCat);
  };

  const handleAiImportDirect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    setImportBusy(true);
    try {
      const fd = new FormData();
      fd.append('file', file);
      appendImportDefaults(fd);
      const { data } = await api.post<{
        imported: number;
        skipped: number;
        invalid?: number;
        totalParsed: number;
      }>('/transactions/import/ai', fd);
      const inv = data.invalid != null ? `, ${data.invalid} inválidas` : '';
      toast.success(
        `IA: ${data.imported} novas, ${data.skipped} ignoradas, ${data.totalParsed} lidas${inv}`,
      );
      loadTransactions();
      loadCategories();
      fetchGlobalBalance();
    } catch (err: any) {
      toast.error(err.response?.data?.message || 'Erro na importação com IA');
    } finally {
      setImportBusy(false);
    }
  };

  const toggleSelectRow = (id: string) => {
    setSelectedIds((prev) => {
      const n = new Set(prev);
      if (n.has(id)) n.delete(id);
      else n.add(id);
      return n;
    });
  };

  const toggleSelectAllOnPage = () => {
    const ids = filteredTransactions.map((t) => t.id);
    const allOn = ids.length > 0 && ids.every((id) => selectedIds.has(id));
    if (allOn) {
      setSelectedIds((prev) => {
        const n = new Set(prev);
        ids.forEach((id) => n.delete(id));
        return n;
      });
    } else {
      setSelectedIds((prev) => {
        const n = new Set(prev);
        ids.forEach((id) => n.add(id));
        return n;
      });
    }
  };

  const applyBatch = async () => {
    if (selectedIds.size === 0) return;
    if (!batchCategoryId && batchDeductible === 'unset' && !batchNote.trim()) {
      toast.error('Escolha categoria, marcação IR ou nota para aplicar em lote');
      return;
    }
    try {
      const body: Record<string, unknown> = {
        transactionIds: Array.from(selectedIds),
      };
      if (batchCategoryId) body.categoryId = batchCategoryId;
      if (batchDeductible !== 'unset') body.deductiblePotential = batchDeductible === 'true';
      if (batchNote.trim()) body.userNote = batchNote.trim();
      await api.patch('/transactions/batch', body);
      toast.success('Transações atualizadas em lote');
      setSelectedIds(new Set());
      setBatchCategoryId('');
      setBatchDeductible('unset');
      setBatchNote('');
      loadTransactions();
      fetchGlobalBalance();
    } catch (err: any) {
      toast.error(err.response?.data?.message || 'Erro no lote');
    }
  };

  const loadDuplicates = async () => {
    try {
      const { data } = await api.get<{
        clusters: typeof duplicateClusters;
      }>('/transactions/duplicates');
      setDuplicateClusters(Array.isArray(data?.clusters) ? data.clusters : []);
      toast.success('Duplicatas atualizadas');
    } catch (err: any) {
      toast.error(err.response?.data?.message || 'Erro ao carregar duplicatas');
    }
  };

  const mergeDuplicatePair = async (keepId: string, removeId: string) => {
    try {
      await api.post('/transactions/merge-duplicate', {
        keepTransactionId: keepId,
        removeTransactionId: removeId,
      });
      toast.success('Lançamentos fundidos');
      setDuplicateClusters((prev) =>
        prev
          .map((c) => ({
            transactions: c.transactions.filter((t) => t.id !== removeId),
          }))
          .filter((c) => c.transactions.length >= 2),
      );
      loadTransactions();
      fetchGlobalBalance();
    } catch (err: any) {
      toast.error(err.response?.data?.message || 'Erro ao fundir');
    }
  };

  const thPad = listDensity === 'compact' ? 'py-2 px-3' : 'py-4 px-6';
  const tdPad = listDensity === 'compact' ? 'py-2 px-3' : 'py-4 px-6';
  const thText = listDensity === 'compact' ? 'text-xs' : 'text-sm';
  const thCheck = listDensity === 'compact' ? 'py-2 px-2' : 'py-4 px-2';
  const descText = listDensity === 'compact' ? 'text-xs' : 'text-sm';
  const amtText = listDensity === 'compact' ? 'text-sm' : 'text-base';
  const thSticky =
    'sticky top-0 z-20 bg-slate-50/95 backdrop-blur-sm shadow-[0_1px_0_0_rgb(229_231_235)]';

  const importFileAccept =
    '.csv,text/csv,application/csv,.pdf,application/pdf,image/jpeg,image/png,image/webp,image/gif,.jpg,.jpeg,.png,.webp,.gif';

  return (
    <div className="space-y-5 animate-fade-in">
      <div className="pb-0.5">
        <h1 className="text-4xl font-bold text-gray-900 mb-2">Transações</h1>
        <p className="text-gray-600 text-lg">Criar, importar e revisar lançamentos</p>
      </div>

      <details
        ref={detailsRef}
        className={`group ${TX_PAGE_CARD} open:border-amber-200/60 transition-[border-color,box-shadow] duration-200`}
      >
        <summary className="flex cursor-pointer list-none items-center gap-3 py-0.5 [&::-webkit-details-marker]:hidden">
          <div className="p-2.5 bg-amber-100 rounded-xl shrink-0 border border-amber-200/60">
            <Upload className="w-5 h-5 text-amber-700" />
          </div>
          <div className="flex-1 min-w-0">
            <h2 className="text-lg font-bold text-gray-900">TaxVision · importação (IA)</h2>
            <p className="text-sm text-gray-500 mt-0.5">
              Um ficheiro (CSV, PDF ou imagem) — a IA extrai movimentos e sugere categoria e IR.
            </p>
          </div>
          <ChevronDown className="w-5 h-5 text-gray-400 shrink-0 transition-transform group-open:rotate-180" />
        </summary>
        <div className="mt-5 pt-5 border-t border-gray-100 space-y-5">
        <div className="flex flex-col sm:flex-row sm:flex-wrap sm:items-center gap-3">
          <label className="inline-flex items-center justify-center gap-2 btn-primary cursor-pointer text-sm py-2.5 px-5 min-h-[2.75rem] shadow-md">
            <Upload className="w-4 h-4 shrink-0" />
            <Sparkles className="w-4 h-4 shrink-0 opacity-90" />
            {importBusy ? 'A processar…' : 'Importar ficheiro'}
            <input
              type="file"
              accept={importFileAccept}
              className="hidden"
              disabled={importBusy}
              onChange={handleAiImportDirect}
            />
          </label>
          <p className="text-xs text-gray-500 max-w-xl leading-relaxed">
            Aceita CSV, PDF ou imagem (JPEG, PNG, WebP, GIF). Categorias padrão ficam em opções avançadas.
          </p>
        </div>

        <details className="group/advanced rounded-xl border border-gray-100 bg-gray-50/80 open:bg-gray-50">
          <summary className="cursor-pointer list-none px-4 py-3 text-sm font-medium text-gray-800 flex flex-wrap items-center gap-2 [&::-webkit-details-marker]:hidden">
            <ChevronDown className="w-4 h-4 text-gray-500 shrink-0 transition-transform group-open/advanced:rotate-180" />
            <span>Opções avançadas</span>
            <span className="text-xs font-normal text-gray-500">categorias padrão na importação (opcional)</span>
          </summary>
          <div className="px-4 pb-4 pt-0 border-t border-gray-100/80">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-3">
              <div>
                <label
                  className="block text-xs text-gray-600 mb-1.5"
                  title="Se vazio, usa a categoria automática &quot;Importação IA — despesas&quot;"
                >
                  Despesas
                </label>
                <select
                  value={ofxExpenseCat}
                  onChange={(e) => setOfxExpenseCat(e.target.value)}
                  className="input-field text-sm"
                >
                  <option value="">Automático: importação · despesas</option>
                  {categories
                    .filter((c) => c.type === TransactionType.EXPENSE)
                    .map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.name}
                      </option>
                    ))}
                </select>
              </div>
              <div>
                <label
                  className="block text-xs text-gray-600 mb-1.5"
                  title="Se vazio, usa a categoria automática &quot;Importação IA — receitas&quot;"
                >
                  Receitas
                </label>
                <select
                  value={ofxIncomeCat}
                  onChange={(e) => setOfxIncomeCat(e.target.value)}
                  className="input-field text-sm"
                >
                  <option value="">Automático: importação · receitas</option>
                  {categories
                    .filter((c) => c.type === TransactionType.INCOME)
                    .map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.name}
                      </option>
                    ))}
                </select>
              </div>
            </div>
          </div>
        </details>

        <details className="rounded-xl border border-gray-100 bg-white open:shadow-sm">
          <summary
            className="cursor-pointer list-none px-4 py-3 text-sm font-medium text-gray-800 flex flex-wrap items-center gap-x-2 gap-y-1 [&::-webkit-details-marker]:hidden"
            title="Agrupa lançamentos com a mesma data, valor e memorando/descrição"
          >
            <GitMerge className="w-4 h-4 text-gray-500 shrink-0" />
            <span>Duplicatas possíveis</span>
            <span className="text-xs font-normal text-gray-500">mesmo dia, valor e texto</span>
          </summary>
          <div className="px-4 pb-4 pt-3 border-t border-gray-100 space-y-3">
            <button
              type="button"
              className="btn-secondary text-xs py-1.5 px-2"
              onClick={() => void loadDuplicates()}
            >
              Carregar / atualizar
            </button>
            {duplicateClusters.length === 0 ? (
              <p className="text-xs text-gray-500">Nenhum grupo carregado.</p>
            ) : (
              duplicateClusters.map((cl, i) => (
                <div key={i} className="rounded-lg border border-gray-100 p-3 text-xs space-y-2">
                  <p className="font-semibold text-gray-700">Grupo {i + 1}</p>
                  <ul className="space-y-1">
                    {cl.transactions.map((t) => (
                      <li key={t.id} className="flex flex-wrap justify-between gap-2">
                        <span>
                          {t.date} · {formatCurrency(t.amount)} · {t.description || t.bankMemo || t.id}
                        </span>
                        <span className="font-mono text-gray-500">{t.id.slice(0, 8)}…</span>
                      </li>
                    ))}
                  </ul>
                  {cl.transactions.length >= 2 ? (
                    <button
                      type="button"
                      className="btn-secondary text-xs py-1 px-2"
                      onClick={() =>
                        mergeDuplicatePair(cl.transactions[0].id, cl.transactions[1].id)
                      }
                    >
                      Fundir 1º ← remover 2º
                    </button>
                  ) : null}
                </div>
              ))
            )}
          </div>
        </details>
        <div className="flex items-start gap-2.5 rounded-lg bg-gray-50/80 px-3 py-2.5 text-xs text-gray-500 border border-gray-100/80">
          <Info className="w-4 h-4 shrink-0 mt-0.5 text-gray-400" aria-hidden />
          <p>
            CSV, PDF e imagens são processados pelo Gemini (Google). Revê sempre valores, datas e categorias.
            Requer <code className="text-gray-700 bg-gray-100 px-1 rounded text-[11px]">GEMINI_API_KEY</code>{' '}
            no backend.
          </p>
        </div>
        </div>
      </details>

      {isValidMonthKey(monthQuery) && (
        <div className="rounded-xl border border-indigo-200/80 bg-indigo-50/70 px-4 py-3 text-sm text-gray-800 flex flex-wrap items-center justify-between gap-3">
          <p>
            Período alinhado ao <strong className="text-gray-900">dashboard</strong>:{' '}
            <strong>{formatMonthKeyPt(monthQuery)}</strong>{' '}
            <span className="text-gray-500 tabular-nums">({monthQuery})</span>
          </p>
          <button
            type="button"
            onClick={clearAllFilters}
            className="btn-secondary text-xs py-2 px-3 shrink-0"
          >
            Ver todas as datas
          </button>
        </div>
      )}

      {/* Busca e Filtros */}
      <div className={TX_PAGE_CARD}>
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center">
            <div className="p-2 bg-indigo-50 rounded-lg mr-3 border border-indigo-100/80">
              <Filter className="w-5 h-5 text-indigo-600" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-gray-900">Filtros</h2>
              <p className="text-sm text-gray-600">Filtre suas transações</p>
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-2 justify-end">
            {hasActiveFilters && (
              <button
                type="button"
                onClick={clearAllFilters}
                className="btn-secondary flex items-center gap-2 text-sm py-2 px-4"
              >
                <X className="w-4 h-4" />
                Limpar filtros
              </button>
            )}
            <button
              onClick={handleExport}
              className="btn-secondary flex items-center gap-2"
              disabled={transactions.length === 0}
              title="Exporta os lançamentos desta página (após filtros do servidor)"
            >
              <Download className="w-4 h-4" />
              Exportar CSV
            </button>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-6 gap-4 items-end">
          <div className="sm:col-span-2 lg:col-span-2 min-w-0">
            <label
              htmlFor="transactions-search"
              className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1.5"
            >
              Buscar
            </label>
            <div className="relative">
              <Search
                className="pointer-events-none absolute left-3 top-1/2 h-5 w-5 -translate-y-1/2 text-gray-400"
                aria-hidden
              />
              <input
                id="transactions-search"
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Descrição ou memorando do banco…"
                className={`input-field h-[46px] w-full pl-10 ${searchQuery ? 'pr-10' : ''}`}
              />
              {searchQuery ? (
                <button
                  type="button"
                  onClick={() => setSearchQuery('')}
                  className="absolute right-3 top-1/2 -translate-y-1/2 p-1 rounded-lg text-gray-400 hover:text-gray-700 hover:bg-gray-100"
                  aria-label="Limpar busca"
                >
                  <X className="w-4 h-4" />
                </button>
              ) : null}
            </div>
          </div>

          <div className="min-w-0">
            <label
              htmlFor="transactions-filter-type"
              className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1.5"
            >
              Tipo
            </label>
            <select
              id="transactions-filter-type"
              value={filters.type}
              onChange={(e) => setFilters({ ...filters, type: e.target.value, page: 1 })}
              className="input-field h-[46px] w-full"
            >
              <option value="">Todos os tipos</option>
              <option value="INCOME">Receita</option>
              <option value="EXPENSE">Despesa</option>
            </select>
          </div>

          <div className="min-w-0">
            <label
              htmlFor="transactions-start-date"
              className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1.5"
            >
              Data inicial
            </label>
            <input
              id="transactions-start-date"
              type="date"
              value={filters.startDate}
              onChange={(e) => {
                stripMonthQuery();
                setFilters({ ...filters, startDate: e.target.value, page: 1 });
              }}
              className="input-field h-[46px] w-full"
            />
          </div>

          <div className="min-w-0">
            <label
              htmlFor="transactions-end-date"
              className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1.5"
            >
              Data final
            </label>
            <input
              id="transactions-end-date"
              type="date"
              value={filters.endDate}
              onChange={(e) => {
                stripMonthQuery();
                setFilters({ ...filters, endDate: e.target.value, page: 1 });
              }}
              className="input-field h-[46px] w-full"
            />
          </div>

          <div className="sm:col-span-2 lg:col-span-1 min-w-0">
            <label
              htmlFor="transactions-filter-category"
              className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1.5"
            >
              Categoria
            </label>
            <select
              id="transactions-filter-category"
              value={filters.categoryId}
              onChange={(e) => setFilters({ ...filters, categoryId: e.target.value, page: 1 })}
              className="input-field h-[46px] w-full"
            >
              <option value="">Todas as categorias</option>
              {categories.map((cat) => (
                <option key={cat.id} value={cat.id}>
                  {cat.name}
                </option>
              ))}
            </select>
          </div>
        </div>

        <div className="mt-4 flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={saveCurrentFilter}
            className="btn-secondary text-xs py-2 px-3"
          >
            Salvar filtro atual
          </button>
          {savedFilters.map((sf) => (
            <div key={sf.id} className="inline-flex items-center rounded-lg border border-gray-200 bg-white">
              <button
                type="button"
                onClick={() => applySavedFilter(sf.id)}
                className="px-3 py-1.5 text-xs text-gray-700 hover:bg-gray-50"
              >
                {sf.name}
              </button>
              <button
                type="button"
                onClick={() => removeSavedFilter(sf.id)}
                className="px-2 py-1.5 text-xs text-gray-400 hover:text-red-500 hover:bg-gray-50 rounded-r-lg"
                title="Remover filtro salvo"
              >
                ×
              </button>
            </div>
          ))}
        </div>

        <p className="mt-4 text-xs text-gray-500">
          Previsão de despesas em{' '}
          <Link to="/categories" className="font-semibold text-indigo-600 hover:text-indigo-800 hover:underline">
            Categorias
          </Link>
          .
        </p>
      </div>

      {/* Lista de transações */}
      <div className={TX_PAGE_CARD}>
        <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div className="min-w-0">
            <h2 className="text-xl font-bold text-gray-900">Lançamentos</h2>
            <p className="text-sm text-gray-600 tabular-nums ff-tabular-nums">
              {loading
                ? 'A carregar...'
                : `${pagination.total} transação(ões) • saldo geral ${
                    globalBalance === null ? '—' : formatCurrency(globalBalance)
                  } • líquido da página ${
                    pageTotals.net >= 0 ? '+' : ''
                  }${formatCurrency(pageTotals.net)}`}
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2 shrink-0">
            <div
              className="inline-flex rounded-xl border border-gray-200 bg-white p-0.5 shadow-sm"
              role="group"
              aria-label="Densidade da lista"
            >
              <button
                type="button"
                onClick={() => setListDensity('comfortable')}
                className={`rounded-lg px-3 py-1.5 text-xs font-semibold transition-colors ${
                  listDensity === 'comfortable'
                    ? 'bg-indigo-600 text-white shadow-sm'
                    : 'text-gray-600 hover:bg-gray-50'
                }`}
              >
                Confortável
              </button>
              <button
                type="button"
                onClick={() => setListDensity('compact')}
                className={`rounded-lg px-3 py-1.5 text-xs font-semibold transition-colors ${
                  listDensity === 'compact'
                    ? 'bg-indigo-600 text-white shadow-sm'
                    : 'text-gray-600 hover:bg-gray-50'
                }`}
              >
                Compacta
              </button>
            </div>
            <button
              type="button"
              onClick={() => setIsModalOpen(true)}
              className="btn-secondary text-sm py-2.5 px-4 flex items-center gap-2"
            >
              <Plus className="w-4 h-4" />
              Nova transação
            </button>
          </div>
        </div>
        <div className="rounded-xl border border-gray-100 bg-gray-50">
        {loading ? (
          <div className="p-2 sm:p-3">
            <TransactionsTableSkeleton rows={10} />
            <p className="text-center text-xs text-gray-500 mt-4">A carregar lançamentos…</p>
          </div>
        ) : transactions.length === 0 ? (
          <div className="rounded-xl border border-gray-200/80 bg-gradient-to-b from-slate-50/50 to-white px-4 py-12">
            <div className="flex flex-col items-center justify-center py-6 max-w-md mx-auto text-center">
              <div className="relative w-32 h-28 mb-5 text-indigo-100" aria-hidden>
                <svg viewBox="0 0 128 112" className="w-full h-full drop-shadow-sm">
                  <rect x="8" y="12" width="112" height="88" rx="12" fill="currentColor" className="text-indigo-100" />
                  <rect x="20" y="28" width="72" height="8" rx="4" fill="#c7d2fe" opacity="0.9" />
                  <rect x="20" y="44" width="56" height="8" rx="4" fill="#e0e7ff" opacity="0.95" />
                  <rect x="20" y="60" width="64" height="8" rx="4" fill="#e0e7ff" opacity="0.85" />
                  <circle cx="96" cy="72" r="18" fill="#818cf8" opacity="0.35" />
                </svg>
                <Receipt className="w-11 h-11 text-indigo-500 absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-[40%]" />
              </div>
              <p className="text-lg font-semibold text-gray-900 mb-2">Ainda não há lançamentos</p>
              <p className="text-sm text-gray-600 mb-6">
                Importe um extrato com IA ou registe uma transação manualmente.
              </p>
              <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3 w-full sm:w-auto sm:justify-center">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(true)}
                  className="btn-primary flex items-center justify-center gap-2"
                >
                  <Plus className="w-5 h-5 shrink-0" />
                  <span>Nova transação</span>
                </button>
                <button
                  type="button"
                  onClick={openImportSection}
                  className="btn-secondary flex items-center justify-center gap-2 border-indigo-200/80 text-indigo-800 hover:bg-indigo-50/80"
                >
                  <Upload className="w-5 h-5 shrink-0" />
                  <span>Importar extrato</span>
                </button>
              </div>
            </div>
          </div>
        ) : filteredTransactions.length === 0 ? (
          <div className="rounded-xl border border-gray-100 bg-gray-50 px-4 py-10">
            <div className="flex flex-col items-center justify-center py-8">
              <Search className="w-12 h-12 text-gray-300 mb-3" />
              <p className="text-lg font-semibold text-gray-900 mb-1">Nenhum resultado nesta página</p>
              <p className="text-sm text-gray-600 text-center max-w-md mb-4">
                Ajuste a busca ou os filtros — a pesquisa aplica-se aos lançamentos já carregados nesta página.
              </p>
              <button type="button" onClick={() => setSearchQuery('')} className="btn-secondary text-sm py-2 px-4">
                Limpar busca
              </button>
            </div>
          </div>
        ) : (
          <>
          <div className="hidden md:block max-h-[min(70vh,720px)] overflow-auto custom-scrollbar rounded-xl border border-gray-200/80 bg-white">
            <table className="w-full min-w-[720px]">
              <thead>
                <tr className="border-b border-gray-200">
                  <th className={`w-10 ${thCheck} text-center ${thSticky}`}>
                    <button
                      type="button"
                      aria-label="Selecionar página"
                      className="p-1 rounded-lg text-gray-500 hover:bg-gray-100"
                      onClick={toggleSelectAllOnPage}
                    >
                      {filteredTransactions.length > 0 &&
                      filteredTransactions.every((t) => selectedIds.has(t.id)) ? (
                        <CheckSquare className="w-4 h-4" />
                      ) : (
                        <Square className="w-4 h-4" />
                      )}
                    </button>
                  </th>
                  <th
                    className={`text-left ${thPad} font-semibold text-gray-700 ${thText} uppercase tracking-wider cursor-pointer hover:bg-slate-100/90 transition-colors ${thSticky}`}
                    onClick={() => handleSort('date')}
                  >
                    Data <SortIcon field="date" />
                  </th>
                  <th
                    className={`text-left ${thPad} font-semibold text-gray-700 ${thText} uppercase tracking-wider cursor-pointer hover:bg-slate-100/90 transition-colors ${thSticky}`}
                    onClick={() => handleSort('description')}
                  >
                    Descrição <SortIcon field="description" />
                  </th>
                  <th
                    className={`text-left ${thPad} font-semibold text-gray-700 ${thText} uppercase tracking-wider ${thSticky}`}
                  >
                    Categoria
                  </th>
                  <th
                    className={`text-center ${thCheck} font-semibold text-gray-700 ${thText} uppercase tracking-wider w-12 ${thSticky}`}
                    title="Anexos"
                  >
                    <Paperclip className="w-4 h-4 inline text-gray-500" />
                  </th>
                  <th
                    className={`text-left ${thPad} font-semibold text-gray-700 ${thText} uppercase tracking-wider ${thSticky}`}
                  >
                    Tipo
                  </th>
                  <th
                    className={`text-right ${thPad} font-semibold text-gray-700 ${thText} uppercase tracking-wider cursor-pointer hover:bg-slate-100/90 transition-colors ${thSticky}`}
                    onClick={() => handleSort('amount')}
                  >
                    Valor <SortIcon field="amount" />
                  </th>
                  <th
                    className={`text-right ${thPad} font-semibold text-gray-700 ${thText} uppercase tracking-wider ${thSticky}`}
                  >
                    Ações
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {(() => {
                  let dataIdx = 0;
                  return txTableRows.map((item) => {
                    if (item.kind === 'day') {
                      return (
                        <tr key={item.key} className="bg-gray-100/90">
                          <td
                            colSpan={8}
                            className="py-2 px-4 text-xs font-semibold text-gray-600 border-t border-gray-200"
                          >
                            {item.label}
                          </td>
                        </tr>
                      );
                    }
                    const transaction = item.t;
                    const zebra = dataIdx % 2 === 1 ? 'bg-gray-50/70' : 'bg-white';
                    dataIdx += 1;
                    return (
                      <tr
                        key={transaction.id}
                        className={`${zebra} hover:bg-indigo-50/45 transition-colors group`}
                      >
                        <td className={`${thCheck} text-center`}>
                          <input
                            type="checkbox"
                            checked={selectedIds.has(transaction.id)}
                            onChange={() => toggleSelectRow(transaction.id)}
                            className="rounded border-gray-300"
                          />
                        </td>
                        <td className={tdPad}>
                          <span className={`${descText} font-medium text-gray-900`}>
                            {formatDate(transaction.date)}
                          </span>
                        </td>
                        <td className={`${tdPad} max-w-xs lg:max-w-md`}>
                          <div className={`flex flex-col ${listDensity === 'compact' ? 'gap-0.5' : 'gap-1'}`}>
                            <span className={`${descText} text-gray-700 line-clamp-2`}>
                              {transaction.description || (
                                <span className="text-gray-400">Sem descrição</span>
                              )}
                            </span>
                            {transaction.bankMemo ? (
                              <span
                                className="text-[11px] text-gray-500 line-clamp-1"
                                title={transaction.bankMemo}
                              >
                                {transaction.bankMemo}
                              </span>
                            ) : null}
                            {transaction.type === TransactionType.EXPENSE &&
                              transaction.deductiblePotential && (
                                <span className="text-[10px] font-semibold uppercase tracking-wide w-fit px-2 py-0.5 rounded-full bg-amber-100 text-amber-900 border border-amber-200">
                                  Potencial IR
                                </span>
                              )}
                          </div>
                        </td>
                        <td className={tdPad}>
                          {transaction.category ? (
                            <span
                              className={`inline-flex items-center rounded-full font-semibold border ${
                                listDensity === 'compact'
                                  ? 'px-2 py-0.5 text-[10px]'
                                  : 'px-3 py-1 text-xs'
                              }`}
                              style={{
                                backgroundColor: `${transaction.category.color}15`,
                                color: transaction.category.color,
                                borderColor: `${transaction.category.color}30`,
                              }}
                            >
                              {transaction.category.name}
                            </span>
                          ) : (
                            <span className={`${descText} text-gray-400`}>Sem categoria</span>
                          )}
                        </td>
                        <td className={`${thCheck} text-center`}>
                          {(transaction._count?.attachments ?? 0) > 0 ? (
                            <span
                              className={`inline-flex items-center justify-center rounded-full bg-amber-50 text-amber-800 font-bold border border-amber-200 ${
                                listDensity === 'compact'
                                  ? 'w-6 h-6 text-[10px]'
                                  : 'w-8 h-8 text-xs'
                              }`}
                              title={`${transaction._count?.attachments} anexo(s)`}
                            >
                              {transaction._count?.attachments}
                            </span>
                          ) : (
                            <span className="text-gray-300">—</span>
                          )}
                        </td>
                        <td className={tdPad}>
                          <span
                            className={`inline-flex items-center rounded-full font-semibold ${
                              listDensity === 'compact'
                                ? 'px-2 py-0.5 text-[10px]'
                                : 'px-3 py-1 text-xs'
                            } ${
                              transaction.type === TransactionType.INCOME
                                ? 'bg-green-100 text-[#22C55E] border border-green-200'
                                : 'bg-red-100 text-[#EF4444] border border-red-200'
                            }`}
                          >
                            {transaction.type === TransactionType.INCOME ? 'Receita' : 'Despesa'}
                          </span>
                        </td>
                        <td
                          className={`${tdPad} text-right font-bold tabular-nums ff-tabular-nums ${amtText} ${
                            transaction.type === TransactionType.INCOME
                              ? 'text-[#22C55E]'
                              : 'text-[#EF4444]'
                          }`}
                        >
                          {transaction.type === TransactionType.INCOME ? '+' : '-'}
                          {formatCurrency(transaction.amount)}
                        </td>
                        <td className={tdPad}>
                          <div className="flex items-center justify-end gap-2 opacity-100 md:opacity-0 md:group-hover:opacity-100 transition-opacity">
                            <button
                              onClick={() => handleEdit(transaction)}
                              className="p-2 text-indigo-600 hover:bg-indigo-50 rounded-lg transition-colors"
                              title="Editar"
                            >
                              <Edit className="w-4 h-4" />
                            </button>
                            <button
                              onClick={() =>
                                setDeleteConfirm({
                                  id: transaction.id,
                                  description: transaction.description || 'Transação sem descrição',
                                })
                              }
                              className="p-2 text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                              title="Excluir"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  });
                })()}
              </tbody>
            </table>
          </div>

          <div className={listDensity === 'compact' ? 'md:hidden space-y-2' : 'md:hidden space-y-3'}>
            {filteredTransactions.flatMap((transaction, idx) => {
              const dayKey = transaction.date.includes('T')
                ? transaction.date.split('T')[0]!
                : transaction.date.slice(0, 10);
              const prev = idx > 0 ? filteredTransactions[idx - 1] : null;
              const prevKey = prev
                ? prev.date.includes('T')
                  ? prev.date.split('T')[0]!
                  : prev.date.slice(0, 10)
                : '';
              const showDayHeader = sortBy.field === 'date' && dayKey !== prevKey;
              const zebraMb = idx % 2 === 1 ? 'bg-gray-50/80' : 'bg-white';
              const pad = listDensity === 'compact' ? 'p-3 gap-2' : 'p-4 space-y-3';
              const nodes: ReactNode[] = [];
              if (showDayHeader) {
                nodes.push(
                  <div
                    key={`mday-${dayKey}-${transaction.id}`}
                    className="text-xs font-semibold text-gray-600 px-1 pt-1 pb-0.5 border-b border-gray-200"
                  >
                    {formatDate(transaction.date)}
                  </div>,
                );
              }
              nodes.push(
                <div
                  key={transaction.id}
                  className={`rounded-2xl border border-gray-100 shadow-sm ${pad} ${zebraMb}`}
                >
                <div className="flex items-start gap-2">
                  <input
                    type="checkbox"
                    checked={selectedIds.has(transaction.id)}
                    onChange={() => toggleSelectRow(transaction.id)}
                    className="mt-1 rounded border-gray-300"
                  />
                <div className="flex justify-between gap-3 flex-1 min-w-0">
                  <div className="min-w-0 flex-1">
                    <p className="text-xs font-medium text-gray-500">{formatDate(transaction.date)}</p>
                    <p className="text-sm font-semibold text-gray-900 mt-0.5">
                      {transaction.description || <span className="text-gray-400 font-normal">Sem descrição</span>}
                    </p>
                    {transaction.bankMemo ? (
                      <p className="text-xs text-gray-500 mt-1 line-clamp-2">{transaction.bankMemo}</p>
                    ) : null}
                  </div>
                  <div className="text-right shrink-0">
                    <span
                      className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold ${
                        transaction.type === TransactionType.INCOME
                          ? 'bg-green-100 text-[#22C55E] border border-green-200'
                          : 'bg-red-100 text-[#EF4444] border border-red-200'
                      }`}
                    >
                      {transaction.type === TransactionType.INCOME ? 'Receita' : 'Despesa'}
                    </span>
                    <p
                      className={`text-base font-bold tabular-nums ff-tabular-nums mt-1 ${
                        transaction.type === TransactionType.INCOME ? 'text-[#22C55E]' : 'text-[#EF4444]'
                      }`}
                    >
                      {transaction.type === TransactionType.INCOME ? '+' : '-'}
                      {formatCurrency(transaction.amount)}
                    </p>
                  </div>
                </div>
                </div>
                <div className="flex flex-wrap items-center gap-2 justify-between">
                  {transaction.category ? (
                    <span
                      className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-semibold border max-w-[70%] truncate"
                      style={{
                        backgroundColor: `${transaction.category.color}15`,
                        color: transaction.category.color,
                        borderColor: `${transaction.category.color}30`,
                      }}
                    >
                      {transaction.category.name}
                    </span>
                  ) : (
                    <span className="text-xs text-gray-400">Sem categoria</span>
                  )}
                  <div className="flex items-center gap-2">
                    {(transaction._count?.attachments ?? 0) > 0 ? (
                      <span
                        className="inline-flex items-center gap-1 text-xs font-medium text-amber-800 bg-amber-50 px-2 py-1 rounded-lg border border-amber-200"
                        title="Anexos"
                      >
                        <Paperclip className="w-3.5 h-3.5" />
                        {transaction._count?.attachments}
                      </span>
                    ) : null}
                    {transaction.type === TransactionType.EXPENSE && transaction.deductiblePotential && (
                      <span className="text-[9px] font-bold uppercase text-amber-900 bg-amber-100 px-2 py-1 rounded border border-amber-200">
                        IR
                      </span>
                    )}
                  </div>
                </div>
                <div className="flex justify-end gap-2 pt-1 border-t border-gray-50">
                  <button
                    type="button"
                    onClick={() => handleEdit(transaction)}
                    className="btn-secondary flex items-center gap-1.5 text-sm py-2 px-3"
                  >
                    <Edit className="w-4 h-4" />
                    Editar
                  </button>
                  <button
                    type="button"
                    onClick={() =>
                      setDeleteConfirm({
                        id: transaction.id,
                        description: transaction.description || 'Transação sem descrição',
                      })
                    }
                    className="flex items-center gap-1.5 text-sm py-2 px-3 rounded-xl border border-red-200 text-red-600 hover:bg-red-50 font-semibold"
                  >
                    <Trash2 className="w-4 h-4" />
                    Excluir
                  </button>
                </div>
              </div>
              );
              return nodes;
            })}
          </div>
          </>
        )}

        {/* Paginação */}
        {!loading && transactions.length > 0 && pagination.total > 0 && (
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mt-6 pt-6 border-t border-gray-200">
            <p className="text-sm text-gray-600">
              Mostrando {((pagination.page - 1) * pagination.limit) + 1} a{' '}
              {Math.min(pagination.page * pagination.limit, pagination.total)} de {pagination.total}{' '}
              transações
            </p>
            {pagination.totalPages > 1 ? (
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setFilters({ ...filters, page: pagination.page - 1 })}
                  disabled={pagination.page === 1}
                  className="btn-secondary text-sm py-2 px-4 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  Anterior
                </button>
                <span className="px-3 py-2 text-sm font-medium text-gray-700 tabular-nums">
                  {pagination.page} / {pagination.totalPages}
                </span>
                <button
                  type="button"
                  onClick={() => setFilters({ ...filters, page: pagination.page + 1 })}
                  disabled={pagination.page === pagination.totalPages}
                  className="btn-secondary text-sm py-2 px-4 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  Próxima
                </button>
              </div>
            ) : null}
          </div>
        )}
        </div>
      </div>

      {selectedIds.size > 0 ? (
        <div className="fixed bottom-0 inset-x-0 z-40 border-t border-gray-200 bg-white/95 backdrop-blur shadow-lg px-4 py-3 safe-area-pb">
          <div className="max-w-5xl mx-auto flex flex-col sm:flex-row flex-wrap items-stretch sm:items-center gap-3">
            <p className="text-sm font-semibold text-gray-800 shrink-0">
              {selectedIds.size} selecionada(s)
            </p>
            <select
              className="input-field text-sm py-2 min-w-[160px]"
              value={batchCategoryId}
              onChange={(e) => setBatchCategoryId(e.target.value)}
            >
              <option value="">Categoria (opcional)</option>
              {categories.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.type === TransactionType.INCOME ? '↑ ' : '↓ '}
                  {c.name}
                </option>
              ))}
            </select>
            <select
              className="input-field text-sm py-2 min-w-[140px]"
              value={batchDeductible}
              onChange={(e) =>
                setBatchDeductible(e.target.value as 'unset' | 'true' | 'false')
              }
            >
              <option value="unset">IR — manter</option>
              <option value="true">IR — marcar sim</option>
              <option value="false">IR — marcar não</option>
            </select>
            <input
              type="text"
              className="input-field text-sm py-2 flex-1 min-w-[120px]"
              placeholder="Nota (opcional)"
              value={batchNote}
              onChange={(e) => setBatchNote(e.target.value)}
            />
            <div className="flex gap-2">
              <button type="button" className="btn-secondary text-sm py-2 px-3" onClick={() => setSelectedIds(new Set())}>
                Limpar
              </button>
              <button type="button" className="btn-primary text-sm py-2 px-3" onClick={() => void applyBatch()}>
                Aplicar
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {isModalOpen && (
        <TransactionModal
          transaction={editingTransaction}
          categories={categories}
          onClose={handleCloseModal}
          onSave={handleSave}
        />
      )}

      <DeleteConfirmModal
        isOpen={!!deleteConfirm}
        onClose={() => setDeleteConfirm(null)}
        onConfirm={() => deleteConfirm && handleDelete(deleteConfirm.id)}
        title="Confirmar exclusão"
        message="Tem certeza que deseja excluir esta transação? Esta ação não pode ser desfeita."
        itemName={deleteConfirm?.description}
      />
    </div>
  );
}
