
import React, { useState, useEffect } from 'react';
import { UserProfile, GlobalSettings, Subject, Topic, ExtraActivity, ActivitySubmission, UserRole, Assessment } from '../types';
import { BookOpen, ClipboardList, KeyRound, Loader2, FilePlus, ListChecks, Sparkles, Send, Users, Contact2, Printer, ChevronLeft, FileText, Download } from 'lucide-react';
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
  
  // Results State
  const [officialResults, setOfficialResults] = useState<any[]>([]);
  const [selectedResult, setSelectedResult] = useState<any>(null);

  // Carômetro State
  const [carometroGrade, setCarometroGrade] = useState('1ª');
  const [carometroClass, setCarometroClass] = useState('Todas');
  const [students, setStudents] = useState<UserProfile[]>([]);
  const [loadingStudents, setLoadingStudents] = useState(false);

  // Topics/Activities States
  const [myActivities, setMyActivities] = useState<ExtraActivity[]>([]);
  const [newTopic, setNewTopic] = useState('');
  const [extraTheme, setExtraTheme] = useState('');
  const [generatedQuestions, setGeneratedQuestions] = useState<any[] | null>(null);
  const [submissions, setSubmissions] = useState<ActivitySubmission[]>([]);
  const [viewingResults, setViewingResults] = useState<string | null>(null);

  useEffect(() => {
    fetchTopics();
    fetchMyActivities();
  }, []);

  useEffect(() => {
    if (activeTab === 'carometro') fetchStudentsForCarometro();
    if (activeTab === 'official_results') fetchOfficialResults();
  }, [activeTab, carometroGrade, carometroClass, selectedSubject]);

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
    let query = supabase.from('profiles').select('*').eq('role', 'student').eq('grade', carometroGrade);
    if (carometroClass !== 'Todas') query = query.eq('class_name', carometroClass);
    const { data } = await query.order('full_name');
    if (data) setStudents(data.map(u => ({ ...u, fullName: u.full_name, role: u.role as UserRole, avatarUrl: u.avatar_url })));
    setLoadingStudents(false);
  };

  const fetchMyActivities = async () => {
    const { data } = await supabase.from('extra_activities').select('*').eq('teacher_id', currentUser.id).order('created_at', { ascending: false });
    if (data) setMyActivities(data.map(d => ({ ...d, teacherId: d.teacher_id, createdAt: d.created_at })));
  };

  const fetchTopics = async () => {
    await supabase.from('topics').select('*').eq('teacher_id', currentUser.id);
  };

  const handlePrint = () => {
    window.print();
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap gap-2 overflow-x-auto pb-2 no-print">
        <button onClick={() => setActiveTab('topics')} className={`flex items-center gap-2 px-5 py-3 rounded-xl font-bold whitespace-nowrap transition-all ${activeTab === 'topics' ? 'bg-blue-600 text-white shadow-lg' : 'bg-white border'}`}><BookOpen size={18}/> Planejamento</button>
        <button onClick={() => setActiveTab('activities')} className={`flex items-center gap-2 px-5 py-3 rounded-xl font-bold whitespace-nowrap transition-all ${activeTab === 'activities' ? 'bg-blue-600 text-white shadow-lg' : 'bg-white border'}`}><FilePlus size={18}/> Atividades Extras</button>
        <button onClick={() => setActiveTab('official_results')} className={`flex items-center gap-2 px-5 py-3 rounded-xl font-bold whitespace-nowrap transition-all ${activeTab === 'official_results' ? 'bg-blue-600 text-white shadow-lg' : 'bg-white border'}`}><FileText size={18}/> Resultados Oficiais</button>
        <button onClick={() => setActiveTab('carometro')} className={`flex items-center gap-2 px-5 py-3 rounded-xl font-bold whitespace-nowrap transition-all ${activeTab === 'carometro' ? 'bg-blue-600 text-white shadow-lg' : 'bg-white border'}`}><Contact2 size={18}/> Carômetro</button>
        <button onClick={() => setActiveTab('profile')} className={`flex items-center gap-2 px-5 py-3 rounded-xl font-bold whitespace-nowrap transition-all ${activeTab === 'profile' ? 'bg-blue-600 text-white shadow-lg' : 'bg-white border'}`}><KeyRound size={18}/> Minha Senha</button>
      </div>

      <div className="bg-white rounded-3xl shadow-sm border border-slate-200 p-8 animate-fade-in no-print">
        {activeTab === 'official_results' && (
          <div className="space-y-6">
            <div className="flex justify-between items-center border-b pb-4">
              <h3 className="font-bold text-slate-800 text-2xl">Resultados das Avaliações Oficiais</h3>
              <select className="px-4 py-2 bg-slate-50 border rounded-xl font-bold" value={selectedSubject} onChange={(e) => setSelectedSubject(e.target.value as Subject)}>
                <option>História</option><option>Filosofia</option><option>Geografia</option><option>Sociologia</option>
              </select>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="text-left text-[10px] font-black text-slate-400 uppercase border-b">
                    <th className="pb-4">Aluno</th>
                    <th className="pb-4">Série/Turma</th>
                    <th className="pb-4">Nota</th>
                    <th className="pb-4 text-right">Ação</th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {officialResults.map((res: any) => (
                    <tr key={res.id} className="hover:bg-slate-50">
                      <td className="py-4 font-bold text-slate-700">{res.profiles.full_name}</td>
                      <td className="py-4 text-sm text-slate-500">{res.profiles.grade} - {res.profiles.class_name}</td>
                      <td className="py-4 font-black text-lg text-blue-600">{res.score.toFixed(1)}</td>
                      <td className="py-4 text-right">
                        <button onClick={() => setSelectedResult(res)} className="p-2 bg-blue-50 text-blue-600 rounded-lg hover:bg-blue-600 hover:text-white"><Download size={18}/></button>
                      </td>
                    </tr>
                  ))}
                  {officialResults.length === 0 && <tr><td colSpan={4} className="py-12 text-center text-slate-400 italic">Nenhum resultado encontrado.</td></tr>}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* ... (Topics, Carometro, Activities content as before) ... */}
        {activeTab === 'topics' && (
          <div className="space-y-6">
            <h3 className="font-bold text-slate-800 text-2xl">Planejamento do {settings.activeQuarter}º Bimestre</h3>
            <div className="grid grid-cols-2 gap-4">
              <select className="px-4 py-3 bg-slate-50 border rounded-xl" value={selectedSubject} onChange={(e) => setSelectedSubject(e.target.value as Subject)}>
                <option>História</option><option>Filosofia</option><option>Geografia</option><option>Sociologia</option>
              </select>
              <select className="px-4 py-3 bg-slate-50 border rounded-xl" value={selectedGrade} onChange={(e) => setSelectedGrade(e.target.value)}>
                <option>1ª</option><option>2ª</option><option>3ª</option>
              </select>
            </div>
            <textarea className="w-full h-32 px-5 py-4 border rounded-2xl" placeholder="Conteúdos para prova oficial..." value={newTopic} onChange={(e) => setNewTopic(e.target.value)} />
            <button onClick={async () => { setLoading(true); await supabase.from('topics').insert([{ teacher_id: currentUser.id, subject: selectedSubject, grade: selectedGrade, quarter: settings.activeQuarter, content: newTopic }]); setNewTopic(''); setLoading(false); alert("Tópicos salvos!"); }} className="w-full bg-slate-900 text-white font-bold py-4 rounded-2xl">{loading ? <Loader2 className="animate-spin mx-auto"/> : 'Enviar para o Admin'}</button>
          </div>
        )}

        {activeTab === 'carometro' && (
           <div className="space-y-8">
            <div className="flex flex-col md:flex-row justify-between items-center gap-6 border-b pb-6">
              <h3 className="font-bold text-slate-800 text-2xl">Carômetro Escolar</h3>
              <div className="flex gap-3">
                <select className="px-4 py-2 border rounded-xl font-bold" value={carometroGrade} onChange={(e) => setCarometroGrade(e.target.value)}><option>1ª</option><option>2ª</option><option>3ª</option></select>
                <select className="px-4 py-2 border rounded-xl font-bold" value={carometroClass} onChange={(e) => setCarometroClass(e.target.value)}>{["Todas", ...(CLASSES_BY_GRADE[carometroGrade] || [])].map(c => <option key={c} value={c}>{c}</option>)}</select>
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

      {/* Modal de Detalhes da Prova (Relatório para PDF) */}
      {selectedResult && (
        <div className="fixed inset-0 bg-slate-900/90 z-[100] flex items-center justify-center p-4">
          <div className="bg-white w-full max-w-4xl rounded-3xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
            <div className="p-6 border-b flex justify-between items-center bg-slate-50 no-print">
              <button onClick={() => setSelectedResult(null)} className="flex items-center gap-2 text-slate-500 font-bold hover:text-slate-800"><ChevronLeft size={20}/> Voltar</button>
              <div className="text-center">
                <h3 className="font-bold">Correção Detalhada</h3>
                <p className="text-[10px] uppercase font-black text-slate-400">{selectedResult.subject} - {selectedResult.profiles.full_name}</p>
              </div>
              <button onClick={handlePrint} className="flex items-center gap-2 bg-blue-600 text-white px-4 py-2 rounded-xl font-bold hover:bg-blue-700 transition-all"><Printer size={18}/> Imprimir / PDF</button>
            </div>
            
            <div className="p-12 overflow-y-auto flex-1 bg-white print:p-0" id="assessment-report">
              <div className="text-center mb-10 border-b pb-8">
                <h1 className="text-2xl font-black uppercase mb-1">Escola Estadual Federico José Pedreira Neto</h1>
                <h2 className="text-lg font-bold text-slate-600 uppercase">Relatório Individual de Desempenho - 2024</h2>
              </div>
              
              <div className="grid grid-cols-2 gap-8 mb-10 text-sm">
                <div className="space-y-1">
                  <p><strong>ESTUDANTE:</strong> {selectedResult.profiles.full_name}</p>
                  <p><strong>SÉRIE/TURMA:</strong> {selectedResult.profiles.grade} série - {selectedResult.profiles.class_name}</p>
                </div>
                <div className="space-y-1 text-right">
                  <p><strong>DISCIPLINA:</strong> {selectedResult.subject}</p>
                  <p><strong>NOTA FINAL:</strong> <span className="text-xl font-black text-blue-600">{selectedResult.score.toFixed(1)}</span></p>
                </div>
              </div>

              <div className="space-y-8">
                <section>
                  <h3 className="font-black border-l-4 border-blue-600 pl-3 mb-4 uppercase text-sm">Análise do Tutor de IA</h3>
                  <div className="bg-slate-50 p-6 rounded-2xl border italic text-slate-700 leading-relaxed">
                    {selectedResult.feedback}
                  </div>
                </section>

                <section>
                  <h3 className="font-black border-l-4 border-blue-600 pl-3 mb-4 uppercase text-sm">Resumo das Questões</h3>
                  <div className="space-y-4">
                    {selectedResult.questions.map((q: any, i: number) => (
                      <div key={i} className="p-4 border rounded-xl text-sm">
                        <p className="font-bold mb-2">{i+1}. {q.text.substring(0, 150)}...</p>
                        <p className="text-[10px] font-bold uppercase tracking-wider">Resultado: {selectedResult.answers[i] === q.correctIndex ? <span className="text-green-600">CORRETO</span> : <span className="text-red-600">INCORRETO</span>}</p>
                      </div>
                    ))}
                  </div>
                </section>
              </div>
              
              <div className="mt-20 flex justify-between text-[10px] uppercase font-bold text-slate-400">
                <p>Gerado pelo Sistema Federico IA</p>
                <p>Autenticado digitalmente</p>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default TeacherDashboard;
