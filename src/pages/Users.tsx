import React, { useEffect, useState } from 'react';
import { 
  Search, 
  Download, 
  ChevronLeft, 
  ChevronRight, 
  UserMinus,
  CheckCircle2,
  AlertCircle
} from 'lucide-react';
import { supabase } from '../core/supabase';
import { Shimmer } from '../components/Shimmer';
import { EmptyState } from '../components/EmptyState';

interface UserData {
  id: string;
  name: string;
  email: string;
  contactNo: string;
  referredClientCount: number;
  status: 'Active' | 'Inactive';
  rawStatus: string;
}

export const Users: React.FC = () => {
  const [users, setUsers] = useState<UserData[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  // Filters
  const [searchText, setSearchText] = useState('');
  const [selectedStatus, setSelectedStatus] = useState('Status');
  const [selectedReferredClients, setSelectedReferredClients] = useState('Referred Client');

  // Pagination
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 30;

  const fetchUsers = async () => {
    setIsLoading(true);
    try {
      // 1. Fetch referrers from app_users
      const { data: usersResponse, error: usersErr } = await supabase
        .from('app_users')
        .select('id, full_name, email, mobile_number, verification_status, created_at')
        .eq('role', 'referrer')
        .order('created_at', { ascending: false });

      if (usersErr) throw usersErr;

      // 2. Fetch clients to calculate referral count
      const { data: clientsResponse, error: clientsErr } = await supabase
        .from('clients')
        .select('referrer_name');

      if (clientsErr) throw clientsErr;

      // Map referral counts by referrer name
      const referralCounts: Record<string, number> = {};
      clientsResponse?.forEach(client => {
        const name = client.referrer_name || '';
        if (name) {
          referralCounts[name] = (referralCounts[name] || 0) + 1;
        }
      });

      // Combine datasets
      const loaded: UserData[] = (usersResponse || []).map(row => {
        const name = row.full_name || 'Unknown';
        const isVerified = row.verification_status === 'verified';
        return {
          id: row.id,
          name,
          email: row.email || 'No Email',
          contactNo: row.mobile_number || 'No Number',
          referredClientCount: referralCounts[name] || 0,
          status: isVerified ? 'Active' : 'Inactive',
          rawStatus: row.verification_status || 'not_verified'
        };
      });

      setUsers(loaded);
    } catch (err) {
      console.error('Error fetching users:', err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchUsers();
  }, []);

  // Filtered Users Logic
  const filteredUsers = users.filter(user => {
    // Search filter
    if (searchText) {
      const q = searchText.toLowerCase();
      const match = 
        user.name.toLowerCase().includes(q) ||
        user.email.toLowerCase().includes(q) ||
        user.contactNo.toLowerCase().includes(q);
      if (!match) return false;
    }

    // Status filter
    if (selectedStatus !== 'Status') {
      if (user.status !== selectedStatus) return false;
    }

    // Referral count filter
    if (selectedReferredClients !== 'Referred Client') {
      const count = user.referredClientCount;
      if (selectedReferredClients === '0' && count !== 0) return false;
      if (selectedReferredClients === '1 to 5' && (count < 1 || count > 5)) return false;
      if (selectedReferredClients === '6-10' && (count < 6 || count > 10)) return false;
      if (selectedReferredClients === '11 above' && count < 11) return false;
    }

    return true;
  });

  // Pagination Logic
  const totalPages = Math.ceil(filteredUsers.length / itemsPerPage) || 1;
  const paginatedUsers = filteredUsers.slice(
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
    const headers = ['Name', 'Email Address', 'Contact No', 'Referred Clients', 'Status'];
    const csvRows = [headers.join(',')];

    filteredUsers.forEach(user => {
      const row = [
        `"${user.name.replace(/"/g, '""')}"`,
        `"${user.email.replace(/"/g, '""')}"`,
        `"${user.contactNo.replace(/"/g, '""')}"`,
        user.referredClientCount,
        user.status
      ];
      csvRows.push(row.join(','));
    });

    const csvContent = csvRows.join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute('download', `referrers_extract_${new Date().toISOString().split('T')[0]}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="main-view-container fade-in">
      {/* Title Header */}
      <div className="view-header-row flex-between">
        <div>
          <h1>User Management</h1>
          <p className="subtitle">View and filter referrer profiles</p>
        </div>

        {/* Top filter controls */}
        <div className="filter-controls-row flex-align-center gap-2">
          {/* Search Input */}
          <div className="search-input-wrapper">
            <Search size={18} className="search-icon" />
            <input
              type="text"
              className="form-control-search"
              placeholder="Search by name, email..."
              value={searchText}
              onChange={(e) => {
                setSearchText(e.target.value);
                setCurrentPage(1);
              }}
            />
          </div>

          {/* Status Dropdown */}
          <select 
            className="filter-select"
            value={selectedStatus}
            onChange={(e) => {
              setSelectedStatus(e.target.value);
              setCurrentPage(1);
            }}
          >
            <option value="Status">All Statuses</option>
            <option value="Active">Active (Verified)</option>
            <option value="Inactive">Inactive (Pending)</option>
          </select>

          {/* Referral Range Dropdown */}
          <select
            className="filter-select"
            value={selectedReferredClients}
            onChange={(e) => {
              setSelectedReferredClients(e.target.value);
              setCurrentPage(1);
            }}
          >
            <option value="Referred Client">Referred Clients (All)</option>
            <option value="0">0 referrals</option>
            <option value="1 to 5">1 to 5 referrals</option>
            <option value="6-10">6-10 referrals</option>
            <option value="11 above">11+ referrals</option>
          </select>

          {/* CSV Download Button */}
          <button className="btn btn-primary btn-sm-padding" onClick={handleExtractCSV}>
            <Download size={16} />
            <span>Extract</span>
          </button>

          {/* Pagination Controllers */}
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
        ) : paginatedUsers.length === 0 ? (
          <EmptyState 
            title="No referrers found" 
            message="No referrer accounts match your filters or search terms." 
            icon={UserMinus}
          />
        ) : (
          <div className="table-wrapper">
            <table className="premium-table">
              <thead>
                <tr>
                  <th>Name</th>
                  <th>Email</th>
                  <th>Contact No.</th>
                  <th style={{ textAlign: 'center' }}>Referred Clients</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {paginatedUsers.map((user) => (
                  <tr key={user.id}>
                    <td>
                      <span className="user-table-name">{user.name}</span>
                    </td>
                    <td>{user.email}</td>
                    <td>{user.contactNo}</td>
                    <td style={{ textAlign: 'center', fontWeight: 'bold' }}>
                      {user.referredClientCount}
                    </td>
                    <td>
                      <span className={`badge ${user.status === 'Active' ? 'badge-success' : 'badge-warning'}`}>
                        {user.status === 'Active' ? (
                          <>
                            <CheckCircle2 size={12} className="mr-1" /> Verified
                          </>
                        ) : (
                          <>
                            <AlertCircle size={12} className="mr-1" /> Pending
                          </>
                        )}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
};
