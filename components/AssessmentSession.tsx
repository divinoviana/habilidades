
import React, { useState, useEffect } from 'react';
import { Subject, Question, UserProfile } from '../types';
import { AlertCircle, CheckCircle2, XCircle, Sparkles, Quote, Image as ImageIcon } from 'lucide-react';
import { generateAIFeedback } from '../services/geminiService';

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
    setLoadingFeedback(false);
  };

  if (isBlocked) {
    return (
      <div className="fixed inset-0 bg-slate-900 z-[100] flex items-center justify-center p-6 text-center">
        <div className="max-w-md bg-white rounded-[40px] p-10 shadow-2xl">
          <XCircle size={64} className="text-red-500 mx-auto mb-6" />
          <h2 className="text-2xl font-black text-slate-800 mb-2">PROVA BLOQUEADA</h2>
          <p className="text-slate-500 mb-8">Saídas de tela consecutivas detectadas. O sistema bloqueou seu acesso para garantir a integridade da avaliação.</p>
          <button onClick={onCancel} className="w-full bg-slate-900 text-white font-black py-4 rounded-2xl">Voltar ao Painel</button>
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
          <h2 className="text-4xl font-black text-slate-800 mb-4 tracking-tighter">Avaliação Finalizada!</h2>
          
          <div className="flex justify-center gap-12 my-10 bg-slate-50 p-8 rounded-[32px]">
            <div>
              <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Nota Final</p>
              <p className="text-5xl font-black text-blue-600">{totalScore.toFixed(1)}</p>
            </div>
            <div className="w-px bg-slate-200" />
            <div>
              <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Acertos</p>
              <p className="text-5xl font-black text-slate-800">{answers.filter((a, i) => a === questions[i].correctIndex).length}/{questions.length}</p>
            </div>
          </div>

          <div className="text-left space-y-4">
             <div className="bg-blue-600 p-8 rounded-[32px] text-white shadow-xl shadow-blue-100">
                <h3 className="font-black flex items-center gap-2 mb-4 text-sm uppercase tracking-widest">
                  <Sparkles size={20} /> Análise Pedagógica Individual
                </h3>
                {loadingFeedback ? (
                  <div className="flex items-center gap-3 animate-pulse">
                    <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                    Gerando retorno especializado...
                  </div>
                ) : (
                  <p className="text-blue-50 leading-relaxed text-sm">{aiFeedback}</p>
                )}
             </div>
          </div>

          <button onClick={() => onComplete({ subject, score: totalScore, isMock })} className="mt-10 bg-slate-900 text-white font-black px-12 py-5 rounded-[24px] hover:scale-105 transition-all shadow-xl">RETORNAR AO PAINEL</button>
        </div>
      </div>
    );
  }

  const q = questions[currentIdx];

  return (
    <div className="max-w-5xl mx-auto pb-32 pt-10 px-4">
      <div className="bg-white/80 backdrop-blur-md border border-slate-200 rounded-[32px] p-6 mb-8 flex justify-between items-center shadow-lg sticky top-20 z-50">
        <div className="flex items-center gap-6">
          <div className="bg-blue-600 text-white w-14 h-14 rounded-2xl flex items-center justify-center font-black text-xl shadow-lg shadow-blue-100">
            {currentIdx + 1}<span className="text-xs text-blue-200 ml-1">/{questions.length}</span>
          </div>
          <div>
            <h2 className="font-black text-slate-800 text-lg">{subject}</h2>
            <p className="text-[10px] uppercase font-black text-blue-500 tracking-widest">{isMock ? 'Simulado de Treino' : 'Avaliação Bimestral Oficial'}</p>
          </div>
        </div>
        {!isMock && (
          <div className={`flex items-center gap-3 px-5 py-3 rounded-2xl font-black text-xs uppercase tracking-widest shadow-sm ${cheatingCount > 3 ? 'bg-red-50 text-red-600' : 'bg-slate-50 text-slate-400'}`}>
            <AlertCircle size={18}/> Saídas de Tela: {cheatingCount}/6
          </div>
        )}
      </div>

      <div className="space-y-8 animate-fade-in">
        {/* Box de Citação / Texto Base */}
        <div className="bg-white border border-slate-200 rounded-[40px] p-10 shadow-sm relative overflow-hidden">
          <div className="absolute top-0 right-0 p-8 text-slate-50/50"><Quote size={80}/></div>
          
          {q.citation && (
            <div className="mb-8 border-l-4 border-blue-600 pl-8 space-y-4">
              <p className="text-[10px] font-black text-blue-600 uppercase tracking-widest flex items-center gap-2"><Quote size={12}/> Texto Base / Citação</p>
              <div className="text-slate-600 italic text-lg leading-relaxed font-medium">"{q.citation}"</div>
            </div>
          )}

          {/* Box de Análise Visual */}
          {q.visualDescription && (
            <div className="mb-8 bg-slate-50 rounded-[24px] p-8 border border-slate-100 space-y-3">
              <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest flex items-center gap-2"><ImageIcon size={14}/> Elemento Visual para Análise</p>
              <div className="p-6 bg-white border border-dashed border-slate-200 rounded-xl text-slate-500 text-sm leading-relaxed">
                {q.visualDescription}
              </div>
            </div>
          )}

          <div className="bg-slate-900 text-white px-4 py-1 rounded-lg text-[9px] font-black uppercase tracking-widest w-fit mb-4">{q.difficulty}</div>
          <h3 className="text-2xl font-black text-slate-800 leading-tight mb-10">{q.text}</h3>

          <div className="space-y-4">
            {q.options.map((opt, i) => (
              <button
                key={i}
                onClick={() => {
                  const n = [...answers];
                  n[currentIdx] = i;
                  setAnswers(n);
                }}
                className={`w-full text-left p-6 rounded-[24px] border-2 transition-all flex items-start gap-5 group ${answers[currentIdx] === i ? 'bg-blue-600 border-blue-600 text-white shadow-xl shadow-blue-100 scale-[1.02]' : 'bg-white border-slate-100 hover:border-blue-200 text-slate-600'}`}
              >
                <div className={`w-10 h-10 shrink-0 rounded-xl flex items-center justify-center font-black text-lg transition-colors ${answers[currentIdx] === i ? 'bg-white/20 text-white' : 'bg-slate-100 text-slate-400 group-hover:bg-blue-50 group-hover:text-blue-500'}`}>
                  {String.fromCharCode(65 + i)}
                </div>
                <span className="pt-2 font-bold leading-tight">{opt}</span>
              </button>
            ))}
          </div>
        </div>

        <div className="flex justify-between items-center bg-white/90 backdrop-blur-md p-6 rounded-[32px] border border-slate-200 shadow-2xl fixed bottom-8 left-1/2 -translate-x-1/2 w-full max-w-xl z-50">
          <button 
            disabled={currentIdx === 0}
            onClick={() => setCurrentIdx(prev => prev - 1)}
            className="px-8 py-4 rounded-2xl font-black text-slate-400 disabled:opacity-0 transition-all uppercase text-xs tracking-widest"
          >
            Anterior
          </button>
          
          <div className="flex gap-1.5">
            {questions.map((_, i) => (
              <div key={i} className={`h-2 rounded-full transition-all ${i === currentIdx ? 'bg-blue-600 w-8' : answers[i] !== -1 ? 'bg-blue-200 w-2' : 'bg-slate-200 w-2'}`} />
            ))}
          </div>

          {currentIdx === questions.length - 1 ? (
            <button 
              onClick={handleFinish}
              disabled={answers.some(a => a === -1)}
              className="bg-green-600 text-white px-10 py-4 rounded-2xl font-black hover:bg-green-700 transition-all shadow-lg shadow-green-100 disabled:bg-slate-300 uppercase text-xs tracking-widest"
            >
              Finalizar
            </button>
          ) : (
            <button 
              onClick={() => setCurrentIdx(prev => prev + 1)}
              disabled={answers[currentIdx] === -1}
              className="bg-blue-600 text-white px-10 py-4 rounded-2xl font-black hover:bg-blue-700 transition-all shadow-lg shadow-blue-100 disabled:opacity-50 uppercase text-xs tracking-widest"
            >
              Próxima
            </button>
          )}
        </div>
      </div>
    </div>
  );
};

export default AssessmentSession;
