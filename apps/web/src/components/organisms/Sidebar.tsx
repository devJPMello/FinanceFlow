import clsx from 'clsx';
import { BarChart3, FolderTree, LayoutDashboard, LogOut, Moon, PiggyBank, Receipt, Repeat, Settings, Sun, Upload, Wallet, Wand2 } from 'lucide-react';
import { useState } from 'react';
import { NavLink } from 'react-router-dom';
import { useAuth } from '@/lib/auth-store';
import { currentMonth } from '@/lib/format';
import { useBudgetAlerts } from '@/features/hooks';
import { Avatar } from '../atoms/Avatar';
import { IconButton } from '../atoms/Button';

const groups = [
  {
    title: 'Visão geral',
    links: [
      { to: '/', label: 'Dashboard', icon: LayoutDashboard, end: true },
      { to: '/transactions', label: 'Transações', icon: Receipt },
      { to: '/reports', label: 'Relatórios', icon: BarChart3 },
    ],
  },
  {
    title: 'Planejamento',
    links: [
      { to: '/budgets', label: 'Orçamentos', icon: PiggyBank },
      { to: '/recurring', label: 'Recorrentes', icon: Repeat },
      { to: '/imports', label: 'Importar planilha', icon: Upload },
    ],
  },
  {
    title: 'Cadastros',
    links: [
      { to: '/accounts', label: 'Contas', icon: Wallet },
      { to: '/categories', label: 'Categorias', icon: FolderTree },
      { to: '/rules', label: 'Regras', icon: Wand2 },
    ],
  },
  {
    title: 'Conta',
    links: [{ to: '/settings', label: 'Configurações', icon: Settings }],
  },
];

export function useDarkMode() {
  const [dark, setDark] = useState(() => document.documentElement.classList.contains('dark'));
  const toggle = () => {
    const next = !dark;
    document.documentElement.classList.toggle('dark', next);
    try { localStorage.setItem('theme', next ? 'dark' : 'light'); } catch { /* storage indisponível */ }
    setDark(next);
  };
  return { dark, toggle };
}

export function Logo({ className }: { className?: string }) {
  return (
    <div className={clsx('flex items-center gap-2.5', className)}>
      <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br from-brand-400 to-brand-700 shadow-md shadow-brand-600/30">
        <svg viewBox="0 0 24 24" className="h-5 w-5 text-white" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
          <path d="M3 17c3-1 4-9 8-9s4 8 10 8" /><path d="M17 12l4 4-4 4" />
        </svg>
      </span>
      <span className="text-lg font-bold tracking-tight">Finance<span className="text-brand-600">Flow</span></span>
    </div>
  );
}

export function Sidebar({ onNavigate }: { onNavigate?: () => void }) {
  const { user, logout } = useAuth();
  const { dark, toggle } = useDarkMode();
  const alerts = useBudgetAlerts(currentMonth()).data ?? [];
  return (
    <div className="flex h-full flex-col gap-6 p-4">
      <Logo className="px-2 pt-1" />
      <nav aria-label="Principal" className="flex flex-1 flex-col gap-5 overflow-y-auto">
        {groups.map((g) => (
          <div key={g.title} className="space-y-1">
            <p className="px-3 pb-1 text-[11px] font-semibold uppercase tracking-wider text-slate-400">{g.title}</p>
            {g.links.map(({ to, label, icon: Icon, end }) => (
              <NavLink
                key={to} to={to} end={end} onClick={onNavigate}
                className={({ isActive }) =>
                  clsx(
                    'group relative flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition-colors',
                    isActive
                      ? 'bg-brand-50 text-brand-700 dark:bg-brand-500/15 dark:text-brand-200'
                      : 'text-slate-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800/70',
                  )
                }
              >
                {({ isActive }) => (
                  <>
                    {isActive && <span className="absolute left-0 top-2 bottom-2 w-1 rounded-r-full bg-brand-600" />}
                    <Icon className="h-[18px] w-[18px]" />
                    {label}
                    {to === '/budgets' && alerts.length > 0 && (
                      <span title="Orçamentos perto do limite" className={clsx('ml-auto rounded-full px-1.5 text-[11px] font-semibold text-white', alerts.some((a) => a.level === 'danger') ? 'bg-rose-500' : 'bg-amber-500')}>{alerts.length}</span>
                    )}
                  </>
                )}
              </NavLink>
            ))}
          </div>
        ))}
      </nav>
      <div className="flex items-center gap-3 rounded-2xl border border-slate-200 p-3 dark:border-slate-800">
        <Avatar name={user?.name} />
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-medium">{user?.name}</p>
          <p className="truncate text-xs text-slate-500">{user?.email}</p>
        </div>
        <IconButton label={dark ? 'Tema claro' : 'Tema escuro'} onClick={toggle}>{dark ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}</IconButton>
        <IconButton label="Sair" onClick={logout}><LogOut className="h-4 w-4" /></IconButton>
      </div>
    </div>
  );
}
