'use client'

type DashboardRouteLoadingVariant = 'trades' | 'backtesting' | 'systems' | 'settings'

interface DashboardRouteLoadingProps {
  variant: DashboardRouteLoadingVariant
}

function SkeletonBar({
  className = '',
}: {
  className?: string
}) {
  return <div className={`route-loading-bar animate-pulse rounded ${className}`} />
}

function NavbarSkeleton() {
  return (
    <div className="route-loading-panel mb-6 rounded-2xl border p-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="space-y-2">
          <SkeletonBar className="h-3 w-28" />
          <SkeletonBar className="h-4 w-20" />
        </div>
        <div className="flex flex-wrap gap-2">
          <SkeletonBar className="h-9 w-24 rounded-full" />
          <SkeletonBar className="h-9 w-28 rounded-full" />
          <SkeletonBar className="h-9 w-24 rounded-full" />
          <SkeletonBar className="h-9 w-24 rounded-full" />
        </div>
      </div>
    </div>
  )
}

function StatCardsSkeleton({ count }: { count: number }) {
  return (
    <div className="mb-6 grid grid-cols-2 gap-3 md:grid-cols-4 lg:grid-cols-6">
      {Array.from({ length: count }).map((_, index) => (
        <div key={index} className="route-loading-panel rounded-lg border p-4">
          <SkeletonBar className="mb-2 h-3 w-16" />
          <SkeletonBar className="h-6 w-20" />
        </div>
      ))}
    </div>
  )
}

function FiltersSkeleton() {
  return (
    <div className="route-loading-panel mb-6 rounded-lg border p-4">
      <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-4">
        <SkeletonBar className="h-10 w-full" />
        <SkeletonBar className="h-10 w-full" />
        <SkeletonBar className="h-10 w-full" />
        <SkeletonBar className="h-10 w-full" />
      </div>
    </div>
  )
}

function TableSkeleton({ rows = 6 }: { rows?: number }) {
  return (
    <div className="route-loading-panel overflow-hidden rounded-lg border">
      <div className="border-b px-4 py-3">
        <SkeletonBar className="h-5 w-40" />
      </div>
      <div className="space-y-0">
        {Array.from({ length: rows }).map((_, index) => (
          <div key={index} className="flex gap-4 border-t px-4 py-3">
            <SkeletonBar className="h-4 w-8" />
            <SkeletonBar className="h-4 w-24" />
            <SkeletonBar className="h-4 w-16" />
            <SkeletonBar className="h-4 w-20" />
            <SkeletonBar className="h-4 w-16" />
            <SkeletonBar className="ml-auto h-4 w-12" />
          </div>
        ))}
      </div>
    </div>
  )
}

function TradesLoadingContent() {
  return (
    <>
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <SkeletonBar className="h-8 w-36" />
        <div className="flex gap-3">
          <SkeletonBar className="h-10 w-28 rounded-lg" />
          <SkeletonBar className="h-10 w-24 rounded-lg" />
        </div>
      </div>
      <StatCardsSkeleton count={8} />
      <FiltersSkeleton />
      <TableSkeleton rows={4} />
      <div className="mt-6">
        <TableSkeleton rows={8} />
      </div>
    </>
  )
}

function BacktestingLoadingContent() {
  return (
    <>
      <div className="mb-6">
        <SkeletonBar className="h-8 w-40" />
      </div>
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
        <aside className="route-loading-panel rounded-lg border p-4 lg:col-span-3">
          <div className="mb-3 flex items-center justify-between">
            <SkeletonBar className="h-5 w-20" />
            <SkeletonBar className="h-8 w-24 rounded" />
          </div>
          <div className="space-y-2">
            {Array.from({ length: 5 }).map((_, index) => (
              <SkeletonBar key={index} className="h-12 w-full rounded-lg" />
            ))}
          </div>
        </aside>
        <section className="space-y-4 lg:col-span-9">
          <StatCardsSkeleton count={8} />
          <div className="grid grid-cols-1 gap-3 lg:grid-cols-2">
            <div className="route-loading-panel rounded-lg border p-4">
              <SkeletonBar className="mb-3 h-4 w-32" />
              <div className="space-y-2">
                {Array.from({ length: 5 }).map((_, index) => (
                  <SkeletonBar key={index} className="h-4 w-full" />
                ))}
              </div>
            </div>
            <div className="route-loading-panel rounded-lg border p-4">
              <SkeletonBar className="mb-3 h-4 w-32" />
              <div className="space-y-2">
                {Array.from({ length: 5 }).map((_, index) => (
                  <SkeletonBar key={index} className="h-4 w-full" />
                ))}
              </div>
            </div>
          </div>
          <TableSkeleton rows={8} />
        </section>
      </div>
    </>
  )
}

function SystemsLoadingContent() {
  return (
    <>
      <div className="mb-6 flex items-center justify-between">
        <SkeletonBar className="h-8 w-44" />
      </div>
      <div className="mb-6 flex gap-3">
        <SkeletonBar className="h-10 w-36 rounded-lg" />
        <SkeletonBar className="h-10 w-32 rounded-lg" />
      </div>
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
        {Array.from({ length: 6 }).map((_, index) => (
          <div key={index} className="route-loading-panel rounded-lg border p-4">
            <SkeletonBar className="mb-3 h-6 w-32" />
            <SkeletonBar className="mb-2 h-4 w-full" />
            <SkeletonBar className="h-4 w-3/4" />
          </div>
        ))}
      </div>
    </>
  )
}

function SettingsLoadingContent() {
  return (
    <>
      <div className="route-loading-panel rounded-xl border p-6 shadow-sm">
        <SkeletonBar className="mb-2 h-8 w-48" />
        <SkeletonBar className="mb-6 h-4 w-64" />
        <div className="max-w-md space-y-4">
          <SkeletonBar className="h-10 w-full rounded-lg" />
          <SkeletonBar className="h-10 w-full rounded-lg" />
          <SkeletonBar className="h-10 w-full rounded-lg" />
          <SkeletonBar className="h-10 w-28 rounded-lg" />
        </div>
      </div>
      <div className="route-loading-panel mt-6 rounded-xl border p-6 shadow-sm">
        <SkeletonBar className="mb-4 h-6 w-40" />
        <SkeletonBar className="h-10 w-40 rounded-lg" />
      </div>
    </>
  )
}

export default function DashboardRouteLoading({ variant }: DashboardRouteLoadingProps) {
  const maxWidthClass = variant === 'backtesting'
    ? 'max-w-[92rem]'
    : variant === 'settings'
      ? 'max-w-4xl'
      : 'max-w-7xl'

  return (
    <div className="route-loading-shell app-theme min-h-screen px-4 py-8 sm:px-6 lg:px-8">
      <div className={`mx-auto ${maxWidthClass}`}>
        <NavbarSkeleton />
        {variant === 'trades' && <TradesLoadingContent />}
        {variant === 'backtesting' && <BacktestingLoadingContent />}
        {variant === 'systems' && <SystemsLoadingContent />}
        {variant === 'settings' && <SettingsLoadingContent />}
      </div>
    </div>
  )
}
