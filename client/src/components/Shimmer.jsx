import React from 'react';

// Shimmer effect component
export const Shimmer = ({ className = '' }) => {
  return (
    <div className={`shimmer ${className}`}></div>
  );
};

// Table row shimmer
export const TableRowShimmer = ({ cols = 5 }) => {
  return (
    <tr>
      {Array.from({ length: cols }).map((_, i) => (
        <td key={i} className="px-6 py-4">
          <Shimmer className="h-4 rounded" />
        </td>
      ))}
    </tr>
  );
};

// Card shimmer
export const CardShimmer = () => {
  return (
    <div className="card">
      <Shimmer className="h-6 w-3/4 rounded mb-4" />
      <Shimmer className="h-4 w-full rounded mb-2" />
      <Shimmer className="h-4 w-5/6 rounded" />
    </div>
  );
};

// Stat card shimmer
export const StatCardShimmer = () => {
  return (
    <div className="card">
      <div className="flex items-center justify-between mb-4">
        <Shimmer className="h-4 w-24 rounded" />
        <Shimmer className="h-8 w-8 rounded-full" />
      </div>
      <Shimmer className="h-8 w-32 rounded mb-2" />
      <Shimmer className="h-3 w-20 rounded" />
    </div>
  );
};

// List item shimmer
export const ListItemShimmer = () => {
  return (
    <div className="card p-4">
      <div className="flex items-center gap-4">
        <Shimmer className="h-12 w-12 rounded-full" />
        <div className="flex-1">
          <Shimmer className="h-4 w-3/4 rounded mb-2" />
          <Shimmer className="h-3 w-1/2 rounded" />
        </div>
      </div>
    </div>
  );
};

// Add shimmer animation to CSS
export const ShimmerStyles = () => (
  <style>{`
    @keyframes shimmer {
      0% {
        background-position: -200% 0;
      }
      100% {
        background-position: 200% 0;
      }
    }
  `}</style>
);
