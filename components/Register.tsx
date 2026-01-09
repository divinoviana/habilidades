
import React, { useState, useRef } from 'react';
import { UserProfile, UserRole } from '../types';
import { Camera, Upload, ArrowLeft, CheckCircle2, Loader2, User } from 'lucide-react';
import { supabase } from '../lib/supabase';

interface RegisterProps {
  onRegister: (user: UserProfile) => void;
  onCancel: () => void;
}

const CLASSES_MAP: { [key: string]: string[] } = {
  "1ª": ["13.01", "13.02", "13.03", "13.04", "13.05", "13.06"],
  "2ª": ["23.01", "23.02", "23.03", "23.04", "23.05", "23.06", "23.07", "23.08"],
  "3ª": ["33.01", "33.02", "33.03", "33.04", "33.05", "33.06", "33.07", "33.08"]
};

const Register: React.FC<RegisterProps> = ({ onRegister, onCancel }) => {
  const [step, setStep] = useState(1);
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState({
    fullName: '',
    email: '',
    whatsapp: '',
    grade: '1ª',
    className: '13.01',
    password: '',
    avatarUrl: ''
  });
  const [cameraActive, setCameraActive] = useState(false);
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  const startCamera = async () => {
    setCameraActive(true);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: true });
      if (videoRef.current) videoRef.current.srcObject = stream;
    } catch (err) {
      alert("Não foi possível acessar a câmera.");
      setCameraActive(false);
    }
  };

  const capturePhoto = () => {
    if (videoRef.current && canvasRef.current) {
      const context = canvasRef.current.getContext('2d');
      if (context) {
        canvasRef.current.width = videoRef.current.videoWidth;
        canvasRef.current.height = videoRef.current.videoHeight;
        context.drawImage(videoRef.current, 0, 0);
        const dataUrl = canvasRef.current.toDataURL('image/png');
        setFormData({ ...formData, avatarUrl: dataUrl });
        
        const stream = videoRef.current.srcObject as MediaStream;
        stream.getTracks().forEach(track => track.stop());
        setCameraActive(false);
      }
    }
  };

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      const { data, error } = await supabase
        .from('profiles')
        .insert([
          {
            full_name: formData.fullName,
            email: formData.email,
            password: formData.password,
            role: 'student',
            grade: formData.grade,
            class_name: formData.className,
            phone: formData.whatsapp,
            avatar_url: formData.avatarUrl
          }
        ])
        .select()
        .single();

      if (error) throw error;

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

      onRegister(user);
    } catch (err: any) {
      alert("Erro ao cadastrar: " + err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-100 p-4">
      <div className="bg-white w-full max-w-2xl rounded-3xl shadow-2xl overflow-hidden flex flex-col md:flex-row animate-fade-in border border-white">
        <div className="bg-blue-600 md:w-1/3 p-8 text-white flex flex-col justify-between">
          <div>
            <button onClick={onCancel} className="flex items-center gap-2 text-blue-100 hover:text-white mb-8 transition-colors font-bold text-sm">
              <ArrowLeft size={18} /> Voltar para Login
            </button>
            <h2 className="text-3xl font-bold mb-3 leading-tight">Cadastre-se</h2>
            <p className="text-blue-100 text-sm opacity-80">Junte-se à rede de ensino da EE Federico José Pedreira Neto.</p>
          </div>
          <div className="space-y-6">
            <div className={`flex items-center gap-3 transition-opacity duration-500 ${step === 1 ? 'opacity-100' : 'opacity-40'}`}>
              <div className="bg-white text-blue-600 w-8 h-8 rounded-xl flex items-center justify-center font-bold text-sm shadow-lg">1</div>
              <span className="text-sm font-bold">Seus Dados</span>
            </div>
            <div className={`flex items-center gap-3 transition-opacity duration-500 ${step === 2 ? 'opacity-100' : 'opacity-40'}`}>
              <div className="bg-white/20 w-8 h-8 rounded-xl flex items-center justify-center font-bold text-sm">2</div>
              <span className="text-sm font-bold">Biometria</span>
            </div>
          </div>
        </div>

        <div className="p-8 md:p-12 md:w-2/3">
          {step === 1 ? (
            <div className="space-y-5">
              <h3 className="text-xl font-bold text-slate-800 flex items-center gap-2">
                <User size={20} className="text-blue-600" /> Informações Básicas
              </h3>
              <div className="grid grid-cols-1 gap-4">
                <input 
                  className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-blue-500 focus:bg-white transition-all"
                  placeholder="Seu Nome Completo"
                  value={formData.fullName}
                  onChange={(e) => setFormData({...formData, fullName: e.target.value})}
                />
                <div className="grid grid-cols-2 gap-4">
                  <select 
                    className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-blue-500 focus:bg-white transition-all"
                    value={formData.grade}
                    onChange={(e) => setFormData({...formData, grade: e.target.value, className: CLASSES_MAP[e.target.value][0]})}
                  >
                    {Object.keys(CLASSES_MAP).map(g => <option key={g} value={g}>{g} série</option>)}
                  </select>
                  <select 
                    className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-blue-500 focus:bg-white transition-all"
                    value={formData.className}
                    onChange={(e) => setFormData({...formData, className: e.target.value})}
                  >
                    {CLASSES_MAP[formData.grade].map(c => <option key={c} value={c}>{c}</option>)}
                  </select>
                </div>
                <input 
                  type="email"
                  className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-blue-500 focus:bg-white transition-all"
                  placeholder="E-mail"
                  value={formData.email}
                  onChange={(e) => setFormData({...formData, email: e.target.value})}
                />
                <input 
                  className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-blue-500 focus:bg-white transition-all"
                  placeholder="WhatsApp"
                  value={formData.whatsapp}
                  onChange={(e) => setFormData({...formData, whatsapp: e.target.value})}
                />
                <input 
                  type="password"
                  className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-blue-500 focus:bg-white transition-all"
                  placeholder="Crie uma Senha"
                  value={formData.password}
                  onChange={(e) => setFormData({...formData, password: e.target.value})}
                />
              </div>
              <button 
                onClick={() => setStep(2)}
                disabled={!formData.fullName || !formData.email || !formData.password}
                className="w-full bg-blue-600 text-white font-bold py-4 rounded-xl mt-4 shadow-lg shadow-blue-100 transition-all hover:bg-blue-700 disabled:bg-slate-200 disabled:shadow-none"
              >
                Próximo: Foto Biométrica
              </button>
            </div>
          ) : (
            <div className="space-y-8 text-center">
              <h3 className="text-xl font-bold text-slate-800">Biometria Facial</h3>
              <p className="text-sm text-slate-500">Para sua segurança e autenticidade das provas, capture uma foto nítida do seu rosto.</p>
              
              <div className="relative aspect-square max-w-[220px] mx-auto rounded-3xl overflow-hidden border-4 border-slate-100 bg-slate-50 flex items-center justify-center shadow-inner">
                {formData.avatarUrl ? (
                  <img src={formData.avatarUrl} className="w-full h-full object-cover animate-fade-in" />
                ) : cameraActive ? (
                  <video ref={videoRef} autoPlay playsInline className="w-full h-full object-cover -scale-x-100" />
                ) : (
                  <Camera size={64} className="text-slate-200" strokeWidth={1} />
                )}
                <canvas ref={canvasRef} className="hidden" />
              </div>

              <div className="flex flex-col gap-3 max-w-[280px] mx-auto">
                {!formData.avatarUrl && !cameraActive && (
                  <button onClick={startCamera} className="bg-slate-800 text-white py-3 rounded-xl font-bold shadow-lg flex items-center justify-center gap-2"><Camera size={18}/> Ativar Câmera</button>
                )}
                {cameraActive && (
                  <button onClick={capturePhoto} className="bg-blue-600 text-white py-3 rounded-xl font-bold shadow-lg flex items-center justify-center gap-2">Capturar Agora</button>
                )}
                {formData.avatarUrl && (
                  <button onClick={() => setFormData({...formData, avatarUrl: ''})} className="text-xs text-blue-600 font-bold uppercase underline">Tirar Outra Foto</button>
                )}
                
                <label className="flex items-center justify-center gap-2 border-2 border-dashed border-slate-200 p-3 rounded-xl cursor-pointer hover:border-blue-400 text-slate-400 font-bold text-xs uppercase">
                  <Upload size={16} /> Ou Enviar Arquivo
                  <input 
                    type="file" className="hidden" accept="image/*" 
                    onChange={(e) => {
                      const file = e.target.files?.[0];
                      if (file) {
                        const reader = new FileReader();
                        reader.onload = (re) => setFormData({...formData, avatarUrl: re.target?.result as string});
                        reader.readAsDataURL(file);
                      }
                    }}
                  />
                </label>
              </div>

              <div className="flex gap-4 pt-4">
                <button onClick={() => setStep(1)} className="flex-1 font-bold text-slate-400 hover:text-slate-600">Voltar</button>
                <button 
                  onClick={handleRegister}
                  disabled={!formData.avatarUrl || loading}
                  className="flex-[2] bg-blue-600 text-white font-bold py-4 rounded-xl shadow-lg shadow-blue-100 disabled:bg-slate-200 flex items-center justify-center gap-2"
                >
                  {loading ? <Loader2 className="animate-spin" size={20} /> : <CheckCircle2 size={20} />}
                  Finalizar Cadastro
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default Register;
