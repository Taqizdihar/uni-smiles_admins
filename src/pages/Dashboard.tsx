import React, { useMemo } from 'react';
import { Monitor, History, DollarSign, BarChart3, Loader2 } from 'lucide-react';
import {
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { useAuth } from '../components/AuthProvider';
import { useKiosks } from '../KioskContext';
import { useSession } from '../SessionContext';

const formatCurrency = (amount: number) => new Intl.NumberFormat('id-ID', {
  style: 'currency',
  currency: 'IDR',
  maximumFractionDigits: 0,
}).format(amount);

const getSessionDate = (timestamp: unknown) => {
  if (timestamp && typeof (timestamp as { toDate?: () => Date }).toDate === 'function') {
    return (timestamp as { toDate: () => Date }).toDate();
  }

  const date = new Date(timestamp as string);
  return Number.isNaN(date.getTime()) ? null : date;
};

export const Dashboard: React.FC = () => {
  const { user } = useAuth();
  const { kiosks, loading: kiosksLoading } = useKiosks();
  const { sessions, loading: sessionsLoading } = useSession();

  const { totalRevenue, dailySessions } = useMemo(() => {
    const sessionsByDate = new Map<string, { date: Date; sessions: number }>();
    let revenue = 0;

    sessions.forEach((session) => {
      // Amount berasal dari data sesi yang sama dengan halaman Session Repository.
      revenue += Number(session.amount) || 0;

      const date = getSessionDate(session.timestamp);
      if (!date) return;

      const dateKey = `${date.getFullYear()}-${date.getMonth()}-${date.getDate()}`;
      const summary = sessionsByDate.get(dateKey);
      if (summary) {
        summary.sessions += 1;
      } else {
        sessionsByDate.set(dateKey, { date, sessions: 1 });
      }
    });

    return {
      totalRevenue: revenue,
      dailySessions: Array.from(sessionsByDate.values())
        .sort((a, b) => a.date.getTime() - b.date.getTime())
        .slice(-7)
        .map(({ date, sessions }) => ({
          day: date.toLocaleDateString('id-ID', { day: '2-digit', month: 'short' }),
          sessions,
        })),
    };
  }, [sessions]);

  if (kiosksLoading || sessionsLoading) {
    return (
      <div className="h-full min-h-[50vh] flex items-center justify-center">
        <Loader2 className="w-9 h-9 text-emerald-400 animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-8 text-slate-200">
      <header>
        <h1 className="text-4xl font-black uppercase text-emerald-400">Dashboard</h1>
        <p className="text-slate-400 text-sm font-bold uppercase tracking-widest mt-1">
          Welcome back, {user?.full_name || user?.name}
        </p>
      </header>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <MetricCard icon={Monitor} label="Total Kiosks" value={kiosks.length.toLocaleString('id-ID')} />
        <MetricCard icon={History} label="Total Sessions" value={sessions.length.toLocaleString('id-ID')} />
        <MetricCard icon={DollarSign} label="Total Revenue" value={formatCurrency(totalRevenue)} />
      </div>

      <section className="bg-slate-900 border border-emerald-500/20 p-6 md:p-8 rounded-2xl shadow-[0_0_20px_rgba(16,185,129,0.05)]">
        <div className="flex items-start gap-3 mb-6">
          <div className="p-2.5 bg-emerald-500/10 rounded-xl text-emerald-400">
            <BarChart3 className="w-5 h-5" />
          </div>
          <div>
            <h2 className="text-lg font-black uppercase tracking-wide text-slate-100">Ringkasan Sesi Photobooth</h2>
            <p className="text-sm text-slate-400 mt-1">Jumlah sesi yang tercatat per hari (maks. 7 hari terakhir).</p>
          </div>
        </div>

        {dailySessions.length ? (
          <div className="h-[280px] w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={dailySessions} margin={{ top: 10, right: 12, left: -20, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#ffffff12" vertical={false} />
                <XAxis dataKey="day" stroke="#94a3b8" fontSize={12} tickLine={false} axisLine={false} />
                <YAxis allowDecimals={false} stroke="#94a3b8" fontSize={12} tickLine={false} axisLine={false} />
                <Tooltip
                  cursor={{ fill: 'rgba(16, 185, 129, 0.08)' }}
                  contentStyle={{ background: '#0f172a', border: '1px solid rgba(52, 211, 153, 0.3)', borderRadius: '12px' }}
                  labelStyle={{ color: '#cbd5e1' }}
                  itemStyle={{ color: '#34d399', fontWeight: 700 }}
                  formatter={(value) => [`${value} sesi`, 'Total sesi']}
                />
                <Bar dataKey="sessions" fill="#34d399" radius={[8, 8, 0, 0]} maxBarSize={56} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        ) : (
          <div className="h-[280px] flex flex-col items-center justify-center text-center">
            <BarChart3 className="w-10 h-10 text-slate-600 mb-3" />
            <p className="font-bold text-slate-400">Belum ada sesi photobooth untuk ditampilkan.</p>
          </div>
        )}
      </section>
    </div>
  );
};

const MetricCard: React.FC<{ icon: React.ElementType; label: string; value: string }> = ({ icon: Icon, label, value }) => (
  <div className="bg-slate-900 border border-emerald-500/20 p-6 rounded-2xl shadow-[0_0_20px_rgba(16,185,129,0.05)]">
    <div className="flex items-center gap-4 mb-4">
      <div className="p-3 bg-emerald-500/10 rounded-xl text-emerald-400">
        <Icon className="w-6 h-6" />
      </div>
      <h3 className="text-sm font-black uppercase tracking-widest text-slate-400">{label}</h3>
    </div>
    <p className="text-4xl font-black text-emerald-400">{value}</p>
  </div>
);
