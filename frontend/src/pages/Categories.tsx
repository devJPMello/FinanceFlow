import { useEffect, useState } from 'react';
import api from '../lib/api';
import { Category, TransactionType } from '../types';
import { Plus, Edit, Trash2, Search, Tag } from 'lucide-react';
import toast from 'react-hot-toast';
import CategoryModal from '../components/CategoryModal';
import DeleteConfirmModal from '../components/DeleteConfirmModal';

export default function Categories() {
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingCategory, setEditingCategory] = useState<Category | null>(null);
  const [deleteConfirm, setDeleteConfirm] = useState<{ id: string; name: string } | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [filterType, setFilterType] = useState<TransactionType | ''>('');

  useEffect(() => {
    loadCategories();
  }, []);

  const loadCategories = async () => {
    try {
      const response = await api.get('/categories');
      const data = response.data?.data || response.data;
      setCategories(Array.isArray(data) ? data : []);
    } catch (error) {
      toast.error('Erro ao carregar categorias');
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (id: string) => {
    try {
      await api.delete(`/categories/${id}`);
      toast.success('Categoria excluída com sucesso');
      loadCategories();
    } catch (error: any) {
      toast.error(error.response?.data?.message || 'Erro ao excluir categoria');
    }
  };

  const filteredCategories = categories.filter((c) => {
    const matchesSearch = c.name.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesType = !filterType || c.type === filterType;
    return matchesSearch && matchesType;
  });

  const handleEdit = (category: Category) => {
    setEditingCategory(category);
    setIsModalOpen(true);
  };

  const handleCloseModal = () => {
    setIsModalOpen(false);
    setEditingCategory(null);
  };

  const handleSave = () => {
    loadCategories();
    handleCloseModal();
  };

  const incomeCategories = filteredCategories.filter((c) => c.type === TransactionType.INCOME);
  const expenseCategories = filteredCategories.filter((c) => c.type === TransactionType.EXPENSE);

  // Mostrar apenas a seção correspondente ao filtro
  const showIncomeSection = !filterType || filterType === TransactionType.INCOME;
  const showExpenseSection = !filterType || filterType === TransactionType.EXPENSE;

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-4xl font-bold text-gray-900 mb-2">Categorias</h1>
          <p className="text-gray-600 text-lg">Organize suas receitas e despesas</p>
        </div>
        <button
          onClick={() => setIsModalOpen(true)}
          className="btn-primary flex items-center justify-center gap-2"
        >
          <Plus className="w-5 h-5" />
          <span>Nova Categoria</span>
        </button>
      </div>

      {/* Busca e Filtro */}
      <div className="card-gradient">
        <div className="flex flex-col sm:flex-row gap-4">
          <div className="relative flex-[3]">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Buscar categoria..."
              className="input-field pl-10 text-base w-full"
            />
          </div>
          <select
            value={filterType}
            onChange={(e) => setFilterType(e.target.value as TransactionType | '')}
            className="input-field flex-1 min-w-[150px] max-w-[200px]"
          >
            <option value="">Todos os tipos</option>
            <option value={TransactionType.INCOME}>Receitas</option>
            <option value={TransactionType.EXPENSE}>Despesas</option>
          </select>
        </div>
      </div>

      {/* Categorias de Receita - Mostrar apenas se não houver filtro ou se filtro for INCOME */}
      {showIncomeSection && (
        <div className="card-gradient">
          <h2 className="text-xl font-bold text-gray-900 mb-4">Receitas</h2>
          {loading ? (
            <div className="text-center py-8 text-gray-500">Carregando...</div>
          ) : incomeCategories.length === 0 ? (
            <div className="card-gradient text-center py-12">
              <Tag className="w-16 h-16 text-gray-300 mx-auto mb-4" />
              <h3 className="text-lg font-bold text-gray-900 mb-2">
                Nenhuma categoria de receita encontrada
              </h3>
              <p className="text-gray-600 mb-6">
                {searchQuery || filterType
                  ? 'Tente ajustar os filtros de busca'
                  : 'Crie categorias para organizar melhor suas receitas'}
              </p>
              {!searchQuery && !filterType && (
                <button onClick={() => setIsModalOpen(true)} className="btn-primary">
                  Criar primeira categoria de receita
                </button>
              )}
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {incomeCategories.map((category) => (
                <div
                  key={category.id}
                  className="p-4 border rounded-lg hover:shadow-md transition-shadow"
                  style={{ borderColor: `${category.color}40` }}
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center">
                      <div
                        className="w-10 h-10 rounded-lg flex items-center justify-center mr-3"
                        style={{ backgroundColor: `${category.color}20` }}
                      >
                        <span style={{ color: category.color }} className="text-xl">
                          {category.icon || '💰'}
                        </span>
                      </div>
                      <div>
                        <p className="font-semibold text-gray-900">{category.name}</p>
                        <p className="text-sm text-gray-500">Receita</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => handleEdit(category)}
                        className="p-2 text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                      >
                        <Edit className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() =>
                          setDeleteConfirm({
                            id: category.id,
                            name: category.name,
                          })
                        }
                        className="p-2 text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Categorias de Despesa - Mostrar apenas se não houver filtro ou se filtro for EXPENSE */}
      {showExpenseSection && (
        <div className="card-gradient">
          <h2 className="text-xl font-bold text-gray-900 mb-4">Despesas</h2>
          {loading ? (
            <div className="text-center py-8 text-gray-500">Carregando...</div>
          ) : expenseCategories.length === 0 ? (
            <div className="card-gradient text-center py-12">
              <Tag className="w-16 h-16 text-gray-300 mx-auto mb-4" />
              <h3 className="text-lg font-bold text-gray-900 mb-2">
                Nenhuma categoria de despesa encontrada
              </h3>
              <p className="text-gray-600 mb-6">
                {searchQuery || filterType
                  ? 'Tente ajustar os filtros de busca'
                  : 'Crie categorias para organizar melhor suas despesas'}
              </p>
              {!searchQuery && !filterType && (
                <button onClick={() => setIsModalOpen(true)} className="btn-primary">
                  Criar primeira categoria de despesa
                </button>
              )}
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {expenseCategories.map((category) => (
                <div
                  key={category.id}
                  className="p-4 border rounded-lg hover:shadow-md transition-shadow"
                  style={{ borderColor: `${category.color}40` }}
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center">
                      <div
                        className="w-10 h-10 rounded-lg flex items-center justify-center mr-3"
                        style={{ backgroundColor: `${category.color}20` }}
                      >
                        <span style={{ color: category.color }} className="text-xl">
                          {category.icon || '💸'}
                        </span>
                      </div>
                      <div>
                        <p className="font-semibold text-gray-900">{category.name}</p>
                        <p className="text-sm text-gray-500">Despesa</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => handleEdit(category)}
                        className="p-2 text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                      >
                        <Edit className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() =>
                          setDeleteConfirm({
                            id: category.id,
                            name: category.name,
                          })
                        }
                        className="p-2 text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {isModalOpen && (
        <CategoryModal
          category={editingCategory}
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
