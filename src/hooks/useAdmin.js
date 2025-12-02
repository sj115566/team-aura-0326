import { useState } from 'react';
import { db, storage } from '../services/firebase';
import {
 collection, addDoc, updateDoc, deleteDoc, doc,
 serverTimestamp, setDoc, writeBatch, getDocs, query, where, getDoc, arrayUnion
} from 'firebase/firestore';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { useToast } from '../context/ToastContext';
import { compressImage } from '../utils/compressor';


const uploadImages = async (fileList) => {
 const urls = [];
 for (const file of fileList) {
   try {
     const fileToUpload = await compressImage(file);
     const storageRef = ref(storage, `uploads/${Date.now()}_${fileToUpload.name}`);
     await uploadBytes(storageRef, fileToUpload);
     const url = await getDownloadURL(storageRef);
     urls.push(url);
   } catch (error) {
     console.error("Upload failed:", error);
   }
 }
 return urls;
};


export const useAdmin = (currentUser, seasonName, users, roles = []) => {
 const { showToast } = useToast();
 const [adminLoading, setAdminLoading] = useState(false);


 const execute = async (fn, successMsg) => {
   setAdminLoading(true);
   try {
     const result = await fn();
     if (successMsg) showToast(successMsg);
     return result !== false;
   } catch (e) {
     console.error(e);
     showToast(e.message || "操作失敗", "error");
     return false;
   } finally {
     setAdminLoading(false);
   }
 };


 const clearCollection = async (collectionName) => {
   const q = query(collection(db, collectionName));
   const snapshot = await getDocs(q);
   const batch = writeBatch(db);
   let count = 0;
  
   snapshot.docs.forEach((doc) => {
     batch.delete(doc.ref);
     count++;
   });
  
   if (count > 0) {
     await batch.commit();
     console.log(`Cleared ${count} docs from ${collectionName}`);
   }
 };


 const getValidSeason = () => {
     if (!seasonName || seasonName === '載入中...' || seasonName === '未設定賽季') {
         throw new Error("系統尚未載入賽季資訊，請稍後再試");
     }
     return seasonName;
 };


 // 內部函式：計算加成倍率 (百分比相加邏輯)
 // Multiplier = 1 + (Rate1 - 1) + (Rate2 - 1) + ...
 // 例如：1.2 (+20%) 和 1.3 (+30%) -> 1 + 0.2 + 0.3 = 1.5 (+50%)
 const calculateMultiplier = (userRoleCodes, allRoles = roles) => {
     const safeRoles = allRoles || [];
     const userRoles = userRoleCodes || [];
     const activeRoles = safeRoles.filter(r => userRoles.includes(r.code));
    
     let totalExtra = 0;
    
     activeRoles.forEach(r => {
         const rate = Number(r.multiplier) || 1;
         totalExtra += (rate - 1);
     });


     // 基礎倍率 1 + 額外加成
     return Math.max(0, 1 + totalExtra);
 };


 // 內部函式：重新計算特定使用者的所有歷史分數
 const recalculateUserPoints = async (userId, userDocId, currentSeason, currentRoles = roles) => {
     // 1. 找出該使用者本賽季所有 approved 的提交
     const q = query(
         collection(db, "submissions"),
         where("uid", "==", userId),
         where("season", "==", currentSeason),
         where("status", "==", "approved")
     );
     const snapshot = await getDocs(q);
    
     // 2. 取得使用者最新的 roles
     const userDocSnap = await getDoc(doc(db, "users", userDocId));
     if (!userDocSnap.exists()) return;
    
     const userData = userDocSnap.data();
     // 使用傳入的 currentRoles (可能是最新的 roles 列表)
     const multiplier = calculateMultiplier(userData.roles, currentRoles);


     let newTotalPoints = 0;
     const batch = writeBatch(db);
     let batchCount = 0;


     // 3. 獲取所有 Tasks 以查找原始分 (因為 submission 可能沒存 basePoints)
     const tasksSnapshot = await getDocs(collection(db, "tasks"));
     const taskMap = {};
     tasksSnapshot.forEach(t => {
         const d = t.data();
         taskMap[d.id] = d;
     });


     for (const subDoc of snapshot.docs) {
         const subData = subDoc.data();
         let basePoints = 0;


         // 嘗試找出原始分
         if (subData.basePoints !== undefined) {
             basePoints = subData.basePoints;
         } else if (taskMap[subData.taskId] && taskMap[subData.taskId].type === 'fixed') {
             basePoints = Number(taskMap[subData.taskId].points) || 0;
         } else {
             // 如果無法得知原始分，只能假設目前分數就是原始分 (這不完美但能防止歸零)
             // 或者我們反推： assumedBase = subData.points / oldMultiplier?
             // 為了安全，若無 basePoints 則維持原樣
              newTotalPoints += (Number(subData.points) || 0);
              continue;
         }


         // 重新計算
         const newPoints = Math.round(basePoints * multiplier);
        
         if (newPoints !== subData.points) {
             batch.update(subDoc.ref, { points: newPoints });
             batchCount++;
         }
        
         newTotalPoints += newPoints;
     }
    
     // 更新使用者總分
     batch.update(doc(db, "users", userDocId), { points: newTotalPoints });
     batchCount++;


     if (batchCount > 0) {
         await batch.commit();
         console.log(`Recalculated points for ${userId}: ${newTotalPoints} (Multiplier: ${multiplier})`);
     }
 };


 const actions = {
   addTask: (taskData) => execute(async () => {
     const currentSeason = getValidSeason();
     await addDoc(collection(db, "tasks"), {
         ...taskData,
         id: `t_${Date.now()}`,
         season: currentSeason,
         createdAt: serverTimestamp()
     });
   }, "任務新增成功"),


   deleteTask: (firestoreId) => execute(async () => {
     if (!firestoreId || typeof firestoreId !== 'string') throw new Error("無效的任務 ID");
     await deleteDoc(doc(db, "tasks", firestoreId));
   }, "已刪除"),


   submitTask: (data) => execute(async () => {
     const currentSeason = getValidSeason();
     let imageUrls = [];
     if (data.rawFiles?.length > 0) imageUrls = await uploadImages(data.rawFiles);
    
     const basePoints = data.task.type === 'fixed' ? (Number(data.task.points) || 0) : 0;


     await addDoc(collection(db, "submissions"), {
       id: `s_${Date.now()}`, uid: currentUser.uid, username: currentUser.username,
       taskId: data.task.id, taskTitle: data.task.title, points: 0,
       basePoints: basePoints,
       status: 'pending', proof: data.proof || '無備註', timestamp: new Date().toISOString(),
       images: JSON.stringify(imageUrls), week: data.task.week, season: currentSeason
     });
   }, "提交成功"),


   withdraw: (firestoreId) => execute(async () => {
     if (!firestoreId || typeof firestoreId !== 'string') throw new Error("無效的提交 ID");
     await deleteDoc(doc(db, "submissions", firestoreId));
   }, "已撤回"),


   review: (sub, action, points, statusOverride) => execute(async () => {
       if (!sub || !sub.firestoreId) throw new Error("無效的提交紀錄");


       const newStatus = statusOverride || (action === 'approve' ? 'approved' : 'rejected');
       let basePoints = Number(points) || 0;
      
       const user = users.find(u => u.uid === sub.uid);
       if (!user || !user.firestoreId) return;


       let multiplier = 1;
       if (newStatus === 'approved') {
           multiplier = calculateMultiplier(user.roles);
       }


       const finalPoints = Math.round(basePoints * multiplier);
       const oldStatus = sub.status;
       const oldPoints = Number(sub.points) || 0;


       const subRef = doc(db, "submissions", sub.firestoreId);
      
       await updateDoc(subRef, {
           status: newStatus,
           points: finalPoints,
           basePoints: basePoints
       });
      
       let pointDiff = 0;
       if (oldStatus === 'approved' && newStatus !== 'approved') pointDiff = -oldPoints;
       else if (oldStatus !== 'approved' && newStatus === 'approved') pointDiff = finalPoints;
       else if (oldStatus === 'approved' && newStatus === 'approved') pointDiff = finalPoints - oldPoints;


       if (pointDiff !== 0) {
           const currentTotal = Number(user.points) || 0;
           await updateDoc(doc(db, "users", user.firestoreId), { points: currentTotal + pointDiff });
       }
   }, "操作成功"),


   addAnnouncement: (title, content, rawFiles = []) => execute(async () => {
       const currentSeason = getValidSeason();
       let imageUrls = [];
       if (rawFiles.length > 0) imageUrls = await uploadImages(rawFiles);
       await addDoc(collection(db, "announcements"), {
           id: `a_${Date.now()}`, title, content, author: currentUser.username,
           timestamp: new Date().toISOString(), images: JSON.stringify(imageUrls), season: currentSeason
       });
   }, "公告已發佈"),


   updateAnnouncement: (item, title, content, rawFiles = []) => execute(async () => {
       if (!item?.firestoreId) throw new Error("無效的公告 ID");
       let imageUrls = [];
       let existingImages = [];
       try { existingImages = JSON.parse(item.images || '[]'); } catch(e){}
       if (rawFiles?.length > 0) imageUrls = await uploadImages(rawFiles);
       const finalImages = [...existingImages, ...imageUrls];
       await updateDoc(doc(db, "announcements", item.firestoreId), { title, content, images: JSON.stringify(finalImages) });
   }, "公告已更新"),


   deleteAnnouncement: (firestoreId) => execute(async () => {
       if (!firestoreId) throw new Error("無效的公告 ID");
       await deleteDoc(doc(db, "announcements", firestoreId));
   }),


   addGame: (data) => execute(async () => {
       await addDoc(collection(db, "games"), { ...data, id: `g_${Date.now()}` });
   }, "遊戲已新增"),


   updateGame: (item, data) => execute(async () => {
       if (!item?.firestoreId) throw new Error("無效的遊戲 ID");
       await updateDoc(doc(db, "games", item.firestoreId), data);
   }, "遊戲已更新"),


   deleteGame: (firestoreId) => execute(async () => {
       if (!firestoreId) throw new Error("無效的遊戲 ID");
       await deleteDoc(doc(db, "games", firestoreId));
   }),


   // --- 身分組管理 ---
   addRole: (data) => execute(async () => {
       if (!data.code || !data.label) throw new Error("代號與暱稱必填");
       const safeRoles = roles || [];
       const exists = safeRoles.some(r => r.code === data.code);
       if (exists) throw new Error("代號已存在");


       await addDoc(collection(db, "roles"), {
           ...data,
           multiplier: Number(data.multiplier) || 1
       });
   }, "身分組已新增"),


   // 更新身分組並觸發所有相關使用者重算
   updateRole: (id, data) => execute(async () => {
       if (!id) throw new Error("無效的 ID");
      
       // 1. 更新身分組
       await updateDoc(doc(db, "roles", id), {
           ...data,
           multiplier: Number(data.multiplier) || 1
       });


       // 2. 找出所有擁有此身分的使用者並重算分數
       const updatedRoleCode = data.code; // 假設 code 沒變，或者我們需要知道舊的 code
       // 實際上 updateRole 不會改 code，所以用 data.code 即可 (但要注意如果 data 沒傳 code)
       // 為了安全，我們最好先從 roles state 找到這個 role 的 code
       const targetRole = roles.find(r => r.firestoreId === id);
       const codeToFind = targetRole ? targetRole.code : data.code;


       if (codeToFind) {
            const currentSeason = getValidSeason();
            // 這裡使用新的 roles 列表進行計算 (模擬更新後的狀態)
            const updatedRoles = roles.map(r => r.firestoreId === id ? { ...r, ...data, multiplier: Number(data.multiplier) || 1 } : r);


            // 找出受影響的使用者
            const affectedUsers = users.filter(u => (u.roles || []).includes(codeToFind));
           
            // 批次重算 (這可能會花一點時間)
            for (const user of affectedUsers) {
                await recalculateUserPoints(user.uid, user.firestoreId, currentSeason, updatedRoles);
            }
            if (affectedUsers.length > 0) {
                showToast(`已重新計算 ${affectedUsers.length} 位使用者的分數`);
            }
       }


   }, "身分組已更新"),


   deleteRole: (id) => execute(async () => {
       if (!id) throw new Error("無效的 ID");
       await deleteDoc(doc(db, "roles", id));
   }, "身分組已刪除"),


   updateUserRoles: (userId, newRoles) => execute(async () => {
       const user = users.find(u => u.uid === userId);
       if (!user) throw new Error("找不到使用者");
      
       // 1. 更新身分
       await updateDoc(doc(db, "users", user.firestoreId), { roles: newRoles });
      
       // 2. 觸發重算分數 (針對當前賽季)
       const currentSeason = getValidSeason();
       await recalculateUserPoints(userId, user.firestoreId, currentSeason);
      
   }, "使用者身分已更新並重新計算分數"),


   updateSeasonGoal: (newGoal, newTitle) => execute(async () => {
       await setDoc(doc(db, "system", "config"), {
           seasonGoal: Number(newGoal),
           seasonGoalTitle: newTitle
       }, { merge: true });
   }, "目標設定已更新"),


   archive: (newSeasonName) => execute(async () => {
       await setDoc(doc(db, "system", "config"), {
           currentSeason: newSeasonName,
           availableSeasons: arrayUnion(seasonName)
       }, { merge: true });


       const usersSnapshot = await getDocs(collection(db, "users"));
       const batches = [];
       let batch = writeBatch(db);
       let count = 0;
       usersSnapshot.forEach((userDoc) => {
           batch.update(userDoc.ref, { points: 0 });
           count++;
           if (count >= 400) { batches.push(batch.commit()); batch = writeBatch(db); count = 0; }
       });
       if (count > 0) batches.push(batch.commit());
       await Promise.all(batches);
   }, "賽季重置成功！"),


   hardResetSystem: () => execute(async () => {
       console.log("⚠️ 開始強制重置系統 (Hard Reset)...");
       await clearCollection("submissions");
       await clearCollection("tasks");
       await clearCollection("announcements");
       await clearCollection("games");
       await clearCollection("roles");


       const usersSnapshot = await getDocs(collection(db, "users"));
       const batch = writeBatch(db);
       usersSnapshot.forEach((userDoc) => {
           batch.update(userDoc.ref, { points: 0, roles: [] });
       });
       await batch.commit();


       const sysRef = doc(db, "system", "config");
       await setDoc(sysRef, { currentSeason: "第一賽季", availableSeasons: [], seasonGoal: 10000, seasonGoalTitle: "Season Goal" }, { merge: true });


       const ancRef = collection(db, "announcements");
       await addDoc(ancRef, {
           id: `a_${Date.now()}`, title: "歡迎來到新系統", content: "<p>這是系統自動建立的第一則公告。</p>",
           author: "System", timestamp: new Date().toISOString(), images: "[]", season: "第一賽季"
       });


       const taskRef = collection(db, "tasks");
       await addDoc(taskRef, {
           id: `t_${Date.now()}`, title: "每日簽到", points: 10, icon: "📅", description: "每天登入並簽到",
           week: "1", type: "fixed", createdAt: serverTimestamp(), season: "第一賽季"
       });


       const usersRef = collection(db, "users");
       const userQ = query(usersRef, where("email", "==", "admin@teamaura.app"));
       const userSnap = await getDocs(userQ);
       if (userSnap.empty) {
           await addDoc(usersRef, { username: "admin", email: "admin@teamaura.app", points: 0, isAdmin: true, joinedAt: new Date().toISOString() });
       }
   }, "系統已強制重置！"),


   initializeSystem: () => execute(async () => {
       const taskSnap = await getDocs(collection(db, "tasks"));
       if (!taskSnap.empty) throw new Error("系統已有資料，初始化取消。");


       const gameSnap = await getDocs(collection(db, "games"));
       if (gameSnap.empty) {
           const defaultGames = [{ id: 'g_1', title: '2048', url: 'https://hczhcz.github.io/2048/', icon: '🔢' }, { id: 'g_2', title: 'Hextris', url: 'https://hextris.github.io/hextris/', icon: '⬡' }, { id: 'g_3', title: 'Tetris', url: 'https://chvin.github.io/react-tetris/', icon: '🧱' }];
           for(const g of defaultGames) await addDoc(collection(db, "games"), g);
       }


       const roleSnap = await getDocs(collection(db, "roles"));
       if (roleSnap.empty) {
           await addDoc(collection(db, "roles"), { code: "vip", label: "VIP", multiplier: 1.1, color: "#eab308" });
       }


       await setDoc(doc(db, "system", "config"), { currentSeason: "第一賽季", availableSeasons: [], seasonGoal: 10000, seasonGoalTitle: "Season Goal" }, { merge: true });


       const ancRef = collection(db, "announcements");
       if ((await getDocs(ancRef)).empty) {
           await addDoc(ancRef, {
               id: `a_${Date.now()}`, title: "歡迎來到新系統", content: "<p>這是系統自動建立的第一則公告。</p>",
               author: "System", timestamp: new Date().toISOString(), images: "[]", season: "第一賽季"
           });
       }


       const taskRef = collection(db, "tasks");
       if ((await getDocs(taskRef)).empty) {
           await addDoc(taskRef, {
               id: `t_${Date.now()}`, title: "每日簽到", points: 10, icon: "📅", description: "每天登入並簽到",
               week: "1", type: "fixed", createdAt: serverTimestamp(), season: "第一賽季"
           });
       }


       const usersRef = collection(db, "users");
       const userQ = query(usersRef, where("email", "==", "admin@teamaura.app"));
       if ((await getDocs(userQ)).empty) {
           await addDoc(usersRef, { username: "admin", email: "admin@teamaura.app", points: 0, isAdmin: true, joinedAt: new Date().toISOString() });
       }
   }, "系統初始化完成！")
 };


 return { actions, adminLoading };
};



