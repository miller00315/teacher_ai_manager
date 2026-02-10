
import React, { useState } from 'react';
import Navigation from './Navigation';
import { View } from '../types';
import { Session } from '@supabase/supabase-js';
import { GraduationCap, Menu } from 'lucide-react';
import LanguageSwitcher from './LanguageSwitcher';
import ThemeSwitcher from './ThemeSwitcher';
import { useAppTranslation } from '../presentation/hooks/useAppTranslation';

// Teacher Dashboard
import TeacherDashboard from './TeacherDashboard';

// Teacher Logic
import QuestionManager from './QuestionManager';
import TestManager from './TestManager';
import TestReleaseManager from './TestReleaseManager';
import TestCorrection from './TestCorrection';
import TestResults from './TestResults';
import AIAgentManager from './AIAgentManager';
import ProfessorManager from './ProfessorManager';
import ClassManager from './ClassManager';
import GradeManager from './GradeManager';
import StudentManager from './StudentManager';

// Read-Only Viewers (Strictly separated from Managers)
import TeacherStudentViewer from './TeacherStudentViewer';
import TeacherClassViewer from './TeacherClassViewer';
import TeacherGradeViewer from './TeacherGradeViewer';
import ReportManager from './ReportManager';

interface LayoutProps {
    session: Session | null;
    isConnected: boolean;
}

const TeacherLayout: React.FC<LayoutProps> = ({ session, isConnected }) => {
    const [currentView, setCurrentView] = useState<View>('dashboard');
    const [isSidebarOpen, setIsSidebarOpen] = useState(false);
    
    // Drill-down navigation state
    const [drillDownView, setDrillDownView] = useState<'professor' | 'class' | 'grade' | 'student' | 'test' | null>(null);
    const [drillDownId, setDrillDownId] = useState<string | null>(null);
    
    const handleDrillDown = (type: 'professor' | 'class' | 'grade' | 'student' | 'test', id: string) => {
        setDrillDownView(type);
        setDrillDownId(id);
    };
    
    const handleBackFromDrillDown = () => {
        setDrillDownView(null);
        setDrillDownId(null);
    };

    const renderContent = () => {
        // Render drill-down views first
        if (drillDownView === 'professor' && drillDownId) {
            return (
                <ProfessorManager 
                    hasSupabase={isConnected}
                    initialProfessorId={drillDownId}
                    onBack={handleBackFromDrillDown}
                />
            );
        }
        if (drillDownView === 'class' && drillDownId) {
            return (
                <ClassManager 
                    hasSupabase={isConnected}
                    initialClassId={drillDownId}
                    onBack={handleBackFromDrillDown}
                />
            );
        }
        if (drillDownView === 'grade' && drillDownId) {
            return (
                <GradeManager 
                    hasSupabase={isConnected}
                    readOnly
                    initialGradeId={drillDownId}
                    onBack={handleBackFromDrillDown}
                />
            );
        }
        if (drillDownView === 'student' && drillDownId) {
            return (
                <StudentManager 
                    hasSupabase={isConnected}
                    readOnly
                    initialStudentId={drillDownId}
                    onBack={handleBackFromDrillDown}
                />
            );
        }
        if (drillDownView === 'test' && drillDownId) {
            return (
                <TestManager 
                    hasSupabase={isConnected}
                    initialTestId={drillDownId}
                    onBack={handleBackFromDrillDown}
                />
            );
        }
        
        switch (currentView) {
            case 'dashboard':
                return (
                    <TeacherDashboard 
                        onNavigate={setCurrentView}
                        onViewClass={(id) => handleDrillDown('class', id)}
                        onViewStudent={(id) => handleDrillDown('student', id)}
                        onViewTest={(id) => handleDrillDown('test', id)}
                    />
                );
            case 'classes': return <TeacherClassViewer hasSupabase={isConnected} />;
            case 'students': return <TeacherStudentViewer hasSupabase={isConnected} />;
            case 'grades': return <TeacherGradeViewer hasSupabase={isConnected} />;
            
            // Academic Tools (Write Access)
            case 'questions': return <QuestionManager hasSupabase={isConnected} />;
            case 'tests': return <TestManager hasSupabase={isConnected} />;
            case 'releases': return <TestReleaseManager hasSupabase={isConnected} />;
            case 'grading': return (
                <TestCorrection 
                    hasSupabase={isConnected}
                    onViewTest={(id) => handleDrillDown('test', id)}
                    onViewStudent={(id) => handleDrillDown('student', id)}
                />
            );
            case 'results': return <TestResults hasSupabase={isConnected} />;
            case 'agents': return <AIAgentManager hasSupabase={isConnected} />;
            case 'reports': return <ReportManager hasSupabase={isConnected} userRole="Teacher" />;
            
            default: return <div>Select a module</div>;
        }
    };

    return (
        <div className="flex h-screen bg-slate-50 dark:bg-slate-900 overflow-hidden print:overflow-visible print:h-auto print:block">
            {/* Mobile Overlay */}
            {isSidebarOpen && (
                <div 
                    className="fixed inset-0 bg-black/50 z-20 md:hidden transition-opacity"
                    onClick={() => setIsSidebarOpen(false)}
                />
            )}

            {/* Sidebar */}
            <div className={`fixed inset-y-0 left-0 z-30 w-64 transform transition-transform duration-300 ease-in-out md:relative md:translate-x-0 ${isSidebarOpen ? 'translate-x-0' : '-translate-x-full'} print:hidden`}>
                <Navigation 
                    currentView={currentView} 
                    onNavigate={setCurrentView} 
                    userEmail={session?.user?.email}
                    userRole="Teacher"
                    onClose={() => setIsSidebarOpen(false)}
                />
            </div>

            <main className="flex-1 flex flex-col min-w-0 overflow-hidden print:overflow-visible print:h-auto print:block">
                <header className="bg-white dark:bg-slate-800 border-b border-slate-200 dark:border-slate-700 px-4 py-4 md:px-8 flex justify-between items-center sticky top-0 z-10 print:hidden shrink-0">
                    <div className="flex items-center gap-3">
                        <button 
                            onClick={() => setIsSidebarOpen(true)}
                            className="p-2 -ml-2 text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-lg md:hidden"
                        >
                            <Menu size={24} />
                        </button>
                        <h1 className="text-lg md:text-xl font-bold text-slate-800 dark:text-slate-100 capitalize truncate">{currentView}</h1>
                    </div>
                    <div className="flex items-center gap-4">
                        <ThemeSwitcher variant="compact" />
                        <LanguageSwitcher variant="compact" />
                        <span className="text-sm font-medium text-slate-600 dark:text-slate-300 hidden md:inline">Docente</span>
                        <div className="w-8 h-8 rounded-full bg-emerald-600 dark:bg-emerald-700 flex items-center justify-center text-white shrink-0">
                            <GraduationCap size={14} />
                        </div>
                    </div>
                </header>
                <div className="flex-1 overflow-y-auto p-4 md:p-8 print:p-0">
                    {renderContent()}
                </div>
            </main>
        </div>
    );
};

export default TeacherLayout;
