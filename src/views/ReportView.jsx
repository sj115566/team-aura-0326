import React, { useState, useMemo } from 'react';
import { Button } from '../components/ui/Button';
import { Card } from '../components/ui/Card';
import { Icon } from '../components/Icons';

export const ReportView = ({ tasks, users, submissions, onArchiveSeason, isHistoryMode, onExport }) => {
  const { weeks, rows } = useMemo(() => {
    // 過濾掉管理員，只顯示一般成員
    const reportUsers = users.filter(u => !u.isAdmin);
    
    // 建立提交紀錄的快速查找表 (Map)
    const subMap = new Map();
    submissions.forEach(s => {
      if (s.status === 'approved') {
        subMap.set(`${s.uid}_${s.taskId}`, Number(s.points));
      }
    });

    // 將任務按週次分組
    const grouped = {};
    tasks.forEach(t => {
      const w = t.week || 'Other';
      if (!grouped[w]) grouped[w] = [];
      grouped[w].push(t);
    });

    // 排序週次 (由大到小)
    const sortedWeeks = Object.keys(grouped)
      .sort((a, b) => parseInt(b) - parseInt(a))
      .map(w => ({ 
        week: w, 
        tasks: grouped[w].sort((a, b) => String(b.id).localeCompare(String(a.id))) 
      }));

    // 計算每位使用者的得分矩陣
    const rowsData = reportUsers.map(u => {
      const weekTotals = {};
      const taskPoints = {};
      
      sortedWeeks.forEach(w => {
        let wTotal = 0;
        w.tasks.forEach(t => {
          const pts = subMap.get(`${u.uid}_${t.id}`);
          taskPoints[t.id] = pts !== undefined ? pts : null;
          wTotal += (pts || 0);
        });
        weekTotals[w.week] = wTotal;
      });
      
      return { user: u, weekTotals, taskPoints };
    });

    return { weeks: sortedWeeks, rows: rowsData };
  }, [tasks, users, submissions]);

  const [expandedCols, setExpandedCols] = useState({});
  const toggleCol = (w) => setExpandedCols(prev => ({ ...prev, [w]: !prev[w] }));

  return (
    <div className="animate-fadeIn space-y-4">
      <div className="flex justify-between items-center">
        <h2 className="font-bold text-slate-700 text-lg">積分統整表</h2>
        <div className="flex gap-2">
            {/* 新增匯出按鈕 */}
            <Button variant="secondary" className="text-xs py-1.5" onClick={onExport} icon="ArrowDown">匯出</Button>
            
            {/* 只有在非歷史模式下顯示重置按鈕 */}
            {!isHistoryMode && (
                <Button 
                variant="danger" 
                className="text-xs py-1.5" 
                onClick={onArchiveSeason} 
                icon="Archive"
                >
                重置賽季
                </Button>
            )}
        </div>
      </div>
      
      <Card noPadding className="flex flex-col h-[75vh]">
        <div className="overflow-auto flex-1 custom-scrollbar relative">
          <table className="w-full text-sm border-collapse relative">
            <thead>
              <tr>
                {/* 左上角固定標題 */}
                <th className="sticky top-0 left-0 z-30 bg-slate-100 border-b border-r border-slate-200 p-3 min-w-[120px] text-left font-bold text-slate-600 shadow-sm h-12">
                  User / Week
                </th>
                
                {/* 週次標題 (可點擊展開) */}
                {weeks.map(w => (
                  <th 
                    key={w.week} 
                    onClick={() => toggleCol(w.week)} 
                    className="sticky top-0 z-20 bg-indigo-50 border-b border-r border-indigo-100 p-2 font-bold text-indigo-700 cursor-pointer hover:bg-indigo-100 transition-colors min-w-[80px]" 
                    colSpan={expandedCols[w.week] ? w.tasks.length : 1}
                  >
                    <div className="flex items-center justify-center gap-1">
                      <span>W{w.week}</span>
                      <Icon name={expandedCols[w.week] ? "ChevronDown" : "ChevronRight"} className="w-3 h-3"/>
                    </div>
                  </th>
                ))}
              </tr>
              
              {/* 第二層標題 (任務名稱) */}
              <tr>
                <th className="sticky left-0 z-20 bg-slate-50 border-r border-b border-slate-200 p-2 text-xs text-gray-400 font-normal">
                  Name
                </th>
                {weeks.map(w => (
                  expandedCols[w.week] ? 
                    w.tasks.map(t => (
                      <th key={t.id} className="bg-white border-b border-r border-gray-100 p-2 text-[10px] text-gray-500 font-medium min-w-[80px] max-w-[120px] truncate" title={t.title}>
                        {t.title}
                      </th>
                    )) :
                    <th key={w.week} className="bg-white border-b border-r border-gray-100 p-2 text-[10px] text-gray-400 italic">
                      Total
                    </th>
                ))}
              </tr>
            </thead>
            
            <tbody>
              {rows.map(row => (
                <tr key={row.user.uid} className="hover:bg-gray-50">
                  {/* 使用者名稱 (左側固定) */}
                  <td className="sticky left-0 z-10 bg-white border-r border-b border-gray-100 p-3 font-bold text-slate-700 shadow-[2px_0_5px_-2px_rgba(0,0,0,0.05)]">
                    {row.user.uid}
                  </td>
                  
                  {/* 分數內容 */}
                  {weeks.map(w => (
                    expandedCols[w.week] ? 
                      w.tasks.map(t => {
                        const val = row.taskPoints[t.id];
                        return (
                          <td key={t.id} className="border-b border-r border-gray-100 p-2 text-center">
                            {val !== null ? 
                              <span className="font-bold text-indigo-600 bg-indigo-50 px-1.5 py-0.5 rounded text-xs">{val}</span> : 
                              <span className="text-gray-200 text-xs">-</span>
                            }
                          </td>
                        );
                      }) :
                      <td key={w.week} className="border-b border-r border-gray-100 p-2 text-center bg-gray-50/50">
                        <span className="font-bold text-slate-500 text-xs">{row.weekTotals[w.week]}</span>
                      </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
};