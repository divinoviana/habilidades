
import React, { useState, useEffect } from 'react';
import { UserProfile, GlobalSettings, Subject, ExtraActivity, ActivitySubmission, UserRole, Assessment } from '../types';
import { BookOpen, ClipboardList, KeyRound, Loader2, FilePlus, ListChecks, Sparkles, Send, Users, Contact2, Printer, ChevronLeft, FileText, Download, History, Trash2, CheckCircle, AlertCircle, Wand2, Eye, X, Filter, RefreshCw, MessageSquare, Plus, StickyNote, User, Clock, Search } from 'lucide-react';
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
  
  const [extraTheme, setExtraTheme] = useState('');
  const [genQuestions, setGenQuestions] = useState<any[] | null>(null);
  const [viewingActivity, setViewingActivity] = useState<ExtraActivity | null>(null);
  const [submissions, setSubmissions] = useState<ActivitySubmission[]>([]);

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

  const fetchObservations = async (studentId: string) => {
    const { data } = await supabase.from('student_observations').select('*').eq('student_id', studentId).order('created_at', { ascending: false });
    if (data) setObservations(data);
  };

  const handleOpenStudent = (student: UserProfile) => {
    setSelectedStudent(student);
    fetchObservations(student.id);
  };

  const handleSaveObservation = async () => {
    if (!newObservation.trim() || !selectedStudent) return;
    setIsSavingObservation(true);
    const { error } = await supabase.from('student_observations').insert([{ student_id: selectedStudent.id, teacher_id: currentUser.id, content: newObservation.trim() }]);
    if (!error) { setNewObservation(''); fetchObservations(selectedStudent.id); }
    else alert("Erro ao salvar observação.");
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
    setSelectedClass(availableClasses.length > 0 ? availableClasses[0] : 'Todas');
  };

  const handleSaveTopic = async () => {
    if (!newTopic) return;
    setLoading(true);
    const { error } = await supabase.from('topics').insert([{ teacher_id: currentUser.id, subject: selectedSubject, grade: selectedGrade, quarter: settings.activeQuarter, content: newTopic }]);
    if (!error) { setNewTopic(''); fetchMyTopics(); alert("Planejamento enviado!"); }
    setLoading(false);
  };
  const [newTopic, setNewTopic] = useState('');

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
    const { error } = await supabase.from('extra_activities').insert([{ teacher_id: currentUser.id, subject: selectedSubject, grade: selectedGrade, class_name: selectedClass === 'Todas' ? null : selectedClass, theme: extraTheme, questions: genQuestions }]);
    if (!error) { alert("Atividade publicada!"); setGenQuestions(null); setExtraTheme(''); fetchMyActivities(); }
    else alert("Erro ao publicar.");
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
              <h3 className="font-bold text-slate-800 text-2xl">Novo Planejamento - {settings.activeQuarter}º Bimestre</h3>
              <div className="grid grid-cols-2 gap-4">
                <select className="px-4 py-3 bg-slate-50 border rounded-xl font-bold" value={selectedSubject} onChange={(e) => setSelectedSubject(e.target.value as Subject)}>
                  <option>História</option><option>Filosofia</option><option>Geografia</option><option>Sociologia</option>
                </select>
                <select className="px-4 py-3 bg-slate-50 border rounded-xl font-bold" value={selectedGrade} onChange={(e) => handleGradeChange(e.target.value)}>
                  <option>1ª</option><option>2ª</option><option>3ª</option>
                </select>
              </div>
              <textarea className="w-full h-48 px-5 py-4 border rounded-2xl outline-none focus:ring-2 focus:ring-blue-500 bg-slate-50" placeholder="Digite os temas..." value={newTopic} onChange={(e) => setNewTopic(e.target.value)} />
              <button onClick={handleSaveTopic} disabled={loading || !newTopic} className="w-full bg-slate-900 text-white font-bold py-4 rounded-2xl flex justify-center gap-2 disabled:opacity-50">
                {loading ? <Loader2 className="animate-spin" size={20}/> : <Send size={18}/>} Enviar Planejamento
              </button>
            </div>
            <div className="bg-slate-50 p-6 rounded-3xl border border-slate-200 space-y-4">
              <h4 className="font-bold text-slate-800 flex items-center gap-2"><History size={18} className="text-blue-600"/> Meus Envios</h4>
              <div className="space-y-3 overflow-y-auto max-h-[500px] pr-2">
                {myTopicsHistory.map(t => (
                  <div key={t.id} className="p-3 bg-white border rounded-xl text-xs">
                    <p className="font-black text-blue-600 uppercase">{t.subject} • {t.grade}</p>
                    <p className="text-slate-600 italic line-clamp-2">"{t.content}"</p>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {activeTab === 'official_results' && (
          <div className="space-y-6">
            <div className="flex flex-col md:flex-row justify-between items-center gap-4 border-b pb-6">
              <h3 className="text-2xl font-black text-slate-800">Resultados Oficiais: {selectedSubject}</h3>
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
                <button onClick={window.print} className="bg-slate-900 text-white p-2 rounded-xl"><Printer size={20}/></button>
              </div>
            </div>

            <div className="overflow-hidden border border-slate-100 rounded-[32px]">
              <table className="w-full text-left">
                <thead className="bg-slate-50 border-b">
                  <tr>
                    <th className="px-6 py-4 text-[10px] font-black uppercase text-slate-400">Estudante</th>
                    <th className="px-6 py-4 text-[10px] font-black uppercase text-slate-400">Turma</th>
                    <th className="px-6 py-4 text-[10px] font-black uppercase text-slate-400">Tipo</th>
                    <th className="px-6 py-4 text-[10px] font-black uppercase text-slate-400 text-center">Nota</th>
                    <th className="px-6 py-4 text-[10px] font-black uppercase text-slate-400">Data</th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {officialResults.map(res => (
                    <tr key={res.id}>
                      <td className="px-6 py-4 font-bold text-slate-700">{res.studentName}</td>
                      <td className="px-6 py-4 font-bold text-slate-500">{res.className}</td>
                      <td className="px-6 py-4"><span className={`text-[9px] font-black px-2 py-1 rounded-full ${res.is_mock ? 'bg-amber-50 text-amber-600' : 'bg-blue-50 text-blue-600'}`}>{res.is_mock ? 'SIMULADO' : 'OFICIAL'}</span></td>
                      <td className="px-6 py-4 text-center font-black text-lg">{res.score.toFixed(1)}</td>
                      <td className="px-6 py-4 text-[10px] text-slate-400">{new Date(res.created_at).toLocaleDateString()}</td>
                    </tr>
                  ))}
                  {officialResults.length === 0 && <tr><td colSpan={5} className="px-6 py-12 text-center text-slate-400 italic">Nenhum resultado encontrado.</td></tr>}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* Mantém as outras abas atividades e carômetro conforme o original, ajustando apenas o que for essencial */}
        {activeTab === 'activities' && (
          <div className="space-y-6">
             {viewingActivity ? (
               <div className="space-y-4">
                  <div className="flex items-center gap-4 mb-6">
                    <button onClick={() => setViewingActivity(null)} className="p-2 bg-slate-100 rounded-xl"><ChevronLeft/></button>
                    <h3 className="text-xl font-black">{viewingActivity.theme}</h3>
                  </div>
                  <div className="border rounded-[32px] overflow-hidden">
                    <table className="w-full text-left">
                      <thead className="bg-slate-50 border-b">
                        <tr><th className="px-6 py-4 text-xs font-bold text-slate-400">Aluno</th><th className="px-6 py-4 text-xs font-bold text-slate-400 text-center">Nota</th><th className="px-6 py-4 text-xs font-bold text-slate-400">Data</th></tr>
                      </thead>
                      <tbody className="divide-y">
                        {submissions.map(s => (
                          <tr key={s.id}>
                            <td className="px-6 py-4 font-bold">{s.studentName}</td>
                            <td className="px-6 py-4 text-center font-black">{s.score.toFixed(1)}</td>
                            <td className="px-6 py-4 text-xs text-slate-400">{new Date(s.createdAt).toLocaleDateString()}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
               </div>
             ) : (
               <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                  <div className="bg-slate-50 p-8 rounded-[32px] border space-y-4">
                    <h3 className="font-black text-slate-800">Criar Nova Atividade (5 Questões)</h3>
                    <input className="w-full p-4 border rounded-2xl" placeholder="Tema da atividade..." value={extraTheme} onChange={e => setExtraTheme(e.target.value)}/>
                    <button onClick={handleGenerateActivity} className="w-full bg-blue-600 text-white font-black py-4 rounded-2xl flex justify-center items-center gap-2">
                      {loading ? <Loader2 className="animate-spin" size={20}/> : <Wand2 size={20}/>} Gerar Atividade com IA
                    </button>
                    {genQuestions && (
                      <div className="mt-6 p-4 bg-white border-2 border-blue-500 rounded-3xl space-y-4">
                        <p className="text-center font-bold text-blue-600">Questões Geradas com Sucesso!</p>
                        <button onClick={handlePublishActivity} className="w-full bg-slate-900 text-white font-bold py-3 rounded-xl flex items-center justify-center gap-2"><Send size={18}/> Publicar para Estudantes</button>
                      </div>
                    )}
                  </div>
                  <div className="space-y-4">
                    <h3 className="font-black text-slate-800">Minhas Atividades</h3>
                    {myActivities.map(act => (
                      <div key={act.id} className="p-4 border rounded-2xl bg-white flex justify-between items-center">
                        <div><p className="font-bold">{act.theme}</p><p className="text-[10px] text-slate-400 uppercase">{act.subject} • {act.grade} Série</p></div>
                        <button onClick={() => fetchSubmissions(act)} className="text-blue-600 font-black text-xs uppercase hover:underline">Ver Notas</button>
                      </div>
                    ))}
                  </div>
               </div>
             )}
          </div>
        )}

        {activeTab === 'carometro' && (
           <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-6">
              {students.map(s => (
                <div key={s.id} onClick={() => handleOpenStudent(s)} className="text-center cursor-pointer group">
                  <div className="aspect-[3/4] rounded-[24px] overflow-hidden border-2 group-hover:border-blue-500 transition-all mb-2">
                    {s.avatarUrl ? <img src={s.avatarUrl} className="w-full h-full object-cover"/> : <div className="w-full h-full bg-slate-100 flex items-center justify-center text-slate-300"><User size={40}/></div>}
                  </div>
                  <p className="text-xs font-black uppercase text-slate-700">{s.fullName.split(' ')[0]}</p>
                </div>
              ))}
           </div>
        )}
      </div>

      {selectedStudent && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-md z-[100] flex items-center justify-center p-4">
          <div className="bg-white w-full max-w-lg rounded-[40px] shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
            <div className="p-8 bg-slate-900 text-white flex justify-between items-center">
              <h3 className="font-black uppercase tracking-tighter">{selectedStudent.fullName}</h3>
              <button onClick={() => setSelectedStudent(null)}><X/></button>
            </div>
            <div className="p-8 overflow-y-auto space-y-6">
              <textarea className="w-full bg-slate-50 border p-4 rounded-2xl" placeholder="Anotação pedagógica..." value={newObservation} onChange={e => setNewObservation(e.target.value)} />
              <button onClick={handleSaveObservation} className="w-full bg-blue-600 text-white font-black py-3 rounded-xl">Salvar</button>
              <div className="space-y-3">
                {observations.map(o => (
                  <div key={o.id} className="p-4 bg-slate-50 border rounded-2xl">
                    <p className="text-sm italic">"{o.content}"</p>
                    <p className="text-[10px] text-slate-400 mt-2">{new Date(o.created_at).toLocaleString()}</p>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Estilo para Impressão */}
      <style>{`
        @media print {
          .no-print { display: none !important; }
          .print-only { display: block !important; }
          body { background: white !important; }
          table { width: 100% !important; border-collapse: collapse; }
          th, td { border: 1px solid #ddd !important; padding: 12px !important; }
        }
      `}</style>
    </div>
  );
};

export default TeacherDashboard;
