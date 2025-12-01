import React from 'react';
// 只引入有用到的 Icon，大幅減少打包體積 (Tree-shaking)
import { 
  Loader2, Check, X, Calendar, ChevronDown, ChevronRight, 
  Trash2, Plus, Edit2, Gamepad, Bell, Map, Trophy, User, Table, 
  ArrowDown, ArrowUp, Camera, Image, Archive, LogOut, Shield, History, 
  RefreshCw, Circle 
} from 'lucide-react';

// 建立映射表
const iconMap = {
  Loader2, Check, X, Calendar, ChevronDown, ChevronRight, 
  Trash2, Plus, Edit2, Gamepad, Bell, Map, Trophy, User, Table, 
  ArrowDown, ArrowUp, Camera, Image, Archive, LogOut, Shield, History, 
  RefreshCw, Circle
};

export const Icon = ({ name, className, ...props }) => {
  const LucideIcon = iconMap[name];

  if (!LucideIcon) {
    console.warn(`Icon "${name}" not found in iconMap, using default Circle.`);
    return <Circle className={className} {...props} />;
  }

  return <LucideIcon className={className} {...props} />;
};