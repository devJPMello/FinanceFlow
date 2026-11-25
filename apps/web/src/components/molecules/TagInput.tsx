import { X } from 'lucide-react';
import { KeyboardEvent, useId, useState } from 'react';

interface Props {
  value: string[];
  onChange: (tags: string[]) => void;
  suggestions?: string[];
  max?: number;
}

/** Campo de tags: Enter ou vírgula adiciona, Backspace remove a última. */
export function TagInput({ value, onChange, suggestions = [], max = 10 }: Props) {
  const [draft, setDraft] = useState('');
  const listId = useId();

  const add = (raw: string) => {
    const tag = raw.trim().replace(/^#/, '').slice(0, 30);
    if (tag && !value.some((t) => t.toLowerCase() === tag.toLowerCase()) && value.length < max) onChange([...value, tag]);
    setDraft('');
  };
  const onKey = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' || e.key === ',') { e.preventDefault(); add(draft); }
    else if (e.key === 'Backspace' && !draft && value.length) onChange(value.slice(0, -1));
  };

  return (
    <div className="flex min-h-[2.75rem] flex-wrap items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-2.5 py-1.5 shadow-sm focus-within:border-brand-500 focus-within:ring-2 focus-within:ring-brand-500/20 dark:border-slate-700 dark:bg-slate-900">
      {value.map((t) => (
        <span key={t} className="flex items-center gap-1 rounded-full bg-brand-50 py-0.5 pl-2.5 pr-1 text-xs font-medium text-brand-700 dark:bg-brand-500/15 dark:text-brand-200">
          #{t}
          <button type="button" aria-label={`Remover tag ${t}`} className="rounded-full p-0.5 hover:bg-brand-100 dark:hover:bg-brand-500/25" onClick={() => onChange(value.filter((x) => x !== t))}>
            <X className="h-3 w-3" />
          </button>
        </span>
      ))}
      <input
        aria-label="Adicionar tag" list={listId} value={draft} onChange={(e) => setDraft(e.target.value)} onKeyDown={onKey} onBlur={() => draft && add(draft)}
        placeholder={value.length ? '' : 'Ex.: viagem, trabalho (Enter para adicionar)'}
        className="min-w-[8rem] flex-1 bg-transparent py-1 text-sm outline-none placeholder:text-slate-400"
      />
      <datalist id={listId}>{suggestions.filter((s) => !value.includes(s)).map((s) => <option key={s} value={s} />)}</datalist>
    </div>
  );
}
