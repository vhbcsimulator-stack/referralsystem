import { supabase } from '../core/supabase';

export interface Notification {
  id: string;
  user_id: string;
  title: string;
  message: string;
  type: string;
  is_read: boolean;
  entity_id?: string;
  metadata?: Record<string, any>;
  created_at: string;
}

export const NotificationService = {
  async getNotifications(): Promise<Notification[]> {
    try {
      const { data, error } = await supabase
        .from('notifications')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) throw error;
      return data as Notification[];
    } catch (err) {
      console.error('Error fetching notifications:', err);
      return [];
    }
  },

  async markAsRead(id: string): Promise<void> {
    try {
      const { error } = await supabase
        .from('notifications')
        .update({ is_read: true })
        .eq('id', id);

      if (error) throw error;
    } catch (err) {
      console.error('Error marking notification as read:', err);
    }
  },

  async markAllAsRead(userId: string): Promise<void> {
    try {
      const { error } = await supabase
        .from('notifications')
        .update({ is_read: true })
        .eq('user_id', userId)
        .eq('is_read', false);

      if (error) throw error;
    } catch (err) {
      console.error('Error marking all notifications as read:', err);
    }
  },

  subscribeToNotifications(userId: string, onUpdate: () => void) {
    const channel = supabase
      .channel(`public:notifications:user=${userId}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'notifications',
          filter: `user_id=eq.${userId}`,
        },
        (payload) => {
          console.log('Notification update detected:', payload.eventType);
          onUpdate();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  },

  async notifyUser({
    userId,
    title,
    message,
    type,
    entityId,
    metadata = {},
  }: {
    userId: string;
    title: string;
    message: string;
    type: string;
    entityId?: string;
    metadata?: Record<string, any>;
  }) {
    try {
      const { error } = await supabase.from('notifications').insert({
        user_id: userId,
        title,
        message,
        type,
        entity_id: entityId,
        metadata,
      });
      if (error) throw error;
    } catch (err) {
      console.error('Error notifying user:', err);
    }
  },

  async notifyAdmins({
    title,
    message,
    type,
    entityId,
    metadata = {},
  }: {
    title: string;
    message: string;
    type: string;
    entityId?: string;
    metadata?: Record<string, any>;
  }) {
    try {
      const { data: admins, error: adminErr } = await supabase
        .from('app_users')
        .select('id')
        .eq('role', 'admin');

      if (adminErr) throw adminErr;
      if (!admins || admins.length === 0) return;

      const notifications = admins.map((admin) => ({
        user_id: admin.id,
        title,
        message,
        type,
        entity_id: entityId,
        metadata,
      }));

      const { error } = await supabase.from('notifications').insert(notifications);
      if (error) throw error;
    } catch (err) {
      console.error('Error notifying admins:', err);
    }
  }
};
