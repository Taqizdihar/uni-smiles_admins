import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { toast } from 'sonner';
import { Trash2 } from 'lucide-react';
import { useAuth } from './components/AuthProvider';
import api from './lib/api';

export interface Kiosk {
  id: string;
  name: string;
  location: string;
  base_price?: number;
  status: 'online' | 'offline' | 'idle' | 'restarting';
  health: {
    printerInk: number;
    storage: number;
    camera: 'good' | 'bad';
  };
  config?: {
    brightness: number;
    volume: number;
    maintenanceMode: boolean;
    filters?: any[];
    stickers?: any[];
    branding?: any;
    [key: string]: any;
  };
  lastHeartbeat?: any;
  createdAt?: any;
  user_id?: number | string;
}

interface KioskContextType {
  kiosks: Kiosk[];
  fetchKiosks: () => Promise<void>;
  addKiosk: (kiosk: any) => Promise<string | undefined>;
  updateKiosk: (id: string, data: Partial<Kiosk>) => Promise<void>;
  restartKiosk: (id: string) => Promise<void>;
  deleteKiosk: (id: string) => Promise<void>;
  loading: boolean;
}

const KioskContext = createContext<KioskContextType | undefined>(undefined);

export const KioskProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const { isAuthenticated } = useAuth();
  const [kiosks, setKiosks] = useState<Kiosk[]>([]);
  const [loading, setLoading] = useState(true);

  const mapKiosk = (item: any): Kiosk => ({
    ...item,
    id: String(item.id),
    name: item.name || 'Unnamed Kiosk',
    location: item.location || 'Unknown Location',
    base_price: item.base_price,
    status: item.status || 'offline',
    health: item.health || item.health_status || { printerInk: 100, storage: 0, camera: 'good' },
    config: item.config || item.config_settings || { brightness: 80, volume: 50, maintenanceMode: false },
    createdAt: item.createdAt || item.created_at || new Date().toISOString(),
    lastHeartbeat: item.lastHeartbeat || item.last_heartbeat || null
  });

  const fetchKiosks = async () => {
    try {
      setLoading(true);
      const res = await api.get("/admin/kiosks");
      const rawData = res.data?.data || res.data;
      setKiosks(Array.isArray(rawData) ? rawData.map(mapKiosk) : []);
    } catch (err) {
      console.error("Error fetching kiosks:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!isAuthenticated) {
      setLoading(false);
      return;
    }
    fetchKiosks();
  }, [isAuthenticated]);

  const addKiosk = async (kioskData: any): Promise<string | undefined> => {
    try {
      // Include id in payload as required by updated backend
      const { id, name, location, base_price } = kioskData;
      const res = await api.post("/admin/kiosks", { id, name, location, base_price });
      const newKiosk = res.data?.data || res.data;
      const apiKey = newKiosk?.api_key || res.data?.api_key || res.data?.data?.api_key;
      await fetchKiosks(); // re-fetch to get the server-generated kiosk
      return apiKey;
    } catch (err: any) {
      console.error("Error adding kiosk:", err);
      const msg = err.response?.data?.message || "Network error or failure while adding kiosk.";
      toast.error(msg);
      throw err;
    }
  };

  const updateKiosk = async (id: string, data: Partial<Kiosk>) => {
    // TODO: Wire up when PUT /admin/kiosks/:id endpoint is available
    console.warn('updateKiosk: No backend endpoint available yet. Applying locally.');
    setKiosks(prev => prev.map(k => k.id === id ? { ...k, ...data } : k));
  };

  const restartKiosk = async (id: string) => {
    // TODO: Wire up when POST /admin/kiosks/:id/restart endpoint is available
    console.warn('restartKiosk: No backend endpoint available yet. Simulating locally.');
    setKiosks(prev => prev.map(k => k.id === id ? { ...k, status: 'restarting' } : k));
    setTimeout(() => {
      setKiosks(prev => prev.map(k => k.id === id ? { ...k, status: 'online' } : k));
    }, 3200);
  };

  const deleteKiosk = async (id: string) => {
    // TODO: Wire up when DELETE /admin/kiosks/:id endpoint is available
    console.warn('deleteKiosk: No backend endpoint available yet. Removing locally.');
    setKiosks(prev => prev.filter(k => k.id !== id));
    toast.error("Kiosk Berhasil Dihapus", {
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
  };

  return (
    <KioskContext.Provider value={{ kiosks, fetchKiosks, addKiosk, updateKiosk, restartKiosk, deleteKiosk, loading }}>
      {children}
    </KioskContext.Provider>
  );
};

export const useKiosks = () => {
  const context = useContext(KioskContext);
  if (context === undefined) {
    throw new Error('useKiosks must be used within a KioskProvider');
  }
  return context;
};
