
import React, { useState, useRef, useMemo, useEffect } from 'react';
import { useQuestionManager } from '../presentation/hooks/useQuestionManager';
import { useSettingsManager } from '../presentation/hooks/useSettingsManager';
import { Question, AIQuestionParams, Difficulty } from '../types';
import { parseFile } from '../services/fileParser';
import { 
  Sparkles, Plus, Trash2, Check, AlertTriangle, Loader2, FileQuestion, X, Save,
  BookOpen, Filter, Pencil, Upload, FileText, CheckCircle, RotateCcw, Image as ImageIcon, ChevronLeft, ChevronRight
} from 'lucide-react';
import ConfirmationModal from './ConfirmationModal';

interface QuestionManagerProps {
  hasSupabase: boolean;
}

interface ManualQuestionState {
  content: string;
  options: { content: string; is_correct: boolean; key?: string }[];
  difficulty: Difficulty;
  grade_id: string;
  subject: string;
}

const QuestionManager: React.FC<QuestionManagerProps> = ({ hasSupabase }) => {
  const { 
    questions, loading, error, isGenerating, generateAI, saveManual, deleteQuestion, restoreQuestion, refresh, isAdmin, showDeleted, setShowDeleted
  } = useQuestionManager(hasSupabase);
  const { grades } = useSettingsManager(hasSupabase);
  
  const [showAiModal, setShowAiModal] = useState(false);
  const [difficultyFilter, setDifficultyFilter] = useState<Difficulty | 'All'>('All');
  const [gradeFilter, setGradeFilter] = useState<string>('All');
  const [subjectFilter, setSubjectFilter] = useState<string>('All');
  const [showManualModal, setShowManualModal] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  
  // Pagination State
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(25);
  
  // Modal State
  const [modalConfig, setModalConfig] = useState<{
      isOpen: boolean;
      id: string | null;
      action: 'delete' | 'restore';
      contentSample: string;
  }>({ isOpen: false, id: null, action: 'delete', contentSample: '' });
  const [isActionLoading, setIsActionLoading] = useState(false);

  // Image Upload State
  const imageInputRef = useRef<HTMLInputElement>(null);
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);

  const [manualQuestion, setManualQuestion] = useState<ManualQuestionState>({
    content: '',
    options: [
      { content: '', is_correct: true, key: 'A' },
      { content: '', is_correct: false, key: 'B' },
      { content: '', is_correct: false, key: 'C' },
      { content: '', is_correct: false, key: 'D' },
      { content: '', is_correct: false, key: 'E' }
    ],
    difficulty: 'Medium',
    grade_id: '',
    subject: ''
  });
  
  const [aiMode, setAiMode] = useState<'topic' | 'document'>('topic');
  const [aiParams, setAiParams] = useState<AIQuestionParams>({
    topic: '',
    gradeLevelName: '9th Grade',
    gradeId: '',
    difficulty: 'Medium',
    count: 3,
    sourceText: ''
  });
  const [uploadedFileName, setUploadedFileName] = useState<string | null>(null);
  const [isParsing, setIsParsing] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isDragging, setIsDragging] = useState(false);

  const uniqueSubjects = Array.from(new Set(questions.map(q => q.subject))).filter(Boolean).sort();
  const filteredQuestions = useMemo(() => {
    return questions.filter(q => {
      if (difficultyFilter !== 'All' && q.difficulty !== difficultyFilter) return false;
      if (gradeFilter !== 'All' && q.grade_id !== gradeFilter) return false;
      if (subjectFilter !== 'All' && q.subject !== subjectFilter) return false;
      return true;
    });
  }, [questions, difficultyFilter, gradeFilter, subjectFilter]);

  // Pagination calculations
  const totalPages = Math.ceil(filteredQuestions.length / itemsPerPage);
  const startIndex = (currentPage - 1) * itemsPerPage;
  const endIndex = startIndex + itemsPerPage;
  const paginatedQuestions = useMemo(() => {
      return filteredQuestions.slice(startIndex, endIndex);
  }, [filteredQuestions, startIndex, endIndex]);

  // Reset page when filters change
  useEffect(() => {
      setCurrentPage(1);
  }, [difficultyFilter, gradeFilter, subjectFilter]);

  const processFileForAI = async (file: File) => {
    if (file.size > 5 * 1024 * 1024) return alert("File max 5MB");
    setUploadedFileName(file.name);
    setIsParsing(true);
    try {
      const text = await parseFile(file);
      setAiParams(prev => ({ ...prev, sourceText: text }));
    } catch (err: any) {
      alert(`Error parsing: ${err.message}`);
    } finally {
      setIsParsing(false);
    }
  };

  const handleGenerateAI = async () => {
    if (aiMode === 'document' && !aiParams.sourceText) return alert("Upload document first");
    if (!aiParams.gradeId) return alert("Select a grade first");
    
    const selectedGrade = grades.find(g => g.id === aiParams.gradeId);
    
    const params = {
        ...aiParams,
        gradeLevelName: selectedGrade?.name || 'High School',
        topic: aiParams.topic,
        sourceText: aiMode === 'document' ? aiParams.sourceText : undefined
    };
    await generateAI(params);
    setShowAiModal(false);
  };

  const handleManualSave = async () => {
    if (!manualQuestion.content.trim() || !manualQuestion.subject.trim()) return alert("Fill fields");
    if (!manualQuestion.grade_id) return alert("Select a grade");
    if (!manualQuestion.options.some(opt => opt.is_correct)) return alert("Mark correct option");
    
    setIsSaving(true);
    try {
        const optionsWithKeys = manualQuestion.options.map((opt, index) => ({
            ...opt,
            key: String.fromCharCode(65 + index)
        }));

        const success = await saveManual(
            editingId,
            {
                content: manualQuestion.content,
                difficulty: manualQuestion.difficulty,
                grade_id: manualQuestion.grade_id,
                subject: manualQuestion.subject
            },
            optionsWithKeys,
            imageFile || undefined
        );

        if (success) {
            closeManualModal();
        }
    } finally {
        setIsSaving(false);
    }
  };

  const openEditModal = (q: Question) => {
    setEditingId(q.id);
    setManualQuestion({
      content: q.content,
      subject: q.subject,
      grade_id: q.grade_id,
      difficulty: q.difficulty,
      options: q.question_options?.map((opt, i) => ({ 
          content: opt.content, 
          is_correct: opt.is_correct,
          key: opt.key || String.fromCharCode(65 + i)
      })) || []
    });
    setImagePreview(q.image_url || null);
    setImageFile(null);
    setShowManualModal(true);
  };

  const closeManualModal = () => {
    setShowManualModal(false);
    setEditingId(null);
    setManualQuestion({
      content: '',
      options: Array(5).fill(null).map((_, i) => ({ 
          content: '', 
          is_correct: i === 0, 
          key: String.fromCharCode(65 + i) 
      })),
      difficulty: 'Medium',
      grade_id: '',
      subject: ''
    });
    setImageFile(null);
    setImagePreview(null);
  };

  const resetAiModal = () => {
    setShowAiModal(true);
    const defaultGrade = grades.length > 0 ? grades[0] : null;
    setAiParams({ 
        topic: '', 
        gradeLevelName: defaultGrade?.name || '9th', 
        gradeId: defaultGrade?.id || '', 
        difficulty: 'Medium', 
        count: 3, 
        sourceText: '' 
    });
    setUploadedFileName(null);
  };

  const handleImageSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
      if (e.target.files && e.target.files[0]) {
          const file = e.target.files[0];
          setImageFile(file);
          setImagePreview(URL.createObjectURL(file));
      }
  };

  const openDeleteModal = (q: Question) => {
      setModalConfig({ isOpen: true, id: q.id, action: 'delete', contentSample: q.content.substring(0, 50) });
  };

  const openRestoreModal = (q: Question) => {
      setModalConfig({ isOpen: true, id: q.id, action: 'restore', contentSample: q.content.substring(0, 50) });
  };

  const executeAction = async () => {
      if (!modalConfig.id) return;
      setIsActionLoading(true);
      try {
          if (modalConfig.action === 'delete') {
              await deleteQuestion(modalConfig.id);
          } else {
              await restoreQuestion(modalConfig.id);
          }
          setModalConfig({ isOpen: false, id: null, action: 'delete', contentSample: '' });
      } finally {
          setIsActionLoading(false);
      }
  };

  const onDragOver = (e: React.DragEvent) => { e.preventDefault(); setIsDragging(true); };
  const onDragLeave = () => setIsDragging(false);
  const onDrop = (e: React.DragEvent) => {
      e.preventDefault();
      setIsDragging(false);
      const file = e.dataTransfer.files?.[0];
      if (file) processFileForAI(file);
  };

  if (!hasSupabase) {
    return (
      <div className="flex flex-col items-center justify-center h-96 text-center p-8 bg-white dark:bg-slate-800 rounded-xl border border-dashed border-slate-300 dark:border-slate-700 mx-4 mt-4">
        <AlertTriangle className="text-amber-500 dark:text-amber-400 mb-4" size={48} />
        <h3 className="text-xl font-bold text-slate-800 dark:text-slate-100 mb-2">Conexão com Banco de Dados Necessária</h3>
      </div>
    );
  }

  const getGradeLabel = (g: any) => `${g.name} (${g.institutions?.name || 'Unassigned'})`;

  return (
    <div className="space-y-8">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
           <h2 className="text-3xl font-bold text-slate-900 dark:text-slate-100">Banco de Questões</h2>
           <p className="text-slate-500 dark:text-slate-400 mt-1">Crie e gerencie seu conteúdo curricular</p>
        </div>
        <div className="flex gap-3">
          {isAdmin && (
              <label className="flex items-center gap-2 text-sm text-slate-600 dark:text-slate-300 cursor-pointer select-none bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-600 px-3 py-2 rounded-lg hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors">
                  <input 
                      type="checkbox" 
                      checked={showDeleted} 
                      onChange={e => setShowDeleted(e.target.checked)} 
                      className="w-4 h-4 rounded text-indigo-600 focus:ring-indigo-500 border-gray-300"
                  />
                  <span className="font-bold">Mostrar Excluídos</span>
              </label>
          )}
          <button onClick={resetAiModal} className="flex items-center gap-2 bg-gradient-to-r from-indigo-600 to-violet-600 hover:from-indigo-700 hover:to-violet-700 text-white px-5 py-2.5 rounded-xl font-semibold shadow-lg shadow-indigo-200 transition-all"><Sparkles size={18} /><span>Gerar com IA</span></button>
          <button onClick={() => setShowManualModal(true)} className="flex items-center gap-2 bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-600 hover:bg-slate-50 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 px-5 py-2.5 rounded-xl font-semibold transition-all"><Plus size={18} /><span>Adicionar Manual</span></button>
        </div>
      </div>

      <ConfirmationModal
          isOpen={modalConfig.isOpen}
          onClose={() => setModalConfig({ isOpen: false, id: null, action: 'delete', contentSample: '' })}
          onConfirm={executeAction}
          title={modalConfig.action === 'delete' ? "Excluir Questão" : "Restaurar Questão"}
          message={
              modalConfig.action === 'delete'
              ? <span>Tem certeza de que deseja excluir esta questão?<br/><br/><em className="text-slate-500">"{modalConfig.contentSample}..."</em></span>
              : <span>Restaurar esta questão?<br/><br/><em className="text-slate-500">"{modalConfig.contentSample}..."</em></span>
          }
          confirmLabel={modalConfig.action === 'delete' ? "Excluir" : "Restaurar"}
          isDestructive={modalConfig.action === 'delete'}
          isLoading={isActionLoading}
      />

      <div className="bg-white dark:bg-slate-800 p-5 rounded-xl border border-slate-200 dark:border-slate-700 shadow-sm">
        <div className="flex flex-col md:flex-row gap-4 items-center">
          <div className="flex items-center gap-2 text-slate-500 dark:text-slate-400 mr-2 font-medium"><Filter size={20} /><span>Filtros:</span></div>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 w-full md:w-auto flex-1">
              <select value={subjectFilter} onChange={(e) => setSubjectFilter(e.target.value)} className="bg-white dark:bg-slate-700 border border-slate-300 dark:border-slate-600 text-slate-900 dark:text-slate-100 rounded-lg px-3 py-2.5 focus:ring-2 focus:ring-indigo-500 outline-none cursor-pointer shadow-sm">
                  <option value="All">Todas as Matérias</option>
                  {uniqueSubjects.map(s => <option key={s} value={s}>{s}</option>)}
              </select>
              <select value={gradeFilter} onChange={(e) => setGradeFilter(e.target.value)} className="bg-white dark:bg-slate-700 border border-slate-300 dark:border-slate-600 text-slate-900 dark:text-slate-100 rounded-lg px-3 py-2.5 focus:ring-2 focus:ring-indigo-500 outline-none cursor-pointer shadow-sm">
                  <option value="All">Todas as Séries</option>
                  {grades.map(g => <option key={g.id} value={g.id}>{getGradeLabel(g)}</option>)}
              </select>
              <select value={difficultyFilter} onChange={(e) => setDifficultyFilter(e.target.value as any)} className="bg-white dark:bg-slate-700 border border-slate-300 dark:border-slate-600 text-slate-900 dark:text-slate-100 rounded-lg px-3 py-2.5 focus:ring-2 focus:ring-indigo-500 outline-none cursor-pointer shadow-sm">
                  <option value="All">Todas as Dificuldades</option>
                  {['Easy', 'Medium', 'Hard'].map(d => <option key={d} value={d}>{d === 'Easy' ? 'Fácil' : d === 'Medium' ? 'Médio' : 'Difícil'}</option>)}
              </select>
          </div>
          <div className="text-xs text-slate-500 dark:text-slate-400 font-medium">
            {filteredQuestions.length} {filteredQuestions.length !== 1 ? 'questões' : 'questão'} encontrada{filteredQuestions.length !== 1 ? 's' : ''}
          </div>
        </div>
      </div>

      {showManualModal && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-800 rounded-2xl w-full max-w-4xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh] animate-in fade-in zoom-in duration-200">
            {/* ... Conteúdo do Modal ... */}
            <div className="p-6 border-b border-slate-100 dark:border-slate-700 flex justify-between items-center shrink-0 bg-slate-50 dark:bg-slate-900">
               <h3 className="font-bold text-xl text-slate-800 dark:text-slate-100">{editingId ? 'Editar Questão' : 'Criar Nova Questão'}</h3>
               <button onClick={closeManualModal} className="p-2 hover:bg-slate-200 dark:hover:bg-slate-700 rounded-full transition-colors"><X size={24} className="text-slate-500 dark:text-slate-400"/></button>
            </div>
            <div className="p-8 space-y-6 overflow-y-auto">
               <div>
                   <label className="block text-sm font-bold text-slate-700 dark:text-slate-200 mb-2">Conteúdo da Questão</label>
                   <textarea 
                        value={manualQuestion.content} 
                        onChange={e => setManualQuestion({...manualQuestion, content: e.target.value})} 
                        className="w-full border border-slate-300 dark:border-slate-600 rounded-lg p-4 text-slate-900 dark:text-slate-100 bg-white dark:bg-slate-700 focus:ring-2 focus:ring-indigo-500 focus:border-transparent outline-none transition-all min-h-[120px] text-lg shadow-sm" 
                        placeholder="Digite sua pergunta aqui..." 
                   />
               </div>

               {/* Área de Upload de Imagem */}
               <div>
                   <label className="block text-sm font-bold text-slate-700 dark:text-slate-200 mb-2">Imagem da Questão (Opcional)</label>
                   <div className="flex gap-4 items-start">
                       <div 
                           onClick={() => imageInputRef.current?.click()}
                           className="w-32 h-32 border-2 border-dashed border-slate-300 dark:border-slate-600 rounded-lg flex flex-col items-center justify-center cursor-pointer hover:border-indigo-500 dark:hover:border-indigo-400 hover:bg-indigo-50 dark:hover:bg-indigo-900/30 transition-all bg-slate-50 dark:bg-slate-700 overflow-hidden relative"
                       >
                           {imagePreview ? (
                               <img src={imagePreview} className="w-full h-full object-cover" />
                           ) : (
                               <>
                                   <ImageIcon size={24} className="text-slate-400 dark:text-slate-500 mb-1"/>
                                   <span className="text-[10px] text-slate-500 dark:text-slate-400 font-bold uppercase">Upload</span>
                               </>
                           )}
                           <input type="file" ref={imageInputRef} className="hidden" accept="image/*" onChange={handleImageSelect} />
                       </div>
                       {imagePreview && (
                           <div className="flex flex-col gap-2">
                               <p className="text-sm font-bold text-slate-700 dark:text-slate-200">Imagem Selecionada</p>
                               <button 
                                   onClick={() => { setImageFile(null); setImagePreview(null); if(imageInputRef.current) imageInputRef.current.value=''; }} 
                                   className="text-xs text-red-600 dark:text-red-400 hover:underline flex items-center gap-1"
                               >
                                   <Trash2 size={12}/> Remover Imagem
                               </button>
                           </div>
                       )}
                   </div>
               </div>
               
               <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                  <div>
                      <label className="block text-sm font-bold text-slate-700 dark:text-slate-200 mb-2">Matéria</label>
                      <input 
                        value={manualQuestion.subject} 
                        onChange={e => setManualQuestion({...manualQuestion, subject: e.target.value})} 
                        className="w-full border border-slate-300 dark:border-slate-600 rounded-lg px-4 py-3 text-slate-900 dark:text-slate-100 bg-white dark:bg-slate-700 focus:ring-2 focus:ring-indigo-500 outline-none shadow-sm" 
                        placeholder="Ex: Matemática" 
                      />
                  </div>
                  <div>
                      <label className="block text-sm font-bold text-slate-700 dark:text-slate-200 mb-2">Dificuldade</label>
                      <select 
                        value={manualQuestion.difficulty} 
                        onChange={e => setManualQuestion({...manualQuestion, difficulty: e.target.value as any})} 
                        className="w-full border border-slate-300 dark:border-slate-600 rounded-lg px-4 py-3 text-slate-900 dark:text-slate-100 focus:ring-2 focus:ring-indigo-500 outline-none bg-white dark:bg-slate-700 shadow-sm"
                      >
                          {['Easy','Medium','Hard'].map(d => <option key={d} value={d}>{d === 'Easy' ? 'Fácil' : d === 'Medium' ? 'Médio' : 'Difícil'}</option>)}
                      </select>
                  </div>
                  <div>
                      <label className="block text-sm font-bold text-slate-700 dark:text-slate-200 mb-2">Série/Ano</label>
                      <select 
                        value={manualQuestion.grade_id} 
                        onChange={e => setManualQuestion({...manualQuestion, grade_id: e.target.value})} 
                        className="w-full border border-slate-300 dark:border-slate-600 rounded-lg px-4 py-3 text-slate-900 dark:text-slate-100 focus:ring-2 focus:ring-indigo-500 outline-none bg-white dark:bg-slate-700 shadow-sm"
                      >
                          <option value="">Selecionar Série</option>
                          {grades.map(g => <option key={g.id} value={g.id}>{getGradeLabel(g)}</option>)}
                      </select>
                  </div>
               </div>

               <div className="space-y-4">
                 <label className="block text-sm font-bold text-slate-700 dark:text-slate-200">Opções de Resposta (Selecione a Correta)</label>
                 {manualQuestion.options.map((opt, i) => (
                    <div key={i} className={`flex items-center gap-3 p-3 border rounded-lg transition-colors ${opt.is_correct ? 'bg-emerald-50 dark:bg-emerald-900/30 border-emerald-300 dark:border-emerald-700 ring-1 ring-emerald-300 dark:ring-emerald-700' : 'bg-white dark:bg-slate-700 border-slate-200 dark:border-slate-600'}`}>
                        <div className="relative flex items-center justify-center">
                            <input 
                                type="radio" 
                                name="correct_opt"
                                checked={opt.is_correct} 
                                onChange={() => {
                                    const opts = manualQuestion.options.map((o, idx) => ({...o, is_correct: idx === i}));
                                    setManualQuestion({...manualQuestion, options: opts});
                                }} 
                                className="w-5 h-5 text-emerald-600 dark:text-emerald-400 focus:ring-emerald-500 border-gray-300 dark:border-slate-600 cursor-pointer"
                            />
                        </div>
                        <span className="font-bold text-slate-400 dark:text-slate-500 w-6">{String.fromCharCode(65+i)}</span>
                        <input 
                            value={opt.content} 
                            onChange={e => {
                                const opts = [...manualQuestion.options];
                                opts[i].content = e.target.value;
                                setManualQuestion({...manualQuestion, options: opts});
                            }} 
                            className="flex-1 bg-transparent border-none focus:ring-0 text-slate-900 dark:text-slate-100 placeholder-slate-400 dark:placeholder-slate-500 font-medium" 
                            placeholder={`Conteúdo da opção...`} 
                        />
                        {opt.is_correct && <span className="text-emerald-600 dark:text-emerald-400 text-xs font-bold uppercase tracking-wider bg-emerald-100 dark:bg-emerald-900/30 px-2 py-1 rounded">Correta</span>}
                    </div>
                 ))}
               </div>
            </div>
            <div className="p-6 border-t border-slate-100 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 flex justify-end gap-3">
               <button onClick={closeManualModal} disabled={isSaving} className="px-6 py-2.5 rounded-lg font-medium text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors disabled:opacity-50">Cancelar</button>
               <button onClick={handleManualSave} disabled={isSaving} className="bg-indigo-600 dark:bg-indigo-700 hover:bg-indigo-700 dark:hover:bg-indigo-600 text-white px-8 py-2.5 rounded-lg font-bold flex items-center gap-2 shadow-lg shadow-indigo-200 dark:shadow-indigo-900/50 transition-all disabled:opacity-70 disabled:cursor-not-allowed">
                   {isSaving ? <Loader2 className="animate-spin" size={18}/> : <Save size={18}/>} 
                   {isSaving ? 'Salvando...' : 'Salvar Questão'}
               </button>
            </div>
          </div>
        </div>
      )}

      {showAiModal && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
           {/* ... Conteúdo do Modal IA ... */}
           <div className="bg-white dark:bg-slate-800 rounded-2xl w-full max-w-lg p-0 shadow-2xl overflow-hidden animate-in fade-in zoom-in duration-200">
              <div className="p-6 border-b border-slate-100 dark:border-slate-700 bg-slate-50 dark:bg-slate-900">
                  <h3 className="font-bold text-xl text-slate-800 dark:text-slate-100 flex items-center gap-2"><Sparkles className="text-indigo-600 dark:text-indigo-400"/> Gerar Questões</h3>
              </div>
              
              <div className="p-6">
                <div className="flex border border-slate-200 dark:border-slate-700 rounded-lg mb-6 overflow-hidden bg-white dark:bg-slate-800">
                    <button onClick={() => setAiMode('topic')} className={`flex-1 py-3 font-medium transition-colors ${aiMode === 'topic' ? 'bg-indigo-50 dark:bg-indigo-900/30 text-indigo-700 dark:text-indigo-300' : 'bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-700'}`}>Por Tópico</button>
                    <div className="w-px bg-slate-200 dark:bg-slate-700"></div>
                    <button onClick={() => setAiMode('document')} className={`flex-1 py-3 font-medium transition-colors ${aiMode === 'document' ? 'bg-indigo-50 dark:bg-indigo-900/30 text-indigo-700 dark:text-indigo-300' : 'bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-700'}`}>De Documento</button>
                </div>

                {aiMode === 'topic' ? (
                    <div className="space-y-4">
                        <label className="block text-sm font-bold text-slate-700 dark:text-slate-200">Tópico ou Conceito</label>
                        <input 
                            value={aiParams.topic} 
                            onChange={e => setAiParams({...aiParams, topic: e.target.value})} 
                            className="w-full border border-slate-300 dark:border-slate-600 rounded-lg px-4 py-3 text-slate-900 dark:text-slate-100 bg-white dark:bg-slate-700 focus:ring-2 focus:ring-indigo-500 outline-none shadow-sm" 
                            placeholder="Ex: Processo de fotossíntese..." 
                            autoFocus
                        />
                    </div>
                ) : (
                    <div 
                        className={`border-2 border-dashed rounded-xl p-8 text-center cursor-pointer transition-colors ${isDragging ? 'border-indigo-500 dark:border-indigo-400 bg-indigo-50 dark:bg-indigo-900/30' : 'border-slate-300 dark:border-slate-600 hover:border-indigo-400 dark:hover:border-indigo-500 hover:bg-slate-50 dark:hover:bg-slate-700'}`}
                        onClick={() => fileInputRef.current?.click()}
                        onDragOver={onDragOver}
                        onDragLeave={onDragLeave}
                        onDrop={onDrop}
                    >
                        <input type="file" className="hidden" ref={fileInputRef} onChange={e => e.target.files?.[0] && processFileForAI(e.target.files[0])} accept=".pdf,.docx,.xlsx" />
                        {isParsing ? (
                            <div className="flex flex-col items-center text-indigo-600 dark:text-indigo-400">
                                <Loader2 className="animate-spin mb-2" size={32}/>
                                <p className="font-medium">Lendo documento...</p>
                            </div>
                        ) : uploadedFileName ? (
                            <div className="flex flex-col items-center text-emerald-600 dark:text-emerald-400">
                                <FileText size={32} className="mb-2"/>
                                <p className="font-bold">{uploadedFileName}</p>
                                <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">Clique para alterar</p>
                            </div>
                        ) : (
                            <div className="flex flex-col items-center text-slate-500 dark:text-slate-400">
                                <Upload size={32} className="mb-2"/>
                                <p className="font-medium text-slate-700 dark:text-slate-300">Clique para enviar ou arraste o arquivo</p>
                                <p className="text-xs mt-1">PDF, DOCX, XLSX (Máx 5MB)</p>
                            </div>
                        )}
                    </div>
                )}
                
                {aiMode === 'document' && (
                    <div className="mt-4">
                         <label className="block text-sm font-bold text-slate-700 dark:text-slate-200 mb-2">Instruções (Opcional)</label>
                         <input 
                             value={aiParams.topic} 
                             onChange={e => setAiParams({...aiParams, topic: e.target.value})} 
                             className="w-full border border-slate-300 dark:border-slate-600 rounded-lg px-4 py-3 text-slate-900 dark:text-slate-100 bg-white dark:bg-slate-700 focus:ring-2 focus:ring-indigo-500 outline-none text-sm shadow-sm" 
                             placeholder="Focar em capítulo específico..." 
                         />
                    </div>
                )}

                <div className="grid grid-cols-3 gap-4 mt-4">
                    <div>
                        <label className="block text-xs font-bold text-slate-500 dark:text-slate-400 uppercase mb-1">Quantidade</label>
                        <select 
                            value={aiParams.count} 
                            onChange={e => setAiParams({...aiParams, count: parseInt(e.target.value)})} 
                            className="w-full border border-slate-300 dark:border-slate-600 rounded-lg px-3 py-2 text-slate-900 dark:text-slate-100 focus:ring-2 focus:ring-indigo-500 outline-none bg-white dark:bg-slate-700 shadow-sm cursor-pointer"
                        >
                            {[1, 2, 3, 4, 5, 6].map(num => <option key={num} value={num}>{num}</option>)}
                        </select>
                    </div>
                    <div>
                        <label className="block text-xs font-bold text-slate-500 dark:text-slate-400 uppercase mb-1">Série</label>
                        <select 
                            value={aiParams.gradeId} 
                            onChange={e => setAiParams({...aiParams, gradeId: e.target.value})} 
                            className="w-full border border-slate-300 dark:border-slate-600 rounded-lg px-3 py-2 text-slate-900 dark:text-slate-100 focus:ring-2 focus:ring-indigo-500 outline-none bg-white dark:bg-slate-700 shadow-sm cursor-pointer"
                        >
                            {grades.map(g => <option key={g.id} value={g.id}>{getGradeLabel(g)}</option>)}
                        </select>
                    </div>
                    <div>
                        <label className="block text-xs font-bold text-slate-500 dark:text-slate-400 uppercase mb-1">Dificuldade</label>
                        <select 
                            value={aiParams.difficulty} 
                            onChange={e => setAiParams({...aiParams, difficulty: e.target.value as any})} 
                            className="w-full border border-slate-300 dark:border-slate-600 rounded-lg px-3 py-2 text-slate-900 dark:text-slate-100 focus:ring-2 focus:ring-indigo-500 outline-none bg-white dark:bg-slate-700 shadow-sm cursor-pointer"
                        >
                            {['Easy','Medium','Hard'].map(d => <option key={d} value={d}>{d === 'Easy' ? 'Fácil' : d === 'Medium' ? 'Médio' : 'Difícil'}</option>)}
                        </select>
                    </div>
                </div>
              </div>

              <div className="p-6 border-t border-slate-100 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 flex justify-end gap-3">
                 <button onClick={() => setShowAiModal(false)} className="px-5 py-2.5 font-medium text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700 rounded-lg transition-colors">Cancelar</button>
                 <button onClick={handleGenerateAI} disabled={isGenerating} className="bg-indigo-600 dark:bg-indigo-700 hover:bg-indigo-700 dark:hover:bg-indigo-600 text-white px-6 py-2.5 rounded-lg font-bold flex items-center gap-2 shadow-lg shadow-indigo-200 dark:shadow-indigo-900/50 transition-all disabled:opacity-70 disabled:cursor-wait">
                    {isGenerating ? <Loader2 className="animate-spin" size={18}/> : <Sparkles size={18}/>} Gerar
                 </button>
              </div>
           </div>
        </div>
      )}

      {error ? (
        <div className="bg-red-50 dark:bg-red-900/30 border border-red-200 dark:border-red-800 rounded-xl p-8 text-center">
            <AlertTriangle className="mx-auto text-red-500 dark:text-red-400 mb-4" size={48} />
            <h3 className="text-lg font-bold text-red-700 dark:text-red-300 mb-2">Falha ao carregar Questões</h3>
            <p className="text-red-600 dark:text-red-400 mb-6">{error}</p>
            <button onClick={refresh} className="inline-flex items-center gap-2 px-4 py-2 bg-white dark:bg-slate-800 border border-red-200 dark:border-red-800 text-red-700 dark:text-red-400 rounded-lg hover:bg-red-100 dark:hover:bg-red-900/30 transition-colors font-medium"><RotateCcw size={16}/> Tentar Novamente</button>
        </div>
      ) : (
        <div className="grid gap-4">
            {loading ? (
                <div className="py-20 flex flex-col items-center justify-center text-slate-400">
                    <Loader2 className="animate-spin mb-4 text-indigo-500" size={40} />
                    <p className="font-medium">Carregando banco de questões...</p>
                </div>
            ) : filteredQuestions.length === 0 ? (
                <div className="py-20 bg-slate-50 dark:bg-slate-800/50 border border-dashed border-slate-300 dark:border-slate-700 rounded-xl flex flex-col items-center justify-center text-slate-500 dark:text-slate-400">
                    <FileQuestion size={48} className="mb-4 opacity-50"/>
                    <p className="text-lg font-bold">Nenhuma questão encontrada</p>
                    <p>Tente alterar os filtros ou adicione novo conteúdo.</p>
                </div>
            ) : paginatedQuestions.map(q => (
                <div key={q.id} className={`bg-white dark:bg-slate-800 p-6 rounded-xl border shadow-sm hover:shadow-md transition-all group ${q.deleted ? 'bg-red-50 dark:bg-red-900/20 border-red-200 dark:border-red-800 hover:border-red-300 dark:hover:border-red-700' : 'border-slate-200 dark:border-slate-700 hover:border-indigo-200 dark:hover:border-indigo-600'}`}>
                <div className="flex justify-between items-start mb-3">
                    <div className="flex gap-2">
                        <span className={`text-xs font-bold px-2 py-1 rounded uppercase tracking-wider ${q.difficulty === 'Hard' ? 'bg-red-100 text-red-700' : q.difficulty === 'Medium' ? 'bg-amber-100 text-amber-700' : 'bg-emerald-100 text-emerald-700'}`}>{q.difficulty}</span>
                        <span className="bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300 text-xs font-bold px-2 py-1 rounded uppercase tracking-wider">{q.subject}</span>
                        <span className="bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300 text-xs font-bold px-2 py-1 rounded uppercase tracking-wider">{q.school_grades?.name || 'Unassigned'}</span>
                        {q.deleted && <span className="bg-red-200 dark:bg-red-900/50 text-red-800 dark:text-red-300 text-[10px] px-1.5 py-0.5 rounded font-bold uppercase">Deleted</span>}
                    </div>
                    <div className="flex gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                        {!q.deleted && <button onClick={() => openEditModal(q)} className="p-2 text-slate-400 dark:text-slate-500 hover:text-indigo-600 dark:hover:text-indigo-400 hover:bg-indigo-50 dark:hover:bg-indigo-900/30 rounded transition-colors" title="Edit"><Pencil size={18}/></button>}
                        {isAdmin && q.deleted ? (
                            <button onClick={() => openRestoreModal(q)} className="p-2 text-emerald-600 dark:text-emerald-400 hover:text-emerald-800 dark:hover:text-emerald-300 hover:bg-emerald-50 dark:hover:bg-emerald-900/30 rounded transition-colors" title="Restore"><RotateCcw size={18}/></button>
                        ) : !q.deleted && (
                            <button onClick={() => openDeleteModal(q)} className="p-2 text-slate-400 dark:text-slate-500 hover:text-red-600 dark:hover:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/30 rounded transition-colors" title="Delete"><Trash2 size={18}/></button>
                        )}
                    </div>
                </div>
                
                <div className="flex flex-col gap-4">
                    <h4 className="font-semibold text-lg text-slate-800 dark:text-slate-100 leading-relaxed">{q.content}</h4>
                    
                    {q.image_url && (
                        <div className="w-full flex justify-center mb-2">
                            <img src={q.image_url} className="max-h-[400px] w-auto object-contain rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900" alt="Question Resource" />
                        </div>
                    )}

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                        {q.question_options?.map((o, idx) => (
                            <div key={idx} className={`flex gap-3 items-center text-sm p-3 rounded-lg border ${o.is_correct ? 'bg-emerald-50 dark:bg-emerald-900/30 border-emerald-200 dark:border-emerald-800 text-emerald-900 dark:text-emerald-200' : 'bg-slate-50 dark:bg-slate-700/50 border-transparent text-slate-600 dark:text-slate-300'}`}>
                                <span className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold border ${o.is_correct ? 'bg-emerald-500 dark:bg-emerald-600 border-emerald-500 dark:border-emerald-600 text-white' : 'bg-white dark:bg-slate-800 border-slate-300 dark:border-slate-600 text-slate-500 dark:text-slate-400'}`}>
                                    {o.key || String.fromCharCode(65+idx)}
                                </span>
                                <span className="font-medium">{o.content}</span>
                                {o.is_correct && <CheckCircle size={14} className="ml-auto text-emerald-500 dark:text-emerald-400"/>}
                            </div>
                        ))}
                    </div>
                </div>
                </div>
            ))}
        </div>
      )}

      {/* Pagination Controls */}
      {filteredQuestions.length > 0 && (
        <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 shadow-sm p-4">
          <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
            {/* Items per page selector and info */}
            <div className="flex items-center gap-4">
              <div className="flex items-center gap-2">
                <span className="text-sm text-slate-600 font-medium">Itens por página:</span>
                <select
                  value={itemsPerPage}
                  onChange={(e) => {
                    setItemsPerPage(Number(e.target.value));
                    setCurrentPage(1);
                  }}
                  className="border border-slate-300 rounded-lg px-3 py-1.5 text-sm text-slate-900 bg-white focus:ring-2 focus:ring-indigo-500 outline-none cursor-pointer"
                >
                  <option value={25}>25</option>
                  <option value={50}>50</option>
                  <option value={100}>100</option>
                  <option value={200}>200</option>
                </select>
              </div>
              <span className="text-sm text-slate-500">
                Mostrando {startIndex + 1} - {Math.min(endIndex, filteredQuestions.length)} de {filteredQuestions.length} {filteredQuestions.length !== 1 ? 'questões' : 'questão'}
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
                          : 'text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-600 border border-slate-300 dark:border-slate-600'
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
              <div className="flex items-center gap-2 ml-2 pl-2 border-l border-slate-300">
                <span className="text-xs text-slate-500">Ir para:</span>
                <input
                  type="number"
                  min={1}
                  max={totalPages}
                  value={currentPage}
                  onChange={(e) => {
                    const page = Math.max(1, Math.min(totalPages, Number(e.target.value) || 1));
                    setCurrentPage(page);
                  }}
                  className="w-16 border border-slate-300 rounded-lg px-2 py-1.5 text-sm text-slate-900 bg-white focus:ring-2 focus:ring-indigo-500 outline-none text-center"
                />
                <span className="text-xs text-slate-500">/ {totalPages}</span>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default QuestionManager;
