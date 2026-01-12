
import React, { useState, useEffect, useRef } from 'react';
import { UserProfile, GlobalSettings, Subject, Assessment, Question, ExtraActivity } from '../types';
import { Sparkles, History, Loader2, FileCheck, ClipboardList, Send, CheckCircle2, User, Camera, Upload, ChevronLeft, RefreshCw } from 'lucide-react';
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
  const [loading, setLoading] = useState(false);
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

  const handleUpdatePhoto = async () => {
    setLoading(true);
    const { error } = await supabase.from('profiles').update({ avatar_url: newPhoto }).eq('id', currentUser.id);
    if (!error) {
      alert("Foto atualizada com sucesso!");
      window.location.reload();
    }
    setLoading(false);
  };

  const startCamera = async () => {
    setCameraActive(true);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: true });
      if (videoRef.current) videoRef.current.srcObject = stream;
    } catch (err) { alert("Erro ao acessar câmera."); setCameraActive(false); }
  };

  const capturePhoto = () => {
    if (videoRef.current && canvasRef.current) {
      const ctx = canvasRef.current.getContext('2d');
      canvasRef.current.width = videoRef.current.videoWidth;
      canvasRef.current.height = videoRef.current.videoHeight;
      ctx?.drawImage(videoRef.current, 0, 0);
      setNewPhoto(canvasRef.current.toDataURL('image/png'));
      (videoRef.current.srcObject as MediaStream).getTracks().forEach(t => t.stop());
      setCameraActive(false);
    }
  };

  if (session.active && session.subject) {
    return (
      <AssessmentSession subject={session.subject} isMock={session.isMock} currentUser={currentUser} questions={(window as any)._currentQuestions} onComplete={() => { setSession({ active: false, isMock: false }); fetchAssessments(); }} onCancel={() => setSession({ active: false, isMock: false })} />
    );
  }

  return (
    <div className="space-y-8 animate-fade-in">
      <div className="bg-gradient-to-r from-blue-600 to-indigo-700 rounded-3xl p-8 text-white shadow-xl flex flex-col md:flex-row justify-between items-center gap-6">
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
            <h2 className="text-3xl font-bold">Olá, {currentUser.fullName.split(' ')[0]}!</h2>
            <p className="text-blue-100 opacity-80">EE Federico José Pedreira Neto</p>
          </div>
        </div>
        <div className="bg-white/10 px-6 py-3 rounded-2xl border border-white/20 text-center">
          <p className="text-[10px] font-black uppercase text-blue-200">Turma</p>
          <p className="font-bold text-lg">{currentUser.grade} • {currentUser.className}</p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        <div className="lg:col-span-2 space-y-8">
          <div className="space-y-4">
            <h3 className="text-xl font-bold text-slate-800 flex items-center gap-2"><ClipboardList className="text-blue-600"/> Atividades Extras</h3>
            <div className="grid grid-cols-1 gap-4">
              {pendingExtras.map(act => (
                <div key={act.id} className="bg-white p-6 rounded-3xl border border-slate-200 shadow-sm flex flex-col md:flex-row justify-between items-center gap-4 border-l-4 border-l-blue-600">
                  <div className="flex-1">
                    <span className="text-[10px] font-black text-blue-600 uppercase tracking-widest">{act.subject}</span>
                    <h4 className="font-bold text-slate-800 text-lg">{act.theme}</h4>
                  </div>
                  <button onClick={() => { setExtraSession(act); setExtraAnswers(new Array(act.questions.length).fill('')); }} className="bg-blue-600 text-white font-bold px-6 py-3 rounded-xl shadow-lg hover:bg-blue-700 transition-all">Responder Agora</button>
                </div>
              ))}
              {pendingExtras.length === 0 && <p className="text-slate-400 italic text-sm p-8 bg-slate-50 rounded-3xl text-center border-2 border-dashed">Tudo em dia! Nenhuma atividade pendente.</p>}
            </div>
          </div>

          <div className="space-y-4">
            <h3 className="text-xl font-bold text-slate-800">Avaliações Bimestrais</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {subjects.map(subject => (
                <div key={subject} className="bg-white p-6 rounded-3xl border border-slate-200 shadow-sm hover:border-blue-500 transition-all group">
                  <div className="flex justify-between items-start mb-4">
                    <h4 className="font-black text-slate-800 text-lg uppercase tracking-tighter">{subject}</h4>
                    <FileCheck className="text-slate-300 group-hover:text-blue-500" size={20} />
                  </div>
                  <div className="flex flex-col gap-2">
                    <button onClick={async () => {
                      setLoading(true);
                      const { data } = await supabase.from('official_exams').select('questions').eq('subject', subject).eq('grade', currentUser.grade).eq('quarter', settings.activeQuarter).maybeSingle();
                      if (data) { (window as any)._currentQuestions = data.questions; setSession({ active: true, subject, isMock: false }); }
                      else alert("Prova ainda não disponível.");
                      setLoading(false);
                    }} disabled={loading} className="w-full bg-slate-900 text-white font-bold py-3 rounded-2xl flex justify-center gap-2">{loading ? <Loader2 className="animate-spin" size={18}/> : 'Iniciar Prova Oficial'}</button>
                    <button onClick={async () => {
                      setLoading(true);
                      const { data } = await supabase.from('topics').select('content').eq('subject', subject).eq('grade', currentUser.grade).eq('quarter', settings.activeQuarter).order('created_at', { ascending: false }).limit(1);
                      if (data?.length) { 
                        const qs = await generateEnemAssessment(subject, data[0].content, currentUser.grade || '1ª');
                        (window as any)._currentQuestions = qs; setSession({ active: true, subject, isMock: true });
                      } else alert("Nenhum tópico disponível para simulação.");
                      setLoading(false);
                    }} className="w-full border border-blue-100 text-blue-600 font-bold py-3 rounded-2xl flex justify-center gap-2 hover:bg-blue-50"><Sparkles size={16} /> Treinar Simulado IA</button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        <div className="bg-white p-6 rounded-3xl border border-slate-200 shadow-sm h-fit">
          <h3 className="font-bold mb-6 flex items-center gap-2 text-slate-800 border-b pb-4"><History size={18} className="text-blue-600"/> Histórico</h3>
          <div className="space-y-3">
            {assessments.slice(0, 5).map((a, i) => (
              <div key={i} className="flex justify-between items-center p-4 bg-slate-50 rounded-2xl border border-slate-100 transition-transform hover:scale-[1.02]">
                <div>
                  <p className="text-xs font-black text-slate-700 uppercase">{a.subject}</p>
                  <p className="text-[10px] text-slate-400 font-bold">{a.isMock ? 'SIMULADO' : 'OFICIAL'}</p>
                </div>
                <span className={`text-lg font-black ${a.score >= 6 ? 'text-green-600' : 'text-red-500'}`}>{a.score.toFixed(1)}</span>
              </div>
            ))}
            {assessments.length === 0 && <p className="text-xs text-slate-400 italic text-center py-8">Sem histórico.</p>}
          </div>
        </div>
      </div>

      {/* Modal Mudar Foto */}
      {isChangingPhoto && (
        <div className="fixed inset-0 bg-slate-900/90 z-[110] flex items-center justify-center p-4">
          <div className="bg-white w-full max-w-md rounded-3xl shadow-2xl p-8 space-y-6">
            <div className="flex justify-between items-center">
              <h3 className="font-bold text-xl">Atualizar Foto de Perfil</h3>
              <button onClick={() => setIsChangingPhoto(false)} className="text-slate-400">✕</button>
            </div>
            <div className="aspect-square bg-slate-100 rounded-3xl overflow-hidden border-4 border-slate-200 flex items-center justify-center">
              {newPhoto ? <img src={newPhoto} className="w-full h-full object-cover"/> : cameraActive ? <video ref={videoRef} autoPlay className="w-full h-full object-cover -scale-x-100"/> : <Camera size={48} className="text-slate-300"/>}
            </div>
            <div className="grid grid-cols-1 gap-3">
              {!newPhoto && !cameraActive && <button onClick={startCamera} className="bg-slate-800 text-white font-bold py-3 rounded-xl">Ligar Câmera</button>}
              {cameraActive && <button onClick={capturePhoto} className="bg-blue-600 text-white font-bold py-3 rounded-xl">Capturar Foto</button>}
              {newPhoto && <button onClick={handleUpdatePhoto} className="bg-green-600 text-white font-bold py-3 rounded-xl">{loading ? <Loader2 className="animate-spin mx-auto"/> : 'Salvar Nova Foto'}</button>}
              {newPhoto && <button onClick={() => setNewPhoto('')} className="text-blue-600 font-bold text-sm">Tirar outra</button>}
            </div>
          </div>
        </div>
      )}

      {/* Modal Resolução de Atividade Extra */}
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
                <div key={idx} className="space-y-4 p-4 bg-slate-50 rounded-2xl border border-slate-100">
                  <p className="font-bold text-slate-700">{idx + 1}. {q.question}</p>
                  {q.type === 'multiple' ? (
                    <div className="grid grid-cols-1 gap-2">
                      {q.options?.map((opt, oIdx) => (
                        <button key={oIdx} onClick={() => { const n = [...extraAnswers]; n[idx] = oIdx; setExtraAnswers(n); }} className={`w-full text-left p-3 rounded-xl border text-sm transition-all ${extraAnswers[idx] === oIdx ? 'bg-blue-600 border-blue-600 text-white shadow-md' : 'bg-white'}`}>
                          {String.fromCharCode(65 + oIdx)}. {opt}
                        </button>
                      ))}
                    </div>
                  ) : <textarea className="w-full h-24 p-4 border rounded-xl text-sm" placeholder="Sua resposta..." value={extraAnswers[idx] || ''} onChange={(e) => { const n = [...extraAnswers]; n[idx] = e.target.value; setExtraAnswers(n); }} />}
                </div>
              ))}
            </div>
            <div className="p-6 border-t bg-slate-50 flex gap-4">
              <button onClick={async () => {
                if (extraAnswers.some(a => a === '' || a === undefined)) { alert("Responda todas as questões!"); return; }
                setLoading(true);
                try {
                  const ev = await evaluateActivitySubmission(extraSession, extraAnswers);
                  await supabase.from('activity_submissions').insert([{ activity_id: extraSession.id, student_id: currentUser.id, answers: extraAnswers, score: ev.score, feedback: ev.feedback }]);
                  alert(`Enviado! Nota IA: ${ev.score}\nFeedback: ${ev.feedback}`);
                  setExtraSession(null); fetchPendingExtras();
                } finally { setLoading(false); }
              }} className="w-full bg-blue-600 text-white font-bold py-4 rounded-xl shadow-lg flex justify-center gap-2">
                {loading ? <Loader2 className="animate-spin" size={20}/> : <Send size={20}/>} Enviar para Correção da IA
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default StudentDashboard;
