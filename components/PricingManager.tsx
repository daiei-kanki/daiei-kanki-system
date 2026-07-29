
import React, { useState, useMemo } from 'react';
import { PricingRule, MaterialItem, Customer, MATERIAL_CATEGORIES } from '../types';
import { normalizeForSearch } from '../services/searchUtils';
// Fixed: Added missing Loader2 import from lucide-react
import { Plus, Trash2, X, Users, Tag, ArrowLeft, ChevronDown, ChevronRight, CheckSquare, Square, Save, UserCheck, Layers, Search, MapPin, AlertCircle, Loader2, Edit3 } from 'lucide-react';
import * as storage from '../services/firebaseService';

interface PricingManagerProps {
    rules: PricingRule[];
    customers: Customer[];
    items: MaterialItem[];
    onClose: () => void;
}

export const PricingManager = ({ rules, customers, items, onClose }: PricingManagerProps) => {
    const [view, setView] = useState<'list' | 'edit'>('list');
    const [targetCustomers, setTargetCustomers] = useState<Customer[]>([]);
    const [listSelected, setListSelected] = useState<Set<string>>(new Set<string>());
    const [newCustomerInput, setNewCustomerInput] = useState('');
    const [newCustomerEmail, setNewCustomerEmail] = useState('');
    const [newCustomerClosingDay, setNewCustomerClosingDay] = useState<number>(99);
    const [method, setMethod] = useState<'percent_of_list' | 'markup_on_cost'>('percent_of_list');
    const [value, setValue] = useState('');
    const [siteNameInput, setSiteNameInput] = useState('');
    const [checkedCategories, setCheckedCategories] = useState<Set<string>>(new Set<string>());
    const [checkedModels, setCheckedModels] = useState<Set<string>>(new Set<string>());
    const [expandedCategories, setExpandedCategories] = useState<Set<string>>(new Set<string>());
    const [modelFilterQuery, setModelFilterQuery] = useState('');
    const [isSaving, setIsSaving] = useState(false);
    const [editingSite, setEditingSite] = useState<string | null>(null);
    const [siteRenameInput, setSiteRenameInput] = useState('');

    const allCategoriesInMaster = useMemo(() => {
        const cats = new Set<string>();
        items.forEach(item => { if (item.category) cats.add(item.category); });
        // 基本カテゴリリストにないものも含めてマージし、ソートする
        return Array.from(new Set([...Array.from(cats)])).sort();
    }, [items]);

    const uniqueItemsByCategory = useMemo((): Record<string, { label: string, id: string, model: string, dimensions: string }[]> => {
        const mapping: Record<string, { label: string, id: string, model: string, dimensions: string }[]> = {};
        allCategoriesInMaster.forEach(cat => mapping[cat] = []);
        items.forEach(item => {
            const cat = item.category || "その他管";
            const label = `${item.name} ${item.model || ''} ${item.dimensions || ''} ${item.size || ''}`.trim().replace(/\s+/g, ' ');
            if (!mapping[cat]) mapping[cat] = [];
            mapping[cat].push({ label, id: item.id, model: item.model || "", dimensions: item.dimensions || "" });
        });
        Object.keys(mapping).forEach(k => mapping[k].sort((a, b) => a.label.localeCompare(b.label)));
        return mapping;
    }, [items, allCategoriesInMaster]);

    const filteredItemsByCategory = useMemo(() => {
        const mapping: Record<string, { label: string, id: string, model: string }[]> = {};
        allCategoriesInMaster.forEach(cat => {
            const list = uniqueItemsByCategory[cat] || [];
            if (!modelFilterQuery) {
                mapping[cat] = list;
            } else {
                const query = modelFilterQuery.toLowerCase();
                if (cat.toLowerCase().includes(query)) {
                    mapping[cat] = list;
                } else {
                    mapping[cat] = list.filter(m => m.label.toLowerCase().includes(query) || m.model.toLowerCase().includes(query));
                }
            }
        });
        return mapping;
    }, [uniqueItemsByCategory, modelFilterQuery, allCategoriesInMaster]);

    // 表示用：1社目のルールを表示（一括設定時も参考にできるように）
    const referenceRules = useMemo(() => {
        if (targetCustomers.length === 0) return [];
        const firstCust = targetCustomers[0];
        const normName = normalizeForSearch(firstCust.name);
        return rules.filter(r => normalizeForSearch(r.customerName) === normName);
    }, [rules, targetCustomers]);

    const existingSites = useMemo(() => {
        if (targetCustomers.length === 0) return [];
        const sites = new Set<string>();
        rules.forEach(r => {
            const normRN = normalizeForSearch(r.customerName);
            if (targetCustomers.some(c => normalizeForSearch(c.name) === normRN) && r.siteName) {
                sites.add(r.siteName);
            }
        });
        return Array.from(sites).sort();
    }, [rules, targetCustomers]);

    const groupedRulesBySite = useMemo(() => {
        const result: Record<string, Record<string, PricingRule[]>> = {};
        referenceRules.forEach(r => {
            const sKey = r.siteName || 'BASE_COMMON';
            if (!result[sKey]) result[sKey] = {};
            if (!result[sKey][r.category]) result[sKey][r.category] = [];
            result[sKey][r.category].push(r);
        });
        return result;
    }, [referenceRules]);

    const handleRegisterCustomer = async () => {
        const name = newCustomerInput.trim();
        if (!name) return;
        await storage.addCustomer({ name, closingDay: newCustomerClosingDay, email: newCustomerEmail.trim() });
        setNewCustomerInput('');
        setNewCustomerEmail('');
    };

    const handleToggleListSelection = (custId: string) => {
        const next = new Set(listSelected);
        if (next.has(custId)) next.delete(custId); else next.add(custId);
        setListSelected(next);
    };

    const handleSaveRules = async () => {
        if (!value) return alert('パーセント（値）を入力してください。');
        if (checkedCategories.size === 0 && checkedModels.size === 0) {
            return alert('設定対象のカテゴリーまたは資材を最低1つ選択してください。');
        }

        setIsSaving(true);
        try {
            const numValue = parseFloat(value);
            const site = siteNameInput.trim() || ""; // undefinedではなく空文字を明示
            const newRules: Omit<PricingRule, 'id'>[] = [];

            for (const customer of targetCustomers) {
                let siteId: string | undefined = undefined;
                if (site) {
                    const existingSite = customer.sites?.find(s => s.name === site);
                    if (existingSite) {
                        siteId = existingSite.id;
                    } else {
                        const newSite = { id: crypto.randomUUID(), name: site, createdAt: Date.now() };
                        const updatedSites = [...(customer.sites || []), newSite];
                        siteId = newSite.id;
                        await storage.updateCustomer(customer.id, { sites: updatedSites });
                    }
                }

                checkedCategories.forEach(cat => {
                    newRules.push({
                        customerId: customer.id,
                        customerName: customer.name,
                        siteId,
                        siteName: site,
                        category: cat,
                        model: 'All',
                        method,
                        value: numValue
                    });
                });
                checkedModels.forEach(mId => {
                    const item = items.find(i => i.id === mId);
                    if (item) {
                        newRules.push({
                            customerId: customer.id,
                            customerName: customer.name,
                            siteId,
                            siteName: site,
                            category: item.category,
                            model: item.model || '',
                            dimensions: item.dimensions || '',
                            materialId: item.id,
                            materialName: item.name,
                            method,
                            value: numValue
                        });
                    }
                });
            }

            await Promise.all(newRules.map(r => storage.addPricingRule(r)));

            setCheckedCategories(new Set<string>());
            setCheckedModels(new Set<string>());
            setValue(''); // 値をクリアして連続入力を防ぐ
            alert('ルールを保存しました');
        } catch (err) {
            console.error("Save Error:", err);
            alert('保存中にエラーが発生しました。現場名に特殊な文字が含まれていないか確認してください。');
        } finally {
            setIsSaving(false);
        }
    };

    const handleUpdateSiteName = async (oldName: string) => {
        const nextName = siteRenameInput.trim();
        if (!nextName || nextName === oldName) {
            setEditingSite(null);
            return;
        }

        setIsSaving(true);
        try {
            // 現在の表示対象顧客の、対象現場名のルールをすべて抽出
            const rulesToUpdate = rules.filter(r => {
                const normRN = normalizeForSearch(r.customerName);
                const isTargetCust = targetCustomers.some(c => normalizeForSearch(c.name) === normRN);
                const isTargetSite = (normalizeForSearch(r.siteName || '') === normalizeForSearch(oldName === 'BASE_COMMON' ? '' : oldName));
                return isTargetCust && isTargetSite;
            });

            await Promise.all(rulesToUpdate.map(r => 
                storage.updatePricingRule(r.id, { siteName: nextName })
            ));

            setEditingSite(null);
            setSiteRenameInput('');
        } catch (err) {
            alert('現場名の更新に失敗しました');
        } finally {
            setIsSaving(false);
        }
    };

    const handleDeleteRulesBySite = async (site: string) => {
        const siteDisplayName = site === 'BASE_COMMON' ? '共通設定 (現場指定なし)' : site;
        if (!window.confirm(`「${siteDisplayName}」に設定されている全ての単価ルールを削除してもよろしいですか？\n※この操作は取り消せません。`)) {
            return;
        }

        setIsSaving(true);
        try {
            // 現在の表示対象顧客の、対象現場名のルールをすべて抽出して削除
            const rulesToDelete = rules.filter(r => {
                const normRN = normalizeForSearch(r.customerName);
                const isTargetCust = targetCustomers.some(c => normalizeForSearch(c.name) === normRN);
                const isTargetSite = (r.siteName || 'BASE_COMMON') === site;
                return isTargetCust && isTargetSite;
            });

            await Promise.all(rulesToDelete.map(r => storage.deletePricingRule(r.id)));
        } catch (err) {
            alert('ルールの削除に失敗しました');
        } finally {
            setIsSaving(false);
        }
    };

    const [editingCustomer, setEditingCustomer] = useState<string | null>(null);
    const [editName, setEditName] = useState('');
    const [editEmail, setEditEmail] = useState('');
    const [editClosingDay, setEditClosingDay] = useState(99);

    const handleUpdateCustomer = async () => {
        if (!editingCustomer || !editName.trim()) return;
        setIsSaving(true);
        try {
            const oldCust = customers.find(c => c.id === editingCustomer);
            const nextName = editName.trim();

            await storage.updateCustomer(editingCustomer, {
                name: nextName,
                email: editEmail.trim(),
                closingDay: editClosingDay
            });

            // 顧客名が変更された場合、関連する単価ルールの顧客名も一括更新する
            if (oldCust && normalizeForSearch(oldCust.name) !== normalizeForSearch(nextName)) {
                const normOldName = normalizeForSearch(oldCust.name);
                const rulesToUpdate = rules.filter(r => normalizeForSearch(r.customerName) === normOldName);
                
                if (rulesToUpdate.length > 0) {
                    await Promise.all(rulesToUpdate.map(r => 
                        storage.updatePricingRule(r.id, { customerName: nextName })
                    ));
                }
            }

            setEditingCustomer(null);
        } catch (err) {
            alert('顧客情報の更新に失敗しました');
        } finally {
            setIsSaving(false);
        }
    };

    if (view === 'list') {
        return (
            <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm z-[110] flex items-center justify-center p-4">
                <div className="bg-white rounded-xl shadow-2xl w-full max-w-2xl overflow-hidden flex flex-col max-h-[90vh]">
                    <div className="p-6 border-b flex justify-between items-center"><h2 className="text-xl font-bold flex items-center gap-3"><Users size={24} className="text-blue-600" /> 顧客設定・単価管理</h2><button onClick={onClose}><X size={24} /></button></div>
                    <div className="p-8 bg-slate-50 flex flex-col gap-8 overflow-y-auto">
                        <div className="bg-white p-6 rounded-xl border border-blue-200">
                            <label className="block text-xs font-bold text-slate-500 uppercase mb-2">新しい顧客を登録</label>
                            <div className="flex flex-col gap-2 mb-2">
                                <div className="flex gap-2">
                                    <select value={newCustomerClosingDay} onChange={e => setNewCustomerClosingDay(parseInt(e.target.value))} className="w-1/3 px-3 py-3 border rounded-lg font-bold"><option value={99}>末日締め</option><option value={20}>20日締め</option><option value={25}>25日締め</option></select>
                                    <input type="text" value={newCustomerInput} onChange={e => setNewCustomerInput(e.target.value)} placeholder="顧客名" className="w-2/3 px-4 py-3 border rounded-lg font-bold" />
                                </div>
                                <input type="email" value={newCustomerEmail} onChange={e => setNewCustomerEmail(e.target.value)} placeholder="メールアドレス (電子帳票送信先)" className="w-full px-4 py-3 border rounded-lg font-bold" />
                            </div>
                            <button className="w-full py-3 bg-blue-600 text-white font-bold rounded-lg" onClick={handleRegisterCustomer}>登録</button>
                        </div>
                        <div className="space-y-2">
                            {(customers as Customer[]).map(cust => {
                                const isSelected = listSelected.has(cust.id);
                                const isEditing = editingCustomer === cust.id;

                                if (isEditing) {
                                    return (
                                        <div key={cust.id} className="bg-white p-4 rounded-xl border-2 border-blue-500 shadow-lg space-y-3">
                                            <div className="flex gap-2">
                                                <select value={editClosingDay} onChange={e => setEditClosingDay(parseInt(e.target.value))} className="w-1/3 px-2 py-2 border rounded-lg text-sm font-bold"><option value={99}>末日締め</option><option value={20}>20日締め</option><option value={25}>25日締め</option></select>
                                                <input type="text" value={editName} onChange={e => setEditName(e.target.value)} className="w-2/3 px-3 py-2 border rounded-lg text-sm font-bold" placeholder="顧客名" />
                                            </div>
                                            <input type="email" value={editEmail} onChange={e => setEditEmail(e.target.value)} className="w-full px-3 py-2 border rounded-lg text-sm font-bold" placeholder="メールアドレス" />
                                            <div className="flex gap-2">
                                                <button onClick={() => setEditingCustomer(null)} className="flex-1 py-2 bg-slate-100 text-slate-600 font-bold rounded-lg text-xs">キャンセル</button>
                                                <button onClick={handleUpdateCustomer} className="flex-1 py-2 bg-blue-600 text-white font-bold rounded-lg text-xs">更新を保存</button>
                                            </div>
                                        </div>
                                    );
                                }

                                return (
                                    <div key={cust.id} className={`flex items-center gap-3 p-3 rounded-lg border bg-white group ${isSelected ? 'border-blue-300 bg-blue-50' : ''}`}>
                                        <button onClick={() => handleToggleListSelection(cust.id)} className={isSelected ? 'text-blue-600' : 'text-slate-300'}>{isSelected ? <CheckSquare size={20} /> : <Square size={20} />}</button>
                                        <div onClick={() => { setTargetCustomers([cust]); setView('edit'); }} className="flex-grow flex justify-between cursor-pointer">
                                            <div className="flex flex-col">
                                                <span className="font-bold text-slate-700">{cust.name}</span>
                                                {cust.email && <span className="text-[10px] text-slate-400 font-mono">{cust.email}</span>}
                                            </div>
                                            <ChevronRight size={18} className="text-slate-300 group-hover:text-blue-500 transition-colors" />
                                        </div>
                                        <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                            <button
                                                onClick={(e) => {
                                                    e.stopPropagation();
                                                    setEditingCustomer(cust.id);
                                                    setEditName(cust.name);
                                                    setEditEmail(cust.email || '');
                                                    setEditClosingDay(cust.closingDay || 99);
                                                }}
                                                className="p-1.5 hover:bg-slate-100 rounded-lg text-slate-400 hover:text-blue-600"
                                            >
                                                <Edit3 size={16} />
                                            </button>
                                            <button onClick={(e) => { e.stopPropagation(); if (window.confirm('この顧客を削除してもよろしいですか？関連する単価ルールも削除される可能性があります。')) storage.deleteCustomer(cust.id); }} className="p-1.5 hover:bg-slate-100 rounded-lg text-slate-400 hover:text-red-500">
                                                <Trash2 size={16} />
                                            </button>
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    </div>
                    {listSelected.size > 0 && (
                        <div className="p-4 border-t bg-white flex items-center justify-between">
                            <span className="text-xs font-bold text-blue-600">{listSelected.size}社を選択中</span>
                            <button onClick={() => { setTargetCustomers(customers.filter(c => listSelected.has(c.id))); setView('edit'); }} className="px-8 py-3 bg-blue-600 text-white font-bold rounded-lg">一括設定を開始</button>
                        </div>
                    )}
                </div>
            </div>
        );
    }

    return (
        <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm z-[110] flex items-center justify-center p-4">
            <div className="bg-white rounded-xl shadow-2xl w-full max-w-6xl h-[90vh] flex flex-col overflow-hidden">
                <div className="flex justify-between items-center p-4 border-b bg-white">
                    <div className="flex items-center gap-4"><button onClick={() => setView('list')} className="flex items-center gap-1 text-slate-500 font-bold"><ArrowLeft size={20} /> 戻る</button><h2 className="text-xl font-bold">{targetCustomers.length > 1 ? `${targetCustomers.length}社を一括設定中` : targetCustomers[0].name}</h2></div>
                    <button onClick={onClose}><X size={24} /></button>
                </div>
                <div className="flex-grow flex flex-col overflow-hidden bg-slate-50">
                    <div className="p-8 space-y-4 overflow-y-auto">
                        <div className="flex justify-between items-center border-b pb-4">
                            <h3 className="font-bold text-slate-700 flex items-center gap-2"><Tag size={20} className="text-blue-500" /> 設定済みの単価ルール一覧</h3>
                            {targetCustomers.length > 1 ? (
                                <span className="text-[10px] font-black text-blue-600 bg-blue-100 px-3 py-1 rounded-full uppercase tracking-widest">{targetCustomers.length}社を同時表示中</span>
                            ) : (
                                <span className="text-xs font-bold text-slate-400">※ 単価の新規設定は、マスター管理画面の表から直接行えます</span>
                            )}
                        </div>
                        
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                            {Object.entries(groupedRulesBySite).length > 0 ? (
                                Object.entries(groupedRulesBySite).map(([site, cats]) => (
                                    <div key={site} className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden flex flex-col group">
                                        <div className="bg-slate-50 p-3 text-xs font-bold border-b flex items-center justify-between text-slate-600">
                                            <div className="flex items-center gap-2">
                                                <MapPin size={14} className="text-blue-500" />
                                                {editingSite === site ? (
                                                    <input
                                                        autoFocus
                                                        value={siteRenameInput}
                                                        onChange={e => setSiteRenameInput(e.target.value)}
                                                        className="px-2 py-1 border rounded bg-white text-xs font-bold outline-none focus:ring-2 focus:ring-blue-400"
                                                        onKeyDown={e => {
                                                            if (e.key === 'Enter') handleUpdateSiteName(site);
                                                            if (e.key === 'Escape') setEditingSite(null);
                                                        }}
                                                    />
                                                ) : (
                                                    <span>{site === 'BASE_COMMON' ? '共通設定 (現場指定なし)' : site}</span>
                                                )}
                                            </div>
                                            <div className="flex items-center gap-1">
                                                {editingSite === site ? (
                                                    <>
                                                        <button onClick={() => handleUpdateSiteName(site)} className="p-1 hover:bg-emerald-100 rounded text-emerald-600"><Save size={14} /></button>
                                                        <button onClick={() => setEditingSite(null)} className="p-1 hover:bg-slate-200 rounded text-slate-400"><X size={14} /></button>
                                                    </>
                                                ) : (
                                                    <>
                                                        {site !== 'BASE_COMMON' && (
                                                            <button 
                                                                onClick={() => {
                                                                    setEditingSite(site);
                                                                    setSiteRenameInput(site);
                                                                }}
                                                                className="p-1 hover:bg-slate-200 rounded text-slate-400 opacity-0 group-hover:opacity-100 transition-opacity"
                                                                title="現場名を変更"
                                                            >
                                                                <Edit3 size={14} />
                                                            </button>
                                                        )}
                                                        <button 
                                                            onClick={() => handleDeleteRulesBySite(site)}
                                                            className="p-1 hover:bg-red-100 rounded text-slate-400 hover:text-red-500 opacity-0 group-hover:opacity-100 transition-opacity"
                                                            title="この現場のルールを一括削除"
                                                        >
                                                            <Trash2 size={14} />
                                                        </button>
                                                    </>
                                                )}
                                            </div>
                                        </div>
                                        <div className="p-3 space-y-2 max-h-[300px] overflow-y-auto">
                                            {Object.entries(cats).map(([cat, rs]) => rs.map(r => {
                                                const item = r.materialId ? items.find(i => i.id === r.materialId) : null;
                                                const dispModel = r.model || item?.model;
                                                const dispDims = r.dimensions || item?.dimensions;
                                                const dispSize = item?.size;
                                                
                                                return (
                                                <div key={r.id} className="flex justify-between items-center text-xs p-2 bg-slate-50/50 rounded-lg border border-slate-100 group">
                                                <div className="flex flex-col min-w-0">
                                                    <div className="flex flex-wrap items-baseline gap-x-1 mb-0.5">
                                                        <span className="font-bold text-slate-700 text-sm">
                                                            {r.materialName || (r.model === 'All' ? cat : cat)}
                                                        </span>
                                                        {dispModel && dispModel !== 'All' && (
                                                            <span className="text-slate-500 font-bold text-[10px] bg-slate-100 px-1 rounded">
                                                                {dispModel}
                                                            </span>
                                                        )}
                                                        {(dispDims || dispSize) ? (
                                                            <span className="text-blue-600 font-black text-[11px] font-mono">
                                                                {dispDims} {dispDims && dispSize ? '/' : ''} {dispSize}
                                                            </span>
                                                        ) : (r.materialId && item && (
                                                            <span className="text-slate-400 font-bold text-[10px] bg-slate-100 px-1 rounded border border-slate-200">
                                                                寸法未登録
                                                            </span>
                                                        ))}
                                                        {!r.materialId && dispModel !== 'All' && dispModel && (
                                                            <span className="text-slate-500 font-medium text-[10px]">({dispModel})</span>
                                                        )}
                                                        {!item && r.materialId && (
                                                            <span className="text-rose-500 font-bold text-[10px] bg-rose-50 px-1 border border-rose-200 rounded">
                                                                ⚠ マスター未紐付
                                                            </span>
                                                        )}
                                                    </div>
                                                    {r.materialId && (
                                                        <span className="text-[9px] text-slate-400 font-bold uppercase tracking-widest leading-none">
                                                            個別指定
                                                        </span>
                                                    )}
                                                </div>
                                                    <div className="flex gap-3 items-center shrink-0">
                                                        <div className="bg-white px-2 py-0.5 rounded border border-slate-200 font-mono font-bold text-blue-600">
                                                            {r.method === 'fixed_price' ? `¥${r.value.toLocaleString()}` : 
                                                             (r.method === 'percent_of_list' ? `${r.value}% (定価)` : `${r.value}% (原価加算)`)}
                                                        </div>
                                                        <button onClick={() => storage.deletePricingRule(r.id)} className="text-slate-300 hover:text-red-500 transition-colors p-1.5 hover:bg-red-50 rounded-md">
                                                            <Trash2 size={14} />
                                                        </button>
                                                    </div>
                                                </div>
                                                );
                                            }))}
                                        </div>
                                    </div>
                                ))
                            ) : (
                                <div className="col-span-full py-32 flex flex-col items-center justify-center text-slate-300 gap-4">
                                    <div className="p-6 bg-slate-100 rounded-full">
                                        <Tag size={48} className="opacity-20" />
                                    </div>
                                    <div className="text-center">
                                        <p className="font-black uppercase tracking-[0.2em] mb-1">登録済みのルールがありません</p>
                                        <p className="text-xs font-bold text-slate-400">マスター管理画面の表から資材を選んで「ルールとして保存」してください</p>
                                    </div>
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};
