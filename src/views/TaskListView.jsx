import React, { useState, useMemo, useEffect } from 'react';
import { Button } from '../components/ui/Button';
import { Badge } from '../components/ui/Badge';
import { Card } from '../components/ui/Card';
import { Icon } from '../components/Icons';
import { useGlobalData } from '../context/DataContext';
import { useModals } from '../context/ModalContext';
import { getCategoryInfo } from '../utils/categoryHelper';
import { CardSkeleton, ListSkeleton } from '../components/ui/Skeleton';

export const TaskListView = () => {
    const { tasks, submissions, currentUser, isAdmin, isHistoryMode, categories, actions, dataLoading, mySubmissions } = useGlobalData();
    const { openSubmitModal, openTaskModal, confirm } = useModals();

    const [expandedWeeks, setExpandedWeeks] = useState({});

    useEffect(() => {
        if (tasks && tasks.length > 0 && Object.keys(expandedWeeks).length === 0) {
            const updates = { 'pinned-main': true };
            const weeks = tasks.map(t => parseInt(t.week)).filter(n => !isNaN(n));
            if (weeks.length > 0) {
                const maxWeek = Math.max(...weeks);
                updates[`daily-${maxWeek}`] = true;
                updates[`weekly-${maxWeek}`] = true;
            }
            setExpandedWeeks(updates);
        }
    }, [tasks]);

    const [sortOrder, setSortOrder] = useState('desc');
    const [filterStatus, setFilterStatus] = useState('incomplete');
    const [filterCategory, setFilterCategory] = useState('all');

    const onToggleWeek = (key) => setExpandedWeeks(prev => ({ ...prev, [key]: !prev[key] }));
    const handleBatchExpand = (groupData, prefix, isExpand) => {
        const updates = {};
        groupData.forEach(({ week }) => { updates[`${prefix}-${week}`] = isExpand; });
        setExpandedWeeks(prev => ({ ...prev, ...updates }));
    };
    const handleSingleSectionToggle = (key, isExpand) => setExpandedWeeks(prev => ({ ...prev, [key]: isExpand }));

    const groupTasksByWeek = (taskList) => {
        const grouped = {};
        taskList.forEach(t => {
            const rawW = t.week !== undefined && t.week !== null ? String(t.week).trim() : 'Other';
            const w = rawW || 'Other';
            if (!grouped[w]) grouped[w] = [];
            grouped[w].push(t);
        });
        const sortedWeeks = Object.keys(grouped).sort((a, b) => {
            const na = parseInt(a);
            const nb = parseInt(b);
            if (!isNaN(na) && !isNaN(nb)) return sortOrder === 'asc' ? na - nb : nb - na;
            return a.localeCompare(b);
        });
        return sortedWeeks.map(w => {
            grouped[w].sort((a, b) => {
                if (!!a.isPinned !== !!b.isPinned) return a.isPinned ? -1 : 1;
                return String(b.id).localeCompare(String(a.id));
            });
            return { week: w, tasks: grouped[w] };
        });
    };

    const { pinnedList, dailyGroup, weeklyGroup } = useMemo(() => {
        if (!tasks) return { pinnedList: [], dailyGroup: [], weeklyGroup: [] };
        let filteredTasks = tasks.filter(t => {
            if (filterCategory !== 'all') {
                const catInfo = getCategoryInfo(t, categories);
                if (t.categoryId === filterCategory || (!t.categoryId && catInfo.label === categories.find(c => c.firestoreId === filterCategory)?.label)) { }
                else return false;
            }
            const sList = mySubmissions || [];
            // 尋找是否有任何一筆是「審核中」或「已通過」
            const myMatch = sList.filter(s => (String(s.taskId) === String(t.firestoreId) || String(s.taskId) === String(t.id)));
            const isDone = myMatch.some(s => s.status === 'pending' || s.status === 'approved');
            if (filterStatus === 'incomplete' && isDone) return false;
            if (filterStatus === 'complete' && !isDone) return false;
            return true;
        });
        const pList = [], dList = [], wList = [];
        filteredTasks.forEach(task => {
            const catInfo = getCategoryInfo(task, categories);
            const isSystemPinned = catInfo.systemTag === 'pinned';
            const isSystemDaily = catInfo.systemTag === 'daily';
            const isLegacyPinned = !catInfo.systemTag && catInfo.label === '常駐';
            const isLegacyDaily = !catInfo.systemTag && catInfo.label === '每日';
            if (isSystemPinned || isLegacyPinned) pList.push(task);
            else if (isSystemDaily || isLegacyDaily) dList.push(task);
            else wList.push(task);
        });
        pList.sort((a, b) => {
            if (!!a.isPinned !== !!b.isPinned) return a.isPinned ? -1 : 1;
            return String(b.id).localeCompare(String(a.id));
        });
        return { pinnedList: pList, dailyGroup: groupTasksByWeek(dList), weeklyGroup: groupTasksByWeek(wList) };
    }, [tasks, sortOrder, filterStatus, filterCategory, mySubmissions, currentUser, categories]);

    const filterOptions = useMemo(() => categories ? categories.filter(c => c.type === 'task') : [], [categories]);
    const handleDelete = (task) => { confirm({ title: "刪除任務", message: `確定要刪除「${task.title}」嗎？`, onConfirm: () => actions.deleteTask(task.id) }); };
    const handleWithdraw = (subId) => { confirm({ title: "撤回提交", message: "確定要撤回此任務的提交嗎？", onConfirm: () => actions.withdraw(subId) }); };

    const TaskCard = ({ task }) => {
        const sList = mySubmissions || [];
        const myMatches = sList.filter(s => (String(s.taskId) === String(task.firestoreId) || String(s.taskId) === String(task.id)));

        // 優先取得「已通過」或「審核中」的紀錄來顯示狀態
        const mySub = myMatches.find(s => s.status === 'approved') || myMatches.find(s => s.status === 'pending') || myMatches[0];
        const status = mySub ? mySub.status : null;
        const isDone = status === 'pending' || status === 'approved';
        const catInfo = getCategoryInfo(task, categories);
        const badgeStyle = { backgroundColor: catInfo.found ? catInfo.color : '#f3f4f6', color: catInfo.found ? '#ffffff' : '#4b5563' };
        return (
            // 修改: 使用 card 類別確保深色模式適配，保留條件式背景顏色
            <div className={`card p-3 border rounded-xl flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 hover:border-indigo-600 transition-all group ${task.isPinned ? 'bg-indigo-400/10 border-indigo-300 dark:bg-indigo-900/20 dark:border-indigo-900' : 'border-gray-50 dark:border-slate-700'}`}>
                <div className="flex items-start gap-3">
                    {/* 修改: 圖示背景適配深色模式 */}
                    <div className="text-xl w-10 h-10 bg-white rounded-full flex items-center justify-center flex-shrink-0 shadow-sm border border-gray-100 group-hover:scale-110 transition-transform dark:bg-slate-700 dark:border-slate-600">{task.icon}</div>
                    <div className="space-y-1">
                        <div className="flex items-center gap-2 flex-wrap">
                            {task.isPinned && <Icon name="Pin" className="w-3 h-3 text-indigo-500 dark:text-indigo-400" />}
                            <span className="text-[10px] px-1.5 py-0.5 rounded font-bold" style={badgeStyle}>{catInfo.label}</span>
                            {/* 修改: 標題文字顏色適配 */}
                            <div className="font-bold text-sm text-slate-800 dark:text-slate-100">{task.title}</div>
                        </div>
                        {/* 修改: 描述文字顏色適配 (text-muted-custom 或 gray-500->slate-400) */}
                        {task.description && <div className="text-[11px] text-gray-500 pl-1 dark:text-slate-400">{task.description}</div>}
                        <div className="text-xs text-indigo-600 font-bold pl-1 dark:text-indigo-400">{task.type === 'variable' ? '管理員評分' : `+${task.points} pts`}</div>
                    </div>
                </div>
                <div className="flex justify-end items-center gap-2 w-full sm:w-auto mt-2 sm:mt-0 pt-2 sm:pt-0 border-t sm:border-t-0 border-gray-50 dark:border-slate-700">
                    {isAdmin ? (!isHistoryMode && (<><button onClick={() => openTaskModal(task)} className="p-2 rounded-lg bg-slate-100 text-slate-500 hover:bg-slate-200 hover:text-blue-600 transition-colors dark:bg-slate-700 dark:text-slate-400 dark:hover:bg-slate-600 dark:hover:text-blue-400"><Icon name="Edit2" className="w-4 h-4" /></button><button onClick={() => onDuplicateTask(task)} className="p-2 rounded-lg bg-slate-100 text-slate-500 hover:bg-slate-200 hover:text-slate-700 transition-colors dark:bg-slate-700 dark:text-slate-400 dark:hover:bg-slate-600 dark:hover:text-slate-300"><Icon name="Copy" className="w-4 h-4" /></button><Button variant="danger" className="p-2 rounded-lg" onClick={() => handleDelete(task)}><Icon name="Trash2" className="w-4 h-4" /></Button></>)) : (!isDone ? (!isHistoryMode && <Button variant="primary" className="text-xs px-4 py-1.5 w-full sm:w-auto" onClick={() => openSubmitModal(task)}>回報</Button>) : (<div className="flex flex-col items-end gap-1"><Badge color={status === 'approved' ? 'green' : 'yellow'}>{status === 'approved' ? '已通過' : '審核中'}</Badge>{status === 'pending' && !isHistoryMode && <button onClick={() => handleWithdraw(mySub.id)} className="text-[10px] text-red-400 hover:text-red-600 underline font-bold">撤回</button>}</div>))}
                </div>
            </div>
        );
    };

    const TaskGroupSection = ({ title, icon, colorClass, groupData, prefix }) => {
        if (groupData.length === 0) return null;
        return (
            <div className="space-y-2 mb-6">
                <div className="flex items-center justify-between px-1">
                    {/* 修改: 標題顏色適配 */}
                    <div className={`flex items-center gap-2 text-sm font-bold uppercase tracking-wider ${colorClass}`}>{prefix === 'daily' ? <Icon name={icon} className="w-4 h-4 text-orange-500" /> : <Icon name={icon} className="w-4 h-4 text-slate-500 dark:text-slate-400" />}{title}</div>
                    {/* 修改: 摺疊按鈕容器背景色適配 */}
                    <div className="flex bg-white border border-slate-200 rounded-lg p-0.5 shrink-0 dark:bg-slate-800 dark:border-slate-700"><button onClick={() => handleBatchExpand(groupData, prefix, true)} className="p-1.5 rounded hover:bg-slate-100 text-slate-400 transition-colors dark:hover:bg-slate-700"><Icon name="ChevronsDown" className="w-3 h-3" /></button><div className="w-[1px] bg-slate-100 my-1 dark:bg-slate-700"></div><button onClick={() => handleBatchExpand(groupData, prefix, false)} className="p-1.5 rounded hover:bg-slate-100 text-slate-400 transition-colors dark:hover:bg-slate-700"><Icon name="ChevronsUp" className="w-3 h-3" /></button></div>
                </div>
                {groupData.map(({ week, tasks: weekTasks }) => {
                    const expandKey = `${prefix}-${week}`;
                    const isExpanded = !!expandedWeeks[expandKey];
                    return (
                        // 修改: 使用 card 類別確保背景，保留條件式樣式
                        <Card key={week} noPadding className={`card border-slate-200 dark:border-slate-700 ${prefix === 'daily' ? 'bg-orange-50/10 border-orange-100 dark:bg-orange-900/10 dark:border-orange-900/30' : ''}`}>
                            {/* 修改: 摺疊標題列背景色與文字顏色適配 */}
                            <div onClick={() => onToggleWeek(expandKey)} className={`p-3 border-b border-gray-100 dark:border-slate-800 flex justify-between items-center cursor-pointer hover:bg-slate-50 select-none transition-colors dark:hover:bg-slate-800/50 ${isExpanded ? 'bg-opacity-50' : 'bg-transparent'}`}><div className="flex items-center gap-2 font-bold text-slate-700 dark:text-slate-200"><span>{!isNaN(parseInt(week)) ? `第 ${week} 週` : week}</span><Badge color="gray">{weekTasks.length}</Badge></div><Icon name={isExpanded ? "ChevronDown" : "ChevronRight"} className="w-4 h-4 text-gray-400" /></div>
                            {isExpanded && (<div className="p-2 space-y-2 bg-white dark:bg-slate-800">{weekTasks.map(task => <TaskCard key={task.id} task={task} />)}</div>)}
                        </Card>
                    );
                })}
            </div>
        );
    };

    const { openTaskModal: openEdit } = useModals();
    const onDuplicateTask = (task) => { openEdit({ ...task, id: null, firestoreId: null, title: task.title + " (複製)", isPinned: task.isPinned || false }); };

    if (dataLoading) return <ListSkeleton />;

    return (
        <div className="space-y-4 animate-fadeIn">
            <div className="space-y-2">
                <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2">
                        {/* 修改: 使用 page-title，調整文字大小與 margin */}
                        <h2 className="font-bold page-title mb-0 text-lg">任務列表</h2>
                        <button onClick={() => setSortOrder(prev => prev === 'desc' ? 'asc' : 'desc')} className="p-1.5 rounded-lg hover:bg-slate-200 text-slate-400 transition-colors dark:hover:bg-slate-800"><Icon name={sortOrder === 'desc' ? "ArrowDown" : "ArrowUp"} className="w-4 h-4" /></button>
                    </div>
                    {isAdmin && !isHistoryMode && (<Button variant="primary" className="text-xs px-3 py-1.5" onClick={() => openTaskModal(null)} icon="Plus">新增</Button>)}
                </div>
                <div className="flex flex-col gap-3">
                    {/* 修改: 篩選器背景色適配 */}
                    <div className="bg-slate-200 p-1 rounded-lg flex text-xs font-bold text-slate-500 w-full dark:bg-slate-800 dark:text-slate-400">
                        {['incomplete:未完成', 'complete:已完成', 'all:全部'].map(opt => {
                            const [val, label] = opt.split(':');
                            return <button key={val} onClick={() => setFilterStatus(val)} className={`flex-1 py-1.5 rounded-md transition-all whitespace-nowrap ${filterStatus === val ? 'bg-white text-indigo-600 shadow-sm dark:bg-slate-700 dark:text-indigo-400' : 'hover:text-slate-700 dark:hover:text-slate-200'}`}>{label}</button>;
                        })}
                    </div>
                    <div className="flex flex-wrap gap-2 items-center">
                        {/* 修改: 類別篩選按鈕樣式適配 */}
                        <button onClick={() => setFilterCategory('all')} className={`px-3 py-1.5 rounded-full text-xs font-bold transition-all border ${filterCategory === 'all' ? 'bg-slate-700 text-white border-slate-700 dark:bg-slate-600 dark:border-slate-500' : 'bg-white text-slate-500 border-slate-200 hover:border-slate-300 dark:bg-slate-800 dark:text-slate-400 dark:border-slate-700'}`}>全部</button>
                        {filterOptions.map(cat => (<button key={cat.firestoreId} onClick={() => setFilterCategory(cat.firestoreId)} className={`px-3 py-1.5 rounded-full text-xs font-bold transition-all border flex items-center gap-1 ${filterCategory === cat.firestoreId ? 'ring-2 ring-offset-1 ring-slate-200 dark:ring-slate-700' : 'hover:opacity-80'}`} style={{ backgroundColor: cat.color, color: '#ffffff', borderColor: cat.color }}>{filterCategory === cat.firestoreId && <Icon name="Check" className="w-3 h-3" />}{cat.label}</button>))}
                    </div>
                </div>
            </div>

            {pinnedList.length > 0 && (() => {
                const isPinnedExpanded = !!expandedWeeks['pinned-main'];
                return (
                    <div className="space-y-2 mb-6">
                        {/* 修改: 標題與按鈕容器適配 */}
                        <div className="flex items-center justify-between px-1"><div className="flex items-center gap-2 text-sm font-bold text-red-500 uppercase tracking-wider"><Icon name="Map" className="w-4 h-4" />常駐與公告</div><div className="flex bg-white border border-slate-200 rounded-lg p-0.5 shrink-0 dark:bg-slate-800 dark:border-slate-700"><button onClick={() => handleSingleSectionToggle('pinned-main', true)} className="p-1.5 rounded hover:bg-slate-100 text-slate-400 transition-colors dark:hover:bg-slate-700"><Icon name="ChevronsDown" className="w-3 h-3" /></button><div className="w-[1px] bg-slate-100 my-1 dark:bg-slate-700"></div><button onClick={() => handleSingleSectionToggle('pinned-main', false)} className="p-1.5 rounded hover:bg-slate-100 text-slate-400 transition-colors dark:hover:bg-slate-700"><Icon name="ChevronsUp" className="w-3 h-3" /></button></div></div>
                        {/* 修改: 使用 card 類別，保留常駐任務特殊背景 */}
                        {(isPinnedExpanded || expandedWeeks['pinned-main'] === undefined) && (<Card noPadding className="card border-red-100 bg-red-50/10 dark:border-red-900/30 dark:bg-red-900/10"><div className="p-2 space-y-2">{pinnedList.map(task => <TaskCard key={task.id} task={task} />)}</div></Card>)}
                        {expandedWeeks['pinned-main'] === false && (<div className="text-center text-xs text-gray-400 cursor-pointer hover:text-red-500 py-2 border border-dashed border-gray-200 rounded-lg dark:border-slate-700" onClick={() => handleSingleSectionToggle('pinned-main', true)}>已折疊 {pinnedList.length} 個常駐任務</div>)}
                    </div>
                );
            })()}
            {weeklyGroup.length > 0 && <TaskGroupSection title="賽季進度" icon="Trophy" colorClass="text-slate-500 dark:text-slate-400" groupData={weeklyGroup} prefix="weekly" />}
            {dailyGroup.length > 0 && <TaskGroupSection title="每日挑戰" icon="Calendar" colorClass="text-orange-500" groupData={dailyGroup} prefix="daily" />}
            {/* 修改: 空狀態樣式適配 */}
            {(pinnedList.length === 0 && dailyGroup.length === 0 && weeklyGroup.length === 0) && (<div className="text-center py-12 text-gray-400 bg-white rounded-xl border border-dashed border-gray-200 dark:bg-slate-800 dark:border-slate-700"><Icon name="Check" className="w-12 h-12 mx-auto mb-2 opacity-20" /><p className="text-sm font-bold">沒有符合條件的任務</p></div>)}
        </div>
    );
};