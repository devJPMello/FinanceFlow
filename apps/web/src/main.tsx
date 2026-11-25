import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import React from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter, Route, Routes } from 'react-router-dom';
import './index.css';
import { AccountsPage, BudgetsPage, CategoriesPage, NotFoundPage } from './components/pages/CrudPages';
import { DashboardPage } from './components/pages/DashboardPage';
import { ImportsPage } from './components/pages/ImportsPage';
import { LoginPage, RegisterPage } from './components/pages/AuthPages';
import { RecurringPage } from './components/pages/RecurringPage';
import { RulesPage } from './components/pages/RulesPage';
import { SettingsPage } from './components/pages/SettingsPage';
import { ReportsPage } from './components/pages/ReportsPage';
import { TransactionsPage } from './components/pages/TransactionsPage';
import { DashboardTemplate } from './components/templates/Templates';
import { ConfirmHost } from './components/molecules/ConfirmHost';
import { Toaster } from './components/molecules/Toaster';

try {
  if (localStorage.getItem('theme') === 'dark') document.documentElement.classList.add('dark');
} catch { /* sem storage */ }

const queryClient = new QueryClient({ defaultOptions: { queries: { staleTime: 30_000, retry: 1, refetchOnWindowFocus: false } } });

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>
        <Routes>
          <Route path="/login" element={<LoginPage />} />
          <Route path="/register" element={<RegisterPage />} />
          <Route element={<DashboardTemplate />}>
            <Route index element={<DashboardPage />} />
            <Route path="transactions" element={<TransactionsPage />} />
            <Route path="imports" element={<ImportsPage />} />
            <Route path="accounts" element={<AccountsPage />} />
            <Route path="categories" element={<CategoriesPage />} />
            <Route path="budgets" element={<BudgetsPage />} />
            <Route path="recurring" element={<RecurringPage />} />
            <Route path="rules" element={<RulesPage />} />
            <Route path="settings" element={<SettingsPage />} />
            <Route path="reports" element={<ReportsPage />} />
            <Route path="*" element={<NotFoundPage />} />
          </Route>
        </Routes>
      </BrowserRouter>
      <Toaster />
      <ConfirmHost />
    </QueryClientProvider>
  </React.StrictMode>,
);
