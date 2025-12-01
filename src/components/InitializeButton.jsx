import React, { useState } from 'react';
import { Button } from './ui/Button';

export const InitializeButton = ({ onInitialize }) => {
  const [loading, setLoading] = useState(false);

  const handleInit = async () => {
    if (window.confirm('確定要初始化資料庫嗎？這將建立預設的遊戲與系統設定。請確保您是管理員。')) {
      setLoading(true);
      await onInitialize();
      setLoading(false);
    }
  };

  return (
    <div className="mt-8 text-center">
      <div className="relative">
        <div className="absolute inset-0 flex items-center">
          <span className="w-full border-t border-slate-700" />
        </div>
        <div className="relative flex justify-center text-xs uppercase">
          <span className="bg-slate-900 px-2 text-slate-500">開發者選項</span>
        </div>
      </div>
      <Button 
        variant="ghost" 
        onClick={handleInit} 
        disabled={loading}
        className="mt-4 text-xs text-slate-400 hover:text-white hover:bg-slate-800 w-full"
      >
        {loading ? '初始化中...' : '[系統] 初始化資料庫'}
      </Button>
    </div>
  );
};