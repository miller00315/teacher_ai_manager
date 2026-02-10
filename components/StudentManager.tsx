
import React, { useState, useMemo, useRef, useEffect } from 'react';
import { useStudentManager } from '../presentation/hooks/useStudentManager';
import { useSettingsManager } from '../presentation/hooks/useSettingsManager';
import { useCountryStates } from '../presentation/hooks/useCountryStates';
import { Student, UserRegistrationDTO } from '../types';
import {
    User, Plus, Trash2, Loader2, Hash, GraduationCap, Building2, AlertTriangle,
    RotateCcw, Eye, ArrowLeft, Calendar, FileText, CheckCircle, XCircle, Percent, Users, Lock, Mail, MapPin, Briefcase, BookOpen, Clock, Camera, Edit2, Save, X, Info, ChevronRight, ChevronLeft, Home
} from 'lucide-react';
import ConfirmationModal from './ConfirmationModal';
import StudentDisabilityManager from './StudentDisabilityManager';
import { getFriendlyErrorMessage } from '../utils/errorHandling';
import {
    buildStudentImportTemplateCsv,
    buildStudentImportTemplateXlsx,
    getStudentImportTemplateColumns,
    parseStudentImportFile,
    validateStudentImportRows
} from '../utils/student_import';

interface StudentManagerProps {
    hasSupabase: boolean;
    readOnly?: boolean;
    institutionId?: string; // Optional prop for Strict Isolation
    initialStudentId?: string; // For drill-down navigation from other views
    onBack?: () => void; // Callback for drill-down navigation
    // Navigation callbacks for drill-down from student details
    onViewProfessor?: (professorId: string) => void;
    onViewClass?: (classId: string) => void;
    onViewGrade?: (gradeId: string) => void;
    onViewTest?: (testId: string) => void;
}

const StudentManager: React.FC<StudentManagerProps> = ({ hasSupabase, readOnly = false, institutionId, initialStudentId, onBack, onViewProfessor, onViewClass, onViewGrade, onViewTest }) => {
    // PASS institutionId TO HOOK
    const {
        students, institutions, classes, loading, error,
        registerStudent, registerStudentsBulk, updateStudent, deleteStudent, restoreStudent,
        isAdmin, showDeleted, setShowDeleted, refresh,
        loadStudentHistory, studentHistory, studentReleases, loadingHistory, uploadImage
    } = useStudentManager(hasSupabase, institutionId);
    const { grades, disciplines, fetchDisciplines } = useSettingsManager(hasSupabase, institutionId);

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

    const [view, setView] = useState<'list' | 'detail' | 'create'>(initialStudentId ? 'detail' : 'list');
    const [selectedStudent, setSelectedStudent] = useState<Student | null>(null);
    const [isSubmitting, setIsSubmitting] = useState(false);

    // Modal State
    const [modalConfig, setModalConfig] = useState<{
        isOpen: boolean;
        id: string | null;
        action: 'delete' | 'restore';
        name: string;
    }>({ isOpen: false, id: null, action: 'delete', name: '' });
    const [isActionLoading, setIsActionLoading] = useState(false);

    // Edit State
    const [showEditModal, setShowEditModal] = useState(false);
    const [editingStudentId, setEditingStudentId] = useState<string | null>(null);
    const [editFormData, setEditFormData] = useState<Partial<Student>>({ name: '', age: 0, grade_id: '', class_id: '', institution_id: '' });
    const [editEmail, setEditEmail] = useState('');

    // Upload State
    const fileInputRef = useRef<HTMLInputElement>(null);
    const regFileInputRef = useRef<HTMLInputElement>(null);
    const [isUploading, setIsUploading] = useState(false);
    const [regFile, setRegFile] = useState<File | null>(null);
    const [previewUrl, setPreviewUrl] = useState<string | null>(null);

    // Bulk Import State (Institution/Admin only)
    const importFileInputRef = useRef<HTMLInputElement>(null);
    const [importFile, setImportFile] = useState<File | null>(null);
    const [isParsingImportFile, setIsParsingImportFile] = useState(false);
    const [importErrors, setImportErrors] = useState<ReadonlyArray<{ rowNumber: number; field?: string; message: string }>>([]);
    const [importValidCount, setImportValidCount] = useState(0);
    const [importPreviewRows, setImportPreviewRows] = useState<ReadonlyArray<{ rowNumber: number; email: string; name: string; grade: string; className: string }>>([]);
    const [importValidatedItems, setImportValidatedItems] = useState<ReadonlyArray<{ student: UserRegistrationDTO; address?: any; rowNumber: number }>>([]);
    const [isImporting, setIsImporting] = useState(false);
    const [importResult, setImportResult] = useState<{ successCount: number; failureCount: number } | null>(null);

    // Filter State for Admin
    const [filterInst, setFilterInst] = useState(institutionId || '');
    const [filterGrade, setFilterGrade] = useState<string>('');
    const [filterClass, setFilterClass] = useState<string>('');

    // Pagination State
    const [currentPage, setCurrentPage] = useState(1);
    const [itemsPerPage, setItemsPerPage] = useState(50);

    // Registration Form State
    const [formData, setFormData] = useState<UserRegistrationDTO>({
        email: '',
        first_name: '',
        last_name: '',
        birthdate: '',
        gender: 'Other',
        address_line_1: '',
        city: '',
        state_province: '',
        postal_code: '',
        country: '',
        grade_id: '',
        age: 16,
        institution_id: institutionId || '', // Pre-fill if enforced
        class_id: ''
    });

    // Force institution ID if prop provided (Strict Isolation)
    useEffect(() => {
        if (institutionId) {
            setFormData(prev => ({ ...prev, institution_id: institutionId }));
            setFilterInst(institutionId);
        } else if (institutions.length === 1) {
            setFilterInst(institutions[0].id);
            setFormData(prev => ({ ...prev, institution_id: institutions[0].id }));
        }
    }, [institutionId, institutions]);

    // Handle initial student ID for drill-down navigation
    useEffect(() => {
        if (initialStudentId && students.length > 0 && !selectedStudent) {
            const student = students.find(s => s.id === initialStudentId);
            if (student) {
                handleViewDetails(student);
            }
        }
    }, [initialStudentId, students]);

    // Manager mode and context
    const isManagerMode = !!institutionId || institutions.length === 1;
    const hasInstitutionContext = isManagerMode || !!filterInst;
    const canBulkImportStudents = !readOnly && hasInstitutionContext && (isAdmin || isManagerMode);

    // Derived filter for list view - Strict Filtering with Grade and Class filters
    const displayedStudents = useMemo(() => {
        const activeInstId = institutionId || filterInst;
        let filtered = students;

        // Filter by institution
        if (activeInstId) {
            filtered = filtered.filter(s => s.institution_id === activeInstId);
        }

        // Filter by grade/série
        if (filterGrade) {
            filtered = filtered.filter(s => s.grade_id === filterGrade);
        }

        // Filter by class/turma
        if (filterClass) {
            filtered = filtered.filter(s => s.class_id === filterClass);
        }

        return filtered;
    }, [students, institutionId, filterInst, filterGrade, filterClass]);

    // Pagination calculations
    const totalPages = Math.ceil(displayedStudents.length / itemsPerPage);
    const startIndex = (currentPage - 1) * itemsPerPage;
    const endIndex = startIndex + itemsPerPage;
    const paginatedStudents = useMemo(() => {
        return displayedStudents.slice(startIndex, endIndex);
    }, [displayedStudents, startIndex, endIndex]);

    // Reset page when filters change
    useEffect(() => {
        setCurrentPage(1);
    }, [filterInst, filterGrade, filterClass]);

    // Filter classes based on selected institution (for registration)
    const filteredClasses = useMemo(() => {
        const activeInstId = institutionId || filterInst || formData.institution_id;
        if (!activeInstId) return [];

        let filtered = classes.filter(c => c.institution_id === activeInstId);
        if (formData.grade_id) {
            filtered = filtered.filter(c => c.grade_id === formData.grade_id);
        }
        return filtered;
    }, [classes, formData.institution_id, formData.grade_id, institutionId, filterInst]);

    // Filter classes for list filters (based on selected institution and grade)
    const filterClasses = useMemo(() => {
        const activeInstId = institutionId || filterInst;
        if (!activeInstId) return [];

        let filtered = classes.filter(c => c.institution_id === activeInstId);
        if (filterGrade) {
            filtered = filtered.filter(c => c.grade_id === filterGrade);
        }
        return filtered;
    }, [classes, institutionId, filterInst, filterGrade]);

    // Filter grades for list filters (based on selected institution)
    const filterGrades = useMemo(() => {
        const activeInstId = institutionId || filterInst;
        if (!activeInstId) return [];
        return grades.filter(g => g.institution_id === activeInstId);
    }, [grades, institutionId, filterInst]);

    // Filter grades based on selected institution (for registration)
    const filteredGrades = useMemo(() => {
        const activeInstId = institutionId || filterInst || formData.institution_id;
        if (!activeInstId) return [];
        return grades.filter(g => g.institution_id === activeInstId);
    }, [grades, formData.institution_id, institutionId, filterInst]);

    // Derived filters for Editing
    const editFilteredClasses = useMemo(() => {
        if (!editFormData.institution_id) return [];
        let filtered = classes.filter(c => c.institution_id === editFormData.institution_id);
        if (editFormData.grade_id) {
            filtered = filtered.filter(c => c.grade_id === editFormData.grade_id);
        }
        return filtered;
    }, [classes, editFormData.institution_id, editFormData.grade_id]);

    const editFilteredGrades = useMemo(() => {
        if (!editFormData.institution_id) return [];
        return grades.filter(g => g.institution_id === editFormData.institution_id);
    }, [grades, editFormData.institution_id]);

    const calculateAge = (dateString: string) => {
        if (!dateString) return 0;
        const today = new Date();
        const birthDate = new Date(dateString);
        let age = today.getFullYear() - birthDate.getFullYear();
        const m = today.getMonth() - birthDate.getMonth();
        if (m < 0 || (m === 0 && today.getDate() < birthDate.getDate())) {
            age--;
        }
        return age;
    };

    const handleBirthDateChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const date = e.target.value;
        const age = calculateAge(date);
        setFormData(prev => ({
            ...prev,
            birthdate: date,
            age: age > 0 ? age : 0
        }));
    };

    const handleRegisterFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.files && e.target.files[0]) {
            const file = e.target.files[0];
            setRegFile(file);
            const url = URL.createObjectURL(file);
            setPreviewUrl(url);
        }
    };

    const handleRegister = async (e: React.FormEvent) => {
        e.preventDefault();
        if (readOnly) return;

        // Validações
        if (!formData.institution_id) {
            alert("Por favor, selecione uma instituição");
            return;
        }
        if (!formData.grade_id) {
            alert("Por favor, selecione uma série");
            return;
        }
        if (!formData.email || !formData.email.trim()) {
            alert("Por favor, preencha o e-mail");
            return;
        }
        if (!formData.first_name || !formData.first_name.trim()) {
            alert("Por favor, preencha o nome");
            return;
        }
        if (!formData.last_name || !formData.last_name.trim()) {
            alert("Por favor, preencha o sobrenome");
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

            const success = await registerStudent(cleanFormData, regFile || undefined, addressData);
            if (success) {
                setView('list');
                setFormData({
                    email: '', first_name: '', last_name: '', birthdate: '', gender: 'Other',
                    address_line_1: '', city: '', state_province: '', postal_code: '', country: '',
                    grade_id: '', age: 16, institution_id: institutionId || '', class_id: ''
                });
                setRegFile(null);
                setPreviewUrl(null);
                setSelectedCountry('');
                setSelectedState('');
            }
        } finally {
            setIsSubmitting(false);
        }
    };

    const handleOpenEdit = (student: Student) => {
        if (readOnly) return;
        setEditingStudentId(student.id);
        setEditFormData({
            name: student.name,
            age: student.age,
            grade_id: student.grade_id,
            class_id: student.class_id || '',
            institution_id: student.institution_id
        });
        setEditEmail(student.app_users?.email || '');
        setShowEditModal(true);
    };

    const handleUpdate = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!editingStudentId || readOnly) return;
        setIsSubmitting(true);
        try {
            const success = await updateStudent(editingStudentId, { ...editFormData, email: editEmail } as any);
            if (success) {
                setShowEditModal(false);
                setEditingStudentId(null);
                // Update selected student if in detail view
                if (selectedStudent && selectedStudent.id === editingStudentId) {
                    setSelectedStudent(prev => prev ? ({
                        ...prev,
                        ...editFormData,
                        app_users: { ...prev.app_users, email: editEmail } as any
                    }) : null);
                }
            }
        } finally {
            setIsSubmitting(false);
        }
    };

    const openDeleteModal = (s: Student) => {
        setModalConfig({ isOpen: true, id: s.id, action: 'delete', name: s.name });
    };

    const openRestoreModal = (s: Student) => {
        setModalConfig({ isOpen: true, id: s.id, action: 'restore', name: s.name });
    };

    const executeAction = async () => {
        if (!modalConfig.id) return;
        setIsActionLoading(true);
        try {
            if (modalConfig.action === 'delete') {
                await deleteStudent(modalConfig.id);
            } else {
                await restoreStudent(modalConfig.id);
            }
            setModalConfig({ ...modalConfig, isOpen: false });
        } catch (err: any) {
            alert(getFriendlyErrorMessage(err));
        } finally {
            setIsActionLoading(false);
        }
    };

    const handleViewDetails = async (student: Student) => {
        setSelectedStudent(student);
        setView('detail');
        await loadStudentHistory(student.id);
        if (student.grade_id) {
            fetchDisciplines(student.grade_id);
        }
    };

    const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
        if (readOnly) return;
        if (e.target.files && e.target.files[0] && selectedStudent) {
            setIsUploading(true);
            const file = e.target.files[0];
            const url = await uploadImage(selectedStudent.id, file);
            if (url) {
                setSelectedStudent(prev => {
                    if (!prev) return null;
                    return {
                        ...prev,
                        app_users: {
                            ...prev.app_users,
                            profile_picture_url: url
                        } as any
                    };
                });
            }
            setIsUploading(false);
        }
    };

    const studentTeachers = useMemo(() => {
        if (!selectedStudent) return [];
        const teacherMap = new Map<string, { id: string, name: string, email: string, subjects: Set<string>, profile_picture_url?: string }>();

        if (selectedStudent.class_id) {
            const studentClass = classes.find(c => c.id === selectedStudent.class_id);
            studentClass?.professors?.forEach(p => {
                if (!teacherMap.has(p.id)) {
                    teacherMap.set(p.id, {
                        ...p,
                        subjects: new Set(['Class Director']),
                        profile_picture_url: p.app_users?.profile_picture_url
                    });
                } else {
                    teacherMap.get(p.id)?.subjects.add('Class Director');
                }
            });
        }

        disciplines.forEach(d => {
            if (d.professors) {
                const p = d.professors;
                if (!teacherMap.has(p.id)) {
                    teacherMap.set(p.id, {
                        ...p,
                        subjects: new Set([d.name]),
                        profile_picture_url: p.app_users?.profile_picture_url
                    });
                } else {
                    teacherMap.get(p.id)?.subjects.add(d.name);
                }
            }
        });

        return Array.from(teacherMap.values()).map(t => ({
            ...t,
            subjects: Array.from(t.subjects)
        }));
    }, [selectedStudent, classes, disciplines]);

    if (!hasSupabase) return <div className="p-8 text-center text-slate-500 dark:text-slate-400">Configure o banco de dados primeiro.</div>;

    // --- EDIT MODAL ---
    const editModal = showEditModal && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
            <div className="bg-white dark:bg-slate-800 rounded-2xl w-full max-w-lg shadow-2xl animate-in fade-in zoom-in duration-200 overflow-hidden">
                <div className="p-6 border-b border-slate-100 dark:border-slate-700 flex justify-between items-center bg-slate-50 dark:bg-slate-900">
                    <h3 className="font-bold text-lg text-slate-800 dark:text-slate-100">Editar Aluno</h3>
                    <button onClick={() => setShowEditModal(false)} className="text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200"><X size={20} /></button>
                </div>
                <form onSubmit={handleUpdate} className="p-6 space-y-4">
                    <div>
                        <label className="block text-sm font-bold text-slate-700 dark:text-slate-200 mb-2">Nome do Aluno</label>
                        <input
                            value={editFormData.name}
                            onChange={e => setEditFormData({ ...editFormData, name: e.target.value })}
                            className="w-full border border-slate-300 dark:border-slate-600 rounded-lg px-4 py-2.5 text-slate-900 dark:text-slate-100 bg-white dark:bg-slate-700 focus:ring-2 focus:ring-indigo-500 outline-none"
                        />
                    </div>
                    <div>
                        <label className="block text-sm font-bold text-slate-700 dark:text-slate-200 mb-2">E-mail (Login)</label>
                        <input
                            type="email"
                            value={editEmail}
                            onChange={e => setEditEmail(e.target.value)}
                            className="w-full border border-slate-300 dark:border-slate-600 rounded-lg px-4 py-2.5 text-slate-900 dark:text-slate-100 bg-white dark:bg-slate-700 focus:ring-2 focus:ring-indigo-500 outline-none"
                        />
                    </div>

                    {/* Bloquear Instituição para Gerenciador */}
                    {institutionId && (
                        <div className="bg-indigo-50 dark:bg-indigo-900/30 border border-indigo-100 dark:border-indigo-800 p-3 rounded-lg flex items-center gap-2 text-sm text-indigo-700 dark:text-indigo-300">
                            <Lock size={14} /> Instituição Bloqueada: {institutions.find(i => i.id === institutionId)?.name}
                        </div>
                    )}

                    <div className="grid grid-cols-2 gap-4">
                        <div>
                            <label className="block text-sm font-bold text-slate-700 dark:text-slate-200 mb-2">Idade</label>
                            <input
                                type="number"
                                value={editFormData.age}
                                onChange={e => setEditFormData({ ...editFormData, age: parseInt(e.target.value) })}
                                className="w-full border border-slate-300 dark:border-slate-600 rounded-lg px-4 py-2.5 text-slate-900 dark:text-slate-100 bg-white dark:bg-slate-700 focus:ring-2 focus:ring-indigo-500 outline-none"
                            />
                        </div>
                        <div>
                            <label className="block text-sm font-bold text-slate-700 dark:text-slate-200 mb-2">Série</label>
                            <select
                                value={editFormData.grade_id}
                                onChange={e => setEditFormData({ ...editFormData, grade_id: e.target.value, class_id: '' })}
                                className="w-full border border-slate-300 dark:border-slate-600 rounded-lg px-4 py-2.5 text-slate-900 dark:text-slate-100 bg-white dark:bg-slate-700 focus:ring-2 focus:ring-indigo-500 outline-none"
                            >
                                <option value="">Selecionar Série</option>
                                {editFilteredGrades.map(g => <option key={g.id} value={g.id}>{g.name}</option>)}
                            </select>
                        </div>
                    </div>
                    <div>
                        <label className="block text-sm font-bold text-slate-700 dark:text-slate-200 mb-2">Turma</label>
                        <select
                            value={editFormData.class_id}
                            onChange={e => setEditFormData({ ...editFormData, class_id: e.target.value })}
                            className="w-full border border-slate-300 dark:border-slate-600 rounded-lg px-4 py-2.5 text-slate-900 dark:text-slate-100 bg-white dark:bg-slate-700 focus:ring-2 focus:ring-indigo-500 outline-none"
                            disabled={!editFormData.grade_id}
                        >
                            <option value="">{editFormData.grade_id ? "Sem Turma" : "Selecione a Série Primeiro"}</option>
                            {editFilteredClasses.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                        </select>
                    </div>
                    <div className="pt-4 flex justify-end gap-3">
                        <button type="button" onClick={() => setShowEditModal(false)} className="px-4 py-2 text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-lg">Cancelar</button>
                        <button type="submit" disabled={isSubmitting} className="bg-indigo-600 dark:bg-indigo-500 text-white px-6 py-2 rounded-lg font-bold flex items-center gap-2 hover:bg-indigo-700 dark:hover:bg-indigo-600 disabled:opacity-70">
                            {isSubmitting ? <Loader2 size={18} className="animate-spin" /> : <Save size={18} />} Salvar Alterações
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );

    // --- DETAIL VIEW ---
    if (view === 'detail' && selectedStudent) {
        return (
            <div className="max-w-6xl mx-auto space-y-6">
                {editModal}


                <div className="flex justify-end mb-4">
                    {!readOnly && (
                        <button onClick={() => handleOpenEdit(selectedStudent)} className="bg-indigo-600 dark:bg-indigo-500 hover:bg-indigo-700 dark:hover:bg-indigo-600 text-white px-4 py-2 rounded-lg font-bold flex items-center gap-2 shadow-sm transition-all">
                            <Edit2 size={16} /> Editar Perfil
                        </button>
                    )}
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                    {/* Left Column: Student Card & Teachers */}
                    <div className="space-y-6">
                        {/* Profile Card */}
                        <div className="bg-white dark:bg-slate-800 p-6 rounded-xl border border-slate-200 dark:border-slate-700 shadow-sm flex flex-col items-center text-center relative overflow-hidden">
                            <div className="absolute top-0 w-full h-24 bg-gradient-to-b from-slate-100 dark:from-slate-700 to-transparent"></div>

                            <div className="relative group mb-4">
                                <div className="w-24 h-24 rounded-full bg-slate-200 dark:bg-slate-700 flex items-center justify-center text-slate-400 dark:text-slate-500 overflow-hidden border-4 border-white dark:border-slate-800 shadow-md relative">
                                    {selectedStudent.app_users?.profile_picture_url ? (
                                        <img src={selectedStudent.app_users.profile_picture_url} className="w-full h-full object-cover" />
                                    ) : (
                                        <User size={48} />
                                    )}
                                    {isUploading && <div className="absolute inset-0 bg-black/50 flex items-center justify-center"><Loader2 className="animate-spin text-white" /></div>}
                                </div>
                                {!readOnly && (
                                    <div onClick={() => fileInputRef.current?.click()} className="absolute bottom-0 right-0 bg-indigo-600 dark:bg-indigo-500 p-2 rounded-full text-white cursor-pointer shadow-sm hover:scale-110 transition-transform">
                                        <Camera size={14} />
                                    </div>
                                )}
                                <input type="file" ref={fileInputRef} hidden onChange={handleFileChange} accept="image/*" />
                            </div>

                            <h2 className="text-2xl font-bold text-slate-900 dark:text-slate-100">{selectedStudent.name}</h2>
                            <p className="text-slate-500 dark:text-slate-400 text-sm mb-4">{selectedStudent.app_users?.email}</p>

                            <div className="w-full space-y-2">
                                <div
                                    onClick={() => selectedStudent.grade_id && onViewGrade?.(selectedStudent.grade_id)}
                                    className={`flex justify-between items-center text-sm p-3 bg-slate-50 dark:bg-slate-700 rounded-lg ${onViewGrade && selectedStudent.grade_id ? 'cursor-pointer hover:bg-indigo-50 dark:hover:bg-indigo-900/30 transition-colors' : ''}`}
                                >
                                    <span className="text-slate-500 dark:text-slate-400 flex items-center gap-2"><GraduationCap size={14} /> Série</span>
                                    <span className={`font-bold text-slate-700 dark:text-slate-200 ${onViewGrade && selectedStudent.grade_id ? 'hover:text-indigo-600 dark:hover:text-indigo-400' : ''}`}>{selectedStudent.school_grades?.name}</span>
                                </div>
                                <div
                                    onClick={() => selectedStudent.class_id && onViewClass?.(selectedStudent.class_id)}
                                    className={`flex justify-between items-center text-sm p-3 bg-slate-50 dark:bg-slate-700 rounded-lg ${onViewClass && selectedStudent.class_id ? 'cursor-pointer hover:bg-indigo-50 dark:hover:bg-indigo-900/30 transition-colors' : ''}`}
                                >
                                    <span className="text-slate-500 dark:text-slate-400 flex items-center gap-2"><Users size={14} /> Turma</span>
                                    <span className={`font-bold text-slate-700 dark:text-slate-200 ${onViewClass && selectedStudent.class_id ? 'hover:text-indigo-600 dark:hover:text-indigo-400' : ''}`}>{selectedStudent.classes?.name || 'Não atribuída'}</span>
                                </div>
                                <div className="flex justify-between items-center text-sm p-3 bg-slate-50 dark:bg-slate-700 rounded-lg">
                                    <span className="text-slate-500 dark:text-slate-400 flex items-center gap-2"><Building2 size={14} /> Inst.</span>
                                    <span className="font-bold text-slate-700 dark:text-slate-200 truncate max-w-[120px]">{selectedStudent.institutions?.name}</span>
                                </div>
                                <div className="flex justify-between items-center text-sm p-3 bg-slate-50 dark:bg-slate-700 rounded-lg">
                                    <span className="text-slate-500 dark:text-slate-400 flex items-center gap-2"><Hash size={14} /> ID</span>
                                    <span className="font-mono text-xs text-slate-600 dark:text-slate-300">{(selectedStudent.student_hash || '').substring(0, 10)}...</span>
                                </div>
                            </div>
                        </div>

                        {/* Widget de Professores */}
                        <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 shadow-sm overflow-hidden">
                            <div className="p-4 border-b border-slate-100 dark:border-slate-700 bg-slate-50 dark:bg-slate-900">
                                <h3 className="font-bold text-slate-800 dark:text-slate-100 flex items-center gap-2"><Briefcase size={18} /> Professores</h3>
                            </div>
                            <div className="divide-y divide-slate-100 dark:divide-slate-700 max-h-[300px] overflow-y-auto">
                                {studentTeachers.length === 0 ? (
                                    <div className="p-6 text-center text-slate-400 dark:text-slate-500 text-sm">Nenhum professor encontrado.</div>
                                ) : (
                                    studentTeachers.map(t => (
                                        <div
                                            key={t.id}
                                            onClick={() => onViewProfessor?.(t.id)}
                                            className={`p-4 flex items-center gap-3 hover:bg-slate-50 dark:hover:bg-slate-700 ${onViewProfessor ? 'cursor-pointer group' : ''}`}
                                        >
                                            <div className="w-8 h-8 rounded-full bg-slate-100 dark:bg-slate-700 flex items-center justify-center overflow-hidden shrink-0">
                                                {t.profile_picture_url ? <img src={t.profile_picture_url} className="w-full h-full object-cover" /> : <User size={14} className="text-slate-400 dark:text-slate-500" />}
                                            </div>
                                            <div className="flex-1 min-w-0">
                                                <p className={`font-bold text-sm text-slate-800 dark:text-slate-200 truncate ${onViewProfessor ? 'group-hover:text-indigo-600 dark:group-hover:text-indigo-400 transition-colors' : ''}`}>{t.name}</p>
                                                <p className="text-xs text-indigo-600 dark:text-indigo-400 truncate">{t.subjects.join(', ')}</p>
                                            </div>
                                        </div>
                                    ))
                                )}
                            </div>
                        </div>
                    </div>

                    {/* Right Column: History & Stats */}
                    <div className="md:col-span-2 space-y-6">
                        {/* Resumo de Estatísticas */}
                        <div className="grid grid-cols-3 gap-4">
                            <div className="bg-white dark:bg-slate-800 p-4 rounded-xl border border-slate-200 dark:border-slate-700 shadow-sm text-center">
                                <div className="text-2xl font-bold text-indigo-600 dark:text-indigo-400">{studentHistory.length}</div>
                                <div className="text-xs text-slate-500 dark:text-slate-400 font-bold uppercase tracking-wider">Provas Feitas</div>
                            </div>
                            <div className="bg-white dark:bg-slate-800 p-4 rounded-xl border border-slate-200 dark:border-slate-700 shadow-sm text-center">
                                <div className="text-2xl font-bold text-emerald-600 dark:text-emerald-400">
                                    {studentHistory.length > 0
                                        ? Math.round(studentHistory.reduce((acc, c) => acc + c.score, 0) / studentHistory.length)
                                        : 0}%
                                </div>
                                <div className="text-xs text-slate-500 dark:text-slate-400 font-bold uppercase tracking-wider">Média</div>
                            </div>
                            <div className="bg-white dark:bg-slate-800 p-4 rounded-xl border border-slate-200 dark:border-slate-700 shadow-sm text-center">
                                <div className="text-2xl font-bold text-amber-600 dark:text-amber-400">{studentReleases.length}</div>
                                <div className="text-xs text-slate-500 dark:text-slate-400 font-bold uppercase tracking-wider">Atribuições</div>
                            </div>
                        </div>

                        {/* Histórico de Desempenho */}
                        <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 shadow-sm overflow-hidden flex flex-col h-[500px]">
                            <div className="p-4 border-b border-slate-100 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 flex justify-between items-center">
                                <h3 className="font-bold text-slate-800 dark:text-slate-100 flex items-center gap-2"><FileText size={18} /> Histórico Acadêmico</h3>
                                {loadingHistory && <Loader2 className="animate-spin text-indigo-600 dark:text-indigo-400" size={16} />}
                            </div>

                            <div className="flex-1 overflow-y-auto">
                                {studentHistory.length === 0 ? (
                                    <div className="flex flex-col items-center justify-center h-full text-slate-400 dark:text-slate-500">
                                        <FileText size={48} className="mb-2 opacity-20" />
                                        <p>Nenhum histórico de provas registrado.</p>
                                    </div>
                                ) : (
                                    <table className="w-full text-left">
                                        <thead className="bg-slate-50 dark:bg-slate-800 border-b border-slate-100 dark:border-slate-700 text-xs font-bold text-slate-500 dark:text-slate-400 uppercase sticky top-0">
                                            <tr>
                                                <th className="px-6 py-3">Título da Prova</th>
                                                <th className="px-6 py-3">Matéria / Série</th>
                                                <th className="px-6 py-3">Data</th>
                                                <th className="px-6 py-3 text-right">Nota</th>
                                            </tr>
                                        </thead>
                                        <tbody className="divide-y divide-slate-100 dark:divide-slate-700">
                                            {studentHistory.map(res => (
                                                <tr
                                                    key={res.id}
                                                    onClick={() => res.test_id && onViewTest?.(res.test_id)}
                                                    className={`hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors ${onViewTest ? 'cursor-pointer group' : ''}`}
                                                >
                                                    <td className="px-6 py-4">
                                                        <div className={`font-bold text-slate-800 dark:text-slate-200 text-sm ${onViewTest ? 'group-hover:text-indigo-600 dark:group-hover:text-indigo-400 transition-colors' : ''}`}>{res.tests?.title || 'Unknown Test'}</div>
                                                        <div className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">Prof. {(res.tests as any)?.professors?.name || 'Unknown'}</div>
                                                    </td>
                                                    <td className="px-6 py-4">
                                                        <span className="text-xs bg-slate-100 dark:bg-slate-700 px-2 py-1 rounded text-slate-600 dark:text-slate-300 font-medium border border-slate-200 dark:border-slate-600">
                                                            {(res.tests as any)?.school_grades?.name || 'N/A'}
                                                        </span>
                                                    </td>
                                                    <td className="px-6 py-4">
                                                        <div className="flex items-center gap-2 text-sm text-slate-600 dark:text-slate-300">
                                                            <Calendar size={14} className="text-slate-400 dark:text-slate-500" />
                                                            {new Date(res.correction_date || '').toLocaleDateString()}
                                                        </div>
                                                    </td>
                                                    <td className="px-6 py-4 text-right">
                                                        <span className={`inline-flex items-center gap-1 px-3 py-1 rounded-lg text-sm font-bold ${res.score >= 70 ? 'bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-300' : 'bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-300'}`}>
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

                        {/* Seção de Deficiências */}
                        <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 shadow-sm">
                            <StudentDisabilityManager
                                hasSupabase={hasSupabase}
                                institutionId={selectedStudent.institution_id}
                                studentId={selectedStudent.id}
                                studentName={selectedStudent.name}
                            />
                        </div>
                    </div>
                </div>
            </div>
        );
    }

    // --- LIST VIEW ---
    return (
        <div className="max-w-6xl mx-auto space-y-8">
            {/* ... Cabeçalho ... */}
            <div className="flex justify-between items-center">
                <div>
                    <h2 className="text-3xl font-bold text-slate-900 dark:text-slate-100">Diretório de Alunos</h2>
                    <p className="text-slate-500 dark:text-slate-400 mt-1">Gerencie identidades de alunos, matrículas e integridade</p>
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
                    {view === 'list' && !readOnly && hasInstitutionContext && (
                        <button onClick={() => setView('create')} className="bg-indigo-600 dark:bg-indigo-500 hover:bg-indigo-700 dark:hover:bg-indigo-600 text-white px-5 py-2.5 rounded-xl font-bold flex items-center gap-2 shadow-lg shadow-indigo-200 dark:shadow-indigo-900/50 transition-all">
                            <Plus size={20} /> Novo Aluno
                        </button>
                    )}
                    {view === 'create' && (
                        <button onClick={() => { setView('list'); setRegFile(null); setPreviewUrl(null); }} className="text-slate-500 dark:text-slate-400 hover:text-indigo-600 dark:hover:text-indigo-400 font-bold flex items-center gap-2 transition-all">
                            <ArrowLeft size={20} /> Cancelar
                        </button>
                    )}
                </div>
            </div>

            <ConfirmationModal
                isOpen={modalConfig.isOpen}
                onClose={() => setModalConfig({ ...modalConfig, isOpen: false })}
                onConfirm={executeAction}
                title={modalConfig.action === 'delete' ? "Excluir Aluno" : "Restaurar Aluno"}
                message={
                    modalConfig.action === 'delete'
                        ? <span>Tem certeza de que deseja excluir <strong>{modalConfig.name}</strong>? Esta é uma exclusão lógica.</span>
                        : <span>Restaurar <strong>{modalConfig.name}</strong>?</span>
                }
                confirmLabel={modalConfig.action === 'delete' ? "Excluir" : "Restaurar"}
                isDestructive={modalConfig.action === 'delete'}
                isLoading={isActionLoading}
            />

            {/* Institution Selector for Admin */}
            {!isManagerMode && (
                <div className="bg-white dark:bg-slate-800 p-4 rounded-xl border border-slate-200 dark:border-slate-700 shadow-sm">
                    <label className="block text-xs font-bold text-slate-500 dark:text-slate-400 uppercase mb-1">Contexto da Instituição</label>
                    <div className="relative">
                        <Building2 size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 dark:text-slate-500" />
                        <select
                            value={filterInst}
                            onChange={e => {
                                setFilterInst(e.target.value);
                                setFormData(prev => ({ ...prev, institution_id: e.target.value, class_id: '', grade_id: '' }));
                                // Reset filters when institution changes
                                setFilterGrade('');
                                setFilterClass('');
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
            {hasInstitutionContext && view === 'list' && (
                <div className="bg-white dark:bg-slate-800 p-4 rounded-xl border border-slate-200 dark:border-slate-700 shadow-sm">
                    <div className="flex items-center gap-2 mb-3">
                        <BookOpen size={16} className="text-indigo-600" />
                        <h3 className="text-sm font-bold text-slate-700 dark:text-slate-200 uppercase">Filtros de Listagem</h3>
                        <span className="text-xs text-slate-500 dark:text-slate-400 ml-auto">
                            {displayedStudents.length} aluno{displayedStudents.length !== 1 ? 's' : ''} encontrado{displayedStudents.length !== 1 ? 's' : ''}
                        </span>
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                        <div>
                            <label className="block text-xs font-bold text-slate-500 dark:text-slate-400 uppercase mb-1">Série</label>
                            <div className="relative">
                                <GraduationCap size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 dark:text-slate-500" />
                                <select
                                    value={filterGrade}
                                    onChange={e => {
                                        setFilterGrade(e.target.value);
                                        setFilterClass(''); // Reset class when grade changes
                                    }}
                                    className="w-full border border-slate-300 dark:border-slate-600 rounded-lg pl-10 pr-4 py-2 text-sm text-slate-900 dark:text-slate-100 bg-white dark:bg-slate-700 focus:ring-2 focus:ring-indigo-500 outline-none cursor-pointer"
                                >
                                    <option value="">Todas as Séries</option>
                                    {filterGrades.map(g => <option key={g.id} value={g.id}>{g.name}</option>)}
                                </select>
                            </div>
                        </div>
                        <div>
                            <label className="block text-xs font-bold text-slate-500 dark:text-slate-400 uppercase mb-1">Turma</label>
                            <div className="relative">
                                <Users size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 dark:text-slate-500" />
                                <select
                                    value={filterClass}
                                    onChange={e => setFilterClass(e.target.value)}
                                    disabled={!filterGrade}
                                    className="w-full border border-slate-300 dark:border-slate-600 rounded-lg pl-10 pr-4 py-2 text-sm text-slate-900 dark:text-slate-100 bg-white dark:bg-slate-700 focus:ring-2 focus:ring-indigo-500 outline-none cursor-pointer disabled:bg-slate-50 dark:disabled:bg-slate-800 disabled:text-slate-400 dark:disabled:text-slate-500"
                                >
                                    <option value="">Todas as Turmas</option>
                                    {filterClasses.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                                </select>
                            </div>
                        </div>
                        <div className="flex items-end">
                            <button
                                onClick={() => {
                                    setFilterGrade('');
                                    setFilterClass('');
                                }}
                                className="w-full bg-slate-100 dark:bg-slate-700 hover:bg-slate-200 dark:hover:bg-slate-600 text-slate-700 dark:text-slate-200 px-4 py-2 rounded-lg text-sm font-bold flex items-center justify-center gap-2 transition-colors"
                            >
                                <X size={16} /> Limpar Filtros
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Bulk Import Section */}
            {view === 'list' && (
                <div className="bg-white dark:bg-slate-800 p-4 rounded-xl border border-slate-200 dark:border-slate-700 shadow-sm">
                    <div className="flex items-center gap-2 mb-3">
                        <Users size={16} className="text-indigo-600 dark:text-indigo-400" />
                        <h3 className="text-sm font-bold text-slate-700 dark:text-slate-200 uppercase">Importação em Lote</h3>
                        {!canBulkImportStudents && (
                            <span className="ml-auto text-xs text-slate-500 dark:text-slate-400">Disponível apenas para Institution e Administrator</span>
                        )}
                    </div>

                    <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
                        <div className="lg:col-span-1">
                            <p className="text-sm text-slate-600 dark:text-slate-300">
                                Envie um arquivo <strong>CSV/XLS/XLSX</strong> com os dados dos alunos. O sistema valida o formato e mostra uma prévia antes de inserir.
                            </p>
                            <div className="mt-3 flex flex-wrap gap-2">
                                <button
                                    type="button"
                                    disabled={!canBulkImportStudents}
                                    onClick={() => {
                                        const csvContent: string = buildStudentImportTemplateCsv();
                                        const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8' });
                                        const url = URL.createObjectURL(blob);
                                        const a = document.createElement('a');
                                        a.href = url;
                                        a.download = 'students_import_template.csv';
                                        document.body.appendChild(a);
                                        a.click();
                                        a.remove();
                                        URL.revokeObjectURL(url);
                                    }}
                                    className="bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-600 text-slate-700 dark:text-slate-200 px-3 py-2 rounded-lg text-sm font-bold hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                                >
                                    Baixar modelo (CSV)
                                </button>
                                <button
                                    type="button"
                                    disabled={!canBulkImportStudents}
                                    onClick={() => {
                                        const bytes: Uint8Array = buildStudentImportTemplateXlsx();
                                        const blob = new Blob([bytes], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
                                        const url = URL.createObjectURL(blob);
                                        const a = document.createElement('a');
                                        a.href = url;
                                        a.download = 'students_import_template.xlsx';
                                        document.body.appendChild(a);
                                        a.click();
                                        a.remove();
                                        URL.revokeObjectURL(url);
                                    }}
                                    className="bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-600 text-slate-700 dark:text-slate-200 px-3 py-2 rounded-lg text-sm font-bold hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                                >
                                    Baixar modelo (XLSX)
                                </button>
                            </div>
                            <div className="mt-3 text-xs text-slate-500 dark:text-slate-400">
                                Colunas obrigatórias: {getStudentImportTemplateColumns().filter(c => c.required).map(c => c.label).join(', ')}
                            </div>
                        </div>

                        <div className="lg:col-span-2">
                            <input
                                ref={importFileInputRef}
                                type="file"
                                accept=".csv,.xls,.xlsx"
                                className="hidden"
                                onChange={async (e) => {
                                    const file = e.target.files?.[0] || null;
                                    setImportResult(null);
                                    setImportErrors([]);
                                    setImportPreviewRows([]);
                                    setImportValidatedItems([]);
                                    setImportValidCount(0);
                                    setImportFile(file);
                                    if (!file) return;
                                    if (!canBulkImportStudents) return;
                                    const activeInstId: string = institutionId || filterInst;
                                    if (!activeInstId) {
                                        alert('Selecione uma instituição antes de importar.');
                                        return;
                                    }
                                    setIsParsingImportFile(true);
                                    try {
                                        const { rawRows } = await parseStudentImportFile(file);
                                        const activeGrades = grades.filter(g => g.institution_id === activeInstId);
                                        const activeClasses = classes.filter(c => c.institution_id === activeInstId);
                                        const gradeMap: Map<string, string> = new Map(activeGrades.map(g => [String(g.name).trim().toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/\s+/g, '_').replace(/[^a-z0-9_]/g, ''), g.id]));
                                        const classMap: Map<string, string> = new Map(activeClasses.map(c => [String(c.name).trim().toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/\s+/g, '_').replace(/[^a-z0-9_]/g, ''), c.id]));
                                        const validation = validateStudentImportRows(rawRows, { institutionId: activeInstId, gradeNameToId: gradeMap, classNameToId: classMap });

                                        setImportErrors(validation.errors);
                                        setImportValidCount(validation.validRows.length);
                                        setImportValidatedItems(validation.validRows.map(v => ({ student: v.student, address: v.address, rowNumber: v.rowNumber })));
                                        setImportPreviewRows(validation.validRows.slice(0, 10).map(v => ({
                                            rowNumber: v.rowNumber,
                                            email: v.student.email,
                                            name: `${v.student.first_name} ${v.student.last_name}`.trim(),
                                            grade: activeGrades.find(g => g.id === v.student.grade_id)?.name || '',
                                            className: v.student.class_id ? (activeClasses.find(c => c.id === v.student.class_id)?.name || '') : ''
                                        })));
                                    } catch (err: any) {
                                        alert(getFriendlyErrorMessage(err));
                                    } finally {
                                        setIsParsingImportFile(false);
                                    }
                                }}
                            />

                            <div className="flex flex-wrap items-center gap-2">
                                <button
                                    type="button"
                                    disabled={!canBulkImportStudents}
                                    onClick={() => importFileInputRef.current?.click()}
                                    className="bg-indigo-600 dark:bg-indigo-500 hover:bg-indigo-700 dark:hover:bg-indigo-600 text-white px-4 py-2 rounded-lg text-sm font-bold flex items-center gap-2 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                                >
                                    <FileText size={16} /> Selecionar arquivo
                                </button>
                                {importFile && (
                                    <span className="text-sm text-slate-600 dark:text-slate-300">
                                        Arquivo: <strong>{importFile.name}</strong>
                                    </span>
                                )}
                                {isParsingImportFile && (
                                    <span className="text-sm text-slate-500 dark:text-slate-400 flex items-center gap-2">
                                        <Loader2 size={16} className="animate-spin" /> Lendo e validando...
                                    </span>
                                )}
                                {importResult && (
                                    <span className="text-sm text-emerald-700 dark:text-emerald-300 flex items-center gap-2">
                                        <CheckCircle size={16} /> Importados: {importResult.successCount} | Falhas: {importResult.failureCount}
                                    </span>
                                )}
                            </div>

                            <div className="mt-3 grid grid-cols-1 md:grid-cols-3 gap-3">
                                <div className="bg-slate-50 dark:bg-slate-700/40 border border-slate-200 dark:border-slate-600 rounded-lg p-3">
                                    <div className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase">Linhas válidas</div>
                                    <div className="text-xl font-extrabold text-slate-900 dark:text-slate-100">{importValidCount}</div>
                                </div>
                                <div className="bg-slate-50 dark:bg-slate-700/40 border border-slate-200 dark:border-slate-600 rounded-lg p-3">
                                    <div className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase">Erros</div>
                                    <div className="text-xl font-extrabold text-slate-900 dark:text-slate-100">{importErrors.length}</div>
                                </div>
                                <div className="flex items-center">
                                    <button
                                        type="button"
                                        disabled={!canBulkImportStudents || isParsingImportFile || isImporting || importValidatedItems.length === 0 || importErrors.length > 0}
                                        onClick={async () => {
                                            if (!registerStudentsBulk) return;
                                            setIsImporting(true);
                                            setImportResult(null);
                                            try {
                                                const items = importValidatedItems.map(i => ({ student: i.student, address: i.address }));
                                                const result = await registerStudentsBulk(items);
                                                setImportResult({ successCount: result.successCount, failureCount: result.errors.length });
                                                if (importFileInputRef.current) importFileInputRef.current.value = '';
                                                setImportFile(null);
                                            } catch (err: any) {
                                                alert(getFriendlyErrorMessage(err));
                                            } finally {
                                                setIsImporting(false);
                                            }
                                        }}
                                        className="w-full bg-emerald-600 dark:bg-emerald-500 hover:bg-emerald-700 dark:hover:bg-emerald-600 text-white px-4 py-2 rounded-lg text-sm font-bold flex items-center justify-center gap-2 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                                    >
                                        {isImporting ? <Loader2 size={16} className="animate-spin" /> : <Save size={16} />}
                                        {isImporting ? 'Importando...' : 'Importar alunos'}
                                    </button>
                                </div>
                            </div>

                            {importErrors.length > 0 && (
                                <div className="mt-3 bg-rose-50 dark:bg-rose-900/20 border border-rose-200 dark:border-rose-800 rounded-lg p-3">
                                    <div className="flex items-center gap-2 text-rose-700 dark:text-rose-300 font-bold text-sm">
                                        <AlertTriangle size={16} /> Erros encontrados (corrija o arquivo e envie novamente)
                                    </div>
                                    <div className="mt-2 max-h-40 overflow-auto text-xs text-rose-700 dark:text-rose-300 space-y-1">
                                        {importErrors.slice(0, 30).map((e, idx) => (
                                            <div key={idx}>
                                                Linha {e.rowNumber}{e.field ? ` (${e.field})` : ''}: {e.message}
                                            </div>
                                        ))}
                                        {importErrors.length > 30 && (
                                            <div className="text-rose-600 dark:text-rose-300">... e mais {importErrors.length - 30} erro(s)</div>
                                        )}
                                    </div>
                                </div>
                            )}

                            {importPreviewRows.length > 0 && (
                                <div className="mt-3 bg-slate-50 dark:bg-slate-700/40 border border-slate-200 dark:border-slate-600 rounded-lg p-3">
                                    <div className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase mb-2">Prévia (primeiras 10 linhas válidas)</div>
                                    <div className="overflow-auto">
                                        <table className="min-w-full text-sm">
                                            <thead>
                                                <tr className="text-left text-xs text-slate-500 dark:text-slate-400 uppercase">
                                                    <th className="py-1 pr-3">Linha</th>
                                                    <th className="py-1 pr-3">Nome</th>
                                                    <th className="py-1 pr-3">E-mail</th>
                                                    <th className="py-1 pr-3">Série</th>
                                                    <th className="py-1 pr-3">Turma</th>
                                                </tr>
                                            </thead>
                                            <tbody>
                                                {importPreviewRows.map(r => (
                                                    <tr key={r.rowNumber} className="border-t border-slate-200 dark:border-slate-600 text-slate-700 dark:text-slate-200">
                                                        <td className="py-1 pr-3">{r.rowNumber}</td>
                                                        <td className="py-1 pr-3">{r.name}</td>
                                                        <td className="py-1 pr-3">{r.email}</td>
                                                        <td className="py-1 pr-3">{r.grade}</td>
                                                        <td className="py-1 pr-3">{r.className || '-'}</td>
                                                    </tr>
                                                ))}
                                            </tbody>
                                        </table>
                                    </div>
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            )}

            {/* No Institution Selected Message */}
            {!hasInstitutionContext && !loading && (
                <div className="bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-xl p-8 text-center">
                    <Building2 size={48} className="mx-auto text-amber-400 dark:text-amber-500 mb-4" />
                    <h3 className="text-lg font-bold text-amber-800 dark:text-amber-300 mb-2">Nenhuma Instituição Selecionada</h3>
                    <p className="text-amber-600 dark:text-amber-400 text-sm">Selecione uma instituição acima para visualizar e gerenciar os alunos.</p>
                </div>
            )}

            {error && (
                <div className="bg-red-50 dark:bg-red-900/30 border border-red-200 dark:border-red-800 rounded-xl p-8 text-center">
                    <AlertTriangle className="mx-auto text-red-500 dark:text-red-400 mb-4" size={48} />
                    <h3 className="text-lg font-bold text-red-700 dark:text-red-300 mb-2">Falha ao carregar Alunos</h3>
                    <p className="text-red-600 dark:text-red-400 mb-6">{error}</p>
                    <button onClick={refresh} className="inline-flex items-center gap-2 px-4 py-2 bg-white dark:bg-slate-800 border border-red-200 dark:border-red-800 text-red-700 dark:text-red-400 rounded-lg hover:bg-red-100 dark:hover:bg-red-900/30 transition-colors font-medium"><RotateCcw size={16} /> Tentar Novamente</button>
                </div>
            )}

            {hasInstitutionContext && view === 'create' && (
                <form onSubmit={handleRegister} className="bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-xl overflow-hidden animate-in fade-in slide-in-from-right-4">
                    <div className="bg-slate-50 dark:bg-slate-900 p-6 border-b border-slate-100 dark:border-slate-700">
                        <h3 className="font-bold text-lg text-slate-800 dark:text-slate-100 flex items-center gap-2"><User size={20} className="text-indigo-600 dark:text-indigo-400" /> Novo Cadastro de Aluno</h3>
                        <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">Matricule um aluno, crie sua conta de usuário e atribua a uma instituição.</p>
                    </div>

                    <div className="p-8 grid grid-cols-1 md:grid-cols-2 gap-8">
                        <div className="space-y-6">
                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-xs font-bold text-slate-500 dark:text-slate-400 uppercase mb-1">Nome</label>
                                    <input required value={formData.first_name} onChange={e => setFormData({ ...formData, first_name: e.target.value })} className="w-full border border-slate-300 dark:border-slate-600 rounded-lg px-3 py-2 outline-none bg-white dark:bg-slate-700 text-slate-900 dark:text-slate-100" />
                                </div>
                                <div>
                                    <label className="block text-xs font-bold text-slate-500 dark:text-slate-400 uppercase mb-1">Sobrenome</label>
                                    <input required value={formData.last_name} onChange={e => setFormData({ ...formData, last_name: e.target.value })} className="w-full border border-slate-300 dark:border-slate-600 rounded-lg px-3 py-2 outline-none bg-white dark:bg-slate-700 text-slate-900 dark:text-slate-100" />
                                </div>
                            </div>
                            <div>
                                <label className="block text-xs font-bold text-slate-500 dark:text-slate-400 uppercase mb-1">E-mail</label>
                                <input type="email" required value={formData.email} onChange={e => setFormData({ ...formData, email: e.target.value })} className="w-full border border-slate-300 dark:border-slate-600 rounded-lg px-3 py-2 outline-none bg-white dark:bg-slate-700 text-slate-900 dark:text-slate-100" />
                            </div>
                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-xs font-bold text-slate-500 dark:text-slate-400 uppercase mb-1">Data de Nascimento</label>
                                    <input type="date" value={formData.birthdate} onChange={handleBirthDateChange} className="w-full border border-slate-300 dark:border-slate-600 rounded-lg px-3 py-2 outline-none bg-white dark:bg-slate-700 text-slate-900 dark:text-slate-100" />
                                </div>
                                <div>
                                    <label className="block text-xs font-bold text-slate-500 dark:text-slate-400 uppercase mb-1">Gênero</label>
                                    <select value={formData.gender} onChange={e => setFormData({ ...formData, gender: e.target.value })} className="w-full border border-slate-300 dark:border-slate-600 rounded-lg px-3 py-2 outline-none bg-white dark:bg-slate-700 text-slate-900 dark:text-slate-100">
                                        <option value="Male">Masculino</option>
                                        <option value="Female">Feminino</option>
                                        <option value="Other">Outro</option>
                                    </select>
                                </div>
                            </div>

                            <div className="pt-4 border-t border-slate-100 dark:border-slate-700">
                                <h4 className="text-sm font-bold text-slate-700 dark:text-slate-200 mb-3 flex items-center gap-2"><MapPin size={16} /> Endereço</h4>
                                <div className="space-y-3">
                                    <div className="grid grid-cols-2 gap-3">
                                        <select
                                            value={selectedCountry}
                                            onChange={e => {
                                                setSelectedCountry(e.target.value);
                                                setFormData({ ...formData, country: e.target.value, state_province: '' });
                                            }}
                                            disabled={loadingCountries}
                                            className="w-full border border-slate-300 dark:border-slate-600 rounded-lg px-3 py-2 text-sm outline-none bg-white dark:bg-slate-700 text-slate-900 dark:text-slate-100 cursor-pointer disabled:bg-slate-100 dark:disabled:bg-slate-800"
                                        >
                                            <option value="">{loadingCountries ? 'Carregando...' : 'Selecione o País'}</option>
                                            {countries.map(c => (
                                                <option key={c.iso2 || c.name} value={c.name}>{getCountryDisplayName(c.name)}</option>
                                            ))}
                                        </select>
                                        <select
                                            value={selectedState}
                                            onChange={e => {
                                                setSelectedState(e.target.value);
                                                setFormData({ ...formData, state_province: e.target.value });
                                            }}
                                            disabled={!selectedCountry || loadingStates}
                                            className="w-full border border-slate-300 dark:border-slate-600 rounded-lg px-3 py-2 text-sm outline-none bg-white dark:bg-slate-700 text-slate-900 dark:text-slate-100 cursor-pointer disabled:bg-slate-100 dark:disabled:bg-slate-800"
                                        >
                                            <option value="">
                                                {!selectedCountry ? 'Selecione um país' : loadingStates ? 'Carregando...' : states.length === 0 ? 'Outro / Nenhum' : 'Selecione o Estado'}
                                            </option>
                                            {states.map(s => (
                                                <option key={s.state_code || s.name} value={s.name}>{s.name}</option>
                                            ))}
                                        </select>
                                    </div>
                                    <input value={formData.city} onChange={e => setFormData({ ...formData, city: e.target.value })} placeholder="Cidade" className="w-full border border-slate-300 dark:border-slate-600 rounded-lg px-3 py-2 text-sm outline-none bg-white dark:bg-slate-700 text-slate-900 dark:text-slate-100" />
                                    <input value={formData.address_line_1} onChange={e => setFormData({ ...formData, address_line_1: e.target.value })} placeholder="Rua, Número" className="w-full border border-slate-300 dark:border-slate-600 rounded-lg px-3 py-2 text-sm outline-none bg-white dark:bg-slate-700 text-slate-900 dark:text-slate-100" />
                                    <input value={formData.postal_code} onChange={e => setFormData({ ...formData, postal_code: e.target.value })} placeholder="CEP" className="w-full border border-slate-300 dark:border-slate-600 rounded-lg px-3 py-2 text-sm outline-none bg-white dark:bg-slate-700 text-slate-900 dark:text-slate-100" />
                                </div>
                            </div>
                        </div>

                        <div className="space-y-6">
                            {/* Seleção de Instituição - BLOQUEADO SE GERENCIADOR */}
                            <div>
                                <label className="block text-xs font-bold text-slate-500 dark:text-slate-400 uppercase mb-1">Instituição</label>
                                {institutionId ? (
                                    <div className="w-full border border-slate-200 dark:border-slate-600 bg-slate-50 dark:bg-slate-700 rounded-lg px-4 py-2 text-slate-700 dark:text-slate-200 flex items-center gap-2">
                                        <Lock size={14} className="text-indigo-500 dark:text-indigo-400" />
                                        <span className="font-medium">{institutions.find(i => i.id === institutionId)?.name || "Instituição Atual"}</span>
                                    </div>
                                ) : (
                                    <div className="relative">
                                        <Building2 size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 dark:text-slate-500" />
                                        <select required value={formData.institution_id} onChange={e => setFormData({ ...formData, institution_id: e.target.value, class_id: '', grade_id: '' })} className="w-full border border-slate-300 dark:border-slate-600 rounded-lg pl-10 pr-4 py-2 text-slate-900 dark:text-slate-100 bg-white dark:bg-slate-700 focus:ring-2 focus:ring-indigo-500 outline-none">
                                            <option value="">Selecionar Escola</option>
                                            {institutions.map(i => <option key={i.id} value={i.id}>{i.name}</option>)}
                                        </select>
                                    </div>
                                )}
                            </div>
                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-xs font-bold text-slate-500 dark:text-slate-400 uppercase mb-1">Série/Ano</label>
                                    <select required value={formData.grade_id} onChange={e => setFormData({ ...formData, grade_id: e.target.value, class_id: '' })} disabled={!formData.institution_id} className="w-full border border-slate-300 dark:border-slate-600 rounded-lg px-3 py-2 text-slate-900 dark:text-slate-100 bg-white dark:bg-slate-700 focus:ring-2 focus:ring-indigo-500 outline-none disabled:bg-slate-50 dark:disabled:bg-slate-800 disabled:text-slate-400 dark:disabled:text-slate-500">
                                        <option value="">Selecionar Série</option>
                                        {filteredGrades.map(g => <option key={g.id} value={g.id}>{g.name}</option>)}
                                    </select>
                                </div>
                                {/* ... Gênero ... */}
                            </div>
                            <div>
                                <label className="block text-xs font-bold text-slate-500 dark:text-slate-400 uppercase mb-1">Turma (Opcional)</label>
                                <div className="relative">
                                    <Users size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 dark:text-slate-500" />
                                    <select value={formData.class_id} onChange={e => setFormData({ ...formData, class_id: e.target.value })} className="w-full border border-slate-300 dark:border-slate-600 rounded-lg pl-10 pr-4 py-2 text-slate-900 dark:text-slate-100 bg-white dark:bg-slate-700 focus:ring-2 focus:ring-indigo-500 outline-none disabled:bg-slate-50 dark:disabled:bg-slate-800 disabled:text-slate-400 dark:disabled:text-slate-500" disabled={!formData.institution_id || !formData.grade_id}>
                                        <option value="">{formData.grade_id ? "Sem Turma" : "Selecione a Série Primeiro"}</option>
                                        {filteredClasses.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                                    </select>
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
                            {isSubmitting ? <Loader2 size={20} className="animate-spin" /> : <CheckCircle size={20} />}
                            {isSubmitting ? 'Matriculando...' : 'Concluir Matrícula'}
                        </button>
                    </div>
                </form>
            )}

            {hasInstitutionContext && view === 'list' && (
                <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 overflow-hidden shadow-sm">
                    <table className="w-full text-left">
                        <thead className="bg-slate-50 dark:bg-slate-900 border-b border-slate-200 dark:border-slate-700">
                            <tr>
                                <th className="p-4 text-sm font-bold text-slate-600 dark:text-slate-400 uppercase tracking-wider" style={{ width: '35%' }}>Aluno</th>
                                <th className="p-4 text-sm font-bold text-slate-600 dark:text-slate-400 uppercase tracking-wider" style={{ width: '35%' }}>Série / Turma / Instituição</th>
                                <th className="p-4 text-sm font-bold text-slate-600 dark:text-slate-400 uppercase tracking-wider" style={{ width: '20%' }}>ID Hash</th>
                                <th className="p-4 text-sm font-bold text-slate-600 dark:text-slate-400 uppercase tracking-wider text-right" style={{ width: '10%', minWidth: '100px' }}>Ações</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100 dark:divide-slate-700">
                            {loading ? (
                                <tr><td colSpan={4} className="p-12 text-center text-slate-400 dark:text-slate-500"><Loader2 className="animate-spin inline mr-2" /> Carregando dados...</td></tr>
                            ) : displayedStudents.length === 0 ? (
                                <tr><td colSpan={4} className="p-12 text-center text-slate-400 dark:text-slate-500">Nenhum aluno encontrado.</td></tr>
                            ) : paginatedStudents.map(s => (
                                <tr key={s.id} onClick={() => handleViewDetails(s)} className={`transition-colors cursor-pointer group ${s.deleted ? 'bg-red-50 dark:bg-red-900/20 hover:bg-red-100 dark:hover:bg-red-900/30 border-l-4 border-l-red-400 dark:border-l-red-600' : 'hover:bg-slate-50 dark:hover:bg-slate-700'}`}>
                                    <td className="p-4">
                                        <div className="flex items-center gap-3">
                                            <div className="w-8 h-8 rounded-full bg-slate-100 dark:bg-slate-700 flex items-center justify-center text-slate-500 dark:text-slate-400 overflow-hidden shrink-0">
                                                {s.app_users?.profile_picture_url ? <img src={s.app_users.profile_picture_url} className="w-full h-full object-cover" /> : <User size={16} />}
                                            </div>
                                            <div className="min-w-0">
                                                <span className="font-bold text-slate-900 dark:text-slate-100 group-hover:text-indigo-600 dark:group-hover:text-indigo-400 transition-colors block truncate">{s.name}</span>
                                                {s.deleted && <span className="bg-red-200 dark:bg-red-900/30 text-red-800 dark:text-red-300 text-[10px] px-1.5 py-0.5 rounded font-bold uppercase">Deleted</span>}
                                                <p className="text-xs text-slate-500 dark:text-slate-400 truncate">{s.app_users?.email}</p>
                                            </div>
                                        </div>
                                    </td>
                                    <td className="p-4">
                                        <div className="space-y-1">
                                            <span className="inline-flex gap-1 items-center bg-indigo-50 dark:bg-indigo-900/30 text-indigo-700 dark:text-indigo-300 px-2 py-0.5 rounded text-xs font-bold uppercase"><GraduationCap size={10} /> {s.school_grades?.name || 'Unassigned'}</span>
                                            {s.institutions && (
                                                <div className="flex items-center gap-1 text-xs text-slate-500 dark:text-slate-400 truncate">
                                                    <Building2 size={12} /> <span className="truncate">{s.institutions.name}</span>
                                                </div>
                                            )}
                                            {s.classes && (
                                                <div className="flex items-center gap-1 text-xs text-slate-500 dark:text-slate-400 truncate">
                                                    <Users size={12} /> <span className="truncate">{s.classes.name}</span>
                                                </div>
                                            )}
                                        </div>
                                    </td>
                                    <td className="p-4">
                                        <div className="flex items-center gap-2 font-mono text-xs text-slate-600 dark:text-slate-300 bg-slate-100 dark:bg-slate-700 px-2 py-1 rounded w-fit border border-slate-200 dark:border-slate-600">
                                            <Hash size={12} className="text-slate-400 dark:text-slate-500 shrink-0" />
                                            <span className="truncate">{(s.student_hash || '').substring(0, 16)}...</span>
                                        </div>
                                    </td>
                                    <td className="p-4 text-right overflow-visible">
                                        <div className="flex justify-end gap-1 opacity-0 group-hover:opacity-100 transition-opacity shrink-0 min-w-fit">
                                            <button onClick={(e) => { e.stopPropagation(); handleViewDetails(s); }} className="p-1.5 text-slate-400 dark:text-slate-500 hover:text-indigo-600 dark:hover:text-indigo-400 hover:bg-indigo-50 dark:hover:bg-indigo-900/30 rounded transition-all shrink-0 flex-shrink-0" title="View Profile"><Eye size={16} /></button>
                                            {isAdmin && s.deleted ? (
                                                <button onClick={(e) => { e.stopPropagation(); openRestoreModal(s) }} className="p-1.5 text-emerald-600 dark:text-emerald-400 hover:text-emerald-700 dark:hover:text-emerald-300 hover:bg-emerald-50 dark:hover:bg-emerald-900/30 rounded transition-all shrink-0 flex-shrink-0" title="Restore">
                                                    <RotateCcw size={16} />
                                                </button>
                                            ) : !s.deleted && !readOnly && (
                                                <button onClick={(e) => { e.stopPropagation(); openDeleteModal(s); }} className="p-1.5 text-slate-400 dark:text-slate-500 hover:text-red-600 dark:hover:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/30 rounded transition-all shrink-0 flex-shrink-0" title="Delete">
                                                    <Trash2 size={16} />
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
            {hasInstitutionContext && view === 'list' && displayedStudents.length > 0 && (
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
                                Mostrando {startIndex + 1} - {Math.min(endIndex, displayedStudents.length)} de {displayedStudents.length} aluno{displayedStudents.length !== 1 ? 's' : ''}
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
                                            className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${currentPage === pageNum
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

            {/* ... Edit Modal ... */}
        </div>
    );
};

export default StudentManager;
