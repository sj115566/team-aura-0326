import React from 'react';
import { 
  Loader2, Check, X, Calendar, ChevronDown, ChevronRight, 
  Trash2, Plus, Edit2, Gamepad, Bell, Map, Trophy, User, Table, 
  ArrowDown, ArrowUp, Camera, Image, Archive, LogOut, Shield, History, 
  RefreshCw, Circle, Copy, Smile, 
  ChevronsDown, ChevronsUp, Pin,
  Sun, Moon // 新增這兩個
} from 'lucide-react';

const iconMap = {
  Loader2, Check, X, Calendar, ChevronDown, ChevronRight, 
  Trash2, Plus, Edit2, Gamepad, Bell, Map, Trophy, User, Table, 
  ArrowDown, ArrowUp, Camera, Image, Archive, LogOut, Shield, History, 
  RefreshCw, Circle, Copy, Smile,
  ChevronsDown, ChevronsUp, Pin,
  Sun, Moon // 註冊這兩個
};

export const Icon = ({ name, className, ...props }) => {
  const LucideIcon = iconMap[name];

  if (!LucideIcon) {
    console.warn(`Icon "${name}" not found in iconMap, using default Circle.`);
    return <Circle className={className} {...props} />;
  }

  return <LucideIcon className={className} {...props} />;
};