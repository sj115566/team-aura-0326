import React, { useEffect } from 'react';
import { Icon } from '../Icons';

export const Modal = ({ isOpen, onClose, title, children }) => {
  // 當 Modal 開啟時，鎖住背景捲動
  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = 'unset';
    }
    return () => { document.body.style.overflow = 'unset'; };
  }, [isOpen]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4 animate-fadeIn">
      <div 
        className="bg-white w-full max-w-sm rounded-xl shadow-2xl max-h-[90vh] flex flex-col animate-fadeIn"
        onClick={(e) => e.stopPropagation()} // 防止點擊內部關閉
      >
        {title && (
          <div className="p-4 border-b border-gray-100 flex justify-between items-center shrink-0">
            <h3 className="font-bold text-lg text-slate-800">{title}</h3>
            <button onClick={onClose} className="text-gray-400 hover:text-gray-600 p-1">
              <Icon name="X" className="w-5 h-5" />
            </button>
          </div>
        )}
        <div className="p-4 overflow-y-auto custom-scrollbar flex-1">
          {children}
        </div>
      </div>
    </div>
  );
};