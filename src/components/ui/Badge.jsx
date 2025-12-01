import React from 'react';
import { twMerge } from 'tailwind-merge';

export const Badge = ({ children, color = 'gray', className = '' }) => {
  const colors = {
    gray: "bg-gray-100 text-gray-500",
    green: "bg-green-50 text-green-600 border border-green-100",
    red: "bg-red-50 text-red-600 border border-red-100",
    yellow: "bg-yellow-50 text-yellow-600 border border-yellow-100",
    indigo: "bg-indigo-50 text-indigo-600 border border-indigo-100"
  };

  return (
    <span className={twMerge(
      "text-[10px] font-bold px-2 py-0.5 rounded border border-transparent whitespace-nowrap",
      colors[color],
      className
    )}>
      {children}
    </span>
  );
};