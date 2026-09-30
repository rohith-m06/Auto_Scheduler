export interface SlotPosition {
  day: string; // 'MON' | 'TUE' | 'WED' | 'THU' | 'FRI'
  slotId: number; // 1..8
}

export interface TheoryOption {
  slot: string;
  faculty: string;
}

export interface LabOption {
  slot: string;
  faculty: string;
}

export interface Course {
  code: string;
  title: string;
  basket: string;
  credits: number;
  theoryOptions: TheoryOption[];
  labOptions: LabOption[];
}

export interface CourseCatalog {
  [courseCode: string]: Course;
}

export interface ScheduledSection {
  courseCode: string;
  courseTitle: string;
  category: string;
  credits: number;
  theorySlot: string;
  theoryFaculty: string;
  labSlot: string;
  labFaculty: string;
}

export interface TimetableSchedule {
  id: number;
  sections: ScheduledSection[];
  totalCredits: number;
}

export interface DatasetStats {
  fileName: string;
  courseCount: number;
  facultyCount: number;
  slotsCount: number;
  categoriesCount: number;
  sheetName?: string;
}
