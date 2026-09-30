import React from 'react';
import { DatasetStats } from '../types';
import { Check, FileSpreadsheet, X, ArrowRight, Info } from 'lucide-react';

interface Props {
  stats: DatasetStats | null;
  isOpen: boolean;
  onClose: () => void;
}

export const ExcelSuccessModal: React.FC<Props> = ({ stats, isOpen, onClose }) => {
  if (!isOpen || !stats) return null;

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-4 transition-all animate-in fade-in duration-200">
      <div className="bg-white rounded-3xl shadow-2xl border border-slate-200 max-w-lg w-full p-6 text-slate-800 animate-in zoom-in-95 duration-200 relative">
        <div className="flex items-center justify-between pb-4 border-b border-slate-100">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-2xl bg-emerald-100 text-emerald-600 flex items-center justify-center font-black text-2xl shadow-inner">
              <Check className="w-7 h-7 text-emerald-600" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-base font-black text-slate-900">Upload & Analysis Successful!</h3>
                <span className="px-2 py-0.5 rounded-full text-[10px] font-extrabold bg-emerald-100 text-emerald-800 border border-emerald-300">Verified</span>
              </div>
              <p className="text-xs text-slate-500 font-medium mt-0.5">Your Excel sheet has been analyzed and loaded into the scheduler engine</p>
            </div>
          </div>
          <button
            onClick={onClose}
            aria-label="Close modal"
            className="text-slate-400 hover:text-slate-600 p-1.5 rounded-xl hover:bg-slate-100 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* File Info Pill */}
        <div className="mt-4 p-3 bg-slate-50 rounded-2xl border border-slate-200/80 flex items-center justify-between gap-2">
          <div className="flex items-center gap-2.5 overflow-hidden">
            <div className="w-8 h-8 rounded-xl bg-blue-100 text-blue-700 flex items-center justify-center shrink-0">
              <FileSpreadsheet className="w-4 h-4" />
            </div>
            <div className="truncate">
              <div className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Active Excel File</div>
              <div className="text-xs font-black text-slate-800 truncate">{stats.fileName}</div>
            </div>
          </div>
          <span className="shrink-0 px-2.5 py-1 rounded-full text-[10px] font-extrabold bg-emerald-100 text-emerald-800 border border-emerald-300">
            Ready for Scheduling
          </span>
        </div>

        {/* Metrics Grid */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 mt-3.5">
          <div className="bg-blue-50/70 border border-blue-200/80 rounded-2xl p-2.5 text-center">
            <span className="text-[10px] font-extrabold text-blue-500 uppercase tracking-wide">Courses</span>
            <div className="text-lg font-black text-blue-700 mt-0.5">{stats.courseCount}</div>
          </div>
          <div className="bg-indigo-50/70 border border-indigo-200/80 rounded-2xl p-2.5 text-center">
            <span className="text-[10px] font-extrabold text-indigo-500 uppercase tracking-wide">Faculty</span>
            <div className="text-lg font-black text-indigo-700 mt-0.5">{stats.facultyCount}</div>
          </div>
          <div className="bg-purple-50/70 border border-purple-200/80 rounded-2xl p-2.5 text-center">
            <span className="text-[10px] font-extrabold text-purple-500 uppercase tracking-wide">Slot Blocks</span>
            <div className="text-lg font-black text-purple-700 mt-0.5">{stats.slotsCount}</div>
          </div>
          <div className="bg-emerald-50/70 border border-emerald-200/80 rounded-2xl p-2.5 text-center">
            <span className="text-[10px] font-extrabold text-emerald-500 uppercase tracking-wide">Baskets</span>
            <div className="text-lg font-black text-emerald-700 mt-0.5">{stats.categoriesCount}</div>
          </div>
        </div>

        {/* Info Banner */}
        <div className="mt-4 p-3 bg-blue-50/70 border border-blue-200/80 rounded-2xl text-[11px] text-blue-900 flex items-start gap-2">
          <Info className="w-4 h-4 text-blue-600 shrink-0 mt-0.5" />
          <span>Your catalog has been updated with the new courses. Select your required subjects below and customize preferred slots to generate timetables!</span>
        </div>

        {/* Action Button */}
        <div className="mt-5 flex justify-end">
          <button
            onClick={onClose}
            className="w-full sm:w-auto px-6 py-2.5 bg-gradient-to-r from-blue-600 via-indigo-600 to-purple-600 hover:from-blue-500 hover:to-purple-500 text-white font-extrabold text-xs rounded-xl shadow-md transition-all transform active:scale-95 flex items-center justify-center gap-1.5"
          >
            <span>Start Building Timetable</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>
    </div>
  );
};
