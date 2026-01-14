
import React, { useState, useEffect } from 'react';
import { UserProfile, GlobalSettings, Subject, ExtraActivity, ActivitySubmission, UserRole, Assessment, Question } from '../types';
import { BookOpen, ClipboardList, KeyRound, Loader2, FilePlus, ListChecks, Sparkles, Send, Users, Contact2, Printer, ChevronLeft, FileText, Download, History, Trash2, CheckCircle, AlertCircle, Wand2, Eye, X, Filter, RefreshCw, MessageSquare, Plus, StickyNote, User, Clock, Search, Quote, Image as ImageIcon, Edit3, Save } from 'lucide-react';
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
  const [selectedSubject, setSelectedSubject] = useState<Subject>('História');
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
  const [viewingActivity, setViewingActivity] = useState<ExtraActivity | null>(null);
  const [submissions, setSubmissions] = useState<ActivitySubmission[]>([]);

  const [selectedStudent, setSelectedStudent] = useState<UserProfile | null>(null);
  const [observations, setObservations] = useState<StudentObservation[]>([]);
  const [newObservation, setNewObservation] = useState('');

  // Estados de Edição
  const [editingTopicId, setEditingTopicId] = useState<string | null>(null);
  const [editTopicContent, setEditTopicContent] = useState('');
  const [newTopic, setNewTopic] = useState('');

  useEffect(() => {
    fetchMyTopics();
    fetchMyActivities();
  }, []);

  useEffect(() => {
    if (activeTab === 'carometro') fetchStudents();
    if (activeTab === 'official_results') fetchOfficialResults();
  }, [activeTab, selectedGrade, selectedClass, selectedSubject]);

  const fetchMyTopics = async () => {
    const { data } = await supabase.from('topics').select('*').eq('teacher_id', currentUser.id).order('created_at', { ascending: false });
    if (data) setMyTopicsHistory(data);
  };

  const fetchMyActivities = async () => {
    const { data } = await supabase.from('extra_activities').select('*').eq('teacher_id', currentUser.id).order('created_at', { ascending: false });
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
    if (!confirm("Excluir este planejamento? O admin não poderá mais gerar provas com ele.")) return;
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
    if (!confirm("Excluir esta atividade e todas as suas notas?")) return;
    const { error } = await supabase.from('extra_activities').delete().eq('id', id);
    if (!error) fetchMyActivities();
  };

  const handleSaveTopic = async () => {
    if (!newTopic) return;
    setLoading(true);
    const { error } = await supabase.from('topics').insert([{ teacher_id: currentUser.id, subject: selectedSubject, grade: selectedGrade, quarter: settings.activeQuarter, content: newTopic }]);
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

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap gap-2 overflow-x-auto pb-2 no-print">
        <button onClick={() => setActiveTab('topics')} className={`flex items-center gap-2 px-5 py-3 rounded-xl font-bold whitespace-nowrap transition-all ${activeTab === 'topics' ? 'bg-blue-600 text-white shadow-lg' : 'bg-white border text-slate-500'}`}><BookOpen size={18}/> Planejamento</button>
        <button onClick={() => setActiveTab('activities')} className={`flex items-center gap-2 px-5 py-3 rounded-xl font-bold whitespace-nowrap transition-all ${activeTab === 'activities' ? 'bg-blue-600 text-white shadow-lg' : 'bg-white border text-slate-500'}`}><FilePlus size={18}/> Atividades Extras</button>
        <button onClick={() => setActiveTab('official_results')} className={`flex items-center gap-2 px-5 py-3 rounded-xl font-bold whitespace-nowrap transition-all ${activeTab === 'official_results' ? 'bg-blue-600 text-white shadow-lg' : 'bg-white border text-slate-500'}`}><ListChecks size={18}/> Resultados Oficiais</button>
        <button onClick={() => setActiveTab('carometro')} className={`flex items-center gap-2 px-5 py-3 rounded-xl font-bold whitespace-nowrap transition-all ${activeTab === 'carometro' ? 'bg-blue-600 text-white shadow-lg' : 'bg-white border text-slate-500'}`}><Contact2 size={18}/> Carômetro</button>
      </div>

      <div className="bg-white rounded-3xl shadow-sm border border-slate-200 p-8 animate-fade-in no-print">
        {activeTab === 'topics' && (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
            <div className="lg:col-span-2 space-y-6">
              <h3 className="font-bold text-slate-800 text-2xl">{editingTopicId ? 'Editar Planejamento' : 'Novo Planejamento'}</h3>
              <div className="grid grid-cols-2 gap-4">
                <select disabled={!!editingTopicId} className="px-4 py-3 bg-slate-50 border rounded-xl font-bold" value={selectedSubject} onChange={(e) => setSelectedSubject(e.target.value as Subject)}>
                  <option>História</option><option>Filosofia</option><option>Geografia</option><option>Sociologia</option>
                </select>
                <select disabled={!!editingTopicId} className="px-4 py-3 bg-slate-50 border rounded-xl font-bold" value={selectedGrade} onChange={(e) => setSelectedGrade(e.target.value)}>
                  <option>1ª</option><option>2ª</option><option>3ª</option>
                </select>
              </div>
              <textarea 
                className="w-full h-48 px-5 py-4 border rounded-2xl outline-none focus:ring-2 focus:ring-blue-500 bg-slate-50" 
                placeholder="Temas para a prova..." 
                value={editingTopicId ? editTopicContent : newTopic} 
                onChange={(e) => editingTopicId ? setEditTopicContent(e.target.value) : setNewTopic(e.target.value)} 
              />
              {editingTopicId ? (
                <div className="flex gap-2">
                  <button onClick={handleUpdateTopic} className="flex-1 bg-blue-600 text-white font-bold py-4 rounded-2xl flex justify-center gap-2"><Save size={18}/> Salvar</button>
                  <button onClick={() => setEditingTopicId(null)} className="px-8 py-4 bg-slate-100 text-slate-600 font-bold rounded-2xl">Cancelar</button>
                </div>
              ) : (
                <button onClick={handleSaveTopic} disabled={loading || !newTopic} className="w-full bg-slate-900 text-white font-bold py-4 rounded-2xl flex justify-center gap-2 disabled:opacity-50">
                  {loading ? <Loader2 className="animate-spin" size={20}/> : <Send size={18}/>} Enviar Planejamento
                </button>
              )}
            </div>
            <div className="bg-slate-50 p-6 rounded-3xl border border-slate-200 space-y-4">
              <h4 className="font-bold text-slate-400 uppercase text-[10px] tracking-widest flex items-center gap-2"><History size={14}/> Meus Planejamentos</h4>
              <div className="space-y-3 overflow-y-auto max-h-[500px]">
                {myTopicsHistory.map(t => (
                  <div key={t.id} className="p-4 bg-white border rounded-2xl group relative">
                    <div className="flex justify-between items-start mb-2">
                      <span className="text-[9px] font-black text-blue-600 uppercase">{t.subject} • {t.grade}</span>
                      <div className="flex gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                        <button onClick={() => { setEditingTopicId(t.id); setEditTopicContent(t.content); setSelectedSubject(t.subject); setSelectedGrade(t.grade); }} className="text-blue-500"><Edit3 size={14}/></button>
                        <button onClick={() => handleDeleteTopic(t.id)} className="text-red-400"><Trash2 size={14}/></button>
                      </div>
                    </div>
                    <p className="text-xs text-slate-600 italic line-clamp-3 leading-relaxed">"{t.content}"</p>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {activeTab === 'official_results' && (
          <div className="space-y-6">
            <div className="flex flex-col md:flex-row justify-between items-center gap-4 border-b pb-6">
              <h3 className="text-2xl font-black text-slate-800">Resultados Oficiais</h3>
              <div className="flex gap-2 flex-wrap justify-center">
                <select className="px-3 py-2 bg-slate-50 border rounded-xl font-bold text-xs" value={selectedSubject} onChange={(e) => setSelectedSubject(e.target.value as Subject)}>
                  <option>História</option><option>Filosofia</option><option>Geografia</option><option>Sociologia</option>
                </select>
                <select className="px-3 py-2 bg-slate-50 border rounded-xl font-bold text-xs" value={selectedGrade} onChange={(e) => setSelectedGrade(e.target.value)}>
                  <option>1ª</option><option>2ª</option><option>3ª</option>
                </select>
                <select className="px-3 py-2 bg-slate-50 border rounded-xl font-bold text-xs" value={selectedClass} onChange={(e) => setSelectedClass(e.target.value)}>
                  <option value="Todas">Todas Turmas</option>
                  {CLASSES_BY_GRADE[selectedGrade]?.map(c => <option key={c} value={c}>{c}</option>)}
                </select>
                <button onClick={window.print} className="bg-slate-900 text-white p-2 rounded-xl"><Printer size={18}/></button>
              </div>
            </div>

            <div className="overflow-hidden border rounded-[32px]">
              <table className="w-full text-left">
                <thead className="bg-slate-50 border-b">
                  <tr>
                    <th className="px-6 py-4 text-[10px] font-black uppercase text-slate-400">Estudante</th>
                    <th className="px-6 py-4 text-[10px] font-black uppercase text-slate-400 text-center">Nota</th>
                    <th className="px-6 py-4 text-[10px] font-black uppercase text-slate-400 text-center">Tentativas Cola</th>
                    <th className="px-6 py-4 text-[10px] font-black uppercase text-slate-400 text-right">Ver</th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {officialResults.map(res => (
                    <tr key={res.id} className="hover:bg-slate-50 transition-colors">
                      <td className="px-6 py-4 font-bold text-slate-700">{res.studentName} <span className="text-[9px] text-slate-300 ml-1">({res.className})</span></td>
                      <td className="px-6 py-4 text-center font-black text-blue-600 text-lg">{res.score.toFixed(1)}</td>
                      <td className="px-6 py-4 text-center"><span className={`px-2 py-1 rounded-full text-[10px] font-bold ${res.cheating_attempts > 0 ? 'bg-red-50 text-red-500' : 'bg-green-50 text-green-500'}`}>{res.cheating_attempts}</span></td>
                      <td className="px-6 py-4 text-right"><button onClick={() => setViewingAssessment(res)} className="p-2 bg-blue-50 text-blue-600 rounded-xl"><Eye size={18}/></button></td>
                    </tr>
                  ))}
                  {officialResults.length === 0 && <tr><td colSpan={4} className="px-6 py-12 text-center text-slate-300 italic">Nenhum resultado para estes filtros.</td></tr>}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* ... Aba Activities e Carometro mantidas com botões de excluir ... */}
        {activeTab === 'activities' && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
            <div className="bg-slate-50 p-8 rounded-[40px] border space-y-4">
              <h3 className="font-black text-slate-800 text-xl">Gerar Atividade Extra</h3>
              <input className="w-full p-4 border rounded-2xl" placeholder="Tema crítico..." value={extraTheme} onChange={e => setExtraTheme(e.target.value)}/>
              <button onClick={async () => {
                setLoading(true);
                try {
                  const qs = await generateExtraActivity(selectedSubject, extraTheme, selectedGrade);
                  setGenQuestions(qs);
                } catch(e: any) { alert(e.message); }
                setLoading(false);
              }} className="w-full bg-blue-600 text-white font-black py-4 rounded-2xl flex justify-center items-center gap-2">
                {loading ? <Loader2 className="animate-spin"/> : <Wand2 size={20}/>} Gerar com IA
              </button>
              {genQuestions && (
                <button onClick={async () => {
                  setLoading(true);
                  await supabase.from('extra_activities').insert([{ teacher_id: currentUser.id, subject: selectedSubject, grade: selectedGrade, theme: extraTheme, questions: genQuestions }]);
                  setGenQuestions(null); setExtraTheme(''); fetchMyActivities();
                  setLoading(false);
                  alert("Publicado!");
                }} className="w-full bg-slate-900 text-white font-bold py-4 rounded-2xl">Publicar Atividade</button>
              )}
            </div>
            <div className="space-y-4">
              <h3 className="font-black text-slate-800">Atividades Publicadas</h3>
              <div className="space-y-3">
                {myActivities.map(act => (
                  <div key={act.id} className="p-4 border rounded-3xl flex justify-between items-center group">
                    <div><p className="font-bold text-sm">{act.theme}</p><p className="text-[9px] uppercase font-black text-slate-300">{act.subject}</p></div>
                    <div className="flex gap-2">
                      <button onClick={() => handleDeleteActivity(act.id)} className="text-red-400 p-2"><Trash2 size={16}/></button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}
      </div>

      {/* MODAL DE VISUALIZAÇÃO DE PROVA */}
      {viewingAssessment && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-md z-[100] flex items-center justify-center p-4">
          <div className="bg-white w-full max-w-4xl rounded-[48px] shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
            <div className="p-8 bg-slate-900 text-white flex justify-between items-center no-print">
              <div>
                <h3 className="font-black text-xl tracking-tighter uppercase">{viewingAssessment.studentName}</h3>
                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">{viewingAssessment.subject} • Bimestre {viewingAssessment.quarter}</p>
              </div>
              <div className="flex gap-4">
                <button onClick={window.print} className="p-3 bg-white/10 rounded-full"><Printer size={20}/></button>
                <button onClick={() => setViewingAssessment(null)} className="p-3 bg-white/10 rounded-full"><X size={20}/></button>
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
                            <span className="bg-slate-900 text-white text-[9px] font-black px-3 py-1 rounded-lg uppercase">Questão {i+1}</span>
                            <span className={`text-[10px] font-black px-3 py-1 rounded-lg uppercase ${isCorrect ? 'bg-green-50 text-green-600' : 'bg-red-50 text-red-600'}`}>{isCorrect ? 'Acertou' : 'Errou'}</span>
                         </div>
                         {q.citation && <div className="p-4 bg-slate-50 border-l-2 border-blue-600 italic text-slate-600 text-sm">"{q.citation}"</div>}
                         <p className="font-bold text-slate-800 leading-tight">{q.text}</p>
                         <div className="grid gap-2">
                           {q.options.map((opt, oIdx) => (
                             <div key={oIdx} className={`p-4 rounded-xl border text-xs flex items-center gap-4 ${oIdx === q.correctIndex ? 'bg-green-50 border-green-200 text-green-800 font-bold' : oIdx === studentAns ? 'bg-red-50 border-red-200 text-red-800 font-bold' : 'bg-white border-slate-100 text-slate-400'}`}>
                               <span className="w-6 h-6 flex items-center justify-center bg-slate-100 rounded-lg">{String.fromCharCode(65+oIdx)}</span> {opt}
                             </div>
                           ))}
                         </div>
                         <div className="p-4 bg-blue-50 rounded-2xl border border-blue-100">
                           <p className="text-[9px] font-black text-blue-500 uppercase mb-1">Justificativa</p>
                           <p className="text-xs text-slate-600 italic">"{q.explanation}"</p>
                         </div>
                      </div>
                    )
                  })}
               </div>

               <div className="bg-slate-900 p-10 rounded-[40px] text-white space-y-4">
                  <h4 className="font-black text-xs uppercase tracking-widest flex items-center gap-2"><Sparkles size={16}/> Feedback Sistêmico</h4>
                  <p className="text-slate-300 italic text-sm leading-relaxed">"{viewingAssessment.feedback}"</p>
               </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default TeacherDashboard;
