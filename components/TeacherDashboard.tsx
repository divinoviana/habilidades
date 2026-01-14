
import React, { useState, useEffect } from 'react';
import { UserProfile, GlobalSettings, Subject, ExtraActivity, ActivitySubmission, UserRole, Assessment, Question } from '../types';
import { BookOpen, ClipboardList, KeyRound, Loader2, FilePlus, ListChecks, Sparkles, Send, Users, Contact2, Printer, ChevronLeft, FileText, Download, History, Trash2, CheckCircle, AlertCircle, Wand2, Eye, X, Filter, RefreshCw, MessageSquare, Plus, StickyNote, User, Clock, Search, Quote, Edit3, Save, Book, ChevronDown } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { generateExtraActivity } from '../services/geminiService';

interface StudentObservation {
  id: string;
  student_id: string;
  teacher_id: string;
  content: string;
  created_at: string;
}

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
  const [resultsView, setResultsView] = useState<'official' | 'extra'>('official');
  
  const teacherSubjects = currentUser.subjects || [];
  const [selectedSubject, setSelectedSubject] = useState<Subject>(teacherSubjects[0] || 'História');
  
  const [selectedGrade, setSelectedGrade] = useState('1ª');
  const [selectedClass, setSelectedClass] = useState('Todas'); 
  const [loading, setLoading] = useState(false);
  
  const [myTopicsHistory, setMyTopicsHistory] = useState<any[]>([]);
  const [myActivities, setMyActivities] = useState<ExtraActivity[]>([]);
  const [students, setStudents] = useState<UserProfile[]>([]);
  const [officialResults, setOfficialResults] = useState<any[]>([]);
  const [extraResults, setExtraResults] = useState<any[]>([]);
  const [viewingResult, setViewingResult] = useState<any | null>(null);
  
  const [extraTheme, setExtraTheme] = useState('');
  const [genQuestions, setGenQuestions] = useState<any[] | null>(null);

  const [editingTopicId, setEditingTopicId] = useState<string | null>(null);
  const [editTopicContent, setEditTopicContent] = useState('');
  const [newTopic, setNewTopic] = useState('');

  useEffect(() => {
    fetchMyTopics();
    fetchMyActivities();
  }, [selectedSubject]);

  useEffect(() => {
    if (activeTab === 'carometro') fetchStudents();
    if (activeTab === 'official_results') {
        if (resultsView === 'official') fetchOfficialResults();
        else fetchExtraResults();
    }
  }, [activeTab, resultsView, selectedGrade, selectedClass, selectedSubject]);

  const fetchMyTopics = async () => {
    const { data } = await supabase
      .from('topics')
      .select('*')
      .eq('teacher_id', currentUser.id)
      .eq('subject', selectedSubject)
      .order('created_at', { ascending: false });
    if (data) setMyTopicsHistory(data);
  };

  const fetchMyActivities = async () => {
    const { data } = await supabase
      .from('extra_activities')
      .select('*')
      .eq('teacher_id', currentUser.id)
      .eq('subject', selectedSubject)
      .order('created_at', { ascending: false });
    if (data) setMyActivities(data.map(d => ({ ...d, teacherId: d.teacher_id, createdAt: d.created_at })));
  };

  const fetchOfficialResults = async () => {
    setLoading(true);
    let query = supabase
      .from('assessments')
      .select('*, profiles(full_name, class_name)')
      .eq('subject', selectedSubject)
      .eq('quarter', settings.activeQuarter)
      .eq('grade', selectedGrade);

    const { data } = await query.order('created_at', { ascending: false });

    if (data) {
      const filtered = data
        .filter(d => selectedClass === 'Todas' || d.profiles?.class_name === selectedClass)
        .map(d => ({
          ...d,
          studentName: d.profiles?.full_name,
          className: d.profiles?.class_name
        }));
      setOfficialResults(filtered);
    }
    setLoading(false);
  };

  const fetchExtraResults = async () => {
    setLoading(true);
    const { data } = await supabase
      .from('activity_submissions')
      .select('*, profiles(full_name, class_name), extra_activities(theme, questions)')
      .eq('subject', selectedSubject)
      .eq('grade', selectedGrade)
      .order('created_at', { ascending: false });

    if (data) {
      const filtered = data
        .filter(d => selectedClass === 'Todas' || d.profiles?.class_name === selectedClass)
        .map(d => ({
          ...d,
          studentName: d.profiles?.full_name,
          className: d.profiles?.class_name,
          theme: d.theme || d.extra_activities?.theme,
          questions: d.extra_activities?.questions
        }));
      setExtraResults(filtered);
    }
    setLoading(false);
  };

  const handleDeleteTopic = async (id: string) => {
    if (!confirm("Excluir este planejamento?")) return;
    const { error } = await supabase.from('topics').delete().eq('id', id);
    if (!error) fetchMyTopics();
  };

  const handleUpdateTopic = async () => {
    if (!editingTopicId || !editTopicContent) return;
    setLoading(true);
    const { error } = await supabase.from('topics').update({ content: editTopicContent }).eq('id', editingTopicId);
    if (!error) { setEditingTopicId(null); fetchMyTopics(); alert("Planejamento atualizado!"); }
    setLoading(false);
  };

  const handleDeleteActivity = async (id: string) => {
    if (!confirm("Excluir esta atividade?")) return;
    const { error } = await supabase.from('extra_activities').delete().eq('id', id);
    if (!error) fetchMyActivities();
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
    if (!error) { setNewTopic(''); fetchMyTopics(); alert("Planejamento enviado!"); }
    setLoading(false);
  };

  const fetchStudents = async () => {
    setLoading(true);
    let query = supabase.from('profiles').select('*').eq('role', 'student').eq('grade', selectedGrade);
    if (selectedClass !== 'Todas') query = query.eq('class_name', selectedClass);
    const { data } = await query.order('full_name', { ascending: true });
    if (data) setStudents(data.map(u => ({ ...u, fullName: u.full_name, role: u.role as UserRole, avatarUrl: u.avatar_url })));
    setLoading(false);
  };

  const handleGenerateExtra = async () => {
    if(!extraTheme) { alert("Por favor, digite um tema."); return; }
    setLoading(true);
    setGenQuestions(null);
    try {
      const qs = await generateExtraActivity(selectedSubject, extraTheme, selectedGrade);
      if (qs && qs.length > 0) setGenQuestions(qs);
    } catch(e: any) { alert("Falha na geração: " + e.message); }
    finally { setLoading(false); }
  };

  const handlePublishActivity = async () => {
    if (!genQuestions) return;
    setLoading(true);
    try {
      const { error } = await supabase.from('extra_activities').insert([{ 
          teacher_id: currentUser.id, 
          subject: selectedSubject, 
          grade: selectedGrade, 
          theme: extraTheme, 
          questions: genQuestions 
      }]);
      if (error) throw error;
      setGenQuestions(null); 
      setExtraTheme(''); 
      fetchMyActivities();
      alert("Atividade extra publicada!");
    } catch (e: any) { alert("Erro ao publicar: " + e.message); }
    finally { setLoading(false); }
  };

  return (
    <div className="space-y-6">
      <div className="bg-slate-900 rounded-[32px] p-8 text-white flex flex-col md:flex-row justify-between items-center gap-6 shadow-xl relative overflow-hidden">
        <div className="absolute top-0 right-0 p-8 opacity-5"><Book size={100}/></div>
        <div className="flex items-center gap-6 z-10">
            <div className="bg-blue-600 p-4 rounded-3xl shadow-lg shadow-blue-500/20">
                <Book size={28}/>
            </div>
            <div>
                <p className="text-[10px] font-black uppercase text-blue-400 tracking-widest mb-1">Contexto de Atuação</p>
                {teacherSubjects.length > 1 ? (
                  <select 
                    className="bg-white/10 hover:bg-white/20 border border-white/10 text-xl font-black uppercase px-4 py-2 rounded-2xl outline-none"
                    value={selectedSubject}
                    onChange={(e) => setSelectedSubject(e.target.value as Subject)}
                  >
                    {teacherSubjects.map(s => <option key={s} value={s} className="bg-slate-900 text-white">{s}</option>)}
                  </select>
                ) : (
                  <h2 className="text-2xl font-black uppercase tracking-tight">{selectedSubject}</h2>
                )}
            </div>
        </div>
        <div className="text-[10px] font-black uppercase bg-white/10 px-4 py-2 rounded-xl border border-white/10">
            Bimestre {settings.activeQuarter}º
        </div>
      </div>

      <div className="flex flex-wrap gap-2 overflow-x-auto pb-2 no-print">
        <button onClick={() => setActiveTab('topics')} className={`flex items-center gap-2 px-5 py-3 rounded-xl font-bold whitespace-nowrap transition-all ${activeTab === 'topics' ? 'bg-blue-600 text-white shadow-lg' : 'bg-white border text-slate-500'}`}><BookOpen size={18}/> Planejamento</button>
        <button onClick={() => setActiveTab('activities')} className={`flex items-center gap-2 px-5 py-3 rounded-xl font-bold whitespace-nowrap transition-all ${activeTab === 'activities' ? 'bg-blue-600 text-white shadow-lg' : 'bg-white border text-slate-500'}`}><FilePlus size={18}/> Atividades Extras</button>
        <button onClick={() => setActiveTab('official_results')} className={`flex items-center gap-2 px-5 py-3 rounded-xl font-bold whitespace-nowrap transition-all ${activeTab === 'official_results' ? 'bg-blue-600 text-white shadow-lg' : 'bg-white border text-slate-500'}`}><ListChecks size={18}/> Resultados Oficiais</button>
        <button onClick={() => setActiveTab('carometro')} className={`flex items-center gap-2 px-5 py-3 rounded-xl font-bold whitespace-nowrap transition-all ${activeTab === 'carometro' ? 'bg-blue-600 text-white shadow-lg' : 'bg-white border text-slate-500'}`}><Contact2 size={18}/> Carômetro</button>
      </div>

      <div className="bg-white rounded-3xl shadow-sm border border-slate-200 p-8 animate-fade-in no-print min-h-[500px]">
        {activeTab === 'topics' && (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
            <div className="lg:col-span-2 space-y-6">
              <h3 className="font-bold text-slate-800 text-2xl tracking-tighter">Planejamento Pedagógico</h3>
              <div className="flex gap-4">
                <select className="px-4 py-3 bg-slate-50 border rounded-xl font-bold" value={selectedGrade} onChange={(e) => setSelectedGrade(e.target.value)}>
                  <option>1ª</option><option>2ª</option><option>3ª</option>
                </select>
              </div>
              <textarea 
                className="w-full h-48 px-5 py-4 border rounded-2xl bg-slate-50" 
                placeholder="Temas para a prova oficial..." 
                value={editingTopicId ? editTopicContent : newTopic} 
                onChange={(e) => editingTopicId ? setEditTopicContent(e.target.value) : setNewTopic(e.target.value)} 
              />
              <button onClick={editingTopicId ? handleUpdateTopic : handleSaveTopic} disabled={loading} className="w-full bg-slate-900 text-white font-bold py-4 rounded-2xl flex justify-center gap-2">
                {loading ? <Loader2 className="animate-spin"/> : <Send size={18}/>} Enviar Planejamento
              </button>
            </div>
            <div className="bg-slate-50 p-6 rounded-3xl border border-slate-200 space-y-4">
              <h4 className="font-bold text-slate-400 uppercase text-[10px] tracking-widest flex items-center gap-2"><History size={14}/> Histórico</h4>
              <div className="space-y-3">
                {myTopicsHistory.map(t => (
                  <div key={t.id} className="p-4 bg-white border rounded-2xl shadow-sm">
                    <span className="text-[9px] font-black text-blue-600 uppercase tracking-widest">{t.grade} Série</span>
                    <p className="text-xs text-slate-600 italic line-clamp-2">"{t.content}"</p>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {activeTab === 'activities' && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
            <div className="bg-slate-50 p-8 rounded-[40px] border border-slate-200 space-y-4">
              <h3 className="font-black text-slate-800 text-xl tracking-tighter">Gerar Atividade IA</h3>
              <input className="w-full p-4 border rounded-2xl bg-white outline-none" placeholder="Tema da atividade..." value={extraTheme} onChange={e => setExtraTheme(e.target.value)}/>
              <button onClick={handleGenerateExtra} disabled={loading} className="w-full bg-blue-600 text-white font-black py-4 rounded-2xl flex justify-center gap-2">
                {loading ? <Loader2 className="animate-spin"/> : <Wand2 size={20}/>} Criar Atividade
              </button>
              {genQuestions && (
                <button onClick={handlePublishActivity} className="w-full bg-slate-900 text-white font-bold py-4 rounded-2xl mt-4">PUBLICAR ATIVIDADE</button>
              )}
            </div>
            <div className="space-y-3">
              <h4 className="font-black text-slate-400 uppercase text-[10px] tracking-widest">Atividades Publicadas</h4>
              {myActivities.map(act => (
                <div key={act.id} className="p-5 bg-white border rounded-3xl flex justify-between items-center shadow-sm">
                  <div>
                    <p className="font-black text-slate-800 text-sm tracking-tight">{act.theme}</p>
                    <p className="text-[9px] uppercase font-black text-slate-400 tracking-widest">{act.grade} Série</p>
                  </div>
                  <button onClick={() => handleDeleteActivity(act.id)} className="text-red-400 p-2"><Trash2 size={16}/></button>
                </div>
              ))}
            </div>
          </div>
        )}

        {activeTab === 'official_results' && (
          <div className="space-y-6">
            <div className="flex justify-between items-center">
                <h3 className="text-2xl font-black text-slate-800 tracking-tighter uppercase">Resultados Pedagógicos</h3>
                <div className="flex bg-slate-100 p-1 rounded-2xl">
                    <button onClick={() => setResultsView('official')} className={`px-4 py-2 rounded-xl text-[10px] font-black uppercase transition-all ${resultsView === 'official' ? 'bg-white text-blue-600 shadow-sm' : 'text-slate-400'}`}>Avaliações Oficiais</button>
                    <button onClick={() => setResultsView('extra')} className={`px-4 py-2 rounded-xl text-[10px] font-black uppercase transition-all ${resultsView === 'extra' ? 'bg-white text-blue-600 shadow-sm' : 'text-slate-400'}`}>Atividades Extras</button>
                </div>
            </div>
            
            <div className="grid grid-cols-2 gap-4">
                <select className="px-4 py-3 bg-slate-50 border rounded-xl font-bold" value={selectedGrade} onChange={(e) => setSelectedGrade(e.target.value)}>
                  <option>1ª</option><option>2ª</option><option>3ª</option>
                </select>
                <select className="px-4 py-3 bg-slate-50 border rounded-xl font-bold" value={selectedClass} onChange={(e) => setSelectedClass(e.target.value)}>
                    <option value="Todas">Todas Turmas</option>
                    {CLASSES_BY_GRADE[selectedGrade]?.map(c => <option key={c} value={c}>{c}</option>)}
                </select>
            </div>

            <div className="overflow-hidden border rounded-[32px] shadow-sm">
              <table className="w-full text-left">
                <thead className="bg-slate-50 border-b">
                  <tr>
                    <th className="px-6 py-4 text-[10px] font-black uppercase tracking-widest">Estudante</th>
                    {resultsView === 'extra' && <th className="px-6 py-4 text-[10px] font-black uppercase tracking-widest">Atividade</th>}
                    <th className="px-6 py-4 text-[10px] font-black uppercase text-center tracking-widest">Nota</th>
                    <th className="px-6 py-4 text-right"></th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {(resultsView === 'official' ? officialResults : extraResults).map(res => (
                    <tr key={res.id} className="hover:bg-slate-50">
                      <td className="px-6 py-4 font-bold text-slate-700">{res.studentName}</td>
                      {resultsView === 'extra' && <td className="px-6 py-4 text-slate-500 text-xs">{res.theme}</td>}
                      <td className="px-6 py-4 text-center font-black text-blue-600 text-lg">{res.score.toFixed(1)}</td>
                      <td className="px-6 py-4 text-right">
                        <button onClick={() => setViewingResult(res)} className="p-2 bg-blue-50 text-blue-600 rounded-xl"><Eye size={18}/></button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {loading && <div className="p-20 text-center"><Loader2 className="animate-spin mx-auto text-slate-300" size={40}/></div>}
              {!(resultsView === 'official' ? officialResults : extraResults).length && !loading && <div className="p-20 text-center text-slate-300 italic">Nenhum resultado encontrado para este filtro.</div>}
            </div>
          </div>
        )}

        {activeTab === 'carometro' && (
           <div className="space-y-8">
               <div className="flex justify-between items-center bg-slate-50 p-6 rounded-[32px] border border-slate-100">
                    <h4 className="font-black text-slate-800 text-lg tracking-tight uppercase">Explorar Estudantes</h4>
                    <div className="flex gap-2">
                        <select className="px-3 py-2 bg-white border rounded-xl font-bold text-xs" value={selectedGrade} onChange={(e) => setSelectedGrade(e.target.value)}>
                            <option>1ª</option><option>2ª</option><option>3ª</option>
                        </select>
                        <select className="px-3 py-2 bg-white border rounded-xl font-bold text-xs" value={selectedClass} onChange={(e) => setSelectedClass(e.target.value)}>
                            <option value="Todas">Todas Turmas</option>
                            {CLASSES_BY_GRADE[selectedGrade]?.map(c => <option key={c} value={c}>{c}</option>)}
                        </select>
                    </div>
               </div>
               <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-6">
                {students.map(s => (
                    <div key={s.id} className="text-center group">
                    <div className="aspect-[3/4] rounded-[24px] overflow-hidden border-4 border-white shadow-xl">
                        {s.avatarUrl ? <img src={s.avatarUrl} className="w-full h-full object-cover"/> : <div className="w-full h-full bg-slate-100 flex items-center justify-center text-slate-300"><User size={40}/></div>}
                    </div>
                    <p className="text-[10px] font-black uppercase text-slate-700 tracking-tighter mt-2">{s.fullName}</p>
                    </div>
                ))}
               </div>
           </div>
        )}
      </div>

      {viewingResult && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-md z-[100] flex items-center justify-center p-4">
          <div className="bg-white w-full max-w-4xl rounded-[48px] shadow-2xl overflow-hidden flex flex-col max-h-[90vh] animate-fade-in">
            <div className="p-8 bg-slate-900 text-white flex justify-between items-center">
              <div>
                  <h3 className="font-black text-xl tracking-tighter uppercase">{viewingResult.studentName}</h3>
                  <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">{viewingResult.subject} • {resultsView === 'official' ? 'Avaliação Oficial' : 'Atividade Extra'}</p>
              </div>
              <button onClick={() => setViewingResult(null)} className="p-3 bg-white/10 rounded-full hover:bg-white/20"><X size={20}/></button>
            </div>

            <div className="p-10 overflow-y-auto space-y-10">
               <div className="flex justify-between border-b pb-8">
                  <div>
                    <h4 className="font-black text-3xl text-slate-800 tracking-tighter">Relatório IA Frederico</h4>
                    <p className="text-blue-600 font-black text-xl">Nota: {viewingResult.score.toFixed(1)} / 10.0</p>
                  </div>
                  <div className="text-right">
                    <p className="text-[10px] font-black text-slate-300 uppercase">Data</p>
                    <p className="font-bold text-slate-600">{new Date(viewingResult.created_at).toLocaleDateString()}</p>
                  </div>
               </div>

               <div className="p-6 bg-blue-50 border border-blue-100 rounded-[32px]">
                   <p className="text-[10px] font-black text-blue-500 uppercase mb-2 tracking-widest">Feedback Pedagógico</p>
                   <p className="text-slate-700 leading-relaxed italic">"{viewingResult.feedback}"</p>
               </div>

               <div className="space-y-8">
                  <h5 className="font-black text-slate-800 uppercase text-xs tracking-widest border-b pb-2">Respostas do Estudante</h5>
                  {resultsView === 'official' ? (
                      viewingResult.questions?.map((q: Question, i: number) => (
                        <div key={i} className="space-y-2 pb-6 border-b border-slate-50 last:border-0">
                           <p className="font-black text-slate-800 text-sm">{i+1}. {q.text}</p>
                           <div className={`p-4 rounded-xl border text-xs ${viewingResult.answers[i] === q.correctIndex ? 'bg-green-50 border-green-200' : 'bg-red-50 border-red-200'}`}>
                              Sua resposta: {String.fromCharCode(65 + viewingResult.answers[i])} • {q.options[viewingResult.answers[i]]}
                           </div>
                        </div>
                      ))
                  ) : (
                      viewingResult.questions?.map((q: any, i: number) => (
                        <div key={i} className="space-y-2 pb-6 border-b border-slate-50 last:border-0">
                           <p className="font-black text-slate-800 text-sm">{i+1}. {q.question}</p>
                           <div className="p-4 bg-slate-50 rounded-xl text-xs italic text-slate-600">
                              {q.type === 'multiple' 
                                ? `Escolha: ${q.options?.[viewingResult.answers[i]] || 'Sem resposta'}` 
                                : `Dissertação: ${viewingResult.answers[i] || 'Sem resposta'}`}
                           </div>
                        </div>
                      ))
                  )}
               </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default TeacherDashboard;
