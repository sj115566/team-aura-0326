import React, { useState } from 'react';
import { Button } from './ui/Button';
import { Badge } from './ui/Badge';
import { Modal } from './ui/Modal';
import { Icon } from './Icons';


export const AdminConsole = ({ pendingSubs, processedSubs, tasks, onReview, showHistory, toggleHistory, isHistoryMode }) => {
 const [viewing, setViewing] = useState(null);
 const [editSub, setEditSub] = useState(null);
 const [inputPoints, setInputPoints] = useState({});


 const handlePointChange = (subId, value) => {
   setInputPoints(prev => ({ ...prev, [subId]: value }));
 };


 return (
   <div className="bg-slate-800 text-white p-5 rounded-2xl shadow-lg mt-6">
     <div className="flex justify-between items-center mb-4">
       <h3 className="font-bold flex items-center gap-2 text-lg">
         <Icon name="Shield" className="w-5 h-5 text-indigo-400" />
         {isHistoryMode ? '歷史審核紀錄' : '審核控制台'}
       </h3>
       <button
         onClick={toggleHistory}
         className="text-xs bg-slate-700 hover:bg-slate-600 px-3 py-1.5 rounded-lg flex items-center gap-1 transition-colors"
       >
         <Icon name="History" className="w-3 h-3" /> {showHistory ? '隱藏歷史' : '顯示歷史'}
       </button>
     </div>


     {/* 待審核區塊 - 僅在非歷史模式顯示 */}
     {!isHistoryMode && (
       pendingSubs.length > 0 ? (
         <div className="space-y-3">
           {pendingSubs.map(sub => {
             const task = tasks.find(t => t.id === sub.taskId);
             const imgs = JSON.parse(sub.images || sub.proofImage || '[]');
             const isVari = task?.type === 'variable';
             const currentPoints = inputPoints[sub.id] || '';


             return (
               <div key={sub.id} className="bg-slate-700 p-4 rounded-xl border border-slate-600">
                 <div className="flex justify-between text-xs text-slate-400 mb-2">
                   <span className="font-bold text-slate-200">{sub.uid}</span>
                   <span className="bg-slate-600 px-1.5 rounded text-white">W{sub.week}</span>
                 </div>
                 <div className="font-bold text-lg mb-1">{sub.taskTitle}</div>
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
                     className="w-full p-2 mb-3 bg-slate-800 text-white border border-slate-600 rounded text-sm outline-none focus:border-indigo-500 transition-colors"
                   />
                 )}


                 <div className="flex gap-2">
                   <Button
                     variant="success"
                     className="flex-1 py-1.5 text-sm"
                     onClick={() => onReview(sub.id, 'approve', isVari ? currentPoints : sub.points)}
                   >
                     通過
                   </Button>
                   <Button
                     variant="ghost"
                     className="flex-1 py-1.5 text-sm bg-slate-600 hover:bg-red-500 text-white"
                     onClick={() => onReview(sub.id, 'reject', 0)}
                   >
                     駁回
                   </Button>
                 </div>
               </div>
             );
           })}
         </div>
       ) : (
         <div className="text-slate-500 text-center text-sm py-4 border border-dashed border-slate-600 rounded-xl">無待審核任務</div>
       )
     )}


     {/* 歷史紀錄區塊 - 只要 showHistory 為 true 就顯示 */}
     {showHistory && (
       <div className={`border-t border-slate-700 pt-4 mt-4 animate-fadeIn ${isHistoryMode ? 'border-t-0 pt-0 mt-0' : ''}`}>
         {!isHistoryMode && <h4 className="font-bold text-sm mb-3 text-slate-300">歷史紀錄 & 修正</h4>}
        
         <div className="space-y-2 max-h-[300px] overflow-y-auto custom-scrollbar pr-1">
           {processedSubs.map(sub => {
             // 判斷是否有原始分數 (basePoints) 且與最終分數 (points) 不同
             const hasBasePoints = sub.basePoints !== undefined && sub.basePoints !== null;
             const isDifferent = hasBasePoints && Number(sub.basePoints) !== Number(sub.points);
             const isApproved = sub.status === 'approved';


             return (
               <div key={sub.id} className="bg-slate-700/50 p-3 rounded-lg flex justify-between items-center text-xs border border-slate-700">
                 <div className="flex-1">
                   <div className="flex gap-2 mb-1 items-center">
                     <span className="font-bold text-slate-200">{sub.uid}</span>
                     <Badge color={sub.status==='approved'?'green':'red'}>{sub.status}</Badge>
                   </div>
                   <div className="text-slate-400 truncate">{sub.taskTitle}</div>
                   {/* 顯示分數詳情 */}
                   {isApproved && (
                     <div className="mt-1 text-[10px] text-slate-500">
                       {isDifferent ? (
                         <>
                           原始: <span className="text-slate-300">{sub.basePoints}</span>
                           {' '}<Icon name="ArrowRight" className="w-2 h-2 inline mx-0.5" />{' '}
                           加成後: <span className="text-indigo-400 font-bold">{sub.points}</span>
                         </>
                       ) : (
                         <>得分: <span className="text-slate-300">{sub.points}</span></>
                       )}
                     </div>
                   )}
                 </div>
                
                 {/* 歷史模式下不顯示編輯按鈕 */}
                 {!isHistoryMode && (
                   <button
                     onClick={() => setEditSub(sub)}
                     className="p-2 bg-slate-600 hover:bg-indigo-500 rounded text-white transition-colors ml-2"
                   >
                     <Icon name="Edit2" className="w-3 h-3" />
                   </button>
                 )}
               </div>
             );
           })}
           {processedSubs.length === 0 && <div className="text-center text-slate-500 text-xs py-2">無歷史紀錄</div>}
         </div>
       </div>
     )}


     {viewing && (
       <div className="fixed inset-0 z-[70] flex items-center justify-center bg-black/90 p-4" onClick={() => setViewing(null)}>
         <img src={viewing} className="max-w-full max-h-full rounded shadow-2xl" alt="proof full" />
         <button className="absolute top-4 right-4 text-white p-2"><Icon name="X" /></button>
       </div>
     )}


     <Modal isOpen={!!editSub} title="修正紀錄" onClose={() => setEditSub(null)}>
       {editSub && (
         <div className="space-y-4 text-slate-800">
           <div className="text-xs bg-gray-50 p-2 rounded">ID: {editSub.uid}<br/>Task: {editSub.taskTitle}</div>
           <div>
             <label className="text-xs font-bold text-gray-500">狀態</label>
             <select
               value={editSub.status}
               onChange={e => setEditSub({...editSub, status: e.target.value})}
               className="w-full p-2 border rounded mt-1 outline-none focus:border-indigo-500"
             >
               <option value="approved">通過</option>
               <option value="rejected">駁回</option>
             </select>
           </div>
           {editSub.status === 'approved' && (
             <div>
               <label className="text-xs font-bold text-gray-500">
                 原始分數 (Base Points)
                 <span className="font-normal text-gray-400 ml-1">- 系統會自動計算加成</span>
               </label>
               <input
                 type="number"
                 // 這裡綁定的是 points，但為了邏輯一致，如果我们要「修正」，
                 // 應該是修正 basePoints，然後讓系統重算。
                 // 但原本的 review 函式接收的是 points 參數並將其視為 basePoints (如果 approved)
                 // 所以這裡直接顯示目前的 points (若是舊資料沒有 basePoints) 或 basePoints
                 // 為了簡化，我們讓管理員輸入「想要給的基礎分」
                 value={editSub.basePoints !== undefined ? editSub.basePoints : editSub.points}
                 onChange={e => setEditSub({...editSub, points: e.target.value, basePoints: e.target.value})}
                 className="w-full p-2 border rounded mt-1 outline-none focus:border-indigo-500"
               />
             </div>
           )}
           <Button
             variant="primary"
             className="w-full"
             onClick={() => {
               // 這裡傳入的 editSub.points 會被 useAdmin 的 review 函式當作 basePoints 處理
               onReview(editSub.id, 'update', editSub.points, editSub.status);
               setEditSub(null);
             }}
           >
             確認修正
           </Button>
         </div>
       )}
     </Modal>
   </div>
 );
};



