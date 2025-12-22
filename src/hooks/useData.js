import { useState, useEffect, useMemo } from 'react';
import { db } from '../services/firebase';
import { collection, query, orderBy, onSnapshot, doc, limit, where, getDocs } from 'firebase/firestore';

export const useData = (currentUser, updateCurrentUser) => {
    const [tasks, setTasks] = useState([]);
    const [submissions, setSubmissions] = useState([]);
    const [users, setUsers] = useState([]);
    const [announcements, setAnnouncements] = useState([]);
    const [games, setGames] = useState([]);
    const [roles, setRoles] = useState([]);
    const [categories, setCategories] = useState([]);
    const [mySubmissions, setMySubmissions] = useState([]); // 🔥 新增：當前使用者在該賽季的所有提交 (不限 100 筆)

    const [currentSeason, setCurrentSeason] = useState('載入中...');
    const [availableSeasons, setAvailableSeasons] = useState([]);
    const [selectedSeason, setSelectedSeason] = useState(null);
    const [seasonGoal, setSeasonGoal] = useState(1000);
    const [seasonGoalTitle, setSeasonGoalTitle] = useState("Season Goal");
    const [lotteryTarget, setLotteryTarget] = useState(0);

    // 移除 systemConfig 暫存，直接改用 seasons 集合讀取
    const [dataLoading, setDataLoading] = useState(true);

    const isHistoryMode = useMemo(() => {
        return selectedSeason && selectedSeason !== currentSeason && currentSeason !== '載入中...';
    }, [selectedSeason, currentSeason]);

    // 1. 監聽系統設定 (System Config)
    useEffect(() => {
        const unsubSettings = onSnapshot(doc(db, "system", "config"), (docSnap) => {
            if (docSnap.exists()) {
                const data = docSnap.data();
                const curr = data.currentSeason || "第一賽季";
                setCurrentSeason(curr);

                const past = data.availableSeasons || [];
                const all = Array.from(new Set([...past, curr]));
                setAvailableSeasons(all);

                // 如果還沒選賽季，預設選當前賽季
                setSelectedSeason(prev => {
                    if (!prev || !all.includes(prev)) return curr;
                    return prev;
                });
            } else {
                // Fallback default
                setCurrentSeason("第一賽季");
                setAvailableSeasons(["第一賽季"]);
                setSelectedSeason("第一賽季");
            }
        });
        return () => unsubSettings();
    }, [currentUser]);

    // 2. 🔥 新增：監聽選中的賽季文件 (讀取該賽季的目標設定)
    useEffect(() => {
        if (!selectedSeason) return;

        const unsubSeason = onSnapshot(doc(db, "seasons", selectedSeason), (docSnap) => {
            if (docSnap.exists()) {
                const data = docSnap.data();
                setSeasonGoal(data.seasonGoal || 10000);
                setSeasonGoalTitle(data.seasonGoalTitle || "Season Goal");
                setLotteryTarget(data.lotteryTarget || 0);
            } else {
                // 如果該賽季文件不存在，使用預設值
                setSeasonGoal(10000);
                setSeasonGoalTitle("Season Goal");
                setLotteryTarget(0);
            }
        });

        return () => unsubSeason();
    }, [selectedSeason]);

    // 3. 監聽主要資料 (根據 selectedSeason 篩選)
    useEffect(() => {
        if (!currentUser || !selectedSeason) return;

        setDataLoading(true);

        let unsubTasks = () => { };
        let unsubSubs = () => { };
        let unsubAnc = () => { };
        let unsubUsers = () => { };
        let unsubRoles = () => { };
        let unsubCats = () => { };
        let unsubGames = () => { };

        const loadedStatus = { tasks: false, users: false, announcements: false };
        const checkLoading = () => {
            if (loadedStatus.tasks && loadedStatus.users && loadedStatus.announcements) {
                setDataLoading(false);
            }
        };

        // 監聽 Games (無賽季過濾或簡單過濾)
        const gamesQ = query(collection(db, "games"));
        unsubGames = onSnapshot(gamesQ, (s) => {
            const allGames = s.docs.map(d => ({ ...d.data(), firestoreId: d.id }));
            // 前端過濾賽季
            setGames(allGames.filter(g => !g.season || g.season === selectedSeason));
        }, (error) => console.error("Games fetch error:", error));

        // 監聽 Roles
        unsubRoles = onSnapshot(collection(db, "roles"), (s) => {
            setRoles(s.docs.map(d => ({ ...d.data(), firestoreId: d.id })));
        }, (error) => console.error("Roles fetch error:", error));

        // 監聽 Categories
        const catsRef = collection(db, "categories");
        unsubCats = onSnapshot(catsRef, (s) => {
            const rawCats = s.docs.map(d => ({ ...d.data(), firestoreId: d.id }));
            rawCats.sort((a, b) => {
                const typeA = a.type || 'task';
                const typeB = b.type || 'task';
                if (typeA !== typeB) return typeA.localeCompare(typeB);
                const sysA = !!a.systemTag;
                const sysB = !!b.systemTag;
                if (sysA !== sysB) return sysB ? 1 : -1;
                return (a.label || '').localeCompare(b.label || '');
            });
            setCategories(rawCats);
        });

        // 監聽 Tasks (根目錄) -> 前端過濾賽季
        const taskQ = query(collection(db, "tasks"), orderBy("id", "desc"));
        unsubTasks = onSnapshot(taskQ, (snapshot) => {
            const allTasks = snapshot.docs.map(doc => ({ ...doc.data(), firestoreId: doc.id }));
            // 🔥 確保 tasks 包含 isBonusOnly 欄位
            const filteredTasks = allTasks.filter(t => !t.season || t.season === selectedSeason);
            setTasks(filteredTasks);
            loadedStatus.tasks = true;
            checkLoading();
        });

        // 監聽 Announcements (根目錄) -> 前端過濾賽季
        const ancQ = query(collection(db, "announcements"), orderBy("timestamp", "desc"), limit(50));
        unsubAnc = onSnapshot(ancQ, (snapshot) => {
            const allAnc = snapshot.docs.map(d => ({ ...d.data(), firestoreId: d.id }));
            const filteredAnc = allAnc.filter(a => !a.season || a.season === selectedSeason);
            filteredAnc.sort((a, b) => {
                if (a.isPinned === b.isPinned) return new Date(b.timestamp) - new Date(a.timestamp);
                return a.isPinned ? -1 : 1;
            });
            setAnnouncements(filteredAnc);
            loadedStatus.announcements = true;
            checkLoading();
        });

        if (!isHistoryMode) {
            // --- 一般模式 (Live) ---
            const limitCount = currentUser?.isAdmin ? 1000 : 100;
            // Submissions 必須過濾賽季 (全域顯示用的，有數量限制)
            const subQ = query(collection(db, "submissions"), where("season", "==", selectedSeason), orderBy("timestamp", "desc"), limit(limitCount));
            unsubSubs = onSnapshot(subQ, (s) => {
                setSubmissions(s.docs.map(d => ({ ...d.data(), firestoreId: d.id })));
            });

            // 🔥 新增：專門抓取「我」在該賽季的所有紀錄 (無數量限制，用於個人統計)
            if (currentUser) {
                const mySubQ = query(
                    collection(db, "submissions"),
                    where("season", "==", selectedSeason),
                    where("uid", "==", currentUser.username)
                );
                const unsubMySubs = onSnapshot(mySubQ, (s) => {
                    setMySubmissions(s.docs.map(d => ({ ...d.data(), firestoreId: d.id })));
                });
                const oldUnsub = unsubSubs;
                unsubSubs = () => { oldUnsub(); unsubMySubs(); };
            }

            unsubUsers = onSnapshot(query(collection(db, "users")), (snapshot) => {
                const usersData = snapshot.docs.map(doc => {
                    const data = doc.data();
                    return { ...data, uid: data.uid || data.username, points: Number(data.points) || 0, firestoreId: doc.id };
                });
                setUsers(usersData);

                if (currentUser) {
                    let freshMe = usersData.find(u => u.firestoreId === currentUser.firestoreId) ||
                        usersData.find(u => u.username === currentUser.username);
                    if (freshMe) {
                        const hasChanged = freshMe.points !== (currentUser.points || 0) ||
                            JSON.stringify(freshMe.roles) !== JSON.stringify(currentUser.roles);
                        if (hasChanged) updateCurrentUser(freshMe);
                    }
                }
                loadedStatus.users = true;
                checkLoading();
            });
        } else {
            // --- 歷史模式 (History) ---
            // 1. 抓取該賽季所有提交
            const subQ = query(collection(db, "submissions"), where("season", "==", selectedSeason), orderBy("timestamp", "desc"));

            unsubSubs = onSnapshot(subQ, async (snapshot) => {
                const allSubs = snapshot.docs.map(d => ({ ...d.data(), firestoreId: d.id }));
                setSubmissions(allSubs);

                // 歷史模式下，我的紀錄就是 filtered 後的結果
                if (currentUser) {
                    setMySubmissions(allSubs.filter(s => s.uid === currentUser.username || s.userDocId === currentUser.firestoreId));
                }

                // 2. 計算該賽季的積分 (基礎分累加)
                const seasonBasePointsMap = {};
                allSubs.forEach(sub => {
                    if (sub.status === 'approved') {
                        const pts = (sub.basePoints !== undefined ? Number(sub.basePoints) : Number(sub.points)) || 0;
                        const key = sub.userDocId || sub.uid;
                        seasonBasePointsMap[key] = (seasonBasePointsMap[key] || 0) + pts;
                    }
                });

                // 3. 抓取使用者列表並計算加成
                try {
                    // 為了計算倍率，我們需要 roles
                    const rolesSnap = await getDocs(collection(db, "roles"));
                    const allRoles = rolesSnap.docs.map(d => ({ ...d.data(), firestoreId: d.id }));

                    const userSnap = await getDocs(collection(db, "users"));
                    const historyUsers = userSnap.docs.map(doc => {
                        const data = doc.data();
                        const basePoints = seasonBasePointsMap[doc.id] !== undefined ? seasonBasePointsMap[doc.id] : (seasonBasePointsMap[data.username] || 0);

                        // 計算概估倍率 (目前的身分組倍率)
                        const userRoles = data.roles || [];
                        const activeRoles = allRoles.filter(r => userRoles.includes(r.code));
                        let totalExtra = 0;
                        activeRoles.forEach(r => { totalExtra += (Number(r.multiplier) || 1) - 1; });
                        const multiplier = Math.max(1, 1 + totalExtra);

                        const finalPoints = Math.round(basePoints * multiplier);

                        return {
                            ...data,
                            uid: data.uid || data.username,
                            points: finalPoints,
                            firestoreId: doc.id
                        };
                    });
                    setUsers(historyUsers);

                    // 更新當前使用者的歷史快照
                    if (currentUser) {
                        const myHistory = historyUsers.find(u => u.firestoreId === currentUser.firestoreId) ||
                            historyUsers.find(u => u.username === currentUser.username);
                        if (myHistory) updateCurrentUser(myHistory);
                    }
                } catch (e) {
                    console.error("Error fetching history users:", e);
                }

                loadedStatus.users = true;
                checkLoading();
            });
        }

        const safeTimer = setTimeout(() => setDataLoading(false), 3000);

        return () => {
            clearTimeout(safeTimer);
            unsubTasks(); unsubSubs(); unsubAnc(); unsubUsers(); unsubGames(); unsubRoles(); unsubCats(); unsubGames();
        };
    }, [currentUser?.username, selectedSeason, isHistoryMode]);

    return {
        tasks, submissions, users, announcements, games, roles, categories, mySubmissions,
        seasonName: currentSeason, currentSeason, selectedSeason, setSelectedSeason, availableSeasons, isHistoryMode, seasonGoal, seasonGoalTitle,
        dataLoading,
        lotteryTarget
    };
};