
import React, { useState } from 'react';
import { UserProfile, UserRole } from '../types.ts';
import { LogIn, UserPlus, GraduationCap, Loader2, AlertCircle } from 'lucide-react';
import { supabase } from '../lib/supabase.ts';

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
        throw new Error('E-mail ou senha incorretos. Verifique se o SQL do banco foi executado.');
      }

      if (data.cheating_locked) {
        throw new Error('Seu acesso está bloqueado por excesso de tentativas de cola.');
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
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-700 via-indigo-600 to-slate-900 p-4">
      <div className="bg-white w-full max-w-md rounded-2xl shadow-2xl overflow-hidden animate-fade-in border border-white/10">
        <div className="p-8">
          <div className="flex justify-center mb-6">
            <div className="bg-blue-600 p-4 rounded-2xl shadow-xl shadow-blue-200">
              <GraduationCap size={40} className="text-white" />
            </div>
          </div>
          <div className="text-center mb-8">
            <h2 className="text-2xl font-bold text-slate-800">Escola Estadual Frederico José Pedreira</h2>
            <p className="text-slate-500 text-sm font-medium uppercase tracking-wider">Sistema de Avaliação Inteligente</p>
          </div>
          <form onSubmit={handleLogin} className="space-y-5">
            <div>
              <label className="block text-xs font-bold text-slate-400 uppercase mb-2 ml-1">E-mail de Acesso</label>
              <input 
                type="email" 
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:bg-white transition-all outline-none"
                placeholder="seu@email.com"
                required
              />
            </div>
            <div>
              <label className="block text-xs font-bold text-slate-400 uppercase mb-2 ml-1">Sua Senha</label>
              <input 
                type="password" 
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:bg-white transition-all outline-none"
                placeholder="••••••••"
                required
              />
            </div>
            {error && (
              <div className="bg-red-50 border border-red-100 text-red-600 p-4 rounded-xl text-sm font-medium flex gap-3 animate-in fade-in slide-in-from-top-2">
                <AlertCircle size={20} className="shrink-0" />
                {error}
              </div>
            )}
            <button 
              type="submit"
              disabled={loading}
              className="w-full bg-blue-600 hover:bg-blue-700 text-white font-bold py-4 rounded-xl shadow-lg shadow-blue-200 flex items-center justify-center gap-2 transition-all transform active:scale-[0.98] disabled:bg-slate-300 disabled:shadow-none"
            >
              {loading ? <Loader2 className="animate-spin" size={20} /> : <LogIn size={20} />}
              Acessar Painel
            </button>
          </form>
          <div className="mt-8 pt-8 border-t border-slate-100 text-center">
            <button 
              onClick={onGoToRegister}
              className="text-blue-600 font-bold hover:text-blue-800 transition-colors flex items-center justify-center gap-2 mx-auto"
            >
              <UserPlus size={18} /> Novo por aqui? Criar Cadastro
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Login;
