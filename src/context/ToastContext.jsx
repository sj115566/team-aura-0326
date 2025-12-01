import React, { createContext, useContext, useState } from 'react';
import { Icon } from '../components/Icons';

const ToastContext = createContext();

export const ToastProvider = ({ children }) => {
  const [toasts, setToasts] = useState([]);

  const showToast = (message, type = 'success') => {
    const id = Date.now();
    setToasts((prev) => [...prev, { id, message, type }]);
    // 3秒後自動消失
    setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id));
    }, 3000);
  };

  return (
    <ToastContext.Provider value={{ showToast }}>
      {children}
      {/* Toast 容器 */}
      <div className="fixed bottom-20 left-1/2 -translate-x-1/2 z-[100] flex flex-col gap-2 w-[90%] max-w-sm pointer-events-none">
        {toasts.map((toast) => (
          <div
            key={toast.id}
            className={`p-3 rounded-lg shadow-lg text-sm font-bold flex items-center gap-2 animate-fadeIn pointer-events-auto text-white ${
              toast.type === 'success' ? 'bg-green-600' : 'bg-red-500'
            }`}
          >
            <Icon name={toast.type === 'success' ? 'Check' : 'X'} className="w-4 h-4" />
            {toast.message}
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
};

export const useToast = () => {
  const context = useContext(ToastContext);
  if (!context) {
    throw new Error('useToast must be used within a ToastProvider');
  }
  return context;
};