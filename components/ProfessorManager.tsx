
import React, { useState, useRef, useEffect, useMemo } from 'react';
import { useProfessorManager } from '../presentation/hooks/useProfessorManager';
import { useSettingsManager } from '../presentation/hooks/useSettingsManager';
import { useCountryStates } from '../presentation/hooks/useCountryStates';
import { useAppTranslation } from '../presentation/hooks/useAppTranslation';
import { Building, Mail, Plus, Trash2, Loader2, User, AlertTriangle, RotateCcw, Lock, Building2, CheckCircle, Briefcase, Eye, Camera, Info, Edit2, ChevronRight, ChevronLeft, Home, X, MapPin } from 'lucide-react';
import { UserRegistrationDTO, Professor } from '../types';
import ProfessorDetails from './ProfessorDetails';
import StudentManager from './StudentManager';
import ClassManager from './ClassManager';
import GradeManager from './GradeManager';
import TestManager from './TestManager';
import ConfirmationModal from './ConfirmationModal';
import { getFriendlyErrorMessage } from '../utils/errorHandling';

interface ProfessorManagerProps {
  hasSupabase: boolean;
  institutionId?: string; // Optional prop for Strict Isolation
  initialProfessorId?: string; // For drill-down navigation from other views
  onBack?: () => void; // Callback for drill-down navigation
}

const ProfessorManager: React.FC<ProfessorManagerProps> = ({ hasSupabase, institutionId, initialProfessorId, onBack }) => {
  const { t } = useAppTranslation();
  // PASS institutionId TO HOOK
  const { 
      professors, loading, error, 
      registerProfessor, deleteProfessor, restoreProfessor, 
      isAdmin, showDeleted, setShowDeleted, refresh 
  } = useProfessorManager(hasSupabase, institutionId);
  const { institutions, departments, fetchDepartments } = useSettingsManager(hasSupabase, institutionId);
  
  // Country/States dynamic dropdowns
  const { 
    countries, 
    states, 
    loadingCountries, 
    loadingStates, 
    selectedCountry, 
    selectedState,
    setSelectedCountry, 
    setSelectedState,
    getCountryDisplayName 
  } = useCountryStates();
  
  const [view, setView] = useState<'list' | 'detail' | 'student' | 'class' | 'grade' | 'test'>(initialProfessorId ? 'detail' : 'list');
  const [selectedProfId, setSelectedProfId] = useState<string | null>(initialProfessorId || null);
  
  // Navigation IDs for drill-down views
  const [selectedStudentId, setSelectedStudentId] = useState<string | null>(null);
  const [selectedClassId, setSelectedClassId] = useState<string | null>(null);
  const [selectedGradeId, setSelectedGradeId] = useState<string | null>(null);
  const [selectedTestId, setSelectedTestId] = useState<string | null>(null);
  
  // Navigation handlers
  const handleViewStudent = (studentId: string) => {
    setSelectedStudentId(studentId);
    setView('student');
  };
  
  const handleViewClass = (classId: string) => {
    setSelectedClassId(classId);
    setView('class');
  };
  
  const handleViewGrade = (gradeId: string) => {
    setSelectedGradeId(gradeId);
    setView('grade');
  };
  
  const handleViewTest = (testId: string) => {
    setSelectedTestId(testId);
    setView('test');
  };
  
  const handleBackToProfessor = () => {
    setView('detail');
    setSelectedStudentId(null);
    setSelectedClassId(null);
    setSelectedGradeId(null);
    setSelectedTestId(null);
  };
  
  const [showForm, setShowForm] = useState(false);
  const [selectedInstId, setSelectedInstId] = useState(institutionId || '');
  const [isSubmitting, setIsSubmitting] = useState(false);
  
  // Filter and Pagination State
  const [filterDepartment, setFilterDepartment] = useState<string>('');
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(50);

  // Manager mode and context
  const isManagerMode = !!institutionId || institutions.length === 1;
  const hasInstitutionContext = isManagerMode || !!selectedInstId;
  
  // Modal State
  const [modalConfig, setModalConfig] = useState<{
      isOpen: boolean;
      id: string | null;
      action: 'delete' | 'restore';
      name: string;
  }>({ isOpen: false, id: null, action: 'delete', name: '' });
  const [isActionLoading, setIsActionLoading] = useState(false);

  // Upload State
  const regFileInputRef = useRef<HTMLInputElement>(null);
  const [regFile, setRegFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);

  const [formData, setFormData] = useState<UserRegistrationDTO>({
      email: '',
      first_name: '',
      last_name: '',
      department: '', 
      department_id: '',
      birthdate: '',
      gender: 'Other',
      address_line_1: '',
      city: '',
      state_province: '',
      postal_code: '',
      country: ''
  });

  // Effect to handle forced institution context
  useEffect(() => {
      if (institutionId) {
          setSelectedInstId(institutionId);
          fetchDepartments(institutionId);
      } else if (institutions.length === 1) {
          setSelectedInstId(institutions[0].id);
          fetchDepartments(institutions[0].id);
      }
  }, [institutionId, institutions]);

  const handleInstChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
      const id = e.target.value;
      setSelectedInstId(id);
      if (id) fetchDepartments(id); 
      setFormData({ ...formData, department_id: '' }); 
  };

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    
    // Validações
    if (!selectedInstId) {
        alert(t('professor.selectInstitution'));
        return;
    }
    if (!formData.department_id) {
        alert(t('professor.selectDepartment'));
        return;
    }
    if (!formData.email || !formData.email.trim()) {
        alert(t('professor.fillEmail'));
        return;
    }
    if (!formData.first_name || !formData.first_name.trim()) {
        alert(t('professor.fillFirstName'));
        return;
    }
    if (!formData.last_name || !formData.last_name.trim()) {
        alert(t('professor.fillLastName'));
        return;
    }
    
    setIsSubmitting(true);
    try {
        // Limpar campos vazios antes de enviar
        const cleanFormData = {
            ...formData,
            email: formData.email.trim(),
            first_name: formData.first_name.trim(),
            last_name: formData.last_name.trim(),
            address_line_1: formData.address_line_1?.trim() || '',
            city: formData.city?.trim() || '',
            state_province: formData.state_province?.trim() || '',
            postal_code: formData.postal_code?.trim() || '',
            country: formData.country?.trim() || ''
        };
        
        const addressData = {
            address_line_1: cleanFormData.address_line_1 || undefined,
            city: cleanFormData.city || undefined,
            state_province: cleanFormData.state_province || undefined,
            postal_code: cleanFormData.postal_code || undefined,
            country: cleanFormData.country || undefined
        };
        
        const success = await registerProfessor(cleanFormData, regFile || undefined, addressData);
        if (success) {
            setShowForm(false);
            setFormData({
                email: '', first_name: '', last_name: '', department: '', department_id: '',
                birthdate: '', gender: 'Other', address_line_1: '', city: '', state_province: '', postal_code: '', country: ''
            });
            // Reset logic: keep instId if forced
            if (!institutionId) {
                setSelectedInstId('');
            }
            setRegFile(null);
            setPreviewUrl(null);
            setSelectedCountry('');
            setSelectedState('');
        }
    } finally {
        setIsSubmitting(false);
    }
  };

  // Modal Triggers
  const openDeleteModal = (p: Professor) => {
      setModalConfig({ isOpen: true, id: p.id, action: 'delete', name: p.name });
  };

  const openRestoreModal = (p: Professor) => {
      setModalConfig({ isOpen: true, id: p.id, action: 'restore', name: p.name });
  };

  const executeAction = async () => {
      if (!modalConfig.id) return;
      setIsActionLoading(true);
      try {
          if (modalConfig.action === 'delete') {
              await deleteProfessor(modalConfig.id);
          } else {
              await restoreProfessor(modalConfig.id);
          }
          setModalConfig({ ...modalConfig, isOpen: false });
      } catch (err: any) {
          alert(getFriendlyErrorMessage(err));
      } finally {
          setIsActionLoading(false);
      }
  };

  // Filter professors by institution and department
  const filteredProfessors = useMemo(() => {
      const activeInstId = institutionId || selectedInstId;
      let filtered = professors;
      
      // Filter by institution
      if (activeInstId) {
          filtered = filtered.filter(p => 
          p.departments?.institution_id === activeInstId || 
          p.departments?.institutions?.id === activeInstId
      );
      }
      
      // Filter by department
      if (filterDepartment) {
          filtered = filtered.filter(p => p.departments?.id === filterDepartment || p.department_id === filterDepartment);
      }
      
      return filtered;
  }, [professors, institutionId, selectedInstId, filterDepartment]);

  // Pagination calculations
  const totalPages = Math.ceil(filteredProfessors.length / itemsPerPage);
  const startIndex = (currentPage - 1) * itemsPerPage;
  const endIndex = startIndex + itemsPerPage;
  const paginatedProfessors = useMemo(() => {
      return filteredProfessors.slice(startIndex, endIndex);
  }, [filteredProfessors, startIndex, endIndex]);

  // Reset page when filters change
  useEffect(() => {
      setCurrentPage(1);
  }, [selectedInstId, filterDepartment]);

  // Filter departments based on selected institution
  const filterDepartments = useMemo(() => {
      const activeInstId = institutionId || selectedInstId;
      if (!activeInstId) return [];
      return departments.filter(d => d.institution_id === activeInstId);
  }, [departments, institutionId, selectedInstId]);

  const handleViewDetails = (id: string) => {
      setSelectedProfId(id);
      setView('detail');
  };

  if (!hasSupabase) return <div className="p-8 text-center text-slate-500 dark:text-slate-400">{t('errors.configureDatabase')}</div>;

  // Render drill-down views
  if (view === 'student' && selectedStudentId) {
      return (
        <StudentManager 
          hasSupabase={hasSupabase} 
          institutionId={institutionId}
          initialStudentId={selectedStudentId}
          onBack={handleBackToProfessor}
          readOnly
        />
      );
  }

  if (view === 'class' && selectedClassId) {
      return (
        <ClassManager 
          hasSupabase={hasSupabase} 
          institutionId={institutionId}
          initialClassId={selectedClassId}
          onBack={handleBackToProfessor}
        />
      );
  }

  if (view === 'grade' && selectedGradeId) {
      return (
        <GradeManager 
          hasSupabase={hasSupabase} 
          institutionId={institutionId}
          initialGradeId={selectedGradeId}
          onBack={handleBackToProfessor}
          readOnly
        />
      );
  }

  if (view === 'test' && selectedTestId) {
      return (
        <TestManager 
          hasSupabase={hasSupabase}
          institutionId={institutionId}
          initialTestId={selectedTestId}
          onBack={handleBackToProfessor}
        />
      );
  }

  if (view === 'detail' && selectedProfId) {
      const selectedProf = professors.find(p => p.id === selectedProfId);
      const handleBack = () => { 
              if (onBack) {
                  onBack();
              } else {
                  setView('list'); 
                  setSelectedProfId(null);
              }
      };
      
      return (
        <div>
            <ProfessorDetails 
              professorId={selectedProfId} 
              hasSupabase={hasSupabase} 
              onBack={handleBack}
          onViewStudent={handleViewStudent}
          onViewClass={handleViewClass}
          onViewGrade={handleViewGrade}
          onViewTest={handleViewTest}
        />
        </div>
      );
  }

  return (
    <div className="w-full space-y-8">
      <div className="flex justify-between items-center">
          <div>
              <h2 className="text-3xl font-bold text-slate-900 dark:text-slate-100">{t('professor.title')}</h2>
              <p className="text-slate-500 dark:text-slate-400 mt-1">{t('professor.subtitle')}</p>
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
                      <span className="font-bold">{t('professor.showDeleted')}</span>
                  </label>
              )}
              {hasInstitutionContext && (
                  <button onClick={() => {
                      if (showForm) {
                          // Reset form and country/state when canceling
                          setFormData({
                              email: '', first_name: '', last_name: '', department: '', department_id: '',
                              birthdate: '', gender: 'Other', address_line_1: '', city: '', state_province: '', postal_code: '', country: ''
                          });
                          setSelectedCountry('');
                          setSelectedState('');
                          setRegFile(null);
                          setPreviewUrl(null);
                      }
                      setShowForm(!showForm);
                  }} className="bg-indigo-600 hover:bg-indigo-700 text-white px-5 py-2.5 rounded-xl font-bold flex items-center gap-2 shadow-lg shadow-indigo-200 transition-all">
                      {showForm ? t('common.cancel') : <><Plus size={20}/> {t('professor.newProfessor')}</>}
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
                      onChange={e => { 
                          setSelectedInstId(e.target.value); 
                          if (e.target.value) fetchDepartments(e.target.value);
                          setFilterDepartment(''); // Reset department filter when institution changes
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
            <Briefcase size={16} className="text-indigo-600 dark:text-indigo-400"/>
            <h3 className="text-sm font-bold text-slate-700 dark:text-slate-200 uppercase">Filtros de Listagem</h3>
            <span className="text-xs text-slate-500 dark:text-slate-400 ml-auto">
              {filteredProfessors.length} professor{filteredProfessors.length !== 1 ? 'es' : ''} encontrado{filteredProfessors.length !== 1 ? 's' : ''}
            </span>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-bold text-slate-500 dark:text-slate-400 uppercase mb-1">Departamento</label>
              <div className="relative">
                <Building size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 dark:text-slate-500"/>
                <select 
                  value={filterDepartment} 
                  onChange={e => setFilterDepartment(e.target.value)} 
                  className="w-full border border-slate-300 dark:border-slate-600 rounded-lg pl-10 pr-4 py-2 text-sm text-slate-900 dark:text-slate-100 bg-white dark:bg-slate-700 focus:ring-2 focus:ring-indigo-500 outline-none cursor-pointer"
                >
                  <option value="">Todos os Departamentos</option>
                  {filterDepartments.map(d => <option key={d.id} value={d.id}>{d.name} {d.code && `(${d.code})`}</option>)}
                </select>
              </div>
            </div>
            <div className="flex items-end">
              <button
                onClick={() => {
                  setFilterDepartment('');
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
              <h3 className="text-lg font-bold text-amber-800 dark:text-amber-300 mb-2">{t('professor.noInstitutionSelected')}</h3>
              <p className="text-amber-600 dark:text-amber-400 text-sm">{t('professor.noInstitutionMessage')}</p>
          </div>
      )}

      <ConfirmationModal
          isOpen={modalConfig.isOpen}
          onClose={() => setModalConfig({ ...modalConfig, isOpen: false })}
          onConfirm={executeAction}
          title={modalConfig.action === 'delete' ? "Excluir Professor" : "Restaurar Professor"}
          message={
              modalConfig.action === 'delete'
              ? <span>Tem certeza que deseja excluir <strong>{modalConfig.name}</strong>? Esta é uma exclusão suave e pode ser restaurada por um Admin.</span>
              : <span>Restaurar a conta de <strong>{modalConfig.name}</strong>?</span>
          }
          confirmLabel={modalConfig.action === 'delete' ? "Excluir" : "Restaurar"}
          isDestructive={modalConfig.action === 'delete'}
          isLoading={isActionLoading}
      />

      {hasInstitutionContext && showForm && (
          <form onSubmit={handleRegister} className="bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-xl overflow-hidden animate-in fade-in slide-in-from-top-4">
              <div className="p-6 bg-slate-50 dark:bg-slate-900 border-b border-slate-100 dark:border-slate-700 mb-6">
                  <h3 className="font-bold text-lg text-slate-800 dark:text-slate-100">{t('professor.registerNew')}</h3>
              </div>

              <div className="p-8">
                  <div className="space-y-6">
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                          <div>
                              <label className="block text-xs font-bold text-slate-500 dark:text-slate-400 uppercase mb-1">Nome</label>
                              <input required value={formData.first_name} onChange={e => setFormData({...formData, first_name: e.target.value})} className="w-full border border-slate-300 dark:border-slate-600 rounded-lg px-3 py-2 outline-none bg-white dark:bg-slate-700 text-slate-900 dark:text-slate-100"/>
                          </div>
                          <div>
                              <label className="block text-xs font-bold text-slate-500 dark:text-slate-400 uppercase mb-1">Sobrenome</label>
                              <input required value={formData.last_name} onChange={e => setFormData({...formData, last_name: e.target.value})} className="w-full border border-slate-300 dark:border-slate-600 rounded-lg px-3 py-2 outline-none bg-white dark:bg-slate-700 text-slate-900 dark:text-slate-100"/>
                          </div>
                      </div>
                      <div>
                          <label className="block text-xs font-bold text-slate-500 dark:text-slate-400 uppercase mb-1">E-mail</label>
                          <input type="email" required value={formData.email} onChange={e => setFormData({...formData, email: e.target.value})} className="w-full border border-slate-300 dark:border-slate-600 rounded-lg px-3 py-2 outline-none bg-white dark:bg-slate-700 text-slate-900 dark:text-slate-100"/>
                      </div>
                      
                      <div className="bg-indigo-50 dark:bg-indigo-900/30 p-4 rounded-xl border border-indigo-100 dark:border-indigo-800 mt-4">
                          <h5 className="font-bold text-indigo-900 dark:text-indigo-200 mb-3 text-sm flex items-center gap-2"><Briefcase size={16}/> Vínculo Profissional</h5>
                          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                              <div>
                                  <label className="block text-xs font-bold text-indigo-700 dark:text-indigo-300 uppercase mb-1">1. Instituição</label>
                                  {isManagerMode ? (
                                      <div className="w-full border border-indigo-200 dark:border-indigo-700 bg-white dark:bg-slate-700 rounded-lg px-4 py-2 text-indigo-900 dark:text-indigo-200 flex items-center gap-2">
                                          <Lock size={14} className="text-indigo-600 dark:text-indigo-400"/>
                                          <span className="font-medium">{institutions.find(i => i.id === selectedInstId)?.name || "Instituição Atual"}</span>
                                      </div>
                                  ) : (
                                      <div className="relative">
                                          <Building2 size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-indigo-400 dark:text-indigo-500"/>
                                          <select required value={selectedInstId} onChange={handleInstChange} className="w-full border border-indigo-200 dark:border-indigo-700 rounded-lg pl-10 pr-4 py-2 text-slate-900 dark:text-slate-100 bg-white dark:bg-slate-700 focus:ring-2 focus:ring-indigo-500 outline-none cursor-pointer">
                                              <option value="">-- Selecionar Instituição --</option>
                                              {institutions.map(i => <option key={i.id} value={i.id}>{i.name}</option>)}
                                          </select>
                                      </div>
                                  )}
                              </div>
                              <div>
                                  <label className="block text-xs font-bold text-indigo-700 dark:text-indigo-300 uppercase mb-1">2. Departamento</label>
                                  <div className="relative">
                                      <Building size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-indigo-400 dark:text-indigo-500"/>
                                      <select required value={formData.department_id} onChange={e => setFormData({ ...formData, department_id: e.target.value })} disabled={!selectedInstId} className="w-full border border-indigo-200 dark:border-indigo-700 rounded-lg pl-10 pr-4 py-2 text-slate-900 dark:text-slate-100 bg-white dark:bg-slate-700 focus:ring-2 focus:ring-indigo-500 outline-none cursor-pointer disabled:bg-slate-100 dark:disabled:bg-slate-800 disabled:text-slate-400 dark:disabled:text-slate-500">
                                              <option value="">-- Selecionar Departamento --</option>
                                              {departments.map(d => <option key={d.id} value={d.id}>{d.name} ({d.code})</option>)}
                                      </select>
                                  </div>
                                  {!selectedInstId && <p className="text-xs text-indigo-400 dark:text-indigo-500 mt-1 italic">Selecione uma instituição primeiro para ver os departamentos.</p>}
                              </div>
                          </div>
                      </div>
                      
                      {/* Address Section */}
                      <div className="pt-4 border-t border-slate-100 dark:border-slate-700">
                          <h4 className="text-sm font-bold text-slate-700 dark:text-slate-200 mb-3 flex items-center gap-2"><MapPin size={16} className="text-slate-600 dark:text-slate-400"/> Endereço</h4>
                          <div className="space-y-3">
                              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                                  <div>
                                      <label className="block text-xs font-bold text-slate-500 dark:text-slate-400 uppercase mb-1">País</label>
                                      <select 
                                          value={selectedCountry}
                                          onChange={e => {
                                              setSelectedCountry(e.target.value);
                                              setFormData({...formData, country: e.target.value, state_province: ''});
                                              setSelectedState('');
                                          }}
                                          disabled={loadingCountries}
                                          className="w-full border border-slate-300 dark:border-slate-600 rounded-lg px-3 py-2 text-sm outline-none bg-white dark:bg-slate-700 text-slate-900 dark:text-slate-100 cursor-pointer disabled:bg-slate-100 dark:disabled:bg-slate-800"
                                      >
                                          <option value="">{loadingCountries ? t('professor.loadingCountries') : t('professor.selectCountry')}</option>
                                          {countries.map(c => (
                                              <option key={c.iso2 || c.name} value={c.name}>{getCountryDisplayName(c.name)}</option>
                                          ))}
                                      </select>
                                  </div>
                                  <div>
                                      <label className="block text-xs font-bold text-slate-500 dark:text-slate-400 uppercase mb-1">Estado/Província</label>
                                      <select 
                                          value={selectedState}
                                          onChange={e => {
                                              setSelectedState(e.target.value);
                                              setFormData({...formData, state_province: e.target.value});
                                          }}
                                          disabled={!selectedCountry || loadingStates}
                                          className="w-full border border-slate-300 dark:border-slate-600 rounded-lg px-3 py-2 text-sm outline-none bg-white dark:bg-slate-700 text-slate-900 dark:text-slate-100 cursor-pointer disabled:bg-slate-100 dark:disabled:bg-slate-800"
                                      >
                                          <option value="">
                                              {!selectedCountry ? t('professor.selectCountryFirst') : loadingStates ? t('professor.loadingCountries') : states.length === 0 ? t('professor.otherNone') : t('professor.selectState')}
                                          </option>
                                          {states.map(s => (
                                              <option key={s.state_code || s.name} value={s.name}>{s.name}</option>
                                          ))}
                                      </select>
                                  </div>
                              </div>
                              <div>
                                  <label className="block text-xs font-bold text-slate-500 dark:text-slate-400 uppercase mb-1">Cidade</label>
                                  <input value={formData.city} onChange={e => setFormData({...formData, city: e.target.value})} placeholder="Cidade" className="w-full border border-slate-300 dark:border-slate-600 rounded-lg px-3 py-2 text-sm outline-none bg-white dark:bg-slate-700 text-slate-900 dark:text-slate-100"/>
                              </div>
                              <div>
                                  <label className="block text-xs font-bold text-slate-500 dark:text-slate-400 uppercase mb-1">Endereço</label>
                                  <input value={formData.address_line_1} onChange={e => setFormData({...formData, address_line_1: e.target.value})} placeholder="Rua, Número" className="w-full border border-slate-300 dark:border-slate-600 rounded-lg px-3 py-2 text-sm outline-none bg-white dark:bg-slate-700 text-slate-900 dark:text-slate-100"/>
                              </div>
                              <div>
                                  <label className="block text-xs font-bold text-slate-500 dark:text-slate-400 uppercase mb-1">CEP</label>
                                  <input value={formData.postal_code} onChange={e => setFormData({...formData, postal_code: e.target.value})} placeholder="CEP" className="w-full border border-slate-300 dark:border-slate-600 rounded-lg px-3 py-2 text-sm outline-none bg-white dark:bg-slate-700 text-slate-900 dark:text-slate-100"/>
                              </div>
                          </div>
                      </div>
                  </div>
              </div>
              <div className="p-6 bg-slate-50 dark:bg-slate-900 border-t border-slate-100 dark:border-slate-700 flex justify-end">
                  <button 
                    type="submit" 
                    disabled={isSubmitting}
                    className="bg-indigo-600 hover:bg-indigo-700 text-white px-8 py-3 rounded-lg font-bold flex gap-2 items-center shadow-lg shadow-indigo-200 transition-all disabled:opacity-70 disabled:cursor-not-allowed"
                  >
                      {isSubmitting ? <Loader2 size={20} className="animate-spin" /> : <CheckCircle size={20}/>}
                      {isSubmitting ? 'Cadastrando...' : 'Criar Conta e Professor'}
                  </button>
              </div>
          </form>
      )}

      {/* List filtered by institutionId if present - Omitir durante cadastro */}
      {hasInstitutionContext && !showForm && (
      <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 overflow-hidden shadow-sm">
          <table className="w-full text-left">
          <thead className="bg-slate-50 dark:bg-slate-900 border-b border-slate-200 dark:border-slate-700">
              <tr>
                  <th className="p-4 text-sm font-bold text-slate-600 dark:text-slate-400 uppercase tracking-wider" style={{ width: '25%' }}>Nome</th>
                  <th className="p-4 text-sm font-bold text-slate-600 dark:text-slate-400 uppercase tracking-wider" style={{ width: '25%' }}>Instituição</th>
                  <th className="p-4 text-sm font-bold text-slate-600 dark:text-slate-400 uppercase tracking-wider" style={{ width: '20%' }}>Departamento</th>
                  <th className="p-4 text-sm font-bold text-slate-600 dark:text-slate-400 uppercase tracking-wider" style={{ width: '20%' }}>E-mail</th>
                  <th className="p-4 text-sm font-bold text-slate-600 dark:text-slate-400 uppercase tracking-wider text-right" style={{ width: '10%', minWidth: '100px' }}>Ações</th>
              </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 dark:divide-slate-700">
              {loading ? (
                  <tr><td colSpan={5} className="p-12 text-center text-slate-400 dark:text-slate-500"><Loader2 className="animate-spin inline mr-2"/> {t('professor.loadingData')}</td></tr>
              ) : filteredProfessors.length === 0 ? (
                  <tr><td colSpan={5} className="p-12 text-center text-slate-400 dark:text-slate-500">{t('professor.noProfessorsFound')}</td></tr>
              ) : paginatedProfessors.map(p => (
                  <tr key={p.id} onClick={() => handleViewDetails(p.id)} className={`transition-colors cursor-pointer group ${p.deleted ? 'bg-red-50 dark:bg-red-900/20 hover:bg-red-100 dark:hover:bg-red-900/30 border-l-4 border-l-red-400 dark:border-l-red-600' : 'hover:bg-slate-50 dark:hover:bg-slate-700'}`}>
                      <td className="p-4">
                          <div className="flex items-center gap-3">
                              <div className="w-8 h-8 rounded-full bg-slate-100 dark:bg-slate-700 flex items-center justify-center text-slate-500 dark:text-slate-400 overflow-hidden shrink-0">
                                  {p.app_users?.profile_picture_url ? <img src={p.app_users.profile_picture_url} className="w-full h-full object-cover"/> : <User size={16}/>}
                              </div>
                              <div className="min-w-0">
                                  <span className="font-semibold text-slate-900 dark:text-slate-100 block truncate">{p.name}</span>
                                  {p.deleted && <span className="bg-red-200 dark:bg-red-900/40 text-red-800 dark:text-red-200 text-[10px] px-1.5 py-0.5 rounded font-bold uppercase">Deleted</span>}
                              </div>
                          </div>
                      </td>
                      <td className="p-4 text-slate-600 dark:text-slate-300 text-sm truncate">{p.departments?.institutions?.name}</td>
                      <td className="p-4 text-slate-600 dark:text-slate-300 text-sm"><span className="bg-slate-100 dark:bg-slate-700 text-slate-700 dark:text-slate-200 px-2 py-1 rounded text-xs font-bold uppercase">{p.departments?.code || p.department}</span></td>
                      <td className="p-4 text-slate-600 dark:text-slate-300 text-sm truncate">{p.email}</td>
                      <td className="p-4 text-right overflow-visible">
                          <div className="flex justify-end gap-1 opacity-0 group-hover:opacity-100 transition-opacity shrink-0 min-w-fit">
                              {isAdmin && p.deleted ? (
                                  <button onClick={(e) => {e.stopPropagation(); openRestoreModal(p)}} className="p-1.5 text-emerald-600 dark:text-emerald-400 hover:text-emerald-700 dark:hover:text-emerald-300 hover:bg-emerald-50 dark:hover:bg-emerald-900/30 rounded transition-all shrink-0 flex-shrink-0" title="Restore">
                                      <RotateCcw size={16}/>
                                  </button>
                              ) : !p.deleted && (
                                  <button onClick={(e) => {e.stopPropagation(); openDeleteModal(p)}} className="p-1.5 text-slate-400 dark:text-slate-500 hover:text-red-600 dark:hover:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/30 rounded transition-all shrink-0 flex-shrink-0">
                                      <Trash2 size={16}/>
                                  </button>
                              )}
                          </div>
                      </td>
                  </tr>
              ))}
          </tbody>
          </table>
      </div>
      )}

      {/* Pagination Controls */}
      {hasInstitutionContext && !showForm && filteredProfessors.length > 0 && (
        <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 shadow-sm p-4">
          <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
            {/* Items per page selector and info */}
            <div className="flex items-center gap-4">
              <div className="flex items-center gap-2">
                <span className="text-sm text-slate-600 dark:text-slate-300 font-medium">{t('professor.itemsPerPage')}</span>
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
                {t('professor.showing', { 
                  start: startIndex + 1, 
                  end: Math.min(endIndex, filteredProfessors.length), 
                  total: filteredProfessors.length,
                  plural: filteredProfessors.length !== 1 ? 'es' : ''
                })}
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
                          ? 'bg-indigo-600 dark:bg-indigo-500 text-white'
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
                <span className="text-xs text-slate-500 dark:text-slate-400">{t('professor.goTo')}</span>
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

export default ProfessorManager;
