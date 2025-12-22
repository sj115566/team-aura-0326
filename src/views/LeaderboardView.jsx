import React, { useState, useMemo } from 'react';
import { useGlobalData } from '../context/DataContext';
import { Card } from '../components/ui/Card';
import { Icon } from '../components/Icons';
import { LoadingOverlay } from '../components/LoadingOverlay';
import { Modal } from '../components/ui/Modal';
import { Button } from '../components/ui/Button';
// 引入 ModalContext 以使用 openUserRoleModal
import { useModals } from '../context/ModalContext';


// Helper to get medal color
const getRankStyle = (rank) => {
    switch (rank) {
        case 1: return { bg: 'bg-yellow-100 dark:bg-yellow-900/30', text: 'text-yellow-700 dark:text-yellow-400', border: 'border-yellow-200 dark:border-yellow-700', icon: '👑' };
        case 2: return { bg: 'bg-slate-100 dark:bg-slate-700/50', text: 'text-slate-700 dark:text-slate-300', border: 'border-slate-200 dark:border-slate-600', icon: '🥈' };
        case 3: return { bg: 'bg-orange-100 dark:bg-orange-900/30', text: 'text-orange-700 dark:text-orange-400', border: 'border-orange-200 dark:border-orange-700', icon: '🥉' };
        default: return { bg: 'bg-white dark:bg-slate-800', text: 'text-slate-700 dark:text-slate-300', border: 'border-slate-100 dark:border-slate-700', icon: rank };
    }
};


export const LeaderboardView = () => {
    const {
        users, submissions, tasks, roles, loading, currentUser,
        isAdmin, actions, isHistoryMode, lotteryTarget, seasonGoal, seasonGoalTitle
    } = useGlobalData();

    // 取得 openUserRoleModal 與 confirm
    const { openUserRoleModal, confirm } = useModals();

    const [isEditing, setIsEditing] = useState(false);
    const [editTitle, setEditTitle] = useState("");
    const [editGoal, setEditGoal] = useState(10000);
    const [editLotteryTarget, setEditLotteryTarget] = useState(0);

    const rankedUsers = useMemo(() => {
        if (!users || !submissions) return [];

        const userPointsMap = new Map();
        const userSeasonPointsMap = new Map();

        // Only iterate submissions if we need to recalculate (History Mode) 
        // OR if we need seasonPoints breakdown (Live & History)
        // Note: In Live Mode, submissions are limited, so seasonPoints might be incomplete.
        // However, for Total Points, we MUST use u.points in Live Mode.

        submissions.forEach(sub => {
            if (sub.status === 'approved') {
                const uid = sub.userDocId || sub.uid;
                const points = Number(sub.points) || 0;
                // Robust task lookup
                const task = tasks.find(t => t.firestoreId === sub.taskId || t.id === sub.taskId);
                const isBonusOnly = task?.isBonusOnly;

                // We still calculate this for breakdown usage
                userPointsMap.set(uid, (userPointsMap.get(uid) || 0) + points);

                if (isBonusOnly) {
                    // Track bonus points specifically to subtract from total in Live Mode
                    const currentBonus = userSeasonPointsMap.get(uid + "_bonus") || 0;
                    userSeasonPointsMap.set(uid + "_bonus", currentBonus + points);
                } else {
                    userSeasonPointsMap.set(uid, (userSeasonPointsMap.get(uid) || 0) + points);
                }
            }
        });

        const result = users
            .filter(u => !u.isAdmin)
            .map(u => {
                const userRoleCodes = u.roles || [];
                const safeRoles = roles || [];
                const activeRoles = safeRoles.filter(r => userRoleCodes.includes(r.code));

                // Pre-calculate multiplier
                let totalExtra = 0;
                activeRoles.forEach(r => { totalExtra += (Number(r.multiplier) || 1) - 1; });
                const multiplier = Math.max(1, 1 + totalExtra);

                let finalPoints = 0;
                let finalSeasonPoints = 0;

                if (!isHistoryMode) {
                    // --- Live Mode: Use DB Source of Truth ---
                    finalPoints = Number(u.points) || 0;

                    // Calculate Bonus Points (from limited set)
                    const baseBonusPoints = userSeasonPointsMap.get(u.firestoreId + "_bonus") || userSeasonPointsMap.get(u.username + "_bonus") || 0;
                    const bonusTotal = Math.round(baseBonusPoints * multiplier);

                    // Season Points = Total - Bonus
                    // This way, if no bonus tasks are present in the truncated set (or system), 
                    // finalSeasonPoints will correctly equal finalPoints.
                    finalSeasonPoints = Math.max(0, finalPoints - bonusTotal);

                } else {
                    // --- History Mode: Recalculate from all loaded submissions ---
                    const basePoints = userPointsMap.get(u.firestoreId) || userPointsMap.get(u.username) || 0;
                    const baseSeasonPoints = userSeasonPointsMap.get(u.firestoreId) || userSeasonPointsMap.get(u.username) || 0;

                    finalPoints = Math.round(basePoints * multiplier);
                    finalSeasonPoints = Math.round(baseSeasonPoints * multiplier);
                }

                return {
                    ...u,
                    rawPoints: finalPoints,
                    seasonPoints: finalSeasonPoints,
                    roleBadges: activeRoles,
                    isQualified: lotteryTarget > 0 && finalSeasonPoints >= lotteryTarget
                };
            })
            .sort((a, b) => b.rawPoints - a.rawPoints);

        let currentRank = 1;
        for (let i = 0; i < result.length; i++) {
            if (i > 0 && result[i].rawPoints < result[i - 1].rawPoints) {
                currentRank = i + 1;
            }
            result[i].rank = currentRank;
        }

        return result;
    }, [users, submissions, tasks, roles, lotteryTarget, isHistoryMode]);

    const totalSeasonPoints = useMemo(() => {
        return rankedUsers.reduce((acc, user) => acc + user.seasonPoints, 0);
    }, [rankedUsers]);


    const goal = (seasonGoal && seasonGoal > 0) ? seasonGoal : 10000;
    const progressPercent = Math.min(100, Math.max(0, (totalSeasonPoints / goal) * 100));


    const handleOpenEdit = () => {
        if (!currentUser?.isAdmin) return;
        setEditTitle(seasonGoalTitle || "Season Goal");
        setEditGoal(seasonGoal || 10000);
        setEditLotteryTarget(lotteryTarget || 0);
        setIsEditing(true);
    };


    const handleSave = async () => {
        if (loading) return;
        if (editGoal > 0 && editTitle.trim() !== "") {
            await actions.updateSeasonGoal(editGoal, editTitle);
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

    // 新增處理點擊使用者名稱的函式
    const handleUserClick = (user) => {
        if (isAdmin && !isHistoryMode) {
            openUserRoleModal(user.firestoreId, user.roles);
        }
    };


    if (loading) return <LoadingOverlay message="計算排名中..." />;


    return (
        <div className="animate-fadeIn space-y-6 pb-20">
            {/* Top Card: Season Goal Progress */}
            <Card noPadding className="p-4 bg-gradient-to-br from-indigo-600 to-slate-700 text-white relative overflow-hidden dark:from-indigo-600 dark:to-slate-900 border-0">
                <div className="relative z-10">
                    <div className="flex justify-between items-end mb-2">
                        <div>
                            <div className="text-xs text-indigo-300 font-bold tracking-wider mb-1 flex items-center gap-1">
                                {seasonGoalTitle || "Season Goal"}
                                {currentUser?.isAdmin && !isHistoryMode && <button onClick={handleOpenEdit} className="bg-white/10 hover:bg-white/20 p-1 rounded transition-colors"><Icon name="Edit2" className="w-3 h-3 text-white" /></button>}
                            </div>
                            <div className="text-2xl font-black"><span className="text-yellow-400">{totalSeasonPoints.toLocaleString()}</span><span className="text-sm text-gray-400 mx-1">/</span><span className="text-lg text-white">{goal.toLocaleString()}</span></div>
                        </div>
                        <div className="text-right"><div className="text-3xl font-black text-white">{progressPercent.toFixed(1)}%</div></div>
                    </div>
                    <div className="w-full bg-slate-700/50 rounded-full h-4 overflow-hidden border border-white/10 shadow-inner"><div className="bg-gradient-to-r from-yellow-400 to-orange-500 h-full rounded-full transition-all duration-1000 ease-out shadow-[0_0_10px_rgba(250,204,21,0.5)] relative" style={{ width: `${progressPercent}%` }}><div className="absolute top-0 left-0 w-full h-full bg-[linear-gradient(90deg,transparent_0%,rgba(255,255,255,0.3)_50%,transparent_100%)] animate-shimmer" style={{ backgroundSize: '200% 100%' }}></div></div></div>
                </div>
                <div className="absolute -bottom-10 -right-10 w-40 h-40 bg-indigo-500 rounded-full blur-[80px] opacity-30"></div>
            </Card>


            {/* Lottery Target Info */}
            {lotteryTarget > 0 && (
                <Card className="card p-3 flex items-center justify-between">
                    <div className="flex items-center gap-2">
                        <span className="text-2xl">🎟️</span>
                        <div>
                            <div className="text-xs text-muted-custom font-bold uppercase">抽獎資格目標</div>
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
                </Card>
            )}


            {/* Leaderboard List */}
            <Card noPadding className="card overflow-hidden">
                <div className="bg-slate-50 p-3 text-xs font-bold text-muted-custom border-b border-gray-100 flex justify-between px-4 dark:bg-slate-800/50 dark:border-slate-700"><span>RANK / NAME</span><span>POINTS</span></div>
                {rankedUsers.length > 0 ? (
                    rankedUsers.map((user) => {
                        const style = getRankStyle(user.rank);
                        const isMe = currentUser && user.uid === currentUser.uid;
                        const userRoleBadges = getUserRoleBadges(user.roles);


                        return (
                            <div key={user.uid} className={`p-4 flex items-center justify-between border-b border-gray-100 last:border-0 transition-colors dark:border-slate-700 ${isMe ? 'bg-indigo-50 dark:bg-indigo-900/20' : ''}`}>
                                <div className="flex items-center gap-4">
                                    <div className={`font-black w-8 h-8 rounded-full flex items-center justify-center border text-sm ${style.bg} ${style.text} ${style.border}`}>
                                        {style.icon}
                                    </div>
                                    <div className="flex flex-col min-w-0">
                                        <div
                                            // 修改：加入 cursor-pointer 與點擊事件
                                            className={`font-bold text-slate-700 break-all flex items-center gap-2 dark:text-slate-200 ${isAdmin && !isHistoryMode ? 'cursor-pointer hover:text-indigo-600 dark:hover:text-indigo-400' : ''}`}
                                            onClick={() => handleUserClick(user)}
                                            title={isAdmin && !isHistoryMode ? "點擊編輯身分組" : ""}
                                        >
                                            {user.username || user.uid}
                                            {user.isQualified && (
                                                <span className="text-base" title={`已達成賽季目標 (${user.seasonPoints}分)`}>🎟️</span>
                                            )}
                                            {/* 如果是管理員，顯示小功能的提示 */}
                                            {isAdmin && !isHistoryMode && (
                                                <div className="flex items-center gap-1 ml-1">
                                                    <Icon name="Edit2" className="w-3 h-3 text-gray-400 opacity-50" />
                                                    <button
                                                        onClick={(e) => {
                                                            e.stopPropagation();
                                                            confirm({
                                                                title: "重新校正分數",
                                                                message: `確定要根據「${user.username || user.uid}」目前的提交紀錄重新計算總分嗎？`,
                                                                onConfirm: () => actions.recalculateUserScore(user)
                                                            });
                                                        }}
                                                        className="p-1 hover:bg-slate-200 rounded transition-colors dark:hover:bg-slate-700"
                                                        title="重新校正分數 (校準庫存點數)"
                                                    >
                                                        <Icon name="RefreshCw" className="w-3 h-3 text-indigo-500" />
                                                    </button>
                                                </div>
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
                                    <div className="text-[10px] text-slate-400">
                                        賽季積分: <span className={user.isQualified ? "text-green-600 font-bold" : ""}>{user.seasonPoints}</span>
                                    </div>
                                </div>
                            </div>
                        );
                    })
                ) : (
                    <div className="text-center py-12 text-muted-custom bg-slate-50 rounded-xl dark:bg-slate-800/50">
                        <Icon name="Circle" className="w-12 h-12 mx-auto mb-3 opacity-50" />
                        <p>尚無排名資料</p>
                    </div>
                )}
            </Card>


            {/* Target Modal */}
            <Modal isOpen={isEditing} onClose={() => setIsEditing(false)} title="設定賽季與抽獎目標">
                <div className="space-y-5">
                    <div className="space-y-4">
                        <div>
                            <label className="text-xs font-bold text-muted-custom mb-2 block">賽季目標標題</label>
                            <input
                                className="input p-3 border border-slate-300 dark:border-slate-700 rounded-lg w-full"
                                placeholder="例如：本季總目標"
                                value={editTitle}
                                onChange={e => setEditTitle(e.target.value)}
                            />
                        </div>
                        <div>
                            <label className="text-xs font-bold text-muted-custom mb-2 block">總積分目標 (全體共同累積)</label>
                            <input
                                type="number"
                                className="input p-3 border border-slate-300 dark:border-slate-700 rounded-lg w-full"
                                placeholder="10000"
                                value={editGoal}
                                onChange={e => setEditGoal(e.target.value)}
                            />
                        </div>
                    </div>

                    <div className="p-4 rounded-xl border border-indigo-100 bg-indigo-50/50 dark:border-indigo-900 dark:bg-indigo-900/10 space-y-2">
                        <div className="flex items-center gap-2 mb-1">
                            <span className="text-lg">🎟️</span>
                            <label className="text-sm font-bold text-indigo-700 dark:text-indigo-300">抽獎資格目標 (個人賽季積分)</label>
                        </div>
                        <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed mb-2">
                            當使用者的個人賽季積分（扣除 Bonus 任務）達到此分數時，將獲得抽獎資格。
                        </p>
                        <input
                            type="number"
                            className="input p-3 border border-indigo-200 focus:ring-indigo-500 dark:border-indigo-800 rounded-lg w-full"
                            placeholder="例如：1000"
                            value={editLotteryTarget}
                            onChange={e => setEditLotteryTarget(e.target.value)}
                        />
                    </div>

                    <Button onClick={handleSave} className="w-full" disabled={loading}>儲存全部設定</Button>
                </div>
            </Modal>
        </div>
    );
};


export default LeaderboardView;