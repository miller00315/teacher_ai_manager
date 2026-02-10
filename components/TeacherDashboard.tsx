
import React, { useState, useEffect } from 'react';
import { Users, FileText, FileQuestion, Send, ScanLine, ClipboardList, Bot, GraduationCap, BookOpen, Loader2 } from 'lucide-react';
import { View } from '../types';
import { getSupabaseClient } from '../services/supabaseService';

interface TeacherDashboardProps {
    onNavigate: (view: View) => void;
    onViewClass?: (classId: string) => void;
    onViewStudent?: (studentId: string) => void;
    onViewTest?: (testId: string) => void;
}

interface Stats {
    classes: number;
    students: number;
    tests: number;
    pendingResults: number;
}

const TeacherDashboard: React.FC<TeacherDashboardProps> = ({ onNavigate }) => {
    const [stats, setStats] = useState<Stats>({ classes: 0, students: 0, tests: 0, pendingResults: 0 });
    const [loading, setLoading] = useState(true);
    const [professorName, setProfessorName] = useState('Professor');

    const supabase = getSupabaseClient();

    useEffect(() => {
        const fetchStats = async () => {
            if (!supabase) return;
            try {
                const { data: { user } } = await supabase.auth.getUser();
                if (!user) return;

                const { data: appUser } = await supabase
                    .from('app_users')
                    .select('id, first_name')
                    .eq('auth_id', user.id)
                    .single();

                if (appUser) {
                    setProfessorName(appUser.first_name || 'Professor');

                    const { data: prof } = await supabase
                        .from('professors')
                        .select('id')
                        .eq('user_id', appUser.id)
                        .single();

                    if (prof) {
                        // Count classes
                        const { count: classCount } = await supabase
                            .from('class_professors')
                            .select('*', { count: 'exact', head: true })
                            .eq('professor_id', prof.id);

                        // Count tests
                        const { count: testCount } = await supabase
                            .from('tests')
                            .select('*', { count: 'exact', head: true })
                            .eq('professor_id', prof.id)
                            .eq('deleted', false);

                        // Count pending releases (active)
                        const { count: pendingCount } = await supabase
                            .from('test_releases')
                            .select('*', { count: 'exact', head: true })
                            .eq('professor_id', prof.id)
                            .gte('end_time', new Date().toISOString());

                        // Count students from assigned classes
                        const { data: classIds } = await supabase
                            .from('class_professors')
                            .select('class_id')
                            .eq('professor_id', prof.id);

                        let studentCount = 0;
                        if (classIds && classIds.length > 0) {
                            const classIdArray = classIds.map(c => c.class_id).filter(Boolean);
                            if (classIdArray.length > 0) {
                                const { count } = await supabase
                                    .from('students')
                                    .select('*', { count: 'exact', head: true })
                                    .in('class_id', classIdArray)
                                    .eq('deleted', false);
                                studentCount = count || 0;
                            }
                        }

                        setStats({
                            classes: classCount || 0,
                            students: studentCount,
                            tests: testCount || 0,
                            pendingResults: pendingCount || 0
                        });
                    }
                }
            } catch (e) {
                console.error('Error fetching teacher stats:', e);
            } finally {
                setLoading(false);
            }
        };

        fetchStats();
    }, [supabase]);

    const shortcuts = [
        { 
            label: 'Minhas Turmas', 
            icon: Users, 
            desc: 'Ver alunos e turmas', 
            view: 'classes' as View,
            color: 'bg-blue-500',
            stat: stats.classes,
            statLabel: 'turmas'
        },
        { 
            label: 'Meus Alunos', 
            icon: GraduationCap, 
            desc: 'Fichas e histórico', 
            view: 'students' as View,
            color: 'bg-indigo-500',
            stat: stats.students,
            statLabel: 'alunos'
        },
        { 
            label: 'Banco de Questões', 
            icon: FileQuestion, 
            desc: 'Criar e gerenciar questões', 
            view: 'questions' as View,
            color: 'bg-emerald-600'
        },
        { 
            label: 'Minhas Provas', 
            icon: FileText, 
            desc: 'Criar e editar provas', 
            view: 'tests' as View,
            color: 'bg-violet-500',
            stat: stats.tests,
            statLabel: 'provas'
        },
        { 
            label: 'Atribuir Provas', 
            icon: Send, 
            desc: 'Agendar e liberar provas', 
            view: 'releases' as View,
            color: 'bg-amber-500',
            stat: stats.pendingResults,
            statLabel: 'ativas'
        },
        { 
            label: 'Corrigir Provas', 
            icon: ScanLine, 
            desc: 'Correção via OCR/IA', 
            view: 'grading' as View,
            color: 'bg-pink-500'
        },
        { 
            label: 'Resultados', 
            icon: ClipboardList, 
            desc: 'Histórico e análises', 
            view: 'results' as View,
            color: 'bg-cyan-600'
        },
        { 
            label: 'Agentes IA', 
            icon: Bot, 
            desc: 'Tutores e assistentes', 
            view: 'agents' as View,
            color: 'bg-slate-600'
        }
    ];

    return (
        <div className="max-w-6xl mx-auto space-y-8 animate-in fade-in slide-in-from-bottom-4">
            {/* Hero Section */}
            <div className="bg-gradient-to-r from-emerald-600 to-teal-700 rounded-2xl p-8 text-white shadow-xl relative overflow-hidden">
                <div className="relative z-10">
                    <h1 className="text-3xl font-bold mb-2">Olá, {professorName}!</h1>
                    <p className="text-emerald-100 max-w-lg">
                        Bem-vindo ao seu espaço de trabalho. Gerencie suas turmas, crie avaliações e acompanhe o desempenho dos seus alunos.
                    </p>
                </div>
                <div className="absolute right-0 bottom-0 opacity-10 pointer-events-none">
                    <BookOpen size={200} className="transform translate-x-10 translate-y-10"/>
                </div>

                {/* Quick Stats */}
                {!loading && (
                    <div className="flex gap-6 mt-6 relative z-10">
                        <div className="bg-white/10 backdrop-blur rounded-xl px-4 py-2">
                            <div className="text-2xl font-bold">{stats.classes}</div>
                            <div className="text-xs text-emerald-200">Turmas</div>
                        </div>
                        <div className="bg-white/10 backdrop-blur rounded-xl px-4 py-2">
                            <div className="text-2xl font-bold">{stats.students}</div>
                            <div className="text-xs text-emerald-200">Alunos</div>
                        </div>
                        <div className="bg-white/10 backdrop-blur rounded-xl px-4 py-2">
                            <div className="text-2xl font-bold">{stats.tests}</div>
                            <div className="text-xs text-emerald-200">Provas</div>
                        </div>
                        <div className="bg-white/10 backdrop-blur rounded-xl px-4 py-2">
                            <div className="text-2xl font-bold">{stats.pendingResults}</div>
                            <div className="text-xs text-emerald-200">Ativas</div>
                        </div>
                    </div>
                )}

                {loading && (
                    <div className="flex items-center gap-2 mt-6 text-emerald-200">
                        <Loader2 className="animate-spin" size={16}/>
                        <span className="text-sm">Carregando estatísticas...</span>
                    </div>
                )}
            </div>

            {/* Quick Actions */}
            <div>
                <h3 className="text-lg font-bold text-slate-800 dark:text-slate-100 mb-4">Acesso Rápido</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                    {shortcuts.map((s, idx) => (
                        <button 
                            key={idx}
                            onClick={() => onNavigate(s.view)}
                            className="bg-white dark:bg-slate-800 p-5 rounded-xl border border-slate-200 dark:border-slate-700 shadow-sm hover:shadow-lg transition-all flex flex-col text-left group hover:border-emerald-300 dark:hover:border-emerald-600 hover:-translate-y-1"
                        >
                            <div className="flex items-center justify-between mb-3">
                                <div className={`w-12 h-12 rounded-xl ${s.color} flex items-center justify-center text-white shadow-md group-hover:scale-110 transition-transform`}>
                                    <s.icon size={24} />
                                </div>
                                {s.stat !== undefined && (
                                    <div className="text-right">
                                        {loading ? (
                                            <Loader2 className="animate-spin text-slate-400 dark:text-slate-500" size={24}/>
                                        ) : (
                                            <>
                                                <div className="text-2xl font-bold text-slate-800 dark:text-slate-100">{s.stat}</div>
                                                <div className="text-xs text-slate-400 dark:text-slate-500">{s.statLabel}</div>
                                            </>
                                        )}
                                    </div>
                                )}
                            </div>
                            <h4 className="font-bold text-slate-800 dark:text-slate-100 group-hover:text-emerald-700 dark:group-hover:text-emerald-400 transition-colors">{s.label}</h4>
                            <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">{s.desc}</p>
                        </button>
                    ))}
                </div>
            </div>

            {/* Additional Info Cards */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <div className="bg-gradient-to-br from-violet-50 to-indigo-50 dark:from-violet-900/20 dark:to-indigo-900/20 p-6 rounded-xl border border-violet-200 dark:border-violet-800">
                    <div className="flex items-center gap-4 mb-4">
                        <div className="w-12 h-12 rounded-xl bg-violet-500 dark:bg-violet-600 flex items-center justify-center text-white">
                            <FileText size={24}/>
                        </div>
                        <div>
                            <h4 className="font-bold text-slate-800 dark:text-slate-100">Criar Nova Prova</h4>
                            <p className="text-sm text-slate-500 dark:text-slate-400">Monte uma avaliação rapidamente</p>
                        </div>
                    </div>
                    <button 
                        onClick={() => onNavigate('tests')}
                        className="w-full bg-violet-600 dark:bg-violet-700 hover:bg-violet-700 dark:hover:bg-violet-600 text-white font-bold py-3 rounded-lg transition-colors"
                    >
                        Começar Agora →
                    </button>
                </div>

                <div className="bg-gradient-to-br from-amber-50 to-orange-50 dark:from-amber-900/20 dark:to-orange-900/20 p-6 rounded-xl border border-amber-200 dark:border-amber-800">
                    <div className="flex items-center gap-4 mb-4">
                        <div className="w-12 h-12 rounded-xl bg-amber-500 dark:bg-amber-600 flex items-center justify-center text-white">
                            <Send size={24}/>
                        </div>
                        <div>
                            <h4 className="font-bold text-slate-800 dark:text-slate-100">Liberar Prova</h4>
                            <p className="text-sm text-slate-500 dark:text-slate-400">Agende uma avaliação para seus alunos</p>
                        </div>
                    </div>
                    <button 
                        onClick={() => onNavigate('releases')}
                        className="w-full bg-amber-600 dark:bg-amber-700 hover:bg-amber-700 dark:hover:bg-amber-600 text-white font-bold py-3 rounded-lg transition-colors"
                    >
                        Agendar Prova →
                    </button>
                </div>
            </div>
        </div>
    );
};

export default TeacherDashboard;

