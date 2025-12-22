import React, { createContext, useContext, useState, useRef, useCallback } from 'react';
import { Modal } from '../components/ui/Modal';
import { Button } from '../components/ui/Button';
import { Icon } from '../components/Icons';
import { RichTextEditor } from '../components/RichTextEditor';
import { useGlobalData } from './DataContext';
import { useToast } from './ToastContext';
import { safeParseImages } from '../utils/helpers';
import { ConfirmDialog } from '../components/ConfirmDialog';

const TASK_TYPES = {
    PINNED: { label: '常駐/公告', defaultCategoryLabel: '常駐', defaultIcon: '📌', defaultWeek: 'Pinned', isPinned: false },
    DAILY: { label: '每日挑戰', defaultCategoryLabel: '每日', defaultIcon: '📅', defaultWeek: '1', isPinned: false },
    SEASONAL: { label: '賽季進度', defaultCategoryLabel: '一般', defaultIcon: '🏆', defaultWeek: '1', isPinned: false }
};
const EMOJI_LIST = ['🐾', '📅', '⚔️', '✨', '🥚', '🎁', '🔥', '💧', '⚡', '🍃', '❄️', '🥊', '👻', '🟣', '🟤', '🧚', '🐉', '🏔️', '🦅', '🤝', '🚶', '📸', '📍', '🍬', '⭐', '🏆', '🎮', '🎲', '👾', '🕹️'];

const CategorySelector = ({ options, selectedId, onSelect }) => (
    <div className="flex flex-wrap gap-2 p-2 bg-slate-50 border rounded-lg max-h-32 overflow-y-auto dark:bg-slate-800 dark:border-slate-700">
        {options.length > 0 ? options.map(cat => {
            const isSelected = selectedId === cat.firestoreId;
            return (
                <button
                    key={cat.firestoreId}
                    type="button"
                    onClick={() => onSelect(cat)}
                    className={`flex items-center px-2 py-1 rounded text-xs transition-all border shadow-sm ${isSelected ? 'ring-2 ring-indigo-500 ring-offset-1 scale-105 dark:ring-offset-slate-800' : 'hover:opacity-90 border-transparent hover:scale-105'}`}
                    style={{ backgroundColor: cat.color, color: '#ffffff' }}
                >
                    {cat.label}
                    {isSelected && <Icon name="Check" className="w-3 h-3 ml-1 text-white" />}
                </button>
            );
        }) : <span className="text-xs text-gray-400 dark:text-slate-500">無可用分類</span>}
    </div>
);

const ModalContext = createContext();

export const ModalProvider = ({ children }) => {
    const { actions, categories, roles, loading } = useGlobalData();
    const { showToast } = useToast();

    // --- State ---
    // 🔥 新增 isBonusOnly 欄位預設值
    const [taskModal, setTaskModal] = useState({ isOpen: false, id: null, data: { title: '', points: 10, icon: '🐾', description: '', week: '1', type: 'fixed', category: '一般', categoryId: null, isPinned: false, isBonusOnly: false } });
    const [currentTaskType, setCurrentTaskType] = useState('SEASONAL');
    const [showEmojiPicker, setShowEmojiPicker] = useState(false);
    const [submitModal, setSubmitModal] = useState({ isOpen: false, task: null, proof: '', images: [], rawFiles: [] });
    const fileInputRef = useRef(null);
    const [announceModal, setAnnounceModal] = useState({ isOpen: false, id: null, title: '', content: '', images: [], rawFiles: [], category: '一般', categoryId: null, isPinned: false });
    const announceFileRef = useRef(null);
    const [gameModal, setGameModal] = useState({ isOpen: false, id: null, title: '', url: '', icon: '' });
    const [archiveModal, setArchiveModal] = useState({ isOpen: false, newSeasonName: '' });
    const [userRoleModal, setUserRoleModal] = useState({ isOpen: false, uid: null, roles: [] });
    const [dialogConfig, setDialogConfig] = useState({ isOpen: false, title: '', message: '', onConfirm: null, loading: false });

    const confirm = useCallback(({ title, message, onConfirm }) => {
        setDialogConfig({
            isOpen: true, title, message,
            onConfirm: async () => {
                setDialogConfig(prev => ({ ...prev, loading: true }));
                try { await onConfirm(); } catch (e) { console.error(e); }
                finally { setDialogConfig({ isOpen: false, title: '', message: '', onConfirm: null, loading: false }); }
            }
        });
    }, []);

    // --- Handlers ---
    const openTaskModal = (task = null) => {
        if (task) {
            // 🔥 讀取 isBonusOnly
            setTaskModal({ isOpen: true, id: task.id, firestoreId: task.firestoreId, data: { ...task, categoryId: task.categoryId || null, isBonusOnly: !!task.isBonusOnly } });
            if (task.category === '常駐' || (task.isPinned && task.category !== '每日')) setCurrentTaskType('PINNED');
            else if (task.category === '每日') setCurrentTaskType('DAILY');
            else setCurrentTaskType('SEASONAL');
        } else {
            // 🔥 初始化 isBonusOnly
            setTaskModal({ isOpen: true, id: null, firestoreId: null, data: { title: '', points: 10, icon: '🐾', description: '', week: '1', type: 'fixed', category: '一般', categoryId: null, isPinned: false, isBonusOnly: false } });
            setCurrentTaskType('SEASONAL');
        }
    };
    const handleSaveTask = async () => {
        if (loading) return;
        if (taskModal.firestoreId) await actions.updateTask(taskModal.firestoreId, taskModal.data);
        else await actions.addTask(taskModal.data);
        setTaskModal(prev => ({ ...prev, isOpen: false })); setShowEmojiPicker(false);
    };
    const handleTypeChange = (typeKey) => {
        setCurrentTaskType(typeKey);
        const config = TASK_TYPES[typeKey];
        const defCat = categories?.find(c => c.label === config.defaultCategoryLabel && c.type === 'task');
        setTaskModal(prev => ({ ...prev, data: { ...prev.data, category: config.defaultCategoryLabel, categoryId: defCat ? defCat.firestoreId : null, icon: (!prev.id && prev.data.icon === '🐾') ? config.defaultIcon : prev.data.icon, week: typeKey === 'PINNED' ? config.defaultWeek : (prev.data.week === 'Pinned' ? '1' : prev.data.week), isPinned: config.isPinned } }));
    };

    const openSubmitModal = (task) => setSubmitModal({ isOpen: true, task, proof: '', images: [], rawFiles: [] });
    const handleSubmitTask = async () => {
        if (loading) return;
        const success = await actions.submitTask({ task: submitModal.task, proof: submitModal.proof, rawFiles: submitModal.rawFiles });
        if (success) setSubmitModal({ isOpen: false, task: null, proof: '', images: [], rawFiles: [] });
    };
    const handleImageUpload = (e) => { const files = Array.from(e.target.files); if (files.length > 0) setSubmitModal(prev => ({ ...prev, rawFiles: files, images: files.map(f => URL.createObjectURL(f)) })); };

    const openAnnounceModal = (anc = null) => {
        if (anc) setAnnounceModal({ isOpen: true, id: anc.id, firestoreId: anc.firestoreId, title: anc.title, content: anc.content, images: safeParseImages(anc.images), category: anc.category, categoryId: anc.categoryId, isPinned: !!anc.isPinned });
        else setAnnounceModal({ isOpen: true, id: null, title: '', content: '', images: [], rawFiles: [], category: '一般', categoryId: null, isPinned: false });
    };
    const handleAddAnnouncement = async () => {
        if (loading) return;
        const keepOldImages = announceModal.images.filter(url => !url.startsWith('blob:'));
        if (announceModal.id) await actions.updateAnnouncement(announceModal.id, announceModal.title, announceModal.content, announceModal.rawFiles, announceModal.category, announceModal.isPinned, keepOldImages, announceModal.categoryId);
        else await actions.addAnnouncement(announceModal.title, announceModal.content, announceModal.rawFiles, announceModal.category, announceModal.isPinned, announceModal.categoryId);
        setAnnounceModal(prev => ({ ...prev, isOpen: false }));
    };

    const openGameModal = (game = null) => {
        if (game) setGameModal({ isOpen: true, id: game.id, firestoreId: game.firestoreId, title: game.title, url: game.url, icon: game.icon });
        else setGameModal({ isOpen: true, id: null, title: '', url: '', icon: '' });
    };
    const handleSaveGame = async () => {
        if (loading) return;
        if (gameModal.id) await actions.updateGame({ id: gameModal.id, firestoreId: gameModal.firestoreId, title: gameModal.title, url: gameModal.url, icon: gameModal.icon });
        else await actions.addGame({ id: null, title: gameModal.title, url: gameModal.url, icon: gameModal.icon });
        setGameModal(prev => ({ ...prev, isOpen: false }));
    };

    const openArchiveModal = () => setArchiveModal({ isOpen: true, newSeasonName: '' });
    const openUserRoleModal = (uid, currentRoles) => setUserRoleModal({ isOpen: true, uid, roles: currentRoles || [] });
    const handleUpdateUserRoles = async () => {
        if (loading) return;
        if (userRoleModal.uid) await actions.updateUserRoles(userRoleModal.uid, userRoleModal.roles);
        setUserRoleModal({ isOpen: false, uid: null, roles: [] });
    };

    return (
        <ModalContext.Provider value={{ openTaskModal, openSubmitModal, openAnnounceModal, openGameModal, openArchiveModal, openUserRoleModal, confirm }}>
            {children}
            {/* Task Modal */}
            <Modal isOpen={taskModal.isOpen} onClose={() => setTaskModal(prev => ({ ...prev, isOpen: false }))} title={taskModal.id ? "編輯任務" : "新增任務"}>
                <div className="space-y-4 relative" onClick={() => setShowEmojiPicker(false)}>
                    <div className="bg-slate-100 p-1 rounded-lg flex text-xs font-bold text-slate-500 dark:bg-slate-800 dark:text-slate-400">
                        {Object.entries(TASK_TYPES).map(([key, config]) => (
                            <button
                                key={key}
                                onClick={() => handleTypeChange(key)}
                                className={`flex-1 py-2 rounded-md transition-all ${currentTaskType === key ? 'bg-white text-indigo-600 shadow-sm dark:bg-slate-700 dark:text-indigo-400' : 'hover:text-slate-700 dark:hover:text-slate-200'}`}
                            >
                                {config.label}
                            </button>
                        ))}
                    </div>
                    <div className="space-y-4 pt-2">
                        <div><label className="text-xs font-bold text-gray-500 mb-1 block dark:text-slate-400">任務標題</label><input className="w-full p-2 border rounded-lg text-sm" placeholder="輸入任務名稱" value={taskModal.data.title} onChange={e => setTaskModal({ ...taskModal, data: { ...taskModal.data, title: e.target.value } })} /></div>
                        <div className="grid grid-cols-2 gap-3">
                            <div><label className="text-xs font-bold text-gray-500 mb-1 block dark:text-slate-400">計分方式</label><div className="flex gap-2"><select className="w-full p-2 border rounded-lg text-sm" value={taskModal.data.type} onChange={e => setTaskModal({ ...taskModal, data: { ...taskModal.data, type: e.target.value } })}><option value="fixed">固定分數</option><option value="variable">管理員評分</option></select></div></div>
                            {currentTaskType !== 'PINNED' && (<div><label className="text-xs font-bold text-gray-500 mb-1 block dark:text-slate-400">所屬週次</label><input type="number" className="w-full p-2 border rounded-lg text-sm" placeholder="例如: 1" value={taskModal.data.week} onChange={e => setTaskModal({ ...taskModal, data: { ...taskModal.data, week: e.target.value } })} /></div>)}
                            {taskModal.data.type === 'fixed' && (<div><label className="text-xs font-bold text-gray-500 mb-1 block dark:text-slate-400">獲得積分</label><input type="number" className="w-full p-2 border rounded-lg text-sm" placeholder="例如: 10" value={taskModal.data.points} onChange={e => setTaskModal({ ...taskModal, data: { ...taskModal.data, points: e.target.value } })} /></div>)}
                        </div>
                        {currentTaskType === 'SEASONAL' && (<div><label className="text-xs font-bold text-gray-500 mb-1 block dark:text-slate-400">分類標籤</label><CategorySelector options={categories ? categories.filter(c => c.type === 'task' && c.label !== '每日' && c.label !== '常駐') : []} selectedId={taskModal.data.categoryId} onSelect={(cat) => setTaskModal(prev => ({ ...prev, data: { ...prev.data, category: cat.label, categoryId: cat.firestoreId, categoryColor: cat.color } }))} /></div>)}

                        <div className="flex flex-wrap gap-2 mt-2">
                            <label className="flex items-center gap-2 p-2 border rounded-lg cursor-pointer bg-slate-50 hover:bg-slate-100 select-none flex-1 dark:bg-slate-800 dark:border-slate-700 dark:hover:bg-slate-700">
                                <input type="checkbox" checked={taskModal.data.isPinned || false} onChange={e => setTaskModal({ ...taskModal, data: { ...taskModal.data, isPinned: e.target.checked } })} className="w-4 h-4 accent-indigo-600" />
                                <span className="text-sm font-bold text-slate-700 dark:text-slate-300">置頂</span>
                            </label>
                            {/* 🔥 新增不列入賽季目標選項 */}
                            <label className="flex items-center gap-2 p-2 border rounded-lg cursor-pointer bg-amber-50 hover:bg-amber-100 select-none flex-[2] dark:bg-amber-900/20 dark:border-amber-900/50 dark:hover:bg-amber-900/40">
                                <input type="checkbox" checked={taskModal.data.isBonusOnly || false} onChange={e => setTaskModal({ ...taskModal, data: { ...taskModal.data, isBonusOnly: e.target.checked } })} className="w-4 h-4 accent-amber-600" />
                                <span className="text-sm font-bold text-amber-800 dark:text-amber-400">🎁 不列入賽季目標 (僅列入排名)</span>
                            </label>
                        </div>

                        <div className="relative">
                            <label className="text-xs font-bold text-gray-500 mb-1 block dark:text-slate-400">圖示 (Emoji)</label>
                            <div className="flex gap-2">
                                <input className="flex-1 p-2 border rounded-lg text-center text-xl" placeholder="🐾" value={taskModal.data.icon} onChange={e => setTaskModal({ ...taskModal, data: { ...taskModal.data, icon: e.target.value } })} />
                                <button type="button" onClick={(e) => { e.stopPropagation(); setShowEmojiPicker(!showEmojiPicker); }} className="bg-gray-100 p-2 rounded-lg hover:bg-gray-200 transition-colors dark:bg-slate-700 dark:hover:bg-slate-600"><Icon name="Smile" className="w-5 h-5 text-gray-600 dark:text-slate-300" /></button>
                            </div>
                            {showEmojiPicker && (
                                <div className="absolute right-0 bottom-full mb-2 bg-white border border-gray-200 rounded-lg shadow-xl p-2 z-50 w-64 grid grid-cols-6 gap-1 max-h-48 overflow-y-auto dark:bg-slate-800 dark:border-slate-700" onClick={(e) => e.stopPropagation()}>
                                    {EMOJI_LIST.map(emoji => (<button key={emoji} type="button" onClick={() => { setTaskModal({ ...taskModal, data: { ...taskModal.data, icon: emoji } }); setShowEmojiPicker(false); }} className="text-xl p-1 hover:bg-indigo-50 rounded dark:hover:bg-slate-700">{emoji}</button>))}
                                </div>
                            )}
                        </div>
                        <div><label className="text-xs font-bold text-gray-500 mb-1 block dark:text-slate-400">任務描述</label><textarea className="w-full p-2 border rounded-lg h-24 resize-none text-sm" placeholder="請輸入詳細說明..." value={taskModal.data.description} onChange={e => setTaskModal({ ...taskModal, data: { ...taskModal.data, description: e.target.value } })} /></div>
                        <Button onClick={handleSaveTask} className="w-full" disabled={loading}>{taskModal.id ? "更新任務" : "新增任務"}</Button>
                    </div>
                </div>
            </Modal>

            {/* 其他 Modals 保持不變 ... */}
            <Modal isOpen={submitModal.isOpen} onClose={() => setSubmitModal(prev => ({ ...prev, isOpen: false }))} title={`回報: ${submitModal.task?.title}`}>
                <div className="space-y-4">
                    <div className="bg-slate-50 p-3 rounded-lg flex items-center gap-3 dark:bg-slate-800">
                        <div className="text-3xl">{submitModal.task?.icon}</div>
                        <div><div className="font-bold text-slate-700 dark:text-slate-200">{submitModal.task?.title}</div><div className="text-xs text-slate-500 dark:text-slate-400">{submitModal.task?.description}</div></div>
                    </div>
                    <div>
                        <label className="text-xs font-bold text-gray-500 mb-1 block dark:text-slate-400">上傳證明截圖 (可選)</label>
                        <div onClick={() => fileInputRef.current?.click()} className="w-full h-32 border-2 border-dashed border-gray-300 rounded-xl bg-gray-50 flex flex-col items-center justify-center cursor-pointer hover:bg-gray-100 transition-colors dark:bg-slate-800/50 dark:border-slate-700 dark:hover:bg-slate-800">
                            {submitModal.images.length > 0 ? (<div className="flex gap-2 overflow-x-auto w-full px-2 h-full items-center">{submitModal.images.map((img, i) => (<img key={i} src={img} className="h-24 w-auto rounded shadow-sm object-cover" />))}</div>) : (<><Icon name="Camera" className="w-8 h-8 text-gray-400 mb-2 dark:text-slate-500" /><span className="text-xs text-gray-400 dark:text-slate-500">點擊上傳圖片</span></>)}
                            <input type="file" ref={fileInputRef} className="hidden" accept="image/*" multiple onChange={handleImageUpload} />
                        </div>
                    </div>
                    <div><label className="text-xs font-bold text-gray-500 mb-1 block dark:text-slate-400">備註說明 (可選)</label><textarea className="w-full p-3 border rounded-xl text-sm h-20 resize-none focus:border-indigo-500 outline-none" placeholder="有什麼想補充的嗎？" value={submitModal.proof} onChange={e => setSubmitModal({ ...submitModal, proof: e.target.value })} /></div>
                    <Button onClick={handleSubmitTask} className="w-full py-3" disabled={loading}>提交回報</Button>
                </div>
            </Modal>
            <Modal isOpen={announceModal.isOpen} onClose={() => setAnnounceModal(prev => ({ ...prev, isOpen: false }))} title={announceModal.id ? "編輯公告" : "發佈公告"}>
                <div className="space-y-3">
                    <input className="w-full p-2 border rounded-lg font-bold" placeholder="主旨標題" value={announceModal.title} onChange={e => setAnnounceModal({ ...announceModal, title: e.target.value })} />
                    <div className="flex flex-col gap-2">
                        <label className="text-xs font-bold text-gray-500 dark:text-slate-400">分類標籤</label>
                        <CategorySelector options={categories ? categories.filter(c => c.type === 'announcement') : []} selectedId={announceModal.categoryId} onSelect={(cat) => setAnnounceModal(prev => ({ ...prev, category: cat.label, categoryId: cat.firestoreId, categoryColor: cat.color }))} />
                        <label className="flex items-center gap-2 p-2 border rounded-lg cursor-pointer bg-slate-50 hover:bg-slate-100 select-none w-full sm:w-auto mt-2 dark:bg-slate-800 dark:border-slate-700 dark:hover:bg-slate-700">
                            <input type="checkbox" checked={announceModal.isPinned} onChange={e => setAnnounceModal({ ...announceModal, isPinned: e.target.checked })} className="w-4 h-4 accent-indigo-600" />
                            <span className="text-sm font-bold text-slate-700 dark:text-slate-300">置頂</span>
                        </label>
                    </div>
                    <RichTextEditor value={announceModal.content} onChange={(html) => setAnnounceModal(prev => ({ ...prev, content: html }))} onImageUpload={async (file) => await actions.uploadSingleImage(file)} />
                    <div>
                        <div className="text-xs font-bold text-gray-500 mb-2 flex justify-between items-end dark:text-slate-400"><span>附件圖片</span><span className="text-[10px] text-gray-400 font-normal">點擊可刪除</span></div>
                        {announceModal.images && announceModal.images.length > 0 && (<div className="grid grid-cols-4 gap-2 mb-2">{announceModal.images.map((url, idx) => (<div key={idx} className="relative group cursor-pointer" onClick={() => setAnnounceModal(prev => { const newImg = [...prev.images]; newImg.splice(idx, 1); return { ...prev, images: newImg }; })}><img src={url} className="w-full h-16 object-cover rounded border border-gray-200 dark:border-slate-700" /><div className="absolute inset-0 bg-black/50 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity rounded text-white"><Icon name="Trash2" className="w-4 h-4" /></div></div>))}</div>)}
                        <div onClick={() => announceFileRef.current?.click()} className="w-full min-h-[60px] rounded-lg border-2 border-dashed border-gray-300 bg-gray-50 flex flex-wrap gap-2 p-2 cursor-pointer items-center justify-center hover:bg-gray-100 transition-colors dark:bg-slate-800/50 dark:border-slate-700 dark:hover:bg-slate-800">
                            <div className="text-gray-400 flex flex-col items-center dark:text-slate-500"><Icon name="Image" className="w-5 h-5 mb-1" /><span className="text-xs">點擊新增附件</span></div>
                            <input type="file" ref={announceFileRef} className="hidden" accept="image/*" multiple onChange={(e) => { const files = Array.from(e.target.files); if (files.length) setAnnounceModal(prev => ({ ...prev, rawFiles: [...(prev.rawFiles || []), ...files], images: [...prev.images, ...files.map(f => URL.createObjectURL(f))] })); }} />
                        </div>
                    </div>
                    <Button onClick={handleAddAnnouncement} className="w-full mt-2" disabled={loading}>{announceModal.id ? "更新" : "發佈"}</Button>
                </div>
            </Modal>
            <Modal isOpen={gameModal.isOpen} onClose={() => setGameModal(prev => ({ ...prev, isOpen: false }))} title={gameModal.id ? "編輯遊戲" : "新增遊戲"}>
                <div className="space-y-3">
                    <input className="w-full p-2 border rounded-lg" placeholder="遊戲名稱" value={gameModal.title} onChange={e => setGameModal({ ...gameModal, title: e.target.value })} />
                    <input className="w-full p-2 border rounded-lg" placeholder="https://..." value={gameModal.url} onChange={e => setGameModal({ ...gameModal, url: e.target.value })} />
                    <div className="relative">
                        <div className="flex gap-2">
                            <input className="flex-1 p-2 border rounded-lg text-center" placeholder="Icon (Emoji)" value={gameModal.icon} onChange={e => setGameModal({ ...gameModal, icon: e.target.value })} />
                            <button type="button" onClick={(e) => { e.stopPropagation(); setShowEmojiPicker(!showEmojiPicker); }} className="bg-gray-100 p-2 rounded-lg hover:bg-gray-200 transition-colors dark:bg-slate-700 dark:hover:bg-slate-600"><Icon name="Smile" className="w-5 h-5 text-gray-600 dark:text-slate-300" /></button>
                        </div>
                        {showEmojiPicker && (
                            <div className="absolute right-0 bottom-full mb-2 bg-white border border-gray-200 rounded-lg shadow-xl p-2 z-50 w-64 grid grid-cols-6 gap-1 max-h-48 overflow-y-auto dark:bg-slate-800 dark:border-slate-700" onClick={(e) => e.stopPropagation()}>
                                {EMOJI_LIST.map(emoji => (<button key={emoji} type="button" onClick={() => { setGameModal({ ...gameModal, icon: emoji }); setShowEmojiPicker(false); }} className="text-xl p-1 hover:bg-indigo-50 rounded dark:hover:bg-slate-700">{emoji}</button>))}
                            </div>
                        )}
                    </div>
                    <Button onClick={handleSaveGame} className="w-full mt-2" disabled={loading}>儲存設定</Button>
                </div>
            </Modal>
            <Modal isOpen={archiveModal.isOpen} onClose={() => setArchiveModal(prev => ({ ...prev, isOpen: false }))} title="重置賽季">
                <div className="space-y-4">
                    <div className="bg-yellow-50 p-3 rounded-lg border border-yellow-100 text-xs text-yellow-700 dark:bg-yellow-900/30 dark:border-yellow-900 dark:text-yellow-400">⚠️ 警告：此操作將重置所有積分並封存目前資料。</div>
                    <input className="w-full p-2 border rounded-lg" placeholder="新賽季名稱" value={archiveModal.newSeasonName} onChange={e => setArchiveModal({ ...archiveModal, newSeasonName: e.target.value })} />
                    <Button variant="danger" onClick={() => { if (archiveModal.newSeasonName) actions.archive(archiveModal.newSeasonName).then(() => setArchiveModal(prev => ({ ...prev, isOpen: false }))); }} className="w-full">確認重置</Button>
                </div>
            </Modal>
            <Modal isOpen={userRoleModal.isOpen} onClose={() => setUserRoleModal(prev => ({ ...prev, isOpen: false }))} title={`設定身分: ${userRoleModal.uid}`}>
                <div className="space-y-4">
                    <div className="bg-indigo-50 p-3 rounded-lg text-xs text-indigo-700 mb-2 dark:bg-indigo-900/30 dark:text-indigo-300">勾選此使用者擁有的身分組 (可多選)</div>
                    <div className="space-y-2 max-h-[300px] overflow-y-auto">
                        {(roles || []).map(role => (
                            <label key={role.code} className="flex items-center justify-between p-3 border rounded-lg cursor-pointer hover:bg-gray-50 dark:hover:bg-slate-800 dark:border-slate-700"><div className="flex items-center gap-2"><span style={{ color: role.color }} className="font-bold">{role.label}</span><span className="text-xs text-gray-400">x{role.multiplier}</span></div><input type="checkbox" checked={(userRoleModal.roles || []).includes(role.code)} onChange={(e) => { const currentRoles = userRoleModal.roles || []; const newRoles = e.target.checked ? [...currentRoles, role.code] : currentRoles.filter(r => r !== role.code); setUserRoleModal({ ...userRoleModal, roles: newRoles }); }} className="w-5 h-5 accent-indigo-600" /></label>
                        ))}
                    </div>
                    <Button onClick={handleUpdateUserRoles} className="w-full" disabled={loading}>儲存設定</Button>
                </div>
            </Modal>
            <ConfirmDialog isOpen={dialogConfig.isOpen} title={dialogConfig.title} message={dialogConfig.message} onConfirm={dialogConfig.onConfirm} onCancel={() => setDialogConfig(prev => ({ ...prev, isOpen: false }))} loading={dialogConfig.loading} />
        </ModalContext.Provider>
    );
};
export const useModals = () => useContext(ModalContext);