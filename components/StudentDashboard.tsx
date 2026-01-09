
import React, { useState, useEffect } from 'react';
import { UserProfile, GlobalSettings, Subject, Assessment, Question } from '../types';
import { Play, Sparkles, History, MessageCircle, Info, Loader2, FileCheck } from 'lucide-react';
import { supabase } from '../lib/supabase';
import AssessmentSession from './AssessmentSession';
import { generateEnemAssessment } from '../services/geminiService';

interface StudentDashboardProps {
  currentUser: UserProfile;
  settings: GlobalSettings;
}

const StudentDashboard: React.FC<StudentDashboardProps> = ({ currentUser, settings }) => {
  const [session, setSession] = useState<{ active: boolean; subject?: Subject; isMock: boolean }>({ active: false, isMock: false });
  const [assessments, setAssessments] = useState<Assessment[]>([]);
  const [loading, setLoading] = useState(false);

  const subjects: Subject[] = ['História', 'Filosofia', 'Geografia', 'Sociologia'];

  useEffect(() => {
    fetchAssessments();
  }, [currentUser.id]);

  // Fetches assessments and maps snake_case DB fields to camelCase Assessment interface
  const fetchAssessments = async () => {
    const { data } = await supabase
      .from('assessments')
      .select('*')
      .eq('student_id', currentUser.id)
      .order('created_at', { ascending: false });
    
    if (data) {
      setAssessments(data.map(a => ({
        id: a.id,
        studentId: a.student_id,
        subject: a.subject as Subject,
        quarter: a.quarter,
        grade: a.grade,
        questions: a.questions,
        score: a.score,
        isMock: a.is_mock,
        feedback: a.feedback,
        cheatingAttempts: a.cheating_attempts,
        createdAt: a.created_at
      })));
    }
  };

  const startAssessment = async (subject: Subject, isMock: boolean) => {
    setLoading(true);
    try {
      let questions: Question[];

      if (isMock) {
        // Simulado: Busca o tópico mais recente e gera na hora para o aluno treinar
        const { data: topicsData } = await supabase
          .from('topics')
          .select('content')
          .eq('subject', subject)
          .eq('grade', currentUser.grade)
          .order('created_at', { ascending: false })
          .limit(1);

        const topics = topicsData?.[0]?.content || "Conteúdo geral da disciplina padrão ENEM";
        questions = await generateEnemAssessment(subject, topics, currentUser.grade || '1ª');
      } else {
        // Prova Oficial: Busca a prova que o Admin já gerou para todos
        const { data: officialExam } = await supabase
          .from('official_exams')
          .select('questions')
          .eq('subject', subject)
          .eq('grade', currentUser.grade)
          .eq('quarter', settings.activeQuarter)
          .maybeSingle();

        if (!officialExam) {
          alert("Esta prova oficial ainda não foi liberada pela administração. Aguarde.");
          setLoading(false);
          return;
        }
        questions = officialExam.questions;
      }
      
      setSession({ active: true, subject, isMock });
      (window as any)._currentQuestions = questions;
    } catch (err) {
      alert("Erro ao preparar avaliação. Verifique sua conexão.");
    } finally {
      setLoading(false);
    }
  };

  if (session.active && session.subject) {
    return (
      <AssessmentSession 
        subject={session.subject} 
        isMock={session.isMock}
        currentUser={currentUser}
        questions={(window as any)._currentQuestions}
        onComplete={async (res) => {
          await supabase.from('assessments').insert([{
            student_id: currentUser.id,
            subject: res.subject,
            quarter: settings.activeQuarter,
            grade: currentUser.grade,
            questions: (window as any)._currentQuestions,
            score: res.score,
            is_mock: res.isMock,
            feedback: res.feedback,
            cheating_attempts: res.cheatingAttempts
          }]);
          fetchAssessments();
          setSession({ active: false, isMock: false });
        }}
        onCancel={() => setSession({ active: false, isMock: false })}
      />
    );
  }

  return (
    <div className="space-y-8 animate-fade-in">
      <div className="bg-gradient-to-r from-blue-600 to-indigo-700 rounded-3xl p-8 text-white shadow-xl shadow-blue-100 flex flex-col md:flex-row justify-between items-center gap-6">
        <div>
          <h2 className="text-3xl font-bold">Olá, {currentUser.fullName.split(' ')[0]}!</h2>
          <p className="text-blue-100 opacity-80">Painel do Estudante - EE Federico José Pedreira Neto</p>
        </div>
        <div className="bg-white/10 px-6 py-3 rounded-2xl border border-white/20 backdrop-blur-sm">
          <p className="text-[10px] font-black uppercase tracking-widest text-blue-200">Série/Turma</p>
          <p className="font-bold text-lg">{currentUser.grade} série • {currentUser.className}</p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        <div className="lg:col-span-2 space-y-6">
          <div className="flex justify-between items-center">
            <h3 className="text-xl font-bold text-slate-800 flex items-center gap-2">Disciplinas</h3>
            <span className="text-xs font-bold text-blue-600 bg-blue-50 px-3 py-1 rounded-full">{settings.activeQuarter}º Bimestre Ativo</span>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {subjects.map(subject => (
              <div key={subject} className="bg-white p-6 rounded-3xl border border-slate-200 shadow-sm hover:border-blue-500 transition-all group">
                <div className="flex justify-between items-start mb-4">
                  <h4 className="font-black text-slate-800 text-lg uppercase tracking-tighter">{subject}</h4>
                  <div className="p-2 bg-slate-50 rounded-xl group-hover:bg-blue-50 transition-colors">
                    <FileCheck className="text-slate-300 group-hover:text-blue-500" size={20} />
                  </div>
                </div>
                <div className="flex flex-col gap-2">
                  <button 
                    disabled={loading || settings.isAssessmentLocked[settings.activeQuarter]}
                    onClick={() => startAssessment(subject, false)}
                    className="w-full bg-slate-900 text-white font-bold py-3 rounded-2xl flex items-center justify-center gap-2 transition-transform active:scale-[0.98] disabled:bg-slate-100 disabled:text-slate-400"
                  >
                    {loading ? <Loader2 className="animate-spin" size={18}/> : 'Iniciar Prova Oficial'}
                  </button>
                  <button 
                    onClick={() => startAssessment(subject, true)}
                    className="w-full border border-blue-100 text-blue-600 font-bold py-3 rounded-2xl flex items-center justify-center gap-2 hover:bg-blue-50 transition-colors"
                  >
                    <Sparkles size={16} /> Treinar com Simulado IA
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="bg-white p-6 rounded-3xl border border-slate-200 shadow-sm h-fit">
          <h3 className="font-bold mb-6 flex items-center gap-2 text-slate-800 border-b pb-4"><History size={18} className="text-blue-600"/> Últimos Resultados</h3>
          <div className="space-y-3">
            {assessments.slice(0, 5).map((a, i) => (
              <div key={i} className="flex justify-between items-center p-4 bg-slate-50 rounded-2xl border border-slate-100 animate-fade-in">
                <div>
                  <p className="text-xs font-black text-slate-700 uppercase">{a.subject}</p>
                  <p className="text-[10px] text-slate-400 font-bold">{a.isMock ? 'SIMULADO' : 'OFICIAL'} • {new Date(a.createdAt).toLocaleDateString('pt-BR')}</p>
                </div>
                <div className="text-right">
                  <span className={`text-lg font-black ${a.score >= 3.5 ? 'text-blue-600' : 'text-red-500'}`}>{a.score?.toFixed(1)}</span>
                  <p className="text-[8px] font-bold text-slate-300 uppercase">Nota</p>
                </div>
              </div>
            ))}
            {assessments.length === 0 && <p className="text-xs text-slate-400 italic text-center py-8">Nenhuma avaliação realizada.</p>}
          </div>
        </div>
      </div>
    </div>
  );
};

export default StudentDashboard;
