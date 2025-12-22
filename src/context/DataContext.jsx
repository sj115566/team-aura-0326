import React, { createContext, useContext, useEffect, useState, useMemo } from 'react';
import { useAuth } from '../hooks/useAuth';
import { useData } from '../hooks/useData';
import { useAdmin } from '../hooks/useAdmin';
import { useToast } from './ToastContext';
import { db } from '../services/firebase';
import { collection, query, where, getDocs, doc, deleteDoc, updateDoc } from 'firebase/firestore'; // 補上 updateDoc
import { useRegisterSW } from 'virtual:pwa-register/react';
import { useLocation } from 'react-router-dom';


const DataContext = createContext();


export const DataProvider = ({ children }) => {
   const { currentUser, loading: authLoading, login, logout, updateCurrentUser } = useAuth();
   const { showToast } = useToast();
   const location = useLocation();


   // --- 深色模式邏輯 (Dark Mode) ---
   // 預設讀取 LocalStorage，若無則檢查系統偏好
   const [theme, setTheme] = useState(() => {
       if (typeof window !== 'undefined') {
           const saved = localStorage.getItem('app_theme');
           if (saved) return saved;
           return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
       }
       return 'light';
   });


   useEffect(() => {
       const root = window.document.documentElement;
       if (theme === 'dark') {
           root.classList.add('dark');
       } else {
           root.classList.remove('dark');
       }
       localStorage.setItem('app_theme', theme);
   }, [theme]);


   const toggleTheme = () => {
       setTheme(prev => prev === 'dark' ? 'light' : 'dark');
   };


   // --- PWA 更新邏輯 ---
   const {
       needRefresh: [needRefresh, setNeedRefresh],
       updateServiceWorker,
   } = useRegisterSW({
       onRegistered(r) { console.log('SW Registered: ' + r); },
       onRegisterError(error) { console.log('SW registration error', error); },
   });


   const refreshApp = () => {
       if (needRefresh) {
           showToast("正在更新...", "success");
           updateServiceWorker(true);
       } else {
           showToast("正在強制重新載入...", "success");
           setTimeout(() => window.location.reload(), 500);
       }
   };


   // --- 資料 Hook ---
   const dataState = useData(currentUser, updateCurrentUser);
   const {
       seasonName, users, roles, tasks, submissions, announcements, games, categories,
       selectedSeason, currentSeason, availableSeasons, isHistoryMode,
       dataLoading, setSelectedSeason,
       lotteryTarget // 🔥 接收抽獎目標分數
   } = dataState;


   // --- Admin Hook ---
   const { actions: adminActions, adminLoading } = useAdmin(currentUser, seasonName, users, roles);


   // --- 通知系統 ---
   const [notifications, setNotifications] = useState({ announcements: false, tasks: false });


   useEffect(() => {
       if (!currentUser || isHistoryMode) return;


       const checkNewContent = () => {
           const lastViewedAnc = parseInt(localStorage.getItem('lastViewed_announcements') || '0');
           const lastViewedTask = parseInt(localStorage.getItem('lastViewed_tasks') || '0');


           const hasNewAnc = announcements.some(a => new Date(a.timestamp).getTime() > lastViewedAnc);
          
           const hasNewTask = tasks.some(t => {
               const time = t.createdAt?.seconds ? t.createdAt.seconds * 1000 : parseInt(t.id.split('_')[1] || 0);
               return time > lastViewedTask;
           });


           const currentTab = location.pathname.split('/').pop() || 'announcements';
          
           setNotifications({
               announcements: hasNewAnc && currentTab !== '' && currentTab !== 'announcements',
               tasks: hasNewTask && currentTab !== 'tasks'
           });
       };


       checkNewContent();
   }, [announcements, tasks, currentUser, isHistoryMode, location.pathname]);


   const clearNotification = (tabName) => {
       localStorage.setItem(`lastViewed_${tabName}`, Date.now().toString());
       setNotifications(prev => ({ ...prev, [tabName]: false }));
   };


   // --- 加成計算 ---
   const getMultiplier = (userRoleCodes) => {
       const safeRoles = roles || [];
       const userRoles = userRoleCodes || [];
       const activeRoles = safeRoles.filter(r => userRoles.includes(r.code));
       let totalExtra = 0;
       activeRoles.forEach(r => {
           const rate = Number(r.multiplier) || 1;
           totalExtra += (rate - 1);
       });
       return Math.max(1, 1 + totalExtra);
   };


   const currentMultiplier = useMemo(() => {
       if (!currentUser?.roles) return 1;
       return getMultiplier(currentUser.roles);
   }, [currentUser, roles]);


   // --- 報表匯出 ---
   const exportReport = async () => {
       try {
           showToast("正在下載完整資料，請稍候...");
           let allSubmissions = [];
           try {
               const q = query(collection(db, "submissions"), where("status", "==", "approved"), where("season", "==", selectedSeason));
               const snapshot = await getDocs(q);
               allSubmissions = snapshot.docs.map(d => d.data());
           } catch (e) {
               console.warn("Export fallback", e);
               allSubmissions = submissions.filter(s => s.status === 'approved');
           }


           const reportUsers = users.filter(u => !u.isAdmin);
           const subMap = new Map();
           allSubmissions.forEach(s => {
               const userKey = s.userDocId || s.uid;
               subMap.set(`${userKey}_${s.taskId}`, Number(s.points) || 0);
           });


           const sortedTasks = [...tasks].sort((a, b) => {
               const wa = parseInt(a.week) || 999;
               const wb = parseInt(b.week) || 999;
               return wa === wb ? String(a.id).localeCompare(String(b.id)) : wa - wb;
           });


           const headers = ['User ID', 'Username', 'Roles', 'Total Points', ...sortedTasks.map(t => `[W${t.week}] ${t.title}`)];
           const rows = reportUsers.map(u => {
               const multiplier = getMultiplier(u.roles);
               let total = 0;
               const taskCols = sortedTasks.map(t => {
                   let rawPts = subMap.get(`${u.firestoreId}_${t.id}`);
                   if (rawPts === undefined) rawPts = subMap.get(`${u.username}_${t.id}`);
                   rawPts = rawPts || 0;
                   const weightedPts = Math.round(rawPts * multiplier);
                   total += weightedPts;
                   return rawPts;
               });
               const safeUid = `"${u.uid}"`;
               const safeName = `"${(u.username || '').replace(/"/g, '""')}"`;
               const userRoles = (u.roles || []).map(r => {
                   const safeRoles = roles || [];
                   const role = safeRoles.find(ro => ro.code === r);
                   return role ? role.label : r;
               }).join(';');
               return [safeUid, safeName, `"${userRoles}"`, total, ...taskCols].join(',');
           });


           const csvString = '\uFEFF' + [headers.join(','), ...rows].join('\n');
           const blob = new Blob([csvString], { type: 'text/csv;charset=utf-8;' });
           const url = URL.createObjectURL(blob);
           const link = document.createElement('a');
           link.href = url;
           link.download = `TeamAura_Report_${selectedSeason}_${new Date().toISOString().slice(0,10)}.csv`;
           document.body.appendChild(link);
           link.click();
           document.body.removeChild(link);
           showToast("報表已匯出");
       } catch (e) {
           console.error(e);
           showToast("匯出失敗: " + e.message, "error");
       }
   };


   // --- Actions 封裝 (ID 轉換) ---
   const deleteTask = (id) => { const task = tasks.find(t => t.id === id); if (task) adminActions.deleteTask(task.firestoreId); };
   const deleteAnnouncement = (id) => { const item = announcements.find(a => a.id === id); if (item) adminActions.deleteAnnouncement(item.firestoreId); };
   const deleteGame = (id) => { const item = games.find(g => g.id === id); if (item) adminActions.deleteGame(item.firestoreId); };
  
   // 🔥 [修復] 撤回功能 (獨立實作，改用 update 軟刪除)
   const withdraw = async (subId) => {
       if (!currentUser) return;
      
       // 1. 在本地狀態中尋找該提交
       const sub = submissions.find(s => s.id === subId);
       if (!sub) {
           showToast("找不到該提交紀錄", "error");
           return;
       }


       // 2. 身分驗證：比對 Document ID
       // currentUser.firestoreId 是由 useAuth 提供的 Firestore Document ID
       // sub.userDocId 是提交時寫入的 User Document ID
       const isOwner = sub.userDocId === currentUser.firestoreId;
       const isAdmin = currentUser.isAdmin;


       if (!isOwner && !isAdmin) {
           showToast("您沒有權限撤回此任務", "error");
           return;
       }


       // 3. 執行更新 (設定為 'withdrawn' 狀態)
       // 注意：Firestore 規則需要允許使用者 update 自己的文件
       try {
           const subRef = doc(db, "submissions", sub.firestoreId);
           await updateDoc(subRef, {
               status: "withdrawn", // 前端 TaskListView 遇到非標準狀態會 fallback 到 unsubmitted，顯示「立即回報」
               withdrawnAt: new Date().toISOString()
           });
           showToast("已撤回任務提交", "success");
       } catch (error) {
           console.error("Withdraw failed:", error);
           showToast("撤回失敗: " + error.message, "error");
       }
   };


   const review = (subId, action, points, statusOverride) => { const sub = submissions.find(s => s.id === subId); if (sub) adminActions.review(sub, action, points, statusOverride); };
   const updateAnnouncement = (id, title, content, rawFiles, category, isPinned, keepOldImages, categoryId) => { const item = announcements.find(x => x.id === id); if(item) return adminActions.updateAnnouncement(item, title, content, rawFiles, category, isPinned, keepOldImages, categoryId); };
   const updateGame = (data) => { const item = games.find(g => g.id === data.id); if(item) return adminActions.updateGame(item, data); };
   const setSeason = (season) => { setSelectedSeason(season); showToast(`已切換至 ${season}` + (season !== currentSeason ? " (歷史模式)" : "")); };


   const value = {
       ...dataState,
       currentUser, authLoading, adminLoading, loading: authLoading || adminLoading,
       isAdmin: currentUser?.isAdmin,
       isHistoryMode: selectedSeason && selectedSeason !== currentSeason && currentSeason !== '載入中...',
       login, logout,
       actions: {
           ...adminActions,
           deleteTask, deleteAnnouncement, deleteGame, withdraw, review, updateAnnouncement, updateGame,
           refreshApp, exportReport, setSeason,
            // 🔥 確保 updateSeasonTarget 被包含
            updateSeasonTarget: adminActions.updateSeasonTarget,
           hardResetSystem: adminActions.hardResetSystem,
           restoreDefaultCategories: adminActions.restoreDefaultCategories,
           fixSubmissionLinks: adminActions.fixSubmissionLinks,
           initializeSystem: adminActions.initializeSystem
       },
       needRefresh,
       currentMultiplier, getMultiplier,
       notifications, clearNotification,
       theme, toggleTheme, // 匯出主題控制
       lotteryTarget // 🔥 傳遞給前端
   };


   return <DataContext.Provider value={value}>{children}</DataContext.Provider>;
};


export const useGlobalData = () => useContext(DataContext);