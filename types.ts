
export enum UserRole {
  ADMIN = 'admin',
  TEACHER = 'teacher',
  STUDENT = 'student'
}

export type Subject = 'História' | 'Filosofia' | 'Geografia' | 'Sociologia';

export interface UserProfile {
  id: string;
  email: string;
  fullName: string;
  role: UserRole;
  grade?: string; // 1ª, 2ª, 3ª
  className?: string; // 13.01, etc.
  phone?: string;
  avatarUrl?: string;
  cheatingLocked?: boolean;
  subject?: Subject; // Disciplina vinculada (para professores)
}

export interface Question {
  id: string;
  text: string;
  options: string[];
  correctIndex: number;
  explanation: string;
  difficulty: 'easy' | 'medium' | 'hard';
  citation?: string; // Texto base ou citação
  visualDescription?: string; // Descrição de gráfico, mapa ou charge
}

export interface ExtraActivity {
  id: string;
  teacherId: string;
  subject: Subject;
  grade: string;
  className?: string;
  theme: string;
  questions: {
    id: string;
    question: string;
    type: 'multiple' | 'open';
    options?: string[];
    correctAnswer?: string | number;
    citation?: string;
    visualDescription?: string;
  }[];
  createdAt: string;
}

export interface ActivitySubmission {
  id: string;
  activityId: string;
  studentId: string;
  answers: any[];
  score: number;
  feedback: string;
  createdAt: string;
  studentName?: string;
}

export interface OfficialExam {
  id: string;
  subject: Subject;
  grade: string;
  quarter: number;
  questions: Question[];
}

export interface Topic {
  id: string;
  teacherId: string;
  subject: Subject;
  grade: string;
  quarter: number;
  content: string;
}

export interface Assessment {
  id: string;
  studentId: string;
  subject: Subject;
  quarter: number;
  grade?: string;
  questions: Question[];
  score: number;
  isMock: boolean;
  feedback: string;
  cheatingAttempts: number;
  createdAt: string;
}

export interface GlobalSettings {
  activeQuarter: number;
  isAssessmentLocked: { [key: number]: boolean };
  releaseDates: { [key: number]: string };
}
