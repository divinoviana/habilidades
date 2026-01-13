
import React, { useState, useEffect } from 'react';
import { UserProfile, GlobalSettings, UserRole, Subject, Topic } from '../types';
import { Users, Lock, Unlock, Calendar, Trash2, ShieldAlert, KeyRound, Loader2, RefreshCw, Sparkles, Wand2, ChevronLeft, AlertCircle, BookOpen, Clock, Database, Copy, Search, UserCheck, UserMinus, UserPlus, X, Mail, Shield, Briefcase, CheckCircle2 } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { generateEnemAssessment } from '../services/geminiService';

interface AdminDashboardProps {
  currentUser: UserProfile;
  settings: GlobalSettings;
  setSettings: (s: GlobalSettings) => void;
}

const AdminDashboard: React.FC<AdminDashboardProps> = ({ currentUser, settings, setSettings }) => {
  const [activeTab, setActiveTab] = useState<'users' | 'assessments' | 'topics' | 'official_exams' | 'sql_help'>('users');
  const [usersList, setUsersList] = useState<UserProfile[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [loading, setLoading] = useState(false);
  const [genLoading, setGenLoading] = useState<string | null>(null);

  useEffect(() => {
    fetchUsers();
    fetchSettings();
  }, []);

  const fetchUsers = async () => {
    setLoading(true);
    const { data } = await supabase.from('profiles').select('*').order('full_name');
    if (data) {
      setUsersList(data.map(u => ({
        id: u.id,
        email: u.email || '',
        fullName: u.full_name || 'Sem Nome',
        role: u.role as UserRole,
        grade: u.grade,
        className: u.class_name,
        avatarUrl: u.avatar_url,
        cheatingLocked: u.cheating_locked
      })));
    }
    setLoading(false);
  };

  const fetchSettings = async () => {
    const { data } = await supabase.from('global_settings').select('*').maybeSingle();
    if (data) {
      setSettings({
        activeQuarter: data.active_quarter,
        isAssessmentLocked: data.locks || { 1: false, 2: true, 3: true, 4: true },
        releaseDates: data.release_dates || { 1: '', 2: '', 3: '', 4: '' }
      });
    }
  };

  const updateGlobalSettings = async (newSettings: Partial<GlobalSettings>) => {
    const updated = { ...settings, ...newSettings };
    await supabase.from('global_settings').upsert({
      id: 1,
      active_quarter: updated.activeQuarter,
      locks: updated.isAssessmentLocked,
      release_dates: updated.releaseDates
    });
    setSettings(updated as GlobalSettings);
  };

  const generateBimonthlyExam = async (subject: Subject, grade: string) => {
    const loaderKey = `${subject}-${grade}`;
    setGenLoading(loaderKey);
    try {
      const { data: topics } = await supabase.from('topics').select('content').eq('subject', subject).eq('grade', grade).eq('quarter', settings.activeQuarter).order('created_at', { ascending: false }).limit(1).maybeSingle();
      if (!topics) { alert(`Sem planejamento para ${subject} - ${grade}.`); return; }
      const questions = await generateEnemAssessment(subject, topics.content, grade);
      await supabase.from('official_exams').upsert({ subject, grade, quarter: settings.activeQuarter, questions }, { onConflict: 'subject,grade,quarter' });
      alert(`Prova Oficial Gerada com Sucesso!`);
    } catch (err: any) { alert(err.message); } finally { setGenLoading(null); }
  };

  const SQL_CODE = `-- SCRIPT COMPLETO DE REPARAÇÃO - ESCOLA FREDERICO
CREATE TABLE IF NOT EXISTS profiles (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    email TEXT UNIQUE NOT NULL,
    password TEXT NOT NULL,
    full_name TEXT NOT NULL,
    role TEXT NOT NULL DEFAULT 'student',
    grade TEXT,
    class_name TEXT,
    phone TEXT,
    avatar_url TEXT,
    cheating_locked BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS topics (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    teacher_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
    subject TEXT NOT NULL,
    grade TEXT NOT NULL,
    quarter INTEGER NOT NULL,
    content TEXT NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS official_exams (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    subject TEXT NOT NULL,
    grade TEXT NOT NULL,
    quarter INTEGER NOT NULL,
    questions JSONB NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(subject, grade, quarter)
);

CREATE TABLE IF NOT EXISTS assessments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    student_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
    subject TEXT NOT NULL,
    quarter INTEGER NOT NULL,
    grade TEXT,
    questions JSONB NOT NULL,
    answers JSONB,
    score NUMERIC(4,2),
    is_mock BOOLEAN DEFAULT FALSE,
    feedback TEXT,
    cheating_attempts INTEGER DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS extra_activities (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    teacher_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
    subject TEXT NOT NULL,
    grade TEXT NOT NULL,
    class_name TEXT,
    theme TEXT NOT NULL,
    questions JSONB NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS activity_submissions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    activity_id UUID REFERENCES extra_activities(id) ON DELETE CASCADE,
    student_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
    answers JSONB NOT NULL,
    score NUMERIC(4,2),
    feedback TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS student_observations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    student_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
    teacher_id UUID REFERENCES profiles(id),
    content TEXT NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS global_settings (
    id INTEGER PRIMARY KEY DEFAULT 1,
    active_quarter INTEGER DEFAULT 1,
    locks JSONB DEFAULT '{"1": false, "2": true, "3": true, "4": true}',
    release_dates JSONB DEFAULT '{"1": "", "2": "", "3": "", "4": ""}'
);

INSERT INTO global_settings (id, active_quarter) VALUES (1, 1) ON CONFLICT DO NOTHING;

-- DESATIVAR RLS PARA TESTES (OPCIONAL)
ALTER TABLE profiles DISABLE ROW LEVEL SECURITY;
ALTER TABLE topics DISABLE ROW LEVEL SECURITY;
ALTER TABLE official_exams DISABLE ROW LEVEL SECURITY;
ALTER TABLE assessments DISABLE ROW LEVEL SECURITY;
ALTER TABLE extra_activities DISABLE ROW LEVEL SECURITY;
ALTER TABLE activity_submissions DISABLE ROW LEVEL SECURITY;
ALTER TABLE student_observations DISABLE ROW LEVEL SECURITY;
ALTER TABLE global_settings DISABLE ROW LEVEL SECURITY;`;

  const filteredUsers = usersList.filter(u => u.fullName.toLowerCase().includes(searchTerm.toLowerCase()));

  return (
    <div className="space-y-6">
      <div className="bg-blue-600 p-8 rounded-[40px] text-white flex justify-between items-center shadow-xl no-print">
        <h2 className="text-3xl font-black tracking-tighter">Administração Central</h2>
        <div className="flex gap-4">
           <div className="bg-white/20 px-6 py-4 rounded-2xl">
              <p className="text-[10px] font-black uppercase">Bimestre Ativo</p>
              <select className="bg-transparent font-black text-xl outline-none" value={settings.activeQuarter} onChange={(e) => updateGlobalSettings({ activeQuarter: parseInt(e.target.value) })}>
                {[1,2,3,4].map(n => <option key={n} value={n} className="text-slate-900">{n}º Bimestre</option>)}
              </select>
           </div>
        </div>
      </div>

      <div className="flex gap-2 overflow-x-auto pb-2 no-print">
        <button onClick={() => setActiveTab('users')} className={`px-6 py-3 rounded-xl font-bold ${activeTab === 'users' ? 'bg-blue-600 text-white shadow-lg' : 'bg-white border text-slate-500'}`}>Usuários</button>
        <button onClick={() => setActiveTab('official_exams')} className={`px-6 py-3 rounded-xl font-bold ${activeTab === 'official_exams' ? 'bg-blue-600 text-white shadow-lg' : 'bg-white border text-slate-500'}`}>Gerar Provas Oficiais</button>
        <button onClick={() => setActiveTab('sql_help')} className={`px-6 py-3 rounded-xl font-bold ${activeTab === 'sql_help' ? 'bg-amber-600 text-white shadow-lg' : 'bg-white border text-slate-500'}`}>Reparar SQL</button>
      </div>

      <div className="bg-white rounded-[40px] shadow-sm border border-slate-200 p-8">
        {activeTab === 'users' && (
          <div className="space-y-6">
            <input type="text" placeholder="Pesquisar..." value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} className="w-full p-4 bg-slate-50 border rounded-2xl outline-none"/>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              {filteredUsers.map(u => (
                <div key={u.id} className="p-6 border rounded-3xl bg-white space-y-4">
                  <div className="flex items-center gap-4">
                    <div className="w-10 h-10 bg-slate-100 rounded-full flex items-center justify-center font-black">{u.fullName[0]}</div>
                    <div><h4 className="font-bold text-slate-800">{u.fullName}</h4><p className="text-[10px] uppercase font-black text-slate-400">{u.role}</p></div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {activeTab === 'official_exams' && (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            {['História', 'Filosofia', 'Geografia', 'Sociologia'].map(subj => (
              <div key={subj} className="p-8 border rounded-[40px] bg-slate-50/50 space-y-4">
                <h4 className="font-black text-slate-400 text-xs uppercase tracking-widest">{subj}</h4>
                {['1ª', '2ª', '3ª'].map(grade => (
                  <button key={grade} onClick={() => generateBimonthlyExam(subj as Subject, grade)} disabled={!!genLoading} className="w-full flex justify-between items-center p-4 bg-white border rounded-3xl font-bold text-sm hover:border-blue-500">
                    {grade} Série {genLoading === `${subj}-${grade}` ? <Loader2 size={16} className="animate-spin"/> : <Sparkles size={16} className="text-blue-500"/>}
                  </button>
                ))}
              </div>
            ))}
          </div>
        )}

        {activeTab === 'sql_help' && (
          <div className="space-y-6">
            <div className="bg-amber-50 border border-amber-200 p-6 rounded-2xl text-amber-800"><p className="font-bold">Script de Criação/Reparação</p><p className="text-sm">Copie e execute no menu SQL Editor do Supabase.</p></div>
            <pre className="bg-slate-900 text-slate-100 p-6 rounded-2xl overflow-x-auto text-xs font-mono">{SQL_CODE}</pre>
            <button onClick={() => { navigator.clipboard.writeText(SQL_CODE); alert("Copiado!"); }} className="w-full bg-slate-800 text-white py-4 rounded-2xl font-black flex justify-center items-center gap-2"><Copy size={18}/> COPIAR SCRIPT</button>
          </div>
        )}
      </div>
    </div>
  );
};

export default AdminDashboard;
