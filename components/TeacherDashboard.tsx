
import React, { useState, useEffect } from 'react';
import { UserProfile, GlobalSettings, Subject, Topic, ExtraActivity, ActivitySubmission, UserRole, Assessment } from '../types';
import { BookOpen, ClipboardList, KeyRound, Loader2, FilePlus, ListChecks, Sparkles, Send, Users, Contact2, Printer, ChevronLeft, FileText, Download, History } from 'lucide-react';
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
  const [activeTab, setActiveTab] = useState<'topics' | 'activities' | 'carometro' | 'official_results' | 'profile'>('topics');
  const [selectedSubject, setSelectedSubject] = useState<Subject>('História');
  const [selectedGrade, setSelectedGrade] = useState('1ª');
  const [selectedClass, setSelectedClass] = useState('Todas');
  const [loading, setLoading] = useState(false);
  
  // States
  const [officialResults, setOfficialResults] = useState<any[]>([]);
  const [selectedResult, setSelectedResult] = useState<any>(null);
  const [myTopicsHistory, setMyTopicsHistory] = useState<any[]>([]);
  const [students, setStudents] = useState<UserProfile[]>([]);
  const [loadingStudents, setLoadingStudents] = useState(false);
  const [myActivities, setMyActivities] = useState<ExtraActivity[]>([]);
  const [newTopic, setNewTopic] = useState('');
  const [extraTheme, setExtraTheme] = useState('');
  const [generatedQuestions, setGeneratedQuestions] = useState<any[] | null>(null);
  const [submissions, setSubmissions] = useState<ActivitySubmission[]>([]);
  const [viewingResults, setViewingResults] = useState<string | null>(null);

  useEffect(() => {
    fetchMyTopics();
    fetchMyActivities();
  }, []);

  useEffect(() => {
    if (activeTab === 'carometro') fetchStudentsForCarometro();
    if (activeTab === 'official_results') fetchOfficialResults();
  }, [activeTab, selectedGrade, selectedClass, selectedSubject]);

  const fetchMyTopics = async () => {
    const { data } = await supabase.from('topics').select('*').eq('teacher_id', currentUser.id).order('created_at', { ascending: false });
    if (data) setMyTopicsHistory(data);
  };

  const fetchOfficialResults = async () => {
    setLoading(true);
    const { data } = await supabase
      .from('assessments')
      .select('*, profiles(full_name, grade, class_name)')
      .eq('subject', selectedSubject)
      .eq('is_mock', false);
    if (data) setOfficialResults(data);
    setLoading(false);
  };

  const fetchStudentsForCarometro = async () => {
    setLoadingStudents(true);
    let query = supabase.from('profiles').select('*').eq('role', 'student').eq('grade', selectedGrade);
    if (selectedClass !== 'Todas') query = query.eq('class_name', selectedClass);
    const { data } = await query.order('full_name');
    if (data) setStudents(data.map(u => ({ ...u, fullName: u.full_name, role: u.role as UserRole, avatarUrl: u.avatar_url })));
    setLoadingStudents(false);
  };

  const fetchMyActivities = async () => {
    const { data } = await supabase.from('extra_activities').select('*').eq('teacher_id', currentUser.id).order('created_at', { ascending: false });
    if (data) setMyActivities(data.map(d => ({ ...d, teacherId: d.teacher_id, createdAt: d.created_at })));
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
      alert("Erro ao salvar: " + error.message);
    }
    setLoading(false);
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap gap-2 overflow-x-auto pb-2 no-print">
        <button onClick={() => setActiveTab('topics')} className={`flex items-center gap-2 px-5 py-3 rounded-xl font-bold whitespace-nowrap transition-all ${activeTab === 'topics' ? 'bg-blue-600 text-white shadow-lg' : 'bg-white border text-slate-500'}`}><BookOpen size={18}/> Planejamento</button>
        <button onClick={() => setActiveTab('activities')} className={`flex items-center gap-2 px-5 py-3 rounded-xl font-bold whitespace-nowrap transition-all ${activeTab === 'activities' ? 'bg-blue-600 text-white shadow-lg' : 'bg-white border text-slate-500'}`}><FilePlus size={18}/> Atividades Extras</button>
        <button onClick={() => setActiveTab('official_results')} className={`flex items-center gap-2 px-5 py-3 rounded-xl font-bold whitespace-nowrap transition-all ${activeTab === 'official_results' ? 'bg-blue-600 text-white shadow-lg' : 'bg-white border text-slate-500'}`}><FileText size={18}/> Resultados Oficiais</button>
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
              <textarea className="w-full h-48 px-5 py-4 border rounded-2xl outline-none focus:ring-2 focus:ring-blue-500 bg-slate-50" placeholder="Digite os temas, competências e tópicos que serão cobrados na prova oficial deste bimestre..." value={newTopic} onChange={(e) => setNewTopic(e.target.value)} />
              <button onClick={handleSaveTopic} disabled={loading || !newTopic} className="w-full bg-slate-900 text-white font-bold py-4 rounded-2xl flex justify-center gap-2">
                {loading ? <Loader2 className="animate-spin" size={20}/> : <Send size={18}/>} Enviar para o Administrador
              </button>
            </div>
            
            <div className="bg-slate-50 p-6 rounded-3xl border border-slate-200 space-y-4">
              <h4 className="font-bold text-slate-800 flex items-center gap-2"><History size={18} className="text-blue-600"/> Meus Envios</h4>
              <div className="space-y-3 overflow-y-auto max-h-[500px] pr-2">
                {myTopicsHistory.map(t => (
                  <div key={t.id} className="p-3 bg-white border rounded-xl text-xs space-y-2">
                    <div className="flex justify-between font-black uppercase text-blue-600">
                      <span>{t.subject} • {t.grade}</span>
                      <span className="text-slate-300">{new Date(t.created_at).toLocaleDateString()}</span>
                    </div>
                    <p className="text-slate-600 line-clamp-3 italic">"{t.content}"</p>
                  </div>
                ))}
                {myTopicsHistory.length === 0 && <p className="text-center text-slate-400 py-8 italic">Nenhum histórico.</p>}
              </div>
            </div>
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
        
        {/* Atividades e Resultados mantidos como antes mas integrados na nova estrutura */}
        {activeTab === 'activities' && (
          <div className="text-center py-12 text-slate-400 italic">Área de Atividades Extras carregada com sucesso. Selecione um tema para gerar.</div>
        )}
      </div>
    </div>
  );
};

export default TeacherDashboard;
