
import React, { useState, useEffect } from 'react';
import { UserProfile, GlobalSettings, UserRole, Subject, Topic } from '../types';
import { Users, Lock, Unlock, Calendar, Trash2, ShieldAlert, KeyRound, Loader2, RefreshCw, Sparkles, Wand2, ChevronLeft, AlertCircle, BookOpen, Clock, Database, Copy, Search, UserCheck, UserMinus, UserPlus, X, Mail, Shield } from 'lucide-react';
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
    role: 'teacher' as UserRole,
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
        grade: newUserForm.role === 'student' ? newUserForm.grade : null,
        class_name: newUserForm.role === 'student' ? newUserForm.className : null
      }]);

      if (error) throw error;

      alert("Usuário cadastrado com sucesso!");
      setIsAddUserModalOpen(false);
      setNewUserForm({
        fullName: '',
        email: '',
        password: '',
        role: 'teacher',
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
      <div className="flex gap-2 overflow-x-auto pb-2 no-print">
        <button onClick={() => setActiveTab('users')} className={`flex items-center gap-2 px-5 py-3 rounded-xl font-bold whitespace-nowrap transition-all ${activeTab === 'users' ? 'bg-blue-600 text-white shadow-lg' : 'bg-white border text-slate-500'}`}><Users size={18}/> Usuários</button>
        <button onClick={() => setActiveTab('topics')} className={`flex items-center gap-2 px-5 py-3 rounded-xl font-bold whitespace-nowrap transition-all ${activeTab === 'topics' ? 'bg-blue-600 text-white shadow-lg' : 'bg-white border text-slate-500'}`}><BookOpen size={18}/> Planejamentos</button>
        <button onClick={() => setActiveTab('assessments')} className={`flex items-center gap-2 px-5 py-3 rounded-xl font-bold whitespace-nowrap transition-all ${activeTab === 'assessments' ? 'bg-blue-600 text-white shadow-lg' : 'bg-white border text-slate-500'}`}><Calendar size={18}/> Calendário</button>
        <button onClick={() => setActiveTab('official_exams')} className={`flex items-center gap-2 px-5 py-3 rounded-xl font-bold whitespace-nowrap transition-all ${activeTab === 'official_exams' ? 'bg-blue-600 text-white shadow-lg' : 'bg-white border text-slate-500'}`}><Sparkles size={18}/> Gerar Avaliações Bimestrais</button>
        <button onClick={() => setActiveTab('sql_help')} className={`flex items-center gap-2 px-5 py-3 rounded-xl font-bold whitespace-nowrap transition-all ${activeTab === 'sql_help' ? 'bg-amber-600 text-white shadow-lg' : 'bg-amber-50 border border-amber-200 text-amber-700'}`}><Database size={18}/> Ajuda SQL</button>
      </div>

      <div className="bg-white rounded-3xl shadow-sm border border-slate-200 p-8">
        {activeTab === 'users' && (
          <div className="space-y-6 animate-fade-in">
            <div className="flex flex-col md:flex-row justify-between items-center gap-4 border-b pb-6">
              <div>
                <h3 className="text-2xl font-black text-slate-800">Gestão de Usuários</h3>
                <p className="text-slate-500 text-sm">Controle de acesso para alunos, professores e administradores.</p>
              </div>
              <div className="flex flex-1 justify-end gap-3 w-full md:w-auto">
                <div className="relative flex-1 md:max-w-xs">
                  <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={18}/>
                  <input 
                    type="text" 
                    placeholder="Buscar..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="w-full pl-12 pr-4 py-3 bg-slate-50 border rounded-2xl outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
                <button onClick={() => setIsAddUserModalOpen(true)} className="flex items-center gap-2 bg-blue-600 text-white px-5 py-3 rounded-2xl font-bold hover:bg-blue-700 transition-all shadow-lg shadow-blue-100">
                  <UserPlus size={20}/> <span className="hidden sm:inline">Novo Usuário</span>
                </button>
                <button onClick={fetchUsers} className="p-3 bg-slate-100 rounded-xl hover:bg-slate-200 transition-all">
                  <RefreshCw size={20} className={loading ? 'animate-spin text-blue-600' : 'text-slate-600'}/>
                </button>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {filteredUsers.map(u => (
                <div key={u.id} className={`p-6 border rounded-[32px] bg-white transition-all hover:shadow-xl group relative overflow-hidden ${u.cheatingLocked ? 'border-red-200 bg-red-50/30' : 'border-slate-100'}`}>
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
                      u.role === 'admin' ? 'bg-amber-100 text-amber-700' :
                      u.role === 'teacher' ? 'bg-blue-100 text-blue-700' :
                      'bg-slate-100 text-slate-600'
                    }`}>
                      {u.role === 'admin' ? 'Administrador' : u.role === 'teacher' ? 'Professor' : 'Estudante'}
                    </span>
                    {u.role === 'student' && (
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
              {filteredUsers.length === 0 && !loading && (
                <div className="col-span-full py-20 text-center">
                  <Users size={48} className="mx-auto text-slate-200 mb-4"/>
                  <p className="text-slate-400 font-medium italic">Nenhum usuário encontrado com este critério.</p>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Modal para adicionar novo usuário */}
        {isAddUserModalOpen && (
          <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-[100] flex items-center justify-center p-4">
            <div className="bg-white w-full max-w-md rounded-[40px] shadow-2xl overflow-hidden animate-in zoom-in-95 duration-300">
              <div className="p-8 bg-blue-600 text-white flex justify-between items-center">
                <div className="flex items-center gap-3">
                  <UserPlus size={24}/>
                  <h3 className="text-xl font-black uppercase tracking-tighter">Cadastrar Novo Usuário</h3>
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
                      className="w-full pl-12 pr-4 py-3 bg-slate-50 border border-slate-200 rounded-2xl outline-none focus:ring-2 focus:ring-blue-500"
                      value={newUserForm.fullName}
                      onChange={(e) => setNewUserForm({...newUserForm, fullName: e.target.value})}
                      placeholder="Ex: João da Silva"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-[10px] font-black uppercase text-slate-400 tracking-widest mb-2 ml-1">E-mail de Acesso</label>
                  <div className="relative">
                    <Mail className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-300" size={18}/>
                    <input 
                      required
                      type="email" 
                      className="w-full pl-12 pr-4 py-3 bg-slate-50 border border-slate-200 rounded-2xl outline-none focus:ring-2 focus:ring-blue-500"
                      value={newUserForm.email}
                      onChange={(e) => setNewUserForm({...newUserForm, email: e.target.value})}
                      placeholder="professor@escola.com"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-[10px] font-black uppercase text-slate-400 tracking-widest mb-2 ml-1">Senha Inicial</label>
                  <div className="relative">
                    <KeyRound className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-300" size={18}/>
                    <input 
                      required
                      type="password" 
                      className="w-full pl-12 pr-4 py-3 bg-slate-50 border border-slate-200 rounded-2xl outline-none focus:ring-2 focus:ring-blue-500"
                      value={newUserForm.password}
                      onChange={(e) => setNewUserForm({...newUserForm, password: e.target.value})}
                      placeholder="••••••••"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-[10px] font-black uppercase text-slate-400 tracking-widest mb-2 ml-1">Cargo / Permissão</label>
                  <div className="relative">
                    <Shield className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-300" size={18}/>
                    <select 
                      className="w-full pl-12 pr-4 py-3 bg-slate-50 border border-slate-200 rounded-2xl outline-none focus:ring-2 focus:ring-blue-500 font-bold appearance-none"
                      value={newUserForm.role}
                      onChange={(e) => setNewUserForm({...newUserForm, role: e.target.value as UserRole})}
                    >
                      <option value="teacher">Professor</option>
                      <option value="admin">Administrador</option>
                      <option value="student">Estudante</option>
                    </select>
                  </div>
                </div>

                {newUserForm.role === 'student' && (
                  <div className="grid grid-cols-2 gap-4 animate-in slide-in-from-top-2">
                    <div>
                      <label className="block text-[10px] font-black uppercase text-slate-400 tracking-widest mb-2 ml-1">Série</label>
                      <select 
                        className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-2xl outline-none focus:ring-2 focus:ring-blue-500 font-bold"
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
                        className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-2xl outline-none focus:ring-2 focus:ring-blue-500 font-bold"
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
                  className="w-full bg-slate-900 text-white font-black py-4 rounded-2xl shadow-xl flex items-center justify-center gap-2 hover:bg-slate-800 disabled:opacity-50 transition-all active:scale-95"
                >
                  {isCreatingUser ? <Loader2 className="animate-spin" size={20}/> : <UserPlus size={20}/>}
                  Finalizar Cadastro
                </button>
              </form>
            </div>
          </div>
        )}

        {activeTab === 'sql_help' && (
          <div className="space-y-6 animate-fade-in">
            <div className="bg-amber-50 border border-amber-200 p-6 rounded-2xl flex gap-4 text-amber-800">
              <AlertCircle size={32} />
              <div>
                <h3 className="font-bold text-lg">Central de Reparação de Tabelas</h3>
                <p className="text-sm">Se alguma funcionalidade de provas ou atividades estiver falhando, execute o script abaixo no Supabase SQL Editor.</p>
              </div>
            </div>
            <div className="relative">
               <pre className="bg-slate-900 text-slate-100 p-6 rounded-2xl overflow-x-auto text-xs font-mono leading-relaxed">{SQL_CODE}</pre>
               <button onClick={() => { navigator.clipboard.writeText(SQL_CODE); alert("Script SQL Copiado!"); }} className="absolute top-4 right-4 bg-white/10 hover:bg-white/20 p-2 rounded-lg text-white text-[10px] flex items-center gap-2 transition-all">
                 <Copy size={14}/> COPIAR SQL
               </button>
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
                    <div className="mt-3 flex items-center gap-2 text-[10px] text-slate-400 font-bold uppercase">
                      <Clock size={12}/> Enviado em {new Date(t.created_at).toLocaleDateString()}
                    </div>
                  </div>
                  <button onClick={() => handleDeleteTopic(t.id)} className="text-slate-300 hover:text-red-500 p-3 transition-colors">
                    <Trash2 size={20}/>
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}

        {activeTab === 'assessments' && (
          <div className="space-y-8 max-w-2xl mx-auto animate-fade-in">
            <div className="text-center">
              <h3 className="text-3xl font-black text-slate-800 tracking-tighter">Controle de Bimestres</h3>
              <p className="text-slate-500 mt-2">Ative o período letivo e defina as datas das provas oficiais.</p>
            </div>
            <div className="p-8 bg-slate-50 border-2 border-slate-100 rounded-[40px] space-y-8 shadow-inner">
              <div className="grid grid-cols-4 gap-3">
                {[1, 2, 3, 4].map(q => (
                  <button key={q} onClick={() => updateGlobalSettings({ activeQuarter: q })} className={`py-5 rounded-[24px] font-black border-2 transition-all ${settings.activeQuarter === q ? 'bg-blue-600 border-blue-600 text-white shadow-xl shadow-blue-200 scale-105' : 'bg-white border-white text-slate-300 hover:border-slate-200'}`}>{q}º Bim</button>
                ))}
              </div>
              <div className="space-y-4">
                {[1, 2, 3, 4].map(q => (
                  <div key={q} className={`p-5 bg-white border rounded-[32px] flex flex-col md:flex-row justify-between items-center gap-4 transition-all ${settings.activeQuarter === q ? 'ring-2 ring-blue-500 shadow-lg' : 'opacity-60 grayscale'}`}>
                    <div className="flex-1 text-center md:text-left">
                      <p className="font-black text-slate-800 text-lg uppercase tracking-widest">{q}º Bimestre</p>
                      <p className="text-[10px] text-slate-400 font-bold uppercase">Status de Aplicação</p>
                    </div>
                    <input 
                      type="date" 
                      className="text-sm bg-slate-50 p-3 rounded-2xl border-none font-bold text-slate-600 outline-none" 
                      value={settings.releaseDates[q] || ''} 
                      onChange={(e) => updateGlobalSettings({ releaseDates: { ...settings.releaseDates, [q]: e.target.value } })} 
                    />
                    <button 
                      onClick={() => updateGlobalSettings({ isAssessmentLocked: { ...settings.isAssessmentLocked, [q]: !settings.isAssessmentLocked[q] } })} 
                      className={`px-6 py-3 rounded-2xl text-[10px] font-black uppercase tracking-widest flex items-center gap-2 transition-all ${settings.isAssessmentLocked[q] ? 'bg-red-50 text-red-600' : 'bg-green-50 text-green-600'}`}
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

        {activeTab === 'official_exams' && (
          <div className="animate-fade-in space-y-8">
            <div className="text-center mb-8">
              <h3 className="text-3xl font-black text-slate-800 tracking-tighter">Gerador de Avaliações Bimestrais</h3>
              <p className="text-slate-500">Selecione a disciplina e a série para a IA gerar a avaliação baseada no planejamento do professor.</p>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
              {['História', 'Filosofia', 'Geografia', 'Sociologia'].map(subj => (
                <div key={subj} className="p-8 border-2 border-slate-50 rounded-[40px] bg-slate-50/50 space-y-6">
                  <h4 className="font-black uppercase text-slate-400 text-[11px] tracking-[0.2em] border-b pb-4">{subj}</h4>
                  <div className="space-y-3">
                    {['1ª', '2ª', '3ª'].map(grade => (
                      <button 
                        key={grade} 
                        onClick={() => generateBimonthlyExam(subj as Subject, grade)} 
                        disabled={!!genLoading} 
                        className="w-full flex justify-between items-center p-5 bg-white border border-slate-100 rounded-3xl font-black text-sm hover:border-blue-500 hover:shadow-lg transition-all active:scale-95 disabled:opacity-50 group"
                      >
                        {grade} Série 
                        {genLoading === `${subj}-${grade}` ? <Loader2 size={18} className="animate-spin text-blue-600"/> : <Sparkles size={18} className="text-slate-200 group-hover:text-blue-500 transition-colors"/>}
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
