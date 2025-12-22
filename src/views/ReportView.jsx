import React, { useState, useMemo } from 'react';
import { Button } from '../components/ui/Button';
import { Card } from '../components/ui/Card';
import { Icon } from '../components/Icons';
import { useGlobalData } from '../context/DataContext';
import { useModals } from '../context/ModalContext';

export const ReportView = () => {
    const { tasks, users, submissions, isHistoryMode, roles, actions, getMultiplier } = useGlobalData();
    const { openArchiveModal } = useModals();

    const getUserRoleBadges = (userRoles) => {
        if (!userRoles || !roles) return [];
        return roles.filter(r => userRoles.includes(r.code));
    };

    const { weeks, rows } = useMemo(() => {
        const reportUsers = users.filter(u => !u.isAdmin);
        const subMap = new Map();
        submissions.forEach(s => {
            if (s.status === 'approved') {
                const pts = Number(s.points);
                if (s.userDocId) subMap.set(`${s.userDocId}_${s.taskId}`, pts);
                if (s.uid) subMap.set(`${s.uid}_${s.taskId}`, pts);
            }
        });

        const grouped = {};
        tasks.forEach(t => {
            const w = t.week || 'Other';
            if (!grouped[w]) grouped[w] = [];
            grouped[w].push(t);
        });

        const sortedWeeks = Object.keys(grouped)
            .sort((a, b) => parseInt(b) - parseInt(a))
            .map(w => ({
                week: w,
                tasks: grouped[w].sort((a, b) => String(b.id).localeCompare(String(a.id)))
            }));

        const rowsData = reportUsers.map(u => {
            const weekTotals = {};
            const taskPoints = {};
            const multiplier = getMultiplier(u.roles);
            
            sortedWeeks.forEach(w => {
                let wTotalBase = 0;
                w.tasks.forEach(t => {
                    let rawPts = subMap.get(`${u.firestoreId}_${t.id}`);
                    if (rawPts === undefined) rawPts = subMap.get(`${u.uid}_${t.id}`);
                    taskPoints[t.id] = rawPts !== undefined ? rawPts : null;
                    if (rawPts !== undefined) wTotalBase += rawPts;
                });
                weekTotals[w.week] = Math.round(wTotalBase * multiplier);
            });
            return { user: u, weekTotals, taskPoints, multiplier };
        });

        return { weeks: sortedWeeks, rows: rowsData };
    }, [tasks, users, submissions, roles, getMultiplier]);

    const [expandedCols, setExpandedCols] = useState({});
    const toggleCol = (w) => setExpandedCols(prev => ({ ...prev, [w]: !prev[w] }));

    return (
        <div className="animate-fadeIn space-y-4 w-[95vw] ml-[calc(50%-47.5vw)]">
            <div className="flex justify-between items-center">
                <h2 className="font-bold text-slate-700 text-lg dark:text-slate-100">積分統整表</h2>
                <div className="flex gap-2">
                    <Button variant="secondary" className="text-xs py-1.5" onClick={actions.exportReport} icon="ArrowDown">匯出</Button>
                    {!isHistoryMode && (
                        <Button variant="danger" className="text-xs py-1.5" onClick={openArchiveModal} icon="Archive">重置賽季</Button>
                    )}
                </div>
            </div>
            
            <Card noPadding className="flex flex-col h-[75vh] dark:bg-slate-900 dark:border-slate-800">
                <div className="overflow-auto flex-1 custom-scrollbar relative">
                    <table className="text-sm border-collapse relative min-w-full">
                        <thead>
                            <tr>
                                <th className="sticky top-0 left-0 z-30 bg-slate-100 border-b border-r border-slate-200 p-3 min-w-[120px] text-left font-bold text-slate-600 shadow-sm h-12 whitespace-nowrap dark:bg-slate-800 dark:border-slate-700 dark:text-slate-300">
                                    User Info
                                </th>
                                {weeks.map(w => (
                                    <th key={w.week} onClick={() => toggleCol(w.week)} className="sticky top-0 z-20 bg-indigo-50 border-b border-r border-indigo-100 p-2 font-bold text-indigo-700 cursor-pointer hover:bg-indigo-100 transition-colors min-w-[80px] dark:bg-indigo-900/30 dark:border-slate-700 dark:text-indigo-300 dark:hover:bg-indigo-900/50" colSpan={expandedCols[w.week] ? w.tasks.length : 1}>
                                        <div className="flex items-center justify-center gap-1"><span>W{w.week}</span><Icon name={expandedCols[w.week] ? "ChevronDown" : "ChevronRight"} className="w-3 h-3"/></div>
                                    </th>
                                ))}
                            </tr>
                            <tr>
                                <th className="sticky left-0 z-20 bg-slate-50 border-r border-b border-slate-200 p-2 text-xs text-gray-400 font-normal text-left whitespace-nowrap dark:bg-slate-800 dark:border-slate-700 dark:text-slate-500">
                                    <div className="flex flex-col gap-1"><span>Name</span><span className="text-[10px] text-gray-300 dark:text-slate-600">Roles</span></div>
                                </th>
                                {weeks.map(w => (
                                    expandedCols[w.week] ? w.tasks.map(t => (
                                        <th key={t.id} className="bg-white border-b border-r border-gray-100 p-2 text-[10px] text-gray-500 font-medium whitespace-nowrap px-3 dark:bg-slate-900 dark:border-slate-700 dark:text-slate-400" title={t.title}>
                                            {t.title}
                                        </th>
                                    )) : <th key={w.week} className="bg-white border-b border-r border-gray-100 p-2 text-[10px] text-gray-400 italic whitespace-nowrap dark:bg-slate-900 dark:border-slate-700 dark:text-slate-500">Total</th>
                                ))}
                            </tr>
                        </thead>
                        <tbody>
                            {rows.map(row => {
                                const userRoleBadges = getUserRoleBadges(row.user.roles);
                                return (
                                    <tr key={row.user.uid} className="hover:bg-gray-50 dark:hover:bg-slate-800/50">
                                        <td className="sticky left-0 z-10 bg-white border-r border-b border-gray-100 p-3 font-bold text-slate-700 shadow-[2px_0_5px_-2px_rgba(0,0,0,0.05)] whitespace-nowrap dark:bg-slate-900 dark:border-slate-700 dark:text-slate-200">
                                            <div className="flex flex-col gap-1">
                                                <span>{row.user.uid}</span>
                                                <div className="flex items-center gap-1 flex-wrap">
                                                    {userRoleBadges.map(role => (<span key={role.code} className="text-[9px] px-1 py-0.5 rounded border whitespace-nowrap" style={{ backgroundColor: role.color ? `${role.color}15` : '#f3f4f6', color: role.color || '#6b7280', borderColor: role.color ? `${role.color}40` : '#e5e7eb' }} title={`x${role.multiplier}`}>{role.label}</span>))}
                                                    {row.multiplier > 1 && <span className="text-[9px] text-indigo-400 font-mono">x{row.multiplier.toFixed(2)}</span>}
                                                </div>
                                            </div>
                                        </td>
                                        {weeks.map(w => (
                                            expandedCols[w.week] ? w.tasks.map(t => {
                                                const val = row.taskPoints[t.id];
                                                return (<td key={t.id} className="border-b border-r border-gray-100 p-2 text-center text-xs whitespace-nowrap dark:border-slate-700 dark:text-slate-400">{val !== null ? <span className="font-bold text-gray-600 bg-gray-50 px-1.5 py-0.5 rounded dark:bg-slate-800 dark:text-slate-300">{val}</span> : <span className="text-gray-200 dark:text-slate-700">-</span>}</td>);
                                            }) : <td key={w.week} className="border-b border-r border-gray-100 p-2 text-center bg-indigo-50/30 whitespace-nowrap dark:bg-indigo-900/20 dark:border-slate-700"><span className="font-bold text-indigo-600 text-xs dark:text-indigo-300">{row.weekTotals[w.week]}</span></td>
                                        ))}
                                    </tr>
                                );
                            })}
                        </tbody>
                    </table>
                </div>
            </Card>
        </div>
    );
};