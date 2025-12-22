import React from 'react';
import { Icon } from '../Icons';

export const Modal = ({ isOpen, onClose, title, children }) => {
 if (!isOpen) return null;

 return (
   <div className="fixed inset-0 z-[999] overflow-y-auto">
     <div className="flex min-h-full items-center justify-center p-4">
       {/* 背景遮罩 */}
       <div
         className="fixed inset-0 bg-black/50 backdrop-blur-sm transition-opacity"
         onClick={onClose}
       ></div>
       
       {/* Modal 本體 */}
       <div
         className="relative z-10 bg-white w-full max-w-sm rounded-xl shadow-2xl flex flex-col animate-fadeIn my-8 transition-colors dark:bg-slate-900 dark:border dark:border-slate-800"
         onClick={(e) => e.stopPropagation()}
       >
         {title && (
           <div className="p-4 border-b border-gray-100 flex justify-between items-center shrink-0 rounded-t-xl sticky top-0 z-20 bg-white transition-colors dark:bg-slate-900 dark:border-slate-800">
             <h3 className="font-bold text-lg text-slate-800 dark:text-slate-100">{title}</h3>
             <button onClick={onClose} className="text-gray-400 hover:text-gray-600 p-1 dark:text-slate-500 dark:hover:text-slate-300">
               <Icon name="X" className="w-5 h-5" />
             </button>
           </div>
         )}
         <div className="p-4 text-slate-800 dark:text-slate-200">
           {children}
         </div>
       </div>
     </div>
   </div>
 );
};