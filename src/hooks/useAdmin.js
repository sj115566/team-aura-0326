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

export const useAdmin = (currentUser, seasonName, users) => {
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

  // 輔助檢查：確保有有效的賽季名稱
  const getValidSeason = () => {
      if (!seasonName || seasonName === '載入中...' || seasonName === '未設定賽季') {
          // 如果沒有抓到賽季，嘗試直接讀取 config (或是拋出錯誤)
          // 這裡為了 UX，先拋出錯誤提醒使用者稍後再試
          throw new Error("系統尚未載入賽季資訊，請稍後再試");
      }
      return seasonName;
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
      await addDoc(collection(db, "submissions"), {
        id: `s_${Date.now()}`, uid: currentUser.uid, username: currentUser.username,
        taskId: data.task.id, taskTitle: data.task.title, points: data.task.points,
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
        const newPoints = Number(points) || 0;
        const oldStatus = sub.status;
        const oldPoints = Number(sub.points) || 0;

        const subRef = doc(db, "submissions", sub.firestoreId);
        await updateDoc(subRef, { status: newStatus, points: newPoints });
        
        const user = users.find(u => u.uid === sub.uid);
        if (!user || !user.firestoreId) return;

        let pointDiff = 0;
        if (oldStatus === 'approved' && newStatus !== 'approved') pointDiff = -oldPoints;
        else if (oldStatus !== 'approved' && newStatus === 'approved') pointDiff = newPoints;
        else if (oldStatus === 'approved' && newStatus === 'approved') pointDiff = newPoints - oldPoints;

        if (pointDiff !== 0) {
            const currentTotal = Number(user.points) || 0;
            await updateDoc(doc(db, "users", user.firestoreId), { points: currentTotal + pointDiff });
        }
    }, "操作成功"),

    addAnnouncement: (title, content, rawFiles = []) => execute(async () => {
        const currentSeason = getValidSeason(); // 確保賽季有效
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

    // 強制重置 (Hard Reset)
    hardResetSystem: () => execute(async () => {
        console.log("⚠️ 開始強制重置系統 (Hard Reset)...");
        
        await clearCollection("submissions");
        await clearCollection("tasks");
        await clearCollection("announcements");
        await clearCollection("games");

        const usersSnapshot = await getDocs(collection(db, "users"));
        const batch = writeBatch(db);
        usersSnapshot.forEach((userDoc) => {
            batch.update(userDoc.ref, { points: 0 });
        });
        await batch.commit();

        const defaultGames = [{ id: 'g_1', title: '2048', url: 'https://hczhcz.github.io/2048/', icon: '🔢' }, { id: 'g_2', title: 'Hextris', url: 'https://hextris.github.io/hextris/', icon: '⬡' }, { id: 'g_3', title: 'Tetris', url: 'https://chvin.github.io/react-tetris/', icon: '🧱' }];
        for(const g of defaultGames) {
            await addDoc(collection(db, "games"), g);
        }

        const sysRef = doc(db, "system", "config");
        await setDoc(sysRef, { currentSeason: "第一賽季", availableSeasons: [] }, { merge: true });

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

        console.log("全系統強制重置完成。");
    }, "系統已強制重置！所有資料已清除並重建。"),

    // 安全初始化
    initializeSystem: () => execute(async () => {
        const taskSnap = await getDocs(collection(db, "tasks"));
        if (!taskSnap.empty) {
            throw new Error("系統已有資料，初始化取消。若需重置請使用「強制重置」。");
        }

        console.log("偵測到系統空白，開始初始化...");

        const gameSnap = await getDocs(collection(db, "games"));
        if (gameSnap.empty) {
            const defaultGames = [{ id: 'g_1', title: '2048', url: 'https://hczhcz.github.io/2048/', icon: '🔢' }, { id: 'g_2', title: 'Hextris', url: 'https://hextris.github.io/hextris/', icon: '⬡' }, { id: 'g_3', title: 'Tetris', url: 'https://chvin.github.io/react-tetris/', icon: '🧱' }];
            for(const g of defaultGames) await addDoc(collection(db, "games"), g);
        }

        await setDoc(doc(db, "system", "config"), { currentSeason: "第一賽季", availableSeasons: [] }, { merge: true });

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