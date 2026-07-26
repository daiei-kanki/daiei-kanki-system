import React, { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import ReactDOM from 'react-dom';
import { Estimate, EstimateStatus, Customer, MaterialItem, SlipItem, AppSettings } from '../types';
import { X, Printer, Search, FileText, Trash2, CheckCircle2, XCircle, Clock, ChevronRight, Loader2, Calendar, User, MapPin, Edit3, Plus, Minus, Save, RotateCcw, Camera, Sparkles, ShoppingCart, Mail, GripVertical } from 'lucide-react';
import * as storage from '../services/firebaseService';
import { parseOrderMemo } from '../services/geminiService';
import { normalizeForSearch, filterAndSortItems } from '../services/searchUtils';
import { DragDropContext, Droppable, Draggable, DropResult } from '@hello-pangea/dnd';

const DEFAULT_COMPANY_INFO: AppSettings = {
  companyName: "大栄管機株式会社",
  postalCode: "〒080-0048",
  address: "北海道帯広市西18条北1丁目1-14",
  phone: "0155-35-6815",
  fax: "0155-36-2661",
  email: "daieikanki@f1.octv.ne.jp",
  invoiceNumber: "T8460101000829",
  categories: [],
  banks: [
    { bankName: "帯広信用金庫", branchName: "西支店", accountType: "当座", accountNumber: "005322", accountHolder: "大栄管機(株)" },
  ]
};

const generateId = () => {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) return crypto.randomUUID();
  return Math.random().toString(36).substring(2, 11) + Date.now().toString(36);
};

interface EstimateManagerProps {
  onClose: () => void;
  onConvertToSlip?: (items: SlipItem[], customer: string, site?: string) => void;
  masterItems: MaterialItem[];
  settings: AppSettings | null;
  customers: Customer[];
}

// Cover Page Component (Page 1)
const EstimateCoverPage = ({ estimate, isEditing, onUpdateMeta, pageTotals, settings }: {
  estimate: Estimate,
  isEditing: boolean,
  onUpdateMeta: (data: Partial<Estimate>) => void,
  pageTotals: { page: number; total: number }[],
  settings: AppSettings | null
}) => {
  const info = settings || DEFAULT_COMPANY_INFO;
  return (
    <div className="bg-white p-10 print:p-[15mm] text-slate-900 flex flex-col justify-between h-full w-full box-border min-h-[280mm]">
      <div className="w-full">
        <div className="flex justify-between items-end border-b-4 border-slate-900 pb-2 mb-6 print:mb-2 print:pb-1">
          <h1 className="text-3xl font-serif font-bold tracking-[0.5em]">御見積書</h1>
          <div className="text-right text-xs font-mono">
            <p>No. {estimate.slipNumber || 'EST-PENDING'}</p>
            <div className="flex items-center justify-end gap-1">
              <span>日付:</span>
              {isEditing ? (
                <input type="date" value={estimate.date} onChange={e => onUpdateMeta({ date: e.target.value })} className="border rounded px-1" />
              ) : (
                <span>{estimate.date}</span>
              )}
            </div>
            <div className="flex items-center justify-end gap-1 text-blue-600 font-bold">
              <span>有効期限:</span>
              {isEditing ? (
                <input type="date" value={estimate.validUntil} onChange={e => onUpdateMeta({ validUntil: e.target.value })} className="border rounded px-1" />
              ) : (
                <span>{estimate.validUntil}</span>
              )}
            </div>
          </div>
        </div>

        <div className="flex justify-between mb-6 items-start print:mb-2">
          <div className="w-[60%]">
            <div className="flex items-center gap-2 mb-4">
              {isEditing ? (
                <input type="text" value={estimate.customerName} onChange={e => onUpdateMeta({ customerName: e.target.value })} className="text-2xl font-bold border-b-2 border-slate-300 focus:border-blue-500 outline-none w-full" placeholder="顧客名を入力" />
              ) : (
                <h2 className="text-2xl font-bold underline underline-offset-8 decoration-slate-300">{estimate.customerName} 御中</h2>
              )}
            </div>
            <div className="flex items-center gap-2 mb-2">
              <span className="bg-slate-800 text-white text-[10px] px-2 py-0.5 rounded font-bold uppercase tracking-wider shrink-0">現場</span>
              {isEditing ? (
                <input type="text" value={estimate.constructionName || ''} onChange={e => onUpdateMeta({ constructionName: e.target.value })} className="text-lg font-bold border-b border-slate-200 outline-none w-full" placeholder="現場名を入力" />
              ) : (
                <span className="text-lg font-bold">{estimate.constructionName || '一般・共通'}</span>
              )}
            </div>
            <p className="text-[10px] mt-4 text-slate-500 font-bold tracking-tight border-l-4 border-slate-200 pl-3 leading-relaxed">下記の通り、御見積り申し上げます。（表示価格は全て税抜です）</p>
          </div>
          <div className="w-[40%] text-right text-[10px] flex flex-col items-end gap-3">
            <div className="text-right leading-relaxed">
              <h3 className="text-sm font-bold mb-1">{info.companyName}</h3>
              <p>{info.postalCode} {info.address}</p>
              <p className="mt-1 font-bold">TEL: {info.phone}</p>
              <div className="flex justify-end gap-1 mt-1 font-bold">
                <span>担当:</span>
                {isEditing ? (
                  <input type="text" value={estimate.receivingPerson || ''} onChange={e => onUpdateMeta({ receivingPerson: e.target.value })} className="border rounded px-1 w-24" placeholder="担当者" />
                ) : (
                  <span>{estimate.receivingPerson || '本部'}</span>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Page Totals Summary Table */}
        <table className="w-full border-collapse table-fixed text-[10px] border-2 border-slate-900 mb-4" style={{ marginBottom: '8px' }}>
          <thead>
            <tr className="bg-slate-100 border-y-2 border-slate-900">
              <th className="py-2 px-3 text-left border-r w-[70%]">ページ</th>
              <th className="py-2 px-3 text-right w-[30%]">金額 (税抜)</th>
            </tr>
          </thead>
          <tbody>
            {pageTotals.map((pt, idx) => (
              <tr key={idx} className="border-b border-slate-200" style={{ height: '9mm' }}>
                <td className="px-3 border-r font-bold">P{pt.page} - 内訳</td>
                <td className="px-3 text-right font-mono font-bold">¥{pt.total.toLocaleString()}</td>
              </tr>
            ))}
            {Array.from({ length: Math.max(0, 16 - pageTotals.length) }).map((_, i) => (
              <tr key={`empty-${i}`} className="border-b border-slate-200" style={{ height: '9mm' }}>
                <td className="border-r"></td>
                <td></td>
              </tr>
            ))}
          </tbody>
          <tfoot>
            <tr className="bg-slate-50 font-bold border-t-2 border-slate-900">
              <td className="py-2.5 px-3 text-right border-r text-[10px] uppercase">小計 (税抜)</td>
              <td className="py-2.5 px-3 text-right font-mono text-base">¥{(estimate.totalAmount || 0).toLocaleString()}</td>
            </tr>
            <tr className="bg-slate-50 font-bold">
              <td className="py-2.5 px-3 text-right border-r text-[10px] uppercase">消費税 (10%)</td>
              <td className="py-2.5 px-3 text-right font-mono text-base">¥{(estimate.taxAmount || 0).toLocaleString()}</td>
            </tr>
          </tfoot>
        </table>
      </div>
      <div className="text-[8px] text-slate-400 flex justify-between font-mono italic mt-4 shrink-0">
        <span>ESTIMATE - COVER PAGE / TAX NOT INCLUDED IN ITEM PRICE</span>
        <span>DAIEI KANKI Co., Ltd.</span>
      </div>
    </div>
  );
};

// Detail Page Component (Page 2+) - Item table only
const EstimateItemRow = React.memo(({
  item,
  idx,
  isEditing,
  onUpdateItem,
  onDeleteItem,
  onSelectSuggestion,
  suggestions,
  suggestionIdx,
  suggestionType,
  setSuggestionIdx,
  setSuggestionType,
  setQuery
}: {
  item: SlipItem | undefined,
  idx: number,
  isEditing: boolean,
  onUpdateItem: (idx: number, data: Partial<SlipItem>) => void,
  onDeleteItem: (idx: number) => void,
  onSelectSuggestion: (idx: number, item: MaterialItem) => void,
  suggestions: MaterialItem[],
  suggestionIdx: number | null,
  suggestionType: 'name' | 'model' | null,
  setSuggestionIdx: (idx: number | null) => void,
  setSuggestionType: (type: 'name' | 'model' | null) => void,
  setQuery: (q: string) => void
}) => {
  const amount = item ? (item.appliedPrice || 0) * (item.quantity || 0) : 0;

  if (!item && !isEditing) {
    return (
      <tr key={`empty-${idx}`} className="border-b h-[10.5mm] print:h-[9mm] border-slate-200">
        <td className="border-r"></td><td className="border-r"></td><td className="border-r"></td><td className="border-r"></td><td className="border-r"></td><td className="border-r"></td><td className="border-r"></td><td></td>
        {isEditing && <td className="no-print"></td>}
      </tr>
    );
  }

  return (
    <Draggable draggableId={item?.id || `new-${idx}`} index={idx} isDragDisabled={!isEditing}>
      {(provided, snapshot) => (
        <tr
          ref={provided.innerRef}
          {...provided.draggableProps}
          {...provided.dragHandleProps}
          className={`border-b h-[10.5mm] print:h-[9mm] border-slate-200 group transition-colors ${snapshot.isDragging ? 'bg-blue-100 shadow-xl ring-2 ring-blue-400 z-50 rounded-lg' : 'hover:bg-slate-50'}`}
          style={provided.draggableProps.style}
        >
          <td className="text-center border-r text-[9px] font-mono relative">
            {isEditing ? (
              <div className="absolute inset-0 flex items-center justify-center cursor-grab active:cursor-grabbing text-slate-300 hover:text-slate-500 no-print">
                <GripVertical size={12} />
              </div>
            ) : (
              idx + 1
            )}
            <span className="print:inline hidden">{idx + 1}</span>
          </td>
          <td className="px-2 border-r relative">
            {isEditing ? (
              <div className="flex flex-col gap-0.5 relative">
                <input
                  type="text"
                  value={item?.name || ''}
                  onChange={e => { onUpdateItem(idx, { name: e.target.value }); setQuery(e.target.value); }}
                  onFocus={e => { setSuggestionIdx(idx); setSuggestionType('name'); setQuery(e.target.value); }}
                  className="w-full text-[10px] px-1 py-0.5 border rounded focus:ring-1 focus:ring-blue-300 outline-none font-bold"
                  placeholder="品名"
                />
                {item?.manufacturer && <span className="text-[8px] text-slate-500 truncate">{item.manufacturer}</span>}
                {suggestionIdx === idx && suggestionType === 'name' && suggestions.length > 0 && (
                  <div className="absolute top-full left-0 z-50 bg-white border-2 border-blue-300 rounded-lg shadow-2xl w-96 max-h-64 overflow-auto">
                    {suggestions.map((s, i) => (
                      <div key={i} onClick={() => onSelectSuggestion(idx, s)} className="px-3 py-2 hover:bg-blue-50 cursor-pointer border-b last:border-b-0">
                        <div className="font-bold text-[11px]">{s.name}</div>
                        <div className="text-[9px] text-slate-500">{s.manufacturer} / {s.model}</div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            ) : (
              <div className="flex flex-col">
                <span className="font-bold truncate text-[10px]">{item?.name}</span>
                {item?.manufacturer && <span className="text-[8px] text-slate-500 truncate">{item.manufacturer}</span>}
              </div>
            )}
          </td>
          <td className="px-2 border-r relative font-medium">
            {isEditing ? (
              <div className="relative">
                <input
                  type="text"
                  value={`${item?.model || ''} ${item?.dimensions || ''}`.trim()}
                  onChange={e => { const [model, ...dims] = e.target.value.split(' '); onUpdateItem(idx, { model, dimensions: dims.join(' ') }); setQuery(e.target.value); }}
                  onFocus={e => { setSuggestionIdx(idx); setSuggestionType('model'); setQuery(e.target.value); }}
                  className="w-full text-[10px] px-1 py-0.5 border rounded"
                  placeholder="型式 寸法"
                />
                {suggestionIdx === idx && suggestionType === 'model' && suggestions.length > 0 && (
                  <div className="absolute top-full left-0 z-50 bg-white border-2 border-blue-300 rounded-lg shadow-2xl w-96 max-h-64 overflow-auto mt-1">
                    {suggestions.map(s => (
                      <div key={s.id} onClick={() => onSelectSuggestion(idx, s)} className="px-3 py-2 hover:bg-blue-50 cursor-pointer border-b border-slate-100 last:border-0">
                        <div className="font-bold text-xs text-slate-800">{s.name}</div>
                        <div className="text-[10px] text-slate-500 mt-0.5">{s.manufacturer} | {s.model} {s.dimensions}</div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            ) : (
              <span className="truncate text-[10px]">{item?.model} {item?.dimensions}</span>
            )}
          </td>
          <td className="px-2 text-right border-r">
            {isEditing ? (
              <input type="number" value={item?.quantity || ''} onChange={e => onUpdateItem(idx, { quantity: parseFloat(e.target.value) || 0 })} className="w-full text-right px-1 py-0.5 border rounded font-mono" />
            ) : (
              <span className="font-mono">{item && item.quantity > 0 ? item.quantity.toLocaleString() : ''}</span>
            )}
          </td>
          <td className="px-1 text-center border-r">
            {isEditing ? (
              <input type="text" value={item?.unit || '個'} onChange={e => onUpdateItem(idx, { unit: e.target.value })} className="w-full text-center px-1 py-0.5 border rounded font-medium" />
            ) : (
              <span className="font-medium">{item?.unit}</span>
            )}
          </td>
          <td className="px-2 text-right border-r">
            {isEditing ? (
              <input type="number" value={item?.listPrice || ''} onChange={e => onUpdateItem(idx, { listPrice: parseFloat(e.target.value) || 0 })} className="w-full text-right px-1 py-0.5 border rounded font-mono text-slate-400" placeholder="0" />
            ) : (
              <span className="font-mono text-slate-400">{item && item.listPrice > 0 ? `¥${item.listPrice.toLocaleString()}` : ''}</span>
            )}
          </td>
          <td className="px-2 text-right border-r">
            {isEditing ? (
              <input type="number" value={item?.appliedPrice || ''} onChange={e => onUpdateItem(idx, { appliedPrice: parseFloat(e.target.value) || 0 })} className="w-full text-right px-1 py-0.5 border rounded font-mono font-bold" placeholder="0" />
            ) : (
              <span className="font-mono font-bold">{item && item.appliedPrice > 0 ? `¥${item.appliedPrice.toLocaleString()}` : ''}</span>
            )}
          </td>
          <td className="px-2 text-right font-mono font-bold relative">
            {amount > 0 ? `¥${amount.toLocaleString()}` : ''}
            {isEditing && item?.name && (
              <button onClick={() => onDeleteItem(idx)} className="absolute right-1 top-1/2 -translate-y-1/2 opacity-0 group-hover:opacity-100 transition-opacity text-rose-500 hover:bg-rose-50 rounded p-1">
                <X size={12} />
              </button>
            )}
          </td>
          {isEditing && (
            <td className="no-print border-l"></td>
          )}
        </tr>
      )}
    </Draggable>
  );
});

const emptySuggestions: MaterialItem[] = [];

// -----------------------------------------------------------------------
// EstimateItemRow - used in both edit panel and print view
// -----------------------------------------------------------------------
const EstimateEditRow = React.memo(({
  item,
  globalIdx,
  isPageStart,
  onUpdateItem,
  onDeleteItem,
  onSelectSuggestion,
  suggestions,
  suggestionIdx,
  suggestionType,
  setSuggestionIdx,
  setSuggestionType,
  setQuery
}: {
  item: SlipItem | undefined,
  globalIdx: number,
  isPageStart?: boolean,
  onUpdateItem: (idx: number, data: Partial<SlipItem>) => void,
  onDeleteItem: (idx: number) => void,
  onSelectSuggestion: (idx: number, item: MaterialItem) => void,
  suggestions: MaterialItem[],
  suggestionIdx: number | null,
  suggestionType: 'name' | 'model' | null,
  setSuggestionIdx: (idx: number | null) => void,
  setSuggestionType: (type: 'name' | 'model' | null) => void,
  setQuery: (q: string) => void
}) => {
  const draggableId = `item-${globalIdx}`;
  return (
    <Draggable draggableId={draggableId} index={globalIdx}>
      {(provided, snapshot) => (
        <tr
          ref={provided.innerRef}
          {...provided.draggableProps}
          {...provided.dragHandleProps}
          className={`border-b border-slate-200 group transition-colors cursor-grab active:cursor-grabbing ${snapshot.isDragging
              ? 'bg-blue-100 shadow-2xl ring-2 ring-blue-500 rounded-lg opacity-90'
              : 'hover:bg-amber-50'
            }${isPageStart ? ' border-t-4 border-t-amber-400' : ''}`}
          style={{ ...provided.draggableProps.style, display: 'table-row' }}
        >
          <td className="text-center border-r text-[9px] font-mono text-slate-400 w-12 py-1 px-1">
            <div className="flex items-center justify-center gap-1">
              <GripVertical size={10} className="text-slate-300" />
              <span>{globalIdx + 1}</span>
            </div>
          </td>
          <td className="px-2 border-r relative">
            <div className="flex flex-col gap-0.5 relative">
              <input
                type="text"
                value={item?.name || ''}
                onChange={e => { onUpdateItem(globalIdx, { name: e.target.value }); setQuery(e.target.value); }}
                onFocus={e => { setSuggestionIdx(globalIdx); setSuggestionType('name'); setQuery(e.target.value); }}
                className="w-full text-[10px] px-1 py-0.5 border rounded focus:ring-1 focus:ring-blue-300 outline-none font-bold"
                placeholder="品名"
              />
              {item?.manufacturer && <span className="text-[8px] text-slate-500 truncate">{item.manufacturer}</span>}
              {suggestionIdx === globalIdx && suggestionType === 'name' && suggestions.length > 0 && (
                <div className="absolute top-full left-0 z-50 bg-white border-2 border-blue-300 rounded-lg shadow-2xl w-96 max-h-64 overflow-auto">
                  {suggestions.map((s, i) => (
                    <div key={i} onMouseDown={e => { e.preventDefault(); onSelectSuggestion(globalIdx, s); }} className="px-3 py-2 hover:bg-blue-50 cursor-pointer border-b last:border-b-0">
                      <div className="font-bold text-[11px]">{s.name}</div>
                      <div className="text-[9px] text-slate-500">{s.manufacturer} / {s.model}</div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </td>
          <td className="px-2 border-r relative">
            <div className="relative">
              <input
                type="text"
                value={`${item?.model || ''} ${item?.dimensions || ''}`.trim()}
                onChange={e => { const [model, ...dims] = e.target.value.split(' '); onUpdateItem(globalIdx, { model, dimensions: dims.join(' ') }); setQuery(e.target.value); }}
                onFocus={e => { setSuggestionIdx(globalIdx); setSuggestionType('model'); setQuery(e.target.value); }}
                className="w-full text-[10px] px-1 py-0.5 border rounded"
                placeholder="型式 寸法"
              />
              {suggestionIdx === globalIdx && suggestionType === 'model' && suggestions.length > 0 && (
                <div className="absolute top-full left-0 z-50 bg-white border-2 border-blue-300 rounded-lg shadow-2xl w-96 max-h-64 overflow-auto mt-1">
                  {suggestions.map(s => (
                    <div key={s.id} onMouseDown={e => { e.preventDefault(); onSelectSuggestion(globalIdx, s); }} className="px-3 py-2 hover:bg-blue-50 cursor-pointer border-b border-slate-100 last:border-0">
                      <div className="font-bold text-[11px]">{s.name}</div>
                      <div className="text-[9px] text-slate-500">{s.manufacturer} / {s.model} {s.dimensions}</div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </td>
          <td className="text-right border-r">
            <input type="number" value={item?.quantity === 0 ? '' : (item?.quantity ?? '')} onChange={e => onUpdateItem(globalIdx, { quantity: parseFloat(e.target.value) || 0 })}
              className="w-full text-[10px] px-1 py-0.5 border rounded text-right" placeholder="0" />
          </td>
          <td className="text-center border-r">
            <input type="text" value={item?.unit || '個'} onChange={e => onUpdateItem(globalIdx, { unit: e.target.value })}
              className="w-full text-[10px] px-1 py-0.5 border rounded text-center" />
          </td>
          <td className="text-right border-r">
            <input type="number" value={item?.listPrice ?? ''} onChange={e => onUpdateItem(globalIdx, { listPrice: parseFloat(e.target.value) || 0 })}
              className="w-full text-[10px] px-1 py-0.5 border rounded text-right text-slate-400" placeholder="0" />
          </td>
          <td className="text-right border-r">
            <input type="number" value={item?.appliedPrice ?? ''} onChange={e => onUpdateItem(globalIdx, { appliedPrice: parseFloat(e.target.value) || 0 })}
              className="w-full text-[10px] px-1 py-0.5 border rounded text-right font-bold text-emerald-700" placeholder="0" />
          </td>
          <td className="text-right border-r text-[10px] font-mono">
            {item ? ((item.appliedPrice || 0) * (item.quantity || 0)).toLocaleString() : ''}
          </td>
          <td className="text-center w-8">
            <button onMouseDown={e => { e.preventDefault(); onDeleteItem(globalIdx); }}
              className="p-0.5 text-rose-300 hover:text-rose-500 rounded transition-colors">
              <X size={12} />
            </button>
          </td>
        </tr>
      )}
    </Draggable>
  );
});

// -----------------------------------------------------------------------
// EstimateEditPanel - Single flat Droppable for ~all~ items in edit mode
// -----------------------------------------------------------------------
const EstimateEditPanel = React.memo(({
  estimate,
  onUpdateItem,
  onAddPage,
  masterItems
}: {
  estimate: Estimate,
  onUpdateItem: (idx: number, data: Partial<SlipItem>) => void,
  onAddPage: () => void,
  masterItems: MaterialItem[],
}) => {
  const [suggestionIdx, setSuggestionIdx] = useState<number | null>(null);
  const [suggestionType, setSuggestionType] = useState<'name' | 'model' | null>(null);
  const [query, setQuery] = useState('');

  const suggestions = useMemo(() => {
    if (!query.trim() || suggestionIdx === null) return [];
    return filterAndSortItems(masterItems, query).slice(0, 100);
  }, [query, masterItems, suggestionIdx]);

  const handleSelect = useCallback((idx: number, item: MaterialItem) => {
    onUpdateItem(idx, {
      id: item.id, name: item.name, manufacturer: item.manufacturer,
      model: item.model, dimensions: item.dimensions, unit: item.unit || '個',
      listPrice: item.listPrice || 0, appliedPrice: item.sellingPrice || 0, category: item.category
    });
    setSuggestionIdx(null);
    setSuggestionType(null);
    setQuery('');
  }, [onUpdateItem]);

  const handleDelete = useCallback((idx: number) => {
    onUpdateItem(idx, { name: '', quantity: 0, appliedPrice: 0, listPrice: 0, model: '', dimensions: '', manufacturer: '' });
  }, [onUpdateItem]);

  const items = estimate.items || [];
  const numPages = Math.max(1, Math.ceil(items.length / 16));

  return (
    <div className="bg-white rounded-2xl shadow-xl border border-slate-200 overflow-hidden" style={{ width: '210mm' }}>
      <div className="bg-slate-800 text-white px-4 py-2 flex justify-between items-center">
        <span className="text-xs font-black tracking-widest uppercase">内訳 編集モード — 行を掴んでドラッグで並び替え</span>
        <span className="text-[10px] text-slate-400">{items.filter(i => i.name).length} / {items.length} 行</span>
      </div>
      <Droppable droppableId="all-items" direction="vertical">
        {(provided, snapshot) => (
          <table
            className="w-full border-collapse table-fixed text-[10px]"
            style={{ background: snapshot.isDraggingOver ? '#f0f9ff' : 'white' }}
          >
            <thead className="sticky top-0 z-10 bg-slate-100 border-b-2 border-slate-900">
              <tr>
                <th className="py-2 px-1 w-12 border-r text-center text-slate-500">No</th>
                <th className="py-2 px-2 text-left border-r w-[26%]">品名 / メーカー</th>
                <th className="py-2 px-2 text-left border-r w-[20%]">型式 / 寸法</th>
                <th className="py-2 px-2 text-right border-r w-[8%]">数量</th>
                <th className="py-2 px-1 text-center border-r w-[5%]">単位</th>
                <th className="py-2 px-2 text-right border-r w-[10%] text-slate-400">定価</th>
                <th className="py-2 px-2 text-right border-r w-[10%]">売価</th>
                <th className="py-2 px-2 text-right border-r w-[11%]">金額</th>
                <th className="w-8"></th>
              </tr>
            </thead>
            <tbody {...provided.droppableProps} ref={provided.innerRef}>
              {items.map((item, idx) => {
                const isPageStart = idx > 0 && idx % 16 === 0;
                return (
                  <EstimateEditRow
                    key={`item-${idx}`}
                    item={item}
                    globalIdx={idx}
                    isPageStart={isPageStart}
                    onUpdateItem={onUpdateItem}
                    onDeleteItem={handleDelete}
                    onSelectSuggestion={handleSelect}
                    suggestions={suggestionIdx === idx ? suggestions : emptySuggestions}
                    suggestionIdx={suggestionIdx}
                    suggestionType={suggestionType}
                    setSuggestionIdx={setSuggestionIdx}
                    setSuggestionType={setSuggestionType}
                    setQuery={setQuery}
                  />
                );
              })}
              {provided.placeholder}
            </tbody>
          </table>
        )}
      </Droppable>
      <div className="p-3 border-t border-slate-200 bg-slate-50 flex justify-center">
        <button onClick={onAddPage}
          className="bg-amber-500 text-white px-6 py-2 rounded-xl text-xs font-black flex items-center gap-2 shadow hover:bg-amber-600 transition-all active:scale-95">
          <Plus size={16} /> ページを追加 (16行)
        </button>
      </div>
    </div>
  );
});

// -----------------------------------------------------------------------
// EstimateDetailPage - print/view only, no DnD
// -----------------------------------------------------------------------
const EstimateDetailPage = React.memo(({ estimate, pageNumber, settings }: {
  estimate: Estimate,
  pageNumber: number,
  settings: AppSettings | null,
}) => {
  const info = settings || DEFAULT_COMPANY_INFO;
  const pageItems = (estimate.items || []).slice((pageNumber - 1) * 16, pageNumber * 16);
  const paddedItems = [...Array(16)].map((_, i) => pageItems[i]);

  return (
    <div className="bg-white p-10 print:p-[15mm] text-slate-900 flex flex-col justify-between h-full w-full box-border min-h-[280mm]">
      <div className="w-full">
        <div className="flex justify-between items-center border-b-2 border-slate-300 pb-1 mb-3 print:mb-2">
          <h2 className="text-lg font-bold">内訳 (Page {pageNumber})</h2>
          <div className="text-xs text-slate-500">{estimate.customerName} 様 - {estimate.constructionName || '一般'}</div>
        </div>
        <table className="w-full border-collapse table-fixed text-[10px] border-2 border-slate-900" style={{ marginBottom: '8px' }}>
          <thead>
            <tr className="bg-slate-100 border-y-2 border-slate-900">
              <th className="py-2 px-1 w-[4%] border-r text-center">No</th>
              <th className="py-2 px-2 text-left border-r w-[26%]">品名 / メーカー</th>
              <th className="py-2 px-2 text-left border-r w-[22%]">型式 / 寸法</th>
              <th className="py-2 px-2 text-right border-r w-[8%]">数量</th>
              <th className="py-2 px-1 text-center border-r w-[6%]">単位</th>
              <th className="py-2 px-2 text-right border-r w-[11%] text-slate-400">定価(抜)</th>
              <th className="py-2 px-2 text-right border-r w-[11%]">売価(抜)</th>
              <th className="py-2 px-2 text-right w-[12%]">金額</th>
            </tr>
          </thead>
          <tbody>
            {paddedItems.map((item, idx) => (
              <tr key={item?.id || `view-${pageNumber}-${idx}`} className="border-b h-[10.5mm] print:h-[9mm] border-slate-200">
                <td className="text-center border-r text-[9px] font-mono">{idx + 1}</td>
                <td className="px-2 border-r">
                  <div className="flex flex-col">
                    <span className="font-bold truncate text-[10px]">{item?.name}</span>
                    {item?.manufacturer && <span className="text-[8px] text-slate-500 truncate">{item.manufacturer}</span>}
                  </div>
                </td>
                <td className="px-2 border-r text-[10px] font-medium">{item ? `${item.model || ''} ${item.dimensions || ''}`.trim() : ''}</td>
                <td className="text-right px-2 border-r text-[10px]">{item?.quantity || ''}</td>
                <td className="text-center border-r text-[10px]">{item?.unit || ''}</td>
                <td className="text-right px-2 border-r text-[10px] text-slate-400 font-mono">{item?.listPrice ? item.listPrice.toLocaleString() : ''}</td>
                <td className="text-right px-2 border-r text-[10px] font-mono font-bold">{item?.appliedPrice ? item.appliedPrice.toLocaleString() : ''}</td>
                <td className="text-right px-2 text-[10px] font-mono">{item ? ((item.appliedPrice || 0) * (item.quantity || 0)).toLocaleString() : ''}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="text-[8px] text-slate-400 flex justify-between font-mono italic mt-4 shrink-0">
        <span>ESTIMATE - DETAIL PAGE / TAX NOT INCLUDED IN ITEM PRICE</span>
        <span>DAIEI KANKI Co., Ltd.</span>
      </div>
    </div>
  );
});


export const EstimateManager: React.FC<EstimateManagerProps> = ({ onClose, onConvertToSlip, masterItems, settings, customers }) => {
  const [estimates, setEstimates] = useState<Estimate[]>([]);
  const [selectedEstimate, setSelectedEstimate] = useState<Estimate | null>(null);
  const [isEditing, setIsEditing] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [isAIScanning, setIsAIScanning] = useState(false);
  const [previewScale, setPreviewScale] = useState(1);
  const aiInputRef = useRef<HTMLInputElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleResize = () => {
      if (!containerRef.current) return;
      const availableWidth = containerRef.current.clientWidth - 64;
      const a4Width = 794; // 210mm @ 96dpi
      const scale = Math.min(availableWidth / a4Width, 1.0);
      setPreviewScale(scale > 0 ? scale : 1);
    };

    const observer = new ResizeObserver(handleResize);
    if (containerRef.current) observer.observe(containerRef.current);

    window.addEventListener('resize', handleResize);
    handleResize();

    return () => {
      window.removeEventListener('resize', handleResize);
      observer.disconnect();
    };
  }, [selectedEstimate]);

  useEffect(() => {
    const unsub = storage.subscribeToEstimates(setEstimates);
    setIsLoading(false);
    return unsub;
  }, []);

  const filteredEstimates = useMemo(() => {
    const q = searchQuery.toLowerCase();
    return estimates.filter(e => e.customerName.toLowerCase().includes(q) || (e.constructionName || '').toLowerCase().includes(q));
  }, [estimates, searchQuery]);

  const recalculate = useCallback((items: SlipItem[], meta: Partial<Estimate>) => {
    const total = items.reduce((s, i) => s + ((i.appliedPrice || 0) * (i.quantity || 0)), 0);
    setSelectedEstimate(prev => prev ? { ...prev, ...meta, items, totalAmount: total, taxAmount: Math.round(total * 0.1), grandTotal: Math.round(total * 1.1) } : null);
  }, []);

  const createEmptyItem = useCallback((idx: number): SlipItem => ({
    id: generateId(),
    name: '',
    category: '消耗品・雑材',
    model: '',
    dimensions: '',
    quantity: 0,
    unit: '個',
    appliedPrice: 0,
    costPrice: 0,
    listPrice: 0,
    sellingPrice: 0,
    location: '手入力',
    updatedAt: Date.now()
  }), []);

  const padItems = useCallback((items: SlipItem[]): SlipItem[] => {
    const list = [...(items || [])];
    const targetLength = Math.max(16, Math.ceil(list.length / 16) * 16);
    while (list.length < targetLength) {
      list.push(createEmptyItem(list.length));
    }
    return list;
  }, [createEmptyItem]);

  const handleUpdateMeta = useCallback((data: Partial<Estimate>) => {
    if (!selectedEstimate) return;
    recalculate(selectedEstimate.items, data);
  }, [selectedEstimate, recalculate]);

  const handleManualAdd = useCallback(() => {
    const newItem: SlipItem = {
      id: generateId(),
      name: '',
      category: '消耗品・雑材',
      model: '',
      dimensions: '',
      quantity: 0,
      unit: '個',
      appliedPrice: 0,
      costPrice: 0,
      listPrice: 0,
      sellingPrice: 0,
      location: '手入力',
      updatedAt: Date.now()
    };
    if (selectedEstimate) {
      const newItems = [...selectedEstimate.items.filter(i => i.name.trim() !== ''), newItem];
      recalculate(padItems(newItems), {});
    }
  }, [selectedEstimate, recalculate, padItems]);

  const handleNewEstimate = async () => {
    const today = new Date().toISOString().slice(0, 10);
    const valid = new Date(); valid.setDate(valid.getDate() + 30);
    const newEst: Omit<Estimate, 'id'> = {
      createdAt: Date.now(),
      date: today,
      validUntil: valid.toISOString().slice(0, 10),
      customerName: '新規顧客',
      constructionName: '',
      items: padItems([]),
      totalAmount: 0,
      taxAmount: 0,
      grandTotal: 0,
      status: 'pending',
      deliveryTime: 'none',
      deliveryDestination: 'none',
      slipNumber: `EST-${generateId().slice(0, 6).toUpperCase()}`
    };
    try {
      const id = await storage.addEstimate(newEst);
      const saved = { ...newEst, id } as Estimate;
      setSelectedEstimate(saved);
      setIsEditing(true);
    } catch (e) {
      alert('新規見積の作成に失敗しました。');
    }
  };

  const handleUpdateItem = useCallback((idx: number, data: Partial<SlipItem>) => {
    if (!selectedEstimate) return;
    const newItems = [...selectedEstimate.items];
    while (newItems.length <= idx) {
      newItems.push(createEmptyItem(newItems.length));
    }
    newItems[idx] = { ...newItems[idx], ...data };
    if (!newItems[idx].id) newItems[idx].id = generateId(); // Safety net in case id got lost

    recalculate(newItems, {});
  }, [selectedEstimate, recalculate, createEmptyItem]);

  const handleDragEnd = useCallback((result: DropResult) => {
    if (!result.destination || !selectedEstimate) return;
    if (result.source.index === result.destination.index) return;

    const items = Array.from(selectedEstimate.items);
    const [moved] = items.splice(result.source.index, 1);
    items.splice(result.destination.index, 0, moved);
    recalculate(items, {});
  }, [selectedEstimate, recalculate]);
  const handleSave = async () => {
    if (!selectedEstimate) return;
    if (!selectedEstimate.id) {
      alert('エラー: 見積IDが見つかりません。新規作成し直してください。');
      return;
    }
    try {
      await storage.updateEstimate(selectedEstimate.id, selectedEstimate);
      setIsEditing(false);
    } catch (e: any) {
      console.error("Save Error:", e);
      alert(`保存に失敗しました: ${e.message || '不明なエラー'}`);
    }
  };

  const handleAdoptAndConvert = async () => {
    if (!selectedEstimate || !onConvertToSlip) return;
    if (window.confirm('この見積を「採用」として確定し、伝票作成カートへ連携しますか？マスター未登録の資材は自動登録されます。')) {
      await storage.updateEstimate(selectedEstimate.id, { status: 'accepted' });
      const validItems = selectedEstimate.items.filter(i => i.name.trim() !== '');
      onConvertToSlip(validItems, selectedEstimate.customerName, selectedEstimate.constructionName);
      onClose();
    }
  };

  return (
    <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-md z-[150] flex items-center justify-center p-4">
      <div className="bg-white rounded-[2rem] shadow-2xl w-full max-w-7xl h-[90vh] flex flex-col overflow-hidden animate-in zoom-in-95">
        <div className="p-3 sm:p-6 border-b flex justify-between items-center bg-slate-50/50 no-print">
          <div className="flex items-center gap-2 sm:gap-4">
            <div className="w-8 h-8 sm:w-12 sm:h-12 bg-amber-100 text-amber-600 rounded-xl sm:rounded-2xl flex items-center justify-center shadow-sm font-bold"><FileText size={16} className="sm:hidden" /><FileText size={24} className="hidden sm:block" /></div>
            <div><h2 className="text-base sm:text-2xl font-black text-slate-900 tracking-tight">見積管理</h2><p className="hidden sm:block text-[10px] text-slate-400 font-bold uppercase tracking-widest mt-0.5 font-mono">ESTIMATE MANAGEMENT SYSTEM PRO</p></div>
          </div>
          <div className="flex items-center gap-1 sm:gap-3">
            <button onClick={onClose} className="p-1.5 sm:p-2 hover:bg-slate-100 rounded-xl transition-all"><X size={20} className="sm:hidden" /><X size={28} className="hidden sm:block" /></button>
          </div>
        </div>

        <style dangerouslySetInnerHTML={{
          __html: `
            @media print {
              @page { margin: 0; size: A4; }
              * { print-color-adjust: exact; -webkit-print-color-adjust: exact; }
              body { background: white !important; margin: 0 !important; padding: 0 !important; }
              .no-print { display: none !important; }
              .estimate-print-page { 
                transform: none !important; 
                box-shadow: none !important; 
                page-break-after: always;
                width: 210mm !important;
                min-height: 297mm !important;
              }
              #print-target > div,
              .estimate-print-page > div,
              .estimate-print-page > * {
                padding: 15mm !important;
                width: 100% !important;
                box-sizing: border-box !important;
              }
            }
          `
        }} />

        <div className="flex-1 overflow-hidden flex flex-col md:flex-row">
          <div className="w-full md:w-1/3 border-b md:border-b-0 md:border-r bg-slate-50 flex flex-col no-print max-h-[40vh] md:max-h-none">
            <div className="p-2 sm:p-4 border-b bg-white space-y-2 sm:space-y-3">
              <button onClick={handleNewEstimate} className="w-full flex items-center justify-center gap-1.5 sm:gap-2 bg-amber-500 text-white py-2 sm:py-3 rounded-xl sm:rounded-2xl text-[10px] sm:text-xs font-black shadow-lg hover:bg-amber-600 transition-all active:scale-95">
                <Plus size={14} className="sm:hidden" /><Plus size={18} className="hidden sm:block" /> <span className="hidden sm:inline">新規</span>見積作成
              </button>
              <div className="relative">
                <Search className="absolute left-3 top-2.5 text-slate-400" size={16} />
                <input value={searchQuery} onChange={e => setSearchQuery(e.target.value)} placeholder="顧客・現場名で検索..." className="w-full pl-10 pr-4 py-1.5 sm:py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs sm:text-sm font-bold outline-none focus:ring-2 focus:ring-amber-500 transition-all" />
              </div>
            </div>
            <div className="flex-1 overflow-y-auto p-2 sm:p-4 space-y-2 sm:space-y-3">
              {filteredEstimates.map(e => (
                <div key={e.id} onClick={() => {
                  if (selectedEstimate?.id !== e.id) {
                    setSelectedEstimate({ ...e, items: padItems(e.items) });
                    setIsEditing(false);
                  }
                }} className={`p-2.5 sm:p-4 rounded-xl sm:rounded-2xl border transition-all cursor-pointer group ${selectedEstimate?.id === e.id ? 'bg-amber-50 border-amber-300 shadow-md' : 'bg-white hover:border-amber-200 hover:shadow-sm'}`}>
                  <div className="flex justify-between items-start mb-1.5 sm:mb-2"><span className="text-[8px] sm:text-[9px] font-black text-slate-400 font-mono">#{e.slipNumber}</span><span className={`text-[8px] sm:text-[9px] font-black px-1.5 sm:px-2 py-0.5 rounded-full uppercase ${e.status === 'accepted' ? 'bg-emerald-100 text-emerald-700' : 'bg-amber-100 text-amber-700'}`}>{e.status === 'accepted' ? '採用' : '見積中'}</span></div>
                  <h4 className="font-black text-slate-900 text-xs sm:text-sm truncate">{e.customerName}</h4>
                  <p className="text-[9px] sm:text-[10px] text-slate-500 font-bold truncate">現場: {e.constructionName || '未指定'}</p>
                  <div className="mt-2 sm:mt-3 flex justify-between items-end gap-2"><span className="text-[8px] sm:text-[9px] text-slate-400 font-bold shrink-0">{e.date}</span><span className="text-xs sm:text-sm font-black text-amber-600 font-mono truncate">¥{(e.grandTotal || 0).toLocaleString()}</span></div>
                </div>
              ))}
              {filteredEstimates.length === 0 && <div className="text-center py-20 text-slate-300 text-xs font-bold uppercase tracking-widest">見積データがありません</div>}
            </div>
          </div>

          <div className="flex-1 bg-slate-200/30 overflow-auto flex justify-center items-start relative box-border" ref={containerRef}>
            {selectedEstimate ? (
              isEditing ? (
                // ---- EDIT MODE: single flat DragDropContext + EstimateEditPanel ----
                <DragDropContext onDragEnd={handleDragEnd}>
                  <div className="flex flex-col items-center gap-4 w-full py-6" style={{ minWidth: 'calc(210mm + 64px)' }}>
                    {/* Sticky control bar */}
                    <div className="no-print bg-white p-2 sm:p-4 rounded-xl sm:rounded-2xl shadow-xl sticky top-2 sm:top-4 z-20 border border-slate-200 flex gap-2 justify-between items-center" style={{ width: '210mm' }}>
                      <div className="flex gap-2">
                        <button onClick={handleSave} className="bg-blue-600 text-white px-4 py-2 rounded-xl text-xs font-black flex items-center gap-2 shadow-lg active:scale-95 hover:bg-blue-700"><Save size={16} /> 保存</button>
                        <button onClick={() => setIsEditing(false)} className="bg-slate-100 px-4 py-2 rounded-xl text-xs font-black hover:bg-slate-200">キャンセル</button>
                      </div>
                      <div className="flex gap-2">
                        <button onClick={handleManualAdd} className="bg-slate-800 text-white px-3 py-2 rounded-xl text-xs font-black flex items-center gap-1 hover:bg-slate-700"><Plus size={14} /> 行を追加</button>
                        <button onClick={async () => window.confirm('見積データを削除しますか？') && storage.deleteEstimate(selectedEstimate.id)} className="p-2 text-rose-500 hover:bg-rose-50 rounded-xl"><Trash2 size={16} /></button>
                      </div>
                    </div>
                    {/* Edit panel with cover meta */}
                    <div className="bg-white rounded-2xl shadow-xl border border-slate-200 p-6" style={{ width: '210mm' }}>
                      <div className="grid grid-cols-2 gap-4 mb-4 text-xs">
                        <div><label className="block text-slate-500 font-bold mb-1">顧客名</label>
                          <input value={selectedEstimate.customerName} onChange={e => handleUpdateMeta({ customerName: e.target.value })} className="w-full border rounded-lg px-2 py-1.5 font-bold" /></div>
                        <div><label className="block text-slate-500 font-bold mb-1">現場名</label>
                          <input value={selectedEstimate.constructionName || ''} onChange={e => handleUpdateMeta({ constructionName: e.target.value })} className="w-full border rounded-lg px-2 py-1.5 font-bold" /></div>
                        <div><label className="block text-slate-500 font-bold mb-1">見積日</label>
                          <input type="date" value={selectedEstimate.date} onChange={e => handleUpdateMeta({ date: e.target.value })} className="w-full border rounded-lg px-2 py-1.5" /></div>
                        <div><label className="block text-slate-500 font-bold mb-1">有効期限</label>
                          <input type="date" value={selectedEstimate.validUntil} onChange={e => handleUpdateMeta({ validUntil: e.target.value })} className="w-full border rounded-lg px-2 py-1.5" /></div>
                      </div>
                    </div>
                    <EstimateEditPanel
                      estimate={selectedEstimate}
                      onUpdateItem={handleUpdateItem}
                      onAddPage={() => {
                        const currentItems = selectedEstimate.items || [];
                        const newRows = Array.from({ length: 16 }).map((_, i) => createEmptyItem(currentItems.length + i));
                        setSelectedEstimate({ ...selectedEstimate, items: [...currentItems, ...newRows] });
                      }}
                      masterItems={masterItems}
                    />
                  </div>
                </DragDropContext>
              ) : (
                // ---- VIEW MODE: scaled paginated A4 pages ----
                <div className="flex flex-col items-center gap-6 w-full py-8" style={{ minWidth: `calc(210mm * ${previewScale} + 64px)` }}>
                  {/* View mode control bar */}
                  <div className="no-print bg-white p-2 sm:p-4 rounded-xl sm:rounded-2xl shadow-xl sticky top-2 sm:top-4 z-10 border border-slate-200 flex gap-2 flex-wrap justify-between items-center" style={{ width: `calc(210mm * ${previewScale})`, minWidth: '280px' }}>
                    <div className="flex gap-2">
                      <button onClick={() => setIsEditing(true)} className="bg-slate-900 text-white px-4 py-2 rounded-xl text-xs font-black flex items-center gap-2 hover:bg-slate-800 shadow-md"><Edit3 size={16} /> 編集</button>
                      <button onClick={handleAdoptAndConvert} className="bg-emerald-600 text-white px-4 py-2 rounded-xl text-xs font-black flex items-center gap-2 shadow-lg hover:bg-emerald-700"><ShoppingCart size={16} /> 採用・伝票へ</button>
                    </div>
                    <div className="flex gap-2 items-center">
                      <div className="flex items-center gap-1 bg-slate-100 px-2 py-1 rounded-xl border border-slate-200">
                        <button onClick={() => setPreviewScale(s => Math.max(0.3, s - 0.1))} className="p-1 hover:bg-slate-200 rounded"><Minus size={14} /></button>
                        <span className="text-xs font-mono font-bold text-slate-600 w-10 text-center">{Math.round(previewScale * 100)}%</span>
                        <button onClick={() => setPreviewScale(s => Math.min(3.0, s + 0.1))} className="p-1 hover:bg-slate-200 rounded"><Plus size={14} /></button>
                      </div>
                      <button onClick={() => window.print()} className="bg-slate-100 text-slate-900 border border-slate-200 px-4 py-2 rounded-xl text-xs font-black flex items-center gap-2 hover:bg-slate-200 shadow-sm"><Printer size={16} /> 印刷</button>
                      <button onClick={async () => window.confirm('見積データを削除しますか？') && storage.deleteEstimate(selectedEstimate.id)} className="p-2 text-rose-500 hover:bg-rose-50 rounded-xl"><Trash2 size={18} /></button>
                    </div>
                  </div>
                  {/* Cover page */}
                  <div id="print-target" className="estimate-print-page bg-white shadow-2xl print:shadow-none print:m-0 box-border origin-top"
                    style={{ width: '210mm', minHeight: '297mm', transform: `scale(${previewScale})`, pageBreakAfter: 'always' }}>
                    <EstimateCoverPage estimate={selectedEstimate} isEditing={false} onUpdateMeta={handleUpdateMeta}
                      pageTotals={Array.from({ length: Math.max(1, Math.ceil((selectedEstimate.items || []).length / 16)) }).map((_, i) => ({
                        page: i + 1,
                        total: (selectedEstimate.items || []).slice(i * 16, i * 16 + 16).reduce((s, item) => s + (item.appliedPrice || 0) * (item.quantity || 0), 0)
                      }))}
                      settings={settings}
                    />
                  </div>
                  {/* Detail pages */}
                  {Array.from({ length: Math.max(1, Math.ceil((selectedEstimate.items || []).length / 16)) }).map((_, i) => (
                    <div key={`detail-${i}`} className="estimate-print-page bg-white shadow-2xl print:shadow-none print:m-0 box-border origin-top"
                      style={{ width: '210mm', minHeight: '297mm', transform: `scale(${previewScale})`, pageBreakAfter: i < Math.max(1, Math.ceil((selectedEstimate.items || []).length / 16)) - 1 ? 'always' : 'auto' }}>
                      <EstimateDetailPage estimate={selectedEstimate} pageNumber={i + 1} settings={settings} />
                    </div>
                  ))}
                </div>
              )
            ) : (
              <div className="flex flex-col items-center justify-center h-full text-slate-300">
                <FileText size={80} className="opacity-10 mb-4" />
                <p className="text-sm font-black uppercase tracking-widest opacity-30">見積データを選択、または新規作成してください</p>
                <div className="mt-6 p-4 bg-white/50 border border-slate-200 rounded-2xl flex items-center gap-3">
                  <div className="w-10 h-10 bg-indigo-100 text-indigo-600 rounded-xl flex items-center justify-center">
                    <Sparkles size={20} />
                  </div>
                  <p className="text-[10px] text-slate-500 font-bold leading-tight">
                    FAXなどの画像から見積を作成する場合は、<br />
                    右下の<span className="text-indigo-600">AI高橋さん</span>に写真を送ってください。
                  </p>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      <style>{`
        @media print {
          @page { size: A4; margin: 0; }
          .no-print { display: none !important; }
          
          * { 
            -webkit-print-color-adjust: exact !important;
            print-color-adjust: exact !important;
          }

          /* Reset all potential clipping containers */
          .fixed.inset-0, 
          .fixed.inset-0 > div,
          .bg-slate-200\\/30,
          .py-8,
          .overflow-auto {
            position: static !important;
            display: block !important;
            overflow: visible !important;
            height: auto !important;
            max-height: none !important;
            width: 100% !important;
            margin: 0 !important;
            padding: 0 !important;
            transform: none !important;
            box-shadow: none !important;
            background: white !important;
          }

          #print-target,
          .estimate-print-page {
            display: block !important;
            width: 210mm !important;
            height: auto !important;
            margin: 0 !important;
            background: white !important;
            box-sizing: border-box !important;
          }

          /* Reinforce borders for print */
          table { border-collapse: collapse !important; width: 100% !important; }
          th, td { border: 1px solid #e2e8f0 !important; }
          .border-slate-900 { border-color: #0f172a !important; }
          .border-slate-200 { border-color: #e2e8f0 !important; }

          body, html {
            height: auto !important;
            overflow: visible !important;
            background: white !important;
            margin: 0 !important;
            padding: 0 !important;
          }
        }
      `}</style>
    </div>
  );
};
