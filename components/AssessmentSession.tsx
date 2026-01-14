
import React, { useState, useEffect } from 'react';
import { Subject, Question, UserProfile } from '../types';
import { AlertCircle, CheckCircle2, XCircle, Sparkles, Quote, Image as ImageIcon, Loader2 } from 'lucide-react';
import { generateAIFeedback } from '../services/geminiService';
import { supabase } from '../lib/supabase';

interface AssessmentSessionProps {
  subject: Subject;
  isMock: boolean;
  currentUser: UserProfile;
  questions: Question[];
  onComplete: (res: any) => void;
  onCancel: () => void;
}

const AssessmentSession: React.FC<AssessmentSessionProps> = ({ subject, isMock, currentUser, questions, onComplete, onCancel }) => {
  const [currentIdx, setCurrentIdx] = useState(0);
  const [answers, setAnswers] = useState<number[]>(new Array(questions.length).fill(-1));
  const [cheatingCount, setCheatingCount] = useState(0);
  const [isBlocked, setIsBlocked] = useState(false);
  const [isFinished, setIsFinished] = useState(false);
  const [aiFeedback, setAiFeedback] = useState('');
  const [loadingFeedback, setLoadingFeedback] = useState(false);

  useEffect(() => {
    if (isMock || isFinished || isBlocked) return;
    const handleViolation = () => {
      setCheatingCount(prev => {
        const next = prev + 1;
        if (next >= 6) setIsBlocked(true);
        return next;
      });
    };
    document.addEventListener('visibilitychange', () => document.visibilityState === 'hidden' && handleViolation());
    window.addEventListener('blur', handleViolation);
    return () => {
      document.removeEventListener('visibilitychange', handleViolation);
      window.removeEventListener('blur', handleViolation);
    };
  }, [isMock, isFinished, isBlocked]);

  const handleFinish = async () => {
    setIsFinished(true);
    setLoadingFeedback(true);
    const score = answers.reduce((acc, curr, idx) => curr === questions[idx].correctIndex ? acc + (10 / questions.length) : acc, 0);
    const feedback = await generateAIFeedback(subject, questions, answers);
    setAiFeedback(feedback);

    if (!isMock) {
      await supabase.from('assessments').insert([{
        student_id: currentUser.id,
        subject,
        quarter: 1, 
        grade: currentUser.grade,
        questions,
        answers, 
        score,
        is_mock: false,
        feedback,
        cheating_attempts: cheatingCount
      }]);
    }
    setLoadingFeedback(false);
  };

  if (isBlocked) {
    return (
      <div className="fixed inset-0 bg-slate-900 z-[100] flex items-center justify-center p-6 text-center">
        <div className="max-w-md bg-white rounded-[40px] p-10 shadow-2xl">
          <XCircle size={64} className="text-red-500 mx-auto mb-6" />
          <h2 className="text-2xl font-black text-slate-800 mb-2 uppercase tracking-tighter">PROVA BLOQUEADA</h2>
          <p className="text-slate-400 mb-8 text-sm">O sistema detectou múltiplas saídas da aba de prova (Tentativas de Cola).</p>
          <button onClick={onCancel} className="w-full bg-slate-900 text-white font-black py-4 rounded-2xl shadow-xl">Voltar ao Início</button>
        </div>
      </div>
    );
  }

  if (isFinished) {
    const totalScore = answers.reduce((acc, curr, idx) => curr === questions[idx].correctIndex ? acc + (10 / questions.length) : acc, 0);
    return (
      <div className="max-w-4xl mx-auto py-12 px-4 animate-fade-in">
        <div className="bg-white rounded-[48px] p-12 shadow-xl border border-slate-200 text-center">
          <CheckCircle2 size={80} className="text-green-500 mx-auto mb-6" />
          <h2 className="text-4xl font-black text-slate-800 mb-4 tracking-tighter uppercase">Avaliação Concluída!</h2>
          
          <div className="flex justify-center gap-12 my-10 bg-slate-50 p-8 rounded-[32px]">
            <div><p className="text-[10px] font-black text-slate-400 uppercase mb-1">Nota Final</p><p className="text-5xl font-black text-blue-600">{totalScore.toFixed(1)}</p></div>
            <div className="w-px bg-slate-200" />
            <div><p className="text-[10px] font-black text-slate-400 uppercase mb-1">Acertos</p><p className="text-5xl font-black text-slate-800">{answers.filter((a, i) => a === questions[i].correctIndex).length}/{questions.length}</p></div>
          </div>

          <div className="text-left bg-blue-600 p-8 rounded-[32px] text-white shadow-xl">
            <h3 className="font-black flex items-center gap-2 mb-4 text-[10px] uppercase tracking-widest"><Sparkles size={16}/> Comentário da IA Frederico</h3>
            {loadingFeedback ? <div className="flex items-center gap-2 animate-pulse"><Loader2 className="animate-spin" size={16}/> Gerando análise pedagógica...</div> : <p className="text-blue-50 leading-relaxed text-sm italic">"{aiFeedback}"</p>}
          </div>

          <button onClick={() => onComplete({ subject, score: totalScore, isMock })} className="mt-10 bg-slate-900 text-white font-black px-12 py-5 rounded-[24px] shadow-xl hover:scale-105 transition-all">RETORNAR AO PAINEL</button>
        </div>
      </div>
    );
  }

  const q = questions[currentIdx];

  return (
    <div className="max-w-5xl mx-auto pb-32 pt-10 px-4">
      <div className="bg-white/80 backdrop-blur-md border border-slate-200 rounded-[32px] p-6 mb-8 flex justify-between items-center shadow-lg sticky top-10 z-50">
        <div className="flex items-center gap-6">
          <div className="bg-blue-600 text-white w-14 h-14 rounded-2xl flex items-center justify-center font-black text-xl shadow-lg">
            {currentIdx + 1}<span className="text-xs text-blue-200 ml-1">/{questions.length}</span>
          </div>
          <div><h2 className="font-black text-slate-800 text-lg uppercase tracking-tighter">{subject}</h2><p className="text-[10px] uppercase font-black text-blue-500 tracking-widest">{isMock ? 'MODO SIMULADO' : 'AVALIAÇÃO OFICIAL'}</p></div>
        </div>
        {cheatingCount > 0 && <div className="bg-red-50 text-red-500 px-4 py-2 rounded-xl text-[10px] font-black border border-red-100 flex items-center gap-2"><AlertCircle size={14}/> ALERTAS: {cheatingCount}/6</div>}
      </div>

      <div className="space-y-8 animate-fade-in">
        <div className="bg-white border border-slate-200 rounded-[40px] p-10 shadow-sm relative">
          {q.citation && (
            <div className="mb-8 border-l-4 border-blue-600 pl-8 space-y-4">
              <div className="text-slate-600 italic text-xl leading-relaxed font-medium">"{q.citation}"</div>
            </div>
          )}
          {q.visualDescription && (
            <div className="mb-8 bg-slate-50 rounded-[24px] p-8 border border-slate-100">
               <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest flex items-center gap-2 mb-3"><ImageIcon size={14}/> Descrição da Imagem/Gráfico</p>
               <div className="p-4 bg-white border border-dashed rounded-xl text-slate-500 text-sm italic">{q.visualDescription}</div>
            </div>
          )}
          <h3 className="text-2xl font-black text-slate-800 mb-10 leading-tight">{q.text}</h3>
          <div className="space-y-3">
            {q.options.map((opt, i) => (
              <button key={i} onClick={() => { const n = [...answers]; n[currentIdx] = i; setAnswers(n); }} className={`w-full text-left p-6 rounded-[24px] border-2 transition-all flex items-start gap-5 ${answers[currentIdx] === i ? 'bg-blue-600 border-blue-600 text-white shadow-xl scale-[1.01]' : 'bg-white border-slate-100 hover:border-blue-200 text-slate-600 font-medium'}`}>
                <div className={`w-10 h-10 shrink-0 rounded-xl flex items-center justify-center font-black text-lg ${answers[currentIdx] === i ? 'bg-white/20 text-white' : 'bg-slate-100 text-slate-400'}`}>{String.fromCharCode(65 + i)}</div>
                <span className="pt-2 leading-tight">{opt}</span>
              </button>
            ))}
          </div>
        </div>

        <div className="flex justify-between items-center bg-white/90 backdrop-blur-md p-6 rounded-[32px] border border-slate-200 shadow-2xl fixed bottom-8 left-1/2 -translate-x-1/2 w-full max-w-xl z-50">
          <button disabled={currentIdx === 0} onClick={() => setCurrentIdx(prev => prev - 1)} className="px-8 py-4 font-black text-slate-400 disabled:opacity-0 uppercase text-xs">Anterior</button>
          <div className="flex gap-1.5">{questions.map((_, i) => <div key={i} className={`h-2 rounded-full transition-all ${i === currentIdx ? 'bg-blue-600 w-8' : answers[i] !== -1 ? 'bg-blue-200 w-2' : 'bg-slate-200 w-2'}`} />)}</div>
          {currentIdx === questions.length - 1 ? (
            <button onClick={handleFinish} disabled={answers.some(a => a === -1)} className="bg-green-600 text-white px-10 py-4 rounded-2xl font-black shadow-lg disabled:bg-slate-300 uppercase text-xs">Finalizar</button>
          ) : (
            <button onClick={() => setCurrentIdx(prev => prev + 1)} disabled={answers[currentIdx] === -1} className="bg-blue-600 text-white px-10 py-4 rounded-2xl font-black shadow-lg disabled:opacity-50 uppercase text-xs">Próxima</button>
          )}
        </div>
      </div>
    </div>
  );
};

export default AssessmentSession;
