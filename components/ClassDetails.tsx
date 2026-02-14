
import React, { useMemo, useState } from 'react';
import { useClassDetails } from '../presentation/hooks/useClassDetails';
import { useClassroomRooms } from '../presentation/hooks/useClassroomRooms';
import { useAppTranslation } from '../presentation/hooks/useAppTranslation';
import { ArrowLeft, Users, Building2, BookOpen, Loader2, AlertTriangle, GraduationCap, TrendingUp, Calendar, FileText, Send, Clock, CheckCircle, Briefcase, Plus, Trash2, User, MessageSquare, Lock, Unlock, Edit2, RotateCcw, X, MessageCircle, ChevronRight, Home } from 'lucide-react';
import ClassTestReleaseModal from './ClassTestReleaseModal';
import ConfirmationModal from './ConfirmationModal';
import ClassroomChat from './ClassroomChat';
import { Test, ClassroomRoom } from '../types';

interface ClassDetailsProps {
  classId: string;
  onBack: () => void;
  hasSupabase: boolean;
  // Navigation callbacks
  onViewStudent?: (studentId: string) => void;
  onViewProfessor?: (professorId: string) => void;
  onViewGrade?: (gradeId: string) => void;
  onViewTest?: (testId: string) => void;
}

const ClassDetails: React.FC<ClassDetailsProps> = ({ classId, onBack, hasSupabase, onViewStudent, onViewProfessor, onViewGrade, onViewTest }) => {
  const { t } = useAppTranslation();
  const { classData, students, testResults, releases, availableProfessors, loading, error, refresh, assignProfessor, removeProfessor } = useClassDetails(classId, hasSupabase);
  const { 
    rooms, loading: roomsLoading, canManageRooms, isAdmin, showDeleted: showDeletedRooms, setShowDeleted: setShowDeletedRooms,
    createRoom, deleteRoom, restoreRoom
  } = useClassroomRooms(classId, hasSupabase);
  
  const [isReleaseModalOpen, setIsReleaseModalOpen] = useState(false);
  const [showProfSelector, setShowProfSelector] = useState(false);
  const [selectedProfId, setSelectedProfId] = useState('');
  
  // Room form state
  const [showAddRoom, setShowAddRoom] = useState(false);
  const [newRoomName, setNewRoomName] = useState('');
  const [newRoomDesc, setNewRoomDesc] = useState('');
  const [newRoomPublic, setNewRoomPublic] = useState(true);
  const [savingRoom, setSavingRoom] = useState(false);
  
  // Room modal state
  const [roomModalConfig, setRoomModalConfig] = useState<{
    isOpen: boolean;
    room: ClassroomRoom | null;
    action: 'delete' | 'restore';
  }>({ isOpen: false, room: null, action: 'delete' });
  const [roomActionLoading, setRoomActionLoading] = useState(false);
  
  // Chat state
  const [activeChatRoom, setActiveChatRoom] = useState<ClassroomRoom | null>(null);

  // Group releases by test and time window
  const groupedReleases = useMemo(() => {
    const groups: Record<string, { 
        test: Test | undefined, 
        start: string, 
        end: string, 
        count: number, 
        id: string,
        professorName: string
    }> = {};

    releases.forEach(r => {
        const key = `${r.test_id}-${r.start_time}-${r.end_time}`;
        if (!groups[key]) {
             groups[key] = {
                 test: r.tests,
                 start: r.start_time,
                 end: r.end_time,
                 count: 0,
                 id: r.id, 
                 professorName: r.professors?.name || t('teacher.classDetails.unknown')
             };
        }
        groups[key].count++;
    });

    return Object.values(groups).sort((a,b) => new Date(b.start).getTime() - new Date(a.start).getTime());
  }, [releases]);

  const stats = useMemo(() => {
      if (testResults.length === 0) return { avgScore: 0, testsTaken: 0, topStudent: '-' };
      
      const avgScore = Math.round(testResults.reduce((acc, curr) => acc + curr.score, 0) / testResults.length);
      
      const studentScores: {[key: string]: {total: number, count: number, name: string}} = {};
      testResults.forEach(r => {
          if (r.student_id) {
              if (!studentScores[r.student_id]) {
                  studentScores[r.student_id] = { total: 0, count: 0, name: r.student_name };
              }
              studentScores[r.student_id].total += r.score;
              studentScores[r.student_id].count += 1;
          }
      });

      let topStudentName = '-';
      let maxAvg = -1;

      Object.values(studentScores).forEach(s => {
          const avg = s.total / s.count;
          if (avg > maxAvg) {
              maxAvg = avg;
              topStudentName = s.name;
          }
      });

      return { avgScore, testsTaken: testResults.length, topStudent: topStudentName };
  }, [testResults]);

  const getStatus = (start: string, end: string) => {
      const now = new Date();
      const s = new Date(start);
      const e = new Date(end);
      if (now < s) return { label: t('teacher.classDetails.scheduled'), color: 'bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-300' };
      if (now > e) return { label: t('teacher.classDetails.closed'), color: 'bg-slate-100 dark:bg-slate-700 text-slate-500 dark:text-slate-400' };
      return { label: t('teacher.classDetails.active'), color: 'bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-300' };
  };

  const handleAssignProf = async () => {
      if (!selectedProfId) return;
      await assignProfessor(selectedProfId);
      setShowProfSelector(false);
      setSelectedProfId('');
  };

  // Classroom Room Handlers
  const handleAddRoom = async () => {
      if (!newRoomName.trim()) return;
      setSavingRoom(true);
      try {
          await createRoom(newRoomName, newRoomDesc, newRoomPublic);
          setNewRoomName('');
          setNewRoomDesc('');
          setNewRoomPublic(true);
          setShowAddRoom(false);
      } catch (err: any) {
          alert(err.message || 'Erro ao criar sala.');
      } finally {
          setSavingRoom(false);
      }
  };

  const handleRoomModalConfirm = async () => {
      if (!roomModalConfig.room) return;
      setRoomActionLoading(true);
      try {
          if (roomModalConfig.action === 'delete') {
              await deleteRoom(roomModalConfig.room.id);
          } else {
              await restoreRoom(roomModalConfig.room.id);
          }
          setRoomModalConfig({ isOpen: false, room: null, action: 'delete' });
      } catch (err: any) {
          alert(err.message || 'Erro na operação.');
      } finally {
          setRoomActionLoading(false);
      }
  };

  // Helper to extract professor name from nested discipline object
  const getDisciplineProfName = (d: any) => {
      if (!d.professors) return null;
      // If flattened
      if (d.professors.name) return d.professors.name;
      // If raw from Supabase join
      if (d.professors.app_users) {
          return `${d.professors.app_users.first_name} ${d.professors.app_users.last_name}`;
      }
      return t('teacher.classDetails.unknown');
  };

  // Filter out professors already assigned
  const assignableProfessors = useMemo(() => {
      if (!classData?.professors) return availableProfessors;
      const assignedIds = classData.professors.map(p => p.id);
      return availableProfessors.filter(p => !assignedIds.includes(p.id));
  }, [availableProfessors, classData?.professors]);

  if (loading && !classData) {
      return <div className="flex flex-col items-center justify-center py-20 text-slate-400 dark:text-slate-500"><Loader2 className="animate-spin mb-4" size={40}/><p>{t('teacher.classDetails.loading')}</p></div>;
  }

  if (error) {
      return (
        <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-xl p-8 text-center">
            <AlertTriangle className="mx-auto text-red-500 dark:text-red-400 mb-4" size={48} />
            <h3 className="text-lg font-bold text-red-700 dark:text-red-300 mb-2">{t('teacher.classDetails.errorLoading')}</h3>
            <p className="text-red-600 dark:text-red-300 mb-6">{error}</p>
            <button onClick={onBack} className="text-slate-600 dark:text-slate-400 underline">{t('teacher.classDetails.goBack')}</button>
        </div>
      );
  }

  if (!classData) return null;

  return (
    <div className="space-y-8 animate-in fade-in slide-in-from-right-4 duration-300">

      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div className="flex items-center gap-4">
              <button onClick={onBack} className="p-2 hover:bg-slate-200 dark:hover:bg-slate-700 rounded-full transition-colors text-slate-500 dark:text-slate-400">
                  <ArrowLeft size={24}/>
              </button>
              <div>
                  <h2 className="text-3xl font-bold text-slate-900 dark:text-slate-100">{classData.name}</h2>
                  <div className="flex items-center gap-3 text-slate-500 dark:text-slate-400 mt-1 text-sm">
                      <span className="flex items-center gap-1"><Building2 size={14}/> {classData.institutions?.name}</span>
                      <span 
                        onClick={() => classData.grade_id && onViewGrade?.(classData.grade_id)}
                        className={`flex items-center gap-1 ${onViewGrade && classData.grade_id ? 'cursor-pointer hover:text-indigo-600 dark:hover:text-indigo-400 hover:underline transition-colors' : ''}`}
                      >
                        <BookOpen size={14}/> {classData.school_grades?.name || t('teacher.classDetails.unknownGrade')}
                      </span>
                  </div>
              </div>
          </div>
          <button 
            onClick={() => setIsReleaseModalOpen(true)}
            className="bg-indigo-600 hover:bg-indigo-700 text-white px-6 py-3 rounded-xl font-bold flex items-center gap-2 shadow-lg shadow-indigo-200 transition-all transform hover:-translate-y-0.5 active:translate-y-0"
          >
              <Send size={20}/> {t('teacher.classDetails.applyTest')}
          </button>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div className="bg-white dark:bg-slate-800 p-5 rounded-xl border border-slate-200 dark:border-slate-700 shadow-sm flex flex-col items-center justify-center text-center">
              <div className="w-10 h-10 bg-indigo-50 dark:bg-indigo-900/30 text-indigo-600 dark:text-indigo-400 rounded-full flex items-center justify-center mb-2"><Users size={20}/></div>
              <div className="text-2xl font-bold text-slate-800 dark:text-slate-100">{students.length}</div>
              <div className="text-xs text-slate-500 dark:text-slate-400 uppercase font-bold tracking-wider">{t('teacher.classDetails.studentsEnrolled')}</div>
          </div>
          <div className="bg-white dark:bg-slate-800 p-5 rounded-xl border border-slate-200 dark:border-slate-700 shadow-sm flex flex-col items-center justify-center text-center">
              <div className="w-10 h-10 bg-emerald-50 dark:bg-emerald-900/30 text-emerald-600 dark:text-emerald-400 rounded-full flex items-center justify-center mb-2"><TrendingUp size={20}/></div>
              <div className={`text-2xl font-bold ${stats.avgScore >= 70 ? 'text-emerald-600 dark:text-emerald-400' : 'text-amber-500 dark:text-amber-400'}`}>{stats.avgScore}%</div>
              <div className="text-xs text-slate-500 dark:text-slate-400 uppercase font-bold tracking-wider">{t('teacher.classDetails.classAverage')}</div>
          </div>
          <div className="bg-white dark:bg-slate-800 p-5 rounded-xl border border-slate-200 dark:border-slate-700 shadow-sm flex flex-col items-center justify-center text-center">
              <div className="w-10 h-10 bg-blue-50 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 rounded-full flex items-center justify-center mb-2"><FileText size={20}/></div>
              <div className="text-2xl font-bold text-slate-800 dark:text-slate-100">{stats.testsTaken}</div>
              <div className="text-xs text-slate-500 dark:text-slate-400 uppercase font-bold tracking-wider">{t('teacher.classDetails.totalTestsGraded')}</div>
          </div>
          <div className="bg-white dark:bg-slate-800 p-5 rounded-xl border border-slate-200 dark:border-slate-700 shadow-sm flex flex-col items-center justify-center text-center">
              <div className="w-10 h-10 bg-purple-50 dark:bg-purple-900/30 text-purple-600 dark:text-purple-400 rounded-full flex items-center justify-center mb-2"><GraduationCap size={20}/></div>
              <div className="text-lg font-bold text-slate-800 dark:text-slate-100 truncate w-full px-2">{stats.topStudent}</div>
              <div className="text-xs text-slate-500 dark:text-slate-400 uppercase font-bold tracking-wider">{t('teacher.classDetails.topPerformer')}</div>
          </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Main Content Area */}
          <div className="lg:col-span-2 space-y-8">
              
              {/* Scheduled Tests Section */}
              <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 shadow-sm overflow-hidden flex flex-col">
                  <div className="p-4 border-b border-slate-100 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 flex justify-between items-center">
                      <h3 className="font-bold text-slate-800 dark:text-slate-100 flex items-center gap-2"><Calendar size={18}/> {t('teacher.classDetails.scheduledActiveTests')}</h3>
                      <span className="text-xs font-bold bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 px-2 py-1 rounded text-slate-500 dark:text-slate-400">{groupedReleases.length}</span>
                  </div>
                  <div className="overflow-x-auto">
                    {groupedReleases.length === 0 ? (
                        <div className="p-8 text-center text-slate-400 dark:text-slate-500">{t('teacher.classDetails.noTestsAssigned')}</div>
                    ) : (
                        <table className="w-full text-left">
                            <thead className="bg-white dark:bg-slate-900 text-xs uppercase text-slate-500 dark:text-slate-400 font-semibold border-b border-slate-100 dark:border-slate-700">
                                <tr>
                                    <th className="px-6 py-3">{t('teacher.classDetails.testTitle')}</th>
                                    <th className="px-6 py-3">{t('teacher.classDetails.assignedBy')}</th>
                                    <th className="px-6 py-3">{t('teacher.classDetails.timeline')}</th>
                                    <th className="px-6 py-3">{t('teacher.classDetails.status')}</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100 dark:divide-slate-700">
                                {groupedReleases.map((g) => {
                                    const status = getStatus(g.start, g.end);
                                    return (
                                        <tr 
                                          key={g.id} 
                                          onClick={() => g.test?.id && onViewTest?.(g.test.id)}
                                          className={`hover:bg-slate-50 dark:hover:bg-slate-700 ${onViewTest && g.test?.id ? 'cursor-pointer group' : ''}`}
                                        >
                                            <td className="px-6 py-4">
                                                <div className={`font-bold text-slate-800 dark:text-slate-100 ${onViewTest ? 'group-hover:text-indigo-600 dark:group-hover:text-indigo-400 transition-colors' : ''}`}>{g.test?.title || t('teacher.classDetails.unknownTest')}</div>
                                                <div className="text-xs text-slate-500 dark:text-slate-400">{g.test?.school_grades?.name}</div>
                                            </td>
                                            <td className="px-6 py-4 text-sm text-slate-600 dark:text-slate-300">{g.professorName}</td>
                                            <td className="px-6 py-4">
                                                <div className="flex flex-col gap-1 text-xs">
                                                    <div className="flex items-center gap-2 text-slate-600 dark:text-slate-300"><Clock size={12} className="text-emerald-500 dark:text-emerald-400"/> {new Date(g.start).toLocaleDateString()} {new Date(g.start).toLocaleTimeString([], {hour:'2-digit', minute:'2-digit'})}</div>
                                                    <div className="flex items-center gap-2 text-slate-600 dark:text-slate-300"><Clock size={12} className="text-red-500 dark:text-red-400"/> {new Date(g.end).toLocaleDateString()} {new Date(g.end).toLocaleTimeString([], {hour:'2-digit', minute:'2-digit'})}</div>
                                                </div>
                                            </td>
                                            <td className="px-6 py-4">
                                                <span className={`text-xs font-bold px-2 py-1 rounded uppercase tracking-wider ${status.color} ${status.color.includes('bg-slate-100') ? 'dark:bg-slate-700 dark:text-slate-300' : status.color.includes('bg-amber-100') ? 'dark:bg-amber-900/30 dark:text-amber-300' : status.color.includes('bg-emerald-100') ? 'dark:bg-emerald-900/30 dark:text-emerald-300' : ''}`}>
                                                    {status.label}
                                                </span>
                                            </td>
                                        </tr>
                                    );
                                })}
                            </tbody>
                        </table>
                    )}
                  </div>
              </div>

              {/* Student Roster */}
              <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 shadow-sm overflow-hidden flex flex-col h-[500px]">
                  <div className="p-4 border-b border-slate-100 dark:border-slate-700 bg-slate-50 dark:bg-slate-900">
                      <h3 className="font-bold text-slate-800 dark:text-slate-100 flex items-center gap-2"><Users size={18}/> {t('teacher.classDetails.studentRoster')} ({students.length})</h3>
                  </div>
                  <div className="flex-1 overflow-y-auto">
                      {students.length === 0 ? (
                          <div className="p-8 text-center text-slate-400 dark:text-slate-500">{t('teacher.classDetails.noStudentsAssigned')}</div>
                      ) : (
                          <table className="w-full text-left">
                              <tbody className="divide-y divide-slate-100 dark:divide-slate-700">
                                  {students.map(s => (
                                      <tr 
                                        key={s.id} 
                                        onClick={() => onViewStudent?.(s.id)}
                                        className={`hover:bg-slate-50 dark:hover:bg-slate-700 ${onViewStudent ? 'cursor-pointer group' : ''}`}
                                      >
                                          <td className="p-4">
                                              <div className={`font-bold text-slate-800 dark:text-slate-100 ${onViewStudent ? 'group-hover:text-indigo-600 dark:group-hover:text-indigo-400 transition-colors' : ''}`}>{s.name}</div>
                                              <div className="text-xs text-slate-500 dark:text-slate-400">{s.age} {t('teacher.classDetails.yearsOld')}</div>
                                          </td>
                                          <td className="p-4 text-right">
                                              <div className="text-xs font-mono bg-slate-100 dark:bg-slate-700 text-slate-500 dark:text-slate-400 px-2 py-1 rounded inline-block">{(s.student_hash || '').substring(0, 10)}...</div>
                                          </td>
                                      </tr>
                                  ))}
                              </tbody>
                          </table>
                      )}
                  </div>
              </div>
          </div>

          {/* Sidebar Area */}
          <div className="space-y-8">
              {/* Faculty Section */}
              <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 shadow-sm overflow-hidden">
                  <div className="p-4 border-b border-slate-100 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 flex justify-between items-center">
                      <h3 className="font-bold text-slate-800 dark:text-slate-100 flex items-center gap-2"><Briefcase size={18}/> {t('teacher.classDetails.faculty')}</h3>
                      {!showProfSelector && (
                          <button onClick={() => setShowProfSelector(true)} className="text-xs bg-indigo-50 dark:bg-indigo-900/30 text-indigo-600 dark:text-indigo-400 px-2 py-1 rounded font-bold hover:bg-indigo-100 dark:hover:bg-indigo-900/50 flex items-center gap-1 transition-colors">
                              <Plus size={12}/> {t('teacher.classDetails.assign')}
                          </button>
                      )}
                  </div>
                  
                  {showProfSelector && (
                      <div className="p-3 bg-indigo-50 dark:bg-indigo-900/20 border-b border-indigo-100 dark:border-indigo-800">
                          <div className="text-xs font-bold text-indigo-800 dark:text-indigo-200 mb-1">{t('teacher.classDetails.addProfessor')}</div>
                          <div className="flex gap-2">
                              <select 
                                  value={selectedProfId} 
                                  onChange={e => setSelectedProfId(e.target.value)} 
                                  className="flex-1 text-sm border border-indigo-200 dark:border-indigo-700 rounded px-2 py-1 outline-none bg-white dark:bg-slate-700 text-slate-900 dark:text-slate-100"
                              >
                                  <option value="">{t('teacher.classDetails.select')}</option>
                                  {assignableProfessors.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                              </select>
                              <button onClick={handleAssignProf} className="bg-indigo-600 dark:bg-indigo-500 text-white px-3 py-1 rounded text-xs font-bold">{t('teacher.classDetails.add')}</button>
                              <button onClick={() => setShowProfSelector(false)} className="text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200"><CheckCircle size={16}/></button>
                          </div>
                      </div>
                  )}

                  <div className="max-h-[300px] overflow-y-auto">
                      {!classData.professors || classData.professors.length === 0 ? (
                          <div className="p-6 text-center text-slate-400 dark:text-slate-500 text-sm">{t('teacher.classDetails.noFacultyAssigned')}</div>
                      ) : (
                          <div className="divide-y divide-slate-100 dark:divide-slate-700">
                              {classData.professors.map(p => (
                                  <div 
                                    key={p.id} 
                                    onClick={() => onViewProfessor?.(p.id)}
                                    className={`p-3 flex items-center justify-between hover:bg-slate-50 dark:hover:bg-slate-700 group ${onViewProfessor ? 'cursor-pointer' : ''}`}
                                  >
                                      <div className="flex items-center gap-3">
                                          <div className="w-8 h-8 rounded-full bg-slate-100 dark:bg-slate-700 flex items-center justify-center text-slate-500 dark:text-slate-400 text-xs">
                                              <User size={14}/>
                                          </div>
                                          <div>
                                              <div className={`font-bold text-sm text-slate-800 dark:text-slate-100 ${onViewProfessor ? 'group-hover:text-indigo-600 dark:group-hover:text-indigo-400 transition-colors' : ''}`}>{p.name}</div>
                                              <div className="text-xs text-slate-500 dark:text-slate-400">{p.department}</div>
                                          </div>
                                      </div>
                                      <button onClick={(e) => { e.stopPropagation(); removeProfessor(p.id); }} className="p-1.5 text-slate-300 dark:text-slate-600 hover:text-red-500 dark:hover:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/30 rounded transition-colors opacity-0 group-hover:opacity-100">
                                          <Trash2 size={14}/>
                                      </button>
                                  </div>
                              ))}
                          </div>
                      )}
                  </div>
              </div>

              {/* Disciplines Section (New) */}
              <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 shadow-sm overflow-hidden">
                  <div className="p-4 border-b border-slate-100 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 flex justify-between items-center">
                      <h3 className="font-bold text-slate-800 dark:text-slate-100 flex items-center gap-2"><BookOpen size={18}/> {t('teacher.classDetails.gradeCurriculum')}</h3>
                  </div>
                  <div className="max-h-[300px] overflow-y-auto p-2">
                      {!classData.school_grades?.disciplines || classData.school_grades.disciplines.length === 0 ? (
                          <div className="p-6 text-center text-slate-400 dark:text-slate-500 text-sm">{t('teacher.classDetails.noCurriculumDefined')}</div>
                      ) : (
                          <div className="space-y-1">
                              {classData.school_grades.disciplines.map(d => {
                                  const profName = getDisciplineProfName(d);
                                  return (
                                    <div key={d.id} className="p-3 rounded-lg hover:bg-slate-50 dark:hover:bg-slate-700 border border-transparent hover:border-slate-100 dark:hover:border-slate-600 transition-colors">
                                        <div className="font-bold text-sm text-slate-800 dark:text-slate-100">{d.name}</div>
                                        <div className="flex items-center gap-2 mt-1">
                                            {profName ? (
                                                <span className="text-xs text-indigo-600 dark:text-indigo-400 bg-indigo-50 dark:bg-indigo-900/30 px-2 py-0.5 rounded flex items-center gap-1 font-medium">
                                                    <User size={10}/> {profName}
                                                </span>
                                            ) : (
                                                <span className="text-[10px] text-slate-400 dark:text-slate-500 italic">{t('teacher.classDetails.noTeacherAssigned')}</span>
                                            )}
                                        </div>
                                    </div>
                                  );
                              })}
                          </div>
                      )}
                  </div>
              </div>

              {/* Classroom Rooms Section */}
              <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 shadow-sm overflow-hidden">
                  <div className="p-4 border-b border-slate-100 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 flex justify-between items-center">
                      <h3 className="font-bold text-slate-800 dark:text-slate-100 flex items-center gap-2"><MessageSquare size={18}/> Salas de Chat</h3>
                      <div className="flex items-center gap-2">
                          {isAdmin && (
                              <label className="flex items-center gap-1 text-[10px] text-slate-500 dark:text-slate-400 cursor-pointer">
                                  <input 
                                      type="checkbox" 
                                      checked={showDeletedRooms} 
                                      onChange={(e) => setShowDeletedRooms(e.target.checked)}
                                      className="w-3 h-3"
                                  />
                                  Excluídos
                              </label>
                          )}
                          {canManageRooms && !showAddRoom && (
                              <button onClick={() => setShowAddRoom(true)} className="text-xs bg-teal-50 dark:bg-teal-900/30 text-teal-600 dark:text-teal-400 px-2 py-1 rounded font-bold hover:bg-teal-100 dark:hover:bg-teal-900/50 flex items-center gap-1 transition-colors">
                                  <Plus size={12}/> Nova
                              </button>
                          )}
                      </div>
                  </div>
                  
                  {showAddRoom && (
                      <div className="p-3 bg-teal-50 dark:bg-teal-900/20 border-b border-teal-100 dark:border-teal-800">
                          <div className="text-xs font-bold text-teal-800 dark:text-teal-200 mb-2">Nova Sala de Chat</div>
                          <input
                              type="text"
                              value={newRoomName}
                              onChange={(e) => setNewRoomName(e.target.value)}
                              placeholder="Nome da sala *"
                              className="w-full text-sm bg-white dark:bg-slate-700 border border-teal-200 dark:border-teal-700 rounded px-2 py-1 outline-none mb-2 text-slate-800 dark:text-slate-100 placeholder-slate-400 dark:placeholder-slate-500"
                          />
                          <input
                              type="text"
                              value={newRoomDesc}
                              onChange={(e) => setNewRoomDesc(e.target.value)}
                              placeholder="Descrição (opcional)"
                              className="w-full text-sm bg-white dark:bg-slate-700 border border-teal-200 dark:border-teal-700 rounded px-2 py-1 outline-none mb-2 text-slate-800 dark:text-slate-100 placeholder-slate-400 dark:placeholder-slate-500"
                          />
                          <label className="flex items-center gap-2 text-xs text-teal-700 dark:text-teal-300 mb-2 cursor-pointer">
                              <input 
                                  type="checkbox" 
                                  checked={newRoomPublic} 
                                  onChange={(e) => setNewRoomPublic(e.target.checked)}
                                  className="w-3 h-3"
                              />
                              {newRoomPublic ? <Unlock size={12}/> : <Lock size={12}/>}
                              Sala Pública
                          </label>
                          <div className="flex gap-2">
                              <button onClick={handleAddRoom} disabled={savingRoom || !newRoomName.trim()} className="bg-teal-600 dark:bg-teal-500 text-white px-3 py-1 rounded text-xs font-bold disabled:opacity-50">
                                  {savingRoom ? 'Salvando...' : 'Criar'}
                              </button>
                              <button onClick={() => setShowAddRoom(false)} className="text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200 text-xs">Cancelar</button>
                          </div>
                      </div>
                  )}

                  <div className="max-h-[250px] overflow-y-auto">
                      {roomsLoading ? (
                          <div className="p-6 text-center text-slate-400 dark:text-slate-500 text-sm flex items-center justify-center gap-2">
                              <Loader2 size={16} className="animate-spin" /> Carregando...
                          </div>
                      ) : rooms.length === 0 ? (
                          <div className="p-6 text-center text-slate-400 dark:text-slate-500 text-sm">Nenhuma sala de chat.</div>
                      ) : (
                          <div className="divide-y divide-slate-100 dark:divide-slate-700">
                              {rooms.map(room => (
                                  <div 
                                      key={room.id} 
                                      className={`p-3 flex items-center justify-between group ${room.deleted ? 'bg-red-50 dark:bg-red-900/20 opacity-60' : 'hover:bg-slate-50 dark:hover:bg-slate-700'}`}
                                  >
                                      <div className="flex items-center gap-3 min-w-0">
                                          <div className={`w-8 h-8 rounded-full flex items-center justify-center text-xs ${room.deleted ? 'bg-red-100 dark:bg-red-900/30 text-red-500 dark:text-red-400' : 'bg-teal-50 dark:bg-teal-900/30 text-teal-600 dark:text-teal-400'}`}>
                                              <MessageSquare size={14}/>
                                          </div>
                                          <div className="min-w-0">
                                              <div className={`font-bold text-sm text-slate-800 dark:text-slate-100 truncate flex items-center gap-1 ${room.deleted ? 'line-through' : ''}`}>
                                                  {room.name}
                                                  {room.is_public ? <Unlock size={10} className="text-green-500 dark:text-green-400 flex-shrink-0"/> : <Lock size={10} className="text-amber-500 dark:text-amber-400 flex-shrink-0"/>}
                                                  {room.deleted && <span className="text-[9px] bg-red-200 dark:bg-red-900/30 text-red-700 dark:text-red-300 px-1 rounded ml-1">Excluído</span>}
                                              </div>
                                              {room.description && <div className="text-xs text-slate-500 dark:text-slate-400 truncate">{room.description}</div>}
                                          </div>
                                      </div>
                                      <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                          {/* Open Chat Button */}
                                          {!room.deleted && (
                                              <button 
                                                  onClick={() => setActiveChatRoom(room)}
                                                  className="p-1.5 text-teal-500 dark:text-teal-400 hover:bg-teal-50 dark:hover:bg-teal-900/30 rounded"
                                                  title="Abrir Chat"
                                              >
                                                  <MessageCircle size={14}/>
                                              </button>
                                          )}
                                          {/* Management Buttons */}
                                          {canManageRooms && (
                                              <>
                                                  {room.deleted ? (
                                                      isAdmin && (
                                                          <button 
                                                              onClick={() => setRoomModalConfig({ isOpen: true, room, action: 'restore' })}
                                                              className="p-1 text-green-500 dark:text-green-400 hover:bg-green-50 dark:hover:bg-green-900/30 rounded"
                                                              title="Restaurar"
                                                          >
                                                              <RotateCcw size={12}/>
                                                          </button>
                                                      )
                                                  ) : (
                                                      <button 
                                                          onClick={() => setRoomModalConfig({ isOpen: true, room, action: 'delete' })}
                                                          className="p-1 text-red-400 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/30 rounded"
                                                          title="Excluir"
                                                      >
                                                          <Trash2 size={12}/>
                                                      </button>
                                                  )}
                                              </>
                                          )}
                                      </div>
                                  </div>
                              ))}
                          </div>
                      )}
                  </div>
              </div>

              {/* Recent Activity */}
              <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 shadow-sm overflow-hidden flex flex-col h-[400px]">
                  <div className="p-4 border-b border-slate-100 dark:border-slate-700 bg-slate-50 dark:bg-slate-900">
                      <h3 className="font-bold text-slate-800 dark:text-slate-100 flex items-center gap-2"><FileText size={18}/> {t('teacher.classDetails.recentPerformance')}</h3>
                  </div>
                  <div className="flex-1 overflow-y-auto">
                      {testResults.length === 0 ? (
                          <div className="p-8 text-center text-slate-400 dark:text-slate-500">{t('teacher.classDetails.noGradedTests')}</div>
                      ) : (
                          <table className="w-full text-left">
                              <thead className="bg-slate-50 dark:bg-slate-900 text-xs uppercase text-slate-500 dark:text-slate-400 font-semibold">
                                  <tr>
                                      <th className="px-4 py-2">{t('teacher.classDetails.student')}</th>
                                      <th className="px-4 py-2 text-right">{t('teacher.classDetails.score')}</th>
                                  </tr>
                              </thead>
                              <tbody className="divide-y divide-slate-100 dark:divide-slate-700">
                                  {testResults.slice(0, 10).map(r => (
                                      <tr 
                                        key={r.id} 
                                        onClick={() => r.test_id && onViewTest?.(r.test_id)}
                                        className={`hover:bg-slate-50 dark:hover:bg-slate-700 ${onViewTest ? 'cursor-pointer group' : ''}`}
                                      >
                                          <td className="px-4 py-3 font-medium text-slate-800 dark:text-slate-100 text-sm">
                                              <div 
                                                onClick={(e) => { e.stopPropagation(); r.student_id && onViewStudent?.(r.student_id); }}
                                                className={`${onViewStudent && r.student_id ? 'cursor-pointer hover:text-indigo-600 dark:hover:text-indigo-400 transition-colors' : ''}`}
                                              >
                                                {r.student_name}
                                              </div>
                                              <div className={`text-xs text-slate-400 dark:text-slate-500 truncate w-24 ${onViewTest ? 'group-hover:text-indigo-500 dark:group-hover:text-indigo-400' : ''}`}>{r.tests?.title}</div>
                                          </td>
                                          <td className="px-4 py-3 text-right">
                                              <span className={`text-xs font-bold px-2 py-1 rounded ${r.score >= 70 ? 'bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-300' : 'bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-300'}`}>
                                                  {r.score}%
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

      <ClassTestReleaseModal 
        isOpen={isReleaseModalOpen}
        onClose={() => {
            setIsReleaseModalOpen(false);
            refresh(); // Refresh list after closing modal to see new assignments
        }}
        students={students}
        classNameProp={classData.name}
        institutionId={classData.institution_id}
        hasSupabase={hasSupabase}
      />

      {/* Room Confirmation Modal */}
      <ConfirmationModal
        isOpen={roomModalConfig.isOpen}
        title={roomModalConfig.action === 'delete' ? 'Confirmar Exclusão' : 'Confirmar Restauração'}
        message={
          roomModalConfig.action === 'delete'
            ? `Tem certeza que deseja excluir a sala "${roomModalConfig.room?.name}"?`
            : `Tem certeza que deseja restaurar a sala "${roomModalConfig.room?.name}"?`
        }
        onConfirm={handleRoomModalConfirm}
        onCancel={() => setRoomModalConfig({ isOpen: false, room: null, action: 'delete' })}
        isLoading={roomActionLoading}
        confirmText={roomModalConfig.action === 'delete' ? 'Excluir' : 'Restaurar'}
        confirmButtonClass={roomModalConfig.action === 'delete' ? 'bg-red-600 hover:bg-red-700' : 'bg-green-600 hover:bg-green-700'}
      />

      {/* Chat Modal */}
      {activeChatRoom && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white dark:bg-slate-800 rounded-xl shadow-2xl w-full max-w-2xl max-h-[80vh] flex flex-col overflow-hidden">
            {/* Chat Modal Header */}
            <div className="flex items-center justify-between px-4 py-3 bg-slate-100 dark:bg-slate-900 border-b border-slate-200 dark:border-slate-700">
              <div className="flex items-center gap-2">
                <MessageCircle size={18} className="text-teal-600 dark:text-teal-400" />
                <span className="font-bold text-slate-700 dark:text-slate-200">Chat da Sala</span>
              </div>
              <button
                onClick={() => setActiveChatRoom(null)}
                className="p-1 hover:bg-slate-200 dark:hover:bg-slate-700 rounded transition-colors"
              >
                <X size={18} className="text-slate-500 dark:text-slate-400" />
              </button>
            </div>
            {/* Chat Component */}
            <div className="flex-1 overflow-hidden">
              <ClassroomChat 
                room={activeChatRoom} 
                hasSupabase={hasSupabase}
                onClose={() => setActiveChatRoom(null)}
              />
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default ClassDetails;
