import React, { useState, useEffect, useRef } from 'react';
import { Upload, CreditCard, Save, Loader2, Image as ImageIcon } from 'lucide-react';
import { toast } from 'sonner';
import { motion } from 'motion/react';
import api from '../lib/api';

export const SettingsPage: React.FC = () => {
  const [qrisUrl, setQrisUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    fetchProfile();
  }, []);

  const fetchProfile = async () => {
    setLoading(true);
    try {
      const res = await api.get('/admin/payment-profile');
      const data = res.data?.data || res.data;
      if (data) {
        let paymentData = data.payment_data;
        if (typeof paymentData === 'string') {
          try { paymentData = JSON.parse(paymentData); } catch (_) {}
        }
        if (paymentData?.qris_image_url) {
          setQrisUrl(paymentData.qris_image_url);
        }
      }
    } catch (error: any) {
      console.error('Failed to fetch payment profile:', error);
      // It might return 404 if not found yet, don't show error toast in that case
      if (error.response?.status !== 404) {
        toast.error('Failed to load payment profile');
      }
    } finally {
      setLoading(false);
    }
  };

  const handleFileUpload = async (file: File) => {
    if (!file.type.startsWith('image/')) {
      toast.error('Please select a valid image file (PNG/JPG).');
      return;
    }

    setUploading(true);
    try {
      const formData = new FormData();
      formData.append('qris_image', file);

      const res = await api.post('/admin/payment-profile/qris', formData);
      const imageUrl = res.data.url;
      
      if (imageUrl) {
        setQrisUrl(imageUrl);
        toast.success('QRIS image uploaded successfully');
      } else {
        throw new Error('No image URL returned');
      }
    } catch (error: any) {
      console.error('Failed to upload QRIS image:', error);
      toast.error(error.response?.data?.message || 'Failed to upload QRIS image');
    } finally {
      setUploading(false);
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) handleFileUpload(file);
  };

  const resolveImageUrl = (url?: string | null) => {
    if (!url) return '';
    if (url.startsWith('/uploads')) {
      const baseUrl = import.meta.env.VITE_API_BASE_URL?.replace('/api/v1', '') || 'http://localhost:8000';
      return `${baseUrl}${url}`;
    }
    return url;
  };

  if (loading) {
    return (
      <div className="h-full flex items-center justify-center">
        <Loader2 className="w-10 h-10 text-primary animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-8 animate-in fade-in duration-500 pb-16">
      <header className="mb-8 border-b border-white/5 pb-6">
        <h1 className="text-5xl font-black tracking-tighter uppercase leading-[0.8] mb-2 text-foreground">Settings</h1>
        <p className="text-muted text-[10px] font-black uppercase tracking-[0.3em] opacity-60">Payment Profile & Configuration</p>
      </header>

      <div className="max-w-2xl bg-[#1E293B] border border-white/5 p-8 rounded-[2.5rem] shadow-2xl">
        <div className="flex items-center gap-3 mb-6 border-b border-white/5 pb-4">
          <div className="p-3 bg-primary/10 rounded-2xl border border-primary/20">
            <CreditCard className="w-6 h-6 text-primary" />
          </div>
          <div>
            <h2 className="text-xl font-black uppercase tracking-tight text-foreground">Payment Configuration</h2>
            <p className="text-xs font-bold text-muted mt-1">Upload your static QRIS image to receive payments at the kiosk.</p>
          </div>
        </div>

        <div className="space-y-6">
          <div className="space-y-3">
            <label className="text-[10px] font-black text-muted uppercase tracking-widest">QRIS Image (Static)</label>
            
            <div 
              onClick={() => !uploading && fileInputRef.current?.click()}
              className={`w-full min-h-[300px] border-2 border-dashed rounded-3xl flex flex-col items-center justify-center cursor-pointer transition-all p-6 relative overflow-hidden group ${qrisUrl ? 'border-primary/40 bg-black/20' : 'border-white/10 hover:border-primary/50 bg-[#10172A]'}`}
            >
              {uploading ? (
                <div className="flex flex-col items-center gap-4 text-primary">
                  <Loader2 className="w-10 h-10 animate-spin" />
                  <span className="text-xs font-black uppercase tracking-widest">Uploading...</span>
                </div>
              ) : qrisUrl ? (
                <>
                  <img 
                    src={resolveImageUrl(qrisUrl)} 
                    alt="QRIS Code" 
                    className="max-h-[250px] object-contain group-hover:scale-105 transition-transform duration-500" 
                  />
                  <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center backdrop-blur-[2px]">
                    <div className="flex items-center gap-2 bg-primary text-[#10172A] px-6 py-3 rounded-full font-black text-xs uppercase tracking-wider">
                      <Upload className="w-4 h-4" /> Change Image
                    </div>
                  </div>
                </>
              ) : (
                <div className="flex flex-col items-center gap-3 text-muted group-hover:text-primary transition-colors">
                  <div className="w-16 h-16 rounded-2xl bg-white/5 border border-white/10 flex items-center justify-center group-hover:scale-110 transition-transform">
                    <ImageIcon className="w-8 h-8" />
                  </div>
                  <div className="text-center">
                    <p className="text-sm font-black text-foreground uppercase">Upload QRIS</p>
                    <p className="text-[10px] font-bold mt-1">Click to browse (PNG, JPG)</p>
                  </div>
                </div>
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
        </div>
      </div>
    </div>
  );
};
