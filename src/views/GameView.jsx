import React from 'react';
import { Button } from '../components/ui/Button';
import { Card } from '../components/ui/Card';
import { Icon } from '../components/Icons';
import { useGlobalData } from '../context/DataContext';
import { useModals } from '../context/ModalContext';

export const GameView = () => {
  const { games, isAdmin, actions } = useGlobalData();
  const { openGameModal, confirm } = useModals();

  const handleDelete = (id) => {
      confirm({
          title: "刪除遊戲",
          message: "確定要刪除這個遊戲嗎？",
          onConfirm: () => actions.deleteGame(id)
      });
  };

  return (
    <div className="animate-fadeIn space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="font-bold text-slate-700 text-lg">遊戲中心</h2>
        {isAdmin && <Button variant="primary" className="text-xs px-3 py-1.5" onClick={() => openGameModal(null)} icon="Plus">新增遊戲</Button>}
      </div>

      <div className="grid grid-cols-2 gap-3">
        {games && games.length > 0 ? games.map(g => (
          <Card key={g.id} className="cursor-pointer hover:ring-2 ring-indigo-200 transition-all group relative overflow-hidden" onClick={() => window.open(g.url, '_blank')}>
            {isAdmin && (
              <div className="absolute top-1 right-1 z-10 flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity" onClick={e => e.stopPropagation()}>
                <button className="bg-white p-1 rounded-full shadow hover:bg-gray-100" onClick={() => openGameModal(g)}><Icon name="Edit2" className="w-3 h-3 text-gray-500" /></button>
                <button className="bg-white p-1 rounded-full shadow hover:bg-red-50" onClick={() => handleDelete(g.id)}><Icon name="Trash2" className="w-3 h-3 text-red-500" /></button>
              </div>
            )}
            <div className="text-center py-4">
              <div className="text-4xl mb-2 group-hover:scale-110 transition-transform">{g.icon}</div>
              <div className="font-bold text-slate-700 text-sm">{g.title}</div>
            </div>
          </Card>
        )) : <div className="col-span-2 text-center py-10 text-gray-400">目前沒有遊戲</div>}
      </div>
    </div>
  );
};