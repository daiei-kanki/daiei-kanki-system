
import React, { useState, useEffect, useMemo } from 'react';
import { ShoppingCart, Plus, X, Search, FileText, Printer, Trash2, Edit3, Save, CheckCircle2, Package, AlertTriangle } from 'lucide-react';
import { PurchaseOrder, MaterialItem, AppSettings, PurchaseOrderItem } from '../types';
import * as storage from '../services/firebaseService';
import { normalizeForSearch, filterAndSortItems } from '../services/searchUtils';

interface PurchaseOrderManagerProps {
    masterItems: MaterialItem[];
    settings: AppSettings | null;
    onClose: () => void;
}

export const PurchaseOrderManager: React.FC<PurchaseOrderManagerProps> = ({ masterItems, settings, onClose }) => {
    const [orders, setOrders] = useState<PurchaseOrder[]>([]);
    const [selectedOrder, setSelectedOrder] = useState<PurchaseOrder | null>(null);
    const [isEditing, setIsEditing] = useState(false);
    const [searchQuery, setSearchQuery] = useState('');
    const [previewScale, setPreviewScale] = useState(0.9);
    const [reslips, setReslips] = useState<any[]>([]);
    const [showReslipImport, setShowReslipImport] = useState(false);

    // Suggestions state
    const [suggestionIdx, setSuggestionIdx] = useState<number | null>(null);
    const [suggestionType, setSuggestionType] = useState<'name' | 'model' | 'dimensions' | null>(null);
    const [query, setQuery] = useState('');

    const suggestions = useMemo(() => {
        if (suggestionIdx === null) return [];
        return filterAndSortItems(masterItems, query).slice(0, 100);
    }, [query, masterItems, suggestionIdx]);

    const handleSelect = (idx: number, item: MaterialItem) => {
        handleUpdateItem(idx, {
            id: item.id,
            name: item.name,
            manufacturer: item.manufacturer,
            model: item.model,
            dimensions: item.dimensions,
            unit: item.unit || '個',
            listPrice: item.listPrice || 0,
            costPrice: item.costPrice || 0,
            appliedPrice: item.costPrice || 0,
            category: item.category
        });
        setSuggestionIdx(null);
        setSuggestionType(null);
        setQuery('');
    };

    useEffect(() => {
        const unsubPO = storage.subscribeToPurchaseOrders(setOrders);
        const unsubSlips = storage.subscribeToSlips((allSlips) => {
            setReslips(allSlips.filter(s => s.type === 'reslip' && !s.isHandled));
        });
        return () => { unsubPO(); unsubSlips(); };
    }, []);

    const filteredOrders = useMemo(() => {
        return orders.filter(o =>
            o.supplierName.toLowerCase().includes(searchQuery.toLowerCase()) ||
            (o.note || '').toLowerCase().includes(searchQuery.toLowerCase())
        );
    }, [orders, searchQuery]);

    const handleNewOrder = async () => {
        const newOrder: Omit<PurchaseOrder, 'id'> = {
            supplierName: '新規仕入先',
            status: 'draft',
            orderDate: new Date().toISOString().slice(0, 10),
            items: [],
            totalAmount: 0,
            taxAmount: 0,
            grandTotal: 0,
            createdAt: Date.now(),
            date: new Date().toISOString().slice(0, 10),
            customerName: '自社在庫',
            deliveryTime: 'none',
            deliveryDestination: 'none'
        };
        const id = await storage.addPurchaseOrder(newOrder);
        setSelectedOrder({ ...newOrder, id });
        setIsEditing(true);
    };

    const handleUpdateMeta = (data: Partial<PurchaseOrder>) => {
        if (!selectedOrder) return;
        setSelectedOrder({ ...selectedOrder, ...data });
    };

    const handleUpdateItem = (idx: number, data: Partial<PurchaseOrderItem>) => {
        if (!selectedOrder) return;
        const newItems = [...selectedOrder.items];

        // 行が足りない場合は空のアイテムで埋める
        while (newItems.length <= idx) {
            newItems.push({
                id: '',
                category: 'その他',
                name: '',
                model: '',
                dimensions: '',
                quantity: 0,
                unit: '個',
                location: '',
                listPrice: 0,
                sellingPrice: 0,
                costPrice: 0,
                updatedAt: Date.now(),
                appliedPrice: 0
            });
        }

        newItems[idx] = { ...newItems[idx], ...data };
        recalculate(newItems);
    };

    const handleAddItem = (item: any) => {
        if (!selectedOrder) return;
        const newItem: PurchaseOrderItem = {
            ...item,
            quantity: item.quantity || 1,
            appliedPrice: item.costPrice || 0,
            costPrice: item.costPrice || 0
        };
        const newItems = [...selectedOrder.items, newItem];
        recalculate(newItems);
    };

    const handleDeleteItem = (idx: number) => {
        if (!selectedOrder) return;
        const newItems = selectedOrder.items.filter((_, i) => i !== idx);
        recalculate(newItems);
    };

    const recalculate = (items: PurchaseOrderItem[]) => {
        const total = items.reduce((s, i) => s + ((i.costPrice || 0) * (i.quantity || 0)), 0);
        setSelectedOrder(prev => prev ? {
            ...prev,
            items,
            totalAmount: total,
            taxAmount: Math.round(total * 0.1),
            grandTotal: Math.round(total * 1.1)
        } : null);
    };

    const handleRegisterToMaster = async (idx: number, item: PurchaseOrderItem) => {
        if (!item.name) return alert('品名を入力してください');
        if (window.confirm(`${item.name} (${item.model}) を資材マスターに登録しますか？`)) {
            const materialData: Omit<MaterialItem, 'id' | 'updatedAt'> = {
                name: item.name,
                model: item.model || '',
                dimensions: item.dimensions || '',
                manufacturer: item.manufacturer || '',
                category: item.category || 'その他',
                unit: item.unit || '個',
                costPrice: item.costPrice || 0,
                listPrice: item.listPrice || 0,
                sellingPrice: item.sellingPrice || 0,
                quantity: 0, // 在庫は0で登録
                location: '',
                notes: '発注書から自動登録'
            };
            const newId = await storage.addMaterial(materialData);
            handleUpdateItem(idx, { id: newId });
            alert('資材マスターに登録しました。これで入荷時に在庫が反映されます。');
        }
    };

    const handleSave = async () => {
        if (!selectedOrder) return;
        await storage.updatePurchaseOrder(selectedOrder.id, selectedOrder);
        setIsEditing(false);
    };

    const handleReceive = async () => {
        if (!selectedOrder) return;
        if (selectedOrder.status === 'received') return alert('既に完了しています');

        const unregisteredItems = selectedOrder.items.filter(i => i.name && !i.id && i.quantity > 0);
        if (unregisteredItems.length > 0) {
            alert(`警告: ${unregisteredItems.length}件の商品がマスター未登録です。これらは在庫数に反映されません。`);
        }

        if (window.confirm('入荷完了として確定し、在庫数を自動更新しますか？')) {
            const itemsToReceive = selectedOrder.items
                .filter(i => i.id && i.quantity > 0)
                .map(i => ({ id: i.id, quantity: i.quantity }));

            if (itemsToReceive.length === 0) {
                return alert('在庫更新対象の商品がありません（全てマスター未登録、または数量0回です）');
            }

            try {
                await storage.receivePurchaseOrderItems(itemsToReceive);
                await storage.updatePurchaseOrder(selectedOrder.id, { ...selectedOrder, status: 'received' });
                setSelectedOrder({ ...selectedOrder, status: 'received' });
                alert(`${itemsToReceive.length}件の資材の在庫を更新しました。`);
            } catch (err) {
                console.error("Receive Error:", err);
                alert('在庫更新中にエラーが発生しました。');
            }
        }
    };

    return (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-md z-[150] flex items-center justify-center p-4 fixed-overlay">
            <div className="bg-white rounded-[2rem] shadow-2xl w-full max-w-7xl h-[90vh] flex flex-col overflow-hidden modal-content-wrapper">
                <div className="p-6 border-b flex justify-between items-center bg-slate-50/50 no-print">
                    <div className="flex items-center gap-4">
                        <div className="w-12 h-12 bg-emerald-100 text-emerald-600 rounded-2xl flex items-center justify-center">
                            <ShoppingCart size={24} />
                        </div>
                        <div>
                            <h2 className="text-2xl font-black text-slate-900">発注・入荷管理</h2>
                            <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest mt-0.5">PURCHASE ORDER SYSTEM</p>
                        </div>
                    </div>
                    <button onClick={onClose} className="p-2 hover:bg-slate-100 rounded-xl transition-all"><X size={28} /></button>
                </div>

                <style dangerouslySetInnerHTML={{
                    __html: `
                    @media print {
                         @page { margin: 0; size: A4; }
                         body { background: white !important; }
                         .no-print { display: none !important; }
                         .fixed-overlay { position: static !important; background: white !important; padding: 0 !important; width: auto !important; height: auto !important; overflow: visible !important; }
                         .modal-content-wrapper { position: static !important; width: 100% !important; height: auto !important; margin: 0 !important; padding: 0 !important; border: none !important; box-shadow: none !important; overflow: visible !important; }
                         .paper-content { transform: none !important; margin: 0 auto !important; padding: 15mm !important; box-shadow: none !important; position: static !important; }
                         .content-area { padding: 0 !important; background: white !important; overflow: visible !important; }
                    }
                `}} />

                <div className="flex-1 overflow-hidden flex flex-col md:flex-row">
                    {/* List */}
                    <div className="w-full md:w-1/3 border-r bg-slate-50 flex flex-col overflow-hidden no-print">
                        <div className="p-4 border-b bg-white space-y-3">
                            <button onClick={handleNewOrder} className="w-full flex items-center justify-center gap-2 bg-emerald-600 text-white py-3 rounded-2xl text-xs font-black shadow-lg">
                                <Plus size={18} /> 新規発注作成
                            </button>
                            <div className="relative">
                                <Search className="absolute left-3 top-2.5 text-slate-400" size={16} />
                                <input value={searchQuery} onChange={e => setSearchQuery(e.target.value)} placeholder="発注先・メモで検索..." className="w-full pl-10 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm font-bold outline-none" />
                            </div>
                        </div>
                        <div className="flex-1 overflow-y-auto p-4 space-y-3">
                            {filteredOrders.map(o => (
                                <div
                                    key={o.id}
                                    onClick={() => { setSelectedOrder(o); setIsEditing(false); }}
                                    className={`p-4 rounded-2xl border transition-all cursor-pointer ${selectedOrder?.id === o.id ? 'bg-emerald-50 border-emerald-300 shadow-md' : 'bg-white hover:border-emerald-200 shadow-sm'}`}
                                >
                                    <div className="flex justify-between items-start mb-2">
                                        <span className="text-[10px] font-black text-slate-400 font-mono">#{o.id.slice(-6).toUpperCase()}</span>
                                        <span className={`text-[9px] font-black px-2 py-0.5 rounded-full uppercase ${o.status === 'received' ? 'bg-blue-100 text-blue-700' :
                                            o.status === 'ordered' ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-100 text-slate-700'}`}>
                                            {o.status === 'received' ? '入荷済' : o.status === 'ordered' ? '注文済' : '下書き'}
                                        </span>
                                    </div>
                                    <h4 className="font-black text-slate-900 text-sm truncate">{o.supplierName}</h4>
                                    <div className="mt-3 flex justify-between items-end">
                                        <span className="text-[10px] text-slate-400 font-bold">{o.orderDate}</span>
                                        <span className="text-sm font-black text-emerald-600 font-mono">¥{(o.grandTotal || 0).toLocaleString()}</span>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>

                    {/* Content */}
                    <div className="flex-1 bg-slate-200/50 overflow-auto flex flex-col items-center py-8 px-4 content-area">
                        {selectedOrder ? (
                            <div className="space-y-6 w-full flex flex-col items-center">
                                {/* Top Actions */}
                                <div className="flex justify-between items-center bg-white p-4 rounded-2xl shadow-xl w-full max-w-[210mm] no-print">
                                    <div className="flex gap-2">
                                        {isEditing ? (
                                            <>
                                                <button onClick={handleSave} className="bg-emerald-600 text-white px-6 py-2 rounded-xl text-xs font-black flex items-center gap-2 shadow-lg"><Save size={18} /> 保存</button>
                                                <button onClick={() => setIsEditing(false)} className="bg-slate-100 px-6 py-2 rounded-xl text-xs font-black">キャンセル</button>
                                            </>
                                        ) : (
                                            <button onClick={() => setIsEditing(true)} className="bg-slate-900 text-white px-6 py-2 rounded-xl text-xs font-black flex items-center gap-2 shadow-lg"><Edit3 size={18} /> 編集</button>
                                        )}
                                        {selectedOrder.status !== 'received' && !isEditing && (
                                            <button onClick={handleReceive} className="bg-blue-600 text-white px-6 py-2 rounded-xl text-xs font-black flex items-center gap-2 shadow-lg hover:bg-blue-700"><CheckCircle2 size={18} /> 入荷完了処理</button>
                                        )}
                                    </div>
                                    <div className="flex gap-2 text-slate-400">
                                        <button onClick={() => { setPreviewScale(1); setTimeout(() => window.print(), 100); }} className="p-2 hover:bg-slate-100 rounded-xl"><Printer size={24} /></button>
                                        <button onClick={() => { if (window.confirm('この発注書を削除しますか？')) storage.deletePurchaseOrder(selectedOrder.id); setSelectedOrder(null); }} className="p-2 hover:bg-rose-50 text-rose-500 rounded-xl"><Trash2 size={24} /></button>
                                    </div>
                                </div>

                                {/* Paper Wrapper */}
                                <div
                                    className="bg-white shadow-2xl p-[15mm] box-border relative print:shadow-none print:p-0 flex flex-col shrink-0 paper-content"
                                    style={{ width: '210mm', minHeight: '297mm', transform: `scale(${previewScale})`, origin: 'top center' }}
                                >
                                    {/* Paper Header */}
                                    <div className="flex justify-between items-end border-b-2 border-slate-900 pb-2 mb-4">
                                        <h1 className="text-3xl font-serif font-black tracking-[0.5em]">御発注書</h1>
                                        <div className="text-right font-mono text-xs">
                                            <p className="font-bold">No. {selectedOrder.id.slice(-8).toUpperCase()}</p>
                                            <p>{selectedOrder.orderDate}</p>
                                        </div>
                                    </div>

                                    <div className="flex justify-between items-start mb-4">
                                        <div className="w-[60%] border-b-2 border-slate-900 pb-2">
                                            <div className="text-[10px] font-black text-slate-400 mb-1">仕入先御中</div>
                                            {isEditing ? (
                                                <input value={selectedOrder.supplierName} onChange={e => handleUpdateMeta({ supplierName: e.target.value })} className="w-full text-xl font-black border-none bg-slate-50 rounded px-2" />
                                            ) : (
                                                <h2 className="text-2xl font-black underline underline-offset-4">{selectedOrder.supplierName} 御中</h2>
                                            )}
                                        </div>
                                        <div className="w-[35%] text-right text-[10px]">
                                            <h3 className="text-sm font-bold mb-1">{settings?.companyName}</h3>
                                            <p>〒{settings?.postalCode} {settings?.address}</p>
                                            <p className="mt-1 font-bold text-slate-600">TEL: {settings?.phone} / FAX: {settings?.fax}</p>
                                            <p className="font-black mt-1">登録番号: {settings?.invoiceNumber}</p>
                                        </div>
                                    </div>

                                    <div className="mb-6 bg-slate-50 p-4 border-2 border-slate-900 flex justify-between items-center shadow-sm">
                                        <div>
                                            <span className="text-xs font-black text-slate-500 uppercase tracking-widest mr-4">御発注金額合計 (税込)</span>
                                            <span className="text-4xl font-mono font-black text-slate-900">¥{(selectedOrder.grandTotal || 0).toLocaleString()}-</span>
                                        </div>
                                        <div className="text-right text-[10px] font-bold text-slate-500">
                                            税抜合計: ¥{(selectedOrder.totalAmount || 0).toLocaleString()}<br />
                                            消費税(10%): ¥{(selectedOrder.taxAmount || 0).toLocaleString()}
                                        </div>
                                    </div>

                                    {/* Table */}
                                    <table className="w-full border-collapse table-fixed text-[10px] border-2 border-slate-900">
                                        <thead>
                                            <tr className="bg-slate-100 border-b-2 border-slate-900">
                                                <th className="py-1 px-1 w-[5%] border-r border-slate-900 text-center">No</th>
                                                <th className="py-1 px-2 text-left border-r border-slate-900 w-[40%]">品名 / メーカー</th>
                                                <th className="py-1 px-2 text-left border-r border-slate-900 w-[25%]">型式 / 寸法</th>
                                                <th className="py-1 px-2 text-right w-[10%] border-r border-slate-900">数量</th>
                                                <th className="py-1 px-2 text-right w-[10%] border-r border-slate-900">単価</th>
                                                <th className="py-1 px-2 text-right w-[10%]">金額</th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {Array.from({ length: 16 }).map((_, idx) => {
                                                const item = selectedOrder.items[idx];
                                                const amount = item ? ((item.costPrice || 0) * (item.quantity || 0)) : 0;
                                                return (
                                                    <tr key={idx} className={`${idx === 15 ? '' : 'border-b'} h-[10mm] border-slate-200 relative ${suggestionIdx === idx ? 'z-[100]' : ''}`}>
                                                        <td className="text-center border-r border-slate-900">{idx + 1}</td>
                                                        <td className={`px-2 border-r border-slate-900 font-bold relative group/cell ${suggestionIdx === idx ? 'z-[100]' : ''}`}>
                                                            {isEditing ? (
                                                                <div className="flex flex-col relative">
                                                                    <div className="flex items-center gap-1">
                                                                        <input
                                                                            value={item?.name || ''}
                                                                            onChange={e => { handleUpdateItem(idx, { name: e.target.value }); setQuery(e.target.value); }}
                                                                            onFocus={e => { setSuggestionIdx(idx); setSuggestionType('name'); setQuery(e.target.value); }}
                                                                            className="w-full bg-transparent border-none text-[11px] font-bold outline-none"
                                                                            placeholder="品名を入力..."
                                                                        />
                                                                        {item?.name && !item.id && (
                                                                            <button
                                                                                onClick={() => handleRegisterToMaster(idx, item)}
                                                                                title="マスターへ登録"
                                                                                className="no-print p-1 bg-emerald-100 text-emerald-700 rounded-md hover:bg-emerald-200 transition-colors"
                                                                            >
                                                                                <Plus size={10} strokeWidth={3} />
                                                                            </button>
                                                                        )}
                                                                    </div>
                                                                    {item?.manufacturer && <div className="text-[7px] text-slate-400 font-normal truncate leading-none mt-0.5">{item.manufacturer}</div>}
                                                                    {suggestionIdx === idx && suggestions.length > 0 && (
                                                                        <div className="absolute top-[80%] left-0 z-[300] bg-white border-2 border-emerald-500 rounded-xl shadow-2xl w-96 max-h-64 overflow-auto mt-1 no-print">
                                                                            {suggestions.map((s, i) => (
                                                                                <div key={i} onClick={() => handleSelect(idx, s)} className="px-3 py-2 hover:bg-emerald-50 cursor-pointer border-b last:border-b-0">
                                                                                    <div className="font-black text-[12px] text-slate-800">{s.name}</div>
                                                                                    <div className="text-[10px] text-slate-500 font-mono mt-0.5">{s.manufacturer} / {s.model} {s.dimensions}</div>
                                                                                </div>
                                                                            ))}
                                                                        </div>
                                                                    )}
                                                                </div>
                                                            ) : (
                                                                <div>
                                                                    <div>{item?.name || ''}</div>
                                                                    {item?.manufacturer && <div className="text-[8px] text-slate-500 font-normal leading-tight">{item.manufacturer}</div>}
                                                                </div>
                                                            )}
                                                        </td>
                                                        <td className={`px-2 border-r border-slate-900 ${suggestionIdx === idx ? 'z-[100]' : ''}`}>
                                                            {isEditing ? (
                                                                <div className="flex flex-col relative">
                                                                    <input
                                                                        value={item?.model || ''}
                                                                        onChange={e => { handleUpdateItem(idx, { model: e.target.value }); setQuery(e.target.value); }}
                                                                        onFocus={e => { setSuggestionIdx(idx); setSuggestionType('model'); setQuery(e.target.value); }}
                                                                        className="w-full bg-transparent border-none text-[9px] outline-none"
                                                                        placeholder="型式"
                                                                    />
                                                                    <input
                                                                        value={item?.dimensions || ''}
                                                                        onChange={e => { handleUpdateItem(idx, { dimensions: e.target.value }); setQuery(e.target.value); }}
                                                                        onFocus={e => { setSuggestionIdx(idx); setSuggestionType('dimensions'); setQuery(e.target.value); }}
                                                                        className="w-full bg-transparent border-none text-[9px] outline-none"
                                                                        placeholder="寸法"
                                                                    />
                                                                </div>
                                                            ) : (
                                                                item ? `${item.model || ''} ${item.dimensions || ''}` : ''
                                                            )}
                                                        </td>
                                                        <td className="px-2 text-right border-r border-slate-900 font-mono">
                                                            {isEditing ? (
                                                                <input type="number" value={item?.quantity || ''} onChange={e => handleUpdateItem(idx, { quantity: parseFloat(e.target.value) })} className="w-full text-right bg-transparent border-none" />
                                                            ) : (
                                                                item?.quantity?.toLocaleString()
                                                            )}
                                                        </td>
                                                        <td className="px-2 text-right border-r border-slate-900 font-mono">
                                                            {isEditing ? (
                                                                <input type="number" value={item?.costPrice || ''} onChange={e => handleUpdateItem(idx, { costPrice: parseFloat(e.target.value) })} className="w-full text-right bg-transparent border-none" />
                                                            ) : (
                                                                item ? `¥${(item.costPrice || 0).toLocaleString()}` : ''
                                                            )}
                                                        </td>
                                                        <td className="px-2 text-right font-mono font-bold">
                                                            {item ? `¥${amount.toLocaleString()}` : ''}
                                                        </td>
                                                    </tr>
                                                );
                                            })}
                                        </tbody>
                                    </table>

                                    <div className="mt-auto pt-6 flex justify-between items-end gap-4">
                                        <div className="flex-grow">
                                            <div className="text-[9px] text-slate-500 font-bold p-3 border rounded bg-slate-50 min-h-[80px]">
                                                <div className="uppercase tracking-widest text-slate-400 mb-1 font-black">備考・特記事項</div>
                                                {isEditing ? (
                                                    <textarea value={selectedOrder.note || ''} onChange={e => handleUpdateMeta({ note: e.target.value })} className="w-full h-12 bg-transparent border-none text-[10px]" />
                                                ) : (
                                                    <div className="whitespace-pre-wrap">{selectedOrder.note}</div>
                                                )}
                                            </div>
                                        </div>
                                        <div className="w-48 text-right text-[8px] font-bold text-slate-400 font-mono">
                                            Generated by Piping Materials Manager Pro<br />
                                            Original ID: {selectedOrder.id}
                                        </div>
                                    </div>
                                </div>

                                {/* Helpers (Visible only in edit mode) */}
                                {isEditing && (
                                    <div className="w-full max-w-[210mm] mt-4 space-y-4 no-print">
                                        <div className="bg-white p-6 rounded-3xl shadow-xl border border-slate-200">
                                            <div className="flex items-center justify-between mb-4">
                                                <h3 className="text-sm font-black flex items-center gap-2"><Package size={16} /> 資材を追加</h3>
                                                <button
                                                    onClick={() => setShowReslipImport(true)}
                                                    className="flex items-center gap-2 bg-rose-500 text-white px-4 py-2 rounded-xl text-[10px] font-black hover:bg-rose-600 transition-all shadow-md active:scale-95"
                                                >
                                                    <AlertTriangle size={14} /> 欠品・未納リストから引用 ({reslips.length})
                                                </button>
                                            </div>
                                            <div className="grid grid-cols-2 lg:grid-cols-4 gap-2">
                                                {masterItems.slice(0, 12).map(mi => (
                                                    <button
                                                        key={mi.id}
                                                        onClick={() => handleAddItem(mi)}
                                                        className="text-left p-2.5 bg-slate-50 border border-slate-200 rounded-xl hover:border-emerald-500 hover:bg-white transition-all group"
                                                    >
                                                        <div className="font-bold text-[10px] truncate group-hover:text-emerald-600 tracking-tighter">{mi.name}</div>
                                                        <div className="text-slate-400 text-[8px] font-mono truncate">{mi.model} / ¥{(mi.costPrice || 0).toLocaleString()}</div>
                                                    </button>
                                                ))}
                                            </div>
                                            <p className="mt-3 text-[9px] text-slate-400 font-bold text-center italic">※検索バー等のフル機能は資材マスター画面にてご利用ください</p>
                                        </div>
                                    </div>
                                )}
                            </div>
                        ) : (
                            <div className="flex-1 flex flex-col items-center justify-center text-slate-300">
                                <FileText size={100} strokeWidth={1} />
                                <p className="mt-4 font-black uppercase tracking-[0.4em] text-sm">Select or Create Purchase Order</p>
                            </div>
                        )}
                    </div>
                </div>
            </div>

            {/* Reslip Import Modal */}
            {showReslipImport && (
                <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm z-[200] flex items-center justify-center p-4">
                    <div className="bg-white rounded-3xl shadow-2xl w-full max-w-2xl max-h-[80vh] flex flex-col overflow-hidden animate-in zoom-in-95">
                        <div className="p-4 border-b flex justify-between items-center bg-rose-50">
                            <h3 className="font-black text-rose-700 flex items-center gap-2"><AlertTriangle size={18} /> 欠品未納資材の引用</h3>
                            <button onClick={() => setShowReslipImport(false)} className="p-1 hover:bg-rose-100 rounded-lg"><X size={20} /></button>
                        </div>
                        <div className="flex-1 overflow-y-auto p-4 space-y-4">
                            {reslips.length === 0 ? (
                                <div className="py-20 text-center text-slate-300 font-bold uppercase tracking-widest text-xs">現在、未納資材はありません</div>
                            ) : (
                                reslips.map(slip => (
                                    <div key={slip.id} className="border border-slate-200 rounded-2xl overflow-hidden shadow-sm">
                                        <div className="bg-slate-50 px-4 py-2 text-[10px] font-black flex justify-between border-b text-slate-500">
                                            <span>伝票: {slip.slipNumber} <span className="mx-2">|</span> {slip.customerName} 様</span>
                                            <div className="flex items-center gap-3">
                                                <span>{slip.date}</span>
                                                <button
                                                    onClick={() => { if (window.confirm('この欠品伝票を処理済みとしてリストから外しますか？')) storage.markSlipAsHandled(slip.id); }}
                                                    className="text-rose-600 hover:text-rose-800 font-black hover:underline px-2 py-0.5 rounded transition-all"
                                                >
                                                    処理完了として隠す
                                                </button>
                                            </div>
                                        </div>
                                        <div className="p-2 divide-y">
                                            {slip.items.map((item: any, i: number) => (
                                                <div key={i} className="flex justify-between items-center py-3 px-2 hover:bg-slate-50 transition-colors group">
                                                    <div className="flex flex-col">
                                                        <span className="text-[11px] font-bold text-slate-700">{item.name}</span>
                                                        <span className="text-[9px] text-slate-400">{item.model} {item.dimensions}</span>
                                                    </div>
                                                    <div className="flex items-center gap-4">
                                                        <div className="text-right">
                                                            <div className="text-[11px] font-black text-rose-600">未納数: {item.quantity} {item.unit}</div>
                                                            <div className="text-[8px] text-slate-400 font-mono">原価: ¥{(item.costPrice || 0).toLocaleString()}</div>
                                                        </div>
                                                        <button
                                                            onClick={() => {
                                                                handleAddItem({ ...item });
                                                                alert(`${item.name} を追加しました`);
                                                            }}
                                                            className="bg-emerald-600 text-white p-2 rounded-xl shadow-md hover:bg-emerald-700 transition-all active:scale-95"
                                                        >
                                                            <Plus size={16} />
                                                        </button>
                                                    </div>
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                ))
                            )}
                        </div>
                        <div className="p-4 border-t bg-slate-50 text-right">
                            <button onClick={() => setShowReslipImport(false)} className="px-8 py-3 bg-slate-900 text-white rounded-2xl text-xs font-black shadow-lg">閉じる</button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};
