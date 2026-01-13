
import React, { useState } from 'react';
import { UserProfile, UserRole } from '../types';
import { LogIn, UserPlus, GraduationCap, Loader2, AlertCircle } from 'lucide-react';
import { supabase } from '../lib/supabase';

interface LoginProps {
  onLogin: (user: UserProfile) => void;
  onGoToRegister: () => void;
}

const Login: React.FC<LoginProps> = ({ onLogin, onGoToRegister }) => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    try {
      const { data, error: dbError } = await supabase
        .from('profiles')
        .select('*')
        .eq('email', email.trim())
        .eq('password', password.trim())
        .maybeSingle();

      if (dbError) throw dbError;

      if (!data) {
        throw new Error('Credenciais incorretas.');
      }

      if (data.cheating_locked) {
        throw new Error('Acesso bloqueado.');
      }

      const user: UserProfile = {
        id: data.id,
        email: data.email,
        fullName: data.full_name,
        role: data.role as UserRole,
        grade: data.grade,
        className: data.class_name,
        phone: data.phone,
        avatarUrl: data.avatar_url,
        cheatingLocked: data.cheating_locked
      };

      onLogin(user);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-700 to-slate-900 p-4">
      <div className="bg-white w-full max-w-md rounded-[40px] shadow-2xl overflow-hidden p-10 space-y-8 animate-fade-in">
        <div className="flex justify-center">
          <div className="bg-blue-600 p-4 rounded-3xl shadow-xl shadow-blue-100">
            <GraduationCap size={48} className="text-white" />
          </div>
        </div>
        <div className="text-center space-y-2">
          <h2 className="text-2xl font-black text-slate-800 tracking-tighter leading-none">Frederico José Pedreira</h2>
          <p className="text-slate-400 text-[10px] font-bold uppercase tracking-widest">Sistema de Avaliação em Ciências Humanas</p>
        </div>
        <form onSubmit={handleLogin} className="space-y-4">
          <input required type="email" value={email} onChange={(e) => setEmail(e.target.value)} className="w-full px-5 py-4 bg-slate-50 border border-slate-100 rounded-2xl outline-none focus:ring-2 focus:ring-blue-500" placeholder="E-mail"/>
          <input required type="password" value={password} onChange={(e) => setPassword(e.target.value)} className="w-full px-5 py-4 bg-slate-50 border border-slate-100 rounded-2xl outline-none focus:ring-2 focus:ring-blue-500" placeholder="Senha"/>
          {error && <div className="text-red-500 text-xs font-bold text-center px-4 py-2 bg-red-50 rounded-xl">{error}</div>}
          <button type="submit" disabled={loading} className="w-full bg-blue-600 text-white font-black py-5 rounded-[24px] shadow-xl shadow-blue-100 hover:bg-blue-700 transition-all flex justify-center items-center gap-2">
            {loading ? <Loader2 className="animate-spin" size={20} /> : <LogIn size={20} />} Acessar Painel
          </button>
        </form>
        <button onClick={onGoToRegister} className="w-full text-slate-400 font-bold text-xs uppercase hover:text-blue-600 transition-colors">Novo Aluno? Criar Biometria</button>
      </div>
    </div>
  );
};

export default Login;
