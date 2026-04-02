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

  if (!open) return null;

  const icon = (type: PaletteItem['type']) => {
    if (type === 'transaction') return <Receipt className="w-4 h-4" />;
    if (type === 'category') return <Tag className="w-4 h-4" />;
    if (type === 'goal') return <Target className="w-4 h-4" />;
    return <Paperclip className="w-4 h-4" />;
  };

  return (
    <div className="fixed inset-0 z-[80]">
      <div
        className="absolute inset-0 bg-black/40 backdrop-blur-sm"
        onClick={() => setOpen(false)}
      />
      <div className="absolute left-1/2 top-[12%] -translate-x-1/2 w-[92vw] max-w-2xl card-gradient p-0 overflow-hidden">
        <div className="flex items-center gap-2 px-4 py-3 border-b border-gray-100">
          <Search className="w-4 h-4 text-gray-400" />
          <input
            autoFocus
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Buscar transações, categorias, metas, anexos..."
            className="flex-1 bg-transparent outline-none text-sm text-gray-800"
          />
          <button className="p-1 rounded hover:bg-gray-100" onClick={() => setOpen(false)}>
            <X className="w-4 h-4 text-gray-500" />
          </button>
        </div>
        <div className="max-h-[60vh] overflow-auto custom-scrollbar p-2">
          {loading ? (
            <p className="text-sm text-gray-500 px-2 py-6">Carregando índice...</p>
          ) : filtered.length === 0 ? (
            <p className="text-sm text-gray-500 px-2 py-6">Sem resultados.</p>
          ) : (
            filtered.map((item) => (
              <button
                key={item.id}
                onClick={item.action}
                className="w-full text-left px-3 py-2 rounded-lg hover:bg-gray-50 flex items-start gap-3"
              >
                <span className="mt-0.5 text-gray-500">{icon(item.type)}</span>
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
        <div className="px-4 py-2 border-t border-gray-100 text-xs text-gray-500">
          Atalho: Ctrl/Cmd + K
        </div>
      </div>
    </div>
  );
}

