
import React from 'react';
import { MATERIAL_CATEGORIES } from '../types';
import { 
  LayoutGrid, Droplet, Layers, CircleDot, Activity, Settings, 
  ClipboardList, Box, Wrench, Thermometer, Zap, Hammer, 
  Container, Anchor, ShieldCheck, ThermometerSnowflake, 
  Flame, HardHat, Gauge, Construction
} from 'lucide-react';

interface SidebarProps {
  activeCategory: string | 'All';
  onCategoryChange: (category: string | 'All') => void;
}

const getCategoryIcon = (category: string) => {
  if (category === 'All') return <LayoutGrid className="w-4 h-4" />;
  const n = category;
  if (n.includes('管類') || n.includes('管')) return <Droplet className="w-4 h-4" />;
  if (n.includes('継手')) return <Layers className="w-4 h-4" />;
  if (n.includes('バルブ')) return <CircleDot className="w-4 h-4" />;
  if (n.includes('金物') || n.includes('アンカー') || n.includes('ボルト')) return <Settings className="w-4 h-4" />;
  if (n.includes('部材') || n.includes('材')) {
     if (n.includes('建材') || n.includes('雑材') || n.includes('消耗品')) return <Hammer className="w-4 h-4" />;
     return <ClipboardList className="w-4 h-4" />;
  }
  if (n.includes('器具') || n.includes('機器')) return <Box className="w-4 h-4" />;
  if (n.includes('工具')) return <Wrench className="w-4 h-4" />;
  if (n.includes('保温') || n.includes('排気')) return <Thermometer className="w-4 h-4" />;
  if (n.includes('支持')) return <Anchor className="w-4 h-4" />;
  if (n.includes('シール')) return <ShieldCheck className="w-4 h-4" />;
  if (n.includes('空調')) return <ThermometerSnowflake className="w-4 h-4" />;
  if (n.includes('パッキン') || n.includes('フランジ')) return <Container className="w-4 h-4" />;
  if (n.includes('計器')) return <Gauge className="w-4 h-4" />;
  
  return <Construction className="w-4 h-4" />;
};

const Sidebar: React.FC<SidebarProps> = ({ activeCategory, onCategoryChange }) => {
  return (
    <aside className="w-full bg-white h-full border-r border-slate-200 flex flex-col z-40">
      <div className="p-6 md:p-8 border-b border-slate-100 flex items-center gap-3 shrink-0">
        <div className="w-8 h-8 md:w-10 md:h-10 bg-blue-600 rounded-lg md:rounded-xl flex items-center justify-center shadow-lg shadow-blue-200">
          <Zap className="w-5 h-5 md:w-6 md:h-6 text-white" />
        </div>
        <div className="flex flex-col">
          <h1 className="text-base md:text-lg font-black text-slate-900 tracking-tight leading-none">大栄管機</h1>
          <span className="text-[9px] md:text-[10px] text-slate-400 font-bold uppercase tracking-widest mt-1">Management Console</span>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto px-4 py-6 md:py-8 custom-scrollbar">
        <div className="px-4 mb-4 md:mb-6"><span className="text-[9px] md:text-[10px] font-black text-slate-400 uppercase tracking-widest">カテゴリー</span></div>
        <nav className="space-y-1">
          <button
            onClick={() => onCategoryChange('All')}
            className={`w-full flex items-center gap-3 px-4 py-2.5 md:py-3 rounded-xl md:rounded-2xl text-[12px] md:text-xs font-bold transition-all duration-200 ${
              activeCategory === 'All' ? 'bg-slate-900 text-white shadow-xl' : 'text-slate-500 hover:bg-slate-50'
            }`}
          >
            {getCategoryIcon('All')} 全ての資材
          </button>
          <div className="my-4 border-t border-slate-50"></div>
          {MATERIAL_CATEGORIES.map((cat) => (
            <button
              key={cat}
              onClick={() => onCategoryChange(cat)}
              className={`w-full flex items-center gap-3 px-4 py-2 md:py-2.5 rounded-lg md:rounded-xl text-[11px] md:text-[12px] font-bold transition-all duration-200 ${
                activeCategory === cat ? 'bg-blue-600 text-white shadow-lg' : 'text-slate-600 hover:bg-slate-50 hover:text-blue-600'
              }`}
            >
              <span className={activeCategory === cat ? 'text-white' : 'text-slate-400'}>{getCategoryIcon(cat)}</span>
              <span className="truncate">{cat}</span>
            </button>
          ))}
        </nav>
      </div>

      <style>{`
        .custom-scrollbar::-webkit-scrollbar { width: 4px; }
        .custom-scrollbar::-webkit-scrollbar-thumb { background: #e2e8f0; border-radius: 10px; }
      `}</style>
    </aside>
  );
};

export default Sidebar;
