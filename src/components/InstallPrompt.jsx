import React, { useState, useEffect } from 'react';
import { Button } from './ui/Button';
import { Modal } from './ui/Modal';
import { Icon } from './Icons';

export const InstallPrompt = () => {
  const [deferredPrompt, setDeferredPrompt] = useState(null);
  const [isIOS, setIsIOS] = useState(false);
  const [isStandalone, setIsStandalone] = useState(false);
  const [showIOSInstructions, setShowIOSInstructions] = useState(false);

  useEffect(() => {
    // 1. 檢查是否已經安裝 (Standalone Mode)
    const checkStandalone = () => {
      const isStandalone = window.matchMedia('(display-mode: standalone)').matches || 
                           window.navigator.standalone === true;
      setIsStandalone(isStandalone);
    };
    checkStandalone();

    // 2. 偵測是否為 iOS
    const userAgent = window.navigator.userAgent.toLowerCase();
    const isIosDevice = /iphone|ipad|ipod/.test(userAgent);
    setIsIOS(isIosDevice);

    // 3. 攔截 Android/Desktop 的安裝事件
    const handleBeforeInstallPrompt = (e) => {
      e.preventDefault(); // 阻止瀏覽器預設的醜醜提示
      setDeferredPrompt(e); // 把事件存起來，等使用者按按鈕再觸發
    };

    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);

    return () => {
      window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
    };
  }, []);

  // 如果已經安裝了，就不顯示任何東西
  if (isStandalone) return null;

  // Android/Desktop 安裝處理
  const handleInstallClick = async () => {
    if (!deferredPrompt) return;
    deferredPrompt.prompt();
    const { outcome } = await deferredPrompt.userChoice;
    if (outcome === 'accepted') {
      setDeferredPrompt(null);
    }
  };

  // 如果是 Android/Desktop 且有抓到安裝事件
  if (deferredPrompt) {
    return (
      <div className="mt-4">
        <Button 
          variant="primary" 
          onClick={handleInstallClick}
          className="w-full bg-slate-800 hover:bg-slate-700 shadow-none text-sm py-3"
          icon="Download"
        >
          安裝應用程式 (App)
        </Button>
        <p className="text-[10px] text-gray-400 mt-2 text-center">
          安裝後可獲得全螢幕最佳體驗
        </p>
      </div>
    );
  }

  // 如果是 iOS (顯示教學按鈕)
  if (isIOS) {
    return (
      <div className="mt-4">
        <Button 
          variant="secondary" 
          onClick={() => setShowIOSInstructions(true)}
          className="w-full text-sm py-3 border-slate-200 text-slate-500"
          icon="Share"
        >
          如何安裝到 iPhone？
        </Button>

        <Modal 
          isOpen={showIOSInstructions} 
          onClose={() => setShowIOSInstructions(false)} 
          title="安裝教學"
        >
          <div className="space-y-4 text-sm text-slate-600">
            <p>由於 iOS 限制，請依照以下步驟手動安裝：</p>
            <div className="flex items-start gap-3">
              <div className="bg-slate-100 p-2 rounded-lg">
                <Icon name="Share" className="w-6 h-6 text-blue-500" />
              </div>
              <div>
                <span className="font-bold text-slate-800 block">1. 點擊「分享」</span>
                <span className="text-xs">通常位於瀏覽器下方中間。</span>
              </div>
            </div>
            <div className="flex items-start gap-3">
              <div className="bg-slate-100 p-2 rounded-lg">
                <Icon name="Plus" className="w-6 h-6 text-slate-500" />
              </div>
              <div>
                <span className="font-bold text-slate-800 block">2. 選擇「加入主畫面」</span>
                <span className="text-xs">向下滑動選單找到此選項。</span>
              </div>
            </div>
            <div className="flex items-start gap-3">
              <div className="bg-slate-100 p-2 rounded-lg">
                <span className="font-bold text-blue-500">新增</span>
              </div>
              <div>
                <span className="font-bold text-slate-800 block">3. 點擊右上角「新增」</span>
                <span className="text-xs">完成後 App 圖示就會出現在桌面！</span>
              </div>
            </div>
          </div>
          <Button className="w-full mt-6" onClick={() => setShowIOSInstructions(false)}>
            我知道了
          </Button>
        </Modal>
      </div>
    );
  }

  return null;
};