import React, { useState, useEffect } from 'react';
import { 
  Plus, 
  Search, 
  Filter, 
  MoreVertical, 
  Eye, 
  Pencil, 
  Trash2, 
  CheckCircle2, 
  Clock, 
  FileText,
  X,
  Upload,
  Cloud,
  Smile,
  GraduationCap,
  Maximize2,
  Edit3
} from 'lucide-react';
import { cn } from '../lib/utils';
import { useTemplate } from '../TemplateContext';
import { toast } from 'sonner';
import { motion, AnimatePresence } from 'motion/react';
import { useNavigate } from 'react-router-dom';

export const TemplateManagement: React.FC = () => {
  const navigate = useNavigate();
  const { templates, addTemplate, editTemplate, deleteTemplate } = useTemplate();
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState('All');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [isCreating, setIsCreating] = useState(false);
  const [editingTemplateId, setEditingTemplateId] = useState<string | null>(null);
  const [previewTemplate, setPreviewTemplate] = useState<any | null>(null);
  const [newTemplate, setNewTemplate] = useState<{
    name: string;
    category: string;
    imageUrl: string;
    status: 'active' | 'inactive';
  }>({
    name: '',
    category: 'Birthday',
    imageUrl: '',
    status: 'active'
  });

  const fileInputRef = React.useRef<HTMLInputElement>(null);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file && (file.type === 'image/png' || file.type === 'image/jpeg' || file.type === 'image/jpg')) {
      const reader = new FileReader();
      reader.onloadend = () => {
        setNewTemplate({ ...newTemplate, imageUrl: reader.result as string });
      };
      reader.readAsDataURL(file);
    } else if (file) {
      toast.error('Please upload a PNG or JPG file.');
    }
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    const file = e.dataTransfer.files?.[0];
    if (file && (file.type === 'image/png' || file.type === 'image/jpeg' || file.type === 'image/jpg')) {
      const reader = new FileReader();
      reader.onloadend = () => {
        setNewTemplate({ ...newTemplate, imageUrl: reader.result as string });
      };
      reader.readAsDataURL(file);
    } else if (file) {
      toast.error('Please upload a PNG or JPG file.');
    }
  };

  const categories = ['All', 'Birthday', 'Wedding', 'Graduation', 'Corporate', 'Holiday'];

  const handleAddTemplate = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!newTemplate.name) {
      toast.error("Please fill in all fields");
      return;
    }
    
    if (!newTemplate.imageUrl) {
      toast.error("Please upload a template file.");
      return;
    }

    setIsCreating(true);

    // Capture current state to avoid issues with clearing before async finish
    const templateData = { ...newTemplate };
    const currentEditingId = editingTemplateId;

    // Start setTimeout for exactly 2000ms as requested
    setTimeout(async () => {
      try {
        // 1. Simpan data template ke context/state
        if (currentEditingId) {
          await editTemplate(currentEditingId, templateData);
        } else {
          await addTemplate(templateData);
        }
        
        // 2. set isLoading(false) untuk menghentikan animasi muter
        setIsCreating(false);

        // 3. set setShowModal(false) untuk menutup modal secara otomatis
        setIsModalOpen(false);

        // 4. Panggil fungsi untuk memunculkan Toast Notifikasi
        toast.success(currentEditingId ? "Template Berhasil Diperbarui" : "Template Berhasil Ditambahkan", {
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

        // Reset state
        setEditingTemplateId(null);
        setNewTemplate({ name: '', category: 'Birthday', imageUrl: '', status: 'active' });
      } catch (error) {
        console.error("Error in template operation:", error);
        setIsCreating(false);
        toast.error("Gagal menyimpan template. Pastikan ukuran file tidak terlalu besar.");
      }
    }, 2000);
  };

  const handleEditClick = (template: any) => {
    setEditingTemplateId(template.id);
    setNewTemplate({
      name: template.name,
      category: template.category,
      imageUrl: template.imageUrl,
      status: template.status
    });
    setIsModalOpen(true);
  };

  const handleDeleteTemplate = async (id: string) => {
    if (!id) return;
    
    if (!window.confirm("Apakah Anda yakin ingin menghapus template ini?")) {
      return;
    }
    
    try {
      await deleteTemplate(id);

      // 3. Show success notification
      toast.error("Template Berhasil Dihapus", {
        icon: <Trash2 className="w-5 h-5 text-red-400" />,
        duration: 3000,
        position: 'top-center',
        style: {
          background: 'rgba(239, 68, 68, 0.15)',
          backdropFilter: 'blur(12px)',
          border: '1px solid rgba(239, 68, 68, 0.2)',
          color: '#fff',
          borderRadius: '9999px',
          padding: '12px 24px',
          fontWeight: '600',
          fontSize: '14px'
        }
      });
    } catch (error) {
      console.error("Error deleting template:", error);
    }
  };

  const filteredTemplates = templates.filter(t => 
    (filter === 'All' || t.category === filter) &&
    t.name.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="space-y-8 animate-in fade-in duration-500">
      <header className="flex justify-between items-end mb-4">
        <div>
          <h1 className="text-5xl font-black tracking-tighter uppercase leading-[0.8] mb-2">Templates</h1>
          <p className="text-muted text-[10px] font-black uppercase tracking-[0.3em] opacity-60">Visual Assets & Frame Overlays Portfolio</p>
        </div>
        <button 
          onClick={() => setIsModalOpen(true)}
          className="btn-primary flex items-center gap-3 px-10"
        >
          <Plus className="w-5 h-5" /> New Template
        </button>
      </header>

      {/* Module Navigation Tabs */}
      <div className="flex gap-6 border-b border-white/5 pb-2">
        <button
          onClick={() => navigate('/templates')}
          className={cn(
            "pb-3 text-xs font-black uppercase tracking-widest border-b-2 transition-all cursor-pointer",
            "border-emerald-500 text-emerald-400"
          )}
        >
          Frame Templates
        </button>
        <button
          onClick={() => navigate('/templates/stickers')}
          className={cn(
            "pb-3 text-xs font-black uppercase tracking-widest border-b-2 transition-all cursor-pointer",
            "border-transparent text-muted hover:text-foreground"
          )}
        >
          Sticker Library
        </button>
      </div>

      {/* Upload Modal */}
      <AnimatePresence>
        {isModalOpen && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm"
          >
            <motion.div 
              initial={{ scale: 0.9, opacity: 0, y: 20 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.9, opacity: 0, y: 20 }}
              className="bg-[#1E293B] border border-white/5 w-full max-w-md p-10 relative overflow-hidden rounded-[3rem] shadow-2xl"
            >
              {/* Loading Overlay */}
              <AnimatePresence>
                {isCreating && (
                  <motion.div 
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    className="absolute inset-0 z-50 flex flex-col items-center justify-center bg-[#10172A]/80 backdrop-blur-xl"
                  >
                    <div className="flex flex-col items-center gap-8">
                      <div className="relative w-24 h-24 flex items-center justify-center">
                        <div className="absolute inset-0 border-4 border-white/5 rounded-full" />
                        <motion.div 
                          className="absolute inset-0"
                          animate={{ rotate: 360 }}
                          transition={{ repeat: Infinity, duration: 1, ease: "linear" }}
                        >
                          <svg viewBox="0 0 100 100" className="w-full h-full text-primary">
                            <path 
                              d="M 30 65 A 25 25 0 0 0 70 65" 
                              fill="none" 
                              stroke="currentColor" 
                              strokeWidth="5" 
                              strokeLinecap="round"
                            />
                          </svg>
                        </motion.div>
                      </div>
                      
                      <div className="text-center">
                        <p className="text-[10px] font-black uppercase tracking-[0.5em] text-primary">Syncing</p>
                      </div>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>

              <button 
                onClick={() => {
                  if (isCreating) return;
                  setIsModalOpen(false);
                  setEditingTemplateId(null);
                  setNewTemplate({ name: '', category: 'Birthday', imageUrl: '', status: 'active' });
                }}
                disabled={isCreating}
                className="absolute top-8 right-8 text-muted hover:text-foreground z-10 disabled:opacity-0"
              >
                <X className="w-6 h-6" />
              </button>
              
              <h2 className="text-2xl font-black tracking-tighter uppercase mb-8">
                {editingTemplateId ? 'Edit Asset' : 'New Asset'}
              </h2>
              
              <form onSubmit={handleAddTemplate} className="space-y-6">
              <div className="space-y-2">
                <label className="text-[9px] font-black text-muted uppercase tracking-widest ml-1">Asset Identity</label>
                <input 
                  required
                  value={newTemplate.name}
                  onChange={e => setNewTemplate({...newTemplate, name: e.target.value})}
                  className="w-full bg-black/20 border border-white/5 rounded-2xl px-6 py-4 outline-none focus:border-primary/40 font-black text-sm text-foreground"
                  placeholder="e.g. Summer Vibes 2026"
                />
              </div>
              <div className="space-y-2">
                <label className="text-[9px] font-black text-muted uppercase tracking-widest ml-1">Category</label>
                <select 
                  value={newTemplate.category}
                  onChange={e => setNewTemplate({...newTemplate, category: e.target.value})}
                  className="w-full bg-black/20 border border-white/5 rounded-2xl px-6 py-4 outline-none focus:border-primary/40 font-black text-[10px] uppercase tracking-widest appearance-none text-foreground"
                >
                  {categories.filter(c => c !== 'All').map(c => <option key={c} value={c} className="bg-[#1E293B]">{c}</option>)}
                </select>
              </div>
              <div className="space-y-2">
                <label className="text-[9px] font-black text-muted uppercase tracking-widest ml-1">Composition (PNG Only)</label>
                <div 
                  onClick={() => fileInputRef.current?.click()}
                  onDragOver={handleDragOver}
                  onDrop={handleDrop}
                  className={cn(
                    "w-full h-48 bg-[#10172A] border-4 border-dashed border-white/5 rounded-3xl flex flex-col items-center justify-center gap-4 cursor-pointer hover:border-primary/40 transition-all group overflow-hidden relative",
                    newTemplate.imageUrl && "border-primary/40 shadow-xl shadow-primary/5"
                  )}
                >
                  {newTemplate.imageUrl ? (
                    <>
                      <img src={newTemplate.imageUrl} alt="Asset Visual" className="w-full h-full object-contain p-8" />
                      <div className="absolute inset-x-0 bottom-0 bg-primary/90 py-2 text-center">
                        <span className="text-[8px] font-black uppercase tracking-[0.3em] text-[#10172A]">Replace Resource</span>
                      </div>
                    </>
                  ) : (
                    <>
                      <Upload className="w-10 h-10 text-muted group-hover:text-primary transition-all group-hover:scale-110" />
                      <div className="text-center">
                        <p className="text-[8px] font-black text-muted uppercase tracking-widest">Drop Resource PNG / JPG</p>
                      </div>
                    </>
                  )}
                </div>
                <input 
                  type="file"
                  ref={fileInputRef}
                  onChange={handleFileChange}
                  accept="image/png, image/jpeg, image/jpg"
                  className="hidden"
                />
              </div>
              
              <button 
                type="submit"
                disabled={isCreating}
                className="btn-primary w-full mt-4 flex items-center justify-center gap-3 disabled:opacity-50"
              >
                {editingTemplateId ? 'Commit Changes' : 'Initialize Asset'}
                <CheckCircle2 className="w-4 h-4" />
              </button>
            </form>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      <div className="flex flex-col md:flex-row gap-6 justify-between items-center bg-[#0B0F19] p-6 rounded-[2rem] border border-white/5">
        <div className="relative w-full md:w-[400px]">
          <Search className="absolute left-6 top-1/2 -translate-y-1/2 w-4 h-4 text-emerald-400" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search templates portfolio..."
            className="w-full bg-black/40 border border-white/5 rounded-2xl pl-14 pr-6 py-4 outline-none focus:border-emerald-500/40 font-black text-sm text-foreground transition-all"
          />
        </div>
        <div className="flex gap-3 overflow-x-auto pb-2 w-full md:w-auto scrollbar-hide scroll-smooth">
          {categories.map(cat => (
            <button
              key={cat}
              onClick={() => setFilter(cat)}
              className={cn(
                "px-8 py-3 rounded-2xl text-[10px] font-black uppercase tracking-[0.2em] transition-all whitespace-nowrap border",
                filter === cat 
                  ? "bg-emerald-500 text-white shadow-xl shadow-emerald-500/20 border-emerald-500" 
                  : "bg-white/5 border-transparent text-emerald-500/40 hover:bg-white/10 hover:text-emerald-400"
              )}
            >
              {cat}
            </button>
          ))}
        </div>
      </div>

      <div className="bg-[#0B0F19] border border-white/5 rounded-[3rem] overflow-hidden shadow-2xl">
        <table className="w-full text-left border-collapse">
          <thead>
            <tr className="bg-black/40 border-b border-white/5">
              <th className="px-8 py-6 text-[10px] font-black uppercase tracking-[0.4em] text-emerald-500/60">Thumbnail</th>
              <th className="px-8 py-6 text-[10px] font-black uppercase tracking-[0.4em] text-emerald-500/60">Identity</th>
              <th className="px-8 py-6 text-[10px] font-black uppercase tracking-[0.4em] text-emerald-500/60">Stats</th>
              <th className="px-8 py-6 text-[10px] font-black uppercase tracking-[0.4em] text-emerald-500/60">Availability</th>
              <th className="px-8 py-6 text-[10px] font-black uppercase tracking-[0.4em] text-emerald-500/60 text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-white/5">
            {filteredTemplates.map((template) => (
              <motion.tr
                key={template.id}
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                className="group hover:bg-emerald-500/5 transition-colors cursor-pointer"
                onClick={() => setPreviewTemplate(template)}
              >
                <td className="px-8 py-6">
                  <div className="w-20 h-24 bg-[#020617] rounded-xl flex items-center justify-center p-2 border border-white/5 group-hover:border-emerald-500/40 transition-all overflow-hidden relative">
                    <div className="absolute inset-0 opacity-[0.05]" style={{ backgroundImage: 'radial-gradient(circle at 1px 1px, white 1px, transparent 0)', backgroundSize: '8px 8px' }} />
                    <img 
                      src={template.imageUrl || 'https://picsum.photos/seed/placeholder/300/450'} 
                      className="max-w-full max-h-full object-contain drop-shadow-lg group-hover:scale-110 transition-transform duration-500" 
                      alt={template.name || 'Template'} 
                    />
                  </div>
                </td>
                <td className="px-8 py-6">
                  <div className="space-y-1">
                    <h4 className="text-sm font-black uppercase text-foreground">{template.name}</h4>
                    <p className="text-[9px] font-black text-emerald-500/40 uppercase tracking-widest">{template.category}</p>
                  </div>
                </td>
                <td className="px-8 py-6">
                  <div className="space-y-1 text-left">
                    <div className="flex items-center gap-2">
                       <span className="text-sm font-black text-foreground">{(template.usageCount || 0).toLocaleString()}</span>
                       <span className="text-[8px] font-black text-emerald-500/40 uppercase">Prints</span>
                    </div>
                  </div>
                </td>
                <td className="px-8 py-6">
                  <div className={cn(
                    "inline-flex items-center gap-2 px-4 py-1.5 rounded-full text-[9px] font-black uppercase tracking-widest border",
                    template.status === 'active' 
                      ? "bg-emerald-500/10 border-emerald-500/20 text-emerald-400" 
                      : "bg-amber-500/10 border-amber-500/20 text-amber-400"
                  )}>
                    <div className={cn("w-1.5 h-1.5 rounded-full animate-pulse", template.status === 'active' ? "bg-emerald-400" : "bg-amber-400")} />
                    {template.status}
                  </div>
                </td>
                <td className="px-8 py-6">
                  <div className="flex justify-end gap-3 translate-x-2 opacity-40 group-hover:opacity-100 group-hover:translate-x-0 transition-all">
                    <button 
                      onClick={(e) => { e.stopPropagation(); navigate('/storyboard', { state: { templateId: template.id } }); }}
                      className="w-10 h-10 bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 rounded-xl flex items-center justify-center hover:bg-emerald-500 hover:text-white transition-all shadow-xl"
                    >
                      <Edit3 className="w-4 h-4" />
                    </button>
                    <button 
                      onClick={(e) => { e.stopPropagation(); handleEditClick(template); }}
                      className="w-10 h-10 bg-white/5 border border-white/5 text-muted hover:text-foreground rounded-xl flex items-center justify-center hover:bg-white/10 transition-all shadow-xl"
                    >
                      <Pencil className="w-4 h-4" />
                    </button>
                    <button 
                      onClick={(e) => { e.stopPropagation(); handleDeleteTemplate(template.id); }}
                      className="w-10 h-10 bg-red-500/10 border border-red-500/20 text-red-500 rounded-xl flex items-center justify-center hover:bg-red-500 hover:text-white transition-all shadow-xl"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </td>
              </motion.tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Heavy Detail Preview Modal */}
      <AnimatePresence>
        {previewTemplate && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => setPreviewTemplate(null)}
            className="fixed inset-0 z-[60] flex items-center justify-center p-12 bg-black/95 backdrop-blur-xl cursor-zoom-out"
          >
            <motion.div 
              initial={{ scale: 0.8, opacity: 0, y: 50 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.8, opacity: 0, y: 50 }}
              onClick={(e) => e.stopPropagation()}
              className="relative w-full max-w-7xl h-full flex flex-col cursor-default"
            >
              <div className="flex justify-between items-center mb-10">
                <div className="space-y-2">
                  <h3 className="text-5xl font-black tracking-tighter uppercase text-foreground leading-[0.8]">{previewTemplate.name}</h3>
                  <p className="text-primary text-[10px] font-black uppercase tracking-[0.5em]">{previewTemplate.category} Portfolio Asset</p>
                </div>
                <button 
                  onClick={() => setPreviewTemplate(null)}
                  className="p-6 bg-white/5 hover:bg-white/10 text-muted hover:text-foreground rounded-[2rem] transition-all flex items-center gap-4 text-xs font-black uppercase tracking-widest border border-white/5"
                >
                  <X className="w-6 h-6" /> Close Inspect
                </button>
              </div>
              
              <div className="flex-1 bg-[#1E293B] border border-white/5 rounded-[4rem] shadow-2xl flex items-center justify-center overflow-hidden p-20 relative group">
                {/* Visual Backdrop pattern */}
                <div className="absolute inset-0 opacity-[0.02]" style={{ backgroundImage: 'radial-gradient(circle at 2px 2px, white 2px, transparent 0)', backgroundSize: '40px 40px' }} />
                
                <img 
                  src={previewTemplate.imageUrl || 'https://picsum.photos/seed/placeholder/300/450'} 
                  alt={previewTemplate.name || 'Preview'} 
                  className="max-w-full max-h-full object-contain relative z-10 drop-shadow-[0_40px_80px_rgba(0,0,0,0.6)] group-hover:scale-105 transition-transform duration-1000"
                  referrerPolicy="no-referrer"
                />
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};
