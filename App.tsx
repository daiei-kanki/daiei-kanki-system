import React, { useState, useEffect, useMemo, useRef } from 'react';
import { User } from 'firebase/auth';
import { collection, getDocs, doc, updateDoc, setDoc } from 'firebase/firestore';
import { db } from './firebaseConfig';
import { Plus, Package, Search, Loader2, Settings, ClipboardList, Trash2, X, Sparkles, Cloud, Zap, FolderTree, RotateCcw, Save, FileText, Calculator, ArrowRight, CheckCircle2, ChevronDown, LayoutGrid, Droplet, Layers, CircleDot, Box, Wrench, Thermometer, Hammer, Anchor, ShieldCheck, ThermometerSnowflake, Container, Gauge, Construction, Settings2, UserCheck, SearchCode, Database, History, TrendingUp, ShoppingCart, AlertTriangle } from 'lucide-react';
import { MaterialItem, SortConfig, SortField, PricingRule, SlipItem, Slip, Customer, MATERIAL_CATEGORIES, DeliveryDestination, Estimate, AppSettings } from './types';
import { MaterialForm } from './components/MaterialForm';
import { MaterialTable } from './components/MaterialTable';
import { MaterialQuickSearch } from './components/MaterialQuickSearch';
import { StatsCard } from './components/StatsCard';
import { PricingManager } from './components/PricingManager';
import { SlipManager } from './components/SlipManager';
import { EstimateManager } from './components/EstimateManager';
import { MaterialPrintPage } from './components/MaterialPrintPage';
import { PurchaseOrderManager } from './components/PurchaseOrderManager';
import { SettingsManager } from './components/SettingsManager';
import { AITakahashi } from './components/AITakahashi';
import { LinkUserManagement } from './components/LinkUserManagement';
import { generateMaterialsFromFile } from './services/geminiService';
import * as storage from './services/firebaseService';
import { deduplicateMaterials } from './services/firebaseService';
import { normalizeForSearch, filterAndSortItems, getAppliedPrice } from './services/searchUtils';
import * as XLSX from 'xlsx';

const App: React.FC = () => {
    const [items, setItems] = useState<MaterialItem[]>([]);
    const [isInitializing, setIsInitializing] = useState(false);
    const [currentUser, setCurrentUser] = useState<User | null>(null);
    const [isAuthLoading, setIsAuthLoading] = useState(true);
    const [customers, setCustomers] = useState<Customer[]>([]);
    const [pricingRules, setPricingRules] = useState<PricingRule[]>([]);
    const [slips, setSlips] = useState<Slip[]>([]);
    const [estimates, setEstimates] = useState<Estimate[]>([]);
    const [settings, setSettings] = useState<AppSettings | null>(null);

    const [activeCustomer, setActiveCustomer] = useState<string | null>(null);
    const [activeSite, setActiveSite] = useState<string | null>(null);
    const [sortConfig, setSortConfig] = useState<SortConfig>({ field: 'name', direction: 'asc' });

    const [isFormOpen, setIsFormOpen] = useState(false);
    const [isPricingManagerOpen, setIsPricingManagerOpen] = useState(false);
    const [isEstimateManagerOpen, setIsEstimateManagerOpen] = useState(false);
    const [isMasterViewOpen, setIsMasterViewOpen] = useState(false);
    const [isQuickSearchOpen, setIsQuickSearchOpen] = useState(false);
    const [isPOManagerOpen, setIsPOManagerOpen] = useState(false);
    const [isLinkUserManagementOpen, setIsLinkUserManagementOpen] = useState(false);

    // SlipManager制御用
    const [slipManagerOpen, setSlipManagerOpen] = useState(false);
    const [slipManagerInitialTab, setSlipManagerInitialTab] = useState<'create' | 'pending' | 'reslip' | 'history'>('create');
    const [isEditingSlip, setIsEditingSlip] = useState(false);
    const [isPrintPageOpen, setIsPrintPageOpen] = useState(false);
    const [isSettingsOpen, setIsSettingsOpen] = useState(false);
    const [printItems, setPrintItems] = useState<MaterialItem[]>([]);

    const [editingItem, setEditingItem] = useState<MaterialItem | null>(null);
    const [loadingAI, setLoadingAI] = useState(false);
    const [searchQuery, setSearchQuery] = useState('');
    const [cart, setCart] = useState<SlipItem[]>([]);

    const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set<string>());

    const fileInputRef = useRef<HTMLInputElement>(null);
    const restoreInputRef = useRef<HTMLInputElement>(null);
    const excelRestoreInputRef = useRef<HTMLInputElement>(null);

    const runMigration = async () => {
        if (!confirm('IDベースへのデータ移行を開始しますか？')) return;
        try {
            setLoadingAI(true);
            const customersSnap = await getDocs(collection(db, 'customers'));
            const customersMap = new Map();
            customersSnap.docs.forEach(d => {
                const data = d.data();
                customersMap.set(data.name, { id: d.id, ...data, sites: data.sites || [] });
            });

            const collectionsToMigrate = ['slips', 'estimates', 'pricingRules', 'purchaseOrders'];
            let updatedCount = 0;
            
            for (const collName of collectionsToMigrate) {
                const snap = await getDocs(collection(db, collName));
                for (const docSnap of snap.docs) {
                    const data = docSnap.data();
                    if (data.customerId && data.siteId) continue; // Already migrated

                    const cName = data.customerName || data.supplierName;
                    const sName = data.constructionName || data.siteName;
                    
                    if (!cName) continue;

                    let customer = customersMap.get(cName);
                    if (!customer) {
                        // Create new customer if missing
                        const newRef = doc(collection(db, 'customers'));
                        customer = { id: newRef.id, name: cName, sites: [], createdAt: Date.now() };
                        customersMap.set(cName, customer);
                        await setDoc(newRef, customer);
                    }

                    const updates: any = { customerId: customer.id };
                    
                    if (sName) {
                        let site = customer.sites.find((s: any) => s.name === sName);
                        if (!site) {
                            site = { id: crypto.randomUUID(), name: sName };
                            customer.sites.push(site);
                            await updateDoc(doc(db, 'customers', customer.id), { sites: customer.sites });
                        }
                        updates.siteId = site.id;
                    }

                    await updateDoc(docSnap.ref, updates);
                    updatedCount++;
                }
            }
            alert(`マイグレーション完了！ ${updatedCount} 件のドキュメントを更新しました。`);
        } catch (e) {
            console.error('Migration failed:', e);
            alert('マイグレーションに失敗しました。コンソールを確認してください。');
        } finally {
            setLoadingAI(false);
        }
    };

    const pendingOutboundsCount = useMemo(() =>
        slips.filter(s => s.type === 'outbound' && !s.isClosed).length,
        [slips]);

    useEffect(() => {
        const unsubAuth = storage.subscribeToAuth(user => { setCurrentUser(user); setIsAuthLoading(false); });
        return unsubAuth;
    }, []);

    useEffect(() => {
        if (isAuthLoading) return;
        if (!currentUser) {
            // 未認証の場合はデータ購読しない（ログイン画面を表示するためisInitializingはfalseのまま）
            setIsInitializing(false);
            return;
        }
        setIsInitializing(true);
        const unsubItems = storage.subscribeToMaterials(setItems);
        const unsubCustomers = storage.subscribeToCustomers(setCustomers);
        const unsubRules = storage.subscribeToPricingRules(setPricingRules);
        const unsubSlips = storage.subscribeToSlips(setSlips);
        const unsubEstimates = storage.subscribeToEstimates(setEstimates);
        const unsubSettings = storage.subscribeToSettings(setSettings);
        setIsInitializing(false);
        return () => {
            unsubItems(); unsubCustomers(); unsubRules(); unsubSlips(); unsubEstimates(); unsubSettings();
        };
    }, [currentUser, isAuthLoading]);

    // 改定予定日チェック：改定日になった資材を自動適用
    useEffect(() => {
        if (items.length === 0) return;
        const today = new Date().toISOString().slice(0, 10);
        const dueItems = items.filter(item =>
            item.scheduledPriceDate &&
            item.scheduledPriceDate <= today &&
            (item.scheduledListPrice !== undefined || item.scheduledCostPrice !== undefined || item.scheduledSellingPrice !== undefined)
        );
        if (dueItems.length === 0) return;

        // 自動適用：旧価格を退避して新価格をセット（仕入値・売値は掛け率スライド）
        Promise.all(dueItems.map(item => {
            const newListPrice = item.scheduledListPrice ?? item.listPrice;

            // 旧定価に対する仕入値・売値の掛け率を算出してスライド
            // 旧定価が0のときはそのまま据え置き
            const costRate    = (item.listPrice > 0 && item.costPrice > 0)
                ? item.costPrice    / item.listPrice : null;
            const sellingRate = (item.listPrice > 0 && item.sellingPrice > 0)
                ? item.sellingPrice / item.listPrice : null;

            const newCostPrice    = costRate    !== null ? Math.round(newListPrice * costRate)    : item.costPrice;
            const newSellingPrice = sellingRate !== null ? Math.round(newListPrice * sellingRate) : item.sellingPrice;

            const updates: Partial<typeof item> = {
                priceUpdatedDate: item.scheduledPriceDate,
                // 旧価格を退避
                previousListPrice: item.listPrice,
                previousCostPrice: item.costPrice,
                // 新価格を適用
                listPrice:    newListPrice,
                costPrice:    newCostPrice,
                sellingPrice: newSellingPrice,
                // 予告情報をクリア
                scheduledListPrice:    undefined,
                scheduledCostPrice:    undefined,
                scheduledSellingPrice: undefined,
                scheduledPriceDate:    undefined,
            };
            return storage.updateMaterial(item.id, updates);
        })).then(() => {
            if (dueItems.length > 0) {
                console.log(`[予告改定] ${dueItems.length}件の価格改定を自動適用（仕入値・売値は掛け率スライド）。`);
            }
        }).catch(err => console.error('予告改定自動適用エラー:', err));
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [items.length > 0 ? items[0]?.updatedAt : 0]);

    const handleAIUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;
        setLoadingAI(true);
        try {
            const results = await generateMaterialsFromFile(file, '消耗品・雑材');
            if (results.length > 0) {
                await storage.importMaterials(results);
                alert(`${results.length}件の資材をインポートしました。`);
            }
        } catch (err) {
            alert("AI解析中にエラーが発生しました。");
        } finally {
            setLoadingAI(false);
            if (fileInputRef.current) fileInputRef.current.value = '';
        }
    };

    const handleLocalExport = () => {
        try {
            const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(items, null, 2));
            const downloadAnchorNode = document.createElement('a');
            downloadAnchorNode.setAttribute("href", dataStr);
            downloadAnchorNode.setAttribute("download", `daiei_kanki_backup_${new Date().toISOString().slice(0, 10)}.json`);
            document.body.appendChild(downloadAnchorNode);
            downloadAnchorNode.click();
            downloadAnchorNode.remove();
        } catch (err) { alert("保存に失敗しました。"); }
    };

    const handleLocalRestore = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;

        try {
            const reader = new FileReader();
            reader.onload = async (re) => {
                try {
                    const json = JSON.parse(re.target?.result as string);
                    if (!Array.isArray(json)) {
                        alert("無効なバックアップファイル形式です。");
                        return;
                    }
                    if (window.confirm(`${json.length}件の資材データを復元（追加）しますか？`)) {
                        setLoadingAI(true);
                        await storage.importMaterials(json);
                        alert("復元が完了しました。");
                    }
                } catch (e) {
                    alert("ファイルの解析に失敗しました。JSON形式であることを確認してください。");
                }
            };
            reader.readAsText(file);
        } catch (err) {
            alert("読み込み中にエラーが発生しました。");
        } finally {
            if (restoreInputRef.current) restoreInputRef.current.value = '';
            setLoadingAI(false);
        }
    };

    const handleExcelExport = (format: 'xlsx' | 'csv') => {
        try {
            const exportData = items.map(item => ({
                'カテゴリー': item.category,
                '品名': item.name,
                '型式・仕様': item.model,
                '寸法・サイズ': item.dimensions,
                '定価': item.listPrice,
                '標準売価': item.sellingPrice,
                '仕入原価': item.costPrice,
                '単位': item.unit,
                '備考': item.notes || '',
                '最終更新日時': item.updatedAt ? new Date(item.updatedAt).toLocaleString() : ''
            }));

            const worksheet = XLSX.utils.json_to_sheet(exportData);
            const workbook = XLSX.utils.book_new();
            XLSX.utils.book_append_sheet(workbook, worksheet, "MaterialMaster");
            
            const fileName = `MaterialMaster_${new Date().toISOString().slice(0, 10)}.${format}`;
            XLSX.writeFile(workbook, fileName);
        } catch (err) {
            alert(`${format.toUpperCase()}の書き出しに失敗しました。`);
        }
    };

    const handleExcelRestore = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;
        try {
            const data = await file.arrayBuffer();
            const workbook = XLSX.read(data);
            const sheet = workbook.Sheets[workbook.SheetNames[0]];
            const rows: any[] = XLSX.utils.sheet_to_json(sheet);

            if (rows.length === 0) { alert('データが見つかりませんでした。'); return; }

            // Excelの列名 → Materialフィールドにマッピング
            const mapped = rows.map(row => ({
                category:     String(row['カテゴリー'] || row['category'] || '消耗品・雑材'),
                name:         String(row['品名']       || row['name']     || ''),
                model:        String(row['型式・仕様'] || row['model']    || ''),
                dimensions:   String(row['寸法・サイズ']|| row['dimensions'] || ''),
                listPrice:    Number(row['定価']       || row['listPrice']  || 0),
                sellingPrice: Number(row['標準売価']   || row['sellingPrice']|| 0),
                costPrice:    Number(row['仕入原価']   || row['costPrice']  || 0),
                unit:         String(row['単位']       || row['unit']    || '個'),
                notes:        String(row['備考']       || row['notes']   || ''),
                quantity:     Number(row['数量']       || row['quantity']|| 0),
                location:     String(row['保管場所']   || row['location']|| ''),
                manufacturer: String(row['メーカー']   || row['manufacturer'] || ''),
            })).filter(r => r.name); // 品名がないものは除外

            if (!window.confirm(`${mapped.length.toLocaleString()}件のExcelデータをインポートしますか？\n（既存データへの追加になります）`)) return;
            setLoadingAI(true);
            await storage.importMaterials(mapped);
            alert(`${mapped.length.toLocaleString()}件をインポートしました。`);
        } catch (err) {
            alert('Excelの読み込みに失敗しました。列名を確認してください。');
        } finally {
            setLoadingAI(false);
            if (excelRestoreInputRef.current) excelRestoreInputRef.current.value = '';
        }
    };

    const handleBulkDelete = async (ids: string[]) => {
        try {
            await storage.bulkDeleteMaterials(ids);
            setSelectedIds(new Set());
        } catch (e) { alert("一括削除中にエラーが発生しました。"); }
    };

    const handleBulkUpdate = async (updates: { id: string; data: Partial<MaterialItem> }[]) => {
        try {
            await Promise.all(updates.map(u => storage.updateMaterial(u.id, u.data)));
            alert(`${updates.length}件の資材を更新しました。`);
            setSelectedIds(new Set());
        } catch (e) { alert("一括更新中にエラーが発生しました。"); }
    };

    const handleMasterAccess = async () => {
        const correctPassword = settings?.adminPassword || '0000';
        const password = window.prompt('資材管理パスワードを入力してください:');

        if (password === correctPassword) {
            setIsMasterViewOpen(true);
        } else if (password !== null) {
            if (settings?.securityQuestion && settings?.securityAnswer) {
                const wantsReset = window.confirm('パスワードが違います。秘密の質問でパスワードを再設定しますか？');
                if (wantsReset) {
                    const answer = window.prompt(`秘密の質問: ${settings.securityQuestion}`);
                    if (answer === settings.securityAnswer) {
                        const newPassword = window.prompt('新しいパスワードを設定してください:');
                        if (newPassword && newPassword.trim()) {
                            await storage.updateSettings(settings.id || 'new', {
                                ...settings,
                                adminPassword: newPassword.trim()
                            });
                            alert('パスワードを更新しました。新しいパスワードでログインしてください。');
                        }
                    } else if (answer !== null) {
                        alert('答えが間違っています。');
                    }
                }
            } else {
                alert('パスワードが間違っています。');
            }
        }
    };

    const dashboardActions = [
        {
            title: '出庫・返品処理',
            desc: '現場への出庫、返品の作成。出庫待ち・欠品伝票の管理を行います。',
            icon: ClipboardList,
            color: 'bg-blue-600',
            action: () => { setSlipManagerInitialTab('create'); setSlipManagerOpen(true); }
        },
        {
            title: '伝票・請求履歴',
            desc: '確定した納品書・返品伝票の閲覧、および請求書の一括発行を行います。',
            icon: History,
            color: 'bg-emerald-600',
            action: () => { setSlipManagerInitialTab('history'); setSlipManagerOpen(true); }
        },
        {
            title: '見積書管理',
            desc: '新規見積の作成、履歴確認、伝票への変換を行います。',
            icon: FileText,
            color: 'bg-amber-500',
            action: () => setIsEstimateManagerOpen(true)
        },
        {
            title: '資材クイック検索',
            desc: '在庫と価格の確認専用画面（編集不可）',
            icon: SearchCode,
            color: 'bg-indigo-600',
            action: () => setIsQuickSearchOpen(true)
        },
        {
            title: '発注・入荷管理',
            desc: '仕入先への発注書作成と、入荷時の自動在庫更新を行います。',
            icon: ShoppingCart,
            color: 'bg-emerald-600',
            action: () => setIsPOManagerOpen(true)
        },
        {
            title: '資材・単価管理',
            desc: 'マスター登録、AIインポート、顧客別単価を設定します。',
            icon: Database,
            color: 'bg-slate-900',
            action: handleMasterAccess
        },
        {
            title: '環境設定・口座設定',
            desc: '自社情報（名称、住所、T番号）および振込先口座の編集。これらは各種帳票に自動反映されます。',
            icon: Settings2,
            color: 'bg-slate-700',
            action: () => setIsSettingsOpen(true)
        },
        {
            title: 'LINKユーザー管理',
            desc: 'COREXIA LINK (顧客用アプリ) の利用申請の承認・管理を行います。',
            icon: UserCheck,
            color: 'bg-rose-600',
            action: () => setIsLinkUserManagementOpen(true)
        }
    ];

    // Firebase Auth の初期化待ち（通常は数百ms以内）
    if (isAuthLoading) return (
        <div className="h-screen flex items-center justify-center bg-slate-50">
            <div className="flex flex-col items-center gap-4">
                <Loader2 className="animate-spin text-blue-600" size={40} />
                <p className="text-slate-400 text-sm font-bold">認証情報を確認中...</p>
            </div>
        </div>
    );

    // 未ログイン時はGoogleログイン画面を表示
    if (!currentUser) return (
        <div className="h-screen flex items-center justify-center bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900">
            <div className="bg-white/5 backdrop-blur-xl border border-white/10 rounded-[3rem] p-16 flex flex-col items-center gap-8 shadow-2xl max-w-md w-full mx-4">
                <div className="flex flex-col items-center gap-3">
                    <div className="w-16 h-16 bg-blue-600 rounded-2xl flex items-center justify-center shadow-xl">
                        <Cloud size={32} className="text-white" />
                    </div>
                    <h1 className="text-3xl font-black text-white tracking-tight">COREXIA <span className="text-blue-400">core</span></h1>
                    <p className="text-slate-400 text-xs font-bold uppercase tracking-widest">Business Management System</p>
                </div>
                <div className="w-full h-px bg-white/10" />
                <div className="flex flex-col items-center gap-3 text-center">
                    <p className="text-slate-300 text-sm font-medium">このシステムはGoogleアカウント認証が必要です。</p>
                    <p className="text-slate-500 text-xs">ご登録済みのGoogleアカウントでログインしてください。</p>
                </div>
                <button
                    onClick={() => storage.loginWithGoogle()}
                    className="w-full flex items-center justify-center gap-3 bg-white text-slate-800 font-black py-4 px-8 rounded-2xl shadow-xl hover:bg-slate-50 hover:shadow-2xl active:scale-95 transition-all duration-200 text-base"
                >
                    <svg className="w-5 h-5" viewBox="0 0 24 24">
                        <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
                        <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
                        <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
                        <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
                    </svg>
                    Googleでログイン
                </button>
                <p className="text-slate-600 text-[10px] text-center">アクセス権限のないアカウントではデータを閲覧できません。</p>
            </div>
        </div>
    );

    if (isInitializing) return <div className="h-screen flex items-center justify-center bg-slate-50"><Loader2 className="animate-spin text-blue-600" /></div>;

    return (
        <div className="flex flex-col h-screen bg-slate-50 overflow-hidden font-['Inter','Noto_Sans_JP'] print:h-auto print:overflow-visible">
            {/* Header */}
            <header className="h-20 bg-white border-b flex items-center justify-between px-10 shrink-0 z-50 shadow-sm print:hidden">
                <div className="flex items-center gap-4">
                    <div className="flex items-center gap-4">
                        <div className="flex items-center">
                            <img src="./logo.png" alt="COREXIA core" className="h-14 w-auto" />
                            <div className="ml-3 flex flex-col justify-center">
                                <h1 className="text-2xl font-black text-slate-800 tracking-tight leading-none">COREXIA <span className="text-blue-600">core</span></h1>
                            </div>
                        </div>
                    </div>
                </div>

                <div className="flex items-center gap-6">
                    <div className="hidden md:flex flex-col items-end">
                        <span className="text-[10px] text-slate-400 font-black uppercase tracking-widest">System Status</span>
                        <div className="flex items-center gap-2">
                            <div className="w-2 h-2 bg-emerald-500 rounded-full animate-pulse"></div>
                            <span className="text-xs font-bold text-slate-600">Connected to Firebase</span>
                        </div>
                    </div>
                    <button onClick={() => setIsSettingsOpen(true)} className="p-3 bg-slate-100 text-slate-600 hover:bg-slate-200 rounded-2xl transition-all" title="環境設定">
                        <Settings2 size={22} />
                    </button>
                    <button onClick={() => setIsPOManagerOpen(true)} className="p-3 bg-slate-100 text-slate-600 rounded-2xl hover:bg-emerald-50 hover:text-emerald-600 transition-all group relative" title="発注・入荷管理">
                        <ShoppingCart size={22} />
                        <span className="absolute -bottom-8 left-1/2 -translate-x-1/2 bg-slate-800 text-white text-[10px] py-1 px-2 rounded opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap pointer-events-none">発注・入荷管理</span>
                    </button>
                    <button onClick={() => { setSlipManagerInitialTab('create'); setSlipManagerOpen(true); }} className={`relative p-3 rounded-2xl transition-all ${cart.length > 0 ? 'bg-blue-600 text-white shadow-xl' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'}`}>
                        <ClipboardList size={22} />
                        {cart.length > 0 && <span className="absolute -top-1 -right-1 bg-rose-500 text-white text-[10px] font-black w-6 h-6 flex items-center justify-center rounded-full border-2 border-white">{cart.length}</span>}
                    </button>
                </div>
            </header>

            {/* Dashboard */}
            <main className="flex-1 overflow-y-auto bg-slate-50 p-8 lg:p-12 print:hidden">
                <div className="max-w-6xl mx-auto space-y-12">
                    <div className="flex flex-col md:flex-row md:items-end justify-between gap-6">
                        <div>
                            {pendingOutboundsCount > 0 && (
                                <div
                                    onClick={() => { setSlipManagerInitialTab('create'); setSlipManagerOpen(true); }}
                                    className="mb-8 bg-amber-50 border-2 border-amber-200 p-6 rounded-[2.5rem] flex items-center justify-between shadow-sm cursor-pointer hover:bg-amber-100 transition-all group animate-in slide-in-from-top-4 duration-500"
                                >
                                    <div className="flex items-center gap-4">
                                        <div className="w-14 h-14 bg-amber-500 text-white rounded-2xl flex items-center justify-center shadow-lg group-hover:scale-110 transition-transform">
                                            <AlertTriangle size={28} />
                                        </div>
                                        <div>
                                            <h3 className="text-xl font-black text-amber-900 tracking-tight">{pendingOutboundsCount}件の未対応入伝があります</h3>
                                            <p className="text-xs text-amber-700 font-bold opacity-80">出庫待ち伝票・LINKからの注文が届いています。内容を確認して出庫処理を完了させてください。</p>
                                        </div>
                                    </div>
                                    <div className="bg-amber-900/10 text-amber-900 px-6 py-3 rounded-2xl text-xs font-black flex items-center gap-2 group-hover:bg-amber-900/20 transition-colors">
                                        詳細を確認 <ArrowRight size={16} />
                                    </div>
                                </div>
                            )}
                            <h2 className="text-4xl font-black text-slate-900 tracking-tighter">お疲れ様です。</h2>
                            <p className="text-slate-500 font-bold mt-2">今日はどのアクションから開始しますか？</p>
                        </div>
                        <div className="flex gap-4">
                            <StatsCard title="在庫総額(原価)" value={`¥${items.reduce((s, i) => s + ((i.costPrice || 0) * (i.quantity || 0)), 0).toLocaleString()}`} icon={Database} color="rose" compact />
                            <StatsCard title="資材総数" value={items.length.toLocaleString()} icon={Package} color="blue" compact />
                            <StatsCard title="本日の伝票" value={slips.filter(s => s.date === new Date().toISOString().slice(0, 10)).length.toString()} icon={TrendingUp} color="emerald" compact />
                        </div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                        {dashboardActions.map((item, idx) => (
                            <button
                                key={idx}
                                onClick={item.action}
                                className="group relative bg-white p-8 rounded-[2.5rem] shadow-sm hover:shadow-2xl hover:-translate-y-2 transition-all duration-300 text-left border border-slate-100 overflow-hidden"
                            >
                                <div className={`w-14 h-14 ${item.color} text-white rounded-2xl flex items-center justify-center mb-6 shadow-lg group-hover:scale-110 transition-transform duration-300`}>
                                    <item.icon size={28} />
                                </div>
                                <h3 className="text-xl font-black text-slate-900 mb-2">{item.title}</h3>
                                <p className="text-xs text-slate-400 font-bold leading-relaxed">{item.desc}</p>
                                <div className="mt-6 flex items-center gap-2 text-blue-600 text-[10px] font-black uppercase tracking-widest opacity-0 group-hover:opacity-100 transition-opacity">
                                    Open Action <ArrowRight size={14} />
                                </div>
                            </button>
                        ))}
                    </div>
                </div>
            </main>

            {/* Assistants & Modals */}
            {!(slipManagerOpen && (slipManagerInitialTab !== 'create' || isEditingSlip)) && (
                <div className="print:hidden">
                    <AITakahashi
                        masterItems={items}
                        currentScreen={
                            isMasterViewOpen ? 'MASTER_MANAGEMENT' :
                                isEstimateManagerOpen ? 'ESTIMATE_MANAGER' :
                                    (slipManagerOpen && slipManagerInitialTab === 'create') ? 'SLIP_CREATE' :
                                        isQuickSearchOpen ? 'QUICK_SEARCH' :
                                            isPOManagerOpen ? 'PO_MANAGER' :
                                                isSettingsOpen ? 'SETTINGS' : 'TOP'
                        }
                        helpMessage={isMasterViewOpen ? "アイテム追加や価格改定があったら僕に相談しな！" : (isEstimateManagerOpen ? "なんのせ見積手伝うかい？" : (slipManagerOpen && slipManagerInitialTab === 'create' ? "伝票を起こすの手伝うかい？" : undefined))}
                        welcomeMessage={isMasterViewOpen ? "あ、高橋です。なんのせ僕に教えてくれたらやっとくよ？" : (isEstimateManagerOpen ? "あ、高橋です。なんのせFAXやメモの写真からでも見積を作れるから、僕に送ってみてな。もちろん相談しながら手入力で作るのも手伝うよ。" : (slipManagerOpen && slipManagerInitialTab === 'create' ? "なんのせお客さんのメモやFAXの写真からでも伝票起こしてあげるから任せな！" : undefined))}
                        onAddToCart={aiItems => {
                            const slipItems: SlipItem[] = aiItems.map(ni => {
                                const master = items.find(i => i.id === ni.id);
                                const price = master ? getAppliedPrice(master, activeCustomer, activeSite, pricingRules) : (ni.appliedPrice || 0);
                                return {
                                    ...ni,
                                    id: master?.id || `ai-${Date.now()}`,
                                    name: master?.name || ni.name,
                                    model: master?.model || ni.model || "",
                                    dimensions: master?.dimensions || ni.dimensions || "",
                                    unit: master?.unit || ni.unit || "個",
                                    category: master?.category || '消耗品・雑材',
                                    appliedPrice: price,
                                    updatedAt: Date.now()
                                } as SlipItem;
                            });
                             setCart(prev => [...prev, ...slipItems]);
                             setSlipManagerInitialTab('create');
                             setSlipManagerOpen(true);
                         }}
                        onUpdateInfo={info => { if (info.customerName) setActiveCustomer(info.customerName); }}
                        onRegisterItems={async items => {
                            try {
                                await storage.importMaterials(items);
                                alert(`${items.length}件の資材をマスターに登録しました。`);
                            } catch (e) {
                                alert("登録に失敗しました。");
                            }
                        }}
                        onCreateEstimate={async aiItems => {
                            const today = new Date();
                            const valid = new Date(); valid.setDate(today.getDate() + 30);
                            const newEst: Omit<Estimate, 'id'> = {
                                createdAt: Date.now(), date: today.toISOString().slice(0, 10), validUntil: valid.toISOString().slice(0, 10),
                                customerName: activeCustomer || '（要確認）', constructionName: activeSite || '', 
                                items: aiItems.map(i => {
                                    const master = items.find(mi => mi.id === i.id);
                                    const price = master ? getAppliedPrice(master as any, activeCustomer, activeSite, pricingRules) : (i.appliedPrice || 0);
                                    return {
                                        ...i,
                                        name: master?.name || i.name,
                                        model: master?.model || i.model || "",
                                        dimensions: master?.dimensions || i.dimensions || "",
                                        unit: master?.unit || i.unit || "個",
                                        category: master?.category || "消耗品・雑材",
                                        appliedPrice: price,
                                        deliveredQuantity: 0,
                                        updatedAt: Date.now()
                                    };
                                }),
                                totalAmount: 0, taxAmount: 0, grandTotal: 0, status: 'pending', deliveryTime: 'none', deliveryDestination: 'none',
                                slipNumber: `EST-${Math.random().toString(36).substring(2, 8).toUpperCase()}`
                            };
                            // 再計算した合計をセット
                            newEst.totalAmount = newEst.items.reduce((s, i) => s + (i.appliedPrice * i.quantity), 0);
                            await storage.addEstimate(newEst);
                            setIsEstimateManagerOpen(true);
                        }}
                    />
                </div>
            )}

            {isMasterViewOpen && (
                <div className="fixed inset-0 z-[100] bg-slate-900/60 backdrop-blur-md flex items-center justify-center p-4 lg:p-8 animate-in fade-in zoom-in-95 duration-200">
                    <div className="bg-white rounded-[3rem] shadow-2xl w-full max-w-7xl h-full flex flex-col overflow-hidden">
                        <div className="p-6 border-b flex justify-between items-center bg-slate-50/50">
                            <div className="flex items-center gap-4">
                                <div className="w-10 h-10 md:w-12 md:h-12 bg-slate-900 text-white rounded-2xl flex items-center justify-center shadow-lg shrink-0"><Database size={20} className="md:w-6 md:h-6" /></div>
                                <div><h2 className="text-lg md:text-2xl font-black text-slate-900 tracking-tight">資材マスター管理</h2><p className="hidden md:block text-[10px] text-slate-400 font-bold uppercase tracking-widest mt-0.5">Inventory & Pricing Control</p></div>
                            </div>
                            <div className="flex items-center gap-2 md:gap-3">
                                <button onClick={() => { setEditingItem(null); setIsFormOpen(true); }} className="flex items-center gap-2 bg-blue-600 text-white p-3 md:px-6 md:py-3 rounded-2xl text-xs font-black shadow-lg hover:bg-blue-700 transition-all active:scale-95">
                                    <Plus size={18} /> <span className="hidden md:inline">資材新規登録</span>
                                </button>
                                <button onClick={() => setIsPricingManagerOpen(true)} className="flex items-center gap-2 bg-indigo-600 text-white p-3 md:px-6 md:py-3 rounded-2xl text-xs font-black shadow-lg hover:bg-indigo-700 transition-all active:scale-95">
                                    <UserCheck size={18} /> <span className="hidden md:inline">顧客設定</span>
                                </button>
                                <button onClick={() => setIsPOManagerOpen(true)} className="flex items-center gap-2 bg-emerald-600 text-white p-3 md:px-6 md:py-3 rounded-2xl text-xs font-black shadow-lg hover:bg-emerald-700 transition-all active:scale-95">
                                    <ShoppingCart size={18} /> <span className="hidden md:inline">発注・入荷管理</span>
                                </button>
                                <div className="h-8 w-px bg-slate-200 mx-1 md:mx-2"></div>
                                <button onClick={() => { setIsMasterViewOpen(false); setSelectedIds(new Set()); }} className="p-3 bg-slate-100 hover:bg-slate-200 rounded-2xl transition-all"><X size={24} /></button>
                            </div>
                        </div>
                        <div className="flex-1 overflow-hidden flex flex-col p-8">
                            <MaterialTable
                                items={filterAndSortItems(items, searchQuery)}
                                pricingRules={pricingRules} customers={customers} activeCustomer={activeCustomer} activeSite={activeSite}
                                onCustomerChange={(name) => { setActiveCustomer(name); setActiveSite(null); }} onSiteChange={setActiveSite}
                                onEdit={item => { setEditingItem(item); setIsFormOpen(true); }} onDelete={id => window.confirm('削除しますか？') && storage.deleteMaterial(id)}
                                onAddToSlip={(item, price) => {
                                    setCart(p => [...p, { ...item, quantity: 0, appliedPrice: price }]);
                                    setIsMasterViewOpen(false); setSlipManagerInitialTab('create'); setSlipManagerOpen(true);
                                }}
                                sortConfig={sortConfig} onSort={(f) => setSortConfig(p => ({ field: f, direction: p.field === f && p.direction === 'asc' ? 'desc' : 'asc' }))}
                                selectedIds={selectedIds} onToggleSelect={id => { const n = new Set(selectedIds); if (n.has(id)) n.delete(id); else n.add(id); setSelectedIds(n); }}
                                onSelectAll={ids => { const n = new Set(selectedIds); if (ids.every(id => selectedIds.has(id))) ids.forEach(id => n.delete(id)); else ids.forEach(id => n.add(id)); setSelectedIds(n); }}
                                onBulkDelete={handleBulkDelete}
                                onBulkUpdate={handleBulkUpdate}
                                onPrint={(items) => { setPrintItems(items); setIsPrintPageOpen(true); }}
                            />
                        </div>
                        <div className="p-4 bg-slate-50 border-t flex justify-start gap-4 px-10">
                            <button onClick={handleLocalExport} className="flex items-center gap-2 text-slate-500 hover:text-indigo-600 text-[10px] font-black uppercase transition-all"><Database size={14} /> JSONバックアップ</button>
                            <input type="file" ref={restoreInputRef} onChange={handleLocalRestore} className="hidden" accept=".json" />
                            <button onClick={() => restoreInputRef.current?.click()} className="flex items-center gap-2 text-slate-500 hover:text-orange-600 text-[10px] font-black uppercase transition-all"><RotateCcw size={14} /> JSONから復元</button>
                            <input type="file" ref={excelRestoreInputRef} onChange={handleExcelRestore} className="hidden" accept=".xlsx,.xls,.csv" />
                            <button onClick={() => excelRestoreInputRef.current?.click()} className="flex items-center gap-2 text-slate-500 hover:text-emerald-600 text-[10px] font-black uppercase transition-all"><FileText size={14} /> Excelから復元</button>
                            <button onClick={runMigration} className="flex items-center gap-2 text-slate-500 hover:text-orange-600 text-[10px] font-black uppercase transition-all"><Database size={14} /> データマイグレーション実行</button>
                            <button
                                onClick={async () => {
                                    // ---- 事前計算（dry-run）----
                                    const groups = new Map<string, typeof items>();
                                    for (const item of items) {
                                        const name  = (item.name  || '').trim();
                                        const model = (item.model || '').trim();
                                        const dims  = (item.dimensions || '').trim();
                                        const cat   = (item.category   || '').trim();
                                        if (!name || (!model && !dims)) continue;
                                        const key = [name, model, dims, cat].join('||');
                                        if (!groups.has(key)) groups.set(key, []);
                                        groups.get(key)!.push(item);
                                    }
                                    const toDelete: typeof items = [];
                                    groups.forEach(group => {
                                        if (group.length <= 1) return;
                                        const sorted = [...group].sort((a, b) => (b.updatedAt || 0) - (a.updatedAt || 0));
                                        toDelete.push(...sorted.slice(1));
                                    });

                                    if (toDelete.length === 0) {
                                        return alert('重複している資材は見つかりませんでした。');
                                    }

                                    // ---- 削除対象のプレビュー表示 ----
                                    const preview = toDelete.slice(0, 20).map(i =>
                                        `・${i.name} [${i.model || ''}] ${i.dimensions || ''} (${i.category})`
                                    ).join('\n');
                                    const moreCount = toDelete.length > 20 ? `\n… 他 ${toDelete.length - 20} 件` : '';

                                    const confirmed = window.confirm(
                                        `【重複除去】${toDelete.length} 件を削除しようとしています。\n\n` +
                                        `【削除対象（各グループの古い方）】\n${preview}${moreCount}\n\n` +
                                        `【重複判定の条件】\n「品名＋型式＋寸法＋カテゴリ」が完全一致するもの\n→ 更新日が古い方を削除します\n\n` +
                                        `⚠️ この操作は取り消せません。\n本当によろしいですか？`
                                    );
                                    if (!confirmed) return;

                                    // 10件超は二重確認
                                    if (toDelete.length > 10) {
                                        const doubleConfirm = window.confirm(
                                            `⚠️ 最終確認：${toDelete.length} 件を削除します。\n` +
                                            `削除後は元に戻せません。\n実行しますか？`
                                        );
                                        if (!doubleConfirm) return;
                                    }

                                    try {
                                        setLoadingAI(true);
                                        const deleted = await deduplicateMaterials(items);
                                        alert(`✅ 重複除去完了！\n${deleted.toLocaleString()} 件の重複を削除しました。`);
                                    } catch (e) {
                                        alert('エラーが発生しました: ' + e);
                                    } finally {
                                        setLoadingAI(false);
                                    }
                                }}
                                className="flex items-center gap-2 text-slate-500 hover:text-rose-600 text-[10px] font-black uppercase transition-all"
                            >
                                <Trash2 size={14} /> 重複除去
                            </button>
                            <button onClick={() => handleExcelExport('xlsx')} className="flex items-center gap-2 text-slate-500 hover:text-emerald-600 text-[10px] font-black uppercase transition-all"><FileText size={14} /> MASTER EXCEL出力</button>
                            <button onClick={() => handleExcelExport('csv')} className="flex items-center gap-2 text-slate-500 hover:text-emerald-600 text-[10px] font-black uppercase transition-all"><FileText size={14} /> MASTER CSV出力</button>
                        </div>
                    </div>
                </div>
            )}

            {/* Hidden file input for AI upload */}
            <input type="file" ref={fileInputRef} onChange={handleAIUpload} className="hidden" accept=".xlsx,.xls,.csv,image/*,application/pdf" />

            {isFormOpen && <MaterialForm isOpen={isFormOpen} onClose={() => { setIsFormOpen(false); setEditingItem(null); }} onSave={async data => { try { if (editingItem) await storage.updateMaterial(editingItem.id, data); else await storage.addMaterial(data); setIsFormOpen(false); setEditingItem(null); } catch (e: any) { if (e.message === 'DUPLICATE_MATERIAL') { alert('エラー：この資材（分類・品名・型式・寸法）は既に登録されています。重複登録はできません。'); } else { alert('保存に失敗しました。'); console.error(e); } } }} initialData={editingItem} settings={settings} items={items} onUpdateCategories={async (cats) => { if (settings) await storage.updateSettings(settings.id || 'new', { ...settings, categories: cats }); }} />}
            {isPricingManagerOpen && <PricingManager rules={pricingRules} customers={customers} items={items} onClose={() => setIsPricingManagerOpen(false)} />}
            {slipManagerOpen && (
                <SlipManager
                    mode="sales"
                    initialTab={slipManagerInitialTab as 'create' | 'pending' | 'reslip' | 'history'}
                    onClose={() => setSlipManagerOpen(false)}
                    cart={cart} onUpdateCart={setCart} onClearCart={() => setCart([])}
                    defaultCustomer={activeCustomer}
                    customers={customers}
                    pricingRules={pricingRules}
                    masterItems={items}
                    settings={settings}
                    onTabChange={(tab) => setSlipManagerInitialTab(tab)}
                    onEditModeChange={setIsEditingSlip}
                />
            )}
            {isEstimateManagerOpen && (
                <EstimateManager
                    masterItems={items}
                    settings={settings}
                    customers={customers}
                    onClose={() => setIsEstimateManagerOpen(false)}
                    onConvertToSlip={(items, cust, site) => {
                        setCart(items);
                        setActiveCustomer(cust);
                        if (site) setActiveSite(site);
                        setSlipManagerInitialTab('create');
                        setSlipManagerOpen(true);
                    }}
                />
            )}
            {isPOManagerOpen && (
                <PurchaseOrderManager
                    masterItems={items}
                    settings={settings}
                    onClose={() => setIsPOManagerOpen(false)}
                />
            )}

            {isSettingsOpen && (
                <SettingsManager
                    settings={settings}
                    onClose={() => setIsSettingsOpen(false)}
                />
            )}

            {isQuickSearchOpen && (
                <MaterialQuickSearch
                    items={items}
                    customers={customers}
                    pricingRules={pricingRules}
                    activeCustomer={activeCustomer}
                    activeSite={activeSite}
                    onClose={() => setIsQuickSearchOpen(false)}
                />
            )}

            {isLinkUserManagementOpen && (
                <div className="fixed inset-0 z-[100] bg-slate-900/60 backdrop-blur-md flex items-center justify-center p-4 lg:p-8 animate-in fade-in zoom-in-95 duration-200">
                    <div className="bg-white rounded-[2.5rem] shadow-2xl w-full max-w-5xl h-[85vh] flex flex-col overflow-hidden relative border border-white/20">
                        <button
                            onClick={() => setIsLinkUserManagementOpen(false)}
                            className="absolute top-6 right-6 p-2 bg-slate-100 hover:bg-slate-200 rounded-full transition-colors z-50 text-slate-500 hover:text-slate-800"
                        >
                            <X size={20} />
                        </button>
                        <LinkUserManagement />
                    </div>
                </div>
            )}

            {isPrintPageOpen && (
                <MaterialPrintPage
                    items={printItems}
                    mode="price"
                    customerName={activeCustomer}
                    onClose={() => setIsPrintPageOpen(false)}
                />
            )}

            <style>{`
        .no-scrollbar::-webkit-scrollbar { display: none; }
        .no-scrollbar { -ms-overflow-style: none; scrollbar-width: none; }
      `}</style>
        </div>
    );
};

export default App;
