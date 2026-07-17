export interface Member {
  id: string;
  name: string;
  email: string;
  role: 'Admin' | 'Member' | 'Viewer';
  avatar: string;
  status: 'Active' | 'Away' | 'Offline';
  projects: number;
  joined: string;
  color: string;
}
