export function CategoryTag({ name, color }: { name?: string | null; color?: string }) {
  if (!name) return <span className="text-sm text-slate-400">Sem categoria</span>;
  const c = color ?? '#94a3b8';
  return (
    <span
      className="inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium"
      style={{ backgroundColor: `${c}1f`, color: c }}
    >
      <span aria-hidden className="h-1.5 w-1.5 rounded-full" style={{ backgroundColor: c }} />
      <span className="text-slate-700 dark:text-slate-200">{name}</span>
    </span>
  );
}
