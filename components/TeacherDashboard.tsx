
import React, { useState, useEffect } from 'react';
import { UserProfile, GlobalSettings, Subject, Topic, Assessment } from '../types';
import { BookOpen, ClipboardList, MessageSquare, Download, FileText, Send, User, KeyRound, CheckCircle2, Loader2 } from 'lucide-react';
import { supabase } from '../lib/supabase';

interface TeacherDashboardProps {
  currentUser: UserProfile;
  settings: GlobalSettings;
}

const TeacherDashboard: React.FC<TeacherDashboardProps> = ({ currentUser, settings }) => {
  const [activeTab, setActiveTab] = useState<'topics' | 'bulletins' | 'activities' | 'messages' | 'profile'>('topics');
  const [selectedSubject, setSelectedSubject] = useState<Subject>('História');
  const [topicsList, setTopicsList] = useState<Topic[]>([]);
  const [newTopic, setNewTopic] = useState('');
  const [selectedGrade, setSelectedGrade] = useState('1ª');
  const [loading, setLoading] = useState(false);
  
  // Password Change State
  const [newPassword, setNewPassword] = useState('');
  const [passLoading, setPassLoading] = useState(false);

  useEffect(() => {
    fetchTopics();
  }, []);

  const fetchTopics = async () => {
    const { data } = await supabase.from('topics').select('*').eq('teacher_id', currentUser.id);
    if (data) {
      setTopicsList(data.map(t => ({
        id: t.id,
        teacherId: t.teacher_id,
        subject: t.subject as Subject,
        grade: t.grade,
        quarter: t.quarter,
        content: t.content
      })));
    }
  };

  const handleSaveTopic = async () => {
    setLoading(true);
    const { error } = await supabase.from('topics').insert([{
      teacher_id: currentUser.id,
      subject: selectedSubject,
      grade: selectedGrade,
      quarter: settings.activeQuarter,
      content: newTopic
    }]);

    if (!error) {
      setNewTopic('');
      fetchTopics();
    }
    setLoading(false);
  };

  const handleChangePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setPassLoading(true);
    const { error } = await supabase
      .from('profiles')
      .update({ password: newPassword })
      .eq('id', currentUser.id);
    
    if (!error) {
      alert("Senha alterada com sucesso!");
      setNewPassword('');
    }
    setPassLoading(false);
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap gap-2 md:gap-4 overflow-x-auto pb-2">
        <button onClick={() => setActiveTab('topics')} className={`flex items-center gap-2 px-5 py-3 rounded-xl font-bold whitespace-nowrap transition-all ${activeTab === 'topics' ? 'bg-blue-600 text-white shadow-lg' : 'bg-white border'}`}><BookOpen size={18}/> Planejamento</button>
        <button onClick={() => setActiveTab('bulletins')} className={`flex items-center gap-2 px-5 py-3 rounded-xl font-bold whitespace-nowrap transition-all ${activeTab === 'bulletins' ? 'bg-blue-600 text-white shadow-lg' : 'bg-white border'}`}><ClipboardList size={18}/> Boletins</button>
        <button onClick={() => setActiveTab('messages')} className={`flex items-center gap-2 px-5 py-3 rounded-xl font-bold whitespace-nowrap transition-all ${activeTab === 'messages' ? 'bg-blue-600 text-white shadow-lg' : 'bg-white border'}`}><MessageSquare size={18}/> Mensagens</button>
        <button onClick={() => setActiveTab('profile')} className={`flex items-center gap-2 px-5 py-3 rounded-xl font-bold whitespace-nowrap transition-all ${activeTab === 'profile' ? 'bg-blue-600 text-white shadow-lg' : 'bg-white border'}`}><KeyRound size={18}/> Minha Senha</button>
      </div>

      <div className="bg-white rounded-3xl shadow-sm border border-slate-200 p-8 animate-fade-in">
        {activeTab === 'topics' && (
          <div className="space-y-6">
            <div className="flex flex-col md:row-span-2 gap-8">
              <div className="flex-1 space-y-6">
                <div>
                  <h3 className="font-bold text-slate-800 text-2xl">Conteúdos do {settings.activeQuarter}º Bimestre</h3>
                  <p className="text-slate-400 text-sm">Estes tópicos serão usados pelo Administrador para gerar as provas oficiais.</p>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <label className="text-xs font-bold text-slate-400 uppercase tracking-widest">Disciplina</label>
                    <select 
                      className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none"
                      value={selectedSubject}
                      onChange={(e) => setSelectedSubject(e.target.value as Subject)}
                    >
                      <option>História</option><option>Filosofia</option><option>Geografia</option><option>Sociologia</option>
                    </select>
                  </div>
                  <div className="space-y-2">
                    <label className="text-xs font-bold text-slate-400 uppercase tracking-widest">Série</label>
                    <select 
                      className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none"
                      value={selectedGrade}
                      onChange={(e) => setSelectedGrade(e.target.value)}
                    >
                      <option>1ª</option><option>2ª</option><option>3ª</option>
                    </select>
                  </div>
                </div>
                <textarea 
                  className="w-full h-48 px-5 py-4 bg-slate-50 border border-slate-200 rounded-2xl outline-none focus:ring-2 focus:ring-blue-500 focus:bg-white transition-all text-slate-700"
                  placeholder="Descreva os tópicos trabalhados (ex: 1. A Crise de 1929; 2. O surgimento dos regimes totalitários...)"
                  value={newTopic}
                  onChange={(e) => setNewTopic(e.target.value)}
                />
                <button 
                  onClick={handleSaveTopic}
                  disabled={loading || !newTopic}
                  className="w-full bg-slate-900 text-white font-bold py-4 rounded-2xl hover:bg-black shadow-xl flex items-center justify-center gap-2 transition-transform active:scale-[0.98] disabled:bg-slate-200"
                >
                  {loading ? <Loader2 className="animate-spin" size={20} /> : <Send size={18} />}
                  Publicar Tópicos para o Admin
                </button>
              </div>

              <div className="bg-slate-50 p-6 rounded-2xl border border-slate-100">
                <h4 className="font-bold text-slate-800 text-sm mb-4 uppercase tracking-widest">Tópicos Publicados</h4>
                <div className="space-y-3">
                  {topicsList.filter(t => t.grade === selectedGrade && t.subject === selectedSubject).map(t => (
                    <div key={t.id} className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm animate-fade-in">
                      <p className="text-sm text-slate-600 leading-relaxed font-medium">{t.content}</p>
                      <div className="mt-2 text-[10px] font-black text-blue-600 uppercase tracking-tighter">{t.grade} Série • {t.quarter}º Bimestre</div>
                    </div>
                  ))}
                  {topicsList.length === 0 && <p className="text-xs text-slate-400 italic text-center py-8">Nenhum conteúdo enviado para esta seleção.</p>}
                </div>
              </div>
            </div>
          </div>
        )}

        {activeTab === 'profile' && (
          <div className="max-w-md mx-auto py-8">
            <div className="text-center mb-8">
              <div className="w-20 h-20 bg-blue-50 text-blue-600 rounded-3xl flex items-center justify-center mx-auto mb-4 border border-blue-100 shadow-sm">
                <KeyRound size={32} />
              </div>
              <h3 className="text-2xl font-bold text-slate-800">Segurança da Conta</h3>
              <p className="text-slate-400 text-sm">Mantenha sua senha atualizada para proteger seus dados.</p>
            </div>
            <form onSubmit={handleChangePassword} className="space-y-6">
              <div className="space-y-2">
                <label className="text-xs font-bold text-slate-400 uppercase tracking-widest block ml-1">Nova Senha de Acesso</label>
                <input 
                  type="password"
                  className="w-full px-5 py-4 bg-slate-50 border border-slate-200 rounded-2xl outline-none focus:ring-2 focus:ring-blue-500 focus:bg-white transition-all"
                  placeholder="Digite sua nova senha"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  required
                />
              </div>
              <button 
                type="submit" 
                disabled={passLoading || newPassword.length < 4}
                className="w-full bg-blue-600 text-white font-bold py-4 rounded-2xl shadow-lg shadow-blue-200 hover:bg-blue-700 disabled:bg-slate-200 flex items-center justify-center gap-2"
              >
                {passLoading ? <Loader2 className="animate-spin" size={20} /> : <CheckCircle2 size={20} />}
                Atualizar Senha
              </button>
            </form>
          </div>
        )}
      </div>
    </div>
  );
};

export default TeacherDashboard;
