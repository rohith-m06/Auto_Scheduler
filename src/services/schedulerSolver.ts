import { Course, CourseCatalog, TimetableSchedule, ScheduledSection, SlotPosition } from '../types';

export const SLOT_CONFIG: Record<string, SlotPosition[]> = {
  // Theory Slots
  "A1": [{day:'MON', slotId:1}, {day:'WED', slotId:2}, {day:'FRI', slotId:3}],
  "A2": [{day:'MON', slotId:5}, {day:'WED', slotId:6}, {day:'FRI', slotId:7}],
  "B1": [{day:'TUE', slotId:1}, {day:'THU', slotId:2}, {day:'WED', slotId:4}],
  "B2": [{day:'TUE', slotId:5}, {day:'THU', slotId:6}, {day:'WED', slotId:8}],
  "C1": [{day:'WED', slotId:1}, {day:'FRI', slotId:2}, {day:'THU', slotId:4}],
  "C2": [{day:'WED', slotId:5}, {day:'FRI', slotId:6}, {day:'THU', slotId:8}],
  "D1": [{day:'THU', slotId:1}, {day:'MON', slotId:3}],
  "D2": [{day:'THU', slotId:5}, {day:'MON', slotId:7}],
  "E1": [{day:'FRI', slotId:1}, {day:'TUE', slotId:3}],
  "E2": [{day:'FRI', slotId:5}, {day:'TUE', slotId:7}],
  "F1": [{day:'MON', slotId:2}, {day:'WED', slotId:3}],
  "F2": [{day:'MON', slotId:6}, {day:'WED', slotId:7}],
  "G1": [{day:'TUE', slotId:2}, {day:'THU', slotId:3}],
  "G2": [{day:'TUE', slotId:6}, {day:'THU', slotId:7}],
  "TA1": [{day:'TUE', slotId:4}], "TA2": [{day:'TUE', slotId:8}],
  "TB1": [{day:'FRI', slotId:4}], "TB2": [{day:'FRI', slotId:8}],
  "TC1": [{day:'MON', slotId:4}], "TC2": [{day:'MON', slotId:8}],
  "TD1": [{day:'THU', slotId:4}], "TD2": [{day:'THU', slotId:8}],
  "TE1": [{day:'WED', slotId:4}], "TE2": [{day:'WED', slotId:8}],

  // Lab Combined Pairs (Consecutive 50-min periods)
  "L1+L2": [{day:'MON', slotId:1}, {day:'MON', slotId:2}],
  "L3+L4": [{day:'MON', slotId:3}, {day:'MON', slotId:4}],
  "L5+L6": [{day:'TUE', slotId:1}, {day:'TUE', slotId:2}],
  "L7+L8": [{day:'TUE', slotId:3}, {day:'TUE', slotId:4}],
  "L9+L10": [{day:'WED', slotId:1}, {day:'WED', slotId:2}],
  "L11+L12": [{day:'WED', slotId:3}, {day:'WED', slotId:4}],
  "L13+L14": [{day:'THU', slotId:1}, {day:'THU', slotId:2}],
  "L15+L16": [{day:'THU', slotId:3}, {day:'THU', slotId:4}],
  "L17+L18": [{day:'FRI', slotId:1}, {day:'FRI', slotId:2}],
  "L19+L20": [{day:'FRI', slotId:3}, {day:'FRI', slotId:4}],
  "L21+L22": [{day:'MON', slotId:5}, {day:'MON', slotId:6}],
  "L23+L24": [{day:'MON', slotId:7}, {day:'MON', slotId:8}],
  "L25+L26": [{day:'TUE', slotId:5}, {day:'TUE', slotId:6}],
  "L27+L28": [{day:'TUE', slotId:7}, {day:'TUE', slotId:8}],
  "L29+L30": [{day:'WED', slotId:5}, {day:'WED', slotId:6}],
  "L31+L32": [{day:'WED', slotId:7}, {day:'WED', slotId:8}],
  "L33+L34": [{day:'THU', slotId:5}, {day:'THU', slotId:6}],
  "L35+L36": [{day:'THU', slotId:7}, {day:'THU', slotId:8}],
  "L37+L38": [{day:'FRI', slotId:5}, {day:'FRI', slotId:6}],
  "L39+L40": [{day:'FRI', slotId:7}, {day:'FRI', slotId:8}],

  // Single labs
  "L1": [{day:'MON', slotId:1}], "L2": [{day:'MON', slotId:2}],
  "L3": [{day:'MON', slotId:3}], "L4": [{day:'MON', slotId:4}],
  "L5": [{day:'TUE', slotId:1}], "L6": [{day:'TUE', slotId:2}],
  "L7": [{day:'TUE', slotId:3}], "L8": [{day:'TUE', slotId:4}],
  "L9": [{day:'WED', slotId:1}], "L10": [{day:'WED', slotId:2}],
  "L11": [{day:'WED', slotId:3}], "L12": [{day:'WED', slotId:4}],
  "L13": [{day:'THU', slotId:1}], "L14": [{day:'THU', slotId:2}],
  "L15": [{day:'THU', slotId:3}], "L16": [{day:'THU', slotId:4}],
  "L17": [{day:'FRI', slotId:1}], "L18": [{day:'FRI', slotId:2}],
  "L19": [{day:'FRI', slotId:3}], "L20": [{day:'FRI', slotId:4}],
  "L21": [{day:'MON', slotId:5}], "L22": [{day:'MON', slotId:6}],
  "L23": [{day:'MON', slotId:7}], "L24": [{day:'MON', slotId:8}],
  "L25": [{day:'TUE', slotId:5}], "L26": [{day:'TUE', slotId:6}],
  "L27": [{day:'TUE', slotId:7}], "L28": [{day:'TUE', slotId:8}],
  "L29": [{day:'WED', slotId:5}], "L30": [{day:'WED', slotId:6}],
  "L31": [{day:'WED', slotId:7}], "L32": [{day:'WED', slotId:8}],
  "L33": [{day:'THU', slotId:5}], "L34": [{day:'THU', slotId:6}],
  "L35": [{day:'THU', slotId:7}], "L36": [{day:'THU', slotId:8}],
  "L37": [{day:'FRI', slotId:5}], "L38": [{day:'FRI', slotId:6}],
  "L39": [{day:'FRI', slotId:7}], "L40": [{day:'FRI', slotId:8}],
};

export const DAY_MAP: Record<string, number> = { 'MON': 0, 'TUE': 1, 'WED': 2, 'THU': 3, 'FRI': 4 };

export function resolveSlotToPositions(slotCode: string): SlotPosition[] {
  if (!slotCode) return [];
  const normalized = slotCode.trim().toUpperCase()
    .replace(/[,/]/g, ' ')
    .replace(/\s+/g, ' ');

  const tokens = normalized.split(' ');
  const res: SlotPosition[] = [];

  tokens.forEach(tok => {
    if (!tok) return;
    if (SLOT_CONFIG[tok]) {
      res.push(...SLOT_CONFIG[tok]);
    } else if (tok.includes('+')) {
      const subParts = tok.split('+');
      subParts.forEach(sp => {
        if (SLOT_CONFIG[sp]) res.push(...SLOT_CONFIG[sp]);
      });
    }
  });

  return res;
}

export function computeSlotBitmask(slotCode: string): bigint {
  const pos = resolveSlotToPositions(slotCode);
  let mask = 0n;
  pos.forEach(p => {
    const dayIdx = DAY_MAP[p.day] ?? 0;
    const periodIdx = p.slotId - 1;
    const bitPos = BigInt(dayIdx * 8 + periodIdx);
    mask |= (1n << bitPos);
  });
  return mask;
}

export interface CourseCombination {
  courseCode: string;
  courseTitle: string;
  category: string;
  credits: number;
  theorySlot: string;
  theoryFaculty: string;
  labSlot: string;
  labFaculty: string;
  bitmask: bigint;
  hash: string;
}

export function buildCourseCombinations(
  course: Course,
  optionPrefState: Record<string, boolean>
): CourseCombination[] {
  const allowedTheory = (course.theoryOptions || []).filter(to => {
    const key = `${course.code}_theory_${to.faculty}_${to.slot}`;
    return optionPrefState[key] !== false;
  });

  const allowedLab = (course.labOptions || []).filter(lo => {
    const key = `${course.code}_lab_${lo.faculty}_${lo.slot}`;
    return optionPrefState[key] !== false;
  });

  const hasTheory = (course.theoryOptions || []).length > 0;
  const hasLab = (course.labOptions || []).length > 0;
  const combos: CourseCombination[] = [];

  if (hasTheory && hasLab) {
    allowedTheory.forEach(to => {
      const tMask = computeSlotBitmask(to.slot);
      allowedLab.forEach(lo => {
        const lMask = computeSlotBitmask(lo.slot);
        // STRICT ZERO COLLISION BETWEEN THEORY AND LAB OF SAME COURSE
        if ((tMask & lMask) === 0n) {
          combos.push({
            courseCode: course.code,
            courseTitle: course.title,
            category: course.basket,
            credits: course.credits,
            theorySlot: to.slot,
            theoryFaculty: to.faculty,
            labSlot: lo.slot,
            labFaculty: lo.faculty,
            bitmask: tMask | lMask,
            hash: `${course.code}:${to.faculty}:${to.slot}|${lo.faculty}:${lo.slot}`
          });
        }
      });
    });
  } else if (hasTheory) {
    allowedTheory.forEach(to => {
      combos.push({
        courseCode: course.code,
        courseTitle: course.title,
        category: course.basket,
        credits: course.credits,
        theorySlot: to.slot,
        theoryFaculty: to.faculty,
        labSlot: 'N/A',
        labFaculty: 'N/A',
        bitmask: computeSlotBitmask(to.slot),
        hash: `${course.code}:${to.faculty}:${to.slot}`
      });
    });
  } else if (hasLab) {
    allowedLab.forEach(lo => {
      combos.push({
        courseCode: course.code,
        courseTitle: course.title,
        category: course.basket,
        credits: course.credits,
        theorySlot: 'N/A',
        theoryFaculty: 'N/A',
        labSlot: lo.slot,
        labFaculty: lo.faculty,
        bitmask: computeSlotBitmask(lo.slot),
        hash: `${course.code}:${lo.faculty}:${lo.slot}`
      });
    });
  }

  return combos;
}

export function solveTimetables(
  selectedCourses: Course[],
  optionPrefState: Record<string, boolean>,
  maxResults: number = 500
): { timetables: TimetableSchedule[]; clashReason?: string } {
  if (selectedCourses.length === 0) return { timetables: [] };

  const courseDomainLists: CourseCombination[][] = [];
  for (const c of selectedCourses) {
    const list = buildCourseCombinations(c, optionPrefState);
    if (list.length === 0) {
      return {
        timetables: [],
        clashReason: `No valid section options found for course ${c.code} (${c.title}). All teachers/slots might be deselected or conflicting.`
      };
    }
    courseDomainLists.push(list);
  }

  // Sort domains by size (MRV heuristic)
  courseDomainLists.sort((a, b) => a.length - b.length);

  const results: TimetableSchedule[] = [];
  const seenSchedules = new Set<string>();

  function backtrack(depth: number, currentOccupied: bigint, currentSections: CourseCombination[]) {
    if (results.length >= maxResults) return;

    if (depth === courseDomainLists.length) {
      const scheduleKey = currentSections
        .map(s => `${s.courseCode}@${s.theorySlot}@${s.theoryFaculty}@${s.labSlot}@${s.labFaculty}`)
        .sort()
        .join(';;');

      if (!seenSchedules.has(scheduleKey)) {
        seenSchedules.add(scheduleKey);
        let creds = 0;
        const sections: ScheduledSection[] = currentSections.map(c => {
          creds += c.credits;
          return {
            courseCode: c.courseCode,
            courseTitle: c.courseTitle,
            category: c.category,
            credits: c.credits,
            theorySlot: c.theorySlot,
            theoryFaculty: c.theoryFaculty,
            labSlot: c.labSlot,
            labFaculty: c.labFaculty
          };
        });

        results.push({
          id: results.length + 1,
          sections,
          totalCredits: creds
        });
      }
      return;
    }

    const domain = courseDomainLists[depth];
    for (let i = 0; i < domain.length; i++) {
      const candidate = domain[i];
      if ((currentOccupied & candidate.bitmask) === 0n) {
        currentSections.push(candidate);
        backtrack(depth + 1, currentOccupied | candidate.bitmask, currentSections);
        currentSections.pop();
        if (results.length >= maxResults) break;
      }
    }
  }

  backtrack(0, 0n, []);

  return {
    timetables: results,
    clashReason: results.length === 0 ? "Direct timing overlap detected between selected course slots. Try selecting alternative teachers or fewer clashing subjects." : undefined
  };
}
