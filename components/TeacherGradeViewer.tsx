
import React, { useState } from 'react';
import { useSettingsManager } from '../presentation/hooks/useSettingsManager';
import { SchoolGrade } from '../types';
import { Loader2, Building2, AlertTriangle, RotateCcw, GraduationCap, BookOpen, Eye } from 'lucide-react';
import GradeDetails from './GradeDetails';
import { useAppTranslation } from '../presentation/hooks/useAppTranslation';

interface ViewerProps {
  hasSupabase: boolean;
}

const TeacherGradeViewer: React.FC<ViewerProps> = ({ hasSupabase }) => {
  const { t } = useAppTranslation();
  const { grades, institutions, loading, error, refresh } = useSettingsManager(hasSupabase);
  const [selectedGrade, setSelectedGrade] = useState<SchoolGrade | null>(null);

  // The hook now handles filtering for Teachers automatically.
  // We can assume 'grades' contains only the relevant data.
  // 'institutions' will contain the single institution the teacher belongs to.
  const myInstitution = institutions.length > 0 ? institutions[0] : null;

  if (!hasSupabase) return <div className="p-8 text-center text-slate-500 dark:text-slate-400">{t('errors.configureDatabase')}</div>;

  if (selectedGrade) {
      return (
          <GradeDetails 
            grade={selectedGrade} 
            onBack={() => setSelectedGrade(null)} 
            hasSupabase={hasSupabase}
            readOnly={true} // View-only mode for grades/disciplines structure
            allowLibraryEdit={true} // Explicitly allow library content management for teachers
          />
      );
  }

  return (
    <div className="max-w-6xl mx-auto space-y-8 animate-in fade-in slide-in-from-right-4 duration-300">
        <div>
            <h2 className="text-3xl font-bold text-slate-900 dark:text-slate-100">{t('teacher.gradeViewer.title')}</h2>
            <p className="text-slate-500 dark:text-slate-400 mt-1">{t('teacher.gradeViewer.subtitle')}</p>
        </div>

        {error && (
            <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-xl p-4 flex gap-3 text-red-700 dark:text-red-300 items-center">
                <AlertTriangle size={20}/> {error}
            </div>
        )}

        {myInstitution && (
            <div className="bg-indigo-50 dark:bg-indigo-900/20 p-6 rounded-xl border border-indigo-100 dark:border-indigo-800 flex items-center gap-4">
                <div className="p-3 bg-white dark:bg-slate-800 rounded-full shadow-sm text-indigo-600 dark:text-indigo-400">
                    <Building2 size={24} />
                </div>
                <div>
                    <h4 className="font-bold text-indigo-900 dark:text-indigo-200">{t('teacher.gradeViewer.institutionContext')}</h4>
                    <p className="text-indigo-700 dark:text-indigo-300 text-sm">{myInstitution.name} ({myInstitution.type || myInstitution.institution_types?.name})</p>
                </div>
            </div>
        )}

        <div className="space-y-3">
            <div className="flex justify-between items-center px-1">
                <h3 className="font-bold text-slate-700 dark:text-slate-300">{t('teacher.gradeViewer.academicGrades')}</h3>
                <div className="flex items-center gap-2">
                    <span className="text-xs bg-slate-100 dark:bg-slate-700 px-2 py-1 rounded text-slate-500 dark:text-slate-400">{grades.length} {t('teacher.gradeViewer.records')}</span>
                    <button onClick={refresh} className="p-1 hover:bg-slate-200 dark:hover:bg-slate-600 rounded text-slate-500 dark:text-slate-400"><RotateCcw size={16}/></button>
                </div>
            </div>
            
            {loading && <div className="text-center py-8 text-slate-400 dark:text-slate-500"><Loader2 className="animate-spin mx-auto mb-2"/> {t('teacher.gradeViewer.loading')}</div>}
            
            {!loading && grades.length === 0 && (
                <div className="text-center py-12 bg-slate-50 dark:bg-slate-800 rounded-xl border-2 border-dashed border-slate-200 dark:border-slate-700">
                    <p className="text-slate-500 dark:text-slate-400 font-medium">{t('teacher.gradeViewer.noGradesFound')}</p>
                </div>
            )}
            
            {!loading && grades.map(g => (
                <div 
                    key={g.id} 
                    onClick={() => setSelectedGrade(g)}
                    className="flex flex-col p-4 border border-slate-200 dark:border-slate-700 rounded-xl hover:shadow-md transition-all bg-white dark:bg-slate-800 group gap-3 hover:border-indigo-200 dark:hover:border-indigo-700 cursor-pointer"
                >
                    <div className="flex items-center">
                        <div className="w-10 h-10 rounded-lg bg-indigo-50 dark:bg-indigo-900/30 text-indigo-600 dark:text-indigo-400 flex items-center justify-center font-bold text-lg mr-3 border border-indigo-100 dark:border-indigo-800 shadow-sm shrink-0">
                            {g.level}
                        </div>
                        <div className="flex-1">
                            <h4 className="font-bold text-slate-900 dark:text-slate-100">{g.name}</h4>
                            {g.description && <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5 line-clamp-1">{g.description}</p>}
                        </div>
                        <div className="opacity-0 group-hover:opacity-100 transition-opacity p-2 text-indigo-600 dark:text-indigo-400 bg-indigo-50 dark:bg-indigo-900/30 rounded-full">
                            <Eye size={18}/>
                        </div>
                    </div>
                    
                    {/* Linked Disciplines Pills */}
                    <div className="pl-14">
                        <div className="flex flex-wrap gap-1.5">
                            {g.disciplines && g.disciplines.length > 0 ? (
                                g.disciplines.map(d => (
                                    <span key={d.id} className="inline-flex items-center gap-1 bg-slate-50 dark:bg-slate-700 border border-slate-200 dark:border-slate-600 text-slate-600 dark:text-slate-300 px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider">
                                        <BookOpen size={10}/> {d.name}
                                    </span>
                                ))
                            ) : (
                                <span className="text-[10px] text-slate-400 dark:text-slate-500 italic">{t('teacher.gradeViewer.noDisciplinesLinked')}</span>
                            )}
                        </div>
                    </div>
                </div>
            ))}
        </div>
    </div>
  );
};

export default TeacherGradeViewer;
