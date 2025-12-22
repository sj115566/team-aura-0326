import React, { Suspense, lazy } from 'react';
import { HashRouter, Routes, Route, Navigate } from 'react-router-dom';
import { ToastProvider } from './context/ToastContext';
import { DataProvider, useGlobalData } from './context/DataContext';
import { ModalProvider } from './context/ModalContext';
import { LoadingOverlay } from './components/LoadingOverlay';
import { LoginView } from './views/LoginView';
import { Layout } from './components/Layout';
import { Icon } from './components/Icons';

// Lazy Load Views
const AnnouncementView = lazy(() => import('./views/AnnouncementView').then(module => ({ default: module.AnnouncementView })));
const TaskListView = lazy(() => import('./views/TaskListView').then(module => ({ default: module.TaskListView })));
const LeaderboardView = lazy(() => import('./views/LeaderboardView').then(module => ({ default: module.LeaderboardView })));
const ReportView = lazy(() => import('./views/ReportView').then(module => ({ default: module.ReportView })));
const ProfileView = lazy(() => import('./views/ProfileView').then(module => ({ default: module.ProfileView })));
const GameView = lazy(() => import('./views/GameView').then(module => ({ default: module.GameView })));

const PageLoader = () => (
    <div className="flex items-center justify-center h-[50vh]">
        <Icon name="Loader2" className="w-8 h-8 text-indigo-400 animate-spin" />
    </div>
);

const AppRoutes = () => {
    const { currentUser, loading, login, actions } = useGlobalData();
    
    if (!currentUser) {
        return (
            <>
                <LoadingOverlay isLoading={loading} />
                <LoginView onLogin={login} loading={loading} onInitialize={actions.initializeSystem} />
            </>
        );
    }

    return (
        <>
            <LoadingOverlay isLoading={loading} />
            <Routes>
                <Route path="/" element={<Layout />}>
                    <Route index element={<Suspense fallback={<PageLoader />}><AnnouncementView /></Suspense>} />
                    <Route path="tasks" element={<Suspense fallback={<PageLoader />}><TaskListView /></Suspense>} />
                    <Route path="leaderboard" element={<Suspense fallback={<PageLoader />}><LeaderboardView /></Suspense>} />
                    <Route path="profile" element={<Suspense fallback={<PageLoader />}><ProfileView /></Suspense>} />
                    <Route path="game" element={<Suspense fallback={<PageLoader />}><GameView /></Suspense>} />
                    {currentUser.isAdmin && (
                        <Route path="report" element={<Suspense fallback={<PageLoader />}><ReportView /></Suspense>} />
                    )}
                    <Route path="*" element={<Navigate to="/" replace />} />
                </Route>
            </Routes>
        </>
    );
};

export default function App() {
    return (
        <HashRouter>
            <ToastProvider>
                <DataProvider>
                    <ModalProvider>
                        <AppRoutes />
                    </ModalProvider>
                </DataProvider>
            </ToastProvider>
        </HashRouter>
    );
}