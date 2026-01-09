
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
}

export interface Question {
  id: string;
  text: string;
  options: string[];
  correctIndex: number;
  explanation: string;
  difficulty: 'easy' | 'medium' | 'hard';
}

export interface OfficialExam {
  id: string;
  subject: Subject;
  grade: string;
  quarter: number;
  questions: Question[];
}

// Added Topic interface to fix import error in TeacherDashboard.tsx
export interface Topic {
  id: string;
  teacherId: string;
  subject: Subject;
  grade: string;
  quarter: number;
  content: string;
}

// Added Assessment interface to fix import errors in StudentDashboard.tsx and AssessmentSession.tsx
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
