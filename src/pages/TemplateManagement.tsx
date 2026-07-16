import React, { useState, useRef, useEffect } from 'react';
import { 
  Plus, 
  Search, 
  Filter, 
  Pencil, 
  Trash2, 
  CheckCircle2, 
  X,
  Upload,
  Edit3,
  ArrowRight,
  ArrowLeft,
  Move,
  Maximize2,
  HelpCircle,
  Eye,
  Sliders
} from 'lucide-react';
import { cn } from '../lib/utils';
import { useTemplate, Template, SlotCoord, LayoutConfig } from '../TemplateContext';
import { toast } from 'sonner';
import { motion, AnimatePresence } from 'motion/react';
import { useNavigate } from 'react-router-dom';
import api from '../lib/api';

const SLOT_COLORS = [
  { border: 'border-emerald-400', bg: 'bg-emerald-500/20', text: 'text-emerald-400', handle: 'bg-emerald-400' },
  { border: 'border-amber-400', bg: 'bg-amber-500/20', text: 'text-amber-400', handle: 'bg-amber-400' },
  { border: 'border-cyan-400', bg: 'bg-cyan-500/20', text: 'text-cyan-400', handle: 'bg-cyan-400' },
  { border: 'border-purple-400', bg: 'bg-purple-500/20', text: 'text-purple-400', handle: 'bg-purple-400' },
  { border: 'border-pink-400', bg: 'bg-pink-500/20', text: 'text-pink-400', handle: 'bg-pink-400' },
  { border: 'border-blue-400', bg: 'bg-blue-500/20', text: 'text-blue-400', handle: 'bg-blue-400' },
  { border: 'border-rose-400', bg: 'bg-rose-500/20', text: 'text-rose-400', handle: 'bg-rose-400' },
  { border: 'border-indigo-400', bg: 'bg-indigo-500/20', text: 'text-indigo-400', handle: 'bg-indigo-400' },
];

const resolveImageUrl = (url?: string): string => {
  if (!url) return '';
  if (url.startsWith('/uploads')) {
    return `http://localhost:8000${url}`;
  }
  return url;
};

export const TemplateManagement: React.FC = () => {
  const navigate = useNavigate();
  const { templates, addTemplate, updateTemplate, deleteTemplate } = useTemplate();
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState('All');
  
  // Modal & Stepper State
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [currentStep, setCurrentStep] = useState<1 | 2>(1);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [uploadingImage, setUploadingImage] = useState(false);
  const [editingTemplateId, setEditingTemplateId] = useState<string | null>(null);
  const [previewTemplate, setPreviewTemplate] = useState<Template | null>(null);

  // Form State
  const [formData, setFormData] = useState<{
    name: string;
    category: string;
    imageUrl: string;
    slotCount: number;
    orientation: string;
    slots: SlotCoord[];
    status: 'active' | 'inactive';
  }>({
    name: '',
    category: 'Birthday',
    imageUrl: '',
    slotCount: 3,
    orientation: 'vertical',
    slots: [],
    status: 'active'
  });

  // Selected slot index in Step 2 for numerical fine-tuning
  const [selectedSlotIndex, setSelectedSlotIndex] = useState<number>(0);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const imageContainerRef = useRef<HTMLDivElement>(null);

  // Dragging & Resizing State for Box Manipulation in Step 2
  const [dragState, setDragState] = useState<{
    active: boolean;
    slotIndex: number;
    type: 'drag' | 'resize-se' | 'resize-nw' | 'resize-ne' | 'resize-sw';
    startX: number;
    startY: number;
    origX: number;
    origY: number;
    origW: number;
    origH: number;
  } | null>(null);

  const categories = ['All', 'Birthday', 'Wedding', 'Graduation', 'Corporate', 'Holiday', 'Vintage', 'Seasonal', 'General'];

  // Initialize or reconcile slots array whenever slotCount changes
  const reconcileSlots = (count: number, existingSlots: SlotCoord[]): SlotCoord[] => {
    const result: SlotCoord[] = [];
    for (let i = 0; i < count; i++) {
      if (existingSlots[i]) {
        result.push({
          ...existingSlots[i],
          index: i
        });
      } else {
        // Generate even default percentage coordinates for new slots
        const ySpace = Math.max(10, Math.floor(80 / count));
        result.push({
          index: i,
          x: 15,
          y: Math.min(85, 10 + i * ySpace),
          width: 70,
          height: Math.max(15, ySpace - 4)
        });
      }
    }
    return result;
  };

  const handleSlotCountChange = (newCount: number) => {
    const clamped = Math.max(1, Math.min(10, newCount));
    setFormData(prev => ({
      ...prev,
      slotCount: clamped,
      slots: reconcileSlots(clamped, prev.slots)
    }));
    if (selectedSlotIndex >= clamped) {
      setSelectedSlotIndex(Math.max(0, clamped - 1));
    }
  };

  // Upload file handling
  const handleFileUpload = async (file: File) => {
    if (!file.type.startsWith('image/')) {
      toast.error('Please upload a valid PNG or JPG image file.');
      return;
    }

    setUploadingImage(true);
    try {
      const uploadData = new FormData();
      uploadData.append('image', file);
      const res = await api.post('/api/frame_templates/upload', uploadData);
      
      if (res.data?.url) {
        setFormData(prev => ({ ...prev, imageUrl: res.data.url }));
        toast.success('Frame image uploaded successfully');
      } else {
        throw new Error('No URL returned');
      }
    } catch (err) {
      console.warn('Backend upload route fallback, reading local data URL:', err);
      // Fallback to local DataURL if server upload fails
      const reader = new FileReader();
      reader.onloadend = () => {
        setFormData(prev => ({ ...prev, imageUrl: reader.result as string }));
        toast.success('Frame image loaded locally');
      };
      reader.readAsDataURL(file);
    } finally {
      setUploadingImage(false);
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) handleFileUpload(file);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    const file = e.dataTransfer.files?.[0];
    if (file) handleFileUpload(file);
  };

  // Step 1 -> Step 2 Validation
  const handleProceedToStep2 = () => {
    if (!formData.name.trim()) {
      toast.error('Please enter a template name.');
      return;
    }
    if (!formData.imageUrl) {
      toast.error('Please upload or provide a PNG frame image URL.');
      return;
    }
    setFormData(prev => ({
      ...prev,
      slots: reconcileSlots(prev.slotCount, prev.slots)
    }));
    setSelectedSlotIndex(0);
    setCurrentStep(2);
  };

  // Mouse drag & resize handlers for coordinate boxes
  const handleBoxMouseDown = (
    e: React.MouseEvent,
    index: number,
    type: 'drag' | 'resize-se' | 'resize-nw' | 'resize-ne' | 'resize-sw'
  ) => {
    e.stopPropagation();
    e.preventDefault();
    setSelectedSlotIndex(index);

    const slot = formData.slots[index];
    if (!slot || !imageContainerRef.current) return;

    setDragState({
      active: true,
      slotIndex: index,
      type,
      startX: e.clientX,
      startY: e.clientY,
      origX: slot.x,
      origY: slot.y,
      origW: slot.width,
      origH: slot.height
    });
  };

  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (!dragState || !dragState.active || !imageContainerRef.current) return;

      const containerRect = imageContainerRef.current.getBoundingClientRect();
      if (containerRect.width === 0 || containerRect.height === 0) return;

      const deltaXPixels = e.clientX - dragState.startX;
      const deltaYPixels = e.clientY - dragState.startY;

      // Convert pixel deltas to percentage relative to container width and height
      const deltaXPercent = (deltaXPixels / containerRect.width) * 100;
      const deltaYPercent = (deltaYPixels / containerRect.height) * 100;

      const round2 = (v: number) => Math.round(v * 100) / 100;
      const clamp = (v: number, min: number, max: number) => Math.max(min, Math.min(max, v));

      setFormData(prev => {
        const nextSlots = [...prev.slots];
        const slot = nextSlots[dragState.slotIndex];
        if (!slot) return prev;

        if (dragState.type === 'drag') {
          const newX = clamp(round2(dragState.origX + deltaXPercent), 0, 100 - slot.width);
          const newY = clamp(round2(dragState.origY + deltaYPercent), 0, 100 - slot.height);
          nextSlots[dragState.slotIndex] = { ...slot, x: newX, y: newY };
        } else if (dragState.type === 'resize-se') {
          const newW = clamp(round2(dragState.origW + deltaXPercent), 5, 100 - slot.x);
          const newH = clamp(round2(dragState.origH + deltaYPercent), 5, 100 - slot.y);
          nextSlots[dragState.slotIndex] = { ...slot, width: newW, height: newH };
        } else if (dragState.type === 'resize-nw') {
          const newX = clamp(round2(dragState.origX + deltaXPercent), 0, dragState.origX + dragState.origW - 5);
          const newY = clamp(round2(dragState.origY + deltaYPercent), 0, dragState.origY + dragState.origH - 5);
          const newW = round2(dragState.origW - (newX - dragState.origX));
          const newH = round2(dragState.origH - (newY - dragState.origY));
          nextSlots[dragState.slotIndex] = { ...slot, x: newX, y: newY, width: newW, height: newH };
        } else if (dragState.type === 'resize-ne') {
          const newY = clamp(round2(dragState.origY + deltaYPercent), 0, dragState.origY + dragState.origH - 5);
          const newW = clamp(round2(dragState.origW + deltaXPercent), 5, 100 - slot.x);
          const newH = round2(dragState.origH - (newY - dragState.origY));
          nextSlots[dragState.slotIndex] = { ...slot, y: newY, width: newW, height: newH };
        } else if (dragState.type === 'resize-sw') {
          const newX = clamp(round2(dragState.origX + deltaXPercent), 0, dragState.origX + dragState.origW - 5);
          const newW = round2(dragState.origW - (newX - dragState.origX));
          const newH = clamp(round2(dragState.origH + deltaYPercent), 5, 100 - slot.y);
          nextSlots[dragState.slotIndex] = { ...slot, x: newX, width: newW, height: newH };
        }

        return { ...prev, slots: nextSlots };
      });
    };

    const handleMouseUp = () => {
      if (dragState) {
        setDragState(null);
      }
    };

    if (dragState) {
      window.addEventListener('mousemove', handleMouseMove);
      window.addEventListener('mouseup', handleMouseUp);
    }
    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    };
  }, [dragState]);

  // Numerical fine-tuning input updates
  const handleNumericalChange = (field: keyof SlotCoord, val: number) => {
    setFormData(prev => {
      const nextSlots = [...prev.slots];
      const currentSlot = nextSlots[selectedSlotIndex];
      if (!currentSlot) return prev;

      const round2 = (v: number) => Math.round(v * 100) / 100;
      const clamp = (v: number, min: number, max: number) => Math.max(min, Math.min(max, v));

      let updated = { ...currentSlot, [field]: round2(val) };

      // Enforce container boundary clamping
      if (field === 'x') updated.x = clamp(updated.x, 0, 100 - updated.width);
      if (field === 'y') updated.y = clamp(updated.y, 0, 100 - updated.height);
      if (field === 'width') updated.width = clamp(updated.width, 5, 100 - updated.x);
      if (field === 'height') updated.height = clamp(updated.height, 5, 100 - updated.y);

      nextSlots[selectedSlotIndex] = updated;
      return { ...prev, slots: nextSlots };
    });
  };

  // Submit combined payload to Context API
  const handleSubmitTemplate = async () => {
    setIsSubmitting(true);
    try {
      const payload = {
        name: formData.name,
        category: formData.category,
        image_url: formData.imageUrl,
        imageUrl: formData.imageUrl,
        slot_count: formData.slotCount,
        layout_config: {
          orientation: formData.orientation,
          slots: formData.slots
        },
        status: formData.status
      };

      if (editingTemplateId) {
        await updateTemplate(editingTemplateId, payload);
        toast.success('Template updated successfully');
      } else {
        await addTemplate(payload);
        toast.success('Template created successfully');
      }

      setIsModalOpen(false);
      resetForm();
    } catch (err: any) {
      console.error('Error submitting template:', err);
    } finally {
      setIsSubmitting(false);
    }
  };

  const resetForm = () => {
    setEditingTemplateId(null);
    setCurrentStep(1);
    setFormData({
      name: '',
      category: 'Birthday',
      imageUrl: '',
      slotCount: 3,
      orientation: 'vertical',
      slots: [],
      status: 'active'
    });
    setSelectedSlotIndex(0);
  };

  const handleEditClick = (t: Template) => {
    setEditingTemplateId(t.id);
    const slots = t.layout_config?.slots || t.layoutConfig?.slots || [];
    const orientation = t.layout_config?.orientation || t.layoutConfig?.orientation || 'vertical';
    const count = t.slot_count ?? t.slotCount ?? slots.length ?? 3;

    setFormData({
      name: t.name,
      category: t.category,
      imageUrl: t.imageUrl || t.image_url || '',
      slotCount: count,
      orientation,
      slots: reconcileSlots(count, slots),
      status: t.status
    });
    setSelectedSlotIndex(0);
    setCurrentStep(1);
    setIsModalOpen(true);
  };

  const handleDeleteTemplate = async (id: string) => {
    if (!window.confirm('Are you sure you want to delete this frame template?')) return;
    try {
      await deleteTemplate(id);
      toast.success('Template deleted successfully');
    } catch (err) {
      console.error('Error deleting template:', err);
    }
  };

  const filteredTemplates = templates.filter(t => 
    (filter === 'All' || t.category === filter) &&
    t.name.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="space-y-8 animate-in fade-in duration-500 pb-16">
      <header className="flex justify-between items-end mb-4">
        <div>
          <h1 className="text-5xl font-black tracking-tighter uppercase leading-[0.8] mb-2 text-foreground">Templates</h1>
          <p className="text-muted text-[10px] font-black uppercase tracking-[0.3em] opacity-60">Visual Assets & PNG Frame Overlays Portfolio</p>
        </div>
        <button 
          onClick={() => { resetForm(); setIsModalOpen(true); }}
          className="btn-primary flex items-center gap-3 px-8 py-4 rounded-2xl font-black uppercase tracking-wider text-xs shadow-xl shadow-primary/20 cursor-pointer"
        >
          <Plus className="w-4 h-4" /> New Template
        </button>
      </header>

      {/* Module Navigation Tabs */}
      <div className="flex gap-6 border-b border-white/5 pb-2">
        <button
          onClick={() => navigate('/templates')}
          className="pb-3 text-xs font-black uppercase tracking-widest border-b-2 transition-all cursor-pointer border-emerald-500 text-emerald-400"
        >
          Frame Templates
        </button>
        <button
          onClick={() => navigate('/templates/stickers')}
          className="pb-3 text-xs font-black uppercase tracking-widest border-b-2 transition-all cursor-pointer border-transparent text-muted hover:text-foreground"
        >
          Sticker Library
        </button>
      </div>

      {/* Filter & Search Bar */}
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
                "px-6 py-3 rounded-2xl text-[10px] font-black uppercase tracking-[0.2em] transition-all whitespace-nowrap border cursor-pointer",
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

      {/* Templates Table */}
      <div className="bg-[#0B0F19] border border-white/5 rounded-[3rem] overflow-hidden shadow-2xl">
        <table className="w-full text-left border-collapse">
          <thead>
            <tr className="bg-black/40 border-b border-white/5">
              <th className="px-8 py-6 text-[10px] font-black uppercase tracking-[0.4em] text-emerald-500/60">Thumbnail</th>
              <th className="px-8 py-6 text-[10px] font-black uppercase tracking-[0.4em] text-emerald-500/60">Identity</th>
              <th className="px-8 py-6 text-[10px] font-black uppercase tracking-[0.4em] text-emerald-500/60">Slots</th>
              <th className="px-8 py-6 text-[10px] font-black uppercase tracking-[0.4em] text-emerald-500/60">Stats</th>
              <th className="px-8 py-6 text-[10px] font-black uppercase tracking-[0.4em] text-emerald-500/60">Availability</th>
              <th className="px-8 py-6 text-[10px] font-black uppercase tracking-[0.4em] text-emerald-500/60 text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-white/5">
            {filteredTemplates.length === 0 ? (
              <tr>
                <td colSpan={6} className="px-8 py-16 text-center text-muted font-bold text-sm">
                  No frame templates found matching your criteria.
                </td>
              </tr>
            ) : (
              filteredTemplates.map((template) => {
                const slots = template.layout_config?.slots || template.layoutConfig?.slots || [];
                const slotCount = template.slot_count ?? template.slotCount ?? slots.length ?? 3;
                return (
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
                          src={resolveImageUrl(template.imageUrl || template.image_url || 'https://picsum.photos/seed/placeholder/300/450')} 
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
                      <span className="inline-flex items-center gap-1.5 px-3 py-1 bg-white/5 rounded-xl border border-white/10 text-xs font-black text-foreground">
                        <Sliders className="w-3.5 h-3.5 text-primary" />
                        {slotCount} {slotCount === 1 ? 'Slot' : 'Slots'}
                      </span>
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
                      <div className="flex justify-end gap-3 opacity-70 group-hover:opacity-100 transition-all">
                        <button 
                          onClick={(e) => { e.stopPropagation(); handleEditClick(template); }}
                          className="w-10 h-10 bg-white/5 border border-white/5 text-muted hover:text-foreground rounded-xl flex items-center justify-center hover:bg-white/10 transition-all shadow-xl cursor-pointer"
                          title="Edit Template & Layout"
                        >
                          <Pencil className="w-4 h-4" />
                        </button>
                        <button 
                          onClick={(e) => { e.stopPropagation(); handleDeleteTemplate(template.id); }}
                          className="w-10 h-10 bg-red-500/10 border border-red-500/20 text-red-500 rounded-xl flex items-center justify-center hover:bg-red-500 hover:text-white transition-all shadow-xl cursor-pointer"
                          title="Delete Template"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </td>
                  </motion.tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      {/* 2-Step Template Creation & Visual Layout Mapper Modal */}
      <AnimatePresence>
        {isModalOpen && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/85 backdrop-blur-md overflow-y-auto"
          >
            <motion.div 
              initial={{ scale: 0.92, opacity: 0, y: 20 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.92, opacity: 0, y: 20 }}
              className={cn(
                "bg-[#1E293B] border border-white/10 relative overflow-hidden rounded-[2.5rem] shadow-[0_25px_60px_rgba(0,0,0,0.7)] transition-all duration-300 flex flex-col max-h-[90vh]",
                currentStep === 1 ? "w-full max-w-xl" : "w-full max-w-6xl"
              )}
            >
              {/* Top Modal Header (Fixed) */}
              <div className="flex-shrink-0 flex justify-between items-center p-6 md:p-8 border-b border-white/10 bg-[#1E293B] z-10">
                <div>
                  <div className="flex items-center gap-3">
                    <span className="px-3 py-1 rounded-full bg-primary/20 text-primary text-[10px] font-black uppercase tracking-widest border border-primary/30">
                      Step {currentStep} of 2
                    </span>
                    <h2 className="text-2xl font-black tracking-tight uppercase text-foreground">
                      {editingTemplateId ? 'Edit Template Overlay' : 'New Template Overlay'}
                    </h2>
                  </div>
                  <p className="text-xs text-muted font-bold mt-1">
                    {currentStep === 1 
                      ? 'Configure template metadata and upload PNG frame overlay with transparent photo slots.' 
                      : 'Visually map and adjust photo slot boxes as exact percentages over the PNG frame.'}
                  </p>
                </div>
                <button 
                  onClick={() => { setIsModalOpen(false); resetForm(); }}
                  disabled={isSubmitting}
                  className="p-3 bg-white/5 hover:bg-white/10 rounded-2xl text-muted hover:text-foreground transition-all cursor-pointer"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              {/* Step 1 Content: Details & Upload */}
              {currentStep === 1 && (
                <>
                  <div className="flex-1 overflow-y-auto p-6 md:p-8 space-y-6 custom-scrollbar">
                    <div className="space-y-2">
                      <label className="text-[10px] font-black text-muted uppercase tracking-widest ml-1">Template Name</label>
                      <input 
                        required
                        value={formData.name}
                        onChange={e => setFormData({ ...formData, name: e.target.value })}
                        className="w-full bg-black/30 border border-white/10 rounded-2xl px-6 py-4 outline-none focus:border-primary/50 font-black text-sm text-foreground"
                        placeholder="e.g. Retro Film Strip 3-Slot"
                      />
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <label className="text-[10px] font-black text-muted uppercase tracking-widest ml-1">Category</label>
                        <select 
                          value={formData.category}
                          onChange={e => setFormData({ ...formData, category: e.target.value })}
                          className="w-full bg-black/30 border border-white/10 rounded-2xl px-5 py-4 outline-none focus:border-primary/50 font-black text-xs uppercase tracking-wider text-foreground"
                        >
                          {categories.filter(c => c !== 'All').map(c => (
                            <option key={c} value={c} className="bg-[#1E293B]">{c}</option>
                          ))}
                        </select>
                      </div>

                      <div className="space-y-2">
                        <label className="text-[10px] font-black text-muted uppercase tracking-widest ml-1">Photo Slot Count</label>
                        <select 
                          value={formData.slotCount}
                          onChange={e => handleSlotCountChange(Number(e.target.value))}
                          className="w-full bg-black/30 border border-white/10 rounded-2xl px-5 py-4 outline-none focus:border-primary/50 font-black text-xs uppercase tracking-wider text-foreground"
                        >
                          {[1, 2, 3, 4, 5, 6, 8].map(num => (
                            <option key={num} value={num} className="bg-[#1E293B]">{num} {num === 1 ? 'Slot' : 'Slots'}</option>
                          ))}
                        </select>
                      </div>
                    </div>

                    <div className="space-y-2">
                      <label className="text-[10px] font-black text-muted uppercase tracking-widest ml-1">PNG Frame Overlay (With Transparent Holes)</label>
                      <div 
                        onClick={() => !uploadingImage && fileInputRef.current?.click()}
                        onDragOver={e => e.preventDefault()}
                        onDrop={handleDrop}
                        className={cn(
                          "w-full min-h-[208px] bg-[#10172A] border-2 border-dashed border-white/10 rounded-3xl flex flex-col items-center justify-center gap-3 cursor-pointer hover:border-primary/50 transition-all group overflow-hidden relative p-4",
                          formData.imageUrl && "border-primary/50 shadow-lg shadow-primary/5"
                        )}
                      >
                        {uploadingImage ? (
                          <div className="flex flex-col items-center gap-3 text-primary animate-pulse">
                            <Upload className="w-8 h-8 animate-bounce" />
                            <span className="text-xs font-black uppercase tracking-widest">Uploading PNG Frame...</span>
                          </div>
                        ) : formData.imageUrl ? (
                          <>
                            <img src={resolveImageUrl(formData.imageUrl)} alt="Frame Asset" className="max-h-[300px] w-auto object-contain" />
                            <div className="absolute inset-x-0 bottom-0 bg-primary/95 py-2 text-center shadow-lg">
                              <span className="text-[9px] font-black uppercase tracking-[0.2em] text-[#10172A]">Click to Replace PNG File</span>
                            </div>
                          </>
                        ) : (
                          <>
                            <div className="w-12 h-12 rounded-2xl bg-white/5 border border-white/10 flex items-center justify-center text-muted group-hover:text-primary group-hover:scale-110 transition-all">
                              <Upload className="w-6 h-6" />
                            </div>
                            <div className="text-center">
                              <p className="text-xs font-black text-foreground">Drop PNG Frame File Here</p>
                              <p className="text-[10px] font-bold text-muted mt-1">Or click to browse transparent PNG overlay</p>
                            </div>
                          </>
                        )}
                      </div>
                      <input 
                        type="file"
                        ref={fileInputRef}
                        onChange={handleFileChange}
                        accept="image/png,image/jpeg"
                        className="hidden"
                      />
                    </div>

                    {/* Optional External URL input */}
                    <div className="space-y-2 pt-2">
                      <label className="text-[9px] font-black text-muted uppercase tracking-widest ml-1">Or Paste Direct Image URL</label>
                      <input 
                        value={formData.imageUrl}
                        onChange={e => setFormData({ ...formData, imageUrl: e.target.value })}
                        className="w-full bg-black/20 border border-white/5 rounded-xl px-4 py-2.5 text-xs font-mono text-muted focus:text-foreground outline-none focus:border-white/20"
                        placeholder="https://cdn.unismiles.com/frames/your-frame.png"
                      />
                    </div>
                  </div>

                  {/* Step 1 Footer (Fixed) */}
                  <div className="flex-shrink-0 p-6 md:p-8 border-t border-white/10 bg-[#1E293B] flex justify-end gap-3 z-10">
                    <button 
                      type="button"
                      onClick={() => { setIsModalOpen(false); resetForm(); }}
                      className="px-6 py-4 bg-white/5 hover:bg-white/10 text-foreground rounded-2xl font-black uppercase tracking-wider text-xs transition-all cursor-pointer"
                    >
                      Cancel
                    </button>
                    <button 
                      type="button"
                      onClick={handleProceedToStep2}
                      className="btn-primary flex items-center gap-2 px-8 py-4 rounded-2xl font-black uppercase tracking-wider text-xs shadow-xl shadow-primary/20 cursor-pointer"
                    >
                      Next: Map Photo Slots <ArrowRight className="w-4 h-4" />
                    </button>
                  </div>
                </>
              )}

              {/* Step 2 Content: Visual Coordinate Mapper */}
              {currentStep === 2 && (
                <>
                  <div className="flex-1 overflow-y-auto p-6 md:p-8 flex flex-col lg:flex-row gap-8 custom-scrollbar">
                    {/* Left: Interactive Visual Mapper Canvas */}
                    <div className="flex-1 bg-[#0F172A] border border-white/10 rounded-3xl p-6 flex flex-col items-center justify-center overflow-auto relative min-h-[420px]">
                      <div className="absolute top-4 left-4 flex items-center gap-2 bg-black/60 backdrop-blur-md px-3.5 py-2 rounded-xl border border-white/10 z-20">
                        <HelpCircle className="w-4 h-4 text-primary" />
                        <span className="text-[10px] font-bold text-muted">
                          Drag inside box to move • Drag colored corners/edges to resize
                        </span>
                      </div>

                      {/* Image & Overlay Wrapper */}
                      <div 
                        ref={imageContainerRef}
                        className="relative inline-block border-2 border-white/10 rounded-2xl overflow-hidden shadow-2xl select-none my-auto min-w-[200px] min-h-[200px]"
                      >
                        <img 
                          src={resolveImageUrl(formData.imageUrl)} 
                          alt="Frame Overlay" 
                          className="max-w-full max-h-[520px] w-auto h-auto block pointer-events-none select-none min-h-[200px]"
                        />

                        {/* Render Draggable / Resizable Slot Boxes */}
                        {formData.slots.map((slot, idx) => {
                          const style = SLOT_COLORS[idx % SLOT_COLORS.length];
                          const isSelected = selectedSlotIndex === idx;

                          return (
                            <div
                              key={idx}
                              onMouseDown={e => handleBoxMouseDown(e, idx, 'drag')}
                              onClick={e => { e.stopPropagation(); setSelectedSlotIndex(idx); }}
                              style={{
                                left: `${slot.x}%`,
                                top: `${slot.y}%`,
                                width: `${slot.width}%`,
                                height: `${slot.height}%`
                              }}
                              className={cn(
                                "absolute border-2 transition-shadow cursor-move flex items-center justify-center select-none",
                                style.border,
                                isSelected ? `${style.bg} ring-2 ring-white shadow-[0_0_20px_rgba(255,255,255,0.3)] z-10` : "bg-black/30 hover:bg-black/40"
                              )}
                            >
                              {/* Slot Index Badge */}
                              <div className="bg-black/80 backdrop-blur-md px-2.5 py-1 rounded-lg border border-white/20 text-[11px] font-black text-white shadow-md pointer-events-none">
                                #{idx + 1} ({Math.round(slot.width)}x{Math.round(slot.height)}%)
                              </div>

                              {/* Corner Resize Handles */}
                              <div 
                                onMouseDown={e => handleBoxMouseDown(e, idx, 'resize-nw')}
                                className={cn("absolute -top-1.5 -left-1.5 w-3.5 h-3.5 rounded-full cursor-nwse-resize border border-white", style.handle)} 
                              />
                              <div 
                                onMouseDown={e => handleBoxMouseDown(e, idx, 'resize-ne')}
                                className={cn("absolute -top-1.5 -right-1.5 w-3.5 h-3.5 rounded-full cursor-nesw-resize border border-white", style.handle)} 
                              />
                              <div 
                                onMouseDown={e => handleBoxMouseDown(e, idx, 'resize-sw')}
                                className={cn("absolute -bottom-1.5 -left-1.5 w-3.5 h-3.5 rounded-full cursor-nesw-resize border border-white", style.handle)} 
                              />
                              <div 
                                onMouseDown={e => handleBoxMouseDown(e, idx, 'resize-se')}
                                className={cn("absolute -bottom-1.5 -right-1.5 w-3.5 h-3.5 rounded-full cursor-nwse-resize border border-white", style.handle)} 
                              />
                            </div>
                          );
                        })}
                      </div>
                    </div>

                    {/* Right: Numerical Inspector & Fine-Tuner Panel */}
                    <div className="w-full lg:w-80 flex flex-col space-y-6 bg-black/20 border border-white/10 rounded-3xl p-6">
                      <div>
                        <h3 className="text-sm font-black uppercase text-foreground tracking-wider flex items-center gap-2">
                          <Sliders className="w-4 h-4 text-primary" /> Exact Percentages
                        </h3>
                        <p className="text-[10px] font-bold text-muted mt-1">
                          Select a slot below or click its box on the image to fine-tune layout values down to 0.1%.
                        </p>
                      </div>

                      {/* Slot Selector Pills */}
                      <div className="flex flex-wrap gap-2">
                        {formData.slots.map((slot, idx) => {
                          const style = SLOT_COLORS[idx % SLOT_COLORS.length];
                          const isSelected = selectedSlotIndex === idx;
                          return (
                            <button
                              key={idx}
                              type="button"
                              onClick={() => setSelectedSlotIndex(idx)}
                              className={cn(
                                "px-3.5 py-2 rounded-xl text-xs font-black transition-all border flex items-center gap-1.5 cursor-pointer",
                                isSelected 
                                  ? "bg-white/15 border-white text-white shadow-lg" 
                                  : "bg-white/5 border-white/10 text-muted hover:text-foreground"
                              )}
                            >
                              <span className={cn("w-2 h-2 rounded-full", style.handle)} />
                              Slot #{idx + 1}
                            </button>
                          );
                        })}
                      </div>

                      {/* Selected Slot Numerical Controls */}
                      {formData.slots[selectedSlotIndex] && (
                        <div className="space-y-4 bg-[#10172A] p-5 rounded-2xl border border-white/10">
                          <div className="flex justify-between items-center border-b border-white/10 pb-3">
                            <span className="text-xs font-black uppercase text-primary">
                              Selected: Slot #{selectedSlotIndex + 1}
                            </span>
                            <span className="text-[10px] font-bold text-muted">
                              Index: {selectedSlotIndex}
                            </span>
                          </div>

                          <div className="grid grid-cols-2 gap-3">
                            <div className="space-y-1">
                              <label className="text-[9px] font-black text-muted uppercase">X Position (%)</label>
                              <input 
                                type="number"
                                step="0.1"
                                min="0"
                                max="100"
                                value={formData.slots[selectedSlotIndex].x}
                                onChange={e => handleNumericalChange('x', parseFloat(e.target.value) || 0)}
                                className="w-full bg-black/40 border border-white/10 rounded-xl px-3 py-2 text-xs font-black text-foreground outline-none focus:border-primary"
                              />
                            </div>

                            <div className="space-y-1">
                              <label className="text-[9px] font-black text-muted uppercase">Y Position (%)</label>
                              <input 
                                type="number"
                                step="0.1"
                                min="0"
                                max="100"
                                value={formData.slots[selectedSlotIndex].y}
                                onChange={e => handleNumericalChange('y', parseFloat(e.target.value) || 0)}
                                className="w-full bg-black/40 border border-white/10 rounded-xl px-3 py-2 text-xs font-black text-foreground outline-none focus:border-primary"
                              />
                            </div>

                            <div className="space-y-1">
                              <label className="text-[9px] font-black text-muted uppercase">Width (%)</label>
                              <input 
                                type="number"
                                step="0.1"
                                min="5"
                                max="100"
                                value={formData.slots[selectedSlotIndex].width}
                                onChange={e => handleNumericalChange('width', parseFloat(e.target.value) || 5)}
                                className="w-full bg-black/40 border border-white/10 rounded-xl px-3 py-2 text-xs font-black text-foreground outline-none focus:border-primary"
                              />
                            </div>

                            <div className="space-y-1">
                              <label className="text-[9px] font-black text-muted uppercase">Height (%)</label>
                              <input 
                                type="number"
                                step="0.1"
                                min="5"
                                max="100"
                                value={formData.slots[selectedSlotIndex].height}
                                onChange={e => handleNumericalChange('height', parseFloat(e.target.value) || 5)}
                                className="w-full bg-black/40 border border-white/10 rounded-xl px-3 py-2 text-xs font-black text-foreground outline-none focus:border-primary"
                              />
                            </div>
                          </div>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Step 2 Footer (Fixed) */}
                  <div className="flex-shrink-0 p-6 md:p-8 border-t border-white/10 bg-[#1E293B] flex flex-col sm:flex-row justify-end gap-3 z-10">
                    <button 
                      type="button"
                      onClick={() => setCurrentStep(1)}
                      disabled={isSubmitting}
                      className="px-6 py-4 bg-white/5 hover:bg-white/10 text-muted hover:text-foreground rounded-2xl font-black uppercase tracking-wider text-xs transition-all flex items-center justify-center gap-2 cursor-pointer"
                    >
                      <ArrowLeft className="w-4 h-4" /> Back to Details
                    </button>
                    <button 
                      type="button"
                      onClick={handleSubmitTemplate}
                      disabled={isSubmitting}
                      className="btn-primary px-8 py-4 rounded-2xl font-black uppercase tracking-wider text-xs shadow-xl shadow-primary/25 flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
                    >
                      {isSubmitting ? (
                        <span>Saving Asset...</span>
                      ) : (
                        <>
                          <CheckCircle2 className="w-4 h-4" />
                          {editingTemplateId ? 'Update & Commit Layout' : 'Commit & Save Asset'}
                        </>
                      )}
                    </button>
                  </div>
                </>
              )}
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Full Asset Inspection Modal */}
      <AnimatePresence>
        {previewTemplate && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => setPreviewTemplate(null)}
            className="fixed inset-0 z-[60] flex items-center justify-center p-8 md:p-12 bg-black/95 backdrop-blur-xl cursor-zoom-out"
          >
            <motion.div 
              initial={{ scale: 0.85, opacity: 0, y: 30 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.85, opacity: 0, y: 30 }}
              onClick={(e) => e.stopPropagation()}
              className="relative w-full max-w-6xl h-full flex flex-col cursor-default max-h-[85vh]"
            >
              <div className="flex justify-between items-center mb-6">
                <div>
                  <h3 className="text-3xl md:text-4xl font-black tracking-tight uppercase text-foreground">{previewTemplate.name}</h3>
                  <p className="text-primary text-[10px] font-black uppercase tracking-[0.4em] mt-1">{previewTemplate.category} Portfolio Asset • {previewTemplate.slot_count ?? previewTemplate.slotCount ?? 3} Slots</p>
                </div>
                <button 
                  onClick={() => setPreviewTemplate(null)}
                  className="px-6 py-3 bg-white/5 hover:bg-white/10 text-muted hover:text-foreground rounded-2xl transition-all flex items-center gap-2 text-xs font-black uppercase tracking-widest border border-white/10 cursor-pointer"
                >
                  <X className="w-5 h-5" /> Close
                </button>
              </div>
              
              <div className="flex-1 bg-[#1E293B] border border-white/10 rounded-[3rem] shadow-2xl flex items-center justify-center overflow-hidden p-8 relative group">
                <div className="absolute inset-0 opacity-[0.03]" style={{ backgroundImage: 'radial-gradient(circle at 2px 2px, white 2px, transparent 0)', backgroundSize: '36px 36px' }} />
                
                <div className="relative inline-block max-w-full max-h-full">
                  <img 
                    src={resolveImageUrl(previewTemplate.imageUrl || previewTemplate.image_url || 'https://picsum.photos/seed/placeholder/300/450')} 
                    alt={previewTemplate.name || 'Preview'} 
                    className="max-w-full max-h-[60vh] object-contain relative z-10 drop-shadow-2xl"
                    referrerPolicy="no-referrer"
                  />

                  {/* Render preview slots overlay */}
                  {(previewTemplate.layout_config?.slots || previewTemplate.layoutConfig?.slots || []).map((slot: SlotCoord, idx: number) => {
                    const style = SLOT_COLORS[idx % SLOT_COLORS.length];
                    return (
                      <div
                        key={idx}
                        style={{
                          left: `${slot.x}%`,
                          top: `${slot.y}%`,
                          width: `${slot.width}%`,
                          height: `${slot.height}%`
                        }}
                        className={cn(
                          "absolute border-2 z-20 flex items-center justify-center pointer-events-none",
                          style.border,
                          style.bg
                        )}
                      >
                        <span className="bg-black/80 px-2 py-0.5 rounded text-[10px] font-black text-white shadow">
                          #{idx + 1} ({Math.round(slot.width)}x{Math.round(slot.height)}%)
                        </span>
                      </div>
                    );
                  })}
                </div>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};
