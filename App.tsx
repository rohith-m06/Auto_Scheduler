import React, { useState, useEffect, useRef } from 'react';
import { Analytics } from '@vercel/analytics/react';
import { CourseSelector } from './components/CourseSelector';
import { FacultyPreferences } from './components/FacultyPreferences';
import { TimetableGrid } from './components/TimetableGrid';
import { Course, Timetable, ViewState, TimeSlotMapping, SavedTimetable } from './types';
import { generateTimetables, analyzeSchedulingConflicts, ConflictReport } from './services/scheduler';
import { Calendar, ChevronRight, ChevronLeft, Sparkles, AlertCircle, Upload, LogOut, ArrowLeft, GraduationCap, Home, Heart, RotateCcw, Trash2, Send, Download, RefreshCw, XCircle } from 'lucide-react';
import { GoogleGenAI } from "@google/genai";
import { DataUpload } from './components/DataUpload';
import { LabSlotPreferences } from './components/LabSlotPreferences';
import { SLOT_TIMINGS } from './constants';
import { AuthProvider, useAuth } from './context/AuthContext';
import { AuthPage } from './components/AuthPage';
import { db } from './services/firebase';
import { doc, getDoc, setDoc } from 'firebase/firestore';

const ITEMS_PER_PAGE = 10;

const AppContent: React.FC = () => {
  const { currentUser, userName, logout } = useAuth();
  const [viewState, setViewState] = useState<ViewState>(ViewState.LANDING);
  const [courses, setCourses] = useState<Course[]>([]);
  const [slotTimings, setSlotTimings] = useState<TimeSlotMapping>(SLOT_TIMINGS);
  const [selectedCourses, setSelectedCourses] = useState<Course[]>([]);
  const [preferences, setPreferences] = useState<{ [key: string]: string[] }>({});
  const [labPreferences, setLabPreferences] = useState<{ [key: string]: string[] }>({});
  const [generatedTimetables, setGeneratedTimetables] = useState<Timetable[]>([]);
  const [conflictReport, setConflictReport] = useState<ConflictReport | null>(null);
  const [currentPage, setCurrentPage] = useState<number>(1);
  const [resultsAiAnalysis, setResultsAiAnalysis] = useState<string>('');
  const [favoritesAiAnalysis, setFavoritesAiAnalysis] = useState<string>('');
  const [resultsChatHistory, setResultsChatHistory] = useState<{role: 'user' | 'assistant'; content: string}[]>([]);
  const [favoritesChatHistory, setFavoritesChatHistory] = useState<{role: 'user' | 'assistant'; content: string}[]>([]);
  const [chatInput, setChatInput] = useState<string>('');
  const resultsChatRef = useRef<HTMLDivElement>(null);
  const favoritesChatRef = useRef<HTMLDivElement>(null);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [hasUploadedData, setHasUploadedData] = useState(false);
  const [isLoadingData, setIsLoadingData] = useState(true);
  const [savedTimetables, setSavedTimetables] = useState<SavedTimetable[]>([]);
  const [selectedSavedTimetable, setSelectedSavedTimetable] = useState<SavedTimetable | null>(null);
  const [selectedForComparison, setSelectedForComparison] = useState<number[]>([]);

  // Load user data from Firestore
  useEffect(() => {
    async function loadUserData() {
      if (!currentUser) {
        // Clear all state when logged out to prevent data leaking between accounts
        setCourses([]);
        setHasUploadedData(false);
        setSlotTimings({});
        setSavedTimetables([]);
        setSelectedCourses([]);
        setPreferences({});
        setLabPreferences({});
        setGeneratedTimetables([]);
        setViewState(ViewState.SELECTION);
        setIsLoadingData(false);
        return;
      }

      setIsLoadingData(true);
      const timeout = setTimeout(() => {
        setIsLoadingData(false);
      }, 5000);

      try {
        const docRef = doc(db, 'users', currentUser.uid);
        const docSnap = await getDoc(docRef);
        clearTimeout(timeout);

        if (docSnap.exists()) {
          const data = docSnap.data();
          
          // Load courses
          if (data.courses && Array.isArray(data.courses) && data.courses.length > 0) {
            setCourses(data.courses);
            setHasUploadedData(true);
          }
          // Load slot timings (always merge on top of base SLOT_TIMINGS to ensure complete definitions)
          if (data.slotTimings && Object.keys(data.slotTimings).length > 0) {
            setSlotTimings({ ...SLOT_TIMINGS, ...data.slotTimings });
          }
          // Load saved timetables (favorites)
          if (data.savedTimetables && Array.isArray(data.savedTimetables) && data.savedTimetables.length > 0) {
            setSavedTimetables(data.savedTimetables);
          }
          // Load selected courses
          if (data.selectedCourses && Array.isArray(data.selectedCourses) && data.selectedCourses.length > 0) {
            setSelectedCourses(data.selectedCourses);
          }
          // Load preferences
          if (data.preferences && typeof data.preferences === 'object') {
            setPreferences(data.preferences);
          }
          // Load lab preferences
          if (data.labPreferences && typeof data.labPreferences === 'object') {
            setLabPreferences(data.labPreferences);
          }
          // Load last view state (so user returns to where they were)
          if (data.lastViewState && Object.values(ViewState).includes(data.lastViewState)) {
            const validRestoreStates = [ViewState.SELECTION, ViewState.FAVORITES];
            if (validRestoreStates.includes(data.lastViewState)) {
              setViewState(data.lastViewState);
            }
          }
        }
      } catch (error) {
        clearTimeout(timeout);
        console.error("Error loading user data:", error);
      } finally {
        setIsLoadingData(false);
      }
    }
    loadUserData();
  }, [currentUser]);

  // Helper to remove undefined values (Firebase doesn't accept undefined)
  const sanitize = (obj: any): any => {
    if (obj === undefined) return null;
    if (obj === null) return null;
    if (Array.isArray(obj)) {
      return obj.map(item => sanitize(item));
    }
    if (typeof obj === 'object' && obj !== null) {
      const cleaned: any = {};
      for (const key in obj) {
        if (obj[key] !== undefined) {
          cleaned[key] = sanitize(obj[key]);
        }
      }
      return cleaned;
    }
    return obj;
  };

  // Save session state (selection, preferences, favorites) to Firestore
  // NOTE: Candidate generatedTimetables are kept strictly in client RAM to prevent Firestore 1MB quota overflow
  const saveSessionState = async (
    coursesToSave: Course[],
    slotsToSave: TimeSlotMapping,
    selectedToSave: Course[],
    prefsToSave: { [key: string]: string[] },
    labPrefsToSave: { [key: string]: string[] },
    savedToSave: SavedTimetable[],
    viewToSave: ViewState
  ) => {
    if (!currentUser) return;
    
    try {
      const dataToSave = {
        courses: sanitize(coursesToSave) || [],
        slotTimings: sanitize(slotsToSave) || {},
        selectedCourses: sanitize(selectedToSave) || [],
        preferences: sanitize(prefsToSave) || {},
        labPreferences: sanitize(labPrefsToSave) || {},
        savedTimetables: sanitize(savedToSave) || [],
        lastViewState: viewToSave,
        updatedAt: new Date()
      };
      
      await setDoc(doc(db, 'users', currentUser.uid), dataToSave, { merge: true });
    } catch (error: any) {
      console.error("Error saving session state:", error);
      console.error("Error code:", error?.code);
      console.error("Error message:", error?.message);
    }
  };

  // Auto-save session state when it changes (debounced)
  const saveTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  
  useEffect(() => {
    if (!currentUser || isLoadingData) return;
    
    // Clear previous timeout
    if (saveTimeoutRef.current) {
      clearTimeout(saveTimeoutRef.current);
    }
    
    // Set new timeout to save
    saveTimeoutRef.current = setTimeout(() => {
      saveSessionState(
        courses,
        slotTimings,
        selectedCourses,
        preferences,
        labPreferences,
        savedTimetables,
        viewState
      );
    }, 1500); // Debounce by 1.5 seconds
    
    return () => {
      if (saveTimeoutRef.current) {
        clearTimeout(saveTimeoutRef.current);
      }
    };
  }, [courses, slotTimings, selectedCourses, preferences, labPreferences, savedTimetables, viewState, currentUser, isLoadingData]);

  const saveFavoriteTimetables = async (timetables: SavedTimetable[]) => {
    if (!currentUser) return;
    try {
      await setDoc(doc(db, 'users', currentUser.uid), {
        savedTimetables: sanitize(timetables) || [],
        updatedAt: new Date()
      }, { merge: true });
    } catch (error) {
      console.error("Error saving favorites:", error);
    }
  };

  const toggleCourse = (course: Course) => {
    if (selectedCourses.find(c => c.code === course.code)) {
      setSelectedCourses(selectedCourses.filter(c => c.code !== course.code));
      const newPrefs = { ...preferences };
      delete newPrefs[course.code];
      const newLabPrefs = { ...labPreferences };
      delete newLabPrefs[course.code];
      setLabPreferences(newLabPrefs);
      setPreferences(newPrefs);
    } else {
      setSelectedCourses([...selectedCourses, course]);
    }
  };

  const updatePreference = (courseCode: string, faculty: string) => {
    const current = preferences[courseCode] || [];
    const newSelection = current.includes(faculty)
      ? current.filter(f => f !== faculty)
      : [...current, faculty];
    setPreferences({ ...preferences, [courseCode]: newSelection });
  };

  const updateLabPreference = (courseCode: string, labSlot: string) => {
    const current = labPreferences[courseCode] || [];
    const newSelection = current.includes(labSlot)
      ? current.filter(l => l !== labSlot)
      : [...current, labSlot];
    setLabPreferences({ ...labPreferences, [courseCode]: newSelection });
  };

  const handleDataLoaded = (newCourses: Course[], newSlots: TimeSlotMapping) => {
    setCourses(newCourses);
    if (Object.keys(newSlots).length > 0) {
      setSlotTimings(newSlots);
    }
    setHasUploadedData(true);
    setViewState(ViewState.SELECTION);
    setSelectedCourses([]);
    setPreferences({});
    setLabPreferences({});
    // Auto-save will handle persisting to Firebase
  };

  const handleReset = () => {
    setSelectedCourses([]);
    setPreferences({});
    setLabPreferences({});
    setGeneratedTimetables([]);
    setConflictReport(null);
    setCurrentPage(1);
    setResultsAiAnalysis('');
    setFavoritesAiAnalysis('');
    setResultsChatHistory([]);
    setFavoritesChatHistory([]);
  };

  const executeGeneration = (
    currentSelected: Course[],
    currentPrefs: { [key: string]: string[] },
    currentLabPrefs: { [key: string]: string[] }
  ) => {
    try {
      // Auto-rehydrate selected courses from the latest catalog to ensure fresh sections and options
      const hydratedSelectedCourses = currentSelected.map(sc => {
        const fresh = courses.find(c => c.code === sc.code);
        return fresh ? {
          ...fresh,
          ...sc,
          sections: fresh.sections || sc.sections,
          theoryOptions: fresh.theoryOptions || sc.theoryOptions,
          labOptions: fresh.labOptions || sc.labOptions,
          linkedSections: fresh.linkedSections || sc.linkedSections,
          hasLab: fresh.hasLab !== undefined ? fresh.hasLab : sc.hasLab,
          hasLinkedLab: fresh.hasLinkedLab !== undefined ? fresh.hasLinkedLab : sc.hasLinkedLab
        } : sc;
      });

      const effectiveSlots = { ...SLOT_TIMINGS, ...(slotTimings || {}) };
      const results = generateTimetables(hydratedSelectedCourses, currentPrefs || {}, effectiveSlots, currentLabPrefs || {});
      console.log(`[AutoScheduler] Generated ${results.length} timetables.`);
      setGeneratedTimetables(results);
      setCurrentPage(1);

      if (results.length === 0) {
        const report = analyzeSchedulingConflicts(hydratedSelectedCourses, currentPrefs || {}, effectiveSlots, currentLabPrefs || {});
        setConflictReport(report);
      } else {
        setConflictReport(null);
      }

      setViewState(ViewState.RESULTS);
      setResultsAiAnalysis('');
      setResultsChatHistory([]);
    } catch (err) {
      console.error("[AutoScheduler] Error generating timetables:", err);
      setGeneratedTimetables([]);
      setCurrentPage(1);
      setViewState(ViewState.RESULTS);
    }
  };

  const handleGenerate = () => {
    setViewState(ViewState.GENERATING);
    setTimeout(() => {
      executeGeneration(selectedCourses, preferences, labPreferences);
    }, 50);
  };

  const handleClearFacultyFilters = () => {
    setPreferences({});
    setLabPreferences({});
    setViewState(ViewState.GENERATING);
    setTimeout(() => {
      executeGeneration(selectedCourses, {}, {});
    }, 50);
  };

  const handleSaveTimetable = (timetable: Timetable) => {
    const totalCredits = selectedCourses.reduce((sum, c) => sum + (c.credits || 3), 0);
    const saved: SavedTimetable = {
      ...timetable,
      savedAt: new Date().toISOString(),
      name: `Schedule ${savedTimetables.length + 1}`,
      totalCredits,
      courseCount: timetable.sections.length
    };
    const newSaved = [...savedTimetables, saved];
    setSavedTimetables(newSaved);
    saveFavoriteTimetables(newSaved);
  };

  const handleRemoveSaved = (id: number) => {
    const newSaved = savedTimetables.filter(t => t.id !== id);
    setSavedTimetables(newSaved);
    saveFavoriteTimetables(newSaved);
    if (selectedSavedTimetable?.id === id) {
      setSelectedSavedTimetable(null);
    }
  };

  const isTimetableSaved = (id: number) => savedTimetables.some(t => t.id === id);

  // Build a readable timing string for a slot
  const getSlotTimingDescription = (slotCode: string): string => {
    const timings = slotTimings[slotCode];
    if (!timings || timings.length === 0) return slotCode;
    
    const dayTimes = timings.map(t => `${t.day} ${t.start}-${t.end}`).join(', ');
    return `${slotCode} (${dayTimes})`;
  };

  // Build schedule description for AI
  const buildScheduleDescription = (t: Timetable, index?: number) => {
    const prefix = index !== undefined ? `Timetable ${index + 1}:\n` : '';
    const courses = t.sections.map(s => {
      const theoryTiming = getSlotTimingDescription(s.theorySlot);
      const labTiming = s.labSlot ? getSlotTimingDescription(s.labSlot) : 'No Lab';
      return `- ${s.courseCode}: Theory with ${s.faculty} at ${theoryTiming}${s.labSlot ? `, Lab with ${s.labFaculty || s.faculty} at ${labTiming}` : ''}`;
    }).join('\n');
    return prefix + courses;
  };

  const handleAnalyzeWithGemini = async (timetablesToAnalyze: Timetable[], isForFavorites: boolean = false) => {
    if (!process.env.API_KEY) {
      alert("Please configure the API_KEY in the environment.");
      return;
    }

    if (timetablesToAnalyze.length === 0) return;

    setIsAnalyzing(true);
    
    // Reset chat history when starting new analysis
    if (isForFavorites) {
      setFavoritesChatHistory([]);
    } else {
      setResultsChatHistory([]);
    }
    
    try {
      const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });

      let prompt = '';
      if (timetablesToAnalyze.length === 1) {
        const schedule = buildScheduleDescription(timetablesToAnalyze[0]);
        prompt = `You are AutoScheduler AI, a friendly college schedule advisor. Analyze this timetable quickly.

Schedule:
${schedule}

Give a BRIEF structured response in this exact format (use these emoji labels):

📊 Balance: [One short sentence about workload distribution]
⏰ Gaps: [One short sentence about gaps or back-to-back classes]  
✅ Verdict: [One short sentence - Good/Okay/Needs work and why]

Keep each point to ONE short sentence only. Be direct and helpful.`;
      } else {
        const allSchedules = timetablesToAnalyze.map((t, i) => buildScheduleDescription(t, i)).join('\n\n');
        prompt = `You are AutoScheduler AI, a friendly college schedule advisor. Compare these ${timetablesToAnalyze.length} timetables quickly.

${allSchedules}

Give a BRIEF structured response in this exact format (use these emoji labels):

${timetablesToAnalyze.map((_, i) => `📋 Option ${i + 1}: [One sentence summary]`).join('\n')}

🏆 Best Pick: [Which option and why in one sentence]

Keep each point to ONE short sentence only. Be direct and helpful.`;
      }

      const response = await ai.models.generateContent({
        model: 'gemini-2.5-flash',
        contents: prompt,
      });

      // Clean up any markdown that might slip through
      let analysis = response.text || "Could not analyze schedule.";
      analysis = analysis.replace(/\*\*/g, '').replace(/\*/g, '').replace(/#{1,6}\s/g, '').replace(/`/g, '');
      
      // Store in appropriate state and initialize chat history
      if (isForFavorites) {
        setFavoritesAiAnalysis(analysis);
        setFavoritesChatHistory([{ role: 'assistant', content: analysis }]);
      } else {
        setResultsAiAnalysis(analysis);
        setResultsChatHistory([{ role: 'assistant', content: analysis }]);
      }
    } catch (error) {
      console.error(error);
      const errorMsg = "Error connecting to AI Assistant.";
      if (isForFavorites) {
        setFavoritesAiAnalysis(errorMsg);
      } else {
        setResultsAiAnalysis(errorMsg);
      }
    } finally {
      setIsAnalyzing(false);
    }
  };

  const handleChatSubmit = async (isForFavorites: boolean = false) => {
    if (!chatInput.trim() || !process.env.API_KEY) return;
    
    const userMessage = chatInput.trim();
    setChatInput('');
    setIsAnalyzing(true);
    
    const currentHistory = isForFavorites ? favoritesChatHistory : resultsChatHistory;
    const setCurrentHistory = isForFavorites ? setFavoritesChatHistory : setResultsChatHistory;
    
    // Add user message to history
    const newHistory: {role: 'user' | 'assistant'; content: string}[] = [...currentHistory, { role: 'user', content: userMessage }];
    setCurrentHistory(newHistory);
    
    try {
      const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
      
      // Build conversation for AI
      const conversationPrompt = newHistory.map(msg => {
        if (msg.role === 'user') return `Student: ${msg.content}`;
        return `Advisor: ${msg.content}`;
      }).join('\n\n') + '\n\nAdvisor:';
      
      const response = await ai.models.generateContent({
        model: 'gemini-2.5-flash',
        contents: conversationPrompt + '\n\nRespond in plain conversational text (no markdown, asterisks, or bullet points). Be concise and helpful.',
      });
      
      let reply = response.text || "I couldn't process that. Please try again.";
      reply = reply.replace(/\*\*/g, '').replace(/\*/g, '').replace(/#{1,6}\s/g, '').replace(/`/g, '');
      
      setCurrentHistory([...newHistory, { role: 'assistant', content: reply }]);
    } catch (error) {
      console.error(error);
    } finally {
      setIsAnalyzing(false);
    }
  };

  // Auto-scroll chat to bottom when new messages arrive
  useEffect(() => {
    if (resultsChatRef.current) {
      resultsChatRef.current.scrollTop = resultsChatRef.current.scrollHeight;
    }
  }, [resultsChatHistory]);

  useEffect(() => {
    if (favoritesChatRef.current) {
      favoritesChatRef.current.scrollTop = favoritesChatRef.current.scrollHeight;
    }
  }, [favoritesChatHistory]);

  // Download timetable as HTML matching VIT design
  const handleDownloadTimetable = (timetable: SavedTimetable) => {
    const days = ['MON', 'TUE', 'WED', 'THU', 'FRI'];
    const theoryTimes = [
      { label: '9:00 - 9:50', start: '09:00' },
      { label: '9:55 - 10:45', start: '09:55' },
      { label: '10:50 - 11:40', start: '10:50' },
      { label: '11:45 - 12:35', start: '11:45' },
      { label: '1:15 - 2:05', start: '13:15' },
      { label: '2:10 - 3:00', start: '14:10' },
      { label: '3:05 - 3:55', start: '15:05' },
      { label: '4:00 - 4:50', start: '16:00' },
    ];
    const labTimes = [
      { start: '09:00', colSpan: 2 },
      { start: '10:50', colSpan: 2 },
      { start: '13:15', colSpan: 2 },
      { start: '15:05', colSpan: 2 },
    ];

    // Helper to get cell data
    const getCellData = (day: string, startTime: string, type: 'theory' | 'lab') => {
      const section = timetable.sections.find(sec => {
        const slotCode = type === 'theory' ? sec.theorySlot : sec.labSlot;
        if (!slotCode) return false;
        const timings = slotTimings[slotCode];
        return timings?.some((t: {day: string; start: string}) => t.day === day && t.start === startTime);
      });
      if (!section) return null;
      return {
        slotName: type === 'theory' ? section.theorySlot : section.labSlot,
        courseCode: section.courseCode,
        faculty: type === 'theory' ? section.faculty : (section.labFaculty || section.faculty)
      };
    };

    // Helper to get course title
    const getCourseName = (courseCode: string) => {
      const course = courses.find(c => c.code === courseCode);
      return course?.title || '';
    };

    // Color generator
    const getColor = (courseCode: string) => {
      const colors = ['#c7e9f1', '#d4edda', '#e2d9f3', '#fce8d0', '#f8d7da', '#d1ecf1', '#fff3cd'];
      const index = courseCode.charCodeAt(courseCode.length - 1) % colors.length;
      return colors[index];
    };

    // Generate HTML
    const html = `<!DOCTYPE html>
<html>
<head>
  <title>${timetable.name}</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body { font-family: Arial, sans-serif; padding: 20px; background: white; }
    .header { background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 20px; border-radius: 12px 12px 0 0; margin-bottom: 0; }
    .header h1 { font-size: 24px; margin-bottom: 8px; }
    .header .credits { font-size: 16px; opacity: 0.9; }
    .container { background: white; border-radius: 0 0 12px 12px; box-shadow: 0 4px 20px rgba(0,0,0,0.1); overflow: hidden; border: 1px solid #e2e8f0; }
    table { width: 100%; border-collapse: collapse; }
    th, td { border: 1px solid #cbd5e1; padding: 8px; text-align: center; font-size: 11px; }
    .main-header { background: #0a3d7a; color: white; }
    .time-header { background: #0a3d7a; color: white; font-weight: normal; font-size: 10px; }
    .lunch-header { background: #9ca3af; color: #333; font-weight: bold; writing-mode: vertical-rl; transform: rotate(180deg); }
    .day-cell { background: #e5e7eb; font-weight: bold; }
    .lab-label { background: #e5e7eb; font-weight: bold; font-size: 10px; }
    .lunch-cell { background: #9ca3af; color: #333; font-weight: bold; }
    .lab-row { background: #fef9c3; }
    .lab-cell { background: #fef3c7; }
    .empty { background: #fdfdfd; }
    .course-cell { vertical-align: middle; height: 60px; }
    .slot-name { font-weight: bold; color: #1e40af; font-size: 12px; }
    .course-code { font-weight: bold; color: #1e293b; }
    .faculty { font-size: 9px; color: #64748b; margin-top: 2px; }
    .summary { margin-top: 24px; }
    .summary h3 { font-size: 16px; color: #1e293b; margin-bottom: 12px; padding-left: 4px; }
    .summary table { width: 100%; }
    .summary th { background: #0a3d7a; color: white; text-align: left; padding: 10px; }
    .summary td { text-align: left; padding: 10px; border-bottom: 1px solid #e2e8f0; }
    .summary tr:nth-child(even) { background: #f8fafc; }
    .type-badge { display: inline-block; padding: 2px 8px; border-radius: 4px; font-size: 10px; font-weight: bold; }
    .type-t { background: #dbeafe; color: #1e40af; }
    .type-l { background: #fef3c7; color: #92400e; }
    .footer { margin-top: 20px; text-align: center; color: #94a3b8; font-size: 11px; }
    @media print { body { padding: 0; } .container { box-shadow: none; } }
  </style>
</head>
<body>
  <div class="header">
    <h1>📅 ${timetable.name}</h1>
    <div class="credits">${timetable.totalCredits} Credits • ${timetable.courseCount} Courses</div>
  </div>
  
  <div class="container">
    <table>
      <thead>
        <tr class="main-header">
          <th rowspan="2" style="width: 50px;">Day</th>
          <th colspan="4">Morning</th>
          <th rowspan="2" class="lunch-header" style="width: 40px;">Lunch</th>
          <th colspan="4">Afternoon</th>
        </tr>
        <tr class="time-header">
          ${theoryTimes.slice(0, 4).map(t => `<th>${t.label}</th>`).join('')}
          ${theoryTimes.slice(4).map(t => `<th>${t.label}</th>`).join('')}
        </tr>
      </thead>
      <tbody>
        ${days.map(day => {
          // Theory row
          let theoryRow = `<tr>
            <td class="day-cell">${day}</td>`;
          
          theoryTimes.slice(0, 4).forEach(time => {
            const data = getCellData(day, time.start, 'theory');
            if (data) {
              theoryRow += `<td class="course-cell" style="background: ${getColor(data.courseCode)}">
                <div class="slot-name">${data.slotName}</div>
                <div class="course-code">${data.courseCode}</div>
                <div class="faculty">${data.faculty}</div>
              </td>`;
            } else {
              theoryRow += `<td class="empty"></td>`;
            }
          });
          
          theoryRow += `<td rowspan="2" class="lunch-cell">LUNCH</td>`;
          
          theoryTimes.slice(4).forEach(time => {
            const data = getCellData(day, time.start, 'theory');
            if (data) {
              theoryRow += `<td class="course-cell" style="background: ${getColor(data.courseCode)}">
                <div class="slot-name">${data.slotName}</div>
                <div class="course-code">${data.courseCode}</div>
                <div class="faculty">${data.faculty}</div>
              </td>`;
            } else {
              theoryRow += `<td class="empty"></td>`;
            }
          });
          theoryRow += `</tr>`;

          // Lab row
          let labRow = `<tr class="lab-row">
            <td class="lab-label">Lab</td>`;
          
          labTimes.slice(0, 2).forEach(time => {
            const data = getCellData(day, time.start, 'lab');
            if (data) {
              labRow += `<td colspan="2" class="lab-cell course-cell">
                <div class="slot-name">${data.slotName}</div>
                <div class="course-code">${data.courseCode}</div>
                <div class="faculty">${data.faculty}</div>
              </td>`;
            } else {
              labRow += `<td colspan="2" class="lab-row"></td>`;
            }
          });
          
          labTimes.slice(2).forEach(time => {
            const data = getCellData(day, time.start, 'lab');
            if (data) {
              labRow += `<td colspan="2" class="lab-cell course-cell">
                <div class="slot-name">${data.slotName}</div>
                <div class="course-code">${data.courseCode}</div>
                <div class="faculty">${data.faculty}</div>
              </td>`;
            } else {
              labRow += `<td colspan="2" class="lab-row"></td>`;
            }
          });
          labRow += `</tr>`;

          return theoryRow + labRow;
        }).join('')}
      </tbody>
    </table>
  </div>

  <div class="summary">
    <h3>📚 Course Registration Summary</h3>
    <table>
      <thead>
        <tr>
          <th style="width: 50px;">S.No</th>
          <th>Course Code</th>
          <th>Course Title</th>
          <th style="width: 60px;">Type</th>
          <th>Slot</th>
          <th>Faculty</th>
        </tr>
      </thead>
      <tbody>
        ${timetable.sections.map((section, idx) => {
          const courseName = getCourseName(section.courseCode);
          let rows = `<tr>
            <td>${idx + 1}</td>
            <td><strong>${section.courseCode}</strong></td>
            <td>${courseName}</td>
            <td><span class="type-badge type-t">Theory</span></td>
            <td>${section.theorySlot}</td>
            <td>${section.faculty}</td>
          </tr>`;
          if (section.labSlot) {
            rows += `<tr>
              <td></td>
              <td><strong>${section.courseCode}</strong></td>
              <td>${courseName}</td>
              <td><span class="type-badge type-l">Lab</span></td>
              <td>${section.labSlot}</td>
              <td>${section.labFaculty || section.faculty}</td>
            </tr>`;
          }
          return rows;
        }).join('')}
      </tbody>
    </table>
  </div>

  <div class="footer">
    <p>Total Credits: <strong>${timetable.totalCredits}</strong> | Generated by AutoScheduler</p>
  </div>
</body>
</html>`;

    const blob = new Blob([html], { type: 'text/html' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${timetable.name.replace(/\s+/g, '_')}_Timetable.html`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  if (!currentUser) {
    return <AuthPage />;
  }

  if (isLoadingData) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50">
        <div className="w-16 h-16 border-4 border-indigo-200 border-t-indigo-600 rounded-full animate-spin"></div>
      </div>
    );
  }

  const totalCredits = selectedCourses.reduce((sum, c) => sum + (c.credits || 3), 0);

  return (
    <div className="min-h-screen flex flex-col bg-slate-50">
      {/* Header */}
      <header className="bg-white border-b border-slate-200 sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
          <div className="flex items-center gap-2 cursor-pointer" onClick={() => setViewState(ViewState.LANDING)}>
            <div className="w-8 h-8 bg-indigo-600 rounded-lg flex items-center justify-center text-white">
              <Calendar className="w-5 h-5" />
            </div>
            <h1 className="text-xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-indigo-600 to-purple-600">
              AutoScheduler
            </h1>
          </div>
          <div className="flex items-center gap-3">
            {hasUploadedData && viewState !== ViewState.SELECTION && viewState !== ViewState.LANDING && (
              <button onClick={() => setViewState(ViewState.SELECTION)} className="text-sm font-medium text-slate-500 hover:text-indigo-600 flex items-center gap-1">
                <Home className="w-4 h-4" /> Home
              </button>
            )}
            <button
              onClick={() => { setSelectedSavedTimetable(null); setViewState(ViewState.FAVORITES); }}
              className={`text-sm font-medium flex items-center gap-1 px-3 py-1.5 rounded-lg transition-all ${viewState === ViewState.FAVORITES ? 'bg-pink-100 text-pink-600' : 'text-slate-500 hover:text-pink-600 hover:bg-pink-50'}`}
            >
              <Heart className="w-4 h-4" fill={viewState === ViewState.FAVORITES || savedTimetables.length > 0 ? "currentColor" : "none"} />
              Favorites
            </button>
            <div className="h-6 w-px bg-slate-200"></div>
            <span className="text-sm text-slate-600 hidden md:inline-block font-medium">
              {userName || currentUser.displayName || currentUser.email?.split('@')[0]}
            </span>
            <button onClick={() => logout()} className="text-sm font-medium text-slate-500 hover:text-red-600" title="Sign Out">
              <LogOut className="w-4 h-4" />
            </button>
          </div>
        </div>
      </header>

      {/* Floating Action Bar */}
      {(viewState === ViewState.SELECTION || viewState === ViewState.RESULTS || viewState === ViewState.FAVORITES) && (
        <div className="sticky top-16 z-40 bg-white/90 backdrop-blur-md border-b border-slate-200 shadow-sm">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-14 flex items-center justify-between">
            <button
              onClick={() => {
                if (viewState === ViewState.RESULTS) setViewState(ViewState.SELECTION);
                else if (viewState === ViewState.FAVORITES) {
                  if (selectedSavedTimetable) setSelectedSavedTimetable(null);
                  else if (generatedTimetables.length > 0) setViewState(ViewState.RESULTS);
                  else setViewState(ViewState.SELECTION);
                }
                else setViewState(ViewState.LANDING);
              }}
              className="text-sm font-medium text-slate-600 hover:text-indigo-600 flex items-center gap-1.5 px-3 py-1.5 rounded-lg hover:bg-indigo-50 transition-all"
            >
              <ArrowLeft className="w-4 h-4" /> Go Back
            </button>

            <div className="flex items-center gap-3">
              {viewState === ViewState.SELECTION && (
                <button onClick={() => setViewState(ViewState.UPLOAD)} className="text-sm font-medium text-slate-500 hover:text-indigo-600 flex items-center gap-1.5 px-3 py-1.5 rounded-lg hover:bg-indigo-50 transition-all">
                  <Upload className="w-4 h-4" /> Upload New Data
                </button>
              )}

              {(viewState === ViewState.SELECTION || viewState === ViewState.RESULTS) && selectedCourses.length > 0 && (
                <div className="flex items-center gap-1.5 px-3 py-1.5 bg-gradient-to-r from-indigo-100 to-purple-100 rounded-full border border-indigo-200">
                  <GraduationCap className="w-4 h-4 text-indigo-600" />
                  <span className="text-sm font-bold text-indigo-700">{totalCredits} Credits</span>
                </div>
              )}

              {viewState === ViewState.SELECTION && selectedCourses.length > 0 && (
                <button onClick={handleReset} className="text-sm font-medium text-orange-600 hover:text-orange-700 flex items-center gap-1.5 px-3 py-1.5 rounded-lg hover:bg-orange-50 transition-all">
                  <RotateCcw className="w-4 h-4" /> Reset
                </button>
              )}

              {viewState === ViewState.RESULTS && generatedTimetables.length > 0 && (
                <button onClick={() => handleAnalyzeWithGemini(generatedTimetables, false)} disabled={isAnalyzing} className="text-sm font-medium text-purple-600 hover:text-purple-700 flex items-center gap-1.5 px-3 py-1.5 rounded-lg hover:bg-purple-50 transition-all disabled:opacity-50">
                  <Sparkles className="w-4 h-4" /> {isAnalyzing ? 'Analyzing...' : 'Ask AutoScheduler'}
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      <main className="flex-1 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 w-full">
        {/* Landing Page */}
        {viewState === ViewState.LANDING && (
          <div className="max-w-4xl mx-auto text-center py-16 animate-in fade-in zoom-in-95 duration-500">
            <div className="mb-8">
              <div className="w-20 h-20 bg-gradient-to-br from-indigo-600 to-purple-600 rounded-2xl flex items-center justify-center text-white mx-auto mb-6 shadow-xl">
                <Calendar className="w-10 h-10" />
              </div>
              <h1 className="text-4xl font-bold text-slate-900 mb-4">Welcome to AutoScheduler</h1>
              <p className="text-xl text-slate-600 max-w-2xl mx-auto">Generate conflict-free timetables automatically.</p>
            </div>

            <div className="bg-white rounded-2xl p-8 shadow-xl border border-slate-200 max-w-lg mx-auto">
              <h2 className="text-xl font-bold text-slate-800 mb-4">Get Started</h2>
              <p className="text-slate-600 mb-6">Upload your course catalog (JSON, PDF, or Excel) to begin.</p>
              <button onClick={() => setViewState(ViewState.UPLOAD)} className="w-full px-8 py-4 bg-gradient-to-r from-indigo-600 to-purple-600 text-white rounded-xl font-bold shadow-lg hover:shadow-xl transition-all flex items-center justify-center gap-2">
                <Upload className="w-5 h-5" /> Upload Course Data
              </button>

              {hasUploadedData && (
                <button onClick={() => setViewState(ViewState.SELECTION)} className="w-full mt-4 px-8 py-4 bg-slate-100 text-slate-700 rounded-xl font-bold hover:bg-slate-200 transition-all flex items-center justify-center gap-2">
                  <ChevronRight className="w-5 h-5" /> Continue ({courses.length} courses)
                </button>
              )}

              {savedTimetables.length > 0 && (
                <button onClick={() => setViewState(ViewState.FAVORITES)} className="w-full mt-4 px-8 py-4 bg-pink-50 text-pink-700 rounded-xl font-bold hover:bg-pink-100 transition-all flex items-center justify-center gap-2 border border-pink-200">
                  <Heart className="w-5 h-5" fill="currentColor" /> Saved Timetables ({savedTimetables.length})
                </button>
              )}
            </div>
          </div>
        )}

        {/* Upload Page */}
        {viewState === ViewState.UPLOAD && (
          <DataUpload onDataLoaded={handleDataLoaded} onGoBack={() => hasUploadedData ? setViewState(ViewState.SELECTION) : setViewState(ViewState.LANDING)} />
        )}

        {/* Selection Page */}
        {viewState === ViewState.SELECTION && (
          <div className="max-w-3xl mx-auto space-y-8 animate-in fade-in zoom-in-95 duration-500">
            <div className="bg-indigo-600 rounded-2xl p-6 text-white shadow-xl shadow-indigo-200">
              <h2 className="text-2xl font-bold mb-2">Build Your Perfect Semester</h2>
              <p className="text-indigo-100">Select courses and preferred professors below.</p>
            </div>

            {courses.length === 0 ? (
              <div className="bg-yellow-50 border border-yellow-200 rounded-xl p-6 text-center">
                <AlertCircle className="w-8 h-8 text-yellow-500 mx-auto mb-3" />
                <h3 className="font-bold text-yellow-800 mb-2">No Courses Available</h3>
                <p className="text-yellow-700 mb-4">Please upload your course data first.</p>
                <button onClick={() => setViewState(ViewState.UPLOAD)} className="px-6 py-2 bg-yellow-500 text-white rounded-lg font-medium hover:bg-yellow-600 transition-all">
                  Upload Data
                </button>
              </div>
            ) : (
              <>
                <CourseSelector courses={courses} selectedCourses={selectedCourses} onToggleCourse={toggleCourse} />
                <FacultyPreferences selectedCourses={selectedCourses} preferences={preferences} onUpdatePreference={updatePreference} />
                <LabSlotPreferences selectedCourses={selectedCourses} labPreferences={labPreferences} onUpdateLabPreference={updateLabPreference} />
                <div className="pt-6 border-t border-slate-200 flex justify-end">
                  <button disabled={selectedCourses.length === 0} onClick={handleGenerate} className={`px-8 py-3 rounded-full font-bold text-white shadow-lg flex items-center gap-2 transition-all ${selectedCourses.length > 0 ? 'bg-slate-900 hover:bg-slate-800 hover:scale-105' : 'bg-slate-300 cursor-not-allowed'}`}>
                    Generate Timetables <ChevronRight className="w-5 h-5" />
                  </button>
                </div>
              </>
            )}
          </div>
        )}

        {/* Generating Page */}
        {viewState === ViewState.GENERATING && (
          <div className="flex flex-col items-center justify-center py-20 animate-in fade-in duration-700">
            <div className="w-16 h-16 border-4 border-indigo-200 border-t-indigo-600 rounded-full animate-spin mb-6"></div>
            <h3 className="text-xl font-semibold text-slate-700">Generating timetables...</h3>
            <p className="text-slate-500 mt-2">{selectedCourses.length} courses ({totalCredits} credits)</p>
          </div>
        )}

        {/* Results Page */}
        {viewState === ViewState.RESULTS && (() => {
          const totalPages = Math.ceil(generatedTimetables.length / ITEMS_PER_PAGE) || 1;
          const paginatedTimetables = generatedTimetables.slice(
            (currentPage - 1) * ITEMS_PER_PAGE,
            currentPage * ITEMS_PER_PAGE
          );

          return (
            <div className="space-y-6 animate-in slide-in-from-bottom-8 duration-500">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div>
                  <h2 className="text-2xl font-bold text-slate-900">
                    {generatedTimetables.length > 0 ? `Found ${generatedTimetables.length} Valid Schedules` : "No Valid Schedules Found"}
                  </h2>
                  {generatedTimetables.length === 0 ? (
                    <div className="mt-4 space-y-4 max-w-4xl">
                      <div className="text-amber-900 bg-amber-50 border border-amber-200 rounded-xl p-4 text-sm space-y-2">
                        <p className="font-semibold flex items-center gap-2 text-base text-amber-800">
                          <AlertCircle className="w-5 h-5 text-amber-600" /> Mandatory Course Requirement
                        </p>
                        <p className="text-amber-800 leading-relaxed">
                          Every selected course ({selectedCourses.length} courses) must be present in every generated timetable. No clash-free schedule could be formed that fits all {selectedCourses.length} courses with your current settings.
                        </p>
                        {conflictReport?.hasActiveFacultyFilters && (
                          <div className="pt-2 flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-amber-100/60 p-3 rounded-lg border border-amber-200">
                            <div>
                              <p className="font-medium text-amber-900 text-xs">Faculty filters are currently active</p>
                              <p className="text-amber-700 text-xs">Some sections may be excluded because of your chosen professor preferences.</p>
                            </div>
                            <button
                              onClick={handleClearFacultyFilters}
                              className="px-3.5 py-1.5 bg-amber-600 hover:bg-amber-700 text-white rounded-lg text-xs font-semibold flex items-center gap-1.5 shadow-sm transition-all whitespace-nowrap"
                            >
                              <RefreshCw className="w-3.5 h-3.5" /> Clear Filters & Try Any Faculty
                            </button>
                          </div>
                        )}
                      </div>

                      {/* Conflict Breakdown */}
                      {conflictReport && (
                        <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-5 space-y-4">
                          <h3 className="text-base font-bold text-slate-800 flex items-center gap-2">
                            <XCircle className="w-5 h-5 text-red-500" /> Conflict Diagnostics
                          </h3>

                          {conflictReport.zeroOptionCourses.length > 0 && (
                            <div className="space-y-2">
                              <h4 className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Courses with 0 Available Options</h4>
                              <div className="divide-y divide-slate-100 border border-red-100 bg-red-50/50 rounded-lg p-3 space-y-2">
                                {conflictReport.zeroOptionCourses.map((c, idx) => (
                                  <div key={idx} className="text-xs text-red-800 flex items-start gap-2 pt-1 first:pt-0">
                                    <span className="font-bold">{c.code}:</span>
                                    <span>{c.reason}</span>
                                  </div>
                                ))}
                              </div>
                            </div>
                          )}

                          {conflictReport.pairwiseConflicts.length > 0 && (
                            <div className="space-y-2">
                              <h4 className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Direct Time Slot Clashes</h4>
                              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                                {conflictReport.pairwiseConflicts.map((c, idx) => (
                                  <div key={idx} className="p-3.5 rounded-lg border border-red-200 bg-red-50/40 text-xs space-y-2">
                                    <div className="flex items-center justify-between font-bold text-red-900 border-b border-red-200/60 pb-1.5">
                                      <span>{c.course1} vs {c.course2}</span>
                                      <span className="bg-red-200/80 text-red-800 px-2 py-0.5 rounded text-[10px]">{c.day} {c.timeRange}</span>
                                    </div>
                                    <div className="text-slate-600 space-y-1">
                                      <p>• <strong>{c.course1}</strong>: Slot <code>{c.course1Slot}</code> ({c.course1Faculty})</p>
                                      <p>• <strong>{c.course2}</strong>: Slot <code>{c.course2Slot}</code> ({c.course2Faculty})</p>
                                    </div>
                                    <p className="text-[11px] text-red-700 italic">These courses share the same slot or overlapping timing with no alternative clash-free section available.</p>
                                  </div>
                                ))}
                              </div>
                            </div>
                          )}

                          {conflictReport.zeroOptionCourses.length === 0 && conflictReport.pairwiseConflicts.length === 0 && (
                            <div className="text-xs text-slate-600 bg-slate-50 p-3 rounded-lg border border-slate-200">
                              <p className="font-medium text-slate-800 mb-1">Weekly Grid Saturation:</p>
                              <p>No single pair of courses directly clashes, but scheduling all {selectedCourses.length} courses simultaneously exceeds the available conflict-free slots across Monday–Friday.</p>
                            </div>
                          )}

                          <div className="pt-2 flex items-center gap-3">
                            <button
                              onClick={() => setViewState(ViewState.SELECTION)}
                              className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-xs font-semibold flex items-center gap-1.5 shadow-sm transition-all"
                            >
                              <ArrowLeft className="w-3.5 h-3.5" /> Adjust Selected Courses
                            </button>
                          </div>
                        </div>
                      )}
                    </div>
                  ) : (
                    <p className="text-sm text-slate-500 mt-1">
                      Every schedule strictly includes all {selectedCourses.length} selected courses with zero slot clashes.
                    </p>
                  )}
                </div>

                {generatedTimetables.length > 0 && (
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => handleAnalyzeWithGemini(paginatedTimetables.slice(0, 3))}
                      disabled={isAnalyzing}
                      className="px-4 py-2 bg-gradient-to-r from-purple-600 to-indigo-600 text-white text-sm font-medium rounded-xl hover:from-purple-700 hover:to-indigo-700 transition-all flex items-center gap-2 shadow-md disabled:opacity-50"
                    >
                      <Sparkles className="w-4 h-4" />
                      {isAnalyzing ? "Analyzing..." : "Analyze Options with AI"}
                    </button>
                  </div>
                )}
              </div>

              {resultsChatHistory.length > 0 && (
                <div className="bg-gradient-to-r from-purple-50 to-indigo-50 border border-purple-200 rounded-xl overflow-hidden">
                  <div className="p-3 border-b border-purple-200 bg-purple-100/50">
                    <div className="font-semibold flex items-center gap-2 text-purple-700"><Sparkles className="w-4 h-4" /> AI Analysis</div>
                  </div>
                  
                  {/* Chat Messages */}
                  <div ref={resultsChatRef} className="p-4 space-y-3 max-h-80 overflow-y-auto">
                    {resultsChatHistory.map((msg, idx) => (
                      <div key={idx} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                        <div className={`max-w-[80%] px-4 py-2 rounded-2xl text-sm ${
                          msg.role === 'user' 
                            ? 'bg-indigo-600 text-white rounded-br-md' 
                            : 'bg-white text-slate-700 border border-purple-200 rounded-bl-md shadow-sm'
                        }`}>
                          {msg.content}
                        </div>
                      </div>
                    ))}
                    {isAnalyzing && (
                      <div className="flex justify-start">
                        <div className="bg-white text-slate-500 border border-purple-200 rounded-2xl rounded-bl-md px-4 py-2 text-sm shadow-sm">
                          <div className="flex items-center gap-2">
                            <div className="w-2 h-2 bg-purple-400 rounded-full animate-bounce"></div>
                            <div className="w-2 h-2 bg-purple-400 rounded-full animate-bounce" style={{animationDelay: '0.1s'}}></div>
                            <div className="w-2 h-2 bg-purple-400 rounded-full animate-bounce" style={{animationDelay: '0.2s'}}></div>
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                  
                  {/* Chat Input */}
                  <div className="p-3 border-t border-purple-200 bg-white">
                    <div className="flex gap-2">
                      <input
                        type="text"
                        value={chatInput}
                        onChange={(e) => setChatInput(e.target.value)}
                        onKeyPress={(e) => e.key === 'Enter' && handleChatSubmit(false)}
                        placeholder="Ask a follow-up question..."
                        className="flex-1 px-3 py-2 text-sm border border-purple-200 rounded-full focus:outline-none focus:ring-2 focus:ring-purple-400"
                      />
                      <button
                        onClick={() => handleChatSubmit(false)}
                        disabled={isAnalyzing || !chatInput.trim()}
                        className="p-2 bg-indigo-600 text-white rounded-full hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                        <Send className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                </div>
              )}

              {/* Pagination Info Bar */}
              {generatedTimetables.length > 0 && (
                <div className="flex flex-col sm:flex-row items-center justify-between gap-3 py-3 px-4 bg-white rounded-xl border border-slate-200 shadow-sm">
                  <div className="text-sm text-slate-600">
                    Showing <span className="font-semibold text-slate-900">{(currentPage - 1) * ITEMS_PER_PAGE + 1}</span> - <span className="font-semibold text-slate-900">{Math.min(currentPage * ITEMS_PER_PAGE, generatedTimetables.length)}</span> of <span className="font-semibold text-indigo-600">{generatedTimetables.length}</span> schedules
                  </div>
                  {totalPages > 1 && (
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                        disabled={currentPage === 1}
                        className="px-3 py-1.5 text-xs font-medium rounded-lg border border-slate-200 bg-white text-slate-700 hover:bg-slate-50 disabled:opacity-40 disabled:cursor-not-allowed flex items-center gap-1 shadow-sm transition-all"
                      >
                        <ChevronLeft className="w-3.5 h-3.5" /> Prev
                      </button>
                      <span className="text-xs font-semibold text-slate-700 px-2 py-1 bg-slate-100 rounded-md">
                        {currentPage} / {totalPages}
                      </span>
                      <button
                        onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                        disabled={currentPage >= totalPages}
                        className="px-3 py-1.5 text-xs font-medium rounded-lg border border-slate-200 bg-white text-slate-700 hover:bg-slate-50 disabled:opacity-40 disabled:cursor-not-allowed flex items-center gap-1 shadow-sm transition-all"
                      >
                        Next <ChevronRight className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  )}
                </div>
              )}

              {/* Grid of Timetables (Paginated 10 per page) */}
              <div className="grid grid-cols-1 gap-8">
                {paginatedTimetables.map((timetable) => (
                  <div key={timetable.id} className="relative">
                    <div className="absolute top-4 right-4 z-10 flex items-center gap-2">
                      <button
                        onClick={() => {
                          const totalCredits = selectedCourses.reduce((sum, c) => sum + (c.credits || 3), 0);
                          handleDownloadTimetable({ ...timetable, savedAt: new Date().toISOString(), totalCredits, courseCount: timetable.sections.length, name: `Timetable ${timetable.id}` });
                        }}
                        className="p-2 rounded-full shadow-md transition-all bg-white text-slate-400 hover:text-emerald-500 hover:bg-emerald-50 border border-slate-200"
                        title="Download timetable"
                      >
                        <Download className="w-5 h-5" />
                      </button>
                      <button
                        onClick={() => isTimetableSaved(timetable.id) ? handleRemoveSaved(timetable.id) : handleSaveTimetable(timetable)}
                        className={`p-2 rounded-full shadow-md transition-all ${isTimetableSaved(timetable.id) ? 'bg-pink-500 text-white hover:bg-pink-600' : 'bg-white text-slate-400 hover:text-pink-500 hover:bg-pink-50 border border-slate-200'}`}
                        title={isTimetableSaved(timetable.id) ? 'Remove from saved' : 'Save timetable'}
                      >
                        <Heart className="w-5 h-5" fill={isTimetableSaved(timetable.id) ? "currentColor" : "none"} />
                      </button>
                    </div>
                    <TimetableGrid timetable={timetable} slotTimings={slotTimings} />
                  </div>
                ))}
              </div>

              {/* Bottom Pagination Controls */}
              {totalPages > 1 && (
                <div className="flex items-center justify-center gap-3 pt-4 pb-6">
                  <button
                    onClick={() => {
                      setCurrentPage(p => Math.max(1, p - 1));
                      window.scrollTo({ top: 0, behavior: 'smooth' });
                    }}
                    disabled={currentPage === 1}
                    className="px-4 py-2 text-sm font-medium rounded-xl border border-slate-200 bg-white text-slate-700 hover:bg-slate-50 disabled:opacity-40 disabled:cursor-not-allowed flex items-center gap-1 shadow-sm transition-all"
                  >
                    <ChevronLeft className="w-4 h-4" /> Previous 10
                  </button>
                  <span className="text-sm font-semibold text-slate-700 px-4 py-2 bg-slate-100 rounded-xl">
                    Page {currentPage} of {totalPages}
                  </span>
                  <button
                    onClick={() => {
                      setCurrentPage(p => Math.min(totalPages, p + 1));
                      window.scrollTo({ top: 0, behavior: 'smooth' });
                    }}
                    disabled={currentPage >= totalPages}
                    className="px-4 py-2 text-sm font-medium rounded-xl border border-slate-200 bg-white text-slate-700 hover:bg-slate-50 disabled:opacity-40 disabled:cursor-not-allowed flex items-center gap-1 shadow-sm transition-all"
                  >
                    Next 10 <ChevronRight className="w-4 h-4" />
                  </button>
                </div>
              )}
            </div>
          );
        })()}

        {/* Favorites Page */}
        {viewState === ViewState.FAVORITES && (
          <div className="space-y-6 animate-in fade-in zoom-in-95 duration-500">
            {selectedSavedTimetable ? (
              <div className="space-y-6">
                <div className="bg-gradient-to-r from-pink-500 to-purple-600 rounded-2xl p-6 text-white shadow-xl">
                  <h2 className="text-2xl font-bold mb-2">{selectedSavedTimetable.name}</h2>
                  <div className="flex items-center gap-4 text-pink-100">
                    <span className="flex items-center gap-1"><GraduationCap className="w-4 h-4" /> {selectedSavedTimetable.totalCredits} Credits</span>
                    <span className="flex items-center gap-1"><Calendar className="w-4 h-4" /> {selectedSavedTimetable.courseCount} Courses</span>
                    <span className="text-sm">Saved {new Date(selectedSavedTimetable.savedAt).toLocaleDateString()}</span>
                  </div>
                </div>

                <div className="bg-white rounded-xl p-6 shadow-md border border-slate-200">
                  <h3 className="font-bold text-slate-800 mb-4">Course Details</h3>
                  <div className="space-y-3">
                    {selectedSavedTimetable.sections.map((section, idx) => (
                      <div key={idx} className="flex flex-col sm:flex-row sm:items-center justify-between p-3 bg-slate-50 rounded-lg gap-2">
                        <div>
                          <span className="font-medium text-slate-800">{section.courseCode}</span>
                        </div>
                        <div className="text-sm flex flex-wrap gap-2">
                          <span className="bg-indigo-100 text-indigo-700 px-2 py-1 rounded">
                            Theory: {section.theorySlot} <span className="text-indigo-500">({section.faculty})</span>
                          </span>
                          {section.labSlot && (
                            <span className="bg-amber-100 text-amber-700 px-2 py-1 rounded">
                              Lab: {section.labSlot} <span className="text-amber-500">({section.labFaculty || section.faculty})</span>
                            </span>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="flex gap-3">
                  <button onClick={() => handleAnalyzeWithGemini([selectedSavedTimetable], true)} disabled={isAnalyzing} className="flex-1 px-6 py-3 bg-gradient-to-r from-purple-600 to-indigo-600 text-white rounded-xl font-medium shadow-md hover:shadow-lg transition-all flex items-center justify-center gap-2 disabled:opacity-70">
                    {isAnalyzing ? <><div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin"></div> Analyzing...</> : <><Sparkles className="w-5 h-5" /> Ask AutoScheduler</>}
                  </button>
                  <button onClick={() => handleDownloadTimetable(selectedSavedTimetable)} className="px-6 py-3 bg-gradient-to-r from-emerald-500 to-teal-600 text-white rounded-xl font-medium shadow-md hover:shadow-lg transition-all flex items-center justify-center gap-2">
                    <Download className="w-5 h-5" /> Download
                  </button>
                </div>

                {favoritesChatHistory.length > 0 && (
                  <div className="bg-gradient-to-r from-purple-50 to-indigo-50 border border-purple-200 rounded-xl overflow-hidden">
                    <div className="p-3 border-b border-purple-200 bg-purple-100/50">
                      <div className="font-semibold flex items-center gap-2 text-purple-700"><Sparkles className="w-4 h-4" /> AutoScheduler AI</div>
                    </div>
                    
                    {/* Chat Messages */}
                    <div ref={favoritesChatRef} className="p-4 space-y-3 max-h-80 overflow-y-auto">
                      {favoritesChatHistory.map((msg, idx) => (
                        <div key={idx} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                          <div className={`max-w-[80%] px-4 py-2 rounded-2xl text-sm ${
                            msg.role === 'user' 
                              ? 'bg-indigo-600 text-white rounded-br-md' 
                              : 'bg-white text-slate-700 border border-purple-200 rounded-bl-md shadow-sm'
                          }`}>
                            {msg.content}
                          </div>
                        </div>
                      ))}
                      {isAnalyzing && (
                        <div className="flex justify-start">
                          <div className="bg-white text-slate-500 border border-purple-200 rounded-2xl rounded-bl-md px-4 py-2 text-sm shadow-sm">
                            <div className="flex items-center gap-2">
                              <div className="w-2 h-2 bg-purple-400 rounded-full animate-bounce"></div>
                              <div className="w-2 h-2 bg-purple-400 rounded-full animate-bounce" style={{animationDelay: '0.1s'}}></div>
                              <div className="w-2 h-2 bg-purple-400 rounded-full animate-bounce" style={{animationDelay: '0.2s'}}></div>
                            </div>
                          </div>
                        </div>
                      )}
                    </div>
                    
                    {/* Chat Input */}
                    <div className="p-3 border-t border-purple-200 bg-white">
                      <div className="flex gap-2">
                        <input
                          type="text"
                          value={chatInput}
                          onChange={(e) => setChatInput(e.target.value)}
                          onKeyPress={(e) => e.key === 'Enter' && handleChatSubmit(true)}
                          placeholder="Ask a follow-up question..."
                          className="flex-1 px-3 py-2 text-sm border border-purple-200 rounded-full focus:outline-none focus:ring-2 focus:ring-purple-400"
                        />
                        <button
                          onClick={() => handleChatSubmit(true)}
                          disabled={isAnalyzing || !chatInput.trim()}
                          className="p-2 bg-indigo-600 text-white rounded-full hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                          <Send className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                  </div>
                )}

                <TimetableGrid timetable={selectedSavedTimetable} slotTimings={slotTimings} />

                <button onClick={() => handleRemoveSaved(selectedSavedTimetable.id)} className="w-full px-6 py-3 bg-red-50 text-red-600 rounded-xl font-medium hover:bg-red-100 transition-all flex items-center justify-center gap-2 border border-red-200">
                  <Trash2 className="w-5 h-5" /> Remove from Saved
                </button>
              </div>
            ) : (
              <>
                <div className="bg-gradient-to-r from-pink-500 to-purple-600 rounded-2xl p-6 text-white shadow-xl">
                  <h2 className="text-2xl font-bold mb-2 flex items-center gap-2"><Heart className="w-6 h-6" fill="currentColor" /> Saved Timetables</h2>
                  <p className="text-pink-100">
                    {savedTimetables.length === 0 
                      ? "Save timetables from the results page to compare them here."
                      : "Click to view details, or select multiple to ask AutoScheduler."}
                  </p>
                </div>

                {/* Compare Selected Button */}
                {selectedForComparison.length >= 2 && (
                  <div className="bg-white rounded-xl p-4 shadow-md border border-purple-200 flex items-center justify-between">
                    <span className="text-slate-700 font-medium">{selectedForComparison.length} timetables selected for comparison</span>
                    <div className="flex gap-2">
                      <button 
                        onClick={() => setSelectedForComparison([])} 
                        className="px-4 py-2 text-slate-600 hover:bg-slate-100 rounded-lg transition-all"
                      >
                        Clear
                      </button>
                      <button 
                        onClick={() => {
                          const toCompare = savedTimetables.filter(t => selectedForComparison.includes(t.id));
                          handleAnalyzeWithGemini(toCompare, true);
                        }} 
                        disabled={isAnalyzing}
                        className="px-4 py-2 bg-gradient-to-r from-purple-600 to-indigo-600 text-white rounded-lg font-medium hover:shadow-lg transition-all flex items-center gap-2 disabled:opacity-70"
                      >
                        <Sparkles className="w-4 h-4" /> {isAnalyzing ? 'Analyzing...' : 'Ask AutoScheduler'}
                      </button>
                    </div>
                  </div>
                )}

                {favoritesAiAnalysis && favoritesChatHistory.length === 0 && (
                  <div className="bg-gradient-to-r from-purple-50 to-indigo-50 border border-purple-200 rounded-xl p-4 text-slate-700">
                    <div className="font-semibold mb-2 flex items-center gap-2 text-purple-700"><Sparkles className="w-4 h-4" /> AutoScheduler AI</div>
                    <p className="text-sm leading-relaxed whitespace-pre-wrap">{favoritesAiAnalysis}</p>
                  </div>
                )}

                {favoritesChatHistory.length > 0 && !selectedSavedTimetable && (
                  <div className="bg-gradient-to-r from-purple-50 to-indigo-50 border border-purple-200 rounded-xl overflow-hidden">
                    <div className="p-3 border-b border-purple-200 bg-purple-100/50">
                      <div className="font-semibold flex items-center gap-2 text-purple-700"><Sparkles className="w-4 h-4" /> AutoScheduler AI</div>
                    </div>
                    
                    {/* Chat Messages */}
                    <div ref={favoritesChatRef} className="p-4 space-y-3 max-h-80 overflow-y-auto">
                      {favoritesChatHistory.map((msg, idx) => (
                        <div key={idx} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                          <div className={`max-w-[80%] px-4 py-2 rounded-2xl text-sm ${
                            msg.role === 'user' 
                              ? 'bg-indigo-600 text-white rounded-br-md' 
                              : 'bg-white text-slate-700 border border-purple-200 rounded-bl-md shadow-sm'
                          }`}>
                            {msg.content}
                          </div>
                        </div>
                      ))}
                      {isAnalyzing && (
                        <div className="flex justify-start">
                          <div className="bg-white text-slate-500 border border-purple-200 rounded-2xl rounded-bl-md px-4 py-2 text-sm shadow-sm">
                            <div className="flex items-center gap-2">
                              <div className="w-2 h-2 bg-purple-400 rounded-full animate-bounce"></div>
                              <div className="w-2 h-2 bg-purple-400 rounded-full animate-bounce" style={{animationDelay: '0.1s'}}></div>
                              <div className="w-2 h-2 bg-purple-400 rounded-full animate-bounce" style={{animationDelay: '0.2s'}}></div>
                            </div>
                          </div>
                        </div>
                      )}
                    </div>
                    
                    {/* Chat Input */}
                    <div className="p-3 border-t border-purple-200 bg-white">
                      <div className="flex gap-2">
                        <input
                          type="text"
                          value={chatInput}
                          onChange={(e) => setChatInput(e.target.value)}
                          onKeyPress={(e) => e.key === 'Enter' && handleChatSubmit(true)}
                          placeholder="Ask a follow-up question..."
                          className="flex-1 px-3 py-2 text-sm border border-purple-200 rounded-full focus:outline-none focus:ring-2 focus:ring-purple-400"
                        />
                        <button
                          onClick={() => handleChatSubmit(true)}
                          disabled={isAnalyzing || !chatInput.trim()}
                          className="p-2 bg-indigo-600 text-white rounded-full hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                          <Send className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                  </div>
                )}

                {savedTimetables.length === 0 ? (
                  <div className="bg-slate-50 border border-slate-200 rounded-xl p-8 text-center">
                    <Heart className="w-12 h-12 text-slate-300 mx-auto mb-4" />
                    <h3 className="font-bold text-slate-600 mb-2">No Saved Timetables Yet</h3>
                    <p className="text-slate-500 mb-4">Generate timetables and click the heart icon to save them here.</p>
                    <button onClick={() => setViewState(ViewState.SELECTION)} className="px-6 py-2 bg-indigo-600 text-white rounded-lg font-medium hover:bg-indigo-700 transition-all">
                      Generate Timetables
                    </button>
                  </div>
                ) : (
                  <>
                    {savedTimetables.length >= 2 && (
                      <p className="text-sm text-slate-500">Tip: Check the boxes to select multiple timetables to compare, or click a card to view details</p>
                    )}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      {savedTimetables.map((timetable) => (
                        <div 
                          key={timetable.id} 
                          onClick={() => { setSelectedSavedTimetable(timetable); setFavoritesChatHistory([]); }}
                          className={`bg-white rounded-xl p-6 shadow-md border transition-all group cursor-pointer ${selectedForComparison.includes(timetable.id) ? 'border-purple-400 ring-2 ring-purple-200' : 'border-slate-200 hover:shadow-lg hover:border-pink-300'}`}
                        >
                          <div className="flex items-start justify-between mb-4">
                            <div className="flex items-center gap-3">
                              {savedTimetables.length >= 2 && (
                                <input
                                  type="checkbox"
                                  checked={selectedForComparison.includes(timetable.id)}
                                  onClick={(e) => e.stopPropagation()}
                                  onChange={(e) => {
                                    e.stopPropagation();
                                    if (selectedForComparison.includes(timetable.id)) {
                                      setSelectedForComparison(selectedForComparison.filter(id => id !== timetable.id));
                                    } else {
                                      setSelectedForComparison([...selectedForComparison, timetable.id]);
                                    }
                                  }}
                                  className="w-5 h-5 rounded border-slate-300 text-purple-600 focus:ring-purple-500 cursor-pointer"
                                />
                              )}
                              <div>
                                <h3 className="font-bold text-slate-800 group-hover:text-pink-600 transition-colors">{timetable.name}</h3>
                                <p className="text-sm text-slate-500">Saved {new Date(timetable.savedAt).toLocaleDateString()}</p>
                              </div>
                            </div>
                            <button 
                              onClick={(e) => { e.stopPropagation(); handleRemoveSaved(timetable.id); }} 
                              className="p-1.5 text-slate-400 hover:text-red-500 hover:bg-red-50 rounded-full transition-all"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </div>
                          <div className="flex items-center gap-4 text-sm">
                            <span className="flex items-center gap-1 text-indigo-600 bg-indigo-50 px-2 py-1 rounded"><GraduationCap className="w-4 h-4" /> {timetable.totalCredits} Credits</span>
                            <span className="flex items-center gap-1 text-slate-600 bg-slate-100 px-2 py-1 rounded"><Calendar className="w-4 h-4" /> {timetable.courseCount} Courses</span>
                          </div>
                          <div className="mt-4 pt-4 border-t border-slate-100">
                            <div className="flex flex-wrap gap-1">
                              {timetable.sections.slice(0, 4).map((s, i) => (
                                <span key={i} className="text-xs bg-slate-100 text-slate-600 px-2 py-0.5 rounded">{s.courseCode}</span>
                              ))}
                              {timetable.sections.length > 4 && <span className="text-xs bg-slate-100 text-slate-600 px-2 py-0.5 rounded">+{timetable.sections.length - 4} more</span>}
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </>
                )}
              </>
            )}
          </div>
        )}
      </main>
    </div>
  );
};

const App: React.FC = () => {
  return (
    <AuthProvider>
      <AppContent />
      <Analytics />
    </AuthProvider>
  );
};

export default App;
