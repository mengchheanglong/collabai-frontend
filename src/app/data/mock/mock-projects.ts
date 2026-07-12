import type { Project } from '../../shared/models/project.models';

export const projects: Project[] = [
  { id: 'p1', name: 'CollabAI Platform', team: 'Product Team', progress: 75, icon: 'C', accent: '#3b82f6', members: ['S', 'D', 'B', 'L'], description: 'Core product sprint — auth, boards, AI, realtime.' },
  { id: 'p2', name: 'Green Campus App', team: 'Design Team', progress: 60, icon: 'G', accent: '#22c55e', members: ['D', 'B', 'C'], description: 'Campus sustainability tracking for students.' },
  { id: 'p3', name: 'Marketing Website', team: 'Marketing Team', progress: 40, icon: 'M', accent: '#f59e0b', members: ['S', 'L'], description: 'Launch site, copy, and campaign landing pages.' },
  { id: 'p4', name: 'School Management', team: 'Development Team', progress: 90, icon: 'S', accent: '#06b6d4', members: ['S', 'D', 'B'], description: 'Admin tools for classes, grades, and attendance.' },
  { id: 'p5', name: 'Research Assistant', team: 'AI Team', progress: 55, icon: 'R', accent: '#a78bfa', members: ['S', 'C'], description: 'Personal AI experiments and paper summarizer.' },
];
