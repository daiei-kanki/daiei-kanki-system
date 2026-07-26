
import React, { useState, useEffect } from 'react';
import { Material, Category, MATERIAL_CATEGORIES } from '../types';
import { X, Save, Box, Tag, Ruler, Archive, MapPin, FileText } from 'lucide-react';

interface MaterialModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (material: Partial<Material>) => void;
  editingMaterial?: Material | null;
}

// Fixed: Using MATERIAL_CATEGORIES to ensure type compatibility
const CATEGORIES: readonly Category[] = MATERIAL_CATEGORIES;

const MaterialModal: React.FC<MaterialModalProps> = ({ isOpen, onClose, onSave, editingMaterial }) => {
  const [formData, setFormData] = useState<Partial<Material>>({
    name: '',
    category: '鋼管類', // Updated default to a valid Category
    size: '',
    quantity: 0,
    unit: '本',
    location: '',
    notes: ''
  });

  useEffect(() => {
    if (editingMaterial) {
      setFormData(editingMaterial);
    } else {
      setFormData({
        name: '',
        category: '鋼管類',
        size: '',
        quantity: 0,
        unit: '本',
        location: '',
        notes: ''
      });
    }
  }, [editingMaterial, isOpen]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-900/80 backdrop-blur-md animate-fade-in">
      <div className="bg-white rounded-[2.5rem] shadow-2xl w-full max-w-2xl overflow-hidden animate-in zoom-in-95 duration-200">
        <div className="px-8 py-6 border-b border-slate-100 flex justify-between items-center bg-slate-50/50">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 bg-blue-100 text-blue-600 rounded-2xl flex items-center justify-center">
              {editingMaterial ? <FileText className="w-6 h-6" /> : <Box className="w-6 h-6" />}
            </div>
            <div>
              <h2 className="text-2xl font-black text-slate-900 tracking-tight">
                {editingMaterial ? '資材情報の更新' : '新規資材の登録'}
              </h2>
              <p className="text-xs text-slate-400 font-bold uppercase tracking-widest mt-0.5">Inventory Management Console</p>
            </div>
          </div>
          <button onClick={onClose} className="p-2 bg-white border border-slate-200 text-slate-400 hover:text-slate-900 rounded-xl transition-all hover:rotate-90">
            <X className="w-6 h-6" />
          </button>
        </div>

        <form className="p-8 space-y-6" onSubmit={(e) => {
          e.preventDefault();
          onSave(formData);
        }}>
          <div className="grid grid-cols-2 gap-6">
            <div className="col-span-2 relative">
              <label className="flex items-center gap-2 text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">
                <Tag className="w-3 h-3" /> 資材名称
              </label>
              <input
                required
                autoFocus
                className="w-full px-5 py-4 bg-slate-50 border-2 border-slate-100 rounded-2xl focus:ring-0 focus:border-blue-500 focus:bg-white transition-all outline-none font-bold text-slate-900 placeholder:text-slate-300"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                placeholder="例: 高耐圧 VP管 100A"
              />
            </div>

            <div className="space-y-2">
              <label className="flex items-center gap-2 text-[10px] font-black text-slate-400 uppercase tracking-widest">
                <Archive className="w-3 h-3" /> カテゴリー
              </label>
              <select
                className="w-full px-5 py-4 bg-slate-50 border-2 border-slate-100 rounded-2xl focus:ring-0 focus:border-blue-500 focus:bg-white transition-all outline-none font-bold text-slate-900"
                value={formData.category}
                onChange={(e) => setFormData({ ...formData, category: e.target.value as Category })}
              >
                {CATEGORIES.map(cat => <option key={cat} value={cat}>{cat}</option>)}
              </select>
            </div>

            <div className="space-y-2">
              <label className="flex items-center gap-2 text-[10px] font-black text-slate-400 uppercase tracking-widest">
                <Ruler className="w-3 h-3" /> 規格 / サイズ
              </label>
              <input
                required
                className="w-full px-5 py-4 bg-slate-50 border-2 border-slate-100 rounded-2xl focus:ring-0 focus:border-blue-500 focus:bg-white transition-all outline-none font-bold text-slate-900"
                value={formData.size}
                onChange={(e) => setFormData({ ...formData, size: e.target.value })}
                placeholder="例: L=4000mm"
              />
            </div>

            <div className="space-y-2">
              <label className="flex items-center gap-2 text-[10px] font-black text-slate-400 uppercase tracking-widest">数量</label>
              <div className="flex items-center gap-3">
                <input
                  type="number"
                  required
                  min="0"
                  className="flex-1 px-5 py-4 bg-slate-50 border-2 border-slate-100 rounded-2xl focus:ring-0 focus:border-blue-500 focus:bg-white transition-all outline-none font-black text-2xl text-slate-900 font-mono"
                  value={formData.quantity}
                  onChange={(e) => setFormData({ ...formData, quantity: parseInt(e.target.value) || 0 })}
                />
                <input
                  className="w-24 px-5 py-4 bg-slate-50 border-2 border-slate-100 rounded-2xl focus:ring-0 focus:border-blue-500 focus:bg-white transition-all outline-none font-bold text-slate-900 text-center"
                  value={formData.unit}
                  onChange={(e) => setFormData({ ...formData, unit: e.target.value })}
                  placeholder="単位"
                />
              </div>
            </div>

            <div className="space-y-2">
              <label className="flex items-center gap-2 text-[10px] font-black text-slate-400 uppercase tracking-widest">
                <MapPin className="w-3 h-3" /> 保管場所
              </label>
              <input
                className="w-full px-5 py-4 bg-slate-50 border-2 border-slate-100 rounded-2xl focus:ring-0 focus:border-blue-500 focus:bg-white transition-all outline-none font-bold text-slate-900"
                value={formData.location}
                onChange={(e) => setFormData({ ...formData, location: e.target.value })}
                placeholder="例: B地区 第3ラック"
              />
            </div>

            <div className="col-span-2 space-y-2">
              <label className="flex items-center gap-2 text-[10px] font-black text-slate-400 uppercase tracking-widest">備考事項</label>
              <textarea
                rows={2}
                className="w-full px-5 py-4 bg-slate-50 border-2 border-slate-100 rounded-2xl focus:ring-0 focus:border-blue-500 focus:bg-white transition-all outline-none font-medium text-slate-900"
                value={formData.notes}
                onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                placeholder="追加の情報を入力..."
              />
            </div>
          </div>

          <div className="pt-6 flex gap-4">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 px-8 py-4 bg-slate-100 hover:bg-slate-200 text-slate-600 font-black rounded-2xl transition-all uppercase tracking-widest text-xs"
            >
              キャンセル
            </button>
            <button
              type="submit"
              className="flex-[2] flex items-center justify-center gap-3 px-8 py-4 bg-blue-600 hover:bg-blue-700 text-white font-black rounded-2xl shadow-xl shadow-blue-500/20 transition-all active:scale-95 uppercase tracking-widest text-xs"
            >
              <Save className="w-5 h-5" />
              {editingMaterial ? 'システム更新' : 'データベース登録'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default MaterialModal;
