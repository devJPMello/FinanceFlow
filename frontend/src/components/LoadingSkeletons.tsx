/** Skeletons reutilizáveis para estados de carregamento consistentes. */

export function GoalCardsSkeleton({ count = 6 }: { count?: number }) {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
      {Array.from({ length: count }).map((_, i) => (
        <div
          key={i}
          className="rounded-2xl border border-gray-200/70 bg-white/90 p-6 shadow-[0_1px_2px_rgba(15,23,42,0.04)] animate-pulse"
        >
          <div className="h-5 bg-gray-200 rounded w-4/5 mb-3" />
          <div className="h-3 bg-gray-200 rounded w-2/5 mb-6" />
          <div className="h-2 bg-gray-100 rounded-full w-full mb-2" />
          <div className="h-2 bg-gray-200 rounded-full w-2/3 mb-6" />
          <div className="flex justify-between">
            <div className="h-8 bg-gray-200 rounded w-24" />
            <div className="h-8 w-8 bg-gray-200 rounded-lg" />
          </div>
        </div>
      ))}
    </div>
  );
}

export function CategoryTilesSkeleton({ count = 6 }: { count?: number }) {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
      {Array.from({ length: count }).map((_, i) => (
        <div
          key={i}
          className="rounded-2xl border border-gray-200/70 bg-gradient-to-br from-white to-slate-50/80 p-4 h-[7.25rem] animate-pulse"
        >
          <div className="flex gap-3">
            <div className="w-11 h-11 rounded-xl bg-gray-200 shrink-0" />
            <div className="flex-1 space-y-2 pt-1">
              <div className="h-4 bg-gray-200 rounded w-3/4" />
              <div className="h-3 bg-gray-200 rounded w-1/3" />
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}

export function TaxVisionSummarySkeleton() {
  return (
    <div className="grid sm:grid-cols-2 gap-4 animate-pulse">
      <div className="p-5 rounded-2xl bg-white/90 border border-gray-200/70 h-32">
        <div className="h-3 bg-gray-200 rounded w-1/2 mb-4" />
        <div className="h-8 bg-gray-200 rounded w-3/4" />
      </div>
      <div className="p-5 rounded-2xl bg-white/90 border border-gray-200/70 h-32">
        <div className="h-3 bg-gray-200 rounded w-1/2 mb-4" />
        <div className="h-8 bg-gray-200 rounded w-1/3" />
      </div>
    </div>
  );
}

/** Skeleton alinhado à tabela de transações (desktop). */
export function TransactionsTableSkeleton({ rows = 8 }: { rows?: number }) {
  return (
    <div className="rounded-xl border border-gray-200/80 bg-white overflow-hidden animate-pulse">
      <div className="hidden md:grid grid-cols-[2.5rem_5.5rem_1fr_6rem_2.5rem_5rem_6.5rem_5rem] gap-0 border-b border-gray-200/80 bg-slate-50/90 px-3 py-3">
        <div className="h-4 bg-gray-200/90 rounded" />
        <div className="h-3 bg-gray-200/80 rounded" />
        <div className="h-3 bg-gray-200/80 rounded" />
        <div className="h-3 bg-gray-200/80 rounded" />
        <div className="h-3 bg-gray-200/80 rounded justify-self-center w-6" />
        <div className="h-3 bg-gray-200/80 rounded" />
        <div className="h-3 bg-gray-200/80 rounded justify-self-end w-16" />
        <div className="h-3 bg-gray-200/80 rounded justify-self-end w-12" />
      </div>
      <div className="hidden md:block divide-y divide-gray-100">
        {Array.from({ length: rows }).map((_, i) => (
          <div
            key={i}
            className="grid grid-cols-[2.5rem_5.5rem_1fr_6rem_2.5rem_5rem_6.5rem_5rem] gap-0 items-center px-3 py-4 bg-white"
          >
            <div className="h-4 w-4 rounded border border-gray-200 bg-gray-100" />
            <div className="h-3.5 bg-gray-200/80 rounded w-14" />
            <div className="space-y-2 pr-2">
              <div className="h-3.5 bg-gray-200/90 rounded w-[88%]" />
              <div className="h-3 bg-gray-100 rounded w-1/2" />
            </div>
            <div className="h-6 bg-gray-200/70 rounded-full w-full max-w-[5.5rem]" />
            <div className="h-4 w-4 rounded-full bg-gray-100 justify-self-center" />
            <div className="h-6 bg-gray-100 rounded-full w-16" />
            <div className="h-4 bg-gray-200/90 rounded w-20 justify-self-end" />
            <div className="flex justify-end gap-2">
              <div className="h-8 w-8 rounded-lg bg-gray-100" />
              <div className="h-8 w-8 rounded-lg bg-gray-100" />
            </div>
          </div>
        ))}
      </div>
      <div className="md:hidden space-y-3 p-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="rounded-xl border border-gray-100 p-4 space-y-3">
            <div className="flex justify-between">
              <div className="h-4 bg-gray-200 rounded w-24" />
              <div className="h-4 bg-gray-200 rounded w-20" />
            </div>
            <div className="h-3 bg-gray-100 rounded w-full" />
            <div className="h-3 bg-gray-100 rounded w-2/3" />
          </div>
        ))}
      </div>
    </div>
  );
}
