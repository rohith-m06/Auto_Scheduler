import React from 'react';
import { Course } from '../types';
import { Users, Filter } from 'lucide-react';

interface Props {
  selectedCourses: Course[];
  preferences: { [courseCode: string]: string[] };
  onUpdatePreference: (courseCode: string, facultyName: string) => void;
}

export const FacultyPreferences: React.FC<Props> = ({ selectedCourses, preferences, onUpdatePreference }) => {
  if (selectedCourses.length === 0) return null;

  return (
    <div className="space-y-4 mt-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
      <h2 className="text-xl font-bold text-slate-800 flex items-center gap-2">
        <Users className="w-5 h-5 text-purple-600" />
        Faculty Preferences (Optional)
      </h2>
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm divide-y divide-slate-100">
        {selectedCourses.map(course => {
          // Get unique faculty-slot combinations for this course
          const facultyOptions = course.sections.reduce((acc, section) => {
            const existing = acc.find(opt => opt.name === section.faculty);
            if (existing) {
              if (!existing.slots.includes(section.theorySlot)) {
                existing.slots.push(section.theorySlot);
              }
            } else {
              acc.push({ name: section.faculty, slots: [section.theorySlot] });
            }
            return acc;
          }, [] as { name: string; slots: string[] }[]);

          const selectedForThis = preferences[course.code] || [];

          return (
            <div key={course.code} className="p-4">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-3">
                <div>
                  <h3 className="font-medium text-slate-900">{course.title}</h3>
                  <p className="text-sm text-slate-500">{facultyOptions.length} Faculty Options Available</p>
                </div>
                <div className="flex items-center gap-2 text-xs text-slate-400">
                    <Filter className="w-3 h-3" />
                    {selectedForThis.length === 0 ? "Any Faculty" : `${selectedForThis.length} Selected`}
                </div>
              </div>
              
              <div className="flex flex-wrap gap-2">
                {facultyOptions.map(option => {
                  const isActive = selectedForThis.includes(option.name);
                  return (
                    <button
                      key={option.name}
                      onClick={() => onUpdatePreference(course.code, option.name)}
                      className={`text-sm px-3 py-1.5 rounded-full border transition-all flex items-center gap-2
                        ${isActive 
                          ? 'bg-purple-100 text-purple-700 border-purple-200 font-medium' 
                          : 'bg-white text-slate-600 border-slate-200 hover:border-purple-200'
                        }`}
                    >
                      <span>{option.name}</span>
                      <span className={`text-[10px] px-1.5 py-0.5 rounded ${isActive ? 'bg-purple-200' : 'bg-slate-100'}`}>
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
