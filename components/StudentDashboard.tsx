
import React, { useState, useEffect } from 'react';
import { UserProfile, GlobalSettings, Subject, Assessment, ExtraActivity, Question } from '../types';
import { Sparkles, History, Loader2, FileCheck, ClipboardList, Send, CheckCircle2, User, Camera, Upload, ChevronLeft, RefreshCw, BookOpen, AlertCircle, X, Quote, Image as ImageIcon } from 'lucide-react';
import { supabase } from '../lib/supabase';
import AssessmentSession from './AssessmentSession';
import { generateEnemAssessment, evaluateActivitySubmission } from '../services/geminiService';

interface StudentDashboardProps {
  currentUser: UserProfile;
  settings: GlobalSettings;
}

const StudentDashboard: React.FC<StudentDashboardProps> = ({ currentUser, settings }) => {
  const [session, setSession] = useState<{ active: boolean; subject?: Subject; isMock: boolean }>({ active: false, isMock: false });
  const [activeQuestions, setActiveQuestions] = useState<Question[]>([]);
  
  const [assessments, setAssessments] = useState<Assessment[]>([]);
  const [loadingSubject, setLoadingSubject] = useState<string | null>(null);

  const subjects: Subject[] = ['História', 'Filosofia', 'Geografia', 'Sociologia'];

  useEffect(() => {
    fetchAssessments();
  }, [currentUser.id]);

  const fetchAssessments = async () => {
    const { data } = await supabase.from('assessments').select('*').eq('student_id', currentUser.id).order('created_at', { ascending: false });
    if (data) setAssessments(data.map(d => ({ ...d, studentId: d.student_id, isMock: d.is_mock, cheatingAttempts: d.cheating_attempts, createdAt: d.created_at })));
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
            <p className="text-xs font-bold bg-white/10 px-3 py-1 rounded-full border border-white/10 inline-block mt-2 uppercase tracking-widest">{currentUser.grade} série • Turma {currentUser.className}</p>
          </div>
        </div>
        <div className="bg-white p-6 rounded-3xl shadow-xl text-center min-w-[120px] z-10">
            <p className="text-[10px] font-black uppercase text-slate-400 mb-1 tracking-widest">Bimestre</p>
            <p className="font-black text-3xl text-blue-600">{settings.activeQuarter}º</p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-8">
        <div className="lg:col-span-3 space-y-8">
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
    </div>
  );
};

export default StudentDashboard;
