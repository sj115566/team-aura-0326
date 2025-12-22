import React from 'react';
import { twMerge } from 'tailwind-merge';

export const Skeleton = ({ className, ...props }) => {
  return (
    <div
      className={twMerge("animate-pulse rounded-md bg-slate-200/80", className)}
      {...props}
    />
  );
};

export const CardSkeleton = () => (
    <div className="p-4 border border-slate-100 rounded-xl bg-white shadow-sm space-y-3 mb-3">
        <div className="flex items-center gap-3">
            <Skeleton className="h-10 w-10 rounded-full" />
            <div className="space-y-2 flex-1">
                <Skeleton className="h-4 w-1/3" />
                <Skeleton className="h-3 w-1/2" />
            </div>
        </div>
        <Skeleton className="h-20 w-full rounded-lg" />
    </div>
);

export const ListSkeleton = () => (
    <div className="space-y-4">
        <div className="flex justify-between items-center">
             <Skeleton className="h-8 w-32" />
             <Skeleton className="h-8 w-20" />
        </div>
        <CardSkeleton />
        <CardSkeleton />
        <CardSkeleton />
    </div>
);