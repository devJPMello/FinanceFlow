import { Menu, PieChart, ShieldCheck, Sparkles, UploadCloud } from 'lucide-react';
import { ReactNode, useEffect, useState } from 'react';
import { Navigate, Outlet, useLocation } from 'react-router-dom';
import { useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { useAuth } from '@/lib/auth-store';
import { IconButton } from '../atoms/Button';
import { Logo, Sidebar } from '../organisms/Sidebar';

/** Layout autenticado: sidebar fixa no desktop, gaveta no mobile. */
export function DashboardTemplate() {
  const token = useAuth((s) => s.accessToken);
  const [open, setOpen] = useState(false);
  const { pathname } = useLocation();
  const qc = useQueryClient();
  useEffect(() => { window.scrollTo({ top: 0 }); }, [pathname]);
  // lança as recorrências vencidas ao abrir o app
  useEffect(() => {
    if (!token) return;
    api.post<{ created: number }>('/recurring/run')
      .then(({ data }) => { if (data.created) ['transactions', 'accounts', 'summary', 'cashflow', 'budgets', 'recurring'].forEach((k) => qc.invalidateQueries({ queryKey: [k] })); })
      .catch(() => { /* sem rede: tenta no próximo acesso */ });
  }, [token, qc]);
  if (!token) return <Navigate to="/login" replace />;
  return (
    <div className="min-h-screen lg:grid lg:grid-cols-[17rem_1fr]">
      <aside className="sticky top-0 hidden h-screen border-r border-slate-200/80 bg-white dark:border-slate-800 dark:bg-slate-900/60 lg:block">
        <Sidebar />
      </aside>
      {open && (
        <div className="fixed inset-0 z-40 animate-fade-in lg:hidden" onClick={() => setOpen(false)}>
          <div className="absolute inset-0 bg-slate-900/50 backdrop-blur-sm" />
          <aside className="relative h-full w-72 bg-white shadow-pop dark:bg-slate-900" onClick={(e) => e.stopPropagation()}>
            <Sidebar onNavigate={() => setOpen(false)} />
          </aside>
        </div>
      )}
      <div className="min-w-0">
        <header className="sticky top-0 z-30 flex items-center gap-2 border-b border-slate-200/80 bg-white/80 p-3 backdrop-blur dark:border-slate-800 dark:bg-slate-900/80 lg:hidden">
          <IconButton label="Abrir menu" onClick={() => setOpen(true)}><Menu className="h-5 w-5" /></IconButton>
          <Logo />
        </header>
        <main className="mx-auto max-w-6xl space-y-6 p-4 sm:p-8" key={pathname}>
          <div className="animate-rise space-y-6"><Outlet /></div>
        </main>
      </div>
    </div>
  );
}

const highlights = [
  { icon: UploadCloud, title: 'Importe extratos em segundos', text: 'CSV, XLSX e OFX com mapeamento inteligente e detecção de duplicadas.' },
  { icon: PieChart, title: 'Veja para onde vai seu dinheiro', text: 'Gráficos por categoria, fluxo mensal e orçamentos com alertas.' },
  { icon: ShieldCheck, title: 'Seus dados, só seus', text: 'Cada conta é isolada e protegida por autenticação segura.' },
];

export function AuthTemplate({ title, subtitle, children }: { title: string; subtitle: string; children: ReactNode }) {
  const token = useAuth((s) => s.accessToken);
  if (token) return <Navigate to="/" replace />;
  return (
    <div className="grid min-h-screen lg:grid-cols-2">
      <aside className="relative hidden overflow-hidden bg-gradient-to-br from-brand-600 via-brand-700 to-brand-900 p-12 text-white lg:flex lg:flex-col lg:justify-between">
        <div aria-hidden className="absolute -right-24 -top-24 h-96 w-96 rounded-full bg-white/10 blur-3xl" />
        <div aria-hidden className="absolute -bottom-32 -left-16 h-96 w-96 rounded-full bg-brand-400/30 blur-3xl" />
        <div className="relative flex items-center gap-2.5 text-lg font-bold"><Sparkles className="h-5 w-5" />FinanceFlow</div>
        <div className="relative space-y-8">
          <h2 className="max-w-md text-4xl font-bold leading-tight tracking-tight">Suas finanças, finalmente organizadas.</h2>
          <ul className="space-y-5">
            {highlights.map(({ icon: Icon, title, text }) => (
              <li key={title} className="flex gap-4">
                <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-white/15"><Icon className="h-5 w-5" /></span>
                <div><p className="font-semibold">{title}</p><p className="text-sm text-white/70">{text}</p></div>
              </li>
            ))}
          </ul>
        </div>
        <p className="relative text-sm text-white/60">© {new Date().getFullYear()} FinanceFlow</p>
      </aside>
      <main className="flex items-center justify-center p-6">
        <div className="w-full max-w-sm animate-rise space-y-8">
          <Logo className="lg:hidden" />
          <div>
            <h1 className="text-3xl font-bold tracking-tight">{title}</h1>
            <p className="mt-1 text-slate-500">{subtitle}</p>
          </div>
          {children}
        </div>
      </main>
    </div>
  );
}
