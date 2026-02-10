
import React, { useState, useRef, useEffect, useMemo } from 'react';
import { useTestCorrection } from '../presentation/hooks/useTestCorrection';
import { useStudentManager } from '../presentation/hooks/useStudentManager';
import { useProfessorReleases } from '../presentation/hooks/useProfessorReleases';
import { useAppTranslation } from '../presentation/hooks/useAppTranslation';
import { Camera, Upload, ScanLine, Loader2, CheckCircle, XCircle, AlertTriangle, Save, RotateCcw, UserCheck, Hash, Image as ImageIcon, Calendar, Clock, BookOpen, User, Globe2, MapPin, Bot, CheckCircle2 } from 'lucide-react';
import { Student } from '../types';

interface TestCorrectionProps {
  hasSupabase: boolean;
  onViewTest?: (testId: string) => void;
  onViewStudent?: (studentId: string) => void;
}

const TestCorrection: React.FC<TestCorrectionProps> = ({ hasSupabase, onViewTest, onViewStudent }) => {
  const { t } = useAppTranslation();
  const { 
      analyzing, saving, resultData, error, savedSuccess, 
      analyzeImage, saveResults, reset 
  } = useTestCorrection(hasSupabase);
  
  const { students, refresh: refreshStudents } = useStudentManager(hasSupabase);
  const { tests, releases, allReleases, loading: releasesLoading, loadingReleases, loadingTests, error: releasesError, professorId, professorIdLoading, refreshReleases } = useProfessorReleases(hasSupabase);
  
  const [image, setImage] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [selectedStudentId, setSelectedStudentId] = useState<string>('');
  const [selectedTestId, setSelectedTestId] = useState<string>('');
  const [selectedReleaseId, setSelectedReleaseId] = useState<string>('');
  
  // Pagination state
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 20;
  
  // Calculate pagination - usar allReleases para calcular total, mas mostrar apenas releases (já paginadas)
  const totalPages = Math.ceil((allReleases?.length || 0) / itemsPerPage);
  const startIndex = (currentPage - 1) * itemsPerPage;
  const endIndex = startIndex + itemsPerPage;
  
  // Paginated releases from allReleases
  const paginatedReleases = useMemo(() => {
      if (!allReleases || allReleases.length === 0) return [];
      return allReleases.slice(startIndex, endIndex);
  }, [allReleases, startIndex, endIndex]);
  
  useEffect(() => {
    if (resultData && students.length > 0) {
        const detectedName = resultData.analysis.student_name.toLowerCase();
        const match = students.find(s => s.name.toLowerCase().includes(detectedName) || detectedName.includes(s.name.toLowerCase()));
        if (match) {
            setSelectedStudentId(match.id);
        } else {
            setSelectedStudentId('');
        }
    }
  }, [resultData, students]);

  useEffect(() => {
      if (hasSupabase && students.length === 0) refreshStudents();
  }, [hasSupabase]);

  const processFile = (file: File) => {
    const reader = new FileReader();
    reader.onloadend = () => {
        setImage(reader.result as string);
        reset();
        setSelectedStudentId('');
    };
    reader.readAsDataURL(file);
  };

  const onDragOver = (e: React.DragEvent) => { e.preventDefault(); setIsDragging(true); };
  const onDragLeave = () => setIsDragging(false);
  const onDrop = (e: React.DragEvent) => {
      e.preventDefault();
      setIsDragging(false);
      const file = e.dataTransfer.files?.[0];
      if (file) processFile(file);
  };

  const handleAnalyze = () => {
      if (image) {
          if (!selectedTestId) {
              alert(t('testCorrection.selectTestFirst'));
              return;
          }
          if (!selectedReleaseId) {
              alert(t('testCorrection.selectReleaseFirst'));
              return;
          }
          // Extrair base64 da imagem (remover data:image/...;base64, se presente)
          const base64Data = image.includes(',') ? image.split(',')[1] : image;
          if (!base64Data) {
              alert(t('testCorrection.invalidImage'));
              return;
          }
          analyzeImage(base64Data, selectedReleaseId);
      }
  };

  const handleTestChange = (testId: string) => {
      setSelectedTestId(testId);
      setSelectedReleaseId(''); // Limpar seleção de release quando mudar a prova
      reset();
      setImage(null);
      setSelectedStudentId('');
      setCurrentPage(1); // Reset pagination
      // Buscar liberações apenas se uma prova foi selecionada
      if (testId && testId.trim() !== '') {
          refreshReleases(testId);
      } else {
          // Limpar liberações se nenhuma prova estiver selecionada
          refreshReleases(undefined);
      }
  };

  const handlePageChange = (page: number) => {
      if (page < 1 || page > totalPages) return;
      setCurrentPage(page);
  };
  
  // Reset page when test changes
  useEffect(() => {
    setCurrentPage(1);
  }, [selectedTestId]);

  const handleSaveWithStudent = () => {
      const student = students.find(s => s.id === selectedStudentId);
      saveResults({
          student_id: student?.id,
          student_hash: student?.student_hash
      });
  };

  if (!hasSupabase) return <div className="p-8 text-center text-slate-500 dark:text-slate-400">{t('testCorrection.configureDb')}</div>;

  const formatReleaseLabel = (release: any) => {
    const testTitle = release.tests?.title || t('testCorrection.unknownTest');
    const startDate = new Date(release.start_time).toLocaleDateString();
    const endDate = new Date(release.end_time).toLocaleDateString();
    return `${testTitle} (${startDate} - ${endDate})`;
  };

  // Encontrar a liberação selecionada
  const selectedRelease = useMemo(() => {
    if (!selectedReleaseId || !allReleases) return null;
    const release = allReleases.find(r => r.id === selectedReleaseId);
    return release;
  }, [selectedReleaseId, allReleases]);

  return (
      <div className="max-w-6xl mx-auto space-y-8 p-6">
         <div className="flex justify-between items-center">
             <div>
                <h2 className="text-3xl font-bold text-slate-900 dark:text-slate-100">{t('testCorrection.title')}</h2>
                <p className="text-slate-500 dark:text-slate-400 mt-1">{t('testCorrection.subtitle')}</p>
             </div>
             {savedSuccess && (
                 <button onClick={reset} className="bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-600 text-slate-700 dark:text-slate-200 px-4 py-2 rounded-lg font-bold flex items-center gap-2 hover:bg-slate-50 dark:hover:bg-slate-700 transition-all">
                     <RotateCcw size={18}/> {t('testCorrection.gradeAnother')}
                 </button>
             )}
         </div>

         {/* Error Display */}
         {releasesError && (
             <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-xl p-4 flex items-center gap-3 text-red-700 dark:text-red-300">
                 <AlertTriangle size={20}/>
                 <span>{t(releasesError)}</span>
             </div>
         )}

         {/* Test Selection */}
         <div className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl p-6 shadow-sm">
             <h3 className="text-lg font-bold text-slate-900 dark:text-slate-100 mb-4 flex items-center gap-2">
                 <BookOpen size={20} className="text-indigo-600 dark:text-indigo-400"/>
                 {t('testCorrection.selectTest')}
             </h3>
             
             {loadingTests || professorIdLoading ? (
                 <div className="flex items-center justify-center gap-2 text-slate-500 dark:text-slate-400 py-4">
                     <Loader2 className="animate-spin" size={20}/>
                     <span>{t('testCorrection.loadingTests')}</span>
                 </div>
             ) : !professorId ? (
                 <div className="py-4">
                     <p className="text-sm text-slate-500 dark:text-slate-400 text-center">{t('testCorrection.noProfessorFound')}</p>
                 </div>
             ) : tests.length === 0 ? (
                 <div className="py-4">
                     <p className="text-sm text-slate-500 dark:text-slate-400 text-center">{t('testCorrection.noTestsFound')}</p>
                 </div>
             ) : (
                 <div className="flex gap-2">
                     <select
                         value={selectedTestId}
                         onChange={(e) => handleTestChange(e.target.value)}
                         className="flex-1 border border-slate-300 dark:border-slate-600 rounded-lg px-4 py-2 text-slate-800 dark:text-slate-200 bg-white dark:bg-slate-700 focus:ring-2 focus:ring-indigo-500 dark:focus:ring-indigo-400 outline-none"
                     >
                         <option value="">{t('testCorrection.selectTestOption')}</option>
                         {tests.map(test => (
                             <option key={test.id} value={test.id}>
                                 {test.title}
                             </option>
                         ))}
                     </select>
                     {selectedTestId && selectedTestId.trim() !== '' && onViewTest && (
                         <button
                             onClick={() => onViewTest(selectedTestId)}
                             className="bg-indigo-600 dark:bg-indigo-500 text-white px-3 py-2 rounded-lg text-xs font-bold hover:bg-indigo-700 dark:hover:bg-indigo-600 transition-colors whitespace-nowrap"
                             title={t('testCorrection.viewTestDetails')}
                         >
                             {t('testCorrection.viewTest')}
                         </button>
                     )}
                 </div>
             )}
         </div>

         {/* Release Selector */}
         <div className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl p-4 shadow-sm">
                 <label className="block text-sm font-bold text-slate-700 dark:text-slate-300 mb-2">
                     {t('testCorrection.selectRelease')}
                 </label>
                 {!selectedTestId ? (
                     <div className="py-4">
                         <p className="text-sm text-slate-500 dark:text-slate-400 text-center italic">{t('testCorrection.selectTestFirst')}</p>
                     </div>
                 ) : loadingReleases ? (
                     <div className="flex items-center justify-center gap-2 text-slate-500 dark:text-slate-400 py-4">
                         <Loader2 className="animate-spin" size={20}/>
                         <span>{t('testCorrection.loadingReleases')}</span>
                     </div>
                 ) : (allReleases?.length || 0) === 0 ? (
                     <div className="py-4">
                         <p className="text-sm text-slate-500 dark:text-slate-400 text-center">{t('testCorrection.noReleasesFound')}</p>
                     </div>
                 ) : (
                     <div className="space-y-2">
                         <select
                             value={selectedReleaseId}
                             onChange={(e) => {
                                 setSelectedReleaseId(e.target.value);
                                 reset();
                                 setImage(null);
                                 setSelectedStudentId('');
                             }}
                             className="w-full border border-slate-300 dark:border-slate-600 rounded-lg px-4 py-2 text-slate-800 dark:text-slate-200 bg-white dark:bg-slate-700 focus:ring-2 focus:ring-indigo-500 dark:focus:ring-indigo-400 outline-none"
                         >
                             <option value="">{t('testCorrection.selectReleaseOption')}</option>
                             {paginatedReleases.map(release => (
                                 <option key={release.id} value={release.id}>
                                     {formatReleaseLabel(release)}
                                 </option>
                             ))}
                         </select>
                         
                         {/* Pagination Controls */}
                         {totalPages > 1 && (
                             <div className="flex items-center justify-between text-xs text-slate-600 dark:text-slate-400 pt-2 border-t border-slate-200 dark:border-slate-700">
                                 <span>
                                     {t('testCorrection.showingReleases')
                                         .replace('{{start}}', String(startIndex + 1))
                                         .replace('{{end}}', String(Math.min(endIndex, allReleases.length)))
                                         .replace('{{total}}', String(allReleases.length))}
                                 </span>
                                 <div className="flex items-center gap-1">
                                     <button
                                         onClick={() => handlePageChange(currentPage - 1)}
                                         disabled={currentPage === 1}
                                         className="px-2 py-1 rounded bg-white dark:bg-slate-700 border border-slate-300 dark:border-slate-600 disabled:opacity-50 disabled:cursor-not-allowed hover:bg-slate-50 dark:hover:bg-slate-600 transition-colors"
                                     >
                                         {t('common.previous')}
                                     </button>
                                     <span className="px-2">
                                         {currentPage} / {totalPages}
                                     </span>
                                     <button
                                         onClick={() => handlePageChange(currentPage + 1)}
                                         disabled={currentPage === totalPages}
                                         className="px-2 py-1 rounded bg-white dark:bg-slate-700 border border-slate-300 dark:border-slate-600 disabled:opacity-50 disabled:cursor-not-allowed hover:bg-slate-50 dark:hover:bg-slate-600 transition-colors"
                                     >
                                         {t('common.next')}
                                     </button>
                                 </div>
                             </div>
                         )}
                     </div>
                 )}
         </div>

         {/* Release Details */}
         {selectedRelease && (
             <div className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl p-6 shadow-sm">
                 <h3 className="text-lg font-bold text-slate-900 dark:text-slate-100 mb-4 flex items-center gap-2">
                     <BookOpen size={20} className="text-indigo-600 dark:text-indigo-400"/>
                     {t('testCorrection.releaseDetails')}
                 </h3>
                 
                 <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                     {/* Test & Student Info */}
                     <div className="space-y-4">
                         <div className="bg-slate-50 dark:bg-slate-700 rounded-xl p-4 border border-slate-200 dark:border-slate-600">
                             <div className="text-xs text-slate-500 dark:text-slate-400 uppercase font-bold tracking-wider mb-2 flex items-center gap-1">
                                 <BookOpen size={12}/> {t('testCorrection.test')}
                             </div>
                             <div className="text-lg font-bold text-slate-900 dark:text-slate-100">{selectedRelease.tests?.title || t('testCorrection.unknownTest')}</div>
                             <div className="text-sm text-slate-500 dark:text-slate-400 mt-1">{selectedRelease.tests?.school_grades?.name}</div>
                         </div>
                         
                        {/* Mostrar informações do aluno - todas as releases devem ter um aluno */}
                        {selectedRelease.student_id ? (
                            selectedRelease.students ? (
                                <div className={`bg-slate-50 dark:bg-slate-700 rounded-xl p-4 border ${(selectedRelease.students as any)?.deleted || (selectedRelease.students as any)?.notFound ? 'border-amber-300 dark:border-amber-700' : 'border-slate-200 dark:border-slate-600'}`}>
                                    <div className="text-xs text-slate-500 dark:text-slate-400 uppercase font-bold tracking-wider mb-3 flex items-center justify-between">
                                        <div className="flex items-center gap-1">
                                            <User size={12}/> {t('testCorrection.student')}
                                            {((selectedRelease.students as any)?.deleted || (selectedRelease.students as any)?.notFound) && (
                                                <span className="ml-2 text-xs text-amber-600 dark:text-amber-400 font-normal normal-case">
                                                    ({t('testCorrection.studentDeletedOrNotFound')})
                                                </span>
                                            )}
                                        </div>
                                        {(() => {
                                            const studentId = selectedRelease.student_id || (selectedRelease.students as any)?.id || null;
                                            const isDeleted = (selectedRelease.students as any)?.deleted || (selectedRelease.students as any)?.notFound;
                                            if (studentId && onViewStudent && !isDeleted) {
                                                return (
                                                    <button
                                                        onClick={() => onViewStudent(studentId)}
                                                        className="bg-indigo-600 dark:bg-indigo-500 text-white px-3 py-1.5 rounded-lg text-xs font-bold hover:bg-indigo-700 dark:hover:bg-indigo-600 transition-colors whitespace-nowrap flex items-center gap-1.5"
                                                        title={t('testCorrection.viewStudentDetails')}
                                                    >
                                                        <User size={12}/>
                                                        {t('testCorrection.viewStudent')}
                                                    </button>
                                                );
                                            }
                                            return null;
                                        })()}
                                    </div>
                                <div className="space-y-3">
                                    {/* Nome do Aluno */}
                                    <div>
                                        <div className="text-lg font-bold text-slate-900 dark:text-slate-100">{selectedRelease.students.name}</div>
                                        {(selectedRelease.students as any)?.email && (
                                            <div className="text-sm text-slate-500 dark:text-slate-400 mt-1">
                                                {(selectedRelease.students as any).email}
                                            </div>
                                        )}
                                    </div>

                                    {/* Informações Acadêmicas */}
                                    <div className="grid grid-cols-2 gap-3 pt-2 border-t border-slate-200 dark:border-slate-600">
                                        {/* Turma */}
                                        {(selectedRelease.students as any)?.classes?.name && (
                                            <div>
                                                <div className="text-xs text-slate-500 dark:text-slate-400 uppercase font-bold tracking-wider mb-1">
                                                    {t('testCorrection.class')}
                                                </div>
                                                <div className="text-sm font-semibold text-slate-800 dark:text-slate-200">
                                                    {(selectedRelease.students as any).classes.name}
                                                </div>
                                            </div>
                                        )}

                                        {/* Série */}
                                        {((selectedRelease.students as any)?.grade_level || (selectedRelease.students as any)?.school_grades?.name) && (
                                            <div>
                                                <div className="text-xs text-slate-500 dark:text-slate-400 uppercase font-bold tracking-wider mb-1">
                                                    {t('testCorrection.grade')}
                                                </div>
                                                <div className="text-sm font-semibold text-slate-800 dark:text-slate-200">
                                                    {(selectedRelease.students as any)?.school_grades?.name || (selectedRelease.students as any)?.grade_level}
                                                </div>
                                            </div>
                                        )}

                                        {/* Idade */}
                                        {(selectedRelease.students as any)?.age && (
                                            <div>
                                                <div className="text-xs text-slate-500 dark:text-slate-400 uppercase font-bold tracking-wider mb-1">
                                                    {t('testCorrection.age')}
                                                </div>
                                                <div className="text-sm font-semibold text-slate-800 dark:text-slate-200">
                                                    {(selectedRelease.students as any).age} {t('testCorrection.years')}
                                                </div>
                                            </div>
                                        )}

                                        {/* Instituição */}
                                        {(selectedRelease.students as any)?.institutions?.name && (
                                            <div>
                                                <div className="text-xs text-slate-500 dark:text-slate-400 uppercase font-bold tracking-wider mb-1">
                                                    {t('testCorrection.institution')}
                                                </div>
                                                <div className="text-sm font-semibold text-slate-800 dark:text-slate-200 truncate">
                                                    {(selectedRelease.students as any).institutions.name}
                                                </div>
                                            </div>
                                        )}
                                    </div>

                                    {/* Hash do Aluno */}
                                    <div className="pt-2 border-t border-slate-200 dark:border-slate-600">
                                        <div className="text-xs text-slate-500 dark:text-slate-400 uppercase font-bold tracking-wider mb-1">
                                            {t('testCorrection.studentHash')}
                                        </div>
                                        <div className="text-sm text-slate-400 dark:text-slate-500 font-mono">
                                            {(selectedRelease.students as any)?.student_hash ? `${(selectedRelease.students as any).student_hash.substring(0, 12)}...` : t('testCorrection.noHash')}
                                        </div>
                                    </div>
                                </div>
                            </div>
                            ) : (
                                <div className="bg-amber-50 dark:bg-amber-900/20 rounded-xl p-4 border border-amber-200 dark:border-amber-800">
                                    <div className="text-xs text-amber-600 dark:text-amber-400 uppercase font-bold tracking-wider mb-2 flex items-center gap-1">
                                        <AlertTriangle size={12}/> {t('testCorrection.student')}
                                    </div>
                                    <div className="text-sm text-amber-700 dark:text-amber-300">
                                        {t('testCorrection.studentDataNotAvailable')}
                                    </div>
                                    <div className="text-xs text-amber-600 dark:text-amber-400 mt-2 font-mono">
                                        ID: {selectedRelease.student_id}
                                    </div>
                                </div>
                            )
                        ) : (
                            <div className="bg-slate-50 dark:bg-slate-700 rounded-xl p-4 border border-slate-200 dark:border-slate-600">
                                <div className="text-xs text-slate-500 dark:text-slate-400 uppercase font-bold tracking-wider mb-2 flex items-center gap-1">
                                    <User size={12}/> {t('testCorrection.student')}
                                </div>
                                <div className="text-sm text-slate-600 dark:text-slate-400 italic">
                                    {t('testCorrection.noStudentAssigned')}
                                </div>
                            </div>
                        )}
                     </div>

                     {/* Schedule & Configuration */}
                     <div className="space-y-4">
                         <div className="bg-slate-50 dark:bg-slate-700 rounded-xl p-4 border border-slate-200 dark:border-slate-600">
                             <div className="text-xs text-slate-500 dark:text-slate-400 uppercase font-bold tracking-wider mb-3 flex items-center gap-1">
                                 <Clock size={12}/> {t('testCorrection.schedule')}
                             </div>
                             <div className="space-y-3">
                                 <div className="flex items-center gap-3">
                                     <div className="w-10 h-10 rounded-full bg-emerald-100 dark:bg-emerald-900/30 flex items-center justify-center">
                                         <Calendar size={18} className="text-emerald-600 dark:text-emerald-400"/>
                                     </div>
                                     <div>
                                         <div className="text-xs text-slate-500 dark:text-slate-400">{t('testCorrection.start')}</div>
                                         <div className="font-semibold text-slate-800 dark:text-slate-100 text-sm">
                                             {new Date(selectedRelease.start_time).toLocaleDateString()} às {new Date(selectedRelease.start_time).toLocaleTimeString([], {hour:'2-digit', minute:'2-digit'})}
                                         </div>
                                     </div>
                                 </div>
                                 <div className="flex items-center gap-3">
                                     <div className="w-10 h-10 rounded-full bg-red-100 dark:bg-red-900/30 flex items-center justify-center">
                                         <Clock size={18} className="text-red-600 dark:text-red-400"/>
                                     </div>
                                     <div>
                                         <div className="text-xs text-slate-500 dark:text-slate-400">{t('testCorrection.end')}</div>
                                         <div className="font-semibold text-slate-800 dark:text-slate-100 text-sm">
                                             {new Date(selectedRelease.end_time).toLocaleDateString()} às {new Date(selectedRelease.end_time).toLocaleTimeString([], {hour:'2-digit', minute:'2-digit'})}
                                         </div>
                                     </div>
                                 </div>
                             </div>
                         </div>

                         <div className="bg-slate-50 dark:bg-slate-700 rounded-xl p-4 border border-slate-200 dark:border-slate-600">
                             <div className="text-xs text-slate-500 dark:text-slate-400 uppercase font-bold tracking-wider mb-3">
                                 {t('testCorrection.configuration')}
                             </div>
                             <div className="grid grid-cols-3 gap-3">
                                 <div className="text-center p-2 bg-white dark:bg-slate-800 rounded-lg border border-slate-100 dark:border-slate-600">
                                     <div className="text-xl font-black text-indigo-600 dark:text-indigo-400">{selectedRelease.max_attempts}</div>
                                     <div className="text-xs text-slate-500 dark:text-slate-400 mt-1">{t('testCorrection.attempts')}</div>
                                 </div>
                                 <div className={`text-center p-2 rounded-lg border ${selectedRelease.allow_consultation ? 'bg-emerald-50 dark:bg-emerald-900/30 border-emerald-200 dark:border-emerald-700' : 'bg-slate-50 dark:bg-slate-700 border-slate-100 dark:border-slate-600'}`}>
                                     <div className="flex justify-center mb-1">
                                         {selectedRelease.allow_consultation ? (
                                             <CheckCircle2 size={20} className="text-emerald-500 dark:text-emerald-400"/>
                                         ) : (
                                             <XCircle size={20} className="text-slate-300 dark:text-slate-600"/>
                                         )}
                                     </div>
                                     <div className="text-xs text-slate-600 dark:text-slate-300">{t('testCorrection.consultation')}</div>
                                 </div>
                                 <div className={`text-center p-2 rounded-lg border ${selectedRelease.allow_ai_agent ? 'bg-purple-50 dark:bg-purple-900/30 border-purple-200 dark:border-purple-700' : 'bg-slate-50 dark:bg-slate-700 border-slate-100 dark:border-slate-600'}`}>
                                     <div className="flex justify-center mb-1">
                                         {selectedRelease.allow_ai_agent ? (
                                             <Bot size={20} className="text-purple-500 dark:text-purple-400"/>
                                         ) : (
                                             <XCircle size={20} className="text-slate-300 dark:text-slate-600"/>
                                         )}
                                     </div>
                                     <div className="text-xs text-slate-600 dark:text-slate-300">{t('testCorrection.aiAgent')}</div>
                                 </div>
                             </div>
                         </div>

                         {selectedRelease.allowed_sites && selectedRelease.allowed_sites.length > 0 && (
                             <div className="bg-slate-50 dark:bg-slate-700 rounded-xl p-4 border border-slate-200 dark:border-slate-600">
                                 <div className="text-xs text-slate-500 dark:text-slate-400 uppercase font-bold tracking-wider mb-3 flex items-center gap-1">
                                     <Globe2 size={12}/> {t('testCorrection.allowedSites')}
                                 </div>
                                 <div className="space-y-1">
                                     {selectedRelease.allowed_sites.map((site, idx) => (
                                         <div key={site.id || idx} className="flex items-center gap-2 p-2 bg-white dark:bg-slate-800 rounded border border-slate-200 dark:border-slate-600 text-xs">
                                             <Globe2 size={12} className="text-indigo-400"/>
                                             <span className="font-medium text-slate-800 dark:text-slate-100 truncate flex-1">{site.title || site.url}</span>
                                         </div>
                                     ))}
                                 </div>
                             </div>
                         )}

                         {selectedRelease.location_polygon && selectedRelease.location_polygon.length > 0 && (
                             <div className="bg-slate-50 dark:bg-slate-700 rounded-xl p-4 border border-slate-200 dark:border-slate-600">
                                 <div className="text-xs text-slate-500 dark:text-slate-400 uppercase font-bold tracking-wider mb-2 flex items-center gap-1">
                                     <MapPin size={12}/> {t('testCorrection.geographicArea')}
                                 </div>
                                 <div className="text-sm text-slate-700 dark:text-slate-300">
                                     {t('testCorrection.polygonPoints').replace('{{count}}', String(selectedRelease.location_polygon.length))}
                                 </div>
                             </div>
                         )}
                     </div>
                 </div>
             </div>
         )}

         {/* Upload Section - Only show when release is selected */}
         {selectedReleaseId ? (
             <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                 <div className="space-y-4">
                     <div 
                        className={`border-2 border-dashed rounded-2xl h-[500px] flex flex-col items-center justify-center relative transition-all overflow-hidden ${isDragging ? 'border-indigo-500 bg-indigo-50 dark:bg-indigo-900/30' : 'border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800'}`}
                        onDragOver={onDragOver}
                        onDragLeave={onDragLeave}
                        onDrop={onDrop}
                     >
                         {image ? (
                             <>
                                <img src={image} className="w-full h-full object-contain p-4" alt="Scan" />
                                {(analyzing || saving) && (
                                    <div className="absolute inset-0 bg-slate-900/70 flex flex-col items-center justify-center text-white backdrop-blur-sm">
                                        {analyzing ? (
                                            <>
                                                <ScanLine className="animate-pulse mb-4 text-indigo-400" size={64}/>
                                                <p className="font-bold text-lg text-center">{t('testCorrection.analyzing')}</p>
                                            </>
                                        ) : (
                                            <>
                                                <Loader2 className="animate-spin mb-4 text-emerald-400" size={64}/>
                                                <p className="font-bold text-lg text-center">{t('testCorrection.uploading')}</p>
                                            </>
                                        )}
                                    </div>
                                )}
                             </>
                         ) : (
                             <div className="text-center p-8">
                                 <div className="w-20 h-20 bg-white dark:bg-slate-700 rounded-full flex items-center justify-center mx-auto mb-6 shadow-sm border border-slate-100 dark:border-slate-600">
                                    <ScanLine size={40} className="text-indigo-600 dark:text-indigo-400"/>
                                 </div>
                                 <h3 className="text-xl font-bold text-slate-800 dark:text-slate-100 mb-2">{t('testCorrection.uploadAnswerSheet')}</h3>
                                 <p className="text-slate-500 dark:text-slate-400 mb-8 max-w-xs mx-auto">{t('testCorrection.uploadDescription')}</p>
                                 
                                 <button onClick={() => fileInputRef.current?.click()} className="bg-white dark:bg-slate-700 border-2 border-slate-200 dark:border-slate-600 hover:border-indigo-600 dark:hover:border-indigo-500 hover:text-indigo-600 dark:hover:text-indigo-400 text-slate-700 dark:text-slate-200 font-bold px-8 py-3 rounded-xl flex gap-2 mx-auto transition-all"><Upload/> {t('testCorrection.selectFile')}</button>
                                 <input type="file" hidden ref={fileInputRef} onChange={e => e.target.files?.[0] && processFile(e.target.files[0])} accept="image/*" />
                             </div>
                         )}
                     </div>
                     {image && !analyzing && !saving && !savedSuccess && (
                         <button 
                             onClick={handleAnalyze} 
                             disabled={!selectedTestId || !selectedReleaseId}
                             className="w-full bg-indigo-600 hover:bg-indigo-700 disabled:bg-slate-400 disabled:cursor-not-allowed text-white py-4 rounded-xl font-bold shadow-lg shadow-indigo-200 transition-all text-lg"
                         >
                             {t('testCorrection.analyzeAndGrade')}
                         </button>
                     )}
                     {image && !saving && !analyzing && <button onClick={() => { setImage(null); reset(); }} className="block text-center text-sm font-medium text-slate-500 hover:text-red-500 w-full py-2">{t('testCorrection.removeImage')}</button>}
                 </div>

                 <div className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-2xl shadow-sm h-[500px] flex flex-col overflow-hidden">
                 {!resultData ? (
                     <div className="flex-1 flex flex-col items-center justify-center text-slate-400 dark:text-slate-500 p-8 text-center bg-slate-50/50 dark:bg-slate-900/50">
                         {analyzing ? (
                            <>
                                <Loader2 className="animate-spin mb-4 text-indigo-500 dark:text-indigo-400" size={48}/>
                                <p className="font-medium text-slate-600 dark:text-slate-300">{t('testCorrection.processing')}</p>
                            </>
                         ) : (
                            <>
                                <CheckCircle size={48} className="mb-4 opacity-20 dark:opacity-30"/>
                                <p className="font-medium dark:text-slate-300">{t('testCorrection.resultsWillAppear')}</p>
                            </>
                         )}
                         {error && <div className="mt-6 bg-red-50 dark:bg-red-900/20 border border-red-100 dark:border-red-800 text-red-700 dark:text-red-300 p-4 rounded-lg text-sm flex gap-2 items-start text-left"><AlertTriangle className="shrink-0 mt-0.5" size={16}/> {error}</div>}
                     </div>
                 ) : (
                     <div className="flex flex-col h-full">
                         <div className="p-6 border-b border-slate-100 dark:border-slate-700 bg-slate-50/50 dark:bg-slate-900/50">
                             <div className="flex justify-between items-start">
                                 <div className="flex-1">
                                    <h3 className="text-xs font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider mb-1">{t('testCorrection.ocrDetectedName')}</h3>
                                    <div className="flex items-center gap-2">
                                        <p className="text-2xl font-bold text-slate-900 dark:text-slate-100">{resultData.analysis.student_name}</p>
                                        {selectedStudentId && onViewStudent && (
                                            <button
                                                onClick={() => onViewStudent(selectedStudentId)}
                                                className="text-xs bg-indigo-100 dark:bg-indigo-900/30 text-indigo-600 dark:text-indigo-400 px-2 py-1 rounded font-bold hover:bg-indigo-200 dark:hover:bg-indigo-900/50 transition-colors"
                                                title={t('testCorrection.viewStudentDetails')}
                                            >
                                                {t('testCorrection.viewStudent')}
                                            </button>
                                        )}
                                    </div>
                                    <div className="flex items-center gap-2 mt-1">
                                        <p className="text-sm text-slate-500 dark:text-slate-400">{t('testCorrection.testId')}: <span className="font-mono text-slate-700 dark:text-slate-300">{(resultData.analysis?.test_id || '').substring(0, 8)}...</span></p>
                                        {resultData.test?.id && onViewTest && (
                                            <button
                                                onClick={() => onViewTest(resultData.test.id)}
                                                className="text-xs bg-emerald-100 dark:bg-emerald-900/30 text-emerald-600 dark:text-emerald-400 px-2 py-1 rounded font-bold hover:bg-emerald-200 dark:hover:bg-emerald-900/50 transition-colors"
                                                title={t('testCorrection.viewTestDetails')}
                                            >
                                                {t('testCorrection.viewTest')}
                                            </button>
                                        )}
                                    </div>
                                 </div>
                                 <div className="text-right bg-white dark:bg-slate-700 p-3 rounded-xl border border-slate-200 dark:border-slate-600 shadow-sm">
                                     <h3 className="text-xs font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider mb-1">{t('testCorrection.finalScore')}</h3>
                                     <div className={`text-4xl font-black ${resultData.score >= 70 ? 'text-emerald-600 dark:text-emerald-400' : 'text-red-600 dark:text-red-400'}`}>{resultData.score}%</div>
                                 </div>
                             </div>
                         </div>

                         {!savedSuccess && (
                             <div className="bg-amber-50 dark:bg-amber-900/20 border-b border-amber-100 dark:border-amber-800 p-4">
                                <div className="flex items-center gap-2 mb-2 text-amber-800 dark:text-amber-300 font-bold text-sm">
                                    <UserCheck size={16}/>
                                    <span>{t('testCorrection.linkToStudent')}</span>
                                </div>
                                <div className="flex gap-2">
                                    <select 
                                        value={selectedStudentId}
                                        onChange={e => setSelectedStudentId(e.target.value)}
                                        className="flex-1 border border-amber-200 dark:border-amber-700 rounded-lg px-3 py-2 text-slate-800 dark:text-slate-200 bg-white dark:bg-slate-700 focus:ring-2 focus:ring-amber-400 dark:focus:ring-amber-500 outline-none text-sm"
                                    >
                                        <option value="">{t('testCorrection.guestUnregistered')}</option>
                                        {students.map(s => (
                                            <option key={s.id} value={s.id}>{s.name} ({s.grade_level}) - {s.student_hash}</option>
                                        ))}
                                    </select>
                                    {selectedStudentId && onViewStudent && (
                                        <button
                                            onClick={() => onViewStudent(selectedStudentId)}
                                            className="bg-amber-600 dark:bg-amber-500 text-white px-3 py-2 rounded-lg text-xs font-bold hover:bg-amber-700 dark:hover:bg-amber-600 transition-colors whitespace-nowrap"
                                            title={t('testCorrection.viewStudentDetails')}
                                        >
                                            {t('testCorrection.viewStudent')}
                                        </button>
                                    )}
                                </div>
                             </div>
                         )}

                         <div className="flex-1 overflow-y-auto p-6 space-y-3 bg-slate-50/20 dark:bg-slate-900/20">
                             {resultData.gradedQuestions.map((q, index) => (
                                 <div key={q.questionId || index} className="flex gap-4 items-start p-3 hover:bg-white dark:hover:bg-slate-700 rounded-lg transition-colors border border-transparent hover:border-slate-100 dark:hover:border-slate-600 hover:shadow-sm">
                                     <div className={`w-8 h-8 rounded-full flex items-center justify-center font-bold text-white shrink-0 shadow-sm text-sm ${q.isCorrect ? 'bg-emerald-500' : 'bg-red-500'}`}>{index + 1}</div>
                                     <div className="flex-1">
                                         <p className="text-sm font-medium text-slate-800 dark:text-slate-200 mb-2">{q.questionContent}</p>
                                         <div className="flex gap-4 text-xs bg-white dark:bg-slate-700 border border-slate-100 dark:border-slate-600 p-2 rounded w-fit">
                                             <span className={`font-bold ${q.isCorrect ? 'text-emerald-700 dark:text-emerald-400' : 'text-red-700 dark:text-red-400'}`}>{t('testCorrection.selected')}: {q.selectedOption}</span>
                                             {!q.isCorrect && <span className="text-slate-500 dark:text-slate-400 font-medium pl-2 border-l border-slate-200 dark:border-slate-600">{t('testCorrection.correct')}: <strong className="text-emerald-700 dark:text-emerald-400">{q.correctOption}</strong></span>}
                                         </div>
                                     </div>
                                     {q.isCorrect ? <CheckCircle size={20} className="text-emerald-500 dark:text-emerald-400 mt-1"/> : <XCircle size={20} className="text-red-500 dark:text-red-400 mt-1"/>}
                                 </div>
                             ))}
                         </div>
                         <div className="p-6 border-t border-slate-100 dark:border-slate-700 bg-slate-50 dark:bg-slate-800">
                             {savedSuccess ? (
                                 <div className="space-y-3">
                                     <div className="bg-emerald-100 dark:bg-emerald-900/30 text-emerald-800 dark:text-emerald-300 p-4 rounded-xl flex flex-col items-center justify-center gap-1 font-bold">
                                         <div className="flex items-center gap-2"><CheckCircle/> {t('testCorrection.successfullyArchived')}</div>
                                         <p className="text-xs font-normal opacity-70">{t('testCorrection.savedToDatabase')}</p>
                                     </div>
                                 </div>
                             ) : (
                                 <button onClick={handleSaveWithStudent} disabled={saving} className="w-full bg-indigo-600 hover:bg-indigo-700 text-white py-3.5 rounded-xl font-bold flex justify-center gap-2 shadow-lg shadow-indigo-200 transition-all disabled:opacity-70 disabled:cursor-wait">
                                     {saving ? (
                                         <><Loader2 className="animate-spin" size={20}/> {t('testCorrection.saving')}</>
                                     ) : (
                                         <><Save size={20}/> {t('testCorrection.saveToDatabase')}</>
                                     )}
                                 </button>
                             )}
                         </div>
                     </div>
                     )}
                 </div>
             </div>
         ) : (
             <div className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl p-12 shadow-sm">
                 <div className="flex flex-col items-center justify-center text-center">
                     <div className="w-24 h-24 bg-indigo-100 dark:bg-indigo-900/30 rounded-full flex items-center justify-center mb-6">
                         <BookOpen size={48} className="text-indigo-600 dark:text-indigo-400"/>
                     </div>
                     <h3 className="text-xl font-bold text-slate-900 dark:text-slate-100 mb-2">
                         {t('testCorrection.selectReleaseToStart')}
                     </h3>
                     <p className="text-slate-500 dark:text-slate-400 max-w-md">
                         {t('testCorrection.selectReleaseDescription')}
                     </p>
                 </div>
             </div>
         )}
      </div>
  );
};

export default TestCorrection;
