import React, { useState } from 'react';
import { Upload, FileText, Sparkles, AlertCircle, FileJson, FileSpreadsheet, ArrowLeft } from 'lucide-react';
import { Course, TimeSlotMapping } from '../types';
import { GoogleGenAI } from "@google/genai";
import * as pdfjsLib from 'pdfjs-dist';
import * as XLSX from 'xlsx';
import { SLOT_TIMINGS } from '../constants';

// Initialize PDF.js worker
pdfjsLib.GlobalWorkerOptions.workerSrc = `//cdnjs.cloudflare.com/ajax/libs/pdf.js/${pdfjsLib.version}/pdf.worker.min.js`;

interface Props {
    onDataLoaded: (courses: Course[], slots: TimeSlotMapping) => void;
    onGoBack?: () => void;
}

export const DataUpload: React.FC<Props> = ({ onDataLoaded, onGoBack }) => {
    const [aiInput, setAiInput] = useState('');
    const [isAnalyzing, setIsAnalyzing] = useState(false);
    const [error, setError] = useState('');

    const extractTextFromPdf = async (file: File): Promise<string> => {
        const arrayBuffer = await file.arrayBuffer();
        const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
        let fullText = '';

        for (let i = 1; i <= pdf.numPages; i++) {
            const page = await pdf.getPage(i);
            const textContent = await page.getTextContent();
            const pageText = textContent.items.map((item: any) => item.str).join(' ');
            fullText += `Page ${i}:\n${pageText}\n\n`;
        }
        return fullText;
    };

    // Helper to sanitize and normalize slot codes (e.g., "L23-L24" -> "L23+L24", " B1 " -> "B1")
    const normalizeSlotString = (slot: any): string | undefined => {
        if (!slot) return undefined;
        let s = String(slot).trim();
        if (!s) return undefined;
        // Replace hyphens between alphanumeric slot components e.g. L23-L24 -> L23+L24
        s = s.replace(/([A-Za-z0-9]+)\s*-\s*([A-Za-z0-9]+)/g, '$1+$2');
        // Clean whitespace around plus and comma
        s = s.replace(/\s*\+\s*/g, '+').replace(/\s*,\s*/g, ', ');
        return s;
    };

    // Direct Excel parsing without AI - handles P column logic dynamically
    const parseExcelDirectly = async (file: File) => {
        const arrayBuffer = await file.arrayBuffer();
        const workbook = XLSX.read(arrayBuffer);
        const sheet = workbook.Sheets[workbook.SheetNames[0]];
        const rows: any[][] = XLSX.utils.sheet_to_json(sheet, { header: 1 });
        
        // Skip header row and filter rows with course code
        const dataRows = rows.slice(1).filter(row => row[2] && String(row[2]).trim());
        
        // Group by course code
        const courseMap = new Map<string, any>();
        
        dataRows.forEach((row) => {
            const courseCode = String(row[2]).trim();
            const courseTitle = row[3] ? String(row[3]).trim() : courseCode;
            const L = row[4]; // Lecture hours
            const P = row[5]; // Practical hours (0 = no lab, 2 = independent lab, 4 = linked lab)
            const credits = Number(row[6]) || 3;
            const theoryFaculty = row[7] ? String(row[7]).trim() : '';
            const labFaculty = row[8] ? String(row[8]).trim() : '';
            let theorySlot = normalizeSlotString(row[9]);
            let labSlot = normalizeSlotString(row[10]);
            
            // Auto-heal: If theorySlot is formatted like a lab slot (e.g. L23+L24) and labSlot is empty
            if (theorySlot && /^L\d+/i.test(theorySlot) && !labSlot) {
                labSlot = theorySlot;
                theorySlot = undefined;
            }
            
            if (!courseMap.has(courseCode)) {
                courseMap.set(courseCode, {
                    code: courseCode,
                    title: courseTitle,
                    credits: credits,
                    sections: [],
                    theorySections: [],
                    labSections: [],
                    linkedSections: [],
                    hasLinkedLab: false
                });
            }
            
            const course = courseMap.get(courseCode)!;
            const numP = P !== undefined && P !== null && !isNaN(Number(P)) ? Number(P) : undefined;
            const numL = L !== undefined && L !== null && !isNaN(Number(L)) ? Number(L) : undefined;

            const hasTheory = Boolean(theorySlot && (numL === undefined || numL > 0 || !labSlot));
            const hasLab = Boolean(labSlot && (numP === undefined || numP > 0 || !theorySlot));
            
            // Check if this is a LINKED lab (P=4)
            if (numP === 4) {
                course.hasLinkedLab = true;
                if (hasTheory && hasLab) {
                    const section = {
                        id: `${courseCode}-LINKED-${theoryFaculty || 'TBA'}-${theorySlot}-${labSlot}`,
                        courseCode: courseCode,
                        faculty: theoryFaculty || 'TBA',
                        theorySlot: theorySlot!,
                        labSlot: labSlot!,
                        labFaculty: labFaculty || theoryFaculty || 'TBA'
                    };
                    course.linkedSections.push(section);
                    course.sections.push(section);
                }
            } else {
                // P=0 or P=2: Independent theory and lab options
                if (hasTheory && hasLab) {
                    const section = {
                        id: `${courseCode}-${theoryFaculty || 'TBA'}-${theorySlot}-${labSlot}`,
                        courseCode: courseCode,
                        faculty: theoryFaculty || 'TBA',
                        theorySlot: theorySlot!,
                        labSlot: labSlot,
                        labFaculty: labFaculty || theoryFaculty || 'TBA'
                    };
                    course.sections.push(section);
                } else if (hasTheory) {
                    const section = {
                        id: `${courseCode}-${theoryFaculty || 'TBA'}-${theorySlot}`,
                        courseCode: courseCode,
                        faculty: theoryFaculty || 'TBA',
                        theorySlot: theorySlot!,
                        labSlot: undefined,
                        labFaculty: undefined
                    };
                    course.sections.push(section);
                } else if (hasLab) {
                    // Critical fix: Standalone or independent lab-only rows
                    const section = {
                        id: `${courseCode}-LAB-${labFaculty || theoryFaculty || 'TBA'}-${labSlot}`,
                        courseCode: courseCode,
                        faculty: theoryFaculty || 'TBA',
                        theorySlot: '',
                        labSlot: labSlot!,
                        labFaculty: labFaculty || theoryFaculty || 'TBA'
                    };
                    course.sections.push(section);
                }
                
                // Track for independent selection UI
                if (hasTheory) {
                    course.theorySections.push({
                        id: `${courseCode}-T-${theoryFaculty || 'TBA'}-${theorySlot}`,
                        courseCode: courseCode,
                        faculty: theoryFaculty || 'TBA',
                        slot: theorySlot!
                    });
                }
                if (hasLab) {
                    course.labSections.push({
                        id: `${courseCode}-L-${labFaculty || theoryFaculty || 'TBA'}-${labSlot}`,
                        courseCode: courseCode,
                        faculty: labFaculty || theoryFaculty || 'TBA',
                        slot: labSlot!
                    });
                }
            }
        });
        
        // Convert map to final courses list
        const courses = Array.from(courseMap.values()).map(course => {
            return {
                code: course.code,
                title: course.title,
                credits: course.credits,
                sections: course.sections,
                theoryOptions: course.theorySections,
                labOptions: course.labSections,
                linkedSections: course.linkedSections,
                hasLab: course.labSections.length > 0 || course.linkedSections.length > 0,
                hasLinkedLab: course.hasLinkedLab
            };
        });
        
        // Console validation step
        console.group('[AutoScheduler] Excel Ingestion Validation');
        console.log(`Extracted ${courses.length} courses from Excel file.`);
        courses.forEach(c => {
            console.log(
                `Course: ${c.code} (${c.title}) | Total Sections: ${c.sections.length} | ` +
                `Theory Opts: ${c.theoryOptions.length} | Lab Opts: ${c.labOptions.length} | ` +
                `Linked (P=4): ${c.hasLinkedLab ? `YES (${c.linkedSections.length})` : 'NO'}`
            );
        });
        console.groupEnd();

        return courses;
    };

    const extractTextFromExcel = async (file: File): Promise<string> => {
        const arrayBuffer = await file.arrayBuffer();
        const workbook = XLSX.read(arrayBuffer);
        let fullText = '';

        workbook.SheetNames.forEach(sheetName => {
            const sheet = workbook.Sheets[sheetName];
            const json = XLSX.utils.sheet_to_json(sheet, { header: 1 });
            fullText += `Sheet: ${sheetName}\n${JSON.stringify(json, null, 2)}\n\n`;
        });
        return fullText;
    };

    const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;

        setError('');
        const extension = file.name.split('.').pop()?.toLowerCase();

        if (extension === 'json') {
            const reader = new FileReader();
            reader.onload = (event) => {
                try {
                    const content = event.target?.result as string;
                    const data = JSON.parse(content);
                    if (Array.isArray(data.courses)) {
                        onDataLoaded(data.courses, data.slots || {});
                    } else {
                        setError("Invalid JSON format. Expected object with 'courses' array.");
                    }
                } catch (err) {
                    setError("Failed to parse JSON file.");
                }
            };
            reader.readAsText(file);
        } else if (extension === 'pdf') {
            try {
                setIsAnalyzing(true);
                const text = await extractTextFromPdf(file);
                // Directly analyze with AI
                await analyzeWithAI(text);
            } catch (err) {
                console.error(err);
                setError("Failed to extract text from PDF.");
                setIsAnalyzing(false);
            }
        } else if (extension === 'xlsx' || extension === 'xls') {
            try {
                setIsAnalyzing(true);
                // Use direct parsing for Excel - no AI needed
                const courses = await parseExcelDirectly(file);
                if (courses.length > 0) {
                    onDataLoaded(courses, SLOT_TIMINGS);
                } else {
                    setError("No courses found in Excel file.");
                }
                setIsAnalyzing(false);
            } catch (err) {
                console.error(err);
                setError("Failed to parse Excel file.");
                setIsAnalyzing(false);
            }
        } else {
            setError("Unsupported file format. Please upload JSON, PDF, or Excel.");
        }
    };

    const analyzeWithAI = async (inputText: string) => {
        if (!process.env.API_KEY) {
            setError("API Key not found. Please configure it in your environment.");
            setIsAnalyzing(false);
            return;
        }

        if (!inputText.trim()) {
            setError("No text to analyze.");
            setIsAnalyzing(false);
            return;
        }

        setError('');

        try {
            const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
            const prompt = `
You are a VIT University timetable data extraction assistant. Extract course and schedule data from the following Excel data.

EXCEL COLUMN STRUCTURE:
The Excel has these columns: Category, Year, Course Code, Course Title, L (Lecture hours), P (Practical hours), C (Credits), Theory Faculty, Lab Faculty, Theory Slot, Lab Slot

CRITICAL RULES FOR INTERPRETING ROWS:
1. If "L" column is NOT null AND "Theory Slot" column has a value → This row offers THEORY
2. If "P" column is NOT null AND "Lab Slot" column has a value → This row offers LAB
3. THEORY and LAB are INDEPENDENT choices - students can pick Theory from one faculty and Lab from different faculty
4. Same course code may have MULTIPLE rows - each row is a different section/option

HOW TO STRUCTURE OUTPUT:
For each course, create TWO separate lists:
- "theorySections": All rows that offer theory (L is not null, Theory Slot exists)
- "labSections": All rows that offer lab (P is not null, Lab Slot exists)

A row with BOTH theory and lab should appear in BOTH lists (as separate entries).

The output must strictly follow this structure:
{
    "courses": [
        {
            "code": "CSE2001",
            "title": "Data Structures and Algorithms",
            "credits": 4,
            "theorySections": [
                {
                    "id": "CSE2001-T-DrRajat-A2",
                    "faculty": "Dr.Rajat",
                    "slot": "A2"
                }
            ],
            "labSections": [
                {
                    "id": "CSE2001-L-DrRajat-L7+L8",
                    "faculty": "Dr.Rajat", 
                    "slot": "L7+L8"
                },
                {
                    "id": "CSE2001-L-Adhithi-L21+L22",
                    "faculty": "Adhithi",
                    "slot": "L21+L22"
                }
            ]
        }
    ],
    "slots": {}
}

RULES:
1. Group all rows by Course Code
2. For each course, extract ALL theory options (where L column is not null and Theory Slot exists)
3. For each course, extract ALL lab options (where P column is not null and Lab Slot exists)
4. Use "T-" prefix for theory section IDs, "L-" prefix for lab section IDs
5. Lab slots are in format L##+L## (e.g., L7+L8, L21+L22)
6. Theory slots are like A1, A2, B1, B2, C1, C2, D1, D2, E1, E2, F1, F2, G1, G2, TA1, TB1, TC1, etc.
7. Return ONLY valid JSON, no markdown formatting
8. Include ALL sections/faculty options from the data

Text to analyze:
${inputText.substring(0, 30000)} 
      `;

            const response = await ai.models.generateContent({
                model: 'gemini-2.5-flash',
                contents: prompt,
            });

            const text = response.text || '';
            // Clean up the response - remove markdown code blocks if present
            let jsonStr = text.replace(/```json\s*/gi, '').replace(/```\s*/g, '').trim();
            
            // Try to extract JSON if there's extra text
            const jsonMatch = jsonStr.match(/\{[\s\S]*\}/);
            if (jsonMatch) {
                jsonStr = jsonMatch[0];
            }

            try {
                const data = JSON.parse(jsonStr);
                if (Array.isArray(data.courses) && data.courses.length > 0) {
                    // Convert new structure (theorySections/labSections) to app format
                    const cleanedCourses = data.courses.map((course: any) => {
                        const theorySections = course.theorySections || [];
                        const labSections = course.labSections || [];
                        
                        // Create theoryOptions array
                        const theoryOptions = theorySections.map((t: any) => ({
                            id: t.id || `${course.code}-T-${t.faculty}-${t.slot}`,
                            courseCode: course.code,
                            faculty: t.faculty || 'TBA',
                            slot: t.slot || ''
                        }));
                        
                        // Create labOptions array
                        const labOptions = labSections.map((l: any) => ({
                            id: l.id || `${course.code}-L-${l.faculty}-${l.slot}`,
                            courseCode: course.code,
                            faculty: l.faculty || 'TBA',
                            slot: l.slot || ''
                        }));
                        
                        // Also create legacy sections array for backward compatibility
                        // Each unique theory slot becomes a section
                        const sections = theoryOptions.map((t: any) => ({
                            id: `${course.code}-${t.faculty}-${t.slot}`,
                            courseCode: course.code,
                            faculty: t.faculty,
                            theorySlot: t.slot,
                            labSlot: undefined,
                            labFaculty: undefined
                        }));
                        
                        return {
                            code: course.code || 'UNKNOWN',
                            title: course.title || course.code || 'Unknown Course',
                            credits: course.credits || 3,
                            sections,
                            theoryOptions,
                            labOptions,
                            hasLab: labOptions.length > 0
                        };
                    });
                    onDataLoaded(cleanedCourses, data.slots || {});
                } else {
                    setError("AI extracted invalid data structure. No courses found.");
                }
            } catch (e) {
                console.error("JSON Parse Error:", e);
                setError("Failed to parse AI response as JSON. Please try again or use manual JSON upload.");
            }
        } catch (err) {
            console.error(err);
            setError("AI Analysis failed. Please check your API key and try again.");
        } finally {
            setIsAnalyzing(false);
        }
    };

    // Wrapper for manual text input
    const handleAiParse = () => {
        if (!aiInput.trim()) {
            setError("Please enter some text to analyze.");
            return;
        }
        setIsAnalyzing(true);
        analyzeWithAI(aiInput);
    };

    return (
        <div className="max-w-3xl mx-auto space-y-8 animate-in fade-in zoom-in-95 duration-500">
            {/* Go Back Button */}
            {onGoBack && !isAnalyzing && (
                <button
                    onClick={onGoBack}
                    className="text-sm font-medium text-slate-500 hover:text-indigo-600 flex items-center gap-1"
                >
                    <ArrowLeft className="w-4 h-4" /> Go Back
                </button>
            )}

            <div className="bg-white rounded-2xl p-8 shadow-xl border border-slate-200">
                {isAnalyzing ? (
                    // Analyzing State - Full screen loader
                    <div className="py-12 text-center">
                        <div className="w-20 h-20 mx-auto mb-6 relative">
                            <div className="absolute inset-0 border-4 border-indigo-200 rounded-full"></div>
                            <div className="absolute inset-0 border-4 border-transparent border-t-indigo-600 rounded-full animate-spin"></div>
                            <div className="absolute inset-3 bg-indigo-100 rounded-full flex items-center justify-center">
                                <Sparkles className="w-6 h-6 text-indigo-600" />
                            </div>
                        </div>
                        <h3 className="text-xl font-bold text-slate-800 mb-2">Analyzing Your Data</h3>
                        <p className="text-slate-500 max-w-md mx-auto">
                            AutoScheduler AI is extracting courses, faculty names, and slot timings. This may take 10-20 seconds.
                        </p>
                        <div className="mt-6 flex justify-center gap-1">
                            <div className="w-2 h-2 bg-indigo-400 rounded-full animate-bounce" style={{animationDelay: '0s'}}></div>
                            <div className="w-2 h-2 bg-indigo-400 rounded-full animate-bounce" style={{animationDelay: '0.1s'}}></div>
                            <div className="w-2 h-2 bg-indigo-400 rounded-full animate-bounce" style={{animationDelay: '0.2s'}}></div>
                        </div>
                    </div>
                ) : (
                    // Normal Upload State
                    <>
                        <div className="text-center mb-8">
                            <h2 className="text-2xl font-bold text-slate-900 mb-2">Upload Your Schedule Data</h2>
                            <p className="text-slate-500">Import from JSON, PDF, or Excel file</p>
                        </div>

                        {error && (
                            <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-xl text-red-600 flex items-center gap-2 text-sm">
                                <AlertCircle className="w-4 h-4" />
                                {error}
                            </div>
                        )}

                        {/* File Upload Section */}
                        <div className="border-2 border-dashed border-slate-300 rounded-xl p-10 text-center hover:border-indigo-500 transition-colors bg-slate-50 mb-6">
                            <input
                                type="file"
                                accept=".json,.pdf,.xlsx,.xls"
                                onChange={handleFileUpload}
                                className="hidden"
                                id="file-upload"
                            />
                            <label htmlFor="file-upload" className="cursor-pointer flex flex-col items-center">
                                <div className="w-16 h-16 bg-indigo-100 text-indigo-600 rounded-full flex items-center justify-center mb-4">
                                    <Upload className="w-8 h-8" />
                                </div>
                                <span className="text-lg font-medium text-slate-700">Click to upload file</span>
                                <span className="text-sm text-slate-500 mt-1">Supports JSON, PDF, Excel</span>
                            </label>
                            <div className="flex gap-4 justify-center mt-6 text-slate-400">
                                <div className="flex flex-col items-center gap-1">
                                    <FileJson className="w-6 h-6" />
                                    <span className="text-xs">JSON</span>
                                </div>
                                <div className="flex flex-col items-center gap-1">
                                    <FileText className="w-6 h-6" />
                                    <span className="text-xs">PDF</span>
                                </div>
                                <div className="flex flex-col items-center gap-1">
                                    <FileSpreadsheet className="w-6 h-6" />
                                    <span className="text-xs">Excel</span>
                                </div>
                            </div>
                        </div>

                        {/* Or Text Input */}
                        <div className="relative">
                            <div className="absolute inset-0 flex items-center">
                                <div className="w-full border-t border-slate-200"></div>
                            </div>
                            <div className="relative flex justify-center">
                                <span className="px-3 bg-white text-sm text-slate-400">or paste text</span>
                            </div>
                        </div>

                        <div className="mt-6 space-y-4">
                            <textarea
                                value={aiInput}
                                onChange={(e) => setAiInput(e.target.value)}
                                placeholder="Paste your course details here (faculty names, slots, etc.)"
                                className="w-full h-32 p-4 rounded-xl border border-slate-300 focus:ring-2 focus:ring-indigo-500 focus:border-transparent resize-none text-slate-700 placeholder:text-slate-400 text-sm"
                            />
                            <div className="flex justify-end">
                                <button
                                    onClick={handleAiParse}
                                    disabled={!aiInput.trim()}
                                    className="px-6 py-2.5 bg-indigo-600 text-white rounded-lg font-medium shadow-md hover:bg-indigo-700 transition-all flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
                                >
                                    <Sparkles className="w-4 h-4" />
                                    Analyze Text
                                </button>
                            </div>
                        </div>
                    </>
                )}
            </div>
        </div>
    );
};
