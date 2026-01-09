
import React, { useState, useEffect } from 'react';
import { UserProfile, GlobalSettings, Subject, Topic, ExtraActivity, ActivitySubmission } from '../types';
import { BookOpen, ClipboardList, MessageSquare, KeyRound, CheckCircle2, Loader2, FilePlus, ListChecks, Sparkles, Send, Users } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { generateExtraActivity } from '../services/geminiService';

interface TeacherDashboardProps {
  currentUser: UserProfile;
  settings: GlobalSettings;
}

const TeacherDashboard: React.FC<TeacherDashboardProps> = ({ currentUser, settings }) => {
  const [activeTab, setActiveTab] = useState<'topics' | 'activities' | 'messages' | 'profile'>('topics');
  const [selectedSubject, setSelectedSubject] = useState<Subject>('História');
  const [selectedGrade, setSelectedGrade] = useState('1ª');
  const [selectedClass, setSelectedClass] = useState('Todas');
  const [loading, setLoading] = useState(false);
  
  // Topics State
  const [topicsList, setTopicsList] = useState<Topic[]>([]);
  const [newTopic, setNewTopic] = useState('');

  // Extra Activities State
  const [extraTheme, setExtraTheme] = useState('');
  const [generatedQuestions, setGeneratedQuestions] = useState<any[] | null>(null);
  const [myActivities, setMyActivities] = useState<ExtraActivity[]>([]);
  const [submissions, setSubmissions] = useState<ActivitySubmission[]>([]);
  const [viewingResults, setViewingResults] = useState<string | null>(null);

  const classes = ["Todas", "13.01", "13.02", "13.03", "13.04", "13.05", "13.06", "23.01", "23.02", "33.01"];

  useEffect(() => {
    fetchTopics();
    fetchMyActivities();
  }, []);

  const fetchTopics = async () => {
    const { data } = await supabase.from('topics').select('*').eq('teacher_id', currentUser.id);
    if (data) setTopicsList(data);
  };

  const fetchMyActivities = async () => {
    const { data } = await supabase.from('extra_activities').select('*').eq('teacher_id', currentUser.id).order('created_at', { ascending: false });
    if (data) setMyActivities(data.map(d => ({ ...d, teacherId: d.teacher_id, createdAt: d.created_at })));
  };

  const fetchSubmissions = async (activityId: string) => {
    const { data, error } = await supabase
      .from('activity_submissions')
      .select('*, profiles(full_name)')
      .eq('activity_id', activityId);
    
    if (data) {
      setSubmissions(data.map(s => ({
        ...s,
        activityId: s.activity_id,
        studentId: s.student_id,
        studentName: s.profiles.full_name,
        createdAt: s.created_at
      })));
    }
  };

  const handleGenerateExtra = async () => {
    if (!extraTheme) return;
    setLoading(true);
    try {
      const q = await generateExtraActivity(selectedSubject, extraTheme, selectedGrade);
      setGeneratedQuestions(q);
    } catch (err: any) {
      alert(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handlePublishActivity = async () => {
    if (!generatedQuestions) return;
    setLoading(true);
    const { error } = await supabase.from('extra_activities').insert([{
      teacher_id: currentUser.id,
      subject: selectedSubject,
      grade: selectedGrade,
      class_name: selectedClass === 'Todas' ? null : selectedClass,
      theme: extraTheme,
      questions: generatedQuestions
    }]);

    if (!error) {
      alert("Atividade extra enviada com sucesso para os alunos!");
      setExtraTheme('');
      setGeneratedQuestions(null);
      fetchMyActivities();
    }
    setLoading(false);
  };

  const handleSaveTopic = async () => {
    setLoading(true);
    await supabase.from('topics').insert([{
      teacher_id: currentUser.id,
      subject: selectedSubject,
      grade: selectedGrade,
      quarter: settings.activeQuarter,
      content: newTopic
    }]);
    setNewTopic('');
    fetchTopics();
    setLoading(false);
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap gap-2 overflow-x-auto pb-2">
        <button onClick={() => setActiveTab('topics')} className={`flex items-center gap-2 px-5 py-3 rounded-xl font-bold whitespace-nowrap transition-all ${activeTab === 'topics' ? 'bg-blue-600 text-white shadow-lg' : 'bg-white border'}`}><BookOpen size={18}/> Planejamento</button>
        <button onClick={() => setActiveTab('activities')} className={`flex items-center gap-2 px-5 py-3 rounded-xl font-bold whitespace-nowrap transition-all ${activeTab === 'activities' ? 'bg-blue-600 text-white shadow-lg' : 'bg-white border'}`}><FilePlus size={18}/> Atividades Extras</button>
        <button onClick={() => setActiveTab('profile')} className={`flex items-center gap-2 px-5 py-3 rounded-xl font-bold whitespace-nowrap transition-all ${activeTab === 'profile' ? 'bg-blue-600 text-white shadow-lg' : 'bg-white border'}`}><KeyRound size={18}/> Minha Senha</button>
      </div>

      <div className="bg-white rounded-3xl shadow-sm border border-slate-200 p-8 animate-fade-in">
        {activeTab === 'topics' && (
          <div className="space-y-6">
            <h3 className="font-bold text-slate-800 text-2xl">Conteúdos do {settings.activeQuarter}º Bimestre</h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <select className="px-4 py-3 bg-slate-50 border rounded-xl" value={selectedSubject} onChange={(e) => setSelectedSubject(e.target.value as Subject)}>
                <option>História</option><option>Filosofia</option><option>Geografia</option><option>Sociologia</option>
              </select>
              <select className="px-4 py-3 bg-slate-50 border rounded-xl" value={selectedGrade} onChange={(e) => setSelectedGrade(e.target.value)}>
                <option>1ª</option><option>2ª</option><option>3ª</option>
              </select>
            </div>
            <textarea className="w-full h-32 px-5 py-4 bg-slate-50 border rounded-2xl outline-none focus:ring-2 focus:ring-blue-500" placeholder="Conteúdos para prova oficial..." value={newTopic} onChange={(e) => setNewTopic(e.target.value)} />
            <button onClick={handleSaveTopic} disabled={loading || !newTopic} className="w-full bg-slate-900 text-white font-bold py-4 rounded-2xl flex justify-center gap-2">
              {loading ? <Loader2 className="animate-spin" size={20}/> : <Send size={18}/>} Enviar para o Admin
            </button>
          </div>
        )}

        {activeTab === 'activities' && (
          <div className="space-y-8">
            <div className="flex flex-col lg:flex-row gap-8">
              <div className="flex-1 space-y-6 bg-slate-50 p-6 rounded-3xl border border-slate-100">
                <h3 className="font-bold text-lg text-slate-800 flex items-center gap-2"><Sparkles className="text-blue-600"/> Nova Atividade Extra por IA</h3>
                <div className="grid grid-cols-2 gap-3">
                  <select className="px-3 py-2 bg-white border rounded-xl text-sm" value={selectedSubject} onChange={(e) => setSelectedSubject(e.target.value as Subject)}>
                    <option>História</option><option>Filosofia</option><option>Geografia</option><option>Sociologia</option>
                  </select>
                  <select className="px-3 py-2 bg-white border rounded-xl text-sm" value={selectedGrade} onChange={(e) => setSelectedGrade(e.target.value)}>
                    <option>1ª</option><option>2ª</option><option>3ª</option>
                  </select>
                </div>
                <div className="space-y-2">
                  <label className="text-[10px] font-black uppercase text-slate-400">Turma (Opcional)</label>
                  <select className="w-full px-3 py-2 bg-white border rounded-xl text-sm" value={selectedClass} onChange={(e) => setSelectedClass(e.target.value)}>
                    {classes.map(c => <option key={c} value={c}>{c}</option>)}
                  </select>
                </div>
                <div className="space-y-2">
                  <label className="text-[10px] font-black uppercase text-slate-400">Tema da Atividade</label>
                  <input className="w-full px-4 py-3 bg-white border rounded-xl outline-none" placeholder="Ex: Revolução Industrial e seus impactos..." value={extraTheme} onChange={(e) => setExtraTheme(e.target.value)} />
                </div>
                <button onClick={handleGenerateExtra} disabled={loading || !extraTheme} className="w-full bg-blue-600 text-white font-bold py-3 rounded-xl flex justify-center gap-2">
                  {loading ? <Loader2 className="animate-spin" size={18}/> : <Sparkles size={18}/>} Gerar com IA
                </button>

                {generatedQuestions && (
                  <div className="mt-4 p-4 bg-white rounded-2xl border border-blue-100 animate-fade-in">
                    <h4 className="font-bold text-blue-700 mb-3 text-sm underline">Pré-visualização da IA:</h4>
                    <div className="space-y-4 mb-4">
                      {generatedQuestions.map((q, i) => (
                        <div key={i} className="text-xs">
                          <p className="font-bold text-slate-700">{i+1}. {q.question}</p>
                          <p className="text-slate-400 italic">Tipo: {q.type === 'multiple' ? 'Múltipla Escolha' : 'Aberta'}</p>
                        </div>
                      ))}
                    </div>
                    <button onClick={handlePublishActivity} className="w-full bg-green-600 text-white font-bold py-3 rounded-xl flex justify-center gap-2">
                      <Send size={18}/> Enviar Atividade para os Alunos
                    </button>
                  </div>
                )}
              </div>

              <div className="flex-1 space-y-6">
                <h3 className="font-bold text-lg text-slate-800 flex items-center gap-2"><ListChecks className="text-blue-600"/> Atividades Enviadas</h3>
                <div className="space-y-3">
                  {myActivities.map(act => (
                    <div key={act.id} className="p-4 bg-white border border-slate-200 rounded-2xl shadow-sm hover:border-blue-500 transition-all">
                      <div className="flex justify-between items-start mb-2">
                        <div>
                          <p className="text-[10px] font-black text-blue-600 uppercase tracking-widest">{act.subject} • {act.grade} Série {act.className ? `• ${act.className}` : ''}</p>
                          <h4 className="font-bold text-slate-800">{act.theme}</h4>
                        </div>
                        <button 
                          onClick={() => {
                            setViewingResults(act.id);
                            fetchSubmissions(act.id);
                          }} 
                          className="p-2 bg-blue-50 text-blue-600 rounded-lg hover:bg-blue-600 hover:text-white transition-all"
                        >
                          <Users size={18}/>
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {viewingResults && (
              <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm z-[100] flex items-center justify-center p-4">
                <div className="bg-white w-full max-w-4xl rounded-3xl shadow-2xl overflow-hidden animate-fade-in max-h-[85vh] flex flex-col">
                  <div className="p-6 border-b flex justify-between items-center bg-slate-50">
                    <h3 className="font-bold text-xl text-slate-800">Notas da IA - {myActivities.find(a => a.id === viewingResults)?.theme}</h3>
                    <button onClick={() => setViewingResults(null)} className="p-2 bg-slate-200 rounded-full hover:bg-slate-300">✕</button>
                  </div>
                  <div className="p-6 overflow-y-auto flex-1">
                    <table className="w-full">
                      <thead>
                        <tr className="text-left text-[10px] font-black text-slate-400 uppercase tracking-widest border-b">
                          <th className="pb-4">Estudante</th>
                          <th className="pb-4">Nota (0-10)</th>
                          <th className="pb-4">Feedback da IA</th>
                        </tr>
                      </thead>
                      <tbody>
                        {submissions.map(sub => (
                          <tr key={sub.id} className="border-b last:border-0 hover:bg-slate-50 transition-colors">
                            <td className="py-4 font-bold text-slate-700 text-sm">{sub.studentName}</td>
                            <td className="py-4"><span className={`font-black text-lg ${sub.score >= 6 ? 'text-green-600' : 'text-red-500'}`}>{sub.score.toFixed(1)}</span></td>
                            <td className="py-4 text-xs text-slate-500 italic max-w-xs">{sub.feedback}</td>
                          </tr>
                        ))}
                        {submissions.length === 0 && <tr><td colSpan={3} className="py-12 text-center text-slate-400 italic">Nenhum aluno respondeu ainda.</td></tr>}
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

export default TeacherDashboard;
