import React, { useState, useMemo } from 'react';
import { Button } from '../components/ui/Button';
import { Badge } from '../components/ui/Badge';
import { Card } from '../components/ui/Card';
import { Icon } from '../components/Icons';

export const TaskListView = ({ tasks, submissions, currentUser, isAdmin, expandedWeeks, onToggleWeek, onOpenSubmit, onDeleteTask, onOpenWithdraw, onOpenEditTask, isHistoryMode }) => {
  const [sortOrder, setSortOrder] = useState('desc');

  const groupedTasks = useMemo(() => {
    const grouped = {};
    tasks.forEach(t => {
      const w = t.week || 'Other';
      if (!grouped[w]) grouped[w] = [];
      grouped[w].push(t);
    });
    
    const sortedWeeks = Object.keys(grouped).sort((a, b) => {
      const na = parseInt(a), nb = parseInt(b);
      const compare = (!isNaN(na) && !isNaN(nb)) ? na - nb : a.localeCompare(b);
      return sortOrder === 'asc' ? compare : -compare;
    });

    sortedWeeks.forEach(w => grouped[w].sort((a, b) => String(b.id).localeCompare(String(a.id))));
    return sortedWeeks.map(w => ({ week: w, tasks: grouped[w] }));
  }, [tasks, sortOrder]);

  return (
    <div className="space-y-4 animate-fadeIn">
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <h2 className="font-bold text-slate-700 text-lg">任務列表</h2>
          <button 
            onClick={() => setSortOrder(prev => prev === 'desc' ? 'asc' : 'desc')} 
            className="p-1.5 rounded-lg hover:bg-slate-200 text-slate-400 transition-colors"
          >
            <Icon name={sortOrder === 'desc' ? "ArrowDown" : "ArrowUp"} className="w-4 h-4" />
          </button>
        </div>
        {isAdmin && !isHistoryMode && (
          <Button variant="primary" className="text-xs px-3 py-1.5" onClick={onOpenEditTask} icon="Plus">
            新增
          </Button>
        )}
      </div>
      <div className="space-y-3">
        {groupedTasks.map(({ week, tasks: weekTasks }) => (
          <Card key={week} noPadding className="border-slate-200">
            <div 
              onClick={() => onToggleWeek(week)} 
              className="p-3 bg-slate-50 border-b border-gray-100 flex justify-between items-center cursor-pointer hover:bg-slate-100 select-none transition-colors"
            >
              <div className="flex items-center gap-2 font-bold text-slate-700">
                <Icon name="Calendar" className="w-4 h-4 text-indigo-500" />
                <span>第 {week} 週</span>
                <Badge color="gray">{weekTasks.length} 任務</Badge>
              </div>
              <Icon name={expandedWeeks[week] ? "ChevronDown" : "ChevronRight"} className="w-4 h-4 text-gray-400" />
            </div>
            {expandedWeeks[week] && (
              <div className="p-2 space-y-2 bg-white">
                {weekTasks.map(task => {
                  const mySub = submissions.find(s => s.taskId === task.id && s.uid === currentUser.uid);
                  const status = mySub ? mySub.status : null;
                  const isDone = status === 'pending' || status === 'approved';
                  return (
                    <div key={task.id} className="p-3 border border-gray-50 rounded-xl flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 hover:border-indigo-100 transition-all group">
                      <div className="flex items-start gap-3">
                        <div className="text-xl w-10 h-10 bg-gray-50 rounded-full flex items-center justify-center flex-shrink-0 shadow-sm group-hover:scale-110 transition-transform">{task.icon}</div>
                        <div className="space-y-0.5">
                          <div className="font-bold text-sm text-slate-800">{task.title}</div>
                          {task.description && <div className="text-[11px] text-gray-500">{task.description}</div>}
                          <div className="text-xs text-indigo-600 font-bold">{task.type === 'variable' ? '管理員評分' : `+${task.points} pts`}</div>
                        </div>
                      </div>
                      <div className="flex justify-end w-full sm:w-auto">
                        {isAdmin ? (
                          !isHistoryMode && (
                            <Button variant="danger" className="p-2 rounded-lg" onClick={() => onDeleteTask(task.id)}>
                              <Icon name="Trash2" className="w-4 h-4" />
                            </Button>
                          )
                        ) : (
                          !isDone ? (
                            !isHistoryMode && <Button variant="primary" className="text-xs px-4 py-1.5 w-full sm:w-auto" onClick={() => onOpenSubmit(task)}>回報</Button>
                          ) : (
                            <div className="flex flex-col items-end gap-1">
                              <Badge color={status === 'approved' ? 'green' : 'yellow'}>{status === 'approved' ? '已通過' : '審核中'}</Badge>
                              {status === 'pending' && !isHistoryMode && <button onClick={() => onOpenWithdraw(mySub.id)} className="text-[10px] text-red-400 hover:text-red-600 underline font-bold">撤回</button>}
                            </div>
                          )
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </Card>
        ))}
      </div>
    </div>
  );
};