import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import api from '../lib/api';
import { DashboardSummary, MonthlyData, CategoryStat } from '../types';
import {
  TrendingUp,
  TrendingDown,
  DollarSign,
  Receipt,
  ArrowUpRight,
  ArrowDownRight,
  RefreshCw,
  AlertCircle,
} from 'lucide-react';
import {
  BarChart,
  Bar,
  PieChart,
  Pie,
  Cell,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from 'recharts';
import { formatCurrency } from '../utils/format';
import toast from 'react-hot-toast';

const COLORS = ['#6366f1', '#8b5cf6', '#ec4899', '#f59e0b', '#10b981', '#3b82f6', '#06b6d4'];

export default function Dashboard() {
  const [summary, setSummary] = useState<DashboardSummary | null>(null);
  const [monthlyData, setMonthlyData] = useState<MonthlyData[]>([]);
  const [categoryStats, setCategoryStats] = useState<CategoryStat[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [selectedYear, setSelectedYear] = useState(new Date().getFullYear());

  const years = Array.from({ length: 5 }, (_, i) => new Date().getFullYear() - i);

  useEffect(() => {
    loadDashboardData();
  }, [selectedYear]);

  const loadDashboardData = async (isRefresh = false) => {
    try {
      if (isRefresh) setRefreshing(true);
      setError(null);
      
      const [summaryRes, monthlyRes, categoriesRes] = await Promise.all([
        api.get('/dashboard/summary'),
        api.get(`/dashboard/monthly?year=${selectedYear}`),
        api.get('/dashboard/categories'),
      ]);

      setSummary(summaryRes.data);
      setMonthlyData(monthlyRes.data);
      setCategoryStats(categoriesRes.data);
    } catch (error: any) {
      const errorMessage = error.response?.data?.message || 'Erro ao carregar dados do dashboard';
      setError(errorMessage);
      toast.error(errorMessage);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  if (error && !loading) {
    return (
      <div className="space-y-8 animate-fade-in">
        <div className="card-gradient border-2 border-red-200 bg-red-50">
          <div className="flex flex-col items-center justify-center py-12">
            <AlertCircle className="w-16 h-16 text-red-600 mb-4" />
            <h3 className="text-xl font-bold text-red-900 mb-2">Erro ao carregar dados</h3>
            <p className="text-red-700 mb-6 text-center">{error}</p>
            <button onClick={() => loadDashboardData(true)} className="btn-primary">
              <RefreshCw className="w-4 h-4 mr-2" />
              Tentar novamente
            </button>
          </div>
        </div>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="space-y-8 animate-fade-in">
        <div>
          <h1 className="text-4xl font-bold text-gray-900 mb-2">Dashboard</h1>
          <p className="text-gray-600 text-lg">Visão geral das suas finanças</p>
        </div>

        {/* Skeleton Loading */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="card-gradient animate-pulse">
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <div className="h-4 bg-gray-200 rounded w-24 mb-3"></div>
                  <div className="h-8 bg-gray-200 rounded w-32 mb-3"></div>
                  <div className="h-6 bg-gray-200 rounded w-20"></div>
                </div>
                <div className="w-16 h-16 bg-gray-200 rounded-2xl"></div>
              </div>
            </div>
          ))}
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {[1, 2].map((i) => (
            <div key={i} className="card-gradient animate-pulse">
              <div className="h-6 bg-gray-200 rounded w-48 mb-4"></div>
              <div className="h-64 bg-gray-200 rounded"></div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  const monthNames = [
    'Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun',
    'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez',
  ];

  const chartData = monthlyData.map((item) => ({
    ...item,
    month: monthNames[item.month - 1],
  }));

  const isPositive = (summary?.balance || 0) >= 0;

  const hasNoData = !summary || (summary.transactionCount === 0 && monthlyData.length === 0);

  return (
    <div className="space-y-8 animate-fade-in">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-4xl font-bold text-gray-900 mb-2">Dashboard</h1>
          <p className="text-gray-600 text-lg">Visão geral das suas finanças</p>
        </div>
        <div className="flex items-center gap-3">
          <select
            value={selectedYear}
            onChange={(e) => setSelectedYear(Number(e.target.value))}
            className="input-field"
          >
            {years.map((year) => (
              <option key={year} value={year}>
                {year}
              </option>
            ))}
          </select>
          <button
            onClick={() => loadDashboardData(true)}
            disabled={refreshing}
            className="btn-secondary flex items-center gap-2"
            title="Atualizar dados"
          >
            <RefreshCw className={`w-4 h-4 ${refreshing ? 'animate-spin' : ''}`} />
            {refreshing ? 'Atualizando...' : 'Atualizar'}
          </button>
        </div>
      </div>

      {hasNoData ? (
        <div className="card-gradient text-center py-16">
          <TrendingUp className="w-20 h-20 text-gray-300 mx-auto mb-4" />
          <h3 className="text-xl font-bold text-gray-900 mb-2">
            Comece a registrar suas finanças
          </h3>
          <p className="text-gray-600 mb-6">
            Adicione sua primeira transação para ver os dados aqui
          </p>
          <Link to="/transactions" className="btn-primary inline-flex items-center gap-2">
            <Receipt className="w-5 h-5" />
            Criar primeira transação
          </Link>
        </div>
      ) : (
        <>

      {/* Cards de resumo */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <div className="card-gradient group hover:scale-[1.02] transition-transform duration-300">
          <div className="flex items-start justify-between">
            <div className="flex-1">
              <p className="text-sm font-semibold text-gray-600 mb-1">Saldo Atual</p>
              <p className={`text-3xl font-bold mb-2 ${
                isPositive ? 'text-[#22C55E]' : 'text-[#EF4444]'
              }`}>
                {formatCurrency(summary?.balance || 0)}
              </p>
              <div className={`inline-flex items-center text-xs font-medium px-2 py-1 rounded-full ${
                isPositive 
                  ? 'bg-green-100 text-[#22C55E]' 
                  : 'bg-red-100 text-[#EF4444]'
              }`}>
                {isPositive ? (
                  <>
                    <ArrowUpRight className="w-3 h-3 mr-1" />
                    Positivo
                  </>
                ) : (
                  <>
                    <ArrowDownRight className="w-3 h-3 mr-1" />
                    Negativo
                  </>
                )}
              </div>
            </div>
            <div className="p-4 bg-[#16A34A] rounded-2xl shadow-lg shadow-[#16A34A]/30">
              <DollarSign className="w-7 h-7 text-white" />
            </div>
          </div>
        </div>

        <div className="card-gradient group hover:scale-[1.02] transition-transform duration-300">
          <div className="flex items-start justify-between">
            <div className="flex-1">
              <p className="text-sm font-semibold text-gray-600 mb-1">Total de Receitas</p>
              <p className="text-3xl font-bold text-[#22C55E] mb-2">
                {formatCurrency(summary?.totalIncome || 0)}
              </p>
              <div className="inline-flex items-center text-xs font-medium px-2 py-1 rounded-full bg-green-100 text-[#22C55E]">
                <TrendingUp className="w-3 h-3 mr-1" />
                Entradas
              </div>
            </div>
            <div className="p-4 bg-[#22C55E] rounded-2xl shadow-lg shadow-[#22C55E]/30">
              <TrendingUp className="w-7 h-7 text-white" />
            </div>
          </div>
        </div>

        <div className="card-gradient group hover:scale-[1.02] transition-transform duration-300">
          <div className="flex items-start justify-between">
            <div className="flex-1">
              <p className="text-sm font-semibold text-gray-600 mb-1">Total de Despesas</p>
              <p className="text-3xl font-bold text-[#EF4444] mb-2">
                {formatCurrency(summary?.totalExpense || 0)}
              </p>
              <div className="inline-flex items-center text-xs font-medium px-2 py-1 rounded-full bg-red-100 text-[#EF4444]">
                <TrendingDown className="w-3 h-3 mr-1" />
                Saídas
              </div>
            </div>
            <div className="p-4 bg-[#EF4444] rounded-2xl shadow-lg shadow-[#EF4444]/30">
              <TrendingDown className="w-7 h-7 text-white" />
            </div>
          </div>
        </div>

        <div className="card-gradient group hover:scale-[1.02] transition-transform duration-300">
          <div className="flex items-start justify-between">
            <div className="flex-1">
              <p className="text-sm font-semibold text-gray-600 mb-1">Transações</p>
              <p className="text-3xl font-bold text-gray-900 mb-2">
                {summary?.transactionCount || 0}
              </p>
              <div className="inline-flex items-center text-xs font-medium px-2 py-1 rounded-full bg-gray-100 text-gray-700">
                <Receipt className="w-3 h-3 mr-1" />
                Total
              </div>
            </div>
            <div className="p-4 bg-gradient-to-br from-gray-500 to-gray-600 rounded-2xl shadow-lg shadow-gray-500/30">
              <Receipt className="w-7 h-7 text-white" />
            </div>
          </div>
        </div>
      </div>

      {/* Gráficos */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="card-gradient">
          <div className="mb-6">
            <h2 className="text-xl font-bold text-gray-900 mb-1">
              Receitas e Despesas Mensais
            </h2>
            <p className="text-sm text-gray-600">Comparativo mensal do ano</p>
          </div>
          <ResponsiveContainer width="100%" height={320}>
            <BarChart data={chartData}>
              <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
              <XAxis 
                dataKey="month" 
                stroke="#6b7280"
                style={{ fontSize: '12px' }}
              />
              <YAxis 
                stroke="#6b7280"
                style={{ fontSize: '12px' }}
                tickFormatter={(value) => `R$ ${(value / 1000).toFixed(0)}k`}
              />
              <Tooltip 
                formatter={(value: number) => formatCurrency(value)}
                contentStyle={{
                  backgroundColor: 'white',
                  border: '1px solid #e5e7eb',
                  borderRadius: '12px',
                  padding: '12px',
                }}
              />
              <Legend />
              <Bar 
                dataKey="income" 
                fill="#22C55E" 
                name="Receitas"
                radius={[8, 8, 0, 0]}
              />
              <Bar 
                dataKey="expense" 
                fill="#EF4444" 
                name="Despesas"
                radius={[8, 8, 0, 0]}
              />
            </BarChart>
          </ResponsiveContainer>
        </div>

        <div className="card-gradient">
          <div className="mb-6">
            <h2 className="text-xl font-bold text-gray-900 mb-1">
              Despesas por Categoria
            </h2>
            <p className="text-sm text-gray-600">Distribuição dos gastos</p>
          </div>
          {categoryStats.length > 0 ? (
            <ResponsiveContainer width="100%" height={320}>
              <PieChart>
                <Pie
                  data={categoryStats}
                  dataKey="amount"
                  nameKey="name"
                  cx="50%"
                  cy="50%"
                  outerRadius={100}
                  label={({ name, percent }) => `${name} (${(percent * 100).toFixed(0)}%)`}
                  labelLine={false}
                >
                  {categoryStats.map((_, index) => (
                    <Cell 
                      key={`cell-${index}`} 
                      fill={COLORS[index % COLORS.length]}
                    />
                  ))}
                </Pie>
                <Tooltip 
                  formatter={(value: number) => formatCurrency(value)}
                  contentStyle={{
                    backgroundColor: 'white',
                    border: '1px solid #e5e7eb',
                    borderRadius: '12px',
                    padding: '12px',
                  }}
                />
              </PieChart>
            </ResponsiveContainer>
          ) : (
            <div className="flex flex-col items-center justify-center h-64 text-gray-500">
              <Receipt className="w-16 h-16 mb-4 opacity-50" />
              <p className="text-lg font-medium">Nenhuma categoria encontrada</p>
              <p className="text-sm mt-1">Adicione transações para ver os dados</p>
            </div>
          )}
        </div>
      </div>
        </>
      )}
    </div>
  );
}
