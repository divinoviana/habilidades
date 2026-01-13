
import React, { useState, useEffect } from 'react';
import { UserProfile, GlobalSettings, Subject, ExtraActivity, ActivitySubmission, UserRole, Assessment } from '../types';
import { BookOpen, ClipboardList, KeyRound, Loader2, FilePlus, ListChecks, Sparkles, Send, Users, Contact2, Printer, ChevronLeft, FileText, Download, History, Trash2, CheckCircle, AlertCircle, Wand2, Eye, X } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { generateExtraActivity } from '../services/geminiService';

interface TeacherDashboardProps {
  currentUser: UserProfile;
  settings: GlobalSettings;
}

const CLASSES_BY_GRADE: { [key: string]: string[] } = {
  "1ª": ["13.01", "13.02", "13.03", "13.04", "13.05", "13.06"],
  "2ª": ["23.01", "23.02", "23.03", "23.04", "23.05", "23.06", "23.07", "23.08"],
  "3ª": ["33.01", "33.02", "33.03", "33.04", "33.05", "33.06", "33.07", "33.08"]
};

const TeacherDashboard: React.FC<TeacherDashboardProps> = ({ currentUser, settings }) => {
  const [activeTab, setActiveTab] = useState<'topics' | 'activities' | 'carometro' | 'official_results'>('topics');
  const [selectedSubject, setSelectedSubject] = useState<Subject>('História');
  const [selectedGrade, setSelectedGrade] = useState('1ª');
  const [selectedClass, setSelectedClass] = useState('Todas');
  const [loading, setLoading] = useState(false);
  
  const [myTopicsHistory, setMyTopicsHistory] = useState<any[]>([]);
  const [myActivities, setMyActivities] = useState<ExtraActivity[]>([]);
  const [students, setStudents] = useState<UserProfile[]>([]);
  
  // States para Nova Atividade
  const [extraTheme, setExtraTheme] = useState('');
  const [genQuestions, setGenQuestions] = useState<any[] | null>(null);

  // States para Visualização de Resultados
  const [viewingActivity, setViewingActivity] = useState<ExtraActivity | null>(null);
  const [submissions, setSubmissions] = useState<ActivitySubmission[]>([]);

  useEffect(() => {
    fetchMyTopics();
    fetchMyActivities();
  }, []);

  useEffect(() => {
    if (activeTab === 'carometro') fetchStudents();
  }, [activeTab, selectedGrade, selectedClass]);

  const fetchMyTopics = async () => {
    const { data } = await supabase.from('topics').select('*').eq('teacher_id', currentUser.id).order('created_at', { ascending: false });
    if (data) setMyTopicsHistory(data);
  };

  const fetchMyActivities = async () => {
    const { data } = await supabase.from('extra_activities').select('*').eq('teacher_id', currentUser.id).order('created_at', { ascending: false });
    if (data) setMyActivities(data.map(d => ({ ...d, teacherId: d.teacher_id, createdAt: d.created_at })));
  };

  const fetchSubmissions = async (activity: ExtraActivity) => {
    setLoading(true);
    setViewingActivity(activity);
    const { data, error } = await supabase
      .from('activity_submissions')
      .select('*, profiles(full_name)')
      .eq('activity_id', activity.id)
      .order('created_at', { ascending: false });

    if (data) {
      setSubmissions(data.map(d => ({
        ...d,
        activityId: d.activity_id,
        studentId: d.student_id,
        studentName: d.profiles?.full_name,
        createdAt: d.created_at
      })));
    }
    setLoading(false);
  };

  const fetchStudents = async () => {
    let query = supabase.from('profiles').select('*').eq('role', 'student').eq('grade', selectedGrade);
    if (selectedClass !== 'Todas') query = query.eq('class_name', selectedClass);
    const { data } = await query.order('full_name');
    if (data) setStudents(data.map(u => ({ ...u, fullName: u.full_name, role: u.role as UserRole, avatarUrl: u.avatar_url })));
  };

  const handleSaveTopic = async () => {
    if (!newTopic) return;
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
      fetchMyTopics();
      alert("Planejamento enviado!");
    }
    setLoading(false);
  };
  const [newTopic, setNewTopic] = useState('');

  const handleGenerateActivity = async () => {
    if (!extraTheme) return;
    setLoading(true);
    try {
      const qs = await generateExtraActivity(selectedSubject, extraTheme, selectedGrade);
      setGenQuestions(qs);
    } catch (e: any) {
      alert(e.message);
    } finally {
      setLoading(false);
    }
  };

  const handlePublishActivity = async () => {
    if (!genQuestions) return;
    setLoading(true);
    const { error } = await supabase.from('extra_activities').insert([{
      teacher_id: currentUser.id,
      subject: selectedSubject,
      grade: selectedGrade,
      class_name: selectedClass === 'Todas' ? null : selectedClass,
      theme: extraTheme,
      questions: genQuestions
    }]);

    if (!error) {
      alert("Atividade publicada para os alunos!");
      setGenQuestions(null);
      setExtraTheme('');
      fetchMyActivities();
    } else {
      alert("Erro ao publicar: " + error.message);
    }
    setLoading(false);
  };

  const handleDeleteActivity = async (id: string) => {
    if (!confirm("Excluir esta atividade?")) return;
    await supabase.from('extra_activities').delete().eq('id', id);
    fetchMyActivities();
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap gap-2 overflow-x-auto pb-2 no-print">
        <button onClick={() => setActiveTab('topics')} className={`flex items-center gap-2 px-5 py-3 rounded-xl font-bold whitespace-nowrap transition-all ${activeTab === 'topics' ? 'bg-blue-600 text-white shadow-lg' : 'bg-white border text-slate-500'}`}><BookOpen size={18}/> Planejamento</button>
        <button onClick={() => setActiveTab('activities')} className={`flex items-center gap-2 px-5 py-3 rounded-xl font-bold whitespace-nowrap transition-all ${activeTab === 'activities' ? 'bg-blue-600 text-white shadow-lg' : 'bg-white border text-slate-500'}`}><FilePlus size={18}/> Atividades Extras</button>
        <button onClick={() => setActiveTab('carometro')} className={`flex items-center gap-2 px-5 py-3 rounded-xl font-bold whitespace-nowrap transition-all ${activeTab === 'carometro' ? 'bg-blue-600 text-white shadow-lg' : 'bg-white border text-slate-500'}`}><Contact2 size={18}/> Carômetro</button>
      </div>

      <div className="bg-white rounded-3xl shadow-sm border border-slate-200 p-8 animate-fade-in no-print">
        {activeTab === 'topics' && (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
            <div className="lg:col-span-2 space-y-6">
              <h3 className="font-bold text-slate-800 text-2xl">Novo Planejamento - {settings.activeQuarter}º Bimestre</h3>
              <div className="grid grid-cols-2 gap-4">
                <select className="px-4 py-3 bg-slate-50 border rounded-xl font-bold" value={selectedSubject} onChange={(e) => setSelectedSubject(e.target.value as Subject)}>
                  <option>História</option><option>Filosofia</option><option>Geografia</option><option>Sociologia</option>
                </select>
                <select className="px-4 py-3 bg-slate-50 border rounded-xl font-bold" value={selectedGrade} onChange={(e) => setSelectedGrade(e.target.value)}>
                  <option>1ª</option><option>2ª</option><option>3ª</option>
                </select>
              </div>
              <textarea className="w-full h-48 px-5 py-4 border rounded-2xl outline-none focus:ring-2 focus:ring-blue-500 bg-slate-50" placeholder="Digite os temas, competências e tópicos..." value={newTopic} onChange={(e) => setNewTopic(e.target.value)} />
              <button onClick={handleSaveTopic} disabled={loading || !newTopic} className="w-full bg-slate-900 text-white font-bold py-4 rounded-2xl flex justify-center gap-2 disabled:opacity-50">
                {loading ? <Loader2 className="animate-spin" size={20}/> : <Send size={18}/>} Enviar Planejamento
              </button>
            </div>
            
            <div className="bg-slate-50 p-6 rounded-3xl border border-slate-200 space-y-4">
              <h4 className="font-bold text-slate-800 flex items-center gap-2"><History size={18} className="text-blue-600"/> Meus Envios</h4>
              <div className="space-y-3 overflow-y-auto max-h-[500px] pr-2">
                {myTopicsHistory.map(t => (
                  <div key={t.id} className="p-3 bg-white border rounded-xl text-xs space-y-1">
                    <p className="font-black text-blue-600 uppercase">{t.subject} • {t.grade}</p>
                    <p className="text-slate-600 line-clamp-2 italic">"{t.content}"</p>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {activeTab === 'activities' && (
          <div className="space-y-10">
            {viewingActivity ? (
              <div className="animate-in fade-in duration-300 space-y-6">
                <div className="flex items-center justify-between border-b pb-4">
                  <div className="flex items-center gap-4">
                    <button onClick={() => setViewingActivity(null)} className="p-2 hover:bg-slate-100 rounded-full text-slate-400"><ChevronLeft/></button>
                    <div>
                      <h3 className="text-2xl font-black text-slate-800">{viewingActivity.theme}</h3>
                      <p className="text-slate-400 text-xs uppercase font-bold tracking-widest">{viewingActivity.subject} • {viewingActivity.grade} série</p>
                    </div>
                  </div>
                  <button onClick={() => setViewingActivity(null)} className="p-2 text-slate-400 hover:text-red-500"><X/></button>
                </div>

                <div className="overflow-hidden border border-slate-100 rounded-[32px] bg-slate-50/50 shadow-inner">
                  <table className="w-full text-left">
                    <thead className="bg-white border-b border-slate-100">
                      <tr>
                        <th className="px-6 py-4 text-[10px] font-black uppercase text-slate-400 tracking-widest">Estudante</th>
                        <th className="px-6 py-4 text-[10px] font-black uppercase text-slate-400 tracking-widest text-center">Nota</th>
                        <th className="px-6 py-4 text-[10px] font-black uppercase text-slate-400 tracking-widest">Retorno do Professor</th>
                        <th className="px-6 py-4 text-[10px] font-black uppercase text-slate-400 tracking-widest">Data</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {submissions.map(sub => (
                        <tr key={sub.id} className="hover:bg-white transition-colors">
                          <td className="px-6 py-4">
                            <p className="font-bold text-slate-700">{sub.studentName}</p>
                            <p className="text-[10px] text-slate-400 font-medium">Submetido via Web</p>
                          </td>
                          <td className="px-6 py-4 text-center">
                            <span className={`text-xl font-black ${sub.score >= 6 ? 'text-green-600' : 'text-red-500'}`}>{sub.score.toFixed(1)}</span>
                          </td>
                          <td className="px-6 py-4 max-w-xs">
                            <p className="text-xs text-slate-600 italic line-clamp-2">"{sub.feedback}"</p>
                          </td>
                          <td className="px-6 py-4 text-[10px] font-bold text-slate-400">
                            {new Date(sub.createdAt).toLocaleDateString()}
                          </td>
                        </tr>
                      ))}
                      {submissions.length === 0 && (
                        <tr>
                          <td colSpan={4} className="px-6 py-12 text-center text-slate-400 italic text-sm">Nenhum aluno respondeu esta atividade ainda.</td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            ) : (
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-10">
                <div className="space-y-6 bg-slate-50 p-8 rounded-[32px] border border-slate-100">
                  <h3 className="text-xl font-bold text-slate-800 flex items-center gap-2"><Sparkles className="text-blue-600"/> Gerar Atividade Bimestral</h3>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                    <select className="px-4 py-3 bg-white border rounded-xl font-bold text-sm" value={selectedSubject} onChange={(e) => setSelectedSubject(e.target.value as Subject)}>
                        <option>História</option><option>Filosofia</option><option>Geografia</option><option>Sociologia</option>
                    </select>
                    <select className="px-4 py-3 bg-white border rounded-xl font-bold text-sm" value={selectedGrade} onChange={(e) => setSelectedGrade(e.target.value)}>
                        <option>1ª</option><option>2ª</option><option>3ª</option>
                    </select>
                    <select className="px-4 py-3 bg-white border rounded-xl font-bold text-sm" value={selectedClass} onChange={(e) => setSelectedClass(e.target.value)}>
                        <option value="Todas">Todas as Turmas</option>
                        {CLASSES_BY_GRADE[selectedGrade]?.map(c => <option key={c} value={c}>Turma {c}</option>)}
                    </select>
                  </div>
                  <input 
                    className="w-full px-5 py-4 bg-white border rounded-2xl font-medium outline-none focus:ring-2 focus:ring-blue-500" 
                    placeholder="Ex: Revolução Industrial, Ética de Kant, Globalização..." 
                    value={extraTheme}
                    onChange={(e) => setExtraTheme(e.target.value)}
                  />
                  <button 
                    onClick={handleGenerateActivity}
                    disabled={loading || !extraTheme}
                    className="w-full bg-blue-600 text-white font-bold py-4 rounded-2xl shadow-lg shadow-blue-100 hover:bg-blue-700 transition-all flex justify-center items-center gap-2 disabled:opacity-50"
                  >
                    {loading ? <Loader2 className="animate-spin" size={20}/> : <Wand2 size={20}/>} Gerar Avaliação Bimestral
                  </button>
                </div>

                <div className="space-y-6">
                  <h3 className="text-xl font-bold text-slate-800">Atividades Publicadas</h3>
                  <div className="space-y-3">
                    {myActivities.map(act => (
                      <div key={act.id} className="p-5 border rounded-[24px] bg-white hover:border-blue-200 transition-all group flex flex-col gap-4">
                        <div className="flex justify-between items-start">
                          <div>
                            <p className="text-[10px] font-black text-blue-600 uppercase tracking-widest">{act.subject} • {act.grade} Série {act.className ? `• ${act.className}` : '(Todas)'}</p>
                            <h4 className="font-bold text-slate-800 text-lg">{act.theme}</h4>
                          </div>
                          <button onClick={() => handleDeleteActivity(act.id)} className="p-2 text-slate-200 hover:text-red-500 transition-colors"><Trash2 size={18}/></button>
                        </div>
                        <button 
                          onClick={() => fetchSubmissions(act)}
                          className="flex items-center justify-center gap-2 w-full py-3 bg-slate-50 text-slate-600 rounded-xl text-xs font-black uppercase tracking-widest hover:bg-blue-600 hover:text-white transition-all shadow-sm"
                        >
                          <Eye size={16}/> Ver Notas e Respostas
                        </button>
                      </div>
                    ))}
                    {myActivities.length === 0 && <p className="text-center py-12 text-slate-400 italic text-sm">Nenhuma atividade criada ainda.</p>}
                  </div>
                </div>
              </div>
            )}

            {genQuestions && !viewingActivity && (
              <div className="animate-in fade-in slide-in-from-bottom-4 duration-500 bg-white border-2 border-blue-500 rounded-[40px] p-10 space-y-8 shadow-2xl">
                <div className="flex justify-between items-center border-b pb-6">
                  <div>
                    <h3 className="text-2xl font-black text-slate-800">Revisão da Avaliação Bimestral</h3>
                    <p className="text-slate-500">Confira as questões geradas antes de enviar para os alunos.</p>
                  </div>
                  <div className="flex gap-3">
                    <button onClick={() => setGenQuestions(null)} className="px-6 py-3 font-bold text-slate-400 hover:text-slate-600">Descartar</button>
                    <button onClick={handlePublishActivity} className="bg-blue-600 text-white px-8 py-3 rounded-2xl font-black flex items-center gap-2 shadow-lg shadow-blue-100 hover:scale-105 transition-all"><Send size={18}/> Publicar para {selectedClass === 'Todas' ? `toda a ${selectedGrade} série` : `a turma ${selectedClass}`}</button>
                  </div>
                </div>
                <div className="space-y-6">
                  {genQuestions.map((q, idx) => (
                    <div key={idx} className="p-6 bg-slate-50 rounded-2xl space-y-4">
                      <p className="font-bold text-slate-800">{idx + 1}. {q.question}</p>
                      {q.type === 'multiple' && (
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                          {q.options.map((opt: string, oIdx: number) => (
                            <div key={oIdx} className={`p-3 rounded-xl border text-sm ${q.correctAnswer === oIdx ? 'bg-green-50 border-green-200 text-green-700 font-bold' : 'bg-white border-slate-100'}`}>
                              {String.fromCharCode(65 + oIdx)}. {opt}
                            </div>
                          ))}
                        </div>
                      )}
                      {q.type === 'open' && <div className="p-4 bg-white border border-dashed rounded-xl text-xs text-slate-400">Resposta aberta do aluno</div>}
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {activeTab === 'carometro' && (
           <div className="space-y-8">
            <div className="flex flex-col md:flex-row justify-between items-center gap-6 border-b pb-6">
              <h3 className="font-bold text-slate-800 text-2xl">Carômetro Escolar</h3>
              <div className="flex gap-3">
                <select className="px-4 py-2 border rounded-xl font-bold" value={selectedGrade} onChange={(e) => setSelectedGrade(e.target.value)}><option>1ª</option><option>2ª</option><option>3ª</option></select>
                <select className="px-4 py-2 border rounded-xl font-bold" value={selectedClass} onChange={(e) => setSelectedClass(e.target.value)}>{["Todas", ...(CLASSES_BY_GRADE[selectedGrade] || [])].map(c => <option key={c} value={c}>{c}</option>)}</select>
              </div>
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-6 gap-6">
              {students.map(s => (
                <div key={s.id} className="text-center group">
                  <div className="aspect-[4/5] bg-slate-100 rounded-2xl overflow-hidden mb-2 border-2 border-transparent group-hover:border-blue-500 transition-all">
                    {s.avatarUrl ? <img src={s.avatarUrl} className="w-full h-full object-cover"/> : <div className="w-full h-full flex items-center justify-center text-slate-300"><Users size={32}/></div>}
                  </div>
                  <p className="text-sm font-bold text-slate-800 leading-tight">{s.fullName}</p>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default TeacherDashboard;
