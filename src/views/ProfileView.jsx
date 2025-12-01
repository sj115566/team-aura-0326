import React, { useState, useMemo } from 'react';
import { Button } from '../components/ui/Button';
import { Badge } from '../components/ui/Badge';
import { Card } from '../components/ui/Card';
import { Icon } from '../components/Icons';
import { AdminConsole } from '../components/AdminConsole';

export const ProfileView = ({ currentUser, tasks, submissions, onLogout, isAdmin, onReview, onInitialize, onHardReset, isHistoryMode }) => {
  const [historySort, setHistorySort] = useState('desc');
  const [showHistory, setShowHistory] = useState(false);
  const [showStats, setShowStats] = useState(false);

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

  return (
    <div className="animate-fadeIn space-y-6">
      <Card className="text-center">
        <h2 className="font-black text-xl text-slate-800 break-all">{currentUser.uid}</h2>
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
                  {weeklyStats.length > 0 ? weeklyStats.map(s => (
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

      {/* 修正：在 isAdmin 成立時，無論是否為歷史模式都顯示，但在內部由 AdminConsole 判斷行為 */}
      {isAdmin && (
        <AdminConsole 
          pendingSubs={pendingSubs} 
          processedSubs={processedSubs} 
          tasks={tasks} 
          onReview={onReview} 
          showHistory={showHistory} 
          toggleHistory={() => setShowHistory(!showHistory)} 
          isHistoryMode={isHistoryMode} // 傳遞參數
        />
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
    </div>
  );
};