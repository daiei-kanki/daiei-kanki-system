import React, { useState, useMemo } from 'react';
import { Search, X, Package, MapPin, TrendingUp, DollarSign, Layers, User, MapPinned } from 'lucide-react';
import { MaterialItem, Customer, PricingRule } from '../types';
import { normalizeForSearch, filterAndSortItems, getAppliedPrice } from '../services/searchUtils';

interface MaterialQuickSearchProps {
    items: MaterialItem[];
    customers: Customer[];
    pricingRules: PricingRule[];
    activeCustomer: string | null;
    activeSite: string | null;
    onClose: () => void;
}

export const MaterialQuickSearch: React.FC<MaterialQuickSearchProps> = ({
    items,
    customers,
    pricingRules,
    activeCustomer,
    activeSite,
    onClose
}) => {
    const [searchQuery, setSearchQuery] = useState('');
    const [selectedItem, setSelectedItem] = useState<MaterialItem | null>(null);

    // Filter items based on search
    const filteredItems = useMemo(() => {
        if (!searchQuery.trim()) return items;
        return filterAndSortItems(items, searchQuery);
    }, [items, searchQuery]);

    return (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-md z-[200] flex items-center justify-center p-4">
            <div className="bg-white rounded-3xl shadow-2xl w-full max-w-4xl h-[85vh] flex flex-col overflow-hidden animate-in zoom-in-95">
                {/* Header */}
                <div className="p-4 sm:p-6 border-b flex justify-between items-center bg-indigo-50/50">
                    <div className="flex items-center gap-3 sm:gap-4">
                        <div className="w-10 h-10 sm:w-12 sm:h-12 bg-indigo-600 text-white rounded-2xl flex items-center justify-center shadow-sm font-bold">
                            <Search size={20} className="sm:hidden" />
                            <Search size={24} className="hidden sm:block" />
                        </div>
                        <div>
                            <h2 className="text-lg sm:text-2xl font-black text-slate-900 tracking-tight">資材クイック検索</h2>
                            <p className="text-[9px] sm:text-[10px] text-slate-400 font-bold uppercase tracking-widest mt-0.5">READ-ONLY MATERIAL LOOKUP</p>
                        </div>
                    </div>
                    <button onClick={onClose} className="p-2 hover:bg-slate-100 rounded-xl transition-all">
                        <X size={24} className="sm:hidden" />
                        <X size={28} className="hidden sm:block" />
                    </button>
                </div>

                {/* Context Info */}
                {activeCustomer && (
                    <div className="px-4 sm:px-6 py-3 bg-blue-50 border-b flex flex-wrap items-center gap-2 text-xs sm:text-sm">
                        <User size={14} className="text-blue-600" />
                        <span className="font-bold text-blue-900">顧客: {activeCustomer}</span>
                        {activeSite && (
                            <>
                                <span className="text-slate-400">/</span>
                                <MapPinned size={14} className="text-blue-600" />
                                <span className="font-bold text-blue-900">現場: {activeSite}</span>
                            </>
                        )}
                        <span className="text-[10px] text-blue-600 ml-auto">※ 顧客単価が適用されています</span>
                    </div>
                )}

                {/* Search Bar */}
                <div className="p-3 sm:p-4 border-b bg-slate-50">
                    <div className="relative">
                        <Search className="absolute left-3 sm:left-4 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
                        <input
                            type="text"
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            placeholder="品名・分類・型式・メーカー・棚番号で検索..."
                            className="w-full pl-10 sm:pl-12 pr-4 py-2.5 sm:py-3 bg-white border-2 border-slate-200 rounded-2xl text-sm sm:text-base font-bold outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition-all"
                            autoFocus
                        />
                    </div>
                </div>

                {/* Results */}
                <div className="flex-1 overflow-y-auto p-3 sm:p-4 space-y-2">
                    {filteredItems.length === 0 ? (
                        <div className="text-center py-20">
                            <Package size={48} className="mx-auto text-slate-300 mb-4" />
                            <p className="text-slate-400 font-bold">
                                {searchQuery ? '該当する資材が見つかりません' : '検索キーワードを入力してください'}
                            </p>
                        </div>
                    ) : (
                        filteredItems.map((item) => {
                            const appliedPrice = getAppliedPrice(item, activeCustomer, activeSite, pricingRules);
                            const priceRate = item.listPrice > 0 ? (appliedPrice / item.listPrice) * 100 : 0;

                            return (
                                <button
                                    key={item.id}
                                    onClick={() => setSelectedItem(item)}
                                    className="w-full text-left p-3 sm:p-4 bg-white hover:bg-indigo-50 border border-slate-200 hover:border-indigo-300 rounded-2xl transition-all group"
                                >
                                    <div className="flex justify-between items-start gap-3">
                                        <div className="flex-1 min-w-0">
                                            <h4 className="font-black text-slate-900 text-sm sm:text-base truncate group-hover:text-indigo-700">{item.name}</h4>
                                            <div className="flex flex-wrap items-center gap-2 mt-1.5">
                                                <span className="text-[9px] sm:text-[10px] font-black text-slate-400 uppercase tracking-widest">{item.category}</span>
                                                {item.manufacturer && <span className="text-[9px] sm:text-[10px] text-slate-500 font-bold">{item.manufacturer}</span>}
                                                {item.location && (
                                                    <div className="flex items-center gap-0.5 px-1.5 py-0.5 bg-indigo-50 text-indigo-600 rounded text-[9px] font-black border border-indigo-100">
                                                        <MapPin size={8} />
                                                        {item.location}
                                                    </div>
                                                )}
                                            </div>
                                            {item.model && <p className="text-[10px] sm:text-xs text-slate-500 font-mono mt-1">{item.model} {item.dimensions}</p>}
                                        </div>
                                        <div className="text-right shrink-0">
                                            <div className="text-base sm:text-lg font-black text-indigo-700 font-mono">¥{appliedPrice.toLocaleString()}</div>
                                            {activeCustomer && priceRate > 0 && priceRate < 100 && (
                                                <div className="text-[9px] sm:text-[10px] text-emerald-600 font-bold">掛率: {priceRate.toFixed(1)}%</div>
                                            )}
                                            <div className="flex items-center gap-1 mt-1 justify-end">
                                                <Package size={10} className="text-slate-400" />
                                                <span className="text-[10px] sm:text-xs font-bold text-slate-600">在庫: {(item.quantity || 0).toLocaleString()} {item.unit}</span>
                                            </div>
                                        </div>
                                    </div>
                                </button>
                            );
                        })
                    )}
                </div>

                {/* Detail Modal */}
                {selectedItem && (
                    <div className="absolute inset-0 bg-slate-900/80 backdrop-blur-sm flex items-center justify-center p-4 z-10" onClick={() => setSelectedItem(null)}>
                        <div className="bg-white rounded-3xl shadow-2xl max-w-lg w-full p-6 sm:p-8" onClick={(e) => e.stopPropagation()}>
                            <div className="flex justify-between items-start mb-6">
                                <h3 className="text-xl sm:text-2xl font-black text-slate-900">{selectedItem.name}</h3>
                                <button onClick={() => setSelectedItem(null)} className="p-2 hover:bg-slate-100 rounded-xl">
                                    <X size={24} />
                                </button>
                            </div>

                            <div className="space-y-4">
                                <div className="grid grid-cols-2 gap-4">
                                    <div>
                                        <div className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">分類</div>
                                        <div className="font-bold text-slate-900">{selectedItem.category}</div>
                                    </div>
                                    <div>
                                        <div className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">メーカー</div>
                                        <div className="font-bold text-slate-900">{selectedItem.manufacturer || '-'}</div>
                                    </div>
                                    <div>
                                        <div className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">型式</div>
                                        <div className="font-bold text-slate-900 font-mono text-sm">{selectedItem.model || '-'}</div>
                                    </div>
                                    <div>
                                        <div className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">寸法</div>
                                        <div className="font-bold text-slate-900 font-mono text-sm">{selectedItem.dimensions || '-'}</div>
                                    </div>
                                </div>

                                <div className="border-t pt-4">
                                    <div className="grid grid-cols-2 gap-4">
                                        <div>
                                            <div className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">在庫数</div>
                                            <div className="text-2xl font-black text-slate-900">{(selectedItem.quantity || 0).toLocaleString()} <span className="text-sm font-bold text-slate-500">{selectedItem.unit}</span></div>
                                        </div>
                                        <div>
                                            <div className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">保管場所</div>
                                            <div className="font-black text-indigo-600 text-lg">{selectedItem.location || '未設定'}</div>
                                        </div>
                                    </div>
                                </div>

                                <div className="border-t pt-4">
                                    <div className="bg-indigo-50 rounded-2xl p-4">
                                        <div className="text-[10px] font-black text-indigo-600 uppercase tracking-widest mb-2">適用単価</div>
                                        <div className="text-3xl font-black text-indigo-700 font-mono">¥{getAppliedPrice(selectedItem, activeCustomer, activeSite, pricingRules).toLocaleString()}</div>
                                        {activeCustomer && (
                                            <div className="text-xs text-indigo-600 font-bold mt-1">※ {activeCustomer} 様向け単価</div>
                                        )}
                                    </div>
                                    <div className="grid grid-cols-2 gap-4 mt-3">
                                        <div>
                                            <div className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-1">定価</div>
                                            <div className="font-mono font-bold text-slate-600">¥{(selectedItem.listPrice || 0).toLocaleString()}</div>
                                        </div>
                                        <div>
                                            <div className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-1">仕入値</div>
                                            <div className="font-mono font-bold text-slate-600">¥{(selectedItem.costPrice || 0).toLocaleString()}</div>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
};
