
import React, { useState, useMemo, useEffect, useRef } from 'react';
import { useTestManager } from '../presentation/hooks/useTestManager';
import { useSettingsManager } from '../presentation/hooks/useSettingsManager';
import { Test, Question } from '../types';
import { 
  FileText, Plus, Calendar, User, ChevronRight, ChevronLeft, Loader2, ArrowLeft, Eye, EyeOff,
  CheckCircle, HelpCircle, Printer, ScanLine, Filter, Search, BookOpen, X, Building2,
  AlertTriangle, RotateCcw, Trash2, Scale, Image as ImageIcon, Edit2, Save, Upload, Home
} from 'lucide-react';
import ConfirmationModal from './ConfirmationModal';

interface TestManagerProps {
  hasSupabase: boolean;
  institutionId?: string; // Optional prop for Strict Isolation
  initialTestId?: string; // For drill-down navigation from other views
  onBack?: () => void; // Callback for drill-down navigation
}

const TestManager: React.FC<TestManagerProps> = ({ hasSupabase, institutionId, initialTestId, onBack }) => {
  // Filter State for Admin
  const [filterInst, setFilterInst] = useState(institutionId || '');
  
  // Pagination State
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(25);
  
  // Use the effective institution ID (prop or selected)
  const effectiveInstId = institutionId || filterInst;
  
  const { 
      tests, professors, institutions, availableQuestions, selectedTest, loading, loadingQuestions, isCreating, deletingId, error,
      createTest, updateTest, loadTestDetails, deleteTest, restoreTest, saveQuestion, isAdmin, showDeleted, setShowDeleted, setSelectedTest, refresh, fetchQuestions
  } = useTestManager(hasSupabase, effectiveInstId || undefined);
  const { grades } = useSettingsManager(hasSupabase, effectiveInstId || undefined);

  // Manager mode and context
  const isManagerMode = !!institutionId || institutions.length === 1;
  const hasInstitutionContext = isManagerMode || !!filterInst;

  const [view, setView] = useState<'list' | 'create' | 'detail' | 'print'>(initialTestId ? 'detail' : 'list');
  const [editingTestId, setEditingTestId] = useState<string | null>(null);
  const [newTest, setNewTest] = useState<Partial<Test>>({ title: '', description: '', grade_id: '', institution_id: institutionId || '', professor_id: '' });
  
  // Modal State
  const [modalConfig, setModalConfig] = useState<{
      isOpen: boolean;
      id: string | null;
      action: 'delete' | 'restore';
      name: string;
  }>({ isOpen: false, id: null, action: 'delete', name: '' });
  const [isActionLoading, setIsActionLoading] = useState(false);

  // Question Selection for New Test
  const [selectedQuestionIds, setSelectedQuestionIds] = useState<string[]>([]);
  const [questionWeights, setQuestionWeights] = useState<Record<string, number>>({});

  // Question Editing Modal State
  const [questionModalOpen, setQuestionModalOpen] = useState(false);
  const [editingQuestionId, setEditingQuestionId] = useState<string | null>(null);
  const [questionForm, setQuestionForm] = useState<{
      content: string;
      options: { content: string; is_correct: boolean; key?: string }[];
      image: File | null;
      imageUrl: string | null;
  }>({ content: '', options: [], image: null, imageUrl: null });
  const [isSavingQuestion, setIsSavingQuestion] = useState(false);
  const questionImageRef = useRef<HTMLInputElement>(null);

  // Update state when prop changes
  useEffect(() => {
      if (institutionId) {
          setFilterInst(institutionId);
          setNewTest(prev => ({ ...prev, institution_id: institutionId }));
      } else if (institutions.length === 1) {
          setFilterInst(institutions[0].id);
          setNewTest(prev => ({ ...prev, institution_id: institutions[0].id }));
      }
  }, [institutionId, institutions]);

  // Handle initial test ID for drill-down navigation
  useEffect(() => {
      if (initialTestId && tests.length > 0 && !selectedTest) {
          loadTestDetails(initialTestId);
      }
  }, [initialTestId, tests]);

  // Strict Filter
  const filteredTests = useMemo(() => {
    let filtered = tests;
    if (effectiveInstId) {
      filtered = filtered.filter(test => test.institution_id === effectiveInstId);
    }
    // Filter by deleted status
    if (!showDeleted) {
      filtered = filtered.filter(test => !test.deleted);
    }
    return filtered;
  }, [tests, effectiveInstId, showDeleted]);

  // Pagination calculations
  const totalPages = Math.ceil(filteredTests.length / itemsPerPage);
  const startIndex = (currentPage - 1) * itemsPerPage;
  const endIndex = startIndex + itemsPerPage;
  const paginatedTests = useMemo(() => {
      return filteredTests.slice(startIndex, endIndex);
  }, [filteredTests, startIndex, endIndex]);

  // Reset page when filters change
  useEffect(() => {
      setCurrentPage(1);
  }, [effectiveInstId, showDeleted]);

  // Filter professors/grades for Create Form
  const filteredProfessors = useMemo(() => {
    if (!effectiveInstId) return professors;
    return professors.filter(p => 
      p.departments?.institution_id === effectiveInstId || 
      p.departments?.institutions?.id === effectiveInstId
    );
  }, [professors, effectiveInstId]);

  const filteredGrades = useMemo(() => {
    const activeInstId = effectiveInstId || newTest.institution_id;
    if (!activeInstId) return [];
    return grades.filter(g => g.institution_id === activeInstId);
  }, [grades, effectiveInstId, newTest.institution_id]);

  // Question selection logic
  const toggleQuestion = (qId: string) => {
      setSelectedQuestionIds(prev => 
          prev.includes(qId) ? prev.filter(id => id !== qId) : [...prev, qId]
      );
      if (!questionWeights[qId]) {
          setQuestionWeights(prev => ({ ...prev, [qId]: 1 }));
      }
  };

  const handleEditClick = async (test: Test) => {
      // 1. Switch to create view
      // 2. Load deep details (to get current questions and weights)
      const details = await loadTestDetails(test.id);
      if (details) {
          setEditingTestId(test.id);
          setNewTest({
              title: details.title,
              description: details.description,
              grade_id: details.grade_id,
              institution_id: details.institution_id,
              professor_id: details.professor_id
          });
          
          const qIds: string[] = [];
          const weights: Record<string, number> = {};
          
          if (details.questions) {
              details.questions.forEach(q => {
                  qIds.push(q.id);
                  if (q.weight) weights[q.id] = q.weight;
              });
          }
          
          setSelectedQuestionIds(qIds);
          setQuestionWeights(weights);
          
          await fetchQuestions(); // Ensure available questions are loaded for adding more
          setView('create');
      }
  };

  const handleCreateSubmit = async (e: React.FormEvent) => {
      e.preventDefault();
      if (!newTest.title || !newTest.professor_id) return alert("Preencha os campos obrigatórios");
      if (selectedQuestionIds.length === 0) return alert("Selecione pelo menos uma questão");

      let success = false;
      if (editingTestId) {
          success = await updateTest(editingTestId, newTest, selectedQuestionIds, questionWeights);
      } else {
          success = await createTest(newTest, selectedQuestionIds, questionWeights);
      }

      if (success) {
          setView('list');
          resetForm();
      }
  };

  const resetForm = () => {
      setNewTest({ title: '', description: '', grade_id: '', institution_id: institutionId || '', professor_id: '' });
      setSelectedQuestionIds([]);
      setQuestionWeights({});
      setEditingTestId(null);
  };

  // --- Question Editing Logic ---
  const handleOpenQuestionModal = (q?: Question) => {
      if (q) {
          setEditingQuestionId(q.id);
          setQuestionForm({
              content: q.content,
              options: q.question_options?.map((o, i) => ({ content: o.content, is_correct: o.is_correct, key: o.key || String.fromCharCode(65+i) })) || [],
              image: null,
              imageUrl: q.image_url || null
          });
      } else {
          // New Question mode (basic setup)
          setEditingQuestionId(null);
          setQuestionForm({
              content: '',
              options: Array(5).fill(null).map((_, i) => ({ content: '', is_correct: i === 0, key: String.fromCharCode(65+i) })),
              image: null,
              imageUrl: null
          });
      }
      setQuestionModalOpen(true);
  };

  const handleSaveQuestion = async () => {
      if (!questionForm.content) return alert("Question content is required");
      setIsSavingQuestion(true);
      try {
          const success = await saveQuestion(
              editingQuestionId, 
              { 
                  content: questionForm.content,
                  grade_id: newTest.grade_id, // Inherit from test context
                  subject: 'General', // Simplified for inline edit
                  difficulty: 'Medium'
              },
              questionForm.options,
              questionForm.image || undefined
          );
          if (success) {
              setQuestionModalOpen(false);
          }
      } finally {
          setIsSavingQuestion(false);
      }
  };

  // ---

  const openDeleteModal = (t: Test) => {
      setModalConfig({ isOpen: true, id: t.id, action: 'delete', name: t.title });
  };

  const openRestoreModal = (t: Test) => {
      setModalConfig({ isOpen: true, id: t.id, action: 'restore', name: t.title });
  };

  const executeAction = async () => {
      if (!modalConfig.id) return;
      setIsActionLoading(true);
      try {
          if (modalConfig.action === 'delete') {
              await deleteTest(modalConfig.id);
          } else {
              await restoreTest(modalConfig.id);
          }
          setModalConfig({ ...modalConfig, isOpen: false });
      } finally {
          setIsActionLoading(false);
      }
  };

  // Helper for printing
  const handlePrint = () => {
      window.print();
  };

  // Render Functions
  const renderList = () => {
      if (loading) {
          return (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                  {[1, 2, 3].map(i => (
                      <div key={i} className="bg-white dark:bg-slate-800 p-6 rounded-xl border border-slate-200 dark:border-slate-700 h-48 animate-pulse">
                          <div className="h-6 bg-slate-100 dark:bg-slate-700 rounded w-3/4 mb-4"></div>
                          <div className="h-4 bg-slate-100 dark:bg-slate-700 rounded w-1/2 mb-2"></div>
                          <div className="h-4 bg-slate-100 dark:bg-slate-700 rounded w-1/3"></div>
                      </div>
                  ))}
              </div>
          );
      }

      return (
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {filteredTests.length === 0 ? (
              <div className="col-span-full py-20 text-center text-slate-400 dark:text-slate-500 bg-slate-50 dark:bg-slate-800/50 border-2 border-dashed border-slate-200 dark:border-slate-700 rounded-xl">
                  <FileText size={48} className="mx-auto mb-4 opacity-50"/>
                  <p className="font-medium text-lg">Nenhuma prova criada.</p>
                  <p className="text-sm">Clique em "Criar Nova Prova" para começar.</p>
              </div>
          ) : paginatedTests.map(test => (
              <div key={test.id} className={`bg-white dark:bg-slate-800 p-6 rounded-xl border border-slate-200 dark:border-slate-700 shadow-sm hover:shadow-md transition-all group flex flex-col justify-between ${test.deleted ? 'bg-red-50 dark:bg-red-900/20 hover:bg-red-100 dark:hover:bg-red-900/30 border-red-200 dark:border-red-800' : ''}`}>
                  <div>
                      <div className="flex justify-between items-start mb-2">
                          <div className="flex flex-col">
                              <span className="text-xs font-bold text-indigo-600 dark:text-indigo-400 bg-indigo-50 dark:bg-indigo-900/30 px-2 py-1 rounded w-fit mb-2 uppercase tracking-wider">{test.school_grades?.name || 'Sem Série'}</span>
                              <h3 className="font-bold text-xl text-slate-900 dark:text-slate-100 line-clamp-2">{test.title}</h3>
                              {test.deleted && <span className="bg-red-200 dark:bg-red-900/50 text-red-800 dark:text-red-300 text-[10px] px-1.5 py-0.5 rounded font-bold uppercase w-fit mt-1">Deletado</span>}
                          </div>
                      </div>
                      
                      <div className="space-y-2 mb-6">
                          <div className="flex items-center gap-2 text-sm text-slate-600 dark:text-slate-300">
                              <User size={16} className="text-slate-400 dark:text-slate-500"/>
                              <span className="truncate">Prof. {(test as any).professors?.name || 'Desconhecido'}</span>
                          </div>
                          <div className="flex items-center gap-2 text-sm text-slate-600 dark:text-slate-300">
                              <Calendar size={16} className="text-slate-400 dark:text-slate-500"/>
                              <span>{new Date(test.created_at || '').toLocaleDateString()}</span>
                          </div>
                      </div>
                  </div>

                  <div className="flex justify-between items-center pt-4 border-t border-slate-100 dark:border-slate-700">
                      <button onClick={() => { loadTestDetails(test.id); setView('detail'); }} className="text-indigo-600 dark:text-indigo-400 font-bold text-sm hover:text-indigo-800 dark:hover:text-indigo-300 flex items-center gap-1 transition-colors">
                          Ver Detalhes <ChevronRight size={16}/>
                      </button>
                      <div className="flex gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                          {!test.deleted && (
                              <button onClick={() => handleEditClick(test)} className="p-2 text-slate-400 dark:text-slate-500 hover:text-indigo-600 dark:hover:text-indigo-400 hover:bg-indigo-50 dark:hover:bg-indigo-900/30 rounded-lg transition-colors" title="Editar">
                                  <Edit2 size={18}/>
                              </button>
                          )}
                          {isAdmin && test.deleted ? (
                              <button onClick={() => openRestoreModal(test)} className="p-2 text-emerald-600 dark:text-emerald-400 hover:text-emerald-800 dark:hover:text-emerald-300 hover:bg-emerald-50 dark:hover:bg-emerald-900/30 rounded-lg transition-colors" title="Restaurar">
                                  <RotateCcw size={18}/>
                              </button>
                          ) : !test.deleted && (
                              <button onClick={() => openDeleteModal(test)} className="p-2 text-slate-400 dark:text-slate-500 hover:text-red-600 dark:hover:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/30 rounded-lg transition-colors" title="Excluir">
                                  {deletingId === test.id ? <Loader2 className="animate-spin" size={18}/> : <Trash2 size={18}/>}
                              </button>
                          )}
                      </div>
                  </div>
              </div>
          ))}
      </div>
      );
  };

  const renderCreate = () => (
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 h-[calc(100vh-140px)]">
          {/* Form Side */}
          <div className="bg-white dark:bg-slate-800 p-6 rounded-xl border border-slate-200 dark:border-slate-700 shadow-sm overflow-y-auto">
              <h3 className="font-bold text-lg text-slate-800 dark:text-slate-100 mb-4 pb-2 border-b border-slate-100 dark:border-slate-700">
                  {editingTestId ? 'Editar Prova' : 'Nova Prova'}
              </h3>
              <form id="create-test-form" onSubmit={handleCreateSubmit} className="space-y-4">
                  <div>
                      <label className="block text-sm font-bold text-slate-700 dark:text-slate-200 mb-1">Título da Prova</label>
                      <input 
                        required 
                        value={newTest.title} 
                        onChange={e => setNewTest({...newTest, title: e.target.value})} 
                        className="w-full border border-slate-300 dark:border-slate-600 rounded-lg px-3 py-2 outline-none focus:ring-2 focus:ring-indigo-500 bg-white dark:bg-slate-700 text-slate-900 dark:text-slate-100" 
                        placeholder="Ex: Prova Bimestral de Matemática"
                      />
                  </div>
                  
                  <div>
                      <label className="block text-sm font-bold text-slate-700 dark:text-slate-200 mb-1">Instituição</label>
                      <select 
                          disabled={!!institutionId} 
                          value={newTest.institution_id} 
                          onChange={e => setNewTest({...newTest, institution_id: e.target.value})} 
                          className="w-full border border-slate-300 dark:border-slate-600 rounded-lg px-3 py-2 outline-none focus:ring-2 focus:ring-indigo-500 bg-white dark:bg-slate-700 text-slate-900 dark:text-slate-100"
                      >
                          <option value="">Selecione...</option>
                          {institutions.map(i => <option key={i.id} value={i.id}>{i.name}</option>)}
                      </select>
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                      <div>
                          <label className="block text-sm font-bold text-slate-700 dark:text-slate-200 mb-1">Professor</label>
                          <select required value={newTest.professor_id} onChange={e => setNewTest({...newTest, professor_id: e.target.value})} className="w-full border border-slate-300 dark:border-slate-600 rounded-lg px-3 py-2 outline-none focus:ring-2 focus:ring-indigo-500 bg-white dark:bg-slate-700 text-slate-900 dark:text-slate-100">
                              <option value="">Selecione...</option>
                              {filteredProfessors.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                          </select>
                      </div>
                      <div>
                          <label className="block text-sm font-bold text-slate-700 dark:text-slate-200 mb-1">Série/Ano</label>
                          <select required value={newTest.grade_id} onChange={e => setNewTest({...newTest, grade_id: e.target.value})} className="w-full border border-slate-300 dark:border-slate-600 rounded-lg px-3 py-2 outline-none focus:ring-2 focus:ring-indigo-500 bg-white dark:bg-slate-700 text-slate-900 dark:text-slate-100" disabled={!newTest.institution_id}>
                              <option value="">Selecione...</option>
                              {filteredGrades.map(g => <option key={g.id} value={g.id}>{g.name}</option>)}
                          </select>
                      </div>
                  </div>

                  <div>
                      <label className="block text-sm font-bold text-slate-700 dark:text-slate-200 mb-1">Descrição / Instruções</label>
                      <textarea value={newTest.description} onChange={e => setNewTest({...newTest, description: e.target.value})} className="w-full border border-slate-300 dark:border-slate-600 rounded-lg px-3 py-2 outline-none focus:ring-2 focus:ring-indigo-500 h-24 resize-none bg-white dark:bg-slate-700 text-slate-900 dark:text-slate-100" placeholder="Instruções para o aluno..."/>
                  </div>

                  <div className="bg-slate-50 dark:bg-slate-900 p-4 rounded-lg border border-slate-200 dark:border-slate-700">
                      <div className="flex justify-between items-center mb-2">
                          <span className="font-bold text-slate-700 dark:text-slate-200 text-sm">Questões Selecionadas</span>
                          <span className="bg-indigo-100 dark:bg-indigo-900/30 text-indigo-700 dark:text-indigo-300 px-2 py-0.5 rounded-full text-xs font-bold">{selectedQuestionIds.length}</span>
                      </div>
                      {selectedQuestionIds.length === 0 ? (
                          <p className="text-xs text-slate-400 dark:text-slate-500 italic">Nenhuma questão selecionada no painel à direita.</p>
                      ) : (
                          <ul className="space-y-2 max-h-60 overflow-y-auto pr-1">
                              {selectedQuestionIds.map((qid, idx) => {
                                  const q = availableQuestions.find(aq => aq.id === qid);
                                  return (
                                      <li key={qid} className="bg-white dark:bg-slate-800 p-3 rounded border border-slate-200 dark:border-slate-700 text-xs shadow-sm group hover:border-indigo-200 dark:hover:border-indigo-600 transition-colors">
                                          <div className="flex justify-between items-start mb-2">
                                              <span className="flex-1 mr-2 font-medium text-slate-800 dark:text-slate-200 line-clamp-2">{idx + 1}. {q?.content}</span>
                                              <button type="button" onClick={() => toggleQuestion(qid)} className="text-slate-400 dark:text-slate-500 hover:text-red-500 dark:hover:text-red-400 p-1"><X size={14}/></button>
                                          </div>
                                          <div className="flex justify-between items-center">
                                              <div className="flex items-center gap-2">
                                                  <input 
                                                      type="number" 
                                                      min="1" 
                                                      value={questionWeights[qid] || 1} 
                                                      onChange={e => setQuestionWeights({...questionWeights, [qid]: parseInt(e.target.value)})}
                                                      className="w-12 border border-slate-300 dark:border-slate-600 rounded px-1 text-center bg-slate-50 dark:bg-slate-700 text-slate-900 dark:text-slate-100"
                                                      title="Peso"
                                                  />
                                                  <span className="text-slate-400 dark:text-slate-500">pts</span>
                                              </div>
                                              <button type="button" onClick={() => handleOpenQuestionModal(q)} className="text-indigo-600 dark:text-indigo-400 hover:text-indigo-800 dark:hover:text-indigo-300 font-bold flex items-center gap-1">
                                                  <Edit2 size={12}/> Editar
                                              </button>
                                          </div>
                                      </li>
                                  );
                              })}
                          </ul>
                      )}
                  </div>
              </form>
          </div>

          {/* Question Picker Side */}
          <div className="bg-slate-50 dark:bg-slate-900 p-6 rounded-xl border border-slate-200 dark:border-slate-700 shadow-inner flex flex-col overflow-hidden">
              <div className="flex justify-between items-center mb-4">
                  <h3 className="font-bold text-lg text-slate-700 dark:text-slate-200 flex items-center gap-2"><BookOpen size={18}/> Banco de Questões</h3>
                  {loadingQuestions && <Loader2 className="animate-spin text-indigo-500" size={18}/>}
              </div>
              <div className="flex-1 overflow-y-auto space-y-3 pr-2">
                  <div className="mb-2">
                      <button onClick={() => handleOpenQuestionModal()} className="w-full py-2 bg-white dark:bg-slate-800 border border-dashed border-indigo-300 dark:border-indigo-600 text-indigo-600 dark:text-indigo-400 rounded-lg font-bold text-xs hover:bg-indigo-50 dark:hover:bg-indigo-900/30 flex items-center justify-center gap-2">
                          <Plus size={14}/> Criar Nova Questão
                      </button>
                  </div>
                  {availableQuestions.length === 0 && !loadingQuestions && (
                      <div className="text-center py-10 text-slate-400 dark:text-slate-500">Nenhuma questão disponível.</div>
                  )}
                  {availableQuestions.map(q => (
                      <div 
                          key={q.id} 
                          onClick={() => toggleQuestion(q.id)}
                          className={`p-4 rounded-lg border cursor-pointer transition-all ${selectedQuestionIds.includes(q.id) ? 'bg-indigo-50 dark:bg-indigo-900/30 border-indigo-500 dark:border-indigo-400 ring-1 ring-indigo-500 dark:ring-indigo-400 opacity-60' : 'bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700 hover:border-indigo-300 dark:hover:border-indigo-600'}`}
                      >
                          <div className="flex justify-between items-start mb-2">
                              <span className={`text-[10px] px-2 py-0.5 rounded font-bold uppercase ${q.difficulty === 'Hard' ? 'bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-300' : 'bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-300'}`}>{q.difficulty}</span>
                              <span className="text-[10px] text-slate-500 dark:text-slate-400 bg-slate-100 dark:bg-slate-700 px-2 py-0.5 rounded">{q.subject}</span>
                          </div>
                          <p className="text-sm text-slate-800 dark:text-slate-200 line-clamp-3">{q.content}</p>
                      </div>
                  ))}
              </div>
          </div>
      </div>
  );

  const renderDetail = () => {
      // Show loading state while details are being fetched
      if (loading) {
          return (
              <div className="flex flex-col items-center justify-center py-24 bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 shadow-sm h-[600px]">
                  <Loader2 className="animate-spin text-indigo-600 dark:text-indigo-400 mb-4" size={48}/>
                  <h3 className="text-xl font-bold text-slate-900 dark:text-slate-50">Carregando Prova...</h3>
                  <p className="text-slate-600 dark:text-slate-300">Buscando questões e detalhes.</p>
              </div>
          );
      }

      if (!selectedTest) return <div className="p-8 text-center text-slate-700 dark:text-slate-300">Prova não encontrada.</div>;

      return (
          <div>
          <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 shadow-sm overflow-hidden animate-in fade-in slide-in-from-right-4">
              {/* Header */}
              <div className="p-8 border-b border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900/50 flex flex-col md:flex-row justify-between items-start gap-6">
                  <div>
                      <div className="flex items-center gap-3 mb-2">
                          <span className="bg-indigo-600 dark:bg-indigo-500 text-white px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider">
                              {selectedTest.school_grades?.name}
                          </span>
                          <span className="text-slate-600 dark:text-slate-300 text-sm flex items-center gap-1">
                              <Building2 size={14}/> {(selectedTest as any).institutions?.name}
                          </span>
                      </div>
                      <h1 className="text-3xl font-bold text-slate-900 dark:text-slate-50 mb-2">{selectedTest.title}</h1>
                      <p className="text-slate-700 dark:text-slate-200 max-w-2xl">{selectedTest.description || "Sem descrição."}</p>
                      
                      <div className="flex items-center gap-4 mt-4 text-sm font-medium text-slate-600 dark:text-slate-300">
                          <span className="flex items-center gap-1"><User size={16}/> Prof. {(selectedTest as any).professors?.name}</span>
                          <span className="flex items-center gap-1"><HelpCircle size={16}/> {selectedTest.questions?.length || 0} Questões</span>
                          <span className="flex items-center gap-1"><Scale size={16}/> Total Pontos: {selectedTest.questions?.reduce((acc, q) => acc + (q.weight || 1), 0)}</span>
                      </div>
                  </div>
                  <button onClick={handlePrint} className="bg-slate-800 dark:bg-slate-600 hover:bg-slate-900 dark:hover:bg-slate-500 text-white px-5 py-2.5 rounded-xl font-bold flex items-center gap-2 shadow-lg transition-all print:hidden">
                      <Printer size={20}/> Imprimir Prova
                  </button>
              </div>

              {/* Questions List */}
              <div className="p-8 space-y-8 print:p-0 bg-white dark:bg-slate-800">
                  {selectedTest.questions?.length === 0 ? (
                      <div className="text-center py-12 text-slate-500 dark:text-slate-400 border-2 border-dashed border-slate-300 dark:border-slate-600 rounded-xl">
                          Nenhuma questão vinculada a esta prova.
                      </div>
                  ) : (
                      selectedTest.questions?.map((q, idx) => (
                          <div key={q.id} className="break-inside-avoid print:mb-6">
                              <div className="flex gap-4">
                                  <div className="w-8 h-8 bg-slate-200 dark:bg-slate-600 rounded-full flex items-center justify-center font-bold text-slate-700 dark:text-slate-100 shrink-0 print:border print:border-black print:bg-transparent print:text-black">
                                      {idx + 1}
                                  </div>
                                  <div className="flex-1">
                                      <div className="mb-3 text-slate-900 dark:text-slate-50 text-lg leading-relaxed font-medium">
                                          {q.content}
                                          {q.weight && <span className="ml-2 text-xs text-slate-500 dark:text-slate-400 font-normal print:hidden">({q.weight} pts)</span>}
                                      </div>
                                      
                                      {q.image_url && (
                                          <div className="mb-4">
                                              <img src={q.image_url} alt="Referência" className="max-h-64 rounded-lg border border-slate-300 dark:border-slate-600 object-contain bg-slate-100 dark:bg-slate-900/70 print:border-0" />
                                          </div>
                                      )}

                                      <div className="grid grid-cols-1 gap-2 pl-2">
                                          {q.question_options?.map((opt, i) => (
                                              <div key={i} className="flex items-center gap-3 text-slate-800 dark:text-slate-200">
                                                  <div className="w-5 h-5 rounded-full border-2 border-slate-400 dark:border-slate-500 flex items-center justify-center text-xs font-bold text-slate-600 dark:text-slate-300 print:border-black print:text-black">
                                                      {opt.key || String.fromCharCode(65 + i)}
                                                  </div>
                                                  <span className="text-slate-800 dark:text-slate-200">{opt.content}</span>
                                              </div>
                                          ))}
                                      </div>
                                  </div>
                              </div>
                          </div>
                      ))
                  )}
              </div>

              {/* Print Footer Only */}
              <div className="hidden print:block mt-8 pt-8 border-t border-black text-center text-xs">
                  <p>Gerado por EduTest AI • {new Date().getFullYear()}</p>
              </div>
              </div>
          </div>
      );
  };

  // --- Inline Question Editing Modal ---
  const QuestionEditorModal = () => {
      if (!questionModalOpen) return null;
      return (
          <div className="fixed inset-0 bg-black/50 z-[70] flex items-center justify-center p-4">
              <div className="bg-white dark:bg-slate-800 rounded-2xl w-full max-w-2xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
                  <div className="p-4 border-b border-slate-100 dark:border-slate-700 flex justify-between items-center bg-slate-50 dark:bg-slate-900">
                      <h3 className="font-bold text-lg text-slate-800 dark:text-slate-100">{editingQuestionId ? 'Editar Questão' : 'Nova Questão'}</h3>
                      <button onClick={() => setQuestionModalOpen(false)}><X size={20} className="text-slate-500 dark:text-slate-400"/></button>
                  </div>
                  <div className="p-6 overflow-y-auto space-y-4 bg-white dark:bg-slate-800">
                      <div>
                          <label className="block text-xs font-bold text-slate-500 dark:text-slate-400 uppercase mb-1">Enunciado</label>
                          <textarea 
                              value={questionForm.content} 
                              onChange={e => setQuestionForm({...questionForm, content: e.target.value})}
                              className="w-full border border-slate-300 dark:border-slate-600 rounded-lg p-3 outline-none focus:ring-2 focus:ring-indigo-500 h-24 bg-white dark:bg-slate-700 text-slate-900 dark:text-slate-100"
                              placeholder="Digite a pergunta..."
                          />
                      </div>
                      <div>
                          <label className="block text-xs font-bold text-slate-500 dark:text-slate-400 uppercase mb-1">Imagem (Opcional)</label>
                          <div className="flex gap-4 items-center">
                              <div 
                                  onClick={() => questionImageRef.current?.click()}
                                  className="w-24 h-24 border-2 border-dashed border-slate-300 dark:border-slate-600 rounded-lg flex items-center justify-center cursor-pointer hover:bg-slate-50 dark:hover:bg-slate-700 relative overflow-hidden bg-white dark:bg-slate-700"
                              >
                                  {questionForm.imageUrl ? (
                                      <img src={questionForm.imageUrl} className="w-full h-full object-cover"/>
                                  ) : (
                                      <Upload size={20} className="text-slate-400 dark:text-slate-500"/>
                                  )}
                                  <input type="file" ref={questionImageRef} className="hidden" accept="image/*" onChange={e => {
                                      const file = e.target.files?.[0];
                                      if (file) {
                                          setQuestionForm({...questionForm, image: file, imageUrl: URL.createObjectURL(file)});
                                      }
                                  }}/>
                              </div>
                              {questionForm.imageUrl && <button onClick={() => setQuestionForm({...questionForm, image: null, imageUrl: null})} className="text-xs text-red-500 dark:text-red-400 hover:underline">Remover</button>}
                          </div>
                      </div>
                      <div className="space-y-2">
                          <label className="block text-xs font-bold text-slate-500 dark:text-slate-400 uppercase">Opções</label>
                          {questionForm.options.map((opt, idx) => (
                              <div key={idx} className={`flex items-center gap-2 p-2 rounded border ${opt.is_correct ? 'bg-emerald-50 dark:bg-emerald-900/30 border-emerald-300 dark:border-emerald-700' : 'bg-white dark:bg-slate-700 border-slate-200 dark:border-slate-600'}`}>
                                  <input 
                                      type="radio" 
                                      name="correct_opt_modal"
                                      checked={opt.is_correct}
                                      onChange={() => {
                                          const newOpts = questionForm.options.map((o, i) => ({...o, is_correct: i === idx}));
                                          setQuestionForm({...questionForm, options: newOpts});
                                      }}
                                      className="accent-emerald-600 dark:accent-emerald-500"
                                  />
                                  <span className="font-bold text-slate-400 dark:text-slate-500 text-xs w-4">{opt.key}</span>
                                  <input 
                                      value={opt.content}
                                      onChange={e => {
                                          const newOpts = [...questionForm.options];
                                          newOpts[idx].content = e.target.value;
                                          setQuestionForm({...questionForm, options: newOpts});
                                      }}
                                      className="flex-1 bg-transparent outline-none text-sm text-slate-900 dark:text-slate-100"
                                      placeholder="Texto da opção..."
                                  />
                              </div>
                          ))}
                      </div>
                  </div>
                  <div className="p-4 border-t border-slate-100 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 flex justify-end gap-2">
                      <button onClick={() => setQuestionModalOpen(false)} className="px-4 py-2 text-slate-600 dark:text-slate-300 text-sm font-bold hover:bg-slate-200 dark:hover:bg-slate-700 rounded-lg">Cancelar</button>
                      <button onClick={handleSaveQuestion} disabled={isSavingQuestion} className="bg-indigo-600 text-white px-6 py-2 rounded-lg text-sm font-bold hover:bg-indigo-700 disabled:opacity-70 flex items-center gap-2">
                          {isSavingQuestion ? <Loader2 size={16} className="animate-spin"/> : <Save size={16}/>} Salvar Questão
                      </button>
                  </div>
              </div>
          </div>
      );
  };

  if (!hasSupabase) return <div className="p-8 text-center text-slate-500 dark:text-slate-400 bg-slate-100 dark:bg-slate-800 rounded-lg border border-slate-200 dark:border-slate-700 m-4">Configure o banco de dados primeiro.</div>;

  return (
      <div className="space-y-8">
          <div className="flex justify-between items-center print:hidden">
              <div>
                  <h2 className="text-3xl font-bold text-slate-900 dark:text-slate-100">{view === 'create' ? (editingTestId ? 'Editar Prova' : 'Criar Nova Prova') : (view === 'detail' ? 'Visualizar Prova' : 'Gerenciador de Provas')}</h2>
                  <p className="text-slate-500 dark:text-slate-400 mt-1">Crie, imprima e gerencie avaliações acadêmicas</p>
              </div>
              <div className="flex items-center gap-4">
                  {isAdmin && view === 'list' && !loading && hasInstitutionContext && (
                      <label className="flex items-center gap-2 text-sm text-slate-600 cursor-pointer">
                          <input 
                              type="checkbox" 
                              checked={showDeleted} 
                              onChange={e => setShowDeleted(e.target.checked)} 
                              className="w-4 h-4 rounded text-indigo-600 focus:ring-indigo-500 border-gray-300"
                          />
                          <span className="font-bold">Mostrar Excluídos</span>
                      </label>
                  )}
                  {view === 'list' && !loading && (hasInstitutionContext || !isAdmin) && (
                      <>
                          <button onClick={refresh} className="bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-600 text-slate-700 dark:text-slate-200 px-4 py-2.5 rounded-xl font-bold hover:bg-slate-50 dark:hover:bg-slate-700 transition-all flex items-center gap-2">
                              <RotateCcw size={18}/> Atualizar
                          </button>
                          <button onClick={() => { 
                              resetForm();
                              fetchQuestions(); // Lazy load questions
                              setView('create'); 
                          }} className="bg-indigo-600 hover:bg-indigo-700 text-white px-5 py-2.5 rounded-xl font-bold flex items-center gap-2 shadow-lg shadow-indigo-200 transition-all">
                              <Plus size={20}/> Criar Nova Prova
                          </button>
                      </>
                  )}
                  {view === 'create' && (
                      <button form="create-test-form" type="submit" disabled={isCreating} className="bg-emerald-600 hover:bg-emerald-700 text-white px-6 py-2.5 rounded-xl font-bold flex items-center gap-2 shadow-lg shadow-emerald-200 transition-all disabled:opacity-70">
                          {isCreating ? <Loader2 className="animate-spin" size={20}/> : <CheckCircle size={20}/>} {editingTestId ? 'Atualizar Prova' : 'Salvar Prova'}
                      </button>
                  )}
                  {view !== 'list' && (
                      <button onClick={() => { 
                          if (onBack && view === 'detail') {
                              onBack();
                          } else {
                              setView('list'); 
                              resetForm();
                          }
                      }} className="text-slate-500 dark:text-slate-400 hover:text-indigo-600 dark:hover:text-indigo-400 font-bold flex items-center gap-2 transition-all px-4 py-2 rounded-xl hover:bg-slate-100 dark:hover:bg-slate-700">
                          <ArrowLeft size={20}/> Voltar
                      </button>
                  )}
              </div>
          </div>

          {/* Institution Selector for Admin Only (not loading, has multiple institutions) */}
          {!isManagerMode && !loading && isAdmin && view === 'list' && (
              <div className="bg-white dark:bg-slate-800 p-4 rounded-xl border border-slate-200 dark:border-slate-700 shadow-sm print:hidden">
                  <label className="block text-xs font-bold text-slate-500 dark:text-slate-400 uppercase mb-1">Contexto da Instituição</label>
                  <div className="relative">
                      <Building2 size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 dark:text-slate-500"/>
                      <select 
                          value={filterInst} 
                          onChange={e => { 
                              setFilterInst(e.target.value); 
                              setNewTest(prev => ({...prev, institution_id: e.target.value, grade_id: '', professor_id: ''})); 
                          }} 
                          className="w-full border border-slate-300 dark:border-slate-600 rounded-lg pl-10 pr-4 py-2 text-slate-900 dark:text-slate-100 bg-white dark:bg-slate-700 focus:ring-2 focus:ring-indigo-500 outline-none cursor-pointer"
                      >
                          <option value="">Selecione a Instituição</option>
                          {institutions.map(i => <option key={i.id} value={i.id}>{i.name}</option>)}
                      </select>
                  </div>
              </div>
          )}

          {/* Loading State for non-Admin roles (Professor/Manager) waiting for institution context */}
          {loading && view === 'list' && (
              <div className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl p-12 text-center">
                  <Loader2 className="animate-spin text-indigo-600 dark:text-indigo-400 mx-auto mb-4" size={48}/>
                  <h3 className="text-lg font-bold text-slate-800 dark:text-slate-100 mb-2">Carregando...</h3>
                  <p className="text-slate-500 dark:text-slate-400 text-sm">Buscando dados do gerenciador de provas.</p>
              </div>
          )}

          {/* No Institution Selected Message - Only for Admin after loading */}
          {!hasInstitutionContext && !loading && isAdmin && view === 'list' && (
              <div className="bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-xl p-8 text-center">
                  <Building2 size={48} className="mx-auto text-amber-400 dark:text-amber-500 mb-4"/>
                  <h3 className="text-lg font-bold text-amber-800 dark:text-amber-300 mb-2">Nenhuma Instituição Selecionada</h3>
                  <p className="text-amber-600 dark:text-amber-400 text-sm">Selecione uma instituição acima para visualizar e gerenciar as provas.</p>
              </div>
          )}

          <ConfirmationModal
              isOpen={modalConfig.isOpen}
              onClose={() => setModalConfig({ ...modalConfig, isOpen: false })}
              onConfirm={executeAction}
              title={modalConfig.action === 'delete' ? "Excluir Prova" : "Restaurar Prova"}
              message={
                  modalConfig.action === 'delete'
                  ? <span>Tem certeza de que deseja excluir <strong>{modalConfig.name}</strong>? Esta é uma exclusão lógica (soft delete).</span>
                  : <span>Restaurar <strong>{modalConfig.name}</strong>?</span>
              }
              confirmLabel={modalConfig.action === 'delete' ? "Excluir" : "Restaurar"}
              isDestructive={modalConfig.action === 'delete'}
              isLoading={isActionLoading}
          />

          <QuestionEditorModal />

          {error && (
            <div className="bg-red-50 border border-red-200 rounded-xl p-4 flex gap-3 text-red-700 items-center print:hidden">
                <AlertTriangle size={20}/> {error}
            </div>
          )}

          <div className="print:block">
            {view === 'list' && !loading && (hasInstitutionContext || !isAdmin) && (
              <>
                {renderList()}
                {/* Pagination Controls */}
                {filteredTests.length > 0 && (
                  <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 shadow-sm p-4 mt-4">
                    <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
                      {/* Items per page selector and info */}
                      <div className="flex items-center gap-4">
                        <div className="flex items-center gap-2">
                          <span className="text-sm text-slate-600 dark:text-slate-300 font-medium">Itens por página:</span>
                          <select
                            value={itemsPerPage}
                            onChange={(e) => {
                              setItemsPerPage(Number(e.target.value));
                              setCurrentPage(1);
                            }}
                            className="border border-slate-300 dark:border-slate-600 rounded-lg px-3 py-1.5 text-sm text-slate-900 dark:text-slate-100 bg-white dark:bg-slate-700 focus:ring-2 focus:ring-indigo-500 outline-none cursor-pointer"
                          >
                            <option value={25}>25</option>
                            <option value={50}>50</option>
                            <option value={100}>100</option>
                            <option value={200}>200</option>
                          </select>
                        </div>
                        <span className="text-sm text-slate-500 dark:text-slate-400">
                          Mostrando {startIndex + 1} - {Math.min(endIndex, filteredTests.length)} de {filteredTests.length} prova{filteredTests.length !== 1 ? 's' : ''}
                        </span>
                      </div>

                      {/* Page navigation */}
                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
                          disabled={currentPage === 1}
                          className="p-2 border border-slate-300 dark:border-slate-600 rounded-lg text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                          title="Página anterior"
                        >
                          <ChevronLeft size={18} />
                        </button>

                        {/* Page numbers */}
                        <div className="flex items-center gap-1">
                          {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                            let pageNum: number;
                            if (totalPages <= 5) {
                              pageNum = i + 1;
                            } else if (currentPage <= 3) {
                              pageNum = i + 1;
                            } else if (currentPage >= totalPages - 2) {
                              pageNum = totalPages - 4 + i;
                            } else {
                              pageNum = currentPage - 2 + i;
                            }

                            return (
                              <button
                                key={pageNum}
                                onClick={() => setCurrentPage(pageNum)}
                                className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                                  currentPage === pageNum
                                    ? 'bg-indigo-600 text-white'
                                    : 'text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700 border border-slate-300 dark:border-slate-600'
                                }`}
                              >
                                {pageNum}
                              </button>
                            );
                          })}
                        </div>

                        <button
                          onClick={() => setCurrentPage(prev => Math.min(totalPages, prev + 1))}
                          disabled={currentPage === totalPages}
                          className="p-2 border border-slate-300 dark:border-slate-600 rounded-lg text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                          title="Próxima página"
                        >
                          <ChevronRight size={18} />
                        </button>

                        {/* Jump to page */}
                        <div className="flex items-center gap-2 ml-2 pl-2 border-l border-slate-300 dark:border-slate-600">
                          <span className="text-xs text-slate-500 dark:text-slate-400">Ir para:</span>
                          <input
                            type="number"
                            min={1}
                            max={totalPages}
                            value={currentPage}
                            onChange={(e) => {
                              const page = Math.max(1, Math.min(totalPages, Number(e.target.value) || 1));
                              setCurrentPage(page);
                            }}
                            className="w-16 border border-slate-300 dark:border-slate-600 rounded-lg px-2 py-1.5 text-sm text-slate-900 dark:text-slate-100 bg-white dark:bg-slate-700 focus:ring-2 focus:ring-indigo-500 outline-none text-center"
                          />
                          <span className="text-xs text-slate-500 dark:text-slate-400">/ {totalPages}</span>
                        </div>
                      </div>
                    </div>
                  </div>
                )}
              </>
            )}
            {view === 'create' && renderCreate()}
            {view === 'detail' && renderDetail()}
          </div>
      </div>
  );
};

export default TestManager;
