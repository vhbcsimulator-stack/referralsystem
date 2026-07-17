import { supabase } from '../core/supabase';

export const ActivityService = {
  // Action types
  actionStatusChange: 'STATUS_CHANGE',
  actionScheduleApproved: 'SCHEDULE_APPROVED',
  actionScheduleCancelled: 'SCHEDULE_CANCELLED',
  actionUserVerified: 'USER_VERIFIED',
  actionUserRevoked: 'USER_REVOKED',

  // Entity types
  entityClient: 'client',
  entitySchedule: 'schedule',
  entityUser: 'user',

  async logActivity({
    actionType,
    entityType,
    entityId,
    description,
    metadata = {},
  }: {
    actionType: string;
    entityType: string;
    entityId: string;
    description: string;
    metadata?: Record<string, any>;
  }) {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        console.warn('Attempted to log activity without an authenticated user.');
        return;
      }

      const { error } = await supabase.from('activity_logs').insert({
        user_id: user.id,
        action_type: actionType,
        entity_type: entityType,
        entity_id: entityId,
        description,
        metadata,
      });

      if (error) throw error;
      console.log('Activity logged:', description);
    } catch (e) {
      console.error('Error logging activity:', e);
    }
  }
};
