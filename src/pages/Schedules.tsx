import React, { useEffect, useState } from 'react';
import { 
  Search, 
  Calendar as CalendarIcon, 
  List as ListIcon, 
  Inbox, 
  ChevronLeft, 
  ChevronRight, 
  X, 
  Video,
  MapPin,
  Clock,
  User,
  Phone,
  Mail,
  ExternalLink
} from 'lucide-react';
import { supabase } from '../core/supabase';
import { Shimmer } from '../components/Shimmer';
import { EmptyState } from '../components/EmptyState';
import { ActivityService } from '../services/activityService';
import { NotificationService } from '../services/notificationService';
import { useAuth } from '../context/AuthContext';

interface Schedule {
  id: string;
  referrer_id: string;
  client_name: string;
  client_email: string;
  client_number: string;
  schedule_date: string;
  schedule_time: string;
  platform: 'Google Meet' | 'Zoom' | 'In-person';
  status: 'Pending' | 'Approved' | 'Cancelled' | 'Rescheduled' | 'Reserved';
  meeting_link?: string;
  created_at: string;
  app_users?: {
    full_name: string;
    email: string;
    mobile_number: string;
  };
}

export const Schedules: React.FC = () => {
  const { profile } = useAuth();
  const isAdmin = profile?.role === 'admin';

  const [approvedSchedules, setApprovedSchedules] = useState<Schedule[]>([]);
  const [pendingRequests, setPendingRequests] = useState<Schedule[]>([]);
  
  const [isLoadingAll, setIsLoadingAll] = useState(true);
  const [isLoadingRequests, setIsLoadingRequests] = useState(true);

  // Layout toggles
  const [isCalendarView, setIsCalendarView] = useState(false);
  const [isPanelOpen, setIsPanelOpen] = useState(false);

  // Search & Filters
  const [searchText, setSearchText] = useState('');

  // Dialog State
  const [selectedSchedule, setSelectedSchedule] = useState<Schedule | null>(null);
  const [meetingLinkInput, setMeetingLinkInput] = useState('');
  const [isActionLoading, setIsActionLoading] = useState(false);

  // Calendar State
  const [calendarMonth, setCalendarMonth] = useState(new Date().getMonth() + 1); // 1-12
  const [calendarYear, setCalendarYear] = useState(new Date().getFullYear());
  const [selectedCalendarDay, setSelectedCalendarDay] = useState<number | null>(null);

  const fetchAllSchedules = async () => {
    setIsLoadingAll(true);
    try {
      // Fetch approved schedules
      const { data, error } = await supabase
        .from('schedules')
        .select('*, app_users(full_name)')
        .eq('status', 'Approved')
        .order('schedule_date', { ascending: false });

      if (error) throw error;
      setApprovedSchedules(data as Schedule[]);
    } catch (err) {
      console.error('Error fetching approved schedules:', err);
    } finally {
      setIsLoadingAll(false);
    }
  };

  const fetchPendingRequests = async () => {
    setIsLoadingRequests(true);
    try {
      // Fetch pending or rescheduled requests
      const { data, error } = await supabase
        .from('schedules')
        .select('*, app_users (full_name, email, mobile_number)')
        .or('status.eq.Pending,status.eq.Rescheduled')
        .order('created_at', { ascending: false });

      if (error) throw error;
      setPendingRequests(data as Schedule[]);
    } catch (err) {
      console.error('Error fetching schedule requests:', err);
    } finally {
      setIsLoadingRequests(false);
    }
  };

  useEffect(() => {
    fetchAllSchedules();
    fetchPendingRequests();

    // Subscribe to real-time updates on schedules table
    const channel = supabase
      .channel('schedules_realtime')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'schedules' },
        () => {
          fetchAllSchedules();
          fetchPendingRequests();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  // Filtered approved list
  const filteredSchedules = approvedSchedules.filter(s => {
    if (searchText) {
      const q = searchText.toLowerCase();
      const clientName = (s.client_name || '').toLowerCase();
      const referrerName = (s.app_users?.full_name || '').toLowerCase();
      const date = (s.schedule_date || '').toLowerCase();
      return clientName.includes(q) || referrerName.includes(q) || date.includes(q);
    }
    return true;
  });

  // Action handlers
  const handleApprove = async (schedule: Schedule) => {
    setIsActionLoading(true);
    try {
      const enteredLink = meetingLinkInput.trim();

      // 1. Update schedule status to Approved
      const { error: scheduleErr } = await supabase
        .from('schedules')
        .update({
          status: 'Approved',
          meeting_link: enteredLink || schedule.meeting_link || ''
        })
        .eq('id', schedule.id);

      if (scheduleErr) throw scheduleErr;

      // 2. Upsert client row
      const referrerName = schedule.app_users?.full_name || 'Unknown Referrer';
      const { error: clientErr } = await supabase
        .from('clients')
        .upsert({
          schedule_id: schedule.id,
          client_name: schedule.client_name,
          client_email: schedule.client_email,
          contact_no: schedule.client_number,
          referrer_name: referrerName,
          meeting_link: enteredLink || schedule.meeting_link || '',
          status: 'for tripping' // newly approved pipeline starts with 'for tripping'
        }, { onConflict: 'schedule_id' });

      if (clientErr) throw clientErr;

      // 3. Notify referrer
      await NotificationService.notifyUser({
        userId: schedule.referrer_id,
        title: 'Schedule Approved',
        message: `Your schedule request for client ${schedule.client_name} on ${schedule.schedule_date} has been approved.`,
        type: 'schedule_approved',
        entityId: schedule.id
      });

      // 4. Log activity
      await ActivityService.logActivity({
        actionType: ActivityService.actionScheduleApproved,
        entityType: ActivityService.entitySchedule,
        entityId: schedule.id,
        description: `Approved schedule request for client ${schedule.client_name} by referrer ${referrerName}`,
        metadata: {
          client_name: schedule.client_name,
          referrer_name: referrerName,
          platform: schedule.platform,
          meeting_link: enteredLink || schedule.meeting_link || ''
        }
      });

      setSelectedSchedule(null);
      setMeetingLinkInput('');
      fetchPendingRequests();
      fetchAllSchedules();
    } catch (err) {
      console.error('Error approving schedule:', err);
    } finally {
      setIsActionLoading(false);
    }
  };

  const handleCancel = async (schedule: Schedule) => {
    setIsActionLoading(true);
    try {
      const referrerName = schedule.app_users?.full_name || 'Unknown Referrer';

      // 1. Update schedule status to Cancelled
      const { error } = await supabase
        .from('schedules')
        .update({ status: 'Cancelled' })
        .eq('id', schedule.id);

      if (error) throw error;

      // 2. Notify Referrer
      await NotificationService.notifyUser({
        userId: schedule.referrer_id,
        title: 'Schedule Request Rejected',
        message: `Your schedule request for client ${schedule.client_name} on ${schedule.schedule_date} has been rejected.`,
        type: 'status_change',
        entityId: schedule.id
      });

      // 3. Log Activity
      await ActivityService.logActivity({
        actionType: ActivityService.actionScheduleCancelled,
        entityType: ActivityService.entitySchedule,
        entityId: schedule.id,
        description: `Rejected schedule request for client ${schedule.client_name} by referrer ${referrerName}`,
        metadata: {
          client_name: schedule.client_name,
          referrer_name: referrerName
        }
      });

      setSelectedSchedule(null);
      fetchPendingRequests();
      fetchAllSchedules();
    } catch (err) {
      console.error('Error cancelling schedule:', err);
    } finally {
      setIsActionLoading(false);
    }
  };

  // Calendar Utilities
  const getDaysInMonth = (m: number, y: number) => new Date(y, m, 0).getDate();
  const getFirstDayOffset = (m: number, y: number) => new Date(y, m - 1, 1).getDay();

  const handlePrevMonth = () => {
    if (calendarMonth === 1) {
      setCalendarMonth(12);
      setCalendarYear(prev => prev - 1);
    } else {
      setCalendarMonth(prev => prev - 1);
    }
    setSelectedCalendarDay(null);
  };

  const handleNextMonth = () => {
    if (calendarMonth === 12) {
      setCalendarMonth(1);
      setCalendarYear(prev => prev + 1);
    } else {
      setCalendarMonth(prev => prev + 1);
    }
    setSelectedCalendarDay(null);
  };

  const getSchedulesForDate = (day: number) => {
    const formattedDate = `${calendarYear}-${String(calendarMonth).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
    return approvedSchedules.filter(s => s.schedule_date === formattedDate);
  };

  const renderCalendar = () => {
    const daysInMonth = getDaysInMonth(calendarMonth, calendarYear);
    const offset = getFirstDayOffset(calendarMonth, calendarYear);
    const cells: React.ReactNode[] = [];

    // Empty offsets
    for (let i = 0; i < offset; i++) {
      cells.push(<div key={`empty-${i}`} className="calendar-grid-cell empty" />);
    }

    // Days list
    for (let day = 1; day <= daysInMonth; day++) {
      const daySchedules = getSchedulesForDate(day);
      const hasSchedules = daySchedules.length > 0;
      const isSelected = selectedCalendarDay === day;

      cells.push(
        <div 
          key={`day-${day}`} 
          className={`calendar-grid-cell day ${hasSchedules ? 'has-events' : ''} ${isSelected ? 'selected' : ''}`}
          onClick={() => hasSchedules && setSelectedCalendarDay(day)}
        >
          <span className="day-number">{day}</span>
          {hasSchedules && (
            <div className="event-indicators">
              {daySchedules.slice(0, 2).map((s, i) => (
                <div key={i} className="event-dot" title={s.client_name} />
              ))}
              {daySchedules.length > 2 && <div className="event-dot plus" />}
            </div>
          )}
        </div>
      );
    }

    return cells;
  };

  const selectedDaySchedules = selectedCalendarDay ? getSchedulesForDate(selectedCalendarDay) : [];

  return (
    <div className="main-view-container fade-in">
      {/* Title Header */}
      <div className="view-header-row flex-between">
        <div>
          <h1>Schedule Management</h1>
          <p className="subtitle">Tripping appointments and schedule requests</p>
        </div>

        {/* Action Controls Toolbar */}
        <div className="filter-controls-row flex-align-center gap-2">
          {/* Search approved schedules */}
          <div className="search-input-wrapper">
            <Search size={18} className="search-icon" />
            <input
              type="text"
              className="form-control-search"
              placeholder="Search schedules..."
              value={searchText}
              onChange={(e) => setSearchText(e.target.value)}
            />
          </div>

          {/* Toggle View Mode Buttons */}
          <button 
            className={`btn btn-secondary btn-sm-padding flex-align-center ${!isCalendarView ? 'active-btn' : ''}`}
            onClick={() => setIsCalendarView(false)}
          >
            <ListIcon size={16} />
            <span className="ml-1">List</span>
          </button>
          
          <button 
            className={`btn btn-secondary btn-sm-padding flex-align-center ${isCalendarView ? 'active-btn' : ''}`}
            onClick={() => setIsCalendarView(true)}
          >
            <CalendarIcon size={16} />
            <span className="ml-1">Calendar</span>
          </button>


        </div>
      </div>

      {/* Main Container Layout */}
      <div className="schedules-view-content mt-4">
        {/* Toggle List View */}
        {!isCalendarView ? (
          <div className="table-card premium-card">
            {isLoadingAll ? (
              <Shimmer type="table" count={5} />
            ) : filteredSchedules.length === 0 ? (
              <EmptyState 
                title="No schedules found" 
                message="There are no approved site tripping schedules." 
                icon={Inbox}
              />
            ) : (
              <div className="table-wrapper">
                <table className="premium-table">
                  <thead>
                    <tr>
                      <th>Client Name</th>
                      <th>Referrer</th>
                      <th>Date</th>
                      <th>Time</th>
                      <th>Platform</th>
                      <th>Meeting Link</th>
                      <th>Action</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredSchedules.map((schedule) => (
                      <tr key={schedule.id}>
                        <td>
                          <span className="user-table-name">{schedule.client_name}</span>
                        </td>
                        <td>{schedule.app_users?.full_name}</td>
                        <td>{schedule.schedule_date}</td>
                        <td>{schedule.schedule_time}</td>
                        <td>
                          <span className="flex-align-center gap-1">
                            {schedule.platform === 'In-person' ? <MapPin size={14} /> : <Video size={14} />}
                            {schedule.platform}
                          </span>
                        </td>
                        <td>
                          {schedule.meeting_link ? (
                            <a 
                              href={schedule.meeting_link} 
                              target="_blank" 
                              rel="noreferrer"
                              className="meeting-link-anchor flex-align-center gap-1"
                            >
                              <span>Join Tripping</span>
                              <ExternalLink size={12} />
                            </a>
                          ) : (
                            <span className="text-light-grey">N/A</span>
                          )}
                        </td>
                        <td>
                          <button 
                            className="btn btn-secondary btn-sm-padding inline-view-btn"
                            onClick={() => {
                              setSelectedSchedule(schedule);
                              setMeetingLinkInput(schedule.meeting_link || '');
                            }}
                          >
                            Details
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        ) : (
          /* Toggle Calendar View */
          <div className="calendar-view-container">
            <div className="calendar-panel-grid">
              {/* The big calendar */}
              <div className="premium-card calendar-large">
                <div className="calendar-header flex-between">
                  <button className="cal-nav-btn" onClick={handlePrevMonth}>
                    <ChevronLeft size={20} />
                  </button>
                  <span className="calendar-title-large">
                    {new Date(calendarYear, calendarMonth - 1).toLocaleString('default', { month: 'long' })} {calendarYear}
                  </span>
                  <button className="cal-nav-btn" onClick={handleNextMonth}>
                    <ChevronRight size={20} />
                  </button>
                </div>

                <div className="calendar-large-days-header mt-4">
                  <span>Sun</span>
                  <span>Mon</span>
                  <span>Tue</span>
                  <span>Wed</span>
                  <span>Thu</span>
                  <span>Fri</span>
                  <span>Sat</span>
                </div>

                <div className="calendar-large-grid mt-2">
                  {renderCalendar()}
                </div>
              </div>

              {/* Side list of schedules for the selected day */}
              <div className="premium-card calendar-details-side">
                <h2>Tripping Details</h2>
                {selectedCalendarDay ? (
                  <div className="mt-4">
                    <span className="selected-day-label">
                      Schedules for {new Date(calendarYear, calendarMonth - 1, selectedCalendarDay).toLocaleDateString(undefined, { weekday: 'long', month: 'short', day: 'numeric' })}
                    </span>
                    
                    <div className="selected-day-list mt-4">
                      {selectedDaySchedules.map(s => (
                        <div key={s.id} className="day-schedule-card">
                          <div className="flex-between">
                            <span className="day-sched-client">{s.client_name}</span>
                            <span className="day-sched-time flex-align-center gap-1">
                              <Clock size={12} /> {s.schedule_time}
                            </span>
                          </div>
                          <p className="day-sched-referrer">by {s.app_users?.full_name}</p>
                          <span className="day-sched-platform flex-align-center gap-1 mt-2">
                            {s.platform === 'In-person' ? <MapPin size={12} /> : <Video size={12} />}
                            {s.platform}
                          </span>
                          {s.meeting_link && (
                            <a href={s.meeting_link} target="_blank" rel="noreferrer" className="day-sched-link mt-2 flex-align-center gap-1">
                              <span>Join Link</span>
                              <ExternalLink size={12} />
                            </a>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                ) : (
                  <p className="no-items-placeholder mt-4">Select a highlighted day to view details.</p>
                )}
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Hovering Orange Side Button */}
      <div 
        className="schedules-hover-side-btn"
        style={{
          position: 'fixed',
          top: '50%',
          right: isPanelOpen ? '400px' : '0px',
          transform: 'translateY(-50%)',
          zIndex: 1002,
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          cursor: 'pointer',
          transition: 'right 0.3s cubic-bezier(0.4, 0, 0.2, 1)'
        }}
        onClick={() => setIsPanelOpen(!isPanelOpen)}
      >
        {pendingRequests.length > 0 && (
          <div className="hover-btn-badge animate-bounce">
            {pendingRequests.length}
          </div>
        )}
        <div className="hover-btn-tab">
          {isPanelOpen ? (
            <ChevronRight size={24} />
          ) : (
            <ChevronLeft size={24} />
          )}
        </div>
      </div>

      {/* Slide-out Requests panel drawer */}
      {isPanelOpen && (
        <>
          <div className="notification-panel-backdrop" onClick={() => setIsPanelOpen(false)} />
          <div className="notification-panel open">
            <div className="notification-panel-header">
              <div className="flex-align-center gap-2">
                <h2>Schedule Requests</h2>
                {pendingRequests.length > 0 && (
                  <span className="notification-unread-count">{pendingRequests.length}</span>
                )}
              </div>
              <button className="panel-close-btn" onClick={() => setIsPanelOpen(false)}>
                <X size={20} />
              </button>
            </div>

            <div className="notification-list-container">
              {isLoadingRequests ? (
                <div className="panel-center"><div className="spinner" /></div>
              ) : pendingRequests.length === 0 ? (
                <div className="panel-center empty">
                  <Inbox size={48} className="empty-icon" />
                  <p>No pending schedule requests</p>
                </div>
              ) : (
                <div className="notification-list">
                  {pendingRequests.map((req) => {
                    const isResched = req.status === 'Rescheduled';
                    return (
                      <div 
                        key={req.id} 
                        className="notification-item request-item"
                        onClick={() => {
                          setSelectedSchedule(req);
                          setMeetingLinkInput(req.meeting_link || '');
                        }}
                      >
                        <div className={`notification-icon-bg ${isResched ? 'type-verification' : 'type-request'}`}>
                          <Clock size={18} />
                        </div>
                        <div className="notification-content">
                          <span className="req-type-pill">
                            {isResched ? 'RESCHEDULE REQUEST' : 'TRIPPING REQUEST'}
                          </span>
                          <span className="notification-title">{req.client_name}</span>
                          <p className="notification-message">Requested by {req.app_users?.full_name}</p>
                          <span className="notification-time">{req.schedule_date} • {req.schedule_time}</span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        </>
      )}

      {/* Schedule Detail / Action Modal Dialog */}
      {selectedSchedule && (
        <div className="modal-backdrop">
          <div className="modal-card">
            <div className="modal-header flex-between">
              <h2>Schedule Details</h2>
              <button className="panel-close-btn" onClick={() => setSelectedSchedule(null)}>
                <X size={20} />
              </button>
            </div>

            <div className="modal-body mt-4">
              {/* Detailed Rows */}
              <div className="details-grid">
                <div className="details-section-header">Referrer Information</div>
                <div className="details-row">
                  <span className="details-label flex-align-center gap-1"><User size={14} /> Name</span>
                  <span className="details-val">{selectedSchedule.app_users?.full_name || 'System'}</span>
                </div>
                <div className="details-row">
                  <span className="details-label flex-align-center gap-1"><Mail size={14} /> Email</span>
                  <span className="details-val">{selectedSchedule.app_users?.email || 'N/A'}</span>
                </div>
                <div className="details-row">
                  <span className="details-label flex-align-center gap-1"><Phone size={14} /> Contact No.</span>
                  <span className="details-val">{selectedSchedule.app_users?.mobile_number || 'N/A'}</span>
                </div>

                <div className="details-section-header mt-4">Tripping Details</div>
                <div className="details-row">
                  <span className="details-label flex-align-center gap-1"><User size={14} /> Client Name</span>
                  <span className="details-val">{selectedSchedule.client_name}</span>
                </div>
                <div className="details-row">
                  <span className="details-label flex-align-center gap-1"><Mail size={14} /> Client Email</span>
                  <span className="details-val">{selectedSchedule.client_email || 'N/A'}</span>
                </div>
                <div className="details-row">
                  <span className="details-label flex-align-center gap-1"><Phone size={14} /> Contact No.</span>
                  <span className="details-val">{selectedSchedule.client_number || 'N/A'}</span>
                </div>
                <div className="details-row">
                  <span className="details-label flex-align-center gap-1"><CalendarIcon size={14} /> Date & Time</span>
                  <span className="details-val">{selectedSchedule.schedule_date} • {selectedSchedule.schedule_time}</span>
                </div>
                <div className="details-row">
                  <span className="details-label flex-align-center gap-1"><Video size={14} /> Platform</span>
                  <span className="details-val">{selectedSchedule.platform}</span>
                </div>

                {/* Meeting Link Entry field for Admins (if schedule is Pending/Rescheduled) */}
                {isAdmin && (selectedSchedule.status === 'Pending' || selectedSchedule.status === 'Rescheduled') ? (
                  <div className="form-group mt-4">
                    <label htmlFor="modalMeetingLink">Meeting Link (Google Meet / Zoom)</label>
                    <input
                      id="modalMeetingLink"
                      type="text"
                      className="form-control"
                      placeholder="Paste meeting link here"
                      value={meetingLinkInput}
                      onChange={(e) => setMeetingLinkInput(e.target.value)}
                    />
                  </div>
                ) : selectedSchedule.meeting_link ? (
                  <div className="details-row mt-4">
                    <span className="details-label flex-align-center gap-1"><Video size={14} /> Meeting Link</span>
                    <a 
                      href={selectedSchedule.meeting_link} 
                      target="_blank" 
                      rel="noreferrer" 
                      className="meeting-link-anchor flex-align-center gap-1"
                    >
                      {selectedSchedule.meeting_link}
                      <ExternalLink size={12} />
                    </a>
                  </div>
                ) : null}
              </div>
            </div>

            {/* Actions for Admins on Requests */}
            {isAdmin && (selectedSchedule.status === 'Pending' || selectedSchedule.status === 'Rescheduled') && (
              <div className="modal-footer mt-4 flex-align-center gap-2">
                <button 
                  className="btn btn-secondary w-full" 
                  onClick={() => handleCancel(selectedSchedule)}
                  disabled={isActionLoading}
                >
                  Reject
                </button>
                <button 
                  className="btn btn-primary w-full" 
                  onClick={() => handleApprove(selectedSchedule)}
                  disabled={isActionLoading}
                >
                  {isActionLoading ? <div className="spinner-btn" /> : 'Approve'}
                </button>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};
