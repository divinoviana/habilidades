
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
  const [selectedClass, setSelectedClass] = useState('13.01'); 
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

  // Estados para Edição
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
    const { data } = await supabase
      .from('assessments')
      .select('*, profiles(full_name, class_name)')
      .eq('subject', selectedSubject)
      .eq('quarter', settings.activeQuarter)
      .order('created_at', { ascending: false });

    if (data) {
      const filtered = data
        .filter(d => d.profiles?.class_name === selectedClass || selectedClass === 'Todas')
        .map(d => ({
          ...d,
          studentName: d.profiles?.full_name,
          className: d.profiles?.class_name
        }));
      setOfficialResults(filtered);
    }
    setLoading(false);
  };

  const fetchSubmissions = async (activity: ExtraActivity) => {
    setLoading(true);
    setViewingActivity(activity);
    const { data } = await supabase
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
    setLoading(true);
    let query = supabase.from('profiles').select('*').eq('role', 'student').eq('grade', selectedGrade);
    if (selectedClass !== 'Todas') query = query.eq('class_name', selectedClass);
    const { data } = await query.order('full_name', { ascending: true });
    if (data) setStudents(data.map(u => ({ ...u, fullName: u.full_name, role: u.role as UserRole, avatarUrl: u.avatar_url })));
    setLoading(false);
  };

  const handleGradeChange = (grade: string) => {
    setSelectedGrade(grade);
    const availableClasses = CLASSES_BY_GRADE[grade] || [];
    setSelectedClass(availableClasses.length > 0 ? availableClasses[0] : 'Todas');
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
      alert("Planejamento enviado com sucesso!"); 
    } else {
      alert("Erro ao enviar planejamento.");
    }
    setLoading(false);
  };

  const handleUpdateTopic = async () => {
    if (!editingTopicId || !editTopicContent) return;
    setLoading(true);
    const { error } = await supabase.from('topics').update({ content: editTopicContent }).eq('id', editingTopicId);
    if (!error) {
      setEditingTopicId(null);
      fetchMyTopics();
      alert("Planejamento atualizado!");
    } else {
      alert("Erro ao atualizar.");
    }
    setLoading(false);
  };

  const handleDeleteTopic = async (id: string) => {
    if (!confirm("Tem certeza que deseja cancelar este planejamento? Ele não estará mais disponível para o administrador gerar provas.")) return;
    const { error } = await supabase.from('topics').delete().eq('id', id);
    if (!error) fetchMyTopics();
  };

  const handleDeleteActivity = async (id: string) => {
    if (!confirm("Excluir esta atividade permanentemente? Todas as notas e respostas dos alunos também serão apagadas.")) return;
    const { error } = await supabase.from('extra_activities').delete().eq('id', id);
    if (!error) fetchMyActivities();
  };

  const handleGenerateActivity = async () => {
    if (!extraTheme) return;
    setLoading(true);
    try {
      const qs = await generateExtraActivity(selectedSubject, extraTheme, selectedGrade);
      setGenQuestions(qs);
    } catch (e: any) { alert(e.message); } finally { setLoading(false); }
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
      alert("Atividade publicada com sucesso!"); 
      setGenQuestions(null); 
      setExtraTheme(''); 
      fetchMyActivities(); 
    } else {
      alert("Erro ao publicar atividade.");
    }
    setLoading(false);
  };

  const fetchObservations = async (studentId: string) => {
    const { data } = await supabase.from('student_observations').select('*').eq('student_id', studentId).order('created_at', { ascending: false });
    if (data) setObservations(data);
  };

  const handleOpenStudent = (student: UserProfile) => {
    setSelectedStudent(student);
    fetchObservations(student.id);
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
              <h3 className="font-bold text-slate-800 text-2xl">
                {editingTopicId ? 'Editar Planejamento' : `Novo Planejamento - ${settings.activeQuarter}º Bimestre`}
              </h3>
              <div className="grid grid-cols-2 gap-4">
                <select disabled={!!editingTopicId} className="px-4 py-3 bg-slate-50 border rounded-xl font-bold disabled:opacity-50" value={selectedSubject} onChange={(e) => setSelectedSubject(e.target.value as Subject)}>
                  <option>História</option><option>Filosofia</option><option>Geografia</option><option>Sociologia</option>
                </select>
                <select disabled={!!editingTopicId} className="px-4 py-3 bg-slate-50 border rounded-xl font-bold disabled:opacity-50" value={selectedGrade} onChange={(e) => handleGradeChange(e.target.value)}>
                  <option>1ª</option><option>2ª</option><option>3ª</option>
                </select>
              </div>
              <textarea 
                className="w-full h-48 px-5 py-4 border rounded-2xl outline-none focus:ring-2 focus:ring-blue-500 bg-slate-50" 
                placeholder="Descreva o conteúdo planejado para o bimestre..." 
                value={editingTopicId ? editTopicContent : newTopic} 
                onChange={(e) => editingTopicId ? setEditTopicContent(e.target.value) : setNewTopic(e.target.value)} 
              />
              <div className="flex gap-4">
                {editingTopicId ? (
                  <>
                    <button onClick={handleUpdateTopic} disabled={loading} className="flex-1 bg-blue-600 text-white font-bold py-4 rounded-2xl flex justify-center gap-2">
                      <Save size={18}/> Salvar Alterações
                    </button>
                    <button onClick={() => setEditingTopicId(null)} className="px-8 py-4 bg-slate-100 text-slate-600 font-bold rounded-2xl">Cancelar</button>
                  </>
                ) : (
                  <button onClick={handleSaveTopic} disabled={loading || !newTopic} className="w-full bg-slate-900 text-white font-bold py-4 rounded-2xl flex justify-center gap-2 disabled:opacity-50">
                    {loading ? <Loader2 className="animate-spin" size={20}/> : <Send size={18}/>} Enviar Planejamento ao Admin
                  </button>
                )}
              </div>
            </div>
            <div className="bg-slate-50 p-6 rounded-3xl border border-slate-200 space-y-4">
              <h4 className="font-bold text-slate-800 flex items-center gap-2 uppercase text-[10px] tracking-widest text-slate-400"><History size={14} /> Histórico de Planejamentos</h4>
              <div className="space-y-3 overflow-y-auto max-h-[500px] pr-2">
                {myTopicsHistory.map(t => (
                  <div key={t.id} className="p-4 bg-white border rounded-2xl space-y-3 group relative">
                    <div className="flex justify-between items-start">
                      <div>
                        <p className="font-black text-blue-600 text-[9px] uppercase tracking-widest">{t.subject} • {t.grade} Série</p>
                        <p className="text-[10px] text-slate-400 font-bold">{new Date(t.created_at).toLocaleDateString()}</p>
                      </div>
                      <div className="flex gap-1">
                        <button onClick={() => { setEditingTopicId(t.id); setEditTopicContent(t.content); setActiveTab('topics'); }} className="p-1.5 text-slate-400 hover:text-blue-600 transition-colors"><Edit3 size={14}/></button>
                        <button onClick={() => handleDeleteTopic(t.id)} className="p-1.5 text-slate-400 hover:text-red-600 transition-colors"><Trash2 size={14}/></button>
                      </div>
                    </div>
                    <p className="text-slate-600 italic text-xs leading-relaxed line-clamp-3">"{t.content}"</p>
                  </div>
                ))}
                {myTopicsHistory.length === 0 && <p className="text-center py-8 text-slate-300 text-xs italic">Nenhum envio registrado.</p>}
              </div>
            </div>
          </div>
        )}

        {activeTab === 'activities' && (
          <div className="space-y-6">
             {viewingActivity ? (
               <div className="space-y-4">
                  <div className="flex items-center gap-4 mb-6">
                    <button onClick={() => setViewingActivity(null)} className="p-2 bg-slate-100 rounded-xl"><ChevronLeft/></button>
                    <div>
                      <h3 className="text-xl font-black">{viewingActivity.theme}</h3>
                      <p className="text-[10px] text-slate-400 font-black uppercase tracking-widest">{viewingActivity.subject} • {viewingActivity.grade} série</p>
                    </div>
                  </div>
                  <div className="border rounded-[32px] overflow-hidden shadow-sm">
                    <table className="w-full text-left">
                      <thead className="bg-slate-50 border-b">
                        <tr>
                          <th className="px-6 py-4 text-xs font-bold text-slate-400">Estudante</th>
                          <th className="px-6 py-4 text-xs font-bold text-slate-400 text-center">Nota</th>
                          <th className="px-6 py-4 text-xs font-bold text-slate-400">Data de Envio</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y">
                        {submissions.map(s => (
                          <tr key={s.id} className="hover:bg-slate-50 transition-colors">
                            <td className="px-6 py-4 font-bold text-slate-700">{s.studentName}</td>
                            <td className="px-6 py-4 text-center font-black text-indigo-600">{s.score.toFixed(1)}</td>
                            <td className="px-6 py-4 text-xs text-slate-400">{new Date(s.createdAt).toLocaleDateString()} às {new Date(s.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</td>
                          </tr>
                        ))}
                        {submissions.length === 0 && <tr><td colSpan={3} className="px-6 py-12 text-center text-slate-300 italic">Nenhum envio recebido ainda.</td></tr>}
                      </tbody>
                    </table>
                  </div>
               </div>
             ) : (
               <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                  <div className="bg-slate-50 p-8 rounded-[40px] border border-slate-100 space-y-6">
                    <h3 className="font-black text-slate-800 text-xl tracking-tighter">Gerar Nova Atividade Extra</h3>
                    <div className="space-y-4">
                      <div className="grid grid-cols-2 gap-4">
                        <select className="px-4 py-3 bg-white border rounded-xl font-bold text-sm" value={selectedSubject} onChange={(e) => setSelectedSubject(e.target.value as Subject)}>
                          <option>História</option><option>Filosofia</option><option>Geografia</option><option>Sociologia</option>
                        </select>
                        <select className="px-4 py-3 bg-white border rounded-xl font-bold text-sm" value={selectedGrade} onChange={(e) => handleGradeChange(e.target.value)}>
                          <option>1ª</option><option>2ª</option><option>3ª</option>
                        </select>
                      </div>
                      <input className="w-full p-4 border rounded-2xl bg-white outline-none focus:ring-2 focus:ring-blue-500" placeholder="Digite o tema (ex: Revolução Francesa)..." value={extraTheme} onChange={e => setExtraTheme(e.target.value)}/>
                      <button onClick={handleGenerateActivity} disabled={loading || !extraTheme} className="w-full bg-blue-600 text-white font-black py-4 rounded-2xl flex justify-center items-center gap-2 hover:bg-blue-700 transition-all disabled:opacity-50">
                        {loading ? <Loader2 className="animate-spin" size={20}/> : <Wand2 size={20}/>} Gerar com IA (5 Questões)
                      </button>
                    </div>

                    {genQuestions && (
                      <div className="mt-6 p-6 bg-white border-2 border-blue-500 rounded-3xl space-y-4 animate-fade-in">
                        <div className="flex items-center gap-3 text-blue-600 font-black uppercase text-xs">
                          <CheckCircle size={18}/> Conteúdo Gerado com Sucesso!
                        </div>
                        <p className="text-xs text-slate-500 leading-relaxed italic">Foram geradas 5 questões variadas sobre o tema "{extraTheme}". Deseja publicar para os alunos?</p>
                        <button onClick={handlePublishActivity} className="w-full bg-slate-900 text-white font-bold py-4 rounded-2xl flex items-center justify-center gap-2 hover:scale-[1.02] transition-all"><Send size={18}/> Publicar Agora</button>
                      </div>
                    )}
                  </div>
                  <div className="space-y-4">
                    <h3 className="font-black text-slate-800 text-xl tracking-tighter">Atividades em Aberto</h3>
                    <div className="space-y-3 overflow-y-auto max-h-[600px] pr-2">
                      {myActivities.map(act => (
                        <div key={act.id} className="p-5 border rounded-3xl bg-white flex justify-between items-center group hover:border-indigo-200 transition-all">
                          <div className="space-y-1">
                            <p className="font-black text-slate-800">{act.theme}</p>
                            <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest">{act.subject} • {act.grade} Série</p>
                          </div>
                          <div className="flex gap-2">
                            <button onClick={() => fetchSubmissions(act)} className="p-2 bg-indigo-50 text-indigo-600 rounded-xl hover:bg-indigo-600 hover:text-white transition-all" title="Ver Notas"><Eye size={18}/></button>
                            <button onClick={() => handleDeleteActivity(act.id)} className="p-2 bg-red-50 text-red-600 rounded-xl hover:bg-red-600 hover:text-white transition-all" title="Excluir"><Trash2 size={18}/></button>
                          </div>
                        </div>
                      ))}
                      {myActivities.length === 0 && <p className="text-center py-12 text-slate-300 italic text-sm">Nenhuma atividade extra criada.</p>}
                    </div>
                  </div>
               </div>
             )}
          </div>
        )}

        {activeTab === 'official_results' && (
          <div className="space-y-6">
            <div className="flex flex-col md:flex-row justify-between items-center gap-4 border-b pb-6">
              <h3 className="text-2xl font-black text-slate-800 tracking-tighter">Relatórios de Desempenho</h3>
              <div className="flex gap-2">
                <select className="px-4 py-2 bg-slate-50 border rounded-xl font-bold text-sm" value={selectedSubject} onChange={(e) => setSelectedSubject(e.target.value as Subject)}>
                  <option>História</option><option>Filosofia</option><option>Geografia</option><option>Sociologia</option>
                </select>
                <select className="px-4 py-2 bg-slate-50 border rounded-xl font-bold text-sm" value={selectedGrade} onChange={(e) => handleGradeChange(e.target.value)}>
                  <option>1ª</option><option>2ª</option><option>3ª</option>
                </select>
                <select className="px-4 py-2 bg-slate-50 border rounded-xl font-bold text-sm" value={selectedClass} onChange={(e) => setSelectedClass(e.target.value)}>
                  <option value="Todas">Todas Turmas</option>
                  {CLASSES_BY_GRADE[selectedGrade]?.map(c => <option key={c} value={c}>{c}</option>)}
                </select>
                <button onClick={window.print} className="bg-slate-900 text-white p-2.5 rounded-xl hover:scale-105 transition-all"><Printer size={20}/></button>
              </div>
            </div>

            <div className="overflow-hidden border border-slate-100 rounded-[32px] shadow-sm">
              <table className="w-full text-left">
                <thead className="bg-slate-50 border-b">
                  <tr>
                    <th className="px-6 py-4 text-[10px] font-black uppercase text-slate-400">Estudante</th>
                    <th className="px-6 py-4 text-[10px] font-black uppercase text-slate-400">Turma</th>
                    <th className="px-6 py-4 text-[10px] font-black uppercase text-slate-400">Tipo</th>
                    <th className="px-6 py-4 text-[10px] font-black uppercase text-slate-400 text-center">Nota</th>
                    <th className="px-6 py-4 text-[10px] font-black uppercase text-slate-400">Detalhes</th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {officialResults.map(res => (
                    <tr key={res.id} className="hover:bg-slate-50 transition-colors">
                      <td className="px-6 py-4 font-bold text-slate-700">{res.studentName}</td>
                      <td className="px-6 py-4 font-bold text-slate-500">{res.className}</td>
                      <td className="px-6 py-4"><span className={`text-[9px] font-black px-2 py-1 rounded-full ${res.is_mock ? 'bg-amber-50 text-amber-600' : 'bg-blue-50 text-blue-600'}`}>{res.is_mock ? 'SIMULADO' : 'OFICIAL'}</span></td>
                      <td className="px-6 py-4 text-center font-black text-lg text-slate-900">{res.score.toFixed(1)}</td>
                      <td className="px-6 py-4">
                        <button onClick={() => setViewingAssessment(res)} className="p-2 bg-blue-50 text-blue-600 rounded-xl hover:bg-blue-600 hover:text-white transition-all"><Eye size={18}/></button>
                      </td>
                    </tr>
                  ))}
                  {officialResults.length === 0 && <tr><td colSpan={5} className="px-6 py-12 text-center text-slate-300 italic">Nenhum resultado disponível para os filtros selecionados.</td></tr>}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {activeTab === 'carometro' && (
           <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-6">
              {students.map(s => (
                <div key={s.id} onClick={() => handleOpenStudent(s)} className="text-center cursor-pointer group">
                  <div className="aspect-[3/4] rounded-[32px] overflow-hidden border-4 border-slate-50 group-hover:border-blue-500 transition-all mb-3 shadow-sm">
                    {s.avatarUrl ? <img src={s.avatarUrl} className="w-full h-full object-cover"/> : <div className="w-full h-full bg-slate-100 flex items-center justify-center text-slate-300"><User size={40}/></div>}
                  </div>
                  <p className="text-[11px] font-black uppercase text-slate-700 tracking-tighter line-clamp-1">{s.fullName}</p>
                </div>
              ))}
              {students.length === 0 && <div className="col-span-full py-20 text-center text-slate-300 italic">Nenhum estudante encontrado nesta turma.</div>}
           </div>
        )}
      </div>

      {/* Modal Detalhado de Prova */}
      {viewingAssessment && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-md z-[100] flex items-center justify-center p-4">
          <div className="bg-white w-full max-w-4xl rounded-[48px] shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
            <div className="p-8 bg-slate-900 text-white flex justify-between items-center no-print shadow-xl">
              <div>
                <h3 className="font-black uppercase tracking-tighter text-2xl">Relatório Individual</h3>
                <p className="text-xs font-bold text-slate-400 uppercase tracking-widest">{viewingAssessment.studentName} • {viewingAssessment.subject}</p>
              </div>
              <div className="flex gap-4">
                <button onClick={window.print} className="bg-white/10 p-3 rounded-full hover:bg-white/20 transition-all"><Printer size={20}/></button>
                <button onClick={() => setViewingAssessment(null)} className="bg-white/10 p-3 rounded-full hover:bg-white/20 transition-all"><X size={20}/></button>
              </div>
            </div>

            <div className="p-10 overflow-y-auto space-y-8 print:p-0 bg-white">
              <div className="flex justify-between items-center border-b border-slate-100 pb-8">
                <div className="space-y-1">
                  <h4 className="font-black text-slate-800 text-3xl tracking-tighter">Desempenho Geral</h4>
                  <div className="flex gap-4">
                    <span className="text-blue-600 font-black text-lg">Nota: {viewingAssessment.score.toFixed(1)}</span>
                    <span className="text-slate-400 font-bold uppercase text-[10px] pt-2 tracking-widest">Escola Estadual Frederico José Pedreira</span>
                  </div>
                </div>
                <div className="text-right">
                   <p className="text-slate-400 font-bold text-xs uppercase tracking-widest">Data Realização</p>
                   <p className="text-slate-800 font-black text-lg">{new Date(viewingAssessment.created_at).toLocaleDateString()}</p>
                </div>
              </div>

              <div className="space-y-12">
                {viewingAssessment.questions?.map((q: Question, idx: number) => {
                  const studentAnswerIdx = viewingAssessment.answers ? viewingAssessment.answers[idx] : -1;
                  const isCorrect = studentAnswerIdx === q.correctIndex;

                  return (
                    <div key={idx} className="space-y-5 border-b border-slate-50 pb-12 last:border-0 page-break-inside-avoid">
                      <div className="flex justify-between items-start">
                        <span className="bg-slate-900 text-white text-[10px] font-black px-4 py-1.5 rounded-xl uppercase tracking-widest">QUESTÃO {idx + 1}</span>
                        <div className={`flex items-center gap-2 text-[10px] font-black px-4 py-1.5 rounded-xl uppercase tracking-widest ${isCorrect ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>
                          {isCorrect ? <CheckCircle size={14}/> : <AlertCircle size={14}/>} {isCorrect ? 'RESPOSTA CORRETA' : 'RESPOSTA INCORRETA'}
                        </div>
                      </div>
                      
                      {q.citation && (
                        <div className="bg-slate-50 p-6 border-l-4 border-blue-600 italic text-slate-600 text-sm leading-relaxed rounded-r-2xl">"{q.citation}"</div>
                      )}
                      
                      <p className="font-black text-slate-800 text-xl leading-tight">{q.text}</p>

                      <div className="grid grid-cols-1 gap-2 mt-4">
                        {q.options.map((opt, oIdx) => (
                          <div key={oIdx} className={`p-4 rounded-2xl border-2 flex items-center gap-4 text-xs transition-all ${
                            oIdx === q.correctIndex ? 'bg-green-50 border-green-200 text-green-800 font-bold' :
                            oIdx === studentAnswerIdx ? 'bg-red-50 border-red-200 text-red-800 font-bold' :
                            'bg-white border-slate-50 text-slate-500'
                          }`}>
                            <span className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 font-black ${
                              oIdx === q.correctIndex ? 'bg-green-600 text-white' :
                              oIdx === studentAnswerIdx ? 'bg-red-600 text-white' : 'bg-slate-100'
                            }`}>{String.fromCharCode(65 + oIdx)}</span>
                            {opt}
                            {oIdx === q.correctIndex && <CheckCircle size={14} className="ml-auto text-green-600"/>}
                          </div>
                        ))}
                      </div>

                      <div className="mt-4 p-6 bg-blue-50/50 rounded-3xl border border-blue-100">
                        <p className="text-[9px] font-black text-blue-600 uppercase mb-2 tracking-widest">Justificativa Pedagógica</p>
                        <p className="text-xs text-slate-600 italic leading-relaxed font-medium">"{q.explanation}"</p>
                      </div>
                    </div>
                  );
                })}
              </div>

              <div className="bg-gradient-to-br from-slate-900 to-slate-800 p-10 rounded-[40px] text-white space-y-4 shadow-2xl relative overflow-hidden">
                 <div className="absolute top-0 right-0 p-8 opacity-10"><Sparkles size={80}/></div>
                 <h4 className="font-black text-xs uppercase tracking-widest flex items-center gap-2 text-blue-400"><Sparkles size={16}/> Feedback Sistêmico (IA)</h4>
                 <p className="text-slate-300 text-base italic leading-relaxed relative z-10">"{viewingAssessment.feedback}"</p>
              </div>
            </div>
          </div>
        </div>
      )}

      {selectedStudent && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-md z-[100] flex items-center justify-center p-4 no-print">
          <div className="bg-white w-full max-w-lg rounded-[48px] shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
            <div className="p-8 bg-slate-900 text-white flex justify-between items-center shadow-lg">
              <div className="flex items-center gap-4">
                 <div className="w-12 h-12 bg-white/20 rounded-2xl flex items-center justify-center font-black">{selectedStudent.fullName[0]}</div>
                 <div>
                    <h3 className="font-black uppercase tracking-tighter text-xl">{selectedStudent.fullName}</h3>
                    <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">{selectedStudent.grade} Série • Turma {selectedStudent.className}</p>
                 </div>
              </div>
              <button onClick={() => setSelectedStudent(null)} className="p-2 hover:bg-white/20 rounded-full transition-colors"><X size={24}/></button>
            </div>
            <div className="p-8 overflow-y-auto space-y-8 flex-1">
              <div className="space-y-4">
                <h4 className="font-black text-slate-800 uppercase text-[10px] tracking-widest border-b pb-2">Registrar Nova Observação</h4>
                <textarea className="w-full bg-slate-50 border border-slate-100 p-5 rounded-3xl outline-none focus:ring-2 focus:ring-blue-500 min-h-[120px]" placeholder="Registre o comportamento, evolução ou dificuldades do estudante..." value={newObservation} onChange={e => setNewObservation(e.target.value)} />
                <button onClick={async () => {
                   if (!newObservation.trim()) return;
                   const { error } = await supabase.from('student_observations').insert([{ student_id: selectedStudent.id, teacher_id: currentUser.id, content: newObservation.trim() }]);
                   if (!error) { setNewObservation(''); fetchObservations(selectedStudent.id); }
                }} className="w-full bg-blue-600 text-white font-black py-4 rounded-2xl shadow-xl hover:bg-blue-700 transition-all">Salvar Observação</button>
              </div>
              
              <div className="space-y-4">
                <h4 className="font-black text-slate-800 uppercase text-[10px] tracking-widest border-b pb-2">Histórico Pedagógico</h4>
                <div className="space-y-3">
                  {observations.map(o => (
                    <div key={o.id} className="p-5 bg-slate-50 border border-slate-100 rounded-3xl relative group">
                      <p className="text-sm text-slate-700 italic leading-relaxed">"{o.content}"</p>
                      <div className="flex justify-between items-center mt-3">
                         <p className="text-[9px] text-slate-400 font-bold uppercase tracking-widest">{new Date(o.created_at).toLocaleString()}</p>
                         <button onClick={async () => { if(confirm("Excluir anotação?")) { await supabase.from('student_observations').delete().eq('id', o.id); fetchObservations(selectedStudent.id); } }} className="text-red-400 opacity-0 group-hover:opacity-100 transition-opacity"><Trash2 size={14}/></button>
                      </div>
                    </div>
                  ))}
                  {observations.length === 0 && <p className="text-center py-10 text-slate-300 italic text-sm">Nenhuma observação registrada para este aluno.</p>}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      <style>{`
        @media print {
          .no-print { display: none !important; }
          body { background: white !important; padding: 0 !important; margin: 0 !important; }
          .fixed { position: relative !important; background: transparent !important; }
          .bg-white { background: transparent !important; box-shadow: none !important; }
          .rounded-[48px] { border-radius: 0 !important; }
          .max-h-[90vh] { max-height: none !important; overflow: visible !important; }
          .p-10 { padding: 0 !important; }
          .page-break-inside-avoid { page-break-inside: avoid; }
          .shadow-2xl, .shadow-xl, .shadow-sm { box-shadow: none !important; }
          .bg-slate-900 { background: #111 !important; }
        }
      `}</style>
    </div>
  );
};

export default TeacherDashboard;
