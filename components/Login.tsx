
import React, { useState } from 'react';
import { UserProfile, UserRole, Subject } from '../types';
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
        throw new Error('Acesso bloqueado por tentativas de fraude.');
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
        cheatingLocked: data.cheating_locked,
        subject: data.subject as Subject
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
      <div className="bg-white w-full max-w-md rounded-[40px] shadow-2xl overflow-hidden p-10 space-y-8 animate-fade-in border border-white/20">
        <div className="flex justify-center">
          <div className="bg-blue-600 p-4 rounded-3xl shadow-xl shadow-blue-100">
            <GraduationCap size={48} className="text-white" />
          </div>
        </div>
        <div className="text-center space-y-2">
          <h2 className="text-2xl font-black text-slate-800 tracking-tighter leading-none uppercase">Escola Frederico</h2>
          <p className="text-slate-400 text-[10px] font-bold uppercase tracking-widest">Painel Avaliativo de Ciências Humanas</p>
        </div>
        <form onSubmit={handleLogin} className="space-y-4">
          <div className="space-y-1">
              <label className="text-[10px] font-black uppercase text-slate-400 ml-4 tracking-widest">Acesso do Usuário</label>
              <input required type="email" value={email} onChange={(e) => setEmail(e.target.value)} className="w-full px-5 py-4 bg-slate-50 border border-slate-100 rounded-2xl outline-none focus:ring-2 focus:ring-blue-500 font-medium" placeholder="E-mail Institucional"/>
          </div>
          <div className="space-y-1">
              <label className="text-[10px] font-black uppercase text-slate-400 ml-4 tracking-widest">Código de Segurança</label>
              <input required type="password" value={password} onChange={(e) => setPassword(e.target.value)} className="w-full px-5 py-4 bg-slate-50 border border-slate-100 rounded-2xl outline-none focus:ring-2 focus:ring-blue-500 font-medium" placeholder="Senha"/>
          </div>
          {error && <div className="text-red-500 text-xs font-bold text-center px-4 py-3 bg-red-50 rounded-2xl border border-red-100 animate-fade-in">{error}</div>}
          <button type="submit" disabled={loading} className="w-full bg-blue-600 text-white font-black py-5 rounded-[24px] shadow-xl shadow-blue-100 hover:bg-blue-700 transition-all flex justify-center items-center gap-2 mt-4 hover:scale-[1.02]">
            {loading ? <Loader2 className="animate-spin" size={20} /> : <LogIn size={20} />} ENTRAR NO SISTEMA
          </button>
        </form>
        <div className="pt-4 border-t border-slate-50 text-center">
            <button onClick={onGoToRegister} className="text-slate-400 font-black text-[10px] uppercase hover:text-blue-600 transition-colors tracking-widest">Primeiro acesso? Registre seu perfil</button>
        </div>
      </div>
    </div>
  );
};

export default Login;
