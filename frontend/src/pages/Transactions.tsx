import { useEffect, useState } from 'react';
import api from '../lib/api';
import { Transaction, TransactionType, Category } from '../types';
import { Plus, Edit, Trash2, Filter, Search, Receipt, Download, ChevronUp, ChevronDown } from 'lucide-react';
import toast from 'react-hot-toast';
import TransactionModal from '../components/TransactionModal';
import DeleteConfirmModal from '../components/DeleteConfirmModal';
import { formatCurrency, formatDate } from '../utils/format';

export default function Transactions() {
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

  useEffect(() => {
    loadTransactions();
  }, [filters]);

  useEffect(() => {
    loadCategories();
  }, []);

  const loadTransactions = async () => {
    try {
      setLoading(true);
      const params: any = {
        page: filters.page || 1,
        limit: 50,
      };
      if (filters.type) params.type = filters.type;
      if (filters.startDate) params.startDate = filters.startDate;
      if (filters.endDate) params.endDate = filters.endDate;
      if (filters.categoryId) params.categoryId = filters.categoryId;

      const response = await api.get('/transactions', { params });
      
      // Suportar resposta paginada
      if (response.data?.data && response.data?.meta) {
        const transactionsData = Array.isArray(response.data.data) ? response.data.data : [];
        // Garantir que todas as transações tenham categoria
        const validTransactions = transactionsData.filter((t: Transaction) => t && t.id);
        setTransactions(validTransactions);
        setPagination({
          page: response.data.meta.page,
          limit: response.data.meta.limit,
          total: response.data.meta.total,
          totalPages: response.data.meta.totalPages,
        });
      } else {
        // Backward compatibility
        const data = response.data?.data || response.data;
        const transactionsData = Array.isArray(data) ? data : [];
        const validTransactions = transactionsData.filter((t: Transaction) => t && t.id);
        setTransactions(validTransactions);
        setPagination({
          page: 1,
          limit: 50,
          total: validTransactions.length,
          totalPages: 1,
        });
      }
    } catch (error: any) {
      console.error('Erro ao carregar transações:', error);
      toast.error(error.response?.data?.message || 'Erro ao carregar transações');
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
  };

  const loadCategories = async () => {
    try {
      const response = await api.get('/categories');
      // Suportar resposta paginada ou array direto
      const data = response.data?.data || response.data;
      setCategories(Array.isArray(data) ? data : []);
    } catch (error) {
      console.error('Erro ao carregar categorias:', error);
      setCategories([]);
    }
  };

  const handleDelete = async (id: string) => {
    try {
      await api.delete(`/transactions/${id}`);
      toast.success('Transação excluída com sucesso');
      loadTransactions();
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

  const filteredTransactions = sortedTransactions.filter((t) =>
    searchQuery
      ? t.description?.toLowerCase().includes(searchQuery.toLowerCase())
      : true
  );

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

  const handleCloseModal = () => {
    setIsModalOpen(false);
    setEditingTransaction(null);
  };

  const handleSave = () => {
    loadTransactions();
    handleCloseModal();
  };

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-4xl font-bold text-gray-900 mb-2">Transações</h1>
          <p className="text-gray-600 text-lg">Gerencie suas receitas e despesas</p>
        </div>
        <button
          onClick={() => setIsModalOpen(true)}
          className="btn-primary flex items-center justify-center gap-2"
        >
          <Plus className="w-5 h-5" />
          <span>Nova Transação</span>
        </button>
      </div>

      {/* Busca e Filtros */}
      <div className="card-gradient">
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center">
            <div className="p-2 bg-green-100 rounded-lg mr-3">
              <Filter className="w-5 h-5 text-[#16A34A]" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-gray-900">Filtros</h2>
              <p className="text-sm text-gray-600">Filtre suas transações</p>
            </div>
          </div>
          <button
            onClick={handleExport}
            className="btn-secondary flex items-center gap-2"
            disabled={transactions.length === 0}
          >
            <Download className="w-4 h-4" />
            Exportar CSV
          </button>
        </div>

        {/* Busca */}
        <div className="mb-4">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Buscar por descrição..."
              className="input-field pl-10"
            />
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <select
            value={filters.type}
            onChange={(e) => setFilters({ ...filters, type: e.target.value })}
            className="input-field"
          >
            <option value="">Todos os tipos</option>
            <option value="INCOME">Receita</option>
            <option value="EXPENSE">Despesa</option>
          </select>

          <input
            type="date"
            value={filters.startDate}
            onChange={(e) => setFilters({ ...filters, startDate: e.target.value })}
            className="input-field"
            placeholder="Data inicial"
          />

          <input
            type="date"
            value={filters.endDate}
            onChange={(e) => setFilters({ ...filters, endDate: e.target.value })}
            className="input-field"
            placeholder="Data final"
          />

          <select
            value={filters.categoryId}
            onChange={(e) => setFilters({ ...filters, categoryId: e.target.value })}
            className="input-field"
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

      {/* Lista de transações */}
      <div className="card-gradient">
        {loading ? (
          <div className="flex flex-col items-center justify-center py-16">
            <svg className="animate-spin h-8 w-8 text-[#16A34A] mb-4" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
            </svg>
            <p className="text-gray-500">Carregando transações...</p>
          </div>
        ) : transactions.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16">
            <div className="w-20 h-20 bg-gray-100 rounded-full flex items-center justify-center mb-4">
              <Receipt className="w-10 h-10 text-gray-400" />
            </div>
            <p className="text-lg font-semibold text-gray-900 mb-2">Nenhuma transação encontrada</p>
            <p className="text-sm text-gray-600 mb-6">Comece adicionando sua primeira transação</p>
            <button
              onClick={() => setIsModalOpen(true)}
              className="btn-primary flex items-center justify-center gap-2"
            >
              <Plus className="w-5 h-5" />
              <span>Adicionar Transação</span>
            </button>
          </div>
        ) : (
          <div className="overflow-x-auto custom-scrollbar">
            <table className="w-full">
              <thead>
                <tr className="border-b border-gray-200">
                  <th
                    className="text-left py-4 px-6 font-semibold text-gray-700 text-sm uppercase tracking-wider cursor-pointer hover:bg-gray-50 transition-colors"
                    onClick={() => handleSort('date')}
                  >
                    Data <SortIcon field="date" />
                  </th>
                  <th
                    className="text-left py-4 px-6 font-semibold text-gray-700 text-sm uppercase tracking-wider cursor-pointer hover:bg-gray-50 transition-colors"
                    onClick={() => handleSort('description')}
                  >
                    Descrição <SortIcon field="description" />
                  </th>
                  <th className="text-left py-4 px-6 font-semibold text-gray-700 text-sm uppercase tracking-wider">Categoria</th>
                  <th className="text-left py-4 px-6 font-semibold text-gray-700 text-sm uppercase tracking-wider">Tipo</th>
                  <th
                    className="text-right py-4 px-6 font-semibold text-gray-700 text-sm uppercase tracking-wider cursor-pointer hover:bg-gray-50 transition-colors"
                    onClick={() => handleSort('amount')}
                  >
                    Valor <SortIcon field="amount" />
                  </th>
                  <th className="text-right py-4 px-6 font-semibold text-gray-700 text-sm uppercase tracking-wider">Ações</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {filteredTransactions.map((transaction, index) => (
                  <tr 
                    key={transaction.id} 
                    className="hover:bg-gray-50/50 transition-colors group"
                    style={{ animationDelay: `${index * 0.05}s` }}
                  >
                    <td className="py-4 px-6">
                      <span className="text-sm font-medium text-gray-900">
                        {formatDate(transaction.date)}
                      </span>
                    </td>
                    <td className="py-4 px-6">
                      <span className="text-sm text-gray-700">
                        {transaction.description || <span className="text-gray-400">Sem descrição</span>}
                      </span>
                    </td>
                    <td className="py-4 px-6">
                      {transaction.category ? (
                        <span
                          className="inline-flex items-center px-3 py-1 rounded-full text-xs font-semibold border"
                          style={{
                            backgroundColor: `${transaction.category.color}15`,
                            color: transaction.category.color,
                            borderColor: `${transaction.category.color}30`,
                          }}
                        >
                          {transaction.category.name}
                        </span>
                      ) : (
                        <span className="text-sm text-gray-400">Sem categoria</span>
                      )}
                    </td>
                    <td className="py-4 px-6">
                      <span
                        className={`inline-flex items-center px-3 py-1 rounded-full text-xs font-semibold ${
                          transaction.type === TransactionType.INCOME
                            ? 'bg-green-100 text-[#22C55E] border border-green-200'
                            : 'bg-red-100 text-[#EF4444] border border-red-200'
                        }`}
                      >
                        {transaction.type === TransactionType.INCOME ? 'Receita' : 'Despesa'}
                      </span>
                    </td>
                    <td
                      className={`py-4 px-6 text-right font-bold text-base ${
                        transaction.type === TransactionType.INCOME
                          ? 'text-[#22C55E]'
                          : 'text-[#EF4444]'
                      }`}
                    >
                      {transaction.type === TransactionType.INCOME ? '+' : '-'}
                      {formatCurrency(transaction.amount)}
                    </td>
                    <td className="py-4 px-6">
                      <div className="flex items-center justify-end gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                        <button
                          onClick={() => handleEdit(transaction)}
                          className="p-2 text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
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
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* Paginação */}
        {pagination.totalPages > 1 && (
          <div className="flex items-center justify-between mt-6 pt-6 border-t border-gray-200">
            <p className="text-sm text-gray-600">
              Mostrando {((pagination.page - 1) * pagination.limit) + 1} a{' '}
              {Math.min(pagination.page * pagination.limit, pagination.total)} de{' '}
              {pagination.total} transações
            </p>
            <div className="flex items-center gap-2">
              <button
                onClick={() => setFilters({ ...filters, page: pagination.page - 1 })}
                disabled={pagination.page === 1}
                className="btn-secondary disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Anterior
              </button>
              <span className="px-4 py-2 text-sm font-medium text-gray-700">
                {pagination.page} / {pagination.totalPages}
              </span>
              <button
                onClick={() => setFilters({ ...filters, page: pagination.page + 1 })}
                disabled={pagination.page === pagination.totalPages}
                className="btn-secondary disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Próxima
              </button>
            </div>
          </div>
        )}
      </div>

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
