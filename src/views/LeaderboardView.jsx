import React, { useState, useMemo } from 'react';
import { useGlobalData } from '../context/DataContext';
import { Card } from '../components/ui/Card';
import { Icon } from '../components/Icons';
import { LoadingOverlay } from '../components/LoadingOverlay';
import { Modal } from '../components/ui/Modal';
import { Button } from '../components/ui/Button';


// Helper to get medal color
const getRankStyle = (rank) => {
   switch (rank) {
       case 1: return { bg: 'bg-yellow-100 dark:bg-yellow-900/30', text: 'text-yellow-600 dark:text-yellow-400', border: 'border-yellow-200 dark:border-yellow-700', icon: '👑' };
       case 2: return { bg: 'bg-slate-100 dark:bg-slate-700/50', text: 'text-slate-600 dark:text-slate-400', border: 'border-slate-200 dark:border-slate-600', icon: '🥈' };
       case 3: return { bg: 'bg-orange-100 dark:bg-orange-900/30', text: 'text-orange-600 dark:text-orange-400', border: 'border-orange-200 dark:border-orange-700', icon: '🥉' };
       default: return { bg: 'bg-white dark:bg-slate-800', text: 'text-slate-600 dark:text-slate-400', border: 'border-slate-100 dark:border-slate-700', icon: rank };
   }
};


export const LeaderboardView = () => {
   const {
       users, submissions, tasks, roles, loading, currentUser,
       isAdmin, actions, isHistoryMode, lotteryTarget, seasonGoal, seasonGoalTitle // 🔥 取得目標分與標題
   } = useGlobalData();
  
   // --- State for Edit Modal ---
   const [isEditing, setIsEditing] = useState(false);
   const [editTitle, setEditTitle] = useState("");
   const [editGoal, setEditGoal] = useState(10000);
   const [editLotteryTarget, setEditLotteryTarget] = useState(0);


   const [targetModal, setTargetModal] = useState({ isOpen: false, points: 0 });


   // 2. Calculate ranked users dynamically based on approved submissions
   const rankedUsers = useMemo(() => {
       if (!users || !submissions) return [];


       // Map submissions to users
       const userPointsMap = new Map();       // 總分 (包含 Bonus)
       const userSeasonPointsMap = new Map(); // 賽季目標分 (排除 Bonus)


       submissions.forEach(sub => {
           if (sub.status === 'approved') {
               const uid = sub.userDocId || sub.uid;
               const points = Number(sub.points) || 0;
              
               // 找出該任務是否為 Bonus Only
               const task = tasks.find(t => t.id === sub.taskId);
               const isBonusOnly = task?.isBonusOnly;


               // 1. 總分 (Leaderboard): 無條件累加所有 Approved 任務
               userPointsMap.set(uid, (userPointsMap.get(uid) || 0) + points);


               // 2. 賽季分 (Season Target): 若不是 Bonus Only 才累加
               // 注意：這裡的邏輯是 "不列入賽季目標" = isBonusOnly
               if (!isBonusOnly) {
                   userSeasonPointsMap.set(uid, (userSeasonPointsMap.get(uid) || 0) + points);
               }
           }
       });


       // Convert to array and calculate final scores with multipliers
       const result = users
           .filter(u => !u.isAdmin) // Exclude admins from leaderboard
           .map(u => {
               const basePoints = userPointsMap.get(u.firestoreId) || 0;
               const baseSeasonPoints = userSeasonPointsMap.get(u.firestoreId) || 0;


               // Calculate multiplier
               const userRoleCodes = u.roles || [];
               const safeRoles = roles || [];
               const activeRoles = safeRoles.filter(r => userRoleCodes.includes(r.code));
               let totalExtra = 0;
               activeRoles.forEach(r => {
                   const rate = Number(r.multiplier) || 1;
                   totalExtra += (rate - 1);
               });
               const multiplier = Math.max(1, 1 + totalExtra);


               const finalPoints = Math.round(basePoints * multiplier);
               const finalSeasonPoints = Math.round(baseSeasonPoints * multiplier);


               return {
                   ...u,
                   rawPoints: finalPoints,        // 排行榜總分 (包含 Bonus)
                   seasonPoints: finalSeasonPoints, // 賽季目標分 (排除 Bonus，用於判斷抽獎資格)
                   roleBadges: activeRoles,
                   isQualified: lotteryTarget > 0 && finalSeasonPoints >= lotteryTarget // 🔥 是否符合抽獎資格 (依據 seasonPoints)
               };
           })
           .sort((a, b) => b.rawPoints - a.rawPoints); // Sort by total points (Leaderboard)


       // Assign ranks (handle ties)
       let currentRank = 1;
       for (let i = 0; i < result.length; i++) {
           if (i > 0 && result[i].rawPoints < result[i - 1].rawPoints) {
               currentRank = i + 1;
           }
           result[i].rank = currentRank;
       }


       return result;
   }, [users, submissions, tasks, roles, lotteryTarget]);


   // 🔥 修正：計算全體賽季目標積分 (排除 Bonus 的分數總和)
   // 用於上方進度條顯示
   const totalSeasonPoints = useMemo(() => {
       return rankedUsers.reduce((acc, user) => acc + user.seasonPoints, 0);
   }, [rankedUsers]);


   const goal = (seasonGoal && seasonGoal > 0) ? seasonGoal : 10000;
   // 使用 totalSeasonPoints 來計算進度
   const progressPercent = Math.min(100, Math.max(0, (totalSeasonPoints / goal) * 100));


   const handleOpenEdit = () => {
       if (!currentUser?.isAdmin) return;
       setEditTitle(seasonGoalTitle || "Season Goal");
       setEditGoal(seasonGoal || 10000);
       setEditLotteryTarget(lotteryTarget || 0); // 🔥 初始化 lotteryTarget
       setIsEditing(true);
   };


   const handleSave = async () => {
       if (editGoal > 0 && editTitle.trim() !== "") {
           // 1. 更新賽季目標標題與總積分目標 (寫入 config)
           await actions.updateSeasonGoal(editGoal, editTitle);
          
           // 2. 更新符合抽獎資格的目標 (寫入 seasons)
           // 如果輸入 0 或空值，則視為不設定
           if (editLotteryTarget !== undefined) {
               await actions.updateSeasonTarget(editLotteryTarget);
           }
          
           setIsEditing(false);
       }
   };


   const getUserRoleBadges = (userRoles) => {
       if (!userRoles || !roles) return [];
       return roles.filter(r => userRoles.includes(r.code));
   };


   if (loading) return <LoadingOverlay message="計算排名中..." />;


   return (
       <div className="animate-fadeIn space-y-6 pb-20">
           {/* Top Card: Season Goal Progress */}
           <Card noPadding className="p-4 bg-gradient-to-br from-indigo-900 to-slate-900 text-white relative overflow-hidden dark:from-indigo-950 dark:to-slate-950">
               <div className="relative z-10">
                   <div className="flex justify-between items-end mb-2">
                       <div>
                           <div className="text-xs text-indigo-300 font-bold tracking-wider mb-1 flex items-center gap-1">
                               {seasonGoalTitle || "Season Goal"}
                               {currentUser?.isAdmin && !isHistoryMode && <button onClick={handleOpenEdit} className="bg-white/10 hover:bg-white/20 p-1 rounded transition-colors"><Icon name="Edit2" className="w-3 h-3 text-white" /></button>}
                           </div>
                           {/* 🔥 修正：這裡顯示的是全體賽季積分 (totalSeasonPoints)，而非總分 */}
                           <div className="text-2xl font-black"><span className="text-yellow-400">{totalSeasonPoints.toLocaleString()}</span><span className="text-sm text-gray-400 mx-1">/</span><span className="text-lg text-white">{goal.toLocaleString()}</span></div>
                       </div>
                       <div className="text-right"><div className="text-3xl font-black text-white">{progressPercent.toFixed(1)}%</div></div>
                   </div>
                   <div className="w-full bg-slate-700/50 rounded-full h-4 overflow-hidden border border-white/10 shadow-inner"><div className="bg-gradient-to-r from-yellow-400 to-orange-500 h-full rounded-full transition-all duration-1000 ease-out shadow-[0_0_10px_rgba(250,204,21,0.5)] relative" style={{ width: `${progressPercent}%` }}><div className="absolute top-0 left-0 w-full h-full bg-[linear-gradient(90deg,transparent_0%,rgba(255,255,255,0.3)_50%,transparent_100%)] animate-shimmer" style={{backgroundSize: '200% 100%'}}></div></div></div>
               </div>
               <div className="absolute -bottom-10 -right-10 w-40 h-40 bg-indigo-500 rounded-full blur-[80px] opacity-30"></div>
           </Card>


           {/* Lottery Target Info (if set) */}
           {lotteryTarget > 0 && (
               <div className="bg-white/50 border border-indigo-100 rounded-xl p-3 flex items-center justify-between dark:bg-slate-800/50 dark:border-slate-700">
                   <div className="flex items-center gap-2">
                       <span className="text-2xl">🎟️</span>
                       <div>
                           <div className="text-xs text-slate-500 font-bold uppercase dark:text-slate-400">抽獎資格目標</div>
                           <div className="text-sm font-bold text-indigo-600 dark:text-indigo-400">
                               賽季積分需達 <span className="text-lg">{lotteryTarget}</span> 分
                           </div>
                       </div>
                   </div>
                   <div className="text-right">
                       <div className="text-xl font-black text-slate-700 dark:text-white">
                           {rankedUsers.filter(u => u.isQualified).length}
                       </div>
                       <div className="text-[10px] text-slate-400 uppercase font-bold">已達標人數</div>
                   </div>
               </div>
           )}


           {/* Leaderboard List */}
           <Card noPadding>
               <div className="bg-slate-50 p-3 text-xs font-bold text-gray-400 border-b border-gray-100 flex justify-between px-4 dark:bg-slate-800 dark:border-slate-700"><span>RANK / NAME</span><span>POINTS</span></div>
               {rankedUsers.length > 0 ? (
                   rankedUsers.map((user) => {
                       const style = getRankStyle(user.rank);
                       const isMe = currentUser && user.uid === currentUser.uid;
                       const userRoleBadges = getUserRoleBadges(user.roles);


                       return (
                           <div key={user.uid} className={`p-4 flex items-center justify-between border-b border-gray-50 last:border-0 transition-colors dark:border-slate-700 ${isMe ? 'bg-indigo-50/50 dark:bg-indigo-900/20' : ''}`}>
                               <div className="flex items-center gap-4">
                                   <div className={`font-black w-8 h-8 rounded-full flex items-center justify-center border text-sm ${style.bg} ${style.text} ${style.border}`}>
                                       {style.icon}
                                   </div>
                                   <div className="flex flex-col min-w-0">
                                       <div className="font-bold text-slate-700 break-all flex items-center gap-2 dark:text-slate-200">
                                           {user.username || user.uid}
                                           {/* 🔥 抽獎資格標章 */}
                                           {user.isQualified && (
                                               <span className="text-base" title={`已達成賽季目標 (${user.seasonPoints}分)`}>🎟️</span>
                                           )}
                                       </div>
                                       <div className="flex gap-1 flex-wrap mt-0.5">
                                           {isMe && <span className="text-[10px] bg-indigo-100 text-indigo-600 px-1.5 py-0.5 rounded font-bold dark:bg-indigo-900/50 dark:text-indigo-300">YOU</span>}
                                           {userRoleBadges.map(role => (
                                               <span key={role.code} className="text-[10px] px-1.5 py-0.5 rounded border whitespace-nowrap" style={{ backgroundColor: role.color ? `${role.color}15` : '#f3f4f6', color: role.color || '#6b7280', borderColor: role.color ? `${role.color}40` : '#e5e7eb' }}>{role.label}</span>
                                           ))}
                                       </div>
                                   </div>
                               </div>
                               <div className="text-right">
                                   <div className="font-mono font-bold text-slate-800 dark:text-white text-lg">{user.rawPoints}</div>
                                   {/* 🔥 顯示賽季積分 (如果與總分不同，或者您想強制顯示) */}
                                   {user.seasonPoints !== user.rawPoints && (
                                       <div className="text-[10px] text-slate-400">
                                           賽季積分: <span className={user.isQualified ? "text-green-600 font-bold" : ""}>{user.seasonPoints}</span>
                                       </div>
                                   )}
                               </div>
                           </div>
                       );
                   })
               ) : (
                   <div className="text-center py-12 text-slate-400 bg-slate-50 rounded-xl dark:bg-slate-800/50">
                       <Icon name="Circle" className="w-12 h-12 mx-auto mb-3 opacity-50" />
                       <p>尚無排名資料</p>
                   </div>
               )}
           </Card>


           {/* Target Modal */}
           <Modal isOpen={isEditing} onClose={() => setIsEditing(false)} title="設定賽季與抽獎目標">
               <div className="space-y-4">
                   <div><label className="text-xs font-bold text-gray-500 mb-1 block dark:text-slate-400">賽季目標標題</label><input className="w-full p-2 border rounded-lg dark:bg-slate-800 dark:border-slate-700 dark:text-white" placeholder="例如：本季總目標" value={editTitle} onChange={e => setEditTitle(e.target.value)} /></div>
                   <div><label className="text-xs font-bold text-gray-500 mb-1 block dark:text-slate-400">總積分目標 (全體共同累積)</label><input type="number" className="w-full p-2 border rounded-lg dark:bg-slate-800 dark:border-slate-700 dark:text-white" placeholder="10000" value={editGoal} onChange={e => setEditGoal(e.target.value)} /></div>
                   <div className="border-t border-gray-100 pt-4 dark:border-slate-700">
                       <label className="text-xs font-bold text-indigo-600 mb-1 block dark:text-indigo-400">🎟️ 抽獎資格目標 (個人賽季積分)</label>
                       <p className="text-[10px] text-gray-400 mb-2">當使用者的個人賽季積分（扣除 Bonus 任務）達到此分數時，將獲得抽獎資格。</p>
                       <input type="number" className="w-full p-2 border rounded-lg border-indigo-200 bg-indigo-50 dark:bg-indigo-900/20 dark:border-indigo-800 dark:text-white" placeholder="例如：1000" value={editLotteryTarget} onChange={e => setEditLotteryTarget(e.target.value)} />
                   </div>
                   <Button onClick={handleSave} className="w-full">儲存全部設定</Button>
               </div>
           </Modal>
       </div>
   );
};


export default LeaderboardView;



