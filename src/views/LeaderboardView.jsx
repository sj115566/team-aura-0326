import React, { useMemo, useState } from 'react';
import { Card } from '../components/ui/Card';
import { Icon } from '../components/Icons';
import { Modal } from '../components/ui/Modal';
import { Button } from '../components/ui/Button';
import { Badge } from '../components/ui/Badge'; // 引入 Badge


export const LeaderboardView = ({ users, currentUser, seasonGoal = 10000, seasonGoalTitle = "Sub Goal (Season Total)", onUpdateGoal, roles, onEditUserRole }) => {
 const [isEditing, setIsEditing] = useState(false);
 const [editTitle, setEditTitle] = useState(seasonGoalTitle);
 const [editScore, setEditScore] = useState(seasonGoal);


 const totalPoints = useMemo(() => {
   return users.reduce((acc, user) => acc + (Number(user.points) || 0), 0);
 }, [users]);


 // 計算排名邏輯 (Standard Competition Ranking 1224)
 const rankedUsers = useMemo(() => {
   let currentRank = 1;
   return users.map((user, index) => {
     const points = Number(user.points) || 0;
     const prevPoints = index > 0 ? (Number(users[index - 1].points) || 0) : null;


     // 如果分數比上一位低，排名就變成當前的位置 (index + 1)
     // 如果分數跟上一位一樣，排名維持不變 (currentRank)
     if (index > 0 && points < prevPoints) {
       currentRank = index + 1;
     }
    
     return { ...user, rank: currentRank };
   });
 }, [users]);


 // 進度百分比，限制在 0~100 之間
 const progressPercent = Math.min(100, Math.max(0, (totalPoints / seasonGoal) * 100));


 const handleOpenEdit = () => {
   if (!currentUser.isAdmin) return;
   setEditTitle(seasonGoalTitle);
   setEditScore(seasonGoal);
   setIsEditing(true);
 };


 const handleSave = () => {
   if (editScore > 0 && editTitle.trim() !== "") {
       onUpdateGoal(editScore, editTitle);
       setIsEditing(false);
   }
 };


 // 輔助函數：取得身分標籤資料
 const getUserRoleBadges = (userRoles) => {
   if (!userRoles || !roles) return [];
   return roles.filter(r => userRoles.includes(r.code));
 };


 return (
   <div className="animate-fadeIn space-y-4">
    
     {/* 賽季總分目標進度條 */}
     <Card noPadding className="p-4 bg-gradient-to-br from-indigo-900 to-slate-900 text-white relative overflow-hidden">
       <div className="relative z-10">
         <div className="flex justify-between items-end mb-2">
           <div>
             <div className="text-xs text-indigo-300 font-bold tracking-wider mb-1 flex items-center gap-1">
               {seasonGoalTitle}
               {currentUser.isAdmin && (
                 <button onClick={handleOpenEdit} className="bg-white/10 hover:bg-white/20 p-1 rounded transition-colors">
                   <Icon name="Edit2" className="w-3 h-3 text-white" />
                 </button>
               )}
             </div>
             <div className="text-2xl font-black">
               <span className="text-yellow-400">{totalPoints.toLocaleString()}</span>
               <span className="text-sm text-gray-400 mx-1">/</span>
               <span className="text-lg text-white">{seasonGoal.toLocaleString()}</span>
             </div>
           </div>
           <div className="text-right">
             <div className="text-3xl font-black text-white">{progressPercent.toFixed(1)}%</div>
           </div>
         </div>
        
         <div className="w-full bg-slate-700/50 rounded-full h-4 overflow-hidden border border-white/10 shadow-inner">
           <div
             className="bg-gradient-to-r from-yellow-400 to-orange-500 h-full rounded-full transition-all duration-1000 ease-out shadow-[0_0_10px_rgba(250,204,21,0.5)] relative"
             style={{ width: `${progressPercent}%` }}
           >
             {/* 光影特效 */}
             <div className="absolute top-0 left-0 w-full h-full bg-[linear-gradient(90deg,transparent_0%,rgba(255,255,255,0.3)_50%,transparent_100%)] animate-shimmer" style={{backgroundSize: '200% 100%'}}></div>
           </div>
         </div>
       </div>
      
       {/* 背景裝飾 */}
       <div className="absolute -bottom-10 -right-10 w-40 h-40 bg-indigo-500 rounded-full blur-[80px] opacity-30"></div>
     </Card>


     <Card noPadding>
       <div className="bg-slate-50 p-3 text-xs font-bold text-gray-400 border-b border-gray-100 flex justify-between px-4">
         <span>RANK / NAME</span>
         <span>POINTS</span>
       </div>
       {rankedUsers.map((u) => {
         const rank = u.rank;
         // 檢查是否為自己，給予高亮背景
         const isMe = u.uid === currentUser.uid;
         const userRoleBadges = getUserRoleBadges(u.roles);
        
         return (
           <div
             key={u.uid}
             // 如果是管理員，點擊使用者列可以編輯身分
             onClick={() => currentUser.isAdmin && onEditUserRole && onEditUserRole(u.uid, u.roles)}
             className={`p-4 flex items-center justify-between border-b border-gray-50 last:border-0 transition-colors ${isMe ? 'bg-indigo-50/50' : ''} ${currentUser.isAdmin ? 'cursor-pointer hover:bg-gray-50' : ''}`}
           >
             <div className="flex items-center gap-4">
               <div className={`font-black w-6 text-center ${rank <= 3 ? 'text-yellow-500 text-lg' : 'text-gray-300'}`}>{rank}</div>
               <div className="flex flex-col">
                   <div className="font-bold text-slate-700 break-all flex items-center gap-2">
                       {u.uid}
                       <div className="flex gap-1 flex-wrap">
                           {userRoleBadges.map(role => (
                               <span
                                   key={role.code}
                                   className="text-[10px] px-1.5 py-0.5 rounded border whitespace-nowrap"
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
                   </div>
               </div>
             </div>
             <div className="font-mono font-bold text-slate-800">{u.points}</div>
           </div>
         );
       })}
     </Card>


     {/* 編輯目標 Modal */}
     <Modal isOpen={isEditing} onClose={() => setIsEditing(false)} title="設定賽季目標">
       <div className="space-y-4">
           <div>
               <label className="text-xs font-bold text-gray-500 mb-1 block">目標標題</label>
               <input
                   className="w-full p-2 border rounded-lg"
                   placeholder="例如：本季總目標"
                   value={editTitle}
                   onChange={e => setEditTitle(e.target.value)}
               />
           </div>
           <div>
               <label className="text-xs font-bold text-gray-500 mb-1 block">目標分數</label>
               <input
                   type="number"
                   className="w-full p-2 border rounded-lg"
                   placeholder="10000"
                   value={editScore}
                   onChange={e => setEditScore(e.target.value)}
               />
           </div>
           <Button onClick={handleSave} className="w-full">儲存設定</Button>
       </div>
     </Modal>
   </div>
 );
};

