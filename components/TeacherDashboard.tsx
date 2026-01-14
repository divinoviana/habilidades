
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
  
  const teacherSubjects = currentUser.subjects || [];
  const [selectedSubject, setSelectedSubject] = useState<Subject>(teacherSubjects[0] || 'História');
  
  const [selectedGrade, setSelectedGrade] = useState('1ª');
  const [selectedClass, setSelectedClass] = useState('Todas'); 
  const [loading, setLoading] = useState(false);
  
  const [myTopicsHistory, setMyTopicsHistory] = useState<any[]>([]);
  const [myActivities, setMyActivities] = useState<ExtraActivity[]>([]);
  const [students, setStudents] = useState<UserProfile[]>([]);
  const [officialResults, setOfficialResults] = useState<any[]>([]);
  const [viewingAssessment, setViewingAssessment] = useState<any | null>(null);
  
  const [extraTheme, setExtraTheme] = useState('');
  const [genQuestions, setGenQuestions] = useState<any[] | null>(null);

  const [selectedStudent, setSelectedStudent] = useState<UserProfile | null>(null);
  const [observations, setObservations] = useState<StudentObservation[]>([]);

  const [editingTopicId, setEditingTopicId] = useState<string | null>(null);
  const [editTopicContent, setEditTopicContent] = useState('');
  const [newTopic, setNewTopic] = useState('');

  useEffect(() => {
    fetchMyTopics();
    fetchMyActivities();
  }, [selectedSubject]);

  useEffect(() => {
    if (activeTab === 'carometro') fetchStudents();
    if (activeTab === 'official_results') fetchOfficialResults();
  }, [activeTab, selectedGrade, selectedClass, selectedSubject]);

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

  const handleOpenStudent = (student: UserProfile) => {
    setSelectedStudent(student);
  };

  const handleGenerateExtra = async () => {
    if(!extraTheme) { alert("Por favor, digite um tema."); return; }
    setLoading(true);
    setGenQuestions(null);
    try {
      const qs = await generateExtraActivity(selectedSubject, extraTheme, selectedGrade);
      if (qs && qs.length > 0) {
        setGenQuestions(qs);
        console.log("IA Frederico gerou:", qs);
      } else {
        alert("A IA Frederico retornou uma lista vazia. Tente mudar o tema ou a série.");
      }
    } catch(e: any) { 
      console.error("Erro no Dashboard ao gerar atividade:", e);
      alert("Falha na geração: " + e.message); 
    } finally {
      setLoading(false);
    }
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
      alert("Atividade extra publicada para os alunos!");
    } catch (e: any) {
      alert("Erro ao publicar: " + e.message);
    } finally {
      setLoading(false);
    }
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
                  <div className="relative group">
                    <select 
                      className="bg-white/10 hover:bg-white/20 border border-white/10 text-xl font-black uppercase tracking-tight px-4 py-2 rounded-2xl outline-none cursor-pointer appearance-none pr-10 transition-all"
                      value={selectedSubject}
                      onChange={(e) => setSelectedSubject(e.target.value as Subject)}
                    >
                      {teacherSubjects.map(s => <option key={s} value={s} className="bg-slate-900 text-white">{s}</option>)}
                    </select>
                    <ChevronDown size={18} className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none text-blue-400"/>
                  </div>
                ) : (
                  <h2 className="text-2xl font-black uppercase tracking-tight">{selectedSubject}</h2>
                )}
            </div>
        </div>
        <div className="flex flex-col items-end z-10">
            <div className="text-[10px] font-black uppercase bg-white/10 px-4 py-2 rounded-xl border border-white/10">
                Bimestre {settings.activeQuarter}º
            </div>
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
              <h3 className="font-bold text-slate-800 text-2xl tracking-tighter">Planejamento Pedagógico - {selectedSubject}</h3>
              <div className="grid grid-cols-2 gap-4">
                <select className="px-4 py-3 bg-slate-50 border rounded-xl font-bold" value={selectedGrade} onChange={(e) => setSelectedGrade(e.target.value)}>
                  <option>1ª</option><option>2ª</option><option>3ª</option>
                </select>
              </div>
              <textarea 
                className="w-full h-48 px-5 py-4 border rounded-2xl outline-none focus:ring-2 focus:ring-blue-500 bg-slate-50" 
                placeholder="Temas para a prova oficial..." 
                value={editingTopicId ? editTopicContent : newTopic} 
                onChange={(e) => editingTopicId ? setEditTopicContent(e.target.value) : setNewTopic(e.target.value)} 
              />
              <button onClick={editingTopicId ? handleUpdateTopic : handleSaveTopic} disabled={loading} className="w-full bg-slate-900 text-white font-bold py-4 rounded-2xl flex justify-center gap-2 disabled:opacity-50">
                {loading ? <Loader2 className="animate-spin"/> : editingTopicId ? <Save size={18}/> : <Send size={18}/>} 
                {editingTopicId ? 'Salvar Alterações' : 'Enviar Planejamento'}
              </button>
            </div>
            <div className="bg-slate-50 p-6 rounded-3xl border border-slate-200 space-y-4">
              <h4 className="font-bold text-slate-400 uppercase text-[10px] tracking-widest flex items-center gap-2"><History size={14}/> Histórico de {selectedSubject}</h4>
              <div className="space-y-3">
                {myTopicsHistory.map(t => (
                  <div key={t.id} className="p-4 bg-white border rounded-2xl group shadow-sm">
                    <div className="flex justify-between items-start mb-2">
                      <span className="text-[9px] font-black text-blue-600 uppercase tracking-widest">{t.grade} Série</span>
                      <div className="flex gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                        <button onClick={() => { setEditingTopicId(t.id); setEditTopicContent(t.content); setSelectedGrade(t.grade); }}><Edit3 size={14}/></button>
                        <button onClick={() => handleDeleteTopic(t.id)}><Trash2 size={14}/></button>
                      </div>
                    </div>
                    <p className="text-xs text-slate-600 italic line-clamp-3">"{t.content}"</p>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {activeTab === 'activities' && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
            <div className="bg-slate-50 p-8 rounded-[40px] border border-slate-200 space-y-4">
              <h3 className="font-black text-slate-800 text-xl tracking-tighter">Gerar Atividade - {selectedSubject}</h3>
              <p className="text-[10px] text-slate-400 uppercase font-bold tracking-widest">Mistura questões abertas e fechadas</p>
              <input className="w-full p-4 border rounded-2xl bg-white outline-none focus:ring-2 focus:ring-blue-500" placeholder="Ex: A crise de 1929 e o New Deal..." value={extraTheme} onChange={e => setExtraTheme(e.target.value)}/>
              <button onClick={handleGenerateExtra} disabled={loading} className="w-full bg-blue-600 text-white font-black py-4 rounded-2xl flex justify-center gap-2 hover:bg-blue-700 transition-all shadow-lg disabled:opacity-50">
                {loading ? <Loader2 className="animate-spin"/> : <Wand2 size={20}/>} Criar Atividade com IA
              </button>
              {genQuestions && (
                <div className="space-y-4 animate-fade-in pt-4 border-t border-slate-200">
                  <div className="bg-green-50 p-4 rounded-2xl flex items-center gap-3 border border-green-100">
                    <CheckCircle className="text-green-500" size={20}/>
                    <p className="text-xs font-bold text-green-700">5 questões geradas com sucesso!</p>
                  </div>
                  <button onClick={handlePublishActivity} disabled={loading} className="w-full bg-slate-900 text-white font-bold py-4 rounded-2xl shadow-xl hover:scale-105 transition-all disabled:opacity-50">
                    PUBLICAR PARA OS ALUNOS
                  </button>
                </div>
              )}
            </div>
            <div className="space-y-4">
              <h4 className="font-black text-slate-400 uppercase text-[10px] tracking-widest flex items-center gap-2 mb-4">Publicadas ({selectedSubject})</h4>
              <div className="space-y-3 overflow-y-auto max-h-[500px]">
                {myActivities.map(act => (
                  <div key={act.id} className="p-5 bg-white border rounded-3xl flex justify-between items-center group shadow-sm hover:border-blue-100 transition-all">
                    <div>
                      <p className="font-black text-slate-800 text-sm tracking-tight">{act.theme}</p>
                      <p className="text-[9px] uppercase font-black text-slate-400 tracking-widest">{act.grade} Série</p>
                    </div>
                    <button onClick={() => handleDeleteActivity(act.id)} className="text-red-400 p-2 hover:bg-red-50 rounded-xl transition-all"><Trash2 size={16}/></button>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {activeTab === 'official_results' && (
          <div className="space-y-6">
            <h3 className="text-2xl font-black text-slate-800 tracking-tighter uppercase">Resultados: {selectedSubject}</h3>
            <div className="overflow-hidden border rounded-[32px] shadow-sm">
              <table className="w-full text-left">
                <thead className="bg-slate-50 border-b">
                  <tr>
                    <th className="px-6 py-4 text-[10px] font-black uppercase tracking-widest">Estudante</th>
                    <th className="px-6 py-4 text-[10px] font-black uppercase text-center tracking-widest">Nota</th>
                    <th className="px-6 py-4 text-right"></th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {officialResults.map(res => (
                    <tr key={res.id} className="hover:bg-slate-50">
                      <td className="px-6 py-4 font-bold text-slate-700">{res.studentName}</td>
                      <td className="px-6 py-4 text-center font-black text-blue-600 text-lg">{res.score.toFixed(1)}</td>
                      <td className="px-6 py-4 text-right"><button onClick={() => setViewingAssessment(res)} className="p-2 bg-blue-50 text-blue-600 rounded-xl"><Eye size={18}/></button></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {activeTab === 'carometro' && (
           <div className="space-y-8">
               <div className="flex justify-between items-center bg-slate-50 p-6 rounded-[32px] border border-slate-100">
                    <div>
                        <h4 className="font-black text-slate-800 text-lg tracking-tight uppercase">Explorar Estudantes</h4>
                        <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Carregando identidades visuais dos alunos</p>
                    </div>
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
                    <div key={s.id} onClick={() => handleOpenStudent(s)} className="text-center cursor-pointer group">
                    <div className="aspect-[3/4] rounded-[24px] overflow-hidden border-4 border-white group-hover:border-blue-500 transition-all mb-2 shadow-xl">
                        {s.avatarUrl ? <img src={s.avatarUrl} className="w-full h-full object-cover"/> : <div className="w-full h-full bg-slate-100 flex items-center justify-center text-slate-300"><User size={40}/></div>}
                    </div>
                    <p className="text-[10px] font-black uppercase text-slate-700 tracking-tighter line-clamp-1">{s.fullName}</p>
                    </div>
                ))}
               </div>
           </div>
        )}
      </div>

      {viewingAssessment && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-md z-[100] flex items-center justify-center p-4">
          <div className="bg-white w-full max-w-4xl rounded-[48px] shadow-2xl overflow-hidden flex flex-col max-h-[90vh] animate-fade-in">
            <div className="p-8 bg-slate-900 text-white flex justify-between items-center no-print">
              <div className="flex items-center gap-4">
                <div className="bg-blue-600 p-2 rounded-xl"><User size={20}/></div>
                <div>
                    <h3 className="font-black text-xl tracking-tighter uppercase">{viewingAssessment.studentName}</h3>
                    <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">{viewingAssessment.subject} • Bimestre {viewingAssessment.quarter}</p>
                </div>
              </div>
              <div className="flex gap-4">
                <button onClick={window.print} className="p-3 bg-white/10 rounded-full hover:bg-white/20 transition-all"><Printer size={20}/></button>
                <button onClick={() => setViewingAssessment(null)} className="p-3 bg-white/10 rounded-full hover:bg-white/20 transition-all"><X size={20}/></button>
              </div>
            </div>

            <div className="p-10 overflow-y-auto space-y-10 print:p-0">
               <div className="flex justify-between border-b pb-8">
                  <div>
                    <h4 className="font-black text-3xl text-slate-800 tracking-tighter">Relatório de Desempenho</h4>
                    <p className="text-blue-600 font-black text-xl">Nota: {viewingAssessment.score.toFixed(1)} / 10.0</p>
                  </div>
                  <div className="text-right">
                    <p className="text-[10px] font-black text-slate-300 uppercase">Data de Realização</p>
                    <p className="font-bold text-slate-600">{new Date(viewingAssessment.created_at).toLocaleDateString()}</p>
                  </div>
               </div>

               <div className="space-y-12">
                  {viewingAssessment.questions?.map((q: Question, i: number) => {
                    const studentAns = viewingAssessment.answers ? viewingAssessment.answers[i] : -1;
                    const isCorrect = studentAns === q.correctIndex;
                    return (
                      <div key={i} className="space-y-4 border-b border-slate-50 pb-10 last:border-0 page-break-inside-avoid">
                         <div className="flex justify-between">
                            <span className="bg-slate-900 text-white text-[9px] font-black px-3 py-1 rounded-lg uppercase tracking-widest">Questão {i+1}</span>
                            <span className={`text-[10px] font-black px-3 py-1 rounded-lg uppercase tracking-widest ${isCorrect ? 'bg-green-50 text-green-600' : 'bg-red-50 text-red-600'}`}>{isCorrect ? 'RESPOSTA CORRETA' : 'RESPOSTA INCORRETA'}</span>
                         </div>
                         {q.citation && <div className="p-4 bg-slate-50 border-l-2 border-blue-600 italic text-slate-600 text-sm leading-relaxed rounded-r-xl">"{q.citation}"</div>}
                         <p className="font-black text-slate-800 text-lg leading-tight">{q.text}</p>
                         <div className="grid gap-2">
                           {q.options.map((opt, oIdx) => (
                             <div key={oIdx} className={`p-4 rounded-xl border text-xs flex items-center gap-4 transition-all ${oIdx === q.correctIndex ? 'bg-green-50 border-green-200 text-green-800 font-bold' : oIdx === studentAns ? 'bg-red-50 border-red-200 text-red-800 font-bold' : 'bg-white border-slate-100 text-slate-400'}`}>
                               <span className={`w-8 h-8 flex items-center justify-center rounded-lg font-black ${oIdx === q.correctIndex ? 'bg-green-600 text-white' : oIdx === studentAns ? 'bg-red-600 text-white' : 'bg-slate-100'}`}>{String.fromCharCode(65+oIdx)}</span> {opt}
                               {oIdx === q.correctIndex && <CheckCircle size={14} className="ml-auto text-green-600"/>}
                             </div>
                           ))}
                         </div>
                         <div className="p-5 bg-blue-50/50 rounded-2xl border border-blue-100">
                           <p className="text-[9px] font-black text-blue-500 uppercase mb-2 tracking-widest">Análise Pedagógica</p>
                           <p className="text-xs text-slate-600 italic leading-relaxed">"{q.explanation}"</p>
                         </div>
                      </div>
                    )
                  })}
               </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default TeacherDashboard;
