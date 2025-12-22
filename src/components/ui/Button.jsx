import React from 'react';
import { Icon } from '../Icons';
import { twMerge } from 'tailwind-merge';

export const Button = ({ 
  children, 
  onClick, 
  variant = 'primary', 
  className = '', 
  disabled = false, 
  icon, 
  type = 'button',
  ...props 
}) => {
  const baseStyle = "flex items-center justify-center gap-2 px-4 py-2 rounded-xl font-bold transition-all active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed outline-none focus:ring-2 focus:ring-offset-1 dark:focus:ring-offset-slate-900";
  
  const variants = {
    primary: "bg-indigo-600 text-white hover:bg-indigo-700 shadow-lg shadow-indigo-200 focus:ring-indigo-500 dark:shadow-none dark:bg-indigo-500 dark:hover:bg-indigo-600",
    secondary: "bg-white text-slate-700 border border-gray-200 hover:bg-gray-50 focus:ring-gray-200 dark:bg-slate-800 dark:text-slate-200 dark:border-slate-700 dark:hover:bg-slate-700 dark:focus:ring-slate-600",
    danger: "bg-red-50 text-red-500 hover:bg-red-100 focus:ring-red-200 dark:bg-red-900/30 dark:text-red-400 dark:hover:bg-red-900/50 dark:focus:ring-red-900",
    ghost: "bg-transparent text-gray-500 hover:bg-gray-100 focus:ring-gray-200 dark:text-slate-400 dark:hover:bg-slate-800 dark:hover:text-slate-200",
    success: "bg-green-600 text-white hover:bg-green-700 focus:ring-green-500 dark:bg-green-600 dark:hover:bg-green-700"
  };

  return (
    <button 
      type={type}
      onClick={onClick} 
      disabled={disabled} 
      className={twMerge(baseStyle, variants[variant], className)}
      {...props}
    >
      {disabled && variant === 'primary' && <Icon name="Loader2" className="animate-spin w-4 h-4" />}
      {icon && <Icon name={icon} className="w-4 h-4" />}
      {children}
    </button>
  );
};