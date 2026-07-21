import React, { useState } from 'react';
import { Sparkles, User, Lock, ArrowRight, Loader2, AlertCircle, Camera, Zap, LogIn, Mail } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { cn } from '../lib/utils';
import { useAuth } from '../components/AuthProvider';
import api from '../lib/api';

const logoImg = '/src/logo.png';

export const Auth: React.FC = () => {
  const [isLogin, setIsLogin] = useState(true);
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [role, setRole] = useState('operator');
  const [partnerName, setPartnerName] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  const { login } = useAuth();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);

    try {
      if (isLogin) {
        const response = await api.post('/auth/login', { email, password });
        const data = response.data;
        if (!data || !data.token) {
          throw new Error("Invalid response from login server.");
        }
        login(data.token, data.user);
      } else {
        const regResponse = await api.post('/auth/register', { 
          full_name: name, 
          email, 
          password, 
          role,
          partner_name: partnerName || 'Uni-Smiles HQ'
        });
        
        if (regResponse.data && regResponse.data.token) {
          login(regResponse.data.token, regResponse.data.user || regResponse.data.data);
        } else {
          try {
            const loginRes = await api.post('/auth/login', { email, password });
            const loginData = loginRes.data;
            if (loginData && loginData.token) {
              login(loginData.token, loginData.user);
              return;
            }
          } catch (autoErr) {
            // Fallback to manual login prompt if auto login fails
          }
          setIsLogin(true);
          setError("Registration successful. Please login.");
          setPassword('');
        }
      }
    } catch (err: any) {
      const errorMessage = err.response?.data?.message || err.response?.data?.error || "Internal Server Error";
      setError(errorMessage);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen w-full flex overflow-hidden font-sans relative">
      {/* Background Gradient */}
      <div 
        className="absolute inset-0 z-0" 
        style={{ background: 'linear-gradient(to bottom, #10172A, #223148)' }} 
      />

      {/* Left Panel - Branding */}
      <div className="hidden lg:flex flex-1 relative flex-col justify-between p-16 overflow-hidden z-10">
        <motion.div 
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          className="flex items-center"
        >
          <img 
            src={logoImg} 
            alt="Uni-Smiles Logo" 
            className="h-28 w-auto object-contain" 
          />
        </motion.div>

        <motion.div
          initial={{ opacity: 0, x: -50 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.8, ease: "easeOut" }}
        >
          <h1 className="text-6xl font-display font-black leading-[1.1] mb-6 text-foreground uppercase tracking-tighter">
            Empower Your <br />
            <span className="text-primary italic">Kiosk Business.</span>
          </h1>
          <p className="text-xl text-muted max-w-md leading-relaxed font-bold">
            Smart Photo Booth Management Dashboard for high-performance operations.
          </p>
        </motion.div>

        <div className="relative">
          <div className="flex items-center gap-2 text-[10px] font-black uppercase tracking-[0.3em] text-primary/40">
            <div className="w-1 h-1 rounded-full bg-primary" />
            SECURE ADMIN ACCESS ONLY
          </div>
        </div>
      </div>

      {/* Right Panel - Form Area */}
      <div className="flex-1 flex items-center justify-center p-8 relative z-10">
        <motion.div 
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          className="w-full max-w-md"
        >
          <div className="bg-[#1E293B] border border-white/5 p-10 shadow-[0_30px_60px_rgba(0,0,0,0.5)] rounded-[3rem]">
            <div className="mb-10">
              <h2 className="text-3xl font-display font-black mb-2 text-foreground tracking-tight uppercase">
                {isLogin ? 'WELCOME BACK' : 'CREATE ACCOUNT'}
              </h2>
              <p className="text-muted text-sm font-bold">
                {isLogin ? 'Identify yourself to access the control panel.' : 'Join UniSmiles and start managing your kiosks.'}
              </p>
            </div>

            {error && (
              <div className="bg-red-100 text-red-700 p-3 rounded mb-4">
                {error}
              </div>
            )}

            <form onSubmit={handleSubmit} className="space-y-6">
              {!isLogin && (
                <>
                  <div className="space-y-2">
                    <label className="text-[10px] font-black uppercase tracking-[0.2em] text-primary/60 ml-1">
                      Name
                    </label>
                    <div className="relative group">
                      <User className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-muted group-focus-within:text-primary transition-colors" />
                      <input
                        type="text"
                        required
                        value={name}
                        onChange={(e) => setName(e.target.value)}
                        placeholder="Enter your name"
                        className="w-full bg-black/20 border border-white/5 rounded-2xl py-4 pl-12 pr-4 outline-none focus:border-primary/40 focus:bg-black/30 transition-all text-sm font-bold text-foreground"
                      />
                    </div>
                  </div>

                  <div className="space-y-2">
                    <label className="text-[10px] font-black uppercase tracking-[0.2em] text-primary/60 ml-1">
                      Role
                    </label>
                    <div className="relative group">
                      <select
                        value={role}
                        onChange={(e) => setRole(e.target.value)}
                        className="w-full bg-black/20 border border-white/5 rounded-2xl py-4 px-4 outline-none focus:border-primary/40 focus:bg-black/30 transition-all text-sm font-bold text-foreground appearance-none cursor-pointer"
                      >
                        <option value="operator" className="bg-[#1E293B]">Admin Mitra</option>
                        <option value="admin" className="bg-[#1E293B]">Super Admin</option>
                      </select>
                    </div>
                  </div>

                  <div className="space-y-2">
                    <label className="text-[10px] font-black uppercase tracking-[0.2em] text-primary/60 ml-1">
                      Partner / Branch Name
                    </label>
                    <div className="relative group">
                      <input
                        type="text"
                        value={partnerName}
                        onChange={(e) => setPartnerName(e.target.value)}
                        placeholder="e.g. Telkom University Branch"
                        className="w-full bg-black/20 border border-white/5 rounded-2xl py-4 px-4 outline-none focus:border-primary/40 focus:bg-black/30 transition-all text-sm font-bold text-foreground"
                      />
                    </div>
                  </div>
                </>
              )}
              
              <div className="space-y-2">
                <label className="text-[10px] font-black uppercase tracking-[0.2em] text-primary/60 ml-1">
                  Email
                </label>
                <div className="relative group">
                  <Mail className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-muted group-focus-within:text-primary transition-colors" />
                  <input
                    type="email"
                    required
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="Enter your email"
                    className="w-full bg-black/20 border border-white/5 rounded-2xl py-4 pl-12 pr-4 outline-none focus:border-primary/40 focus:bg-black/30 transition-all text-sm font-bold text-foreground"
                  />
                </div>
              </div>

              <div className="space-y-2">
                <label className="text-[10px] font-black uppercase tracking-[0.2em] text-primary/60 ml-1">
                  Password
                </label>
                <div className="relative group">
                  <Lock className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-muted group-focus-within:text-primary transition-colors" />
                  <input
                    type="password"
                    required
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="********"
                    className="w-full bg-black/20 border border-white/5 rounded-2xl py-4 pl-12 pr-4 outline-none focus:border-primary/40 focus:bg-black/30 transition-all text-sm font-bold text-foreground"
                  />
                </div>
              </div>



              <button
                type="submit"
                disabled={loading}
                className="btn-primary w-full flex items-center justify-center gap-3 disabled:opacity-50 disabled:cursor-not-allowed group"
              >
                {loading ? (
                  <Loader2 className="w-5 h-5 animate-spin" />
                ) : (
                  <>
                    {isLogin ? (
                      <div className="flex items-center gap-3">
                        <LogIn className="w-5 h-5 group-hover:scale-110 transition-transform" />
                        <span>MASUK KE DASHBOARD</span>
                      </div>
                    ) : (
                      <div className="flex items-center gap-3">
                        <Zap className="w-4 h-4 group-hover:scale-125 group-hover:rotate-12 transition-transform" />
                        <span>Initialize Account</span>
                      </div>
                    )}
                  </>
                )}
              </button>

              <div className="text-center">
                <button
                  type="button"
                  onClick={() => {
                    setIsLogin(!isLogin);
                    setError(null);
                  }}
                  className="text-[10px] font-black text-muted hover:text-primary tracking-[0.2em] uppercase transition-colors"
                >
                  {isLogin ? (
                    <>Don't have an account? Register Now</>
                  ) : (
                    <>Already have an account? Sign In</>
                  )}
                </button>
              </div>
            </form>
          </div>
        </motion.div>
      </div>
    </div>
  );
};
