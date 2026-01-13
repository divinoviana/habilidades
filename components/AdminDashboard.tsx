
import React, { useState, useEffect } from 'react';
import { UserProfile, GlobalSettings, UserRole, Subject, Topic } from '../types';
import { Users, Lock, Unlock, Calendar, Trash2, ShieldAlert, KeyRound, Loader2, RefreshCw, Sparkles, Wand2, ChevronLeft, AlertCircle, BookOpen, Clock, Database, Copy } from 'lucide-react';
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
  const [allTopics, setAllTopics] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [genLoading, setGenLoading] = useState<string | null>(null);

  useEffect(() => {
    fetchUsers();
    fetchSettings();
    fetchAllTopics();
  }, []);

  const fetchUsers = async () => {
    setLoading(true);
    const { data } = await supabase.from('profiles').select('*').order('full_name');
    if (data) {
      setUsersList(data.map(u => ({
        id: u.id,
        email: u.email,
        fullName: u.full_name,
        role: u.role as UserRole,
        grade: u.grade,
        className: u.class_name,
        avatarUrl: u.avatar_url,
        cheatingLocked: u.cheating_locked
      })));
    }
    setLoading(false);
  };

  const fetchAllTopics = async () => {
    const { data } = await supabase
      .from('topics')
      .select('*, profiles(full_name)')
      .order('created_at', { ascending: false });
    if (data) setAllTopics(data);
  };

  const fetchSettings = async () => {
    try {
      const { data } = await supabase.from('global_settings').select('*').maybeSingle();
      if (data) {
        setSettings({
          activeQuarter: data.active_quarter,
          isAssessmentLocked: data.locks || { 1: false, 2: true, 3: true, 4: true },
          releaseDates: data.release_dates || { 1: '', 2: '', 3: '', 4: '' }
        });
      }
    } catch (e) {
      console.error("Erro ao carregar configurações globais.");
    }
  };

  const handleDeleteTopic = async (topicId: string) => {
    if (!confirm("Deseja realmente excluir este planejamento?")) return;
    const { error } = await supabase.from('topics').delete().eq('id', topicId);
    if (!error) {
      alert("Planejamento excluído!");
      fetchAllTopics();
    }
  };

  const updateGlobalSettings = async (newSettings: Partial<GlobalSettings>) => {
    setLoading(true);
    const updated = { ...settings, ...newSettings };
    const { error } = await supabase.from('global_settings').upsert({
      id: 1,
      active_quarter: updated.activeQuarter,
      locks: updated.isAssessmentLocked,
      release_dates: updated.releaseDates
    });
    
    if (!error) {
      setSettings(updated as GlobalSettings);
      alert("Configurações atualizadas!");
    } else {
      alert("Erro ao salvar configurações. Use a aba Ajuda SQL.");
    }
    setLoading(false);
  };

  const generateBimonthlyExam = async (subject: Subject, grade: string) => {
    const loaderKey = `${subject}-${grade}`;
    setGenLoading(loaderKey);
    try {
      const { data: topics } = await supabase
        .from('topics')
        .select('content')
        .eq('subject', subject)
        .eq('grade', grade)
        .eq('quarter', settings.activeQuarter)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();

      if (!topics) {
        alert(`Não existe planejamento para ${subject} (${grade} série).`);
        return;
      }

      const questions = await generateEnemAssessment(subject, topics.content, grade);
      const { error } = await supabase.from('official_exams').upsert({
        subject, grade, quarter: settings.activeQuarter, questions
      }, { onConflict: 'subject,grade,quarter' });

      if (error) throw error;
      alert(`Prova pronta!`);
    } catch (err: any) {
      alert(err.message);
    } finally {
      setGenLoading(null);
    }
  };

  const SQL_CODE = `-- 1. Tabela de Provas Oficiais
CREATE TABLE IF NOT EXISTS official_exams (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    subject TEXT NOT NULL,
    grade TEXT NOT NULL,
    quarter INTEGER NOT NULL,
    questions JSONB NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(subject, grade, quarter)
);

-- 2. Tabela de Configurações Globais
CREATE TABLE IF NOT EXISTS global_settings (
    id INTEGER PRIMARY KEY DEFAULT 1,
    active_quarter INTEGER DEFAULT 1,
    locks JSONB DEFAULT '{"1": false, "2": true, "3": true, "4": true}',
    release_dates JSONB DEFAULT '{"1": "", "2": "", "3": "", "4": ""}'
);

-- 3. Tabela de Atividades Extras
CREATE TABLE IF NOT EXISTS extra_activities (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    teacher_id UUID REFERENCES profiles(id),
    subject TEXT NOT NULL,
    grade TEXT NOT NULL,
    class_name TEXT, -- Null significa todas as turmas
    theme TEXT NOT NULL,
    questions JSONB NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 4. Tabela de Submissões de Atividades
CREATE TABLE IF NOT EXISTS activity_submissions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    activity_id UUID REFERENCES extra_activities(id) ON DELETE CASCADE,
    student_id UUID REFERENCES profiles(id),
    answers JSONB NOT NULL,
    score NUMERIC DEFAULT 0,
    feedback TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE official_exams DISABLE ROW LEVEL SECURITY;
ALTER TABLE global_settings DISABLE ROW LEVEL SECURITY;
ALTER TABLE extra_activities DISABLE ROW LEVEL SECURITY;
ALTER TABLE activity_submissions DISABLE ROW LEVEL SECURITY;`;

  return (
    <div className="space-y-6">
      <div className="flex gap-2 overflow-x-auto pb-2 no-print">
        <button onClick={() => setActiveTab('users')} className={`flex items-center gap-2 px-5 py-3 rounded-xl font-bold whitespace-nowrap transition-all ${activeTab === 'users' ? 'bg-blue-600 text-white' : 'bg-white border'}`}><Users size={18}/> Usuários</button>
        <button onClick={() => setActiveTab('topics')} className={`flex items-center gap-2 px-5 py-3 rounded-xl font-bold whitespace-nowrap transition-all ${activeTab === 'topics' ? 'bg-blue-600 text-white' : 'bg-white border'}`}><BookOpen size={18}/> Planejamentos</button>
        <button onClick={() => setActiveTab('assessments')} className={`flex items-center gap-2 px-5 py-3 rounded-xl font-bold whitespace-nowrap transition-all ${activeTab === 'assessments' ? 'bg-blue-600 text-white' : 'bg-white border'}`}><Calendar size={18}/> Calendário</button>
        <button onClick={() => setActiveTab('official_exams')} className={`flex items-center gap-2 px-5 py-3 rounded-xl font-bold whitespace-nowrap transition-all ${activeTab === 'official_exams' ? 'bg-blue-600 text-white' : 'bg-white border'}`}><Sparkles size={18}/> Gerar Provas</button>
        <button onClick={() => setActiveTab('sql_help')} className={`flex items-center gap-2 px-5 py-3 rounded-xl font-bold whitespace-nowrap transition-all ${activeTab === 'sql_help' ? 'bg-amber-600 text-white' : 'bg-amber-50 border border-amber-200 text-amber-700'}`}><Database size={18}/> Ajuda SQL</button>
      </div>

      <div className="bg-white rounded-3xl shadow-sm border border-slate-200 p-8">
        {activeTab === 'sql_help' && (
          <div className="space-y-6 animate-fade-in">
            <div className="bg-amber-50 border border-amber-200 p-6 rounded-2xl flex gap-4 text-amber-800">
              <AlertCircle size={32} />
              <div>
                <h3 className="font-bold">Correção Completa do Banco</h3>
                <p className="text-xs">Copie e cole o código abaixo no SQL Editor do Supabase para habilitar Atividades Extras e as novas tabelas.</p>
              </div>
            </div>
            <div className="relative">
               <pre className="bg-slate-900 text-slate-100 p-6 rounded-2xl overflow-x-auto text-xs font-mono">{SQL_CODE}</pre>
               <button onClick={() => { navigator.clipboard.writeText(SQL_CODE); alert("Copiado!"); }} className="absolute top-4 right-4 bg-white/10 p-2 rounded-lg text-white text-[10px]"><Copy size={14}/> COPIAR SQL</button>
            </div>
          </div>
        )}

        {activeTab === 'topics' && (
          <div className="space-y-6">
            <h3 className="font-bold text-slate-800 text-2xl">Planejamentos Recebidos</h3>
            <div className="grid grid-cols-1 gap-4">
              {allTopics.map((t) => (
                <div key={t.id} className="p-5 border rounded-3xl bg-slate-50 flex justify-between items-start">
                  <div className="flex-1">
                    <div className="flex gap-2 mb-2">
                      <span className="text-[10px] font-black bg-blue-600 text-white px-2 py-1 rounded">{t.subject}</span>
                      <span className="text-[10px] font-black bg-slate-200 text-slate-600 px-2 py-1 rounded">{t.grade} SÉRIE</span>
                    </div>
                    <p className="font-bold text-slate-700">Prof. {t.profiles?.full_name}</p>
                    <p className="text-slate-500 text-sm italic">"{t.content}"</p>
                  </div>
                  <button onClick={() => handleDeleteTopic(t.id)} className="text-red-400 p-2"><Trash2 size={18}/></button>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Mantido Calendário e Gerador de Provas como antes... */}
        {activeTab === 'assessments' && (
          <div className="space-y-8 max-w-2xl mx-auto">
            <div className="text-center">
              <h3 className="text-3xl font-black text-slate-800">Controle de Bimestres</h3>
            </div>
            <div className="p-8 bg-slate-50 rounded-[40px] border space-y-8">
              <div className="grid grid-cols-4 gap-2">
                {[1, 2, 3, 4].map(q => (
                  <button key={q} onClick={() => updateGlobalSettings({ activeQuarter: q })} className={`py-4 rounded-2xl font-black border-2 ${settings.activeQuarter === q ? 'bg-blue-600 border-blue-600 text-white' : 'bg-white text-slate-400'}`}>{q}º</button>
                ))}
              </div>
              <div className="space-y-4">
                {[1, 2, 3, 4].map(q => (
                  <div key={q} className="p-5 bg-white border rounded-3xl flex justify-between items-center">
                    <p className="font-bold text-slate-700">{q}º Bimestre</p>
                    <input type="date" className="text-xs bg-slate-50 p-2 rounded-xl border-none" value={settings.releaseDates[q] || ''} onChange={(e) => updateGlobalSettings({ releaseDates: { ...settings.releaseDates, [q]: e.target.value } })} />
                    <button onClick={() => updateGlobalSettings({ isAssessmentLocked: { ...settings.isAssessmentLocked, [q]: !settings.isAssessmentLocked[q] } })} className={`px-4 py-2 rounded-xl text-[10px] font-black uppercase ${settings.isAssessmentLocked[q] ? 'bg-red-50 text-red-600' : 'bg-green-50 text-green-600'}`}>{settings.isAssessmentLocked[q] ? 'Bloqueado' : 'Aberto'}</button>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {activeTab === 'official_exams' && (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            {['História', 'Filosofia', 'Geografia', 'Sociologia'].map(subj => (
              <div key={subj} className="p-6 border rounded-3xl bg-slate-50 space-y-4">
                <h4 className="font-black uppercase text-slate-400 text-[10px] tracking-widest">{subj}</h4>
                <div className="space-y-2">
                  {['1ª', '2ª', '3ª'].map(grade => (
                    <button key={grade} onClick={() => generateBimonthlyExam(subj as Subject, grade)} disabled={!!genLoading} className="w-full flex justify-between items-center p-4 bg-white border rounded-2xl font-bold text-sm">
                      {grade} Série {genLoading === `${subj}-${grade}` ? <Loader2 size={16} className="animate-spin"/> : <Sparkles size={16}/>}
                    </button>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default AdminDashboard;
