
import React, { useState, useMemo } from 'react';
import { PricingRule, MaterialItem, Customer, MATERIAL_CATEGORIES } from '../types';
import { normalizeForSearch, filterAndSortItems } from '../services/searchUtils';
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
    const [view, setView] = useState<'list' | 'edit' | 'orphaned'>('list');
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

    const [orphanedFilter, setOrphanedFilter] = useState<'all' | 'auto_ready' | 'dims_diff' | 'duplicate' | 'no_match'>('all');
    const [orphanedSearchQuery, setOrphanedSearchQuery] = useState('');
    const [manualSearchRuleId, setManualSearchRuleId] = useState<string | null>(null);
    const [manualSearchQuery, setManualSearchQuery] = useState('');

    const isDiagnosticReady = items.length > 0;
    const masterItemMap = useMemo(() => new Map(items.map(i => [i.id, i])), [items]);
    const orphanedRulesList = useMemo(() => {
        if (!isDiagnosticReady) return [];
        return rules.filter(r => r.materialId && !masterItemMap.has(r.materialId));
    }, [rules, masterItemMap, isDiagnosticReady]);
    const orphanedRulesCount = orphanedRulesList.length;

    // 資材マスターの高速索引と各不整合ルールの診断結果（理由・候補・自動修復対象かどうか）
    const orphanedDiagnostics = useMemo(() => {
        if (!isDiagnosticReady) return [];

        const by4Key = new Map<string, MaterialItem[]>();
        const by3Key = new Map<string, MaterialItem[]>();
        const byNameKey = new Map<string, MaterialItem[]>();

        items.forEach(item => {
            const nName = normalizeForSearch(item.name);
            const nCat = normalizeForSearch(item.category);
            const nModel = normalizeForSearch(item.model || '');
            const nDims = normalizeForSearch(item.dimensions || '');
            if (!nName) return;

            const k4 = `${nName}__${nCat}__${nModel}__${nDims}`;
            const k3 = `${nName}__${nCat}__${nModel}`;
            if (!by4Key.has(k4)) by4Key.set(k4, []);
            by4Key.get(k4)!.push(item);

            if (!by3Key.has(k3)) by3Key.set(k3, []);
            by3Key.get(k3)!.push(item);

            if (!byNameKey.has(nName)) byNameKey.set(nName, []);
            byNameKey.get(nName)!.push(item);
        });

        // 既に有効な資材IDを持つ生きた単価ルールの索引 (顧客 + 現場 + 資材ID)
        const liveRuleScopeSet = new Set<string>();
        rules.forEach(r => {
            if (r.materialId && masterItemMap.has(r.materialId)) {
                const sKey = `${normalizeForSearch(r.customerName)}__${normalizeForSearch(r.siteName || '')}__${r.materialId}`;
                liveRuleScopeSet.add(sKey);
            }
        });

        // 4項目一致（候補1件）の不整合ルールについて、同一顧客・同一現場・同一資材に複数ある場合は最新(updatedAt最大)の1本だけを自動修復対象にする
        const bestOrphanRuleIdByScope = new Map<string, { ruleId: string; updatedAt: number }>();
        orphanedRulesList.forEach(r => {
            const nName = normalizeForSearch(r.materialName || '');
            const nCat = normalizeForSearch(r.category || '');
            const nModel = normalizeForSearch(r.model || '');
            const nDims = normalizeForSearch(r.dimensions || '');
            const exact = nName ? (by4Key.get(`${nName}__${nCat}__${nModel}__${nDims}`) || []) : [];
            if (exact.length === 1) {
                const targetMat = exact[0];
                const sKey = `${normalizeForSearch(r.customerName)}__${normalizeForSearch(r.siteName || '')}__${targetMat.id}`;
                if (!liveRuleScopeSet.has(sKey)) {
                    const prev = bestOrphanRuleIdByScope.get(sKey);
                    const rTime = r.updatedAt || 0;
                    if (!prev || rTime > prev.updatedAt) {
                        bestOrphanRuleIdByScope.set(sKey, { ruleId: r.id, updatedAt: rTime });
                    }
                }
            }
        });

        return orphanedRulesList.map(r => {
            const nName = normalizeForSearch(r.materialName || '');
            const nCat = normalizeForSearch(r.category || '');
            const nModel = normalizeForSearch(r.model || '');
            const nDims = normalizeForSearch(r.dimensions || '');

            const exactCandidates = nName ? (by4Key.get(`${nName}__${nCat}__${nModel}__${nDims}`) || []) : [];
            const threeFieldCandidates = nName ? (by3Key.get(`${nName}__${nCat}__${nModel}`) || []) : [];
            const nameCandidates = nName ? (byNameKey.get(nName) || []) : [];

            let reasonType: 'auto_ready' | 'duplicate_live' | 'duplicate_orphan' | 'multi_exact' | 'dims_diff' | 'name_only' | 'no_match' = 'no_match';
            let reasonLabel = '一致する資材候補なし（候補0件）';
            let suggestedCandidates: MaterialItem[] = [];
            let canAutoRelink = false;

            if (exactCandidates.length === 1) {
                const targetMat = exactCandidates[0];
                const sKey = `${normalizeForSearch(r.customerName)}__${normalizeForSearch(r.siteName || '')}__${targetMat.id}`;
                suggestedCandidates = exactCandidates;
                if (liveRuleScopeSet.has(sKey)) {
                    reasonType = 'duplicate_live';
                    reasonLabel = '同一資材に有効な単価ルールが既に存在（重複のため自動付け替え除外）';
                } else if (bestOrphanRuleIdByScope.get(sKey)?.ruleId !== r.id) {
                    reasonType = 'duplicate_orphan';
                    reasonLabel = '同一資材に別の新しい単価ルールが存在（旧ルール重複のため自動付け替え除外）';
                } else {
                    reasonType = 'auto_ready';
                    reasonLabel = '4項目完全一致（候補1件・自動修復対象）';
                    canAutoRelink = true;
                }
            } else if (exactCandidates.length > 1) {
                reasonType = 'multi_exact';
                reasonLabel = `4項目一致候補が複数あり（候補 ${exactCandidates.length}件）`;
                suggestedCandidates = exactCandidates;
            } else if (threeFieldCandidates.length > 0) {
                reasonType = 'dims_diff';
                reasonLabel = `寸法のみ不一致（品名・分類・型式一致の候補 ${threeFieldCandidates.length}件）`;
                suggestedCandidates = threeFieldCandidates;
            } else if (nameCandidates.length > 0) {
                reasonType = 'name_only';
                reasonLabel = `分類または型式・寸法が不一致（同名の資材候補 ${nameCandidates.length}件）`;
                suggestedCandidates = nameCandidates;
            }

            return {
                rule: r,
                reasonType,
                reasonLabel,
                suggestedCandidates,
                canAutoRelink
            };
        });
    }, [isDiagnosticReady, items, rules, masterItemMap, orphanedRulesList]);

    const handleBackupPricingRulesJson = () => {
        try {
            const payload = {
                exportedAt: new Date().toISOString(),
                totalRules: rules.length,
                orphanedCount: orphanedRulesCount,
                rules
            };
            const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(payload, null, 2));
            const a = document.createElement('a');
            a.setAttribute('href', dataStr);
            a.setAttribute('download', `単価ルール控え_${new Date().toISOString().slice(0, 10)}.json`);
            document.body.appendChild(a);
            a.click();
            a.remove();
        } catch (e) {
            console.error('Backup export failed:', e);
        }
    };

    const handleManualRelinkRule = async (rule: PricingRule, targetMat: MaterialItem) => {
        if (!window.confirm(
            `以下の単価ルールを選択した資材へ紐付けますか？\n\n` +
            `【ルール】${rule.customerName} (${rule.siteName || '全現場共通'}) / ${rule.materialName || '(未設定)'} / 型式:${rule.model || 'なし'} / 寸法:${rule.dimensions || 'なし'}\n` +
            `【紐付け先資材】${targetMat.name} / 分類:${targetMat.category} / 型式:${targetMat.model || 'なし'} / 寸法:${targetMat.dimensions || 'なし'} (標準売価: ¥${(targetMat.sellingPrice || 0).toLocaleString()})`
        )) {
            return;
        }
        setIsSaving(true);
        try {
            // updatedAt は元の値を維持して背番号(materialId)のみ付け替える
            await storage.updatePricingRule(rule.id, { materialId: targetMat.id }, { preserveTimestamp: true });
            if (manualSearchRuleId === rule.id) {
                setManualSearchRuleId(null);
                setManualSearchQuery('');
            }
        } catch (err: any) {
            alert(`紐付けに失敗しました: ${err?.message || '不明なエラー'}`);
        } finally {
            setIsSaving(false);
        }
    };

    const handleDeleteOrphanedRule = async (rule: PricingRule) => {
        const valText = rule.method === 'fixed_price' ? `固定 ¥${rule.value.toLocaleString()}` : (rule.method === 'percent_of_list' ? `定価の ${rule.value}%` : `原価+${rule.value}%`);
        if (!window.confirm(
            `「${rule.customerName}（${rule.siteName || '全現場共通'}）」の不整合単価ルールを削除してもよろしいですか？\n\n` +
            `品名: ${rule.materialName || '(未設定)'} / 分類: ${rule.category || '(未設定)'} / 型式: ${rule.model || '(なし)'} / 寸法: ${rule.dimensions || '(なし)'} (${valText})\n` +
            `※この操作は取り消せません。`
        )) {
            return;
        }
        setIsSaving(true);
        try {
            await storage.deletePricingRule(rule.id);
        } catch (err: any) {
            alert(`削除に失敗しました: ${err?.message || '不明なエラー'}`);
        } finally {
            setIsSaving(false);
        }
    };

    const handleRepairPricingRuleIds = async () => {
        if (!isDiagnosticReady) {
            return alert("⚠️ 資材マスターがまだ読み込まれていません。読み込み完了後に再度お試しください。");
        }
        if (orphanedDiagnostics.length === 0) {
            return alert("✅ すべての単価ルールの資材IDは正常です（実在しない資材IDは0件です）。");
        }

        const autoTargets = orphanedDiagnostics.filter(d => d.canAutoRelink && d.suggestedCandidates.length === 1);
        const dupSkippedCount = orphanedDiagnostics.filter(d => d.reasonType === 'duplicate_live' || d.reasonType === 'duplicate_orphan').length;
        const dimsDiffCount = orphanedDiagnostics.filter(d => d.reasonType === 'dims_diff').length;
        const otherHoldCount = orphanedDiagnostics.length - autoTargets.length;

        const confirmRun = window.confirm(
            `🔍 単価ルールの背番号（資材ID）診断結果:\n` +
            `実在しない資材IDを持つ単価ルールが【 ${orphanedDiagnostics.length} 件 】検出されました。\n\n` +
            `・4項目完全一致（候補1件・重複なし）で自動再紐付け可能: ${autoTargets.length} 件\n` +
            `・同一資材に新しいルールが存在するため保持（上書き防止）: ${dupSkippedCount} 件\n` +
            `・寸法のみ不一致（不整合一覧で候補から手動選択可能）: ${dimsDiffCount} 件\n` +
            `・その他の要確認保持: ${otherHoldCount - dupSkippedCount - dimsDiffCount} 件\n\n` +
            `【安全な自動照合・修復を実行しますか？】\n` +
            `※ 実行前に単価ルール全件のバックアップ控え(JSON)を自動保存し、元の更新日時(updatedAt)を変えずに背番号のみ付け替えます。`
        );

        if (!confirmRun) return;

        // 実行前に単価ルール全件の控えを自動ダウンロード保存
        handleBackupPricingRulesJson();

        setIsSaving(true);
        let relinkedCount = 0;

        try {
            const updatePromises = autoTargets.map(d => {
                relinkedCount++;
                // updatedAt を変更せず元のまま保持することで、後から登録した新しい単価ルールより優先される逆転現象を防ぐ
                return storage.updatePricingRule(d.rule.id, { materialId: d.suggestedCandidates[0].id }, { preserveTimestamp: true });
            });

            await Promise.all(updatePromises);
            const remainingCount = orphanedDiagnostics.length - relinkedCount;
            alert(
                `🎉 背番号照合・修復処理が完了しました！\n\n` +
                `・完全一致（候補1件・最新優先）により再紐付け完了: ${relinkedCount} 件\n` +
                `・要確認として保持（ID未変更）: ${remainingCount} 件\n` +
                `・不整合ルール残数: ${remainingCount} 件\n\n` +
                `※ 残りのルールは「不整合一覧を確認」画面から候補を選んで手動紐付け、または不要ルールの整理が行えます。`
            );
        } catch (err: any) {
            alert(`修復処理中にエラーが発生しました: ${err?.message || '不明なエラー'}`);
        } finally {
            setIsSaving(false);
        }
    };

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

    if (view === 'orphaned') {
        const filteredOrphaned = orphanedDiagnostics.filter(d => {
            if (orphanedFilter === 'auto_ready' && !d.canAutoRelink) return false;
            if (orphanedFilter === 'dims_diff' && d.reasonType !== 'dims_diff') return false;
            if (orphanedFilter === 'duplicate' && d.reasonType !== 'duplicate_live' && d.reasonType !== 'duplicate_orphan') return false;
            if (orphanedFilter === 'no_match' && d.reasonType !== 'no_match' && d.reasonType !== 'name_only') return false;
            if (orphanedSearchQuery.trim()) {
                const q = normalizeForSearch(orphanedSearchQuery);
                const targetStr = normalizeForSearch(`${d.rule.customerName} ${d.rule.siteName || ''} ${d.rule.materialName || ''} ${d.rule.category || ''} ${d.rule.model || ''} ${d.rule.dimensions || ''}`);
                if (!targetStr.includes(q)) return false;
            }
            return true;
        });

        const manualSearchResults = (manualSearchRuleId && manualSearchQuery.trim())
            ? filterAndSortItems(items, manualSearchQuery).slice(0, 10)
            : [];

        return (
            <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm z-[110] flex items-center justify-center p-4">
                <div className="bg-white rounded-xl shadow-2xl w-full max-w-5xl overflow-hidden flex flex-col max-h-[90vh]">
                    <div className="p-6 border-b flex justify-between items-center bg-amber-50">
                        <div className="flex items-center gap-3">
                            <button onClick={() => setView('list')} disabled={isSaving} className="p-2 hover:bg-amber-100 rounded-lg"><ArrowLeft size={20} /></button>
                            <div>
                                <h2 className="text-lg font-bold text-amber-900">不整合単価ルール一覧 ({orphanedRulesList.length}件)</h2>
                                <p className="text-xs text-amber-700">実在しない資材IDを指しているルールです。不一致の理由と候補資材を確認し、正しい資材へ手動紐付けするか削除できます。</p>
                            </div>
                        </div>
                        <div className="flex items-center gap-2">
                            <button
                                onClick={handleBackupPricingRulesJson}
                                className="px-3 py-1.5 bg-white border border-amber-300 text-amber-800 hover:bg-amber-100 rounded-lg text-xs font-bold shadow-sm"
                            >
                                控え(JSON)を保存
                            </button>
                            <button onClick={onClose} disabled={isSaving}><X size={24} /></button>
                        </div>
                    </div>
                    <div className="px-6 py-3 bg-white border-b flex flex-wrap items-center justify-between gap-3 text-xs">
                        <div className="flex flex-wrap gap-1.5">
                            <button onClick={() => setOrphanedFilter('all')} className={`px-3 py-1.5 rounded-lg font-bold ${orphanedFilter === 'all' ? 'bg-slate-900 text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'}`}>
                                すべて ({orphanedDiagnostics.length})
                            </button>
                            <button onClick={() => setOrphanedFilter('auto_ready')} className={`px-3 py-1.5 rounded-lg font-bold ${orphanedFilter === 'auto_ready' ? 'bg-emerald-600 text-white' : 'bg-emerald-50 text-emerald-700 hover:bg-emerald-100'}`}>
                                完全一致・修復可 ({orphanedDiagnostics.filter(d => d.canAutoRelink).length})
                            </button>
                            <button onClick={() => setOrphanedFilter('dims_diff')} className={`px-3 py-1.5 rounded-lg font-bold ${orphanedFilter === 'dims_diff' ? 'bg-blue-600 text-white' : 'bg-blue-50 text-blue-700 hover:bg-blue-100'}`}>
                                寸法のみ不一致 ({orphanedDiagnostics.filter(d => d.reasonType === 'dims_diff').length})
                            </button>
                            <button onClick={() => setOrphanedFilter('duplicate')} className={`px-3 py-1.5 rounded-lg font-bold ${orphanedFilter === 'duplicate' ? 'bg-purple-600 text-white' : 'bg-purple-50 text-purple-700 hover:bg-purple-100'}`}>
                                重複・旧ルール ({orphanedDiagnostics.filter(d => d.reasonType === 'duplicate_live' || d.reasonType === 'duplicate_orphan').length})
                            </button>
                            <button onClick={() => setOrphanedFilter('no_match')} className={`px-3 py-1.5 rounded-lg font-bold ${orphanedFilter === 'no_match' ? 'bg-rose-600 text-white' : 'bg-rose-50 text-rose-700 hover:bg-rose-100'}`}>
                                候補なし・型式違い ({orphanedDiagnostics.filter(d => d.reasonType === 'no_match' || d.reasonType === 'name_only').length})
                            </button>
                        </div>
                        <div className="relative w-64">
                            <Search size={14} className="absolute left-3 top-2.5 text-slate-400" />
                            <input
                                value={orphanedSearchQuery}
                                onChange={e => setOrphanedSearchQuery(e.target.value)}
                                placeholder="顧客名・品名・型式で絞り込み..."
                                className="w-full pl-8 pr-3 py-1.5 border rounded-lg font-bold outline-none focus:border-amber-500"
                            />
                        </div>
                    </div>
                    <div className="p-6 overflow-y-auto space-y-3 bg-slate-50 flex-1">
                        {filteredOrphaned.slice(0, 200).map(({ rule: r, reasonType, reasonLabel, suggestedCandidates }) => {
                            const isSearchingThis = manualSearchRuleId === r.id;
                            const badgeColor =
                                reasonType === 'auto_ready' ? 'bg-emerald-50 text-emerald-700 border-emerald-200' :
                                reasonType === 'dims_diff' ? 'bg-blue-50 text-blue-700 border-blue-200' :
                                (reasonType === 'duplicate_live' || reasonType === 'duplicate_orphan') ? 'bg-purple-50 text-purple-700 border-purple-200' :
                                'bg-rose-50 text-rose-700 border-rose-200';
                            return (
                                <div key={r.id} className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm flex flex-col gap-3 text-xs">
                                    <div className="flex justify-between items-start gap-4">
                                        <div className="space-y-1.5">
                                            <div className="flex flex-wrap items-center gap-2">
                                                <span className="font-bold text-slate-900 bg-slate-100 px-2 py-0.5 rounded">{r.customerName}</span>
                                                <span className="text-slate-600 font-bold">{r.siteName || '全現場共通'}</span>
                                                <span className="text-blue-700 font-bold bg-blue-50 px-2 py-0.5 rounded border border-blue-200">
                                                    {r.method === 'fixed_price' ? `固定 ¥${r.value.toLocaleString()}` : (r.method === 'percent_of_list' ? `定価の ${r.value}%` : `原価+${r.value}%`)}
                                                </span>
                                                <span className={`font-bold px-2 py-0.5 rounded border ${badgeColor}`}>
                                                    理由: {reasonLabel}
                                                </span>
                                            </div>
                                            <div className="font-bold text-sm text-slate-800">
                                                品名: {r.materialName || '(未設定)'} / 分類: {r.category || '(未設定)'} / 型式: {r.model || '(なし)'} / 寸法: {r.dimensions || '(なし)'}
                                            </div>
                                            <div className="text-[10px] text-slate-400 font-mono">
                                                旧資材ID: {r.materialId} {r.updatedAt ? `/ 更新日時: ${new Date(r.updatedAt).toLocaleString('ja-JP')}` : ''}
                                            </div>
                                        </div>
                                        <div className="flex items-center gap-2 shrink-0">
                                            <button
                                                onClick={() => {
                                                    if (isSearchingThis) {
                                                        setManualSearchRuleId(null);
                                                        setManualSearchQuery('');
                                                    } else {
                                                        setManualSearchRuleId(r.id);
                                                        setManualSearchQuery(`${r.materialName || ''} ${r.model || ''}`.trim());
                                                    }
                                                }}
                                                disabled={isSaving}
                                                className="px-3 py-1.5 bg-blue-50 text-blue-700 hover:bg-blue-100 border border-blue-200 rounded-lg font-bold flex items-center gap-1"
                                            >
                                                <Search size={14} /> {isSearchingThis ? '検索を閉じる' : '資材を検索して手動紐付け'}
                                            </button>
                                            <button
                                                onClick={() => handleDeleteOrphanedRule(r)}
                                                disabled={isSaving}
                                                className="px-3 py-1.5 bg-rose-50 text-rose-600 hover:bg-rose-100 rounded-lg font-bold flex items-center gap-1"
                                            >
                                                <Trash2 size={14} /> 削除
                                            </button>
                                        </div>
                                    </div>

                                    {/* 自動検出された候補資材がある場合、ワンクリックで手動紐付け可能 */}
                                    {suggestedCandidates.length > 0 && (
                                        <div className="bg-slate-50 p-2.5 rounded-lg border border-slate-200 space-y-1.5">
                                            <div className="text-[11px] font-bold text-slate-600">
                                                候補の資材（クリックしてこのルールを紐付け）:
                                            </div>
                                            <div className="space-y-1 max-h-40 overflow-y-auto">
                                                {suggestedCandidates.slice(0, 8).map(cand => (
                                                    <div key={cand.id} className="flex items-center justify-between gap-2 bg-white px-3 py-1.5 rounded border border-slate-200">
                                                        <div className="truncate font-bold text-slate-700">
                                                            {cand.name} <span className="text-slate-400">|</span> 分類: {cand.category} <span className="text-slate-400">|</span> 型式: {cand.model || '(なし)'} <span className="text-slate-400">|</span> 寸法: <span className="text-blue-700">{cand.dimensions || '(なし)'}</span> <span className="text-slate-400">(標準: ¥{(cand.sellingPrice || 0).toLocaleString()})</span>
                                                        </div>
                                                        <button
                                                            onClick={() => handleManualRelinkRule(r, cand)}
                                                            disabled={isSaving}
                                                            className="px-2.5 py-1 bg-emerald-600 hover:bg-emerald-700 text-white rounded font-bold shrink-0"
                                                        >
                                                            この資材に紐付け
                                                        </button>
                                                    </div>
                                                ))}
                                                {suggestedCandidates.length > 8 && (
                                                    <div className="text-[10px] text-slate-400 pl-1">他 {suggestedCandidates.length - 8} 件の候補（「資材を検索して手動紐付け」から絞り込めます）</div>
                                                )}
                                            </div>
                                        </div>
                                    )}

                                    {/* 自由キーワード検索による手動紐付けパネル */}
                                    {isSearchingThis && (
                                        <div className="bg-blue-50/60 p-3 rounded-lg border border-blue-200 space-y-2">
                                            <div className="flex items-center gap-2">
                                                <Search size={14} className="text-blue-600 shrink-0" />
                                                <input
                                                    value={manualSearchQuery}
                                                    onChange={e => setManualSearchQuery(e.target.value)}
                                                    placeholder="資材マスターから検索（品名・型式・寸法など）..."
                                                    className="w-full px-3 py-1.5 bg-white border border-blue-300 rounded-lg font-bold outline-none focus:ring-2 focus:ring-blue-400"
                                                    autoFocus
                                                />
                                            </div>
                                            <div className="space-y-1 max-h-48 overflow-y-auto">
                                                {manualSearchResults.map(mat => (
                                                    <div key={mat.id} className="flex items-center justify-between gap-2 bg-white px-3 py-1.5 rounded border border-blue-100">
                                                        <div className="truncate font-bold text-slate-700">
                                                            {mat.name} <span className="text-slate-400">|</span> 分類: {mat.category} <span className="text-slate-400">|</span> 型式: {mat.model || '(なし)'} <span className="text-slate-400">|</span> 寸法: <span className="text-blue-700">{mat.dimensions || '(なし)'}</span> <span className="text-slate-400">(標準: ¥{(mat.sellingPrice || 0).toLocaleString()})</span>
                                                        </div>
                                                        <button
                                                            onClick={() => handleManualRelinkRule(r, mat)}
                                                            disabled={isSaving}
                                                            className="px-2.5 py-1 bg-blue-600 hover:bg-blue-700 text-white rounded font-bold shrink-0"
                                                        >
                                                            この資材に紐付け
                                                        </button>
                                                    </div>
                                                ))}
                                                {manualSearchQuery.trim() && manualSearchResults.length === 0 && (
                                                    <div className="text-center py-3 text-slate-400 font-bold">該当する資材が見つかりません</div>
                                                )}
                                            </div>
                                        </div>
                                    )}
                                </div>
                            );
                        })}
                        {filteredOrphaned.length > 200 && (
                            <div className="text-center py-3 text-xs text-slate-500 font-bold">
                                先頭 200 件を表示中（全 {filteredOrphaned.length} 件 — 上部の検索欄またはフィルタで絞り込めます）
                            </div>
                        )}
                        {filteredOrphaned.length === 0 && (
                            <div className="text-center py-12 text-slate-400 font-bold">条件に一致する不整合単価ルールはありません。</div>
                        )}
                    </div>
                </div>
            </div>
        );
    }

    if (view === 'list') {
        const bannerStyle = !isDiagnosticReady
            ? 'bg-slate-100 border-slate-300 text-slate-700'
            : orphanedRulesCount > 0
                ? 'bg-amber-50 border-amber-200 text-amber-900'
                : 'bg-emerald-50 border-emerald-200 text-emerald-900';
        const iconStyle = !isDiagnosticReady
            ? 'text-slate-500'
            : orphanedRulesCount > 0
                ? 'text-amber-600'
                : 'text-emerald-600';

        return (
            <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm z-[110] flex items-center justify-center p-4">
                <div className="bg-white rounded-xl shadow-2xl w-full max-w-2xl overflow-hidden flex flex-col max-h-[90vh]">
                    <div className="p-6 border-b flex justify-between items-center"><h2 className="text-xl font-bold flex items-center gap-3"><Users size={24} className="text-blue-600" /> 顧客設定・単価管理</h2><button onClick={onClose} disabled={isSaving}><X size={24} /></button></div>
                    <div className="p-8 bg-slate-50 flex flex-col gap-8 overflow-y-auto">
                        {/* No.2: 単価ルールの背番号（資材ID）不整合診断・一括自動修復バナー */}
                        <div className={`p-4 rounded-xl border flex items-center justify-between gap-4 ${bannerStyle}`}>
                            <div className="flex items-center gap-3">
                                <AlertCircle size={24} className={iconStyle} />
                                <div>
                                    <h4 className="font-bold text-sm">
                                        {!isDiagnosticReady
                                            ? '単価ルールの資材ID照合: 判定前（資材マスター読み込み中...）'
                                            : orphanedRulesCount > 0
                                                ? `単価ルールの資材ID不整合: ${orphanedRulesCount}件 検出`
                                                : '単価ルールの資材ID照合: 正常 (不整合 0件)'}
                                    </h4>
                                    <p className="text-xs opacity-80 mt-0.5">
                                        {!isDiagnosticReady
                                            ? '資材マスターの読み込み完了後に、単価ルールの資材ID（背番号）の整合性を判定します。'
                                            : orphanedRulesCount > 0
                                                ? '4項目が完全一致するルール（最新優先）を元の更新日時を保ったまま再紐付けし、残りは不整合一覧で手動紐付け・整理できます。'
                                                : 'すべての単価ルールが実在する資材ID（背番号）と正しく紐付いています。'}
                                    </p>
                                </div>
                            </div>
                            <div className="flex gap-2 shrink-0">
                                {isDiagnosticReady && orphanedRulesCount > 0 && (
                                    <button
                                        onClick={() => setView('orphaned')}
                                        disabled={isSaving}
                                        className="px-3 py-2 rounded-lg text-xs font-bold bg-white border border-amber-300 text-amber-800 hover:bg-amber-100 transition-all shadow-sm disabled:opacity-40"
                                    >
                                        不整合一覧を確認
                                    </button>
                                )}
                                <button
                                    onClick={handleRepairPricingRuleIds}
                                    disabled={!isDiagnosticReady || isSaving}
                                    className={`px-4 py-2 rounded-lg text-xs font-bold transition-all shadow-sm disabled:opacity-40 disabled:cursor-not-allowed ${!isDiagnosticReady ? 'bg-slate-400 text-white' : orphanedRulesCount > 0 ? 'bg-amber-600 hover:bg-amber-700 text-white' : 'bg-emerald-600 hover:bg-emerald-700 text-white'}`}
                                >
                                    {!isDiagnosticReady ? '判定準備中...' : orphanedRulesCount > 0 ? '一括照合・修復を実行' : '再診断を実行'}
                                </button>
                            </div>
                        </div>

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
