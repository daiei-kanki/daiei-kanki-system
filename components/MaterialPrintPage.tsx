
import React from 'react';
import { MaterialItem, MATERIAL_CATEGORIES } from '../types';
import { Printer, X, Download, Package, Tag, MapPin, Calculator } from 'lucide-react';

interface MaterialPrintPageProps {
    items: MaterialItem[];
    mode: 'price' | 'inventory';
    customerName?: string | null;
    onClose: () => void;
}

export const MaterialPrintPage: React.FC<MaterialPrintPageProps> = ({ items = [], mode, customerName, onClose }) => {
    const [printMode, setPrintMode] = React.useState<'price' | 'inventory'>(mode);

    if (!items || items.length === 0) {
        return (
            <div className="fixed inset-0 z-[200] bg-slate-900/90 backdrop-blur-md flex items-center justify-center p-8">
                <div className="bg-white rounded-3xl p-12 text-center shadow-2xl max-w-sm w-full animate-in zoom-in-95 duration-300">
                    <div className="w-20 h-20 bg-slate-100 rounded-2xl flex items-center justify-center mx-auto mb-6 text-slate-300">
                        <Printer size={40} />
                    </div>
                    <h3 className="text-xl font-black text-slate-900 mb-2">印刷対象がありません</h3>
                    <p className="text-slate-500 text-sm mb-8 leading-relaxed">印刷するデータが選択されていないか、検索結果が空です。</p>
                    <button onClick={onClose} className="w-full bg-slate-900 text-white font-black py-4 rounded-2xl hover:bg-slate-800 transition-all">
                        閉じる
                    </button>
                </div>
            </div>
        );
    }

    // A4 optimized rows: 18 rows per page as requested
    const itemsPerPage = 18;

    // Sort items for Inventory mode
    const sortedItems = React.useMemo(() => {
        if (printMode === 'inventory') {
            return [...items].sort((a, b) => {
                const locA = a.location || '';
                const locB = b.location || '';
                if (locA !== locB) return locA.localeCompare(locB);
                return a.name.localeCompare(b.name);
            });
        }
        return items;
    }, [items, printMode]);

    // Generate pages with grouping headers
    const pages = React.useMemo(() => {
        const result: (MaterialItem | { type: 'header', label: string })[][] = [];
        let currentPage: (MaterialItem | { type: 'header', label: string })[] = [];
        let lastLocation = '';

        sortedItems.forEach((item) => {
            const currentLocation = item.location || '設定なし';

            // IF in inventory mode and location changed, add a header
            if (printMode === 'inventory' && currentLocation !== lastLocation) {
                // If page is full, start new page
                if (currentPage.length >= itemsPerPage) {
                    result.push(currentPage);
                    currentPage = [];
                }
                currentPage.push({ type: 'header', label: currentLocation });
                lastLocation = currentLocation;
            }

            // If page is full after adding header or item
            if (currentPage.length >= itemsPerPage) {
                result.push(currentPage);
                currentPage = [];
            }
            currentPage.push(item);
        });

        if (currentPage.length > 0) {
            result.push(currentPage);
        }

        return result;
    }, [sortedItems, printMode, itemsPerPage]);

    const handlePrint = () => {
        window.print();
    };

    return (
        <div className="fixed inset-0 z-[200] bg-slate-900/90 backdrop-blur-md flex flex-col animate-fade-in">
            {/* Header / Controls */}
            <div className="bg-white border-b border-slate-200 px-8 py-4 flex items-center justify-between shadow-lg print:hidden">
                <div className="flex items-center gap-6">
                    <div className="flex items-center gap-3">
                        <div className="w-10 h-10 bg-indigo-600 text-white rounded-xl flex items-center justify-center shadow-md">
                            <Printer size={20} />
                        </div>
                        <div>
                            <h2 className="text-xl font-black text-slate-900 leading-none">印刷プレビュー</h2>
                            <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest mt-1">Material Print Console</p>
                        </div>
                    </div>

                    <div className="h-8 w-px bg-slate-200" />

                    <div className="flex bg-slate-100 p-1 rounded-xl">
                        <button
                            onClick={() => setPrintMode('price')}
                            className={`px-4 py-2 rounded-lg text-xs font-black transition-all ${printMode === 'price' ? 'bg-white text-blue-600 shadow-sm' : 'text-slate-500 hover:text-slate-900'}`}
                        >
                            単価表モード
                        </button>
                        <button
                            onClick={() => setPrintMode('inventory')}
                            className={`px-4 py-2 rounded-lg text-xs font-black transition-all ${printMode === 'inventory' ? 'bg-white text-emerald-600 shadow-sm' : 'text-slate-500 hover:text-slate-900'}`}
                        >
                            棚卸表モード
                        </button>
                    </div>
                </div>

                <div className="flex items-center gap-3">
                    <button
                        onClick={handlePrint}
                        className="flex items-center gap-2 bg-blue-600 text-white px-6 py-3 rounded-2xl text-sm font-black shadow-xl shadow-blue-500/20 hover:bg-blue-700 transition-all active:scale-95"
                    >
                        <Printer size={18} />
                        印刷を実行
                    </button>
                    <button
                        onClick={onClose}
                        className="p-3 bg-slate-100 text-slate-500 hover:bg-slate-200 rounded-2xl transition-all"
                    >
                        <X size={24} />
                    </button>
                </div>
            </div>

            {/* Scrollable Preview Area */}
            <div className="flex-1 overflow-auto p-8 bg-slate-800/50 flex flex-col items-center gap-8 no-scrollbar print:bg-white print:p-0 print:block">
                {pages.map((pageItems, pageIdx) => (
                    <div
                        key={pageIdx}
                        className="bg-white w-[210mm] min-h-[297mm] shadow-2xl p-[15mm] flex flex-col print:shadow-none print:w-full print:min-h-0 print:p-0 print:m-0 print:break-after-page"
                        style={{ boxSizing: 'border-box' }}
                    >
                        {/* Page Header */}
                        <div className="flex justify-between items-start mb-6 border-b-4 border-slate-900 pb-4">
                            <div>
                                <h1 className="text-3xl font-black text-slate-900 tracking-tighter">
                                    {printMode === 'price' ? '資材単価表' : '棚卸・在庫確認表'}
                                </h1>
                                <div className="flex items-center gap-4 mt-2">
                                    <span className="text-xs font-bold text-slate-500 uppercase tracking-widest border px-2 py-0.5 rounded">
                                        {printMode === 'price' ? 'Price List' : 'Inventory Sheet'}
                                    </span>
                                    <span className="text-xs font-bold text-slate-500">
                                        作成日: {new Date().toLocaleDateString('ja-JP')}
                                    </span>
                                </div>
                            </div>
                            <div className="text-right">
                                <div className="text-[10px] font-black text-slate-400 uppercase tracking-widest leading-none">対象顧客 / 出力範囲</div>
                                <div className="text-lg font-black text-slate-900 mt-1">{customerName || '標準 (定型リスト)'}</div>
                                <div className="text-xs font-bold text-slate-400 mt-0.5">Page {pageIdx + 1} / {pages.length}</div>
                            </div>
                        </div>

                        {/* Table Content */}
                        <table className="w-full border-collapse border-y-2 border-slate-900">
                            <thead>
                                <tr className="bg-slate-50 text-[10px] font-black text-slate-600 uppercase tracking-widest border-b border-slate-300">
                                    {printMode === 'price' ? (
                                        <>
                                            <th className="p-2 border-x w-10 text-center">No</th>
                                            <th className="p-2 border-x w-32">分類</th>
                                            <th className="p-2 border-x">品名 / 型名</th>
                                            <th className="p-2 border-x w-24">寸法</th>
                                            <th className="p-2 border-x w-24 text-right">定価</th>
                                            <th className="p-2 border-x w-28 text-right bg-blue-50 text-blue-700">適用単価</th>
                                        </>
                                    ) : (
                                        <>
                                            <th className="p-2 border-x w-32">保管場所</th>
                                            <th className="p-2 border-x">品名 / 型名</th>
                                            <th className="p-2 border-x w-24 text-center">前回在庫</th>
                                            <th className="p-2 border-x w-24 text-center bg-emerald-50 text-emerald-700">実在庫記入</th>
                                            <th className="p-2 border-x w-32">備考 / メモ</th>
                                        </>
                                    )}
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-200">
                                {pageItems.map((row, idx) => {
                                    if ('type' in row && row.type === 'header') {
                                        return (
                                            <tr key={`header-${idx}`} className="bg-slate-900 text-white">
                                                <td colSpan={5} className="p-1 px-4 text-[10px] font-black uppercase tracking-[0.2em] flex items-center gap-2">
                                                    <MapPin size={10} className="text-blue-400" />
                                                    保管場所: {row.label}
                                                </td>
                                            </tr>
                                        );
                                    }
                                    const item = row as MaterialItem;
                                    return (
                                        <tr key={item.id} className="text-xs font-bold hover:bg-slate-50 transition-colors">
                                            {printMode === 'price' ? (
                                                <>
                                                    <td className="p-2 border-x text-center text-[10px] text-slate-400">{(pageIdx * itemsPerPage) + idx + 1}</td>
                                                    <td className="p-2 border-x truncate max-w-[120px]">{item.category}</td>
                                                    <td className="p-2 border-x">
                                                        <div className="flex flex-col">
                                                            <span className="text-slate-900">{item.name}</span>
                                                            <span className="text-[9px] text-slate-400 font-normal">{item.model || '-'}</span>
                                                        </div>
                                                    </td>
                                                    <td className="p-2 border-x font-mono text-center">{item.dimensions || '-'}</td>
                                                    <td className="p-2 border-x text-right font-mono text-slate-500">
                                                        {(item.listPrice && item.listPrice > 0) ? `¥${item.listPrice.toLocaleString()}` : 'OPEN'}
                                                    </td>
                                                    <td className="p-2 border-x text-right font-mono text-blue-700 bg-blue-50/30">
                                                        ¥{(item.sellingPrice || 0).toLocaleString()}
                                                    </td>
                                                </>
                                            ) : (
                                                <>
                                                    <td className="p-2 border-x font-black text-slate-900 bg-slate-50/50">
                                                        <div className="flex items-center gap-1">
                                                            <MapPin size={10} className="text-slate-400" />
                                                            {item.location || '-'}
                                                        </div>
                                                    </td>
                                                    <td className="p-2 border-x">
                                                        <div className="flex flex-col">
                                                            <span className="text-slate-900">{item.name}</span>
                                                            <span className="text-[9px] text-slate-400 font-normal">{item.model || '-'} / {item.dimensions || '-'}</span>
                                                        </div>
                                                    </td>
                                                    <td className="p-2 border-x text-center font-mono text-slate-400">
                                                        {(item.quantity || 0).toLocaleString()} {item.unit}
                                                    </td>
                                                    <td className="p-2 border-x bg-emerald-50/30"></td>
                                                    <td className="p-2 border-x text-[9px] text-slate-400 font-normal">{item.notes || ''}</td>
                                                </>
                                            )}
                                        </tr>
                                    );
                                })}
                                {/* Pad empty rows if last page is short */}
                                {pageItems.length < itemsPerPage && Array.from({ length: itemsPerPage - pageItems.length }).map((_, i) => (
                                    <tr key={`empty-${i}`} className="h-8">
                                        {Array.from({ length: printMode === 'price' ? 6 : 5 }).map((__, j) => (
                                            <td key={j} className="p-2 border-x"></td>
                                        ))}
                                    </tr>
                                ))}
                            </tbody>
                        </table>

                        {/* Page Footer */}
                        <div className="mt-auto pt-6 border-t-2 border-slate-200 flex justify-between items-center text-[10px] font-bold text-slate-400 uppercase tracking-widest">
                            <div>Source: Antigravity Material Master Management System</div>
                            <div className="flex items-center gap-4">
                                <span>Print: {new Date().toLocaleString('ja-JP')}</span>
                                <span className="text-slate-900 border-l pl-4">Page {pageIdx + 1} / {pages.length}</span>
                            </div>
                        </div>
                    </div>
                ))}
            </div>

            <style>{`
        @media print {
          @page { size: A4 portrait; margin: 0mm; }
          body { background: white; }
          .no-scrollbar::-webkit-scrollbar { display: none; }
        }
      `}</style>
        </div>
    );
};
