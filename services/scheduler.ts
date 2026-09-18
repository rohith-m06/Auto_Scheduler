import { Course, Section, Timetable, TimeSlotMapping, ScheduledCourse, LinkedSection } from '../types';
import { SLOT_TIMINGS } from '../constants';

export interface NumericInterval {
  day: string;
  start: number;
  end: number;
}

const parseTime = (time: string): number => {
  if (!time) return 0;
  
  // Handle "9:00 AM" or "09:00"
  const cleanTime = time.replace(/(AM|PM)/i, '').trim();
  const parts = cleanTime.split(':').map(Number);
  
  let hours = parts[0] || 0;
  const minutes = parts[1] || 0;
  
  // Adjust for PM if not already 12
  if (time.toLowerCase().includes('pm') && hours < 12) {
    hours += 12;
  }
  // Adjust for 12 AM
  if (time.toLowerCase().includes('am') && hours === 12) {
    hours = 0;
  }
  
  return hours * 60 + minutes;
};

// Helper to normalize slot codes (e.g., "L23-L24" -> "L23+L24", " B1 " -> "B1")
export const normalizeSlotCode = (slotCode: string): string => {
  if (!slotCode) return '';
  let cleaned = slotCode.replace(/[()]/g, '').trim();
  // Normalize hyphens between alphanumeric components
  cleaned = cleaned.replace(/([A-Za-z0-9]+)\s*-\s*([A-Za-z0-9]+)/g, '$1+$2');
  // Normalize spaces around + and ,
  cleaned = cleaned.replace(/\s*\+\s*/g, '+').replace(/\s*,\s*/g, ', ');
  return cleaned;
};

// Helper to resolve timings from potentially complex slot codes (e.g., "L13+L14, L25+L26")
export const resolveTimings = (slotCode: string, slotTimings: TimeSlotMapping) => {
  if (!slotCode || !slotTimings) return [];
  
  const normalizedCode = normalizeSlotCode(slotCode);
  const sessions = normalizedCode.split(',').map(s => s.trim());
  
  const allTimings = [];
  for (const session of sessions) {
    if (!session) continue;
    
    // 1. Try exact match (e.g., "L1+L2")
    if (slotTimings[session]) {
      allTimings.push(...slotTimings[session]);
      continue;
    }
    
    // 2. Try normalized match (remove all spaces)
    const noSpaces = session.replace(/\s+/g, '');
    if (slotTimings[noSpaces]) {
      allTimings.push(...slotTimings[noSpaces]);
      continue;
    }

    // 3. Fallback: split by plus and search
    const subParts = session.split('+').map(p => p.trim());
    for (const part of subParts) {
      if (slotTimings[part]) {
        allTimings.push(...slotTimings[part]);
      } else {
        // Search keys for partial match (e.g., finding "L1+L2" when part is "L1")
        for (const [key, t] of Object.entries(slotTimings)) {
          const keyTokens = key.split(/[,+]/).map(k => k.trim());
          if (keyTokens.includes(part)) {
            allTimings.push(...t);
            break;
          }
        }
      }
    }
  }
  
  // De-duplicate timings by day and start time
  const uniqueTimings = [];
  const seen = new Set<string>();
  for (const t of allTimings) {
    const key = `${t.day}-${t.start}`;
    if (!seen.has(key)) {
      seen.add(key);
      uniqueTimings.push(t);
    }
  }
  
  return uniqueTimings;
};

// Pre-resolve slot string to numeric minute intervals for fast integer collision checks
export const resolveNumericTimings = (slotCode: string, slotTimings: TimeSlotMapping): NumericInterval[] => {
  const timings = resolveTimings(slotCode, slotTimings);
  return timings.map(t => ({
    day: t.day,
    start: parseTime(t.start),
    end: parseTime(t.end)
  }));
};

// High-performance integer interval clash detection (O(N) with tiny N, no string operations)
export const hasIntervalConflict = (
  slotIntervals: NumericInterval[],
  occupiedIntervals: NumericInterval[]
): boolean => {
  for (let i = 0; i < slotIntervals.length; i++) {
    const t1 = slotIntervals[i];
    for (let j = 0; j < occupiedIntervals.length; j++) {
      const t2 = occupiedIntervals[j];
      if (t1.day === t2.day && t1.start < t2.end && t2.start < t1.end) {
        return true;
      }
    }
  }
  return false;
};

// Check if two slots overlap in time (backward compatibility export)
export const isOverlap = (slot1: string, slot2: string, slotTimings: TimeSlotMapping): boolean => {
  if (!slot1 || !slot2) return false;
  
  const s1Norm = normalizeSlotCode(slot1);
  const s2Norm = normalizeSlotCode(slot2);
  if (s1Norm.toUpperCase() === s2Norm.toUpperCase()) return true;

  const times1 = resolveNumericTimings(s1Norm, slotTimings);
  const times2 = resolveNumericTimings(s2Norm, slotTimings);

  if (times1.length === 0 || times2.length === 0) return true;

  return hasIntervalConflict(times1, times2);
};

// Maximum number of timetables to generate (safety cap)
const MAX_TIMETABLES = 3000;
// Maximum search exploration steps to prevent browser locking on heavy combinatorial conflicts
const MAX_SEARCH_STEPS = 80000;

// Extract unique theory options (faculty + slot combinations)
const getTheoryOptions = (sections: Section[]): { faculty: string; slot: string }[] => {
  const seen = new Set<string>();
  const options: { faculty: string; slot: string }[] = [];
  
  for (const section of sections) {
    if (section.theorySlot) {
      const normSlot = normalizeSlotCode(section.theorySlot);
      const key = `${section.faculty}-${normSlot}`;
      if (!seen.has(key)) {
        seen.add(key);
        options.push({ faculty: section.faculty, slot: normSlot });
      }
    }
  }
  return options;
};

// Extract unique lab options with faculty information
const getLabOptions = (sections: Section[]): { faculty: string; slot: string }[] => {
  const seen = new Set<string>();
  const options: { faculty: string; slot: string }[] = [];
  
  for (const section of sections) {
    if (section.labSlot) {
      const faculty = section.labFaculty || section.faculty;
      const normSlot = normalizeSlotCode(section.labSlot);
      const key = `${faculty}-${normSlot}`;
      
      if (!seen.has(key)) {
        seen.add(key);
        options.push({ faculty, slot: normSlot });
      }
    }
  }
  return options;
};

export const generateTimetables = (
  selectedCourses: Course[],
  facultyPreferences: { [courseCode: string]: string[] } = {},
  slotTimings: TimeSlotMapping = {},
  labFacultyPreferences: { [courseCode: string]: string[] } = {}
): Timetable[] => {
  if (!selectedCourses || selectedCourses.length === 0) return [];

  // If slotTimings is empty or not passed, automatically fallback to complete standard SLOT_TIMINGS
  const effectiveSlots = (slotTimings && Object.keys(slotTimings).length > 0) ? slotTimings : SLOT_TIMINGS;

  const validTimetables: Timetable[] = [];

  // 1. Build course options with pre-resolved numeric timings for instantaneous collision checks
  const courseData = selectedCourses.map(course => {
    const preferredTheoryFaculty = facultyPreferences ? facultyPreferences[course.code] : undefined;
    const preferredLabFaculty = labFacultyPreferences ? labFacultyPreferences[course.code] : undefined;
    
    // Check if this course has linked theory+lab (P=4)
    if (course.hasLinkedLab && course.linkedSections && course.linkedSections.length > 0) {
      let linked = course.linkedSections;
      if (preferredTheoryFaculty && preferredTheoryFaculty.length > 0) {
        linked = linked.filter(s => preferredTheoryFaculty.includes(s.faculty));
      }
      if (preferredLabFaculty && preferredLabFaculty.length > 0) {
        linked = linked.filter(s => preferredLabFaculty.includes(s.labFaculty || s.faculty));
      }

      const validLinked = linked
        .map(s => {
          const theorySlot = normalizeSlotCode(s.theorySlot);
          const labSlot = normalizeSlotCode(s.labSlot);
          const theoryIntervals = resolveNumericTimings(theorySlot, effectiveSlots);
          const labIntervals = resolveNumericTimings(labSlot, effectiveSlots);
          return {
            faculty: s.faculty,
            theorySlot,
            labSlot,
            labFaculty: s.labFaculty || s.faculty,
            theoryIntervals,
            labIntervals,
            // Combined intervals for atomic placement
            intervals: [...theoryIntervals, ...labIntervals]
          };
        })
        .filter(s => s.theoryIntervals.length > 0 && s.labIntervals.length > 0 && !hasIntervalConflict(s.theoryIntervals, s.labIntervals));

      return {
        code: course.code,
        hasLinkedLab: true,
        linkedOptions: validLinked,
        theoryOptions: [],
        labOptions: [],
        hasLab: true,
        hasTheory: true
      };
    }

    // THEORY: Support options defined in course.theoryOptions or extract from course.sections
    let rawTheoryOptions: { faculty: string; slot: string }[] = [];
    if (course.theoryOptions && Array.isArray(course.theoryOptions) && course.theoryOptions.length > 0) {
      rawTheoryOptions = course.theoryOptions.map(t => ({ faculty: t.faculty || 'TBA', slot: normalizeSlotCode(t.slot) }));
    } else if (course.sections && Array.isArray(course.sections) && course.sections.length > 0) {
      rawTheoryOptions = getTheoryOptions(course.sections);
    }
    if (preferredTheoryFaculty && preferredTheoryFaculty.length > 0) {
      rawTheoryOptions = rawTheoryOptions.filter(t => preferredTheoryFaculty.includes(t.faculty));
    }
    const theoryOptions = rawTheoryOptions
      .map(t => ({
        ...t,
        intervals: resolveNumericTimings(t.slot, effectiveSlots)
      }))
      .filter(t => t.intervals.length > 0);

    // LAB: Support options defined in course.labOptions or extract from course.sections
    let rawLabOptions: { faculty: string; slot: string }[] = [];
    if (course.labOptions && Array.isArray(course.labOptions) && course.labOptions.length > 0) {
      rawLabOptions = course.labOptions.map(l => ({ faculty: l.faculty || 'TBA', slot: normalizeSlotCode(l.slot) }));
    } else if (course.sections && Array.isArray(course.sections) && course.sections.length > 0) {
      rawLabOptions = getLabOptions(course.sections);
    }
    if (preferredLabFaculty && preferredLabFaculty.length > 0) {
      rawLabOptions = rawLabOptions.filter(l => preferredLabFaculty.includes(l.faculty));
    }
    const labOptions = rawLabOptions
      .map(l => ({
        ...l,
        intervals: resolveNumericTimings(l.slot, effectiveSlots)
      }))
      .filter(l => l.intervals.length > 0);

    const hasLab = course.hasLab !== undefined ? course.hasLab : (labOptions.length > 0 || (course.labOptions && course.labOptions.length > 0));
    const hasTheory = rawTheoryOptions.length > 0 || !hasLab;

    return {
      code: course.code,
      hasLinkedLab: false,
      linkedOptions: [] as {
        faculty: string;
        theorySlot: string;
        labSlot: string;
        labFaculty: string;
        theoryIntervals: NumericInterval[];
        labIntervals: NumericInterval[];
        intervals: NumericInterval[];
      }[],
      theoryOptions,
      labOptions,
      hasLab,
      hasTheory
    };
  });

  // Strict verification: if ANY selected course has 0 valid options, return 0 timetables immediately
  // (Mandatory all-course constraint: we can never leave out any selected course)
  const coursesWithNoOptions = courseData.filter(c => {
    if (c.hasLinkedLab) {
      return c.linkedOptions.length === 0;
    }
    if (c.hasTheory && c.theoryOptions.length === 0) return true;
    if (c.hasLab && c.labOptions.length === 0) return true;
    if (!c.hasTheory && !c.hasLab) return true;
    return false;
  });

  if (coursesWithNoOptions.length > 0) {
    console.warn(
      `[AutoScheduler] Cannot generate timetable: Course(s) with 0 valid options:`,
      coursesWithNoOptions.map(c => c.code)
    );
    return [];
  }

  // Most Constrained Variable (MCV) Heuristic:
  // Sort courses by fewest available branches first to prune the search space by orders of magnitude
  courseData.sort((a, b) => {
    const countA = a.hasLinkedLab ? a.linkedOptions.length : (a.hasLab ? a.theoryOptions.length * Math.max(1, a.labOptions.length) : a.theoryOptions.length);
    const countB = b.hasLinkedLab ? b.linkedOptions.length : (b.hasLab ? b.theoryOptions.length * Math.max(1, b.labOptions.length) : b.theoryOptions.length);
    return countA - countB;
  });

  const seenTimetables = new Set<string>();
  let steps = 0;

  // Ultra-fast backtracking with pre-resolved numeric intervals
  const backtrack = (
    courseIndex: number,
    currentSchedule: ScheduledCourse[],
    occupiedIntervals: NumericInterval[]
  ) => {
    if (validTimetables.length >= MAX_TIMETABLES) return;
    if (++steps >= MAX_SEARCH_STEPS) return;

    // A combination is ONLY valid when ALL selected courses have been successfully scheduled
    if (courseIndex === courseData.length) {
      const timetableKey = currentSchedule
        .map(sc => `${sc.courseCode}:${sc.theoryFaculty || 'none'}:${sc.theorySlot || 'none'}:${sc.labFaculty || 'none'}:${sc.labSlot || 'none'}`)
        .sort()
        .join('|');
      
      if (seenTimetables.has(timetableKey)) return;
      seenTimetables.add(timetableKey);

      // Deep copy sections and scheduled courses
      const sections: Section[] = currentSchedule.map(sc => ({
        id: `${sc.courseCode}-${sc.theoryFaculty || sc.labFaculty || 'TBA'}-${sc.theorySlot || sc.labSlot || 'SLOT'}`,
        courseCode: sc.courseCode,
        faculty: sc.theoryFaculty || sc.labFaculty || 'TBA',
        theorySlot: sc.theorySlot || '',
        labSlot: sc.labSlot,
        labFaculty: sc.labFaculty
      }));

      validTimetables.push({
        id: validTimetables.length + 1,
        sections,
        scheduledCourses: currentSchedule.map(sc => ({ ...sc }))
      });
      return;
    }

    const course = courseData[courseIndex];

    // Branch A: Linked Labs (P=4)
    if (course.hasLinkedLab) {
      for (let i = 0; i < course.linkedOptions.length; i++) {
        const linked = course.linkedOptions[i];
        if (hasIntervalConflict(linked.intervals, occupiedIntervals)) continue;

        backtrack(
          courseIndex + 1,
          [...currentSchedule, {
            courseCode: course.code,
            theorySlot: linked.theorySlot,
            theoryFaculty: linked.faculty,
            labSlot: linked.labSlot,
            labFaculty: linked.labFaculty
          }],
          [...occupiedIntervals, ...linked.intervals]
        );
        if (validTimetables.length >= MAX_TIMETABLES) return;
      }
      return;
    }

    // Branch B: Pure Lab-only courses (no theory)
    if (!course.hasTheory && course.hasLab) {
      for (let i = 0; i < course.labOptions.length; i++) {
        const lab = course.labOptions[i];
        if (hasIntervalConflict(lab.intervals, occupiedIntervals)) continue;

        backtrack(
          courseIndex + 1,
          [...currentSchedule, {
            courseCode: course.code,
            theorySlot: '',
            theoryFaculty: '',
            labSlot: lab.slot,
            labFaculty: lab.faculty
          }],
          [...occupiedIntervals, ...lab.intervals]
        );
        if (validTimetables.length >= MAX_TIMETABLES) return;
      }
      return;
    }

    // Branch C: Standard courses with theory (and optional independent lab)
    for (let i = 0; i < course.theoryOptions.length; i++) {
      const theory = course.theoryOptions[i];
      if (hasIntervalConflict(theory.intervals, occupiedIntervals)) continue;

      if (!course.hasLab) {
        // Theory only course
        backtrack(
          courseIndex + 1,
          [...currentSchedule, {
            courseCode: course.code,
            theorySlot: theory.slot,
            theoryFaculty: theory.faculty
          }],
          [...occupiedIntervals, ...theory.intervals]
        );
        if (validTimetables.length >= MAX_TIMETABLES) return;
      } else {
        // Independent lab course: try each valid lab option
        for (let j = 0; j < course.labOptions.length; j++) {
          const lab = course.labOptions[j];
          if (hasIntervalConflict(lab.intervals, occupiedIntervals)) continue;
          if (hasIntervalConflict(theory.intervals, lab.intervals)) continue;

          backtrack(
            courseIndex + 1,
            [...currentSchedule, {
              courseCode: course.code,
              theorySlot: theory.slot,
              theoryFaculty: theory.faculty,
              labSlot: lab.slot,
              labFaculty: lab.faculty
            }],
            [...occupiedIntervals, ...theory.intervals, ...lab.intervals]
          );
          if (validTimetables.length >= MAX_TIMETABLES) return;
        }
      }
    }
  };

  backtrack(0, [], []);

  return validTimetables;
};