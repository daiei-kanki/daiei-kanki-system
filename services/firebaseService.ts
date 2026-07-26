
import {
    collection,
    onSnapshot,
    addDoc,
    updateDoc,
    deleteDoc,
    doc,
    getDoc,
    query,
    where,
    getDocs,
    writeBatch,
    increment,
    getCountFromServer,
    Unsubscribe,
    deleteField
} from 'firebase/firestore';
import { signInWithPopup, signOut, onAuthStateChanged, User } from 'firebase/auth';
import { db, auth, googleProvider } from '../firebaseConfig';
import { Material, Customer, PricingRule, Slip, Estimate, PurchaseOrder, AppSettings } from '../types';

const COLLECTIONS = {
    MATERIALS: 'materials',
    CUSTOMERS: 'customers',
    RULES: 'pricingRules',
    SLIPS: 'slips',
    ESTIMATES: 'estimates',
    PURCHASE_ORDERS: 'purchaseOrders',
    SETTINGS: 'settings'
};

export const subscribeToAuth = (callback: (user: User | null) => void) => {
    return onAuthStateChanged(auth, callback);
};

export const loginWithGoogle = () => signInWithPopup(auth, googleProvider);
export const logout = () => signOut(auth);

const subscribe = <T extends { id: string }>(collectionName: string, callback: (data: T[]) => void): Unsubscribe => {
    // NOTE: orderBy('updatedAt') は updatedAt フィールドが存在しないドキュメントを
    // クエリから除外してしまうため、フィルタなしで全件取得しクライアント側でソートする。
    const q = collection(db, collectionName);
    return onSnapshot(q, (snapshot) => {
        const data = snapshot.docs.map(doc => {
            const { id: _, ...docData } = doc.data() as any;
            // Ensure doc.id is used as the primary identifier
            return { ...docData, id: doc.id } as T;
        });
        // updatedAt の降順ソートをクライアント側で実施
        data.sort((a: any, b: any) => (b.updatedAt || 0) - (a.updatedAt || 0));
        callback(data);
    }, (err) => console.error(`Sync Error [${collectionName}]:`, err));
};

export const subscribeToMaterials = (cb: (m: Material[]) => void): Unsubscribe => subscribe<Material>(COLLECTIONS.MATERIALS, cb);
export const subscribeToCustomers = (cb: (c: Customer[]) => void): Unsubscribe => subscribe<Customer>(COLLECTIONS.CUSTOMERS, cb);
export const subscribeToPricingRules = (cb: (r: PricingRule[]) => void): Unsubscribe => subscribe<PricingRule>(COLLECTIONS.RULES, cb);
export const subscribeToSlips = (cb: (s: Slip[]) => void): Unsubscribe => subscribe<Slip>(COLLECTIONS.SLIPS, cb);
export const subscribeToEstimates = (cb: (e: Estimate[]) => void): Unsubscribe => subscribe<Estimate>(COLLECTIONS.ESTIMATES, cb);
export const subscribeToPurchaseOrders = (cb: (po: PurchaseOrder[]) => void): Unsubscribe => subscribe<PurchaseOrder>(COLLECTIONS.PURCHASE_ORDERS, cb);
export const subscribeToSettings = (cb: (s: AppSettings | null) => void): Unsubscribe => {
    const q = query(collection(db, COLLECTIONS.SETTINGS));
    return onSnapshot(q, (snapshot) => {
        if (snapshot.empty) {
            cb(null);
        } else {
            const doc = snapshot.docs[0];
            cb({ id: doc.id, ...doc.data() } as any);
        }
    });
};

export const addMaterial = async (m: Omit<Material, 'id' | 'updatedAt'>) => {
    const { ...data } = m;
    
    // 重複チェック: 分類・品名・型式・寸法が全て一致するものを探す
    const q = query(
        collection(db, COLLECTIONS.MATERIALS),
        where('category', '==', data.category),
        where('name', '==', data.name),
        where('model', '==', data.model),
        where('dimensions', '==', data.dimensions)
    );
    const snap = await getDocs(q);
    if (!snap.empty) {
        throw new Error('DUPLICATE_MATERIAL');
    }

    const docRef = await addDoc(collection(db, COLLECTIONS.MATERIALS), { ...data, updatedAt: Date.now() });
    return docRef.id;
};

export const updateMaterial = async (id: string, m: Partial<Material>) => {
    const { id: _, ...data } = m as any;
    
    // undefined を deleteField() に変換
    const cleanData: any = {};
    for (const [key, value] of Object.entries(data)) {
        if (value === undefined) {
            cleanData[key] = deleteField();
        } else {
            cleanData[key] = value;
        }
    }

    const docRef = doc(db, COLLECTIONS.MATERIALS, id);
    await updateDoc(docRef, { ...cleanData, updatedAt: Date.now() });
};

export const deleteMaterial = async (id: string) => {
    await deleteDoc(doc(db, COLLECTIONS.MATERIALS, id));
};

export const bulkDeleteMaterials = async (ids: string[]) => {
    const batch = writeBatch(db);
    ids.forEach(id => {
        const ref = doc(db, COLLECTIONS.MATERIALS, id);
        batch.delete(ref);
    });
    await batch.commit();
};

export const bulkUpdateMaterialsPrice = async (
    items: Material[],
    ids: string[],
    method: 'list_percent' | 'cost_markup' | 'list_to_cost',
    percent: number
) => {
    const batch = writeBatch(db);
    const selectedItems = items.filter(i => ids.includes(i.id));

    selectedItems.forEach(item => {
        let updateData: any = { updatedAt: Date.now() };

        if (method === 'list_percent' && item.listPrice > 0) {
            updateData.sellingPrice = Math.round(item.listPrice * (percent / 100));
        } else if (method === 'cost_markup' && item.costPrice > 0) {
            updateData.sellingPrice = Math.round(item.costPrice * (1 + (percent / 100)));
        } else if (method === 'list_to_cost' && item.listPrice > 0) {
            updateData.costPrice = Math.round(item.listPrice * (percent / 100));
        }

        if (Object.keys(updateData).length > 1) {
            const ref = doc(db, COLLECTIONS.MATERIALS, item.id);
            batch.update(ref, updateData);
        }
    });
    await batch.commit();
};

export const bulkSetCategory = async (ids: string[], newCategory: string) => {
    const batch = writeBatch(db);
    ids.forEach(id => {
        const ref = doc(db, COLLECTIONS.MATERIALS, id);
        batch.update(ref, { category: newCategory, updatedAt: Date.now() });
    });
    await batch.commit();
};

export const importMaterials = async (items: Partial<Material>[]) => {
    // Firestoreのバッチ書き込みは500件が上限のため、チャンクに分割して処理する
    const CHUNK_SIZE = 499;
    for (let i = 0; i < items.length; i += CHUNK_SIZE) {
        const chunk = items.slice(i, i + CHUNK_SIZE);
        const batch = writeBatch(db);
        chunk.forEach(item => {
            const { id: _, ...data } = item as any;
            const ref = doc(collection(db, COLLECTIONS.MATERIALS));
            batch.set(ref, { ...data, updatedAt: Date.now() });
        });
        await batch.commit();
    }
};

export const addCustomer = async (c: Omit<Customer, 'id'>) => {
    const docRef = await addDoc(collection(db, COLLECTIONS.CUSTOMERS), { ...c, updatedAt: Date.now() });
    return docRef.id;
};
export const updateCustomer = async (id: string, c: Partial<Customer>) => {
    const docRef = doc(db, COLLECTIONS.CUSTOMERS, id);
    await updateDoc(docRef, { ...c, updatedAt: Date.now() });
};
export const deleteCustomer = (id: string) => deleteDoc(doc(db, COLLECTIONS.CUSTOMERS, id));

export const addPricingRule = async (r: Omit<PricingRule, 'id'>) => {
    const docRef = await addDoc(collection(db, COLLECTIONS.RULES), { ...r, updatedAt: Date.now() });
    return docRef.id;
};
export const updatePricingRule = async (id: string, r: Partial<PricingRule>) => {
    const docRef = doc(db, COLLECTIONS.RULES, id);
    await updateDoc(docRef, { ...r, updatedAt: Date.now() });
};
export const deletePricingRule = (id: string) => deleteDoc(doc(db, COLLECTIONS.RULES, id));

export const addSlip = async (s: Omit<Slip, 'id'>) => {
    const data = sanitizeData(s);
    const docRef = await addDoc(collection(db, COLLECTIONS.SLIPS), { ...data, updatedAt: Date.now() });
    return docRef.id;
};
export const updateSlip = async (id: string, data: Partial<Slip>) => {
    const sanitizedData = removeUndefined(data);
    const docRef = doc(db, COLLECTIONS.SLIPS, id);
    await updateDoc(docRef, { ...sanitizedData, updatedAt: Date.now() });
};
export const deleteSlip = (id: string) => deleteDoc(doc(db, COLLECTIONS.SLIPS, id));

const removeUndefined = (obj: any): any => {
    if (Array.isArray(obj)) {
        return obj.map(item => removeUndefined(item));
    }
    if (typeof obj === 'object' && obj !== null) {
        const cleaned: any = {};
        Object.keys(obj).forEach(key => {
            const value = obj[key];
            if (value !== undefined) {
                cleaned[key] = removeUndefined(value);
            }
        });
        return cleaned;
    }
    return obj;
};

const sanitizeData = (obj: any, isRoot = true) => {
    const sanitized: any = {};
    Object.keys(obj).forEach(key => {
        if (key === 'id' && isRoot) return; // Only strip ID at the root level
        const value = obj[key];
        if (value === undefined) return;
        if (Array.isArray(value)) {
            sanitized[key] = value.map(item => (typeof item === 'object' && item !== null) ? sanitizeData(item, false) : item);
        } else if (typeof value === 'object' && value !== null) {
            sanitized[key] = sanitizeData(value, false);
        } else {
            sanitized[key] = value;
        }
    });
    return sanitized;
};

export const addEstimate = async (e: Omit<Estimate, 'id'>) => {
    const data = sanitizeData(e);
    const docRef = await addDoc(collection(db, COLLECTIONS.ESTIMATES), { ...data, updatedAt: Date.now() });
    return docRef.id;
};

export const updateEstimate = async (id: string, e: Partial<Estimate>) => {
    const { id: _, ...rest } = e as any;
    const data = removeUndefined(rest);
    const docRef = doc(db, COLLECTIONS.ESTIMATES, id);
    await updateDoc(docRef, { ...data, updatedAt: Date.now() });
};
export const deleteEstimate = (id: string) => deleteDoc(doc(db, COLLECTIONS.ESTIMATES, id));

export const addPurchaseOrder = async (po: Omit<PurchaseOrder, 'id'>) => {
    const data = sanitizeData(po);
    const docRef = await addDoc(collection(db, COLLECTIONS.PURCHASE_ORDERS), { ...data, updatedAt: Date.now() });
    return docRef.id;
};

export const updatePurchaseOrder = async (id: string, po: Partial<PurchaseOrder>) => {
    const { id: _, ...rest } = po as any;
    const data = removeUndefined(rest);
    const docRef = doc(db, COLLECTIONS.PURCHASE_ORDERS, id);
    await updateDoc(docRef, { ...data, updatedAt: Date.now() });
};

export const deletePurchaseOrder = (id: string) => deleteDoc(doc(db, COLLECTIONS.PURCHASE_ORDERS, id));

export const updateSettings = async (id: string, s: Partial<AppSettings>) => {
    const { id: _, ...rest } = s as any;
    const data = removeUndefined(rest);
    if (id === 'new') {
        return addDoc(collection(db, COLLECTIONS.SETTINGS), { ...data, updatedAt: Date.now() });
    }
    const docRef = doc(db, COLLECTIONS.SETTINGS, id);
    await updateDoc(docRef, { ...data, updatedAt: Date.now() });
};

export const updateMaterialQuantity = async (id: string, delta: number) => {
    const docRef = doc(db, COLLECTIONS.MATERIALS, id);
    await updateDoc(docRef, {
        quantity: increment(delta),
        updatedAt: Date.now()
    });
};

export const receivePurchaseOrderItems = async (items: { id: string, quantity: number }[]) => {
    const batch = writeBatch(db);
    items.forEach(item => {
        const ref = doc(db, COLLECTIONS.MATERIALS, item.id);
        batch.update(ref, {
            quantity: increment(item.quantity),
            updatedAt: Date.now()
        });
    });
    await batch.commit();
};

export const markSlipAsHandled = async (id: string) => {
    const docRef = doc(db, COLLECTIONS.SLIPS, id);
    await updateDoc(docRef, { isHandled: true, updatedAt: Date.now() });
};

/** 診断用: Firestoreのmaterialsコレクションの実際のドキュメント数を返す */
export const countMaterialsInFirestore = async (): Promise<number> => {
    const snap = await getCountFromServer(collection(db, COLLECTIONS.MATERIALS));
    return snap.data().count;
};

/**
 * 重複資材を削除する。
 * name + model + dimensions + category が完全一致するものを重複とみなし、
 * updatedAt が最新のものだけ残して残りを削除する。
 *
 * 【安全ガード】
 * - model と dimensions がどちらも空の場合は「情報不足」とみなし重複判定から除外する
 *   （品名だけ同じ別規格が誤削除されるリスクを防ぐ）
 * - 削除対象が 50 件を超える場合は呼び出し元で確認を求めること
 * 削除件数を返す。
 */
export const deduplicateMaterials = async (items: Material[]): Promise<number> => {
    // 重複グループをまとめる
    const groups = new Map<string, Material[]>();
    for (const item of items) {
        const name  = (item.name  || '').trim();
        const model = (item.model || '').trim();
        const dims  = (item.dimensions || '').trim();
        const cat   = (item.category   || '').trim();

        // 品名が空、または model・dimensions が両方空の場合は重複判定しない
        // （寸法で区別される規格品が誤削除されるのを防ぐ）
        if (!name || (!model && !dims)) continue;

        const key = [name, model, dims, cat].join('||');
        if (!groups.has(key)) groups.set(key, []);
        groups.get(key)!.push(item);
    }

    // 重複があるグループから「最新以外」のIDを収集
    const idsToDelete: string[] = [];
    for (const group of groups.values()) {
        if (group.length <= 1) continue;
        // updatedAt が大きい（新しい）順に並べ、先頭1件を残して残りを削除対象に
        group.sort((a, b) => (b.updatedAt || 0) - (a.updatedAt || 0));
        idsToDelete.push(...group.slice(1).map(i => i.id));
    }

    if (idsToDelete.length === 0) return 0;

    // 500件ずつバッチ削除
    const CHUNK = 499;
    for (let i = 0; i < idsToDelete.length; i += CHUNK) {
        const chunk = idsToDelete.slice(i, i + CHUNK);
        const batch = writeBatch(db);
        chunk.forEach(id => batch.delete(doc(db, COLLECTIONS.MATERIALS, id)));
        await batch.commit();
    }

    return idsToDelete.length;
};
