
import React, { useState, useEffect, useCallback } from 'react';
import { Subject, Question, UserProfile, Assessment } from '../types';
import { AlertCircle, Clock, CheckCircle2, XCircle, Sparkles, BrainCircuit } from 'lucide-react';
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

  // Anti-cheating logic
  useEffect(() => {
    if (isMock || isFinished || isBlocked) return;

    const handleVisibility = () => {
      if (document.visibilityState === 'hidden') {
        setCheatingCount(prev => {
          const next = prev + 1;
          if (next >= 6) {
            setIsBlocked(true);
          }
          return next;
        });
      }
    };

    const handleBlur = () => {
      setCheatingCount(prev => {
        const next = prev + 1;
        if (next >= 6) {
          setIsBlocked(true);
        }
        return next;
      });
    };

    document.addEventListener('visibilitychange', handleVisibility);
    window.addEventListener('blur', handleBlur);
    return () => {
      document.removeEventListener('visibilitychange', handleVisibility);
      window.removeEventListener('blur', handleBlur);
    };
  }, [isMock, isFinished, isBlocked]);

  const handleFinish = async () => {
    setIsFinished(true);
    setLoadingFeedback(true);
    
    // Calculate Score (Simple 1pt per question)
    const score = answers.reduce((acc, curr, idx) => curr === questions[idx].correctIndex ? acc + 1 : acc, 0);
    
    const feedback = await generateAIFeedback(subject, questions, answers);
    setAiFeedback(feedback);
    setLoadingFeedback(false);

    const result = {
      id: Date.now().toString(),
      studentId: currentUser.id,
      subject,
      quarter: 1, // Dynamically get this
      isMock,
      score,
      questions,
      answers,
      cheatingAttempts: cheatingCount,
      feedback,
      createdAt: new Date().toISOString()
    };
    
    // Final callback after feedback
    setTimeout(() => {
      // Allow user to read feedback first if we want, but for now we'll just show it in the finish screen
    }, 2000);
  };

  if (isBlocked) {
    return (
      <div className="fixed inset-0 bg-slate-900 z-[100] flex items-center justify-center p-6 text-center">
        <div className="max-w-md bg-white rounded-3xl p-8 shadow-2xl">
          <XCircle size={64} className="text-red-500 mx-auto mb-4" />
          <h2 className="text-2xl font-bold text-slate-800 mb-2">Avaliação Bloqueada</h2>
          <p className="text-slate-500 mb-6">Detectamos {cheatingCount} tentativas de saída da página. Sua prova foi zerada e sua situação será analisada pelo conselho de professores.</p>
          <div className="bg-red-50 p-4 rounded-xl text-red-700 text-sm font-medium mb-8">
            Aguarde a liberação do Administrador.
          </div>
          <button onClick={onCancel} className="w-full bg-slate-800 text-white font-bold py-3 rounded-xl">Voltar ao Início</button>
        </div>
      </div>
    );
  }

  if (isFinished) {
    return (
      <div className="max-w-3xl mx-auto py-12 space-y-8 animate-in fade-in duration-500">
        <div className="bg-white rounded-3xl p-8 shadow-xl border border-slate-200 text-center">
          <CheckCircle2 size={64} className="text-green-500 mx-auto mb-4" />
          <h2 className="text-3xl font-bold text-slate-800 mb-2">Avaliação Concluída!</h2>
          <p className="text-slate-500 mb-8">Parabéns, seu desempenho foi processado pelo Retorno do Professor.</p>
          
          <div className="flex justify-center gap-12 mb-8">
            <div>
              <span className="block text-xs uppercase font-bold text-slate-400">Sua Nota</span>
              <span className="text-4xl font-black text-blue-600">{answers.reduce((acc, curr, idx) => curr === questions[idx].correctIndex ? acc + 1 : acc, 0).toFixed(1)}</span>
            </div>
            <div>
              <span className="block text-xs uppercase font-bold text-slate-400">Acertos</span>
              <span className="text-4xl font-black text-slate-800">{answers.filter((a, i) => a === questions[i].correctIndex).length}/5</span>
            </div>
          </div>

          <div className="bg-blue-50 p-6 rounded-2xl text-left border border-blue-100">
            <h3 className="font-bold text-blue-900 flex items-center gap-2 mb-3">
              <Sparkles className="text-yellow-500" size={20} /> Retorno do Professor
            </h3>
            {loadingFeedback ? (
              <div className="flex items-center gap-3 text-blue-400">
                <div className="animate-spin rounded-full h-4 w-4 border-2 border-current border-t-transparent"></div>
                Gerando análise pedagógica...
              </div>
            ) : (
              <div className="text-sm text-blue-800 leading-relaxed whitespace-pre-wrap">
                {aiFeedback}
              </div>
            )}
          </div>

          <button 
            onClick={() => onComplete({
              subject, score: answers.reduce((acc, curr, idx) => curr === questions[idx].correctIndex ? acc + 1 : acc, 0), isMock, feedback: aiFeedback, createdAt: new Date().toISOString()
            })}
            className="mt-8 bg-slate-800 text-white font-bold px-8 py-3 rounded-xl hover:bg-slate-900 transition-all"
          >
            Finalizar e Salvar
          </button>
        </div>
      </div>
    );
  }

  const q = questions[currentIdx];

  return (
    <div className="max-w-4xl mx-auto pb-24">
      <div className="bg-white border-b sticky top-16 z-40 p-4 mb-8 -mx-4 md:mx-0 md:rounded-b-2xl shadow-sm flex items-center justify-between">
        <div className="flex items-center gap-4">
          <div className="bg-blue-100 text-blue-700 w-10 h-10 rounded-xl flex items-center justify-center font-bold">
            {currentIdx + 1}/5
          </div>
          <div>
            <h2 className="font-bold text-slate-800">{subject}</h2>
            <p className="text-[10px] uppercase font-bold text-slate-400 tracking-widest">{isMock ? 'Simulado' : 'Prova Oficial'}</p>
          </div>
        </div>
        
        {!isMock && (
          <div className={`flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-bold ${cheatingCount > 3 ? 'bg-red-100 text-red-600' : 'bg-slate-100 text-slate-500'}`}>
            <AlertCircle size={14}/> Avisos de Saída: {cheatingCount}/6
          </div>
        )}
      </div>

      <div className="space-y-8 animate-in slide-in-from-bottom-4 duration-300">
        <div className="bg-white rounded-3xl p-6 md:p-10 shadow-sm border border-slate-200">
          <div className="bg-blue-50 text-blue-700 px-3 py-1 rounded-full text-[10px] font-bold uppercase w-fit mb-4">
            {q.difficulty}
          </div>
          <div className="text-lg text-slate-700 leading-relaxed font-medium mb-8">
            {q.text}
          </div>

          <div className="space-y-3">
            {q.options.map((opt, i) => (
              <button
                key={i}
                onClick={() => {
                  const newAnswers = [...answers];
                  newAnswers[currentIdx] = i;
                  setAnswers(newAnswers);
                }}
                className={`w-full text-left p-4 rounded-2xl border-2 transition-all flex items-start gap-4 ${answers[currentIdx] === i ? 'bg-blue-600 border-blue-600 text-white shadow-lg shadow-blue-100' : 'bg-white border-slate-100 hover:border-blue-200 text-slate-600'}`}
              >
                <div className={`w-8 h-8 shrink-0 rounded-lg flex items-center justify-center font-bold text-sm ${answers[currentIdx] === i ? 'bg-white/20' : 'bg-slate-50'}`}>
                  {String.fromCharCode(65 + i)}
                </div>
                <span className="pt-1 leading-tight font-medium">{opt}</span>
              </button>
            ))}
          </div>
        </div>

        <div className="flex justify-between items-center bg-white p-4 rounded-2xl border border-slate-200 shadow-lg fixed bottom-8 left-1/2 -translate-x-1/2 w-full max-w-lg z-50">
          <button 
            disabled={currentIdx === 0}
            onClick={() => setCurrentIdx(prev => prev - 1)}
            className="px-6 py-2.5 rounded-xl font-bold text-slate-400 disabled:opacity-0 transition-all"
          >
            Anterior
          </button>
          
          <div className="flex gap-1">
            {questions.map((_, i) => (
              <div key={i} className={`w-2 h-2 rounded-full ${i === currentIdx ? 'bg-blue-600 w-4' : answers[i] !== -1 ? 'bg-blue-200' : 'bg-slate-200'} transition-all`}></div>
            ))}
          </div>

          {currentIdx === questions.length - 1 ? (
            <button 
              onClick={handleFinish}
              disabled={answers.some(a => a === -1)}
              className="bg-green-600 text-white px-6 py-2.5 rounded-xl font-bold hover:bg-green-700 transition-all shadow-md shadow-green-100 disabled:bg-slate-300"
            >
              Finalizar
            </button>
          ) : (
            <button 
              onClick={() => setCurrentIdx(prev => prev + 1)}
              disabled={answers[currentIdx] === -1}
              className="bg-blue-600 text-white px-6 py-2.5 rounded-xl font-bold hover:bg-blue-700 transition-all shadow-md shadow-blue-100 disabled:opacity-50"
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
