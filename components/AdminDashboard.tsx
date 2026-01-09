
import React, { useState, useEffect } from 'react';
import { UserProfile, GlobalSettings, UserRole, Subject, Question } from '../types';
import { Users, Lock, Unlock, Calendar, Trash2, ShieldAlert, KeyRound, Loader2, RefreshCw, Sparkles, Wand2 } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { generateEnemAssessment } from '../services/geminiService';

interface AdminDashboardProps {
  currentUser: UserProfile;
  settings: GlobalSettings;
  setSettings: (s: GlobalSettings) => void;
}

const AdminDashboard: React.FC<AdminDashboardProps> = ({ currentUser, settings, setSettings }) => {
  const [activeTab, setActiveTab] = useState<'users' | 'assessments' | 'official_exams'>('users');
  const [newTeacher, setNewTeacher] = useState({ fullName: '', email: '', password: '' });
  const [usersList, setUsersList] = useState<UserProfile[]>([]);
  const [loading, setLoading] = useState(false);
  const [genLoading, setGenLoading] = useState(false);

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

  const fetchSettings = async () => {
    const { data } = await supabase.from('global_settings').select('*').single();
    if (data) {
      setSettings({
        activeQuarter: data.active_quarter,
        isAssessmentLocked: data.locks,
        releaseDates: data.release_dates
      });
    }
  };

  const handleResetPassword = async (userId: string) => {
    const newPass = prompt("Digite a nova senha para este usuário:");
    if (!newPass) return;

    setLoading(true);
    const { error } = await supabase.from('profiles').update({ password: newPass }).eq('id', userId);
    if (!error) alert("Senha resetada com sucesso!");
    setLoading(false);
  };

  const generateBimonthlyExam = async (subject: Subject, grade: string) => {
    setGenLoading(true);
    try {
      // 1. Buscar tópicos enviados pelo professor para o bimestre ativo
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
        alert(`O professor ainda não determinou os assuntos para o ${settings.activeQuarter}º bimestre na disciplina de ${subject} (${grade} série). A prova oficial não pode ser gerada sem os tópicos.`);
        return;
      }

      // 2. Chamar IA para gerar a prova padrão ENEM
      const questions = await generateEnemAssessment(subject, topics.content, grade);

      // 3. Salvar na tabela de Provas Oficiais (sobrescreve se já existir)
      const { error } = await supabase.from('official_exams').upsert({
        subject,
        grade,
        quarter: settings.activeQuarter,
        questions
      }, { onConflict: 'subject,grade,quarter' });

      if (error) throw error;
      alert(`Avaliação Oficial de ${subject} (${grade} série) gerada com sucesso para o ${settings.activeQuarter}º bimestre!`);
    } catch (err: any) {
      alert("Erro ao gerar prova: " + err.message);
    } finally {
      setGenLoading(false);
    }
  };

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex gap-4 overflow-x-auto pb-2">
        <button 
          onClick={() => setActiveTab('users')}
          className={`flex items-center gap-2 px-6 py-4 rounded-2xl font-bold transition-all shadow-sm shrink-0 ${activeTab === 'users' ? 'bg-blue-600 text-white shadow-blue-200' : 'bg-white text-slate-500 border border-slate-200 hover:border-blue-300'}`}
        >
          <Users size={20} /> Usuários
        </button>
        <button 
          onClick={() => setActiveTab('assessments')}
          className={`flex items-center gap-2 px-6 py-4 rounded-2xl font-bold transition-all shadow-sm shrink-0 ${activeTab === 'assessments' ? 'bg-blue-600 text-white shadow-blue-200' : 'bg-white text-slate-500 border border-slate-200 hover:border-blue-300'}`}
        >
          <Calendar size={20} /> Calendário
        </button>
        <button 
          onClick={() => setActiveTab('official_exams')}
          className={`flex items-center gap-2 px-6 py-4 rounded-2xl font-bold transition-all shadow-sm shrink-0 ${activeTab === 'official_exams' ? 'bg-blue-600 text-white shadow-blue-200' : 'bg-white text-slate-500 border border-slate-200 hover:border-blue-300'}`}
        >
          <Sparkles size={20} /> Gerar Provas Oficiais
        </button>
      </div>

      {activeTab === 'users' && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          <div className="lg:col-span-2 bg-white rounded-3xl shadow-sm border border-slate-200 overflow-hidden">
             <div className="p-6 border-b border-slate-100 flex justify-between items-center">
                <h3 className="font-bold text-slate-800 text-lg">Gerenciar Contas</h3>
                <button onClick={fetchUsers} className="text-blue-600"><RefreshCw size={18} className={loading ? 'animate-spin' : ''}/></button>
             </div>
             <div className="overflow-x-auto">
               <table className="w-full">
                 <thead className="bg-slate-50 text-[10px] uppercase font-black text-slate-400">
                    <tr>
                      <th className="px-6 py-4 text-left">Nome</th>
                      <th className="px-6 py-4 text-left">Papel</th>
                      <th className="px-6 py-4 text-right">Ações</th>
                    </tr>
                 </thead>
                 <tbody className="divide-y divide-slate-100">
                    {usersList.map(user => (
                      <tr key={user.id} className="hover:bg-slate-50">
                        <td className="px-6 py-4">
                          <p className="text-sm font-bold text-slate-700">{user.fullName}</p>
                          <p className="text-[10px] text-slate-400">{user.email}</p>
                        </td>
                        <td className="px-6 py-4">
                           <span className={`text-[10px] font-bold px-2 py-1 rounded-lg uppercase ${user.role === 'admin' ? 'bg-blue-100 text-blue-700' : 'bg-slate-100 text-slate-600'}`}>{user.role}</span>
                        </td>
                        <td className="px-6 py-4 text-right">
                           <button 
                            onClick={() => handleResetPassword(user.id)}
                            className="p-2 text-slate-400 hover:text-blue-600 transition-colors" title="Resetar Senha"
                           >
                            <KeyRound size={18}/>
                           </button>
                        </td>
                      </tr>
                    ))}
                 </tbody>
               </table>
             </div>
          </div>
        </div>
      )}

      {activeTab === 'official_exams' && (
        <div className="bg-white rounded-3xl shadow-sm border border-slate-200 p-8">
          <div className="max-w-3xl mx-auto space-y-8">
            <div className="text-center">
              <div className="bg-blue-600 w-16 h-16 rounded-2xl flex items-center justify-center text-white mx-auto mb-4 shadow-xl shadow-blue-200">
                <Wand2 size={32} />
              </div>
              <h3 className="text-2xl font-bold text-slate-800">Gerador de Provas Bimestrais</h3>
              <p className="text-slate-400">Gere as 5 questões oficiais do {settings.activeQuarter}º Bimestre baseadas nos conteúdos postados pelos professores.</p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {['História', 'Filosofia', 'Geografia', 'Sociologia'].map((subj) => (
                <div key={subj} className="bg-slate-50 p-6 rounded-3xl border border-slate-200 space-y-6">
                  <h4 className="font-bold text-slate-800 border-b pb-2">{subj}</h4>
                  <div className="space-y-3">
                    {['1ª', '2ª', '3ª'].map(grade => (
                      <button
                        key={grade}
                        disabled={genLoading}
                        onClick={() => generateBimonthlyExam(subj as Subject, grade)}
                        className="w-full flex justify-between items-center bg-white p-3 rounded-xl border border-slate-200 hover:border-blue-500 hover:bg-blue-50 transition-all font-bold text-sm text-slate-600 disabled:opacity-50"
                      >
                        {grade} Série
                        {genLoading ? <Loader2 className="animate-spin" size={16}/> : <Sparkles size={16} className="text-yellow-500" />}
                      </button>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default AdminDashboard;
