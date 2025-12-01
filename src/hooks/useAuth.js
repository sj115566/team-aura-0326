import { useState, useEffect } from 'react';
import { auth, db } from '../services/firebase';
import { onAuthStateChanged, signInWithEmailAndPassword, signOut } from 'firebase/auth';
import { collection, query, where, getDocs } from 'firebase/firestore';
import { useToast } from '../context/ToastContext';

const toEmail = (username) => {
  if (username.includes('@')) return username;
  return `${username}@teamaura.app`;
};

export const useAuth = () => {
  const [currentUser, setCurrentUser] = useState(JSON.parse(localStorage.getItem('pogo_current_user') || 'null'));
  const [loading, setLoading] = useState(false);
  const { showToast } = useToast();

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      if (user) {
        // 白名單檢查
        const q = query(collection(db, "users"), where("email", "==", user.email));
        const querySnapshot = await getDocs(q);
        
        if (!querySnapshot.empty) {
          const userData = querySnapshot.docs[0].data();
          const fullUser = { 
            ...userData, 
            uid: userData.username, 
            email: user.email, 
            firestoreId: querySnapshot.docs[0].id 
          }; 
          setCurrentUser(fullUser);
          localStorage.setItem('pogo_current_user', JSON.stringify(fullUser));
        } else {
          console.warn("User not found in whitelist, logging out...");
          await signOut(auth);
          setCurrentUser(null);
          localStorage.removeItem('pogo_current_user');
          showToast("您的帳號尚未建立資料，請聯繫管理員", "error");
        }
      } else {
        setCurrentUser(null);
        localStorage.removeItem('pogo_current_user');
      }
    });
    return () => unsubscribe();
  }, [showToast]);

  const login = async (username, password) => {
    if (!username || !password) return showToast("請輸入帳號密碼", "error");
    setLoading(true);
    try {
      // 這裡保留了您原本的邏輯，不更動密碼處理方式
      await signInWithEmailAndPassword(auth, toEmail(username), password);
      showToast("登入成功");
    } catch (e) {
      console.error(e);
      let msg = "登入失敗";
      if (e.code === 'auth/invalid-credential') msg = "帳號或密碼錯誤";
      if (e.code === 'auth/user-not-found') msg = "找不到此使用者";
      showToast(msg, "error");
    } finally {
      setLoading(false);
    }
  };

  const logout = async () => {
    await signOut(auth);
    setCurrentUser(null);
  };

  // 提供更新當前使用者資料的方法 (用於積分更新時同步 State)
  const updateCurrentUser = (newData) => {
    setCurrentUser(prev => {
        const updated = { ...prev, ...newData };
        localStorage.setItem('pogo_current_user', JSON.stringify(updated));
        return updated;
    });
  };

  return { currentUser, loading, login, logout, updateCurrentUser };
};