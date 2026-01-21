import { useEffect, useState } from 'react';
import api from '../lib/api';
import { Goal } from '../types';
import { Plus, Edit, Trash2, Target, Filter } from 'lucide-react';
import toast from 'react-hot-toast';
import GoalModal from '../components/GoalModal';
import DeleteConfirmModal from '../components/DeleteConfirmModal';
import { formatCurrency, formatDate } from '../utils/format';

export default function Goals() {
  const [goals, setGoals] = useState<Goal[]>([]);
  const [loading, setLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingGoal, setEditingGoal] = useState<Goal | null>(null);
  const [deleteConfirm, setDeleteConfirm] = useState<{ id: string; title: string } | null>(null);
  const [filterStatus, setFilterStatus] = useState<'all' | 'active' | 'completed' | 'overdue'>('all');

  useEffect(() => {
    loadGoals();
  }, []);

  const loadGoals = async () => {
    try {
      const response = await api.get('/goals');
      const data = response.data?.data || response.data;
      setGoals(Array.isArray(data) ? data : []);
    } catch (error) {
      toast.error('Erro ao carregar metas');
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (id: string) => {
    try {
      await api.delete(`/goals/${id}`);
      toast.success('Meta excluída com sucesso');
      loadGoals();
    } catch (error: any) {
      toast.error(error.response?.data?.message || 'Erro ao excluir meta');
    }
  };

  const handleEdit = (goal: Goal) => {
    setEditingGoal(goal);
    setIsModalOpen(true);
  };

  const handleCloseModal = () => {
    setIsModalOpen(false);
    setEditingGoal(null);
  };

  const handleSave = () => {
    loadGoals();
    handleCloseModal();
  };

  const getProgress = (goal: Goal) => {
    return Math.min((goal.currentAmount / goal.targetAmount) * 100, 100);
  };

  const isOverdue = (deadline: string) => {
    return new Date(deadline) < new Date();
  };

  const filteredGoals = goals.filter((goal) => {
    const progress = getProgress(goal);
    const overdue = isOverdue(goal.deadline);

    if (filterStatus === 'completed') return progress >= 100;
    if (filterStatus === 'overdue') return overdue && progress < 100;
    if (filterStatus === 'active') return !overdue && progress < 100;
    return true;
  });

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-4xl font-bold text-gray-900 mb-2">Metas Financeiras</h1>
          <p className="text-gray-600 text-lg">Acompanhe seus objetivos</p>
        </div>
        <button
          onClick={() => setIsModalOpen(true)}
          className="btn-primary flex items-center justify-center gap-2"
        >
          <Plus className="w-5 h-5" />
          <span>Nova Meta</span>
        </button>
      </div>

      {/* Filtros */}
      <div className="card-gradient">
        <div className="flex items-center mb-4">
          <div className="p-2 bg-green-100 rounded-lg mr-3">
            <Filter className="w-5 h-5 text-[#16A34A]" />
          </div>
          <div>
            <h2 className="text-lg font-bold text-gray-900">Filtros</h2>
            <p className="text-sm text-gray-600">Filtre suas metas</p>
          </div>
        </div>
        <select
          value={filterStatus}
          onChange={(e) => setFilterStatus(e.target.value as any)}
          className="input-field"
        >
          <option value="all">Todas as metas</option>
          <option value="active">Ativas</option>
          <option value="completed">Completas</option>
          <option value="overdue">Vencidas</option>
        </select>
      </div>

      {loading ? (
        <div className="text-center py-8 text-gray-500">Carregando...</div>
      ) : filteredGoals.length === 0 ? (
        <div className="card-gradient text-center py-12">
          <Target className="w-16 h-16 text-gray-300 mx-auto mb-4" />
          <h3 className="text-lg font-bold text-gray-900 mb-2">
            {goals.length === 0 ? 'Nenhuma meta cadastrada' : 'Nenhuma meta encontrada'}
          </h3>
          <p className="text-gray-600 mb-6">
            {goals.length === 0
              ? 'Crie sua primeira meta financeira para começar'
              : 'Tente ajustar os filtros de busca'}
          </p>
          {goals.length === 0 && (
            <button onClick={() => setIsModalOpen(true)} className="btn-primary">
              Criar primeira meta
            </button>
          )}
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {filteredGoals.map((goal, index) => {
            const progress = getProgress(goal);
            const overdue = isOverdue(goal.deadline);

            return (
              <div
                key={goal.id}
                className="card-gradient hover:scale-[1.02] transition-transform duration-200"
                style={{ animationDelay: `${index * 0.1}s` }}
              >
                <div className="flex items-start justify-between mb-4">
                  <div className="flex-1">
                    <h3 className="text-lg font-bold text-gray-900 mb-1">
                      {goal.title}
                    </h3>
                    <p className="text-sm text-gray-600">
                      Prazo: {formatDate(goal.deadline)}
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => handleEdit(goal)}
                      className="p-2 text-blue-600 hover:bg-blue-50 rounded"
                    >
                      <Edit className="w-4 h-4" />
                    </button>
                    <button
                      onClick={() =>
                        setDeleteConfirm({
                          id: goal.id,
                          title: goal.title,
                        })
                      }
                      className="p-2 text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>

                <div className="mb-4">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-sm text-gray-600">Progresso</span>
                    <span className="text-sm font-semibold text-gray-900">
                      {progress.toFixed(1)}%
                    </span>
                  </div>
                  <div className="w-full bg-gray-200 rounded-full h-3">
                    <div
                      className={`h-3 rounded-full transition-all duration-500 ${
                        progress >= 100
                          ? 'bg-[#22C55E]'
                          : overdue
                          ? 'bg-[#EF4444]'
                          : 'bg-[#16A34A]'
                      }`}
                      style={{ width: `${progress}%` }}
                    />
                  </div>
                  <div className="flex justify-between mt-2 text-xs text-[#6B7280]">
                    <span>{formatCurrency(goal.currentAmount)}</span>
                    <span>{formatCurrency(goal.targetAmount)}</span>
                  </div>
                </div>

                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-[#6B7280]">Atual</span>
                    <span className="text-sm font-semibold text-[#111827]">
                      {formatCurrency(goal.currentAmount)}
                    </span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-[#6B7280]">Meta</span>
                    <span className="text-sm font-semibold text-[#111827]">
                      {formatCurrency(goal.targetAmount)}
                    </span>
                  </div>
                  <div className="flex items-center justify-between pt-2 border-t">
                    <span className="text-sm text-[#6B7280]">Faltam</span>
                    <span className="text-sm font-bold text-[#16A34A]">
                      {formatCurrency(Math.max(0, goal.targetAmount - goal.currentAmount))}
                    </span>
                  </div>
                </div>

                {overdue && (
                  <div className="mt-4 p-2 bg-red-50 rounded text-center">
                    <p className="text-sm text-[#EF4444] font-medium">Prazo expirado</p>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {isModalOpen && (
        <GoalModal
          goal={editingGoal}
          onClose={handleCloseModal}
          onSave={handleSave}
        />
      )}

      <DeleteConfirmModal
        isOpen={!!deleteConfirm}
        onClose={() => setDeleteConfirm(null)}
        onConfirm={() => deleteConfirm && handleDelete(deleteConfirm.id)}
        title="Confirmar exclusão"
        message="Tem certeza que deseja excluir esta meta? Esta ação não pode ser desfeita."
        itemName={deleteConfirm?.title}
      />
    </div>
  );
}
