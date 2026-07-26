
import React, { useState, useEffect, useRef } from 'react';
import { MaterialItem, MATERIAL_CATEGORIES, AppSettings } from '../types';
import { Plus, Save, X, Link as LinkIcon, Calculator, RotateCcw, Box, Ruler, MapPin, Settings2 } from 'lucide-react';

// Added isOpen and renamed onCancel to onClose to match App.tsx usage.
// Updated onSave return type to allow Promise as it's used in App.tsx.
interface MaterialFormProps {
  onSave: (item: Omit<MaterialItem, 'id' | 'updatedAt'>) => void | Promise<void>;
  onClose: () => void;
  initialData?: MaterialItem | null;
  defaultCategory?: string;
  isOpen?: boolean;
  settings?: AppSettings | null;
  onUpdateCategories?: (cats: string[]) => Promise<void>;
  items?: MaterialItem[];
}

export const MaterialForm: React.FC<MaterialFormProps> = ({ onSave, onClose, initialData, defaultCategory = "鋼管類", isOpen, settings, onUpdateCategories, items = [] }) => {
  // Expanded state to include required Material fields missing in previous implementation
  const [formData, setFormData] = useState({
    category: defaultCategory,
    name: '',
    manufacturer: '',
    model: '',
    dimensions: '',
    size: '',
    quantity: '0',
    unit: '本',
    location: '',
    notes: '',
    listPrice: '',
    sellingPrice: '',
    costPrice: '',
    sourceUrl: '',
  });

  const [isCustomCategory, setIsCustomCategory] = useState(false);
  const [calcRate, setCalcRate] = useState<string>('');
  const [calcType, setCalcType] = useState<'selling_from_list' | 'selling_from_cost' | 'cost_from_list'>('selling_from_list');
  const [showCategoryManager, setShowCategoryManager] = useState(false);
  const [newCategoryInput, setNewCategoryInput] = useState('');
  // 定価編集開始時の値を保持する（掴け率スライド用）
  const prevListPriceRef = useRef<number>(0);

  useEffect(() => {
    if (initialData) {
      setFormData({
        category: initialData.category || defaultCategory,
        name: initialData.name || '',
        manufacturer: initialData.manufacturer || '',
        model: initialData.model || '',
        dimensions: initialData.dimensions || '',
        size: initialData.size || '',
        quantity: (initialData.quantity ?? 0).toString(),
        unit: initialData.unit || '本',
        location: initialData.location || '',
        notes: initialData.notes || '',
        listPrice: (initialData.listPrice ?? 0).toString(),
        sellingPrice: (initialData.sellingPrice ?? 0).toString(),
        costPrice: (initialData.costPrice ?? 0).toString(),
        sourceUrl: initialData.sourceUrl || '',
      });
      // 有効分類リストに含まれているかチェック
      const all = Array.from(new Set([...MATERIAL_CATEGORIES, ...(settings?.categories || [])]));
      setIsCustomCategory(!all.includes(initialData.category));
    } else {
      setFormData({
        category: defaultCategory,
        name: '',
        manufacturer: '',
        model: '',
        dimensions: '',
        size: '',
        quantity: '0',
        unit: '本',
        location: '',
        notes: '',
        listPrice: '',
        sellingPrice: '',
        costPrice: '',
        sourceUrl: '',
      });
      setIsCustomCategory(false);
    }
  }, [initialData, defaultCategory, isOpen]);

  const applyCalculation = () => {
    const rate = parseFloat(calcRate);
    if (isNaN(rate)) return;
    const listP = parseFloat(formData.listPrice) || 0;
    const costP = parseFloat(formData.costPrice) || 0;
    
    if (calcType === 'selling_from_list') {
      if (listP > 0) setFormData(p => ({ ...p, sellingPrice: Math.round(listP * (rate / 100)).toString() }));
    } else if (calcType === 'selling_from_cost') {
      if (costP > 0 && rate < 100) setFormData(p => ({ ...p, sellingPrice: Math.round(costP / (1 - (rate / 100))).toString() }));
    } else if (calcType === 'cost_from_list') {
      if (listP > 0) setFormData(p => ({ ...p, costPrice: Math.round(listP * (rate / 100)).toString() }));
    }
  };


  // 有効な分類リスト: MATERIAL_CATEGORIES + settings.categoriesを重複なしでマージ
  const effectiveCategories = Array.from(new Set([
    ...MATERIAL_CATEGORIES,
    ...(settings?.categories || [])
  ]));

  const handleAddCategory = async () => {
    const trimmed = newCategoryInput.trim();
    if (!trimmed) return;
    if (effectiveCategories.includes(trimmed)) { alert('その分類名は既に存在します。'); return; }
    const newCats = [...effectiveCategories, trimmed];
    await onUpdateCategories?.(newCats);
    setFormData(p => ({ ...p, category: trimmed }));
    setNewCategoryInput('');
  };

  const handleDeleteCategory = async (cat: string) => {
    // 使用中チェック
    const usedCount = items.filter(i => i.category === cat).length;
    if (usedCount > 0) {
      alert(`「${cat}」は現在${usedCount}件の資材に適用されているため削除できません。`);
      return;
    }
    if (!window.confirm(`「${cat}」を分類リストから削除しますか？`)) return;
    const newCats = effectiveCategories.filter(c => c !== cat);
    await onUpdateCategories?.(newCats);
    if (formData.category === cat) setFormData(p => ({ ...p, category: newCats[0] || '' }));
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    const currentData = {
      category: formData.category,
      name: formData.name,
      manufacturer: formData.manufacturer,
      model: formData.model,
      dimensions: formData.dimensions,
      size: formData.size,
      quantity: Number(formData.quantity) || 0,
      unit: formData.unit,
      location: formData.location,
      notes: formData.notes,
      listPrice: Number(formData.listPrice) || 0,
      sellingPrice: Number(formData.sellingPrice) || 0,
      costPrice: Number(formData.costPrice) || 0,
      sourceUrl: formData.sourceUrl,
    };

    onSave(currentData);
  };


  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-900/80 backdrop-blur-md animate-fade-in">
      <div className="bg-white p-6 rounded-[2.5rem] shadow-2xl border border-slate-200 w-full max-w-4xl max-h-[90vh] overflow-y-auto animate-in zoom-in-95 duration-200">
        <div className="flex justify-between items-center mb-6 border-b border-slate-100 pb-4 sticky top-0 bg-white z-10">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 bg-blue-100 text-blue-600 rounded-2xl flex items-center justify-center">
              {initialData ? <Save className="w-6 h-6" /> : <Plus className="w-6 h-6" />}
            </div>
            <div>
              <h2 className="text-2xl font-black text-slate-900 tracking-tight">
                {initialData ? '資材情報の更新' : '新規資材の登録'}
              </h2>
              <p className="text-xs text-slate-400 font-bold uppercase tracking-widest mt-0.5">Material Database Console</p>
            </div>
          </div>
          <button onClick={onClose} className="p-2 bg-white border border-slate-200 text-slate-400 hover:text-slate-900 rounded-xl transition-all hover:rotate-90 shadow-sm">
            <X size={24} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-2 space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="space-y-1.5">
              <label className="flex items-center gap-2 text-[10px] font-black text-slate-400 uppercase tracking-widest min-h-[20px]">資材分類
                <button type="button" onClick={() => setShowCategoryManager(v => !v)} className="ml-auto flex items-center gap-1 text-[9px] text-blue-500 hover:text-blue-700 font-black transition-colors">
                  <Settings2 size={11} />分類を管理
                </button>
              </label>
              {isCustomCategory ? (
                <div className="flex gap-2">
                  <input type="text" name="category" value={formData.category} onChange={e => setFormData(p => ({ ...p, category: e.target.value }))} placeholder="分類名を入力" required className="flex-grow px-4 py-3 bg-slate-50 border-2 border-slate-100 rounded-2xl focus:ring-0 focus:border-blue-500 focus:bg-white transition-all outline-none font-bold text-sm" />
                  <button type="button" onClick={() => setIsCustomCategory(false)} className="p-3 bg-slate-100 rounded-2xl text-slate-500 hover:bg-slate-200 transition-colors"><RotateCcw size={18} /></button>
                </div>
              ) : (
                <select name="category" value={formData.category} onChange={e => setFormData(p => ({ ...p, category: e.target.value }))} className="w-full px-4 py-3 bg-slate-50 border-2 border-slate-100 rounded-2xl focus:ring-0 focus:border-blue-500 focus:bg-white transition-all outline-none font-bold text-sm">
                  {effectiveCategories.map(cat => <option key={cat} value={cat}>{cat}</option>)}
                </select>
              )}
              {showCategoryManager && (
                <div className="mt-2 p-4 bg-blue-50 border-2 border-blue-100 rounded-2xl space-y-3 animate-in slide-in-from-top-2 duration-150">
                  <p className="text-[9px] font-black text-blue-500 uppercase tracking-widest">分類の追加・削除</p>
                  <div className="flex gap-2">
                    <input
                      type="text"
                      value={newCategoryInput}
                      onChange={e => setNewCategoryInput(e.target.value)}
                      onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); handleAddCategory(); } }}
                      placeholder="新しい分類名..."
                      className="flex-grow px-3 py-2 bg-white border-2 border-blue-100 rounded-xl text-sm font-bold outline-none focus:border-blue-400 transition-all"
                    />
                    <button type="button" onClick={handleAddCategory} className="px-4 py-2 bg-blue-600 text-white text-xs font-black rounded-xl hover:bg-blue-700 active:scale-95 transition-all whitespace-nowrap flex items-center gap-1">
                      <Plus size={13} />追加
                    </button>
                  </div>
                  <div className="max-h-48 overflow-y-auto flex flex-wrap gap-1.5 pr-1">
                    {effectiveCategories.map(cat => {
                      const usedCount = items.filter(i => i.category === cat).length;
                      return (
                        <div key={cat} className="flex items-center gap-1 bg-white border border-blue-200 rounded-lg px-2.5 py-1">
                          <span className="text-xs font-bold text-slate-700">{cat}</span>
                          {usedCount > 0 ? (
                            <span className="text-[9px] text-slate-400 font-bold ml-0.5">({usedCount})</span>
                          ) : (
                            <button type="button" onClick={() => handleDeleteCategory(cat)} className="text-slate-300 hover:text-rose-500 transition-colors ml-0.5" title="削除">
                              <X size={12} />
                            </button>
                          )}
                        </div>
                      );
                    })}
                  </div>
                  <p className="text-[9px] text-slate-400">※ 数字は適用中の資材数。使用中の分類は「×」で削除できません。</p>
                </div>
              )}
            </div>
            <div className="space-y-1.5">
              <label className="flex items-center gap-2 text-[10px] font-black text-slate-400 uppercase tracking-widest min-h-[20px]">品名 (名称)</label>
              <input type="text" name="name" required value={formData.name} onChange={e => setFormData(p => ({ ...p, name: e.target.value }))} placeholder="例: VP管、SGP白エルボ" className="w-full px-4 py-3 bg-slate-50 border-2 border-slate-100 rounded-2xl focus:ring-0 focus:border-blue-500 focus:bg-white transition-all outline-none font-bold text-sm" />
            </div>
            <div className="space-y-1.5">
              <label className="flex items-center gap-2 text-[10px] font-black text-slate-400 uppercase tracking-widest min-h-[20px]">メーカー (製造元)</label>
              <input type="text" name="manufacturer" value={formData.manufacturer} onChange={e => setFormData(p => ({ ...p, manufacturer: e.target.value }))} placeholder="例: セキスイ、クボタ" className="w-full px-4 py-3 bg-slate-50 border-2 border-slate-100 rounded-2xl focus:ring-0 focus:border-blue-500 focus:bg-white transition-all outline-none font-bold text-sm" />
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="space-y-1.5">
              <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest flex items-center gap-2 min-h-[20px]">
                <Box className="w-3 h-3" /> 型式
              </label>
              <input type="text" name="model" value={formData.model} onChange={e => setFormData(p => ({ ...p, model: e.target.value }))} placeholder="例: VP、10K、ネジ込" className="w-full px-4 py-3 bg-slate-50 border-2 border-slate-100 rounded-2xl focus:ring-0 focus:border-blue-500 focus:bg-white transition-all outline-none font-bold text-sm" />
            </div>
            <div className="space-y-1.5">
              <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest flex items-center gap-2 min-h-[20px]">
                <Ruler className="w-3 h-3" /> 寸法 (Table用)
              </label>
              <input type="text" name="dimensions" value={formData.dimensions} onChange={e => setFormData(p => ({ ...p, dimensions: e.target.value }))} placeholder="例: 50A" className="w-full px-4 py-3 bg-slate-50 border-2 border-slate-100 rounded-2xl focus:ring-0 focus:border-blue-500 focus:bg-white transition-all outline-none font-mono font-bold text-sm" />
            </div>
            <div className="space-y-1.5">
              <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest flex items-center gap-2 min-h-[20px]">
                規格 / サイズ (Card用)
              </label>
              <input type="text" name="size" value={formData.size} onChange={e => setFormData(p => ({ ...p, size: e.target.value }))} placeholder="例: L=4000mm" className="w-full px-4 py-3 bg-slate-50 border-2 border-slate-100 rounded-2xl focus:ring-0 focus:border-blue-500 focus:bg-white transition-all outline-none font-bold text-sm" />
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="space-y-1.5">
              <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest flex items-center gap-2 min-h-[20px]">在庫数 & 単位</label>
              <div className="flex items-center gap-2 h-[50px]">
                <input
                  type="number"
                  required
                  min="0"
                  className="min-w-0 flex-1 h-full px-4 py-3 bg-slate-50 border-2 border-slate-100 rounded-2xl focus:ring-0 focus:border-blue-500 focus:bg-white transition-all outline-none font-bold text-sm text-slate-900 font-mono"
                  value={formData.quantity}
                  onChange={(e) => setFormData({ ...formData, quantity: e.target.value })}
                />
                <input
                  className="w-20 shrink-0 h-full px-3 py-3 bg-slate-50 border-2 border-slate-100 rounded-2xl focus:ring-0 focus:border-blue-500 focus:bg-white transition-all outline-none font-bold text-sm text-slate-900 text-center"
                  value={formData.unit}
                  onChange={(e) => setFormData({ ...formData, unit: e.target.value })}
                  placeholder="単位"
                />
              </div>
            </div>
            <div className="space-y-1.5">
              <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest flex items-center gap-2 min-h-[20px]">
                <MapPin className="w-3 h-3" /> 保管場所
              </label>
              <input type="text" name="location" value={formData.location} onChange={e => setFormData(p => ({ ...p, location: e.target.value }))} placeholder="例: B地区 第3ラック" className="w-full px-4 py-3 bg-slate-50 border-2 border-slate-100 rounded-2xl focus:ring-0 focus:border-blue-500 focus:bg-white transition-all outline-none font-bold text-sm" />
            </div>
            <div className="space-y-1.5">
              <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest flex items-center gap-2 min-h-[20px]">備考事項</label>
              <input type="text" name="notes" value={formData.notes} onChange={e => setFormData(p => ({ ...p, notes: e.target.value }))} placeholder="特記事項など" className="w-full px-4 py-3 bg-slate-50 border-2 border-slate-100 rounded-2xl focus:ring-0 focus:border-blue-500 focus:bg-white transition-all outline-none font-bold text-sm" />
            </div>
          </div>

          <div className="bg-slate-50 p-6 rounded-[2rem] border border-slate-200 space-y-4 shadow-inner">
            <div className="flex items-center gap-2 text-[10px] font-black text-slate-400 uppercase tracking-widest border-b border-slate-200 pb-2">
              <Calculator size={14} /> 価格設定 (円)
            </div>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <div className="space-y-1.5">
                <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest">定価</label>
                <input
                  type="number"
                  name="listPrice"
                  value={formData.listPrice}
                  onFocus={() => {
                    // 編集開始時の定価を記憶しておく
                    prevListPriceRef.current = parseFloat(formData.listPrice) || 0;
                  }}
                  onChange={e => setFormData(p => ({ ...p, listPrice: e.target.value }))}
                  onBlur={() => {
                    // 定価変更時：仕入値・売値の掛け率を定価変更分だけスライド
                    const newListPrice = parseFloat(formData.listPrice) || 0;
                    const oldListPrice = prevListPriceRef.current;
                    
                    // 定価が有効な値で、かつ変更されている場合にスライド計算を行う
                    if (newListPrice > 0 && oldListPrice > 0 && newListPrice !== oldListPrice) {
                      const costValue = parseFloat(formData.costPrice) || 0;
                      const sellingValue = parseFloat(formData.sellingPrice) || 0;
                      
                      // 掛け率を計算して新定価に適用
                      const newCost = Math.round(newListPrice * (costValue / oldListPrice));
                      const newSelling = Math.round(newListPrice * (sellingValue / oldListPrice));
                      
                      setFormData(p => ({
                        ...p,
                        costPrice: newCost.toString(),
                        sellingPrice: newSelling.toString()
                      }));
                      
                      // 参考値を更新
                      prevListPriceRef.current = newListPrice;
                    }
                  }}
                  placeholder="0 (オープン)"
                  className="w-full px-4 py-3 bg-white border-2 border-slate-100 rounded-2xl font-mono font-bold text-slate-700 focus:border-blue-500 outline-none transition-all"
                />
              </div>
              <div className="space-y-1.5">
                <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest flex justify-between items-center">
                  <span>仕入値 <span className="text-red-500">*</span></span>
                  {Number(formData.listPrice) > 0 && (
                    <span className="text-[9px] font-mono text-slate-400 bg-slate-100 px-1.5 py-0.5 rounded border border-slate-200">
                      掛: {(Number(formData.costPrice) / Number(formData.listPrice) * 100).toFixed(1)}%
                    </span>
                  )}
                </label>
                <div className="flex items-center gap-2">
                  <input type="number" name="costPrice" required value={formData.costPrice} onChange={e => setFormData(p => ({ ...p, costPrice: e.target.value }))} className="flex-1 px-4 py-3 bg-white border-2 border-slate-100 rounded-2xl font-mono font-bold focus:border-blue-500 outline-none transition-all" />
                </div>
              </div>
              <div className="space-y-1.5">
                <label className="text-[10px] font-black text-blue-600 uppercase tracking-widest flex justify-between items-center">
                  <span>標準売値 <span className="text-red-500">*</span></span>
                  {Number(formData.listPrice) > 0 && (
                    <span className="text-[9px] font-mono text-blue-400 bg-blue-100/50 px-1.5 py-0.5 rounded border border-blue-200/50">
                      掛: {(Number(formData.sellingPrice) / Number(formData.listPrice) * 100).toFixed(1)}%
                    </span>
                  )}
                </label>
                <div className="flex items-center gap-2">
                  <input type="number" name="sellingPrice" required value={formData.sellingPrice} onChange={e => setFormData(p => ({ ...p, sellingPrice: e.target.value }))} className="flex-1 px-4 py-3 border-2 border-blue-200 rounded-2xl font-mono font-bold text-blue-700 bg-blue-50 focus:border-blue-500 outline-none transition-all shadow-sm" />
                </div>
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-2 bg-white p-4 rounded-2xl border border-slate-100 shadow-sm">
              <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">一括計算:</span>
              <select value={calcType} onChange={e => setCalcType(e.target.value as any)} className="text-xs font-bold border-2 border-slate-100 rounded-xl px-2 py-2 bg-slate-50 outline-none focus:border-blue-400 transition-all">
                <option value="selling_from_list">定価から売値を算出(%)</option>
                <option value="cost_from_list">定価から仕切値を算出(%)</option>
                <option value="selling_from_cost">利益率(%)から逆算</option>
              </select>
              <input type="number" value={calcRate} onChange={e => setCalcRate(e.target.value)} placeholder="%" className="w-20 border-2 border-slate-100 rounded-xl px-3 py-2 text-xs font-bold focus:border-blue-400 outline-none transition-all" />
              <button type="button" onClick={applyCalculation} className="px-6 py-2 bg-slate-900 text-white text-[10px] font-black uppercase tracking-widest rounded-xl shadow-lg active:scale-95 hover:bg-slate-800 transition-all">適用</button>

              {Number(formData.sellingPrice) > 0 && (
                <div className="ml-auto flex items-center gap-4">
                  <div className="flex flex-col items-end">
                    <span className="text-[10px] font-black text-slate-400 uppercase">想定粗利</span>
                    <span className="text-sm font-black font-mono">¥{(Number(formData.sellingPrice) - Number(formData.costPrice)).toLocaleString()}</span>
                  </div>
                  <span className={`text-[10px] font-black px-3 py-1.5 rounded-xl uppercase tracking-widest ${((Number(formData.sellingPrice) - Number(formData.costPrice)) / Number(formData.sellingPrice)) < 0.1 ? 'bg-red-50 text-red-600 border border-red-100' : 'bg-emerald-50 text-emerald-600 border border-emerald-100'}`}>
                    {((1 - (Number(formData.costPrice) / (Number(formData.sellingPrice) || 1))) * 100).toFixed(1)}%
                  </span>
                </div>
              )}
            </div>
          </div>

          <div className="space-y-1.5">
            <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest flex items-center gap-1"><LinkIcon size={12} /> 参考・メーカーURL</label>
            <input type="text" name="sourceUrl" value={formData.sourceUrl} onChange={e => setFormData(p => ({ ...p, sourceUrl: e.target.value }))} placeholder="https://..." className="w-full px-4 py-3 bg-slate-50 border-2 border-slate-100 rounded-2xl text-sm text-slate-500 font-medium focus:border-blue-500 outline-none transition-all" />
          </div>

          <div className="flex justify-end gap-4 pt-6 border-t border-slate-100">
            <button type="button" onClick={onClose} className="flex-1 px-8 py-4 bg-slate-100 hover:bg-slate-200 text-slate-600 font-black rounded-2xl transition-all uppercase tracking-widest text-xs">
              キャンセル
            </button>
            <button type="submit" className="flex-[2] flex items-center justify-center gap-3 px-8 py-4 bg-blue-600 hover:bg-blue-700 text-white font-black rounded-2xl shadow-xl shadow-blue-500/20 transition-all active:scale-95 uppercase tracking-widest text-xs">
              <Save className="w-5 h-5" />
              {initialData ? 'システム更新' : 'データベース登録'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
