
import React, { useState, useRef, useMemo } from 'react';
import { useProfessorDetails } from '../presentation/hooks/useProfessorDetails';
import { useAppTranslation } from '../presentation/hooks/useAppTranslation';
import { User, Building2, Building, Mail, ArrowLeft, Loader2, AlertTriangle, BookOpen, GraduationCap, FileText, Calendar, Users, Camera, Plus, CheckCircle, Trash2, ChevronRight, Home } from 'lucide-react';

interface ProfessorDetailsProps {
  professorId: string;
  onBack: () => void;
  hasSupabase: boolean;
  // Navigation callbacks
  onViewClass?: (classId: string) => void;
  onViewStudent?: (studentId: string) => void;
  onViewGrade?: (gradeId: string) => void;
  onViewTest?: (testId: string) => void;
}

const ProfessorDetails: React.FC<ProfessorDetailsProps> = ({ professorId, onBack, hasSupabase, onViewClass, onViewStudent, onViewGrade, onViewTest }) => {
  const { t } = useAppTranslation();
  const { professor, assignedClasses, availableClasses, tests, disciplines, students, loading, error, uploadImage, assignClass, removeClass } = useProfessorDetails(professorId, hasSupabase);
  const [activeTab, setActiveTab] = useState<'classes' | 'tests' | 'disciplines' | 'students'>('classes');
  const [isUploading, setIsUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  
  const [showClassSelector, setShowClassSelector] = useState(false);
  const [selectedClassId, setSelectedClassId] = useState('');

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
      if (e.target.files && e.target.files[0] && professor) {
          setIsUploading(true);
          const file = e.target.files[0];
          await uploadImage(file);
          setIsUploading(false);
      }
  };

  // Filter available classes to exclude already assigned ones
  const assignableClasses = useMemo(() => {
      const assignedIds = assignedClasses.map(c => c.id);
      return availableClasses.filter(c => !assignedIds.includes(c.id));
  }, [availableClasses, assignedClasses]);

  const handleAssignClass = async () => {
      if (!selectedClassId) return;
      await assignClass(selectedClassId);
      setSelectedClassId('');
      setShowClassSelector(false);
  };

  const handleRemoveClass = async (classId: string) => {
      if (confirm(t('professor.details.removeFromClass'))) {
          await removeClass(classId);
      }
  };

  if (loading && !professor) {
      return <div className="flex flex-col items-center justify-center py-20 text-slate-400 dark:text-slate-500"><Loader2 className="animate-spin mb-4" size={40}/><p>{t('professor.details.loadingProfile')}</p></div>;
  }

  if (error) {
      return (
        <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-xl p-8 text-center">
            <AlertTriangle className="mx-auto text-red-500 dark:text-red-400 mb-4" size={48} />
            <h3 className="text-lg font-bold text-red-700 dark:text-red-300 mb-2">{t('professor.details.errorLoading')}</h3>
            <p className="text-red-600 dark:text-red-400 mb-6">{error}</p>
            <button onClick={onBack} className="text-slate-600 dark:text-slate-300 underline">{t('professor.details.goBack')}</button>
        </div>
      );
  }

  if (!professor) return null;

  const profilePic = professor.app_users?.profile_picture_url;

  return (
    <div className="space-y-8 animate-in fade-in slide-in-from-right-4 duration-300">

      {/* Header */}
      <div className="flex flex-col md:flex-row gap-6">
          <button onClick={onBack} className="p-2 h-fit hover:bg-slate-200 dark:hover:bg-slate-700 rounded-full transition-colors text-slate-500 dark:text-slate-400 self-start">
              <ArrowLeft size={24}/>
          </button>
          
          <div className="flex-1">
              <div className="bg-white dark:bg-slate-800 p-8 rounded-xl border border-slate-200 dark:border-slate-700 shadow-sm flex flex-col md:flex-row items-center md:items-start gap-6 relative overflow-hidden">
                  <div className="absolute top-0 right-0 w-32 h-32 bg-indigo-50 dark:bg-indigo-900/20 rounded-full -translate-y-1/2 translate-x-1/2 blur-2xl pointer-events-none"></div>
                  
                  <div className="relative group">
                      <div className="w-24 h-24 rounded-full bg-slate-100 dark:bg-slate-700 flex items-center justify-center border-4 border-white dark:border-slate-800 shadow-md text-slate-400 dark:text-slate-500 shrink-0 overflow-hidden cursor-pointer relative">
                          {isUploading ? (
                              <Loader2 className="animate-spin text-indigo-500" size={32} />
                          ) : profilePic ? (
                              <img src={profilePic} alt="Profile" className="w-full h-full object-cover" />
                          ) : (
                              <User size={48} />
                          )}
                          
                          {/* Hover Overlay */}
                          <div 
                            onClick={() => !isUploading && fileInputRef.current?.click()}
                            className="absolute inset-0 bg-black/40 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
                          >
                              <Camera size={24} className="text-white"/>
                          </div>
                      </div>
                      <input 
                        type="file" 
                        ref={fileInputRef} 
                        className="hidden" 
                        accept="image/*"
                        onChange={handleFileChange}
                      />
                  </div>
                  
                  <div className="flex-1 text-center md:text-left">
                      <h1 className="text-3xl font-bold text-slate-900 dark:text-slate-100">{professor.name}</h1>
                      <div className="flex flex-wrap items-center justify-center md:justify-start gap-4 mt-2 text-slate-600 dark:text-slate-300">
                          <span className="flex items-center gap-1.5"><Building size={16}/> {professor.department}</span>
                          <span className="flex items-center gap-1.5"><Building2 size={16}/> {professor.departments?.institutions?.name || "Unassigned"}</span>
                          <span className="flex items-center gap-1.5 text-indigo-600 dark:text-indigo-400"><Mail size={16}/> {professor.email}</span>
                      </div>
                  </div>

                  <div className="flex gap-4">
                      <div className="text-center px-4 py-2 bg-slate-50 dark:bg-slate-700 rounded-lg border border-slate-100 dark:border-slate-600">
                          {loading ? (
                              <Loader2 className="animate-spin text-slate-400 dark:text-slate-500 mx-auto" size={20}/>
                          ) : (
                              <div className="text-xl font-bold text-indigo-600 dark:text-indigo-400">{assignedClasses.length}</div>
                          )}
                          <div className="text-[10px] font-bold text-slate-400 dark:text-slate-400 uppercase tracking-wider">Classes</div>
                      </div>
                      <div className="text-center px-4 py-2 bg-slate-50 dark:bg-slate-700 rounded-lg border border-slate-100 dark:border-slate-600">
                          {loading ? (
                              <Loader2 className="animate-spin text-slate-400 dark:text-slate-500 mx-auto" size={20}/>
                          ) : (
                              <div className="text-xl font-bold text-emerald-600 dark:text-emerald-400">{tests.length}</div>
                          )}
                          <div className="text-[10px] font-bold text-slate-400 dark:text-slate-400 uppercase tracking-wider">Tests</div>
                      </div>
                      <div className="text-center px-4 py-2 bg-slate-50 dark:bg-slate-700 rounded-lg border border-slate-100 dark:border-slate-600">
                          {loading ? (
                              <Loader2 className="animate-spin text-slate-400 dark:text-slate-500 mx-auto" size={20}/>
                          ) : (
                              <div className="text-xl font-bold text-amber-600 dark:text-amber-400">{disciplines.length}</div>
                          )}
                          <div className="text-[10px] font-bold text-slate-400 dark:text-slate-400 uppercase tracking-wider">Subjects</div>
                      </div>
                  </div>
              </div>
          </div>
      </div>

      {/* Content Tabs */}
      <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 shadow-sm min-h-[500px] flex flex-col">
          <div className="border-b border-slate-100 dark:border-slate-700 flex px-6 overflow-x-auto">
              <button 
                onClick={() => setActiveTab('classes')}
                className={`py-4 px-6 font-medium text-sm border-b-2 transition-colors whitespace-nowrap ${activeTab === 'classes' ? 'border-indigo-600 dark:border-indigo-400 text-indigo-600 dark:text-indigo-400' : 'border-transparent text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200'}`}
              >
                  {t('professor.details.teachingSchedule')}
              </button>
              <button 
                onClick={() => setActiveTab('students')}
                className={`py-4 px-6 font-medium text-sm border-b-2 transition-colors whitespace-nowrap ${activeTab === 'students' ? 'border-indigo-600 dark:border-indigo-400 text-indigo-600 dark:text-indigo-400' : 'border-transparent text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200'}`}
              >
                  {t('professor.details.myStudents')} ({students.length})
              </button>
              <button 
                onClick={() => setActiveTab('disciplines')}
                className={`py-4 px-6 font-medium text-sm border-b-2 transition-colors whitespace-nowrap ${activeTab === 'disciplines' ? 'border-indigo-600 dark:border-indigo-400 text-indigo-600 dark:text-indigo-400' : 'border-transparent text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200'}`}
              >
                  {t('professor.details.curriculum')}
              </button>
              <button 
                onClick={() => setActiveTab('tests')}
                className={`py-4 px-6 font-medium text-sm border-b-2 transition-colors whitespace-nowrap ${activeTab === 'tests' ? 'border-indigo-600 dark:border-indigo-400 text-indigo-600 dark:text-indigo-400' : 'border-transparent text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200'}`}
              >
                  {t('professor.details.testArchive')}
              </button>
          </div>

          <div className="p-6 flex-1 bg-slate-50/30 dark:bg-slate-900/30">
              {activeTab === 'classes' && (
                  <div className="space-y-4">
                      {/* Add Class Logic */}
                      <div className="flex justify-between items-center mb-2">
                          <h3 className="font-bold text-slate-700 dark:text-slate-200">{t('professor.details.assignedClasses')}</h3>
                          {!showClassSelector && (
                              <button onClick={() => setShowClassSelector(true)} className="text-xs bg-indigo-50 dark:bg-indigo-900/30 text-indigo-600 dark:text-indigo-400 px-3 py-1.5 rounded-lg font-bold hover:bg-indigo-100 dark:hover:bg-indigo-900/50 flex items-center gap-1 transition-colors">
                                  <Plus size={14}/> {t('professor.details.assignToClass')}
                              </button>
                          )}
                      </div>

                      {showClassSelector && (
                          <div className="bg-indigo-50 dark:bg-indigo-900/20 p-4 rounded-lg border border-indigo-100 dark:border-indigo-800 flex items-center gap-3 animate-in fade-in slide-in-from-top-2">
                              <select 
                                  value={selectedClassId}
                                  onChange={e => setSelectedClassId(e.target.value)}
                                  className="flex-1 border border-indigo-200 dark:border-indigo-700 rounded px-3 py-2 text-sm text-slate-800 dark:text-slate-100 bg-white dark:bg-slate-700 outline-none"
                              >
                                  <option value="">{t('professor.details.selectClass')}</option>
                                  {assignableClasses.map(c => <option key={c.id} value={c.id}>{c.name} ({c.school_grades?.name})</option>)}
                              </select>
                              <button onClick={handleAssignClass} disabled={!selectedClassId} className="bg-indigo-600 dark:bg-indigo-500 text-white px-4 py-2 rounded font-bold text-sm hover:bg-indigo-700 dark:hover:bg-indigo-600 disabled:opacity-50">{t('professor.details.confirm')}</button>
                              <button onClick={() => setShowClassSelector(false)} className="text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200">{t('professor.details.cancel')}</button>
                          </div>
                      )}

                      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                          {assignedClasses.length === 0 ? <div className="col-span-full text-center py-12 text-slate-400 dark:text-slate-500">{t('professor.details.noClassesAssigned')}</div> : assignedClasses.map(c => (
                              <div 
                                key={c.id} 
                                onClick={() => onViewClass?.(c.id)}
                                className={`bg-white dark:bg-slate-800 p-5 rounded-lg border border-slate-200 dark:border-slate-700 shadow-sm hover:border-indigo-200 dark:hover:border-indigo-600 transition-colors group relative ${onViewClass ? 'cursor-pointer' : ''}`}
                              >
                                  <h4 className={`font-bold text-slate-800 dark:text-slate-100 mb-1 ${onViewClass ? 'group-hover:text-indigo-600 dark:group-hover:text-indigo-400 transition-colors' : ''}`}>{c.name}</h4>
                                  <div className="flex flex-col gap-1 text-sm text-slate-500 dark:text-slate-400">
                                      <span 
                                        onClick={(e) => { e.stopPropagation(); c.grade_id && onViewGrade?.(c.grade_id); }}
                                        className={`flex items-center gap-2 ${onViewGrade && c.grade_id ? 'cursor-pointer hover:text-indigo-600 dark:hover:text-indigo-400' : ''}`}
                                      >
                                        <GraduationCap size={14}/> {c.school_grades?.name}
                                      </span>
                                      <span className="flex items-center gap-2"><Building2 size={14}/> {c.institutions?.name}</span>
                                  </div>
                                  <button 
                                      onClick={(e) => { e.stopPropagation(); handleRemoveClass(c.id); }} 
                                      className="absolute top-3 right-3 text-slate-300 dark:text-slate-600 hover:text-red-500 dark:hover:text-red-400 opacity-0 group-hover:opacity-100 transition-all p-1.5 rounded hover:bg-red-50 dark:hover:bg-red-900/30"
                                      title="Unassign Class"
                                  >
                                      <Trash2 size={16}/>
                                  </button>
                              </div>
                          ))}
                      </div>
                  </div>
              )}

              {activeTab === 'students' && (
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                      {students.length === 0 ? (
                          <div className="col-span-full text-center py-12 text-slate-400 dark:text-slate-500 flex flex-col items-center">
                              <Users size={48} className="mb-2 opacity-20"/>
                              <p>{t('professor.details.noStudentsEnrolled')}</p>
                          </div>
                      ) : students.map(s => (
                          <div 
                            key={s.id} 
                            onClick={() => onViewStudent?.(s.id)}
                            className={`bg-white dark:bg-slate-800 p-4 rounded-lg border border-slate-200 dark:border-slate-700 shadow-sm hover:border-indigo-200 dark:hover:border-indigo-600 transition-colors flex items-center gap-4 ${onViewStudent ? 'cursor-pointer group' : ''}`}
                          >
                              <div className="w-10 h-10 rounded-full bg-slate-100 dark:bg-slate-700 flex items-center justify-center text-slate-500 dark:text-slate-400 overflow-hidden">
                                  {s.app_users?.profile_picture_url ? <img src={s.app_users.profile_picture_url} className="w-full h-full object-cover"/> : <User size={20}/>}
                              </div>
                              <div className="overflow-hidden">
                                  <h4 className={`font-bold text-slate-800 dark:text-slate-100 truncate ${onViewStudent ? 'group-hover:text-indigo-600 dark:group-hover:text-indigo-400 transition-colors' : ''}`}>{s.name}</h4>
                                  <div className="flex gap-2 mt-1">
                                      <span className="text-[10px] bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300 px-1.5 py-0.5 rounded flex items-center gap-1">
                                          <Users size={10}/> {s.classes?.name || 'No Class'}
                                      </span>
                                      <span className="text-[10px] bg-indigo-50 dark:bg-indigo-900/30 text-indigo-600 dark:text-indigo-400 px-1.5 py-0.5 rounded flex items-center gap-1">
                                          <GraduationCap size={10}/> {s.school_grades?.name}
                                      </span>
                                  </div>
                                  <p className="text-xs text-slate-400 dark:text-slate-500 truncate mt-1 font-mono">{(s.student_hash || '').substring(0, 12)}...</p>
                              </div>
                          </div>
                      ))}
                  </div>
              )}

              {activeTab === 'disciplines' && (
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                      {disciplines.length === 0 ? <div className="col-span-full text-center py-12 text-slate-400 dark:text-slate-500">{t('professor.details.noDisciplinesAssigned')}</div> : disciplines.map(d => (
                          <div 
                            key={d.id} 
                            onClick={() => d.grade_id && onViewGrade?.(d.grade_id)}
                            className={`bg-white dark:bg-slate-800 p-5 rounded-lg border border-slate-200 dark:border-slate-700 shadow-sm flex items-start gap-3 hover:border-indigo-200 dark:hover:border-indigo-600 transition-colors ${onViewGrade && d.grade_id ? 'cursor-pointer group' : ''}`}
                          >
                              <div className="p-2 bg-amber-50 dark:bg-amber-900/30 text-amber-600 dark:text-amber-400 rounded-lg">
                                  <BookOpen size={20}/>
                              </div>
                              <div>
                                  <h4 className="font-bold text-slate-800 dark:text-slate-100">{d.name}</h4>
                                  <p className={`text-xs text-slate-500 dark:text-slate-400 mt-1 ${onViewGrade ? 'group-hover:text-indigo-600 dark:group-hover:text-indigo-400 transition-colors' : ''}`}>{d.school_grades?.name}</p>
                                  {d.description && <p className="text-xs text-slate-400 dark:text-slate-500 mt-2 line-clamp-2">{d.description}</p>}
                              </div>
                          </div>
                      ))}
                  </div>
              )}

              {activeTab === 'tests' && (
                  <div className="space-y-3">
                      {tests.length === 0 ? <div className="text-center py-12 text-slate-400 dark:text-slate-500">{t('professor.details.noTestsCreated')}</div> : tests.map(test => (
                          <div 
                            key={test.id} 
                            onClick={() => onViewTest?.(test.id)}
                            className={`bg-white dark:bg-slate-800 p-4 rounded-lg border border-slate-200 dark:border-slate-700 shadow-sm flex items-center justify-between hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors ${onViewTest ? 'cursor-pointer group' : ''}`}
                          >
                              <div>
                                  <h4 className={`font-bold text-slate-800 dark:text-slate-100 ${onViewTest ? 'group-hover:text-indigo-600 dark:group-hover:text-indigo-400 transition-colors' : ''}`}>{test.title}</h4>
                                  <div className="flex items-center gap-3 text-xs text-slate-500 dark:text-slate-400 mt-1">
                                      <span 
                                        onClick={(e) => { e.stopPropagation(); test.grade_id && onViewGrade?.(test.grade_id); }}
                                        className={`bg-slate-100 dark:bg-slate-700 text-slate-700 dark:text-slate-300 px-2 py-0.5 rounded uppercase tracking-wider font-bold ${onViewGrade && test.grade_id ? 'cursor-pointer hover:bg-indigo-100 dark:hover:bg-indigo-900/30 hover:text-indigo-700 dark:hover:text-indigo-400' : ''}`}
                                      >
                                        {test.school_grades?.name}
                                      </span>
                                      <span className="flex items-center gap-1"><Calendar size={12}/> {new Date(test.created_at || '').toLocaleDateString()}</span>
                                  </div>
                              </div>
                              <div className="text-right">
                                  <button onClick={(e) => { e.stopPropagation(); onViewTest?.(test.id); }} className="text-indigo-600 dark:text-indigo-400 text-sm font-bold hover:underline">{t('professor.details.viewTest')}</button>
                              </div>
                          </div>
                      ))}
                  </div>
              )}
          </div>
      </div>
    </div>
  );
};

export default ProfessorDetails;
