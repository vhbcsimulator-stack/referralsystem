import React, { useEffect, useState } from 'react';
import { 
  Check, 
  X, 
  UserCheck, 
  UserX, 
  Search, 
  FileImage,
  Eye
} from 'lucide-react';
import { supabase } from '../core/supabase';
import { Shimmer } from '../components/Shimmer';
import { EmptyState } from '../components/EmptyState';
import { ActivityService } from '../services/activityService';
import { NotificationService } from '../services/notificationService';

interface PendingUser {
  id: string;
  full_name: string;
  email: string;
  mobile_number: string;
  verification_status: string;
  id_card_url?: string;
  created_at: string;
}

interface Toast {
  id: number;
  message: string;
  type: 'success' | 'error';
}

export const UserVerification: React.FC = () => {
  const [users, setUsers] = useState<PendingUser[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchText, setSearchText] = useState('');
  const [selectedUser, setSelectedUser] = useState<PendingUser | null>(null);
  const [actionLoadingId, setActionLoadingId] = useState<string | null>(null);
  const [toasts, setToasts] = useState<Toast[]>([]);

  const showToast = (message: string, type: 'success' | 'error') => {
    const id = Date.now();
    setToasts(prev => [...prev, { id, message, type }]);
    setTimeout(() => setToasts(prev => prev.filter(t => t.id !== id)), 4000);
  };

  const fetchPendingUsers = async () => {
    setIsLoading(true);
    try {
      const { data, error } = await supabase
        .from('app_users')
        .select('*')
        .eq('role', 'referrer')
        .in('verification_status', ['pending', 'not_verified'])
        .or('id_card_url.neq.admin_portal_bypass,id_card_url.is.null')
        .order('created_at', { ascending: false });

      if (error) throw error;
      setUsers(data as PendingUser[]);
    } catch (err) {
      console.error('Error fetching verification requests:', err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchPendingUsers();
  }, []);

  const handleUpdateStatus = async (user: PendingUser, status: 'verified' | 'revoked') => {
    setActionLoadingId(user.id);
    try {
      // 1. Update verification status in app_users
      // Using select() to detect RLS-blocked silent failures (0 rows updated)
      const { data: updatedRows, error } = await supabase
        .from('app_users')
        .update({ verification_status: status })
        .eq('id', user.id)
        .select('id');

      if (error) throw error;

      // If no rows were returned, RLS likely blocked the update
      if (!updatedRows || updatedRows.length === 0) {
        throw new Error('Update was blocked. You may not have admin permissions, or your session has expired. Please log out and log in again.');
      }

      // 2. Notify User (non-blocking — don't fail the whole action if this errors)
      try {
        await NotificationService.notifyUser({
          userId: user.id,
          title: status === 'verified' ? 'Account Verified' : 'Account Revoked',
          message: status === 'verified' 
            ? 'Congratulations! Your account has been verified. You can now access the referral dashboard.'
            : 'Your referrer account verification request has been declined. Please contact support.',
          type: 'verification_update',
          entityId: user.id
        });
      } catch (notifErr) {
        console.warn('Notification failed (non-critical):', notifErr);
      }

      // 3. Log Activity (non-blocking)
      try {
        await ActivityService.logActivity({
          actionType: status === 'verified' ? ActivityService.actionUserVerified : ActivityService.actionUserRevoked,
          entityType: ActivityService.entityUser,
          entityId: user.id,
          description: `${status === 'verified' ? 'Verified' : 'Revoked'} referrer account for ${user.full_name}`,
          metadata: {
            referrer_name: user.full_name,
            email: user.email,
            status
          }
        });
      } catch (logErr) {
        console.warn('Activity log failed (non-critical):', logErr);
      }

      // Remove from local list
      setUsers(prev => prev.filter(u => u.id !== user.id));
      if (selectedUser?.id === user.id) {
        setSelectedUser(null);
      }

      showToast(
        status === 'verified'
          ? `${user.full_name} has been approved successfully.`
          : `${user.full_name}'s request has been declined.`,
        'success'
      );
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'An unexpected error occurred. Please try again.';
      console.error('Error updating verification status:', err);
      showToast(`Failed to update status: ${message}`, 'error');
    } finally {
      setActionLoadingId(null);
    }
  };

  const formatDate = (dateStr: string) => {
    try {
      const dt = new Date(dateStr);
      return dt.toLocaleDateString(undefined, { year: 'numeric', month: 'long', day: 'numeric' });
    } catch {
      return dateStr;
    }
  };

  // Filter
  const filteredUsers = users.filter(user => {
    if (searchText) {
      const q = searchText.toLowerCase();
      return (
        user.full_name.toLowerCase().includes(q) ||
        user.email.toLowerCase().includes(q) ||
        user.mobile_number.toLowerCase().includes(q)
      );
    }
    return true;
  });

  return (
    <div className="main-view-container fade-in">
      {/* Toast Notifications */}
      <div style={{ position: 'fixed', top: '24px', right: '24px', zIndex: 9999, display: 'flex', flexDirection: 'column', gap: '10px' }}>
        {toasts.map(toast => (
          <div
            key={toast.id}
            style={{
              padding: '12px 18px',
              borderRadius: '10px',
              background: toast.type === 'success' ? '#1a7f5a' : '#c0392b',
              color: '#fff',
              fontWeight: 600,
              fontSize: '14px',
              boxShadow: '0 4px 20px rgba(0,0,0,0.25)',
              maxWidth: '360px',
              animation: 'fadeIn 0.2s ease',
            }}
          >
            {toast.message}
          </div>
        ))}
      </div>
      <div className="view-header-row flex-between">
        <div>
          <h1>User Verification</h1>
          <p className="subtitle">Approve or revoke pending referrer requests</p>
        </div>

        <div className="filter-controls-row">
          <div className="search-input-wrapper">
            <Search size={18} className="search-icon" />
            <input
              type="text"
              className="form-control-search"
              placeholder="Search requests..."
              value={searchText}
              onChange={(e) => setSearchText(e.target.value)}
            />
          </div>
        </div>
      </div>

      <div className="table-card premium-card mt-4">
        {isLoading ? (
          <Shimmer type="table" count={4} />
        ) : filteredUsers.length === 0 ? (
          <EmptyState 
            title="All requests processed" 
            message="There are no pending verification requests at this moment." 
            icon={UserCheck}
          />
        ) : (
          <div className="table-wrapper">
            <table className="premium-table">
              <thead>
                <tr>
                  <th>Referrer Name</th>
                  <th>Email</th>
                  <th>Mobile Number</th>
                  <th>Request Date</th>
                  <th style={{ textAlign: 'center' }}>Details</th>
                  <th style={{ textAlign: 'center' }}>Quick Action</th>
                </tr>
              </thead>
              <tbody>
                {filteredUsers.map((user) => {
                  const isActioning = actionLoadingId === user.id;
                  return (
                    <tr key={user.id}>
                      <td>
                        <span className="user-table-name">{user.full_name}</span>
                      </td>
                      <td>{user.email}</td>
                      <td>{user.mobile_number}</td>
                      <td>{formatDate(user.created_at)}</td>
                      <td style={{ textAlign: 'center' }}>
                        <button 
                          className="btn btn-secondary btn-sm-padding inline-view-btn"
                          onClick={() => setSelectedUser(user)}
                        >
                          <Eye size={14} className="mr-1" />
                          View ID
                        </button>
                      </td>
                      <td>
                        <div className="flex-align-center justify-center gap-2">
                          <button 
                            className="verify-action-btn revoke" 
                            title="Decline Request"
                            onClick={() => handleUpdateStatus(user, 'revoked')}
                            disabled={isActioning}
                          >
                            <X size={16} />
                          </button>
                          
                          <button 
                            className="verify-action-btn approve" 
                            title="Approve Request"
                            onClick={() => handleUpdateStatus(user, 'verified')}
                            disabled={isActioning}
                          >
                            {isActioning ? <div className="spinner-btn-dark animate-spin" /> : <Check size={16} />}
                          </button>
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

      {/* ID Verification Details Modal Dialog */}
      {selectedUser && (
        <div className="modal-backdrop">
          <div className="modal-card">
            <div className="modal-header flex-between">
              <h2>ID Card Verification</h2>
              <button className="panel-close-btn" onClick={() => setSelectedUser(null)}>
                <X size={20} />
              </button>
            </div>

            <div className="modal-body mt-4">
              <div className="details-grid">
                <div className="details-section-header">Applicant details</div>
                <div className="details-row">
                  <span className="details-label">Full Name</span>
                  <span className="details-val">{selectedUser.full_name}</span>
                </div>
                <div className="details-row">
                  <span className="details-label">Email Address</span>
                  <span className="details-val">{selectedUser.email}</span>
                </div>
                <div className="details-row">
                  <span className="details-label">Mobile Number</span>
                  <span className="details-val">{selectedUser.mobile_number}</span>
                </div>
                <div className="details-row">
                  <span className="details-label">Applied On</span>
                  <span className="details-val">{formatDate(selectedUser.created_at)}</span>
                </div>

                <div className="details-section-header mt-4">Uploaded Identification</div>
                <div className="id-card-image-container mt-2">
                  {selectedUser.id_card_url ? (
                    <img 
                      src={selectedUser.id_card_url} 
                      alt="Referrer Uploaded ID Card" 
                      className="verification-id-img"
                    />
                  ) : (
                    <div className="no-id-card-placeholder">
                      <FileImage size={42} />
                      <p>No ID Card uploaded by this applicant.</p>
                    </div>
                  )}
                </div>
              </div>
            </div>

            <div className="modal-footer mt-6 flex-align-center gap-2">
              <button 
                className="btn btn-secondary w-full"
                onClick={() => handleUpdateStatus(selectedUser, 'revoked')}
                disabled={actionLoadingId === selectedUser.id}
              >
                <UserX size={16} className="mr-1" />
                Reject Applicant
              </button>
              
              <button 
                className="btn btn-primary w-full"
                onClick={() => handleUpdateStatus(selectedUser, 'verified')}
                disabled={actionLoadingId === selectedUser.id}
              >
                <UserCheck size={16} className="mr-1" />
                Approve Applicant
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
