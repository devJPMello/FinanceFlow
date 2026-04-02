import { useEffect, useState, useRef, useCallback } from 'react';
import { Link } from 'react-router-dom';
import api from '../lib/api';
import {
  DashboardSummary,
  MonthlyData,
  CategoryStat,
  DashboardMonthSummary,
  PendingPanel,
  BudgetOverviewRow,
  MonthlyClosing,
} from '../types';
import {
  TrendingUp,
  Receipt,
  RefreshCw,
  AlertCircle,
  AlertTriangle,
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
import { getApiErrorWithRequestId } from '../lib/apiErrors';
import { dashboardFocusMonth } from '../lib/periodContext';

const COLORS = ['#6366f1', '#8b5cf6', '#ec4899', '#f59e0b', '#10b981', '#3b82f6', '#06b6d4'];

function transactionsPathWithMonth(actionPath: string, month: string): string {
  const [pathOnly, hash] = actionPath.split('#');
  const sep = pathOnly.includes('?') ? '&' : '?';
  return `${pathOnly}${sep}month=${encodeURIComponent(month)}${hash ? `#${hash}` : ''}`;
}

export default function Dashboard() {
  const [summary, setSummary] = useState<DashboardSummary | null>(null);
  const [monthSummary, setMonthSummary] = useState<DashboardMonthSummary | null>(null);
  const [monthlyData, setMonthlyData] = useState<MonthlyData[]>([]);
  const [categoryStats, setCategoryStats] = useState<CategoryStat[]>([]);
  const [pending, setPending] = useState<PendingPanel | null>(null);
  const [budgetOverview, setBudgetOverview] = useState<BudgetOverviewRow[]>([]);
  const [monthlyClosing, setMonthlyClosing] = useState<MonthlyClosing | null>(null);
  const [loading, setLoading] = useState(true);
  const [extrasLoading, setExtrasLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [selectedYear, setSelectedYear] = useState(new Date().getFullYear());
  const initialLoadDone = useRef(false);

  const years = Array.from({ length: 5 }, (_, i) => new Date().getFullYear() - i);
  const focusMonthKey = dashboardFocusMonth(selectedYear);

  const loadDashboardData = useCallback(async (options?: { isRefresh?: boolean }) => {
    const isRefresh = options?.isRefresh ?? false;
    const firstPaint = !initialLoadDone.current;
    try {
      if (isRefresh) {
        setRefreshing(true);
      } else if (!firstPaint) {
        setRefreshing(true);
      }
      setExtrasLoading(true);
      if (firstPaint) {
        setLoading(true);
      } else {
        setCategoryStats([]);
        setBudgetOverview([]);
        setMonthlyClosing(null);
        setPending(null);
      }
      setError(null);

      const focusMonth = dashboardFocusMonth(selectedYear);

      const [summaryRes, monthlyRes, monthSummaryRes] = await Promise.all([
        api.get('/dashboard/summary'),
        api.get(`/dashboard/monthly?year=${selectedYear}`),
        api.get('/dashboard/month-summary', { params: { month: focusMonth } }),
      ]);

      setSummary(summaryRes.data);
      setMonthlyData(monthlyRes.data);
      setMonthSummary(monthSummaryRes.data);
      setLoading(false);
      if (firstPaint) {
        initialLoadDone.current = true;
      }

      void Promise.all([
        api.get('/dashboard/categories'),
        api.get('/dashboard/pending'),
        api.get('/dashboard/budget-overview', { params: { month: focusMonth } }),
        api.get<MonthlyClosing>('/dashboard/monthly-closing', { params: { month: focusMonth } }),
      ])
        .then(([categoriesRes, pendingRes, budgetRes, closingRes]) => {
          setCategoryStats(categoriesRes.data);
          setPending(pendingRes.data);
          setBudgetOverview(Array.isArray(budgetRes.data) ? budgetRes.data : []);
          setMonthlyClosing(closingRes.data);
        })
        .catch((err: unknown) => {
          console.error(err);
          toast.error(getApiErrorWithRequestId(err));
        })
        .finally(() => {
          setExtrasLoading(false);
          setRefreshing(false);
        });
    } catch (error: unknown) {
      const errorMessage = getApiErrorWithRequestId(error);
      setError(errorMessage);
      toast.error(errorMessage);
      setLoading(false);
      setExtrasLoading(false);
      setRefreshing(false);
    }
  }, [selectedYear]);

  useEffect(() => {
    void loadDashboardData();
  }, [loadDashboardData]);

  if (error && !loading) {
    return (
      <div className="space-y-8 animate-fade-in">
        <div className="card-gradient border-2 border-red-200 bg-red-50">
          <div className="flex flex-col items-center justify-center py-12">
            <AlertCircle className="w-16 h-16 text-red-600 mb-4" />
            <h3 className="text-xl font-bold text-red-900 mb-2">Erro ao carregar dados</h3>
            <p className="text-red-700 mb-6 text-center">{error}</p>
            <button
              type="button"
              onClick={() => void loadDashboardData({ isRefresh: true })}
              className="btn-primary inline-flex items-center justify-center gap-2"
            >
              <RefreshCw className="w-4 h-4 shrink-0" />
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
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="card-gradient animate-pulse p-4">
              <div className="h-3 bg-gray-200 rounded w-20 mb-3" />
              <div className="h-7 bg-gray-200 rounded w-28 mb-2" />
              <div className="h-3 bg-gray-100 rounded w-16" />
            </div>
          ))}
        </div>

        <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
          <div className="xl:col-span-2 card-gradient animate-pulse">
            <div className="h-5 bg-gray-200 rounded w-56 mb-2" />
            <div className="h-4 bg-gray-100 rounded w-40 mb-6" />
            <div className="h-[min(22rem,55vw)] bg-gray-100 rounded-xl" />
          </div>
          <div className="card-gradient animate-pulse">
            <div className="h-5 bg-gray-200 rounded w-40 mb-2" />
            <div className="h-4 bg-gray-100 rounded w-32 mb-4" />
            <div className="h-52 bg-gray-100 rounded-xl" />
          </div>
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

  const isPositive = (monthSummary?.balance ?? summary?.balance ?? 0) >= 0;
  const monthVariationLabel = (() => {
    if (!monthSummary || monthSummary.balanceVariationPercent === null) return 'Sem base comparativa';
    const value = monthSummary.balanceVariationPercent;
    return `${value >= 0 ? '+' : ''}${value.toFixed(1)}% vs mês anterior`;
  })();

  const hasNoData = !summary || (summary.transactionCount === 0 && monthlyData.length === 0);

  return (
    <div className="space-y-8 animate-fade-in">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-4xl font-bold text-gray-900 mb-2">Dashboard</h1>
          <p className="text-gray-600 text-lg">Resumo financeiro com contexto mensal</p>
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
            onClick={() => void loadDashboardData({ isRefresh: true })}
            disabled={refreshing}
            className="btn-secondary flex items-center gap-2"
            title="Atualizar dados"
          >
            <RefreshCw className={`w-4 h-4 ${refreshing ? 'animate-spin' : ''}`} />
            {refreshing ? 'Atualizando...' : 'Atualizar'}
          </button>
        </div>
      </div>

      <div className="card-gradient border border-gray-100">
        <div className="flex items-center justify-between gap-3 mb-4 flex-wrap">
          <div className="flex items-center gap-2 flex-wrap min-w-0">
            <h2 className="text-xl font-bold text-gray-900">Resumo do mês</h2>
            {monthSummary?.month && (
              <span className="text-xs font-semibold text-gray-500 tabular-nums shrink-0">
                {monthSummary.month}
              </span>
            )}
            <Link
              to={`/transactions?month=${encodeURIComponent(focusMonthKey)}`}
              className="text-xs font-semibold text-indigo-600 hover:text-indigo-800 hover:underline shrink-0"
            >
              Ver transações deste período →
            </Link>
          </div>
          <span
            className={`text-xs font-semibold px-2.5 py-1 rounded-full ${
              monthSummary?.balanceVariationPercent && monthSummary.balanceVariationPercent < 0
                ? 'bg-red-100 text-[#EF4444]'
                : 'bg-green-100 text-[#16A34A]'
            }`}
          >
            {monthVariationLabel}
          </span>
        </div>
        <div className="rounded-xl border border-gray-100/90 bg-slate-50/60 p-3 sm:p-4 grid grid-cols-1 sm:grid-cols-3 gap-3 sm:gap-4">
          <div className="rounded-lg border border-transparent bg-white/60 px-3 py-2.5">
            <p className="text-[10px] sm:text-xs uppercase tracking-wide text-gray-500 font-semibold">Saldo</p>
            <p
              className={`text-lg sm:text-xl font-bold tabular-nums ff-tabular-nums tracking-tight ${
                isPositive ? 'text-[#16A34A]' : 'text-[#EF4444]'
              }`}
            >
              {formatCurrency(monthSummary?.balance ?? 0)}
            </p>
          </div>
          <div className="rounded-lg border border-transparent bg-white/60 px-3 py-2.5">
            <p className="text-[10px] sm:text-xs uppercase tracking-wide text-gray-500 font-semibold">Receitas</p>
            <p className="text-lg sm:text-xl font-bold text-[#16A34A] tabular-nums ff-tabular-nums tracking-tight">
              {formatCurrency(monthSummary?.totalIncome ?? 0)}
            </p>
          </div>
          <div className="rounded-lg border border-transparent bg-white/60 px-3 py-2.5">
            <p className="text-[10px] sm:text-xs uppercase tracking-wide text-gray-500 font-semibold">Despesas</p>
            <p className="text-lg sm:text-xl font-bold text-[#EF4444] tabular-nums ff-tabular-nums tracking-tight">
              {formatCurrency(monthSummary?.totalExpense ?? 0)}
            </p>
          </div>
        </div>
      </div>

      <div className="card-gradient">
        <div className="flex items-center gap-3 mb-4">
          <div className="p-2 rounded-xl bg-amber-100">
            <AlertTriangle className="w-5 h-5 text-amber-600" />
          </div>
          <div>
            <h2 className="text-xl font-bold text-gray-900">Pendências</h2>
            <p className="text-sm text-gray-600">Painel único para revisar o que está faltando</p>
          </div>
        </div>
        <div className="rounded-xl border border-gray-100 bg-gray-50 divide-y divide-gray-100">
          {extrasLoading ? (
            <div className="px-4 py-4 space-y-3 animate-pulse">
              {[1, 2, 3, 4].map((i) => (
                <div key={i} className="flex justify-between gap-4">
                  <div className="h-4 bg-gray-200 rounded w-48" />
                  <div className="h-4 bg-gray-200 rounded w-8" />
                </div>
              ))}
            </div>
          ) : (
            <>
              {(pending?.items ?? []).map((item) => (
                <Link
                  key={item.id}
                  to={item.actionPath}
                  className="flex items-center justify-between px-4 py-3 hover:bg-gray-100/70 transition-colors"
                >
                  <span className="text-sm font-medium text-gray-700">{item.label}</span>
                  <span className="text-sm font-bold text-gray-900">{item.count}</span>
                </Link>
              ))}
              {(!pending || pending.items.length === 0) && (
                <div className="px-4 py-6 text-sm text-gray-500">Nenhuma pendência no momento.</div>
              )}
            </>
          )}
        </div>
      </div>

      {monthlyClosing && (
        <div className="card-gradient border border-gray-100">
          <div className="flex items-center justify-between gap-3 mb-4">
            <div>
              <h2 className="text-xl font-bold text-gray-900">Fechamento mensal</h2>
              <p className="text-sm text-gray-600">
                {monthlyClosing.month} · {monthlyClosing.completedSteps}/{monthlyClosing.totalSteps - 1} passos
                concluídos ({monthlyClosing.percent}%)
                {monthlyClosing.monthTransactionCount === 0 && (
                  <span className="block mt-1 text-gray-500">
                    Sem lançamentos neste mês — os três primeiros itens só contam depois que houver movimentos.
                  </span>
                )}
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-2 shrink-0 justify-end">
              <Link
                to={`/transactions?month=${encodeURIComponent(monthlyClosing.month)}`}
                className="btn-secondary text-sm py-2 px-3"
                title="Abrir lançamentos filtrados por este mês"
              >
                Ver transações
              </Link>
              <Link to="/tax-vision" className="btn-secondary text-sm py-2 px-3">
                TaxVision
              </Link>
            </div>
          </div>
          <div className="w-full h-2 rounded-full bg-gray-200 overflow-hidden mb-4">
            <div
              className="h-full bg-indigo-600 transition-all"
              style={{ width: `${monthlyClosing.percent}%` }}
            />
          </div>
          <div className="rounded-xl border border-gray-100 bg-gray-50 divide-y divide-gray-100">
            {monthlyClosing.steps.map((step) => (
              <Link
                key={step.key}
                to={
                  step.key === 'review-details' || step.key === 'attachments'
                    ? transactionsPathWithMonth(step.actionPath, monthlyClosing.month)
                    : step.actionPath
                }
                className="flex items-center justify-between px-4 py-3 hover:bg-gray-100/70 transition-colors"
              >
                <div>
                  <p className="text-sm font-medium text-gray-900">{step.title}</p>
                  <p className="text-xs text-gray-500">{step.detail}</p>
                </div>
                <span
                  className={`text-xs font-bold px-2 py-0.5 rounded-full ${
                    step.key === 'export'
                      ? 'bg-gray-100 text-gray-600'
                      : step.applicable === false
                        ? 'bg-gray-100 text-gray-500 font-semibold'
                        : step.done
                          ? 'bg-green-100 text-[#16A34A]'
                          : 'bg-amber-100 text-amber-800'
                  }`}
                >
                  {step.key === 'export'
                    ? 'Ação'
                    : step.applicable === false
                      ? '—'
                      : step.done
                        ? 'OK'
                        : step.count}
                </span>
              </Link>
            ))}
          </div>
        </div>
      )}

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

      {/* Gráficos — barras em destaque; pizza como complemento */}
      <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
        <div className="xl:col-span-2 card-gradient border border-gray-200/70">
          <div className="mb-5">
            <h2 className="text-xl font-bold text-gray-900 mb-1">
              Receitas e despesas mensais
            </h2>
            <p className="text-sm text-gray-600">Visão principal do ano — comparativo mês a mês</p>
          </div>
          <ResponsiveContainer width="100%" height={360}>
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

        <div className="card-gradient border border-dashed border-gray-200/90 bg-gradient-to-b from-slate-50/30 to-white/80">
          <div className="mb-3">
            <p className="text-[11px] font-semibold uppercase tracking-wide text-gray-400 mb-1">
              Complementar
            </p>
            <h2 className="text-base font-bold text-gray-800 mb-0.5">Despesas por categoria</h2>
            <p className="text-xs text-gray-500">Distribuição relativa dos gastos</p>
          </div>
          {extrasLoading ? (
            <div className="h-56 rounded-xl bg-gray-100/80 animate-pulse" />
          ) : categoryStats.length > 0 ? (
            <ResponsiveContainer width="100%" height={260}>
              <PieChart>
                <Pie
                  data={categoryStats}
                  dataKey="amount"
                  nameKey="name"
                  cx="50%"
                  cy="50%"
                  outerRadius={78}
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
                    padding: '10px',
                    fontVariantNumeric: 'tabular-nums',
                  }}
                />
              </PieChart>
            </ResponsiveContainer>
          ) : (
            <div className="flex flex-col items-center justify-center h-52 text-gray-500">
              <Receipt className="w-16 h-16 mb-4 opacity-50" />
              <p className="text-lg font-medium">Nenhuma categoria encontrada</p>
              <p className="text-sm mt-1">Adicione transações para ver os dados</p>
            </div>
          )}
        </div>
      </div>

      <div className="card-gradient">
        <div className="flex items-center justify-between gap-3 mb-4">
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <h2 className="text-xl font-bold text-gray-900">Orçamento mensal por categoria</h2>
              {monthSummary?.month && (
                <span className="text-xs font-semibold text-gray-500 tabular-nums">
                  {monthSummary.month}
                </span>
              )}
            </div>
            <p className="text-sm text-gray-600">Semáforo por categoria com projeção até o fim do mês</p>
          </div>
        </div>
        <div className="rounded-xl border border-gray-100 bg-gray-50 overflow-hidden">
          {extrasLoading ? (
            <div className="px-4 py-4 space-y-4 animate-pulse">
              {[1, 2, 3].map((i) => (
                <div key={i} className="space-y-2">
                  <div className="h-4 bg-gray-200 rounded w-40" />
                  <div className="h-2 bg-gray-200 rounded w-full" />
                </div>
              ))}
            </div>
          ) : budgetOverview.length === 0 ? (
            <div className="px-4 py-6 text-sm text-gray-500">
              Nenhum orçamento cadastrado. Configure os limites nas categorias.
            </div>
          ) : (
            <div className="divide-y divide-gray-100">
              {budgetOverview.slice(0, 8).map((row) => (
                <div key={row.categoryId} className="px-4 py-3">
                  <div className="flex items-center justify-between gap-3 mb-2">
                    <p className="text-sm font-semibold text-gray-900">{row.categoryName}</p>
                    <span
                      className={`text-xs font-bold px-2 py-0.5 rounded-full ${
                        row.status === 'red'
                          ? 'bg-red-100 text-[#EF4444]'
                          : row.status === 'yellow'
                          ? 'bg-amber-100 text-amber-700'
                          : 'bg-green-100 text-[#16A34A]'
                      }`}
                    >
                      {row.status === 'red' ? 'Risco alto' : row.status === 'yellow' ? 'Atenção' : 'Saudável'}
                    </span>
                  </div>
                  <div className="w-full h-2 rounded-full bg-gray-200 overflow-hidden mb-2">
                    <div
                      className={`h-full ${
                        row.status === 'red'
                          ? 'bg-[#EF4444]'
                          : row.status === 'yellow'
                          ? 'bg-amber-500'
                          : 'bg-[#16A34A]'
                      }`}
                      style={{ width: `${Math.min(row.projectedUsagePercent, 100)}%` }}
                    />
                  </div>
                  <p className="text-xs text-gray-600">
                    Gasto {formatCurrency(row.spent)} de {formatCurrency(row.limit)} · Projeção {formatCurrency(row.projectedSpent)}
                  </p>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
        </>
      )}
    </div>
  );
}
