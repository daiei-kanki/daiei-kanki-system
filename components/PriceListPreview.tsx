
import React from 'react';
import { X } from 'lucide-react';

export const PriceListPreview: React.FC<any> = ({ onClose }) => (
  <div className="fixed inset-0 z-[100] bg-slate-900/50 flex items-center justify-center p-8">
    <div className="bg-white rounded-3xl w-full max-w-4xl p-8">
      <div className="flex justify-between mb-8">
        <h2 className="text-2xl font-black">価格表プレビュー</h2>
        <button onClick={onClose}><X /></button>
      </div>
      <p className="text-slate-500">機能開発中...</p>
    </div>
  </div>
);
