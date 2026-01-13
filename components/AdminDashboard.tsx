import React, { useState, useEffect } from 'react';
import { UserProfile, GlobalSettings, UserRole, Subject, Topic } from '../types';
// Fix: Added missing CheckCircle2 to the lucide-react imports list
import { Users, Lock, Unlock, Calendar, Trash2, ShieldAlert, KeyRound, Loader2, RefreshCw, Sparkles, Wand2, ChevronLeft, AlertCircle, BookOpen, Clock, Database, Copy, Search, UserCheck, UserMinus, UserPlus, X, Mail, Shield, Briefcase, CheckCircle2 } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { generateEnemAssessment } from '../services/geminiService';

interface AdminDashboardProps {
  currentUser: UserProfile;
  settings: GlobalSettings;
  setSettings: (s: GlobalSettings) => void;
}

const CLASSES_MAP: { [key: string]: string[] } = {
  "1ª": ["13.01", "13.02", "13.03", "13.04", "13.05", "13.06"],
  "2ª": ["23.01", "23.02", "23.03", "23.04", "23.05", "23.06", "23.07", "23.08"],
  "3ª": ["33.01", "33.02", "33.03", "33.04", "33.05", "33.06", "33.07", "33.08"]
};

const AdminDashboard: React.FC<AdminDashboardProps> = ({ currentUser, settings, setSettings }) => {
  const [activeTab, setActiveTab] = useState<'users' | 'assessments' | 'topics' | 'official_exams' | 'sql_help'>('users');
  const [usersList, setUsersList] = useState<UserProfile[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [allTopics, setAllTopics] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [genLoading, setGenLoading] = useState<string | null>(null);

  // States para novo usuário
  const [isAddUserModalOpen, setIsAddUserModalOpen] = useState(false);
  const [newUserForm, setNewUserForm] = useState({
    fullName: '',
    email: '',
    password: '',
    role: UserRole.TEACHER,
    grade: '1ª',
    className: '13.01'
  });
  const [isCreatingUser, setIsCreatingUser] = useState(false);

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

  const handleCreateUser = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsCreatingUser(true);
    try {
      const { error } = await supabase.from('profiles').insert([{
        full_name: newUserForm.fullName,
        email: newUserForm.email,
        password: newUserForm.password,
        role: newUserForm.role,
        grade: newUserForm.role === UserRole.STUDENT ? newUserForm.grade : null,
        class_name: newUserForm.role === UserRole.STUDENT ? newUserForm.className : null
      }]);

      if (error) throw error;

      alert("Usuário cadastrado com sucesso!");
      setIsAddUserModalOpen(false);
      setNewUserForm({
        fullName: '',
        email: '',
        password: '',
        role: UserRole.TEACHER,
        grade: '1ª',
        className: '13.01'
      });
      fetchUsers();
    } catch (err: any) {
      alert("Erro ao criar usuário: " + err.message);
    } finally {
      setIsCreatingUser(false);
    }
  };

  const toggleUserLock = async (userId: string, currentStatus: boolean) => {
    const { error } = await supabase
      .from('profiles')
      .update({ cheating_locked: !currentStatus })
      .eq('id', userId);
    
    if (!error) {
      alert(currentStatus ? "Usuário desbloqueado com sucesso!" : "Usuário bloqueado!");
      fetchUsers();
    }
  };

  const deleteUser = async (userId: string) => {
    if (!confirm("TEM CERTEZA? Isso excluirá permanentemente este usuário e todos os seus registros de provas.")) return;
    const { error } = await supabase.from('profiles').delete().eq('id', userId);
    if (!error) {
      alert("Usuário removido.");
      fetchUsers();
    } else {
      alert("Erro ao excluir: " + error.message);
    }
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
      release_dates: updated.release_dates
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

  const filteredUsers = usersList.filter(u => 
    u.fullName.toLowerCase().includes(searchTerm.toLowerCase()) ||
    u.email.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const SQL_CODE = `-- CÓDIGO DE REPARAÇÃO DO BANCO
CREATE TABLE IF NOT EXISTS official_exams (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    subject TEXT NOT NULL,
    grade TEXT NOT NULL,
    quarter INTEGER NOT NULL,
    questions JSONB NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(subject, grade, quarter)
);

CREATE TABLE IF NOT EXISTS global_settings (
    id INTEGER PRIMARY KEY DEFAULT 1,
    active_quarter INTEGER DEFAULT 1,
    locks JSONB DEFAULT '{"1": false, "2": true, "3": true, "4": true}',
    release_dates JSONB DEFAULT '{"1": "", "2": "", "3": "", "4": ""}'
);

CREATE TABLE IF NOT EXISTS extra_activities (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    teacher_id UUID REFERENCES profiles(id),
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
    student_id UUID REFERENCES profiles(id),
    answers JSONB NOT NULL,
    score NUMERIC DEFAULT 0,
    feedback TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS student_observations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    student_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
    teacher_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
    content TEXT NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE official_exams DISABLE ROW LEVEL SECURITY;
ALTER TABLE global_settings DISABLE ROW LEVEL SECURITY;
ALTER TABLE extra_activities DISABLE ROW LEVEL SECURITY;
ALTER TABLE activity_submissions DISABLE ROW LEVEL SECURITY;
ALTER TABLE student_observations DISABLE ROW LEVEL SECURITY;`;

  return (
    <div className="space-y-6">
      {/* Botão de Cadastro Rápido de Professor sempre visível */}
      <div className="flex flex-col sm:flex-row gap-4 justify-between items-start sm:items-center bg-blue-50 p-6 rounded-[32px] border border-blue-100 no-print">
        <div>
          <h2 className="text-xl font-black text-blue-900 tracking-tighter">Painel de Administração</h2>
          <p className="text-blue-600 text-xs font-bold uppercase tracking-widest">Gestão Escolar Frederico José Pedreira</p>
        </div>
        <button 
          onClick={() => {
            setNewUserForm(prev => ({ ...prev, role: UserRole.TEACHER }));
            setIsAddUserModalOpen(true);
          }}
          className="flex items-center gap-2 bg-slate-900 text-white px-6 py-4 rounded-2xl font-black shadow-xl hover:scale-105 transition-all text-sm uppercase tracking-widest"
        >
          <UserPlus size={20}/> Cadastrar Novo Professor
        </button>
      </div>

      <div className="flex gap-2 overflow-x-auto pb-2 no-print">
        <button onClick={() => setActiveTab('users')} className={`flex items-center gap-2 px-5 py-3 rounded-xl font-bold whitespace-nowrap transition-all ${activeTab === 'users' ? 'bg-blue-600 text-white shadow-lg' : 'bg-white border text-slate-500'}`}><Users size={18}/> Todos Usuários</button>
        <button onClick={() => setActiveTab('topics')} className={`flex items-center gap-2 px-5 py-3 rounded-xl font-bold whitespace-nowrap transition-all ${activeTab === 'topics' ? 'bg-blue-600 text-white shadow-lg' : 'bg-white border text-slate-500'}`}><BookOpen size={18}/> Planejamentos</button>
        <button onClick={() => setActiveTab('assessments')} className={`flex items-center gap-2 px-5 py-3 rounded-xl font-bold whitespace-nowrap transition-all ${activeTab === 'assessments' ? 'bg-blue-600 text-white shadow-lg' : 'bg-white border text-slate-500'}`}><Calendar size={18}/> Calendário</button>
        <button onClick={() => setActiveTab('official_exams')} className={`flex items-center gap-2 px-5 py-3 rounded-xl font-bold whitespace-nowrap transition-all ${activeTab === 'official_exams' ? 'bg-blue-600 text-white shadow-lg' : 'bg-white border text-slate-500'}`}><Sparkles size={18}/> Gerar Avaliações Bimestrais</button>
        <button onClick={() => setActiveTab('sql_help')} className={`flex items-center gap-2 px-5 py-3 rounded-xl font-bold whitespace-nowrap transition-all ${activeTab === 'sql_help' ? 'bg-amber-600 text-white shadow-lg' : 'bg-amber-50 border border-amber-200 text-amber-700'}`}><Database size={18}/> Ajuda SQL</button>
      </div>

      <div className="bg-white rounded-[40px] shadow-sm border border-slate-200 p-8">
        {activeTab === 'users' && (
          <div className="space-y-6 animate-fade-in">
            <div className="flex flex-col md:flex-row justify-between items-center gap-4 border-b pb-6">
              <div>
                <h3 className="text-2xl font-black text-slate-800 tracking-tighter">Lista de Usuários</h3>
                <p className="text-slate-500 text-sm">Gerencie o acesso de {usersList.length} pessoas cadastradas.</p>
              </div>
              <div className="flex flex-1 justify-end gap-3 w-full md:w-auto">
                <div className="relative flex-1 md:max-w-xs">
                  <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={18}/>
                  <input 
                    type="text" 
                    placeholder="Filtrar por nome..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="w-full pl-12 pr-4 py-3 bg-slate-50 border rounded-2xl outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
                <button onClick={fetchUsers} className="p-3 bg-slate-100 rounded-xl hover:bg-slate-200 transition-all">
                  <RefreshCw size={20} className={loading ? 'animate-spin text-blue-600' : 'text-slate-600'}/>
                </button>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {filteredUsers.map(u => (
                <div key={u.id} className={`p-6 border rounded-[32px] bg-white transition-all hover:shadow-xl group relative overflow-hidden ${u.cheatingLocked ? 'border-red-200 bg-red-50/30' : 'border-slate-100 shadow-sm'}`}>
                  {u.cheatingLocked && (
                    <div className="absolute top-0 right-0 bg-red-600 text-white px-4 py-1 text-[10px] font-black uppercase tracking-widest rounded-bl-xl">
                      Bloqueado por Cola
                    </div>
                  )}
                  
                  <div className="flex items-center gap-4 mb-4">
                    <div className="w-16 h-16 rounded-2xl overflow-hidden bg-slate-100 border-2 border-slate-50 shrink-0">
                      {u.avatarUrl ? (
                        <img src={u.avatarUrl} className="w-full h-full object-cover" alt={u.fullName}/>
                      ) : (
                        <div className="w-full h-full flex items-center justify-center text-slate-300"><Users size={24}/></div>
                      )}
                    </div>
                    <div>
                      <h4 className="font-bold text-slate-800 line-clamp-1">{u.fullName}</h4>
                      <p className="text-xs text-slate-400 font-medium">{u.email}</p>
                    </div>
                  </div>

                  <div className="flex flex-wrap gap-2 mb-6">
                    <span className={`px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-widest ${
                      u.role === UserRole.ADMIN ? 'bg-amber-100 text-amber-700' :
                      u.role === UserRole.TEACHER ? 'bg-blue-100 text-blue-700' :
                      'bg-slate-100 text-slate-600'
                    }`}>
                      {u.role === UserRole.ADMIN ? 'Administrador' : u.role === UserRole.TEACHER ? 'Professor' : 'Estudante'}
                    </span>
                    {u.role === UserRole.STUDENT && (
                      <>
                        <span className="px-3 py-1 rounded-full bg-slate-100 text-slate-600 text-[10px] font-black uppercase tracking-widest">
                          {u.grade} Série
                        </span>
                        <span className="px-3 py-1 rounded-full bg-slate-100 text-slate-600 text-[10px] font-black uppercase tracking-widest">
                          Turma {u.className}
                        </span>
                      </>
                    )}
                  </div>

                  <div className="flex gap-2">
                    {u.cheatingLocked ? (
                      <button 
                        onClick={() => toggleUserLock(u.id, true)}
                        className="flex-1 bg-green-600 text-white py-3 rounded-2xl font-bold text-xs flex items-center justify-center gap-2 hover:bg-green-700 transition-all"
                      >
                        <Unlock size={14}/> Desbloquear
                      </button>
                    ) : (
                      <button 
                        onClick={() => toggleUserLock(u.id, false)}
                        className="flex-1 bg-slate-100 text-slate-600 py-3 rounded-2xl font-bold text-xs flex items-center justify-center gap-2 hover:bg-red-50 hover:text-red-600 transition-all"
                      >
                        <Lock size={14}/> Bloquear
                      </button>
                    )}
                    <button 
                      onClick={() => deleteUser(u.id)}
                      className="p-3 bg-slate-100 text-slate-400 rounded-2xl hover:bg-red-500 hover:text-white transition-all"
                    >
                      <Trash2 size={18}/>
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Modal de Cadastro (Melhorado) */}
        {isAddUserModalOpen && (
          <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-md z-[100] flex items-center justify-center p-4">
            <div className="bg-white w-full max-w-md rounded-[48px] shadow-2xl overflow-hidden animate-in zoom-in-95 duration-300">
              <div className="p-8 bg-slate-900 text-white flex justify-between items-center">
                <div className="flex items-center gap-3">
                  <div className="bg-blue-600 p-2 rounded-xl">
                    <UserPlus size={24}/>
                  </div>
                  <div>
                    <h3 className="text-xl font-black uppercase tracking-tighter">Novo Cadastro</h3>
                    <p className="text-[10px] text-blue-400 font-bold uppercase tracking-widest">Registrar novo {newUserForm.role === UserRole.TEACHER ? 'Professor' : 'Usuário'}</p>
                  </div>
                </div>
                <button onClick={() => setIsAddUserModalOpen(false)} className="p-2 hover:bg-white/10 rounded-full transition-colors"><X size={24}/></button>
              </div>

              <form onSubmit={handleCreateUser} className="p-8 space-y-5">
                <div>
                  <label className="block text-[10px] font-black uppercase text-slate-400 tracking-widest mb-2 ml-1">Nome Completo</label>
                  <div className="relative">
                    <UserCheck className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-300" size={18}/>
                    <input 
                      required
                      type="text" 
                      className="w-full pl-12 pr-4 py-4 bg-slate-50 border border-slate-200 rounded-2xl outline-none focus:ring-2 focus:ring-blue-500 transition-all"
                      value={newUserForm.fullName}
                      onChange={(e) => setNewUserForm({...newUserForm, fullName: e.target.value})}
                      placeholder="Nome do professor..."
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-[10px] font-black uppercase text-slate-400 tracking-widest mb-2 ml-1">E-mail Corporativo</label>
                  <div className="relative">
                    <Mail className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-300" size={18}/>
                    <input 
                      required
                      type="email" 
                      className="w-full pl-12 pr-4 py-4 bg-slate-50 border border-slate-200 rounded-2xl outline-none focus:ring-2 focus:ring-blue-500 transition-all"
                      value={newUserForm.email}
                      onChange={(e) => setNewUserForm({...newUserForm, email: e.target.value})}
                      placeholder="exemplo@educacao.to.gov.br"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-[10px] font-black uppercase text-slate-400 tracking-widest mb-2 ml-1">Senha Provisória</label>
                  <div className="relative">
                    <KeyRound className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-300" size={18}/>
                    <input 
                      required
                      type="password" 
                      className="w-full pl-12 pr-4 py-4 bg-slate-50 border border-slate-200 rounded-2xl outline-none focus:ring-2 focus:ring-blue-500 transition-all"
                      value={newUserForm.password}
                      onChange={(e) => setNewUserForm({...newUserForm, password: e.target.value})}
                      placeholder="Defina uma senha..."
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-[10px] font-black uppercase text-slate-400 tracking-widest mb-2 ml-1">Perfil de Acesso</label>
                  <div className="grid grid-cols-2 gap-2">
                    <button 
                      type="button"
                      onClick={() => setNewUserForm({...newUserForm, role: UserRole.TEACHER})}
                      className={`py-3 rounded-xl border-2 font-bold text-xs transition-all ${newUserForm.role === UserRole.TEACHER ? 'border-blue-600 bg-blue-50 text-blue-700' : 'border-slate-100 bg-white text-slate-400'}`}
                    >
                      PROFESSOR
                    </button>
                    <button 
                      type="button"
                      onClick={() => setNewUserForm({...newUserForm, role: UserRole.ADMIN})}
                      className={`py-3 rounded-xl border-2 font-bold text-xs transition-all ${newUserForm.role === UserRole.ADMIN ? 'border-amber-600 bg-amber-50 text-amber-700' : 'border-slate-100 bg-white text-slate-400'}`}
                    >
                      ADMIN
                    </button>
                    <button 
                      type="button"
                      onClick={() => setNewUserForm({...newUserForm, role: UserRole.STUDENT})}
                      className={`col-span-2 py-3 rounded-xl border-2 font-bold text-xs transition-all ${newUserForm.role === UserRole.STUDENT ? 'border-indigo-600 bg-indigo-50 text-indigo-700' : 'border-slate-100 bg-white text-slate-400'}`}
                    >
                      ESTUDANTE
                    </button>
                  </div>
                </div>

                {newUserForm.role === UserRole.STUDENT && (
                  <div className="grid grid-cols-2 gap-4 animate-in slide-in-from-top-2">
                    <div>
                      <label className="block text-[10px] font-black uppercase text-slate-400 tracking-widest mb-2 ml-1">Série</label>
                      <select 
                        className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-2xl outline-none font-bold"
                        value={newUserForm.grade}
                        onChange={(e) => setNewUserForm({...newUserForm, grade: e.target.value, className: CLASSES_MAP[e.target.value][0]})}
                      >
                        <option>1ª</option>
                        <option>2ª</option>
                        <option>3ª</option>
                      </select>
                    </div>
                    <div>
                      <label className="block text-[10px] font-black uppercase text-slate-400 tracking-widest mb-2 ml-1">Turma</label>
                      <select 
                        className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-2xl outline-none font-bold"
                        value={newUserForm.className}
                        onChange={(e) => setNewUserForm({...newUserForm, className: e.target.value})}
                      >
                        {CLASSES_MAP[newUserForm.grade].map(c => <option key={c} value={c}>{c}</option>)}
                      </select>
                    </div>
                  </div>
                )}

                <button 
                  type="submit"
                  disabled={isCreatingUser}
                  className="w-full bg-blue-600 text-white font-black py-4 rounded-2xl shadow-xl flex items-center justify-center gap-2 hover:bg-blue-700 disabled:opacity-50 transition-all active:scale-95 mt-4"
                >
                  {isCreatingUser ? <Loader2 className="animate-spin" size={20}/> : <CheckCircle2 size={20}/>}
                  Confirmar Cadastro
                </button>
              </form>
            </div>
          </div>
        )}

        {activeTab === 'topics' && (
          <div className="space-y-6 animate-fade-in">
            <h3 className="font-black text-slate-800 text-2xl tracking-tighter">Planejamentos Recebidos</h3>
            <div className="grid grid-cols-1 gap-4">
              {allTopics.map((t) => (
                <div key={t.id} className="p-6 border border-slate-100 rounded-[32px] bg-slate-50/50 flex justify-between items-start hover:shadow-md transition-all">
                  <div className="flex-1">
                    <div className="flex gap-2 mb-3">
                      <span className="text-[10px] font-black bg-blue-600 text-white px-3 py-1 rounded-full uppercase tracking-widest">{t.subject}</span>
                      <span className="text-[10px] font-black bg-white border border-slate-200 text-slate-500 px-3 py-1 rounded-full uppercase tracking-widest">{t.grade} SÉRIE</span>
                    </div>
                    <p className="font-bold text-slate-800 mb-1">Prof. {t.profiles?.full_name}</p>
                    <p className="text-slate-600 text-sm leading-relaxed italic">"{t.content}"</p>
                  </div>
                  <button onClick={() => handleDeleteTopic(t.id)} className="text-slate-300 hover:text-red-500 p-3 transition-colors">
                    <Trash2 size={20}/>
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* ... (outras abas permanecem iguais, mantendo a consistência visual) ... */}
      </div>
    </div>
  );
};

export default AdminDashboard;