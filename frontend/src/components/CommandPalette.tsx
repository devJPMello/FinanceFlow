import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Search, Receipt, Tag, Target, Paperclip, X } from 'lucide-react';
import api from '../lib/api';
import { Transaction, Category, Goal, TaxDocumentTimelineItem } from '../types';

type PaletteItem = {
  id: string;
  type: 'transaction' | 'category' | 'goal' | 'attachment';
  label: string;
  sublabel: string;
  action: () => void;
};

export default function CommandPalette() {
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [loading, setLoading] = useState(false);
  const [items, setItems] = useState<PaletteItem[]>([]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const isK = e.key.toLowerCase() === 'k';
      if ((e.ctrlKey || e.metaKey) && isK) {
        e.preventDefault();
        setOpen((v) => !v);
      } else if (e.key === 'Escape') {
        setOpen(false);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  useEffect(() => {
    const open = () => setOpen(true);
    window.addEventListener('ff-open-command-palette', open);
    return () => window.removeEventListener('ff-open-command-palette', open);
  }, []);

  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    (async () => {
      try {
        setLoading(true);
        const year = new Date().getFullYear();
        const [txRes, catRes, goalRes, timelineRes] = await Promise.all([
          api.get('/transactions', { params: { page: 1, limit: 25 } }),
          api.get('/categories'),
          api.get('/goals'),
          api.get('/ai-insights/taxvision/document-timeline', { params: { year } }),
        ]);
        if (cancelled) return;
        const txs: Transaction[] = txRes.data?.data || [];
        const cats: Category[] = catRes.data?.data || catRes.data || [];
        const goals: Goal[] = goalRes.data?.data || goalRes.data || [];
        const timeline: TaxDocumentTimelineItem[] =
          timelineRes.data?.timeline || [];

        const mapped: PaletteItem[] = [];
        txs.forEach((t) =>
          mapped.push({
            id: `tx-${t.id}`,
            type: 'transaction',
            label: t.description || 'Transação sem descrição',
            sublabel: `${t.category?.name || 'Sem categoria'} · ${t.type}`,
            action: () => {
              navigate(`/transactions#tx=${t.id}`);
              setOpen(false);
            },
          }),
        );
        cats.forEach((c) =>
          mapped.push({
            id: `cat-${c.id}`,
            type: 'category',
            label: c.name,
            sublabel: c.type === 'INCOME' ? 'Categoria de receita' : 'Categoria de despesa',
            action: () => {
              navigate('/categories');
              setOpen(false);
            },
          }),
        );
        goals.forEach((g) =>
          mapped.push({
            id: `goal-${g.id}`,
            type: 'goal',
            label: g.title,
            sublabel: 'Meta financeira',
            action: () => {
              navigate('/goals');
              setOpen(false);
            },
          }),
        );
        timeline.forEach((t) =>
          t.attachments?.forEach((a) =>
            mapped.push({
              id: `att-${a.id}`,
              type: 'attachment',
              label: a.fileName,
              sublabel: `Anexo de ${t.description}`,
              action: () => {
                navigate('/tax-vision');
                setOpen(false);
              },
            }),
          ),
        );
        setItems(mapped);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [open, navigate]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return items.slice(0, 25);
    return items
      .filter(
        (i) =>
          i.label.toLowerCase().includes(q) ||
          i.sublabel.toLowerCase().includes(q),
      )
      .slice(0, 25);
  }, [items, query]);

  const isMac =
    typeof navigator !== 'undefined' &&
    /Mac|iPhone|iPod|iPad/i.test(navigator.platform || navigator.userAgent || '');

  const icon = (type: PaletteItem['type']) => {
    if (type === 'transaction') return <Receipt className="w-4 h-4" />;
    if (type === 'category') return <Tag className="w-4 h-4" />;
    if (type === 'goal') return <Target className="w-4 h-4" />;
    return <Paperclip className="w-4 h-4" />;
  };

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="inline-flex fixed bottom-5 right-4 sm:bottom-6 sm:right-6 lg:right-8 z-[70] items-center gap-2 rounded-full border border-gray-200/90 bg-white/95 px-3 py-1.5 sm:px-3.5 sm:py-2 text-[11px] sm:text-xs font-semibold text-gray-700 shadow-[0_1px_2px_rgba(15,23,42,0.06)] backdrop-blur-sm hover:border-indigo-200 hover:text-indigo-800 transition-colors max-w-[calc(100vw-2rem)]"
        aria-label="Abrir busca rápida"
      >
        <Search className="w-3.5 h-3.5 text-gray-500" />
        <span>Buscar</span>
        <kbd className="rounded-md border border-gray-200 bg-gray-50 px-1.5 py-0.5 font-mono text-[10px] text-gray-600 tabular-nums">
          {isMac ? '⌘' : 'Ctrl'} K
        </kbd>
      </button>

      {open ? (
        <div className="fixed inset-0 z-[80]">
          <div
            className="absolute inset-0 bg-black/40 backdrop-blur-sm"
            onClick={() => setOpen(false)}
            aria-hidden
          />
          <div className="absolute left-1/2 top-[12%] -translate-x-1/2 w-[92vw] max-w-2xl card-gradient p-0 overflow-hidden border border-gray-200/80">
            <div className="flex items-center gap-2 px-4 py-3 border-b border-gray-100">
              <Search className="w-4 h-4 text-gray-400" />
              <input
                autoFocus
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Buscar transações, categorias, metas, anexos..."
                className="flex-1 bg-transparent outline-none text-sm text-gray-800"
              />
              <button
                type="button"
                className="p-1 rounded hover:bg-gray-100"
                onClick={() => setOpen(false)}
                aria-label="Fechar"
              >
                <X className="w-4 h-4 text-gray-500" />
              </button>
            </div>
            <div className="max-h-[60vh] overflow-auto custom-scrollbar p-2">
              {loading ? (
                <div className="px-2 py-3 space-y-2" aria-busy>
                  {[1, 2, 3, 4, 5].map((i) => (
                    <div
                      key={i}
                      className="flex items-start gap-3 rounded-lg px-3 py-2.5 animate-pulse"
                    >
                      <div className="mt-0.5 h-4 w-4 rounded bg-gray-200 shrink-0" />
                      <div className="flex-1 space-y-2">
                        <div className="h-3.5 bg-gray-200 rounded w-4/5" />
                        <div className="h-3 bg-gray-100 rounded w-3/5" />
                      </div>
                    </div>
                  ))}
                </div>
              ) : filtered.length === 0 ? (
                <p className="text-sm text-gray-500 px-2 py-6">Sem resultados.</p>
              ) : (
                filtered.map((item) => (
                  <button
                    key={item.id}
                    type="button"
                    onClick={item.action}
                    className="w-full text-left px-3 py-2 rounded-lg hover:bg-indigo-50/60 flex items-start gap-3 transition-colors"
                  >
                    <span className="mt-0.5 text-indigo-600/80">{icon(item.type)}</span>
                    <span className="min-w-0">
                      <span className="block text-sm font-medium text-gray-900 truncate">
                        {item.label}
                      </span>
                      <span className="block text-xs text-gray-500 truncate">
                        {item.sublabel}
                      </span>
                    </span>
                  </button>
                ))
              )}
            </div>
            <div className="px-4 py-2 border-t border-gray-100 text-xs text-gray-500 flex items-center justify-between gap-2">
              <span>Fechar · Esc</span>
              <span className="tabular-nums">
                Atalho: {isMac ? '⌘' : 'Ctrl'}+K
              </span>
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}

