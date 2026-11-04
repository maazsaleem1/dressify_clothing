import React from 'react';

/** Base shimmer block */
export const Shimmer = ({ className = '' }) => (
  <div className={`shimmer ${className}`} aria-hidden />
);

/** Table row shimmer */
export const TableRowShimmer = ({ cols = 5 }) => (
  <tr>
    {Array.from({ length: cols }).map((_, i) => (
      <td key={i} className="px-4 sm:px-6 py-4">
        <Shimmer className="h-4 rounded-md" />
      </td>
    ))}
  </tr>
);

/** Card shimmer */
export const CardShimmer = () => (
  <div className="bg-white rounded-2xl border border-neutral-200/90 shadow-soft p-5">
    <Shimmer className="h-5 w-2/3 rounded-md mb-4" />
    <Shimmer className="h-4 w-full rounded-md mb-2" />
    <Shimmer className="h-4 w-5/6 rounded-md mb-2" />
    <Shimmer className="h-32 w-full rounded-xl mt-4" />
  </div>
);

/** Stat card shimmer */
export const StatCardShimmer = () => (
  <div className="bg-white rounded-2xl border border-neutral-200/90 shadow-soft p-5">
    <div className="flex items-center justify-between mb-4">
      <Shimmer className="h-9 w-9 rounded-xl" />
      <Shimmer className="h-5 w-10 rounded-full" />
    </div>
    <Shimmer className="h-3 w-20 rounded-md mb-2" />
    <Shimmer className="h-8 w-28 rounded-md mb-2" />
    <Shimmer className="h-3 w-24 rounded-md" />
  </div>
);

/** List row shimmer — supports count */
export const ListItemShimmer = ({ count = 1 }) => (
  <>
    {Array.from({ length: count }).map((_, i) => (
      <div
        key={i}
        className="bg-white rounded-xl border border-neutral-100 p-4 mb-2 last:mb-0"
      >
        <div className="flex items-center gap-3">
          <Shimmer className="h-10 w-10 rounded-full shrink-0" />
          <div className="flex-1 min-w-0 space-y-2">
            <Shimmer className="h-4 w-3/4 rounded-md" />
            <Shimmer className="h-3 w-1/2 rounded-md" />
          </div>
          <Shimmer className="h-6 w-16 rounded-lg shrink-0" />
        </div>
      </div>
    ))}
  </>
);

/** Full page skeleton — matches admin content shell */
export const PageShimmer = ({ stats = 4, cards = 2, rows = 6 }) => (
  <div className="space-y-5 animate-fade-in" role="status" aria-label="Loading">
    <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-3">
      <div className="space-y-2">
        <Shimmer className="h-8 w-40 rounded-lg" />
        <Shimmer className="h-4 w-56 rounded-md" />
      </div>
      <Shimmer className="h-10 w-32 rounded-xl" />
    </div>
    {stats > 0 && (
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
        {Array.from({ length: stats }).map((_, i) => (
          <StatCardShimmer key={i} />
        ))}
      </div>
    )}
    {cards > 0 && (
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {Array.from({ length: cards }).map((_, i) => (
          <CardShimmer key={i} />
        ))}
      </div>
    )}
    {rows > 0 && (
      <div className="bg-white rounded-2xl border border-neutral-200/90 shadow-soft overflow-hidden">
        <div className="p-4 border-b border-neutral-100">
          <Shimmer className="h-5 w-36 rounded-md" />
        </div>
        <div className="p-4 space-y-3">
          {Array.from({ length: rows }).map((_, i) => (
            <div key={i} className="flex items-center gap-3">
              <Shimmer className="h-4 flex-1 rounded-md" />
              <Shimmer className="h-4 w-20 rounded-md" />
              <Shimmer className="h-4 w-16 rounded-md" />
            </div>
          ))}
        </div>
      </div>
    )}
  </div>
);

/** Reports-specific skeleton */
export const ReportsPageShimmer = () => (
  <div className="space-y-5 animate-fade-in" role="status" aria-label="Loading reports">
    <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-3">
      <div className="space-y-2">
        <Shimmer className="h-8 w-36 rounded-lg" />
        <Shimmer className="h-4 w-52 rounded-md" />
      </div>
      <div className="flex gap-2">
        <Shimmer className="h-10 w-28 rounded-xl" />
        <Shimmer className="h-10 w-28 rounded-xl" />
      </div>
    </div>

    {/* Month closing skeleton */}
    <div className="bg-white rounded-2xl border border-neutral-200/90 shadow-soft overflow-hidden">
      <div className="px-5 py-4 border-b border-neutral-100 flex justify-between gap-3">
        <div className="space-y-2">
          <Shimmer className="h-6 w-40 rounded-md" />
          <Shimmer className="h-3 w-56 rounded-md" />
        </div>
        <div className="flex gap-2">
          <Shimmer className="h-10 w-28 rounded-xl" />
          <Shimmer className="h-10 w-20 rounded-xl" />
        </div>
      </div>
      <div className="p-5 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
        {Array.from({ length: 6 }).map((_, i) => (
          <div key={i} className="rounded-2xl border border-neutral-100 bg-neutral-50/80 p-4 space-y-3">
            <Shimmer className="h-3 w-24 rounded-md" />
            <Shimmer className="h-8 w-28 rounded-md" />
            <Shimmer className="h-3 w-full rounded-md" />
          </div>
        ))}
      </div>
    </div>

    <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
      {Array.from({ length: 4 }).map((_, i) => (
        <StatCardShimmer key={i} />
      ))}
    </div>

    <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
      <CardShimmer />
      <CardShimmer />
    </div>
  </div>
);
