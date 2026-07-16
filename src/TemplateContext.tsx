import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { toast } from 'sonner';
import { useAuth } from './components/AuthProvider';
import api from './lib/api';

export interface Template {
  id: string;
  name: string;
  category: string;
  imageUrl: string;
  status: 'active' | 'inactive';
  usageCount: number;
  createdAt?: any;
  updatedAt?: any;
  isDummy?: boolean;
}

interface TemplateContextType {
  templates: Template[];
  addTemplate: (template: Omit<Template, 'id' | 'usageCount'>) => Promise<void>;
  editTemplate: (id: string, updates: Partial<Template>) => Promise<void>;
  deleteTemplate: (id: string) => Promise<void>;
  loading: boolean;
}

const TemplateContext = createContext<TemplateContextType | undefined>(undefined);

export const TemplateProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const { token, isAuthenticated } = useAuth();
  const [templates, setTemplates] = useState<Template[]>([]);
  const [loading, setLoading] = useState(true);

  // Helper to parse dates from backend into the expected format
  const parseTemplate = (t: any): Template => ({
    id: String(t.id),
    name: t.name,
    category: t.category || 'General',
    imageUrl: t.imageUrl || t.thumbnail || '',
    status: t.status || (t.isActive ? 'active' : 'inactive'),
    usageCount: Number(t.usageCount ?? t.usage_count ?? 0),
    createdAt: t.createdAt ? { toDate: () => new Date(t.createdAt) } : { toDate: () => new Date() },
    updatedAt: t.updatedAt ? { toDate: () => new Date(t.updatedAt) } : undefined
  });

  // Fetch Templates conditional on isAuthenticated
  useEffect(() => {
    if (!isAuthenticated) {
      setLoading(false);
      return;
    }
    async function fetchTemplates() {
      try {
        const res = await api.get("/api/frame_templates");
        const data = res.data;
        setTemplates(Array.isArray(data) ? data.map(parseTemplate) : (data && Array.isArray(data.data) ? data.data.map(parseTemplate) : []));
      } catch (err) {
        console.error("Error fetching templates:", err);
      } finally {
        setLoading(false);
      }
    }
    fetchTemplates();
  }, [isAuthenticated]);

  const addTemplate = async (templateData: Omit<Template, 'id' | 'usageCount'>) => {
    try {
      const res = await api.post("/api/frame_templates", templateData);
      const newTemplate = res.data.data || res.data;
      setTemplates(prev => [parseTemplate(newTemplate), ...prev]);
    } catch (err) {
      console.error("Error adding template:", err);
      toast.error("Network error while adding template.");
    }
  };

  const editTemplate = async (id: string, updates: Partial<Template>) => {
    try {
      const res = await api.put(`/api/frame_templates/${id}`, updates);
      const updated = res.data.data || res.data;
      setTemplates(prev => prev.map(t => t.id === id ? parseTemplate(updated) : t));
    } catch (err) {
      console.error("Error editing template:", err);
    }
  };

  const deleteTemplate = async (id: string) => {
    try {
      await api.delete(`/api/frame_templates/${id}`);
      setTemplates(prev => prev.filter(t => t.id !== id));
    } catch (err) {
      console.error("Error deleting template:", err);
    }
  };

  return (
    <TemplateContext.Provider value={{ templates, addTemplate, editTemplate, deleteTemplate, loading }}>
      {children}
    </TemplateContext.Provider>
  );
};

export const useTemplate = () => {
  const context = useContext(TemplateContext);
  if (context === undefined) {
    throw new Error('useTemplate must be used within a TemplateProvider');
  }
  return context;
};
