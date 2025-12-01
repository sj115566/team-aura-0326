import React from 'react';
import { Button } from './ui/Button';

export const ConfirmDialog = ({ isOpen, title, message, onConfirm, onCancel, loading }) => {
  if (!isOpen) return null;
  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-fadeIn">
      <div className="bg-white w-full max-w-xs p-5 rounded-xl shadow-2xl text-center">
        <h3 className="font-bold text-lg mb-2 text-slate-800">{title}</h3>
        <p className="text-sm text-gray-500 mb-6">{message}</p>
        <div className="flex gap-3">
          <Button variant="secondary" onClick={onCancel} className="flex-1" disabled={loading}>取消</Button>
          <Button variant="primary" onClick={onConfirm} disabled={loading} className="flex-1">
            {loading ? '處理中...' : '確認'}
          </Button>
        </div>
      </div>
    </div>
  );
};