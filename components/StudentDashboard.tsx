
import React, { useState, useEffect } from 'react';
import { UserProfile, GlobalSettings, Subject, Assessment, Question, ExtraActivity } from '../types';
import { Sparkles, History, Loader2, FileCheck, ClipboardList, Send, CheckCircle2 } from 'lucide-react';
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
    // Busca atividades da série do aluno ou da turma dele
    const { data, error } = await supabase
      .from('extra_activities')
      .select('*')
      .eq('grade', currentUser.grade)
      .or(`class_name.is.null,class_name.eq.${currentUser.className}`)
      .order('created_at', { ascending: false });

    if (data) {
      // Filtra as que ele já respondeu
      const { data: done } = await supabase.from('activity_submissions').select('activity_id').eq('student_id', currentUser.id);
      const doneIds = done?.map(d => d.activity_id) || [];
      setPendingExtras(data.filter(act => !doneIds.includes(act.id)).map(act => ({ ...act, teacherId: act.teacher_id, createdAt: act.created_at })));
    }
  };

  const startAssessment = async (subject: Subject, isMock: boolean) => {
    setLoading(true);
    try {
      let questions: Question[];
      if (isMock) {
        const { data: topicsData } = await supabase.from('topics').select('content').eq('subject', subject).eq('grade', currentUser.grade).eq('quarter', settings.activeQuarter).order('created_at', { ascending: false }).limit(1);
        if (!topicsData || topicsData.length === 0) {
          alert(`O professor ainda não determinou os assuntos.`);
          return;
        }
        questions = await generateEnemAssessment(subject, topicsData[0].content, currentUser.grade || '1ª');
      } else {
        const { data: officialExam } = await supabase.from('official_exams').select('questions').eq('subject', subject).eq('grade', currentUser.grade).eq('quarter', settings.activeQuarter).maybeSingle();
        if (!officialExam) {
          alert(`Avaliação não encontrada.`);
          return;
        }
        questions = officialExam.questions;
      }
      setSession({ active: true, subject, isMock });
      (window as any)._currentQuestions = questions;
    } finally {
      setLoading(false);
    }
  };

  const handleSubmitExtra = async () => {
    if (!extraSession) return;
    setLoading(true);
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
        alert(`Atividade enviada! Sua nota dada pela IA foi: ${evaluation.score}\nFeedback: ${evaluation.feedback}`);
        setExtraSession(null);
        setExtraAnswers([]);
        fetchPendingExtras();
      }
    } catch (err) {
      alert("Erro ao enviar resposta.");
    } finally {
      setLoading(false);
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
        <div>
          <h2 className="text-3xl font-bold">Olá, {currentUser.fullName.split(' ')[0]}!</h2>
          <p className="text-blue-100 opacity-80">EE Federico José Pedreira Neto</p>
        </div>
        <div className="bg-white/10 px-6 py-3 rounded-2xl border border-white/20">
          <p className="text-[10px] font-black uppercase text-blue-200">Turma</p>
          <p className="font-bold text-lg">{currentUser.grade} • {currentUser.className}</p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        <div className="lg:col-span-2 space-y-8">
          {/* Tarefas Extras Pendentes */}
          <div className="space-y-4">
            <h3 className="text-xl font-bold text-slate-800 flex items-center gap-2"><ClipboardList className="text-blue-600"/> Atividades Extras</h3>
            <div className="grid grid-cols-1 gap-4">
              {pendingExtras.map(act => (
                <div key={act.id} className="bg-white p-6 rounded-3xl border border-slate-200 shadow-sm flex flex-col md:flex-row justify-between items-center gap-4 border-l-4 border-l-blue-600">
                  <div>
                    <span className="text-[10px] font-black text-blue-600 uppercase tracking-widest">{act.subject}</span>
                    <h4 className="font-bold text-slate-800 text-lg">{act.theme}</h4>
                    <p className="text-xs text-slate-400">Enviada pelo seu professor</p>
                  </div>
                  <button onClick={() => { setExtraSession(act); setExtraAnswers(new Array(act.questions.length).fill('')); }} className="bg-blue-600 text-white font-bold px-6 py-3 rounded-xl shadow-lg hover:bg-blue-700 transition-all">Responder Agora</button>
                </div>
              ))}
              {pendingExtras.length === 0 && <p className="text-slate-400 italic text-sm p-8 bg-slate-50 rounded-3xl text-center border-2 border-dashed">Você não tem atividades extras pendentes.</p>}
            </div>
          </div>

          {/* Avaliações Bimestrais */}
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
                    <button onClick={() => startAssessment(subject, false)} disabled={loading} className="w-full bg-slate-900 text-white font-bold py-3 rounded-2xl flex justify-center gap-2 transition-transform active:scale-95">{loading ? <Loader2 className="animate-spin" size={18}/> : 'Iniciar Prova Oficial'}</button>
                    <button onClick={() => startAssessment(subject, true)} className="w-full border border-blue-100 text-blue-600 font-bold py-3 rounded-2xl flex justify-center gap-2 hover:bg-blue-50 transition-colors"><Sparkles size={16} /> Treinar Simulado IA</button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Histórico Lateral */}
        <div className="bg-white p-6 rounded-3xl border border-slate-200 shadow-sm h-fit">
          <h3 className="font-bold mb-6 flex items-center gap-2 text-slate-800 border-b pb-4"><History size={18} className="text-blue-600"/> Resultados Recentes</h3>
          <div className="space-y-3">
            {assessments.slice(0, 5).map((a, i) => (
              <div key={i} className="flex justify-between items-center p-4 bg-slate-50 rounded-2xl border border-slate-100">
                <div>
                  <p className="text-xs font-black text-slate-700 uppercase">{a.subject}</p>
                  <p className="text-[10px] text-slate-400 font-bold">{a.isMock ? 'SIMULADO' : 'OFICIAL'}</p>
                </div>
                <div className="text-right">
                  <span className={`text-lg font-black ${a.score >= 3.5 ? 'text-blue-600' : 'text-red-500'}`}>{a.score.toFixed(1)}</span>
                </div>
              </div>
            ))}
            {assessments.length === 0 && <p className="text-xs text-slate-400 italic text-center py-8">Sem histórico.</p>}
          </div>
        </div>
      </div>

      {/* Modal Resolução de Atividade Extra */}
      {extraSession && (
        <div className="fixed inset-0 bg-slate-900 z-[100] flex items-center justify-center p-4">
          <div className="bg-white w-full max-w-2xl rounded-3xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
            <div className="p-6 bg-blue-600 text-white flex justify-between items-center">
              <div>
                <h3 className="font-bold text-xl">{extraSession.theme}</h3>
                <p className="text-xs text-blue-100 uppercase font-bold">{extraSession.subject}</p>
              </div>
              <button onClick={() => setExtraSession(null)} className="text-white hover:text-red-200">✕</button>
            </div>
            <div className="p-8 overflow-y-auto flex-1 space-y-8">
              {extraSession.questions.map((q, idx) => (
                <div key={idx} className="space-y-4 p-4 bg-slate-50 rounded-2xl border border-slate-100">
                  <p className="font-bold text-slate-700">{idx + 1}. {q.question}</p>
                  {q.type === 'multiple' ? (
                    <div className="grid grid-cols-1 gap-2">
                      {q.options?.map((opt, oIdx) => (
                        <button 
                          key={oIdx} 
                          onClick={() => { const newAns = [...extraAnswers]; newAns[idx] = oIdx; setExtraAnswers(newAns); }} 
                          className={`w-full text-left p-3 rounded-xl border text-sm font-medium transition-all ${extraAnswers[idx] === oIdx ? 'bg-blue-600 border-blue-600 text-white shadow-md' : 'bg-white border-slate-200'}`}
                        >
                          {String.fromCharCode(65 + oIdx)}. {opt}
                        </button>
                      ))}
                    </div>
                  ) : (
                    <textarea 
                      className="w-full h-24 p-4 bg-white border border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-blue-500 text-sm" 
                      placeholder="Sua resposta..." 
                      value={extraAnswers[idx] || ''} 
                      onChange={(e) => { const newAns = [...extraAnswers]; newAns[idx] = e.target.value; setExtraAnswers(newAns); }} 
                    />
                  )}
                </div>
              ))}
            </div>
            <div className="p-6 border-t bg-slate-50 flex gap-4">
              <button onClick={() => setExtraSession(null)} className="flex-1 font-bold text-slate-400">Cancelar</button>
              <button onClick={handleSubmitExtra} disabled={loading || extraAnswers.some(a => a === '' || a === undefined)} className="flex-[2] bg-blue-600 text-white font-bold py-4 rounded-xl shadow-lg flex justify-center gap-2">
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
