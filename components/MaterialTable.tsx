import React from 'react';
import { normalizeForSearch, getAppliedPrice, naturalCompare } from '../services/searchUtils';
import * as storage from '../services/firebaseService';
import {
    MaterialItem,
    SortConfig,
    SortField,
    PricingRule,
    Customer
} from '../types';
import {
    Edit2,
    Plus,
    ArrowUpDown,
    ArrowUp,
    ArrowDown,
    Package,
    User,
    MapPin,
    CheckSquare,
    Square,
    Trash2,
    Printer,
    Database,
    Landmark,
    Calendar,
    X,
    Save,
    RotateCcw,
    Calculator
} from 'lucide-react';

interface MaterialTableProps {
    items: MaterialItem[];
    pricingRules: PricingRule[];
    customers: Customer[];
    activeCustomer: string | null;
    activeSite: string | null;
    onCustomerChange: (name: string | null) => void;
    onSiteChange: (site: string | null) => void;
    onEdit: (item: MaterialItem) => void;
    onDelete: (id: string) => void;
    onAddToSlip: (item: MaterialItem, price: number) => void;
    sortConfig: SortConfig;
    onSort: (field: SortField) => void;
    selectedIds: Set<string>;
    onToggleSelect: (id: string) => void;
    onSelectAll: (ids: string[]) => void;
    onBulkDelete: (ids: string[]) => Promise<void>;
    onBulkUpdate: (updates: { id: string; data: Partial<MaterialItem> }[]) => Promise<void>;
    onPrint: (items: MaterialItem[]) => void;
}

export const MaterialTable: React.FC<MaterialTableProps> = ({
    items,
    pricingRules,
    customers,
    activeCustomer,
    activeSite,
    onCustomerChange,
    onSiteChange,
    onEdit,
    onAddToSlip,
    sortConfig,
    onSort,
    selectedIds,
    onToggleSelect,
    onSelectAll,
    onBulkDelete,
    onBulkUpdate,
    onPrint
}) => {
    const [filters, setFilters] = React.useState({ category: '', name: '', manufacturer: '', model: '', location: '' });
    const [deferredFilters, setDeferredFilters] = React.useState(filters);

    // 入力負荷軽減のためのデバウンス処理 (300ms)
    React.useEffect(() => {
        const timer = setTimeout(() => {
            setDeferredFilters(filters);
        }, 300);
        return () => clearTimeout(timer);
    }, [filters]);

    // 検索処理の高速化: 各アイテムの検索対象文字列を事前に保持
    const searchableItems = React.useMemo(() => {
        return items.map(item => ({
            ...item,
            _searchName: (item.name || '').toLowerCase(),
            _searchCategory: (item.category || '').toLowerCase(),
            _searchManufacturer: (item.manufacturer || '').toLowerCase(),
            _searchModel: `${item.model || ''} ${item.dimensions || ''}`.toLowerCase(),
            _searchLocation: (item.location || '').toLowerCase()
        }));
    }, [items]);

    const [showScheduled, setShowScheduled] = React.useState(false);
    const [calcRate, setCalcRate] = React.useState<string>('');
    const [calcType, setCalcType] = React.useState<'list_selling_rate' | 'list_cost_rate' | 'cost_markup' | 'cost_rate' | 'fixed'>('list_selling_rate');
    const [isProcessing, setIsProcessing] = React.useState(false);
    const [editingPriceId, setEditingPriceId] = React.useState<string | null>(null);
    const [editingListPriceId, setEditingListPriceId] = React.useState<string | null>(null);
    const [tempPrice, setTempPrice] = React.useState<string>('');
    const [tempListPrice, setTempListPrice] = React.useState<string>('');
    
    // 予告改定入力用 state
    const [editingScheduledId, setEditingScheduledId] = React.useState<string | null>(null);
    const [scheduledListPrice, setScheduledListPrice] = React.useState('');
    const [scheduledCostPrice, setScheduledCostPrice] = React.useState('');
    const [scheduledSellingPrice, setScheduledSellingPrice] = React.useState('');
    const [scheduledDate, setScheduledDate] = React.useState('');

    const handlePriceUpdate = async (item: MaterialItem, value: string) => {
        const price = parseFloat(value);
        if (isNaN(price)) return;
        if (!activeCustomer) return;
        try {
            await storage.addPricingRule({
                customerName: activeCustomer,
                siteName: activeSite || '',
                category: item.category,
                model: item.model || '',
                dimensions: item.dimensions || '',
                materialId: item.id,
                materialName: item.name,
                method: 'fixed_price',
                value: price
            });
            setEditingPriceId(null);
        } catch (e) { alert('価格の更新に失敗しました。'); }
    };

    const handleListPriceUpdate = async (item: MaterialItem, value: string) => {
        const price = parseFloat(value);
        if (isNaN(price)) return;
        try {
            await storage.updateMaterial(item.id, { listPrice: price });
            setEditingListPriceId(null);
        } catch (e) { alert('定価の更新に失敗しました。'); }
    };

    const handleScheduledUpdate = async (item: MaterialItem) => {
        const lp = parseFloat(scheduledListPrice);
        const cp = parseFloat(scheduledCostPrice);
        const sp = parseFloat(scheduledSellingPrice);
        if (isNaN(lp) || isNaN(cp) || isNaN(sp) || !scheduledDate) {
            return alert('すべての項目（定価・仕入・売価・改定日）を正しく入力してください');
        }
        try {
            await storage.updateMaterial(item.id, {
                scheduledListPrice: lp,
                scheduledCostPrice: cp,
                scheduledSellingPrice: sp,
                scheduledPriceDate: scheduledDate,
            });
            setEditingScheduledId(null);
        } catch (e) { alert('予告改定の設定に失敗しました。'); }
    };

    const handleClearScheduled = async (item: MaterialItem) => {
        if (!window.confirm(`「${item.name}」の予告改定情報を取り消しますか？`)) return;
        try {
            await storage.updateMaterial(item.id, {
                scheduledListPrice: undefined,
                scheduledCostPrice: undefined,
                scheduledSellingPrice: undefined,
                scheduledPriceDate: undefined,
            });
        } catch (e) { alert('予告改定の取り消しに失敗しました。'); }
    };

    const handleBulkCalc = async () => {
        const rate = parseFloat(calcRate);
        if (isNaN(rate)) return alert("有効な数値を入力してください");

        if (activeCustomer) {
            if (!window.confirm(`【確認】選択した${selectedIds.size}件を、${activeCustomer}の個別単価ルールとして保存しますか？`)) return;
            setIsProcessing(true);
            try {
                const newRules: Omit<PricingRule, 'id'>[] = items.filter(i => selectedIds.has(i.id)).map(item => ({
                    customerName: activeCustomer,
                    siteName: activeSite || '',
                    category: item.category,
                    model: item.model || '',
                    dimensions: item.dimensions || '',
                    materialId: item.id,
                    materialName: item.name,
                    method: calcType === 'fixed' ? 'fixed_price' : (calcType === 'cost_markup' || calcType === 'cost_rate' ? 'markup_on_cost' : 'percent_of_list'),
                    value: rate
                }));
                await Promise.all(newRules.map(r => storage.addPricingRule(r)));
                alert(`${activeCustomer}の個別単価ルールを保存しました。`);
            } catch (e) { alert("ルールの保存中にエラーが発生しました。"); }
            finally { setIsProcessing(false); }
            return;
        }

        if (!window.confirm(`【ご注意】選択した${selectedIds.size}件のマスター標準価格を上書き更新します。よろしいですか？`)) return;
        const updates = items.filter(i => selectedIds.has(i.id)).map(item => {
            let updateData: Partial<MaterialItem> = {};
            if (calcType === 'fixed') updateData.sellingPrice = rate;
            else if (calcType === 'list_selling_rate' && item.listPrice > 0) updateData.sellingPrice = Math.round(item.listPrice * (rate / 100));
            else if (calcType === 'list_cost_rate' && item.listPrice > 0) updateData.costPrice = Math.round(item.listPrice * (rate / 100));
            else if (calcType === 'cost_markup' && item.costPrice > 0) updateData.sellingPrice = Math.round(item.costPrice * (1 + (rate / 100)));
            else if (calcType === 'cost_rate' && item.costPrice > 0 && rate < 100) updateData.sellingPrice = Math.round(item.costPrice / (1 - (rate / 100)));
            return Object.keys(updateData).length > 0 ? { id: item.id, data: updateData } : null;
        }).filter(Boolean) as { id: string; data: Partial<MaterialItem> }[];

        if (updates.length > 0) {
            setIsProcessing(true);
            try { await onBulkUpdate(updates); } finally { setIsProcessing(false); }
        } else {
            alert("更新対象の資材がありません");
        }
    };

    const getPriceLabel = () => {
        if (activeCustomer) return `${activeCustomer}${(activeSite && activeSite.trim() !== '') ? ` (${activeSite})` : ''} 適用単価`;
        return "標準適用単価";
    };

    const SortIcon = ({ field, config }: { field: SortField, config: SortConfig }) => {
        if (config.field !== field) return <ArrowUpDown size={12} className="text-slate-300" />;
        return config.direction === 'asc' ? <ArrowUp size={12} /> : <ArrowDown size={12} />;
    };

    const isSearchActive = Object.values(deferredFilters).some(v => v !== '') || showScheduled;

    const filteredItems = React.useMemo(() => {
        if (!isSearchActive) return [];
        const fName = deferredFilters.name.toLowerCase();
        const fCat = deferredFilters.category.toLowerCase();
        const fMan = deferredFilters.manufacturer.toLowerCase();
        const fMod = deferredFilters.model.toLowerCase();
        const fLoc = deferredFilters.location.toLowerCase();

        return searchableItems.filter(item => {
            const baseFilter =
                (!fCat || item._searchCategory.includes(fCat)) &&
                (!fName || item._searchName.includes(fName)) &&
                (!fMan || item._searchManufacturer.includes(fMan)) &&
                (!fMod || item._searchModel.includes(fMod)) &&
                (!fLoc || item._searchLocation.includes(fLoc));
            if (!baseFilter) return false;
            if (showScheduled) return !!item.scheduledPriceDate;
            return true;
        });
    }, [searchableItems, deferredFilters, showScheduled, isSearchActive]);

    const sortedItems = React.useMemo(() => {
        const sorted = [...filteredItems];
        if (sortConfig.field) {
            sorted.sort((a, b) => {
                const compare = (field: SortField): number => {
                    if (field === 'profitMargin') {
                        const getVal = (i: MaterialItem) => {
                            const ap = getAppliedPrice(i, activeCustomer, activeSite, pricingRules);
                            return ap > 0 ? ((ap - (i.costPrice || 0)) / ap) * 100 : -999;
                        };
                        return getVal(a) - getVal(b);
                    }

                    const aVal = a[field as keyof MaterialItem] || '';
                    const bVal = b[field as keyof MaterialItem] || '';

                    if (['listPrice', 'costPrice', 'sellingPrice'].includes(field)) {
                        return Number(aVal || 0) - Number(bVal || 0);
                    }
                    return naturalCompare(String(aVal), String(bVal));
                };

                // 1. メインのソート項目
                let cmp = compare(sortConfig.field);
                if (cmp !== 0) return sortConfig.direction === 'asc' ? cmp : -cmp;

                // 2. タイブレーク：品名
                if (sortConfig.field !== 'name') {
                    cmp = naturalCompare(a.name, b.name);
                    if (cmp !== 0) return cmp;
                }

                // 3. タイブレーク：型式
                if (sortConfig.field !== 'model') {
                    cmp = naturalCompare(a.model || '', b.model || '');
                    if (cmp !== 0) return cmp;
                }

                // 4. タイブレーク：寸法
                return naturalCompare(a.dimensions || '', b.dimensions || '');
            });
        }
        return sorted;
    }, [filteredItems, sortConfig, activeCustomer, activeSite, pricingRules]);

    const allVisibleIds = sortedItems.map(i => i.id);
    const isAllSelected = allVisibleIds.length > 0 && allVisibleIds.every(id => selectedIds.has(id));

    return (
        <div className="bg-white rounded-3xl shadow-xl flex flex-col h-full border border-slate-100 overflow-hidden">
            <div className="p-4 sm:p-6 bg-slate-50/80 border-b flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                <div className="flex flex-wrap items-center gap-3">
                    <div className="bg-emerald-100 p-2.5 rounded-2xl text-emerald-600 shadow-sm"><Package size={20} /></div>
                    <div>
                        <h1 className="text-xl font-black text-slate-900 tracking-tight">資材マスター管理</h1>
                        <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest">Inventory & Pricing Control</p>
                    </div>
                    {/* ルール件数表示（以前よりシンプルな位置に） */}
                    {pricingRules.length > 0 && activeCustomer && (
                        <div className="ml-2 flex items-center gap-1.5 px-3 py-1 bg-blue-50 border border-blue-100 rounded-full">
                            <span className="w-1.5 h-1.5 rounded-full bg-blue-400 animate-pulse"></span>
                            <span className="text-[10px] font-black text-blue-600 uppercase">{activeCustomer}のルール {pricingRules.filter(r => r.customerName === activeCustomer).length}件</span>
                        </div>
                    )}
                </div>
                <div className="flex items-center gap-2 w-full sm:w-auto">
                    <button onClick={() => setShowScheduled(!showScheduled)} className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition-all shadow-sm border ${showScheduled ? 'bg-rose-500 text-white border-rose-400 ring-4 ring-rose-100' : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50'}`}>
                        <Calendar size={14} /> 予告改定 {showScheduled && <span className="ml-1 bg-white/20 px-1.5 rounded-md">ON</span>}
                    </button>
                    <div className="flex items-center gap-2 bg-white px-4 py-2 rounded-xl border border-slate-200 shadow-sm min-w-0 flex-grow sm:flex-grow-0">
                        <User size={14} className="text-slate-400 shrink-0" />
                        <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest mr-2 shrink-0">顧客:</span>
                        <select value={activeCustomer || ''} onChange={(e) => onCustomerChange(e.target.value || null)} className="bg-transparent border-none outline-none text-xs font-bold text-slate-700 flex-grow truncate min-w-0">
                            <option value="">標準単価</option>
                            {customers.map(c => <option key={c.id} value={c.name}>{c.name}</option>)}
                        </select>
                    </div>
                    {activeCustomer && (
                        <div className="flex items-center gap-2 bg-white px-4 py-2 rounded-xl border border-slate-200 shadow-sm min-w-0 flex-grow sm:flex-grow-0 animate-in fade-in duration-200">
                            <MapPin size={14} className={`shrink-0 ${activeSite ? 'text-indigo-500' : 'text-slate-400'}`} />
                            <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest mr-2 shrink-0">現場:</span>
                            <input
                                type="text"
                                list="active-site-list"
                                value={activeSite || ''}
                                onChange={(e) => onSiteChange(e.target.value || null)}
                                placeholder="全現場共通"
                                className="bg-transparent border-none outline-none text-xs font-bold text-slate-700 w-32 placeholder:text-slate-300 placeholder:font-normal"
                            />
                            <datalist id="active-site-list">
                                {Array.from(new Set(
                                    pricingRules
                                        .filter(r => r.customerName === activeCustomer && r.siteName)
                                        .map(r => r.siteName as string)
                                )).map(site => (
                                    <option key={site} value={site} />
                                ))}
                            </datalist>
                            {activeSite && (
                                <button onClick={() => onSiteChange(null)} className="text-slate-300 hover:text-slate-500 transition-colors ml-1" title="現場指定を解除">
                                    <X size={12} />
                                </button>
                            )}
                        </div>
                    )}
                </div>
            </div>

            <div className="p-3 sm:p-4 bg-white border-b flex flex-wrap items-center gap-3">
                {selectedIds.size > 0 && (
                    <div className="flex flex-wrap items-center gap-2 sm:gap-4 p-2 sm:p-3 bg-slate-900 rounded-[1.5rem] shadow-xl animate-in slide-in-from-top duration-300 w-full sm:w-auto">
                        <div className="flex items-center gap-2 px-3 border-r border-slate-700">
                            <span className="bg-blue-500 text-white text-[10px] font-black px-2 py-0.5 rounded-full">{selectedIds.size}</span>
                            <span className="text-white text-[10px] font-bold">選択中</span>
                        </div>
                        <div className="flex items-center gap-1 bg-slate-800 p-1 rounded-xl">
                            <select value={calcType} onChange={(e) => setCalcType(e.target.value as any)} className="bg-transparent text-white text-[10px] font-bold outline-none px-2 border-r border-slate-700">
                                <option value="list_selling_rate">定価の○％を売価に</option>
                                <option value="list_cost_rate">定価の○％を仕入に</option>
                                <option value="cost_markup">仕入の○％増を売価に</option>
                                <option value="cost_rate">利益率○％で売価算出</option>
                                <option value="fixed">一括指定金額(円)に</option>
                            </select>
                            <input type="number" value={calcRate} onChange={(e) => setCalcRate(e.target.value)} placeholder={calcType === 'fixed' ? "金額" : "％"} className="w-16 bg-transparent text-white text-[10px] font-black px-2 outline-none placeholder:text-slate-600" />
                            <button onClick={handleBulkCalc} className="bg-blue-500 hover:bg-blue-400 text-white px-3 py-1 rounded-lg text-[10px] font-black transition-all flex items-center gap-1 active:scale-95 shadow-lg"><Calculator size={10} /> 適用</button>
                        </div>
                        <div className="hidden sm:block h-4 w-px bg-slate-700"></div>
                        <button onClick={() => onPrint(items.filter(i => selectedIds.has(i.id)))} className="flex items-center gap-1.5 text-slate-300 hover:text-white transition-colors text-[10px] font-black"><Printer size={12} /> 印刷</button>
                        <button onClick={() => { if (window.confirm('選択分を完全に削除しますか？')) onBulkDelete(Array.from(selectedIds)); }} className="flex items-center gap-1.5 text-rose-400 hover:text-rose-300 transition-colors text-[10px] font-black"><Trash2 size={12} /> 削除</button>
                    </div>
                )}
            </div>

            <div className="flex-1 overflow-auto">
                <table className="w-full text-left border-collapse min-w-[1000px]">
                    <thead className="sticky top-0 z-20 bg-white shadow-sm border-b">
                        <tr>
                            <th className="p-4 w-12 bg-slate-50/50"><button onClick={() => onSelectAll(allVisibleIds)} className={`p-2 rounded transition-colors ${isAllSelected ? 'text-blue-600' : 'text-slate-300'}`}>{isAllSelected ? <CheckSquare size={20} /> : <Square size={20} />}</button></th>
                            <th className="p-2 w-1/4">
                                <div className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-1 cursor-pointer hover:text-blue-600" onClick={() => onSort('name')}>品名 / 分類 <SortIcon field="name" config={sortConfig} /></div>
                                <input value={filters.name} onChange={e => setFilters({ ...filters, name: e.target.value })} placeholder="品名で検索..." className="w-full px-2 py-1 text-xs border rounded bg-slate-50 focus:bg-white outline-none focus:ring-1 focus:ring-blue-400" />
                                <input value={filters.category} onChange={e => setFilters({ ...filters, category: e.target.value })} placeholder="分類..." className="w-full mt-1 px-2 py-1 text-xs border rounded bg-slate-50 focus:bg-white outline-none focus:ring-1 focus:ring-blue-400" />
                            </th>
                            <th className="p-2 w-1/4">
                                <div className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-1 cursor-pointer hover:text-blue-600" onClick={() => onSort('model')}>型式 / メーカー <SortIcon field="model" config={sortConfig} /></div>
                                <input value={filters.model} onChange={e => setFilters({ ...filters, model: e.target.value })} placeholder="型式・寸法..." className="w-full px-2 py-1 text-xs border rounded bg-slate-50 focus:bg-white outline-none focus:ring-1 focus:ring-blue-400" />
                                <div className="flex gap-1 mt-1">
                                    <input value={filters.manufacturer} onChange={e => setFilters({ ...filters, manufacturer: e.target.value })} placeholder="メーカー..." className="flex-1 px-2 py-1 text-xs border rounded bg-slate-50 focus:bg-white outline-none focus:ring-1 focus:ring-blue-400" />
                                    <input value={filters.location} onChange={e => setFilters({ ...filters, location: e.target.value })} placeholder="棚番号..." className="w-20 px-2 py-1 text-xs border rounded bg-slate-50 focus:bg-white outline-none focus:ring-1 focus:ring-blue-400 font-black text-indigo-600" />
                                </div>
                            </th>
                            <th className="p-4 text-[10px] font-black text-slate-400 text-right cursor-pointer hover:text-blue-600" onClick={() => onSort('listPrice')}><div className="flex items-center justify-end gap-1">定価 / 仕入 / 掛率 <SortIcon field="listPrice" config={sortConfig} /></div></th>
                            <th className="p-4 text-[10px] font-black text-blue-600 text-right cursor-pointer hover:text-blue-800" onClick={() => onSort('profitMargin')}><div className="flex items-center justify-end gap-1">{getPriceLabel()} / 粗利 <SortIcon field="profitMargin" config={sortConfig} /></div></th>
                            <th className="p-4 w-24"></th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-50">
                        {!isSearchActive ? (
                            <tr>
                                <td colSpan={6} className="py-40 text-center text-slate-300">
                                    <Database size={80} className="mx-auto mb-6 opacity-20" />
                                    <p className="text-sm font-black uppercase tracking-[0.2em] opacity-40 mb-2">表示負荷低減のため初期表示を制限しています</p>
                                    <p className="text-xs font-bold opacity-30">分類を選択、または品名・型式を入力して検索してください</p>
                                </td>
                            </tr>
                        ) : sortedItems.map(item => {
                            const isSelected = selectedIds.has(item.id);
                            const appliedPrice = getAppliedPrice(item, activeCustomer, activeSite, pricingRules);
                            const isIndividual = pricingRules.some(r => r.customerName === activeCustomer && r.materialId === item.id);
                            return (
                                <tr key={item.id} className={`group hover:bg-blue-50/30 transition-colors ${isSelected ? 'bg-blue-50/50' : ''}`}>
                                    <td className="p-4"><button onClick={() => onToggleSelect(item.id)} className={`p-1 rounded transition-colors ${isSelected ? 'text-blue-600' : 'text-slate-200 group-hover:text-slate-300'}`}>{isSelected ? <CheckSquare size={20} /> : <Square size={20} />}</button></td>
                                    <td className="p-2">
                                        <div className="font-bold text-slate-700">{item.name}</div>
                                        <div className="text-[10px] font-bold text-slate-400 uppercase tracking-tighter">{item.category}</div>
                                    </td>
                                    <td className="p-2">
                                        <div className="font-bold text-slate-600 text-xs font-mono">
                                            {[item.model, item.dimensions, item.size ? `規格: ${item.size}` : ''].filter(Boolean).join(' / ')}
                                        </div>
                                        <div className="flex items-center gap-2 mt-0.5">
                                            <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest">{item.manufacturer}</span>
                                            {item.location && <span className="text-[9px] font-black px-1.5 py-0.5 bg-indigo-50 text-indigo-500 rounded border border-indigo-100">{item.location}</span>}
                                        </div>
                                    </td>
                                    <td className="p-4 text-right">
                                        <div className="text-xs font-bold text-slate-400">定: ¥{item.listPrice?.toLocaleString()}</div>
                                        <div className="text-xs font-black text-slate-600 mt-0.5">仕: ¥{item.costPrice?.toLocaleString()}</div>
                                        {item.listPrice > 0 && (
                                            <div className="text-[9px] font-bold text-slate-400 mt-0.5">掛: {((appliedPrice / item.listPrice) * 100).toFixed(1)}%</div>
                                        )}
                                    </td>
                                    <td className="p-4 text-right">
                                        <div className="flex flex-col items-end">
                                            {editingPriceId === item.id ? (
                                                <div className="flex items-center gap-1 animate-in zoom-in-95 duration-150">
                                                    <span className="text-[10px] text-slate-400 font-bold mr-1">¥</span>
                                                    <input
                                                        autoFocus
                                                        type="number"
                                                        value={tempPrice}
                                                        onChange={e => setTempPrice(e.target.value)}
                                                        onKeyDown={e => {
                                                            if (e.key === 'Enter') handlePriceUpdate(item, tempPrice);
                                                            if (e.key === 'Escape') setEditingPriceId(null);
                                                        }}
                                                        onBlur={() => handlePriceUpdate(item, tempPrice)}
                                                        className="w-20 px-2 py-1 bg-white border-2 border-blue-400 rounded-lg font-black text-blue-600 outline-none shadow-lg text-sm text-right"
                                                    />
                                                </div>
                                            ) : (
                                                <div 
                                                    onClick={() => {
                                                        if (activeCustomer) {
                                                            setEditingPriceId(item.id);
                                                            setTempPrice(appliedPrice.toString());
                                                        }
                                                    }}
                                                    className={`text-sm font-black transition-all ${isIndividual ? 'text-blue-600 hover:text-blue-700' : 'text-slate-700 hover:text-blue-500'} ${activeCustomer ? 'cursor-pointer hover:scale-105' : ''}`}
                                                >
                                                    <span className="text-[10px] text-slate-400 font-bold mr-1">{activeCustomer ? '適用:' : '標準:'}</span>
                                                    ¥{appliedPrice?.toLocaleString()}
                                                    {isIndividual && <span className="ml-1 text-[8px] bg-blue-100 px-1 rounded">個別</span>}
                                                </div>
                                            )}
                                            {activeCustomer && (
                                                <div className="text-[10px] font-bold text-slate-400 mt-0.5">
                                                    (標準: ¥{item.sellingPrice?.toLocaleString()})
                                                </div>
                                            )}
                                            <div className="text-[10px] font-bold text-emerald-600 mt-1">
                                                利: ¥{(appliedPrice - (item.costPrice || 0)).toLocaleString()}
                                                <span className="ml-1 opacity-70">({appliedPrice > 0 ? (((appliedPrice - (item.costPrice || 0)) / appliedPrice) * 100).toFixed(1) : '0.0'}%)</span>
                                            </div>
                                        </div>
                                    </td>
                                    <td className="p-4"><div className="flex items-center justify-end gap-1 opacity-0 group-hover:opacity-100 transition-opacity"><button onClick={() => onEdit(item)} className="p-2 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded-xl transition-all" title="編集"><Edit2 size={16} /></button><button onClick={() => onAddToSlip(item, appliedPrice)} className="p-2 text-blue-500 hover:bg-blue-600 hover:text-white rounded-xl transition-all shadow-sm active:scale-95" title="伝票に追加"><Plus size={18} /></button></div></td>
                                </tr>
                            );
                        })}
                    </tbody>
                </table>
            </div>
        </div>
    );
};
