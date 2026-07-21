import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Camera, Plus, X, Upload, Loader2, Image as ImageIcon, Move, Trash2 } from 'lucide-react';
import api from '../lib/api';

// --- Visual Layout Editor types ---
interface SlotBox {
  id: string;
  x: number; // percent of natural width
  y: number;
  w: number;
  h: number;
}

interface DragState {
  slotId: string;
  mode: 'move' | 'resize';
  startMouseX: number;
  startMouseY: number;
  startX: number;
  startY: number;
  startW: number;
  startH: number;
}

// --- Slot overlay component ---
const SlotOverlay: React.FC<{
  slot: SlotBox;
  index: number;
  onDragStart: (id: string, mode: 'move' | 'resize', e: React.MouseEvent) => void;
  onDelete: (id: string) => void;
}> = ({ slot, index, onDragStart, onDelete }) => (
  <div
    className="absolute border-2 border-emerald-400 bg-emerald-400/15 cursor-move group select-none"
    style={{
      left: `${slot.x}%`,
      top: `${slot.y}%`,
      width: `${slot.w}%`,
      height: `${slot.h}%`,
    }}
    onMouseDown={(e) => { e.stopPropagation(); onDragStart(slot.id, 'move', e); }}
  >
    {/* Label */}
    <span className="absolute top-1 left-1 bg-emerald-500 text-slate-950 text-[9px] font-black px-1.5 py-0.5 rounded leading-none uppercase tracking-widest">
      Slot {index + 1}
    </span>
    {/* Delete */}
    <button
      className="absolute top-1 right-1 bg-red-500/80 hover:bg-red-500 text-white p-0.5 rounded opacity-0 group-hover:opacity-100 transition-opacity"
      onMouseDown={(e) => { e.stopPropagation(); onDelete(slot.id); }}
    >
      <Trash2 className="w-3 h-3" />
    </button>
    {/* Resize handle (bottom-right corner) */}
    <div
      className="absolute bottom-0 right-0 w-4 h-4 bg-emerald-400 cursor-se-resize rounded-tl"
      onMouseDown={(e) => { e.stopPropagation(); onDragStart(slot.id, 'resize', e); }}
    />
  </div>
);

export const TemplateManagement: React.FC = () => {
  const [templates, setTemplates] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Form state
  const [name, setName] = useState('');
  const [file, setFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [naturalSize, setNaturalSize] = useState<{ w: number; h: number } | null>(null);

  // Visual slot editor
  const [slots, setSlots] = useState<SlotBox[]>([]);
  const containerRef = useRef<HTMLDivElement>(null);
  const imageRef = useRef<HTMLImageElement>(null);
  const dragRef = useRef<DragState | null>(null);

  // ---- Fetch templates ----
  const fetchTemplates = async () => {
    try {
      setIsLoading(true);
      const res = await api.get('/admin/templates');
      const data = res.data?.data || res.data;
      setTemplates(Array.isArray(data) ? data : []);
    } catch (err: any) {
      console.error('Failed to load templates:', err);
      setError(err?.response?.data?.message || 'Failed to load templates');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => { fetchTemplates(); }, []);

  // ---- File change -> preview ----
  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0] || null;
    setFile(f);
    if (f) {
      const url = URL.createObjectURL(f);
      setPreviewUrl(url);
      const img = new Image();
      img.onload = () => setNaturalSize({ w: img.naturalWidth, h: img.naturalHeight });
      img.src = url;
    } else {
      setPreviewUrl(null);
      setNaturalSize(null);
    }
  };

  // ---- Slot CRUD ----
  const addSlot = () => {
    setSlots(prev => [...prev, {
      id: crypto.randomUUID(),
      x: 10 + (prev.length * 5) % 40,
      y: 10 + (prev.length * 5) % 40,
      w: 25,
      h: 20,
    }]);
  };

  const deleteSlot = (id: string) => setSlots(prev => prev.filter(s => s.id !== id));

  // ---- Drag / Resize via mouse events ----
  const handleDragStart = useCallback((slotId: string, mode: 'move' | 'resize', e: React.MouseEvent) => {
    const slot = slots.find(s => s.id === slotId);
    if (!slot) return;
    dragRef.current = {
      slotId,
      mode,
      startMouseX: e.clientX,
      startMouseY: e.clientY,
      startX: slot.x,
      startY: slot.y,
      startW: slot.w,
      startH: slot.h,
    };
    e.preventDefault();
  }, [slots]);

  useEffect(() => {
    const onMouseMove = (e: MouseEvent) => {
      const d = dragRef.current;
      const el = containerRef.current;
      if (!d || !el) return;
      const rect = el.getBoundingClientRect();
      const dxPct = ((e.clientX - d.startMouseX) / rect.width) * 100;
      const dyPct = ((e.clientY - d.startMouseY) / rect.height) * 100;

      setSlots(prev => prev.map(s => {
        if (s.id !== d.slotId) return s;
        if (d.mode === 'move') {
          return {
            ...s,
            x: Math.max(0, Math.min(100 - s.w, d.startX + dxPct)),
            y: Math.max(0, Math.min(100 - s.h, d.startY + dyPct)),
          };
        }
        // resize
        return {
          ...s,
          w: Math.max(5, Math.min(100 - s.x, d.startW + dxPct)),
          h: Math.max(5, Math.min(100 - s.y, d.startH + dyPct)),
        };
      }));
    };

    const onMouseUp = () => { dragRef.current = null; };

    window.addEventListener('mousemove', onMouseMove);
    window.addEventListener('mouseup', onMouseUp);
    return () => {
      window.removeEventListener('mousemove', onMouseMove);
      window.removeEventListener('mouseup', onMouseUp);
    };
  }, []);

  // ---- Build layout_config from slots ----
  const buildLayoutConfig = (): string => {
    if (!imageRef.current) return '[]';
    
    const imgRect = imageRef.current.getBoundingClientRect();
    const scaleX = imageRef.current.naturalWidth / imgRect.width;
    const scaleY = imageRef.current.naturalHeight / imgRect.height;

    return JSON.stringify(slots.map(s => {
      const uiX = (s.x / 100) * imgRect.width;
      const uiY = (s.y / 100) * imgRect.height;
      const uiW = (s.w / 100) * imgRect.width;
      const uiH = (s.h / 100) * imgRect.height;

      return {
        x: Math.round(uiX * scaleX),
        y: Math.round(uiY * scaleY),
        w: Math.round(uiW * scaleX),
        h: Math.round(uiH * scaleY),
      };
    }));
  };

  // ---- Submit ----
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name || !file) { alert('Name and Frame Image are required'); return; }
    if (slots.length === 0) { alert('Add at least one photo slot'); return; }

    try {
      setIsSubmitting(true);
      const payload = new FormData();
      payload.append('name', name);
      payload.append('slot_count', String(slots.length));
      payload.append('layout_config', buildLayoutConfig());
      payload.append('frame_image', file);

      await api.post('/admin/templates', payload, {
        headers: { 'Content-Type': 'multipart/form-data' }
      });

      resetForm();
      setIsModalOpen(false);
      fetchTemplates();
    } catch (err: any) {
      console.error('Upload failed:', err);
      alert(err?.response?.data?.message || 'Upload failed');
    } finally {
      setIsSubmitting(false);
    }
  };

  const resetForm = () => {
    setName('');
    setFile(null);
    setPreviewUrl(null);
    setNaturalSize(null);
    setSlots([]);
  };

  const closeModal = () => { resetForm(); setIsModalOpen(false); };

  return (
    <div className="space-y-8 text-slate-200">
      <header className="flex justify-between items-end border-b border-white/5 pb-6">
        <div>
          <h1 className="text-4xl font-black uppercase text-emerald-400">Frame Templates</h1>
          <p className="text-slate-400 text-sm font-bold uppercase tracking-widest mt-1">Manage photobooth overlays</p>
        </div>
        <button
          onClick={() => setIsModalOpen(true)}
          className="px-6 py-3 bg-emerald-500 hover:bg-emerald-600 text-slate-950 font-black uppercase tracking-widest text-sm rounded-xl flex items-center gap-2 transition-colors"
        >
          <Plus className="w-5 h-5" /> Upload New Template
        </button>
      </header>

      {error && <div className="bg-red-500/10 text-red-400 p-4 rounded-xl font-bold">{error}</div>}

      {/* Template Grid */}
      {isLoading ? (
        <div className="flex justify-center items-center min-h-[300px]">
          <Loader2 className="w-8 h-8 animate-spin text-emerald-500" />
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6">
          {templates.length === 0 ? (
            <div className="col-span-full text-center py-20 text-slate-500 font-bold uppercase tracking-widest">
              No templates found.
            </div>
          ) : (
            templates.map((tpl: any) => (
              <div key={tpl.id} className="bg-slate-900 border border-emerald-500/20 rounded-2xl overflow-hidden shadow-xl">
                <div className="aspect-[3/4] bg-slate-800 flex items-center justify-center">
                  {tpl.frame_image_url || tpl.image ? (
                    <img src={tpl.frame_image_url || tpl.image} alt={tpl.name} className="w-full h-full object-cover" />
                  ) : (
                    <ImageIcon className="w-10 h-10 text-slate-700" />
                  )}
                </div>
                <div className="p-4 border-t border-emerald-500/20">
                  <h3 className="font-black text-lg text-slate-200 uppercase truncate">{tpl.name}</h3>
                  <div className="flex items-center gap-2 mt-1">
                    <Camera className="w-3 h-3 text-emerald-500" />
                    <span className="text-xs font-bold text-slate-400 uppercase tracking-widest">{tpl.slot_count || 1} Slots</span>
                  </div>
                </div>
              </div>
            ))
          )}
        </div>
      )}

      {/* ========= Upload Modal with Visual Layout Editor ========= */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 bg-slate-950/85 backdrop-blur-sm flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-slate-900 border border-emerald-500/30 w-full max-w-3xl rounded-3xl overflow-y-auto max-h-[90vh] shadow-2xl my-8">
            {/* Header */}
            <div className="flex justify-between items-center p-6 border-b border-white/5">
              <h2 className="text-xl font-black uppercase text-emerald-400">Upload Template</h2>
              <button onClick={closeModal} className="text-slate-400 hover:text-white transition-colors">
                <X className="w-6 h-6" />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="p-6 space-y-6">
              {/* Name */}
              <div className="space-y-2">
                <label className="text-xs font-black uppercase tracking-widest text-slate-400">Template Name</label>
                <input
                  type="text"
                  value={name}
                  onChange={e => setName(e.target.value)}
                  className="w-full bg-slate-950 border border-white/10 rounded-xl px-4 py-3 outline-none focus:border-emerald-500 text-white font-bold"
                  placeholder="e.g. Vintage Film"
                  required
                />
              </div>

              {/* File input */}
              <div className="space-y-2">
                <label className="text-xs font-black uppercase tracking-widest text-slate-400">Frame Image (.png)</label>
                <input
                  type="file"
                  accept=".png"
                  onChange={handleFileChange}
                  className="w-full bg-slate-950 border border-white/10 rounded-xl px-4 py-2 outline-none focus:border-emerald-500 text-slate-300 text-sm file:mr-4 file:py-2 file:px-4 file:rounded-lg file:border-0 file:text-xs file:font-black file:bg-emerald-500/10 file:text-emerald-400 hover:file:bg-emerald-500/20 file:uppercase file:tracking-widest"
                  required
                />
              </div>

              {/* Visual Layout Editor */}
              {previewUrl && (
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <label className="text-xs font-black uppercase tracking-widest text-slate-400">
                      <Move className="w-3 h-3 inline mr-1.5 text-emerald-400" />
                      Photo Slot Editor — drag to move, corner to resize
                    </label>
                    <div className="flex items-center gap-3">
                      <span className="text-xs font-black text-emerald-400 uppercase tracking-widest">
                        {slots.length} Slot{slots.length !== 1 ? 's' : ''}
                      </span>
                      <button
                        type="button"
                        onClick={addSlot}
                        className="px-3 py-1.5 bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 font-black uppercase tracking-widest text-[10px] rounded-lg hover:bg-emerald-500/20 transition-colors flex items-center gap-1.5"
                      >
                        <Plus className="w-3 h-3" /> Add Photo Slot
                      </button>
                    </div>
                  </div>

                  {/* Preview container */}
                  <div className="text-center w-full">
                    <div
                      ref={containerRef}
                      className="relative max-h-[50vh] w-auto inline-block border-2 border-dashed border-emerald-500/30 rounded-2xl overflow-hidden bg-slate-950 select-none"
                    >
                      <img
                        ref={imageRef}
                        src={previewUrl}
                        alt="Frame preview"
                        className="max-h-full w-auto object-contain block pointer-events-none"
                        style={{ maxHeight: '50vh' }}
                        draggable={false}
                      />
                    {/* Slot overlays */}
                    {slots.map((slot, i) => (
                      <SlotOverlay
                        key={slot.id}
                        slot={slot}
                        index={i}
                        onDragStart={handleDragStart}
                        onDelete={deleteSlot}
                      />
                    ))}
                    {/* Empty-state hint */}
                    {slots.length === 0 && (
                      <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                        <p className="text-emerald-500/40 font-black uppercase tracking-widest text-sm">Click "Add Photo Slot" to begin</p>
                      </div>
                    )}
                    </div>
                  </div>

                  {/* Slot count (read-only) */}
                  <div className="space-y-2">
                    <label className="text-xs font-black uppercase tracking-widest text-slate-400">Slot Count (auto)</label>
                    <input
                      type="number"
                      value={slots.length}
                      readOnly
                      className="w-full bg-slate-950/50 border border-white/5 rounded-xl px-4 py-3 outline-none text-emerald-400 font-bold cursor-not-allowed"
                    />
                  </div>
                </div>
              )}

              {/* Submit */}
              <div className="pt-2 flex gap-3">
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="flex-1 py-3 bg-emerald-500 hover:bg-emerald-600 disabled:opacity-50 text-slate-950 font-black uppercase tracking-widest text-sm rounded-xl flex items-center justify-center gap-2 transition-colors"
                >
                  {isSubmitting ? <Loader2 className="w-5 h-5 animate-spin" /> : <Upload className="w-5 h-5" />}
                  {isSubmitting ? 'Uploading...' : 'Upload'}
                </button>
                <button
                  type="button"
                  onClick={closeModal}
                  className="px-6 py-3 bg-slate-800 hover:bg-slate-700 text-white font-black uppercase tracking-widest text-sm rounded-xl transition-colors"
                >
                  Cancel
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
