import { useState, useEffect, useMemo } from 'react';
import { db } from '../services/firebase';
import { collection, query, orderBy, onSnapshot, doc, limit, where, getDocs } from 'firebase/firestore';


export const useData = (currentUser, updateCurrentUser) => {
 const [tasks, setTasks] = useState([]);
 const [submissions, setSubmissions] = useState([]);
 const [users, setUsers] = useState([]);
 const [announcements, setAnnouncements] = useState([]);
 const [games, setGames] = useState([]);
 const [roles, setRoles] = useState([]); // 新增 roles state
  // 賽季狀態
 const [currentSeason, setCurrentSeason] = useState('載入中...');
 const [availableSeasons, setAvailableSeasons] = useState([]);
 const [selectedSeason, setSelectedSeason] = useState(null);
  // 賽季目標分數與標題
 const [seasonGoal, setSeasonGoal] = useState(1000);
 const [seasonGoalTitle, setSeasonGoalTitle] = useState("Season Goal");


 // 判斷是否為歷史模式
 const isHistoryMode = useMemo(() => {
   return selectedSeason && selectedSeason !== currentSeason;
 }, [selectedSeason, currentSeason]);


 // 1. 監聽系統設定
 useEffect(() => {
   const unsubSettings = onSnapshot(doc(db, "system", "config"), (doc) => {
       if (doc.exists()) {
           const data = doc.data();
           const curr = data.currentSeason || "第一賽季";
          
           setCurrentSeason(curr);
          
           if (data.seasonGoal) setSeasonGoal(Number(data.seasonGoal));
           if (data.seasonGoalTitle) setSeasonGoalTitle(data.seasonGoalTitle);
          
           const past = data.availableSeasons || [];
           const all = Array.from(new Set([...past, curr]));
           setAvailableSeasons(all);


           setSelectedSeason(prev => {
               if (!prev || !all.includes(prev)) return curr;
               return prev;
           });
       } else {
           setCurrentSeason("第一賽季");
           setAvailableSeasons(["第一賽季"]);
           setSelectedSeason("第一賽季");
       }
   }, (error) => {
       console.error("系統設定讀取失敗:", error);
       setCurrentSeason("無法讀取");
   });


   return () => unsubSettings();
 }, []);


 // 2. 主資料監聽
 useEffect(() => {
   if (!selectedSeason) return;


   let unsubTasks = () => {};
   let unsubSubs = () => {};
   let unsubAnc = () => {};
   let unsubUsers = () => {};
   let unsubRoles = () => {};


   // --- 載入遊戲 ---
   const unsubGames = onSnapshot(collection(db, "games"), (s) => {
     setGames(s.docs.map(d => ({ ...d.data(), firestoreId: d.id })));
   });


   // --- 載入身分組 ---
   unsubRoles = onSnapshot(collection(db, "roles"), (s) => {
       setRoles(s.docs.map(d => ({ ...d.data(), firestoreId: d.id })));
   });


   const fetchData = async () => {
     const taskQ = query(collection(db, "tasks"), orderBy("id", "desc"));
     unsubTasks = onSnapshot(taskQ, (snapshot) => {
       const allTasks = snapshot.docs.map(doc => ({ ...doc.data(), firestoreId: doc.id }));
       const filteredTasks = allTasks.filter(t => !t.season || t.season === selectedSeason);
       setTasks(filteredTasks);
     });


     const ancQ = query(collection(db, "announcements"), orderBy("timestamp", "desc"), limit(50));
     unsubAnc = onSnapshot(ancQ, (snapshot) => {
         const allAnc = snapshot.docs.map(d => ({ ...d.data(), firestoreId: d.id }));
         const filteredAnc = allAnc.filter(a => !a.season || a.season === selectedSeason);
         setAnnouncements(filteredAnc);
     });


     if (!isHistoryMode) {
       const limitCount = currentUser?.isAdmin ? 1000 : 100;
       const subQ = query(
           collection(db, "submissions"),
           where("season", "==", selectedSeason),
           orderBy("timestamp", "desc"),
           limit(limitCount)
       );
      
       unsubSubs = onSnapshot(subQ, (s) => {
           setSubmissions(s.docs.map(d => ({ ...d.data(), firestoreId: d.id })));
       });


       unsubUsers = onSnapshot(query(collection(db, "users")), (snapshot) => {
           const usersData = snapshot.docs.map(doc => {
               const data = doc.data();
               return {
                   ...data,
                   uid: data.uid || data.username,
                   points: Number(data.points) || 0,
                   firestoreId: doc.id
               };
           });
           setUsers(usersData);
          
           if (currentUser) {
               const freshMe = usersData.find(u => u.username === currentUser.username);
               if (freshMe && (freshMe.points !== (currentUser.points || 0) || freshMe.isAdmin !== currentUser.isAdmin)) {
                   updateCurrentUser(freshMe);
               }
           }
       });


     } else {
       const subQ = query(
           collection(db, "submissions"),
           where("season", "==", selectedSeason),
           orderBy("timestamp", "desc")
       );
      
       unsubSubs = onSnapshot(subQ, (snapshot) => {
           const allSubs = snapshot.docs.map(d => ({ ...d.data(), firestoreId: d.id }));
           setSubmissions(allSubs);


           const seasonPointsMap = {};
           allSubs.forEach(sub => {
               if (sub.status === 'approved') {
                   const pts = Number(sub.points) || 0;
                   seasonPointsMap[sub.uid] = (seasonPointsMap[sub.uid] || 0) + pts;
               }
           });


           getDocs(collection(db, "users")).then(userSnap => {
               const historyUsers = userSnap.docs.map(doc => {
                   const data = doc.data();
                   const uid = data.uid || data.username;
                   return {
                       ...data,
                       uid: uid,
                       points: seasonPointsMap[uid] || 0,
                       firestoreId: doc.id
                   };
               });
               setUsers(historyUsers);
           });
       });
     }
   };


   fetchData();


   return () => {
     unsubTasks();
     unsubSubs();
     unsubAnc();
     unsubUsers();
     unsubGames();
     unsubRoles();
   };
 }, [currentUser?.username, selectedSeason, isHistoryMode]);


 return {
     tasks, submissions, users, announcements, games, roles,
     seasonName: currentSeason,
     currentSeason,
     selectedSeason,
     setSelectedSeason,
     availableSeasons,
     isHistoryMode,
     seasonGoal,
     seasonGoalTitle
 };
};



