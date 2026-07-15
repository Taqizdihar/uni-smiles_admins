import React, { useState, useEffect } from 'react';
import { 
  Camera, 
  Trash2, 
  Plus, 
  RotateCcw, 
  Eye, 
  Edit2, 
  CheckCircle2, 
  X,
  Check
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { cn } from '../lib/utils';
import { toast } from 'sonner';

interface PhotoFilter {
  id: string;
  name: string;
  description: string;
  cssFilter: string;
  enabled: boolean;
  isDefault?: boolean;
}

const DEFAULT_FILTERS: PhotoFilter[] = [
  { id: '1', name: 'Normal', description: 'Original capture with no modifications.', cssFilter: 'none', enabled: true, isDefault: true },
  { id: '2', name: 'B&W', description: 'Timeless black and white aesthetic.', cssFilter: 'grayscale(100%)', enabled: true },
  { id: '3', name: 'Sepia', description: 'Warm, aged photographic style.', cssFilter: 'sepia(80%)', enabled: true },
  { id: '4', name: 'Warm', description: 'Enhanced warmth and vibrance.', cssFilter: 'saturate(130%) contrast(105%) brightness(105%)', enabled: true },
  { id: '5', name: 'Bright', description: 'Increased exposure for a clean look.', cssFilter: 'brightness(120%) contrast(105%)', enabled: true },
  { id: '6', name: 'High Contrast', description: 'Bold shadows and punchy highlights.', cssFilter: 'contrast(150%) saturate(120%)', enabled: true },
  { id: '7', name: 'Vintage', description: 'Faded film look with a warm tint.', cssFilter: 'sepia(50%) contrast(90%) brightness(105%)', enabled: true },
  { id: '8', name: 'Cool', description: 'Distinctive blue/cyan color shift.', cssFilter: 'hue-rotate(180deg) saturate(110%)', enabled: true },
  { id: '9', name: 'Vivid', description: 'Explosive colors and high detail.', cssFilter: 'saturate(160%) contrast(115%)', enabled: true },
  { id: '10', name: 'Soft', description: 'Dreamy low-contrast velvet look.', cssFilter: 'brightness(108%) contrast(90%) saturate(90%)', enabled: true },
];

const FILTERS_STORAGE_KEY = 'unismiles_photo_filters';

export const PhotoFilters: React.FC = () => {
  const [filters, setFilters] = useState<PhotoFilter[]>(() => {
    const saved = localStorage.getItem(FILTERS_STORAGE_KEY);
    return saved ? JSON.parse(saved) : DEFAULT_FILTERS;
  });

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingFilter, setEditingFilter] = useState<PhotoFilter | null>(null);
  const [newFilter, setNewFilter] = useState<Omit<PhotoFilter, 'id'>>({
    name: '',
    description: '',
    cssFilter: '',
    enabled: true
  });

  useEffect(() => {
    localStorage.setItem(FILTERS_STORAGE_KEY, JSON.stringify(filters));
  }, [filters]);

  const toggleFilter = (id: string) => {
    setFilters(filters.map(f => {
      if (f.id === id && !f.isDefault) {
        return { ...f, enabled: !f.enabled };
      }
      return f;
    }));
  };

  const deleteFilter = (id: string) => {
    if (filters.find(f => f.id === id)?.isDefault) return;
    setFilters(filters.filter(f => f.id !== id));
    toast.success('Filter deleted successfully.');
  };

  const handleSaveFilter = () => {
    if (!newFilter.name || !newFilter.cssFilter) {
      toast.error('Name and CSS Filter are required.');
      return;
    }

    if (editingFilter) {
      setFilters(filters.map(f => f.id === editingFilter.id ? { ...editingFilter, ...newFilter, id: f.id } : f));
      toast.success('Filter updated.');
    } else {
      const filter: PhotoFilter = {
        id: Date.now().toString(),
        ...newFilter
      };
      setFilters([...filters, filter]);
      toast.success('New filter created.');
    }

    setIsModalOpen(false);
    setEditingFilter(null);
    setNewFilter({ name: '', description: '', cssFilter: '', enabled: true });
  };

  const loadDefaults = () => {
    setFilters(DEFAULT_FILTERS);
    toast.info('Default filters loaded.');
  };

  const startEdit = (filter: PhotoFilter) => {
    setEditingFilter(filter);
    setNewFilter({
      name: filter.name,
      description: filter.description,
      cssFilter: filter.cssFilter,
      enabled: filter.enabled
    });
    setIsModalOpen(true);
  };

  return (
    <div className="space-y-8 animate-in fade-in duration-500">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-display font-bold tracking-tight text-foreground flex items-center gap-3">
            <div className="p-2 bg-primary/10 rounded-xl">
              <Camera className="w-8 h-8 text-primary" />
            </div>
            Photo Filters
          </h1>
          <p className="text-muted mt-1 font-medium">Enable or create photo filters for the kiosk experience.</p>
        </div>
        
        <div className="flex items-center gap-3">
          <button 
            onClick={loadDefaults}
            className="px-4 py-2 bg-white/5 border border-white/10 text-foreground font-bold rounded-xl hover:bg-white/10 transition-all flex items-center gap-2"
          >
            <RotateCcw className="w-4 h-4" />
            Load Defaults
          </button>
          <button 
            onClick={() => {
              setEditingFilter(null);
              setNewFilter({ name: '', description: '', cssFilter: '', enabled: true });
              setIsModalOpen(true);
            }}
            className="px-4 py-2 bg-primary text-white font-bold rounded-xl shadow-[0_4px_15px_rgba(255,184,0,0.4)] hover:scale-[1.02] transition-all flex items-center gap-2"
          >
            <Plus className="w-4 h-4" />
            New Filter
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
        <AnimatePresence mode="popLayout">
          {filters.map((filter) => (
            <motion.div
              key={filter.id}
              layout
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.9 }}
              className={cn(
                "group glass-panel p-5 space-y-4 border transition-all duration-300",
                filter.enabled ? "border-white/10 hover:border-primary/30" : "border-white/5 opacity-60 grayscale-[50%]"
              )}
            >
              <div className="aspect-video w-full rounded-xl overflow-hidden bg-black/40 relative">
                <img 
                  src="https://images.unsplash.com/photo-1544005313-94ddf0286df2?w=400&h=300&fit=crop" 
                  alt="Preview"
                  className="w-full h-full object-cover transition-transform group-hover:scale-105 duration-500"
                  style={{ filter: filter.cssFilter }}
                />
                {!filter.enabled && (
                  <div className="absolute inset-0 bg-black/40 backdrop-blur-[2px] flex items-center justify-center font-bold text-white text-xs uppercase tracking-widest">
                    Disabled
                  </div>
                )}
                {filter.isDefault && (
                  <div className="absolute top-2 left-2 px-2 py-0.5 bg-accent text-accent-foreground text-[8px] font-extrabold uppercase tracking-widest rounded-full shadow-[0_2px_10px_rgba(255,210,160,0.3)]">
                    Default
                  </div>
                )}
              </div>

              <div>
                <div className="flex items-center justify-between">
                  <h3 className="font-bold text-foreground text-lg">{filter.name}</h3>
                  {filter.isDefault ? (
                    <div className="w-10 h-5 flex items-center px-1 rounded-full bg-primary/20 border border-primary/30 opacity-50 cursor-not-allowed">
                       <div className="w-3 h-3 rounded-full bg-primary shadow-[0_0_8px_rgba(255,184,0,0.4)] translate-x-5" />
                    </div>
                  ) : (
                    <button 
                      onClick={() => toggleFilter(filter.id)}
                      className={cn(
                        "w-10 h-5 flex items-center px-1 rounded-full transition-all duration-300",
                        filter.enabled ? "bg-primary shadow-[0_0_15px_rgba(255,184,0,0.4)]" : "bg-foreground/10 border border-primary/20"
                      )}
                    >
                      <motion.div 
                        animate={{ x: filter.enabled ? 20 : 0 }}
                        className={cn("w-3 h-3 rounded-full shadow-sm", filter.enabled ? "bg-white" : "bg-muted")}
                      />
                    </button>
                  )}
                </div>
                <p className="text-xs text-muted mt-1 leading-relaxed line-clamp-2 h-8">{filter.description}</p>
                <code className="block mt-3 p-2 bg-foreground/5 rounded-lg text-[10px] text-primary dark:text-primary/80 font-mono truncate border border-primary/10">
                  {filter.cssFilter}
                </code>
              </div>

              <div className="flex items-center gap-2 pt-2">
                <button 
                  onClick={() => startEdit(filter)}
                  className="flex-1 flex items-center justify-center gap-2 py-2 bg-white/5 border border-white/5 hover:border-primary/30 hover:bg-white/10 text-xs font-bold rounded-lg transition-all"
                >
                  <Edit2 className="w-3.5 h-3.5" />
                  Edit
                </button>
                {!filter.isDefault && (
                  <button 
                    onClick={() => deleteFilter(filter.id)}
                    className="p-2 bg-red-500/5 border border-red-500/10 text-red-400 hover:bg-red-500 hover:text-white rounded-lg transition-all"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>
            </motion.div>
          ))}
        </AnimatePresence>
      </div>

      {/* Filter Modal */}
      <AnimatePresence>
        {isModalOpen && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setIsModalOpen(false)}
              className="absolute inset-0 bg-black/80 backdrop-blur-sm"
            />
            <motion.div 
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              className="relative w-full max-w-lg glass-panel p-8 border-primary/30 shadow-[0_20px_50px_rgba(0,0,0,0.5)]"
            >
              <button 
                onClick={() => setIsModalOpen(false)}
                className="absolute top-6 right-6 text-muted hover:text-foreground transition-colors"
              >
                <X className="w-6 h-6" />
              </button>

              <div className="flex items-center gap-3 mb-8">
                <div className="p-2 bg-primary/10 rounded-xl">
                  {editingFilter ? <Edit2 className="w-6 h-6 text-primary" /> : <Plus className="w-6 h-6 text-primary" />}
                </div>
                <h2 className="text-2xl font-bold">{editingFilter ? 'Edit Filter' : 'New Filter'}</h2>
              </div>

              <div className="space-y-6">
                <div className="space-y-2">
                  <label className="text-xs font-bold text-muted uppercase tracking-widest text-[10px]">Filter Name</label>
                  <input 
                    type="text" 
                    placeholder="e.g. Cinema" 
                    value={newFilter.name}
                    onChange={(e) => setNewFilter({...newFilter, name: e.target.value})}
                    className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 outline-none focus:border-primary/40 transition-all"
                  />
                </div>

                <div className="space-y-2">
                  <label className="text-xs font-bold text-muted uppercase tracking-widest text-[10px]">Description</label>
                  <textarea 
                    placeholder="Short description of the filter effect..." 
                    value={newFilter.description}
                    onChange={(e) => setNewFilter({...newFilter, description: e.target.value})}
                    className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 outline-none focus:border-primary/40 min-h-[80px] resize-none"
                  />
                </div>

                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <label className="text-xs font-bold text-muted uppercase tracking-widest text-[10px]">CSS Filter Value</label>
                    <button 
                      className="text-[10px] text-primary hover:underline font-bold"
                      onClick={() => setNewFilter({...newFilter, cssFilter: 'grayscale(100%) brightness(120%)'})}
                    >
                      Use Example
                    </button>
                  </div>
                  <input 
                    type="text" 
                    placeholder="e.g. grayscale(100%) contrast(1.1)" 
                    value={newFilter.cssFilter}
                    onChange={(e) => setNewFilter({...newFilter, cssFilter: e.target.value})}
                    className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 outline-none focus:border-primary/40 font-mono text-sm"
                  />
                  <div className="flex flex-wrap gap-2 mt-2">
                    {['grayscale(100%)', 'sepia(80%)', 'brightness(120%) contrast(105%)', 'saturate(140%) contrast(110%)'].map((ex) => (
                      <button 
                        key={ex}
                        onClick={() => setNewFilter({...newFilter, cssFilter: ex})}
                        className="px-2 py-1 bg-white/5 border border-white/10 rounded text-[9px] text-muted hover:text-primary hover:border-primary/30 transition-all font-mono"
                      >
                        {ex}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="p-6 rounded-2xl bg-black/40 border border-white/10 flex flex-col items-center gap-4">
                  <div className="text-[10px] font-bold text-muted uppercase tracking-widest">Live Preview</div>
                  <div className="w-32 h-32 rounded-xl overflow-hidden border border-primary/20">
                    <img 
                      src="https://images.unsplash.com/photo-1544005313-94ddf0286df2?w=200&h=200&fit=crop" 
                      alt="Preview"
                      className="w-full h-full object-cover"
                      style={{ filter: newFilter.cssFilter }}
                    />
                  </div>
                </div>

                <div className="flex gap-4 pt-4">
                  <button 
                    onClick={() => setIsModalOpen(false)}
                    className="flex-1 py-3 bg-white/5 border border-white/10 text-foreground font-bold rounded-xl hover:bg-white/10 transition-all font-display"
                  >
                    Cancel
                  </button>
                  <button 
                    onClick={handleSaveFilter}
                    className="flex-1 py-3 bg-primary text-white font-bold rounded-xl shadow-[0_4px_15px_rgba(255,184,0,0.4)] hover:scale-[1.02] transition-all font-display flex items-center justify-center gap-2"
                  >
                    <Check className="w-4 h-4" />
                    Save Filter
                  </button>
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
};
