import React from 'react';
import { NavLink, Outlet } from 'react-router-dom';
import { useGlobalData } from '../context/DataContext';
import { Icon } from './Icons';
import { Badge } from './ui/Badge';

export const Layout = () => {
    const { 
        currentUser, availableSeasons, selectedSeason, isHistoryMode, 
        needRefresh, actions, loading, notifications, clearNotification,
        theme, toggleTheme // 取得主題狀態
    } = useGlobalData();

    const navItems = [
        { id: 'announcements', path: '', icon: 'Bell', label: '公告', hasNotif: notifications?.announcements },
        { id: 'tasks', path: 'tasks', icon: 'Map', label: '任務', hasNotif: notifications?.tasks },
        { id: 'leaderboard', path: 'leaderboard', icon: 'Trophy', label: '排行' },
        ...(currentUser?.isAdmin ? [{ id: 'report', path: 'report', icon: 'Table', label: '報表' }] : []),
        { id: 'profile', path: 'profile', icon: 'User', label: '個人' },
        { id: 'game', path: 'game', icon: 'Gamepad', label: '遊戲' }
    ];

    return (
        <div className="min-h-screen bg-slate-50 text-slate-800 pb-24 font-sans dark:bg-slate-950 dark:text-slate-100 transition-colors">
            {/* Top Bar */}
            <div className={`sticky top-0 z-40 shadow-sm px-4 py-3 flex justify-between items-center border-b safe-area-top transition-colors duration-300 
                ${isHistoryMode 
                    ? 'bg-yellow-50 border-yellow-200 dark:bg-yellow-900/20 dark:border-yellow-900' 
                    : 'bg-white border-gray-100 dark:bg-slate-900 dark:border-slate-800'
                }`}>
                
                <div className="flex items-center gap-2">
                    <div className="font-black text-lg text-indigo-600 dark:text-indigo-400">Team Aura</div>
                    {currentUser?.isAdmin && <Badge color="indigo">ADMIN</Badge>}
                    
                    {/* 賽季選擇器 */}
                    <div className="relative flex items-center">
                        <select 
                            value={selectedSeason || ''} 
                            onChange={(e) => actions.setSeason(e.target.value)} 
                            disabled={availableSeasons.length === 0} 
                            className={`text-xs font-bold border-l pl-2 ml-2 outline-none bg-transparent cursor-pointer appearance-none pr-4 
                                ${isHistoryMode 
                                    ? 'text-yellow-700 border-yellow-400 dark:text-yellow-500 dark:border-yellow-700' 
                                    : 'text-gray-500 border-gray-300 dark:text-slate-400 dark:border-slate-700'
                                }`
                        }>
                            {availableSeasons.length > 0 ? (availableSeasons.map(s => <option key={s} value={s}>{s}</option>)) : (<option>載入中...</option>)}
                        </select>
                        <div className="pointer-events-none absolute right-0 flex items-center px-1 text-gray-500"><Icon name="ChevronDown" className="h-3 w-3" /></div>
                    </div>
                    {isHistoryMode && <Badge color="yellow">歷史模式</Badge>}
                </div>

                <div className="flex items-center gap-2">
                    {/* 深色模式切換按鈕 */}
                    <button 
                        onClick={toggleTheme} 
                        className="p-2 bg-gray-100 rounded-full hover:bg-gray-200 transition-colors dark:bg-slate-800 dark:hover:bg-slate-700 dark:text-slate-300"
                        title={theme === 'dark' ? "切換至亮色模式" : "切換至深色模式"}
                    >
                        <Icon name={theme === 'dark' ? "Sun" : "Moon"} className="w-4 h-4" />
                    </button>

                    {!currentUser?.isAdmin && <Badge color={isHistoryMode ? "yellow" : "indigo"} className="text-sm">{Number(currentUser?.points || 0)} pts</Badge>}
                    
                    <button onClick={actions.refreshApp} className="p-2 bg-gray-100 rounded-full hover:bg-gray-200 transition-colors relative dark:bg-slate-800 dark:hover:bg-slate-700 dark:text-slate-300">
                        <Icon name="RefreshCw" className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
                        {needRefresh && (<span className="absolute top-0 right-0 w-2.5 h-2.5 bg-red-500 rounded-full border-2 border-white animate-pulse"></span>)}
                    </button>
                </div>
            </div>

            <div className="w-full mx-auto px-3 sm:px-4 py-4 space-y-6 max-w-3xl mb-10">
                {isHistoryMode && (<div className="bg-yellow-100 text-yellow-800 p-2 text-xs text-center rounded-lg font-bold border border-yellow-200 dark:bg-yellow-900/30 dark:text-yellow-400 dark:border-yellow-900">⚠️ 您正在檢視歷史賽季資料，僅供查閱，無法進行編輯或提交。</div>)}
                {needRefresh && (<div onClick={actions.refreshApp} className="bg-indigo-600 text-white p-3 rounded-lg shadow-lg flex items-center justify-between cursor-pointer animate-fadeIn"><div className="text-xs font-bold flex items-center gap-2"><Icon name="ArrowUp" className="w-4 h-4" />發現新版本，點擊立即更新！</div><Icon name="ChevronRight" className="w-4 h-4" /></div>)}
                <Outlet />
            </div>

            {/* Bottom Nav */}
            <div className="fixed bottom-0 w-full bg-white border-t border-gray-200 py-2 flex justify-around text-xs font-bold text-gray-400 safe-area-bottom z-30 dark:bg-slate-900 dark:border-slate-800 dark:text-slate-500">
                {navItems.map(tab => (
                    <NavLink 
                        key={tab.id} 
                        to={tab.path} 
                        end={tab.path === ''} 
                        onClick={() => clearNotification(tab.id)} 
                        className={({ isActive }) => `flex flex-col items-center gap-1 p-2 relative transition-colors ${isActive ? 'text-indigo-600 dark:text-indigo-400' : ''}`}
                    >
                        <div className="relative">
                            <Icon name={tab.icon} className="w-6 h-6" />
                            {tab.hasNotif && (<span className="absolute -top-1 -right-1 w-2.5 h-2.5 bg-red-500 rounded-full border-2 border-white animate-pulse"></span>)}
                        </div>
                        {tab.label}
                    </NavLink>
                ))}
            </div>
        </div>
    );
};