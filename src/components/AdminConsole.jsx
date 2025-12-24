import React, { useState, useMemo, useEffect } from 'react';
import { Button } from './ui/Button';
import { Badge } from './ui/Badge';
import { Modal } from './ui/Modal';
import { Icon } from './Icons';
import { useGlobalData } from '../context/DataContext';

export const AdminConsole = ({ pendingSubs, processedSubs, tasks, onReview, showHistory, toggleHistory, isHistoryMode, users = [], loading }) => {
  const [viewing, setViewing] = useState(null);
  const [editSub, setEditSub] = useState(null);
  const [inputPoints, setInputPoints] = useState({});
  const [historyFilter, setHistoryFilter] = useState('all');
  const [searchTerm, setSearchTerm] = useState('');
  const { actions } = useGlobalData();

  const handlePointChange = (subId, value) => {
    setInputPoints(prev => ({ ...prev, [subId]: value }));
  };

  const getLatestDisplayName = (sub) => {
    if (sub.userDocId) {
      const foundUser = users.find(u => u.firestoreId === sub.userDocId);
      if (foundUser) return foundUser.username;
    }
    const foundUserByUid = users.find(u => u.username === sub.uid);
    if (foundUserByUid) return foundUserByUid.username;
    return sub.username || sub.uid;
  };

  const getTaskTitle = (taskId) => {
    const t = tasks.find(task => task.firestoreId === taskId || task.id === taskId);
    return t ? t.title : taskId;
  };

  // 確保過濾掉 pending 列表中的 withdrawn 狀態
  const activePendingSubs = pendingSubs.filter(sub => sub.status !== 'withdrawn');

  // 歷史紀錄篩選邏輯
  const filteredHistory = useMemo(() => {
    if (!processedSubs) return [];
    return processedSubs.filter(sub => {
      // 1. 狀態篩選
      if (historyFilter !== 'all' && sub.status !== historyFilter) return false;

      // 2. 關鍵字搜尋
      if (searchTerm) {
        const term = searchTerm.toLowerCase();
        const title = getTaskTitle(sub.taskId).toLowerCase();
        const user = getLatestDisplayName(sub).toLowerCase();
        return title.includes(term) || user.includes(term);
      }
      return true;
    }).sort((a, b) => b.timestamp - a.timestamp);
  }, [processedSubs, historyFilter, searchTerm, tasks, users]);

  // 當 editSub 開啟且狀態為 approved 時的自動檢查 (備用)
  useEffect(() => {
    if (editSub && editSub.status === 'approved') {
      const currentPoints = Number(editSub.points);
      if (!currentPoints) { // 如果分數為 0 或 NaN
        let base = Number(editSub.basePoints) || 0;
        if (base === 0) {
          const task = tasks.find(t => t.firestoreId === editSub.taskId || t.id === editSub.taskId);
          if (task) base = Number(task.points) || 0;
        }
        if (base > 0) {
          setEditSub(prev => ({ ...prev, points: base, basePoints: base }));
        }
      }
    }
  }, [editSub?.status]);

  return (
    <div className="card p-5 mt-6 border-slate-200 dark:border-slate-700 bg-slate-800 text-white dark:bg-slate-900 shadow-lg rounded-2xl">
      <div className="flex justify-between items-center mb-4">
        <h3 className="font-bold flex items-center gap-2 text-lg text-white">
          <Icon name="Shield" className="w-5 h-5 text-indigo-400" />
          {isHistoryMode ? '歷史審核紀錄' : '審核控制台'}
        </h3>
        <button
          onClick={toggleHistory}
          className="text-xs bg-slate-700 hover:bg-slate-600 px-3 py-1.5 rounded-lg flex items-center gap-1 transition-colors text-white dark:bg-slate-800 dark:hover:bg-slate-700"
        >
          <Icon name="History" className="w-3 h-3" /> {showHistory ? '隱藏歷史' : '顯示歷史'}
        </button>
      </div>

      {!isHistoryMode && (
        activePendingSubs.length > 0 ? (
          <div className="space-y-3">
            {activePendingSubs.map(sub => {
              const task = tasks.find(t => t.firestoreId === sub.taskId || t.id === sub.taskId);
              const imgs = JSON.parse(sub.images || sub.proofImage || '[]');
              const isVari = task?.type === 'variable';
              const currentPoints = inputPoints[sub.id] || '';
              const displayName = getLatestDisplayName(sub);
              const displayId = sub.userDocId ? `(ID: ...${sub.userDocId.slice(-4)})` : '';

              let pointsToPass = 0;
              if (isVari) {
                pointsToPass = currentPoints;
              } else {
                if (sub.basePoints !== undefined && sub.basePoints !== null) {
                  pointsToPass = sub.basePoints;
                } else if (task && task.points) {
                  pointsToPass = task.points;
                } else {
                  pointsToPass = sub.points;
                }
              }

              return (
                <div key={sub.id} className="bg-slate-700 p-4 rounded-xl border border-slate-600 dark:bg-slate-800 dark:border-slate-700 shadow-sm">
                  <div className="flex justify-between text-xs text-slate-400 mb-2">
                    <div className="flex flex-col">
                      <span className="font-bold text-slate-200">
                        {displayName} <span className="text-slate-500 font-normal scale-90">{displayId}</span>
                      </span>
                      <span className="text-[10px] text-slate-500 mt-0.5">
                        {new Date(sub.timestamp).toLocaleString()}
                      </span>
                    </div>
                    <span className="bg-slate-600 px-1.5 py-0.5 rounded text-white h-fit dark:bg-slate-700">W{sub.week}</span>
                  </div>
                  <div className="font-bold text-lg mb-1 text-white">{sub.taskTitle}</div>
                  <div className="text-xs text-slate-300 mb-3">{sub.proof || '無備註'}</div>

                  {imgs.length > 0 && (
                    <div className="flex gap-2 overflow-x-auto mb-3 pb-2 custom-scrollbar">
                      {imgs.map((url, i) => (
                        <img
                          key={i}
                          src={url}
                          onClick={() => setViewing(url)}
                          className="w-16 h-16 object-cover rounded border border-slate-500 cursor-pointer hover:opacity-80 transition-opacity"
                          alt="proof"
                          loading="lazy"
                        />
                      ))}
                    </div>
                  )}

                  {isVari && (
                    <input
                      type="number"
                      placeholder="請輸入分數"
                      value={currentPoints}
                      onChange={(e) => handlePointChange(sub.id, e.target.value)}
                      className="w-full p-2 mb-3 bg-slate-800 text-white border border-slate-600 rounded text-sm outline-none focus:border-indigo-500 transition-colors dark:bg-slate-900 dark:border-slate-700 placeholder:text-slate-500"
                    />
                  )}

                  <div className="flex gap-2">
                    <Button
                      variant="success"
                      className="flex-1 py-1.5 text-sm"
                      onClick={() => onReview(sub.id, 'approve', pointsToPass)}
                      disabled={loading}
                    >
                      通過
                    </Button>
                    <Button
                      variant="ghost"
                      className="flex-1 py-1.5 text-sm bg-slate-600 hover:bg-red-500 text-white dark:bg-slate-700 dark:hover:bg-red-600"
                      onClick={() => onReview(sub.id, 'reject', 0)}
                      disabled={loading}
                    >
                      駁回
                    </Button>
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          <div className="text-slate-500 text-center text-sm py-4 border border-dashed border-slate-600 rounded-xl dark:border-slate-700">無待審核任務</div>
        )
      )}

      {showHistory && (
        <div className={`border-t border-slate-700 pt-4 mt-4 animate-fadeIn ${isHistoryMode ? 'border-t-0 pt-0 mt-0' : ''}`}>
          {!isHistoryMode && <h4 className="font-bold text-sm mb-3 text-slate-300">歷史紀錄 & 修正</h4>}

          <div className="flex flex-wrap gap-2 mb-3">
            {/* 修改：加上 rounded-lg */}
            <input
              className="input text-xs py-1.5 px-3 w-full sm:w-auto flex-1 bg-slate-700 border-slate-600 text-white placeholder-slate-400 focus:border-indigo-500 rounded-lg"
              placeholder="搜尋使用者或任務..."
              value={searchTerm}
              onChange={e => setSearchTerm(e.target.value)}
            />
            <div className="flex bg-slate-700 p-1 rounded-lg border border-slate-600">
              {[
                { id: 'all', label: '全部' },
                { id: 'approved', label: '通過' },
                { id: 'rejected', label: '退回' },
                { id: 'withdrawn', label: '已撤回' }
              ].map(filter => (
                <button
                  key={filter.id}
                  onClick={() => setHistoryFilter(filter.id)}
                  className={`px-3 py-1 rounded-md text-xs font-bold transition-all ${historyFilter === filter.id
                    ? 'bg-slate-600 text-white shadow-sm'
                    : 'text-slate-400 hover:text-slate-200'
                    }`}
                >
                  {filter.label}
                </button>
              ))}
            </div>
          </div>

          <div className="space-y-2 max-h-[300px] overflow-y-auto custom-scrollbar pr-1">
            {filteredHistory.map(sub => {
              const isApproved = sub.status === 'approved';
              const isWithdrawn = sub.status === 'withdrawn';
              const displayName = getLatestDisplayName(sub);

              const displayTime = isWithdrawn && sub.withdrawnAt
                ? new Date(sub.withdrawnAt).toLocaleString()
                : new Date(sub.timestamp).toLocaleString();
              const timeLabel = isWithdrawn ? '撤回於' : '';

              return (
                <div key={sub.id} className="bg-slate-700/50 p-3 rounded-lg flex justify-between items-center text-xs border border-slate-700 dark:bg-slate-800/50 hover:bg-slate-700 transition-colors">
                  <div className="flex-1">
                    <div className="flex gap-2 mb-1 items-center">
                      <span className="font-bold text-slate-200">{displayName}</span>
                      <Badge className={`text-[10px] px-1.5 py-0.5 ${sub.status === 'approved' ? 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400' :
                        sub.status === 'rejected' ? 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400' :
                          'bg-slate-100 text-slate-600 dark:bg-slate-700 dark:text-slate-300'
                        }`}>
                        {sub.status === 'approved' ? '通過' : sub.status === 'rejected' ? '退回' : '已撤回'}
                      </Badge>
                    </div>
                    <div className="text-slate-400 truncate">{getTaskTitle(sub.taskId)}</div>
                    {isApproved && (
                      <div className="mt-1 text-[10px] text-slate-500">
                        原始分數: <span className="text-slate-300 font-bold">{sub.points}</span>
                      </div>
                    )}
                    <div className="text-[10px] text-slate-500 mt-0.5">
                      {timeLabel} {displayTime}
                    </div>
                  </div>

                  {/* 修改：如果是 withdrawn 狀態，則不顯示編輯按鈕 */}
                  {!isHistoryMode && !isWithdrawn && (
                    <button
                      onClick={() => setEditSub(sub)}
                      className="p-2 bg-slate-600 hover:bg-indigo-500 rounded text-white transition-colors ml-2 dark:bg-slate-700"
                    >
                      <Icon name="Edit2" className="w-3 h-3" />
                    </button>
                  )}
                </div>
              );
            })}
            {filteredHistory.length === 0 && <div className="text-center text-slate-500 text-xs py-2">無符合條件的紀錄</div>}
          </div>
        </div>
      )}

      <Modal
        isOpen={!!viewing}
        title="預覽圖片"
        onClose={() => setViewing(null)}
        maxWidth="max-w-3xl"
      >
        <div className="flex justify-center items-center bg-slate-900/50 rounded-xl p-2 min-h-[300px]">
          <img
            src={viewing}
            className="max-w-full max-h-[70vh] rounded-lg shadow-2xl object-contain animate-fadeIn"
            alt="proof full"
          />
        </div>
        <div className="mt-4">
          <Button
            variant="ghost"
            className="w-full text-slate-400 hover:text-white"
            onClick={() => setViewing(null)}
          >
            關閉預覽
          </Button>
        </div>
      </Modal>

      <Modal isOpen={!!editSub} title="修正紀錄" onClose={() => setEditSub(null)}>
        {editSub && (
          <div className="space-y-4">
            <div className="text-xs bg-slate-50 p-2 rounded border border-slate-200 dark:bg-slate-800 dark:border-slate-700">
              <div className="font-bold text-slate-700 dark:text-slate-200">User: {getLatestDisplayName(editSub)}</div>
              <div className="text-slate-500 dark:text-slate-400">Task: {getTaskTitle(editSub.taskId)}</div>
              <div className="text-slate-400 mt-1">Date: {new Date(editSub.timestamp).toLocaleString()}</div>
            </div>
            <div>
              <label className="text-xs font-bold text-muted-custom mb-1 block">狀態</label>
              <select
                value={editSub.status}
                // 修改：強化 onChange 邏輯，確保選 approved 時能自動帶入原始分數
                onChange={e => {
                  const newStatus = e.target.value;
                  setEditSub(prev => {
                    let newData = { ...prev, status: newStatus };
                    if (newStatus === 'approved') {
                      // 檢查目前分數是否無效 (0 或 NaN)
                      const currentPoints = Number(prev.points);
                      if (!currentPoints) {
                        let base = Number(prev.basePoints) || 0;

                        // 嘗試從 tasks 列表找回原始設定
                        if (base === 0) {
                          const task = tasks.find(t => t.firestoreId === prev.taskId || t.id === prev.taskId);
                          if (task) base = Number(task.points) || 0;
                        }

                        if (base > 0) {
                          newData.points = base;
                          newData.basePoints = base;
                        }
                      }
                    }
                    return newData;
                  });
                }}
                className="input p-2 border border-slate-300 dark:border-slate-700 rounded-lg w-full"
              >
                <option value="approved">通過</option>
                <option value="rejected">駁回</option>
              </select>
            </div>
            {editSub.status === 'approved' && (
              <div>
                <label className="text-xs font-bold text-muted-custom mb-1 block">
                  原始分數 (Base Points)
                  <span className="font-normal text-slate-400 ml-1 block mt-1 text-[10px]">
                    - 請輸入原始分數，系統會自動在後台計算加成。
                  </span>
                </label>
                <input
                  type="number"
                  value={editSub.basePoints !== undefined ? editSub.basePoints : editSub.points}
                  onChange={e => setEditSub({ ...editSub, points: e.target.value, basePoints: e.target.value })}
                  className="input p-2 border border-slate-300 dark:border-slate-700 rounded-lg w-full"
                />
              </div>
            )}
            <Button
              variant="primary"
              className="w-full"
              disabled={loading}
              onClick={() => {
                onReview(editSub.id, 'update', editSub.points, editSub.status);
                setEditSub(null);
              }}
            >
              確認修正
            </Button>
          </div>
        )}
      </Modal>

      {/* 系統維護區塊 */}
      {!isHistoryMode && (
        <div className="mt-8 pt-4 border-t border-slate-700">
          <h4 className="font-bold text-sm mb-3 text-slate-400 flex items-center gap-2"><Icon name="Settings" className="w-4 h-4" /> 系統維護工具</h4>
          <div className="flex gap-2">
            <Button variant="secondary" className="text-xs py-1.5 px-3 bg-slate-700 border-slate-600 text-slate-300 hover:bg-slate-600 dark:bg-slate-700 dark:border-slate-600" onClick={() => actions.fixSubmissionLinks()}>
              <Icon name="Link" className="w-3 h-3" /> 修復資料連結
            </Button>
            <div className="text-[10px] text-slate-500 flex items-center">
              *若發現舊資料無法顯示或連結失效，請執行此修復。
            </div>
          </div>
        </div>
      )}
    </div>
  );
};