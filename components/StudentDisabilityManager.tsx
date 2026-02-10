
import React, { useState, useRef } from 'react';
import { useStudentDisabilityManager } from '../presentation/hooks/useStudentDisabilityManager';
import { StudentDisability, DisabilityType } from '../types';
import {
    AlertCircle, Plus, Trash2, Loader2, Edit2, Save, X, FileText, Eye, Download
} from 'lucide-react';
import ConfirmationModal from './ConfirmationModal';
import { getFriendlyErrorMessage } from '../utils/errorHandling';

interface StudentDisabilityManagerProps {
    hasSupabase: boolean;
    institutionId?: string;
    studentId?: string;
    studentName?: string;
}

const DISABILITY_TYPES: { value: DisabilityType; label: string }[] = [
    { value: 'AUDITIVA', label: 'Auditiva' },
    { value: 'FISICA', label: 'Física' },
    { value: 'INTELECTUAL', label: 'Intelectual' },
    { value: 'VISUAL', label: 'Visual' },
    { value: 'MULTIPLA', label: 'Múltipla' },
    { value: 'TEA', label: 'TEA (Transtorno do Espectro Autista)' },
    { value: 'OUTRA', label: 'Outra' }
];

const StudentDisabilityManager: React.FC<StudentDisabilityManagerProps> = ({
    hasSupabase,
    institutionId,
    studentId,
    studentName
}) => {
    const {
        disabilities,
        loading,
        error,
        canEdit,
        canView,
        addDisability,
        updateDisability,
        deleteDisability,
        refresh
    } = useStudentDisabilityManager(hasSupabase, institutionId, studentId);

    const [showForm, setShowForm] = useState(false);
    const [editingId, setEditingId] = useState<string | null>(null);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [deleteModal, setDeleteModal] = useState<{ isOpen: boolean; id: string; description: string }>({
        isOpen: false,
        id: '',
        description: ''
    });

    const [formData, setFormData] = useState<Partial<StudentDisability>>({
        disability_type: 'AUDITIVA',
        description: '',
        additional_info: '',
        support_number: '',
        responsible_name: ''
    });

    const [documentFile, setDocumentFile] = useState<File | null>(null);
    const fileInputRef = useRef<HTMLInputElement>(null);

    const resetForm = () => {
        setFormData({
            disability_type: 'AUDITIVA',
            description: '',
            additional_info: '',
            support_number: '',
            responsible_name: ''
        });
        setDocumentFile(null);
        setEditingId(null);
        setShowForm(false);
        if (fileInputRef.current) {
            fileInputRef.current.value = '';
        }
    };

    const handleEdit = (disability: StudentDisability) => {
        setEditingId(disability.id);
        setFormData({
            disability_type: disability.disability_type,
            description: disability.description,
            additional_info: disability.additional_info || '',
            support_number: disability.support_number || '',
            responsible_name: disability.responsible_name || ''
        });
        setDocumentFile(null);
        setShowForm(true);
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!canEdit) {
            alert('Você não tem permissão para cadastrar deficiências.');
            return;
        }

        if (!formData.description || !formData.description.trim()) {
            alert('Por favor, preencha a descrição do problema.');
            return;
        }

        if (!studentId || !institutionId) {
            alert('Estudante ou instituição não identificados.');
            return;
        }

        setIsSubmitting(true);
        try {
            const disabilityData: Partial<StudentDisability> = {
                student_id: studentId,
                institution_id: institutionId,
                disability_type: formData.disability_type,
                description: formData.description.trim(),
                additional_info: formData.additional_info?.trim() || null,
                support_number: formData.support_number?.trim() || null,
                responsible_name: formData.responsible_name?.trim() || null
            };

            if (editingId) {
                await updateDisability(editingId, disabilityData, documentFile || undefined);
            } else {
                await addDisability(disabilityData, documentFile || undefined);
            }

            resetForm();
        } catch (err: any) {
            alert(getFriendlyErrorMessage(err));
        } finally {
            setIsSubmitting(false);
        }
    };

    const handleDelete = async () => {
        setIsSubmitting(true);
        try {
            await deleteDisability(deleteModal.id);
            setDeleteModal({ isOpen: false, id: '', description: '' });
        } catch (err: any) {
            alert(getFriendlyErrorMessage(err));
        } finally {
            setIsSubmitting(false);
        }
    };

    if (!hasSupabase) {
        return <div className="p-8 text-center text-slate-500 dark:text-slate-400">Configure o banco de dados primeiro.</div>;
    }

    if (!canView) {
        return <div className="p-8 text-center text-slate-500 dark:text-slate-400">Você não tem permissão para visualizar deficiências.</div>;
    }

    return (
        <div className="space-y-6 p-6">
            <div className="flex justify-between items-center">
                <div>
                    <h3 className="text-xl font-bold text-slate-900 dark:text-slate-100 flex items-center gap-2">
                        <AlertCircle size={24} className="text-indigo-600 dark:text-indigo-400" />
                        Deficiências e Necessidades Especiais
                    </h3>
                    {studentName && (
                        <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
                            Estudante: {studentName}
                        </p>
                    )}
                </div>
                {canEdit && (
                    <button
                        onClick={() => {
                            resetForm();
                            setShowForm(true);
                        }}
                        className="bg-indigo-600 dark:bg-indigo-500 hover:bg-indigo-700 dark:hover:bg-indigo-600 text-white px-4 py-2 rounded-lg font-semibold flex items-center gap-2"
                    >
                        <Plus size={18} /> Nova Deficiência
                    </button>
                )}
            </div>

            {error && (
                <div className="bg-red-50 dark:bg-red-900/30 border border-red-200 dark:border-red-800 rounded-lg p-4 flex items-center gap-2 text-red-700 dark:text-red-300">
                    <AlertCircle size={20} />
                    <span>{error}</span>
                </div>
            )}

            {showForm && (
                <form onSubmit={handleSubmit} className="bg-slate-50 dark:bg-slate-900 rounded-lg p-6 space-y-4 border border-slate-200 dark:border-slate-700">
                    <div className="flex justify-between items-center">
                        <h4 className="font-bold text-lg text-slate-800 dark:text-slate-100">
                            {editingId ? 'Editar Deficiência' : 'Nova Deficiência'}
                        </h4>
                        <button
                            type="button"
                            onClick={resetForm}
                            className="text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200"
                        >
                            <X size={20} />
                        </button>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div>
                            <label className="block text-sm font-semibold mb-1 text-slate-700 dark:text-slate-200">
                                Tipo de Deficiência *
                            </label>
                            <select
                                value={formData.disability_type}
                                onChange={(e) => setFormData({ ...formData, disability_type: e.target.value as DisabilityType })}
                                className="w-full border border-slate-300 dark:border-slate-600 rounded-lg px-3 py-2 text-slate-900 dark:text-slate-100 bg-white dark:bg-slate-700"
                                required
                            >
                                {DISABILITY_TYPES.map(type => (
                                    <option key={type.value} value={type.value}>{type.label}</option>
                                ))}
                            </select>
                        </div>

                        <div>
                            <label className="block text-sm font-semibold mb-1 text-slate-700 dark:text-slate-200">
                                Número de Apoio
                            </label>
                            <input
                                type="text"
                                value={formData.support_number || ''}
                                onChange={(e) => setFormData({ ...formData, support_number: e.target.value })}
                                className="w-full border border-slate-300 dark:border-slate-600 rounded-lg px-3 py-2 text-slate-900 dark:text-slate-100 bg-white dark:bg-slate-700"
                                placeholder="Ex: (11) 98765-4321"
                            />
                        </div>
                    </div>

                    <div>
                        <label className="block text-sm font-semibold mb-1 text-slate-700 dark:text-slate-200">
                            Descrição do Problema *
                        </label>
                        <textarea
                            value={formData.description || ''}
                            onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                            className="w-full border border-slate-300 dark:border-slate-600 rounded-lg px-3 py-2 text-slate-900 dark:text-slate-100 bg-white dark:bg-slate-700"
                            rows={4}
                            required
                            placeholder="Descreva detalhadamente o problema ou deficiência..."
                        />
                    </div>

                    <div>
                        <label className="block text-sm font-semibold mb-1 text-slate-700 dark:text-slate-200">
                            Informações Adicionais
                        </label>
                        <textarea
                            value={formData.additional_info || ''}
                            onChange={(e) => setFormData({ ...formData, additional_info: e.target.value })}
                            className="w-full border border-slate-300 dark:border-slate-600 rounded-lg px-3 py-2 text-slate-900 dark:text-slate-100 bg-white dark:bg-slate-700"
                            rows={3}
                            placeholder="Informações complementares, observações, etc..."
                        />
                    </div>

                    <div>
                        <label className="block text-sm font-semibold mb-1 text-slate-700 dark:text-slate-200">
                            Nome do Responsável
                        </label>
                        <input
                            type="text"
                            value={formData.responsible_name || ''}
                            onChange={(e) => setFormData({ ...formData, responsible_name: e.target.value })}
                            className="w-full border border-slate-300 dark:border-slate-600 rounded-lg px-3 py-2 text-slate-900 dark:text-slate-100 bg-white dark:bg-slate-700"
                            placeholder="Nome completo do responsável"
                        />
                    </div>

                    <div>
                        <label className="block text-sm font-semibold mb-1 text-slate-700 dark:text-slate-200">
                            Documento (PDF, Imagem, etc.)
                        </label>
                        <input
                            ref={fileInputRef}
                            type="file"
                            onChange={(e) => setDocumentFile(e.target.files?.[0] || null)}
                            accept=".pdf,.jpg,.jpeg,.png,.doc,.docx"
                            className="w-full border border-slate-300 dark:border-slate-600 rounded-lg px-3 py-2 text-sm text-slate-900 dark:text-slate-100 bg-white dark:bg-slate-700"
                        />
                        {documentFile && (
                            <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                                Arquivo selecionado: {documentFile.name}
                            </p>
                        )}
                    </div>

                    <div className="flex justify-end gap-2">
                        <button
                            type="button"
                            onClick={resetForm}
                            className="px-4 py-2 border border-slate-300 dark:border-slate-600 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200"
                        >
                            Cancelar
                        </button>
                        <button
                            type="submit"
                            disabled={isSubmitting}
                            className="px-4 py-2 bg-indigo-600 dark:bg-indigo-500 text-white rounded-lg hover:bg-indigo-700 dark:hover:bg-indigo-600 disabled:opacity-50 flex items-center gap-2"
                        >
                            {isSubmitting ? <Loader2 className="animate-spin" size={18} /> : <Save size={18} />}
                            {editingId ? 'Atualizar' : 'Salvar'}
                        </button>
                    </div>
                </form>
            )}

            {loading ? (
                <div className="flex items-center justify-center py-12">
                    <Loader2 className="animate-spin text-indigo-600 dark:text-indigo-400" size={32} />
                </div>
            ) : disabilities.length === 0 ? (
                <div className="bg-white dark:bg-slate-800 p-8 rounded-xl border border-slate-200 dark:border-slate-700 text-center text-slate-500 dark:text-slate-400">
                    <AlertCircle size={48} className="mx-auto mb-4 opacity-50" />
                    <p className="font-medium">Nenhuma deficiência cadastrada</p>
                </div>
            ) : (
                <div className="space-y-4">
                    {disabilities.map((disability) => (
                        <div
                            key={disability.id}
                            className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 p-6"
                        >
                            <div className="flex justify-between items-start mb-4">
                                <div className="flex-1">
                                    <div className="flex items-center gap-3 mb-2">
                                        <span className="px-3 py-1 rounded-lg text-sm font-semibold bg-indigo-100 dark:bg-indigo-900/30 text-indigo-700 dark:text-indigo-300">
                                            {DISABILITY_TYPES.find(t => t.value === disability.disability_type)?.label || disability.disability_type}
                                        </span>
                                        {disability.created_at && (
                                            <span className="text-xs text-slate-500 dark:text-slate-400">
                                                {new Date(disability.created_at).toLocaleDateString('pt-BR')}
                                            </span>
                                        )}
                                    </div>
                                    <p className="text-slate-700 dark:text-slate-200 font-medium mb-2">
                                        {disability.description}
                                    </p>
                                    {disability.additional_info && (
                                        <p className="text-sm text-slate-600 dark:text-slate-300 mb-2">
                                            {disability.additional_info}
                                        </p>
                                    )}
                                    <div className="flex flex-wrap gap-4 text-sm text-slate-600 dark:text-slate-400">
                                        {disability.responsible_name && (
                                            <div>
                                                <span className="font-semibold">Responsável: </span>
                                                {disability.responsible_name}
                                            </div>
                                        )}
                                        {disability.support_number && (
                                            <div>
                                                <span className="font-semibold">Apoio: </span>
                                                {disability.support_number}
                                            </div>
                                        )}
                                    </div>
                                </div>
                                {canEdit && (
                                    <div className="flex gap-2 ml-4">
                                        <button
                                            onClick={() => handleEdit(disability)}
                                            className="p-1.5 text-slate-400 dark:text-slate-500 hover:text-indigo-600 dark:hover:text-indigo-400 hover:bg-indigo-50 dark:hover:bg-indigo-900/30 rounded"
                                        >
                                            <Edit2 size={16} />
                                        </button>
                                        <button
                                            onClick={() => setDeleteModal({
                                                isOpen: true,
                                                id: disability.id,
                                                description: disability.description
                                            })}
                                            className="p-1.5 text-slate-400 dark:text-slate-500 hover:text-red-600 dark:hover:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/30 rounded"
                                        >
                                            <Trash2 size={16} />
                                        </button>
                                    </div>
                                )}
                            </div>
                            {disability.document_url && (
                                <div className="mt-4 pt-4 border-t border-slate-200 dark:border-slate-700">
                                    <a
                                        href={disability.document_url}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        className="inline-flex items-center gap-2 text-sm text-indigo-600 dark:text-indigo-400 hover:text-indigo-700 dark:hover:text-indigo-300"
                                    >
                                        <FileText size={16} />
                                        Ver Documento
                                        <Download size={14} />
                                    </a>
                                </div>
                            )}
                        </div>
                    ))}
                </div>
            )}

            <ConfirmationModal
                isOpen={deleteModal.isOpen}
                onClose={() => setDeleteModal({ isOpen: false, id: '', description: '' })}
                onConfirm={handleDelete}
                title="Confirmar Exclusão"
                message={`Tem certeza que deseja excluir esta deficiência? Esta ação não pode ser desfeita.`}
                confirmLabel="Excluir"
                isDestructive={true}
                isLoading={isSubmitting}
            />
        </div>
    );
};

export default StudentDisabilityManager;
