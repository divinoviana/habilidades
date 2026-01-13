
import React, { useState, useEffect } from 'react';
import { UserProfile, GlobalSettings, Subject, ExtraActivity, ActivitySubmission, UserRole, Assessment } from '../types';
// Fix: Added missing User and Clock icons to the lucide-react imports list
import { BookOpen, ClipboardList, KeyRound, Loader2, FilePlus, ListChecks, Sparkles, Send, Users, Contact2, Printer, ChevronLeft, FileText, Download, History, Trash2, CheckCircle, AlertCircle, Wand2, Eye, X, Filter, RefreshCw, MessageSquare, Plus, StickyNote, User, Clock } from 'lucide-react';
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
  
  // States para Nova Atividade
  const [extraTheme, setExtraTheme] = useState('');
  const [genQuestions, setGenQuestions] = useState<any[] | null>(null);

  // States para Visualização de Resultados
  const [viewingActivity, setViewingActivity] = useState<ExtraActivity | null>(null);
  const [submissions, setSubmissions] = useState<ActivitySubmission[]>([]);

  // States para Observações do Estudante
  const [selectedStudent, setSelectedStudent] = useState<UserProfile | null>(null);
  const [observations, setObservations] = useState<StudentObservation[]>([]);
  const [newObservation, setNewObservation] = useState('');
  const [isSavingObservation, setIsSavingObservation] = useState(false);

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
    setLoading(true);
    let query = supabase
      .from('profiles')
      .select('*')
      .eq('role', 'student')
      .eq('grade', selectedGrade);
    
    if (selectedClass !== 'Todas') {
      query = query.eq('class_name', selectedClass);
    }
    
    const { data } = await query.order('full_name', { ascending: true });
    
    if (data) {
      setStudents(data.map(u => ({ 
        ...u, 
        fullName: u.full_name, 
        role: u.role as UserRole, 
        avatarUrl: u.avatar_url 
      })));
    } else {
      setStudents([]);
    }
    setLoading(false);
  };

  const fetchObservations = async (studentId: string) => {
    const { data } = await supabase
      .from('student_observations')
      .select('*')
      .eq('student_id', studentId)
      .order('created_at', { ascending: false });
    
    if (data) setObservations(data);
  };

  const handleOpenStudent = (student: UserProfile) => {
    setSelectedStudent(student);
    fetchObservations(student.id);
  };

  const handleSaveObservation = async () => {
    if (!newObservation.trim() || !selectedStudent) return;
    setIsSavingObservation(true);
    
    const { error } = await supabase.from('student_observations').insert([{
      student_id: selectedStudent.id,
      teacher_id: currentUser.id,
      content: newObservation.trim()
    }]);

    if (!error) {
      setNewObservation('');
      fetchObservations(selectedStudent.id);
    } else {
      alert("Erro ao salvar observação. Verifique se as tabelas foram criadas no Banco.");
    }
    setIsSavingObservation(false);
  };

  const handleDeleteObservation = async (id: string) => {
    if (!confirm("Excluir esta anotação?")) return;
    const { error } = await supabase.from('student_observations').delete().eq('id', id);
    if (!error && selectedStudent) fetchObservations(selectedStudent.id);
  };

  const handleGradeChange = (grade: string) => {
    setSelectedGrade(grade);
    const availableClasses = CLASSES_BY_GRADE[grade] || [];
    if (availableClasses.length > 0) {
      setSelectedClass(availableClasses[0]);
    } else {
      setSelectedClass('Todas');
    }
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
                <select className="px-4 py-3 bg-slate-50 border rounded-xl font-bold" value={selectedGrade} onChange={(e) => handleGradeChange(e.target.value)}>
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
                  <h3 className="text-xl font-bold text-slate-800 flex items-center gap-2"><Sparkles className="text-blue-600"/> Gerar atividade</h3>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                    <select className="px-4 py-3 bg-white border rounded-xl font-bold text-sm" value={selectedSubject} onChange={(e) => setSelectedSubject(e.target.value as Subject)}>
                        <option>História</option><option>Filosofia</option><option>Geografia</option><option>Sociologia</option>
                    </select>
                    <select className="px-4 py-3 bg-white border rounded-xl font-bold text-sm" value={selectedGrade} onChange={(e) => handleGradeChange(e.target.value)}>
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
                    {loading ? <Loader2 className="animate-spin" size={20}/> : <Wand2 size={20}/>} Gerar atividade
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
                    <h3 className="text-2xl font-black text-slate-800">Revisão da Atividade</h3>
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
           <div className="space-y-8 animate-fade-in">
            <div className="flex flex-col md:flex-row justify-between items-center gap-6 border-b pb-8">
              <div>
                <h3 className="font-black text-slate-800 text-3xl tracking-tighter">Carômetro Escolar</h3>
                <p className="text-slate-500 text-sm">Clique na foto do estudante para fazer observações pedagógicas.</p>
              </div>
              <div className="flex bg-slate-100 p-2 rounded-[24px] gap-2">
                <div className="flex items-center gap-2 px-3">
                  <Filter size={16} className="text-slate-400"/>
                  <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Filtros</span>
                </div>
                <select 
                  className="px-4 py-2 bg-white border-none rounded-xl font-bold text-sm shadow-sm outline-none focus:ring-2 focus:ring-blue-500" 
                  value={selectedGrade} 
                  onChange={(e) => handleGradeChange(e.target.value)}
                >
                  <option>1ª</option>
                  <option>2ª</option>
                  <option>3ª</option>
                </select>
                <select 
                  className="px-4 py-2 bg-white border-none rounded-xl font-bold text-sm shadow-sm outline-none focus:ring-2 focus:ring-blue-500" 
                  value={selectedClass} 
                  onChange={(e) => setSelectedClass(e.target.value)}
                >
                  <option value="Todas">Todas as Turmas</option>
                  {(CLASSES_BY_GRADE[selectedGrade] || []).map(c => <option key={c} value={c}>Turma {c}</option>)}
                </select>
                <button 
                  onClick={fetchStudents} 
                  className="p-2 bg-blue-600 text-white rounded-xl hover:bg-blue-700 transition-all shadow-md shadow-blue-100"
                >
                  <RefreshCw size={18} className={loading ? 'animate-spin' : ''}/>
                </button>
              </div>
            </div>

            {loading ? (
              <div className="py-20 flex flex-col items-center justify-center text-slate-400 gap-4">
                <Loader2 size={48} className="animate-spin text-blue-500"/>
                <p className="font-bold animate-pulse">Carregando estudantes...</p>
              </div>
            ) : (
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-6">
                {students.map(s => (
                  <div key={s.id} onClick={() => handleOpenStudent(s)} className="text-center group animate-fade-in cursor-pointer">
                    <div className="relative aspect-[4/5] bg-white rounded-[32px] overflow-hidden mb-3 border-2 border-slate-100 group-hover:border-blue-500 group-hover:shadow-2xl transition-all duration-300">
                      {s.avatarUrl ? (
                        <img src={s.avatarUrl} className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-110" alt={s.fullName}/>
                      ) : (
                        <div className="w-full h-full flex items-center justify-center bg-slate-50 text-slate-200">
                          <Users size={48} strokeWidth={1}/>
                        </div>
                      )}
                      
                      {/* Overlay ao passar o mouse */}
                      <div className="absolute inset-0 bg-blue-600/60 opacity-0 group-hover:opacity-100 flex items-center justify-center transition-opacity">
                         <MessageSquare className="text-white" size={32} />
                      </div>

                      <div className="absolute bottom-3 left-1/2 -translate-x-1/2 opacity-0 group-hover:opacity-100 transition-opacity">
                        <span className="bg-blue-600 text-white text-[8px] font-black uppercase px-3 py-1 rounded-full shadow-lg">
                          Anotar
                        </span>
                      </div>
                    </div>
                    <p className="text-xs font-black text-slate-800 leading-tight px-2 group-hover:text-blue-600 transition-colors uppercase tracking-tight">
                      {s.fullName}
                    </p>
                    <p className="text-[9px] font-bold text-slate-400 mt-1 uppercase tracking-widest">
                      {s.grade} Série • Turma {s.className}
                    </p>
                  </div>
                ))}
                
                {students.length === 0 && (
                  <div className="col-span-full py-24 text-center border-4 border-dashed border-slate-100 rounded-[40px] bg-slate-50/50">
                    <Users size={64} className="mx-auto text-slate-200 mb-4" strokeWidth={1}/>
                    <h4 className="text-slate-400 font-black uppercase tracking-widest text-sm">Nenhum estudante nesta turma</h4>
                    <p className="text-slate-300 text-xs mt-2">Os alunos aparecerão aqui após realizarem o cadastro biométrico.</p>
                  </div>
                )}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Modal de Observações do Estudante */}
      {selectedStudent && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-[100] flex items-center justify-center p-4">
          <div className="bg-white w-full max-w-lg rounded-[40px] shadow-2xl overflow-hidden animate-in zoom-in-95 duration-300 flex flex-col max-h-[85vh]">
            <div className="p-8 bg-slate-900 text-white flex justify-between items-start">
              <div className="flex items-center gap-4">
                <div className="w-16 h-16 rounded-2xl overflow-hidden bg-white/20 border-2 border-white/10">
                  {/* Fix: Icon reference fixed with missing User icon from imports */}
                  {selectedStudent.avatarUrl ? <img src={selectedStudent.avatarUrl} className="w-full h-full object-cover" /> : <User className="p-4" />}
                </div>
                <div>
                  <h3 className="text-xl font-black uppercase tracking-tighter">{selectedStudent.fullName}</h3>
                  <p className="text-slate-400 text-xs font-bold uppercase tracking-widest">{selectedStudent.grade} Série • Turma {selectedStudent.className}</p>
                </div>
              </div>
              <button onClick={() => setSelectedStudent(null)} className="p-2 hover:bg-white/10 rounded-full transition-colors"><X size={24}/></button>
            </div>

            <div className="p-8 overflow-y-auto space-y-6 flex-1">
              {/* Formulário de Nova Observação */}
              <div className="bg-slate-50 p-4 rounded-3xl space-y-3 border border-slate-100 shadow-inner">
                <h4 className="text-[10px] font-black uppercase text-slate-400 tracking-widest flex items-center gap-2">
                  <Plus size={12}/> Nova Anotação Pedagógica
                </h4>
                <textarea 
                  className="w-full bg-white border border-slate-200 rounded-2xl p-4 text-sm outline-none focus:ring-2 focus:ring-blue-500 transition-all resize-none h-24"
                  placeholder="Ex: Aluno disperso, usando celular, falta de material ou boa participação..."
                  value={newObservation}
                  onChange={(e) => setNewObservation(e.target.value)}
                />
                <button 
                  onClick={handleSaveObservation}
                  disabled={!newObservation.trim() || isSavingObservation}
                  className="w-full bg-blue-600 text-white font-black py-3 rounded-2xl text-xs uppercase tracking-widest flex items-center justify-center gap-2 hover:bg-blue-700 disabled:opacity-50 transition-all shadow-lg shadow-blue-100"
                >
                  {isSavingObservation ? <Loader2 size={16} className="animate-spin" /> : <StickyNote size={16} />}
                  Salvar Observação
                </button>
              </div>

              {/* Lista de Observações Antigas */}
              <div className="space-y-4">
                <h4 className="text-[10px] font-black uppercase text-slate-400 tracking-widest border-b pb-2">Histórico Comportamental</h4>
                {observations.length === 0 ? (
                  <p className="text-center py-10 text-slate-300 italic text-sm">Nenhuma observação registrada ainda.</p>
                ) : (
                  observations.map(obs => (
                    <div key={obs.id} className="p-5 bg-white border border-slate-100 rounded-3xl relative group hover:shadow-md transition-all">
                      <p className="text-sm text-slate-700 leading-relaxed italic">"{obs.content}"</p>
                      <div className="mt-3 flex justify-between items-center border-t pt-3">
                        <span className="text-[9px] font-bold text-slate-400 flex items-center gap-1 uppercase">
                          {/* Fix: Icon reference fixed with missing Clock icon from imports */}
                          <Clock size={10}/> {new Date(obs.created_at).toLocaleString()}
                        </span>
                        {obs.teacher_id === currentUser.id && (
                          <button onClick={() => handleDeleteObservation(obs.id)} className="text-slate-300 hover:text-red-500 transition-colors p-1">
                            <Trash2 size={14}/>
                          </button>
                        )}
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
            
            <div className="p-6 bg-slate-50 border-t flex justify-center">
              <button onClick={() => setSelectedStudent(null)} className="text-slate-400 font-black text-xs uppercase tracking-widest hover:text-slate-600 transition-colors">Fechar Painel</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default TeacherDashboard;
