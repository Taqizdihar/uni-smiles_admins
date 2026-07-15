import React, { useState, useEffect } from 'react';
import { 
  Monitor, 
  RefreshCcw, 
  Settings, 
  Activity, 
  Zap, 
  HardDrive, 
  Droplet,
  Power,
  MapPin,
  Plus,
  Smile,
  CheckCircle2,
  X,
  Trash2
} from 'lucide-react';
import { cn } from '../lib/utils';
import { motion, AnimatePresence } from 'motion/react';
import { useKiosks } from '../KioskContext';
import { toast } from 'sonner';
import { KioskConfigPage } from './KioskConfigPage';

import { useAuth } from '../components/AuthProvider';

export const KioskManager: React.FC = () => {
  const { role } = useAuth();
  const { kiosks, addKiosk, updateKiosk, restartKiosk, deleteKiosk } = useKiosks();
  const [isAdding, setIsAdding] = useState(false);

  const displayedKiosks = role === 'admin' 
    ? kiosks 
    : kiosks.filter(k => k.name === 'Kios-K GIAT');
  const [isRegistering, setIsRegistering] = useState(false);
  const [newKiosk, setNewKiosk] = useState({ name: '', location: '' });
  
  // Full Page Config state
  const [isConfigView, setIsConfigView] = useState(false);
  const [selectedKiosk, setSelectedKiosk] = useState<any>(null);
  
  // Simulate dynamic status changes for dummy kiosks
  useEffect(() => {
    const interval = setInterval(() => {
      const randomKiosk = kiosks[Math.floor(Math.random() * kiosks.length)];
      if (randomKiosk && randomKiosk.status !== 'restarting') {
        const statuses: ('online' | 'idle' | 'offline')[] = ['online', 'idle', 'offline'];
        const newStatus = statuses[Math.floor(Math.random() * statuses.length)];
        updateKiosk(randomKiosk.id, { status: newStatus });
      }
    }, 15000); // Every 15 seconds
    return () => clearInterval(interval);
  }, [kiosks, updateKiosk]);

  const handleConfirmRegistration = async () => {
    if (!newKiosk.name || !newKiosk.location) {
      toast.error("Please fill in all fields");
      return;
    }

    setIsRegistering(true);

    // Simulate registration with 2-second timeout
    setTimeout(async () => {
      try {
        await addKiosk(newKiosk);
        
        setIsRegistering(false);
        setIsAdding(false);
        setNewKiosk({ name: '', location: '' });

        toast.success("Kiosk berhasil didaftarkan", {
          icon: <CheckCircle2 className="w-5 h-5 text-green-400" />,
          duration: 5000,
          position: 'top-center',
          style: {
            background: 'rgba(16, 185, 129, 0.15)',
            backdropFilter: 'blur(12px)',
            border: '1px solid rgba(16, 185, 129, 0.2)',
            color: '#fff',
            borderRadius: '9999px',
            padding: '12px 24px',
            fontWeight: '600',
            fontSize: '14px',
            boxShadow: '0 10px 30px -10px rgba(16, 185, 129, 0.3)'
          }
        });
      } catch (error) {
        console.error("Registration error:", error);
        setIsRegistering(false);
      }
    }, 2000);
  };

  const handleRestart = async (id: string, name: string) => {
    try {
      toast.loading(`Restarting ${name}...`, { id: `restart-${id}` });
      await restartKiosk(id);
      toast.success(`Kiosk ${name} berhasil di-restart dari jarak jauh.`, { id: `restart-${id}` });
    } catch (error) {
      console.error("Restart failed", error);
      toast.error("Restart failed", { id: `restart-${id}` });
    }
  };

  const handleDeleteKiosk = async (id: string, name: string) => {
    if (window.confirm(`Apakah Anda yakin ingin menghapus kiosk "${name}"?`)) {
      try {
        await deleteKiosk(id);
      } catch (error) {
        console.error("Failed to delete kiosk", error);
      }
    }
  };

  const handleOpenConfig = (kiosk: any) => {
    setSelectedKiosk(kiosk);
    setIsConfigView(true);
  };

  // Find the selected kiosk in the latest list to ensure data is fresh
  const currentSelectedKiosk = selectedKiosk ? kiosks.find(k => k.id === selectedKiosk.id) : null;

  return (
    <div className="space-y-8 animate-in fade-in duration-500">
      <AnimatePresence mode="wait">
        {isConfigView && currentSelectedKiosk ? (
          <motion.div
            key="config-view"
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -20 }}
          >
            <KioskConfigPage 
              kiosk={currentSelectedKiosk} 
              onBack={() => setIsConfigView(false)} 
              onUpdate={updateKiosk}
            />
          </motion.div>
        ) : (
          <motion.div
            key="manager-view"
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: 20 }}
            className="space-y-8"
          >
            <header className="flex justify-between items-end">
              <div>
                <h1 className="text-4xl font-black tracking-tighter uppercase">Kiosk Manager</h1>
                <p className="text-muted mt-1 font-bold">Monitor and control your remote photo booth stations.</p>
              </div>
              <div className="flex gap-3">
                {role === 'admin' && (
                  <button 
                    onClick={() => setIsAdding(true)}
                    className="px-7 py-2.5 bg-primary text-[#10172A] rounded-xl font-black uppercase tracking-widest shadow-xl transition-all hover:scale-105 active:scale-95 flex items-center gap-2"
                  >
                    <Plus className="w-5 h-5" /> Register New Kiosk
                  </button>
                )}
              </div>
            </header>

            {isAdding && (
              <div className="bg-[#1E293B] border border-white/5 p-8 rounded-[2rem] shadow-2xl relative overflow-hidden animate-in zoom-in-95 duration-500">
                {/* Loading Overlay */}
                <AnimatePresence>
                  {isRegistering && (
                    <motion.div 
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      exit={{ opacity: 0 }}
                      className="absolute inset-0 z-50 flex flex-col items-center justify-center bg-[#10172A]/80 backdrop-blur-md"
                    >
                      <div className="flex flex-col items-center gap-6">
                        <div className="relative w-20 h-20">
                          <motion.div 
                            className="absolute inset-0 border-4 border-primary/20 rounded-full"
                          />
                          <motion.div 
                            className="absolute inset-0 border-4 border-t-primary rounded-full"
                            animate={{ rotate: 360 }}
                            transition={{ repeat: Infinity, duration: 1, ease: "linear" }}
                          />
                        </div>
                        <p className="text-xl font-black uppercase tracking-widest text-[#F1F5F9]">Registering...</p>
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>

                <div className="flex justify-between items-center mb-8">
                  <h3 className="text-2xl font-black tracking-tighter uppercase">Register New Kiosk</h3>
                  <button 
                    onClick={() => setIsAdding(false)}
                    className="p-2 bg-white/5 hover:bg-white/10 rounded-full transition-colors text-muted"
                  >
                    <X className="w-6 h-6" />
                  </button>
                </div>
                
                <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                  <div className="space-y-3">
                    <label className="text-[10px] font-black text-muted uppercase tracking-[0.2em] ml-1">Kiosk Name</label>
                    <input 
                      placeholder="e.g. Kiosk-01"
                      className="w-full bg-black/20 border border-white/10 rounded-2xl px-6 py-4 outline-none focus:border-primary/50 transition-all text-foreground font-bold tracking-tight"
                      value={newKiosk.name}
                      onChange={e => setNewKiosk({...newKiosk, name: e.target.value})}
                    />
                  </div>
                  <div className="space-y-3">
                    <label className="text-[10px] font-black text-muted uppercase tracking-[0.2em] ml-1">Location</label>
                    <input 
                      placeholder="e.g. Grand Indonesia Mall"
                      className="w-full bg-black/20 border border-white/10 rounded-2xl px-6 py-4 outline-none focus:border-primary/50 transition-all text-foreground font-bold tracking-tight"
                      value={newKiosk.location}
                      onChange={e => setNewKiosk({...newKiosk, location: e.target.value})}
                    />
                  </div>
                </div>
                <div className="mt-10 flex gap-4">
                  <button 
                    onClick={handleConfirmRegistration}
                    disabled={isRegistering}
                    className="px-10 py-4 bg-primary text-[#10172A] rounded-2xl font-black uppercase tracking-widest text-xs hover:opacity-90 transition-all shadow-xl shadow-primary/10 disabled:opacity-50"
                  >
                    Confirm Registration
                  </button>
                  <button 
                    onClick={() => setIsAdding(false)}
                    className="px-10 py-4 bg-white/5 rounded-2xl font-black uppercase tracking-widest text-xs hover:bg-white/10 transition-all text-muted"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            )}

            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-8">
              {displayedKiosks.map((kiosk, i) => (
                <motion.div 
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: i * 0.1 }}
                  key={kiosk.id} 
                  className="bg-[#1E293B] border border-white/5 rounded-[2.5rem] p-8 shadow-2xl group hover:border-primary/30 transition-all duration-500"
                >
                  <div className="flex justify-between items-start mb-8">
                    <div className="flex items-center gap-5">
                      <div className={cn(
                        "w-14 h-14 rounded-2xl flex items-center justify-center transition-all shadow-lg",
                        kiosk.status === 'online' ? "bg-emerald-500/10 text-emerald-400 shadow-emerald-500/10" : 
                        kiosk.status === 'idle' ? "bg-amber-500/10 text-amber-400 shadow-amber-500/10" : 
                        kiosk.status === 'restarting' ? "bg-blue-500/10 text-blue-400 shadow-blue-500/10" : "bg-red-500/10 text-red-400 shadow-red-500/10"
                      )}>
                        <Monitor className="w-7 h-7" />
                      </div>
                      <div>
                        <h3 className="font-black text-xl tracking-tight text-foreground uppercase">{kiosk.name}</h3>
                        <div className="flex flex-col gap-1 mt-1">
                          <div className="flex items-center gap-2 text-[10px] text-muted font-black uppercase tracking-widest">
                            <MapPin className="w-3 h-3 text-primary/40" /> {kiosk.location}
                          </div>
                          <div className="flex items-center gap-2 text-[10px] text-muted font-black uppercase tracking-widest">
                            <Monitor className="w-3 h-3 text-primary/40" />
                            <span className="text-foreground/90 font-black">
                              {kiosk.config?.orientation === 'landscape' ? 'Landscape' : 'Portrait'}
                            </span>
                            <span className="text-muted/60 font-bold lowercase text-[8px]">
                              ({kiosk.config?.resolution || (kiosk.config?.orientation === 'landscape' ? '1920x1080' : '1080x1920')})
                            </span>
                          </div>
                        </div>
                      </div>
                    </div>
                    <div className={cn(
                      "px-3 py-1.5 rounded-full text-[9px] font-black uppercase tracking-widest border",
                      kiosk.status === 'online' ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/20" : 
                      kiosk.status === 'idle' ? "bg-amber-500/10 text-amber-400 border-amber-500/20" : 
                      kiosk.status === 'restarting' ? "bg-blue-500/10 text-blue-400 border-blue-500/20 animate-pulse" : "bg-red-500/10 text-red-400 border-red-500/20"
                    )}>
                      {kiosk.status}
                    </div>
                  </div>

                  <div className="grid grid-cols-3 gap-6 mb-8">
                    <div className="space-y-3">
                      <div className="flex items-center gap-2 text-muted text-[10px] font-black uppercase tracking-[0.1em]">
                         Ink
                      </div>
                      <div className="h-2 bg-black/20 rounded-full overflow-hidden">
                        <motion.div 
                          initial={{ width: 0 }}
                          animate={{ width: `${kiosk.health?.printerInk || 0}%` }}
                          className={cn(
                            "h-full rounded-full transition-all duration-1000",
                            (kiosk.health?.printerInk || 0) > 20 ? "bg-primary" : "bg-red-500"
                          )} 
                        />
                      </div>
                      <p className="text-xs font-black text-foreground">{kiosk.health?.printerInk || 0}%</p>
                    </div>
                    <div className="space-y-3">
                      <div className="flex items-center gap-2 text-muted text-[10px] font-black uppercase tracking-[0.1em]">
                        Space
                      </div>
                      <div className="h-2 bg-black/20 rounded-full overflow-hidden">
                        <motion.div 
                          initial={{ width: 0 }}
                          animate={{ width: `${kiosk.health?.storage || 0}%` }}
                          className="h-full bg-blue-500 rounded-full transition-all duration-1000 shadow-[0_0_8px_rgba(59,130,246,0.3)]" 
                        />
                      </div>
                      <p className="text-xs font-black text-foreground">{kiosk.health?.storage || 0}%</p>
                    </div>
                    <div className="space-y-3">
                      <div className="flex items-center gap-2 text-muted text-[10px] font-black uppercase tracking-[0.1em]">
                         Cam
                      </div>
                      <div className={cn(
                        "text-xs font-black uppercase tracking-widest px-2 py-1 bg-white/5 rounded-lg inline-block",
                        kiosk.health?.camera === 'good' ? "text-emerald-400" : "text-red-400"
                      )}>
                        {kiosk.health?.camera || 'N/A'}
                      </div>
                    </div>
                  </div>

                  {/* Active Filters list */}
                  <div className="mb-6 pt-4 border-t border-white/5">
                    <span className="text-[8px] font-black text-muted uppercase tracking-widest block mb-2">Active Filters</span>
                    <div className="flex flex-wrap gap-1.5 min-h-[20px]">
                      {kiosk.config?.filters ? (
                        kiosk.config.filters.filter((f: any) => f.active).length > 0 ? (
                          kiosk.config.filters.filter((f: any) => f.active).map((f: any) => (
                            <span key={f.id} className="px-2 py-0.5 bg-primary/10 border border-primary/20 text-primary text-[8px] font-black uppercase rounded-full tracking-wider">
                              {f.name}
                            </span>
                          ))
                        ) : (
                          <span className="text-[8px] font-medium text-muted uppercase italic">No active filters</span>
                        )
                      ) : (
                        <>
                          <span className="px-2 py-0.5 bg-primary/10 border border-primary/20 text-primary text-[8px] font-black uppercase rounded-full tracking-wider">Original</span>
                          <span className="px-2 py-0.5 bg-primary/10 border border-primary/20 text-primary text-[8px] font-black uppercase rounded-full tracking-wider">Black & White</span>
                          <span className="px-2 py-0.5 bg-primary/10 border border-primary/20 text-primary text-[8px] font-black uppercase rounded-full tracking-wider">Vintage</span>
                          <span className="px-2 py-0.5 bg-primary/10 border border-primary/20 text-primary text-[8px] font-black uppercase rounded-full tracking-wider">Warm Tone</span>
                          <span className="px-2 py-0.5 bg-primary/10 border border-primary/20 text-primary text-[8px] font-black uppercase rounded-full tracking-wider">Cool Tone</span>
                        </>
                      )}
                    </div>
                  </div>

                  <div className="flex gap-2">
                    <button 
                      onClick={() => handleOpenConfig(kiosk)}
                      className="flex-1 py-4 bg-primary text-[#10172A] rounded-2xl text-[10px] font-black uppercase tracking-[0.2em] transition-all shadow-xl shadow-primary/5 hover:shadow-primary/15 flex items-center justify-center gap-2 group cursor-pointer"
                    >
                      <Settings className="w-4 h-4 group-hover:rotate-90 transition-transform duration-500" /> Config
                    </button>
                    <button 
                      onClick={() => handleRestart(kiosk.id, kiosk.name)}
                      disabled={kiosk.status === 'restarting'}
                      className="px-4 py-4 bg-white/5 hover:bg-red-500/10 text-muted hover:text-red-400 rounded-2xl transition-all disabled:opacity-50"
                    >
                      <RefreshCcw className={cn("w-5 h-5", kiosk.status === 'restarting' && "animate-spin")} />
                    </button>
                    {role === 'admin' && (
                      <button 
                        onClick={() => handleDeleteKiosk(kiosk.id, kiosk.name)}
                        className="px-4 py-4 bg-white/5 hover:bg-red-500/10 text-muted hover:text-red-400 rounded-2xl transition-all cursor-pointer"
                        title="Delete Kiosk"
                      >
                        <Trash2 className="w-5 h-5" />
                      </button>
                    )}
                  </div>
                </motion.div>
              ))}
            </div>

          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};
