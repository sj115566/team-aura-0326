import React from 'react';
import { Icon } from './Icons';

export const LoadingOverlay = ({ isLoading }) => {
  if (!isLoading) return null;
  return (
    <div className="fixed inset-0 z-[100] flex flex-col items-center justify-center bg-black/30 backdrop-blur-[2px] animate-fadeIn">
      <div className="bg-white p-4 rounded-full shadow-2xl mb-3">
        <Icon name="Loader2" className="w-8 h-8 text-indigo-600 animate-spin" />
      </div>
      <div className="text-white font-bold text-sm drop-shadow-md">資料處理中...</div>
    </div>
  );
};