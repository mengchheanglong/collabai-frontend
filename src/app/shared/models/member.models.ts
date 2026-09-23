export interface Member {
  id: string;
  name: string;
  email: string;
  role: 'Admin' | 'Member' | 'Viewer';
  avatar: string;
  avatarUrl?: string | null;
  status: 'Active' | 'Away' | 'Offline' | 'Pending';
  projects: number;
  joined: string;
  color: string;
  invitationId?: string;
}
