import { useEffect, useState, useMemo, useCallback } from 'react';
import { Link } from 'react-router-dom';
import api, { type ApiAxiosError } from '../lib/api';
import { getApiErrorWithRequestId } from '../lib/apiErrors';
import { CategoryTilesSkeleton } from '../components/LoadingSkeletons';
import { Category, TransactionType, ExpenseForecastRow, AiInsightResult } from '../types';
import {
  Edit,
  Trash2,
  Search,
  Tag,
  TrendingUp,
  Sparkles,
  Loader2,
  Filter,
  Plus,
  TrendingDown,
  X,
} from 'lucide-react';
import { formatCurrency } from '../utils/format';
import toast from 'react-hot-toast';
import CategoryModal from '../components/CategoryModal';
import DeleteConfirmModal from '../components/DeleteConfirmModal';

function CategoryTile({
  category,
  onEdit,
  onDelete,
}: {
  category: Category;
  onEdit: (c: Category) => void;
  onDelete: (c: Category) => void;
}) {
  const isExpense = category.type === TransactionType.EXPENSE;

  return (
    <div className="group relative rounded-2xl border border-gray-100 bg-gradient-to-br from-white to-[#F9FAFB] p-4 shadow-sm hover:shadow-md hover:border-gray-200 transition-all duration-200">
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center min-w-0 flex-1">
          <div className="w-11 h-11 rounded-xl flex items-center justify-center mr-3 shrink-0 bg-gray-100 border border-gray-100">
            <span className="text-lg leading-none text-gray-700">
              {category.icon || (isExpense ? '💸' : '💰')}
            </span>
          </div>
          <div className="min-w-0">
            <p className="font-semibold text-gray-900 truncate">{category.name}</p>
            <div className="flex flex-wrap items-center gap-2 mt-1">
              <span className="text-[11px] font-bold uppercase tracking-wide px-2 py-0.5 rounded-md bg-gray-100 text-gray-700 border border-gray-200">
                {isExpense ? 'Despesa' : 'Receita'}
              </span>
              {isExpense && category.suggestTaxDeductible && (
                <span className="text-[10px] font-semibold uppercase tracking-wide px-2 py-0.5 rounded-md bg-gray-100 text-gray-600 border border-gray-200">
                  TaxVision · IR
                </span>
              )}
            </div>
          </div>
        </div>
        <div className="flex items-center gap-1 shrink-0">
          <button
            type="button"
            onClick={() => onEdit(category)}
            className="p-2 text-blue-600 hover:bg-blue-50 rounded-xl transition-colors"
            title="Editar"
          >
            <Edit className="w-4 h-4" />
          </button>
          <button
            type="button"
            onClick={() => onDelete(category)}
            className="p-2 text-red-600 hover:bg-red-50 rounded-xl transition-colors"
            title="Excluir"
          >
            <Trash2 className="w-4 h-4" />
          </button>
        </div>
      </div>
    </div>
  );
}

export default function Categories() {
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingCategory, setEditingCategory] = useState<Category | null>(null);
  const [createInitialType, setCreateInitialType] = useState<TransactionType | undefined>(undefined);
  const [deleteConfirm, setDeleteConfirm] = useState<{ id: string; name: string } | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [filterType, setFilterType] = useState<TransactionType | ''>('');
  const [forecast, setForecast] = useState<ExpenseForecastRow[]>([]);
  const [forecastLoading, setForecastLoading] = useState(true);
  const [forecastAiLoading, setForecastAiLoading] = useState(false);
  const [forecastAi, setForecastAi] = useState<AiInsightResult | null>(null);

  useEffect(() => {
    loadCategories();
    loadForecast();
  }, []);

  const loadForecast = async () => {
    try {
      setForecastLoading(true);
      const { data } = await api.get<ExpenseForecastRow[]>('/categories/forecast/expenses');
      setForecast(Array.isArray(data) ? data : []);
    } catch {
      setForecast([]);
    } finally {
      setForecastLoading(false);
    }
  };

  const loadCategories = async () => {
    try {
      const response = await api.get('/categories');
      const data = response.data?.data || response.data;
      setCategories(Array.isArray(data) ? data : []);
    } catch (error: unknown) {
      toast.error(getApiErrorWithRequestId(error));
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (id: string) => {
    try {
      await api.delete(`/categories/${id}`);
      toast.success('Categoria excluída com sucesso');
      loadCategories();
      loadForecast();
    } catch (error: unknown) {
      toast.error((error as ApiAxiosError).friendlyMessage || getApiErrorWithRequestId(error));
    }
  };

  const filteredCategories = useMemo(
    () =>
      categories.filter((c) => {
        const matchesSearch = c.name.toLowerCase().includes(searchQuery.toLowerCase());
        const matchesType = !filterType || c.type === filterType;
        return matchesSearch && matchesType;
      }),
    [categories, searchQuery, filterType],
  );

  const forecastProjectedTotal = useMemo(
    () => forecast.reduce((sum, r) => sum + (Number(r.projectedNextMonthExpense) || 0), 0),
    [forecast],
  );

  const incomeCategories = filteredCategories.filter((c) => c.type === TransactionType.INCOME);
  const expenseCategories = filteredCategories.filter((c) => c.type === TransactionType.EXPENSE);

  const showIncomeSection = !filterType || filterType === TransactionType.INCOME;
  const showExpenseSection = !filterType || filterType === TransactionType.EXPENSE;

  const hasActiveFilters = !!searchQuery.trim() || !!filterType;

  const clearFilters = () => {
    setSearchQuery('');
    setFilterType('');
  };

  const openNewCategory = useCallback((type?: TransactionType) => {
    setEditingCategory(null);
    setCreateInitialType(type);
    setIsModalOpen(true);
  }, []);

  const handleEdit = (category: Category) => {
    setCreateInitialType(undefined);
    setEditingCategory(category);
    setIsModalOpen(true);
  };

  const handleCloseModal = () => {
    setIsModalOpen(false);
    setEditingCategory(null);
    setCreateInitialType(undefined);
  };

  const handleSave = () => {
    loadCategories();
    loadForecast();
    handleCloseModal();
  };

  const loadForecastAiInsight = async () => {
    try {
      setForecastAiLoading(true);
      setForecastAi(null);
      const { data } = await api.post<AiInsightResult>('/ai-insights/forecast-commentary');
      setForecastAi(data);
    } catch (e: unknown) {
      const msg =
        (e as { response?: { data?: { message?: string | string[] } } })?.response?.data?.message;
      toast.error(
        typeof msg === 'string' ? msg : Array.isArray(msg) ? msg.join(', ') : 'Erro ao gerar comentário IA',
      );
    } finally {
      setForecastAiLoading(false);
    }
  };

  const requestDelete = (c: Category) => {
    setDeleteConfirm({ id: c.id, name: c.name });
  };

  return (
    <div className="space-y-6 animate-fade-in">
      <div>
        <h1 className="text-4xl font-bold text-gray-900 mb-2">Categorias</h1>
        <p className="text-gray-600 text-lg">Organize receitas e despesas</p>
        <button
          type="button"
          onClick={() => openNewCategory()}
          className="btn-secondary text-sm py-2.5 px-4 flex items-center gap-2 mt-4"
        >
          <Plus className="w-4 h-4" />
          Nova categoria
        </button>
      </div>

      <div className="card-gradient">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-5">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-green-100 rounded-xl">
              <Filter className="w-5 h-5 text-[#16A34A]" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-gray-900">Filtros</h2>
              <p className="text-sm text-gray-600">Busca e tipo de categoria</p>
            </div>
          </div>
          {hasActiveFilters && (
            <button
              type="button"
              onClick={clearFilters}
              className="btn-secondary text-sm py-2.5 px-4 flex items-center gap-2 w-fit"
            >
              <X className="w-4 h-4" />
              Limpar
            </button>
          )}
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-[minmax(0,1fr)_11rem] gap-4 items-end">
          <div className="min-w-0">
            <label
              htmlFor="categories-search"
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
                id="categories-search"
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Nome da categoria…"
                className={`input-field h-[46px] w-full pl-10 ${searchQuery ? 'pr-10' : ''}`}
              />
              {searchQuery ? (
                <button
                  type="button"
                  onClick={() => setSearchQuery('')}
                  className="absolute right-3 top-1/2 -translate-y-1/2 p-1 rounded-lg text-gray-400 hover:bg-gray-100 hover:text-gray-700"
                  aria-label="Limpar busca"
                >
                  <X className="w-4 h-4" />
                </button>
              ) : null}
            </div>
          </div>
          <div className="min-w-0 sm:max-w-[11rem] sm:justify-self-stretch">
            <label
              htmlFor="categories-filter-type"
              className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1.5"
            >
              Tipo
            </label>
            <select
              id="categories-filter-type"
              value={filterType}
              onChange={(e) => setFilterType(e.target.value as TransactionType | '')}
              className="input-field h-[46px] w-full"
            >
              <option value="">Todos</option>
              <option value={TransactionType.INCOME}>Receitas</option>
              <option value={TransactionType.EXPENSE}>Despesas</option>
            </select>
          </div>
        </div>
      </div>

      <div className="card-gradient">
        <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4 mb-4">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-green-100 rounded-xl">
              <TrendingUp className="w-5 h-5 text-[#16A34A]" />
            </div>
            <div>
              <h2 className="text-xl font-bold text-gray-900">Previsão de despesas</h2>
              <p className="text-sm text-gray-600">
                Média dos últimos 3 meses.{' '}
                <Link to="/transactions" className="text-[#16A34A] font-semibold hover:underline">
                  Ver transações
                </Link>
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={loadForecastAiInsight}
            disabled={forecastLoading || forecastAiLoading}
            className="btn-secondary flex items-center justify-center gap-2 shrink-0 text-sm py-2.5 px-4 disabled:opacity-50"
            title="Gemini no servidor com dados agregados (sem descrições de transações)"
          >
            {forecastAiLoading ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <Sparkles className="w-4 h-4 text-gray-600" />
            )}
            Comentário IA (Gemini)
          </button>
        </div>

        {forecastLoading ? (
          <div className="flex items-center gap-3 text-gray-500 text-sm py-6">
            <Loader2 className="w-5 h-5 animate-spin text-[#16A34A]" />
            A calcular previsão…
          </div>
        ) : forecast.length === 0 ? (
          <div className="rounded-xl border border-gray-100 bg-gray-50 px-4 py-8 text-center">
            <p className="text-sm text-gray-600 mb-1">Sem despesas recentes para projetar.</p>
            <p className="text-sm text-gray-500">
              Registe movimentos ou importe extrato em{' '}
              <Link to="/transactions" className="font-semibold text-[#16A34A] hover:underline">
                Transações
              </Link>
              .
            </p>
          </div>
        ) : (
          <>
            <div className="hidden sm:block overflow-x-auto custom-scrollbar rounded-xl border border-gray-100">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-gray-50/80 border-b border-gray-200 text-left text-gray-600">
                    <th className="py-3 px-4 font-semibold rounded-tl-xl">Categoria</th>
                    <th className="py-3 px-4 text-right font-semibold">Média / mês</th>
                    <th className="py-3 px-4 text-right font-semibold">Projeção próx. mês</th>
                    <th className="py-3 px-4 text-right font-semibold rounded-tr-xl">Movimentos</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100 bg-white">
                  {forecast.map((row) => (
                    <tr key={row.categoryId} className="hover:bg-gray-50/60 transition-colors">
                      <td className="py-3 px-4">
                        <span className="font-medium text-gray-900 truncate">{row.categoryName}</span>
                      </td>
                      <td className="py-3 px-4 text-right tabular-nums text-gray-700">
                        {formatCurrency(row.averageMonthlyExpense)}
                      </td>
                      <td className="py-3 px-4 text-right tabular-nums font-semibold text-[#16A34A]">
                        {formatCurrency(row.projectedNextMonthExpense)}
                      </td>
                      <td className="py-3 px-4 text-right text-gray-500 tabular-nums">{row.transactionCount}</td>
                    </tr>
                  ))}
                </tbody>
                <tfoot>
                  <tr className="bg-gray-50 border-t border-gray-200 font-semibold text-gray-900">
                    <td className="py-3 px-4 rounded-bl-xl">Total projetado</td>
                    <td className="py-3 px-4 text-right text-gray-500">—</td>
                    <td className="py-3 px-4 text-right tabular-nums text-[#16A34A]">
                      {formatCurrency(forecastProjectedTotal)}
                    </td>
                    <td className="py-3 px-4 text-right text-gray-500 rounded-br-xl">—</td>
                  </tr>
                </tfoot>
              </table>
            </div>

            <div className="sm:hidden space-y-3">
              {forecast.map((row) => (
                <div
                  key={row.categoryId}
                  className="rounded-xl border border-gray-100 bg-white p-4 shadow-sm flex justify-between gap-3"
                >
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <span className="font-semibold text-gray-900 truncate">{row.categoryName}</span>
                    </div>
                    <p className="text-xs text-gray-500 mt-1">{row.transactionCount} mov. no período</p>
                  </div>
                  <div className="text-right shrink-0">
                    <p className="text-xs text-gray-500">Projeção</p>
                    <p className="font-bold text-[#16A34A] tabular-nums">{formatCurrency(row.projectedNextMonthExpense)}</p>
                  </div>
                </div>
              ))}
              <div className="rounded-xl border border-gray-100 bg-gray-50 px-4 py-3 flex justify-between items-center font-semibold text-gray-900">
                <span>Total</span>
                <span className="text-[#16A34A] tabular-nums">{formatCurrency(forecastProjectedTotal)}</span>
              </div>
            </div>
          </>
        )}

        {forecastAi && (
          <div className="mt-5 p-4 rounded-xl bg-gray-50 border border-gray-100">
            <p className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-2">
              Comentário gerado · {forecastAi.model}
            </p>
            <div className="text-sm text-gray-800 whitespace-pre-wrap leading-relaxed">{forecastAi.text}</div>
            <p className="text-xs text-gray-500 mt-3">
              Texto produzido por IA; pode conter imprecisões. Os números oficiais são os da tabela acima.
            </p>
          </div>
        )}
      </div>

      {showIncomeSection && (
        <div className="card-gradient">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-5">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-green-100 rounded-xl">
                <TrendingUp className="w-5 h-5 text-[#16A34A]" />
              </div>
              <div>
                <h2 className="text-xl font-bold text-gray-900">Receitas</h2>
                <p className="text-sm text-gray-600">
                  {incomeCategories.length} {incomeCategories.length === 1 ? 'categoria' : 'categorias'}
                  {hasActiveFilters ? ' com o filtro atual' : ''}
                </p>
              </div>
            </div>
          </div>
          {loading ? (
            <CategoryTilesSkeleton />
          ) : incomeCategories.length === 0 ? (
            <div className="rounded-xl border border-gray-100 bg-gray-50 text-center py-12 px-4">
              <Tag className="w-14 h-14 text-gray-300 mx-auto mb-3" />
              <h3 className="text-lg font-bold text-gray-900 mb-2">Nenhuma categoria de receita</h3>
              <p className="text-gray-600 mb-5 text-sm max-w-md mx-auto">
                {searchQuery || filterType
                  ? 'Tente ajustar a busca ou o tipo no filtro.'
                  : 'Crie categorias para classificar entradas (salário, freelas, etc.).'}
              </p>
              {!searchQuery && !filterType && (
                <button type="button" onClick={() => openNewCategory(TransactionType.INCOME)} className="btn-primary">
                  Criar primeira categoria de receita
                </button>
              )}
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
              {incomeCategories.map((category) => (
                <CategoryTile
                  key={category.id}
                  category={category}
                  onEdit={handleEdit}
                  onDelete={requestDelete}
                />
              ))}
            </div>
          )}
        </div>
      )}

      {showExpenseSection && (
        <div className="card-gradient">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-5">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-red-100 rounded-xl">
                <TrendingDown className="w-5 h-5 text-[#EF4444]" />
              </div>
              <div>
                <h2 className="text-xl font-bold text-gray-900">Despesas</h2>
                <p className="text-sm text-gray-600">
                  {expenseCategories.length} {expenseCategories.length === 1 ? 'categoria' : 'categorias'}
                  {hasActiveFilters ? ' com o filtro atual' : ''}
                </p>
              </div>
            </div>
          </div>
          {loading ? (
            <CategoryTilesSkeleton />
          ) : expenseCategories.length === 0 ? (
            <div className="rounded-xl border border-gray-100 bg-gray-50 text-center py-12 px-4">
              <Tag className="w-14 h-14 text-gray-300 mx-auto mb-3" />
              <h3 className="text-lg font-bold text-gray-900 mb-2">Nenhuma categoria de despesa</h3>
              <p className="text-gray-600 mb-5 text-sm max-w-md mx-auto">
                {searchQuery || filterType
                  ? 'Tente ajustar a busca ou o tipo no filtro.'
                  : 'Crie categorias para acompanhar gastos e usar na previsão TaxVision.'}
              </p>
              {!searchQuery && !filterType && (
                <button type="button" onClick={() => openNewCategory(TransactionType.EXPENSE)} className="btn-primary">
                  Criar primeira categoria de despesa
                </button>
              )}
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
              {expenseCategories.map((category) => (
                <CategoryTile
                  key={category.id}
                  category={category}
                  onEdit={handleEdit}
                  onDelete={requestDelete}
                />
              ))}
            </div>
          )}
        </div>
      )}

      {isModalOpen && (
        <CategoryModal
          category={editingCategory}
          initialType={editingCategory ? undefined : createInitialType}
          onClose={handleCloseModal}
          onSave={handleSave}
        />
      )}

      <DeleteConfirmModal
        isOpen={!!deleteConfirm}
        onClose={() => setDeleteConfirm(null)}
        onConfirm={() => deleteConfirm && handleDelete(deleteConfirm.id)}
        title="Confirmar exclusão"
        message="Tem certeza que deseja excluir esta categoria? Esta ação não pode ser desfeita."
        itemName={deleteConfirm?.name}
      />
    </div>
  );
}
