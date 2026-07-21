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
    // TODO: Wire up when GET /admin/sessions endpoint is available
    // No admin sessions endpoint exists in the current API.
    // Setting empty state to avoid 404 errors.
    setSessions([]);
    setLoading(false);
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
