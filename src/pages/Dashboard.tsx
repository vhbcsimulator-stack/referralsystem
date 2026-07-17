import React, { useEffect, useState } from 'react';
import { 
  Users, 
  UserCheck, 
  Calendar, 
  TrendingUp, 
  TrendingDown, 
  BarChart3,
  ChevronLeft,
  ChevronRight,
  History,
  CheckCircle,
  XCircle,
  FileText
} from 'lucide-react';
import { 
  BarChart, 
  Bar, 
  XAxis, 
  YAxis, 
  Tooltip as ChartTooltip, 
  ResponsiveContainer,
  Cell
} from 'recharts';
import { supabase } from '../core/supabase';
import { useAuth } from '../context/AuthContext';
import { Shimmer } from '../components/Shimmer';

interface StatData {
  value: string;
  trend: number;
}

interface ListCardItem {
  title: string;
  subtitle: string;
}

interface ActivityLog {
  id: string;
  description: string;
  action_type: string;
  created_at: string;
  app_users?: {
    full_name: string;
  };
}

export const Dashboard: React.FC<{ onNavigate: (tabId: string) => void }> = ({ onNavigate }) => {
  const { profile } = useAuth();
  const isAdmin = profile?.role === 'admin';

  // Stats
  const [totalReferrers, setTotalReferrers] = useState<StatData>({ value: '...', trend: 0 });
  const [totalClients, setTotalClients] = useState<StatData>({ value: '...', trend: 0 });
  const [schedulesToday, setSchedulesToday] = useState<string>('...');
  const [totalClosedSales, setTotalClosedSales] = useState<StatData>({ value: '...', trend: 0 });

  // Lists
  const [upcomingSchedules, setUpcomingSchedules] = useState<ListCardItem[]>([]);
  const [latestReferrers, setLatestReferrers] = useState<ListCardItem[]>([]);
  const [latestClients, setLatestClients] = useState<ListCardItem[]>([]);
  
  // Charts
  const [chartData, setChartData] = useState<{ name: string; count: number }[]>([]);
  const [totalClosedSalesYear, setTotalClosedSalesYear] = useState(0);

  // Calendar
  const [selectedMonth, setSelectedMonth] = useState(new Date().getMonth() + 1); // 1-12
  const [selectedYear, setSelectedYear] = useState(new Date().getFullYear());

  // Activity Log
  const [activityLogs, setActivityLogs] = useState<ActivityLog[]>([]);

  // Loading
  const [isLoadingLists, setIsLoadingLists] = useState(true);
  const [isLoadingChart, setIsLoadingChart] = useState(true);
  const [isLoadingLogs, setIsLoadingLogs] = useState(true);

  // Fetch Dashboard Data
  useEffect(() => {
    const fetchStats = async () => {
      try {
        const now = new Date();
        const todayStr = now.toISOString().split('T')[0];
        const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
        const fourteenDaysAgo = new Date(now.getTime() - 14 * 24 * 60 * 60 * 1000);

        // Helper to calculate WoW trend
        const getTrend = async (table: string, filterCol?: string, filterVal?: string) => {
          try {
            let query = supabase.from(table).select('id, created_at');
            if (filterCol && filterVal) {
              if (filterVal === 'Closed Sale') {
                query = query.in(filterCol, ['Closed Sale', 'Closed Sale with CTS']);
              } else {
                query = query.eq(filterCol, filterVal);
              }
            }
            if (table === 'app_users') {
              // Exclude admin accounts
              query = query.or('id_card_url.neq.admin_portal_bypass,id_card_url.is.null');
            }

            const { data } = await query;
            if (!data) return 0;

            const currentCount = data.filter(item => {
              const date = new Date(item.created_at);
              return date >= sevenDaysAgo;
            }).length;

            const previousCount = data.filter(item => {
              const date = new Date(item.created_at);
              return date >= fourteenDaysAgo && date < sevenDaysAgo;
            }).length;

            if (previousCount === 0) return currentCount === 0 ? 0 : 100;
            return ((currentCount - previousCount) / previousCount) * 100;
          } catch {
            return 0;
          }
        };

        const statsPromises = [
          // Total Referrers
          supabase.from('app_users').select('id', { count: 'exact' }).or('id_card_url.neq.admin_portal_bypass,id_card_url.is.null').eq('role', 'referrer'),
          // Total Clients
          supabase.from('clients').select('id', { count: 'exact' }),
          // Schedules Today
          supabase.from('schedules').select('id', { count: 'exact' }).eq('schedule_date', todayStr).or('status.eq.Approved,status.eq.Rescheduled'),
          // Total Closed Sales
          supabase.from('clients').select('id', { count: 'exact' }).in('status', ['Closed Sale', 'Closed Sale with CTS']),
          // Trends
          getTrend('app_users', 'role', 'referrer'),
          getTrend('clients'),
          getTrend('clients', 'status', 'Closed Sale')
        ];

        const [
          referrersRes,
          clientsRes,
          schedulesRes,
          closedSalesRes,
          referrersTrend,
          clientsTrend,
          closedSalesTrend
        ] = await Promise.all(statsPromises) as any[];

        setTotalReferrers({ value: String(referrersRes.count || 0), trend: referrersTrend });
        setTotalClients({ value: String(clientsRes.count || 0), trend: clientsTrend });
        setSchedulesToday(String(schedulesRes.count || 0));
        setTotalClosedSales({ value: String(closedSalesRes.count || 0), trend: closedSalesTrend });
      } catch (err) {
        console.error('Error loading stats:', err);
      }
    };

    const fetchLists = async () => {
      setIsLoadingLists(true);
      try {
        const todayStr = new Date().toISOString().split('T')[0];

        const listPromises = [
          // 1. Upcoming Schedules (Approved/Rescheduled from today onwards)
          supabase
            .from('schedules')
            .select('*, app_users(full_name)')
            .or('status.eq.Approved,status.eq.Rescheduled')
            .gte('schedule_date', todayStr)
            .order('schedule_date', { ascending: true })
            .limit(3),
          // 2. Latest Verified Referrers
          supabase
            .from('app_users')
            .select('full_name, email, created_at')
            .eq('verification_status', 'verified')
            .or('id_card_url.neq.admin_portal_bypass,id_card_url.is.null')
            .order('created_at', { ascending: false })
            .limit(3),
          // 3. Latest Added Clients
          supabase
            .from('clients')
            .select('client_name, status, created_at')
            .order('created_at', { ascending: false })
            .limit(3)
        ];

        const [schedulesRes, referrersRes, clientsRes] = await Promise.all(listPromises);

        if (schedulesRes.data) {
          setUpcomingSchedules(
            schedulesRes.data.map((s: any) => ({
              title: s.app_users?.full_name || 'Unknown Referrer',
              subtitle: `${s.schedule_date}${s.schedule_time ? ` • ${s.schedule_time}` : ''}`
            }))
          );
        }

        if (referrersRes.data) {
          setLatestReferrers(
            referrersRes.data.map((r: any) => ({
              title: r.full_name || 'Unknown',
              subtitle: r.email || ''
            }))
          );
        }

        if (clientsRes.data) {
          setLatestClients(
            clientsRes.data.map((c: any) => ({
              title: c.client_name || 'Unknown',
              subtitle: c.status || ''
            }))
          );
        }
      } catch (err) {
        console.error('Error fetching list data:', err);
      } finally {
        setIsLoadingLists(false);
      }
    };

    const fetchChartData = async () => {
      setIsLoadingChart(true);
      try {
        const year = new Date().getFullYear();
        const startDate = `${year}-01-01`;
        const endDate = `${year}-12-31`;

        const { data, error } = await supabase
          .from('clients')
          .select('created_at')
          .in('status', ['Closed Sale', 'Closed Sale with CTS'])
          .gte('created_at', startDate)
          .lte('created_at', endDate);

        if (error) throw error;

        const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
        const tallies = Array(12).fill(0);

        if (data) {
          data.forEach(item => {
            const date = new Date(item.created_at);
            const m = date.getMonth(); // 0-11
            tallies[m]++;
          });
        }

        const formatted = months.map((m, index) => ({
          name: m,
          count: tallies[index]
        }));

        setChartData(formatted);
        setTotalClosedSalesYear(tallies.reduce((a, b) => a + b, 0));
      } catch (err) {
        console.error('Error fetching chart data:', err);
      } finally {
        setIsLoadingChart(false);
      }
    };

    const fetchActivityLogs = async () => {
      if (!isAdmin) {
        setIsLoadingLogs(false);
        return; // Non-admins can't select activity logs
      }
      setIsLoadingLogs(true);
      try {
        const { data, error } = await supabase
          .from('activity_logs')
          .select('*, app_users(full_name)')
          .order('created_at', { ascending: false })
          .limit(6);

        if (error) throw error;
        setActivityLogs(data as ActivityLog[]);
      } catch (err) {
        console.error('Error loading activity logs:', err);
      } finally {
        setIsLoadingLogs(false);
      }
    };

    fetchStats();
    fetchLists();
    fetchChartData();
    fetchActivityLogs();
  }, [isAdmin]);

  // Calendar logic
  const getDaysInMonth = (m: number, y: number) => {
    return new Date(y, m, 0).getDate();
  };

  const getFirstDayOffset = (m: number, y: number) => {
    // 0: Sunday, 1: Monday...
    return new Date(y, m - 1, 1).getDay();
  };

  const handlePrevMonth = () => {
    if (selectedMonth === 1) {
      setSelectedMonth(12);
      setSelectedYear(prev => prev - 1);
    } else {
      setSelectedMonth(prev => prev - 1);
    }
  };

  const handleNextMonth = () => {
    if (selectedMonth === 12) {
      setSelectedMonth(1);
      setSelectedYear(prev => prev + 1);
    } else {
      setSelectedMonth(prev => prev + 1);
    }
  };

  const renderCalendarDays = () => {
    const days: React.ReactNode[] = [];
    const daysInMonth = getDaysInMonth(selectedMonth, selectedYear);
    const offset = getFirstDayOffset(selectedMonth, selectedYear);
    const now = new Date();

    // Empty offset days
    for (let i = 0; i < offset; i++) {
      days.push(<div key={`empty-${i}`} className="calendar-day empty" />);
    }

    // Days in Month
    for (let day = 1; day <= daysInMonth; day++) {
      const isToday = 
        day === now.getDate() && 
        selectedMonth === (now.getMonth() + 1) && 
        selectedYear === now.getFullYear();

      days.push(
        <div key={`day-${day}`} className={`calendar-day ${isToday ? 'today' : ''}`}>
          <span>{day}</span>
        </div>
      );
    }

    return days;
  };

  // Activity Log Icon Helper
  const getActivityIcon = (type: string) => {
    switch (type) {
      case 'STATUS_CHANGE':
        return FileText;
      case 'SCHEDULE_APPROVED':
        return CheckCircle;
      case 'SCHEDULE_CANCELLED':
        return XCircle;
      case 'USER_VERIFIED':
        return UserCheck;
      default:
        return History;
    }
  };

  const getActivityIconClass = (type: string) => {
    switch (type) {
      case 'STATUS_CHANGE':
        return 'log-blue';
      case 'SCHEDULE_APPROVED':
        return 'log-green';
      case 'SCHEDULE_CANCELLED':
        return 'log-red';
      case 'USER_VERIFIED':
        return 'log-orange';
      default:
        return 'log-grey';
    }
  };

  const formatLogTime = (timestamp: string) => {
    try {
      const dt = new Date(timestamp);
      return `${dt.getMonth() + 1}/${dt.getDate()}/${dt.getFullYear()} ${dt.getHours().toString().padStart(2, '0')}:${dt.getMinutes().toString().padStart(2, '0')}`;
    } catch {
      return timestamp;
    }
  };

  return (
    <div className="dashboard-view-container fade-in">
      {/* Header Panel */}
      <div className="dashboard-header-bar flex-between">
        <div>
          <h1>Overview Dashboard</h1>
          <p className="subtitle">VHBC Sales Portal Metrics</p>
        </div>
      </div>

      {/* Summary Cards Grid */}
      <div className="stats-cards-grid mt-4">
        {/* Card 1: Total Referrers */}
        <div className="premium-card stat-card">
          <div className="stat-card-icon-wrapper bg-blue">
            <Users size={24} />
          </div>
          <div className="stat-card-details">
            <span className="stat-card-label">Total Referrers</span>
            <div className="stat-card-val-row">
              <h3>{totalReferrers.value}</h3>
              {totalReferrers.trend !== 0 && (
                <span className={`stat-card-trend ${totalReferrers.trend > 0 ? 'up' : 'down'}`}>
                  {totalReferrers.trend > 0 ? <TrendingUp size={14} /> : <TrendingDown size={14} />}
                  {Math.abs(Math.round(totalReferrers.trend))}%
                </span>
              )}
            </div>
          </div>
        </div>

        {/* Card 2: Total Clients */}
        <div className="premium-card stat-card">
          <div className="stat-card-icon-wrapper bg-blue">
            <Users size={24} className="opacity-80" />
          </div>
          <div className="stat-card-details">
            <span className="stat-card-label">Total Clients</span>
            <div className="stat-card-val-row">
              <h3>{totalClients.value}</h3>
              {totalClients.trend !== 0 && (
                <span className={`stat-card-trend ${totalClients.trend > 0 ? 'up' : 'down'}`}>
                  {totalClients.trend > 0 ? <TrendingUp size={14} /> : <TrendingDown size={14} />}
                  {Math.abs(Math.round(totalClients.trend))}%
                </span>
              )}
            </div>
          </div>
        </div>

        {/* Card 3: Schedule Today */}
        <div className="premium-card stat-card">
          <div className="stat-card-icon-wrapper bg-blue">
            <Calendar size={24} />
          </div>
          <div className="stat-card-details">
            <span className="stat-card-label">Schedule Today</span>
            <div className="stat-card-val-row">
              <h3>{schedulesToday}</h3>
            </div>
          </div>
        </div>

        {/* Card 4: Total Closed Sale (Highlighted Gradient Card) */}
        <div className="premium-card stat-card highlighted-gradient-card">
          <div className="stat-card-details">
            <span className="stat-card-label highlight-label">Total Closed Sale</span>
            <div className="stat-card-val-row">
              <h3 className="highlight-value">{totalClosedSales.value}</h3>
              {totalClosedSales.trend !== 0 && (
                <span className="stat-card-trend highlight-trend">
                  <TrendingUp size={14} />
                  {Math.abs(Math.round(totalClosedSales.trend))}%
                </span>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Row 2 Grid: Recharts Bar Chart & Upcoming Schedules */}
      <div className="dashboard-grid-row-2 mt-4">
        {/* Recharts Bar Chart Card */}
        <div className="premium-card chart-card">
          <div className="chart-card-header flex-between">
            <div>
              <span className="chart-label">Total Closed Sales (Yearly)</span>
              <h2>{isLoadingChart ? '...' : totalClosedSalesYear}</h2>
            </div>
            <div className="chart-header-icon">
              <BarChart3 size={20} />
            </div>
          </div>

          <div className="chart-body mt-4">
            {isLoadingChart ? (
              <Shimmer type="line" count={4} />
            ) : (
              <div style={{ width: '100%', height: 200 }}>
                <ResponsiveContainer>
                  <BarChart data={chartData} margin={{ top: 10, right: 0, left: -25, bottom: 0 }}>
                    <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fill: '#A3AED0', fontSize: 11, fontWeight: 'bold' }} />
                    <YAxis axisLine={false} tickLine={false} tick={{ fill: '#A3AED0', fontSize: 11, fontWeight: 'bold' }} />
                    <ChartTooltip 
                      cursor={{ fill: 'transparent' }}
                      contentStyle={{ background: '#2B3674', border: 'none', borderRadius: '8px', color: '#FFF' }}
                    />
                    <Bar dataKey="count" radius={[4, 4, 0, 0]}>
                      {chartData.map((_entry, index) => {
                        const currentMonthIndex = new Date().getMonth();
                        const isCurrentMonth = index === currentMonthIndex;
                        return (
                          <Cell 
                            key={`cell-${index}`} 
                            fill={isCurrentMonth ? '#FF8A5C' : 'rgba(163, 174, 208, 0.4)'} 
                          />
                        );
                      })}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
            )}
          </div>
        </div>

        {/* Upcoming Schedules List */}
        <div className="premium-card list-summary-card">
          <div className="list-card-header flex-between">
            <h2>Upcoming Schedule</h2>
            <button className="view-all-text-btn" onClick={() => onNavigate('schedules')}>
              View all
            </button>
          </div>
          
          <div className="list-card-body mt-4">
            {isLoadingLists ? (
              <Shimmer type="line" count={3} />
            ) : upcomingSchedules.length === 0 ? (
              <p className="no-items-placeholder">No upcoming schedules.</p>
            ) : (
              <div className="list-items-wrapper">
                {upcomingSchedules.map((item, idx) => (
                  <div key={idx} className="summary-list-item">
                    <div className="item-icon-circle blue" />
                    <div className="item-info">
                      <span className="item-title">{item.title}</span>
                      <span className="item-subtitle">{item.subtitle}</span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Row 3 Grid: Latest Verified Referrer, Latest Clients, Calendar */}
      <div className="dashboard-grid-row-3 mt-4">
        {/* Latest Verified Referrers */}
        <div className="premium-card list-summary-card">
          <div className="list-card-header flex-between">
            <h2>Latest Verified Referrer</h2>
            <button className="view-all-text-btn" onClick={() => onNavigate(isAdmin ? 'users' : 'leaderboard')}>
              View all
            </button>
          </div>
          
          <div className="list-card-body mt-4">
            {isLoadingLists ? (
              <Shimmer type="line" count={3} />
            ) : latestReferrers.length === 0 ? (
              <p className="no-items-placeholder">No verified referrers.</p>
            ) : (
              <div className="list-items-wrapper">
                {latestReferrers.map((item, idx) => (
                  <div key={idx} className="summary-list-item">
                    <div className="item-icon-circle green" />
                    <div className="item-info">
                      <span className="item-title">{item.title}</span>
                      <span className="item-subtitle">{item.subtitle}</span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Latest Added Clients */}
        <div className="premium-card list-summary-card">
          <div className="list-card-header flex-between">
            <h2>Latest Added Clients</h2>
            <button className="view-all-text-btn" onClick={() => onNavigate('clients')}>
              View all
            </button>
          </div>
          
          <div className="list-card-body mt-4">
            {isLoadingLists ? (
              <Shimmer type="line" count={3} />
            ) : latestClients.length === 0 ? (
              <p className="no-items-placeholder">No clients added.</p>
            ) : (
              <div className="list-items-wrapper">
                {latestClients.map((item, idx) => (
                  <div key={idx} className="summary-list-item">
                    <div className="item-icon-circle orange" />
                    <div className="item-info">
                      <span className="item-title">{item.title}</span>
                      <span className={`item-subtitle badge-status ${item.subtitle.toLowerCase().replace(' ', '-')}`}>
                        {item.subtitle}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Mini Calendar Card */}
        <div className="premium-card calendar-card">
          <div className="calendar-header flex-between">
            <button className="cal-nav-btn" onClick={handlePrevMonth}>
              <ChevronLeft size={18} />
            </button>
            <span className="calendar-title">
              {new Date(selectedYear, selectedMonth - 1).toLocaleString('default', { month: 'long' })} {selectedYear}
            </span>
            <button className="cal-nav-btn" onClick={handleNextMonth}>
              <ChevronRight size={18} />
            </button>
          </div>
          
          <div className="calendar-days-grid-header mt-4">
            <span>Su</span>
            <span>Mo</span>
            <span>Tu</span>
            <span>We</span>
            <span>Th</span>
            <span>Fr</span>
            <span>Sa</span>
          </div>

          <div className="calendar-days-grid">
            {renderCalendarDays()}
          </div>
        </div>
      </div>

      {/* Row 4: Recent Activities (Only for Admins) */}
      {isAdmin && (
        <div className="premium-card recent-activities-card mt-4">
          <div className="recent-activities-header flex-align-center gap-2">
            <History size={20} className="icon-blue" />
            <h2>Recent Activity</h2>
          </div>

          <div className="activities-list-container mt-4">
            {isLoadingLogs ? (
              <Shimmer type="line" count={4} />
            ) : activityLogs.length === 0 ? (
              <p className="no-items-placeholder">No activity logged.</p>
            ) : (
              <div className="activities-list">
                {activityLogs.map((log) => {
                  const LogIcon = getActivityIcon(log.action_type);
                  return (
                    <div key={log.id} className="activity-row flex-align-center">
                      <div className={`activity-icon-badge ${getActivityIconClass(log.action_type)}`}>
                        <LogIcon size={16} />
                      </div>
                      <div className="activity-details">
                        <p className="activity-desc">{log.description}</p>
                        <span className="activity-meta">
                          by {log.app_users?.full_name || 'System'} • {formatLogTime(log.created_at)}
                        </span>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};
