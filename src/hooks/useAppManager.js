import { useState, useMemo, useEffect } from 'react';
import { useAuth } from './useAuth';
import { useData } from './useData';
import { useAdmin } from './useAdmin';
import { useToast } from '../context/ToastContext';
import { db } from '../services/firebase';
import { collection, query, where, getDocs } from 'firebase/firestore';
import { useRegisterSW } from 'virtual:pwa-register/react';

export const useAppManager = () => {
 const [activeTab, setActiveTab] = useState('announcements');
 const [expandedWeeks, setExpandedWeeks] = useState({});
 const [dialog, setDialog] = useState({ isOpen: false, title: '', message: '', onConfirm: null });
 const [exporting, setExporting] = useState(false);
  const [notifications, setNotifications] = useState({ announcements: false, tasks: false });

 const { showToast } = useToast();

 const {
   needRefresh: [needRefresh, setNeedRefresh],
   updateServiceWorker,
 } = useRegisterSW({
   onRegistered(r) {
     console.log('SW Registered: ' + r);
   },
   onRegisterError(error) {
     console.log('SW registration error', error);
   },
 });

 const { currentUser, loading: authLoading, login, logout, updateCurrentUser } = useAuth();

 const {
     tasks, submissions, users, announcements, games, seasonName,
     currentSeason, selectedSeason, setSelectedSeason, availableSeasons, isHistoryMode,
     seasonGoal, seasonGoalTitle, roles, categories 
 } = useData(currentUser, updateCurrentUser);

 const { actions: adminActions, adminLoading } = useAdmin(currentUser, seasonName, users, roles);

 useEffect(() => {
   if (!currentUser || isHistoryMode) return;

   const checkNewContent = () => {
       const lastViewedAnc = localStorage.getItem('lastViewed_announcements') || 0;
       const lastViewedTask = localStorage.getItem('lastViewed_tasks') || 0;

       const hasNewAnc = announcements.some(a => new Date(a.timestamp).getTime() > lastViewedAnc);
      
       const hasNewTask = tasks.some(t => {
           const time = t.createdAt?.seconds ? t.createdAt.seconds * 1000 : parseInt(t.id.split('_')[1] || 0);
           return time > lastViewedTask;
       });

       setNotifications({
           announcements: hasNewAnc && activeTab !== 'announcements',
           tasks: hasNewTask && activeTab !== 'tasks'
       });
   };

   checkNewContent();
 }, [announcements, tasks, activeTab, currentUser, isHistoryMode]);

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

 const uiActions = {
   setTab: (tab) => {
       setActiveTab(tab);
       localStorage.setItem(`lastViewed_${tab}`, Date.now());
       setNotifications(prev => ({ ...prev, [tab]: false }));
   },
   
   toggleWeek: (key) => {
     setExpandedWeeks(prev => ({ ...prev, [key]: !prev[key] }));
   },

   batchSetExpanded: (updates) => {
       setExpandedWeeks(prev => ({ ...prev, ...updates }));
   },
  
   refresh: () => {
       if (needRefresh) {
           showToast("發現新版本，正在更新...", "success");
           updateServiceWorker(true);
       } else {
           showToast("正在強制重新載入...", "success");
           setTimeout(() => {
               window.location.reload();
           }, 500);
       }
   },
  
   setSeason: (season) => {
       setSelectedSeason(season);
       showToast(`已切換至 ${season}` + (season !== currentSeason ? " (歷史模式)" : ""));
   },

   exportReport: async () => {
     setExporting(true);
     try {
       showToast("正在下載完整資料，請稍候...");
      
       let allSubmissions = [];
       try {
           const q = query(
               collection(db, "submissions"),
               where("status", "==", "approved"),
               where("season", "==", selectedSeason)
           );
           const snapshot = await getDocs(q);
           allSubmissions = snapshot.docs.map(d => d.data());
       } catch (e) {
           console.error("Fetch full report failed", e);
           allSubmissions = submissions.filter(s => s.status === 'approved');
       }

       const reportUsers = users.filter(u => !u.isAdmin);
       const subMap = new Map();
       allSubmissions.forEach(s => {
           // 優先使用 docId 建立 key，若無則用 uid (username)
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
               // 嘗試用 ID 找，找不到用 Username 找 (後者是舊資料兼容)
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
           const safeRolesStr = `"${userRoles}"`;

           return [safeUid, safeName, safeRolesStr, total, ...taskCols].join(',');
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
     } finally {
       setExporting(false);
     }
   },

   deleteTask: (id) => {
     const task = tasks.find(t => t.id === id);
     if (task) {
       setDialog({ isOpen: true, title: "刪除任務", message: "確定？", onConfirm: async () => {
         await adminActions.deleteTask(task.firestoreId);
         setDialog(prev => ({ ...prev, isOpen: false }));
       }});
     }
   },
   deleteAnnouncement: (id) => {
     const item = announcements.find(x => x.id === id);
     if (item) {
       setDialog({ isOpen: true, title: "刪除公告", message: "確定？", onConfirm: async () => {
         await adminActions.deleteAnnouncement(item.firestoreId);
         setDialog(prev => ({ ...prev, isOpen: false }));
       }});
     }
   },
   deleteGame: (id) => {
     const item = games.find(x => x.id === id);
     if (item) {
       setDialog({ isOpen: true, title: "刪除遊戲", message: "確定？", onConfirm: async () => {
         await adminActions.deleteGame(item.firestoreId);
         setDialog(prev => ({ ...prev, isOpen: false }));
       }});
     }
   },
   withdraw: (subId) => {
     const sub = submissions.find(s => s.id === subId);
     if (sub) {
       setDialog({ isOpen: true, title: "撤回提交", message: "確定？", onConfirm: async () => {
         await adminActions.withdraw(sub.firestoreId);
         setDialog(prev => ({ ...prev, isOpen: false }));
       }});
     }
   },
   review: (subId, action, points, statusOverride) => {
       const sub = submissions.find(s => s.id === subId);
       if(sub) {
           adminActions.review(sub, action, points, statusOverride);
       } else {
           console.error("Submission not found in local state:", subId);
           showToast("找不到該筆資料，請重新整理", "error");
       }
   },
   
   addAnnouncement: (title, content, rawFiles, category, isPinned, categoryId) => 
       adminActions.addAnnouncement(title, content, rawFiles, category, isPinned, categoryId),

   updateAnnouncement: (id, title, content, rawFiles, category, isPinned, keepOldImages, categoryId) => {
       const item = announcements.find(x => x.id === id);
       if(item) return adminActions.updateAnnouncement(item, title, content, rawFiles, category, isPinned, keepOldImages, categoryId);
   },
   
   uploadSingleImage: adminActions.uploadSingleImage,

   updateGame: (data) => {
       const item = games.find(g => g.id === data.id);
       if(item) return adminActions.updateGame(item, data);
   },
   
   updateTask: (firestoreId, data) => {
       return adminActions.updateTask(firestoreId, data);
   },

   addTask: adminActions.addTask,
   addGame: adminActions.addGame,
   
   addCategory: adminActions.addCategory,
   updateCategory: adminActions.updateCategory,
   deleteCategory: adminActions.deleteCategory,
   
   restoreDefaultCategories: adminActions.restoreDefaultCategories,
   
   // 新增：修復連結功能
   fixSubmissionLinks: adminActions.fixSubmissionLinks,

   hardResetSystem: () => {
       setDialog({
           isOpen: true,
           title: "⚠️ 強制重置警告",
           message: "此操作將「永久刪除」所有任務、公告與提交紀錄！",
           onConfirm: async () => {
               await adminActions.hardResetSystem();
               setDialog(prev => ({ ...prev, isOpen: false }));
           }
       });
   },
  
   initializeSystem: adminActions.initializeSystem
 };

 useEffect(() => {
   if (tasks.length > 0 && Object.keys(expandedWeeks).length === 0) {
       const updates = {};
       updates['pinned-main'] = true;
       const weeks = tasks.map(t => parseInt(t.week)).filter(n => !isNaN(n));
       if (weeks.length > 0) {
           const maxWeek = Math.max(...weeks);
           updates[`daily-${maxWeek}`] = true;
           updates[`weekly-${maxWeek}`] = true;
       }
       setExpandedWeeks(updates);
   }
 }, [tasks]);

 const sortedUsers = useMemo(() => {
   return [...users].filter(u => !u.isAdmin).sort((a, b) => (Number(b.points) || 0) - (Number(a.points) || 0));
 }, [users]);

 return {
   state: {
     tasks, submissions, users, announcements, games, currentUser, roles, 
     categories, 
     activeTab, loading: authLoading || adminLoading || exporting, expandedWeeks, seasonName, refreshing: false,
     currentSeason, selectedSeason, availableSeasons, isHistoryMode,
     needRefresh, notifications, seasonGoal, seasonGoalTitle
   },
   actions: {
     login,
     logout,
     ...adminActions,
     ...uiActions
   },
   sortedUsers,
   dialog,
   setDialog
 };
};