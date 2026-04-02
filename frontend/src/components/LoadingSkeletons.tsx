/** Skeletons reutilizáveis para estados de carregamento consistentes. */

export function GoalCardsSkeleton({ count = 6 }: { count?: number }) {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
      {Array.from({ length: count }).map((_, i) => (
        <div
          key={i}
          className="rounded-2xl border border-gray-100 bg-white p-6 shadow-sm animate-pulse"
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
          className="rounded-2xl border border-gray-100 bg-gradient-to-br from-white to-[#F9FAFB] p-4 h-[7.25rem] animate-pulse"
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
      <div className="p-5 rounded-2xl bg-white/90 border border-gray-100 h-32">
        <div className="h-3 bg-gray-200 rounded w-1/2 mb-4" />
        <div className="h-8 bg-gray-200 rounded w-3/4" />
      </div>
      <div className="p-5 rounded-2xl bg-white/90 border border-gray-100 h-32">
        <div className="h-3 bg-gray-200 rounded w-1/2 mb-4" />
        <div className="h-8 bg-gray-200 rounded w-1/3" />
      </div>
    </div>
  );
}
