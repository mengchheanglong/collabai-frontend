import type { Member } from '../../shared/models/member.models';

export const members: Member[] = [
  { id: 'u1', name: 'Seoul', email: 'seoul@example.com', role: 'Admin', avatar: 'S', status: 'Active', projects: 6, joined: 'Jan 10, 2026', color: '#3b82f6' },
  { id: 'u2', name: 'Dara', email: 'dara@example.com', role: 'Admin', avatar: 'D', status: 'Active', projects: 5, joined: 'Jan 12, 2026', color: '#06b6d4' },
  { id: 'u3', name: 'Bora', email: 'bora@example.com', role: 'Member', avatar: 'B', status: 'Active', projects: 4, joined: 'Jan 15, 2026', color: '#22c55e' },
  { id: 'u4', name: 'Lina', email: 'lina@example.com', role: 'Member', avatar: 'L', status: 'Active', projects: 3, joined: 'Jan 18, 2026', color: '#0ea5e9' },
  { id: 'u5', name: 'Chanra', email: 'chanra@example.com', role: 'Member', avatar: 'C', status: 'Away', projects: 2, joined: 'Jan 20, 2026', color: '#f59e0b' },
  { id: 'u6', name: 'Pisey', email: 'pisey@example.com', role: 'Viewer', avatar: 'P', status: 'Offline', projects: 1, joined: 'Jan 26, 2026', color: '#64748b' },
];
