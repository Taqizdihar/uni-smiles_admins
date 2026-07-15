import React, { useState } from 'react';
import { 
  Settings as SettingsIcon, 
  User, 
  Lock, 
  Check,
  ShieldCheck
} from 'lucide-react';
import { toast } from 'sonner';

export const SettingsPage: React.FC = () => {
  // Security State
  const [passwords, setPasswords] = useState({ current: '', new: '', confirm: '' });

  const handleUpdatePassword = (e: React.FormEvent) => {
    e.preventDefault();
    if (!passwords.current || !passwords.new || !passwords.confirm) {
      toast.error('Please fill all fields');
      return;
    }
    if (passwords.new !== passwords.confirm) {
      toast.error('New passwords do not match');
      return;
    }
    toast.success('Password updated successfully.');
    setPasswords({ current: '', new: '', confirm: '' });
  };

  return (
    <div className="space-y-8 animate-in fade-in duration-500 max-w-2xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-display font-bold tracking-tight text-foreground flex items-center gap-3">
            <div className="p-2 bg-primary/10 rounded-xl">
              <SettingsIcon className="w-8 h-8 text-primary" />
            </div>
            Settings
          </h1>
          <p className="text-muted mt-1 font-medium">Configure system preferences and user security settings.</p>
        </div>
      </div>

      {/* Security Settings */}
      <section className="space-y-4">
        <h2 className="text-lg font-bold flex items-center gap-2 text-foreground/90">
          <ShieldCheck className="w-5 h-5 text-primary" />
          Security Settings
        </h2>
        <div className="glass-panel p-6 neon-border">
          <h3 className="text-xl font-bold mb-2">Password Update</h3>
          <p className="text-sm text-muted mb-6">Update the password used to access this control panel.</p>
          
          <form onSubmit={handleUpdatePassword} className="space-y-4">
            <div className="space-y-2">
              <label className="text-[10px] font-extrabold text-muted uppercase tracking-widest flex items-center gap-2">
                <Lock className="w-3 h-3" /> Current Password
              </label>
              <input 
                type="password" 
                value={passwords.current}
                onChange={(e) => setPasswords({...passwords, current: e.target.value})}
                className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 outline-none focus:border-primary/40 transition-all font-mono text-foreground"
                placeholder="••••••••"
              />
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-2">
                <label className="text-[10px] font-extrabold text-muted uppercase tracking-widest flex items-center gap-2">
                  <User className="w-3 h-3" /> New Password
                </label>
                <input 
                  type="password" 
                  value={passwords.new}
                  onChange={(e) => setPasswords({...passwords, new: e.target.value})}
                  className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 outline-none focus:border-primary/40 transition-all font-mono text-foreground"
                  placeholder="New password"
                />
              </div>
              <div className="space-y-2">
                <label className="text-[10px] font-extrabold text-muted uppercase tracking-widest flex items-center gap-2">
                  <Check className="w-3 h-3" /> Confirm New
                </label>
                <input 
                  type="password" 
                  value={passwords.confirm}
                  onChange={(e) => setPasswords({...passwords, confirm: e.target.value})}
                  className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 outline-none focus:border-primary/40 transition-all font-mono text-foreground"
                  placeholder="Confirm new password"
                />
              </div>
            </div>
            <button 
              type="submit"
              className="w-full py-3 bg-primary text-white font-bold rounded-xl shadow-[0_4px_15px_rgba(255,140,102,0.3)] hover:scale-[1.02] transition-all mt-4 flex items-center justify-center gap-2 cursor-pointer"
            >
              Update Password
            </button>
          </form>
        </div>
      </section>
    </div>
  );
};

