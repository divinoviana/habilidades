
import React, { useState, useEffect } from 'react';
import { UserProfile, GlobalSettings, UserRole, Subject, Topic } from '../types';
import { Users, Lock, Unlock, Calendar, Trash2, ShieldAlert, KeyRound, Loader2, RefreshCw, Sparkles, Wand2, ChevronLeft, AlertCircle, BookOpen, Clock } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { generateEnemAssessment } from '../services/geminiService';

interface AdminDashboardProps {
  currentUser: UserProfile;
  settings: GlobalSettings;
  setSettings: (s: GlobalSettings) => void;
}

const AdminDashboard: React.FC<AdminDashboardProps> = ({ currentUser, settings, setSettings }) => {
  const [activeTab, setActiveTab] = useState<'users' | 'assessments' | 'topics' | 'official_exams'>('users');
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
    const { data } = await supabase.from('global_settings').select('*').single();
    if (data) {
      setSettings({
        activeQuarter: data.active_quarter,
        isAssessmentLocked: data.locks || { 1: false, 2: true, 3: true, 4: true },
        releaseDates: data.release_dates || { 1: '', 2: '', 3: '', 4: '' }
      });
    }
  };

  const updateGlobalSettings = async (newSettings: Partial<GlobalSettings>) => {
    setLoading(true);
    const updated = { ...settings, ...newSettings };
    const { error } = await supabase.from('global_settings').upsert({
      id: 1, // Assume ID 1 para configurações globais
      active_quarter: updated.activeQuarter,
      locks: updated.isAssessmentLocked,
      release_dates: updated.releaseDates
    });
    if (!error) {
      setSettings(updated as GlobalSettings);
      alert("Configurações atualizadas!");
    } else {
      alert("Erro ao salvar configurações: " + error.message);
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
        alert(`ERRO: O professor de ${subject} ainda não postou os tópicos para a ${grade} série.`);
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
        if (error.message.includes("not found")) {
          throw new Error("A tabela 'official_exams' não existe no banco de dados. Por favor, crie-a no editor SQL do Supabase.");
        }
        throw error;
      }
      alert(`SUCESSO: Avaliação de ${subject} (${grade} série) gerada!`);
    } catch (err: any) {
      alert("Falha na geração: " + err.message);
    } finally {
      setGenLoading(null);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex gap-2 overflow-x-auto pb-2 no-print">
        <button onClick={() => setActiveTab('users')} className={`flex items-center gap-2 px-5 py-3 rounded-xl font-bold whitespace-nowrap transition-all ${activeTab === 'users' ? 'bg-blue-600 text-white shadow-lg' : 'bg-white border text-slate-500'}`}><Users size={18}/> Usuários</button>
        <button onClick={() => setActiveTab('topics')} className={`flex items-center gap-2 px-5 py-3 rounded-xl font-bold whitespace-nowrap transition-all ${activeTab === 'topics' ? 'bg-blue-600 text-white shadow-lg' : 'bg-white border text-slate-500'}`}><BookOpen size={18}/> Planejamentos</button>
        <button onClick={() => setActiveTab('assessments')} className={`flex items-center gap-2 px-5 py-3 rounded-xl font-bold whitespace-nowrap transition-all ${activeTab === 'assessments' ? 'bg-blue-600 text-white shadow-lg' : 'bg-white border text-slate-500'}`}><Calendar size={18}/> Calendário</button>
        <button onClick={() => setActiveTab('official_exams')} className={`flex items-center gap-2 px-5 py-3 rounded-xl font-bold whitespace-nowrap transition-all ${activeTab === 'official_exams' ? 'bg-blue-600 text-white shadow-lg' : 'bg-white border text-slate-500'}`}><Sparkles size={18}/> Gerar Provas</button>
      </div>

      <div className="bg-white rounded-3xl shadow-sm border border-slate-200 p-8">
        {activeTab === 'topics' && (
          <div className="space-y-6">
            <h3 className="font-bold text-slate-800 text-2xl">Planejamentos Recebidos</h3>
            <div className="grid grid-cols-1 gap-4">
              {allTopics.map((t) => (
                <div key={t.id} className="p-5 border rounded-2xl bg-slate-50 flex justify-between items-start">
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <span className="text-[10px] font-black bg-blue-600 text-white px-2 py-0.5 rounded uppercase">{t.subject}</span>
                      <span className="text-[10px] font-black bg-slate-200 text-slate-600 px-2 py-0.5 rounded uppercase">{t.grade} SÉRIE</span>
                    </div>
                    <h4 className="font-bold text-slate-800">Prof. {t.profiles?.full_name}</h4>
                    <p className="text-sm text-slate-600 line-clamp-2">{t.content}</p>
                  </div>
                  <div className="text-right text-[10px] text-slate-400 font-bold">
                    <Clock size={12} className="inline mr-1"/> {new Date(t.created_at).toLocaleDateString()}
                  </div>
                </div>
              ))}
              {allTopics.length === 0 && <p className="text-center text-slate-400 py-12 italic">Nenhum planejamento enviado ainda.</p>}
            </div>
          </div>
        )}

        {activeTab === 'assessments' && (
          <div className="space-y-8 max-w-2xl mx-auto">
            <div className="text-center">
              <h3 className="text-2xl font-bold text-slate-800">Calendário e Bimestres</h3>
              <p className="text-slate-500">Defina o bimestre ativo e as datas de liberação.</p>
            </div>
            
            <div className="space-y-6">
              <div className="p-6 bg-slate-50 rounded-2xl border">
                <label className="block text-xs font-black uppercase text-slate-400 mb-2">Bimestre Ativo no Sistema</label>
                <select 
                  className="w-full p-3 rounded-xl border font-bold"
                  value={settings.activeQuarter}
                  onChange={(e) => updateGlobalSettings({ activeQuarter: parseInt(e.target.value) })}
                >
                  <option value={1}>1º Bimestre</option>
                  <option value={2}>2º Bimestre</option>
                  <option value={3}>3º Bimestre</option>
                  <option value={4}>4º Bimestre</option>
                </select>
              </div>

              <div className="grid grid-cols-1 gap-4">
                {[1, 2, 3, 4].map(q => (
                  <div key={q} className="p-4 border rounded-2xl flex items-center justify-between gap-4">
                    <div className="flex items-center gap-4">
                      <div className={`w-10 h-10 rounded-xl flex items-center justify-center font-bold ${settings.activeQuarter === q ? 'bg-blue-600 text-white' : 'bg-slate-100 text-slate-400'}`}>
                        {q}º
                      </div>
                      <div>
                        <p className="font-bold text-slate-800">Liberação das Provas</p>
                        <input 
                          type="date" 
                          className="text-xs border-none p-0 focus:ring-0 text-slate-400"
                          value={settings.releaseDates[q] || ''}
                          onChange={(e) => {
                            const newDates = { ...settings.releaseDates, [q]: e.target.value };
                            updateGlobalSettings({ releaseDates: newDates });
                          }}
                        />
                      </div>
                    </div>
                    <button 
                      onClick={() => {
                        const newLocks = { ...settings.isAssessmentLocked, [q]: !settings.isAssessmentLocked[q] };
                        updateGlobalSettings({ isAssessmentLocked: newLocks });
                      }}
                      className={`flex items-center gap-2 px-4 py-2 rounded-xl font-bold text-xs transition-all ${settings.isAssessmentLocked[q] ? 'bg-red-50 text-red-600' : 'bg-green-50 text-green-600'}`}
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
          <div className="space-y-8">
            <div className="text-center mb-8">
              <h3 className="text-2xl font-bold text-slate-800">Gerador de Provas Oficiais</h3>
              <p className="text-slate-500">Selecione a disciplina e a série para a IA gerar a avaliação baseada no planejamento do professor.</p>
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
                        className="w-full flex justify-between items-center p-3 bg-white border rounded-xl hover:border-blue-500 transition-all font-bold text-sm disabled:opacity-50"
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

        {activeTab === 'users' && (
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
                        <div className="flex items-center gap-3">
                          {user.avatarUrl && <img src={user.avatarUrl} className="w-8 h-8 rounded-lg object-cover" />}
                          <div>
                            <p className="text-sm font-bold text-slate-700">{user.fullName}</p>
                            <p className="text-[10px] text-slate-400">{user.email}</p>
                          </div>
                        </div>
                      </td>
                      <td className="px-6 py-4">
                         <span className={`text-[10px] font-bold px-2 py-1 rounded-lg uppercase ${user.role === 'admin' ? 'bg-blue-100 text-blue-700' : 'bg-slate-100 text-slate-600'}`}>{user.role}</span>
                      </td>
                      <td className="px-6 py-4 text-right">
                         <button className="p-2 text-slate-400 hover:text-blue-600 transition-colors" title="Resetar Senha"><KeyRound size={18}/></button>
                      </td>
                    </tr>
                  ))}
               </tbody>
             </table>
           </div>
        )}
      </div>
    </div>
  );
};

export default AdminDashboard;
