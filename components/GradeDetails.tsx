
import React, { useState, useEffect, useMemo } from 'react';
import { useSettingsManager } from '../presentation/hooks/useSettingsManager';
import { useBNCCManager } from '../presentation/hooks/useBNCCManager';
import { SchoolGrade, Discipline } from '../types';
import { ArrowLeft, BookOpen, Save, Loader2, Trash2, Plus, User, AlertCircle, CheckCircle, Edit2, X, Info, Library as LibraryIcon, ScrollText, ChevronRight, Home } from 'lucide-react';
import LibraryManager from './LibraryManager';
import { getSupabaseClient } from '../services/supabaseService';

interface GradeDetailsProps {
  grade: SchoolGrade;
  onBack: () => void;
  hasSupabase: boolean;
  readOnly?: boolean;
  allowLibraryEdit?: boolean; // New prop to override readOnly for libraries specifically
  onViewProfessor?: (professorId: string) => void;
}

const GradeDetails: React.FC<GradeDetailsProps> = ({ grade, onBack, hasSupabase, readOnly = false, allowLibraryEdit = false, onViewProfessor }) => {
  const { 
      professors, updateGrade, 
      disciplines, fetchDisciplines, addDiscipline, updateDiscipline, deleteDiscipline 
  } = useSettingsManager(hasSupabase);
  
  // Fetch BNCC items for displaying linked info
  const { items: bnccItems } = useBNCCManager(hasSupabase);
  const supabase = getSupabaseClient();

  // BNCC Relations State (many-to-many)
  const [disciplineBnccs, setDisciplineBnccs] = useState<Record<string, string[]>>({});

  const [activeTab, setActiveTab] = useState<'info' | 'disciplines' | 'libraries'>('info');

  const [formData, setFormData] = useState<Partial<SchoolGrade>>({
      name: grade.name,
      level: grade.level,
      description: grade.description || ''
  });
  const [isSaving, setIsSaving] = useState(false);

  // Discipline Form
  const [discName, setDiscName] = useState('');
  const [discDesc, setDiscDesc] = useState('');
  const [discProfId, setDiscProfId] = useState('');
  const [isAddingDisc, setIsAddingDisc] = useState(false);
  const [editingDiscId, setEditingDiscId] = useState<string | null>(null);

  useEffect(() => {
      fetchDisciplines(grade.id);
  }, [grade.id]);

  // Fetch BNCC Relations when disciplines change
  useEffect(() => {
      const fetchBnccRelations = async () => {
          if (!supabase || disciplines.length === 0) return;
          const ids = disciplines.map(d => d.id);
          const { data, error } = await supabase
              .from('disciplines_bnccs')
              .select('discipline_id, bncc_id')
              .in('discipline_id', ids);
          
          if (data) {
              const map: Record<string, string[]> = {};
              data.forEach((row: any) => {
                  if (!map[row.discipline_id]) map[row.discipline_id] = [];
                  map[row.discipline_id].push(row.bncc_id);
              });
              setDisciplineBnccs(map);
          }
      };
      fetchBnccRelations();
  }, [disciplines, supabase]);

  // Filter professors to show only those from the same institution as the grade
  const institutionProfessors = useMemo(() => {
      return professors.filter(p => {
          // Check deep nesting first if available
          if (p.departments?.institutions?.id === grade.institution_id) return true;
          return false;
      });
  }, [professors, grade.institution_id]);

  const handleUpdate = async (e: React.FormEvent) => {
      e.preventDefault();
      setIsSaving(true);
      try {
          const success = await updateGrade(grade.id, formData);
          if (success) {
              alert('Série atualizada com sucesso!');
          }
      } finally {
          setIsSaving(false);
      }
  };

  const handleSaveDiscipline = async (e: React.FormEvent) => {
      e.preventDefault();
      setIsAddingDisc(true);
      try {
          const payload = {
              name: discName,
              description: discDesc,
              grade_id: grade.id,
              professor_id: discProfId || null
          };

          if (editingDiscId) {
              await updateDiscipline(editingDiscId, payload);
          } else {
              await addDiscipline(payload);
          }
          
          // Reset form
          setDiscName('');
          setDiscDesc('');
          setDiscProfId('');
          setEditingDiscId(null);
      } finally {
          setIsAddingDisc(false);
      }
  };

  const handleEditDiscipline = (d: Discipline) => {
      if (readOnly) return;
      setDiscName(d.name);
      setDiscDesc(d.description || '');
      setDiscProfId(d.professor_id || '');
      setEditingDiscId(d.id);
      // Scroll to top of form smoothly
      window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleCancelEdit = () => {
      setDiscName('');
      setDiscDesc('');
      setDiscProfId('');
      setEditingDiscId(null);
  };

  // Helper to get professor name safely
  const getProfName = (pId?: string | null) => {
      if (!pId) return null;
      const p = professors.find(prof => prof.id === pId);
      return p ? p.name : 'Unknown';
  };

  // Helper to get BNCC info by ID
  const getBnccInfo = (bnccId?: string | null) => {
      if (!bnccId) return null;
      return bnccItems.find(b => b.id === bnccId && !b.deleted);
  };

  // Helper to get all BNCC items for a discipline (many-to-many)
  const getDisciplineBnccs = (disciplineId: string) => {
      const bnccIds = disciplineBnccs[disciplineId] || [];
      return bnccIds.map(id => getBnccInfo(id)).filter(b => b !== null);
  };

  // Logic: Library is read-only if the page is read-only AND allowLibraryEdit is false.
  // If allowLibraryEdit is true, we ignore the global readOnly for the library component.
  const isLibraryReadOnly = readOnly && !allowLibraryEdit;

  return (
    <div className="space-y-6 animate-in fade-in slide-in-from-right-4 duration-300">

        <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
                <button onClick={onBack} className="p-2 hover:bg-slate-200 dark:hover:bg-slate-700 rounded-full transition-colors text-slate-500 dark:text-slate-400">
                    <ArrowLeft size={24}/>
                </button>
                <div>
                    <h2 className="text-2xl font-bold text-slate-900 dark:text-slate-100">{formData.name}</h2>
                    <p className="text-slate-500 dark:text-slate-400 text-sm">{grade.institutions?.name}</p>
                </div>
            </div>
        </div>

        {/* Tabs */}
        <div className="flex border-b border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800">
            <button 
                onClick={() => setActiveTab('info')}
                className={`px-6 py-3 text-sm font-bold border-b-2 transition-colors ${activeTab === 'info' ? 'border-indigo-600 dark:border-indigo-400 text-indigo-600 dark:text-indigo-400' : 'border-transparent text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-700'}`}
            >
                Visão Geral
            </button>
            <button 
                onClick={() => setActiveTab('disciplines')}
                className={`px-6 py-3 text-sm font-bold border-b-2 transition-colors ${activeTab === 'disciplines' ? 'border-indigo-600 dark:border-indigo-400 text-indigo-600 dark:text-indigo-400' : 'border-transparent text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-700'}`}
            >
                Currículo
            </button>
            <button 
                onClick={() => setActiveTab('libraries')}
                className={`px-6 py-3 text-sm font-bold border-b-2 transition-colors ${activeTab === 'libraries' ? 'border-indigo-600 dark:border-indigo-400 text-indigo-600 dark:text-indigo-400' : 'border-transparent text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-700'}`}
            >
                Bibliotecas
            </button>
        </div>

        {activeTab === 'libraries' && (
            <LibraryManager 
                hasSupabase={hasSupabase} 
                gradeId={grade.id} 
                gradeName={grade.name} // PASS NAME
                readOnly={isLibraryReadOnly} 
            />
        )}

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
            {/* Grade Info / Edit Form */}
            {activeTab === 'info' && (
                <div className="lg:col-span-2 bg-white dark:bg-slate-800 p-6 rounded-xl border border-slate-200 dark:border-slate-700 shadow-sm h-fit">
                    <h3 className="font-bold text-slate-800 dark:text-slate-100 mb-4 flex items-center gap-2">
                        {readOnly ? <Info size={18} className="text-indigo-600 dark:text-indigo-400"/> : <Edit2 size={18} className="text-indigo-600 dark:text-indigo-400"/>}
                        {readOnly ? 'Informações da Série' : 'Editar Detalhes da Série'}
                    </h3>
                    
                    {readOnly ? (
                        <div className="space-y-4">
                            <div>
                                <span className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase block mb-1">Nome da Série</span>
                                <p className="text-slate-900 dark:text-slate-100 font-medium">{grade.name}</p>
                            </div>
                            <div>
                                <span className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase block mb-1">Nível</span>
                                <p className="text-slate-900 dark:text-slate-100 font-medium">{grade.level}</p>
                            </div>
                            <div>
                                <span className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase block mb-1">Descrição</span>
                                <p className="text-slate-600 dark:text-slate-300 text-sm">{grade.description || 'Nenhuma descrição fornecida.'}</p>
                            </div>
                        </div>
                    ) : (
                        <form onSubmit={handleUpdate} className="space-y-4">
                            <div>
                                <label className="block text-xs font-bold text-slate-500 dark:text-slate-400 uppercase mb-1">Nome da Série</label>
                                <input 
                                    required 
                                    value={formData.name} 
                                    onChange={e => setFormData({...formData, name: e.target.value})} 
                                    className="w-full px-3 py-2 border border-slate-300 dark:border-slate-600 rounded-lg outline-none focus:ring-2 focus:ring-indigo-500 text-sm text-slate-900 dark:text-slate-100 bg-white dark:bg-slate-700" 
                                />
                            </div>
                            <div>
                                <label className="block text-xs font-bold text-slate-500 dark:text-slate-400 uppercase mb-1">Nível (Ordenação)</label>
                                <input 
                                    required 
                                    type="number"
                                    value={formData.level} 
                                    onChange={e => setFormData({...formData, level: parseInt(e.target.value)})} 
                                    className="w-full px-3 py-2 border border-slate-300 dark:border-slate-600 rounded-lg outline-none focus:ring-2 focus:ring-indigo-500 text-sm text-slate-900 dark:text-slate-100 bg-white dark:bg-slate-700" 
                                />
                            </div>
                            <div>
                                <label className="block text-xs font-bold text-slate-500 dark:text-slate-400 uppercase mb-1">Descrição</label>
                                <textarea 
                                    value={formData.description} 
                                    onChange={e => setFormData({...formData, description: e.target.value})} 
                                    className="w-full px-3 py-2 border border-slate-300 dark:border-slate-600 rounded-lg outline-none focus:ring-2 focus:ring-indigo-500 text-sm text-slate-900 dark:text-slate-100 h-24 resize-none bg-white dark:bg-slate-700" 
                                />
                            </div>
                            <button disabled={isSaving} className="w-full bg-indigo-600 text-white py-2.5 rounded-lg font-bold hover:bg-indigo-700 transition-all flex items-center justify-center gap-2 shadow-sm disabled:opacity-70">
                                {isSaving ? <Loader2 size={16} className="animate-spin"/> : <Save size={16}/>} Salvar Alterações
                            </button>
                        </form>
                    )}
                </div>
            )}

            {/* Disciplines Management */}
            {activeTab === 'disciplines' && (
                <div className="col-span-full space-y-6">
                    <div className="bg-white dark:bg-slate-800 p-6 rounded-xl border border-slate-200 dark:border-slate-700 shadow-sm">
                        <h3 className="font-bold text-slate-800 dark:text-slate-100 mb-4 flex items-center gap-2">
                            <BookOpen size={18} className="text-indigo-600 dark:text-indigo-400"/> 
                            {readOnly ? 'Currículo (Disciplinas)' : (editingDiscId ? 'Editar Disciplina' : 'Gerenciar Currículo (Disciplinas)')}
                        </h3>
                        
                        {/* Add/Edit Discipline Form - Hidden in ReadOnly */}
                        {!readOnly && (
                            <form onSubmit={handleSaveDiscipline} className={`flex flex-col sm:flex-row gap-3 mb-6 p-4 rounded-lg border transition-colors ${editingDiscId ? 'bg-indigo-50 dark:bg-indigo-900/20 border-indigo-200 dark:border-indigo-800' : 'bg-slate-50 dark:bg-slate-700 border-slate-200 dark:border-slate-600'}`}>
                                <div className="flex-1 space-y-2">
                                    <input 
                                        required 
                                        value={discName} 
                                        onChange={e => setDiscName(e.target.value)} 
                                        className="w-full px-3 py-2 border border-slate-300 dark:border-slate-600 rounded-lg outline-none focus:ring-2 focus:ring-indigo-500 text-sm bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100" 
                                        placeholder="Nome da Disciplina (ex: História)"
                                    />
                                    <select 
                                        value={discProfId} 
                                        onChange={e => setDiscProfId(e.target.value)} 
                                        className="w-full px-3 py-2 border border-slate-300 dark:border-slate-600 rounded-lg outline-none focus:ring-2 focus:ring-indigo-500 text-sm bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 cursor-pointer"
                                    >
                                        <option value="">-- Atribuir Professor --</option>
                                        {institutionProfessors.map(p => <option key={p.id} value={p.id}>{p.name} ({p.department})</option>)}
                                    </select>
                                    {institutionProfessors.length === 0 && (
                                        <p className="text-[10px] text-amber-600 dark:text-amber-400">Nenhum professor encontrado para esta instituição.</p>
                                    )}
                                </div>
                                <div className="flex flex-col gap-2 w-full sm:w-auto">
                                    <textarea 
                                        value={discDesc} 
                                        onChange={e => setDiscDesc(e.target.value)} 
                                        className="w-full px-3 py-2 border border-slate-300 dark:border-slate-600 rounded-lg outline-none focus:ring-2 focus:ring-indigo-500 text-sm h-[42px] resize-none bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100" 
                                        placeholder="Descrição..."
                                    />
                                    <div className="flex gap-2">
                                        {editingDiscId && (
                                            <button type="button" onClick={handleCancelEdit} className="bg-white dark:bg-slate-700 border border-slate-300 dark:border-slate-600 text-slate-600 dark:text-slate-300 px-3 py-2 rounded-lg font-bold text-sm hover:bg-slate-50 dark:hover:bg-slate-600 transition-all h-[42px]" title="Cancel Edit">
                                                <X size={16}/>
                                            </button>
                                        )}
                                        <button disabled={isAddingDisc} className="flex-1 bg-indigo-600 text-white px-4 py-2 rounded-lg font-bold text-sm hover:bg-indigo-700 transition-all flex items-center justify-center gap-2 disabled:opacity-70 h-[42px]">
                                            {isAddingDisc ? <Loader2 size={16} className="animate-spin"/> : (editingDiscId ? <Save size={16}/> : <Plus size={16}/>)} 
                                            {editingDiscId ? 'Atualizar' : 'Adicionar'}
                                        </button>
                                    </div>
                                </div>
                            </form>
                        )}

                        {/* List */}
                        <div className="space-y-3">
                            {disciplines.length === 0 ? (
                                <div className="text-center py-10 text-slate-400 dark:text-slate-500 border-2 border-dashed border-slate-100 dark:border-slate-700 rounded-xl">
                                    <p>Nenhuma disciplina atribuída a esta série.</p>
                                </div>
                            ) : disciplines.map(d => {
                                const linkedBnccs = getDisciplineBnccs(d.id);
                                return (
                                    <div key={d.id} className={`flex justify-between items-start p-4 border rounded-xl transition-all group ${editingDiscId === d.id ? 'border-indigo-500 dark:border-indigo-400 ring-1 ring-indigo-500 dark:ring-indigo-400 bg-indigo-50/50 dark:bg-indigo-900/20' : 'border-slate-200 dark:border-slate-700 hover:border-indigo-200 dark:hover:border-indigo-600 bg-white dark:bg-slate-800'}`}>
                                        <div className="flex-1">
                                            <div className="flex items-center gap-2 mb-1 flex-wrap">
                                                <h4 className="font-bold text-slate-800 dark:text-slate-100">{d.name}</h4>
                                                {d.professor_id ? (
                                                    <span className="text-[10px] bg-emerald-50 dark:bg-emerald-900/30 text-emerald-600 dark:text-emerald-300 px-2 py-0.5 rounded border border-emerald-100 dark:border-emerald-800 flex items-center gap-1 font-bold uppercase"><CheckCircle size={10}/> Ativo</span>
                                                ) : (
                                                    <span className="text-[10px] bg-amber-50 dark:bg-amber-900/30 text-amber-600 dark:text-amber-300 px-2 py-0.5 rounded border border-amber-100 dark:border-amber-800 flex items-center gap-1 font-bold uppercase"><AlertCircle size={10}/> Sem Professor</span>
                                                )}
                                            </div>
                                            <p className="text-xs text-slate-500 dark:text-slate-400 mb-2">{d.description || "Sem descrição fornecida."}</p>
                                            
                                            <div className="flex flex-wrap gap-2">
                                                <div className="flex items-center gap-2 text-xs text-slate-600 dark:text-slate-300 bg-slate-50 dark:bg-slate-700 px-2 py-1 rounded">
                                                    <User size={12}/>
                                                    <span className="font-medium">Professor:</span>
                                                    {d.professor_id ? (
                                                        <span 
                                                          onClick={(e) => { e.stopPropagation(); onViewProfessor?.(d.professor_id!); }}
                                                          className={onViewProfessor ? 'cursor-pointer hover:text-indigo-600 dark:hover:text-indigo-400 hover:underline transition-colors' : ''}
                                                        >
                                                          {getProfName(d.professor_id)}
                                                        </span>
                                                    ) : (
                                                        !readOnly ? (
                                                            <button 
                                                                onClick={(e) => {
                                                                    e.stopPropagation();
                                                                    handleEditDiscipline(d);
                                                                }} 
                                                                className="text-indigo-600 dark:text-indigo-400 font-bold hover:text-indigo-800 dark:hover:text-indigo-300 flex items-center gap-1 transition-colors hover:underline"
                                                            >
                                                                <Plus size={10} strokeWidth={3} /> Atribuir
                                                            </button>
                                                        ) : (
                                                            <span className="text-slate-400 dark:text-slate-500 italic">Não atribuído</span>
                                                        )
                                                    )}
                                                </div>

                                                {/* BNCC Badges - Many-to-Many (Read-only for Teachers) */}
                                                {linkedBnccs.length > 0 ? (
                                                    <div className="flex flex-wrap gap-1">
                                                        {linkedBnccs.map((bncc) => (
                                                            bncc && (
                                                                <div key={bncc.id} className="group/bncc relative">
                                                                    <div className="flex items-center gap-1 text-xs bg-purple-50 dark:bg-purple-900/30 text-purple-700 dark:text-purple-300 px-2 py-1 rounded border border-purple-200 dark:border-purple-800 cursor-help">
                                                                        <ScrollText size={12}/>
                                                                        <span className="font-bold">{bncc.codigo_alfanumerico}</span>
                                                                    </div>
                                                                    {/* Tooltip */}
                                                                    <div className="absolute z-20 hidden group-hover/bncc:block w-72 p-3 bg-slate-800 dark:bg-slate-900 text-white text-xs rounded-lg shadow-xl -top-2 left-full ml-2">
                                                                        <div className="font-bold text-purple-300 mb-1">{bncc.componente_curricular}</div>
                                                                        {bncc.ano_serie && <div className="text-slate-400 mb-1">{bncc.ano_serie}</div>}
                                                                        <p className="line-clamp-4">{bncc.descricao_habilidade}</p>
                                                                        {bncc.unidade_tematica && (
                                                                            <div className="mt-2 pt-2 border-t border-slate-600 text-slate-400">
                                                                                <span className="font-medium">Unidade:</span> {bncc.unidade_tematica}
                                                                            </div>
                                                                        )}
                                                                    </div>
                                                                </div>
                                                            )
                                                        ))}
                                                    </div>
                                                ) : (
                                                    <span className="text-[10px] text-slate-400 dark:text-slate-500 italic px-2 py-1">BNCC não vinculada</span>
                                                )}
                                            </div>
                                        </div>
                                        {!readOnly && (
                                            <div className="flex gap-1 shrink-0">
                                                    <button onClick={() => handleEditDiscipline(d)} className="p-2 text-slate-400 dark:text-slate-500 hover:text-indigo-600 dark:hover:text-indigo-400 hover:bg-indigo-50 dark:hover:bg-indigo-900/30 rounded-lg transition-colors" title="Editar disciplina">
                                                        <Edit2 size={16}/>
                                                    </button>
                                                    <button onClick={() => deleteDiscipline(d.id, grade.id)} className="p-2 text-slate-400 dark:text-slate-500 hover:text-red-600 dark:hover:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/30 rounded-lg transition-colors" title="Excluir disciplina">
                                                    <Trash2 size={16}/>
                                                </button>
                                            </div>
                                        )}
                                    </div>
                                );
                            })}
                        </div>
                    </div>
                </div>
            )}
        </div>
    </div>
  );
};

export default GradeDetails;
