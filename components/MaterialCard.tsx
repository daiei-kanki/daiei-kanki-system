
import React from 'react';
import { Material } from '../types';
import { Edit2, Package, MapPin, Hash, AlertCircle, Clock } from 'lucide-react';

interface MaterialCardProps {
  material: Material;
  onEdit: (material: Material) => void;
  isAdmin: boolean;
}

const MaterialCard: React.FC<MaterialCardProps> = ({ material, onEdit, isAdmin }) => {
  const isLowStock = material.quantity < 5;

  return (
    <div className="bg-white rounded-[2rem] border border-slate-200 shadow-sm hover:shadow-xl hover:-translate-y-1 transition-all duration-300 group overflow-hidden flex flex-col h-full material-card">
      <div className="p-6 flex-1">
        <div className="flex justify-between items-start mb-4">
          <div className="flex flex-col gap-2">
            <span className="inline-flex items-center px-2.5 py-1 rounded-lg text-[10px] font-black uppercase tracking-widest bg-blue-50 text-blue-600 border border-blue-100">
              {material.category}
            </span>
            <h3 className="text-xl font-black text-slate-900 leading-tight group-hover:text-blue-600 transition-colors">
              {material.name}
            </h3>
          </div>
          {isAdmin && (
            <button 
              onClick={() => onEdit(material)}
              className="p-2.5 rounded-xl text-slate-400 hover:bg-slate-900 hover:text-white transition-all duration-200 shadow-sm hover:shadow-lg active:scale-90"
            >
              <Edit2 className="w-4 h-4" />
            </button>
          )}
        </div>

        <div className="space-y-3 mb-6">
          <div className="flex items-center gap-2 text-slate-500">
            <Hash className="w-3.5 h-3.5 text-slate-300" />
            <span className="text-xs font-bold uppercase tracking-wider">規格:</span>
            <span className="text-xs font-black text-slate-900 font-mono">{material.size}</span>
          </div>
          <div className="flex items-center gap-2 text-slate-500">
            <MapPin className="w-3.5 h-3.5 text-slate-300" />
            <span className="text-xs font-bold uppercase tracking-wider">保管:</span>
            <span className="text-xs font-black text-slate-900">{material.location}</span>
          </div>
        </div>

        <div className="flex items-end justify-between p-4 bg-slate-50 rounded-2xl border border-slate-100 group-hover:bg-blue-50/50 group-hover:border-blue-100 transition-colors">
          <div className="flex flex-col">
            <span className="text-[10px] text-slate-400 font-black uppercase tracking-widest mb-1">現在の在庫量</span>
            <div className="flex items-baseline gap-1.5">
              <span className={`text-3xl font-black font-mono leading-none ${isLowStock ? 'text-rose-600' : 'text-slate-900'}`}>
                {material.quantity}
              </span>
              <span className="text-xs font-bold text-slate-500 uppercase">{material.unit}</span>
            </div>
          </div>
          <div className="flex flex-col items-end">
             {isLowStock && (
                <div className="flex items-center gap-1 text-rose-600 bg-rose-100 px-2 py-1 rounded-lg animate-pulse">
                  <AlertCircle className="w-3 h-3" />
                  <span className="text-[10px] font-black uppercase tracking-tighter">Low Stock</span>
                </div>
             )}
             {!isLowStock && (
                <div className="flex items-center gap-1 text-emerald-600 bg-emerald-100 px-2 py-1 rounded-lg">
                  <Package className="w-3 h-3" />
                  <span className="text-[10px] font-black uppercase tracking-tighter">In Stock</span>
                </div>
             )}
          </div>
        </div>
      </div>
      
      <div className="px-6 py-4 bg-slate-50/80 border-t border-slate-100 flex justify-between items-center no-print">
        <div className="flex items-center gap-1.5 text-slate-400">
          <Clock className="w-3 h-3" />
          <span className="text-[10px] font-bold uppercase tracking-wider">
            {new Date(material.updatedAt).toLocaleDateString('ja-JP')}
          </span>
        </div>
        <div className="px-2 py-0.5 bg-white border border-slate-200 rounded-md">
          <span className="text-[9px] font-black text-slate-400 font-mono uppercase tracking-tighter">
            ID:{material.id?.slice(-6).toUpperCase()}
          </span>
        </div>
      </div>
    </div>
  );
};

export default MaterialCard;
