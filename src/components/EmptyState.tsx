import React from 'react';
import { Inbox } from 'lucide-react';

interface EmptyStateProps {
  title?: string;
  message?: string;
  icon?: React.ComponentType<{ size?: number; className?: string }>;
}

export const EmptyState: React.FC<EmptyStateProps> = ({ 
  title = 'No Data Found', 
  message = 'There are no records to display here.',
  icon: Icon = Inbox
}) => {
  return (
    <div className="empty-state-container">
      <div className="empty-state-icon-bg">
        <Icon size={42} className="empty-state-icon" />
      </div>
      <h3 className="empty-state-title">{title}</h3>
      <p className="empty-state-message">{message}</p>
    </div>
  );
};
