import { TimeSlotMapping } from './types';

// ==========================================
// 1. Base Time Definitions (The "What")
// ==========================================

export interface SlotTime {
  id: number;
  start: string;
  end: string;
  label?: string; // For UI display
}

export const THEORY_SLOTS: SlotTime[] = [
  { id: 1, start: '09:00', end: '09:50', label: '9:00 - 9:50' },
  { id: 2, start: '09:55', end: '10:45', label: '9:55 - 10:45' },
  { id: 3, start: '10:50', end: '11:40', label: '10:50 - 11:40' },
  { id: 4, start: '11:45', end: '12:35', label: '11:45 - 12:35' },
  // Lunch Break: 12:35 - 13:15
  { id: 5, start: '13:15', end: '14:05', label: '1:15 - 2:05' },
  { id: 6, start: '14:10', end: '15:00', label: '2:10 - 3:00' },
  { id: 7, start: '15:05', end: '15:55', label: '3:05 - 3:55' },
  { id: 8, start: '16:00', end: '16:50', label: '4:00 - 4:50' },
];

export const LAB_SLOTS: SlotTime[] = [
  { id: 1, start: '09:00', end: '10:40', label: '9:00 AM - 10:40 AM' },
  { id: 2, start: '10:50', end: '12:30', label: '10:50 AM - 12:30 PM' },
  // Lunch Break
  { id: 3, start: '13:15', end: '14:55', label: '1:15 PM - 2:55 PM' },
  { id: 4, start: '15:05', end: '16:45', label: '3:05 PM - 4:45 PM' },
];

export const DAYS = ['MON', 'TUE', 'WED', 'THU', 'FRI'];

// ==========================================
// 2. Slot Configuration (The "When")
// Maps Course Slots (A1, B1...) to (Day, SlotNumber)
// ==========================================

// Helper to make the config cleaner
const theory = (day: string, ...slotIds: number[]) => slotIds.map(id => ({ day, slotId: id }));
const lab = (day: string, slotId: number) => [{ day, slotId }];

const SLOT_CONFIGURATION: Record<string, { day: string; slotId: number }[]> = {
  // Theory Slots - Based on VIT Timetable Structure
  // Morning slots (1-4): 9:00, 9:55, 10:50, 11:45
  // Afternoon slots (5-8): 13:15, 14:10, 15:05, 16:00
  // 
  // VIT Slot Grid:
  // | Time (Slot) | Mon  | Tue  | Wed  | Thu  | Fri  |
  // |-------------|------|------|------|------|------|
  // | 9:00  (1)   | A1   | B1   | C1   | D1   | E1   |
  // | 9:55  (2)   | F1   | G1   | A1   | B1   | C1   |
  // | 10:50 (3)   | D1   | E1   | F1   | G1   | A1   |
  // | 11:45 (4)   | TC1  | TA1  | B1   | C1   | TB1  |
  // | 1:15  (5)   | A2   | B2   | C2   | D2   | E2   |
  // | 2:10  (6)   | F2   | G2   | A2   | B2   | C2   |
  // | 3:05  (7)   | D2   | E2   | F2   | G2   | A2   |
  // | 4:00  (8)   | TC2  | TA2  | B2   | C2   | TB2  |

  // A slots - Mon slot1, Wed slot2, Fri slot3 (morning) / Mon slot5, Wed slot6, Fri slot7 (afternoon)
  "A1": [...theory('MON', 1), ...theory('WED', 2), ...theory('FRI', 3)],
  "A2": [...theory('MON', 5), ...theory('WED', 6), ...theory('FRI', 7)],

  // B slots - Tue slot1, Thu slot2, Wed slot4 (morning) / Tue slot5, Thu slot6, Wed slot8 (afternoon)
  "B1": [...theory('TUE', 1), ...theory('THU', 2), ...theory('WED', 4)],
  "B2": [...theory('TUE', 5), ...theory('THU', 6), ...theory('WED', 8)],

  // C slots - Wed slot1, Fri slot2, Thu slot4 (morning) / Wed slot5, Fri slot6, Thu slot8 (afternoon)
  "C1": [...theory('WED', 1), ...theory('FRI', 2), ...theory('THU', 4)],
  "C2": [...theory('WED', 5), ...theory('FRI', 6), ...theory('THU', 8)],

  // D slots - Thu slot1, Mon slot3 (morning) / Thu slot5, Mon slot7 (afternoon)
  "D1": [...theory('THU', 1), ...theory('MON', 3)],
  "D2": [...theory('THU', 5), ...theory('MON', 7)],

  // E slots - Fri slot1, Tue slot3 (morning) / Fri slot5, Tue slot7 (afternoon)
  "E1": [...theory('FRI', 1), ...theory('TUE', 3)],
  "E2": [...theory('FRI', 5), ...theory('TUE', 7)],

  // F slots - Mon slot2, Wed slot3 (morning) / Mon slot6, Wed slot7 (afternoon)
  "F1": [...theory('MON', 2), ...theory('WED', 3)],
  "F2": [...theory('MON', 6), ...theory('WED', 7)],

  // G slots - Tue slot2, Thu slot3 (morning) / Tue slot6, Thu slot7 (afternoon)
  "G1": [...theory('TUE', 2), ...theory('THU', 3)],
  "G2": [...theory('TUE', 6), ...theory('THU', 7)],

  // T slots (single occurrence)
  "TA1": [...theory('TUE', 4)],
  "TA2": [...theory('TUE', 8)],
  "TB1": [...theory('FRI', 4)],
  "TB2": [...theory('FRI', 8)],
  "TC1": [...theory('MON', 4)],
  "TC2": [...theory('MON', 8)],

  // Labs - Morning (slots 1-2)
  "L1+L2": lab('MON', 1),
  "L3+L4": lab('MON', 2),
  "L5+L6": lab('TUE', 1),
  "L7+L8": lab('TUE', 2),
  "L9+L10": lab('WED', 1),
  "L11+L12": lab('WED', 2),
  "L13+L14": lab('THU', 1),
  "L15+L16": lab('THU', 2),
  "L17+L18": lab('FRI', 1),
  "L19+L20": lab('FRI', 2),

  // Labs - Afternoon (slots 3-4)
  "L21+L22": lab('MON', 3),
  "L23+L24": lab('MON', 4),
  "L25+L26": lab('TUE', 3),
  "L27+L28": lab('TUE', 4),
  "L29+L30": lab('WED', 3),
  "L31+L32": lab('WED', 4),
  "L33+L34": lab('THU', 3),
  "L35+L36": lab('THU', 4),
  "L37+L38": lab('FRI', 3),
  "L39+L40": lab('FRI', 4),
};

// ==========================================
// 3. Derived Exports (Backward Compatibility)
// ==========================================

// Helper to resolve slot ID to actual time
const resolveTime = (slotId: number, type: 'theory' | 'lab') => {
  const slots = type === 'theory' ? THEORY_SLOTS : LAB_SLOTS;
  const slot = slots.find(s => s.id === slotId);
  if (!slot) throw new Error(`Invalid ${type} slot ID: ${slotId}`);
  return { start: slot.start, end: slot.end };
};

// Generate SLOT_TIMINGS for the application to use
export const SLOT_TIMINGS: TimeSlotMapping = {};

Object.entries(SLOT_CONFIGURATION).forEach(([code, mappings]) => {
  const isLab = code.startsWith('L');
  SLOT_TIMINGS[code] = mappings.map(m => ({
    day: m.day,
    ...resolveTime(m.slotId, isLab ? 'lab' : 'theory')
  }));
});
