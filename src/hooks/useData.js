import { useState, useEffect, useMemo } from 'react';
import { db } from '../services/firebase';
import { collection, query, orderBy, onSnapshot, doc, limit, where, getDocs } from 'firebase/firestore';

export const useData = (currentUser, updateCurrentUser) => {
  const [tasks, setTasks] = useState([]);
  const [submissions, setSubmissions] = useState([]);
  const [users, setUsers] = useState([]);
  const [announcements, setAnnouncements] = useState([]);
  const [games, setGames] = useState([]);
  
  // 賽季狀態
  const [currentSeason, setCurrentSeason] = useState('載入中...');
  const [availableSeasons, setAvailableSeasons] = useState([]);
  const [selectedSeason, setSelectedSeason] = useState(null);

  // 判斷是否為歷史模式
  const isHistoryMode = useMemo(() => {
    return selectedSeason && selectedSeason !== currentSeason;
  }, [selectedSeason, currentSeason]);

  // 1. 監聽系統設定 (這是全域設定，理論上所有登入使用者都該讀得到)
  useEffect(() => {
    const unsubSettings = onSnapshot(doc(db, "system", "config"), (doc) => {
        if (doc.exists()) {
            const data = doc.data();
            const curr = data.currentSeason || "第一賽季"; // 給予預設值
            
            // 更新當前賽季
            setCurrentSeason(curr);
            
            // 整理所有可用賽季
            // 邏輯：資料庫存的歷史列表 + 當前賽季
            const past = data.availableSeasons || [];
            const all = Array.from(new Set([...past, curr]));
            
            setAvailableSeasons(all);

            // 如果使用者還沒選過賽季，預設選當前賽季
            // 注意：這裡使用 functional update 避免依賴閉包中的舊 selectedSeason
            setSelectedSeason(prev => {
                // 如果之前沒選過，或是選的賽季不在列表內(罕見)，就切回當前
                if (!prev || !all.includes(prev)) return curr;
                return prev;
            });
        } else {
            // 如果 config 文件不存在 (系統剛建立)，預設為第一賽季
            setCurrentSeason("第一賽季");
            setAvailableSeasons(["第一賽季"]);
            setSelectedSeason("第一賽季");
        }
    }, (error) => {
        console.error("系統設定讀取失敗 (權限不足?):", error);
        // 如果讀取失敗 (例如權限問題)，至少讓使用者能看到預設值，避免 UI 壞掉
        setCurrentSeason("無法讀取");
    });

    return () => unsubSettings();
  }, []); // 移除 selectedSeason 依賴，只在掛載時監聽一次即可

  // 2. 主資料監聽
  useEffect(() => {
    // 即使沒有 currentUser 也允許讀取部分公開資料 (如公告/遊戲)
    if (!selectedSeason) return;

    let unsubTasks = () => {};
    let unsubSubs = () => {};
    let unsubAnc = () => {};
    let unsubUsers = () => {};

    // --- 載入遊戲 (不分賽季) ---
    const unsubGames = onSnapshot(collection(db, "games"), (s) => {
      setGames(s.docs.map(d => ({ ...d.data(), firestoreId: d.id })));
    });

    const fetchData = async () => {
      // A. 任務處理 (Frontend Filtering)
      const taskQ = query(collection(db, "tasks"), orderBy("id", "desc"));
      unsubTasks = onSnapshot(taskQ, (snapshot) => {
        const allTasks = snapshot.docs.map(doc => ({ ...doc.data(), firestoreId: doc.id }));
        // 顯示條件：該賽季的任務 OR 沒有賽季標籤的通用任務
        const filteredTasks = allTasks.filter(t => !t.season || t.season === selectedSeason);
        setTasks(filteredTasks);
      });

      // B. 公告處理 (Frontend Filtering)
      const ancQ = query(collection(db, "announcements"), orderBy("timestamp", "desc"), limit(50));
      unsubAnc = onSnapshot(ancQ, (snapshot) => {
          const allAnc = snapshot.docs.map(d => ({ ...d.data(), firestoreId: d.id }));
          // 顯示條件：該賽季的公告 OR 沒有賽季標籤的公告
          const filteredAnc = allAnc.filter(a => !a.season || a.season === selectedSeason);
          setAnnouncements(filteredAnc);
      });

      // C. 提交紀錄與使用者積分
      if (!isHistoryMode) {
        // === 當前賽季 (Live Mode) ===
        const limitCount = currentUser?.isAdmin ? 1000 : 100;
        
        const subQ = query(
            collection(db, "submissions"), 
            where("season", "==", selectedSeason),
            orderBy("timestamp", "desc"), 
            limit(limitCount)
        );
        
        unsubSubs = onSnapshot(subQ, (s) => {
            setSubmissions(s.docs.map(d => ({ ...d.data(), firestoreId: d.id })));
        }, (error) => {
            console.error("Submission fetch error:", error);
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
        // === 歷史賽季 (History Mode) ===
        const subQ = query(
            collection(db, "submissions"), 
            where("season", "==", selectedSeason),
            orderBy("timestamp", "desc")
        );
        
        unsubSubs = onSnapshot(subQ, (snapshot) => {
            const allSubs = snapshot.docs.map(d => ({ ...d.data(), firestoreId: d.id }));
            setSubmissions(allSubs);

            // 動態計算歷史積分
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
                        points: seasonPointsMap[uid] || 0, // 覆蓋為歷史積分
                        firestoreId: doc.id
                    };
                });
                setUsers(historyUsers);
            });
        });
        
        unsubUsers = () => {}; 
      }
    };

    fetchData();

    return () => { 
      unsubTasks(); 
      unsubSubs(); 
      unsubAnc(); 
      unsubUsers(); 
      unsubGames(); 
    };
  }, [currentUser?.username, selectedSeason, isHistoryMode]); 

  return { 
      tasks, submissions, users, announcements, games, 
      seasonName: currentSeason, 
      currentSeason, 
      selectedSeason, 
      setSelectedSeason, 
      availableSeasons,
      isHistoryMode 
  };
};