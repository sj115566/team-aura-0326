import React from 'react';
import { Card } from '../components/ui/Card';

export const LeaderboardView = ({ users, currentUser }) => (
  <div className="animate-fadeIn space-y-4">
    <Card noPadding>
      <div className="bg-slate-50 p-3 text-xs font-bold text-gray-400 border-b border-gray-100 flex justify-between px-4">
        <span>RANK / NAME</span>
        <span>POINTS</span>
      </div>
      {users.map((u, index) => {
        // 因為 users 已經在外面 sort 過了，這裡直接用 index + 1
        const rank = index + 1;
        // 檢查是否為自己，給予高亮背景
        const isMe = u.uid === currentUser.uid;
        
        return (
          <div 
            key={u.uid} 
            className={`p-4 flex items-center justify-between border-b border-gray-50 last:border-0 ${isMe ? 'bg-indigo-50/50' : ''}`}
          >
            <div className="flex items-center gap-4">
              <div className={`font-black w-6 text-center ${rank <= 3 ? 'text-yellow-500 text-lg' : 'text-gray-300'}`}>{rank}</div>
              <div className="font-bold text-slate-700 break-all">{u.uid}</div>
            </div>
            <div className="font-mono font-bold text-slate-800">{u.points}</div>
          </div>
        );
      })}
    </Card>
  </div>
);