
import React, { useState, useEffect } from 'react';
import { UserProfile, GlobalSettings, UserRole, Subject, Topic } from '../types';
import { Users, Lock, Unlock, Calendar, Trash2, ShieldAlert, KeyRound, Loader2, RefreshCw, Sparkles, Wand2, ChevronLeft, AlertCircle, BookOpen, Clock, Database, Copy, Search, UserCheck, UserMinus, UserPlus, X, Mail, Shield, Briefcase, CheckCircle2, User as UserIcon, Plus, GraduationCap, Book, Key, Check } from 'lucide-react';
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

const SUBJECTS_LIST: Subject[] = ['História', 'Filosofia', 'Geografia', 'Sociologia'];

const AdminDashboard: React.FC<AdminDashboardProps> = ({ currentUser, settings, setSettings }) => {
  const [activeTab, setActiveTab] = useState<'users' | 'official_exams' | 'sql_help'>('users');
  const [usersList, setUsersList] = useState<UserProfile[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [loading, setLoading] = useState(false);
  const [genLoading, setGenLoading] = useState<string | null>(null);
  
  // States para novo usuário
  const [showAddModal, setShowAddModal] = useState(false);
  const [newUser, setNewUser] = useState<{
    fullName: string;
    email: string;
    password: string;
    role: UserRole;
    grade: string;
    className: string;
    subjects: Subject[];
  }>({
    fullName: '',
    email: '',
    password: '',
    role: UserRole.STUDENT,
    grade: '1ª',
    className: '13.01',
    subjects: []
  });

  // States para gerenciar senha
  const [showPasswordModal, setShowPasswordModal] = useState(false);
  const [selectedUser, setSelectedUser] = useState<UserProfile | null>(null);
  const [newPassword, setNewPassword] = useState('');

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
        cheatingLocked: u.cheating_locked,
        subjects: u.subjects || (u.subject ? [u.subject] : [])
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

  const handleAddUser = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      const { error } = await supabase.from('profiles').insert([{
        full_name: newUser.fullName,
        email: newUser.email,
        password: newUser.password,
        role: newUser.role,
        grade: newUser.role === UserRole.STUDENT ? newUser.grade : null,
        class_name: newUser.role === UserRole.STUDENT ? newUser.className : null,
        subjects: newUser.role === UserRole.TEACHER ? newUser.subjects : null
      }]);

      if (error) throw error;
      
      alert("Usuário cadastrado com sucesso!");
      setShowAddModal(false);
      setNewUser({ fullName: '', email: '', password: '', role: UserRole.STUDENT, grade: '1ª', className: '13.01', subjects: [] });
      fetchUsers();
    } catch (err: any) {
      alert("Erro ao cadastrar: " + err.message);
    } finally {
      setLoading(false);
    }
  };

  const toggleSubject = (s: Subject) => {
    setNewUser(prev => ({
      ...prev,
      subjects: prev.subjects.includes(s) 
        ? prev.subjects.filter(item => item !== s) 
        : [...prev.subjects, s]
    }));
  };

  const handleDeleteUser = async (id: string) => {
    if (id === currentUser.id) {
      alert("Você não pode excluir seu próprio usuário.");
      return;
    }
    if (!confirm("Tem certeza que deseja excluir este usuário? Todas as notas e atividades dele serão apagadas automaticamente.")) return;
    
    setLoading(true);
    try {
      const { error } = await supabase.from('profiles').delete().eq('id', id);
      if (error) throw error;
      fetchUsers();
    } catch (err: any) {
      alert("Erro ao excluir: " + err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleUpdatePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedUser || !newPassword) return;
    setLoading(true);
    try {
      const { error } = await supabase
        .from('profiles')
        .update({ password: newPassword })
        .eq('id', selectedUser.id);

      if (error) throw error;
      
      alert(`Senha de ${selectedUser.fullName} alterada com sucesso!`);
      setShowPasswordModal(false);
      setNewPassword('');
      setSelectedUser(null);
    } catch (err: any) {
      alert("Erro ao alterar senha: " + err.message);
    } finally {
      setLoading(false);
    }
  };

  const generateBimonthlyExam = async (subject: Subject, grade: string) => {
    const loaderKey = `${subject}-${grade}`;
    setGenLoading(loaderKey);
    try {
      const { data: topics } = await supabase.from('topics').select('content').eq('subject', subject).eq('grade', grade).eq('quarter', settings.activeQuarter).order('created_at', { ascending: false }).limit(1).maybeSingle();
      
      if (!topics || !topics.content) { 
        alert(`Impossível gerar: O professor de ${subject} ainda não enviou o planejamento para a ${grade} série neste bimestre.`); 
        setGenLoading(null);
        return; 
      }

      const questions = await generateEnemAssessment(subject, topics.content, grade);
      
      if (!questions || questions.length === 0) {
        throw new Error("A IA gerou uma prova vazia ou inválida. Tente novamente.");
      }

      const { error } = await supabase.from('official_exams').upsert({ 
        subject, 
        grade, 
        quarter: settings.activeQuarter, 
        questions 
      }, { onConflict: 'subject,grade,quarter' });

      if (error) throw error;
      
      alert(`Prova Oficial de ${subject} (${grade} série) gerada com sucesso e liberada para os alunos!`);
    } catch (err: any) { 
      alert("Erro na Geração: " + err.message); 
    } finally { 
      setGenLoading(null); 
    }
  };

  const SQL_CODE = `-- MASTER SCRIPT FREDERICO - SUPORTE MÚLTIPLAS DISCIPLINAS
-- 1. Adicionar coluna subjects se não existir
DO $$ BEGIN 
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='profiles' AND column_name='subjects') THEN
        ALTER TABLE profiles ADD COLUMN subjects TEXT[];
    END IF;
END $$;

-- 2. Migrar dados da coluna 'subject' única para a coluna 'subjects' array
UPDATE profiles SET subjects = ARRAY[subject] WHERE subjects IS NULL AND subject IS NOT NULL;

-- 3. Reparo de Chaves Estrangeiras com CASCADE
DO $$ BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.table_constraints WHERE constraint_name='assessments_student_id_fkey') THEN
        ALTER TABLE assessments DROP CONSTRAINT assessments_student_id_fkey;
    END IF;
    ALTER TABLE assessments ADD CONSTRAINT assessments_student_id_fkey FOREIGN KEY (student_id) REFERENCES profiles(id) ON DELETE CASCADE;

    IF EXISTS (SELECT 1 FROM information_schema.table_constraints WHERE constraint_name='topics_teacher_id_fkey') THEN
        ALTER TABLE topics DROP CONSTRAINT topics_teacher_id_fkey;
    END IF;
    ALTER TABLE topics ADD CONSTRAINT topics_teacher_id_fkey FOREIGN KEY (teacher_id) REFERENCES profiles(id) ON DELETE CASCADE;
END $$;

-- Desativar RLS para facilitar gestão
ALTER TABLE profiles DISABLE ROW LEVEL SECURITY;
ALTER TABLE topics DISABLE ROW LEVEL SECURITY;
ALTER TABLE assessments DISABLE ROW LEVEL SECURITY;
ALTER TABLE global_settings DISABLE ROW LEVEL SECURITY;`;

  const filteredUsers = usersList.filter(u => 
    u.fullName.toLowerCase().includes(searchTerm.toLowerCase()) || 
    u.email.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="bg-gradient-to-r from-blue-700 to-indigo-800 p-8 rounded-[40px] text-white flex flex-col md:flex-row justify-between items-center gap-6 shadow-2xl no-print relative overflow-hidden">
        <div className="absolute top-0 right-0 p-12 opacity-10"><Shield size={120}/></div>
        <div className="z-10">
          <h2 className="text-3xl font-black tracking-tighter uppercase">Painel de Controle Admin</h2>
          <p className="text-blue-200 font-bold text-xs uppercase tracking-widest mt-1">Escola Estadual Frederico José Pedreira</p>
        </div>
        <div className="bg-white/10 backdrop-blur-md px-6 py-4 rounded-3xl border border-white/10 z-10">
          <p className="text-[10px] font-black uppercase text-blue-100 mb-1">Bimestre Ativo</p>
          <select 
            className="bg-transparent font-black text-xl outline-none cursor-pointer" 
            value={settings.activeQuarter} 
            onChange={(e) => updateGlobalSettings({ activeQuarter: parseInt(e.target.value) })}
          >
            {[1,2,3,4].map(n => <option key={n} value={n} className="text-slate-900">{n}º Bimestre</option>)}
          </select>
        </div>
      </div>

      <div className="flex gap-2 overflow-x-auto pb-2 no-print">
        <button 
          onClick={() => setActiveTab('users')} 
          className={`flex items-center gap-2 px-6 py-3 rounded-2xl font-black transition-all whitespace-nowrap ${activeTab === 'users' ? 'bg-blue-600 text-white shadow-xl scale-105' : 'bg-white border border-slate-200 text-slate-500 hover:bg-slate-50'}`}
        >
          <Users size={18}/> Usuários
        </button>
        <button 
          onClick={() => setActiveTab('official_exams')} 
          className={`flex items-center gap-2 px-6 py-3 rounded-2xl font-black transition-all whitespace-nowrap ${activeTab === 'official_exams' ? 'bg-blue-600 text-white shadow-xl scale-105' : 'bg-white border border-slate-200 text-slate-500 hover:bg-slate-50'}`}
        >
          <CheckCircle2 size={18}/> Gerar Provas
        </button>
        <button 
          onClick={() => setActiveTab('sql_help')} 
          className={`flex items-center gap-2 px-6 py-3 rounded-2xl font-black transition-all whitespace-nowrap ${activeTab === 'sql_help' ? 'bg-amber-600 text-white shadow-xl scale-105' : 'bg-white border border-slate-200 text-slate-500 hover:bg-slate-50'}`}
        >
          <Database size={18}/> Reparo SQL
        </button>
      </div>

      <div className="bg-white rounded-[40px] shadow-sm border border-slate-200 p-8 min-h-[500px]">
        {activeTab === 'users' && (
          <div className="space-y-8">
            <div className="flex flex-col md:flex-row justify-between items-center gap-4">
              <div className="relative w-full md:max-w-md">
                <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={18}/>
                <input 
                  type="text" 
                  placeholder="Pesquisar por nome ou e-mail..." 
                  value={searchTerm} 
                  onChange={(e) => setSearchTerm(e.target.value)} 
                  className="w-full pl-12 pr-4 py-4 bg-slate-50 border border-slate-200 rounded-2xl outline-none focus:ring-2 focus:ring-blue-500 transition-all font-medium"
                />
              </div>
              <button 
                onClick={() => setShowAddModal(true)} 
                className="bg-slate-900 text-white font-black px-6 py-4 rounded-2xl flex items-center gap-2 hover:bg-slate-800 transition-all shadow-lg"
              >
                <Plus size={20}/> ADICIONAR USUÁRIO
              </button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {filteredUsers.map(u => (
                <div key={u.id} className="p-6 border border-slate-100 rounded-[32px] bg-slate-50/30 hover:bg-white hover:shadow-xl hover:border-blue-100 transition-all group relative overflow-hidden">
                  <div className="flex items-center gap-4">
                    <div className="w-12 h-12 bg-blue-100 text-blue-600 rounded-2xl flex items-center justify-center font-black shadow-inner">
                      {u.avatarUrl ? <img src={u.avatarUrl} className="w-full h-full object-cover rounded-2xl"/> : u.fullName[0].toUpperCase()}
                    </div>
                    <div>
                      <h4 className="font-black text-slate-800 tracking-tight line-clamp-1">{u.fullName}</h4>
                      <p className={`text-[9px] font-black uppercase px-2 py-0.5 rounded-full inline-block ${
                        u.role === UserRole.ADMIN ? 'bg-purple-100 text-purple-600' : 
                        u.role === UserRole.TEACHER ? 'bg-amber-100 text-amber-600' : 
                        'bg-blue-100 text-blue-600'
                      }`}>
                        {u.role === UserRole.ADMIN ? 'Administrador' : u.role === UserRole.TEACHER ? 'Professor' : 'Estudante'}
                      </p>
                    </div>
                  </div>
                  
                  <div className="mt-4 pt-4 border-t border-slate-100 space-y-1">
                    <p className="text-[10px] text-slate-400 flex items-center gap-2 font-medium"><Mail size={12}/> {u.email}</p>
                    {u.role === UserRole.STUDENT && (
                      <p className="text-[10px] text-slate-400 flex items-center gap-2 font-medium"><GraduationCap size={12}/> {u.grade} Série • Turma {u.className}</p>
                    )}
                    {u.role === UserRole.TEACHER && (
                      <div className="flex flex-wrap gap-1 pt-2">
                        {u.subjects?.map(s => (
                          <span key={s} className="bg-blue-600 text-white text-[8px] font-black px-2 py-1 rounded-full uppercase tracking-tighter">{s}</span>
                        )) || <span className="text-red-400 text-[8px] italic">Nenhuma disciplina</span>}
                      </div>
                    )}
                  </div>

                  <div className="absolute top-4 right-4 flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                    <button 
                      onClick={() => { setSelectedUser(u); setShowPasswordModal(true); }} 
                      className="p-2 bg-blue-50 text-blue-500 rounded-xl hover:bg-blue-500 hover:text-white transition-all shadow-sm"
                      title="Alterar Senha"
                    >
                      <Key size={16}/>
                    </button>
                    <button 
                      onClick={() => handleDeleteUser(u.id)} 
                      className="p-2 bg-red-50 text-red-500 rounded-xl hover:bg-red-500 hover:text-white transition-all shadow-sm"
                      title="Excluir Usuário"
                    >
                      <Trash2 size={16}/>
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {activeTab === 'official_exams' && (
          <div className="space-y-10">
            <div className="text-center max-w-2xl mx-auto space-y-2">
              <h3 className="text-2xl font-black text-slate-800 tracking-tighter uppercase">Gerador de Provas Bimestrais</h3>
              <p className="text-slate-400 text-sm">Com base no planejamento enviado pelos professores, gere avaliações oficiais de 5 questões seguindo o padrão ENEM/TRI.</p>
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
              {SUBJECTS_LIST.map(subj => (
                <div key={subj} className="p-8 border border-slate-100 rounded-[40px] bg-slate-50/50 space-y-6 flex flex-col">
                  <div className="flex items-center gap-3">
                    <div className="bg-blue-600 p-2 rounded-xl"><BookOpen size={16} className="text-white"/></div>
                    <h4 className="font-black text-slate-800 text-sm uppercase tracking-wider">{subj}</h4>
                  </div>
                  
                  <div className="space-y-3 flex-1">
                    {['1ª', '2ª', '3ª'].map(grade => (
                      <button 
                        key={grade} 
                        onClick={() => generateBimonthlyExam(subj, grade)} 
                        disabled={!!genLoading} 
                        className="w-full flex justify-between items-center p-4 bg-white border border-slate-100 rounded-2xl font-black text-xs hover:border-blue-500 hover:shadow-md transition-all group disabled:opacity-50"
                      >
                        {grade} SÉRIE
                        {genLoading === `${subj}-${grade}` ? (
                          <Loader2 size={16} className="animate-spin text-blue-500"/>
                        ) : (
                          <Sparkles size={16} className="text-slate-200 group-hover:text-blue-500 transition-colors"/>
                        )}
                      </button>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {activeTab === 'sql_help' && (
          <div className="max-w-4xl mx-auto space-y-6">
            <div className="bg-amber-50 border border-amber-200 p-8 rounded-[32px] flex items-start gap-4">
              <AlertCircle className="text-amber-500 shrink-0" size={24}/>
              <div className="space-y-1">
                <p className="font-black text-amber-800 uppercase text-xs tracking-widest">Utilitário de Reparação Crítica</p>
                <p className="text-amber-700 text-sm">Este script adiciona a coluna de "subjects" array e corrige os vínculos de exclusão.</p>
              </div>
            </div>
            <div className="relative group">
              <pre className="bg-slate-900 text-slate-100 p-8 rounded-[32px] overflow-x-auto text-[10px] font-mono leading-relaxed shadow-2xl h-[400px]">
                {SQL_CODE}
              </pre>
              <button 
                onClick={() => { navigator.clipboard.writeText(SQL_CODE); alert("Script Copiado!"); }} 
                className="absolute top-4 right-4 bg-white/10 hover:bg-white/20 text-white p-3 rounded-2xl transition-all"
              >
                <Copy size={18}/>
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Modal Alterar Senha */}
      {showPasswordModal && selectedUser && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-md z-[110] flex items-center justify-center p-4">
          <div className="bg-white w-full max-w-sm rounded-[40px] shadow-2xl overflow-hidden animate-fade-in">
            <div className="p-8 bg-slate-900 text-white flex justify-between items-center">
              <div>
                <h3 className="font-black uppercase tracking-tighter text-lg">Gerenciar Senha</h3>
                <p className="text-slate-400 text-[9px] font-bold uppercase tracking-widest">{selectedUser.fullName}</p>
              </div>
              <button onClick={() => { setShowPasswordModal(false); setSelectedUser(null); }} className="p-2 hover:bg-white/10 rounded-full transition-colors"><X size={20}/></button>
            </div>
            <form onSubmit={handleUpdatePassword} className="p-8 space-y-6">
              <div className="space-y-2">
                <label className="text-[10px] font-black uppercase text-slate-400 ml-2 tracking-widest">Nova Senha</label>
                <input required type="text" className="w-full px-5 py-4 bg-slate-50 border border-slate-100 rounded-2xl outline-none" value={newPassword} onChange={e => setNewPassword(e.target.value)}/>
              </div>
              <button type="submit" className="w-full bg-blue-600 text-white font-black py-4 rounded-2xl shadow-lg">ATUALIZAR SENHA</button>
            </form>
          </div>
        </div>
      )}

      {/* Modal Adicionar Usuário */}
      {showAddModal && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-md z-[100] flex items-center justify-center p-4">
          <div className="bg-white w-full max-w-lg rounded-[40px] shadow-2xl overflow-hidden animate-fade-in flex flex-col max-h-[90vh]">
            <div className="p-8 bg-slate-900 text-white flex justify-between items-center">
              <h3 className="font-black uppercase tracking-tighter text-2xl">Novo Usuário</h3>
              <button onClick={() => setShowAddModal(false)} className="p-2 hover:bg-white/10 rounded-full transition-colors"><X size={24}/></button>
            </div>
            
            <form onSubmit={handleAddUser} className="p-8 space-y-6 overflow-y-auto">
              <div className="space-y-4">
                <div className="space-y-1">
                  <label className="text-[10px] font-black uppercase text-slate-400 ml-4">Função</label>
                  <div className="grid grid-cols-3 gap-2">
                    {[UserRole.STUDENT, UserRole.TEACHER, UserRole.ADMIN].map(role => (
                      <button 
                        key={role}
                        type="button"
                        onClick={() => setNewUser({...newUser, role})}
                        className={`py-3 rounded-2xl font-black text-[10px] uppercase border ${newUser.role === role ? 'bg-blue-600 text-white' : 'bg-slate-50 text-slate-400'}`}
                      >
                        {role === UserRole.STUDENT ? 'Aluno' : role === UserRole.TEACHER ? 'Professor' : 'Admin'}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="space-y-3">
                  <input required type="text" placeholder="Nome Completo" className="w-full px-5 py-4 bg-slate-50 border rounded-2xl" value={newUser.fullName} onChange={e => setNewUser({...newUser, fullName: e.target.value})}/>
                  <input required type="email" placeholder="E-mail" className="w-full px-5 py-4 bg-slate-50 border rounded-2xl" value={newUser.email} onChange={e => setNewUser({...newUser, email: e.target.value})}/>
                  <input required type="text" placeholder="Senha Inicial" className="w-full px-5 py-4 bg-slate-50 border rounded-2xl" value={newUser.password} onChange={e => setNewUser({...newUser, password: e.target.value})}/>
                </div>

                {newUser.role === UserRole.TEACHER && (
                  <div className="space-y-3 animate-fade-in">
                    <label className="text-[10px] font-black uppercase text-slate-400 ml-4 tracking-widest">Áreas de Atuação (Selecione Múltiplas)</label>
                    <div className="grid grid-cols-2 gap-2">
                      {SUBJECTS_LIST.map(s => (
                        <button 
                          key={s} 
                          type="button" 
                          onClick={() => toggleSubject(s)}
                          className={`flex items-center justify-between px-4 py-3 rounded-xl border text-[10px] font-black uppercase transition-all ${
                            newUser.subjects.includes(s) ? 'bg-blue-100 border-blue-500 text-blue-700 shadow-inner' : 'bg-white border-slate-100 text-slate-400'
                          }`}
                        >
                          {s}
                          {newUser.subjects.includes(s) && <Check size={14}/>}
                        </button>
                      ))}
                    </div>
                  </div>
                )}

                {newUser.role === UserRole.STUDENT && (
                  <div className="grid grid-cols-2 gap-4 animate-fade-in">
                    <select className="w-full px-5 py-4 bg-slate-50 border rounded-2xl font-bold" value={newUser.grade} onChange={e => setNewUser({...newUser, grade: e.target.value, className: CLASSES_MAP[e.target.value][0]})}>
                      {Object.keys(CLASSES_MAP).map(g => <option key={g} value={g}>{g} Série</option>)}
                    </select>
                    <select className="w-full px-5 py-4 bg-slate-50 border rounded-2xl font-bold" value={newUser.className} onChange={e => setNewUser({...newUser, className: e.target.value})}>
                      {CLASSES_MAP[newUser.grade].map(c => <option key={c} value={c}>Turma {c}</option>)}
                    </select>
                  </div>
                )}
              </div>

              <div className="flex gap-4 pt-4 border-t">
                <button type="submit" className="w-full bg-blue-600 text-white font-black py-4 rounded-2xl shadow-xl hover:bg-blue-700 transition-all">CADASTRAR</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default AdminDashboard;
