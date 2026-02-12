import { Course, Section, Timetable, TimeSlotMapping, ScheduledCourse } from '../types';

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

// Helper to resolve timings from potentially complex slot codes (e.g., "L13+L14, L25+L26")
const resolveTimings = (slotCode: string, slotTimings: TimeSlotMapping) => {
  if (!slotCode) return [];
  
  // First, split by comma to separate distinct sessions (e.g. for P=4)
  const cleaned = slotCode.replace(/[()]/g, '');
  const sessions = cleaned.split(',').map(s => s.trim());
  
  const allTimings = [];
  for (const session of sessions) {
    if (!session) continue;
    
    // 1. Try exact match (e.g., "L1+L2")
    if (slotTimings[session]) {
      allTimings.push(...slotTimings[session]);
      continue;
    }
    
    // 2. Try normalized match (remove spaces/plus for "L1+L2")
    const normalized = session.replace(/\s+/g, '');
    if (slotTimings[normalized]) {
      allTimings.push(...slotTimings[normalized]);
      continue;
    }

    // 3. Fallback: split by plus and search (only if necessary)
    const subParts = session.split('+').map(p => p.trim());
    for (const part of subParts) {
      if (slotTimings[part]) {
        allTimings.push(...slotTimings[part]);
      } else {
        // Search keys for partial match (e.g., finding "L1+L2" when part is "L1")
        for (const [key, t] of Object.entries(slotTimings)) {
          if (key.split(/[,+]/).map(k => k.trim()).includes(part)) {
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

// Check if two slots overlap
const isOverlap = (slot1: string, slot2: string, slotTimings: TimeSlotMapping): boolean => {
  if (!slot1 || !slot2) return false;
  if (slot1 === slot2) return true;

  const times1 = resolveTimings(slot1, slotTimings);
  const times2 = resolveTimings(slot2, slotTimings);

  if (times1.length === 0 || times2.length === 0) return false;

  for (const t1 of times1) {
    for (const t2 of times2) {
      if (t1.day === t2.day) {
        const s1 = parseTime(t1.start);
        const e1 = parseTime(t1.end);
        const s2 = parseTime(t2.start);
        const e2 = parseTime(t2.end);

        if (s1 < e2 && s2 < e1) return true;
      }
    }
  }
  return false;
};

// Check if a slot conflicts with any in the occupied list
const hasSlotConflict = (slot: string, occupiedSlots: string[], slotTimings: TimeSlotMapping): boolean => {
  for (const occupied of occupiedSlots) {
    if (isOverlap(slot, occupied, slotTimings)) return true;
  }
  return false;
};

// Maximum number of timetables to generate - set high to get all possibilities
const MAX_TIMETABLES = 3500;

// Extract unique theory options (faculty + slot combinations)
const getTheoryOptions = (sections: Section[]): { faculty: string; slot: string }[] => {
  const seen = new Set<string>();
  const options: { faculty: string; slot: string }[] = [];
  
  for (const section of sections) {
    if (section.theorySlot) {
      const key = `${section.faculty}-${section.theorySlot}`;
      if (!seen.has(key)) {
        seen.add(key);
        options.push({ faculty: section.faculty, slot: section.theorySlot });
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
      // Use labFaculty if available, else faculty
      const faculty = section.labFaculty || section.faculty;
      // We take the labSlot as-is from the row. 
      // If it's P=4, the data already contains "L1+L2, L21+L22" in this field.
      const key = `${faculty}-${section.labSlot}`;
      
      if (!seen.has(key)) {
        seen.add(key);
        options.push({ faculty, slot: section.labSlot });
      }
    }
  }
  return options;
};

export const generateTimetables = (
  selectedCourses: Course[],
  facultyPreferences: { [courseCode: string]: string[] },
  slotTimings: TimeSlotMapping,
  labFacultyPreferences: { [courseCode: string]: string[] } = {}
): Timetable[] => {
  const validTimetables: Timetable[] = [];

  // Build course options with INDEPENDENT theory and lab choices
  const courseData = selectedCourses.map(course => {
    const preferredTheoryFaculty = facultyPreferences[course.code];
    const preferredLabFaculty = labFacultyPreferences[course.code];
    
    // THEORY: Get ALL sections for this course first to ensure we see every slot
    let theorySections = course.sections;
    // Apply filter ONLY if preferences are selected, and ensure EVERY slot for those teachers is caught
    if (preferredTheoryFaculty && preferredTheoryFaculty.length > 0) {
      theorySections = course.sections.filter(s => preferredTheoryFaculty.includes(s.faculty));
    }
    const theoryOptions = getTheoryOptions(theorySections);

    // LAB: Get ALL sections that have labs for this course
    let labSections = course.sections.filter(s => s.labSlot);
    // Apply filter ONLY if preferences are selected, and ensure EVERY connected slot package is caught
    if (preferredLabFaculty && preferredLabFaculty.length > 0) {
      labSections = labSections.filter(s => 
        preferredLabFaculty.includes(s.labFaculty || s.faculty)
      );
    }
    const labOptions = getLabOptions(labSections);
    const hasLab = labOptions.length > 0;
    const hasTheory = theoryOptions.length > 0;

    return {
      code: course.code,
      theoryOptions,
      labOptions,
      hasLab,
      hasTheory
    };
  });

  // Check if any course has no options at all
  const coursesWithNoOptions = courseData.filter(c => 
    (c.hasTheory && c.theoryOptions.length === 0) || 
    (c.hasLab && c.labOptions.length === 0) ||
    (!c.hasTheory && !c.hasLab)
  );
  if (coursesWithNoOptions.length > 0) return [];

  // Use Set to track unique timetables and prevent duplicates
  const seenTimetables = new Set<string>();

  // Backtracking with DECOUPLED theory and lab selection
  const backtrack = (
    courseIndex: number,
    currentSchedule: ScheduledCourse[],
    occupiedSlots: string[]
  ) => {
    if (validTimetables.length >= MAX_TIMETABLES) return;

    if (courseIndex === courseData.length) {
      const timetableKey = currentSchedule
        .map(sc => `${sc.courseCode}:${sc.theoryFaculty || 'none'}:${sc.theorySlot || 'none'}:${sc.labFaculty || 'none'}:${sc.labSlot || 'none'}`)
        .sort()
        .join('|');
      
      if (seenTimetables.has(timetableKey)) return;
      seenTimetables.add(timetableKey);

      const sections: Section[] = currentSchedule.map(sc => ({
        id: `${sc.courseCode}-${sc.theoryFaculty || sc.labFaculty}-${sc.theorySlot || sc.labSlot}`,
        courseCode: sc.courseCode,
        faculty: sc.theoryFaculty || 'TBA',
        theorySlot: sc.theorySlot || '',
        labSlot: sc.labSlot,
        labFaculty: sc.labFaculty
      }));

      validTimetables.push({
        id: validTimetables.length + 1,
        sections,
        scheduledCourses: [...currentSchedule]
      });
      return;
    }

    const course = courseData[courseIndex];

    // If course has only lab
    if (!course.hasTheory && course.hasLab) {
      for (const lab of course.labOptions) {
        if (hasSlotConflict(lab.slot, occupiedSlots, slotTimings)) continue;
        backtrack(
          courseIndex + 1,
          [...currentSchedule, {
            courseCode: course.code,
            theorySlot: '',
            theoryFaculty: '',
            labSlot: lab.slot,
            labFaculty: lab.faculty
          }],
          [...occupiedSlots, lab.slot]
        );
      }
      return;
    }

    // Try each theory option
    for (const theory of course.theoryOptions) {
      if (hasSlotConflict(theory.slot, occupiedSlots, slotTimings)) continue;

      if (!course.hasLab) {
        backtrack(
          courseIndex + 1,
          [...currentSchedule, {
            courseCode: course.code,
            theorySlot: theory.slot,
            theoryFaculty: theory.faculty
          }],
          [...occupiedSlots, theory.slot]
        );
      } else {
        // Try each lab option INDEPENDENTLY
        for (const lab of course.labOptions) {
          // Check for conflict with existing occupied slots AND the current theory slot
          if (hasSlotConflict(lab.slot, occupiedSlots, slotTimings)) continue;
          if (isOverlap(theory.slot, lab.slot, slotTimings)) continue;

          backtrack(
            courseIndex + 1,
            [...currentSchedule, {
              courseCode: course.code,
              theorySlot: theory.slot,
              theoryFaculty: theory.faculty,
              labSlot: lab.slot,
              labFaculty: lab.faculty
            }],
            [...occupiedSlots, theory.slot, lab.slot]
          );
        }
      }
    }
  };

  backtrack(0, [], []);

  return validTimetables;
};