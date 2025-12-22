import React, { useState, useMemo, useEffect, useRef } from 'react';
import { Button } from '../components/ui/Button';
import { Card } from '../components/ui/Card';
import { Icon } from '../components/Icons';
import { useGlobalData } from '../context/DataContext';
import { useModals } from '../context/ModalContext';
import { getCategoryInfo } from '../utils/categoryHelper';
import { Modal } from '../components/ui/Modal';
import { ListSkeleton } from '../components/ui/Skeleton';

export const AnnouncementView = () => {
  const { announcements, isAdmin, currentSeason, isHistoryMode, categories, actions, dataLoading } = useGlobalData();
  const { openAnnounceModal, confirm } = useModals();

  const [viewingImg, setViewingImg] = useState(null);
  const [expandedIds, setExpandedIds] = useState({});
  const [filterCategory, setFilterCategory] = useState('all');
  const hasInitialized = useRef(false);

  useEffect(() => {
    if (announcements && announcements.length > 0 && !hasInitialized.current) {
      const newExpanded = {};
      let firstUnpinnedFound = false;
      announcements.forEach(anc => {
        if (anc.isPinned) newExpanded[anc.id] = true;
        else if (!firstUnpinnedFound) { newExpanded[anc.id] = true; firstUnpinnedFound = true; }
      });
      setExpandedIds(newExpanded);
      hasInitialized.current = true;
    }
  }, [announcements]);

  const toggleExpand = (id) => setExpandedIds(prev => ({ ...prev, [id]: !prev[id] }));

  const handleDelete = (id) => {
    confirm({
      title: "刪除公告",
      message: "確定要刪除此公告嗎？",
      onConfirm: () => actions.deleteAnnouncement(id)
    });
  };

  const filteredAnnouncements = useMemo(() => {
    if (!announcements) return [];
    if (filterCategory === 'all') return announcements;
    return announcements.filter(anc => {
      if (anc.categoryId === filterCategory) return true;
      const catInfo = getCategoryInfo(anc, categories);
      return !anc.categoryId && catInfo.label === categories.find(c => c.firestoreId === filterCategory)?.label;
    });
  }, [announcements, filterCategory, categories]);

  const filterOptions = useMemo(() => categories ? categories.filter(c => c.type === 'announcement') : [], [categories]);

  if (dataLoading) return <ListSkeleton />;

  return (
    <div className="space-y-4 animate-fadeIn">
      <div className="flex items-center justify-between">
        {/* 修改 1: 使用 page-title，並調整 mb-0 與字體大小以符合原本佈局 */}
        <h2 className="font-bold page-title mb-0 text-lg">戰隊公告</h2>
        {isAdmin && !isHistoryMode && <Button variant="primary" className="text-xs px-3 py-1.5" onClick={() => openAnnounceModal(null)} icon="Edit2">發佈貼文</Button>}
      </div>

      {/* 修改 2: 邊框顏色使用變數，確保深色模式可見度 */}
      <div className="flex flex-wrap gap-2 items-center pb-2 border-b border-gray-200 dark:border-slate-700">
        <button
          onClick={() => setFilterCategory('all')}
          // 修改 3: 調整未選中狀態的文字顏色為 slate-700/slate-300 以符合 AAA 對比度
          className={`px-3 py-1.5 rounded-full text-xs font-bold transition-all border ${filterCategory === 'all'
              ? 'bg-slate-700 text-white border-slate-700 dark:bg-slate-600 dark:border-slate-500'
              : 'bg-white text-slate-700 border-slate-200 hover:border-slate-300 dark:bg-slate-800 dark:text-slate-300 dark:border-slate-700'
            }`}
        >
          全部
        </button>

        {filterOptions.map(cat => (
          <button
            key={cat.firestoreId}
            onClick={() => setFilterCategory(cat.firestoreId)}
            className={`px-3 py-1.5 rounded-full text-xs font-bold transition-all border flex items-center gap-1 ${filterCategory === cat.firestoreId
                ? 'ring-2 ring-offset-1 ring-slate-200 dark:ring-slate-700'
                : 'hover:opacity-80'
              }`}
            style={{ backgroundColor: cat.color, color: '#ffffff', borderColor: cat.color }}
          >
            {filterCategory === cat.firestoreId && <Icon name="Check" className="w-3 h-3" />}
            {cat.label}
          </button>
        ))}
      </div>

      <div className="space-y-4">
        {filteredAnnouncements.length > 0 ? filteredAnnouncements.map(anc => {
          const attachmentImages = JSON.parse(anc.images || '[]');

          const inlineImages = [];
          const imgRegex = /<img[^>]+src="([^">]+)"/g;
          let match;
          while ((match = imgRegex.exec(anc.content)) !== null) {
            if (match[1]) inlineImages.push(match[1]);
          }
          const allPreviewImages = [...inlineImages, ...attachmentImages];

          const isExpanded = !!expandedIds[anc.id];
          const isHistorical = anc.season && anc.season !== currentSeason;
          const catInfo = getCategoryInfo(anc, categories);

          const plainText = anc.content.replace(/<[^>]+>/g, '').trim();

          return (
            <Card key={anc.id} className={`overflow-visible transition-all duration-200 relative 
                ${isExpanded ? 'ring-2 ring-indigo-50 shadow-md dark:ring-slate-700' : 'hover:shadow-md cursor-pointer'} 
                ${isHistorical
                ? 'bg-slate-100 border-slate-200 dark:bg-slate-900/50 dark:border-slate-700' // 歷史模式保持原樣，但顏色加深對比
                : 'card border-0' // 修改 4: 一般模式直接使用 .card 類別 (會自動套用 CSS 變數)
              }`}
            >
              <div onClick={() => toggleExpand(anc.id)}>
                <div className="absolute top-0 right-0 flex">
                  {anc.isPinned && !isHistorical && (<div className="bg-indigo-600 text-white text-[10px] font-bold px-2 py-1 rounded-bl-lg z-20 flex items-center gap-1 shadow-sm"><Icon name="Map" className="w-3 h-3 text-white" /> 置頂</div>)}
                  {isHistorical && (<div className="bg-slate-600 text-white text-[10px] font-bold px-2 py-1 rounded-bl-lg rounded-tr-lg z-20 opacity-80">歷史公告：{anc.season}</div>)}
                </div>
                <div className="flex justify-between items-start mb-2 pt-1">
                  <div className="flex items-center gap-2">
                    <div className={`w-8 h-8 rounded-full ${isHistorical ? 'bg-slate-300 text-slate-600' : 'bg-indigo-100 text-indigo-700 dark:bg-indigo-900/50 dark:text-indigo-300'} flex items-center justify-center font-bold text-sm`}>{(anc.author || 'A')[0].toUpperCase()}</div>
                    <div>
                      {/* 修改 5: 作者名稱加深顏色 */}
                      <div className={`font-bold text-sm ${isHistorical ? 'text-slate-600' : 'text-slate-900 dark:text-slate-100'}`}>{anc.author}</div>
                      {/* 修改 6: 日期顏色改為 text-muted-custom 以符合對比度 */}
                      <div className="flex items-center gap-2"><span className="text-[10px] px-1.5 py-0.5 rounded font-bold" style={{ backgroundColor: catInfo.found ? catInfo.color : '#f3f4f6', color: catInfo.found ? '#ffffff' : '#4b5563' }}>{catInfo.label}</span><span className="text-[10px] text-muted-custom font-bold">{new Date(anc.timestamp).toLocaleString()}</span></div>
                    </div>
                  </div>
                  {isAdmin && !isHistoryMode && (<div className="flex gap-1 z-10 mr-1 mt-8 sm:mt-0" onClick={(e) => e.stopPropagation()}><button onClick={() => openAnnounceModal(anc)} className="text-slate-400 hover:text-blue-600 p-1 transition-colors"><Icon name="Edit2" className="w-4 h-4" /></button><button onClick={() => handleDelete(anc.id)} className="text-slate-400 hover:text-red-500 p-1 transition-colors"><Icon name="Trash2" className="w-4 h-4" /></button></div>)}
                </div>
                {/* 修改 7: 標題使用標準文字顏色變數 */}
                <h3 className={`font-bold text-lg mb-2 leading-tight ${isHistorical ? 'text-slate-600' : 'text-slate-900 dark:text-white'}`}>{anc.title}</h3>

                {isExpanded ? (
                  <div className="animate-fadeIn cursor-text" onClick={(e) => e.stopPropagation()}>
                    {/* 修改 8: 內文使用 text-muted-custom 或高對比 slate */}
                    <div className="text-sm text-slate-700 leading-relaxed mb-3 ql-editor px-0 dark:text-slate-200" dangerouslySetInnerHTML={{ __html: anc.content }} onClick={(e) => { if (e.target.tagName === 'IMG') setViewingImg(e.target.src); }}></div>
                    {attachmentImages.length > 0 && (<div className="mt-2 border-t border-gray-100 pt-2 dark:border-slate-700"><div className="text-xs text-slate-500 font-bold mb-2">附件圖片</div><div className="grid grid-cols-2 gap-1">{attachmentImages.map((url, idx) => (<img key={idx} src={url} className="w-full h-32 object-cover rounded cursor-pointer hover:opacity-90" onClick={() => setViewingImg(url)} />))}</div></div>)}
                    <div className="text-center mt-4 pt-2 border-t border-gray-100 text-xs font-bold cursor-pointer text-indigo-500 dark:border-slate-700 dark:text-indigo-400" onClick={() => toggleExpand(anc.id)}>收起公告</div>
                  </div>
                ) : (
                  <div className="mt-1">
                    {/* 修改 9: 預覽文字使用 text-muted-custom */}
                    <div className="text-sm text-muted-custom line-clamp-2">
                      {plainText ? plainText : <span className="italic text-slate-400">無文字內容...</span>}
                    </div>
                    {allPreviewImages.length > 0 && (
                      <div className="flex gap-2 mt-2">
                        {allPreviewImages.slice(0, 3).map((url, idx) => (
                          <img key={idx} src={url} className="w-16 h-16 object-cover rounded-md border border-gray-200 dark:border-slate-700" alt="thumbnail" />
                        ))}
                        {allPreviewImages.length > 3 && (
                          <div className="w-16 h-16 rounded-md border border-gray-200 bg-gray-50 flex items-center justify-center text-xs text-slate-500 font-bold dark:border-slate-700 dark:bg-slate-700 dark:text-slate-300">
                            +{allPreviewImages.length - 3}
                          </div>
                        )}
                      </div>
                    )}
                    <div className="text-xs text-indigo-500 font-bold mt-2 flex items-center gap-1 dark:text-indigo-400">
                      點擊查看詳情
                    </div>
                  </div>
                )}
              </div>
            </Card>
          );
        }) : <div className="text-center py-10 text-muted-custom font-bold">目前沒有公告</div>}
      </div>
      <Modal
        isOpen={!!viewingImg}
        title="預覽圖片"
        onClose={() => setViewingImg(null)}
        maxWidth="max-w-3xl"
      >
        <div className="flex justify-center items-center bg-slate-900/50 rounded-xl p-2 min-h-[300px]">
          <img
            src={viewingImg}
            className="max-w-full max-h-[70vh] rounded-lg shadow-2xl object-contain animate-fadeIn"
            alt="announcement preview"
          />
        </div>
        <div className="mt-4">
          <Button
            variant="ghost"
            className="w-full text-slate-400 hover:text-white"
            onClick={() => setViewingImg(null)}
          >
            關閉預覽
          </Button>
        </div>
      </Modal>
    </div>
  );
};