import React, { useState, useMemo } from 'react';
import { Button } from '../components/ui/Button';
import { Badge } from '../components/ui/Badge';
import { Card } from '../components/ui/Card';
import { Icon } from '../components/Icons';
import { Modal } from '../components/ui/Modal';
import { AdminConsole } from '../components/AdminConsole';
import { useGlobalData } from '../context/DataContext';
import { useModals } from '../context/ModalContext';
import { ListSkeleton } from '../components/ui/Skeleton';

export const ProfileView = () => {
    const {
        currentUser, tasks, submissions, users, logout, isAdmin, isHistoryMode,
        roles, categories, actions, currentMultiplier, dataLoading, loading, mySubmissions
    } = useGlobalData();

    const { confirm } = useModals();

    const [roleModal, setRoleModal] = useState({ isOpen: false, id: null, code: '', label: '', percentage: 0, color: '#6366f1' });
    const [catModal, setCatModal] = useState({ isOpen: false, id: null, label: '', color: '#6366f1', type: 'task', isSystem: false, systemTag: null });
    const [categoryExpanded, setCategoryExpanded] = useState({ task: true, announcement: true });
    const [showStats, setShowStats] = useState(false);
    const [showHistory, setShowHistory] = useState(false);
    const [historySort, setHistorySort] = useState('desc');

    const presetColors = ['#ef4444', '#f97316', '#eab308', '#22c55e', '#06b6d4', '#3b82f6', '#6366f1', '#8b5cf6', '#d946ef', '#64748b'];

    // ... Handlers (保持不變) ...
    const handleOpenEditRole = (role) => {
        const pct = Math.round((Number(role.multiplier) - 1) * 100);
        setRoleModal({ isOpen: true, id: role.firestoreId, code: role.code, label: role.label, percentage: pct, color: role.color });
    };

    const handleOpenAddRole = () => {
        setRoleModal({ isOpen: true, id: null, code: '', label: '', percentage: 10, color: '#6366f1' });
    };

    const handleSaveRole = () => {
        if (loading) return;
        const multiplier = 1 + (Number(roleModal.percentage) / 100);
        const data = { code: roleModal.code, label: roleModal.label, multiplier, color: roleModal.color };
        if (roleModal.id) actions.updateRole(roleModal.id, data);
        else actions.addRole(data);
        setRoleModal({ ...roleModal, isOpen: false });
    };

    const handleDeleteRole = (id) => {
        confirm({ title: "刪除身分組", message: "確定要刪除嗎？", onConfirm: () => actions.deleteRole(id) });
    };

    const handleOpenEditCat = (cat) => setCatModal({ isOpen: true, id: cat.firestoreId, label: cat.label, color: cat.color, type: cat.type, isSystem: !!cat.isSystem, systemTag: cat.systemTag });
    const handleOpenAddCat = (type) => setCatModal({ isOpen: true, id: null, label: '', color: '#6366f1', type, isSystem: false, systemTag: null });

    const handleSaveCat = () => {
        if (loading) return;
        const data = { label: catModal.label, color: catModal.color, type: catModal.type, isSystem: catModal.isSystem, systemTag: catModal.systemTag };
        if (catModal.id) actions.updateCategory(catModal.id, data);
        else actions.addCategory(data);
        setCatModal({ ...catModal, isOpen: false });
    };

    const handleDeleteCat = (cat) => {
        const isSystemTag = !!cat.systemTag || ['每日', '常駐'].includes(cat.label);
        const message = isSystemTag ? `⚠️ 警告：\n「${cat.label}」是系統保留標籤。\n刪除它可能導致每日/常駐任務無法顯示。\n確定要強制刪除嗎？` : `確定要刪除分類「${cat.label}」嗎？`;
        confirm({ title: "刪除分類", message, onConfirm: () => actions.deleteCategory(cat.firestoreId) });
    };

    const toggleCategoryExpand = (type) => setCategoryExpanded(prev => ({ ...prev, [type]: !prev[type] }));

    // --- 核心資料處理：包含統計與提交紀錄 (已整合 Special Pinned 邏輯) ---
    const { mySubs, pendingSubs, processedSubs, statsData, totalBasePoints } = useMemo(() => {
        if (!mySubmissions) return { mySubs: [], pendingSubs: [], processedSubs: [], statsData: { pinned: { totalTasks: 0, completed: 0, earnedBase: 0, totalPts: 0 }, weeks: [] }, totalBasePoints: 0 };

        const myRaw = mySubmissions;

        // 1. 處理 mySubs：加入 taskTitle 與 week (含 SPECIAL_PINNED 判斷)
        const my = myRaw.map(sub => {
            const task = tasks.find(t => t.firestoreId === sub.taskId || t.id === sub.taskId);
            let weekGroup = '?';
            if (task) {
                const rawWeek = task.week !== undefined && task.week !== null ? String(task.week).trim() : '';
                const lowerWeek = rawWeek.toLowerCase();
                if (task.isPinned || lowerWeek === 'pinned' || lowerWeek === 'special_pinned' || lowerWeek === 'pinned-main') {
                    weekGroup = 'SPECIAL_PINNED';
                } else {
                    weekGroup = rawWeek || '?';
                }
            }
            return {
                ...sub,
                taskTitle: task ? task.title : sub.taskId,
                week: weekGroup,
            };
        }).sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));

        const pending = isAdmin ? submissions.filter(s => s.status === 'pending') : [];
        const processed = isAdmin ? submissions.filter(s => s.status !== 'pending') : [];

        const stats = { pinned: { totalTasks: 0, completed: 0, earnedBase: 0, totalPts: 0, hasVariable: false }, weeks: {} };
        let totalBase = 0;

        if (!isAdmin || isHistoryMode) {
            tasks.forEach(t => {
                const rawW = t.week !== undefined && t.week !== null ? String(t.week).trim() : '';

                // 獲取分類資訊來判斷系統標籤 (決定任務屬於哪個「區塊」)
                const cat = categories?.find(c => c.firestoreId === t.categoryId);
                const isSectionPinned = cat?.systemTag === 'pinned' || (!cat?.systemTag && cat?.label === '常駐');
                const isSectionDaily = cat?.systemTag === 'daily' || (!cat?.systemTag && cat?.label === '每日');
                const isVariable = t.type === 'variable';

                if (isSectionPinned) {
                    stats.pinned.totalTasks++;
                    stats.pinned.totalPts += (Number(t.points) || 0);
                    if (isVariable) stats.pinned.hasVariable = true;
                } else {
                    const w = rawW || 'Other';
                    const statType = isSectionDaily ? 'daily' : 'seasonal';
                    if (!stats.weeks[w]) stats.weeks[w] = { week: w, daily: { totalTasks: 0, completed: 0, earnedBase: 0, totalPts: 0, hasVariable: false }, seasonal: { totalTasks: 0, completed: 0, earnedBase: 0, totalPts: 0, hasVariable: false } };
                    stats.weeks[w][statType].totalTasks++;
                    stats.weeks[w][statType].totalPts += (Number(t.points) || 0);
                    if (isVariable) stats.weeks[w][statType].hasVariable = true;
                }
            });
            my.forEach(s => {
                if (s.status === 'approved') {
                    const task = tasks.find(t => t.firestoreId === s.taskId || t.id === s.taskId);
                    const base = Number(s.points) || 0;
                    totalBase += base;

                    if (task) {
                        const rawW = task.week !== undefined && task.week !== null ? String(task.week).trim() : '';
                        const cat = categories?.find(c => c.firestoreId === task.categoryId);
                        const isSectionPinned = cat?.systemTag === 'pinned' || (!cat?.systemTag && cat?.label === '常駐');
                        const isSectionDaily = cat?.systemTag === 'daily' || (!cat?.systemTag && cat?.label === '每日');

                        if (isSectionPinned) {
                            stats.pinned.completed++;
                            stats.pinned.earnedBase += base;
                        } else {
                            const w = rawW || 'Other';
                            const statType = isSectionDaily ? 'daily' : 'seasonal';
                            if (!stats.weeks[w]) stats.weeks[w] = { week: w, daily: { totalTasks: 0, completed: 0, earnedBase: 0, totalPts: 0, hasVariable: false }, seasonal: { totalTasks: 0, completed: 0, earnedBase: 0, totalPts: 0, hasVariable: false } };
                            stats.weeks[w][statType].completed++;
                            stats.weeks[w][statType].earnedBase += base;
                        }
                    } else if (s.week !== undefined && s.week !== null) {
                        // 處理任務資料缺失 (如第 0 週舊紀錄)
                        const rawW = String(s.week).trim();
                        const isPinnedWeek = rawW.toLowerCase() === 'pinned' || rawW.toLowerCase() === 'special_pinned';
                        if (isPinnedWeek) {
                            stats.pinned.completed++;
                            stats.pinned.earnedBase += base;
                        } else {
                            const w = rawW || 'Other';
                            if (!stats.weeks[w]) stats.weeks[w] = { week: w, daily: { totalTasks: 0, completed: 0, earnedBase: 0, totalPts: 0, hasVariable: false }, seasonal: { totalTasks: 0, completed: 0, earnedBase: 0, totalPts: 0, hasVariable: false } };
                            stats.weeks[w].seasonal.completed++;
                            stats.weeks[w].seasonal.earnedBase += base;
                        }
                    }
                }
            });
        }
        const sortedWeeks = Object.values(stats.weeks).sort((a, b) => parseInt(b.week) - parseInt(a.week));
        return { mySubs: my, pendingSubs: pending, processedSubs: processed, statsData: { pinned: stats.pinned, weeks: sortedWeeks }, totalBasePoints: totalBase };
    }, [tasks, submissions, currentUser, isAdmin, isHistoryMode]);

    // --- Total Points Breakdown Calculation ---
    // In Live Mode, we trust currentUser.points (from DB) as it is the source of truth and accounts for all submissions.
    // Instead of subtracting locally-summed base points (which might be truncated), we derive the breakdown using the multiplier.
    // In History Mode, we recalculate from all loaded submissions.

    const { displayBasePoints, displayBonusPoints } = useMemo(() => {
        if (!isHistoryMode && currentUser?.points !== undefined) {
            const total = Number(currentUser.points) || 0;
            // Derive base from total and multiplier
            const base = currentMultiplier > 1 ? Math.round(total / currentMultiplier) : total;
            return { displayBasePoints: base, displayBonusPoints: total - base };
        } else {
            const total = Math.round(totalBasePoints * currentMultiplier);
            return { displayBasePoints: totalBasePoints, displayBonusPoints: total - totalBasePoints };
        }
    }, [isHistoryMode, currentUser?.points, totalBasePoints, currentMultiplier]);

    const myRoleBadges = useMemo(() => {
        if (!currentUser?.roles || !roles) return [];
        return roles.filter(r => currentUser.roles.includes(r.code));
    }, [currentUser, roles]);

    // --- 週次排序邏輯 (整合 Special Pinned 置頂) ---
    const sortedHistoryWeeks = useMemo(() => {
        const weeks = [...new Set(mySubs.map(s => s.week))];

        const hasPinned = weeks.includes('SPECIAL_PINNED');
        const regularWeeks = weeks.filter(w => w !== 'SPECIAL_PINNED');

        regularWeeks.sort((a, b) => {
            const na = parseInt(a), nb = parseInt(b);
            const compare = (!isNaN(na) && !isNaN(nb)) ? na - nb : a.localeCompare(b);
            return historySort === 'asc' ? compare : -compare;
        });

        // 將常駐任務區塊永遠放在最上面
        return hasPinned ? ['SPECIAL_PINNED', ...regularWeeks] : regularWeeks;
    }, [mySubs, historySort]);

    const StatProgress = ({ title, data, colorClass, barColorClass }) => {
        if (!data || (data.totalTasks === 0 && data.earnedBase === 0)) return null;
        const percent = data.totalTasks > 0 ? Math.min(100, (data.completed / data.totalTasks) * 100) : (data.earnedBase > 0 ? 100 : 0);
        return (
            <div className="mb-3 last:mb-0">
                <div className="flex justify-between mb-1 text-xs">
                    <span className={`font-bold ${colorClass}`}>{title}</span>
                    <span className="font-bold text-slate-700 dark:text-slate-200">
                        {data.earnedBase} <span className="text-[10px] font-normal">Pts</span>
                        {data.totalTasks > 0 && (
                            <span className="text-gray-400 text-[9px]"> / {data.totalPts}{data.hasVariable ? '+' : ''} Pts</span>
                        )}
                    </span>
                </div>
                {data.totalTasks > 0 ? (
                    <div className="flex justify-between text-[10px] text-gray-400 mb-1"><span>完成度</span><span>{data.completed} / {data.totalTasks}</span></div>
                ) : (
                    <div className="text-[9px] text-gray-400 mb-1 italic">來自歷史任務或已刪除任務</div>
                )}
                <div className="w-full bg-gray-100 rounded-full h-1.5 overflow-hidden dark:bg-slate-700"><div className={`h-1.5 rounded-full transition-all duration-500 ${barColorClass}`} style={{ width: `${percent}%` }}></div></div>
            </div>
        );
    };

    const CategorySection = ({ title, type, list, onAdd }) => (
        <div className="mb-4 last:mb-0">
            {/* 修改：使用 text-slate-700 dark:text-slate-200 */}
            <div onClick={() => toggleCategoryExpand(type)} className="flex justify-between items-center mb-2 px-1 cursor-pointer select-none group">
                <div className="flex items-center gap-2"><Icon name={categoryExpanded[type] ? "ChevronDown" : "ChevronRight"} className="w-4 h-4 text-gray-400 group-hover:text-slate-600 dark:group-hover:text-slate-300" /><h3 className="font-bold text-slate-700 text-sm group-hover:text-indigo-600 transition-colors dark:text-slate-200 dark:group-hover:text-indigo-400">{title}</h3><Badge color="gray" className="text-[10px]">{list.length}</Badge></div>
                <button onClick={(e) => { e.stopPropagation(); onAdd(); }} className="text-xs bg-indigo-50 text-indigo-600 px-2 py-1 rounded hover:bg-indigo-100 transition-colors dark:bg-indigo-900/30 dark:text-indigo-400 dark:hover:bg-indigo-900/50">+ 新增</button>
            </div>
            {categoryExpanded[type] && (
                // 修改：使用 card 類別確保背景，並加入 noPadding
                <Card noPadding className="card border-slate-200 dark:border-slate-700">
                    <div className="divide-y divide-gray-50 dark:divide-slate-800">
                        {list.length > 0 ? list.map((cat) => (
                            <div key={cat.firestoreId} className="p-3 flex justify-between items-center text-sm">
                                <div className="flex items-center gap-2"><span className="text-[10px] px-2 py-0.5 rounded text-white font-bold shadow-sm" style={{ backgroundColor: cat.color }}>{cat.label}</span>{cat.systemTag && <span className="text-[9px] text-gray-400 bg-gray-100 px-1 rounded dark:bg-slate-700 dark:text-slate-400">System: {cat.systemTag}</span>}</div>
                                <div className="flex gap-1"><button onClick={() => handleOpenEditCat(cat)} className="p-1.5 rounded-lg hover:bg-slate-100 text-slate-400 hover:text-indigo-500 transition-colors dark:hover:bg-slate-700"><Icon name="Edit2" className="w-3.5 h-3.5" /></button><button onClick={() => handleDeleteCat(cat)} className="p-1.5 rounded-lg hover:bg-slate-100 text-slate-400 hover:text-red-500 transition-colors dark:hover:bg-slate-700"><Icon name="Trash2" className="w-3.5 h-3.5" /></button></div>
                            </div>
                        )) : <div className="p-4 text-center text-xs text-gray-400">尚無{title}設定</div>}
                    </div>
                </Card>
            )}
        </div>
    );

    if (dataLoading) return <ListSkeleton />;

    return (
        <div className="animate-fadeIn space-y-6">
            {/* 修改：使用 card 類別確保背景，保留 text-center */}
            <Card className="card text-center border-slate-200 dark:border-slate-700">
                {/* 修改：使用 text-slate-800 dark:text-white */}
                <h2 className="font-black text-xl text-slate-800 break-all mb-2 dark:text-white">{currentUser.username || currentUser.uid}</h2>
                {myRoleBadges.length > 0 && (<div className="flex items-center justify-center gap-2 flex-wrap mb-3">{myRoleBadges.map(role => (<span key={role.code} className="text-[10px] px-2 py-0.5 rounded border font-bold shadow-sm" style={{ backgroundColor: role.color ? `${role.color}15` : '#f3f4f6', color: role.color || '#6b7280', borderColor: role.color ? `${role.color}40` : '#e5e7eb' }}>{role.label}</span>))}</div>)}
                <div className="text-xs text-gray-400 mb-4">{isAdmin ? 'Administrator' : 'Trainer'}</div>

                {(!isAdmin || isHistoryMode) && (
                    <>
                        <div className="grid grid-cols-2 gap-4 border-t border-gray-100 pt-4 mb-4 dark:border-slate-800">
                            <div>
                                <div className="text-2xl font-black text-slate-800 dark:text-white">
                                    {displayBasePoints}
                                    {displayBonusPoints > 0 && (
                                        <span className="text-lg text-indigo-600 ml-1 dark:text-indigo-400">(+{displayBonusPoints})</span>
                                    )}
                                </div>
                                <div className="text-[10px] text-gray-400 uppercase font-bold">總積分</div>
                            </div>
                            <div>
                                <div className="text-2xl font-black text-slate-700 dark:text-slate-200">
                                    {mySubs.filter(s => s.status === 'approved').length}
                                </div>
                                <div className="text-[10px] text-gray-400 uppercase font-bold">完成任務</div>
                            </div>
                        </div>

                        <div className="text-left bg-gray-50 rounded-xl mb-4 border border-gray-100 overflow-hidden dark:bg-slate-800/50 dark:border-slate-800">
                            <div onClick={() => setShowStats(!showStats)} className="p-4 flex justify-between items-center cursor-pointer hover:bg-gray-100 transition-colors dark:hover:bg-slate-800">
                                <h3 className="text-xs font-bold text-gray-500 uppercase flex items-center gap-1 dark:text-slate-400">
                                    <Icon name="Table" className="w-3 h-3" /> 任務進度統計
                                </h3>
                                <Icon name={showStats ? "ChevronDown" : "ChevronRight"} className="w-4 h-4 text-gray-400" />
                            </div>
                            {showStats && (
                                <div className="px-4 pb-4 animate-fadeIn space-y-4 border-t border-gray-100 pt-4 bg-slate-50/50 dark:bg-slate-800/50 dark:border-slate-800">
                                    {statsData.pinned.totalTasks > 0 && (
                                        <div className="bg-white p-3 rounded-lg border border-red-100 shadow-sm relative overflow-hidden dark:bg-slate-900 dark:border-red-900/30">
                                            <div className="absolute top-0 left-0 w-1 h-full bg-red-400"></div>
                                            <StatProgress title="常駐與公告任務" data={statsData.pinned} colorClass="text-red-500" barColorClass="bg-red-400" />
                                        </div>
                                    )}
                                    {statsData.weeks.length > 0 ? statsData.weeks.map(weekItem => {
                                        const weekTotalBase = weekItem.daily.earnedBase + weekItem.seasonal.earnedBase;
                                        return (
                                            <div key={weekItem.week} className="bg-white p-3 rounded-lg border border-gray-100 shadow-sm relative overflow-hidden dark:bg-slate-900 dark:border-slate-700">
                                                <div className="absolute top-0 left-0 w-1 h-full bg-indigo-400"></div>
                                                <div className="flex justify-between items-center mb-3 pb-2 border-b border-gray-50 pl-2 dark:border-slate-800">
                                                    <span className="font-bold text-slate-700 text-sm dark:text-slate-200">第 {weekItem.week} 週</span>
                                                    <span className="text-xs font-bold text-indigo-600 bg-indigo-50 px-2 py-0.5 rounded-full dark:bg-indigo-900/30 dark:text-indigo-400">本週合計: {weekTotalBase} Pts</span>
                                                </div>
                                                <div className="pl-2 space-y-4">
                                                    <StatProgress title="本週任務" data={weekItem.seasonal} colorClass="text-slate-600 dark:text-slate-400" barColorClass="bg-indigo-400" />
                                                    <StatProgress title="每日挑戰" data={weekItem.daily} colorClass="text-amber-500" barColorClass="bg-amber-400" />
                                                </div>
                                            </div>
                                        );
                                    }) : !statsData.pinned.totalTasks && <div className="text-xs text-gray-400 text-center py-2">尚無統計資料</div>}
                                </div>
                            )}
                        </div>
                    </>
                )}
                {!isHistoryMode && <Button variant="danger" onClick={logout} className="w-full bg-white border border-red-100 dark:bg-slate-900 dark:border-red-900/50" icon="LogOut">登出</Button>}
            </Card>

            {(!isAdmin || isHistoryMode) && mySubs.length > 0 && (
                <div className="space-y-4">
                    {/* 修改：使用 text-slate-700 dark:text-slate-200 */}
                    <div className="flex items-center gap-2"><h3 className="font-bold text-slate-700 text-sm ml-1 dark:text-slate-200">提交紀錄</h3><button onClick={() => setHistorySort(prev => prev === 'desc' ? 'asc' : 'desc')} className="p-1 rounded-lg hover:bg-slate-200 text-slate-400 transition-colors dark:hover:bg-slate-800"><Icon name={historySort === 'desc' ? "ArrowDown" : "ArrowUp"} className="w-3 h-3" /></button></div>
                    {sortedHistoryWeeks.map(week => (
                        // 修改：使用 card 類別確保背景，並加入 noPadding
                        <Card key={week} noPadding className="card border-slate-200 dark:border-slate-700">
                            <div className="bg-gray-50 px-4 py-2 text-xs font-bold text-gray-500 border-b border-gray-100 dark:bg-slate-800 dark:border-slate-700 dark:text-slate-400">
                                {week === 'SPECIAL_PINNED' ? '常駐與公告任務' : `第 ${week} 週`}
                            </div>
                            <div className="divide-y divide-gray-50 dark:divide-slate-800">
                                {mySubs.filter(s => s.week === week).map(sub => (
                                    <div key={sub.firestoreId || sub.id} className="p-3 flex justify-between items-center text-sm">
                                        {/* 修改：使用 text-slate-700 dark:text-slate-300 */}
                                        <span className="font-medium text-slate-700 dark:text-slate-300">{sub.taskTitle}</span>
                                        <div className="flex items-center gap-2">
                                            {sub.status === 'approved' && (
                                                <div className="text-xs">
                                                    {/* 修改：使用 text-slate-900 dark:text-white */}
                                                    <span className="font-bold text-slate-900 dark:text-white">{Number(sub.points) || 0} <span className="text-[10px] font-normal">Pts</span></span>
                                                </div>
                                            )}
                                            <Badge className={
                                                sub.status === 'approved' ? 'bg-green-100 text-green-800 dark:bg-green-900/50 dark:text-green-300' :
                                                    sub.status === 'rejected' ? 'bg-red-100 text-red-800 dark:bg-red-900/50 dark:text-red-300' :
                                                        sub.status === 'withdrawn' ? 'bg-slate-100 text-slate-600 dark:bg-slate-700 dark:text-slate-400' :
                                                            'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/50 dark:text-yellow-300'
                                            }>
                                                {sub.status === 'approved' ? '完成' : sub.status === 'rejected' ? '退回' : sub.status === 'withdrawn' ? '已撤回' : '審核中'}
                                            </Badge>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </Card>
                    ))}
                </div>
            )}

            {isAdmin && <AdminConsole pendingSubs={pendingSubs} processedSubs={processedSubs} tasks={tasks} onReview={actions.review} showHistory={showHistory} toggleHistory={() => setShowHistory(!showHistory)} isHistoryMode={isHistoryMode} users={users} loading={loading} />}

            {isAdmin && !isHistoryMode && (
                <div className="mt-6 space-y-6">
                    {/* 1. 身分組設定 (Role Section) */}
                    <div>
                        {/* 修改：使用 text-slate-700 dark:text-slate-200 */}
                        <div className="flex justify-between items-center mb-2 px-1"><h3 className="font-bold text-slate-700 text-sm dark:text-slate-200">身分組設定 (加成系統)</h3><button onClick={handleOpenAddRole} className="text-xs bg-indigo-50 text-indigo-600 px-2 py-1 rounded hover:bg-indigo-100 dark:bg-indigo-900/30 dark:text-indigo-400 dark:hover:bg-indigo-900/50">+ 新增</button></div>
                        {/* 修改：使用 card 類別確保背景，並加入 noPadding */}
                        <Card noPadding className="card border-slate-200 dark:border-slate-700"><div className="divide-y divide-gray-50 dark:divide-slate-800">{(roles || []).length > 0 ? (roles || []).map(role => { const pct = Math.round((Number(role.multiplier) - 1) * 100); return (<div key={role.firestoreId} className="p-3 flex justify-between items-center text-sm"><div className="flex items-center gap-2"><span className="font-mono text-xs bg-gray-100 px-1 rounded text-gray-500 dark:bg-slate-700 dark:text-slate-300">{role.code}</span><span style={{ color: role.color }} className="font-bold">{role.label}</span><span className="text-xs text-gray-400">{pct > 0 ? `+${pct}%` : '0%'}</span></div><div className="flex gap-1"><button onClick={() => handleOpenEditRole(role)} className="p-1 text-gray-400 hover:text-indigo-500 dark:hover:text-indigo-400"><Icon name="Edit2" className="w-3 h-3" /></button><button onClick={() => handleDeleteRole(role.firestoreId)} className="p-1 text-gray-400 hover:text-red-500 dark:hover:text-red-400"><Icon name="Trash2" className="w-3 h-3" /></button></div></div>); }) : <div className="p-4 text-center text-xs text-gray-400">尚無身分組設定</div>}</div></Card>
                    </div>

                    {/* 2. 分類標籤設定 (Category Section) */}
                    <div>
                        {/* 修改：使用 text-slate-700 dark:text-slate-200 */}
                        <div className="flex justify-between items-center mb-2 px-1"><h3 className="font-bold text-slate-700 text-sm dark:text-slate-200">分類標籤管理</h3></div>
                        <CategorySection title="任務分類" type="task" list={(categories || []).filter(c => c.type !== 'announcement')} onAdd={() => handleOpenAddCat('task')} />
                        <CategorySection title="公告分類" type="announcement" list={(categories || []).filter(c => c.type === 'announcement')} onAdd={() => handleOpenAddCat('announcement')} />
                    </div>

                    {/* System Buttons */}
                    <div className="mt-4 pt-4 border-t border-slate-200 space-y-3 dark:border-slate-800">
                        <button onClick={() => confirm({ title: "匯入預設", message: "確定要匯入預設分類標籤？", onConfirm: actions.restoreDefaultCategories })} className="w-full bg-slate-200 text-slate-600 text-xs py-2 rounded-lg hover:bg-slate-300 flex items-center justify-center gap-2 dark:bg-slate-800 dark:text-slate-400 dark:hover:bg-slate-700"><Icon name="RefreshCw" className="w-3 h-3" />匯入預設分類</button>
                        <button onClick={() => confirm({ title: "修復連結", message: "確定要修復提交紀錄的 User ID 連結嗎？", onConfirm: actions.fixSubmissionLinks })} className="w-full bg-slate-200 text-slate-600 text-xs py-2 rounded-lg hover:bg-slate-300 flex items-center justify-center gap-2 dark:bg-slate-800 dark:text-slate-400 dark:hover:bg-slate-700"><Icon name="RefreshCw" className="w-3 h-3" />修復提交紀錄連結</button>
                        <button onClick={() => confirm({ title: "⚠️ 強制重置", message: "此操作將「永久刪除」所有任務、公告與提交紀錄！請再次確認！", onConfirm: actions.hardResetSystem })} className="w-full bg-red-100 text-red-600 text-xs py-2 rounded-lg hover:bg-red-200 flex items-center justify-center gap-2 dark:bg-red-900/30 dark:text-red-400 dark:hover:bg-red-900/50"><Icon name="Trash2" className="w-3 h-3" />[危險] 強制重置系統</button>
                    </div>
                </div>
            )}

            {/* Role Modal */}
            <Modal isOpen={roleModal.isOpen} onClose={() => setRoleModal({ ...roleModal, isOpen: false })} title={roleModal.id ? "編輯身分組" : "新增身分組"}>
                <div className="space-y-4">
                    {/* 修改：使用 input 類別 */}
                    <div><label className="text-xs font-bold text-gray-500 mb-1 block dark:text-slate-400">代號 (唯一 ID)</label><input className="input" placeholder="如: vip, mod" value={roleModal.code} onChange={e => setRoleModal({ ...roleModal, code: e.target.value })} disabled={!!roleModal.id} /></div>
                    <div><label className="text-xs font-bold text-gray-500 mb-1 block dark:text-slate-400">顯示名稱</label><input className="input" value={roleModal.label} onChange={e => setRoleModal({ ...roleModal, label: e.target.value })} /></div>
                    <div><label className="text-xs font-bold text-gray-500 mb-1 block dark:text-slate-400">積分加成 (%)</label><div className="flex items-center gap-2"><input type="number" className="input" value={roleModal.percentage} onChange={e => setRoleModal({ ...roleModal, percentage: e.target.value })} /><span className="text-sm font-bold text-gray-500">%</span></div></div>
                    <div><label className="text-xs font-bold text-gray-500 mb-1 block dark:text-slate-400">標籤顏色</label><div className="flex flex-wrap gap-2 mb-2">{presetColors.map(color => (<button key={color} type="button" onClick={() => setRoleModal({ ...roleModal, color })} className={`w-6 h-6 rounded-full border-2 ${roleModal.color === color ? 'border-gray-600 scale-110' : 'border-transparent'}`} style={{ backgroundColor: color }} />))}</div><div className="flex items-center gap-2"><input type="color" className="w-10 h-10 p-1 border rounded cursor-pointer shrink-0" value={roleModal.color} onChange={e => setRoleModal({ ...roleModal, color: e.target.value })} /><input type="text" className="input" value={roleModal.color} onChange={e => setRoleModal({ ...roleModal, color: e.target.value })} /></div></div>
                    <Button onClick={handleSaveRole} className="w-full" disabled={loading}>儲存</Button>
                </div>
            </Modal>

            {/* Category Modal */}
            <Modal isOpen={catModal.isOpen} onClose={() => setCatModal({ ...catModal, isOpen: false })} title={catModal.id ? "編輯分類" : "新增分類"}>
                <div className="space-y-4">
                    {/* 修改：使用 input 類別 */}
                    <div><label className="text-xs font-bold text-gray-500 mb-1 block dark:text-slate-400">分類名稱</label><input className="input" value={catModal.label} onChange={e => setCatModal({ ...catModal, label: e.target.value })} /></div>
                    <div>
                        <label className="text-xs font-bold text-gray-500 dark:text-slate-400">適用類型</label>
                        {/* 修改：使用 input 類別 (select 元素) */}
                        <select className="input" value={catModal.type} onChange={e => setCatModal({ ...catModal, type: e.target.value })}><option value="task">任務 (Task)</option><option value="announcement">公告 (Announcement)</option></select>
                    </div>
                    <div><label className="text-xs font-bold text-gray-500 mb-1 block dark:text-slate-400">標籤顏色</label><div className="flex flex-wrap gap-2 mb-2">{presetColors.map(color => (<button key={color} type="button" onClick={() => setCatModal({ ...catModal, color })} className={`w-6 h-6 rounded-full border-2 ${catModal.color === color ? 'border-gray-600 scale-110' : 'border-transparent'}`} style={{ backgroundColor: color }} />))}</div><div className="flex items-center gap-2"><input type="color" className="w-10 h-10 p-1 border rounded cursor-pointer shrink-0" value={catModal.color} onChange={e => setCatModal({ ...catModal, color: e.target.value })} /><input type="text" className="input" value={catModal.color} onChange={e => setCatModal({ ...catModal, color: e.target.value })} /></div></div>
                    {catModal.systemTag && <div className="text-[10px] text-indigo-500 bg-indigo-50 p-2 rounded dark:bg-indigo-900/30 dark:text-indigo-300">此為系統保留標籤 ({catModal.systemTag})，若修改名稱，關聯的任務依然會留在原系統區塊。</div>}
                    <Button onClick={handleSaveCat} className="w-full" disabled={loading}>儲存</Button>
                </div>
            </Modal>
        </div>
    );
};