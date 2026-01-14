
import React, { useState, useEffect } from 'react';
import { UserProfile, GlobalSettings, Subject, Assessment, ExtraActivity, Question } from '../types';
import { Sparkles, History, Loader2, FileCheck, ClipboardList, Send, CheckCircle2, User, Camera, Upload, ChevronLeft, RefreshCw, BookOpen, AlertCircle, X, Quote, Image as ImageIcon, FileText, CheckCircle } from 'lucide-react';
import { supabase } from '../lib/supabase';
import AssessmentSession from './AssessmentSession';
import { generateEnemAssessment, evaluateActivitySubmission } from '../services/geminiService';

interface StudentDashboardProps {
  currentUser: UserProfile;
  settings: GlobalSettings;
}

const StudentDashboard: React.FC<StudentDashboardProps> = ({ currentUser, settings }) => {
  const [activeTab, setActiveTab] = useState<'exams' | 'activities'>('exams');
  const [session, setSession] = useState<{ active: boolean; subject?: Subject; isMock: boolean }>({ active: false, isMock: false });
  const [activeQuestions, setActiveQuestions] = useState<Question[]>([]);
  
  const [assessments, setAssessments] = useState<Assessment[]>([]);
  const [extraActivities, setExtraActivities] = useState<ExtraActivity[]>([]);
  const [loadingSubject, setLoadingSubject] = useState<string | null>(null);

  // Estados para execução de Atividade Extra
  const [selectedActivity, setSelectedActivity] = useState<ExtraActivity | null>(null);
  const [activityAnswers, setActivityAnswers] = useState<any[]>([]);
  const [isSubmittingActivity, setIsSubmittingActivity] = useState(false);
  const [activityResult, setActivityResult] = useState<{ score: number; feedback: string } | null>(null);

  const subjects: Subject[] = ['História', 'Filosofia', 'Geografia', 'Sociologia'];

  useEffect(() => {
    fetchAssessments();
    fetchExtraActivities();
  }, [currentUser.id]);

  const fetchAssessments = async () => {
    const { data } = await supabase.from('assessments').select('*').eq('student_id', currentUser.id).order('created_at', { ascending: false });
    if (data) setAssessments(data.map(d => ({ ...d, studentId: d.student_id, isMock: d.is_mock, cheatingAttempts: d.cheating_attempts, createdAt: d.created_at })));
  };

  const fetchExtraActivities = async () => {
    const { data } = await supabase
      .from('extra_activities')
      .select('*')
      .eq('grade', currentUser.grade)
      .order('created_at', { ascending: false });
    if (data) setExtraActivities(data);
  };

  const handleStartOfficial = async (subject: Subject) => {
    if (settings.isAssessmentLocked[settings.activeQuarter]) {
      alert(`As avaliações do ${settings.activeQuarter}º Bimestre ainda não estão liberadas.`);
      return;
    }
    setLoadingSubject(`official-${subject}`);
    try {
      const { data } = await supabase.from('official_exams').select('questions').eq('subject', subject).eq('grade', currentUser.grade).eq('quarter', settings.activeQuarter).maybeSingle();
      if (data && data.questions && data.questions.length > 0) {
        setActiveQuestions(data.questions);
        setSession({ active: true, subject, isMock: false });
      } else {
        alert("Atenção: Esta prova ainda não foi gerada pela coordenação para este bimestre.");
      }
    } catch (e: any) { 
      alert("Erro de conexão ao carregar a prova. Verifique sua internet."); 
    }
    setLoadingSubject(null);
  };

  const handleStartMock = async (subject: Subject) => {
    setLoadingSubject(`mock-${subject}`);
    try {
      const { data } = await supabase.from('topics').select('content').eq('subject', subject).eq('grade', currentUser.grade).eq('quarter', settings.activeQuarter).order('created_at', { ascending: false }).limit(1).maybeSingle();
      
      if (!data || !data.content) {
        alert(`Não há conteúdo de planejamento cadastrado para ${subject} no ${settings.activeQuarter}º bimestre para gerar o simulado.`);
        setLoadingSubject(null);
        return;
      }

      const qs = await generateEnemAssessment(subject, data.content, currentUser.grade || '1ª');
      if (qs && qs.length > 0) {
        setActiveQuestions(qs);
        setSession({ active: true, subject, isMock: true });
      } else {
        alert("A IA Frederico não conseguiu formatar as questões agora. Por favor, tente novamente em instantes.");
      }
    } catch (err: any) { 
      alert("Erro ao gerar simulado: " + err.message); 
    }
    setLoadingSubject(null);
  };

  const handleSubmitActivity = async () => {
    if (!selectedActivity) return;
    setIsSubmittingActivity(true);
    try {
      const result = await evaluateActivitySubmission(selectedActivity, activityAnswers);
      setActivityResult(result);
      // Opcional: Salvar submissão no banco se houver tabela de submissions
    } catch (e: any) {
      alert("Erro ao corrigir: " + e.message);
    } finally {
      setIsSubmittingActivity(false);
    }
  };

  if (session.active && session.subject && activeQuestions.length > 0) {
    return (
      <AssessmentSession 
        subject={session.subject} 
        isMock={session.isMock} 
        currentUser={currentUser} 
        questions={activeQuestions} 
        onComplete={() => { setSession({ active: false, isMock: false }); setActiveQuestions([]); fetchAssessments(); }} 
        onCancel={() => { setSession({ active: false, isMock: false }); setActiveQuestions([]); }} 
      />
    );
  }

  return (
    <div className="space-y-8 animate-fade-in">
      <div className="bg-gradient-to-br from-blue-600 to-indigo-900 rounded-[40px] p-10 text-white shadow-2xl flex flex-col md:flex-row justify-between items-center gap-8 relative overflow-hidden">
        <div className="absolute top-0 right-0 p-12 opacity-10"><Sparkles size={120}/></div>
        <div className="flex items-center gap-8 z-10">
          <div className="w-24 h-24 rounded-[32px] bg-white/20 border-2 border-white/30 overflow-hidden shadow-2xl">
            {currentUser.avatarUrl ? <img src={currentUser.avatarUrl} className="w-full h-full object-cover"/> : <User className="w-full h-full p-6 text-white"/>}
          </div>
          <div>
            <h2 className="text-3xl font-black leading-tight tracking-tighter">Olá, {currentUser.fullName.split(' ')[0]}!</h2>
            <div className="flex gap-2 mt-2">
                <p className="text-[10px] font-black bg-white/10 px-3 py-1 rounded-full border border-white/10 uppercase tracking-widest">{currentUser.grade} série • Turma {currentUser.className}</p>
            </div>
          </div>
        </div>
        <div className="bg-white p-6 rounded-3xl shadow-xl text-center min-w-[120px] z-10">
            <p className="text-[10px] font-black uppercase text-slate-400 mb-1 tracking-widest">Bimestre</p>
            <p className="font-black text-3xl text-blue-600">{settings.activeQuarter}º</p>
        </div>
      </div>

      <div className="flex gap-2 bg-white p-2 rounded-3xl border border-slate-100 shadow-sm w-fit">
        <button 
            onClick={() => setActiveTab('exams')}
            className={`px-6 py-3 rounded-2xl font-black text-xs uppercase tracking-widest transition-all ${activeTab === 'exams' ? 'bg-blue-600 text-white shadow-lg' : 'text-slate-400 hover:text-slate-600'}`}
        >
            Avaliações
        </button>
        <button 
            onClick={() => setActiveTab('activities')}
            className={`px-6 py-3 rounded-2xl font-black text-xs uppercase tracking-widest transition-all ${activeTab === 'activities' ? 'bg-blue-600 text-white shadow-lg' : 'text-slate-400 hover:text-slate-600'}`}
        >
            Atividades Extras
        </button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-8">
        <div className="lg:col-span-3 space-y-8">
          {activeTab === 'exams' ? (
            <div className="space-y-6">
              <h3 className="text-xl font-black text-slate-800 flex items-center gap-2 uppercase tracking-tighter"><BookOpen className="text-blue-600" size={24}/> Avaliações Oficiais</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {subjects.map(subj => (
                  <div key={subj} className="bg-white p-8 rounded-[32px] border border-slate-100 shadow-sm hover:shadow-xl transition-all space-y-6 group">
                    <div className="flex justify-between items-center">
                      <h4 className="font-black text-slate-800 uppercase tracking-tighter text-xl">{subj}</h4>
                      <FileCheck className="text-blue-600" size={24} />
                    </div>
                    <div className="space-y-2">
                      <button onClick={() => handleStartOfficial(subj)} disabled={!!loadingSubject} className="w-full bg-slate-900 text-white font-black py-4 rounded-2xl flex justify-center items-center gap-2 hover:bg-slate-800 transition-all disabled:opacity-50 text-sm">
                        {loadingSubject === `official-${subj}` ? <Loader2 size={20} className="animate-spin"/> : 'REALIZAR PROVA'}
                      </button>
                      <button onClick={() => handleStartMock(subj)} disabled={!!loadingSubject} className="w-full bg-blue-50 text-blue-700 font-black py-3 rounded-2xl flex justify-center items-center gap-2 text-[10px] uppercase tracking-widest">
                         {loadingSubject === `mock-${subj}` ? <Loader2 size={16} className="animate-spin"/> : <Sparkles size={16}/>} Gerar Simulado de Treino
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ) : (
            <div className="space-y-6">
              <h3 className="text-xl font-black text-slate-800 flex items-center gap-2 uppercase tracking-tighter"><FileText className="text-blue-600" size={24}/> Atividades Publicadas</h3>
              {extraActivities.length > 0 ? (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  {extraActivities.map(act => (
                    <div key={act.id} className="bg-white p-8 rounded-[32px] border border-slate-100 shadow-sm hover:shadow-xl transition-all flex flex-col justify-between">
                        <div className="space-y-4">
                            <div className="flex justify-between items-start">
                                <span className="bg-blue-100 text-blue-600 text-[10px] font-black px-3 py-1 rounded-full uppercase tracking-tighter">{act.subject}</span>
                                <span className="text-slate-300 text-[10px] font-bold">{new Date(act.created_at || '').toLocaleDateString()}</span>
                            </div>
                            <h4 className="font-black text-slate-800 text-xl tracking-tighter uppercase leading-none">{act.theme}</h4>
                            <p className="text-xs text-slate-400 font-medium">Contém questões abertas e fechadas para fixação.</p>
                        </div>
                        <button 
                            onClick={() => {
                                setSelectedActivity(act);
                                setActivityAnswers(new Array(act.questions.length).fill(''));
                                setActivityResult(null);
                            }}
                            className="w-full bg-slate-900 text-white font-black py-4 rounded-2xl mt-8 flex justify-center items-center gap-2 hover:bg-slate-800"
                        >
                            ABRIR ATIVIDADE
                        </button>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="bg-white p-20 rounded-[40px] border-2 border-dashed border-slate-100 text-center space-y-4">
                    <div className="bg-slate-50 w-20 h-20 rounded-full flex items-center justify-center mx-auto text-slate-200"><FileText size={40}/></div>
                    <p className="font-black text-slate-300 uppercase tracking-widest text-xs">Nenhuma atividade extra para sua série.</p>
                </div>
              )}
            </div>
          )}
        </div>

        <div className="space-y-6">
          <div className="bg-white p-8 rounded-[32px] border border-slate-100 shadow-sm">
            <h3 className="font-black mb-6 flex items-center gap-2 text-slate-400 text-[10px] uppercase tracking-widest border-b pb-4"><History size={16}/> Minhas Notas</h3>
            <div className="space-y-3">
              {assessments.map((a, i) => (
                <div key={i} className="flex justify-between items-center p-4 bg-slate-50 rounded-2xl">
                  <div>
                    <p className="text-[10px] font-black text-slate-700 uppercase">{a.subject}</p>
                    <p className="text-[8px] text-slate-400 font-black uppercase">{a.isMock ? 'SIMULADO' : 'OFICIAL'}</p>
                  </div>
                  <span className={`text-lg font-black ${a.score >= 6 ? 'text-green-600' : 'text-red-500'}`}>{a.score.toFixed(1)}</span>
                </div>
              ))}
              {assessments.length === 0 && <p className="text-[10px] text-slate-300 text-center py-6 italic">Nenhuma nota registrada.</p>}
            </div>
          </div>
        </div>
      </div>

      {/* Modal de Realização de Atividade Extra */}
      {selectedActivity && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-md z-[100] flex items-center justify-center p-4">
            <div className="bg-white w-full max-w-4xl rounded-[40px] shadow-2xl overflow-hidden flex flex-col max-h-[90vh] animate-fade-in">
                <div className="p-8 bg-slate-900 text-white flex justify-between items-center">
                    <div className="flex items-center gap-4">
                        <div className="bg-blue-600 p-2 rounded-xl"><FileText size={24}/></div>
                        <div>
                            <h3 className="font-black text-xl tracking-tighter uppercase">{selectedActivity.theme}</h3>
                            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">{selectedActivity.subject} • Atividade Extra</p>
                        </div>
                    </div>
                    <button onClick={() => setSelectedActivity(null)} className="p-2 hover:bg-white/10 rounded-full transition-colors"><X size={24}/></button>
                </div>

                <div className="p-10 overflow-y-auto space-y-12">
                    {activityResult ? (
                        <div className="space-y-8 animate-fade-in text-center">
                            <div className="bg-blue-600 p-10 rounded-[40px] text-white">
                                <CheckCircle size={64} className="mx-auto mb-6 text-blue-200"/>
                                <h4 className="text-3xl font-black uppercase tracking-tighter mb-2">Correção Finalizada</h4>
                                <p className="text-blue-100 text-sm mb-8 opacity-80 italic">"Análise realizada pela Inteligência Artificial Frederico"</p>
                                
                                <div className="bg-white/10 rounded-[32px] p-8 border border-white/10 text-left">
                                    <div className="flex justify-between items-center mb-6">
                                        <p className="text-[10px] font-black uppercase tracking-widest text-blue-200">Nota Estimada</p>
                                        <p className="text-5xl font-black">{activityResult.score.toFixed(1)}</p>
                                    </div>
                                    <div className="space-y-2">
                                        <p className="text-[10px] font-black uppercase tracking-widest text-blue-200">Feedback Pedagógico</p>
                                        <p className="text-sm leading-relaxed">{activityResult.feedback}</p>
                                    </div>
                                </div>
                            </div>
                            <button 
                                onClick={() => setSelectedActivity(null)}
                                className="bg-slate-900 text-white font-black px-12 py-5 rounded-2xl shadow-xl hover:scale-105 transition-all"
                            >
                                FECHAR ATIVIDADE
                            </button>
                        </div>
                    ) : (
                        <>
                            {selectedActivity.questions.map((q, idx) => (
                                <div key={idx} className="space-y-6 border-b border-slate-50 pb-12 last:border-0">
                                    <div className="flex justify-between items-center">
                                        <span className="bg-slate-900 text-white text-[9px] font-black px-3 py-1 rounded-lg uppercase tracking-widest">Questão {idx + 1}</span>
                                        <span className="text-[9px] font-black text-slate-300 uppercase tracking-widest">{q.type === 'multiple' ? 'Múltipla Escolha' : 'Questão Aberta'}</span>
                                    </div>
                                    {q.citation && (
                                        <div className="p-6 bg-slate-50 border-l-4 border-blue-600 rounded-r-2xl">
                                            <Quote size={20} className="text-blue-200 mb-2"/>
                                            <p className="text-slate-600 italic text-lg leading-relaxed">"{q.citation}"</p>
                                        </div>
                                    )}
                                    <h4 className="text-2xl font-black text-slate-800 tracking-tight leading-tight">{q.question}</h4>
                                    
                                    {q.type === 'multiple' ? (
                                        <div className="grid gap-3">
                                            {q.options?.map((opt, oIdx) => (
                                                <button 
                                                    key={oIdx}
                                                    onClick={() => {
                                                        const newAns = [...activityAnswers];
                                                        newAns[idx] = oIdx;
                                                        setActivityAnswers(newAns);
                                                    }}
                                                    className={`w-full text-left p-5 rounded-2xl border-2 flex gap-4 items-center transition-all ${
                                                        activityAnswers[idx] === oIdx ? 'bg-blue-600 border-blue-600 text-white shadow-lg' : 'bg-white border-slate-100 hover:border-blue-200 text-slate-500'
                                                    }`}
                                                >
                                                    <span className={`w-10 h-10 flex items-center justify-center rounded-xl font-black ${
                                                        activityAnswers[idx] === oIdx ? 'bg-white/20 text-white' : 'bg-slate-100 text-slate-400'
                                                    }`}>{String.fromCharCode(65 + oIdx)}</span>
                                                    <span className="font-bold">{opt}</span>
                                                </button>
                                            ))}
                                        </div>
                                    ) : (
                                        <textarea 
                                            placeholder="Desenvolva sua resposta com base no texto acima..."
                                            className="w-full h-40 p-6 bg-slate-50 border border-slate-100 rounded-[32px] outline-none focus:ring-2 focus:ring-blue-500 text-slate-700 font-medium"
                                            value={activityAnswers[idx]}
                                            onChange={(e) => {
                                                const newAns = [...activityAnswers];
                                                newAns[idx] = e.target.value;
                                                setActivityAnswers(newAns);
                                            }}
                                        />
                                    )}
                                </div>
                            ))}
                            <button 
                                onClick={handleSubmitActivity}
                                disabled={isSubmittingActivity || activityAnswers.some(a => a === '' || a === -1)}
                                className="w-full bg-blue-600 text-white font-black py-6 rounded-[32px] shadow-2xl hover:bg-blue-700 transition-all flex justify-center items-center gap-3 disabled:opacity-50"
                            >
                                {isSubmittingActivity ? <Loader2 className="animate-spin" size={24}/> : <Send size={20}/>}
                                FINALIZAR E ENVIAR PARA CORREÇÃO IA
                            </button>
                        </>
                    )}
                </div>
            </div>
        </div>
      )}
    </div>
  );
};

export default StudentDashboard;
