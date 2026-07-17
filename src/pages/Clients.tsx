import React, { useEffect, useState } from 'react';
import { 
  Search, 
  Download, 
  ChevronLeft, 
  ChevronRight, 
  UserMinus
} from 'lucide-react';
import { supabase } from '../core/supabase';
import { Shimmer } from '../components/Shimmer';
import { EmptyState } from '../components/EmptyState';
import { ActivityService } from '../services/activityService';

interface Client {
  id: string;
  schedule_id?: string;
  client_name: string;
  client_email: string;
  contact_no: string;
  referrer_name: string;
  status: string;
  created_at: string;
  updated_at: string;
}

const STATUS_CHOICES = [
  'Done Tripping',
  'Reserved',
  'Closed Sale',
  'Closed Sale with CTS',
  'Cancelled',
  'Rescheduled',
  'Not Interested',
];

export const Clients: React.FC = () => {
  const [clients, setClients] = useState<Client[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  // Filters
  const [searchText, setSearchText] = useState('');
  const [selectedReferrer, setSelectedReferrer] = useState('All Referrers');
  const [selectedStatus, setSelectedStatus] = useState('All Statuses');

  // Inline Loader
  const [updatingIds, setUpdatingIds] = useState<Set<string>>(new Set());

  // Pagination
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 30;

  const fetchClients = async () => {
    setIsLoading(true);
    try {
      const { data, error } = await supabase
        .from('clients')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) throw error;

      // Deduplicate by schedule_id - same logic as Flutter
      const seen = new Set<string>();
      const deduped: Client[] = [];
      (data || []).forEach((client: any) => {
        const scheduleId = client.schedule_id || '';
        const key = scheduleId ? scheduleId : `no_schedule_${deduped.length}`;
        if (!seen.has(key)) {
          seen.add(key);
          deduped.push(client);
        }
      });

      setClients(deduped);
    } catch (err) {
      console.error('Error loading clients:', err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchClients();
  }, []);

  // Update Status Inline Handler
  const handleUpdateStatus = async (clientId: string, newStatus: string) => {
    setUpdatingIds(prev => {
      const next = new Set(prev);
      next.add(clientId);
      return next;
    });

    try {
      const clientRow = clients.find(c => c.id === clientId);
      if (!clientRow) return;

      const oldStatus = clientRow.status || 'Pending';
      const clientName = clientRow.client_name || 'Unknown';

      // 1. Update the client status
      const { error: clientErr } = await supabase
        .from('clients')
        .update({ status: newStatus })
        .eq('id', clientId);

      if (clientErr) throw clientErr;

      // 2. Synchronize schedule status if schedule_id exists
      const scheduleId = clientRow.schedule_id;
      if (scheduleId) {
        try {
          await supabase
            .from('schedules')
            .update({ status: newStatus })
            .eq('id', scheduleId);
        } catch (err) {
          console.warn('Failed to sync status to schedules table:', err);
        }
      }

      // 3. Log audit activity
      await ActivityService.logActivity({
        actionType: ActivityService.actionStatusChange,
        entityType: ActivityService.entityClient,
        entityId: clientId,
        description: `Updated client ${clientName} status from "${oldStatus}" to "${newStatus}"`,
        metadata: {
          old_status: oldStatus,
          new_status: newStatus,
          client_name: clientName,
        }
      });

      // 4. Update local state
      setClients(prev => 
        prev.map(c => c.id === clientId ? { ...c, status: newStatus } : c)
      );
    } catch (err) {
      console.error('Error updating status:', err);
    } finally {
      setUpdatingIds(prev => {
        const next = new Set(prev);
        next.delete(clientId);
        return next;
      });
    }
  };

  // Dynamically populated filter lists
  const referrerOptions = [
    'All Referrers',
    ...Array.from(new Set(clients.map(c => c.referrer_name).filter(Boolean))).sort()
  ];

  const statusOptions = [
    'All Statuses',
    ...Array.from(new Set(clients.map(c => c.status).filter(Boolean))).sort()
  ];

  // Filters Logic
  const filteredClients = clients.filter(c => {
    if (searchText) {
      const q = searchText.toLowerCase();
      const match = 
        c.client_name.toLowerCase().includes(q) ||
        c.client_email.toLowerCase().includes(q) ||
        c.contact_no.toLowerCase().includes(q);
      if (!match) return false;
    }

    if (selectedReferrer !== 'All Referrers') {
      if (c.referrer_name !== selectedReferrer) return false;
    }

    if (selectedStatus !== 'All Statuses') {
      if (c.status !== selectedStatus) return false;
    }

    return true;
  });

  // Pagination Logic
  const totalPages = Math.ceil(filteredClients.length / itemsPerPage) || 1;
  const paginatedClients = filteredClients.slice(
    (currentPage - 1) * itemsPerPage,
    currentPage * itemsPerPage
  );

  const handlePageChange = (newPage: number) => {
    if (newPage >= 1 && newPage <= totalPages) {
      setCurrentPage(newPage);
    }
  };

  // CSV Export Logic
  const handleExtractCSV = () => {
    const headers = ['Name', 'Email Address', 'Contact No', 'Referrer/Agent', 'Status'];
    const csvRows = [headers.join(',')];

    filteredClients.forEach(c => {
      const row = [
        `"${c.client_name.replace(/"/g, '""')}"`,
        `"${c.client_email.replace(/"/g, '""')}"`,
        `"${c.contact_no.replace(/"/g, '""')}"`,
        `"${c.referrer_name.replace(/"/g, '""')}"`,
        c.status
      ];
      csvRows.push(row.join(','));
    });

    const csvContent = csvRows.join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute('download', `clients_extract_${new Date().toISOString().split('T')[0]}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // Icon mapping depending on Status
  const getStatusBadgeClass = (status: string) => {
    switch (status) {
      case 'Closed Sale':
      case 'Closed Sale with CTS':
        return 'badge-success';
      case 'Cancelled':
      case 'Not Interested':
        return 'badge-danger';
      case 'Pending':
      case 'Rescheduled':
        return 'badge-warning';
      default:
        return 'badge-info';
    }
  };

  return (
    <div className="main-view-container fade-in">
      {/* Title Header */}
      <div className="view-header-row flex-between">
        <div>
          <h1>Client Management</h1>
          <p className="subtitle">Track referred client pipelines</p>
        </div>

        {/* Filter Toolbar */}
        <div className="filter-controls-row flex-align-center gap-2">
          {/* Search bar */}
          <div className="search-input-wrapper">
            <Search size={18} className="search-icon" />
            <input
              type="text"
              className="form-control-search"
              placeholder="Search client details..."
              value={searchText}
              onChange={(e) => {
                setSearchText(e.target.value);
                setCurrentPage(1);
              }}
            />
          </div>

          {/* Referrer Selector */}
          <select 
            className="filter-select"
            value={selectedReferrer}
            onChange={(e) => {
              setSelectedReferrer(e.target.value);
              setCurrentPage(1);
            }}
          >
            {referrerOptions.map((opt, i) => (
              <option key={i} value={opt}>{opt}</option>
            ))}
          </select>

          {/* Status Selector */}
          <select 
            className="filter-select"
            value={selectedStatus}
            onChange={(e) => {
              setSelectedStatus(e.target.value);
              setCurrentPage(1);
            }}
          >
            {statusOptions.map((opt, i) => (
              <option key={i} value={opt}>{opt}</option>
            ))}
          </select>

          {/* Export CSV button */}
          <button className="btn btn-primary btn-sm-padding" onClick={handleExtractCSV}>
            <Download size={16} />
            <span>Extract</span>
          </button>

          {/* Pagination Controls */}
          <div className="pagination-bar flex-align-center">
            <button 
              className="pagination-btn" 
              onClick={() => handlePageChange(currentPage - 1)}
              disabled={currentPage === 1}
            >
              <ChevronLeft size={16} />
            </button>
            <span className="pagination-indicator">{currentPage} / {totalPages}</span>
            <button 
              className="pagination-btn" 
              onClick={() => handlePageChange(currentPage + 1)}
              disabled={currentPage === totalPages}
            >
              <ChevronRight size={16} />
            </button>
          </div>
        </div>
      </div>

      {/* Main Table Content */}
      <div className="table-card premium-card mt-4">
        {isLoading ? (
          <Shimmer type="table" count={5} />
        ) : paginatedClients.length === 0 ? (
          <EmptyState 
            title="No clients found" 
            message="No clients matched your criteria or search inputs." 
            icon={UserMinus}
          />
        ) : (
          <div className="table-wrapper">
            <table className="premium-table">
              <thead>
                <tr>
                  <th>Client Name</th>
                  <th>Email Address</th>
                  <th>Contact No.</th>
                  <th>Referrer / Agent</th>
                  <th>Status</th>
                  <th>Action</th>
                </tr>
              </thead>
              <tbody>
                {paginatedClients.map((client) => {
                  const isUpdating = updatingIds.has(client.id);
                  return (
                    <tr key={client.id}>
                      <td>
                        <span className="user-table-name">{client.client_name}</span>
                      </td>
                      <td>{client.client_email}</td>
                      <td>{client.contact_no}</td>
                      <td>
                        <span className="referrer-agent-label">{client.referrer_name}</span>
                      </td>
                      <td>
                        <span className={`badge ${getStatusBadgeClass(client.status)}`}>
                          {client.status}
                        </span>
                      </td>
                      <td>
                        <div className="flex-align-center gap-2">
                          <select
                            className="inline-status-select"
                            value={client.status}
                            onChange={(e) => handleUpdateStatus(client.id, e.target.value)}
                            disabled={isUpdating}
                          >
                            <option value={client.status} disabled>{client.status} (Current)</option>
                            {STATUS_CHOICES.filter(s => s !== client.status).map((choice, i) => (
                              <option key={i} value={choice}>{choice}</option>
                            ))}
                          </select>
                          {isUpdating && <div className="spinner-btn-dark animate-spin" />}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
};
