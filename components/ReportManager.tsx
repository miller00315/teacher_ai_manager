import React, { useState, useMemo, useEffect } from 'react';
import { useReportManager } from '../presentation/hooks/useReportManager';
import { useAppTranslation } from '../presentation/hooks/useAppTranslation';
import { getSupabaseClient } from '../services/supabaseService';
import { ProfessorUseCases } from '../domain/usecases';
import { ProfessorRepositoryImpl } from '../data/repositories';
import { 
    FileText, Calendar, Users, User, BookOpen, TrendingUp, 
    TrendingDown, BarChart3, Loader2, AlertCircle, Download,
    ChevronDown, ChevronUp
} from 'lucide-react';
import PerformanceChart from './PerformanceChart';
// PDF export will be imported dynamically when needed
import {
    ClassPerformanceReport,
    StudentPerformanceReport,
    TestPerformanceReport,
    InstitutionPerformanceReport,
    ProfessorPerformanceReport
} from '../types';

interface ReportManagerProps {
    hasSupabase: boolean;
    institutionId?: string;
    professorId?: string;
    userRole?: string;
}

type ReportType = 'class' | 'student' | 'test' | 'institution' | 'professor';

const ReportManager: React.FC<ReportManagerProps> = ({ 
    hasSupabase, 
    institutionId, 
    professorId,
    userRole 
}) => {
    const { t } = useAppTranslation();
    const supabase = getSupabaseClient();
    
    const [reportType, setReportType] = useState<ReportType>(
        userRole === 'Institution' ? 'institution' : 
        'class' // Teachers start with class report, not professor report
    );
    const [selectedClassId, setSelectedClassId] = useState<string>('');
    const [selectedStudentId, setSelectedStudentId] = useState<string>('');
    const [selectedTestId, setSelectedTestId] = useState<string>('');
    const [selectedProfessorId, setSelectedProfessorId] = useState<string>('');
    const [professors, setProfessors] = useState<any[]>([]);
    const [expandedSections, setExpandedSections] = useState<Record<string, boolean>>({
        students: true,
        tests: true,
        questions: true,
        classes: true
    });

    const {
        loading,
        error,
        classReport,
        studentReport,
        testReport,
        institutionReport,
        professorReport,
        classes,
        students,
        tests,
        dateFilter,
        setDateFilter,
        fetchClassReport,
        fetchStudentReport,
        fetchTestReport,
        fetchInstitutionReport,
        fetchProfessorReport,
        effectiveProfessorId
    } = useReportManager(hasSupabase, userRole, institutionId, professorId);

    useEffect(() => {
        if (selectedClassId && reportType === 'class') {
            fetchClassReport(selectedClassId);
        }
    }, [selectedClassId, reportType, dateFilter, fetchClassReport]);

    useEffect(() => {
        if (selectedStudentId && reportType === 'student') {
            fetchStudentReport(selectedStudentId);
        }
    }, [selectedStudentId, reportType, dateFilter, fetchStudentReport]);

    useEffect(() => {
        if (selectedTestId && reportType === 'test') {
            fetchTestReport(selectedTestId);
        }
    }, [selectedTestId, reportType, dateFilter, fetchTestReport]);

    useEffect(() => {
        if (institutionId && reportType === 'institution' && userRole === 'Institution' && !loading) {
            fetchInstitutionReport(institutionId);
        }
    }, [institutionId, reportType, dateFilter, fetchInstitutionReport, userRole, loading]);

    // Fetch professors for institution when needed
    const professorUseCase = useMemo(() => {
        if (!supabase) return null;
        return new ProfessorUseCases(new ProfessorRepositoryImpl(supabase));
    }, [supabase]);

    useEffect(() => {
        const fetchProfessors = async () => {
            if (userRole === 'Institution' && institutionId && professorUseCase && reportType === 'professor') {
                try {
                    const profs = await professorUseCase.getProfessorsByInstitution(institutionId);
                    setProfessors(profs);
                } catch (err: any) {
                    console.error("Error fetching professors:", err);
                }
            }
        };
        fetchProfessors();
    }, [userRole, institutionId, professorUseCase, reportType]);

    // Fetch professor report when selected
    useEffect(() => {
        if (selectedProfessorId && reportType === 'professor' && userRole === 'Institution' && !loading) {
            fetchProfessorReport(selectedProfessorId);
        }
    }, [selectedProfessorId, reportType, dateFilter, fetchProfessorReport, userRole, loading]);

    const toggleSection = (section: string) => {
        setExpandedSections(prev => ({
            ...prev,
            [section]: !prev[section]
        }));
    };

    const formatDate = (dateString: string) => {
        const date = new Date(dateString);
        return date.toLocaleDateString('pt-BR');
    };

    const formatPercentage = (value: number) => {
        return `${value.toFixed(1)}%`;
    };

    const formatScore = (value: number) => {
        return value.toFixed(1);
    };

    const handleExportPDF = async () => {
        try {
            // Dynamically import PDF service to avoid blocking initial load
            const { exportToPDF } = await import('../services/pdfExportService');

            const reportTitle = 
                reportType === 'class' && classReport ? `Relatório de Turma - ${classReport.className}` :
                reportType === 'student' && studentReport ? `Relatório de Aluno - ${studentReport.studentName}` :
                reportType === 'test' && testReport ? `Relatório de Prova - ${testReport.testTitle}` :
                reportType === 'institution' && institutionReport ? `Relatório da Instituição - ${institutionReport.institutionName}` :
                reportType === 'professor' && professorReport ? `Relatório do Professor - ${professorReport.professorName}` :
                'Relatório de Desempenho';

            const filename = `${reportTitle.replace(/\s+/g, '_')}_${new Date().toISOString().split('T')[0]}.pdf`;

            // Find the report content element
            const reportElement = document.getElementById('report-content');
            if (!reportElement) {
                alert('Erro: Conteúdo do relatório não encontrado.');
                return;
            }

            // Temporarily hide filters and show only report content
            const filtersElement = document.getElementById('report-filters');
            if (filtersElement) {
                filtersElement.style.display = 'none';
            }

            await exportToPDF({
                elementId: 'report-content',
                filename,
                title: reportTitle,
                orientation: 'portrait'
            });

            // Restore filters
            if (filtersElement) {
                filtersElement.style.display = 'block';
            }
        } catch (error: any) {
            console.error('Error exporting PDF:', error);
            alert('Erro ao exportar PDF: ' + (error.message || 'Erro desconhecido'));
        }
    };

    const renderClassReport = () => {
        if (!classReport) {
            return (
                <div className="text-center py-12 text-slate-500 dark:text-slate-400">
                    <FileText className="mx-auto mb-4" size={48} />
                    <p>Selecione uma turma para visualizar o relatório</p>
                </div>
            );
        }

        return (
            <div className="space-y-6">
                {/* Header */}
                <div className="bg-white dark:bg-slate-800 rounded-lg shadow p-6">
                    <h2 className="text-2xl font-bold text-slate-900 dark:text-slate-100 mb-2">
                        {classReport.className}
                    </h2>
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mt-4">
                        <div className="bg-slate-50 dark:bg-slate-700 rounded-lg p-4">
                            <div className="text-sm text-slate-600 dark:text-slate-400">Total de Alunos</div>
                            <div className="text-2xl font-bold text-slate-900 dark:text-slate-100">
                                {classReport.totalStudents}
                            </div>
                        </div>
                        <div className="bg-slate-50 dark:bg-slate-700 rounded-lg p-4">
                            <div className="text-sm text-slate-600 dark:text-slate-400">Total de Provas</div>
                            <div className="text-2xl font-bold text-slate-900 dark:text-slate-100">
                                {classReport.totalTests}
                            </div>
                        </div>
                        <div className="bg-slate-50 dark:bg-slate-700 rounded-lg p-4">
                            <div className="text-sm text-slate-600 dark:text-slate-400">Média Geral</div>
                            <div className="text-2xl font-bold text-indigo-600 dark:text-indigo-400">
                                {formatScore(classReport.averageScore)}
                            </div>
                        </div>
                        <div className="bg-slate-50 dark:bg-slate-700 rounded-lg p-4">
                            <div className="text-sm text-slate-600 dark:text-slate-400">Taxa de Conclusão</div>
                            <div className="text-2xl font-bold text-green-600 dark:text-green-400">
                                {formatPercentage(classReport.completionRate)}
                            </div>
                        </div>
                    </div>
                </div>

                {/* Performance Evolution Chart */}
                {classReport.performanceEvolution && classReport.performanceEvolution.length > 0 && (
                    <PerformanceChart
                        data={classReport.performanceEvolution}
                        title="Evolução do Desempenho da Turma"
                        showCompletionRate={true}
                        showAttempts={true}
                    />
                )}

                {/* Students Performance */}
                <div className="bg-white dark:bg-slate-800 rounded-lg shadow">
                    <button
                        onClick={() => toggleSection('students')}
                        className="w-full flex items-center justify-between p-4 text-left hover:bg-slate-50 dark:hover:bg-slate-700 rounded-t-lg"
                    >
                        <h3 className="text-lg font-semibold text-slate-900 dark:text-slate-100 flex items-center gap-2">
                            <Users className="text-indigo-600 dark:text-indigo-400" size={20} />
                            Desempenho dos Alunos
                        </h3>
                        {expandedSections.students ? <ChevronUp /> : <ChevronDown />}
                    </button>
                    {expandedSections.students && (
                        <div className="p-4 border-t border-slate-200 dark:border-slate-700">
                            <div className="overflow-x-auto">
                                <table className="w-full">
                                    <thead>
                                        <tr className="border-b border-slate-200 dark:border-slate-700">
                                            <th className="text-left p-2 text-sm font-semibold text-slate-700 dark:text-slate-300">Aluno</th>
                                            <th className="text-right p-2 text-sm font-semibold text-slate-700 dark:text-slate-300">Média</th>
                                            <th className="text-right p-2 text-sm font-semibold text-slate-700 dark:text-slate-300">Provas</th>
                                            <th className="text-right p-2 text-sm font-semibold text-slate-700 dark:text-slate-300">Conclusão</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {classReport.studentsPerformance.map((student) => (
                                            <tr key={student.studentId} className="border-b border-slate-100 dark:border-slate-800">
                                                <td className="p-2 text-slate-900 dark:text-slate-100">{student.studentName}</td>
                                                <td className="p-2 text-right text-slate-900 dark:text-slate-100 font-medium">
                                                    {formatScore(student.averageScore)}
                                                </td>
                                                <td className="p-2 text-right text-slate-600 dark:text-slate-400">
                                                    {student.totalTests}
                                                </td>
                                                <td className="p-2 text-right text-slate-600 dark:text-slate-400">
                                                    {formatPercentage(student.completionRate)}
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        </div>
                    )}
                </div>

                {/* Tests Performance */}
                <div className="bg-white dark:bg-slate-800 rounded-lg shadow">
                    <button
                        onClick={() => toggleSection('tests')}
                        className="w-full flex items-center justify-between p-4 text-left hover:bg-slate-50 dark:hover:bg-slate-700 rounded-t-lg"
                    >
                        <h3 className="text-lg font-semibold text-slate-900 dark:text-slate-100 flex items-center gap-2">
                            <BookOpen className="text-indigo-600 dark:text-indigo-400" size={20} />
                            Desempenho das Provas
                        </h3>
                        {expandedSections.tests ? <ChevronUp /> : <ChevronDown />}
                    </button>
                    {expandedSections.tests && (
                        <div className="p-4 border-t border-slate-200 dark:border-slate-700">
                            <div className="overflow-x-auto">
                                <table className="w-full">
                                    <thead>
                                        <tr className="border-b border-slate-200 dark:border-slate-700">
                                            <th className="text-left p-2 text-sm font-semibold text-slate-700 dark:text-slate-300">Prova</th>
                                            <th className="text-right p-2 text-sm font-semibold text-slate-700 dark:text-slate-300">Média</th>
                                            <th className="text-right p-2 text-sm font-semibold text-slate-700 dark:text-slate-300">Alunos</th>
                                            <th className="text-right p-2 text-sm font-semibold text-slate-700 dark:text-slate-300">Conclusão</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {classReport.testsPerformance.map((test) => (
                                            <tr key={test.testId} className="border-b border-slate-100 dark:border-slate-800">
                                                <td className="p-2 text-slate-900 dark:text-slate-100">{test.testTitle}</td>
                                                <td className="p-2 text-right text-slate-900 dark:text-slate-100 font-medium">
                                                    {formatScore(test.averageScore)}
                                                </td>
                                                <td className="p-2 text-right text-slate-600 dark:text-slate-400">
                                                    {test.totalStudents}
                                                </td>
                                                <td className="p-2 text-right text-slate-600 dark:text-slate-400">
                                                    {formatPercentage(test.completionRate)}
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        </div>
                    )}
                </div>
            </div>
        );
    };

    const renderStudentReport = () => {
        if (!studentReport) {
            return (
                <div className="text-center py-12 text-slate-500 dark:text-slate-400">
                    <User className="mx-auto mb-4" size={48} />
                    <p>Selecione um aluno para visualizar o relatório</p>
                </div>
            );
        }

        return (
            <div className="space-y-6">
                {/* Header */}
                <div className="bg-white dark:bg-slate-800 rounded-lg shadow p-6">
                    <h2 className="text-2xl font-bold text-slate-900 dark:text-slate-100 mb-2">
                        {studentReport.studentName}
                    </h2>
                    <p className="text-slate-600 dark:text-slate-400">
                        {studentReport.className} - {studentReport.gradeName}
                    </p>
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mt-4">
                        <div className="bg-slate-50 dark:bg-slate-700 rounded-lg p-4">
                            <div className="text-sm text-slate-600 dark:text-slate-400">Total de Provas</div>
                            <div className="text-2xl font-bold text-slate-900 dark:text-slate-100">
                                {studentReport.totalTests}
                            </div>
                        </div>
                        <div className="bg-slate-50 dark:bg-slate-700 rounded-lg p-4">
                            <div className="text-sm text-slate-600 dark:text-slate-400">Média Geral</div>
                            <div className="text-2xl font-bold text-indigo-600 dark:text-indigo-400">
                                {formatScore(studentReport.averageScore)}
                            </div>
                        </div>
                        <div className="bg-slate-50 dark:bg-slate-700 rounded-lg p-4">
                            <div className="text-sm text-slate-600 dark:text-slate-400">Melhor Nota</div>
                            <div className="text-2xl font-bold text-green-600 dark:text-green-400">
                                {formatScore(studentReport.bestScore)}
                            </div>
                        </div>
                        <div className="bg-slate-50 dark:bg-slate-700 rounded-lg p-4">
                            <div className="text-sm text-slate-600 dark:text-slate-400">Taxa de Conclusão</div>
                            <div className="text-2xl font-bold text-blue-600 dark:text-blue-400">
                                {formatPercentage(studentReport.completionRate)}
                            </div>
                        </div>
                    </div>
                </div>

                {/* Performance Evolution Chart */}
                {studentReport.performanceEvolution && studentReport.performanceEvolution.length > 0 && (
                    <PerformanceChart
                        data={studentReport.performanceEvolution}
                        title="Evolução do Desempenho do Aluno"
                        showAttempts={true}
                    />
                )}

                {/* Tests Details */}
                <div className="bg-white dark:bg-slate-800 rounded-lg shadow">
                    <h3 className="text-lg font-semibold text-slate-900 dark:text-slate-100 p-4 border-b border-slate-200 dark:border-slate-700 flex items-center gap-2">
                        <BookOpen className="text-indigo-600 dark:text-indigo-400" size={20} />
                        Detalhes das Provas
                    </h3>
                    <div className="p-4">
                        <div className="overflow-x-auto">
                            <table className="w-full">
                                <thead>
                                    <tr className="border-b border-slate-200 dark:border-slate-700">
                                        <th className="text-left p-2 text-sm font-semibold text-slate-700 dark:text-slate-300">Prova</th>
                                        <th className="text-right p-2 text-sm font-semibold text-slate-700 dark:text-slate-300">Nota</th>
                                        <th className="text-right p-2 text-sm font-semibold text-slate-700 dark:text-slate-300">Acertos</th>
                                        <th className="text-right p-2 text-sm font-semibold text-slate-700 dark:text-slate-300">Erros</th>
                                        <th className="text-right p-2 text-sm font-semibold text-slate-700 dark:text-slate-300">Data</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {studentReport.testsDetails.map((test, idx) => (
                                        <tr key={idx} className="border-b border-slate-100 dark:border-slate-800">
                                            <td className="p-2 text-slate-900 dark:text-slate-100">{test.testTitle}</td>
                                            <td className="p-2 text-right text-slate-900 dark:text-slate-100 font-medium">
                                                {formatScore(test.score)}
                                            </td>
                                            <td className="p-2 text-right text-green-600 dark:text-green-400">
                                                {test.correctCount}
                                            </td>
                                            <td className="p-2 text-right text-red-600 dark:text-red-400">
                                                {test.errorCount}
                                            </td>
                                            <td className="p-2 text-right text-slate-600 dark:text-slate-400">
                                                {formatDate(test.attemptDate)}
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    </div>
                </div>
            </div>
        );
    };

    const renderTestReport = () => {
        if (!testReport) {
            return (
                <div className="text-center py-12 text-slate-500 dark:text-slate-400">
                    <BookOpen className="mx-auto mb-4" size={48} />
                    <p>Selecione uma prova para visualizar o relatório</p>
                </div>
            );
        }

        return (
            <div className="space-y-6">
                {/* Header */}
                <div className="bg-white dark:bg-slate-800 rounded-lg shadow p-6">
                    <h2 className="text-2xl font-bold text-slate-900 dark:text-slate-100 mb-2">
                        {testReport.testTitle}
                    </h2>
                    <p className="text-slate-600 dark:text-slate-400">
                        Professor: {testReport.professorName} | Instituição: {testReport.institutionName}
                    </p>
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mt-4">
                        <div className="bg-slate-50 dark:bg-slate-700 rounded-lg p-4">
                            <div className="text-sm text-slate-600 dark:text-slate-400">Total de Alunos</div>
                            <div className="text-2xl font-bold text-slate-900 dark:text-slate-100">
                                {testReport.totalStudents}
                            </div>
                        </div>
                        <div className="bg-slate-50 dark:bg-slate-700 rounded-lg p-4">
                            <div className="text-sm text-slate-600 dark:text-slate-400">Total de Tentativas</div>
                            <div className="text-2xl font-bold text-slate-900 dark:text-slate-100">
                                {testReport.totalAttempts}
                            </div>
                        </div>
                        <div className="bg-slate-50 dark:bg-slate-700 rounded-lg p-4">
                            <div className="text-sm text-slate-600 dark:text-slate-400">Média Geral</div>
                            <div className="text-2xl font-bold text-indigo-600 dark:text-indigo-400">
                                {formatScore(testReport.averageScore)}
                            </div>
                        </div>
                        <div className="bg-slate-50 dark:bg-slate-700 rounded-lg p-4">
                            <div className="text-sm text-slate-600 dark:text-slate-400">Taxa de Conclusão</div>
                            <div className="text-2xl font-bold text-green-600 dark:text-green-400">
                                {formatPercentage(testReport.completionRate)}
                            </div>
                        </div>
                    </div>
                </div>

                {/* Performance Evolution Chart */}
                {testReport.performanceEvolution && testReport.performanceEvolution.length > 0 && (
                    <PerformanceChart
                        data={testReport.performanceEvolution}
                        title="Evolução do Desempenho da Prova"
                        showCompletionRate={true}
                        showAttempts={true}
                    />
                )}

                {/* Students Performance */}
                <div className="bg-white dark:bg-slate-800 rounded-lg shadow">
                    <button
                        onClick={() => toggleSection('students')}
                        className="w-full flex items-center justify-between p-4 text-left hover:bg-slate-50 dark:hover:bg-slate-700 rounded-t-lg"
                    >
                        <h3 className="text-lg font-semibold text-slate-900 dark:text-slate-100 flex items-center gap-2">
                            <Users className="text-indigo-600 dark:text-indigo-400" size={20} />
                            Desempenho dos Alunos
                        </h3>
                        {expandedSections.students ? <ChevronUp /> : <ChevronDown />}
                    </button>
                    {expandedSections.students && (
                        <div className="p-4 border-t border-slate-200 dark:border-slate-700">
                            <div className="overflow-x-auto">
                                <table className="w-full">
                                    <thead>
                                        <tr className="border-b border-slate-200 dark:border-slate-700">
                                            <th className="text-left p-2 text-sm font-semibold text-slate-700 dark:text-slate-300">Aluno</th>
                                            <th className="text-right p-2 text-sm font-semibold text-slate-700 dark:text-slate-300">Nota</th>
                                            <th className="text-right p-2 text-sm font-semibold text-slate-700 dark:text-slate-300">Acertos</th>
                                            <th className="text-right p-2 text-sm font-semibold text-slate-700 dark:text-slate-300">Erros</th>
                                            <th className="text-right p-2 text-sm font-semibold text-slate-700 dark:text-slate-300">Data</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {testReport.studentsPerformance.map((student, idx) => (
                                            <tr key={idx} className="border-b border-slate-100 dark:border-slate-800">
                                                <td className="p-2 text-slate-900 dark:text-slate-100">{student.studentName}</td>
                                                <td className="p-2 text-right text-slate-900 dark:text-slate-100 font-medium">
                                                    {formatScore(student.score)}
                                                </td>
                                                <td className="p-2 text-right text-green-600 dark:text-green-400">
                                                    {student.correctCount}
                                                </td>
                                                <td className="p-2 text-right text-red-600 dark:text-red-400">
                                                    {student.errorCount}
                                                </td>
                                                <td className="p-2 text-right text-slate-600 dark:text-slate-400">
                                                    {formatDate(student.attemptDate)}
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        </div>
                    )}
                </div>

                {/* Question Performance */}
                <div className="bg-white dark:bg-slate-800 rounded-lg shadow">
                    <button
                        onClick={() => toggleSection('questions')}
                        className="w-full flex items-center justify-between p-4 text-left hover:bg-slate-50 dark:hover:bg-slate-700 rounded-t-lg"
                    >
                        <h3 className="text-lg font-semibold text-slate-900 dark:text-slate-100 flex items-center gap-2">
                            <BarChart3 className="text-indigo-600 dark:text-indigo-400" size={20} />
                            Desempenho por Questão
                        </h3>
                        {expandedSections.questions ? <ChevronUp /> : <ChevronDown />}
                    </button>
                    {expandedSections.questions && (
                        <div className="p-4 border-t border-slate-200 dark:border-slate-700">
                            <div className="overflow-x-auto">
                                <table className="w-full">
                                    <thead>
                                        <tr className="border-b border-slate-200 dark:border-slate-700">
                                            <th className="text-left p-2 text-sm font-semibold text-slate-700 dark:text-slate-300">Questão</th>
                                            <th className="text-right p-2 text-sm font-semibold text-slate-700 dark:text-slate-300">Tentativas</th>
                                            <th className="text-right p-2 text-sm font-semibold text-slate-700 dark:text-slate-300">Acertos</th>
                                            <th className="text-right p-2 text-sm font-semibold text-slate-700 dark:text-slate-300">Erros</th>
                                            <th className="text-right p-2 text-sm font-semibold text-slate-700 dark:text-slate-300">Taxa de Sucesso</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {testReport.questionPerformance.map((question, idx) => (
                                            <tr key={question.questionId} className="border-b border-slate-100 dark:border-slate-800">
                                                <td className="p-2 text-slate-900 dark:text-slate-100">
                                                    <div className="max-w-md truncate" title={question.questionContent}>
                                                        {question.questionContent || `Questão ${idx + 1}`}
                                                    </div>
                                                </td>
                                                <td className="p-2 text-right text-slate-600 dark:text-slate-400">
                                                    {question.totalAttempts}
                                                </td>
                                                <td className="p-2 text-right text-green-600 dark:text-green-400">
                                                    {question.correctCount}
                                                </td>
                                                <td className="p-2 text-right text-red-600 dark:text-red-400">
                                                    {question.errorCount}
                                                </td>
                                                <td className="p-2 text-right text-slate-900 dark:text-slate-100 font-medium">
                                                    {formatPercentage(question.successRate)}
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        </div>
                    )}
                </div>
            </div>
        );
    };

    const renderInstitutionReport = () => {
        if (!institutionReport) {
            return (
                <div className="text-center py-12 text-slate-500 dark:text-slate-400">
                    <FileText className="mx-auto mb-4" size={48} />
                    <p>Carregando relatório da instituição...</p>
                </div>
            );
        }

        return (
            <div className="space-y-6">
                {/* Header */}
                <div className="bg-white dark:bg-slate-800 rounded-lg shadow p-6">
                    <h2 className="text-2xl font-bold text-slate-900 dark:text-slate-100 mb-2">
                        {institutionReport.institutionName}
                    </h2>
                    <p className="text-slate-600 dark:text-slate-400 mb-4">
                        Relatório Geral da Instituição
                    </p>
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mt-4">
                        <div className="bg-slate-50 dark:bg-slate-700 rounded-lg p-4">
                            <div className="text-sm text-slate-600 dark:text-slate-400">Total de Turmas</div>
                            <div className="text-2xl font-bold text-slate-900 dark:text-slate-100">
                                {institutionReport.totalClasses}
                            </div>
                        </div>
                        <div className="bg-slate-50 dark:bg-slate-700 rounded-lg p-4">
                            <div className="text-sm text-slate-600 dark:text-slate-400">Total de Alunos</div>
                            <div className="text-2xl font-bold text-slate-900 dark:text-slate-100">
                                {institutionReport.totalStudents}
                            </div>
                        </div>
                        <div className="bg-slate-50 dark:bg-slate-700 rounded-lg p-4">
                            <div className="text-sm text-slate-600 dark:text-slate-400">Média Geral</div>
                            <div className="text-2xl font-bold text-indigo-600 dark:text-indigo-400">
                                {formatScore(institutionReport.averageScore)}
                            </div>
                        </div>
                        <div className="bg-slate-50 dark:bg-slate-700 rounded-lg p-4">
                            <div className="text-sm text-slate-600 dark:text-slate-400">Taxa de Conclusão</div>
                            <div className="text-2xl font-bold text-green-600 dark:text-green-400">
                                {formatPercentage(institutionReport.completionRate)}
                            </div>
                        </div>
                    </div>
                </div>

                {/* Classes Performance */}
                <div className="bg-white dark:bg-slate-800 rounded-lg shadow">
                    <button
                        onClick={() => toggleSection('classes')}
                        className="w-full flex items-center justify-between p-4 text-left hover:bg-slate-50 dark:hover:bg-slate-700 rounded-t-lg"
                    >
                        <h3 className="text-lg font-semibold text-slate-900 dark:text-slate-100 flex items-center gap-2">
                            <Users className="text-indigo-600 dark:text-indigo-400" size={20} />
                            Desempenho por Turma
                        </h3>
                        {expandedSections.classes ? <ChevronUp /> : <ChevronDown />}
                    </button>
                    {expandedSections.classes && (
                        <div className="p-4 border-t border-slate-200 dark:border-slate-700">
                            <div className="overflow-x-auto">
                                <table className="w-full">
                                    <thead>
                                        <tr className="border-b border-slate-200 dark:border-slate-700">
                                            <th className="text-left p-2 text-sm font-semibold text-slate-700 dark:text-slate-300">Turma</th>
                                            <th className="text-left p-2 text-sm font-semibold text-slate-700 dark:text-slate-300">Série</th>
                                            <th className="text-right p-2 text-sm font-semibold text-slate-700 dark:text-slate-300">Alunos</th>
                                            <th className="text-right p-2 text-sm font-semibold text-slate-700 dark:text-slate-300">Provas</th>
                                            <th className="text-right p-2 text-sm font-semibold text-slate-700 dark:text-slate-300">Média</th>
                                            <th className="text-right p-2 text-sm font-semibold text-slate-700 dark:text-slate-300">Conclusão</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {institutionReport.classesPerformance.map((classPerf) => (
                                            <tr key={classPerf.classId} className="border-b border-slate-100 dark:border-slate-800">
                                                <td className="p-2 text-slate-900 dark:text-slate-100">{classPerf.className}</td>
                                                <td className="p-2 text-slate-600 dark:text-slate-400">{classPerf.gradeName}</td>
                                                <td className="p-2 text-right text-slate-600 dark:text-slate-400">
                                                    {classPerf.totalStudents}
                                                </td>
                                                <td className="p-2 text-right text-slate-600 dark:text-slate-400">
                                                    {classPerf.totalTests}
                                                </td>
                                                <td className="p-2 text-right text-slate-900 dark:text-slate-100 font-medium">
                                                    {formatScore(classPerf.averageScore)}
                                                </td>
                                                <td className="p-2 text-right text-slate-600 dark:text-slate-400">
                                                    {formatPercentage(classPerf.completionRate)}
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        </div>
                    )}
                </div>

                {/* Students Performance */}
                <div className="bg-white dark:bg-slate-800 rounded-lg shadow">
                    <button
                        onClick={() => toggleSection('students')}
                        className="w-full flex items-center justify-between p-4 text-left hover:bg-slate-50 dark:hover:bg-slate-700 rounded-t-lg"
                    >
                        <h3 className="text-lg font-semibold text-slate-900 dark:text-slate-100 flex items-center gap-2">
                            <User className="text-indigo-600 dark:text-indigo-400" size={20} />
                            Desempenho dos Alunos
                        </h3>
                        {expandedSections.students ? <ChevronUp /> : <ChevronDown />}
                    </button>
                    {expandedSections.students && (
                        <div className="p-4 border-t border-slate-200 dark:border-slate-700">
                            <div className="overflow-x-auto">
                                <table className="w-full">
                                    <thead>
                                        <tr className="border-b border-slate-200 dark:border-slate-700">
                                            <th className="text-left p-2 text-sm font-semibold text-slate-700 dark:text-slate-300">Aluno</th>
                                            <th className="text-right p-2 text-sm font-semibold text-slate-700 dark:text-slate-300">Média</th>
                                            <th className="text-right p-2 text-sm font-semibold text-slate-700 dark:text-slate-300">Provas</th>
                                            <th className="text-right p-2 text-sm font-semibold text-slate-700 dark:text-slate-300">Conclusão</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {institutionReport.studentsPerformance.map((student) => (
                                            <tr key={student.studentId} className="border-b border-slate-100 dark:border-slate-800">
                                                <td className="p-2 text-slate-900 dark:text-slate-100">{student.studentName}</td>
                                                <td className="p-2 text-right text-slate-900 dark:text-slate-100 font-medium">
                                                    {formatScore(student.averageScore)}
                                                </td>
                                                <td className="p-2 text-right text-slate-600 dark:text-slate-400">
                                                    {student.totalTests}
                                                </td>
                                                <td className="p-2 text-right text-slate-600 dark:text-slate-400">
                                                    {formatPercentage(student.completionRate)}
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        </div>
                    )}
                </div>

                {/* Tests Performance */}
                <div className="bg-white dark:bg-slate-800 rounded-lg shadow">
                    <button
                        onClick={() => toggleSection('tests')}
                        className="w-full flex items-center justify-between p-4 text-left hover:bg-slate-50 dark:hover:bg-slate-700 rounded-t-lg"
                    >
                        <h3 className="text-lg font-semibold text-slate-900 dark:text-slate-100 flex items-center gap-2">
                            <BookOpen className="text-indigo-600 dark:text-indigo-400" size={20} />
                            Desempenho das Provas
                        </h3>
                        {expandedSections.tests ? <ChevronUp /> : <ChevronDown />}
                    </button>
                    {expandedSections.tests && (
                        <div className="p-4 border-t border-slate-200 dark:border-slate-700">
                            <div className="overflow-x-auto">
                                <table className="w-full">
                                    <thead>
                                        <tr className="border-b border-slate-200 dark:border-slate-700">
                                            <th className="text-left p-2 text-sm font-semibold text-slate-700 dark:text-slate-300">Prova</th>
                                            <th className="text-left p-2 text-sm font-semibold text-slate-700 dark:text-slate-300">Professor</th>
                                            <th className="text-right p-2 text-sm font-semibold text-slate-700 dark:text-slate-300">Média</th>
                                            <th className="text-right p-2 text-sm font-semibold text-slate-700 dark:text-slate-300">Alunos</th>
                                            <th className="text-right p-2 text-sm font-semibold text-slate-700 dark:text-slate-300">Conclusão</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {institutionReport.testsPerformance.map((test) => (
                                            <tr key={test.testId} className="border-b border-slate-100 dark:border-slate-800">
                                                <td className="p-2 text-slate-900 dark:text-slate-100">{test.testTitle}</td>
                                                <td className="p-2 text-slate-600 dark:text-slate-400">{test.professorName}</td>
                                                <td className="p-2 text-right text-slate-900 dark:text-slate-100 font-medium">
                                                    {formatScore(test.averageScore)}
                                                </td>
                                                <td className="p-2 text-right text-slate-600 dark:text-slate-400">
                                                    {test.totalStudents}
                                                </td>
                                                <td className="p-2 text-right text-slate-600 dark:text-slate-400">
                                                    {formatPercentage(test.completionRate)}
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        </div>
                    )}
                </div>
            </div>
        );
    };

    const renderProfessorReport = () => {
        if (!professorReport) {
            return (
                <div className="text-center py-12 text-slate-500 dark:text-slate-400">
                    <FileText className="mx-auto mb-4" size={48} />
                    <p>Carregando relatório do professor...</p>
                </div>
            );
        }

        return (
            <div className="space-y-6">
                {/* Header */}
                <div className="bg-white dark:bg-slate-800 rounded-lg shadow p-6">
                    <h2 className="text-2xl font-bold text-slate-900 dark:text-slate-100 mb-2">
                        {professorReport.professorName}
                    </h2>
                    <p className="text-slate-600 dark:text-slate-400 mb-4">
                        Relatório Geral do Professor - {professorReport.institutionName}
                    </p>
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mt-4">
                        <div className="bg-slate-50 dark:bg-slate-700 rounded-lg p-4">
                            <div className="text-sm text-slate-600 dark:text-slate-400">Total de Turmas</div>
                            <div className="text-2xl font-bold text-slate-900 dark:text-slate-100">
                                {professorReport.totalClasses}
                            </div>
                        </div>
                        <div className="bg-slate-50 dark:bg-slate-700 rounded-lg p-4">
                            <div className="text-sm text-slate-600 dark:text-slate-400">Total de Alunos</div>
                            <div className="text-2xl font-bold text-slate-900 dark:text-slate-100">
                                {professorReport.totalStudents}
                            </div>
                        </div>
                        <div className="bg-slate-50 dark:bg-slate-700 rounded-lg p-4">
                            <div className="text-sm text-slate-600 dark:text-slate-400">Média Geral</div>
                            <div className="text-2xl font-bold text-indigo-600 dark:text-indigo-400">
                                {formatScore(professorReport.averageScore)}
                            </div>
                        </div>
                        <div className="bg-slate-50 dark:bg-slate-700 rounded-lg p-4">
                            <div className="text-sm text-slate-600 dark:text-slate-400">Taxa de Conclusão</div>
                            <div className="text-2xl font-bold text-green-600 dark:text-green-400">
                                {formatPercentage(professorReport.completionRate)}
                            </div>
                        </div>
                    </div>
                </div>

                {/* Classes Performance */}
                <div className="bg-white dark:bg-slate-800 rounded-lg shadow">
                    <button
                        onClick={() => toggleSection('classes')}
                        className="w-full flex items-center justify-between p-4 text-left hover:bg-slate-50 dark:hover:bg-slate-700 rounded-t-lg"
                    >
                        <h3 className="text-lg font-semibold text-slate-900 dark:text-slate-100 flex items-center gap-2">
                            <Users className="text-indigo-600 dark:text-indigo-400" size={20} />
                            Desempenho por Turma
                        </h3>
                        {expandedSections.classes ? <ChevronUp /> : <ChevronDown />}
                    </button>
                    {expandedSections.classes && (
                        <div className="p-4 border-t border-slate-200 dark:border-slate-700">
                            <div className="overflow-x-auto">
                                <table className="w-full">
                                    <thead>
                                        <tr className="border-b border-slate-200 dark:border-slate-700">
                                            <th className="text-left p-2 text-sm font-semibold text-slate-700 dark:text-slate-300">Turma</th>
                                            <th className="text-left p-2 text-sm font-semibold text-slate-700 dark:text-slate-300">Série</th>
                                            <th className="text-right p-2 text-sm font-semibold text-slate-700 dark:text-slate-300">Alunos</th>
                                            <th className="text-right p-2 text-sm font-semibold text-slate-700 dark:text-slate-300">Provas</th>
                                            <th className="text-right p-2 text-sm font-semibold text-slate-700 dark:text-slate-300">Média</th>
                                            <th className="text-right p-2 text-sm font-semibold text-slate-700 dark:text-slate-300">Conclusão</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {professorReport.classesPerformance.map((classPerf) => (
                                            <tr key={classPerf.classId} className="border-b border-slate-100 dark:border-slate-800">
                                                <td className="p-2 text-slate-900 dark:text-slate-100">{classPerf.className}</td>
                                                <td className="p-2 text-slate-600 dark:text-slate-400">{classPerf.gradeName}</td>
                                                <td className="p-2 text-right text-slate-600 dark:text-slate-400">
                                                    {classPerf.totalStudents}
                                                </td>
                                                <td className="p-2 text-right text-slate-600 dark:text-slate-400">
                                                    {classPerf.totalTests}
                                                </td>
                                                <td className="p-2 text-right text-slate-900 dark:text-slate-100 font-medium">
                                                    {formatScore(classPerf.averageScore)}
                                                </td>
                                                <td className="p-2 text-right text-slate-600 dark:text-slate-400">
                                                    {formatPercentage(classPerf.completionRate)}
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        </div>
                    )}
                </div>

                {/* Students Performance */}
                <div className="bg-white dark:bg-slate-800 rounded-lg shadow">
                    <button
                        onClick={() => toggleSection('students')}
                        className="w-full flex items-center justify-between p-4 text-left hover:bg-slate-50 dark:hover:bg-slate-700 rounded-t-lg"
                    >
                        <h3 className="text-lg font-semibold text-slate-900 dark:text-slate-100 flex items-center gap-2">
                            <User className="text-indigo-600 dark:text-indigo-400" size={20} />
                            Desempenho dos Alunos
                        </h3>
                        {expandedSections.students ? <ChevronUp /> : <ChevronDown />}
                    </button>
                    {expandedSections.students && (
                        <div className="p-4 border-t border-slate-200 dark:border-slate-700">
                            <div className="overflow-x-auto">
                                <table className="w-full">
                                    <thead>
                                        <tr className="border-b border-slate-200 dark:border-slate-700">
                                            <th className="text-left p-2 text-sm font-semibold text-slate-700 dark:text-slate-300">Aluno</th>
                                            <th className="text-right p-2 text-sm font-semibold text-slate-700 dark:text-slate-300">Média</th>
                                            <th className="text-right p-2 text-sm font-semibold text-slate-700 dark:text-slate-300">Provas</th>
                                            <th className="text-right p-2 text-sm font-semibold text-slate-700 dark:text-slate-300">Conclusão</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {professorReport.studentsPerformance.map((student) => (
                                            <tr key={student.studentId} className="border-b border-slate-100 dark:border-slate-800">
                                                <td className="p-2 text-slate-900 dark:text-slate-100">{student.studentName}</td>
                                                <td className="p-2 text-right text-slate-900 dark:text-slate-100 font-medium">
                                                    {formatScore(student.averageScore)}
                                                </td>
                                                <td className="p-2 text-right text-slate-600 dark:text-slate-400">
                                                    {student.totalTests}
                                                </td>
                                                <td className="p-2 text-right text-slate-600 dark:text-slate-400">
                                                    {formatPercentage(student.completionRate)}
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        </div>
                    )}
                </div>

                {/* Tests Performance */}
                <div className="bg-white dark:bg-slate-800 rounded-lg shadow">
                    <button
                        onClick={() => toggleSection('tests')}
                        className="w-full flex items-center justify-between p-4 text-left hover:bg-slate-50 dark:hover:bg-slate-700 rounded-t-lg"
                    >
                        <h3 className="text-lg font-semibold text-slate-900 dark:text-slate-100 flex items-center gap-2">
                            <BookOpen className="text-indigo-600 dark:text-indigo-400" size={20} />
                            Desempenho das Provas
                        </h3>
                        {expandedSections.tests ? <ChevronUp /> : <ChevronDown />}
                    </button>
                    {expandedSections.tests && (
                        <div className="p-4 border-t border-slate-200 dark:border-slate-700">
                            <div className="overflow-x-auto">
                                <table className="w-full">
                                    <thead>
                                        <tr className="border-b border-slate-200 dark:border-slate-700">
                                            <th className="text-left p-2 text-sm font-semibold text-slate-700 dark:text-slate-300">Prova</th>
                                            <th className="text-right p-2 text-sm font-semibold text-slate-700 dark:text-slate-300">Média</th>
                                            <th className="text-right p-2 text-sm font-semibold text-slate-700 dark:text-slate-300">Alunos</th>
                                            <th className="text-right p-2 text-sm font-semibold text-slate-700 dark:text-slate-300">Conclusão</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {professorReport.testsPerformance.map((test) => (
                                            <tr key={test.testId} className="border-b border-slate-100 dark:border-slate-800">
                                                <td className="p-2 text-slate-900 dark:text-slate-100">{test.testTitle}</td>
                                                <td className="p-2 text-right text-slate-900 dark:text-slate-100 font-medium">
                                                    {formatScore(test.averageScore)}
                                                </td>
                                                <td className="p-2 text-right text-slate-600 dark:text-slate-400">
                                                    {test.totalStudents}
                                                </td>
                                                <td className="p-2 text-right text-slate-600 dark:text-slate-400">
                                                    {formatPercentage(test.completionRate)}
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        </div>
                    )}
                </div>
            </div>
        );
    };

    const hasReportData = 
        (reportType === 'class' && classReport) ||
        (reportType === 'student' && studentReport) ||
        (reportType === 'test' && testReport) ||
        (reportType === 'institution' && institutionReport) ||
        (reportType === 'professor' && professorReport);

    return (
        <div className="p-6 space-y-6">
            <div className="flex items-center justify-between mb-6">
                <h1 className="text-3xl font-bold text-slate-900 dark:text-slate-100 flex items-center gap-2">
                    <FileText className="text-indigo-600 dark:text-indigo-400" size={32} />
                    Relatórios de Desempenho
                </h1>
                {hasReportData && (
                    <button
                        onClick={handleExportPDF}
                        disabled={loading}
                        className="flex items-center gap-2 px-4 py-2 bg-indigo-600 hover:bg-indigo-700 disabled:bg-slate-400 disabled:cursor-not-allowed text-white rounded-lg font-semibold transition-colors"
                    >
                        {loading ? (
                            <>
                                <Loader2 size={20} className="animate-spin" />
                                {t('reports.generatingPDF')}
                            </>
                        ) : (
                            <>
                                <Download size={20} />
                                {t('reports.exportPDF')}
                            </>
                        )}
                    </button>
                )}
            </div>

            {/* Filters */}
            <div id="report-filters" className="bg-white dark:bg-slate-800 rounded-lg shadow p-6">
                <div className={`grid grid-cols-1 ${reportType === 'institution' || reportType === 'professor' ? 'md:grid-cols-2' : 'md:grid-cols-4'} gap-4`}>
                    {/* Report Type */}
                    <div>
                        <label className="block text-sm font-semibold mb-2 text-slate-700 dark:text-slate-200">
                            Tipo de Relatório
                        </label>
                        <select
                            value={reportType}
                            onChange={(e) => {
                                setReportType(e.target.value as ReportType);
                                setSelectedClassId('');
                                setSelectedStudentId('');
                                setSelectedTestId('');
                                setSelectedProfessorId('');
                            }}
                            className="w-full border border-slate-300 dark:border-slate-600 rounded-lg px-3 py-2 text-slate-900 dark:text-slate-100 bg-white dark:bg-slate-700 focus:ring-2 focus:ring-indigo-500 outline-none"
                        >
                            {userRole === 'Institution' && <option value="institution">{t('reports.institutionReport')}</option>}
                            {userRole === 'Institution' && <option value="professor">{t('reports.professorReport')}</option>}
                            <option value="class">{t('reports.classReport')}</option>
                            <option value="student">{t('reports.studentReport')}</option>
                            <option value="test">{t('reports.testReport')}</option>
                        </select>
                    </div>

                    {/* Date Range */}
                    <div>
                        <label className="block text-sm font-semibold mb-2 text-slate-700 dark:text-slate-200">
                            Data Inicial
                        </label>
                        <input
                            type="date"
                            value={dateFilter.startDate}
                            onChange={(e) => setDateFilter({ ...dateFilter, startDate: e.target.value })}
                            className="w-full border border-slate-300 dark:border-slate-600 rounded-lg px-3 py-2 text-slate-900 dark:text-slate-100 bg-white dark:bg-slate-700 focus:ring-2 focus:ring-indigo-500 outline-none"
                        />
                    </div>

                    <div>
                        <label className="block text-sm font-semibold mb-2 text-slate-700 dark:text-slate-200">
                            Data Final
                        </label>
                        <input
                            type="date"
                            value={dateFilter.endDate}
                            onChange={(e) => setDateFilter({ ...dateFilter, endDate: e.target.value })}
                            className="w-full border border-slate-300 dark:border-slate-600 rounded-lg px-3 py-2 text-slate-900 dark:text-slate-100 bg-white dark:bg-slate-700 focus:ring-2 focus:ring-indigo-500 outline-none"
                        />
                    </div>

                    {/* Selection based on report type - only show if not institution report */}
                    {reportType !== 'institution' && (
                        <div>
                            <label className="block text-sm font-semibold mb-2 text-slate-700 dark:text-slate-200">
                                {reportType === 'class' ? 'Turma' : 
                                 reportType === 'student' ? 'Aluno' : 
                                 reportType === 'test' ? 'Prova' : 
                                 reportType === 'professor' ? 'Professor' : ''}
                            </label>
                            <select
                                value={reportType === 'class' ? selectedClassId : 
                                       reportType === 'student' ? selectedStudentId : 
                                       reportType === 'test' ? selectedTestId :
                                       reportType === 'professor' ? selectedProfessorId : ''}
                                onChange={(e) => {
                                    if (reportType === 'class') setSelectedClassId(e.target.value);
                                    else if (reportType === 'student') setSelectedStudentId(e.target.value);
                                    else if (reportType === 'test') setSelectedTestId(e.target.value);
                                    else if (reportType === 'professor') setSelectedProfessorId(e.target.value);
                                }}
                                className="w-full border border-slate-300 dark:border-slate-600 rounded-lg px-3 py-2 text-slate-900 dark:text-slate-100 bg-white dark:bg-slate-700 focus:ring-2 focus:ring-indigo-500 outline-none"
                            >
                                <option value="">Selecione...</option>
                                {reportType === 'class' && classes.map(c => (
                                    <option key={c.id} value={c.id}>
                                        {c.name} - {(c.school_grades as any)?.name || ''}
                                    </option>
                                ))}
                                {reportType === 'student' && students.map(s => (
                                    <option key={s.id} value={s.id}>
                                        {s.app_users ? `${(s.app_users as any).first_name} ${(s.app_users as any).last_name}` : s.name}
                                    </option>
                                ))}
                                {reportType === 'test' && tests.map(t => (
                                    <option key={t.id} value={t.id}>
                                        {t.title}
                                    </option>
                                ))}
                                {reportType === 'professor' && professors.map(p => (
                                    <option key={p.id} value={p.id}>
                                        {p.name || `${p.app_users?.first_name || ''} ${p.app_users?.last_name || ''}`.trim()}
                                    </option>
                                ))}
                            </select>
                        </div>
                    )}
                </div>
            </div>

            {/* Error Message */}
            {error && (
                <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-4 flex items-center gap-2 text-red-800 dark:text-red-200">
                    <AlertCircle size={20} />
                    <span>{error}</span>
                </div>
            )}

            {/* Loading */}
            {loading && (
                <div className="flex items-center justify-center py-12">
                    <Loader2 className="animate-spin text-indigo-600 dark:text-indigo-400" size={32} />
                </div>
            )}

            {/* Report Content */}
            {!loading && !error && (
                <div id="report-content" className="space-y-6">
                    {reportType === 'institution' && renderInstitutionReport()}
                    {reportType === 'professor' && renderProfessorReport()}
                    {reportType === 'class' && renderClassReport()}
                    {reportType === 'student' && renderStudentReport()}
                    {reportType === 'test' && renderTestReport()}
                </div>
            )}
        </div>
    );
};

export default ReportManager;
