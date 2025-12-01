import React from 'react';
import { twMerge } from 'tailwind-merge';

export const Card = ({ children, className = '', noPadding = false, onClick, ...props }) => {
  return (
    <div 
      onClick={onClick}
      className={twMerge(
        "bg-white rounded-xl shadow-sm border border-slate-100 overflow-hidden",
        noPadding ? "" : "p-4",
        className
      )}
      {...props}
    >
      {children}
    </div>
  );
};