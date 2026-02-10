
import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { ProfessorUseCases, StudentUseCases, TestReleaseUseCases } from '../domain/usecases';
import { ProfessorRepositoryImpl, StudentRepositoryImpl, TestReleaseRepositoryImpl, TestRepositoryImpl } from '../data/repositories';
import { getSupabaseClient } from '../services/supabaseService';
import { Student, TestResult, TestRelease } from '../types';
import { User, Loader2, Hash, GraduationCap, Building2, AlertTriangle, RotateCcw, Eye, Users, FileText, Calendar, CheckCircle } from 'lucide-react';
import { useAppTranslation } from '../presentation/hooks/useAppTranslation';

interface ViewerProps {
  hasSupabase: boolean;
}

// Separate component for Teachers to view students WITHOUT having access to Edit/Delete logic code
const TeacherStudentViewer: React.FC<ViewerProps> = ({ hasSupabase }) => {
  const { t } = useAppTranslation();
  const [students, setStudents] = useState<Student[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [view, setView] = useState<'list' | 'detail'>('list');
  const [selectedStudent, setSelectedStudent] = useState<Student | null>(null);
  const [currentProfId, setCurrentProfId] = useState<string | null>(null);
  const [studentHistory, setStudentHistory] = useState<TestResult[]>([]);
  const [studentReleases, setStudentReleases] = useState<TestRelease[]>([]);
  const [loadingHistory, setLoadingHistory] = useState(false);

  const supabase = getSupabaseClient();
  const profUseCase = useMemo(() => supabase ? new ProfessorUseCases(new ProfessorRepositoryImpl(supabase)) : null, [supabase]);
  const studentUseCase = useMemo(() => supabase ? new StudentUseCases(new StudentRepositoryImpl(supabase), new TestRepositoryImpl(supabase)) : null, [supabase]);
  const releaseUseCase = useMemo(() => supabase ? new TestReleaseUseCases(new TestReleaseRepositoryImpl(supabase)) : null, [supabase]);

  // Fetch professor ID and load students
  useEffect(() => {
      const fetchProfIdAndStudents = async () => {
          if (!supabase || !profUseCase) return;
          setLoading(true);
          setError(null);
          try {
              const { data: { user } } = await supabase.auth.getUser();
              if (user) {
                  const { data: appUser } = await supabase.from('app_users').select('id').eq('auth_id', user.id).single();
                  if (appUser) {
                      const { data: prof } = await supabase.from('professors').select('id').eq('user_id', appUser.id).single();
                      if (prof) {
                          setCurrentProfId(prof.id);
                          // Fetch only students from classes this professor teaches
                          const profStudents = await profUseCase.getStudents(prof.id);
                          setStudents(profStudents);
                      }
                  }
              }
          } catch (err: any) {
              console.error("Error fetching professor students:", err);
              setError(err.message || "Failed to load students.");
          } finally {
              setLoading(false);
          }
      };
      if (hasSupabase) fetchProfIdAndStudents();
  }, [hasSupabase, supabase, profUseCase]);

  const refresh = useCallback(async () => {
      if (!supabase || !profUseCase || !currentProfId) return;
      setLoading(true);
      setError(null);
      try {
          const profStudents = await profUseCase.getStudents(currentProfId);
          setStudents(profStudents);
      } catch (err: any) {
          console.error("Error refreshing students:", err);
          setError(err.message || "Failed to refresh students.");
      } finally {
          setLoading(false);
      }
  }, [supabase, profUseCase, currentProfId]);

  if (!hasSupabase) return <div className="p-8 text-center text-slate-500 dark:text-slate-400">{t('errors.configureDatabase')}</div>;

  const loadStudentHistory = async (studentId: string) => {
      if (!studentUseCase || !releaseUseCase) return;
      setLoadingHistory(true);
      setStudentHistory([]);
      setStudentReleases([]);
      try {
          const [history, releases] = await Promise.all([
              studentUseCase.getStudentHistory(studentId),
              releaseUseCase.getReleasesByStudent(studentId)
          ]);
          setStudentHistory(history);
          setStudentReleases(releases);
      } catch(e: any) {
          console.error("Error fetching student details", e);
      } finally {
          setLoadingHistory(false);
      }
  };

  const handleViewDetails = async (student: Student) => {
      setSelectedStudent(student);
      setView('detail');
      await loadStudentHistory(student.id);
  };

  // Simplified Detail View
  if (view === 'detail' && selectedStudent) {
      // Filter results to only show those belonging to this professor
      const myResults = studentHistory.filter(r => 
          r.tests && (r.tests as any).professor_id === currentProfId
      );

      return (
          <div className="max-w-5xl mx-auto space-y-6">
              <button onClick={() => setView('list')} className="text-slate-500 dark:text-slate-400 hover:text-indigo-600 dark:hover:text-indigo-400 font-bold mb-4 flex items-center gap-2">{t('teacher.studentViewer.backToList')}</button>
              
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                  {/* Student Profile Card */}
                  <div className="md:col-span-1">
                      <div className="bg-white dark:bg-slate-800 p-6 rounded-xl border border-slate-200 dark:border-slate-700 shadow-sm flex flex-col items-center text-center">
                          <div className="w-24 h-24 bg-slate-100 dark:bg-slate-700 rounded-full flex items-center justify-center text-slate-400 dark:text-slate-500 overflow-hidden mb-4 border-4 border-white dark:border-slate-800 shadow-sm">
                              {selectedStudent.app_users?.profile_picture_url ? 
                                <img src={selectedStudent.app_users.profile_picture_url} className="w-full h-full object-cover"/> : 
                                <User size={48}/>
                              }
                          </div>
                          <h2 className="text-2xl font-bold text-slate-900 dark:text-slate-100">{selectedStudent.name}</h2>
                          <p className="text-slate-500 dark:text-slate-400 text-sm mb-4">{selectedStudent.app_users?.email}</p>
                          
                          <div className="w-full space-y-2">
                              <div className="flex justify-between items-center text-sm p-3 bg-slate-50 dark:bg-slate-700 rounded-lg">
                                  <span className="text-slate-500 dark:text-slate-400 flex items-center gap-2"><GraduationCap size={14}/> {t('teacher.studentViewer.grade')}</span>
                                  <span className="font-bold text-slate-700 dark:text-slate-300">{selectedStudent.school_grades?.name}</span>
                              </div>
                              <div className="flex justify-between items-center text-sm p-3 bg-slate-50 dark:bg-slate-700 rounded-lg">
                                  <span className="text-slate-500 dark:text-slate-400 flex items-center gap-2"><Users size={14}/> {t('teacher.studentViewer.class')}</span>
                                  <span className="font-bold text-slate-700 dark:text-slate-300">{selectedStudent.classes?.name || 'N/A'}</span>
                              </div>
                              <div className="flex justify-between items-center text-sm p-3 bg-slate-50 dark:bg-slate-700 rounded-lg">
                                  <span className="text-slate-500 dark:text-slate-400 flex items-center gap-2"><Hash size={14}/> {t('teacher.studentViewer.idHash')}</span>
                                  <span className="font-mono text-xs text-slate-600 dark:text-slate-400">{(selectedStudent.student_hash || '').substring(0, 8)}...</span>
                              </div>
                          </div>
                      </div>
                  </div>

                  {/* Performance History */}
                  <div className="md:col-span-2">
                      <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 shadow-sm overflow-hidden h-full flex flex-col">
                          <div className="p-6 border-b border-slate-100 dark:border-slate-700 bg-slate-50 dark:bg-slate-900">
                              <h3 className="font-bold text-lg text-slate-800 dark:text-slate-100 flex items-center gap-2">
                                  <FileText size={20} className="text-indigo-600 dark:text-indigo-400"/> 
                                  {t('teacher.studentViewer.testsTaken')}
                              </h3>
                          </div>
                          
                          <div className="flex-1 overflow-y-auto p-0">
                              {loadingHistory ? (
                                  <div className="p-12 text-center text-slate-400 dark:text-slate-500">
                                      <Loader2 className="animate-spin mx-auto mb-2" size={24}/> {t('teacher.studentViewer.loadingHistory')}
                                  </div>
                              ) : myResults.length === 0 ? (
                                  <div className="p-12 text-center text-slate-400 dark:text-slate-500 flex flex-col items-center">
                                      <FileText size={48} className="mb-3 opacity-20"/>
                                      <p>{t('teacher.studentViewer.noTestsRecorded')}</p>
                                  </div>
                              ) : (
                                  <table className="w-full text-left">
                                      <thead className="bg-slate-50 dark:bg-slate-900 border-b border-slate-100 dark:border-slate-700 text-xs font-bold text-slate-500 dark:text-slate-400 uppercase">
                                          <tr>
                                              <th className="px-6 py-3">{t('teacher.studentViewer.testTitle')}</th>
                                              <th className="px-6 py-3">{t('teacher.studentViewer.date')}</th>
                                              <th className="px-6 py-3 text-right">{t('teacher.studentViewer.score')}</th>
                                          </tr>
                                      </thead>
                                      <tbody className="divide-y divide-slate-100 dark:divide-slate-700">
                                          {myResults.map(res => (
                                              <tr key={res.id} className="hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors">
                                                  <td className="px-6 py-4">
                                                      <div className="font-bold text-slate-800 dark:text-slate-100 text-sm">{res.tests?.title}</div>
                                                  </td>
                                                  <td className="px-6 py-4">
                                                      <div className="flex items-center gap-2 text-sm text-slate-600 dark:text-slate-400">
                                                          <Calendar size={14} className="text-slate-400 dark:text-slate-500"/>
                                                          {new Date(res.correction_date || '').toLocaleDateString()}
                                                      </div>
                                                  </td>
                                                  <td className="px-6 py-4 text-right">
                                                      <span className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-sm font-bold ${res.score >= 70 ? 'bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-300' : 'bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-300'}`}>
                                                          {res.score}%
                                                      </span>
                                                  </td>
                                              </tr>
                                          ))}
                                      </tbody>
                                  </table>
                              )}
                          </div>
                      </div>
                  </div>
              </div>
          </div>
      );
  }

  // List View
  return (
    <div className="max-w-6xl mx-auto space-y-8">
      <div className="flex justify-between items-center">
          <div>
              <h2 className="text-3xl font-bold text-slate-900 dark:text-slate-100">{t('teacher.studentViewer.title')}</h2>
              <p className="text-slate-500 dark:text-slate-400 mt-1">{t('teacher.studentViewer.subtitle')}</p>
          </div>
      </div>

      {error && (
        <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-xl p-8 text-center">
            <AlertTriangle className="mx-auto text-red-500 dark:text-red-400 mb-4" size={48} />
            <p className="text-red-600 dark:text-red-300 mb-6">{error}</p>
            <button onClick={refresh} className="inline-flex items-center gap-2 px-4 py-2 bg-white dark:bg-slate-800 border border-red-200 dark:border-red-800 text-red-700 dark:text-red-300 rounded-lg hover:bg-red-100 dark:hover:bg-red-900/30 font-medium"><RotateCcw size={16}/> {t('common.refresh')}</button>
        </div>
      )}

      <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 overflow-hidden shadow-sm">
            <table className="w-full text-left">
            <thead className="bg-slate-50 dark:bg-slate-900 border-b border-slate-200 dark:border-slate-700">
                <tr>
                    <th className="p-4 text-sm font-bold text-slate-600 dark:text-slate-400 uppercase tracking-wider">{t('teacher.studentViewer.student')}</th>
                    <th className="p-4 text-sm font-bold text-slate-600 dark:text-slate-400 uppercase tracking-wider">{t('teacher.studentViewer.academicInfo')}</th>
                    <th className="p-4 text-sm font-bold text-slate-600 dark:text-slate-400 uppercase tracking-wider">{t('teacher.studentViewer.idHash')}</th>
                    <th className="p-4 text-sm font-bold text-slate-600 dark:text-slate-400 uppercase tracking-wider text-right">{t('teacher.studentViewer.actions')}</th>
                </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-700">
                {loading ? (
                    <tr><td colSpan={4} className="p-12 text-center text-slate-400 dark:text-slate-500"><Loader2 className="animate-spin inline mr-2"/> {t('teacher.studentViewer.loadingData')}</td></tr>
                ) : students.length === 0 ? (
                    <tr><td colSpan={4} className="p-12 text-center text-slate-400 dark:text-slate-500">{t('teacher.studentViewer.noStudentsFound')}</td></tr>
                ) : students.map(s => (
                    <tr key={s.id} onClick={() => handleViewDetails(s)} className="hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors cursor-pointer group">
                        <td className="p-4">
                            <div className="flex items-center gap-3">
                                <div className="w-8 h-8 rounded-full bg-slate-100 dark:bg-slate-700 flex items-center justify-center text-slate-500 dark:text-slate-400 overflow-hidden">
                                    {s.app_users?.profile_picture_url ? <img src={s.app_users.profile_picture_url} className="w-full h-full object-cover"/> : <User size={16}/>}
                                </div>
                                <div>
                                    <p className="font-bold text-slate-900 dark:text-slate-100 group-hover:text-indigo-600 dark:group-hover:text-indigo-400 transition-colors">{s.name}</p>
                                    <p className="text-xs text-slate-500 dark:text-slate-400">{s.app_users?.email}</p>
                                </div>
                            </div>
                        </td>
                        <td className="p-4">
                            <div className="space-y-1">
                                <span className="inline-flex gap-1 items-center bg-indigo-50 dark:bg-indigo-900/30 text-indigo-700 dark:text-indigo-300 px-2 py-0.5 rounded text-xs font-bold uppercase"><GraduationCap size={10}/> {s.school_grades?.name || t('teacher.studentViewer.unassigned')}</span>
                                {s.institutions && (
                                    <div className="flex items-center gap-1 text-xs text-slate-500 dark:text-slate-400">
                                        <Building2 size={12}/> {s.institutions.name}
                                    </div>
                                )}
                                {s.classes && (
                                    <div className="flex items-center gap-1 text-xs text-slate-500 dark:text-slate-400">
                                        <Users size={12}/> {s.classes.name}
                                    </div>
                                )}
                            </div>
                        </td>
                        <td className="p-4">
                            <div className="flex items-center gap-2 font-mono text-xs text-slate-600 dark:text-slate-300 bg-slate-100 dark:bg-slate-700 px-2 py-1 rounded w-fit border border-slate-200 dark:border-slate-600">
                                <Hash size={12} className="text-slate-400 dark:text-slate-500"/>
                                {(s.student_hash || '').substring(0, 16)}...
                            </div>
                        </td>
                        <td className="p-4 text-right">
                            <button onClick={(e) => { e.stopPropagation(); handleViewDetails(s); }} className="p-2 text-slate-400 dark:text-slate-500 hover:text-indigo-600 dark:hover:text-indigo-400 hover:bg-indigo-50 dark:hover:bg-indigo-900/30 rounded transition-all" title={t('teacher.studentViewer.viewProfile')}><Eye size={18}/></button>
                        </td>
                    </tr>
                ))}
            </tbody>
            </table>
        </div>
    </div>
  );
};

export default TeacherStudentViewer;
