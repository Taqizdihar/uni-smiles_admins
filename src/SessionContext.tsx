import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { useAuth } from './components/AuthProvider';

export interface Session {
  id: string;
  timestamp: string;
  template: string;
  photos: string[];
  amount: number;
  status: string;
}

interface SessionContextType {
  sessions: Session[];
  loading: boolean;
}

const SessionContext = createContext<SessionContextType | undefined>(undefined);

export const SessionProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const { token } = useAuth();
  const [sessions, setSessions] = useState<Session[]>([]);
  const [loading, setLoading] = useState(true);

  // Fetch Sessions on mount
  useEffect(() => {
    async function fetchSessions() {
      try {
        const activeToken = token || localStorage.getItem('unismiles_token') || localStorage.getItem('token') || '';
        const res = await fetch("/api/sessions", {
          headers: activeToken ? { Authorization: `Bearer ${activeToken}` } : {}
        });
        if (res.ok) {
          const data = await res.json();
          setSessions(Array.isArray(data) ? data.map((item: any) => ({
            ...item,
            id: String(item.id),
            photos: Array.isArray(item.photos) ? item.photos : []
          })) : []);
        }
      } catch (err) {
        console.error("Error fetching sessions:", err);
      } finally {
        setLoading(false);
      }
    }
    fetchSessions();
  }, [token]);

  return (
    <SessionContext.Provider value={{ sessions, loading }}>
      {children}
    </SessionContext.Provider>
  );
};

export const useSession = () => {
  const context = useContext(SessionContext);
  if (context === undefined) {
    throw new Error('useSession must be used within a SessionProvider');
  }
  return context;
};
