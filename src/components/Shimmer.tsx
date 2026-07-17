import React from 'react';

interface ShimmerProps {
  type?: 'card' | 'table' | 'line';
  count?: number;
}

export const Shimmer: React.FC<ShimmerProps> = ({ type = 'line', count = 3 }) => {
  const items = Array.from({ length: count });

  if (type === 'card') {
    return (
      <div className="shimmer-card-grid">
        {items.map((_, i) => (
          <div key={i} className="shimmer-card-item">
            <div className="shimmer-circle animate-shimmer" />
            <div className="shimmer-content-group">
              <div className="shimmer-text-line animate-shimmer short" />
              <div className="shimmer-text-line animate-shimmer medium" />
            </div>
          </div>
        ))}
      </div>
    );
  }

  if (type === 'table') {
    return (
      <div className="shimmer-table-container">
        <div className="shimmer-table-bar animate-shimmer" />
        {items.map((_, i) => (
          <div key={i} className="shimmer-table-item animate-shimmer" />
        ))}
      </div>
    );
  }

  return (
    <div className="shimmer-lines-list">
      {items.map((_, i) => (
        <div 
          key={i} 
          className="shimmer-text-line animate-shimmer" 
          style={{ width: `${Math.floor(Math.random() * 40) + 60}%` }} 
        />
      ))}
    </div>
  );
};
