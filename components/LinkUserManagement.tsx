import React, { useEffect, useState } from 'react';
import { collection, getDocs, doc, updateDoc, deleteDoc, query, orderBy } from 'firebase/firestore';
import { sendPasswordResetEmail } from 'firebase/auth';
import { db, auth } from '../firebaseConfig';
import { LinkUserProfile } from '../types';
import { CheckCircle2, Trash2, UserCheck, Loader2, Mail, FileText, X, Save, KeyRound } from 'lucide-react';

interface NoteModal {
    uid: string;
    name: string;
    currentNote: string;
}

export const LinkUserManagement: React.FC = () => {
    const [users, setUsers] = useState<LinkUserProfile[]>([]);
    const [loading, setLoading] = useState(true);
    const [filter, setFilter] = useState<'all' | 'pending' | 'approved'>('all');
    const [noteModal, setNoteModal] = useState<NoteModal | null>(null);
    const [noteText, setNoteText] = useState('');
    const [savingNote, setSavingNote] = useState(false);
    const [sendingReset, setSendingReset] = useState<string | null>(null);

    const fetchUsers = async () => {
        setLoading(true);
        try {
            const q = query(collection(db, 'users'), orderBy('createdAt', 'desc'));
            const querySnapshot = await getDocs(q);
            const userList: LinkUserProfile[] = [];
            querySnapshot.forEach((d) => {
                userList.push({ ...(d.data() as LinkUserProfile), uid: d.id });
            });
            setUsers(userList);
        } catch (error) {
            console.error('Error fetching users: ', error);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchUsers();
    }, []);

    const handleApprove = async (uid: string, role: 'lite' | 'pro') => {
        if (!confirm(`このユーザーを ${role.toUpperCase()} 版として承認しますか？`)) return;
        try {
            await updateDoc(doc(db, 'users', uid), {
                isApproved: true, role, updatedAt: new Date().toISOString()
            });
            fetchUsers();
        } catch (error) {
            alert('承認に失敗しました');
        }
    };

    const handleDelete = async (uid: string) => {
        if (!confirm('本当にこのユーザーを削除しますか？\nこの操作は取り消せません。')) return;
        try {
            await deleteDoc(doc(db, 'users', uid));
            fetchUsers();
        } catch (error) {
            alert('削除に失敗しました');
        }
    };

    const handleSendPasswordReset = async (user: LinkUserProfile) => {
        if (!confirm(`${user.email} にパスワードリセットメールを送信しますか？`)) return;
        setSendingReset(user.uid);
        try {
            auth.languageCode = 'ja'; // Send email in Japanese
            await sendPasswordResetEmail(auth, user.email);
            alert(`✅ ${user.email} にパスワードリセットメールを送信しました。`);
        } catch (err: any) {
            alert(`❌ 送信に失敗しました: ${err?.message ?? '不明なエラー'}`);
        } finally {
            setSendingReset(null);
        }
    };

    const openNoteModal = (user: LinkUserProfile) => {
        setNoteModal({ uid: user.uid, name: user.displayName || user.companyName, currentNote: (user as any).adminNote ?? '' });
        setNoteText((user as any).adminNote ?? '');
    };

    const handleSaveNote = async () => {
        if (!noteModal) return;
        setSavingNote(true);
        try {
            await updateDoc(doc(db, 'users', noteModal.uid), {
                adminNote: noteText,
                updatedAt: new Date().toISOString()
            });
            setUsers(prev => prev.map(u => u.uid === noteModal.uid ? { ...u, adminNote: noteText } as any : u));
            setNoteModal(null);
        } catch (err) {
            alert('メモの保存に失敗しました');
        } finally {
            setSavingNote(false);
        }
    };

    const filteredUsers = users.filter(user => {
        if (filter === 'pending') return !user.isApproved;
        if (filter === 'approved') return user.isApproved;
        return true;
    });

    return (
        <div className="h-full flex flex-col bg-slate-50">
            {/* Note Modal */}
            {noteModal && (
                <div className="fixed inset-0 z-50 bg-slate-900/60 flex items-center justify-center p-4">
                    <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg flex flex-col gap-4 p-6">
                        <div className="flex items-center justify-between">
                            <div className="flex items-center gap-2">
                                <FileText size={20} className="text-blue-600" />
                                <h3 className="font-bold text-slate-800">管理メモ — {noteModal.name}</h3>
                            </div>
                            <button onClick={() => setNoteModal(null)} className="p-2 hover:bg-slate-100 rounded-lg transition-colors">
                                <X size={18} className="text-slate-400" />
                            </button>
                        </div>
                        <p className="text-xs text-slate-400 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2">
                            ⚠️ このメモはFirestoreに保存されます。パスワードをそのまま記録することはセキュリティ上推奨されません。
                        </p>
                        <textarea
                            value={noteText}
                            onChange={e => setNoteText(e.target.value)}
                            rows={5}
                            placeholder="例: 仮パスワード TempPass123 を2025/03/06にメールでお伝え済み"
                            className="w-full border-2 border-slate-200 rounded-xl px-4 py-3 text-sm font-medium outline-none focus:border-blue-400 resize-none transition-colors"
                        />
                        <div className="flex justify-end gap-3">
                            <button onClick={() => setNoteModal(null)} className="px-4 py-2 text-sm font-bold text-slate-500 hover:bg-slate-100 rounded-lg transition-colors">
                                キャンセル
                            </button>
                            <button
                                onClick={handleSaveNote}
                                disabled={savingNote}
                                className="flex items-center gap-2 px-5 py-2 bg-blue-600 text-white text-sm font-bold rounded-lg hover:bg-blue-700 active:scale-95 transition-all disabled:opacity-50"
                            >
                                {savingNote ? <Loader2 size={16} className="animate-spin" /> : <Save size={16} />}
                                保存する
                            </button>
                        </div>
                    </div>
                </div>
            )}

            <div className="p-6 border-b border-slate-200 bg-white flex items-center justify-between shrink-0">
                <h2 className="text-xl font-bold flex items-center gap-2 text-slate-800">
                    <UserCheck className="text-blue-600" />
                    LINKユーザー管理
                </h2>
                <div className="flex bg-slate-100 p-1 rounded-lg">
                    {(['all', 'pending', 'approved'] as const).map(f => (
                        <button
                            key={f}
                            onClick={() => setFilter(f)}
                            className={`px-4 py-1.5 text-sm font-medium rounded-md transition-all ${filter === f ? (f === 'pending' ? 'bg-white text-orange-600 shadow-sm' : f === 'approved' ? 'bg-white text-green-600 shadow-sm' : 'bg-white text-blue-600 shadow-sm') : 'text-slate-500 hover:text-slate-700'}`}
                        >
                            {f === 'all' ? '全て' : f === 'pending' ? '承認待ち' : '承認済み'}
                            {f === 'pending' && users.filter(u => !u.isApproved).length > 0 && (
                                <span className="ml-2 bg-orange-500 text-white text-[10px] px-1.5 py-0.5 rounded-full">
                                    {users.filter(u => !u.isApproved).length}
                                </span>
                            )}
                        </button>
                    ))}
                </div>
            </div>

            <div className="flex-1 overflow-auto p-6">
                {loading ? (
                    <div className="flex items-center justify-center h-64">
                        <Loader2 className="animate-spin text-blue-600" size={32} />
                    </div>
                ) : (
                    <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
                        <table className="w-full text-left text-sm">
                            <thead className="bg-slate-50 text-slate-500 font-medium border-b border-slate-200">
                                <tr>
                                    <th className="px-6 py-4">ステータス</th>
                                    <th className="px-6 py-4">会社名 / 氏名</th>
                                    <th className="px-6 py-4">連絡先</th>
                                    <th className="px-6 py-4">申請日時</th>
                                    <th className="px-6 py-4 text-right">アクション</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100">
                                {filteredUsers.length === 0 ? (
                                    <tr>
                                        <td colSpan={5} className="px-6 py-12 text-center text-slate-400">ユーザーが見つかりません</td>
                                    </tr>
                                ) : (
                                    filteredUsers.map((user) => (
                                        <React.Fragment key={user.uid}>
                                            <tr className="hover:bg-slate-50 transition-colors">
                                                <td className="px-6 py-4">
                                                    {user.isApproved ? (
                                                        <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold ${user.role === 'pro' ? 'bg-blue-50 text-blue-700' : 'bg-green-50 text-green-700'}`}>
                                                            <CheckCircle2 size={14} />
                                                            {user.role === 'pro' ? 'PRO承認済み' : 'LITE承認済み'}
                                                        </span>
                                                    ) : (
                                                        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold bg-orange-50 text-orange-600">
                                                            <Loader2 size={14} className="animate-spin" />
                                                            承認待ち
                                                        </span>
                                                    )}
                                                </td>
                                                <td className="px-6 py-4">
                                                    <div className="font-bold text-slate-800">{user.companyName}</div>
                                                    <div className="text-slate-500 text-xs">{user.displayName}</div>
                                                </td>
                                                <td className="px-6 py-4 text-slate-600">
                                                    <div>{user.email}</div>
                                                    <div className="text-xs text-slate-400 mt-0.5">{user.phoneNumber}</div>
                                                </td>
                                                <td className="px-6 py-4 text-slate-500 text-xs font-mono">
                                                    {new Date(user.createdAt).toLocaleString()}
                                                </td>
                                                <td className="px-6 py-4">
                                                    <div className="flex items-center justify-end gap-1.5 flex-wrap">
                                                        {!user.isApproved && (
                                                            <>
                                                                <button onClick={() => handleApprove(user.uid, 'lite')} className="px-3 py-1.5 bg-green-600 text-white rounded-lg text-xs font-bold hover:bg-green-700 transition-colors shadow-sm">LITE承認</button>
                                                                <button onClick={() => handleApprove(user.uid, 'pro')} className="px-3 py-1.5 bg-blue-600 text-white rounded-lg text-xs font-bold hover:bg-blue-700 transition-colors shadow-sm">PRO承認</button>
                                                                <div className="w-px h-5 bg-slate-200" />
                                                            </>
                                                        )}
                                                        {/* Password Reset Email */}
                                                        <button
                                                            onClick={() => handleSendPasswordReset(user)}
                                                            disabled={sendingReset === user.uid}
                                                            className="flex items-center gap-1 px-3 py-1.5 bg-amber-50 text-amber-700 border border-amber-200 rounded-lg text-xs font-bold hover:bg-amber-100 transition-colors disabled:opacity-50"
                                                            title="パスワードリセットメール送信"
                                                        >
                                                            {sendingReset === user.uid
                                                                ? <Loader2 size={13} className="animate-spin" />
                                                                : <Mail size={13} />}
                                                            PW再設定
                                                        </button>
                                                        {/* Admin Note */}
                                                        <button
                                                            onClick={() => openNoteModal(user)}
                                                            className={`flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-bold border transition-colors ${(user as any).adminNote ? 'bg-indigo-50 text-indigo-700 border-indigo-200 hover:bg-indigo-100' : 'bg-slate-50 text-slate-500 border-slate-200 hover:bg-slate-100'}`}
                                                            title="管理メモ"
                                                        >
                                                            <KeyRound size={13} />
                                                            {(user as any).adminNote ? 'メモあり' : 'メモ'}
                                                        </button>
                                                        {/* Delete */}
                                                        <button onClick={() => handleDelete(user.uid)} className="p-2 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors" title="削除">
                                                            <Trash2 size={16} />
                                                        </button>
                                                    </div>
                                                </td>
                                            </tr>
                                            {/* Admin note preview row */}
                                            {(user as any).adminNote && (
                                                <tr className="bg-indigo-50/50">
                                                    <td colSpan={5} className="px-6 py-2">
                                                        <div className="flex items-start gap-2 text-xs text-indigo-700">
                                                            <KeyRound size={12} className="mt-0.5 shrink-0" />
                                                            <span className="font-medium whitespace-pre-wrap">{(user as any).adminNote}</span>
                                                        </div>
                                                    </td>
                                                </tr>
                                            )}
                                        </React.Fragment>
                                    ))
                                )}
                            </tbody>
                        </table>
                    </div>
                )}
            </div>
        </div>
    );
};
