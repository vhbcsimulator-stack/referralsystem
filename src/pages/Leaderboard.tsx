import React, { useEffect, useState } from 'react';
import { Trophy, Medal } from 'lucide-react';
import { supabase } from '../core/supabase';
import { Shimmer } from '../components/Shimmer';

interface LeaderboardItem {
  rank: number;
  name: string;
  email: string;
  closedSales: number;
}

export const Leaderboard: React.FC = () => {
  const [items, setItems] = useState<LeaderboardItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const fetchLeaderboard = async () => {
    setIsLoading(true);
    try {
      // 1. Fetch referrers
      const { data: usersData, error: usersErr } = await supabase
        .from('app_users')
        .select('full_name, email')
        .eq('role', 'referrer');

      if (usersErr) throw usersErr;

      // 2. Fetch clients with status Closed Sale, joining schedules & app_users
      const { data: clientsData, error: clientsErr } = await supabase
        .from('clients')
        .select(`
          referrer_name,
          status,
          schedules (
            referrer_id,
            app_users (
              email
            )
          )
        `)
        .in('status', ['Closed Sale', 'Closed Sale with CTS']);

      if (clientsErr) throw clientsErr;

      // Map referral counts based on referrer email
      const counts: Record<string, number> = {};
      clientsData?.forEach((client: any) => {
        let email = client.schedules?.app_users?.email;
        
        // Fallback: match by name if email is not found from schedule relation
        if (!email && client.referrer_name) {
          const matchedUser = usersData?.find(
            u => u.full_name?.trim().toLowerCase() === client.referrer_name.trim().toLowerCase()
          );
          if (matchedUser) {
            email = matchedUser.email;
          }
        }

        if (email) {
          counts[email] = (counts[email] || 0) + 1;
        }
      });

      // Combine
      let list: LeaderboardItem[] = (usersData || []).map(u => ({
        rank: 0,
        name: u.full_name || 'Unknown',
        email: u.email || '',
        closedSales: counts[u.email || ''] || 0
      }));

      // Sort descending
      list.sort((a, b) => b.closedSales - a.closedSales);

      // Assign ranks
      list = list.map((item, idx) => ({
        ...item,
        rank: idx + 1
      }));

      setItems(list);
    } catch (err) {
      console.error('Error fetching leaderboard:', err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchLeaderboard();
  }, []);

  const getInitials = (name: string) => {
    return name
      .split(' ')
      .map(w => w[0])
      .slice(0, 2)
      .join('')
      .toUpperCase() || 'U';
  };

  // Extract top 3 for podium
  const podium = {
    first: items.find(i => i.rank === 1),
    second: items.find(i => i.rank === 2),
    third: items.find(i => i.rank === 3),
  };

  // Table items (rank > 3)
  const tableItems = items.filter(i => i.rank > 3);

  return (
    <div className="main-view-container fade-in">
      {/* Title */}
      <div className="view-header-row">
        <div>
          <h1>Referrer Leaderboard</h1>
          <p className="subtitle">Top performing referral agents ranking</p>
        </div>
      </div>

      {isLoading ? (
        <Shimmer type="card" count={3} />
      ) : items.length === 0 ? (
        <div className="premium-card text-center p-8">
          <Trophy size={48} className="text-light-grey opacity-50 m-auto" />
          <p className="text-light-grey mt-4">No referrers active yet.</p>
        </div>
      ) : (
        <div className="leaderboard-content mt-4">
          {/* Podium section */}
          <div className="podium-container">
            {/* Second Place (Left) */}
            {podium.second && (
              <div className="podium-stand-wrapper second">
                <div className="podium-avatar second-color">
                  {getInitials(podium.second.name)}
                  <span className="podium-rank-badge">2</span>
                </div>
                <span className="podium-name">{podium.second.name}</span>
                <span className="podium-sales-count">{podium.second.closedSales} sales</span>
                <div className="podium-pedestal pedestal-second">
                  <span>2nd</span>
                </div>
              </div>
            )}

            {/* First Place (Middle) */}
            {podium.first && (
              <div className="podium-stand-wrapper first">
                <div className="podium-avatar first-color">
                  {getInitials(podium.first.name)}
                  <span className="podium-rank-badge first">
                    <Trophy size={14} fill="currentColor" />
                  </span>
                </div>
                <span className="podium-name">{podium.first.name}</span>
                <span className="podium-sales-count">{podium.first.closedSales} sales</span>
                <div className="podium-pedestal pedestal-first">
                  <span>1st</span>
                </div>
              </div>
            )}

            {/* Third Place (Right) */}
            {podium.third && (
              <div className="podium-stand-wrapper third">
                <div className="podium-avatar third-color">
                  {getInitials(podium.third.name)}
                  <span className="podium-rank-badge">3</span>
                </div>
                <span className="podium-name">{podium.third.name}</span>
                <span className="podium-sales-count">{podium.third.closedSales} sales</span>
                <div className="podium-pedestal pedestal-third">
                  <span>3rd</span>
                </div>
              </div>
            )}
          </div>

          {/* Table for remaining rankings */}
          {tableItems.length > 0 && (
            <div className="table-card premium-card mt-8">
              <div className="table-wrapper">
                <table className="premium-table">
                  <thead>
                    <tr>
                      <th style={{ width: '80px', textAlign: 'center' }}>Rank</th>
                      <th>Referrer Name</th>
                      <th>Email Address</th>
                      <th style={{ width: '150px', textAlign: 'center' }}>Closed Sales</th>
                    </tr>
                  </thead>
                  <tbody>
                    {tableItems.map((item) => (
                      <tr key={item.rank}>
                        <td style={{ textAlign: 'center' }}>
                          <span className="leaderboard-table-rank flex-align-center justify-center">
                            <Medal size={16} className="text-light-grey mr-1" />
                            {item.rank}
                          </span>
                        </td>
                        <td>
                          <span className="user-table-name">{item.name}</span>
                        </td>
                        <td>{item.email}</td>
                        <td style={{ textAlign: 'center', fontWeight: 'bold' }}>
                          {item.closedSales}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
};
