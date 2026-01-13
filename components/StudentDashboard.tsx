
import React, { useState, useEffect, useRef } from 'react';
import { UserProfile, GlobalSettings, Subject, Assessment, Question, ExtraActivity } from '../types';
import { Sparkles, History, Loader2, FileCheck, ClipboardList, Send, CheckCircle2, User, Camera, Upload, ChevronLeft, RefreshCw, BookOpen, AlertCircle, X } from 'lucide-react';
import { supabase } from '../lib/supabase';
import AssessmentSession from './AssessmentSession';
import { generateEnemAssessment, evaluateActivitySubmission } from '../services/geminiService';

interface StudentDashboardProps {
  currentUser: UserProfile;
  settings: GlobalSettings;
}

const StudentDashboard: React.FC<StudentDashboardProps> = ({ currentUser, settings }) => {
  const [session, setSession] = useState<{ active: boolean; subject?: Subject; isMock: boolean }>({ active: false, isMock: false });
  const [extraSession, setExtraSession] = useState<ExtraActivity | null>(null);
  const [extraAnswers, setExtraAnswers] = useState<any[]>([]);
  const [submittingExtra, setSubmittingExtra] = useState(false);
  
  const [assessments, setAssessments] = useState<Assessment[]>([]);
  const [pendingExtras, setPendingExtras] = useState<ExtraActivity[]>([]);
  const [loadingSubject, setLoadingSubject] = useState<string | null>(null);
  const [isChangingPhoto, setIsChangingPhoto] = useState(false);
  const [newPhoto, setNewPhoto] = useState('');
  const [cameraActive, setCameraActive] = useState(false);

  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  const subjects: Subject[] = ['História', 'Filosofia', 'Geografia', 'Sociologia'];

  useEffect(() => {
    fetchAssessments();
    fetchPendingExtras();
  }, [currentUser.id]);

  const fetchAssessments = async () => {
    const { data } = await supabase.from('assessments').select('*').eq('student_id', currentUser.id).order('created_at', { ascending: false });
    if (data) setAssessments(data.map(d => ({ ...d, studentId: d.student_id, isMock: d.is_mock, cheatingAttempts: d.cheating_attempts, createdAt: d.created_at })));
  };

  const fetchPendingExtras = async () => {
    const { data } = await supabase.from('extra_activities').select('*').eq('grade', currentUser.grade).or(`class_name.is.null,class_name.eq.${currentUser.className}`).order('created_at', { ascending: false });
    if (data) {
      const { data: done } = await supabase.from('activity_submissions').select('activity_id').eq('student_id', currentUser.id);
      const doneIds = done?.map(d => d.activity_id) || [];
      setPendingExtras(data.filter(act => !doneIds.includes(act.id)).map(act => ({ ...act, teacherId: act.teacher_id, createdAt: act.created_at })));
    }
  };

  const handleSubmitExtra = async () => {
    if (!extraSession) return;
    setSubmittingExtra(true);
    try {
      const evaluation = await evaluateActivitySubmission(extraSession, extraAnswers);
      const { error } = await supabase.from('activity_submissions').insert([{
        activity_id: extraSession.id,
        student_id: currentUser.id,
        answers: extraAnswers,
        score: evaluation.score,
        feedback: evaluation.feedback
      }]);

      if (!error) {
        alert(`Atividade enviada! Nota: ${evaluation.score.toFixed(1)}`);
        setExtraSession(null);
        fetchPendingExtras();
      } else {
        alert("Erro ao enviar: " + error.message);
      }
    } catch (e: any) {
      alert("Erro na correção: " + e.message);
    } finally {
      setSubmittingExtra(false);
    }
  };

  const handleStartOfficial = async (subject: Subject) => {
    if (settings.isAssessmentLocked[settings.activeQuarter]) {
      alert(`As avaliações do ${settings.activeQuarter}º Bimestre estão bloqueadas pelo administrador.`);
      return;
    }

    setLoadingSubject(`official-${subject}`);
    try {
      const { data } = await supabase
        .from('official_exams')
        .select('questions')
        .eq('subject', subject)
        .eq('grade', currentUser.grade)
        .eq('quarter', settings.activeQuarter)
        .maybeSingle();

      if (data) {
        (window as any)._currentQuestions = data.questions;
        setSession({ active: true, subject, isMock: false });
      } else {
        alert(`A prova de ${subject} ainda não foi gerada pelo administrador.`);
      }
    } catch (e: any) {
      alert("Erro ao carregar prova: " + e.message);
    }
    setLoadingSubject(null);
  };

  const handleStartMock = async (subject: Subject) => {
    setLoadingSubject(`mock-${subject}`);
    try {
      const { data } = await supabase
        .from('topics')
        .select('content')
        .eq('subject', subject)
        .eq('grade', currentUser.grade)
        .eq('quarter', settings.activeQuarter)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();

      if (data) {
        const qs = await generateEnemAssessment(subject, data.content, currentUser.grade || '1ª');
        (window as any)._currentQuestions = qs;
        setSession({ active: true, subject, isMock: true });
      } else {
        alert("Não existem tópicos cadastrados para gerar este simulado.");
      }
    } catch (err: any) {
      alert("Erro ao gerar simulado: " + err.message);
    }
    setLoadingSubject(null);
  };

  if (session.active && session.subject) {
    return (
      <AssessmentSession 
        subject={session.subject} 
        isMock={session.isMock} 
        currentUser={currentUser} 
        questions={(window as any)._currentQuestions} 
        onComplete={() => { setSession({ active: false, isMock: false }); fetchAssessments(); }} 
        onCancel={() => setSession({ active: false, isMock: false })} 
      />
    );
  }

  return (
    <div className="space-y-8 animate-fade-in">
      <div className="bg-gradient-to-br from-blue-600 via-blue-700 to-indigo-900 rounded-[40px] p-10 text-white shadow-2xl flex flex-col md:flex-row justify-between items-center gap-8 relative overflow-hidden">
        <div className="absolute top-0 right-0 p-12 opacity-10"><Sparkles size={120}/></div>
        <div className="flex items-center gap-8 z-10">
          <div className="relative group cursor-pointer" onClick={() => setIsChangingPhoto(true)}>
            <div className="w-28 h-28 rounded-[32px] bg-white/20 border-4 border-white/30 overflow-hidden shadow-2xl transition-transform hover:scale-105">
              {currentUser.avatarUrl ? <img src={currentUser.avatarUrl} className="w-full h-full object-cover"/> : <User className="w-full h-full p-8 text-white"/>}
            </div>
            <div className="absolute inset-0 flex items-center justify-center bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity rounded-[32px]">
              <RefreshCw className="text-white" size={24}/>
            </div>
          </div>
          <div>
            <h2 className="text-4xl font-black leading-tight tracking-tighter">Olá, {currentUser.fullName.split(' ')[0]}!</h2>
            <div className="flex gap-2 mt-2">
               <span className="bg-white/10 px-3 py-1 rounded-full text-[10px] font-bold uppercase tracking-widest border border-white/10">Série: {currentUser.grade}</span>
               <span className="bg-white/10 px-3 py-1 rounded-full text-[10px] font-bold uppercase tracking-widest border border-white/10">Turma: {currentUser.className}</span>
            </div>
          </div>
        </div>
        <div className="flex gap-4 z-10">
          <div className="bg-white p-6 rounded-3xl shadow-xl text-center min-w-[120px]">
            <p className="text-[10px] font-black uppercase text-slate-400 mb-1 tracking-widest">Bimestre</p>
            <p className="font-black text-3xl text-blue-600">{settings.activeQuarter}º</p>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-8">
        <div className="lg:col-span-3 space-y-8">
          <div className="space-y-6">
            <h3 className="text-2xl font-black text-slate-800 flex items-center gap-3"><BookOpen className="text-blue-600" size={28}/> Avaliações Oficiais</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {subjects.map(subj => {
                const isOfficialLoading = loadingSubject === `official-${subj}`;
                const isMockLoading = loadingSubject === `mock-${subj}`;
                return (
                  <div key={subj} className="bg-white p-8 rounded-[32px] border border-slate-100 shadow-sm hover:shadow-xl hover:border-blue-100 transition-all space-y-6 group">
                    <div className="flex justify-between items-center">
                      <h4 className="font-black text-slate-800 uppercase tracking-tighter text-xl">{subj}</h4>
                      <FileCheck className="text-blue-600 group-hover:scale-110 transition-transform" size={24} />
                    </div>
                    <div className="space-y-3">
                      <button 
                        onClick={() => handleStartOfficial(subj)}
                        disabled={!!loadingSubject}
                        className="w-full bg-slate-900 text-white font-black py-4 rounded-2xl flex justify-center items-center gap-2 hover:bg-slate-800 transition-all disabled:opacity-50 text-sm tracking-wide"
                      >
                        {isOfficialLoading ? <Loader2 size={20} className="animate-spin"/> : 'INICIAR PROVA OFICIAL'}
                      </button>
                      <button 
                        onClick={() => handleStartMock(subj)}
                        disabled={!!loadingSubject}
                        className="w-full bg-blue-50 text-blue-700 border border-blue-100 font-black py-4 rounded-2xl flex justify-center items-center gap-2 hover:bg-blue-100 transition-all disabled:opacity-50 text-[10px] tracking-widest"
                      >
                        {isMockLoading ? <Loader2 size={16} className="animate-spin"/> : <Sparkles size={16} className="text-blue-400"/>}
                        {isMockLoading ? 'GERANDO SIMULADO...' : 'TREINAR COM SIMULADO'}
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
          
          <div className="space-y-4">
            <h3 className="text-xl font-bold text-slate-800 flex items-center gap-2"><ClipboardList className="text-blue-600" size={20}/> Atividades Extras</h3>
            <div className="grid grid-cols-1 gap-4">
              {pendingExtras.map(act => (
                <div key={act.id} className="bg-white p-6 rounded-3xl border border-slate-200 shadow-sm flex flex-col md:flex-row justify-between items-center gap-4 border-l-8 border-l-blue-600">
                  <div className="flex-1">
                    <span className="text-[10px] font-black text-blue-600 uppercase bg-blue-50 px-2 py-0.5 rounded">{act.subject}</span>
                    <h4 className="font-bold text-slate-800 text-lg mt-1">{act.theme}</h4>
                  </div>
                  <button onClick={() => { setExtraSession(act); setExtraAnswers(new Array(act.questions.length).fill('')); }} className="bg-blue-600 text-white font-bold px-8 py-4 rounded-2xl shadow-lg hover:bg-blue-700 transition-all">Responder Agora</button>
                </div>
              ))}
              {pendingExtras.length === 0 && <p className="text-slate-400 italic text-sm p-12 bg-slate-50 rounded-3xl text-center border-2 border-dashed">Nenhuma atividade extra para hoje.</p>}
            </div>
          </div>
        </div>

        <div className="space-y-6">
          <div className="bg-white p-8 rounded-[32px] border border-slate-100 shadow-sm h-fit">
            <h3 className="font-black mb-8 flex items-center gap-2 text-slate-800 border-b pb-4 text-sm uppercase tracking-widest"><History size={18} className="text-blue-600"/> Histórico de Notas</h3>
            <div className="space-y-4">
              {assessments.slice(0, 8).map((a, i) => (
                <div key={i} className="flex justify-between items-center p-4 bg-slate-50 rounded-2xl border border-slate-200 hover:scale-[1.02] transition-transform">
                  <div>
                    <p className="text-[10px] font-black text-slate-700 uppercase tracking-tighter">{a.subject}</p>
                    <p className="text-[8px] text-slate-400 font-bold uppercase">{a.isMock ? 'SIMULADO' : 'OFICIAL'}</p>
                  </div>
                  <span className={`text-xl font-black ${a.score >= 6 ? 'text-green-600' : 'text-red-500'}`}>{a.score.toFixed(1)}</span>
                </div>
              ))}
              {assessments.length === 0 && <div className="text-center py-12"><AlertCircle className="mx-auto text-slate-300 mb-2" size={32}/><p className="text-xs text-slate-400 font-bold italic">Sem histórico ainda.</p></div>}
            </div>
          </div>
        </div>
      </div>

      {/* Modal de Responder Atividade Extra */}
      {extraSession && (
        <div className="fixed inset-0 bg-slate-900/80 backdrop-blur-sm z-[100] flex items-center justify-center p-4">
          <div className="bg-white w-full max-w-2xl rounded-[40px] shadow-2xl overflow-hidden animate-in zoom-in-95 duration-300 flex flex-col max-h-[90vh]">
            <div className="p-8 bg-blue-600 text-white flex justify-between items-center">
              <div>
                <h3 className="text-2xl font-black">{extraSession.theme}</h3>
                <p className="text-blue-100 text-xs font-bold uppercase tracking-widest">{extraSession.subject}</p>
              </div>
              <button onClick={() => setExtraSession(null)} className="p-2 hover:bg-white/20 rounded-full transition-colors"><X size={24}/></button>
            </div>
            
            <div className="p-8 overflow-y-auto space-y-8 flex-1">
              {extraSession.questions.map((q, idx) => (
                <div key={idx} className="space-y-4">
                  <p className="font-bold text-slate-800 text-lg">{idx + 1}. {q.question}</p>
                  {q.type === 'multiple' ? (
                    <div className="grid grid-cols-1 gap-2">
                      {q.options?.map((opt, oIdx) => (
                        <button 
                          key={oIdx}
                          onClick={() => {
                            const n = [...extraAnswers];
                            n[idx] = oIdx;
                            setExtraAnswers(n);
                          }}
                          className={`w-full text-left p-4 rounded-2xl border-2 transition-all flex items-center gap-3 ${extraAnswers[idx] === oIdx ? 'bg-blue-600 border-blue-600 text-white' : 'bg-slate-50 border-slate-100'}`}
                        >
                          <span className={`w-6 h-6 rounded flex items-center justify-center text-[10px] font-black ${extraAnswers[idx] === oIdx ? 'bg-white/20 text-white' : 'bg-white text-slate-400'}`}>
                            {String.fromCharCode(65 + oIdx)}
                          </span>
                          {opt}
                        </button>
                      ))}
                    </div>
                  ) : (
                    <textarea 
                      className="w-full h-32 p-4 bg-slate-50 border border-slate-200 rounded-2xl outline-none focus:ring-2 focus:ring-blue-500 focus:bg-white transition-all"
                      placeholder="Sua resposta..."
                      value={extraAnswers[idx]}
                      onChange={(e) => {
                        const n = [...extraAnswers];
                        n[idx] = e.target.value;
                        setExtraAnswers(n);
                      }}
                    />
                  )}
                </div>
              ))}
            </div>

            <div className="p-8 border-t bg-slate-50 flex justify-end gap-4">
              <button onClick={() => setExtraSession(null)} className="px-6 py-3 font-bold text-slate-400">Cancelar</button>
              <button 
                onClick={handleSubmitExtra}
                disabled={submittingExtra || extraAnswers.some(a => a === '' || a === undefined)}
                className="bg-blue-600 text-white px-10 py-4 rounded-2xl font-black shadow-xl shadow-blue-100 flex items-center gap-2 hover:bg-blue-700 transition-all disabled:opacity-50"
              >
                {submittingExtra ? <Loader2 size={20} className="animate-spin"/> : <Send size={20}/>}
                Enviar Atividade
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default StudentDashboard;
