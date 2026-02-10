
import React, { useState, useEffect, useMemo } from 'react';
import { useSettingsManager } from '../presentation/hooks/useSettingsManager';
import { SchoolGrade } from '../types';
import { GraduationCap, Plus, Trash2, Edit2, Loader2, Building2, AlertTriangle, RotateCcw, BookOpen, FileText, SortAsc, Eye, CheckCircle, Lock, ChevronRight, ChevronLeft, Home, X } from 'lucide-react';
import GradeDetails from './GradeDetails';
import ProfessorManager from './ProfessorManager';
import ConfirmationModal from './ConfirmationModal';

interface GradeManagerProps {
  hasSupabase: boolean;
  readOnly?: boolean;
  institutionId?: string;
  initialGradeId?: string;
  onBack?: () => void;
}

const GradeManager: React.FC<GradeManagerProps> = ({ hasSupabase, readOnly = false, institutionId, initialGradeId, onBack }) => {
  const { 
      grades, institutions, loading, error, 
      addGrade, updateGrade, deleteGrade, restoreGrade,
      refresh, isAdmin, showDeleted, setShowDeleted
  } = useSettingsManager(hasSupabase, institutionId);

  const [view, setView] = useState<'list' | 'detail' | 'professor'>('list');
  const [selectedGrade, setSelectedGrade] = useState<SchoolGrade | null>(null);
  const [selectedInstId, setSelectedInstId] = useState(institutionId || '');
  const [selectedProfessorId, setSelectedProfessorId] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  
  // Filter and Pagination State
  const [filterLevel, setFilterLevel] = useState<number | ''>('');
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(50);

  // Manager mode and context
  const isManagerMode = !!institutionId || institutions.length === 1;
  const hasInstitutionContext = isManagerMode || !!selectedInstId;
  
  // Form State
  const [formData, setFormData] = useState<{name: string, level: number, description: string}>({
      name: '',
      level: 9,
      description: ''
  });

  // Modal State
  const [modalConfig, setModalConfig] = useState<{
      isOpen: boolean;
      id: string | null;
      action: 'delete' | 'restore';
      name: string;
  }>({ isOpen: false, id: null, action: 'delete', name: '' });
  const [isActionLoading, setIsActionLoading] = useState(false);

  // Force update selectedInstId if prop changes
  useEffect(() => {
      if (institutionId) {
          setSelectedInstId(institutionId);
      } else if (institutions.length === 1) {
          setSelectedInstId(institutions[0].id);
      }
  }, [institutionId, institutions]);

  // Reload when showDeleted changes
  useEffect(() => {
      if (selectedInstId) {
          refresh();
      }
  }, [showDeleted]);

  // Handle initial grade ID for drill-down navigation
  useEffect(() => {
      if (initialGradeId && grades.length > 0 && !selectedGrade) {
          const grade = grades.find(g => g.id === initialGradeId);
          if (grade) {
              setSelectedGrade(grade);
              setView('detail');
          }
      }
  }, [initialGradeId, grades]);

  // Filter grades by institution, level and deleted status
  const filteredGrades = useMemo(() => {
      let filtered = grades;
      
      if (selectedInstId) {
          filtered = filtered.filter(g => g.institution_id === selectedInstId);
      } else if (institutionId) {
          filtered = [];
      }
      
      // Filter by level
      if (filterLevel !== '') {
          filtered = filtered.filter(g => g.level === filterLevel);
      }
      
      // Filter by deleted status based on showDeleted flag
      if (!showDeleted) {
          filtered = filtered.filter(g => !g.deleted);
      }
      
      return filtered;
  }, [grades, selectedInstId, institutionId, showDeleted, filterLevel]);

  // Pagination calculations
  const totalPages = Math.ceil(filteredGrades.length / itemsPerPage);
  const startIndex = (currentPage - 1) * itemsPerPage;
  const endIndex = startIndex + itemsPerPage;
  const paginatedGrades = useMemo(() => {
      return filteredGrades.slice(startIndex, endIndex);
  }, [filteredGrades, startIndex, endIndex]);

  // Reset page when filters change
  useEffect(() => {
      setCurrentPage(1);
  }, [selectedInstId, filterLevel]);

  // Get unique levels for filter
  const availableLevels = useMemo(() => {
      const activeInstId = institutionId || selectedInstId;
      if (!activeInstId) return [];
      const instGrades = grades.filter(g => g.institution_id === activeInstId);
      const levels = [...new Set(instGrades.map(g => g.level))].sort((a, b) => a - b);
      return levels;
  }, [grades, institutionId, selectedInstId]);

  const handleInstChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
      setSelectedInstId(e.target.value);
  };

  const handleSave = async (e: React.FormEvent) => {
      e.preventDefault();
      if (!selectedInstId) return alert("Por favor, selecione uma instituição");
      if (!formData.name) return alert("O nome da série é obrigatório");
      
      setIsSubmitting(true);
      try {
          if (editingId) {
              await updateGrade(editingId, { 
                  name: formData.name, 
                  level: formData.level, 
                  institution_id: selectedInstId,
                  description: formData.description 
              });
          } else {
              await addGrade({ 
                  name: formData.name, 
                  level: formData.level, 
                  institution_id: selectedInstId,
                  description: formData.description 
              });
          }
          setShowForm(false);
          setFormData({ name: '', level: 9, description: '' });
          setEditingId(null);
      } finally {
          setIsSubmitting(false);
      }
  };

  const handleEdit = (g: SchoolGrade) => {
      setEditingId(g.id);
      setFormData({ name: g.name, level: g.level, description: g.description || '' });
      setShowForm(true);
      window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleCancel = () => {
      setShowForm(false);
      setEditingId(null);
      setFormData({ name: '', level: 9, description: '' });
  };

  const handleViewProfessor = (professorId: string) => {
    setSelectedProfessorId(professorId);
    setView('professor');
  };
  
  const handleBackToGrade = () => {
    setView('detail');
    setSelectedProfessorId(null);
  };

  const openDeleteModal = (g: SchoolGrade) => {
      setModalConfig({ isOpen: true, id: g.id, action: 'delete', name: g.name });
  };

  const openRestoreModal = (g: SchoolGrade) => {
      setModalConfig({ isOpen: true, id: g.id, action: 'restore', name: g.name });
  };

  const executeAction = async () => {
      if (!modalConfig.id) return;
      setIsActionLoading(true);
      try {
          if (modalConfig.action === 'delete') {
              await deleteGrade(modalConfig.id);
          } else {
              await restoreGrade(modalConfig.id);
          }
          setModalConfig({ ...modalConfig, isOpen: false });
      } finally {
          setIsActionLoading(false);
      }
  };

  if (!hasSupabase) return <div className="p-8 text-center text-slate-500 dark:text-slate-400">Configure o banco de dados primeiro.</div>;

  // Render professor drill-down view
  if (view === 'professor' && selectedProfessorId) {
      return (
        <ProfessorManager 
          hasSupabase={hasSupabase} 
          institutionId={institutionId}
          initialProfessorId={selectedProfessorId}
          onBack={handleBackToGrade}
        />
      );
  }

  if (selectedGrade) {
      return (
        <GradeDetails 
          grade={selectedGrade} 
          onBack={() => {
              if (onBack) {
                  onBack();
              } else {
                  setSelectedGrade(null);
                  setView('list');
              }
          }} 
          hasSupabase={hasSupabase}
          readOnly={readOnly}
          onViewProfessor={handleViewProfessor}
        />
      );
  }

  return (
    <div className="max-w-6xl mx-auto space-y-8">
        <div className="flex justify-between items-center">
            <div>
                <h2 className="text-3xl font-bold text-slate-900 dark:text-slate-100">Séries</h2>
                <p className="text-slate-500 dark:text-slate-400 mt-1">Gerencie as séries e anos letivos das instituições</p>
            </div>
            <div className="flex gap-3 items-center">
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
                {hasInstitutionContext && !readOnly && (
                    <button onClick={() => { setShowForm(!showForm); if (showForm) handleCancel(); }} className="bg-indigo-600 hover:bg-indigo-700 text-white px-5 py-2.5 rounded-xl font-bold flex items-center gap-2 shadow-lg shadow-indigo-200 transition-all">
                        {showForm ? 'Cancelar' : <><Plus size={20}/> Nova Série</>}
                    </button>
                )}
            </div>
        </div>

        {/* Institution Selector for Admin */}
        {!isManagerMode && (
            <div className="bg-white dark:bg-slate-800 p-4 rounded-xl border border-slate-200 dark:border-slate-700 shadow-sm">
                <label className="block text-xs font-bold text-slate-500 dark:text-slate-400 uppercase mb-1">Contexto da Instituição</label>
                <div className="relative">
                    <Building2 size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 dark:text-slate-500"/>
                    <select 
                        value={selectedInstId} 
                        onChange={(e) => {
                            handleInstChange(e);
                            setFilterLevel(''); // Reset level filter when institution changes
                        }} 
                        className="w-full border border-slate-300 dark:border-slate-600 rounded-lg pl-10 pr-4 py-2 text-slate-900 dark:text-slate-100 bg-white dark:bg-slate-700 focus:ring-2 focus:ring-indigo-500 outline-none cursor-pointer"
                    >
                        <option value="">Selecione a Instituição</option>
                        {institutions.map(i => <option key={i.id} value={i.id}>{i.name}</option>)}
                    </select>
                </div>
            </div>
        )}

        {/* Filters Section - Only show when institution is selected */}
        {hasInstitutionContext && !showForm && (
          <div className="bg-white dark:bg-slate-800 p-4 rounded-xl border border-slate-200 dark:border-slate-700 shadow-sm">
            <div className="flex items-center gap-2 mb-3">
              <GraduationCap size={16} className="text-indigo-600"/>
              <h3 className="text-sm font-bold text-slate-700 dark:text-slate-200 uppercase">Filtros de Listagem</h3>
              <span className="text-xs text-slate-500 dark:text-slate-400 ml-auto">
                {filteredGrades.length} série{filteredGrades.length !== 1 ? 's' : ''} encontrada{filteredGrades.length !== 1 ? 's' : ''}
              </span>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-bold text-slate-500 dark:text-slate-400 uppercase mb-1">Nível</label>
                <div className="relative">
                  <SortAsc size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 dark:text-slate-500"/>
                  <select 
                    value={filterLevel} 
                    onChange={e => setFilterLevel(e.target.value === '' ? '' : Number(e.target.value))} 
                    className="w-full border border-slate-300 dark:border-slate-600 rounded-lg pl-10 pr-4 py-2 text-sm text-slate-900 dark:text-slate-100 bg-white dark:bg-slate-700 focus:ring-2 focus:ring-indigo-500 outline-none cursor-pointer"
                  >
                    <option value="">Todos os Níveis</option>
                    {availableLevels.map(level => <option key={level} value={level}>Nível {level}</option>)}
                  </select>
                </div>
              </div>
              <div className="flex items-end">
                <button
                  onClick={() => {
                    setFilterLevel('');
                  }}
                  className="w-full bg-slate-100 dark:bg-slate-700 hover:bg-slate-200 dark:hover:bg-slate-600 text-slate-700 dark:text-slate-200 px-4 py-2 rounded-lg text-sm font-bold flex items-center justify-center gap-2 transition-colors"
                >
                  <X size={16}/> Limpar Filtros
                </button>
              </div>
            </div>
          </div>
        )}

        {/* No Institution Selected Message */}
        {!hasInstitutionContext && !loading && (
            <div className="bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-xl p-8 text-center">
                <Building2 size={48} className="mx-auto text-amber-400 dark:text-amber-500 mb-4"/>
                <h3 className="text-lg font-bold text-amber-800 dark:text-amber-300 mb-2">Nenhuma Instituição Selecionada</h3>
                <p className="text-amber-600 dark:text-amber-400 text-sm">Selecione uma instituição acima para visualizar e gerenciar as séries.</p>
            </div>
        )}

        {error && (
            <div className="bg-red-50 dark:bg-red-900/30 border border-red-200 dark:border-red-800 rounded-xl p-4 flex gap-3 text-red-700 dark:text-red-300 items-center">
                <AlertTriangle size={20}/> {error}
            </div>
        )}

        <ConfirmationModal
            isOpen={modalConfig.isOpen}
            onClose={() => setModalConfig({ ...modalConfig, isOpen: false })}
            onConfirm={executeAction}
            title={modalConfig.action === 'delete' ? "Excluir Série" : "Restaurar Série"}
            message={
                modalConfig.action === 'delete' 
                ? <span>Tem certeza que deseja excluir <strong>{modalConfig.name}</strong>? Esta ação pode afetar turmas vinculadas a esta série.</span>
                : <span>Tem certeza que deseja restaurar <strong>{modalConfig.name}</strong>?</span>
            }
            confirmLabel={modalConfig.action === 'delete' ? "Excluir" : "Restaurar"}
            isDestructive={modalConfig.action === 'delete'}
            isLoading={isActionLoading}
        />

        {hasInstitutionContext && showForm && !readOnly && (
            <form onSubmit={handleSave} className="bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-xl overflow-hidden animate-in fade-in slide-in-from-top-4">
                <div className="p-6 bg-slate-50 dark:bg-slate-900 border-b border-slate-100 dark:border-slate-700 mb-6">
                    <h3 className="font-bold text-lg text-slate-800 dark:text-slate-100">{editingId ? 'Editar Série' : 'Cadastrar Nova Série'}</h3>
                </div>

                <div className="p-8 grid grid-cols-1 md:grid-cols-2 gap-8">
                    <div className="space-y-6">
                        <div>
                            <label className="block text-xs font-bold text-slate-500 dark:text-slate-400 uppercase mb-1">Nome da Série *</label>
                            <div className="relative">
                                <GraduationCap size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 dark:text-slate-500"/>
                                <input 
                                    required 
                                    value={formData.name} 
                                    onChange={e => setFormData({...formData, name: e.target.value})} 
                                    className="w-full pl-9 pr-3 py-2 border border-slate-300 dark:border-slate-600 rounded-lg outline-none focus:ring-2 focus:ring-indigo-500 bg-white dark:bg-slate-700 text-slate-900 dark:text-slate-100"
                                    placeholder="ex: 9º Ano"
                                />
                            </div>
                        </div>

                        <div>
                            <label className="block text-xs font-bold text-slate-500 dark:text-slate-400 uppercase mb-1">Nível de Ordenação *</label>
                            <div className="relative">
                                <SortAsc size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 dark:text-slate-500"/>
                                <input 
                                    required 
                                    type="number" 
                                    value={formData.level} 
                                    onChange={e => setFormData({...formData, level: parseInt(e.target.value) || 9})} 
                                    className="w-full pl-9 pr-3 py-2 border border-slate-300 dark:border-slate-600 rounded-lg outline-none focus:ring-2 focus:ring-indigo-500 bg-white dark:bg-slate-700 text-slate-900 dark:text-slate-100"
                                />
                            </div>
                            <p className="text-[10px] text-slate-400 dark:text-slate-500 mt-1">Valor numérico para ordenação (ex: 9 para o 9º Ano).</p>
                        </div>

                        <div>
                            <label className="block text-xs font-bold text-slate-500 dark:text-slate-400 uppercase mb-1">Descrição</label>
                            <div className="relative">
                                <FileText size={16} className="absolute left-3 top-3 text-slate-400 dark:text-slate-500"/>
                                <textarea 
                                    value={formData.description} 
                                    onChange={e => setFormData({...formData, description: e.target.value})} 
                                    className="w-full pl-9 pr-3 py-2 border border-slate-300 dark:border-slate-600 rounded-lg outline-none focus:ring-2 focus:ring-indigo-500 bg-white dark:bg-slate-700 text-slate-900 dark:text-slate-100 min-h-[80px] resize-none"
                                    placeholder="Detalhes opcionais..."
                                />
                            </div>
                        </div>
                    </div>

                    <div className="space-y-6">
                        <div className="bg-indigo-50 dark:bg-indigo-900/30 p-4 rounded-xl border border-indigo-100 dark:border-indigo-800">
                            <h5 className="font-bold text-indigo-900 dark:text-indigo-200 mb-3 text-sm flex items-center gap-2"><Building2 size={16}/> Vínculo Institucional</h5>
                            <div>
                                <label className="block text-xs font-bold text-indigo-700 dark:text-indigo-300 uppercase mb-1">Instituição</label>
                                {isManagerMode ? (
                                    <div className="w-full border border-indigo-200 dark:border-indigo-700 bg-white dark:bg-slate-700 rounded-lg px-4 py-2 text-indigo-900 dark:text-indigo-200 flex items-center gap-2">
                                        <Lock size={14}/>
                                        <span className="font-medium">{institutions.find(i => i.id === selectedInstId)?.name || "Instituição Atual"}</span>
                                    </div>
                                ) : (
                                    <div className="relative">
                                        <Building2 size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-indigo-400 dark:text-indigo-500"/>
                                        <select 
                                            required 
                                            value={selectedInstId} 
                                            onChange={handleInstChange} 
                                            className="w-full border border-indigo-200 dark:border-indigo-700 rounded-lg pl-10 pr-4 py-2 text-slate-900 dark:text-slate-100 bg-white dark:bg-slate-700 focus:ring-2 focus:ring-indigo-500 outline-none cursor-pointer"
                                        >
                                            <option value="">-- Selecionar Instituição --</option>
                                            {institutions.map(i => <option key={i.id} value={i.id}>{i.name}</option>)}
                                        </select>
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>
                </div>
                <div className="p-6 bg-slate-50 dark:bg-slate-900 border-t border-slate-100 dark:border-slate-700 flex justify-end">
                    <button 
                        type="submit" 
                        disabled={isSubmitting}
                        className="bg-indigo-600 dark:bg-indigo-700 hover:bg-indigo-700 dark:hover:bg-indigo-600 text-white px-8 py-3 rounded-lg font-bold flex gap-2 items-center shadow-lg shadow-indigo-200 dark:shadow-indigo-900/50 transition-all disabled:opacity-70 disabled:cursor-not-allowed"
                    >
                        {isSubmitting ? <Loader2 size={20} className="animate-spin" /> : <CheckCircle size={20}/>}
                        {isSubmitting ? 'Salvando...' : (editingId ? 'Atualizar Série' : 'Criar Série')}
                    </button>
                </div>
            </form>
        )}

        {/* List - Omitir durante cadastro */}
        {hasInstitutionContext && !showForm && (
        <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 overflow-hidden shadow-sm">
            <table className="w-full text-left table-fixed">
            <thead className="bg-slate-50 dark:bg-slate-900 border-b border-slate-200 dark:border-slate-700">
                <tr>
                    <th className="p-4 text-sm font-bold text-slate-600 dark:text-slate-400 uppercase tracking-wider w-20">Nível</th>
                    <th className="p-4 text-sm font-bold text-slate-600 dark:text-slate-400 uppercase tracking-wider w-1/4">Nome</th>
                    <th className="p-4 text-sm font-bold text-slate-600 dark:text-slate-400 uppercase tracking-wider w-1/4">Instituição</th>
                    <th className="p-4 text-sm font-bold text-slate-600 dark:text-slate-400 uppercase tracking-wider w-1/3">Disciplinas</th>
                    <th className="p-4 text-sm font-bold text-slate-600 dark:text-slate-400 uppercase tracking-wider text-right w-24">Ações</th>
                </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-700">
                {loading ? (
                    <tr><td colSpan={5} className="p-12 text-center text-slate-400 dark:text-slate-500"><Loader2 className="animate-spin inline mr-2"/> Carregando dados...</td></tr>
                ) : filteredGrades.length === 0 ? (
                    <tr><td colSpan={5} className="p-12 text-center text-slate-400 dark:text-slate-500">Nenhuma série encontrada. Cadastre uma acima.</td></tr>
                ) : paginatedGrades.map(g => {
                    const isDeleted = g.deleted;
                    return (
                        <tr 
                            key={g.id} 
                            onClick={() => !readOnly && setSelectedGrade(g)}
                            className={`transition-colors cursor-pointer group ${isDeleted ? 'bg-red-50 dark:bg-red-900/20 hover:bg-red-100 dark:hover:bg-red-900/30 border-l-4 border-l-red-400 dark:border-l-red-600' : 'hover:bg-slate-50 dark:hover:bg-slate-700'}`}
                        >
                            <td className="p-4">
                                <div className={`w-10 h-10 rounded-lg flex items-center justify-center font-bold text-lg border shadow-sm ${isDeleted ? 'bg-red-100 dark:bg-red-900/30 text-red-600 dark:text-red-400 border-red-200 dark:border-red-800' : 'bg-indigo-50 dark:bg-indigo-900/30 text-indigo-600 dark:text-indigo-400 border-indigo-100 dark:border-indigo-800'}`}>
                                    {g.level}
                                </div>
                            </td>
                            <td className="p-4">
                                <div className={`font-semibold text-slate-900 dark:text-slate-100 ${isDeleted ? 'line-through text-red-700 dark:text-red-400' : ''} truncate`}>{g.name}</div>
                                {g.description && <div className="text-xs text-slate-500 dark:text-slate-400 mt-0.5 line-clamp-1 truncate">{g.description}</div>}
                                {isDeleted && <span className="text-[10px] text-red-500 dark:text-red-400 font-bold uppercase">Excluído</span>}
                            </td>
                            <td className="p-4 text-sm text-slate-600 dark:text-slate-300 truncate">
                                {institutions.find(i => i.id === g.institution_id)?.name || 'N/A'}
                            </td>
                            <td className="p-4">
                                {g.disciplines && g.disciplines.length > 0 ? (
                                    <div className="flex flex-wrap gap-1">
                                        {g.disciplines.slice(0, 3).map(d => (
                                            <span key={d.id} className={`inline-flex items-center gap-1 border px-2 py-0.5 rounded text-[10px] font-bold uppercase ${isDeleted ? 'bg-red-100/50 dark:bg-red-900/30 border-red-200 dark:border-red-800 text-red-600 dark:text-red-400' : 'bg-slate-50 dark:bg-slate-700 border-slate-200 dark:border-slate-600 text-slate-600 dark:text-slate-300'}`}>
                                                <BookOpen size={10}/> {d.name}
                                            </span>
                                        ))}
                                        {g.disciplines.length > 3 && (
                                            <span className="text-[10px] text-slate-400 dark:text-slate-500">+{g.disciplines.length - 3}</span>
                                        )}
                                    </div>
                                ) : (
                                    <span className="text-slate-300 dark:text-slate-600 italic text-xs">Nenhuma disciplina</span>
                                )}
                            </td>
                            <td className="p-4 text-right">
                                <div className="flex justify-end gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                                    {isDeleted ? (
                                        <button onClick={(e) => { e.stopPropagation(); openRestoreModal(g); }} className="p-2 text-emerald-600 dark:text-emerald-400 hover:bg-emerald-50 dark:hover:bg-emerald-900/30 rounded transition-all" title="Restaurar">
                                            <RotateCcw size={18}/>
                                        </button>
                                    ) : (
                                        <>
                                            {!readOnly && (
                                                <button onClick={(e) => { e.stopPropagation(); handleEdit(g); }} className="p-2 text-slate-400 dark:text-slate-500 hover:text-indigo-600 dark:hover:text-indigo-400 hover:bg-indigo-50 dark:hover:bg-indigo-900/30 rounded transition-all"><Edit2 size={18}/></button>
                                            )}
                                            <button onClick={(e) => { e.stopPropagation(); setSelectedGrade(g); }} className="p-2 text-slate-400 dark:text-slate-500 hover:text-indigo-600 dark:hover:text-indigo-400 hover:bg-indigo-50 dark:hover:bg-indigo-900/30 rounded transition-all" title="Ver Detalhes"><Eye size={18}/></button>
                                            {!readOnly && (
                                                <button onClick={(e) => { e.stopPropagation(); openDeleteModal(g); }} className="p-2 text-slate-400 dark:text-slate-500 hover:text-red-600 dark:hover:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/30 rounded transition-all"><Trash2 size={18}/></button>
                                            )}
                                        </>
                                    )}
                                </div>
                            </td>
                        </tr>
                    );
                })}
            </tbody>
            </table>
        </div>
        )}

        {/* Pagination Controls */}
        {hasInstitutionContext && !showForm && filteredGrades.length > 0 && (
          <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 shadow-sm p-4">
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
                  Mostrando {startIndex + 1} - {Math.min(endIndex, filteredGrades.length)} de {filteredGrades.length} série{filteredGrades.length !== 1 ? 's' : ''}
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
    </div>
  );
};

export default GradeManager;
