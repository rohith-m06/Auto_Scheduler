import React from 'react';
import { Course } from '../types';
import { FlaskConical, Filter } from 'lucide-react';

interface Props {
  selectedCourses: Course[];
  labPreferences: { [courseCode: string]: string[] };
  onUpdateLabPreference: (courseCode: string, faculty: string) => void;
}

export const LabSlotPreferences: React.FC<Props> = ({ selectedCourses, labPreferences, onUpdateLabPreference }) => {
  // Filter courses that have lab sections and get unique lab info
  const coursesWithLabs = selectedCourses.map(course => {
    // Get unique faculty-labslot combinations for this course
    const labOptions = course.sections.reduce((acc, section) => {
      if (section.labSlot) {
        const facultyName = section.labFaculty || section.faculty;
        const existing = acc.find(opt => opt.name === facultyName);
        if (existing) {
          if (!existing.slots.includes(section.labSlot)) {
            existing.slots.push(section.labSlot);
          }
        } else {
          acc.push({ name: facultyName, slots: [section.labSlot] });
        }
      }
      return acc;
    }, [] as { name: string; slots: string[] }[]);

    return {
      course,
      labOptions: labOptions.sort((a, b) => a.name.localeCompare(b.name))
    };
  }).filter(c => c.labOptions.length > 0);

  if (coursesWithLabs.length === 0) return null;

  return (
    <div className="space-y-4 mt-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
      <h2 className="text-xl font-bold text-slate-800 flex items-center gap-2">
        <FlaskConical className="w-5 h-5 text-emerald-600" />
        Lab Faculty Preferences (Optional)
      </h2>
      <p className="text-sm text-slate-500">
        Select preferred lab faculty for each course. Leave empty to consider all available lab faculty.
      </p>
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm divide-y divide-slate-100">
        {coursesWithLabs.map(({ course, labOptions }) => {
          const selectedForThis = labPreferences[course.code] || [];

          return (
            <div key={course.code} className="p-4">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-3">
                <div>
                  <h3 className="font-medium text-slate-900">{course.title}</h3>
                  <p className="text-sm text-slate-500">{labOptions.length} Lab Options Available</p>
                </div>
                <div className="flex items-center gap-2 text-xs text-slate-400">
                  <Filter className="w-3 h-3" />
                  {selectedForThis.length === 0 ? "Any Lab Faculty" : `${selectedForThis.length} Selected`}
                </div>
              </div>
              
              <div className="flex flex-wrap gap-2">
                {labOptions.map(option => {
                  const isActive = selectedForThis.includes(option.name);
                  return (
                    <button
                      key={option.name}
                      onClick={() => onUpdateLabPreference(course.code, option.name)}
                      className={`text-sm px-3 py-1.5 rounded-full border transition-all flex items-center gap-2
                        ${isActive 
                          ? 'bg-emerald-100 text-emerald-700 border-emerald-200 font-medium' 
                          : 'bg-white text-slate-600 border-slate-200 hover:border-emerald-200'
                        }`}
                    >
                      <span>{option.name}</span>
                      <span className={`text-[10px] px-1.5 py-0.5 rounded ${isActive ? 'bg-emerald-200' : 'bg-slate-100'}`}>
                        {option.slots.join(', ')}
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};
