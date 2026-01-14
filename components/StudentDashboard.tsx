
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
      alert("Erro de conexão ao carregar a prova."); 
    }
    setLoadingSubject(null);
  };

  const handleStartMock = async (subject: Subject) => {
    setLoadingSubject(`mock-${subject}`);
    try {
      const { data } = await supabase.from('topics').select('content').eq('subject', subject).eq('grade', currentUser.grade).eq('quarter', settings.activeQuarter).order('created_at', { ascending: false }).limit(1).maybeSingle();
      
      if (!data || !data.content) {
        alert(`Não há conteúdo planejado para ${subject}.`);
        setLoadingSubject(null);
        return;
      }

      const qs = await generateEnemAssessment(subject, data.content, currentUser.grade || '1ª');
      if (qs && qs.length > 0) {
        setActiveQuestions(qs);
        setSession({ active: true, subject, isMock: true });
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
            <p className="text-[10px] font-black bg-white/10 px-3 py-1 rounded-full border border-white/10 uppercase tracking-widest mt-2">{currentUser.grade} série • Turma {currentUser.className}</p>
          </div>
        </div>
        <div className="bg-white p-6 rounded-3xl shadow-xl text-center min-w-[120px] z-10">
            <p className="text-[10px] font-black uppercase text-slate-400 mb-1 tracking-widest">Bimestre</p>
            <p className="font-black text-3xl text-blue-600">{settings.activeQuarter}º</p>
        </div>
      </div>

      <div className="flex gap-2 bg-white p-2 rounded-3xl border border-slate-100 shadow-sm w-fit mx-auto md:mx-0">
        <button 
            onClick={() => setActiveTab('exams')}
            className={`px-8 py-3 rounded-2xl font-black text-xs uppercase tracking-widest transition-all ${activeTab === 'exams' ? 'bg-blue-600 text-white shadow-lg' : 'text-slate-400 hover:text-slate-600'}`}
        >
            Avaliações
        </button>
        <button 
            onClick={() => setActiveTab('activities')}
            className={`px-8 py-3 rounded-2xl font-black text-xs uppercase tracking-widest transition-all ${activeTab === 'activities' ? 'bg-blue-600 text-white shadow-lg' : 'text-slate-400 hover:text-slate-600'}`}
        >
            Atividades Extras
        </button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-8">
        <div className="lg:col-span-3">
          {activeTab === 'exams' ? (
            <div className="space-y-6">
              <h3 className="text-xl font-black text-slate-800 flex items-center gap-2 uppercase tracking-tighter"><BookOpen className="text-blue-600" size={24}/> Provas Oficiais</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {subjects.map(subj => (
                  <div key={subj} className="bg-white p-8 rounded-[32px] border border-slate-100 shadow-sm hover:shadow-xl transition-all space-y-6">
                    <div className="flex justify-between items-center">
                      <h4 className="font-black text-slate-800 uppercase tracking-tighter text-xl">{subj}</h4>
                      <FileCheck className="text-blue-600" size={24} />
                    </div>
                    <div className="space-y-2">
                      <button onClick={() => handleStartOfficial(subj)} disabled={!!loadingSubject} className="w-full bg-slate-900 text-white font-black py-4 rounded-2xl hover:bg-slate-800 disabled:opacity-50 text-sm">
                        REALIZAR PROVA
                      </button>
                      <button onClick={() => handleStartMock(subj)} disabled={!!loadingSubject} className="w-full bg-blue-50 text-blue-700 font-black py-3 rounded-2xl text-[10px] uppercase tracking-widest">
                         Gerar Simulado
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ) : (
            <div className="space-y-6">
              <h3 className="text-xl font-black text-slate-800 flex items-center gap-2 uppercase tracking-tighter"><FileText className="text-blue-600" size={24}/> Atividades Extras</h3>
              {extraActivities.length > 0 ? (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  {extraActivities.map(act => (
                    <div key={act.id} className="bg-white p-8 rounded-[32px] border border-slate-100 shadow-sm flex flex-col justify-between">
                        <div className="space-y-4">
                            <span className="bg-blue-100 text-blue-600 text-[10px] font-black px-3 py-1 rounded-full uppercase">{act.subject}</span>
                            <h4 className="font-black text-slate-800 text-xl tracking-tighter uppercase leading-none">{act.theme}</h4>
                        </div>
                        <button 
                            onClick={() => { setSelectedActivity(act); setActivityAnswers(new Array(act.questions.length).fill('')); setActivityResult(null); }}
                            className="w-full bg-slate-900 text-white font-black py-4 rounded-2xl mt-8 hover:bg-slate-800"
                        >
                            INICIAR ATIVIDADE
                        </button>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="bg-white p-20 rounded-[40px] border-2 border-dashed border-slate-100 text-center text-slate-300">
                    <p className="font-black uppercase tracking-widest text-xs">Nenhuma atividade extra disponível para sua série.</p>
                </div>
              )}
            </div>
          )}
        </div>

        <div className="bg-white p-8 rounded-[32px] border border-slate-100 shadow-sm h-fit">
          <h3 className="font-black mb-6 text-slate-400 text-[10px] uppercase tracking-widest border-b pb-4">Desempenho Recente</h3>
          <div className="space-y-3">
            {assessments.slice(0, 5).map((a, i) => (
              <div key={i} className="flex justify-between items-center p-4 bg-slate-50 rounded-2xl">
                <div>
                  <p className="text-[10px] font-black text-slate-700 uppercase">{a.subject}</p>
                  <p className="text-[8px] text-slate-400 font-black uppercase">{a.isMock ? 'SIMULADO' : 'OFICIAL'}</p>
                </div>
                <span className={`text-lg font-black ${a.score >= 6 ? 'text-green-600' : 'text-red-500'}`}>{a.score.toFixed(1)}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {selectedActivity && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-md z-[100] flex items-center justify-center p-4">
            <div className="bg-white w-full max-w-4xl rounded-[40px] shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
                <div className="p-8 bg-slate-900 text-white flex justify-between items-center">
                    <h3 className="font-black text-xl uppercase">{selectedActivity.theme}</h3>
                    <button onClick={() => setSelectedActivity(null)} className="p-2 hover:bg-white/10 rounded-full"><X size={24}/></button>
                </div>
                <div className="p-10 overflow-y-auto space-y-12">
                    {activityResult ? (
                        <div className="text-center space-y-8">
                            <div className="bg-blue-600 p-10 rounded-[40px] text-white">
                                <h4 className="text-2xl font-black uppercase mb-4">Análise IA Finalizada</h4>
                                <div className="text-5xl font-black mb-4">{activityResult.score.toFixed(1)}</div>
                                <p className="text-blue-100 leading-relaxed italic">"{activityResult.feedback}"</p>
                            </div>
                            <button onClick={() => setSelectedActivity(null)} className="bg-slate-900 text-white font-black px-12 py-4 rounded-2xl">FECHAR</button>
                        </div>
                    ) : (
                        <>
                            {selectedActivity.questions.map((q, idx) => (
                                <div key={idx} className="space-y-6">
                                    <span className="bg-slate-900 text-white text-[9px] font-black px-3 py-1 rounded-lg uppercase">Questão {idx + 1}</span>
                                    {q.citation && <p className="p-6 bg-slate-50 border-l-4 border-blue-600 italic text-slate-600">"{q.citation}"</p>}
                                    <h4 className="text-xl font-black text-slate-800">{q.question}</h4>
                                    {q.type === 'multiple' ? (
                                        <div className="grid gap-3">
                                            {q.options?.map((opt, oIdx) => (
                                                <button key={oIdx} onClick={() => { const n = [...activityAnswers]; n[idx] = oIdx; setActivityAnswers(n); }}
                                                    className={`w-full text-left p-4 rounded-xl border-2 ${activityAnswers[idx] === oIdx ? 'bg-blue-600 text-white' : 'bg-white'}`}>
                                                    {opt}
                                                </button>
                                            ))}
                                        </div>
                                    ) : (
                                        <textarea className="w-full h-32 p-4 bg-slate-50 border rounded-2xl" placeholder="Sua resposta..."
                                            onChange={(e) => { const n = [...activityAnswers]; n[idx] = e.target.value; setActivityAnswers(n); }} />
                                    )}
                                </div>
                            ))}
                            <button onClick={handleSubmitActivity} className="w-full bg-blue-600 text-white font-black py-6 rounded-[32px]">
                                {isSubmittingActivity ? "CORRIGINDO..." : "ENVIAR PARA CORREÇÃO IA"}
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
