import React, { useState, useMemo } from 'react';
import { Button } from '../components/ui/Button';
import { Badge } from '../components/ui/Badge';
import { Card } from '../components/ui/Card';
import { Icon } from '../components/Icons';
import { Modal } from '../components/ui/Modal';
import { AdminConsole } from '../components/AdminConsole';


export const ProfileView = ({ currentUser, tasks, submissions, onLogout, isAdmin, onReview, onInitialize, onHardReset, isHistoryMode, roles, onAddRole, onUpdateRole, onDeleteRole }) => {
 const [historySort, setHistorySort] = useState('desc');
 const [showHistory, setShowHistory] = useState(false);
 const [showStats, setShowStats] = useState(false);
  // Role Management State
 // percentage: 用來綁定 UI 輸入框 (例如 20)
 const [roleModal, setRoleModal] = useState({ isOpen: false, id: null, code: '', label: '', percentage: 0, color: '#6366f1' });


 // 開啟編輯 Modal (將 multiplier 1.2 轉為 percentage 20)
 const handleOpenEditRole = (role) => {
     // 計算方式：(1.2 - 1) * 100 = 20
     const pct = Math.round((role.multiplier - 1) * 100);
     setRoleModal({
         isOpen: true,
         id: role.firestoreId, // 確保這裡拿到 firestoreId 用於更新
         code: role.code,
         label: role.label,
         percentage: pct,
         color: role.color
     });
 };


 const handleOpenAddRole = () => {
     setRoleModal({ isOpen: true, id: null, code: '', label: '', percentage: 10, color: '#6366f1' });
 };


 const { mySubs, pendingSubs, processedSubs, weeklyStats } = useMemo(() => {
   const my = submissions.filter(s => s.uid === currentUser.uid);
   const pending = isAdmin ? submissions.filter(s => s.status === 'pending') : [];
   const processed = isAdmin ? submissions.filter(s => s.status !== 'pending') : [];
  
   const wStats = [];
   if (!isAdmin || isHistoryMode) {
     const taskMap = {};
     tasks.forEach(t => {
       const w = t.week || 'Other';
       if (!taskMap[w]) taskMap[w] = { week: w, totalTasks: 0, completed: 0, earned: 0, totalPts: 0 };
       taskMap[w].totalTasks++;
       taskMap[w].totalPts += (Number(t.points) || 0);
     });
     my.forEach(s => {
       if (s.status === 'approved') {
         const w = s.week || 'Other';
         if (taskMap[w]) {
           taskMap[w].completed++;
           taskMap[w].earned += (Number(s.points) || 0);
         }
       }
     });
     Object.values(taskMap).sort((a, b) => parseInt(b.week) - parseInt(a.week)).forEach(s => wStats.push(s));
   }
   return { mySubs: my, pendingSubs: pending, processedSubs: processed, weeklyStats: wStats };
 }, [tasks, submissions, currentUser, isAdmin, isHistoryMode]);


 const sortedHistoryWeeks = useMemo(() => {
   return [...new Set(mySubs.map(s => s.week))].sort((a,b) => {
     const na = parseInt(a), nb = parseInt(b);
     const compare = (!isNaN(na) && !isNaN(nb)) ? na - nb : a.localeCompare(b);
     return historySort === 'asc' ? compare : -compare;
   });
 }, [mySubs, historySort]);


 const showInitButton = tasks.length === 0;


 // 取得當前使用者的身分標籤物件 (加入防呆)
 const myRoleBadges = useMemo(() => {
     if (!currentUser?.roles || !roles) return [];
     return (roles || []).filter(r => currentUser.roles.includes(r.code));
 }, [currentUser, roles]);


 const handleSaveRole = () => {
     // 將 percentage 轉回 multiplier
     // 例如 20 -> 1 + (20/100) = 1.2
     const multiplier = 1 + (Number(roleModal.percentage) / 100);


     const data = {
         code: roleModal.code,
         label: roleModal.label,
         multiplier: multiplier,
         color: roleModal.color
     };
    
     if (roleModal.id) {
         if (typeof onUpdateRole === 'function') {
             onUpdateRole(roleModal.id, data);
         } else {
             console.error("onUpdateRole 函數未定義");
         }
     } else {
         if (typeof onAddRole === 'function') {
             onAddRole(data);
         } else {
             console.error("onAddRole 函數未定義，請確認 useAdmin 是否正確匯出");
             alert("系統錯誤：無法新增身分組 (Function missing)");
             return;
         }
     }
     setRoleModal({ isOpen: false, id: null, code: '', label: '', percentage: 0, color: '#6366f1' });
 };


 const presetColors = [
   '#ef4444', // Red
   '#f97316', // Orange
   '#eab308', // Yellow
   '#22c55e', // Green
   '#06b6d4', // Cyan
   '#3b82f6', // Blue
   '#6366f1', // Indigo (Default)
   '#8b5cf6', // Violet
   '#d946ef', // Fuchsia
   '#64748b'  // Slate
 ];


 return (
   <div className="animate-fadeIn space-y-6">
     <Card className="text-center">
       {/* 使用者名稱 */}
       <h2 className="font-black text-2xl text-slate-800 break-all mb-2">
           {currentUser.uid}
       </h2>
      
       {/* 身分組標籤 (移到名稱下方並置中) */}
       {myRoleBadges.length > 0 && (
         <div className="flex items-center justify-center gap-2 flex-wrap mb-3">
           {myRoleBadges.map(role => (
               <span
                   key={role.code}
                   className="text-[10px] px-2 py-0.5 rounded border font-bold shadow-sm"
                   style={{
                       backgroundColor: role.color ? `${role.color}15` : '#f3f4f6',
                       color: role.color || '#6b7280',
                       borderColor: role.color ? `${role.color}40` : '#e5e7eb'
                   }}
               >
                   {role.label}
               </span>
           ))}
         </div>
       )}


       <div className="text-xs text-gray-400 mb-4">{isAdmin ? 'Administrator' : 'Trainer'}</div>
      
       {(!isAdmin || isHistoryMode) && (
         <>
           <div className="grid grid-cols-2 gap-4 border-t border-gray-100 pt-4 mb-4">
             <div>
               <div className="text-2xl font-black text-indigo-600">{(currentUser.points || 0)}</div>
               <div className="text-[10px] text-gray-400 uppercase font-bold">總積分</div>
             </div>
             <div>
               <div className="text-2xl font-black text-slate-700">{mySubs.filter(s => s.status === 'approved').length}</div>
               <div className="text-[10px] text-gray-400 uppercase font-bold">完成任務</div>
             </div>
           </div>
          
           <div className="text-left bg-gray-50 rounded-xl mb-4 border border-gray-100 overflow-hidden">
             <div
               onClick={() => setShowStats(!showStats)}
               className="p-4 flex justify-between items-center cursor-pointer hover:bg-gray-100 transition-colors"
             >
               <h3 className="text-xs font-bold text-gray-500 uppercase flex items-center gap-1">
                 <Icon name="Table" className="w-3 h-3" /> 每週積分統計
               </h3>
               <Icon name={showStats ? "ChevronDown" : "ChevronRight"} className="w-4 h-4 text-gray-400" />
             </div>
             {showStats && (
               <div className="px-4 pb-4 animate-fadeIn space-y-3 border-t border-gray-100 pt-3">
                 {(weeklyStats || []).length > 0 ? (weeklyStats || []).map(s => (
                   <div key={s.week} className="bg-white p-3 rounded-lg border border-gray-100 shadow-sm">
                     <div className="flex justify-between mb-1 text-sm">
                       <span className="font-bold text-slate-700">第 {s.week} 週</span>
                       <span className="font-bold text-indigo-600">{s.earned} <span className="text-gray-400 text-xs">/ {s.totalPts} pts</span></span>
                     </div>
                     <div className="flex justify-between text-xs mb-2">
                       <span className="text-gray-500">進度</span>
                       <span className="font-bold text-slate-600">{s.completed} / {s.totalTasks}</span>
                     </div>
                     <div className="w-full bg-gray-100 rounded-full h-1.5 overflow-hidden">
                       <div className="bg-indigo-500 h-1.5 rounded-full transition-all duration-500" style={{ width: `${s.totalTasks > 0 ? Math.min(100, (s.completed / s.totalTasks) * 100) : 0}%` }}></div>
                     </div>
                   </div>
                 )) : <div className="text-xs text-gray-400 text-center">尚無資料</div>}
               </div>
             )}
           </div>
         </>
       )}
       {!isHistoryMode && (
           <Button variant="danger" onClick={onLogout} className="w-full bg-white border border-red-100" icon="LogOut">登出</Button>
       )}
     </Card>


     {(!isAdmin || isHistoryMode) && mySubs.length > 0 && (
       <div className="space-y-4">
         <div className="flex items-center gap-2">
           <h3 className="font-bold text-slate-700 text-sm ml-1">提交紀錄</h3>
           <button
             onClick={() => setHistorySort(prev => prev === 'desc' ? 'asc' : 'desc')}
             className="p-1 rounded-lg hover:bg-slate-200 text-slate-400 transition-colors"
           >
             <Icon name={historySort === 'desc' ? "ArrowDown" : "ArrowUp"} className="w-3 h-3" />
           </button>
         </div>
         {sortedHistoryWeeks.map(week => (
           <Card key={week} noPadding>
             <div className="bg-gray-50 px-4 py-2 text-xs font-bold text-gray-500 border-b border-gray-100">第 {week} 週</div>
             <div className="divide-y divide-gray-50">
               {mySubs.filter(s => s.week === week).map(sub => (
                 <div key={sub.id} className="p-3 flex justify-between items-center text-sm">
                   <span className="font-medium text-slate-700">{sub.taskTitle}</span>
                   <Badge color={sub.status === 'approved' ? 'green' : sub.status === 'rejected' ? 'red' : 'yellow'}>{sub.status === 'approved' ? '完成' : sub.status === 'rejected' ? '退回' : '審核中'}</Badge>
                 </div>
               ))}
             </div>
           </Card>
         ))}
       </div>
     )}


     {isAdmin && (
       <AdminConsole
         pendingSubs={pendingSubs}
         processedSubs={processedSubs}
         tasks={tasks}
         onReview={onReview}
         showHistory={showHistory}
         toggleHistory={() => setShowHistory(!showHistory)}
         isHistoryMode={isHistoryMode}
       />
     )}
    
     {/* 身分組管理區塊 */}
     {isAdmin && !isHistoryMode && (
         <div className="mt-6">
             <div className="flex justify-between items-center mb-2 px-1">
                 <h3 className="font-bold text-slate-700 text-sm">身分組設定 (加成系統)</h3>
                 <button
                   onClick={handleOpenAddRole}
                   className="text-xs bg-indigo-50 text-indigo-600 px-2 py-1 rounded hover:bg-indigo-100"
                 >
                   + 新增
                 </button>
             </div>
             <Card noPadding>
                 <div className="divide-y divide-gray-50">
                     {(roles || []).length > 0 ? (roles || []).map(role => {
                         // 將儲存的 multiplier 轉回顯示用的百分比
                         const pct = Math.round((role.multiplier - 1) * 100);
                         const pctDisplay = pct > 0 ? `+${pct}%` : pct < 0 ? `${pct}%` : '0%';
                        
                         return (
                           <div key={role.id} className="p-3 flex justify-between items-center text-sm">
                               <div className="flex items-center gap-2">
                                   <span className="font-mono text-xs bg-gray-100 px-1 rounded text-gray-500">{role.code}</span>
                                   <span style={{color: role.color}} className="font-bold">{role.label}</span>
                                   <span className="text-xs text-gray-400">{pctDisplay}</span>
                               </div>
                               <div className="flex gap-1">
                                   <button onClick={() => handleOpenEditRole(role)} className="p-1 text-gray-400 hover:text-indigo-500"><Icon name="Edit2" className="w-3 h-3"/></button>
                                   <button onClick={() => onDeleteRole(role.firestoreId)} className="p-1 text-gray-400 hover:text-red-500"><Icon name="Trash2" className="w-3 h-3"/></button>
                               </div>
                           </div>
                         );
                     }) : <div className="p-4 text-center text-xs text-gray-400">尚無身分組設定</div>}
                 </div>
             </Card>
         </div>
     )}


     {isAdmin && !isHistoryMode && (
         <div className="mt-8 space-y-3">
             {showInitButton && (
                 <div className="text-center">
                     <div className="mb-2 text-xs text-gray-400">系統尚未偵測到任務資料</div>
                     <Button
                         variant="ghost"
                         onClick={() => window.confirm("確定要初始化？將建立預設資料。") && onInitialize()}
                         className="w-full text-xs text-indigo-500 bg-indigo-50 hover:bg-indigo-100 border border-indigo-200"
                     >
                         [系統] 快速初始化
                     </Button>
                 </div>
             )}


             <div className="pt-4 border-t border-gray-100 text-center">
                 <button
                     onClick={onHardReset}
                     className="text-[10px] text-red-300 hover:text-red-500 underline transition-colors"
                 >
                     [危險] 強制重置整個系統 (Hard Reset)
                 </button>
             </div>
         </div>
     )}


     {/* Role Edit Modal */}
     <Modal isOpen={roleModal.isOpen} onClose={() => setRoleModal({ ...roleModal, isOpen: false })} title={roleModal.id ? "編輯身分組" : "新增身分組"}>
         <div className="space-y-4">
             <div>
                 <label className="text-xs font-bold text-gray-500">代號 (唯一 ID)</label>
                 <input className="w-full p-2 border rounded mt-1 text-sm" placeholder="如: vip, mod" value={roleModal.code} onChange={e => setRoleModal({...roleModal, code: e.target.value})} disabled={!!roleModal.id} />
                 <p className="text-[10px] text-gray-400 mt-1">代號設定後不可修改。</p>
             </div>
             <div>
                 <label className="text-xs font-bold text-gray-500">顯示名稱</label>
                 <input className="w-full p-2 border rounded mt-1 text-sm" placeholder="如: 贊助者" value={roleModal.label} onChange={e => setRoleModal({...roleModal, label: e.target.value})} />
             </div>
             <div>
                 <label className="text-xs font-bold text-gray-500">積分加成 (%)</label>
                 <div className="flex items-center gap-2">
                   <input type="number" className="w-full p-2 border rounded mt-1 text-sm" value={roleModal.percentage} onChange={e => setRoleModal({...roleModal, percentage: e.target.value})} placeholder="例如: 20" />
                   <span className="text-sm font-bold text-gray-500">%</span>
                 </div>
                 <p className="text-[10px] text-gray-400 mt-1">輸入 20 代表 +20% (1.2倍)，輸入 0 代表無加成。</p>
             </div>
             <div>
                 <label className="text-xs font-bold text-gray-500 mb-1 block">標籤顏色</label>
                
                 {/* 預設顏色按鈕 */}
                 <div className="flex flex-wrap gap-2 mb-2">
                   {presetColors.map(color => (
                       <button
                           key={color}
                           type="button"
                           onClick={() => setRoleModal({...roleModal, color})}
                           className={`w-6 h-6 rounded-full border-2 transition-transform hover:scale-110 ${roleModal.color === color ? 'border-gray-600 scale-110' : 'border-transparent'}`}
                           style={{ backgroundColor: color }}
                       />
                   ))}
                 </div>


                 <div className="flex items-center gap-2">
                   <input
                       type="color"
                       className="w-10 h-10 p-1 border rounded cursor-pointer shrink-0"
                       value={roleModal.color}
                       onChange={e => setRoleModal({...roleModal, color: e.target.value})}
                   />
                   <input
                       type="text"
                       className="w-full p-2 border rounded text-sm uppercase"
                       value={roleModal.color}
                       onChange={e => setRoleModal({...roleModal, color: e.target.value})}
                       placeholder="#000000"
                   />
                 </div>
             </div>
             <Button onClick={handleSaveRole} className="w-full">儲存</Button>
         </div>
     </Modal>
   </div>
 );
};



