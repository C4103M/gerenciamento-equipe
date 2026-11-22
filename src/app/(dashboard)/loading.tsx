export default function DashboardLoading() {
  return (
    <div className="space-y-8 animate-pulse" aria-busy="true" aria-label="Carregando conteúdo">
      {/* Header skeleton */}
      <div className="flex flex-col gap-4 border-b border-zinc-800/80 pb-6 sm:flex-row sm:items-center sm:justify-between">
        <div className="space-y-2.5">
          <div className="flex items-center gap-2.5">
            <div className="h-8 w-8 rounded-lg bg-zinc-800" />
            <div className="h-7 w-56 rounded-lg bg-zinc-800" />
          </div>
          <div className="h-4 w-80 max-w-full rounded bg-zinc-800/80" />
        </div>
        <div className="flex items-center gap-2.5">
          <div className="h-10 w-32 rounded-xl bg-zinc-800" />
          <div className="h-10 w-36 rounded-xl bg-zinc-800" />
        </div>
      </div>

      {/* KPI cards skeleton */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {[0, 1, 2, 3].map((idx) => (
          <div
            key={idx}
            className="rounded-2xl border border-zinc-800 bg-zinc-900/70 p-5 space-y-3"
          >
            <div className="flex items-center justify-between">
              <div className="h-3.5 w-32 rounded bg-zinc-800" />
              <div className="h-8 w-8 rounded-lg bg-zinc-800" />
            </div>
            <div className="h-8 w-16 rounded bg-zinc-800" />
          </div>
        ))}
      </div>

      {/* List / grid skeleton */}
      <div className="space-y-3">
        {[0, 1, 2, 3].map((idx) => (
          <div
            key={idx}
            className="rounded-2xl border border-zinc-800 bg-zinc-900/60 p-5 space-y-3"
          >
            <div className="flex items-center justify-between gap-4">
              <div className="h-5 w-64 max-w-full rounded bg-zinc-800" />
              <div className="h-5 w-20 rounded-md bg-zinc-800" />
            </div>
            <div className="flex flex-wrap gap-2">
              <div className="h-5 w-20 rounded-md bg-zinc-800/80" />
              <div className="h-5 w-16 rounded-md bg-zinc-800/80" />
              <div className="h-5 w-24 rounded-md bg-zinc-800/80" />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
