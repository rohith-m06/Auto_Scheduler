import { Analytics } from '@vercel/analytics/react';
import React, { useState, useEffect, useMemo, useRef } from 'react';
import { useAuth } from './context/AuthContext';
import { AuthPage } from './components/AuthPage';
import { ExcelSuccessModal } from './components/ExcelSuccessModal';
import { Course, CourseCatalog, TimetableSchedule, DatasetStats } from './types';
import { solveTimetables, resolveSlotToPositions } from './services/schedulerSolver';
import { downloadImage, downloadPdf } from './services/canvasExport';
import { logUserActivity, saveUserWorkspace, loadUserWorkspace } from './services/userTracking';
import * as XLSX from 'xlsx';
import {
  Calendar, Search, Upload, LogOut, Check, ChevronLeft, ChevronRight,
  Download, Printer, AlertTriangle, Sparkles, Layers, BookOpen, Clock,
  FileSpreadsheet, User, Trash2, ArrowRight, RotateCcw, FolderPlus
} from 'lucide-react';


const COURSE_COLORS: Record<string, { bg: string; pill: string; text: string }> = {
  'ECE1001': { bg: '#e0f2fe', pill: 'bg-sky-200 text-sky-900', text: 'text-sky-950' },
  'CSE1041': { bg: '#dcfce7', pill: 'bg-emerald-200 text-emerald-900', text: 'text-emerald-950' },
  'CSE2046': { bg: '#ede9fe', pill: 'bg-purple-200 text-purple-900', text: 'text-purple-950' },
  'CSE2001': { bg: '#ffedd5', pill: 'bg-orange-200 text-orange-900', text: 'text-orange-950' },
  'CSE2007': { bg: '#ffe4e6', pill: 'bg-rose-200 text-rose-900', text: 'text-rose-950' },
  'MAT2002': { bg: '#ccfbf1', pill: 'bg-teal-200 text-teal-900', text: 'text-teal-950' },
  'SSK3001': { bg: '#fef3c7', pill: 'bg-amber-200 text-amber-900', text: 'text-amber-950' },
  'CHE1001': { bg: '#fce7f3', pill: 'bg-pink-200 text-pink-900', text: 'text-pink-950' },
  'CSE2022': { bg: '#e0e7ff', pill: 'bg-indigo-200 text-indigo-900', text: 'text-indigo-950' },
  'CSE3003': { bg: '#f1f5f9', pill: 'bg-slate-200 text-slate-900', text: 'text-slate-950' },
  'CSE2006': { bg: '#fef9c3', pill: 'bg-yellow-200 text-yellow-900', text: 'text-yellow-950' }
};

export default function App() {
  const { currentUser, userName, logout } = useAuth();

  // If not logged in, show AuthPage
  if (!currentUser) {
    return <AuthPage />;
  }

  // Cached workspace helper: Instant restore from localStorage
  const cached = useMemo(() => {
    try {
      if (typeof localStorage === 'undefined') return null;
      const uidKey = currentUser?.uid ? 'autoscheduler_workspace_' + currentUser.uid : null;
      let raw = uidKey ? localStorage.getItem(uidKey) : null;
      if (!raw) {
        const found = Object.keys(localStorage).find(k => k.startsWith('autoscheduler_workspace_'));
        if (found) raw = localStorage.getItem(found);
      }
      if (raw) return JSON.parse(raw);
    } catch (e) {}
    return null;
  }, [currentUser?.uid]);

  // App State: Restores seamlessly from previous session if exists, otherwise clean landing page
  const [courses, setCourses] = useState<CourseCatalog>(() => cached?.courses || {});
  const [selectedCodes, setSelectedCodes] = useState<string[]>(() => cached?.selectedCodes || []);
  const [optionPrefs, setOptionPrefs] = useState<Record<string, boolean>>(() => cached?.optionPrefs || {});
  const [datasetStats, setDatasetStats] = useState<DatasetStats | null>(() => cached?.datasetStats || null);
  const [timetables, setTimetables] = useState<TimetableSchedule[]>(() => cached?.timetables || []);
  const [currentIndex, setCurrentIndex] = useState<number>(() => cached?.currentIndex || 0);
  const [hasGenerated, setHasGenerated] = useState<boolean>(() => (cached?.timetables?.length || 0) > 0);

  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('ALL');
  const [clashMessage, setClashMessage] = useState<string | null>(null);

  // Excel Modal & Toast State
  const [showExcelModal, setShowExcelModal] = useState(false);
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [isRestoringSession, setIsRestoringSession] = useState(false);

  // Smart Header: Auto-hide on scroll down, auto-reveal on scroll up
  const [showHeader, setShowHeader] = useState(true);

  useEffect(() => {
    let lastScrollY = window.scrollY;

    const handleScroll = () => {
      const currentScrollY = window.scrollY;

      // Always show near the top of the page
      if (currentScrollY <= 40) {
        setShowHeader(true);
        lastScrollY = currentScrollY;
        return;
      }

      const diff = currentScrollY - lastScrollY;

      // Threshold: 12px of movement
      if (diff > 12) {
        // Scrolling down -> hide header
        setShowHeader(false);
        lastScrollY = currentScrollY;
      } else if (diff < -12) {
        // Scrolling up -> reveal header
        setShowHeader(true);
        lastScrollY = currentScrollY;
      }
    };

    window.addEventListener('scroll', handleScroll, { passive: true });
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  // Trigger floating toast
  function triggerToast(msg: string) {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 3500);
  }

  // 1. AUTO-RESTORE USER WORKSPACE ON LOGIN
  useEffect(() => {
    let isMounted = true;
    async function restoreSession() {
      if (!currentUser) return;
      try {
        const savedData = await loadUserWorkspace(currentUser.uid);
        if (savedData && isMounted && savedData.courses && Object.keys(savedData.courses).length > 0) {
          setCourses(savedData.courses);
          setDatasetStats(savedData.datasetStats || null);
          if (Array.isArray(savedData.selectedCodes)) setSelectedCodes(savedData.selectedCodes);
          if (savedData.optionPrefs) setOptionPrefs(savedData.optionPrefs);
          if (Array.isArray(savedData.timetables) && savedData.timetables.length > 0) {
            setTimetables(savedData.timetables);
            setHasGenerated(true);
            setCurrentIndex(savedData.currentIndex || 0);
          }
          triggerToast('Restored your previous session!');
        }
      } catch (err) {
        console.warn('Session restore error:', err);
      } finally {
        if (isMounted) setIsRestoringSession(false);
      }
    }
    restoreSession();
    return () => { isMounted = false; };
  }, [currentUser]);

  // 2. AUTO-SAVE USER WORKSPACE ON ANY CHANGE
  const saveTimeoutRef = useRef<any>(null);
  useEffect(() => {
    if (!currentUser || isRestoringSession) return;
    if (Object.keys(courses).length === 0) return;

    if (saveTimeoutRef.current) clearTimeout(saveTimeoutRef.current);
    saveTimeoutRef.current = setTimeout(() => {
      saveUserWorkspace(currentUser.uid, {
        courses,
        datasetStats,
        selectedCodes,
        optionPrefs,
        timetables,
        currentIndex
      });
    }, 1200);

    return () => {
      if (saveTimeoutRef.current) clearTimeout(saveTimeoutRef.current);
    };
  }, [courses, datasetStats, selectedCodes, optionPrefs, timetables, currentIndex, currentUser, isRestoringSession]);

  // Total credits
  const totalCredits = useMemo(() => {
    return selectedCodes.reduce((sum, code) => sum + (courses[code]?.credits || 0), 0);
  }, [selectedCodes, courses]);

  // Filtered Course Catalog
  const filteredCatalog = useMemo(() => {
    return (Object.values(courses) as Course[]).filter((c: Course) => {
      if (selectedCategory !== 'ALL') {
        const cat = (c.basket || '').toUpperCase();
        if (selectedCategory === 'PC' && !cat.includes('PC') && !cat.includes('PROGRAM CORE')) return false;
        if (selectedCategory === 'School Core' && !cat.includes('SCHOOL') && !cat.includes('SC')) return false;
        if (selectedCategory === 'BASKETS' && !cat.includes('BASKET')) return false;
      }
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const codeMatch = c.code.toLowerCase().includes(q);
        const titleMatch = c.title.toLowerCase().includes(q);
        const facultyMatch = [...(c.theoryOptions || []), ...(c.labOptions || [])].some(o => o.faculty.toLowerCase().includes(q));
        const slotMatch = [...(c.theoryOptions || []), ...(c.labOptions || [])].some(o => o.slot.toLowerCase().includes(q));
        return codeMatch || titleMatch || facultyMatch || slotMatch;
      }
      return true;
    });
  }, [courses, selectedCategory, searchQuery]);

  // Add / Remove Course
  function toggleCourseSelection(code: string) {
    setSelectedCodes(prev => {
      const exists = prev.includes(code);
      return exists ? prev.filter(c => c !== code) : [...prev, code];
    });
    setHasGenerated(false);
  }

  function clearAll() {
    setSelectedCodes([]);
    setTimetables([]);
    setHasGenerated(false);
    setClashMessage(null);
  }

  // Toggle teacher preference checkbox
  function toggleOption(key: string) {
    setOptionPrefs(prev => ({
      ...prev,
      [key]: prev[key] === false ? true : false
    }));
    setHasGenerated(false);
  }

  function setAllOptionsForCourse(code: string, allow: boolean) {
    const c = courses[code];
    if (!c) return;
    const updates: Record<string, boolean> = {};
    (c.theoryOptions || []).forEach(to => {
      updates[`${code}_theory_${to.faculty}_${to.slot}`] = allow;
    });
    (c.labOptions || []).forEach(lo => {
      updates[`${code}_lab_${lo.faculty}_${lo.slot}`] = allow;
    });
    setOptionPrefs(prev => ({ ...prev, ...updates }));
    setHasGenerated(false);
  }

  
  // Excel Upload Handler
  function handleExcelUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    e.target.value = '';

    setIsAnalyzing(true);
    const reader = new FileReader();
    reader.onload = function(evt) {
      try {
        const XLSXLib = (typeof window !== 'undefined' && (window as any).XLSX) ? (window as any).XLSX : XLSX;
        const data = new Uint8Array(evt.target?.result as ArrayBuffer);
        const workbook = XLSXLib.read(data, { type: 'array' });
        const sheetName = workbook.SheetNames[0];
        const worksheet = workbook.Sheets[sheetName];
        const rawRows = XLSXLib.utils.sheet_to_json(worksheet, { header: 1 }) as any[][];

        const newlyParsedCourses = parseRawExcelRows(rawRows);
        const courseCount = Object.keys(newlyParsedCourses).length;
        if (courseCount === 0) {
          alert("No valid courses found in uploaded Excel file. Please ensure sheet has course rows.");
          setIsAnalyzing(false);
          return;
        }

        // Perform in-depth analysis of parsed dataset (Exact HTML logic)
        const uniqueFaculty = new Set<string>();
        const categories = new Set<string>();
        let totalTheoryOptions = 0;
        let totalLabOptions = 0;

        Object.values(newlyParsedCourses).forEach((c: Course) => {
          if (c.basket) categories.add(c.basket);
          (c.theoryOptions || []).forEach(to => {
            if (to.faculty && to.faculty !== 'Faculty') uniqueFaculty.add(to.faculty.trim());
            totalTheoryOptions++;
          });
          (c.labOptions || []).forEach(lo => {
            if (lo.faculty && lo.faculty !== 'Faculty') uniqueFaculty.add(lo.faculty.trim());
            totalLabOptions++;
          });
        });

        const stats: DatasetStats = {
          fileName: file.name,
          courseCount,
          facultyCount: uniqueFaculty.size || 1,
          slotsCount: totalTheoryOptions + totalLabOptions,
          categoriesCount: categories.size || 1,
          sheetName
        };

        // Default all specific teacher+slot options to true (Exact HTML init() logic)
        const defaultPrefs: Record<string, boolean> = {};
        Object.values(newlyParsedCourses).forEach((c: Course) => {
          (c.theoryOptions || []).forEach(opt => {
            defaultPrefs[`${c.code}_theory_${opt.faculty}_${opt.slot}`] = true;
          });
          (c.labOptions || []).forEach(opt => {
            defaultPrefs[`${c.code}_lab_${opt.faculty}_${opt.slot}`] = true;
          });
        });

        setCourses(newlyParsedCourses);
        setSelectedCodes([]);
        setOptionPrefs(defaultPrefs);
        setTimetables([]);
        setHasGenerated(false);
        setCurrentIndex(0);
        setDatasetStats(stats);
        setShowExcelModal(true);
        triggerToast(`Analysis Complete: ${file.name} (${courseCount} Courses)`);
        logUserActivity(currentUser, 'upload_excel', { fileName: file.name, courseCount, slotsCount: totalTheoryOptions + totalLabOptions });
      } catch (err: any) {
        console.error("Excel Parsing Error:", err);
        alert("Error parsing Excel file: " + err.message);
      } finally {
        setIsAnalyzing(false);
      }
    };
    reader.readAsArrayBuffer(file);
  }

  // Exact Replicated Parser from timetable_possibilities.html
  function parseRawExcelRows(rows: any[][]): CourseCatalog {
    const cleanStr = (val: any) => val === undefined || val === null ? '' : String(val).replace(/ /g, ' ').trim();
    const isSlot = (s: string) => /^[A-Ga-g][12]/.test(s) || /^L\d+/.test(s);
    const isRoom = (s: string) => /^\d{3}[A-Za-z]?$/.test(s) || s.includes('AB_') || s.includes('AB2');
    const isPerson = (s: string) => ['Dr.', 'Mr.', 'Ms.', 'Mrs.'].some(p => s.includes(p));

    let catCol = 1, codeCol = 2, titleCol = 3, lCol = 4, pCol = 5, cCol = 6, tfCol = 7, lfCol = 8, tsCol = 9, lsCol = 10;
    let startRow = 1;

    if (rows && rows.length > 0) {
      for (let rIdx = 0; rIdx < Math.min(6, rows.length); rIdx++) {
        const row = rows[rIdx];
        if (!Array.isArray(row)) continue;
        const lower = row.map(x => cleanStr(x).toLowerCase());
        const hasCode = lower.some(x => x.includes('course') || x.includes('code'));
        const hasTitle = lower.some(x => x.includes('title') || x.includes('name'));
        if (hasCode || hasTitle) {
          startRow = rIdx + 1;
          lower.forEach((colName, cIdx) => {
            if (colName.includes('code')) codeCol = cIdx;
            else if (colName.includes('basket') || colName.includes('category')) catCol = cIdx;
            else if (colName.includes('title') || colName.includes('course name')) titleCol = cIdx;
            else if (colName === 'c' || colName.includes('credit')) cCol = cIdx;
            else if (colName === 'l') lCol = cIdx;
            else if (colName === 'p') pCol = cIdx;
            else if (colName.includes('faculty') && (colName.includes('theory') || colName.includes('th') || colName.includes('1'))) tfCol = cIdx;
            else if (colName.includes('faculty') && (colName.includes('lab') || colName.includes('pr') || colName.includes('2'))) lfCol = cIdx;
            else if (colName.includes('slot') && (colName.includes('theory') || colName.includes('th') || colName.includes('1'))) tsCol = cIdx;
            else if (colName.includes('slot') && (colName.includes('lab') || colName.includes('pr') || colName.includes('2'))) lsCol = cIdx;
          });
          break;
        }
      }
    }

    const coursesMap: CourseCatalog = {};

    for (let i = startRow; i < rows.length; i++) {
      const r = rows[i];
      if (!r || r.length === 0) continue;

      const code = cleanStr(r[codeCol]);
      if (!code || code.toLowerCase() === 'course code' || code.toLowerCase() === 'none' || code.toLowerCase() === 'code') continue;

      const cat = cleanStr(r[catCol]) || 'General';
      const title = cleanStr(r[titleCol]) || code;
      const lVal = parseFloat(r[lCol]) || 0;
      const pVal = parseFloat(r[pCol]) || 0;
      const cVal = parseFloat(r[cCol]) || (lVal + pVal * 0.5);

      let tf = cleanStr(r[tfCol]);
      let lf = cleanStr(r[lfCol]);
      let ts = cleanStr(r[tsCol]);
      let ls = cleanStr(r[lsCol]);

      // Auto-heal Shifted Columns if faculty/slot columns are swapped in university sheet
      if (isSlot(tf) && (isRoom(ts) || !ts)) {
        ts = tf;
        tf = lf;
      }
      if (ts && /^L\d+/i.test(ts) && !ls) {
        ls = ts;
        ts = '';
        if (!lf && tf) lf = tf;
      }
      if (ts && /^L\d+/i.test(ts) && isPerson(ls)) {
        lf = ls;
        ls = ts;
        ts = '';
      }

      if (!coursesMap[code]) {
        coursesMap[code] = {
          code,
          title,
          basket: cat,
          credits: cVal,
          theoryOptions: [],
          labOptions: []
        };
      }

      const cObj = coursesMap[code];

      // Process Theory Slot
      if (ts && ts !== 'NA' && !ts.toUpperCase().includes('PROJECT BASED') && !ts.startsWith('L')) {
        const thSlots = ts.includes(',') ? ts.split(',') : (ts.includes(' ') && !ts.includes('+') ? ts.split(/\s+/) : [ts]);
        thSlots.forEach(rawS => {
          const normTs = rawS.replace(/\s+/g, '').toUpperCase();
          if (normTs) {
            const fac = tf && tf !== 'NA' ? tf : 'Faculty';
            if (!cObj.theoryOptions.some(o => o.slot === normTs && o.faculty === fac)) {
              cObj.theoryOptions.push({ slot: normTs, faculty: fac });
            }
          }
        });
      }

      // Process Lab Slot
      if (ls && ls !== 'NA' && !ls.toUpperCase().includes('PROJECT BASED') && (ls.includes('L') || ls.includes('-'))) {
        const fac = lf && lf !== 'NA' ? lf : (tf && tf !== 'NA' ? tf : 'Faculty');

        if (cVal >= 4.0 && ls.includes(',') && !ls.includes('(B-')) {
          const cleanedLs = ls.replace(/\s+/g, '').replace(/-/g, '+').toUpperCase();
          if (!cObj.labOptions.some(o => o.slot === cleanedLs && o.faculty === fac)) {
            cObj.labOptions.push({ slot: cleanedLs, faculty: fac });
          }
        } else {
          const matches = ls.match(/L\d+(?:[+-]L?\d+)?/gi) || [ls];
          matches.forEach(m => {
            let normLab = m.replace(/-/g, '+').replace(/\s+/g, '').toUpperCase();
            normLab = normLab.replace(/L(\d+)\+(\d+)/, 'L$1+L$2');
            if (!cObj.labOptions.some(o => o.slot === normLab && o.faculty === fac)) {
              cObj.labOptions.push({ slot: normLab, faculty: fac });
            }
          });
        }
      }
    }

    return coursesMap;
  }

  // Generate Timetables
  function handleGenerate() {
    if (selectedCodes.length === 0) {
      alert("Please select at least 1 course from the catalog first.");
      return;
    }

    const selectedCourseList = selectedCodes.map(code => courses[code]).filter(Boolean);
    const result = solveTimetables(selectedCourseList, optionPrefs, 500);

    setTimetables(result.timetables);
    setClashMessage(result.clashReason || null);
    setCurrentIndex(0);
    setHasGenerated(true);

    triggerToast(`Generated ${result.timetables.length} Timetables!`);
    logUserActivity(currentUser, 'generate_timetable', {
      selectedCoursesCount: selectedCodes.length,
      timetablesFound: result.timetables.length
    });

    setTimeout(() => {
      document.getElementById('results-section')?.scrollIntoView({ behavior: 'smooth' });
    }, 100);
  }

  const currentSchedule = timetables[currentIndex] || null;
  const hasCoursesLoaded = Object.keys(courses).length > 0;

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 pb-16">
      
      {/* Toast Notification */}
      {toastMessage && (
        <div className="fixed top-5 right-5 z-[9999] pointer-events-none transition-all flex items-center gap-2.5 px-4 py-3 bg-slate-900 text-white rounded-2xl shadow-2xl border border-slate-700 text-xs font-bold animate-in fade-in slide-in-from-top-4">
          <div className="w-6 h-6 rounded-lg bg-emerald-500 text-white flex items-center justify-center font-black text-xs">✓</div>
          <span>{toastMessage}</span>
        </div>
      )}

      {/* Excel Analysis Modal (Closes cleanly on click!) */}
      <ExcelSuccessModal
        stats={datasetStats}
        isOpen={showExcelModal}
        onClose={() => setShowExcelModal(false)}
      />

      {/* Main Container */}
      <div className="max-w-7xl mx-auto px-3 sm:px-6 lg:px-8 space-y-6 pt-4">

        {/* Top Sticky Header */}
        <header className={`no-print sticky top-3 z-50 bg-white/95 backdrop-blur-md rounded-2xl shadow-lg border border-slate-200/90 px-4 py-3 transition-all duration-300 ease-in-out transform ${showHeader ? "translate-y-0 opacity-100 pointer-events-auto" : "-translate-y-[150%] opacity-0 pointer-events-none"}`}>

          <div className="flex flex-col gap-2.5">
            
            {/* Top Row: Brand, User Profile, Credits, Upload, Actions */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
              <div className="flex items-center space-x-3">
                <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-blue-600 via-indigo-600 to-purple-600 flex items-center justify-center text-white shadow-md">
                  <Calendar className="w-6 h-6" />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <h1 className="text-lg font-black text-slate-900 tracking-tight leading-none">AutoScheduler</h1>
                    <span className="px-2 py-0.5 rounded-full text-[10px] font-extrabold bg-blue-100 text-blue-800 border border-blue-200">
                      Cloud Sync
                    </span>
                    {datasetStats && (
                      <button
                        onClick={() => setShowExcelModal(true)}
                        title="Click to view file analysis breakdown"
                        className="hidden sm:inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-emerald-50 text-emerald-800 border border-emerald-300 hover:bg-emerald-100 transition-all shadow-2xs"
                      >
                        <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse"></span>
                        <span>{datasetStats.fileName} ({datasetStats.courseCount} courses)</span>
                      </button>
                    )}
                  </div>
                  <p className="text-[11px] text-slate-500 font-medium mt-0.5">Welcome, <strong className="text-slate-800">{userName || currentUser.email}</strong> • Auto-saved to Cloud</p>
                </div>
              </div>

              {/* Actions & Credits */}
              <div className="flex flex-wrap items-center gap-2">
                {hasCoursesLoaded && (
                  <div className="bg-blue-50/90 border border-blue-200 rounded-xl px-3 py-1.5 shadow-2xs flex items-center gap-2.5">
                    <div>
                      <span className="text-[9px] uppercase tracking-wider font-extrabold text-blue-500 block leading-none">Total Credits</span>
                      <span className="text-base font-black text-blue-700 leading-tight">{totalCredits.toFixed(1)}</span>
                    </div>
                    <div className="px-2 py-0.5 rounded-lg text-xs font-bold bg-white text-slate-700 border border-blue-200 shadow-2xs">
                      {selectedCodes.length} Courses
                    </div>
                  </div>
                )}

                {/* Upload Excel Button */}
                <label className="cursor-pointer inline-flex items-center px-3 py-1.5 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 text-xs font-bold rounded-xl border border-indigo-200 transition-all shadow-2xs">
                  <Upload className="w-3.5 h-3.5 mr-1" />
                  {isAnalyzing ? 'Analyzing...' : (hasCoursesLoaded ? 'Upload New Sheet' : 'Upload Excel')}
                  <input type="file" accept=".xlsx,.xls" className="hidden" onChange={handleExcelUpload} />
                </label>

                {hasCoursesLoaded && (
                  <>
                    <button
                      onClick={clearAll}
                      className="px-2.5 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold rounded-xl transition-all shadow-2xs"
                    >
                      Clear Selection
                    </button>

                    <button
                      onClick={handleGenerate}
                      className="inline-flex items-center justify-center px-3.5 py-1.5 bg-gradient-to-r from-blue-600 via-indigo-600 to-purple-600 hover:from-blue-500 hover:to-purple-500 text-white font-extrabold text-xs rounded-xl shadow-md transition-all transform active:scale-95"
                    >
                      <Sparkles className="w-3.5 h-3.5 mr-1" />
                      Generate
                    </button>
                  </>
                )}

                {/* User Signout */}
                <button
                  onClick={logout}
                  title="Sign Out"
                  className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-xl transition-all"
                >
                  <LogOut className="w-4 h-4" />
                </button>
              </div>
            </div>

            {/* Bottom Row: Filters + Search (Only shown once courses are loaded) */}
            {hasCoursesLoaded && (
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pt-2 border-t border-slate-100">
                <div className="flex flex-wrap items-center gap-1.5 text-xs">
                  <span className="text-[11px] font-bold text-slate-400 mr-1 hidden lg:inline">Filter:</span>
                  {['ALL', 'PC', 'School Core', 'BASKETS'].map(cat => (
                    <button
                      key={cat}
                      onClick={() => setSelectedCategory(cat)}
                      className={`px-2.5 py-1 rounded-lg font-bold text-xs transition-colors ${selectedCategory === cat ? 'bg-blue-600 text-white' : 'bg-slate-100 text-slate-700 hover:bg-slate-200'}`}
                    >
                      {cat === 'ALL' ? 'All' : cat === 'PC' ? 'Program Core' : cat}
                    </button>
                  ))}
                </div>

                <div className="relative flex-1 sm:max-w-xs md:max-w-sm">
                  <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-2.5" />
                  <input
                    type="text"
                    value={searchQuery}
                    onChange={e => setSearchQuery(e.target.value)}
                    placeholder="Search course code, title, teacher, slot..."
                    className="bg-white border border-slate-200 text-xs rounded-xl pl-8 pr-4 py-1.5 focus:outline-none focus:ring-2 focus:ring-blue-500 w-full shadow-2xs"
                  />
                </div>
              </div>
            )}

          </div>
        </header>

        {/* VIEW 1: UPLOAD LANDING PAGE (Shown when user has no sheet uploaded yet) */}
        {!hasCoursesLoaded && (
          <div className="bg-white rounded-3xl border border-slate-200 shadow-sm p-8 sm:p-12 text-center max-w-3xl mx-auto my-8">
            <div className="w-20 h-20 rounded-3xl bg-gradient-to-tr from-blue-600 via-indigo-600 to-purple-600 text-white flex items-center justify-center mx-auto shadow-xl shadow-indigo-500/20 mb-6">
              <FileSpreadsheet className="w-10 h-10" />
            </div>

            <h2 className="text-2xl font-black text-slate-900 tracking-tight">Upload Your Course Registration Sheet</h2>
            <p className="text-sm text-slate-500 max-w-md mx-auto mt-2">
              Upload your university timetable or course list Excel file (<code className="bg-slate-100 text-slate-700 px-1.5 py-0.5 rounded text-xs">.xlsx</code> or <code className="bg-slate-100 text-slate-700 px-1.5 py-0.5 rounded text-xs">.xls</code>) to automatically parse courses, teachers, and slot timings.
            </p>

            {/* Upload Drag & Drop Area */}
            <div className="mt-8 border-2 border-dashed border-indigo-200 bg-indigo-50/40 hover:bg-indigo-50/70 hover:border-indigo-400 transition-all rounded-3xl p-8 max-w-lg mx-auto relative group">
              <input
                type="file"
                accept=".xlsx,.xls"
                onChange={handleExcelUpload}
                className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-10"
              />
              <div className="flex flex-col items-center justify-center">
                <div className="w-12 h-12 rounded-2xl bg-white text-indigo-600 flex items-center justify-center shadow-md mb-3 group-hover:scale-110 transition-transform">
                  <Upload className="w-6 h-6" />
                </div>
                <div className="text-sm font-extrabold text-slate-800">
                  {isAnalyzing ? 'Analyzing Excel File...' : 'Click to Upload or Drag & Drop'}
                </div>
                <p className="text-xs text-slate-400 mt-1 font-medium">Supports university format registration sheets</p>
                <button
                  type="button"
                  className="mt-4 px-5 py-2 bg-indigo-600 text-white font-extrabold text-xs rounded-xl shadow-md group-hover:bg-indigo-500 transition-colors pointer-events-none"
                >
                  Browse Computer
                </button>
              </div>
            </div>


          </div>
        )}

        {/* VIEW 2: ACTIVE SCHEDULER STUDIO (Shown once courses are loaded) */}
        {hasCoursesLoaded && (
          <>
            {/* SECTION 1: AVAILABLE COURSES CATALOG */}
            <section className="no-print bg-white rounded-2xl border border-slate-200 shadow-xs p-4 sm:p-5">
              <div className="flex items-center justify-between pb-3 border-b border-slate-100">
                <div className="flex items-center gap-2.5">
                  <div className="w-7 h-7 rounded-lg bg-blue-600 text-white flex items-center justify-center font-black text-xs shadow-xs">
                    1
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <h2 className="text-sm font-black text-slate-900 tracking-tight">Available Courses Catalog</h2>
                      <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-slate-100 text-slate-600">
                        {filteredCatalog.length} Courses
                      </span>
                    </div>
                    <p className="text-[11px] text-slate-500">Browse or search courses below. Click <span className="font-bold text-blue-600">+ Add Course</span> to configure its teachers below.</p>
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3 mt-4">
                {filteredCatalog.map(c => {
                  const isSelected = selectedCodes.includes(c.code);
                  return (
                    <div
                      key={c.code}
                      className={`rounded-2xl p-3.5 border transition-all flex flex-col justify-between ${isSelected ? 'border-blue-500 bg-blue-50/40 shadow-sm ring-1 ring-blue-500' : 'border-slate-200 bg-white hover:border-slate-300'}`}
                    >
                      <div>
                        <div className="flex items-center justify-between gap-1 mb-1">
                          <span className="font-black text-xs text-blue-700 tracking-wide">{c.code}</span>
                          <span className="text-[10px] font-bold px-2 py-0.5 rounded-md bg-slate-100 text-slate-600 border border-slate-200">
                            {c.credits} Cr
                          </span>
                        </div>
                        <h3 className="font-bold text-xs text-slate-800 line-clamp-2 leading-snug">{c.title}</h3>
                        <div className="mt-2 flex flex-wrap gap-1 text-[10px] text-slate-500 font-medium">
                          <span className="px-1.5 py-0.5 bg-slate-100 rounded">{c.basket || 'Core'}</span>
                          <span className="px-1.5 py-0.5 bg-slate-100 rounded">{(c.theoryOptions || []).length} Th / {(c.labOptions || []).length} Lab</span>
                        </div>
                      </div>

                      <button
                        onClick={() => toggleCourseSelection(c.code)}
                        className={`mt-3 w-full py-1.5 px-3 rounded-xl text-xs font-extrabold transition-all flex items-center justify-center gap-1 ${isSelected ? 'bg-rose-50 text-rose-700 hover:bg-rose-100 border border-rose-200' : 'bg-blue-600 hover:bg-blue-500 text-white shadow-xs'}`}
                      >
                        {isSelected ? '✓ In Selection (Remove)' : '+ Add Course'}
                      </button>
                    </div>
                  );
                })}
              </div>
            </section>

            {/* SECTION 2: SELECTED COURSES & FACULTY PREFERENCES */}
            <section className="no-print bg-white rounded-2xl border-2 border-blue-100 shadow-sm p-4 sm:p-5">
              <div className="flex items-center justify-between pb-3 border-b border-slate-100">
                <div className="flex items-center gap-2.5">
                  <div className="w-7 h-7 rounded-lg bg-indigo-600 text-white flex items-center justify-center font-black text-xs shadow-xs">
                    2
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <h2 className="text-sm font-black text-slate-900 tracking-tight">Selected Courses & Faculty Preferences</h2>
                      <span className="px-2 py-0.5 rounded-full text-[10px] font-extrabold bg-blue-100 text-blue-800">
                        {selectedCodes.length} Courses ({totalCredits.toFixed(1)} Cr)
                      </span>
                    </div>
                    <p className="text-[11px] text-slate-500">Selected courses appear right above your timetable. Select or unselect specific teachers/slots according to your preference.</p>
                  </div>
                </div>

                {selectedCodes.length > 0 && (
                  <button onClick={clearAll} className="px-2.5 py-1 bg-rose-50 hover:bg-rose-100 text-rose-700 text-xs font-bold rounded-lg transition-colors">
                    Remove All
                  </button>
                )}
              </div>

              {selectedCodes.length === 0 ? (
                <div className="py-8 text-center text-slate-400 text-xs font-medium">
                  No courses selected yet. Click <strong>+ Add Course</strong> in the catalog above to configure preferred faculty and slots.
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-4">
                  {selectedCodes.map(code => {
                    const c = courses[code];
                    if (!c) return null;
                    return (
                      <div key={code} className="p-4 rounded-2xl border border-blue-200 bg-blue-50/20 shadow-2xs">
                        <div className="flex items-center justify-between pb-2 border-b border-slate-200">
                          <div>
                            <div className="flex items-center gap-2">
                              <span className="font-black text-xs text-blue-700">{c.code}</span>
                              <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-blue-100 text-blue-800">{c.credits} Cr</span>
                            </div>
                            <h4 className="font-bold text-xs text-slate-800 mt-0.5">{c.title}</h4>
                          </div>
                          <button onClick={() => toggleCourseSelection(c.code)} className="text-slate-400 hover:text-rose-600 p-1">
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>

                        {/* Teacher slots list */}
                        <div className="mt-3 space-y-3">
                          {/* Theory options */}
                          {(c.theoryOptions || []).length > 0 && (
                            <div>
                              <div className="text-[10px] font-extrabold uppercase text-slate-400 tracking-wider mb-1.5 flex items-center justify-between">
                                <span>Theory Lecturers & Slots</span>
                                <div className="space-x-1">
                                  <button onClick={() => setAllOptionsForCourse(c.code, true)} className="text-blue-600 hover:underline">Select All</button>
                                  <span>•</span>
                                  <button onClick={() => setAllOptionsForCourse(c.code, false)} className="text-slate-500 hover:underline">None</button>
                                </div>
                              </div>
                              <div className="space-y-1 max-h-36 overflow-y-auto pr-1">
                                {c.theoryOptions.map(to => {
                                  const key = `${c.code}_theory_${to.faculty}_${to.slot}`;
                                  const isChecked = optionPrefs[key] !== false;
                                  return (
                                    <label key={key} className="flex items-center justify-between p-1.5 rounded-lg bg-white border border-slate-200 text-xs cursor-pointer hover:bg-slate-50">
                                      <div className="flex items-center gap-2 overflow-hidden">
                                        <input type="checkbox" checked={isChecked} onChange={() => toggleOption(key)} className="rounded text-blue-600" />
                                        <span className="font-medium text-slate-800 truncate">{to.faculty}</span>
                                      </div>
                                      <span className="px-1.5 py-0.5 bg-blue-100 text-blue-800 font-extrabold rounded text-[10px] shrink-0">{to.slot}</span>
                                    </label>
                                  );
                                })}
                              </div>
                            </div>
                          )}

                          {/* Lab options */}
                          {(c.labOptions || []).length > 0 && (
                            <div>
                              <div className="text-[10px] font-extrabold uppercase text-slate-400 tracking-wider mb-1.5">
                                Lab Instructors & Slots
                              </div>
                              <div className="space-y-1 max-h-36 overflow-y-auto pr-1">
                                {c.labOptions.map(lo => {
                                  const key = `${c.code}_lab_${lo.faculty}_${lo.slot}`;
                                  const isChecked = optionPrefs[key] !== false;
                                  return (
                                    <label key={key} className="flex items-center justify-between p-1.5 rounded-lg bg-white border border-slate-200 text-xs cursor-pointer hover:bg-slate-50">
                                      <div className="flex items-center gap-2 overflow-hidden">
                                        <input type="checkbox" checked={isChecked} onChange={() => toggleOption(key)} className="rounded text-amber-600" />
                                        <span className="font-medium text-slate-800 truncate">{lo.faculty}</span>
                                      </div>
                                      <span className="px-1.5 py-0.5 bg-amber-100 text-amber-800 font-extrabold rounded text-[10px] shrink-0">{lo.slot}</span>
                                    </label>
                                  );
                                })}
                              </div>
                            </div>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </section>

            {/* Floating Generate Bar */}
            <div className="no-print sticky bottom-4 z-40 bg-slate-900/95 backdrop-blur-md text-white rounded-2xl p-3.5 sm:p-4 shadow-2xl border border-slate-700 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div className="flex items-center space-x-3">
                <div className="w-10 h-10 rounded-xl bg-blue-600 flex items-center justify-center font-black text-sm">
                  {selectedCodes.length}
                </div>
                <div>
                  <div className="text-xs font-bold text-slate-300">Selected: <span className="text-white font-extrabold">{selectedCodes.length} Courses</span></div>
                  <div className="text-[11px] text-slate-400">Total Credits: <span className="font-bold text-blue-400">{totalCredits.toFixed(1)}</span> Credits</div>
                </div>
              </div>

              <button
                onClick={handleGenerate}
                className="inline-flex items-center justify-center px-6 py-2.5 bg-gradient-to-r from-blue-600 via-indigo-600 to-purple-600 hover:from-blue-500 hover:to-purple-500 text-white font-extrabold text-sm rounded-xl shadow-lg transition-all transform active:scale-95"
              >
                <Sparkles className="w-5 h-5 mr-2" />
                Generate Timetable Possibilities
              </button>
            </div>

            {/* SECTION 3: RESULTS SECTION */}
            {hasGenerated && (
              <div id="results-section" className="space-y-4">
                
                {/* Toolbar */}
                <div className="no-print bg-slate-900 text-white rounded-2xl p-3 sm:p-3.5 shadow-lg flex flex-col md:flex-row md:items-center justify-between gap-3">
                  <div className="flex items-center space-x-3">
                    <span className="px-3 py-1 rounded-full text-xs font-extrabold bg-emerald-500/20 text-emerald-300 border border-emerald-500/40">
                      {timetables.length} Timetables Found
                    </span>
                    {timetables.length > 0 && (
                      <span className="text-xs font-bold text-slate-300">
                        Option {currentIndex + 1} of {timetables.length}
                      </span>
                    )}
                  </div>

                  {timetables.length > 0 && currentSchedule && (
                    <div className="flex flex-wrap items-center gap-2">
                      <div className="flex items-center space-x-1.5 border-r border-slate-700 pr-2 mr-1">
                        {/* PNG Button */}
                        <button
                          onClick={() => { downloadImage(currentSchedule, 'png'); triggerToast(`Downloaded PNG for Option ${currentSchedule.id}`); }}
                          title="Download high-res PNG image"
                          className="inline-flex items-center px-3 py-1.5 bg-blue-600 hover:bg-blue-500 text-white text-xs font-extrabold rounded-xl shadow-sm transition-all"
                        >
                          <Download className="w-3.5 h-3.5 mr-1" />
                          Download PNG
                        </button>

                        {/* JPG Button */}
                        <button
                          onClick={() => { downloadImage(currentSchedule, 'jpeg'); triggerToast(`Downloaded JPG for Option ${currentSchedule.id}`); }}
                          title="Download JPG image"
                          className="inline-flex items-center px-3 py-1.5 bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-extrabold rounded-xl shadow-sm transition-all"
                        >
                          <Download className="w-3.5 h-3.5 mr-1" />
                          Download JPG
                        </button>

                        {/* PDF Button */}
                        <button
                          onClick={() => { downloadPdf(currentSchedule); triggerToast(`Downloaded PDF for Option ${currentSchedule.id}`); }}
                          title="Direct clean 1-page landscape PDF"
                          className="inline-flex items-center px-3 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-extrabold rounded-xl shadow-sm transition-all"
                        >
                          <Download className="w-3.5 h-3.5 mr-1" />
                          Download PDF
                        </button>

                        {/* Print */}
                        <button
                          onClick={() => window.print()}
                          className="inline-flex items-center px-2.5 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-semibold rounded-xl border border-slate-700 transition-all"
                        >
                          <Printer className="w-3.5 h-3.5 mr-1" />
                          Print
                        </button>
                      </div>

                      {/* Navigation */}
                      <div className="flex items-center space-x-1.5">
                        <button
                          disabled={currentIndex <= 0}
                          onClick={() => setCurrentIndex(i => Math.max(0, i - 1))}
                          className="p-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 disabled:opacity-40 text-slate-200"
                        >
                          <ChevronLeft className="w-4 h-4" />
                        </button>
                        <select
                          value={currentIndex}
                          onChange={e => setCurrentIndex(Number(e.target.value))}
                          className="bg-slate-800 border border-slate-700 text-xs font-bold rounded-xl px-2.5 py-1.5 text-slate-200 focus:outline-none"
                        >
                          {timetables.map((t, idx) => (
                            <option key={t.id} value={idx}>Schedule #{t.id}</option>
                          ))}
                        </select>
                        <button
                          disabled={currentIndex >= timetables.length - 1}
                          onClick={() => setCurrentIndex(i => Math.min(timetables.length - 1, i + 1))}
                          className="p-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 disabled:opacity-40 text-slate-200"
                        >
                          <ChevronRight className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                  )}
                </div>

                {/* Clash Report if 0 timetables found */}
                {timetables.length === 0 && clashMessage && (
                  <div className="p-5 rounded-2xl bg-amber-50 border border-amber-300 text-amber-900 shadow-sm">
                    <div className="flex items-center gap-2 mb-2 font-black text-sm text-amber-800">
                      <AlertTriangle className="w-5 h-5 text-amber-600" />
                      No Conflict-Free Timetable Found
                    </div>
                    <p className="text-xs leading-relaxed">{clashMessage}</p>
                    <div className="mt-3 text-xs font-semibold text-amber-700">
                      💡 Tip: Scroll slightly up to Section 2 and select more teachers for your courses to give the solver more non-overlapping combinations!
                    </div>
                  </div>
                )}

                {/* Printable Area: Timetable Matrix Card + Summary Table Card */}
                {currentSchedule && (
                  <div id="printable-timetable-area" className="space-y-4 bg-white p-2 sm:p-3 rounded-2xl">
                    
                    {/* Timetable Card */}
                    <div className="rounded-2xl overflow-hidden shadow-md border border-slate-200 bg-white">
                      <div className="bg-gradient-to-r from-blue-700 via-indigo-700 to-purple-800 px-4 py-2.5 text-white flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
                        <div>
                          <div className="flex items-center gap-2">
                            <span className="inline-block px-2 py-0.5 rounded-full text-[11px] font-bold bg-white/20 text-white backdrop-blur-sm">
                              Schedule Option {currentSchedule.id}
                            </span>
                            <h2 className="text-base font-extrabold tracking-tight">Academic Timetable Matrix</h2>
                          </div>
                          <p className="text-[11px] text-blue-100 mt-0.5">100% Conflict-Free Schedule (Zero overlap between Theory and Lab)</p>
                        </div>
                        <div className="flex items-center gap-2 text-xs font-semibold">
                          <div className="bg-white/10 px-2.5 py-1 rounded-xl border border-white/10 backdrop-blur-sm">
                            COURSES: <span className="font-bold text-white">{currentSchedule.sections.length}</span>
                          </div>
                          <div className="bg-white/10 px-2.5 py-1 rounded-xl border border-white/10 backdrop-blur-sm">
                            CREDITS: <span className="font-bold text-white">{currentSchedule.totalCredits.toFixed(1)}</span>
                          </div>
                        </div>
                      </div>

                      {/* Timetable Matrix Grid */}
                      <div className="overflow-x-auto">
                        <TimetableGrid schedule={currentSchedule} />
                      </div>
                    </div>

                    {/* Registration Summary Table */}
                    <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
                      <div className="px-4 py-2 border-b border-slate-200 bg-slate-50 flex items-center justify-between">
                        <div className="flex items-center gap-2 font-bold text-slate-900 text-xs">
                          <BookOpen className="w-4 h-4 text-blue-600" />
                          Course Registration & Faculty Allocation Summary
                        </div>
                        <span className="text-xs text-slate-500 font-medium">{currentSchedule.sections.length} Courses Allocated</span>
                      </div>
                      <div className="overflow-x-auto">
                        <table className="w-full text-left text-xs border-collapse">
                          <thead>
                            <tr className="bg-slate-100 text-slate-700 font-semibold border-b border-slate-200">
                              <th className="py-2.5 px-3 w-10 text-center">#</th>
                              <th className="py-2.5 px-3">Course Code</th>
                              <th className="py-2.5 px-3">Course Title</th>
                              <th className="py-2.5 px-3">Category</th>
                              <th className="py-2.5 px-3">Theory Slot</th>
                              <th className="py-2.5 px-3">Theory Faculty</th>
                              <th className="py-2.5 px-3">Lab Slot</th>
                              <th className="py-2.5 px-3">Lab Faculty</th>
                              <th className="py-2.5 px-3 text-center">Credits</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-slate-100">
                            {currentSchedule.sections.map((sec, idx) => (
                              <tr key={sec.courseCode} className={idx % 2 === 0 ? 'bg-white' : 'bg-slate-50/50'}>
                                <td className="py-2 px-3 text-center text-slate-400 font-bold">{idx + 1}</td>
                                <td className="py-2 px-3 font-black text-slate-900">{sec.courseCode}</td>
                                <td className="py-2 px-3 font-semibold text-slate-800">{sec.courseTitle}</td>
                                <td className="py-2 px-3 text-slate-500">{sec.category || 'Core'}</td>
                                <td className="py-2 px-3 font-bold text-blue-700">{sec.theorySlot}</td>
                                <td className="py-2 px-3 text-slate-700">{sec.theoryFaculty}</td>
                                <td className="py-2 px-3 font-bold text-amber-700">{sec.labSlot}</td>
                                <td className="py-2 px-3 text-slate-700">{sec.labFaculty}</td>
                                <td className="py-2 px-3 text-center font-extrabold text-slate-900">{sec.credits}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </div>

                  </div>
                )}

              </div>
            )}
          </>
        )}

      </div>
    </div>
  );
}

// Subcomponent: Timetable Grid
function TimetableGrid({ schedule }: { schedule: TimetableSchedule }) {
  const theoryMap: Record<string, { sec: any; slot: string }> = {};
  const labMap: Record<string, { sec: any; slot: string }> = {};

  schedule.sections.forEach(sec => {
    if (sec.theorySlot && sec.theorySlot !== 'N/A') {
      const positions = resolveSlotToPositions(sec.theorySlot);
      positions.forEach(p => {
        theoryMap[`${p.day}_${p.slotId}`] = { sec, slot: sec.theorySlot };
      });
    }
    if (sec.labSlot && sec.labSlot !== 'N/A') {
      const positions = resolveSlotToPositions(sec.labSlot);
      positions.forEach(p => {
        const blockId = Math.ceil(p.slotId / 2);
        labMap[`${p.day}_${blockId}`] = { sec, slot: sec.labSlot };
      });
    }
  });

  const days = ['MON', 'TUE', 'WED', 'THU', 'FRI'];
  const timeSlots = [
    '08:00 - 08:50', '09:00 - 09:50', '10:00 - 10:50', '11:00 - 11:50',
    '12:45 - 13:35', '13:45 - 14:35', '14:45 - 15:35', '15:45 - 16:35'
  ];

  return (
    <table className="w-full border-collapse text-xs">
      <thead>
        <tr className="bg-[#0a3d7a] text-white border-b border-blue-900">
          <th rowSpan={2} className="p-2 border border-blue-800 text-center text-xs font-black w-14">DAY</th>
          <th rowSpan={2} className="p-2 border border-blue-800 text-center text-[11px] font-bold w-12">TYPE</th>
          <th colSpan={4} className="p-1 border border-blue-800 text-center font-bold tracking-wide">MORNING SESSIONS</th>
          <th rowSpan={2} className="p-1 border border-blue-800 bg-[#94a3b8] text-slate-900 font-extrabold text-[10px] [writing-mode:vertical-rl] rotate-180 tracking-widest text-center w-8">LUNCH</th>
          <th colSpan={4} className="p-1 border border-blue-800 text-center font-bold tracking-wide">AFTERNOON SESSIONS</th>
        </tr>
        <tr className="bg-[#0d4a94] text-slate-200 text-[10px] border-b border-blue-800">
          {timeSlots.map((ts, i) => (
            <th key={i} className="p-1 border border-blue-900 text-center w-28 font-medium">{ts}</th>
          ))}
        </tr>
      </thead>
      <tbody>
        {days.map(day => (
          <React.Fragment key={day}>
            {/* Theory Row */}
            <tr className="border-t border-slate-300">
              <td rowSpan={2} className="bg-slate-200 font-black text-slate-800 text-xs text-center border border-slate-300 w-14">
                {day}
              </td>
              <td className="bg-blue-50 font-bold text-blue-900 text-[10px] text-center border border-slate-300">
                Theory
              </td>

              {/* Slots 1..4 */}
              {[1, 2, 3, 4].map(s => {
                const cell = theoryMap[`${day}_${s}`];
                return (
                  <td key={s} className="border border-slate-300 course-cell p-1 text-center h-11 align-middle" style={{ backgroundColor: cell ? (COURSE_COLORS[cell.sec.courseCode]?.bg || '#e0f2fe') : '#ffffff' }}>
                    {cell ? (
                      <>
                        <span className="inline-block font-extrabold text-[9px] px-1 rounded bg-blue-200 text-blue-900">{cell.slot}</span>
                        <div className="font-black text-[11px] text-slate-900 leading-tight">{cell.sec.courseCode}</div>
                        <div className="text-[9px] text-slate-500 truncate max-w-[110px] mx-auto">{cell.sec.theoryFaculty}</div>
                      </>
                    ) : (
                      <span className="text-[10px] text-slate-300">Free</span>
                    )}
                  </td>
                );
              })}

              <td rowSpan={2} className="bg-slate-300 text-slate-600 font-black text-[10px] tracking-widest text-center border border-slate-300">
                LUNCH
              </td>

              {/* Slots 5..8 */}
              {[5, 6, 7, 8].map(s => {
                const cell = theoryMap[`${day}_${s}`];
                return (
                  <td key={s} className="border border-slate-300 course-cell p-1 text-center h-11 align-middle" style={{ backgroundColor: cell ? (COURSE_COLORS[cell.sec.courseCode]?.bg || '#e0f2fe') : '#ffffff' }}>
                    {cell ? (
                      <>
                        <span className="inline-block font-extrabold text-[9px] px-1 rounded bg-blue-200 text-blue-900">{cell.slot}</span>
                        <div className="font-black text-[11px] text-slate-900 leading-tight">{cell.sec.courseCode}</div>
                        <div className="text-[9px] text-slate-500 truncate max-w-[110px] mx-auto">{cell.sec.theoryFaculty}</div>
                      </>
                    ) : (
                      <span className="text-[10px] text-slate-300">Free</span>
                    )}
                  </td>
                );
              })}
            </tr>

            {/* Lab Row */}
            <tr className="bg-amber-50/50">
              <td className="bg-slate-100 font-bold text-slate-600 text-[10px] text-center border border-slate-300 h-9">
                Lab
              </td>

              {/* Lab Block 1 & 2 */}
              {[1, 2].map(b => {
                const cell = labMap[`${day}_${b}`];
                return (
                  <td key={b} colSpan={2} className="border border-slate-300 p-1 text-center h-9 align-middle" style={{ backgroundColor: cell ? (COURSE_COLORS[cell.sec.courseCode]?.bg || '#fef3c7') : '#ffffff' }}>
                    {cell ? (
                      <div className="flex flex-col items-center justify-center">
                        <div className="flex items-center gap-1">
                          <span className="font-extrabold text-[9px] px-1 rounded bg-amber-200 text-amber-900">{cell.slot}</span>
                          <span className="font-bold text-[10px] text-slate-900">{cell.sec.courseCode} Lab</span>
                        </div>
                        <div className="text-[9px] text-slate-500 truncate max-w-[180px]">{cell.sec.labFaculty}</div>
                      </div>
                    ) : (
                      <span className="text-[10px] text-slate-300">Free</span>
                    )}
                  </td>
                );
              })}

              {/* Lab Block 3 & 4 */}
              {[3, 4].map(b => {
                const cell = labMap[`${day}_${b}`];
                return (
                  <td key={b} colSpan={2} className="border border-slate-300 p-1 text-center h-9 align-middle" style={{ backgroundColor: cell ? (COURSE_COLORS[cell.sec.courseCode]?.bg || '#fef3c7') : '#ffffff' }}>
                    {cell ? (
                      <div className="flex flex-col items-center justify-center">
                        <div className="flex items-center gap-1">
                          <span className="font-extrabold text-[9px] px-1 rounded bg-amber-200 text-amber-900">{cell.slot}</span>
                          <span className="font-bold text-[10px] text-slate-900">{cell.sec.courseCode} Lab</span>
                        </div>
                        <div className="text-[9px] text-slate-500 truncate max-w-[180px]">{cell.sec.labFaculty}</div>
                            <Analytics />
    </div>
                    ) : (
                      <span className="text-[10px] text-slate-300">Free</span>
                    )}
                  </td>
                );
              })}
            </tr>
          </React.Fragment>
        ))}
      </tbody>
    </table>
  );
}
