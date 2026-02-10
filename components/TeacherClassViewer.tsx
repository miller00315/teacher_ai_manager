
import React, { useState } from 'react';
import { useClassManager } from '../presentation/hooks/useClassManager';
import { SchoolClass } from '../types';
import { Users, Loader2, BookOpen, AlertTriangle, RotateCcw, Building2, Eye } from 'lucide-react';
import ClassDetails from './ClassDetails';
import StudentManager from './StudentManager';
import ProfessorManager from './ProfessorManager';
import GradeManager from './GradeManager';
import TestManager from './TestManager';
import { useAppTranslation } from '../presentation/hooks/useAppTranslation';

interface ViewerProps {
  hasSupabase: boolean;
}

const TeacherClassViewer: React.FC<ViewerProps> = ({ hasSupabase }) => {
  const { t } = useAppTranslation();
  const { classes, loading, error, refresh } = useClassManager(hasSupabase);
  const [view, setView] = useState<'list' | 'detail' | 'student' | 'professor' | 'grade' | 'test'>('list');
  const [selectedClassId, setSelectedClassId] = useState<string | null>(null);
  
  // Navigation IDs for drill-down views
  const [selectedStudentId, setSelectedStudentId] = useState<string | null>(null);
  const [selectedProfessorId, setSelectedProfessorId] = useState<string | null>(null);
  const [selectedGradeId, setSelectedGradeId] = useState<string | null>(null);
  const [selectedTestId, setSelectedTestId] = useState<string | null>(null);
  
  // Navigation handlers
  const handleViewStudent = (studentId: string) => {
    setSelectedStudentId(studentId);
    setView('student');
  };
  
  const handleViewProfessor = (professorId: string) => {
    setSelectedProfessorId(professorId);
    setView('professor');
  };
  
  const handleViewGrade = (gradeId: string) => {
    setSelectedGradeId(gradeId);
    setView('grade');
  };
  
  const handleViewTest = (testId: string) => {
    setSelectedTestId(testId);
    setView('test');
  };
  
  const handleBackToClass = () => {
    setView('detail');
    setSelectedStudentId(null);
    setSelectedProfessorId(null);
    setSelectedGradeId(null);
    setSelectedTestId(null);
  };

  if (!hasSupabase) return <div className="p-8 text-center text-slate-500 dark:text-slate-400">{t('errors.configureDatabase')}</div>;

  // Render drill-down views
  if (view === 'student' && selectedStudentId) {
      return (
        <StudentManager 
          hasSupabase={hasSupabase} 
          initialStudentId={selectedStudentId}
          onBack={handleBackToClass}
          readOnly
        />
      );
  }

  if (view === 'professor' && selectedProfessorId) {
      return (
        <ProfessorManager 
          hasSupabase={hasSupabase} 
          initialProfessorId={selectedProfessorId}
          onBack={handleBackToClass}
        />
      );
  }

  if (view === 'grade' && selectedGradeId) {
      return (
        <GradeManager 
          hasSupabase={hasSupabase} 
          initialGradeId={selectedGradeId}
          onBack={handleBackToClass}
          readOnly
        />
      );
  }

  if (view === 'test' && selectedTestId) {
      return (
        <TestManager 
          hasSupabase={hasSupabase}
          initialTestId={selectedTestId}
          onBack={handleBackToClass}
        />
      );
  }

  if (view === 'detail' && selectedClassId) {
      return (
        <ClassDetails 
          classId={selectedClassId} 
          hasSupabase={hasSupabase} 
          onBack={() => { setView('list'); setSelectedClassId(null); }}
          onViewStudent={handleViewStudent}
          onViewProfessor={handleViewProfessor}
          onViewGrade={handleViewGrade}
          onViewTest={handleViewTest}
        />
      );
  }

  return (
    <div className="max-w-5xl mx-auto space-y-8">
      <div>
          <h2 className="text-3xl font-bold text-slate-900 dark:text-slate-100">{t('teacher.classViewer.title')}</h2>
          <p className="text-slate-500 dark:text-slate-400 mt-1">{t('teacher.classViewer.subtitle')}</p>
      </div>

      {error ? (
        <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-xl p-8 text-center">
            <AlertTriangle className="mx-auto text-red-500 dark:text-red-400 mb-4" size={48} />
            <p className="text-red-600 dark:text-red-300 mb-6">{error}</p>
            <button onClick={refresh} className="inline-flex items-center gap-2 px-4 py-2 bg-white dark:bg-slate-800 border border-red-200 dark:border-red-800 text-red-700 dark:text-red-300 rounded-lg hover:bg-red-100 dark:hover:bg-red-900/30 font-medium">
                <RotateCcw size={16}/> {t('teacher.classViewer.retry')}
            </button>
        </div>
      ) : (
        <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 overflow-hidden shadow-sm">
            <table className="w-full text-left">
            <thead className="bg-slate-50 dark:bg-slate-900 border-b border-slate-200 dark:border-slate-700">
                <tr>
                    <th className="p-4 text-sm font-bold text-slate-600 dark:text-slate-400 uppercase tracking-wider">{t('teacher.classViewer.className')}</th>
                    <th className="p-4 text-sm font-bold text-slate-600 dark:text-slate-400 uppercase tracking-wider">{t('teacher.classViewer.grade')}</th>
                    <th className="p-4 text-sm font-bold text-slate-600 dark:text-slate-400 uppercase tracking-wider">{t('teacher.classViewer.institution')}</th>
                    <th className="p-4 text-sm font-bold text-slate-600 dark:text-slate-400 uppercase tracking-wider text-right">{t('teacher.classViewer.actions')}</th>
                </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-700">
                {loading ? (
                    <tr><td colSpan={4} className="p-12 text-center text-slate-400 dark:text-slate-500"><Loader2 className="animate-spin inline mr-2"/> {t('teacher.classViewer.loadingData')}</td></tr>
                ) : classes.length === 0 ? (
                    <tr><td colSpan={4} className="p-12 text-center text-slate-400 dark:text-slate-500">{t('teacher.classViewer.noClassesFound')}</td></tr>
                ) : classes.map(c => (
                    <tr key={c.id} onClick={() => { setSelectedClassId(c.id); setView('detail'); }} className="hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors cursor-pointer group">
                        <td className="p-4 font-bold text-slate-900 dark:text-slate-100">{c.name}</td>
                        <td className="p-4 text-slate-600 dark:text-slate-300"><span className="inline-flex items-center gap-1 bg-indigo-50 dark:bg-indigo-900/30 text-indigo-700 dark:text-indigo-300 px-2 py-1 rounded text-xs font-bold uppercase"><BookOpen size={12}/> {c.school_grades?.name || t('teacher.studentViewer.unassigned')}</span></td>
                        <td className="p-4 text-slate-600 dark:text-slate-300"><span className="inline-flex items-center gap-1"><Building2 size={14}/> {c.institutions?.name}</span></td>
                        <td className="p-4 text-right">
                            <button className="p-2 text-slate-400 dark:text-slate-500 hover:text-indigo-600 dark:hover:text-indigo-400 hover:bg-indigo-50 dark:hover:bg-indigo-900/30 rounded transition-all" title={t('teacher.classViewer.view')}><Eye size={18}/></button>
                        </td>
                    </tr>
                ))}
            </tbody>
            </table>
        </div>
      )}
    </div>
  );
};

export default TeacherClassViewer;
