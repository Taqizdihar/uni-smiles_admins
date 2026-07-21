import React, { useState, useEffect } from 'react';
import { Monitor, History, DollarSign, Activity, AlertCircle } from 'lucide-react';
import { useAuth } from '../components/AuthProvider';
import api from '../lib/api';

export const Dashboard: React.FC = () => {
  const { user } = useAuth();
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [metrics, setMetrics] = useState({
    totalKiosks: 0,
    totalSessions: 0,
    totalRevenue: 0
  });

  useEffect(() => {
    const fetchDashboard = async () => {
      try {
        setIsLoading(true);
        setError(null);
        const res = await api.get('/admin/dashboard');
        const data = res.data?.data || res.data;
        setMetrics({
          totalKiosks: data?.total_kiosks ?? data?.totalKiosks ?? 0,
          totalSessions: data?.total_sessions ?? data?.totalSessions ?? 0,
          totalRevenue: data?.total_revenue ?? data?.totalRevenue ?? 0
        });
      } catch (err: any) {
        console.error('Dashboard fetch error:', err);
        setError(err?.response?.data?.message || 'Failed to load dashboard metrics.');
      } finally {
        setIsLoading(false);
      }
    };
    fetchDashboard();
  }, []);

  if (isLoading) {
    return (
      <div className="h-full min-h-[50vh] flex items-center justify-center">
        <div className="w-8 h-8 border-4 border-emerald-500 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-8 text-slate-200">
      <header>
        <h1 className="text-4xl font-black uppercase text-emerald-400">Dashboard</h1>
        <p className="text-slate-400 text-sm font-bold uppercase tracking-widest mt-1">Welcome back, {user?.full_name || user?.name}</p>
      </header>

      {error && (
        <div className="bg-red-500/10 border border-red-500/20 text-red-400 p-4 rounded-xl flex items-center gap-3">
          <AlertCircle className="w-5 h-5" />
          <span className="font-bold text-sm">{error}</span>
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="bg-slate-900 border border-emerald-500/20 p-6 rounded-2xl shadow-[0_0_20px_rgba(16,185,129,0.05)]">
          <div className="flex items-center gap-4 mb-4">
            <div className="p-3 bg-emerald-500/10 rounded-xl text-emerald-400">
              <Monitor className="w-6 h-6" />
            </div>
            <h3 className="text-sm font-black uppercase tracking-widest text-slate-400">Total Kiosks</h3>
          </div>
          <p className="text-4xl font-black text-emerald-400">{metrics.totalKiosks}</p>
        </div>

        <div className="bg-slate-900 border border-emerald-500/20 p-6 rounded-2xl shadow-[0_0_20px_rgba(16,185,129,0.05)]">
          <div className="flex items-center gap-4 mb-4">
            <div className="p-3 bg-emerald-500/10 rounded-xl text-emerald-400">
              <History className="w-6 h-6" />
            </div>
            <h3 className="text-sm font-black uppercase tracking-widest text-slate-400">Total Sessions</h3>
          </div>
          <p className="text-4xl font-black text-emerald-400">{metrics.totalSessions}</p>
        </div>

        <div className="bg-slate-900 border border-emerald-500/20 p-6 rounded-2xl shadow-[0_0_20px_rgba(16,185,129,0.05)]">
          <div className="flex items-center gap-4 mb-4">
            <div className="p-3 bg-emerald-500/10 rounded-xl text-emerald-400">
              <DollarSign className="w-6 h-6" />
            </div>
            <h3 className="text-sm font-black uppercase tracking-widest text-slate-400">Total Revenue</h3>
          </div>
          <p className="text-4xl font-black text-emerald-400">
            {new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', maximumFractionDigits: 0 }).format(metrics.totalRevenue)}
          </p>
        </div>
      </div>

      <div className="bg-slate-900 border border-emerald-500/20 p-8 rounded-2xl shadow-[0_0_20px_rgba(16,185,129,0.05)] flex flex-col items-center justify-center min-h-[300px]">
        <Activity className="w-12 h-12 text-slate-700 mb-4" />
        <h3 className="text-xl font-black uppercase text-slate-500 tracking-widest">Not enough data for charts</h3>
        <p className="text-sm font-bold text-slate-600 mt-2">Charts will be available once more sessions are recorded.</p>
      </div>
    </div>
  );
};
