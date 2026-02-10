
import React, { useState, useEffect, useRef, useMemo } from 'react';
import { useTestReleaseManager } from '../presentation/hooks/useTestReleaseManager';
import { TestRelease, GeoPoint, TestReleaseSite } from '../types';
import {
    Calendar, Clock, MapPin, CheckCircle, XCircle, Trash2, Plus,
    AlertTriangle, RotateCcw, Map as MapIcon, Globe, BookOpen, Eye, ArrowLeft, Loader2, Building2, User, Globe2, Link, Save, Bot, ClipboardCheck, X, Image as ImageIcon, ExternalLink, Eraser, ChevronLeft, ChevronRight, Info
} from 'lucide-react';
import ConfirmationModal from './ConfirmationModal';
import TestManager from './TestManager';
import ProfessorDetails from './ProfessorDetails';
import StudentManager from './StudentManager';

interface TestReleaseManagerProps {
    hasSupabase: boolean;
    institutionId?: string; // Optional prop for Strict Isolation
}

declare global {
    interface Window {
        L: any; // Leaflet global
    }
}

const TestReleaseManager: React.FC<TestReleaseManagerProps> = ({ hasSupabase, institutionId }) => {
    // Filter State for Admin
    const [filterInst, setFilterInst] = useState(institutionId || '');

    // Pagination State
    const [currentPage, setCurrentPage] = useState(1);
    const [itemsPerPage, setItemsPerPage] = useState(25);

    // Use the effective institution ID (prop or selected)
    const effectiveInstId = institutionId || filterInst;

    const {
        releases, tests, students, professors, institutions, results,
        loading, isCreating, error, isAdmin, showDeleted, setShowDeleted,
        createRelease, deleteRelease, restoreRelease, addAllowedSite, removeAllowedSite, refresh,
        getTestDetails, getStudentAnswers
    } = useTestReleaseManager(hasSupabase, effectiveInstId || undefined);

    // Manager mode (fixed institution) vs Admin mode (can filter)
    const isManagerMode = !!institutionId || institutions.length === 1;
    const hasInstitutionContext = isManagerMode || !!filterInst;

    const [view, setView] = useState<'list' | 'create'>('list');
    const [selectedRelease, setSelectedRelease] = useState<TestRelease | null>(null);
    const [detailModalOpen, setDetailModalOpen] = useState(false);
    const [isLoadingDetails, setIsLoadingDetails] = useState(false);

    // Detail modals state
    const [testDetailModalOpen, setTestDetailModalOpen] = useState(false);
    const [professorDetailModalOpen, setProfessorDetailModalOpen] = useState(false);
    const [studentDetailModalOpen, setStudentDetailModalOpen] = useState(false);
    const [selectedTestId, setSelectedTestId] = useState<string | null>(null);
    const [selectedProfessorId, setSelectedProfessorId] = useState<string | null>(null);
    const [selectedStudentId, setSelectedStudentId] = useState<string | null>(null);

    // Modal State
    const [modalConfig, setModalConfig] = useState<{
        isOpen: boolean;
        id: string | null;
        type: 'release' | 'site';
        action: 'delete' | 'restore';
        name: string;
    }>({ isOpen: false, id: null, type: 'release', action: 'delete', name: '' });
    const [isDeleting, setIsDeleting] = useState(false);

    // Result Viewer State
    const [resultModalOpen, setResultModalOpen] = useState(false);
    const [viewingResult, setViewingResult] = useState<any>(null);
    const [isLoadingResult, setIsLoadingResult] = useState(false);

    // Form State
    const [formData, setFormData] = useState<Partial<TestRelease>>({
        test_id: '',
        student_id: '',
        professor_id: '',
        institution_id: institutionId || '', // Enforce ID
        start_time: '',
        end_time: '',
        max_attempts: 1,
        allow_consultation: false,
        allow_ai_agent: false,
        location_polygon: []
    });

    // Allowed Sites State
    const [newSites, setNewSites] = useState<Partial<TestReleaseSite>[]>([]);
    const [siteInput, setSiteInput] = useState({ url: '', title: '' });

    // Map Refs
    const mapRef = useRef<HTMLDivElement>(null);
    const mapInstance = useRef<any>(null);
    const markersRef = useRef<any[]>([]);
    const polygonRef = useRef<any>(null);
    const polylineRef = useRef<any>(null);
    const pointsRef = useRef<GeoPoint[]>([]);
    const currentLocationMarkerRef = useRef<any>(null);
    const [userLocation, setUserLocation] = useState<{ lat: number; lng: number } | null>(null);

    // Strict Filter for List View
    const filteredReleases = useMemo(() => {
        let filtered = effectiveInstId
            ? releases.filter(r => r.institution_id === effectiveInstId)
            : releases;
        // Filter by deleted status
        if (!showDeleted) {
            filtered = filtered.filter(r => !r.deleted);
        }
        return filtered;
    }, [releases, effectiveInstId, showDeleted]);

    // Pagination calculations
    const totalPages = Math.ceil(filteredReleases.length / itemsPerPage);
    const startIndex = (currentPage - 1) * itemsPerPage;
    const endIndex = startIndex + itemsPerPage;
    const paginatedReleases = useMemo(() => {
        return filteredReleases.slice(startIndex, endIndex);
    }, [filteredReleases, startIndex, endIndex]);

    // Reset page when filters change
    useEffect(() => {
        setCurrentPage(1);
    }, [effectiveInstId, showDeleted]);

    // Strict Filter for Dropdowns in Create Mode
    const filteredTests = effectiveInstId
        ? tests.filter(t => t.institution_id === effectiveInstId)
        : tests;

    const filteredStudents = effectiveInstId
        ? students.filter(s => s.institution_id === effectiveInstId)
        : students;

    // Auto-select institution if only one is available
    useEffect(() => {
        if (institutionId) {
            setFilterInst(institutionId);
            setFormData(prev => ({ ...prev, institution_id: institutionId }));
        } else if (institutions.length === 1 && !filterInst) {
            setFilterInst(institutions[0].id);
            setFormData(prev => ({ ...prev, institution_id: institutions[0].id }));
        }
    }, [institutionId, institutions, filterInst]);

    // Handle auto-populating institution and professor when test changes
    // Only auto-fill professor if not already selected manually
    useEffect(() => {
        if (formData.test_id && !formData.professor_id) {
            const selectedTest = tests.find(t => t.id === formData.test_id);
            if (selectedTest && selectedTest.professor_id) {
                setFormData(prev => ({
                    ...prev,
                    professor_id: selectedTest.professor_id,
                    institution_id: effectiveInstId || selectedTest.institution_id || '' // Prefer effective ID if exists
                }));
            }
        }
    }, [formData.test_id, tests, effectiveInstId]);

    // Map Initialization
    useEffect(() => {
        if (view === 'create' && mapRef.current && !mapInstance.current && window.L) {
            const map = window.L.map(mapRef.current);
            window.L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
                attribution: '&copy; OpenStreetMap'
            }).addTo(map);

            map.setView([-15.7801, -47.9292], 13); // Default to Brasília

            // Get and show user's current location
            if (navigator.geolocation) {
                navigator.geolocation.getCurrentPosition(
                    (pos) => {
                        const { latitude, longitude } = pos.coords;
                        setUserLocation({ lat: latitude, lng: longitude });
                        map.setView([latitude, longitude], 16);

                        // Create pulsing current location marker
                        const pulsingIcon = window.L.divIcon({
                            className: 'current-location-marker',
                            html: `
                           <div style="
                               position: relative;
                               width: 20px;
                               height: 20px;
                           ">
                               <div style="
                                   position: absolute;
                                   width: 20px;
                                   height: 20px;
                                   background: #3b82f6;
                                   border: 3px solid white;
                                   border-radius: 50%;
                                   box-shadow: 0 2px 8px rgba(59, 130, 246, 0.5);
                               "></div>
                               <div style="
                                   position: absolute;
                                   width: 20px;
                                   height: 20px;
                                   background: rgba(59, 130, 246, 0.3);
                                   border-radius: 50%;
                                   animation: pulse 2s ease-out infinite;
                               "></div>
                           </div>
                       `,
                            iconSize: [20, 20],
                            iconAnchor: [10, 10],
                        });

                        // Remove existing marker if any
                        if (currentLocationMarkerRef.current) {
                            currentLocationMarkerRef.current.remove();
                        }

                        // Add current location marker
                        currentLocationMarkerRef.current = window.L.marker([latitude, longitude], {
                            icon: pulsingIcon,
                            zIndexOffset: 1000 // Keep it on top
                        })
                            .addTo(map)
                            .bindPopup('<strong>📍 Sua localização atual</strong>')
                            .openPopup();

                        map.invalidateSize();
                    },
                    (error) => {
                        // Geolocation error - handled silently
                    },
                    { enableHighAccuracy: true, timeout: 10000, maximumAge: 60000 }
                );
            }

            setTimeout(() => map.invalidateSize(), 200);

            map.on('click', (e: any) => {
                const lat = e.latlng.lat;
                const lng = e.latlng.lng;
                const updatedPoints = [...pointsRef.current, { lat, lng }];
                pointsRef.current = updatedPoints;
                setFormData(prev => ({ ...prev, location_polygon: updatedPoints }));
                updateMapVisuals(updatedPoints, map);
            });

            mapInstance.current = map;
        }

        // Cleanup map when leaving create view
        if (view !== 'create' && mapInstance.current) {
            mapInstance.current.remove();
            mapInstance.current = null;
            markersRef.current = [];
            polygonRef.current = null;
            polylineRef.current = null;
            pointsRef.current = [];
            currentLocationMarkerRef.current = null;
            setUserLocation(null);
        }
    }, [view]);

    const updateMapVisuals = (points: GeoPoint[], map: any) => {
        // Clear existing
        markersRef.current.forEach(m => m.remove());
        markersRef.current = [];
        if (polygonRef.current) polygonRef.current.remove();
        if (polylineRef.current) polylineRef.current.remove();

        const latLngs = points.map(p => [p.lat, p.lng]);

        // Draw Polygon Fill
        if (points.length > 2) {
            polygonRef.current = window.L.polygon(latLngs, {
                stroke: false,
                fillColor: '#4f46e5',
                fillOpacity: 0.15
            }).addTo(map);
        }

        // Draw Polyline Outline
        if (points.length > 1) {
            const linePoints = points.length > 2 ? [...latLngs, latLngs[0]] : latLngs;
            polylineRef.current = window.L.polyline(linePoints, {
                color: '#4f46e5',
                weight: 3,
                lineCap: 'round',
                lineJoin: 'round',
                dashArray: points.length > 2 ? undefined : '6, 6'
            }).addTo(map);
        }

        // Draw Markers
        points.forEach(p => {
            const marker = window.L.circleMarker([p.lat, p.lng], {
                radius: 6, fillColor: '#ffffff', color: '#4f46e5', weight: 2, opacity: 1, fillOpacity: 1
            }).addTo(map);
            markersRef.current.push(marker);
        });
    };

    const clearMap = () => {
        setFormData(prev => ({ ...prev, location_polygon: [] }));
        pointsRef.current = [];
        if (mapInstance.current) {
            markersRef.current.forEach(m => m.remove());
            markersRef.current = [];
            if (polygonRef.current) polygonRef.current.remove();
            if (polylineRef.current) polylineRef.current.remove();
        }
    };

    const handleAddSite = () => {
        if (!siteInput.url) return;
        setNewSites(prev => [...prev, { url: siteInput.url, title: siteInput.title || siteInput.url }]);
        setSiteInput({ url: '', title: '' });
    };

    const handleRemoveSite = (index: number) => {
        setNewSites(prev => prev.filter((_, i) => i !== index));
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!formData.test_id || !formData.student_id || !formData.professor_id || !formData.start_time || !formData.end_time) {
            alert("Por favor, preencha todos os campos obrigatórios (Prova, Professor, Aluno, Início e Fim).");
            return;
        }

        const success = await createRelease(formData, newSites.length > 0 ? newSites : undefined);
        if (success) {
            setView('list');
            setFormData({
                test_id: '',
                student_id: '',
                professor_id: '',
                institution_id: effectiveInstId || '',
                start_time: '',
                end_time: '',
                max_attempts: 1,
                allow_consultation: false,
                allow_ai_agent: false,
                location_polygon: []
            });
            setNewSites([]);
            clearMap();
        }
    };

    const openDeleteModal = (r: TestRelease) => {
        setModalConfig({ isOpen: true, id: r.id, type: 'release', action: 'delete', name: `${r.tests?.title} para ${r.students?.name}` });
    };

    const openRestoreModal = (r: TestRelease) => {
        setModalConfig({ isOpen: true, id: r.id, type: 'release', action: 'restore', name: `${r.tests?.title} para ${r.students?.name}` });
    };

    const executeAction = async () => {
        if (!modalConfig.id) return;
        setIsDeleting(true);
        try {
            if (modalConfig.action === 'restore') {
                await restoreRelease(modalConfig.id);
            } else if (modalConfig.type === 'release') {
                await deleteRelease(modalConfig.id);
            } else {
                await removeAllowedSite(modalConfig.id);
            }
            setModalConfig({ ...modalConfig, isOpen: false });
        } finally {
            setIsDeleting(false);
        }
    };

    const getStatus = (start: string, end: string) => {
        const now = new Date();
        const s = new Date(start);
        const e = new Date(end);
        if (now < s) return { label: 'Agendado', color: 'bg-amber-100 text-amber-700' };
        if (now > e) return { label: 'Fechado', color: 'bg-slate-100 text-slate-500' };
        return { label: 'Ativo', color: 'bg-emerald-100 text-emerald-700' };
    };

    const handleViewDetails = (release: TestRelease) => {
        setIsLoadingDetails(true);
        setSelectedRelease(release);
        setDetailModalOpen(true);
        // Simula tempo de carregamento para UX mais suave
        setTimeout(() => {
            setIsLoadingDetails(false);
        }, 600);
    };

    // --- RESULT VIEWING LOGIC ---
    const handleViewResult = async (releaseId: string) => {
        setIsLoadingResult(true);
        setResultModalOpen(true);

        try {
            const resultHeader = results.find(r => r.test_release_id === releaseId);
            if (!resultHeader) throw new Error("Cabeçalho do resultado não encontrado");

            const [testData, answers] = await Promise.all([
                getTestDetails(resultHeader.test_id),
                getStudentAnswers(resultHeader.id)
            ]);

            if (!testData || !testData.questions) throw new Error("Dados da prova não encontrados");

            // Map answers to questions
            const hydratedQuestions = testData.questions.map((q, idx) => {
                const studentAnswer = answers.find(a => a.question_id === q.id);
                const correctOption = q.question_options?.find(o => o.is_correct);
                const selectedOption = q.question_options?.find(o => o.id === studentAnswer?.selected_option_id);

                return {
                    number: idx + 1,
                    content: q.content,
                    image: q.image_url,
                    selectedKey: selectedOption?.key || '-',
                    selectedContent: selectedOption?.content || 'Sem seleção',
                    isCorrect: studentAnswer?.is_correct,
                    correctKey: correctOption?.key,
                    correctContent: correctOption?.content
                };
            });

            setViewingResult({
                header: resultHeader,
                details: hydratedQuestions
            });

        } catch (e) {
            console.error(e);
            setViewingResult(null);
        } finally {
            setIsLoadingResult(false);
        }
    };

    if (!hasSupabase) return <div className="p-8 text-center text-slate-500">Configure o banco de dados primeiro.</div>;

    return (
        <div className="space-y-6">
            <div className="flex justify-between items-center">
                <div>
                    <h2 className="text-3xl font-bold text-slate-900">Atribuições de Prova</h2>
                    <p className="text-slate-500 mt-1">Agende provas para alunos específicos</p>
                </div>
                {view === 'list' && !loading && (hasInstitutionContext || !isAdmin) && (
                    <button onClick={() => setView('create')} className="bg-indigo-600 hover:bg-indigo-700 text-white px-5 py-2.5 rounded-xl font-bold flex items-center gap-2 shadow-lg shadow-indigo-200 transition-all">
                        <Plus size={20} /> Atribuir Prova
                    </button>
                )}
                {view === 'create' && (
                    <button onClick={() => setView('list')} className="text-slate-500 hover:text-indigo-600 font-bold flex items-center gap-2 transition-all">
                        <ArrowLeft size={20} /> Cancelar
                    </button>
                )}
            </div>

            <ConfirmationModal
                isOpen={modalConfig.isOpen}
                onClose={() => setModalConfig({ ...modalConfig, isOpen: false })}
                onConfirm={executeAction}
                title={modalConfig.action === 'restore' ? 'Restaurar Liberação' : 'Revogar Atribuição'}
                message={modalConfig.action === 'restore'
                    ? <span>Tem certeza de que deseja restaurar <strong>{modalConfig.name}</strong>? O aluno voltará a ter acesso a esta prova.</span>
                    : <span>Tem certeza de que deseja revogar <strong>{modalConfig.name}</strong>? O aluno não poderá mais acessar esta prova.</span>}
                confirmLabel={modalConfig.action === 'restore' ? 'Restaurar' : 'Revogar'}
                isDestructive={modalConfig.action === 'delete'}
                isLoading={isDeleting}
            />

            {error && (
                <div className="bg-red-50 border border-red-200 rounded-xl p-4 flex gap-3 text-red-700 items-center">
                    <AlertTriangle size={20} /> {error}
                </div>
            )}

            {/* Institution Filter for Admin Only (not loading, has multiple institutions) */}
            {!isManagerMode && !loading && isAdmin && view === 'list' && (
                <div className="bg-white dark:bg-slate-800 p-4 rounded-xl border border-slate-200 dark:border-slate-700 shadow-sm">
                    <div className="flex items-center justify-between gap-4">
                        <div className="flex-1">
                            <label className="block text-xs font-bold text-slate-500 dark:text-slate-400 uppercase mb-1">Contexto da Instituição</label>
                            <div className="relative">
                                <Building2 size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                                <select
                                    value={filterInst}
                                    onChange={e => {
                                        setFilterInst(e.target.value);
                                        setFormData(prev => ({ ...prev, institution_id: e.target.value, test_id: '', student_id: '', professor_id: '' }));
                                    }}
                                    className="w-full border border-slate-300 dark:border-slate-600 rounded-lg pl-10 pr-4 py-2 text-slate-900 dark:text-slate-100 bg-white dark:bg-slate-700 focus:ring-2 focus:ring-indigo-500 outline-none cursor-pointer"
                                >
                                    <option value="">Selecione a Instituição</option>
                                    {institutions.map(i => <option key={i.id} value={i.id}>{i.name}</option>)}
                                </select>
                            </div>
                        </div>
                        {isAdmin && filterInst && (
                            <label className="flex items-center gap-2 cursor-pointer text-sm text-slate-600 dark:text-slate-400 mt-5">
                                <input
                                    type="checkbox"
                                    checked={showDeleted}
                                    onChange={e => setShowDeleted(e.target.checked)}
                                    className="w-4 h-4 rounded text-indigo-600 focus:ring-indigo-500 border-gray-300 cursor-pointer"
                                />
                                Mostrar Excluídos
                            </label>
                        )}
                    </div>
                </div>
            )}

            {/* Show Deleted checkbox for Manager Mode */}
            {isManagerMode && view === 'list' && isAdmin && !loading && hasInstitutionContext && (
                <div className="bg-white dark:bg-slate-800 p-4 rounded-xl border border-slate-200 dark:border-slate-700 shadow-sm flex justify-end">
                    <label className="flex items-center gap-2 cursor-pointer text-sm text-slate-600 dark:text-slate-300">
                        <input
                            type="checkbox"
                            checked={showDeleted}
                            onChange={e => setShowDeleted(e.target.checked)}
                            className="w-4 h-4 rounded text-indigo-600 focus:ring-indigo-500 border-gray-300 dark:border-slate-600 cursor-pointer"
                        />
                        Mostrar Excluídos
                    </label>
                </div>
            )}

            {/* Loading State for non-Admin roles (Professor/Manager) waiting for institution context */}
            {loading && view === 'list' && (
                <div className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl p-12 text-center">
                    <Loader2 className="animate-spin text-indigo-600 mx-auto mb-4" size={48} />
                    <h3 className="text-lg font-bold text-slate-800 dark:text-slate-200 mb-2">Carregando...</h3>
                    <p className="text-slate-500 dark:text-slate-400 text-sm">Buscando dados das atribuições de prova.</p>
                </div>
            )}

            {/* No Institution Selected Message - Only for Admin after loading */}
            {!hasInstitutionContext && !loading && isAdmin && view === 'list' && (
                <div className="bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-xl p-8 text-center">
                    <Building2 size={48} className="mx-auto text-amber-400 dark:text-amber-500 mb-4" />
                    <h3 className="text-lg font-bold text-amber-800 dark:text-amber-300 mb-2">Nenhuma Instituição Selecionada</h3>
                    <p className="text-amber-600 dark:text-amber-400 text-sm">Selecione uma instituição acima para gerenciar as atribuições de prova.</p>
                </div>
            )}

            {view === 'list' && !loading && (hasInstitutionContext || !isAdmin) && (
                <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 shadow-sm overflow-hidden">
                    <table className="w-full text-left">
                        <thead className="bg-slate-50 dark:bg-slate-900 border-b border-slate-200 dark:border-slate-700">
                            <tr>
                                <th className="p-4 text-sm font-bold text-slate-600 dark:text-slate-400 uppercase tracking-wider">Prova & Turma</th>
                                <th className="p-4 text-sm font-bold text-slate-600 dark:text-slate-400 uppercase tracking-wider">Aluno</th>
                                <th className="p-4 text-sm font-bold text-slate-600 dark:text-slate-400 uppercase tracking-wider">Cronograma</th>
                                <th className="p-4 text-sm font-bold text-slate-600 dark:text-slate-400 uppercase tracking-wider">Status</th>
                                <th className="p-4 text-sm font-bold text-slate-600 dark:text-slate-400 uppercase tracking-wider text-right">Ações</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100 dark:divide-slate-700">
                            {loading ? (
                                <tr><td colSpan={5} className="p-12 text-center text-slate-400"><Loader2 className="animate-spin inline mr-2" /> Carregando dados...</td></tr>
                            ) : filteredReleases.length === 0 ? (
                                <tr><td colSpan={5} className="p-12 text-center text-slate-400">Nenhum agendamento encontrado.</td></tr>
                            ) : paginatedReleases.map(r => {
                                const status = getStatus(r.start_time, r.end_time);
                                const hasResult = results.some(res => res.test_release_id === r.id);
                                const isDeleted = r.deleted === true;

                                return (
                                    <tr key={r.id} className={`group ${isDeleted ? 'bg-red-50/50 dark:bg-red-900/20 opacity-60' : 'hover:bg-slate-50 dark:hover:bg-slate-700'}`}>
                                        <td className="p-4">
                                            <div className="flex items-center gap-2">
                                                <span className={`font-bold ${isDeleted ? 'text-slate-500 dark:text-slate-500 line-through' : 'text-slate-900 dark:text-slate-100'}`}>{r.tests?.title}</span>
                                                {isDeleted && (
                                                    <span className="px-2 py-0.5 text-xs font-bold rounded bg-red-100 text-red-600">Excluído</span>
                                                )}
                                                {!isDeleted && r.tests?.id && (
                                                    <button
                                                        onClick={() => {
                                                            setSelectedTestId(r.tests!.id);
                                                            setTestDetailModalOpen(true);
                                                        }}
                                                        className="p-1 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 rounded transition-all"
                                                        title="Ver detalhes da prova"
                                                    >
                                                        <Info size={14} />
                                                    </button>
                                                )}
                                            </div>
                                            <div className="text-xs text-slate-500">{r.tests?.school_grades?.name}</div>
                                        </td>
                                        <td className="p-4">
                                            <div className="flex items-center gap-2">
                                                <div className="w-6 h-6 rounded-full bg-slate-100 flex items-center justify-center text-slate-500">
                                                    <User size={12} />
                                                </div>
                                                <div className="flex-1">
                                                    <div className="flex items-center gap-2">
                                                        <div className={`text-sm font-medium ${isDeleted ? 'text-slate-500 dark:text-slate-400' : 'text-slate-800 dark:text-slate-200'}`}>{r.students?.name}</div>
                                                        {!isDeleted && r.students?.id && (
                                                            <button
                                                                onClick={() => {
                                                                    setSelectedStudentId(r.students!.id!);
                                                                    setStudentDetailModalOpen(true);
                                                                }}
                                                                className="p-1 text-slate-400 dark:text-slate-500 hover:text-indigo-600 dark:hover:text-indigo-400 hover:bg-indigo-50 dark:hover:bg-indigo-900/30 rounded transition-all"
                                                                title="Ver detalhes do aluno"
                                                            >
                                                                <Info size={14} />
                                                            </button>
                                                        )}
                                                    </div>
                                                    <div className="text-xs text-slate-400 dark:text-slate-500 font-mono">{(r.students as any)?.student_hash?.substring(0, 8)}...</div>
                                                </div>
                                            </div>
                                        </td>
                                        <td className="p-4">
                                            <div className="text-xs space-y-1">
                                                <div className="flex items-center gap-1.5 text-slate-600 dark:text-slate-400">
                                                    <Calendar size={12} className="text-emerald-500" />
                                                    {r.start_time ? (() => {
                                                        try {
                                                            const date = new Date(r.start_time);
                                                            if (isNaN(date.getTime())) return 'Data inválida';
                                                            return `${date.toLocaleDateString()} ${date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`;
                                                        } catch {
                                                            return 'Data inválida';
                                                        }
                                                    })() : 'Não definido'}
                                                </div>
                                                <div className="flex items-center gap-1.5 text-slate-600 dark:text-slate-400">
                                                    <Clock size={12} className="text-red-500" />
                                                    {r.end_time ? (() => {
                                                        try {
                                                            const date = new Date(r.end_time);
                                                            if (isNaN(date.getTime())) return 'Data inválida';
                                                            return `${date.toLocaleDateString()} ${date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`;
                                                        } catch {
                                                            return 'Data inválida';
                                                        }
                                                    })() : 'Não definido'}
                                                </div>
                                            </div>
                                        </td>
                                        <td className="p-4">
                                            {isDeleted ? (
                                                <span className="inline-flex px-2 py-1 rounded text-xs font-bold uppercase tracking-wider bg-red-100 dark:bg-red-900/30 text-red-600 dark:text-red-300">
                                                    Excluído
                                                </span>
                                            ) : hasResult ? (
                                                <span className="inline-flex items-center gap-1 px-2 py-1 rounded text-xs font-bold uppercase tracking-wider bg-indigo-100 dark:bg-indigo-900/30 text-indigo-700 dark:text-indigo-300">
                                                    <CheckCircle size={10} /> Concluído
                                                </span>
                                            ) : (
                                                <span className={`inline-flex px-2 py-1 rounded text-xs font-bold uppercase tracking-wider ${status.color}`}>
                                                    {status.label}
                                                </span>
                                            )}
                                        </td>
                                        <td className="p-4 text-right">
                                            <div className="flex justify-end gap-2">
                                                {isDeleted ? (
                                                    <button
                                                        onClick={() => openRestoreModal(r)}
                                                        className="p-2 text-emerald-600 dark:text-emerald-400 hover:bg-emerald-50 dark:hover:bg-emerald-900/30 rounded transition-all flex items-center gap-1"
                                                        title="Restaurar Liberação"
                                                    >
                                                        <RotateCcw size={18} />
                                                        <span className="text-sm">Restaurar</span>
                                                    </button>
                                                ) : (
                                                    <>
                                                        <button
                                                            onClick={() => handleViewDetails(r)}
                                                            className="p-2 text-slate-400 dark:text-slate-500 hover:text-indigo-600 dark:hover:text-indigo-400 hover:bg-indigo-50 dark:hover:bg-indigo-900/30 rounded transition-all"
                                                            title="Ver Resumo da Liberação"
                                                        >
                                                            <Eye size={18} />
                                                        </button>
                                                        {hasResult && (
                                                            <button
                                                                onClick={() => handleViewResult(r.id)}
                                                                className="p-2 text-indigo-600 dark:text-indigo-400 hover:bg-indigo-50 dark:hover:bg-indigo-900/30 rounded transition-all"
                                                                title="Ver Resultado"
                                                            >
                                                                <ClipboardCheck size={18} />
                                                            </button>
                                                        )}
                                                        <button
                                                            onClick={() => openDeleteModal(r)}
                                                            className="p-2 text-slate-400 dark:text-slate-500 hover:text-red-600 dark:hover:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/30 rounded transition-all opacity-0 group-hover:opacity-100"
                                                            title="Revogar Acesso"
                                                        >
                                                            <Trash2 size={18} />
                                                        </button>
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
            {view === 'list' && filteredReleases.length > 0 && (
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
                                    className="border border-slate-300 dark:border-slate-600 rounded-lg px-3 py-1.5 text-sm text-slate-900 dark:text-slate-100 bg-white dark:bg-slate-700 focus:ring-2 focus:ring-indigo-500 outline-none cursor-pointer"
                                >
                                    <option value={25}>25</option>
                                    <option value={50}>50</option>
                                    <option value={100}>100</option>
                                    <option value={200}>200</option>
                                </select>
                            </div>
                            <span className="text-sm text-slate-500">
                                Mostrando {startIndex + 1} - {Math.min(endIndex, filteredReleases.length)} de {filteredReleases.length} liberação{filteredReleases.length !== 1 ? 'ões' : ''}
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
                                    className="w-16 border border-slate-300 dark:border-slate-600 rounded-lg px-2 py-1.5 text-sm text-slate-900 dark:text-slate-100 bg-white dark:bg-slate-700 focus:ring-2 focus:ring-indigo-500 outline-none text-center"
                                />
                                <span className="text-xs text-slate-500">/ {totalPages}</span>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* RESULT MODAL */}
            {resultModalOpen && (
                <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4 animate-in fade-in duration-200">
                    <div className="bg-white dark:bg-slate-800 rounded-2xl w-full max-w-4xl shadow-2xl flex flex-col max-h-[90vh] overflow-hidden">
                        <div className="p-6 border-b border-slate-100 flex justify-between items-center bg-slate-50">
                            <h3 className="font-bold text-lg text-slate-800 flex items-center gap-2">
                                <ClipboardCheck size={20} className="text-indigo-600" /> Resultado da Prova
                            </h3>
                            <button onClick={() => { setResultModalOpen(false); setViewingResult(null); }} className="text-slate-400 hover:text-slate-600 transition-colors">
                                <X size={24} />
                            </button>
                        </div>

                        <div className="flex-1 overflow-y-auto p-6">
                            {isLoadingResult ? (
                                <div className="flex flex-col items-center justify-center h-64 text-slate-400">
                                    <Loader2 className="animate-spin mb-4" size={40} />
                                    <p>Carregando detalhes...</p>
                                </div>
                            ) : viewingResult ? (
                                <div className="space-y-6">
                                    {/* Header Info */}
                                    <div className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl p-6 shadow-sm flex flex-col md:flex-row justify-between items-center gap-6">
                                        <div>
                                            <h2 className="text-2xl font-bold text-slate-900 dark:text-slate-100">{viewingResult.header.student_name}</h2>
                                            <p className="text-slate-500 dark:text-slate-400 text-sm mt-1">{viewingResult.header.tests?.title}</p>
                                            <div className="flex items-center gap-2 mt-2 text-xs text-slate-400 dark:text-slate-500">
                                                <Calendar size={14} /> {new Date(viewingResult.header.correction_date).toLocaleString()}
                                            </div>
                                        </div>
                                        <div className="text-center bg-slate-50 px-6 py-4 rounded-xl border border-slate-100">
                                            <div className="text-xs text-slate-500 uppercase font-bold tracking-wider mb-1">Nota Final</div>
                                            <div className={`text-4xl font-black ${viewingResult.header.score >= 70 ? 'text-emerald-600' : 'text-red-600'}`}>
                                                {viewingResult.header.score}%
                                            </div>
                                        </div>
                                    </div>

                                    {/* Scanned Image Section */}
                                    {viewingResult.header.image_url && (
                                        <div className="bg-slate-50 p-4 rounded-xl border border-slate-200">
                                            <h4 className="font-bold text-slate-700 mb-3 flex items-center gap-2 text-sm">
                                                <ImageIcon size={16} /> Folha de Resposta Digitalizada
                                            </h4>
                                            <div className="rounded-lg overflow-hidden border border-slate-300 bg-slate-200 relative group max-h-[300px] flex items-center justify-center">
                                                <img
                                                    src={viewingResult.header.image_url}
                                                    alt="Folha de Resposta"
                                                    className="max-h-[300px] w-auto object-contain"
                                                />
                                                <a
                                                    href={viewingResult.header.image_url}
                                                    target="_blank"
                                                    rel="noreferrer"
                                                    className="absolute inset-0 flex items-center justify-center bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity text-white font-bold gap-2 backdrop-blur-sm"
                                                >
                                                    <ExternalLink size={20} /> Abrir Imagem Completa
                                                </a>
                                            </div>
                                        </div>
                                    )}

                                    {/* Questions List */}
                                    <div className="space-y-4">
                                        {viewingResult.details.map((q: any, idx: number) => (
                                            <div key={idx} className={`p-4 rounded-xl border ${q.isCorrect ? 'bg-emerald-50/30 border-emerald-100' : 'bg-red-50/30 border-red-100'}`}>
                                                <div className="flex gap-4">
                                                    <div className={`w-8 h-8 rounded-full flex items-center justify-center font-bold text-white shrink-0 text-sm ${q.isCorrect ? 'bg-emerald-500' : 'bg-red-500'}`}>
                                                        {q.number}
                                                    </div>
                                                    <div className="flex-1">
                                                        <p className="text-sm font-semibold text-slate-800 mb-2">{q.content}</p>
                                                        {q.image && <img src={q.image} className="max-h-40 rounded-lg border border-slate-200 mb-3 block" alt="Recurso da Questão" />}

                                                        <div className="flex flex-col gap-2 text-sm">
                                                            <div className={`flex items-center gap-2 ${q.isCorrect ? 'text-emerald-700' : 'text-red-700'}`}>
                                                                <span className="font-bold w-20">Selecionado:</span>
                                                                <span className="font-mono bg-white dark:bg-slate-800 px-2 py-0.5 rounded border border-current opacity-60">{q.selectedKey}</span>
                                                                <span>{q.selectedContent}</span>
                                                            </div>
                                                            {!q.isCorrect && (
                                                                <div className="flex items-center gap-2 text-slate-600">
                                                                    <span className="font-bold w-20">Correto:</span>
                                                                    <span className="font-mono bg-slate-100 px-2 py-0.5 rounded border border-slate-300">{q.correctKey}</span>
                                                                    <span>{q.correctContent}</span>
                                                                </div>
                                                            )}
                                                        </div>
                                                    </div>
                                                    <div className="shrink-0 pt-1">
                                                        {q.isCorrect ? <CheckCircle className="text-emerald-500" size={24} /> : <XCircle className="text-red-500" size={24} />}
                                                    </div>
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            ) : (
                                <div className="text-center py-12 text-slate-400">Falha ao carregar dados do resultado.</div>
                            )}
                        </div>
                    </div>
                </div>
            )}

            {/* RELEASE DETAIL MODAL - SUMMARY */}
            {detailModalOpen && selectedRelease && (
                <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4 animate-in fade-in duration-200">
                    <div className="bg-white dark:bg-slate-800 rounded-2xl w-full max-w-2xl shadow-2xl flex flex-col max-h-[90vh] overflow-hidden">
                        <div className="p-6 border-b border-slate-100 dark:border-slate-700 flex justify-between items-center bg-gradient-to-r from-indigo-50 to-slate-50 dark:from-indigo-900/20 dark:to-slate-800">
                            <h3 className="font-bold text-lg text-slate-800 dark:text-slate-100 flex items-center gap-2">
                                <Eye size={20} className="text-indigo-600 dark:text-indigo-400" /> Resumo da Atribuição
                            </h3>
                            <button onClick={() => { setDetailModalOpen(false); setSelectedRelease(null); setIsLoadingDetails(false); }} className="text-slate-400 dark:text-slate-500 hover:text-slate-600 dark:hover:text-slate-300 transition-colors">
                                <X size={24} />
                            </button>
                        </div>

                        <div className="flex-1 overflow-y-auto p-6 space-y-6">
                            {isLoadingDetails ? (
                                /* Skeleton Loading State */
                                <>
                                    {/* Test & Student Info Skeleton */}
                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                        <div className="bg-slate-50 dark:bg-slate-800 rounded-xl p-4 border border-slate-200 dark:border-slate-700 animate-pulse">
                                            <div className="flex items-center gap-1 mb-2">
                                                <div className="w-3 h-3 bg-slate-300 dark:bg-slate-600 rounded"></div>
                                                <div className="h-2 w-12 bg-slate-300 dark:bg-slate-600 rounded"></div>
                                            </div>
                                            <div className="h-5 w-3/4 bg-slate-300 dark:bg-slate-600 rounded mb-2"></div>
                                            <div className="h-3 w-1/2 bg-slate-200 dark:bg-slate-700 rounded"></div>
                                        </div>
                                        <div className="bg-slate-50 dark:bg-slate-800 rounded-xl p-4 border border-slate-200 dark:border-slate-700 animate-pulse">
                                            <div className="flex items-center gap-1 mb-2">
                                                <div className="w-3 h-3 bg-slate-300 dark:bg-slate-600 rounded"></div>
                                                <div className="h-2 w-12 bg-slate-300 dark:bg-slate-600 rounded"></div>
                                            </div>
                                            <div className="h-5 w-2/3 bg-slate-300 dark:bg-slate-600 rounded mb-2"></div>
                                            <div className="h-3 w-24 bg-slate-200 dark:bg-slate-700 rounded"></div>
                                        </div>
                                    </div>

                                    {/* Schedule Skeleton */}
                                    <div className="bg-white dark:bg-slate-800 rounded-xl p-4 border border-slate-200 dark:border-slate-700 shadow-sm animate-pulse">
                                        <div className="flex items-center gap-1 mb-3">
                                            <div className="w-3 h-3 bg-slate-300 rounded"></div>
                                            <div className="h-2 w-20 bg-slate-300 rounded"></div>
                                        </div>
                                        <div className="grid grid-cols-2 gap-4">
                                            <div className="flex items-center gap-3">
                                                <div className="w-10 h-10 rounded-full bg-slate-200"></div>
                                                <div>
                                                    <div className="h-2 w-12 bg-slate-200 rounded mb-2"></div>
                                                    <div className="h-4 w-32 bg-slate-300 rounded"></div>
                                                </div>
                                            </div>
                                            <div className="flex items-center gap-3">
                                                <div className="w-10 h-10 rounded-full bg-slate-200"></div>
                                                <div>
                                                    <div className="h-2 w-12 bg-slate-200 rounded mb-2"></div>
                                                    <div className="h-4 w-32 bg-slate-300 rounded"></div>
                                                </div>
                                            </div>
                                        </div>
                                    </div>

                                    {/* Configuration Skeleton */}
                                    <div className="bg-white dark:bg-slate-800 rounded-xl p-4 border border-slate-200 dark:border-slate-700 shadow-sm animate-pulse">
                                        <div className="h-2 w-24 bg-slate-300 dark:bg-slate-600 rounded mb-3"></div>
                                        <div className="grid grid-cols-3 gap-4">
                                            <div className="text-center p-3 bg-slate-50 dark:bg-slate-700 rounded-lg border border-slate-100 dark:border-slate-600">
                                                <div className="h-8 w-8 bg-slate-300 dark:bg-slate-600 rounded mx-auto mb-2"></div>
                                                <div className="h-2 w-16 bg-slate-200 dark:bg-slate-600 rounded mx-auto"></div>
                                            </div>
                                            <div className="text-center p-3 bg-slate-50 dark:bg-slate-700 rounded-lg border border-slate-100 dark:border-slate-600">
                                                <div className="w-6 h-6 bg-slate-300 dark:bg-slate-600 rounded-full mx-auto mb-2"></div>
                                                <div className="h-2 w-14 bg-slate-200 dark:bg-slate-600 rounded mx-auto"></div>
                                            </div>
                                            <div className="text-center p-3 bg-slate-50 dark:bg-slate-700 rounded-lg border border-slate-100 dark:border-slate-600">
                                                <div className="w-6 h-6 bg-slate-300 dark:bg-slate-600 rounded-full mx-auto mb-2"></div>
                                                <div className="h-2 w-14 bg-slate-200 dark:bg-slate-600 rounded mx-auto"></div>
                                            </div>
                                        </div>
                                    </div>

                                    {/* Professor Skeleton */}
                                    <div className="bg-slate-50 dark:bg-slate-800 rounded-xl p-4 border border-slate-200 dark:border-slate-700 flex items-center gap-3 animate-pulse">
                                        <div className="w-10 h-10 rounded-full bg-slate-200 dark:bg-slate-600"></div>
                                        <div>
                                            <div className="h-2 w-28 bg-slate-200 dark:bg-slate-600 rounded mb-2"></div>
                                            <div className="h-4 w-36 bg-slate-300 dark:bg-slate-600 rounded"></div>
                                        </div>
                                    </div>

                                    {/* Status Skeleton */}
                                    <div className="flex justify-center animate-pulse">
                                        <div className="h-8 w-32 bg-slate-200 rounded-full"></div>
                                    </div>
                                </>
                            ) : (
                                /* Loaded Content */
                                <>
                                    {/* Test & Student Info */}
                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                        <div className="bg-slate-50 dark:bg-slate-800 rounded-xl p-4 border border-slate-200 dark:border-slate-700 transition-all duration-300 animate-in fade-in slide-in-from-bottom-2">
                                            <div className="text-xs text-slate-500 dark:text-slate-400 uppercase font-bold tracking-wider mb-2 flex items-center gap-1">
                                                <BookOpen size={12} /> Prova
                                            </div>
                                            <div className="text-lg font-bold text-slate-900 dark:text-slate-100">{selectedRelease.tests?.title}</div>
                                            <div className="text-sm text-slate-500 dark:text-slate-400 mt-1">{selectedRelease.tests?.school_grades?.name}</div>
                                        </div>
                                        <div className="bg-slate-50 dark:bg-slate-800 rounded-xl p-4 border border-slate-200 dark:border-slate-700 transition-all duration-300 animate-in fade-in slide-in-from-bottom-2" style={{ animationDelay: '50ms' }}>
                                            <div className="text-xs text-slate-500 dark:text-slate-400 uppercase font-bold tracking-wider mb-2 flex items-center gap-1">
                                                <User size={12} /> Aluno
                                            </div>
                                            <div className="text-lg font-bold text-slate-900 dark:text-slate-100">{selectedRelease.students?.name}</div>
                                            <div className="space-y-1 mt-2">
                                                {(selectedRelease.students as any)?.classes?.name && (
                                                    <div className="text-sm text-slate-600 dark:text-slate-300">
                                                        <span className="font-semibold">Turma:</span> {(selectedRelease.students as any).classes.name}
                                                    </div>
                                                )}
                                                {((selectedRelease.students as any)?.school_grades?.name || (selectedRelease.students as any)?.grade_level) && (
                                                    <div className="text-sm text-slate-600 dark:text-slate-300">
                                                        <span className="font-semibold">Ano/Série:</span> {(selectedRelease.students as any)?.school_grades?.name || (selectedRelease.students as any)?.grade_level}
                                                    </div>
                                                )}
                                                {(selectedRelease.students as any)?.student_hash && (
                                                    <div className="text-sm text-slate-400 dark:text-slate-500 font-mono mt-1">
                                                        {((selectedRelease.students as any).student_hash || '').substring(0, 12)}...
                                                    </div>
                                                )}
                                            </div>
                                        </div>
                                    </div>

                                    {/* Schedule */}
                                    <div className="bg-white dark:bg-slate-800 rounded-xl p-4 border border-slate-200 dark:border-slate-700 shadow-sm transition-all duration-300 animate-in fade-in slide-in-from-bottom-2" style={{ animationDelay: '100ms' }}>
                                        <div className="text-xs text-slate-500 dark:text-slate-400 uppercase font-bold tracking-wider mb-3 flex items-center gap-1">
                                            <Clock size={12} /> Cronograma
                                        </div>
                                        <div className="grid grid-cols-2 gap-4">
                                            <div className="flex items-center gap-3">
                                                <div className="w-10 h-10 rounded-full bg-emerald-100 dark:bg-emerald-900/30 flex items-center justify-center">
                                                    <Calendar size={18} className="text-emerald-600 dark:text-emerald-400" />
                                                </div>
                                                <div>
                                                    <div className="text-xs text-slate-500 dark:text-slate-400">Início</div>
                                                    <div className="font-semibold text-slate-800 dark:text-slate-100">
                                                        {new Date(selectedRelease.start_time).toLocaleDateString()} às {new Date(selectedRelease.start_time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                                    </div>
                                                </div>
                                            </div>
                                            <div className="flex items-center gap-3">
                                                <div className="w-10 h-10 rounded-full bg-red-100 dark:bg-red-900/30 flex items-center justify-center">
                                                    <Clock size={18} className="text-red-600 dark:text-red-400" />
                                                </div>
                                                <div>
                                                    <div className="text-xs text-slate-500 dark:text-slate-400">Término</div>
                                                    <div className="font-semibold text-slate-800 dark:text-slate-100">
                                                        {selectedRelease.end_time ? (() => {
                                                            try {
                                                                const date = new Date(selectedRelease.end_time);
                                                                if (isNaN(date.getTime())) return 'Data inválida';
                                                                return `${date.toLocaleDateString()} às ${date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`;
                                                            } catch {
                                                                return 'Data inválida';
                                                            }
                                                        })() : 'Não definido'}
                                                    </div>
                                                </div>
                                            </div>
                                        </div>
                                    </div>

                                    {/* Configuration Summary */}
                                    <div className="bg-white dark:bg-slate-800 rounded-xl p-4 border border-slate-200 dark:border-slate-700 shadow-sm transition-all duration-300 animate-in fade-in slide-in-from-bottom-2" style={{ animationDelay: '150ms' }}>
                                        <div className="text-xs text-slate-500 dark:text-slate-400 uppercase font-bold tracking-wider mb-3">
                                            Configurações
                                        </div>
                                        <div className="grid grid-cols-3 gap-4">
                                            <div className="text-center p-3 bg-slate-50 dark:bg-slate-700 rounded-lg border border-slate-100 dark:border-slate-600">
                                                <div className="text-2xl font-black text-indigo-600 dark:text-indigo-400">{selectedRelease.max_attempts}</div>
                                                <div className="text-xs text-slate-500 dark:text-slate-400 mt-1">Tentativas</div>
                                            </div>
                                            <div className={`text-center p-3 rounded-lg border ${selectedRelease.allow_consultation ? 'bg-emerald-50 dark:bg-emerald-900/30 border-emerald-200 dark:border-emerald-700' : 'bg-slate-50 dark:bg-slate-700 border-slate-100 dark:border-slate-600'}`}>
                                                <div className="flex justify-center mb-1">
                                                    {selectedRelease.allow_consultation ? (
                                                        <CheckCircle size={24} className="text-emerald-500 dark:text-emerald-400" />
                                                    ) : (
                                                        <XCircle size={24} className="text-slate-300 dark:text-slate-600" />
                                                    )}
                                                </div>
                                                <div className="text-xs text-slate-600 dark:text-slate-300">Consulta</div>
                                            </div>
                                            <div className={`text-center p-3 rounded-lg border ${selectedRelease.allow_ai_agent ? 'bg-purple-50 dark:bg-purple-900/30 border-purple-200 dark:border-purple-700' : 'bg-slate-50 dark:bg-slate-700 border-slate-100 dark:border-slate-600'}`}>
                                                <div className="flex justify-center mb-1">
                                                    {selectedRelease.allow_ai_agent ? (
                                                        <Bot size={24} className="text-purple-500 dark:text-purple-400" />
                                                    ) : (
                                                        <XCircle size={24} className="text-slate-300 dark:text-slate-600" />
                                                    )}
                                                </div>
                                                <div className="text-xs text-slate-600 dark:text-slate-300">Agente IA</div>
                                            </div>
                                        </div>
                                    </div>

                                    {/* Allowed Sites */}
                                    {selectedRelease.allowed_sites && selectedRelease.allowed_sites.length > 0 && (
                                        <div className="bg-white dark:bg-slate-800 rounded-xl p-4 border border-slate-200 dark:border-slate-700 shadow-sm transition-all duration-300 animate-in fade-in slide-in-from-bottom-2" style={{ animationDelay: '200ms' }}>
                                            <div className="text-xs text-slate-500 dark:text-slate-400 uppercase font-bold tracking-wider mb-3 flex items-center gap-1">
                                                <Globe2 size={12} /> Sites Permitidos para Consulta
                                            </div>
                                            <div className="space-y-2">
                                                {(selectedRelease.allowed_sites || []).map((site, idx) => (
                                                    <a
                                                        key={site.id || idx}
                                                        href={site.url}
                                                        target="_blank"
                                                        rel="noreferrer"
                                                        className="flex items-center gap-3 p-3 bg-slate-50 dark:bg-slate-700 rounded-lg border border-slate-200 dark:border-slate-600 hover:border-indigo-300 dark:hover:border-indigo-500 hover:bg-indigo-50 dark:hover:bg-indigo-900/30 transition-all group"
                                                    >
                                                        <Link size={14} className="text-slate-400 dark:text-slate-500 group-hover:text-indigo-500 dark:group-hover:text-indigo-400" />
                                                        <div className="flex-1 min-w-0">
                                                            <div className="font-medium text-slate-800 dark:text-slate-100 truncate">{site.title || 'Site Permitido'}</div>
                                                            <div className="text-xs text-slate-400 dark:text-slate-500 truncate">{site.url}</div>
                                                        </div>
                                                        <ExternalLink size={14} className="text-slate-300 dark:text-slate-600 group-hover:text-indigo-500 dark:group-hover:text-indigo-400" />
                                                    </a>
                                                ))}
                                            </div>
                                        </div>
                                    )}

                                    {/* Professor Info */}
                                    {selectedRelease.professors && (
                                        <div className="bg-slate-50 dark:bg-slate-800 rounded-xl p-4 border border-slate-200 dark:border-slate-700 flex items-center justify-between transition-all duration-300 animate-in fade-in slide-in-from-bottom-2" style={{ animationDelay: '250ms' }}>
                                            <div className="flex items-center gap-3">
                                                <div className="w-10 h-10 rounded-full bg-indigo-100 dark:bg-indigo-900/30 flex items-center justify-center">
                                                    <User size={18} className="text-indigo-600 dark:text-indigo-400" />
                                                </div>
                                                <div>
                                                    <div className="text-xs text-slate-500 dark:text-slate-400">Professor Responsável</div>
                                                    <div className="font-semibold text-slate-800 dark:text-slate-100">{selectedRelease.professors.name}</div>
                                                </div>
                                            </div>
                                            {selectedRelease.professor_id && (
                                                <button
                                                    onClick={() => {
                                                        setSelectedProfessorId(selectedRelease.professor_id || null);
                                                        setProfessorDetailModalOpen(true);
                                                        setDetailModalOpen(false);
                                                    }}
                                                    className="px-3 py-1.5 text-xs font-semibold text-indigo-600 dark:text-indigo-400 hover:text-indigo-700 dark:hover:text-indigo-300 hover:bg-indigo-50 dark:hover:bg-indigo-900/30 rounded-lg transition-all flex items-center gap-1"
                                                    title="Ver detalhes do professor"
                                                >
                                                    <Info size={14} /> Detalhes
                                                </button>
                                            )}
                                        </div>
                                    )}

                                    {/* Status Badge */}
                                    <div className="flex justify-center transition-all duration-300 animate-in fade-in slide-in-from-bottom-2" style={{ animationDelay: '300ms' }}>
                                        {(() => {
                                            const hasResult = results.some(res => res.test_release_id === selectedRelease.id);
                                            if (hasResult) {
                                                return (
                                                    <span className="inline-flex items-center gap-2 px-4 py-2 rounded-full text-sm font-bold uppercase tracking-wider bg-indigo-100 text-indigo-700">
                                                        <CheckCircle size={16} /> Prova Realizada
                                                    </span>
                                                );
                                            }
                                            const status = getStatus(selectedRelease.start_time, selectedRelease.end_time);
                                            return (
                                                <span className={`inline-flex items-center gap-2 px-4 py-2 rounded-full text-sm font-bold uppercase tracking-wider ${status.color}`}>
                                                    {status.label}
                                                </span>
                                            );
                                        })()}
                                    </div>
                                </>
                            )}
                        </div>
                    </div>
                </div>
            )}

            {/* Existing Create View Code */}
            {view === 'create' && (
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                    {/* Left Column: Form */}
                    <form onSubmit={handleSubmit} className="space-y-6">
                        <div className="bg-white dark:bg-slate-800 p-6 rounded-xl border border-slate-200 dark:border-slate-700 shadow-sm space-y-4">
                            <h3 className="font-bold text-slate-800 border-b border-slate-100 pb-2">1. Detalhes da Atribuição</h3>

                            <div>
                                <div className="flex items-center justify-between mb-2">
                                    <label className="block text-sm font-bold text-slate-700">Selecionar Prova</label>
                                    {formData.test_id && (
                                        <button
                                            type="button"
                                            onClick={() => {
                                                setSelectedTestId(formData.test_id || null);
                                                setTestDetailModalOpen(true);
                                            }}
                                            className="text-xs text-indigo-600 hover:text-indigo-700 font-semibold flex items-center gap-1"
                                        >
                                            <Info size={14} /> Ver Detalhes
                                        </button>
                                    )}
                                </div>
                                <select
                                    value={formData.test_id}
                                    onChange={e => setFormData({ ...formData, test_id: e.target.value })}
                                    className="w-full border border-slate-300 dark:border-slate-600 rounded-lg px-4 py-2.5 text-slate-900 dark:text-slate-100 bg-white dark:bg-slate-700 focus:ring-2 focus:ring-indigo-500 outline-none shadow-sm"
                                >
                                    <option value="">-- Escolha a Prova --</option>
                                    {filteredTests.map(t => (
                                        <option key={t.id} value={t.id}>{t.title}</option>
                                    ))}
                                </select>
                            </div>

                            <div>
                                <div className="flex items-center justify-between mb-2">
                                    <label className="block text-sm font-bold text-slate-700">Selecionar Professor</label>
                                    {formData.professor_id && (
                                        <button
                                            type="button"
                                            onClick={() => {
                                                setSelectedProfessorId(formData.professor_id || null);
                                                setProfessorDetailModalOpen(true);
                                            }}
                                            className="text-xs text-indigo-600 hover:text-indigo-700 font-semibold flex items-center gap-1"
                                        >
                                            <Info size={14} /> Ver Detalhes
                                        </button>
                                    )}
                                </div>
                                <select
                                    value={formData.professor_id}
                                    onChange={e => setFormData({ ...formData, professor_id: e.target.value })}
                                    className="w-full border border-slate-300 dark:border-slate-600 rounded-lg px-4 py-2.5 text-slate-900 dark:text-slate-100 bg-white dark:bg-slate-700 focus:ring-2 focus:ring-indigo-500 outline-none shadow-sm"
                                >
                                    <option value="">-- Escolha o Professor --</option>
                                    {professors.filter(p => !p.deleted).map(p => (
                                        <option key={p.id} value={p.id}>
                                            {p.name} {p.department ? `(${p.department})` : ''}
                                        </option>
                                    ))}
                                </select>
                                <p className="text-xs text-slate-500 mt-1">O professor será preenchido automaticamente se você selecionar uma prova, mas pode ser alterado manualmente.</p>
                            </div>

                            <div>
                                <div className="flex items-center justify-between mb-2">
                                    <label className="block text-sm font-bold text-slate-700 dark:text-slate-200">Selecionar Aluno</label>
                                    {formData.student_id && (
                                        <button
                                            type="button"
                                            onClick={() => {
                                                setSelectedStudentId(formData.student_id || null);
                                                setStudentDetailModalOpen(true);
                                            }}
                                            className="text-xs text-indigo-600 dark:text-indigo-400 hover:text-indigo-700 dark:hover:text-indigo-300 font-semibold flex items-center gap-1"
                                        >
                                            <Info size={14} /> Ver Detalhes
                                        </button>
                                    )}
                                </div>
                                <select
                                    value={formData.student_id}
                                    onChange={e => setFormData({ ...formData, student_id: e.target.value })}
                                    className="w-full border border-slate-300 dark:border-slate-600 rounded-lg px-4 py-2.5 text-slate-900 dark:text-slate-100 bg-white dark:bg-slate-700 focus:ring-2 focus:ring-indigo-500 outline-none shadow-sm"
                                >
                                    <option value="">-- Escolha o Aluno --</option>
                                    {filteredStudents.map(s => (
                                        <option key={s.id} value={s.id}>{s.name} ({s.school_grades?.name})</option>
                                    ))}
                                </select>
                            </div>

                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-sm font-bold text-slate-700 mb-2">Início</label>
                                    <input
                                        type="datetime-local"
                                        required
                                        value={formData.start_time}
                                        onChange={e => setFormData({ ...formData, start_time: e.target.value })}
                                        className="w-full border border-slate-300 dark:border-slate-600 rounded-lg px-3 py-2 text-sm outline-none bg-white dark:bg-slate-700 text-slate-900 dark:text-slate-100"
                                    />
                                </div>
                                <div>
                                    <label className="block text-sm font-bold text-slate-700 mb-2">Fim</label>
                                    <input
                                        type="datetime-local"
                                        required
                                        value={formData.end_time}
                                        onChange={e => setFormData({ ...formData, end_time: e.target.value })}
                                        className="w-full border border-slate-300 dark:border-slate-600 rounded-lg px-3 py-2 text-sm outline-none bg-white dark:bg-slate-700 text-slate-900 dark:text-slate-100"
                                    />
                                </div>
                            </div>

                            <div className="flex gap-4 items-center bg-slate-50 p-3 rounded-lg border border-slate-200">
                                <div>
                                    <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Máx. Tentativas</label>
                                    <input
                                        type="number"
                                        min="1"
                                        max="10"
                                        value={formData.max_attempts}
                                        onChange={e => setFormData({ ...formData, max_attempts: parseInt(e.target.value) })}
                                        className="w-20 border border-slate-300 dark:border-slate-600 rounded px-2 py-1 text-sm bg-white dark:bg-slate-700 text-slate-900 dark:text-slate-100"
                                    />
                                </div>
                                <div className="h-8 w-px bg-slate-200 mx-2"></div>
                                <div className="flex items-center gap-2">
                                    <input
                                        type="checkbox"
                                        id="consult"
                                        checked={formData.allow_consultation}
                                        onChange={e => setFormData({ ...formData, allow_consultation: e.target.checked })}
                                        className="w-4 h-4 rounded text-indigo-600 focus:ring-indigo-500 border-gray-300 cursor-pointer"
                                    />
                                    <label htmlFor="consult" className="text-sm font-medium text-slate-700 cursor-pointer">Permitir Consulta</label>
                                </div>
                                <div className="flex items-center gap-2 ml-4">
                                    <input
                                        type="checkbox"
                                        id="ai_agent"
                                        checked={formData.allow_ai_agent}
                                        onChange={e => setFormData({ ...formData, allow_ai_agent: e.target.checked })}
                                        className="w-4 h-4 rounded text-indigo-600 focus:ring-indigo-500 border-gray-300 cursor-pointer"
                                    />
                                    <label htmlFor="ai_agent" className="text-sm font-medium text-slate-700 cursor-pointer flex items-center gap-1"><Bot size={14} /> Permitir IA</label>
                                </div>
                            </div>
                        </div>

                        <button
                            type="submit"
                            disabled={isCreating}
                            className="w-full bg-indigo-600 hover:bg-indigo-700 text-white py-3 rounded-xl font-bold flex justify-center gap-2 shadow-lg shadow-indigo-200 transition-all disabled:opacity-70 disabled:cursor-not-allowed"
                        >
                            {isCreating ? <Loader2 className="animate-spin" size={20} /> : <Save size={20} />} Criar Atribuição
                        </button>
                    </form>

                    {/* Right Column: Map & Sites */}
                    <div className="space-y-6">
                        {/* Allowed Sites Section */}
                        {formData.allow_consultation && (
                            <div className="bg-white dark:bg-slate-800 p-4 rounded-xl border border-slate-200 dark:border-slate-700 shadow-sm">
                                <h4 className="text-sm font-bold text-slate-700 mb-3 flex items-center gap-2"><Globe2 size={16} /> Sites Permitidos para Consulta</h4>
                                <div className="flex gap-2 mb-3">
                                    <input
                                        placeholder="URL (ex: https://wikipedia.org)"
                                        className="flex-1 text-sm border border-slate-300 dark:border-slate-600 rounded-lg px-3 py-2 outline-none focus:ring-2 focus:ring-indigo-500 bg-white dark:bg-slate-700 text-slate-900 dark:text-slate-100"
                                        value={siteInput.url}
                                        onChange={e => setSiteInput({ ...siteInput, url: e.target.value })}
                                    />
                                    <input
                                        placeholder="Título"
                                        className="w-1/3 text-sm border border-slate-300 dark:border-slate-600 rounded-lg px-3 py-2 outline-none focus:ring-2 focus:ring-indigo-500 bg-white dark:bg-slate-700 text-slate-900 dark:text-slate-100"
                                        value={siteInput.title}
                                        onChange={e => setSiteInput({ ...siteInput, title: e.target.value })}
                                    />
                                    <button type="button" onClick={handleAddSite} className="bg-indigo-600 text-white px-4 py-2 rounded-lg text-sm font-bold hover:bg-indigo-700 transition-colors">Adicionar</button>
                                </div>
                                <div className="space-y-2">
                                    {newSites.map((site, i) => (
                                        <div key={i} className="flex justify-between items-center bg-slate-50 p-3 rounded-lg border border-slate-100 text-sm">
                                            <div className="flex items-center gap-2 overflow-hidden">
                                                <Link size={14} className="text-indigo-400 shrink-0" />
                                                <span className="font-medium truncate">{site.title}</span>
                                                <span className="text-slate-400 text-xs truncate">({site.url})</span>
                                            </div>
                                            <button type="button" onClick={() => handleRemoveSite(i)} className="text-slate-400 hover:text-red-500 transition-colors"><XCircle size={16} /></button>
                                        </div>
                                    ))}
                                    {newSites.length === 0 && <p className="text-sm text-slate-400 italic text-center py-2">Nenhum site adicionado ainda.</p>}
                                </div>
                            </div>
                        )}

                        {/* Mapa de Cerca Geográfica */}
                        <div className="border border-slate-200 dark:border-slate-700 rounded-xl overflow-hidden shadow-sm relative bg-white dark:bg-slate-800">
                            {/* CSS Animation for pulse effect */}
                            <style>{`
                              @keyframes pulse {
                                  0% { transform: scale(1); opacity: 1; }
                                  100% { transform: scale(3); opacity: 0; }
                              }
                          `}</style>
                            <div className="bg-slate-50 p-3 border-b border-slate-200 flex justify-between items-center">
                                <h4 className="font-bold text-sm text-slate-700 flex items-center gap-2"><MapIcon size={16} /> Cerca Geográfica (Polígono)</h4>
                                <div className="flex items-center gap-3">
                                    {/* User Location Indicator */}
                                    {userLocation ? (
                                        <span className="text-xs font-medium text-blue-600 bg-blue-50 px-2 py-1 rounded flex items-center gap-1">
                                            <span className="w-2 h-2 bg-blue-500 rounded-full animate-pulse"></span>
                                            GPS Ativo
                                        </span>
                                    ) : (
                                        <span className="text-xs font-medium text-slate-400 bg-slate-100 px-2 py-1 rounded flex items-center gap-1">
                                            <MapPin size={10} /> Localizando...
                                        </span>
                                    )}
                                    {(formData.location_polygon?.length || 0) > 0 && (
                                        <span className="text-xs font-bold text-indigo-600 bg-indigo-50 px-2 py-1 rounded">
                                            {formData.location_polygon?.length} Pontos
                                        </span>
                                    )}
                                    <button onClick={clearMap} type="button" className="text-xs text-red-600 hover:text-red-800 font-bold flex items-center gap-1 transition-colors">
                                        <Eraser size={12} /> Limpar
                                    </button>
                                </div>
                            </div>
                            <div ref={mapRef} className="h-80 w-full bg-slate-100 relative z-0"></div>
                            {(formData.location_polygon?.length || 0) === 0 && (
                                <div className="absolute inset-0 top-12 flex flex-col items-center justify-center pointer-events-none bg-slate-50/50">
                                    <Globe size={40} className="text-slate-300 mb-2" />
                                    <p className="text-sm text-slate-400 font-medium">Clique no mapa para definir a área permitida</p>
                                    <p className="text-xs text-slate-300 mt-1">Opcional: Limite onde o aluno pode realizar a prova</p>
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            )}

            {/* Test Detail Modal */}
            {testDetailModalOpen && selectedTestId && (
                <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4 animate-in fade-in duration-200">
                    <div className="bg-white dark:bg-slate-800 rounded-2xl w-full max-w-6xl shadow-2xl flex flex-col max-h-[90vh] overflow-hidden">
                        <div className="p-6 border-b border-slate-100 flex justify-between items-center bg-slate-50">
                            <h3 className="font-bold text-lg text-slate-800 flex items-center gap-2">
                                <BookOpen size={20} className="text-indigo-600" /> Detalhes da Prova
                            </h3>
                            <button
                                onClick={() => {
                                    setTestDetailModalOpen(false);
                                    setSelectedTestId(null);
                                }}
                                className="text-slate-400 hover:text-slate-600 transition-colors"
                            >
                                <X size={24} />
                            </button>
                        </div>
                        <div className="flex-1 overflow-y-auto p-6">
                            <TestManager
                                hasSupabase={hasSupabase}
                                institutionId={effectiveInstId || undefined}
                                initialTestId={selectedTestId}
                                onBack={() => {
                                    setTestDetailModalOpen(false);
                                    setSelectedTestId(null);
                                }}
                            />
                        </div>
                    </div>
                </div>
            )}

            {/* Professor Detail Modal */}
            {professorDetailModalOpen && selectedProfessorId && (
                <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4 animate-in fade-in duration-200">
                    <div className="bg-white dark:bg-slate-800 rounded-2xl w-full max-w-6xl shadow-2xl flex flex-col max-h-[90vh] overflow-hidden">
                        <div className="p-6 border-b border-slate-100 flex justify-between items-center bg-slate-50">
                            <h3 className="font-bold text-lg text-slate-800 flex items-center gap-2">
                                <User size={20} className="text-indigo-600" /> Detalhes do Professor
                            </h3>
                            <button
                                onClick={() => {
                                    setProfessorDetailModalOpen(false);
                                    setSelectedProfessorId(null);
                                }}
                                className="text-slate-400 hover:text-slate-600 transition-colors"
                            >
                                <X size={24} />
                            </button>
                        </div>
                        <div className="flex-1 overflow-y-auto p-6">
                            <ProfessorDetails
                                professorId={selectedProfessorId}
                                hasSupabase={hasSupabase}
                                onBack={() => {
                                    setProfessorDetailModalOpen(false);
                                    setSelectedProfessorId(null);
                                }}
                            />
                        </div>
                    </div>
                </div>
            )}

            {/* Student Detail Modal */}
            {studentDetailModalOpen && selectedStudentId && (
                <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4 animate-in fade-in duration-200">
                    <div className="bg-white dark:bg-slate-800 rounded-2xl w-full max-w-6xl shadow-2xl flex flex-col max-h-[90vh] overflow-hidden">
                        <div className="p-6 border-b border-slate-100 dark:border-slate-700 flex justify-between items-center bg-slate-50 dark:bg-slate-900">
                            <h3 className="font-bold text-lg text-slate-800 dark:text-slate-100 flex items-center gap-2">
                                <User size={20} className="text-indigo-600 dark:text-indigo-400" /> Detalhes do Aluno
                            </h3>
                            <button
                                onClick={() => {
                                    setStudentDetailModalOpen(false);
                                    setSelectedStudentId(null);
                                }}
                                className="text-slate-400 hover:text-slate-600 transition-colors"
                            >
                                <X size={24} />
                            </button>
                        </div>
                        <div className="flex-1 overflow-y-auto p-6">
                            <StudentManager
                                hasSupabase={hasSupabase}
                                institutionId={effectiveInstId || undefined}
                                initialStudentId={selectedStudentId}
                                readOnly={true}
                                onBack={() => {
                                    setStudentDetailModalOpen(false);
                                    setSelectedStudentId(null);
                                }}
                            />
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default TestReleaseManager;
