
import React, { useState, useEffect } from 'react';
import { AppSettings, BankInfo } from '../types';
import { X, Save, Plus, Trash2, Building2, MapPin, Phone, Printer, Mail, Landmark, Loader2, ShieldAlert, KeyRound } from 'lucide-react';
import * as storage from '../services/firebaseService';

interface SettingsManagerProps {
    settings: AppSettings | null;
    onClose: () => void;
}

export const SettingsManager: React.FC<SettingsManagerProps> = ({ settings, onClose }) => {
    const [formData, setFormData] = useState<AppSettings>({
        companyName: '',
        postalCode: '',
        address: '',
        phone: '',
        fax: '',
        email: '',
        invoiceNumber: '',
        categories: [],
        banks: []
    });
    const [isSaving, setIsSaving] = useState(false);

    useEffect(() => {
        if (settings) {
            setFormData(settings);
        }
    }, [settings]);

    const handleSave = async () => {
        setIsSaving(true);
        try {
            await storage.updateSettings(settings?.id || 'new', formData);
            alert('設定を保存しました。');
            onClose();
        } catch (err) {
            alert('保存に失敗しました。');
        } finally {
            setIsSaving(false);
        }
    };

    const addBank = () => {
        const banks = [...(formData.banks || [])];
        banks.push({ bankName: '', branchName: '', accountType: '普通', accountNumber: '', accountHolder: '' });
        setFormData({ ...formData, banks });
    };

    const removeBank = (index: number) => {
        const banks = [...(formData.banks || [])];
        banks.splice(index, 1);
        setFormData({ ...formData, banks });
    };

    const updateBank = (index: number, data: Partial<BankInfo>) => {
        const banks = [...(formData.banks || [])];
        banks[index] = { ...banks[index], ...data };
        setFormData({ ...formData, banks });
    };

    return (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-md z-[200] flex items-center justify-center p-4">
            <div className="bg-white rounded-3xl shadow-2xl w-full max-w-4xl max-h-[90vh] overflow-hidden flex flex-col animate-in fade-in zoom-in duration-200">
                <div className="px-8 py-6 border-b flex justify-between items-center bg-slate-50">
                    <div className="flex items-center gap-3">
                        <div className="p-2 bg-indigo-600 rounded-xl text-white">
                            <Building2 size={24} />
                        </div>
                        <div>
                            <h2 className="text-xl font-black text-slate-800">環境設定</h2>
                            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Company & Bank Settings</p>
                        </div>
                    </div>
                    <button onClick={onClose} className="p-2 hover:bg-slate-200 rounded-full transition-colors text-slate-400">
                        <X size={24} />
                    </button>
                </div>

                <div className="flex-grow overflow-y-auto p-8 space-y-8">
                    {/* Basic Info */}
                    <section>
                        <h3 className="text-sm font-black text-slate-800 mb-4 flex items-center gap-2 border-l-4 border-indigo-600 pl-3">
                            会社基本情報
                        </h3>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                            <div className="space-y-1">
                                <label className="text-[10px] font-black text-slate-400 uppercase ml-1">会社名</label>
                                <input
                                    type="text"
                                    value={formData.companyName}
                                    onChange={e => setFormData({ ...formData, companyName: e.target.value })}
                                    className="w-full px-4 py-3 bg-slate-50 border-2 border-slate-100 rounded-xl focus:border-indigo-500 outline-none transition-all font-bold"
                                />
                            </div>
                            <div className="space-y-1">
                                <label className="text-[10px] font-black text-slate-400 uppercase ml-1">適格請求書発行事業者登録番号</label>
                                <input
                                    type="text"
                                    value={formData.invoiceNumber}
                                    onChange={e => setFormData({ ...formData, invoiceNumber: e.target.value })}
                                    placeholder="T1234567890123"
                                    className="w-full px-4 py-3 bg-slate-50 border-2 border-slate-100 rounded-xl focus:border-indigo-500 outline-none transition-all font-bold"
                                />
                            </div>
                            <div className="space-y-1">
                                <label className="text-[10px] font-black text-slate-400 uppercase ml-1">郵便番号</label>
                                <input
                                    type="text"
                                    value={formData.postalCode}
                                    onChange={e => setFormData({ ...formData, postalCode: e.target.value })}
                                    className="w-full px-4 py-3 bg-slate-50 border-2 border-slate-100 rounded-xl focus:border-indigo-500 outline-none transition-all font-bold"
                                />
                            </div>
                            <div className="space-y-1">
                                <label className="text-[10px] font-black text-slate-400 uppercase ml-1">住所</label>
                                <input
                                    type="text"
                                    value={formData.address}
                                    onChange={e => setFormData({ ...formData, address: e.target.value })}
                                    className="w-full px-4 py-3 bg-slate-50 border-2 border-slate-100 rounded-xl focus:border-indigo-500 outline-none transition-all font-bold"
                                />
                            </div>
                            <div className="space-y-1">
                                <label className="text-[10px] font-black text-slate-400 uppercase ml-1">電話番号</label>
                                <div className="relative">
                                    <Phone size={16} className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" />
                                    <input
                                        type="text"
                                        value={formData.phone}
                                        onChange={e => setFormData({ ...formData, phone: e.target.value })}
                                        className="w-full pl-12 pr-4 py-3 bg-slate-50 border-2 border-slate-100 rounded-xl focus:border-indigo-500 outline-none transition-all font-bold"
                                    />
                                </div>
                            </div>
                            <div className="space-y-1">
                                <label className="text-[10px] font-black text-slate-400 uppercase ml-1">FAX番号</label>
                                <div className="relative">
                                    <Printer size={16} className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" />
                                    <input
                                        type="text"
                                        value={formData.fax}
                                        onChange={e => setFormData({ ...formData, fax: e.target.value })}
                                        className="w-full pl-12 pr-4 py-3 bg-slate-50 border-2 border-slate-100 rounded-xl focus:border-indigo-500 outline-none transition-all font-bold"
                                    />
                                </div>
                            </div>
                            <div className="space-y-1 md:col-span-2">
                                <label className="text-[10px] font-black text-slate-400 uppercase ml-1">代表メールアドレス</label>
                                <div className="relative">
                                    <Mail size={16} className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" />
                                    <input
                                        type="email"
                                        value={formData.email}
                                        onChange={e => setFormData({ ...formData, email: e.target.value })}
                                        className="w-full pl-12 pr-4 py-3 bg-slate-50 border-2 border-slate-100 rounded-xl focus:border-indigo-500 outline-none transition-all font-bold"
                                    />
                                </div>
                            </div>
                        </div>
                    </section>

                    {/* Security & Access */}
                    <section>
                        <h3 className="text-sm font-black text-slate-800 mb-4 flex items-center gap-2 border-l-4 border-rose-500 pl-3">
                            セキュリティ・アクセス設定
                        </h3>
                        <div className="bg-rose-50/50 rounded-2xl border border-rose-100 p-6 space-y-6">
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                <div className="space-y-1">
                                    <label className="text-[10px] font-black text-slate-400 uppercase ml-1">管理者パスワード</label>
                                    <div className="relative">
                                        <KeyRound size={16} className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" />
                                        <input
                                            type="text"
                                            value={formData.adminPassword || ''}
                                            onChange={e => setFormData({ ...formData, adminPassword: e.target.value })}
                                            placeholder="0000"
                                            className="w-full pl-12 pr-4 py-3 bg-white border-2 border-slate-100 rounded-xl focus:border-rose-500 outline-none transition-all font-bold"
                                        />
                                    </div>
                                    <p className="text-[9px] text-slate-400 mt-1 ml-1">※ 商品マスターや顧客単価の設定に入る際に必要です</p>
                                </div>
                                <div className="space-y-1">
                                    <label className="text-[10px] font-black text-slate-400 uppercase ml-1">秘密の質問</label>
                                    <select
                                        value={formData.securityQuestion || ''}
                                        onChange={e => setFormData({ ...formData, securityQuestion: e.target.value })}
                                        className="w-full px-4 py-3 bg-white border-2 border-slate-100 rounded-xl focus:border-rose-500 outline-none transition-all font-bold"
                                    >
                                        <option value="">（質問を選択してください）</option>
                                        <option value="母親の旧姓は？">母親の旧姓は？</option>
                                        <option value="最初に飼ったペットの名前は？">最初に飼ったペットの名前は？</option>
                                        <option value="子供の頃の憧れの職業は？">子供の頃の憧れの職業は？</option>
                                        <option value="生まれた街の名前は？">生まれた街の名前は？</option>
                                        <option value="卒業した小学校の名前は？">卒業した小学校の名前は？</option>
                                    </select>
                                </div>
                                <div className="md:col-span-2 space-y-1">
                                    <label className="text-[10px] font-black text-slate-400 uppercase ml-1">質問の答え</label>
                                    <div className="relative">
                                        <ShieldAlert size={16} className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" />
                                        <input
                                            type="text"
                                            value={formData.securityAnswer || ''}
                                            onChange={e => setFormData({ ...formData, securityAnswer: e.target.value })}
                                            placeholder="答えを入力..."
                                            className="w-full pl-12 pr-4 py-3 bg-white border-2 border-slate-100 rounded-xl focus:border-rose-500 outline-none transition-all font-bold"
                                        />
                                    </div>
                                    <p className="text-[9px] text-rose-400 mt-1 ml-1 font-bold">※ パスワードを忘れた際の復旧に必要です。正確に入力してください。</p>
                                </div>
                            </div>
                        </div>
                    </section>

                    {/* Bank Accounts */}
                    <section>
                        <div className="flex justify-between items-center mb-4">
                            <h3 className="text-sm font-black text-slate-800 flex items-center gap-2 border-l-4 border-indigo-600 pl-3">
                                振込先口座設定
                            </h3>
                            <button
                                onClick={addBank}
                                className="flex items-center gap-2 px-4 py-2 bg-slate-100 text-slate-600 rounded-xl text-[10px] font-black hover:bg-slate-200 transition-all active:scale-95"
                            >
                                <Plus size={14} /> 口座を追加
                            </button>
                        </div>
                        <div className="space-y-4">
                            {(formData.banks || []).map((bank, idx) => (
                                <div key={idx} className="p-6 bg-slate-50 rounded-2xl border-2 border-slate-100 relative group animate-in slide-in-from-right-4 duration-200">
                                    <button
                                        onClick={() => removeBank(idx)}
                                        className="absolute -top-2 -right-2 p-1.5 bg-white text-rose-500 rounded-full shadow-md opacity-0 group-hover:opacity-100 transition-all hover:bg-rose-50 border border-slate-100"
                                    >
                                        <Trash2 size={16} />
                                    </button>
                                    <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
                                        <div className="md:col-span-2 space-y-1">
                                            <label className="text-[9px] font-black text-slate-400 uppercase ml-1">銀行名</label>
                                            <input
                                                type="text"
                                                value={bank.bankName}
                                                onChange={e => updateBank(idx, { bankName: e.target.value })}
                                                placeholder="○○銀行"
                                                className="w-full px-3 py-2 border rounded-lg font-bold text-sm outline-none focus:ring-2 ring-indigo-500/20"
                                            />
                                        </div>
                                        <div className="space-y-1">
                                            <label className="text-[9px] font-black text-slate-400 uppercase ml-1">支店名</label>
                                            <input
                                                type="text"
                                                value={bank.branchName}
                                                onChange={e => updateBank(idx, { branchName: e.target.value })}
                                                placeholder="××支店"
                                                className="w-full px-3 py-2 border rounded-lg font-bold text-sm outline-none"
                                            />
                                        </div>
                                        <div className="space-y-1">
                                            <label className="text-[9px] font-black text-slate-400 uppercase ml-1">種別</label>
                                            <select
                                                value={bank.accountType}
                                                onChange={e => updateBank(idx, { accountType: e.target.value as any })}
                                                className="w-full px-3 py-2 border rounded-lg font-bold text-sm outline-none"
                                            >
                                                <option value="普通">普通</option>
                                                <option value="当座">当座</option>
                                            </select>
                                        </div>
                                        <div className="space-y-1">
                                            <label className="text-[9px] font-black text-slate-400 uppercase ml-1">口座番号</label>
                                            <input
                                                type="text"
                                                value={bank.accountNumber}
                                                onChange={e => updateBank(idx, { accountNumber: e.target.value })}
                                                placeholder="0123456"
                                                className="w-full px-3 py-2 border rounded-lg font-bold text-sm outline-none font-mono"
                                            />
                                        </div>
                                        <div className="md:col-span-5 space-y-1">
                                            <label className="text-[9px] font-black text-slate-400 uppercase ml-1">口座名義</label>
                                            <input
                                                type="text"
                                                value={bank.accountHolder}
                                                onChange={e => updateBank(idx, { accountHolder: e.target.value })}
                                                placeholder="ダイエイカンキ（カ"
                                                className="w-full px-3 py-2 border rounded-lg font-bold text-sm outline-none"
                                            />
                                        </div>
                                    </div>
                                </div>
                            ))}
                            {(formData.banks || []).length === 0 && (
                                <div className="text-center py-12 border-2 border-dashed border-slate-200 rounded-3xl text-slate-400">
                                    <Landmark size={48} className="mx-auto mb-3 opacity-20" />
                                    <p className="font-bold">口座情報が登録されていません</p>
                                    <p className="text-[10px]">「口座を追加」ボタンから登録してください</p>
                                </div>
                            )}
                        </div>
                    </section>
                </div>

                <div className="px-8 py-6 border-t bg-slate-50 flex justify-end gap-4">
                    <button
                        onClick={onClose}
                        className="px-6 py-3 text-slate-500 font-bold hover:bg-slate-200 rounded-xl transition-all"
                    >
                        キャンセル
                    </button>
                    <button
                        onClick={handleSave}
                        disabled={isSaving}
                        className="flex items-center gap-2 px-10 py-3 bg-indigo-600 text-white font-black rounded-xl shadow-lg hover:bg-indigo-700 transition-all active:scale-95 disabled:opacity-50"
                    >
                        {isSaving ? <Loader2 size={18} className="animate-spin" /> : <Save size={18} />}
                        設定を保存
                    </button>
                </div>
            </div>
        </div>
    );
};
