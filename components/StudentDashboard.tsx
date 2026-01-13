
import React, { useState, useEffect, useRef } from 'react';
import { UserProfile, GlobalSettings, Subject, Assessment, Question, ExtraActivity } from '../types';
import { Sparkles, History, Loader2, FileCheck, ClipboardList, Send, CheckCircle2, User, Camera, Upload, ChevronLeft, RefreshCw, BookOpen } from 'lucide-react';
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

  const handleStartOfficial = async (subject: Subject) => {
    setLoadingSubject(`official-${subject}`);
    const { data, error } = await supabase
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
      alert(`Avaliação de ${subject} não disponível ou não gerada pelo administrador.`);
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
        .limit(1);

      if (data?.length) {
        const qs = await generateEnemAssessment(subject, data[0].content, currentUser.grade || '1ª');
        (window as any)._currentQuestions = qs;
        setSession({ active: true, subject, isMock: true });
      } else {
        alert("Sem tópicos disponíveis para este simulado.");
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
      <div className="bg-gradient-to-br from-blue-600 to-indigo-800 rounded-3xl p-8 text-white shadow-xl flex flex-col md:flex-row justify-between items-center gap-6">
        <div className="flex items-center gap-6">
          <div className="relative group cursor-pointer" onClick={() => setIsChangingPhoto(true)}>
            <div className="w-24 h-24 rounded-2xl bg-white/20 border-4 border-white/30 overflow-hidden shadow-lg">
              {currentUser.avatarUrl ? <img src={currentUser.avatarUrl} className="w-full h-full object-cover"/> : <User className="w-full h-full p-6 text-white"/>}
            </div>
            <div className="absolute inset-0 flex items-center justify-center bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity rounded-2xl">
              <RefreshCw className="text-white" size={24}/>
            </div>
          </div>
          <div>
            <h2 className="text-3xl font-bold leading-tight">Olá, {currentUser.fullName.split(' ')[0]}</h2>
            <p className="text-blue-100 opacity-80 font-medium">Estudante da EE Federico Pedreira Neto</p>
          </div>
        </div>
        <div className="flex gap-4">
          <div className="bg-white/10 px-6 py-3 rounded-2xl border border-white/20 text-center">
            <p className="text-[10px] font-black uppercase text-blue-200">Bimestre</p>
            <p className="font-bold text-lg">{settings.activeQuarter}º</p>
          </div>
          <div className="bg-white/10 px-6 py-3 rounded-2xl border border-white/20 text-center">
            <p className="text-[10px] font-black uppercase text-blue-200">Turma</p>
            <p className="font-bold text-lg">{currentUser.className}</p>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-8">
        <div className="lg:col-span-3 space-y-8">
          <div className="space-y-4">
            <h3 className="text-xl font-bold text-slate-800 flex items-center gap-2"><BookOpen className="text-blue-600" size={20}/> Avaliações Oficiais e Simulados</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {subjects.map(subj => (
                <div key={subj} className="bg-white p-6 rounded-3xl border border-slate-200 shadow-sm hover:shadow-md transition-all space-y-6">
                  <div className="flex justify-between items-center border-b pb-4">
                    <h4 className="font-black text-slate-800 uppercase tracking-tighter text-lg">{subj}</h4>
                    <FileCheck className="text-blue-600" size={20} />
                  </div>
                  <div className="space-y-3">
                    <button 
                      onClick={() => handleStartOfficial(subj)}
                      disabled={!!loadingSubject}
                      className="w-full bg-slate-900 text-white font-bold py-3.5 rounded-2xl flex justify-center items-center gap-2 disabled:opacity-50"
                    >
                      {loadingSubject === `official-${subj}` ? <Loader2 size={18} className="animate-spin"/> : 'Fazer Prova Oficial'}
                    </button>
                    <button 
                      onClick={() => handleStartMock(subj)}
                      disabled={!!loadingSubject}
                      className="w-full bg-blue-50 text-blue-600 border border-blue-100 font-bold py-3.5 rounded-2xl flex justify-center items-center gap-2 hover:bg-blue-100 transition-colors disabled:opacity-50"
                    >
                      {loadingSubject === `mock-${subj}` ? <Loader2 size={18} className="animate-spin"/> : <Sparkles size={16}/>}
                      {loadingSubject === `mock-${subj}` ? 'Gerando Questões...' : 'Gerar Simulado com IA'}
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="space-y-4">
            <h3 className="text-xl font-bold text-slate-800 flex items-center gap-2"><ClipboardList className="text-blue-600" size={20}/> Atividades Extras Pendentes</h3>
            <div className="grid grid-cols-1 gap-4">
              {pendingExtras.map(act => (
                <div key={act.id} className="bg-white p-5 rounded-3xl border border-slate-200 shadow-sm flex flex-col md:flex-row justify-between items-center gap-4 border-l-8 border-l-blue-600">
                  <div className="flex-1">
                    <span className="text-[10px] font-black text-blue-600 uppercase bg-blue-50 px-2 py-0.5 rounded">{act.subject}</span>
                    <h4 className="font-bold text-slate-800 text-lg mt-1">{act.theme}</h4>
                  </div>
                  <button onClick={() => { setExtraSession(act); setExtraAnswers(new Array(act.questions.length).fill('')); }} className="bg-blue-600 text-white font-bold px-8 py-3 rounded-2xl shadow-lg hover:bg-blue-700 transition-all flex items-center gap-2">Responder <Send size={16}/></button>
                </div>
              ))}
              {pendingExtras.length === 0 && <p className="text-slate-400 italic text-sm p-12 bg-slate-50 rounded-3xl text-center border-2 border-dashed">Nenhuma atividade extra pendente no momento.</p>}
            </div>
          </div>
        </div>

        <div className="space-y-6">
          <div className="bg-white p-6 rounded-3xl border border-slate-200 shadow-sm">
            <h3 className="font-bold mb-6 flex items-center gap-2 text-slate-800 border-b pb-4"><History size={18} className="text-blue-600"/> Últimas Notas</h3>
            <div className="space-y-3">
              {assessments.slice(0, 6).map((a, i) => (
                <div key={i} className="flex justify-between items-center p-3.5 bg-slate-50 rounded-2xl border border-slate-100 hover:scale-[1.02] transition-transform">
                  <div>
                    <p className="text-[10px] font-black text-slate-700 uppercase">{a.subject}</p>
                    <p className="text-[9px] text-slate-400 font-bold">{a.isMock ? 'SIMULADO' : 'OFICIAL'}</p>
                  </div>
                  <span className={`text-lg font-black ${a.score >= 6 ? 'text-green-600' : 'text-red-500'}`}>{a.score.toFixed(1)}</span>
                </div>
              ))}
              {assessments.length === 0 && <p className="text-xs text-slate-400 italic text-center py-8">Ainda sem histórico.</p>}
            </div>
          </div>
        </div>
      </div>

      {/* Reutiliza o modal de foto e atividades extras ja implementados */}
      {isChangingPhoto && (
        <div className="fixed inset-0 bg-slate-900/90 z-[110] flex items-center justify-center p-4">
          <div className="bg-white w-full max-w-md rounded-3xl shadow-2xl p-8 space-y-6">
            <h3 className="font-bold text-xl">Atualizar Foto de Perfil</h3>
            <div className="aspect-square bg-slate-100 rounded-3xl overflow-hidden border-4 border-slate-200 flex items-center justify-center relative">
              {newPhoto ? <img src={newPhoto} className="w-full h-full object-cover"/> : cameraActive ? <video ref={videoRef} autoPlay className="w-full h-full object-cover -scale-x-100"/> : <User size={48} className="text-slate-300"/>}
            </div>
            <div className="grid grid-cols-1 gap-3">
              {!newPhoto && !cameraActive && <button onClick={() => { setCameraActive(true); navigator.mediaDevices.getUserMedia({ video: true }).then(s => { if(videoRef.current) videoRef.current.srcObject = s; }); }} className="bg-slate-800 text-white font-bold py-3 rounded-xl">Ligar Câmera</button>}
              {cameraActive && <button onClick={() => { if(videoRef.current && canvasRef.current) { const ctx = canvasRef.current.getContext('2d'); canvasRef.current.width = videoRef.current.videoWidth; canvasRef.current.height = videoRef.current.videoHeight; ctx?.drawImage(videoRef.current, 0, 0); setNewPhoto(canvasRef.current.toDataURL('image/png')); (videoRef.current.srcObject as MediaStream).getTracks().forEach(t => t.stop()); setCameraActive(false); } }} className="bg-blue-600 text-white font-bold py-3 rounded-xl">Capturar Foto</button>}
              {newPhoto && <button onClick={async () => { setLoadingSubject('photo'); await supabase.from('profiles').update({ avatar_url: newPhoto }).eq('id', currentUser.id); window.location.reload(); }} className="bg-green-600 text-white font-bold py-3 rounded-xl">Salvar Nova Foto</button>}
              <button onClick={() => setIsChangingPhoto(false)} className="text-slate-400 font-bold">Cancelar</button>
            </div>
            <canvas ref={canvasRef} className="hidden" />
          </div>
        </div>
      )}
      
      {extraSession && (
        <div className="fixed inset-0 bg-slate-900/90 z-[100] flex items-center justify-center p-4">
           <div className="bg-white w-full max-w-2xl rounded-3xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
            <div className="p-6 bg-blue-600 text-white flex justify-between items-center">
              <button onClick={() => setExtraSession(null)} className="flex items-center gap-2 text-white/80 hover:text-white"><ChevronLeft size={20}/> Voltar</button>
              <div className="text-center">
                <h3 className="font-bold">{extraSession.theme}</h3>
                <p className="text-[10px] font-black uppercase text-blue-200">{extraSession.subject}</p>
              </div>
              <div className="w-10"></div>
            </div>
            <div className="p-8 overflow-y-auto flex-1 space-y-8">
              {extraSession.questions.map((q, idx) => (
                <div key={idx} className="space-y-4 p-5 bg-slate-50 rounded-2xl border border-slate-100">
                  <p className="font-bold text-slate-700">{idx + 1}. {q.question}</p>
                  {q.type === 'multiple' ? (
                    <div className="grid grid-cols-1 gap-2">
                      {q.options?.map((opt, oIdx) => (
                        <button key={oIdx} onClick={() => { const n = [...extraAnswers]; n[idx] = oIdx; setExtraAnswers(n); }} className={`w-full text-left p-3.5 rounded-xl border-2 transition-all ${extraAnswers[idx] === oIdx ? 'bg-blue-600 border-blue-600 text-white shadow-md' : 'bg-white border-slate-100'}`}>
                          {String.fromCharCode(65 + oIdx)}. {opt}
                        </button>
                      ))}
                    </div>
                  ) : <textarea className="w-full h-32 p-4 border rounded-xl text-sm outline-none focus:ring-2 focus:ring-blue-500" placeholder="Sua resposta detalhada..." value={extraAnswers[idx] || ''} onChange={(e) => { const n = [...extraAnswers]; n[idx] = e.target.value; setExtraAnswers(n); }} />}
                </div>
              ))}
            </div>
            <div className="p-6 border-t bg-slate-50">
              <button onClick={async () => {
                if (extraAnswers.some(a => a === '' || a === undefined)) { alert("Responda todas as questões!"); return; }
                setLoadingSubject('extra-submit');
                try {
                  const ev = await evaluateActivitySubmission(extraSession, extraAnswers);
                  await supabase.from('activity_submissions').insert([{ activity_id: extraSession.id, student_id: currentUser.id, answers: extraAnswers, score: ev.score, feedback: ev.feedback }]);
                  alert(`Enviado! Nota IA: ${ev.score}\nFeedback: ${ev.feedback}`);
                  setExtraSession(null); fetchPendingExtras();
                } finally { setLoadingSubject(null); }
              }} className="w-full bg-blue-600 text-white font-bold py-4 rounded-2xl shadow-lg flex justify-center gap-2">
                {loadingSubject === 'extra-submit' ? <Loader2 className="animate-spin" size={20}/> : <Send size={20}/>} Enviar para Correção da IA
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default StudentDashboard;
