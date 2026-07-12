import type { Workspace } from '../../shared/models/project.models';

export const workspaces: Workspace[] = [
  { id: 'collabai', name: 'CollabAI Team', icon: 'C', accent: '#3b82f6', projectNames: ['CollabAI Platform'], description: 'Product sprint' },
  { id: 'school', name: 'School Project', icon: 'S', accent: '#22c55e', projectNames: ['School Management', 'Green Campus App'], description: 'Campus apps' },
  { id: 'marketing', name: 'Marketing', icon: 'M', accent: '#f59e0b', projectNames: ['Marketing Website'], description: 'Launch work' },
  { id: 'personal', name: 'Personal', icon: 'P', accent: '#06b6d4', projectNames: ['Research Assistant'], description: 'AI experiments' },
];
