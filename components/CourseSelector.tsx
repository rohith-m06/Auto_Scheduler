import React from 'react';
import { Course } from '../types';
import { BookOpen, Check } from 'lucide-react';

interface Props {
  courses: Course[];
  selectedCourses: Course[];
  onToggleCourse: (course: Course) => void;
}

export const CourseSelector: React.FC<Props> = ({ courses, selectedCourses, onToggleCourse }) => {
  return (
    <div className="space-y-4">
      <h2 className="text-xl font-bold text-slate-800 flex items-center gap-2">
        <BookOpen className="w-5 h-5 text-indigo-600" />
        Select Courses
      </h2>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        {courses.map(course => {
          const isSelected = selectedCourses.some(c => c.code === course.code);
          return (
            <div
              key={course.code}
              onClick={() => onToggleCourse(course)}
              className={`p-4 rounded-xl border-2 cursor-pointer transition-all duration-200 flex items-start justify-between group
                ${isSelected
                  ? 'border-indigo-600 bg-indigo-50 shadow-sm'
                  : 'border-slate-200 hover:border-indigo-300 hover:bg-white'
                }`}
            >
              <div>
                <div className="font-semibold text-slate-900">{course.code}</div>
                <div className="text-sm text-slate-600 mt-1">{course.title}</div>
                <div className="text-xs text-slate-500 mt-2 bg-slate-200 inline-block px-2 py-1 rounded">
                  {course.credits} Credits
                </div>
              </div>
              <div className={`w-6 h-6 rounded-full border-2 flex items-center justify-center transition-colors
                ${isSelected ? 'bg-indigo-600 border-indigo-600' : 'border-slate-300 group-hover:border-indigo-400'}`}>
                {isSelected && <Check className="w-3.5 h-3.5 text-white" />}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};
