
import React, { useState, useEffect } from 'react';
import { UserRole, UserProfile, GlobalSettings } from './types.ts';
import Login from './components/Login.tsx';
import Register from './components/Register.tsx';
import AdminDashboard from './components/AdminDashboard.tsx';
import TeacherDashboard from './components/TeacherDashboard.tsx';
import StudentDashboard from './components/StudentDashboard.tsx';
import { LogOut, GraduationCap } from 'lucide-react';

const App: React.FC = () => {
  const [currentUser, setCurrentUser] = useState<UserProfile | null>(null);
  const [isRegistering, setIsRegistering] = useState(false);
  const [settings, setSettings] = useState<GlobalSettings>({
    activeQuarter: 1,
    isAssessmentLocked: { 1: false, 2: true, 3: true, 4: true },
    releaseDates: { 1: '2024-03-20', 2: '2024-06-15', 3: '2024-09-10', 4: '2024-11-25' }
  });

  const handleLogout = () => {
    setCurrentUser(null);
    setIsRegistering(false);
  };

  if (!currentUser) {
    return isRegistering ? (
      <Register 
        onRegister={(user) => {
          setCurrentUser(user);
          setIsRegistering(false);
        }} 
        onCancel={() => setIsRegistering(false)} 
      />
    ) : (
      <Login 
        onLogin={setCurrentUser} 
        onGoToRegister={() => setIsRegistering(true)} 
      />
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col">
      <header className="bg-white border-b border-slate-200 px-6 py-4 flex justify-between items-center sticky top-0 z-50 shadow-sm">
        <div className="flex items-center gap-3">
          <div className="bg-blue-600 p-2 rounded-lg">
            <GraduationCap className="text-white w-6 h-6" />
          </div>
          <div>
            <h1 className="font-bold text-slate-800 text-lg leading-tight">EE Federico José Pedreira Neto</h1>
            <p className="text-xs text-slate-500 uppercase tracking-wider font-semibold">Ciências Humanas & Sociais</p>
          </div>
        </div>
        
        <div className="flex items-center gap-4">
          <div className="hidden md:block text-right">
            <p className="text-sm font-medium text-slate-700">{currentUser.fullName}</p>
            <p className="text-xs text-slate-400 capitalize">{currentUser.role === 'admin' ? 'Administrador' : currentUser.role === 'teacher' ? 'Professor' : `Estudante - ${currentUser.grade} ${currentUser.className}`}</p>
          </div>
          <button 
            onClick={handleLogout}
            className="flex items-center gap-2 px-3 py-2 text-slate-600 hover:text-red-600 hover:bg-red-50 rounded-full transition-all"
          >
            <LogOut size={20} />
            <span className="hidden sm:inline font-medium">Sair</span>
          </button>
        </div>
      </header>

      <main className="flex-1 p-4 md:p-8 max-w-7xl mx-auto w-full">
        {currentUser.role === UserRole.ADMIN && (
          <AdminDashboard currentUser={currentUser} settings={settings} setSettings={setSettings} />
        )}
        {currentUser.role === UserRole.TEACHER && (
          <TeacherDashboard currentUser={currentUser} settings={settings} />
        )}
        {currentUser.role === UserRole.STUDENT && (
          <StudentDashboard currentUser={currentUser} settings={settings} />
        )}
      </main>

      <footer className="bg-white border-t border-slate-200 p-4 text-center text-slate-400 text-xs">
        &copy; 2024 SEDUC - Tocantins | Escola Federico José Pedreira Neto. Desenvolvido para Excelência Educacional.
      </footer>
    </div>
  );
};

export default App;
