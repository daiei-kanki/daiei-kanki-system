
import React from 'react';
import { LucideIcon } from 'lucide-react';

interface StatsCardProps {
  title: string;
  value: string;
  icon: LucideIcon;
  trend?: string;
  color?: string;
  compact?: boolean;
}

export const StatsCard: React.FC<StatsCardProps> = ({ title, value, icon: Icon, trend, color = "blue", compact = false }) => {
  const colorClasses = {
    blue: "bg-blue-50 text-blue-700",
    green: "bg-emerald-50 text-emerald-700",
    amber: "bg-amber-50 text-amber-700",
    purple: "bg-purple-50 text-purple-700",
    indigo: "bg-indigo-50 text-indigo-700",
  };

  const selectedColor = colorClasses[color as keyof typeof colorClasses] || colorClasses.blue;

  if (compact) {
    return (
      <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-3 flex items-center space-x-3 h-full">
        <div className={`p-2 rounded-lg ${selectedColor} shrink-0`}>
          <Icon size={16} />
        </div>
        <div className="min-w-0">
          <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest truncate leading-tight">{title}</p>
          <h3 className="text-sm font-black text-slate-900 mt-0.5 leading-none">{value}</h3>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6 flex items-start space-x-4">
      <div className={`p-3 rounded-lg ${selectedColor}`}>
        <Icon size={24} />
      </div>
      <div>
        <p className="text-sm font-medium text-slate-500">{title}</p>
        <h3 className="text-2xl font-bold text-slate-900 mt-1">{value}</h3>
        {trend && <p className="text-xs text-slate-400 mt-1">{trend}</p>}
      </div>
    </div>
  );
};
