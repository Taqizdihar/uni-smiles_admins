import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { useAuth } from './components/AuthProvider';
import api from './lib/api';

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
  const { token, isAuthenticated } = useAuth();
  const [sessions, setSessions] = useState<Session[]>([]);
  const [loading, setLoading] = useState(true);

  // Fetch Sessions conditional on isAuthenticated
  useEffect(() => {
    if (!isAuthenticated) {
      setLoading(false);
      return;
    }
    async function fetchSessions() {
      try {
        const res = await api.get("/api/sessions");
        const data = res.data;
        setSessions(Array.isArray(data) ? data.map((item: any) => ({
          ...item,
          id: String(item.id),
          photos: Array.isArray(item.photos) ? item.photos : []
        })) : (data && Array.isArray(data.data) ? data.data.map((item: any) => ({
          ...item,
          id: String(item.id),
          photos: Array.isArray(item.photos) ? item.photos : []
        })) : []));
      } catch (err) {
        console.error("Error fetching sessions:", err);
      } finally {
        setLoading(false);
      }
    }
    fetchSessions();
  }, [isAuthenticated]);

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
