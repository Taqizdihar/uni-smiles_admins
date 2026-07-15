import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { toast } from 'sonner';
import { Trash2 } from 'lucide-react';
import { useAuth } from './components/AuthProvider';

export interface Kiosk {
  id: string;
  name: string;
  location: string;
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
}

interface KioskContextType {
  kiosks: Kiosk[];
  addKiosk: (kiosk: Omit<Kiosk, 'id' | 'status' | 'health'>) => Promise<void>;
  updateKiosk: (id: string, data: Partial<Kiosk>) => Promise<void>;
  restartKiosk: (id: string) => Promise<void>;
  deleteKiosk: (id: string) => Promise<void>;
  loading: boolean;
}

const KioskContext = createContext<KioskContextType | undefined>(undefined);

export const KioskProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const { token } = useAuth();
  const [kiosks, setKiosks] = useState<Kiosk[]>([]);
  const [loading, setLoading] = useState(true);

  const mapKiosk = (item: any): Kiosk => ({
    ...item,
    id: String(item.id),
    status: item.status || 'offline',
    health: item.health || item.health_status || { printerInk: 100, storage: 0, camera: 'good' },
    config: item.config || item.config_settings || { brightness: 80, volume: 50, maintenanceMode: false },
    createdAt: item.createdAt || item.created_at || new Date().toISOString(),
    lastHeartbeat: item.lastHeartbeat || item.last_heartbeat || null
  });

  const getAuthHeaders = () => {
    const activeToken = token || localStorage.getItem('unismiles_token') || localStorage.getItem('token') || '';
    return activeToken ? { Authorization: `Bearer ${activeToken}` } : {};
  };

  // Fetch Kiosks on mount
  useEffect(() => {
    async function fetchKiosks() {
      try {
        const res = await fetch("/api/kiosks", {
          headers: getAuthHeaders()
        });
        if (res.ok) {
          const data = await res.json();
          setKiosks(Array.isArray(data) ? data.map(mapKiosk) : []);
        } else {
          console.error("Failed to fetch kiosks from backend");
        }
      } catch (err) {
        console.error("Error fetching kiosks:", err);
      } finally {
        setLoading(false);
      }
    }
    fetchKiosks();
  }, [token]);

  const addKiosk = async (kioskData: Omit<Kiosk, 'id' | 'status' | 'health'>) => {
    try {
      const res = await fetch("/api/kiosks", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...getAuthHeaders()
        },
        body: JSON.stringify(kioskData)
      });
      if (res.ok) {
        const newKiosk = await res.json();
        setKiosks(prev => [...prev, mapKiosk(newKiosk)]);
      } else {
        toast.error("Failed to add kiosk to backend.");
      }
    } catch (err) {
      console.error("Error adding kiosk:", err);
      toast.error("Network error while adding kiosk.");
    }
  };

  const updateKiosk = async (id: string, data: Partial<Kiosk>) => {
    try {
      const res = await fetch(`/api/kiosks/${id}`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          ...getAuthHeaders()
        },
        body: JSON.stringify(data)
      });
      if (res.ok) {
        const updated = await res.json();
        setKiosks(prev => prev.map(k => k.id === id ? mapKiosk(updated) : k));
      } else {
        console.error("Failed to update kiosk");
      }
    } catch (err) {
      console.error("Error updating kiosk:", err);
    }
  };

  const restartKiosk = async (id: string) => {
    try {
      // 1. Set status to RESTARTING locally for instant UI response
      setKiosks(prev => prev.map(k => k.id === id ? { ...k, status: 'restarting' } : k));
      
      const res = await fetch(`/api/kiosks/${id}/restart`, {
        method: "POST",
        headers: getAuthHeaders()
      });
      if (res.ok) {
        // Poll backend after 3.2s to sync online state
        setTimeout(async () => {
          const syncRes = await fetch("/api/kiosks", {
            headers: getAuthHeaders()
          });
          if (syncRes.ok) {
            const synced = await syncRes.json();
            setKiosks(Array.isArray(synced) ? synced.map(mapKiosk) : []);
          }
        }, 3200);
      } else {
        toast.error("Failed to initiate restart sequence.");
      }
    } catch (err) {
      console.error("Error restarting kiosk:", err);
    }
  };

  const deleteKiosk = async (id: string) => {
    try {
      const res = await fetch(`/api/kiosks/${id}`, {
        method: "DELETE",
        headers: getAuthHeaders()
      });
      if (res.ok) {
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
      } else {
        toast.error("Gagal menghapus kiosk.");
      }
    } catch (err) {
      console.error("Error deleting kiosk:", err);
      toast.error("Error koneksi saat menghapus kiosk.");
    }
  };

  return (
    <KioskContext.Provider value={{ kiosks, addKiosk, updateKiosk, restartKiosk, deleteKiosk, loading }}>
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
