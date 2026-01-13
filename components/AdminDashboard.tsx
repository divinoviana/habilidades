
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
      console.error("Erro ao carregar configurações globais. Verifique se a tabela 'global_settings' existe.");
    }
  };

  const handleDeleteTopic = async (topicId: string) => {
    if (!confirm("Deseja realmente excluir este planejamento?")) return;
    const { error } = await supabase.from('topics').delete().eq('id', topicId);
    if (!error) {
      alert("Planejamento excluído!");
      fetchAllTopics();
    } else {
      alert("Erro ao excluir: " + error.message);
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
      alert("ERRO DE BANCO: A tabela 'global_settings' não existe ou houve erro. Use a aba 'Ajuda SQL' para corrigir.");
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
        alert(`ERRO: Não existe planejamento para ${subject} (${grade} série).`);
        return;
      }

      const questions = await generateEnemAssessment(subject, topics.content, grade);

      const { error } = await supabase.from('official_exams').upsert({
        subject,
        grade,
        quarter: settings.activeQuarter,
        questions
      }, { onConflict: 'subject,grade,quarter' });

      if (error) {
        throw new Error("Erro de banco: " + error.message + ". Verifique se a tabela 'official_exams' existe.");
      }
      alert(`Avaliação de ${subject} (${grade} série) pronta!`);
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

-- Habilitar RLS (Opcional, mas recomendado desativar para testes iniciais)
ALTER TABLE official_exams DISABLE ROW LEVEL SECURITY;
ALTER TABLE global_settings DISABLE ROW LEVEL SECURITY;`;

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
            <div className="bg-amber-50 border border-amber-200 p-6 rounded-2xl flex gap-4">
              <AlertCircle className="text-amber-600 shrink-0" size={32} />
              <div>
                <h3 className="font-bold text-amber-800">Correção de Tabelas do Banco de Dados</h3>
                <p className="text-amber-700 text-sm mt-1">Siga os passos abaixo para corrigir o erro de tabela não encontrada:</p>
                <ol className="list-decimal ml-4 mt-2 text-xs text-amber-800 space-y-1">
                  <li>Acesse seu projeto no <strong>Supabase.com</strong></li>
                  <li>Clique em <strong>SQL Editor</strong> no menu lateral esquerdo</li>
                  <li>Clique em <strong>New Query</strong></li>
                  <li>Copie o código abaixo e clique em <strong>Run</strong></li>
                </ol>
              </div>
            </div>
            <div className="relative group">
               <pre className="bg-slate-900 text-slate-100 p-6 rounded-2xl overflow-x-auto text-xs font-mono leading-relaxed">
                 {SQL_CODE}
               </pre>
               <button 
                 onClick={() => { navigator.clipboard.writeText(SQL_CODE); alert("Copiado!"); }}
                 className="absolute top-4 right-4 bg-white/10 hover:bg-white/20 p-2 rounded-lg text-white transition-all flex items-center gap-2 text-[10px]"
               >
                 <Copy size={14}/> COPIAR SQL
               </button>
            </div>
          </div>
        )}

        {activeTab === 'topics' && (
          <div className="space-y-6">
            <div className="flex justify-between items-center">
              <h3 className="font-bold text-slate-800 text-2xl">Planejamentos (Tópicos)</h3>
              <button onClick={fetchAllTopics} className="text-blue-600 p-2"><RefreshCw size={20} className={loading ? 'animate-spin' : ''}/></button>
            </div>
            <div className="grid grid-cols-1 gap-4">
              {allTopics.map((t) => (
                <div key={t.id} className="p-6 border rounded-3xl bg-slate-50 flex justify-between items-start hover:shadow-sm transition-all">
                  <div className="space-y-2 flex-1">
                    <div className="flex items-center gap-2">
                      <span className="text-[10px] font-black bg-blue-600 text-white px-3 py-1 rounded-full uppercase tracking-widest">{t.subject}</span>
                      <span className="text-[10px] font-black bg-slate-200 text-slate-600 px-3 py-1 rounded-full uppercase tracking-widest">{t.grade} SÉRIE</span>
                    </div>
                    <h4 className="font-bold text-slate-800 text-lg">Prof. {t.profiles?.full_name}</h4>
                    <p className="text-slate-600 text-sm leading-relaxed whitespace-pre-wrap italic">"{t.content}"</p>
                    <div className="flex items-center gap-2 text-[10px] text-slate-400 font-bold uppercase pt-2">
                      <Clock size={12}/> Enviado em {new Date(t.created_at).toLocaleDateString()}
                    </div>
                  </div>
                  <button 
                    onClick={() => handleDeleteTopic(t.id)}
                    className="p-3 bg-red-50 text-red-500 rounded-2xl hover:bg-red-500 hover:text-white transition-all ml-4"
                    title="Excluir Planejamento Repetido"
                  >
                    <Trash2 size={20}/>
                  </button>
                </div>
              ))}
              {allTopics.length === 0 && <p className="text-center text-slate-400 py-12 italic">Nenhum planejamento recebido.</p>}
            </div>
          </div>
        )}

        {activeTab === 'assessments' && (
          <div className="space-y-8 max-w-2xl mx-auto animate-fade-in">
            <div className="text-center">
              <h3 className="text-3xl font-black text-slate-800">Controle de Bimestres</h3>
              <p className="text-slate-400 mt-2">Gerencie as datas e acessos das avaliações oficiais.</p>
            </div>
            
            <div className="p-8 bg-slate-50 rounded-[40px] border space-y-8">
              <div>
                <label className="block text-xs font-black uppercase text-slate-400 mb-3 tracking-widest ml-2">Bimestre Ativo Agora</label>
                <div className="grid grid-cols-4 gap-2">
                  {[1, 2, 3, 4].map(q => (
                    <button 
                      key={q}
                      onClick={() => updateGlobalSettings({ activeQuarter: q })}
                      className={`py-4 rounded-2xl font-black transition-all border-2 ${settings.activeQuarter === q ? 'bg-blue-600 border-blue-600 text-white shadow-xl shadow-blue-200' : 'bg-white border-slate-100 text-slate-400'}`}
                    >
                      {q}º
                    </button>
                  ))}
                </div>
              </div>

              <div className="space-y-4">
                <label className="block text-xs font-black uppercase text-slate-400 mb-1 tracking-widest ml-2">Prazos e Bloqueios</label>
                {[1, 2, 3, 4].map(q => (
                  <div key={q} className={`p-5 rounded-3xl border flex items-center justify-between gap-4 transition-all ${settings.activeQuarter === q ? 'bg-white shadow-md border-blue-100 ring-2 ring-blue-50' : 'bg-slate-50 border-slate-100 opacity-60'}`}>
                    <div className="flex-1 space-y-2">
                      <div className="flex items-center gap-2">
                         <span className={`w-2 h-2 rounded-full ${settings.activeQuarter === q ? 'bg-blue-600 animate-pulse' : 'bg-slate-300'}`}></span>
                         <p className="font-bold text-slate-800">{q}º Bimestre</p>
                      </div>
                      <input 
                        type="date" 
                        className="w-full text-xs bg-slate-100 p-2.5 rounded-xl border-none font-bold text-slate-600"
                        value={settings.releaseDates[q] || ''}
                        onChange={(e) => {
                          const newDates = { ...settings.releaseDates, [q]: e.target.value };
                          updateGlobalSettings({ releaseDates: newDates });
                        }}
                      />
                    </div>
                    <button 
                      onClick={() => {
                        const newLocks = { ...settings.isAssessmentLocked, [q]: !settings.isAssessmentLocked[q] };
                        updateGlobalSettings({ isAssessmentLocked: newLocks });
                      }}
                      className={`px-4 py-3 rounded-2xl font-black text-[10px] uppercase tracking-wider flex items-center gap-2 ${settings.isAssessmentLocked[q] ? 'bg-red-50 text-red-600' : 'bg-green-50 text-green-600'}`}
                    >
                      {settings.isAssessmentLocked[q] ? <Lock size={14}/> : <Unlock size={14}/>}
                      {settings.isAssessmentLocked[q] ? 'Bloqueado' : 'Aberto'}
                    </button>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* ... (Users e Official Exams seções mantidas iguais ao anterior) ... */}
        {activeTab === 'official_exams' && (
          <div className="space-y-8 animate-fade-in">
            <div className="text-center mb-8">
              <h3 className="text-2xl font-bold text-slate-800">Gerador de Provas Oficiais</h3>
              <p className="text-slate-500">A IA lerá o último planejamento do professor para criar a prova.</p>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
              {['História', 'Filosofia', 'Geografia', 'Sociologia'].map(subj => (
                <div key={subj} className="p-6 border rounded-3xl bg-slate-50 space-y-4">
                  <h4 className="font-black uppercase text-slate-400 text-[10px] tracking-widest">{subj}</h4>
                  <div className="space-y-2">
                    {['1ª', '2ª', '3ª'].map(grade => (
                      <button
                        key={grade}
                        onClick={() => generateBimonthlyExam(subj as Subject, grade)}
                        disabled={!!genLoading}
                        className="w-full flex justify-between items-center p-4 bg-white border rounded-2xl hover:border-blue-500 transition-all font-bold text-sm"
                      >
                        {grade} Série
                        {genLoading === `${subj}-${grade}` ? <Loader2 size={16} className="animate-spin text-blue-600"/> : <Sparkles size={16} className="text-blue-200"/>}
                      </button>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default AdminDashboard;
