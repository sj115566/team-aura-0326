import React from 'react';
import { twMerge } from 'tailwind-merge';

export const Card = ({ children, className = '', noPadding = false, onClick, ...props }) => {
  return (
    <div 
      onClick={onClick}
      className={twMerge(
        "bg-white rounded-xl shadow-sm border border-slate-100 overflow-hidden transition-colors",
        // 深色模式：背景深灰，邊框深灰，文字淺灰
        "dark:bg-slate-900 dark:border-slate-800 dark:text-slate-200",
        noPadding ? "" : "p-4",
        className
      )}
      {...props}
    >
      {children}
    </div>
  );
};