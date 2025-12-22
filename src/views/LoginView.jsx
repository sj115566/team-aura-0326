import React, { useState, useEffect } from 'react';
import { Tag, GitCommit, Clock, X, FileText } from 'lucide-react'; 
import { Button } from '../components/ui/Button';
import { Card } from '../components/ui/Card';
import { InstallPrompt } from '../components/InstallPrompt';
import { Icon } from '../components/Icons'; // 引入 Icon

export const LoginView = ({ onLogin, loading, onInitialize }) => {
 const [username, setUsername] = useState('');
 const [password, setPassword] = useState('');
 const [showModal, setShowModal] = useState(false);
 const [versionInfo, setVersionInfo] = useState({ version: 'Dev', hash: '', date: '', notes: '' });

 // 本地主題狀態 (因為 LoginView 在 DataProvider 之外，無法使用 useGlobalData)
 const [theme, setTheme] = useState(() => {
     if (typeof window !== 'undefined') {
         return localStorage.getItem('app_theme') || (window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light');
     }
     return 'light';
 });

 useEffect(() => {
     const root = window.document.documentElement;
     if (theme === 'dark') root.classList.add('dark');
     else root.classList.remove('dark');
     localStorage.setItem('app_theme', theme);
 }, [theme]);

 const toggleTheme = () => setTheme(prev => prev === 'dark' ? 'light' : 'dark');

 useEffect(() => {
     fetch('./version.json').then(res => { if(!res.ok) throw new Error(); return res.json(); }).then(data => { setVersionInfo({ version: data.version, hash: data.hash.substring(0, 7), date: data.date, notes: data.notes || "沒有詳細說明" }); }).catch(() => console.log("Local mode"));
 }, []);

 const handleLogin = (e) => {
   e?.preventDefault();
   const finalPassword = password.length < 6 ? password + "_teamaura" : password;
   onLogin(username, finalPassword);
 };

 return (
   <div className="min-h-screen bg-slate-900 flex items-center justify-center p-4 transition-colors relative">
     {/* 深色模式切換按鈕 (絕對定位在右上角) */}
     <button 
        onClick={toggleTheme} 
        className="absolute top-4 right-4 p-2 bg-slate-800 rounded-full hover:bg-slate-700 transition-colors text-slate-400 hover:text-white"
     >
        <Icon name={theme === 'dark' ? "Sun" : "Moon"} className="w-5 h-5" />
     </button>

     <Card className="w-full max-w-sm text-center relative pt-8 pb-8 dark:bg-slate-900 dark:border-slate-800">
       <div className="absolute top-0 left-0 w-full h-2 bg-gradient-to-r from-indigo-500 to-purple-600"></div>
       <div className="text-6xl mb-4">🌀</div>
       <h1 className="text-2xl font-black text-slate-800 mb-1 dark:text-white">Team Aura 波導戰隊</h1>
       <h1 className="text-xl font-black text-slate-800 mb-3 dark:text-slate-300">Pokémon GO 任務上傳系統</h1>
       <p className="text-red-500 text-xs mb-1">* 帳號中的英文字，請一律改為小寫</p>
       <p className="text-gray-400 text-xs mb-3">(密碼大小寫按照你原先的設定)</p>
      
       <form onSubmit={handleLogin} className="space-y-3 mb-6">
         <input value={username} onChange={(e) => setUsername(e.target.value)} className="w-full p-3 bg-gray-50 border border-gray-200 rounded-xl outline-none focus:border-indigo-500 transition-colors dark:bg-slate-800 dark:border-slate-700 dark:text-white" placeholder="帳號" required />
         <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} className="w-full p-3 bg-gray-50 border border-gray-200 rounded-xl outline-none focus:border-indigo-500 transition-colors dark:bg-slate-800 dark:border-slate-700 dark:text-white" placeholder="密碼" required />
         <Button type="submit" disabled={loading} className="w-full py-3.5">{loading ? '登入中...' : '登入'}</Button>
       </form>

       <div className="flex flex-col items-center gap-2">
         <div className="flex items-center gap-2 px-3 py-1 bg-slate-200 rounded-full text-slate-600 text-xs font-mono font-bold shadow-sm dark:bg-slate-800 dark:text-slate-400">
           <Tag size={12} /><span>{versionInfo.version}</span>
         </div>
         {versionInfo.date && (
           <button onClick={() => setShowModal(true)} className="group flex items-center gap-2 text-[10px] text-slate-400 font-mono hover:text-blue-600 transition-colors cursor-pointer bg-transparent border-none outline-none dark:hover:text-blue-400">
             <Clock size={10} className="group-hover:scale-110 transition-transform" /><span>Last Updated: {versionInfo.date}</span>
             <GitCommit size={10} className="ml-1" /><span>{versionInfo.hash}</span>
           </button>
         )}
       </div>

       <InstallPrompt />

     {showModal && (
       <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
         <div className="absolute inset-0 bg-black/50 backdrop-blur-sm transition-opacity" onClick={() => setShowModal(false)}></div>
         <div className="relative bg-white w-full max-w-lg rounded-2xl shadow-2xl overflow-hidden animate-in fade-in zoom-in duration-200 dark:bg-slate-900">
           <div className="bg-slate-50 px-6 py-4 border-b border-slate-100 flex justify-between items-center dark:bg-slate-800 dark:border-slate-700">
             <div className="flex items-center gap-2 text-slate-700 font-semibold dark:text-slate-200"><FileText size={18} className="text-blue-500"/><span>版本詳細資訊</span></div>
             <button onClick={() => setShowModal(false)} className="text-slate-400 hover:text-slate-600 p-1 hover:bg-slate-100 rounded-full transition-colors dark:hover:text-slate-200 dark:hover:bg-slate-700"><X size={20} /></button>
           </div>
           <div className="p-6 max-h-[60vh] overflow-y-auto">
             <div className="space-y-4">
               <div><h3 className="text-sm font-bold text-slate-900 mb-1 dark:text-slate-200">更新摘要</h3><p className="text-sm text-slate-600 bg-slate-50 p-3 rounded-lg border border-slate-100 dark:bg-slate-800 dark:border-slate-700 dark:text-slate-300">{versionInfo.version}</p></div>
               <div><h3 className="text-sm font-bold text-slate-900 mb-1 dark:text-slate-200">詳細說明</h3><div className="text-xs font-mono text-slate-600 bg-slate-900/5 p-4 rounded-lg whitespace-pre-wrap leading-relaxed border border-slate-200/50 dark:bg-black/30 dark:text-slate-400 dark:border-slate-700">{versionInfo.notes}</div></div>
             </div>
           </div>
           <div className="bg-slate-50 px-6 py-3 border-t border-slate-100 flex justify-end dark:bg-slate-800 dark:border-slate-700"><button onClick={() => setShowModal(false)} className="bg-slate-900 hover:bg-slate-800 text-white text-xs font-medium px-4 py-2 rounded-lg transition-colors dark:bg-slate-700 dark:hover:bg-slate-600">關閉</button></div>
         </div>
       </div>
     )}
     </Card>
   </div>
 );
};