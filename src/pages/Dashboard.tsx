import React, { useState, useEffect } from 'react';
import { 
  Printer, 
  DollarSign, 
  Activity, 
  Star,
  ArrowUpRight,
  ArrowDownRight,
  Monitor
} from 'lucide-react';
import { 
  AreaChart, 
  Area, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell
} from 'recharts';
import { motion } from 'motion/react';
import { cn } from '../lib/utils';
import { useAuth } from '../components/AuthProvider';
import { toast } from 'sonner';
import api from '../lib/api';

const COLORS = ['#FFB800', '#FF6B00', '#F1F5F9', '#475569', '#3B82F6'];

interface DashboardProps {
  onNavigate?: (tab: string) => void;
}

export const Dashboard: React.FC<DashboardProps> = () => {
  const { user, logout, isAuthenticated } = useAuth();
  const [range, setRange] = useState<'7' | '30' | '90'>('30');
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [isUnauthorized, setIsUnauthorized] = useState<boolean>(false);

  useEffect(() => {
    if (!isAuthenticated) {
      setLoading(false);
      return;
    }
    let active = true;
    async function fetchAnalytics() {
      setLoading(true);
      try {
        const res = await api.get(`/api/analytics?range=${range}`);
        const resData = res.data;
        if (active) {
          setData(resData);
          setIsUnauthorized(false);
        }
      } catch (err: any) {
        if (err.response && err.response.status === 401) {
          if (active) {
            setIsUnauthorized(true);
            setData(null);
          }
          toast.error("Session unauthorized. Please log in again.");
        } else {
          console.error("Error loading analytics:", err);
          toast.error("Failed to load dashboard analytics");
        }
      } finally {
        if (active) {
          setLoading(false);
        }
      }
    }
    fetchAnalytics();
    return () => {
      active = false;
    };
  }, [range, isAuthenticated]);

  const rangeLabel = range === '7' ? 'this week' : range === '30' ? 'this month' : 'last 90 days';

  if (loading) {
    return (
      <div className="h-[calc(100vh-12rem)] flex items-center justify-center bg-[#020617] p-8 rounded-[3.5rem] border border-white/5">
        <div className="flex flex-col items-center gap-4">
          <div className="w-12 h-12 border-4 border-primary border-t-transparent rounded-full animate-spin shadow-[0_0_15px_rgba(255,184,0,0.2)]" />
          <p className="text-[10px] font-black text-primary uppercase tracking-[0.3em] animate-pulse">Loading Analytics Data...</p>
        </div>
      </div>
    );
  }

  if (isUnauthorized) {
    return (
      <div className="h-[calc(100vh-12rem)] flex flex-col items-center justify-center text-center space-y-6 animate-in fade-in zoom-in duration-500 bg-[#020617] p-8 rounded-[3.5rem] border border-white/5">
        <div className="w-24 h-24 bg-red-500/10 border border-red-500/20 rounded-3xl flex items-center justify-center rotate-12">
          <Activity className="w-12 h-12 text-red-400 -rotate-12" />
        </div>
        <div className="max-w-md space-y-4">
          <h1 className="text-3xl font-black tracking-tighter uppercase leading-none text-foreground">401 Unauthorized</h1>
          <p className="text-muted text-[10px] font-black uppercase tracking-widest mt-2">Your session has expired or is invalid. Please sign in again to view operations intelligence.</p>
          <button
            onClick={() => {
              if (logout) logout();
            }}
            className="px-8 py-3 bg-primary text-[#10172A] rounded-2xl font-black text-xs uppercase tracking-widest hover:opacity-90 transition-all cursor-pointer"
          >
            Log In Again
          </button>
        </div>
      </div>
    );
  }

  if (!data || !data.hasData) {
    return (
      <div className="h-[calc(100vh-12rem)] flex flex-col items-center justify-center text-center space-y-6 animate-in fade-in zoom-in duration-500 bg-[#020617] p-8 rounded-[3.5rem] border border-white/5">
        <div className="w-24 h-24 bg-white/5 border border-white/10 rounded-3xl flex items-center justify-center rotate-12">
          <Activity className="w-12 h-12 text-primary -rotate-12" />
        </div>
        <div className="max-w-md">
          <h1 className="text-3xl font-black tracking-tighter uppercase leading-none text-foreground">No session data available yet</h1>
          <p className="text-muted text-[10px] font-black uppercase tracking-widest mt-2">Check back later once kiosks start capturing photo sessions.</p>
        </div>
      </div>
    );
  }

  const statsList = [
    { 
      label: 'Total Sessions', 
      value: data.stats.totalSessions.value.toLocaleString(), 
      icon: Activity, 
      change: `${data.stats.totalSessions.growth >= 0 ? '+' : ''}${data.stats.totalSessions.growth}%`, 
      trend: data.stats.totalSessions.trend 
    },
    { 
      label: 'Photos Printed', 
      value: data.stats.photosPrinted.value.toLocaleString(), 
      icon: Printer, 
      change: `${data.stats.photosPrinted.growth >= 0 ? '+' : ''}${data.stats.photosPrinted.growth}%`, 
      trend: data.stats.photosPrinted.trend 
    },
    { 
      label: 'Revenue Today', 
      value: `Rp ${data.stats.revenueToday.value.toLocaleString('id-ID')}`, 
      icon: DollarSign, 
      change: `${data.stats.revenue.growth >= 0 ? '+' : ''}${data.stats.revenue.growth}%`, 
      trend: data.stats.revenue.trend 
    },
    { 
      label: 'Active Kiosks', 
      value: `${data.activeKiosks.online}/${data.activeKiosks.total}`, 
      icon: Monitor, 
      change: 'Stable', 
      trend: 'neutral' 
    },
  ];

  return (
    <div className="space-y-8 animate-in fade-in duration-500">
      <header className="mb-8 border-b border-white/5 pb-6">
        <div>
          <h1 className="text-5xl font-black tracking-tighter uppercase leading-[0.8] mb-2 text-primary">Dashboard</h1>
          <p className="text-muted text-[10px] font-black uppercase tracking-[0.3em] opacity-60">Operations Intelligence — {user?.displayName || user?.name || 'Admin'}</p>
        </div>
      </header>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {statsList.map((stat, i) => (
          <motion.div 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.1 }}
            key={stat.label} 
            className="bg-[#1E293B] border border-white/5 p-6 rounded-3xl group transition-all duration-500 hover:border-primary/30 shadow-xl"
          >
            <div className="flex justify-between items-start">
              <div className="p-3 bg-white/5 rounded-2xl group-hover:bg-primary/10 transition-colors">
                <stat.icon className="w-6 h-6 text-primary" />
              </div>
              <div className={cn(
                "flex items-center gap-1 text-[10px] font-black px-2.5 py-1 rounded-full tracking-widest uppercase",
                stat.trend === 'up' ? "bg-emerald-500/10 text-emerald-400 border border-emerald-500/20" : 
                stat.trend === 'down' ? "bg-red-500/10 text-red-400 border border-red-500/20" : "bg-white/5 text-muted border border-white/5"
              )}>
                {stat.trend === 'up' && <ArrowUpRight className="w-3 h-3" />}
                {stat.trend === 'down' && <ArrowDownRight className="w-3 h-3" />}
                {stat.change}
              </div>
            </div>
            <div className="mt-4">
              <h3 className="text-muted text-[10px] font-black uppercase tracking-[0.2em]">{stat.label}</h3>
              <p className="text-3xl font-black mt-1 tracking-tighter text-foreground">{stat.value}</p>
            </div>
          </motion.div>
        ))}
      </div>

      {/* Charts Bento Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 bg-[#1E293B] border border-white/5 p-8 rounded-3xl shadow-xl">
          <div className="flex justify-between items-center mb-8">
            <h3 className="font-black text-xl tracking-tighter uppercase">Revenue Overview</h3>
            <select 
              value={range}
              onChange={(e) => setRange(e.target.value as any)}
              className="bg-black/20 border border-white/10 rounded-xl px-4 py-2 text-[10px] font-black uppercase tracking-widest outline-none text-muted focus:border-primary/50 transition-all cursor-pointer"
            >
              <option value="7" className="bg-[#1E293B]">Last 7 Days</option>
              <option value="30" className="bg-[#1E293B]">Last 30 Days</option>
              <option value="90" className="bg-[#1E293B]">Last 90 Days</option>
            </select>
          </div>
          <div className="h-[300px] w-full">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={data.revenueChart}>
                <defs>
                  <linearGradient id="colorValue" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#FFB800" stopOpacity={0.3}/>
                    <stop offset="95%" stopColor="#FFB800" stopOpacity={0}/>
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(255, 184, 0, 0.05)" vertical={false} />
                <XAxis 
                  dataKey="name" 
                  stroke="currentColor" 
                  className="text-muted"
                  fontSize={10} 
                  tickLine={false} 
                  axisLine={false} 
                  dy={10}
                  tickFormatter={(value) => {
                    try {
                      const parts = value.split('-');
                      const months = ['Jan', 'Feb', 'Mar', 'Apr', 'Mei', 'Jun', 'Jul', 'Agu', 'Sep', 'Okt', 'Nov', 'Des'];
                      return `${parts[2]} ${months[parseInt(parts[1]) - 1]}`;
                    } catch {
                      return value;
                    }
                  }}
                />
                <YAxis 
                  stroke="currentColor" 
                  className="text-muted"
                  fontSize={10} 
                  tickLine={false} 
                  axisLine={false}
                  tickFormatter={(value) => `Rp ${value >= 1000000 ? (value/1000000).toFixed(1) + 'jt' : (value/1000).toFixed(0) + 'rb'}`}
                />
                <Tooltip 
                  formatter={(value: any) => [`Rp ${value.toLocaleString('id-ID')}`, 'Revenue']}
                  contentStyle={{ 
                    backgroundColor: '#1E293B', 
                    border: '1px solid rgba(255, 184, 0, 0.2)', 
                    borderRadius: '16px', 
                    boxShadow: '0 10px 30px rgba(0,0,0,0.5)',
                    color: '#F1F5F9'
                  }}
                  itemStyle={{ color: '#FFB800' }}
                />
                <Area 
                  type="monotone" 
                  dataKey="value" 
                  stroke="#FFB800" 
                  strokeWidth={4}
                  fillOpacity={1} 
                  fill="url(#colorValue)" 
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="bg-[#1E293B] border border-white/5 p-8 rounded-3xl shadow-xl flex flex-col">
          <h3 className="font-black text-xl tracking-tighter uppercase mb-8">Popularity</h3>
          <div className="flex-1 flex flex-col justify-center">
            {data.popularityChart.length > 0 ? (
              <>
                <div className="h-[200px] w-full">
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie
                        data={data.popularityChart}
                        cx="50%"
                        cy="50%"
                        innerRadius={60}
                        outerRadius={80}
                        paddingAngle={8}
                        dataKey="value"
                      >
                        {data.popularityChart.map((entry: any, index: number) => (
                          <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} stroke="transparent" />
                        ))}
                      </Pie>
                      <Tooltip 
                        formatter={(value: any) => [`${value}%`, 'Popularity']}
                        contentStyle={{ 
                          backgroundColor: '#1E293B', 
                          border: '1px solid rgba(255, 184, 0, 0.2)', 
                          borderRadius: '16px',
                          color: '#F1F5F9'
                        }}
                      />
                    </PieChart>
                  </ResponsiveContainer>
                </div>
                <div className="space-y-3 mt-8">
                  {data.popularityChart.map((item: any, i: number) => (
                    <div key={item.name} className="flex items-center justify-between text-[10px] font-black uppercase tracking-widest">
                      <div className="flex items-center gap-3">
                        <div className="w-2 h-2 rounded-full shadow-[0_0_8px_currentColor]" style={{ backgroundColor: COLORS[i % COLORS.length], color: COLORS[i % COLORS.length] }} />
                        <span className="text-muted">{item.name}</span>
                      </div>
                      <span className="text-foreground">{item.value}%</span>
                    </div>
                  ))}
                </div>
              </>
            ) : (
              <p className="text-muted text-[10px] text-center font-bold uppercase py-10">No template data this period</p>
            )}
          </div>
        </div>
      </div>

      {/* Bottom Row */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-[#1E293B] border border-white/5 p-8 rounded-3xl shadow-xl">
          <div className="flex justify-between items-center mb-8">
            <h3 className="font-black text-xl tracking-tighter uppercase">Kiosk Status</h3>
          </div>
          <div className="space-y-4">
            {data.kioskStatus.map((kiosk: any) => (
              <div key={kiosk.id} className="flex items-center justify-between p-5 bg-black/20 rounded-2xl border border-white/5 hover:border-primary/30 transition-all group">
                <div className="flex items-center gap-4">
                  <div className={cn(
                    "w-3 h-3 rounded-full animate-pulse shadow-[0_0_8px_currentColor]",
                    kiosk.status === 'online' ? "bg-emerald-400 text-emerald-400" : 
                    kiosk.status === 'idle' ? "bg-amber-400 text-amber-400" : 
                    kiosk.status === 'restarting' ? "bg-blue-400 text-blue-400 animate-pulse" : "bg-red-400 text-red-400"
                  )} />
                  <div>
                    <h4 className="font-black text-sm tracking-tight uppercase text-foreground">{kiosk.name}</h4>
                    <p className="text-[10px] text-muted font-black uppercase tracking-widest">{kiosk.location}</p>
                  </div>
                </div>
                <div className="text-right">
                  <p className="text-[10px] font-black uppercase tracking-widest text-primary">{kiosk.status}</p>
                  <p className="text-[10px] text-muted/60 font-bold uppercase mt-0.5">
                    {kiosk.lastSeen}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="bg-[#1E293B] border border-white/5 p-8 rounded-3xl shadow-xl flex flex-col justify-center items-center text-center space-y-6">
          <div className="w-20 h-20 bg-primary/10 rounded-3xl flex items-center justify-center shadow-xl rotate-12">
            <Star className="w-10 h-10 text-primary -rotate-12" />
          </div>
          <div>
            <h3 className="font-black text-2xl tracking-tighter uppercase">Top Template</h3>
            {data.topTemplate ? (
              <>
                <p className="text-xl font-black tracking-tight text-foreground uppercase mt-2">{data.topTemplate.name}</p>
                <p className="text-muted mt-1 font-bold">Used {data.topTemplate.usageCount} times {rangeLabel}!</p>
              </>
            ) : (
              <p className="text-muted mt-1 font-bold">No template usage in this period.</p>
            )}
          </div>
          {data.topTemplate && (
            <div className="w-full max-w-[180px] aspect-[3/4] rounded-2xl overflow-hidden border-2 border-primary/20 shadow-2xl rotate-3 transition-transform hover:rotate-0 duration-500">
               <img 
                 src={
                   data.topTemplate.name.includes("Graduation") ? "https://picsum.photos/seed/graduation/400/600" :
                   data.topTemplate.name.includes("Wedding") ? "https://picsum.photos/seed/wedding/400/600" :
                   data.topTemplate.name.includes("Birthday") ? "https://picsum.photos/seed/bdayframe/400/600" :
                   data.topTemplate.name.includes("Corporate") ? "https://picsum.photos/seed/corporate/400/600" :
                   "https://picsum.photos/seed/retro/400/600"
                 } 
                 alt="Top Template" 
                 className="w-full h-full object-cover" 
               />
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
